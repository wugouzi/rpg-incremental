# prestige.js — 转生系统

## 职责
处理转生（Prestige）的条件判断、重置逻辑与永久加成计算。
全局挂载 `window.Prestige`。

## 转生条件
- 已击败 Final Boss（castle 区域 Boss）
- `State.hero.prestigeCount` 记录转生次数

## 转生流程（Prestige.doPrestige）
1. 弹出确认提示（UI 层 confirm 框）
2. 计算本次获得的宝石数量：
   - gems = 1 + floor(prestigeCount / 2)（每两次转生多给 1 颗）
3. 重置内容（**保留**的内容用 ✅ 标注）：
   - ❌ 等级 → 1
   - ❌ 装备（全清空）
   - ❌ 背包
   - ❌ 技能解锁（全清空，但 class 选择保留）
   - ❌ 金币 → 0
   - ❌ 区域进度（bossDefeated → false），仅保留 plains 解锁
   - ✅ prestigeCount++
   - ✅ gems += 计算所得
   - ✅ prestigeBonus *= 1.2（每次转生全局 ATK 提升 20%）
   - ✅ 统计数据 stats（累计）
4. 将新 State 存档
5. UI 显示转生动画（打字机：">>>> PRESTIGE! <<<< ..."）并刷新

## 宝石用途（预留扩展）
- 解锁特殊技能（仅 gem 消耗，不受重置影响）
- 购买永久 HP / DEF 加成

## 转生加成显示
在 Stats 面板显示：
```
Prestige: 2x
Bonus ATK multiplier: x1.44
Gems: 5
```
