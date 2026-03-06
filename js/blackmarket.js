// blackmarket.js — 黑市商店系统（金币消耗机制之一）
// 每 3 分钟自动刷新，提供 4 件随机特殊商品（高价装备、临时 Buff、Reroll 代券）

const BlackMarket = (() => {
  // 刷新间隔（ms）
  const REFRESH_INTERVAL = 3 * 60 * 1000; // 3分钟

  // 倒计时（ms）
  let refreshTimer = REFRESH_INTERVAL;

  // 当前上架商品列表（4件）
  let currentStock = [];

  // ─────────────────────────────────────────
  // 商品类型定义
  // ─────────────────────────────────────────

  // Buff 卷轴：给英雄临时加成（持续至战斗结束或一段时间）
  // 实现方式：写入 state.hero 的临时 buff 字段，combat.js 读取
  const BUFF_SCROLLS = [
    {
      id: "scroll_atk",
      name: "Scroll of Power",
      desc: "+30% ATK for 5 minutes",
      goldCost: (lvl) => Math.floor(800 + lvl * 80),
      apply(state) {
        if (!state.buffs) state.buffs = {};
        state.buffs.atkPct = (state.buffs.atkPct || 0) + 30;
        state.buffs.atkPctTimer = (state.buffs.atkPctTimer || 0) + 5 * 60 * 1000;
      },
    },
    {
      id: "scroll_def",
      name: "Scroll of Iron Skin",
      desc: "+40% DEF for 5 minutes",
      goldCost: (lvl) => Math.floor(600 + lvl * 60),
      apply(state) {
        if (!state.buffs) state.buffs = {};
        state.buffs.defPct = (state.buffs.defPct || 0) + 40;
        state.buffs.defPctTimer = (state.buffs.defPctTimer || 0) + 5 * 60 * 1000;
      },
    },
    {
      id: "scroll_haste",
      name: "Scroll of Haste",
      desc: "+0.4 SPD for 3 minutes",
      goldCost: (lvl) => Math.floor(1000 + lvl * 100),
      apply(state) {
        if (!state.buffs) state.buffs = {};
        state.buffs.spdAdd = (state.buffs.spdAdd || 0) + 0.4;
        state.buffs.spdAddTimer = (state.buffs.spdAddTimer || 0) + 3 * 60 * 1000;
      },
    },
    {
      id: "scroll_luck",
      name: "Scroll of Fortune",
      desc: "+25% Gold & +20% Drop Rate for 5 minutes",
      goldCost: (lvl) => Math.floor(700 + lvl * 70),
      apply(state) {
        if (!state.buffs) state.buffs = {};
        state.buffs.goldPct = (state.buffs.goldPct || 0) + 25;
        state.buffs.dropPct = (state.buffs.dropPct || 0) + 20;
        state.buffs.luckTimer = (state.buffs.luckTimer || 0) + 5 * 60 * 1000;
      },
    },
    {
      id: "scroll_regen",
      name: "Scroll of Restoration",
      desc: "+15 HPR & +8 MPR for 5 minutes",
      goldCost: (lvl) => Math.floor(500 + lvl * 50),
      apply(state) {
        if (!state.buffs) state.buffs = {};
        state.buffs.hprAdd = (state.buffs.hprAdd || 0) + 15;
        state.buffs.mprAdd = (state.buffs.mprAdd || 0) + 8;
        state.buffs.regenTimer = (state.buffs.regenTimer || 0) + 5 * 60 * 1000;
      },
    },
    {
      id: "scroll_xp",
      name: "Scroll of Insight",
      desc: "+50% EXP for 5 minutes",
      goldCost: (lvl) => Math.floor(600 + lvl * 60),
      apply(state) {
        if (!state.buffs) state.buffs = {};
        state.buffs.expPct = (state.buffs.expPct || 0) + 50;
        state.buffs.expPctTimer = (state.buffs.expPctTimer || 0) + 5 * 60 * 1000;
      },
    },
  ];

  // 特殊掉落物品（随机高品质装备，带词缀）
  const MYSTERY_ITEMS = [
    {
      id: "mystery_weapon",
      name: "??? Mysterious Weapon",
      desc: "Random Epic/Legendary weapon with affixes",
      goldCost: (lvl) => Math.floor(2000 + lvl * 200),
      create() {
        const weapons = ["steel_sword", "desert_blade", "shadow_blade", "lords_sword"];
        const tplId = weapons[Math.floor(Math.random() * weapons.length)];
        return Equipment.createItem(tplId, true, true, false);
      },
    },
    {
      id: "mystery_armor",
      name: "??? Mysterious Armor",
      desc: "Random Epic/Legendary armor piece with affixes",
      goldCost: (lvl) => Math.floor(1500 + lvl * 150),
      create() {
        const armors = ["steel_helmet", "shadow_helm", "obsidian_armor", "steel_legs", "shadow_legs"];
        const tplId = armors[Math.floor(Math.random() * armors.length)];
        return Equipment.createItem(tplId, true, true, false);
      },
    },
    {
      id: "mystery_accessory",
      name: "??? Mysterious Ring/Neck",
      desc: "Random Epic/Legendary ring or necklace with affixes",
      goldCost: (lvl) => Math.floor(1800 + lvl * 180),
      create() {
        const accs = ["magic_ring", "lords_ring", "sand_amulet", "shadow_pendant"];
        const tplId = accs[Math.floor(Math.random() * accs.length)];
        return Equipment.createItem(tplId, true, true, false);
      },
    },
  ];

  // ─────────────────────────────────────────
  // 生成当前库存
  // ─────────────────────────────────────────

  /**
   * 随机选出 4 件商品（2 件 buff 卷轴 + 1 件神秘装备 + 1 件额外随机）
   */
  function _generateStock() {
    const state = State.get();
    const lvl = state.hero.level;

    const items = [];

    // 随机 2 件 buff 卷轴
    const shuffledBuffs = [...BUFF_SCROLLS].sort(() => Math.random() - 0.5);
    items.push(
      _makeScrollEntry(shuffledBuffs[0], lvl),
      _makeScrollEntry(shuffledBuffs[1], lvl),
    );

    // 1 件神秘装备
    const mystItem = MYSTERY_ITEMS[Math.floor(Math.random() * MYSTERY_ITEMS.length)];
    items.push(_makeMysteryEntry(mystItem, lvl));

    // 第 4 件：50% buff / 50% 装备
    if (Math.random() < 0.5) {
      items.push(_makeScrollEntry(shuffledBuffs[2], lvl));
    } else {
      const another = MYSTERY_ITEMS[Math.floor(Math.random() * MYSTERY_ITEMS.length)];
      items.push(_makeMysteryEntry(another, lvl));
    }

    return items;
  }

  function _makeScrollEntry(scrollDef, lvl) {
    return {
      type: "scroll",
      id: scrollDef.id,
      name: scrollDef.name,
      desc: scrollDef.desc,
      cost: scrollDef.goldCost(lvl),
      _def: scrollDef,
    };
  }

  function _makeMysteryEntry(mystDef, lvl) {
    // 先生成物品实例，便于 tooltip 预览
    const item = window.Equipment ? mystDef.create() : null;
    return {
      type: "mystery",
      id: mystDef.id,
      name: mystDef.name,
      desc: mystDef.desc,
      cost: mystDef.goldCost(lvl),
      item,          // 预生成的物品
      _def: mystDef,
    };
  }

  // ─────────────────────────────────────────
  // 公开 API
  // ─────────────────────────────────────────

  function refresh() {
    currentStock = _generateStock();
    refreshTimer = REFRESH_INTERVAL;
    if (window.UI) {
      UI.addLog(">> 🕵 BLACK MARKET refreshed! New goods available.", "yellow");
      UI.markSidePanelDirty();
    }
  }

  /**
   * 购买黑市商品（idx = currentStock 下标）
   */
  function buy(idx) {
    const entry = currentStock[idx];
    if (!entry) return;

    const state = State.get();
    if (state.hero.gold < entry.cost) {
      if (window.UI) UI.addLog(`>> Need ${Utils.formatNum(entry.cost)}g. (Have ${Utils.formatNum(state.hero.gold)}g)`, "red");
      return;
    }
    state.hero.gold -= entry.cost;

    if (entry.type === "scroll") {
      entry._def.apply(state);
      if (window.UI) UI.addLog(`>> [BLACK MARKET] Purchased ${entry.name}! Buff activated. (-${Utils.formatNum(entry.cost)}g)`, "yellow");
    } else if (entry.type === "mystery") {
      const item = entry.item || entry._def.create();
      if (state.inventory.length >= 20) {
        const price = Math.floor(item.sellPrice / 2);
        state.hero.gold += price;
        if (window.UI) UI.addLog(`>> [BLACK MARKET] Inventory full. Auto-sold ${item.name} for ${price}g.`, "gray");
      } else {
        state.inventory.push(item);
        if (window.UI) UI.addLog(`>> [BLACK MARKET] Purchased ${item.name} [${item.rarity.toUpperCase()}]! (-${Utils.formatNum(entry.cost)}g)`, "yellow");
      }
    }

    // 购买后该槽变为 sold
    currentStock[idx] = { type: "sold", name: "-- SOLD --", cost: 0 };
    if (window.UI) UI.markSidePanelDirty();
  }

  /**
   * tick（由 main.js 的游戏循环调用）
   * delta: ms 时间步长
   */
  function tick(delta) {
    refreshTimer -= delta;
    if (refreshTimer <= 0) {
      refresh();
    }

    // 衰减 buff 计时器
    _tickBuffs(delta);
  }

  /**
   * 衰减临时 buff 计时器，到期则清零对应 buff
   */
  function _tickBuffs(delta) {
    const state = State.get();
    if (!state.buffs) return;
    const b = state.buffs;

    function decayTimer(timerKey, ...statKeys) {
      if ((b[timerKey] || 0) <= 0) return;
      b[timerKey] -= delta;
      if (b[timerKey] <= 0) {
        b[timerKey] = 0;
        statKeys.forEach(k => { b[k] = 0; });
        if (window.UI) UI.addLog(`>> [BUFF] Buff expired.`, "gray");
        if (window.UI) UI.markSidePanelDirty();
      }
    }

    decayTimer("atkPctTimer", "atkPct");
    decayTimer("defPctTimer", "defPct");
    decayTimer("spdAddTimer", "spdAdd");
    decayTimer("luckTimer",   "goldPct", "dropPct");
    decayTimer("regenTimer",  "hprAdd", "mprAdd");
    decayTimer("expPctTimer", "expPct");
  }

  /**
   * 获取当前库存
   */
  function getStock() { return currentStock; }

  /**
   * 获取倒计时剩余（秒）
   */
  function getRefreshCountdown() { return Math.max(0, Math.ceil(refreshTimer / 1000)); }

  /**
   * 初始化时生成第一批库存
   */
  function init() {
    currentStock = _generateStock();
  }

  return {
    init,
    tick,
    refresh,
    buy,
    getStock,
    getRefreshCountdown,
    BUFF_SCROLLS,
    MYSTERY_ITEMS,
  };
})();

window.BlackMarket = BlackMarket;
