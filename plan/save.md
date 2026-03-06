# save.js — 存读档

## 职责
将 State 序列化为 JSON 存入 localStorage，以及从 localStorage 反序列化恢复 State。
全局挂载 `window.Save`。

## 存档键名
`localStorage` key: `"idle_hero_save"`

## 存档内容
序列化整个 `State` 对象（通过 `JSON.stringify`），排除运行时计时器引用。

## 存档结构
```json
{
  "version": "0.1",
  "savedAt": 1700000000000,
  "hero": { ... },
  "equipment": { ... },
  "inventory": [ ... ],
  "currentZone": "plains",
  "autoFight": false,
  "unlockedZones": ["plains"],
  "unlockedSkills": {},
  "stats": { ... }
}
```

## 核心函数

### Save.save()
1. 将 State.lastSaveTime = Date.now()
2. 序列化 State → JSON
3. localStorage.setItem("idle_hero_save", json)
4. UI 提示 "Saved."

### Save.load()
1. 读取 localStorage.getItem("idle_hero_save")
2. 若不存在 → 使用初始 State
3. 版本校验（version 不同时做迁移或提示）
4. 将 JSON 合并回 State（用 Object.assign 深合并）
5. 计算离线收益：offlineSeconds = (Date.now() - savedAt) / 1000，上限 8h
6. 调用 Combat.calcOfflineGains(offlineSeconds)

### Save.reset()
1. localStorage.removeItem("idle_hero_save")
2. 重新初始化 State 为默认值
3. 刷新页面

## 自动存档
在 main.js 中：`setInterval(Save.save, 30000)`（每 30s 自动存档）

## 离线收益计算（在 Save.load 中调用）
- 假设玩家一直在当前区域自动战斗
- 每次战斗平均时长 = avgMonsterHp / heroAtk * atkInterval
- offlineKills = offlineSeconds / avgFightDuration
- 批量结算 EXP & Gold（不触发单条战斗日志，只显示汇总）
