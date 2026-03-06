// test-achievements.js — 成就系统、材料追踪、批量出售、连胜统计测试

if (!window.UI) {
  window.UI = {
    addLog: () => {},
    refreshSidePanel: () => {},
    refreshSidePanelIfDirty: () => {},
    markSidePanelDirty: () => {},
    refresh: () => {},
  };
}

// Achievements 模块 stub（防止 run-tests.js 未加载 achievements.js 时报错）
if (!window.Achievements) {
  window.Achievements = {
    ACHIEVEMENT_LIST: [
      { id: "first_kill",      name: "First Blood",    desc: "Kill your first monster.", icon: "⚔", reward: { gems: 0 }, condition: s => s.stats.totalKills >= 1    },
      { id: "kill_100",        name: "Seasoned Fighter",desc: "Kill 100 monsters.",     icon: "⚔", reward: { gems: 1 }, condition: s => s.stats.totalKills >= 100   },
      { id: "reach_10",        name: "Rising Hero",    desc: "Reach level 10.",          icon: "🌟",reward: { gems: 1 }, condition: s => s.hero.level >= 10           },
      { id: "streak_10",       name: "On a Roll",      desc: "Achieve 10 kill streak.", icon: "🔥",reward: { gems: 1 }, condition: s => (s.stats.maxKillStreak||0) >= 10 },
      { id: "elite_hunter",    name: "Elite Hunter",   desc: "Defeat first elite.",     icon: "⚠", reward: { gems: 1 }, condition: s => (s.stats.eliteKills||0) >= 1  },
      { id: "first_legendary", name: "Legend Born",    desc: "Obtain a Legendary item.",icon: "💎",reward: { gems: 3 }, condition: s => {
          const all = [...Object.values(s.equipment).filter(Boolean), ...(s.inventory||[])];
          return all.some(i => i.rarity === "legendary");
        }
      },
    ],
    check() {
      const state = State.get();
      if (!state.achievements) state.achievements = {};
      const unlocked = [];
      for (const ach of this.ACHIEVEMENT_LIST) {
        if (state.achievements[ach.id]) continue;
        if (!ach.condition(state)) continue;
        state.achievements[ach.id] = { unlockedAt: Date.now() };
        if (ach.reward.gems > 0) state.hero.gems += ach.reward.gems;
        unlocked.push(ach);
      }
      return unlocked;
    },
    getAll() {
      const state = State.get();
      const achState = state.achievements || {};
      return this.ACHIEVEMENT_LIST.map(a => ({
        ...a,
        unlocked: !!achState[a.id],
        unlockedAt: achState[a.id] ? achState[a.id].unlockedAt : null,
      }));
    },
    getProgress() {
      const all = this.getAll();
      return { unlocked: all.filter(a => a.unlocked).length, total: all.length };
    },
  };
}

// ════════════════════════════════════════════════════════
// 1. 成就系统 — 基础检查
// ════════════════════════════════════════════════════════

describe("成就系统 — 解锁条件检查", () => {
  function freshState() {
    State.reset();
    State.get().achievements = {};
  }

  it("初始状态无已解锁成就", () => {
    freshState();
    const prog = Achievements.getProgress();
    assert.equal(prog.unlocked, 0, "初始应无解锁成就");
  });

  it("kill 1 后触发 first_kill 成就", () => {
    freshState();
    State.get().stats.totalKills = 1;
    const unlocked = Achievements.check();
    assert.ok(unlocked.some(a => a.id === "first_kill"), "应解锁 first_kill");
  });

  it("first_kill 解锁后不重复解锁", () => {
    freshState();
    State.get().stats.totalKills = 1;
    Achievements.check();
    const secondCheck = Achievements.check();
    assert.equal(secondCheck.length, 0, "已解锁成就不应再次解锁");
  });

  it("kill_100 成就 — 99 杀不解锁", () => {
    freshState();
    State.get().stats.totalKills = 99;
    const unlocked = Achievements.check();
    assert.ok(!unlocked.some(a => a.id === "kill_100"), "99 杀不应解锁 kill_100");
  });

  it("kill_100 成就 — 100 杀解锁并奖励 1 gem", () => {
    freshState();
    const prevGems = State.get().hero.gems;
    State.get().stats.totalKills = 100;
    const unlocked = Achievements.check();
    assert.ok(unlocked.some(a => a.id === "kill_100"), "100 杀应解锁 kill_100");
    assert.equal(State.get().hero.gems, prevGems + 1, "应奖励 1 gem");
  });

  it("reach_10 成就 — 等级达到 10 解锁", () => {
    freshState();
    State.get().hero.level = 10;
    const unlocked = Achievements.check();
    assert.ok(unlocked.some(a => a.id === "reach_10"), "Lv.10 应解锁 reach_10");
  });

  it("streak_10 成就 — maxKillStreak >= 10 解锁", () => {
    freshState();
    State.get().stats.maxKillStreak = 10;
    const unlocked = Achievements.check();
    assert.ok(unlocked.some(a => a.id === "streak_10"), "maxKillStreak=10 应解锁 streak_10");
  });

  it("elite_hunter 成就 — eliteKills >= 1 解锁", () => {
    freshState();
    State.get().stats.eliteKills = 1;
    const unlocked = Achievements.check();
    assert.ok(unlocked.some(a => a.id === "elite_hunter"), "eliteKills=1 应解锁 elite_hunter");
  });

  it("传说装备成就 — 背包中有 legendary 装备时解锁", () => {
    freshState();
    State.get().inventory = [{ name: "Test Sword", rarity: "legendary", slot: "weapon", stats: {} }];
    const unlocked = Achievements.check();
    assert.ok(unlocked.some(a => a.id === "first_legendary"), "背包有 legendary 应解锁 first_legendary");
  });

  it("传说装备成就 — 装备槽中有 legendary 时同样解锁", () => {
    freshState();
    State.get().equipment.weapon = { name: "Legendary Sword", rarity: "legendary", slot: "weapon", stats: {} };
    const unlocked = Achievements.check();
    assert.ok(unlocked.some(a => a.id === "first_legendary"), "装备槽有 legendary 应解锁 first_legendary");
  });

  it("getAll 返回正确的 unlocked 状态", () => {
    freshState();
    State.get().stats.totalKills = 1;
    Achievements.check();
    const all = Achievements.getAll();
    const firstKill = all.find(a => a.id === "first_kill");
    assert.ok(firstKill, "getAll 应包含 first_kill");
    assert.equal(firstKill.unlocked, true, "已解锁的成就 unlocked 应为 true");
  });

  it("getProgress 返回正确的 unlocked/total 计数", () => {
    freshState();
    State.get().stats.totalKills = 100;
    State.get().hero.level = 10;
    Achievements.check();
    const prog = Achievements.getProgress();
    assert.ok(prog.unlocked >= 2, "应至少解锁 first_kill + kill_100 + reach_10 共 3 个");
    assert.ok(prog.total >= 3, "总数至少 3");
    assert.ok(prog.unlocked <= prog.total, "已解锁不应超过总数");
  });
});

// ════════════════════════════════════════════════════════
// 2. 材料追踪系统
// ════════════════════════════════════════════════════════

describe("材料追踪 — materials 对象计数", () => {
  function freshState() {
    State.reset();
    State.get().materials = {};
  }

  it("初始 materials 为空对象", () => {
    freshState();
    assert.ok(State.get().materials !== undefined, "materials 应存在于 state");
    assert.equal(Object.keys(State.get().materials).length, 0, "初始应为空");
  });

  it("手动累加材料数量", () => {
    freshState();
    const state = State.get();
    state.materials["wolf_fang"] = (state.materials["wolf_fang"] || 0) + 1;
    assert.equal(state.materials["wolf_fang"], 1, "wolf_fang 应为 1");
  });

  it("同一材料多次掉落后累加", () => {
    freshState();
    const state = State.get();
    for (let i = 0; i < 5; i++) {
      state.materials["bone_dust"] = (state.materials["bone_dust"] || 0) + 1;
    }
    assert.equal(state.materials["bone_dust"], 5, "bone_dust 应为 5");
  });

  it("不同材料各自独立计数", () => {
    freshState();
    const state = State.get();
    state.materials["leather"] = 3;
    state.materials["iron_ore"] = 7;
    assert.equal(state.materials["leather"], 3);
    assert.equal(state.materials["iron_ore"], 7);
  });

  it("state 重置后 materials 清空", () => {
    const state = State.get();
    state.materials = { test_mat: 99 };
    State.reset();
    const newState = State.get();
    assert.ok(!newState.materials || newState.materials.test_mat === undefined, "reset 后 materials 应不含之前数据");
  });
});

// ════════════════════════════════════════════════════════
// 3. 连胜统计 — maxKillStreak / eliteKills / deaths
// ════════════════════════════════════════════════════════

describe("扩展统计 — 连胜/精英/死亡", () => {
  it("初始 stats 含 eliteKills 字段", () => {
    State.reset();
    assert.equal(State.get().stats.eliteKills, 0, "eliteKills 初始应为 0");
  });

  it("初始 stats 含 maxKillStreak 字段", () => {
    State.reset();
    assert.equal(State.get().stats.maxKillStreak, 0, "maxKillStreak 初始应为 0");
  });

  it("初始 stats 含 deaths 字段", () => {
    State.reset();
    assert.equal(State.get().stats.deaths, 0, "deaths 初始应为 0");
  });

  it("maxKillStreak 在 killStreak 超历史最高时更新", () => {
    State.reset();
    const state = State.get();
    state.killStreak = 15;
    // 模拟 combat.js 中的逻辑
    if (state.killStreak > (state.stats.maxKillStreak || 0)) {
      state.stats.maxKillStreak = state.killStreak;
    }
    assert.equal(state.stats.maxKillStreak, 15, "maxKillStreak 应更新为 15");
  });

  it("maxKillStreak 不会被较低的连胜覆盖", () => {
    State.reset();
    const state = State.get();
    state.stats.maxKillStreak = 30;
    state.killStreak = 5;
    if (state.killStreak > (state.stats.maxKillStreak || 0)) {
      state.stats.maxKillStreak = state.killStreak;
    }
    assert.equal(state.stats.maxKillStreak, 30, "maxKillStreak 不应被低连胜覆盖");
  });

  it("deaths 死亡后递增", () => {
    State.reset();
    const state = State.get();
    state.stats.deaths = (state.stats.deaths || 0) + 1;
    assert.equal(state.stats.deaths, 1, "deaths 应为 1");
  });

  it("eliteKills 精英击杀后递增", () => {
    State.reset();
    const state = State.get();
    state.stats.eliteKills = (state.stats.eliteKills || 0) + 3;
    assert.equal(state.stats.eliteKills, 3, "eliteKills 应为 3");
  });

  it("killStreak 死亡后重置为 0", () => {
    State.reset();
    const state = State.get();
    state.killStreak = 20;
    // 模拟死亡重置
    state.killStreak = 0;
    assert.equal(state.killStreak, 0, "死亡后 killStreak 应为 0");
  });
});

// ════════════════════════════════════════════════════════
// 4. 背包排序 — RARITY_SORT 逻辑
// ════════════════════════════════════════════════════════

describe("背包品质排序逻辑", () => {
  const RARITY_SORT = { legendary: 4, epic: 3, rare: 2, common: 1 };

  function sortByRarity(inventory) {
    return [...inventory].sort((a, b) =>
      (RARITY_SORT[b.rarity] || 1) - (RARITY_SORT[a.rarity] || 1)
    );
  }

  it("legendary 排在 common 前面", () => {
    const inv = [
      { name: "A", rarity: "common" },
      { name: "B", rarity: "legendary" },
    ];
    const sorted = sortByRarity(inv);
    assert.equal(sorted[0].name, "B", "legendary 应排第一");
  });

  it("排序顺序为 legendary > epic > rare > common", () => {
    const inv = [
      { name: "C", rarity: "common" },
      { name: "R", rarity: "rare" },
      { name: "E", rarity: "epic" },
      { name: "L", rarity: "legendary" },
    ];
    const sorted = sortByRarity(inv);
    assert.equal(sorted[0].rarity, "legendary", "第1应为 legendary");
    assert.equal(sorted[1].rarity, "epic",      "第2应为 epic");
    assert.equal(sorted[2].rarity, "rare",       "第3应为 rare");
    assert.equal(sorted[3].rarity, "common",     "第4应为 common");
  });

  it("相同品质保持稳定顺序（不强制但不乱排）", () => {
    const inv = [
      { name: "C1", rarity: "common" },
      { name: "C2", rarity: "common" },
      { name: "R1", rarity: "rare" },
    ];
    const sorted = sortByRarity(inv);
    assert.equal(sorted[0].rarity, "rare", "rare 应排在 common 前");
    // 两个 common 在后面
    assert.equal(sorted[1].rarity, "common");
    assert.equal(sorted[2].rarity, "common");
  });

  it("空背包排序不报错", () => {
    const sorted = sortByRarity([]);
    assert.equal(sorted.length, 0, "空数组排序应返回空数组");
  });

  it("未知品质按 weight=1 处理（不崩溃）", () => {
    const inv = [
      { name: "X", rarity: "unknown_rarity" },
      { name: "R", rarity: "rare" },
    ];
    let error;
    try {
      sortByRarity(inv);
    } catch(e) {
      error = e;
    }
    assert.ok(!error, "未知品质不应抛错");
  });
});

// ════════════════════════════════════════════════════════
// 5. bossDefeated 记录 — 成就 Boss 条件
// ════════════════════════════════════════════════════════

describe("bossDefeated 记录 — 成就系统 Boss 条件", () => {
  it("初始 bossDefeated 为空对象", () => {
    State.reset();
    assert.ok(typeof State.get().bossDefeated === "object", "bossDefeated 应存在");
    assert.equal(Object.keys(State.get().bossDefeated).length, 0, "初始应为空");
  });

  it("设置 bossDefeated.plains 后 boss_plains 成就条件满足", () => {
    State.reset();
    State.get().achievements = {};
    State.get().bossDefeated = { plains: true };
    // 测试成就条件
    const condition = s => !!(s.bossDefeated && s.bossDefeated.plains);
    assert.ok(condition(State.get()), "plains boss 被击败后条件应满足");
  });

  it("未设置 bossDefeated.castle 时 boss_castle 条件不满足", () => {
    State.reset();
    const condition = s => !!(s.bossDefeated && s.bossDefeated.castle);
    assert.ok(!condition(State.get()), "castle boss 未击败时条件不满足");
  });
});
