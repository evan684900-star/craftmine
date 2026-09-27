'use strict';
// Pêche (flotteur, touche, prises), bateaux (pilotés par leur passager) et gâteau.
// Le flotteur est simulé par le joueur qui pêche (les autres le voient grâce à son état) ;
// les bateaux sont des « wagonnets » de type boat : l'hôte les simule quand ils sont vides,
// leur passager les pilote (et envoie leur position à l'hôte).
(function () {
  const TAU = Math.PI * 2;
  const mat4 = CM.mat4;
  const water = (w, x, y, z) => CM.isWater(w.get(Math.floor(x), Math.floor(y), Math.floor(z)));
  // Hauteur de la surface de l'eau dans la colonne (x, z), autour de y (null : pas d'eau).
  function surface(w, x, y, z, up, down) {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let yy = Math.floor(y + (up === undefined ? 0.6 : up)); yy >= Math.floor(y - (down === undefined ? 0.6 : down)); yy--) {
      if (!CM.isWater(w.get(bx, yy, bz))) continue;
      let s = yy;
      while (s < yy + 4 && CM.isWater(w.get(bx, s + 1, bz))) s++;
      return s + 0.875;
    }
    return null;
  }
  const wrap = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };

  // =============================================================== PÊCHE ==
  // Butin : 85 % de poissons, 10 % de bric-à-brac, 5 % de trésors.
  function loot(g, b) {
    const I = CM.I, r = Math.random();
    const bi = g.world.column(Math.floor(b.x), Math.floor(b.z)).bi;
    const warm = bi === CM.BIO.WARM_OCEAN || bi === CM.BIO.JUNGLE || bi === CM.BIO.MANGROVE;
    if (r < 0.85) {
      const f = Math.random();
      if (warm) return f < 0.35 ? [I.TROPICAL_FISH, 1] : f < 0.55 ? [I.PUFFERFISH, 1] : f < 0.85 ? [I.RAW_COD, 1] : [I.RAW_SALMON, 1];
      return f < 0.6 ? [I.RAW_COD, 1] : f < 0.87 ? [I.RAW_SALMON, 1] : f < 0.89 ? [I.TROPICAL_FISH, 1] : [I.PUFFERFISH, 1];
    }
    if (r < 0.95) {
      const junk = [[I.STICK, 1], [I.BONE, 1], [I.LEATHER, 1], [I.ROPE, 2], [I.DYE_BLACK, 3], [I.FEATHER, 1], [CM.B.KELP_PLANT || CM.B.DRIED_KELP_BLOCK, 1], [I.PAPER, 1]];
      return junk[Math.floor(Math.random() * junk.length)];
    }
    const treasure = [[I.SADDLE, 1], [I.EMERALD, 1 + Math.floor(Math.random() * 3)], [I.DIAMOND, 1], [I.GOLDEN_CARROT, 2], [I.BOOK, 1], [I.GOLDEN_APPLE, 1], [I.NAME_TAG || I.GOLD_INGOT, 1]];
    return treasure[Math.floor(Math.random() * treasure.length)];
  }
  const F = (CM.Fishing = {
    surface,
    // Clic droit avec la canne : lancer, ou ramener (et ferrer si ça mord).
    use(p) {
      if (p.bobber) this.reel(p);
      else this.cast(p);
      p.swing = 1;
      p.useCd = 0.25;
    },
    cast(p) {
      const e = p.eye(), d = p.aim();
      p.bobber = { x: e[0] + d[0] * 0.6, y: e[1] + d[1] * 0.6, z: e[2] + d[2] * 0.6, vx: d[0] * 15, vy: d[1] * 15 + 3, vz: d[2] * 15, state: 'fly', wait: 0, bite: 0, dip: 0, hooked: null, dim: p.game.playerDim };
      CM.Audio.play('cast');
    },
    reel(p) {
      const g = p.game, b = p.bobber;
      p.bobber = null;
      CM.Audio.play('reel');
      if (!b) return;
      // créature accrochée : on la tire vers soi
      if (b.hooked !== null) {
        const m = g.entities.mobs.find((o) => o.uid === b.hooked && !o.dead);
        if (m) {
          const dx = p.x - m.x, dy = p.y - m.y, dz = p.z - m.z, d = Math.hypot(dx, dz) || 1;
          const v = [(dx / d) * Math.min(12, d * 1.1), Math.min(9, 4 + dy * 0.6), (dz / d) * Math.min(12, d * 1.1)];
          if (g.net.isClient) g.net.send({ t: 'mpull', id: m.uid, v: v.map((n) => Math.round(n * 100) / 100) });
          else g.entities.pullMob(m, v);
        }
        return;
      }
      if (b.state !== 'water' || !(b.bite > 0)) return;
      // ça mord : une prise !
      const [id, n] = loot(g, b);
      if (id === undefined || !CM.itemInfo(id)) return;
      const left = g.inventory.add(id, n);
      if (left > 0) g.dropNearPlayer(id, left);
      g.onPickup(id, n);
      p.addXp(1 + Math.floor(Math.random() * 6));
      g.stats.fished = (g.stats.fished || 0) + 1;
      g.entities.burst(CM.Textures.layer.white, b.x, b.y + 0.2, b.z, 14, { speed: 2.5, grav: 8, life: 0.7, size: 0.07 });
      CM.Audio.play('splash');
      CM.Audio.play('pop');
      g.ui.toast('🎣 ' + CM.itemName(id) + (n > 1 ? ' ×' + n : ''), 'good', 'fish');
    },
    // Chaque image : flotteur du joueur de cet écran.
    update(p, dt) {
      const b = p.bobber;
      if (!b) return;
      const g = p.game, w = g.world, held = g.inventory.held();
      if (!p.alive || !held || CM.itemInfo(held.id).type !== 'rod' || b.dim !== g.playerDim || Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) > 36) {
        p.bobber = null;
        return;
      }
      if (b.hooked !== null) {
        const m = g.entities.mobs.find((o) => o.uid === b.hooked && !o.dead);
        if (!m) b.hooked = null;
        else {
          b.x = m.x;
          b.y = m.y + m.h * 0.6;
          b.z = m.z;
          return;
        }
      }
      if (b.state === 'fly') {
        b.vy -= 22 * dt;
        b.vx *= Math.pow(0.6, dt);
        b.vz *= Math.pow(0.6, dt);
        const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt, nz = b.z + b.vz * dt;
        // une créature sur le trajet : accrochée
        const len = Math.hypot(nx - b.x, ny - b.y, nz - b.z);
        if (len > 0) {
          const hit = g.entities.raycastMob(b.x, b.y, b.z, (nx - b.x) / len, (ny - b.y) / len, (nz - b.z) / len, len + 0.2);
          if (hit && hit.mob) {
            b.hooked = hit.mob.uid;
            CM.Audio.play('hit');
            return;
          }
        }
        if (water(w, nx, ny, nz)) {
          b.state = 'water';
          b.vx *= 0.2;
          b.vz *= 0.2;
          b.vy = 0;
          CM.Audio.play('splash');
          g.entities.burst(CM.Textures.layer.white, nx, ny + 0.2, nz, 6, { speed: 1.5, grav: 8, life: 0.5, size: 0.05 });
        } else if (w.solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
          b.state = 'ground';
          b.vx = b.vy = b.vz = 0;
          return;
        }
        b.x = nx;
        b.y = ny;
        b.z = nz;
        return;
      }
      if (b.state === 'ground') {
        if (!w.solidAt(Math.floor(b.x), Math.floor(b.y - 0.05), Math.floor(b.z)) && !w.solidAt(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z))) b.state = 'fly';
        return;
      }
      // dans l'eau : il flotte, le courant l'emporte
      const s = surface(w, b.x, b.y, b.z, 1, 2);
      if (s === null) {
        b.state = 'fly';
        return;
      }
      const fv = CM.flowVector(w, Math.floor(b.x), Math.floor(s - 0.5), Math.floor(b.z));
      if (fv) {
        b.vx += fv[0] * 2 * dt;
        b.vz += fv[1] * 2 * dt;
      }
      b.vx *= Math.pow(0.3, dt);
      b.vz *= Math.pow(0.3, dt);
      const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
      if (water(w, nx, s - 0.3, nz)) {
        b.x = nx;
        b.z = nz;
      }
      b.dip = Math.max(0, b.dip - dt * 1.5);
      b.y = s - 0.12 - b.dip * 0.3 + Math.sin(g.clock * 3) * 0.02;
      // attente d'une touche (plus courte sous la pluie, plus longue à couvert)
      if (b.bite > 0) {
        b.bite -= dt;
        if (b.bite <= 0) b.wait = 0; // trop tard : le poisson est parti
        return;
      }
      if (!(b.wait > 0)) {
        b.wait = 5 + Math.random() * 20;
        if ((g.wLevel || 0) > 0.5) b.wait *= 0.7;
        if (w.skyAt(Math.floor(b.x), Math.floor(s + 1), Math.floor(b.z)) < 10) b.wait *= 2;
        b.total = b.wait;
      }
      b.wait -= dt;
      // un poisson approche : un sillage de bulles vers le flotteur
      if (b.wait < 2 && b.wait > 0 && Math.random() < dt * 20) {
        const a = b.ang === undefined ? (b.ang = Math.random() * TAU) : b.ang, k = b.wait * 1.6;
        g.entities.burst(CM.Textures.layer.white, b.x + Math.cos(a) * k, s + 0.02, b.z + Math.sin(a) * k, 1, { speed: 0.2, grav: -0.5, life: 0.4, size: 0.04 });
      }
      if (b.wait <= 0) {
        b.bite = 1.1;
        b.dip = 1;
        b.ang = undefined;
        CM.Audio.play('bite');
        g.entities.burst(CM.Textures.layer.white, b.x, s + 0.1, b.z, 10, { speed: 2, grav: 8, life: 0.5, size: 0.06 });
      }
    },
    // Ligne (légèrement détendue) et flotteur. from : bout de la canne.
    drawLine(ents, batch, from, b, dip) {
      const M = ents.M, L = CM.Textures.layer;
      const dx = b[0] - from[0], dy = b[1] - from[1], dz = b[2] - from[2], d = Math.hypot(dx, dy, dz);
      const n = Math.max(4, Math.min(24, Math.ceil(d * 1.5))), sag = dip ? 0.02 : Math.min(1.2, d * 0.06);
      const l = ents.lightAt(b[0], b[1] + 0.3, b[2]);
      let px = from[0], py = from[1], pz = from[2];
      for (let i = 1; i <= n; i++) {
        const t = i / n, x = from[0] + dx * t, y = from[1] + dy * t - sag * 4 * t * (1 - t), z = from[2] + dz * t;
        const sx = x - px, sy = y - py, sz = z - pz, sl = Math.hypot(sx, sy, sz);
        if (sl > 0.001) {
          mat4.compose(M, (x + px) / 2, (y + py) / 2, (z + pz) / 2, Math.atan2(sx, sz), Math.atan2(-sy, Math.hypot(sx, sz)), 0, 1);
          batch.box(M, -0.008, -0.008, -sl / 2, 0.008, 0.008, sl / 2, L.fish_line, l[0], l[1], 0);
        }
        px = x;
        py = y;
        pz = z;
      }
      mat4.compose(M, b[0], b[1], b[2], 0, 0, 0, 1);
      batch.box(M, -0.07, 0, -0.07, 0.07, 0.09, 0.07, L.bobber_red, l[0], l[1], 0);
      batch.box(M, -0.07, -0.09, -0.07, 0.07, 0, 0.07, L.bobber_white, l[0], l[1], 0);
    },
    // État envoyé aux autres joueurs : position du flotteur (ou 0).
    netState(p) {
      const b = p.bobber;
      return b ? [Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, Math.round(b.z * 100) / 100] : 0;
    },
  });

  // ============================================================== BATEAUX ==
  CM.CART_ITEMS.boat = CM.I.BOAT; // (objet rendu quand on le casse ; sauvegarde)
  const Boats = (CM.Boats = {
    HW: 0.6,
    H: 0.55,
    // Un pas de physique. wish : [x, z, intensité] (direction voulue) ou null.
    step(w, c, dt, wish) {
      const s = surface(w, c.x, c.y, c.z);
      const under = CM.blocks[w.get(Math.floor(c.x), Math.floor(c.y - 0.08), Math.floor(c.z))];
      const ice = !!under && (under.slip || /ICE/.test(under.key || ''));
      const wet = s !== null && c.y < s;
      let thrust = 0;
      if (wish) {
        const target = Math.atan2(-wish[0], -wish[1]);
        const d = wrap(target - c.yaw);
        c.yaw = wrap(c.yaw + Math.max(-2.4 * dt, Math.min(2.4 * dt, d)));
        thrust = Math.max(0, Math.cos(d)) * (wish[2] || 1);
      }
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
      const acc = wet ? 9 : ice ? 14 : 2, maxS = wet ? 8 : ice ? 30 : 1.2;
      let vf = c.vx * fx + c.vz * fz;
      const sx = c.vx - fx * vf, sz = c.vz - fz * vf;
      vf += thrust * acc * dt;
      vf *= Math.pow(wet ? 0.35 : ice ? 0.93 : 0.002, dt);
      vf = Math.max(-maxS * 0.4, Math.min(maxS, vf));
      const side = Math.pow(wet ? 0.01 : ice ? 0.3 : 0.001, dt);
      c.vx = fx * vf + sx * side;
      c.vz = fz * vf + sz * side;
      // flotte : le fond de la coque juste sous la surface
      if (s !== null && c.y < s + 0.05) {
        const fv = CM.flowVector(w, Math.floor(c.x), Math.floor(s - 0.5), Math.floor(c.z));
        if (fv && !wish) {
          c.vx += fv[0] * 3 * dt;
          c.vz += fv[1] * 3 * dt;
        }
        c.vy += ((s - 0.32 - c.y) * 40 - c.vy * 7) * dt;
      } else c.vy -= 28 * dt;
      c.vy = Math.max(c.vy, -40);
      CM.Physics.move(w, c, c.vx * dt, c.vy * dt, c.vz * dt);
      if (c.hitY) c.vy = 0;
      if (c.hitX) c.vx *= -0.2;
      if (c.hitZ) c.vz *= -0.2;
      c.row = (c.row || 0) + Math.abs(vf) * dt * 1.6;
    },
    // Hôte : bateau sans passager (le courant l'emporte, on peut le pousser).
    hostTick(ents, c, dt) {
      const g = ents.game;
      if (c.rider === null || c.rider === undefined) {
        this.step(g.world, c, dt, null);
        for (const q of ents.plist) {
          if (q.alive === false || q.riding === c.uid) continue;
          const dx = c.x - q.x, dz = c.z - q.z, d = Math.hypot(dx, dz);
          if (d < 0.9 && d > 0.01 && Math.abs(q.y - c.y) < 1.2) {
            c.vx += (dx / d) * 5 * dt;
            c.vz += (dz / d) * 5 * dt;
          }
        }
      }
      if (c.y < CM.WORLD.MINY - 20) c.dead = true;
    },
    // Le joueur de cet écran pilote son bateau (hôte : l'original ; invité : sa copie).
    drive(p, c, dt, wish) {
      const g = p.game;
      c.hw = this.HW;
      c.h = this.H;
      this.step(g.world, c, dt, wish);
      p.x = c.x;
      p.y = c.y + 0.12;
      p.z = c.z;
      if (Math.hypot(c.vx, c.vz) > 1.5 && Math.random() < dt * 3) CM.Audio.play('paddle', { vol: 0.5 });
      if (g.net.isClient) {
        c.tx = undefined;
        p.bposT = (p.bposT || 0) - dt;
        if (p.bposT <= 0) {
          p.bposT = 0.1;
          const r2 = (v) => Math.round(v * 100) / 100;
          g.net.send({ t: 'bpos', id: c.uid, p: [r2(c.x), r2(c.y), r2(c.z), r2(c.yaw)] });
        }
      }
    },
    // Où poser un bateau (visée sur l'eau, ou sur un bloc) : [x, y, z] ou null.
    placeAt(p) {
      const w = p.game.world, e = p.eye(), d = p.aim();
      const h = w.raycast(e[0], e[1], e[2], d[0], d[1], d[2], 6, (id) => CM.isWater(id) || CM.blocks[id].solid);
      if (!h) return null;
      const x = h.x + 0.5, z = h.z + 0.5;
      if (CM.isWater(h.id)) {
        const s = surface(w, x, h.y, z, 3, 0);
        return s === null ? null : [x, s - 0.3, z];
      }
      if (h.ny !== 1 || w.solidAt(h.x, h.y + 1, h.z) || w.solidAt(h.x, h.y + 2, h.z)) return null;
      return [x, h.y + 1, z];
    },
    render(ents, batch) {
      const L = CM.Textures.layer, M = ents.M;
      for (const c of ents.carts || []) {
        if (c.dead || c.type !== 'boat') continue;
        const l = ents.lightAt(c.x, c.y + 0.5, c.z);
        mat4.compose(M, c.x, c.y, c.z, c.yaw || 0, 0, 0, 1);
        const W = L.boat_wood, D = L.boat_dark;
        batch.box(M, -0.6, 0.02, -0.85, 0.6, 0.12, 0.8, W, l[0], l[1], 0); // fond
        batch.box(M, -0.62, 0.12, -0.7, -0.52, 0.52, 0.8, W, l[0], l[1], 0); // flancs
        batch.box(M, 0.52, 0.12, -0.7, 0.62, 0.52, 0.8, W, l[0], l[1], 0);
        batch.box(M, -0.52, 0.12, 0.7, 0.52, 0.5, 0.8, W, l[0], l[1], 0); // poupe
        batch.box(M, -0.4, 0.12, -1.0, 0.4, 0.46, -0.7, W, l[0], l[1], 0); // proue
        batch.box(M, -0.52, 0.12, -0.72, -0.4, 0.5, -0.62, W, l[0], l[1], 0);
        batch.box(M, 0.4, 0.12, -0.72, 0.52, 0.5, -0.62, W, l[0], l[1], 0);
        batch.box(M, -0.52, 0.3, 0.15, 0.52, 0.38, 0.4, D, l[0], l[1], 0); // banc
        // rames
        const a = Math.sin(c.row || 0) * 0.6;
        for (const s of [-1, 1]) {
          mat4.compose(ents.P, s * 0.6, 0.45, 0.05, a * s, 0.9, s * 0.35, 1);
          mat4.multiply(ents.R, M, ents.P);
          batch.box(ents.R, -0.03, -0.03, -0.1, 0.03, 0.03, 0.9, D, l[0], l[1], 0);
          batch.box(ents.R, -0.05, -0.12, 0.75, 0.05, 0.12, 1.15, W, l[0], l[1], 0);
        }
      }
    },
  });

  // ============================================================== GÂTEAU ==
  CM.Cooking = {
    // Clic droit sur un gâteau posé : on en mange une part.
    eatCake(g, t) {
      const p = g.player;
      if (!t) return true;
      if (p.food >= 20 && !p.creative) {
        g.ui.toast('Tu n’as pas faim.', 'info', 'full');
        return true;
      }
      const B = CM.B, id = g.world.get(t.x, t.y, t.z);
      const k = id === B.CAKE ? 0 : id === B.CAKE_1 ? 1 : id === B.CAKE_2 ? 2 : id === B.CAKE_3 ? 3 : -1;
      if (k < 0) return true;
      p.food = Math.min(20, p.food + 3);
      p.sat = Math.min(p.food, p.sat + 1.2);
      g.world.setBlock(t.x, t.y, t.z, k < 3 ? B['CAKE_' + (k + 1)] : 0);
      CM.Audio.play('eat');
      g.entities.burst(CM.Textures.layer.cake_inner, t.x + 0.5, t.y + 0.5, t.z + 0.5, 6, { speed: 1.2, size: 0.06 });
      p.swing = 1;
      p.useCd = 0.4;
      return true;
    },
  };
})();
