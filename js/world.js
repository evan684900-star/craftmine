'use strict';
// Monde voxel infini : tronçons 16x16 générés à la demande autour du joueur,
// éclairage (ciel + blocs) propagé d'un tronçon à l'autre.
(function () {
  const H = 96, SEA = 32, SY = H / 16;
  const CVOL = 16 * 16 * H;
  const LIMIT = 30000; // tronçons max depuis l'origine (±480 000 blocs)
  const REGION = 192; // taille des régions qui accueillent chacune au plus une île céleste
  CM.WORLD = { H, SEA, SY, LIMIT };

  const ckey = (cx, cz) => (cx + 0x8000) * 0x10000 + (cz + 0x8000);
  const skey = (cx, sy, cz) => ckey(cx, cz) * 8 + sy;
  CM.ckey = ckey;
  CM.skey = skey;
  const lidx = (lx, y, lz) => (y << 8) | (lz << 4) | lx;

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
    const lx = i & 15, lz = (i >> 4) & 15, y = i >> 8;
    switch (dir) {
      case 0: if (lx > 0) { nbC = c; return i - 1; } nbC = c.nb[0]; return nbC ? i + 15 : -1;
      case 1: if (lx < 15) { nbC = c; return i + 1; } nbC = c.nb[1]; return nbC ? i - 15 : -1;
      case 2: if (lz > 0) { nbC = c; return i - 16; } nbC = c.nb[2]; return nbC ? i + 240 : -1;
      case 3: if (lz < 15) { nbC = c; return i + 16; } nbC = c.nb[3]; return nbC ? i - 240 : -1;
      case 4: nbC = c; return y > 0 ? i - 256 : -1;
      default: nbC = c; return y < H - 1 ? i + 256 : -1;
    }
  }

  class Chunk {
    constructor(cx, cz) {
      this.cx = cx;
      this.cz = cz;
      this.x0 = cx * 16;
      this.z0 = cz * 16;
      this.blocks = new Uint8Array(CVOL);
      this.light = new Uint8Array(CVOL);
      this.top = new Uint8Array(256);
      this.nb = [null, null, null, null];
    }
  }

  // Grilles de bruit pour les grottes (réutilisées d'un tronçon à l'autre).
  const GS = 4, G = 5, GY = H / GS + 1;
  const gA = new Float32Array(G * G * GY), gB = new Float32Array(G * G * GY), gC = new Float32Array(G * G * GY);
  function tri(g, lx, y, lz) {
    const fx = lx / GS, fy = y / GS, fz = lz / GS;
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
  const BIO = {
    PLAINS: 0, DESERT: 1, FOREST: 2, MOUNTAINS: 3, BIRCH: 4, TAIGA: 5, SNOWY_TAIGA: 6, TUNDRA: 7,
    SAVANNA: 8, JUNGLE: 9, SWAMP: 10, BADLANDS: 11, CRYSTAL: 12, OCEAN: 13, LAKE: 14,
  };
  const BIOME_NAMES = [
    'Plaines', 'Désert', 'Forêt', 'Montagnes', 'Forêt de bouleaux', 'Taïga', 'Taïga enneigée', 'Toundra glacée',
    'Savane', 'Jungle', 'Marais', 'Canyon rouge', 'Sylve cristalline', 'Océan', 'Lac',
  ];
  CM.BIO = BIO;
  CM.BIOME_NAMES = BIOME_NAMES;

  // Arbres par biome : densité p, puis [essence, poids, proportion de grands arbres].
  const TREES = [];
  TREES[BIO.PLAINS] = { p: 0.004, kinds: [['OAK', 0.8], ['BIRCH', 0.2]] };
  TREES[BIO.FOREST] = { p: 0.045, kinds: [['OAK', 0.78, 0.12], ['BIRCH', 0.22]] };
  TREES[BIO.BIRCH] = { p: 0.05, kinds: [['BIRCH', 0.9], ['OAK', 0.1]] };
  TREES[BIO.TAIGA] = { p: 0.05, kinds: [['SPRUCE', 1]] };
  TREES[BIO.SNOWY_TAIGA] = { p: 0.04, kinds: [['SPRUCE', 1]] };
  TREES[BIO.TUNDRA] = { p: 0.003, kinds: [['SPRUCE', 1]] };
  TREES[BIO.SAVANNA] = { p: 0.008, kinds: [['ACACIA', 0.85], ['OAK', 0.15]] };
  TREES[BIO.JUNGLE] = { p: 0.08, kinds: [['JUNGLE', 0.8, 0.25], ['OAK', 0.2]] };
  TREES[BIO.SWAMP] = { p: 0.022, kinds: [['WILLOW', 1]] };
  TREES[BIO.CRYSTAL] = { p: 0.035, kinds: [['CRYSTAL', 1]] };
  const MAX_TREE_P = 0.08;

  // Plantes par biome : [bloc, probabilité par colonne, hauteur max (cactus)].
  const PLANTS = [];
  PLANTS[BIO.PLAINS] = [['TALLGRASS', 0.14], ['FLOWER', 0.009], ['DANDELION', 0.009], ['CORNFLOWER', 0.007], ['DAISY', 0.009], ['BERRYBUSH', 0.004], ['PUMPKIN', 0.002]];
  PLANTS[BIO.FOREST] = [['TALLGRASS', 0.08], ['FERN', 0.02], ['FLOWER', 0.006], ['DANDELION', 0.005], ['BERRYBUSH', 0.012], ['RED_SHROOM', 0.005], ['BROWN_SHROOM', 0.006]];
  PLANTS[BIO.BIRCH] = [['TALLGRASS', 0.09], ['DAISY', 0.01], ['DANDELION', 0.006], ['TULIP', 0.006], ['FERN', 0.01]];
  PLANTS[BIO.TAIGA] = [['FERN', 0.06], ['TALLGRASS', 0.03], ['BERRYBUSH', 0.02], ['BROWN_SHROOM', 0.01], ['PUMPKIN', 0.0015]];
  PLANTS[BIO.SNOWY_TAIGA] = [['FERN', 0.02], ['BERRYBUSH', 0.006]];
  PLANTS[BIO.TUNDRA] = [['FERN', 0.004]];
  PLANTS[BIO.SAVANNA] = [['TALLGRASS', 0.16], ['DEAD_BUSH', 0.004], ['TULIP', 0.002]];
  PLANTS[BIO.JUNGLE] = [['TALLGRASS', 0.1], ['FERN', 0.1], ['MELON', 0.006], ['TULIP', 0.004]];
  PLANTS[BIO.SWAMP] = [['TALLGRASS', 0.05], ['FERN', 0.02], ['RED_SHROOM', 0.01], ['BROWN_SHROOM', 0.012], ['CORNFLOWER', 0.003]];
  PLANTS[BIO.DESERT] = [['CACTUS', 0.006, 3], ['DEAD_BUSH', 0.01]];
  PLANTS[BIO.BADLANDS] = [['DEAD_BUSH', 0.02], ['CACTUS', 0.002, 2]];
  PLANTS[BIO.CRYSTAL] = [['CRYSTAL_FLOWER', 0.03], ['TALLGRASS', 0.04], ['FERN', 0.02]];

  const VEINS = [
    // [bloc, filons par tronçon, y min, y max, longueur, biome réservé]
    ['COAL_ORE', 8.6, 8, 76, 9],
    ['IRON_ORE', 5.1, 4, 50, 6],
    ['CRYSTAL_ORE', 1.25, 3, 19, 5],
    ['COPPER_ORE', 5, 16, 70, 7],
    ['GOLD_ORE', 1.6, 4, 32, 5],
    ['GOLD_ORE', 5, 30, 72, 5, BIO.BADLANDS],
    ['RUBY_ORE', 3, 40, 86, 3, BIO.MOUNTAINS],
  ];
  // Roches qu'un filon peut remplacer
  const ROCK = new Uint8Array(256);
  const BANDS = [];
  const RUIN_REGION = 112;
  CM.initWorldTables = function () {
    const Bk = CM.B;
    for (const k of ['STONE', 'DEEPSTONE', 'GRANITE', 'DIORITE', 'ANDESITE']) ROCK[Bk[k]] = 1;
    const T = Bk.TERRACOTTA, R = Bk.TERRACOTTA_RED, Y = Bk.TERRACOTTA_YELLOW, BR = Bk.TERRACOTTA_BROWN, WH = Bk.TERRACOTTA_WHITE;
    BANDS.push(T, T, R, Y, T, WH, BR, T, R, R, Y, BR, T, WH, T, BR);
  };
  CM.initWorldTables();

  class World {
    constructor(seed, edits) {
      this.seed = seed >>> 0;
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
      if (edits) {
        for (const k in edits) {
          const [cx, cz] = k.split(',').map(Number);
          const arr = edits[k];
          const m = new Map();
          for (let j = 0; j + 1 < arr.length; j += 2) if (CM.blocks[arr[j + 1]] && arr[j] >= 0 && arr[j] < CVOL) m.set(arr[j], arr[j + 1]);
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
      return y >= 0 && y < H && !!this.chunkAt(x, z);
    }
    get(x, y, z) {
      if (y < 0 || y >= H) return 0;
      const c = this.chunkAt(x, z);
      return c ? c.blocks[lidx(x & 15, y, z & 15)] : 0;
    }
    // Pour les collisions : un tronçon pas encore chargé fait office de mur.
    solidAt(x, y, z) {
      if (y < 0) return true;
      if (y >= H) return false;
      const c = this.chunkAt(x, z);
      return c ? CM.blocks[c.blocks[lidx(x & 15, y, z & 15)]].solid : true;
    }
    skyAt(x, y, z) {
      if (y >= H) return 15;
      if (y < 0) return 0;
      const c = this.chunkAt(x, z);
      return c ? c.light[lidx(x & 15, y, z & 15)] >> 4 : 15;
    }
    blockLightAt(x, y, z) {
      if (y < 0 || y >= H) return 0;
      const c = this.chunkAt(x, z);
      return c ? c.light[lidx(x & 15, y, z & 15)] & 15 : 0;
    }
    // Un tronçon peut être maillé quand lui et ses 8 voisins sont chargés.
    meshable(cx, cz) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.chunks.has(ckey(cx + dx, cz + dz))) return false;
      return true;
    }

    // ------------------------------------------------ relief et biomes ----
    column(x, z) {
      const { nA, nB, nC, nD, nE, nF } = this;
      const Bk = CM.B;
      const cont = nA.fbm2(x / 480, z / 480, 4);
      const land = CM.smoothstep(-0.3, -0.06, cont);
      const hills = nA.fbm2(x / 46 + 100, z / 46 - 50, 4);
      let ridge = 1 - Math.abs(nB.noise2(x / 95, z / 95));
      ridge *= ridge;
      const mMask = CM.smoothstep(0.05, 0.45, nC.fbm2(x / 190 + 50, z / 190, 2));
      // climat : grandes zones aux bords déformés
      const wx = x + nB.noise2(x / 90, z / 90) * 28, wz = z + nB.noise2(x / 90 + 50, z / 90) * 28;
      const T = nD.fbm2(wx / 700, wz / 700, 2); // température
      const M = nE.fbm2(wx / 550 + 30, wz / 550, 2); // humidité
      const Wd = nF.fbm2(wx / 420, wz / 420, 2); // étrangeté (biomes rares)
      const hot = CM.smoothstep(0.14, 0.3, T);
      const cold = CM.smoothstep(-0.22, -0.38, T);
      const swampW = CM.smoothstep(0.28, 0.42, M) * (1 - hot) * (1 - cold) * (1 - mMask);
      const mesaW = CM.smoothstep(0.3, 0.42, Wd) * hot * CM.smoothstep(0.06, -0.06, M);
      let landH = SEA + 4 + cont * 6 + hills * 5 + ridge * mMask * 40;
      landH += (SEA + 1.3 + hills * 1.5 - landH) * swampW; // marais : au ras de l'eau
      if (mesaW > 0) {
        const plateau = CM.smoothstep(-0.05, 0.2, nC.noise2(x / 55, z / 55)) * 16;
        landH += mesaW * (plateau + 5);
        landH += (Math.floor(landH / 4) * 4 - landH) * mesaW; // terrasses
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

      // blocs de surface
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
        subB = -1; // bandes de terre cuite
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
      return { h, bi, topB, subB, subDepth, deepSub, frozen: cold > 0.5 };
    }

    // Couleur de terre cuite en bandes horizontales (canyons rouges).
    band(x, y, z) {
      const o = Math.floor(this.nC.noise2(x / 40, z / 40) * 3);
      return BANDS[(((y + o) % 16) + 16) % 16];
    }

    biomeName(x, z) {
      return BIOME_NAMES[this.column(Math.floor(x), Math.floor(z)).bi];
    }

    // ---------------------------------------------------------- arbres ----
    // Type d'arbre d'une colonne (déterministe) : null ou { type, big }.
    treeAt(x, z, info) {
      if (!CM.blocks[info.topB].soil && info.topB !== CM.B.GRASS) return null;
      if (info.h + 17 >= H) return null;
      const t = TREES[info.bi];
      if (!t || CM.hash3(x, 7, z, this.seed) >= t.p) return null;
      const k = CM.hash3(x, 8, z, this.seed);
      let acc = 0;
      for (const [type, w, big] of t.kinds) {
        acc += w;
        if (k < acc) return { type, big: big && CM.hash3(x, 9, z, this.seed) < big };
      }
      return null;
    }

    // Liste des blocs d'un arbre : [x, y, z, id, seulementDansLeVide].
    treeShape(type, big, x, y, z) {
      const Bk = CM.B, seed = this.seed;
      const w = CM.WOODS.find((v) => v.key === type);
      const LOG = w.log, LEAF = w.leaves;
      const hsh = (k) => CM.hash3(x, k, z, seed + 21);
      const out = [];
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
      out.push([x, y - 1, z, Bk.DIRT, false]);
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
        default: {
          // chêne et bouleau
          const tall = type === 'BIRCH' ? 5 : 4;
          th = (big ? 7 : tall) + Math.floor(hsh(1) * 3);
          for (let i = 0; i < th; i++) out.push([x, y + i, z, LOG, false]);
          blob(x, y + th, z, big ? 3 : 2, -3, 1);
        }
      }
      return out;
    }

    findSpawn() {
      for (let rad = 0; rad < 4000; rad += 3) {
        const n = rad === 0 ? 1 : 24;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = Math.round(Math.cos(a) * rad), z = Math.round(Math.sin(a) * rad);
          const info = this.column(x, z);
          if (CM.blocks[info.topB].soil && info.h > SEA + 1 && info.bi !== BIO.MOUNTAINS && !this.treeAt(x, z, info)) return { x: x + 0.5, y: info.h + 1, z: z + 0.5 };
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
      const Bk = CM.B;
      const c = new Chunk(cx, cz);
      const blocks = c.blocks, seed = this.seed;
      const x0 = c.x0, z0 = c.z0;
      const infos = new Array(256);

      // 1) colonnes : roche, sous-sol, surface, eau (ou glace)
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz;
          const info = this.column(x, z);
          infos[(lz << 4) | lx] = info;
          const deep = 14 + Math.floor(this.nC.noise2(x / 20, z / 20) * 3);
          const h = info.h;
          const subTop = h - info.subDepth;
          for (let y = 0; y < H; y++) {
            let id = 0;
            if (y === 0) id = Bk.BEDROCK;
            else if (y <= 2 && CM.hash3(x, y, z, seed + 11) < 0.55) id = Bk.BEDROCK;
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
            const x = x0 + gx * GS, y = gy * GS, z = z0 + gz * GS;
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
          for (let y = 3; y < h; y++) {
            const i = lidx(lx, y, lz);
            if (blocks[i] !== Bk.STONE) continue;
            const d = tri(gD, lx, y, lz), e = tri(gE, lx, y, lz);
            if (d > 0.52) blocks[i] = Bk.GRANITE;
            else if (d < -0.52) blocks[i] = Bk.DIORITE;
            else if (e > 0.55) blocks[i] = Bk.ANDESITE;
            else if (e < -0.6 && y < 60) blocks[i] = Bk.GRAVEL;
          }
          for (let y = 3; y <= maxY; y++) {
            const a = tri(gA, lx, y, lz);
            const b = tri(gB, lx, y, lz);
            let carve = a * a + b * b < 0.011;
            if (!carve && y < 34) carve = tri(gC, lx, y, lz) > 0.58 - (34 - y) * 0.004;
            if (carve) {
              const i = lidx(lx, y, lz);
              if (blocks[i] !== Bk.BEDROCK) blocks[i] = y <= 5 ? Bk.BEDROCK : 0;
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
                if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && y >= 0 && y < H) {
                  const i = lidx(lx, y, lz);
                  const cur = blocks[i];
                  if (ROCK[cur] && (cur !== Bk.DEEPSTONE || id !== Bk.COAL_ORE)) blocks[i] = id;
                }
                const r = rand();
                if (r < 0.33) x += rand() < 0.5 ? -1 : 1;
                else if (r < 0.66) z += rand() < 0.5 ? -1 : 1;
                else y += rand() < 0.5 ? -1 : 1;
              }
            }
          });
        }

      // 4) plantes (colonnes de ce tronçon sans arbre)
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const info = infos[(lz << 4) | lx];
          const h = info.h;
          if (h + 4 >= H || h <= SEA) continue;
          if (blocks[lidx(lx, h, lz)] !== info.topB || blocks[lidx(lx, h + 1, lz)] !== 0) continue;
          const x = x0 + lx, z = z0 + lz;
          if (this.treeAt(x, z, info)) continue;
          const table = PLANTS[info.bi];
          if (!table) continue;
          let p = CM.hash3(x, 13, z, seed);
          for (const [name, prob, n] of table) {
            if (p >= prob) {
              p -= prob;
              continue;
            }
            const id = Bk[name];
            if (id === Bk.CACTUS) {
              if (info.topB !== Bk.SAND && info.topB !== Bk.RED_SAND) break;
              const hh = 1 + Math.floor(CM.hash3(x, 14, z, seed) * (n || 3));
              for (let k = 1; k <= hh; k++) blocks[lidx(lx, h + k, lz)] = id;
            } else blocks[lidx(lx, h + 1, lz)] = id;
            break;
          }
        }

      // 5) arbres dont la couronne touche ce tronçon
      for (let z = z0 - 6; z < z0 + 22; z++)
        for (let x = x0 - 6; x < x0 + 22; x++) {
          if (CM.hash3(x, 7, z, seed) >= MAX_TREE_P) continue;
          const lx = x - x0, lz = z - z0;
          const inside = lx >= 0 && lx < 16 && lz >= 0 && lz < 16;
          const info = inside ? infos[(lz << 4) | lx] : this.column(x, z);
          const t = this.treeAt(x, z, info);
          if (t) this.placeTree(c, t.type, t.big, x, info.h + 1, z);
        }

      // 6) champignons rebond dans les grottes
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const h = infos[(lz << 4) | lx].h;
          const x = x0 + lx, z = z0 + lz;
          for (let y = 4; y < h - 6; y++) {
            const i = lidx(lx, y, lz);
            if (blocks[i] !== 0) continue;
            if (!ROCK[blocks[i - 256]]) continue;
            if (CM.hash3(x, y, z, seed + 9) < 0.012) {
              blocks[i] = Bk.MUSHROOM;
              if (CM.hash3(x, y, z, seed + 10) < 0.3 && blocks[i + 256] === 0) blocks[i + 256] = Bk.MUSHROOM;
            }
          }
        }

      // 7) îles célestes et ruines
      this.islandsFor(c);
      this.ruinsFor(c);

      // 8) modifications du joueur
      const e = this.edits.get(ckey(cx, cz));
      if (e) for (const [i, id] of e) blocks[i] = id;
      return c;
    }

    // Arbre découpé au tronçon c (seules les cases de c sont écrites).
    placeTree(c, type, big, x, y, z) {
      if (x + 5 < c.x0 || x - 5 > c.x0 + 15 || z + 5 < c.z0 || z - 5 > c.z0 + 15) return;
      for (const [X, Y, Z, id, onlyAir] of this.treeShape(type, big, x, y, z)) {
        const lx = X - c.x0, lz = Z - c.z0;
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || Y < 0 || Y >= H) continue;
        const i = lidx(lx, Y, lz);
        if (onlyAir) {
          const cur = c.blocks[i];
          if (cur !== 0 && !CM.blocks[cur].plant) continue;
        }
        c.blocks[i] = id;
      }
    }

    // ---------------------------------------------------------- ruines ----
    ruinAt(rx, rz) {
      const rand = CM.rng((CM.hash3(rx, 131, rz, this.seed) * 4294967296) >>> 0);
      if (rand() > 0.45) return null;
      const x = rx * RUIN_REGION + 12 + Math.floor(rand() * (RUIN_REGION - 24));
      const z = rz * RUIN_REGION + 12 + Math.floor(rand() * (RUIN_REGION - 24));
      const info = this.column(x, z);
      if (info.h <= SEA + 1 || info.bi === BIO.MOUNTAINS || info.bi === BIO.SWAMP) return null;
      return { x, z, y: info.h, bi: info.bi, seed: Math.floor(rand() * 1e9) };
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
          const mossy = ru.bi === BIO.JUNGLE || ru.bi === BIO.FOREST || ru.bi === BIO.CRYSTAL || ru.bi === BIO.BIRCH;
          const floorSet = sandy ? [Bk.SANDSTONE, Bk.SANDSTONE, Bk.CARVED_SANDSTONE] : [Bk.STONEBRICK, Bk.COBBLE, mossy ? Bk.MOSSY_STONEBRICK : Bk.STONEBRICK];
          const wallSet = sandy ? [Bk.SANDSTONE, Bk.CARVED_SANDSTONE, Bk.SANDSTONE] : [Bk.STONEBRICK, mossy ? Bk.MOSSY_STONEBRICK : Bk.COBBLE, mossy ? Bk.MOSSY_COBBLE : Bk.STONEBRICK];
          const pick = (set, X, Y, Z) => set[Math.floor(CM.hash3(X, Y, Z, ru.seed) * set.length)];
          const y0 = ru.y;
          for (let dz = -3; dz <= 3; dz++)
            for (let dx = -3; dx <= 3; dx++) {
              const X = ru.x + dx, Z = ru.z + dz;
              const lx = X - c.x0, lz = Z - c.z0;
              if (lx < 0 || lx > 15 || lz < 0 || lz > 15) continue;
              // fondations
              for (let y = y0 - 1; y > y0 - 7 && y > 0; y--) {
                const i = lidx(lx, y, lz);
                const cur = c.blocks[i];
                if (cur !== 0 && cur !== Bk.WATER && !CM.blocks[cur].plant) break;
                c.blocks[i] = Bk.COBBLE;
              }
              c.blocks[lidx(lx, y0, lz)] = pick(floorSet, X, y0, Z);
              for (let y = y0 + 1; y <= y0 + 5; y++) c.blocks[lidx(lx, y, lz)] = 0;
              const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
              const corner = Math.abs(dx) === 3 && Math.abs(dz) === 3;
              if (edge) {
                let hgt = corner ? 4 : Math.floor(CM.hash3(X, 1, Z, ru.seed) * 4);
                if (dx === 0 && dz === -3) hgt = 0; // entrée
                for (let y = 1; y <= hgt; y++) c.blocks[lidx(lx, y0 + y, lz)] = pick(wallSet, X, y0 + y, Z);
              }
              if (dx === 0 && dz === 0) c.blocks[lidx(lx, y0 + 1, lz)] = Bk.CHEST;
            }
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
      if (rand() < 0.6) {
        const r = 6 + rand() * 6;
        const x = rx * REGION + 24 + Math.floor(rand() * (REGION - 48));
        const z = rz * REGION + 24 + Math.floor(rand() * (REGION - 48));
        const y = 72 + Math.floor(rand() * 9);
        let ok = true;
        for (let dz = -r; dz <= r && ok; dz += 3)
          for (let dx = -r; dx <= r; dx += 3)
            if (this.column(Math.round(x + dx), Math.round(z + dz)).h > y - 22) {
              ok = false;
              break;
            }
        if (ok) {
          isl = { x, y, z, r, shards: [] };
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
          for (let dz = -R; dz <= R; dz++)
            for (let dx = -R; dx <= R; dx++) {
              const X = isl.x + dx, Z = isl.z + dz;
              const col = this.islandCol(isl, X, Z);
              if (!col) continue;
              tops.push([X, col.top, Z]);
              if (!inC(X, Z)) continue;
              for (let y = col.top - col.depth; y <= col.top; y++) {
                let id = B.SKYSTONE;
                if (y === col.top) id = B.GRASS;
                else if (y >= col.top - 2) id = B.DIRT;
                c.blocks[lidx(X - c.x0, y, Z - c.z0)] = id;
              }
            }
          for (const [X, Y, Z] of isl.shards) {
            if (!inC(X, Z)) continue;
            const i = lidx(X - c.x0, Y, Z - c.z0);
            if (c.blocks[i] === B.SKYSTONE) c.blocks[i] = B.SHARD_ORE;
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
    stream(px, pz, radius, budgetMs) {
      const t0 = performance.now();
      const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
      const cand = [];
      const r2 = (radius + 0.5) * (radius + 0.5);
      for (let dz = -radius; dz <= radius; dz++)
        for (let dx = -radius; dx <= radius; dx++) {
          const d2 = dx * dx + dz * dz;
          if (d2 > r2) continue;
          const cx = pcx + dx, cz = pcz + dz;
          if (Math.abs(cx) > LIMIT || Math.abs(cz) > LIMIT) continue;
          if (!this.chunks.has(ckey(cx, cz))) cand.push([d2, cx, cz]);
        }
      cand.sort((a, b) => a[0] - b[0]);
      let n = 0;
      for (const [d2, cx, cz] of cand) {
        if (d2 > 2 && n > 0 && performance.now() - t0 > budgetMs) break;
        this.addChunk(this.generateChunk(cx, cz));
        n++;
      }
      const u2 = (radius + 2.5) * (radius + 2.5);
      for (const c of this.chunks.values()) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > u2) this.removeChunk(c);
      }
      return cand.length - n;
    }

    // ----------------------------------------------------------- lumière --
    lightChunk(c) {
      const blocks = c.blocks, L = c.light, defs = CM.blocks, top = c.top;
      L.fill(0);
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          let y = H - 1;
          for (; y >= 0; y--) {
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
        return n ? n.top[((lz & 15) << 4) | (lx & 15)] : -1;
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
        for (let y = 0; y < H; y++)
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
      this.markDirty(c.x0 + (i & 15), i >> 8, c.z0 + ((i >> 4) & 15), 1);
    }
    markDirty(x, y, z, level) {
      const cx0 = (x - 1) >> 4, cx1 = (x + 1) >> 4;
      const cz0 = (z - 1) >> 4, cz1 = (z + 1) >> 4;
      const sy0 = Math.max(0, (y - 1) >> 4), sy1 = Math.min(SY - 1, (y + 1) >> 4);
      for (let cz = cz0; cz <= cz1; cz++)
        for (let cx = cx0; cx <= cx1; cx++)
          for (let sy = sy0; sy <= sy1; sy++) {
            const k = skey(cx, sy, cz);
            if ((this.dirty.get(k) || 0) < level) this.dirty.set(k, level);
          }
    }

    // Pose/retire un bloc et met à jour la lumière localement.
    setBlock(x, y, z, id) {
      if (y < 0 || y >= H) return false;
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
    editedPositions(id) {
      const out = [];
      for (const [k, m] of this.edits) {
        const cx = Math.floor(k / 0x10000) - 0x8000, cz = (k % 0x10000) - 0x8000;
        for (const [i, b] of m) if (b === id) out.push([cx * 16 + (i & 15), i >> 8, cz * 16 + ((i >> 4) & 15)]);
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
      for (let yy = Math.min(y, H - 1); yy > 0; yy--) {
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
        if (y >= 0 && y < H) {
          const id = this.get(x, y, z);
          if (id && filter(id)) return { x, y, z, nx, ny, nz, t, id };
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
