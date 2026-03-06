// achievements.js — 成就系统

const Achievements = (() => {

  // ─────────────────────────────────────────
  // 成就定义
  // ─────────────────────────────────────────
  // condition(state): 返回 true 表示已满足条件
  // reward: { gems: N } 首次解锁时奖励
  const ACHIEVEMENT_LIST = [
    // ── 战斗里程碑 ─────────────────────────────
    {
      id: "first_kill",
      name: "First Blood",
      desc: "Kill your first monster.",
      icon: "⚔",
      reward: { gems: 0 },
      condition: (s) => s.stats.totalKills >= 1,
    },
    {
      id: "kill_10",
      name: "Warrior's Path",
      desc: "Kill 10 monsters.",
      icon: "⚔",
      reward: { gems: 0 },
      condition: (s) => s.stats.totalKills >= 10,
    },
    {
      id: "kill_100",
      name: "Seasoned Fighter",
      desc: "Kill 100 monsters.",
      icon: "⚔",
      reward: { gems: 1 },
      condition: (s) => s.stats.totalKills >= 100,
    },
    {
      id: "kill_1000",
      name: "Monster Slayer",
      desc: "Kill 1,000 monsters.",
      icon: "⚔",
      reward: { gems: 2 },
      condition: (s) => s.stats.totalKills >= 1000,
    },
    {
      id: "kill_10000",
      name: "Legendary Hunter",
      desc: "Kill 10,000 monsters.",
      icon: "🏆",
      reward: { gems: 5 },
      condition: (s) => s.stats.totalKills >= 10000,
    },

    // ── 等级里程碑 ─────────────────────────────
    {
      id: "reach_10",
      name: "Rising Hero",
      desc: "Reach level 10.",
      icon: "🌟",
      reward: { gems: 1 },
      condition: (s) => s.hero.level >= 10,
    },
    {
      id: "reach_25",
      name: "Veteran",
      desc: "Reach level 25.",
      icon: "🌟",
      reward: { gems: 2 },
      condition: (s) => s.hero.level >= 25,
    },
    {
      id: "reach_50",
      name: "Champion",
      desc: "Reach level 50.",
      icon: "🏆",
      reward: { gems: 5 },
      condition: (s) => s.hero.level >= 50,
    },

    // ── Boss 击败 ──────────────────────────────
    {
      id: "boss_plains",
      name: "Slime Crusher",
      desc: "Defeat the Giant Slime King.",
      icon: "👑",
      reward: { gems: 1 },
      condition: (s) => !!(s.bossDefeated && s.bossDefeated.plains),
    },
    {
      id: "boss_forest",
      name: "Treant Feller",
      desc: "Defeat the Ancient Treant.",
      icon: "👑",
      reward: { gems: 1 },
      condition: (s) => !!(s.bossDefeated && s.bossDefeated.forest),
    },
    {
      id: "boss_cave",
      name: "Lich Bane",
      desc: "Defeat the Lich.",
      icon: "💀",
      reward: { gems: 2 },
      condition: (s) => !!(s.bossDefeated && s.bossDefeated.cave),
    },
    {
      id: "boss_desert",
      name: "Wyrm Slayer",
      desc: "Defeat the Sand Wyrm.",
      icon: "🐉",
      reward: { gems: 3 },
      condition: (s) => !!(s.bossDefeated && s.bossDefeated.desert),
    },
    {
      id: "boss_castle",
      name: "Dark Lord's Bane",
      desc: "Defeat the Dark Lord and save the world!",
      icon: "🏆",
      reward: { gems: 10 },
      condition: (s) => !!(s.bossDefeated && s.bossDefeated.castle),
    },

    // ── 金币里程碑 ─────────────────────────────
    {
      id: "gold_1000",
      name: "Pocket Money",
      desc: "Earn 1,000 gold total.",
      icon: "🪙",
      reward: { gems: 0 },
      condition: (s) => s.stats.totalGoldEarned >= 1000,
    },
    {
      id: "gold_50000",
      name: "Merchant Prince",
      desc: "Earn 50,000 gold total.",
      icon: "🪙",
      reward: { gems: 2 },
      condition: (s) => s.stats.totalGoldEarned >= 50000,
    },
    {
      id: "gold_1000000",
      name: "Gold Hoarder",
      desc: "Earn 1,000,000 gold total.",
      icon: "💎",
      reward: { gems: 5 },
      condition: (s) => s.stats.totalGoldEarned >= 1000000,
    },

    // ── 连胜成就 ───────────────────────────────
    {
      id: "streak_10",
      name: "On a Roll",
      desc: "Achieve a 10 kill streak.",
      icon: "🔥",
      reward: { gems: 1 },
      condition: (s) => (s.stats.maxKillStreak || 0) >= 10,
    },
    {
      id: "streak_50",
      name: "Unstoppable",
      desc: "Achieve a 50 kill streak.",
      icon: "🔥",
      reward: { gems: 3 },
      condition: (s) => (s.stats.maxKillStreak || 0) >= 50,
    },

    // ── 装备成就 ───────────────────────────────
    {
      id: "first_legendary",
      name: "Legend Born",
      desc: "Obtain a Legendary item.",
      icon: "💎",
      reward: { gems: 3 },
      condition: (s) => {
        const allItems = [
          ...Object.values(s.equipment).filter(Boolean),
          ...(s.inventory || []),
        ];
        return allItems.some(i => i.rarity === "legendary");
      },
    },
    {
      id: "full_gear",
      name: "Fully Armed",
      desc: "Have items equipped in all 6 slots.",
      icon: "⚔",
      reward: { gems: 1 },
      condition: (s) => {
        const eq = s.equipment || {};
        return ["weapon","helmet","chest","legs","ring","neck"].every(k => !!eq[k]);
      },
    },

    // ── 转生成就 ───────────────────────────────
    {
      id: "first_prestige",
      name: "Reborn",
      desc: "Prestige for the first time.",
      icon: "✨",
      reward: { gems: 5 },
      condition: (s) => s.hero.prestigeCount >= 1,
    },

    // ── 精英怪成就 ─────────────────────────────
    {
      id: "first_elite",
      name: "Elite Hunter",
      desc: "Defeat your first Elite monster.",
      icon: "⚠",
      reward: { gems: 1 },
      condition: (s) => (s.stats.eliteKills || 0) >= 1,
    },
    {
      id: "elite_100",
      name: "Elite Slayer",
      desc: "Defeat 100 Elite monsters.",
      icon: "⚠",
      reward: { gems: 3 },
      condition: (s) => (s.stats.eliteKills || 0) >= 100,
    },
  ];

  // ─────────────────────────────────────────
  // 检查成就
  // 每次游戏循环调用，找到新解锁的成就并触发奖励
  // ─────────────────────────────────────────
  function check() {
    const state = State.get();
    if (!state.achievements) state.achievements = {};

    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENT_LIST) {
      if (state.achievements[ach.id]) continue; // 已解锁
      if (!ach.condition(state)) continue;       // 未满足

      // 解锁！
      state.achievements[ach.id] = { unlockedAt: Date.now() };
      newlyUnlocked.push(ach);

      // 发放奖励
      if (ach.reward.gems > 0) {
        state.hero.gems += ach.reward.gems;
        if (window.UI) {
          UI.addLog(`>> 🏆 ACHIEVEMENT: "${ach.name}" — +${ach.reward.gems} Gem${ach.reward.gems > 1 ? "s" : ""}!`, "yellow", "loot");
        }
      } else {
        if (window.UI) {
          UI.addLog(`>> 🏆 ACHIEVEMENT: "${ach.name}" — ${ach.desc}`, "yellow", "loot");
        }
      }
    }

    if (newlyUnlocked.length > 0 && window.UI) {
      UI.markSidePanelDirty();
    }

    return newlyUnlocked;
  }

  /**
   * 获取所有成就（用于 UI 展示）
   * 返回 { ...ach, unlocked: bool, unlockedAt: timestamp|null }
   */
  function getAll() {
    const state = State.get();
    const achState = state.achievements || {};
    return ACHIEVEMENT_LIST.map(ach => ({
      ...ach,
      unlocked: !!achState[ach.id],
      unlockedAt: achState[ach.id] ? achState[ach.id].unlockedAt : null,
    }));
  }

  /**
   * 获取已解锁成就数量 / 总数
   */
  function getProgress() {
    const all = getAll();
    const unlocked = all.filter(a => a.unlocked).length;
    return { unlocked, total: all.length };
  }

  return {
    ACHIEVEMENT_LIST,
    check,
    getAll,
    getProgress,
  };
})();

window.Achievements = Achievements;
