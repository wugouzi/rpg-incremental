// combat.js — 战斗逻辑（伤害计算、自动战斗 tick、死亡/胜利流程）

const Combat = (() => {
  // 攻击计时累积器（ms）
  let heroTimer    = 0;
  let monsterTimer = 0;
  // 主动技能冷却计时器 { skillId: remainingMs }
  let skillCooldowns = {};
  // 毒效果计时（游侠）
  let poisonTimer  = 0;
  let isPoisoned   = false;
  // Cryo 专精：减速（旧 frost_nova 兼容 + post-freeze slow）
  let slowTimer    = 0;
  let monsterSlowed = false;
  // Pyro：Heat Shield 反伤计时
  let heatShieldTimer = 0;
  let heatShieldActive = false;
  // Storm：Lightning Rod 反弹计时
  let lightningRodTimer = 0;
  let lightningRodActive = false;
  let lightningRodHits = 0;
  // Ice Barrier（Cryo）
  let iceBarrierHp = 0;
  // Rest 状态
  let isResting = false;
  let restTimer = 0;         // Rest 持续计时（ms）
  const REST_DURATION = 5000; // Rest 持续 5 秒后自动结束
  // 小数累计（避免 hpr/mpr < 1 时被 round 到 0）
  let hpRegenAcc = 0;        // HP 回复小数累计
  let mpRegenAcc = 0;        // MP 回复小数累计

  // ─────────────────────────────────────────
  // 辅助：获取充能上限
  // ─────────────────────────────────────────
  function getChargeCap() {
    const effects = Skills.getEffects();
    return 5 + (effects.chargeCapBonus || 0);  // 基础 5，Static Field +1
  }

  // ─────────────────────────────────────────
  // 辅助：法师是否在满充能状态
  // ─────────────────────────────────────────
  function isFullCharge() {
    const state = State.get();
    if (!state.mage) return false;
    return state.mage.charge >= getChargeCap();
  }

  // ─────────────────────────────────────────
  // 辅助：积累充能（Storm）
  // ─────────────────────────────────────────
  function addCharge(n) {
    const state = State.get();
    if (!state.mage) return;
    const cap = getChargeCap();
    const was = state.mage.charge;
    state.mage.charge = Math.min(cap, state.mage.charge + n);
    if (was < cap && state.mage.charge >= cap && window.UI) {
      UI.addLog(`>> [STORM] Fully Charged! (${cap}/${cap})`, "yellow");
    }
    if (window.UI) UI.markSidePanelDirty();
  }

  // ─────────────────────────────────────────
  // 辅助：积累灼烧层（Pyro）
  // ─────────────────────────────────────────
  function addBurn(n) {
    const state = State.get();
    if (!state.mage || !state.currentMonster) return;
    const effects = Skills.getEffects();
    const cap = 5 + (effects.burnCapBonus || 0);
    state.mage.burnStack = Math.min(cap, state.mage.burnStack + n);
    if (window.UI) UI.markSidePanelDirty();
  }

  // ─────────────────────────────────────────
  // 辅助：积累寒冷层（Cryo）
  // ─────────────────────────────────────────
  function addChill(n) {
    const state = State.get();
    if (!state.mage || !state.currentMonster) return;
    if (state.mage.frozen) return;  // 已冰冻不再叠
    const prev = state.mage.chillStack;
    state.mage.chillStack = Math.min(5, state.mage.chillStack + n);
    // 到达 5 层时触发冰冻
    if (prev < 5 && state.mage.chillStack >= 5) {
      triggerFreeze();
    } else if (window.UI) {
      UI.markSidePanelDirty();
    }
  }

  // ─────────────────────────────────────────
  // 辅助：触发冰冻（Cryo）
  // ─────────────────────────────────────────
  function triggerFreeze() {
    const state = State.get();
    if (!state.mage || !state.currentMonster) return;
    const effects = Skills.getEffects();
    state.mage.frozen = true;
    state.mage.chillStack = 0;
    state.mage.freezeTimer = effects.freezeDuration || 2000;
    if (window.UI) UI.addLog(`>> [CRYO] FROZEN! Monster stops for ${(state.mage.freezeTimer/1000).toFixed(1)}s`, "cyan");
    // absolute_zero：回复 MP
    if (effects.freezeMpRegen > 0) {
      const mpRegen = Math.floor(State.getTotalMaxMp() * effects.freezeMpRegen);
      state.hero.mp = Math.min(State.getTotalMaxMp(), state.hero.mp + mpRegen);
      if (window.UI) UI.addLog(`>> [CRYO] Freeze MP regen: +${mpRegen}`, "cyan");
    }
    // permafrost：标记下场初始寒冷层
    if (effects.permafrost) {
      state.mage.nextFightChillBonus = 2;
    }
    if (window.UI) UI.markSidePanelDirty();
  }

  // ─────────────────────────────────────────
  // 辅助：Ignite Explosion（Pyro 击杀触发或 Inferno 手动触发）
  // ─────────────────────────────────────────
  function triggerExplosion(stacks) {
    const state = State.get();
    if (!state.currentMonster) return;
    const effects = Skills.getEffects();
    const atk = State.getTotalAtk();
    let explosionDmg = Math.floor(atk * 0.5 * stacks * effects.explosionMult);

    // phoenix_flame：可暴击
    let explosionCrit = false;
    if (effects.explosionCanCrit && Utils.chance(State.getTotalCrit())) {
      explosionDmg = Math.floor(explosionDmg * Skills.getEffects().critMult);
      explosionCrit = true;
    }

    state.currentMonster.currentHp -= explosionDmg;
    state.stats.totalDmgDealt += explosionDmg;
    const critStr = explosionCrit ? " [CRIT!]" : "";
    if (window.UI) UI.addLog(`>> [PYRO] Ignite Explosion! ${stacks} stacks → ${explosionDmg} dmg!${critStr}`, "red");

    // phoenix_flame：回血
    if (effects.explosionHpRegen > 0) {
      const heal = Math.floor(State.getTotalMaxHp() * effects.explosionHpRegen);
      state.hero.hp = Math.min(State.getTotalMaxHp(), state.hero.hp + heal);
      if (window.UI) UI.addLog(`>> [PYRO] Phoenix Flame: +${heal} HP`, "green");
    }

    // 清空灼烧
    state.mage.burnStack = 0;

    if (state.currentMonster.currentHp <= 0) {
      onMonsterDeath();
    }
  }

  // ─────────────────────────────────────────
  // 进入战斗
  // ─────────────────────────────────────────

  function startFight(monster) {
    const state = State.get();
    state.currentMonster = monster;
    heroTimer    = 0;
    monsterTimer = 0;
    poisonTimer  = 0;
    slowTimer    = 0;
    isPoisoned   = false;
    monsterSlowed = false;
    heatShieldActive = false;
    heatShieldTimer  = 0;
    lightningRodActive = false;
    lightningRodTimer  = 0;
    lightningRodHits   = 0;
    iceBarrierHp = 0;

    // 重置法师 per-fight 状态
    if (state.mage) {
      // 清 per-fight 状态
      state.mage.burnStack    = 0;
      state.mage.burnDotTimer = 0;
      state.mage.frozen       = false;
      state.mage.freezeTimer  = 0;
      state.mage.charge       = 0;   // Storm: 每场战斗充能从 0 开始
      state.mage.lastRiteUsed = false;
      state.mage.counterspellActive = false;
      state.mage.counterspellTimer  = 0;
      state.mage.counterspellHits   = 0;
      state.mage.blinkImmune       = false;
      state.mage.blinkImmuneTimer  = 0;
      state.mage.timeWarpActive    = false;
      state.mage.timeWarpTimer     = 0;

      // Cryo: permafrost 初始寒冷
      const chillBonus = state.mage.nextFightChillBonus || 0;
      state.mage.nextFightChillBonus = 0;
      if (chillBonus > 0) {
        state.mage.chillStack = chillBonus;
        if (window.UI) UI.addLog(`>> [CRYO] Permafrost: ${chillBonus} Chill stacks preset!`, "cyan");
      } else {
        state.mage.chillStack = 0;
      }

      // Arcane Ward：战斗开始时生成护盾
      const effects = Skills.getEffects();
      if (effects.arcaneWard) {
        state.mage.arcaneWardHp = Math.floor(State.getTotalMaxHp() * effects.arcaneWardPct);
        if (window.UI) UI.addLog(`>> [WARD] Arcane Ward: ${state.mage.arcaneWardHp} shield`, "cyan");
      } else {
        state.mage.arcaneWardHp = 0;
      }

      // Ice Barrier：初始化（主动技能触发时才激活，这里清零）
      iceBarrierHp = 0;

      // Ley Line：满蓝开始
      if (state.mage.leyLineReady) {
        state.mage.leyLineReady = false;
        state.hero.mp = State.getTotalMaxMp();
        if (window.UI) UI.addLog(`>> [LEY] Ley Line: starting with full MP!`, "cyan");
      } else {
        // 默认：50% MP 开始战斗
        state.hero.mp = Math.floor(State.getTotalMaxMp() * 0.5);
      }
    }

    if (window.UI) {
      UI.addLog(`>> [${Zones.getZone(state.currentZone).name}] ${monster.name} appears!`, "white");
    }
  }

  /**
   * 生成并开始战斗（从当前区域 spawn 普通怪物）
   */
  function spawnAndFight() {
    const state = State.get();
    const monster = Monsters.spawn(state.currentZone);
    if (monster) startFight(monster);
  }

  /**
   * 召唤并挑战 Boss
   */
  function challengeBoss() {
    const state = State.get();
    if (Zones.isBossDefeated(state.currentZone)) {
      UI.addLog(">> Boss already defeated in this zone.", "gray");
      return;
    }
    const boss = Monsters.spawnBoss(state.currentZone);
    if (boss) {
      UI.addLog(`>> BOSS BATTLE: ${boss.name}!`, "yellow");
      startFight(boss);
    }
  }

  // ─────────────────────────────────────────
  // 伤害计算
  // ─────────────────────────────────────────

  function calcHeroDmg(skillEffect, opts) {
    const atk = State.getTotalAtk();
    const state = State.get();
    const monster = state.currentMonster;
    const effects = Skills.getEffects();

    // 冰冻期间英雄 ATK 加成
    const isFrozen = state.mage && state.mage.frozen;
    const frozenAtkMult = isFrozen ? (1 + effects.freezeAtkBonus) : 1;

    let dmgMult = skillEffect ? (skillEffect.dmgMult || 1) : 1;

    // DEF bypass（Ball Lightning）
    const defBypass = skillEffect && skillEffect.defBypass ? skillEffect.defBypass : 0;
    const effectiveDef = Math.floor((monster.def || 0) * (1 - defBypass));

    let rawDmg = Math.max(1, atk * dmgMult * frozenAtkMult - effectiveDef);

    // magic skill damage mult（arcane_mastery）
    if (skillEffect && effects.magicDmgMult > 1) {
      rawDmg *= effects.magicDmgMult;
    }

    // focus：HP > 80% 时技能伤害 +20%
    if (skillEffect && effects.focus) {
      const maxHp = State.getTotalMaxHp();
      if (state.hero.hp > maxHp * 0.8) {
        rawDmg *= 1.2;
      }
    }

    // Storm: Overcharge / Charge 额外伤害
    const isStorm = state.mage && state.mage.spec === "storm";
    if (isStorm && skillEffect) {
      if (isFullCharge() && effects.overchargeDmgBonus > 0) {
        rawDmg *= (1 + effects.overchargeDmgBonus);
      }
    }

    // Storm: 消耗充能（chain_lightning / ball_lightning）
    let chargesConsumed = 0;
    if (isStorm && skillEffect && skillEffect.consumeCharge && state.mage) {
      chargesConsumed = state.mage.charge;
      const retain = effects.chargeRetain || 0;
      state.mage.charge = Math.max(0, state.mage.charge - Math.max(0, chargesConsumed - retain));
      if (chargesConsumed > 0) {
        rawDmg *= (1 + chargesConsumed * (skillEffect.chargeDmgPerStack || 0.2));
      }
    }

    // 暴击检查（含冰冻暴击加成 + Spell Surge）
    let critRate = State.getTotalCrit();
    if (isFrozen && effects.freezeCritBonus > 0) critRate = Math.min(0.95, critRate + effects.freezeCritBonus);
    const isCrit = Utils.chance(critRate);
    // Spell Surge：MP > 80% 时额外暴击判定
    const maxMp = State.getTotalMaxMp();
    const spellSurgeCrit = (skillEffect && effects.spellSurge && state.hero.mp > maxMp * 0.8)
      ? Utils.chance(critRate)
      : false;
    const effectiveCrit = isCrit || spellSurgeCrit;

    if (effectiveCrit) {
      rawDmg = Math.floor(rawDmg * effects.critMult);
    }

    // thunder_mastery: Ball Lightning crit 不消耗充能（已消耗，此处回补）
    if (isStorm && skillEffect && skillEffect.id === "ball_lightning" && effectiveCrit && effects.critNoConsumeCharge) {
      state.mage.charge = Math.min(getChargeCap(), state.mage.charge + chargesConsumed);
    }

    return { damage: Math.floor(rawDmg), isCrit: effectiveCrit, chargesConsumed };
  }

  function calcMonsterDmg() {
    const state = State.get();
    const monster = state.currentMonster;
    const def = State.getTotalDef();
    const effects = Skills.getEffects();
    const resist = State.getTotalResistance();

    let rawDmg = Math.max(1, monster.atk - def);

    // 元素抗性减伤
    const elemMap = {
      fire:      resist.fire,
      ice:       resist.ice,
      lightning: resist.lightning,
      poison:    resist.poison,
      phys:      resist.phys,
    };
    const resVal = elemMap[monster.element] || 0;
    if (resVal > 0) {
      rawDmg = Math.max(1, Math.floor(rawDmg * (1 - resVal / 100)));
    }

    // 闪避检查
    if (Utils.chance(effects.dodgeAdd || 0)) {
      return { damage: 0, mpDmg: 0, dodged: true, element: monster.element };
    }

    // Blink 免疫
    if (state.mage && state.mage.blinkImmune) {
      state.mage.blinkImmune = false;
      state.mage.blinkImmuneTimer = 0;
      if (window.UI) UI.addLog(">> [BLINK] Immune! Hit negated.", "cyan");
      return { damage: 0, mpDmg: 0, dodged: false, blinked: true, element: monster.element };
    }

    // Counterspell
    if (state.mage && state.mage.counterspellActive) {
      state.mage.counterspellHits++;
      const reflectDmg = Math.floor(rawDmg * (state.mage.counterspellReflect || 0.5));
      state.currentMonster.currentHp -= reflectDmg;
      state.stats.totalDmgDealt += reflectDmg;
      if (window.UI) UI.addLog(`>> [COUNTERSPELL] Reflected ${reflectDmg} dmg!`, "cyan");
      if (state.mage.counterspellHits >= 1) {
        state.mage.counterspellActive = false;
      }
      return { damage: 0, mpDmg: 0, dodged: false, countered: true, element: monster.element };
    }

    // Ice Barrier
    if (iceBarrierHp > 0) {
      const absorbed = Math.min(iceBarrierHp, rawDmg);
      iceBarrierHp -= absorbed;
      rawDmg -= absorbed;
      if (iceBarrierHp <= 0) {
        // 破碎溅射
        const atk = State.getTotalAtk();
        const splashDmg = Math.floor(atk * 0.8);
        if (state.currentMonster) {
          state.currentMonster.currentHp -= splashDmg;
          state.stats.totalDmgDealt += splashDmg;
          addChill(1);
          if (window.UI) UI.addLog(`>> [ICE] Barrier broken! Splash ${splashDmg} dmg + Chill!`, "cyan");
          if (state.currentMonster.currentHp <= 0) {
            onMonsterDeath();
            return { damage: 0, mpDmg: 0, dodged: false, element: monster.element };
          }
        }
      }
      if (rawDmg <= 0) {
        return { damage: 0, mpDmg: 0, dodged: false, element: monster.element };
      }
    }

    // Arcane Ward 护盾
    if (state.mage && state.mage.arcaneWardHp > 0) {
      const absorbed = Math.min(state.mage.arcaneWardHp, rawDmg);
      state.mage.arcaneWardHp -= absorbed;
      rawDmg -= absorbed;
      if (rawDmg <= 0) {
        return { damage: 0, mpDmg: 0, dodged: false, element: monster.element };
      }
    }

    // Mana Shield：10% 转 MP 损耗
    let mpDmg = 0;
    if (effects.mpAbsorb > 0 && state.hero.mp > 0) {
      mpDmg = Math.floor(rawDmg * effects.mpAbsorb);
      mpDmg = Math.min(mpDmg, state.hero.mp);
      rawDmg -= mpDmg;
    }

    return { damage: Math.max(0, Math.floor(rawDmg)), mpDmg, dodged: false, element: monster.element };
  }

  // ─────────────────────────────────────────
  // 攻击动作
  // ─────────────────────────────────────────

  function heroAttack(skillEffect) {
    const state = State.get();
    const monster = state.currentMonster;
    if (!monster || monster.currentHp <= 0) return;

    const { damage, isCrit, chargesConsumed } = calcHeroDmg(skillEffect);
    monster.currentHp -= damage;
    state.stats.totalDmgDealt += damage;

    const skillName = skillEffect ? ` [${skillEffect.name || "SKILL"}]` : "";
    const critLabel = isCrit ? " [CRIT!]" : "";
    UI.addLog(`>> You${skillName} hit ${monster.name} for ${damage} dmg.${critLabel}`, "green");

    const effects = Skills.getEffects();

    // Mana Drain：回复 MP
    if (skillEffect && skillEffect.manaDrainReturn) {
      const mpRegen = Math.floor(damage * skillEffect.manaDrainReturn);
      state.hero.mp = Math.min(State.getTotalMaxMp(), state.hero.mp + mpRegen);
      if (window.UI) UI.addLog(`>> [MANA] Drain: +${mpRegen} MP`, "cyan");
    }

    // 施法 MP 回复（arcane_mastery）
    if (skillEffect && effects.castMpRegen > 0) {
      const mpRegen = Math.floor(State.getTotalMaxMp() * effects.castMpRegen);
      state.hero.mp = Math.min(State.getTotalMaxMp(), state.hero.mp + mpRegen);
    }

    // Static Field：主动技能命中积累充能
    const isStorm = state.mage && state.mage.spec === "storm";
    if (isStorm && skillEffect && effects.skillBuildCharge) {
      addCharge(1);
    }

    // Pyro：法术叠灼烧
    if (state.mage && state.mage.spec === "pyro") {
      if (skillEffect && skillEffect.burnAdd) {
        addBurn(skillEffect.burnAdd);
        const stacks = state.mage.burnStack;
        if (window.UI) UI.addLog(`>> [PYRO] Burn stacks: ${stacks}`, "red");
      }
      // Inferno：超过阈值直接爆炸
      if (skillEffect && skillEffect.explosionThreshold) {
        if (state.mage.burnStack >= skillEffect.explosionThreshold && monster.currentHp > 0) {
          triggerExplosion(state.mage.burnStack);
          return; // 爆炸可能已杀死怪物
        }
      }
      // Scorched Earth：普通攻击叠灼烧
      if (!skillEffect && effects.normalAttackBurn > 0) {
        addBurn(effects.normalAttackBurn);
      }
    }

    // Cryo：法术叠寒冷
    if (state.mage && state.mage.spec === "cryo") {
      if (skillEffect && skillEffect.chillAdd) {
        addChill(skillEffect.chillAdd);
        if (!state.mage.frozen) {
          if (window.UI) UI.addLog(`>> [CRYO] Chill stacks: ${state.mage.chillStack}/5`, "cyan");
        }
      }
    }

    // Storm: Storm Surge 普攻溅射（满充能时）
    if (isStorm && !skillEffect && effects.stormSurge && isFullCharge()) {
      const splashDmg = Math.floor(State.getTotalAtk() * effects.stormSurgeDmg);
      if (monster.currentHp > 0 && splashDmg > 0) {
        monster.currentHp -= splashDmg;
        state.stats.totalDmgDealt += splashDmg;
        if (window.UI) UI.addLog(`>> [STORM] Storm Surge: +${splashDmg} lightning splash!`, "yellow");
      }
    }

    // Storm: 普通攻击积累充能（每普攻 +1）
    if (isStorm && !skillEffect) {
      addCharge(1);
    }

    // 毒效果（游侠被动）
    if (effects.poisonPct > 0 && !isPoisoned) {
      isPoisoned = true;
      poisonTimer = effects.poisonDuration || 3000;
      UI.addLog(`>> ${monster.name} is poisoned!`, "cyan");
    }

    if (monster.currentHp <= 0) {
      onMonsterDeath();
    }
  }

  function monsterAttack() {
    const state = State.get();
    const monster = state.currentMonster;
    if (!monster) return;

    const result = calcMonsterDmg();
    const { damage, mpDmg, dodged, blinked, countered } = result;

    if (dodged) {
      UI.addLog(`>> You dodged ${monster.name}'s attack!`, "cyan");
      return;
    }
    if (blinked || countered) {
      // 已在 calcMonsterDmg 中处理
      if (result.countered && state.currentMonster && state.currentMonster.currentHp <= 0) {
        onMonsterDeath();
      }
      return;
    }

    const effects = Skills.getEffects();

    // Heat Shield（Pyro）：被击反伤 + 灼烧
    if (heatShieldActive && state.currentMonster) {
      const reflectDmg = Math.floor(State.getTotalAtk() * effects.heatShieldReflect);
      if (reflectDmg > 0) {
        state.currentMonster.currentHp -= reflectDmg;
        state.stats.totalDmgDealt += reflectDmg;
        addBurn(1);
        if (window.UI) UI.addLog(`>> [HEAT] Heat Shield reflects ${reflectDmg} + 1 Burn!`, "red");
        if (state.currentMonster.currentHp <= 0) {
          onMonsterDeath();
          return;
        }
      }
    }

    // Lightning Rod（Storm）：被击反弹 + 充能
    if (lightningRodActive && lightningRodHits < 3 && state.currentMonster) {
      const roReflect = effects.lightningRodReflect || 0.5;
      const rodDmg = Math.floor(State.getTotalAtk() * roReflect);
      if (rodDmg > 0) {
        state.currentMonster.currentHp -= rodDmg;
        state.stats.totalDmgDealt += rodDmg;
        addCharge(1);
        lightningRodHits++;
        if (window.UI) UI.addLog(`>> [STORM] Lightning Rod: ${rodDmg} dmg + 1 Charge!`, "yellow");
        if (state.currentMonster.currentHp <= 0) {
          onMonsterDeath();
          return;
        }
      }
    }

    // Glacial Armor（Cryo）：被击也叠寒冷
    if (state.mage && state.mage.spec === "cryo") {
      const hitChill = effects.hitChillReflect || 0;
      if (hitChill > 0) addChill(hitChill);
    }

    if (mpDmg > 0) {
      state.hero.mp = Math.max(0, state.hero.mp - mpDmg);
    }

    if (damage > 0) {
      state.hero.hp = Math.max(0, state.hero.hp - damage);
      UI.addLog(`>> ${monster.name} hits you for ${damage} dmg.`, "red");
    }

    // Last Rite：首次 HP < 20% 触发（含一击必杀情形，hp=0 时也检查）
    if (effects.lastRite && state.mage && !state.mage.lastRiteUsed) {
      const maxHp = State.getTotalMaxHp();
      if (state.hero.hp < maxHp * 0.2) {
        state.mage.lastRiteUsed = true;
        const heal = Math.floor(maxHp * effects.lastRiteHeal);
        state.hero.hp = Math.min(maxHp, state.hero.hp + heal);
        // 清除负面状态
        isPoisoned = false;
        if (window.UI) UI.addLog(`>> [LAST RITE] Resurrected! +${heal} HP, debuffs cleared!`, "yellow");
      }
    }

    if (state.hero.hp <= 0) {
      onHeroDeath();
    }
  }

  // ─────────────────────────────────────────
  // 主动技能释放
  // ─────────────────────────────────────────

  function tryUseActiveSkill() {
    const state = State.get();
    const actives = Skills.getActiveSkills();
    const effects = Skills.getEffects();

    // focus：HP <= 80% 时 CD 速度 +15%（由外部 tick 处理 skillCooldowns，这里不重复）

    for (const skill of actives) {
      const cd = skillCooldowns[skill.id] || 0;
      if (cd > 0) continue;
      const e = skill.effect;

      // Ball Lightning：requireFullCharge（未满不触发）
      if (e.requireFullCharge && !isFullCharge()) continue;

      // Ice Barrier：防止重复激活
      if (skill.id === "ice_barrier" && iceBarrierHp > 0) continue;

      // MP 检查（Spell Echo 免费）
      let actualMpCost = e.mpCost || 0;
      if (state.mage && effects.spellEcho) {
        state.mage.spellEchoCount = (state.mage.spellEchoCount || 0) + 1;
        if (state.mage.spellEchoCount >= 3) {
          actualMpCost = 0;
          state.mage.spellEchoCount = 0;
          if (window.UI) UI.addLog(">> [ECHO] Spell Echo: free cast!", "cyan");
        }
      }
      if (actualMpCost > state.hero.mp) continue;

      // 消耗 MP
      state.hero.mp -= actualMpCost;

      // 重置 CD（fire_mastery：火系 CD -20%）
      let cdTime = e.cd || 5000;
      if (effects.fireCdReduction > 0 && (skill.spec === "pyro")) {
        cdTime = Math.floor(cdTime * (1 - effects.fireCdReduction));
      }
      // Time Warp 效果
      if (state.mage && state.mage.timeWarpActive) {
        cdTime = Math.floor(cdTime / (effects.timeWarpCdMult || 3));
      }
      skillCooldowns[skill.id] = cdTime;

      // 执行技能效果
      if (skill.id === "blink") {
        // Blink：免疫下一次伤害 + 重置随机技能 CD
        state.mage.blinkImmune = true;
        state.mage.blinkImmuneTimer = e.blinkDuration || 2000;
        // 重置 1 个随机 CD（非 blink 自身）
        const resetCandidates = Object.keys(skillCooldowns).filter(id => id !== "blink" && skillCooldowns[id] > 0);
        if (resetCandidates.length > 0) {
          const pick = resetCandidates[Math.floor(Math.random() * resetCandidates.length)];
          skillCooldowns[pick] = 0;
          if (window.UI) UI.addLog(`>> [BLINK] Immune + reset ${pick} CD!`, "cyan");
        } else {
          if (window.UI) UI.addLog(">> [BLINK] Teleport! Next hit nullified.", "cyan");
        }
      } else if (skill.id === "counterspell") {
        state.mage.counterspellActive  = true;
        state.mage.counterspellTimer   = e.counterspellDuration || 3000;
        state.mage.counterspellReflect = e.counterspellReflect || 0.5;
        state.mage.counterspellHits    = 0;
        if (window.UI) UI.addLog(">> [COUNTER] Counterspell active for 3s!", "cyan");
      } else if (skill.id === "time_warp") {
        state.mage.timeWarpActive = true;
        state.mage.timeWarpTimer  = e.timeWarpDuration || 8000;
        if (window.UI) UI.addLog(">> [WARP] Time Warp! CD speeds x3 for 8s", "yellow");
      } else if (skill.id === "heat_shield") {
        heatShieldActive = true;
        heatShieldTimer  = e.heatShieldDuration || 5000;
        if (window.UI) UI.addLog(">> [HEAT] Heat Shield active! Reflect incoming hits!", "red");
      } else if (skill.id === "lightning_rod") {
        lightningRodActive = true;
        lightningRodTimer  = e.lightningRodDuration || 4000;
        lightningRodHits   = 0;
        if (window.UI) UI.addLog(">> [STORM] Lightning Rod active!", "yellow");
      } else if (skill.id === "ice_barrier") {
        const atk = State.getTotalAtk();
        iceBarrierHp = Math.floor(atk * 2.0);
        if (window.UI) UI.addLog(`>> [CRYO] Ice Barrier: ${iceBarrierHp} shield!`, "cyan");
      } else if (e.dmgMult) {
        // 伤害技能（普通 + frost_bolt / ignite / inferno / chain_lightning / ball_lightning 等）
        if (e.hits && e.hits > 1) {
          // 多段（blizzard）
          for (let i = 0; i < e.hits; i++) {
            if (state.currentMonster && state.currentMonster.currentHp > 0) {
              heroAttack({ name: skill.name, dmgMult: e.dmgMult, chillAdd: e.chillAdd,
                burnAdd: e.burnAdd, consumeCharge: e.consumeCharge, chargeDmgPerStack: e.chargeDmgPerStack,
                defBypass: e.defBypass, explosionThreshold: e.explosionThreshold,
                manaDrainReturn: e.manaDrainReturn });
            }
          }
        } else {
          heroAttack({
            name: skill.name, dmgMult: e.dmgMult, chillAdd: e.chillAdd,
            burnAdd: e.burnAdd, consumeCharge: e.consumeCharge, chargeDmgPerStack: e.chargeDmgPerStack,
            defBypass: e.defBypass, explosionThreshold: e.explosionThreshold,
            requireFullCharge: e.requireFullCharge, manaDrainReturn: e.manaDrainReturn,
            id: skill.id,
          });
        }
      } else if (e.hits) {
        // 纯多段攻击（Rapid Shot）
        for (let i = 0; i < e.hits; i++) {
          if (state.currentMonster && state.currentMonster.currentHp > 0) {
            heroAttack({ name: skill.name, dmgMult: 1 });
          }
        }
      } else if (e.slowAmt) {
        // 减速（如旧 frost_nova 兼容）
        monsterSlowed = true;
        slowTimer = e.slowDuration || 3000;
        UI.addLog(`>> Frost Nova! ${state.currentMonster.name} slowed!`, "cyan");
      }

      break; // 每 tick 只触发一个主动技能
    }
  }

  // ─────────────────────────────────────────
  // 死亡与胜利
  // ─────────────────────────────────────────

  function onMonsterDeath() {
    const state = State.get();
    const monster = state.currentMonster;
    state.stats.totalKills++;
    state.killStreak = (state.killStreak || 0) + 1;

    // Pyro：击杀时触发 Ignite Explosion
    if (state.mage && state.mage.spec === "pyro" && state.mage.burnStack > 0) {
      const stacks = state.mage.burnStack;
      state.mage.burnStack = 0;
      // 击杀爆炸：直接计算伤害（怪物已死亡，不需要再伤害，但可以给 heal 效果）
      const effects = Skills.getEffects();
      if (effects.explosionHpRegen > 0) {
        const heal = Math.floor(State.getTotalMaxHp() * effects.explosionHpRegen);
        state.hero.hp = Math.min(State.getTotalMaxHp(), state.hero.hp + heal);
        if (window.UI) UI.addLog(`>> [PYRO] Kill Explosion (${stacks} stacks) → Phoenix Flame +${heal} HP!`, "red");
      }
    }

    // Cryo：重置寒冷状态
    if (state.mage && state.mage.spec === "cryo") {
      // permafrost 标记已在 triggerFreeze 里设置
    }

    // 结算 EXP
    State.addExp(monster.expReward);

    // 结算 Gold
    const goldGain = Utils.rand(monster.goldMin, monster.goldMax);
    state.hero.gold += goldGain;
    state.stats.totalGoldEarned += goldGain;
    UI.addLog(`>> ${monster.name} defeated! +${monster.expReward} exp, +${goldGain}g`, "yellow");
    if (window.UI) UI.markSidePanelDirty();

    // 战士被动：击杀回血
    const effects = Skills.getEffects();
    if (effects.regenOnKill > 0) {
      const regen = Math.floor(State.getTotalMaxHp() * effects.regenOnKill);
      state.hero.hp = Math.min(State.getTotalMaxHp(), state.hero.hp + regen);
      UI.addLog(`>> Regeneration: +${regen} HP`, "green");
    }

    // 掉落加成
    const dropBonus = State.getTotalDropBonus();
    const goldBonus = State.getTotalGoldBonus();
    const expBonus  = State.getTotalExpBonus();

    const bonusedGold = Math.floor(goldGain * (1 + goldBonus / 100));
    const extraGold = bonusedGold - goldGain;
    if (extraGold > 0) {
      state.hero.gold += extraGold;
      state.stats.totalGoldEarned += extraGold;
    }
    if (expBonus > 0) {
      State.addExp(Math.floor(monster.expReward * expBonus / 100));
    }

    (monster.dropTable || []).forEach(drop => {
      const effectiveChance = Math.min(1, drop.chance * (1 + dropBonus / 100));
      if (!Utils.chance(effectiveChance)) return;
      const dropType = drop.type || "legacy";
if (dropType === "equipment") {
// withAffixes=true, rollStats=true, upgradeRarity=true
const item = Equipment.createItem(drop.itemId, true, true, true);
        if (item) {
          Equipment.addToInventory(item);
          const rarityColor = Equipment.getRarityColor(item.rarity);
          const affixStr = item.affixes && item.affixes.length > 0
            ? ` {${item.affixes.map(a => a.name).join(", ")}}`
            : "";
          UI.addLog(`>> [DROP] ${item.name}${affixStr} [${Equipment.getRarityLabel(item.rarity)}]`, rarityColor);
        }
      } else if (dropType === "material") {
        UI.addLog(`>> [MAT] ${drop.name}`, "gray");
} else {
// legacy 格式也带随机属性
const item = Equipment.createItem(drop.itemId, true, true, true);
if (item) {
Equipment.addToInventory(item);
const color = Equipment.getRarityColor(item.rarity);
UI.addLog(`>> [DROP] ${item.name} [${Equipment.getRarityLabel(item.rarity)}]`, color);
        }
      }
    });

    // Boss 专项处理
    if (monster.isBoss) {
      onBossDefeated();
    }

    // Ley Line：连续 3 杀激活
    if (effects.leyLine && state.killStreak >= 3) {
      state.mage.leyLineReady = true;
      state.killStreak = 0;
      if (window.UI) UI.addLog(">> [LEY] Ley Line activated! Next fight: full MP!", "cyan");
    }

    // 清空当前怪物
    state.currentMonster = null;
    isPoisoned   = false;
    monsterSlowed = false;
    heatShieldActive = false;
    lightningRodActive = false;

    // 自动战斗：延迟后自动生成下一只
    if (state.autoFight) {
      setTimeout(spawnAndFight, 600);
    }
  }

  function onHeroDeath() {
    const state = State.get();
    const effects = Skills.getEffects();
    const penalty = Math.max(1, Math.floor(state.hero.gold * 0.1 * effects.deathPenaltyMult));
    state.hero.gold = Math.max(0, state.hero.gold - penalty);
    state.hero.hp = Math.floor(State.getTotalMaxHp() * 0.3);
    state.currentMonster = null;
    isPoisoned   = false;
    monsterSlowed = false;
    heatShieldActive = false;
    lightningRodActive = false;
    state.killStreak = 0; // 死亡重置连胜

    UI.addLog(`>> You died! Lost ${penalty}g. (HP restored to 30%)`, "red");
    if (window.UI) UI.markSidePanelDirty();

    if (state.autoFight) {
      setTimeout(spawnAndFight, 2000);
    }
  }

  function onBossDefeated() {
    const state = State.get();
    const zone = Zones.getZone(state.currentZone);
    UI.addLog(`>> BOSS DEFEATED: ${state.currentMonster.name}!`, "yellow");
    Zones.onBossDefeated(state.currentZone);

    if (zone && zone.isFinal) {
      setTimeout(() => {
        UI.addLog(">> ===================================", "yellow");
        UI.addLog(">> YOU HAVE DEFEATED THE DARK LORD!", "yellow");
        UI.addLog(">> Prestige is now available!", "yellow");
        UI.addLog(">> ===================================", "yellow");
      }, 500);
    }
  }

  // ─────────────────────────────────────────
  // 主 tick（由 main.js 每 100ms 调用）
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // HP/MP 自然回复（战斗外）& Rest
  // ─────────────────────────────────────────

  /**
   * 处理非战斗状态下的 HP/MP 回复
   * @param {number} delta tick 时间（ms）
   * @param {boolean} resting 是否处于 Rest 加速模式
   */
  function tickRegen(delta, resting) {
    const state = State.get();
    const maxHp = State.getTotalMaxHp();
    const maxMp = State.getTotalMaxMp();
    if (state.hero.hp >= maxHp && state.hero.mp >= maxMp) return;

    const hpr = State.getTotalHpr();
    const mpr = State.getTotalMpr();
    // Rest 模式：3× 回复速率
    const mult = resting ? 3 : 1;
    // delta 单位 ms → 换算成秒
    const sec = delta / 1000;

    // 累计小数，整数部分才实际加到 HP/MP（正确处理 hpr < 1 的情况）
    if (state.hero.hp < maxHp) {
      hpRegenAcc += hpr * mult * sec;
      const whole = Math.floor(hpRegenAcc);
      if (whole > 0) {
        hpRegenAcc -= whole;
        state.hero.hp = Math.min(maxHp, state.hero.hp + whole);
      }
    } else {
      hpRegenAcc = 0; // 满血后重置，防止溢出累积
    }

    if (state.hero.mp < maxMp) {
      mpRegenAcc += mpr * mult * sec;
      const whole = Math.floor(mpRegenAcc);
      if (whole > 0) {
        mpRegenAcc -= whole;
        state.hero.mp = Math.min(maxMp, state.hero.mp + whole);
      }
    } else {
      mpRegenAcc = 0;
    }

    if (window.UI) UI.markSidePanelDirty();
  }

  /**
   * 开始休息（手动 [REST]）
   * 战斗中或满血满蓝时无效
   */
  function startRest() {
    const state = State.get();
    if (state.currentMonster) {
      if (window.UI) UI.addLog(">> Can't rest during combat!", "red");
      return;
    }
    const maxHp = State.getTotalMaxHp();
    const maxMp = State.getTotalMaxMp();
    if (state.hero.hp >= maxHp && state.hero.mp >= maxMp) {
      if (window.UI) UI.addLog(">> Already at full HP and MP.", "gray");
      return;
    }
    isResting = true;
    restTimer = 0;
    hpRegenAcc = 0;
    mpRegenAcc = 0;
    if (window.UI) UI.addLog(">> Resting... (HP/MP recover 3x faster)", "green");
    if (window.UI) UI.markSidePanelDirty();
  }

  /**
   * 中断休息（进入战斗或手动停止时调用）
   */
  function stopRest() {
    if (!isResting) return;
    isResting = false;
    restTimer = 0;
    if (window.UI) UI.addLog(">> Rest interrupted.", "gray");
    if (window.UI) UI.markSidePanelDirty();
  }

  function tick(delta) {
    const state = State.get();

    // ── 非战斗时：自然回复 & Rest ─────────
    if (!state.currentMonster || state.currentMonster.currentHp <= 0) {
      if (isResting) {
        restTimer += delta;
        const maxHp = State.getTotalMaxHp();
        const maxMp = State.getTotalMaxMp();
        const fullRestore = state.hero.hp >= maxHp && state.hero.mp >= maxMp;
        if (restTimer >= REST_DURATION || fullRestore) {
          isResting = false;
          restTimer = 0;
          if (window.UI) UI.addLog(">> Rest complete. HP and MP restored.", "green");
          if (window.UI) UI.markSidePanelDirty();
        } else {
          tickRegen(delta, true);
        }
      } else {
        // 自然回复（慢速）
        tickRegen(delta, false);
      }
      return;
    }

    // 进入战斗时中断休息
    if (isResting) {
      isResting = false;
      restTimer = 0;
    }

    // 战斗中也持续自然回复（不加速）
    tickRegen(delta, false);

    if (state.hero.hp <= 0) return;

    const effects = Skills.getEffects();

    // 更新技能 CD（Time Warp 3x 速）
    const cdTickRate = (state.mage && state.mage.timeWarpActive)
      ? delta * (effects.timeWarpCdMult || 3)
      : delta;
    // focus：HP <= 80% 时 CD 速 +15%
    const focusCdBonus = (effects.focus && state.hero.hp <= State.getTotalMaxHp() * 0.8) ? 1.15 : 1;
    Object.keys(skillCooldowns).forEach(id => {
      skillCooldowns[id] = Math.max(0, skillCooldowns[id] - cdTickRate * focusCdBonus);
    });

    // ── 各种计时器 ──────────────────────────

    // 减速计时
    if (monsterSlowed) {
      slowTimer -= delta;
      if (slowTimer <= 0) monsterSlowed = false;
    }

    // Blink 免疫计时
    if (state.mage && state.mage.blinkImmune) {
      state.mage.blinkImmuneTimer -= delta;
      if (state.mage.blinkImmuneTimer <= 0) {
        state.mage.blinkImmune = false;
        state.mage.blinkImmuneTimer = 0;
      }
    }

    // Counterspell 计时
    if (state.mage && state.mage.counterspellActive) {
      state.mage.counterspellTimer -= delta;
      if (state.mage.counterspellTimer <= 0) {
        state.mage.counterspellActive = false;
      }
    }

    // Time Warp 计时
    if (state.mage && state.mage.timeWarpActive) {
      state.mage.timeWarpTimer -= delta;
      if (state.mage.timeWarpTimer <= 0) {
        state.mage.timeWarpActive = false;
        // 结束后 MP -50%
        state.hero.mp = Math.floor(state.hero.mp * 0.5);
        if (window.UI) UI.addLog(">> [WARP] Time Warp ended. MP -50%.", "gray");
      }
    }

    // Heat Shield 计时
    if (heatShieldActive) {
      heatShieldTimer -= delta;
      if (heatShieldTimer <= 0) {
        heatShieldActive = false;
        if (window.UI) UI.addLog(">> [HEAT] Heat Shield expired.", "gray");
      }
    }

    // Lightning Rod 计时
    if (lightningRodActive) {
      lightningRodTimer -= delta;
      if (lightningRodTimer <= 0 || lightningRodHits >= (effects.lightningRodMaxHits || 3)) {
        lightningRodActive = false;
      }
    }

    // ── Cryo 冰冻计时 ──
    if (state.mage && state.mage.frozen) {
      state.mage.freezeTimer -= delta;
      if (state.mage.freezeTimer <= 0) {
        state.mage.frozen = false;
        state.mage.chillStack = 0;
        if (window.UI) UI.addLog(">> [CRYO] Freeze ended.", "gray");
        // post-freeze slow
        if (effects.postFreezeSlowDuration > 0) {
          monsterSlowed = true;
          slowTimer = effects.postFreezeSlowDuration;
        }
        if (window.UI) UI.markSidePanelDirty();
      }
    }

    // ── Cryo: Chill HP regen（cryo_mastery）──
    if (state.mage && state.mage.spec === "cryo" && effects.chillHpRegen > 0 && state.mage.chillStack > 0) {
      const maxHp = State.getTotalMaxHp();
      const regenPerSec = maxHp * effects.chillHpRegen * state.mage.chillStack;
      const regenTick = regenPerSec * (delta / 1000);
      if (regenTick >= 1) {
        state.hero.hp = Math.min(maxHp, state.hero.hp + Math.floor(regenTick));
      }
    }

    // ── Pyro: Burn DOT tick ──
    if (state.mage && state.mage.spec === "pyro" && state.mage.burnStack > 0 && state.currentMonster) {
      state.mage.burnDotTimer += delta;
      if (state.mage.burnDotTimer >= 1000) {
        state.mage.burnDotTimer -= 1000;
        const atk = State.getTotalAtk();
        let burnDmg = Math.floor(atk * 0.08 * state.mage.burnStack); // 每层每秒 8% ATK
        // fire_mastery：burn 可暴击
        if (effects.burnCanCrit && Utils.chance(State.getTotalCrit())) {
          burnDmg = Math.floor(burnDmg * 1.5);
        }
        // cauterize：灼烧层 >= 5 时回血
        if (effects.cauterize && state.mage.burnStack >= 5) {
          const maxHp = State.getTotalMaxHp();
          const healPerStack = Math.floor(maxHp * 0.003 * state.mage.burnStack);
          state.hero.hp = Math.min(maxHp, state.hero.hp + healPerStack);
        }
        if (burnDmg > 0 && state.currentMonster.currentHp > 0) {
          state.currentMonster.currentHp -= burnDmg;
          state.stats.totalDmgDealt += burnDmg;
          if (window.UI) UI.addLog(`>> [PYRO] Burn DoT: ${burnDmg} fire dmg (${state.mage.burnStack} stacks)`, "red");
          if (state.currentMonster.currentHp <= 0) {
            onMonsterDeath();
            return;
          }
        }
      }
    }

    // 毒效果 tick（游侠）
    if (isPoisoned && state.currentMonster) {
      poisonTimer -= delta;
      const poisonDmg = Math.floor(State.getTotalAtk() * effects.poisonPct * (delta / 1000));
      if (poisonDmg > 0 && state.currentMonster.currentHp > 0) {
        state.currentMonster.currentHp -= poisonDmg;
        state.stats.totalDmgDealt += poisonDmg;
        if (state.currentMonster.currentHp <= 0) {
          onMonsterDeath();
          return;
        }
      }
      if (poisonTimer <= 0) isPoisoned = false;
    }

    // 英雄攻击计时
    heroTimer += delta;
    const atkInterval = State.getAtkInterval();
    if (heroTimer >= atkInterval) {
      heroTimer -= atkInterval;
      const actives = Skills.getActiveSkills();
      const hasActiveReady = actives.some(s => {
        const cd = (skillCooldowns[s.id] || 0) === 0;
        if (!cd) return false;
        const e = s.effect;
        if (e.requireFullCharge && !isFullCharge()) return false;
        if (s.id === "ice_barrier" && iceBarrierHp > 0) return false;
        // 跳过纯 utility（无 dmgMult 且非伤害类）
        if (!e.dmgMult && !e.hits && !e.blinkImmune && !e.counterspell && !e.timeWarp
            && !e.heatShieldDuration && !e.lightningRodDuration && !e.iceBarrier) return false;
        return true;
      });
      if (hasActiveReady) {
        tryUseActiveSkill();
      } else {
        heroAttack(null);
      }
    }

    // 英雄攻击后怪物可能已死亡
    if (!state.currentMonster || state.currentMonster.currentHp <= 0) return;

    // 怪物攻击计时（冰冻时不攻击）
    if (state.mage && state.mage.frozen) return;

    // 减速计算
    let monsterSpdMult = 1;
    if (monsterSlowed) {
      monsterSpdMult = 1 - (effects.slowAmt || effects.postFreezeSlowAmt || 0.5);
    }
    const monsterSpd = state.currentMonster.spd * monsterSpdMult;
    const monsterInterval = Math.max(300, Math.floor(1000 / monsterSpd));
    monsterTimer += delta;
    if (monsterTimer >= monsterInterval) {
      monsterTimer -= monsterInterval;
      monsterAttack();
    }
  }

  // ─────────────────────────────────────────
  // 手动攻击（点击 [ATTACK] 按钮）
  // ─────────────────────────────────────────

  function manualAttack() {
    const state = State.get();
    if (state.hero.hp <= 0) return;
    if (!state.currentMonster) {
      spawnAndFight();
      return;
    }
    heroAttack(null);
    heroTimer = 0;
  }

  /**
   * 停止当前战斗
   */
  function stopFight() {
    const state = State.get();
    state.currentMonster = null;
    state.autoFight = false;
    isPoisoned = false;
    monsterSlowed = false;
    heatShieldActive = false;
    lightningRodActive = false;
    iceBarrierHp = 0;
    heroTimer = 0;
    monsterTimer = 0;
    const btnAuto = document.getElementById("btn-auto");
    if (btnAuto) btnAuto.textContent = "[AUTO: OFF]";
    UI.addLog(">> Combat stopped.", "gray");
  }

  function toggleAutoFight() {
    const state = State.get();
    state.autoFight = !state.autoFight;
    UI.addLog(`>> Auto-fight: ${state.autoFight ? "ON" : "OFF"}`, state.autoFight ? "green" : "gray");
    const btnAuto = document.getElementById("btn-auto");
    if (btnAuto) btnAuto.textContent = `[AUTO: ${state.autoFight ? "ON " : "OFF"}]`;
    if (state.autoFight && !state.currentMonster && state.hero.hp > 0) {
      spawnAndFight();
    }
  }

  // ─────────────────────────────────────────
  // 离线收益计算（由 save.js 调用）
  // ─────────────────────────────────────────

  function calcOfflineGains(seconds) {
    if (seconds < 60) return;
    const state = State.get();
    const atk = State.getTotalAtk();
    const zone = state.currentZone;
    const pool = Monsters.getByZone(zone).filter(t => !t.isBoss);
    if (pool.length === 0) return;

    const avgHp   = pool.reduce((s, t) => s + t.baseHp, 0) / pool.length;
    const avgGold = pool.reduce((s, t) => s + (t.goldReward.min + t.goldReward.max) / 2, 0) / pool.length;
    const avgExp  = pool.reduce((s, t) => s + t.expReward, 0) / pool.length;

    const atksNeeded  = Math.max(1, Math.ceil(avgHp / Math.max(1, atk)));
    const fightTimeMs = atksNeeded * State.getAtkInterval();
    const kills       = Math.floor((seconds * 1000) / fightTimeMs);

    if (kills <= 0) return;

    const totalGold = Math.floor(kills * avgGold);
    const totalExp  = Math.floor(kills * avgExp);

    state.hero.gold += totalGold;
    state.stats.totalGoldEarned += totalGold;
    state.stats.totalKills += kills;
    State.addExp(totalExp);

    if (window.UI) {
      UI.addLog(`>> [OFFLINE] ${kills} kills | +${Utils.formatNum(totalGold)}g | +${Utils.formatNum(totalExp)} exp`, "gray");
      UI.markSidePanelDirty();
    }
  }

  return {
    startFight,
    spawnAndFight,
    challengeBoss,
    manualAttack,
    stopFight,
    toggleAutoFight,
    startRest,
    stopRest,
    tick,
    calcOfflineGains,
    get skillCooldowns() { return skillCooldowns; },
    get heroTimer() { return heroTimer; },
    set heroTimer(v) { heroTimer = v; },
    get isResting() { return isResting; },
  };
})();

window.Combat = Combat;
