// test-equipment.js — Equipment 模块测试

describe("Equipment.ITEM_TEMPLATES 数据完整性", () => {
  it("模板不为空", () => {
    assert.ok(Equipment.ITEM_TEMPLATES.length > 0);
  });

  it("每个模板包含必要字段", () => {
    Equipment.ITEM_TEMPLATES.forEach(t => {
      assert.ok(t.id,     `缺少 id`);
      assert.ok(t.name,   `${t.id} 缺少 name`);
      assert.ok(t.slot,   `${t.id} 缺少 slot`);
      assert.ok(t.rarity, `${t.id} 缺少 rarity`);
      assert.ok(t.stats,  `${t.id} 缺少 stats`);
      assert.ok(t.buyPrice >= 0, `${t.id} buyPrice 应 >= 0`);
      assert.ok(t.sellPrice >= 0, `${t.id} sellPrice 应 >= 0`);
    });
  });

  it("slot 只有合法值", () => {
    const validSlots = ["weapon", "helmet", "chest", "legs", "ring", "neck"];
    Equipment.ITEM_TEMPLATES.forEach(t => {
      assert.includes(validSlots, t.slot, `${t.id} slot 值 "${t.slot}" 不合法`);
    });
  });

  it("rarity 只有合法值", () => {
    const validRarities = ["common", "rare", "epic", "legendary"];
    Equipment.ITEM_TEMPLATES.forEach(t => {
      assert.includes(validRarities, t.rarity, `${t.id} rarity "${t.rarity}" 不合法`);
    });
  });

  it("sellPrice <= buyPrice（不能卖出比买入更贵）", () => {
    Equipment.ITEM_TEMPLATES.forEach(t => {
      if (t.buyPrice > 0) {
        assert.lessThan(t.sellPrice, t.buyPrice + 1,
          `${t.id} sellPrice(${t.sellPrice}) > buyPrice(${t.buyPrice})`);
      }
    });
  });
});

describe("Equipment.createItem", () => {
  it("从模板创建物品实例", () => {
    const item = Equipment.createItem("iron_sword");
    assert.ok(item, "应返回物品");
    assert.equal(item.id, "iron_sword");
    assert.equal(item.enhanceLevel, 0);
    assert.ok(item.instanceId !== undefined, "应有 instanceId");
  });

  it("每次创建的 instanceId 不同", () => {
    const a = Equipment.createItem("iron_sword");
    const b = Equipment.createItem("iron_sword");
    assert.notEqual(a.instanceId, b.instanceId);
  });

  it("stats 是独立副本（修改不影响模板）", () => {
    const item = Equipment.createItem("iron_sword");
    const origAtk = Equipment.TEMPLATE_MAP["iron_sword"].stats.atk;
    item.stats.atk = 9999;
    assert.equal(Equipment.TEMPLATE_MAP["iron_sword"].stats.atk, origAtk, "模板 stats 不应被修改");
  });

  it("不存在的 id 返回 null", () => {
    assert.equal(Equipment.createItem("fake_id"), null);
  });
});

describe("Equipment.equip", () => {
  it("将物品装备到对应槽位", () => {
    State.reset();
    const item = Equipment.createItem("iron_sword");
    State.get().inventory.push(item);
    Equipment.equip(item);
    assert.equal(State.get().equipment.weapon, item, "武器槽应有该物品");
    assert.equal(State.get().inventory.length, 0, "背包应清空该物品");
  });

  it("旧装备被换下时放入背包", () => {
    State.reset();
    const old = Equipment.createItem("wooden_sword");
    const newItem = Equipment.createItem("iron_sword");
    State.get().equipment.weapon = old;
    State.get().inventory.push(newItem);
    Equipment.equip(newItem);
    assert.equal(State.get().equipment.weapon.id, "iron_sword");
    assert.equal(State.get().inventory.length, 1, "旧装备应进入背包");
    assert.equal(State.get().inventory[0].id, "wooden_sword");
  });
});

describe("Equipment.unequip", () => {
  it("卸下装备到背包", () => {
    State.reset();
    const item = Equipment.createItem("iron_sword");
    State.get().equipment.weapon = item;
    Equipment.unequip("weapon");
    assert.equal(State.get().equipment.weapon, null, "武器槽应为 null");
    assert.equal(State.get().inventory.length, 1, "物品应在背包中");
    assert.equal(State.get().inventory[0].id, "iron_sword");
  });

  it("卸下空槽不报错", () => {
    State.reset();
    // 不应抛出异常
    Equipment.unequip("weapon");
    assert.equal(State.get().equipment.weapon, null);
  });

  it("背包满时无法卸下", () => {
    State.reset();
    const s = State.get();
    s.equipment.weapon = Equipment.createItem("iron_sword");
    // 填满背包（20格）
    for (let i = 0; i < 20; i++) {
      s.inventory.push(Equipment.createItem("leather_cap"));
    }
    Equipment.unequip("weapon");
    // 背包满，卸下应失败，武器槽仍有物品
    assert.notEqual(s.equipment.weapon, null, "背包满时应无法卸下");
  });
});

describe("Equipment.sell", () => {
  it("出售物品获得金币并从背包移除", () => {
    State.reset();
    const item = Equipment.createItem("iron_sword");
    State.get().inventory.push(item);
    Equipment.sell(item);
    assert.equal(State.get().inventory.length, 0, "物品应从背包移除");
    assert.greaterThan(State.get().hero.gold, 0, "应获得金币");
    assert.equal(State.get().hero.gold, item.sellPrice, "金币应等于 sellPrice");
  });

  it("强化过的物品卖价更高", () => {
    State.reset();
    const item1 = Equipment.createItem("iron_sword");
    const item2 = Equipment.createItem("iron_sword");
    item2.enhanceLevel = 5;

    State.get().inventory.push(item1);
    Equipment.sell(item1);
    const gold1 = State.get().hero.gold;

    State.reset();
    State.get().inventory.push(item2);
    Equipment.sell(item2);
    const gold2 = State.get().hero.gold;

    assert.greaterThan(gold2, gold1, "强化物品卖价应更高");
  });
});

describe("Equipment.enhance", () => {
  it("消耗金币提升 enhanceLevel", () => {
    State.reset();
    const item = Equipment.createItem("iron_sword");
    State.get().inventory.push(item);
    State.get().hero.gold = 10000;
    Equipment.enhance(item);
    assert.equal(item.enhanceLevel, 1, "强化后 enhanceLevel 应为 1");
    assert.lessThan(State.get().hero.gold, 10000, "应扣除金币");
  });

  it("金币不足时强化失败", () => {
    State.reset();
    const item = Equipment.createItem("iron_sword");
    State.get().inventory.push(item);
    State.get().hero.gold = 0;
    Equipment.enhance(item);
    assert.equal(item.enhanceLevel, 0, "金币不足时 enhanceLevel 不变");
  });

  it("强化上限 +10", () => {
    State.reset();
    const item = Equipment.createItem("iron_sword");
    item.enhanceLevel = 10;
    State.get().inventory.push(item);
    State.get().hero.gold = 999999;
    Equipment.enhance(item);
    assert.equal(item.enhanceLevel, 10, "达到上限后不应继续强化");
  });
});

describe("Equipment.buy", () => {
  it("购买物品放入背包", () => {
    State.reset();
    State.get().hero.gold = 1000;
    Equipment.buy("wooden_sword");
    assert.equal(State.get().inventory.length, 1);
    assert.equal(State.get().inventory[0].id, "wooden_sword");
    assert.lessThan(State.get().hero.gold, 1000, "应扣除金币");
  });

  it("金币不足无法购买", () => {
    State.reset();
    State.get().hero.gold = 0;
    Equipment.buy("wooden_sword");
    assert.equal(State.get().inventory.length, 0, "金币不足时不应购买成功");
    assert.equal(State.get().hero.gold, 0, "金币不应变化");
  });

  it("背包满时无法购买", () => {
    State.reset();
    State.get().hero.gold = 99999;
    for (let i = 0; i < 20; i++) {
      State.get().inventory.push(Equipment.createItem("leather_cap"));
    }
    Equipment.buy("wooden_sword");
    assert.equal(State.get().inventory.length, 20, "背包满时不应购买成功");
  });
});

describe("Equipment.getShopItems", () => {
  it("初始只显示 plains 区域物品", () => {
    State.reset();
    const items = Equipment.getShopItems();
    items.forEach(t => {
      assert.equal(t.zone, "plains", `初始商店不应包含 ${t.zone} 区域物品`);
    });
  });

  it("解锁 forest 后商店增加对应物品", () => {
    State.reset();
    Zones.onBossDefeated("plains"); // 解锁 forest
    const items = Equipment.getShopItems();
    const hasForest = items.some(t => t.zone === "forest");
    assert.ok(hasForest, "解锁 forest 后商店应有 forest 物品");
    State.reset();
  });

  it("buyPrice=0 的物品不出现在商店", () => {
    State.reset();
    const items = Equipment.getShopItems();
    items.forEach(t => {
      assert.greaterThan(t.buyPrice, 0, `${t.id} buyPrice=0 不应在商店中`);
    });
  });
});

describe("Equipment.getRarityColor / getRarityLabel", () => {
  it("common 返回 white", () => {
    assert.equal(Equipment.getRarityColor("common"), "white");
  });

  it("epic 返回 yellow", () => {
    assert.equal(Equipment.getRarityColor("epic"), "yellow");
  });

  it("legendary 返回 red", () => {
    assert.equal(Equipment.getRarityColor("legendary"), "red");
  });

  it("未知 rarity 回退到 common", () => {
    assert.equal(Equipment.getRarityColor("unknown"), "white");
  });
});

describe("Equipment.addToInventory", () => {
  it("正常添加到背包", () => {
    State.reset();
    const item = Equipment.createItem("iron_sword");
    Equipment.addToInventory(item);
    assert.equal(State.get().inventory.length, 1);
  });

  it("背包满时自动出售（获得半价）", () => {
    State.reset();
    const s = State.get();
    for (let i = 0; i < 20; i++) {
      s.inventory.push(Equipment.createItem("leather_cap"));
    }
    const item = Equipment.createItem("iron_sword");
    Equipment.addToInventory(item);
    assert.equal(s.inventory.length, 20, "背包不应超过20格");
    // 自动出售获得金币
    const halfPrice = Math.floor(item.sellPrice / 2);
    assert.equal(s.hero.gold, halfPrice, "背包满时应获得自动出售金币");
  });
});

describe("Equipment.createItem — 随机属性浮动", () => {
  it("商店模式（rollStats=false）：atk 为固定值", () => {
    // iron_sword 模板 atk=28，common statMult=1.0 → 固定 28
    const item = Equipment.createItem("iron_sword", false, false);
    assert.equal(item.stats.atk, 28, "商店模式属性应固定");
  });

  it("掉落模式（rollStats=true）：atk 在 [22, 34] 范围内（28 × ±20%）", () => {
    // 多次创建，确保值在范围内且有波动
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < 50; i++) {
      const item = Equipment.createItem("iron_sword", false, true, false);
      min = Math.min(min, item.stats.atk);
      max = Math.max(max, item.stats.atk);
    }
    // base=28, ±20% → [floor(22.4)=22, ceil(33.6)=34]
    assert.greaterThan(min, 21, "随机 atk 下限应 >= 22");
    assert.lessThan(max, 35, "随机 atk 上限应 <= 34");
  });

  it("掉落模式多次创建，值应有差异（概率测试，50次必有不同）", () => {
    const vals = new Set();
    for (let i = 0; i < 50; i++) {
      const item = Equipment.createItem("iron_sword", false, true, false);
      vals.add(item.stats.atk);
    }
    assert.greaterThan(vals.size, 1, "50次创建应出现多个不同 atk 值");
  });

  it("商店模式每次 atk 相同（无随机）", () => {
    const vals = new Set();
    for (let i = 0; i < 20; i++) {
      const item = Equipment.createItem("iron_sword", false, false);
      vals.add(item.stats.atk);
    }
    assert.equal(vals.size, 1, "商店模式20次创建 atk 应全部相同");
  });

  it("epic 品质浮动范围更小（±15%）", () => {
    // shadow_blade：atk=150, epic statMult=1.3 → base=195, ±15% → [floor(165.75), ceil(224.25)]
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < 50; i++) {
      const item = Equipment.createItem("shadow_blade", false, true, false);
      min = Math.min(min, item.stats.atk);
      max = Math.max(max, item.stats.atk);
    }
    // 范围不应超过 ±20%（比 common 严）
    const base = Math.floor(150 * 1.30);
    assert.greaterThan(min, base * 0.79, "epic atk 下限应 > base×0.79");
    assert.lessThan(max, base * 1.21, "epic atk 上限应 < base×1.21");
  });
});

describe("Equipment.createItem — 品质升档（upgradeRarity）", () => {
  it("upgradeRarity=false 时品质不变", () => {
    // iron_sword 是 common，不升档
    for (let i = 0; i < 20; i++) {
      const item = Equipment.createItem("iron_sword", false, false, false);
      assert.equal(item.rarity, "common", "upgradeRarity=false 时品质应保持 common");
    }
  });

  it("upgradeRarity=true 时模板品质不被修改", () => {
    // 创建多次后模板本身的 rarity 不应变
    for (let i = 0; i < 10; i++) {
      Equipment.createItem("iron_sword", false, false, true);
    }
    assert.equal(Equipment.TEMPLATE_MAP["iron_sword"].rarity, "common", "模板品质不应被修改");
  });

  it("upgradeRarity=true 时 100 次中至少有 1 次非 common（15%+ 概率）", () => {
    let upgraded = 0;
    for (let i = 0; i < 100; i++) {
      const item = Equipment.createItem("iron_sword", false, false, true);
      if (item.rarity !== "common") upgraded++;
    }
    assert.greaterThan(upgraded, 0, "100次掉落至少应有1次品质升档");
  });

  it("upgradeRarity=true 时升档后品质合法", () => {
    const valid = ["common", "rare", "epic", "legendary"];
    for (let i = 0; i < 30; i++) {
      const item = Equipment.createItem("wooden_sword", false, false, true);
      assert.includes(valid, item.rarity, `升档后品质 "${item.rarity}" 不合法`);
    }
  });

  it("升档后词缀数量与新品质一致（rare=1, epic=2, legendary=3）", () => {
    // 强制 legendary（通过多次尝试或直接用 legendary 模板）
    // lords_sword 本身是 legendary，不会再升档
    const cfg = Equipment.RARITY_CONFIG;
    // 用 steel_sword(rare) 测试：升档到 epic 应有 2 个词缀
    for (let i = 0; i < 100; i++) {
      const item = Equipment.createItem("steel_sword", true, false, true);
      const expectedCount = cfg[item.rarity].affixCount;
      assert.equal(item.affixes.length, expectedCount,
        `${item.rarity} 品质应有 ${expectedCount} 个词缀，实际有 ${item.affixes.length}`);
    }
  });
});

describe("Equipment AFFIX_POOL — hpr/mpr 词缀", () => {
  it("AFFIX_POOL 包含 bonus_hpr 词缀", () => {
    const a = Equipment.AFFIX_POOL.find(a => a.id === "bonus_hpr");
    assert.ok(a, "AFFIX_POOL 应包含 bonus_hpr");
    assert.equal(a.stat, "hpr");
  });

  it("AFFIX_POOL 包含 bonus_mpr 词缀", () => {
    const a = Equipment.AFFIX_POOL.find(a => a.id === "bonus_mpr");
    assert.ok(a, "AFFIX_POOL 应包含 bonus_mpr");
    assert.equal(a.stat, "mpr");
  });

  it("hpr 词缀适用于 helmet/chest/legs/ring/neck", () => {
    const a = Equipment.AFFIX_POOL.find(a => a.id === "bonus_hpr");
    ["helmet", "chest", "legs", "ring", "neck"].forEach(slot => {
      assert.ok(a.slots.includes(slot), `hpr 词缀应适用于 ${slot}`);
    });
  });

  it("mpr 词缀适用于 helmet/ring/neck", () => {
    const a = Equipment.AFFIX_POOL.find(a => a.id === "bonus_mpr");
    ["helmet", "ring", "neck"].forEach(slot => {
      assert.ok(a.slots.includes(slot), `mpr 词缀应适用于 ${slot}`);
    });
  });

  it("rare 头盔 rollAffixes 可能包含 hpr 词缀", () => {
    // 多次随机，至少有一次 hpr 出现（rare = 1 词缀，helmet 候选里有 hpr）
    let found = false;
    for (let i = 0; i < 100; i++) {
      const affixes = Equipment.rollAffixes("helmet", "rare");
      if (affixes.some(a => a.stat === "hpr")) { found = true; break; }
    }
    assert.ok(found, "helmet rare 100次中应至少出现一次 hpr 词缀");
  });

  it("getItemTotalStats 正确合并 hpr 词缀", () => {
    const item = {
      stats: { def: 5 },
      affixes: [{ stat: "hpr", value: 4 }],
    };
    const total = Equipment.getItemTotalStats(item);
    assert.equal(total.hpr, 4, "hpr 词缀应被合并到 total stats");
    assert.equal(total.def, 5, "原有 def 不应变");
  });

  it("getItemTotalStats 正确合并 physRes 词缀", () => {
    const item = {
      stats: { def: 10 },
      affixes: [{ stat: "physRes", value: 8 }],
    };
    const total = Equipment.getItemTotalStats(item);
    assert.equal(total.physRes, 8, "physRes 词缀应被合并到 total stats");
  });

  it("getItemTotalStats 多词缀叠加同一 stat", () => {
    const item = {
      stats: { atk: 20 },
      affixes: [
        { stat: "fireRes", value: 5 },
        { stat: "fireRes", value: 3 },
      ],
    };
    const total = Equipment.getItemTotalStats(item);
    assert.equal(total.fireRes, 8, "同一 stat 的多个词缀应叠加");
  });
});

describe("Equipment.getItemTotalStats — diff 计算场景", () => {
  // 模拟 tooltip diff 逻辑：mine - theirs
  function calcDiff(newItem, equippedItem) {
    const myTotal  = Equipment.getItemTotalStats(newItem);
    const cmpTotal = Equipment.getItemTotalStats(equippedItem);
    const allKeys  = new Set([...Object.keys(myTotal), ...Object.keys(cmpTotal)]);
    const result = {};
    allKeys.forEach(k => {
      const mine   = myTotal[k]  || 0;
      const theirs = cmpTotal[k] || 0;
      const diff   = mine - theirs;
      if (Math.abs(diff) >= 0.001) result[k] = diff;
    });
    return result;
  }

  it("背包物品比装备更好时 diff 为正", () => {
    const newItem      = { stats: { atk: 30 }, affixes: [] };
    const equippedItem = { stats: { atk: 20 }, affixes: [] };
    const diff = calcDiff(newItem, equippedItem);
    assert.equal(diff.atk, 10, "ATK diff 应为 +10");
  });

  it("已装备物品比背包更好时 diff 为负", () => {
    const newItem      = { stats: { atk: 10 }, affixes: [] };
    const equippedItem = { stats: { atk: 25 }, affixes: [] };
    const diff = calcDiff(newItem, equippedItem);
    assert.equal(diff.atk, -15, "ATK diff 应为 -15");
  });

  it("已装备物品有 physRes 词缀而背包物品没有时，diff 为负", () => {
    const newItem      = { stats: { atk: 20 }, affixes: [] };
    const equippedItem = { stats: { atk: 15 }, affixes: [{ stat: "physRes", value: 10 }] };
    const diff = calcDiff(newItem, equippedItem);
    assert.equal(diff.physRes, -10, "physRes diff 应为 -10（已装备物品独有属性）");
    assert.equal(diff.atk, 5, "ATK diff 应为 +5");
  });

  it("背包物品有 fireRes 词缀而已装备没有时，diff 为正", () => {
    const newItem      = { stats: { def: 5 }, affixes: [{ stat: "fireRes", value: 12 }] };
    const equippedItem = { stats: { def: 8 }, affixes: [] };
    const diff = calcDiff(newItem, equippedItem);
    assert.equal(diff.fireRes, 12, "fireRes diff 应为 +12");
    assert.equal(diff.def, -3, "DEF diff 应为 -3");
  });

  it("两件物品属性完全相同时 diff 为空", () => {
    const newItem      = { stats: { atk: 20, def: 5 }, affixes: [] };
    const equippedItem = { stats: { atk: 20, def: 5 }, affixes: [] };
    const diff = calcDiff(newItem, equippedItem);
    assert.equal(Object.keys(diff).length, 0, "相同属性时 diff 应为空对象");
  });

  it("词缀叠加后参与 diff 计算", () => {
    // 背包：atk 10 + 词缀 +5atk = 总计 15
    // 装备：atk 20
    const newItem      = { stats: { atk: 10 }, affixes: [{ stat: "atk", value: 5 }] };
    const equippedItem = { stats: { atk: 20 }, affixes: [] };
    const diff = calcDiff(newItem, equippedItem);
    assert.equal(diff.atk, -5, "词缀叠加后 ATK diff 应为 -5");
  });
});

describe("Tooltip diff 格式化规则 — 百分比属性", () => {
  // 镜像 ui.js 里的格式化逻辑，确保百分比属性带 % 单位
  const PCT_STATS = new Set(["fireRes","iceRes","lightningRes","poisonRes","physRes","dropBonus","goldBonus","expBonus"]);
  function fmtDiff(k, diff) {
    const sign = diff > 0 ? "+" : "";
    if (k === "crit")          return `${sign}${(diff * 100).toFixed(1)}%`;
    if (k === "spd")           return `${sign}${diff.toFixed(2)}`;
    if (k === "hpr" || k === "mpr") return `${sign}${diff.toFixed(1)}/s`;
    if (PCT_STATS.has(k))      return `${sign}${Math.round(diff)}%`;
    return `${sign}${Math.round(diff)}`;
  }

  it("physRes 正值 diff 带 %", () => {
    assert.equal(fmtDiff("physRes", 8), "+8%");
  });

  it("physRes 负值 diff 带 %", () => {
    assert.equal(fmtDiff("physRes", -5), "-5%");
  });

  it("fireRes 正值 diff 带 %", () => {
    assert.equal(fmtDiff("fireRes", 12), "+12%");
  });

  it("iceRes 负值 diff 带 %", () => {
    assert.equal(fmtDiff("iceRes", -7), "-7%");
  });

  it("dropBonus 正值 diff 带 %", () => {
    assert.equal(fmtDiff("dropBonus", 3), "+3%");
  });

  it("atk（非百分比）正值不带 %", () => {
    assert.equal(fmtDiff("atk", 10), "+10");
  });

  it("def（非百分比）负值不带 %", () => {
    assert.equal(fmtDiff("def", -5), "-5");
  });

  it("crit diff 转为百分点显示", () => {
    assert.equal(fmtDiff("crit", 0.05), "+5.0%");
  });

  it("hpr diff 带 /s 单位", () => {
    assert.equal(fmtDiff("hpr", 1.5), "+1.5/s");
  });

  it("hpr 负值 diff 带 /s 单位", () => {
    assert.equal(fmtDiff("hpr", -2.0), "-2.0/s");
  });
});
