#!/usr/bin/env node
// run-tests.js — Node.js 测试运行器，用 jsdom 模拟浏览器环境

const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

// ── 颜色输出 ────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  gray:   "\x1b[90m",
  white:  "\x1b[97m",
  bold:   "\x1b[1m",
};
const g  = s => C.green  + s + C.reset;
const r  = s => C.red    + s + C.reset;
const y  = s => C.yellow + s + C.reset;
const cy = s => C.cyan   + s + C.reset;
const gr = s => C.gray   + s + C.reset;
const w  = s => C.white  + s + C.reset;
const b  = s => C.bold   + s + C.reset;

// ── 路径 ────────────────────────────────────
const ROOT  = path.resolve(__dirname, "..");
const TESTS = __dirname;

function read(relPath) {
  return fs.readFileSync(relPath, "utf8");
}

// ── 构建 jsdom 实例 ─────────────────────────
const dom = new JSDOM("<!DOCTYPE html><html><body>" +
  // 提供测试中 UI.addLog 所需的最小 DOM 占位（防止报错）
  '<div id="btn-auto"></div>' +
  '<div id="combat-log"></div>' +
  "</body></html>",
  {
    url: "http://localhost",
    runScripts: "dangerously",   // 允许执行注入的脚本
    resources: "usable",
  }
);

const { window } = dom;
const { document } = window;

// Node 环境缺少 window.confirm，给个 stub（默认 true）
window.confirm = () => true;
// Node 环境 localStorage 由 jsdom 提供，直接用即可

// ── 工具：把文件内容注入到 jsdom window ─────
function injectFile(filePath) {
  const code = read(filePath);
  const script = document.createElement("script");
  script.textContent = code;
  document.body.appendChild(script);
}

// ── 注入游戏模块（顺序固定）─────────────────
console.log(b("\n▶ IDLE HERO — NODE TEST RUNNER\n"));
console.log(gr("Loading game modules..."));

const gameModules = [
  "../js/utils.js",
  "../js/state.js",
  "../js/monsters.js",
  "../js/zones.js",
  "../js/equipment.js",
  "../js/skills.js",
  "../js/combat.js",
  "../js/prestige.js",
  "../js/save.js",
  "../js/blackmarket.js",
  "../js/gemshop.js",
  "../js/dailyquest.js",
];

gameModules.forEach(rel => {
  const full = path.join(TESTS, rel);
  injectFile(full);
});

// ── 注入测试框架 ─────────────────────────────
injectFile(path.join(TESTS, "test-runner.js"));

// 把 jsdom window 上的全局暴露给 Node（让测试文件可以直接调用）
// 实际上测试文件也会被注入到 jsdom，所以不需要额外处理

// ── 注入测试文件 ─────────────────────────────
const testFiles = [
  "test-utils.js",
  "test-state.js",
  "test-monsters-zones.js",
  "test-equipment.js",
  "test-skills.js",
  "test-combat.js",
  "test-save-prestige.js",
  "test-affixes.js",
  "test-mage-spec.js",
  "test-skill-subgroups.js",
  "test-regen.js",
  "test-ui-dirty.js",
  "test-pyro-ui.js",
  "test-new-features.js",
  "test-money-sink.js",
  "test-achievements.js",
  "test-warrior-ranger-spec.js",
  "test-gemshop.js",
  "test-dailyquest.js",
];

console.log(gr("Running tests...\n"));

testFiles.forEach(f => {
  injectFile(path.join(TESTS, f));
});

// ── 从 jsdom window 取结果并打印 ────────────
const TR = window.TestRunner;
if (!TR) {
  console.error(r("ERROR: TestRunner not found in window!"));
  process.exit(1);
}

// 收集并打印
const results = window._testResults || [];

// TestRunner.run() 负责收集，手动触发
const summary = TR.run();

// 读取 jsdom 注入的 DOM 输出并转为终端输出
// 直接从 TestRunner 内部拿原始结果（通过私有挂载）
const raw = window.__testRawResults;
if (raw) {
  let lastSuite = "";
  raw.forEach(t => {
    if (t.suite !== lastSuite) {
      console.log("\n  " + cy(`[${t.suite}]`));
      lastSuite = t.suite;
    }
    if (t.passed) {
      console.log("    " + g("✓") + " " + gr(t.name));
    } else {
      console.log("    " + r("✗") + " " + w(t.name));
      console.log("      " + r("↳ " + t.error));
    }
  });
}

console.log("\n" + "=".repeat(60));
const passStr = g(`${summary.pass} passed`);
const failStr = summary.fail > 0 ? r(`${summary.fail} failed`) : g("0 failed");
const totalStr = w(`${summary.total} total`);
console.log(b(`  RESULTS: ${passStr}  ${failStr}  ${totalStr}`));
console.log("=".repeat(60) + "\n");

process.exit(summary.fail > 0 ? 1 : 0);
