'use strict';
// L'End : cadre et portail de l'End, œuf du dragon, chorus ; perle de l'Arpenteur, œil de l'End,
// fruit de chorus ; l'Arpenteur (il ne supporte pas qu'on le regarde), le dragon de l'End et
// les cristaux qui le soignent. La logique (forts, voyage, combat) est dans end.js.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});
  const TAU = Math.PI * 2;
  const FRAME = [0, 0, 0, 16, 13, 16];

  M.blocks.push(function (K) {
    const { nb } = K;
    nb('END_PORTAL_FRAME', {
      name: 'Cadre de portail de l’End', render: 'model', opaque: false, solid: true, hardness: -1, unbreakable: true, sound: 'stone', light: 1, frame: true,
      model: [{ b: FRAME, t: ['end_frame_side', 'end_frame_side', 'end_frame_top', 'end_stone', 'end_frame_side', 'end_frame_side'] }],
      tex: { top: 'end_frame_top', bottom: 'end_stone', side: 'end_frame_side' }, iconTex: 'end_frame_top',
    });
    nb('END_PORTAL_FRAME_EYE', {
      name: 'Cadre de portail de l’End (œil)', render: 'model', opaque: false, solid: true, hardness: -1, unbreakable: true, sound: 'stone', light: 4, frame: true, hidden: true,
      model: [{ b: FRAME, t: ['end_frame_side', 'end_frame_side', 'end_frame_top', 'end_stone', 'end_frame_side', 'end_frame_side'] }, { b: [4, 13, 4, 12, 16, 12], t: 'frame_eye' }],
      tex: { top: 'frame_eye', bottom: 'end_stone', side: 'end_frame_side' }, iconTex: 'frame_eye',
    });
    nb('END_PORTAL', {
      name: 'Portail de l’End', render: 'model', opaque: false, solid: false, hardness: -1, unbreakable: true, sound: 'glass', light: 15, drop: 0, hidden: true, endPortal: true,
      model: [{ b: [0, 11, 0, 16, 12, 16], t: 'end_portal' }], tex: 'end_portal',
    });
    nb('DRAGON_EGG', {
      name: 'Œuf du dragon', render: 'model', opaque: false, solid: true, hardness: 3, sound: 'stone', light: 1,
      model: [{ b: [3, 0, 3, 13, 2, 13], t: 'dragon_egg' }, { b: [2, 2, 2, 14, 8, 14], t: 'dragon_egg' }, { b: [3, 8, 3, 13, 12, 13], t: 'dragon_egg' }, { b: [5, 12, 5, 11, 15, 11], t: 'dragon_egg' }, { b: [6, 15, 6, 10, 16, 10], t: 'dragon_egg' }],
      tex: 'dragon_egg',
    });
    nb('CHORUS_PLANT', {
      name: 'Plante de chorus', render: 'model', opaque: false, solid: true, hardness: 0.4, tool: 'axe', sound: 'wood',
      model: [{ b: [3, 0, 3, 13, 16, 13], t: 'chorus_plant' }], tex: 'chorus_plant',
    });
  });
  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1516, 'ENDER_PEARL', { name: 'Perle de l’Arpenteur', tex: 'ender_pearl', stack: 16, type: 'pearl', desc: 'Lance-la (clic droit) : tu es téléporté là où elle tombe (un peu de dégâts).' });
    defItem(1517, 'EYE_OF_ENDER', { name: 'Œil de l’End', tex: 'eye_of_ender', type: 'eye', desc: 'Perle + larme d’ardent. Lance-le : il file vers le fort souterrain le plus proche. Dans un cadre de portail de l’End, il allume le portail (12 yeux).' });
    defItem(1518, 'CHORUS_FRUIT', { name: 'Fruit de chorus', tex: 'chorus_fruit', type: 'food', food: 4, sat: 2.4, always: true, chorus: true, desc: 'Pousse dans l’End. Le manger te téléporte un peu plus loin.' });
  });
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.blocks[B.CHORUS_PLANT].drop = I.CHORUS_FRUIT;
    if (I.ARDENT_TEAR !== undefined) CM.recipes.push(r(I.EYE_OF_ENDER, 1, [[I.ENDER_PEARL, 1], [I.ARDENT_TEAR, 1]], 'table', 'objets'));
    CM.recipes.push(r(B.PURPUR_BLOCK, 4, [[I.CHORUS_FRUIT, 4]], 'table', 'deco'));
  });

  M.textures.push(function (X) {
    const { make, put, fill, vary, copyFrom } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    make('end_frame_side', (d, r) => {
      copyFrom(d, 'end_stone');
      for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) put(d, x, y, vary([46, 96, 84], r, 10));
      for (let x = 0; x < 16; x += 3) put(d, x, 4, [30, 60, 54]);
    });
    make('end_frame_top', (d, r) => {
      fill(d, r, [50, 104, 90], 10);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x < 2 || x > 13 || y < 2 || y > 13) put(d, x, y, vary([210, 214, 150], r, 10));
      for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, [20, 36, 32]);
    });
    make('frame_eye', (d, r) => {
      fill(d, r, [40, 110, 70], 12);
      for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 20) put(d, x, y, [90, 190, 120]);
      for (let y = 5; y < 11; y++) put(d, 7, y, [10, 20, 16]), put(d, 8, y, [10, 20, 16]);
    });
    make('end_portal', (d, r) => {
      fill(d, r, [8, 10, 18], 4);
      for (let k = 0; k < 22; k++) {
        const c = [[80, 200, 190], [200, 120, 230], [240, 240, 255], [120, 160, 255]][k % 4];
        put(d, Math.floor(r() * 16), Math.floor(r() * 16), c);
      }
    });
    make('dragon_egg', (d, r) => {
      fill(d, r, [16, 10, 20], 6);
      for (let k = 0; k < 26; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? [80, 30, 110] : [40, 16, 56]);
    });
    make('chorus_plant', (d, r) => {
      fill(d, r, [110, 70, 110], 12);
      for (let k = 0; k < 20; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? [150, 110, 150] : [80, 48, 84]);
    });
    make('ender_pearl', (d, r) => {
      clear(d);
      for (let y = 3; y < 13; y++)
        for (let x = 3; x < 13; x++) {
          const q = (x - 7.5) ** 2 + (y - 7.5) ** 2;
          if (q < 24) put(d, x, y, q < 5 ? [120, 230, 200] : q < 14 ? [30, 130, 110] : [16, 70, 64]);
        }
      put(d, 6, 5, [220, 255, 245]);
    });
    make('eye_of_ender', (d, r) => {
      clear(d);
      for (let y = 3; y < 13; y++)
        for (let x = 3; x < 13; x++) {
          const q = (x - 7.5) ** 2 + (y - 7.5) ** 2;
          if (q < 24) put(d, x, y, q < 24 && Math.abs(x - 7.5) < 1.2 && Math.abs(y - 7.5) < 3.5 ? [10, 30, 20] : q < 14 ? [110, 200, 90] : [40, 110, 60]);
        }
    });
    make('chorus_fruit', (d, r) => {
      clear(d);
      for (let y = 3; y < 14; y++)
        for (let x = 3; x < 14; x++) {
          const q = (x - 8) ** 2 + (y - 8.5) ** 2;
          if (q < 26 && r() > 0.08) put(d, x, y, q < 8 ? [200, 150, 210] : vary([140, 90, 150], r, 18));
        }
      put(d, 8, 2, [90, 60, 40]);
    });
    // Arpenteur
    make('mob_arpenteur', (d, r) => {
      fill(d, r, [16, 14, 20], 5);
      for (let k = 0; k < 8; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [30, 22, 40]);
    });
    make('mob_arpenteur_face', (d, r) => {
      fill(d, r, [16, 14, 20], 5);
      for (const x0 of [1, 10]) for (let x = x0; x < x0 + 5; x++) { put(d, x, 8, [220, 120, 255]); put(d, x, 9, [170, 60, 230]); }
    });
    // dragon
    make('mob_dragon', (d, r) => {
      fill(d, r, [26, 24, 30], 6);
      for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) put(d, x, y, [44, 40, 52]);
    });
    make('mob_dragon_belly', (d, r) => fill(d, r, [58, 54, 64], 8));
    make('mob_dragon_face', (d, r) => {
      fill(d, r, [26, 24, 30], 6);
      for (const x0 of [2, 10]) for (let x = x0; x < x0 + 4; x++) { put(d, x, 5, [230, 140, 255]); put(d, x, 6, [190, 80, 240]); }
      for (let x = 4; x < 12; x++) put(d, x, 12, [12, 10, 14]);
    });
    make('mob_dragon_wing', (d, r) => {
      fill(d, r, [40, 36, 46], 8);
      for (let x = 0; x < 16; x += 5) for (let y = 0; y < 16; y++) put(d, x, y, [70, 64, 78]);
    });
    make('mob_dragon_spike', (d, r) => fill(d, r, [80, 76, 86], 8));
    // cristal de l'End
    make('mob_crystal', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x === 0 || y === 0 || x === 15 || y === 15 || (x + y) % 7 === 0) put(d, x, y, [230, 210, 255]);
    });
    make('mob_crystal_core', (d, r) => {
      fill(d, r, [250, 120, 200], 20);
      for (let k = 0; k < 12; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [255, 220, 250]);
    });
    make('dbreath', (d, r) => fill(d, r, [190, 60, 230], 30));
  });

  // ================================================== ARPENTEUR ======
  // Neutre : il se fâche si on le frappe, ou si on le regarde dans les yeux. Il se téléporte.
  const lookOf = (g, q) => {
    if (q === g.player) return q.look();
    const cp = Math.cos(q.pitch || 0);
    return [-Math.sin(q.yaw || 0) * cp, Math.sin(q.pitch || 0), -Math.cos(q.yaw || 0) * cp];
  };
  MOBS.arpenteur = {
    name: 'Arpenteur', aliases: ['arpenteur', 'enderman'], hw: 0.3, h: 2.9, hp: 40, speed: 3, hostile: true, xp: 5, sound: 'teleport',
    init(m) {
      m.ai.stare = 0;
    },
    onHurt(e, m, by) {
      if (by && by.alive !== undefined) {
        m.ai.foe = by;
        m.ai.angry = 40;
      }
      // (souvent, il disparaît pour réapparaître un peu plus loin)
      if (e.rand() < 0.45 && CM.End) CM.End.teleportMob(e, m, m.x, m.z, 12);
    },
    update(e, m, dt, c) {
      const g = e.game;
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      m.ai.tpCd = (m.ai.tpCd || 0) - dt;
      // regardé dans les yeux : il se fâche
      if (!(m.ai.angry > 0)) {
        let seen = null;
        for (const q of e.plist) {
          if (q.alive === false) continue;
          const ex = q.x, ey = q.y + 1.62, ez = q.z, dx = m.x - ex, dy = m.y + 2.55 - ey, dz = m.z - ez, dd = Math.hypot(dx, dy, dz);
          if (dd > 32 || dd < 0.5) continue;
          const lk = lookOf(g, q);
          if ((dx * lk[0] + dy * lk[1] + dz * lk[2]) / dd > 0.992) seen = q;
        }
        m.ai.stare = seen ? m.ai.stare + dt : Math.max(0, m.ai.stare - dt);
        if (seen && m.ai.stare > 0.35) {
          m.ai.foe = seen;
          m.ai.angry = 40;
          CM.Audio.play('growl', { pitch: 1.6 });
        }
      }
      const foe = m.ai.foe;
      if (m.ai.angry > 0 && foe && foe.alive !== false) {
        m.ai.angry -= dt;
        m.ai.chasing = true;
        const dx = foe.x - m.x, dz = foe.z - m.z, d = Math.hypot(dx, dz), dir = Math.atan2(-dx, -dz);
        // trop loin : il se téléporte près de sa cible
        if (d > 14 && m.ai.tpCd <= 0 && CM.End) {
          m.ai.tpCd = 3 + e.rand() * 3;
          CM.End.teleportMob(e, m, foe.x, foe.z, 4);
        }
        if (d < 1.6 && Math.abs(foe.y - m.y) < 2.5 && m.ai.attackCd <= 0) {
          m.ai.attackCd = 1;
          e.hitPlayer(foe, 7, m, 'Un Arpenteur');
        }
        return { tvx: -Math.sin(dir) * 5, tvz: -Math.cos(dir) * 5, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
      }
      m.ai.chasing = false;
      m.ai.foe = null;
      m.ai.timer -= dt;
      if (m.ai.timer <= 0) {
        m.ai.timer = 3 + e.rand() * 5;
        m.ai.dir = e.rand() < 0.5 ? e.rand() * TAU : null;
        if (e.rand() < 0.08 && CM.End) CM.End.teleportMob(e, m, m.x, m.z, 16);
      }
      return m.ai.dir !== null && m.ai.dir !== undefined ? { tvx: -Math.sin(m.ai.dir) * 1.3, tvz: -Math.cos(m.ai.dir) * 1.3, jump: (m.hitX || m.hitZ) && m.onGround } : {};
    },
    loot(e, m, meat, more) {
      if (e.rand() < 0.6 + 0.15 * (more ? 1 : 0)) e.addDrop(CM.I.ENDER_PEARL, 1 + (more || 0), m.x, m.y + 1, m.z);
    },
    render(e, batch, m, l, f, sw, t) {
      const A = CM.Textures.layer.mob_arpenteur, F = CM.Textures.layer.mob_arpenteur_face, ff = f | 1;
      const shake = m.ai.chasing ? Math.sin(t * 40) * 0.03 : 0;
      e.part(batch, e.M, -0.1, 1.55, 0, sw * 0.6, [-0.06, -1.55, -0.06, 0.06, 0, 0.06], A, l, f);
      e.part(batch, e.M, 0.1, 1.55, 0, -sw * 0.6, [-0.06, -1.55, -0.06, 0.06, 0, 0.06], A, l, f);
      e.part(batch, e.M, 0, 1.55, 0, 0, [-0.22, 0, -0.12, 0.22, 0.8, 0.12], A, l, f);
      const arm = m.ai.chasing ? -0.5 : sw * 0.4;
      e.part(batch, e.M, -0.3, 2.3, 0, arm, [-0.05, -1.5, -0.05, 0.05, 0, 0.05], A, l, f);
      e.part(batch, e.M, 0.3, 2.3, 0, m.ai.chasing ? arm : -arm, [-0.05, -1.5, -0.05, 0.05, 0, 0.05], A, l, f);
      e.part(batch, e.M, shake, 2.35, 0, 0, [-0.24, 0, -0.24, 0.24, 0.48, 0.24], [A, A, A, A, A, F], l, [f, f, f, f, f, ff]);
      // mâchoire qui tombe quand il est fâché
      if (m.ai.chasing) e.part(batch, e.M, shake, 2.35, 0, 0, [-0.22, -0.18, -0.22, 0.22, 0, 0.22], A, l, f);
    },
  };

  // ============================================== CRISTAL DE L'END ===
  MOBS.end_crystal = {
    name: 'Cristal de l’End', aliases: ['cristal', 'end_crystal'], hw: 0.5, h: 1.6, hp: 1, speed: 0, fly: true, fireproof: true, persist: true, xp: 0, sound: null,
    update(e, m) {
      // fixé au-dessus de son pilier
      if (!m.ai.home) m.ai.home = [m.x, m.y, m.z];
      m.x = m.ai.home[0];
      m.y = m.ai.home[1];
      m.z = m.ai.home[2];
      m.vx = m.vy = m.vz = 0;
      return { tvy: 0 };
    },
    onDeath(e, m, by) {
      if (CM.End) CM.End.crystalDown(e.game, m, by);
    },
    loot() {},
    render(e, batch, m, l, f, sw, t) {
      const L = CM.Textures.layer, a = t * 1.6 + m.uid, b = 0.8 + Math.sin(t * 2 + m.uid) * 0.15;
      e.part(batch, e.M, 0, b, 0, a, [-0.45, -0.45, -0.45, 0.45, 0.45, 0.45], L.mob_crystal, [1, 1], 1, null, a * 0.7, 0.4);
      e.part(batch, e.M, 0, b, 0, -a * 1.3, [-0.26, -0.26, -0.26, 0.26, 0.26, 0.26], L.mob_crystal_core, [1, 1], 1, null, a * 0.5, -0.3);
    },
  };

  // ============================================== DRAGON DE L'END ====
  MOBS.ender_dragon = {
    name: 'Dragon de l’End', aliases: ['dragon', 'ender_dragon'], hw: 2.2, h: 2.4, hp: 200, speed: 12, hostile: true, boss: true, fly: true, fireproof: true, persist: true, xp: 500, sound: 'roar',
    onHurt(e, m) {
      m.vx = m.vy = m.vz = 0;
    },
    update(e, m, dt, c) {
      return CM.End ? CM.End.dragonAI(e, m, dt) : {};
    },
    loot(e, m) {
      if (CM.End) CM.End.dragonLoot(e, m);
    },
    onDeath(e, m, by) {
      if (CM.End) CM.End.dragonDown(e.game, m, by);
    },
    render(e, batch, m, l, f, sw, t) {
      const L = CM.Textures.layer, D = L.mob_dragon, Bl = L.mob_dragon_belly, W = L.mob_dragon_wing, S = L.mob_dragon_spike, ff = f | 1;
      const flap = Math.sin(t * 3.2 + m.uid) * 0.55;
      // corps
      e.part(batch, e.M, 0, 1.2, 0, 0, [-1.0, -0.7, -2.2, 1.0, 0.7, 2.2], [D, D, D, Bl, D, D], l, f);
      for (let k = -2; k <= 2; k++) e.part(batch, e.M, 0, 1.9, k * 0.8, 0, [-0.1, 0, -0.2, 0.1, 0.4, 0.2], S, l, f);
      // cou et tête
      for (let k = 0; k < 4; k++) {
        const z = -2.3 - k * 0.7, y = 1.3 + k * 0.12 + Math.sin(t * 1.5 - k * 0.5) * 0.08;
        e.part(batch, e.M, 0, y, z, 0, [-0.35, -0.35, -0.35, 0.35, 0.35, 0.35], D, l, f);
      }
      const hy = 1.75 + Math.sin(t * 1.5 - 2) * 0.1;
      e.part(batch, e.M, 0, hy, -5.2, 0, [-0.6, -0.4, -0.7, 0.6, 0.45, 0.5], [D, D, D, D, D, L.mob_dragon_face], l, [f, f, f, f, f, ff]);
      e.part(batch, e.M, 0, hy - 0.2, -5.9, 0, [-0.4, -0.25, -0.6, 0.4, 0.15, 0.2], D, l, f);
      const jaw = m.ai.chasing ? 0.4 + Math.sin(t * 8) * 0.15 : 0.1;
      e.part(batch, e.M, 0, hy - 0.4, -5.6, jaw, [-0.36, -0.15, -0.9, 0.36, 0, 0], Bl, l, f);
      e.part(batch, e.M, -0.35, hy + 0.45, -4.9, -0.5, [-0.06, 0, -0.06, 0.06, 0.4, 0.06], S, l, f);
      e.part(batch, e.M, 0.35, hy + 0.45, -4.9, -0.5, [-0.06, 0, -0.06, 0.06, 0.4, 0.06], S, l, f);
      // queue
      for (let k = 0; k < 7; k++) {
        const z = 2.4 + k * 0.62, x = Math.sin(t * 1.3 + k * 0.6) * 0.12 * k, y = 1.2 - k * 0.04, s = 0.34 - k * 0.03;
        e.part(batch, e.M, x, y, z, 0, [-s, -s, -s, s, s, s], D, l, f);
      }
      // ailes
      e.part(batch, e.M, 1.0, 1.7, -0.6, 0, [0, -0.08, -1.3, 4.6, 0.08, 1.3], W, l, f, null, 0, -flap);
      e.part(batch, e.M, -1.0, 1.7, -0.6, 0, [-4.6, -0.08, -1.3, 0, 0.08, 1.3], W, l, f, null, 0, flap);
      // pattes
      for (const [x, z] of [[-0.7, -1.4], [0.7, -1.4], [-0.8, 1.5], [0.8, 1.5]]) e.part(batch, e.M, x, 0.6, z, 0.5, [-0.18, -0.9, -0.18, 0.18, 0, 0.18], D, l, f);
    },
  };
})();
