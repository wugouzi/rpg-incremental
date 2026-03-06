// zones.js — 区域定义与解锁逻辑

const Zones = (() => {
  // levelRange: [min, max] — 怪物等级 = clamp(heroLevel + killStreakBonus, min, max)
  // killStreakScale: 每连胜额外怪物等级叠加（上限为 levelRange[1] - levelRange[0]）
  const ZONE_LIST = [
    {
      id: "plains",
      name: "Verdant Plains",
      shortName: "Plains",
      unlockCondition: null,  // 初始解锁
      description: "A peaceful grassland. Perfect for beginners.",
      bossName: "Giant Slime King",
      levelRange: [1, 8],          // Lv1~8 怪物
      killStreakScale: 0.5,         // 每连胜提升 0.5 级（上限 levelRange[1]）
    },
    {
      id: "forest",
      name: "Dark Forest",
      shortName: "Forest",
      unlockCondition: "plains", // 需要击败 plains Boss
      description: "Ancient trees block the sunlight. Danger lurks within.",
      bossName: "Ancient Treant",
      levelRange: [5, 18],
      killStreakScale: 0.6,
    },
    {
      id: "cave",
      name: "Skull Cave",
      shortName: "Cave",
      unlockCondition: "forest",
      description: "The stench of death fills the air. Undead roam freely.",
      bossName: "Lich",
      levelRange: [14, 30],
      killStreakScale: 0.7,
    },
    {
      id: "desert",
      name: "Scorched Desert",
      shortName: "Desert",
      unlockCondition: "cave",
      description: "Scorching sands stretch endlessly. The heat is unforgiving.",
      bossName: "Sand Wyrm",
      levelRange: [25, 45],
      killStreakScale: 0.8,
    },
    {
      id: "castle",
      name: "Dark Lord's Castle",
      shortName: "Castle",
      unlockCondition: "desert",
      description: "The final stronghold of darkness. Only the strongest dare enter.",
      bossName: "Dark Lord",
      isFinal: true,
      levelRange: [40, 70],
      killStreakScale: 1.0,
    },
  ];

  /**
   * 获取区域元数据
   */
  function getZone(id) {
    return ZONE_LIST.find(z => z.id === id) || null;
  }

  /**
   * 返回当前已解锁的区域列表（从 State 读取）
   */
  function getUnlocked() {
    const state = State.get();
    return ZONE_LIST.filter(z => state.unlockedZones.includes(z.id));
  }

  /**
   * 检查某区域是否已解锁
   */
  function isUnlocked(zoneId) {
    return State.get().unlockedZones.includes(zoneId);
  }

  /**
   * 击败某区域 Boss 后，尝试解锁下一区域
   */
  function onBossDefeated(zoneId) {
    const state = State.get();
    // 标记 Boss 已击败
    state.bossDefeated[zoneId] = true;
    state.stats.bossesDefeated++;

    // 找到下一个以此区域为解锁条件的区域
    const next = ZONE_LIST.find(z => z.unlockCondition === zoneId);
    if (next && !state.unlockedZones.includes(next.id)) {
      state.unlockedZones.push(next.id);
      if (window.UI) {
        UI.addLog(`>> NEW ZONE UNLOCKED: ${next.name}!`, "yellow");
      }
    }
  }

  /**
   * 切换当前区域
   */
  function enterZone(zoneId) {
    if (!isUnlocked(zoneId)) return false;
    const state = State.get();
    state.currentZone = zoneId;
    state.currentMonster = null;
    if (window.UI) {
      UI.addLog(`>> Entered: ${getZone(zoneId).name}`, "cyan");
    }
    return true;
  }

  /**
   * 某区域 Boss 是否已被击败
   */
  function isBossDefeated(zoneId) {
    return !!State.get().bossDefeated[zoneId];
  }

  /**
   * 获取所有区域（用于 UI 展示）
   */
  function getAll() {
    return ZONE_LIST;
  }

  return { getZone, getUnlocked, isUnlocked, onBossDefeated, enterZone, isBossDefeated, getAll, ZONE_LIST };
})();

window.Zones = Zones;
