'use strict';
// Structures des nouveaux mondes (générateur 6 et plus) : donjons (générateur de monstres et
// coffres), puits de mine (galeries étayées, rails, toiles, générateurs d'araignées), temples du
// désert (salle au trésor piégée) et cabanes de sorcière des marais.
// Comme les forteresses : chaque structure est calculée à partir de la graine et de sa région,
// puis chaque tronçon n'écrit que les cases qui lui appartiennent.
(function () {
  const { H, MINY, SEA } = CM.WORLD;
  const lidx = (lx, y, lz) => ((y - MINY) << 8) | (lz << 4) | lx;
  const Wp = CM.World.prototype;
  const DREG = 48, MREG = 112, TREG = 176, HREG = 144;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const rngOf = (w, rx, rz, salt) => CM.rng((CM.hash3(rx, salt, rz, w.seed) * 4294967296) >>> 0);
  const cacheOf = (w) => w._stc || (w._stc = new Map());
  const cached = (w, k, fn) => {
    const c = cacheOf(w);
    if (c.has(k)) return c.get(k);
    const v = fn();
    if (c.size > 4000) c.clear();
    c.set(k, v);
    return v;
  };
  const SPAWN_TYPES = ['ombre', 'ombre', 'skeleton', 'spider'];

  // ------------------------------------------------------------ donjons --
  Wp.dungeonAt = function (rx, rz) {
    return cached(this, 'd' + rx + ',' + rz, () => {
      const r = rngOf(this, rx, rz, 211);
      if (r() > 0.5) return null;
      const x = rx * DREG + 7 + Math.floor(r() * (DREG - 14)), z = rz * DREG + 7 + Math.floor(r() * (DREG - 14));
      const y = MINY + 10 + Math.floor(r() * 44);
      const info = this.column(x, z);
      if (info.h < y + 10) return null;
      const hx = 3 + Math.floor(r() * 2), hz = 3 + Math.floor(r() * 2);
      const chests = [[x - hx, y, z + (r() < 0.5 ? 1 : -1)]];
      if (r() < 0.6) chests.push([x + hx, y, z - (r() < 0.5 ? 1 : -2)]);
      return { t: 'dungeon', x, y, z, hx, hz, chests, mob: SPAWN_TYPES[Math.floor(r() * SPAWN_TYPES.length)], seed: Math.floor(r() * 1e9) };
    });
  };
  // ------------------------------------------------------- puits de mine --
  Wp.mineshaftAt = function (rx, rz) {
    return cached(this, 'm' + rx + ',' + rz, () => {
      const r = rngOf(this, rx, rz, 223);
      if (r() > 0.4) return null;
      const x = rx * MREG + 30 + Math.floor(r() * (MREG - 60)), z = rz * MREG + 30 + Math.floor(r() * (MREG - 60));
      const y = -42 + Math.floor(r() * 50);
      const info = this.column(x, z);
      if (info.h < y + 14) return null;
      const segs = [], chests = [], spawners = [], webs = [];
      const queue = [];
      for (let d = 0; d < 4; d++) if (r() < 0.8) queue.push([x + DIRS[d][0] * 4, z + DIRS[d][1] * 4, d, 0]);
      while (queue.length && segs.length < 36) {
        const [sx, sz, d, depth] = queue.shift();
        const [ax, az] = DIRS[d], px = az, pz = ax;
        const len = 8 + Math.floor(r() * 22);
        const ex = sx + ax * len, ez = sz + az * len;
        if (Math.abs(ex - x) > 90 || Math.abs(ez - z) > 90) continue;
        segs.push({ x: sx, z: sz, d, len });
        const mid = Math.floor(len / 2);
        if (r() < 0.28) chests.push([sx + ax * mid + px, y, sz + az * mid + pz]);
        // un générateur d'araignées dans un coin plein de toiles
        if (r() < 0.08) {
          const s = 2 + Math.floor(r() * (len - 3));
          spawners.push([sx + ax * s, y, sz + az * s]);
          for (let k = -2; k <= 2; k++) for (let w = -1; w <= 1; w++) for (let dy = 0; dy <= 2; dy++) if ((k || w || dy) && CM.hash3(sx + k, dy, sz + w, this.seed) < 0.55) webs.push([sx + ax * (s + k) + px * w, y + dy, sz + az * (s + k) + pz * w]);
        }
        if (depth < 4) {
          if (r() < 0.75) queue.push([ex, ez, d, depth + 1]);
          const left = [3, 2, 0, 1][d], right = [2, 3, 1, 0][d];
          if (r() < 0.45) queue.push([ex + DIRS[left][0], ez + DIRS[left][1], left, depth + 1]);
          if (r() < 0.45) queue.push([ex + DIRS[right][0], ez + DIRS[right][1], right, depth + 1]);
        }
      }
      if (!segs.length) return null;
      return { t: 'mineshaft', x, y, z, segs, chests, spawners, webs, seed: Math.floor(r() * 1e9) };
    });
  };
  // ----------------------------------------------------- temples du désert --
  Wp.templeAt = function (rx, rz) {
    return cached(this, 't' + rx + ',' + rz, () => {
      const r = rngOf(this, rx, rz, 227);
      if (r() > 0.55) return null;
      const x = rx * TREG + 24 + Math.floor(r() * (TREG - 48)), z = rz * TREG + 24 + Math.floor(r() * (TREG - 48));
      const info = this.column(x, z);
      if (info.bi !== CM.BIO.DESERT || info.h <= SEA + 1 || info.flat) return null;
      if (this.hasVillages && this.villageNear && this.villageNear(x, z, 20)) return null;
      // sol le plus bas sous l'emprise (le temple est posé dessus)
      let y = info.h;
      for (const [dx, dz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) y = Math.min(y, this.column(x + dx, z + dz).h);
      const chests = [[x - 3, y - 12, z], [x + 3, y - 12, z], [x, y - 12, z - 3], [x, y - 12, z + 3]];
      return { t: 'temple', x, y, z, chests, seed: Math.floor(r() * 1e9) };
    });
  };
  // ------------------------------------------------- cabanes de sorcière --
  Wp.hutAt = function (rx, rz) {
    return cached(this, 'h' + rx + ',' + rz, () => {
      const r = rngOf(this, rx, rz, 229);
      if (r() > 0.6) return null;
      const x = rx * HREG + 16 + Math.floor(r() * (HREG - 32)), z = rz * HREG + 16 + Math.floor(r() * (HREG - 32));
      const info = this.column(x, z);
      if (info.bi !== CM.BIO.SWAMP && info.bi !== CM.BIO.MANGROVE) return null;
      const y = Math.max(info.h, SEA) + 3;
      return { t: 'hut', x, y, z, seed: Math.floor(r() * 1e9) };
    });
  };
  // Structures dont l'emprise touche le rectangle [x0, x1] × [z0, z1].
  Wp.structuresIn = function (x0, z0, x1, z1) {
    const out = [];
    const each = (REG, pad, fn) => {
      for (let rz = Math.floor((z0 - pad) / REG); rz <= Math.floor((z1 + pad) / REG); rz++)
        for (let rx = Math.floor((x0 - pad) / REG); rx <= Math.floor((x1 + pad) / REG); rx++) {
          const s = fn(rx, rz);
          if (s) out.push(s);
        }
    };
    each(DREG, 6, (a, b) => this.dungeonAt(a, b));
    each(MREG, 100, (a, b) => this.mineshaftAt(a, b));
    each(TREG, 12, (a, b) => this.templeAt(a, b));
    each(HREG, 6, (a, b) => this.hutAt(a, b));
    return out;
  };

  // ------------------------------------------------------------ écriture --
  Wp.structuresFor = function (c) {
    const Bk = CM.B, blocks = c.blocks;
    const inC = (X, Z) => X >= c.x0 && X <= c.x0 + 15 && Z >= c.z0 && Z <= c.z0 + 15;
    const put = (X, Y, Z, id) => {
      if (!inC(X, Z) || Y <= MINY || Y >= H - 1) return;
      blocks[lidx(X - c.x0, Y, Z - c.z0)] = id;
    };
    const get = (X, Y, Z) => (inC(X, Z) && Y > MINY && Y < H ? blocks[lidx(X - c.x0, Y, Z - c.z0)] : 0);
    const chestAt = (p) => put(p[0], p[1], p[2], Bk.CHEST);
    for (const s of this.structuresIn(c.x0, c.z0, c.x0 + 15, c.z0 + 15)) {
      const h = (X, Y, Z) => CM.hash3(X, Y, Z, s.seed);
      if (s.t === 'dungeon') {
        for (let dz = -s.hz - 1; dz <= s.hz + 1; dz++)
          for (let dx = -s.hx - 1; dx <= s.hx + 1; dx++) {
            const X = s.x + dx, Z = s.z + dz;
            if (!inC(X, Z)) continue;
            for (let dy = -1; dy <= 4; dy++) {
              const Y = s.y + dy;
              const shell = dy === -1 || dy === 4 || Math.abs(dx) === s.hx + 1 || Math.abs(dz) === s.hz + 1;
              const cur = get(X, Y, Z);
              if (!shell) put(X, Y, Z, 0);
              else if (dy === -1 || (cur !== 0 && !CM.isFluid(cur))) put(X, Y, Z, dy === -1 ? (h(X, Y, Z) < 0.45 ? Bk.MOSSY_COBBLE : Bk.COBBLE) : h(X, Y, Z) < 0.3 ? Bk.MOSSY_COBBLE : Bk.COBBLE);
            }
          }
        put(s.x, s.y, s.z, Bk.SPAWNER);
        s.chests.forEach(chestAt);
      } else if (s.t === 'mineshaft') {
        const y = s.y, rail = CM.RSFAM && CM.RSFAM.rail;
        // salle centrale
        for (let dz = -4; dz <= 4; dz++)
          for (let dx = -4; dx <= 4; dx++) {
            const X = s.x + dx, Z = s.z + dz;
            if (!inC(X, Z)) continue;
            put(X, y - 1, Z, Bk.DIRT);
            for (let dy = 0; dy <= 3; dy++) put(X, y + dy, Z, 0);
          }
        for (const g of s.segs) {
          const [ax, az] = DIRS[g.d], px = az, pz = ax;
          const bx0 = Math.min(g.x, g.x + ax * g.len) - 1, bx1 = Math.max(g.x, g.x + ax * g.len) + 1;
          const bz0 = Math.min(g.z, g.z + az * g.len) - 1, bz1 = Math.max(g.z, g.z + az * g.len) + 1;
          if (bx1 < c.x0 || bx0 > c.x0 + 15 || bz1 < c.z0 || bz0 > c.z0 + 15) continue;
          for (let st = 0; st <= g.len; st++)
            for (let w = -1; w <= 1; w++) {
              const X = g.x + ax * st + px * w, Z = g.z + az * st + pz * w;
              if (!inC(X, Z)) continue;
              const fl = get(X, y - 1, Z);
              if (fl === 0 || CM.isFluid(fl)) put(X, y - 1, Z, Bk.PLANKS); // pont au-dessus des grottes
              for (let dy = 0; dy <= 2; dy++) put(X, y + dy, Z, 0);
              // étais : deux poteaux et une poutre tous les 4 blocs
              if (st % 4 === 2) {
                if (w !== 0) {
                  put(X, y, Z, Bk.LOG);
                  put(X, y + 1, Z, Bk.LOG);
                }
                put(X, y + 2, Z, Bk.PLANKS);
              } else if (w === 0 && rail && h(X, y, Z) < 0.7) put(X, y, Z, CM.rsWith(rail.base, { shape: ax ? 1 : 0 }));
              if (w !== 0 && st % 4 !== 2 && h(X, y + 2, Z) < 0.05) put(X, y + 2, Z, Bk.COBWEB);
              if (w !== 0 && st % 8 === 6 && h(X, 7, Z) < 0.35) put(X, y + 1, Z, Bk.TORCH);
            }
        }
        for (const p of s.webs) put(p[0], p[1], p[2], Bk.COBWEB);
        for (const p of s.spawners) put(p[0], p[1], p[2], Bk.SPAWNER);
        s.chests.forEach(chestAt);
      } else if (s.t === 'temple') {
        const y = s.y, SS = Bk.SANDSTONE, CUT = Bk.CUT_SANDSTONE, CARV = Bk.CARVED_SANDSTONE, OR = Bk.TERRACOTTA_ORANGE || Bk.TERRACOTTA, BL = Bk.TERRACOTTA_BLUE || Bk.LAPIS_BLOCK;
        for (let dz = -10; dz <= 10; dz++)
          for (let dx = -10; dx <= 10; dx++) {
            const X = s.x + dx, Z = s.z + dz;
            if (!inC(X, Z)) continue;
            const ax = Math.abs(dx), az = Math.abs(dz);
            // fondations et salle au trésor
            for (let Y = y - 1; Y > y - 16 && Y > MINY; Y--) {
              if (Y >= y - 7 && get(X, Y, Z) !== 0 && !CM.isFluid(get(X, Y, Z)) && !(ax <= 4 && az <= 4)) break;
              put(X, Y, Z, SS);
            }
            if (ax <= 3 && az <= 3) for (let Y = y - 12; Y <= y - 9; Y++) put(X, Y, Z, 0); // la salle (7 × 7 × 4)
            if (ax === 4 && az <= 4 && (az === 0 || az === 2)) put(X, y - 11, Z, CARV);
            if (az === 4 && ax <= 4 && (ax === 0 || ax === 2)) put(X, y - 11, Z, CARV);
            if (ax <= 1 && az <= 1) put(X, y - 14, Z, Bk.TNT); // le piège
            // sol du temple : motif orange et bleu au centre
            put(X, y, Z, ax <= 2 && az <= 2 ? (ax === 0 && az === 0 ? BL : ax === 2 || az === 2 ? OR : SS) : ax === 6 || az === 6 ? OR : CUT);
            const wall = ax === 10 || az === 10;
            const tower = ax >= 6 && dz <= -6 && ax <= 10 && dz >= -10;
            const top = tower ? 15 : 9;
            for (let dy = 1; dy <= top + 1; dy++) {
              const Y = y + dy;
              let id = 0;
              if (tower) {
                const tw = ax === 6 || ax === 10 || dz === -6 || dz === -10;
                id = tw || dy === top + 1 ? (dy % 5 === 0 ? OR : dy === top + 1 ? CUT : SS) : 0;
                if (tw && (dy === 11 || dy === 12) && (ax === 8 || dz === -8)) id = 0; // fenêtres
                if (dy <= 9 && !tw) id = 0;
              } else if (wall) {
                id = dy === 4 || dy === 8 ? OR : dy === 6 ? CARV : SS;
                if (dz === -10 && ax <= 1 && dy <= 4) id = 0; // entrée
                if ((dx === -10 || dx === 10) && Math.abs(dz) === 3 && (dy === 5 || dy === 6)) id = 0; // fenêtres
                if (dy === top + 1) id = CUT;
              } else if (dy === top + 1) id = SS; // toit
              else if ((ax === 5 && az === 5) || (ax === 5 && az === 0) || (ax === 0 && az === 5)) id = dy === top ? CARV : CUT; // piliers
              put(X, Y, Z, id);
            }
          }
        put(s.x, y - 12, s.z, CM.RSFAM && CM.RSFAM.plate_stone ? CM.RSFAM.plate_stone.base : 0);
        put(s.x, y - 13, s.z, SS);
        s.chests.forEach(chestAt);
      } else if (s.t === 'hut') {
        const y = s.y, PL = Bk.SPRUCE_PLANKS || Bk.PLANKS, LG = Bk.SPRUCE_LOG || Bk.LOG, RF = Bk.DARK_OAK_PLANKS || PL;
        // clairière : les arbres du marais autour de la cabane disparaissent
        for (let dz = -6; dz <= 6; dz++)
          for (let dx = -6; dx <= 6; dx++)
            for (let dy = -2; dy <= 12; dy++) {
              const X = s.x + dx, Z = s.z + dz, cur = get(X, y + dy, Z);
              if (cur && /LEAVES|_LOG$|^LOG$|VINE|PROPAGULE/.test(CM.blocks[cur].key)) put(X, y + dy, Z, 0);
            }
        for (let dz = -4; dz <= 4; dz++)
          for (let dx = -4; dx <= 4; dx++) {
            const X = s.x + dx, Z = s.z + dz;
            if (!inC(X, Z)) continue;
            const ax = Math.abs(dx), az = Math.abs(dz);
            // pilotis aux coins
            if (ax === 3 && az === 3) for (let Y = y - 1; Y > y - 12 && Y > MINY; Y--) {
              const cur = get(X, Y, Z);
              if (cur !== 0 && !CM.isFluid(cur) && !CM.blocks[cur].plant && !/LEAVES|VINE|ROOTS/.test(CM.blocks[cur].key)) break;
              put(X, Y, Z, LG);
            }
            if (ax <= 3 && az <= 3) put(X, y, Z, PL);
            for (let dy = 1; dy <= 3; dy++) {
              let id = 0;
              if (ax <= 3 && az <= 3 && (ax === 3 || az === 3)) {
                id = ax === 3 && az === 3 ? LG : PL;
                if (dz === -3 && dx === 0 && dy <= 2) id = 0; // porte
                if (ax === 3 && dz === 0 && dy === 2) id = Bk.GLASS; // fenêtres
                if (az === 3 && dz === 3 && dx === 0 && dy === 2) id = Bk.GLASS;
              }
              if (ax <= 3 && az <= 3 || id) put(X, y + dy, Z, id);
            }
            put(X, y + 4, Z, RF); // toit débordant
            if (ax <= 2 && az <= 2) put(X, y + 5, Z, RF);
          }
        put(s.x + 2, y + 1, s.z + 2, Bk.BREWING_STAND);
        put(s.x - 2, y + 1, s.z + 2, Bk.TABLE);
        put(s.x - 2, y + 1, s.z - 2, Bk.RED_SHROOM || Bk.BROWN_SHROOM);
        put(s.x, y + 3, s.z, Bk.LANTERN || Bk.TORCH);
      }
    }
  };

  // Structure qui contient la case (x, y, z) (pour le butin des coffres).
  Wp.structureAt = function (x, y, z) {
    for (const s of this.structuresIn(x, z, x, z)) {
      if (s.chests && s.chests.some((p) => p[0] === x && p[1] === y && p[2] === z)) return s;
      if (s.t === 'temple' && Math.abs(x - s.x) <= 10 && Math.abs(z - s.z) <= 10) return s;
    }
    return null;
  };
  // Générateurs de monstres d'origine autour de (x, z) : [x, y, z, créature].
  Wp.spawnersNear = function (x, z, r) {
    const out = [];
    for (const s of this.structuresIn(x - r, z - r, x + r, z + r)) {
      if (s.t === 'dungeon') out.push([s.x, s.y, s.z, s.mob]);
      if (s.t === 'mineshaft') for (const p of s.spawners) out.push([p[0], p[1], p[2], 'spider']);
    }
    return out.filter((p) => Math.abs(p[0] - x) <= r && Math.abs(p[2] - z) <= r);
  };
  Wp.hutNear = function (x, z, r) {
    return this.structuresIn(x - r, z - r, x + r, z + r).find((s) => s.t === 'hut' && Math.hypot(s.x - x, s.z - z) <= r) || null;
  };

  // ============================================================= JEU ==
  const S = (CM.Structures = {
    // Butin des coffres des structures (true : rempli ici).
    fillLoot(g, slots, x, y, z) {
      const w = g.world;
      if (!w.structures || w.nether) return false;
      const s = w.structureAt(x, y, z);
      if (!s) return false;
      const I = CM.I, B = CM.B;
      const r = CM.rng((CM.hash3(x, y, z, w.seed + 1999) * 4294967296) >>> 0);
      const T = {
        dungeon: [[I.BONE, 0.6, 2, 8], [I.STRING, 0.5, 1, 4], [I.GUNPOWDER, 0.4, 1, 5], [I.BREAD, 0.4, 1, 3], [I.IRON_INGOT, 0.45, 1, 4], [I.GOLD_INGOT, 0.3, 1, 3], [I.REDSTONE, 0.3, 2, 6], [I.SADDLE, 0.3, 1, 1],
          [I.GOLDEN_APPLE, 0.12, 1, 1], [I.DIAMOND, 0.08, 1, 2], [I.BUCKET, 0.2, 1, 1], [I.WHEAT, 0.3, 2, 6], [I.COAL, 0.4, 2, 6], [I.ARROW, 0.35, 4, 12], [I.EMERALD, 0.15, 1, 2]],
        mineshaft: [[B.RAIL || (CM.RSFAM && CM.RSFAM.rail.base), 0.6, 4, 12], [I.IRON_INGOT, 0.45, 1, 4], [I.GOLD_INGOT, 0.3, 1, 3], [I.COAL, 0.5, 3, 10], [I.REDSTONE, 0.3, 3, 8], [I.LAPIS, 0.3, 3, 8], [B.TORCH, 0.5, 4, 12],
          [I.BREAD, 0.4, 1, 3], [I.DIAMOND, 0.1, 1, 2], [I.PICKAXE_IRON, 0.15, 1, 1], [I.GOLDEN_APPLE, 0.06, 1, 1], [I.MELON_SEEDS, 0.2, 2, 4], [I.PUMPKIN_SEEDS, 0.2, 2, 4], [I.EMERALD, 0.1, 1, 2]],
        temple: [[I.BONE, 0.6, 3, 8], [I.GOLD_INGOT, 0.55, 2, 7], [I.IRON_INGOT, 0.45, 1, 5], [I.EMERALD, 0.35, 1, 4], [I.DIAMOND, 0.25, 1, 3], [I.SADDLE, 0.2, 1, 1], [I.GOLDEN_APPLE, 0.15, 1, 1],
          [I.SPIDER_EYE, 0.35, 1, 3], [B.SAND, 0.3, 3, 8], [I.GUNPOWDER, 0.3, 1, 4], [I.RUBY, 0.15, 1, 2], [I.SKY_SHARD, 0.08, 1, 1]],
      }[s.t];
      if (!T) return false;
      const its = [];
      for (const [id, p, a, b] of T) if (id !== undefined && r() < p) its.push({ id, count: a + Math.floor(r() * (b - a + 1)) });
      if (CM.DISC_IDS && r() < (s.t === 'dungeon' ? 0.3 : 0.1)) its.push({ id: CM.DISC_IDS[Math.floor(r() * CM.DISC_IDS.length)], count: 1 });
      if (r() < 0.3) {
        const pool = [I.SWORD_IRON, I.PICKAXE_IRON, I.BOW, I.HELMET_IRON, I.BOOTS_GOLD, I.CHESTPLATE_IRON, I.CROSSBOW];
        const id = pool[Math.floor(r() * pool.length)];
        if (id !== undefined && CM.enchantsFor(id).length) its.push({ id, count: 1, ench: CM.rollEnchants(id, 8 + Math.floor(r() * 20), r) });
      }
      const free = [...Array(slots.length).keys()];
      for (const it of its) {
        if (CM.hasWear(it.id)) it.xp = it.xp || 0;
        if (!free.length) break;
        slots[free.splice(Math.floor(r() * free.length), 1)[0]] = it;
      }
      return true;
    },
    // Générateurs actifs (un joueur à moins de 16 blocs) : des créatures apparaissent autour.
    timers: new Map(),
    tick(g, dt) {
      S.t = (S.t || 0) + dt;
      if (S.t < 0.5) return;
      const step = S.t;
      S.t = 0;
      const w = g.world, e = g.entities, pls = e.plist.filter((q) => q.alive !== false);
      if (!pls.length || (CM.gameRule && !CM.gameRule(g, 'mobSpawn')) || g.difficulty === 'peaceful') return;
      const list = S.near(g, pls[0].x, pls[0].z, 40);
      for (const q of pls.slice(1)) for (const sp of S.near(g, q.x, q.z, 40)) if (!list.some((o) => o[0] === sp[0] && o[1] === sp[1] && o[2] === sp[2])) list.push(sp);
      for (const [x, y, z, type] of list) {
        if (!pls.some((q) => Math.hypot(q.x - x - 0.5, q.y - y, q.z - z - 0.5) < 16)) continue;
        const k = g.bkey(x, y, z);
        let t = S.timers.get(k);
        if (t === undefined) t = 2 + Math.random() * 8;
        t -= step;
        if (t <= 0) {
          t = 10 + Math.random() * 30;
          const near = e.mobs.filter((m) => !m.dead && m.type === type && Math.abs(m.x - x) < 9 && Math.abs(m.z - z) < 9 && Math.abs(m.y - y) < 5).length;
          if (near < 5)
            for (let n = 1 + Math.floor(Math.random() * 3), tries = 0; n > 0 && tries < 12; tries++) {
              const X = x + Math.floor((Math.random() - 0.5) * 8), Z = z + Math.floor((Math.random() - 0.5) * 8), Y = y + Math.floor(Math.random() * 3) - 1;
              if (w.solidAt(X, Y, Z) || w.solidAt(X, Y + 1, Z) || !w.solidAt(X, Y - 1, Z) || CM.isFluid(w.get(X, Y, Z))) continue;
              const m = e.addMob(type, X + 0.5, Y, Z + 0.5);
              if (m) m.fromSpawner = true;
              e.burst(CM.Textures.layer.smoke || CM.Textures.layer.white, X + 0.5, Y + 0.8, Z + 0.5, 8, { speed: 1, grav: -1, life: 0.8, size: 0.12 });
              n--;
            }
        }
        S.timers.set(k, t);
      }
      if (S.timers.size > 500) S.timers.clear();
    },
    // Générateurs connus autour de (x, z) : ceux des structures et ceux posés (créatif).
    near(g, x, z, r) {
      const w = g.world, out = [];
      if (w.structures) for (const p of w.spawnersNear(x, z, r)) if (w.loaded(p[0], p[2]) && w.get(p[0], p[1], p[2]) === CM.B.SPAWNER) out.push(p);
      for (const k of (g.special && g.special.spawner) || []) {
        const [a, b, c] = k.split(',').map(Number);
        if (Math.abs(a - x) <= r && Math.abs(c - z) <= r && !out.some((o) => o[0] === a && o[1] === b && o[2] === c)) out.push([a, b, c, SPAWN_TYPES[Math.floor(CM.hash3(a, b, c, 7) * SPAWN_TYPES.length)]]);
      }
      return out;
    },
    // Petites flammes dans les cages proches (chez chaque joueur).
    render(g, dt) {
      const p = g.player;
      S.fxT = (S.fxT || 0) + dt;
      if (S.fxT < 0.12) return;
      S.fxT = 0;
      for (const [x, y, z] of S.near(g, p.x, p.z, 16)) {
        if (Math.hypot(p.x - x, p.y - y, p.z - z) > 16) continue;
        g.entities.burst(CM.Textures.layer.smoke || CM.Textures.layer.white, x + 0.3 + Math.random() * 0.4, y + 0.3 + Math.random() * 0.4, z + 0.3 + Math.random() * 0.4, 1, { speed: 0.2, grav: -1.5, life: 0.6, size: 0.07 });
        if (Math.random() < 0.5) g.entities.burst(CM.Textures.layer.fire_part || CM.Textures.layer.white, x + 0.5, y + 0.5, z + 0.5, 1, { speed: 0.3, grav: -0.5, life: 0.4, size: 0.05, emissive: true });
      }
    },
    // Hôte : une sorcière habite chaque cabane (et, rarement, en rôde une dans la nuit).
    spawnWitch(g, p) {
      const w = g.world, e = g.entities;
      if (!w.structures || w.nether || g.difficulty === 'peaceful') return;
      const hut = w.hutNear(p.x, p.z, 64);
      if (!hut || !w.loaded(hut.x, hut.z) || e.mobs.some((m) => m.type === 'witch' && !m.dead && Math.hypot(m.x - hut.x, m.z - hut.z) < 32)) return;
      if (Math.hypot(p.x - hut.x, p.z - hut.z) < 10) return; // pas sous les yeux du joueur
      e.addMob('witch', hut.x + 0.5, hut.y + 1, hut.z + 0.5);
    },
    // Toile d'araignée : on s'y englue.
    inWeb(w, x, y, z, h) {
      const bx = Math.floor(x), bz = Math.floor(z);
      for (let yy = Math.floor(y); yy <= Math.floor(y + (h || 1.8) - 0.1); yy++) if (CM.blocks[w.get(bx, yy, bz)].web) return true;
      return false;
    },
  });
})();
