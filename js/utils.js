// utils.js — 工具函数集合，不依赖任何其他模块

const Utils = (() => {
  /**
   * 大数格式化：1234 -> "1.2K", 1200000 -> "1.2M" 等
   */
  function formatNum(n) {
    n = Number(n);
    if (isNaN(n)) return "0";
    if (n >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, "") + "T";
    if (n >= 1e9)  return (n / 1e9).toFixed(1).replace(/\.0$/, "")  + "B";
    if (n >= 1e6)  return (n / 1e6).toFixed(1).replace(/\.0$/, "")  + "M";
    if (n >= 1e3)  return (n / 1e3).toFixed(1).replace(/\.0$/, "")  + "K";
    return Math.floor(n).toString();
  }

  /**
   * ASCII 进度条：formatBar(70, 100, 10) -> "[#######---]"
   */
  function formatBar(current, max, width) {
    width = width || 10;
    if (max <= 0) return "[" + "-".repeat(width) + "]";
    const filled = Math.round(Math.min(current / max, 1) * width);
    const empty = width - filled;
    return "[" + "#".repeat(filled) + "-".repeat(empty) + "]";
  }

  /**
   * 随机整数 [min, max]（含两端）
   */
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 随机浮点数 [min, max)
   */
  function randFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * 概率触发：probability 为 0~1，返回 bool
   */
  function chance(probability) {
    return Math.random() < probability;
  }

  /**
   * 限制 value 在 [min, max] 范围内
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * JSON 深拷贝（用于存读档）
   */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 将数字按比例四舍五入到整数
   */
  function roundTo(n, decimals) {
    const factor = Math.pow(10, decimals || 0);
    return Math.round(n * factor) / factor;
  }

  return { formatNum, formatBar, rand, randFloat, chance, clamp, deepClone, roundTo };
})();

window.Utils = Utils;
