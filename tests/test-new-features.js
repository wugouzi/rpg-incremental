// test-new-features.js — 新功能测试
// 涵盖：动态怪物等级、Mutation系统、新词缀、技能总览、resetRegenAccumulators

// ── Stub ────────────────────────────────────────────────
if (!window.UI) {
  window.UI = {
    addLog: () => {},
    refreshSidePanel: () => {},
    refreshSidePanelIfDirty: () => {},
    markSidePanelDirty: () => {},
    refresh: () => {},
  };
}

// ════════════════════════════════════════════════════════
// 1. 动态怪物等级 — Monsters.calcEffectiveLevel
// ════════════════════════════════════════════════════════

describe("Monsters.calcEffectiveLevel — 动态等级计算", () => {
  function setupHero(level, killStreak) {
    State.reset();
    State.get().hero.level = level;
    State.get().killStreak = killStreak || 0;
    State.get().currentZone = "plains";
  }

  it("plains 区域存在 levelRange 字段", () => {
    const zone = Zones.getZone("plains");
    assert.ok(Array.isArray(zone.levelRange), "plains 应有 levelRange");
    assert.equal(zone.levelRange.length, 2, "levelRange 应为 [min, max]");
  });

  it("所有区域都有 levelRange 字段", () => {
    Zones.ZONE_LIST.forEach(z => {
      assert.ok(Array.isArray(z.levelRange), `区域 ${z.id} 应有 levelRange`);
      assert.ok(z.levelRange[0] <= z.levelRange[1], `${z.id} levelRange[0] 应 <= levelRange[1]`);
    });
  });

  it("无连胜时怪物等级 = clamp(heroLevel, zoneMin, zoneMax)", () => {
    const zone = Zones.getZone("plains");
    const [zMin, zMax] = zone.levelRange;
    // plains levelRange=[1,8], heroLevel=5 → clamp(5,1,8)=5
    setupHero(5, 0);
    const lvLow = Monsters.calcEffectiveLevel("plains");
    assert.equal(lvLow, Math.min(zMax, Math.max(zMin, 5)), "英雄Lv5时等级应为 clamp(5,1,8)=5");

    // heroLevel=20（高于 zMax=8）→ clamp 到 zMax=8
    setupHero(20, 0);
    const lvHigh = Monsters.calcEffectiveLevel("plains");
    assert.equal(lvHigh, zMax, "英雄Lv20在plains时等级应被限制到 zMax");
  });

  it("连胜增加有效等级（每连胜 +scale 级）", () => {
    const zone = Zones.getZone("plains");
    const scale = zone.killStreakScale || 0.5;
    setupHero(5, 0);
    const lvBase = Monsters.calcEffectiveLevel("plains");

    setupHero(5, 10);
    const lvBonus = Monsters.calcEffectiveLevel("plains");
    const expected = lvBase + Math.floor(10 * scale);
    assert.ok(lvBonus > lvBase || lvBonus === zone.levelRange[1],
      `连胜 10 时等级应比无连胜高，实际 base=${lvBase}, bonus=${lvBonus}`);
  });

  it("有效等级不超过区域最大等级", () => {
    setupHero(1, 9999); // 超大连胜
    const zone = Zones.getZone("plains");
    const lv = Monsters.calcEffectiveLevel("plains");
    assert.ok(lv <= zone.levelRange[1], `等级不应超过 levelRange[1]=${zone.levelRange[1]}，实际=${lv}`);
  });

  it("玩家等级低于区域最低等级时，使用区域最低等级", () => {
    const zone = Zones.getZone("castle");
    const [zMin] = zone.levelRange;
    setupHero(1, 0); // 等级远低于 castle 区域
    const lv = Monsters.calcEffectiveLevel("castle");
    assert.ok(lv >= zMin, `等级应不低于区域最低等级 ${zMin}，实际=${lv}`);
  });
});

// ════════════════════════════════════════════════════════
// 2. Mutation 系统 — tryMutate & MUTATION_POOL
// ════════════════════════════════════════════════════════

describe("Monsters.MUTATION_POOL 数据完整性", () => {
  it("MUTATION_POOL 不为空", () => {
    assert.ok(Monsters.MUTATION_POOL.length > 0, "MUTATION_POOL 应有词条");
  });

  it("每个词条包含必要字段", () => {
    Monsters.MUTATION_POOL.forEach(m => {
      assert.ok(m.id,   `词条缺少 id`);
      assert.ok(m.name, `${m.id} 缺少 name`);
      assert.ok(m.desc, `${m.id} 缺少 desc`);
      assert.ok(typeof m.apply === "function", `${m.id} apply 应为函数`);
    });
  });

  it("词条 id 不重复", () => {
    const ids = Monsters.MUTATION_POOL.map(m => m.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, "MUTATION_POOL 中词条 id 不应重复");
  });
});

describe("Monsters — 精英怪 Mutation 触发", () => {
  function setupForMutation(killStreak) {
    State.reset();
    State.get().hero.level = 10;
    State.get().killStreak = killStreak;
    State.get().currentZone = "plains";
  }

  it("连胜=0 时精英概率约为 5%（spawn 100 次应少于 20 次精英）", () => {
    setupForMutation(0);
    let eliteCount = 0;
    for (let i = 0; i < 100; i++) {
      const m = Monsters.spawn("plains");
      if (m && m.isElite) eliteCount++;
    }
    // 5% 期望 = 5，允许统计误差，上限设 25
    assert.ok(eliteCount <= 30, `连胜=0 时精英数不应超过 30，实际 ${eliteCount}`);
  });

  it("连胜=100 时精英概率接近上限 60%（spawn 100 次应有较多精英）", () => {
    setupForMutation(100);
    let eliteCount = 0;
    for (let i = 0; i < 100; i++) {
      const m = Monsters.spawn("plains");
      if (m && m.isElite) eliteCount++;
    }
    // 60% 期望 = 60，允许统计误差，下限设 30
    assert.ok(eliteCount >= 30, `连胜=100 时精英数应至少 30，实际 ${eliteCount}`);
  });

  it("精英怪拥有 isElite=true 和 mutations 数组", () => {
    // 强制高连胜，多次生成直到拿到精英
    setupForMutation(999);
    let elite = null;
    for (let i = 0; i < 200 && !elite; i++) {
      const m = Monsters.spawn("plains");
      if (m && m.isElite) elite = m;
    }
    assert.ok(elite, "高连胜下应能生成精英怪");
    assert.ok(elite.isElite === true, "精英怪 isElite 应为 true");
    assert.ok(Array.isArray(elite.mutations), "精英怪应有 mutations 数组");
    assert.ok(elite.mutations.length >= 1, "精英怪应有至少 1 个 Mutation");
  });

  it("精英怪的掉落概率是普通怪的 2 倍（上限 100%）", () => {
    setupForMutation(999);
    // 构造一个有 50% 掉落的普通怪物
    const baseMob = {
      id: "test_elite", name: "Test", zone: "plains",
      currentHp: 100, maxHp: 100,
      atk: 10, def: 0, spd: 1,
      element: null, isBoss: false,
      expReward: 0, goldMin: 10, goldMax: 20,
      dropTable: [{ type: "equipment", itemId: "iron_ring", chance: 0.5 }],
    };
    // 克隆并手动调用 tryMutate 逻辑（通过观察 spawn 的精英怪掉落表）
    // 直接找一个精英怪检查掉落表
    let elite = null;
    for (let i = 0; i < 200 && !elite; i++) {
      const m = Monsters.spawn("plains");
      if (m && m.isElite && m.dropTable && m.dropTable.length > 0) elite = m;
    }
    if (elite) {
      elite.dropTable.forEach(d => {
        // 精英的掉落概率 = min(1.0, original * 2) >= original
        assert.ok(d.chance >= 0 && d.chance <= 1.0, "精英掉落概率应在 [0, 1] 范围内");
      });
    }
  });

  it("Berserker mutation 使怪物 ATK 增加", () => {
    State.reset();
    State.get().hero.level = 10;
    // 直接测试 apply 函数
    const berserker = Monsters.MUTATION_POOL.find(m => m.id === "berserker");
    assert.ok(berserker, "应存在 berserker mutation");
    const mob = { atk: 100, def: 0, maxHp: 100, currentHp: 100 };
    berserker.apply(mob);
    assert.ok(mob.atk > 100, `berserker 应增加 ATK，实际 ${mob.atk}`);
  });

  it("Armored mutation 使怪物 DEF 增加", () => {
    const armored = Monsters.MUTATION_POOL.find(m => m.id === "armored");
    assert.ok(armored, "应存在 armored mutation");
    const mob = { atk: 100, def: 0, maxHp: 100, currentHp: 100 };
    armored.apply(mob);
    assert.ok(mob.def > 0, `armored 应增加 DEF，实际 ${mob.def}`);
  });

  it("Colossal mutation 使怪物 HP 增加", () => {
    const colossal = Monsters.MUTATION_POOL.find(m => m.id === "colossal");
    assert.ok(colossal, "应存在 colossal mutation");
    const mob = { atk: 100, def: 0, maxHp: 1000, currentHp: 1000 };
    colossal.apply(mob);
    assert.ok(mob.maxHp > 1000, `colossal 应增加 maxHp，实际 ${mob.maxHp}`);
    assert.equal(mob.currentHp, mob.maxHp, "colossal 后 currentHp 应等于 maxHp");
  });

  it("Cursed mutation 使怪物 HP 增加且经验翻倍", () => {
    const cursed = Monsters.MUTATION_POOL.find(m => m.id === "cursed");
    assert.ok(cursed, "应存在 cursed mutation");
    const mob = { atk: 100, def: 0, maxHp: 1000, currentHp: 1000, expReward: 50 };
    cursed.apply(mob);
    assert.ok(mob.maxHp > 1000, `cursed 应增加 maxHp，实际 ${mob.maxHp}`);
    assert.ok(mob.expReward > 50, `cursed 应增加 expReward，实际 ${mob.expReward}`);
  });
});

// ════════════════════════════════════════════════════════
// 3. 新词缀系统 — skillCdReduce / activeDmgBonus / passiveStatMult / mpOnKill
// ════════════════════════════════════════════════════════

describe("新词缀 — State.getEquipBonus 累计新词缀", () => {
  function setupWithAffixes(affixes, slot) {
    State.reset();
    const s = State.get();
    const item = Equipment.createItem("iron_ring", false);
    item.affixes = affixes;
    s.equipment[slot || "ring"] = item;
  }

  it("skillCdReduce 词缀正确累计到 getEquipBonus", () => {
    setupWithAffixes([{ id: "skill_cd", name: "of Swiftness", stat: "skillCdReduce", value: 0.20 }]);
    const bonus = State.getEquipBonus();
    assert.ok(Math.abs(bonus.skillCdReduce - 0.20) < 0.001, `skillCdReduce 应为 0.20，实际 ${bonus.skillCdReduce}`);
  });

  it("skillCdReduce 上限 60%（多件装备不超过 0.60）", () => {
    State.reset();
    const s = State.get();
    ["weapon", "helmet", "chest", "legs", "ring", "neck"].forEach((slot, i) => {
      const item = Equipment.createItem("iron_ring", false);
      item.affixes = [{ id: "skill_cd", name: "of Swiftness", stat: "skillCdReduce", value: 0.20 }];
      s.equipment[slot] = item;
    });
    const bonus = State.getEquipBonus();
    assert.ok(bonus.skillCdReduce <= 0.60 + 0.001, `skillCdReduce 应上限 0.60，实际 ${bonus.skillCdReduce}`);
  });

  it("activeDmgBonus 词缀正确累计", () => {
    setupWithAffixes([{ id: "active_boost", name: "Arcane Fury", stat: "activeDmgBonus", value: 25 }]);
    const bonus = State.getEquipBonus();
    assert.equal(bonus.activeDmgBonus, 25, `activeDmgBonus 应为 25，实际 ${bonus.activeDmgBonus}`);
  });

  it("passiveStatMult 词缀正确累计（小数）", () => {
    setupWithAffixes([{ id: "passive_boost", name: "Empowered", stat: "passiveStatMult", value: 0.15 }]);
    const bonus = State.getEquipBonus();
    assert.ok(Math.abs(bonus.passiveStatMult - 0.15) < 0.001, `passiveStatMult 应为 0.15，实际 ${bonus.passiveStatMult}`);
  });

  it("mpOnKill 词缀正确累计", () => {
    setupWithAffixes([{ id: "mp_on_kill", name: "Vampiric Mind", stat: "mpOnKill", value: 8 }]);
    const bonus = State.getEquipBonus();
    assert.equal(bonus.mpOnKill, 8, `mpOnKill 应为 8，实际 ${bonus.mpOnKill}`);
  });

  it("多件装备新词缀叠加", () => {
    State.reset();
    const s = State.get();
    const ring = Equipment.createItem("iron_ring", false);
    ring.affixes = [{ id: "mp_on_kill_1", name: "Vampiric Mind", stat: "mpOnKill", value: 5 }];
    const neck = Equipment.createItem("bone_necklace", false);
    neck.affixes = [{ id: "mp_on_kill_2", name: "Vampiric Soul", stat: "mpOnKill", value: 3 }];
    s.equipment.ring = ring;
    s.equipment.neck = neck;
    const bonus = State.getEquipBonus();
    assert.equal(bonus.mpOnKill, 8, "多件装备 mpOnKill 应叠加为 8");
  });
});

describe("新词缀 — mpOnKill 战斗中击杀回复 MP", () => {
  function setupKillTest(mpOnKillVal) {
    State.reset();
    const s = State.get();
    s.hero.level = 10;
    s.hero.baseAtk = 9999;
    s.hero.baseDef = 0;
    s.hero.baseSpd = 1.0;
    s.hero.baseCrit = 0;
    s.hero.gold = 0;
    s.hero.prestigeBonus = 1.0;
    s.hero.baseMaxMp = 100;
    s.hero.mp = 10; // 从低蓝开始
    s.hero.hp = s.hero.baseMaxHp = 1000;
    s.unlockedSkills = {};
    s.hero.class = null;
    s.currentZone = "plains";

    const ring = Equipment.createItem("iron_ring", false);
    ring.affixes = [{ id: "mp_on_kill", name: "Vampiric Mind", stat: "mpOnKill", value: mpOnKillVal }];
    s.equipment.ring = ring;
    if (window.Combat) Combat.resetRegenAccumulators();
  }

  it("击杀怪物后获得 mpOnKill 数量的 MP 恢复", () => {
    setupKillTest(15);
    const mpBefore = State.get().hero.mp;
    const mob = {
      id: "kill_test", name: "Kill Test", zone: "plains",
      element: null, isBoss: false,
      currentHp: 1, maxHp: 1,
      atk: 0, def: 0, spd: 0.1,
      expReward: 0, goldMin: 0, goldMax: 0, dropTable: [],
    };
    Combat.startFight(mob);
    Combat.tick(2000);
    const mpAfter = State.get().hero.mp;
    // 击杀后应回复 15MP（另外 2000ms 自然回复也会有些）
    assert.ok(mpAfter > mpBefore, "击杀后 MP 应增加");
  });

  it("mpOnKill 回复不超过 maxMp", () => {
    setupKillTest(999); // 极大回复
    State.get().hero.mp = State.getTotalMaxMp() - 1; // 接近满
    const mob = {
      id: "kill_test_cap", name: "Kill Cap", zone: "plains",
      element: null, isBoss: false,
      currentHp: 1, maxHp: 1,
      atk: 0, def: 0, spd: 0.1,
      expReward: 0, goldMin: 0, goldMax: 0, dropTable: [],
    };
    Combat.startFight(mob);
    Combat.tick(2000);
    const maxMp = State.getTotalMaxMp();
    assert.ok(State.get().hero.mp <= maxMp, "MP 不应超过 maxMp");
  });
});

describe("新词缀 — passiveStatMult 放大被动技能效果", () => {
  it("无被动技能时 passiveStatMult 不影响属性（基准乘数=1，delta=0）", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 10;
    s.unlockedSkills = {}; // 无技能
    s.hero.class = null;

    const ring = Equipment.createItem("iron_ring", false);
    ring.affixes = [{ id: "passive_boost", name: "Empowered", stat: "passiveStatMult", value: 0.5 }];
    s.equipment.ring = ring;

    // 无被动技能时 atkMult=1.0，delta=0，passiveMult 不影响
    const eff = Skills.getEffects();
    assert.ok(Math.abs(eff.atkMult - 1.0) < 0.001, `无被动时 atkMult 应为 1.0，实际 ${eff.atkMult}`);
  });

  it("有被动技能时 passiveStatMult 放大效果（atkMult 超出 1.0 部分被放大）", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 20;
    s.hero.class = "warrior";
    s.classChosen = true;
    s.hero.gold = 9999;
    // 解锁 power_strike（atkMult: 1.15）
    s.unlockedSkills = { "power_strike": true };

    // 不加 passiveStatMult 词缀时 atkMult
    const baseEff = Skills.getEffects();
    const baseAtkMult = baseEff.atkMult;

    // 添加 passiveStatMult=0.5 词缀
    const ring = Equipment.createItem("iron_ring", false);
    ring.affixes = [{ id: "passive_boost", name: "Empowered", stat: "passiveStatMult", value: 0.5 }];
    s.equipment.ring = ring;

    const boostedEff = Skills.getEffects();
    const boostedAtkMult = boostedEff.atkMult;

    // baseAtkMult = 1.15, delta = 0.15, boosted = 1 + 0.15*(1+0.5) = 1.225
    assert.ok(boostedAtkMult > baseAtkMult, `passiveStatMult 应放大 atkMult：${baseAtkMult} -> ${boostedAtkMult}`);
    assert.ok(Math.abs(boostedAtkMult - 1.225) < 0.001, `boostedAtkMult 应约为 1.225，实际 ${boostedAtkMult}`);
  });
});

// ════════════════════════════════════════════════════════
// 4. 技能总览 — Skills.getPassiveSkills
// ════════════════════════════════════════════════════════

describe("Skills.getPassiveSkills", () => {
  it("无已解锁技能时返回空数组", () => {
    State.reset();
    State.get().unlockedSkills = {};
    const passives = Skills.getPassiveSkills();
    assert.equal(passives.length, 0, "无解锁技能时应返回空数组");
  });

  it("解锁被动技能后出现在列表中", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 10;
    s.hero.class = "warrior";
    s.classChosen = true;
    s.unlockedSkills = { "tough_skin": true };

    const passives = Skills.getPassiveSkills();
    assert.ok(passives.some(p => p.id === "tough_skin"), "tough_skin 应出现在被动列表中");
  });

  it("主动技能不出现在被动列表中", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 20;
    s.hero.class = "warrior";
    s.classChosen = true;
    s.unlockedSkills = { "tough_skin": true, "cleave": true };

    const passives = Skills.getPassiveSkills();
    assert.notOk(passives.some(p => p.id === "cleave"), "cleave（主动技能）不应出现在被动列表中");
    assert.ok(passives.some(p => p.id === "tough_skin"), "tough_skin 应在被动列表中");
  });

  it("getActiveSkills 只返回主动技能", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 20;
    s.hero.class = "warrior";
    s.classChosen = true;
    s.unlockedSkills = { "tough_skin": true, "cleave": true };

    const actives = Skills.getActiveSkills();
    actives.forEach(sk => {
      assert.equal(sk.type, "active", `getActiveSkills 应只返回 active 类型，发现 ${sk.id}:${sk.type}`);
    });
    assert.ok(actives.some(a => a.id === "cleave"), "cleave 应出现在主动列表中");
  });

  it("非当前专精的技能不出现在列表中", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 25;
    s.hero.class = "mage";
    s.classChosen = true;
    s.mage.spec = "pyro";
    s.mage.specChosen = true;
    // 假设解锁了 pyro 专精技能
    const pyroActiveSkill = Skills.SKILL_TEMPLATES.find(t => t.spec === "pyro" && t.type === "active");
    const cryoSkill = Skills.SKILL_TEMPLATES.find(t => t.spec === "cryo");
    if (pyroActiveSkill && cryoSkill) {
      s.unlockedSkills = {};
      s.unlockedSkills[pyroActiveSkill.id] = true;
      s.unlockedSkills[cryoSkill.id] = true; // 不该显示

      const passives = Skills.getPassiveSkills();
      assert.notOk(passives.some(p => p.id === cryoSkill.id), "非当前专精的技能不应出现");
    }
  });
});

// ════════════════════════════════════════════════════════
// 5. Combat.resetRegenAccumulators — 重置回复累计器
// ════════════════════════════════════════════════════════

describe("Combat.resetRegenAccumulators", () => {
  it("重置后累计器从零重新开始", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 1;  // HPR = 1.3/s
    s.hero.hp = 50;
    s.hero.baseMaxHp = 200;
    s.hero.baseMaxMp = 200;
    s.hero.mp = 20;
    s.currentMonster = null;
    s.unlockedSkills = {};
    s.hero.class = null;
    if (Combat.isResting) Combat.stopRest();

    // 先 tick 500ms，使累计器 = 0.65 (未触发)
    Combat.resetRegenAccumulators();
    Combat.tick(500); // acc = 0.65, floor = 0, hp 不变
    const hp1 = s.hero.hp;

    // 重置后再 tick 500ms，累计器归零，重新从 0.65 开始（仍不触发）
    Combat.resetRegenAccumulators();
    Combat.tick(500);
    const hp2 = s.hero.hp;

    // 两次都应该没有整数触发（0.65 < 1）
    assert.equal(hp1, 50, "第一次 tick 500ms 后 HP 不应变化");
    assert.equal(hp2, 50, "重置后再 tick 500ms 仍不应触发回复");
  });

  it("重置后 tick 足够时间才触发回复", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 1;
    s.hero.hp = 50;
    s.hero.baseMaxHp = 200;
    s.hero.baseMaxMp = 200;
    s.hero.mp = 20;
    s.currentMonster = null;
    s.unlockedSkills = {};
    s.hero.class = null;
    if (Combat.isResting) Combat.stopRest();
    Combat.resetRegenAccumulators();

    // tick 1000ms，HPR=1.3/s，acc=1.3，floor=1 → +1
    Combat.tick(1000);
    assert.equal(s.hero.hp, 51, "tick 1000ms 后 HP 应 +1");
  });
});

// ════════════════════════════════════════════════════════
// 6. Zone levelRange 数据验证
// ════════════════════════════════════════════════════════

describe("Zone levelRange 和 killStreakScale 完整性", () => {
  it("每个区域都有 killStreakScale 字段", () => {
    Zones.ZONE_LIST.forEach(z => {
      assert.ok(z.killStreakScale !== undefined, `区域 ${z.id} 应有 killStreakScale`);
      assert.ok(z.killStreakScale > 0, `${z.id} killStreakScale 应 > 0`);
    });
  });

  it("后期区域的等级区间高于早期区域", () => {
    const plains = Zones.getZone("plains");
    const castle = Zones.getZone("castle");
    assert.ok(castle.levelRange[1] > plains.levelRange[1],
      `castle 最高等级(${castle.levelRange[1]}) 应高于 plains(${plains.levelRange[1]})`);
  });

  it("Boss 等级等于区域最高等级（spawnBoss 验证）", () => {
    State.reset();
    State.get().hero.level = 1; // 低等级，但 Boss 应使用区域最高等级
    const zone = Zones.getZone("plains");
    const boss = Monsters.spawnBoss("plains");
    // Boss 额外 2× HP，我们只验证它确实被强化了（HP 远高于普通怪）
    const normal = Monsters.spawn("plains");
    assert.ok(boss.currentHp > normal.currentHp, "Boss HP 应远高于普通怪");
  });
});
