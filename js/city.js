'use strict';
// Monde « Ville » : un quadrillage de rues (asphalte, lignes jaunes, passages piétons, trottoirs,
// lampadaires, feux tricolores, bornes incendie, poubelles) entre des îlots de 36 × 36 blocs :
// gratte-ciel au centre, bureaux, immeubles, commerces, maisons avec jardin en périphérie,
// parcs avec fontaine, parkings, commissariat, station-service, place centrale.
// Chaque colonne se calcule seule (rien ne dépend de l'ordre de génération des tronçons).
// Sous la ville : roche et minerais. Butin des coffres, voitures garées, citadins.
(function () {
  const Wp = CM.World.prototype, Ep = CM.Entities.prototype;
  const { SEA, H, MINY } = CM.WORLD;
  const G = SEA + 4; // niveau de la rue (le bloc du sol)
  const P = 48, RW = 12, LOT = P - RW, OFF = 6; // période du quadrillage, largeur des rues, îlots
  const FH = 4; // hauteur d'un étage
  const TOPY = H - 3;
  const mod = (a, n) => ((a % n) + n) % n;
  const lidx = (lx, y, lz) => ((y - MINY) << 8) | (lz << 4) | lx;
  const BIO = CM.BIO;
  BIO.CITY = 31;
  BIO.CITY_PARK = 32;
  CM.BIOME_NAMES[31] = 'Ville';
  CM.BIOME_NAMES[32] = 'Parc';

  let K = null; // blocs, résolus au premier usage
  const blocks = () => {
    if (K) return K;
    const B = CM.B, pick = (...keys) => keys.map((k) => B[k]).find((v) => v !== undefined);
    const wood = (k) => CM.WOODS.find((w) => w.key === k) || CM.WOODS[0];
    K = {
      air: 0, stone: B.STONE, deep: pick('DEEPSTONE', 'STONE'), dirt: B.DIRT, grass: B.GRASS, bedrock: B.BEDROCK, water: B.WATER, gravel: B.GRAVEL,
      asphalt: B.ASPHALT, line: B.ASPHALT_LINE, yellow: B.ASPHALT_YELLOW, walk: B.SIDEWALK, manhole: B.MANHOLE,
      post: B.LAMP_POST, lamp: B.LAMP_HEAD, traffic: B.TRAFFIC_LIGHT, hydrant: B.FIRE_HYDRANT, bin: B.TRASH_BIN, bench: B.BENCH, pump: B.FUEL_PUMP,
      ladder: CM.blocks[B.LADDER].ladderSet[3], // (mur en +z)
      ladderN: CM.blocks[B.LADDER].ladderSet[2], // (mur en -z)
      smooth: B.SMOOTH_STONE, andesite: B.POLISHED_ANDESITE, stonebrick: B.STONEBRICK, bricks: B.BRICKS, quartz: B.QUARTZ_BLOCK, iron: B.IRON_BLOCK,
      glass: B.GLASS, seaLantern: B.SEA_LANTERN, glowstone: B.GLOWSTONE, lantern: B.LANTERN, chest: B.CHEST, table: B.TABLE, furnace: B.FURNACE, shelf: B.BOOKSHELF,
      c: (k) => B['CONCRETE_' + k], sg: (k) => B['STAINED_GLASS_' + k], tc: (k) => pick('TERRACOTTA_' + k, 'TERRACOTTA'), wool: (k) => B['WOOL_' + k],
      tinted: pick('TINTED_GLASS', 'STAINED_GLASS_BLACK'),
      oak: wood('OAK'), birch: wood('BIRCH'), cherry: wood('CHERRY'), spruce: wood('SPRUCE'), darkOak: wood('DARK_OAK'),
      flowers: ['DANDELION', 'TULIP', 'RED_TULIP', 'WHITE_TULIP', 'PINK_TULIP', 'FLOWER'].map((k) => B[k]).filter((v) => v !== undefined),
      ores: {
        coal: [B.COAL_ORE, B.DEEPSLATE_COAL_ORE], iron: [B.IRON_ORE, B.DEEPSLATE_IRON_ORE], copper: [B.COPPER_ORE, B.DEEPSLATE_COPPER_ORE], gold: [B.GOLD_ORE, B.DEEPSLATE_GOLD_ORE],
        redstone: [B.REDSTONE_ORE, B.DEEPSLATE_REDSTONE_ORE], lapis: [B.LAPIS_ORE, B.DEEPSLATE_LAPIS_ORE], diamond: [B.DIAMOND_ORE, B.DEEPSLATE_DIAMOND_ORE],
      },
    };
    return K;
  };

  const City = (CM.City = {
    G, P, RW, LOT, OFF,
    urban: () => true,
    cell: (x) => Math.floor((x + OFF) / P),
    // Coordonnées dans la maille : u, v (0..P-1) ; dans la rue si u < RW ou v < RW.
    uv: (x, z) => [mod(x + OFF, P), mod(z + OFF, P)],
  });

  // ------------------------------------------------------------ îlots --
  const TOWER_PAL = [
    ['QUARTZ', 'LIGHT_BLUE', 'SMOOTH'], ['BLACK', 'TINTED', 'SMOOTH'], ['WHITE', 'GLASS', 'SMOOTH'], ['GRAY', 'CYAN', 'ANDESITE'],
    ['LIGHT_GRAY', 'BLUE', 'SMOOTH'], ['IRON', 'LIGHT_GRAY', 'SMOOTH'], ['CYAN', 'LIGHT_BLUE', 'SMOOTH'], ['BLUE', 'LIGHT_BLUE', 'QUARTZ'],
  ];
  const WALL_PAL = ['BRICKS', 'ORANGE_TC', 'LIGHT_GRAY', 'WHITE_TC', 'STONEBRICK', 'BROWN_TC', 'YELLOW_TC', 'RED_TC', 'WHITE', 'CYAN_TC'];
  const SHOP_COLORS = ['RED', 'ORANGE', 'YELLOW', 'LIME', 'LIGHT_BLUE', 'MAGENTA', 'PINK', 'PURPLE', 'CYAN', 'BLUE'];
  const mat = (k) => {
    const B = blocks();
    if (k === 'QUARTZ') return B.quartz;
    if (k === 'IRON') return B.iron;
    if (k === 'BRICKS') return B.bricks;
    if (k === 'STONEBRICK') return B.stonebrick;
    if (k === 'SMOOTH') return B.smooth;
    if (k === 'ANDESITE') return B.andesite;
    if (k === 'GLASS') return B.glass;
    if (k === 'TINTED') return B.tinted;
    if (k.endsWith('_TC')) return B.tc(k.slice(0, -3));
    return B.c(k) !== undefined ? B.c(k) : B.smooth;
  };

  // Îlot (i, j) : type et paramètres, tirés au sort d'après la graine (et mis en cache).
  Wp.cityLot = function (i, j) {
    const cache = this.cityCache || (this.cityCache = new Map());
    const key = i + ',' + j;
    let lot = cache.get(key);
    if (lot) return lot;
    const r = CM.rng((CM.hash3(i, 7, j, this.seed + 4711) * 4294967296) >>> 0);
    // centre-ville dense autour de l'origine, puis quartiers moins hauts, puis la banlieue
    const dens = 1.25 - Math.hypot(i, j) / 8 + this.nB.fbm2(i / 5 + 31.3, j / 5 - 17.7, 2) * 0.55;
    let type;
    const k = r();
    if (i === 0 && j === 0) type = 'plaza';
    else if (i === 1 && j === 0) type = 'police';
    else if (i === 0 && j === 1) type = 'gas';
    else if (i === -1 && j === 0) type = 'parking';
    else if (dens > 0.8) type = k < 0.68 ? 'tower' : k < 0.8 ? 'office' : k < 0.88 ? 'plaza' : k < 0.95 ? 'parking' : 'shops';
    else if (dens > 0.35) type = k < 0.3 ? 'apartments' : k < 0.45 ? 'office' : k < 0.66 ? 'shops' : k < 0.75 ? 'park' : k < 0.83 ? 'parking' : k < 0.89 ? 'gas' : k < 0.93 ? 'police' : 'houses';
    else type = k < 0.62 ? 'houses' : k < 0.78 ? 'park' : k < 0.86 ? 'shops' : k < 0.91 ? 'gas' : k < 0.95 ? 'parking' : k < 0.97 ? 'police' : 'apartments';
    lot = { i, j, type, r: Math.floor(r() * 1e9) };
    const pal = TOWER_PAL[Math.floor(r() * TOWER_PAL.length)];
    const wallK = WALL_PAL[Math.floor(r() * WALL_PAL.length)];
    const box = (w, d) => {
      const x0 = Math.floor((LOT - w) / 2), z0 = Math.floor((LOT - d) / 2);
      return { x0, z0, x1: x0 + w, z1: z0 + d };
    };
    if (type === 'tower') {
      const w = 22 + Math.floor(r() * 9);
      lot.b = Object.assign(box(w, 22 + Math.floor(r() * 9)), {
        floors: Math.min(Math.floor((TOPY - 8 - G) / FH), 8 + Math.floor(r() * 7 + Math.max(0, dens - 0.8) * 6)),
        wall: mat(pal[0]), frame: mat(pal[0]), glass: pal[1] === 'GLASS' || pal[1] === 'TINTED' ? mat(pal[1]) : blocks().sg(pal[1]), floor: mat(pal[2]),
        light: blocks().seaLantern, roof: blocks().smooth, win: 'curtain', door: true, antenna: r() < 0.5, heli: r() < 0.25,
      });
    } else if (type === 'office' || type === 'apartments') {
      const office = type === 'office';
      lot.b = Object.assign(box(20 + Math.floor(r() * 9), 18 + Math.floor(r() * 9)), {
        floors: office ? 5 + Math.floor(r() * 5) : 4 + Math.floor(r() * 4),
        wall: office ? mat(pal[0]) : mat(wallK), frame: office ? mat(pal[0]) : mat(wallK === 'WHITE' ? 'LIGHT_GRAY' : 'STONEBRICK'),
        glass: office ? blocks().sg(pal[1] === 'GLASS' || pal[1] === 'TINTED' ? 'LIGHT_BLUE' : pal[1]) : blocks().glass,
        floor: office ? mat(pal[2]) : blocks().oak.planks, light: office ? blocks().seaLantern : blocks().glowstone, roof: blocks().smooth, win: office ? 'curtain' : 'rows', door: true,
      });
    } else if (type === 'shops') {
      const col = SHOP_COLORS[Math.floor(r() * SHOP_COLORS.length)];
      lot.b = Object.assign({ x0: 2, z0: 3, x1: LOT - 2, z1: LOT - 6 }, {
        floors: 2 + (r() < 0.4 ? 1 : 0), wall: blocks().c(col) !== undefined ? mat(col) : mat(wallK), frame: mat('WHITE'), glass: blocks().glass,
        floor: blocks().smooth, light: blocks().glowstone, roof: blocks().smooth, win: 'shop', door: true, awning: blocks().wool(col === 'WHITE' ? 'RED' : col) || blocks().wool('RED'),
      });
    } else if (type === 'police') {
      lot.b = { x0: 4, z0: 17, x1: 32, z1: 33, floors: 2, wall: mat('WHITE'), frame: mat('BLUE'), glass: blocks().sg('LIGHT_BLUE'), floor: blocks().smooth, light: blocks().seaLantern, roof: blocks().smooth, win: 'rows', door: true };
    } else if (type === 'gas') {
      lot.b = { x0: 12, z0: 25, x1: 25, z1: 33, floors: 1, wall: mat('WHITE'), frame: mat('RED'), glass: blocks().glass, floor: blocks().smooth, light: blocks().seaLantern, roof: blocks().smooth, win: 'shop', door: true };
    } else if (type === 'houses') {
      lot.houses = [0, 1, 2, 3].map((q) => {
        const rr = CM.rng((CM.hash3(i * 4 + q, 9, j, this.seed + 999) * 4294967296) >>> 0);
        const walls = [blocks().oak.planks, blocks().bricks, mat('WHITE'), mat('ORANGE_TC'), blocks().birch.planks, mat('LIGHT_GRAY'), blocks().spruce.planks, mat('YELLOW_TC')];
        const roofs = [blocks().darkOak.planks, mat('RED_TC'), blocks().spruce.planks, mat('GRAY'), mat('BROWN_TC'), blocks().bricks];
        return { wall: walls[Math.floor(rr() * walls.length)], roof: roofs[Math.floor(rr() * roofs.length)], floors: rr() < 0.45 ? 2 : 1, tree: rr() < 0.8, pool: rr() < 0.15, w: 9 + Math.floor(rr() * 3), d: 7 + Math.floor(rr() * 2), r: Math.floor(rr() * 1e9) };
      });
    } else if (type === 'park') {
      lot.trees = [];
      for (let n = 0; n < 16; n++) {
        const tx = 2 + Math.floor(r() * 32), tz = 2 + Math.floor(r() * 32);
        if ((tx > 13 && tx < 22) || (tz > 13 && tz < 22)) continue; // (pas sur les allées)
        if (lot.trees.some((t) => Math.abs(t[0] - tx) < 5 && Math.abs(t[1] - tz) < 5)) continue;
        lot.trees.push([tx, tz, [blocks().oak, blocks().birch, blocks().cherry][Math.floor(r() * 3)], 4 + Math.floor(r() * 2)]);
      }
    }
    cache.set(key, lot);
    return lot;
  };
  // Îlot et coordonnées locales (ou null dans la rue).
  Wp.cityLotAt = function (x, z) {
    const [u, v] = City.uv(x, z);
    if (u < RW || v < RW) return null;
    return { lot: this.cityLot(City.cell(x), City.cell(z)), lx: u - RW, lz: v - RW };
  };

  // Colonne pour le reste du jeu (biome, hauteur, bloc de surface).
  Wp.cityColumn = function (x, z) {
    const B = blocks(), at = this.cityLotAt(x, z);
    const park = at && at.lot.type === 'park';
    return { h: G, bi: park ? BIO.CITY_PARK : BIO.CITY, topB: park || (at && at.lot.type === 'houses') ? B.grass : at ? B.smooth : B.asphalt, subB: B.dirt, subDepth: 3, deepSub: 0, frozen: false, flat: true, city: true };
  };

  // ------------------------------------------------------- génération --
  Wp.fillCity = function (c) {
    const B = blocks(), bl = c.blocks, seed = this.seed;
    for (let lz = 0; lz < 16; lz++)
      for (let lx = 0; lx < 16; lx++) {
        const x = c.x0 + lx, z = c.z0 + lz;
        const set = (y, id) => {
          if (y >= MINY && y < H) bl[lidx(lx, y, lz)] = id;
        };
        // sous-sol : socle, roche des abîmes, roche et minerais, terre
        for (let y = MINY; y < G; y++) {
          let id;
          if (y === MINY || (y <= MINY + 2 && CM.hash3(x, y, z, seed + 11) < 0.55)) id = B.bedrock;
          else if (y >= G - 3) id = B.dirt;
          else {
            id = y < 0 ? B.deep : B.stone;
            const h = CM.hash3(x >> 1, y >> 1, z >> 1, seed + 77);
            if (h < 0.045 && CM.hash3(x, y, z, seed + 78) < 0.7) {
              const d = y < 0 ? 1 : 0, O = B.ores;
              const ore = h < 0.014 && y > -10 ? O.coal : h < 0.024 && y < 34 ? O.iron : h < 0.029 && y > -10 && y < 34 ? O.copper : h < 0.032 && y < 12 ? O.gold : h < 0.037 && y < 2 ? O.redstone : h < 0.039 && y < 8 ? O.lapis : h < 0.0415 && y < -18 ? O.diamond : null;
              if (ore && ore[d] !== undefined) id = ore[d];
            }
          }
          bl[lidx(lx, y, lz)] = id;
        }
        const [u, v] = City.uv(x, z);
        if (u < RW || v < RW) this.cityRoad(u, v, x, z, set, B);
        else this.cityLotCol(this.cityLot(City.cell(x), City.cell(z)), u - RW, v - RW, x, z, set, B);
      }
    return c;
  };

  // Rues : asphalte, lignes, passages piétons, trottoirs et leur mobilier.
  Wp.cityRoad = function (u, v, x, z, set, B) {
    const side = (a) => a < 2 || a >= RW - 2;
    const hsh = (k) => CM.hash3(x, k, z, this.seed + 5150);
    for (let y = G - 3; y < G; y++) set(y, B.stone); // (pas de terre sous la chaussée)
    const inX = u < RW, inZ = v < RW;
    if (inX && inZ) {
      // carrefour : trottoirs aux quatre coins, feux tricolores
      if (side(u) && side(v)) {
        set(G, B.walk);
        if ((u === 1 || u === RW - 2) && (v === 1 || v === RW - 2)) {
          set(G + 1, B.post);
          set(G + 2, B.post);
          set(G + 3, B.traffic);
        }
      } else set(G, B.asphalt);
      return;
    }
    // a : travers de la rue (0..RW-1) ; s : le long de la rue (RW..P-1)
    const a = inX ? u : v, s = inX ? v : u;
    if (side(a)) {
      set(G, B.walk);
      // lampadaires côté chaussée, tous les 16 blocs, en quinconce
      const curb = a === 1 || a === RW - 2;
      if (curb && mod(s - RW - 8, 16) === 0 && (a === 1) === (mod(s - RW - 8, 32) === 0)) {
        for (let y = G + 1; y <= G + 4; y++) set(y, B.post);
        set(G + 5, B.lamp);
      } else if ((a === 0 || a === RW - 1) && s > RW + 2 && s < P - 3) {
        const h = hsh(3);
        if (h < 0.012) set(G + 1, B.hydrant);
        else if (h < 0.026) set(G + 1, B.bin);
        else if (h < 0.034) set(G + 1, B.bench);
      }
      return;
    }
    const crossing = s < RW + 3 || s >= P - 3;
    if (crossing) set(G, a % 2 === 0 ? B.line : B.asphalt); // passage piéton
    else if (a === 5 || a === 6) set(G, mod(s, 6) < 4 ? B.yellow : B.asphalt); // ligne médiane discontinue
    else set(G, hsh(1) < 0.004 ? B.manhole : B.asphalt);
  };

  // Un immeuble (étages, façades, planchers, lampes, échelle jusqu'au toit, mobilier).
  function building(w, set, lx, lz, b, B, rseed) {
    if (lx < b.x0 || lx >= b.x1 || lz < b.z0 || lz >= b.z1) return false;
    const top = G + b.floors * FH;
    const ex = lx === b.x0 || lx === b.x1 - 1, ez = lz === b.z0 || lz === b.z1 - 1, edge = ex || ez, corner = ex && ez;
    const along = ex ? lz - b.z0 : lx - b.x0, len = ex ? b.z1 - b.z0 : b.x1 - b.x0, mid = Math.floor(len / 2);
    // échelle : dans un coin intérieur, contre un pilier
    const lad = [b.x0 + 2, b.z0 + 2];
    const isLad = lx === lad[0] && lz === lad[1], isPil = lx === lad[0] && lz === lad[1] + 1;
    set(G, b.floor);
    for (let y = G + 1; y <= top; y++) {
      const k = y - G - 1, fy = k % FH, lvl = Math.floor(k / FH);
      const slab = fy === FH - 1;
      let id = 0;
      if (edge) {
        if (slab || corner) id = b.frame;
        else if (lvl === 0 && fy < 2 && b.door && Math.abs(along - mid) <= 1 && (ez || b.win === 'shop')) id = 0; // entrées
        else if (b.win === 'curtain') id = along % 5 === 0 ? b.frame : b.glass;
        else if (b.win === 'shop' && lvl === 0) id = along % 6 === 0 ? b.frame : b.glass;
        else id = (fy === 1 || fy === 2) && along % 3 !== 0 ? b.glass : b.wall;
      } else if (isLad) id = B.ladder;
      else if (isPil) id = b.frame;
      else if (slab) {
        const light = (lx - b.x0) % 6 === 3 && (lz - b.z0) % 6 === 3;
        id = y === top ? b.roof : light ? b.light : b.floor;
      } else if (fy === 0 && lvl >= 0) {
        // mobilier près des murs (coffres de butin, établi, fourneau, étagères)
        const h = CM.hash3(lx, lvl, lz, rseed);
        const nearWall = lx === b.x0 + 1 || lx === b.x1 - 2 || lz === b.z0 + 1 || lz === b.z1 - 2;
        if (nearWall && !(Math.abs(along - mid) <= 2)) {
          if (h < 0.035) id = B.chest;
          else if (h < 0.06) id = B.shelf;
          else if (h < 0.07) id = B.table;
          else if (h < 0.078) id = B.furnace;
        }
      }
      set(y, id);
    }
    // toit : parapet, échelle qui sort, antenne ou héliport
    if (edge) set(top + 1, b.frame);
    if (isLad) set(top + 1, 0);
    const cx = (b.x0 + b.x1) >> 1, cz = (b.z0 + b.z1) >> 1;
    if (b.antenna && lx === cx && lz === cz) {
      for (let y = top + 1; y <= Math.min(TOPY, top + 8); y++) set(y, B.post);
      set(Math.min(TOPY, top + 9), B.lamp);
    } else if (b.heli && Math.abs(lx - cx) <= 3 && Math.abs(lz - cz) <= 3) {
      // héliport : un H jaune sur fond gris
      const dx = lx - cx, dz = lz - cz;
      const hmark = (Math.abs(dx) === 2 && Math.abs(dz) <= 2) || (dz === 0 && Math.abs(dx) <= 2);
      set(top, hmark ? B.c('YELLOW') : B.c('GRAY'));
    } else if (!edge && (lx * 7 + lz * 3) % 23 === 0 && !isLad) set(top + 1, B.iron); // climatiseurs
    return true;
  }

  // Arbre (tronc + houppier) : bloc de la colonne (dx, dz) du tronc, à la hauteur y, ou -1.
  function treeBlock(dx, dz, y, base, wood, th) {
    if (dx === 0 && dz === 0 && y > base && y <= base + th) return wood.log;
    const cy = base + th;
    const d2 = dx * dx + dz * dz + (y - cy) * (y - cy) * 1.2;
    if (d2 <= 5.5 && y >= cy - 1 && y <= cy + 2 && !(dx === 0 && dz === 0 && y <= cy)) return wood.leaves;
    return -1;
  }

  Wp.cityLotCol = function (lot, lx, lz, x, z, set, B) {
    const hsh = (k) => CM.hash3(x, k, z, this.seed + 6060 + lot.r % 1000);
    const lamp = () => {
      for (let y = G + 1; y <= G + 4; y++) set(y, B.post);
      set(G + 5, B.lamp);
    };
    switch (lot.type) {
      case 'tower':
      case 'office':
      case 'apartments': {
        if (building(this, set, lx, lz, lot.b, B, lot.r)) return;
        // parvis : dalles et jardinières
        const b = lot.b, planter = (lx < b.x0 - 1 || lx > b.x1) && (lz < b.z0 - 1 || lz > b.z1);
        if (planter && lot.type !== 'tower') {
          set(G, B.grass);
          if (hsh(1) < 0.06 && B.flowers.length) set(G + 1, B.flowers[Math.floor(hsh(2) * B.flowers.length)]);
        } else set(G, (lx + lz) % 2 ? B.smooth : B.andesite);
        if ((lx === 1 || lx === LOT - 2) && (lz === 1 || lz === LOT - 2)) lamp();
        return;
      }
      case 'shops': {
        const b = lot.b;
        if (building(this, set, lx, lz, b, B, lot.r)) return;
        set(G, B.walk);
        // auvent au-dessus de la vitrine (côté -z et côté +z)
        if ((lz === b.z0 - 1 || lz === b.z1) && lx >= b.x0 && lx < b.x1) set(G + 4, b.awning);
        return;
      }
      case 'police': {
        if (building(this, set, lx, lz, lot.b, B, lot.r)) return;
        // parking devant le commissariat
        set(G, lz >= 2 && lz <= 13 && lx % 4 === 0 && (lz <= 6 || lz >= 9) ? B.line : B.asphalt);
        if (lz === 15 && (lx === 2 || lx === 33)) lamp();
        return;
      }
      case 'gas': {
        if (building(this, set, lx, lz, lot.b, B, lot.r)) return;
        set(G, B.asphalt);
        // auvent sur piliers au-dessus des pompes
        const inC = lx >= 6 && lx <= 29 && lz >= 6 && lz <= 19;
        const pillar = (lx === 6 || lx === 29 || lx === 18) && (lz === 6 || lz === 19);
        if (pillar) for (let y = G + 1; y <= G + 4; y++) set(y, B.c('WHITE'));
        if (inC) set(G + 5, lx === 6 || lx === 29 || lz === 6 || lz === 19 ? B.c('RED') : (lx % 4 === 0 && lz % 4 === 0 ? B.seaLantern : B.c('WHITE')));
        if (lz === 12 && (lx === 10 || lx === 15 || lx === 21 || lx === 26)) set(G + 1, B.pump);
        return;
      }
      case 'parking': {
        const stall = (lz >= 2 && lz <= 8) || (lz >= 27 && lz <= 33);
        set(G, stall && lx % 4 === 0 ? B.line : B.asphalt);
        if ((lx === 1 || lx === LOT - 2) && lz === 18) lamp();
        return;
      }
      case 'plaza':
      case 'park': {
        const plaza = lot.type === 'plaza';
        const cx = LOT / 2 - 0.5, cz = LOT / 2 - 0.5, dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
        const path = plaza || Math.abs(dx) < 2 || Math.abs(dz) < 2 || (d > 6.5 && d < 8.5);
        set(G, plaza ? ((lx >> 1) + (lz >> 1)) % 2 ? B.smooth : B.andesite : path ? B.gravel : B.grass);
        // fontaine au centre
        if (d < 5.5) {
          if (d > 4.6) set(G + 1, B.stonebrick);
          else {
            set(G, B.water);
            set(G - 1, B.stonebrick);
            if (d < 1) {
              set(G, B.stonebrick);
              set(G + 1, B.stonebrick);
              set(G + 2, B.lamp);
            }
          }
          return;
        }
        // bancs autour de la fontaine, lampadaires
        if (Math.abs(d - 7.5) < 0.5 && (Math.abs(dx) < 0.6 || Math.abs(dz) < 0.6) === false && hsh(4) < 0.18) set(G + 1, B.bench);
        if ((lx === 2 || lx === LOT - 3) && (lz === 2 || lz === LOT - 3)) {
          lamp();
          return;
        }
        if (plaza) {
          // arbres en bacs aux quatre coins
          for (const [tx, tz] of [[7, 7], [28, 7], [7, 28], [28, 28]]) {
            const ddx = lx - tx, ddz = lz - tz;
            if (Math.abs(ddx) <= 1 && Math.abs(ddz) <= 1) set(G, B.grass);
            if (Math.abs(ddx) === 2 && Math.abs(ddz) <= 2 || Math.abs(ddz) === 2 && Math.abs(ddx) <= 2) set(G + 1, B.stonebrick);
            for (let y = G + 1; y <= G + 8; y++) {
              const t = treeBlock(ddx, ddz, y, G, B.oak, 4);
              if (t >= 0) set(y, t);
            }
          }
          return;
        }
        // parc : arbres, fleurs
        let tree = false;
        for (const [tx, tz, wood, th] of lot.trees) {
          const ddx = lx - tx, ddz = lz - tz;
          if (Math.abs(ddx) > 2 || Math.abs(ddz) > 2) continue;
          for (let y = G + 1; y <= G + th + 3; y++) {
            const t = treeBlock(ddx, ddz, y, G, wood, th);
            if (t >= 0) {
              set(y, t);
              tree = true;
            }
          }
        }
        if (!tree && !path && hsh(5) < 0.07 && B.flowers.length) set(G + 1, B.flowers[Math.floor(hsh(6) * B.flowers.length)]);
        return;
      }
      case 'houses': {
        // quatre parcelles de 18 × 18 : jardin devant, maison, arbre derrière, haie
        const q = (lx >= 18 ? 1 : 0) + (lz >= 18 ? 2 : 0), h = lot.houses[q];
        const LAD = lz >= 18 ? B.ladderN : B.ladder; // (parcelle retournée : l'échelle aussi)
        const hx = lx % 18, hz0 = lz % 18, hz = lz >= 18 ? 17 - hz0 : hz0; // (porte côté rue)
        set(G, B.grass);
        const bx0 = Math.floor((18 - h.w) / 2), bx1 = bx0 + h.w, bz0 = 5, bz1 = bz0 + h.d;
        const doorX = (bx0 + bx1) >> 1;
        // allée jusqu'à la porte
        if (hz < bz0 && (hx === doorX || hx === doorX - 1)) {
          set(G, B.walk);
          return;
        }
        // haie autour de la parcelle (sauf l'allée)
        if (hx === 0 || hx === 17 || hz === 17) {
          set(G + 1, B.oak.leaves);
          return;
        }
        if (hx >= bx0 && hx < bx1 && hz >= bz0 && hz < bz1) {
          const top = G + h.floors * FH;
          const ex = hx === bx0 || hx === bx1 - 1, ez = hz === bz0 || hz === bz1 - 1, edge = ex || ez;
          const along = ex ? hz - bz0 : hx - bx0;
          set(G, B.oak.planks);
          for (let y = G + 1; y <= top; y++) {
            const k = y - G - 1, fy = k % FH, lvl = Math.floor(k / FH);
            let id = 0;
            if (edge) {
              if (fy === FH - 1 || (ex && ez)) id = h.wall;
              else if (lvl === 0 && hz === bz0 && (hx === doorX || hx === doorX - 1) && fy < 2) id = 0; // porte
              else id = (fy === 1 || fy === 2) && along % 3 === 1 ? B.glass : h.wall;
            } else if (fy === FH - 1) id = hx === bx0 + 1 && hz === bz1 - 2 ? LAD : hx === ((bx0 + bx1) >> 1) && hz === ((bz0 + bz1) >> 1) ? B.glowstone : B.oak.planks;
            else if (hx === bx0 + 1 && hz === bz1 - 2 && h.floors > 1) id = LAD; // échelle vers l'étage
            else if (fy === 0) {
              // coffre, établi, fourneau, bibliothèque
              if (hx === bx1 - 2 && hz === bz1 - 2) id = lvl === 0 ? B.chest : B.shelf;
              else if (hx === bx1 - 3 && hz === bz1 - 2 && lvl === 0) id = B.table;
              else if (hx === bx1 - 4 && hz === bz1 - 2 && lvl === 0) id = B.furnace;
            }
            // (l'échelle s'appuie sur le mur du fond)
            if (hx === bx0 + 1 && hz === bz1 - 2 && h.floors === 1 && fy === FH - 1) id = B.oak.planks;
            set(y, id);
          }
          // toit à deux pans (faîte le long de x)
          for (let k2 = 0; k2 <= (h.d >> 1); k2++) {
            const y = top + 1 + k2, a = bz0 + k2, bb = bz1 - 1 - k2;
            if (a > bb) break;
            if (hz === a || hz === bb) set(y, h.roof);
            else if (hz > a && hz < bb && ex) set(y, h.wall);
          }
          return;
        }
        // débord du toit (devant et derrière)
        if (hx >= bx0 && hx < bx1 && (hz === bz0 - 1 || hz === bz1)) set(G + h.floors * FH + 1, h.roof);
        // arbre au fond du jardin, fleurs, parfois une piscine
        if (h.tree) {
          const ddx = hx - 3, ddz = hz - 14;
          if (Math.abs(ddx) <= 2 && Math.abs(ddz) <= 2) {
            for (let y = G + 1; y <= G + 8; y++) {
              const t = treeBlock(ddx, ddz, y, G, B.oak, 4);
              if (t >= 0) set(y, t);
            }
            return;
          }
        }
        if (h.pool && hx >= 11 && hx <= 15 && hz >= 13 && hz <= 15) {
          set(G, B.water);
          set(G - 1, B.c('LIGHT_BLUE') || B.stone);
          return;
        }
        if (hsh(7) < 0.05 && B.flowers.length) set(G + 1, B.flowers[Math.floor(hsh(8) * B.flowers.length)]);
        return;
      }
    }
  };

  // ------------------------------------------------------------ butin --
  City.fillLoot = function (g, slots, x, y, z) {
    const w = g.world;
    if (w.type !== 'city') return false;
    const at = w.cityLotAt(x, z), type = at ? at.lot.type : 'houses';
    const r = CM.rng((CM.hash3(x, y, z, w.seed + 31337) * 4294967296) >>> 0), I = CM.I, B = CM.B;
    const out = [];
    const add = (id, a, b, p) => {
      if (id !== undefined && r() < (p === undefined ? 1 : p)) out.push({ id, count: a + Math.floor(r() * (b - a + 1)) });
    };
    const guns = CM.extOn('guns'), veh = CM.extOn('vehicles');
    if (type === 'police') {
      if (guns) {
        add([I.PISTOL, I.SHOTGUN, I.RIFLE, I.SMG][Math.floor(r() * 4)], 1, 1, 0.7);
        add(I.AMMO_PISTOL, 8, 24, 0.9);
        add(I.AMMO_SHELL, 4, 10, 0.5);
        add(I.AMMO_RIFLE, 6, 20, 0.5);
        add(I.GRENADE, 1, 3, 0.25);
      } else {
        add(I.SWORD_IRON, 1, 1, 0.5);
        add(I.BOW, 1, 1, 0.4);
        add(I.ARROW, 6, 16, 0.8);
      }
      add(I.HELMET_IRON, 1, 1, 0.3);
      add(I.CHESTPLATE_IRON, 1, 1, 0.25);
      add(I.SHIELD, 1, 1, 0.3);
      add(I.BREAD, 2, 5, 0.7);
      add(I.COMPASS, 1, 1, 0.3);
    } else if (type === 'gas') {
      if (veh) add(I.FUEL_CAN, 1, 4, 0.9);
      add(I.COAL, 4, 12, 0.8);
      add(I.COOKIE, 2, 6, 0.6);
      add(I.BREAD, 1, 3, 0.6);
      add(I.MAP, 1, 1, 0.2);
    } else if (type === 'shops') {
      for (let n = 0; n < 5; n++) {
        const pool = [[I.BREAD, 2, 6], [I.APPLE, 2, 6], [I.COOKED_MEAT, 1, 4], [I.PAPER, 3, 9], [I.BOOK, 1, 3], [B.GLASS, 4, 12], [B.TORCH, 4, 16], [I.STRING, 2, 6], [I.SUGAR, 2, 6], [I.CARROT, 2, 6], [I.POTATO, 2, 6], [I.IRON_INGOT, 1, 4], [I.GOLD_INGOT, 1, 3], [I.EMERALD, 1, 3]];
        const [id, a, b] = pool[Math.floor(r() * pool.length)];
        add(id, a, b);
      }
      const dyes = Object.values(CM.DYE_ITEM);
      add(dyes[Math.floor(r() * dyes.length)], 1, 4, 0.5);
    } else if (type === 'tower' || type === 'office') {
      add(I.PAPER, 4, 12, 0.9);
      add(I.BOOK, 1, 3, 0.5);
      add(I.REDSTONE, 2, 8, 0.5);
      add(I.IRON_INGOT, 1, 5, 0.5);
      add(I.GOLD_INGOT, 1, 4, 0.35);
      add(I.EMERALD, 1, 3, 0.3);
      add(I.DIAMOND, 1, 2, 0.12);
      add(I.COMPASS, 1, 1, 0.15);
      add(I.COOKIE, 1, 4, 0.4);
    } else {
      // appartements et maisons
      add(I.BREAD, 1, 4, 0.7);
      add(I.APPLE, 1, 4, 0.5);
      add(I.COOKED_MEAT, 1, 3, 0.4);
      add(I.CARROT, 1, 4, 0.3);
      add(I.POTATO, 1, 4, 0.3);
      add(B.TORCH, 2, 8, 0.5);
      add(I.COAL, 2, 6, 0.4);
      add(I.STRING, 1, 4, 0.3);
      add(I.SEEDS, 2, 6, 0.3);
      add(I.IRON_INGOT, 1, 3, 0.3);
      add(I.BOOK, 1, 2, 0.2);
      add(I.EMERALD, 1, 2, 0.15);
      add(I.DIAMOND, 1, 1, 0.04);
      if (guns) add(I.AMMO_PISTOL, 2, 8, 0.15);
    }
    const free = [...Array(slots.length).keys()];
    for (const it of out) {
      if (!free.length) break;
      if (CM.hasWear(it.id)) it.xp = 0;
      slots[free.splice(Math.floor(r() * free.length), 1)[0]] = it;
    }
    return true;
  };

  // --------------------------------------------------- créatures, voitures --
  // Citadins le jour sur les trottoirs ; animaux dans les parcs.
  const spawn0 = Ep.spawnAround;
  Ep.spawnAround = function (p, w, r, nightfall) {
    spawn0.call(this, p, w, r, nightfall);
    if (w.type !== 'city' || !p.alive) return;
    const g = this.game;
    let n = 0;
    for (const m of this.mobs) if (!m.dead && m.type === 'citizen' && Math.hypot(m.x - p.x, m.z - p.z) < 64) n++;
    const max = g.daylight > 0.45 ? 10 : 3;
    if (n >= max || r() > 0.6) return;
    for (let t = 0; t < 6; t++) {
      const a = r() * Math.PI * 2, d = 14 + r() * 30;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.loaded(x, z) || w.get(x, G, z) !== CM.B.SIDEWALK || w.solidAt(x, G + 1, z) || w.solidAt(x, G + 2, z)) continue;
      this.addMob('citizen', x + 0.5, G + 1, z + 0.5);
      return;
    }
  };
  const animal0 = Ep.animalFor;
  Ep.animalFor = function (bi) {
    if (bi === BIO.CITY_PARK) return this.rand() < 0.5 ? 'chicken' : 'rabbit';
    if (bi === BIO.CITY) return null;
    return animal0.call(this, bi);
  };
  // Voitures garées dans les parkings, au commissariat et à la station-service (extension Véhicules).
  City.tick = function (g, dt) {
    if (g.world.type !== 'city' || g.dim !== 'overworld' || !CM.extOn('vehicles')) return;
    City.t = (City.t || 0) - dt;
    if (City.t > 0) return;
    City.t = 2;
    const w = g.world, done = g.cityLots || (g.cityLots = new Set());
    const pls = g.entities.plist.filter((q) => q.alive !== false);
    for (const q of pls) {
      const ci = City.cell(q.x), cj = City.cell(q.z);
      for (let di = -2; di <= 2; di++)
        for (let dj = -2; dj <= 2; dj++) {
          const i = ci + di, j = cj + dj, key = i + ',' + j;
          if (done.has(key)) continue;
          const lot = w.cityLot(i, j);
          if (lot.type !== 'parking' && lot.type !== 'police' && lot.type !== 'gas') {
            done.add(key);
            continue;
          }
          const bx = i * P - OFF + RW, bz = j * P - OFF + RW; // coin de l'îlot
          if (!w.loaded(bx, bz) || !w.loaded(bx + LOT - 1, bz + LOT - 1)) continue;
          done.add(key);
          const r = CM.rng((CM.hash3(i, 3, j, w.seed + 8080) * 4294967296) >>> 0);
          const spots = [];
          if (lot.type === 'parking') for (let s = 0; s < 8; s++) spots.push([2 + Math.floor(r() * 8) * 4, r() < 0.5 ? 5 : 30, r() < 0.5 ? 0 : Math.PI]);
          else if (lot.type === 'police') for (let s = 0; s < 3; s++) spots.push([2 + s * 8, 4, 0]);
          else spots.push([8 + Math.floor(r() * 3) * 7, 12, Math.PI / 2]);
          const used = new Set();
          for (const [sx, sz, yaw] of spots) {
            if (used.has(sx + ',' + sz)) continue;
            used.add(sx + ',' + sz);
            const k = r();
            const type = lot.type === 'police' ? 'police' : k < 0.55 ? 'car' : k < 0.66 ? 'sport' : k < 0.77 ? 'jeep' : k < 0.85 ? 'truck' : k < 0.93 ? 'moto' : 'quad';
            const colors = CM.DYES.map((d) => d.key);
            g.entities.addCart(type, bx + sx + 0.5, G + 1.01, bz + sz + 0.5, { yaw, fuel: 20 + Math.floor(r() * 60), color: colors[Math.floor(r() * colors.length)] });
          }
        }
    }
  };
})();
