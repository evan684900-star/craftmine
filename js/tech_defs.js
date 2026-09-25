'use strict';
// Extension « Électricité » (inspirée du mod Create, en plus simple) : nouveaux minerais,
// câbles, générateurs, batteries, lampes, néons et machines. Blocs, objets, recettes et textures.
// Les blocs existent dans tous les mondes (identifiants fixes), mais minerais et recettes
// n'apparaissent que si l'extension a été cochée à la création du monde.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const OPP = CM.OPP;
  // Extension active dans la partie en cours ?
  CM.extOn = (name) => {
    const g = CM.game, s = g && g.settings;
    return !!(s && s.ext && s.ext[name]);
  };
  const EXT = 'tech';
  // Couleurs des néons : [clé, nom, couleur de la lumière, teinture]
  const NEONS = [
    ['RED', 'rouge', [255, 64, 72], 'RED'],
    ['ORANGE', 'orange', [255, 150, 40], 'ORANGE'],
    ['YELLOW', 'jaune', [255, 226, 70], 'YELLOW'],
    ['GREEN', 'vert', [80, 255, 110], 'LIME'],
    ['CYAN', 'cyan', [60, 236, 255], 'CYAN'],
    ['BLUE', 'bleu', [80, 110, 255], 'BLUE'],
    ['PURPLE', 'violet', [186, 84, 255], 'PURPLE'],
    ['PINK', 'rose', [255, 110, 200], 'PINK'],
  ];
  CM.NEONS = NEONS;

  // ------------------------------------------------------------ blocs ----
  M.blocks.push(function (K) {
    const { nb, tx } = K;
    const fam = (name, kind, fields, make, opts) => CM.rsFamily(K, name, kind, fields, make, opts);
    const keyFn = (pre) => (st, base) => (base ? pre : pre + '_' + Object.values(st).map((v) => (v === true ? 1 : v === false ? 0 : v)).join('_'));
    const T = (o) => Object.assign({ ext: EXT }, o);
    const cube = (f, front, back, side, top, bottom) => {
      const out = [];
      for (let i = 0; i < 6; i++) out[i] = i === f ? front : i === OPP[f] ? back : i === 2 ? top : i === 3 ? bottom : side;
      return out;
    };

    // Minerais (zinc, étain, bauxite pour l'aluminium, lithium tout au fond)
    const ore = (key, name, base, c, hi, tier) =>
      nb(key, T({ name, tex: tx(key.toLowerCase(), { type: 'ore', base, c, hi, n: 6 }), hardness: base === 'deepstone' ? 4.5 : 3, tool: 'pickaxe', tier, ore: true }));
    ore('ZINC_ORE', 'Minerai de zinc', 'stone', [150, 178, 186], [220, 238, 244], 2);
    ore('DEEPSLATE_ZINC_ORE', 'Minerai de zinc des abîmes', 'deepstone', [150, 178, 186], [220, 238, 244], 2);
    ore('TIN_ORE', "Minerai d'étain", 'stone', [206, 206, 190], [250, 250, 238], 2);
    ore('DEEPSLATE_TIN_ORE', "Minerai d'étain des abîmes", 'deepstone', [206, 206, 190], [250, 250, 238], 2);
    ore('BAUXITE_ORE', 'Bauxite (aluminium)', 'stone', [196, 100, 56], [238, 158, 104], 2);
    ore('DEEPSLATE_LITHIUM_ORE', 'Minerai de lithium des abîmes', 'deepstone', [222, 140, 222], [255, 212, 252], 3);
    // Blocs de métal et carters
    const metal = (key, name, c) => nb(key, T({ name, tex: tx(key.toLowerCase(), { type: 'metal', c }), hardness: 5, tool: 'pickaxe', tier: 2, sound: 'metal' }));
    metal('ZINC_BLOCK', 'Bloc de zinc', [168, 190, 196]);
    metal('TIN_BLOCK', "Bloc d'étain", [210, 212, 202]);
    metal('ALUMINIUM_BLOCK', "Bloc d'aluminium", [206, 212, 222]);
    metal('BRASS_BLOCK', 'Bloc de laiton', [214, 168, 72]);
    nb('BRASS_CASING', T({ name: 'Carter en laiton', tex: 'brass_casing', hardness: 3, tool: 'pickaxe', tier: 1, sound: 'metal' }));
    nb('ALU_CASING', T({ name: 'Carter en aluminium', tex: 'alu_casing', hardness: 3, tool: 'pickaxe', tier: 1, sound: 'metal' }));
    nb('ENGINEER_TABLE', T({ name: "Établi d'ingénieur", tex: { top: 'engineer_top', bottom: 'alu_casing', side: 'engineer_side', front: 'engineer_side' }, hardness: 2.5, tool: 'axe', sound: 'metal', station: 'atelier' }));

    // Câble : relie tous les blocs électriques voisins (les machines qui se touchent aussi)
    nb('CABLE', T({
      name: 'Câble électrique', render: 'cable', tex: 'cable', iconTex: 'cable_icon', solid: false, opaque: false, hardness: 0.3, sound: 'wool',
      box: [5, 5, 5, 11, 11, 11], tech: { k: 'cable' }, pushDestroy: true,
      // boîte de visée : le nœud et ses bras vers les blocs électriques voisins
      selAt: (w, x, y, z) => {
        const b = [5, 5, 5, 11, 11, 11];
        for (let d = 0; d < 6; d++) {
          const v = CM.DIRV[d], nb = CM.blocks[w.get(x + v[0], y + v[1], z + v[2])];
          if (!nb || !nb.tech) continue;
          const a = d >> 1;
          if (d & 1) b[a] = 0;
          else b[a + 3] = 16;
        }
        return b.map((v) => v / 16);
      },
    }));

    // ---- générateurs ----
    nb('SOLAR_PANEL', T({
      name: 'Panneau solaire', render: 'model', model: [{ b: [0, 0, 0, 16, 6, 16], t: ['solar_side', 'solar_side', 'solar_top', 'alu_casing', 'solar_side', 'solar_side'] }],
      tex: { top: 'solar_top', bottom: 'alu_casing', side: 'solar_side' }, iconTex: 'solar_top', solid: true, opaque: false, hardness: 2, tool: 'pickaxe', sound: 'metal',
      tech: { k: 'gen', gen: 'solar', max: 3 },
    }));
    // roue à eau : axe est-ouest (0) ou nord-sud (4) ; tourne si de l'eau la touche
    fam('waterwheel', 'tech', [['axis', [4, 0]]], (st) => ({
      name: 'Roue à eau', render: 'model', model: [CM.partY([6, 6, 0, 10, 10, 16], 'brass_casing', st.axis === 0 ? 0 : 5), CM.partY([4, 4, 5, 12, 12, 11], 'wheel_hub', st.axis === 0 ? 0 : 5)],
      tex: 'brass_casing', iconTex: 'waterwheel_icon', solid: false, opaque: false, hardness: 2, tool: 'axe', sound: 'wood', anim: 'water',
      tech: { k: 'gen', gen: 'water', max: 10 },
      place: (P) => CM.rsWith(CM.RSFAM.waterwheel.base, { axis: P.lookH === 0 || P.lookH === 1 ? 0 : 4 }),
    }), { key: keyFn('WATER_WHEEL') });
    // éolienne : les pales regardent dans la direction « facing » ; plus haut = plus de vent
    fam('windmill', 'tech', [['facing', [5, 4, 0, 1]]], (st) => ({
      name: 'Éolienne', render: 'model', model: [CM.partY([4, 3, 3, 12, 13, 15], ['alu_casing', 'alu_casing', 'alu_casing', 'alu_casing', 'alu_casing', 'turbine_front'], st.facing), CM.partY([7, 0, 7, 9, 3, 9], 'alu_casing', st.facing)],
      tex: 'alu_casing', iconTex: 'turbine_icon', solid: false, opaque: false, hardness: 2, tool: 'pickaxe', sound: 'metal', anim: 'wind',
      tech: { k: 'gen', gen: 'wind', max: 8 },
      place: (P) => CM.rsWith(CM.RSFAM.windmill.base, { facing: OPP[P.lookH] }),
    }), { key: keyFn('WIND_TURBINE') });
    // générateur à charbon : brûle charbon, bois, bâtons… (1 case de combustible)
    fam('coalgen', 'tech', [['facing', [5, 4, 0, 1]], ['lit', [false, true]]], (st) => ({
      name: 'Générateur à charbon', tex: { top: 'coalgen_top', bottom: 'brass_casing', side: 'coalgen_side', front: st.lit ? 'coalgen_front_on' : 'coalgen_front' },
      faces: cube(st.facing, st.lit ? 'coalgen_front_on' : 'coalgen_front', 'coalgen_side', 'coalgen_side', 'coalgen_top', 'brass_casing'),
      iconTex: 'coalgen_front', hardness: 3, tool: 'pickaxe', sound: 'metal', light: st.lit ? 13 : 0, lightColor: 'fire', flicker: st.lit,
      container: true, slots: 1, tech: { k: 'gen', gen: 'coal', max: 16 },
      place: (P) => CM.rsWith(CM.RSFAM.coalgen.base, { facing: OPP[P.lookH] }),
    }), { key: keyFn('COAL_GENERATOR') });
    // manivelle : chaque tour donne un peu d'énergie au réseau
    nb('HAND_CRANK', T({
      name: 'Manivelle', render: 'model', model: [{ b: [4, 0, 4, 12, 3, 12], t: 'brass_casing' }, { b: [7, 3, 7, 9, 10, 9], t: 'lever_handle' }, { b: [7, 8, 7, 14, 10, 9], t: 'lever_handle' }, { b: [12, 10, 7, 14, 14, 9], t: 'lever_handle' }],
      tex: 'brass_casing', iconTex: 'crank_icon', solid: false, opaque: false, hardness: 1, tool: 'axe', sound: 'wood', tech: { k: 'crank' },
      use: (g, t) => (CM.Tech ? CM.Tech.crank(g, t.x, t.y, t.z) : false),
    }));
    // batterie : 5 niveaux de charge visibles
    fam('battery', 'tech', [['level', [0, 1, 2, 3, 4]]], (st) => ({
      name: 'Batterie', tex: { top: 'battery_top', bottom: 'battery_top', side: 'battery_' + st.level }, iconTex: 'battery_4', hardness: 3, tool: 'pickaxe', sound: 'metal',
      tech: { k: 'bat' }, use: (g, t) => (CM.Tech ? CM.Tech.meter(g, t.x, t.y, t.z) : false),
    }), { key: keyFn('BATTERY') });

    // ---- lampes et néons ----
    fam('elamp', 'tech', [['on', [false, true]]], (st) => ({
      name: 'Lampe électrique', tex: st.on ? 'elamp_on' : 'elamp_off', iconTex: 'elamp_on', light: st.on ? 15 : 0, hardness: 0.5, sound: 'glass',
      lightColor: [255, 244, 220], tech: { k: 'use', use: 'lamp', rate: 0.5 },
    }), { key: keyFn('ELECTRIC_LAMP') });
    for (const [k, n, col] of NEONS) {
      const low = k.toLowerCase();
      fam('neon_' + low, 'tech', [['on', [false, true]]], (st) => ({
        name: 'Néon ' + n, tex: st.on ? 'neon_' + low + '_on' : 'neon_' + low + '_off', iconTex: 'neon_' + low + '_on', light: st.on ? 12 : 0, hardness: 0.4, sound: 'glass',
        lightColor: col, tech: { k: 'use', use: 'lamp', rate: 0.5 },
      }), { key: keyFn('NEON_' + k) });
    }

    // ---- machines ----
    fam('crusher', 'tech', [['on', [false, true]]], (st) => ({
      name: 'Broyeur', tex: { top: 'crusher_top', bottom: 'brass_casing', side: st.on ? 'crusher_side_on' : 'crusher_side' }, iconTex: 'crusher_side_on', hardness: 3, tool: 'pickaxe', sound: 'metal',
      container: true, slots: 2, tech: { k: 'use', use: 'crusher', rate: 4 }, anim: 'crusher',
    }), { key: keyFn('CRUSHER') });
    fam('efurnace', 'tech', [['facing', [5, 4, 0, 1]], ['on', [false, true]]], (st) => ({
      name: 'Four électrique', tex: { top: 'alu_casing', bottom: 'alu_casing', side: 'efurnace_side', front: st.on ? 'efurnace_front_on' : 'efurnace_front' },
      faces: cube(st.facing, st.on ? 'efurnace_front_on' : 'efurnace_front', 'efurnace_side', 'efurnace_side', 'alu_casing', 'alu_casing'),
      iconTex: 'efurnace_front_on', hardness: 3, tool: 'pickaxe', sound: 'metal', light: st.on ? 10 : 0, lightColor: 'fire',
      container: true, slots: 2, tech: { k: 'use', use: 'efurnace', rate: 3 },
      place: (P) => CM.rsWith(CM.RSFAM.efurnace.base, { facing: OPP[P.lookH] }),
    }), { key: keyFn('ELECTRIC_FURNACE') });
    // foreuse : casse ce qu'il y a devant elle et avance (tunnel de 2 de haut), range sa récolte
    // dans ses 9 cases et pose derrière elle les câbles qu'on lui donne ; fixe si un conteneur est derrière
    fam('drill', 'tech', [['facing', [2, 3, 0, 1, 4, 5]]], (st) => ({
      name: 'Foreuse', render: 'model',
      model: [
        CM.part6([0, 0, 0, 16, 10, 16], ['drill_side', 'drill_side', 'drill_front', 'brass_casing', 'drill_side', 'drill_side'], st.facing),
        CM.part6([3, 10, 3, 13, 13, 13], 'drill_bit', st.facing),
        CM.part6([5, 13, 5, 11, 15, 11], 'drill_bit', st.facing),
        CM.part6([7, 15, 7, 9, 16, 9], 'drill_bit', st.facing),
      ],
      tex: 'brass_casing', iconTex: 'drill_icon', solid: true, opaque: false, hardness: 3, tool: 'pickaxe', sound: 'metal', orient: st.facing,
      tech: { k: 'use', use: 'drill', rate: 6 }, box: [0, 0, 0, 16, 16, 16], container: true, slots: 9,
      desc: "Creuse devant elle et avance (tunnel de 2 blocs de haut). Clic droit : sa récolte ; mets-y des câbles pour qu'elle les pose derrière elle. Un coffre collé derrière la rend fixe.",
      place: (P) => CM.rsWith(CM.RSFAM.drill.base, { facing: P.look6 }),
    }), { key: keyFn('DRILL') });
    // tapis roulant : transporte objets, créatures et joueurs, et remplit le conteneur au bout
    fam('conveyor', 'tech', [['facing', [5, 4, 0, 1]], ['on', [false, true]]], (st) => ({
      name: 'Tapis roulant', render: 'model',
      model: [CM.partY([0, 0, 0, 16, 4, 16], ['alu_casing', 'alu_casing', st.on ? 'belt_on' : 'belt', 'alu_casing', 'alu_casing', 'alu_casing'], st.facing)],
      tex: 'alu_casing', iconTex: 'belt_on', solid: true, opaque: false, hardness: 1, tool: 'pickaxe', sound: 'metal', orient: st.facing,
      tech: { k: 'use', use: 'conveyor', rate: 0.5 },
      place: (P) => CM.rsWith(CM.RSFAM.conveyor.base, { facing: P.lookH }),
    }), { key: keyFn('CONVEYOR') });
    // ventilateur : souffle objets, créatures et joueurs jusqu'à 8 blocs
    fam('fan', 'tech', [['facing', [2, 3, 0, 1, 4, 5]], ['on', [false, true]]], (st) => ({
      name: 'Ventilateur', render: 'model',
      model: [
        CM.part6([0, 0, 0, 16, 12, 16], ['alu_casing', 'alu_casing', 'fan_front', 'alu_casing', 'alu_casing', 'alu_casing'], st.facing),
      ],
      tex: 'alu_casing', iconTex: 'fan_icon', solid: true, opaque: false, hardness: 2, tool: 'pickaxe', sound: 'metal', orient: st.facing,
      tech: { k: 'use', use: 'fan', rate: 1 }, anim: 'fan',
      place: (P) => CM.rsWith(CM.RSFAM.fan.base, { facing: P.look6 }),
    }), { key: keyFn('FAN') });
    // les états d'une famille électrique font partie de l'extension
    for (const n of ['waterwheel', 'windmill', 'coalgen', 'battery', 'elamp', 'crusher', 'efurnace', 'drill', 'conveyor', 'fan'].concat(NEONS.map(([k]) => 'neon_' + k.toLowerCase())))
      for (const id of CM.RSFAM[n].ids) CM.blocks[id].ext = EXT;
  });

  // ----------------------------------------------------------- objets ----
  M.items.push(function (K) {
    const { defItem } = K;
    const T = (o) => Object.assign({ ext: EXT }, o);
    defItem(1340, 'ZINC_INGOT', T({ name: 'Lingot de zinc', tex: 'zinc_ingot' }));
    defItem(1341, 'TIN_INGOT', T({ name: "Lingot d'étain", tex: 'tin_ingot' }));
    defItem(1342, 'ALUMINIUM_INGOT', T({ name: "Lingot d'aluminium", tex: 'aluminium_ingot' }));
    defItem(1343, 'LITHIUM', T({ name: 'Cristal de lithium', tex: 'lithium' }));
    defItem(1344, 'BRASS_INGOT', T({ name: 'Lingot de laiton', tex: 'brass_ingot', desc: 'Alliage de cuivre et de zinc (à la forge).' }));
    defItem(1345, 'BRONZE_INGOT', T({ name: 'Lingot de bronze', tex: 'bronze_ingot', desc: "Alliage de cuivre et d'étain (à la forge)." }));
    defItem(1346, 'IRON_DUST', T({ name: 'Poudre de fer', tex: 'iron_dust', desc: 'Le broyeur double les minerais : fonds la poudre à la forge ou au four électrique.' }));
    defItem(1347, 'GOLD_DUST', T({ name: "Poudre d'or", tex: 'gold_dust' }));
    defItem(1348, 'COPPER_DUST', T({ name: 'Poudre de cuivre', tex: 'copper_dust' }));
    defItem(1349, 'ZINC_DUST', T({ name: 'Poudre de zinc', tex: 'zinc_dust' }));
    defItem(1350, 'TIN_DUST', T({ name: "Poudre d'étain", tex: 'tin_dust' }));
    defItem(1351, 'ALUMINIUM_DUST', T({ name: "Poudre d'aluminium", tex: 'aluminium_dust' }));
    defItem(1352, 'SILICON', T({ name: 'Silicium', tex: 'silicon', desc: 'Sable fondu : sert aux circuits et aux cellules solaires.' }));
    defItem(1353, 'COPPER_WIRE', T({ name: 'Fil de cuivre', tex: 'copper_wire' }));
    defItem(1354, 'CIRCUIT', T({ name: 'Circuit électronique', tex: 'circuit' }));
    defItem(1355, 'MOTOR', T({ name: 'Moteur électrique', tex: 'motor' }));
    defItem(1356, 'SOLAR_CELL', T({ name: 'Cellule solaire', tex: 'solar_cell' }));
    defItem(1357, 'PROPELLER', T({ name: 'Hélice', tex: 'propeller' }));
    defItem(1358, 'LITHIUM_CELL', T({ name: 'Pile au lithium', tex: 'lithium_cell' }));
    defItem(1359, 'MULTIMETER', T({ name: 'Multimètre', tex: 'multimeter', stack: 1, desc: "Clic droit sur un bloc électrique : production, consommation et charge du réseau.",
      useOn: (g, t) => (CM.Tech && CM.blocks[t.id].tech ? CM.Tech.meter(g, t.x, t.y, t.z) : false) }));
    defItem(1360, 'WRENCH', T({ name: 'Clé à molette', tex: 'wrench', stack: 1, desc: 'Clic droit sur une machine : la tourner. Accroupi : la démonter aussitôt.',
      useOn: (g, t, p) => (CM.Tech ? CM.Tech.wrench(g, t, p) : false) }));
    const I = CM.I, B = CM.B;
    CM.blocks[B.DEEPSLATE_LITHIUM_ORE].drop = I.LITHIUM;
  });

  // --------------------------------------------------------- recettes ----
  M.recipes.push(function (K) {
    const { r } = K;
    const I = CM.I, B = CM.B, F = CM.RSFAM, D = CM.DYE_ITEM;
    const R = CM.recipes;
    CM.TAGS.zinc_ores = [B.ZINC_ORE, B.DEEPSLATE_ZINC_ORE];
    CM.TAGS.tin_ores = [B.TIN_ORE, B.DEEPSLATE_TIN_ORE];
    CM.STATION_NAMES.atelier = "Établi d'ingénieur";
    CM.STATION_NEAR.atelier = "un établi d'ingénieur";
    const E = (x) => ((x.ext = EXT), x);
    const smelt = (out, n, ing, k) => E(r(out, n, [[ing, k], [I.COAL, 1]], 'forge', 'tech'));
    R.push(
      smelt(I.ZINC_INGOT, 2, 'zinc_ores', 2),
      smelt(I.TIN_INGOT, 2, 'tin_ores', 2),
      smelt(I.ALUMINIUM_INGOT, 2, B.BAUXITE_ORE, 2),
      smelt(I.IRON_INGOT, 4, I.IRON_DUST, 4),
      smelt(I.GOLD_INGOT, 4, I.GOLD_DUST, 4),
      smelt(I.COPPER_INGOT, 4, I.COPPER_DUST, 4),
      smelt(I.ZINC_INGOT, 4, I.ZINC_DUST, 4),
      smelt(I.TIN_INGOT, 4, I.TIN_DUST, 4),
      smelt(I.ALUMINIUM_INGOT, 4, I.ALUMINIUM_DUST, 4),
      smelt(I.SILICON, 2, 'sand', 4),
      E(r(I.BRASS_INGOT, 2, [[I.COPPER_INGOT, 1], [I.ZINC_INGOT, 1], [I.COAL, 1]], 'forge', 'tech')),
      E(r(I.BRONZE_INGOT, 2, [[I.COPPER_INGOT, 1], [I.TIN_INGOT, 1], [I.COAL, 1]], 'forge', 'tech')),
      E(r(B.ENGINEER_TABLE, 1, [[B.TABLE, 1], [I.IRON_INGOT, 2], [I.COPPER_INGOT, 2]], 'table', 'tech')),
      E(r(I.COPPER_WIRE, 8, [[I.COPPER_INGOT, 3]], 'atelier', 'tech')),
      E(r(I.CIRCUIT, 1, [[I.SILICON, 1], [I.COPPER_WIRE, 2], [I.REDSTONE, 2]], 'atelier', 'tech')),
      E(r(I.MOTOR, 1, [[I.IRON_INGOT, 2], [I.COPPER_WIRE, 4], [I.BRASS_INGOT, 1]], 'atelier', 'tech')),
      E(r(I.SOLAR_CELL, 1, [[I.SILICON, 2], [B.GLASS, 1], [I.COPPER_WIRE, 1]], 'atelier', 'tech')),
      E(r(I.PROPELLER, 1, [[I.ALUMINIUM_INGOT, 3], [I.IRON_INGOT, 1]], 'atelier', 'tech')),
      E(r(I.LITHIUM_CELL, 1, [[I.LITHIUM, 1], [I.ALUMINIUM_INGOT, 1], [I.COPPER_WIRE, 1]], 'atelier', 'tech')),
      E(r(I.MULTIMETER, 1, [[I.CIRCUIT, 1], [I.BRASS_INGOT, 1], [B.GLASS, 1]], 'atelier', 'tech')),
      E(r(I.WRENCH, 1, [[I.BRASS_INGOT, 3]], 'atelier', 'tech')),
      E(r(B.CABLE, 8, [[I.COPPER_WIRE, 3], ['wool', 1]], 'atelier', 'tech')),
      E(r(B.BRASS_CASING, 4, [[I.BRASS_INGOT, 2], ['planks', 2]], 'atelier', 'tech')),
      E(r(B.ALU_CASING, 4, [[I.ALUMINIUM_INGOT, 2], [B.STONE, 2]], 'atelier', 'tech')),
      E(r(B.ZINC_BLOCK, 1, [[I.ZINC_INGOT, 9]], 'table', 'tech')),
      E(r(I.ZINC_INGOT, 9, [[B.ZINC_BLOCK, 1]], null, 'tech')),
      E(r(B.TIN_BLOCK, 1, [[I.TIN_INGOT, 9]], 'table', 'tech')),
      E(r(I.TIN_INGOT, 9, [[B.TIN_BLOCK, 1]], null, 'tech')),
      E(r(B.ALUMINIUM_BLOCK, 1, [[I.ALUMINIUM_INGOT, 9]], 'table', 'tech')),
      E(r(I.ALUMINIUM_INGOT, 9, [[B.ALUMINIUM_BLOCK, 1]], null, 'tech')),
      E(r(B.BRASS_BLOCK, 1, [[I.BRASS_INGOT, 9]], 'table', 'tech')),
      E(r(I.BRASS_INGOT, 9, [[B.BRASS_BLOCK, 1]], null, 'tech')),
      E(r(B.SOLAR_PANEL, 1, [[I.SOLAR_CELL, 3], [B.ALU_CASING, 1], [I.COPPER_WIRE, 2]], 'atelier', 'tech')),
      E(r(F.waterwheel.base, 1, [['planks', 8], [B.BRASS_CASING, 1], [I.COPPER_WIRE, 2]], 'atelier', 'tech')),
      E(r(F.windmill.base, 1, [[I.PROPELLER, 3], [I.MOTOR, 1], [B.ALU_CASING, 1]], 'atelier', 'tech')),
      E(r(F.coalgen.base, 1, [[B.FURNACE, 1], [I.MOTOR, 1], [B.BRASS_CASING, 1]], 'atelier', 'tech')),
      E(r(B.HAND_CRANK, 1, [[I.STICK, 2], [I.BRASS_INGOT, 1], [I.COPPER_WIRE, 2]], 'atelier', 'tech')),
      E(r(F.battery.base, 1, [[I.LITHIUM_CELL, 4], [B.ALU_CASING, 1], [I.COPPER_WIRE, 2]], 'atelier', 'tech')),
      E(r(F.elamp.base, 2, [[B.GLASS, 2], [I.COPPER_WIRE, 1], [I.GLOWSTONE_DUST, 1]], 'atelier', 'tech')),
      E(r(F.crusher.base, 1, [[B.BRASS_CASING, 1], [I.MOTOR, 1], [I.IRON_INGOT, 4]], 'atelier', 'tech')),
      E(r(F.efurnace.base, 1, [[B.FURNACE, 1], [I.CIRCUIT, 1], [B.ALU_CASING, 1]], 'atelier', 'tech')),
      E(r(F.drill.base, 1, [[I.MOTOR, 1], [I.IRON_INGOT, 3], [B.BRASS_CASING, 1]], 'atelier', 'tech')),
      E(r(F.conveyor.base, 6, [[I.MOTOR, 1], [I.LEATHER, 3], [I.IRON_INGOT, 2]], 'atelier', 'tech')),
      E(r(F.fan.base, 1, [[I.PROPELLER, 1], [I.MOTOR, 1], [B.ALU_CASING, 1]], 'atelier', 'tech')),
    );
    for (const [k, , , dye] of NEONS) R.push(E(r(F['neon_' + k.toLowerCase()].base, 4, [[B.GLASS, 4], [I.COPPER_WIRE, 1], [D[dye], 1]], 'atelier', 'tech')));
    // Broyeur : minerai -> 2 poudres, pierre -> gravier -> sable…
    CM.TECH_CRUSH = new Map();
    const crush = (ins, out, n) => {
      for (const id of typeof ins === 'string' ? CM.tagMembers(ins) : [ins]) CM.TECH_CRUSH.set(id, [out, n]);
    };
    crush('iron_ores', I.IRON_DUST, 2);
    crush('gold_ores', I.GOLD_DUST, 2);
    crush('copper_ores', I.COPPER_DUST, 3);
    crush('zinc_ores', I.ZINC_DUST, 2);
    crush('tin_ores', I.TIN_DUST, 2);
    crush(B.BAUXITE_ORE, I.ALUMINIUM_DUST, 2);
    crush(B.COAL_ORE, I.COAL, 3);
    crush(B.DEEPSLATE_COAL_ORE, I.COAL, 3);
    crush(B.REDSTONE_ORE, I.REDSTONE, 8);
    crush(B.DEEPSLATE_REDSTONE_ORE, I.REDSTONE, 8);
    crush(B.LAPIS_ORE, I.LAPIS, 8);
    crush(B.DEEPSLATE_LAPIS_ORE, I.LAPIS, 8);
    crush(B.DEEPSLATE_LITHIUM_ORE, I.LITHIUM, 3);
    crush(B.STONE, B.COBBLE, 1);
    crush(B.COBBLE, B.GRAVEL, 1);
    crush(B.GRAVEL, B.SAND, 1);
    crush(B.GLOWSTONE, I.GLOWSTONE_DUST, 4);
    if (I.BONE) crush(I.BONE, I.BONE_MEAL, 4);
    // Four électrique : les recettes de la forge (un lot à la fois, sans charbon)
    CM.TECH_SMELT = new Map();
    for (const x of R) {
      if (x.station !== 'forge' || x.ing.length !== 2 || !x.ing.some(([id]) => id === I.COAL)) continue;
      const [ing, k0] = x.ing.find(([id]) => id !== I.COAL);
      const gcd = (a, b) => (b ? gcd(b, a % b) : a), q = gcd(k0, x.n);
      for (const id of typeof ing === 'string' ? CM.tagMembers(ing) : [ing]) if (!CM.TECH_SMELT.has(id)) CM.TECH_SMELT.set(id, { k: k0 / q, out: x.out, n: x.n / q });
    }
    // Combustibles du générateur (secondes de combustion)
    CM.TECH_FUEL = new Map([[I.COAL, 40], [B.COAL_BLOCK, 400], [I.STICK, 2]]);
    if (I.CHARCOAL) CM.TECH_FUEL.set(I.CHARCOAL, 40);
    for (const id of CM.tagMembers('logs')) CM.TECH_FUEL.set(id, 15);
    for (const id of CM.tagMembers('planks')) CM.TECH_FUEL.set(id, 6);
    // Filons de l'extension (ajoutés au monde seulement si elle est active)
    CM.TECH_VEINS = [
      // [bloc, filons par tronçon, y min, y max, longueur, version des abîmes]
      [B.ZINC_ORE, 4.5, -24, 72, 7, B.DEEPSLATE_ZINC_ORE],
      [B.TIN_ORE, 4, -40, 60, 6, B.DEEPSLATE_TIN_ORE],
      [B.BAUXITE_ORE, 3.5, 36, 96, 8, 0],
      [B.DEEPSLATE_LITHIUM_ORE, 1.6, -63, -8, 4, B.DEEPSLATE_LITHIUM_ORE],
    ];
  });

  // --------------------------------------------------------- textures ----
  M.textures.push(function (X) {
    const { make, put, fill, disc, copyFrom, vary, border } = X;
    const line = (d, x0, y0, x1, y1, c) => X.line(d, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), c);
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    const icon = (name, fn) => make(name, (d, r) => {
      clear(d);
      fn(d, r);
    });
    const rect = (d, r, x0, y0, x1, y1, c, v) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(d, x, y, vary(c, r, v || 0));
    };
    const BRASS = [206, 160, 70], BRASS_D = [150, 110, 44], ALU = [196, 202, 210], ALU_D = [136, 142, 152];
    make('brass_casing', (d, r) => {
      fill(d, r, BRASS, 8);
      border(d, [236, 196, 110], BRASS_D);
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) put(d, x, y, [110, 80, 30]);
      for (let i = 4; i < 12; i++) put(d, i, 7, BRASS_D), put(d, 7, i, BRASS_D);
    });
    make('alu_casing', (d, r) => {
      fill(d, r, ALU, 6);
      border(d, [230, 234, 240], ALU_D);
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) put(d, x, y, [100, 104, 112]);
    });
    make('engineer_top', (d, r) => {
      fill(d, r, [120, 90, 56], 8);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [96, 70, 42]);
      rect(d, r, 2, 3, 8, 8, [60, 110, 170], 6);
      for (let x = 3; x < 7; x++) put(d, x, 5, [220, 230, 240]);
      line(d, 10, 3, 13, 11, [150, 150, 158]);
      rect(d, r, 9, 10, 14, 13, BRASS, 6);
      border(d, BRASS, BRASS_D);
    });
    make('engineer_side', (d, r) => {
      fill(d, r, ALU, 6);
      rect(d, r, 0, 0, 16, 4, [120, 90, 56], 8);
      for (let x = 0; x < 16; x++) put(d, x, 4, BRASS_D);
      rect(d, r, 3, 7, 7, 12, [70, 70, 76], 4);
      rect(d, r, 9, 7, 13, 12, [70, 70, 76], 4);
      put(d, 5, 9, BRASS);
      put(d, 11, 9, BRASS);
      border(d, [230, 234, 240], ALU_D);
    });
    // câble : cuivre gainé de caoutchouc noir
    make('cable', (d, r) => {
      fill(d, r, [34, 34, 38], 6);
      for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x++) put(d, x, y, [48, 48, 54]);
      for (let x = 6; x < 10; x++) put(d, x, 7, [200, 120, 70]), put(d, x, 8, [180, 100, 56]);
    });
    icon('cable_icon', (d, r) => {
      for (let i = 1; i < 15; i++) for (let w = -1; w <= 1; w++) put(d, i, 15 - i + w, vary([40, 40, 46], r, 6));
      put(d, 1, 14, [210, 120, 70]); put(d, 14, 1, [210, 120, 70]);
    });
    make('solar_top', (d, r) => {
      fill(d, r, [24, 40, 96], 8);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if (x % 5 === 0 || y % 5 === 0) put(d, x, y, [170, 178, 190]);
          else if ((x + y) % 7 === 0) put(d, x, y, [70, 110, 190]);
        }
    });
    make('solar_side', (d, r) => {
      fill(d, r, ALU, 6);
      rect(d, r, 0, 10, 16, 16, [24, 40, 96], 6);
      border(d, [230, 234, 240], ALU_D);
    });
    make('wheel_hub', (d, r) => {
      fill(d, r, [128, 92, 54], 8);
      disc(d, 7.5, 7.5, 3, (x, y) => put(d, x, y, BRASS));
      border(d, [150, 110, 64], [96, 66, 36]);
    });
    make('wheel_paddle', (d, r) => {
      fill(d, r, [150, 110, 64], 10);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [110, 78, 44]);
    });
    icon('waterwheel_icon', (d, r) => {
      disc(d, 7.5, 7.5, 7, (x, y, q) => put(d, x, y, q > 5.6 ? [110, 78, 44] : [150, 110, 64]));
      for (let a = 0; a < 8; a++) line(d, 7.5, 7.5, 7.5 + Math.cos((a * Math.PI) / 4) * 7, 7.5 + Math.sin((a * Math.PI) / 4) * 7, [96, 66, 36]);
      disc(d, 7.5, 7.5, 2, (x, y) => put(d, x, y, BRASS));
      void r;
    });
    make('turbine_front', (d, r) => {
      fill(d, r, ALU, 6);
      disc(d, 7.5, 7.5, 3, (x, y) => put(d, x, y, [236, 240, 244]));
      border(d, [230, 234, 240], ALU_D);
    });
    make('turbine_blade', (d, r) => fill(d, r, [238, 240, 244], 6));
    icon('turbine_icon', (d, r) => {
      for (let y = 9; y < 16; y++) put(d, 7, y, ALU_D), put(d, 8, y, ALU);
      line(d, 8, 6, 8, 0, [240, 240, 244]);
      line(d, 8, 6, 2, 10, [240, 240, 244]);
      line(d, 8, 6, 14, 10, [240, 240, 244]);
      disc(d, 8, 6, 1.6, (x, y) => put(d, x, y, [150, 156, 166]));
      void r;
    });
    const genFront = (lit) => (d, r) => {
      fill(d, r, BRASS, 8);
      border(d, [236, 196, 110], BRASS_D);
      rect(d, r, 4, 7, 12, 13, lit ? [255, 150, 40] : [30, 26, 24], lit ? 30 : 4);
      if (lit) for (let x = 5; x < 11; x += 2) put(d, x, 8, [255, 230, 120]);
      for (let x = 4; x < 12; x++) put(d, x, 6, BRASS_D);
      rect(d, r, 5, 2, 11, 4, [60, 60, 66], 4);
    };
    make('coalgen_front', genFront(false));
    make('coalgen_front_on', genFront(true));
    make('coalgen_side', (d, r) => {
      fill(d, r, BRASS, 8);
      border(d, [236, 196, 110], BRASS_D);
      for (let y = 4; y < 12; y += 2) for (let x = 3; x < 13; x++) put(d, x, y, [60, 60, 66]);
    });
    make('coalgen_top', (d, r) => {
      fill(d, r, BRASS, 8);
      border(d, [236, 196, 110], BRASS_D);
      disc(d, 7.5, 7.5, 3, (x, y, q) => put(d, x, y, q < 2 ? [30, 30, 32] : [80, 80, 86]));
    });
    icon('crank_icon', (d, r) => {
      rect(d, r, 4, 12, 12, 15, BRASS, 6);
      rect(d, r, 7, 5, 9, 12, [128, 92, 54], 6);
      rect(d, r, 7, 4, 14, 6, [128, 92, 54], 6);
      rect(d, r, 12, 1, 14, 5, [98, 68, 40], 6);
    });
    make('battery_top', (d, r) => {
      fill(d, r, ALU, 6);
      border(d, [230, 234, 240], ALU_D);
      rect(d, r, 3, 3, 6, 6, [200, 40, 40], 0);
      rect(d, r, 10, 3, 13, 6, [40, 40, 44], 0);
    });
    for (let lv = 0; lv <= 4; lv++)
      make('battery_' + lv, (d, r) => {
        fill(d, r, ALU, 6);
        border(d, [230, 234, 240], ALU_D);
        rect(d, r, 5, 2, 11, 14, [40, 40, 44], 2);
        const col = lv >= 3 ? [70, 220, 90] : lv === 2 ? [230, 200, 50] : [220, 70, 50];
        for (let k = 0; k < lv; k++) rect(d, r, 6, 11 - k * 3, 10, 13 - k * 3, col, 8);
      });
    make('elamp_off', (d, r) => {
      fill(d, r, [150, 150, 150], 8);
      rect(d, r, 2, 2, 14, 14, [96, 96, 100], 6);
      border(d, [190, 190, 196], [110, 110, 116]);
    });
    make('elamp_on', (d, r) => {
      fill(d, r, [255, 250, 232], 4);
      rect(d, r, 2, 2, 14, 14, [255, 255, 246], 2);
      border(d, [220, 220, 226], [180, 180, 186]);
    });
    for (const [k, , col] of NEONS) {
      const low = k.toLowerCase();
      const dim = col.map((v) => Math.round(v * 0.28 + 20));
      const neon = (on) => (d, r) => {
        fill(d, r, on ? col.map((v) => Math.round(v * 0.8)) : dim.map((v) => v * 0.7), 4);
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const tube = y === 3 || y === 4 || y === 11 || y === 12 || ((x === 3 || x === 4) && y > 3 && y < 12);
            if (tube) put(d, x, y, on ? col.map((v) => Math.min(255, v * 0.35 + 180)) : dim);
            else if (on && (y === 2 || y === 5 || y === 10 || y === 13 || ((x === 2 || x === 5) && y > 3 && y < 12))) put(d, x, y, col.map((v) => Math.min(255, v + 30)));
          }
        border(d, on ? col.map((v) => v * 0.8) : [60, 60, 64], on ? col.map((v) => v * 0.6) : [40, 40, 44]);
        void r;
      };
      make('neon_' + low + '_off', neon(false));
      make('neon_' + low + '_on', neon(true));
    }
    const crusherSide = (on) => (d, r) => {
      fill(d, r, BRASS, 8);
      border(d, [236, 196, 110], BRASS_D);
      rect(d, r, 3, 3, 13, 9, [70, 70, 76], 4);
      for (let x = 3; x < 13; x += 2) put(d, x, 5, [110, 110, 116]);
      rect(d, r, 5, 11, 11, 13, on ? [90, 230, 100] : [60, 80, 60], 4);
    };
    make('crusher_side', crusherSide(false));
    make('crusher_side_on', crusherSide(true));
    make('crusher_top', (d, r) => {
      fill(d, r, BRASS, 8);
      rect(d, r, 2, 2, 14, 14, [30, 30, 34], 4);
      border(d, [236, 196, 110], BRASS_D);
    });
    make('roller', (d, r) => {
      fill(d, r, [120, 120, 128], 10);
      for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x++) put(d, x, y, [80, 80, 86]);
    });
    const efFront = (on) => (d, r) => {
      fill(d, r, ALU, 6);
      border(d, [230, 234, 240], ALU_D);
      rect(d, r, 3, 5, 13, 13, on ? [255, 120, 40] : [40, 40, 44], on ? 24 : 4);
      if (on) for (let x = 4; x < 12; x++) put(d, x, 11, [255, 220, 120]);
      rect(d, r, 4, 2, 7, 4, [60, 160, 220], 4);
      rect(d, r, 9, 2, 12, 4, on ? [90, 230, 100] : [60, 80, 60], 4);
    };
    make('efurnace_front', efFront(false));
    make('efurnace_front_on', efFront(true));
    make('efurnace_side', (d, r) => {
      fill(d, r, ALU, 6);
      border(d, [230, 234, 240], ALU_D);
      for (let y = 4; y < 12; y += 2) for (let x = 3; x < 13; x++) put(d, x, y, [140, 146, 156]);
    });
    make('drill_side', (d, r) => {
      fill(d, r, BRASS, 8);
      border(d, [236, 196, 110], BRASS_D);
      for (let y = 3; y < 13; y += 3) for (let x = 3; x < 13; x++) put(d, x, y, BRASS_D);
    });
    make('drill_front', (d, r) => {
      fill(d, r, BRASS, 8);
      border(d, [236, 196, 110], BRASS_D);
      disc(d, 7.5, 7.5, 5, (x, y) => put(d, x, y, [90, 90, 96]));
    });
    make('drill_bit', (d, r) => {
      fill(d, r, [170, 174, 184], 10);
      for (let i = 0; i < 16; i++) put(d, i, (i * 2) % 16, [110, 114, 124]);
    });
    icon('drill_icon', (d, r) => {
      rect(d, r, 2, 6, 10, 14, BRASS, 8);
      for (let k = 0; k < 5; k++) rect(d, r, 10 + k, 7 + Math.floor(k / 2), 11 + k, 13 - Math.floor(k / 2), [170, 174, 184], 8);
    });
    const belt = (on) => (d, r) => {
      fill(d, r, [44, 44, 48], 6);
      const c = on ? [120, 230, 110] : [150, 150, 156];
      // flèches vers le haut de la texture (la direction du tapis)
      for (const y0 of [2, 10]) for (let k = 0; k < 4; k++) { put(d, 7 - k, y0 + k, c); put(d, 8 + k, y0 + k, c); }
      for (let y = 0; y < 16; y++) put(d, 0, y, [90, 90, 96]), put(d, 15, y, [90, 90, 96]);
      void r;
    };
    make('belt', belt(false));
    make('belt_on', belt(true));
    make('fan_front', (d, r) => {
      fill(d, r, ALU, 6);
      disc(d, 7.5, 7.5, 7, (x, y) => put(d, x, y, [40, 40, 46]));
      for (let i = 1; i < 15; i += 3) for (let j = 1; j < 15; j++) if (Math.hypot(i - 7.5, j - 7.5) < 7) put(d, i, j, [150, 156, 166]);
      border(d, [230, 234, 240], ALU_D);
    });
    make('fan_blade', (d, r) => fill(d, r, [210, 214, 222], 6));
    icon('fan_icon', (d, r) => {
      disc(d, 7.5, 7.5, 7.4, (x, y, q) => put(d, x, y, q > 6.3 ? ALU_D : [50, 50, 56]));
      for (let a = 0; a < 4; a++) line(d, 7.5, 7.5, 7.5 + Math.cos(a * 1.57 + 0.4) * 6, 7.5 + Math.sin(a * 1.57 + 0.4) * 6, [210, 214, 222]);
      disc(d, 7.5, 7.5, 1.5, (x, y) => put(d, x, y, BRASS));
      void r;
    });
    // ---- objets ----
    const ingot = (name, c, hi) => icon(name, (d, r) => {
      for (let y = 6; y < 11; y++) for (let x = 2 + (10 - y); x < 14 - (y - 6) * 0; x++) if (x < 14 && x > 1) put(d, x, y, vary(y === 6 ? hi : c, r, 6));
      for (let x = 3; x < 14; x++) put(d, x, 11, c.map((v) => v * 0.7));
    });
    ingot('zinc_ingot', [150, 176, 184], [214, 234, 240]);
    ingot('tin_ingot', [196, 198, 186], [244, 246, 236]);
    ingot('aluminium_ingot', [196, 202, 212], [244, 246, 250]);
    ingot('brass_ingot', [206, 160, 70], [250, 214, 130]);
    ingot('bronze_ingot', [176, 112, 60], [226, 164, 104]);
    icon('lithium', (d, r) => {
      for (const [x, y, w, h] of [[6, 2, 4, 10], [3, 6, 3, 7], [10, 5, 3, 8]]) rect(d, r, x, y, x + w, y + h, [226, 150, 226], 14);
      for (const [x, y] of [[7, 3], [4, 7], [11, 6]]) put(d, x, y, [255, 226, 255]);
    });
    const dust = (name, c) => icon(name, (d, r) => {
      disc(d, 7.5, 9.5, 5.2, (x, y, q) => { if (y > 5) put(d, x, y, vary(q < 2.5 ? c.map((v) => Math.min(255, v + 30)) : c, r, 16)); });
    });
    dust('iron_dust', [206, 190, 176]);
    dust('gold_dust', [240, 204, 80]);
    dust('copper_dust', [214, 128, 84]);
    dust('zinc_dust', [168, 190, 196]);
    dust('tin_dust', [214, 214, 204]);
    dust('aluminium_dust', [212, 216, 226]);
    icon('silicon', (d, r) => {
      rect(d, r, 3, 3, 13, 13, [80, 86, 110], 10);
      for (let i = 3; i < 13; i++) put(d, i, i, [150, 160, 200]);
    });
    icon('copper_wire', (d, r) => {
      for (let a = 0; a < 40; a++) {
        const t = a / 40;
        put(d, Math.round(3 + t * 10), Math.round(8 + Math.sin(t * 12) * 4), [214, 128, 84]);
      }
      void r;
    });
    icon('circuit', (d, r) => {
      rect(d, r, 2, 3, 14, 13, [30, 110, 50], 8);
      line(d, 3, 5, 10, 5, [220, 190, 90]);
      line(d, 10, 5, 10, 11, [220, 190, 90]);
      line(d, 4, 9, 7, 9, [220, 190, 90]);
      rect(d, r, 5, 6, 9, 8, [30, 30, 34], 2);
    });
    icon('motor', (d, r) => {
      rect(d, r, 3, 4, 11, 13, [70, 110, 170], 8);
      for (let y = 5; y < 13; y += 2) for (let x = 3; x < 11; x++) put(d, x, y, [50, 84, 140]);
      rect(d, r, 11, 7, 14, 10, [170, 174, 184], 6);
    });
    icon('solar_cell', (d, r) => {
      rect(d, r, 2, 2, 14, 14, [24, 40, 96], 8);
      for (let i = 2; i < 14; i += 4) for (let j = 2; j < 14; j++) put(d, i, j, [170, 178, 190]), put(d, j, i, [170, 178, 190]);
    });
    icon('propeller', (d, r) => {
      line(d, 8, 8, 8, 1, [236, 240, 244]);
      line(d, 8, 8, 2, 12, [236, 240, 244]);
      line(d, 8, 8, 14, 12, [236, 240, 244]);
      line(d, 9, 8, 9, 2, [200, 204, 212]);
      disc(d, 8, 8, 1.5, (x, y) => put(d, x, y, [120, 124, 134]));
      void r;
    });
    icon('lithium_cell', (d, r) => {
      rect(d, r, 5, 3, 11, 14, [170, 90, 170], 8);
      rect(d, r, 7, 1, 9, 3, [200, 200, 206], 4);
      for (let x = 5; x < 11; x++) put(d, x, 8, [240, 200, 240]);
    });
    icon('multimeter', (d, r) => {
      rect(d, r, 3, 1, 13, 15, [230, 180, 40], 8);
      rect(d, r, 4, 2, 12, 7, [150, 200, 150], 6);
      line(d, 5, 6, 10, 3, [30, 30, 30]);
      disc(d, 8, 11, 2, (x, y) => put(d, x, y, [40, 40, 44]));
    });
    icon('wrench', (d, r) => {
      line(d, 3, 13, 10, 6, BRASS);
      line(d, 4, 13, 11, 6, BRASS_D);
      for (const [x, y] of [[10, 3], [11, 3], [12, 4], [13, 5], [13, 6], [12, 7], [9, 4], [9, 5]]) put(d, x, y, BRASS);
      void r;
    });
    void copyFrom;
  });
})();
