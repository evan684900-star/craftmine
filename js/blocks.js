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
defBlock(32, 'SAPLING', { name: "Pousse d'arbre", render: 'cross', tex: 'sapling', solid: false, opaque: false, hardness: 0, sound: 'grass', plant: true });
defBlock(31, 'CHEST', { name: 'Coffre', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', container: true });

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

// ------------------------------------------------------------ Recettes -----
// station: null (à la main), 'table' (établi à proximité), 'forge' (forge à proximité)
const B = CM.B;
const I = CM.I;
CM.recipes = [
  { out: B.PLANKS, n: 4, ing: [[B.LOG, 1]], station: null, cat: 'blocs' },
  { out: I.STICK, n: 4, ing: [[B.PLANKS, 2]], station: null, cat: 'objets' },
  { out: B.TABLE, n: 1, ing: [[B.PLANKS, 4]], station: null, cat: 'blocs' },
  { out: B.TORCH, n: 4, ing: [[I.STICK, 1], [I.COAL, 1]], station: null, cat: 'blocs' },
  { out: I.ROPE, n: 1, ing: [[I.FIBER, 3]], station: null, cat: 'objets' },

  { out: I.PICKAXE_1, n: 1, ing: [[B.PLANKS, 3], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.AXE_1, n: 1, ing: [[B.PLANKS, 3], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SHOVEL_1, n: 1, ing: [[B.PLANKS, 1], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SWORD_1, n: 1, ing: [[B.PLANKS, 2], [I.STICK, 1]], station: 'table', cat: 'outils' },
  { out: I.PICKAXE_2, n: 1, ing: [[B.COBBLE, 3], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.AXE_2, n: 1, ing: [[B.COBBLE, 3], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SHOVEL_2, n: 1, ing: [[B.COBBLE, 1], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SWORD_2, n: 1, ing: [[B.COBBLE, 2], [I.STICK, 1]], station: 'table', cat: 'outils' },
  { out: I.PICKAXE_3, n: 1, ing: [[I.IRON_INGOT, 3], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.AXE_3, n: 1, ing: [[I.IRON_INGOT, 3], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SHOVEL_3, n: 1, ing: [[I.IRON_INGOT, 1], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SWORD_3, n: 1, ing: [[I.IRON_INGOT, 2], [I.STICK, 1]], station: 'table', cat: 'outils' },
  { out: I.PICKAXE_4, n: 1, ing: [[I.CRYSTAL, 3], [I.IRON_INGOT, 1], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.AXE_4, n: 1, ing: [[I.CRYSTAL, 3], [I.IRON_INGOT, 1], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SHOVEL_4, n: 1, ing: [[I.CRYSTAL, 1], [I.IRON_INGOT, 1], [I.STICK, 2]], station: 'table', cat: 'outils' },
  { out: I.SWORD_4, n: 1, ing: [[I.CRYSTAL, 2], [I.IRON_INGOT, 1], [I.STICK, 1]], station: 'table', cat: 'outils' },
  { out: I.GRAPPLE, n: 1, ing: [[I.IRON_INGOT, 3], [I.ROPE, 2]], station: 'table', cat: 'outils' },

  { out: B.FORGE, n: 1, ing: [[B.COBBLE, 8]], station: 'table', cat: 'blocs' },
  { out: B.CHEST, n: 1, ing: [[B.PLANKS, 8]], station: 'table', cat: 'blocs' },
  { out: B.STONEBRICK, n: 4, ing: [[B.STONE, 4]], station: 'table', cat: 'blocs' },
  { out: B.LAMP, n: 2, ing: [[I.CRYSTAL, 1], [B.GLASS, 2]], station: 'table', cat: 'blocs' },
  { out: B.WOOL, n: 1, ing: [[I.FIBER, 4]], station: 'table', cat: 'blocs' },
  { out: I.FEATHER_CHARM, n: 1, ing: [[I.CRYSTAL, 2], [I.SHADOW_ESSENCE, 2], [B.WOOL, 1]], station: 'table', cat: 'objets' },
  { out: I.STAMINA_CHARM, n: 1, ing: [[I.CRYSTAL, 2], [I.COOKED_MEAT, 3], [I.ROPE, 1]], station: 'table', cat: 'objets' },

  { out: I.IRON_INGOT, n: 2, ing: [[B.IRON_ORE, 2], [I.COAL, 1]], station: 'forge', cat: 'objets' },
  { out: B.GLASS, n: 4, ing: [[B.SAND, 4], [I.COAL, 1]], station: 'forge', cat: 'blocs' },
  { out: B.STONE, n: 4, ing: [[B.COBBLE, 4], [I.COAL, 1]], station: 'forge', cat: 'blocs' },
  { out: B.BRICKS, n: 4, ing: [[B.DIRT, 4], [B.SAND, 2], [I.COAL, 1]], station: 'forge', cat: 'blocs' },
  { out: I.COOKED_MEAT, n: 2, ing: [[I.RAW_MEAT, 2], [I.COAL, 1]], station: 'forge', cat: 'objets' },
  { out: I.COAL, n: 1, ing: [[B.LOG, 3]], station: 'forge', cat: 'objets' },
  { out: B.DAWN_HEART, n: 1, ing: [[I.SKY_SHARD, 4], [I.SHADOW_ESSENCE, 4], [I.CRYSTAL, 4], [I.IRON_INGOT, 2]], station: 'forge', cat: 'objets' },
];

CM.STATION_NAMES = { table: 'Établi', forge: 'Forge' };
CM.STATION_NEAR = { table: 'un établi', forge: 'une forge' };

// Butin d'un bloc cassé : liste de [id, quantité].
CM.blockDrops = function (id, rand) {
  const b = CM.blocks[id];
  switch (id) {
    case B.TALLGRASS:
      return rand() < 0.6 ? [[I.FIBER, 1]] : [];
    case B.LEAVES: {
      const out = [];
      if (rand() < 0.08) out.push([B.SAPLING, 1]);
      if (rand() < 0.12) out.push([I.STICK, 1]);
      if (rand() < 0.05) out.push([I.BERRIES, 1]);
      return out;
    }
    case B.BERRYBUSH:
      return [[I.BERRIES, 2 + (rand() < 0.5 ? 1 : 0)], [I.FIBER, 1]];
    case B.CRYSTAL_ORE:
      return [[I.CRYSTAL, 1 + (rand() < 0.35 ? 1 : 0)]];
    case B.COAL_ORE:
      return [[I.COAL, 1 + (rand() < 0.2 ? 1 : 0)]];
    default:
      return b.drop ? [[b.drop, 1]] : [];
  }
};
})();
