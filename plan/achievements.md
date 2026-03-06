# achievements.js — 成就系统

## 职责
检测游戏内各类里程碑条件，首次达成时解锁成就并发放 Gems 奖励。
全局挂载 `window.Achievements`。

## 数据结构

成就定义对象（只读模板）：
```js
{
  id:        "kill_100",           // 唯一 ID
  name:      "Seasoned Fighter",   // 显示名称
  desc:      "Kill 100 monsters.", // 描述
  icon:      "⚔",                  // 图标 emoji
  reward:    { gems: 1 },          // 解锁奖励（gems=0 代表无奖励）
  condition: (state) => bool,      // 条件函数，接收完整 state 返回 true/false
}
```

State 中存储已解锁记录：
```js
state.achievements = {
  "kill_100": { unlockedAt: 1700000000000 },  // 首次解锁时间戳
  // 未解锁的 id 不存在于此对象中
}
```

## 成就分类（共 22 个）

### 战斗里程碑（5 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| first_kill | First Blood | 击杀 1 只怪物 | 0 💎 |
| kill_10 | Warrior's Path | 击杀 10 只 | 0 💎 |
| kill_100 | Seasoned Fighter | 击杀 100 只 | 1 💎 |
| kill_1000 | Monster Slayer | 击杀 1,000 只 | 2 💎 |
| kill_10000 | Legendary Hunter | 击杀 10,000 只 | 5 💎 |

### 等级里程碑（3 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| reach_10 | Rising Hero | 达到 Lv.10 | 1 💎 |
| reach_25 | Veteran | 达到 Lv.25 | 2 💎 |
| reach_50 | Champion | 达到 Lv.50 | 5 💎 |

### Boss 击败（5 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| boss_plains | Slime Crusher | 击败 Giant Slime King | 1 💎 |
| boss_forest | Treant Feller | 击败 Ancient Treant | 1 💎 |
| boss_cave | Lich Bane | 击败 Lich | 2 💎 |
| boss_desert | Wyrm Slayer | 击败 Sand Wyrm | 3 💎 |
| boss_castle | Dark Lord's Bane | 击败 Dark Lord | 10 💎 |

### 金币里程碑（3 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| gold_1000 | Pocket Money | 累计获得 1,000 金币 | 0 💎 |
| gold_50000 | Merchant Prince | 累计获得 50,000 金币 | 2 💎 |
| gold_1000000 | Gold Hoarder | 累计获得 1,000,000 金币 | 5 💎 |

### 连胜成就（2 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| streak_10 | On a Roll | 历史最高连胜 ≥ 10 | 1 💎 |
| streak_50 | Unstoppable | 历史最高连胜 ≥ 50 | 3 💎 |

### 装备成就（2 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| first_legendary | Legend Born | 获得任意 Legendary 装备 | 3 💎 |
| full_gear | Fully Armed | 全部 6 个装备槽位均有装备 | 1 💎 |

### 转生成就（1 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| first_prestige | Reborn | 首次转生 | 5 💎 |

### 精英怪成就（2 个）
| id | 名称 | 条件 | 奖励 |
|----|------|------|------|
| first_elite | Elite Hunter | 击败首只精英怪 | 1 💎 |
| elite_100 | Elite Slayer | 击败 100 只精英怪 | 3 💎 |

## 核心函数

### `Achievements.check()`
在游戏关键事件后调用（怪物死亡、升级、Boss 击败等）：
1. 遍历 `ACHIEVEMENT_LIST`，跳过已在 `state.achievements` 中的 id
2. 调用 `ach.condition(state)`，返回 true 则触发解锁
3. 写入 `state.achievements[id] = { unlockedAt: Date.now() }`
4. 若 `reward.gems > 0`，执行 `state.hero.gems += reward.gems`
5. 调用 `UI.addLog()` 输出黄色成就通知
6. 返回本次新解锁的成就数组

### `Achievements.getAll()`
返回所有成就的展示数据：
```js
[
  { ...achDef, unlocked: true/false, unlockedAt: timestamp|null },
  ...
]
```

### `Achievements.getProgress()`
返回 `{ unlocked: N, total: 22 }`，用于 UI 进度摘要展示。

## 调用时机
`check()` 在以下位置被调用：
- `combat.js` → `onMonsterDeath()` 每次怪物死亡后
- `state.js` → `levelUp()` 每次升级后
- `combat.js` → `onBossDefeated()` Boss 击败后

## 与 UI 的集成
在 Stats 面板（`renderStats()`）展示成就进度摘要：
```
Achievements: 5 / 22
```
在 side-panel 的 [ACHIEVE] 标签页完整列出所有成就，已解锁高亮，未解锁显示条件文字（灰色）。

## 全局挂载
```js
window.Achievements = { ACHIEVEMENT_LIST, check, getAll, getProgress }
```
