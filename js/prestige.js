// prestige.js — 转生系统

const Prestige = (() => {
  /**
   * 检查转生条件
   * 需要击败 castle 区域的 Final Boss
   */
  function canPrestige() {
    return Zones.isBossDefeated("castle");
  }

  /**
   * 执行转生
   */
  function doPrestige() {
    if (!canPrestige()) {
      if (window.UI) UI.addLog(">> Defeat the Dark Lord first!", "red");
      return;
    }

    if (!confirm(
      "PRESTIGE: Reset your progress but gain permanent bonuses?\n" +
      "You will keep: Gems, Stats, Prestige bonuses.\n" +
      "You will lose: Level, Equipment, Gold, Skills, Zone progress."
    )) return;

    const state = State.get();

    // 计算本次获得宝石
    const gemsGain = 1 + Math.floor(state.hero.prestigeCount / 2);
    const newGems = state.hero.gems + gemsGain;

    // 保存需要继承的值
    const newPrestigeCount = state.hero.prestigeCount + 1;
    const newPrestigeBonus = Utils.roundTo(state.hero.prestigeBonus * 1.2, 4);
    const prevStats = Utils.deepClone(state.stats);

    // 重置为默认状态
    State.reset();
    const fresh = State.get();

    // 恢复转生相关数据
    fresh.hero.prestigeCount  = newPrestigeCount;
    fresh.hero.prestigeBonus  = newPrestigeBonus;
    fresh.hero.gems           = newGems;
    fresh.stats               = prevStats;   // 累计统计保留

    if (window.UI) {
      UI.addLog(">> ========================================", "yellow");
      UI.addLog(`>> PRESTIGE x${newPrestigeCount} complete!`, "yellow");
      UI.addLog(`>> +${gemsGain} Gem(s) received. (Total: ${newGems})`, "yellow");
      UI.addLog(`>> ATK Bonus: x${newPrestigeBonus.toFixed(2)}`, "yellow");
      UI.addLog(">> ========================================", "yellow");
      UI.refresh();
      UI.refreshSidePanel();
    }

    Save.save();
  }

  /**
   * 获取转生信息摘要（用于 Stats 面板显示）
   */
  function getInfo() {
    const state = State.get();
    return {
      count:  state.hero.prestigeCount,
      bonus:  state.hero.prestigeBonus,
      gems:   state.hero.gems,
      canDo:  canPrestige(),
    };
  }

  return { canPrestige, doPrestige, getInfo };
})();

window.Prestige = Prestige;
