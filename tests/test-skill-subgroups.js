// test-skill-subgroups.js — 法师技能子分组过滤 & _skillFold 相关逻辑测试

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

// ── 辅助：构建法师角色 ───────────────────────────────
function subSetup(opts) {
  State.reset();
  const s = State.get();
  s.hero.level      = opts.level !== undefined ? opts.level : 20;
  s.hero.class      = "mage";
  s.hero.gold       = 99999;
  s.classChosen     = true;
  s.hero.prestigeBonus = 1.0;
  s.unlockedSkills  = opts.skills || {};
  if (opts.spec) {
    s.mage.spec       = opts.spec;
    s.mage.specChosen = true;
  }
}

// ═══════════════════════════════════════════════════════
// 1. 法师技能分类字段完整性
// ═══════════════════════════════════════════════════════

describe("法师技能模板分类字段", () => {
  it("所有法师技能都有 spec 或 specGate 或两者均无（base）", () => {
    const mageSkills = Skills.SKILL_TEMPLATES.filter(s => s.class === "mage");
    mageSkills.forEach(s => {
      const hasSpec     = !!s.spec;
      const hasSpecGate = !!s.specGate;
      // spec 和 specGate 不应同时存在
      assert.notOk(hasSpec && hasSpecGate, `${s.id} 不应同时有 spec 和 specGate`);
    });
  });

  it("spec 字段只有合法值 pyro/cryo/storm", () => {
    const valid = ["pyro", "cryo", "storm"];
    Skills.SKILL_TEMPLATES
      .filter(s => s.class === "mage" && s.spec)
      .forEach(s => {
        assert.includes(valid, s.spec, `${s.id} 的 spec 值 "${s.spec}" 不合法`);
      });
  });

  it("specGate 技能数量为 3（pyro/cryo/storm 各一个门控）", () => {
    const gates = Skills.SKILL_TEMPLATES.filter(s => s.class === "mage" && s.specGate);
    assert.equal(gates.length, 3);
  });

  it("specGate 技能包含 spec_pyro/spec_cryo/spec_storm", () => {
    const gateIds = Skills.SKILL_TEMPLATES
      .filter(s => s.class === "mage" && s.specGate)
      .map(s => s.id);
    assert.ok(gateIds.includes("spec_pyro"),  "应包含 spec_pyro");
    assert.ok(gateIds.includes("spec_cryo"),  "应包含 spec_cryo");
    assert.ok(gateIds.includes("spec_storm"), "应包含 spec_storm");
  });

  it("法师 base 技能（无 spec/specGate）至少有 3 个", () => {
    const base = Skills.SKILL_TEMPLATES.filter(
      s => s.class === "mage" && !s.spec && !s.specGate
    );
    assert.greaterThan(base.length, 2, "法师 base 技能应不少于 3 个");
  });

  it("各专精（pyro/cryo/storm）各自至少有 3 个专精技能", () => {
    ["pyro", "cryo", "storm"].forEach(specId => {
      const count = Skills.SKILL_TEMPLATES.filter(
        s => s.class === "mage" && s.spec === specId
      ).length;
      assert.greaterThan(count, 2, `${specId} 专精技能应不少于 3 个（实际: ${count}）`);
    });
  });
});

// ═══════════════════════════════════════════════════════
// 2. Skills.getByClass 子分组过滤逻辑
// ═══════════════════════════════════════════════════════

describe("Skills.getByClass — 法师子分组过滤", () => {
  it("未选专精：getByClass('mage') 不包含任何 spec 专精技能", () => {
    subSetup({ level: 14 }); // 低于15，尚未选专精
    const skills = Skills.getByClass("mage");
    const specSkills = skills.filter(s => s.spec);
    assert.equal(specSkills.length, 0, "未选专精时不应包含专精技能");
  });

  it("未选专精：getByClass('mage') 包含 base 技能（无 spec/specGate 字段）", () => {
    subSetup({ level: 10 });
    const skills = Skills.getByClass("mage");
    const base = skills.filter(s => !s.spec && !s.specGate);
    assert.greaterThan(base.length, 0, "应包含 base 技能");
  });

  it("未选专精：getByClass('mage') 包含 specGate 技能", () => {
    subSetup({ level: 10 });
    const skills = Skills.getByClass("mage");
    const gates = skills.filter(s => s.specGate);
    assert.greaterThan(gates.length, 0, "应包含专精选择门控技能");
  });

  it("选了 pyro：只显示 pyro 专精技能，无 cryo/storm 技能", () => {
    subSetup({ spec: "pyro" });
    const skills = Skills.getByClass("mage");
    const pyro  = skills.filter(s => s.spec === "pyro");
    const cryo  = skills.filter(s => s.spec === "cryo");
    const storm = skills.filter(s => s.spec === "storm");
    assert.greaterThan(pyro.length,  0, "应有 pyro 技能");
    assert.equal(cryo.length,  0, "不应有 cryo 技能");
    assert.equal(storm.length, 0, "不应有 storm 技能");
  });

  it("选了 cryo：只显示 cryo 专精技能，无 pyro/storm 技能", () => {
    subSetup({ spec: "cryo" });
    const skills = Skills.getByClass("mage");
    const pyro  = skills.filter(s => s.spec === "pyro");
    const cryo  = skills.filter(s => s.spec === "cryo");
    const storm = skills.filter(s => s.spec === "storm");
    assert.equal(pyro.length,  0, "不应有 pyro 技能");
    assert.greaterThan(cryo.length,  0, "应有 cryo 技能");
    assert.equal(storm.length, 0, "不应有 storm 技能");
  });

  it("选了 storm：只显示 storm 专精技能，无 pyro/cryo 技能", () => {
    subSetup({ spec: "storm" });
    const skills = Skills.getByClass("mage");
    const pyro  = skills.filter(s => s.spec === "pyro");
    const cryo  = skills.filter(s => s.spec === "cryo");
    const storm = skills.filter(s => s.spec === "storm");
    assert.equal(pyro.length,  0, "不应有 pyro 技能");
    assert.equal(cryo.length,  0, "不应有 cryo 技能");
    assert.greaterThan(storm.length, 0, "应有 storm 技能");
  });

  it("选了专精后依然包含 base 技能和 specGate 技能", () => {
    subSetup({ spec: "pyro" });
    const skills = Skills.getByClass("mage");
    const base  = skills.filter(s => !s.spec && !s.specGate);
    const gates = skills.filter(s => s.specGate);
    assert.greaterThan(base.length,  0, "应包含 base 技能");
    assert.greaterThan(gates.length, 0, "应包含 specGate 技能");
  });

  it("子分组 base 技能：不含 spec/specGate 字段", () => {
    subSetup({ spec: "pyro" });
    const skills = Skills.getByClass("mage");
    const base = skills.filter(s => !s.spec && !s.specGate);
    base.forEach(s => {
      assert.notOk(s.spec,     `${s.id} 不应有 spec 字段`);
      assert.notOk(s.specGate, `${s.id} 不应有 specGate 字段`);
    });
  });

  it("子分组 spec 技能：spec 字段与当前专精一致", () => {
    subSetup({ spec: "cryo" });
    const skills = Skills.getByClass("mage");
    const specSkills = skills.filter(s => s.spec);
    specSkills.forEach(s => {
      assert.equal(s.spec, "cryo", `${s.id}.spec 应为 cryo`);
    });
  });
});

// ═══════════════════════════════════════════════════════
// 3. _skillFold 子分组 key 命名约定验证
// ═══════════════════════════════════════════════════════

describe("法师技能子分组 foldGroup key 约定", () => {
  // 测试通过 Skills.getByClass 拿到正确的分组，模拟 _renderSubGroup 初始化行为
  it("mage_base key 对应的 base 技能非空", () => {
    subSetup({ level: 10 });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const base = skills.filter(s => !s.spec && !s.specGate);
    assert.greaterThan(base.length, 0, "mage_base 子组应有技能");
  });

  it("mage_spec_gate key 对应的门控技能恰好为 3", () => {
    subSetup({ level: 10 });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const gates = skills.filter(s => s.specGate);
    assert.equal(gates.length, 3);
  });

  it("已选 pyro：mage_pyro key 对应技能非空，mage_cryo/mage_storm 为空", () => {
    subSetup({ spec: "pyro" });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const pyro  = skills.filter(s => s.spec === "pyro");
    const cryo  = skills.filter(s => s.spec === "cryo");
    const storm = skills.filter(s => s.spec === "storm");
    assert.greaterThan(pyro.length, 0);
    assert.equal(cryo.length,  0);
    assert.equal(storm.length, 0);
  });

  it("已选 cryo：mage_cryo 非空", () => {
    subSetup({ spec: "cryo" });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const cryo = skills.filter(s => s.spec === "cryo");
    assert.greaterThan(cryo.length, 0);
  });

  it("已选 storm：mage_storm 非空", () => {
    subSetup({ spec: "storm" });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const storm = skills.filter(s => s.spec === "storm");
    assert.greaterThan(storm.length, 0);
  });
});

// ═══════════════════════════════════════════════════════
// 4. 法师技能子分组与学习状态联动
// ═══════════════════════════════════════════════════════

describe("法师技能子分组学习状态", () => {
  it("已学 arcane_boost：base 子组学习计数正确", () => {
    subSetup({ skills: { arcane_boost: true } });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const base = skills.filter(s => !s.spec && !s.specGate);
    const s = State.get();
    const learned = base.filter(sk => s.unlockedSkills[sk.id]);
    assert.equal(learned.length, 1);
  });

  it("未学任何技能时，所有子组学习计数为 0", () => {
    subSetup({});
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const s = State.get();
    const learned = skills.filter(sk => s.unlockedSkills[sk.id]);
    assert.equal(learned.length, 0);
  });

  it("已选 pyro 并学会 ignite：pyro 子组学习计数为 1", () => {
    subSetup({
      spec: "pyro",
      skills: { ignite: true, spec_pyro: true },
    });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const pyroSkills = skills.filter(s => s.spec === "pyro");
    const s = State.get();
    const learned = pyroSkills.filter(sk => s.unlockedSkills[sk.id]);
    assert.greaterThan(learned.length, 0, "已学 ignite 的 pyro 子组学习数应 > 0");
  });

  it("base/specGate 子组分类不互相干扰（不重复计数）", () => {
    subSetup({ skills: { arcane_boost: true, spec_pyro: true } });
    const skills = Skills.getByClass("mage").filter(s => s.class === "mage");
    const base  = skills.filter(s => !s.spec && !s.specGate);
    const gates = skills.filter(s => s.specGate);
    const s = State.get();
    const learnedBase  = base.filter(sk => s.unlockedSkills[sk.id]).length;
    const learnedGates = gates.filter(sk => s.unlockedSkills[sk.id]).length;
    // arcane_boost 在 base，spec_pyro 在 gates，不应互相计入
    assert.equal(learnedBase,  1, "base 子组应只计 arcane_boost");
    assert.equal(learnedGates, 1, "gate 子组应只计 spec_pyro");
  });
});
