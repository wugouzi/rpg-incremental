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

  // ── 战士 Guardian 专精状态 ──────────────────
  let guardianStunTimer = 0;     // Shield Bash 眩晕计时
  let guardianProvokeTimer = 0;  // Provoke 挑衅计时
  let guardianProvokeActive = false;
  let guardianUnbreakableTimer = 0;  // Unbreakable 不屈计时
  let guardianUnbreakableActive = false;
  let guardianCounterReady = false;  // 消耗格挡后，下次攻击有反击加成

  // ── 战士 Berserker 专精状态 ─────────────────
  let berserkTimer = 0;          // War Cry 狂暴计时
  let berserkActive = false;

  // ── 游侠 Shadowblade 专精状态 ───────────────
  let smokeScreenTimer = 0;      // Smoke Screen 烟雾弹计时
  let smokeScreenActive = false;
  let smokeScreenNextCrit = false; // 烟雾弹后下次攻击必暴
  let shadowCloneTimer = 0;      // Shadow Clone 影分身计时
  let shadowCloneActive = false;
  let assassinateNextGoldBonus = false; // Assassinate 金币加成标记

  // ── 游侠 Marksman 专精状态 ──────────────────
  // Ace Shot 连续暴击计数（由 ranger.aceConsecutiveCrits 维护）

  // ── Guardian 眩晕计时（Shield Bash）──────────
  let guardianStunActive = false;  // 怪物是否被眩晕

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

    // 重置战士专精 per-fight 状态
    guardianStunTimer = 0;
    guardianStunActive = false;
    guardianProvokeTimer = 0;
    guardianProvokeActive = false;
    guardianCounterReady = false;
    // unbreakable 跨战斗保持（死亡时才重置）
    berserkTimer = 0;
    berserkActive = false;

    // 重置游侠 Shadowblade per-fight 状态
    smokeScreenTimer = 0;
    smokeScreenActive = false;
    smokeScreenNextCrit = false;
    shadowCloneTimer = 0;
    shadowCloneActive = false;
    assassinateNextGoldBonus = false;

    // 重置法师 per-fight 状态
    if (state.mage) {
      // Pyro: burn 层数跨战斗保留（火焰余烬延续到下一个怪物）
      // 只重置 DoT 计时器，让 DoT 对新怪重新开始计时
      state.mage.burnDotTimer = 0;
      // 注意：burnStack 不清零
      if (state.mage.burnStack > 0 && state.mage.spec === "pyro" && window.UI) {
        UI.addLog(`>> [PYRO] Embers carry over: ${state.mage.burnStack} Burn stacks!`, "red");
      }
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
  if (monster.isElite && monster.mutations && monster.mutations.length > 0) {
    const mutNames = monster.mutations.map(m => `${m.icon}${m.name}`).join(" ");
    UI.addLog(`>> ⚠ ELITE: ${monster.name} [${mutNames}]`, "yellow", "combat");
  } else {
    UI.addLog(`>> [${Zones.getZone(state.currentZone).name}] ${monster.name} appears!`, "white", "combat");
  }
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

    // DEF bypass（Ball Lightning + Marksman globalDefBypass）
    const globalBypass = effects.globalDefBypass || 0;
    const skillBypass = skillEffect && skillEffect.defBypass ? skillEffect.defBypass : 0;
    const totalDefBypass = Math.min(1, globalBypass + skillBypass);
    const effectiveDef = Math.floor((monster.def || 0) * (1 - totalDefBypass));

    // ── 战士 Berserker：怒气 ATK 加成 ──
    const isWarrior = state.hero.class === "warrior";
    let rageAtkBonus = 1;
    if (isWarrior && state.warrior && effects.rageOnKill > 0) {
      const rageStacks = state.warrior.rageStacks || 0;
      rageAtkBonus = 1 + rageStacks * effects.rageAtkPerStack;
      // death_wish：HP < 30% 时额外 ATK
      if (effects.deathWish && state.hero.hp < State.getTotalMaxHp() * effects.deathWishHpThresh) {
        rageAtkBonus += effects.deathWishAtkBonus;
      }
    }

    // ── 战士 Guardian：Provoke ATK 加成 ──
    let provokeAtkBonus = 1;
    if (isWarrior && guardianProvokeActive) {
      const tpl = Skills.getTemplate ? Skills.getTemplate("provoke") : null;
      const provokeBonus = tpl ? (tpl.effect.provokeAtkBonus || 0.4) : 0.4;
      provokeAtkBonus = 1 + provokeBonus;
    }

    // ── 战士 Guardian：反击加成（Counter Stance）──
    let counterDmgMult = 1;
    if (guardianCounterReady && effects.counterAfterBlock && effects.counterDmgBonus > 0) {
      counterDmgMult = 1 + effects.counterDmgBonus;
    }

    // ── 游侠 Shadowblade：Shadow Mark 叠加伤害 ──
    const isRanger = state.hero.class === "ranger";
    let shadowMarkMult = 1;
    if (isRanger && state.ranger && effects.shadowMarkOnDodge) {
      const markStacks = state.ranger.shadowMarkStacks || 0;
      shadowMarkMult = 1 + markStacks * effects.shadowMarkDmgBonus;
    }

    // ── 游侠 Marksman：Ace Shot 王牌射击（消耗连暴计数）──
    let aceShotActive = false;
    if (isRanger && state.ranger && effects.aceShot) {
      if (state.ranger.aceConsecutiveCrits >= effects.aceShotCount) {
        aceShotActive = true;
      }
    }

    // ── 战士 Berserker：War Cry 狂暴 ATK 加成 ──
    let berserkAtkMult = 1;
    if (isWarrior && berserkActive && effects.berserkAtkBonus) {
      berserkAtkMult = 1 + effects.berserkAtkBonus;
    }
    // ── 战士 Berserker：Death Wish - Reckless Strike 额外加成 ──
    // （在 tryUseActiveSkill 中处理，calcHeroDmg 里已处理普通 deathWish ATK）

    let rawDmg = Math.max(1, atk * dmgMult * frozenAtkMult * rageAtkBonus * provokeAtkBonus * counterDmgMult * shadowMarkMult * berserkAtkMult - effectiveDef);

    // Ace Shot 强制覆盖伤害
    if (aceShotActive) {
      rawDmg = Math.max(rawDmg, atk * effects.aceShotDmg);
    }

    // magic skill damage mult（arcane_mastery）
    if (skillEffect && effects.magicDmgMult > 1) {
      rawDmg *= effects.magicDmgMult;
    }

    // 装备：主动技能伤害加成（activeDmgBonus，百分比整数）
    if (skillEffect) {
      const eqBonus = State.getEquipBonus();
      if (eqBonus.activeDmgBonus > 0) {
        rawDmg *= (1 + eqBonus.activeDmgBonus / 100);
      }
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

    // 暴击检查（含冰冻暴击加成 + Spell Surge + 专精加成）
    let critRate = State.getTotalCrit();
    if (isFrozen && effects.freezeCritBonus > 0) critRate = Math.min(0.95, critRate + effects.freezeCritBonus);

    // death_wish：低血量暴击率加成
    if (effects.deathWish && state.hero.hp < State.getTotalMaxHp() * effects.deathWishHpThresh) {
      critRate = Math.min(0.95, critRate + effects.deathWishCritBonus);
    }
    // blood_frenzy：满怒气暴击率加成
    const isWarriorBerserker = isWarrior && state.warrior && state.warrior.spec === "berserker";
    if (isWarriorBerserker && effects.maxRageCritBonus > 0) {
      const rageStacks = state.warrior.rageStacks || 0;
      if (rageStacks >= effects.rageMaxStacks) {
        critRate = Math.min(0.95, critRate + effects.maxRageCritBonus);
      }
    }

    // 必暴击：Snipe/SmokeScreen/Ace Shot
    const forceCrit = (skillEffect && skillEffect.guaranteedCrit)
      || smokeScreenNextCrit
      || aceShotActive;

    const isCrit = forceCrit || Utils.chance(critRate);
    // Spell Surge：MP > 80% 时额外暴击判定
    const maxMp = State.getTotalMaxMp();
    const spellSurgeCrit = (skillEffect && effects.spellSurge && state.hero.mp > maxMp * 0.8)
      ? Utils.chance(critRate)
      : false;
    const effectiveCrit = isCrit || spellSurgeCrit;

    if (effectiveCrit) {
      // Smoke Screen 额外暴击加成（+100% dmg）
      let critMultFinal = effects.critMult;
      if (smokeScreenNextCrit && effects.smokeScreenCritBonus > 0) {
        critMultFinal += effects.smokeScreenCritBonus;
      }
      rawDmg = Math.floor(rawDmg * critMultFinal);
      // 消耗 smokeScreenNextCrit
      if (smokeScreenNextCrit) smokeScreenNextCrit = false;
      // Ace Shot 消耗连暴计数
      if (aceShotActive && isRanger && state.ranger) {
        state.ranger.aceConsecutiveCrits = 0;
        if (window.UI) UI.addLog(`>> [MARKSMAN] ACE SHOT! 500% ATK!`, "yellow");
      }
      // Shadow Mark：暴击后消耗影标记
      if (isRanger && state.ranger && effects.shadowMarkOnDodge) {
        const marksBefore = state.ranger.shadowMarkStacks || 0;
        if (marksBefore > 0) state.ranger.shadowMarkStacks = 0;
      }
      // Marksman：暴击时额外毒伤（critPoisonBonus）
      if (isRanger && effects.critPoisonBonus > 0 && state.currentMonster) {
        const poisonBonusDmg = Math.floor(State.getTotalAtk() * effects.critPoisonBonus);
        state.currentMonster.currentHp -= poisonBonusDmg;
        state.stats.totalDmgDealt += poisonBonusDmg;
        if (window.UI) UI.addLog(`>> [MARKSMAN] Piercing poison: +${poisonBonusDmg} dmg`, "cyan");
      }
      // critRefreshPoison（Shadowblade Mastery）
      if (isRanger && effects.critRefreshPoison && isPoisoned) {
        poisonTimer = effects.poisonDuration || 3000;
      }
      // Marksman 连续暴击计数（血条追踪）
      if (isRanger && state.ranger && effects.aceShot && !aceShotActive) {
        state.ranger.aceConsecutiveCrits = (state.ranger.aceConsecutiveCrits || 0) + 1;
      }
    } else {
      // 未暴击：重置连续暴击计数
      if (isRanger && state.ranger && effects.aceShot) {
        state.ranger.aceConsecutiveCrits = 0;
      }
      // Shadow Mark 不消耗
    }

    // thunder_mastery: Ball Lightning crit 不消耗充能（已消耗，此处回补）
    if (isStorm && skillEffect && skillEffect.id === "ball_lightning" && effectiveCrit && effects.critNoConsumeCharge) {
      state.mage.charge = Math.min(getChargeCap(), state.mage.charge + chargesConsumed);
    }

    // 每日任务：伤害统计
    if (window.DailyQuest && Math.floor(rawDmg) > 0) {
      DailyQuest.onDamage(Math.floor(rawDmg));
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

    // 闪避检查（含 Smoke Screen 完全闪避）
    if (smokeScreenActive || Utils.chance(effects.dodgeAdd || 0)) {
      // Shadow Mark：闪避后积累标记
      if (!smokeScreenActive && effects.shadowMarkOnDodge) {
        const state2 = State.get();
        if (!state2.ranger) state2.ranger = {};
        const maxMark = effects.shadowMarkMaxStacks || 3;
        state2.ranger.shadowMarkStacks = Math.min(maxMark, (state2.ranger.shadowMarkStacks || 0) + 1);
        if (window.UI) UI.addLog(`>> [SHADOW] Mark +1 (${state2.ranger.shadowMarkStacks}/${maxMark})`, "cyan");
      }
      // Smoke Screen 结束后标记下次攻击必暴
      if (smokeScreenActive) smokeScreenNextCrit = true;
      return { damage: 0, mpDmg: 0, dodged: true, element: monster.element };
    }

    // Unbreakable（Guardian）：所有伤害上限 1
    if (guardianUnbreakableActive) {
      return { damage: 1, mpDmg: 0, dodged: false, element: monster.element };
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

    // ── Guardian：受击时生成格挡层（Iron Fortress blockChance）──
    const isWarriorGuardian = state.hero.class === "warrior" && state.warrior && state.warrior.spec === "guardian";
    if (isWarriorGuardian && effects.blockChance > 0) {
      const maxBlocks = (effects.blockMaxStacks || 3) + (effects.blockMaxBonus || 0);
      if (state.warrior.blockStacks < maxBlocks && Utils.chance(effects.blockChance)) {
        state.warrior.blockStacks = Math.min(maxBlocks, state.warrior.blockStacks + 1);
        if (window.UI) UI.addLog(`>> [GUARD] Block stack! (${state.warrior.blockStacks}/${maxBlocks})`, "cyan");
        if (window.UI) UI.markSidePanelDirty();
      }
    }

    // ── Guardian：格挡减伤 ──
    if (isWarriorGuardian && effects.blockDmgReduce > 0 && state.warrior.blockStacks > 0) {
      // 消耗1层格挡
      const blockReduction = effects.blockDmgReduce * state.warrior.blockStacks;
      rawDmg = Math.max(1, Math.floor(rawDmg * (1 - blockReduction)));
      state.warrior.blockStacks--;
      if (window.UI) UI.addLog(`>> [GUARD] Block! -${Math.round(blockReduction*100)}% dmg (${state.warrior.blockStacks} left)`, "cyan");
      // Counter Stance：消耗格挡后标记下次攻击加成
      if (effects.counterAfterBlock) guardianCounterReady = true;
    }

    // ── Guardian：Stalwart 固定减伤 ──
    if (isWarriorGuardian && effects.flatDmgReduce > 0) {
      rawDmg = Math.max(1, Math.floor(rawDmg * (1 - effects.flatDmgReduce)));
    }

    // ── Guardian：Provoke 额外受伤 ──
    if (isWarriorGuardian && guardianProvokeActive) {
      rawDmg = Math.floor(rawDmg * 1.25); // +25% 受伤
    }

    // ── Berserker：War Cry DEF 惩罚（已在 getTotalDef 中处理，不用重复）──

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

    // 影分身：复制伤害
    const isRangerForClone = state.hero.class === "ranger";
    if (isRangerForClone && shadowCloneActive && state.currentMonster && state.currentMonster.currentHp > 0) {
      const cloneRatio = Skills.getEffects().shadowCloneDmgRatio || 0.6;
      const cloneDmg = Math.floor(damage * cloneRatio);
      if (cloneDmg > 0) {
        state.currentMonster.currentHp -= cloneDmg;
        state.stats.totalDmgDealt += cloneDmg;
        if (window.UI) UI.addLog(`>> [SHADOW] Clone echoes: +${cloneDmg} dmg!`, "cyan");
        if (state.currentMonster.currentHp <= 0) {
          onMonsterDeath();
          return;
        }
      }
    }

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

    // ── Guardian：Unbreakable 触发（HP < 阈值时激活）──
    const isWarriorGuardian = state.hero.class === "warrior" && state.warrior && state.warrior.spec === "guardian";
    if (isWarriorGuardian && effects.unbreakable && !guardianUnbreakableActive) {
      const thresh = effects.unbreakableHpThresh || 0.2;
      if (state.hero.hp > 0 && state.hero.hp < State.getTotalMaxHp() * thresh) {
        guardianUnbreakableActive = true;
        guardianUnbreakableTimer = effects.unbreakableDuration || 5000;
        if (window.UI) UI.addLog(`>> [GUARD] UNBREAKABLE! Immune for ${(guardianUnbreakableTimer/1000).toFixed(0)}s!`, "yellow");
        if (window.UI) UI.markSidePanelDirty();
      }
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
      } else if (skill.id === "shield_bash") {
        // ── Guardian：Shield Bash 眩晕 + 伤害 ──
        heroAttack({ name: skill.name, dmgMult: e.dmgMult || 1.2 });
        if (state.currentMonster && state.currentMonster.currentHp > 0) {
          guardianStunActive = true;
          guardianStunTimer = e.stunDuration || 2000;
          if (window.UI) UI.addLog(`>> [GUARD] Shield Bash! ${state.currentMonster.name} stunned for ${(guardianStunTimer/1000).toFixed(1)}s!`, "cyan");
        }
      } else if (skill.id === "provoke") {
        // ── Guardian：Provoke 挑衅激活 ──
        guardianProvokeActive = true;
        guardianProvokeTimer = e.provokeDuration || 5000;
        if (window.UI) UI.addLog(`>> [GUARD] Provoke! ATK+40% but take +25% dmg for ${(guardianProvokeTimer/1000).toFixed(0)}s!`, "cyan");
      } else if (skill.id === "war_cry") {
        // ── Berserker：War Cry 激活狂暴 ──
        berserkActive = true;
        berserkTimer = e.berserkDuration || 8000;
        if (state.warrior) { state.warrior.berserkActive = true; state.warrior.berserkTimer = berserkTimer; }
        if (window.UI) UI.addLog(`>> [BERSERK] WAR CRY! ATK+50% SPD+0.5 DEF-30% for ${(berserkTimer/1000).toFixed(0)}s!`, "yellow");
      } else if (skill.id === "reckless_strike") {
        // ── Berserker：鲁莽打击：高伤 + 自伤 ──
        const recklessMult = e.dmgMult || 2.5;
        // Death Wish 加成
        const dwBonus = (effects.deathWish && state.hero.hp < State.getTotalMaxHp() * (effects.deathWishHpThresh || 0.3))
          ? (effects.deathWishRecklessBonus || 0.8) : 0;
        heroAttack({ name: skill.name, dmgMult: recklessMult * (1 + dwBonus) });
        // 自伤
        const selfDmgPct = e.selfDmgPct || 0.15;
        const selfDmg = Math.floor(State.getTotalMaxHp() * selfDmgPct);
        if (selfDmg > 0) {
          state.hero.hp = Math.max(1, state.hero.hp - selfDmg); // 不能死亡
          // Berserker Mastery：自伤回血
          if (effects.recklessHeal > 0) {
            const { damage: dealtDmg } = calcHeroDmg({ name: skill.name, dmgMult: 0 }); // 仅估算已发出，直接用 selfDmg
            const heal = Math.floor(selfDmg * effects.recklessHeal);
            state.hero.hp = Math.min(State.getTotalMaxHp(), state.hero.hp + heal);
            if (window.UI) UI.addLog(`>> [BERSERK] Reckless self-dmg: -${selfDmg} HP → Mastery heals +${heal}`, "yellow");
          } else {
            if (window.UI) UI.addLog(`>> [BERSERK] Reckless self-dmg: -${selfDmg} HP!`, "red");
          }
        }
      } else if (skill.id === "execute") {
        // ── Berserker：Execute 处决 ──
        const monster = state.currentMonster;
        if (monster) {
          const isLowHp = monster.currentHp / monster.maxHp < (e.executeThresh || 0.25);
          const execMult = isLowHp ? (e.executeDmgMult || 4.0) : (e.normalDmgMult || 1.8);
          heroAttack({ name: skill.name, dmgMult: execMult, guaranteedCrit: isLowHp });
          if (isLowHp && window.UI) UI.addLog(`>> [BERSERK] EXECUTE! Low HP target!`, "yellow");
        }
      } else if (skill.id === "backstab") {
        // ── Shadowblade：背刺（中毒时加成）──
        const poisoned = isPoisoned;
        const bsMult = poisoned ? (e.backstabPoisonDmg || 3.5) : (e.dmgMult || 2.0);
        const alwaysCrit = poisoned && effects.backstabAlwaysCrit;
        heroAttack({ name: skill.name, dmgMult: bsMult, guaranteedCrit: alwaysCrit });
        if (poisoned && window.UI) UI.addLog(`>> [SHADOW] Backstab vs poisoned target! ${bsMult*100}% ATK!`, "cyan");
      } else if (skill.id === "smoke_screen") {
        // ── Shadowblade：烟雾弹（闪避 + 下次必暴）──
        smokeScreenActive = true;
        smokeScreenTimer = e.smokeScreenDuration || 3000;
        smokeScreenNextCrit = false; // 重置，让闪避时再设置
        if (window.UI) UI.addLog(`>> [SHADOW] Smoke Screen! Dodge all attacks for ${(smokeScreenTimer/1000).toFixed(0)}s!`, "cyan");
      } else if (skill.id === "shadow_clone") {
        // ── Shadowblade：影分身激活 ──
        shadowCloneActive = true;
        shadowCloneTimer = e.shadowCloneDuration || 6000;
        if (state.ranger) { state.ranger.shadowCloneActive = true; state.ranger.shadowCloneTimer = shadowCloneTimer; }
        if (window.UI) UI.addLog(`>> [SHADOW] Shadow Clone active for ${(shadowCloneTimer/1000).toFixed(0)}s! (60% dmg copy)`, "cyan");
      } else if (skill.id === "assassinate") {
        // ── Shadowblade：暗杀（无视防御 + 600% ATK + 最大毒层）──
        heroAttack({ name: skill.name, dmgMult: e.dmgMult || 6.0, defBypass: e.defBypass || 1.0, guaranteedCrit: true });
        // 施加最大毒层
        if (e.applyMaxPoison) {
          isPoisoned = true;
          poisonTimer = effects.poisonDuration || 3000;
          if (window.UI) UI.addLog(`>> [SHADOW] Assassinate! Max poison applied!`, "cyan");
        }
        // 记录金币加成
        if (e.assassinateGoldBonus > 0) assassinateNextGoldBonus = true;
      } else if (skill.id === "kill_shot") {
        // ── Marksman：终结一击（秒杀或高伤）──
        const monster = state.currentMonster;
        if (monster) {
          const isLowHp = monster.currentHp / monster.maxHp < (e.killShotThresh || 0.3);
          const ksMult = isLowHp ? (e.killShotDmg || 9.99) : (e.killShotNormalDmg || 2.2);
          heroAttack({ name: skill.name, dmgMult: ksMult, guaranteedCrit: isLowHp });
          if (isLowHp && window.UI) UI.addLog(`>> [MARKSMAN] KILL SHOT! Instant kill!`, "yellow");
        }
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
    const effects = Skills.getEffects();
    state.stats.totalKills++;
    state.killStreak = (state.killStreak || 0) + 1;

    // 更新历史最高连胜
    if (state.killStreak > (state.stats.maxKillStreak || 0)) {
      state.stats.maxKillStreak = state.killStreak;
    }

    // 精英怪击杀统计
    if (monster.isElite) {
      state.stats.eliteKills = (state.stats.eliteKills || 0) + 1;
    }

    // 每日任务：击杀计数
    if (window.DailyQuest) DailyQuest.onKill(monster.isElite || false);

    // ── Berserker：击杀时累积怒气 ──
    if (state.hero.class === "warrior" && state.warrior && effects.rageOnKill > 0) {
      const maxRage = effects.rageMaxStacks || 10;
      const prevRage = state.warrior.rageStacks || 0;
      state.warrior.rageStacks = Math.min(maxRage, prevRage + (effects.rageOnKill || 1));
      if (window.UI && state.warrior.rageStacks !== prevRage) {
        UI.addLog(`>> [BERSERK] Rage! ${state.warrior.rageStacks}/${maxRage} stacks (+${Math.round((effects.rageAtkPerStack || 0) * state.warrior.rageStacks * 100)}% ATK)`, "yellow");
      }
      // Guardian 反击标记重置（每次击杀后重置，等待下次格挡）
      if (state.warrior.spec === "guardian") guardianCounterReady = false;
    }

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
    // 每日任务：金币统计
    if (window.DailyQuest) DailyQuest.onGoldEarned(goldGain);
    UI.addLog(`>> ${monster.name} defeated! +${monster.expReward} exp, +${goldGain}g`, "yellow");
    if (window.UI) UI.markSidePanelDirty();

    // 战士被动：击杀回血
    if (effects.regenOnKill > 0) {
      const regen = Math.floor(State.getTotalMaxHp() * effects.regenOnKill);
      state.hero.hp = Math.min(State.getTotalMaxHp(), state.hero.hp + regen);
      UI.addLog(`>> Regeneration: +${regen} HP`, "green");
    }

    // 装备：击杀回复 MP（mpOnKill）
    const eqBonus = State.getEquipBonus();
    if (eqBonus.mpOnKill > 0) {
      const maxMp = State.getTotalMaxMp();
      state.hero.mp = Math.min(maxMp, state.hero.mp + eqBonus.mpOnKill);
    }

    // 掉落加成（含黑市 buff 加成）
    const buffBonus = State.getBuffBonus();
    const dropBonus = State.getTotalDropBonus() + (buffBonus.dropPct || 0);
    const goldBonus = State.getTotalGoldBonus() + (buffBonus.goldPct || 0);
    const expBonus  = State.getTotalExpBonus()  + (buffBonus.expPct  || 0);

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
        // 追踪材料数量
        if (!state.materials) state.materials = {};
        state.materials[drop.itemId] = (state.materials[drop.itemId] || 0) + 1;
        UI.addLog(`>> [MAT] ${drop.name} x1 (total: ${state.materials[drop.itemId]})`, "gray");
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

    // 成就检查（每次击杀后）
    if (window.Achievements) Achievements.check();

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
    state.stats.deaths = (state.stats.deaths || 0) + 1;
    state.killStreak = 0; // 死亡重置连胜
    // Pyro：死亡时余烬熄灭
    if (state.mage && state.mage.spec === "pyro") {
      state.mage.burnStack = 0;
    }

    // ── Berserker：死亡时怒气处理 ──
    if (state.hero.class === "warrior" && state.warrior) {
      if (effects.ragePersistOnDeath) {
        // Berserker Mastery：死亡只扣 rageDeathLoss 层
        const loss = effects.rageDeathLoss || 3;
        state.warrior.rageStacks = Math.max(0, (state.warrior.rageStacks || 0) - loss);
        if (window.UI) UI.addLog(`>> [BERSERK] Rage: -${loss} stacks on death (${state.warrior.rageStacks} left)`, "yellow");
      } else {
        // 未习得 Mastery：死亡清零怒气
        state.warrior.rageStacks = 0;
      }
      // 重置 Guardian 状态
      guardianUnbreakableActive = false;
      guardianUnbreakableTimer = 0;
    }
    // ── Ranger Shadowblade 状态重置 ──
    if (state.hero.class === "ranger") {
      smokeScreenActive = false;
      shadowCloneActive = false;
      if (state.ranger) {
        state.ranger.shadowMarkStacks = 0;
        state.ranger.shadowCloneActive = false;
      }
    }

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

    // 每日任务：Boss 击杀
    if (window.DailyQuest) DailyQuest.onBossKill();

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
    let changed = false;
    if (state.hero.hp < maxHp) {
      hpRegenAcc += hpr * mult * sec;
      const whole = Math.floor(hpRegenAcc);
      if (whole > 0) {
        hpRegenAcc -= whole;
        state.hero.hp = Math.min(maxHp, state.hero.hp + whole);
        changed = true;
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
        changed = true;
      }
    } else {
      mpRegenAcc = 0;
    }

    // 只在数值实际变化时才标脏（避免每 tick 都重建侧面板导致 hover 频闪）
    if (changed && window.UI) UI.markSidePanelDirty();
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

    // 更新技能 CD（Time Warp 3x 速 + 装备CD减少）
    const eq = State.getEquipBonus();
    const cdMultiplier = (1 + (effects.timeWarpCdMult && state.mage && state.mage.timeWarpActive ? (effects.timeWarpCdMult - 1) : 0))
      * (1 + (eq.skillCdReduce || 0));
    const cdTickRate = delta * cdMultiplier;
    // focus：HP <= 80% 时 CD 速 +15%
    const focusCdBonus = (effects.focus && state.hero.hp <= State.getTotalMaxHp() * 0.8) ? 1.15 : 1;
    Object.keys(skillCooldowns).forEach(id => {
      skillCooldowns[id] = Math.max(0, skillCooldowns[id] - cdTickRate * focusCdBonus);
    });

    // ── 各种计时器 ──────────────────────────

    // ── Guardian：眩晕计时（Shield Bash）──
    if (guardianStunActive) {
      guardianStunTimer -= delta;
      if (guardianStunTimer <= 0) {
        guardianStunActive = false;
        if (window.UI) UI.addLog(">> [GUARD] Stun ended.", "gray");
      }
    }

    // ── Guardian：Provoke 计时 ──
    if (guardianProvokeActive) {
      guardianProvokeTimer -= delta;
      if (guardianProvokeTimer <= 0) {
        guardianProvokeActive = false;
        guardianProvokeTimer = 0;
        if (window.UI) UI.addLog(">> [GUARD] Provoke ended.", "gray");
        if (window.UI) UI.markSidePanelDirty();
      }
    }

    // ── Guardian：Unbreakable 计时 ──
    if (guardianUnbreakableActive) {
      guardianUnbreakableTimer -= delta;
      if (guardianUnbreakableTimer <= 0) {
        guardianUnbreakableActive = false;
        guardianUnbreakableTimer = 0;
        if (window.UI) UI.addLog(">> [GUARD] Unbreakable ended.", "gray");
        if (window.UI) UI.markSidePanelDirty();
      }
    }

    // ── Berserker：War Cry 狂暴计时 ──
    if (berserkActive) {
      berserkTimer -= delta;
      if (berserkTimer <= 0) {
        berserkActive = false;
        berserkTimer = 0;
        if (state.warrior) { state.warrior.berserkActive = false; state.warrior.berserkTimer = 0; }
        if (window.UI) UI.addLog(">> [BERSERK] Berserk ended. DEF restored.", "gray");
        if (window.UI) UI.markSidePanelDirty();
      }
    }

    // ── Shadowblade：Smoke Screen 计时 ──
    if (smokeScreenActive) {
      smokeScreenTimer -= delta;
      if (smokeScreenTimer <= 0) {
        smokeScreenActive = false;
        smokeScreenTimer = 0;
        // 结束时激活下次必暴（如果还没触发）
        if (!smokeScreenNextCrit) smokeScreenNextCrit = true;
        if (window.UI) UI.addLog(">> [SHADOW] Smoke Screen cleared! Next hit: guaranteed crit!", "cyan");
        if (window.UI) UI.markSidePanelDirty();
      }
    }

    // ── Shadowblade：影分身计时 ──
    if (shadowCloneActive) {
      shadowCloneTimer -= delta;
      if (shadowCloneTimer <= 0) {
        shadowCloneActive = false;
        shadowCloneTimer = 0;
        if (state.ranger) { state.ranger.shadowCloneActive = false; state.ranger.shadowCloneTimer = 0; }
        if (window.UI) UI.addLog(">> [SHADOW] Shadow Clone dispersed.", "gray");
        if (window.UI) UI.markSidePanelDirty();
      }
    }

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

    // 英雄攻击计时（War Cry 狂暴时加速）
    heroTimer += delta;
    let effectiveSpd = State.getTotalSpd();
    if (berserkActive && effects.berserkSpdBonus) {
      effectiveSpd += effects.berserkSpdBonus;
    }
    const atkInterval = Math.max(200, Math.floor(1000 / effectiveSpd));
    if (heroTimer >= atkInterval) {
      heroTimer -= atkInterval;
      const actives = Skills.getActiveSkills();
      const hasActiveReady = actives.some(s => {
        const cd = (skillCooldowns[s.id] || 0) === 0;
        if (!cd) return false;
        const e = s.effect;
        if (e.requireFullCharge && !isFullCharge()) return false;
        if (s.id === "ice_barrier" && iceBarrierHp > 0) return false;
        // 跳过纯 utility（无 dmgMult 且非伤害类，且非专精主动技能）
        const isSpecSkill = ["shield_bash","provoke","war_cry","reckless_strike","execute",
          "backstab","smoke_screen","shadow_clone","assassinate","kill_shot"].includes(s.id);
        if (!isSpecSkill && !e.dmgMult && !e.hits && !e.blinkImmune && !e.counterspell && !e.timeWarp
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

    // 怪物攻击计时（冰冻时不攻击 + Guardian 眩晕时不攻击）
    if (state.mage && state.mage.frozen) return;
    if (guardianStunActive) return; // Shield Bash 眩晕期间怪物不攻击

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

  /** 重置 HP/MP 回复小数累计器（供测试使用） */
  function resetRegenAccumulators() {
    hpRegenAcc = 0;
    mpRegenAcc = 0;
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
    resetRegenAccumulators,
    calcOfflineGains,
    get skillCooldowns() { return skillCooldowns; },
    get heroTimer() { return heroTimer; },
    set heroTimer(v) { heroTimer = v; },
    get isResting() { return isResting; },
    // Pyro UI 状态暴露
    get heatShieldActive() { return heatShieldActive; },
    get heatShieldTimer()  { return heatShieldTimer;  },
    // Cryo UI 状态暴露
    get iceBarrierHp() { return iceBarrierHp; },
    // Storm UI 状态暴露
    get lightningRodActive() { return lightningRodActive; },
    get lightningRodTimer()  { return lightningRodTimer;  },
    get lightningRodHits()   { return lightningRodHits;   },
    // Warrior UI 状态暴露
    get guardianProvokeActive()      { return guardianProvokeActive;      },
    get guardianProvokeTimer()       { return guardianProvokeTimer;       },
    get guardianUnbreakableActive()  { return guardianUnbreakableActive;  },
    get guardianUnbreakableTimer()   { return guardianUnbreakableTimer;   },
    get guardianStunActive()         { return guardianStunActive;         },
    get guardianStunTimer()          { return guardianStunTimer;          },
    get berserkActive()              { return berserkActive;              },
    get berserkTimer()               { return berserkTimer;               },
    // Ranger UI 状态暴露
    get smokeScreenActive()          { return smokeScreenActive;          },
    get smokeScreenTimer()           { return smokeScreenTimer;           },
    get shadowCloneActive()          { return shadowCloneActive;          },
    get shadowCloneTimer()           { return shadowCloneTimer;           },
    get isPoisoned()                 { return isPoisoned;                 },
  };
})();

window.Combat = Combat;
