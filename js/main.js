// main.js — 入口：初始化 + 游戏主循环

const Game = (() => {
  const TICK_INTERVAL = 100; // ms
  let lastTickTime = 0;
  let loopId = null;
  let autoSaveId = null;

  function init() {
    // 1. 读档（或初始化默认状态）
    Save.load();

    // 2. 初始化黑市（首批商品）
    if (window.BlackMarket) BlackMarket.init();

    // 3. 绑定 DOM 事件
    UI.init();

    // 4. 首次渲染
    UI.refresh();
    UI.switchTab("stats");

    // 4. 欢迎消息
    UI.addLog(">> ====================================", "white");
    UI.addLog(">> Welcome to IDLE HERO", "yellow");
    UI.addLog(">> Click [ATTACK] to start fighting!", "green");
    UI.addLog(">> Unlock [AUTO: OFF] to fight automatically.", "gray");
    UI.addLog(">> ====================================", "white");

    // 5. 启动主循环
    lastTickTime = Date.now();
    startLoop();
  }

  function startLoop() {
    if (loopId) clearInterval(loopId);
    lastTickTime = Date.now();
    loopId = setInterval(tick, TICK_INTERVAL);

    // 自动存档（30s）
    if (autoSaveId) clearInterval(autoSaveId);
    autoSaveId = setInterval(() => Save.save(), 30000);
  }

  function tick() {
    const now = Date.now();
    const delta = now - lastTickTime;
    lastTickTime = now;

    const state = State.get();

    // 若开启自动战斗且没有当前怪物，自动生成
    if (state.autoFight && !state.currentMonster && state.hero.hp > 0) {
      Combat.spawnAndFight();
    }

    // 战斗 tick（也处理非战斗状态下的 HP/MP 回复 & Rest）
    if (state.hero.hp > 0) {
      Combat.tick(delta);
    }

    // 黑市 tick（倒计时刷新 & buff 衰减）
    if (window.BlackMarket) BlackMarket.tick(delta);

    // HP/MP 不超过上限（防止 regen 等导致溢出）
    const maxHp = State.getTotalMaxHp();
    const maxMp = State.getTotalMaxMp();
    if (state.hero.hp > maxHp) state.hero.hp = maxHp;
    if (state.hero.mp > maxMp) state.hero.mp = maxMp;

    // UI 刷新（左侧英雄面板 + 中间战斗面板 + 右侧侧边栏）
    UI.refresh();
    // 仅在数据变化时刷新侧面板（避免每 tick 重建 DOM 导致 hover 闪烁）
    UI.refreshSidePanelIfDirty();
  }

  // 页面关闭/刷新时自动存档
  window.addEventListener("beforeunload", () => {
    Save.save();
  });

  // DOMContentLoaded 后启动
  document.addEventListener("DOMContentLoaded", init);

  return { init, startLoop, tick };
})();

window.Game = Game;
