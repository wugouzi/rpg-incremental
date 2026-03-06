// test-money-sink.js — 金币消耗三系统测试
// 覆盖：Reforge（装备洗练）/ Training Room（属性训练）/ Black Market（黑市商店 & buff）

// ─────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────

function makeTestItem(slot, rarity, affixes) {
  return {
    instanceId: Date.now() + Math.random(),
    name: "Test Item",
    slot: slot,
    rarity: rarity,
    stats: { atk: 10 },
    affixes: affixes || [],
    enhanceLevel: 0,
    sellPrice: 50,
  };
}

function freshSinkState(gold) {
  State.reset();
  const s = State.get();
  s.hero.gold = gold || 0;
  return s;
}

// ─────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// A. 装备洗练（Reforge）
// ══════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────

describe("[装备洗练 Reforge — 基础功能]", () => {
  it("REFORGE_COST 常量存在且四个品质都有定义", () => {
    const cost = Equipment.REFORGE_COST;
    assert.ok(cost && typeof cost === "object", "REFORGE_COST 应该是对象");
    assert.ok(cost.common    > 0, "common 洗练费用应 > 0");
    assert.ok(cost.rare      > 0, "rare 洗练费用应 > 0");
    assert.ok(cost.epic      > 0, "epic 洗练费用应 > 0");
    assert.ok(cost.legendary > 0, "legendary 洗练费用应 > 0");
    assert.ok(cost.legendary > cost.epic && cost.epic > cost.rare && cost.rare > cost.common,
      "费用应该 legendary > epic > rare > common");
  });

  it("reforge 函数在 Equipment 上存在", () => {
    assert.ok(typeof Equipment.reforge === "function", "Equipment.reforge 应为函数");
  });

  it("金币不足时拒绝洗练，不消耗金币", () => {
    const state = freshSinkState(100);  // 只有 100g，远低于 500g
    const item = makeTestItem("weapon", "common");
    state.inventory.push(item);
    Equipment.reforge(item);
    assert.equal(state.hero.gold, 100, "金币不足时不应扣金");
  });

  it("成功洗练扣除正确金额（common → 500g）", () => {
    const state = freshSinkState(1000);
    const item = makeTestItem("weapon", "common");
    state.inventory.push(item);
    Equipment.reforge(item);
    assert.equal(state.hero.gold, 500, "应扣除 500g（common 洗练费）");
  });

  it("洗练后 common 装备升为 rare", () => {
    const state = freshSinkState(1000);
    const item = makeTestItem("weapon", "common");
    state.inventory.push(item);
    Equipment.reforge(item);
    assert.equal(item.rarity, "rare", "common 洗练后应升为 rare");
  });

  it("rare 装备洗练费为 1500g", () => {
    const state = freshSinkState(5000);
    const item = makeTestItem("weapon", "rare");
    state.inventory.push(item);
    Equipment.reforge(item);
    assert.equal(state.hero.gold, 3500, "应扣除 1500g（rare 洗练费）");
  });

  it("legendary 装备洗练费为 20000g", () => {
    const state = freshSinkState(30000);
    const item = makeTestItem("weapon", "legendary");
    state.inventory.push(item);
    Equipment.reforge(item);
    assert.equal(state.hero.gold, 10000, "应扣除 20000g（legendary 洗练费）");
  });

  it("洗练后词缀数量符合品质要求（rare >= 1）", () => {
    const state = freshSinkState(5000);
    const item = makeTestItem("weapon", "rare");
    state.inventory.push(item);
    Equipment.reforge(item);
    // rare 至少 1 个词缀
    assert.ok(item.affixes.length >= 1, "rare 洗练后应有至少 1 个词缀");
  });

  it("洗练后词缀都来自适合该槽位的词缀池", () => {
    const state = freshSinkState(10000);
    const item = makeTestItem("ring", "epic");
    state.inventory.push(item);
    Equipment.reforge(item);
    const ringAffixes = Equipment.AFFIX_POOL.filter(a => a.slots.includes("ring"));
    const ringAffixIds = new Set(ringAffixes.map(a => a.id));
    item.affixes.forEach(a => {
      assert.ok(ringAffixIds.has(a.id), `词缀 ${a.id} 应适用于 ring 槽`);
    });
  });

  it("对已装备物品也可洗练", () => {
    const state = freshSinkState(5000);
    const item = makeTestItem("weapon", "rare");
    state.equipment.weapon = item;
    Equipment.reforge(item);
    assert.equal(state.hero.gold, 3500, "装备槽物品洗练应扣 1500g");
  });

  it("物品不在背包也不在装备槽时，不扣金", () => {
    const state = freshSinkState(5000);
    const phantom = makeTestItem("weapon", "rare");
    // 不放入背包或装备槽
    Equipment.reforge(phantom);
    assert.equal(state.hero.gold, 5000, "找不到物品时不应扣金");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// B. 属性训练（Training Room）
// ══════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────

describe("[属性训练 Training Room — 基础功能]", () => {
  it("State.train 函数存在", () => {
    assert.ok(typeof State.train === "function", "State.train 应为函数");
  });

  it("State.getTrainCost 函数存在", () => {
    assert.ok(typeof State.getTrainCost === "function", "State.getTrainCost 应为函数");
  });

  it("初始训练费用 atk=300, def=200, hp=150, spd=1000", () => {
    State.reset();
    assert.equal(State.getTrainCost("atk"), 300, "ATK 初始训练费 300");
    assert.equal(State.getTrainCost("def"), 200, "DEF 初始训练费 200");
    assert.equal(State.getTrainCost("hp"),  150, "HP 初始训练费 150");
    assert.equal(State.getTrainCost("spd"), 1000, "SPD 初始训练费 1000");
  });

  it("训练费用随训练次数指数增长（倍率约 1.6）", () => {
    State.reset();
    const cost0 = State.getTrainCost("atk"); // 300
    const s = State.get();
    s.hero.gold = 100000;
    if (!s.training) s.training = { atk: 0, def: 0, hp: 0, spd: 0 };
    State.train("atk");
    const cost1 = State.getTrainCost("atk");
    assert.ok(cost1 > cost0, "训练后费用应增加");
    // cost1 = 300 * 1.6 = 480
    assert.ok(Math.abs(cost1 / cost0 - 1.6) < 0.01, "每次训练费用倍率应约为 1.6");
  });

  it("金币不足时拒绝训练", () => {
    State.reset();
    const s = State.get();
    s.hero.gold = 10;
    const atkBefore = s.hero.baseAtk;
    State.train("atk");
    assert.equal(s.hero.baseAtk, atkBefore, "金币不足时 ATK 不应变化");
    assert.equal(s.hero.gold, 10, "金币不应被扣除");
  });

  it("训练 ATK +1 并扣除费用（300g）", () => {
    State.reset();
    const s = State.get();
    s.hero.gold = 1000;
    const atkBefore = s.hero.baseAtk;
    State.train("atk");
    assert.equal(s.hero.baseAtk, atkBefore + 1, "ATK 应 +1");
    assert.equal(s.hero.gold, 700, "应扣除 300g");
  });

  it("训练 DEF +1 并扣除费用（200g）", () => {
    State.reset();
    const s = State.get();
    s.hero.gold = 1000;
    const defBefore = s.hero.baseDef;
    State.train("def");
    assert.equal(s.hero.baseDef, defBefore + 1, "DEF 应 +1");
    assert.equal(s.hero.gold, 800, "应扣除 200g");
  });

  it("训练 HP +5 并扣除费用（150g）", () => {
    State.reset();
    const s = State.get();
    s.hero.gold = 1000;
    const hpBefore = s.hero.baseMaxHp;
    State.train("hp");
    assert.equal(s.hero.baseMaxHp, hpBefore + 5, "MaxHP 应 +5");
    assert.equal(s.hero.gold, 850, "应扣除 150g");
  });

  it("训练 SPD +0.05 并扣除费用（1000g）", () => {
    State.reset();
    const s = State.get();
    s.hero.gold = 2000;
    const spdBefore = s.hero.baseSpd;
    State.train("spd");
    assert.ok(Math.abs(s.hero.baseSpd - (spdBefore + 0.05)) < 0.001, "SPD 应 +0.05");
    assert.equal(s.hero.gold, 1000, "应扣除 1000g");
  });

  it("训练次数被记录在 state.training 中", () => {
    State.reset();
    const s = State.get();
    s.hero.gold = 10000;
    State.train("atk");
    State.train("atk");
    assert.equal(s.training.atk, 2, "训练 atk 两次后计数应为 2");
  });

  it("无效训练属性不扣金也不出错", () => {
    State.reset();
    const s = State.get();
    s.hero.gold = 1000;
    // 不应抛出异常（直接调用，不应 throw）
    let threw = false;
    try {
      State.train("invalid_stat");
    } catch(e) {
      threw = true;
    }
    assert.ok(!threw, "无效属性不应抛出异常");
    assert.equal(s.hero.gold, 1000, "无效属性训练不扣金");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// C. 黑市商店（Black Market）
// ══════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────

describe("[黑市商店 Black Market — 模块存在性]", () => {
  it("BlackMarket 对象存在", () => {
    assert.ok(typeof BlackMarket !== "undefined", "BlackMarket 全局对象应存在");
  });

  it("BlackMarket.init 函数存在", () => {
    assert.ok(typeof BlackMarket.init === "function", "BlackMarket.init 应为函数");
  });

  it("BlackMarket.buy 函数存在", () => {
    assert.ok(typeof BlackMarket.buy === "function", "BlackMarket.buy 应为函数");
  });

  it("BlackMarket.getStock 函数存在", () => {
    assert.ok(typeof BlackMarket.getStock === "function", "BlackMarket.getStock 应为函数");
  });

  it("BlackMarket.getRefreshCountdown 函数存在", () => {
    assert.ok(typeof BlackMarket.getRefreshCountdown === "function", "BlackMarket.getRefreshCountdown 应为函数");
  });

  it("BUFF_SCROLLS 为非空数组", () => {
    assert.ok(Array.isArray(BlackMarket.BUFF_SCROLLS) && BlackMarket.BUFF_SCROLLS.length > 0,
      "BUFF_SCROLLS 应为非空数组");
  });

  it("MYSTERY_ITEMS 为非空数组", () => {
    assert.ok(Array.isArray(BlackMarket.MYSTERY_ITEMS) && BlackMarket.MYSTERY_ITEMS.length > 0,
      "MYSTERY_ITEMS 应为非空数组");
  });
});

describe("[黑市商店 Black Market — 初始化和库存]", () => {
  it("init() 后生成 4 件商品", () => {
    State.reset();
    BlackMarket.init();
    const stock = BlackMarket.getStock();
    assert.equal(stock.length, 4, "黑市初始化后应有 4 件商品");
  });

  it("所有商品都有 name, cost, type 字段", () => {
    State.reset();
    BlackMarket.init();
    const stock = BlackMarket.getStock();
    stock.forEach((entry, i) => {
      assert.ok(entry.name, `商品 ${i} 应有 name`);
      assert.ok(entry.type, `商品 ${i} 应有 type`);
      assert.ok(entry.cost >= 0, `商品 ${i} 的 cost 应 >= 0`);
    });
  });

  it("商品类型只有 scroll 或 mystery", () => {
    State.reset();
    BlackMarket.init();
    const stock = BlackMarket.getStock();
    stock.forEach(entry => {
      assert.ok(["scroll", "mystery"].includes(entry.type),
        `商品类型应为 scroll 或 mystery，得到 ${entry.type}`);
    });
  });

  it("初始化后倒计时约为 180 秒（3分钟）", () => {
    State.reset();
    BlackMarket.init();
    const countdown = BlackMarket.getRefreshCountdown();
    assert.ok(countdown > 170 && countdown <= 180,
      `初始倒计时应接近 180，实际 ${countdown}`);
  });
});

describe("[黑市商店 Black Market — 购买功能]", () => {
  it("金币不足时拒绝购买", () => {
    State.reset();
    BlackMarket.init();
    const s = State.get();
    s.hero.gold = 0;
    BlackMarket.buy(0);
    assert.equal(s.hero.gold, 0, "金币不足时不应扣金");
  });

  it("购买 scroll 后扣除正确金额", () => {
    State.reset();
    BlackMarket.init();
    const s = State.get();
    s.hero.gold = 99999;

    // 找第一个 scroll 类型商品
    const stock = BlackMarket.getStock();
    const idx = stock.findIndex(e => e.type === "scroll");
    if (idx < 0) { return; } // 无 scroll 则跳过
    const cost = stock[idx].cost;
    BlackMarket.buy(idx);
    assert.equal(s.hero.gold, 99999 - cost, `购买 scroll 后应扣除 ${cost}g`);
  });

  it("购买后该槽变为 sold", () => {
    State.reset();
    BlackMarket.init();
    const s = State.get();
    s.hero.gold = 99999;
    BlackMarket.buy(0);
    const stock = BlackMarket.getStock();
    assert.equal(stock[0].type, "sold", "购买后该槽应变为 sold");
  });

  it("scroll_luck 的 apply 会设置 buffs.goldPct 和 buffs.dropPct", () => {
    State.reset();
    const s = State.get();
    const scrollDef = BlackMarket.BUFF_SCROLLS.find(b => b.id === "scroll_luck");
    assert.ok(scrollDef, "scroll_luck 应在 BUFF_SCROLLS 中");
    scrollDef.apply(s);
    assert.ok(s.buffs && s.buffs.goldPct > 0, "使用 scroll_luck 后 buffs.goldPct 应 > 0");
    assert.ok(s.buffs && s.buffs.dropPct > 0, "使用 scroll_luck 后 buffs.dropPct 应 > 0");
  });

  it("购买 mystery 装备后背包增加物品（或自动出售）", () => {
    State.reset();
    BlackMarket.init();
    const s = State.get();
    s.hero.gold = 99999;
    const invLenBefore = s.inventory.length;
    const goldBefore = s.hero.gold;
    // 找一件 mystery 商品
    const stock = BlackMarket.getStock();
    const idx = stock.findIndex(e => e.type === "mystery");
    if (idx < 0) { return; } // 无 mystery 则跳过
    const cost = stock[idx].cost;
    BlackMarket.buy(idx);
    const invLenAfter = s.inventory.length;
    const goldAfter = s.hero.gold;
    // 背包有增加 OR 金币减少了（说明购买发生了，但可能自动出售）
    assert.ok(invLenAfter > invLenBefore || goldAfter < goldBefore,
      "购买 mystery 后背包应增加物品或发生消费");
  });
});

describe("[黑市商店 Black Market — buff 衰减]", () => {
  it("tick 后 buff 计时器递减", () => {
    State.reset();
    const s = State.get();
    if (!s.buffs) s.buffs = {};
    s.buffs.atkPct = 30;
    s.buffs.atkPctTimer = 5000; // 5秒
    BlackMarket.tick(1000);
    assert.ok(s.buffs.atkPctTimer < 5000, "tick 1000ms 后 atkPctTimer 应减少");
  });

  it("计时器到零后 buff 属性清零", () => {
    State.reset();
    const s = State.get();
    if (!s.buffs) s.buffs = {};
    s.buffs.atkPct = 30;
    s.buffs.atkPctTimer = 100; // 0.1秒
    BlackMarket.tick(200); // 超过计时
    assert.equal(s.buffs.atkPct, 0, "计时结束后 atkPct 应清零");
    assert.equal(s.buffs.atkPctTimer, 0, "计时结束后 atkPctTimer 应为 0");
  });

  it("tick 超过刷新周期后倒计时重置", () => {
    State.reset();
    BlackMarket.init();
    BlackMarket.tick(180001); // 超过 3 分钟刷新周期
    const countdown = BlackMarket.getRefreshCountdown();
    // 刷新后应重置倒计时
    assert.ok(countdown > 170, `刷新后倒计时应接近 180，实际 ${countdown}`);
  });
});

describe("[黑市 buff — 影响派生属性]", () => {
  it("atkPct buff 使 getTotalAtk 提升", () => {
    State.reset();
    const s = State.get();
    const atkBefore = State.getTotalAtk();
    if (!s.buffs) s.buffs = {};
    s.buffs.atkPct = 30;
    s.buffs.atkPctTimer = 60000;
    const atkAfter = State.getTotalAtk();
    assert.ok(atkAfter > atkBefore, "atkPct buff 应提升 getTotalAtk");
  });

  it("atkPct=30 时 ATK 高于无 buff 时的 1.2 倍（Math.floor 有精度截断）", () => {
    State.reset();
    const s = State.get();
    const atkBefore = State.getTotalAtk();
    if (!s.buffs) s.buffs = {};
    s.buffs.atkPct = 30;
    s.buffs.atkPctTimer = 60000;
    const atkAfter = State.getTotalAtk();
    const ratio = atkAfter / atkBefore;
    // 因 Math.floor 截断，允许区间 [1.2, 1.35]
    assert.ok(ratio >= 1.2 && ratio <= 1.35,
      `ATK 倍率应约在 [1.2, 1.35]（含 floor 误差），实际 ${ratio.toFixed(3)}`);
  });

  it("defPct buff 使 getTotalDef 提升", () => {
    State.reset();
    const s = State.get();
    const defBefore = State.getTotalDef();
    if (!s.buffs) s.buffs = {};
    s.buffs.defPct = 40;
    s.buffs.defPctTimer = 60000;
    const defAfter = State.getTotalDef();
    assert.ok(defAfter > defBefore, "defPct buff 应提升 getTotalDef");
  });

  it("spdAdd buff 使 getTotalSpd 提升 0.4", () => {
    State.reset();
    const s = State.get();
    const spdBefore = State.getTotalSpd();
    if (!s.buffs) s.buffs = {};
    s.buffs.spdAdd = 0.4;
    s.buffs.spdAddTimer = 60000;
    const spdAfter = State.getTotalSpd();
    assert.ok(Math.abs(spdAfter - (spdBefore + 0.4)) < 0.001,
      `spdAdd buff 应增加 getTotalSpd 0.4，实际差值 ${(spdAfter - spdBefore).toFixed(3)}`);
  });

  it("hprAdd buff 使 getTotalHpr 提升 15", () => {
    State.reset();
    const s = State.get();
    const hprBefore = State.getTotalHpr();
    if (!s.buffs) s.buffs = {};
    s.buffs.hprAdd = 15;
    s.buffs.regenTimer = 60000;
    const hprAfter = State.getTotalHpr();
    assert.equal(hprAfter, hprBefore + 15, "hprAdd buff 应提升 getTotalHpr 15");
  });

  it("mprAdd buff 使 getTotalMpr 提升 8", () => {
    State.reset();
    const s = State.get();
    const mprBefore = State.getTotalMpr();
    if (!s.buffs) s.buffs = {};
    s.buffs.mprAdd = 8;
    s.buffs.regenTimer = 60000;
    const mprAfter = State.getTotalMpr();
    assert.equal(mprAfter, mprBefore + 8, "mprAdd buff 应提升 getTotalMpr 8");
  });

  it("无激活 buff 时 getBuffBonus 全部为 0", () => {
    State.reset();
    const s = State.get();
    s.buffs = {};
    const buf = State.getBuffBonus();
    assert.equal(buf.atkPct, 0, "无 buff 时 atkPct 应为 0");
    assert.equal(buf.defPct, 0, "无 buff 时 defPct 应为 0");
    assert.equal(buf.spdAdd, 0, "无 buff 时 spdAdd 应为 0");
    assert.equal(buf.goldPct, 0, "无 buff 时 goldPct 应为 0");
    assert.equal(buf.dropPct, 0, "无 buff 时 dropPct 应为 0");
    assert.equal(buf.expPct, 0, "无 buff 时 expPct 应为 0");
  });
});
