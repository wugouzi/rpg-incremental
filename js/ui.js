// ui.js — DOM 渲染与事件绑定

const UI = (() => {
  // 当前激活的标签页
  let activeTab = "stats";
  // 战斗日志缓冲（最多 120 条）
  const LOG_MAX = 120;
  const logLines = [];
  // 日志过滤模式："all" | "combat" | "loot"
  let _logFilter = "all";
  // 侧面板脏标记：true 时下一个 tick 才重建 DOM，避免每帧重建导致 hover 闪烁
  let _sidePanelDirty = false;
  // 鼠标是否在侧面板内：hover 期间暂停重建，彻底消除按钮闪烁
  let _sidePanelHovered = false;
  // 技能分组折叠状态 { groupClass: true=折叠 }
  const _skillFold = {};

  // 品质缩写标签 { tag, color }
  const RARITY_TAG = {
    common:    { tag: "",        color: ""         },
    rare:      { tag: "[RARE]",  color: "cyan"     },
    epic:      { tag: "[EPIC]",  color: "yellow"   },
    legendary: { tag: "[LGND]",  color: "red"      },
  };

  // ─────────────────────────────────────────
  // 初始化（绑定所有静态事件）
  // ─────────────────────────────────────────

  function init() {
    // 顶部按钮
    document.getElementById("btn-save").addEventListener("click", () => Save.save());
    document.getElementById("btn-load").addEventListener("click", () => { Save.load(); refresh(); refreshSidePanel(); });
    document.getElementById("btn-reset").addEventListener("click", () => Save.reset());
    document.getElementById("btn-prestige").addEventListener("click", () => Prestige.doPrestige());

    // 战斗按钮
    document.getElementById("btn-attack").addEventListener("click", () => Combat.manualAttack());
    document.getElementById("btn-auto").addEventListener("click", () => Combat.toggleAutoFight());
    document.getElementById("btn-stop").addEventListener("click", () => Combat.stopFight());
    document.getElementById("btn-rest").addEventListener("click", () => {
      if (Combat.isResting) {
        Combat.stopRest();
      } else {
        Combat.startRest();
      }
    });
    document.getElementById("btn-boss").addEventListener("click", () => Combat.challengeBoss());

    // 日志过滤栏
    document.getElementById("log-filter-bar").addEventListener("click", e => {
      const btn = e.target.closest(".log-filter");
      if (btn) setLogFilter(btn.dataset.filter);
    });

    // 标签栏
    ["stats", "inventory", "shop", "skills", "zones"].forEach(tab => {
      document.getElementById(`tab-${tab}`).addEventListener("click", () => switchTab(tab));
    });

    // 侧面板事件委托（动态按钮）
    const sp = document.getElementById("side-panel");
    sp.addEventListener("click",      onSidePanelClick);
    // 鼠标进入/离开侧面板时更新 hover 标志（控制 refreshSidePanelIfDirty）
    sp.addEventListener("mouseenter", () => { _sidePanelHovered = true;  });
    sp.addEventListener("mouseleave", () => {
      _sidePanelHovered = false;
      // 离开后若有积压的脏标记，立即刷新
      if (_sidePanelDirty) refreshSidePanel();
    });
  }

  // ─────────────────────────────────────────
  // 战斗日志
  // ─────────────────────────────────────────

  const COLOR_MAP = {
    green:  "#a6e3a1",
    red:    "#f38ba8",
    yellow: "#f9e2af",
    cyan:   "#89dceb",
    white:  "#cad3f5",
    gray:   "#6e738d",
  };

  // ── 日志分类规则 ──────────────────────────
  // combat: 攻击/受伤/技能伤害
  // loot:   掉落/金币/经验/材料/升级
  // system: 死亡/区域/状态变化（不可隐藏，始终显示）
  function _categorize(message) {
    const m = message;
    // loot: 金币、经验、掉落、材料、升级、出售
    if (/\+\d+.*exp|\+\d+g|\[DROP\]|\[MAT\]|\[OFFLINE\]|Level up|Sold |Purchased|gold/i.test(m)) return "loot";
    // combat: 伤害数字、技能名称前缀、状态标签
    if (/dmg|\bHP\b|\bDMG\b|\[PYRO\]|\[CRYO\]|\[STORM\]|\[WARD\]|\[WARP\]|\[HEAT\]|\[LIGHTNING\]|\[ICE\]|\[BLINK\]|miss|crit|burn|freeze|frozen|bleed|poison|Regen|Explosion|Chain|Fireball|Frost|Strike|slash|Arrow|Shot|Rapid|Barrage|Cauterize|Phantom/i.test(m)) return "combat";
    // 其他归 loot（重要系统信息）
    return "loot";
  }

  function addLog(message, color, category) {
    color = color || "green";
    // 若未指定 category，自动推断
    const cat = category || _categorize(message);
    logLines.push({ message, color, cat });
    if (logLines.length > LOG_MAX) logLines.shift();
    _flushLog();
  }

  function _isVisible(cat) {
    if (_logFilter === "all") return true;
    return cat === _logFilter;
  }

  function _flushLog() {
    const el = document.getElementById("combat-log");
    if (!el) return;
    const latest = logLines[logLines.length - 1];
    const div = document.createElement("div");
    div.textContent = latest.message;
    div.style.color = COLOR_MAP[latest.color] || COLOR_MAP.green;
    div.dataset.cat = latest.cat;
    if (!_isVisible(latest.cat)) div.style.display = "none";
    el.appendChild(div);
    // 超出上限时删除最旧
    while (el.children.length > LOG_MAX) {
      el.removeChild(el.firstChild);
    }
    el.scrollTop = el.scrollHeight;
  }

  // 切换日志过滤器，重新显示/隐藏已有行
  function setLogFilter(filter) {
    _logFilter = filter;
    // 更新过滤栏高亮
    document.querySelectorAll(".log-filter").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.filter === filter);
    });
    // 重新刷新所有已渲染行的可见性
    const el = document.getElementById("combat-log");
    if (!el) return;
    Array.from(el.children).forEach(div => {
      const cat = div.dataset.cat || "loot";
      div.style.display = _isVisible(cat) ? "" : "none";
    });
    el.scrollTop = el.scrollHeight;
  }

  // ─────────────────────────────────────────
  // 主刷新（每 tick 调用，更新左侧 & 中间）
  // ─────────────────────────────────────────

  function refresh() {
    renderHero();
    renderCombat();
  }

  function renderHero() {
    const state = State.get();
    const h = state.hero;
    // 同步 AUTO 按钮文字（读档/初始化后也保持正确）
    const btnAuto = document.getElementById("btn-auto");
    if (btnAuto) btnAuto.textContent = `[AUTO: ${state.autoFight ? "ON " : "OFF"}]`;
    const maxHp = State.getTotalMaxHp();
    const maxMp = State.getTotalMaxMp();

    const hpr = State.getTotalHpr();
    const mpr = State.getTotalMpr();
    const isResting = window.Combat && Combat.isResting;

    // 同步 REST 按钮状态
    const btnRest = document.getElementById("btn-rest");
    if (btnRest) {
      const inCombat = !!State.get().currentMonster;
      if (isResting) {
        btnRest.textContent = "[RESTING...]";
        btnRest.disabled = false;
      } else {
        btnRest.textContent = "[REST]";
        btnRest.disabled = inCombat;
      }
    }

    const lines = [
      `  NAME  : ${h.name}`,
      `  CLASS : ${h.class ? h.class.toUpperCase() : "(none - reach Lv.10)"}`,
      `  LEVEL : ${h.level}`,
      `  EXP   : ${Utils.formatBar(h.exp, h.expToNext, 10)} ${Utils.formatNum(h.exp)}/${Utils.formatNum(h.expToNext)}`,
      `  `,
      `  HP    : ${Utils.formatBar(h.hp, maxHp, 10)} ${h.hp}/${maxHp}${isResting ? " 💤" : ""}`,
      `  MP    : ${Utils.formatBar(h.mp, maxMp, 10)} ${h.mp}/${maxMp}`,
      `  `,
      `  ATK   : ${State.getTotalAtk()}`,
      `  DEF   : ${State.getTotalDef()}`,
      `  SPD   : ${State.getTotalSpd().toFixed(2)}`,
      `  CRIT  : ${(State.getTotalCrit() * 100).toFixed(1)}%`,
      `  HPR   : ${hpr.toFixed(1)}/s`,
      `  MPR   : ${mpr.toFixed(1)}/s`,
      `  `,
      `  GOLD  : ${Utils.formatNum(h.gold)}g`,
      `  GEMS  : ${h.gems}`,
    ];

    if (h.prestigeCount > 0) {
      lines.push(`  `);
      lines.push(`  PRESTIGE : x${h.prestigeCount}`);
      lines.push(`  ATK BONUS: x${h.prestigeBonus.toFixed(2)}`);
    }

    document.getElementById("hero-panel").textContent = lines.join("\n");
  }

  function renderCombat() {
    const state = State.get();
    const zone = Zones.getZone(state.currentZone);
    const monster = state.currentMonster;

    const header = `  ZONE: ${zone ? zone.name : "Unknown"}`;
    const autoStr = `  [AUTO: ${state.autoFight ? "ON " : "OFF"}]`;

    let monsterLine;
    if (monster && monster.currentHp > 0) {
      const elemTag = monster.element ? ` [${monster.element.toUpperCase()}]` : "";
      monsterLine = `  MOB : ${monster.name}${elemTag}\n  HP  : ${Utils.formatBar(monster.currentHp, monster.maxHp, 12)} ${monster.currentHp}/${monster.maxHp}`;
    } else {
      monsterLine = `  MOB : -- idle --`;
    }

    const heroHp = state.hero.hp;
    const heroMaxHp = State.getTotalMaxHp();
    const heroHpLine = `  YOU : ${Utils.formatBar(heroHp, heroMaxHp, 12)} ${heroHp}/${heroMaxHp}`;

    const lines = [header, autoStr, "  ", monsterLine, heroHpLine];

    // ── 法师专精状态 ──────────────────────────────
    if (state.mage && state.hero.class === "mage") {
      const m = state.mage;
      if (m.spec === "storm") {
        const cap = 5 + (Skills.getEffects().chargeCapBonus || 0);
        const filled = m.charge;
        const chargeBar = "[" + "█".repeat(filled) + "░".repeat(cap - filled) + "]";
        lines.push(`  ⚡ CHG : ${chargeBar} ${filled}/${cap}${filled >= cap ? " FULL!" : ""}`);
      } else if (m.spec === "pyro") {
        const burnCap = 5 + (Skills.getEffects().burnCapBonus || 0);
        const filled = m.burnStack;
        const burnBar = "[" + "█".repeat(filled) + "░".repeat(burnCap - filled) + "]";
        lines.push(`  🔥 BURN: ${burnBar} ${filled}/${burnCap}`);
      } else if (m.spec === "cryo") {
        if (m.frozen) {
          const secLeft = (m.freezeTimer / 1000).toFixed(1);
          lines.push(`  ❄️  FROZEN! ${secLeft}s remaining`);
        } else {
          const filled = m.chillStack;
          const chillBar = "[" + "▪".repeat(filled) + "░".repeat(5 - filled) + "]";
          lines.push(`  ❄️  CHILL: ${chillBar} ${filled}/5${filled >= 5 ? " → FREEZE!" : ""}`);
        }
      }

      // 各种 buff 状态指示
      const buffParts = [];
      if (m.blinkImmune)           buffParts.push(`BLINK(${(m.blinkImmuneTimer/1000).toFixed(1)}s)`);
      if (m.arcaneWardHp > 0)      buffParts.push(`WARD:${m.arcaneWardHp}`);
      if (m.counterspellActive)    buffParts.push(`COUNTER(${(m.counterspellTimer/1000).toFixed(1)}s)`);
      if (m.timeWarpActive)        buffParts.push(`WARP(${(m.timeWarpTimer/1000).toFixed(1)}s)`);
      if (m.spellEchoCount > 0)    buffParts.push(`ECHO:${m.spellEchoCount}/3`);
      if (m.leyLineReady)          buffParts.push("LEY:READY");
      if (buffParts.length > 0) {
        lines.push(`  ✦ ${buffParts.join(" | ")}`);
      }
    }

    // 使用逐行着色渲染（heatShield/lightningRod 等在 combat 内部管理，不在 state 上）
    const el = document.getElementById("combat-status");
    el.innerHTML = "";
    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.whiteSpace = "pre";

    lines.forEach((line, i) => {
      const span = document.createElement("span");
      span.textContent = line + (i < lines.length - 1 ? "\n" : "");

      if (line.includes("⚡") || line.includes("CHG")) {
        span.style.color = line.includes("FULL") ? COLOR_MAP.yellow : COLOR_MAP.cyan;
      } else if (line.includes("🔥") || line.includes("BURN")) {
        span.style.color = COLOR_MAP.red;
      } else if (line.includes("❄️") || line.includes("CHILL") || line.includes("FROZEN")) {
        span.style.color = line.includes("FROZEN") ? COLOR_MAP.yellow : COLOR_MAP.cyan;
      } else if (line.includes("✦")) {
        span.style.color = COLOR_MAP.yellow;
      } else {
        span.style.color = "";
      }

      pre.appendChild(span);
    });

    el.appendChild(pre);
  }

  // ─────────────────────────────────────────
  // 标签页切换
  // ─────────────────────────────────────────

  function switchTab(tabName) {
    activeTab = tabName;
    // 更新标签栏选中样式
    ["stats", "inventory", "shop", "skills", "zones"].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.classList.toggle("active", t === tabName);
    });
    refreshSidePanel();
  }

  function refreshSidePanel() {
    _sidePanelDirty = false;
    switch (activeTab) {
      case "stats":     renderStats();     break;
      case "inventory": renderInventory(); break;
      case "shop":      renderShop();      break;
      case "skills":    renderSkills();    break;
      case "zones":     renderZones();     break;
    }
  }

  /**
   * 标记侧面板需要刷新（由逻辑模块调用，避免直接重建 DOM）
   * tick 里用 refreshSidePanelIfDirty() 延迟到下一帧统一处理
   */
  function markSidePanelDirty() {
    _sidePanelDirty = true;
  }

  /**
   * 仅在脏时刷新侧面板（供 main.js tick 调用）
   * 鼠标在侧面板内时暂停重建，离开时再补刷，彻底消除按钮 hover 闪烁
   */
  function refreshSidePanelIfDirty() {
    if (!_sidePanelDirty) return;
    if (_sidePanelHovered) return; // 鼠标在面板内，推迟到 mouseleave 时刷新
    refreshSidePanel();
  }

  // ─────────────────────────────────────────
  // Stats 面板
  // ─────────────────────────────────────────

  function renderStats() {
    const state = State.get();
    const h = state.hero;
    const eq = State.getEquipBonus();
    const pInfo = Prestige.getInfo();

    const el = document.getElementById("side-panel");

    const res = State.getTotalResistance();
    const dropB = State.getTotalDropBonus();
    const goldB = State.getTotalGoldBonus();
    const expB  = State.getTotalExpBonus();

    // 抗性显示辅助（非零时高亮标注）
    function resStr(val) {
      if (val <= 0)  return "  0%";
      if (val >= 75) return `${val}% (MAX)`;
      return `${val}%`;
    }

    const lines = [
      "  ── CHARACTER STATS ──────────────────",
      `  ATK    : ${State.getTotalAtk()} (base ${h.baseAtk} + equip ${Math.floor(eq.atk)})`,
      `  DEF    : ${State.getTotalDef()} (base ${h.baseDef} + equip ${Math.floor(eq.def)})`,
      `  Max HP : ${State.getTotalMaxHp()} (base ${h.baseMaxHp} + equip ${Math.floor(eq.hp)})`,
      `  Max MP : ${State.getTotalMaxMp()} (base ${h.baseMaxMp} + equip ${Math.floor(eq.mp)})`,
      `  SPD    : ${State.getTotalSpd().toFixed(2)} (atk every ${(State.getAtkInterval()/1000).toFixed(2)}s)`,
      `  CRIT   : ${(State.getTotalCrit()*100).toFixed(1)}%`,
      "",
      "  ── RESISTANCES ──────────────────────",
      `  Fire      : ${resStr(res.fire)}`,
      `  Ice       : ${resStr(res.ice)}`,
      `  Lightning : ${resStr(res.lightning)}`,
      `  Poison    : ${resStr(res.poison)}`,
      `  Physical  : ${resStr(res.phys)}`,
      "",
      "  ── BONUSES ──────────────────────────",
      `  Drop Rate  : +${dropB}%`,
      `  Gold Bonus : +${goldB}%`,
      `  EXP Bonus  : +${expB}%`,
      "",
      "  ── PRESTIGE ───────────────────────",
      `  Prestige Count : ${pInfo.count}`,
      `  ATK Multiplier : x${pInfo.bonus.toFixed(2)}`,
      `  Gems           : ${pInfo.gems}`,
      pInfo.canDo ? "  [Prestige available! Click PRESTIGE above]" : `  Next prestige: Defeat the Dark Lord`,
      "",
      "  ── STATISTICS ─────────────────────",
      `  Total Kills  : ${Utils.formatNum(state.stats.totalKills)}`,
      `  Total Dmg    : ${Utils.formatNum(state.stats.totalDmgDealt)}`,
      `  Gold Earned  : ${Utils.formatNum(state.stats.totalGoldEarned)}`,
      `  Bosses Slain : ${state.stats.bossesDefeated}`,
    ];

    el.innerHTML = "";
    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.whiteSpace = "pre";

    // 逐行渲染，对抗性/加成数值非零时着色
    lines.forEach((line, i) => {
      const span = document.createElement("span");
      span.textContent = line + (i < lines.length - 1 ? "\n" : "");

      // 区块标题用白色
      if (line.includes("──")) {
        span.style.color = COLOR_MAP.white;
      }
      // 抗性行：非零时用青色，零时用灰色
      else if (line.match(/^\s+(Fire|Ice|Lightning|Poison|Physical)\s*:/)) {
        span.style.color = line.includes("  0%") ? COLOR_MAP.gray : COLOR_MAP.cyan;
      }
      // 加成行：非零时用黄色，零时用灰色
      else if (line.match(/^\s+(Drop Rate|Gold Bonus|EXP Bonus)\s*:/)) {
        span.style.color = line.includes("+0%") ? COLOR_MAP.gray : COLOR_MAP.yellow;
      }
      // Prestige 行
      else if (line.includes("Prestige available")) {
        span.style.color = COLOR_MAP.yellow;
      }
      // 普通属性行用默认色
      else {
        span.style.color = "";
      }

      pre.appendChild(span);
    });

    el.appendChild(pre);
  }

  // ─────────────────────────────────────────
  // Inventory 面板
  // ─────────────────────────────────────────

  function renderInventory() {
    const state = State.get();
    const el = document.getElementById("side-panel");
    el.innerHTML = "";

    // 装备槽
    const slots = ["weapon", "helmet", "chest", "legs", "ring", "neck"];
    const slotLabels = { weapon: "Weapon", helmet: "Helmet", chest: "Chest", legs: "Legs", ring: "Ring", neck: "Neck" };

    const header = document.createElement("div");
    header.textContent = "  ── EQUIPPED ────────────────────────────";
    header.style.color = COLOR_MAP.white;
    el.appendChild(header);

    slots.forEach(slot => {
      const item = state.equipment[slot];
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "baseline";
      row.style.gap = "4px";

      if (item) {
        const rt = RARITY_TAG[item.rarity] || RARITY_TAG.common;
        const label = document.createElement("span");
        label.textContent = `  ${slotLabels[slot].padEnd(8)}: ${item.name}${item.enhanceLevel > 0 ? ` +${item.enhanceLevel}` : ""}${rt.tag ? " " + rt.tag : ""}`;
        label.style.color = COLOR_MAP[Equipment.getRarityColor(item.rarity)] || COLOR_MAP.white;
        label.style.flex = "1";
        row.appendChild(label);

        const btn = document.createElement("span");
        btn.textContent = "[Unequip]";
        btn.className = "btn";
        btn.dataset.action = "unequip";
        btn.dataset.slot = slot;
        row.appendChild(btn);

        // 只在名称标签上绑定 tooltip（不含按钮区域）
        _bindTooltip(label, item, null);
      } else {
        const label = document.createElement("span");
        label.textContent = `  ${slotLabels[slot].padEnd(8)}: -- empty --`;
        label.style.color = COLOR_MAP.gray;
        row.appendChild(label);
      }
      el.appendChild(row);
    });

    // 背包
    const invHeader = document.createElement("div");
    invHeader.style.marginTop = "8px";
    invHeader.textContent = `  ── BACKPACK (${state.inventory.length}/20) ──────────────`;
    invHeader.style.color = COLOR_MAP.white;
    el.appendChild(invHeader);

    if (state.inventory.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "  (empty)";
      empty.style.color = COLOR_MAP.gray;
      el.appendChild(empty);
    } else {
      state.inventory.forEach((item, idx) => {
        const itemColor = COLOR_MAP[Equipment.getRarityColor(item.rarity)] || COLOR_MAP.white;
        const rt = RARITY_TAG[item.rarity] || RARITY_TAG.common;

        // 主行：物品名 + 品质标签 + 操作按钮（属性移到 tooltip）
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "baseline";
        row.style.gap = "4px";

        const label = document.createElement("span");
        label.textContent = `  ${String(idx+1).padStart(2)}. ${item.name}${item.enhanceLevel > 0 ? ` +${item.enhanceLevel}` : ""}${rt.tag ? " " + rt.tag : ""}`;
        label.style.color = itemColor;
        label.style.flex = "1";
        row.appendChild(label);

        const btnEquip = document.createElement("span");
        btnEquip.textContent = "[Equip]";
        btnEquip.className = "btn";
        btnEquip.dataset.action = "equip";
        btnEquip.dataset.iid = item.instanceId;
        row.appendChild(btnEquip);

        const btnEnh = document.createElement("span");
        const enhCost = Math.floor(100 * Math.pow(item.enhanceLevel + 1, 1.5));
        btnEnh.textContent = `[+${enhCost}g]`;
        btnEnh.className = item.enhanceLevel >= 10 ? "btn btn-disabled" : "btn";
        btnEnh.dataset.action = "enhance";
        btnEnh.dataset.iid = item.instanceId;
        row.appendChild(btnEnh);

        const btnSell = document.createElement("span");
        btnSell.textContent = `[Sell ${item.sellPrice}g]`;
        btnSell.className = "btn btn-sell";
        btnSell.dataset.action = "sell";
        btnSell.dataset.iid = item.instanceId;
        row.appendChild(btnSell);

        // 只在名称标签上绑定 tooltip（不含按钮区域，避免卖掉后 tooltip 残留）
        const equipped = state.equipment[item.slot] || null;
        _bindTooltip(label, item, equipped);

        el.appendChild(row);
      });
    }
  }

  function _itemStatStr(item) {
    const s = item.stats || {};
    const parts = [];
    if (s.atk)  parts.push(`+${s.atk}ATK`);
    if (s.def)  parts.push(`+${s.def}DEF`);
    if (s.hp)   parts.push(`+${s.hp}HP`);
    if (s.mp)   parts.push(`+${s.mp}MP`);
    if (s.spd)  parts.push(`+${s.spd.toFixed ? s.spd.toFixed(2) : s.spd}SPD`);
    if (s.crit) parts.push(`+${(s.crit*100).toFixed(0)}%CRIT`);
    return parts.length ? `(${parts.join(" ")})` : "";
  }

  /**
   * 将单个词缀格式化为显示字符串
   */
  function _affixLabel(affix) {
    const { stat, value, name } = affix;
    let valStr;
    if (stat === "spd" || stat === "crit") {
      valStr = stat === "crit" ? `+${(value*100).toFixed(0)}%CRIT` : `+${value.toFixed(2)}SPD`;
    } else if (["fireRes","iceRes","lightningRes","poisonRes","physRes"].includes(stat)) {
      const short = { fireRes:"Fire", iceRes:"Ice", lightningRes:"Ltng", poisonRes:"Psn", physRes:"Phys" };
      valStr = `+${value}%${short[stat]}Res`;
    } else if (stat === "dropBonus") {
      valStr = `+${value}%Drop`;
    } else if (stat === "goldBonus") {
      valStr = `+${value}%Gold`;
    } else if (stat === "expBonus") {
      valStr = `+${value}%EXP`;
    } else {
      const short = { atk:"ATK", def:"DEF", hp:"HP", mp:"MP" };
      valStr = `+${value}${short[stat] || stat}`;
    }
    return `[${name}: ${valStr}]`;
  }

  // ─────────────────────────────────────────
  // 装备 Tooltip 系统
  // ─────────────────────────────────────────

  const STAT_LABELS = {
    atk: "ATK", def: "DEF", hp: "HP", mp: "MP",
    spd: "SPD", crit: "CRIT",
    hpr: "HPR", mpr: "MPR",
    fireRes: "Fire Res", iceRes: "Ice Res",
    lightningRes: "Ltng Res", poisonRes: "Psn Res", physRes: "Phys Res",
    dropBonus: "Drop%", goldBonus: "Gold%", expBonus: "EXP%",
  };

  const RARITY_COLORS = {
    common: "", rare: "cyan", epic: "yellow", legendary: "red",
  };

  /** 格式化单个属性值用于 tooltip */
  function _fmtStatVal(key, val) {
    if (key === "crit")  return `+${(val * 100).toFixed(1)}%`;
    if (key === "spd")   return `+${val.toFixed(2)}`;
    if (["fireRes","iceRes","lightningRes","poisonRes","physRes","dropBonus","goldBonus","expBonus"].includes(key))
      return `+${val}%`;
    if (key === "hpr" || key === "mpr") return `+${val.toFixed(1)}/s`;
    return `+${val}`;
  }

  /** 构建 tooltip 的 innerHTML，支持可选的"与 compared 对比"模式 */
  function _buildTooltipHTML(item, compared) {
    const rt = RARITY_TAG[item.rarity] || RARITY_TAG.common;
    const rarityColor = RARITY_COLORS[item.rarity] || "";
    const rarityStr   = rt.tag ? ` ${rt.tag}` : "";
    const enhance     = item.enhanceLevel > 0 ? ` +${item.enhanceLevel}` : "";

    let html = "";
    // 标题行
    html += `<div class="tt-name">${item.name}${enhance}`;
    if (rt.tag) html += ` <span style="color:${COLOR_MAP[rarityColor] || ''}">${rt.tag}</span>`;
    html += `</div>`;
    html += `<div class="tt-divider">────────────────────</div>`;

    // 基础属性
    const base = item.stats || {};
    const STAT_ORDER = ["atk","def","hp","mp","spd","crit","hpr","mpr"];
    let hasBase = false;
    STAT_ORDER.forEach(k => {
      if (!base[k]) return;
      hasBase = true;
      const label = STAT_LABELS[k] || k;
      const valStr = _fmtStatVal(k, base[k]);
      html += `<div class="tt-stat">  ${label.padEnd(8)}: ${valStr}</div>`;
    });
    // 其他基础属性（抗性等）
    Object.keys(base).forEach(k => {
      if (STAT_ORDER.includes(k) || !base[k]) return;
      const label = STAT_LABELS[k] || k;
      html += `<div class="tt-stat">  ${label.padEnd(8)}: ${_fmtStatVal(k, base[k])}</div>`;
    });

    // 词缀（显示词缀名 + 属性类型 + 数值）
    if (item.affixes && item.affixes.length > 0) {
      html += `<div class="tt-divider">────────────────────</div>`;
      item.affixes.forEach(a => {
        const statLabel = STAT_LABELS[a.stat] || a.stat;
        html += `<div class="tt-affix">  ✦ ${a.name} <span style="color:#6e738d">[${statLabel}]</span>: ${_fmtStatVal(a.stat, a.value)}</div>`;
      });
    }

    // 与已装备物品对比
    if (compared) {
      const myTotal  = Equipment.getItemTotalStats(item);
      const cmpTotal = Equipment.getItemTotalStats(compared);
      const allKeys  = new Set([...Object.keys(myTotal), ...Object.keys(cmpTotal)]);
      let hasDiff = false;
      let diffHTML = "";
      // 按固定顺序排列 diff 行（主属性在前，抗性在后）
      const DIFF_ORDER = ["atk","def","hp","mp","spd","crit","hpr","mpr",
        "fireRes","iceRes","lightningRes","poisonRes","physRes",
        "dropBonus","goldBonus","expBonus"];
      const sortedKeys = [
        ...DIFF_ORDER.filter(k => allKeys.has(k)),
        ...[...allKeys].filter(k => !DIFF_ORDER.includes(k)),
      ];
      const PCT_STATS = new Set(["fireRes","iceRes","lightningRes","poisonRes","physRes","dropBonus","goldBonus","expBonus"]);
      sortedKeys.forEach(k => {
        const mine = myTotal[k] || 0;
        const theirs = cmpTotal[k] || 0;
        const diff = mine - theirs;
        if (Math.abs(diff) < 0.001) return;
        hasDiff = true;
        const label = STAT_LABELS[k] || k;
        const cls = diff > 0 ? "tt-up" : "tt-down";
        const sign = diff > 0 ? "+" : "";
        let diffStr;
        if (k === "crit")           diffStr = `${sign}${(diff * 100).toFixed(1)}%`;
        else if (k === "spd")       diffStr = `${sign}${diff.toFixed(2)}`;
        else if (k === "hpr" || k === "mpr") diffStr = `${sign}${diff.toFixed(1)}/s`;
        else if (PCT_STATS.has(k))  diffStr = `${sign}${Math.round(diff)}%`;
        else                        diffStr = `${sign}${Math.round(diff)}`;
        diffHTML += `<div class="${cls}">  ${label.padEnd(8)}: ${diffStr}</div>`;
      });
      if (hasDiff) {
        html += `<div class="tt-divider">── vs equipped ─────</div>`;
        html += diffHTML;
      } else {
        html += `<div class="tt-divider">── vs equipped ─────</div>`;
        html += `<div class="tt-same">  (same stats)</div>`;
      }
    }

    return html;
  }

  /** 将 tooltip 定位到鼠标旁边并显示 */
  function _showTooltip(e, item, compared) {
    const tt = document.getElementById("item-tooltip");
    if (!tt) return;
    tt.innerHTML = _buildTooltipHTML(item, compared);
    tt.classList.add("visible");
    _posTooltip(e);
  }

  function _posTooltip(e) {
    const tt = document.getElementById("item-tooltip");
    if (!tt || !tt.classList.contains("visible")) return;
    const pad = 14;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    // 防止超出右侧/底部
    const rect = tt.getBoundingClientRect();
    if (x + rect.width  > vw) x = e.clientX - rect.width  - pad;
    if (y + rect.height > vh) y = e.clientY - rect.height - pad;
    tt.style.left = x + "px";
    tt.style.top  = y + "px";
  }

  function _hideTooltip() {
    const tt = document.getElementById("item-tooltip");
    if (tt) tt.classList.remove("visible");
  }

  /** 为 DOM 元素绑定 tooltip 事件 */
  function _bindTooltip(el, item, compared) {
    el.addEventListener("mouseenter", e => _showTooltip(e, item, compared));
    el.addEventListener("mousemove",  e => _posTooltip(e));
    el.addEventListener("mouseleave", _hideTooltip);
  }

  // ─────────────────────────────────────────
  // 技能 Tooltip
  // ─────────────────────────────────────────

  /** 将 effect 对象转成可读文本行列表 */
  function _skillEffectLines(effect) {
    if (!effect) return [];
    const lines = [];
    const fmt = {
      atkMult:          v => `ATK ×${v.toFixed(2)}`,
      defMult:          v => `DEF ×${v.toFixed(2)}`,
      hpMult:           v => `Max HP ×${v.toFixed(2)}`,
      mpMult:           v => `Max MP ×${v.toFixed(2)}`,
      spdAdd:           v => `SPD +${v.toFixed(2)}`,
      critAdd:          v => `CRIT +${(v*100).toFixed(1)}%`,
      regenOnKill:      v => `HP regen ${(v*100).toFixed(0)}% on kill`,
      deathPenaltyMult: v => `Death gold penalty ×${v.toFixed(2)}`,
      dmgMult:          v => `Damage ×${v.toFixed(2)}`,
      cd:               v => `Cooldown: ${(v/1000).toFixed(1)}s`,
      mpCost:           v => v > 0 ? `MP Cost: ${v}` : null,
      hprAdd:           v => `HPR +${v.toFixed(1)}/s`,
      mprAdd:           v => `MPR +${v.toFixed(1)}/s`,
      dodgeChance:      v => `Dodge +${(v*100).toFixed(0)}%`,
      poisonChance:     v => `Poison chance +${(v*100).toFixed(0)}%`,
      critDmgMult:      v => `Crit DMG ×${v.toFixed(2)}`,
      goldBonus:        v => `Gold +${v}%`,
      expBonus:         v => `EXP +${v}%`,
      dropBonus:        v => `Drop rate +${v}%`,
      fireRes:          v => `Fire Res +${v}%`,
      iceRes:           v => `Ice Res +${v}%`,
      lightningRes:     v => `Lightning Res +${v}%`,
      poisonRes:        v => `Poison Res +${v}%`,
      physRes:          v => `Physical Res +${v}%`,
      chargeCapBonus:   v => `Charge cap +${v}`,
      burnCapBonus:     v => `Burn stack cap +${v}`,
      permafrost:       v => v ? "Freeze lasts longer (Permafrost)" : null,
      leyLine:          v => v ? "Every 5th hit triggers Ley Line burst" : null,
      spellEcho:        v => v ? "After using skill, 30% chance to echo" : null,
      blinkOnFrozen:    v => v ? "Blink to safety when Frozen" : null,
    };
    Object.keys(effect).forEach(k => {
      if (effect[k] === undefined || effect[k] === null) return;
      if (fmt[k]) {
        const str = fmt[k](effect[k]);
        if (str) lines.push(str);
      } else {
        // 未知字段：直接显示 key=value
        lines.push(`${k}: ${effect[k]}`);
      }
    });
    return lines;
  }

  /** 构建技能 tooltip HTML */
  function _buildSkillTooltipHTML(skill, learned) {
    const typeLabel = skill.type === "active" ? "[ ACTIVE ]" : "[ PASSIVE ]";
    const typeColor = skill.type === "active" ? COLOR_MAP.yellow : COLOR_MAP.cyan;

    let html = "";
    html += `<div class="tt-name">${skill.name}</div>`;
    html += `<div style="color:${typeColor};font-size:0.85em">${typeLabel}</div>`;
    html += `<div class="tt-divider">────────────────────</div>`;

    html += `<div class="tt-stat">  Unlock Lv : ${skill.unlockLevel}</div>`;
    html += `<div class="tt-stat">  Cost      : ${skill.cost.gold}g</div>`;

    if (skill.requires) {
      const req = Skills.getTemplate ? Skills.getTemplate(skill.requires) : null;
      const reqName = req ? req.name : skill.requires;
      html += `<div class="tt-stat">  Requires  : ${reqName}</div>`;
    }

    html += `<div class="tt-divider">────────────────────</div>`;
    html += `<div class="tt-stat" style="white-space:normal;max-width:220px">  ${skill.description}</div>`;

    const effectLines = _skillEffectLines(skill.effect);
    if (effectLines.length > 0) {
      html += `<div class="tt-divider">── Effects ─────────</div>`;
      effectLines.forEach(line => {
        html += `<div class="tt-affix">  ✦ ${line}</div>`;
      });
    }

    if (learned) {
      html += `<div class="tt-divider">────────────────────</div>`;
      html += `<div style="color:${COLOR_MAP.cyan}">  ✓ LEARNED</div>`;
    }

    return html;
  }

  /** 为技能行绑定 tooltip */
  function _bindSkillTooltip(el, skill, learned) {
    el.addEventListener("mouseenter", e => {
      const tt = document.getElementById("item-tooltip");
      if (!tt) return;
      tt.innerHTML = _buildSkillTooltipHTML(skill, learned);
      tt.classList.add("visible");
      _posTooltip(e);
    });
    el.addEventListener("mousemove",  e => _posTooltip(e));
    el.addEventListener("mouseleave", _hideTooltip);
  }

  // ─────────────────────────────────────────
  // Zone Tooltip
  // ─────────────────────────────────────────

  const ELEM_COLOR = {
    fire: "#f38ba8", ice: "#89dceb", lightning: "#f9e2af",
    poison: "#a6e3a1", phys: "#cad3f5",
  };

  /** 构建 Zone tooltip HTML */
  function _buildZoneTooltipHTML(zone) {
    const unlocked = Zones.isUnlocked(zone.id);
    const bossSlain = Zones.isBossDefeated(zone.id);

    let html = "";
    html += `<div class="tt-name">${zone.name}</div>`;
    html += `<div class="tt-divider">────────────────────</div>`;
    html += `<div class="tt-stat" style="white-space:normal;max-width:220px">  ${zone.description}</div>`;

    if (!unlocked) {
      html += `<div class="tt-divider">────────────────────</div>`;
      const reqZone = zone.unlockCondition ? Zones.getZone(zone.unlockCondition) : null;
      html += `<div style="color:${COLOR_MAP.red}">  🔒 Defeat ${reqZone ? reqZone.bossName : "???"} to unlock</div>`;
      return html;
    }

    // 普通怪物信息
    const mobs = (window.Monsters ? Monsters.TEMPLATES : []).filter(m => m.zone === zone.id && !m.isBoss);
    if (mobs.length > 0) {
      html += `<div class="tt-divider">── Monsters ────────</div>`;
      mobs.forEach(m => {
        const elemColor = ELEM_COLOR[m.element] || COLOR_MAP.white;
        html += `<div class="tt-stat">  <span style="color:${elemColor}">▸ ${m.name}</span>`;
        html += ` <span style="color:${COLOR_MAP.gray}">[${m.element || "phys"}]</span></div>`;
        html += `<div style="color:${COLOR_MAP.gray};padding-left:12px">HP:${m.baseHp} ATK:${m.baseAtk} DEF:${m.baseDef} EXP:${m.expReward}</div>`;
      });
    }

    // Boss 信息
    const boss = (window.Monsters ? Monsters.TEMPLATES : []).find(m => m.zone === zone.id && m.isBoss);
    if (boss) {
      html += `<div class="tt-divider">── Boss ────────────</div>`;
      const bossElemColor = ELEM_COLOR[boss.element] || COLOR_MAP.white;
      const bossStatus = bossSlain
        ? `<span style="color:${COLOR_MAP.yellow}"> ✓ SLAIN</span>`
        : `<span style="color:${COLOR_MAP.red}"> ⚠ ACTIVE</span>`;
      html += `<div class="tt-stat">  <span style="color:${bossElemColor}">☠ ${boss.name}</span>${bossStatus}</div>`;
      html += `<div style="color:${COLOR_MAP.gray};padding-left:12px">HP:${boss.baseHp} ATK:${boss.baseAtk} EXP:${boss.expReward}</div>`;
    }

    return html;
  }

  /** 为 Zone 行绑定 tooltip */
  function _bindZoneTooltip(el, zone) {
    el.addEventListener("mouseenter", e => {
      const tt = document.getElementById("item-tooltip");
      if (!tt) return;
      tt.innerHTML = _buildZoneTooltipHTML(zone);
      tt.classList.add("visible");
      _posTooltip(e);
    });
    el.addEventListener("mousemove",  e => _posTooltip(e));
    el.addEventListener("mouseleave", _hideTooltip);
  }

  // ─────────────────────────────────────────
  // Shop 面板
  // ─────────────────────────────────────────

  function renderShop() {
    const state = State.get();
    const el = document.getElementById("side-panel");
    el.innerHTML = "";

    const header = document.createElement("div");
    header.textContent = `  ── SHOP (Gold: ${Utils.formatNum(state.hero.gold)}g) ──────────`;
    header.style.color = COLOR_MAP.white;
    el.appendChild(header);

    const items = Equipment.getShopItems();
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "  No items available.";
      empty.style.color = COLOR_MAP.gray;
      el.appendChild(empty);
      return;
    }

    // 按 slot 分组
    const slotOrder = ["weapon", "helmet", "chest", "legs", "ring", "neck"];
    slotOrder.forEach(slot => {
      const group = items.filter(i => i.slot === slot);
      if (group.length === 0) return;

      const groupHeader = document.createElement("div");
      groupHeader.textContent = `  ── ${slot.toUpperCase()} `;
      groupHeader.style.color = COLOR_MAP.gray;
      el.appendChild(groupHeader);

      group.forEach(tpl => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "baseline";
        row.style.gap = "4px";

        const statStr = _itemStatStr(tpl);
        const canAfford = state.hero.gold >= tpl.buyPrice;

        const label = document.createElement("span");
        label.textContent = `  ${tpl.name} ${statStr}`;
        label.style.color = COLOR_MAP[Equipment.getRarityColor(tpl.rarity)] || COLOR_MAP.white;
        label.style.flex = "1";
        row.appendChild(label);

        const priceLabel = document.createElement("span");
        priceLabel.textContent = `${tpl.buyPrice}g`;
        priceLabel.style.color = canAfford ? COLOR_MAP.yellow : COLOR_MAP.gray;
        row.appendChild(priceLabel);

        const btn = document.createElement("span");
        btn.textContent = "[Buy]";
        btn.className = canAfford ? "btn" : "btn btn-disabled";
        btn.dataset.action = "buy";
        btn.dataset.itemId = tpl.id;
        row.appendChild(btn);

        el.appendChild(row);
      });
    });
  }

  // ─────────────────────────────────────────
  // Skills 面板
  // ─────────────────────────────────────────

  function renderSkills() {
    const state = State.get();
    const el = document.getElementById("side-panel");
    el.innerHTML = "";

    // 职业选择
    if (!state.classChosen) {
      const classHeader = document.createElement("div");
      classHeader.textContent = state.hero.level >= 10
        ? "  ── CHOOSE YOUR CLASS ──────────────────"
        : `  ── Reach Lv.10 to choose class (Current: Lv.${state.hero.level}) ──`;
      classHeader.style.color = COLOR_MAP.white;
      el.appendChild(classHeader);

      if (state.hero.level >= 10) {
        [
          { id: "warrior", desc: "High ATK/DEF. Regen on kill. Cleave skills." },
          { id: "mage",    desc: "Extreme ATK. Fireball/Frost Nova. MP system." },
          { id: "ranger",  desc: "High SPD. Crit focus. Poison. Dodge." },
        ].forEach(cls => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.gap = "8px";
          row.style.marginTop = "4px";

          const btn = document.createElement("span");
          btn.textContent = `  [Choose ${cls.id.toUpperCase()}]`;
          btn.className = "btn";
          btn.dataset.action = "chooseClass";
          btn.dataset.class = cls.id;
          row.appendChild(btn);

          const desc = document.createElement("span");
          desc.textContent = cls.desc;
          desc.style.color = COLOR_MAP.gray;
          row.appendChild(desc);

          el.appendChild(row);
        });
      }
      el.appendChild(document.createElement("br"));
    }

    // ── 法师元素专精选择 UI ────────────────────
    if (state.hero.class === "mage" && state.classChosen && state.mage && !state.mage.specChosen) {
      const specHeader = document.createElement("div");
      specHeader.textContent = state.hero.level >= 15
        ? "  ── CHOOSE ELEMENT SPEC (Lv.15) ────────────"
        : `  ── Reach Lv.15 to choose Element Spec (Current: Lv.${state.hero.level}) ──`;
      specHeader.style.color = COLOR_MAP.yellow;
      el.appendChild(specHeader);

      if (state.hero.level >= 15) {
        const specOptions = [
          { id: "spec_pyro",  label: "PYROMANCER",  icon: "🔥", desc: "Burn stacks → DoT + Explosion. Kill trigger explodes all stacks." },
          { id: "spec_cryo",  label: "CRYOMANCER",  icon: "❄️",  desc: "Chill stacks → slow monster. 5 stacks = Freeze (monster stops)." },
          { id: "spec_storm", label: "STORMCALLER", icon: "⚡", desc: "Build Charge stacks → huge skill bonus. Max charge = overcharge burst." },
        ];
        specOptions.forEach(opt => {
          const check = Skills.canUnlock(opt.id);
          const row = document.createElement("div");
          row.style.marginBottom = "6px";

          const btn = document.createElement("span");
          btn.textContent = `  [Choose ${opt.label}]`;
          btn.className = check.ok ? "btn" : "btn btn-disabled";
          if (check.ok) {
            btn.dataset.action = "learnSkill";
            btn.dataset.skillId = opt.id;
          }
          row.appendChild(btn);

          const descSpan = document.createElement("span");
          descSpan.textContent = ` ${opt.icon} ${opt.desc}`;
          descSpan.style.color = check.ok ? COLOR_MAP.gray : COLOR_MAP.gray;
          row.appendChild(descSpan);

          if (!check.ok) {
            const reasonSpan = document.createElement("span");
            reasonSpan.textContent = ` [${check.reason}]`;
            reasonSpan.style.color = COLOR_MAP.red;
            row.appendChild(reasonSpan);
          }

          el.appendChild(row);
        });
      }
      el.appendChild(document.createElement("br"));
    }

    // 若已选专精，显示当前专精标签
    if (state.mage && state.mage.spec) {
      const specNames = { pyro: "🔥 PYROMANCER", cryo: "❄️  CRYOMANCER", storm: "⚡ STORMCALLER" };
      const specLabel = document.createElement("div");
      specLabel.textContent = `  ── SPEC: ${specNames[state.mage.spec] || state.mage.spec} ──────────────────`;
      specLabel.style.color = COLOR_MAP.yellow;
      el.appendChild(specLabel);
    }

    // 技能树展示
    const groups = [
      { label: "COMMON SKILLS",  class: "common"  },
      { label: "WARRIOR SKILLS", class: "warrior" },
      { label: "MAGE SKILLS",    class: "mage"    },
      { label: "RANGER SKILLS",  class: "ranger"  },
    ];

    // 渲染单条技能行（供大组和子组共用）
    function _renderSkillRow(skill, indent) {
      const check = Skills.canUnlock(skill.id);
      const learned = !!state.unlockedSkills[skill.id];
      const pad = indent || "  ";
      const row = document.createElement("div");
      row.style.marginBottom = "4px";

      if (learned) {
        const learnedSpan = document.createElement("span");
        learnedSpan.style.color = COLOR_MAP.cyan;
        learnedSpan.textContent = `${pad}[LEARNED] ${skill.name}`;
        // tooltip 绑定在已学习的技能名上
        _bindSkillTooltip(learnedSpan, skill, true);
        row.appendChild(learnedSpan);
        const descSpan2 = document.createElement("span");
        descSpan2.style.color = COLOR_MAP.gray;
        descSpan2.textContent = ` ${skill.description}`;
        row.appendChild(descSpan2);
      } else {
        const canLearn = check.ok;
        const nameColor = canLearn ? COLOR_MAP.white : COLOR_MAP.gray;

        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${pad}${skill.name} (Lv.${skill.unlockLevel}, ${skill.cost.gold}g)`;
        nameSpan.style.color = nameColor;
        // tooltip 绑定在技能名 span 上（不含 Learn 按钮）
        _bindSkillTooltip(nameSpan, skill, false);
        row.appendChild(nameSpan);

        const descSpan = document.createElement("span");
        descSpan.textContent = ` - ${skill.description}`;
        descSpan.style.color = COLOR_MAP.gray;
        row.appendChild(descSpan);

        row.appendChild(document.createElement("br"));

        const btn = document.createElement("span");
        if (canLearn) {
          btn.textContent = `${pad}  [Learn]`;
          btn.className = "btn";
          btn.dataset.action = "learnSkill";
          btn.dataset.skillId = skill.id;
        } else {
          btn.textContent = `${pad}  [${check.reason}]`;
          btn.style.color = COLOR_MAP.gray;
        }
        row.appendChild(btn);
      }
      return row;
    }

    // 渲染子折叠组（法师专精子分组使用）
    function _renderSubGroup(el, key, label, skills) {
      if (skills.length === 0) return;
      if (_skillFold[key] === undefined) _skillFold[key] = true;
      const isFolded = !!_skillFold[key];
      const learnedCount = skills.filter(s => state.unlockedSkills[s.id]).length;
      const arrow = isFolded ? "▶" : "▼";

      const subHeader = document.createElement("div");
      subHeader.style.cursor = "pointer";
      subHeader.style.userSelect = "none";
      subHeader.style.color = COLOR_MAP.yellow;
      subHeader.style.marginTop = "4px";
      subHeader.style.marginLeft = "4px";
      subHeader.dataset.action = "toggleFold";
      subHeader.dataset.foldGroup = key;
      subHeader.textContent = `    ${arrow} ${label} (${learnedCount}/${skills.length})`;
      el.appendChild(subHeader);

      if (!isFolded) {
        skills.forEach(skill => el.appendChild(_renderSkillRow(skill, "      ")));
        el.appendChild(document.createElement("br"));
      }
    }

    groups.forEach(g => {
      const skillsInGroup = Skills.getByClass(g.class).filter(s => s.class === g.class);
      if (skillsInGroup.length === 0) return;

      // 默认全部折叠（首次进入 skills 面板时，未设置过的分组初始化为 true）
      if (_skillFold[g.class] === undefined) _skillFold[g.class] = true;

      const isFolded = !!_skillFold[g.class];
      const learnedCount = skillsInGroup.filter(s => state.unlockedSkills[s.id]).length;
      const arrow = isFolded ? "▶" : "▼";

      // 可点击的分组标题行
      const groupHeader = document.createElement("div");
      groupHeader.style.cursor = "pointer";
      groupHeader.style.userSelect = "none";
      groupHeader.style.color = COLOR_MAP.white;
      groupHeader.style.marginTop = "4px";
      groupHeader.dataset.action = "toggleFold";
      groupHeader.dataset.foldGroup = g.class;
      groupHeader.textContent =
        `  ${arrow} ── ${g.label} (${learnedCount}/${skillsInGroup.length}) ─`;
      el.appendChild(groupHeader);

      if (isFolded) return; // 折叠时只渲染标题

      // ── 法师：内部分为 Base / Spec-Gate / 各专精 子组 ──
      if (g.class === "mage") {
        const currentSpec = state.mage && state.mage.spec;
        const specLabels = { pyro: "🔥 PYROMANCER", cryo: "❄️  CRYOMANCER", storm: "⚡ STORMCALLER" };

        // Base Skills（无 spec 字段、无 specGate 字段）
        const baseSkills = skillsInGroup.filter(s => !s.spec && !s.specGate);
        _renderSubGroup(el, "mage_base", "BASE SKILLS", baseSkills);

        // Spec-Gate Skills（specGate=true，选择专精用的门控技能）
        const specGateSkills = skillsInGroup.filter(s => s.specGate);
        _renderSubGroup(el, "mage_spec_gate", "── CHOOSE SPEC ──", specGateSkills);

        // 专精子组（仅在已选对应专精时显示）
        ["pyro", "cryo", "storm"].forEach(specId => {
          const specSkills = skillsInGroup.filter(s => s.spec === specId);
          if (specSkills.length === 0) return; // 未选该专精时 getByClass 已过滤掉
          const subKey = `mage_${specId}`;
          const subLabel = specLabels[specId] || specId.toUpperCase();
          _renderSubGroup(el, subKey, subLabel, specSkills);
        });

        el.appendChild(document.createElement("br"));
        return;
      }

      // 其他职业：扁平列表
      skillsInGroup.forEach(skill => el.appendChild(_renderSkillRow(skill, "  ")));
      el.appendChild(document.createElement("br"));
    });
  }

  // ─────────────────────────────────────────
  // Zones 面板
  // ─────────────────────────────────────────

  function renderZones() {
    const state = State.get();
    const el = document.getElementById("side-panel");
    el.innerHTML = "";

    const header = document.createElement("div");
    header.textContent = "  ── ZONES ───────────────────────────────";
    header.style.color = COLOR_MAP.white;
    el.appendChild(header);

    Zones.getAll().forEach(zone => {
      const unlocked = Zones.isUnlocked(zone.id);
      const bossSlain = Zones.isBossDefeated(zone.id);
      const isCurrent = state.currentZone === zone.id;

      const row = document.createElement("div");
      row.style.marginBottom = "8px";
      row.style.borderLeft = isCurrent ? `2px solid ${COLOR_MAP.green}` : "2px solid transparent";
      row.style.paddingLeft = "6px";

      const nameColor = unlocked ? COLOR_MAP.white : COLOR_MAP.gray;
      const status = !unlocked
        ? "[LOCKED]"
        : bossSlain
          ? "[BOSS SLAIN]"
          : isCurrent
            ? "[ACTIVE]"
            : "[AVAILABLE]";
      const statusColor = !unlocked ? COLOR_MAP.gray : bossSlain ? COLOR_MAP.yellow : isCurrent ? COLOR_MAP.green : COLOR_MAP.cyan;

      const nameLine = document.createElement("div");
      const nameSpanZone = document.createElement("span");
      nameSpanZone.style.color = nameColor;
      nameSpanZone.textContent = zone.name;
      // tooltip 绑在区域名称上
      _bindZoneTooltip(nameSpanZone, zone);
      const statusSpan = document.createElement("span");
      statusSpan.style.color = statusColor;
      statusSpan.textContent = `  ${status}`;
      nameLine.appendChild(nameSpanZone);
      nameLine.appendChild(statusSpan);
      row.appendChild(nameLine);

      const descLine = document.createElement("div");
      descLine.textContent = `  ${zone.description}`;
      descLine.style.color = COLOR_MAP.gray;
      row.appendChild(descLine);

      if (unlocked) {
        const btnRow = document.createElement("div");
        btnRow.style.marginTop = "2px";

        if (!isCurrent) {
          const btnEnter = document.createElement("span");
          btnEnter.textContent = "  [Enter Zone]";
          btnEnter.className = "btn";
          btnEnter.dataset.action = "enterZone";
          btnEnter.dataset.zone = zone.id;
          btnRow.appendChild(btnEnter);
        }

        if (!bossSlain) {
          const btnBoss = document.createElement("span");
          btnBoss.textContent = "  [Challenge Boss]";
          btnBoss.className = isCurrent ? "btn btn-boss" : "btn btn-disabled";
          if (isCurrent) {
            btnBoss.dataset.action = "challengeBoss";
          }
          btnRow.appendChild(btnBoss);
        } else {
          const slainNote = document.createElement("span");
          slainNote.textContent = `  Boss: ${zone.bossName} ✓`;
          slainNote.style.color = COLOR_MAP.yellow;
          btnRow.appendChild(slainNote);
        }

        row.appendChild(btnRow);
      }

      el.appendChild(row);
    });
  }

  // ─────────────────────────────────────────
  // 侧面板事件委托
  // ─────────────────────────────────────────

  function onSidePanelClick(e) {
    const target = e.target;
    if (!target.dataset || !target.dataset.action) return;
    if (target.classList.contains("btn-disabled")) return;

    const action = target.dataset.action;
    const state = State.get();

    switch (action) {
      case "equip": {
        const item = state.inventory.find(i => String(i.instanceId) === target.dataset.iid);
        if (item) Equipment.equip(item);
        break;
      }
      case "unequip": {
        Equipment.unequip(target.dataset.slot);
        break;
      }
      case "enhance": {
        const item = state.inventory.find(i => String(i.instanceId) === target.dataset.iid);
        if (item) Equipment.enhance(item);
        break;
      }
      case "sell": {
        const item = state.inventory.find(i => String(i.instanceId) === target.dataset.iid);
        if (item) Equipment.sell(item);
        break;
      }
      case "buy": {
        Equipment.buy(target.dataset.itemId);
        break;
      }
      case "learnSkill": {
        Skills.unlock(target.dataset.skillId);
        break;
      }
      case "chooseClass": {
        Skills.chooseClass(target.dataset.class);
        break;
      }
      case "enterZone": {
        Zones.enterZone(target.dataset.zone);
        break;
      }
      case "challengeBoss": {
        Combat.challengeBoss();
        break;
      }
      case "toggleFold": {
        const group = target.dataset.foldGroup;
        _skillFold[group] = !_skillFold[group];
        break;
      }
    }
    // 点击任何操作后立即刷新侧面板（绕过 hover 阻断，确保无延迟响应）
    // 同时隐藏 tooltip（防止点击后 tooltip 残留）
    _hideTooltip();
    refreshSidePanel();
  }

  return {
    init,
    refresh,
    refreshSidePanel,
    refreshSidePanelIfDirty,
    markSidePanelDirty,
    switchTab,
    addLog,
    setLogFilter,
    renderHero,
    renderCombat,
    COLOR_MAP,
  };
})();

window.UI = UI;
