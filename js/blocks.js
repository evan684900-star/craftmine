'use strict';
(function () {
// Définitions des blocs, des objets et des recettes.
//
// Identifiants : les blocs occupent 0..999 (stockés sur 16 bits dans les tronçons),
// les objets commencent à 1000. Les identifiants ne doivent JAMAIS changer d'une
// version à l'autre (ils sont enregistrés dans les sauvegardes) : on ajoute toujours
// les nouveaux blocs à la fin.
CM.ITEM_BASE = 1000;

// ---------------------------------------------------------------- Blocs ----
// render: 'cube' | 'cross' | 'torch' | 'water' | 'glass' (découpé, opaque)
//         'tglass' (translucide : glace, verre teinté) | 'slab' | 'carpet' (blocs partiels)
// opaque: cache les faces voisines et bloque la lumière
// atten: atténuation supplémentaire de la lumière (feuilles, eau)
// height: hauteur de collision (dalles 0.5, tapis 1/16)
CM.blocks = [];
CM.B = {};
// Textures générées à partir d'une description (voir textures.js) : nom -> spécification.
CM.TEXSPEC = {};
const tx = (name, spec) => {
  if (!CM.TEXSPEC[name]) CM.TEXSPEC[name] = spec;
  return name;
};

function defBlock(id, key, d) {
  const def = Object.assign(
    {
      id,
      key,
      name: key,
      render: 'cube',
      solid: true,
      opaque: true,
      atten: 0,
      light: 0,
      hardness: 1,
      tool: null,
      tier: 0,
      sound: 'stone',
      drop: id,
      replaceable: false,
      bounce: false,
      unbreakable: false,
      tex: null,
      height: 1,
    },
    d,
  );
  if (typeof def.tex === 'string') def.tex = { top: def.tex, bottom: def.tex, side: def.tex };
  if (def.tex && !def.tex.front) def.tex.front = def.tex.side;
  if (def.render === 'slab') def.height = def.height === 1 ? 0.5 : def.height;
  if (def.render === 'carpet' && def.height === 1) def.height = 1 / 16;
  // opaque pour la lumière: seulement les cubes opaques
  def.lightOpaque = def.opaque && def.render === 'cube';
  CM.blocks[id] = def;
  CM.B[key] = id;
  return def;
}
let NEXT = 107;
// Nouveau bloc à la suite des précédents (l'ordre d'appel fixe l'identifiant).
const nb = (key, d) => defBlock(NEXT++, key, d);

defBlock(0, 'AIR', { name: 'Air', render: 'none', solid: false, opaque: false, hardness: 0, drop: 0 });
defBlock(1, 'STONE', { name: 'Pierre', tex: 'stone', hardness: 1.5, tool: 'pickaxe', tier: 1, drop: 9 });
defBlock(2, 'DIRT', { name: 'Terre', tex: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
defBlock(3, 'GRASS', { name: "Bloc d'herbe", tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', sound: 'grass', drop: 2 });
defBlock(4, 'SAND', { name: 'Sable', tex: 'sand', hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(5, 'WATER', { name: 'Eau', render: 'water', tex: 'water', solid: false, opaque: false, atten: 2, hardness: -1, drop: 0, replaceable: true });
defBlock(6, 'LOG', { name: 'Bûche', tex: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
defBlock(7, 'LEAVES', { name: 'Feuillage', tex: 'leaves', atten: 1, hardness: 0.25, tool: 'axe', sound: 'grass', drop: 0, wave: true });
defBlock(8, 'PLANKS', { name: 'Planches', tex: 'planks', hardness: 1.5, tool: 'axe', sound: 'wood' });
defBlock(9, 'COBBLE', { name: 'Galets', tex: 'cobble', hardness: 1.8, tool: 'pickaxe', tier: 1 });
defBlock(10, 'COAL_ORE', { name: 'Minerai de charbon', tex: 'coal_ore', hardness: 2.5, tool: 'pickaxe', tier: 1, ore: true });
defBlock(11, 'IRON_ORE', { name: 'Minerai de fer', tex: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2, ore: true });
defBlock(12, 'CRYSTAL_ORE', { name: 'Minerai de cristal', tex: 'crystal_ore', hardness: 3.5, tool: 'pickaxe', tier: 3, light: 7, ore: true });
defBlock(13, 'BEDROCK', { name: 'Socle', tex: 'bedrock', hardness: -1, unbreakable: true });
defBlock(14, 'GLASS', { name: 'Verre', render: 'glass', tex: 'glass', opaque: false, hardness: 0.4, sound: 'glass' });
defBlock(15, 'TORCH', { name: 'Torche', render: 'torch', tex: 'torch', solid: false, opaque: false, light: 14, hardness: 0, sound: 'wood' });
defBlock(16, 'TABLE', { name: 'Établi', tex: { top: 'table_top', bottom: 'planks', side: 'table_side', front: 'table_front' }, hardness: 2, tool: 'axe', sound: 'wood', station: 'table' });
defBlock(17, 'FORGE', { name: 'Forge', tex: { top: 'forge_top', bottom: 'forge_top', side: 'forge_side', front: 'forge_front' }, hardness: 3, tool: 'pickaxe', tier: 1, light: 10, station: 'forge' });
defBlock(18, 'SNOW', { name: 'Bloc de neige', tex: 'snow', hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(19, 'DEEPSTONE', { name: 'Ardoise des abîmes', tex: 'deepstone', hardness: 3, tool: 'pickaxe', tier: 1 });
defBlock(20, 'FLOWER', { name: 'Coquelicot', render: 'cross', tex: 'flower', solid: false, opaque: false, hardness: 0, sound: 'grass', replaceable: true, plant: true, wave: true });
defBlock(21, 'TALLGRASS', { name: 'Herbes hautes', render: 'cross', tex: 'tallgrass', solid: false, opaque: false, hardness: 0, sound: 'grass', drop: 0, replaceable: true, plant: true, wave: true });
defBlock(22, 'BERRYBUSH', { name: 'Buisson à baies', render: 'cross', tex: 'berrybush', solid: false, opaque: false, hardness: 0.2, sound: 'grass', drop: 0, plant: true, wave: true });
defBlock(23, 'LAMP', { name: 'Lanterne de cristal', tex: 'lamp', hardness: 0.8, light: 15, sound: 'glass' });
defBlock(24, 'SKYSTONE', { name: 'Pierre céleste', tex: 'skystone', hardness: 2, tool: 'pickaxe', tier: 1 });
defBlock(25, 'SHARD_ORE', { name: "Minerai d'éclat céleste", tex: 'shard_ore', hardness: 4, tool: 'pickaxe', tier: 3, light: 9, ore: true });
defBlock(26, 'BRICKS', { name: 'Briques', tex: 'bricks', hardness: 2, tool: 'pickaxe', tier: 1 });
defBlock(27, 'WOOL', { name: 'Laine blanche', tex: 'wool', hardness: 0.6, sound: 'wool' });
defBlock(28, 'MUSHROOM', { name: 'Champignon rebond', tex: { top: 'mushroom_top', bottom: 'mushroom_bottom', side: 'mushroom_side' }, hardness: 0.6, tool: 'axe', light: 5, sound: 'grass', bounce: true });
defBlock(29, 'DAWN_HEART', { name: "Cœur d'aube", tex: 'dawn_heart', hardness: 3, tool: 'pickaxe', tier: 1, light: 15, sound: 'glass' });
defBlock(30, 'STONEBRICK', { name: 'Pierre taillée', tex: 'stonebrick', hardness: 2, tool: 'pickaxe', tier: 1 });
defBlock(32, 'SAPLING', { name: 'Pousse de chêne', render: 'cross', tex: 'sapling', solid: false, opaque: false, hardness: 0, sound: 'grass', plant: true, wave: true });
defBlock(31, 'CHEST', { name: 'Coffre', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', container: true });

// ------------------------------------------------------- Essences de bois --
// Chaque essence a une bûche, des planches, des feuilles et une pousse
// (plus tard : bûche écorcée, bois, bois écorcé et dalle).
CM.WOODS = [
  { key: 'OAK', name: 'chêne', log: 6, planks: 8, leaves: 7, sapling: 32 },
  { key: 'BIRCH', name: 'bouleau', base: 33 },
  { key: 'SPRUCE', name: 'sapin', base: 37 },
  { key: 'ACACIA', name: 'acacia', base: 41 },
  { key: 'JUNGLE', name: 'acajou', base: 45 },
  { key: 'WILLOW', name: 'saule', base: 49 },
  { key: 'CRYSTAL', name: 'bois cristallin', base: 53, glow: 6 },
];
const de = (n) => (/^[aeiouyéèh]/i.test(n) ? "d'" : 'de ') + n;
function defWood(w, ids) {
  const t = w.key.toLowerCase();
  w.log = ids[0];
  w.planks = ids[1];
  w.leaves = ids[2];
  w.sapling = ids[3];
  const nether = !!w.nether;
  defBlock(w.log, w.key + '_LOG', { tex: { top: t + '_log_top', bottom: t + '_log_top', side: t + '_log_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
  defBlock(w.planks, w.key + '_PLANKS', { tex: t + '_planks', hardness: 1.5, tool: 'axe', sound: 'wood' });
  if (nether) defBlock(w.leaves, w.key + '_LEAVES', { tex: t + '_leaves', hardness: 1, tool: 'axe', sound: 'grass', drop: w.leaves });
  else defBlock(w.leaves, w.key + '_LEAVES', { tex: t + '_leaves', atten: 1, hardness: 0.25, tool: 'axe', sound: 'grass', drop: 0, light: w.glow || 0, wave: true });
  defBlock(w.sapling, w.key + '_SAPLING', { render: 'cross', tex: t + '_sapling', solid: false, opaque: false, hardness: 0, sound: 'grass', plant: true, soilAny: nether, wave: !nether });
}
function nameWood(w) {
  CM.blocks[w.log].name = (w.logName || 'Bûche') + ' ' + de(w.name);
  CM.blocks[w.planks].name = 'Planches ' + de(w.name);
  CM.blocks[w.leaves].name = w.leavesName || 'Feuilles ' + de(w.name);
  CM.blocks[w.sapling].name = w.saplingName || 'Pousse ' + de(w.name);
  if (w.nether) {
    CM.blocks[w.log].name = w.logName;
    CM.blocks[w.planks].name = w.planksName;
  }
  for (const k of ['log', 'planks', 'leaves', 'sapling']) CM.blocks[w[k]].wood = w.key;
}
for (const w of CM.WOODS) {
  if (w.base) defWood(w, [w.base, w.base + 1, w.base + 2, w.base + 3]);
  nameWood(w);
}
CM.B.LOG = 6;
CM.blocks[3].soil = true; // herbe
CM.blocks[2].soil = true; // terre

// ----------------------------------------------------- Sols et roches ----
const grassLike = (name, t) => ({ name, tex: { top: t + '_top', bottom: 'dirt', side: t + '_side' }, hardness: 0.6, tool: 'shovel', sound: 'grass', drop: 2, soil: true });
defBlock(57, 'SNOWY_GRASS', grassLike('Herbe enneigée', 'snowy_grass'));
defBlock(58, 'DRY_GRASS', grassLike('Herbe sèche', 'dry_grass'));
defBlock(59, 'LUSH_GRASS', grassLike('Herbe luxuriante', 'lush_grass'));
defBlock(60, 'SWAMP_GRASS', grassLike('Herbe de marais', 'swamp_grass'));
defBlock(61, 'PODZOL', grassLike('Podzol', 'podzol'));
defBlock(62, 'CRYSTAL_MOSS', grassLike('Mousse cristalline', 'crystal_moss'));
defBlock(63, 'SANDSTONE', { name: 'Grès', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
defBlock(64, 'CARVED_SANDSTONE', { name: 'Grès sculpté', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'carved_sandstone' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
defBlock(65, 'RED_SAND', { name: 'Sable rouge', tex: 'red_sand', hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(66, 'RED_SANDSTONE', { name: 'Grès rouge', tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_top', side: 'red_sandstone_side' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
defBlock(67, 'TERRACOTTA', { name: 'Terre cuite', tex: 'terracotta', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(68, 'TERRACOTTA_RED', { name: 'Terre cuite rouge', tex: 'terracotta_red', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(69, 'TERRACOTTA_YELLOW', { name: 'Terre cuite jaune', tex: 'terracotta_yellow', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(70, 'TERRACOTTA_BROWN', { name: 'Terre cuite marron', tex: 'terracotta_brown', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(71, 'TERRACOTTA_WHITE', { name: 'Terre cuite blanche', tex: 'terracotta_white', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(72, 'GRAVEL', { name: 'Gravier', tex: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel' });
defBlock(73, 'CLAY', { name: 'Argile', tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel' });
defBlock(74, 'MUD', { name: 'Boue', tex: 'mud', hardness: 0.5, tool: 'shovel', sound: 'gravel', slow: 0.55 });
defBlock(75, 'ICE', { name: 'Glace', render: 'tglass', tex: 'ice', opaque: false, atten: 1, hardness: 0.5, tool: 'pickaxe', sound: 'glass', slip: 0.98 });
defBlock(76, 'GRANITE', { name: 'Granite', tex: 'granite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(77, 'DIORITE', { name: 'Diorite', tex: 'diorite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(78, 'ANDESITE', { name: 'Andésite', tex: 'andesite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(79, 'POLISHED_GRANITE', { name: 'Granite poli', tex: 'polished_granite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(80, 'POLISHED_DIORITE', { name: 'Diorite polie', tex: 'polished_diorite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(81, 'POLISHED_ANDESITE', { name: 'Andésite polie', tex: 'polished_andesite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(82, 'MOSSY_COBBLE', { name: 'Galets moussus', tex: 'mossy_cobble', hardness: 1.8, tool: 'pickaxe', tier: 1 });
defBlock(83, 'MOSSY_STONEBRICK', { name: 'Pierre taillée moussue', tex: 'mossy_stonebrick', hardness: 2, tool: 'pickaxe', tier: 1 });

// ------------------------------------------------------------ Plantes ----
const plant = (name, tex, extra) => Object.assign({ name, render: 'cross', tex, solid: false, opaque: false, hardness: 0, sound: 'grass', replaceable: true, plant: true, wave: true }, extra || {});
defBlock(84, 'CACTUS', { name: 'Cactus', tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, hardness: 0.4, sound: 'grass', hurts: 1, needsBelow: 'sand' });
defBlock(85, 'DEAD_BUSH', plant('Buisson mort', 'dead_bush', { drop: 0, soilAny: true }));
defBlock(86, 'FERN', plant('Fougère', 'fern', { drop: 0 }));
defBlock(87, 'DANDELION', plant('Pissenlit', 'dandelion'));
defBlock(88, 'CORNFLOWER', plant('Bleuet', 'cornflower'));
defBlock(89, 'TULIP', plant('Tulipe orange', 'tulip'));
defBlock(90, 'DAISY', plant('Marguerite', 'daisy'));
defBlock(91, 'CRYSTAL_FLOWER', plant('Fleur de cristal', 'crystal_flower', { light: 8 }));
defBlock(92, 'RED_SHROOM', plant('Champignon rouge', 'red_shroom', { soilAny: true, wave: false }));
defBlock(93, 'BROWN_SHROOM', plant('Champignon brun', 'brown_shroom', { soilAny: true, wave: false }));
defBlock(94, 'MELON', { name: 'Pastèque', tex: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, hardness: 1, tool: 'axe', sound: 'wood', drop: 0 });
defBlock(95, 'PUMPKIN', { name: 'Citrouille', tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_side' }, hardness: 1, tool: 'axe', sound: 'wood' });
defBlock(96, 'JACK_O_LANTERN', { name: 'Citrouille-lanterne', tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_face' }, hardness: 1, tool: 'axe', sound: 'wood', light: 15 });

// ------------------------------------------------ Minerais et métaux -----
defBlock(97, 'COPPER_ORE', { name: 'Minerai de cuivre', tex: 'copper_ore', hardness: 3, tool: 'pickaxe', tier: 2, ore: true });
defBlock(98, 'GOLD_ORE', { name: "Minerai d'or", tex: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3, ore: true });
defBlock(99, 'RUBY_ORE', { name: 'Minerai de rubis', tex: 'ruby_ore', hardness: 3.5, tool: 'pickaxe', tier: 3, ore: true });
defBlock(100, 'COPPER_BLOCK', { name: 'Bloc de cuivre', tex: 'copper_block', hardness: 3, tool: 'pickaxe', tier: 2, sound: 'metal' });
defBlock(101, 'GOLD_BLOCK', { name: "Bloc d'or", tex: 'gold_block', hardness: 3, tool: 'pickaxe', tier: 3, sound: 'metal' });
defBlock(102, 'IRON_BLOCK', { name: 'Bloc de fer', tex: 'iron_block', hardness: 4, tool: 'pickaxe', tier: 2, sound: 'metal' });
defBlock(103, 'CRYSTAL_BLOCK', { name: 'Bloc de cristal', tex: 'crystal_block', hardness: 3, tool: 'pickaxe', tier: 3, light: 12, sound: 'glass' });
defBlock(104, 'COAL_BLOCK', { name: 'Bloc de charbon', tex: 'coal_block', hardness: 3, tool: 'pickaxe', tier: 1 });
defBlock(105, 'RUBY_BLOCK', { name: 'Bloc de rubis', tex: 'ruby_block', hardness: 4, tool: 'pickaxe', tier: 3, sound: 'metal' });
defBlock(106, 'LANTERN', { name: 'Lanterne en cuivre', tex: { top: 'lantern_top', bottom: 'lantern_top', side: 'lantern_side' }, hardness: 1, tool: 'pickaxe', light: 15, sound: 'glass' });

// =================================================== Nouveaux blocs (v4) ===
// Tout ce qui suit est numéroté automatiquement à partir de 107 : ne jamais
// réordonner, seulement ajouter à la fin.

// ---- Couleurs (16 teintures) ----
CM.DYES = [
  { key: 'WHITE', m: 'blanc', f: 'blanche', c: [233, 236, 236] },
  { key: 'ORANGE', m: 'orange', f: 'orange', c: [240, 118, 19] },
  { key: 'MAGENTA', m: 'magenta', f: 'magenta', c: [189, 68, 179] },
  { key: 'LIGHT_BLUE', m: 'bleu clair', f: 'bleu clair', c: [58, 175, 217] },
  { key: 'YELLOW', m: 'jaune', f: 'jaune', c: [248, 197, 39] },
  { key: 'LIME', m: 'vert clair', f: 'vert clair', c: [112, 185, 25] },
  { key: 'PINK', m: 'rose', f: 'rose', c: [237, 141, 172] },
  { key: 'GRAY', m: 'gris', f: 'grise', c: [62, 68, 71] },
  { key: 'LIGHT_GRAY', m: 'gris clair', f: 'gris clair', c: [142, 142, 134] },
  { key: 'CYAN', m: 'cyan', f: 'cyan', c: [21, 137, 145] },
  { key: 'PURPLE', m: 'violet', f: 'violette', c: [121, 42, 172] },
  { key: 'BLUE', m: 'bleu', f: 'bleue', c: [53, 57, 157] },
  { key: 'BROWN', m: 'marron', f: 'marron', c: [114, 71, 40] },
  { key: 'GREEN', m: 'vert', f: 'verte', c: [84, 109, 27] },
  { key: 'RED', m: 'rouge', f: 'rouge', c: [160, 39, 34] },
  { key: 'BLACK', m: 'noir', f: 'noire', c: [20, 21, 25] },
];
const lc = (k) => k.toLowerCase();
const mulc = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// Terre cuite : couleur de teinture rabattue vers l'ocre (comme dans Minecraft).
const terraColor = (c) => mixc(mulc(c, 0.72), [150, 92, 66], 0.42);

CM.COLOR = {}; // famille -> couleur -> id
const fam = (name) => (CM.COLOR[name] = CM.COLOR[name] || {});
for (const d of CM.DYES) {
  if (d.key === 'WHITE') {
    fam('wool').WHITE = 27;
    continue;
  }
  nb('WOOL_' + d.key, { name: 'Laine ' + d.f, tex: tx('wool_' + lc(d.key), { type: 'wool', c: d.c }), hardness: 0.6, sound: 'wool' });
  fam('wool')[d.key] = NEXT - 1;
}
tx('wool', { type: 'wool', c: CM.DYES[0].c });
for (const d of CM.DYES) {
  const woolTex = d.key === 'WHITE' ? 'wool' : 'wool_' + lc(d.key);
  nb('CARPET_' + d.key, { name: 'Tapis ' + d.m, render: 'carpet', tex: woolTex, opaque: true, hardness: 0.1, sound: 'wool' });
  fam('carpet')[d.key] = NEXT - 1;
}
for (const d of CM.DYES) {
  nb('CONCRETE_' + d.key, { name: 'Béton ' + d.m, tex: tx('concrete_' + lc(d.key), { type: 'concrete', c: d.c }), hardness: 1.8, tool: 'pickaxe', tier: 1 });
  fam('concrete')[d.key] = NEXT - 1;
}
for (const d of CM.DYES) {
  nb('CONCRETE_POWDER_' + d.key, { name: 'Poudre de béton ' + d.f, tex: tx('concrete_powder_' + lc(d.key), { type: 'powder', c: d.c }), hardness: 0.5, tool: 'shovel', sound: 'sand', becomes: fam('concrete')[d.key] });
  fam('powder')[d.key] = NEXT - 1;
}
const OLD_TERRA = { WHITE: 71, YELLOW: 69, BROWN: 70, RED: 68 };
for (const d of CM.DYES) {
  if (OLD_TERRA[d.key]) {
    fam('terracotta')[d.key] = OLD_TERRA[d.key];
    continue;
  }
  nb('TERRACOTTA_' + d.key, { name: 'Terre cuite ' + d.f, tex: tx('terracotta_' + lc(d.key), { type: 'terracotta', c: terraColor(d.c) }), hardness: 1.25, tool: 'pickaxe', tier: 1 });
  fam('terracotta')[d.key] = NEXT - 1;
}
CM.DYES.forEach((d, i) => {
  nb('GLAZED_TERRACOTTA_' + d.key, { name: 'Terre cuite émaillée ' + d.f, tex: tx('glazed_' + lc(d.key), { type: 'glazed', c: d.c, p: i }), hardness: 1.4, tool: 'pickaxe', tier: 1 });
  fam('glazed')[d.key] = NEXT - 1;
});
for (const d of CM.DYES) {
  nb('STAINED_GLASS_' + d.key, { name: 'Verre teinté ' + d.m, render: 'tglass', tex: tx('stained_glass_' + lc(d.key), { type: 'sglass', c: d.c }), opaque: false, hardness: 0.4, sound: 'glass', drop: 0 });
  fam('sglass')[d.key] = NEXT - 1;
}

// ---- Nouvelles essences ----
const NEW_WOODS = [
  { key: 'DARK_OAK', name: 'chêne noir' },
  { key: 'CHERRY', name: 'cerisier', leavesName: 'Feuilles de cerisier' },
  { key: 'MANGROVE', name: 'palétuvier', saplingName: 'Propagule de palétuvier' },
  { key: 'CRIMSON', name: 'carmin', nether: true, logName: 'Tige carmin', planksName: 'Planches carmin', leavesName: 'Bloc de verrues du Nether', saplingName: 'Champignon carmin' },
  { key: 'WARPED', name: 'biscornu', nether: true, logName: 'Tige biscornue', planksName: 'Planches biscornues', leavesName: 'Bloc de verrues biscornues', saplingName: 'Champignon biscornu' },
];
for (const w of NEW_WOODS) {
  CM.WOODS.push(w);
  defWood(w, [NEXT, NEXT + 1, NEXT + 2, NEXT + 3]);
  NEXT += 4;
  nameWood(w);
}
nb('BAMBOO_BLOCK', { name: 'Bloc de bambou', tex: { top: 'bamboo_block_top', bottom: 'bamboo_block_top', side: 'bamboo_block_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
nb('STRIPPED_BAMBOO_BLOCK', { name: 'Bloc de bambou écorcé', tex: { top: 'stripped_bamboo_top', bottom: 'stripped_bamboo_top', side: 'stripped_bamboo_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
nb('BAMBOO_PLANKS', { name: 'Planches de bambou', tex: 'bamboo_planks', hardness: 1.5, tool: 'axe', sound: 'wood' });
nb('BAMBOO_MOSAIC', { name: 'Mosaïque de bambou', tex: 'bamboo_mosaic', hardness: 1.5, tool: 'axe', sound: 'wood' });
nb('BAMBOO', plant('Bambou', 'bamboo', { replaceable: false, hardness: 0.3, tool: 'axe', sound: 'wood', wave: true }));

// ---- Bûches écorcées, bois, bois écorcé (toutes les essences) ----
for (const w of CM.WOODS) {
  const t = w.key.toLowerCase();
  const n = w.nether;
  w.strippedLog = NEXT;
  nb('STRIPPED_' + w.key + '_LOG', {
    name: n ? w.logName + ' écorcée' : 'Bûche ' + de(w.name) + ' écorcée',
    tex: { top: 'stripped_' + t + '_top', bottom: 'stripped_' + t + '_top', side: 'stripped_' + t + '_side' }, hardness: 2, tool: 'axe', sound: 'wood', wood: w.key,
  });
  w.wood = NEXT;
  nb(w.key + '_WOOD', { name: n ? (w.key === 'CRIMSON' ? 'Hyphes carmin' : 'Hyphes biscornues') : 'Bois ' + de(w.name), tex: t + '_log_side', hardness: 2, tool: 'axe', sound: 'wood', wood: w.key });
  w.strippedWood = NEXT;
  nb('STRIPPED_' + w.key + '_WOOD', { name: n ? (w.key === 'CRIMSON' ? 'Hyphes carmin écorcées' : 'Hyphes biscornues écorcées') : 'Bois ' + de(w.name) + ' écorcé', tex: 'stripped_' + t + '_side', hardness: 2, tool: 'axe', sound: 'wood', wood: w.key });
}
nb('BOOKSHELF', { name: 'Bibliothèque', tex: { top: 'planks', bottom: 'planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood' });

// ---- Pierres, roches et blocs de construction ----
const rock = (key, name, tex, extra) => nb(key, Object.assign({ name, tex, hardness: 1.5, tool: 'pickaxe', tier: 1 }, extra || {}));
rock('SMOOTH_STONE', 'Pierre lisse', tx('smooth_stone', { type: 'smooth', c: [160, 160, 160] }), { hardness: 2 });
rock('CRACKED_STONEBRICK', 'Pierre taillée fissurée', tx('cracked_stonebrick', { type: 'cracked', from: 'stonebrick' }), { hardness: 2 });
rock('CHISELED_STONEBRICK', 'Pierre taillée sculptée', tx('chiseled_stonebrick', { type: 'chiseled', c: [128, 128, 128] }), { hardness: 2 });
rock('COBBLED_DEEPSLATE', 'Ardoise des abîmes taillée', tx('cobbled_deepslate', { type: 'cobble', c: [78, 78, 86] }), { hardness: 3 });
rock('POLISHED_DEEPSLATE', 'Ardoise des abîmes polie', tx('polished_deepslate', { type: 'polished', c: [72, 72, 78] }), { hardness: 3 });
rock('DEEPSLATE_BRICKS', "Briques d'ardoise des abîmes", tx('deepslate_bricks', { type: 'bricks', c: [76, 76, 82], m: [42, 42, 48], small: true }), { hardness: 3 });
rock('CRACKED_DEEPSLATE_BRICKS', "Briques d'ardoise des abîmes fissurées", tx('cracked_deepslate_bricks', { type: 'cracked', from: 'deepslate_bricks' }), { hardness: 3 });
rock('DEEPSLATE_TILES', "Tuiles d'ardoise des abîmes", tx('deepslate_tiles', { type: 'tiles', c: [56, 56, 62], m: [32, 32, 38] }), { hardness: 3 });
rock('CRACKED_DEEPSLATE_TILES', "Tuiles d'ardoise des abîmes fissurées", tx('cracked_deepslate_tiles', { type: 'cracked', from: 'deepslate_tiles' }), { hardness: 3 });
rock('CHISELED_DEEPSLATE', 'Ardoise des abîmes sculptée', tx('chiseled_deepslate', { type: 'chiseled', c: [66, 66, 72] }), { hardness: 3 });
rock('TUFF', 'Tuf', tx('tuff', { type: 'rock', c: [108, 109, 102], s: [[[88, 90, 84], 0.2], [[130, 130, 122], 0.12]] }));
rock('POLISHED_TUFF', 'Tuf poli', tx('polished_tuff', { type: 'polished', c: [112, 114, 106] }));
rock('TUFF_BRICKS', 'Briques de tuf', tx('tuff_bricks', { type: 'bricks', c: [110, 112, 104], m: [78, 80, 74], small: true }));
rock('CHISELED_TUFF', 'Tuf sculpté', tx('chiseled_tuff', { type: 'chiseled', c: [104, 106, 98] }));
rock('CALCITE', 'Calcite', tx('calcite', { type: 'rock', c: [222, 224, 220], s: [[[200, 202, 198], 0.15], [[240, 240, 238], 0.1]] }), { hardness: 0.8 });
rock('DRIPSTONE_BLOCK', 'Bloc de spéléothème', tx('dripstone', { type: 'streaks', c: [134, 107, 92] }));
rock('BLACKSTONE', 'Pierre noire', tx('blackstone', { type: 'rock', c: [42, 36, 42], s: [[[28, 24, 30], 0.2], [[62, 56, 64], 0.12]] }));
rock('POLISHED_BLACKSTONE', 'Pierre noire polie', tx('polished_blackstone', { type: 'polished', c: [54, 49, 58] }));
rock('POLISHED_BLACKSTONE_BRICKS', 'Briques de pierre noire polie', tx('polished_blackstone_bricks', { type: 'bricks', c: [50, 44, 52], m: [28, 24, 30] }));
rock('CRACKED_POLISHED_BLACKSTONE_BRICKS', 'Briques de pierre noire polie fissurées', tx('cracked_polished_blackstone_bricks', { type: 'cracked', from: 'polished_blackstone_bricks' }));
rock('CHISELED_POLISHED_BLACKSTONE', 'Pierre noire polie sculptée', tx('chiseled_polished_blackstone', { type: 'chiseled', c: [52, 46, 56] }));
rock('GILDED_BLACKSTONE', 'Pierre noire dorée', tx('gilded_blackstone', { type: 'ore', base: 'blackstone', c: [230, 176, 40], hi: [255, 230, 120], n: 7 }));
rock('BASALT', 'Basalte', { top: tx('basalt_top', { type: 'rings', c: [80, 80, 86] }), bottom: 'basalt_top', side: tx('basalt_side', { type: 'streaks', c: [78, 78, 84] }) }, { hardness: 1.25 });
rock('POLISHED_BASALT', 'Basalte poli', { top: tx('polished_basalt_top', { type: 'polished', c: [98, 98, 104] }), bottom: 'polished_basalt_top', side: tx('polished_basalt_side', { type: 'pillar', c: [96, 96, 102] }) }, { hardness: 1.25 });
rock('SMOOTH_BASALT', 'Basalte lisse', tx('smooth_basalt', { type: 'smooth', c: [72, 72, 78] }), { hardness: 1.25 });
rock('END_STONE', "Pierre de l'End", tx('end_stone', { type: 'rock', c: [220, 222, 158], s: [[[196, 198, 136], 0.22], [[236, 236, 184], 0.1]] }), { hardness: 3 });
rock('END_STONE_BRICKS', "Briques de pierre de l'End", tx('end_stone_bricks', { type: 'bricks', c: [220, 226, 164], m: [186, 190, 132] }), { hardness: 3 });
rock('PURPUR_BLOCK', 'Bloc de purpur', tx('purpur', { type: 'tiles', c: [169, 125, 169], m: [134, 96, 134] }));
rock('PURPUR_PILLAR', 'Pilier de purpur', { top: tx('purpur_pillar_top', { type: 'polished', c: [172, 130, 172] }), bottom: 'purpur_pillar_top', side: tx('purpur_pillar', { type: 'pillar', c: [171, 129, 171] }) });
rock('PRISMARINE', 'Prismarine', tx('prismarine', { type: 'mottled', c: [99, 156, 151], c2: [70, 120, 130] }));
rock('PRISMARINE_BRICKS', 'Briques de prismarine', tx('prismarine_bricks', { type: 'bricks', c: [99, 171, 158], m: [62, 124, 112] }));
rock('DARK_PRISMARINE', 'Prismarine sombre', tx('dark_prismarine', { type: 'tiles', c: [51, 91, 75], m: [32, 62, 50] }));
nb('SEA_LANTERN', { name: 'Lanterne aquatique', tex: tx('sea_lantern', { type: 'lamp', c: [224, 238, 232], c2: [150, 206, 196] }), hardness: 0.3, light: 15, sound: 'glass' });
rock('NETHERRACK', 'Roche du Nether', tx('netherrack', { type: 'rock', c: [111, 54, 52], s: [[[86, 36, 36], 0.25], [[140, 72, 70], 0.12]] }), { hardness: 0.4 });
rock('NETHER_BRICKS', 'Briques du Nether', tx('nether_bricks', { type: 'bricks', c: [48, 23, 28], m: [24, 12, 16], small: true }), { hardness: 2 });
rock('RED_NETHER_BRICKS', 'Briques du Nether rouges', tx('red_nether_bricks', { type: 'bricks', c: [72, 8, 10], m: [40, 4, 6], small: true }), { hardness: 2 });
rock('CRACKED_NETHER_BRICKS', 'Briques du Nether fissurées', tx('cracked_nether_bricks', { type: 'cracked', from: 'nether_bricks' }), { hardness: 2 });
rock('CHISELED_NETHER_BRICKS', 'Briques du Nether sculptées', tx('chiseled_nether_bricks', { type: 'chiseled', c: [50, 24, 30] }), { hardness: 2 });
rock('QUARTZ_BLOCK', 'Bloc de quartz', tx('quartz_block', { type: 'smooth', c: [236, 230, 223] }), { hardness: 0.8 });
rock('CHISELED_QUARTZ', 'Bloc de quartz sculpté', tx('chiseled_quartz', { type: 'chiseled', c: [232, 227, 218] }), { hardness: 0.8 });
rock('QUARTZ_PILLAR', 'Pilier de quartz', { top: tx('quartz_pillar_top', { type: 'polished', c: [236, 231, 224] }), bottom: 'quartz_pillar_top', side: tx('quartz_pillar', { type: 'pillar', c: [235, 230, 222] }) }, { hardness: 0.8 });
rock('QUARTZ_BRICKS', 'Briques de quartz', tx('quartz_bricks', { type: 'bricks', c: [234, 229, 221], m: [204, 196, 186] }), { hardness: 0.8 });
rock('SMOOTH_QUARTZ', 'Quartz lisse', tx('smooth_quartz', { type: 'flat', c: [238, 233, 226] }), { hardness: 2 });
nb('SOUL_SAND', { name: 'Sable des âmes', tex: tx('soul_sand', { type: 'soul', c: [81, 62, 50] }), hardness: 0.5, tool: 'shovel', sound: 'sand', slow: 0.5 });
nb('SOUL_SOIL', { name: 'Terre des âmes', tex: tx('soul_soil', { type: 'rock', c: [75, 57, 46], s: [[[58, 44, 36], 0.2], [[94, 74, 60], 0.1]] }), hardness: 0.5, tool: 'shovel', sound: 'gravel' });
nb('GLOWSTONE', { name: 'Pierre lumineuse', tex: tx('glowstone', { type: 'lamp', c: [250, 212, 124], c2: [176, 124, 58] }), hardness: 0.3, light: 15, sound: 'glass' });
rock('MAGMA', 'Bloc de magma', tx('magma', { type: 'magma', c: [140, 60, 20] }), { hardness: 0.5, light: 3, hurts: 1 });
rock('OBSIDIAN', 'Obsidienne', tx('obsidian', { type: 'rock', c: [22, 18, 34], s: [[[46, 30, 70], 0.18], [[10, 8, 16], 0.2]] }), { hardness: 12, tier: 4 });
rock('CRYING_OBSIDIAN', 'Obsidienne pleureuse', tx('crying_obsidian', { type: 'ore', base: 'obsidian', c: [140, 40, 230], hi: [220, 140, 255], n: 5 }), { hardness: 12, tier: 4, light: 10 });
rock('SMOOTH_SANDSTONE', 'Grès lisse', tx('smooth_sandstone', { type: 'flat', c: [216, 203, 155] }), { hardness: 2 });
rock('CUT_SANDSTONE', 'Grès taillé', { top: 'sandstone_top', bottom: 'sandstone_top', side: tx('cut_sandstone', { type: 'cut', c: [216, 200, 150], m: [190, 172, 124] }) }, { hardness: 0.8 });
rock('SMOOTH_RED_SANDSTONE', 'Grès rouge lisse', tx('smooth_red_sandstone', { type: 'flat', c: [181, 98, 36] }), { hardness: 2 });
rock('CUT_RED_SANDSTONE', 'Grès rouge taillé', { top: 'red_sandstone_top', bottom: 'red_sandstone_top', side: tx('cut_red_sandstone', { type: 'cut', c: [184, 100, 42], m: [152, 78, 32] }) }, { hardness: 0.8 });
rock('CHISELED_RED_SANDSTONE', 'Grès rouge sculpté', { top: 'red_sandstone_top', bottom: 'red_sandstone_top', side: tx('chiseled_red_sandstone', { type: 'chiseled', c: [180, 96, 40] }) }, { hardness: 0.8 });
rock('MUD_BRICKS', 'Briques de boue', tx('mud_bricks', { type: 'bricks', c: [140, 106, 80], m: [104, 78, 58] }));
nb('PACKED_MUD', { name: 'Boue compacte', tex: tx('packed_mud', { type: 'rock', c: [142, 107, 80], s: [[[120, 88, 64], 0.18], [[160, 124, 96], 0.1]] }), hardness: 1, tool: 'pickaxe', sound: 'gravel' });
nb('AMETHYST_BLOCK', { name: "Bloc d'améthyste", tex: tx('amethyst_block', { type: 'gem', c: [134, 98, 191] }), hardness: 1.5, tool: 'pickaxe', tier: 1, sound: 'glass' });
nb('BUDDING_AMETHYST', { name: 'Améthyste bourgeonnante', tex: tx('budding_amethyst', { type: 'ore', base: 'amethyst_block', c: [200, 170, 250], hi: [250, 240, 255], n: 5 }), hardness: 1.5, tool: 'pickaxe', tier: 1, sound: 'glass', drop: 0 });
nb('MOSS_BLOCK', { name: 'Bloc de mousse', tex: tx('moss', { type: 'rock', c: [89, 109, 45], s: [[[70, 90, 34], 0.25], [[112, 134, 58], 0.15]] }), hardness: 0.1, tool: 'axe', sound: 'grass', soil: true });
nb('COARSE_DIRT', { name: 'Terre stérile', tex: tx('coarse_dirt', { type: 'rock', c: [119, 85, 59], s: [[[92, 64, 44], 0.2], [[140, 130, 120], 0.08], [[150, 108, 76], 0.08]] }), hardness: 0.5, tool: 'shovel', sound: 'gravel', soil: true });
nb('ROOTED_DIRT', { name: 'Terre racinée', tex: tx('rooted_dirt', { type: 'roots', c: [144, 104, 76] }), hardness: 0.5, tool: 'shovel', sound: 'gravel', soil: true });
nb('MYCELIUM', { name: 'Mycélium', tex: { top: tx('mycelium_top', { type: 'rock', c: [111, 98, 104], s: [[[92, 80, 90], 0.2], [[150, 136, 150], 0.1]] }), bottom: 'dirt', side: tx('mycelium_side', { type: 'grassside', c: [111, 98, 104] }) }, hardness: 0.6, tool: 'shovel', sound: 'grass', drop: 2, soil: true });
nb('PACKED_ICE', { name: 'Glace compactée', tex: tx('packed_ice', { type: 'ice', c: [141, 180, 250] }), hardness: 0.5, tool: 'pickaxe', sound: 'glass', slip: 0.98 });
nb('BLUE_ICE', { name: 'Glace bleue', tex: tx('blue_ice', { type: 'ice', c: [116, 167, 253] }), hardness: 2.8, tool: 'pickaxe', sound: 'glass', slip: 0.99 });
nb('SNOW_LAYER', { name: 'Couche de neige', render: 'carpet', height: 2 / 16, tex: 'snow', opaque: true, hardness: 0.1, tool: 'shovel', sound: 'sand', replaceable: true });
nb('SPONGE', { name: 'Éponge', tex: tx('sponge', { type: 'sponge', c: [195, 192, 74] }), hardness: 0.6, sound: 'grass' });
nb('WET_SPONGE', { name: 'Éponge mouillée', tex: tx('wet_sponge', { type: 'sponge', c: [171, 181, 70] }), hardness: 0.6, sound: 'grass' });
nb('HAY_BLOCK', { name: 'Botte de foin', tex: { top: tx('hay_top', { type: 'hay', c: [180, 148, 40], top: true }), bottom: 'hay_top', side: tx('hay_side', { type: 'hay', c: [180, 148, 40] }) }, hardness: 0.5, tool: 'axe', sound: 'grass' });
nb('BONE_BLOCK', { name: "Bloc d'os", tex: { top: tx('bone_top', { type: 'rings', c: [229, 225, 207] }), bottom: 'bone_top', side: tx('bone_side', { type: 'pillar', c: [229, 225, 207] }) }, hardness: 2, tool: 'pickaxe', tier: 1 });
nb('DRIED_KELP_BLOCK', { name: "Bloc d'algues séchées", tex: tx('dried_kelp', { type: 'hay', c: [58, 66, 40] }), hardness: 0.5, sound: 'grass' });
nb('HONEYCOMB_BLOCK', { name: 'Bloc de rayon de miel', tex: tx('honeycomb_block', { type: 'honeycomb', c: [229, 148, 29] }), hardness: 0.6, sound: 'wool' });
nb('SLIME_BLOCK', { name: 'Bloc de slime', render: 'tglass', opaque: false, tex: tx('slime_block', { type: 'jelly', c: [115, 192, 91] }), hardness: 0.1, sound: 'grass', bounce: true });
nb('HONEY_BLOCK', { name: 'Bloc de miel', render: 'tglass', opaque: false, tex: tx('honey_block', { type: 'jelly', c: [251, 185, 52] }), hardness: 0.1, sound: 'grass', slow: 0.35 });
nb('RED_MUSHROOM_BLOCK', { name: 'Bloc de champignon rouge', tex: tx('red_mushroom_block', { type: 'shroomblock', c: [200, 46, 45], spots: true }), hardness: 0.2, tool: 'axe', sound: 'wood', drop: 92 });
nb('BROWN_MUSHROOM_BLOCK', { name: 'Bloc de champignon brun', tex: tx('brown_mushroom_block', { type: 'shroomblock', c: [149, 111, 81] }), hardness: 0.2, tool: 'axe', sound: 'wood', drop: 93 });
nb('MUSHROOM_STEM', { name: 'Pied de champignon', tex: tx('mushroom_stem', { type: 'stem', c: [203, 196, 185] }), hardness: 0.2, tool: 'axe', sound: 'wood' });
const CORALS = [['TUBE', 'tubulaire', [49, 87, 207]], ['BRAIN', 'cerveau', [207, 91, 159]], ['BUBBLE', 'bulles', [165, 26, 162]], ['FIRE', 'de feu', [163, 35, 46]], ['HORN', 'corné', [216, 199, 66]]];
for (const [k, n, c] of CORALS) nb(k + '_CORAL_BLOCK', { name: 'Bloc de corail ' + n, tex: tx(lc(k) + '_coral', { type: 'coral', c }), hardness: 1.5, tool: 'pickaxe', tier: 1, sound: 'grass' });
for (const [k, n] of CORALS) nb('DEAD_' + k + '_CORAL_BLOCK', { name: 'Bloc de corail ' + n + ' mort', tex: tx('dead_' + lc(k) + '_coral', { type: 'coral', c: [132, 124, 120] }), hardness: 1.5, tool: 'pickaxe', tier: 1 });
nb('SCULK', { name: 'Sculk', tex: tx('sculk', { type: 'sculk', c: [13, 30, 36] }), hardness: 0.2, tool: 'shovel', sound: 'grass', light: 1 });
nb('SHROOMLIGHT', { name: 'Champilampe', tex: tx('shroomlight', { type: 'lamp', c: [240, 150, 74], c2: [196, 88, 40] }), hardness: 1, tool: 'axe', light: 15, sound: 'wool' });
nb('OCHRE_FROGLIGHT', { name: 'Grenouillampe ocre', tex: tx('ochre_froglight', { type: 'froglight', c: [251, 244, 206], c2: [236, 204, 110] }), hardness: 0.3, light: 15, sound: 'wool' });
nb('VERDANT_FROGLIGHT', { name: 'Grenouillampe verdoyante', tex: tx('verdant_froglight', { type: 'froglight', c: [232, 250, 222], c2: [150, 214, 130] }), hardness: 0.3, light: 15, sound: 'wool' });
nb('PEARLESCENT_FROGLIGHT', { name: 'Grenouillampe nacrée', tex: tx('pearlescent_froglight', { type: 'froglight', c: [248, 238, 246], c2: [224, 180, 222] }), hardness: 0.3, light: 15, sound: 'wool' });
nb('REDSTONE_LAMP', { name: 'Lampe à redstone', tex: tx('redstone_lamp', { type: 'lamp', c: [240, 186, 120], c2: [150, 70, 40] }), hardness: 0.3, light: 15, sound: 'glass' });
const COPPERS = [['EXPOSED', 'exposé', [161, 125, 103]], ['WEATHERED', 'altéré', [108, 153, 110]], ['OXIDIZED', 'oxydé', [82, 162, 132]]];
for (const [k, n, c] of COPPERS) nb(k + '_COPPER', { name: 'Cuivre ' + n, tex: tx(lc(k) + '_copper', { type: 'metal', c }), hardness: 3, tool: 'pickaxe', tier: 2, sound: 'metal' });
nb('CUT_COPPER', { name: 'Cuivre taillé', tex: tx('cut_copper', { type: 'tiles', c: [192, 107, 79], m: [150, 80, 58] }), hardness: 3, tool: 'pickaxe', tier: 2, sound: 'metal' });
for (const [k, n, c] of COPPERS) nb(k + '_CUT_COPPER', { name: 'Cuivre taillé ' + n, tex: tx(lc(k) + '_cut_copper', { type: 'tiles', c, m: mulc(c, 0.75) }), hardness: 3, tool: 'pickaxe', tier: 2, sound: 'metal' });
nb('RAW_IRON_BLOCK', { name: 'Bloc de fer brut', tex: tx('raw_iron_block', { type: 'raw', c: [166, 135, 107] }), hardness: 3, tool: 'pickaxe', tier: 2 });
nb('RAW_GOLD_BLOCK', { name: "Bloc d'or brut", tex: tx('raw_gold_block', { type: 'raw', c: [221, 169, 46] }), hardness: 3, tool: 'pickaxe', tier: 3 });
nb('RAW_COPPER_BLOCK', { name: 'Bloc de cuivre brut', tex: tx('raw_copper_block', { type: 'raw', c: [154, 105, 79] }), hardness: 3, tool: 'pickaxe', tier: 2 });

// ---- Minerais et blocs précieux ----
const oreB = (key, name, base, c, hi, tier, extra) =>
  nb(key, Object.assign({ name, tex: tx(lc(key), { type: 'ore', base, c, hi, n: 6 }), hardness: base === 'deepstone' ? 4.5 : 3, tool: 'pickaxe', tier, ore: true }, extra || {}));
oreB('DIAMOND_ORE', 'Minerai de diamant', 'stone', [93, 236, 226], [210, 255, 250], 3);
oreB('EMERALD_ORE', "Minerai d'émeraude", 'stone', [23, 221, 98], [170, 255, 200], 3);
oreB('LAPIS_ORE', 'Minerai de lapis-lazuli', 'stone', [31, 64, 182], [90, 130, 240], 2);
oreB('REDSTONE_ORE', 'Minerai de redstone', 'stone', [200, 16, 16], [255, 110, 100], 3);
oreB('NETHER_QUARTZ_ORE', 'Minerai de quartz du Nether', 'netherrack', [235, 230, 222], [255, 255, 255], 1);
oreB('NETHER_GOLD_ORE', "Minerai d'or du Nether", 'netherrack', [240, 190, 50], [255, 240, 150], 1);
nb('ANCIENT_DEBRIS', { name: 'Débris antiques', tex: { top: tx('ancient_debris_top', { type: 'rings', c: [96, 66, 58] }), bottom: 'ancient_debris_top', side: tx('ancient_debris_side', { type: 'debris', c: [96, 66, 58] }) }, hardness: 15, tool: 'pickaxe', tier: 4, ore: true });
const DS_ORES = [['COAL', 'charbon', [38, 38, 40], [80, 80, 86], 1], ['IRON', 'fer', [206, 160, 124], [240, 206, 176], 2], ['COPPER', 'cuivre', [206, 116, 72], [236, 170, 120], 2], ['GOLD', 'or', [236, 196, 60], [255, 240, 150], 3],
  ['DIAMOND', 'diamant', [93, 236, 226], [210, 255, 250], 3], ['EMERALD', 'émeraude', [23, 221, 98], [170, 255, 200], 3], ['LAPIS', 'lapis-lazuli', [31, 64, 182], [90, 130, 240], 2], ['REDSTONE', 'redstone', [200, 16, 16], [255, 110, 100], 3]];
for (const [k, n, c, hi, tier] of DS_ORES) oreB('DEEPSLATE_' + k + '_ORE', 'Minerai ' + de(n) + ' des abîmes', 'deepstone', c, hi, tier);
nb('DIAMOND_BLOCK', { name: 'Bloc de diamant', tex: tx('diamond_block', { type: 'gem', c: [98, 237, 228] }), hardness: 5, tool: 'pickaxe', tier: 3, sound: 'metal' });
nb('EMERALD_BLOCK', { name: "Bloc d'émeraude", tex: tx('emerald_block', { type: 'gem', c: [42, 203, 87] }), hardness: 5, tool: 'pickaxe', tier: 3, sound: 'metal' });
nb('LAPIS_BLOCK', { name: 'Bloc de lapis-lazuli', tex: tx('lapis_block', { type: 'rock', c: [31, 67, 140], s: [[[20, 44, 110], 0.2], [[70, 110, 200], 0.1], [[210, 180, 80], 0.02]] }), hardness: 3, tool: 'pickaxe', tier: 2 });
nb('REDSTONE_BLOCK', { name: 'Bloc de redstone', tex: tx('redstone_block', { type: 'metal', c: [175, 24, 5] }), hardness: 5, tool: 'pickaxe', tier: 1, light: 3, sound: 'metal' });
nb('NETHERITE_BLOCK', { name: 'Bloc de netherite', tex: tx('netherite_block', { type: 'metal', c: [66, 61, 63] }), hardness: 25, tool: 'pickaxe', tier: 4, sound: 'metal' });

// ---- Blocs utilitaires et décoratifs ----
const wdn = (key, name, tex, extra) => nb(key, Object.assign({ name, tex, hardness: 2.5, tool: 'axe', sound: 'wood' }, extra || {}));
nb('TNT', { name: 'TNT', tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, sound: 'grass', tnt: true });
wdn('CARTOGRAPHY_TABLE', 'Table de cartographie', { top: 'cartography_top', bottom: 'planks', side: 'cartography_side' });
wdn('FLETCHING_TABLE', "Table d'archerie", { top: 'fletching_top', bottom: 'birch_planks', side: 'fletching_side' });
wdn('SMITHING_TABLE', 'Table de forgeron', { top: 'smithing_top', bottom: 'smithing_bottom', side: 'smithing_side' }, { station: 'smithing' });
wdn('LOOM', 'Métier à tisser', { top: 'loom_top', bottom: 'planks', side: 'loom_side' });
wdn('BARREL', 'Tonneau', { top: 'barrel_top', bottom: 'barrel_top', side: 'barrel_side' }, { container: true });
wdn('BEEHIVE', 'Ruche', { top: 'beehive_top', bottom: 'beehive_top', side: 'beehive_side', front: 'beehive_front' });
wdn('JUKEBOX', 'Juke-box', { top: 'jukebox_top', bottom: 'planks', side: 'jukebox_side' });
wdn('NOTE_BLOCK', 'Bloc musical', tx('note_block', { type: 'custom', f: 'note_block' }), { note: true });
nb('TARGET', { name: 'Cible', tex: { top: 'target_top', bottom: 'target_top', side: 'target_side' }, hardness: 0.5, sound: 'grass' });
nb('FURNACE', { name: 'Fourneau', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1, station: 'forge', light: 8 });
nb('BLAST_FURNACE', { name: 'Haut fourneau', tex: { top: 'blast_top', bottom: 'blast_top', side: 'blast_side', front: 'blast_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1, station: 'forge', light: 8, sound: 'metal' });
nb('SMOKER', { name: 'Fumoir', tex: { top: 'smoker_top', bottom: 'smoker_bottom', side: 'smoker_side', front: 'smoker_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1, station: 'forge', light: 8 });
nb('DISPENSER', { name: 'Distributeur', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'dispenser_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1 });
nb('DROPPER', { name: 'Dropper', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'dropper_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1 });
nb('OBSERVER', { name: 'Observateur', tex: { top: 'observer_top', bottom: 'observer_top', side: 'observer_side', front: 'observer_front' }, hardness: 3, tool: 'pickaxe', tier: 1 });
nb('CARVED_PUMPKIN', { name: 'Citrouille sculptée', tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'carved_pumpkin' }, hardness: 1, tool: 'axe', sound: 'wood' });
nb('TINTED_GLASS', { name: 'Verre fumé', render: 'glass', tex: 'tinted_glass', opaque: false, hardness: 0.4, sound: 'glass' });
nb('SOUL_LANTERN', { name: 'Lanterne des âmes', tex: { top: 'soul_lantern_top', bottom: 'soul_lantern_top', side: 'soul_lantern_side' }, hardness: 1, tool: 'pickaxe', light: 10, sound: 'metal' });
nb('SOUL_TORCH', { name: 'Torche des âmes', render: 'torch', tex: 'soul_torch', solid: false, opaque: false, light: 10, hardness: 0, sound: 'wood' });

// ---- Plantes ----
const flowerB = (key, name, spec, extra) => nb(key, plant(name, tx(lc(key), spec), extra));
flowerB('ALLIUM', 'Allium', { type: 'flower', petal: [180, 110, 230], center: [120, 60, 170], style: 'ball' });
flowerB('AZURE_BLUET', 'Houstonie bleue', { type: 'flower', petal: [236, 240, 250], center: [240, 220, 90], style: 'small' });
flowerB('BLUE_ORCHID', 'Orchidée bleue', { type: 'flower', petal: [40, 170, 230], center: [20, 110, 180], style: 'orchid' });
flowerB('LILY_OF_THE_VALLEY', 'Muguet', { type: 'flower', petal: [250, 250, 244], center: [210, 220, 200], style: 'bells' });
flowerB('RED_TULIP', 'Tulipe rouge', { type: 'flower', petal: [220, 40, 40], center: [160, 20, 20], style: 'tulip' });
flowerB('WHITE_TULIP', 'Tulipe blanche', { type: 'flower', petal: [240, 240, 236], center: [200, 210, 200], style: 'tulip' });
flowerB('PINK_TULIP', 'Tulipe rose', { type: 'flower', petal: [240, 160, 200], center: [210, 110, 160], style: 'tulip' });
flowerB('WITHER_ROSE', 'Rose de Wither', { type: 'flower', petal: [36, 30, 32], center: [70, 60, 60], style: 'rose' });
flowerB('SUNFLOWER', 'Tournesol', { type: 'flower', petal: [250, 206, 40], center: [120, 70, 30], style: 'big' });
flowerB('LILAC', 'Lilas', { type: 'flower', petal: [206, 150, 214], center: [170, 110, 190], style: 'ball' });
flowerB('PEONY', 'Pivoine', { type: 'flower', petal: [236, 178, 222], center: [210, 130, 190], style: 'big' });
flowerB('ROSE_BUSH', 'Rosier', { type: 'flower', petal: [200, 20, 30], center: [140, 10, 20], style: 'bush' });
flowerB('TORCHFLOWER', 'Torche-fleur', { type: 'flower', petal: [250, 140, 30], center: [250, 220, 90], style: 'tulip' }, { light: 5 });
nb('SUGAR_CANE', plant('Canne à sucre', tx('sugar_cane', { type: 'reeds', c: [148, 192, 101] }), { replaceable: false, soilAny: true }));
flowerB('CRIMSON_ROOTS', 'Racines carmin', { type: 'rootsplant', c: [126, 8, 41] }, { soilAny: true });
flowerB('WARPED_ROOTS', 'Racines biscornues', { type: 'rootsplant', c: [20, 150, 132] }, { soilAny: true });
flowerB('NETHER_SPROUTS', 'Pousses du Nether', { type: 'sprouts', c: [20, 170, 150] }, { soilAny: true });
flowerB('AZALEA', 'Azalée', { type: 'bush', c: [100, 128, 46] }, { replaceable: false });
flowerB('FLOWERING_AZALEA', 'Azalée fleurie', { type: 'bush', c: [100, 128, 46], flowers: [214, 110, 200] }, { replaceable: false });
for (const [k, n, c] of CORALS) nb(k + '_CORAL_FAN', plant('Gorgone ' + n, tx(lc(k) + '_coral_fan', { type: 'fan', c }), { soilAny: true, wave: false }));
nb('MOSS_CARPET', { name: 'Tapis de mousse', render: 'carpet', tex: 'moss', opaque: true, hardness: 0.1, sound: 'grass' });

// ---- Cultures ----
nb('FARMLAND', { name: 'Terre labourée', render: 'slab', height: 15 / 16, tex: { top: 'farmland_top', bottom: 'dirt', side: 'dirt' }, opaque: true, hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 2, farmland: true });
for (let s = 0; s < 4; s++) nb('WHEAT_' + s, plant(s === 3 ? 'Blé mûr' : 'Blé (stade ' + (s + 1) + ')', 'wheat_' + s, { replaceable: false, drop: 0, crop: s, needsFarmland: true }));

// ---- Dalles ----
// Chaque dalle référence son bloc plein : deux dalles l'une sur l'autre redonnent le bloc.
CM.SLABS = [];
const slab = (base, key) => {
  const b = CM.blocks[base];
  nb((key || b.key) + '_SLAB', { name: 'Dalle ' + slabName(b.name), render: 'slab', opaque: true, tex: Object.assign({}, b.tex), hardness: b.hardness, tool: b.tool, tier: b.tier, sound: b.sound, full: base });
  CM.blocks[base].slab = NEXT - 1;
  CM.SLABS.push(NEXT - 1);
};
// « Pierre taillée » -> « de pierre taillée », « Planches de chêne » -> « de chêne »...
function slabName(n) {
  if (/^Planches /.test(n)) return n.replace(/^Planches /, '');
  if (/^Bloc de /.test(n)) return n.replace(/^Bloc /, '');
  const low = n.charAt(0).toLowerCase() + n.slice(1);
  return de(low);
}
for (const k of ['STONE', 'COBBLE', 'STONEBRICK', 'SMOOTH_STONE', 'MOSSY_COBBLE', 'MOSSY_STONEBRICK', 'SANDSTONE', 'SMOOTH_SANDSTONE', 'CUT_SANDSTONE', 'RED_SANDSTONE',
  'SMOOTH_RED_SANDSTONE', 'BRICKS', 'MUD_BRICKS', 'GRANITE', 'POLISHED_GRANITE', 'DIORITE', 'POLISHED_DIORITE', 'ANDESITE', 'POLISHED_ANDESITE', 'COBBLED_DEEPSLATE',
  'POLISHED_DEEPSLATE', 'DEEPSLATE_BRICKS', 'DEEPSLATE_TILES', 'TUFF', 'TUFF_BRICKS', 'BLACKSTONE', 'POLISHED_BLACKSTONE', 'POLISHED_BLACKSTONE_BRICKS', 'NETHER_BRICKS',
  'RED_NETHER_BRICKS', 'QUARTZ_BLOCK', 'SMOOTH_QUARTZ', 'PURPUR_BLOCK', 'END_STONE_BRICKS', 'PRISMARINE', 'PRISMARINE_BRICKS', 'DARK_PRISMARINE', 'CUT_COPPER',
  'EXPOSED_CUT_COPPER', 'WEATHERED_CUT_COPPER', 'OXIDIZED_CUT_COPPER']) slab(CM.B[k]);
for (const w of CM.WOODS) slab(w.planks);
CM.blocks[CM.blocks[CM.B.WARPED_PLANKS].slab].name = 'Dalle biscornue';
slab(CM.B.BAMBOO_PLANKS);
slab(CM.B.BAMBOO_MOSAIC);

// ---- Sols fongiques (forêts fongiques) ----
nb('CRIMSON_NYLIUM', { name: 'Nylium carmin', tex: { top: tx('crimson_nylium_top', { type: 'rock', c: [130, 24, 30], s: [[[160, 40, 44], 0.2], [[96, 14, 20], 0.2]] }), bottom: 'netherrack', side: tx('crimson_nylium_side', { type: 'nylium', c: [130, 24, 30] }) }, hardness: 0.4, tool: 'pickaxe', tier: 1, drop: 0, soil: true });
nb('WARPED_NYLIUM', { name: 'Nylium biscornu', tex: { top: tx('warped_nylium_top', { type: 'rock', c: [40, 114, 104], s: [[[60, 150, 136], 0.2], [[26, 84, 76], 0.2]] }), bottom: 'netherrack', side: tx('warped_nylium_side', { type: 'nylium', c: [40, 114, 104] }) }, hardness: 0.4, tool: 'pickaxe', tier: 1, drop: 0, soil: true });
CM.blocks[CM.B.CRIMSON_NYLIUM].drop = CM.B.NETHERRACK;
CM.blocks[CM.B.WARPED_NYLIUM].drop = CM.B.NETHERRACK;
CM.BLOCK_COUNT = NEXT;

// Les blocs qui laissent passer la lumière sans atténuation.
for (const b of CM.blocks) if (b) b.lightPass = !b.lightOpaque;

// -------------------------------------------------------------- Objets ----
// Objets (id >= 1000). Les blocs sont aussi des objets (id < 1000).
CM.items = [];
CM.I = {};
function defItem(id, key, d) {
  const def = Object.assign({ id, key, name: key, tex: key.toLowerCase(), stack: 64, type: 'material' }, d);
  CM.items[id] = def;
  CM.I[key] = id;
  return def;
}
// Nourriture : food = points de faim rendus, sat = saturation.
defItem(1000, 'STICK', { name: 'Bâton', tex: 'stick' });
defItem(1001, 'FIBER', { name: 'Fibre végétale', tex: 'fiber' });
defItem(1002, 'ROPE', { name: 'Corde', tex: 'rope' });
defItem(1003, 'IRON_INGOT', { name: 'Lingot de fer', tex: 'iron_ingot' });
defItem(1004, 'COAL', { name: 'Charbon', tex: 'coal' });
defItem(1005, 'SHADOW_ESSENCE', { name: "Essence d'ombre", tex: 'shadow_essence' });
defItem(1006, 'CRYSTAL', { name: 'Cristal', tex: 'crystal' });
defItem(1007, 'SKY_SHARD', { name: 'Éclat céleste', tex: 'sky_shard' });
defItem(1008, 'BERRIES', { name: 'Baies', tex: 'berries', type: 'food', food: 2, sat: 1.2 });
defItem(1009, 'RAW_MEAT', { name: 'Viande crue', tex: 'raw_meat', type: 'food', food: 3, sat: 1.8 });
defItem(1010, 'COOKED_MEAT', { name: 'Viande grillée', tex: 'cooked_meat', type: 'food', food: 8, sat: 12.8 });
defItem(1011, 'GRAPPLE', { name: 'Grappin', tex: 'grapple', stack: 1, type: 'grapple' });
defItem(1012, 'FEATHER_CHARM', { name: 'Amulette de plume', tex: 'feather_charm', stack: 1, type: 'charm', desc: 'Dans ton inventaire : double saut.' });
defItem(1013, 'STAMINA_CHARM', { name: 'Amulette de satiété', tex: 'stamina_charm', stack: 1, type: 'charm', desc: 'Dans ton inventaire : tu as faim deux fois moins vite.' });
defItem(1014, 'APPLE', { name: 'Pomme', tex: 'apple', type: 'food', food: 4, sat: 2.4 });
defItem(1015, 'GOLDEN_APPLE', { name: 'Pomme dorée', tex: 'golden_apple', type: 'food', food: 4, sat: 9.6, regen: 20, always: true });
defItem(1016, 'MELON_SLICE', { name: 'Tranche de pastèque', tex: 'melon_slice', type: 'food', food: 2, sat: 1.2 });
defItem(1017, 'MUSHROOM_STEW', { name: 'Soupe de champignons', tex: 'mushroom_stew', type: 'food', food: 6, sat: 7.2, stack: 16 });
defItem(1018, 'COPPER_INGOT', { name: 'Lingot de cuivre', tex: 'copper_ingot' });
defItem(1019, 'GOLD_INGOT', { name: "Lingot d'or", tex: 'gold_ingot' });
defItem(1020, 'RUBY', { name: 'Rubis', tex: 'ruby' });
defItem(1021, 'FEATHER', { name: 'Plume', tex: 'feather' });
defItem(1022, 'RUBY_CHARM', { name: 'Amulette de rubis', tex: 'ruby_charm', stack: 1, type: 'charm', desc: 'Dans ton inventaire : +2 cœurs de vie max.' });
defItem(1023, 'PUMPKIN_PIE', { name: 'Tarte à la citrouille', tex: 'pumpkin_pie', type: 'food', food: 8, sat: 4.8, stack: 16 });

// Nouveaux objets (v4)
defItem(1100, 'DIAMOND', { name: 'Diamant', tex: 'diamond' });
defItem(1101, 'EMERALD', { name: 'Émeraude', tex: 'emerald' });
defItem(1102, 'LAPIS', { name: 'Lapis-lazuli', tex: 'lapis' });
defItem(1103, 'REDSTONE', { name: 'Poudre de redstone', tex: 'redstone' });
defItem(1104, 'QUARTZ', { name: 'Quartz du Nether', tex: 'quartz' });
defItem(1105, 'AMETHYST_SHARD', { name: "Éclat d'améthyste", tex: 'amethyst_shard' });
defItem(1106, 'NETHERITE_SCRAP', { name: 'Fragment de netherite', tex: 'netherite_scrap' });
defItem(1107, 'NETHERITE_INGOT', { name: 'Lingot de netherite', tex: 'netherite_ingot' });
defItem(1108, 'LEATHER', { name: 'Cuir', tex: 'leather' });
defItem(1109, 'PAPER', { name: 'Papier', tex: 'paper' });
defItem(1110, 'BOOK', { name: 'Livre', tex: 'book' });
defItem(1111, 'SUGAR', { name: 'Sucre', tex: 'sugar' });
defItem(1112, 'BONE_MEAL', { name: "Poudre d'os", tex: 'bone_meal', type: 'bonemeal' });
defItem(1113, 'SEEDS', { name: 'Graines de blé', tex: 'seeds', type: 'seeds' });
defItem(1114, 'WHEAT', { name: 'Blé', tex: 'wheat' });
defItem(1115, 'BREAD', { name: 'Pain', tex: 'bread', type: 'food', food: 5, sat: 6 });
defItem(1116, 'SLIMEBALL', { name: 'Boule de slime', tex: 'slimeball' });
defItem(1117, 'HONEYCOMB', { name: 'Rayon de miel', tex: 'honeycomb' });
defItem(1118, 'GLOWSTONE_DUST', { name: 'Poudre lumineuse', tex: 'glowstone_dust' });
defItem(1119, 'FLINT', { name: 'Silex', tex: 'flint' });
defItem(1120, 'FLINT_AND_STEEL', { name: 'Briquet', tex: 'flint_and_steel', stack: 1, type: 'igniter' });
defItem(1121, 'COOKED_BERRIES', { name: 'Confiture de baies', tex: 'berry_jam', type: 'food', food: 4, sat: 4.8, stack: 16 });
defItem(1122, 'HONEY_BOTTLE', { name: 'Fiole de miel', tex: 'honey_bottle', type: 'food', food: 6, sat: 1.2, stack: 16 });
CM.DYE_ITEM = {};
CM.DYES.forEach((d, i) => {
  defItem(1130 + i, 'DYE_' + d.key, { name: 'Teinture ' + d.f, tex: 'dye_' + lc(d.key), dye: d.key });
  CM.DYE_ITEM[d.key] = 1130 + i;
});

// ------------------------------------------------------------ Outils ------
// Matériaux : tier = niveau de récolte (bois 1, pierre 2, fer 3, cristal/diamant 4, netherite 5).
CM.TOOL_MATS = [
  { key: 'WOOD', name: 'bois', tier: 1, speed: 2.2, dmg: 4, color: { h: [178, 138, 84], H: [206, 166, 110], d: [132, 98, 58] } },
  { key: 'STONE', name: 'pierre', tier: 2, speed: 4, dmg: 5, color: { h: [138, 138, 140], H: [170, 170, 174], d: [96, 96, 100] } },
  { key: 'IRON', name: 'fer', tier: 3, speed: 6, dmg: 6, color: { h: [214, 214, 222], H: [244, 244, 250], d: [150, 150, 162] } },
  { key: 'CRYSTAL', name: 'cristal', tier: 4, speed: 9, dmg: 8, color: { h: [80, 214, 232], H: [190, 250, 255], d: [36, 150, 176] } },
  { key: 'GOLD', name: 'or', tier: 2, speed: 11, dmg: 4, color: { h: [240, 200, 60], H: [255, 240, 150], d: [190, 140, 30] } },
  { key: 'DIAMOND', name: 'diamant', tier: 4, speed: 8, dmg: 7, color: { h: [90, 230, 220], H: [200, 255, 250], d: [30, 160, 150] } },
  { key: 'NETHERITE', name: 'netherite', tier: 5, speed: 10, dmg: 9, color: { h: [80, 72, 76], H: [120, 110, 116], d: [44, 38, 42] } },
];
CM.TOOL_MAT = {};
for (const m of CM.TOOL_MATS) CM.TOOL_MAT[m.key] = m;
CM.TIER_NAMES = ['', 'bois', 'pierre', 'fer', 'cristal ou diamant', 'netherite'];
const TOOL_TYPES = [
  ['pickaxe', 'Pioche'],
  ['axe', 'Hache'],
  ['shovel', 'Pelle'],
  ['sword', 'Épée'],
];
function defTool(id, type, label, m) {
  const key = (type + '_' + m.key).toUpperCase();
  defItem(id, key, { name: label + ' en ' + m.name, tex: type + '_' + lc(m.key), stack: 1, type: 'tool', toolType: type, tier: m.tier, speed: m.speed, damage: type === 'sword' ? m.dmg : Math.max(2, m.dmg - 3), mat: m.key });
}
// Outils d'origine (identifiants 1044..1059, conservés pour les sauvegardes).
let toolId = 1044;
for (const mk of ['WOOD', 'STONE', 'IRON', 'CRYSTAL']) for (const [type, label] of TOOL_TYPES) defTool(toolId++, type, label, CM.TOOL_MAT[mk]);
// Nouveaux outils : or, diamant, netherite + houes pour tous les matériaux.
toolId = 1200;
for (const mk of ['GOLD', 'DIAMOND', 'NETHERITE']) for (const [type, label] of TOOL_TYPES) defTool(toolId++, type, label, CM.TOOL_MAT[mk]);
for (const m of CM.TOOL_MATS) defTool(toolId++, 'hoe', 'Houe', m);
// Anciennes clés (PICKAXE_1…) utilisées par les quêtes et le code.
const TIER_KEYS = ['', 'WOOD', 'STONE', 'IRON', 'CRYSTAL'];
for (let t = 1; t <= 4; t++) for (const [type] of TOOL_TYPES) CM.I[(type + '_' + t).toUpperCase()] = CM.I[(type + '_' + TIER_KEYS[t]).toUpperCase()];
CM.toolOf = (type, mat) => CM.I[(type + '_' + mat).toUpperCase()];

// Informations unifiées pour n'importe quel identifiant (bloc ou objet).
CM.itemInfo = function (id) {
  if (id < CM.ITEM_BASE) {
    const b = CM.blocks[id];
    if (!b) return null;
    return { id, name: b.name, stack: 64, type: 'block', block: b, isBlock: true };
  }
  return CM.items[id] || null;
};
CM.itemName = (id) => CM.itemInfo(id).name;
// Anciennes sauvegardes (v2/v3) : objets numérotés à partir de 256.
CM.migrateId = function (id, v) {
  if (v < 4 && id >= 256 && id < 400) return id + 744;
  return id;
};

// ----------------------------------------------------------- Maîtrise -----
// Les outils n'ont pas d'usure : ils gagnent de l'expérience et montent de niveau.
CM.MASTERY_XP = [0, 25, 70, 160, 320];
CM.masteryLevel = function (xp) {
  let lvl = 1;
  for (let i = 1; i < CM.MASTERY_XP.length; i++) if (xp >= CM.MASTERY_XP[i]) lvl = i + 1;
  return lvl;
};

// --------------------------------------------------------------- Groupes --
// Un ingrédient peut être un groupe : n'importe quel bloc du groupe convient.
const B = CM.B;
const I = CM.I;
CM.TAGS = {
  logs: CM.WOODS.flatMap((w) => [w.log, w.strippedLog, w.wood, w.strippedWood]).concat([B.BAMBOO_BLOCK]),
  planks: CM.WOODS.map((w) => w.planks).concat([B.BAMBOO_PLANKS]),
  leaves: CM.WOODS.filter((w) => !w.nether).map((w) => w.leaves),
  saplings: CM.WOODS.map((w) => w.sapling),
  sand: [B.SAND, B.RED_SAND],
  stones: [B.COBBLE, B.COBBLED_DEEPSLATE, B.BLACKSTONE],
  wool: Object.values(CM.COLOR.wool),
  iron_ores: [B.IRON_ORE, B.DEEPSLATE_IRON_ORE],
  gold_ores: [B.GOLD_ORE, B.DEEPSLATE_GOLD_ORE, B.NETHER_GOLD_ORE],
  copper_ores: [B.COPPER_ORE, B.DEEPSLATE_COPPER_ORE],
  wood_slabs: CM.WOODS.map((w) => CM.blocks[w.planks].slab),
  red_flowers: [B.FLOWER, B.RED_TULIP, B.ROSE_BUSH],
  yellow_flowers: [B.DANDELION, B.SUNFLOWER],
  blue_flowers: [B.CORNFLOWER],
  light_gray_flowers: [B.AZURE_BLUET, B.DAISY, B.WHITE_TULIP],
  magenta_flowers: [B.ALLIUM, B.LILAC],
  pink_flowers: [B.PINK_TULIP, B.PEONY],
  orange_flowers: [B.TULIP, B.TORCHFLOWER],
  shrooms: [B.RED_SHROOM, B.BROWN_SHROOM],
};
for (const w of CM.WOODS) CM.TAGS['logs_' + lc(w.key)] = [w.log, w.strippedLog, w.wood, w.strippedWood];
CM.TAG_NAMES = {
  logs: 'Bûches (au choix)', planks: 'Planches (au choix)', leaves: 'Feuilles (au choix)', saplings: 'Pousses (au choix)', sand: 'Sable (au choix)',
  stones: 'Galets (au choix)', wool: 'Laine (au choix)', iron_ores: 'Minerai de fer (au choix)', gold_ores: "Minerai d'or (au choix)", copper_ores: 'Minerai de cuivre (au choix)',
  wood_slabs: 'Dalles de bois (au choix)', red_flowers: 'Fleur rouge (au choix)', yellow_flowers: 'Fleur jaune (au choix)', blue_flowers: 'Fleur bleue',
  light_gray_flowers: 'Fleur blanche (au choix)', magenta_flowers: 'Fleur mauve (au choix)', pink_flowers: 'Fleur rose (au choix)', orange_flowers: 'Fleur orange (au choix)',
  shrooms: 'Champignon (au choix)',
};
for (const w of CM.WOODS) CM.TAG_NAMES['logs_' + lc(w.key)] = (w.nether ? 'Tiges ' : 'Bûches ') + de(w.name);
CM.tagMembers = (t) => (typeof t === 'string' ? CM.TAGS[t] : [t]);
CM.ingName = (t) => (typeof t === 'string' ? CM.TAG_NAMES[t] : CM.itemName(t));
CM.woodOf = (id) => CM.WOODS.find((w) => w.key === CM.blocks[id].wood) || null;

// ------------------------------------------------------------ Recettes ----
// station: null (à la main), 'table' (établi à proximité), 'forge' (forge ou fourneau),
// 'smithing' (table de forgeron). cat: outils | blocs | deco | objets | nourriture
const r = (out, n, ing, station, cat) => ({ out, n, ing, station, cat });
const COLOR_FAMS = ['wool', 'carpet', 'concrete', 'powder', 'terracotta', 'glazed', 'sglass'];
CM.recipes = [
  ...CM.WOODS.map((w) => r(w.planks, 4, [['logs_' + lc(w.key), 1]], null, 'blocs')),
  r(B.BAMBOO_PLANKS, 2, [[B.BAMBOO_BLOCK, 1]], null, 'blocs'),
  r(I.STICK, 4, [['planks', 2]], null, 'objets'),
  r(B.TABLE, 1, [['planks', 4]], null, 'blocs'),
  r(B.TORCH, 4, [[I.STICK, 1], [I.COAL, 1]], null, 'blocs'),
  r(I.ROPE, 1, [[I.FIBER, 3]], null, 'objets'),
  r(I.MUSHROOM_STEW, 1, [[B.RED_SHROOM, 1], [B.BROWN_SHROOM, 1]], null, 'nourriture'),
  r(I.SUGAR, 1, [[B.SUGAR_CANE, 1]], null, 'objets'),
  r(I.PAPER, 3, [[B.SUGAR_CANE, 3]], null, 'objets'),
  r(I.BOOK, 1, [[I.PAPER, 3], [I.LEATHER, 1]], null, 'objets'),
  r(I.BREAD, 1, [[I.WHEAT, 3]], null, 'nourriture'),
  r(I.BONE_MEAL, 9, [[B.BONE_BLOCK, 1]], null, 'objets'),
  r(I.FLINT_AND_STEEL, 1, [[I.IRON_INGOT, 1], [I.FLINT, 1]], null, 'outils'),
  r(I.GLOWSTONE_DUST, 4, [[B.GLOWSTONE, 1]], null, 'objets'),
];

// Outils (établi) : tous les matériaux.
const TOOL_ING = { WOOD: 'planks', STONE: 'stones', IRON: I.IRON_INGOT, GOLD: I.GOLD_INGOT, DIAMOND: I.DIAMOND };
const toolCost = { pickaxe: 3, axe: 3, shovel: 1, sword: 2, hoe: 2 };
for (const m of CM.TOOL_MATS) {
  for (const type of ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']) {
    const out = CM.toolOf(type, m.key);
    const sticks = type === 'sword' ? 1 : 2;
    if (m.key === 'CRYSTAL') CM.recipes.push(r(out, 1, [[I.CRYSTAL, toolCost[type]], [I.IRON_INGOT, 1], [I.STICK, sticks]], 'table', 'outils'));
    else if (m.key === 'NETHERITE') CM.recipes.push(r(out, 1, [[CM.toolOf(type, 'DIAMOND'), 1], [I.NETHERITE_INGOT, 1]], 'smithing', 'outils'));
    else CM.recipes.push(r(out, 1, [[TOOL_ING[m.key], toolCost[type]], [I.STICK, sticks]], 'table', 'outils'));
  }
}
CM.recipes.push(
  r(I.GRAPPLE, 1, [[I.IRON_INGOT, 3], [I.ROPE, 2]], 'table', 'outils'),
  r(B.FORGE, 1, [['stones', 8]], 'table', 'blocs'),
  r(B.FURNACE, 1, [[B.COBBLE, 8]], 'table', 'deco'),
  r(B.CHEST, 1, [['planks', 8]], 'table', 'blocs'),
  r(B.BARREL, 1, [['planks', 6], ['wood_slabs', 2]], 'table', 'deco'),
  r(B.STONEBRICK, 4, [[B.STONE, 4]], 'table', 'blocs'),
  r(B.MOSSY_STONEBRICK, 1, [[B.STONEBRICK, 1], [I.FIBER, 1]], 'table', 'blocs'),
  r(B.MOSSY_COBBLE, 1, [[B.COBBLE, 1], [I.FIBER, 1]], 'table', 'blocs'),
  r(B.POLISHED_GRANITE, 4, [[B.GRANITE, 4]], 'table', 'blocs'),
  r(B.POLISHED_DIORITE, 4, [[B.DIORITE, 4]], 'table', 'blocs'),
  r(B.POLISHED_ANDESITE, 4, [[B.ANDESITE, 4]], 'table', 'blocs'),
  r(B.SANDSTONE, 1, [[B.SAND, 4]], 'table', 'blocs'),
  r(B.CARVED_SANDSTONE, 1, [[CM.blocks[B.SANDSTONE].slab, 2]], 'table', 'blocs'),
  r(B.CUT_SANDSTONE, 4, [[B.SANDSTONE, 4]], 'table', 'blocs'),
  r(B.RED_SANDSTONE, 1, [[B.RED_SAND, 4]], 'table', 'blocs'),
  r(B.CUT_RED_SANDSTONE, 4, [[B.RED_SANDSTONE, 4]], 'table', 'blocs'),
  r(B.CHISELED_RED_SANDSTONE, 1, [[CM.blocks[B.RED_SANDSTONE].slab, 2]], 'table', 'blocs'),
  r(B.BRICKS, 4, [[B.TERRACOTTA, 4]], 'table', 'blocs'),
  r(B.CHISELED_STONEBRICK, 1, [[CM.blocks[B.STONEBRICK].slab, 2]], 'table', 'blocs'),
  r(B.POLISHED_DEEPSLATE, 4, [[B.COBBLED_DEEPSLATE, 4]], 'table', 'blocs'),
  r(B.DEEPSLATE_BRICKS, 4, [[B.POLISHED_DEEPSLATE, 4]], 'table', 'blocs'),
  r(B.DEEPSLATE_TILES, 4, [[B.DEEPSLATE_BRICKS, 4]], 'table', 'blocs'),
  r(B.CHISELED_DEEPSLATE, 1, [[CM.blocks[B.COBBLED_DEEPSLATE].slab, 2]], 'table', 'blocs'),
  r(B.POLISHED_TUFF, 4, [[B.TUFF, 4]], 'table', 'blocs'),
  r(B.TUFF_BRICKS, 4, [[B.POLISHED_TUFF, 4]], 'table', 'blocs'),
  r(B.CHISELED_TUFF, 1, [[CM.blocks[B.TUFF_BRICKS].slab, 2]], 'table', 'blocs'),
  r(B.POLISHED_BLACKSTONE, 4, [[B.BLACKSTONE, 4]], 'table', 'blocs'),
  r(B.POLISHED_BLACKSTONE_BRICKS, 4, [[B.POLISHED_BLACKSTONE, 4]], 'table', 'blocs'),
  r(B.CHISELED_POLISHED_BLACKSTONE, 1, [[CM.blocks[B.POLISHED_BLACKSTONE].slab, 2]], 'table', 'blocs'),
  r(B.GILDED_BLACKSTONE, 1, [[B.BLACKSTONE, 1], [I.GOLD_INGOT, 1]], 'table', 'blocs'),
  r(B.POLISHED_BASALT, 4, [[B.BASALT, 4]], 'table', 'blocs'),
  r(B.END_STONE_BRICKS, 4, [[B.END_STONE, 4]], 'table', 'blocs'),
  r(B.PURPUR_BLOCK, 4, [[B.END_STONE, 4], [I.AMETHYST_SHARD, 1]], 'table', 'blocs'),
  r(B.PURPUR_PILLAR, 1, [[CM.blocks[B.PURPUR_BLOCK].slab, 2]], 'table', 'blocs'),
  r(B.PRISMARINE_BRICKS, 4, [[B.PRISMARINE, 4]], 'table', 'blocs'),
  r(B.DARK_PRISMARINE, 8, [[B.PRISMARINE, 8], [CM.DYE_ITEM.BLACK, 1]], 'table', 'blocs'),
  r(B.SEA_LANTERN, 1, [[B.PRISMARINE, 4], [I.GLOWSTONE_DUST, 4]], 'table', 'deco'),
  r(B.RED_NETHER_BRICKS, 4, [[B.NETHER_BRICKS, 4], [CM.DYE_ITEM.RED, 1]], 'table', 'blocs'),
  r(B.CHISELED_NETHER_BRICKS, 1, [[CM.blocks[B.NETHER_BRICKS].slab, 2]], 'table', 'blocs'),
  r(B.QUARTZ_BLOCK, 1, [[I.QUARTZ, 4]], 'table', 'blocs'),
  r(I.QUARTZ, 4, [[B.QUARTZ_BLOCK, 1]], null, 'objets'),
  r(B.CHISELED_QUARTZ, 1, [[CM.blocks[B.QUARTZ_BLOCK].slab, 2]], 'table', 'blocs'),
  r(B.QUARTZ_PILLAR, 2, [[B.QUARTZ_BLOCK, 2]], 'table', 'blocs'),
  r(B.QUARTZ_BRICKS, 4, [[B.QUARTZ_BLOCK, 4]], 'table', 'blocs'),
  r(B.GLOWSTONE, 1, [[I.GLOWSTONE_DUST, 4]], 'table', 'deco'),
  r(B.MUD_BRICKS, 4, [[B.PACKED_MUD, 4]], 'table', 'blocs'),
  r(B.PACKED_MUD, 1, [[B.MUD, 1], [I.WHEAT, 1]], 'table', 'blocs'),
  r(B.AMETHYST_BLOCK, 1, [[I.AMETHYST_SHARD, 4]], 'table', 'blocs'),
  r(B.TINTED_GLASS, 2, [[B.GLASS, 1], [I.AMETHYST_SHARD, 4]], 'table', 'deco'),
  r(B.COARSE_DIRT, 4, [[B.DIRT, 2], [B.GRAVEL, 2]], 'table', 'blocs'),
  r(B.MOSS_CARPET, 3, [[B.MOSS_BLOCK, 2]], 'table', 'deco'),
  r(B.PACKED_ICE, 1, [[B.ICE, 9]], 'table', 'blocs'),
  r(B.BLUE_ICE, 1, [[B.PACKED_ICE, 9]], 'table', 'blocs'),
  r(B.SNOW_LAYER, 6, [[B.SNOW, 3]], 'table', 'deco'),
  r(B.HAY_BLOCK, 1, [[I.WHEAT, 9]], 'table', 'blocs'),
  r(I.WHEAT, 9, [[B.HAY_BLOCK, 1]], null, 'objets'),
  r(B.BONE_BLOCK, 1, [[I.BONE_MEAL, 9]], 'table', 'blocs'),
  r(B.DRIED_KELP_BLOCK, 1, [[I.FIBER, 9]], 'table', 'blocs'),
  r(B.HONEYCOMB_BLOCK, 1, [[I.HONEYCOMB, 4]], 'table', 'deco'),
  r(B.HONEY_BLOCK, 1, [[I.HONEY_BOTTLE, 4]], 'table', 'deco'),
  r(I.HONEY_BOTTLE, 4, [[B.HONEY_BLOCK, 1]], null, 'nourriture'),
  r(I.HONEY_BOTTLE, 1, [[I.HONEYCOMB, 2], [B.GLASS, 1]], 'table', 'nourriture'),
  r(B.SLIME_BLOCK, 1, [[I.SLIMEBALL, 9]], 'table', 'deco'),
  r(I.SLIMEBALL, 9, [[B.SLIME_BLOCK, 1]], null, 'objets'),
  r(B.RED_MUSHROOM_BLOCK, 1, [[B.RED_SHROOM, 4]], 'table', 'deco'),
  r(B.BROWN_MUSHROOM_BLOCK, 1, [[B.BROWN_SHROOM, 4]], 'table', 'deco'),
  r(B.MUSHROOM_STEM, 1, [['shrooms', 4]], 'table', 'deco'),
  r(B.OCHRE_FROGLIGHT, 1, [[B.GLOWSTONE, 1], [CM.DYE_ITEM.YELLOW, 1]], 'table', 'deco'),
  r(B.VERDANT_FROGLIGHT, 1, [[B.GLOWSTONE, 1], [CM.DYE_ITEM.LIME, 1]], 'table', 'deco'),
  r(B.PEARLESCENT_FROGLIGHT, 1, [[B.GLOWSTONE, 1], [CM.DYE_ITEM.PURPLE, 1]], 'table', 'deco'),
  r(B.REDSTONE_LAMP, 1, [[I.REDSTONE, 4], [B.GLOWSTONE, 1]], 'table', 'deco'),
  r(B.SHROOMLIGHT, 1, [['shrooms', 2], [I.GLOWSTONE_DUST, 2]], 'table', 'deco'),
  r(B.CUT_COPPER, 4, [[B.COPPER_BLOCK, 4]], 'table', 'blocs'),
  r(B.EXPOSED_COPPER, 1, [[B.COPPER_BLOCK, 1], [I.FIBER, 1]], 'table', 'blocs'),
  r(B.WEATHERED_COPPER, 1, [[B.EXPOSED_COPPER, 1], [I.FIBER, 1]], 'table', 'blocs'),
  r(B.OXIDIZED_COPPER, 1, [[B.WEATHERED_COPPER, 1], [I.FIBER, 1]], 'table', 'blocs'),
  r(B.EXPOSED_CUT_COPPER, 4, [[B.EXPOSED_COPPER, 4]], 'table', 'blocs'),
  r(B.WEATHERED_CUT_COPPER, 4, [[B.WEATHERED_COPPER, 4]], 'table', 'blocs'),
  r(B.OXIDIZED_CUT_COPPER, 4, [[B.OXIDIZED_COPPER, 4]], 'table', 'blocs'),
  r(B.LAMP, 2, [[I.CRYSTAL, 1], [B.GLASS, 2]], 'table', 'deco'),
  r(B.LANTERN, 2, [[I.COPPER_INGOT, 1], [B.TORCH, 1]], 'table', 'deco'),
  r(B.SOUL_TORCH, 4, [[I.STICK, 1], [I.COAL, 1], [B.SOUL_SAND, 1]], null, 'deco'),
  r(B.SOUL_LANTERN, 1, [[I.IRON_INGOT, 1], [B.SOUL_TORCH, 1]], 'table', 'deco'),
  r(B.CARVED_PUMPKIN, 1, [[B.PUMPKIN, 1]], 'table', 'deco'),
  r(B.JACK_O_LANTERN, 1, [[B.CARVED_PUMPKIN, 1], [B.TORCH, 1]], 'table', 'deco'),
  r(B.BOOKSHELF, 1, [['planks', 6], [I.BOOK, 3]], 'table', 'deco'),
  r(B.TNT, 1, [['sand', 4], [I.COAL, 4], [I.REDSTONE, 1]], 'table', 'deco'),
  r(B.CARTOGRAPHY_TABLE, 1, [['planks', 4], [I.PAPER, 2]], 'table', 'deco'),
  r(B.FLETCHING_TABLE, 1, [['planks', 4], [I.FLINT, 2]], 'table', 'deco'),
  r(B.SMITHING_TABLE, 1, [['planks', 4], [I.IRON_INGOT, 2]], 'table', 'deco'),
  r(B.LOOM, 1, [['planks', 2], [I.FIBER, 2]], 'table', 'deco'),
  r(B.BEEHIVE, 1, [['planks', 6], [I.HONEYCOMB, 3]], 'table', 'deco'),
  r(B.JUKEBOX, 1, [['planks', 8], [I.DIAMOND, 1]], 'table', 'deco'),
  r(B.NOTE_BLOCK, 1, [['planks', 8], [I.REDSTONE, 1]], 'table', 'deco'),
  r(B.TARGET, 1, [[B.HAY_BLOCK, 1], [I.REDSTONE, 4]], 'table', 'deco'),
  r(B.BLAST_FURNACE, 1, [[B.FURNACE, 1], [I.IRON_INGOT, 5], [B.SMOOTH_STONE, 3]], 'table', 'deco'),
  r(B.SMOKER, 1, [[B.FURNACE, 1], ['logs', 4]], 'table', 'deco'),
  r(B.DISPENSER, 1, [[B.COBBLE, 7], [I.REDSTONE, 1], [I.STICK, 3]], 'table', 'deco'),
  r(B.DROPPER, 1, [[B.COBBLE, 7], [I.REDSTONE, 1]], 'table', 'deco'),
  r(B.OBSERVER, 1, [[B.COBBLE, 6], [I.REDSTONE, 2], [I.QUARTZ, 1]], 'table', 'deco'),
  r(B.STRIPPED_BAMBOO_BLOCK, 1, [[B.BAMBOO_BLOCK, 1]], 'table', 'blocs'),
  r(B.BAMBOO_BLOCK, 1, [[B.BAMBOO, 9]], 'table', 'blocs'),
  r(B.BAMBOO_MOSAIC, 1, [[CM.blocks[B.BAMBOO_PLANKS].slab, 2]], 'table', 'blocs'),
  r(B.RAW_IRON_BLOCK, 1, [[B.IRON_ORE, 9]], 'table', 'blocs'),
  r(B.RAW_GOLD_BLOCK, 1, [[B.GOLD_ORE, 9]], 'table', 'blocs'),
  r(B.RAW_COPPER_BLOCK, 1, [[B.COPPER_ORE, 9]], 'table', 'blocs'),
  r(B.IRON_ORE, 9, [[B.RAW_IRON_BLOCK, 1]], null, 'blocs'),
  r(B.GOLD_ORE, 9, [[B.RAW_GOLD_BLOCK, 1]], null, 'blocs'),
  r(B.COPPER_ORE, 9, [[B.RAW_COPPER_BLOCK, 1]], null, 'blocs'),
);
// Bois : 4 bûches -> 3 bois
for (const w of CM.WOODS) CM.recipes.push(r(w.wood, 3, [[w.log, 4]], 'table', 'blocs'));
// Blocs de stockage (9 <-> 1)
const STORE = [[B.COPPER_BLOCK, I.COPPER_INGOT], [B.IRON_BLOCK, I.IRON_INGOT], [B.GOLD_BLOCK, I.GOLD_INGOT], [B.CRYSTAL_BLOCK, I.CRYSTAL], [B.RUBY_BLOCK, I.RUBY], [B.COAL_BLOCK, I.COAL],
  [B.DIAMOND_BLOCK, I.DIAMOND], [B.EMERALD_BLOCK, I.EMERALD], [B.LAPIS_BLOCK, I.LAPIS], [B.REDSTONE_BLOCK, I.REDSTONE], [B.NETHERITE_BLOCK, I.NETHERITE_INGOT]];
for (const [blk, item] of STORE) {
  CM.recipes.push(r(blk, 1, [[item, 9]], 'table', 'blocs'));
  CM.recipes.push(r(item, 9, [[blk, 1]], null, 'objets'));
}
// Teintures : fleurs, minéraux et mélanges
const D = CM.DYE_ITEM;
CM.recipes.push(
  r(D.RED, 1, [['red_flowers', 1]], null, 'objets'),
  r(D.YELLOW, 1, [['yellow_flowers', 1]], null, 'objets'),
  r(D.BLUE, 1, [['blue_flowers', 1]], null, 'objets'),
  r(D.BLUE, 1, [[I.LAPIS, 1]], null, 'objets'),
  r(D.LIGHT_GRAY, 1, [['light_gray_flowers', 1]], null, 'objets'),
  r(D.MAGENTA, 1, [['magenta_flowers', 1]], null, 'objets'),
  r(D.PINK, 1, [['pink_flowers', 1]], null, 'objets'),
  r(D.ORANGE, 1, [['orange_flowers', 1]], null, 'objets'),
  r(D.LIGHT_BLUE, 1, [[B.BLUE_ORCHID, 1]], null, 'objets'),
  r(D.WHITE, 1, [[B.LILY_OF_THE_VALLEY, 1]], null, 'objets'),
  r(D.WHITE, 1, [[I.BONE_MEAL, 1]], null, 'objets'),
  r(D.BLACK, 1, [[B.WITHER_ROSE, 1]], null, 'objets'),
  r(D.BLACK, 1, [[I.COAL, 2]], null, 'objets'),
  r(D.BROWN, 1, [[B.BROWN_SHROOM, 1]], null, 'objets'),
  r(D.ORANGE, 2, [[D.RED, 1], [D.YELLOW, 1]], null, 'objets'),
  r(D.LIME, 2, [[D.GREEN, 1], [D.WHITE, 1]], null, 'objets'),
  r(D.PINK, 2, [[D.RED, 1], [D.WHITE, 1]], null, 'objets'),
  r(D.GRAY, 2, [[D.BLACK, 1], [D.WHITE, 1]], null, 'objets'),
  r(D.LIGHT_GRAY, 2, [[D.GRAY, 1], [D.WHITE, 1]], null, 'objets'),
  r(D.CYAN, 2, [[D.BLUE, 1], [D.GREEN, 1]], null, 'objets'),
  r(D.PURPLE, 2, [[D.RED, 1], [D.BLUE, 1]], null, 'objets'),
  r(D.MAGENTA, 2, [[D.PURPLE, 1], [D.PINK, 1]], null, 'objets'),
  r(D.LIGHT_BLUE, 2, [[D.BLUE, 1], [D.WHITE, 1]], null, 'objets'),
);
// Familles colorées
for (const d of CM.DYES) {
  const dye = D[d.key];
  if (d.key !== 'WHITE') CM.recipes.push(r(CM.COLOR.wool[d.key], 1, [[27, 1], [dye, 1]], null, 'deco'));
  CM.recipes.push(r(CM.COLOR.carpet[d.key], 3, [[CM.COLOR.wool[d.key], 2]], 'table', 'deco'));
  CM.recipes.push(r(CM.COLOR.powder[d.key], 8, [['sand', 4], [B.GRAVEL, 4], [dye, 1]], 'table', 'deco'));
  CM.recipes.push(r(CM.COLOR.terracotta[d.key], 8, [[B.TERRACOTTA, 8], [dye, 1]], 'table', 'deco'));
  CM.recipes.push(r(CM.COLOR.glazed[d.key], 4, [[CM.COLOR.terracotta[d.key], 4], [I.COAL, 1]], 'forge', 'deco'));
  CM.recipes.push(r(CM.COLOR.sglass[d.key], 8, [[B.GLASS, 8], [dye, 1]], 'table', 'deco'));
}
CM.recipes.push(r(27, 1, [[I.FIBER, 4]], 'table', 'deco'));
// Dalles : 3 blocs -> 6 dalles
for (const s of CM.SLABS) CM.recipes.push(r(s, 6, [[CM.blocks[s].full, 3]], 'table', 'blocs'));
// Objets divers
CM.recipes.push(
  r(I.GOLDEN_APPLE, 1, [[I.APPLE, 1], [I.GOLD_INGOT, 4]], 'table', 'nourriture'),
  r(I.FEATHER_CHARM, 1, [[I.CRYSTAL, 2], [I.SHADOW_ESSENCE, 2], [I.FEATHER, 3]], 'table', 'objets'),
  r(I.STAMINA_CHARM, 1, [[I.CRYSTAL, 2], [I.COOKED_MEAT, 3], [I.ROPE, 1]], 'table', 'objets'),
  r(I.RUBY_CHARM, 1, [[I.RUBY, 3], [I.GOLD_INGOT, 2], [I.ROPE, 1]], 'table', 'objets'),
  r(I.NETHERITE_INGOT, 1, [[I.NETHERITE_SCRAP, 4], [I.GOLD_INGOT, 4]], 'forge', 'objets'),
);
// Forge / fourneau (avec du charbon)
const smelt = (out, n, ing, k, cat) => CM.recipes.push(r(out, n, [[ing, k], [I.COAL, 1]], 'forge', cat || 'blocs'));
smelt(I.IRON_INGOT, 2, 'iron_ores', 2, 'objets');
smelt(I.COPPER_INGOT, 2, 'copper_ores', 2, 'objets');
smelt(I.GOLD_INGOT, 2, 'gold_ores', 2, 'objets');
smelt(I.NETHERITE_SCRAP, 1, B.ANCIENT_DEBRIS, 1, 'objets');
smelt(B.GLASS, 4, 'sand', 4);
smelt(B.STONE, 4, B.COBBLE, 4);
smelt(B.DEEPSTONE, 4, B.COBBLED_DEEPSLATE, 4);
smelt(B.SMOOTH_STONE, 4, B.STONE, 4);
smelt(B.CRACKED_STONEBRICK, 4, B.STONEBRICK, 4);
smelt(B.CRACKED_DEEPSLATE_BRICKS, 4, B.DEEPSLATE_BRICKS, 4);
smelt(B.CRACKED_DEEPSLATE_TILES, 4, B.DEEPSLATE_TILES, 4);
smelt(B.CRACKED_POLISHED_BLACKSTONE_BRICKS, 4, B.POLISHED_BLACKSTONE_BRICKS, 4);
smelt(B.CRACKED_NETHER_BRICKS, 4, B.NETHER_BRICKS, 4);
smelt(B.NETHER_BRICKS, 4, B.NETHERRACK, 4);
smelt(B.SMOOTH_QUARTZ, 4, B.QUARTZ_BLOCK, 4);
smelt(B.SMOOTH_SANDSTONE, 4, B.SANDSTONE, 4);
smelt(B.SMOOTH_RED_SANDSTONE, 4, B.RED_SANDSTONE, 4);
smelt(B.SMOOTH_BASALT, 4, B.BASALT, 4);
smelt(B.TERRACOTTA, 4, B.CLAY, 4);
smelt(B.SPONGE, 1, B.WET_SPONGE, 1);
smelt(D.GREEN, 2, B.CACTUS, 2, 'objets');
smelt(I.COOKED_MEAT, 2, I.RAW_MEAT, 2, 'nourriture');
smelt(I.COOKED_BERRIES, 1, I.BERRIES, 3, 'nourriture');
for (const [k] of CORALS) smelt(B['DEAD_' + k + '_CORAL_BLOCK'], 4, B[k + '_CORAL_BLOCK'], 4);
CM.recipes.push(
  r(I.PUMPKIN_PIE, 2, [[B.PUMPKIN, 1], [I.SUGAR, 1], [I.BERRIES, 2], [I.COAL, 1]], 'forge', 'nourriture'),
  r(I.COAL, 1, [['logs', 3]], 'forge', 'objets'),
  r(B.DAWN_HEART, 1, [[I.SKY_SHARD, 4], [I.SHADOW_ESSENCE, 4], [I.CRYSTAL, 4], [I.IRON_INGOT, 2]], 'forge', 'objets'),
);
// Recettes marquées décoratives quand elles produisent un bloc coloré.
for (const rec of CM.recipes) if (rec.cat === 'blocs' && COLOR_FAMS.some((f) => Object.values(CM.COLOR[f]).includes(rec.out))) rec.cat = 'deco';

CM.STATION_NAMES = { table: 'Établi', forge: 'Forge', smithing: 'Table de forgeron' };
CM.STATION_NEAR = { table: 'un établi', forge: 'une forge ou un fourneau', smithing: 'une table de forgeron' };

// Butin d'un bloc cassé : liste de [id, quantité].
CM.blockDrops = function (id, rand) {
  const b = CM.blocks[id];
  const w = b.wood ? CM.woodOf(id) : null;
  if (w && id === w.leaves && !w.nether) {
    const out = [];
    if (rand() < 0.08) out.push([w.sapling, 1]);
    if (rand() < 0.12) out.push([I.STICK, 1]);
    if ((w.key === 'OAK' || w.key === 'DARK_OAK') && rand() < 0.06) out.push([I.APPLE, 1]);
    return out;
  }
  if (b.crop !== undefined) {
    if (b.crop < 3) return [[I.SEEDS, 1]];
    return [[I.WHEAT, 1 + (rand() < 0.4 ? 1 : 0)], [I.SEEDS, 1 + Math.floor(rand() * 3)]];
  }
  const between = (a, c) => a + Math.floor(rand() * (c - a + 1));
  switch (id) {
    case B.TALLGRASS:
      if (rand() < 0.12) return [[I.SEEDS, 1]];
      return rand() < 0.6 ? [[I.FIBER, 1]] : [];
    case B.FERN:
      return rand() < 0.5 ? [[I.FIBER, 1]] : [];
    case B.DEAD_BUSH:
      return rand() < 0.7 ? [[I.STICK, 1 + (rand() < 0.4 ? 1 : 0)]] : [];
    case B.BERRYBUSH:
      return [[I.BERRIES, 2 + (rand() < 0.5 ? 1 : 0)], [I.FIBER, 1]];
    case B.MELON:
      return [[I.MELON_SLICE, 3 + Math.floor(rand() * 4)]];
    case B.CRYSTAL_ORE:
      return [[I.CRYSTAL, 1 + (rand() < 0.35 ? 1 : 0)]];
    case B.COAL_ORE:
    case B.DEEPSLATE_COAL_ORE:
      return [[I.COAL, 1 + (rand() < 0.2 ? 1 : 0)]];
    case B.SHARD_ORE:
      return [[I.SKY_SHARD, 1]];
    case B.RUBY_ORE:
      return [[I.RUBY, 1]];
    case B.DIAMOND_ORE:
    case B.DEEPSLATE_DIAMOND_ORE:
      return [[I.DIAMOND, 1]];
    case B.EMERALD_ORE:
    case B.DEEPSLATE_EMERALD_ORE:
      return [[I.EMERALD, 1]];
    case B.LAPIS_ORE:
    case B.DEEPSLATE_LAPIS_ORE:
      return [[I.LAPIS, between(4, 8)]];
    case B.REDSTONE_ORE:
    case B.DEEPSLATE_REDSTONE_ORE:
      return [[I.REDSTONE, between(4, 5)]];
    case B.NETHER_QUARTZ_ORE:
      return [[I.QUARTZ, 1 + (rand() < 0.3 ? 1 : 0)]];
    case B.GLOWSTONE:
      return [[I.GLOWSTONE_DUST, between(2, 4)]];
    case B.BUDDING_AMETHYST:
    case B.AMETHYST_BLOCK:
      return [[I.AMETHYST_SHARD, id === B.AMETHYST_BLOCK ? 4 : between(2, 4)]];
    case B.GRAVEL:
      return rand() < 0.1 ? [[I.FLINT, 1]] : [[B.GRAVEL, 1]];
    case B.DEEPSTONE:
      return [[B.COBBLED_DEEPSLATE, 1]];
    case B.BEEHIVE:
      return [[B.BEEHIVE, 1], [I.HONEYCOMB, between(1, 3)]];
    case B.MUD:
      return rand() < 0.06 ? [[B.MUD, 1], [I.SLIMEBALL, 1]] : [[B.MUD, 1]];
    case B.SUGAR_CANE:
      return [[B.SUGAR_CANE, 1]];
    case B.BONE_BLOCK:
      return [[B.BONE_BLOCK, 1]];
    default:
      return b.drop ? [[b.drop, 1]] : [];
  }
};
})();
