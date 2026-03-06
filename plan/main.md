# main.js — 入口与游戏主循环

## 职责
游戏启动入口，协调所有模块初始化，驱动主循环。
全局挂载 `window.Game`。

## 初始化顺序（DOMContentLoaded）
1. Save.load() — 读取存档（或初始化默认 State）
2. UI.init() — 绑定所有 DOM 事件监听器
3. UI.refresh() — 首次渲染
4. Game.startLoop() — 启动主循环

## 主循环（setInterval 100ms）
```
Game.tick():
  delta = 当前时间 - lastTickTime
  lastTickTime = 当前时间

  if (State.currentMonster && State.hero.hp > 0):
    Combat.tick(delta)   // 累积攻击计时

  // 每 30s 自动存档（由独立 setInterval 处理）

  UI.refresh()           // 刷新 hero-panel + combat-panel
```

## 战斗计时（在 Combat 模块内独立维护）
- `heroAtkTimer`: 累积 delta，超过 getAtkInterval() 则触发 heroAttack，重置
- `monsterAtkTimer`: 同理

## 事件绑定（UI.init 内完成）
- [Save] → Save.save()
- [Load] → Save.load(); UI.refresh()
- [Prestige] → Prestige.doPrestige()
- [ATTACK] → Combat.manualAttack()
- [AUTO] → Combat.toggleAutoFight()
- [Stats/Inventory/Shop/Skills/Zones] → UI.switchTab(name)
- 动态按钮（Buy/Equip/Sell/Unlock/Enter）→ 事件委托绑定在 #side-panel 上

## 脚本加载顺序（index.html 中）
```html
<script src="js/utils.js"></script>
<script src="js/state.js"></script>
<script src="js/monsters.js"></script>
<script src="js/zones.js"></script>
<script src="js/equipment.js"></script>
<script src="js/skills.js"></script>
<script src="js/combat.js"></script>
<script src="js/prestige.js"></script>
<script src="js/save.js"></script>
<script src="js/ui.js"></script>
<script src="js/main.js"></script>
```
