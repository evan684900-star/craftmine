'use strict';
// Nouveaux biomes (mondes créés depuis cette version) : grottes luxuriantes (lianes à baies
// lumineuses), profondeurs sombres (hurleur de sculk, gardien aveugle), récifs de corail
// (cornichons de mer). Effet « Obscurité ».
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});
  const TAU = Math.PI * 2;

  if (CM.EFFECTS) CM.EFFECTS.darkness = { key: 'darkness', name: 'Obscurité', de: 'd’obscurité', color: [20, 22, 34], icon: '🌑' };

  M.blocks.push(function (K) {
    const { nb } = K;
    nb('CAVE_VINES', {
      name: 'Lianes des cavernes', render: 'cross', tex: 'cave_vines', solid: false, opaque: false, hardness: 0.1, sound: 'grass', replaceable: true,
      light: 12, wave: true, hang: true,
    });
    nb('SCULK_SHRIEKER', {
      name: 'Hurleur de sculk', render: 'model', opaque: false, solid: true, hardness: 3, tool: 'hoe', sound: 'grass', light: 1,
      model: [{ b: [0, 0, 0, 16, 8, 16], t: ['shrieker_side', 'shrieker_side', 'shrieker_top', 'sculk', 'shrieker_side', 'shrieker_side'] }, { b: [1, 8, 1, 15, 15, 15], t: ['shrieker_jaw', 'shrieker_jaw', 'shrieker_inner', 'shrieker_inner', 'shrieker_jaw', 'shrieker_jaw'] }],
      tex: { top: 'shrieker_top', bottom: 'sculk', side: 'shrieker_side' }, iconTex: 'shrieker_top', shrieker: true,
    });
    nb('SEA_PICKLE', {
      name: 'Cornichons de mer', render: 'model', opaque: false, solid: false, hardness: 0, sound: 'squish', light: 10, wet: true,
      model: [{ b: [3, 0, 3, 7, 6, 7], t: ['sea_pickle', 'sea_pickle', 'sea_pickle_top', 'sea_pickle', 'sea_pickle', 'sea_pickle'] }, { b: [9, 0, 8, 13, 5, 12], t: ['sea_pickle', 'sea_pickle', 'sea_pickle_top', 'sea_pickle', 'sea_pickle', 'sea_pickle'] }, { b: [4, 0, 10, 7, 4, 13], t: ['sea_pickle', 'sea_pickle', 'sea_pickle_top', 'sea_pickle', 'sea_pickle', 'sea_pickle'] }],
      tex: 'sea_pickle', iconTex: 'sea_pickle_top',
    });
  });
  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1514, 'GLOW_BERRIES', { name: 'Baies lumineuses', tex: 'glow_berries', type: 'food', food: 2, sat: 0.4, desc: 'Poussent sur les lianes des grottes luxuriantes.' });
    defItem(1515, 'ECHO_SHARD', { name: 'Éclat d’écho', tex: 'echo_shard', desc: 'Laissé par le gardien aveugle des profondeurs. 8 éclats + 1 boussole : boussole de récupération.' });
  });
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.blocks[B.CAVE_VINES].drop = I.GLOW_BERRIES;
    // coraux : ils vivent dans l'eau (dessinés sans bulle d'air autour)
    for (const k of ['TUBE', 'BRAIN', 'BUBBLE', 'FIRE', 'HORN']) if (B[k + '_CORAL_FAN'] !== undefined) CM.blocks[B[k + '_CORAL_FAN']].wet = true;
    if (I.RECOVERY_COMPASS !== undefined && I.COMPASS !== undefined) CM.recipes.push(r(I.RECOVERY_COMPASS, 1, [[I.ECHO_SHARD, 8], [I.COMPASS, 1]], 'table', 'objets'));
    CM.recipes.push(r(B.SCULK_SHRIEKER, 1, [[B.SCULK, 6], [I.ECHO_SHARD, 1]], 'table', 'redstone'));
  });

  M.textures.push(function (X) {
    const { make, put, fill, vary, copyFrom } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    make('cave_vines', (d, r) => {
      clear(d);
      for (const x0 of [4, 11]) {
        let x = x0;
        for (let y = 0; y < 16; y++) {
          put(d, x, y, vary([62, 110, 40], r, 14));
          if (r() < 0.3) put(d, x + (r() < 0.5 ? 1 : -1), y, vary([80, 136, 52], r, 10));
          if (r() < 0.2) x += r() < 0.5 ? 1 : -1;
        }
      }
      // baies lumineuses
      for (const [x, y] of [[3, 4], [5, 5], [12, 9], [10, 10], [4, 12], [11, 2]]) {
        put(d, x, y, [255, 196, 70]);
        put(d, x + 1, y, [255, 170, 40]);
        put(d, x, y + 1, [240, 150, 40]);
      }
    });
    make('glow_berries', (d, r) => {
      clear(d);
      for (let y = 1; y < 8; y++) put(d, 7, y, [70, 120, 40]);
      for (const [cx, cy] of [[5, 9], [9, 10], [7, 12]])
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) put(d, cx + x, cy + y, x + y < -1 ? [255, 236, 150] : [250, 170, 40]);
    });
    make('shrieker_side', (d, r) => {
      copyFrom(d, 'sculk');
      for (let x = 0; x < 16; x++) {
        put(d, x, 0, vary([214, 208, 180], r, 8));
        if (r() < 0.6) put(d, x, 1, vary([200, 194, 166], r, 8));
      }
    });
    make('shrieker_top', (d, r) => {
      fill(d, r, [210, 204, 176], 10);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, (x + y) % 3 ? [30, 60, 70] : [20, 40, 48]);
      for (const [x, y] of [[6, 6], [9, 9], [6, 9], [9, 6]]) put(d, x, y, [70, 220, 230]);
    });
    make('shrieker_jaw', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y > 8 || x < 3 || x > 12) put(d, x, y, vary([214, 208, 180], r, 10));
      for (let x = 1; x < 15; x += 3) put(d, x, 8, [240, 236, 214]);
    });
    make('shrieker_inner', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x < 2 || x > 13 || y < 2 || y > 13) put(d, x, y, vary([214, 208, 180], r, 10));
    });
    make('sea_pickle', (d, r) => {
      fill(d, r, [96, 118, 40], 14);
      for (let k = 0; k < 10; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [70, 92, 28]);
    });
    make('sea_pickle_top', (d, r) => {
      fill(d, r, [96, 118, 40], 10);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, [210, 240, 120]);
    });
    make('echo_shard', (d, r) => {
      clear(d);
      for (let y = 2; y < 14; y++)
        for (let x = 3; x < 13; x++) {
          const dx = Math.abs(x - 7.5), dy = Math.abs(y - 8);
          if (dx + dy * 0.6 < 5.2) put(d, x, y, dx + dy < 3 ? [60, 220, 220] : [20, 90, 110]);
        }
    });
    // gardien aveugle
    make('mob_warden', (d, r) => {
      fill(d, r, [18, 50, 58], 10);
      for (let k = 0; k < 26; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [10, 32, 38]);
      for (let k = 0; k < 6; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [40, 150, 160]);
    });
    make('mob_warden_face', (d, r) => {
      fill(d, r, [18, 50, 58], 8);
      for (let x = 4; x < 12; x++) put(d, x, 11, [8, 16, 20]);
      for (let x = 5; x < 11; x++) put(d, x, 12, [8, 16, 20]);
      for (const x of [5, 7, 9]) put(d, x, 10, [210, 206, 190]);
    });
    make('mob_warden_glow', (d, r) => {
      fill(d, r, [60, 230, 230], 18);
      for (let k = 0; k < 10; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [200, 255, 255]);
    });
    make('mob_warden_rib', (d, r) => {
      fill(d, r, [18, 50, 58], 8);
      for (let y = 2; y < 16; y += 4) for (let x = 2; x < 14; x++) put(d, x, y, [214, 208, 180]);
      for (let y = 5; y < 12; y++) for (let x = 6; x < 10; x++) put(d, x, y, [60, 230, 230]);
    });
  });

  // =============================================== GARDIEN AVEUGLE =====
  // Il ne voit rien : il entend les pas (sauf accroupi) et sent ceux qui le touchent presque.
  // Coups terribles, onde sonique à travers les murs, obscurité autour de lui ; calme pendant
  // une minute, il retourne sous terre.
  const DMG = 18;
  MOBS.warden = {
    name: 'Gardien aveugle', aliases: ['gardien_aveugle', 'warden'], hw: 0.5, h: 2.9, hp: 500, speed: 3.6, hostile: true, fireproof: true, xp: 50, sound: 'warden',
    init(m) {
      m.ai.emerge = 4;
      m.ai.ang = new Map();
    },
    onHurt(e, m, by) {
      // (lourd : presque pas de recul)
      m.vx *= 0.12;
      m.vz *= 0.12;
      m.vy = Math.min(m.vy, 1);
      m.ai.calm = 0;
      if (by && by.alive !== undefined) m.ai.ang.set(by, Math.min(150, (m.ai.ang.get(by) || 0) + 100));
    },
    update(e, m, dt, c) {
      const g = e.game, L = CM.Textures.layer;
      if (!m.ai.ang) m.ai.ang = new Map();
      // sort de terre
      if (m.ai.emerge > 0) {
        m.ai.emerge -= dt;
        m.hurt = 0;
        if (e.rand() < dt * 20) e.burst(L.sculk || L.smoke, m.x + (e.rand() - 0.5) * 1.4, m.y + 0.1, m.z + (e.rand() - 0.5) * 1.4, 2, { speed: 2.5, grav: 8, life: 0.8, size: 0.1 });
        return {};
      }
      // retourne sous terre
      if (m.ai.dig > 0) {
        m.ai.dig -= dt;
        if (e.rand() < dt * 20) e.burst(L.sculk || L.smoke, m.x + (e.rand() - 0.5) * 1.4, m.y + 0.1, m.z + (e.rand() - 0.5) * 1.4, 2, { speed: 2.5, grav: 8, life: 0.8, size: 0.1 });
        if (m.ai.dig <= 0) m.dead = true;
        return {};
      }
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      m.ai.boomCd = Math.max(0, (m.ai.boomCd === undefined ? 4 : m.ai.boomCd) - dt);
      m.ai.darkT = (m.ai.darkT || 0) - dt;
      if (m.ai.swing > 0) m.ai.swing -= dt;
      // écoute : pas des joueurs (pas accroupis), contact tout proche
      const lp = m.ai.lp || (m.ai.lp = new Map());
      let heard = null;
      for (const q of e.plist) {
        if (q.alive === false) {
          m.ai.ang.delete(q);
          continue;
        }
        const d = Math.hypot(q.x - m.x, q.y - m.y, q.z - m.z);
        const prev = lp.get(q);
        lp.set(q, [q.x, q.y, q.z]);
        if (d > 22 || !prev) continue;
        const sp = Math.hypot(q.x - prev[0], q.y - prev[1], q.z - prev[2]) / Math.max(dt, 1e-3);
        const sneak = q === g.player ? q.sneaking : !!(q.flags & 1);
        let add = 0;
        if (d < 2.6) add = 70 * dt; // il le sent
        else if (sp > 1.2 && !sneak && d < 18) add = (d < 10 ? 45 : 25) * dt;
        if (add) {
          m.ai.ang.set(q, Math.min(150, (m.ai.ang.get(q) || 0) + add));
          heard = q;
          m.ai.calm = 0;
        }
      }
      // la colère retombe peu à peu
      let tgt = null, best = 0;
      for (const [q, a] of m.ai.ang) {
        const na = Math.max(0, a - 6 * dt);
        if (na <= 0) m.ai.ang.delete(q);
        else m.ai.ang.set(q, na);
        if (na > best) {
          best = na;
          tgt = q;
        }
      }
      m.ai.calm = (m.ai.calm || 0) + dt;
      if (m.ai.calm > 60 && best < 10) {
        m.ai.dig = 3.5;
        if (CM.Caves) CM.Caves.fx(g, { k: 'emerge', x: m.x, y: m.y, z: m.z });
        return {};
      }
      // obscurité autour de lui
      if (m.ai.darkT <= 0) {
        m.ai.darkT = 6;
        for (const q of e.plist) if (q.alive !== false && Math.hypot(q.x - m.x, q.y - m.y, q.z - m.z) < 20 && CM.Caves) CM.Caves.darken(g, q, 9);
      }
      m.ai.chasing = best >= 50;
      if (!tgt) return {};
      const dx = tgt.x - m.x, dz = tgt.z - m.z, dy = tgt.y - m.y, dist = Math.hypot(dx, dz), dir = Math.atan2(-dx, -dz);
      // charge de l'onde sonique (elle traverse les murs)
      if (m.ai.charge > 0) {
        m.ai.charge -= dt;
        m.ai.special = true;
        if (m.ai.charge <= 0) {
          m.ai.special = false;
          m.ai.boomCd = 5;
          if (CM.Caves) CM.Caves.sonic(g, m, tgt);
        }
        return { face: dir };
      }
      if (best >= 50) {
        if (dist < 2.3 + m.hw && Math.abs(dy) < 2.6 && m.ai.attackCd <= 0) {
          m.ai.attackCd = 1.4;
          m.ai.swing = 0.45;
          const n = DMG; // (la difficulté s'applique ensuite, comme pour toutes les créatures)
          if (tgt === g.player) {
            e.hitPlayer(tgt, n, m, 'Le gardien aveugle');
            if (tgt.alive) {
              tgt.vx += (dx / (dist || 1)) * 9;
              tgt.vz += (dz / (dist || 1)) * 9;
              tgt.vy = Math.max(tgt.vy, 6);
            }
          } else tgt.damage(n, m.x, m.z, 'Le gardien aveugle', false, 6, m);
          CM.Audio.play('warden', { pitch: 0.8 });
        } else if (dist > 5 && dist < 16 && m.ai.boomCd <= 0) {
          m.ai.charge = 1.7;
          CM.Audio.play('warden', { pitch: 1.4 });
        }
        return { tvx: dist > 1.8 ? -Math.sin(dir) * 4.2 : 0, tvz: dist > 1.8 ? -Math.cos(dir) * 4.2 : 0, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
      }
      // il a entendu quelque chose : il va voir, lentement
      if (heard || m.ai.go) {
        if (heard) m.ai.go = [heard.x, heard.z];
        const gx = m.ai.go[0] - m.x, gz = m.ai.go[1] - m.z, gd = Math.hypot(gx, gz);
        if (gd < 1.5) m.ai.go = null;
        else return { tvx: (-Math.sin(Math.atan2(-gx, -gz)) * 2), tvz: (-Math.cos(Math.atan2(-gx, -gz)) * 2), face: Math.atan2(-gx, -gz), jump: (m.hitX || m.hitZ) && m.onGround };
      }
      return {};
    },
    loot(e, m) {
      const I = CM.I;
      e.addDrop(I.ECHO_SHARD, 2 + Math.floor(e.rand() * 3), m.x, m.y + 1, m.z);
      e.addDrop(CM.B.SCULK, 4 + Math.floor(e.rand() * 5), m.x, m.y + 1, m.z);
    },
    render(e, batch, m, l, f, sw, t) {
      const L = CM.Textures.layer, W = L.mob_warden, G = L.mob_warden_glow, ff = f | 1;
      // sortie de terre / retour : il monte ou descend
      const rise = m.ai.emerge > 0 ? -2.9 * Math.min(1, m.ai.emerge / 4) : m.ai.dig > 0 ? -2.9 * (1 - m.ai.dig / 3.5) : 0;
      const y0 = rise;
      const hit = m.ai.swing > 0 ? -2 + (0.45 - m.ai.swing) * 5 : m.ai.special ? -1.2 : m.ai.chasing ? -0.4 + Math.sin(t * 5) * 0.1 : sw * 0.5;
      e.part(batch, e.M, -0.28, y0 + 1.1, 0, sw * 0.5, [-0.2, -1.1, -0.22, 0.2, 0, 0.22], W, l, f);
      e.part(batch, e.M, 0.28, y0 + 1.1, 0, -sw * 0.5, [-0.2, -1.1, -0.22, 0.2, 0, 0.22], W, l, f);
      e.part(batch, e.M, 0, y0 + 1.1, 0, 0, [-0.62, 0, -0.34, 0.62, 1.15, 0.34], [W, W, W, W, W, L.mob_warden_rib], l, [f, f, f, f, f, ff]);
      e.part(batch, e.M, -0.8, y0 + 2.2, 0, hit, [-0.18, -1.4, -0.18, 0.18, 0.05, 0.18], W, l, f);
      e.part(batch, e.M, 0.8, y0 + 2.2, 0, m.ai.special ? hit : m.ai.swing > 0 ? hit : -hit, [-0.18, -1.4, -0.18, 0.18, 0.05, 0.18], W, l, f);
      const nod = m.ai.special ? Math.sin(t * 30) * 0.08 : Math.sin(t * 1.2) * 0.05;
      e.part(batch, e.M, 0, y0 + 2.25, 0, nod, [-0.42, 0, -0.38, 0.42, 0.66, 0.38], [W, W, W, W, W, L.mob_warden_face], l, f);
      // oreilles lumineuses (elles palpitent)
      const pulse = 0.6 + Math.sin(t * 4) * 0.25;
      e.part(batch, e.M, -0.42, y0 + 2.7, 0, 0, [-0.42 * pulse, -0.18, -0.03, 0, 0.3, 0.03], G, l, ff, null, 0, -0.3);
      e.part(batch, e.M, 0.42, y0 + 2.7, 0, 0, [0, -0.18, -0.03, 0.42 * pulse, 0.3, 0.03], G, l, ff, null, 0, 0.3);
    },
  };
})();
