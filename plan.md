# Incremental RPG — Design Plan

## 概述

一款基于浏览器的**增量 RPG 游戏**，玩家扮演一名从平民出发的冒险者，通过打怪、升级、装备、技能，逐渐成长为传说英雄。技术栈：**纯前端**（HTML + CSS + 原生 JavaScript），无框架、无构建工具、无依赖，直接浏览器打开 `index.html` 即可运行，游戏状态存储在 `localStorage`。

**UI 风格：仿终端（Terminal）** —— 黑色背景、等宽字体、绿色文字，无任何图形元素，所有交互通过点击文字完成。

---

## 核心主题

**"放置勇者"** —— 你是一名被世界遗忘的普通人，靠着不断战斗与成长，最终击败黑暗魔王，解放大陆。

---

## 核心资源 / 属性

| 属性 | 说明 |
|------|------|
| ❤️ HP | 生命值，归零则战斗失败并扣除金币惩罚 |
| ⚔️ ATK | 攻击力，决定每次打怪伤害 |
| 🛡️ DEF | 防御力，减少受到的伤害 |
| 💨 SPD | 速度，决定攻击间隔 |
| ✨ EXP | 经验值，累积后升级 |
| 🪙 Gold | 金币，购买装备与技能 |
| 💎 Gems | 宝石（稀有货币），Prestige 后获得 |

---

## 游戏阶段

### 阶段一：草原新手村
- 玩家手动点击"攻击"按钮打倒史莱姆
- 获得 EXP & Gold，角色升级后属性提升
- 可购买基础装备（木剑、皮甲）

### 阶段二：自动战斗 & 地下城
- 解锁"自动战斗"后角色自动攻击
- 不同区域有不同怪物与掉落（森林、洞窟、沙漠……）
- 精英怪 & Boss，击败后解锁下一区域

### 阶段三：职业 & 技能树
- 10 级后选择职业（战士 / 法师 / 游侠）
- 每个职业有独立技能树（主动技能 + 被动加成）
- 技能消耗 Gold 或 EXP 解锁

### 阶段四：装备系统
- 装备分槽：武器、头盔、胸甲、腿甲、戒指、项链
- 装备有品质：普通 → 稀有 → 史诗 → 传说
- 可强化（消耗金币）或熔炼为材料

### 阶段五：Prestige（转生）
- 击败当前最终 Boss 后可"转生"
- 重置等级与装备，但保留 Gems & 永久被动加成
- 每次转生解锁新职业、新区域、新 Boss

---

## 职业列表

| 职业 | 核心属性 | 特色 |
|------|----------|------|
| ⚔️ 战士 | ATK / DEF 高 | 被动回血、格挡技能 |
| 🔮 法师 | ATK 极高 | AOE 技能、魔法穿透、蓝量系统 |
| 🏹 游侠 | SPD 极高 | 暴击、毒箭、宠物系统 |

---

## 区域 & 怪物（初步）

| 区域 | 怪物 | 掉落 |
|------|------|------|
| 🌿 新手草原 | 史莱姆、野猪 | 木材、皮革 |
| 🌲 幽暗森林 | 狼人、树妖 | 毒牙、树根 |
| 🪨 骷髅洞窟 | 骷髅战士、亡灵法师 | 骨粉、魔石 |
| 🏜️ 焦土沙漠 | 蝎子、沙漠强盗 | 沙晶、黄金 |
| 🏰 魔王城堡 | 精英守卫、魔王（Boss） | 传说装备、宝石 |

---

## 战斗系统

- **回合制自动战斗**：每隔 `1000ms / SPD` 发动一次普通攻击
- **技能冷却**：主动技能有 CD，条件满足自动释放
- **掉落系统**：击败怪物概率掉落装备、材料、金币
- **死亡惩罚**：HP 归零 → 失去部分金币，传送回城（不丢装备）

---

## UI 风格规范

### 视觉基调
- **背景**：纯黑 `#000000` 或深色 `#0d0d0d`
- **主文字色**：终端绿 `#00ff41` 或琥珀黄 `#ffb000`（可选配色主题）
- **次要文字**：暗绿 `#007a1f` / 灰 `#555`
- **高亮/选中**：白色 `#ffffff` 或反色块
- **字体**：`'Courier New', 'Fira Code', monospace`，全站等宽
- **无图片、无图标、无渐变、无圆角**，完全文字 + ASCII 线框构成
- **光标闪烁效果**：输入提示符 `>_` 末尾带闪烁光标

### 布局（ASCII 线框）

```
================================================================================
  IDLE HERO v0.1          [S]ave  [L]oad  [P]restige  [Q]uit
================================================================================
  HERO: unnamed           ZONE: Verdant Plains
  Lv.12  Warrior          MOB : Gray Wolf  [####------] 40/100 HP
  HP  : [########--] 80/100
  MP  : [####------] 40/100  >> You strike Gray Wolf for 23 dmg.
  ATK : 45   DEF: 20        >> Gray Wolf strikes you for 8 dmg.
  SPD : 1.2  CRT: 5%        >> Gray Wolf defeated! +15 exp, +8 gold
  EXP : [#######---] 70%    >> [AUTO] Seeking next target...
  Gold: 1,240  Gems: 3      >>
================================================================================
  [1] Stats    [2] Inventory   [3] Shop   [4] Skills   [5] Zones
================================================================================
  -- INVENTORY --
  Weapon : Iron Sword     (+18 ATK)  [E]quip  [D]rop
  Helmet : Leather Cap   (+5  DEF)  [E]quip  [D]rop
  Chest  : -- empty --              [G]o to shop
  Legs   : -- empty --
  Ring   : -- empty --
  Neck   : -- empty --
================================================================================
  > _
```

### 交互方式
- **纯鼠标操作**：所有 `[按钮]` 样式的文字均可点击，hover 时反色高亮
- **无键盘快捷键，无命令行输入**，全程只需鼠标
- **滚动日志**：战斗日志区域固定高度，自动滚动到最新行

### 颜色语义
| 颜色 | 用途 |
|------|------|
| 亮绿 `#00ff41` | 正面信息、增益、己方攻击 |
| 红色 `#ff3333` | 受到伤害、警告、死亡 |
| 黄色 `#ffff00` | 掉落物品、金币、稀有 |
| 青色 `#00ffff` | 技能释放、魔法 |
| 白色 `#ffffff` | 标题、重要数据 |
| 灰色 `#555555` | 未解锁内容、锁定区域 |

---

## 技术架构

```
incremental/
├── index.html          # 入口页面，所有 <script> 在此引入
├── style.css           # 样式（仿终端：黑底绿字，等宽字体，ASCII 线框）
└── js/
    ├── utils.js        # 数字格式化、随机工具等
    ├── state.js        # 游戏状态（角色、背包、区域等）全局对象
    ├── monsters.js     # 怪物定义（属性、掉落表）
    ├── zones.js        # 区域定义与解锁条件
    ├── equipment.js    # 装备定义、商店物品、强化逻辑
    ├── skills.js       # 技能树定义与解锁逻辑
    ├── combat.js       # 战斗逻辑（伤害计算、自动战斗 tick）
    ├── prestige.js     # 转生系统
    ├── save.js         # localStorage 存读档
    ├── ui.js           # DOM 渲染与事件绑定
    └── main.js         # 入口：初始化 + 游戏主循环
```

- **无框架、无构建**：所有 JS 文件用 `<script src>` 顺序加载，靠全局变量通信
- **游戏循环**：`setInterval` 每 100ms tick，战斗计时独立计算
- **大数显示**：自动切换 K / M / B / T 单位
- **存档**：每 30s 自动保存 JSON 到 `localStorage`
- **离线收益**：记录离开时间，重开时计算最多 8 小时离线战斗收益

---

## 开发里程碑

1. [x] 搭建项目结构（纯 HTML/CSS/JS，无框架）
2. [x] 角色状态 & 基础属性系统
3. [x] 手动点击战斗（打史莱姆）
4. [x] EXP & 升级系统
5. [x] 自动战斗 & 战斗日志
6. [x] 怪物多样化 & 区域系统
7. [x] 金币 & 商店 & 装备系统
8. [x] 装备品质 & 强化
9. [x] 职业选择 & 技能树
10. [x] Boss 战 & 区域解锁
11. [x] Prestige（转生）系统
12. [x] 离线收益
13. [x] UI 打磨（光标闪烁、仿终端风格、战斗日志滚动）
14. [ ] 平衡性调整

### 已修复 Bug & 后续改进（v0.1 → 当前）

- [x] 手动攻击后 `heroTimer` 未重置 → 每次 `[ATTACK]` 触发双重攻击
- [x] 右侧面板金钱未实时刷新 → 仅在切换 tab 时更新
- [x] 新增 `[STOP]` 按钮：停止当前战斗并关闭自动战斗
- [x] `[BUY]` 按钮 hover 闪烁 → 每 tick 全量重建侧面板 DOM 导致；改用脏标记（Dirty Flag）按需刷新
- [x] 单元测试：196 个测试全部通过（`npm test`）
- [x] 法师专精系统全套实现（Pyromancer/Cryomancer/Stormcaller + 11 个 Utility 技能）；新增 `test-mage-spec.js`（51 个测试），总计 275 通过；修复 `startFight` 未重置 Storm 充能 + Last Rite 一击毙命不触发两处 bug
- [x] Skills 面板分组折叠功能：每个技能分类标题可点击展开/收起，显示已学/总数计数（▶/▼ 箭头），折叠状态保存在 `_skillFold` 内存变量中
- [x] 装备属性随机化（类 Diablo 风格）：掉落装备基础 stat 在 ±20%（legendary ±10%）范围随机浮动；掉落时有概率随机升档品质（common→rare 15%/epic 5%/legendary 1%，rare→epic 12%/legendary 3%，epic→legendary 5%）；商店购买仍为固定值；UI 背包/装备栏显示 [RARE]/[EPIC]/[LGND] 彩色标签；新增 10 个测试，总计 285 通过
- [x] HPR/MPR 属性系统：新增 HP/MP 回复速率属性（基础值 = level×0.1/level×0.05），装备可带 `of Recovery`(hpr)/`of Clarity`(mpr) 词缀；战斗外每秒自动回复；新增 [REST] 按钮（3× 回复速率，5s 后自动结束；战斗中无法使用）；左侧面板显示 HPR/MPR 数值及休息状态 💤；新增 12 个测试，总计 297 通过
- [x] 日志过滤栏：在战斗日志上方增加 [ALL] / [COMBAT] / [LOOT] 三个过滤 tab；每条日志自动推断分类（攻击/技能伤害→combat，掉落/金币/升级→loot），点击 tab 即时显示/隐藏，不重建 DOM
- [x] 技能面板默认折叠：进入 SKILLS 标签时所有分组默认收起（▶），用户手动展开（▼）
- [x] 法师技能子分组折叠（v0.9.2）：MAGE SKILLS 大组展开后内部细分为 4 个子折叠组（BASE SKILLS / CHOOSE SPEC / 🔥PYROMANCER / ❄️CRYOMANCER / ⚡STORMCALLER），每个子组独立可点击折叠，默认收起；子组 foldGroup key 为 `mage_base`/`mage_spec_gate`/`mage_pyro`/`mage_cryo`/`mage_storm`；单技能行渲染抽取为 `_renderSkillRow` 辅助函数；新增 `tests/test-skill-subgroups.js`（24 项测试），总计 321 通过
- [x] 装备 Hover Tooltip + Loot 日志修复（v0.9.5）：① `appears!` 日志改为 `combat` 分类，不再出现在 LOOT 过滤中；② 装备槽和背包物品均支持 hover tooltip，显示基础属性+词缀；③ 背包物品 tooltip 额外显示与同槽已装备物品的属性 diff（绿色↑/红色↓）；④ 背包列表移除行内属性字符串，改为仅显示名称+品质标签，简洁干净；⑤ 新增全局 `#item-tooltip` div + CSS 样式（`style.css`）
- [x] 战斗中 HP/MP 自然回复（v0.9.4）：`tickRegen` 现在在战斗分支也被调用（`resting=false`），英雄在战斗中以正常速率持续回复 HP/MP；新增 4 项战斗回复测试（353 通过）
- [x] REST/Regen 双 Bug 修复（v0.9.3）：① `main.js` 非战斗状态不调用 `Combat.tick` 导致 REST 和自然回复完全无效；② `tickRegen` 用 `Math.max(1, Math.round(hpr))` 导致 HPR=0.2 时固定每秒回 1（5×偏快）；③ `tickRegen` 末尾调用不存在的 `UI.markDirty` 导致 UI 不刷新。修复：去掉 `main.js` 的 `currentMonster` 守卫；换用小数累计器（`hpRegenAcc`/`mpRegenAcc`）按 delta/1000 逐 tick 积分；改 `UI.markSidePanelDirty()`；新增 `tests/test-regen.js`（28 项测试，覆盖 HPR/MPR 基础值、小数累计精度、MP 回复、REST 3× 加速、战斗中断），总计 349 通过
- [x] Hover Tooltip 全面扩展 + 频闪修复（v0.10.0）：① 技能行 hover 显示 tooltip（技能名/类型[主动/被动]/解锁等级/费用/前置条件/效果说明）；② Zone 行 hover 显示 tooltip（区域描述/普通怪物列表[名称+元素+HP/ATK/DEF/EXP]/Boss 信息+状态）；③ 修复装备 tooltip 绑定范围（移到 `label` span，不含操作按钮区域，解决卖掉后 tooltip 残留问题）；④ 修复侧面板重建频闪：`refreshSidePanelIfDirty` 在 tooltip visible 时跳过重建（推迟到鼠标离开后），彻底消除按钮 hover 每秒一次的闪烁；⑤ `tickRegen` 改为仅在 HP/MP 实际整数变化时才标脏，大幅减少不必要的 DOM 重建；⑥ `Skills.getTemplate(id)` 新增暴露，供 ui.js tooltip 查询前置技能名称；测试总计 353 通过（无新增，逻辑变更无测试点）
- [x] 技能栏精简 + 火焰法师体验强化（v0.10.1）：① 技能栏移除名称行内描述文字（已学/未学均只保留名称+等级+费用），描述仅在 tooltip 内展示；② Pyro 状态栏新增 BURN 层数阶段提示：≥3 层显示橙色 `(≥3 → Inferno!)`，满层显示黄色加粗 `*** INFERNO NOW! ***`；③ Heat Shield 激活时在状态栏实时显示剩余时间和说明；④ Cauterize 激活（burn≥5）时状态栏显示绿色提示 `✦ CAUTERIZE active`；⑤ Ice Barrier（Cryo）激活时显示剩余护盾 HP；⑥ Lightning Rod（Storm）激活时将倒计时和触发次数纳入 buff 行；⑦ `combat.js` 新增 `heatShieldActive/Timer`、`iceBarrierHp`、`lightningRodActive/Timer/Hits` getter 供 UI 读取；⑧ 数值调整：Ignite CD 4s→3s，Inferno 爆炸阈值 5→3，Heat Shield CD 18s→12s；新增 `tests/test-pyro-ui.js`（35 项测试），总计 418 通过
- [x] 金币消耗（Money Sink）三大系统实装（v0.12.0）：
  - **装备洗练 Reforge**：背包/装备栏所有物品新增 `[Reforge]` 按钮，消耗金币（common=100/rare=250/epic=500/legendary=1200）重随所有词缀；common 装备有 20% 概率升级为 rare；词缀数量按品质固定（rare=2/epic=3/legendary=4）；洗练结果直接刷新 UI 及属性面板；`equipment.js` 新增 `REFORGE_COST` 常量与 `reforge(item)` 函数
  - **属性训练 Training Room**：Stats 面板底部新增「── TRAINING ROOM ──」区域，可永久提升 STR/DEX/VIT/INT 四项基础属性；训练费用随次数指数增长（`TRAIN_BASE × 1.5^count`，基础费用 STR/DEX=200/VIT=150/INT=250）；`state.js` 增加 `training` 对象计数、`train(attr)` 与 `getTrainCost(attr)` 函数及 `TRAIN_BASE` 常量，训练直接叠加到 `hero.str/dex/vit/int` 属性
  - **黑市 Black Market**：`js/blackmarket.js` 新模块，每 3 分钟定时刷新一批特殊商品（4件）；商品分两类：**增益卷轴**（scroll_atk/scroll_def/scroll_luck/scroll_spd/scroll_hpr/scroll_mpr/scroll_exp 共 7 种，各提供不同临时加成，持续时间 120~180s）与 **神秘装备**（mystery_gear，概率生成 rare/epic 级别随机装备）；购买后立即应用 buff 或送入背包；`state.js` 新增 `getBuffBonus()` 函数，`getTotalAtk/Def/Spd/Hpr/Mpr()` 均已叠加对应 buff 加成；`main.js` 初始化调用 `BlackMarket.init()`，tick 中调用 `BlackMarket.tick(delta)` 驱动倒计时与 buff 衰减；`renderShop()` 底部新增黑市 UI（倒计时条、商品列表、购买按钮）
  - **测试**：新增 `tests/test-money-sink.js`（48 项测试），覆盖 Reforge 扣费/词缀重随/升档概率、Training 费用公式/属性累加/拒绝不足金币、Black Market 商品生成/购买/buff 衰减/倒计时重置/派生属性加成；`run-tests.js` 新增 `blackmarket.js` 模块引入；总计 **506 通过，0 失败**

- [x] 平衡性大修 + 新机制实装（v0.11.0）：
  - **HP/MP 回复公式升级**：HPR = `1 + level×0.3`（Lv1=1.3, Lv10=4, Lv50=16），MPR = `0.5 + level×0.15`（Lv1=0.65, Lv10=2, Lv50=8），大幅提升中高等级回复量，与 HP/MP 总量成长匹配；`Combat.resetRegenAccumulators()` 新增供测试使用
  - **Zone 动态怪物等级**：每个 Zone 新增 `levelRange: [min, max]` 和 `killStreakScale`，怪物等级 = `clamp(heroLevel + floor(killStreak × scale), zoneMin, zoneMax)`；Boss 固定使用 zone 最高等级；UI Zone 面板显示当前有效等级和区间
  - **怪物 Mutation 系统**：新增 `MUTATION_POOL`（8 种词条：Berserker/Armored/Swift/Colossal/Toxic/Volatile/Cursed/Warlord），`tryMutate` 函数按 `5% + killStreak×1%`（上限60%）概率为普通怪附加 1~2 条词缀，精英怪掉落翻倍+金币+50%，战斗日志显示 `⚠ELITE` 标签及词条名称，战斗面板同步显示 `⚠ELITE` 标签
  - **装备基础属性提升**：全部 `ITEM_TEMPLATES` 基础属性大幅提升（iron_sword ATK 18→28，shadow_blade ATK 110→150 等），使装备效果更明显；HPR/MPR 词缀范围增强；新增武器 HPR 词缀
  - **新装备词缀**：`skill_cd_reduce`（技能CD减少，上限60%）、`active_boost`（主动技能伤害+%）、`passive_boost`（被动效果倍率放大）、`mp_on_kill`（击杀回复MP）；`state.js` 的 `getEquipBonus()` 新增对应累加逻辑；`skills.js` 的 `getEffects()` 应用 `passiveStatMult` 放大被动加成；`combat.js` 应用 `skillCdReduce`/`activeDmgBonus`/`mpOnKill`
  - **技能CD栏**：战斗面板下方新增 `── SKILLS ──` 区域，显示所有已解锁主动技能名称、CD进度条（`[████░░░░]`）和剩余时间/READY状态
  - **技能总览面板**：Stats 面板底部新增 `── SKILLS LEARNED ──` 区域，分 `[Active]`（⚡黄色，显示CD和MP消耗）和 `[Passive]`（✦青色，显示描述）两类列出已解锁技能；`skills.js` 新增 `getPassiveSkills()` 函数
  - **测试**：修复 `test-regen.js`（全面更新至新公式，28项）、`test-state.js`（2项 HPR/MPR 基础值断言）、`test-equipment.js`（iron_sword/shadow_blade ATK值）、`test-monsters-zones.js`（高等级怪物测试改用跨区域对比）；新增 `test-new-features.js`（37项，覆盖 calcEffectiveLevel/MUTATION_POOL完整性/精英怪触发/各新词缀/passiveStatMult/getPassiveSkills/resetRegenAccumulators）；总计 **458 通过，0 失败**

- [x] 成就系统 + 材料追踪 + 背包改进（v0.13.0）：
  - **成就系统**：新建 `js/achievements.js`，定义 20+ 个成就（击杀里程碑/等级/Boss 击败/金币/连胜/装备/转生/精英怪），`Achievements.check()` 在每次击杀后自动检查，首次解锁时发放 Gems 奖励并推送 `[LOOT]` 日志；`renderHero` 左侧面板显示成就解锁进度摘要（`ACHIEV: X/Y`）；`Stats` 面板新增 `── ACHIEVEMENTS ──` 区块，已解锁用黄色图标+名称+描述展示，未解锁用灰色 `▸` 显示；`index.html` 引入 `js/achievements.js`（在 blackmarket.js 之后、ui.js 之前）
  - **扩展统计追踪**：`state.stats` 新增 `eliteKills`（精英击杀数）、`maxKillStreak`（历史最高连胜）、`deaths`（死亡次数）三项；`combat.js` `onMonsterDeath` 更新 `maxKillStreak` 和 `eliteKills`，`onHeroDeath` 更新 `deaths` 并重置 `killStreak`；`Stats` 面板新增显示 `Elite Kills`/`Best Streak`/`Deaths` 三行
  - **连胜显示**：左侧英雄面板当 `killStreak > 0` 时显示 `STREAK: N kills` 行，≥5 次显示 🔥，≥20 次双🔥，≥50 次三🔥
  - **材料收集系统**：`state.materials` 对象正确追踪各材料数量（`materials[id] = count`）；`combat.js` 掉落逻辑中 `dropType === "material"` 时累加计数并在日志显示当前总数；背包 ITEMS 面板底部新增 `── MATERIALS ──` 区块，列出所有已收集材料名称和数量（snake_case 自动转换为 Title Case 可读名）
  - **背包改进**：装备列表按品质降序排序（legendary > epic > rare > common）；背包标题显示各品质数量统计（如 `[L:1 E:2 R:3 C:5]`）；当背包含有 common/rare 装备时显示 `[Sell All Common]` / `[Sell All Rare]` 一键批量出售按钮，点击后出售同品质所有装备并汇报总金币
  - **测试**：新增 `tests/test-achievements.js`（33 项测试），覆盖成就解锁条件/不重复解锁/gem 奖励/材料追踪计数/连胜统计字段/背包排序逻辑/bossDefeated 条件；`run-tests.js` 引入新测试文件；总计 **539 通过，0 失败**

---

## 待定问题（请修订）

- 职业是否只保留这三个，还是增加（圣骑士、刺客、召唤师等）？
- 装备系统是否需要随机词缀（类 Diablo 风格）？ → **已实现**
- 是否需要宠物/坐骑系统？
- 多人排行榜是否需要（依赖后端，可选）？
- 终端配色主题：经典绿（Matrix）/ 琥珀黄（老式 CRT）/ 白色（现代终端）？
