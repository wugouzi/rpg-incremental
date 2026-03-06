// test-dailyquest.js — 每日任务系统测试
// 覆盖：初始化/每日刷新/进度更新/奖励发放/会话统计/查询接口

// ─────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────

function freshQuestState() {
  State.reset();
  const s = State.get();
  s.hero.gold = 0;
  s.hero.gems = 0;
  // 清除 dailyQuests 状态，强制重新初始化
  delete s.dailyQuests;
  return s;
}

// ══════════════════════════════════════════════════════════════════════════
// A. 模块结构完整性
// ══════════════════════════════════════════════════════════════════════════

describe("[DailyQuest — 结构完整性]", () => {
  it("DailyQuest 模块存在", () => {
    assert.ok(typeof DailyQuest === "object" || typeof DailyQuest === "function",
      "DailyQuest 应存在");
  });

  it("QUEST_TEMPLATES 存在且不为空", () => {
    assert.ok(Array.isArray(DailyQuest.QUEST_TEMPLATES), "QUEST_TEMPLATES 应是数组");
    assert.ok(DailyQuest.QUEST_TEMPLATES.length >= 10, "QUEST_TEMPLATES 应有至少 10 个模板");
  });

  it("每个任务模板都有必要字段", () => {
    DailyQuest.QUEST_TEMPLATES.forEach(tpl => {
      assert.ok(tpl.id,     `模板 ${tpl.id} 缺少 id`);
      assert.ok(tpl.name,   `模板 ${tpl.id} 缺少 name`);
      assert.ok(tpl.desc,   `模板 ${tpl.id} 缺少 desc`);
      assert.ok(tpl.type,   `模板 ${tpl.id} 缺少 type`);
      assert.ok(tpl.target > 0, `模板 ${tpl.id} target 应 > 0`);
      assert.ok(tpl.reward, `模板 ${tpl.id} 缺少 reward`);
      assert.ok(typeof tpl.reward.gold === "number", `模板 ${tpl.id} reward.gold 应是数字`);
    });
  });

  it("存在 daily_login 模板（每日登录任务）", () => {
    const loginTpl = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "daily_login");
    assert.ok(loginTpl, "应有 daily_login 任务模板");
    assert.equal(loginTpl.type, "login", "daily_login 类型应为 login");
  });

  it("_todayStr 返回 YYYY-M-D 格式的日期字符串", () => {
    const today = DailyQuest._todayStr();
    assert.ok(typeof today === "string", "_todayStr 应返回字符串");
    assert.ok(/^\d{4}-\d{1,2}-\d{1,2}$/.test(today), `日期格式错误：${today}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// B. 初始化与每日刷新
// ══════════════════════════════════════════════════════════════════════════

describe("[DailyQuest — 初始化]", () => {
  it("init 后 state.dailyQuests 存在", () => {
    const s = freshQuestState();
    DailyQuest.init();
    assert.ok(s.dailyQuests, "init 后 dailyQuests 应存在");
  });

  it("init 后生成 3 个任务（1 登录 + 2 随机）", () => {
    const s = freshQuestState();
    DailyQuest.init();
    assert.equal(s.dailyQuests.quests.length, 3, "应有 3 个每日任务");
  });

  it("init 后登录任务自动完成并标记 rewarded", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const loginQ = s.dailyQuests.quests.find(q => q.type === "login");
    assert.ok(loginQ, "应有登录任务");
    assert.equal(loginQ.completed, true, "登录任务应自动完成");
    assert.equal(loginQ.rewarded, true, "登录任务奖励应自动领取");
  });

  it("init 后登录奖励自动发放（gold 增加）", () => {
    const s = freshQuestState();
    const loginTpl = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "daily_login");
    DailyQuest.init();
    assert.ok(s.hero.gold >= loginTpl.reward.gold, "登录奖励 gold 应已发放");
  });

  it("init 后 date 字段为今天", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const today = DailyQuest._todayStr();
    assert.equal(s.dailyQuests.date, today, "date 应为今天");
  });

  it("重复调用 init 不重新初始化（任务保持不变）", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const firstQuests = JSON.stringify(s.dailyQuests.quests.map(q => q.id));
    DailyQuest.init(); // 第二次调用
    const secondQuests = JSON.stringify(s.dailyQuests.quests.map(q => q.id));
    assert.equal(firstQuests, secondQuests, "重复 init 不应改变任务");
  });

  it("_refreshIfNewDay 遇到不同日期时刷新任务", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const originalDate = s.dailyQuests.date;
    // 模拟日期变更
    s.dailyQuests.date = "1990-1-1";
    s.dailyQuests.sessionKills = 100; // 模拟旧的会话数据
    DailyQuest._refreshIfNewDay();
    // 日期应已刷新
    assert.equal(s.dailyQuests.date, originalDate, "日期应刷新到今天");
    // 会话数据应重置
    assert.equal(s.dailyQuests.sessionKills, 0, "换日后会话击杀数应重置");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// C. 进度更新
// ══════════════════════════════════════════════════════════════════════════

describe("[DailyQuest — 进度更新]", () => {
  it("onKill 增加 sessionKills", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const before = s.dailyQuests.sessionKills;
    DailyQuest.onKill(false);
    assert.equal(s.dailyQuests.sessionKills, before + 1, "onKill 后 sessionKills 应 +1");
  });

  it("onKill(true) 增加 sessionEliteKills", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onKill(true);
    assert.equal(s.dailyQuests.sessionEliteKills, 1, "精英击杀后 sessionEliteKills 应为 1");
  });

  it("onKill(false) 不增加 sessionEliteKills", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onKill(false);
    assert.equal(s.dailyQuests.sessionEliteKills, 0, "普通击杀后 sessionEliteKills 应为 0");
  });

  it("onDamage 增加 sessionDamage", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onDamage(500);
    assert.equal(s.dailyQuests.sessionDamage, 500, "onDamage 后 sessionDamage 应为 500");
  });

  it("onDamage 多次调用累计", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onDamage(300);
    DailyQuest.onDamage(700);
    assert.equal(s.dailyQuests.sessionDamage, 1000, "多次 onDamage 应累计");
  });

  it("onGoldEarned 增加 sessionGoldEarned", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onGoldEarned(100);
    assert.equal(s.dailyQuests.sessionGoldEarned, 100, "onGoldEarned 后 sessionGoldEarned 应为 100");
  });

  it("onBossKill 增加 sessionBossKills", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onBossKill();
    assert.equal(s.dailyQuests.sessionBossKills, 1, "onBossKill 后 sessionBossKills 应为 1");
  });

  it("onRest 增加 sessionRests", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onRest();
    assert.equal(s.dailyQuests.sessionRests, 1, "onRest 后 sessionRests 应为 1");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// D. 任务自动完成与奖励
// ══════════════════════════════════════════════════════════════════════════

describe("[DailyQuest — 任务完成与奖励]", () => {
  it("kill 类任务达到 target 后自动标记 completed", () => {
    const s = freshQuestState();
    DailyQuest.init();
    // 找到 kill_10 模板（target=10）
    const dq = s.dailyQuests;
    // 手动替换任务为 kill_10 来确定性测试
    const killTemplate = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "kill_10");
    dq.quests[1] = { ...killTemplate, progress: 0, completed: false, rewarded: false };

    // 击杀 10 次
    for (let i = 0; i < 10; i++) DailyQuest.onKill(false);

    const quest = dq.quests.find(q => q.id === "kill_10");
    assert.ok(quest, "kill_10 任务应存在");
    assert.equal(quest.completed, true, "击杀 10 次后任务应自动完成");
  });

  it("任务完成后自动发放奖励（gold 增加）", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const dq = s.dailyQuests;
    const killTemplate = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "kill_10");
    const goldBefore = s.hero.gold;
    dq.quests[1] = { ...killTemplate, progress: 0, completed: false, rewarded: false };

    for (let i = 0; i < 10; i++) DailyQuest.onKill(false);

    const quest = dq.quests.find(q => q.id === "kill_10");
    if (quest && quest.completed) {
      assert.ok(s.hero.gold >= goldBefore + killTemplate.reward.gold,
        "完成 kill_10 后 gold 应增加");
    }
  });

  it("奖励不重复发放（rewarded 标记后跳过）", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const dq = s.dailyQuests;
    const killTemplate = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "kill_10");
    dq.quests[1] = { ...killTemplate, progress: 0, completed: false, rewarded: false };

    for (let i = 0; i < 10; i++) DailyQuest.onKill(false);

    const goldAfterFirst = s.hero.gold;
    // 再次触发进度更新
    DailyQuest.onKill(false);
    assert.equal(s.hero.gold, goldAfterFirst, "任务已完成后再次触发不应重复发放奖励");
  });

  it("boss 击杀任务完成后发放 gems 奖励", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const dq = s.dailyQuests;
    const bossTemplate = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "defeat_boss");
    dq.quests[1] = { ...bossTemplate, progress: 0, completed: false, rewarded: false };

    const gemsBefore = s.hero.gems;
    DailyQuest.onBossKill();

    if (bossTemplate.reward.gems > 0) {
      assert.ok(s.hero.gems >= gemsBefore + bossTemplate.reward.gems,
        "击杀 boss 任务完成后应发放 gems");
    }
  });

  it("damage 类任务进度正确更新", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const dq = s.dailyQuests;
    const dmgTemplate = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "dmg_1000");
    dq.quests[1] = { ...dmgTemplate, progress: 0, completed: false, rewarded: false };

    DailyQuest.onDamage(500);
    const quest = dq.quests.find(q => q.id === "dmg_1000");
    assert.ok(quest && quest.progress >= 500, "造成 500 伤害后进度应为 500");
    assert.equal(quest.completed, false, "500 伤害不足 1000，任务未完成");

    DailyQuest.onDamage(600);
    assert.equal(quest.completed, true, "累计 1100 伤害后任务应完成");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// E. 查询接口
// ══════════════════════════════════════════════════════════════════════════

describe("[DailyQuest — 查询接口]", () => {
  it("getQuests 返回任务数组", () => {
    const s = freshQuestState();
    const quests = DailyQuest.getQuests();
    assert.ok(Array.isArray(quests), "getQuests 应返回数组");
    assert.equal(quests.length, 3, "应有 3 个每日任务");
  });

  it("getProgress 返回 total/completed/rewarded 字段", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const prog = DailyQuest.getProgress();
    assert.ok(typeof prog.total === "number", "应有 total 字段");
    assert.ok(typeof prog.completed === "number", "应有 completed 字段");
    assert.ok(typeof prog.rewarded === "number", "应有 rewarded 字段");
    assert.ok(prog.completed >= 1, "至少登录任务完成，completed >= 1");
  });

  it("getSessionStats 返回会话统计对象", () => {
    const s = freshQuestState();
    DailyQuest.init();
    DailyQuest.onKill(false);
    DailyQuest.onDamage(100);
    DailyQuest.onGoldEarned(50);
    const stats = DailyQuest.getSessionStats();
    assert.ok(stats.kills >= 1,    "kills 应 >= 1");
    assert.ok(stats.damage >= 100, "damage 应 >= 100");
    assert.ok(stats.goldEarned >= 50, "goldEarned 应 >= 50");
  });

  it("getSessionStats 包含 rests 和 bossKills 字段", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const stats = DailyQuest.getSessionStats();
    assert.ok(typeof stats.rests === "number", "应有 rests 字段");
    assert.ok(typeof stats.bossKills === "number", "应有 bossKills 字段");
  });

  it("getProgress.completed 在任务完成后增加", () => {
    const s = freshQuestState();
    DailyQuest.init();
    const dq = s.dailyQuests;
    const before = DailyQuest.getProgress().completed;

    // 强制插入一个容易完成的任务
    const restTemplate = DailyQuest.QUEST_TEMPLATES.find(t => t.id === "rest_once");
    dq.quests[1] = { ...restTemplate, progress: 0, completed: false, rewarded: false };

    DailyQuest.onRest();
    const after = DailyQuest.getProgress().completed;
    assert.ok(after > before, "完成任务后 completed 计数应增加");
  });
});
