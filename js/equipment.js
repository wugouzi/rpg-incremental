// equipment.js — 装备定义、商店物品、装备/卸下/强化/出售逻辑 + 随机词缀系统

const Equipment = (() => {
  // 品质枚举
  const RARITY = {
    common:    { label: "COMMON",    color: "white"  },
    rare:      { label: "RARE",      color: "cyan"   },
    epic:      { label: "EPIC",      color: "yellow" },
    legendary: { label: "LEGENDARY", color: "red"    },
  };

  // 品质对应词缀数量上限、基础属性倍率、属性浮动范围（±比例）
  const RARITY_CONFIG = {
    common:    { affixCount: 0, statMult: 1.0,  statVariance: 0.20 },
    rare:      { affixCount: 1, statMult: 1.15, statVariance: 0.20 },
    epic:      { affixCount: 2, statMult: 1.30, statVariance: 0.15 },
    legendary: { affixCount: 3, statMult: 1.50, statVariance: 0.10 },
  };

  // 掉落时品质升档概率（由模板品质出发）
  // 例：模板 common 掉落 → 15% 概率变 rare，5% 概率变 epic，1% 概率变 legendary
  const RARITY_UPGRADE = {
    common:    [
      { to: "legendary", chance: 0.01 },
      { to: "epic",      chance: 0.05 },
      { to: "rare",      chance: 0.15 },
    ],
    rare:      [
      { to: "legendary", chance: 0.03 },
      { to: "epic",      chance: 0.12 },
    ],
    epic:      [
      { to: "legendary", chance: 0.05 },
    ],
    legendary: [],
  };

  // ─────────────────────────────────────────
  // 词缀定义
  // 每个词缀有 id、名称、适用槽位、效果字段和取值范围
  // ─────────────────────────────────────────
  const AFFIX_POOL = [
    // ── 战斗属性词缀 ─────────────────────────
    {
      id: "bonus_atk",       name: "of Fury",
      slots: ["weapon", "ring", "neck"],
      stat: "atk",           range: [3, 18],
    },
    {
      id: "bonus_def",       name: "of Fortitude",
      slots: ["helmet", "chest", "legs", "ring", "neck"],
      stat: "def",           range: [2, 12],
    },
    {
      id: "bonus_hp",        name: "of Vitality",
      slots: ["helmet", "chest", "legs", "ring", "neck"],
      stat: "hp",            range: [10, 60],
    },
    {
      id: "bonus_mp",        name: "of Wisdom",
      slots: ["helmet", "ring", "neck"],
      stat: "mp",            range: [5, 30],
    },
    {
      id: "bonus_spd",       name: "of Swiftness",
      slots: ["weapon", "legs", "ring", "neck"],
      stat: "spd",           range: [0.05, 0.25],   // float
    },
    {
      id: "bonus_crit",      name: "of Precision",
      slots: ["weapon", "ring", "neck"],
      stat: "crit",          range: [0.02, 0.08],   // float
    },

    // ── 元素抗性词缀 ─────────────────────────
    {
      id: "fire_res",        name: "Flame-Resistant",
      slots: ["helmet", "chest", "legs", "ring", "neck"],
      stat: "fireRes",       range: [3, 20],         // 百分比整数
    },
    {
      id: "ice_res",         name: "Frost-Resistant",
      slots: ["helmet", "chest", "legs", "ring", "neck"],
      stat: "iceRes",        range: [3, 20],
    },
    {
      id: "lightning_res",   name: "Storm-Resistant",
      slots: ["helmet", "chest", "legs", "ring", "neck"],
      stat: "lightningRes",  range: [3, 20],
    },
    {
      id: "poison_res",      name: "Venom-Resistant",
      slots: ["helmet", "chest", "legs", "ring", "neck"],
      stat: "poisonRes",     range: [3, 20],
    },
    {
      id: "phys_res",        name: "Ironhide",
      slots: ["helmet", "chest", "legs"],
      stat: "physRes",       range: [2, 12],
    },

    // ── 回复属性词缀 ─────────────────────────
    {
      id: "bonus_hpr",       name: "of Recovery",
      slots: ["helmet", "chest", "legs", "ring", "neck"],
      stat: "hpr",           range: [1, 8],          // HP/s
    },
    {
      id: "bonus_mpr",       name: "of Clarity",
      slots: ["helmet", "ring", "neck"],
      stat: "mpr",           range: [1, 5],          // MP/s
    },

    // ── 特殊效果词缀 ─────────────────────────
    {
      id: "drop_bonus",      name: "Plunderer's",
      slots: ["weapon", "ring", "neck"],
      stat: "dropBonus",     range: [3, 15],         // 百分比整数：提升掉落率
    },
    {
      id: "gold_bonus",      name: "Wealthy",
      slots: ["ring", "neck", "weapon"],
      stat: "goldBonus",     range: [3, 15],         // 百分比整数：提升金币收益
    },
    {
      id: "exp_bonus",       name: "Scholar's",
      slots: ["helmet", "neck", "ring"],
      stat: "expBonus",      range: [3, 12],         // 百分比整数：提升经验收益
    },
  ];

  // 快速按 stat 类型判断是否为 float 类型
  const FLOAT_STATS = new Set(["spd", "crit"]);

  // 装备模板定义
  // buyPrice: 0 = 只能掉落，不能购买
  const ITEM_TEMPLATES = [
    // ── 武器 ─────────────────────────────────
    { id: "wooden_sword",   name: "Wooden Sword",   slot: "weapon", rarity: "common",
      stats: { atk: 8 },  buyPrice: 30,  sellPrice: 8,   zone: "plains" },
    { id: "iron_sword",     name: "Iron Sword",     slot: "weapon", rarity: "common",
      stats: { atk: 18 }, buyPrice: 80,  sellPrice: 20,  zone: "forest" },
    { id: "steel_sword",    name: "Steel Sword",    slot: "weapon", rarity: "rare",
      stats: { atk: 38 }, buyPrice: 200, sellPrice: 50,  zone: "cave"   },
    { id: "desert_blade",   name: "Desert Blade",   slot: "weapon", rarity: "rare",
      stats: { atk: 65 }, buyPrice: 500, sellPrice: 120, zone: "desert" },
    { id: "shadow_blade",   name: "Shadow Blade",   slot: "weapon", rarity: "epic",
      stats: { atk: 110, crit: 0.05 }, buyPrice: 1200, sellPrice: 300, zone: "castle" },
    { id: "lords_sword",    name: "Lord's Sword",   slot: "weapon", rarity: "legendary",
      stats: { atk: 200, crit: 0.1 },  buyPrice: 0,    sellPrice: 600, zone: "castle" },

    // ── 头盔 ─────────────────────────────────
    { id: "leather_cap",    name: "Leather Cap",    slot: "helmet", rarity: "common",
      stats: { def: 3, hp: 5 }, buyPrice: 20, sellPrice: 5, zone: "plains" },
    { id: "iron_helmet",    name: "Iron Helmet",    slot: "helmet", rarity: "common",
      stats: { def: 8, hp: 10 }, buyPrice: 60, sellPrice: 15, zone: "forest" },
    { id: "steel_helmet",   name: "Steel Helmet",   slot: "helmet", rarity: "rare",
      stats: { def: 18, hp: 25 }, buyPrice: 180, sellPrice: 45, zone: "cave" },
    { id: "desert_hood",    name: "Desert Hood",    slot: "helmet", rarity: "rare",
      stats: { def: 30, hp: 40, spd: 0.1 }, buyPrice: 450, sellPrice: 110, zone: "desert" },
    { id: "shadow_helm",    name: "Shadow Helm",    slot: "helmet", rarity: "epic",
      stats: { def: 55, hp: 80 }, buyPrice: 1000, sellPrice: 250, zone: "castle" },

    // ── 胸甲 ─────────────────────────────────
    { id: "leather_armor",  name: "Leather Armor",  slot: "chest",  rarity: "common",
      stats: { def: 5, hp: 10 }, buyPrice: 40, sellPrice: 10, zone: "plains" },
    { id: "iron_armor",     name: "Iron Armor",     slot: "chest",  rarity: "common",
      stats: { def: 13, hp: 20 }, buyPrice: 100, sellPrice: 25, zone: "forest" },
    { id: "steel_armor",    name: "Steel Armor",    slot: "chest",  rarity: "rare",
      stats: { def: 28, hp: 40 }, buyPrice: 250, sellPrice: 62, zone: "cave" },
    { id: "desert_robe",    name: "Desert Robe",    slot: "chest",  rarity: "rare",
      stats: { def: 42, hp: 60, mp: 20 }, buyPrice: 600, sellPrice: 150, zone: "desert" },
    { id: "obsidian_armor", name: "Obsidian Armor", slot: "chest",  rarity: "epic",
      stats: { def: 70, hp: 100 }, buyPrice: 1000, sellPrice: 250, zone: "castle" },

    // ── 腿甲 ─────────────────────────────────
    { id: "leather_legs",   name: "Leather Leggings", slot: "legs", rarity: "common",
      stats: { def: 3, hp: 8 }, buyPrice: 25, sellPrice: 6, zone: "plains" },
    { id: "iron_legs",      name: "Iron Leggings",    slot: "legs", rarity: "common",
      stats: { def: 9, hp: 15 }, buyPrice: 70, sellPrice: 17, zone: "forest" },
    { id: "steel_legs",     name: "Steel Leggings",   slot: "legs", rarity: "rare",
      stats: { def: 20, hp: 30 }, buyPrice: 200, sellPrice: 50, zone: "cave" },
    { id: "shadow_legs",    name: "Shadow Leggings",  slot: "legs", rarity: "epic",
      stats: { def: 45, hp: 70, spd: 0.1 }, buyPrice: 900, sellPrice: 225, zone: "castle" },

    // ── 戒指 ─────────────────────────────────
    { id: "iron_ring",      name: "Iron Ring",      slot: "ring",   rarity: "common",
      stats: { atk: 5 },  buyPrice: 50, sellPrice: 12, zone: "plains" },
    { id: "magic_ring",     name: "Magic Ring",     slot: "ring",   rarity: "rare",
      stats: { crit: 0.05, mp: 15 }, buyPrice: 150, sellPrice: 37, zone: "cave" },
    { id: "lords_ring",     name: "Lord's Ring",    slot: "ring",   rarity: "legendary",
      stats: { atk: 50, crit: 0.08, spd: 0.15 }, buyPrice: 0, sellPrice: 500, zone: "castle" },

    // ── 项链 ─────────────────────────────────
    { id: "bone_necklace",  name: "Bone Necklace",  slot: "neck",   rarity: "common",
      stats: { hp: 20 }, buyPrice: 60, sellPrice: 15, zone: "cave" },
    { id: "sand_amulet",    name: "Sand Amulet",    slot: "neck",   rarity: "rare",
      stats: { spd: 0.15, hp: 30 }, buyPrice: 400, sellPrice: 100, zone: "desert" },
    { id: "shadow_pendant", name: "Shadow Pendant", slot: "neck",   rarity: "epic",
      stats: { atk: 40, hp: 60, crit: 0.05 }, buyPrice: 1100, sellPrice: 275, zone: "castle" },
  ];

  // 快速按 id 查找模板
  const TEMPLATE_MAP = {};
  ITEM_TEMPLATES.forEach(t => { TEMPLATE_MAP[t.id] = t; });

  // ─────────────────────────────────────────
  // 随机词缀生成
  // ─────────────────────────────────────────

  /**
   * 为指定槽位和品质随机生成词缀列表
   * @param {string} slot  装备槽
   * @param {string} rarity 品质
   * @returns {Array} [ { id, name, stat, value }, ... ]
   */
  function rollAffixes(slot, rarity) {
    const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
    if (cfg.affixCount === 0) return [];

    // 筛选适合该槽位的词缀池
    const pool = AFFIX_POOL.filter(a => a.slots.includes(slot));
    if (pool.length === 0) return [];

    // 不重复随机抽取
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(cfg.affixCount, pool.length));

    return picked.map(a => {
      const [lo, hi] = a.range;
      let value;
      if (FLOAT_STATS.has(a.stat)) {
        // 浮点属性：保留 2 位小数
        value = Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;
      } else {
        // 整数属性
        value = Utils.rand(lo, hi);
      }
      return { id: a.id, name: a.name, stat: a.stat, value };
    });
  }

  /**
   * 从模板创建物品实例
   * @param {string}  templateId
   * @param {boolean} withAffixes   是否随机词缀（掉落=true，商店=false）
   * @param {boolean} rollStats     是否随机浮动基础属性（掉落=true，商店=false）
   * @param {boolean} upgradeRarity 是否尝试随机升档品质（掉落=true）
   */
  function createItem(templateId, withAffixes, rollStats, upgradeRarity) {
    const tpl = TEMPLATE_MAP[templateId];
    if (!tpl) return null;

    // ── 品质升档（掉落专用）────────────────
    let finalRarity = tpl.rarity;
    if (upgradeRarity) {
      const upgrades = RARITY_UPGRADE[tpl.rarity] || [];
      for (const u of upgrades) {
        if (Math.random() < u.chance) {
          finalRarity = u.to;
          break;  // 从高到低检查，命中即止
        }
      }
    }

    const cfg = RARITY_CONFIG[finalRarity] || RARITY_CONFIG.common;

    // ── 基础属性计算（含随机浮动）──────────
    const scaledStats = {};
    Object.entries(tpl.stats).forEach(([k, v]) => {
      const base = v * cfg.statMult;
      let finalVal;
      if (rollStats) {
        const variance = cfg.statVariance || 0;
        const lo = base * (1 - variance);
        const hi = base * (1 + variance);
        if (FLOAT_STATS.has(k)) {
          finalVal = Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;
        } else {
          finalVal = Utils.rand(Math.floor(lo), Math.ceil(hi));
        }
      } else {
        // 商店：固定值
        if (FLOAT_STATS.has(k)) {
          finalVal = Math.round(base * 100) / 100;
        } else {
          finalVal = Math.floor(base);
        }
      }
      scaledStats[k] = finalVal;
    });

    const affixes = withAffixes ? rollAffixes(tpl.slot, finalRarity) : [];

    return {
      ...tpl,
      rarity: finalRarity,   // 可能被升档
      stats: scaledStats,
      affixes,
      enhanceLevel: 0,
      instanceId: Date.now() + Math.random(),
    };
  }

  /**
   * 获取物品所有有效属性（基础 stats + 词缀叠加）
   * 供 state.js getEquipBonus 使用
   */
  function getItemTotalStats(item) {
    const total = { ...item.stats };
    (item.affixes || []).forEach(a => {
      total[a.stat] = (total[a.stat] || 0) + a.value;
    });
    return total;
  }

  // ─────────────────────────────────────────
  // 装备操作
  // ─────────────────────────────────────────

  /**
   * 装备背包中的物品（旧装备放入背包）
   */
  function equip(item) {
    const state = State.get();
    const slot = item.slot;
    const old = state.equipment[slot];
    if (old) {
      state.inventory.push(old);
    }
    state.equipment[slot] = item;
    state.inventory = state.inventory.filter(i => i.instanceId !== item.instanceId);
    if (window.UI) UI.addLog(`>> Equipped: ${item.name}`, "green");
    if (window.UI) UI.markSidePanelDirty();
  }

  /**
   * 卸下已装备的物品到背包
   */
  function unequip(slot) {
    const state = State.get();
    const item = state.equipment[slot];
    if (!item) return;
    if (state.inventory.length >= 20) {
      if (window.UI) UI.addLog(">> Inventory full! Cannot unequip.", "red");
      return;
    }
    state.inventory.push(item);
    state.equipment[slot] = null;
    if (window.UI) UI.addLog(`>> Unequipped: ${item.name}`, "white");
    if (window.UI) UI.markSidePanelDirty();
  }

  /**
   * 出售背包中的物品
   */
  function sell(item) {
    const state = State.get();
    // 词缀加成额外售价 5% 每个词缀
    const affixBonus = 1 + (item.affixes || []).length * 0.05;
    const price = Math.floor(item.sellPrice * affixBonus * (1 + item.enhanceLevel * 0.05));
    state.inventory = state.inventory.filter(i => i.instanceId !== item.instanceId);
    state.hero.gold += price;
    state.stats.totalGoldEarned += price;
    if (window.UI) UI.addLog(`>> Sold ${item.name} for ${price}g`, "yellow");
    if (window.UI) UI.markSidePanelDirty();
  }

  /**
   * 强化物品（消耗金币，提升 enhanceLevel）
   * 强化费用：100 * (enhanceLevel + 1)^1.5
   * 强化上限：10 级
   */
  function enhance(item) {
    const state = State.get();
    if (item.enhanceLevel >= 10) {
      if (window.UI) UI.addLog(">> Already at max enhancement (+10).", "gray");
      return;
    }
    const cost = Math.floor(100 * Math.pow(item.enhanceLevel + 1, 1.5));
    if (state.hero.gold < cost) {
      if (window.UI) UI.addLog(`>> Need ${cost}g to enhance. (Have ${state.hero.gold}g)`, "red");
      return;
    }
    state.hero.gold -= cost;
    item.enhanceLevel++;
    if (window.UI) UI.addLog(`>> ${item.name} enhanced to +${item.enhanceLevel}! (-${cost}g)`, "cyan");
    if (window.UI) UI.markSidePanelDirty();
  }

  // ─────────────────────────────────────────
  // 商店
  // ─────────────────────────────────────────

  /**
   * 返回当前区域及之前区域可购买的商店物品列表
   */
  function getShopItems() {
    const state = State.get();
    const unlockedZones = state.unlockedZones;
    return ITEM_TEMPLATES.filter(t =>
      t.buyPrice > 0 && unlockedZones.includes(t.zone)
    );
  }

  /**
   * 购买物品放入背包（商店购买不带词缀，是基础版本）
   */
  function buy(templateId) {
    const state = State.get();
    const tpl = TEMPLATE_MAP[templateId];
    if (!tpl || tpl.buyPrice <= 0) return;
    if (state.inventory.length >= 20) {
      if (window.UI) UI.addLog(">> Inventory full!", "red");
      return;
    }
    if (state.hero.gold < tpl.buyPrice) {
      if (window.UI) UI.addLog(`>> Not enough gold! Need ${tpl.buyPrice}g.`, "red");
      return;
    }
    state.hero.gold -= tpl.buyPrice;
    const item = createItem(templateId, false); // 商店无词缀
    state.inventory.push(item);
    if (window.UI) UI.addLog(`>> Purchased: ${tpl.name} (-${tpl.buyPrice}g)`, "green");
    if (window.UI) UI.markSidePanelDirty();
  }

  /**
   * 向背包添加掉落物品（由 combat.js 调用）
   */
  function addToInventory(item) {
    const state = State.get();
    if (state.inventory.length >= 20) {
      const affixBonus = 1 + (item.affixes || []).length * 0.05;
      const autoSell = Math.floor(item.sellPrice * affixBonus / 2);
      state.hero.gold += autoSell;
      if (window.UI) UI.addLog(`>> Inventory full. Auto-sold ${item.name} for ${autoSell}g.`, "gray");
      return;
    }
    state.inventory.push(item);
  }

  /**
   * 获取品质颜色标签
   */
  function getRarityColor(rarity) {
    return (RARITY[rarity] || RARITY.common).color;
  }

  function getRarityLabel(rarity) {
    return (RARITY[rarity] || RARITY.common).label;
  }

  return {
    ITEM_TEMPLATES,
    TEMPLATE_MAP,
    AFFIX_POOL,
    RARITY,
    RARITY_CONFIG,
    RARITY_UPGRADE,
    createItem,
    getItemTotalStats,
    rollAffixes,
    equip,
    unequip,
    sell,
    enhance,
    buy,
    getShopItems,
    addToInventory,
    getRarityColor,
    getRarityLabel,
  };
})();

window.Equipment = Equipment;
