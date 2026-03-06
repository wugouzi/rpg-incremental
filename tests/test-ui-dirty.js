// test-ui-dirty.js — 侧面板脏标记 + hover 保护逻辑测试
// 直接在测试环境中复现 refreshSidePanelIfDirty / _sidePanelHovered 机制，
// 验证"鼠标在面板内时不重建、离开后补刷"的行为正确性。

describe("侧面板 Dirty Flag — 基础行为", () => {
  // 用一个最小化的模拟器重现 ui.js 中的脏标记机制
  function makePanelController() {
    let dirty    = false;
    let hovered  = false;
    let rebuildCount = 0;

    function markDirty() { dirty = true; }

    function rebuild() {
      dirty = false;
      rebuildCount++;
    }

    function refreshIfDirty() {
      if (!dirty)   return;
      if (hovered)  return; // 鼠标在面板内，暂停
      rebuild();
    }

    function onMouseEnter() { hovered = true; }
    function onMouseLeave() {
      hovered = false;
      if (dirty) rebuild(); // 离开后补刷
    }

    return { markDirty, refreshIfDirty, onMouseEnter, onMouseLeave,
             get rebuildCount() { return rebuildCount; },
             get dirty()        { return dirty; },
             get hovered()      { return hovered; } };
  }

  it("未标脏时 refreshIfDirty 不重建", () => {
    const p = makePanelController();
    p.refreshIfDirty();
    assert.equal(p.rebuildCount, 0, "未标脏时不应重建");
  });

  it("标脏且无 hover 时 refreshIfDirty 触发重建", () => {
    const p = makePanelController();
    p.markDirty();
    p.refreshIfDirty();
    assert.equal(p.rebuildCount, 1, "标脏且无 hover 时应重建一次");
  });

  it("重建后 dirty 标志清除", () => {
    const p = makePanelController();
    p.markDirty();
    p.refreshIfDirty();
    assert.equal(p.dirty, false, "重建后 dirty 应为 false");
  });
});

describe("侧面板 Dirty Flag — hover 保护", () => {
  function makePanelController() {
    let dirty    = false;
    let hovered  = false;
    let rebuildCount = 0;

    function markDirty() { dirty = true; }
    function rebuild()   { dirty = false; rebuildCount++; }

    function refreshIfDirty() {
      if (!dirty)  return;
      if (hovered) return;
      rebuild();
    }

    function onMouseEnter() { hovered = true; }
    function onMouseLeave() {
      hovered = false;
      if (dirty) rebuild();
    }

    return { markDirty, refreshIfDirty, onMouseEnter, onMouseLeave,
             get rebuildCount() { return rebuildCount; },
             get dirty()        { return dirty; } };
  }

  it("hover 期间标脏后 refreshIfDirty 不重建", () => {
    const p = makePanelController();
    p.onMouseEnter();
    p.markDirty();
    p.refreshIfDirty();
    assert.equal(p.rebuildCount, 0, "hover 期间不应重建");
  });

  it("hover 期间多次标脏，离开后只重建一次", () => {
    const p = makePanelController();
    p.onMouseEnter();
    p.markDirty();
    p.markDirty();
    p.markDirty();
    // 多次 tick 触发 refreshIfDirty，均被阻断
    p.refreshIfDirty();
    p.refreshIfDirty();
    p.refreshIfDirty();
    assert.equal(p.rebuildCount, 0, "hover 期间 refreshIfDirty 不应触发任何重建");
    // 鼠标离开
    p.onMouseLeave();
    assert.equal(p.rebuildCount, 1, "mouseleave 后应补刷一次");
  });

  it("hover 期间标脏，离开后 dirty 被清除", () => {
    const p = makePanelController();
    p.onMouseEnter();
    p.markDirty();
    p.onMouseLeave();
    assert.equal(p.dirty, false, "mouseleave 补刷后 dirty 应为 false");
  });

  it("未标脏时 mouseleave 不触发重建", () => {
    const p = makePanelController();
    p.onMouseEnter();
    // 没有 markDirty
    p.onMouseLeave();
    assert.equal(p.rebuildCount, 0, "未标脏时 mouseleave 不应重建");
  });

  it("hover 前已标脏，hover 期间 refreshIfDirty 阻断重建", () => {
    const p = makePanelController();
    p.markDirty();            // 先标脏
    p.onMouseEnter();         // 再进入 hover
    p.refreshIfDirty();       // tick 触发，应被阻断
    assert.equal(p.rebuildCount, 0, "hover 期间应阻断重建");
    p.onMouseLeave();         // 离开后补刷
    assert.equal(p.rebuildCount, 1, "离开后应补刷");
  });

  it("不 hover 的情况下连续标脏+刷新只重建一次", () => {
    const p = makePanelController();
    p.markDirty();
    p.refreshIfDirty(); // 重建，dirty=false
    p.refreshIfDirty(); // 不再脏，不重建
    assert.equal(p.rebuildCount, 1, "不 hover 时应只重建一次");
  });

  it("离开后再进入，新的 hover 期间标脏再次被保护", () => {
    const p = makePanelController();
    // 第一轮：进入 → 标脏 → 离开 → 补刷
    p.onMouseEnter();
    p.markDirty();
    p.onMouseLeave();
    assert.equal(p.rebuildCount, 1, "第一轮离开后应重建一次");
    // 第二轮：再次进入 → 标脏 → refreshIfDirty 阻断
    p.onMouseEnter();
    p.markDirty();
    p.refreshIfDirty();
    assert.equal(p.rebuildCount, 1, "第二轮 hover 期间不应额外重建");
    p.onMouseLeave();
    assert.equal(p.rebuildCount, 2, "第二轮离开后应再补刷一次");
  });
});
