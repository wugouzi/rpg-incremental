// test-monsters-zones.js — Monsters & Zones 模块测试

// ──────────────────────────────────────────
// Monsters
// ──────────────────────────────────────────

describe("Monsters.TEMPLATES 数据完整性", () => {
  it("模板不为空", () => {
    assert.ok(Monsters.TEMPLATES.length > 0);
  });

  it("每个模板包含必要字段", () => {
    Monsters.TEMPLATES.forEach(t => {
      assert.ok(t.id,       `模板 ${t.id} 缺少 id`);
      assert.ok(t.name,     `模板 ${t.id} 缺少 name`);
      assert.ok(t.zone,     `模板 ${t.id} 缺少 zone`);
      assert.ok(t.baseHp > 0, `模板 ${t.id} baseHp 应 > 0`);
      assert.ok(t.baseAtk >= 0, `模板 ${t.id} baseAtk 应 >= 0`);
      assert.ok(t.expReward >= 0, `模板 ${t.id} expReward 应 >= 0`);
      assert.ok(t.goldReward && t.goldReward.min >= 0, `模板 ${t.id} goldReward 格式错误`);
      assert.ok(Array.isArray(t.dropTable), `模板 ${t.id} dropTable 应为数组`);
    });
  });

  it("每个区域都有 Boss", () => {
    const zones = ["plains", "forest", "cave", "desert", "castle"];
    zones.forEach(z => {
      const hasBoss = Monsters.TEMPLATES.some(t => t.zone === z && t.isBoss);
      assert.ok(hasBoss, `区域 ${z} 缺少 Boss`);
    });
  });

  it("每个区域都有至少一个普通怪物", () => {
    const zones = ["plains", "forest", "cave", "desert", "castle"];
    zones.forEach(z => {
      const hasNormal = Monsters.TEMPLATES.some(t => t.zone === z && !t.isBoss);
      assert.ok(hasNormal, `区域 ${z} 缺少普通怪物`);
    });
  });

  it("Boss 的 weight 为 0（不被随机选中）", () => {
    Monsters.TEMPLATES.filter(t => t.isBoss).forEach(t => {
      assert.equal(t.weight, 0, `Boss ${t.id} weight 应为 0`);
    });
  });

  it("掉落概率在 0~1 范围内", () => {
    Monsters.TEMPLATES.forEach(t => {
      t.dropTable.forEach(d => {
        assert.between(d.chance, 0, 1, `${t.id} 掉落概率越界`);
      });
    });
  });
});

describe("Monsters.spawn", () => {
  it("返回包含 currentHp/maxHp/atk 的实例", () => {
    State.reset();
    const inst = Monsters.spawn("plains");
    assert.ok(inst, "spawn 应返回对象");
    assert.ok(inst.currentHp > 0, "currentHp 应 > 0");
    assert.ok(inst.maxHp > 0, "maxHp 应 > 0");
    assert.equal(inst.currentHp, inst.maxHp, "初始 currentHp 应等于 maxHp");
    assert.ok(inst.atk >= 0, "atk 应 >= 0");
  });

  it("只从指定区域选取怪物", () => {
    State.reset();
    for (let i = 0; i < 30; i++) {
      const inst = Monsters.spawn("forest");
      assert.equal(inst.zone, "forest", "spawn 应只返回 forest 区域怪物");
    }
  });

  it("spawn 不返回 Boss", () => {
    State.reset();
    for (let i = 0; i < 50; i++) {
      const inst = Monsters.spawn("plains");
      assert.notOk(inst.isBoss, "spawn 不应返回 Boss");
    }
  });

  it("高等级玩家生成的怪物更强", () => {
    State.reset();
    State.get().hero.level = 1;
    const weak = Monsters.spawn("plains");

    State.get().hero.level = 20;
    const strong = Monsters.spawn("plains");

    assert.greaterThan(strong.currentHp, weak.currentHp, "高等级怪物 HP 应更高");
    State.reset();
  });
});

describe("Monsters.spawnBoss", () => {
  it("返回 Boss 实例", () => {
    State.reset();
    const boss = Monsters.spawnBoss("plains");
    assert.ok(boss, "spawnBoss 应返回对象");
    assert.ok(boss.isBoss, "应标记 isBoss=true");
  });

  it("Boss HP 远高于普通怪物", () => {
    State.reset();
    const normal = Monsters.spawn("plains");
    const boss   = Monsters.spawnBoss("plains");
    assert.greaterThan(boss.currentHp, normal.currentHp * 2, "Boss HP 应远高于普通怪");
  });

  it("不存在的区域返回 null", () => {
    State.reset();
    const result = Monsters.spawnBoss("nonexistent");
    assert.equal(result, null);
  });
});

describe("Monsters.getTemplate / getByZone", () => {
  it("getTemplate 返回正确模板", () => {
    const t = Monsters.getTemplate("slime");
    assert.ok(t);
    assert.equal(t.id, "slime");
    assert.equal(t.zone, "plains");
  });

  it("getTemplate 不存在时返回 null", () => {
    assert.equal(Monsters.getTemplate("fake_id"), null);
  });

  it("getByZone 只返回指定区域的模板", () => {
    const list = Monsters.getByZone("forest");
    assert.ok(list.length > 0);
    list.forEach(t => assert.equal(t.zone, "forest", "应全部属于 forest"));
  });
});

// ──────────────────────────────────────────
// Zones
// ──────────────────────────────────────────

describe("Zones.ZONE_LIST 数据完整性", () => {
  it("包含5个区域", () => {
    assert.equal(Zones.ZONE_LIST.length, 5);
  });

  it("plains 是初始区域（unlockCondition 为 null）", () => {
    const plains = Zones.getZone("plains");
    assert.equal(plains.unlockCondition, null);
  });

  it("每个区域有 id / name / description", () => {
    Zones.ZONE_LIST.forEach(z => {
      assert.ok(z.id, `区域缺少 id`);
      assert.ok(z.name, `区域 ${z.id} 缺少 name`);
      assert.ok(z.description, `区域 ${z.id} 缺少 description`);
    });
  });

  it("解锁链形成合法链条（每个区域最多被一个前置引用）", () => {
    const conditionCounts = {};
    Zones.ZONE_LIST.forEach(z => {
      if (z.unlockCondition) {
        conditionCounts[z.unlockCondition] = (conditionCounts[z.unlockCondition] || 0) + 1;
      }
    });
    Object.entries(conditionCounts).forEach(([zoneId, count]) => {
      assert.equal(count, 1, `区域 ${zoneId} 被多个区域引用为前置`);
    });
  });
});

describe("Zones.isUnlocked / getUnlocked", () => {
  it("初始只有 plains 解锁", () => {
    State.reset();
    assert.ok(Zones.isUnlocked("plains"));
    assert.notOk(Zones.isUnlocked("forest"));
    assert.notOk(Zones.isUnlocked("cave"));
  });

  it("getUnlocked 与 State.unlockedZones 一致", () => {
    State.reset();
    const unlocked = Zones.getUnlocked();
    assert.equal(unlocked.length, 1);
    assert.equal(unlocked[0].id, "plains");
  });
});

describe("Zones.onBossDefeated", () => {
  it("击败 plains Boss 后解锁 forest", () => {
    State.reset();
    Zones.onBossDefeated("plains");
    assert.ok(Zones.isUnlocked("forest"), "forest 应被解锁");
    assert.ok(State.get().bossDefeated["plains"], "plains Boss 应标记为已击败");
  });

  it("stats.bossesDefeated 计数增加", () => {
    State.reset();
    const before = State.get().stats.bossesDefeated;
    Zones.onBossDefeated("plains");
    assert.equal(State.get().stats.bossesDefeated, before + 1);
  });

  it("连续击败 Boss 依次解锁区域链", () => {
    State.reset();
    const chain = ["plains", "forest", "cave", "desert"];
    chain.forEach((z, i) => {
      Zones.onBossDefeated(z);
      const nextZone = Zones.ZONE_LIST.find(zz => zz.unlockCondition === z);
      if (nextZone) {
        assert.ok(Zones.isUnlocked(nextZone.id), `击败 ${z} Boss 后应解锁 ${nextZone.id}`);
      }
    });
    State.reset();
  });
});

describe("Zones.enterZone", () => {
  it("进入已解锁区域成功", () => {
    State.reset();
    const ok = Zones.enterZone("plains");
    assert.ok(ok);
    assert.equal(State.get().currentZone, "plains");
  });

  it("进入未解锁区域失败", () => {
    State.reset();
    const ok = Zones.enterZone("forest");
    assert.notOk(ok, "未解锁区域不应能进入");
    assert.equal(State.get().currentZone, "plains", "当前区域不应改变");
  });

  it("切换区域后 currentMonster 清空", () => {
    State.reset();
    State.get().currentMonster = { name: "Test" };
    Zones.enterZone("plains");
    assert.equal(State.get().currentMonster, null);
  });
});

describe("Zones.isBossDefeated", () => {
  it("初始未击败", () => {
    State.reset();
    assert.notOk(Zones.isBossDefeated("plains"));
  });

  it("击败后标记为 true", () => {
    State.reset();
    Zones.onBossDefeated("plains");
    assert.ok(Zones.isBossDefeated("plains"));
    State.reset();
  });
});
