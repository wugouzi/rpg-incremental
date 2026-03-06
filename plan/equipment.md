# equipment.js — 装备系统

## 职责
定义所有装备模板、商店物品列表、装备/卸下/强化/熔炼逻辑。
全局挂载 `window.Equipment`。

## 装备数据结构
```js
{
  id: "iron_sword",
  name: "Iron Sword",
  slot: "weapon",       // weapon | helmet | chest | legs | ring | neck
  rarity: "common",     // common | rare | epic | legendary
  stats: { atk: 18, def: 0, hp: 0, mp: 0, spd: 0, crit: 0 },
  buyPrice: 80,         // 0 表示只能掉落不能购买
  sellPrice: 20,
  enhanceLevel: 0,      // 强化等级 0~10
  // 强化后属性 = stats * (1 + enhanceLevel * 0.1)
}
```

## 品质颜色映射（终端颜色）
- common   → 白色 `#ffffff`
- rare     → 青色 `#00ffff`
- epic     → 黄色 `#ffff00`
- legendary→ 红色 `#ff3333`（发光效果）

## 商店物品列表（初步）
按区域解锁，玩家进入该区域后商店新增对应物品。

### plains 商店
- Wooden Sword (weapon, +8 atk, 30g)
- Leather Cap (helmet, +3 def, 20g)
- Leather Armor (chest, +5 def, 40g)

### forest 商店
- Iron Sword (weapon, +18 atk, 80g)
- Iron Helmet (+8 def, 60g)
- Iron Armor (+12 def, 100g)

### cave 商店
- Steel Sword (+35 atk, 200g)
- Steel Armor (+25 def, 220g)
- Magic Ring (+5% crit, 150g)

### desert 商店
- Desert Blade (+60 atk, 500g)
- Sand Amulet (+10% spd, 400g)

### castle 商店
- Shadow Blade (epic, +100 atk, 1200g)
- Obsidian Armor (epic, +60 def, 1000g)

## 核心函数
`Equipment.equip(item)` — 装备物品，旧装备放入背包
`Equipment.unequip(slot)` — 卸下装备到背包
`Equipment.enhance(item)` — 消耗金币强化，失败有概率（高级装备）
`Equipment.sell(item)` — 出售背包物品
`Equipment.getShopItems(zoneId)` — 返回当前可购买列表
`Equipment.buy(itemId)` — 购买并放入背包
