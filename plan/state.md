# state.js — 游戏状态

## 职责
维护唯一的全局游戏状态对象 `window.State`，是所有模块读写数据的唯一来源。

## 数据结构

```js
State = {
  // 角色基础
  hero: {
    name: "Hero",
    class: null,          // null | "warrior" | "mage" | "ranger"
    level: 1,
    exp: 0,
    expToNext: 100,       // 升级所需经验（随等级增长）

    // 基础属性（裸装）
    baseAtk: 5,
    baseDef: 2,
    baseMaxHp: 50,
    baseMaxMp: 20,
    baseSpd: 1.0,         // 攻击间隔系数，越高越快
    baseCrit: 0.05,       // 暴击率 5%

    // 当前 HP/MP
    hp: 50,
    mp: 20,

    // 金币与宝石
    gold: 0,
    gems: 0,

    // 转生次数
    prestigeCount: 0,
    prestigeBonus: 1.0,   // 每次转生叠加的全局攻击倍率
  },

  // 装备槽（每槽存 item 对象或 null）
  equipment: {
    weapon: null,
    helmet: null,
    chest: null,
    legs: null,
    ring: null,
    neck: null,
  },

  // 背包（存放掉落但未装备的物品）
  inventory: [],          // Item[]，最多 20 格

  // 当前区域 & 怪物
  currentZone: "plains",
  currentMonster: null,   // 当前交战的怪物实例（含当前HP）
  autoFight: false,       // 是否开启自动战斗

  // 已解锁区域列表
  unlockedZones: ["plains"],

  // 技能解锁状态  { skillId: true/false }
  unlockedSkills: {},

  // 统计数据（用于里程碑）
  stats: {
    totalKills: 0,
    totalDmgDealt: 0,
    totalGoldEarned: 0,
    bossesDefeated: 0,
  },

  // 存档时间戳（用于离线收益计算）
  lastSaveTime: Date.now(),
}
```

## 派生属性计算（getTotalAtk / getTotalDef / ...）
不存在 state 中，通过函数实时计算：
- `State.getTotalAtk()` = baseAtk + 装备加成 + 技能加成 + 转生加成
- `State.getTotalDef()` = baseDef + 装备加成
- `State.getTotalMaxHp()` = baseMaxHp + 装备加成
- `State.getAtkInterval()` = Math.max(200, 1000 / baseSpd)  (ms)

## 升级逻辑
`State.addExp(amount)`:
1. hero.exp += amount
2. while exp >= expToNext → 触发 levelUp()
3. levelUp(): level++, 提升 baseAtk/baseDef/baseMaxHp, 重新计算 expToNext = floor(100 * 1.15^level)
