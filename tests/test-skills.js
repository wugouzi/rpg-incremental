// test-skills.js — Skills 模块测试

describe("Skills.SKILL_TEMPLATES 数据完整性", () => {
  it("模板不为空", () => {
    assert.ok(Skills.SKILL_TEMPLATES.length > 0);
  });

  it("每个技能包含必要字段", () => {
    Skills.SKILL_TEMPLATES.forEach(t => {
      assert.ok(t.id,          `技能缺少 id`);
      assert.ok(t.name,        `${t.id} 缺少 name`);
      assert.ok(t.class,       `${t.id} 缺少 class`);
      assert.ok(t.type,        `${t.id} 缺少 type`);
      assert.ok(t.description, `${t.id} 缺少 description`);
      assert.ok(t.unlockLevel > 0, `${t.id} unlockLevel 应 > 0`);
      assert.ok(t.cost && t.cost.gold >= 0, `${t.id} cost 格式错误`);
    });
  });

  it("type 只有 passive 或 active", () => {
    Skills.SKILL_TEMPLATES.forEach(t => {
      assert.ok(
        t.type === "passive" || t.type === "active",
        `${t.id} type "${t.type}" 不合法`
      );
    });
  });

  it("class 只有合法值", () => {
    const valid = ["common", "warrior", "mage", "ranger"];
    Skills.SKILL_TEMPLATES.forEach(t => {
      assert.includes(valid, t.class, `${t.id} class "${t.class}" 不合法`);
    });
  });

  it("前置技能引用存在（支持多前置 + 分隔）", () => {
    const ids = new Set(Skills.SKILL_TEMPLATES.map(t => t.id));
    Skills.SKILL_TEMPLATES.forEach(t => {
      if (t.requires) {
        const reqs = t.requires.split("+").map(r => r.trim()).filter(Boolean);
        reqs.forEach(reqId => {
          assert.ok(ids.has(reqId), `${t.id} 引用的前置技能 ${reqId} 不存在`);
        });
      }
    });
  });
});

describe("Skills.canUnlock", () => {
  function setup(level, classId, gold, skills) {
    State.reset();
    const s = State.get();
    s.hero.level = level || 1;
    s.hero.class = classId || null;
    s.hero.gold  = gold || 0;
    s.classChosen = !!classId;
    s.unlockedSkills = skills || {};
  }

  it("等级不足时返回失败", () => {
    setup(1, null, 9999);
    const r = Skills.canUnlock("auto_fight"); // 需要 Lv.3
    assert.notOk(r.ok);
    assert.includes(r.reason, "3");
  });

  it("金币不足时返回失败", () => {
    setup(10, null, 0);
    const r = Skills.canUnlock("auto_fight"); // 需要 50g
    assert.notOk(r.ok);
    assert.includes(r.reason, "g");
  });

  it("条件满足时返回 ok", () => {
    setup(10, null, 9999);
    const r = Skills.canUnlock("auto_fight");
    assert.ok(r.ok, r.reason);
  });

  it("职业不符时返回失败（战士技能对法师不可用）", () => {
    setup(15, "mage", 9999);
    const r = Skills.canUnlock("power_strike"); // warrior 技能
    assert.notOk(r.ok);
    assert.includes(r.reason.toLowerCase(), "warrior");
  });

  it("职业符合时可解锁", () => {
    setup(15, "warrior", 9999);
    const r = Skills.canUnlock("power_strike");
    assert.ok(r.ok, r.reason);
  });

  it("前置技能未解锁时返回失败", () => {
    setup(20, "warrior", 9999);
    const r = Skills.canUnlock("regen"); // 前置需要 power_strike
    assert.notOk(r.ok, "前置未解锁应失败");
  });

  it("前置技能已解锁时可解锁", () => {
    setup(20, "warrior", 9999, { power_strike: true });
    const r = Skills.canUnlock("regen");
    assert.ok(r.ok, r.reason);
  });

  it("已学习的技能返回失败", () => {
    setup(10, null, 9999, { auto_fight: true });
    const r = Skills.canUnlock("auto_fight");
    assert.notOk(r.ok);
  });
});

describe("Skills.unlock", () => {
  it("满足条件时解锁成功", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 10;
    s.hero.gold  = 9999;
    s.unlockedSkills = {};

    const ok = Skills.unlock("auto_fight");
    assert.ok(ok);
    assert.ok(s.unlockedSkills["auto_fight"]);
    assert.lessThan(s.hero.gold, 9999, "应扣除技能费用");
  });

  it("扣除正确费用", () => {
    State.reset();
    const s = State.get();
    s.hero.level = 10;
    s.hero.gold  = 9999;
    const costBefore = Skills.TEMPLATE_MAP["auto_fight"].cost.gold;
    Skills.unlock("auto_fight");
    assert.equal(s.hero.gold, 9999 - costBefore);
  });

  it("条件不满足时解锁失败", () => {
    State.reset();
    const ok = Skills.unlock("auto_fight"); // 默认 Lv.1, 0g
    assert.notOk(ok);
    assert.notOk(State.get().unlockedSkills["auto_fight"]);
  });
});

describe("Skills.getEffects", () => {
  it("无技能时返回默认倍率", () => {
    State.reset();
    const fx = Skills.getEffects();
    assert.equal(fx.atkMult, 1);
    assert.equal(fx.defMult, 1);
    assert.equal(fx.hpMult, 1);
    assert.equal(fx.spdAdd, 0);
    assert.equal(fx.critAdd, 0);
  });

  it("解锁 power_strike 后 atkMult 增加", () => {
    State.reset();
    State.get().hero.class = "warrior";
    State.get().unlockedSkills["power_strike"] = true;
    const fx = Skills.getEffects();
    assert.greaterThan(fx.atkMult, 1, "power_strike 应增加 atkMult");
  });

  it("多个被动效果叠加", () => {
    State.reset();
    const s = State.get();
    s.hero.class = "warrior";
    s.unlockedSkills["power_strike"] = true; // *1.15
    s.unlockedSkills["battle_cry"]   = true; // *1.25
    const fx = Skills.getEffects();
    // 两个 atkMult 相乘
    const expected = 1.15 * 1.25;
    assert.between(fx.atkMult, expected - 0.001, expected + 0.001, "两个 ATK 技能应叠乘");
  });

  it("解锁 quick_step 后 spdAdd 增加", () => {
    State.reset();
    State.get().hero.level = 10;
    State.get().unlockedSkills["quick_step"] = true;
    const fx = Skills.getEffects();
    assert.greaterThan(fx.spdAdd, 0);
  });

  it("解锁 eagle_eye 后 critAdd 增加", () => {
    State.reset();
    State.get().hero.class = "ranger";
    State.get().unlockedSkills["eagle_eye"] = true;
    const fx = Skills.getEffects();
    assert.greaterThan(fx.critAdd, 0);
  });
});

describe("Skills.getActiveSkills", () => {
  it("无已解锁主动技能时返回空数组", () => {
    State.reset();
    assert.deepEqual(Skills.getActiveSkills(), []);
  });

  it("返回已解锁的主动技能", () => {
    State.reset();
    State.get().hero.class = "warrior";
    State.get().unlockedSkills["cleave"] = true;
    const actives = Skills.getActiveSkills();
    assert.equal(actives.length, 1);
    assert.equal(actives[0].id, "cleave");
  });

  it("未解锁的技能不出现", () => {
    State.reset();
    const actives = Skills.getActiveSkills();
    actives.forEach(s => {
      assert.ok(State.get().unlockedSkills[s.id], `${s.id} 未解锁但出现在列表中`);
    });
  });
});

describe("Skills.chooseClass", () => {
  it("满足条件时选职业成功", () => {
    State.reset();
    State.get().hero.level = 10;
    Skills.chooseClass("warrior");
    assert.equal(State.get().hero.class, "warrior");
    assert.ok(State.get().classChosen);
  });

  it("Lv.10 以下无法选职业", () => {
    State.reset();
    Skills.chooseClass("warrior");
    assert.equal(State.get().hero.class, null, "等级不足时不应设置职业");
  });

  it("已选职业后不能再选", () => {
    State.reset();
    State.get().hero.level = 10;
    Skills.chooseClass("warrior");
    Skills.chooseClass("mage");
    assert.equal(State.get().hero.class, "warrior", "不应覆盖已选职业");
  });

  it("非法职业名不生效", () => {
    State.reset();
    State.get().hero.level = 10;
    Skills.chooseClass("paladin");
    assert.equal(State.get().hero.class, null);
  });
});
