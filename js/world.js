'use strict';
// Monde voxel infini : tronçons 16x16 générés à la demande autour du joueur,
// éclairage (ciel + blocs) propagé d'un tronçon à l'autre.
(function () {
  // Hauteurs : de MINY (socle, −64 comme dans Minecraft) à H − 1 (95). Les index des tronçons
  // commencent à MINY : la case y est rangée à la ligne y − MINY.
  const H = 96, SEA = 32, MINY = -64, TH = H - MINY, SY = TH / 16;
  const CVOL = 16 * 16 * TH;
  const LIMIT = 30000; // tronçons max depuis l'origine (±480 000 blocs)
  const REGION = 192; // taille des régions qui accueillent chacune au plus une île céleste
  CM.WORLD = { H, SEA, SY, LIMIT, MINY, TH };

  const ckey = (cx, cz) => (cx + 0x8000) * 0x10000 + (cz + 0x8000);
  const skey = (cx, sy, cz) => ckey(cx, cz) * 16 + sy;
  CM.ckey = ckey;
  CM.skey = skey;
  const lidx = (lx, y, lz) => ((y - MINY) << 8) | (lz << 4) | lx;
  const yOf = (i) => (i >> 8) + MINY; // hauteur d'un index local

  // Files d'attente de propagation de la lumière : (tronçon, index local).
  const QN = 1 << 21, QM = QN - 1;
  const Qc = new Array(QN), Qi = new Int32Array(QN);
  const RN = 1 << 20, RM = RN - 1;
  const Rc = new Array(RN), Ri = new Int32Array(RN), Rl = new Uint8Array(RN);
  let qh = 0, qt = 0;
  const push = (c, i) => {
    Qc[qt] = c;
    Qi[qt] = i;
    qt = (qt + 1) & QM;
  };

  const SKY = 1, BLK = 0;
  const getL = (L, i, ch) => (ch === SKY ? L[i] >> 4 : L[i] & 15);
  const setL = (L, i, ch, v) => {
    L[i] = ch === SKY ? (L[i] & 15) | (v << 4) : (L[i] & 0xf0) | v;
  };

  // Voisin d'une case (tronçon + index) dans une direction ; null hors du monde chargé.
  // dir : 0 -x, 1 +x, 2 -z, 3 +z, 4 -y, 5 +y
  let nbC = null;
  function step(c, i, dir) {
    const lx = i & 15, lz = (i >> 4) & 15, iy = i >> 8;
    switch (dir) {
      case 0: if (lx > 0) { nbC = c; return i - 1; } nbC = c.nb[0]; return nbC ? i + 15 : -1;
      case 1: if (lx < 15) { nbC = c; return i + 1; } nbC = c.nb[1]; return nbC ? i - 15 : -1;
      case 2: if (lz > 0) { nbC = c; return i - 16; } nbC = c.nb[2]; return nbC ? i + 240 : -1;
      case 3: if (lz < 15) { nbC = c; return i + 16; } nbC = c.nb[3]; return nbC ? i - 240 : -1;
      case 4: nbC = c; return iy > 0 ? i - 256 : -1;
      default: nbC = c; return iy < TH - 1 ? i + 256 : -1;
    }
  }

  class Chunk {
    constructor(cx, cz) {
      this.cx = cx;
      this.cz = cz;
      this.x0 = cx * 16;
      this.z0 = cz * 16;
      this.blocks = new Uint16Array(CVOL);
      this.light = new Uint8Array(CVOL);
      this.top = new Int16Array(256);
      this.nb = [null, null, null, null];
    }
  }

  // Grilles de bruit pour les grottes (réutilisées d'un tronçon à l'autre).
  const GS = 4, G = 5, GY = TH / GS + 1;
  const gA = new Float32Array(G * G * GY), gB = new Float32Array(G * G * GY), gC = new Float32Array(G * G * GY);
  function tri(g, lx, y, lz) {
    const fx = lx / GS, fy = (y - MINY) / GS, fz = lz / GS;
    const x0 = fx | 0, y0 = fy | 0, z0 = fz | 0;
    const tx = fx - x0, ty = fy - y0, tz = fz - z0;
    const i000 = (y0 * G + z0) * G + x0;
    const i010 = i000 + G * G;
    const a = g[i000] + (g[i000 + 1] - g[i000]) * tx;
    const b = g[i000 + G] + (g[i000 + G + 1] - g[i000 + G]) * tx;
    const c = g[i010] + (g[i010 + 1] - g[i010]) * tx;
    const d = g[i010 + G] + (g[i010 + G + 1] - g[i010 + G]) * tx;
    const ab = a + (b - a) * tz;
    const cd = c + (d - c) * tz;
    return ab + (cd - ab) * ty;
  }

  const gD = new Float32Array(G * G * GY), gE = new Float32Array(G * G * GY);

  // ------------------------------------------------------------ biomes ---
  // Les numéros existants ne changent pas (le nom s'affiche, rien n'est sauvegardé).
  const BIO = {
    PLAINS: 0, DESERT: 1, FOREST: 2, MOUNTAINS: 3, BIRCH: 4, TAIGA: 5, SNOWY_TAIGA: 6, TUNDRA: 7,
    SAVANNA: 8, JUNGLE: 9, SWAMP: 10, BADLANDS: 11, CRYSTAL: 12, OCEAN: 13, LAKE: 14,
    DARK_FOREST: 15, CHERRY: 16, MANGROVE: 17, BAMBOO: 18, MUSHROOM: 19, VOLCANIC: 20,
    FUNGUS: 21, ICE_SPIKES: 22, FLOWERS: 23, WARM_OCEAN: 24,
    NETHER_WASTES: 25, CRIMSON_FOREST: 26, WARPED_FOREST: 27, SOUL_VALLEY: 28, BASALT_DELTAS: 29,
  };
  const BIOME_NAMES = [
    'Plaines', 'Désert', 'Forêt', 'Montagnes', 'Forêt de bouleaux', 'Taïga', 'Taïga enneigée', 'Toundra glacée',
    'Savane', 'Jungle', 'Marais', 'Canyon rouge', 'Sylve cristalline', 'Océan', 'Lac',
    'Forêt de chênes noirs', 'Bosquet de cerisiers', 'Mangrove', 'Bambouseraie', 'Champignonnière', 'Terres volcaniques',
    'Forêt fongique', 'Pics de glace', 'Prairie fleurie', 'Océan chaud',
    'Désolation du Nether', 'Forêt carmin', 'Forêt biscornue', 'Vallée des âmes', 'Deltas de basalte',
  ];
  CM.BIO = BIO;
  CM.BIOME_NAMES = BIOME_NAMES;
  const COLD_BIOMES = new Set([BIO.SNOWY_TAIGA, BIO.TUNDRA, BIO.ICE_SPIKES]);

  // Arbres par biome : densité p, puis [type, poids, proportion de grands arbres].
  // any : pousse aussi hors de l'herbe (neige, nylium…).
  const TREES = [];
  TREES[BIO.PLAINS] = { p: 0.004, kinds: [['OAK', 0.8], ['BIRCH', 0.2]], bees: 0.15 };
  TREES[BIO.FOREST] = { p: 0.045, kinds: [['OAK', 0.72, 0.12], ['BIRCH', 0.22], ['DARK_OAK', 0.06]] };
  TREES[BIO.BIRCH] = { p: 0.05, kinds: [['BIRCH', 0.9], ['OAK', 0.1]], bees: 0.03 };
  TREES[BIO.TAIGA] = { p: 0.05, kinds: [['SPRUCE', 1]] };
  TREES[BIO.SNOWY_TAIGA] = { p: 0.04, kinds: [['SPRUCE', 1]] };
  TREES[BIO.TUNDRA] = { p: 0.003, kinds: [['SPRUCE', 1]] };
  TREES[BIO.SAVANNA] = { p: 0.008, kinds: [['ACACIA', 0.85], ['OAK', 0.15]] };
  TREES[BIO.JUNGLE] = { p: 0.08, kinds: [['JUNGLE', 0.8, 0.25], ['OAK', 0.2]] };
  TREES[BIO.SWAMP] = { p: 0.022, kinds: [['WILLOW', 1]] };
  TREES[BIO.CRYSTAL] = { p: 0.035, kinds: [['CRYSTAL', 1]] };
  TREES[BIO.DARK_FOREST] = { p: 0.075, kinds: [['DARK_OAK', 0.82], ['RED_MUSHROOM_TREE', 0.06], ['BROWN_MUSHROOM_TREE', 0.06], ['OAK', 0.06]] };
  TREES[BIO.CHERRY] = { p: 0.028, kinds: [['CHERRY', 1]], bees: 0.1 };
  TREES[BIO.MANGROVE] = { p: 0.05, kinds: [['MANGROVE', 1]], any: true };
  TREES[BIO.BAMBOO] = { p: 0.02, kinds: [['JUNGLE', 0.7, 0.2], ['OAK', 0.3]] };
  TREES[BIO.MUSHROOM] = { p: 0.014, kinds: [['RED_MUSHROOM_TREE', 0.5], ['BROWN_MUSHROOM_TREE', 0.5]], any: true };
  TREES[BIO.FUNGUS] = { p: 0.05, kinds: [['FUNGUS', 1]], any: true };
  TREES[BIO.ICE_SPIKES] = { p: 0.012, kinds: [['ICE_SPIKE', 1]], any: true };
  TREES[BIO.FLOWERS] = { p: 0.006, kinds: [['OAK', 0.5], ['BIRCH', 0.5]], bees: 0.5 };
  const MAX_TREE_P = 0.08;
  // Anciennes tables (mondes créés avant la version 4 : même paysage qu'avant).
  const LEGACY_TREES = [];
  LEGACY_TREES[BIO.PLAINS] = { p: 0.004, kinds: [['OAK', 0.8], ['BIRCH', 0.2]] };
  LEGACY_TREES[BIO.FOREST] = { p: 0.045, kinds: [['OAK', 0.78, 0.12], ['BIRCH', 0.22]] };
  LEGACY_TREES[BIO.BIRCH] = { p: 0.05, kinds: [['BIRCH', 0.9], ['OAK', 0.1]] };
  for (const k of ['TAIGA', 'SNOWY_TAIGA', 'TUNDRA', 'SAVANNA', 'JUNGLE', 'SWAMP', 'CRYSTAL']) LEGACY_TREES[BIO[k]] = TREES[BIO[k]];

  // Plantes par biome : [bloc, probabilité par colonne, hauteur max (cactus, canne, bambou)].
  const PLANTS = [];
  PLANTS[BIO.PLAINS] = [['TALLGRASS', 0.14], ['FLOWER', 0.006], ['DANDELION', 0.008], ['CORNFLOWER', 0.005], ['DAISY', 0.006], ['AZURE_BLUET', 0.005], ['RED_TULIP', 0.002],
    ['WHITE_TULIP', 0.002], ['PINK_TULIP', 0.002], ['SUNFLOWER', 0.002], ['BERRYBUSH', 0.003], ['PUMPKIN', 0.002]];
  PLANTS[BIO.FOREST] = [['TALLGRASS', 0.08], ['FERN', 0.02], ['FLOWER', 0.005], ['DANDELION', 0.004], ['LILY_OF_THE_VALLEY', 0.004], ['LILAC', 0.002], ['ROSE_BUSH', 0.002],
    ['PEONY', 0.002], ['BERRYBUSH', 0.01], ['RED_SHROOM', 0.005], ['BROWN_SHROOM', 0.006], ['AZALEA', 0.002]];
  PLANTS[BIO.BIRCH] = [['TALLGRASS', 0.09], ['DAISY', 0.01], ['DANDELION', 0.006], ['TULIP', 0.006], ['FERN', 0.01], ['LILY_OF_THE_VALLEY', 0.004]];
  PLANTS[BIO.TAIGA] = [['FERN', 0.06], ['TALLGRASS', 0.03], ['BERRYBUSH', 0.02], ['BROWN_SHROOM', 0.01], ['PUMPKIN', 0.0015]];
  PLANTS[BIO.SNOWY_TAIGA] = [['FERN', 0.02], ['BERRYBUSH', 0.006]];
  PLANTS[BIO.TUNDRA] = [['FERN', 0.004]];
  PLANTS[BIO.SAVANNA] = [['TALLGRASS', 0.16], ['DEAD_BUSH', 0.004], ['TULIP', 0.002]];
  PLANTS[BIO.JUNGLE] = [['TALLGRASS', 0.1], ['FERN', 0.1], ['MELON', 0.006], ['TULIP', 0.004], ['BAMBOO', 0.01, 8], ['AZALEA', 0.004], ['FLOWERING_AZALEA', 0.002]];
  PLANTS[BIO.SWAMP] = [['TALLGRASS', 0.05], ['FERN', 0.02], ['RED_SHROOM', 0.01], ['BROWN_SHROOM', 0.012], ['CORNFLOWER', 0.003], ['BLUE_ORCHID', 0.008]];
  PLANTS[BIO.DESERT] = [['CACTUS', 0.006, 3], ['DEAD_BUSH', 0.01]];
  PLANTS[BIO.BADLANDS] = [['DEAD_BUSH', 0.02], ['CACTUS', 0.002, 2]];
  PLANTS[BIO.CRYSTAL] = [['CRYSTAL_FLOWER', 0.03], ['TALLGRASS', 0.04], ['FERN', 0.02]];
  PLANTS[BIO.DARK_FOREST] = [['TALLGRASS', 0.05], ['FERN', 0.02], ['RED_SHROOM', 0.012], ['BROWN_SHROOM', 0.012], ['ROSE_BUSH', 0.003], ['LILAC', 0.002]];
  PLANTS[BIO.CHERRY] = [['TALLGRASS', 0.1], ['PINK_TULIP', 0.012], ['ALLIUM', 0.006], ['LILAC', 0.005], ['PEONY', 0.005]];
  PLANTS[BIO.MANGROVE] = [['FERN', 0.02], ['TALLGRASS', 0.03], ['BLUE_ORCHID', 0.004]];
  PLANTS[BIO.BAMBOO] = [['BAMBOO', 0.14, 10], ['FERN', 0.06], ['TALLGRASS', 0.05], ['MELON', 0.004]];
  PLANTS[BIO.MUSHROOM] = [['RED_SHROOM', 0.02], ['BROWN_SHROOM', 0.02]];
  PLANTS[BIO.VOLCANIC] = [['DEAD_BUSH', 0.008], ['WITHER_ROSE', 0.002]];
  PLANTS[BIO.FLOWERS] = [['TALLGRASS', 0.1], ['FLOWER', 0.02], ['DANDELION', 0.02], ['ALLIUM', 0.018], ['AZURE_BLUET', 0.018], ['RED_TULIP', 0.012], ['TULIP', 0.012],
    ['WHITE_TULIP', 0.012], ['PINK_TULIP', 0.012], ['DAISY', 0.018], ['CORNFLOWER', 0.018], ['LILY_OF_THE_VALLEY', 0.014], ['LILAC', 0.008], ['PEONY', 0.008],
    ['ROSE_BUSH', 0.008], ['SUNFLOWER', 0.008], ['TORCHFLOWER', 0.002]];

  const LEGACY_PLANTS = [];
  LEGACY_PLANTS[BIO.PLAINS] = [['TALLGRASS', 0.14], ['FLOWER', 0.009], ['DANDELION', 0.009], ['CORNFLOWER', 0.007], ['DAISY', 0.009], ['BERRYBUSH', 0.004], ['PUMPKIN', 0.002]];
  LEGACY_PLANTS[BIO.FOREST] = [['TALLGRASS', 0.08], ['FERN', 0.02], ['FLOWER', 0.006], ['DANDELION', 0.005], ['BERRYBUSH', 0.012], ['RED_SHROOM', 0.005], ['BROWN_SHROOM', 0.006]];
  LEGACY_PLANTS[BIO.BIRCH] = [['TALLGRASS', 0.09], ['DAISY', 0.01], ['DANDELION', 0.006], ['TULIP', 0.006], ['FERN', 0.01]];
  LEGACY_PLANTS[BIO.JUNGLE] = [['TALLGRASS', 0.1], ['FERN', 0.1], ['MELON', 0.006], ['TULIP', 0.004]];
  LEGACY_PLANTS[BIO.SWAMP] = [['TALLGRASS', 0.05], ['FERN', 0.02], ['RED_SHROOM', 0.01], ['BROWN_SHROOM', 0.012], ['CORNFLOWER', 0.003]];
  for (const k of ['TAIGA', 'SNOWY_TAIGA', 'TUNDRA', 'SAVANNA', 'DESERT', 'BADLANDS', 'CRYSTAL']) LEGACY_PLANTS[BIO[k]] = PLANTS[BIO[k]];

  const VEINS = [
    // [bloc, filons par tronçon, y min, y max, longueur, biome réservé]
    ['COAL_ORE', 8.6, 8, 76, 9],
    ['IRON_ORE', 5.1, 4, 50, 6],
    ['CRYSTAL_ORE', 1.25, 3, 19, 5],
    ['COPPER_ORE', 5, 16, 70, 7],
    ['GOLD_ORE', 1.6, 4, 32, 5],
    ['GOLD_ORE', 5, 30, 72, 5, BIO.BADLANDS],
    ['RUBY_ORE', 3, 40, 86, 3, BIO.MOUNTAINS],
    ['DIAMOND_ORE', 0.9, 2, 14, 4],
    ['LAPIS_ORE', 1.2, 4, 30, 5],
    ['REDSTONE_ORE', 2.4, 3, 16, 6],
    ['EMERALD_ORE', 2, 34, 86, 2, BIO.MOUNTAINS],
    ['NETHER_QUARTZ_ORE', 6, 10, 80, 6, BIO.VOLCANIC],
    ['NETHER_GOLD_ORE', 3, 10, 80, 5, BIO.VOLCANIC],
    ['ANCIENT_DEBRIS', 0.6, 3, 20, 2, BIO.VOLCANIC],
    // couches négatives (ajoutées à la fin : les filons plus haut ne changent pas)
    ['DIAMOND_ORE', 1.4, -63, 0, 5],
    ['REDSTONE_ORE', 3.2, -63, 2, 7],
    ['LAPIS_ORE', 1.4, -56, 4, 5],
    ['GOLD_ORE', 1.8, -60, 4, 5],
    ['IRON_ORE', 3.4, -60, 4, 6],
    ['CRYSTAL_ORE', 1.5, -60, 3, 5],
    ['COPPER_ORE', 1.2, -30, 4, 6],
    ['ANCIENT_DEBRIS', 0.12, -62, -36, 2],
  ];
  // Roches qu'un filon peut remplacer, et version « ardoise des abîmes » des minerais
  const ROCK = new Uint8Array(1024);
  const DEEP_ORE = new Uint16Array(1024);
  const BANDS = [];
  const RUIN_REGION = 112;

  // --------------------------------------------------------- villages ---
  // Au plus un village par région de 256 blocs, dans les biomes assez plats.
  const VILLAGE_REGION = 256;
  const VILLAGE_BIOMES = new Set([BIO.PLAINS, BIO.FLOWERS, BIO.SAVANNA, BIO.DESERT, BIO.TAIGA, BIO.SNOWY_TAIGA, BIO.TUNDRA, BIO.CHERRY, BIO.BIRCH, BIO.FOREST]);
  // Matériaux des maisons selon le biome.
  function villageStyle(bi) {
    const B = CM.B;
    const wood = (planks, log, roof, extra) => Object.assign({
      planks: B[planks], log: B[log], lower: B.COBBLE, floor: B[planks], roof: B[roof], roofSlab: B[roof + '_SLAB'],
      path: [B.GRAVEL, B.COARSE_DIRT, B.GRAVEL], flat: false, snow: false, door: 'OAK',
    }, extra || {});
    switch (bi) {
      case BIO.DESERT:
        return {
          planks: B.SANDSTONE, log: B.CUT_SANDSTONE, lower: B.SANDSTONE, floor: B.CUT_SANDSTONE, roof: B.SMOOTH_SANDSTONE,
          roofSlab: B.SMOOTH_SANDSTONE_SLAB, path: [B.SMOOTH_SANDSTONE, B.SMOOTH_SANDSTONE, B.CUT_SANDSTONE], flat: true, snow: false, door: 'BIRCH',
        };
      case BIO.SAVANNA: return wood('ACACIA_PLANKS', 'ACACIA_LOG', 'ACACIA_PLANKS', { lower: B.TERRACOTTA, path: [B.COARSE_DIRT, B.COARSE_DIRT, B.GRAVEL], door: 'ACACIA' });
      case BIO.TAIGA: return wood('SPRUCE_PLANKS', 'SPRUCE_LOG', 'SPRUCE_PLANKS', { door: 'SPRUCE' });
      case BIO.SNOWY_TAIGA:
      case BIO.TUNDRA: return wood('SPRUCE_PLANKS', 'SPRUCE_LOG', 'SPRUCE_PLANKS', { snow: true, door: 'SPRUCE' });
      case BIO.CHERRY: return wood('CHERRY_PLANKS', 'CHERRY_LOG', 'CHERRY_PLANKS');
      case BIO.BIRCH: return wood('BIRCH_PLANKS', 'BIRCH_LOG', 'SPRUCE_PLANKS', { door: 'BIRCH' });
      default: return wood('PLANKS', 'LOG', 'DARK_OAK_PLANKS');
    }
  }
  // Dimensions des bâtiments (largeur le long de la route, profondeur, hauteur des murs).
  const VILLAGE_KINDS = {
    house: { w: 5, d: 5, h: 3 },
    bighouse: { w: 7, d: 6, h: 4 },
    farm: { w: 7, d: 9, h: 0 },
    smith: { w: 7, d: 6, h: 4 },
    library: { w: 7, d: 5, h: 4 },
  };
  const GEODE_REGION = 80;
  const FORT_REGION = 160; // forteresses du Nether
  CM.initWorldTables = function () {
    const Bk = CM.B;
    for (const k of ['STONE', 'DEEPSTONE', 'GRANITE', 'DIORITE', 'ANDESITE', 'TUFF', 'NETHERRACK', 'BLACKSTONE', 'BASALT']) ROCK[Bk[k]] = 1;
    for (const k of ['COAL', 'IRON', 'COPPER', 'GOLD', 'DIAMOND', 'EMERALD', 'LAPIS', 'REDSTONE']) DEEP_ORE[Bk[k + '_ORE']] = Bk['DEEPSLATE_' + k + '_ORE'];
    const T = Bk.TERRACOTTA, R = Bk.TERRACOTTA_RED, Y = Bk.TERRACOTTA_YELLOW, BR = Bk.TERRACOTTA_BROWN, WH = Bk.TERRACOTTA_WHITE;
    const O = Bk.TERRACOTTA_ORANGE, LG = Bk.TERRACOTTA_LIGHT_GRAY;
    BANDS.push(T, T, R, Y, T, WH, BR, O, R, R, Y, BR, T, WH, LG, BR);
  };
  CM.initWorldTables();

  class World {
    constructor(seed, edits, settings) {
      this.seed = seed >>> 0;
      this.settings = Object.assign({ type: 'normal', biomeSize: 'normal' }, settings || {});
      this.bscale = { small: 0.6, normal: 1, large: 1.6 }[this.settings.biomeSize] || 1;
      this.type = this.settings.type;
      this.chunks = new Map();
      this.edits = new Map(); // clé de tronçon -> Map(index local -> bloc)
      this.dirty = new Map(); // clé de section -> 1 (lumière) ou 2 (bloc modifié)
      this.islandCache = new Map();
      this.trackDirty = false;
      this.genChunk = null;
      this._lc = null;
      const s = this.seed;
      this.nA = new CM.Noise(s);
      this.nB = new CM.Noise(s + 101);
      this.nC = new CM.Noise(s + 202);
      this.nD = new CM.Noise(s + 303);
      this.nE = new CM.Noise(s + 404);
      this.nF = new CM.Noise(s + 505);
      // Décalage propre à chaque graine : sans lui, le bruit vaut 0 à l'origine pour
      // toutes les graines et les points d'apparition se ressemblent tous.
      const r = CM.rng(s ^ 0x9e3779b9);
      this.ox = Math.floor((r() - 0.5) * 200000);
      this.oz = Math.floor((r() - 0.5) * 200000);
      // Monde d'une ancienne version : on garde l'ancien générateur de relief.
      this.legacy = this.settings.gen === 1;
      // villages : mondes créés depuis leur ajout (générateur 3), pour ne pas changer les anciens
      this.hasVillages = !this.legacy && (this.settings.gen || 2) >= 3;
      this.mixedFarms = (this.settings.gen || 2) >= 4; // champs variés et irrigués dans les villages
      // lave : lacs au fond des cavernes (tous les mondes : sans elle, pas d'obsidienne ni de Nether),
      // mares en surface dans les terres volcaniques (mondes récents seulement)
      this.lavaLakes = true;
      this.lavaPools = (this.settings.gen || 2) >= 5;
      this.villageCache = new Map();
      // Nether : pas de villages ni d'îles, un autre générateur (voir generateNether)
      this.nether = this.type === 'nether';
      if (this.nether) this.hasVillages = false;
      if (this.legacy) this.ox = this.oz = 0;
      this.trees = this.legacy ? LEGACY_TREES : TREES;
      this.plants = this.legacy ? LEGACY_PLANTS : PLANTS;
      // sauvegarde d'avant les couches négatives : ses index commençaient à y = 0
      const shift = this.settings.ymin === MINY ? 0 : -MINY * 256;
      this.settings.ymin = MINY;
      if (edits) {
        for (const k in edits) {
          const [cx, cz] = k.split(',').map(Number);
          const arr = edits[k];
          const m = new Map();
          for (let j = 0; j + 1 < arr.length; j += 2) {
            const i = arr[j] + shift;
            if (CM.blocks[arr[j + 1]] && i >= 0 && i < CVOL) m.set(i, arr[j + 1]);
          }
          if (m.size) this.edits.set(ckey(cx, cz), m);
        }
      }
      this.spawn = this.findSpawn();
    }

    // ---------------------------------------------------------- accès ----
    chunkAt(x, z) {
      const cx = x >> 4, cz = z >> 4;
      const c = this._lc;
      if (c && c.cx === cx && c.cz === cz) return c;
      const n = this.chunks.get(ckey(cx, cz));
      if (n) this._lc = n;
      return n || null;
    }
    loaded(x, z) {
      return !!this.chunkAt(Math.floor(x), Math.floor(z));
    }
    inside(x, y, z) {
      return y >= MINY && y < H && !!this.chunkAt(x, z);
    }
    get(x, y, z) {
      if (y < MINY || y >= H) return 0;
      const c = this.chunkAt(x, z);
      return c ? c.blocks[lidx(x & 15, y, z & 15)] : 0;
    }
    // Pour les collisions : un tronçon pas encore chargé fait office de mur.
    solidAt(x, y, z) {
      if (y < MINY) return true;
      if (y >= H) return false;
      const c = this.chunkAt(x, z);
      return c ? CM.blocks[c.blocks[lidx(x & 15, y, z & 15)]].solid : true;
    }
    // Boîte de collision d'une case (null : vide ou traversable). Tronçon non chargé : mur.
    colBox(x, y, z) {
      if (y < MINY) return CM.FULL_BOX;
      if (y >= H) return null;
      const c = this.chunkAt(x, z);
      if (!c) return CM.FULL_BOX;
      return CM.blocks[c.blocks[lidx(x & 15, y, z & 15)]].col;
    }
    // Hauteur de la partie solide d'une case (0 : vide, 1 : bloc plein, 0.5 : dalle…).
    solidHeight(x, y, z) {
      const b = this.colBox(x, y, z);
      return b ? b[4] : 0;
    }
    skyAt(x, y, z) {
      if (y >= H) return 15;
      if (y < MINY) return 0;
      const c = this.chunkAt(x, z);
      return c ? c.light[lidx(x & 15, y, z & 15)] >> 4 : 15;
    }
    blockLightAt(x, y, z) {
      if (y < MINY || y >= H) return 0;
      const c = this.chunkAt(x, z);
      return c ? c.light[lidx(x & 15, y, z & 15)] & 15 : 0;
    }
    // Un tronçon peut être maillé quand lui et ses 8 voisins sont chargés.
    meshable(cx, cz) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.chunks.has(ckey(cx + dx, cz + dz))) return false;
      return true;
    }

    // ------------------------------------------------ relief et biomes ----
    // Ancien générateur (version 3) : conservé pour que les vieux mondes ne changent pas.
    columnV3(x, z) {
      const { nA, nB, nC, nD, nE, nF } = this;
      const Bk = CM.B;
      const cont = nA.fbm2(x / 480, z / 480, 4);
      const land = CM.smoothstep(-0.3, -0.06, cont);
      const hills = nA.fbm2(x / 46 + 100, z / 46 - 50, 4);
      let ridge = 1 - Math.abs(nB.noise2(x / 95, z / 95));
      ridge *= ridge;
      const mMask = CM.smoothstep(0.05, 0.45, nC.fbm2(x / 190 + 50, z / 190, 2));
      const wx = x + nB.noise2(x / 90, z / 90) * 28, wz = z + nB.noise2(x / 90 + 50, z / 90) * 28;
      const T = nD.fbm2(wx / 700, wz / 700, 2);
      const M = nE.fbm2(wx / 550 + 30, wz / 550, 2);
      const Wd = nF.fbm2(wx / 420, wz / 420, 2);
      const hot = CM.smoothstep(0.14, 0.3, T);
      const cold = CM.smoothstep(-0.22, -0.38, T);
      const swampW = CM.smoothstep(0.28, 0.42, M) * (1 - hot) * (1 - cold) * (1 - mMask);
      const mesaW = CM.smoothstep(0.3, 0.42, Wd) * hot * CM.smoothstep(0.06, -0.06, M);
      let landH = SEA + 4 + cont * 6 + hills * 5 + ridge * mMask * 40;
      landH += (SEA + 1.3 + hills * 1.5 - landH) * swampW;
      if (mesaW > 0) {
        const plateau = CM.smoothstep(-0.05, 0.2, nC.noise2(x / 55, z / 55)) * 16;
        landH += mesaW * (plateau + 5);
        landH += (Math.floor(landH / 4) * 4 - landH) * mesaW;
      }
      const seaH = SEA - 7 + cont * 8 + hills * 2;
      const h = Math.floor(CM.clamp(seaH + (landH - seaH) * land, 4, 86));
      let bi;
      if (h < SEA - 1) bi = land < 0.5 ? BIO.OCEAN : BIO.LAKE;
      else if (h > 62) bi = BIO.MOUNTAINS;
      else if (cold > 0.5) bi = M > 0 ? BIO.SNOWY_TAIGA : BIO.TUNDRA;
      else if (T < -0.12) bi = BIO.TAIGA;
      else if (hot > 0.5) bi = mesaW > 0.5 ? BIO.BADLANDS : M < -0.15 ? BIO.DESERT : M < 0.2 ? BIO.SAVANNA : BIO.JUNGLE;
      else if (Wd < -0.48) bi = BIO.CRYSTAL;
      else if (swampW > 0.5) bi = BIO.SWAMP;
      else bi = M < -0.25 ? BIO.PLAINS : M < 0.12 ? BIO.FOREST : BIO.BIRCH;
      let topB, subB, subDepth = 3, deepSub = 0;
      if (h < SEA - 1) {
        const f = nB.noise2(x / 18, z / 18);
        topB = f > 0.35 ? Bk.GRAVEL : f < -0.45 && h > SEA - 8 ? Bk.CLAY : h > SEA - 9 ? Bk.SAND : Bk.DIRT;
        subB = topB === Bk.CLAY ? Bk.CLAY : topB;
      } else if (bi === BIO.SWAMP) {
        topB = h <= SEA ? Bk.MUD : Bk.SWAMP_GRASS;
        subB = h <= SEA ? Bk.CLAY : Bk.DIRT;
      } else if (bi === BIO.BADLANDS) {
        topB = h > SEA + 6 ? this.band(x, h, z) : Bk.RED_SAND;
        subB = -1;
        subDepth = 14;
      } else if (h <= SEA + 1) {
        topB = cold > 0.5 ? Bk.GRAVEL : Bk.SAND;
        subB = topB;
      } else if (bi === BIO.MOUNTAINS) {
        const snowLine = (cold > 0.5 ? 58 : 67) + Math.floor(nD.noise2(x / 12, z / 12) * 3);
        topB = h >= snowLine ? Bk.SNOW : Bk.STONE;
        subB = Bk.STONE;
      } else {
        switch (bi) {
          case BIO.DESERT: topB = Bk.SAND; subB = Bk.SAND; deepSub = Bk.SANDSTONE; break;
          case BIO.SAVANNA: topB = Bk.DRY_GRASS; subB = Bk.DIRT; break;
          case BIO.JUNGLE: topB = Bk.LUSH_GRASS; subB = Bk.DIRT; break;
          case BIO.TAIGA: topB = nB.noise2(x / 9, z / 9) > 0.1 ? Bk.PODZOL : Bk.GRASS; subB = Bk.DIRT; break;
          case BIO.SNOWY_TAIGA:
          case BIO.TUNDRA: topB = Bk.SNOWY_GRASS; subB = Bk.DIRT; break;
          case BIO.CRYSTAL: topB = Bk.CRYSTAL_MOSS; subB = Bk.DIRT; break;
          default: topB = Bk.GRASS; subB = Bk.DIRT;
        }
      }
      return { h, bi, topB, subB, subDepth, deepSub, frozen: cold > 0.5, variant: 0 };
    }

    column(x, z) {
      const Bk = CM.B;
      if (this.nether) return this.netherColumn(x, z);
      if (this.legacy) return this.columnV3(x, z);
      if (this.type === 'flat') return { h: SEA + 8, bi: BIO.PLAINS, topB: Bk.GRASS, subB: Bk.DIRT, subDepth: 3, deepSub: 0, frozen: false, flat: true };
      const { nA, nB, nC, nD, nE, nF } = this;
      const X = x + this.ox, Z = z + this.oz;
      const S = this.bscale;
      let cont = nA.fbm2(X / 480, Z / 480, 4);
      if (this.type === 'islands') cont = cont * 1.15 - 0.3;
      const land = CM.smoothstep(-0.3, -0.06, cont);
      const amp = this.type === 'amplified' ? 1.9 : 1;
      const hills = nA.fbm2(X / 46 + 100, Z / 46 - 50, 4);
      let ridge = 1 - Math.abs(nB.noise2(X / 95, Z / 95));
      ridge *= ridge;
      const mMask = CM.smoothstep(this.type === 'amplified' ? -0.1 : 0.05, 0.45, nC.fbm2(X / 190 + 50, Z / 190, 2));
      // climat : zones aux bords déformés (taille réglable)
      const wx = X + nB.noise2(X / 90, Z / 90) * 28, wz = Z + nB.noise2(X / 90 + 50, Z / 90) * 28;
      const T = nD.fbm2(wx / (520 * S), wz / (520 * S), 2); // température
      const M = nE.fbm2(wx / (420 * S) + 30, wz / (420 * S), 2); // humidité
      const Wd = nF.fbm2(wx / (340 * S), wz / (340 * S), 2); // étrangeté (biomes rares)
      const hot = CM.smoothstep(0.16, 0.32, T);
      const cold = CM.smoothstep(-0.32, -0.48, T);
      const swampW = CM.smoothstep(0.28, 0.42, M) * (1 - hot) * (1 - cold) * (1 - mMask);
      const mangW = CM.smoothstep(0.34, 0.48, M) * hot * (1 - mMask);
      const mesaW = CM.smoothstep(0.3, 0.42, Wd) * hot * CM.smoothstep(0.06, -0.06, M);
      const volcW = CM.smoothstep(-0.34, -0.46, Wd) * hot * CM.smoothstep(0.12, -0.02, M);
      let landH = SEA + 4 + cont * 6 + hills * 5 * amp + ridge * mMask * 40 * amp;
      landH += (SEA + 1.3 + hills * 1.5 - landH) * Math.max(swampW, mangW); // marais : au ras de l'eau
      if (mesaW > 0) {
        const plateau = CM.smoothstep(-0.05, 0.2, nC.noise2(X / 55, Z / 55)) * 16;
        landH += mesaW * (plateau + 5);
        landH += (Math.floor(landH / 4) * 4 - landH) * mesaW; // terrasses
      }
      if (volcW > 0) landH += volcW * (ridge * 16 + Math.abs(hills) * 8 + 2); // reliefs volcaniques déchiquetés
      const seaH = SEA - 7 + cont * 8 + hills * 2;
      let h = seaH + (landH - seaH) * land;
      // îles aux champignons au large
      const mushN = nF.noise2(X / 260 + 77, Z / 260 - 33);
      const mush = CM.smoothstep(0.5, 0.64, mushN) * CM.smoothstep(-0.12, -0.3, cont);
      if (mush > 0) h += (SEA + 2 + hills * 3 - h) * mush;
      h = Math.floor(CM.clamp(h, 4, 90));

      let bi;
      if (mush > 0.5 && h >= SEA) bi = BIO.MUSHROOM;
      else if (h < SEA - 1) bi = land < 0.5 ? (hot > 0.5 ? BIO.WARM_OCEAN : BIO.OCEAN) : BIO.LAKE;
      else if (h > 62) bi = BIO.MOUNTAINS;
      else if (cold > 0.5) bi = Wd > 0.35 ? BIO.ICE_SPIKES : M > 0 ? BIO.SNOWY_TAIGA : BIO.TUNDRA;
      else if (T < -0.28) bi = BIO.TAIGA;
      else if (hot > 0.5) {
        if (mesaW > 0.5) bi = BIO.BADLANDS;
        else if (volcW > 0.5) bi = BIO.VOLCANIC;
        else if (mangW > 0.5) bi = BIO.MANGROVE;
        else if (M < -0.15) bi = BIO.DESERT;
        else if (M < 0.2) bi = BIO.SAVANNA;
        else bi = Wd > 0.25 ? BIO.BAMBOO : BIO.JUNGLE;
      } else if (Wd < -0.53) bi = BIO.CRYSTAL;
      else if (Wd > 0.5 && M < 0) bi = BIO.FUNGUS;
      else if (swampW > 0.5) bi = BIO.SWAMP;
      else if (M < -0.25) bi = Wd > 0.22 ? BIO.FLOWERS : BIO.PLAINS;
      else if (M < 0.12) bi = Wd < -0.22 ? BIO.CHERRY : BIO.FOREST;
      else bi = Wd > 0.15 ? BIO.DARK_FOREST : BIO.BIRCH;

      // blocs de surface
      let topB, subB, subDepth = 3, deepSub = 0, variant = 0;
      if (h < SEA - 1) {
        const f = nB.noise2(X / 18, Z / 18);
        if (bi === BIO.WARM_OCEAN) topB = Bk.SAND;
        else topB = f > 0.35 ? Bk.GRAVEL : f < -0.45 && h > SEA - 8 ? Bk.CLAY : h > SEA - 9 ? Bk.SAND : Bk.DIRT;
        subB = topB === Bk.CLAY ? Bk.CLAY : topB;
      } else if (bi === BIO.MUSHROOM) {
        topB = Bk.MYCELIUM;
        subB = Bk.DIRT;
      } else if (bi === BIO.SWAMP) {
        topB = h <= SEA ? Bk.MUD : Bk.SWAMP_GRASS;
        subB = h <= SEA ? Bk.CLAY : Bk.DIRT;
      } else if (bi === BIO.MANGROVE) {
        topB = Bk.MUD;
        subB = Bk.MUD;
        subDepth = 4;
        deepSub = Bk.CLAY;
      } else if (bi === BIO.BADLANDS) {
        topB = h > SEA + 6 ? this.band(x, h, z) : Bk.RED_SAND;
        subB = -1; // bandes de terre cuite
        subDepth = 14;
      } else if (bi === BIO.VOLCANIC) {
        const v = nC.noise2(X / 14, Z / 14), v2 = nB.noise2(X / 6, Z / 6);
        topB = v2 > 0.62 ? (v2 > 0.76 && this.lavaPools && h > SEA + 1 ? Bk.LAVA : Bk.MAGMA) : v > 0.25 ? Bk.BASALT : v < -0.3 ? Bk.NETHERRACK : v2 < -0.6 ? Bk.SOUL_SAND : Bk.BLACKSTONE;
        subB = Bk.BLACKSTONE;
        subDepth = 5;
        deepSub = Bk.NETHERRACK;
      } else if (h <= SEA + 1 && bi !== BIO.ICE_SPIKES) {
        topB = cold > 0.5 ? Bk.GRAVEL : Bk.SAND;
        subB = topB;
      } else if (bi === BIO.MOUNTAINS) {
        const snowLine = (cold > 0.5 ? 58 : 67) + Math.floor(nD.noise2(X / 12, Z / 12) * 3);
        const rocky = nC.noise2(X / 20, Z / 20);
        topB = h >= snowLine ? Bk.SNOW : rocky > 0.45 ? Bk.ANDESITE : rocky < -0.5 ? Bk.GRAVEL : Bk.STONE;
        subB = Bk.STONE;
      } else {
        switch (bi) {
          case BIO.DESERT: topB = Bk.SAND; subB = Bk.SAND; deepSub = Bk.SANDSTONE; break;
          case BIO.SAVANNA: topB = nB.noise2(X / 11, Z / 11) > 0.55 ? Bk.COARSE_DIRT : Bk.DRY_GRASS; subB = Bk.DIRT; break;
          case BIO.JUNGLE: topB = Bk.LUSH_GRASS; subB = Bk.DIRT; break;
          case BIO.BAMBOO: topB = nB.noise2(X / 9, Z / 9) > 0 ? Bk.PODZOL : Bk.LUSH_GRASS; subB = Bk.DIRT; break;
          case BIO.TAIGA: topB = nB.noise2(X / 9, Z / 9) > 0.1 ? Bk.PODZOL : Bk.GRASS; subB = Bk.DIRT; break;
          case BIO.DARK_FOREST: topB = nB.noise2(X / 7, Z / 7) > 0.5 ? Bk.PODZOL : Bk.GRASS; subB = Bk.DIRT; break;
          case BIO.SNOWY_TAIGA:
          case BIO.TUNDRA: topB = Bk.SNOWY_GRASS; subB = Bk.DIRT; break;
          case BIO.ICE_SPIKES: topB = Bk.SNOW; subB = Bk.SNOW; subDepth = 2; break;
          case BIO.CRYSTAL: topB = Bk.CRYSTAL_MOSS; subB = Bk.DIRT; break;
          case BIO.FUNGUS:
            variant = nC.noise2(X / 70, Z / 70) > 0 ? 1 : 0; // 1 : carmin, 0 : biscornu
            topB = variant ? Bk.CRIMSON_NYLIUM : Bk.WARPED_NYLIUM;
            subB = Bk.NETHERRACK;
            subDepth = 4;
            break;
          default: topB = Bk.GRASS; subB = Bk.DIRT;
        }
      }
      return { h, bi, topB, subB, subDepth, deepSub, frozen: cold > 0.5 || bi === BIO.ICE_SPIKES, variant };
    }

    // Couleur de terre cuite en bandes horizontales (canyons rouges).
    band(x, y, z) {
      const o = Math.floor(this.nC.noise2((x + this.ox) / 40, (z + this.oz) / 40) * 3);
      return BANDS[(((y + o) % 16) + 16) % 16];
    }

    biomeName(x, z) {
      return BIOME_NAMES[this.column(Math.floor(x), Math.floor(z)).bi];
    }

    // ---------------------------------------------------------- arbres ----
    // Type d'arbre d'une colonne (déterministe) : null ou { type, big, bees }.
    treeAt(x, z, info) {
      if (info.flat) return null;
      if (this.hasVillages && this.villageNear(x, z, 6)) return null;
      const t = this.trees[info.bi];
      if (!t) return null;
      if (!t.any && !CM.blocks[info.topB].soil && info.topB !== CM.B.GRASS) return null;
      if (info.h + 17 >= H || info.h <= SEA - 1) return null;
      if (CM.hash3(x, 7, z, this.seed) >= t.p) return null;
      const k = CM.hash3(x, 8, z, this.seed);
      let acc = 0;
      for (const [type, w, big] of t.kinds) {
        acc += w;
        if (k < acc) {
          const real = type === 'FUNGUS' ? (info.variant ? 'CRIMSON' : 'WARPED') : type;
          return { type: real, big: big && CM.hash3(x, 9, z, this.seed) < big, bees: t.bees && CM.hash3(x, 10, z, this.seed) < t.bees };
        }
      }
      return null;
    }

    // Liste des blocs d'un arbre : [x, y, z, id, seulementDansLeVide].
    treeShape(type, big, x, y, z, bees) {
      const Bk = CM.B, seed = this.seed;
      const hsh = (k) => CM.hash3(x, k, z, seed + 21);
      const out = [];
      // arbres qui ne sont pas des essences de bois : champignons géants, pics de glace
      if (type === 'ICE_SPIKE') {
        const th = 6 + Math.floor(hsh(1) * (hsh(2) < 0.15 ? 18 : 8));
        const R = th > 14 ? 2.6 : 1.6;
        for (let dy = -1; dy < th; dy++) {
          const rr = R * (1 - Math.max(0, dy) / th);
          const ir = Math.ceil(rr);
          for (let dz = -ir; dz <= ir; dz++) for (let dx = -ir; dx <= ir; dx++) if (dx * dx + dz * dz <= rr * rr + 0.3) out.push([x + dx, y + dy, z + dz, Bk.PACKED_ICE, false]);
        }
        return out;
      }
      if (type === 'RED_MUSHROOM_TREE' || type === 'BROWN_MUSHROOM_TREE') {
        const red = type === 'RED_MUSHROOM_TREE';
        const cap = red ? Bk.RED_MUSHROOM_BLOCK : Bk.BROWN_MUSHROOM_BLOCK;
        const th = 5 + Math.floor(hsh(1) * 3);
        for (let i = 0; i < th; i++) out.push([x, y + i, z, Bk.MUSHROOM_STEM, false]);
        if (red) {
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            out.push([x + dx, y + th, z + dz, cap, true]);
            if (Math.abs(dx) === 2 || Math.abs(dz) === 2) for (let k = 1; k <= 3; k++) out.push([x + dx, y + th - k, z + dz, cap, true]);
          }
        } else {
          for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (!(Math.abs(dx) === 3 && Math.abs(dz) === 3)) out.push([x + dx, y + th, z + dz, cap, true]);
        }
        return out;
      }
      const w = CM.WOODS.find((v) => v.key === type);
      const LOG = w.log, LEAF = w.leaves;
      const leaf = (X, Y, Z) => out.push([X, Y, Z, LEAF, true]);
      const blob = (cx, cy, cz, R, low, high) => {
        for (let dy = low; dy <= high; dy++) {
          const r = dy >= 0 ? R - 1 : R;
          for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && (dy >= 0 || CM.hash3(cx + dx, cy + dy, cz + dz, seed + 22) < 0.5)) continue;
              leaf(cx + dx, cy + dy, cz + dz);
            }
        }
      };
      if (!w.nether && type !== 'MANGROVE') out.push([x, y - 1, z, Bk.DIRT, false]);
      let th;
      switch (type) {
        case 'SPRUCE': {
          th = 6 + Math.floor(hsh(1) * 4);
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          leaf(x, y + th, z);
          let r = 1;
          for (let yy = y + th - 1; yy >= y + 2; yy--) {
            for (let dz = -r; dz <= r; dz++)
              for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dz) <= r + (r > 1 ? 1 : 0) && (dx || dz)) leaf(x + dx, yy, z + dz);
            r = r === 1 ? 2 : r === 2 && yy < y + th - 4 && th > 7 ? 3 : 1;
          }
          break;
        }
        case 'ACACIA': {
          th = 4 + Math.floor(hsh(1) * 2);
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          const [ddx, ddz] = dirs[Math.floor(hsh(2) * 4)];
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          const bx = x + ddx * 2, bz = z + ddz * 2, by = y + th + 1;
          out.push([x + ddx, y + th, z + ddz, LOG, false]);
          out.push([bx, by, bz, LOG, false]);
          for (let dz = -3; dz <= 3; dz++)
            for (let dx = -3; dx <= 3; dx++) {
              if (Math.abs(dx) + Math.abs(dz) > 4) continue;
              leaf(bx + dx, by + 1, bz + dz);
              if (Math.abs(dx) + Math.abs(dz) <= 2) leaf(bx + dx, by + 2, bz + dz);
            }
          break;
        }
        case 'JUNGLE': {
          th = big ? 12 + Math.floor(hsh(1) * 5) : 6 + Math.floor(hsh(1) * 3);
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          const R = big ? 4 : 2;
          for (let dy = -1; dy <= 1; dy++) {
            const rr = dy === 1 ? R - 2 : dy === 0 ? R - 1 : R;
            for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dz * dz <= rr * rr + 1) leaf(x + dx, y + th + dy, z + dz);
          }
          if (big) for (let i = 4; i < th - 2; i += 3) {
            const s = Math.floor(CM.hash3(x, i, z, seed + 23) * 4);
            const [ox, oz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][s];
            leaf(x + ox, y + i, z + oz);
            leaf(x + ox * 2, y + i, z + oz * 2);
            leaf(x + ox, y + i + 1, z + oz);
          }
          break;
        }
        case 'WILLOW': {
          th = 4 + Math.floor(hsh(1) * 3);
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          blob(x, y + th, z, 3, -2, 0);
          for (let dz = -3; dz <= 3; dz++)
            for (let dx = -3; dx <= 3; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dz)) !== 3 || (Math.abs(dx) === 3 && Math.abs(dz) === 3)) continue;
              const len = Math.floor(CM.hash3(x + dx, y, z + dz, seed + 24) * 4);
              for (let k = 1; k <= len; k++) leaf(x + dx, y + th - 2 - k, z + dz);
            }
          break;
        }
        case 'CRYSTAL': {
          th = 5 + Math.floor(hsh(1) * 3);
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          for (let dy = -2; dy <= 2; dy++)
            for (let dz = -3; dz <= 3; dz++)
              for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy * 1.6 + dz * dz <= 7.5) leaf(x + dx, y + th + dy, z + dz);
          break;
        }
        case 'DARK_OAK': {
          // tronc 2x2 et large couronne plate
          th = 6 + Math.floor(hsh(1) * 3);
          for (let i = 0; i < th; i++) for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) out.push([x + ox, y + i, z + oz, LOG, false]);
          for (const [ox, oz] of [[1, 0], [0, 1], [1, 1]]) out.push([x + ox, y - 1, z + oz, Bk.DIRT, false]);
          for (let dy = -1; dy <= 1; dy++) {
            const R = dy === 1 ? 2.6 : 4.2;
            for (let dz = -4; dz <= 5; dz++)
              for (let dx = -4; dx <= 5; dx++) {
                const d = Math.hypot(dx - 0.5, dz - 0.5);
                if (d <= R && (d < R - 0.8 || CM.hash3(x + dx, y + dy, z + dz, seed + 25) < 0.6)) leaf(x + dx, y + th + dy, z + dz);
              }
          }
          break;
        }
        case 'CHERRY': {
          th = 5 + Math.floor(hsh(1) * 3);
          const [ddx, ddz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(hsh(2) * 4)];
          for (let i = 0; i < th; i++) out.push([x + (i > th - 3 ? ddx : 0), y + i, z + (i > th - 3 ? ddz : 0), LOG, false]);
          const cx = x + ddx, cz = z + ddz, cy = y + th;
          for (let dy = -1; dy <= 2; dy++)
            for (let dz = -4; dz <= 4; dz++)
              for (let dx = -4; dx <= 4; dx++) {
                const e = (dx * dx + dz * dz) / 16 + (dy - 0.3) * (dy - 0.3) / 3;
                if (e <= 1 && (e < 0.75 || CM.hash3(cx + dx, cy + dy, cz + dz, seed + 26) < 0.55)) leaf(cx + dx, cy + dy, cz + dz);
              }
          // feuilles tombantes
          for (let k = 0; k < 6; k++) {
            const a = hsh(30 + k) * Math.PI * 2, rr = 3 + hsh(40 + k);
            const lx = Math.round(cx + Math.cos(a) * rr), lz = Math.round(cz + Math.sin(a) * rr);
            leaf(lx, cy - 2, lz);
          }
          break;
        }
        case 'MANGROVE': {
          th = 5 + Math.floor(hsh(1) * 3);
          const base = y + 2;
          for (let i = 0; i < th; i++) out.push([x, base + i, z, LOG, false]);
          // racines en échasses
          for (const [ox, oz] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0]]) {
            if (CM.hash3(x + ox, y, z + oz, seed + 27) < 0.25) continue;
            out.push([x + Math.sign(ox), base, z + Math.sign(oz), LOG, false]);
            for (let k = 1; k <= 4; k++) out.push([x + ox, base - k + 1, z + oz, LOG, false]);
          }
          blob(x, base + th, z, 3, -2, 1);
          for (let k = 0; k < 5; k++) {
            const a = hsh(50 + k) * Math.PI * 2;
            const lx = Math.round(x + Math.cos(a) * 3), lz = Math.round(z + Math.sin(a) * 3);
            for (let d = 1; d <= 2; d++) leaf(lx, base + th - 2 - d, lz);
          }
          break;
        }
        case 'CRIMSON':
        case 'WARPED': {
          // champignon géant du Nether : tige, chapeau de verrues, champilampes
          th = 5 + Math.floor(hsh(1) * 6);
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          const R = th > 8 ? 3 : 2;
          for (let dy = -2; dy <= 0; dy++) {
            const rr = dy === 0 ? R - 1 : R;
            for (let dz = -rr; dz <= rr; dz++)
              for (let dx = -rr; dx <= rr; dx++) {
                const edge = Math.abs(dx) === rr || Math.abs(dz) === rr;
                if (dy < 0 && !edge) continue;
                if (Math.abs(dx) === rr && Math.abs(dz) === rr && CM.hash3(x + dx, y + dy, z + dz, seed + 28) < 0.5) continue;
                out.push([x + dx, y + th + dy, z + dz, CM.hash3(x + dx, y + dy, z + dz, seed + 29) < 0.08 ? Bk.SHROOMLIGHT : LEAF, true]);
              }
          }
          out.push([x, y + th, z, LEAF, true]);
          break;
        }
        default: {
          // chêne et bouleau
          const tall = type === 'BIRCH' ? 5 : 4;
          th = (big ? 7 : tall) + Math.floor(hsh(1) * 3);
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          blob(x, y + th, z, big ? 3 : 2, -3, 1);
          if (bees) out.push([x, y + th - 3, z + 1, Bk.BEEHIVE, true]);
        }
      }
      return out;
    }

    findSpawn() {
      if (this.nether) return { x: 0.5, y: 64, z: 0.5 }; // on y arrive par un portail
      for (let rad = 0; rad < 4000; rad += 3) {
        const n = rad === 0 ? 1 : 24;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = Math.round(Math.cos(a) * rad), z = Math.round(Math.sin(a) * rad);
          const info = this.column(x, z);
          const b = CM.blocks[info.topB];
          if ((b.soil || info.topB === CM.B.SNOW) && info.topB !== CM.B.CRIMSON_NYLIUM && info.topB !== CM.B.WARPED_NYLIUM && info.h > SEA + 1 && info.bi !== BIO.MOUNTAINS && info.bi !== BIO.VOLCANIC && !this.treeAt(x, z, info)) return { x: x + 0.5, y: info.h + 1, z: z + 0.5 };
        }
      }
      return { x: 0.5, y: 70, z: 0.5 };
    }

    // Une fois les tronçons chargés : place le point d'apparition sur un sol dégagé
    // (pas sur un feuillage), en cherchant autour si besoin.
    fixSpawn() {
      const sp = this.spawn, x0 = Math.floor(sp.x), z0 = Math.floor(sp.z);
      if (!this.loaded(x0, z0)) return;
      for (let r = 0; r <= 12; r++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const x = x0 + dx, z = z0 + dz;
            if (!this.loaded(x, z)) continue;
            const y = this.groundBelow(x, H - 1, z);
            const g = CM.blocks[this.get(x, y, z)];
            if (y > SEA && (g.soil || g.id === CM.B.SAND || g.id === CM.B.SNOW) && !this.solidAt(x, y + 1, z) && !this.solidAt(x, y + 2, z)) {
              this.spawn = { x: x + 0.5, y: y + 1, z: z + 0.5 };
              return;
            }
          }
    }

    // ------------------------------------------------------ génération ---
    generateChunk(cx, cz) {
      if (this.nether) return this.generateNether(cx, cz);
      const Bk = CM.B;
      const c = new Chunk(cx, cz);
      const blocks = c.blocks, seed = this.seed;
      const x0 = c.x0, z0 = c.z0;
      const infos = new Array(256);

      if (this.type === 'flat') {
        // monde plat : socle en y = 0 comme avant (rien en dessous)
        const fi = (y, i) => ((y - MINY) << 8) | i;
        for (let i = 0; i < 256; i++) {
          blocks[fi(0, i)] = Bk.BEDROCK;
          for (let y = 1; y < SEA + 5; y++) blocks[fi(y, i)] = Bk.STONE;
          for (let y = SEA + 5; y < SEA + 8; y++) blocks[fi(y, i)] = Bk.DIRT;
          blocks[fi(SEA + 8, i)] = Bk.GRASS;
        }
        const e = this.edits.get(ckey(cx, cz));
        if (e) for (const [i, id] of e) blocks[i] = id;
        return c;
      }

      // 1) colonnes : roche, sous-sol, surface, eau (ou glace)
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz;
          const info = this.column(x, z);
          infos[(lz << 4) | lx] = info;
          const deep = 14 + Math.floor(this.nC.noise2(x / 20, z / 20) * 3);
          const h = info.h;
          const subTop = h - info.subDepth;
          for (let y = MINY; y < H; y++) {
            let id = 0;
            if (y === MINY) id = Bk.BEDROCK;
            else if (y <= MINY + 2 && CM.hash3(x, y, z, seed + 11) < 0.55) id = Bk.BEDROCK;
            else if (y < h) {
              if (y >= subTop) id = info.subB === -1 ? (y > SEA - 4 ? this.band(x, y, z) : Bk.STONE) : info.subB;
              else if (info.deepSub && y >= subTop - 3) id = info.deepSub;
              else id = y < deep ? Bk.DEEPSTONE : Bk.STONE;
            } else if (y === h) id = info.topB;
            else if (y <= SEA) id = y === SEA && info.frozen ? Bk.ICE : Bk.WATER;
            blocks[lidx(lx, y, lz)] = id;
          }
        }

      // 2) grottes et poches de roches (bruit 3D sur une grille alignée sur le monde)
      for (let gy = 0; gy < GY; gy++)
        for (let gz = 0; gz < G; gz++)
          for (let gx = 0; gx < G; gx++) {
            const x = x0 + gx * GS, y = MINY + gy * GS, z = z0 + gz * GS;
            const gi = (gy * G + gz) * G + gx;
            gA[gi] = this.nA.noise3(x / 38, y / 22, z / 38);
            gB[gi] = this.nB.noise3(x / 38 + 70, y / 22, z / 38);
            gC[gi] = this.nC.noise3(x / 55, y / 28, z / 55);
            gD[gi] = this.nD.noise3(x / 24, y / 16, z / 24);
            gE[gi] = this.nE.noise3(x / 20 + 40, y / 14, z / 20);
          }
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const info = infos[(lz << 4) | lx];
          const h = info.h;
          let maxY = h;
          if (h <= SEA + 2) maxY = h - 6;
          else if (this.treeAt(x0 + lx, z0 + lz, info)) maxY = h - 3;
          for (let y = MINY + 3; y < h; y++) {
            const i = lidx(lx, y, lz);
            const cur = blocks[i];
            if (cur !== Bk.STONE && cur !== Bk.DEEPSTONE) continue;
            const d = tri(gD, lx, y, lz), e = tri(gE, lx, y, lz);
            if (cur === Bk.DEEPSTONE) {
              if (e > 0.52) blocks[i] = Bk.TUFF;
              continue;
            }
            if (d > 0.52) blocks[i] = Bk.GRANITE;
            else if (d < -0.52) blocks[i] = y < 44 && d < -0.64 ? Bk.DRIPSTONE_BLOCK : Bk.DIORITE;
            else if (e > 0.55) blocks[i] = Bk.ANDESITE;
            else if (e < -0.6 && y < 60) blocks[i] = Bk.GRAVEL;
          }
          for (let y = MINY + 3; y <= maxY; y++) {
            const a = tri(gA, lx, y, lz);
            const b = tri(gB, lx, y, lz);
            let carve = a * a + b * b < 0.011;
            // grandes cavernes en profondeur (plafonnées sous y = −6 pour ne pas tout creuser)
            if (!carve && y < 34) carve = tri(gC, lx, y, lz) > Math.max(0.42, 0.58 - (34 - y) * 0.004);
            if (carve) {
              const i = lidx(lx, y, lz);
              // tout au fond, les cavernes baignent dans des lacs de lave
              if (blocks[i] !== Bk.BEDROCK) blocks[i] = y <= MINY + 5 ? Bk.BEDROCK : y <= MINY + 9 && this.lavaLakes ? Bk.LAVA : 0;
            }
          }
        }

      // 3) minerais : filons nés dans ce tronçon et ses voisins, découpés au tronçon
      for (let ocz = cz - 1; ocz <= cz + 1; ocz++)
        for (let ocx = cx - 1; ocx <= cx + 1; ocx++) {
          let obi = -1;
          VEINS.forEach(([name, per, ymin, ymax, size, onlyBiome], t) => {
            if (onlyBiome !== undefined) {
              if (obi < 0) obi = this.column(ocx * 16 + 8, ocz * 16 + 8).bi;
              if (obi !== onlyBiome) return;
            }
            const id = Bk[name];
            const rand = CM.rng((CM.hash3(ocx, t + 50, ocz, seed) * 4294967296) >>> 0);
            const count = Math.floor(per + rand());
            for (let k = 0; k < count; k++) {
              let x = ocx * 16 + Math.floor(rand() * 16);
              let y = ymin + Math.floor(rand() * (ymax - ymin));
              let z = ocz * 16 + Math.floor(rand() * 16);
              for (let s = 0; s < size; s++) {
                const lx = x - x0, lz = z - z0;
                if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && y > MINY && y < H) {
                  const i = lidx(lx, y, lz);
                  const cur = blocks[i];
                  if (ROCK[cur]) blocks[i] = (cur === Bk.DEEPSTONE || cur === Bk.TUFF) && DEEP_ORE[id] ? DEEP_ORE[id] : id;
                }
                const r = rand();
                if (r < 0.33) x += rand() < 0.5 ? -1 : 1;
                else if (r < 0.66) z += rand() < 0.5 ? -1 : 1;
                else y += rand() < 0.5 ? -1 : 1;
              }
            }
          });
        }

      // 4) plantes (colonnes de ce tronçon sans arbre), coraux, neige
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const info = infos[(lz << 4) | lx];
          const h = info.h;
          const x = x0 + lx, z = z0 + lz;
          if (h + 12 >= H) continue;
          // récifs de corail dans les océans chauds
          if (info.bi === BIO.WARM_OCEAN && h < SEA - 2 && blocks[lidx(lx, h, lz)] === info.topB) {
            const p = CM.hash3(x, 15, z, seed);
            if (p < 0.2) {
              const k = Math.floor(CM.hash3(x, 16, z, seed) * 5);
              const tall = 1 + Math.floor(CM.hash3(x, 17, z, seed) * 3);
              const coral = Bk.TUBE_CORAL_BLOCK + k;
              let y = h + 1;
              for (let t = 0; t < tall && y < SEA - 1; t++, y++) blocks[lidx(lx, y, lz)] = coral;
              if (y < SEA - 1 && CM.hash3(x, 18, z, seed) < 0.7) blocks[lidx(lx, y, lz)] = Bk.TUBE_CORAL_FAN + k;
            } else if (p < 0.3) blocks[lidx(lx, h + 1, lz)] = Bk.TUBE_CORAL_FAN + Math.floor(CM.hash3(x, 16, z, seed) * 5);
            continue;
          }
          if (h <= SEA || CM.isFluid(info.topB)) continue;
          if (blocks[lidx(lx, h, lz)] !== info.topB || blocks[lidx(lx, h + 1, lz)] !== 0) continue;
          if (this.treeAt(x, z, info)) continue;
          // dans un village : pas de cactus ni de grandes plantes au milieu des maisons
          const inVil = this.hasVillages && !!this.villageNear(x, z, 3);
          // canne à sucre au bord de l'eau
          if (!this.legacy && !inVil && h <= SEA + 1 && (info.topB === Bk.SAND || CM.blocks[info.topB].soil) && lx > 0 && lx < 15 && lz > 0 && lz < 15) {
            const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => blocks[lidx(lx + dx, SEA, lz + dz)] === Bk.WATER);
            if (nearWater && CM.hash3(x, 19, z, seed) < 0.12) {
              const hh = 1 + Math.floor(CM.hash3(x, 20, z, seed) * 3);
              for (let k = 1; k <= hh; k++) blocks[lidx(lx, h + k, lz)] = Bk.SUGAR_CANE;
              continue;
            }
          }
          const table = this.plants[info.bi];
          let placed = false;
          if (table) {
            let p = CM.hash3(x, 13, z, seed);
            for (const [name, prob, n] of table) {
              if (p >= prob) {
                p -= prob;
                continue;
              }
              const id = Bk[name];
              if (inVil && (id === Bk.CACTUS || n)) break;
              if (id === Bk.CACTUS) {
                if (info.topB !== Bk.SAND && info.topB !== Bk.RED_SAND) break;
                const hh = 1 + Math.floor(CM.hash3(x, 14, z, seed) * (n || 3));
                for (let k = 1; k <= hh; k++) blocks[lidx(lx, h + k, lz)] = id;
              } else if (n) {
                const hh = 2 + Math.floor(CM.hash3(x, 14, z, seed) * (n - 1));
                for (let k = 1; k <= hh; k++) blocks[lidx(lx, h + k, lz)] = id;
              } else blocks[lidx(lx, h + 1, lz)] = id;
              placed = true;
              break;
            }
          }
          // forêts fongiques : racines et pousses
          if (!placed && info.bi === BIO.FUNGUS) {
            const p = CM.hash3(x, 21, z, seed);
            if (p < 0.12) blocks[lidx(lx, h + 1, lz)] = info.variant ? Bk.CRIMSON_ROOTS : p < 0.06 ? Bk.WARPED_ROOTS : Bk.NETHER_SPROUTS;
          }
          // couche de neige dans les biomes froids
          if (!placed && !this.legacy && COLD_BIOMES.has(info.bi) && info.topB !== Bk.SNOW && CM.hash3(x, 22, z, seed) < 0.45) blocks[lidx(lx, h + 1, lz)] = Bk.SNOW_LAYER;
        }

      // 5) arbres dont la couronne touche ce tronçon
      for (let z = z0 - 6; z < z0 + 22; z++)
        for (let x = x0 - 6; x < x0 + 22; x++) {
          if (CM.hash3(x, 7, z, seed) >= MAX_TREE_P) continue;
          const lx = x - x0, lz = z - z0;
          const inside = lx >= 0 && lx < 16 && lz >= 0 && lz < 16;
          const info = inside ? infos[(lz << 4) | lx] : this.column(x, z);
          const t = this.treeAt(x, z, info);
          if (t) this.placeTree(c, t.type, t.big, x, info.h + 1, z, t.bees);
        }

      // 6) champignons rebond, sculk dans les profondeurs
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const h = infos[(lz << 4) | lx].h;
          const x = x0 + lx, z = z0 + lz;
          // zone « sombre » (sculk) en profondeur, par régions
          const dark = this.nD.noise2(x / 180 + 11, z / 180 - 7) > 0.2;
          for (let y = MINY + 4; y < h - 6; y++) {
            const i = lidx(lx, y, lz);
            if (blocks[i] !== 0) continue;
            const below = blocks[i - 256];
            if (!ROCK[below]) continue;
            // sol de magma au fond du monde
            if (y < MINY + 12 && CM.hash3(x, y, z, seed + 13) < 0.3) {
              blocks[i - 256] = Bk.MAGMA;
              continue;
            }
            if (y < 13 && (y >= 0 || dark) && (below === Bk.DEEPSTONE || below === Bk.TUFF) && tri(gC, lx, y, lz) > 0.25 && CM.hash3(x, y, z, seed + 12) < 0.6) {
              blocks[i - 256] = Bk.SCULK;
              continue;
            }
            if (CM.hash3(x, y, z, seed + 9) < 0.012) {
              blocks[i] = Bk.MUSHROOM;
              if (CM.hash3(x, y, z, seed + 10) < 0.3 && blocks[i + 256] === 0) blocks[i + 256] = Bk.MUSHROOM;
            }
          }
        }

      // 7) géodes d'améthyste, îles célestes et ruines
      this.geodesFor(c);
      this.islandsFor(c);
      this.ruinsFor(c);
      this.villagesFor(c);

      // 8) modifications du joueur
      const e = this.edits.get(ckey(cx, cz));
      if (e) for (const [i, id] of e) blocks[i] = id;
      return c;
    }

    // ---------------------------------------------------------- Nether ----
    // Colonne du Nether : biome, hauteur moyenne du sol et du plafond des cavernes.
    netherColumn(x, z) {
      const X = x + this.ox, Z = z + this.oz;
      const t = this.nE.noise2(X / 170, Z / 170), u = this.nF.noise2(X / 150 + 50, Z / 150 - 30);
      let bi = BIO.NETHER_WASTES;
      if (t > 0.28) bi = BIO.CRIMSON_FOREST;
      else if (t < -0.28) bi = BIO.WARPED_FOREST;
      else if (u > 0.3) bi = BIO.SOUL_VALLEY;
      else if (u < -0.32) bi = BIO.BASALT_DELTAS;
      const h = 31 + Math.round(this.nC.fbm2(X / 70, Z / 70, 3) * 18);
      const ceil = 80 + Math.round(this.nD.noise2(X / 45, Z / 45) * 7);
      return { h, ceil, bi, nether: true };
    }
    // Tronçon du Nether : roche du Nether entre un sol et un plafond de bedrock,
    // grandes cavernes, océan de lave (y ≤ 31), forêts de champignons, vallées des âmes,
    // deltas de basalte, pierre lumineuse au plafond, minerais et forteresses.
    generateNether(cx, cz) {
      const Bk = CM.B;
      const c = new Chunk(cx, cz);
      const blocks = c.blocks, seed = this.seed;
      const x0 = c.x0, z0 = c.z0;
      const cols = new Array(256);
      const NL = 31; // niveau de l'océan de lave
      for (let gy = 0; gy < GY; gy++)
        for (let gz = 0; gz < G; gz++)
          for (let gx = 0; gx < G; gx++) {
            const x = x0 + gx * GS + this.ox, y = MINY + gy * GS, z = z0 + gz * GS + this.oz;
            const gi = (gy * G + gz) * G + gx;
            gA[gi] = this.nA.noise3(x / 44, y / 26, z / 44);
            gB[gi] = this.nB.noise3(x / 18, y / 12, z / 18);
          }
      // 1) roche, cavernes, lave
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz;
          const col = this.netherColumn(x, z);
          cols[(lz << 4) | lx] = col;
          for (let y = MINY; y < H; y++) {
            let id;
            if (y <= 0 || y >= H - 1) id = Bk.BEDROCK;
            else if (y <= 3 && CM.hash3(x, y, z, seed + 61) < 0.6 - y * 0.12) id = Bk.BEDROCK;
            else if (y >= H - 5 && CM.hash3(x, y, z, seed + 62) < 0.25 + (y - (H - 5)) * 0.2) id = Bk.BEDROCK;
            else {
              const d = tri(gA, lx, y, lz) + 0.5 * tri(gB, lx, y, lz);
              const dens = d * 0.9 + Math.max(0, (col.h - y) / 4) + Math.max(0, (y - col.ceil) / 4);
              id = dens > 0.55 || y >= H - 5 ? Bk.NETHERRACK : y <= NL ? Bk.LAVA : 0;
            }
            blocks[lidx(lx, y, lz)] = id;
          }
        }
      // 2) sols, plafonds, plantes selon le biome
      const inC = (lx, lz) => lx >= 0 && lx < 16 && lz >= 0 && lz < 16;
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz;
          const bi = cols[(lz << 4) | lx].bi;
          const glow = CM.hash3(x, 71, z, seed) < 0.007;
          for (let y = H - 6; y > 1; y--) {
            const i = lidx(lx, y, lz);
            if (blocks[i] !== Bk.NETHERRACK) continue;
            const above = blocks[i + 256], below = blocks[i - 256];
            const h = CM.hash3(x, y, z, seed + 63);
            if (above === 0) {
              // sol d'une caverne
              if (bi === BIO.CRIMSON_FOREST || bi === BIO.WARPED_FOREST) {
                const crim = bi === BIO.CRIMSON_FOREST;
                blocks[i] = crim ? Bk.CRIMSON_NYLIUM : Bk.WARPED_NYLIUM;
                if (h < 0.14 && y + 1 < H - 5) blocks[i + 256] = crim ? (h < 0.1 ? Bk.CRIMSON_ROOTS : Bk.NETHER_SPROUTS) : h < 0.07 ? Bk.WARPED_ROOTS : Bk.NETHER_SPROUTS;
              } else if (bi === BIO.SOUL_VALLEY) {
                blocks[i] = h < 0.55 ? Bk.SOUL_SAND : Bk.SOUL_SOIL;
                if (blocks[i - 256] === Bk.NETHERRACK) blocks[i - 256] = Bk.SOUL_SOIL;
              } else if (bi === BIO.BASALT_DELTAS) {
                blocks[i] = h < 0.6 ? Bk.BASALT : Bk.BLACKSTONE;
                if (blocks[i - 256] === Bk.NETHERRACK) blocks[i - 256] = Bk.BLACKSTONE;
                // petites mares de lave entre les coulées de basalte
                if (h > 0.93 && lx > 0 && lx < 15 && lz > 0 && lz < 15 && y > NL) blocks[i] = Bk.LAVA;
              } else if (y <= NL + 3 && h < 0.35) blocks[i] = h < 0.2 ? Bk.GRAVEL : Bk.SOUL_SAND;
            } else if (CM.isLava(above)) {
              if (y >= NL - 4 && h < 0.2) blocks[i] = Bk.MAGMA;
            } else if (below === 0 && glow) {
              // grappes de pierre lumineuse sous le plafond
              const len = 1 + Math.floor(CM.hash3(x, y, z, seed + 64) * 4);
              for (let k = 1; k <= len && blocks[i - k * 256] === 0; k++) blocks[i - k * 256] = Bk.GLOWSTONE;
              for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                if (!inC(lx + dx, lz + dz) || CM.hash3(x + dx, y, z + dz, seed + 65) > 0.55) continue;
                const j = lidx(lx + dx, y - 1, lz + dz);
                if (blocks[j] === 0) blocks[j] = Bk.GLOWSTONE;
              }
            }
          }
        }
      // 3) minerais et poches (filons découpés au tronçon)
      const rand = CM.rng((CM.hash3(cx, 66, cz, seed) * 4294967296) >>> 0);
      const vein = (id, per, ymin, ymax, size, over) => {
        const n = Math.floor(per + rand());
        for (let k = 0; k < n; k++) {
          let lx = Math.floor(rand() * 16), y = ymin + Math.floor(rand() * (ymax - ymin)), lz = Math.floor(rand() * 16);
          for (let s = 0; s < size; s++) {
            if (inC(lx, lz) && y > 0 && y < H - 1) {
              const i = lidx(lx, y, lz);
              if (over.includes(blocks[i])) blocks[i] = id;
            }
            const r = rand();
            if (r < 0.33) lx += rand() < 0.5 ? -1 : 1;
            else if (r < 0.66) lz += rand() < 0.5 ? -1 : 1;
            else y += rand() < 0.5 ? -1 : 1;
          }
        }
      };
      const RACK = [Bk.NETHERRACK];
      vein(Bk.NETHER_QUARTZ_ORE, 12, 8, 88, 7, RACK);
      vein(Bk.NETHER_GOLD_ORE, 7, 8, 88, 5, RACK);
      vein(Bk.MAGMA, 2.5, 24, 38, 10, RACK);
      vein(Bk.GRAVEL, 1.5, 6, 70, 12, RACK);
      vein(Bk.SOUL_SAND, 1, 20, 50, 10, RACK);
      vein(Bk.ANCIENT_DEBRIS, 0.6, 8, 22, 2, [Bk.NETHERRACK, Bk.BASALT, Bk.BLACKSTONE]);
      vein(Bk.GILDED_BLACKSTONE, 0.5, 20, 80, 3, [Bk.BLACKSTONE]);
      // 4) champignons géants, piliers de basalte
      for (let lz = 2; lz < 14; lz++)
        for (let lx = 2; lx < 14; lx++) {
          const x = x0 + lx, z = z0 + lz;
          const bi = cols[(lz << 4) | lx].bi;
          const forest = bi === BIO.CRIMSON_FOREST || bi === BIO.WARPED_FOREST;
          const pillar = (bi === BIO.SOUL_VALLEY && CM.hash3(x, 72, z, seed) < 0.006) || (bi === BIO.BASALT_DELTAS && CM.hash3(x, 72, z, seed) < 0.02);
          if (!pillar && !(forest && CM.hash3(x, 73, z, seed) < 0.045)) continue;
          const nyl = bi === BIO.CRIMSON_FOREST ? Bk.CRIMSON_NYLIUM : Bk.WARPED_NYLIUM;
          for (let y = NL + 1; y < H - 12; y++) {
            const b = blocks[lidx(lx, y, lz)];
            if (pillar) {
              if ((b === Bk.SOUL_SAND || b === Bk.SOUL_SOIL || b === Bk.BASALT || b === Bk.BLACKSTONE) && blocks[lidx(lx, y + 1, lz)] === 0) {
                for (let yy = y + 1; yy < H - 5 && blocks[lidx(lx, yy, lz)] === 0; yy++) blocks[lidx(lx, yy, lz)] = Bk.BASALT;
                break;
              }
            } else if (b === nyl) {
              let free = true;
              for (let k = 1; k <= 12 && free; k++) if (blocks[lidx(lx, y + k, lz)] !== 0 && !CM.blocks[blocks[lidx(lx, y + k, lz)]].plant) free = false;
              if (free) {
                this.placeTree(c, bi === BIO.CRIMSON_FOREST ? 'CRIMSON' : 'WARPED', false, x, y + 1, z, false);
                break;
              }
            }
          }
        }
      // 5) forteresses
      this.fortressesFor(c);
      // 6) modifications des joueurs
      const e = this.edits.get(ckey(cx, cz));
      if (e) for (const [i, id] of e) blocks[i] = id;
      return c;
    }
    // Une forteresse par région de 160 blocs (une fois sur deux) : donjon et ponts de briques.
    fortressAt(rx, rz) {
      const rand = CM.rng((CM.hash3(rx, 181, rz, this.seed) * 4294967296) >>> 0);
      if (rand() > 0.55) return null;
      const x = rx * FORT_REGION + 56 + Math.floor(rand() * (FORT_REGION - 112));
      const z = rz * FORT_REGION + 56 + Math.floor(rand() * (FORT_REGION - 112));
      const y = 46 + Math.floor(rand() * 14);
      const arms = [0, 1, 2, 3].filter(() => rand() < 0.75).map((d) => ({ d, len: 22 + Math.floor(rand() * 26) }));
      return { x, y, z, arms, seed: Math.floor(rand() * 1e9) };
    }
    fortressesFor(c) {
      const Bk = CM.B;
      const R = 50;
      const r0x = Math.floor((c.x0 - R) / FORT_REGION), r1x = Math.floor((c.x0 + 15 + R) / FORT_REGION);
      const r0z = Math.floor((c.z0 - R) / FORT_REGION), r1z = Math.floor((c.z0 + 15 + R) / FORT_REGION);
      for (let rz = r0z; rz <= r1z; rz++)
        for (let rx = r0x; rx <= r1x; rx++) {
          const f = this.fortressAt(rx, rz);
          if (!f || f.x + R < c.x0 || f.x - R > c.x0 + 15 || f.z + R < c.z0 || f.z - R > c.z0 + 15) continue;
          const brick = (X, Y, Z) => {
            const h = CM.hash3(X, Y, Z, f.seed);
            return h < 0.1 ? Bk.CRACKED_NETHER_BRICKS : h < 0.13 ? Bk.CHISELED_NETHER_BRICKS : Bk.NETHER_BRICKS;
          };
          const put = (X, Y, Z, id) => {
            const lx = X - c.x0, lz = Z - c.z0;
            if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || Y <= 0 || Y >= H - 1) return;
            c.blocks[lidx(lx, Y, lz)] = id;
          };
          // piliers jusqu'au sol (ou dans la lave)
          const pillar = (X, Z, top) => {
            const lx = X - c.x0, lz = Z - c.z0;
            if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return;
            for (let y = top; y > 1; y--) {
              const i = lidx(lx, y, lz), cur = c.blocks[i];
              if (cur !== 0 && !CM.isLava(cur) && !CM.blocks[cur].plant) break;
              c.blocks[i] = brick(X, y, Z);
            }
          };
          const y0 = f.y;
          // ponts : tablier de 5 de large, parapets, passage dégagé de 4 de haut
          for (const { d, len } of f.arms) {
            const ax = [1, -1, 0, 0][d], az = [0, 0, 1, -1][d];
            for (let s = 6; s <= 6 + len; s++)
              for (let w = -2; w <= 2; w++) {
                const X = f.x + ax * s + (az ? w : 0), Z = f.z + az * s + (ax ? w : 0);
                put(X, y0, Z, brick(X, y0, Z));
                const edge = Math.abs(w) === 2;
                for (let dy = 1; dy <= 4; dy++) put(X, y0 + dy, Z, edge && dy === 1 ? brick(X, y0 + 1, Z) : 0);
                if (s % 8 === 0 && Math.abs(w) <= 1) pillar(X, Z, y0 - 1);
              }
          }
          // donjon : 13 × 13, 7 de haut, portes vers les ponts, coffre au centre
          for (let dz = -6; dz <= 6; dz++)
            for (let dx = -6; dx <= 6; dx++) {
              const X = f.x + dx, Z = f.z + dz;
              const wall = Math.abs(dx) === 6 || Math.abs(dz) === 6;
              const door = wall && ((Math.abs(dz) <= 1 && f.arms.some((a) => a.d === (dx > 0 ? 0 : 1))) || (Math.abs(dx) <= 1 && f.arms.some((a) => a.d === (dz > 0 ? 2 : 3))));
              put(X, y0, Z, brick(X, y0, Z));
              for (let dy = 1; dy <= 6; dy++) {
                const window = wall && dy === 3 && (Math.abs(dx) === 3 || Math.abs(dz) === 3);
                put(X, y0 + dy, Z, wall && !(door && dy <= 3) && !window ? brick(X, y0 + dy, Z) : 0);
              }
              put(X, y0 + 7, Z, dx === 0 && dz === 0 ? Bk.GLOWSTONE : brick(X, y0 + 7, Z));
              if ((Math.abs(dx) === 6 && Math.abs(dz) === 6) || (dx % 4 === 0 && dz % 4 === 0 && wall)) pillar(X, Z, y0 - 1);
              if (Math.abs(dx) === 4 && Math.abs(dz) === 4) put(X, y0 + 1, Z, Bk.SOUL_LANTERN);
            }
          put(f.x, y0 + 1, f.z, Bk.CHEST);
          put(f.x + 1, y0 + 1, f.z, Bk.RED_NETHER_BRICKS);
          put(f.x - 1, y0 + 1, f.z, Bk.RED_NETHER_BRICKS);
        }
    }

    // Arbre découpé au tronçon c (seules les cases de c sont écrites).
    placeTree(c, type, big, x, y, z, bees) {
      if (x + 6 < c.x0 || x - 6 > c.x0 + 15 || z + 6 < c.z0 || z - 6 > c.z0 + 15) return;
      for (const [X, Y, Z, id, onlyAir] of this.treeShape(type, big, x, y, z, bees)) {
        const lx = X - c.x0, lz = Z - c.z0;
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || Y < MINY || Y >= H) continue;
        const i = lidx(lx, Y, lz);
        if (onlyAir) {
          const cur = c.blocks[i];
          if (cur !== 0 && !CM.blocks[cur].plant && cur !== CM.B.SNOW_LAYER) continue;
        }
        c.blocks[i] = id;
      }
    }

    // ---------------------------------------------------------- géodes ----
    // deep : géodes des couches négatives (tirage à part, les anciennes ne bougent pas)
    geodeAt(rx, rz, deep) {
      const rand = CM.rng((CM.hash3(rx, deep ? 172 : 171, rz, this.seed) * 4294967296) >>> 0);
      if (rand() > (deep ? 0.45 : 0.35)) return null;
      return {
        x: rx * GEODE_REGION + 8 + Math.floor(rand() * (GEODE_REGION - 16)),
        z: rz * GEODE_REGION + 8 + Math.floor(rand() * (GEODE_REGION - 16)),
        y: deep ? MINY + 8 + Math.floor(rand() * 50) : 7 + Math.floor(rand() * 20),
        r: 3.6 + rand() * 1.6,
        s: Math.floor(rand() * 1e9),
      };
    }
    geodesFor(c) {
      const Bk = CM.B;
      const r0x = Math.floor((c.x0 - 6) / GEODE_REGION), r1x = Math.floor((c.x0 + 21) / GEODE_REGION);
      const r0z = Math.floor((c.z0 - 6) / GEODE_REGION), r1z = Math.floor((c.z0 + 21) / GEODE_REGION);
      for (const deep of [false, true])
      for (let rz = r0z; rz <= r1z; rz++)
        for (let rx = r0x; rx <= r1x; rx++) {
          const g = this.geodeAt(rx, rz, deep);
          if (!g) continue;
          const R = Math.ceil(g.r);
          for (let dz = -R; dz <= R; dz++)
            for (let dx = -R; dx <= R; dx++) {
              const X = g.x + dx, Z = g.z + dz;
              const lx = X - c.x0, lz = Z - c.z0;
              if (lx < 0 || lx > 15 || lz < 0 || lz > 15) continue;
              for (let dy = -R; dy <= R; dy++) {
                const Y = g.y + dy;
                if (Y <= MINY + 2) continue;
                const d = Math.hypot(dx, dy * 1.15, dz) + (CM.hash3(X, Y, Z, g.s) - 0.5) * 0.5;
                if (d > g.r) continue;
                const i = lidx(lx, Y, lz);
                if (c.blocks[i] === Bk.BEDROCK) continue;
                let id;
                if (d > g.r - 0.8) id = Bk.SMOOTH_BASALT;
                else if (d > g.r - 1.6) id = Bk.CALCITE;
                else if (d > g.r - 2.4) id = CM.hash3(X, Y, Z, g.s + 1) < 0.1 ? Bk.BUDDING_AMETHYST : Bk.AMETHYST_BLOCK;
                else id = 0;
                c.blocks[i] = id;
              }
            }
        }
    }

    // ---------------------------------------------------------- ruines ----
    ruinAt(rx, rz) {
      const rand = CM.rng((CM.hash3(rx, 131, rz, this.seed) * 4294967296) >>> 0);
      if (rand() > 0.45) return null;
      const x = rx * RUIN_REGION + 12 + Math.floor(rand() * (RUIN_REGION - 24));
      const z = rz * RUIN_REGION + 12 + Math.floor(rand() * (RUIN_REGION - 24));
      if (this.hasVillages && this.villageNear(x, z, 10)) return null;
      const info = this.column(x, z);
      const ocean = (info.bi === BIO.OCEAN || info.bi === BIO.WARM_OCEAN) && info.h < SEA - 4;
      if (!ocean && (info.h <= SEA + 1 || info.bi === BIO.MOUNTAINS || info.bi === BIO.SWAMP || info.bi === BIO.MANGROVE || info.flat)) return null;
      return { x, z, y: info.h, bi: info.bi, ocean, seed: Math.floor(rand() * 1e9) };
    }
    ruinsFor(c) {
      const Bk = CM.B;
      const r0x = Math.floor((c.x0 - 4) / RUIN_REGION), r1x = Math.floor((c.x0 + 19) / RUIN_REGION);
      const r0z = Math.floor((c.z0 - 4) / RUIN_REGION), r1z = Math.floor((c.z0 + 19) / RUIN_REGION);
      for (let rz = r0z; rz <= r1z; rz++)
        for (let rx = r0x; rx <= r1x; rx++) {
          const ru = this.ruinAt(rx, rz);
          if (!ru || ru.x + 3 < c.x0 || ru.x - 3 > c.x0 + 15 || ru.z + 3 < c.z0 || ru.z - 3 > c.z0 + 15) continue;
          const sandy = ru.bi === BIO.DESERT || ru.bi === BIO.BADLANDS;
          const mossy = ru.bi === BIO.JUNGLE || ru.bi === BIO.FOREST || ru.bi === BIO.CRYSTAL || ru.bi === BIO.BIRCH || ru.bi === BIO.DARK_FOREST || ru.bi === BIO.BAMBOO;
          const dark = ru.bi === BIO.VOLCANIC || ru.bi === BIO.FUNGUS;
          let floorSet, wallSet, fill = 0, corner = null;
          if (ru.ocean) {
            floorSet = [Bk.PRISMARINE_BRICKS, Bk.PRISMARINE, Bk.DARK_PRISMARINE];
            wallSet = [Bk.PRISMARINE_BRICKS, Bk.PRISMARINE, Bk.PRISMARINE_BRICKS];
            fill = Bk.WATER;
            corner = Bk.SEA_LANTERN;
          } else if (sandy) {
            floorSet = [Bk.SANDSTONE, Bk.SANDSTONE, Bk.CUT_SANDSTONE];
            wallSet = [Bk.SANDSTONE, Bk.CARVED_SANDSTONE, Bk.CUT_SANDSTONE];
          } else if (dark) {
            floorSet = [Bk.POLISHED_BLACKSTONE_BRICKS, Bk.BLACKSTONE, Bk.CRACKED_POLISHED_BLACKSTONE_BRICKS];
            wallSet = [Bk.POLISHED_BLACKSTONE_BRICKS, Bk.CHISELED_POLISHED_BLACKSTONE, Bk.GILDED_BLACKSTONE];
          } else {
            floorSet = [Bk.STONEBRICK, Bk.COBBLE, mossy ? Bk.MOSSY_STONEBRICK : Bk.CRACKED_STONEBRICK];
            wallSet = [Bk.STONEBRICK, mossy ? Bk.MOSSY_STONEBRICK : Bk.COBBLE, mossy ? Bk.MOSSY_COBBLE : Bk.CRACKED_STONEBRICK];
          }
          const pick = (set, X, Y, Z) => set[Math.floor(CM.hash3(X, Y, Z, ru.seed) * set.length)];
          const y0 = ru.y;
          for (let dz = -3; dz <= 3; dz++)
            for (let dx = -3; dx <= 3; dx++) {
              const X = ru.x + dx, Z = ru.z + dz;
              const lx = X - c.x0, lz = Z - c.z0;
              if (lx < 0 || lx > 15 || lz < 0 || lz > 15) continue;
              // fondations
              for (let y = y0 - 1; y > y0 - 7 && y > MINY; y--) {
                const i = lidx(lx, y, lz);
                const cur = c.blocks[i];
                if (cur !== 0 && cur !== Bk.WATER && !CM.blocks[cur].plant) break;
                c.blocks[i] = ru.ocean ? Bk.PRISMARINE : Bk.COBBLE;
              }
              c.blocks[lidx(lx, y0, lz)] = pick(floorSet, X, y0, Z);
              for (let y = y0 + 1; y <= y0 + 5; y++) c.blocks[lidx(lx, y, lz)] = y <= SEA ? fill : 0;
              const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
              const isCorner = Math.abs(dx) === 3 && Math.abs(dz) === 3;
              if (edge) {
                let hgt = isCorner ? 4 : Math.floor(CM.hash3(X, 1, Z, ru.seed) * 4);
                if (dx === 0 && dz === -3) hgt = 0; // entrée
                for (let y = 1; y <= hgt; y++) c.blocks[lidx(lx, y0 + y, lz)] = isCorner && corner && y === hgt ? corner : pick(wallSet, X, y0 + y, Z);
              }
              if (ru.ocean && dx === 1 && dz === 1 && CM.hash3(X, 2, Z, ru.seed) < 0.5) c.blocks[lidx(lx, y0 + 1, lz)] = Bk.WET_SPONGE;
              if (dx === 0 && dz === 0) c.blocks[lidx(lx, y0 + 1, lz)] = Bk.CHEST;
            }
        }
    }

    // ------------------------------------------------------- villages --
    villageAt(rx, rz) {
      if (!this.hasVillages) return null;
      const key = rx + ',' + rz;
      let v = this.villageCache.get(key);
      if (v === undefined) {
        v = this.planVillage(rx, rz);
        this.villageCache.set(key, v);
      }
      return v;
    }
    // Village dont la zone (agrandie de pad) contient (x, z).
    villageNear(x, z, pad) {
      if (!this.hasVillages) return null;
      const v = this.villageAt(Math.floor(x / VILLAGE_REGION), Math.floor(z / VILLAGE_REGION));
      return v && Math.abs(x - v.x) <= v.r + pad && Math.abs(z - v.z) <= v.r + pad ? v : null;
    }
    // Plan d'un village (puits, routes, bâtiments, lampadaires), déterministe pour la graine.
    planVillage(rx, rz) {
      const R = VILLAGE_REGION;
      const rand = CM.rng((CM.hash3(rx, 977, rz, this.seed) * 4294967296) >>> 0);
      if (rand() > 0.85) return null;
      // plusieurs essais dans la région : biome adapté, terrain assez plat et sec
      let cx = 0, cz = 0, info = null;
      for (let t = 0; t < 5 && !info; t++) {
        cx = rx * R + 60 + Math.floor(rand() * (R - 120));
        cz = rz * R + 60 + Math.floor(rand() * (R - 120));
        const ci = this.column(cx, cz);
        if (!VILLAGE_BIOMES.has(ci.bi) || ci.h <= SEA + 1 || ci.h > H - 24) continue;
        let lo = ci.h, hi = ci.h, wet = 0;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, d = k % 2 ? 14 : 28;
          const h = this.column(cx + Math.round(Math.cos(a) * d), cz + Math.round(Math.sin(a) * d)).h;
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
          if (h <= SEA) wet++;
        }
        if (hi - lo <= 12 && wet <= 4) info = ci;
      }
      if (!info) return null;
      const v = { x: cx, z: cz, y: info.h, bi: info.bi, st: villageStyle(info.bi), seed: Math.floor(rand() * 1e9), roads: [], builds: [], lamps: [], spots: [], chests: [], r: 8, pop: 2 };
      const taken = [];
      const free = (x0, z0, x1, z1) => !taken.some((t) => x0 <= t[2] && x1 >= t[0] && z0 <= t[3] && z1 >= t[1]);
      // place centrale et puits
      v.roads.push({ x0: cx - 3, z0: cz - 3, x1: cx + 3, z1: cz + 3 });
      v.builds.push({ type: 'well', x0: cx - 1, z0: cz - 1, x1: cx + 1, z1: cz + 1, y: info.h });
      taken.push([cx - 3, cz - 3, cx + 3, cz + 3]);
      for (const [px, pz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) v.spots.push([cx + px, info.h + 1, cz + pz]);
      const once = {};
      const pickKind = () => {
        const k = rand();
        if (k < 0.1 && !once.smith) return (once.smith = 'smith');
        if (k < 0.18 && !once.library) return (once.library = 'library');
        if (k < 0.4) return 'farm';
        if (k < 0.58) return 'bighouse';
        return 'house';
      };
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of dirs) {
        if (rand() < 0.12) continue;
        const len = 16 + Math.floor(rand() * 18);
        const ax = cx + dx * 4, az = cz + dz * 4, bx = cx + dx * len, bz = cz + dz * len;
        const road = { x0: Math.min(ax, bx) - (dz ? 1 : 0), x1: Math.max(ax, bx) + (dz ? 1 : 0), z0: Math.min(az, bz) - (dx ? 1 : 0), z1: Math.max(az, bz) + (dx ? 1 : 0) };
        v.roads.push(road);
        taken.push([road.x0, road.z0, road.x1, road.z1]);
        for (let t = 7; t + 2 <= len; t += 7 + Math.floor(rand() * 3)) {
          for (const side of [-1, 1]) {
            if (rand() < 0.25) continue;
            const kind = pickKind();
            const K = VILLAGE_KINDS[kind];
            // repère local : u le long de la route, v en s'éloignant de la route (v = 0 : façade)
            const b = { type: kind, w: K.w, d: K.d, hgt: K.h, door: Math.floor(K.w / 2) };
            if (dx) {
              b.ux = 1; b.uz = 0; b.vx = 0; b.vz = side;
              b.ox = cx + dx * t - Math.floor(K.w / 2); b.oz = cz + side * 3;
            } else {
              b.ux = 0; b.uz = 1; b.vx = side; b.vz = 0;
              b.ox = cx + side * 3; b.oz = cz + dz * t - Math.floor(K.w / 2);
            }
            const P = (u, w) => [b.ox + u * b.ux + w * b.vx, b.oz + u * b.uz + w * b.vz];
            const c1 = P(-1, -1), c2 = P(K.w, K.d);
            b.x0 = Math.min(c1[0], c2[0]); b.x1 = Math.max(c1[0], c2[0]);
            b.z0 = Math.min(c1[1], c2[1]); b.z1 = Math.max(c1[1], c2[1]);
            if (!free(b.x0, b.z0, b.x1, b.z1)) continue;
            // sol : hauteur au centre ; trop pentu ou mouillé : pas de bâtiment
            const mid = P(Math.floor(K.w / 2), Math.floor(K.d / 2));
            const hs = [mid, P(0, 0), P(K.w - 1, 0), P(0, K.d - 1), P(K.w - 1, K.d - 1)].map(([x, z]) => this.column(x, z).h);
            if (Math.max(...hs) - Math.min(...hs) > 5 || Math.min(...hs) <= SEA) continue;
            b.y = hs[0];
            taken.push([b.x0, b.z0, b.x1, b.z1]);
            if (kind !== 'farm') {
              // les villageois apparaissent sur le seuil (les portes sont fermées)
              const [sx, sz] = P(b.door, -1);
              v.spots.push([sx, b.y + 1, sz]);
              v.pop++;
              // coffre (toujours chez le forgeron, parfois ailleurs)
              if (kind === 'smith' || rand() < 0.45) {
                const [kx, kz] = P(K.w - 2, K.d - 2);
                b.chest = [kx, b.y + 1, kz];
                v.chests.push({ x: kx, y: b.y + 1, z: kz, smith: kind === 'smith' });
              }
            }
            v.builds.push(b);
          }
        }
        // lampadaire au bout de la route
        const lx = bx + (dz ? 2 : dx), lz = bz + (dx ? 2 : dz);
        if (free(lx, lz, lx, lz)) v.lamps.push([lx, lz]);
      }
      // lampadaires aux coins de la place
      for (const [px, pz] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) if (free(cx + px, cz + pz, cx + px, cz + pz)) v.lamps.push([cx + px, cz + pz]);
      for (const b of [...v.roads, ...v.builds]) v.r = Math.max(v.r, Math.abs(b.x0 - cx), Math.abs(b.x1 - cx), Math.abs(b.z0 - cz), Math.abs(b.z1 - cz));
      for (const [x, z] of v.lamps) v.r = Math.max(v.r, Math.abs(x - cx), Math.abs(z - cz));
      v.r += 1;
      v.pop = Math.min(8, v.pop);
      return v;
    }
    villagesFor(c) {
      if (!this.hasVillages) return;
      const R = VILLAGE_REGION;
      const r0x = Math.floor((c.x0 - 60) / R), r1x = Math.floor((c.x0 + 75) / R);
      const r0z = Math.floor((c.z0 - 60) / R), r1z = Math.floor((c.z0 + 75) / R);
      for (let rz = r0z; rz <= r1z; rz++)
        for (let rx = r0x; rx <= r1x; rx++) {
          const v = this.villageAt(rx, rz);
          if (!v || v.x + v.r < c.x0 || v.x - v.r > c.x0 + 15 || v.z + v.r < c.z0 || v.z - v.r > c.z0 + 15) continue;
          this.writeVillage(c, v);
        }
    }
    // Écrit la partie du village qui tombe dans le tronçon c.
    writeVillage(c, v) {
      const Bk = CM.B, st = v.st, blocks = c.blocks, x0 = c.x0, z0 = c.z0;
      const inC = (X, Z) => X >= x0 && X < x0 + 16 && Z >= z0 && Z < z0 + 16;
      const set = (X, Y, Z, id) => {
        if (Y > 0 && Y < H && inC(X, Z)) blocks[lidx(X - x0, Y, Z - z0)] = id;
      };
      const get = (X, Y, Z) => blocks[lidx(X - x0, Y, Z - z0)];
      const soft = (id) => id === 0 || id === Bk.WATER || id === Bk.SNOW_LAYER || CM.blocks[id].replaceable || CM.blocks[id].render === 'cross';
      const hsh = (X, Y, Z, k) => CM.hash3(X, Y + k * 97, Z, v.seed);
      const found = (X, Y, Z, id) => {
        for (let yy = Y; yy > Y - 12 && yy > MINY; yy--) {
          if (!soft(get(X, yy, Z))) break;
          set(X, yy, Z, id);
        }
      };
      const clear = (X, Y0, Y1, Z) => {
        for (let yy = Y0; yy <= Y1 && yy < H; yy++) set(X, yy, Z, 0);
      };
      const hits = (b) => !(b.x1 < x0 || b.x0 > x0 + 15 || b.z1 < z0 || b.z0 > z0 + 15);
      // routes et place (suivent le relief ; pont en planches au-dessus de l'eau)
      for (const rd of v.roads) {
        if (!hits(rd)) continue;
        for (let Z = Math.max(rd.z0, z0); Z <= Math.min(rd.z1, z0 + 15); Z++)
          for (let X = Math.max(rd.x0, x0); X <= Math.min(rd.x1, x0 + 15); X++) {
            const h = this.column(X, Z).h;
            if (h <= SEA) {
              set(X, SEA, Z, st.planks);
              clear(X, SEA + 1, SEA + 3, Z);
              continue;
            }
            for (let yy = h + 1; yy <= h + 3; yy++) if (soft(get(X, yy, Z))) set(X, yy, Z, 0);
            set(X, h, Z, st.path[Math.floor(hsh(X, 0, Z, 1) * st.path.length)]);
          }
      }
      for (const b of v.builds) {
        if (!hits(b)) continue;
        if (b.type === 'well') {
          const y = b.y;
          for (let dz = -1; dz <= 1; dz++)
            for (let dx = -1; dx <= 1; dx++) {
              const X = v.x + dx, Z = v.z + dz;
              if (!inC(X, Z)) continue;
              found(X, y - 1, Z, Bk.COBBLE);
              clear(X, y + 1, y + 5, Z);
              if (!dx && !dz) {
                for (let yy = y - 3; yy <= y; yy++) set(X, yy, Z, Bk.WATER);
                set(X, y + 3, Z, Bk.LANTERN);
              } else {
                set(X, y, Z, Bk.COBBLE);
                set(X, y + 1, Z, Bk.COBBLE);
              }
              if (dx && dz) {
                set(X, y + 2, Z, st.log);
                set(X, y + 3, Z, st.log);
              }
              set(X, y + 4, Z, dx && dz ? st.roofSlab : st.roof);
              if (st.snow) set(X, y + 5, Z, Bk.SNOW_LAYER);
            }
          continue;
        }
        const { w, d, y } = b;
        const H0 = b.hgt;
        const smith = b.type === 'smith';
        const wallId = smith ? Bk.COBBLE : st.planks;
        for (let vv = -1; vv <= d; vv++)
          for (let u = -1; u <= w; u++) {
            const X = b.ox + u * b.ux + vv * b.vx, Z = b.oz + u * b.uz + vv * b.vz;
            if (!inC(X, Z)) continue;
            const inside = u >= 0 && u < w && vv >= 0 && vv < d;
            if (b.type === 'farm') {
              if (!inside) continue;
              found(X, y - 1, Z, Bk.DIRT);
              clear(X, y + 1, y + 3, Z);
              const edge = u === 0 || u === w - 1 || vv === 0 || vv === d - 1;
              if (edge) set(X, y, Z, st.log);
              else if (u === (w >> 1)) set(X, y, Z, Bk.WATER);
              else {
                const g = hsh(X, y, Z, 2);
                const stage = g < 0.45 ? 3 : g < 0.7 ? 2 : g < 0.9 ? 1 : 0;
                if (this.mixedFarms) {
                  // chaque moitié du champ a sa culture : blé, carottes, pommes de terre ou betteraves
                  const k = hsh(b.ox, u < w >> 1 ? 1 : 2, b.oz, 7);
                  const kind = k < 0.45 ? 'wheat' : k < 0.65 ? 'carrot' : k < 0.85 ? 'potato' : 'beetroot';
                  set(X, y, Z, Bk.FARMLAND_WET);
                  set(X, y + 1, Z, CM.CROPS[kind][stage]);
                } else {
                  set(X, y, Z, Bk.FARMLAND);
                  set(X, y + 1, Z, Bk['WHEAT_' + stage]);
                }
              }
              continue;
            }
            // seuil de la porte, relié à la route
            if (vv === -1 && u === b.door) {
              found(X, y - 1, Z, st.lower);
              set(X, y, Z, st.path[0]);
              clear(X, y + 1, y + 3, Z);
            }
            if (inside) {
              found(X, y - 1, Z, st.lower);
              set(X, y, Z, smith ? Bk.STONEBRICK : st.floor);
              clear(X, y + 1, y + H0 + 5, Z);
              const wall = u === 0 || u === w - 1 || vv === 0 || vv === d - 1;
              const corner = (u === 0 || u === w - 1) && (vv === 0 || vv === d - 1);
              if (wall) {
                for (let yy = y + 1; yy <= y + H0; yy++) {
                  let id = corner ? st.log : yy === y + 1 ? st.lower : wallId;
                  // fenêtres
                  if (!corner && yy === y + 2 && (vv === 0 ? Math.abs(u - b.door) === 2 : (u + vv) % 2 === 1)) id = Bk.GLASS;
                  // porte (fermée), dans l'axe du mur de façade
                  if (vv === 0 && u === b.door && yy <= y + 2) {
                    const ds = CM.DOORS[st.door], ax = b.ux ? 0 : 1;
                    id = yy === y + 1 ? ds[ax * 2] : ds[4 + ax * 2];
                  }
                  set(X, yy, Z, id);
                }
              } else {
                // mobilier
                const Y = y + 1;
                if (b.chest && X === b.chest[0] && Z === b.chest[2]) set(X, Y, Z, Bk.CHEST);
                else if (u === 1 && vv === d - 2) set(X, Y, Z, smith ? Bk.FORGE : b.type === 'library' ? Bk.CARTOGRAPHY_TABLE : Bk.TABLE);
                else if (u === w - 2 && vv === 1) set(X, Y, Z, Bk.LANTERN);
                else if (smith && u === 2 && vv === d - 2) set(X, Y, Z, Bk.SMITHING_TABLE);
                else if (b.type === 'library' && vv === d - 2 && u > 1 && u < w - 2) {
                  set(X, Y, Z, Bk.BOOKSHELF);
                  set(X, Y + 1, Z, Bk.BOOKSHELF);
                } else if (!smith && u === 1 && vv === 1) {
                  set(X, Y, Z, Bk.BED);
                } else if (b.type === 'bighouse' && u > 1 && u < w - 2 && vv > 1 && vv < d - 2) set(X, Y, Z, Bk.CARPET_RED);
              }
            }
            // toit
            if (st.flat) {
              if (!inside) continue;
              const edge = u === 0 || u === w - 1 || vv === 0 || vv === d - 1;
              set(X, y + H0 + 1, Z, st.roof);
              if (edge) set(X, y + H0 + 2, Z, st.roofSlab);
            } else {
              // toit en escalier (pyramide), débord d'un bloc
              const k = Math.min(u + 1, w - u, vv + 1, d - vv);
              const top = y + H0 + k; // débord (k = 0) : dalle au niveau du haut des murs
              if (!inside) {
                for (let yy = y + H0; yy <= y + H0 + 3; yy++) if (soft(get(X, yy, Z))) set(X, yy, Z, 0);
              }
              set(X, top, Z, k === 0 ? st.roofSlab : st.roof);
              if (st.snow) set(X, top + 1, Z, Bk.SNOW_LAYER);
            }
          }
      }
      // lampadaires
      for (const [X, Z] of v.lamps) {
        if (!inC(X, Z)) continue;
        const h = this.column(X, Z).h;
        if (h <= SEA) continue;
        clear(X, h + 1, h + 4, Z);
        set(X, h + 1, Z, st.lower);
        set(X, h + 2, Z, st.log);
        set(X, h + 3, Z, Bk.LANTERN);
      }
    }

    // Un coffre d'origine (ruine) qui n'a jamais été touché par le joueur ?
    isNaturalChest(x, y, z) {
      const c = this.chunkAt(x, z);
      if (!c || c.blocks[lidx(x & 15, y, z & 15)] !== CM.B.CHEST) return false;
      const e = this.edits.get(ckey(c.cx, c.cz));
      return !(e && e.has(lidx(x & 15, y, z & 15)));
    }

    // --------------------------------------------------- îles célestes ---
    islandIn(rx, rz) {
      const k = rx + ',' + rz;
      if (this.islandCache.has(k)) return this.islandCache.get(k);
      const rand = CM.rng((CM.hash3(rx, 91, rz, this.seed) * 4294967296) >>> 0);
      let isl = null;
      if (rand() < 0.6 && this.type !== 'flat') {
        const r = 6 + rand() * 6;
        const x = rx * REGION + 24 + Math.floor(rand() * (REGION - 48));
        const z = rz * REGION + 24 + Math.floor(rand() * (REGION - 48));
        const y = 72 + Math.floor(rand() * 9);
        const end = rand() < 0.35; // île de l'End : pierre de l'End et pilier de purpur
        let ok = true;
        for (let dz = -r; dz <= r && ok; dz += 3)
          for (let dx = -r; dx <= r; dx += 3)
            if (this.column(Math.round(x + dx), Math.round(z + dz)).h > y - 22) {
              ok = false;
              break;
            }
        if (ok) {
          isl = { x, y, z, r, shards: [], end };
          for (let t = 0; t < 400 && isl.shards.length < 7; t++) {
            const X = Math.round(x + (rand() - 0.5) * r * 1.6);
            const Z = Math.round(z + (rand() - 0.5) * r * 1.6);
            const Y = y - 2 - Math.floor(rand() * r * 0.7);
            const col = this.islandCol(isl, X, Z);
            if (col && Y >= col.top - col.depth && Y < col.top - 2 && !isl.shards.some((s) => s[0] === X && s[1] === Y && s[2] === Z)) isl.shards.push([X, Y, Z]);
          }
        }
      }
      this.islandCache.set(k, isl);
      return isl;
    }
    islandCol(isl, X, Z) {
      const dist = Math.hypot(X - isl.x, Z - isl.z) + this.nA.noise2(X / 5, Z / 5) * 1.5;
      if (dist >= isl.r) return null;
      const t = 1 - dist / isl.r;
      const top = isl.y + Math.round(this.nB.noise2(X / 7, Z / 7) * 1.2);
      const depth = Math.round(Math.pow(t, 0.6) * isl.r * 0.9 + this.nC.noise2(X / 3, Z / 3) * 1.5) + 1;
      return { top, depth };
    }
    // Îles proches d'un point (utile pour les tests et la navigation).
    islandsNear(x, z, radius) {
      const out = [];
      const r0x = Math.floor((x - radius) / REGION), r1x = Math.floor((x + radius) / REGION);
      const r0z = Math.floor((z - radius) / REGION), r1z = Math.floor((z + radius) / REGION);
      for (let rz = r0z; rz <= r1z; rz++) for (let rx = r0x; rx <= r1x; rx++) {
        const isl = this.islandIn(rx, rz);
        if (isl) out.push(isl);
      }
      return out;
    }
    islandsFor(c) {
      const B = CM.B, seed = this.seed;
      const M = 16;
      const r0x = Math.floor((c.x0 - M) / REGION), r1x = Math.floor((c.x0 + 15 + M) / REGION);
      const r0z = Math.floor((c.z0 - M) / REGION), r1z = Math.floor((c.z0 + 15 + M) / REGION);
      const inC = (X, Z) => X >= c.x0 && X < c.x0 + 16 && Z >= c.z0 && Z < c.z0 + 16;
      for (let rz = r0z; rz <= r1z; rz++)
        for (let rx = r0x; rx <= r1x; rx++) {
          const isl = this.islandIn(rx, rz);
          if (!isl) continue;
          const E = isl.r + 4;
          if (isl.x + E < c.x0 || isl.x - E > c.x0 + 15 || isl.z + E < c.z0 || isl.z - E > c.z0 + 15) continue;
          const R = Math.ceil(isl.r);
          const tops = [];
          const body = isl.end ? B.END_STONE : B.SKYSTONE;
          for (let dz = -R; dz <= R; dz++)
            for (let dx = -R; dx <= R; dx++) {
              const X = isl.x + dx, Z = isl.z + dz;
              const col = this.islandCol(isl, X, Z);
              if (!col) continue;
              tops.push([X, col.top, Z]);
              if (!inC(X, Z)) continue;
              for (let y = col.top - col.depth; y <= col.top; y++) {
                let id = body;
                if (!isl.end) {
                  if (y === col.top) id = B.GRASS;
                  else if (y >= col.top - 2) id = B.DIRT;
                }
                c.blocks[lidx(X - c.x0, y, Z - c.z0)] = id;
              }
            }
          for (const [X, Y, Z] of isl.shards) {
            if (!inC(X, Z)) continue;
            const i = lidx(X - c.x0, Y, Z - c.z0);
            if (c.blocks[i] === body) c.blocks[i] = B.SHARD_ORE;
          }
          if (isl.end) {
            // petit sanctuaire de purpur au centre de l'île
            const col = this.islandCol(isl, isl.x, isl.z);
            if (!col) continue;
            for (let dz = -1; dz <= 1; dz++)
              for (let dx = -1; dx <= 1; dx++) {
                const X = isl.x + dx, Z = isl.z + dz;
                if (!inC(X, Z) || col.top + 6 >= H) continue;
                c.blocks[lidx(X - c.x0, col.top, Z - c.z0)] = B.END_STONE_BRICKS;
                if (dx === 0 && dz === 0) {
                  for (let k = 1; k <= 4; k++) c.blocks[lidx(X - c.x0, col.top + k, Z - c.z0)] = B.PURPUR_PILLAR;
                  c.blocks[lidx(X - c.x0, col.top + 5, Z - c.z0)] = B.PURPUR_BLOCK;
                } else if (Math.abs(dx) + Math.abs(dz) === 2) c.blocks[lidx(X - c.x0, col.top + 1, Z - c.z0)] = B.PURPUR_BLOCK;
              }
            continue;
          }
          const trees = [];
          for (const [X, top, Z] of tops) {
            if (top + 1 >= H) continue;
            const h = CM.hash3(X, top, Z, seed + 77);
            if (h < 0.025 && Math.hypot(X - isl.x, Z - isl.z) < isl.r - 3) {
              trees.push([X, top, Z]);
              continue;
            }
            if (!inC(X, Z)) continue;
            const i = lidx(X - c.x0, top + 1, Z - c.z0);
            if (c.blocks[i] !== 0) continue;
            if (h < 0.2) c.blocks[i] = B.TALLGRASS;
            else if (h < 0.26) c.blocks[i] = B.FLOWER;
          }
          for (const [X, top, Z] of trees) this.placeTree(c, 'OAK', false, X, top + 1, Z);
        }
    }

    // ------------------------------------------- chargement / diffusion ---
    addChunk(c) {
      this.chunks.set(ckey(c.cx, c.cz), c);
      const nb = [
        this.chunks.get(ckey(c.cx - 1, c.cz)),
        this.chunks.get(ckey(c.cx + 1, c.cz)),
        this.chunks.get(ckey(c.cx, c.cz - 1)),
        this.chunks.get(ckey(c.cx, c.cz + 1)),
      ];
      for (let s = 0; s < 4; s++) {
        c.nb[s] = nb[s] || null;
        if (nb[s]) nb[s].nb[s ^ 1] = c;
      }
      this.lightChunk(c);
    }
    removeChunk(c) {
      this.chunks.delete(ckey(c.cx, c.cz));
      for (let s = 0; s < 4; s++) if (c.nb[s]) c.nb[s].nb[s ^ 1] = null;
      if (this._lc === c) this._lc = null;
      for (let sy = 0; sy < SY; sy++) this.dirty.delete(skey(c.cx, sy, c.cz));
    }

    // Génère les tronçons manquants autour d'un point (les plus proches d'abord)
    // et décharge les tronçons trop lointains. Renvoie le nombre restant à générer.
    // others : autres centres à garder chargés ([x, z, rayon], joueurs en multijoueur).
    stream(px, pz, radius, budgetMs, others) {
      const t0 = performance.now();
      const centers = [[Math.floor(px / 16), Math.floor(pz / 16), radius]];
      if (others) for (const [x, z, r] of others) centers.push([Math.floor(x / 16), Math.floor(z / 16), r]);
      const cand = [];
      const seen = new Set();
      for (const [pcx, pcz, rad] of centers) {
        const r2 = (rad + 0.5) * (rad + 0.5);
        for (let dz = -rad; dz <= rad; dz++)
          for (let dx = -rad; dx <= rad; dx++) {
            const d2 = dx * dx + dz * dz;
            if (d2 > r2) continue;
            const cx = pcx + dx, cz = pcz + dz;
            if (Math.abs(cx) > LIMIT || Math.abs(cz) > LIMIT) continue;
            const k = ckey(cx, cz);
            if (!this.chunks.has(k) && !seen.has(k)) {
              seen.add(k);
              cand.push([d2, cx, cz]);
            }
          }
      }
      cand.sort((a, b) => a[0] - b[0]);
      let n = 0;
      for (const [d2, cx, cz] of cand) {
        if (d2 > 2 && n > 0 && performance.now() - t0 > budgetMs) break;
        this.addChunk(this.generateChunk(cx, cz));
        n++;
      }
      for (const c of this.chunks.values()) {
        let keep = false;
        for (const [pcx, pcz, rad] of centers) {
          const dx = c.cx - pcx, dz = c.cz - pcz;
          if (dx * dx + dz * dz <= (rad + 2.5) * (rad + 2.5)) {
            keep = true;
            break;
          }
        }
        if (!keep) this.removeChunk(c);
      }
      return cand.length - n;
    }

    // Génère les tronçons manquants autour d'un point, sans rien décharger.
    loadAround(px, pz, radius) {
      const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
      for (let dz = -radius; dz <= radius; dz++)
        for (let dx = -radius; dx <= radius; dx++) {
          const cx = pcx + dx, cz = pcz + dz;
          if (Math.abs(cx) <= LIMIT && Math.abs(cz) <= LIMIT && !this.chunks.has(ckey(cx, cz))) this.addChunk(this.generateChunk(cx, cz));
        }
    }

    // ----------------------------------------------------------- lumière --
    lightChunk(c) {
      const blocks = c.blocks, L = c.light, defs = CM.blocks, top = c.top;
      L.fill(0);
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          let y = H - 1;
          for (; y >= MINY; y--) {
            const i = lidx(lx, y, lz);
            const b = defs[blocks[i]];
            if (!b.lightPass || b.atten > 0) break;
            L[i] = 0xf0;
          }
          top[(lz << 4) | lx] = y + 1;
        }
      this.genChunk = c;
      // ciel : graines internes (bords des colonnes éclairées)
      qh = qt = 0;
      const topOf = (lx, lz) => {
        if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) return top[(lz << 4) | lx];
        const n = lx < 0 ? c.nb[0] : lx > 15 ? c.nb[1] : lz < 0 ? c.nb[2] : c.nb[3];
        return n ? n.top[((lz & 15) << 4) | (lx & 15)] : MINY - 1;
      };
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const t = top[(lz << 4) | lx];
          if (t < H) push(c, lidx(lx, t, lz));
          const maxN = Math.max(t, topOf(lx - 1, lz), topOf(lx + 1, lz), topOf(lx, lz - 1), topOf(lx, lz + 1));
          for (let y = t + 1; y < maxN; y++) push(c, lidx(lx, y, lz));
        }
      this.seedBorders(c, SKY);
      this.propagate(SKY);
      // blocs lumineux
      qh = qt = 0;
      for (let i = 0; i < CVOL; i++) {
        const e = defs[blocks[i]].light;
        if (e) {
          L[i] = (L[i] & 0xf0) | e;
          push(c, i);
        }
      }
      this.seedBorders(c, BLK);
      this.propagate(BLK);
      this.genChunk = null;
    }

    // Les cases des voisins en bordure réinjectent leur lumière dans le nouveau tronçon.
    seedBorders(c, ch) {
      for (let s = 0; s < 4; s++) {
        const n = c.nb[s];
        if (!n) continue;
        const L = n.light;
        for (let y = MINY; y < H; y++)
          for (let k = 0; k < 16; k++) {
            let i;
            if (s === 0) i = lidx(15, y, k);
            else if (s === 1) i = lidx(0, y, k);
            else if (s === 2) i = lidx(k, y, 15);
            else i = lidx(k, y, 0);
            if (getL(L, i, ch) > 1) push(n, i);
          }
      }
    }

    propagate(ch) {
      const defs = CM.blocks;
      const track = this.trackDirty, gen = this.genChunk;
      while (qh !== qt) {
        const c = Qc[qh];
        const i = Qi[qh];
        Qc[qh] = null;
        qh = (qh + 1) & QM;
        const lv = getL(c.light, i, ch);
        if (lv <= 1) continue;
        for (let dir = 0; dir < 6; dir++) {
          const n = step(c, i, dir);
          if (n < 0) continue;
          const nc = nbC;
          const b = defs[nc.blocks[n]];
          if (!b.lightPass) continue;
          let nl = lv - 1 - b.atten;
          if (ch === SKY && dir === 4 && lv === 15 && b.atten === 0) nl = 15;
          if (nl > getL(nc.light, n, ch)) {
            setL(nc.light, n, ch, nl);
            push(nc, n);
            if (track || nc !== gen) this.markCell(nc, n);
          }
        }
      }
    }

    removeLight(c0, i0, ch) {
      const defs = CM.blocks;
      let rh = 0, rt = 0;
      const lv0 = getL(c0.light, i0, ch);
      setL(c0.light, i0, ch, 0);
      Rc[rt] = c0; Ri[rt] = i0; Rl[rt] = lv0;
      rt = (rt + 1) & RM;
      while (rh !== rt) {
        const c = Rc[rh], j = Ri[rh], jl = Rl[rh];
        Rc[rh] = null;
        rh = (rh + 1) & RM;
        for (let dir = 0; dir < 6; dir++) {
          const n = step(c, j, dir);
          if (n < 0) continue;
          const nc = nbC;
          const nl = getL(nc.light, n, ch);
          if (nl === 0) continue;
          if (nl < jl || (ch === SKY && dir === 4 && jl === 15 && nl === 15)) {
            setL(nc.light, n, ch, 0);
            this.markCell(nc, n);
            Rc[rt] = nc; Ri[rt] = n; Rl[rt] = nl;
            rt = (rt + 1) & RM;
            if (ch === BLK) {
              const e = defs[nc.blocks[n]].light;
              if (e) {
                setL(nc.light, n, ch, e);
                push(nc, n);
              }
            }
          } else push(nc, n);
        }
      }
    }

    markCell(c, i) {
      this.markDirty(c.x0 + (i & 15), yOf(i), c.z0 + ((i >> 4) & 15), 1);
    }
    markDirty(x, y, z, level) {
      const cx0 = (x - 1) >> 4, cx1 = (x + 1) >> 4;
      const cz0 = (z - 1) >> 4, cz1 = (z + 1) >> 4;
      const sy0 = Math.max(0, (y - 1 - MINY) >> 4), sy1 = Math.min(SY - 1, (y + 1 - MINY) >> 4);
      for (let cz = cz0; cz <= cz1; cz++)
        for (let cx = cx0; cx <= cx1; cx++)
          for (let sy = sy0; sy <= sy1; sy++) {
            const k = skey(cx, sy, cz);
            if ((this.dirty.get(k) || 0) < level) this.dirty.set(k, level);
          }
    }

    // Pose/retire un bloc et met à jour la lumière localement.
    setBlock(x, y, z, id) {
      if (y < MINY || y >= H) return false;
      const c = this.chunkAt(x, z);
      if (!c) return false;
      const i = lidx(x & 15, y, z & 15);
      if (c.blocks[i] === id) return false;
      c.blocks[i] = id;
      const k = ckey(c.cx, c.cz);
      let e = this.edits.get(k);
      if (!e) this.edits.set(k, (e = new Map()));
      e.set(i, id);
      this.trackDirty = true;
      this.markDirty(x, y, z, 2);
      qh = qt = 0;
      this.removeLight(c, i, SKY);
      this.propagate(SKY);
      qh = qt = 0;
      this.removeLight(c, i, BLK);
      const em = CM.blocks[id].light;
      if (em) {
        setL(c.light, i, BLK, em);
        push(c, i);
      }
      for (let dir = 0; dir < 6; dir++) {
        const n = step(c, i, dir);
        if (n >= 0) push(nbC, n);
      }
      this.propagate(BLK);
      this.trackDirty = false;
      if (this.onSet) this.onSet(x, y, z, id);
      if (this.onEdit) this.onEdit(x, y, z, id);
      return true;
    }

    // Modification venue du réseau : appliquée tout de suite si le tronçon est chargé,
    // sinon simplement notée (elle sera appliquée à la génération du tronçon).
    applyRemote(x, y, z, id) {
      if (y < MINY || y >= H || !CM.blocks[id]) return false;
      const c = this.chunkAt(x, z);
      if (c) return this.setBlock(x, y, z, id);
      const k = ckey(x >> 4, z >> 4);
      let e = this.edits.get(k);
      if (!e) this.edits.set(k, (e = new Map()));
      e.set(lidx(x & 15, y, z & 15), id);
      if (this.onEdit) this.onEdit(x, y, z, id);
      return true;
    }

    // Modifications sauvegardées : { "cx,cz": [index, bloc, ...] }.
    editsObject() {
      const out = {};
      for (const [k, m] of this.edits) {
        const cx = Math.floor(k / 0x10000) - 0x8000, cz = (k % 0x10000) - 0x8000;
        const arr = [];
        for (const [i, id] of m) arr.push(i, id);
        out[cx + ',' + cz] = arr;
      }
      return out;
    }
    editCount() {
      let n = 0;
      for (const m of this.edits.values()) n += m.size;
      return n;
    }
    // Position monde de chaque bloc modifié ayant l'identifiant id.
    // Cases modifiées dont le bloc vérifie test(id) : [x, y, z, id].
    editedWhere(test) {
      const out = [];
      for (const [k, m] of this.edits) {
        const cx = Math.floor(k / 0x10000) - 0x8000, cz = (k % 0x10000) - 0x8000;
        for (const [i, b] of m) if (test(b)) out.push([cx * 16 + (i & 15), yOf(i), cz * 16 + ((i >> 4) & 15), b]);
      }
      return out;
    }
    editedPositions(id) {
      const out = [];
      for (const [k, m] of this.edits) {
        const cx = Math.floor(k / 0x10000) - 0x8000, cz = (k % 0x10000) - 0x8000;
        for (const [i, b] of m) if (b === id) out.push([cx * 16 + (i & 15), yOf(i), cz * 16 + ((i >> 4) & 15)]);
      }
      return out;
    }

    // Fait pousser un arbre à partir d'une pousse (en jeu, avec mise à jour de la lumière).
    // Fait pousser un arbre à partir d'une pousse (en jeu, avec mise à jour de la lumière).
    growTree(x, y, z, type) {
      const big = type === 'JUNGLE' && Math.random() < 0.2;
      const shape = this.treeShape(type, big, x, y, z);
      for (const [X, Y, Z, id, onlyAir] of shape) {
        if (Y >= H || !this.loaded(X, Z)) return false;
        // le tronc a besoin de place
        if (!onlyAir && id !== CM.B.DIRT && Y >= y) {
          const cur = this.get(X, Y, Z);
          if (cur !== 0 && !CM.blocks[cur].plant && !(cur === this.get(x, y, z))) return false;
        }
      }
      for (const [X, Y, Z, id, onlyAir] of shape) {
        const cur = this.get(X, Y, Z);
        if (onlyAir && cur !== 0 && !CM.blocks[cur].plant) continue;
        this.setBlock(X, Y, Z, id);
      }
      return true;
    }

    // Hauteur du premier bloc solide sous une position (pour faire apparaître des créatures).
    groundBelow(x, y, z) {
      for (let yy = Math.min(y, H - 1); yy > MINY; yy--) {
        const id = this.get(x, yy, z);
        if (CM.blocks[id].solid) return yy;
      }
      return -1;
    }

    // Lancer de rayon voxel (DDA). filter(id) décide des blocs qui arrêtent le rayon.
    raycast(ox, oy, oz, dx, dy, dz, maxDist, filter) {
      let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
      const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
      const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
      let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
      let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
      let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
      let t = 0, nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < 512 && t <= maxDist; i++) {
        if (y >= MINY && y < H) {
          const id = this.get(x, y, z);
          const s = id && filter(id) ? CM.blocks[id].sel : null;
          if (s === CM.FULL_BOX) return { x, y, z, nx, ny, nz, t, id, box: s };
          if (s) {
            // bloc partiel (dalle, torche, plante, porte…) : le rayon doit toucher sa boîte
            const tb = CM.rayBox(ox, oy, oz, dx, dy, dz, x + s[0], y + s[1], z + s[2], x + s[3], y + s[4], z + s[5]);
            if (tb >= 0 && tb <= maxDist) {
              // face touchée : celle sur laquelle se trouve le point d'impact
              const hx = ox + dx * tb - x, hy = oy + dy * tb - y, hz = oz + dz * tb - z;
              let fx = nx, fy = ny, fz = nz;
              if (tb > 0) {
                const e = 1e-4;
                if (Math.abs(hy - s[4]) < e) (fx = 0), (fy = 1), (fz = 0);
                else if (Math.abs(hy - s[1]) < e) (fx = 0), (fy = -1), (fz = 0);
                else if (Math.abs(hx - s[3]) < e) (fx = 1), (fy = 0), (fz = 0);
                else if (Math.abs(hx - s[0]) < e) (fx = -1), (fy = 0), (fz = 0);
                else if (Math.abs(hz - s[5]) < e) (fx = 0), (fy = 0), (fz = 1);
                else if (Math.abs(hz - s[2]) < e) (fx = 0), (fy = 0), (fz = -1);
              }
              return { x, y, z, nx: fx, ny: fy, nz: fz, t: tb, id, box: s };
            }
          }
        }
        if (tmx < tmy && tmx < tmz) {
          x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0;
        } else if (tmy < tmz) {
          y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0;
        } else {
          z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz;
        }
      }
      return null;
    }
  }

  CM.World = World;
  CM.Chunk = Chunk;
})();
