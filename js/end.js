'use strict';
// L'End (mondes créés depuis cette version pour les forts souterrains) :
// - Forts souterrains : trois dans chaque monde, à 700-1 200 blocs du centre ; salle du portail
//   (12 cadres autour d'un bassin de lave), couloirs, bibliothèque, réserves avec coffres.
// - Œil de l'End : lancé, il file vers le fort le plus proche ; posé dans les 12 cadres, il
//   allume le portail. Perle de l'Arpenteur : téléportation. Fruit de chorus : petit saut.
// - Dimension de l'End : grande île de pierre de l'End, 10 piliers d'obsidienne coiffés de
//   cristaux qui soignent le dragon, fontaine de socle au centre, îles lointaines avec chorus et
//   tours de purpur (coffres, élytres). Arrivée sur une plateforme d'obsidienne.
// - Le dragon : il tourne autour des piliers, crache des boules de souffle, fonce sur les joueurs,
//   se pose sur la fontaine quand ses cristaux sont détruits. Vaincu : portail de sortie, œuf,
//   élytres, beaucoup d'expérience.
(function () {
  const { H, MINY } = CM.WORLD;
  const lidx = (lx, y, lz) => ((y - MINY) << 8) | (lz << 4) | lx;
  const Wp = CM.World.prototype, Ep = CM.Entities.prototype, mat4 = CM.mat4;
  const TAU = Math.PI * 2;
  const TOP = 52; // surface de l'île centrale
  const PILLARS = 10, PR = 43;
  const CELL = 80, INNER = 115; // îles lointaines : une par case de 80 blocs, au-delà de 115

  const E = (CM.End = {
    ARRIVAL: { x: 60.5, y: TOP + 1, z: 0.5 },
    clouds: [], // nuages de souffle du dragon (hôte : dégâts ; invités : particules)
    t: 0,
  });

  // ============================================== îles de l'End =====
  const noise = (w) => w.nD;
  const pillarOf = (w, i) => {
    const a = (i / PILLARS) * TAU + CM.hash3(w.seed, 3, 7, 1) * 0.3;
    const r = 2 + Math.floor(CM.hash3(i, w.seed, 5, 2) * 3);
    const top = Math.min(H - 4, TOP + 18 + Math.floor(CM.hash3(i, 9, w.seed, 3) * 22));
    return { x: Math.round(Math.cos(a) * PR), z: Math.round(Math.sin(a) * PR), r, top };
  };
  E.pillar = pillarOf;
  // Rayon de l'île centrale dans la direction de (x, z).
  const mainR = (w, x, z) => 68 + noise(w).noise2(Math.atan2(z, x) * 2.2 + 5, 3.1) * 8;
  // Île lointaine d'une case (ou null).
  Wp.endIslandAt = function (gx, gz) {
    const k = gx + ',' + gz, c = this._eic || (this._eic = new Map());
    if (c.has(k)) return c.get(k);
    const rand = CM.rng((CM.hash3(gx, 777, gz, this.seed) * 4294967296) >>> 0);
    let v = null;
    if (rand() < 0.6) {
      const x = gx * CELL + 16 + Math.floor(rand() * (CELL - 32)), z = gz * CELL + 16 + Math.floor(rand() * (CELL - 32));
      if (Math.hypot(x, z) > INNER) {
        const r = 5 + Math.floor(rand() * 9), y = 40 + Math.floor(rand() * 22);
        v = { x, z, y, r, tower: r >= 9 && rand() < 0.4, seed: Math.floor(rand() * 1e9) };
        if (v.tower) v.chest = [x, y + 2, z];
      }
    }
    if (c.size > 2000) c.clear();
    c.set(k, v);
    return v;
  };
  Wp.endColumn = function (x, z) {
    const r = Math.hypot(x, z);
    let h = MINY;
    if (r < mainR(this, x, z)) h = TOP + Math.round(noise(this).noise2(x / 30, z / 30) * 1.2);
    else {
      const is = this.endIslandAt(Math.floor(x / CELL), Math.floor(z / CELL));
      if (is && Math.hypot(x - is.x, z - is.z) < is.r) h = is.y;
    }
    return { h, bi: CM.BIO.THE_END, topB: CM.B.END_STONE, end: true };
  };
  // Remplit un tronçon de l'End (appelé par world.js).
  Wp.fillEnd = function (c) {
    const B = CM.B, blocks = c.blocks, x0 = c.x0, z0 = c.z0, n = noise(this);
    const put = (x, y, z, id) => {
      const lx = x - x0, lz = z - z0;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y <= MINY || y >= H) return;
      blocks[lidx(lx, y, lz)] = id;
    };
    // île centrale : dessus presque plat, dessous en cône bosselé
    for (let lz = 0; lz < 16; lz++)
      for (let lx = 0; lx < 16; lx++) {
        const x = x0 + lx, z = z0 + lz, r = Math.hypot(x, z), R = mainR(this, x, z);
        if (r < R) {
          const top = TOP + Math.round(n.noise2(x / 30, z / 30) * 1.2);
          const f = 1 - (r / R) ** 2;
          const depth = 3 + Math.floor(f * 30 + n.noise2(x / 12 + 9, z / 12) * 4 * f);
          for (let y = top - depth; y <= top; y++) put(x, y, z, B.END_STONE);
        }
      }
    // piliers d'obsidienne (socle au sommet : un cristal s'y pose)
    for (let i = 0; i < PILLARS; i++) {
      const p = pillarOf(this, i);
      if (p.x + p.r < x0 || p.x - p.r > x0 + 15 || p.z + p.r < z0 || p.z - p.r > z0 + 15) continue;
      for (let dz = -p.r; dz <= p.r; dz++)
        for (let dx = -p.r; dx <= p.r; dx++) {
          if (dx * dx + dz * dz > p.r * p.r + 1) continue;
          for (let y = TOP - 6; y <= p.top; y++) put(p.x + dx, y, p.z + dz, B.OBSIDIAN);
        }
      put(p.x, p.top + 1, p.z, B.BEDROCK);
    }
    // fontaine de socle au centre (portail de sortie après la victoire)
    if (x0 <= 4 && x0 + 15 >= -4 && z0 <= 4 && z0 + 15 >= -4) {
      const won = this.endWon;
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.hypot(dx, dz);
          if (d > 3.6) continue;
          put(dx, TOP - 1, dz, B.BEDROCK);
          if (d > 2.6) put(dx, TOP, dz, B.BEDROCK);
          else put(dx, TOP, dz, won && (dx || dz) ? B.END_PORTAL : 0);
          for (let y = TOP + 1; y <= TOP + 3; y++) put(dx, y, dz, 0);
        }
      for (let y = TOP; y <= TOP + 3; y++) put(0, y, 0, B.BEDROCK);
    }
    // îles lointaines, chorus, tours de purpur
    for (let gz = Math.floor((z0 - 20) / CELL); gz <= Math.floor((z0 + 35) / CELL); gz++)
      for (let gx = Math.floor((x0 - 20) / CELL); gx <= Math.floor((x0 + 35) / CELL); gx++) {
        const is = this.endIslandAt(gx, gz);
        if (!is || is.x + is.r + 3 < x0 || is.x - is.r - 3 > x0 + 15 || is.z + is.r + 3 < z0 || is.z - is.r - 3 > z0 + 15) continue;
        for (let dz = -is.r; dz <= is.r; dz++)
          for (let dx = -is.r; dx <= is.r; dx++) {
            const d = Math.hypot(dx, dz);
            if (d >= is.r) continue;
            const depth = 1 + Math.floor((1 - (d / is.r) ** 2) * is.r * 0.8);
            for (let y = is.y - depth; y <= is.y; y++) put(is.x + dx, y, is.z + dz, B.END_STONE);
          }
        const rand = CM.rng(is.seed >>> 0);
        if (is.tower) {
          // tour de purpur : 5 × 5, creuse, porte, coffre au milieu
          for (let y = is.y + 1; y <= is.y + 7; y++)
            for (let dz = -2; dz <= 2; dz++)
              for (let dx = -2; dx <= 2; dx++) {
                const wall = Math.abs(dx) === 2 || Math.abs(dz) === 2, roof = y === is.y + 7, door = dz === 2 && dx === 0 && y <= is.y + 2;
                put(is.x + dx, y, is.z + dz, roof || (wall && !door) ? (Math.abs(dx) === 2 && Math.abs(dz) === 2 ? B.PURPUR_PILLAR : B.PURPUR_BLOCK) : 0);
              }
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) put(is.x + dx, is.y + 1, is.z + dz, B.PURPUR_BLOCK);
          put(is.chest[0], is.chest[1], is.chest[2], B.CHEST);
          if (B.LANTERN !== undefined) put(is.x + 1, is.y + 2, is.z - 1, B.LANTERN);
        }
        // plantes de chorus
        const nPl = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < nPl; k++) {
          const a = rand() * TAU, rr = rand() * (is.r - 2);
          const px = Math.round(is.x + Math.cos(a) * rr), pz = Math.round(is.z + Math.sin(a) * rr);
          if (is.tower && Math.abs(px - is.x) <= 3 && Math.abs(pz - is.z) <= 3) continue;
          const hgt = 3 + Math.floor(rand() * 5);
          for (let y = 1; y <= hgt; y++) put(px, is.y + y, pz, B.CHORUS_PLANT);
          for (let b = 0; b < 2; b++) {
            const [ox, oz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)];
            const by = is.y + 2 + Math.floor(rand() * (hgt - 1));
            put(px + ox, by, pz + oz, B.CHORUS_PLANT);
            put(px + ox, by + 1, pz + oz, B.CHORUS_PLANT);
          }
        }
      }
  };

  // Plateforme d'obsidienne d'arrivée (hôte) : renvoie le point où l'on apparaît.
  E.platform = function (g, w) {
    const B = CM.B, X = 60, Z = 0;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        if (w.get(X + dx, TOP, Z + dz) !== B.OBSIDIAN) w.setBlock(X + dx, TOP, Z + dz, B.OBSIDIAN);
        for (let y = TOP + 1; y <= TOP + 3; y++) if (w.get(X + dx, y, Z + dz)) w.setBlock(X + dx, y, Z + dz, 0);
      }
    return { x: X + 0.5, y: TOP + 1, z: Z + 0.5 };
  };

  // ============================================ forts souterrains ===
  // Trois forts par monde (générateur 7 et plus), en anneau autour du centre.
  Wp.strongholds = function () {
    if (this._sh) return this._sh;
    const out = [], a0 = CM.hash3(this.seed, 41, 7, 3) * TAU;
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * TAU) / 3 + (CM.hash3(k, this.seed, 9, 4) - 0.5) * 0.6;
      const d = 700 + CM.hash3(k, 13, this.seed, 5) * 500;
      const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d);
      const h = this.column(x, z).h;
      const y = Math.max(MINY + 12, Math.min(24, h - 18));
      out.push({ x, y, z, i: k });
    }
    return (this._sh = out);
  };
  E.nearestStronghold = function (w, x, z) {
    if (!w.caveBiomes || !w.strongholds) return null;
    let best = null, bd = Infinity;
    for (const s of w.strongholds()) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };
  // Pièces du fort : [x0, y0, z0, x1, y1, z1] (murs compris), ouvertures, coffres.
  const shRooms = (s) => {
    const { x, y, z } = s;
    return {
      rooms: [
        [x - 6, y, z - 7, x + 6, y + 7, z + 7], // salle du portail
        [x + 7, y, z - 2, x + 30, y + 4, z + 2], // couloir est
        [x - 30, y, z - 2, x - 7, y + 4, z + 2], // couloir ouest
        [x - 2, y, z - 30, x + 2, y + 4, z - 8], // couloir nord
        [x - 2, y, z + 8, x + 2, y + 4, z + 30], // couloir sud
        [x + 31, y, z - 5, x + 41, y + 7, z + 5], // bibliothèque
        [x - 39, y, z - 4, x - 31, y + 5, z + 4], // réserve
        [x - 4, y, z - 38, x + 4, y + 5, z - 31], // cellier
        [x - 4, y, z + 31, x + 4, y + 5, z + 38], // salle sud
      ],
      chests: [[x + 36, y + 1, z], [x - 35, y + 1, z - 2], [x - 35, y + 1, z + 2], [x, y + 1, z - 35], [x + 2, y + 1, z + 35]],
    };
  };
  Wp.strongholdsFor = function (c) {
    const B = CM.B, blocks = c.blocks, x0 = c.x0, z0 = c.z0;
    for (const s of this.strongholds()) {
      if (s.x + 45 < x0 || s.x - 45 > x0 + 15 || s.z + 45 < z0 || s.z - 45 > z0 + 15) continue;
      const put = (x, y, z, id) => {
        const lx = x - x0, lz = z - z0;
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y <= MINY || y >= H) return;
        blocks[lidx(lx, y, lz)] = id;
      };
      const brick = (x, y, z) => {
        const h = CM.hash3(x, y, z, s.i + 77);
        return h < 0.15 ? B.MOSSY_STONEBRICK : h < 0.3 ? B.CRACKED_STONEBRICK : B.STONEBRICK;
      };
      const { rooms, chests } = shRooms(s);
      // pièces : murs de pierre taillée, intérieur vide
      for (const [ax, ay, az, bx, by, bz] of rooms)
        for (let yy = ay; yy <= by; yy++)
          for (let zz = Math.max(az, z0); zz <= Math.min(bz, z0 + 15); zz++)
            for (let xx = Math.max(ax, x0); xx <= Math.min(bx, x0 + 15); xx++) {
              const wall = xx === ax || xx === bx || zz === az || zz === bz || yy === ay || yy === by;
              put(xx, yy, zz, wall ? brick(xx, yy, zz) : 0);
            }
      // passages entre la salle et les couloirs, et au bout des couloirs
      const { x, y, z } = s;
      for (let yy = y + 1; yy <= y + 3; yy++)
        for (let k = -1; k <= 1; k++) {
          for (const xx of [x + 6, x + 7, x - 6, x - 7, x + 30, x + 31, x - 30, x - 31]) put(xx, yy, z + k, 0);
          for (const zz of [z - 7, z - 8, z + 7, z + 8, z - 30, z - 31, z + 30, z + 31]) put(x + k, yy, zz, 0);
        }
      // salle du portail : bassin de lave, 12 cadres (quelques-uns ont déjà leur œil)
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y, z + dz, B.LAVA);
      for (let k = -1; k <= 1; k++)
        for (const [fx, fz] of [[x - 2, z + k], [x + 2, z + k], [x + k, z - 2], [x + k, z + 2]]) put(fx, y + 1, fz, CM.hash3(fx, s.i, fz, 91) < 0.1 ? B.END_PORTAL_FRAME_EYE : B.END_PORTAL_FRAME);
      for (const [cx, cz] of [[x - 2, z - 2], [x + 2, z - 2], [x - 2, z + 2], [x + 2, z + 2]]) put(cx, y + 1, cz, B.STONEBRICK);
      // lumières
      if (B.LANTERN !== undefined) {
        for (const [lx2, lz2] of [[x - 5, z - 6], [x + 5, z - 6], [x - 5, z + 6], [x + 5, z + 6], [x + 18, z + 1], [x - 18, z - 1], [x + 1, z - 18], [x - 1, z + 18]]) put(lx2, y + 1, lz2, B.LANTERN);
        for (const [lx2, lz2] of [[x + 36, z + 4], [x - 35, z], [x, z - 34], [x, z + 34]]) put(lx2, y + 1, lz2, B.LANTERN);
      }
      // bibliothèque : rayonnages le long des murs
      if (B.BOOKSHELF !== undefined)
        for (let yy = y + 1; yy <= y + 4; yy++) {
          for (let zz = z - 4; zz <= z + 4; zz++) {
            put(x + 32, yy, zz, zz >= z - 1 && zz <= z + 1 && yy <= y + 3 ? 0 : B.BOOKSHELF);
            put(x + 40, yy, zz, B.BOOKSHELF);
          }
          for (let xx = x + 33; xx <= x + 39; xx++) {
            put(xx, yy, z - 4, B.BOOKSHELF);
            put(xx, yy, z + 4, B.BOOKSHELF);
          }
        }
      for (const ch of chests) put(ch[0], ch[1], ch[2], B.CHEST);
    }
  };

  // ------------------------------------------------------------ butin --
  const lootOf = (r, table) => {
    const out = [];
    for (const [id, p, a, b] of table) if (id !== undefined && r() < p) out.push({ id, count: a + Math.floor(r() * (b - a + 1)) });
    return out;
  };
  E.fillLoot = function (g, slots, x, y, z) {
    const w = g.world, I = CM.I, B = CM.B;
    const r = CM.rng((CM.hash3(x, y, z, w.seed + 4242) * 4294967296) >>> 0);
    let its = null;
    if (w.end) {
      const is = w.endIslandAt(Math.floor(x / CELL), Math.floor(z / CELL));
      if (!is || !is.chest || is.chest[0] !== x || is.chest[1] !== y || is.chest[2] !== z) return false;
      its = lootOf(r, [[I.ELYTRA, 0.35, 1, 1], [I.DIAMOND, 0.5, 1, 4], [I.IRON_INGOT, 0.6, 3, 8], [I.GOLD_INGOT, 0.6, 2, 7], [I.EMERALD, 0.35, 2, 6],
        [I.ENDER_PEARL, 0.4, 1, 3], [I.CHORUS_FRUIT, 0.5, 2, 6], [I.GOLDEN_APPLE, 0.2, 1, 2], [I.CHESTPLATE_DIAMOND, 0.12, 1, 1], [I.SWORD_DIAMOND, 0.12, 1, 1]]);
    } else if (w.caveBiomes && w.strongholds) {
      const s = w.strongholds().find((q) => Math.abs(q.x - x) < 45 && Math.abs(q.z - z) < 45);
      if (!s || !shRooms(s).chests.some((c) => c[0] === x && c[1] === y && c[2] === z)) return false;
      its = lootOf(r, [[I.ENDER_PEARL, 0.5, 1, 3], [I.IRON_INGOT, 0.6, 2, 6], [I.GOLD_INGOT, 0.35, 1, 4], [I.BREAD, 0.5, 1, 4], [I.APPLE, 0.4, 1, 3],
        [I.REDSTONE, 0.3, 3, 8], [I.DIAMOND, 0.15, 1, 2], [I.GOLDEN_APPLE, 0.08, 1, 1], [I.BOOK, 0.4, 1, 3], [I.PAPER, 0.35, 2, 8],
        [I.HELMET_IRON, 0.1, 1, 1], [I.SWORD_IRON, 0.1, 1, 1], [I.EYE_OF_ENDER, 0.06, 1, 1], [B.TORCH, 0.3, 4, 10]]);
    } else return false;
    for (const it of its) {
      if (CM.hasWear && CM.hasWear(it.id)) it.xp = 0;
      let i = Math.floor(r() * slots.length);
      for (let t = 0; t < slots.length && slots[i]; t++) i = (i + 1) % slots.length;
      if (!slots[i]) slots[i] = it;
    }
    return true;
  };

  // ======================================== portail : les 12 yeux ===
  // Hôte : chaque modification de bloc (un œil posé dans un cadre) passe par ici.
  E.onEdit = function (g, dim, x, y, z, id) {
    if (g.net.isClient || dim !== 'overworld' || id !== CM.B.END_PORTAL_FRAME_EYE) return;
    const w = g.world, B = CM.B;
    for (let cz = z - 3; cz <= z + 3; cz++)
      for (let cx = x - 3; cx <= x + 3; cx++) {
        let ok = true;
        for (let k = -1; k <= 1 && ok; k++)
          for (const [fx, fz] of [[cx - 2, cz + k], [cx + 2, cz + k], [cx + k, cz - 2], [cx + k, cz + 2]])
            if (w.get(fx, y, fz) !== B.END_PORTAL_FRAME_EYE) {
              ok = false;
              break;
            }
        if (!ok) continue;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(cx + dx, y, cz + dz, B.END_PORTAL);
        const s = '🌌 Le portail de l’End s’ouvre !';
        g.ui.toast(s, 'gold', 'endportal');
        g.net.sys(s);
        if (g.net.isHost) g.net.broadcast({ t: 'rtoast', s, k: 'good', id: 'endportal' });
        CM.Audio.play('portal');
        return;
      }
  };

  // ======================================== objets : œil, perle ===
  E.use = function (p, info, t) {
    const g = p.game, w = g.world, B = CM.B;
    if (info.type === 'eye' && t && w.get(t.x, t.y, t.z) === B.END_PORTAL_FRAME) {
      w.setBlock(t.x, t.y, t.z, B.END_PORTAL_FRAME_EYE);
      if (!p.creative) p.consume(1);
      p.swing = 1;
      CM.Audio.play('place', { mat: 'stone' });
      g.entities.burst(CM.Textures.layer.frame_eye || CM.Textures.layer.white, t.x + 0.5, t.y + 1, t.z + 0.5, 8, { speed: 1, grav: -1, life: 0.8, size: 0.06, emissive: true });
      return;
    }
    if (info.type === 'eye' && t && CM.blocks[w.get(t.x, t.y, t.z)].frame) return;
    const e = p.eye(), d = p.aim();
    const sp = info.type === 'pearl' ? 22 : 10;
    g.entities.shootArrow(e[0] + d[0] * 0.5, e[1] + d[1] * 0.5 - 0.1, e[2] + d[2] * 0.5, d[0] * sp, d[1] * sp + (info.type === 'pearl' ? 2 : 3), d[2] * sp, p, info.type, info.id);
    if (!p.creative || info.type === 'eye') p.consume(1);
    p.swing = 1;
    CM.Audio.play('bow', { pitch: 1.4 });
  };
  // Fruit de chorus : un saut de 8 blocs au plus, sur une case libre.
  E.chorusHop = function (p) {
    const g = p.game, w = g.world;
    for (let t = 0; t < 16; t++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * 16), z = Math.floor(p.z + (Math.random() - 0.5) * 16);
      for (let y = Math.floor(p.y) + 4; y > p.y - 8; y--) {
        if (!w.solidAt(x, y - 1, z) || w.solidAt(x, y, z) || w.solidAt(x, y + 1, z) || CM.isFluid(w.get(x, y, z))) continue;
        tpFx(g, p.x, p.y, p.z);
        p.x = x + 0.5;
        p.y = y;
        p.z = z + 0.5;
        p.vx = p.vy = p.vz = 0;
        p.fallStart = p.y;
        tpFx(g, p.x, p.y, p.z);
        return;
      }
    }
  };
  const tpFx = (g, x, y, z) => {
    g.entities.burst(CM.Textures.layer.dbreath || CM.Textures.layer.white, x, y + 1, z, 16, { speed: 2, grav: 0, life: 0.8, size: 0.06, emissive: true });
    CM.Audio.play('teleport');
  };
  // Une créature se téléporte près de (cx, cz) (Arpenteur).
  E.teleportMob = function (e, m, cx, cz, rad) {
    const w = e.game.world;
    for (let t = 0; t < 12; t++) {
      const x = Math.floor(cx + (e.rand() - 0.5) * 2 * rad), z = Math.floor(cz + (e.rand() - 0.5) * 2 * rad);
      if (!w.loaded(x, z)) continue;
      const y = w.groundBelow(x, Math.floor(m.y) + 8, z) + 1;
      if (y <= MINY + 1 || w.solidAt(x, y, z) || w.solidAt(x, y + 1, z) || w.solidAt(x, y + 2, z) || CM.isFluid(w.get(x, y - 1, z))) continue;
      e.burst(CM.Textures.layer.dbreath || CM.Textures.layer.white, m.x, m.y + 1.4, m.z, 14, { speed: 2, grav: 0, life: 0.7, size: 0.06, emissive: true });
      m.x = x + 0.5;
      m.y = y;
      m.z = z + 0.5;
      m.vx = m.vy = m.vz = 0;
      e.burst(CM.Textures.layer.dbreath || CM.Textures.layer.white, m.x, m.y + 1.4, m.z, 14, { speed: 2, grav: 0, life: 0.7, size: 0.06, emissive: true });
      if (Math.hypot(e.game.player.x - m.x, e.game.player.z - m.z) < 24) CM.Audio.play('teleport');
      return true;
    }
    return false;
  };

  // ------------------------------------------- projectiles de l'End --
  const upd0 = Ep.updateSpecialArrow, ren0 = Ep.renderSpecialArrow;
  const hitPlayerAt = (ents, a, x, y, z, rad) => {
    for (const q of ents.plist) {
      if (q.alive === false || q === a.shooter) continue;
      if (Math.abs(q.x - x) < rad && y > q.y - 0.3 && y < q.y + 2 && Math.abs(q.z - z) < rad) return q;
    }
    return null;
  };
  Ep.updateSpecialArrow = function (a, dt) {
    if (a.kind !== 'pearl' && a.kind !== 'eye' && a.kind !== 'dbreath') return upd0.call(this, a, dt);
    const g = this.game, w = g.world, L = CM.Textures.layer;
    if (a.kind === 'eye') return eyeFlight(this, a, dt);
    const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, nz = a.z + a.vz * dt;
    let hit = w.solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz)) || ny < MINY - 5;
    let who = null;
    if (!hit) {
      who = hitPlayerAt(this, a, nx, ny, nz, 0.7);
      if (!who && a.kind === 'pearl') for (const m of this.mobs) if (!m.dead && m !== a.shooter && Math.abs(m.x - nx) < m.hw + 0.2 && ny > m.y && ny < m.y + m.h && Math.abs(m.z - nz) < m.hw + 0.2) who = m;
      if (who) hit = true;
    }
    if (hit || a.age > 12) {
      a.dead = true;
      if (a.kind === 'pearl') pearlLand(this, a);
      else breathLand(this, a, who);
      return true;
    }
    a.x = nx;
    a.y = ny;
    a.z = nz;
    if (a.kind === 'pearl') a.vy -= 20 * dt;
    if (Math.random() < dt * 30) this.burst(a.kind === 'pearl' ? L.ender_pearl : L.dbreath, a.x, a.y, a.z, 1, { speed: 0.3, grav: 0, life: 0.5, size: 0.06, emissive: true });
    return true;
  };
  // La perle retombe : son lanceur est téléporté là (5 points de dégâts).
  function pearlLand(ents, a) {
    const g = ents.game, w = g.world, q = a.shooter;
    let x = a.x, y = a.y, z = a.z;
    if (w.solidAt(Math.floor(x), Math.floor(y), Math.floor(z))) y = Math.floor(y) + 1;
    tpFx(g, x, y, z);
    if (!q || q.alive === false || y < MINY) return;
    if (q === g.player) {
      tpFx(g, q.x, q.y, q.z);
      q.x = x;
      q.y = y;
      q.z = z;
      q.vx = q.vy = q.vz = 0;
      q.fallStart = q.y;
      if (!q.creative) q.damage(5, null, null, 'Une perle de l’Arpenteur', true);
    } else if (q.pid !== undefined) {
      g.net.sendTo(q.pid, { t: 'act', a: { a: 'tp', x, y, z } });
      q.damage(5, null, null, 'Une perle de l’Arpenteur', true, 0);
    }
  }
  // Boule de souffle du dragon : dégâts autour et nuage violet qui brûle quelques secondes.
  function breathLand(ents, a, who) {
    const g = ents.game;
    for (const q of ents.plist) {
      if (q.alive === false) continue;
      if (Math.hypot(q.x - a.x, q.y + 0.9 - a.y, q.z - a.z) > 3) continue;
      if (q === g.player) q.damage(6, a.x, a.z, 'Le souffle du dragon', false, a.shooter && a.shooter.type ? a.shooter : null);
      else q.damage(6, a.x, a.z, 'Le souffle du dragon', false, 0, a.shooter && a.shooter.type ? a.shooter : null);
    }
    const c = { x: a.x, y: a.y, z: a.z, t: 5 };
    E.clouds.push(c);
    g.net.fx({ k: 'dcloud', x: a.x, y: a.y, z: a.z });
    CM.Audio.play('explode', { pitch: 1.4, vol: 0.5 });
  }
  // Œil de l'End : il file vers le fort le plus proche, puis retombe (ou se brise).
  function eyeFlight(ents, a, dt) {
    const g = ents.game, w = g.world;
    if (a.tgt === undefined) {
      const s = w.nether || w.end ? null : E.nearestStronghold(w, a.x, a.z);
      a.tgt = s ? [s.x + 0.5, s.z + 0.5] : null;
      a.vx = a.vz = 0;
      if (!s) {
        const msg = w.nether || w.end ? 'L’œil ne trouve aucun fort dans cette dimension.' : 'L’œil ne trouve aucun fort (monde trop ancien).';
        if (a.shooter === g.player) g.ui.toast(msg, 'warn', 'eye');
        else if (a.shooter && a.shooter.pid !== undefined) g.net.sendTo(a.shooter.pid, { t: 'rtoast', s: msg, k: 'warn' });
      }
    }
    if (a.tgt) {
      const dx = a.tgt[0] - a.x, dz = a.tgt[1] - a.z, d = Math.hypot(dx, dz);
      const sp = Math.min(9, d / Math.max(dt, 1e-3));
      a.vx = d > 0.3 ? (dx / d) * sp : 0;
      a.vz = d > 0.3 ? (dz / d) * sp : 0;
      // presque arrivé : il plonge vers le sol
      if (d < 12) a.vy = -2;
    }
    a.vy = a.age < 1.1 ? 3.2 : Math.max(-1, a.vy - dt * 2);
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.z += a.vz * dt;
    if (Math.random() < dt * 30) ents.burst(CM.Textures.layer.frame_eye || CM.Textures.layer.white, a.x, a.y, a.z, 1, { speed: 0.2, grav: 0, life: 0.6, size: 0.05, emissive: true });
    if (a.age > 2.6) {
      a.dead = true;
      if (Math.random() < 0.8) ents.addDrop(CM.I.EYE_OF_ENDER, 1, a.x, a.y, a.z, null, [0, 1, 0]);
      else {
        ents.burst(CM.Textures.layer.frame_eye || CM.Textures.layer.white, a.x, a.y, a.z, 16, { speed: 2, grav: 4, life: 0.8, size: 0.07 });
        CM.Audio.play('break', { mat: 'glass' });
      }
    }
    return true;
  }
  Ep.renderSpecialArrow = function (batch, a, l) {
    if (a.kind !== 'pearl' && a.kind !== 'eye' && a.kind !== 'dbreath') return ren0.call(this, batch, a, l);
    const L = CM.Textures.layer, t = (a.age || 0) * 4 + a.uid;
    mat4.compose(this.M, a.x, a.y, a.z, t, t * 0.7, 0, 1);
    const s = a.kind === 'dbreath' ? 0.35 : 0.12;
    batch.box(this.M, -s, -s, -s, s, s, s, a.kind === 'pearl' ? L.ender_pearl : a.kind === 'eye' ? L.eye_of_ender : L.dbreath, 1, 1, 1);
    return true;
  };
  const remote0 = Ep.updateExtraRemote;
  if (remote0)
    Ep.updateExtraRemote = function (dt) {
      remote0.call(this, dt);
      for (const a of this.arrows || []) if (a.kind === 'pearl' || a.kind === 'eye' || a.kind === 'dbreath') a.age = (a.age || 0) + dt;
    };

  // =========================================== créatures de l'End ===
  Ep.spawnEnd = function (p, w, r) {
    const g = this.game;
    if (g.difficulty === 'peaceful') return;
    let n = 0;
    for (const m of this.mobs) if (m.type === 'arpenteur' && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 64) n++;
    if (n >= 6 || r() > 0.4) return;
    for (let t = 0; t < 6; t++) {
      const a = r() * TAU, d = 18 + r() * 26, x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.loaded(x, z)) continue;
      const y = w.groundBelow(x, H - 1, z);
      if (y <= MINY || w.get(x, y, z) !== CM.B.END_STONE || w.solidAt(x, y + 1, z) || w.solidAt(x, y + 2, z) || w.solidAt(x, y + 3, z)) continue;
      this.addMob('arpenteur', x + 0.5, y + 1, z + 0.5);
      return;
    }
  };

  // ============================================ combat du dragon ===
  // g.endState : { dragon: 0 vivant / 1 vaincu, init, crystals: [piliers], dhp, elytra }
  E.onEnter = function (g) {
    const st = g.endState;
    if (!st.init) {
      st.init = 1;
      st.crystals = [...Array(PILLARS).keys()];
      st.dhp = MOBS().ender_dragon.hp;
    }
  };
  const MOBS = () => CM.MOBS;
  // Hôte, dans l'End : le dragon et ses cristaux existent tant que la partie en a besoin.
  E.tick = function (g, dt) {
    if (g.dim !== 'end' || g.net.isClient) return;
    const w = g.world, e = g.entities, st = g.endState;
    E.t -= dt;
    // nuages de souffle
    for (const c of E.clouds) {
      c.t -= dt;
      c.hurt = (c.hurt || 0) - dt;
      if (c.hurt > 0) continue;
      c.hurt = 0.5;
      for (const q of e.plist) {
        if (q.alive === false || Math.hypot(q.x - c.x, q.z - c.z) > 2.6 || Math.abs(q.y - c.y) > 2.5) continue;
        if (q === g.player) q.damage(1.5, null, null, 'Le souffle du dragon', true);
        else q.damage(1.5, null, null, 'Le souffle du dragon', true, 0);
      }
    }
    E.clouds = E.clouds.filter((c) => c.t > 0);
    if (E.t > 0) return;
    E.t = 0.5;
    E.onEnter(g);
    if (st.dragon) return;
    if (!e.plist.some((q) => q.alive !== false)) return;
    // cristaux au sommet des piliers
    for (const i of st.crystals || []) {
      const p = pillarOf(w, i);
      if (!w.loaded(p.x, p.z) || e.mobs.some((m) => m.type === 'end_crystal' && !m.dead && m.pillar === i)) continue;
      const m = e.addMob('end_crystal', p.x + 0.5, p.top + 2, p.z + 0.5);
      m.pillar = i;
      m.ai.home = [p.x + 0.5, p.top + 2, p.z + 0.5];
    }
    // le dragon
    const dr = e.mobs.find((m) => m.type === 'ender_dragon' && !m.dead);
    if (dr) st.dhp = Math.ceil(dr.hp);
    else if (w.loaded(0, 0)) {
      const m = e.addMob('ender_dragon', 30, 76, 0);
      m.hp = Math.max(1, st.dhp || m.maxHp);
      CM.Audio.play('roar');
    }
  };
  // Cristal le plus proche qui soigne le dragon (à 45 blocs au plus).
  const healer = (e, m) => {
    let best = null, bd = 45;
    for (const o of e.mobs) {
      if (o.type !== 'end_crystal' || o.dead) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y, o.z - m.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  };
  E.dragonAI = function (e, m, dt) {
    const g = e.game, r = e.rand, ai = m.ai;
    if (!ai.ph) {
      ai.ph = 'circle';
      ai.ang = Math.atan2(m.z, m.x);
      ai.t = 0;
      ai.shootT = 3;
      ai.diveT = 12;
      ai.perchT = 20;
      ai.vx = ai.vy = ai.vz = 0;
    }
    ai.t += dt;
    ai.hitCd = Math.max(0, (ai.hitCd || 0) - dt);
    // les cristaux le soignent (un rayon les relie)
    const cr = healer(e, m);
    for (const o of e.mobs) if (o.type === 'end_crystal') o.ai.special = o === cr;
    if (cr) m.hp = Math.min(m.maxHp, m.hp + 2 * dt);
    const players = e.plist.filter((q) => q.alive !== false && Math.hypot(q.x, q.z) < 160);
    const crystals = e.mobs.some((o) => o.type === 'end_crystal' && !o.dead) || (g.endState.crystals || []).length > 0;
    let tx, ty, tz, speed = 13;
    m.ai.chasing = ai.ph === 'dive' || ai.ph === 'perch';
    if (ai.ph === 'circle') {
      ai.ang += dt * 0.3;
      tx = Math.cos(ai.ang) * 38;
      tz = Math.sin(ai.ang) * 38;
      ty = TOP + 22 + Math.sin(ai.t * 0.6) * 5;
      ai.shootT -= dt;
      ai.diveT -= dt;
      ai.perchT -= dt;
      if (players.length && ai.shootT <= 0) {
        ai.shootT = 3.5 + r() * 3.5;
        const q = players[Math.floor(r() * players.length)];
        const dx = q.x - m.x, dy = q.y + 1 - (m.y + 1), dz = q.z - m.z, d = Math.hypot(dx, dy, dz) || 1;
        e.shootArrow(m.x - Math.sin(m.yaw) * 4, m.y + 1.2, m.z - Math.cos(m.yaw) * 4, (dx / d) * 18, (dy / d) * 18, (dz / d) * 18, m, 'dbreath', 0);
        CM.Audio.play('roar', { pitch: 1.3 });
      }
      if (players.length && ai.diveT <= 0) {
        ai.ph = 'dive';
        ai.t = 0;
        ai.tgt = players.reduce((a, b) => (Math.hypot(a.x - m.x, a.z - m.z) < Math.hypot(b.x - m.x, b.z - m.z) ? a : b));
      } else if (players.length && !crystals && ai.perchT <= 0) {
        ai.ph = 'perch';
        ai.t = 0;
      }
    } else if (ai.ph === 'dive') {
      const q = ai.tgt;
      speed = 20;
      if (!q || q.alive === false || ai.t > 4.5) ai.ph = 'climb';
      else {
        tx = q.x;
        ty = q.y + 1;
        tz = q.z;
      }
    } else if (ai.ph === 'perch') {
      // posé sur la fontaine : il crache son souffle autour de lui
      speed = 10;
      tx = 0;
      ty = TOP + 5;
      tz = 0;
      if (Math.hypot(m.x, m.z) < 3 && ai.t > 2) {
        speed = 0;
        ai.breath = (ai.breath || 0) - dt;
        if (ai.breath <= 0) {
          ai.breath = 1.2;
          const a = r() * TAU, c = { x: Math.cos(a) * 4, y: TOP + 1, z: Math.sin(a) * 4, t: 3 };
          E.clouds.push(c);
          g.net.fx({ k: 'dcloud', x: c.x, y: c.y, z: c.z });
        }
      }
      if (ai.t > 14) ai.ph = 'climb';
    }
    if (ai.ph === 'climb') {
      speed = 12;
      tx = Math.cos(ai.ang) * 38;
      tz = Math.sin(ai.ang) * 38;
      ty = TOP + 24;
      if (m.y > TOP + 18) {
        ai.ph = 'circle';
        ai.diveT = 12 + r() * 10;
        ai.perchT = 25 + r() * 15;
        ai.t = 0;
      }
    }
    // coups en passant (et à la fin d'un piqué)
    if (ai.hitCd <= 0)
      for (const q of players) {
        const d = Math.hypot(q.x - m.x, q.y + 0.9 - (m.y + 1.2), q.z - m.z);
        if (d > 3.4) continue;
        ai.hitCd = 1.2;
        const n = ai.ph === 'dive' ? 10 : 5;
        const dx = q.x - m.x, dz = q.z - m.z, dd = Math.hypot(dx, dz) || 1;
        if (q === g.player) {
          q.damage(n, m.x, m.z, 'Le dragon de l’End', false, m);
          if (q.alive) {
            q.vx += (dx / dd) * 10;
            q.vz += (dz / dd) * 10;
            q.vy = Math.max(q.vy, 9);
          }
        } else q.damage(n, m.x, m.z, 'Le dragon de l’End', false, 9, m);
        if (ai.ph === 'dive') ai.ph = 'climb';
      }
    // vol (il traverse tout, piliers compris)
    if (tx !== undefined) {
      const dx = tx - m.x, dy = ty - m.y, dz = tz - m.z, d = Math.hypot(dx, dy, dz) || 1;
      const k = Math.min(1, dt * 1.6);
      ai.vx += ((dx / d) * speed - ai.vx) * k;
      ai.vy += ((dy / d) * speed * 0.6 - ai.vy) * k;
      ai.vz += ((dz / d) * speed - ai.vz) * k;
      if (d < 0.8) ai.vx = ai.vy = ai.vz = 0;
    }
    m.x += ai.vx * dt;
    m.y += ai.vy * dt;
    m.z += ai.vz * dt;
    m.vx = m.vy = m.vz = 0;
    const face = Math.hypot(ai.vx, ai.vz) > 0.5 ? Math.atan2(-ai.vx, -ai.vz) : undefined;
    if (r() < dt * 0.15) CM.Audio.play('roar', { pitch: 0.9 + r() * 0.3 });
    return face !== undefined ? { face, tvy: 0 } : { tvy: 0 };
  };
  E.crystalDown = function (g, m, by) {
    const st = g.endState, e = g.entities;
    st.crystals = (st.crystals || []).filter((i) => i !== m.pillar);
    // explosion (sans casser le pilier), le dragon relié encaisse le choc
    if (g.explode) g.explode(m.x, m.y, m.z, 2.5);
    const dr = e.mobs.find((o) => o.type === 'ender_dragon' && !o.dead);
    if (dr && Math.hypot(dr.x - m.x, dr.y - m.y, dr.z - m.z) < 45) e.hurtMob(dr, 10, null, false, by || null);
    const left = st.crystals.length;
    const s = left ? '💥 Cristal détruit — il en reste ' + left : '💥 Tous les cristaux sont détruits : le dragon ne peut plus se soigner !';
    if (by === g.player || !by) g.ui.toast(s, 'good', 'crystal');
    if (g.net.isHost) g.net.broadcast({ t: 'rtoast', s, k: 'good', id: 'crystal' });
  };
  E.dragonLoot = function (e, m) {
    const g = e.game, st = g.endState;
    if (!st.elytra) {
      st.elytra = 1;
      e.addDrop(CM.I.ELYTRA, 1, m.x, m.y + 1, m.z, CM.freshExtra ? CM.freshExtra(CM.I.ELYTRA) : null);
    }
    e.addDrop(CM.I.DIAMOND, 4, m.x, m.y + 1, m.z);
    e.addDrop(CM.I.ENDER_PEARL, 4, m.x, m.y + 1, m.z);
  };
  // Victoire : portail de sortie et œuf au sommet de la fontaine.
  E.dragonDown = function (g, m) {
    const st = g.endState, w = g.world, B = CM.B;
    st.dragon = 1;
    st.dhp = 0;
    w.endWon = true;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) if ((dx || dz) && Math.hypot(dx, dz) <= 2.6) w.setBlock(dx, TOP, dz, B.END_PORTAL);
    if (!st.egg) {
      st.egg = 1;
      w.setBlock(0, TOP + 4, 0, B.DRAGON_EGG);
    }
    for (let k = 0; k < 6; k++) g.entities.burst(CM.Textures.layer.dbreath || CM.Textures.layer.white, m.x, m.y + k * 0.5, m.z, 30, { speed: 6, grav: -1, life: 2, size: 0.12, emissive: true });
    CM.Audio.play('victory');
    const s = '🐉 Le dragon de l’End est vaincu ! Le portail de sortie s’est ouvert au centre de l’île.';
    g.ui.toast(s, 'gold', 'dragon');
    g.net.sys(s);
    if (g.net.isHost) g.net.broadcast({ t: 'rtoast', s, k: 'good', id: 'dragon' });
    g.stats.dragons = (g.stats.dragons || 0) + 1;
  };

  // ============================================== effets (tous) ===
  E.onFx = function (g, m) {
    if (m.k === 'dcloud') E.clouds.push({ x: m.x, y: m.y, z: m.z, t: 5, vis: true });
  };
  // Chaque image : nuages de souffle, rayons des cristaux.
  E.render = function (g, dt) {
    if (g.dim !== 'end') {
      if (E.clouds.length && g.net.isClient) E.clouds = [];
      return;
    }
    const e = g.entities, L = CM.Textures.layer;
    for (const c of E.clouds) {
      if (c.vis) c.t -= dt;
      if (Math.random() < dt * 25) e.burst(L.dbreath || L.white, c.x + (Math.random() - 0.5) * 4, c.y + Math.random() * 1.5, c.z + (Math.random() - 0.5) * 4, 1, { speed: 0.3, grav: -0.3, life: 1, size: 0.12, emissive: true });
    }
    if (g.net.isClient) E.clouds = E.clouds.filter((c) => c.t > 0);
    const dr = e.mobs.find((o) => o.type === 'ender_dragon' && !o.dead);
    if (!dr) return;
    for (const o of e.mobs) {
      if (o.type !== 'end_crystal' || o.dead || !o.ai.special) continue;
      for (let k = 0; k < 2; k++) {
        const f = Math.random();
        e.burst(L.mob_crystal_core || L.white, o.x + (dr.x - o.x) * f, o.y + 0.8 + (dr.y + 1.2 - o.y - 0.8) * f, o.z + (dr.z - o.z) * f, 1, { speed: 0, grav: 0, life: 0.25, size: 0.08, emissive: true });
      }
    }
  };

  // ============================================== succès =========
  if (CM.Comfort && CM.Comfort.ACH) {
    const A = CM.Comfort.ACH, at = A.findIndex((a) => a.k === 'aube');
    A.splice(at < 0 ? A.length : at, 0,
      { k: 'fort', icon: '👁', name: 'L’œil était dans la tombe', desc: 'Allumer un portail de l’End', test: (g) => g.playerDim === 'end' },
      { k: 'dragon', icon: '🐉', name: 'Libérer l’End', desc: 'Vaincre le dragon de l’End', test: (g) => (g.stats.kills.ender_dragon || 0) > 0 },
      { k: 'oeuf', icon: '🥚', name: 'L’œuf du dragon', desc: 'Avoir l’œuf du dragon', test: (g) => g.inventory.has(CM.B.DRAGON_EGG) },
    );
  }
})();
