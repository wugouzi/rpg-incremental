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
    });
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

  function getTotalAtk() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    return Math.floor(
      (data.hero.baseAtk + eq.atk) * sk.atkMult * data.hero.prestigeBonus
    );
  }

  function getTotalDef() {
    const eq = getEquipBonus();
    const sk = getSkillEffects();
    return Math.floor((data.hero.baseDef + eq.def) * (sk.defMult || 1));
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
    return data.hero.baseSpd + eq.spd + (sk.spdAdd || 0);
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
   * 基础值 = level * 0.1（约1级=0.1，50级=5），装备词缀叠加
   */
  function getTotalHpr() {
    const eq  = getEquipBonus();
    const sk  = getSkillEffects();
    const base = data.hero.level * 0.1;
    return Math.max(0, base + eq.hpr + (sk.hprAdd || 0));
  }

  /**
   * 获取总 MP 回复速率（点/秒）
   * 基础值 = level * 0.05
   */
  function getTotalMpr() {
    const eq  = getEquipBonus();
    const sk  = getSkillEffects();
    const base = data.hero.level * 0.05;
    return Math.max(0, base + eq.mpr + (sk.mprAdd || 0));
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
  };
})();

window.State = State;
