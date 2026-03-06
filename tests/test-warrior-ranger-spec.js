// test-warrior-ranger-spec.js — 战士/游侠专精系统测试
// 覆盖：职业选择/专精解锁/互斥逻辑/技能树完整性/Skills.canUnlock 检查

// ─────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────

function freshWarriorState(level) {
  State.reset();
  const s = State.get();
  s.hero.level = level || 15;
  s.hero.class = "warrior";
  s.hero.gold  = 99999;
  s.classChosen = true;
  if (!s.warrior) s.warrior = { spec: null, specChosen: false };
  return s;
}

function freshRangerState(level) {
  State.reset();
  const s = State.get();
  s.hero.level = level || 15;
  s.hero.class = "ranger";
  s.hero.gold  = 99999;
  s.classChosen = true;
  if (!s.ranger) s.ranger = { spec: null, specChosen: false };
  return s;
}

// ══════════════════════════════════════════════════════════════════════════
// A. 战士技能树完整性
// ══════════════════════════════════════════════════════════════════════════

describe("[战士技能树 — 完整性]", () => {
  it("战士基础技能存在（power_strike / shield_wall / regen / cleave / battle_cry）", () => {
    const base = ["power_strike", "shield_wall", "regen", "cleave", "battle_cry"];
    base.forEach(id => {
      const tpl = Skills.getTemplate(id);
      assert.ok(tpl, `技能 ${id} 应存在`);
      assert.equal(tpl.class, "warrior", `${id} 应属于战士`);
    });
  });

  it("Guardian 专精技能数量 ≥ 6", () => {
    const guardianSkills = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "warrior" && t.spec === "guardian"
    );
    assert.ok(guardianSkills.length >= 6, `Guardian 技能数量为 ${guardianSkills.length}，应 ≥ 6`);
  });

  it("Berserker 专精技能数量 ≥ 6", () => {
    const berserkSkills = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "warrior" && t.spec === "berserker"
    );
    assert.ok(berserkSkills.length >= 6, `Berserker 技能数量为 ${berserkSkills.length}，应 ≥ 6`);
  });

  it("Guardian / Berserker 专精门控技能（specGate）各 1 个", () => {
    const gates = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "warrior" && t.specGate
    );
    assert.equal(gates.length, 2, `战士专精门控技能应有 2 个，实际 ${gates.length}`);
    const specIds = gates.map(t => t.specId);
    assert.ok(specIds.includes("guardian"), "应包含 guardian");
    assert.ok(specIds.includes("berserker"), "应包含 berserker");
  });

  it("Guardian 专精技能的前置技能均存在", () => {
    const guardianSkills = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "warrior" && t.spec === "guardian"
    );
    guardianSkills.forEach(t => {
      if (!t.requires) return;
      const reqs = t.requires.split("+").map(r => r.trim()).filter(Boolean);
      reqs.forEach(reqId => {
        const req = Skills.getTemplate(reqId);
        assert.ok(req, `${t.id} 的前置 ${reqId} 应存在`);
      });
    });
  });

  it("Berserker 专精技能的前置技能均存在", () => {
    const berserkSkills = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "warrior" && t.spec === "berserker"
    );
    berserkSkills.forEach(t => {
      if (!t.requires) return;
      const reqs = t.requires.split("+").map(r => r.trim()).filter(Boolean);
      reqs.forEach(reqId => {
        const req = Skills.getTemplate(reqId);
        assert.ok(req, `${t.id} 的前置 ${reqId} 应存在`);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// B. 战士专精选择逻辑
// ══════════════════════════════════════════════════════════════════════════

describe("[战士专精 — 选择逻辑]", () => {
  it("未选职业时无法解锁专精技能", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 15;
    s.hero.gold  = 99999;
    // classChosen = false，class = null
    const r = Skills.canUnlock("spec_guardian");
    assert.equal(r.ok, false, "未选职业时应无法解锁专精");
  });

  it("战士 Lv.15 前无法解锁 spec_guardian", () => {
    const s = freshWarriorState(14);
    const r = Skills.canUnlock("spec_guardian");
    assert.equal(r.ok, false, "Lv.14 时应无法解锁");
    assert.ok(r.reason.includes("Lv."), `错误原因应包含等级要求，实际: ${r.reason}`);
  });

  it("战士 Lv.15 且金币足够时可解锁 spec_guardian（前置 shield_wall 已学）", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["shield_wall"] = true;
    const r = Skills.canUnlock("spec_guardian");
    assert.equal(r.ok, true, `应可解锁 spec_guardian，实际: ${r.reason}`);
  });

  it("战士 Lv.15 且金币足够时可解锁 spec_berserker（前置 power_strike 已学）", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["power_strike"] = true;
    const r = Skills.canUnlock("spec_berserker");
    assert.equal(r.ok, true, `应可解锁 spec_berserker，实际: ${r.reason}`);
  });

  it("选择 guardian 后无法再选 berserker", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["power_strike"] = true;
    s.unlockedSkills["shield_wall"] = true;
    // 先选 guardian
    Skills.unlock("spec_guardian");
    // 再尝试 berserker
    const r = Skills.canUnlock("spec_berserker");
    assert.equal(r.ok, false, "已选 guardian 后不能再选 berserker");
    assert.ok(r.reason.toLowerCase().includes("spec") || r.reason.toLowerCase().includes("guardian"),
      `错误原因应提示专精冲突，实际: ${r.reason}`);
  });

  it("选择 berserker 后 state.warrior.spec 更新", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["power_strike"] = true;
    Skills.unlock("spec_berserker");
    assert.equal(s.warrior.spec, "berserker", "spec 应更新为 berserker");
    assert.equal(s.warrior.specChosen, true, "specChosen 应为 true");
  });

  it("选择 guardian 后 state.warrior.spec 更新", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["shield_wall"] = true;
    Skills.unlock("spec_guardian");
    assert.equal(s.warrior.spec, "guardian", "spec 应更新为 guardian");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// C. 战士专精技能解锁
// ══════════════════════════════════════════════════════════════════════════

describe("[战士专精 — Guardian 技能解锁]", () => {
  it("选择 guardian 后可解锁 iron_fortress（需 spec_guardian 作前置）", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["shield_wall"] = true;
    Skills.unlock("spec_guardian");
    const r = Skills.canUnlock("iron_fortress");
    assert.equal(r.ok, true, `应可解锁 iron_fortress，实际: ${r.reason}`);
  });

  it("选择 guardian 后 berserker 专精技能（bloodlust）不可解锁", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["shield_wall"] = true;
    Skills.unlock("spec_guardian");
    const r = Skills.canUnlock("bloodlust");
    assert.equal(r.ok, false, "guardian 专精不能解锁 berserker 的 bloodlust");
  });

  it("未选 guardian 专精时 iron_fortress 不可解锁", () => {
    const s = freshWarriorState(20);
    // 未选专精
    const r = Skills.canUnlock("iron_fortress");
    assert.equal(r.ok, false, "未选专精时不能解锁专精技能");
  });

  it("guardian 终极技能 unbreakable 在链条完成后可解锁", () => {
    const s = freshWarriorState(35);
    s.unlockedSkills["shield_wall"] = true;
    s.unlockedSkills["spec_guardian"] = true;
    s.warrior.spec = "guardian";
    s.warrior.specChosen = true;
    s.unlockedSkills["iron_fortress"] = true;
    s.unlockedSkills["stalwart"] = true;
    s.unlockedSkills["counter_stance"] = true;
    s.unlockedSkills["fortress_mastery"] = true;
    const r = Skills.canUnlock("unbreakable");
    assert.equal(r.ok, true, `应可解锁 unbreakable，实际: ${r.reason}`);
  });
});

describe("[战士专精 — Berserker 技能解锁]", () => {
  it("选择 berserker 后可解锁 bloodlust", () => {
    const s = freshWarriorState(15);
    s.unlockedSkills["power_strike"] = true;
    Skills.unlock("spec_berserker");
    const r = Skills.canUnlock("bloodlust");
    assert.equal(r.ok, true, `应可解锁 bloodlust，实际: ${r.reason}`);
  });

  it("berserker 终极技能 death_wish 在链条完成后可解锁", () => {
    const s = freshWarriorState(35);
    s.unlockedSkills["power_strike"] = true;
    s.unlockedSkills["spec_berserker"] = true;
    s.warrior.spec = "berserker";
    s.warrior.specChosen = true;
    s.unlockedSkills["bloodlust"] = true;
    s.unlockedSkills["reckless_strike"] = true;
    s.unlockedSkills["execute"] = true;
    s.unlockedSkills["berserker_mastery"] = true;
    const r = Skills.canUnlock("death_wish");
    assert.equal(r.ok, true, `应可解锁 death_wish，实际: ${r.reason}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// D. 游侠技能树完整性
// ══════════════════════════════════════════════════════════════════════════

describe("[游侠技能树 — 完整性]", () => {
  it("游侠基础技能存在（eagle_eye / poison_arrow / evasion / rapid_shot / lethal_strike）", () => {
    const base = ["eagle_eye", "poison_arrow", "evasion", "rapid_shot", "lethal_strike"];
    base.forEach(id => {
      const tpl = Skills.getTemplate(id);
      assert.ok(tpl, `技能 ${id} 应存在`);
      assert.equal(tpl.class, "ranger", `${id} 应属于游侠`);
    });
  });

  it("Marksman 专精技能数量 ≥ 6", () => {
    const msSkills = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "ranger" && t.spec === "marksman"
    );
    assert.ok(msSkills.length >= 6, `Marksman 技能数量为 ${msSkills.length}，应 ≥ 6`);
  });

  it("Shadowblade 专精技能数量 ≥ 6", () => {
    const sbSkills = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "ranger" && t.spec === "shadowblade"
    );
    assert.ok(sbSkills.length >= 6, `Shadowblade 技能数量为 ${sbSkills.length}，应 ≥ 6`);
  });

  it("Marksman / Shadowblade 专精门控技能（specGate）各 1 个", () => {
    const gates = Skills.SKILL_TEMPLATES.filter(
      t => t.class === "ranger" && t.specGate
    );
    assert.equal(gates.length, 2, `游侠专精门控技能应有 2 个，实际 ${gates.length}`);
    const specIds = gates.map(t => t.specId);
    assert.ok(specIds.includes("marksman"), "应包含 marksman");
    assert.ok(specIds.includes("shadowblade"), "应包含 shadowblade");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// E. 游侠专精选择逻辑
// ══════════════════════════════════════════════════════════════════════════

describe("[游侠专精 — 选择逻辑]", () => {
  it("游侠 Lv.15 可解锁 spec_marksman（前置 eagle_eye 已学）", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    const r = Skills.canUnlock("spec_marksman");
    assert.equal(r.ok, true, `应可解锁 spec_marksman，实际: ${r.reason}`);
  });

  it("游侠 Lv.15 可解锁 spec_shadowblade（前置 evasion 已学）", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    s.unlockedSkills["evasion"] = true;
    const r = Skills.canUnlock("spec_shadowblade");
    assert.equal(r.ok, true, `应可解锁 spec_shadowblade，实际: ${r.reason}`);
  });

  it("选择 marksman 后无法再选 shadowblade", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    s.unlockedSkills["evasion"] = true;
    Skills.unlock("spec_marksman");
    const r = Skills.canUnlock("spec_shadowblade");
    assert.equal(r.ok, false, "已选 marksman 后不能再选 shadowblade");
  });

  it("选择 marksman 后 state.ranger.spec 更新", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    Skills.unlock("spec_marksman");
    assert.equal(s.ranger.spec, "marksman", "spec 应更新为 marksman");
    assert.equal(s.ranger.specChosen, true, "specChosen 应为 true");
  });

  it("选择 shadowblade 后 state.ranger.spec 更新", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    s.unlockedSkills["evasion"] = true;
    Skills.unlock("spec_shadowblade");
    assert.equal(s.ranger.spec, "shadowblade", "spec 应更新为 shadowblade");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// F. 游侠专精技能解锁
// ══════════════════════════════════════════════════════════════════════════

describe("[游侠专精 — Marksman 技能解锁]", () => {
  it("选择 marksman 后可解锁 focused_shot", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    Skills.unlock("spec_marksman");
    const r = Skills.canUnlock("focused_shot");
    assert.equal(r.ok, true, `应可解锁 focused_shot，实际: ${r.reason}`);
  });

  it("选择 marksman 后 shadowblade 专精技能 backstab 不可解锁", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    Skills.unlock("spec_marksman");
    const r = Skills.canUnlock("backstab");
    assert.equal(r.ok, false, "marksman 专精不能解锁 shadowblade 的 backstab");
  });

  it("marksman 终极技能 deadeye 在链条完成后可解锁", () => {
    const s = freshRangerState(35);
    s.unlockedSkills["eagle_eye"] = true;
    s.unlockedSkills["spec_marksman"] = true;
    s.ranger.spec = "marksman";
    s.ranger.specChosen = true;
    s.unlockedSkills["focused_shot"] = true;
    s.unlockedSkills["snipe"] = true;
    s.unlockedSkills["kill_shot"] = true;
    s.unlockedSkills["marksman_mastery"] = true;
    const r = Skills.canUnlock("deadeye");
    assert.equal(r.ok, true, `应可解锁 deadeye，实际: ${r.reason}`);
  });
});

describe("[游侠专精 — Shadowblade 技能解锁]", () => {
  it("选择 shadowblade 后可解锁 backstab", () => {
    const s = freshRangerState(15);
    s.unlockedSkills["eagle_eye"] = true;
    s.unlockedSkills["evasion"] = true;
    Skills.unlock("spec_shadowblade");
    const r = Skills.canUnlock("backstab");
    assert.equal(r.ok, true, `应可解锁 backstab，实际: ${r.reason}`);
  });

  it("shadowblade 终极技能 assassinate 在链条完成后可解锁", () => {
    const s = freshRangerState(35);
    s.unlockedSkills["eagle_eye"] = true;
    s.unlockedSkills["evasion"] = true;
    s.unlockedSkills["spec_shadowblade"] = true;
    s.ranger.spec = "shadowblade";
    s.ranger.specChosen = true;
    s.unlockedSkills["backstab"] = true;
    s.unlockedSkills["smoke_screen"] = true;
    s.unlockedSkills["shadow_clone"] = true;
    s.unlockedSkills["shadowblade_mastery"] = true;
    const r = Skills.canUnlock("assassinate");
    assert.equal(r.ok, true, `应可解锁 assassinate，实际: ${r.reason}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// G. getByClass 过滤逻辑
// ══════════════════════════════════════════════════════════════════════════

describe("[Skills.getByClass — 专精过滤]", () => {
  it("战士未选专精时 getByClass('warrior') 包含 specGate 技能", () => {
    freshWarriorState(15);
    const skills = Skills.getByClass("warrior");
    const gates = skills.filter(t => t.specGate);
    assert.ok(gates.length >= 2, `应包含专精门控技能，实际 ${gates.length}`);
  });

  it("战士选了 guardian 后 getByClass('warrior') 包含 guardian 专精技能", () => {
    const s = freshWarriorState(15);
    s.warrior.spec = "guardian";
    const skills = Skills.getByClass("warrior");
    const guardianSkills = skills.filter(t => t.spec === "guardian");
    assert.ok(guardianSkills.length > 0, "应包含 guardian 专精技能");
  });

  it("战士选了 guardian 后 getByClass('warrior') 不包含 berserker 专精技能", () => {
    const s = freshWarriorState(15);
    s.warrior.spec = "guardian";
    const skills = Skills.getByClass("warrior");
    const berserkSkills = skills.filter(t => t.spec === "berserker");
    assert.equal(berserkSkills.length, 0, "不应包含 berserker 专精技能");
  });

  it("游侠选了 marksman 后 getByClass('ranger') 包含 marksman 专精技能", () => {
    const s = freshRangerState(15);
    s.ranger.spec = "marksman";
    const skills = Skills.getByClass("ranger");
    const msSkills = skills.filter(t => t.spec === "marksman");
    assert.ok(msSkills.length > 0, "应包含 marksman 专精技能");
  });

  it("游侠选了 marksman 后 getByClass('ranger') 不包含 shadowblade 专精技能", () => {
    const s = freshRangerState(15);
    s.ranger.spec = "marksman";
    const skills = Skills.getByClass("ranger");
    const sbSkills = skills.filter(t => t.spec === "shadowblade");
    assert.equal(sbSkills.length, 0, "不应包含 shadowblade 专精技能");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// H. getActiveSkills / getPassiveSkills 只返回当前专精
// ══════════════════════════════════════════════════════════════════════════

describe("[Skills.getActiveSkills — 专精过滤]", () => {
  it("战士 guardian 已学 shield_bash 时 getActiveSkills 包含 shield_bash", () => {
    const s = freshWarriorState(20);
    s.warrior.spec = "guardian";
    s.warrior.specChosen = true;
    s.unlockedSkills["shield_bash"] = true;
    const active = Skills.getActiveSkills();
    const found = active.find(t => t.id === "shield_bash");
    assert.ok(found, "getActiveSkills 应包含 shield_bash");
  });

  it("战士 guardian 专精下 getActiveSkills 不返回 berserker 技能（reckless_strike）", () => {
    const s = freshWarriorState(20);
    s.warrior.spec = "guardian";
    s.warrior.specChosen = true;
    s.unlockedSkills["shield_bash"] = true;
    s.unlockedSkills["reckless_strike"] = true; // 已学但专精不匹配
    const active = Skills.getActiveSkills();
    const found = active.find(t => t.id === "reckless_strike");
    assert.ok(!found, "guardian 专精下不应返回 berserker 的 reckless_strike");
  });

  it("游侠 marksman 已学 focused_shot 时 getActiveSkills 包含 focused_shot", () => {
    const s = freshRangerState(20);
    s.ranger.spec = "marksman";
    s.ranger.specChosen = true;
    s.unlockedSkills["focused_shot"] = true;
    const active = Skills.getActiveSkills();
    const found = active.find(t => t.id === "focused_shot");
    assert.ok(found, "getActiveSkills 应包含 focused_shot");
  });

  it("游侠 marksman 专精下 getActiveSkills 不返回 shadowblade 技能（backstab）", () => {
    const s = freshRangerState(20);
    s.ranger.spec = "marksman";
    s.ranger.specChosen = true;
    s.unlockedSkills["focused_shot"] = true;
    s.unlockedSkills["backstab"] = true; // 已学但专精不匹配
    const active = Skills.getActiveSkills();
    const found = active.find(t => t.id === "backstab");
    assert.ok(!found, "marksman 专精下不应返回 shadowblade 的 backstab");
  });
});
