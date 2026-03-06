# skills.js — 技能树

## 职责
定义三个职业的技能树数据，提供解锁检查与效果应用函数。
全局挂载 `window.Skills`。

## 职业技能树结构
```js
{
  id: "power_strike",
  name: "Power Strike",
  class: "warrior",      // warrior | mage | ranger | common（所有职业可解锁）
  type: "passive",       // passive | active
  description: "Increases ATK by 10%",
  effect: { atkMult: 1.1 },
  requires: null,        // 前置技能 id，null 表示无前置
  cost: { gold: 100 },
  level: 1,              // 解锁后默认等级1，未来可扩展多级
}
```

## 技能列表（初步）

### 通用技能（所有职业）
- Auto Fight：解锁自动战斗（花费 50 gold，等级 5 解锁）
- Tough Skin：+10% MaxHP（100 gold）
- Quick Step：+0.1 SPD（150 gold）

### 战士技能树
- Power Strike：+15% ATK（passive）
- Shield Wall：+20% DEF（passive）
- Regen：每次攻击回 2% MaxHP（passive）
- Cleave：攻击附带 50% ATK 的溅射（active，自动释放）

### 法师技能树（选职业时解锁）
- Arcane Boost：+25% ATK（passive）
- MP Surge：+50% MaxMP（passive）
- Fireball：消耗 20 MP，造成 200% ATK 伤害（active，CD 5s）
- Frost Nova：减少怪物 SPD 50%，持续 3s（active，CD 8s）

### 游侠技能树
- Eagle Eye：+10% crit rate（passive）
- Poison Arrow：攻击附带每秒 5% ATK 的毒（passive）
- Evasion：+10% 闪避率（passive）
- Rapid Shot：连续攻击两次（active，CD 6s）

## 核心函数
`Skills.canUnlock(skillId)` — 检查前置技能、职业、等级、金币
`Skills.unlock(skillId)` — 解锁技能，扣费，写入 State.unlockedSkills
`Skills.getEffects()` — 汇总所有已解锁技能的被动效果（返回叠加后的乘数对象）
`Skills.getActiveSkills()` — 返回已解锁的主动技能列表（供 combat 调用）
