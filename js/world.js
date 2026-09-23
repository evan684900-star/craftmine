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

  const VEINS = [
    // [bloc, filons par tronçon, y min, y max, longueur]
    ['COAL_ORE', 8.6, 8, 76, 9],
    ['IRON_ORE', 5.1, 4, 50, 6],
    ['CRYSTAL_ORE', 1.25, 3, 19, 5],
  ];

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
      const { nA, nB, nC, nD, nE } = this;
      const cont = nA.fbm2(x / 320, z / 320, 4);
      const land = CM.smoothstep(-0.22, 0.02, cont);
      const hills = nA.fbm2(x / 46 + 100, z / 46 - 50, 4);
      let ridge = 1 - Math.abs(nB.noise2(x / 95, z / 95));
      ridge *= ridge;
      const mMask = CM.smoothstep(0.05, 0.45, nC.fbm2(x / 190 + 50, z / 190, 2));
      const landH = SEA + 4 + cont * 6 + hills * 5 + ridge * mMask * 40;
      const seaH = SEA - 7 + cont * 8 + hills * 2;
      const h = Math.floor(CM.clamp(seaH + (landH - seaH) * land, 4, 84));
      const temp = nD.fbm2(x / 140, z / 140, 2);
      const forest = nE.fbm2(x / 70, z / 70, 2);
      let bi = 0; // 0 plaine, 1 désert, 2 forêt, 3 montagne
      if (h > 62) bi = 3;
      else if (temp > 0.3) bi = 1;
      else if (forest > 0.12) bi = 2;
      const B = CM.B;
      const snowLine = 66 + Math.floor(nD.noise2(x / 12, z / 12) * 3);
      let topB, subB;
      if (h < SEA - 4) { topB = B.DIRT; subB = B.DIRT; }
      else if (h <= SEA + 1) { topB = B.SAND; subB = B.SAND; }
      else if (bi === 1) { topB = B.SAND; subB = B.SAND; }
      else if (h >= snowLine) { topB = B.SNOW; subB = B.STONE; }
      else if (bi === 3 && h > 58) { topB = B.STONE; subB = B.STONE; }
      else { topB = B.GRASS; subB = B.DIRT; }
      if (h < SEA - 4 && h > SEA - 9) topB = B.SAND;
      return { h, bi, topB, subB };
    }

    // Probabilité d'arbre d'une colonne (sans calculer le relief).
    treeChance(x, z) {
      return CM.hash3(x, 7, z, this.seed);
    }
    // 0 = pas d'arbre, 1 = arbre, 2 = grand arbre (déterministe).
    treeAt(x, z, info) {
      if (info.topB !== CM.B.GRASS || info.h + 13 >= H) return 0;
      const p = info.bi === 2 ? 0.045 : 0.004;
      if (this.treeChance(x, z) >= p) return 0;
      return info.bi === 2 && CM.hash3(x, 8, z, this.seed) < 0.12 ? 2 : 1;
    }

    findSpawn() {
      const B = CM.B;
      for (let rad = 0; rad < 4000; rad += 3) {
        const n = rad === 0 ? 1 : 24;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = Math.round(Math.cos(a) * rad), z = Math.round(Math.sin(a) * rad);
          const info = this.column(x, z);
          if (info.topB === B.GRASS && info.h > SEA + 1 && !this.treeAt(x, z, info)) return { x: x + 0.5, y: info.h + 1, z: z + 0.5 };
        }
      }
      return { x: 0.5, y: 70, z: 0.5 };
    }

    // Une fois les tronçons chargés : s'assure que le point d'apparition est dégagé.
    fixSpawn() {
      const sp = this.spawn, x = Math.floor(sp.x), z = Math.floor(sp.z);
      if (!this.loaded(x, z)) return;
      let y = Math.max(1, Math.floor(sp.y));
      while (y < H - 2 && (this.solidAt(x, y, z) || this.solidAt(x, y + 1, z))) y++;
      while (y > 1 && !this.solidAt(x, y - 1, z)) y--;
      sp.y = y;
    }

    // ------------------------------------------------------ génération ---
    generateChunk(cx, cz) {
      const B = CM.B;
      const c = new Chunk(cx, cz);
      const blocks = c.blocks, seed = this.seed;
      const x0 = c.x0, z0 = c.z0;
      const infos = new Array(256);

      // 1) colonnes
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz;
          const info = this.column(x, z);
          infos[(lz << 4) | lx] = info;
          const deep = 14 + Math.floor(this.nC.noise2(x / 20, z / 20) * 3);
          const h = info.h;
          for (let y = 0; y < H; y++) {
            let id = 0;
            if (y === 0) id = B.BEDROCK;
            else if (y <= 2 && CM.hash3(x, y, z, seed + 11) < 0.55) id = B.BEDROCK;
            else if (y < h - 3) id = y < deep ? B.DEEPSTONE : B.STONE;
            else if (y < h) id = info.subB;
            else if (y === h) id = info.topB;
            else if (y <= SEA) id = B.WATER;
            blocks[lidx(lx, y, lz)] = id;
          }
        }

      // 2) grottes (bruit 3D sur une grille alignée sur le monde, puis interpolé)
      for (let gy = 0; gy < GY; gy++)
        for (let gz = 0; gz < G; gz++)
          for (let gx = 0; gx < G; gx++) {
            const x = x0 + gx * GS, y = gy * GS, z = z0 + gz * GS;
            const gi = (gy * G + gz) * G + gx;
            gA[gi] = this.nA.noise3(x / 38, y / 22, z / 38);
            gB[gi] = this.nB.noise3(x / 38 + 70, y / 22, z / 38);
            gC[gi] = this.nC.noise3(x / 55, y / 28, z / 55);
          }
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const info = infos[(lz << 4) | lx];
          const h = info.h;
          let maxY = h;
          if (h <= SEA + 2) maxY = h - 6;
          else if (this.treeAt(x0 + lx, z0 + lz, info)) maxY = h - 3;
          for (let y = 3; y <= maxY; y++) {
            const a = tri(gA, lx, y, lz);
            const b = tri(gB, lx, y, lz);
            let carve = a * a + b * b < 0.011;
            if (!carve && y < 34) carve = tri(gC, lx, y, lz) > 0.58 - (34 - y) * 0.004;
            if (carve) {
              const i = lidx(lx, y, lz);
              if (blocks[i] !== B.BEDROCK) blocks[i] = y <= 5 ? B.BEDROCK : 0;
            }
          }
        }

      // 3) minerais : filons nés dans ce tronçon et ses voisins, découpés au tronçon
      VEINS.forEach(([name, per, ymin, ymax, size], t) => {
        const id = B[name];
        for (let ocz = cz - 1; ocz <= cz + 1; ocz++)
          for (let ocx = cx - 1; ocx <= cx + 1; ocx++) {
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
                  if (cur === B.STONE || (cur === B.DEEPSTONE && id !== B.COAL_ORE)) blocks[i] = id;
                }
                const r = rand();
                if (r < 0.33) x += rand() < 0.5 ? -1 : 1;
                else if (r < 0.66) z += rand() < 0.5 ? -1 : 1;
                else y += rand() < 0.5 ? -1 : 1;
              }
            }
          }
      });

      // 4) plantes (colonnes de ce tronçon sans arbre)
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const info = infos[(lz << 4) | lx];
          const h = info.h;
          if (info.topB !== B.GRASS || h + 1 >= H) continue;
          if (blocks[lidx(lx, h, lz)] !== B.GRASS || blocks[lidx(lx, h + 1, lz)] !== 0) continue;
          const x = x0 + lx, z = z0 + lz;
          if (this.treeAt(x, z, info)) continue;
          const r = this.treeChance(x, z);
          const treeP = info.bi === 2 ? 0.045 : 0.004;
          const above = lidx(lx, h + 1, lz);
          if (r < treeP + 0.09) blocks[above] = B.TALLGRASS;
          else if (r < treeP + 0.105) blocks[above] = B.FLOWER;
          else if (r < treeP + (info.bi === 2 ? 0.118 : 0.108)) blocks[above] = B.BERRYBUSH;
        }

      // 5) arbres dont la couronne touche ce tronçon
      for (let z = z0 - 3; z < z0 + 19; z++)
        for (let x = x0 - 3; x < x0 + 19; x++) {
          if (this.treeChance(x, z) >= 0.045) continue;
          const lx = x - x0, lz = z - z0;
          const inside = lx >= 0 && lx < 16 && lz >= 0 && lz < 16;
          const info = inside ? infos[(lz << 4) | lx] : this.column(x, z);
          const t = this.treeAt(x, z, info);
          if (t) this.placeTree(c, x, info.h + 1, z, t === 2);
        }

      // 6) champignons rebond dans les grottes
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const h = infos[(lz << 4) | lx].h;
          const x = x0 + lx, z = z0 + lz;
          for (let y = 4; y < h - 6; y++) {
            const i = lidx(lx, y, lz);
            if (blocks[i] !== 0) continue;
            const below = blocks[i - 256];
            if (below !== B.STONE && below !== B.DEEPSTONE) continue;
            if (CM.hash3(x, y, z, seed + 9) < 0.012) {
              blocks[i] = B.MUSHROOM;
              if (CM.hash3(x, y, z, seed + 10) < 0.3 && blocks[i + 256] === 0) blocks[i + 256] = B.MUSHROOM;
            }
          }
        }

      // 7) îles célestes
      this.islandsFor(c);

      // 8) modifications du joueur
      const e = this.edits.get(ckey(cx, cz));
      if (e) for (const [i, id] of e) blocks[i] = id;
      return c;
    }

    // Arbre découpé au tronçon c (seules les cases de c sont écrites).
    placeTree(c, x, y, z, big) {
      const B = CM.B, seed = this.seed;
      const R = big ? 3 : 2;
      if (x + R < c.x0 || x - R > c.x0 + 15 || z + R < c.z0 || z - R > c.z0 + 15) return;
      const th = (big ? 7 : 4) + Math.floor(CM.hash3(x, 1, z, seed + 21) * 3);
      if (y + th + 2 >= H) return;
      const put = (X, Y, Z, id, onlyAir) => {
        const lx = X - c.x0, lz = Z - c.z0;
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || Y < 0 || Y >= H) return;
        const i = lidx(lx, Y, lz);
        if (onlyAir) {
          const cur = c.blocks[i];
          if (cur !== 0 && !CM.blocks[cur].plant) return;
        }
        c.blocks[i] = id;
      };
      put(x, y - 1, z, B.DIRT, false);
      for (let i = 0; i < th; i++) put(x, y + i, z, B.LOG, false);
      const topY = y + th;
      for (let dy = -3; dy <= 1; dy++) {
        const r = dy >= 0 ? R - 1 : R;
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            const X = x + dx, Y = topY + dy, Z = z + dz;
            if (Math.abs(dx) === r && Math.abs(dz) === r && (dy >= 0 || CM.hash3(X, Y, Z, seed + 22) < 0.5)) continue;
            put(X, Y, Z, B.LEAVES, true);
          }
      }
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
          for (const [X, top, Z] of trees) this.placeTree(c, X, top + 1, Z, false);
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
    growTree(x, y, z, rand) {
      const B = CM.B;
      const th = 4 + Math.floor(rand() * 3);
      if (y + th + 2 >= H) return false;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (!this.loaded(x + dx, z + dz)) return false;
      for (let i = 1; i < th + 1; i++) {
        const id = this.get(x, y + i, z);
        if (id !== 0 && !CM.blocks[id].plant && id !== B.LEAVES) return false;
      }
      this.setBlock(x, y - 1, z, B.DIRT);
      for (let i = 0; i < th; i++) this.setBlock(x, y + i, z, B.LOG);
      const topY = y + th;
      for (let dy = -3; dy <= 1; dy++) {
        const r = dy >= 0 ? 1 : 2;
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) === r && Math.abs(dz) === r && (dy >= 0 || rand() < 0.5)) continue;
            const X = x + dx, Y = topY + dy, Z = z + dz;
            if (!this.inside(X, Y, Z)) continue;
            const id = this.get(X, Y, Z);
            if (id === 0 || CM.blocks[id].plant) this.setBlock(X, Y, Z, B.LEAVES);
          }
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
