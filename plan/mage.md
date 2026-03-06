# Mage — 法师深度设计

## 核心定位

法师是**高爆发、元素专精**型职业。  
选择职业后，在 **Lv.15** 时再做一次**元素倾向选择**，之后沿单一元素深挖，走出完全不同的游戏体验。

三条路线互斥，不可兼得：

| 专精 | 英文 | 核心玩法 | 关键数值 |
|------|------|----------|----------|
| 🔥 火焰 | Pyromancer | 灼烧DOT叠层 + 击杀爆炸回能 | 灼烧层数（Burn Stack, 0–10） |
| ❄️ 冰霜 | Cryomancer | 持续减速叠层 → 冰冻硬控 | 寒冷层数（Chill Stack, 0–5） |
| ⚡ 雷电 | Stormcaller | 蓄力充能 → 一击超高爆发 | 充能层数（Charge, 0–5） |

元素反应作为**彩蛋机制**保留——当怪物带有元素属性时偶发触发，不作为主要玩法依赖。

---

## 通用法师基础（三条路线共享）

### 低等级基础（Lv10，选职业时解锁）

| id | 名称 | 类型 | 等级 | 效果 | 费用 |
|----|------|------|------|------|------|
| arcane_boost | Arcane Boost | 被动 | 10 | +25% ATK（魔法增幅） | 120g |
| mp_surge | MP Surge | 被动 | 10 | +60% Max MP | 100g |
| mana_shield | Mana Shield | 被动 | 14 | 10% 伤害由 MP 吸收（MP 耗尽时失效） | 250g |

> Lv.15 选择元素倾向后，对应专精树解锁。三棵树的技能对其他专精不可见。

### 高等级通用技能（Lv40+，三专精均可学）

这些技能不属于任何元素，是法师的"法术支撑体系"，聚焦防御、续航和战场控制：

| id | 名称 | 类型 | 等级 | 效果 | MP | CD | 前置 | 费用 |
|----|------|------|------|------|----|----|------|------|
| blink | Blink | 主动 | 40 | 瞬间闪现，免疫下一次伤害（持续 2s）；重置 1 个随机技能 CD | 40 | 20s | mana_shield | 3000g |
| arcane_ward | Arcane Ward | 被动 | 42 | 战斗开始时自动生成护盾，吸收 `Max HP × 15%` 伤害；每场战斗只触发一次 | — | — | mana_shield | 3500g |
| mana_drain | Mana Drain | 主动 | 45 | 汲取怪物能量：造成 120% ATK 伤害，回复 `伤害值 × 30%` MP | 0 | 12s | arcane_boost | 4000g |
| spell_echo | Spell Echo | 被动 | 48 | 每释放 3 次主动技能后，下一次主动技能**免消耗 MP**（计数器显示在 UI） | — | — | arcane_ward | 5000g |
| focus | Focus | 被动 | 50 | HP > 80% 时所有技能伤害 +20%（"专注态"）；HP 低于 80% 时该加成消失但 CD -15% | — | — | arcane_ward | 6000g |
| counterspell | Counterspell | 主动 | 52 | 预判反制：接下来 3s 内若受到伤害，伤害归零并将其 50% 反射回怪物 | 50 | 30s | blink | 7000g |
| ley_line | Ley Line | 被动 | 53 | 连续击败 3 只怪物后激活地脉，下一场战斗 MP 满值开始（代替默认 50% 起始） | — | — | mana_drain | 7500g |
| time_warp | Time Warp | 主动 | 55 | 8s 内所有技能 CD 速度 ×3（三倍回转）；结束后 MP -50% | 80 | 60s | spell_echo | 8000g |
| spell_surge | Spell Surge | 被动 | 57 | MP > 80% 时施法额外触发**暴击判定**一次（独立于普通暴击，两者可叠加）；MP 越满，溢出的能量越不稳定 | — | — | focus | 9000g |
| last_rite | Last Rite | 被动 | 58 | HP 首次降至 20% 以下时立即回复 `Max HP × 40%` 并清除所有负面状态（每场战斗触发一次）| — | — | counterspell | 10000g |
| arcane_mastery | Arcane Mastery | 被动 | 60 | +15% 所有魔法技能伤害；每次施法回复 Max MP × 1%（被动续蓝） | — | — | time_warp | 12000g |

**技能树依赖（通用分支）**：
```
mana_shield
  ├─ blink (Lv40)
  │    └─ counterspell (Lv52)
  │         └─ last_rite (Lv58)
  └─ arcane_ward (Lv42)
       ├─ spell_echo (Lv48)
       │    └─ time_warp (Lv55)
       │         └─ arcane_mastery (Lv60)
       └─ focus (Lv50)
            └─ spell_surge (Lv57)

arcane_boost
  └─ mana_drain (Lv45)
       └─ ley_line (Lv53)
```

**设计意图**：
- `Blink` — 逃生 + 重置的紧急按钮，三专精通用；Cryo 用来跳过危险期，Storm 用来二次释放 Chain Lightning
- `Arcane Ward` — 开场护盾，补法师脆的短板，是后续很多防御路线的入口
- `Mana Drain` — 零费用续蓝攻击，每个专精都能用来应对蓝量危机
- `Spell Echo` — 第 3 次技能免 MP，让玩家有意识地数技能节奏
- `Focus` — 高血量奖励输出，低血量换取 CD 加速，同一个技能在不同战况下完全不同的价值感
- `Counterspell` — 高技巧上限的反制技，配合高攻怪物时收益极高；是"懂机制的玩家"的奖励
- `Ley Line` — 连胜奖励，让法师刷怪时有连续节奏感；满蓝开局 = 专精机制立刻生效
- `Time Warp` — 高风险大招，CD 极长，但爆发极强；配合 Storm 的充能可打出超高单次输出
- `Spell Surge` — 满血魔法暴击，与 `Focus` 的"满 HP 加成"形成双重激励，鼓励玩家稳住高 HP
- `Last Rite` — 保命底牌，法师从此不怕翻车；每场只触发一次，让危机时刻有戏剧感

---

## 🔥 火焰专精 — Pyromancer

**核心机制：灼烧层数（Burn Stack）**
- 火焰技能命中后在怪物身上叠加灼烧层，最高 10 层
- 每层灼烧每秒造成 `ATK × 2%` 伤害（10 层 = 每秒 20% ATK 的持续伤害）
- 怪物死亡时**爆炸（Ignite Explosion）**：造成 `ATK × (灼烧层数 × 15%)` 伤害并回复 20% Max MP
- 层数在怪物存活期间不衰减，只要持续攻击就会不断叠加

**游戏手感**：开局慢热，越打越快，击杀瞬间的爆炸 + 回蓝让下一场战斗立刻开始。

### 技能树

```
arcane_boost
  └─ ignite (Lv15) ★ 专精入口
       ├─ scorched_earth (Lv20)
       ├─ combustion (Lv25)
       │    └─ phoenix_flame (Lv35)
       └─ inferno (Lv30)
            └─ phoenix_flame (Lv35)
```

| id | 名称 | 类型 | 等级 | 效果 | MP | CD | 前置 | 费用 |
|----|------|------|------|------|----|----|------|------|
| ignite | Ignite | 主动 | 15 | 150% ATK + 叠加 2 层灼烧 | 15 | 4s | arcane_boost | 300g |
| scorched_earth | Scorched Earth | 被动 | 20 | 普通攻击也叠加 1 层灼烧 | — | — | ignite | 500g |
| combustion | Combustion | 被动 | 25 | 灼烧层数上限 +5（至 10 层）；爆炸伤害 +50% | — | — | ignite | 800g |
| inferno | Inferno | 主动 | 30 | 250% ATK + 叠加 4 层灼烧；若目标已有 5 层以上直接触发爆炸 | 40 | 8s | ignite | 1200g |
| phoenix_flame | Phoenix Flame | 被动 | 35 | 击杀爆炸额外回复 30% Max HP；爆炸伤害计入暴击 | — | — | combustion + inferno | 2500g |

### 🔥 火焰专属 Utility 技能

| id | 名称 | 类型 | 等级 | 效果 | MP | CD | 前置 | 费用 |
|----|------|------|------|------|----|----|------|------|
| heat_shield | Heat Shield | 主动 | 22 | 燃烧体表，5s 内每受到一次近战攻击对怪物反弹 `ATK × 30%` 伤害并叠加 1 层灼烧 | 25 | 18s | ignite | 600g |
| cauterize | Cauterize | 被动 | 27 | 灼烧层数 ≥ 5 时，自身 HP 回复效率 +40%（"以火炙伤止血"）；同时每层灼烧为玩家每秒回复 `Max HP × 0.3%` | — | — | scorched_earth | 1000g |
| fire_mastery | Fire Mastery | 被动 | 38 | 全局火焰技能 CD -20%；灼烧 DOT 计入暴击（暴击时当前帧 DOT ×1.5） | — | — | phoenix_flame | 4000g |

**设计意图**：
- `Heat Shield` 让火法不再只能"我攻你不动"，给一个主动贴近防御的选项，反伤同时还补灼烧层
- `Cauterize` 将"灼烧叠满"和"生存"绑定，让玩家在面对高 DPS 怪物时不得不更快叠层，形成压力→奖励的心流
- `Fire Mastery` 是终局连招加速器，搭配 `phoenix_flame` 和 `time_warp` 可达到接近无 CD 的循环

---

## ❄️ 冰霜专精 — Cryomancer

**核心机制：寒冷层数（Chill Stack）**
- 冰霜技能命中叠加寒冷层，最高 5 层
- 每层减少怪物攻速 8%（5 层 = -40% 怪物攻速）
- 达到 5 层时触发**冰冻（Freeze）**：怪物硬控 2s 无法攻击，冰冻结束后层数清零
- 冻结期间玩家攻击附加 +30% 伤害（趁虚而入）

**游戏手感**：稳健的防御型打法，用减速换取安全——面对高伤怪物时感受最强，像在雕刻冰雕。

### 技能树

```
mp_surge
  └─ frost_bolt (Lv15) ★ 专精入口
       ├─ glacial_armor (Lv20)
       ├─ blizzard (Lv25)
       │    └─ absolute_zero (Lv35)
       └─ deep_freeze (Lv30)
            └─ absolute_zero (Lv35)
```

| id | 名称 | 类型 | 等级 | 效果 | MP | CD | 前置 | 费用 |
|----|------|------|------|------|----|----|------|------|
| frost_bolt | Frost Bolt | 主动 | 15 | 130% ATK + 叠加 1 层寒冷 | 15 | 3s | mp_surge | 300g |
| glacial_armor | Glacial Armor | 被动 | 20 | +20% DEF；受到攻击时怪物叠加 1 层寒冷（被动反击） | — | — | frost_bolt | 500g |
| blizzard | Blizzard | 主动 | 25 | 持续施法 3s，每秒 80% ATK + 叠加 1 层寒冷（共叠 3 层） | 50 | 10s | frost_bolt | 900g |
| deep_freeze | Deep Freeze | 被动 | 30 | 冰冻持续时间从 2s → 4s；冰冻结束后怪物额外减速 30%（3s） | — | — | frost_bolt | 1200g |
| absolute_zero | Absolute Zero | 被动 | 35 | 冰冻期间玩家攻击 +30% → +60%；冰冻触发时回复 25% Max MP | — | — | blizzard + deep_freeze | 2500g |

### ❄️ 冰霜专属 Utility 技能

| id | 名称 | 类型 | 等级 | 效果 | MP | CD | 前置 | 费用 |
|----|------|------|------|------|----|----|------|------|
| ice_barrier | Ice Barrier | 主动 | 22 | 立即生成冰盾，吸收 `ATK × 200%` 伤害；冰盾破碎时对怪物溅射碎冰造成 `ATK × 80%` 伤害 + 1 层寒冷 | 30 | 22s | frost_bolt | 600g |
| permafrost | Permafrost | 被动 | 27 | 冰冻触发后，下一场战斗新怪物以 2 层寒冷开场（"余寒未散"）；自身移速惩罚免疫（未来区域移速机制预留） | — | — | glacial_armor | 1000g |
| cryo_mastery | Cryo Mastery | 被动 | 38 | 寒冷层数每层额外提供 `Max HP × 0.5%` 的每秒回血（冻越深越安全）；冰冻期间玩家暴击率 +15% | — | — | absolute_zero | 4000g |

**设计意图**：
- `Ice Barrier` 是冰法的主动防御手段——核心手感是"等护盾破了再爆一波碎冰"，进可攻退可守
- `Permafrost` 跨场战斗的状态延续，是增量游戏的"累积感"具象化，让冰法感觉更"绵长"
- `Cryo Mastery` 将寒冷层数和生存直接挂钩，鼓励叠层不息，高层数时几乎坦打不死

---

## ⚡ 雷电专精 — Stormcaller

**核心机制：充能层数（Lightning Charge）**
- 每次普通攻击积累 1 层充能，最高 5 层
- 解锁 `static_field` 后主动技能命中也积累 1 层
- 下次释放主动技能时消耗所有充能，**每层额外 +20% 伤害**（5 层 = +100%，即 2× 基础）
- 充能层数展示在战斗日志旁：`[⚡⚡⚡○○]`

**游戏手感**：节奏感最强——等待蓄满 5 层充能的过程是期待感，释放那一刻是爽感。面板上始终有充能数字在涨，典型增量游戏感。

### 技能树

```
arcane_boost + mp_surge
  └─ chain_lightning (Lv15) ★ 专精入口
       ├─ static_field (Lv20)
       ├─ overcharge (Lv25)
       │    └─ thunder_god (Lv35)
       └─ ball_lightning (Lv30)
            └─ thunder_god (Lv35)
```

| id | 名称 | 类型 | 等级 | 效果 | MP | CD | 前置 | 费用 |
|----|------|------|------|------|----|----|------|------|
| chain_lightning | Chain Lightning | 主动 | 15 | 180% ATK；消耗充能（每层 +20%） | 30 | 5s | arcane_boost + mp_surge | 300g |
| static_field | Static Field | 被动 | 20 | 主动技能命中也积累 1 层充能；充能上限 +1（至 6 层） | — | — | chain_lightning | 500g |
| overcharge | Overcharge | 被动 | 25 | 满充能时（5+层）下次技能额外 +30%（叠加在充能加成上）；暴击率 +8% | — | — | chain_lightning | 800g |
| ball_lightning | Ball Lightning | 主动 | 30 | 350% ATK + 无视 50% 防御；必须满充能才可释放（自动等待） | 60 | 12s | chain_lightning | 1500g |
| thunder_god | Thunder God | 被动 | 35 | Ball Lightning CD -4s；充能层数不清零（释放后剩余层数 -3，可立刻再积累） | — | — | overcharge + ball_lightning | 2500g |

### ⚡ 雷电专属 Utility 技能

| id | 名称 | 类型 | 等级 | 效果 | MP | CD | 前置 | 费用 |
|----|------|------|------|------|----|----|------|------|
| lightning_rod | Lightning Rod | 主动 | 22 | 插入导电棒，4s 内怪物攻击时触发反雷：对怪物造成 `ATK × 50%` 雷电伤害并积累 1 层充能（最多触发 3 次） | 20 | 16s | chain_lightning | 600g |
| storm_surge | Storm Surge | 被动 | 27 | 充能满层时，普通攻击也携带 `ATK × 25%` 的额外雷电溅射伤害（等待的每一刀都在放电） | — | — | static_field | 1000g |
| thunder_mastery | Thunder Mastery | 被动 | 38 | 充能每层额外提供 +2% 暴击率（满层 = +12%）；Ball Lightning 暴击时不消耗充能（充能保留） | — | — | thunder_god | 4000g |

**设计意图**：
- `Lightning Rod` 是雷法的"被动蓄充"工具——对高频攻击怪物反而效果更好，让怪物越凶残越对自己不利
- `Storm Surge` 把"已满充能但在等 CD"的间隙变得有意义：每一刀都有额外伤害，不会有空窗期焦虑
- `Thunder Mastery` 是终局技能的双重奖励：充能加暴击率 + 暴击时充能不消耗，两者形成螺旋上升的正反馈

---

## State 扩展

```js
// state.js createDefault() 新增
mage: {
  spec: null,          // "pyro" | "cryo" | "storm" | null（Lv.15 选择）
  // Pyromancer
  burnStack: 0,        // 当前怪物灼烧层数（0–10）
  // Cryomancer
  chillStack: 0,       // 当前怪物寒冷层数（0–5）
  frozen: false,       // 是否冰冻中
  freezeTimer: 0,      // 冰冻剩余时间（ms）
  // Stormcaller
  charge: 0,           // 充能层数（0–6）
}
```

怪物实例新增（monster instance）：
```js
burnStack: 0,          // 同步 state.mage.burnStack，随怪物切换重置
chillStack: 0,
```

---

## combat.js 扩展点

| 时机 | Pyro | Cryo | Storm |
|------|------|------|-------|
| 英雄普攻命中后 | burnStack++ (if scorched_earth) | — | charge++ |
| 主动技能命中后 | burnStack += 技能指定层数 | chillStack += 技能指定层数 | charge++ (if static_field) |
| tick 每帧 | 灼烧 DOT 结算（per 1000ms） | 检查 chillStack>=5 触发冰冻；冰冻计时 | — |
| 怪物死亡时 | 触发 Ignite Explosion；burnStack 清零 | chillStack/frozen 清零 | charge 不清零（保留至下场） |
| 新怪物生成时 | burnStack 清零 | chillStack/frozen 清零 | charge 不变 |
| 计算怪物攻击间隔 | — | monsterInterval × (1 + chillStack × 0.08) | — |
| 计算英雄受伤 | — | frozen 时怪物无法攻击 | — |
| 释放主动技能前 | — | — | 读取并清空 charge，计算加成 |

---

## UI 展示

**战斗区域**（在怪物 HP 条旁边新增一行）：
```
  Pyro  : [Burn: ████████──] 8 stacks  (DOT: 16% ATK/s)
  Cryo  : [Chill: ███──] 3 stacks → Freeze at 5
  Storm : [Charge: ⚡⚡⚡⚡○] 4/5  (next skill +80%)
```

**Skills 面板**中用不同颜色区分专精：
- 🔥 火焰技能：红色
- ❄️ 冰霜技能：青色
- ⚡ 雷电技能：黄色

---

## 实现优先级

1. **Storm（雷电）**：机制最简单（充能是纯加法），对现有代码改动最小，适合先做
2. **Pyro（火焰）**：DOT 系统需要 tick 计算，中等复杂度
3. **Cryo（冰霜）**：硬控 + 减速叠层逻辑最复杂，放最后
