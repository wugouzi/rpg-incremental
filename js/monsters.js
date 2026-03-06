// monsters.js — 怪物定义与生成

const Monsters = (() => {
  // 怪物模板定义
  // baseHp/baseAtk 会随玩家等级缩放
  // 掉落条目类型：
  //   type: "material" — 素材（不进背包，只记日志）
  //   type: "equipment" — 带随机词缀的装备实例（进背包）
  //   type: undefined / 旧格式 — 沿用旧逻辑（createItem 无词缀）
  const TEMPLATES = [
    // ── 新手草原 ─────────────────────────────
    {
      id: "slime",
      name: "Slime",
      zone: "plains",
      element: "poison",       // 元素类型：对应玩家的 poisonRes
      isBoss: false,
      weight: 5,
      baseHp: 20,
      baseAtk: 4,
      baseDef: 0,
      baseSpd: 0.8,
      expReward: 10,
      goldReward: { min: 2, max: 6 },
      dropTable: [
        { type: "material", itemId: "slime_gel",    name: "Slime Gel",  chance: 0.4 },
        { type: "equipment", itemId: "leather_cap", chance: 0.06 },
      ],
    },
    {
      id: "wild_boar",
      name: "Wild Boar",
      zone: "plains",
      element: "phys",
      isBoss: false,
      weight: 3,
      baseHp: 35,
      baseAtk: 6,
      baseDef: 1,
      baseSpd: 1.0,
      expReward: 18,
      goldReward: { min: 4, max: 10 },
      dropTable: [
        { type: "material", itemId: "boar_tusk", name: "Boar Tusk", chance: 0.25 },
        { type: "material", itemId: "leather",   name: "Leather",   chance: 0.35 },
        { type: "equipment", itemId: "leather_armor", chance: 0.07 },
      ],
    },
    {
      id: "giant_slime",
      name: "Giant Slime King",
      zone: "plains",
      element: "poison",
      isBoss: true,
      weight: 0,
      baseHp: 300,
      baseAtk: 12,
      baseDef: 3,
      baseSpd: 0.7,
      expReward: 150,
      goldReward: { min: 80, max: 120 },
      dropTable: [
        { type: "equipment", itemId: "wooden_sword", chance: 1.0 },
        { type: "equipment", itemId: "leather_legs", chance: 0.5 },
      ],
    },

    // ── 幽暗森林 ─────────────────────────────
    {
      id: "werewolf",
      name: "Werewolf",
      zone: "forest",
      element: "phys",
      isBoss: false,
      weight: 4,
      baseHp: 80,
      baseAtk: 18,
      baseDef: 4,
      baseSpd: 1.2,
      expReward: 45,
      goldReward: { min: 12, max: 25 },
      dropTable: [
        { type: "material", itemId: "wolf_pelt", name: "Wolf Pelt", chance: 0.3 },
        { type: "material", itemId: "fang",       name: "Fang",     chance: 0.2 },
        { type: "equipment", itemId: "iron_legs",  chance: 0.06 },
      ],
    },
    {
      id: "wood_spirit",
      name: "Wood Spirit",
      zone: "forest",
      element: "lightning",    // 自然雷
      isBoss: false,
      weight: 3,
      baseHp: 60,
      baseAtk: 22,
      baseDef: 2,
      baseSpd: 0.9,
      expReward: 40,
      goldReward: { min: 10, max: 20 },
      dropTable: [
        { type: "material", itemId: "spirit_essence", name: "Spirit Essence", chance: 0.2 },
        { type: "material", itemId: "wood",            name: "Wood",          chance: 0.4 },
        { type: "equipment", itemId: "iron_helmet",    chance: 0.06 },
      ],
    },
    {
      id: "ancient_treant",
      name: "Ancient Treant",
      zone: "forest",
      element: "lightning",
      isBoss: true,
      weight: 0,
      baseHp: 800,
      baseAtk: 30,
      baseDef: 10,
      baseSpd: 0.6,
      expReward: 400,
      goldReward: { min: 200, max: 350 },
      dropTable: [
        { type: "equipment", itemId: "iron_sword",  chance: 1.0 },
        { type: "equipment", itemId: "iron_armor",  chance: 0.6 },
        { type: "equipment", itemId: "iron_ring",   chance: 0.4 },
      ],
    },

    // ── 骷髅洞窟 ─────────────────────────────
    {
      id: "skeleton",
      name: "Skeleton Warrior",
      zone: "cave",
      element: "phys",
      isBoss: false,
      weight: 4,
      baseHp: 140,
      baseAtk: 40,
      baseDef: 8,
      baseSpd: 1.0,
      expReward: 90,
      goldReward: { min: 30, max: 55 },
      dropTable: [
        { type: "material", itemId: "bone_dust",   name: "Bone Dust",   chance: 0.35 },
        { type: "material", itemId: "magic_stone", name: "Magic Stone", chance: 0.1  },
        { type: "equipment", itemId: "steel_legs", chance: 0.05 },
      ],
    },
    {
      id: "undead_mage",
      name: "Undead Mage",
      zone: "cave",
      element: "ice",          // 冰霜魔法
      isBoss: false,
      weight: 3,
      baseHp: 100,
      baseAtk: 55,
      baseDef: 4,
      baseSpd: 0.8,
      expReward: 100,
      goldReward: { min: 35, max: 60 },
      dropTable: [
        { type: "material",  itemId: "magic_stone",  name: "Magic Stone", chance: 0.25 },
        { type: "material",  itemId: "dark_robe",    name: "Dark Robe",   chance: 0.1  },
        { type: "equipment", itemId: "bone_necklace", chance: 0.07 },
        { type: "equipment", itemId: "steel_helmet",  chance: 0.05 },
      ],
    },
    {
      id: "lich",
      name: "Lich",
      zone: "cave",
      element: "ice",
      isBoss: true,
      weight: 0,
      baseHp: 2000,
      baseAtk: 70,
      baseDef: 15,
      baseSpd: 0.8,
      expReward: 1000,
      goldReward: { min: 500, max: 800 },
      dropTable: [
        { type: "equipment", itemId: "steel_sword",  chance: 1.0 },
        { type: "equipment", itemId: "magic_ring",   chance: 0.8 },
        { type: "equipment", itemId: "steel_armor",  chance: 0.5 },
      ],
    },

    // ── 焦土沙漠 ─────────────────────────────
    {
      id: "scorpion",
      name: "Giant Scorpion",
      zone: "desert",
      element: "poison",
      isBoss: false,
      weight: 4,
      baseHp: 250,
      baseAtk: 80,
      baseDef: 18,
      baseSpd: 1.1,
      expReward: 180,
      goldReward: { min: 60, max: 110 },
      dropTable: [
        { type: "material",  itemId: "scorpion_claw", name: "Scorpion Claw", chance: 0.3 },
        { type: "material",  itemId: "sand_crystal",  name: "Sand Crystal",  chance: 0.2 },
        { type: "equipment", itemId: "desert_hood",   chance: 0.05 },
      ],
    },
    {
      id: "desert_bandit",
      name: "Desert Bandit",
      zone: "desert",
      element: "fire",         // 火焰弹
      isBoss: false,
      weight: 3,
      baseHp: 200,
      baseAtk: 95,
      baseDef: 12,
      baseSpd: 1.3,
      expReward: 200,
      goldReward: { min: 80, max: 150 },
      dropTable: [
        { type: "equipment", itemId: "desert_blade", chance: 0.08 },
        { type: "equipment", itemId: "desert_robe",  chance: 0.07 },
      ],
    },
    {
      id: "sand_wyrm",
      name: "Sand Wyrm",
      zone: "desert",
      element: "fire",
      isBoss: true,
      weight: 0,
      baseHp: 5000,
      baseAtk: 120,
      baseDef: 30,
      baseSpd: 0.9,
      expReward: 2500,
      goldReward: { min: 1200, max: 1800 },
      dropTable: [
        { type: "equipment", itemId: "desert_blade", chance: 1.0 },
        { type: "equipment", itemId: "sand_amulet",  chance: 0.7 },
        { type: "equipment", itemId: "desert_robe",  chance: 0.5 },
      ],
    },

    // ── 魔王城堡 ─────────────────────────────
    {
      id: "elite_guard",
      name: "Elite Guard",
      zone: "castle",
      element: "phys",
      isBoss: false,
      weight: 3,
      baseHp: 500,
      baseAtk: 160,
      baseDef: 50,
      baseSpd: 1.0,
      expReward: 400,
      goldReward: { min: 150, max: 250 },
      dropTable: [
        { type: "equipment", itemId: "shadow_blade",   chance: 0.06 },
        { type: "equipment", itemId: "obsidian_armor", chance: 0.06 },
        { type: "equipment", itemId: "shadow_helm",    chance: 0.05 },
      ],
    },
    {
      id: "dark_knight",
      name: "Dark Knight",
      zone: "castle",
      element: "fire",
      isBoss: false,
      weight: 2,
      baseHp: 650,
      baseAtk: 200,
      baseDef: 65,
      baseSpd: 0.9,
      expReward: 500,
      goldReward: { min: 200, max: 350 },
      dropTable: [
        { type: "equipment", itemId: "shadow_blade",   chance: 0.09 },
        { type: "equipment", itemId: "shadow_legs",    chance: 0.07 },
        { type: "equipment", itemId: "shadow_pendant", chance: 0.06 },
      ],
    },
    {
      id: "dark_lord",
      name: "Dark Lord",
      zone: "castle",
      element: "fire",
      isBoss: true,
      weight: 0,
      baseHp: 15000,
      baseAtk: 300,
      baseDef: 80,
      baseSpd: 1.0,
      expReward: 10000,
      goldReward: { min: 5000, max: 8000 },
      dropTable: [
        { type: "equipment", itemId: "shadow_blade",   chance: 1.0 },
        { type: "equipment", itemId: "obsidian_armor", chance: 1.0 },
        { type: "equipment", itemId: "lords_ring",     chance: 1.0 },
        { type: "equipment", itemId: "lords_sword",    chance: 0.5 },
      ],
    },
  ];

  /**
   * 根据玩家等级对怪物属性做缩放
   * 每级怪物强度提升约 8%
   */
  function scaleToLevel(template, heroLevel) {
    const scale = Math.pow(1.08, heroLevel - 1);
    const jitter = Utils.randFloat(0.9, 1.1);
    return {
      ...template,
      currentHp: Math.floor(template.baseHp * scale * jitter),
      maxHp:     Math.floor(template.baseHp * scale * jitter),
      atk:       Math.floor(template.baseAtk * scale * jitter),
      def:       Math.floor(template.baseDef * scale),
      spd:       template.baseSpd,
      expReward: Math.floor(template.expReward * Math.pow(1.05, heroLevel - 1)),
      goldMin:   Math.floor(template.goldReward.min * Math.pow(1.06, heroLevel - 1)),
      goldMax:   Math.floor(template.goldReward.max * Math.pow(1.06, heroLevel - 1)),
    };
  }

  /**
   * 按权重从指定区域随机选取一只普通怪物并生成实例
   */
  function spawn(zoneId) {
    const heroLevel = State.get().hero.level;
    const pool = TEMPLATES.filter(t => t.zone === zoneId && !t.isBoss);
    if (pool.length === 0) return null;

    const totalWeight = pool.reduce((sum, t) => sum + t.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen = pool[pool.length - 1];
    for (const t of pool) {
      r -= t.weight;
      if (r <= 0) { chosen = t; break; }
    }
    return scaleToLevel(chosen, heroLevel);
  }

  /**
   * 生成区域 Boss 实例
   */
  function spawnBoss(zoneId) {
    const heroLevel = State.get().hero.level;
    const boss = TEMPLATES.find(t => t.zone === zoneId && t.isBoss);
    if (!boss) return null;
    const inst = scaleToLevel(boss, heroLevel);
    // Boss 额外乘以 2 倍
    inst.currentHp *= 2;
    inst.maxHp     *= 2;
    inst.atk       = Math.floor(inst.atk * 1.5);
    return inst;
  }

  /**
   * 按 id 获取模板（用于掉落物品名等）
   */
  function getTemplate(monsterId) {
    return TEMPLATES.find(t => t.id === monsterId) || null;
  }

  /**
   * 获取某区域所有怪物模板（含 Boss）
   */
  function getByZone(zoneId) {
    return TEMPLATES.filter(t => t.zone === zoneId);
  }

  return { spawn, spawnBoss, getTemplate, getByZone, TEMPLATES };
})();

window.Monsters = Monsters;
