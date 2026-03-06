# ui.js — DOM 渲染与事件绑定

## 职责
所有 DOM 操作集中在此模块，其他模块不直接操作 DOM。
全局挂载 `window.UI`。

## 页面区块划分（对应 HTML id）
```
#header         标题栏：游戏名、[Save] [Load] [Prestige]
#hero-panel     左侧：角色属性面板
#combat-panel   中间：战斗区域 + 战斗日志
#side-panel     右侧：当前选中的功能面板
#tab-bar        底部标签栏：[Stats] [Inventory] [Shop] [Skills] [Zones]
```

## 主要渲染函数

### UI.renderHero()
更新左侧角色面板：
- 名称、职业、等级
- HP/MP 进度条（ASCII `[####------]`）
- ATK / DEF / SPD / CRIT
- EXP 进度条
- Gold / Gems

### UI.renderCombat()
更新中间战斗区域：
- 当前区域名
- 怪物名 + HP 进度条（若无怪物则显示 "-- idle --"）
- [ATTACK] 按钮（手动攻击）
- [AUTO: OFF/ON] 切换按钮

### UI.addLog(message, color)
向战斗日志追加一行，颜色可选（green/red/yellow/cyan/white/gray）：
- 最多保留 100 条，超出时移除最旧的
- 自动滚动到底部

### UI.renderStats()
在 side-panel 渲染 Stats 面板：
- 完整属性（含派生属性，标注装备加成）
- 转生信息
- 统计数据（总击杀、总伤害等）

### UI.renderInventory()
渲染背包面板：
- 每行一件物品，显示名称、品质颜色、属性加成
- [Equip] [Sell] 按钮
- 已装备栏（6 个槽位）：显示当前装备，[Unequip] 按钮

### UI.renderShop()
渲染商店面板：
- 当前区域可购买的物品列表
- 每行：物品名（品质色）+ 属性 + 价格 + [Buy] 按钮
- 金币不足时 [Buy] 显示为灰色不可点

### UI.renderSkills()
渲染技能树面板：
- 按职业分组（通用 / 战士 / 法师 / 游侠）
- 每个技能：名称 + 描述 + 解锁条件 + [Unlock] 按钮
- 已解锁显示 [LEARNED]，未满足条件显示为灰色

### UI.renderZones()
渲染区域选择面板：
- 每个区域一行：名称 + 状态（BOSS SLAIN / ACTIVE / LOCKED）
- [Enter] 按钮切换当前区域

### UI.renderAchievements()
渲染成就面板（[ACHIEVE] 标签）：
- 顶部进度摘要：`Achievements: N / 22`
- 每行一个成就：图标 + 名称 + 描述 + 奖励
- 已解锁：高亮颜色（金色），显示解锁时间
- 未解锁：灰色，显示条件文字
- 按分类分组，各组有小标题

### UI.renderGemShop()
渲染宝石商店面板（[GEMS] 标签）：
- 展示当前拥有宝石数
- **永久升级区**：每行显示图标 + 名称 + 当前等级 + 效果 + 费用 + [BUY] 按钮
  - 已达 maxLevel 显示 `[MAX]`
  - 宝石不足显示灰色禁用
- **特殊解锁区**：一次性购买，已解锁显示 `[OWNED]`

### UI.renderBlackMarket()
渲染黑市面板（[MARKET] 标签）：
- 顶部倒计时：`Refreshes in: M:SS`
- 4 件商品格，每格显示：
  - 商品名称（神秘装备显示预生成物品名和品质颜色）
  - 描述（Buff 显示效果+时长，装备显示属性）
  - 价格 + [BUY] 按钮
  - 已购格显示 `-- SOLD --`（灰色）
- **活跃 Buff 区**（若存在）：列出当前已激活的 Buff 名称 + 进度条（剩余时间）

### UI.renderDailyQuest()
渲染每日任务面板（[QUESTS] 标签）：
- 顶部标题 + 今日日期
- 3 个任务格，每格显示：
  - 任务名称 + 描述
  - 进度条：`[████------] X / Y`
  - 奖励预览（gold + gem）
  - 状态标签：`[COMPLETE]`（已完成）/ `[CLAIMED]`（已领取）
- 底部"今日数据"摘要：今日击杀、精英击杀、伤害、金币等

### UI.renderInventory()（v0.13 重构）
渲染背包面板（[INV] 标签），新增以下功能：
- **品质排序按钮** `[SORT]`：按 Legendary > Epic > Rare > Common 排序背包物品
- **品质统计摘要**：`Legendary:1 Epic:2 Rare:3 Common:5`
- **批量出售按钮** `[SELL ALL COMMON]`：一键出售所有 Common 品质装备
- **材料展示区**：若 `state.materials` 非空，在背包下方列出收集到的素材及数量
- 每件物品显示：名称（品质颜色）+ 主属性 + [EQUIP] [SELL] 按钮

### UI.renderHero()（v0.13 更新）
更新内容新增：
- **连胜数（STREAK）**：显示 `Streak: N 🔥`（仅 N > 0 时显示）
- **成就进度**：显示 `Achv: N/22`，点击跳转到成就面板

## 标签切换
`UI.switchTab(tabName)`:
- 切换 side-panel 内容
- 更新标签栏选中状态（反色高亮）
- 支持的 tabName：`stats` / `inventory` / `shop` / `skills` / `zones` / `achieve` / `gems` / `market` / `quests`

## 事件委托（`onSidePanelClick`）
所有 side-panel 内的按钮点击通过事件委托处理，通过 `data-action` 和 `data-*` 属性识别：

| data-action | 说明 |
|-------------|------|
| equip | 装备背包物品（data-idx）|
| sell | 出售单件物品（data-idx）|
| sellBulk | 批量出售（data-rarity 指定品质）|
| sortInventory | 按品质排序背包 |
| buyShop | 购买商店物品（data-id）|
| unlockSkill | 解锁技能（data-id）|
| enterZone | 进入区域（data-id）|
| buyUpgrade | 购买宝石升级（data-id）|
| buySpecialUnlock | 购买宝石特殊解锁（data-id）|
| buyMarket | 购买黑市商品（data-idx）|

## 全局刷新
`UI.refresh()` — 每次游戏 tick 结束后调用，更新 hero-panel 和 combat-panel。
side-panel 仅在切换标签或触发操作后刷新（`UI.markSidePanelDirty()` 标脏，下次 tick 重绘）。

## 按钮样式规范
所有可点击元素使用 `<span class="btn">` 或 `<button class="btn">`：
- 默认：绿色文字，无背景
- hover：背景绿色，文字黑色（反色）
- disabled：灰色，pointer-events: none
