// test-affixes.js — 随机词缀 / 元素抗性 / 掉落加成 测试

// ── Stub ──────────────────────────────────────────────────
const _affixUiStub = {
  addLog: () => {},
  refreshSidePanel: () => {},
  refreshSidePanelIfDirty: () => {},
  markSidePanelDirty: () => {},
  refresh: () => {},
};
if (!window.UI) window.UI = _affixUiStub;
else {
  if (!window.UI.markSidePanelDirty)       window.UI.markSidePanelDirty       = () => {};
  if (!window.UI.refreshSidePanelIfDirty)  window.UI.refreshSidePanelIfDirty  = () => {};
}

// ══════════════════════════════════════════════════════════
// Equipment.rollAffixes — 词缀生成
// ══════════════════════════════════════════════════════════

describe("Equipment.rollAffixes — common 无词缀", () => {
  it("common 品质不生成词缀", () => {
    const affixes = Equipment.rollAffixes("weapon", "common");
    assert.equal(affixes.length, 0, "common 应无词缀");
  });
});

describe("Equipment.rollAffixes — rare/epic/legendary 生成词缀数量", () => {
  it("rare 最多生成 1 个词缀", () => {
    const affixes = Equipment.rollAffixes("helmet", "rare");
    assert.ok(affixes.length <= 1, `rare 词缀数量应 <= 1，实际 ${affixes.length}`);
  });

  it("epic 最多生成 2 个词缀", () => {
    const affixes = Equipment.rollAffixes("chest", "epic");
    assert.ok(affixes.length <= 2, `epic 词缀数量应 <= 2，实际 ${affixes.length}`);
  });

  it("legendary 最多生成 3 个词缀", () => {
    const affixes = Equipment.rollAffixes("neck", "legendary");
    assert.ok(affixes.length <= 3, `legendary 词缀数量应 <= 3，实际 ${affixes.length}`);
  });

  it("词缀不重复（同一物品上不出现两个相同 id 的词缀）", () => {
    // 多次生成确保不重复
    for (let i = 0; i < 20; i++) {
      const affixes = Equipment.rollAffixes("ring", "legendary");
      const ids = affixes.map(a => a.id);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length, "词缀 id 不应重复");
    }
  });
});

describe("Equipment.rollAffixes — 词缀字段完整", () => {
  it("词缀包含 id/name/stat/value", () => {
    // legendary ring 最可能有词缀
    let affixes = [];
    // 尝试几次直到拿到词缀
    for (let i = 0; i < 50 && affixes.length === 0; i++) {
      affixes = Equipment.rollAffixes("ring", "legendary");
    }
    affixes.forEach(a => {
      assert.ok(a.id    !== undefined, "词缀应有 id");
      assert.ok(a.name  !== undefined, "词缀应有 name");
      assert.ok(a.stat  !== undefined, "词缀应有 stat");
      assert.ok(a.value !== undefined, "词缀应有 value");
    });
  });

  it("词缀数值在合理范围内（> 0）", () => {
    for (let i = 0; i < 20; i++) {
      const affixes = Equipment.rollAffixes("neck", "epic");
      affixes.forEach(a => {
        assert.ok(a.value > 0, `词缀 ${a.id} value=${a.value} 应 > 0`);
      });
    }
  });
});

// ══════════════════════════════════════════════════════════
// Equipment.createItem — 带词缀创建
// ══════════════════════════════════════════════════════════

describe("Equipment.createItem — withAffixes=false（商店购买）", () => {
  it("不带词缀创建时，affixes 为空数组", () => {
    const item = Equipment.createItem("iron_sword", false);
    assert.ok(item, "应返回物品");
    assert.equal((item.affixes || []).length, 0, "商店物品不应有词缀");
  });

  it("基础属性不为零", () => {
    const item = Equipment.createItem("iron_sword", false);
    assert.ok(item.stats.atk > 0, "atk 应 > 0");
  });
});

describe("Equipment.createItem — withAffixes=true（怪物掉落）", () => {
  it("带词缀创建时，rare 及以上可能有词缀", () => {
    // steel_sword 是 rare，反复创建 50 次至少应有一次带词缀
    let foundAffix = false;
    for (let i = 0; i < 50; i++) {
      const item = Equipment.createItem("steel_sword", true);
      if (item.affixes && item.affixes.length > 0) {
        foundAffix = true;
        break;
      }
    }
    assert.ok(foundAffix, "rare 物品应在多次创建中出现词缀");
  });

  it("common 物品即使 withAffixes=true 也无词缀", () => {
    for (let i = 0; i < 10; i++) {
      const item = Equipment.createItem("iron_sword", true);
      assert.equal((item.affixes || []).length, 0, "common 不应有词缀");
    }
  });

  it("品质倍率：rare 基础 atk 高于 common 模板值", () => {
    const common = Equipment.createItem("iron_sword", false);   // common, mult=1.0
    const rare   = Equipment.createItem("steel_sword", false);  // rare, mult=1.15
    // steel_sword 模板 atk=38，common iron_sword 模板 atk=18；仅验证倍率应用
    assert.ok(rare.stats.atk >= 38, `rare atk(${rare.stats.atk}) 应 >= 模板值 38`);
  });
});

// ══════════════════════════════════════════════════════════
// Equipment.getItemTotalStats — 词缀叠加
// ══════════════════════════════════════════════════════════

describe("Equipment.getItemTotalStats — 无词缀物品", () => {
  it("无词缀时与 stats 相同", () => {
    const item = Equipment.createItem("iron_sword", false);
    const total = Equipment.getItemTotalStats(item);
    assert.equal(total.atk, item.stats.atk, "atk 应与 stats.atk 相同");
  });
});

describe("Equipment.getItemTotalStats — 有词缀物品", () => {
  it("词缀属性叠加到总属性上", () => {
    const item = Equipment.createItem("shadow_blade", false);
    // 手动添加一个 atk 词缀
    item.affixes = [{ id: "bonus_atk", name: "of Fury", stat: "atk", value: 15 }];
    const total = Equipment.getItemTotalStats(item);
    assert.equal(total.atk, item.stats.atk + 15, "总 atk = 基础 + 词缀");
  });

  it("抗性词缀叠加到总属性", () => {
    const item = Equipment.createItem("iron_helmet", false);
    item.affixes = [{ id: "fire_res", name: "Flame-Resistant", stat: "fireRes", value: 12 }];
    const total = Equipment.getItemTotalStats(item);
    assert.equal(total.fireRes, 12, "fireRes 应为 12");
  });
});

// ══════════════════════════════════════════════════════════
// State.getTotalResistance / getTotalDropBonus
// ══════════════════════════════════════════════════════════

describe("State.getTotalResistance — 无装备时全为 0", () => {
  it("初始状态各抗性为 0", () => {
    State.reset();
    const res = State.getTotalResistance();
    assert.equal(res.fire,      0, "fire 抗性应为 0");
    assert.equal(res.ice,       0, "ice 抗性应为 0");
    assert.equal(res.lightning, 0, "lightning 抗性应为 0");
    assert.equal(res.poison,    0, "poison 抗性应为 0");
    assert.equal(res.phys,      0, "phys 抗性应为 0");
  });
});

describe("State.getTotalResistance — 装备带抗性词缀", () => {
  it("装备带 fireRes 词缀后 fire 抗性增加", () => {
    State.reset();
    const item = Equipment.createItem("iron_helmet", false);
    item.affixes = [{ id: "fire_res", name: "Flame-Resistant", stat: "fireRes", value: 20 }];
    State.get().equipment.helmet = item;
    const res = State.getTotalResistance();
    assert.equal(res.fire, 20, "fire 抗性应为 20");
  });

  it("抗性上限 75%", () => {
    State.reset();
    // 叠加多件装备模拟超过上限
    const helm  = Equipment.createItem("iron_helmet", false);
    const chest = Equipment.createItem("iron_armor",  false);
    const legs  = Equipment.createItem("iron_legs",   false);
    helm.affixes  = [{ id: "fire_res", name: "Flame-Resistant", stat: "fireRes", value: 40 }];
    chest.affixes = [{ id: "fire_res", name: "Flame-Resistant", stat: "fireRes", value: 40 }];
    legs.affixes  = [{ id: "fire_res", name: "Flame-Resistant", stat: "fireRes", value: 40 }];
    const state = State.get();
    state.equipment.helmet = helm;
    state.equipment.chest  = chest;
    state.equipment.legs   = legs;
    const res = State.getTotalResistance();
    assert.equal(res.fire, 75, "fire 抗性应被截断到 75");
  });
});

describe("State.getTotalDropBonus / getTotalGoldBonus / getTotalExpBonus", () => {
  it("无装备时 dropBonus 为 0", () => {
    State.reset();
    assert.equal(State.getTotalDropBonus(), 0, "dropBonus 应为 0");
  });

  it("装备带 dropBonus 词缀后正确累计", () => {
    State.reset();
    const ring = Equipment.createItem("iron_ring", false);
    ring.affixes = [{ id: "drop_bonus", name: "Plunderer's", stat: "dropBonus", value: 10 }];
    State.get().equipment.ring = ring;
    assert.equal(State.getTotalDropBonus(), 10, "dropBonus 应为 10");
  });

  it("多件装备 goldBonus 叠加", () => {
    State.reset();
    const ring = Equipment.createItem("iron_ring",     false);
    const neck = Equipment.createItem("bone_necklace", false);
    ring.affixes = [{ id: "gold_bonus", name: "Wealthy", stat: "goldBonus", value: 8 }];
    neck.affixes = [{ id: "gold_bonus", name: "Wealthy", stat: "goldBonus", value: 5 }];
    State.get().equipment.ring = ring;
    State.get().equipment.neck = neck;
    assert.equal(State.getTotalGoldBonus(), 13, "goldBonus 应叠加为 13");
  });

  it("expBonus 正确读取", () => {
    State.reset();
    const helm = Equipment.createItem("iron_helmet", false);
    helm.affixes = [{ id: "exp_bonus", name: "Scholar's", stat: "expBonus", value: 6 }];
    State.get().equipment.helmet = helm;
    assert.equal(State.getTotalExpBonus(), 6, "expBonus 应为 6");
  });
});

// ══════════════════════════════════════════════════════════
// 元素抗性减伤（calcMonsterDmg 路径）
// 通过 Combat tick 间接测试
// ══════════════════════════════════════════════════════════

describe("元素抗性减伤 — 怪物伤害受抗性降低", () => {
  // helper：重置英雄
  function affixHeroSetup(opts) {
    State.reset();
    const s = State.get();
    s.hero.hp        = opts.hp  !== undefined ? opts.hp  : 1000;
    s.hero.baseMaxHp = s.hero.hp;
    s.hero.baseAtk   = opts.atk !== undefined ? opts.atk : 50;
    s.hero.baseDef   = opts.def !== undefined ? opts.def : 0;
    s.hero.baseSpd   = 1.0;
    s.hero.baseCrit  = 0;
    s.hero.gold      = 0;
    s.hero.prestigeBonus = 1.0;
    s.unlockedSkills = {};
    s.hero.class     = null;
    s.currentZone    = "plains";
  }

  it("无抗性时受到满额伤害", () => {
    affixHeroSetup({ hp: 1000, def: 0 });
    // 火焰怪，玩家无 fireRes
    // 注意：monsterInterval = Math.max(300, 1000/spd)，spd=1 时 interval=1000ms
    // tick(1000) 恰好触发一次怪物攻击
    const fireMob = {
      id: "fire_test", name: "Fire Test", zone: "plains",
      element: "fire", isBoss: false,
      currentHp: 5000, maxHp: 5000,
      atk: 100, def: 0, spd: 1.0,
      expReward: 0, goldMin: 0, goldMax: 0, dropTable: [],
    };
    Combat.startFight(fireMob);
    const hpBefore = State.get().hero.hp;
    // 推进 1000ms → 触发 1 次怪物攻击
    Combat.tick(1000);
    const hpAfter = State.get().hero.hp;
    const dmgTaken = hpBefore - hpAfter;
    // def=0、无抗性时怪物伤害 = atk - 0 = 100（最小 1）
    assert.ok(dmgTaken >= 100, `无抗性应受到 >= 100 伤害，实际: ${dmgTaken}`);
  });

  it("50% fire 抗性使火焰伤害减半", () => {
    affixHeroSetup({ hp: 2000, def: 0 });
    // 给玩家 50% fire 抗性
    const helm = Equipment.createItem("iron_helmet", false);
    helm.affixes = [{ id: "fire_res", name: "Flame-Resistant", stat: "fireRes", value: 50 }];
    State.get().equipment.helmet = helm;

    const fireMob = {
      id: "fire_test2", name: "Fire Test2", zone: "plains",
      element: "fire", isBoss: false,
      currentHp: 5000, maxHp: 5000,
      atk: 100, def: 0, spd: 1.0,
      expReward: 0, goldMin: 0, goldMax: 0, dropTable: [],
    };
    Combat.startFight(fireMob);
    const hpBefore = State.get().hero.hp;
    // 触发 1 次怪物攻击
    Combat.tick(1000);
    const hpAfter = State.get().hero.hp;
    const dmgTaken = hpBefore - hpAfter;
    // 抗性 50% → 原始 100 伤害 * 0.5 = 50；允许 ±1 的 floor 误差
    assert.ok(dmgTaken <= 51, `50%fire 抗性时伤害应 <= 51，实际: ${dmgTaken}`);
    assert.ok(dmgTaken >= 1,  "即使有抗性也应受到 >= 1 点伤害");
  });
});

// ══════════════════════════════════════════════════════════
// 怪物掉落装备（dropType === "equipment"）
// ══════════════════════════════════════════════════════════

describe("怪物掉落装备 — 带词缀的物品进背包", () => {
  function affixCombatSetup() {
    State.reset();
    const s = State.get();
    s.hero.hp = s.hero.baseMaxHp = 1000;
    s.hero.baseAtk = 9999;  // 一击必杀
    s.hero.baseDef = 0;
    s.hero.baseSpd = 1.0;
    s.hero.baseCrit = 0;
    s.hero.gold = 0;
    s.hero.prestigeBonus = 1.0;
    s.unlockedSkills = {};
    s.hero.class = null;
    s.currentZone = "plains";
  }

  it("100% 概率掉落的装备条目会进背包", () => {
    affixCombatSetup();
    const mob = {
      id: "drop_test", name: "Drop Test", zone: "plains",
      element: "phys", isBoss: false,
      currentHp: 1, maxHp: 1,
      atk: 1, def: 0, spd: 0.1,
      expReward: 0, goldMin: 0, goldMax: 0,
      dropTable: [
        { type: "equipment", itemId: "iron_ring", chance: 1.0 },
      ],
    };
    Combat.startFight(mob);
    Combat.tick(2000); // 触发英雄攻击
    const inv = State.get().inventory;
    assert.ok(inv.length >= 1, "背包应至少有 1 件掉落装备");
    assert.equal(inv[0].id, "iron_ring", "掉落物品 id 应为 iron_ring");
  });

  it("掉落装备携带 affixes 字段", () => {
    affixCombatSetup();
    const mob = {
      id: "drop_test2", name: "Drop Test2", zone: "plains",
      element: "phys", isBoss: false,
      currentHp: 1, maxHp: 1,
      atk: 1, def: 0, spd: 0.1,
      expReward: 0, goldMin: 0, goldMax: 0,
      dropTable: [
        { type: "equipment", itemId: "shadow_blade", chance: 1.0 },
      ],
    };
    Combat.startFight(mob);
    Combat.tick(2000);
    const inv = State.get().inventory;
    assert.ok(inv.length >= 1, "背包应有掉落装备");
    // affixes 字段应存在（可能为空数组，因为 shadow_blade 是 epic）
    assert.ok(Array.isArray(inv[0].affixes), "掉落装备应有 affixes 数组");
  });

  it("0% 概率的掉落不进背包", () => {
    affixCombatSetup();
    const mob = {
      id: "drop_test3", name: "Drop Test3", zone: "plains",
      element: "phys", isBoss: false,
      currentHp: 1, maxHp: 1,
      atk: 1, def: 0, spd: 0.1,
      expReward: 0, goldMin: 0, goldMax: 0,
      dropTable: [
        { type: "equipment", itemId: "iron_sword", chance: 0 },
      ],
    };
    Combat.startFight(mob);
    Combat.tick(2000);
    const inv = State.get().inventory;
    assert.equal(inv.length, 0, "0% 概率不应有掉落");
  });
});

// ══════════════════════════════════════════════════════════
// dropBonus 加成影响掉落概率
// ══════════════════════════════════════════════════════════

describe("dropBonus — 提升掉落概率", () => {
  it("dropBonus=100% 时，50% 概率的掉落变为 100%（或上限 100%）", () => {
    State.reset();
    const s = State.get();
    s.hero.hp = s.hero.baseMaxHp = 1000;
    s.hero.baseAtk = 9999;
    s.hero.baseDef = 0;
    s.hero.baseSpd = 1.0;
    s.hero.baseCrit = 0;
    s.hero.gold = 0;
    s.hero.prestigeBonus = 1.0;
    s.unlockedSkills = {};
    s.hero.class = null;
    s.currentZone = "plains";

    // 添加 dropBonus=100 的词缀
    const ring = Equipment.createItem("iron_ring", false);
    ring.affixes = [{ id: "drop_bonus", name: "Plunderer's", stat: "dropBonus", value: 100 }];
    s.equipment.ring = ring;

    // 使用 50% 概率的掉落；+100% → effectiveChance = min(1, 0.5*2) = 1
    // 运行 5 次，应该每次都掉落
    let totalDrops = 0;
    for (let trial = 0; trial < 5; trial++) {
      State.reset();
      const s2 = State.get();
      s2.hero.hp = s2.hero.baseMaxHp = 1000;
      s2.hero.baseAtk = 9999;
      s2.hero.baseDef = 0;
      s2.hero.baseSpd = 1.0;
      s2.hero.baseCrit = 0;
      s2.hero.gold = 0;
      s2.hero.prestigeBonus = 1.0;
      s2.unlockedSkills = {};
      s2.hero.class = null;
      s2.currentZone = "plains";

      const ring2 = Equipment.createItem("iron_ring", false);
      ring2.affixes = [{ id: "drop_bonus", name: "Plunderer's", stat: "dropBonus", value: 100 }];
      s2.equipment.ring = ring2;

      const mob = {
        id: "dbtest", name: "DB Test", zone: "plains",
        element: "phys", isBoss: false,
        currentHp: 1, maxHp: 1,
        atk: 1, def: 0, spd: 0.1,
        expReward: 0, goldMin: 0, goldMax: 0,
        dropTable: [{ type: "equipment", itemId: "iron_ring", chance: 0.5 }],
      };
      Combat.startFight(mob);
      Combat.tick(2000);
      if (State.get().inventory.length > 0) totalDrops++;
    }
    assert.equal(totalDrops, 5, "dropBonus=100% 时 50% 概率应变为 100%，5次全部掉落");
  });
});
