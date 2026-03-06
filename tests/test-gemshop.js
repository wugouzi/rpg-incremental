// test-gemshop.js — 宝石商店系统测试
// 覆盖：升级费用计算/购买升级/金币不足拒绝/最大等级限制/特殊解锁/gem 加成查询

// ─────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────

function freshGemState(gems) {
  State.reset();
  const s = State.get();
  s.hero.gems = gems || 0;
  return s;
}

// ══════════════════════════════════════════════════════════════════════════
// A. 常量与结构完整性
// ══════════════════════════════════════════════════════════════════════════

describe("[GemShop — 结构完整性]", () => {
  it("GemShop.UPGRADES 存在且不为空", () => {
    assert.ok(Array.isArray(GemShop.UPGRADES), "UPGRADES 应是数组");
    assert.ok(GemShop.UPGRADES.length > 0, "UPGRADES 应有至少 1 项");
  });

  it("GemShop.SPECIAL_UNLOCKS 存在且不为空", () => {
    assert.ok(Array.isArray(GemShop.SPECIAL_UNLOCKS), "SPECIAL_UNLOCKS 应是数组");
    assert.ok(GemShop.SPECIAL_UNLOCKS.length > 0, "SPECIAL_UNLOCKS 应有至少 1 项");
  });

  it("每个 UPGRADE 都有 id/name/desc/baseCost/costScale/maxLevel/apply", () => {
    GemShop.UPGRADES.forEach(upg => {
      assert.ok(upg.id,       `升级 ${upg.id} 缺少 id`);
      assert.ok(upg.name,     `升级 ${upg.id} 缺少 name`);
      assert.ok(upg.desc,     `升级 ${upg.id} 缺少 desc`);
      assert.ok(upg.baseCost > 0, `升级 ${upg.id} baseCost 应 > 0`);
      assert.ok(upg.costScale > 1, `升级 ${upg.id} costScale 应 > 1`);
      assert.ok(upg.maxLevel > 0, `升级 ${upg.id} maxLevel 应 > 0`);
      assert.ok(typeof upg.apply === "function", `升级 ${upg.id} 缺少 apply 函数`);
    });
  });

  it("每个 SPECIAL_UNLOCK 都有 id/name/desc/cost/apply", () => {
    GemShop.SPECIAL_UNLOCKS.forEach(u => {
      assert.ok(u.id,       `解锁 ${u.id} 缺少 id`);
      assert.ok(u.name,     `解锁 ${u.id} 缺少 name`);
      assert.ok(u.desc,     `解锁 ${u.id} 缺少 desc`);
      assert.ok(u.cost > 0, `解锁 ${u.id} cost 应 > 0`);
      assert.ok(typeof u.apply === "function", `解锁 ${u.id} 缺少 apply 函数`);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// B. 升级费用计算
// ══════════════════════════════════════════════════════════════════════════

describe("[GemShop — 费用计算]", () => {
  it("Lv.0 时费用等于 baseCost", () => {
    freshGemState(0);
    GemShop.UPGRADES.forEach(upg => {
      const cost = GemShop.getUpgradeCost(upg);
      assert.equal(cost, upg.baseCost, `${upg.id} Lv.0 费用应等于 baseCost`);
    });
  });

  it("getUpgradeLevel 默认返回 0", () => {
    freshGemState(0);
    GemShop.UPGRADES.forEach(upg => {
      const lvl = GemShop.getUpgradeLevel(upg.id);
      assert.equal(lvl, 0, `${upg.id} 初始等级应为 0`);
    });
  });

  it("升级后费用按 costScale 指数增长", () => {
    const s = freshGemState(100);
    const upg = GemShop.UPGRADES[0]; // gem_atk_bonus: baseCost=1, scale=1.5
    const cost0 = GemShop.getUpgradeCost(upg);
    // 手动设置升级等级为 1 来验证费用
    if (!s.gemUpgradeLevels) s.gemUpgradeLevels = {};
    s.gemUpgradeLevels[upg.id] = 1;
    const cost1 = GemShop.getUpgradeCost(upg);
    const expected1 = Math.floor(upg.baseCost * Math.pow(upg.costScale, 1));
    assert.equal(cost1, expected1, `Lv.1 费用应为 ${expected1}，实际 ${cost1}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// C. 购买升级
// ══════════════════════════════════════════════════════════════════════════

describe("[GemShop — 购买升级]", () => {
  it("宝石不足时拒绝购买，不消耗宝石", () => {
    const s = freshGemState(0);
    const upg = GemShop.UPGRADES[0]; // gem_atk_bonus: baseCost=1
    GemShop.buyUpgrade(upg.id);
    assert.equal(s.hero.gems, 0, "宝石不足时不应消耗宝石");
    assert.equal(GemShop.getUpgradeLevel(upg.id), 0, "等级不应上升");
  });

  it("宝石足够时成功购买，消耗宝石并升级", () => {
    const s = freshGemState(10);
    const upg = GemShop.UPGRADES.find(u => u.id === "gem_atk_bonus"); // baseCost=1
    const costBefore = GemShop.getUpgradeCost(upg);
    GemShop.buyUpgrade(upg.id);
    assert.equal(s.hero.gems, 10 - costBefore, `购买后宝石应减少 ${costBefore}`);
    assert.equal(GemShop.getUpgradeLevel(upg.id), 1, "等级应升至 1");
  });

  it("购买 gem_atk_bonus 后 state.gemUpgrades.atkPct += 5", () => {
    const s = freshGemState(10);
    GemShop.buyUpgrade("gem_atk_bonus");
    assert.equal(s.gemUpgrades && s.gemUpgrades.atkPct, 5, "atkPct 应为 5");
  });

  it("购买 gem_hp_bonus 后 state.gemUpgrades.hpPct += 8", () => {
    const s = freshGemState(10);
    GemShop.buyUpgrade("gem_hp_bonus");
    assert.equal(s.gemUpgrades && s.gemUpgrades.hpPct, 8, "hpPct 应为 8");
  });

  it("连续购买两次 gem_atk_bonus，atkPct 叠加为 10", () => {
    const s = freshGemState(100);
    GemShop.buyUpgrade("gem_atk_bonus");
    GemShop.buyUpgrade("gem_atk_bonus");
    assert.equal(s.gemUpgrades.atkPct, 10, "两次购买后 atkPct 应为 10");
  });

  it("达到 maxLevel 后无法继续购买", () => {
    const upg = GemShop.UPGRADES.find(u => u.id === "gem_inventory_expand"); // maxLevel=4, baseCost=3
    // 给足够的宝石手动达到 maxLevel
    const s = freshGemState(9999);
    if (!s.gemUpgradeLevels) s.gemUpgradeLevels = {};
    s.gemUpgradeLevels[upg.id] = upg.maxLevel;
    const gemsBefore = s.hero.gems;
    GemShop.buyUpgrade(upg.id);
    assert.equal(s.hero.gems, gemsBefore, "达到 maxLevel 后不应消耗宝石");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// D. 特殊解锁
// ══════════════════════════════════════════════════════════════════════════

describe("[GemShop — 特殊解锁]", () => {
  it("宝石不足时拒绝特殊解锁", () => {
    const s = freshGemState(0);
    const unlock = GemShop.SPECIAL_UNLOCKS[0]; // gem_auto_prestige: cost=5
    GemShop.buySpecialUnlock(unlock.id);
    assert.equal(s.hero.gems, 0, "宝石不足时不应消耗宝石");
    assert.ok(!GemShop._getUnlockKey(unlock.id), "不应触发解锁");
  });

  it("购买 gem_second_chance 后 state.gemUnlocks.secondChance = true", () => {
    const s = freshGemState(100);
    GemShop.buySpecialUnlock("gem_second_chance");
    assert.equal(s.gemUnlocks && s.gemUnlocks.secondChance, true, "secondChance 应为 true");
    assert.equal(s.gemUnlocks.secondChanceUsed, false, "secondChanceUsed 初始应为 false");
  });

  it("购买 gem_elite_loot 后 state.gemUnlocks.eliteLoot = true", () => {
    const s = freshGemState(100);
    GemShop.buySpecialUnlock("gem_elite_loot");
    assert.equal(s.gemUnlocks && s.gemUnlocks.eliteLoot, true, "eliteLoot 应为 true");
  });

  it("已解锁后重复购买不消耗宝石", () => {
    const s = freshGemState(100);
    const unlock = GemShop.SPECIAL_UNLOCKS.find(u => u.id === "gem_auto_prestige");
    GemShop.buySpecialUnlock("gem_auto_prestige");
    const gemsAfterFirst = s.hero.gems;
    GemShop.buySpecialUnlock("gem_auto_prestige");
    assert.equal(s.hero.gems, gemsAfterFirst, "已解锁后重复购买不应再消耗宝石");
  });

  it("购买特殊解锁消耗正确数量宝石", () => {
    const s = freshGemState(100);
    const unlock = GemShop.SPECIAL_UNLOCKS.find(u => u.id === "gem_craft_slot");
    const costExpected = unlock.cost;
    GemShop.buySpecialUnlock("gem_craft_slot");
    assert.equal(s.hero.gems, 100 - costExpected, `购买后宝石应减少 ${costExpected}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// E. getGemBonus 返回值
// ══════════════════════════════════════════════════════════════════════════

describe("[GemShop.getGemBonus — 加成查询]", () => {
  it("初始状态所有加成为 0", () => {
    freshGemState(0);
    const bonus = GemShop.getGemBonus();
    assert.equal(bonus.atkPct,       0, "初始 atkPct 应为 0");
    assert.equal(bonus.hpPct,        0, "初始 hpPct 应为 0");
    assert.equal(bonus.defPct,       0, "初始 defPct 应为 0");
    assert.equal(bonus.goldPct,      0, "初始 goldPct 应为 0");
    assert.equal(bonus.expPct,       0, "初始 expPct 应为 0");
    assert.equal(bonus.critAdd,      0, "初始 critAdd 应为 0");
    assert.equal(bonus.dropPct,      0, "初始 dropPct 应为 0");
    assert.equal(bonus.invExpand,    0, "初始 invExpand 应为 0");
    assert.equal(bonus.offlineHours, 0, "初始 offlineHours 应为 0");
  });

  it("购买 gem_crit_bonus 后 critAdd = 0.02", () => {
    const s = freshGemState(100);
    GemShop.buyUpgrade("gem_crit_bonus");
    const bonus = GemShop.getGemBonus();
    assert.equal(bonus.critAdd, 0.02, "购买一次 gem_crit_bonus 后 critAdd 应为 0.02");
  });

  it("购买 gem_inventory_expand 后 invExpand = 5", () => {
    const s = freshGemState(100);
    GemShop.buyUpgrade("gem_inventory_expand");
    const bonus = GemShop.getGemBonus();
    assert.equal(bonus.invExpand, 5, "购买一次 gem_inventory_expand 后 invExpand 应为 5");
  });

  it("getMaxInventory 初始为 20", () => {
    freshGemState(0);
    assert.equal(GemShop.getMaxInventory(), 20, "初始最大背包容量应为 20");
  });

  it("购买 gem_inventory_expand 后 getMaxInventory 为 25", () => {
    const s = freshGemState(100);
    GemShop.buyUpgrade("gem_inventory_expand");
    assert.equal(GemShop.getMaxInventory(), 25, "购买后最大背包容量应为 25");
  });

  it("购买 gem_offline_extend 后 offlineHours = 2", () => {
    const s = freshGemState(100);
    GemShop.buyUpgrade("gem_offline_extend");
    const bonus = GemShop.getGemBonus();
    assert.equal(bonus.offlineHours, 2, "购买一次 gem_offline_extend 后 offlineHours 应为 2");
  });
});
