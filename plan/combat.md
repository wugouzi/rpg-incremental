# combat.js — 战斗逻辑

## 职责
处理所有战斗计算、自动战斗 tick、死亡/胜利流程。
全局挂载 `window.Combat`。

## 战斗流程

### 进入战斗
`Combat.startFight(monster)`:
1. 将 monster 存入 State.currentMonster（含 currentHp）
2. 重置攻击计时器
3. 若 autoFight=true，自动开始 tick

### 一次攻击（heroAttack）
1. 计算伤害 = max(1, totalAtk - monster.baseDef)
2. 检查暴击：rand() < critRate → 伤害 * 2，日志标注 [CRIT]
3. monster.currentHp -= 伤害
4. 写入战斗日志
5. 若 monster.currentHp <= 0 → onMonsterDeath()

### 怪物反击（monsterAttack）
1. 计算伤害 = max(1, monster.baseAtk - totalDef)
2. hero.hp -= 伤害
3. 写入战斗日志（红色）
4. 若 hero.hp <= 0 → onHeroDeath()

### 攻击顺序
- 英雄每隔 `getAtkInterval()` ms 触发一次 heroAttack
- 怪物每隔 `1000 / monster.spd` ms 触发一次 monsterAttack
- 两者独立计时，在游戏主 tick（100ms）中累积时间并触发

### 怪物死亡（onMonsterDeath）
1. 结算 EXP：State.addExp(monster.expReward)
2. 结算 Gold：rand 范围取值，State.hero.gold += gold
3. 掉落判定：遍历 dropTable，chance 触发则生成物品放入背包
4. 统计 stats.totalKills++
5. 若是 Boss → onBossDefeated()
6. 若 autoFight=true → 延迟 500ms 后 spawn 下一只怪

### 英雄死亡（onHeroDeath）
1. 扣除 10% 当前金币（最少扣 1）
2. hp 恢复为 20%（不是满血，保留压迫感）
3. 战斗日志输出红色死亡提示
4. 若 autoFight=true → 延迟 2000ms 后重新开始战斗

### Boss 击败（onBossDefeated）
1. 标记 zone.bossDefeated = true
2. 解锁下一区域：Zones.unlockNext(currentZoneId)
3. 掉落固定史诗装备 + 大量 Gold
4. 若为 Final Boss（castle） → 提示可以转生

## 手动攻击
`Combat.manualAttack()`:
- 玩家点击 [ATTACK] 时触发
- 等同于一次 heroAttack，但无论自动战斗是否开启都可触发
- 若当前无怪物 → 先生成一只

## 全局挂载
```js
window.Combat = { startFight, manualAttack, toggleAutoFight }
```
