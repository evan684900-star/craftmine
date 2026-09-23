'use strict';
// Monde voxel : stockage, génération procédurale et éclairage (ciel + blocs).
(function () {
  const W = 256, D = 256, H = 96, SEA = 32;
  const WD = W * D;
  const SX = W >> 4, SY = H >> 4, SZ = D >> 4;
  CM.WORLD = { W, D, H, SEA, SX, SY, SZ };

  const QMASK = (1 << 22) - 1;
  const RMASK = (1 << 20) - 1;
  const Q = new Int32Array(QMASK + 1);
  const RQ = new Int32Array(RMASK + 1);
  const RQL = new Uint8Array(RMASK + 1);

  const SKY = 1, BLK = 0;

  class World {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.blocks = new Uint8Array(W * D * H);
      this.light = new Uint8Array(W * D * H);
      this.top = new Uint8Array(WD);
      this.dirty = new Uint8Array(SX * SY * SZ);
      this.edits = new Map();
      this.trackDirty = false;
      this.spawn = { x: W / 2, y: 60, z: D / 2 };
      this.islands = [];
      this.qh = 0;
      this.qt = 0;
    }

    idx(x, y, z) {
      return (y * D + z) * W + x;
    }
    inside(x, y, z) {
      return x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H;
    }
    get(x, y, z) {
      if (x < 0 || x >= W || z < 0 || z >= D || y < 0 || y >= H) return 0;
      return this.blocks[(y * D + z) * W + x];
    }
    // Pour les collisions : les bords du monde sont des murs invisibles.
    solidAt(x, y, z) {
      if (y < 0) return true;
      if (y >= H) return false;
      if (x < 0 || x >= W || z < 0 || z >= D) return true;
      return CM.blocks[this.blocks[(y * D + z) * W + x]].solid;
    }
    skyAt(x, y, z) {
      if (y >= H || x < 0 || x >= W || z < 0 || z >= D) return 15;
      if (y < 0) return 0;
      return this.light[(y * D + z) * W + x] >> 4;
    }
    blockLightAt(x, y, z) {
      if (!this.inside(x, y, z)) return 0;
      return this.light[(y * D + z) * W + x] & 15;
    }

    // --------------------------------------------------------- génération --
    *generate(edits) {
      const seed = this.seed;
      const nA = new CM.Noise(seed);
      const nB = new CM.Noise(seed + 101);
      const nC = new CM.Noise(seed + 202);
      const nD = new CM.Noise(seed + 303);
      const nE = new CM.Noise(seed + 404);
      const rand = CM.rng(seed ^ 0x9e3779b9);
      const blocks = this.blocks;
      const B = CM.B;
      const heights = new Int16Array(WD);
      const biome = new Uint8Array(WD); // 0 plaine, 1 désert, 2 forêt, 3 montagne
      this.heights = heights;

      // 1) Carte des hauteurs et biomes
      for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
          const cx = (x - W / 2) / (W / 2);
          const cz = (z - D / 2) / (D / 2);
          const edge = Math.pow(Math.pow(Math.abs(cx), 4) + Math.pow(Math.abs(cz), 4), 0.25);
          const cont = nA.fbm2(x / 170, z / 170, 3);
          const hills = nA.fbm2(x / 46 + 100, z / 46 - 50, 4);
          let ridge = 1 - Math.abs(nB.noise2(x / 95, z / 95));
          ridge *= ridge;
          const mMask = CM.smoothstep(0.05, 0.45, nC.fbm2(x / 190 + 50, z / 190, 2));
          let h = SEA + 5 + cont * 9 + hills * 5 + ridge * mMask * 40;
          const fall = CM.smoothstep(0.6, 0.93, edge);
          h = h * (1 - fall) + (SEA - 12) * fall;
          h = Math.floor(CM.clamp(h, 4, 84));
          heights[z * W + x] = h;
          const temp = nD.fbm2(x / 140, z / 140, 2);
          const forest = nE.fbm2(x / 70, z / 70, 2);
          let bi = 0;
          if (h > 62) bi = 3;
          else if (temp > 0.3) bi = 1;
          else if (forest > 0.12) bi = 2;
          biome[z * W + x] = bi;
        }
        if ((z & 31) === 0) yield ['Façonnage du relief', (z / D) * 0.15];
      }
      this.biome = biome;

      // 2) Remplissage des colonnes
      for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
          const c = z * W + x;
          const h = heights[c];
          const bi = biome[c];
          const deep = 14 + Math.floor(nC.noise2(x / 20, z / 20) * 3);
          const snowLine = 66 + Math.floor(nD.noise2(x / 12, z / 12) * 3);
          let topB, subB;
          if (h < SEA - 4) {
            topB = B.DIRT; subB = B.DIRT;
          } else if (h <= SEA + 1) {
            topB = B.SAND; subB = B.SAND;
          } else if (bi === 1) {
            topB = B.SAND; subB = B.SAND;
          } else if (h >= snowLine) {
            topB = B.SNOW; subB = B.STONE;
          } else if (bi === 3 && h > 58) {
            topB = B.STONE; subB = B.STONE;
          } else {
            topB = B.GRASS; subB = B.DIRT;
          }
          if (h < SEA - 4 && h > SEA - 9) topB = B.SAND;
          for (let y = 0; y < H; y++) {
            let id = 0;
            if (y === 0) id = B.BEDROCK;
            else if (y <= 2 && rand() < 0.55) id = B.BEDROCK;
            else if (y < h - 3) id = y < deep ? B.DEEPSTONE : B.STONE;
            else if (y < h) id = subB;
            else if (y === h) id = topB;
            else if (y <= SEA) id = B.WATER;
            blocks[(y * D + z) * W + x] = id;
          }
        }
        if ((z & 31) === 0) yield ['Remplissage du sous-sol', 0.15 + (z / D) * 0.1];
      }

      // 3) Grottes (bruit 3D échantillonné sur une grille puis interpolé)
      const GS = 4;
      const GX = W / GS + 1, GY = H / GS + 1, GZ = D / GS + 1;
      const gA = new Float32Array(GX * GY * GZ);
      const gB = new Float32Array(GX * GY * GZ);
      const gC = new Float32Array(GX * GY * GZ);
      for (let gy = 0; gy < GY; gy++)
        for (let gz = 0; gz < GZ; gz++)
          for (let gx = 0; gx < GX; gx++) {
            const x = gx * GS, y = gy * GS, z = gz * GS;
            const gi = (gy * GZ + gz) * GX + gx;
            gA[gi] = nA.noise3(x / 38, y / 22, z / 38);
            gB[gi] = nB.noise3(x / 38 + 70, y / 22, z / 38);
            gC[gi] = nC.noise3(x / 55, y / 28, z / 55);
          }
      yield ['Creusement des grottes', 0.28];
      const tri = (g, x, y, z) => {
        const fx = x / GS, fy = y / GS, fz = z / GS;
        const x0 = fx | 0, y0 = fy | 0, z0 = fz | 0;
        const tx = fx - x0, ty = fy - y0, tz = fz - z0;
        const i000 = (y0 * GZ + z0) * GX + x0;
        const i010 = i000 + GZ * GX;
        const a = g[i000] + (g[i000 + 1] - g[i000]) * tx;
        const b = g[i000 + GX] + (g[i000 + GX + 1] - g[i000 + GX]) * tx;
        const c = g[i010] + (g[i010 + 1] - g[i010]) * tx;
        const d = g[i010 + GX] + (g[i010 + GX + 1] - g[i010 + GX]) * tx;
        const ab = a + (b - a) * tz;
        const cd = c + (d - c) * tz;
        return ab + (cd - ab) * ty;
      };
      for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
          const h = heights[z * W + x];
          const nearWater = h <= SEA + 2;
          const maxY = nearWater ? h - 6 : h;
          for (let y = 3; y <= maxY; y++) {
            const a = tri(gA, x, y, z);
            const b = tri(gB, x, y, z);
            let carve = a * a + b * b < 0.011;
            if (!carve && y < 34) {
              const c = tri(gC, x, y, z);
              carve = c > 0.58 - (34 - y) * 0.004;
            }
            if (carve) {
              const i = (y * D + z) * W + x;
              if (blocks[i] !== B.BEDROCK) blocks[i] = y <= 5 ? B.BEDROCK : 0;
            }
          }
        }
        if ((z & 31) === 0) yield ['Creusement des grottes', 0.28 + (z / D) * 0.17];
      }

      // 4) Minerais (filons)
      const vein = (id, count, ymin, ymax, size, onlyDeep) => {
        for (let k = 0; k < count; k++) {
          let x = Math.floor(rand() * W), y = ymin + Math.floor(rand() * (ymax - ymin)), z = Math.floor(rand() * D);
          for (let s = 0; s < size; s++) {
            if (this.inside(x, y, z)) {
              const i = (y * D + z) * W + x;
              const cur = blocks[i];
              if (cur === B.STONE || (cur === B.DEEPSTONE && (onlyDeep || id !== B.COAL_ORE))) blocks[i] = id;
            }
            const r = rand();
            if (r < 0.33) x += rand() < 0.5 ? -1 : 1;
            else if (r < 0.66) z += rand() < 0.5 ? -1 : 1;
            else y += rand() < 0.5 ? -1 : 1;
          }
        }
      };
      vein(B.COAL_ORE, 2200, 8, 76, 9, false);
      vein(B.IRON_ORE, 1300, 4, 50, 6, false);
      vein(B.CRYSTAL_ORE, 320, 3, 19, 5, true);
      yield ['Dépôt des minerais', 0.5];

      // 5) Arbres, plantes, champignons
      const tree = (x, y, z, big) => {
        const th = big ? 7 + Math.floor(rand() * 3) : 4 + Math.floor(rand() * 3);
        if (y + th + 2 >= H) return;
        for (let i = 0; i < th; i++) blocks[((y + i) * D + z) * W + x] = B.LOG;
        const topY = y + th;
        const R = big ? 3 : 2;
        for (let dy = -3; dy <= 1; dy++) {
          const r = dy >= 0 ? R - 1 : R;
          for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && (dy >= 0 || rand() < 0.5)) continue;
              const X = x + dx, Y = topY + dy, Z = z + dz;
              if (!this.inside(X, Y, Z)) continue;
              const i = (Y * D + Z) * W + X;
              if (blocks[i] === 0 || CM.blocks[blocks[i]].plant) blocks[i] = B.LEAVES;
            }
        }
      };
      for (let z = 3; z < D - 3; z++) {
        for (let x = 3; x < W - 3; x++) {
          const c = z * W + x;
          const h = heights[c];
          const i = (h * D + z) * W + x;
          if (blocks[i] !== B.GRASS || h + 1 >= H) continue;
          const above = ((h + 1) * D + z) * W + x;
          if (blocks[above] !== 0) continue;
          const bi = biome[c];
          const r = CM.hash3(x, 7, z, seed);
          const treeP = bi === 2 ? 0.045 : 0.004;
          if (r < treeP) {
            tree(x, h + 1, z, bi === 2 && rand() < 0.12);
            blocks[i] = B.DIRT;
          } else if (r < treeP + 0.09) blocks[above] = B.TALLGRASS;
          else if (r < treeP + 0.105) blocks[above] = B.FLOWER;
          else if (r < treeP + (bi === 2 ? 0.118 : 0.108)) blocks[above] = B.BERRYBUSH;
        }
        if ((z & 31) === 0) yield ['Plantation des forêts', 0.5 + (z / D) * 0.1];
      }
      // Champignons rebond dans les grottes
      for (let z = 1; z < D - 1; z++)
        for (let x = 1; x < W - 1; x++) {
          const h = heights[z * W + x];
          for (let y = 4; y < h - 6; y++) {
            const i = (y * D + z) * W + x;
            if (blocks[i] !== 0) continue;
            const below = blocks[i - WD];
            if (below !== B.STONE && below !== B.DEEPSTONE) continue;
            if (CM.hash3(x, y, z, seed + 9) < 0.012) {
              blocks[i] = B.MUSHROOM;
              if (CM.hash3(x, y, z, seed + 10) < 0.3 && blocks[i + WD] === 0) blocks[i + WD] = B.MUSHROOM;
            }
          }
        }
      yield ['Pousse des champignons', 0.62];

      // 6) Îles célestes
      this.islands = [];
      for (let attempt = 0; attempt < 400 && this.islands.length < 8; attempt++) {
        const r = 6 + rand() * 6;
        const cx = 40 + Math.floor(rand() * (W - 80));
        const cz = 40 + Math.floor(rand() * (D - 80));
        const cy = 72 + Math.floor(rand() * 9);
        let ok = true;
        for (const isl of this.islands) if (Math.hypot(isl.x - cx, isl.z - cz) < isl.r + r + 12) ok = false;
        for (let dz = -r; dz <= r && ok; dz += 2)
          for (let dx = -r; dx <= r; dx += 2) {
            const X = CM.clamp(Math.round(cx + dx), 0, W - 1), Z = CM.clamp(Math.round(cz + dz), 0, D - 1);
            if (heights[Z * W + X] > cy - 22) ok = false;
          }
        if (!ok) continue;
        this.islands.push({ x: cx, y: cy, z: cz, r });
        const tops = [];
        for (let dz = -Math.ceil(r); dz <= r; dz++)
          for (let dx = -Math.ceil(r); dx <= r; dx++) {
            const dist = Math.hypot(dx, dz) + nA.noise2((cx + dx) / 5, (cz + dz) / 5) * 1.5;
            if (dist >= r) continue;
            const t = 1 - dist / r;
            const X = cx + dx, Z = cz + dz;
            const top = cy + Math.round(nB.noise2(X / 7, Z / 7) * 1.2);
            const depth = Math.round(Math.pow(t, 0.6) * r * 0.9 + nC.noise2(X / 3, Z / 3) * 1.5) + 1;
            for (let y = top - depth; y <= top; y++) {
              let id = B.SKYSTONE;
              if (y === top) id = B.GRASS;
              else if (y >= top - 2) id = B.DIRT;
              blocks[(y * D + Z) * W + X] = id;
            }
            tops.push([X, top, Z]);
          }
        // Éclats célestes enfouis dans la pierre céleste
        let placed = 0;
        for (let k = 0; k < 400 && placed < 7; k++) {
          const X = Math.round(cx + (rand() - 0.5) * r * 1.6);
          const Z = Math.round(cz + (rand() - 0.5) * r * 1.6);
          const Y = cy - 2 - Math.floor(rand() * r * 0.7);
          if (!this.inside(X, Y, Z)) continue;
          const i = (Y * D + Z) * W + X;
          if (blocks[i] === B.SKYSTONE) {
            blocks[i] = B.SHARD_ORE;
            placed++;
          }
        }
        // Végétation
        for (const [X, top, Z] of tops) {
          if (top + 1 >= H) continue;
          const i = ((top + 1) * D + Z) * W + X;
          if (blocks[i] !== 0) continue;
          const h = CM.hash3(X, top, Z, seed + 77);
          if (h < 0.025 && Math.hypot(X - cx, Z - cz) < r - 3) {
            tree(X, top + 1, Z, false);
            blocks[(top * D + Z) * W + X] = B.DIRT;
          } else if (h < 0.2) blocks[i] = B.TALLGRASS;
          else if (h < 0.26) blocks[i] = B.FLOWER;
        }
      }
      yield ['Élévation des îles célestes', 0.66];

      // 7) Point d'apparition : herbe près du centre
      this.spawn = { x: W / 2 + 0.5, y: heights[(D / 2) * W + W / 2] + 1, z: D / 2 + 0.5 };
      outer: for (let rad = 0; rad < 100; rad++) {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const x = Math.round(W / 2 + Math.cos(a) * rad), z = Math.round(D / 2 + Math.sin(a) * rad);
          const h = heights[z * W + x];
          if (h > SEA + 1 && blocks[(h * D + z) * W + x] === B.GRASS && blocks[((h + 1) * D + z) * W + x] !== B.LOG) {
            let clear = true;
            for (let y = h + 1; y < H; y++) {
              const id = blocks[(y * D + z) * W + x];
              if (id !== 0 && !CM.blocks[id].plant) clear = false;
            }
            if (clear) {
              this.spawn = { x: x + 0.5, y: h + 1, z: z + 0.5 };
              break outer;
            }
          }
        }
      }

      // 8) Modifications sauvegardées
      if (edits) {
        for (let k = 0; k < edits.length; k += 2) {
          const i = edits[k], id = edits[k + 1];
          if (i >= 0 && i < blocks.length && CM.blocks[id]) {
            blocks[i] = id;
            this.edits.set(i, id);
          }
        }
      }

      // 9) Lumière
      yield ['Calcul de la lumière', 0.7];
      this.initLight();
      yield ['Terminé', 0.85];
    }

    // Fait pousser un arbre à partir d'une pousse (en jeu, avec mise à jour de la lumière).
    growTree(x, y, z, rand) {
      const B = CM.B;
      const th = 4 + Math.floor(rand() * 3);
      if (y + th + 2 >= H) return false;
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

    // ----------------------------------------------------------- lumière --
    getL(i, ch) {
      return ch === SKY ? this.light[i] >> 4 : this.light[i] & 15;
    }
    setL(i, ch, v) {
      this.light[i] = ch === SKY ? (this.light[i] & 15) | (v << 4) : (this.light[i] & 0xf0) | v;
    }
    push(i) {
      Q[this.qt] = i;
      this.qt = (this.qt + 1) & QMASK;
    }

    initLight() {
      const blocks = this.blocks, L = this.light, defs = CM.blocks, top = this.top;
      L.fill(0);
      for (let z = 0; z < D; z++)
        for (let x = 0; x < W; x++) {
          let y = H - 1;
          for (; y >= 0; y--) {
            const i = (y * D + z) * W + x;
            const b = defs[blocks[i]];
            if (!b.lightPass || b.atten > 0) break;
            L[i] = 0xf0;
          }
          top[z * W + x] = y + 1;
        }
      this.qh = this.qt = 0;
      for (let z = 0; z < D; z++)
        for (let x = 0; x < W; x++) {
          const t = top[z * W + x];
          if (t < H) this.push((t * D + z) * W + x);
          const nb = [];
          if (x > 0) nb.push(top[z * W + x - 1]);
          if (x < W - 1) nb.push(top[z * W + x + 1]);
          if (z > 0) nb.push(top[(z - 1) * W + x]);
          if (z < D - 1) nb.push(top[(z + 1) * W + x]);
          let maxN = t;
          for (const n of nb) if (n > maxN) maxN = n;
          for (let y = t + 1; y < maxN; y++) this.push((y * D + z) * W + x);
        }
      this.propagate(SKY);
      for (let i = 0; i < blocks.length; i++) {
        const e = defs[blocks[i]].light;
        if (e) {
          L[i] = (L[i] & 0xf0) | e;
          this.push(i);
        }
      }
      this.propagate(BLK);
    }

    propagate(ch) {
      const blocks = this.blocks, defs = CM.blocks;
      const track = this.trackDirty;
      while (this.qh !== this.qt) {
        const i = Q[this.qh];
        this.qh = (this.qh + 1) & QMASK;
        const lv = this.getL(i, ch);
        if (lv <= 1) continue;
        const y = (i / WD) | 0;
        const rem = i - y * WD;
        const z = (rem / W) | 0;
        const x = rem - z * W;
        for (let dir = 0; dir < 6; dir++) {
          let n;
          switch (dir) {
            case 0: if (x === 0) continue; n = i - 1; break;
            case 1: if (x === W - 1) continue; n = i + 1; break;
            case 2: if (z === 0) continue; n = i - W; break;
            case 3: if (z === D - 1) continue; n = i + W; break;
            case 4: if (y === 0) continue; n = i - WD; break;
            default: if (y === H - 1) continue; n = i + WD;
          }
          const b = defs[blocks[n]];
          if (!b.lightPass) continue;
          let nl = lv - 1 - b.atten;
          if (ch === SKY && dir === 4 && lv === 15 && b.atten === 0) nl = 15;
          if (nl > this.getL(n, ch)) {
            this.setL(n, ch, nl);
            this.push(n);
            if (track) this.markCell(n);
          }
        }
      }
    }

    removeLight(i, ch) {
      const blocks = this.blocks, defs = CM.blocks;
      let rh = 0, rt = 0;
      const lv0 = this.getL(i, ch);
      this.setL(i, ch, 0);
      RQ[rt] = i;
      RQL[rt] = lv0;
      rt = (rt + 1) & RMASK;
      while (rh !== rt) {
        const j = RQ[rh];
        const jl = RQL[rh];
        rh = (rh + 1) & RMASK;
        const y = (j / WD) | 0;
        const rem = j - y * WD;
        const z = (rem / W) | 0;
        const x = rem - z * W;
        for (let dir = 0; dir < 6; dir++) {
          let n;
          switch (dir) {
            case 0: if (x === 0) continue; n = j - 1; break;
            case 1: if (x === W - 1) continue; n = j + 1; break;
            case 2: if (z === 0) continue; n = j - W; break;
            case 3: if (z === D - 1) continue; n = j + W; break;
            case 4: if (y === 0) continue; n = j - WD; break;
            default: if (y === H - 1) continue; n = j + WD;
          }
          const nl = this.getL(n, ch);
          if (nl === 0) continue;
          if (nl < jl || (ch === SKY && dir === 4 && jl === 15 && nl === 15)) {
            this.setL(n, ch, 0);
            this.markCell(n);
            RQ[rt] = n;
            RQL[rt] = nl;
            rt = (rt + 1) & RMASK;
            if (ch === BLK) {
              const e = defs[blocks[n]].light;
              if (e) {
                this.setL(n, ch, e);
                this.push(n);
              }
            }
          } else {
            this.push(n);
          }
        }
      }
    }

    markCell(i) {
      const y = (i / WD) | 0;
      const rem = i - y * WD;
      const z = (rem / W) | 0;
      const x = rem - z * W;
      this.markDirty(x, y, z, 1);
    }

    markDirty(x, y, z, level) {
      const x0 = Math.max(0, (x - 1) >> 4), x1 = Math.min(SX - 1, (x + 1) >> 4);
      const y0 = Math.max(0, (y - 1) >> 4), y1 = Math.min(SY - 1, (y + 1) >> 4);
      const z0 = Math.max(0, (z - 1) >> 4), z1 = Math.min(SZ - 1, (z + 1) >> 4);
      for (let sy = y0; sy <= y1; sy++)
        for (let sz = z0; sz <= z1; sz++)
          for (let sx = x0; sx <= x1; sx++) {
            const s = (sy * SZ + sz) * SX + sx;
            if (this.dirty[s] < level) this.dirty[s] = level;
          }
    }

    // Pose/retire un bloc et met à jour la lumière localement.
    setBlock(x, y, z, id) {
      if (!this.inside(x, y, z)) return false;
      const i = this.idx(x, y, z);
      const old = this.blocks[i];
      if (old === id) return false;
      this.blocks[i] = id;
      this.edits.set(i, id);
      this.trackDirty = true;
      this.markDirty(x, y, z, 2);
      this.qh = this.qt = 0;
      this.removeLight(i, SKY);
      this.propagate(SKY);
      this.qh = this.qt = 0;
      this.removeLight(i, BLK);
      const e = CM.blocks[id].light;
      if (e) {
        this.setL(i, BLK, e);
        this.push(i);
      }
      // les voisins réinjectent leur lumière dans la case libérée
      const nbs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      for (const [dx, dy, dz] of nbs) if (this.inside(x + dx, y + dy, z + dz)) this.push(this.idx(x + dx, y + dy, z + dz));
      this.propagate(BLK);
      this.trackDirty = false;
      return true;
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

    editsArray() {
      const out = [];
      for (const [i, id] of this.edits) out.push(i, id);
      return out;
    }
  }

  CM.World = World;
})();
