// skills.js — 技能树定义与解锁逻辑

const Skills = (() => {
  // 技能模板
  // type: "passive" = 被动加成 | "active" = 主动技能（战斗中自动使用）
  // requires: 前置技能 id，null 表示无前置
  // unlockLevel: 需要达到的等级
  const SKILL_TEMPLATES = [
    // ── 通用技能（所有职业可解锁）────────────
    {
      id: "auto_fight",
      name: "Auto Combat",
      class: "common",
      type: "passive",
      description: "Enables automatic combat. Hero fights without clicking.",
      effect: {},
      requires: null,
      unlockLevel: 3,
      cost: { gold: 50 },
    },
    {
      id: "tough_skin",
      name: "Tough Skin",
      class: "common",
      type: "passive",
      description: "+15% Max HP",
      effect: { hpMult: 1.15 },
      requires: null,
      unlockLevel: 5,
      cost: { gold: 100 },
    },
    {
      id: "quick_step",
      name: "Quick Step",
      class: "common",
      type: "passive",
      description: "+0.15 Attack Speed",
      effect: { spdAdd: 0.15 },
      requires: null,
      unlockLevel: 8,
      cost: { gold: 150 },
    },
    {
      id: "iron_will",
      name: "Iron Will",
      class: "common",
      type: "passive",
      description: "Reduce death gold penalty by 50%",
      effect: { deathPenaltyMult: 0.5 },
      requires: "tough_skin",
      unlockLevel: 12,
      cost: { gold: 300 },
    },

    // ── 战士技能树 ───────────────────────────
    {
      id: "power_strike",
      name: "Power Strike",
      class: "warrior",
      type: "passive",
      description: "+15% ATK",
      effect: { atkMult: 1.15 },
      requires: null,
      unlockLevel: 10,
      cost: { gold: 120 },
    },
    {
      id: "shield_wall",
      name: "Shield Wall",
      class: "warrior",
      type: "passive",
      description: "+20% DEF",
      effect: { defMult: 1.2 },
      requires: null,
      unlockLevel: 10,
      cost: { gold: 120 },
    },
    {
      id: "regen",
      name: "Regeneration",
      class: "warrior",
      type: "passive",
      description: "Recover 2% Max HP after each kill",
      effect: { regenOnKill: 0.02 },
      requires: "power_strike",
      unlockLevel: 15,
      cost: { gold: 250 },
    },
    {
      id: "cleave",
      name: "Cleave",
      class: "warrior",
      type: "active",
      description: "Deal 150% ATK damage. CD: 6s",
      effect: { dmgMult: 1.5, cd: 6000, mpCost: 0 },
      requires: "shield_wall",
      unlockLevel: 18,
      cost: { gold: 400 },
    },
    {
      id: "battle_cry",
      name: "Battle Cry",
      class: "warrior",
      type: "passive",
      description: "+25% ATK and +10% DEF",
      effect: { atkMult: 1.25, defMult: 1.1 },
      requires: "regen",
      unlockLevel: 25,
      cost: { gold: 800 },
    },

    // ── 战士专精选择（Lv.15，互斥）──────────────
    {
      id: "spec_guardian",
      name: "[Spec] Guardian",
      class: "warrior",
      type: "passive",
      specGate: true,
      specId: "guardian",
      description: "Choose Guardian spec. Defensive powerhouse: shields, taunt, block, counter-attack.",
      effect: { warriorSpec: "guardian" },
      requires: "shield_wall",
      unlockLevel: 15,
      cost: { gold: 200 },
    },
    {
      id: "spec_berserker",
      name: "[Spec] Berserker",
      class: "warrior",
      type: "passive",
      specGate: true,
      specId: "berserker",
      description: "Choose Berserker spec. Glass cannon: rage stacks, bloodthirst, berserk frenzy.",
      effect: { warriorSpec: "berserker" },
      requires: "power_strike",
      unlockLevel: 15,
      cost: { gold: 200 },
    },

    // ── 🛡️ Guardian 专精 ───────────────────────
    {
      id: "iron_fortress",
      name: "Iron Fortress",
      class: "warrior",
      spec: "guardian",
      type: "passive",
      description: "+30% DEF; each hit received has 20% chance to grant a Block stack (max 3). Each Block stack reduces next hit by 15%.",
      effect: { defMult: 1.3, blockChance: 0.20, blockMaxStacks: 3, blockDmgReduce: 0.15 },
      requires: "spec_guardian",
      unlockLevel: 15,
      cost: { gold: 300 },
    },
    {
      id: "shield_bash",
      name: "Shield Bash",
      class: "warrior",
      spec: "guardian",
      type: "active",
      description: "Deal 120% ATK + stun monster for 2s (no monster attacks during stun). CD: 8s",
      effect: { dmgMult: 1.2, stunDuration: 2000, cd: 8000, mpCost: 0 },
      requires: "spec_guardian",
      unlockLevel: 18,
      cost: { gold: 400 },
    },
    {
      id: "stalwart",
      name: "Stalwart",
      class: "warrior",
      spec: "guardian",
      type: "passive",
      description: "+20% Max HP; damage taken reduced by 10% (flat)",
      effect: { hpMult: 1.2, flatDmgReduce: 0.1 },
      requires: "iron_fortress",
      unlockLevel: 20,
      cost: { gold: 500 },
    },
    {
      id: "provoke",
      name: "Provoke",
      class: "warrior",
      spec: "guardian",
      type: "active",
      description: "Taunt: for 5s, your attacks deal +40% DMG and you take +25% DMG (risk/reward). CD: 12s",
      effect: { dmgMult: 1.0, provokeDuration: 5000, provokeAtkBonus: 0.4, provokeDmgTaken: 0.25, cd: 12000, mpCost: 0 },
      requires: "shield_bash",
      unlockLevel: 22,
      cost: { gold: 600 },
    },
    {
      id: "counter_stance",
      name: "Counter Stance",
      class: "warrior",
      spec: "guardian",
      type: "passive",
      description: "After blocking an attack (Block stack consumed), next attack deals +60% DMG",
      effect: { counterAfterBlock: true, counterDmgBonus: 0.6 },
      requires: "stalwart",
      unlockLevel: 25,
      cost: { gold: 800 },
    },
    {
      id: "fortress_mastery",
      name: "Fortress Mastery",
      class: "warrior",
      spec: "guardian",
      type: "passive",
      description: "Block max stacks +2 (to 5); DEF also adds to ATK at 30% ratio; HP regen +2/s",
      effect: { blockMaxBonus: 2, defToAtk: 0.3, hprAdd: 2 },
      requires: "counter_stance",
      unlockLevel: 30,
      cost: { gold: 1500 },
    },
    {
      id: "unbreakable",
      name: "Unbreakable",
      class: "warrior",
      spec: "guardian",
      type: "passive",
      description: "When HP drops below 20%, gain Unbreakable for 5s: immune to death, all damage capped at 1",
      effect: { unbreakable: true, unbreakableHpThresh: 0.2, unbreakableDuration: 5000 },
      requires: "fortress_mastery",
      unlockLevel: 35,
      cost: { gold: 2500 },
    },

    // ── ⚔️ Berserker 专精 ──────────────────────
    {
      id: "bloodlust",
      name: "Bloodlust",
      class: "warrior",
      spec: "berserker",
      type: "passive",
      description: "Each kill grants 1 Rage stack (max 10). Each stack gives +4% ATK. Stacks reset on death.",
      effect: { rageOnKill: 1, rageMaxStacks: 10, rageAtkPerStack: 0.04 },
      requires: "spec_berserker",
      unlockLevel: 15,
      cost: { gold: 300 },
    },
    {
      id: "reckless_strike",
      name: "Reckless Strike",
      class: "warrior",
      spec: "berserker",
      type: "active",
      description: "Deal 250% ATK damage but take 15% Max HP as self-damage. CD: 5s",
      effect: { dmgMult: 2.5, selfDmgPct: 0.15, cd: 5000, mpCost: 0 },
      requires: "spec_berserker",
      unlockLevel: 18,
      cost: { gold: 400 },
    },
    {
      id: "war_cry",
      name: "War Cry",
      class: "warrior",
      spec: "berserker",
      type: "active",
      description: "Enter Berserk for 8s: ATK +50%, SPD +0.5, but DEF -30%. CD: 20s",
      effect: { berserkDuration: 8000, berserkAtkBonus: 0.5, berserkSpdBonus: 0.5, berserkDefPenalty: 0.3, cd: 20000, mpCost: 0 },
      requires: "bloodlust",
      unlockLevel: 22,
      cost: { gold: 600 },
    },
    {
      id: "blood_frenzy",
      name: "Blood Frenzy",
      class: "warrior",
      spec: "berserker",
      type: "passive",
      description: "Every 5 Rage stacks: ATK speed +0.1; when at max Rage (10), crit rate +15%",
      effect: { rageSpdPerFive: 0.1, maxRageCritBonus: 0.15 },
      requires: "bloodlust",
      unlockLevel: 20,
      cost: { gold: 500 },
    },
    {
      id: "execute",
      name: "Execute",
      class: "warrior",
      spec: "berserker",
      type: "active",
      description: "If monster HP < 25%, deal 400% ATK (execute). Otherwise 180% ATK. CD: 10s",
      effect: { executeDmgMult: 4.0, normalDmgMult: 1.8, executeThresh: 0.25, cd: 10000, mpCost: 0 },
      requires: "reckless_strike",
      unlockLevel: 25,
      cost: { gold: 800 },
    },
    {
      id: "berserker_mastery",
      name: "Berserker Mastery",
      class: "warrior",
      spec: "berserker",
      type: "passive",
      description: "Rage stacks no longer reset on death (lose 3 instead); Reckless Strike self-damage heals you for 50% of damage dealt",
      effect: { ragePersistOnDeath: true, rageDeathLoss: 3, recklessHeal: 0.5 },
      requires: "execute",
      unlockLevel: 30,
      cost: { gold: 1500 },
    },
    {
      id: "death_wish",
      name: "Death Wish",
      class: "warrior",
      spec: "berserker",
      type: "passive",
      description: "Below 30% HP: ATK +40%, crit rate +20%. Reckless Strike deals +80% more when below 30% HP.",
      effect: { deathWish: true, deathWishAtkBonus: 0.4, deathWishCritBonus: 0.2, deathWishHpThresh: 0.3, deathWishRecklessBonus: 0.8 },
      requires: "berserker_mastery",
      unlockLevel: 35,
      cost: { gold: 2500 },
    },

    // ── 法师通用基础（Lv10，专精前共享）────────
    {
      id: "arcane_boost",
      name: "Arcane Boost",
      class: "mage",
      type: "passive",
      description: "+25% ATK (magic amplification)",
      effect: { atkMult: 1.25 },
      requires: null,
      unlockLevel: 10,
      cost: { gold: 120 },
    },
    {
      id: "mp_surge",
      name: "MP Surge",
      class: "mage",
      type: "passive",
      description: "+60% Max MP",
      effect: { mpMult: 1.6 },
      requires: null,
      unlockLevel: 10,
      cost: { gold: 100 },
    },
    {
      id: "mana_shield",
      name: "Mana Shield",
      class: "mage",
      type: "passive",
      description: "10% of damage taken is absorbed by MP (deactivates when MP=0)",
      effect: { mpAbsorb: 0.1 },
      requires: null,
      unlockLevel: 14,
      cost: { gold: 250 },
    },

    // ── 法师元素专精选择（Lv.15，互斥）─────────
    // 专精入口技能：解锁后对应专精树可见
    {
      id: "spec_pyro",
      name: "[Spec] Pyromancer",
      class: "mage",
      type: "passive",
      specGate: true,          // 标记为专精门控
      specId: "pyro",
      description: "Choose Fire spec. Burn stacks deal DoT; kills trigger Ignite Explosion.",
      effect: { mageSpec: "pyro" },
      requires: "arcane_boost",
      unlockLevel: 15,
      cost: { gold: 200 },
    },
    {
      id: "spec_cryo",
      name: "[Spec] Cryomancer",
      class: "mage",
      type: "passive",
      specGate: true,
      specId: "cryo",
      description: "Choose Ice spec. Chill stacks slow monster; 5 stacks = Freeze (hard CC).",
      effect: { mageSpec: "cryo" },
      requires: "mp_surge",
      unlockLevel: 15,
      cost: { gold: 200 },
    },
    {
      id: "spec_storm",
      name: "[Spec] Stormcaller",
      class: "mage",
      type: "passive",
      specGate: true,
      specId: "storm",
      description: "Choose Lightning spec. Build Charge stacks; spend them for massive skill damage.",
      effect: { mageSpec: "storm" },
      requires: "arcane_boost",
      unlockLevel: 15,
      cost: { gold: 200 },
    },

    // ── 🔥 火焰专精 (pyro) ─────────────────────
    {
      id: "ignite",
      name: "Ignite",
      class: "mage",
      spec: "pyro",
      type: "active",
      description: "150% ATK + add 2 Burn stacks. Costs 15 MP. CD: 3s",
      effect: { dmgMult: 1.5, burnAdd: 2, cd: 3000, mpCost: 15 },
      requires: "spec_pyro",
      unlockLevel: 15,
      cost: { gold: 300 },
    },
    {
      id: "scorched_earth",
      name: "Scorched Earth",
      class: "mage",
      spec: "pyro",
      type: "passive",
      description: "Normal attacks also add 1 Burn stack",
      effect: { normalAttackBurn: 1 },
      requires: "ignite",
      unlockLevel: 20,
      cost: { gold: 500 },
    },
    {
      id: "combustion",
      name: "Combustion",
      class: "mage",
      spec: "pyro",
      type: "passive",
      description: "Burn stack cap +5 (up to 10); Ignite Explosion damage +50%",
      effect: { burnCapBonus: 5, explosionMult: 1.5 },
      requires: "ignite",
      unlockLevel: 25,
      cost: { gold: 800 },
    },
    {
      id: "inferno",
      name: "Inferno",
      class: "mage",
      spec: "pyro",
      type: "active",
      description: "250% ATK + add 4 Burn stacks. If target has 3+ stacks, trigger Explosion immediately. Costs 40 MP. CD: 8s",
      effect: { dmgMult: 2.5, burnAdd: 4, explosionThreshold: 3, cd: 8000, mpCost: 40 },
      requires: "ignite",
      unlockLevel: 30,
      cost: { gold: 1200 },
    },
    {
      id: "phoenix_flame",
      name: "Phoenix Flame",
      class: "mage",
      spec: "pyro",
      type: "passive",
      description: "Ignite Explosion also restores 30% Max HP; Explosion damage can crit",
      effect: { explosionHpRegen: 0.3, explosionCanCrit: true },
      requires: "combustion",
      unlockLevel: 35,
      cost: { gold: 2500 },
    },
    {
      id: "heat_shield",
      name: "Heat Shield",
      class: "mage",
      spec: "pyro",
      type: "active",
      description: "For 5s, each hit you receive deals 30% ATK back and adds 1 Burn stack. Costs 25 MP. CD: 12s",
      effect: { heatShieldDuration: 5000, heatShieldReflect: 0.3, cd: 12000, mpCost: 25 },
      requires: "ignite",
      unlockLevel: 22,
      cost: { gold: 600 },
    },
    {
      id: "cauterize",
      name: "Cauterize",
      class: "mage",
      spec: "pyro",
      type: "passive",
      description: "If Burn stacks >= 5: HP regen efficiency +40% and each Burn stack restores 0.3% Max HP/s",
      effect: { cauterize: true },
      requires: "scorched_earth",
      unlockLevel: 27,
      cost: { gold: 1000 },
    },
    {
      id: "fire_mastery",
      name: "Fire Mastery",
      class: "mage",
      spec: "pyro",
      type: "passive",
      description: "All Fire skill CDs -20%; Burn DoT can crit (×1.5 on crit tick)",
      effect: { fireCdReduction: 0.2, burnCanCrit: true },
      requires: "phoenix_flame",
      unlockLevel: 38,
      cost: { gold: 4000 },
    },

    // ── ❄️ 冰霜专精 (cryo) ────────────────────
    {
      id: "frost_bolt",
      name: "Frost Bolt",
      class: "mage",
      spec: "cryo",
      type: "active",
      description: "130% ATK + add 1 Chill stack. Costs 15 MP. CD: 3s",
      effect: { dmgMult: 1.3, chillAdd: 1, cd: 3000, mpCost: 15 },
      requires: "spec_cryo",
      unlockLevel: 15,
      cost: { gold: 300 },
    },
    {
      id: "glacial_armor",
      name: "Glacial Armor",
      class: "mage",
      spec: "cryo",
      type: "passive",
      description: "+20% DEF; each hit received also adds 1 Chill stack to the monster",
      effect: { defMult: 1.2, hitChillReflect: 1 },
      requires: "frost_bolt",
      unlockLevel: 20,
      cost: { gold: 500 },
    },
    {
      id: "blizzard",
      name: "Blizzard",
      class: "mage",
      spec: "cryo",
      type: "active",
      description: "3-hit barrage (80% ATK each) adding 1 Chill stack per hit. Costs 50 MP. CD: 10s",
      effect: { dmgMult: 0.8, hits: 3, chillAdd: 1, cd: 10000, mpCost: 50 },
      requires: "frost_bolt",
      unlockLevel: 25,
      cost: { gold: 900 },
    },
    {
      id: "deep_freeze",
      name: "Deep Freeze",
      class: "mage",
      spec: "cryo",
      type: "passive",
      description: "Freeze duration 2s → 4s; after Freeze ends, monster has -30% SPD for 3s",
      effect: { freezeDuration: 4000, postFreezeSlowDuration: 3000, postFreezeSlowAmt: 0.3 },
      requires: "frost_bolt",
      unlockLevel: 30,
      cost: { gold: 1200 },
    },
    {
      id: "absolute_zero",
      name: "Absolute Zero",
      class: "mage",
      spec: "cryo",
      type: "passive",
      description: "During Freeze: hero ATK +60% (up from +30%); Freeze trigger restores 25% Max MP",
      effect: { freezeAtkBonus: 0.6, freezeMpRegen: 0.25 },
      requires: "deep_freeze",
      unlockLevel: 35,
      cost: { gold: 2500 },
    },
    {
      id: "ice_barrier",
      name: "Ice Barrier",
      class: "mage",
      spec: "cryo",
      type: "active",
      description: "Create ice shield absorbing 200% ATK damage. When broken, splashes 80% ATK + 1 Chill. Costs 30 MP. CD: 22s",
      effect: { iceBarrier: true, cd: 22000, mpCost: 30 },
      requires: "frost_bolt",
      unlockLevel: 22,
      cost: { gold: 600 },
    },
    {
      id: "permafrost",
      name: "Permafrost",
      class: "mage",
      spec: "cryo",
      type: "passive",
      description: "After a Freeze triggers, next fight starts with 2 Chill stacks on the monster",
      effect: { permafrost: true },
      requires: "glacial_armor",
      unlockLevel: 27,
      cost: { gold: 1000 },
    },
    {
      id: "cryo_mastery",
      name: "Cryo Mastery",
      class: "mage",
      spec: "cryo",
      type: "passive",
      description: "Each Chill stack restores 0.5% Max HP/s; during Freeze, hero Crit Rate +15%",
      effect: { chillHpRegen: 0.005, freezeCritBonus: 0.15 },
      requires: "absolute_zero",
      unlockLevel: 38,
      cost: { gold: 4000 },
    },

    // ── ⚡ 雷电专精 (storm) ────────────────────
    {
      id: "chain_lightning",
      name: "Chain Lightning",
      class: "mage",
      spec: "storm",
      type: "active",
      description: "180% ATK + consumes all Charge (each stack +20% dmg). Costs 30 MP. CD: 5s",
      effect: { dmgMult: 1.8, consumeCharge: true, chargeDmgPerStack: 0.2, cd: 5000, mpCost: 30 },
      requires: "spec_storm",
      unlockLevel: 15,
      cost: { gold: 300 },
    },
    {
      id: "static_field",
      name: "Static Field",
      class: "mage",
      spec: "storm",
      type: "passive",
      description: "Active skill hits also build 1 Charge; Charge cap +1 (to 6)",
      effect: { skillBuildCharge: true, chargeCapBonus: 1 },
      requires: "chain_lightning",
      unlockLevel: 20,
      cost: { gold: 500 },
    },
    {
      id: "overcharge",
      name: "Overcharge",
      class: "mage",
      spec: "storm",
      type: "passive",
      description: "When at max Charge: next skill deals extra +30%; Crit Rate +8%",
      effect: { overchargeDmgBonus: 0.3, critAdd: 0.08 },
      requires: "chain_lightning",
      unlockLevel: 25,
      cost: { gold: 800 },
    },
    {
      id: "ball_lightning",
      name: "Ball Lightning",
      class: "mage",
      spec: "storm",
      type: "active",
      description: "350% ATK ignoring 50% DEF. Only fires when fully charged (auto-waits). Costs 60 MP. CD: 12s",
      effect: { dmgMult: 3.5, defBypass: 0.5, requireFullCharge: true, consumeCharge: true, chargeDmgPerStack: 0.2, cd: 12000, mpCost: 60 },
      requires: "chain_lightning",
      unlockLevel: 30,
      cost: { gold: 1500 },
    },
    {
      id: "thunder_god",
      name: "Thunder God",
      class: "mage",
      spec: "storm",
      type: "passive",
      description: "Ball Lightning CD -4s; after firing, Charge -3 instead of clearing (can rebuild immediately)",
      effect: { ballLightningCdReduce: 4000, chargeRetain: 3 },
      requires: "overcharge",
      unlockLevel: 35,
      cost: { gold: 2500 },
    },
    {
      id: "lightning_rod",
      name: "Lightning Rod",
      class: "mage",
      spec: "storm",
      type: "active",
      description: "For 4s, each hit received reflects 50% ATK lightning and builds 1 Charge (max 3 triggers). Costs 20 MP. CD: 16s",
      effect: { lightningRodDuration: 4000, lightningRodReflect: 0.5, lightningRodMaxHits: 3, cd: 16000, mpCost: 20 },
      requires: "chain_lightning",
      unlockLevel: 22,
      cost: { gold: 600 },
    },
    {
      id: "storm_surge",
      name: "Storm Surge",
      class: "mage",
      spec: "storm",
      type: "passive",
      description: "When at max Charge, normal attacks deal extra 25% ATK lightning splash",
      effect: { stormSurge: true, stormSurgeDmg: 0.25 },
      requires: "static_field",
      unlockLevel: 27,
      cost: { gold: 1000 },
    },
    {
      id: "thunder_mastery",
      name: "Thunder Mastery",
      class: "mage",
      spec: "storm",
      type: "passive",
      description: "Each Charge stack gives +2% Crit Rate (max +12%); Ball Lightning crits don't consume Charge",
      effect: { chargeCritPerStack: 0.02, critNoConsumeCharge: true },
      requires: "thunder_god",
      unlockLevel: 38,
      cost: { gold: 4000 },
    },

    // ── 通用高级技能（Lv40+，三专精均可学）───────
    {
      id: "blink",
      name: "Blink",
      class: "mage",
      type: "active",
      description: "Become immune to next hit (2s); reset 1 random skill CD. Costs 40 MP. CD: 20s",
      effect: { blinkImmune: true, blinkDuration: 2000, cd: 20000, mpCost: 40 },
      requires: "mana_shield",
      unlockLevel: 40,
      cost: { gold: 3000 },
    },
    {
      id: "arcane_ward",
      name: "Arcane Ward",
      class: "mage",
      type: "passive",
      description: "Each fight starts with a shield absorbing 15% Max HP damage (once per fight)",
      effect: { arcaneWard: true, arcaneWardPct: 0.15 },
      requires: "mana_shield",
      unlockLevel: 42,
      cost: { gold: 3500 },
    },
    {
      id: "mana_drain",
      name: "Mana Drain",
      class: "mage",
      type: "active",
      description: "Deal 120% ATK, restore 30% of damage as MP. Free (0 MP cost). CD: 12s",
      effect: { dmgMult: 1.2, manaDrainReturn: 0.3, cd: 12000, mpCost: 0 },
      requires: "arcane_boost",
      unlockLevel: 45,
      cost: { gold: 4000 },
    },
    {
      id: "spell_echo",
      name: "Spell Echo",
      class: "mage",
      type: "passive",
      description: "Every 3rd active skill cast is free (no MP cost). Counter shown in combat.",
      effect: { spellEcho: true },
      requires: "arcane_ward",
      unlockLevel: 48,
      cost: { gold: 5000 },
    },
    {
      id: "focus",
      name: "Focus",
      class: "mage",
      type: "passive",
      description: "HP > 80%: all skill dmg +20%. HP <= 80%: all skill CD -15% instead.",
      effect: { focus: true },
      requires: "arcane_ward",
      unlockLevel: 50,
      cost: { gold: 6000 },
    },
    {
      id: "counterspell",
      name: "Counterspell",
      class: "mage",
      type: "active",
      description: "For 3s, absorb next hit and reflect 50% of it as damage. Costs 50 MP. CD: 30s",
      effect: { counterspell: true, counterspellDuration: 3000, counterspellReflect: 0.5, cd: 30000, mpCost: 50 },
      requires: "blink",
      unlockLevel: 52,
      cost: { gold: 7000 },
    },
    {
      id: "ley_line",
      name: "Ley Line",
      class: "mage",
      type: "passive",
      description: "After 3 consecutive kills, next fight starts with full MP",
      effect: { leyLine: true },
      requires: "mana_drain",
      unlockLevel: 53,
      cost: { gold: 7500 },
    },
    {
      id: "time_warp",
      name: "Time Warp",
      class: "mage",
      type: "active",
      description: "For 8s all skill CDs tick 3x faster. Afterward MP -50%. Costs 80 MP. CD: 60s",
      effect: { timeWarp: true, timeWarpDuration: 8000, timeWarpCdMult: 3, cd: 60000, mpCost: 80 },
      requires: "spell_echo",
      unlockLevel: 55,
      cost: { gold: 8000 },
    },
    {
      id: "spell_surge",
      name: "Spell Surge",
      class: "mage",
      type: "passive",
      description: "When MP > 80%, skill casts get an extra crit roll (independent of normal crit)",
      effect: { spellSurge: true },
      requires: "focus",
      unlockLevel: 57,
      cost: { gold: 9000 },
    },
    {
      id: "last_rite",
      name: "Last Rite",
      class: "mage",
      type: "passive",
      description: "When HP first drops below 20%, restore 40% Max HP and clear all debuffs (once per fight)",
      effect: { lastRite: true, lastRiteHeal: 0.4 },
      requires: "counterspell",
      unlockLevel: 58,
      cost: { gold: 10000 },
    },
    {
      id: "arcane_mastery",
      name: "Arcane Mastery",
      class: "mage",
      type: "passive",
      description: "+15% all magic skill damage; each cast restores 1% Max MP",
      effect: { magicDmgMult: 1.15, castMpRegen: 0.01 },
      requires: "time_warp",
      unlockLevel: 60,
      cost: { gold: 12000 },
    },

    // ── 游侠技能树 ───────────────────────────
    {
      id: "eagle_eye",
      name: "Eagle Eye",
      class: "ranger",
      type: "passive",
      description: "+10% Crit Rate",
      effect: { critAdd: 0.1 },
      requires: null,
      unlockLevel: 10,
      cost: { gold: 120 },
    },
    {
      id: "poison_arrow",
      name: "Poison Arrow",
      class: "ranger",
      type: "passive",
      description: "Each attack poisons enemy for 5% ATK/s (3s)",
      effect: { poisonPct: 0.05, poisonDuration: 3000 },
      requires: null,
      unlockLevel: 10,
      cost: { gold: 130 },
    },
    {
      id: "evasion",
      name: "Evasion",
      class: "ranger",
      type: "passive",
      description: "+12% Dodge Chance",
      effect: { dodgeAdd: 0.12 },
      requires: "eagle_eye",
      unlockLevel: 15,
      cost: { gold: 250 },
    },
    {
      id: "rapid_shot",
      name: "Rapid Shot",
      class: "ranger",
      type: "active",
      description: "Attack twice in quick succession. CD: 6s",
      effect: { hits: 2, cd: 6000, mpCost: 0 },
      requires: "poison_arrow",
      unlockLevel: 18,
      cost: { gold: 400 },
    },
    {
      id: "lethal_strike",
      name: "Lethal Strike",
      class: "ranger",
      type: "passive",
      description: "Crit hits deal 3x damage instead of 2x",
      effect: { critMult: 3.0 },
      requires: "evasion",
      unlockLevel: 25,
      cost: { gold: 800 },
    },

    // ── 游侠专精选择（Lv.15，互斥）──────────────
    {
      id: "spec_marksman",
      name: "[Spec] Marksman",
      class: "ranger",
      type: "passive",
      specGate: true,
      specId: "marksman",
      description: "Choose Marksman spec. Precision archer: focused shot, armor pierce, kill shot.",
      effect: { rangerSpec: "marksman" },
      requires: "eagle_eye",
      unlockLevel: 15,
      cost: { gold: 200 },
    },
    {
      id: "spec_shadowblade",
      name: "[Spec] Shadowblade",
      class: "ranger",
      type: "passive",
      specGate: true,
      specId: "shadowblade",
      description: "Choose Shadowblade spec. Stealth assassin: backstab, poison, shadow clone.",
      effect: { rangerSpec: "shadowblade" },
      requires: "evasion",
      unlockLevel: 15,
      cost: { gold: 200 },
    },

    // ── 🎯 Marksman 专精 ─────────────────────
    {
      id: "focused_shot",
      name: "Focused Shot",
      class: "ranger",
      spec: "marksman",
      type: "active",
      description: "Charge up: deal 300% ATK, ignores 40% DEF. CD: 7s",
      effect: { dmgMult: 3.0, defBypass: 0.4, cd: 7000, mpCost: 0 },
      requires: "spec_marksman",
      unlockLevel: 15,
      cost: { gold: 300 },
    },
    {
      id: "armor_pierce",
      name: "Armor Pierce",
      class: "ranger",
      spec: "marksman",
      type: "passive",
      description: "All attacks ignore 20% of monster DEF",
      effect: { globalDefBypass: 0.2 },
      requires: "spec_marksman",
      unlockLevel: 18,
      cost: { gold: 400 },
    },
    {
      id: "snipe",
      name: "Snipe",
      class: "ranger",
      spec: "marksman",
      type: "active",
      description: "Deal 200% ATK + guaranteed crit. CD: 10s",
      effect: { dmgMult: 2.0, guaranteedCrit: true, cd: 10000, mpCost: 0 },
      requires: "focused_shot",
      unlockLevel: 22,
      cost: { gold: 600 },
    },
    {
      id: "piercing_shots",
      name: "Piercing Shots",
      class: "ranger",
      spec: "marksman",
      type: "passive",
      description: "Crit hits also deal 30% bonus poison damage (ignores DEF)",
      effect: { critPoisonBonus: 0.3 },
      requires: "armor_pierce",
      unlockLevel: 20,
      cost: { gold: 500 },
    },
    {
      id: "kill_shot",
      name: "Kill Shot",
      class: "ranger",
      spec: "marksman",
      type: "active",
      description: "If monster HP < 30%, instant kill (deal 999% ATK). Otherwise 220% ATK. CD: 15s",
      effect: { killShotDmg: 9.99, killShotNormalDmg: 2.2, killShotThresh: 0.3, cd: 15000, mpCost: 0 },
      requires: "snipe",
      unlockLevel: 25,
      cost: { gold: 800 },
    },
    {
      id: "marksman_mastery",
      name: "Marksman Mastery",
      class: "ranger",
      spec: "marksman",
      type: "passive",
      description: "Every 5 consecutive crits: next attack deals 500% ATK (Ace Shot). Crit rate cap raised to 95%.",
      effect: { aceShot: true, aceShotCount: 5, aceShotDmg: 5.0 },
      requires: "kill_shot",
      unlockLevel: 30,
      cost: { gold: 1500 },
    },
    {
      id: "deadeye",
      name: "Dead Eye",
      class: "ranger",
      spec: "marksman",
      type: "passive",
      description: "+15% Crit Rate; crit damage multiplier +0.5x (total 3.5x with Lethal Strike); Focused Shot CD -2s",
      effect: { critAdd: 0.15, critMult: 3.5, focusedShotCdReduce: 2000 },
      requires: "marksman_mastery",
      unlockLevel: 35,
      cost: { gold: 2500 },
    },

    // ── 🗡️ Shadowblade 专精 ─────────────────────
    {
      id: "backstab",
      name: "Backstab",
      class: "ranger",
      spec: "shadowblade",
      type: "active",
      description: "Deal 200% ATK. If monster is poisoned: deal 350% ATK instead. CD: 5s",
      effect: { dmgMult: 2.0, backstabPoisonDmg: 3.5, cd: 5000, mpCost: 0 },
      requires: "spec_shadowblade",
      unlockLevel: 15,
      cost: { gold: 300 },
    },
    {
      id: "venom_blade",
      name: "Venom Blade",
      class: "ranger",
      spec: "shadowblade",
      type: "passive",
      description: "Poison damage increased to 10% ATK/s; poison duration extended to 5s; can stack twice",
      effect: { poisonPct: 0.1, poisonDuration: 5000, poisonStacks: 2 },
      requires: "spec_shadowblade",
      unlockLevel: 18,
      cost: { gold: 400 },
    },
    {
      id: "smoke_screen",
      name: "Smoke Screen",
      class: "ranger",
      spec: "shadowblade",
      type: "active",
      description: "Dodge all attacks for 3s; next attack is guaranteed crit with +100% DMG. CD: 15s",
      effect: { smokeScreenDuration: 3000, smokeScreenCritBonus: 1.0, cd: 15000, mpCost: 0 },
      requires: "backstab",
      unlockLevel: 22,
      cost: { gold: 600 },
    },
    {
      id: "shadow_mark",
      name: "Shadow Mark",
      class: "ranger",
      spec: "shadowblade",
      type: "passive",
      description: "Dodging an attack increases next attack's DMG by 40% (stacks up to 3 times)",
      effect: { shadowMarkOnDodge: true, shadowMarkDmgBonus: 0.4, shadowMarkMaxStacks: 3 },
      requires: "venom_blade",
      unlockLevel: 20,
      cost: { gold: 500 },
    },
    {
      id: "shadow_clone",
      name: "Shadow Clone",
      class: "ranger",
      spec: "shadowblade",
      type: "active",
      description: "Summon a shadow clone for 6s that mimics 60% of your attacks. CD: 20s",
      effect: { shadowCloneDuration: 6000, shadowCloneDmgRatio: 0.6, cd: 20000, mpCost: 0 },
      requires: "smoke_screen",
      unlockLevel: 25,
      cost: { gold: 800 },
    },
    {
      id: "shadowblade_mastery",
      name: "Shadowblade Mastery",
      class: "ranger",
      spec: "shadowblade",
      type: "passive",
      description: "Poison DoT can crit; each crit refreshes poison duration; Backstab always crits when target is poisoned",
      effect: { poisonCanCrit: true, critRefreshPoison: true, backstabAlwaysCrit: true },
      requires: "shadow_clone",
      unlockLevel: 30,
      cost: { gold: 1500 },
    },
    {
      id: "assassinate",
      name: "Assassinate",
      class: "ranger",
      spec: "shadowblade",
      type: "active",
      description: "Instantly deal 600% ATK (ignores DEF), apply max poison stacks, +25% gold from kill. CD: 30s",
      effect: { dmgMult: 6.0, defBypass: 1.0, applyMaxPoison: true, assassinateGoldBonus: 0.25, cd: 30000, mpCost: 0 },
      requires: "shadowblade_mastery",
      unlockLevel: 35,
      cost: { gold: 2500 },
    },
  ];

  const TEMPLATE_MAP = {};
  SKILL_TEMPLATES.forEach(t => { TEMPLATE_MAP[t.id] = t; });

  // ─────────────────────────────────────────
  // 技能解锁
  // ─────────────────────────────────────────

  function canUnlock(skillId) {
    const state = State.get();
    const tpl = TEMPLATE_MAP[skillId];
    if (!tpl) return { ok: false, reason: "Unknown skill" };
    if (state.unlockedSkills[skillId]) return { ok: false, reason: "Already learned" };

    // 职业检查（通用技能无职业限制）
    if (tpl.class !== "common" && state.hero.class !== tpl.class) {
      return { ok: false, reason: `Requires ${tpl.class} class` };
    }
    // 等级检查
    if (state.hero.level < tpl.unlockLevel) {
      return { ok: false, reason: `Requires Lv.${tpl.unlockLevel}` };
    }
    // 前置技能检查（支持逗号分隔的多前置）
    if (tpl.requires) {
      const reqs = tpl.requires.split("+").map(r => r.trim()).filter(Boolean);
      for (const reqId of reqs) {
        if (!state.unlockedSkills[reqId]) {
          const req = TEMPLATE_MAP[reqId];
          return { ok: false, reason: `Requires: ${req ? req.name : reqId}` };
        }
      }
    }
    // 专精门控：只有选了对应专精才能看到/解锁
    if (tpl.spec) {
      // 获取当前专精（支持法师/战士/游侠）
      const currentSpec = _getCurrentSpec(state, tpl.class);
      if (!currentSpec) return { ok: false, reason: "Choose a spec first (Lv.15)" };
      if (currentSpec !== tpl.spec) return { ok: false, reason: `Requires ${tpl.spec} spec` };
    }
    // 专精门控技能：互斥检查（已选其他专精则不能再选）
    if (tpl.specGate) {
      const currentSpec = _getCurrentSpec(state, tpl.class);
      if (currentSpec && currentSpec !== tpl.specId) {
        return { ok: false, reason: `Already chose ${currentSpec} spec` };
      }
    }
    // 金币检查
    if (state.hero.gold < tpl.cost.gold) {
      return { ok: false, reason: `Need ${tpl.cost.gold}g` };
    }
    return { ok: true, reason: "" };
  }

  /**
   * 获取当前职业的专精（供 canUnlock/getByClass 内部使用）
   */
  function _getCurrentSpec(state, cls) {
    if (cls === "mage")    return state.mage    ? state.mage.spec    : null;
    if (cls === "warrior") return state.warrior ? state.warrior.spec : null;
    if (cls === "ranger")  return state.ranger  ? state.ranger.spec  : null;
    return null;
  }

  function unlock(skillId) {
    const check = canUnlock(skillId);
    if (!check.ok) {
      if (window.UI) UI.addLog(`>> Cannot learn: ${check.reason}`, "red");
      return false;
    }
    const state = State.get();
    const tpl = TEMPLATE_MAP[skillId];
    state.hero.gold -= tpl.cost.gold;
    state.unlockedSkills[skillId] = true;

    // 专精门控：写入 spec 选择
    if (tpl.specGate && tpl.specId) {
      if (tpl.class === "mage") {
        state.mage.spec = tpl.specId;
        state.mage.specChosen = true;
        if (window.UI) UI.addLog(`>> Element spec chosen: ${tpl.specId.toUpperCase()}!`, "yellow");
      } else if (tpl.class === "warrior") {
        if (!state.warrior) state.warrior = { spec: null, specChosen: false };
        state.warrior.spec = tpl.specId;
        state.warrior.specChosen = true;
        if (window.UI) UI.addLog(`>> Warrior spec chosen: ${tpl.specId.toUpperCase()}!`, "yellow");
      } else if (tpl.class === "ranger") {
        if (!state.ranger) state.ranger = { spec: null, specChosen: false };
        state.ranger.spec = tpl.specId;
        state.ranger.specChosen = true;
        if (window.UI) UI.addLog(`>> Ranger spec chosen: ${tpl.specId.toUpperCase()}!`, "yellow");
      }
    }

    // thunder_god：应用 Ball Lightning CD 减少（永久效果，存入 TEMPLATE_MAP 覆盖）
    if (skillId === "thunder_god") {
      const ballTpl = TEMPLATE_MAP["ball_lightning"];
      if (ballTpl) ballTpl.effect.cd -= 4000;
    }

    if (window.UI) UI.addLog(`>> Learned: ${tpl.name}!`, "cyan");
    if (window.UI) UI.markSidePanelDirty();
    return true;
  }

  // ─────────────────────────────────────────
  // 被动效果汇总（供 state.js 调用）
  // ─────────────────────────────────────────

  function getEffects() {
    const state = State.get();
    const result = {
      atkMult: 1,
      defMult: 1,
      hpMult: 1,
      mpMult: 1,
      spdAdd: 0,
      critAdd: 0,
      dodgeAdd: 0,
      regenOnKill: 0,
      poisonPct: 0,
      poisonDuration: 0,
      critMult: 2.0,
      deathPenaltyMult: 1,
      mpAbsorb: 0,
      // ── 法师专精被动效果 ──
      normalAttackBurn: 0,      // 普攻叠灼烧层数
      burnCapBonus: 0,          // 灼烧层数上限额外加值
      explosionMult: 1,         // Ignite Explosion 伤害倍率加成
      explosionHpRegen: 0,      // 爆炸时回复 HP 比例
      explosionCanCrit: false,
      cauterize: false,
      fireCdReduction: 0,       // 火焰技能 CD 缩减比例
      burnCanCrit: false,
      hitChillReflect: 0,       // 被击时叠寒冷层
      freezeDuration: 2000,     // 冰冻持续时间（ms）
      postFreezeSlowDuration: 0,
      postFreezeSlowAmt: 0,
      freezeAtkBonus: 0.3,      // 冰冻期间英雄 ATK 加成（默认 +30%）
      freezeMpRegen: 0,         // 触发冰冻时回复 MP 比例
      permafrost: false,
      chillHpRegen: 0,          // 每层寒冷每秒回血比例
      freezeCritBonus: 0,       // 冰冻期间暴击率加成
      skillBuildCharge: false,  // 主动技能命中也积累充能
      chargeCapBonus: 0,        // 充能上限额外加值
      overchargeDmgBonus: 0,    // 满充能时额外伤害
      chargeRetain: 0,          // thunder_god：释放后保留充能数
      stormSurge: false,        // 满充能时普攻溅射
      stormSurgeDmg: 0,
      chargeCritPerStack: 0,    // 每层充能提供暴击率
      critNoConsumeCharge: false,
      // ── 通用高级被动效果 ──
      arcaneWard: false,
      arcaneWardPct: 0,
      spellEcho: false,
      focus: false,
      leyLine: false,
      spellSurge: false,
      lastRite: false,
      lastRiteHeal: 0,
      magicDmgMult: 1,
      castMpRegen: 0,
      // ── 战士 Guardian 专精 ──
      blockChance: 0,           // 受击时生成格挡层的概率
      blockMaxStacks: 3,        // 最大格挡层数（默认3）
      blockDmgReduce: 0,        // 每格挡层减少的伤害比例
      blockMaxBonus: 0,         // 额外格挡层上限
      flatDmgReduce: 0,         // 固定比例减伤
      counterAfterBlock: false, // 消耗格挡后下次攻击有加成
      counterDmgBonus: 0,       // 反击伤害加成
      defToAtk: 0,              // DEF 转化为 ATK 的比例
      hprAdd: 0,                // 额外 HP 回复速率加成
      unbreakable: false,       // 不屈：HP < 阈值时触发无敌
      unbreakableHpThresh: 0,
      unbreakableDuration: 0,
      provokeDmgTaken: 0,       // 挑衅期间受到的额外伤害系数（被读取，非效果字段）
      // ── 战士 Berserker 专精 ──
      rageOnKill: 0,            // 每次击杀获得怒气层数
      rageMaxStacks: 10,        // 最大怒气层数
      rageAtkPerStack: 0,       // 每层怒气提供的 ATK 加成
      rageSpdPerFive: 0,        // 每5层怒气的速度加成
      maxRageCritBonus: 0,      // 满怒气时的额外暴击率
      ragePersistOnDeath: false, // 死亡时怒气不清零
      rageDeathLoss: 0,         // 死亡时减少的怒气数
      recklessHeal: 0,          // 鲁莽打击自伤时回血比例
      // War Cry 主动技能参数（需通过 getEffects 读取）
      berserkAtkBonus: 0,       // 狂暴期间 ATK 加成
      berserkSpdBonus: 0,       // 狂暴期间 SPD 加成
      berserkDefPenalty: 0,     // 狂暴期间 DEF 惩罚
      berserkDuration: 0,       // 狂暴持续时间（ms）
      deathWish: false,         // 死亡意志：低血量时强化
      deathWishAtkBonus: 0,
      deathWishCritBonus: 0,
      deathWishHpThresh: 0,
      deathWishRecklessBonus: 0,
      // ── 游侠 Marksman 专精 ──
      globalDefBypass: 0,       // 所有攻击无视 DEF 的比例
      guaranteedCrit: false,    // 技能必暴击（由 combat 检查）
      critPoisonBonus: 0,       // 暴击时额外毒伤（忽视 DEF）
      killShotDmg: 0,           // Kill Shot 秒杀伤害倍率
      killShotNormalDmg: 0,     // Kill Shot 普通伤害倍率
      killShotThresh: 0,        // Kill Shot 触发阈值
      aceShot: false,           // Marksman Mastery：Ace Shot
      aceShotCount: 5,
      aceShotDmg: 5.0,
      focusedShotCdReduce: 0,   // Dead Eye：Focused Shot CD 减少
      // ── 游侠 Shadowblade 专精 ──
      poisonStacks: 1,          // 最大毒层数（默认1）
      poisonCanCrit: false,     // 毒可暴击
      critRefreshPoison: false, // 暴击时刷新毒持续时间
      backstabAlwaysCrit: false, // 目标中毒时背刺必暴
      shadowMarkOnDodge: false, // 闪避后累积影标记
      shadowMarkDmgBonus: 0,    // 每层影标记的伤害加成
      shadowMarkMaxStacks: 3,   // 最大影标记层数
      shadowCloneDuration: 0,   // 影分身持续时间
      shadowCloneDmgRatio: 0,   // 影分身伤害比例
      smokeScreenDuration: 0,   // 烟雾弹无敌时间
      smokeScreenCritBonus: 0,  // 烟雾弹后下次攻击额外暴击倍率
      assassinateGoldBonus: 0,  // 暗杀击杀后额外金币加成
    };

    Object.keys(state.unlockedSkills).forEach(id => {
      const tpl = TEMPLATE_MAP[id];
      if (!tpl) return;
      // 主动技能：仅提取 berserker War Cry 的参数配置字段
      if (tpl.type === "active") {
        if (tpl.id === "war_cry") {
          const we = tpl.effect;
          if (we.berserkAtkBonus)   result.berserkAtkBonus  = we.berserkAtkBonus;
          if (we.berserkSpdBonus)   result.berserkSpdBonus  = we.berserkSpdBonus;
          if (we.berserkDefPenalty) result.berserkDefPenalty = we.berserkDefPenalty;
          if (we.berserkDuration)   result.berserkDuration  = we.berserkDuration;
        }
        return; // 其余主动技能不影响 getEffects
      }
      if (tpl.type !== "passive") return;
      const e = tpl.effect;
      if (e.atkMult)              result.atkMult              *= e.atkMult;
      if (e.defMult)              result.defMult              *= e.defMult;
      if (e.hpMult)               result.hpMult               *= e.hpMult;
      if (e.mpMult)               result.mpMult               *= e.mpMult;
      if (e.spdAdd)               result.spdAdd               += e.spdAdd;
      if (e.critAdd)              result.critAdd              += e.critAdd;
      if (e.dodgeAdd)             result.dodgeAdd             += e.dodgeAdd;
      if (e.regenOnKill)          result.regenOnKill          += e.regenOnKill;
      if (e.poisonPct)            result.poisonPct            += e.poisonPct;
      if (e.poisonDuration)       result.poisonDuration        = e.poisonDuration;
      if (e.critMult)             result.critMult              = e.critMult;
      if (e.deathPenaltyMult)     result.deathPenaltyMult     *= e.deathPenaltyMult;
      if (e.mpAbsorb)             result.mpAbsorb             += e.mpAbsorb;
      // 法师专精
      if (e.normalAttackBurn)     result.normalAttackBurn     += e.normalAttackBurn;
      if (e.burnCapBonus)         result.burnCapBonus         += e.burnCapBonus;
      if (e.explosionMult)        result.explosionMult        *= e.explosionMult;
      if (e.explosionHpRegen)     result.explosionHpRegen     += e.explosionHpRegen;
      if (e.explosionCanCrit)     result.explosionCanCrit      = true;
      if (e.cauterize)            result.cauterize             = true;
      if (e.fireCdReduction)      result.fireCdReduction       = e.fireCdReduction;
      if (e.burnCanCrit)          result.burnCanCrit           = true;
      if (e.hitChillReflect)      result.hitChillReflect      += e.hitChillReflect;
      if (e.freezeDuration)       result.freezeDuration        = e.freezeDuration;
      if (e.postFreezeSlowDuration) result.postFreezeSlowDuration = e.postFreezeSlowDuration;
      if (e.postFreezeSlowAmt)    result.postFreezeSlowAmt     = e.postFreezeSlowAmt;
      if (e.freezeAtkBonus)       result.freezeAtkBonus        = e.freezeAtkBonus;
      if (e.freezeMpRegen)        result.freezeMpRegen         = e.freezeMpRegen;
      if (e.permafrost)           result.permafrost            = true;
      if (e.chillHpRegen)         result.chillHpRegen         += e.chillHpRegen;
      if (e.freezeCritBonus)      result.freezeCritBonus      += e.freezeCritBonus;
      if (e.skillBuildCharge)     result.skillBuildCharge      = true;
      if (e.chargeCapBonus)       result.chargeCapBonus       += e.chargeCapBonus;
      if (e.overchargeDmgBonus)   result.overchargeDmgBonus    = e.overchargeDmgBonus;
      if (e.chargeRetain)         result.chargeRetain          = e.chargeRetain;
      if (e.stormSurge)           result.stormSurge            = true;
      if (e.stormSurgeDmg)        result.stormSurgeDmg        += e.stormSurgeDmg;
      if (e.chargeCritPerStack)   result.chargeCritPerStack   += e.chargeCritPerStack;
      if (e.critNoConsumeCharge)  result.critNoConsumeCharge   = true;
      // 通用高级
      if (e.arcaneWard)           result.arcaneWard            = true;
      if (e.arcaneWardPct)        result.arcaneWardPct         = e.arcaneWardPct;
      if (e.spellEcho)            result.spellEcho             = true;
      if (e.focus)                result.focus                 = true;
      if (e.leyLine)              result.leyLine               = true;
      if (e.spellSurge)           result.spellSurge            = true;
      if (e.lastRite)             result.lastRite              = true;
      if (e.lastRiteHeal)         result.lastRiteHeal          = e.lastRiteHeal;
      if (e.magicDmgMult)         result.magicDmgMult         *= e.magicDmgMult;
      if (e.castMpRegen)          result.castMpRegen          += e.castMpRegen;
      // 战士 Guardian 专精
      if (e.blockChance)          result.blockChance          += e.blockChance;
      if (e.blockMaxStacks)       result.blockMaxStacks        = Math.max(result.blockMaxStacks, e.blockMaxStacks);
      if (e.blockDmgReduce)       result.blockDmgReduce       += e.blockDmgReduce;
      if (e.blockMaxBonus)        result.blockMaxBonus        += e.blockMaxBonus;
      if (e.flatDmgReduce)        result.flatDmgReduce        += e.flatDmgReduce;
      if (e.counterAfterBlock)    result.counterAfterBlock     = true;
      if (e.counterDmgBonus)      result.counterDmgBonus      += e.counterDmgBonus;
      if (e.defToAtk)             result.defToAtk             += e.defToAtk;
      if (e.hprAdd)               result.hprAdd               += e.hprAdd;
      if (e.unbreakable)          result.unbreakable           = true;
      if (e.unbreakableHpThresh)  result.unbreakableHpThresh   = e.unbreakableHpThresh;
      if (e.unbreakableDuration)  result.unbreakableDuration   = e.unbreakableDuration;
      // 战士 Berserker 专精
      if (e.rageOnKill)           result.rageOnKill           += e.rageOnKill;
      if (e.rageMaxStacks)        result.rageMaxStacks         = Math.max(result.rageMaxStacks, e.rageMaxStacks);
      if (e.rageAtkPerStack != null && e.rageAtkPerStack > 0) result.rageAtkPerStack = e.rageAtkPerStack;
      if (e.rageSpdPerFive)       result.rageSpdPerFive       += e.rageSpdPerFive;
      if (e.maxRageCritBonus)     result.maxRageCritBonus     += e.maxRageCritBonus;
      if (e.ragePersistOnDeath)   result.ragePersistOnDeath    = true;
      if (e.rageDeathLoss)        result.rageDeathLoss         = e.rageDeathLoss;
      if (e.recklessHeal)         result.recklessHeal         += e.recklessHeal;
      if (e.deathWish)            result.deathWish             = true;
      if (e.deathWishAtkBonus)    result.deathWishAtkBonus     = e.deathWishAtkBonus;
      if (e.deathWishCritBonus)   result.deathWishCritBonus    = e.deathWishCritBonus;
      if (e.deathWishHpThresh)    result.deathWishHpThresh     = e.deathWishHpThresh;
      if (e.deathWishRecklessBonus) result.deathWishRecklessBonus = e.deathWishRecklessBonus;
      // 游侠 Marksman 专精
      if (e.globalDefBypass)      result.globalDefBypass      += e.globalDefBypass;
      if (e.critPoisonBonus)      result.critPoisonBonus      += e.critPoisonBonus;
      if (e.killShotDmg)          result.killShotDmg           = e.killShotDmg;
      if (e.killShotNormalDmg)    result.killShotNormalDmg     = e.killShotNormalDmg;
      if (e.killShotThresh)       result.killShotThresh        = e.killShotThresh;
      if (e.aceShot)              result.aceShot               = true;
      if (e.aceShotCount)         result.aceShotCount          = e.aceShotCount;
      if (e.aceShotDmg)           result.aceShotDmg            = e.aceShotDmg;
      if (e.focusedShotCdReduce)  result.focusedShotCdReduce  += e.focusedShotCdReduce;
      // 游侠 Shadowblade 专精
      if (e.poisonStacks)         result.poisonStacks          = Math.max(result.poisonStacks, e.poisonStacks);
      if (e.poisonCanCrit)        result.poisonCanCrit         = true;
      if (e.critRefreshPoison)    result.critRefreshPoison     = true;
      if (e.backstabAlwaysCrit)   result.backstabAlwaysCrit    = true;
      if (e.shadowMarkOnDodge)    result.shadowMarkOnDodge     = true;
      if (e.shadowMarkDmgBonus)   result.shadowMarkDmgBonus    = e.shadowMarkDmgBonus;
      if (e.shadowMarkMaxStacks)  result.shadowMarkMaxStacks   = Math.max(result.shadowMarkMaxStacks, e.shadowMarkMaxStacks);
      if (e.shadowCloneDuration)  result.shadowCloneDuration   = e.shadowCloneDuration;
      if (e.shadowCloneDmgRatio)  result.shadowCloneDmgRatio   = e.shadowCloneDmgRatio;
      if (e.smokeScreenDuration)  result.smokeScreenDuration   = e.smokeScreenDuration;
      if (e.smokeScreenCritBonus) result.smokeScreenCritBonus  = e.smokeScreenCritBonus;
      if (e.assassinateGoldBonus) result.assassinateGoldBonus  = e.assassinateGoldBonus;
    });

    // thunder_mastery：充能层数动态贡献暴击率
    if (state.unlockedSkills["thunder_mastery"] && state.mage) {
      result.critAdd += state.mage.charge * result.chargeCritPerStack;
    }

    // 装备：被动效果倍率加成（passiveStatMult）
    // 放大来自被动技能贡献的关键数值加成（倍率超出 1.0 的部分）
    const passiveMult = window.State
      ? (State.getEquipBonus().passiveStatMult || 0)
      : 0;
    if (passiveMult > 0) {
      // 放大超出基础值的被动加成（乘数中超出 1.0 的部分 × passiveMult）
      // atkMult: 1.0 是基准，超出部分放大
      result.atkMult  = 1 + (result.atkMult  - 1) * (1 + passiveMult);
      result.defMult  = 1 + (result.defMult  - 1) * (1 + passiveMult);
      result.hpMult   = 1 + (result.hpMult   - 1) * (1 + passiveMult);
      result.mpMult   = 1 + (result.mpMult   - 1) * (1 + passiveMult);
      // 加法属性：直接放大
      result.spdAdd   = result.spdAdd   * (1 + passiveMult);
      result.critAdd  = result.critAdd  * (1 + passiveMult);
      result.dodgeAdd = result.dodgeAdd * (1 + passiveMult);
    }

    return result;
  }

  /**
   * 返回已解锁的主动技能列表（供 combat.js 调用）
   * 专精技能只返回当前专精的
   */
  function getActiveSkills() {
    const state = State.get();
    return SKILL_TEMPLATES.filter(t => {
      if (t.type !== "active") return false;
      if (!state.unlockedSkills[t.id]) return false;
      // 有专精标签的技能：只在匹配专精时生效
      if (t.spec) {
        const spec = _getCurrentSpec(state, t.class);
        if (t.spec !== spec) return false;
      }
      return true;
    });
  }

  /**
   * 返回已解锁的被动技能列表
   */
  function getPassiveSkills() {
    const state = State.get();
    return SKILL_TEMPLATES.filter(t => {
      if (t.type !== "passive") return false;
      if (!state.unlockedSkills[t.id]) return false;
      if (t.spec) {
        const spec = _getCurrentSpec(state, t.class);
        if (t.spec !== spec) return false;
      }
      return true;
    });
  }

  /**
   * 获取某职业的技能列表（用于 UI 展示）
   * 专精技能：只显示未选专精时的专精门控 + 已选专精自己的技能
   */
  function getByClass(className) {
    const state = State.get();
    const currentSpec = _getCurrentSpec(state, className);
    return SKILL_TEMPLATES.filter(t => {
      if (t.class !== className && t.class !== "common") return false;
      // 专精技能：只显示当前专精的（或还未选时显示全部 specGate）
      if (t.spec) {
        if (!currentSpec) return false;  // 未选专精时不显示任何专精技能
        return t.spec === currentSpec;
      }
      return true;
    });
  }

  /**
   * 职业选择（10 级后触发）
   */
  function chooseClass(className) {
    const state = State.get();
    if (state.classChosen) return;
    if (!["warrior", "mage", "ranger"].includes(className)) return;
    if (state.hero.level < 10) {
      if (window.UI) UI.addLog(">> Reach Lv.10 to choose a class!", "red");
      return;
    }
    state.hero.class = className;
    state.classChosen = true;
    if (window.UI) UI.addLog(`>> Class chosen: ${className.toUpperCase()}!`, "yellow");
    if (window.UI) UI.markSidePanelDirty();
  }

  function getTemplate(id) {
    return TEMPLATE_MAP[id] || null;
  }

  return {
    SKILL_TEMPLATES,
    TEMPLATE_MAP,
    canUnlock,
    unlock,
    getEffects,
    getActiveSkills,
    getPassiveSkills,
    getByClass,
    chooseClass,
    getTemplate,
  };
})();

window.Skills = Skills;
