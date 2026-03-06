// gemshop.js — 宝石商店系统（Gems 消耗途径）
// 提供永久属性强化、特殊被动解锁、限时 buff 等 Gems 消耗选项

const GemShop = (() => {

  // ─────────────────────────────────────────
  // 永久升级选项（每个可多次购买，费用递增）
  // ─────────────────────────────────────────

  const UPGRADES = [
    {
      id: "gem_atk_bonus",
      name: "Warrior's Blessing",
      desc: "+5% ATK permanently (stacks)",
      icon: "⚔",
      baseCost: 1,
      costScale: 1.5,      // cost = floor(base * 1.5^n)
      maxLevel: 20,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.atkPct = (state.gemUpgrades.atkPct || 0) + 5;
      },
    },
    {
      id: "gem_hp_bonus",
      name: "Vitality Crystal",
      desc: "+8% Max HP permanently (stacks)",
      icon: "❤",
      baseCost: 1,
      costScale: 1.5,
      maxLevel: 20,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.hpPct = (state.gemUpgrades.hpPct || 0) + 8;
      },
    },
    {
      id: "gem_def_bonus",
      name: "Iron Bulwark",
      desc: "+6% DEF permanently (stacks)",
      icon: "🛡",
      baseCost: 1,
      costScale: 1.5,
      maxLevel: 20,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.defPct = (state.gemUpgrades.defPct || 0) + 6;
      },
    },
    {
      id: "gem_gold_multi",
      name: "Midas Touch",
      desc: "+10% Gold earned permanently (stacks)",
      icon: "🪙",
      baseCost: 1,
      costScale: 1.8,
      maxLevel: 15,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.goldPct = (state.gemUpgrades.goldPct || 0) + 10;
      },
    },
    {
      id: "gem_exp_multi",
      name: "Tome of Wisdom",
      desc: "+12% EXP earned permanently (stacks)",
      icon: "📖",
      baseCost: 1,
      costScale: 1.8,
      maxLevel: 15,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.expPct = (state.gemUpgrades.expPct || 0) + 12;
      },
    },
    {
      id: "gem_crit_bonus",
      name: "Sharpened Edge",
      desc: "+2% Crit Rate permanently (stacks)",
      icon: "🎯",
      baseCost: 2,
      costScale: 1.6,
      maxLevel: 10,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.critAdd = (state.gemUpgrades.critAdd || 0) + 0.02;
      },
    },
    {
      id: "gem_drop_bonus",
      name: "Plunderer's Sigil",
      desc: "+8% Drop Rate permanently (stacks)",
      icon: "💫",
      baseCost: 2,
      costScale: 1.7,
      maxLevel: 10,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.dropPct = (state.gemUpgrades.dropPct || 0) + 8;
      },
    },
    {
      id: "gem_inventory_expand",
      name: "Dimensional Pouch",
      desc: "Expand inventory by 5 slots (max +20)",
      icon: "🎒",
      baseCost: 3,
      costScale: 2.0,
      maxLevel: 4,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.invExpand = (state.gemUpgrades.invExpand || 0) + 5;
      },
    },
    {
      id: "gem_prestige_boost",
      name: "Ascendant Power",
      desc: "Prestige ATK bonus +5% (cumulative with all prestige bonuses)",
      icon: "✨",
      baseCost: 5,
      costScale: 2.5,
      maxLevel: 10,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.prestigeAtkBonus = (state.gemUpgrades.prestigeAtkBonus || 0) + 0.05;
        // 直接叠加到 prestigeBonus 上
        state.hero.prestigeBonus = Math.round((state.hero.prestigeBonus + 0.05) * 1000) / 1000;
      },
    },
    {
      id: "gem_offline_extend",
      name: "Eternal Vigil",
      desc: "Offline income cap +2 hours (base 8h, max 24h)",
      icon: "🕐",
      baseCost: 3,
      costScale: 2.0,
      maxLevel: 8,
      apply(state) {
        if (!state.gemUpgrades) state.gemUpgrades = {};
        state.gemUpgrades.offlineHours = (state.gemUpgrades.offlineHours || 0) + 2;
      },
    },
  ];

  // ─────────────────────────────────────────
  // 一次性特殊解锁
  // ─────────────────────────────────────────

  const SPECIAL_UNLOCKS = [
    {
      id: "gem_auto_prestige",
      name: "Auto-Prestige Gate",
      desc: "Show a prompt to prestige when Dark Lord is defeated (prevents accidental prestige)",
      icon: "🔔",
      cost: 5,
      oneTime: true,
      apply(state) {
        if (!state.gemUnlocks) state.gemUnlocks = {};
        state.gemUnlocks.autoPrestigeAlert = true;
      },
    },
    {
      id: "gem_second_chance",
      name: "Second Chance",
      desc: "Once per prestige: when you die, revive with 50% HP instead of taking gold penalty",
      icon: "💫",
      cost: 8,
      oneTime: true,
      apply(state) {
        if (!state.gemUnlocks) state.gemUnlocks = {};
        state.gemUnlocks.secondChance = true;
        state.gemUnlocks.secondChanceUsed = false;
      },
    },
    {
      id: "gem_elite_loot",
      name: "Elite Magnetism",
      desc: "Elite monsters always drop at least 1 equipment item",
      icon: "⚠",
      cost: 10,
      oneTime: true,
      apply(state) {
        if (!state.gemUnlocks) state.gemUnlocks = {};
        state.gemUnlocks.eliteLoot = true;
      },
    },
    {
      id: "gem_craft_slot",
      name: "Craftsman's Table",
      desc: "Unlock Crafting: combine 3 same-rarity items to create 1 higher-rarity item",
      icon: "⚒",
      cost: 15,
      oneTime: true,
      apply(state) {
        if (!state.gemUnlocks) state.gemUnlocks = {};
        state.gemUnlocks.crafting = true;
      },
    },
  ];

  // ─────────────────────────────────────────
  // 辅助：计算升级费用
  // ─────────────────────────────────────────

  function getUpgradeCost(upg) {
    const state = State.get();
    const levels = (state.gemUpgradeLevels && state.gemUpgradeLevels[upg.id]) || 0;
    return Math.floor(upg.baseCost * Math.pow(upg.costScale, levels));
  }

  function getUpgradeLevel(upgId) {
    const state = State.get();
    return (state.gemUpgradeLevels && state.gemUpgradeLevels[upgId]) || 0;
  }

  function isSpecialUnlocked(unlockId) {
    const state = State.get();
    return !!(state.gemUnlocks && state.gemUnlocks[unlockId.replace("gem_", "").replace(/_/g, "").toLowerCase()
              // map to actual state key
            ]) || !!(state.gemUnlocks && _getUnlockKey(unlockId));
  }

  function _getUnlockKey(unlockId) {
    const state = State.get();
    const unlocks = state.gemUnlocks || {};
    const keyMap = {
      "gem_auto_prestige": "autoPrestigeAlert",
      "gem_second_chance": "secondChance",
      "gem_elite_loot": "eliteLoot",
      "gem_craft_slot": "crafting",
    };
    return unlocks[keyMap[unlockId]];
  }

  // ─────────────────────────────────────────
  // 购买升级
  // ─────────────────────────────────────────

  function buyUpgrade(upgradeId) {
    const state = State.get();
    const upg = UPGRADES.find(u => u.id === upgradeId);
    if (!upg) return;

    const currentLevel = getUpgradeLevel(upgradeId);
    if (currentLevel >= upg.maxLevel) {
      if (window.UI) UI.addLog(`>> ${upg.name} is already at max level!`, "gray");
      return;
    }

    const cost = getUpgradeCost(upg);
    if (state.hero.gems < cost) {
      if (window.UI) UI.addLog(`>> Need ${cost} Gem(s) to buy ${upg.name}. (Have ${state.hero.gems})`, "red");
      return;
    }

    state.hero.gems -= cost;

    // 记录升级次数
    if (!state.gemUpgradeLevels) state.gemUpgradeLevels = {};
    state.gemUpgradeLevels[upgradeId] = currentLevel + 1;

    // 应用效果
    upg.apply(state);

    if (window.UI) {
      UI.addLog(`>> [GEM SHOP] ${upg.name} Lv.${currentLevel + 1}! (-${cost}💎)`, "cyan");
      UI.markSidePanelDirty();
    }
  }

  function buySpecialUnlock(unlockId) {
    const state = State.get();
    const unlock = SPECIAL_UNLOCKS.find(u => u.id === unlockId);
    if (!unlock) return;

    // 检查是否已解锁
    if (_getUnlockKey(unlockId)) {
      if (window.UI) UI.addLog(`>> ${unlock.name} is already unlocked!`, "gray");
      return;
    }

    if (state.hero.gems < unlock.cost) {
      if (window.UI) UI.addLog(`>> Need ${unlock.cost} Gem(s) for ${unlock.name}. (Have ${state.hero.gems})`, "red");
      return;
    }

    state.hero.gems -= unlock.cost;
    unlock.apply(state);

    if (window.UI) {
      UI.addLog(`>> [GEM SHOP] Unlocked: ${unlock.name}! (-${unlock.cost}💎)`, "yellow");
      UI.markSidePanelDirty();
    }
  }

  // ─────────────────────────────────────────
  // 获取宝石升级加成（供 state.js 使用）
  // ─────────────────────────────────────────

  /**
   * 返回所有宝石升级提供的加成
   * { atkPct, hpPct, defPct, goldPct, expPct, critAdd, dropPct, invExpand, offlineHours }
   */
  function getGemBonus() {
    const state = State.get();
    const g = state.gemUpgrades || {};
    return {
      atkPct:       g.atkPct       || 0,   // ATK 百分比加成
      hpPct:        g.hpPct        || 0,   // MaxHP 百分比加成
      defPct:       g.defPct       || 0,   // DEF 百分比加成
      goldPct:      g.goldPct      || 0,   // Gold 收益加成
      expPct:       g.expPct       || 0,   // EXP 收益加成
      critAdd:      g.critAdd      || 0,   // 暴击率加成
      dropPct:      g.dropPct      || 0,   // 掉落率加成
      invExpand:    g.invExpand    || 0,   // 背包扩容
      offlineHours: g.offlineHours || 0,  // 离线时间扩展（小时）
    };
  }

  /**
   * 获取背包实际最大容量（含宝石扩容）
   */
  function getMaxInventory() {
    return 20 + (getGemBonus().invExpand || 0);
  }

  return {
    UPGRADES,
    SPECIAL_UNLOCKS,
    getUpgradeCost,
    getUpgradeLevel,
    getGemBonus,
    getMaxInventory,
    buyUpgrade,
    buySpecialUnlock,
    _getUnlockKey,
  };
})();

window.GemShop = GemShop;
