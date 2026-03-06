// test-regen.js — HP/MP 回复系统测试（tickRegen 小数累计 & REST 加速）

// ── Stub ─────────────────────────────────────────────
if (!window.UI) {
  window.UI = {
    addLog: () => {},
    refreshSidePanel: () => {},
    refreshSidePanelIfDirty: () => {},
    markSidePanelDirty: () => {},
    refresh: () => {},
  };
}

// ── 辅助：构建非战斗状态角色 ─────────────────────────
function regenSetup(opts) {
  State.reset();
  const s = State.get();
  s.hero.level      = opts.level !== undefined ? opts.level : 10;
  s.hero.class      = opts.cls || "warrior";
  s.hero.gold       = 9999;
  s.classChosen     = true;
  s.hero.prestigeBonus = 1.0;
  s.unlockedSkills  = {};
  // 设置 HP/MP
  s.hero.baseMaxHp  = opts.maxHp !== undefined ? opts.maxHp : 100;
  s.hero.baseMaxMp  = opts.maxMp !== undefined ? opts.maxMp : 50;
  s.hero.hp         = opts.hp    !== undefined ? opts.hp    : 50;
  s.hero.mp         = opts.mp    !== undefined ? opts.mp    : 20;
  // 无当前怪物（非战斗）
  s.currentMonster  = null;
  // 重置 Combat 内部状态（isResting/hpRegenAcc/mpRegenAcc 等不在 State 里）
  if (window.Combat && Combat.isResting) Combat.stopRest();
}

// 让 tickRegen 小数累计器从零开始（startRest 会重置，非 REST 状态直接 tick）
// 通过先 tick 一次极小 delta 来"预热"，确保 acc 从 0 起
function tickMs(ms) {
  Combat.tick(ms);
}

// ═══════════════════════════════════════════════════════
// 1. getTotalHpr / getTotalMpr 基础值
// ═══════════════════════════════════════════════════════

describe("getTotalHpr / getTotalMpr 基础值", () => {
  it("Lv.1 时 HPR = 0.1/s", () => {
    regenSetup({ level: 1 });
    assert.ok(Math.abs(State.getTotalHpr() - 0.1) < 0.001, `HPR 应约为 0.1，实际: ${State.getTotalHpr()}`);
  });

  it("Lv.1 时 MPR = 0.05/s", () => {
    regenSetup({ level: 1 });
    assert.ok(Math.abs(State.getTotalMpr() - 0.05) < 0.001, `MPR 应约为 0.05，实际: ${State.getTotalMpr()}`);
  });

  it("Lv.10 时 HPR = 1.0/s", () => {
    regenSetup({ level: 10 });
    assert.ok(Math.abs(State.getTotalHpr() - 1.0) < 0.001, `HPR 应约为 1.0，实际: ${State.getTotalHpr()}`);
  });

  it("Lv.10 时 MPR = 0.5/s", () => {
    regenSetup({ level: 10 });
    assert.ok(Math.abs(State.getTotalMpr() - 0.5) < 0.001, `MPR 应约为 0.5，实际: ${State.getTotalMpr()}`);
  });

  it("Lv.20 时 HPR = 2.0/s", () => {
    regenSetup({ level: 20 });
    assert.ok(Math.abs(State.getTotalHpr() - 2.0) < 0.001, `HPR 应约为 2.0，实际: ${State.getTotalHpr()}`);
  });
});

// ═══════════════════════════════════════════════════════
// 2. HP 回复：小数累计正确性
// ═══════════════════════════════════════════════════════

describe("tickRegen — HP 小数累计", () => {
  it("Lv.10（HPR=1/s）：tick 1000ms 后 HP +1", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    const before = State.get().hero.hp;
    tickMs(1000);
    assert.equal(State.get().hero.hp, before + 1);
  });

  it("Lv.10（HPR=1/s）：tick 500ms×2 后 HP +1", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    const before = State.get().hero.hp;
    tickMs(500);
    tickMs(500);
    assert.equal(State.get().hero.hp, before + 1);
  });

  it("Lv.1（HPR=0.1/s）：tick 1000ms×5 后 HP 仍为初始值（0.5 < 1 不触发）", () => {
    regenSetup({ level: 1, hp: 50, maxHp: 100 });
    const before = State.get().hero.hp;
    tickMs(1000); tickMs(1000); tickMs(1000); tickMs(1000); tickMs(1000);
    // 5s 后累计 0.1×5 = 0.5，floor(0.5)=0，仍无变化
    assert.equal(State.get().hero.hp, before);
  });

  it("Lv.1（HPR=0.1/s）：tick 10×1000ms 后 HP +1", () => {
    regenSetup({ level: 1, hp: 50, maxHp: 100 });
    const before = State.get().hero.hp;
    for (let i = 0; i < 10; i++) tickMs(1000);
    // 10s 累计 1.0，整数部分 1 触发
    assert.equal(State.get().hero.hp, before + 1);
  });

  it("HP 不会超过 maxHp", () => {
    regenSetup({ level: 10, hp: 99, maxHp: 100 });
    tickMs(5000); // 5s，HPR=1/s → 应恢复5点但上限100
    assert.equal(State.get().hero.hp, 100);
  });

  it("HP 已满时不回复", () => {
    regenSetup({ level: 10, hp: 100, maxHp: 100 });
    tickMs(3000);
    assert.equal(State.get().hero.hp, 100);
  });
});

// ═══════════════════════════════════════════════════════
// 3. MP 回复：小数累计正确性
// ═══════════════════════════════════════════════════════

describe("tickRegen — MP 小数累计", () => {
  it("Lv.10（MPR=0.5/s）：tick 2000ms 后 MP +1", () => {
    regenSetup({ level: 10, mp: 20, maxMp: 50 });
    const before = State.get().hero.mp;
    tickMs(2000);
    assert.equal(State.get().hero.mp, before + 1);
  });

  it("Lv.10（MPR=0.5/s）：tick 1000ms×4 后 MP +2", () => {
    regenSetup({ level: 10, mp: 20, maxMp: 50 });
    const before = State.get().hero.mp;
    tickMs(1000); tickMs(1000); tickMs(1000); tickMs(1000);
    assert.equal(State.get().hero.mp, before + 2);
  });

  it("Lv.20（MPR=1/s）：tick 1000ms 后 MP +1", () => {
    regenSetup({ level: 20, mp: 20, maxMp: 200 });
    const before = State.get().hero.mp;
    tickMs(1000);
    assert.equal(State.get().hero.mp, before + 1);
  });

  it("MP 不会超过 maxMp", () => {
    regenSetup({ level: 10, mp: 49, maxMp: 50 });
    tickMs(5000);
    assert.equal(State.get().hero.mp, 50);
  });

  it("MP 已满时不回复", () => {
    regenSetup({ level: 10, mp: 50, maxMp: 50 });
    tickMs(3000);
    assert.equal(State.get().hero.mp, 50);
  });
});

// ═══════════════════════════════════════════════════════
// 4. HP/MP 同时回复
// ═══════════════════════════════════════════════════════

describe("tickRegen — HP 和 MP 同时回复", () => {
  it("Lv.10：tick 2000ms 后 HP +2 且 MP +1", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100, mp: 20, maxMp: 50 });
    const s = State.get();
    const hpBefore = s.hero.hp;
    const mpBefore = s.hero.mp;
    tickMs(2000);
    assert.equal(s.hero.hp, hpBefore + 2, "HP 应 +2");
    assert.equal(s.hero.mp, mpBefore + 1, "MP 应 +1");
  });

  it("满血不影响 MP 回复", () => {
    regenSetup({ level: 10, hp: 100, maxHp: 100, mp: 20, maxMp: 50 });
    const s = State.get();
    const mpBefore = s.hero.mp;
    tickMs(2000);
    assert.equal(s.hero.hp, 100, "HP 应保持满");
    assert.equal(s.hero.mp, mpBefore + 1, "MP 应 +1");
  });

  it("满蓝不影响 HP 回复", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100, mp: 50, maxMp: 50 });
    const s = State.get();
    const hpBefore = s.hero.hp;
    tickMs(1000);
    assert.equal(s.hero.hp, hpBefore + 1, "HP 应 +1");
    assert.equal(s.hero.mp, 50, "MP 应保持满");
  });
});

// ═══════════════════════════════════════════════════════
// 5. REST 模式 3× 加速
// ═══════════════════════════════════════════════════════

describe("REST — 3× 回复加速", () => {
  it("startRest：Lv.10（HPR=1/s），REST 下 1000ms 内回复 3HP", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100, mp: 20, maxMp: 50 });
    Combat.startRest();
    assert.ok(Combat.isResting, "isResting 应为 true");
    const hpBefore = State.get().hero.hp;
    tickMs(1000);
    assert.equal(State.get().hero.hp, hpBefore + 3, "REST 模式 HPR×3 应回 3HP");
  });

  it("startRest：Lv.10（MPR=0.5/s），REST 下 2000ms 回复 3MP", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100, mp: 20, maxMp: 50 });
    Combat.startRest();
    const mpBefore = State.get().hero.mp;
    tickMs(2000); // 0.5×3×2 = 3
    assert.equal(State.get().hero.mp, mpBefore + 3, "REST 模式 MPR×3 应回 3MP");
  });

  it("REST 在 5s 后自动结束", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 200, mp: 20, maxMp: 200 });
    Combat.startRest();
    tickMs(5100); // 超过 REST_DURATION(5000ms)
    assert.notOk(Combat.isResting, "5s 后 REST 应自动结束");
  });

  it("满血满蓝时 startRest 被拒绝", () => {
    regenSetup({ level: 10, hp: 100, maxHp: 100, mp: 50, maxMp: 50 });
    Combat.startRest();
    assert.notOk(Combat.isResting, "满血满蓝时不应进入 REST 状态");
  });

  it("REST 期间满血满蓝时自动结束", () => {
    regenSetup({ level: 10, hp: 99, maxHp: 100, mp: 49, maxMp: 50 });
    Combat.startRest();
    assert.ok(Combat.isResting);
    // 再 tick 一段时间让 HP/MP 回满
    tickMs(1000); // HPR×3=3，HP=100（满）；MPR×3=1.5，MP≈50（满）
    // 下一次 tick 的 fullRestore 检查会结束 REST
    tickMs(100);
    assert.notOk(Combat.isResting, "HP/MP 满后 REST 应自动结束");
  });

  it("stopRest 可手动中断", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100, mp: 20, maxMp: 50 });
    Combat.startRest();
    assert.ok(Combat.isResting);
    Combat.stopRest();
    assert.notOk(Combat.isResting, "stopRest 后 isResting 应为 false");
  });

  it("REST 比普通回复快 3 倍", () => {
    // 普通回复
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    const hpBefore1 = State.get().hero.hp;
    tickMs(3000);
    const normalHealed = State.get().hero.hp - hpBefore1;

    // REST 回复
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    Combat.startRest();
    const hpBefore2 = State.get().hero.hp;
    tickMs(3000);
    const restHealed = State.get().hero.hp - hpBefore2;

    assert.equal(restHealed, normalHealed * 3, "REST 回复量应精确为普通的 3 倍");
  });
});

// ═══════════════════════════════════════════════════════
// 6. 战斗中断 REST
// ═══════════════════════════════════════════════════════

describe("REST — 战斗状态交互", () => {
  it("有 currentMonster（活着）时 startRest 被拒绝", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    // 直接修改 state.currentMonster（模拟进入战斗后的状态）
    const s = State.get();
    s.currentMonster = { id: "mob", currentHp: 10, maxHp: 10, atk: 5, def: 0, spd: 1 };
    Combat.startRest();
    assert.notOk(Combat.isResting, "战斗中不应进入 REST");
    s.currentMonster = null; // 清理
  });

  it("REST 中若 currentMonster 出现则自动中断", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    Combat.startRest();
    assert.ok(Combat.isResting);
    // 注入活着的怪物
    const s = State.get();
    s.currentMonster = { id: "mob", currentHp: 10, maxHp: 10, atk: 5, def: 0, spd: 1 };
    tickMs(100);
    assert.notOk(Combat.isResting, "进入战斗后 REST 应被中断");
    s.currentMonster = null; // 清理
  });
});

// ═══════════════════════════════════════════════════════
// 7. 战斗中自然回复
// ═══════════════════════════════════════════════════════

describe("战斗中自然回复", () => {
  // 注入一个"静止"怪物（atk=0 不会反击，让我们只测回复）
  function injectMob(s) {
    s.currentMonster = { id: "mob", name: "Dummy", currentHp: 999, maxHp: 999, atk: 0, def: 0, spd: 0.01, element: null, expReward: 0, goldMin: 0, goldMax: 0, dropTable: [] };
  }

  it("Lv.10（HPR=1/s）：战斗中 tick 1000ms 后 HP +1", () => {
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    const s = State.get();
    injectMob(s);
    const before = s.hero.hp;
    tickMs(1000);
    assert.equal(s.hero.hp, before + 1, "战斗中 HPR 应正常生效");
    s.currentMonster = null;
  });

  it("Lv.10（MPR=0.5/s）：战斗中 tick 2000ms 后 MP +1", () => {
    regenSetup({ level: 10, mp: 20, maxMp: 50 });
    const s = State.get();
    injectMob(s);
    const before = s.hero.mp;
    tickMs(2000);
    assert.equal(s.hero.mp, before + 1, "战斗中 MPR 应正常生效");
    s.currentMonster = null;
  });

  it("战斗中 HP 回复不超过 maxHp", () => {
    regenSetup({ level: 10, hp: 99, maxHp: 100 });
    const s = State.get();
    injectMob(s);
    tickMs(5000);
    assert.equal(s.hero.hp, 100, "HP 不应超过上限");
    s.currentMonster = null;
  });

  it("战斗中 HP 回复速率与非战斗相同（1×，非 REST 加速）", () => {
    // 非战斗
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    tickMs(3000);
    const noFightHealed = State.get().hero.hp - 50;

    // 战斗中（atk=0 的假怪物）
    regenSetup({ level: 10, hp: 50, maxHp: 100 });
    const s = State.get();
    injectMob(s);
    tickMs(3000);
    const fightHealed = s.hero.hp - 50;
    s.currentMonster = null;

    assert.equal(fightHealed, noFightHealed, "战斗中回复量应与非战斗一致");
  });
});
