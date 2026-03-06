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

## 标签切换
`UI.switchTab(tabName)`:
- 切换 side-panel 内容
- 更新标签栏选中状态（反色高亮）

## 全局刷新
`UI.refresh()` — 每次游戏 tick 结束后调用，更新 hero-panel 和 combat-panel。
side-panel 仅在切换标签或触发操作后刷新（避免频繁重绘）。

## 按钮样式规范
所有可点击元素使用 `<span class="btn">` 或 `<button class="btn">`：
- 默认：绿色文字，无背景
- hover：背景绿色，文字黑色（反色）
- disabled：灰色，pointer-events: none
