'use strict';
// Effets (vitesse, force, poison…), potions à boire ou à lancer, alambic et balise.
// - Alambic : 1 ingrédient (case du haut) + jusqu'à 3 fioles ; 12 s de distillation.
//   Fiole d'eau + verrue du Nether = potion étrange ; + ingrédient = potion ; + redstone = plus
//   longue ; + poudre lumineuse = niveau II ; + œil d'araignée fermenté = effet inverse ;
//   + poudre à canon = potion jetable.
// - Balise : posée sur une pyramide de blocs de fer, d'or, de diamant, d'émeraude ou de netherite
//   (1 à 4 étages), elle donne un effet aux joueurs proches ; clic droit pour le choisir.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });

  // Ordre figé : il fixe les identifiants des potions (ne jamais le changer, seulement ajouter).
  // [clé, nom (de …), couleur, icône, durée (s, 0 : instantané), version longue, version II]
  const EFFECTS = [
    ['speed', 'de vitesse', [124, 190, 220], '🏃', 180, true, true],
    ['slowness', 'de lenteur', [90, 108, 129], '🐌', 90, true, true],
    ['strength', 'de force', [180, 40, 40], '💪', 180, true, true],
    ['weakness', 'de faiblesse', [90, 96, 90], '🥀', 90, true, false],
    ['regeneration', 'de régénération', [215, 100, 180], '💗', 45, true, true],
    ['poison', 'de poison', [90, 160, 50], '☠', 45, true, true],
    ['healing', 'de soin', [248, 60, 60], '❤', 0, false, true],
    ['harming', 'de dégâts', [100, 20, 30], '💔', 0, false, true],
    ['fire_resistance', 'de résistance au feu', [230, 150, 60], '🔥', 180, true, false],
    ['water_breathing', 'de respiration aquatique', [60, 100, 200], '🫧', 180, true, false],
    ['invisibility', 'd’invisibilité', [180, 186, 200], '👻', 180, true, false],
    ['jump', 'de saut', [70, 240, 100], '🦘', 180, true, true],
    ['night_vision', 'de vision nocturne', [40, 50, 180], '👁', 180, true, false],
    ['slow_falling', 'de chute lente', [245, 215, 190], '🪶', 90, true, false],
    ['resistance', 'de résistance', [150, 80, 70], '🛡', 60, true, true],
    ['haste', 'de célérité', [225, 200, 70], '⛏', 180, true, true],
  ];
  const NAMES = {
    speed: 'Vitesse', slowness: 'Lenteur', strength: 'Force', weakness: 'Faiblesse', regeneration: 'Régénération', poison: 'Poison',
    healing: 'Soin instantané', harming: 'Dégâts instantanés', fire_resistance: 'Résistance au feu', water_breathing: 'Respiration aquatique',
    invisibility: 'Invisibilité', jump: 'Saut', night_vision: 'Vision nocturne', slow_falling: 'Chute lente', resistance: 'Résistance', haste: 'Célérité',
  };
  CM.EFFECTS = {};
  for (const [k, de, color, icon] of EFFECTS) CM.EFFECTS[k] = { key: k, name: NAMES[k], de, color, icon };

  // variantes : '' (normale), 'LONG', 'II'
  const VARIANTS = [];
  for (const [k, , , , dur, long, strong] of EFFECTS) {
    VARIANTS.push({ e: k, v: '', t: dur, l: 1 });
    if (long) VARIANTS.push({ e: k, v: 'LONG', t: Math.round((dur * 8) / 3), l: 1 });
    if (strong) VARIANTS.push({ e: k, v: 'II', t: dur ? Math.round(dur / 2) : 0, l: 2 });
  }
  const keyOf = (o, splash) => (splash ? 'SPLASH_' : 'POTION_') + o.e.toUpperCase() + (o.v ? '_' + o.v : '');
  CM.POTION_VARIANTS = VARIANTS;

  // ------------------------------------------------------- objets --
  M.items.push(function (K) {
    const { defItem } = K;
    const drink = { type: 'food', food: 0, sat: 0, always: true, stack: 1 };
    defItem(1371, 'GLASS_BOTTLE', { name: 'Fiole vide', tex: 'glass_bottle', stack: 16, type: 'bottle', desc: 'Clic droit sur de l’eau pour la remplir.' });
    defItem(1372, 'WATER_BOTTLE', Object.assign({ name: 'Fiole d’eau', tex: 'water_bottle', drinkBottle: true, desc: 'La base des potions (alambic).' }, drink));
    defItem(1373, 'AWKWARD_POTION', Object.assign({ name: 'Potion étrange', tex: 'potion_awkward', drinkBottle: true, desc: 'Fiole d’eau + verrue du Nether. Ajoute un ingrédient à l’alambic.' }, drink));
    defItem(1374, 'NETHER_WART', { name: 'Verrue du Nether', tex: 'nether_wart', desc: 'Un bloc de verrues du Nether en donne 9. Base des potions.' });
    defItem(1375, 'SPIDER_EYE', { name: 'Œil d’araignée', tex: 'spider_eye', type: 'food', food: 2, sat: 3.2, eatEffect: ['poison', 5, 1], desc: 'Empoisonne si on le mange. Potion de poison.' });
    defItem(1376, 'FERMENTED_SPIDER_EYE', { name: 'Œil d’araignée fermenté', tex: 'fermented_spider_eye', desc: 'Inverse l’effet d’une potion (vitesse → lenteur, soin → dégâts…).' });
    defItem(1377, 'GLISTERING_MELON', { name: 'Pastèque scintillante', tex: 'glistering_melon', desc: 'Potion de soin.' });
    defItem(1378, 'ARDENT_TEAR', { name: 'Larme d’ardent', tex: 'ardent_tear', desc: 'Laissée parfois par les Ombres ardentes. Potion de régénération.' });
    defItem(1379, 'RABBIT_FOOT', { name: 'Patte de lapin', tex: 'rabbit_foot', desc: 'Laissée parfois par les lapins. Potion de saut.' });
    defItem(1380, 'PUFFERFISH', { name: 'Poisson-globe', tex: 'pufferfish', type: 'food', food: 1, sat: 0.2, eatEffect: ['poison', 30, 2], desc: 'Se pêche. Potion de respiration aquatique (ne le mange pas !).' });
    let id = 1400;
    for (const o of VARIANTS) {
      const suf = o.v === 'LONG' ? ' (longue)' : o.v === 'II' ? ' II' : '';
      const de = CM.EFFECTS[o.e].de;
      defItem(id++, keyOf(o, false), Object.assign({ name: 'Potion ' + de + suf, tex: 'potion_' + o.e, drinkBottle: true, potion: o }, drink));
      defItem(id++, keyOf(o, true), { name: 'Potion jetable ' + de + suf, tex: 'splash_' + o.e, stack: 1, type: 'splash', potion: o });
    }
  });

  // -------------------------------------------------------- blocs --
  M.blocks.push(function (K) {
    const { nb } = K;
    nb('BREWING_STAND', {
      name: 'Alambic', render: 'model', opaque: false, solid: true, hardness: 0.5, tool: 'pickaxe', sound: 'metal', light: 1,
      model: [
        { b: [1, 0, 1, 15, 2, 15], t: 'brew_base' },
        { b: [7, 2, 7, 9, 14, 9], t: 'brew_rod' },
        { b: [2, 2, 7, 6, 8, 11], t: 'brew_bottle' },
        { b: [10, 2, 2, 14, 8, 6], t: 'brew_bottle' },
        { b: [10, 2, 10, 14, 8, 14], t: 'brew_bottle' },
        { b: [4, 11, 7, 12, 12, 9], t: 'brew_rod' },
      ],
      box: [1, 0, 1, 15, 14, 15], tex: 'brew_base', iconTex: 'brewing_stand_icon', chestTitle: 'Alambic — 1re case : ingrédient · 3 autres : fioles', container: true, slots: 4, track: 'brew',
    });
    nb('BEACON', {
      name: 'Balise', render: 'model', opaque: false, solid: true, hardness: 3, tool: 'pickaxe', sound: 'glass', light: 15,
      model: [
        { b: [0, 0, 0, 16, 3, 16], t: 'obsidian' },
        { b: [3, 3, 3, 13, 13, 13], t: 'beacon_core' },
        { b: [0, 3, 0, 2, 16, 2], t: 'beacon_glass' },
        { b: [14, 3, 0, 16, 16, 2], t: 'beacon_glass' },
        { b: [0, 3, 14, 2, 16, 16], t: 'beacon_glass' },
        { b: [14, 3, 14, 16, 16, 16], t: 'beacon_glass' },
        { b: [0, 14, 0, 16, 16, 16], t: 'beacon_glass' },
      ],
      tex: 'beacon_glass', iconTex: 'beacon_icon', track: 'beacon',
      use: (g, t) => {
        CM.Potions.cycleBeacon(g, t.x, t.y, t.z);
        return true;
      },
    });
  });

  // ----------------------------------------------------- recettes --
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.recipes.push(r(I.GLASS_BOTTLE, 3, [[B.GLASS, 3]], 'table', 'objets'));
    CM.recipes.push(r(B.BREWING_STAND, 1, [[B.COBBLE, 3], [I.SHADOW_ESSENCE, 1], [I.GLOWSTONE_DUST, 1]], 'table', 'objets'));
    CM.recipes.push(r(B.BEACON, 1, [[B.GLASS, 5], [B.OBSIDIAN, 3], [I.SKY_SHARD !== undefined ? I.SKY_SHARD : I.DIAMOND, 1]], 'table', 'objets'));
    CM.recipes.push(r(I.FERMENTED_SPIDER_EYE, 1, [[I.SPIDER_EYE, 1], [I.SUGAR, 1]], null, 'objets'));
    CM.recipes.push(r(I.GLISTERING_MELON, 1, [[I.MELON_SLICE, 1], [I.GOLD_INGOT, 1]], 'table', 'objets'));
    if (B.CRIMSON_LEAVES !== undefined) CM.recipes.push(r(I.NETHER_WART, 9, [[B.CRIMSON_LEAVES, 1]], null, 'objets'));
  });

  // ----------------------------------------------------- textures --
  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    // fiole : col, panse ronde ; liquide de la couleur de l'effet
    function bottle(d, r, liquid, splash) {
      clear(d);
      const G = [200, 220, 235], G2 = [150, 170, 190];
      for (let y = 1; y < 4; y++) for (let x = 6; x < 10; x++) put(d, x, y, y === 1 ? [140, 100, 60] : G);
      if (splash) for (let x = 5; x < 11; x++) put(d, x, 4, G2);
      for (let y = 4; y < 15; y++)
        for (let x = 2; x < 14; x++) {
          const k = Math.hypot((x - 7.5) / 5.6, (y - 9.6) / 5.4);
          if (k > 1) continue;
          const edge = k > 0.82;
          if (edge) put(d, x, y, G2);
          else if (liquid && y >= 7) put(d, x, y, vary(liquid, r, 12));
          else put(d, x, y, [220, 235, 245], 90);
        }
      put(d, 5, 8, [255, 255, 255]);
      put(d, 5, 9, [240, 250, 255]);
    }
    make('glass_bottle', (d, r) => bottle(d, r, null));
    make('water_bottle', (d, r) => bottle(d, r, [60, 110, 220]));
    make('potion_awkward', (d, r) => bottle(d, r, [70, 90, 200]));
    for (const [k, , c] of EFFECTS) {
      make('potion_' + k, (d, r) => bottle(d, r, c));
      make('splash_' + k, (d, r) => bottle(d, r, c, true));
    }
    const blob = (d, r, c, rx, ry, cx, cy) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot((x - cx) / rx, (y - cy) / ry) < 1) put(d, x, y, vary(c, r, 14));
    };
    make('nether_wart', (d, r) => {
      clear(d);
      for (const [cx, cy] of [[5, 6], [10, 5], [8, 10], [4, 11], [11, 11]]) blob(d, r, [150, 30, 40], 2.4, 2.4, cx, cy);
      for (let y = 12; y < 16; y++) put(d, 8, y, [110, 40, 30]);
    });
    make('spider_eye', (d, r) => {
      clear(d);
      blob(d, r, [140, 20, 30], 5.5, 5.2, 8, 8);
      blob(d, r, [220, 60, 70], 2.2, 2.2, 7, 7);
      put(d, 6, 6, [255, 200, 200]);
    });
    make('fermented_spider_eye', (d, r) => {
      clear(d);
      blob(d, r, [120, 70, 50], 5.5, 5.2, 8, 8);
      blob(d, r, [170, 60, 60], 2.2, 2.2, 7, 7);
      for (let k = 0; k < 8; k++) put(d, 3 + Math.floor(r() * 10), 3 + Math.floor(r() * 10), [220, 200, 120]);
    });
    make('glistering_melon', (d, r) => {
      clear(d);
      for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) if (y - 3 <= (x - 2) && x - 2 <= 11 - (y - 3) * 0.2) put(d, x, y, y > 11 ? [60, 150, 60] : vary([230, 70, 70], r, 12));
      for (let k = 0; k < 10; k++) put(d, 4 + Math.floor(r() * 9), 5 + Math.floor(r() * 6), [255, 225, 90]);
    });
    make('ardent_tear', (d, r) => {
      clear(d);
      for (let y = 2; y < 15; y++) for (let x = 3; x < 13; x++) if (Math.hypot((x - 8) / 4.2, (y - 10) / 4.2) < 1 || (y < 10 && Math.abs(x - 8) < (y - 2) * 0.5)) put(d, x, y, vary([255, 170, 70], r, 18));
      put(d, 7, 8, [255, 240, 200]);
    });
    make('rabbit_foot', (d, r) => {
      clear(d);
      for (let y = 2; y < 14; y++) for (let x = 5; x < 11; x++) if (x - 5 < 2 + y * 0.3) put(d, x, y, vary([170, 130, 90], r, 12));
      for (let x = 6; x < 13; x++) put(d, x, 13, [120, 90, 60]);
    });
    make('pufferfish', (d, r) => {
      clear(d);
      blob(d, r, [230, 200, 60], 5, 4.6, 8, 8);
      for (const [x, y] of [[2, 8], [14, 8], [8, 2], [8, 14], [4, 4], [12, 4], [4, 12], [12, 12]]) put(d, x, y, [200, 170, 40]);
      put(d, 10, 6, [20, 20, 20]);
    });
    make('brew_base', (d, r) => fill(d, r, [110, 110, 114], 12));
    make('brew_rod', (d, r) => fill(d, r, [230, 170, 60], 16));
    make('brew_bottle', (d, r) => {
      fill(d, r, [190, 215, 235], 6);
      for (let y = 8; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary([150, 80, 200], r, 12));
    });
    make('brewing_stand_icon', (d, r) => {
      clear(d);
      for (let x = 1; x < 15; x++) for (let y = 13; y < 15; y++) put(d, x, y, [110, 110, 114]);
      for (let y = 2; y < 13; y++) { put(d, 7, y, [230, 170, 60]); put(d, 8, y, [230, 170, 60]); }
      for (const cx of [3, 12]) for (let y = 8; y < 13; y++) for (let x = cx - 2; x <= cx + 1; x++) put(d, x, y, y > 9 ? [150, 80, 200] : [200, 220, 235]);
    });
    make('beacon_core', (d, r) => {
      fill(d, r, [110, 230, 230], 18);
      for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary([200, 255, 255], r, 10));
    });
    make('beacon_glass', (d, r) => {
      fill(d, r, [190, 225, 240], 6);
      for (let x = 0; x < 16; x++) { put(d, x, 0, [230, 245, 255]); put(d, 0, x, [230, 245, 255]); }
    });
    make('beacon_beam', (d, r) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [170, 255, 255 - Math.abs(x - 8) * 4]);
    });
    make('beacon_icon', (d, r) => {
      clear(d);
      for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) put(d, x, y, x === 1 || x === 14 || y === 1 ? [200, 230, 245] : y > 11 ? [40, 20, 60] : [150, 240, 240]);
      for (let y = 4; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, [230, 255, 255]);
    });
  });

  // ================================================== effets (joueur) ==
  const E = (CM.Effects = {
    list: EFFECTS.map((e) => e[0]),
    lv(p, k) {
      const e = p.effects && p.effects[k];
      return e && e.t > 0 ? e.l : 0;
    },
    // Ajoute un effet (t en secondes). Instantanés : soin et dégâts.
    add(p, k, t, l) {
      if (!CM.EFFECTS[k] || !p.alive) return;
      l = Math.max(1, Math.min(5, l | 0 || 1));
      if (k === 'healing') {
        p.health = Math.min(p.maxHealth, p.health + 4 * 2 ** (l - 1));
        return;
      }
      if (k === 'harming') {
        p.damage(6 * 2 ** (l - 1), null, null, 'La magie', true);
        return;
      }
      p.effects = p.effects || {};
      const cur = p.effects[k];
      if (!cur || cur.l < l || (cur.l === l && cur.t < t)) p.effects[k] = { t: Math.max(1, Math.min(3600, +t || 30)), l };
      if (k === 'fire_resistance') p.burning = 0;
      if (p.game.ui) p.game.ui.effDirty = true;
    },
    clear(p) {
      p.effects = {};
      if (p.game.ui) p.game.ui.effDirty = true;
    },
    // Chaque image : durée, régénération, poison.
    tick(p, dt) {
      const ef = p.effects;
      if (!ef) return;
      for (const k in ef) {
        const e = ef[k];
        e.t -= dt;
        if (e.t <= 0) {
          delete ef[k];
          if (p.game.ui) p.game.ui.effDirty = true;
        }
      }
      if (!p.alive) return;
      const rg = E.lv(p, 'regeneration');
      if (rg) {
        p.effRegT = (p.effRegT || 0) + dt;
        if (p.effRegT >= 2.5 / rg) {
          p.effRegT = 0;
          p.health = Math.min(p.maxHealth, p.health + 1);
        }
      }
      const po = E.lv(p, 'poison');
      if (po) {
        p.effPoiT = (p.effPoiT || 0) + dt;
        if (p.effPoiT >= 1.25 / po) {
          p.effPoiT = 0;
          if (p.health > 1) p.damage(1, null, null, 'Le poison', true);
        }
      }
      if (E.lv(p, 'water_breathing')) p.air = Math.max(p.air, 299);
      if (E.lv(p, 'fire_resistance')) p.burning = 0;
      if (E.lv(p, 'slow_falling') && p.vy < -3) {
        p.vy = -3;
        p.fallStart = p.y;
      }
    },
    speedMul(p) {
      return (1 + 0.2 * E.lv(p, 'speed')) * Math.max(0.1, 1 - 0.15 * E.lv(p, 'slowness'));
    },
    dmgBonus(p) {
      return 3 * E.lv(p, 'strength') - 4 * E.lv(p, 'weakness');
    },
    // Dégâts reçus : résistance, résistance au feu.
    reduce(p, n, cause) {
      if (E.lv(p, 'fire_resistance') && /feu|lave|magma|flamme|brûl/i.test(cause || '')) return 0;
      const rs = E.lv(p, 'resistance');
      return rs ? n * Math.max(0, 1 - 0.2 * rs) : n;
    },
    invisible(p) {
      return !!E.lv(p, 'invisibility');
    },
  });

  // ======================================================== alambic ==
  let RECIPES = null;
  function recipes() {
    if (RECIPES) return RECIPES;
    const I = CM.I, R = new Map();
    const add = (a, ing, b) => {
      if (a !== undefined && ing !== undefined && b !== undefined) R.set(a + ':' + ing, b);
    };
    add(I.WATER_BOTTLE, I.NETHER_WART, I.AWKWARD_POTION);
    const base = {
      SUGAR: 'speed', SHADOW_ESSENCE: 'strength', GLISTERING_MELON: 'healing', ARDENT_TEAR: 'regeneration', SPIDER_EYE: 'poison',
      MAGMA_CREAM: 'fire_resistance', PUFFERFISH: 'water_breathing', GOLDEN_CARROT: 'night_vision', RABBIT_FOOT: 'jump',
      FEATHER: 'slow_falling', AMETHYST_SHARD: 'resistance', EMERALD: 'haste',
    };
    const P = (e, v, splash) => I[(splash ? 'SPLASH_' : 'POTION_') + e.toUpperCase() + (v ? '_' + v : '')];
    for (const [ing, e] of Object.entries(base)) add(I.AWKWARD_POTION, I[ing], P(e, ''));
    const corrupt = { speed: 'slowness', jump: 'slowness', strength: 'weakness', healing: 'harming', poison: 'harming', night_vision: 'invisibility' };
    for (const o of VARIANTS) {
      const src = P(o.e, o.v);
      if (!o.v) {
        add(src, I.REDSTONE, P(o.e, 'LONG'));
        add(src, I.GLOWSTONE_DUST, P(o.e, 'II'));
      }
      const c = corrupt[o.e];
      if (c) add(src, I.FERMENTED_SPIDER_EYE, P(c, o.v) !== undefined ? P(c, o.v) : P(c, ''));
      // jetable (et ses variantes jetables)
      add(src, I.GUNPOWDER, P(o.e, o.v, true));
      if (!o.v) {
        add(P(o.e, '', true), I.REDSTONE, P(o.e, 'LONG', true));
        add(P(o.e, '', true), I.GLOWSTONE_DUST, P(o.e, 'II', true));
      }
    }
    return (RECIPES = R);
  }
  const BREW_TIME = 12;

  // ========================================================= balise ==
  const BEACON_FX = [['speed', 'haste'], ['resistance', 'jump'], ['strength'], ['regeneration']];
  const BASES = () => new Set(['IRON_BLOCK', 'GOLD_BLOCK', 'DIAMOND_BLOCK', 'EMERALD_BLOCK', 'NETHERITE_BLOCK'].map((k) => CM.B[k]).filter((id) => id !== undefined));
  let BASE_IDS = null;
  // Étages de pyramide sous la balise (0 à 4).
  function pyramid(w, x, y, z) {
    if (!BASE_IDS) BASE_IDS = BASES();
    let lv = 0;
    for (let L = 1; L <= 4; L++) {
      for (let dz = -L; dz <= L; dz++)
        for (let dx = -L; dx <= L; dx++) if (!BASE_IDS.has(w.get(x + dx, y - L, z + dz))) return lv;
      lv = L;
    }
    return lv;
  }
  const available = (lv) => BEACON_FX.slice(0, lv).flat();

  const P = (CM.Potions = {
    recipes,
    pyramid,
    brewResult(bottle, ing) {
      return recipes().get(bottle + ':' + ing);
    },
    // Hôte (ou solo) : distillation dans les alambics, balises. Chaque demi-seconde.
    tick(g, dt) {
      g.potT = (g.potT || 0) + dt;
      if (g.potT < 0.5) return;
      const step = g.potT;
      g.potT = 0;
      const sp = g.special;
      if (!sp) return;
      g.brewT = g.brewT || {};
      for (const k of sp.brew || []) {
        const [x, y, z] = k.split(',').map(Number);
        if (!g.world.loaded(x, z)) continue;
        const slots = g.chestAt(x, y, z), ing = slots[0], bk = g.bkey(x, y, z);
        let any = false;
        if (ing) for (let i = 1; i < 4; i++) if (slots[i] && P.brewResult(slots[i].id, ing.id) !== undefined) any = true;
        if (!any) {
          delete g.brewT[bk];
          continue;
        }
        const t = (g.brewT[bk] || 0) + step;
        const near = Math.hypot(g.player.x - x, g.player.z - z) < 16;
        if (near && Math.random() < 0.6) g.entities.burst(CM.Textures.layer.white, x + 0.5, y + 0.9, z + 0.5, 1, { speed: 0.3, grav: -1, life: 0.8, size: 0.04 });
        if (t < BREW_TIME) {
          g.brewT[bk] = t;
          continue;
        }
        delete g.brewT[bk];
        for (let i = 1; i < 4; i++) {
          const r = slots[i] && P.brewResult(slots[i].id, ing.id);
          if (r !== undefined && r !== null) slots[i] = { id: r, count: 1 };
        }
        ing.count--;
        if (ing.count <= 0) slots[0] = null;
        if (near) {
          CM.Audio.play('fizz');
          g.ui.toast('🧪 L’alambic a fini : ' + slots.slice(1).filter(Boolean).map((s) => CM.itemName(s.id)).join(', '), 'good', 'brew');
        }
        g.ui.dirtyInv = true;
        // un invité regarde dans l'alambic : il reçoit le résultat
        const by = g.net.isHost && g.net.locks.get(bk);
        if (by) g.net.sendTo(by, { t: 'cupd', k: bk, s: slots });
      }
      // balises : toutes les 4 s
      g.beaconT = (g.beaconT || 0) + step;
      if (g.beaconT >= 4) {
        g.beaconT = 0;
        for (const k of sp.beacon || []) {
          const [x, y, z] = k.split(',').map(Number);
          if (!g.world.loaded(x, z)) continue;
          const lv = pyramid(g.world, x, y, z);
          if (!lv) continue;
          const fx = P.beaconEffect(g, x, y, z, lv), range = 10 + 10 * lv;
          for (const q of g.net.simPlayers()) {
            if (q.alive === false || Math.hypot(q.x - x - 0.5, q.z - z - 0.5) > range) continue;
            if (q === g.player) E.add(q, fx, 11, 1);
            else g.net.sendTo(q.pid, { t: 'act', a: { a: 'eff', k: fx, t: 11, l: 1 } });
          }
        }
      }
    },
    beaconEffect(g, x, y, z, lv) {
      const av = available(lv), cur = (g.beaconFx || {})[g.bkey(x, y, z)];
      return av.includes(cur) ? cur : av[0];
    },
    // Clic droit sur une balise : effet suivant.
    cycleBeacon(g, x, y, z) {
      const lv = pyramid(g.world, x, y, z);
      if (!lv) {
        g.ui.toast('La balise doit être posée sur une pyramide de blocs de fer, d’or, de diamant, d’émeraude ou de netherite (3 × 3 au moins)', 'info', 'beacon');
        return;
      }
      const av = available(lv), cur = P.beaconEffect(g, x, y, z, lv), next = av[(av.indexOf(cur) + 1) % av.length];
      P.setBeacon(g, g.bkey(x, y, z), next);
      if (g.net.isClient) g.net.send({ t: 'bfx', k: g.bkey(x, y, z), e: next });
      else if (g.net.isHost) g.net.broadcast({ t: 'bfx', k: g.bkey(x, y, z), e: next });
      g.ui.toast('🔆 Balise (' + lv + ' étage' + (lv > 1 ? 's' : '') + ', portée ' + (10 + 10 * lv) + ' blocs) : ' + CM.EFFECTS[next].icon + ' ' + CM.EFFECTS[next].name, 'good', 'beacon');
      CM.Audio.play('enchant');
    },
    setBeacon(g, k, e) {
      if (!CM.EFFECTS[e]) return;
      g.beaconFx = g.beaconFx || {};
      g.beaconFx[String(k).slice(0, 40)] = e;
    },
    // Rayons des balises actives (visibles de loin).
    render(g, batch, cam) {
      const sp = g.special;
      if (!sp || !sp.beacon || !sp.beacon.size) return;
      g.beamCache = g.beamCache || {};
      const L = CM.Textures.layer.beacon_beam;
      for (const k of sp.beacon) {
        const [x, y, z] = k.split(',').map(Number);
        if (Math.hypot(x - cam[0], z - cam[2]) > 160) continue;
        let c = g.beamCache[k];
        if (!c || g.clock - c.t > 2) c = g.beamCache[k] = { t: g.clock, lv: g.world.loaded(x, z) ? pyramid(g.world, x, y, z) : 0 };
        if (!c.lv) continue;
        const cx = x + 0.5, cz = z + 0.5, h = 180, wd = 0.22 + 0.04 * Math.sin(g.clock * 3);
        for (const [ax, az] of [[wd, 0], [0, wd]]) batch.quad([[cx - ax, y + 1, cz - az], [cx + ax, y + 1, cz + az], [cx + ax, y + 1 + h, cz + az], [cx - ax, y + 1 + h, cz - az]], [[0, 1], [1, 1], [1, 0], [0, 0]], L, 1, 0, 1, 1);
      }
    },
    // Potion jetable qui se brise : effet autour (4 blocs).
    splash(e, x, y, z, id) {
      const g = e.game, info = CM.itemInfo(id);
      if (!info || !info.potion) return;
      const o = info.potion;
      e.burst(CM.Textures.layer[info.tex], x, y + 0.3, z, 18, { speed: 3, grav: 4, life: 0.8, size: 0.07 });
      if (Math.hypot(g.player.x - x, g.player.z - z) < 32) CM.Audio.play('break', { mat: 'glass' });
      for (const q of g.net.simPlayers()) {
        const d = Math.hypot(q.x - x, q.y + 0.9 - y, q.z - z);
        if (q.alive === false || d > 4) continue;
        const k = 1 - d / 5, t = Math.max(1, Math.round(o.t * k));
        if (q === g.player) E.add(q, o.e, t, o.l);
        else g.net.sendTo(q.pid, { t: 'act', a: { a: 'eff', k: o.e, t, l: o.l } });
      }
      for (const m of e.mobs) {
        if (m.dead || Math.hypot(m.x - x, m.y + m.h / 2 - y, m.z - z) > 4) continue;
        if (o.e === 'harming') e.hurtMob(m, 6 * 2 ** (o.l - 1), [x, z]);
        else if (o.e === 'healing') m.hp = Math.min(m.maxHp, m.hp + 4 * 2 ** (o.l - 1));
        else if (o.e === 'poison') e.hurtMob(m, 3 * o.l, null, true);
      }
    },
  });
})();
