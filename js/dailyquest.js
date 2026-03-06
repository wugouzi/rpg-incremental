// dailyquest.js — 每日任务系统
// 每天刷新 3 个随机任务，完成奖励 Gold/Gems，增加玩家回访动力

const DailyQuest = (() => {

  // ─────────────────────────────────────────
  // 任务模板定义
  // ─────────────────────────────────────────

  const QUEST_TEMPLATES = [
    // 击杀类
    {
      id: "kill_10",
      name: "Monster Slayer I",
      desc: "Defeat 10 monsters",
      type: "kill",
      target: 10,
      reward: { gold: 200, gems: 0 },
    },
    {
      id: "kill_30",
      name: "Monster Slayer II",
      desc: "Defeat 30 monsters",
      type: "kill",
      target: 30,
      reward: { gold: 500, gems: 0 },
    },
    {
      id: "kill_50",
      name: "Monster Slayer III",
      desc: "Defeat 50 monsters",
      type: "kill",
      target: 50,
      reward: { gold: 1000, gems: 1 },
    },
    // 精英怪类
    {
      id: "elite_3",
      name: "Elite Hunter I",
      desc: "Defeat 3 elite monsters",
      type: "eliteKill",
      target: 3,
      reward: { gold: 300, gems: 0 },
    },
    {
      id: "elite_8",
      name: "Elite Hunter II",
      desc: "Defeat 8 elite monsters",
      type: "eliteKill",
      target: 8,
      reward: { gold: 800, gems: 1 },
    },
    // 连胜类
    {
      id: "streak_5",
      name: "Kill Streak I",
      desc: "Reach a kill streak of 5",
      type: "streak",
      target: 5,
      reward: { gold: 150, gems: 0 },
    },
    {
      id: "streak_15",
      name: "Kill Streak II",
      desc: "Reach a kill streak of 15",
      type: "streak",
      target: 15,
      reward: { gold: 400, gems: 0 },
    },
    {
      id: "streak_30",
      name: "Kill Streak III",
      desc: "Reach a kill streak of 30",
      type: "streak",
      target: 30,
      reward: { gold: 900, gems: 1 },
    },
    // 伤害类
    {
      id: "dmg_1000",
      name: "Damage Dealer I",
      desc: "Deal 1,000 total damage",
      type: "damage",
      target: 1000,
      reward: { gold: 200, gems: 0 },
    },
    {
      id: "dmg_10000",
      name: "Damage Dealer II",
      desc: "Deal 10,000 total damage",
      type: "damage",
      target: 10000,
      reward: { gold: 600, gems: 0 },
    },
    {
      id: "dmg_100000",
      name: "Damage Dealer III",
      desc: "Deal 100,000 total damage",
      type: "damage",
      target: 100000,
      reward: { gold: 2000, gems: 1 },
    },
    // 金币类
    {
      id: "earn_gold_500",
      name: "Gold Rush I",
      desc: "Earn 500 gold today",
      type: "goldEarned",
      target: 500,
      reward: { gold: 100, gems: 0 },
    },
    {
      id: "earn_gold_2000",
      name: "Gold Rush II",
      desc: "Earn 2,000 gold today",
      type: "goldEarned",
      target: 2000,
      reward: { gold: 400, gems: 0 },
    },
    {
      id: "earn_gold_10000",
      name: "Gold Rush III",
      desc: "Earn 10,000 gold today",
      type: "goldEarned",
      target: 10000,
      reward: { gold: 1500, gems: 1 },
    },
    // Boss 类
    {
      id: "defeat_boss",
      name: "Boss Challenger",
      desc: "Defeat a zone boss",
      type: "bossKill",
      target: 1,
      reward: { gold: 500, gems: 1 },
    },
    // 休息类
    {
      id: "rest_once",
      name: "Take a Break",
      desc: "Use [REST] once",
      type: "rest",
      target: 1,
      reward: { gold: 100, gems: 0 },
    },
    // 连续登录奖励（特殊）
    {
      id: "daily_login",
      name: "Daily Login",
      desc: "Just log in today (auto-complete!)",
      type: "login",
      target: 1,
      reward: { gold: 50, gems: 0 },
    },
  ];

  // ─────────────────────────────────────────
  // 辅助函数
  // ─────────────────────────────────────────

  /** 获取今天的日期字符串 YYYY-MM-DD（用于每日刷新检测）*/
  function _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }

  /** 从 QUEST_TEMPLATES 中随机选 count 个不重复任务 */
  function _pickRandom(count) {
    const pool = [...QUEST_TEMPLATES];
    const result = [];
    while (result.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  // ─────────────────────────────────────────
  // 初始化 & 每日刷新
  // ─────────────────────────────────────────

  /** 初始化（从 state 读取或生成新一天的任务） */
  function init() {
    const state = State.get();
    if (!state.dailyQuests) {
      state.dailyQuests = {
        date: "",
        quests: [],
        sessionKills: 0,      // 当日击杀计数
        sessionEliteKills: 0, // 当日精英击杀计数
        sessionDamage: 0,     // 当日总伤害
        sessionGoldEarned: 0, // 当日获得金币
        sessionBossKills: 0,  // 当日Boss击杀
        sessionRests: 0,      // 当日使用REST次数
      };
    }
    _refreshIfNewDay();
  }

  /** 若是新的一天则刷新任务列表 */
  function _refreshIfNewDay() {
    const state = State.get();
    const dq = state.dailyQuests;
    const today = _todayStr();

    if (dq.date !== today) {
      // 新的一天
      dq.date = today;
      dq.sessionKills = 0;
      dq.sessionEliteKills = 0;
      dq.sessionDamage = 0;
      dq.sessionGoldEarned = 0;
      dq.sessionBossKills = 0;
      dq.sessionRests = 0;

      // 随机选 3 个任务（登录任务固定加上）
      const loginQuest = QUEST_TEMPLATES.find(t => t.id === "daily_login");
      const pool = QUEST_TEMPLATES.filter(t => t.id !== "daily_login");
      const picked = _pickRandom(2); // 从其余中选 2 个
      const quests = [loginQuest, ...picked].map(tpl => ({
        ...tpl,
        progress: tpl.type === "login" ? 1 : 0, // 登录任务直接完成
        completed: tpl.type === "login",
        rewarded: false,
      }));

      dq.quests = quests;

      // 自动领取登录奖励
      const loginQ = dq.quests.find(q => q.type === "login");
      if (loginQ && loginQ.completed && !loginQ.rewarded) {
        _claimReward(loginQ, false); // 静默领取（不弹日志，避免init时干扰）
      }

      if (window.UI) {
        UI.addLog(">> 📋 New daily quests available! Check [QUESTS] tab.", "yellow", "loot");
        UI.markSidePanelDirty();
      }
    }
  }

  // ─────────────────────────────────────────
  // 进度更新（由 combat.js 调用）
  // ─────────────────────────────────────────

  function onKill(isElite) {
    const state = State.get();
    if (!state.dailyQuests) return;
    _refreshIfNewDay();
    const dq = state.dailyQuests;

    dq.sessionKills = (dq.sessionKills || 0) + 1;
    if (isElite) dq.sessionEliteKills = (dq.sessionEliteKills || 0) + 1;

    _updateProgress(dq);
  }

  function onDamage(amount) {
    const state = State.get();
    if (!state.dailyQuests) return;
    const dq = state.dailyQuests;
    dq.sessionDamage = (dq.sessionDamage || 0) + amount;
    _updateProgress(dq);
  }

  function onGoldEarned(amount) {
    const state = State.get();
    if (!state.dailyQuests) return;
    const dq = state.dailyQuests;
    dq.sessionGoldEarned = (dq.sessionGoldEarned || 0) + amount;
    _updateProgress(dq);
  }

  function onBossKill() {
    const state = State.get();
    if (!state.dailyQuests) return;
    const dq = state.dailyQuests;
    dq.sessionBossKills = (dq.sessionBossKills || 0) + 1;
    _updateProgress(dq);
  }

  function onRest() {
    const state = State.get();
    if (!state.dailyQuests) return;
    const dq = state.dailyQuests;
    dq.sessionRests = (dq.sessionRests || 0) + 1;
    _updateProgress(dq);
  }

  /** 更新所有任务进度，自动触发完成 */
  function _updateProgress(dq) {
    const state = State.get();
    dq.quests.forEach(q => {
      if (q.completed) return;

      let current = 0;
      switch (q.type) {
        case "kill":       current = dq.sessionKills;       break;
        case "eliteKill":  current = dq.sessionEliteKills;  break;
        case "streak":     current = state.killStreak || 0; break;
        case "damage":     current = dq.sessionDamage;      break;
        case "goldEarned": current = dq.sessionGoldEarned;  break;
        case "bossKill":   current = dq.sessionBossKills;   break;
        case "rest":       current = dq.sessionRests;       break;
        case "login":      current = 1;                     break;
      }
      q.progress = Math.min(current, q.target);
      if (q.progress >= q.target) {
        q.completed = true;
        _claimReward(q, true);
      }
    });
  }

  /** 领取奖励 */
  function _claimReward(quest, notify) {
    if (quest.rewarded) return;
    quest.rewarded = true;
    const state = State.get();
    state.hero.gold += quest.reward.gold;
    if (quest.reward.gems > 0) state.hero.gems += quest.reward.gems;

    if (notify && window.UI) {
      const gemStr = quest.reward.gems > 0 ? ` +${quest.reward.gems}💎` : "";
      UI.addLog(`>> 📋 [QUEST] "${quest.name}" complete! +${quest.reward.gold}g${gemStr}`, "yellow", "loot");
      UI.markSidePanelDirty();
    }
  }

  // ─────────────────────────────────────────
  // 查询接口（供 UI 使用）
  // ─────────────────────────────────────────

  function getQuests() {
    const state = State.get();
    if (!state.dailyQuests) init();
    _refreshIfNewDay();
    return state.dailyQuests.quests || [];
  }

  function getProgress() {
    const quests = getQuests();
    return {
      total:     quests.length,
      completed: quests.filter(q => q.completed).length,
      rewarded:  quests.filter(q => q.rewarded).length,
    };
  }

  /** 获取当日会话统计（供 UI 展示） */
  function getSessionStats() {
    const state = State.get();
    if (!state.dailyQuests) return {};
    return {
      kills:       state.dailyQuests.sessionKills       || 0,
      eliteKills:  state.dailyQuests.sessionEliteKills  || 0,
      damage:      state.dailyQuests.sessionDamage      || 0,
      goldEarned:  state.dailyQuests.sessionGoldEarned  || 0,
      bossKills:   state.dailyQuests.sessionBossKills   || 0,
      rests:       state.dailyQuests.sessionRests       || 0,
    };
  }

  return {
    QUEST_TEMPLATES,
    init,
    onKill,
    onDamage,
    onGoldEarned,
    onBossKill,
    onRest,
    getQuests,
    getProgress,
    getSessionStats,
    _refreshIfNewDay,
    _todayStr,
  };
})();

window.DailyQuest = DailyQuest;
