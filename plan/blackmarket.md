# blackmarket.js — 黑市商店系统

## 职责
每 3 分钟自动刷新库存，提供 4 件随机商品（Buff 卷轴 + 神秘装备），是中后期金币的主要消耗出口之一。同时负责管理所有临时 Buff 的计时器衰减。
全局挂载 `window.BlackMarket`。

## 刷新机制

- 刷新间隔：**3 分钟**（`REFRESH_INTERVAL = 3 * 60 * 1000` ms）
- 计时器 `refreshTimer` 在每次 `tick(delta)` 中递减
- 倒计时归零时自动调用 `refresh()` 并输出日志
- `getRefreshCountdown()` 返回剩余秒数，供 UI 倒计时显示

## 库存生成规则（每次刷新随机生成 4 件）

```
[0] 随机 Buff 卷轴 #1
[1] 随机 Buff 卷轴 #2
[2] 神秘装备（weapon / armor / accessory）
[3] 50% Buff 卷轴 / 50% 神秘装备
```

购买后该格变为 `{ type: "sold", name: "-- SOLD --", cost: 0 }`，直到下次刷新。

## 商品类型

### Buff 卷轴（6 种，激活后效果持续一段时间）

| id | 名称 | 效果 | 持续时间 | 金币费用 |
|----|------|------|----------|----------|
| scroll_atk | Scroll of Power | +30% ATK | 5 min | 800+lvl×80 |
| scroll_def | Scroll of Iron Skin | +40% DEF | 5 min | 600+lvl×60 |
| scroll_haste | Scroll of Haste | +0.4 SPD | 3 min | 1000+lvl×100 |
| scroll_luck | Scroll of Fortune | +25% Gold & +20% Drop | 5 min | 700+lvl×70 |
| scroll_regen | Scroll of Restoration | +15 HPR & +8 MPR | 5 min | 500+lvl×50 |
| scroll_xp | Scroll of Insight | +50% EXP | 5 min | 600+lvl×60 |

> 费用公式：`floor(baseCost + heroLevel × perLevelMod)`

### 神秘装备（3 种，购买时随机生成 Epic/Legendary 物品）

| id | 名称 | 内容 | 金币费用 |
|----|------|------|----------|
| mystery_weapon | ??? Mysterious Weapon | 随机武器（steel_sword / desert_blade / shadow_blade / lords_sword） | 2000+lvl×200 |
| mystery_armor | ??? Mysterious Armor | 随机防具（helmet / chest / legs） | 1500+lvl×150 |
| mystery_accessory | ??? Mysterious Ring/Neck | 随机饰品 | 1800+lvl×180 |

> 神秘装备调用 `Equipment.createItem(tplId, forceRare=true, withAffixes=true)` 生成，
> 展示时已预生成实例，可在 UI 中预览实际属性。

## State 存储（临时 Buff）

Buff 效果写入 `state.buffs`，计时器到期后对应字段清零：

```js
state.buffs = {
  // ATK buff
  atkPct: 30,           // +30%（百分比）
  atkPctTimer: 300000,  // 剩余毫秒

  // DEF buff
  defPct: 0,
  defPctTimer: 0,

  // 速度 buff
  spdAdd: 0.4,          // 绝对值加成
  spdAddTimer: 180000,

  // 幸运 buff（goldPct 和 dropPct 共用同一计时器 luckTimer）
  goldPct: 25,
  dropPct: 20,
  luckTimer: 300000,

  // 回复 buff（hprAdd 和 mprAdd 共用 regenTimer）
  hprAdd: 15,
  mprAdd: 8,
  regenTimer: 300000,

  // EXP buff
  expPct: 50,
  expPctTimer: 300000,
}
```

## Buff 衰减逻辑（`_tickBuffs(delta)`）

每次游戏 tick（100ms）被 `tick(delta)` 调用：
- 遍历所有 `*Timer` 字段，减去 delta
- 若计时器 ≤ 0：清零该计时器 + 清零关联的效果字段
- 输出灰色日志 "Buff expired."

## 核心函数

### `BlackMarket.init()`
游戏启动时调用，生成第一批库存（`currentStock = _generateStock()`）。

### `BlackMarket.tick(delta)`
由 `main.js` 游戏循环每 tick 调用（delta = 实际经过毫秒数）：
1. `refreshTimer -= delta`，归零触发 `refresh()`
2. 调用 `_tickBuffs(delta)` 衰减 Buff 计时器

### `BlackMarket.refresh()`
手动或自动刷新库存：
1. `currentStock = _generateStock()`
2. `refreshTimer = REFRESH_INTERVAL`
3. 输出黄色日志，刷新面板

### `BlackMarket.buy(idx)`
购买库存中下标为 idx 的商品：
1. 检查 `state.hero.gold >= entry.cost`
2. 扣除金币
3. 若为 scroll → 调用 `entry._def.apply(state)` 写入 Buff
4. 若为 mystery → 生成物品：
   - 背包未满：放入 `state.inventory`
   - 背包已满：自动出售，退回半价
5. 将该格标记为已售

### `BlackMarket.getStock()`
返回当前 4 件商品数组（供 UI 渲染）。

### `BlackMarket.getRefreshCountdown()`
返回剩余刷新秒数（`ceil(refreshTimer / 1000)`，最小 0）。

## Buff 加成生效位置

| buff 字段 | 生效位置 |
|-----------|----------|
| atkPct | `State.getTotalAtk()` |
| defPct | `State.getTotalDef()` |
| spdAdd | `State.getTotalSpd()` |
| goldPct | `combat.js` 金币结算 |
| dropPct | `combat.js` 掉落判定 |
| hprAdd | `combat.js` tick 回血逻辑 |
| mprAdd | `combat.js` tick 回蓝逻辑 |
| expPct | `state.js` `addExp()` |

## UI 展示
在 side-panel 的 [MARKET] 标签页：
- 顶部倒计时：`Refreshes in: X:XX`
- 4 件商品格（图标 + 名称 + 描述 + 价格 + [BUY] 按钮）
- 已购格显示 `-- SOLD --`（灰色）
- 当前活跃 Buff 列表（名称 + 剩余时间进度条）

## 全局挂载
```js
window.BlackMarket = {
  init, tick, refresh, buy,
  getStock, getRefreshCountdown,
  BUFF_SCROLLS, MYSTERY_ITEMS,
}
```
