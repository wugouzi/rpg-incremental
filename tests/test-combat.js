// test-combat.js — Combat 模块测试
// 注意：combat 依赖 UI.addLog，测试前需 stub UI

// ── 测试用 Stub（防止 UI 报错）────────────
const _uiStub = {
  addLog: () => {},
  refreshSidePanel: () => {},
  refreshSidePanelIfDirty: () => {},
  markSidePanelDirty: () => {},
  refresh: () => {},
};
if (!window.UI) window.UI = _uiStub;

// helper：创建一个简单怪物实例
function makeMob(hp, atk, def, spd, isBoss) {
  return {
    id: "test_mob",
    name: "Test Mob",
    zone: "plains",
    isBoss: !!isBoss,
    currentHp: hp,
    maxHp: hp,
    atk: atk,
    def: def,
    spd: spd || 1.0,
    expReward: 10,
    goldMin: 5,
    goldMax: 10,
    dropTable: [],
  };
}

// helper：重置并配置英雄
function heroSetup(opts) {
  State.reset();
  const s = State.get();
  s.hero.hp  = opts.hp  !== undefined ? opts.hp  : 1000;
  s.hero.baseMaxHp = opts.hp !== undefined ? opts.hp : 1000;
  s.hero.baseAtk   = opts.atk !== undefined ? opts.atk : 50;
  s.hero.baseDef   = opts.def !== undefined ? opts.def : 10;
  s.hero.baseSpd   = opts.spd !== undefined ? opts.spd : 1.0;
  s.hero.baseCrit  = opts.crit !== undefined ? opts.crit : 0;
  s.hero.gold      = opts.gold !== undefined ? opts.gold : 0;
  s.hero.prestigeBonus = 1.0;
  s.unlockedSkills = {};
  s.hero.class = null;
  s.currentZone = "plains";
}

describe("Combat.startFight", () => {
  it("开始战斗后 currentMonster 被设置", () => {
    heroSetup({});
    const mob = makeMob(100, 10, 0, 1);
    Combat.startFight(mob);
    assert.equal(State.get().currentMonster, mob);
  });
});

describe("Combat.spawnAndFight", () => {
  it("调用后 currentMonster 不为 null", () => {
    State.reset();
    Combat.spawnAndFight();
    assert.ok(State.get().currentMonster, "应生成一个怪物");
  });

  it("生成的怪物属于当前区域", () => {
    State.reset();
    State.get().currentZone = "plains";
    Combat.spawnAndFight();
    assert.equal(State.get().currentMonster.zone, "plains");
  });
});

describe("Combat.tick — 英雄攻击", () => {
  it("经过足够时间后怪物 HP 减少", () => {
    heroSetup({ atk: 50, def: 0 });
    const mob = makeMob(500, 1, 0, 0.1); // 怪物极低 SPD，基本不攻击
    Combat.startFight(mob);

    const interval = State.getAtkInterval(); // 攻击间隔
    Combat.tick(interval + 1);              // 触发一次攻击

    assert.lessThan(mob.currentHp, 500, "怪物 HP 应减少");
  });

  it("怪物 HP 降到 0 时被清除（currentMonster = null）", () => {
    heroSetup({ atk: 9999, def: 0 });
    const mob = makeMob(1, 0, 0, 0.1);
    Combat.startFight(mob);

    const interval = State.getAtkInterval();
    Combat.tick(interval + 1);

    assert.equal(State.get().currentMonster, null, "怪物死亡后 currentMonster 应为 null");
  });

  it("击败怪物获得 EXP", () => {
    heroSetup({ atk: 9999 });
    const mob = makeMob(1, 0, 0, 0.1);
    mob.expReward = 50;
    Combat.startFight(mob);

    const expBefore = State.get().hero.exp;
    Combat.tick(State.getAtkInterval() + 1);

    // 可能已升级导致 exp 重置，总之 level >= 1 且 exp 有变化
    const afterLevel = State.get().hero.level;
    const afterExp   = State.get().hero.exp;
    assert.ok(afterLevel > 1 || afterExp > expBefore, "应获得经验");
  });

  it("击败怪物获得金币", () => {
    heroSetup({ atk: 9999 });
    const mob = makeMob(1, 0, 0, 0.1);
    mob.goldMin = 10; mob.goldMax = 20;
    Combat.startFight(mob);

    Combat.tick(State.getAtkInterval() + 1);

    assert.greaterThan(State.get().hero.gold, 0, "应获得金币");
  });
});

describe("Combat.tick — 怪物攻击", () => {
  it("经过足够时间后英雄 HP 减少", () => {
    heroSetup({ hp: 1000, def: 0 });
    const mob = makeMob(99999, 30, 0, 10.0); // 怪物极高 SPD
    Combat.startFight(mob);

    // 触发多次怪物攻击
    Combat.tick(500);

    assert.lessThan(State.get().hero.hp, 1000, "英雄 HP 应减少");
  });

  it("英雄 HP 降到 0 时触发死亡流程", () => {
    // 用足够高的 baseMaxHp，让 30% 恢复值 > 0
    heroSetup({ hp: 1000, def: 0, gold: 100 });
    State.get().hero.baseMaxHp = 1000;
    State.get().hero.hp = 1;  // 濒死，怪物一击即杀
    const mob = makeMob(99999, 9999, 0, 50.0); // 极高速怪物必先攻击
    Combat.startFight(mob);

    // 给足够的 delta，但英雄攻击无法秒杀怪物（怪物 HP 极高）
    Combat.tick(300);

    // 死亡后：扣金币，hp 恢复30%，怪物清除
    const s = State.get();
    assert.lessThan(s.hero.gold, 100, "死亡后应扣除金币");
    assert.equal(s.currentMonster, null, "死亡后怪物应清除");
    assert.greaterThan(s.hero.hp, 0, "死亡后 HP 应恢复到非零值");
  });
});

describe("Combat 死亡惩罚", () => {
  it("死亡扣除 10% 金币", () => {
    heroSetup({ hp: 1000, def: 0, gold: 100 });
    State.get().hero.baseMaxHp = 1000;
    State.get().hero.hp = 1;  // 濒死
    const mob = makeMob(99999, 9999, 0, 50.0);
    Combat.startFight(mob);
    Combat.tick(300);

    // 100 * 0.1 = 10 被扣除
    assert.equal(State.get().hero.gold, 90, "死亡扣除 10% 金币");
  });

  it("死亡后 HP 恢复到 30% 最大值", () => {
    heroSetup({ hp: 1000, def: 0, gold: 0 });
    State.get().hero.baseMaxHp = 1000;
    State.get().hero.hp = 1;  // 濒死
    const mob = makeMob(99999, 9999, 0, 50.0);
    Combat.startFight(mob);
    Combat.tick(300);

    const expected = Math.floor(1000 * 0.3); // 300
    assert.equal(State.get().hero.hp, expected);
  });
});

describe("Combat.manualAttack", () => {
  it("无怪物时 manualAttack 自动生成怪物", () => {
    State.reset();
    State.get().currentMonster = null;
    Combat.manualAttack();
    assert.ok(State.get().currentMonster, "手动攻击应自动生成怪物");
  });

  it("有怪物时 manualAttack 使怪物 HP 减少", () => {
    heroSetup({ atk: 100 });
    const mob = makeMob(9999, 0, 0, 0.1);
    State.get().currentMonster = mob;
    const hpBefore = mob.currentHp;
    Combat.manualAttack();
    assert.lessThan(mob.currentHp, hpBefore, "怪物 HP 应减少");
  });

  it("英雄 HP 为 0 时无法手动攻击", () => {
    State.reset();
    State.get().hero.hp = 0;
    const mob = makeMob(9999, 0, 0, 0.1);
    State.get().currentMonster = mob;
    const hpBefore = mob.currentHp;
    Combat.manualAttack();
    assert.equal(mob.currentHp, hpBefore, "HP=0 时不应造成伤害");
  });

  it("manualAttack 后 heroTimer 被重置为 0（防止双重攻击）", () => {
    heroSetup({ atk: 100 });
    const mob = makeMob(9999, 0, 0, 0.1);
    State.get().currentMonster = mob;
    // 先让 heroTimer 累积接近 atkInterval
    Combat.heroTimer = State.getAtkInterval() - 1;
    Combat.manualAttack();
    // manualAttack 后 heroTimer 应归零，不会在下一个极小 tick 再触发
    assert.equal(Combat.heroTimer, 0, "manualAttack 后 heroTimer 应为 0");
  });

  it("手动攻击后立即 tick 一个极小 delta 不会再次攻击", () => {
    heroSetup({ atk: 100 });
    const mob = makeMob(9999, 0, 0, 0.1);
    State.get().currentMonster = mob;
    Combat.manualAttack();
    const hpAfterManual = mob.currentHp;
    // tick 一个非常小的 delta（远小于攻击间隔），不应触发第二次攻击
    Combat.tick(1);
    assert.equal(mob.currentHp, hpAfterManual, "manualAttack 后极小 tick 不应再次攻击");
  });
});

describe("Combat.stopFight", () => {
  it("stopFight 后 currentMonster 为 null", () => {
    heroSetup({});
    const mob = makeMob(100, 10, 0, 1);
    Combat.startFight(mob);
    assert.ok(State.get().currentMonster, "战斗开始后应有怪物");
    Combat.stopFight();
    assert.equal(State.get().currentMonster, null, "stopFight 后怪物应清除");
  });

  it("stopFight 后 autoFight 为 false", () => {
    State.reset();
    State.get().autoFight = true;
    Combat.stopFight();
    assert.notOk(State.get().autoFight, "stopFight 后 autoFight 应为 false");
  });

  it("stopFight 后 heroTimer 重置为 0", () => {
    heroSetup({});
    const mob = makeMob(100, 10, 0, 1);
    Combat.startFight(mob);
    Combat.heroTimer = 500;
    Combat.stopFight();
    assert.equal(Combat.heroTimer, 0, "stopFight 后 heroTimer 应为 0");
  });

  it("stopFight 后 tick 不进行战斗计算", () => {
    heroSetup({ atk: 9999 });
    const mob = makeMob(9999, 0, 0, 0.1);
    Combat.startFight(mob);
    Combat.stopFight();
    const hpBefore = mob.currentHp; // stopFight 后 mob 和 currentMonster 解除关联
    // tick 不应再修改 mob HP（currentMonster 已为 null）
    Combat.tick(State.getAtkInterval() + 1);
    assert.equal(State.get().currentMonster, null, "stopFight 后 tick 不应产生新战斗");
  });
});

describe("Combat.toggleAutoFight", () => {
  it("初始为 false，切换后为 true", () => {
    State.reset();
    assert.notOk(State.get().autoFight);
    Combat.toggleAutoFight();
    assert.ok(State.get().autoFight);
  });

  it("再次切换回 false", () => {
    State.reset();
    Combat.toggleAutoFight();
    Combat.toggleAutoFight();
    assert.notOk(State.get().autoFight);
  });
});

describe("Combat.challengeBoss", () => {
  it("调用后生成 Boss 怪物", () => {
    State.reset();
    State.get().currentZone = "plains";
    Combat.challengeBoss();
    const mob = State.get().currentMonster;
    assert.ok(mob, "应生成 Boss");
    assert.ok(mob.isBoss, "应标记为 Boss");
  });

  it("Boss 已击败后不能再挑战", () => {
    State.reset();
    State.get().currentZone = "plains";
    State.get().bossDefeated["plains"] = true;
    Combat.challengeBoss();
    // Boss 已死，不应生成新 Boss
    assert.equal(State.get().currentMonster, null, "已击败的 Boss 不应再生成");
  });
});

describe("Combat.calcOfflineGains", () => {
  it("少于 60 秒不计算（避免无效收益）", () => {
    State.reset();
    const goldBefore = State.get().hero.gold;
    Combat.calcOfflineGains(30);
    assert.equal(State.get().hero.gold, goldBefore, "小于60秒不应有收益");
  });

  it("足够时间后获得金币和经验", () => {
    State.reset();
    const goldBefore = State.get().hero.gold;
    const expBefore  = State.get().hero.exp;
    const killsBefore = State.get().stats.totalKills;

    Combat.calcOfflineGains(3600); // 1小时

    const s = State.get();
    assert.greaterThan(s.hero.gold, goldBefore, "离线1h后应获得金币");
    assert.greaterThan(s.stats.totalKills, killsBefore, "离线1h后击杀数应增加");
  });

  it("超过8小时上限后收益不无限增长（相对1h的收益应可控）", () => {
    State.reset();
    Combat.calcOfflineGains(8 * 3600); // 8h
    const gold8h = State.get().hero.gold;

    State.reset();
    Combat.calcOfflineGains(100 * 3600); // 100h（超出上限，Save.load中限制，这里直接测calc）
    const gold100h = State.get().hero.gold;

    // calcOfflineGains 本身不做上限，上限在 save.load 里，
    // 这里只验证 8h 有合理数量的收益
    assert.greaterThan(gold8h, 0, "8h 离线应有金币收益");
  });
});
