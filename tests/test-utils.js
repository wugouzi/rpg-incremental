// test-utils.js — Utils 模块测试

describe("Utils.formatNum", () => {
  it("小于1000 返回整数字符串", () => {
    assert.equal(Utils.formatNum(0),   "0");
    assert.equal(Utils.formatNum(1),   "1");
    assert.equal(Utils.formatNum(999), "999");
  });

  it("1000-9999 返回 xK 格式", () => {
    assert.equal(Utils.formatNum(1000),  "1K");
    assert.equal(Utils.formatNum(1200),  "1.2K");
    assert.equal(Utils.formatNum(1500),  "1.5K");
    assert.equal(Utils.formatNum(9900),  "9.9K");
  });

  it("百万级返回 xM 格式", () => {
    assert.equal(Utils.formatNum(1000000), "1M");
    assert.equal(Utils.formatNum(2500000), "2.5M");
  });

  it("十亿级返回 xB 格式", () => {
    assert.equal(Utils.formatNum(1e9), "1B");
    assert.equal(Utils.formatNum(3.3e9), "3.3B");
  });

  it("万亿级返回 xT 格式", () => {
    assert.equal(Utils.formatNum(1e12), "1T");
    assert.equal(Utils.formatNum(5.5e12), "5.5T");
  });

  it("NaN 返回 '0'", () => {
    assert.equal(Utils.formatNum(NaN), "0");
    assert.equal(Utils.formatNum("abc"), "0");
  });

  it("小数截断", () => {
    assert.equal(Utils.formatNum(999.9), "999");
  });
});

describe("Utils.formatBar", () => {
  it("满血返回全#", () => {
    assert.equal(Utils.formatBar(100, 100, 10), "[##########]");
  });

  it("空血返回全-", () => {
    assert.equal(Utils.formatBar(0, 100, 10), "[----------]");
  });

  it("50%返回一半#", () => {
    assert.equal(Utils.formatBar(50, 100, 10), "[#####-----]");
  });

  it("70%四舍五入", () => {
    assert.equal(Utils.formatBar(70, 100, 10), "[#######---]");
  });

  it("超过max时钳制到满", () => {
    assert.equal(Utils.formatBar(200, 100, 10), "[##########]");
  });

  it("max为0时返回全-（防除零）", () => {
    assert.equal(Utils.formatBar(0, 0, 10), "[----------]");
  });

  it("默认宽度10", () => {
    const bar = Utils.formatBar(50, 100);
    assert.equal(bar.length, 12); // "[" + 10 chars + "]"
  });

  it("自定义宽度", () => {
    assert.equal(Utils.formatBar(1, 2, 4), "[##--]");
  });
});

describe("Utils.rand", () => {
  it("返回值在 [min, max] 范围内", () => {
    for (let i = 0; i < 100; i++) {
      const v = Utils.rand(5, 10);
      assert.between(v, 5, 10, "rand 超出范围");
    }
  });

  it("返回整数", () => {
    for (let i = 0; i < 20; i++) {
      const v = Utils.rand(0, 100);
      assert.equal(v, Math.floor(v), "rand 应返回整数");
    }
  });

  it("min === max 时总返回 min", () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(Utils.rand(7, 7), 7);
    }
  });
});

describe("Utils.randFloat", () => {
  it("返回值在 [min, max) 范围内", () => {
    for (let i = 0; i < 50; i++) {
      const v = Utils.randFloat(1.0, 2.0);
      assert.ok(v >= 1.0 && v < 2.0, "randFloat 超出范围");
    }
  });
});

describe("Utils.chance", () => {
  it("概率 1.0 总返回 true", () => {
    for (let i = 0; i < 20; i++) {
      assert.ok(Utils.chance(1.0));
    }
  });

  it("概率 0.0 总返回 false", () => {
    for (let i = 0; i < 20; i++) {
      assert.notOk(Utils.chance(0.0));
    }
  });

  it("大量采样时 50% 概率大约命中一半", () => {
    let hits = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      if (Utils.chance(0.5)) hits++;
    }
    // 允许 5% 误差
    assert.between(hits / N, 0.45, 0.55, "chance(0.5) 偏差过大");
  });
});

describe("Utils.clamp", () => {
  it("在范围内原样返回", () => {
    assert.equal(Utils.clamp(5, 0, 10), 5);
  });

  it("低于 min 钳制到 min", () => {
    assert.equal(Utils.clamp(-5, 0, 10), 0);
  });

  it("高于 max 钳制到 max", () => {
    assert.equal(Utils.clamp(20, 0, 10), 10);
  });

  it("边界值原样返回", () => {
    assert.equal(Utils.clamp(0, 0, 10), 0);
    assert.equal(Utils.clamp(10, 0, 10), 10);
  });
});

describe("Utils.deepClone", () => {
  it("克隆对象与原对象不同引用", () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = Utils.deepClone(obj);
    assert.notEqual(clone, obj);
    assert.notEqual(clone.b, obj.b);
  });

  it("克隆内容相等", () => {
    const obj = { a: 1, b: [1, 2, 3], c: { d: true } };
    const clone = Utils.deepClone(obj);
    assert.deepEqual(clone, obj);
  });

  it("修改克隆不影响原对象", () => {
    const obj = { a: { b: 42 } };
    const clone = Utils.deepClone(obj);
    clone.a.b = 99;
    assert.equal(obj.a.b, 42);
  });

  it("克隆数组", () => {
    const arr = [1, 2, { x: 3 }];
    const clone = Utils.deepClone(arr);
    assert.deepEqual(clone, arr);
    assert.notEqual(clone[2], arr[2]);
  });
});

describe("Utils.roundTo", () => {
  it("整数四舍五入", () => {
    assert.equal(Utils.roundTo(1.5), 2);
    assert.equal(Utils.roundTo(1.4), 1);
  });

  it("保留两位小数", () => {
    assert.equal(Utils.roundTo(1.2345, 2), 1.23);
    assert.equal(Utils.roundTo(1.235, 2), 1.24);
  });

  it("decimals=0 等同于 Math.round", () => {
    assert.equal(Utils.roundTo(2.5, 0), 3);
  });
});
