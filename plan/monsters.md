# monsters.js — 怪物定义

## 职责
定义所有怪物的模板数据，提供按区域随机生成怪物实例的函数。
全局挂载 `window.Monsters`。

## 怪物模板结构
```js
{
  id: "slime",
  name: "Slime",
  zone: "plains",
  isBoss: false,
  baseHp: 20,
  baseAtk: 3,
  baseDef: 0,
  expReward: 10,
  goldReward: { min: 2, max: 5 },
  dropTable: [
    { itemId: "leather", chance: 0.3 },
    { itemId: "wood", chance: 0.2 },
  ]
}
```

## 区域怪物列表（初步）

### plains（新手草原）
- Slime：弱，新手练习
- Wild Boar：略强
- Plains Boss: Giant Slime King（精英）

### forest（幽暗森林）
- Werewolf
- Wood Spirit
- Forest Boss: Ancient Treant

### cave（骷髅洞窟）
- Skeleton Warrior
- Undead Mage
- Cave Boss: Lich

### desert（焦土沙漠）
- Scorpion
- Desert Bandit
- Desert Boss: Sand Wyrm

### castle（魔王城堡）
- Elite Guard
- Dark Knight
- Final Boss: Dark Lord（触发转生）

## 实例生成函数
`Monsters.spawn(zoneId)`:
- 按权重随机选取该区域的普通怪物
- 根据玩家等级对怪物属性做 ±10% 随机浮动
- 返回包含 `currentHp` 字段的实例对象

`Monsters.spawnBoss(zoneId)`:
- 返回该区域 Boss 实例（HP/ATK * 5 倍）
