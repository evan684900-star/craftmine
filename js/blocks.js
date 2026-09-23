'use strict';
(function () {
// Définitions des blocs, des objets et des recettes.

// ---------------------------------------------------------------- Blocs ----
// render: 'cube' | 'cross' | 'torch' | 'water' | 'glass'
// opaque: cache les faces voisines et bloque la lumière
// atten: atténuation supplémentaire de la lumière (feuilles, eau)
CM.blocks = [];
CM.B = {};

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
    },
    d,
  );
  if (typeof def.tex === 'string') def.tex = { top: def.tex, bottom: def.tex, side: def.tex };
  if (def.tex && !def.tex.front) def.tex.front = def.tex.side;
  // opaque pour la lumière: seulement les cubes opaques
  def.lightOpaque = def.opaque && def.render === 'cube';
  CM.blocks[id] = def;
  CM.B[key] = id;
  return def;
}

defBlock(0, 'AIR', { name: 'Air', render: 'none', solid: false, opaque: false, hardness: 0, drop: 0 });
defBlock(1, 'STONE', { name: 'Pierre', tex: 'stone', hardness: 1.5, tool: 'pickaxe', tier: 1, drop: 9 });
defBlock(2, 'DIRT', { name: 'Terre', tex: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
defBlock(3, 'GRASS', { name: "Bloc d'herbe", tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', sound: 'grass', drop: 2 });
defBlock(4, 'SAND', { name: 'Sable', tex: 'sand', hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(5, 'WATER', { name: 'Eau', render: 'water', tex: 'water', solid: false, opaque: false, atten: 2, hardness: -1, drop: 0, replaceable: true });
defBlock(6, 'LOG', { name: 'Bûche', tex: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
defBlock(7, 'LEAVES', { name: 'Feuillage', tex: 'leaves', atten: 1, hardness: 0.25, tool: 'axe', sound: 'grass', drop: 0 });
defBlock(8, 'PLANKS', { name: 'Planches', tex: 'planks', hardness: 1.5, tool: 'axe', sound: 'wood' });
defBlock(9, 'COBBLE', { name: 'Galets', tex: 'cobble', hardness: 1.8, tool: 'pickaxe', tier: 1 });
defBlock(10, 'COAL_ORE', { name: 'Minerai de charbon', tex: 'coal_ore', hardness: 2.5, tool: 'pickaxe', tier: 1, drop: 260, ore: true });
defBlock(11, 'IRON_ORE', { name: 'Minerai de fer', tex: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2, ore: true });
defBlock(12, 'CRYSTAL_ORE', { name: 'Minerai de cristal', tex: 'crystal_ore', hardness: 3.5, tool: 'pickaxe', tier: 3, light: 7, drop: 262, ore: true });
defBlock(13, 'BEDROCK', { name: 'Socle', tex: 'bedrock', hardness: -1, unbreakable: true });
defBlock(14, 'GLASS', { name: 'Verre', render: 'glass', tex: 'glass', opaque: false, hardness: 0.4, sound: 'glass' });
defBlock(15, 'TORCH', { name: 'Torche', render: 'torch', tex: 'torch', solid: false, opaque: false, light: 14, hardness: 0, sound: 'wood' });
defBlock(16, 'TABLE', { name: 'Établi', tex: { top: 'table_top', bottom: 'planks', side: 'table_side', front: 'table_front' }, hardness: 2, tool: 'axe', sound: 'wood', station: 'table' });
defBlock(17, 'FORGE', { name: 'Forge', tex: { top: 'forge_top', bottom: 'forge_top', side: 'forge_side', front: 'forge_front' }, hardness: 3, tool: 'pickaxe', tier: 1, light: 10, station: 'forge' });
defBlock(18, 'SNOW', { name: 'Neige', tex: 'snow', hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(19, 'DEEPSTONE', { name: 'Roche profonde', tex: 'deepstone', hardness: 3, tool: 'pickaxe', tier: 1 });
defBlock(20, 'FLOWER', { name: 'Fleur', render: 'cross', tex: 'flower', solid: false, opaque: false, hardness: 0, sound: 'grass', replaceable: true, plant: true });
defBlock(21, 'TALLGRASS', { name: 'Herbes hautes', render: 'cross', tex: 'tallgrass', solid: false, opaque: false, hardness: 0, sound: 'grass', drop: 0, replaceable: true, plant: true });
defBlock(22, 'BERRYBUSH', { name: 'Buisson à baies', render: 'cross', tex: 'berrybush', solid: false, opaque: false, hardness: 0.2, sound: 'grass', drop: 0, plant: true });
defBlock(23, 'LAMP', { name: 'Lanterne de cristal', tex: 'lamp', hardness: 0.8, light: 15, sound: 'glass' });
defBlock(24, 'SKYSTONE', { name: 'Pierre céleste', tex: 'skystone', hardness: 2, tool: 'pickaxe', tier: 1 });
defBlock(25, 'SHARD_ORE', { name: "Minerai d'éclat céleste", tex: 'shard_ore', hardness: 4, tool: 'pickaxe', tier: 3, light: 9, drop: 263, ore: true });
defBlock(26, 'BRICKS', { name: 'Briques', tex: 'bricks', hardness: 2, tool: 'pickaxe', tier: 1 });
defBlock(27, 'WOOL', { name: 'Laine', tex: 'wool', hardness: 0.6, sound: 'grass' });
defBlock(28, 'MUSHROOM', { name: 'Champignon rebond', tex: { top: 'mushroom_top', bottom: 'mushroom_bottom', side: 'mushroom_side' }, hardness: 0.6, tool: 'axe', light: 5, sound: 'grass', bounce: true });
defBlock(29, 'DAWN_HEART', { name: "Cœur d'aube", tex: 'dawn_heart', hardness: 3, tool: 'pickaxe', tier: 1, light: 15, sound: 'glass' });
defBlock(30, 'STONEBRICK', { name: 'Pierre taillée', tex: 'stonebrick', hardness: 2, tool: 'pickaxe', tier: 1 });
defBlock(32, 'SAPLING', { name: 'Pousse de chêne', render: 'cross', tex: 'sapling', solid: false, opaque: false, hardness: 0, sound: 'grass', plant: true });
defBlock(31, 'CHEST', { name: 'Coffre', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', container: true });

// ------------------------------------------------------- Essences de bois --
// Chaque essence a une bûche, des planches, des feuilles et une pousse.
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
for (const w of CM.WOODS) {
  const t = w.key.toLowerCase();
  if (w.base) {
    w.log = w.base;
    w.planks = w.base + 1;
    w.leaves = w.base + 2;
    w.sapling = w.base + 3;
    defBlock(w.log, w.key + '_LOG', { tex: { top: t + '_log_top', bottom: t + '_log_top', side: t + '_log_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
    defBlock(w.planks, w.key + '_PLANKS', { tex: t + '_planks', hardness: 1.5, tool: 'axe', sound: 'wood' });
    defBlock(w.leaves, w.key + '_LEAVES', { tex: t + '_leaves', atten: 1, hardness: 0.25, tool: 'axe', sound: 'grass', drop: 0, light: w.glow || 0 });
    defBlock(w.sapling, w.key + '_SAPLING', { render: 'cross', tex: t + '_sapling', solid: false, opaque: false, hardness: 0, sound: 'grass', plant: true });
  }
  CM.blocks[w.log].name = 'Bûche ' + de(w.name);
  CM.blocks[w.planks].name = 'Planches ' + de(w.name);
  CM.blocks[w.leaves].name = 'Feuilles ' + de(w.name);
  CM.blocks[w.sapling].name = 'Pousse ' + de(w.name);
  for (const k of ['log', 'planks', 'leaves', 'sapling']) CM.blocks[w[k]].wood = w.key;
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
defBlock(61, 'PODZOL', grassLike('Sol de forêt', 'podzol'));
defBlock(62, 'CRYSTAL_MOSS', grassLike('Mousse cristalline', 'crystal_moss'));
defBlock(63, 'SANDSTONE', { name: 'Grès', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
defBlock(64, 'CARVED_SANDSTONE', { name: 'Grès taillé', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'carved_sandstone' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
defBlock(65, 'RED_SAND', { name: 'Sable rouge', tex: 'red_sand', hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(66, 'RED_SANDSTONE', { name: 'Grès rouge', tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_top', side: 'red_sandstone_side' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
defBlock(67, 'TERRACOTTA', { name: 'Terre cuite', tex: 'terracotta', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(68, 'TERRACOTTA_RED', { name: 'Terre cuite rouge', tex: 'terracotta_red', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(69, 'TERRACOTTA_YELLOW', { name: 'Terre cuite jaune', tex: 'terracotta_yellow', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(70, 'TERRACOTTA_BROWN', { name: 'Terre cuite brune', tex: 'terracotta_brown', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(71, 'TERRACOTTA_WHITE', { name: 'Terre cuite blanche', tex: 'terracotta_white', hardness: 1.25, tool: 'pickaxe', tier: 1 });
defBlock(72, 'GRAVEL', { name: 'Gravier', tex: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel' });
defBlock(73, 'CLAY', { name: 'Argile', tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel' });
defBlock(74, 'MUD', { name: 'Boue', tex: 'mud', hardness: 0.5, tool: 'shovel', sound: 'gravel', slow: 0.55 });
defBlock(75, 'ICE', { name: 'Glace', render: 'ice', tex: 'ice', opaque: false, atten: 1, hardness: 0.5, tool: 'pickaxe', sound: 'glass', slip: true });
defBlock(76, 'GRANITE', { name: 'Granit', tex: 'granite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(77, 'DIORITE', { name: 'Diorite', tex: 'diorite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(78, 'ANDESITE', { name: 'Andésite', tex: 'andesite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(79, 'POLISHED_GRANITE', { name: 'Granit poli', tex: 'polished_granite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(80, 'POLISHED_DIORITE', { name: 'Diorite polie', tex: 'polished_diorite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(81, 'POLISHED_ANDESITE', { name: 'Andésite polie', tex: 'polished_andesite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
defBlock(82, 'MOSSY_COBBLE', { name: 'Galets moussus', tex: 'mossy_cobble', hardness: 1.8, tool: 'pickaxe', tier: 1 });
defBlock(83, 'MOSSY_STONEBRICK', { name: 'Pierre taillée moussue', tex: 'mossy_stonebrick', hardness: 2, tool: 'pickaxe', tier: 1 });

// ------------------------------------------------------------ Plantes ----
const plant = (name, tex, extra) => Object.assign({ name, render: 'cross', tex, solid: false, opaque: false, hardness: 0, sound: 'grass', replaceable: true, plant: true }, extra || {});
defBlock(84, 'CACTUS', { name: 'Cactus', tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, hardness: 0.4, sound: 'grass', hurts: 1, needsBelow: 'sand' });
defBlock(85, 'DEAD_BUSH', plant('Buisson mort', 'dead_bush', { drop: 0, soilAny: true }));
defBlock(86, 'FERN', plant('Fougère', 'fern', { drop: 0 }));
defBlock(87, 'DANDELION', plant('Pissenlit', 'dandelion'));
defBlock(88, 'CORNFLOWER', plant('Bleuet', 'cornflower'));
defBlock(89, 'TULIP', plant('Tulipe orange', 'tulip'));
defBlock(90, 'DAISY', plant('Marguerite', 'daisy'));
defBlock(91, 'CRYSTAL_FLOWER', plant('Fleur de cristal', 'crystal_flower', { light: 8 }));
defBlock(92, 'RED_SHROOM', plant('Champignon rouge', 'red_shroom', { soilAny: true }));
defBlock(93, 'BROWN_SHROOM', plant('Champignon brun', 'brown_shroom', { soilAny: true }));
defBlock(94, 'MELON', { name: 'Melon', tex: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, hardness: 1, tool: 'axe', sound: 'wood', drop: 0 });
defBlock(95, 'PUMPKIN', { name: 'Citrouille', tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_side' }, hardness: 1, tool: 'axe', sound: 'wood' });
defBlock(96, 'JACK_O_LANTERN', { name: 'Citrouille-lanterne', tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_face' }, hardness: 1, tool: 'axe', sound: 'wood', light: 15 });

// ------------------------------------------------ Minerais et métaux -----
defBlock(97, 'COPPER_ORE', { name: 'Minerai de cuivre', tex: 'copper_ore', hardness: 3, tool: 'pickaxe', tier: 2, ore: true });
defBlock(98, 'GOLD_ORE', { name: "Minerai d'or", tex: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3, ore: true });
defBlock(99, 'RUBY_ORE', { name: 'Minerai de rubis', tex: 'ruby_ore', hardness: 3.5, tool: 'pickaxe', tier: 3, drop: 276, ore: true });
defBlock(100, 'COPPER_BLOCK', { name: 'Bloc de cuivre', tex: 'copper_block', hardness: 3, tool: 'pickaxe', tier: 2 });
defBlock(101, 'GOLD_BLOCK', { name: "Bloc d'or", tex: 'gold_block', hardness: 3, tool: 'pickaxe', tier: 3 });
defBlock(102, 'IRON_BLOCK', { name: 'Bloc de fer', tex: 'iron_block', hardness: 4, tool: 'pickaxe', tier: 2 });
defBlock(103, 'CRYSTAL_BLOCK', { name: 'Bloc de cristal', tex: 'crystal_block', hardness: 3, tool: 'pickaxe', tier: 3, light: 12, sound: 'glass' });
defBlock(104, 'COAL_BLOCK', { name: 'Bloc de charbon', tex: 'coal_block', hardness: 3, tool: 'pickaxe', tier: 1 });
defBlock(105, 'RUBY_BLOCK', { name: 'Bloc de rubis', tex: 'ruby_block', hardness: 4, tool: 'pickaxe', tier: 3 });
defBlock(106, 'LANTERN', { name: 'Lanterne en cuivre', tex: { top: 'lantern_top', bottom: 'lantern_top', side: 'lantern_side' }, hardness: 1, tool: 'pickaxe', light: 15, sound: 'glass' });

// Les blocs qui laissent passer la lumière sans atténuation.
for (const b of CM.blocks) if (b) b.lightPass = !b.lightOpaque;

// -------------------------------------------------------------- Objets ----
// Objets (id >= 256). Les blocs sont aussi des objets (id < 256).
CM.items = [];
CM.I = {};
function defItem(id, key, d) {
  const def = Object.assign({ id, key, name: key, tex: key.toLowerCase(), stack: 64, type: 'material' }, d);
  CM.items[id] = def;
  CM.I[key] = id;
  return def;
}

defItem(256, 'STICK', { name: 'Bâton', tex: 'stick' });
defItem(257, 'FIBER', { name: 'Fibre végétale', tex: 'fiber' });
defItem(258, 'ROPE', { name: 'Corde', tex: 'rope' });
defItem(259, 'IRON_INGOT', { name: 'Lingot de fer', tex: 'iron_ingot' });
defItem(260, 'COAL', { name: 'Charbon', tex: 'coal' });
defItem(261, 'SHADOW_ESSENCE', { name: "Essence d'ombre", tex: 'shadow_essence' });
defItem(262, 'CRYSTAL', { name: 'Cristal', tex: 'crystal' });
defItem(263, 'SKY_SHARD', { name: 'Éclat céleste', tex: 'sky_shard' });
defItem(264, 'BERRIES', { name: 'Baies', tex: 'berries', type: 'food', heal: 2, stamina: 25 });
defItem(265, 'RAW_MEAT', { name: 'Viande crue', tex: 'raw_meat', type: 'food', heal: 2, stamina: 10 });
defItem(266, 'COOKED_MEAT', { name: 'Viande grillée', tex: 'cooked_meat', type: 'food', heal: 7, stamina: 40, vigor: 30 });
defItem(267, 'GRAPPLE', { name: 'Grappin', tex: 'grapple', stack: 1, type: 'grapple' });
defItem(268, 'FEATHER_CHARM', { name: 'Amulette de plume', tex: 'feather_charm', stack: 1, type: 'charm', desc: 'Dans ton inventaire : double saut.' });
defItem(269, 'STAMINA_CHARM', { name: "Amulette d'endurance", tex: 'stamina_charm', stack: 1, type: 'charm', desc: "Dans ton inventaire : +50 d'endurance max." });
defItem(270, 'APPLE', { name: 'Pomme', tex: 'apple', type: 'food', heal: 4, stamina: 20 });
defItem(271, 'GOLDEN_APPLE', { name: 'Pomme dorée', tex: 'golden_apple', type: 'food', heal: 12, stamina: 100, vigor: 90 });
defItem(272, 'MELON_SLICE', { name: 'Tranche de melon', tex: 'melon_slice', type: 'food', heal: 2, stamina: 30 });
defItem(273, 'MUSHROOM_STEW', { name: 'Soupe de champignons', tex: 'mushroom_stew', type: 'food', heal: 7, stamina: 30, stack: 16 });
defItem(274, 'COPPER_INGOT', { name: 'Lingot de cuivre', tex: 'copper_ingot' });
defItem(275, 'GOLD_INGOT', { name: "Lingot d'or", tex: 'gold_ingot' });
defItem(276, 'RUBY', { name: 'Rubis', tex: 'ruby' });
defItem(277, 'FEATHER', { name: 'Plume', tex: 'feather' });
defItem(278, 'RUBY_CHARM', { name: 'Amulette de rubis', tex: 'ruby_charm', stack: 1, type: 'charm', desc: 'Dans ton inventaire : +2 cœurs de vie max.' });
defItem(279, 'PUMPKIN_PIE', { name: 'Tarte à la citrouille', tex: 'pumpkin_pie', type: 'food', heal: 8, stamina: 50, stack: 16 });

CM.TIER_NAMES = ['', 'bois', 'pierre', 'fer', 'cristal'];
CM.TOOL_SPEED = [1, 2.2, 4, 6, 9];
CM.SWORD_DAMAGE = [1, 4, 5, 7, 9];
const TOOL_TYPES = [
  ['pickaxe', 'Pioche'],
  ['axe', 'Hache'],
  ['shovel', 'Pelle'],
  ['sword', 'Épée'],
];
let toolId = 300;
for (let tier = 1; tier <= 4; tier++) {
  for (const [type, label] of TOOL_TYPES) {
    const key = (type + '_' + tier).toUpperCase();
    defItem(toolId++, key, {
      name: label + ' en ' + CM.TIER_NAMES[tier],
      tex: type + '_' + tier,
      stack: 1,
      type: 'tool',
      toolType: type,
      tier,
    });
  }
}

// Informations unifiées pour n'importe quel identifiant (bloc ou objet).
CM.itemInfo = function (id) {
  if (id < 256) {
    const b = CM.blocks[id];
    return { id, name: b.name, stack: 64, type: 'block', block: b, isBlock: true };
  }
  return CM.items[id];
};
CM.itemName = (id) => CM.itemInfo(id).name;

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
  logs: CM.WOODS.map((w) => w.log),
  planks: CM.WOODS.map((w) => w.planks),
  leaves: CM.WOODS.map((w) => w.leaves),
  saplings: CM.WOODS.map((w) => w.sapling),
  sand: [B.SAND, B.RED_SAND],
};
CM.TAG_NAMES = { logs: 'Bûches (au choix)', planks: 'Planches (au choix)', leaves: 'Feuilles (au choix)', saplings: 'Pousses (au choix)', sand: 'Sable (au choix)' };
CM.tagMembers = (t) => (typeof t === 'string' ? CM.TAGS[t] : [t]);
CM.ingName = (t) => (typeof t === 'string' ? CM.TAG_NAMES[t] : CM.itemName(t));
CM.woodOf = (id) => CM.WOODS.find((w) => w.key === CM.blocks[id].wood) || null;

// ------------------------------------------------------------ Recettes -----
// station: null (à la main), 'table' (établi à proximité), 'forge' (forge à proximité)
const r = (out, n, ing, station, cat) => ({ out, n, ing, station, cat });
CM.recipes = [
  ...CM.WOODS.map((w) => r(w.planks, 4, [[w.log, 1]], null, 'blocs')),
  r(I.STICK, 4, [['planks', 2]], null, 'objets'),
  r(B.TABLE, 1, [['planks', 4]], null, 'blocs'),
  r(B.TORCH, 4, [[I.STICK, 1], [I.COAL, 1]], null, 'blocs'),
  r(I.ROPE, 1, [[I.FIBER, 3]], null, 'objets'),
  r(I.MUSHROOM_STEW, 1, [[B.RED_SHROOM, 1], [B.BROWN_SHROOM, 1]], null, 'objets'),

  r(I.PICKAXE_1, 1, [['planks', 3], [I.STICK, 2]], 'table', 'outils'),
  r(I.AXE_1, 1, [['planks', 3], [I.STICK, 2]], 'table', 'outils'),
  r(I.SHOVEL_1, 1, [['planks', 1], [I.STICK, 2]], 'table', 'outils'),
  r(I.SWORD_1, 1, [['planks', 2], [I.STICK, 1]], 'table', 'outils'),
  r(I.PICKAXE_2, 1, [[B.COBBLE, 3], [I.STICK, 2]], 'table', 'outils'),
  r(I.AXE_2, 1, [[B.COBBLE, 3], [I.STICK, 2]], 'table', 'outils'),
  r(I.SHOVEL_2, 1, [[B.COBBLE, 1], [I.STICK, 2]], 'table', 'outils'),
  r(I.SWORD_2, 1, [[B.COBBLE, 2], [I.STICK, 1]], 'table', 'outils'),
  r(I.PICKAXE_3, 1, [[I.IRON_INGOT, 3], [I.STICK, 2]], 'table', 'outils'),
  r(I.AXE_3, 1, [[I.IRON_INGOT, 3], [I.STICK, 2]], 'table', 'outils'),
  r(I.SHOVEL_3, 1, [[I.IRON_INGOT, 1], [I.STICK, 2]], 'table', 'outils'),
  r(I.SWORD_3, 1, [[I.IRON_INGOT, 2], [I.STICK, 1]], 'table', 'outils'),
  r(I.PICKAXE_4, 1, [[I.CRYSTAL, 3], [I.IRON_INGOT, 1], [I.STICK, 2]], 'table', 'outils'),
  r(I.AXE_4, 1, [[I.CRYSTAL, 3], [I.IRON_INGOT, 1], [I.STICK, 2]], 'table', 'outils'),
  r(I.SHOVEL_4, 1, [[I.CRYSTAL, 1], [I.IRON_INGOT, 1], [I.STICK, 2]], 'table', 'outils'),
  r(I.SWORD_4, 1, [[I.CRYSTAL, 2], [I.IRON_INGOT, 1], [I.STICK, 1]], 'table', 'outils'),
  r(I.GRAPPLE, 1, [[I.IRON_INGOT, 3], [I.ROPE, 2]], 'table', 'outils'),

  r(B.FORGE, 1, [[B.COBBLE, 8]], 'table', 'blocs'),
  r(B.CHEST, 1, [['planks', 8]], 'table', 'blocs'),
  r(B.STONEBRICK, 4, [[B.STONE, 4]], 'table', 'blocs'),
  r(B.MOSSY_STONEBRICK, 1, [[B.STONEBRICK, 1], [I.FIBER, 1]], 'table', 'blocs'),
  r(B.MOSSY_COBBLE, 1, [[B.COBBLE, 1], [I.FIBER, 1]], 'table', 'blocs'),
  r(B.POLISHED_GRANITE, 4, [[B.GRANITE, 4]], 'table', 'blocs'),
  r(B.POLISHED_DIORITE, 4, [[B.DIORITE, 4]], 'table', 'blocs'),
  r(B.POLISHED_ANDESITE, 4, [[B.ANDESITE, 4]], 'table', 'blocs'),
  r(B.SANDSTONE, 1, [[B.SAND, 4]], 'table', 'blocs'),
  r(B.CARVED_SANDSTONE, 4, [[B.SANDSTONE, 4]], 'table', 'blocs'),
  r(B.RED_SANDSTONE, 1, [[B.RED_SAND, 4]], 'table', 'blocs'),
  r(B.BRICKS, 4, [[B.TERRACOTTA, 4]], 'table', 'blocs'),
  r(B.TERRACOTTA_RED, 4, [[B.TERRACOTTA, 4], [B.FLOWER, 1]], 'table', 'blocs'),
  r(B.TERRACOTTA_YELLOW, 4, [[B.TERRACOTTA, 4], [B.DANDELION, 1]], 'table', 'blocs'),
  r(B.TERRACOTTA_WHITE, 4, [[B.TERRACOTTA, 4], [B.DAISY, 1]], 'table', 'blocs'),
  r(B.TERRACOTTA_BROWN, 4, [[B.TERRACOTTA, 4], [B.BROWN_SHROOM, 1]], 'table', 'blocs'),
  r(B.LAMP, 2, [[I.CRYSTAL, 1], [B.GLASS, 2]], 'table', 'blocs'),
  r(B.LANTERN, 2, [[I.COPPER_INGOT, 1], [B.TORCH, 1]], 'table', 'blocs'),
  r(B.JACK_O_LANTERN, 1, [[B.PUMPKIN, 1], [B.TORCH, 1]], 'table', 'blocs'),
  r(B.WOOL, 1, [[I.FIBER, 4]], 'table', 'blocs'),
  r(B.COPPER_BLOCK, 1, [[I.COPPER_INGOT, 9]], 'table', 'blocs'),
  r(B.IRON_BLOCK, 1, [[I.IRON_INGOT, 9]], 'table', 'blocs'),
  r(B.GOLD_BLOCK, 1, [[I.GOLD_INGOT, 9]], 'table', 'blocs'),
  r(B.CRYSTAL_BLOCK, 1, [[I.CRYSTAL, 9]], 'table', 'blocs'),
  r(B.RUBY_BLOCK, 1, [[I.RUBY, 9]], 'table', 'blocs'),
  r(B.COAL_BLOCK, 1, [[I.COAL, 9]], 'table', 'blocs'),
  r(I.COPPER_INGOT, 9, [[B.COPPER_BLOCK, 1]], null, 'objets'),
  r(I.IRON_INGOT, 9, [[B.IRON_BLOCK, 1]], null, 'objets'),
  r(I.GOLD_INGOT, 9, [[B.GOLD_BLOCK, 1]], null, 'objets'),
  r(I.CRYSTAL, 9, [[B.CRYSTAL_BLOCK, 1]], null, 'objets'),
  r(I.RUBY, 9, [[B.RUBY_BLOCK, 1]], null, 'objets'),
  r(I.COAL, 9, [[B.COAL_BLOCK, 1]], null, 'objets'),
  r(I.GOLDEN_APPLE, 1, [[I.APPLE, 1], [I.GOLD_INGOT, 4]], 'table', 'objets'),
  r(I.FEATHER_CHARM, 1, [[I.CRYSTAL, 2], [I.SHADOW_ESSENCE, 2], [I.FEATHER, 3]], 'table', 'objets'),
  r(I.STAMINA_CHARM, 1, [[I.CRYSTAL, 2], [I.COOKED_MEAT, 3], [I.ROPE, 1]], 'table', 'objets'),
  r(I.RUBY_CHARM, 1, [[I.RUBY, 3], [I.GOLD_INGOT, 2], [I.ROPE, 1]], 'table', 'objets'),

  r(I.IRON_INGOT, 2, [[B.IRON_ORE, 2], [I.COAL, 1]], 'forge', 'objets'),
  r(I.COPPER_INGOT, 2, [[B.COPPER_ORE, 2], [I.COAL, 1]], 'forge', 'objets'),
  r(I.GOLD_INGOT, 2, [[B.GOLD_ORE, 2], [I.COAL, 1]], 'forge', 'objets'),
  r(B.GLASS, 4, [['sand', 4], [I.COAL, 1]], 'forge', 'blocs'),
  r(B.STONE, 4, [[B.COBBLE, 4], [I.COAL, 1]], 'forge', 'blocs'),
  r(B.TERRACOTTA, 4, [[B.CLAY, 4], [I.COAL, 1]], 'forge', 'blocs'),
  r(I.COOKED_MEAT, 2, [[I.RAW_MEAT, 2], [I.COAL, 1]], 'forge', 'objets'),
  r(I.PUMPKIN_PIE, 2, [[B.PUMPKIN, 1], [I.BERRIES, 2], [I.COAL, 1]], 'forge', 'objets'),
  r(I.COAL, 1, [['logs', 3]], 'forge', 'objets'),
  r(B.DAWN_HEART, 1, [[I.SKY_SHARD, 4], [I.SHADOW_ESSENCE, 4], [I.CRYSTAL, 4], [I.IRON_INGOT, 2]], 'forge', 'objets'),
];

CM.STATION_NAMES = { table: 'Établi', forge: 'Forge' };
CM.STATION_NEAR = { table: 'un établi', forge: 'une forge' };

// Butin d'un bloc cassé : liste de [id, quantité].
CM.blockDrops = function (id, rand) {
  const b = CM.blocks[id];
  if (b.wood && id === CM.woodOf(id).leaves) {
    const w = CM.woodOf(id);
    const out = [];
    if (rand() < 0.08) out.push([w.sapling, 1]);
    if (rand() < 0.12) out.push([I.STICK, 1]);
    if (w.key === 'OAK' && rand() < 0.06) out.push([I.APPLE, 1]);
    return out;
  }
  switch (id) {
    case B.TALLGRASS:
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
      return [[I.COAL, 1 + (rand() < 0.2 ? 1 : 0)]];
    default:
      return b.drop ? [[b.drop, 1]] : [];
  }
};
})();
