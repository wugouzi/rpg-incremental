#!/usr/bin/env node
// run-tests.js — Node.js 并行测试运行器（worker_threads + jsdom）
//
// 每组测试文件在独立 Worker 线程中运行，互不共享全局状态。
// 最后汇总所有结果并在主进程统一打印，退出码反映是否有失败。

const { Worker } = require("worker_threads");
const path = require("path");

// ── 颜色输出 ─────────────────────────────────────────────
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
const cy = s => C.cyan   + s + C.reset;
const gr = s => C.gray   + s + C.reset;
const w  = s => C.white  + s + C.reset;
const b  = s => C.bold   + s + C.reset;

const TESTS = __dirname;
const WORKER = path.join(TESTS, "test-worker.js");

// ── 测试文件分组（每组跑在一个 Worker 里）───────────────
//
// 分组原则：尽量均分测试数量，让每个 Worker 负载均衡。
// jsdom 初始化开销较大，组数越少总耗时越短；
// 实测 3 组是在并行收益与 Worker 启动开销之间的最佳点。
const GROUPS = [
  // 组 0: 基础 + 技能 + 装备 + 存档
  [
    "test-utils.js",
    "test-state.js",
    "test-monsters-zones.js",
    "test-equipment.js",
    "test-affixes.js",
    "test-skills.js",
    "test-skill-subgroups.js",
    "test-save-prestige.js",
    "test-achievements.js",
  ],
  // 组 1: 战斗 + 法师 + UI + 新特性
  [
    "test-combat.js",
    "test-mage-spec.js",
    "test-regen.js",
    "test-ui-dirty.js",
    "test-pyro-ui.js",
    "test-new-features.js",
  ],
  // 组 2: 战士/游侠 + 金币 + 商店 + 任务（最重的部分）
  [
    "test-warrior-ranger-spec.js",
    "test-warrior-ranger-combat.js",
    "test-money-sink.js",
    "test-gemshop.js",
    "test-dailyquest.js",
  ],
];

// ── 启动一个 Worker ──────────────────────────────────────
function runGroup(groupIndex, testFiles) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER, { workerData: { testFiles } });
    worker.on("message", msg => resolve({ groupIndex, testFiles, raw: msg.raw }));
    worker.on("error",   err => reject(err));
    worker.on("exit",    code => {
      if (code !== 0) reject(new Error(`Worker ${groupIndex} exited with code ${code}`));
    });
  });
}

// ── 主流程 ───────────────────────────────────────────────
(async () => {
  const startTime = Date.now();
  console.log(b("\n▶ IDLE HERO — PARALLEL TEST RUNNER\n"));
  console.log(gr(`Spawning ${GROUPS.length} workers in parallel...\n`));

  let allResults;
  try {
    // 所有 Worker 同时启动
    allResults = await Promise.all(
      GROUPS.map((files, idx) => runGroup(idx, files))
    );
  } catch (err) {
    console.error(r("Worker error: " + err.message));
    process.exit(1);
  }

  // 按组序号排序（保证输出顺序稳定）
  allResults.sort((a, b) => a.groupIndex - b.groupIndex);

  // ── 打印结果 ──────────────────────────────────────────
  let totalPass = 0;
  let totalFail = 0;

  allResults.forEach(({ testFiles: files, raw }) => {
    let lastSuite = "";
    raw.forEach(t => {
      if (t.suite !== lastSuite) {
        console.log("\n  " + cy(`[${t.suite}]`));
        lastSuite = t.suite;
      }
      if (t.passed) {
        console.log("    " + g("✓") + " " + gr(t.name));
        totalPass++;
      } else {
        console.log("    " + r("✗") + " " + w(t.name));
        console.log("      " + r("↳ " + t.error));
        totalFail++;
      }
    });
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  const passStr  = g(`${totalPass} passed`);
  const failStr  = totalFail > 0 ? r(`${totalFail} failed`) : g("0 failed");
  const totalStr = w(`${totalPass + totalFail} total`);
  const timeStr  = gr(`(${elapsed}s)`);
  console.log(b(`  RESULTS: ${passStr}  ${failStr}  ${totalStr}  ${timeStr}`));
  console.log("=".repeat(60) + "\n");

  process.exit(totalFail > 0 ? 1 : 0);
})();
