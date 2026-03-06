# gemshop.js — 宝石商店系统

## 职责
提供以 Gems（宝石）为货币的永久强化购买途径，是转生宝石的主要消耗出口。
全局挂载 `window.GemShop`。

## 两类商品

### 1. 永久升级（UPGRADES）
可多次购买，每次购买提升等级，费用按指数递增：
```
实际费用 = floor(baseCost × costScale ^ currentLevel)
```

| id | 名称 | 效果 | baseCost | costScale | maxLevel |
|----|------|------|----------|-----------|----------|
| gem_atk_bonus | Warrior's Blessing | +5% ATK/级 | 1 | 1.5 | 20 |
| gem_hp_bonus | Vitality Crystal | +8% MaxHP/级 | 1 | 1.5 | 20 |
| gem_def_bonus | Iron Bulwark | +6% DEF/级 | 1 | 1.5 | 20 |
| gem_gold_multi | Midas Touch | +10% Gold收益/级 | 1 | 1.8 | 15 |
| gem_exp_multi | Tome of Wisdom | +12% EXP收益/级 | 1 | 1.8 | 15 |
| gem_crit_bonus | Sharpened Edge | +2% 暴击率/级 | 2 | 1.6 | 10 |
| gem_drop_bonus | Plunderer's Sigil | +8% 掉落率/级 | 2 | 1.7 | 10 |
| gem_inventory_expand | Dimensional Pouch | 背包+5格/级 | 3 | 2.0 | 4 |
| gem_prestige_boost | Ascendant Power | 转生ATK加成+5%/级 | 5 | 2.5 | 10 |
| gem_offline_extend | Eternal Vigil | 离线上限+2小时/级 | 3 | 2.0 | 8 |

### 2. 一次性解锁（SPECIAL_UNLOCKS）
买断制，每种只能购买一次：

| id | 名称 | 效果 | cost |
|----|------|------|------|
| gem_auto_prestige | Auto-Prestige Gate | 击败 Dark Lord 后弹出确认框，防误触转生 | 5 💎 |
| gem_second_chance | Second Chance | 每次转生周期内死亡一次时 50% HP 复活（替代扣金） | 8 💎 |
| gem_elite_loot | Elite Magnetism | 精英怪必定掉落至少 1 件装备 | 10 💎 |
| gem_craft_slot | Craftsman's Table | 解锁合成系统（3件同品质 → 1件高品质） | 15 💎 |

## State 存储

```js
state.gemUpgrades = {
  atkPct: 15,          // 当前已叠加的 ATK% 加成（5% × 已购买次数）
  hpPct: 0,
  defPct: 0,
  goldPct: 0,
  expPct: 0,
  critAdd: 0.04,       // 暴击率绝对值加成（0.02 × 购买次数）
  dropPct: 0,
  invExpand: 10,       // 背包额外扩容格数（5 × 购买次数）
  offlineHours: 0,     // 离线时间额外小时数
  prestigeAtkBonus: 0, // 转生ATK额外加成（叠入 hero.prestigeBonus）
}

state.gemUpgradeLevels = {
  "gem_atk_bonus": 3,  // 对应升级的当前等级
  // ...
}

state.gemUnlocks = {
  autoPrestigeAlert: true,
  secondChance:      true,
  secondChanceUsed:  false,  // 当前转生周期是否已使用过
  eliteLoot:         true,
  crafting:          false,
}
```

## 核心函数

### `GemShop.getUpgradeCost(upg)`
计算指定升级下一级所需宝石数：
```js
floor(upg.baseCost × upg.costScale ^ currentLevel)
```

### `GemShop.getUpgradeLevel(upgId)`
返回当前已购买次数（0 = 未购买）。

### `GemShop.buyUpgrade(upgradeId)`
1. 检查是否达到 `maxLevel`
2. 检查 `state.hero.gems >= cost`
3. 扣除宝石，`gemUpgradeLevels[id]++`
4. 调用 `upg.apply(state)` 写入 `gemUpgrades` 效果
5. 输出日志，刷新面板

### `GemShop.buySpecialUnlock(unlockId)`
1. 检查是否已解锁（通过 `_getUnlockKey` 映射 state 字段）
2. 检查宝石足够
3. 扣除宝石，调用 `unlock.apply(state)`
4. 输出日志，刷新面板

### `GemShop.getGemBonus()`
返回汇总的加成对象，供 `state.js` 派生属性计算使用：
```js
{
  atkPct, hpPct, defPct, goldPct, expPct,
  critAdd, dropPct, invExpand, offlineHours
}
```

### `GemShop.getMaxInventory()`
返回背包实际最大容量：`20 + invExpand`

## 加成生效位置

| 加成类型 | 生效位置 |
|----------|----------|
| atkPct / hpPct / defPct | `State.getTotalAtk()` 等派生属性函数 |
| goldPct | `combat.js` 金币结算时 |
| expPct | `state.js` `addExp()` 时 |
| critAdd | `State.getTotalCrit()` |
| dropPct | `combat.js` 掉落判定时 |
| invExpand | `GemShop.getMaxInventory()` |
| offlineHours | `save.js` 离线收益计算时 |
| secondChance | `combat.js` `onHeroDeath()` 中检查 |
| eliteLoot | `combat.js` 精英怪掉落逻辑中检查 |

## 全局挂载
```js
window.GemShop = {
  UPGRADES, SPECIAL_UNLOCKS,
  getUpgradeCost, getUpgradeLevel,
  getGemBonus, getMaxInventory,
  buyUpgrade, buySpecialUnlock,
  _getUnlockKey,
}
```
