// test-pyro-ui.js — 火焰法师 UI 状态指示 & 数值调整测试

// ─────────────────────────────────────────────────────────────────
// 工具：纯逻辑版的 Pyro 状态指示生成器（复现 ui.js renderCombatStatus 中的 Pyro 分支）
// ─────────────────────────────────────────────────────────────────

function makePyroStatusLine(burnStack, burnCap, infernoThresh) {
  const filled = burnStack;
  const burnBar = "[" + "█".repeat(filled) + "░".repeat(burnCap - filled) + "]";
  const explosionHint = filled >= burnCap
    ? " *** INFERNO NOW! ***"
    : filled >= infernoThresh
      ? ` (≥${infernoThresh} → Inferno!)`
      : "";
  return `  🔥 BURN: ${burnBar} ${filled}/${burnCap}${explosionHint}`;
}

function makeCauterizeHint(cauterizeActive, burnStack) {
  if (cauterizeActive && burnStack >= 5) {
    return `  ✦ CAUTERIZE active  (+HP regen per stack)`;
  }
  return null;
}

function makeHeatShieldLine(active, timerMs) {
  if (!active) return null;
  const secLeft = (timerMs / 1000).toFixed(1);
  return `  🛡️ HEAT SHIELD: ${secLeft}s  (reflect+burn on hit!)`;
}

// ─────────────────────────────────────────────────────────────────
// Burn 状态行测试
// ─────────────────────────────────────────────────────────────────

describe("Pyro UI — Burn 状态行", () => {
  const infernoThresh = 3; // 调整后的阈值

  it("0 层时不显示爆炸提示", () => {
    const line = makePyroStatusLine(0, 5, infernoThresh);
    assert.ok(!line.includes("Inferno"), "0 层时不应显示 Inferno 提示");
    assert.ok(!line.includes("INFERNO NOW"), "0 层时不应显示 INFERNO NOW");
    assert.ok(line.includes("0/5"), "应显示 0/5");
  });

  it("1 层时不显示爆炸提示", () => {
    const line = makePyroStatusLine(1, 5, infernoThresh);
    assert.ok(!line.includes("Inferno"), "1 层时不应显示提示");
  });

  it("2 层时不显示爆炸提示（阈值为 3）", () => {
    const line = makePyroStatusLine(2, 5, infernoThresh);
    assert.ok(!line.includes("Inferno"), "2 层时不应显示提示（低于阈值 3）");
  });

  it("达到 infernoThresh(3) 层时显示 Inferno 提示", () => {
    const line = makePyroStatusLine(3, 5, infernoThresh);
    assert.ok(line.includes("Inferno!"), `3 层时应显示 Inferno 提示，实际: ${line}`);
    assert.ok(!line.includes("INFERNO NOW"), "未满层时不应显示 INFERNO NOW");
  });

  it("4 层时继续显示 Inferno 提示", () => {
    const line = makePyroStatusLine(4, 5, infernoThresh);
    assert.ok(line.includes("Inferno!"), "4 层时应显示 Inferno 提示");
  });

  it("满层时显示 INFERNO NOW 警告", () => {
    const line = makePyroStatusLine(5, 5, infernoThresh);
    assert.ok(line.includes("INFERNO NOW"), `满层时应显示 INFERNO NOW，实际: ${line}`);
  });

  it("带 burnCapBonus 时满层检测正确（cap=10，满层 10 层）", () => {
    const line = makePyroStatusLine(10, 10, infernoThresh);
    assert.ok(line.includes("INFERNO NOW"), "cap=10 满层也应显示 INFERNO NOW");
  });

  it("带 burnCapBonus 时阈值判断正确（cap=10，3 层应显示 Inferno!）", () => {
    const line = makePyroStatusLine(3, 10, infernoThresh);
    assert.ok(line.includes("Inferno!"), "cap=10 时 3 层应显示 Inferno!");
    assert.ok(!line.includes("INFERNO NOW"), "未满层时不应显示 INFERNO NOW");
  });

  it("进度条格式：█ 对应已有层数，░ 对应剩余空位", () => {
    const line = makePyroStatusLine(3, 5, infernoThresh);
    assert.ok(line.includes("[███░░]"), `进度条应为 [███░░]，实际: ${line}`);
  });

  it("满层进度条：全为 █", () => {
    const line = makePyroStatusLine(5, 5, infernoThresh);
    assert.ok(line.includes("[█████]"), `满层进度条应为 [█████]，实际: ${line}`);
  });
});

// ─────────────────────────────────────────────────────────────────
// Cauterize 状态提示测试
// ─────────────────────────────────────────────────────────────────

describe("Pyro UI — Cauterize 状态提示", () => {
  it("cauterize 未激活时不显示提示", () => {
    const hint = makeCauterizeHint(false, 6);
    assert.equal(hint, null, "cauterize 未激活时不应显示");
  });

  it("cauterize 已激活但 burn < 5 时不显示提示", () => {
    const hint = makeCauterizeHint(true, 4);
    assert.equal(hint, null, "burn < 5 时不应显示 CAUTERIZE");
  });

  it("cauterize 激活且 burn == 5 时显示提示", () => {
    const hint = makeCauterizeHint(true, 5);
    assert.ok(hint !== null, "burn=5 时应显示 CAUTERIZE");
    assert.ok(hint.includes("CAUTERIZE active"), `应包含 CAUTERIZE active，实际: ${hint}`);
  });

  it("cauterize 激活且 burn > 5 时也显示提示", () => {
    const hint = makeCauterizeHint(true, 8);
    assert.ok(hint !== null, "burn>5 时也应显示 CAUTERIZE");
  });

  it("CAUTERIZE 提示包含回血说明", () => {
    const hint = makeCauterizeHint(true, 5);
    assert.ok(hint.includes("+HP regen"), `应包含回血说明，实际: ${hint}`);
  });
});

// ─────────────────────────────────────────────────────────────────
// Heat Shield 状态行测试
// ─────────────────────────────────────────────────────────────────

describe("Pyro UI — Heat Shield 状态行", () => {
  it("未激活时不显示", () => {
    const line = makeHeatShieldLine(false, 5000);
    assert.equal(line, null, "未激活时不应显示 Heat Shield");
  });

  it("激活时显示剩余时间", () => {
    const line = makeHeatShieldLine(true, 3500);
    assert.ok(line !== null, "激活时应显示");
    assert.ok(line.includes("HEAT SHIELD"), `应包含 HEAT SHIELD，实际: ${line}`);
    assert.ok(line.includes("3.5s"), `应包含剩余时间 3.5s，实际: ${line}`);
  });

  it("激活时包含反伤提示", () => {
    const line = makeHeatShieldLine(true, 2000);
    assert.ok(line.includes("reflect"), `应包含 reflect 说明，实际: ${line}`);
  });

  it("快到期时显示正确的剩余时间（1.0s）", () => {
    const line = makeHeatShieldLine(true, 1000);
    assert.ok(line.includes("1.0s"), `应显示 1.0s，实际: ${line}`);
  });

  it("刚激活时显示 5.0s", () => {
    const line = makeHeatShieldLine(true, 5000);
    assert.ok(line.includes("5.0s"), `应显示 5.0s，实际: ${line}`);
  });
});

// ─────────────────────────────────────────────────────────────────
// 技能数值调整测试（验证 skills.js 中的改动）
// ─────────────────────────────────────────────────────────────────

describe("Pyro 数值调整 — Ignite CD", () => {
  it("Ignite CD 应为 3000ms（3s）", () => {
    const ignite = Skills.SKILL_TEMPLATES.find(s => s.id === "ignite");
    assert.ok(ignite, "应找到 ignite 技能");
    assert.equal(ignite.effect.cd, 3000, `Ignite CD 应为 3000ms，实际: ${ignite.effect.cd}`);
  });

  it("Ignite 描述应更新为 CD: 3s", () => {
    const ignite = Skills.SKILL_TEMPLATES.find(s => s.id === "ignite");
    assert.ok(ignite.description.includes("CD: 3s"), `描述应包含 CD: 3s，实际: ${ignite.description}`);
  });
});

describe("Pyro 数值调整 — Inferno 爆炸阈值", () => {
  it("Inferno explosionThreshold 应为 3", () => {
    const inferno = Skills.SKILL_TEMPLATES.find(s => s.id === "inferno");
    assert.ok(inferno, "应找到 inferno 技能");
    assert.equal(
      inferno.effect.explosionThreshold, 3,
      `Inferno 爆炸阈值应为 3，实际: ${inferno.effect.explosionThreshold}`
    );
  });

  it("Inferno 描述应更新为 3+ stacks", () => {
    const inferno = Skills.SKILL_TEMPLATES.find(s => s.id === "inferno");
    assert.ok(inferno.description.includes("3+"), `描述应包含 3+，实际: ${inferno.description}`);
  });
});

describe("Pyro 数值调整 — Heat Shield CD", () => {
  it("Heat Shield CD 应为 12000ms（12s）", () => {
    const hs = Skills.SKILL_TEMPLATES.find(s => s.id === "heat_shield");
    assert.ok(hs, "应找到 heat_shield 技能");
    assert.equal(hs.effect.cd, 12000, `Heat Shield CD 应为 12000ms，实际: ${hs.effect.cd}`);
  });

  it("Heat Shield 描述应更新为 CD: 12s", () => {
    const hs = Skills.SKILL_TEMPLATES.find(s => s.id === "heat_shield");
    assert.ok(hs.description.includes("CD: 12s"), `描述应包含 CD: 12s，实际: ${hs.description}`);
  });
});

// ─────────────────────────────────────────────────────────────────
// Combat 模块 Pyro 状态暴露测试
// ─────────────────────────────────────────────────────────────────

describe("Combat — Pyro/Cryo/Storm 状态暴露给 UI", () => {
  it("Combat.heatShieldActive 初始为 false", () => {
    assert.equal(Combat.heatShieldActive, false, "初始 heatShieldActive 应为 false");
  });

  it("Combat.heatShieldTimer 初始为 0", () => {
    assert.equal(Combat.heatShieldTimer, 0, "初始 heatShieldTimer 应为 0");
  });

  it("Combat.iceBarrierHp 初始为 0", () => {
    assert.equal(Combat.iceBarrierHp, 0, "初始 iceBarrierHp 应为 0");
  });

  it("Combat.lightningRodActive 初始为 false", () => {
    assert.equal(Combat.lightningRodActive, false, "初始 lightningRodActive 应为 false");
  });

  it("Combat.lightningRodTimer 初始为 0", () => {
    assert.equal(Combat.lightningRodTimer, 0, "初始 lightningRodTimer 应为 0");
  });

  it("Combat.lightningRodHits 初始为 0", () => {
    assert.equal(Combat.lightningRodHits, 0, "初始 lightningRodHits 应为 0");
  });

  it("startFight 后 heatShieldActive 重置为 false", () => {
    // 初始化状态
    State.reset();
    const state = State.get();
    state.hero.class = "mage";
    state.mage = {
      spec: "pyro", burnStack: 0, burnDotTimer: 0,
      frozen: false, freezeTimer: 0, chillStack: 0,
      charge: 0, arcaneWardHp: 0, blinkImmune: false,
      blinkImmuneTimer: 0, counterspellActive: false,
      counterspellTimer: 0, counterspellHits: 0,
      timeWarpActive: false, timeWarpTimer: 0,
      lastRiteUsed: false, spellEchoCount: 0,
      leyLineReady: false, nextFightChillBonus: 0,
    };
    const monster = { name: "Test", currentHp: 100, maxHp: 100, atk: 5, def: 0, spd: 1, element: "fire", isBoss: false };
    Combat.startFight(monster);
    assert.equal(Combat.heatShieldActive, false, "startFight 后 heatShieldActive 应重置为 false");
  });
});

// ─────────────────────────────────────────────────────────────────
// Burn 跨战斗保留测试
// ─────────────────────────────────────────────────────────────────

describe("Pyro — Burn 跨战斗保留机制", () => {
  function makePyroMage(burnStack) {
    State.reset();
    const state = State.get();
    state.hero.class = "mage";
    state.mage = {
      spec: "pyro", burnStack: burnStack, burnDotTimer: 0,
      frozen: false, freezeTimer: 0, chillStack: 0,
      charge: 0, arcaneWardHp: 0, blinkImmune: false,
      blinkImmuneTimer: 0, counterspellActive: false,
      counterspellTimer: 0, counterspellHits: 0,
      timeWarpActive: false, timeWarpTimer: 0,
      lastRiteUsed: false, spellEchoCount: 0,
      leyLineReady: false, nextFightChillBonus: 0,
    };
    return state;
  }

  it("startFight 后 burnStack 保持不变（跨场保留）", () => {
    const state = makePyroMage(3);
    const monster = { name: "TestMob", currentHp: 100, maxHp: 100, atk: 5, def: 0, spd: 1, element: "fire", isBoss: false };
    Combat.startFight(monster);
    assert.equal(state.mage.burnStack, 3, "startFight 不应清零 burnStack，应保留 3 层");
  });

  it("startFight 后 burnDotTimer 重置为 0", () => {
    const state = makePyroMage(3);
    state.mage.burnDotTimer = 800; // 模拟上一场战斗累积的计时
    const monster = { name: "TestMob", currentHp: 100, maxHp: 100, atk: 5, def: 0, spd: 1, element: "fire", isBoss: false };
    Combat.startFight(monster);
    assert.equal(state.mage.burnDotTimer, 0, "startFight 应将 burnDotTimer 重置为 0");
  });

  it("burnStack=0 时 startFight 无日志（不打印空携带）", () => {
    // 此测试仅验证 burnStack 仍为 0（不能直接捕捉日志，但确认无副作用）
    const state = makePyroMage(0);
    const monster = { name: "TestMob", currentHp: 100, maxHp: 100, atk: 5, def: 0, spd: 1, element: "fire", isBoss: false };
    Combat.startFight(monster);
    assert.equal(state.mage.burnStack, 0, "无余烬时 burnStack 仍为 0");
  });
});
