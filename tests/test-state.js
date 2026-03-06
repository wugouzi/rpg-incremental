// test-state.js — State 模块测试

describe("State.createDefault", () => {
  it("返回完整的默认状态结构", () => {
    const s = State.createDefault();
    assert.ok(s.hero, "缺少 hero");
    assert.ok(s.equipment, "缺少 equipment");
    assert.ok(Array.isArray(s.inventory), "inventory 应为数组");
    assert.ok(s.stats, "缺少 stats");
    assert.ok(s.bossDefeated !== undefined, "缺少 bossDefeated");
    assert.ok(s.unlockedSkills !== undefined, "缺少 unlockedSkills");
  });

  it("英雄初始属性正确", () => {
    const s = State.createDefault();
    assert.equal(s.hero.level, 1);
    assert.equal(s.hero.exp, 0);
    assert.equal(s.hero.gold, 0);
    assert.equal(s.hero.gems, 0);
    assert.equal(s.hero.prestigeCount, 0);
    assert.equal(s.hero.prestigeBonus, 1.0);
    assert.equal(s.hero.class, null);
  });

  it("装备槽全部为 null", () => {
    const s = State.createDefault();
    ["weapon", "helmet", "chest", "legs", "ring", "neck"].forEach(slot => {
      assert.equal(s.equipment[slot], null, `装备槽 ${slot} 应为 null`);
    });
  });

  it("初始解锁区域只有 plains", () => {
    const s = State.createDefault();
    assert.deepEqual(s.unlockedZones, ["plains"]);
  });

  it("每次调用返回独立对象（不共享引用）", () => {
    const a = State.createDefault();
    const b = State.createDefault();
    assert.notEqual(a, b);
    assert.notEqual(a.hero, b.hero);
    a.hero.gold = 999;
    assert.equal(b.hero.gold, 0);
  });
});

describe("State.reset", () => {
  it("reset 后状态恢复默认值", () => {
    State.reset();
    const s = State.get();
    assert.equal(s.hero.level, 1);
    assert.equal(s.hero.gold, 0);
    assert.equal(s.currentZone, "plains");
  });
});

describe("State 派生属性", () => {
  // 每个测试前重置状态
  function setup() {
    State.reset();
    // 清空装备和技能以获得稳定的基础值
    const s = State.get();
    s.unlockedSkills = {};
    s.hero.class = null;
  }

  it("getTotalAtk 裸装等于 baseAtk * prestigeBonus", () => {
    setup();
    const s = State.get();
    const expected = Math.floor(s.hero.baseAtk * s.hero.prestigeBonus);
    assert.equal(State.getTotalAtk(), expected);
  });

  it("getTotalDef 裸装等于 baseDef", () => {
    setup();
    assert.equal(State.getTotalDef(), State.get().hero.baseDef);
  });

  it("getTotalMaxHp 裸装等于 baseMaxHp", () => {
    setup();
    assert.equal(State.getTotalMaxHp(), State.get().hero.baseMaxHp);
  });

  it("getTotalSpd 裸装等于 baseSpd", () => {
    setup();
    assert.equal(State.getTotalSpd(), State.get().hero.baseSpd);
  });

  it("getTotalCrit 裸装等于 baseCrit", () => {
    setup();
    assert.equal(State.getTotalCrit(), State.get().hero.baseCrit);
  });

  it("getAtkInterval = max(200, floor(1000 / spd))", () => {
    setup();
    const spd = State.getTotalSpd();
    const expected = Math.max(200, Math.floor(1000 / spd));
    assert.equal(State.getAtkInterval(), expected);
  });

  it("装备加成正确叠加到 getTotalAtk", () => {
    setup();
    const s = State.get();
    s.equipment.weapon = {
      id: "test_weapon",
      slot: "weapon",
      stats: { atk: 50 },
      enhanceLevel: 0,
    };
    const expected = Math.floor((s.hero.baseAtk + 50) * s.hero.prestigeBonus);
    assert.equal(State.getTotalAtk(), expected);
    // 清理
    s.equipment.weapon = null;
  });

  it("强化等级提升装备加成（+10% per level）", () => {
    setup();
    const s = State.get();
    s.equipment.weapon = {
      id: "test_weapon",
      slot: "weapon",
      stats: { atk: 100 },
      enhanceLevel: 2,  // x1.2
    };
    // (baseAtk + 100 * 1.2) * prestigeBonus
    const expected = Math.floor((s.hero.baseAtk + 100 * 1.2) * s.hero.prestigeBonus);
    assert.equal(State.getTotalAtk(), expected);
    s.equipment.weapon = null;
  });

  it("prestigeBonus 正确影响 getTotalAtk", () => {
    setup();
    const s = State.get();
    s.hero.prestigeBonus = 1.44;
    const expected = Math.floor(s.hero.baseAtk * 1.44);
    assert.equal(State.getTotalAtk(), expected);
    s.hero.prestigeBonus = 1.0;
  });
});

describe("State.addExp / levelUp", () => {
  it("addExp 累积经验", () => {
    State.reset();
    State.addExp(50);
    assert.equal(State.get().hero.exp, 50);
  });

  it("经验满时触发升级", () => {
    State.reset();
    State.addExp(100); // expToNext = 100
    assert.equal(State.get().hero.level, 2);
    assert.equal(State.get().hero.exp, 0);
  });

  it("升级后 expToNext 增大", () => {
    State.reset();
    const before = State.get().hero.expToNext;
    State.addExp(100);
    const after = State.get().hero.expToNext;
    assert.greaterThan(after, before, "升级后 expToNext 应更大");
  });

  it("连续升级正常处理", () => {
    State.reset();
    // 一次性给大量经验，应连续升多级
    State.addExp(10000);
    assert.greaterThan(State.get().hero.level, 3, "给10000经验应升多级");
  });

  it("升级后属性提升", () => {
    State.reset();
    const atkBefore = State.get().hero.baseAtk;
    const hpBefore  = State.get().hero.baseMaxHp;
    State.addExp(100); // 升1级
    assert.greaterThan(State.get().hero.baseAtk, atkBefore, "升级后 ATK 应提升");
    assert.greaterThan(State.get().hero.baseMaxHp, hpBefore, "升级后 maxHp 应提升");
  });

  it("升级时 HP 恢复满", () => {
    State.reset();
    State.get().hero.hp = 1; // 将 HP 设为濒死
    State.addExp(100);       // 触发升级
    const maxHp = State.getTotalMaxHp();
    assert.equal(State.get().hero.hp, maxHp, "升级后 HP 应满");
  });

  it("calcExpToNext 随等级增长", () => {
    for (let lv = 1; lv <= 5; lv++) {
      const a = State.calcExpToNext(lv);
      const b = State.calcExpToNext(lv + 1);
      assert.greaterThan(b, a, `Lv.${lv}→${lv+1} 升级所需经验应增大`);
    }
  });
});

describe("State.get / set", () => {
  it("set 后 get 返回新状态", () => {
    State.reset();
    const custom = State.createDefault();
    custom.hero.gold = 12345;
    State.set(custom);
    assert.equal(State.get().hero.gold, 12345);
    State.reset();
  });
});

describe("State.getTotalHpr / getTotalMpr", () => {
  function setup() {
    State.reset();
    const s = State.get();
    s.unlockedSkills = {};
    s.hero.class = null;
    return s;
  }

  it("getTotalHpr 裸装 Lv1 = 0.1 (level * 0.1)", () => {
    setup();
    // Lv1, 无装备词缀
    const hpr = State.getTotalHpr();
    assert.equal(Math.round(hpr * 10) / 10, 0.1, `Lv1 HPR 应为 0.1，得到 ${hpr}`);
  });

  it("getTotalMpr 裸装 Lv1 = 0.05 (level * 0.05)", () => {
    setup();
    const mpr = State.getTotalMpr();
    assert.equal(Math.round(mpr * 100) / 100, 0.05, `Lv1 MPR 应为 0.05，得到 ${mpr}`);
  });

  it("getTotalHpr 随等级增大", () => {
    setup();
    const s = State.get();
    const hprLv1 = State.getTotalHpr();
    s.hero.level = 10;
    const hprLv10 = State.getTotalHpr();
    assert.greaterThan(hprLv10, hprLv1, "Lv10 HPR 应大于 Lv1 HPR");
  });

  it("装备 hpr 词缀正确叠加到 getTotalHpr", () => {
    setup();
    const s = State.get();
    const basHpr = State.getTotalHpr();
    // 手动给胸甲添加 hpr=5 词缀
    s.equipment.chest = {
      id: "test_chest", slot: "chest",
      stats: {}, affixes: [{ stat: "hpr", value: 5 }],
      enhanceLevel: 0,
    };
    const newHpr = State.getTotalHpr();
    assert.equal(Math.round((newHpr - basHpr) * 10) / 10, 5, "hpr 词缀 +5 应让 HPR 增加 5");
    s.equipment.chest = null;
  });

  it("装备 mpr 词缀正确叠加到 getTotalMpr", () => {
    setup();
    const s = State.get();
    const baseMpr = State.getTotalMpr();
    s.equipment.ring = {
      id: "test_ring", slot: "ring",
      stats: {}, affixes: [{ stat: "mpr", value: 3 }],
      enhanceLevel: 0,
    };
    const newMpr = State.getTotalMpr();
    assert.equal(Math.round((newMpr - baseMpr) * 10) / 10, 3, "mpr 词缀 +3 应让 MPR 增加 3");
    s.equipment.ring = null;
  });

  it("getTotalHpr 不为负数", () => {
    setup();
    assert.greaterThan(State.getTotalHpr(), -0.001, "HPR 不应为负数");
  });
});
