// save.js — localStorage 存读档

const Save = (() => {
  const SAVE_KEY   = "idle_hero_save";
  const SAVE_VER   = "0.1";
  const OFFLINE_CAP = 8 * 60 * 60; // 最多 8 小时离线收益（秒）

  // ─────────────────────────────────────────
  // 存档
  // ─────────────────────────────────────────

  function save() {
    const state = State.get();
    state.lastSaveTime = Date.now();
    const payload = {
      version: SAVE_VER,
      savedAt: state.lastSaveTime,
      data: Utils.deepClone(state),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      if (window.UI) UI.addLog(">> Game saved.", "gray");
    } catch (e) {
      if (window.UI) UI.addLog(">> Save failed: " + e.message, "red");
    }
  }

  // ─────────────────────────────────────────
  // 读档
  // ─────────────────────────────────────────

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      // 无存档，使用默认状态
      State.reset();
      if (window.UI) UI.addLog(">> No save found. Starting new game.", "gray");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      State.reset();
      if (window.UI) UI.addLog(">> Save data corrupted. Starting fresh.", "red");
      return;
    }

    // 版本兼容（未来扩展用，当前直接合并）
    const saved = payload.data;
    if (!saved) {
      State.reset();
      return;
    }

    // 深合并：用存档覆盖默认值，但保留新增字段的默认值
    const defaultState = State.createDefault();
    const merged = deepMerge(defaultState, saved);
    State.set(merged);

    if (window.UI) UI.addLog(">> Save loaded.", "gray");

    // 计算离线收益
    const savedAt = payload.savedAt || Date.now();
    const offlineSec = Utils.clamp((Date.now() - savedAt) / 1000, 0, OFFLINE_CAP);
    if (offlineSec >= 60 && window.Combat) {
      Combat.calcOfflineGains(offlineSec);
    }
  }

  /**
   * 简单深合并：以 base 为模板，将 override 的同名字段覆盖进去
   * 避免存档字段缺失导致报错
   */
  function deepMerge(base, override) {
    if (typeof base !== "object" || base === null) return override !== undefined ? override : base;
    if (typeof override !== "object" || override === null) return base;
    if (Array.isArray(base)) return Array.isArray(override) ? override : base;

    const result = {};
    const allKeys = new Set([...Object.keys(base), ...Object.keys(override)]);
    allKeys.forEach(k => {
      if (k in override) {
        result[k] = deepMerge(base[k], override[k]);
      } else {
        result[k] = base[k];
      }
    });
    return result;
  }

  // ─────────────────────────────────────────
  // 重置
  // ─────────────────────────────────────────

  function reset() {
    if (!confirm("Reset all progress? This cannot be undone!")) return;
    localStorage.removeItem(SAVE_KEY);
    State.reset();
    if (window.UI) {
      UI.addLog(">> Game reset.", "red");
      UI.refresh();
      UI.refreshSidePanel();
    }
  }

  // ─────────────────────────────────────────
  // 导出存档（文本）
  // ─────────────────────────────────────────

  function exportSave() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { UI.addLog(">> No save to export.", "gray"); return; }
    const encoded = btoa(raw);
    // 在控制台输出，用户可自行复制
    console.log("=== SAVE DATA ===");
    console.log(encoded);
    UI.addLog(">> Save exported to console (F12).", "gray");
  }

  return { save, load, reset, exportSave };
})();

window.Save = Save;
