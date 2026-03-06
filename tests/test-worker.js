// test-worker.js — 在独立 Worker 线程中运行一批测试文件
// 每个 Worker 拥有独立的 jsdom 实例，互不干扰

const { workerData, parentPort } = require("worker_threads");
const { JSDOM } = require("jsdom");
const fs   = require("fs");
const path = require("path");

const ROOT  = path.resolve(__dirname, "..");
const TESTS = __dirname;

function read(p) { return fs.readFileSync(p, "utf8"); }

// ── 构建独立 jsdom 实例 ──────────────────────────────────
const dom = new JSDOM(
  '<!DOCTYPE html><html><body>' +
  '<div id="btn-auto"></div>' +
  '<div id="combat-log"></div>' +
  '</body></html>',
  { url: "http://localhost", runScripts: "dangerously", resources: "usable" }
);
const { window } = dom;
const { document } = window;
window.confirm = () => true;

function injectFile(filePath) {
  const script = document.createElement("script");
  script.textContent = read(filePath);
  document.body.appendChild(script);
}

// ── 注入 UI stub（让 combat.js 裸调用的 UI.addLog 不报错）─
function injectStub(code) {
  const script = document.createElement("script");
  script.textContent = code;
  document.body.appendChild(script);
}
injectStub(`
  window.UI = {
    addLog: function() {},
    markSidePanelDirty: function() {},
    renderHero: function() {},
    renderMonster: function() {},
    refreshSidePanel: function() {},
    refreshSidePanelIfDirty: function() {},
    refresh: function() {},
  };
`);

// ── 注入游戏模块 ─────────────────────────────────────────
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
  "../js/achievements.js",
  "../js/gemshop.js",
  "../js/dailyquest.js",
];
gameModules.forEach(rel => injectFile(path.join(TESTS, rel)));

// ── 注入测试框架 ─────────────────────────────────────────
injectFile(path.join(TESTS, "test-runner.js"));

// ── 注入本批次测试文件 ────────────────────────────────────
const { testFiles } = workerData;
testFiles.forEach(f => injectFile(path.join(TESTS, f)));

// ── 收集结果并回传主进程 ──────────────────────────────────
const TR = window.TestRunner;
TR.run();   // 触发 render/printConsole（输出会被静默，主进程不打印 Worker 的 stdout）

const raw = window.__testRawResults || [];
parentPort.postMessage({ raw });
