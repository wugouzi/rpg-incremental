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

  // 统计数据（用于里程碑 & 成就检测）
  stats: {
    totalKills: 0,
    totalDmgDealt: 0,
    totalGoldEarned: 0,
    bossesDefeated: 0,
    eliteKills: 0,         // 精英怪击杀总数（v0.13+）
    maxKillStreak: 0,      // 历史最高连胜数（v0.13+）
    deaths: 0,             // 死亡总次数（v0.13+）
  },

  // 当前连胜计数（非历史最高，死亡时归零）
  killStreak: 0,           // v0.13+

  // 材料仓库（收集的素材，key = itemId，value = 数量）
  materials: {
    // "wolf_fang": 5,
    // "iron_ore": 12,
    // ...
  },                       // v0.13+

  // 成就解锁记录  { achievementId: { unlockedAt: timestamp } }
  achievements: {},        // v0.13+

  // Boss 击败记录  { zoneId: true }
  bossDefeated: {
    plains: false,
    forest: false,
    cave:   false,
    desert: false,
    castle: false,
  },

  // 宝石商店升级状态（v0.12+）
  gemUpgrades: {
    atkPct: 0, hpPct: 0, defPct: 0,
    goldPct: 0, expPct: 0,
    critAdd: 0, dropPct: 0,
    invExpand: 0, offlineHours: 0,
    prestigeAtkBonus: 0,
  },
  gemUpgradeLevels: {},    // { upgradeId: currentLevel }
  gemUnlocks: {},          // { autoPrestigeAlert, secondChance, eliteLoot, crafting, ... }

  // 临时 Buff（由黑市卷轴写入，BlackMarket.tick 负责衰减）
  buffs: {},               // { atkPct, atkPctTimer, defPct, ... }

  // 每日任务（DailyQuest 模块管理）
  dailyQuests: {
    date: "",
    quests: [],
    sessionKills: 0,
    sessionEliteKills: 0,
    sessionDamage: 0,
    sessionGoldEarned: 0,
    sessionBossKills: 0,
    sessionRests: 0,
  },

  // 存档时间戳（用于离线收益计算）
  lastSaveTime: Date.now(),
}
```

## 派生属性计算（getTotalAtk / getTotalDef / ...）
不存在 state 中，通过函数实时计算（依次叠加：基础值 → 装备加成 → 技能加成 → 宝石商店加成 → 黑市 Buff → 转生加成）：

| 函数 | 计算来源 |
|------|----------|
| `State.getTotalAtk()` | baseAtk + 装备 + 技能 + gemUpgrades.atkPct + buffs.atkPct + 转生倍率 |
| `State.getTotalDef()` | baseDef + 装备 + 技能 + gemUpgrades.defPct + buffs.defPct |
| `State.getTotalMaxHp()` | baseMaxHp + 装备 + gemUpgrades.hpPct |
| `State.getTotalSpd()` | baseSpd + 技能加成 + buffs.spdAdd |
| `State.getTotalCrit()` | baseCrit + 技能加成 + gemUpgrades.critAdd |
| `State.getAtkInterval()` | `Math.max(200, 1000 / getTotalSpd())` ms |
| `State.getGoldMultiplier()` | 1 + (gemUpgrades.goldPct + buffs.goldPct) / 100 |
| `State.getExpMultiplier()` | 1 + (gemUpgrades.expPct + buffs.expPct) / 100 |
| `State.getDropMultiplier()` | 1 + (gemUpgrades.dropPct + buffs.dropPct) / 100 |

## 升级逻辑
`State.addExp(amount)`:
1. 乘以 `getExpMultiplier()` 后再加入 `hero.exp`
2. while exp >= expToNext → 触发 levelUp()
3. levelUp(): level++, 提升 baseAtk/baseDef/baseMaxHp, 重新计算 expToNext = floor(100 * 1.15^level)
4. 调用 `Achievements.check()` 检查等级相关成就
