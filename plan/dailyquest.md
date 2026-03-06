# dailyquest.js — 每日任务系统

## 职责
每天 UTC 午夜自动刷新，提供 3 个随机任务（固定 1 个登录任务 + 随机 2 个），完成后自动发放 Gold/Gems 奖励，增加玩家日常回访动力。
全局挂载 `window.DailyQuest`。

## 任务刷新逻辑

### 日期检测
- 使用 `YYYY-M-D` 字符串表示当天日期（本地时间）
- 每次调用 `init()` 或 `getQuests()` 时触发 `_refreshIfNewDay()`
- 若 `state.dailyQuests.date !== todayStr` → 执行完整刷新

### 刷新内容
1. 重置当日会话计数器（sessionKills、sessionDamage 等全部归零）
2. 从任务池中随机选 2 个（排除登录任务）+ 固定加入 1 个登录任务
3. 生成任务实例：`{ ...template, progress: 0, completed: false, rewarded: false }`
4. 登录任务 progress 初始即为 1，`completed: true`，自动静默领奖
5. 输出黄色日志提示 "New daily quests available!"

## State 存储

```js
state.dailyQuests = {
  date: "2025-1-1",           // 当前任务日期字符串
  quests: [                   // 当日 3 个任务实例
    {
      id: "daily_login",
      name: "Daily Login",
      desc: "Just log in today",
      type: "login",
      target: 1,
      reward: { gold: 50, gems: 0 },
      progress: 1,
      completed: true,
      rewarded: true,
    },
    // ... 2 more
  ],
  // 当日会话计数器（每天重置）
  sessionKills: 0,
  sessionEliteKills: 0,
  sessionDamage: 0,
  sessionGoldEarned: 0,
  sessionBossKills: 0,
  sessionRests: 0,
}
```

## 任务模板（16 个）

### 击杀类（type: "kill"）
| id | 名称 | 目标 | 奖励 |
|----|------|------|------|
| kill_10 | Monster Slayer I | 击败 10 怪 | 200g |
| kill_30 | Monster Slayer II | 击败 30 怪 | 500g |
| kill_50 | Monster Slayer III | 击败 50 怪 | 1000g + 1💎 |

### 精英怪类（type: "eliteKill"）
| id | 名称 | 目标 | 奖励 |
|----|------|------|------|
| elite_3 | Elite Hunter I | 精英怪 3 只 | 300g |
| elite_8 | Elite Hunter II | 精英怪 8 只 | 800g + 1💎 |

### 连胜类（type: "streak"，读取 `state.killStreak` 当前值）
| id | 名称 | 目标 | 奖励 |
|----|------|------|------|
| streak_5 | Kill Streak I | 连胜达 5 | 150g |
| streak_15 | Kill Streak II | 连胜达 15 | 400g |
| streak_30 | Kill Streak III | 连胜达 30 | 900g + 1💎 |

### 伤害类（type: "damage"，累计当日造成伤害）
| id | 名称 | 目标 | 奖励 |
|----|------|------|------|
| dmg_1000 | Damage Dealer I | 1,000 伤害 | 200g |
| dmg_10000 | Damage Dealer II | 10,000 伤害 | 600g |
| dmg_100000 | Damage Dealer III | 100,000 伤害 | 2000g + 1💎 |

### 金币类（type: "goldEarned"，当日从战斗获得的金币）
| id | 名称 | 目标 | 奖励 |
|----|------|------|------|
| earn_gold_500 | Gold Rush I | 500g | 100g |
| earn_gold_2000 | Gold Rush II | 2,000g | 400g |
| earn_gold_10000 | Gold Rush III | 10,000g | 1500g + 1💎 |

### Boss 类（type: "bossKill"）
| id | 名称 | 目标 | 奖励 |
|----|------|------|------|
| defeat_boss | Boss Challenger | 击败 1 个 Boss | 500g + 1💎 |

### 休息类（type: "rest"）
| id | 名称 | 目标 | 奖励 |
|----|------|------|------|
| rest_once | Take a Break | 使用 [REST] 1 次 | 100g |

### 登录类（type: "login"，固定必选）
| id | 名称 | 奖励 |
|----|------|------|
| daily_login | Daily Login | 50g（自动领取） |

## 进度更新钩子（由 combat.js / ui.js 调用）

| 函数 | 调用时机 | 更新内容 |
|------|----------|----------|
| `DailyQuest.onKill(isElite)` | 每次怪物死亡 | sessionKills++，若精英则 sessionEliteKills++ |
| `DailyQuest.onDamage(amount)` | 每次英雄造成伤害 | sessionDamage += amount |
| `DailyQuest.onGoldEarned(amount)` | 怪物掉落金币时 | sessionGoldEarned += amount |
| `DailyQuest.onBossKill()` | Boss 击败时 | sessionBossKills++ |
| `DailyQuest.onRest()` | 玩家点击 [REST] 时 | sessionRests++ |

每个 on* 函数内部调用 `_updateProgress(dq)` 重新扫描所有未完成任务。

## 自动领奖逻辑（`_claimReward`）
- 任务 progress >= target → `completed = true` → `_claimReward(quest, true)`
- 直接修改 `state.hero.gold/gems`（无需手动点击领取）
- 输出黄色日志，调用 `UI.markSidePanelDirty()`
- `rewarded` 标志防止重复领取

## 查询接口

### `DailyQuest.getQuests()`
返回当日 3 个任务实例数组（自动触发 `_refreshIfNewDay`）。

### `DailyQuest.getProgress()`
返回 `{ total: 3, completed: N, rewarded: N }`，供 UI 标签角标使用。

### `DailyQuest.getSessionStats()`
返回当日会话统计，用于 QUESTS 面板下方的"今日数据"展示：
```js
{ kills, eliteKills, damage, goldEarned, bossKills, rests }
```

## UI 展示
在 side-panel 的 [QUESTS] 标签页：
- 显示当前 3 个任务（名称 / 进度条 / 奖励 / 完成状态）
- 显示今日会话统计摘要
- 显示距离下次刷新的时间（基于 `_todayStr()` 计算）

## 全局挂载
```js
window.DailyQuest = {
  QUEST_TEMPLATES,
  init, onKill, onDamage, onGoldEarned, onBossKill, onRest,
  getQuests, getProgress, getSessionStats,
  _refreshIfNewDay, _todayStr,  // 暴露以便测试
}
```
