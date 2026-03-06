// test-save-prestige.js — Save & Prestige 模块测试
// 注意：Save 依赖 localStorage，测试结束后清理

const TEST_SAVE_KEY = "idle_hero_save";

function cleanSave() {
  localStorage.removeItem(TEST_SAVE_KEY);
}

// ──────────────────────────────────────────
// Save
// ──────────────────────────────────────────

describe("Save.save", () => {
  it("存档后 localStorage 有数据", () => {
    State.reset();
    cleanSave();
    Save.save();
    const raw = localStorage.getItem(TEST_SAVE_KEY);
    assert.ok(raw, "存档后 localStorage 应有数据");
    cleanSave();
  });

  it("存档数据可以 JSON 解析", () => {
    State.reset();
    cleanSave();
    Save.save();
    const raw = localStorage.getItem(TEST_SAVE_KEY);
    let parsed;
    try { parsed = JSON.parse(raw); } catch(e) { parsed = null; }
    assert.ok(parsed, "存档数据应是有效 JSON");
    cleanSave();
  });

  it("存档包含 version 和 savedAt 字段", () => {
    State.reset();
    cleanSave();
    Save.save();
    const parsed = JSON.parse(localStorage.getItem(TEST_SAVE_KEY));
    assert.ok(parsed.version, "存档应包含 version");
    assert.ok(parsed.savedAt, "存档应包含 savedAt");
    cleanSave();
  });

  it("存档包含 hero 数据", () => {
    State.reset();
    State.get().hero.gold = 777;
    cleanSave();
    Save.save();
    const parsed = JSON.parse(localStorage.getItem(TEST_SAVE_KEY));
    assert.ok(parsed.data, "存档应包含 data 字段");
    assert.equal(parsed.data.hero.gold, 777, "存档应包含正确的 gold 值");
    cleanSave();
  });

  it("多次存档覆盖旧存档", () => {
    State.reset();
    cleanSave();
    State.get().hero.gold = 100;
    Save.save();
    State.get().hero.gold = 200;
    Save.save();
    const parsed = JSON.parse(localStorage.getItem(TEST_SAVE_KEY));
    assert.equal(parsed.data.hero.gold, 200, "后一次存档应覆盖前一次");
    cleanSave();
  });
});

describe("Save.load", () => {
  it("无存档时初始化默认状态", () => {
    cleanSave();
    State.get().hero.gold = 9999; // 先设置一个非零值
    Save.load();                  // 无存档，应重置
    assert.equal(State.get().hero.gold, 0, "无存档时应初始化为默认状态");
  });

  it("有存档时正确恢复状态", () => {
    State.reset();
    cleanSave();
    State.get().hero.gold  = 5000;
    State.get().hero.level = 7;
    State.get().hero.gems  = 3;
    Save.save();

    // 修改状态后重新读档
    State.get().hero.gold = 0;
    State.get().hero.level = 1;
    Save.load();

    assert.equal(State.get().hero.gold, 5000, "读档后 gold 应恢复");
    assert.equal(State.get().hero.level, 7, "读档后 level 应恢复");
    assert.equal(State.get().hero.gems, 3, "读档后 gems 应恢复");
    cleanSave();
  });

  it("读档后解锁区域正确恢复", () => {
    State.reset();
    cleanSave();
    Zones.onBossDefeated("plains"); // 解锁 forest
    Save.save();

    State.reset(); // 重置
    Save.load();

    assert.ok(Zones.isUnlocked("forest"), "读档后 forest 应仍解锁");
    cleanSave();
  });

  it("存档损坏时重置为默认状态", () => {
    cleanSave();
    localStorage.setItem(TEST_SAVE_KEY, "CORRUPTED_DATA_!!!!");
    Save.load();
    assert.equal(State.get().hero.level, 1, "损坏存档应重置为默认状态");
    cleanSave();
  });

  it("新字段（存档中缺失）使用默认值填补", () => {
    // 模拟旧版存档（缺少 classChosen 字段）
    State.reset();
    cleanSave();
    Save.save();
    const raw = JSON.parse(localStorage.getItem(TEST_SAVE_KEY));
    delete raw.data.classChosen; // 删除字段模拟旧存档
    localStorage.setItem(TEST_SAVE_KEY, JSON.stringify(raw));
    Save.load();
    // classChosen 应使用默认值 false，不报错
    assert.equal(State.get().classChosen, false, "缺失字段应使用默认值");
    cleanSave();
  });
});

describe("Save — 离线收益（通过 load 触发）", () => {
  it("存档时间戳较旧时 load 后获得离线收益", () => {
    State.reset();
    cleanSave();
    Save.save();

    // 修改存档的 savedAt 为 2 分钟前
    const raw = JSON.parse(localStorage.getItem(TEST_SAVE_KEY));
    raw.savedAt = Date.now() - 2 * 60 * 1000; // 2分钟前
    localStorage.setItem(TEST_SAVE_KEY, JSON.stringify(raw));

    const goldBefore = State.get().hero.gold;
    Save.load();

    assert.greaterThan(State.get().hero.gold, goldBefore, "离线2分钟后应有金币收益");
    cleanSave();
  });
});

// ──────────────────────────────────────────
// Prestige
// ──────────────────────────────────────────

describe("Prestige.canPrestige", () => {
  it("初始不能转生", () => {
    State.reset();
    assert.notOk(Prestige.canPrestige());
  });

  it("击败 castle Boss 后可以转生", () => {
    State.reset();
    // 手动解锁并击败 castle Boss
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    assert.ok(Prestige.canPrestige());
    State.reset();
  });
});

describe("Prestige.doPrestige", () => {
  // 绕过 confirm 对话框：用 stub
  let _origConfirm;
  function stubConfirm(val) {
    _origConfirm = window.confirm;
    window.confirm = () => val;
  }
  function restoreConfirm() {
    if (_origConfirm) window.confirm = _origConfirm;
  }

  it("条件不满足时不触发转生", () => {
    State.reset();
    stubConfirm(true);
    const countBefore = State.get().hero.prestigeCount;
    Prestige.doPrestige();
    assert.equal(State.get().hero.prestigeCount, countBefore, "不满足条件时不应转生");
    restoreConfirm();
  });

  it("确认转生后等级重置为 1", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    State.get().hero.level = 30;
    stubConfirm(true);
    Prestige.doPrestige();
    assert.equal(State.get().hero.level, 1, "转生后等级应重置为 1");
    restoreConfirm();
  });

  it("转生后 prestigeCount 增加", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    stubConfirm(true);
    Prestige.doPrestige();
    assert.equal(State.get().hero.prestigeCount, 1, "转生后 prestigeCount 应为 1");
    restoreConfirm();
  });

  it("转生后 prestigeBonus 增加 20%", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    stubConfirm(true);
    Prestige.doPrestige();
    const bonus = State.get().hero.prestigeBonus;
    assert.between(bonus, 1.19, 1.21, "转生后 prestigeBonus 应为 ~1.2");
    restoreConfirm();
  });

  it("转生后获得宝石", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    stubConfirm(true);
    Prestige.doPrestige();
    assert.greaterThan(State.get().hero.gems, 0, "转生后应获得宝石");
    restoreConfirm();
  });

  it("转生后金币重置为 0", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    State.get().hero.gold = 10000;
    stubConfirm(true);
    Prestige.doPrestige();
    assert.equal(State.get().hero.gold, 0, "转生后金币应清零");
    restoreConfirm();
  });

  it("转生后装备槽清空", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    State.get().equipment.weapon = Equipment.createItem("iron_sword");
    stubConfirm(true);
    Prestige.doPrestige();
    assert.equal(State.get().equipment.weapon, null, "转生后装备应清空");
    restoreConfirm();
  });

  it("转生后统计数据保留", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    State.get().stats.totalKills = 999;
    stubConfirm(true);
    Prestige.doPrestige();
    assert.equal(State.get().stats.totalKills, 999, "转生后统计数据应保留");
    restoreConfirm();
  });

  it("取消 confirm 时不转生", () => {
    State.reset();
    State.get().unlockedZones = ["plains", "forest", "cave", "desert", "castle"];
    State.get().bossDefeated["castle"] = true;
    State.get().hero.level = 30;
    stubConfirm(false); // 用户取消
    Prestige.doPrestige();
    assert.equal(State.get().hero.level, 30, "取消时等级不应变化");
    assert.equal(State.get().hero.prestigeCount, 0, "取消时不应转生");
    restoreConfirm();
  });
});

describe("Prestige.getInfo", () => {
  it("初始返回正确信息", () => {
    State.reset();
    const info = Prestige.getInfo();
    assert.equal(info.count, 0);
    assert.equal(info.bonus, 1.0);
    assert.equal(info.gems, 0);
    assert.notOk(info.canDo);
  });

  it("击败 castle Boss 后 canDo 为 true", () => {
    State.reset();
    State.get().bossDefeated["castle"] = true;
    assert.ok(Prestige.getInfo().canDo);
    State.reset();
  });
});
