# zones.js — 区域定义

## 职责
定义所有区域的元数据与解锁条件。全局挂载 `window.Zones`。

## 区域数据结构
```js
{
  id: "plains",
  name: "Verdant Plains",
  unlockCondition: null,   // null 表示初始解锁
  bossDefeated: false,     // 击败 Boss 后置 true，用于解锁下一区域
  description: "A peaceful grassland. Good for beginners.",
}
```

## 区域列表
| id | 名称 | 解锁条件 |
|----|------|---------|
| plains | Verdant Plains | 初始 |
| forest | Dark Forest | plains Boss 击败 |
| cave | Skull Cave | forest Boss 击败 |
| desert | Scorched Desert | cave Boss 击败 |
| castle | Dark Lord's Castle | desert Boss 击败 |

## 核心函数
`Zones.getUnlocked()` — 返回当前已解锁的区域列表
`Zones.unlockNext(currentZoneId)` — 解锁下一区域并写入 State
`Zones.getZone(id)` — 返回区域元数据
