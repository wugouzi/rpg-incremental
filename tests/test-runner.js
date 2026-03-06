// test-runner.js — 轻量浏览器测试框架（无外部依赖）

const TestRunner = (() => {
  let _results = [];   // { suite, name, passed, error }
  let _currentSuite = "Global";
  let _passCount = 0;
  let _failCount = 0;

  // ─── 套件分组 ────────────────────────────
  function describe(suiteName, fn) {
    _currentSuite = suiteName;
    try { fn(); } catch (e) {
      console.error(`[Suite Error] ${suiteName}:`, e);
    }
    _currentSuite = "Global";
  }

  // ─── 单个测试 ────────────────────────────
  function it(testName, fn) {
    try {
      fn();
      _results.push({ suite: _currentSuite, name: testName, passed: true, error: null });
      _passCount++;
    } catch (e) {
      _results.push({ suite: _currentSuite, name: testName, passed: false, error: e.message || String(e) });
      _failCount++;
    }
  }

  // ─── 断言 ────────────────────────────────
  const assert = {
    equal(actual, expected, msg) {
      if (actual !== expected) {
        throw new Error(
          `${msg ? msg + ": " : ""}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
      }
    },
    notEqual(actual, expected, msg) {
      if (actual === expected) {
        throw new Error(`${msg ? msg + ": " : ""}Expected values to differ, both are ${JSON.stringify(actual)}`);
      }
    },
    deepEqual(actual, expected, msg) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`${msg ? msg + ": " : ""}Expected ${b}, got ${a}`);
      }
    },
    ok(value, msg) {
      if (!value) {
        throw new Error(`${msg ? msg + ": " : ""}Expected truthy, got ${JSON.stringify(value)}`);
      }
    },
    notOk(value, msg) {
      if (value) {
        throw new Error(`${msg ? msg + ": " : ""}Expected falsy, got ${JSON.stringify(value)}`);
      }
    },
    greaterThan(actual, expected, msg) {
      if (actual <= expected) {
        throw new Error(`${msg ? msg + ": " : ""}Expected ${actual} > ${expected}`);
      }
    },
    lessThan(actual, expected, msg) {
      if (actual >= expected) {
        throw new Error(`${msg ? msg + ": " : ""}Expected ${actual} < ${expected}`);
      }
    },
    between(value, min, max, msg) {
      if (value < min || value > max) {
        throw new Error(`${msg ? msg + ": " : ""}Expected ${value} to be in [${min}, ${max}]`);
      }
    },
    throws(fn, msg) {
      let threw = false;
      try { fn(); } catch (e) { threw = true; }
      if (!threw) throw new Error(`${msg ? msg + ": " : ""}Expected function to throw`);
    },
    includes(arr, item, msg) {
      const found = Array.isArray(arr)
        ? arr.includes(item)
        : String(arr).includes(item);
      if (!found) {
        throw new Error(`${msg ? msg + ": " : ""}Expected ${JSON.stringify(arr)} to include ${JSON.stringify(item)}`);
      }
    },
  };

  // ─── 渲染到 DOM ──────────────────────────
  function render() {
    const container = document.getElementById("test-output");
    if (!container) return;

    // 汇总行
    const summary = document.createElement("div");
    summary.className = "summary " + (_failCount === 0 ? "all-pass" : "has-fail");
    summary.textContent =
      `Total: ${_results.length}  |  PASS: ${_passCount}  |  FAIL: ${_failCount}`;
    container.appendChild(summary);

    // 按 suite 分组渲染
    const suites = {};
    _results.forEach(r => {
      if (!suites[r.suite]) suites[r.suite] = [];
      suites[r.suite].push(r);
    });

    Object.entries(suites).forEach(([suite, tests]) => {
      const suiteEl = document.createElement("div");
      suiteEl.className = "suite";

      const suitePass = tests.filter(t => t.passed).length;
      const suiteFail = tests.length - suitePass;
      const suiteHeader = document.createElement("div");
      suiteHeader.className = "suite-header " + (suiteFail === 0 ? "pass" : "fail");
      suiteHeader.textContent = `▶ ${suite}  (${suitePass}/${tests.length})`;
      suiteEl.appendChild(suiteHeader);

      tests.forEach(t => {
        const row = document.createElement("div");
        row.className = "test-row " + (t.passed ? "pass" : "fail");
        row.innerHTML = t.passed
          ? `  <span class="icon">✓</span> ${t.name}`
          : `  <span class="icon">✗</span> ${t.name}<br><span class="err">    ↳ ${t.error}</span>`;
        suiteEl.appendChild(row);
      });

      container.appendChild(suiteEl);
    });
  }

  // ─── 打印到控制台 ────────────────────────
  function printConsole() {
    console.log(`\n=== TEST RESULTS: ${_passCount} passed, ${_failCount} failed ===`);
    let lastSuite = "";
    _results.forEach(r => {
      if (r.suite !== lastSuite) {
        console.log(`\n  [${r.suite}]`);
        lastSuite = r.suite;
      }
      if (r.passed) {
        console.log(`    ✓ ${r.name}`);
      } else {
        console.error(`    ✗ ${r.name}\n      ${r.error}`);
      }
    });
    console.log(`\n${"=".repeat(50)}\n`);
  }

  // ─── 运行所有测试并输出 ──────────────────
  function run() {
    // 挂载原始结果供 Node 运行器读取
    if (typeof window !== "undefined") {
      window.__testRawResults = _results;
    }
    render();
    printConsole();
    return { pass: _passCount, fail: _failCount, total: _results.length };
  }

  return { describe, it, assert, run };
})();

window.TestRunner = TestRunner;
// 便捷别名
window.describe = TestRunner.describe;
window.it       = TestRunner.it;
window.assert   = TestRunner.assert;
