// state.js — 游戏核心状态，所有模块的唯一数据来源

const State = (() => {
  // 默认初始状态工厂函数
  function createDefault() {
    return {
      // 角色基础
      hero: {
        name: "Hero",
        class: null,          // null | "warrior" | "mage" | "ranger"
        level: 1,
        exp: 0,
        expToNext: 100,

        // 裸装基础属性
        baseAtk: 8,
        baseDef: 3,
        baseMaxHp: 60,
        baseMaxMp: 30,
        baseSpd: 1.0,         // 攻击间隔系数
        baseCrit: 0.05,       // 暴击率 5%

        // 当前 HP/MP
        hp: 60,
        mp: 30,

        // 货币
        gold: 0,
        gems: 0,

        // 转生
        prestigeCount: 0,
        prestigeBonus: 1.0,   // 全局 ATK 乘数
      },

      // 装备槽（null 表示空）
      equipment: {
        weapon: null,
        helmet: null,
        chest: null,
        legs: null,
        ring: null,
        neck: null,
      },

      // 背包（最多 20 格）
      inventory: [],

      // 战斗状态
      currentZone: "plains",
      currentMonster: null,   // 当前怪物实例（含 currentHp）
      autoFight: false,

      // 已解锁区域
      unlockedZones: ["plains"],

      // 技能解锁状态 { skillId: true }
      unlockedSkills: {},

      // 职业选择完成标记
      classChosen: false,

      // 法师专精状态
      mage: {
        spec: null,           // null | "pyro" | "cryo" | "storm"（Lv.15 选择）
        specChosen: false,    // 是否已选择元素专精

        // ── Stormcaller ──
        charge: 0,            // 充能层数（0–6）

        // ── Pyromancer ──
        burnStack: 0,         // 当前怪物灼烧层数（0–10）
        burnDotTimer: 0,      // DOT 结算计时（ms，累积到 1000ms 造成一次伤害）

        // ── Cryomancer ──
        chillStack: 0,        // 当前怪物寒冷层数（0–5）
        frozen: false,        // 怪物是否被冰冻
        freezeTimer: 0,       // 冰冻剩余时间（ms）
        nextFightChillBonus: 0, // permafrost：下一场战斗初始寒冷层（0或2）

        // ── 通用 utility 状态 ──
        blinkImmune: false,       // Blink 免疫中
        blinkImmuneTimer: 0,      // 免疫剩余时间（ms）
        arcaneWardHp: 0,          // Arcane Ward 护盾剩余值
        counterspellActive: false, // Counterspell 是否激活
        counterspellTimer: 0,     // 反制剩余时间（ms）
        counterspellHits: 0,      // 已反制次数（上限3）
        spellEchoCount: 0,        // Spell Echo 技能计数（每3次免费施法）
        timeWarpActive: false,    // Time Warp 是否激活中
        timeWarpTimer: 0,         // Time Warp 剩余时间（ms）
        lastRiteUsed: false,      // Last Rite 本场是否已触发
        leyLineReady: false,      // Ley Line 激活（下场满蓝开始）
      },

      // 连胜计数（用于 Ley Line）
      killStreak: 0,

      // 统计
      stats: {
        totalKills: 0,
        totalDmgDealt: 0,
        totalGoldEarned: 0,
        bossesDefeated: 0,
        eliteKills: 0,          // 精英怪击杀数
        maxKillStreak: 0,       // 历史最高连胜
        deaths: 0,              // 死亡次数
      },

      // 材料收集（{ materialId: count }）
      materials: {},

      // 成就解锁状态（{ achievementId: { unlockedAt } }）
      achievements: {},

      // 属性训练次数（金币消耗系统）
      training: {
        atk: 0,   // 已训练次数
        def: 0,
        hp:  0,
        spd: 0,
      },

      // 区域 boss 击败记录 { zoneId: true }
      bossDefeated: {},

      // 存档时间戳（用于离线收益）
      lastSaveTime: Date.now(),
    };
  }

  // 当前状态（由 save.js 初始化或覆盖）
  let data = createDefault();

  // ─────────────────────────────────────────
  // 派生属性计算（不存 state，实时计算）
  // ─────────────────────────────────────────

  function getEquipBonus() {
    const bonus = {
      atk: 0, def: 0, hp: 0, mp: 0, spd: 0, crit: 0,
      hpr: 0, mpr: 0,          // HP/MP 回复速率（点/秒）
      // 元素抗性（百分比，0~100）
      fireRes: 0, iceRes: 0, lightningRes: 0, poisonRes: 0, physRes: 0,
      // 特殊加成（百分比整数）
      dropBonus: 0, goldBonus: 0, expBonus: 0,
      // 技能强化（新增）
      skillCdReduce: 0,      // 技能CD减少总和（0~1 小数，如 0.20 = -20%）
      activeDmgBonus: 0,     // 主动技能伤害加成（百分比整数）
      passiveStatMult: 0,    // 被动效果倍率加成（小数）
      mpOnKill: 0,           // 击杀回复 MP
    };
    Object.values(data.equipment).forEach(item => {
      if (!item) return;
      // 使用 getItemTotalStats 合并词缀
      const s = window.Equipment
        ? Equipment.getItemTotalStats(item)
        : (item.stats || {});
      const mult = 1 + (item.enhanceLevel || 0) * 0.1;
      // 战斗属性受强化加成
      bonus.atk  += (s.atk  || 0) * mult;
      bonus.def  += (s.def  || 0) * mult;
      bonus.hp   += (s.hp   || 0) * mult;
      bonus.mp   += (s.mp   || 0) * mult;
      bonus.spd  += (s.spd  || 0);
      bonus.crit += (s.crit || 0);
      // 抗性与特殊加成不受强化影响（词缀本身已有范围）
      bonus.fireRes      += (s.fireRes      || 0);
      bonus.iceRes       += (s.iceRes       || 0);
      bonus.lightningRes += (s.lightningRes || 0);
      bonus.poisonRes    += (s.poisonRes    || 0);
      bonus.physRes      += (s.physRes      || 0);
      bonus.dropBonus    += (s.dropBonus    || 0);
      bonus.goldBonus    += (s.goldBonus    || 0);
      bonus.expBonus     += (s.expBonus     || 0);
      bonus.hpr          += (s.hpr          || 0);
      bonus.mpr          += (s.mpr          || 0);
      // 技能强化词缀
      bonus.skillCdReduce   += (s.skillCdReduce   || 0);
      bonus.activeDmgBonus  += (s.activeDmgBonus  || 0);
      bonus.passiveStatMult += (s.passiveStatMult  || 0);
      bonus.mpOnKill        += (s.mpOnKill         || 0);
    });
    // CD减少上限 60%
    bonus.skillCdReduce = Math.min(0.60, bonus.skillCdReduce);
    return bonus;
  }

  /**
   * 获取总元素抗性（各项上限 75%）
   */
  function getTotalResistance() {
    const eq = getEquipBonus();
    return {
      fire:      Math.min(75, eq.fireRes),
      ice:       Math.min(75, eq.iceRes),
      lightning: Math.min(75, eq.lightningRes),
      poison:    Math.min(75, eq.poisonRes),
      phys:      Math.min(75, eq.physRes),
    };
  }

  /**
   * 获取掉落率加成（百分比，如 15 = +15%）
   */
  function getTotalDropBonus() {
    return getEquipBonus().dropBonus;
  }

  /**
   * 获取金币加成（百分比）
   */
  function getTotalGoldBonus() {
    return getEquipBonus().goldBonus;
  }

  /**
   * 获取经验加成（百分比）
   */
  function getTotalExpBonus() {
    return getEquipBonus().expBonus;
  }

  function getSkillEffects() {
    if (window.Skills) return window.Skills.getEffects();
    return { atkMult: 1, defMult: 1, hpMult: 1, spdAdd: 0, critAdd: 0, hprAdd: 0, mprAdd: 0 };
  }

  /** 获取临时 buff 加成（来自黑市卷轴） */
  function getBuffBonus() {
    const b = data.buffs || {};
    return {
      atkPct:  b.atkPct  || 0,   // ATK 百分比加成（如 30 = +30%）
      defPct:  b.defPct  || 0,
      spdAdd:  b.spdAdd  || 0,
      goldPct: b.goldPct || 0,
      dropPct: b.dropPct || 0,
      hprAdd:  b.hprAdd  || 0,
      mprAdd:  b.mprAdd  || 0,
      expPct:  b.expPct  || 0,
    };
  }

  function getTotalAtk() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    const buf = getBuffBonus();
    return Math.floor(
      (data.hero.baseAtk + eq.atk) * sk.atkMult * data.hero.prestigeBonus
      * (1 + buf.atkPct / 100)
    );
  }

  function getTotalDef() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    const buf = getBuffBonus();
    return Math.floor((data.hero.baseDef + eq.def) * (sk.defMult || 1) * (1 + buf.defPct / 100));
  }

  function getTotalMaxHp() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    return Math.floor((data.hero.baseMaxHp + eq.hp) * (sk.hpMult || 1));
  }

  function getTotalMaxMp() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    return Math.floor((data.hero.baseMaxMp + eq.mp) * (sk.mpMult || 1));
  }

  function getTotalSpd() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    const buf = getBuffBonus();
    return data.hero.baseSpd + eq.spd + (sk.spdAdd || 0) + buf.spdAdd;
  }

  function getTotalCrit() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    return Utils.clamp(data.hero.baseCrit + eq.crit + (sk.critAdd || 0), 0, 0.95);
  }

  // 攻击间隔（ms），最短 200ms
  function getAtkInterval() {
    return Math.max(200, Math.floor(1000 / getTotalSpd()));
  }

  /**
   * 获取总 HP 回复速率（点/秒）
   * 基础值 = 1 + level * 0.3（1级=1.3，10级=4，30级=10，50级=16）
   * 装备词缀、技能叠加
   */
  function getTotalHpr() {
    const eq  = getEquipBonus();
    const sk  = getSkillEffects();
    const buf = getBuffBonus();
    const base = 1 + data.hero.level * 0.3;
    return Math.max(0, base + eq.hpr + (sk.hprAdd || 0) + buf.hprAdd);
  }

  /**
   * 获取总 MP 回复速率（点/秒）
   * 基础值 = 0.5 + level * 0.15（1级=0.65，10级=2，30级=5，50级=8）
   */
  function getTotalMpr() {
    const eq  = getEquipBonus();
    const sk  = getSkillEffects();
    const buf = getBuffBonus();
    const base = 0.5 + data.hero.level * 0.15;
    return Math.max(0, base + eq.mpr + (sk.mprAdd || 0) + buf.mprAdd);
  }

  // ─────────────────────────────────────────
  // 升级逻辑
  // ─────────────────────────────────────────

  function calcExpToNext(level) {
    return Math.floor(100 * Math.pow(1.15, level - 1));
  }

  function levelUp() {
    data.hero.level++;
    data.hero.baseAtk  = Math.floor(data.hero.baseAtk  * 1.08 + 1);
    data.hero.baseDef  = Math.floor(data.hero.baseDef  * 1.08 + 1);
    data.hero.baseMaxHp = Math.floor(data.hero.baseMaxHp * 1.1 + 5);
    data.hero.baseMaxMp = Math.floor(data.hero.baseMaxMp * 1.08 + 2);
    data.hero.expToNext = calcExpToNext(data.hero.level);
    // 升级时补满 HP
    data.hero.hp = getTotalMaxHp();
    data.hero.mp = getTotalMaxMp();
    if (window.UI) UI.addLog(`>> Level up! Now Lv.${data.hero.level}`, "yellow");
  }

  function addExp(amount) {
    data.hero.exp += amount;
    while (data.hero.exp >= data.hero.expToNext) {
      data.hero.exp -= data.hero.expToNext;
      levelUp();
    }
  }

  // ─────────────────────────────────────────
  // 状态访问器（供其他模块使用）
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // 属性训练系统（金币消耗）
  // ─────────────────────────────────────────

  /**
   * 训练费用：base * 1.6^n（n = 已训练次数）
   * atk base=300, def base=200, hp base=150, spd base=1000
   */
  const TRAIN_BASE = { atk: 300, def: 200, hp: 150, spd: 1000 };

  function getTrainCost(stat) {
    const n = (data.training && data.training[stat]) || 0;
    const base = TRAIN_BASE[stat] || 300;
    return Math.floor(base * Math.pow(1.6, n));
  }

  /**
   * 训练指定属性：消耗金币，永久提升基础属性
   * atk/def/hp: 各+1/+1/+5，spd: +0.05
   */
  function train(stat) {
    if (!TRAIN_BASE[stat]) return;
    if (!data.training) data.training = { atk: 0, def: 0, hp: 0, spd: 0 };

    const cost = getTrainCost(stat);
    if (data.hero.gold < cost) {
      if (window.UI) UI.addLog(`>> Need ${cost}g to train ${stat.toUpperCase()}. (Have ${data.hero.gold}g)`, "red");
      return;
    }
    data.hero.gold -= cost;
    data.training[stat] = (data.training[stat] || 0) + 1;

    // 应用属性提升
    if (stat === "atk") {
      data.hero.baseAtk += 1;
      if (window.UI) UI.addLog(`>> [TRAINING] Base ATK +1 → ${data.hero.baseAtk} (-${cost}g)`, "green");
    } else if (stat === "def") {
      data.hero.baseDef += 1;
      if (window.UI) UI.addLog(`>> [TRAINING] Base DEF +1 → ${data.hero.baseDef} (-${cost}g)`, "green");
    } else if (stat === "hp") {
      data.hero.baseMaxHp += 5;
      data.hero.hp = Math.min(data.hero.hp + 5, getTotalMaxHp());
      if (window.UI) UI.addLog(`>> [TRAINING] Base MaxHP +5 → ${data.hero.baseMaxHp} (-${cost}g)`, "green");
    } else if (stat === "spd") {
      data.hero.baseSpd = Math.round((data.hero.baseSpd + 0.05) * 100) / 100;
      if (window.UI) UI.addLog(`>> [TRAINING] Base SPD +0.05 → ${data.hero.baseSpd.toFixed(2)} (-${cost}g)`, "green");
    }
    if (window.UI) UI.markSidePanelDirty();
  }

  function get() { return data; }

  function set(newData) { data = newData; }

  function reset() { data = createDefault(); }

  return {
    get,
    set,
    reset,
    createDefault,
    // 派生属性
    getTotalAtk,
    getTotalDef,
    getTotalMaxHp,
    getTotalMaxMp,
    getTotalSpd,
    getTotalCrit,
    getTotalHpr,
    getTotalMpr,
    getAtkInterval,
    getEquipBonus,
    getTotalResistance,
    getTotalDropBonus,
    getTotalGoldBonus,
    getTotalExpBonus,
    // 升级
    addExp,
    levelUp,
    calcExpToNext,
    // 属性训练
    train,
    getTrainCost,
    TRAIN_BASE,
    // 临时 buff（黑市）
    getBuffBonus,
  };
})();

window.State = State;
