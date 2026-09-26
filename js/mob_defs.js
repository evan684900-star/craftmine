'use strict';
// Nouvelles créatures : paisibles (poule, vache, lapin, cerf, chèvre, chauve-souris), neutre (loup)
// et hostiles (araignée, squelette, rampant, gluant, cube de magma du Nether).
// Chaque définition est ajoutée aux créatures du jeu (entities.js) : taille, vie, vitesse, et au
// besoin son comportement (update), des effets (tick), son butin (loot) et son dessin (render).
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});
  const TAU = Math.PI * 2;
  const toward = (dx, dz) => Math.atan2(-dx, -dz);

  // ------------------------------------------------------- objets --
  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1365, 'GUNPOWDER', { name: 'Poudre à canon', tex: 'gunpowder', desc: 'Laissée par les rampants. 5 poudres + 4 sables : une TNT.' });
    defItem(1366, 'MAGMA_CREAM', { name: 'Crème de magma', tex: 'magma_cream', desc: 'Laissée par les petits cubes de magma. 4 crèmes : un bloc de magma.' });
  });
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.recipes.push(r(B.TNT, 1, [[I.GUNPOWDER, 5], ['sand', 4]], 'table', 'deco'));
    if (B.MAGMA) CM.recipes.push(r(B.MAGMA, 1, [[I.MAGMA_CREAM, 4]], 'table', 'blocs'));
  });

  // ----------------------------------------------------- textures --
  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const px = (d, pts, c) => {
      for (const [x, y] of pts) put(d, x, y, c);
    };
    const eyes = (d, y, c, c2, gap) => {
      const a = gap || 3;
      put(d, a, y, c2 || [240, 240, 240]); put(d, a + 1, y, c);
      put(d, 15 - a - 1, y, c); put(d, 15 - a, y, c2 || [240, 240, 240]);
    };
    // objets
    make('gunpowder', (d, r) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
      for (let y = 5; y < 14; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, (y - 10) * 1.4) < 5.2 && r() < 0.85) put(d, x, y, vary([96, 96, 100], r, 30));
    });
    make('magma_cream', (d, r) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
      for (let y = 3; y < 14; y++) for (let x = 3; x < 14; x++) {
        const k = Math.hypot(x - 8, y - 8.5);
        if (k < 5.2) put(d, x, y, k < 2.5 ? [255, 214, 90] : vary([226, 110, 30], r, 16));
      }
    });
    // poule
    make('mob_chicken', (d, r) => {
      fill(d, r, [238, 236, 230], 6);
      for (let k = 0; k < 18; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [214, 212, 206]);
    });
    make('mob_chicken_face', (d, r) => {
      fill(d, r, [240, 238, 232], 5);
      eyes(d, 6, [20, 20, 20], [20, 20, 20], 3);
    });
    make('mob_beak', (d, r) => fill(d, r, [236, 170, 40], 10));
    make('mob_wattle', (d, r) => fill(d, r, [200, 30, 30], 10));
    // vache
    make('mob_cow', (d, r) => {
      fill(d, r, [238, 236, 232], 5);
      for (let k = 0; k < 4; k++) {
        const cx = r() * 16, cy = r() * 16, rr = 2 + r() * 3.5;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - cx, y - cy) < rr + (r() - 0.5)) put(d, x, y, vary([36, 32, 30], r, 6));
      }
    });
    make('mob_cow_face', (d, r) => {
      fill(d, r, [40, 36, 34], 5);
      for (let y = 0; y < 16; y++) for (let x = 5; x < 11; x++) put(d, x, y, vary([236, 234, 230], r, 5));
      eyes(d, 6, [16, 16, 16], [230, 230, 230], 2);
      for (let y = 11; y < 16; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary([222, 168, 160], r, 6));
      put(d, 5, 13, [120, 70, 70]); put(d, 10, 13, [120, 70, 70]);
    });
    make('mob_horn', (d, r) => fill(d, r, [226, 220, 196], 8));
    // lapin
    make('mob_rabbit', (d, r) => {
      fill(d, r, [150, 124, 96], 10);
      for (let k = 0; k < 20; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [176, 152, 124]);
    });
    make('mob_rabbit_face', (d, r) => {
      fill(d, r, [156, 130, 102], 8);
      eyes(d, 6, [20, 16, 14], [20, 16, 14], 3);
      put(d, 7, 9, [230, 150, 160]); put(d, 8, 9, [230, 150, 160]);
      for (let x = 5; x < 11; x++) put(d, x, 12, [230, 224, 214]);
    });
    // cerf
    make('mob_deer', (d, r) => {
      fill(d, r, [160, 106, 60], 8);
      for (let k = 0; k < 10; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 8), [236, 222, 196]);
    });
    make('mob_deer_face', (d, r) => {
      fill(d, r, [166, 112, 66], 6);
      eyes(d, 5, [20, 16, 14], [20, 16, 14], 3);
      for (let y = 11; y < 16; y++) for (let x = 5; x < 11; x++) put(d, x, y, [48, 34, 26]);
    });
    make('mob_antler', (d, r) => fill(d, r, [196, 172, 132], 10));
    // chèvre
    make('mob_goat', (d, r) => {
      fill(d, r, [226, 220, 204], 8);
      for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x++) if (r() < 0.3) put(d, x, y, [206, 198, 180]);
    });
    make('mob_goat_face', (d, r) => {
      fill(d, r, [230, 224, 208], 6);
      eyes(d, 6, [150, 110, 30], [20, 20, 20], 3);
      for (let y = 12; y < 16; y++) for (let x = 6; x < 10; x++) put(d, x, y, [196, 188, 170]);
    });
    make('mob_goat_horn', (d, r) => fill(d, r, [120, 110, 100], 10));
    // chauve-souris
    make('mob_bat', (d, r) => fill(d, r, [70, 52, 40], 8));
    make('mob_bat_wing', (d, r) => {
      fill(d, r, [40, 30, 26], 6);
      for (let x = 2; x < 16; x += 4) for (let y = 0; y < 16; y++) put(d, x, y, [60, 46, 38]);
    });
    make('mob_bat_face', (d, r) => {
      fill(d, r, [72, 54, 42], 6);
      eyes(d, 7, [20, 10, 10], [20, 10, 10], 4);
    });
    // loup
    make('mob_wolf', (d, r) => {
      fill(d, r, [184, 180, 176], 10);
      for (let k = 0; k < 24; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [150, 144, 140]);
    });
    make('mob_wolf_face', (d, r) => {
      fill(d, r, [190, 186, 182], 6);
      eyes(d, 5, [30, 30, 30], [30, 30, 30], 3);
      for (let y = 10; y < 16; y++) for (let x = 5; x < 11; x++) put(d, x, y, [210, 206, 200]);
      put(d, 7, 11, [30, 28, 28]); put(d, 8, 11, [30, 28, 28]);
    });
    make('mob_wolf_angry', (d, r) => {
      fill(d, r, [180, 176, 172], 6);
      for (const x of [3, 4, 11, 12]) put(d, x, 5, [220, 30, 30]);
      for (let x = 4; x < 12; x++) put(d, x, 13, [240, 240, 240]);
      put(d, 7, 11, [30, 28, 28]); put(d, 8, 11, [30, 28, 28]);
    });
    // araignée
    make('mob_spider', (d, r) => {
      fill(d, r, [52, 44, 40], 6);
      for (let k = 0; k < 30; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [36, 30, 28]);
    });
    make('mob_spider_face', (d, r) => {
      fill(d, r, [46, 38, 34], 5);
      px(d, [[3, 6], [4, 6], [11, 6], [12, 6], [5, 5], [10, 5], [6, 7], [9, 7]], [220, 30, 30]);
      px(d, [[4, 7], [11, 7]], [150, 10, 10]);
    });
    // squelette
    make('mob_bone', (d, r) => fill(d, r, [210, 208, 198], 8));
    make('mob_skull', (d, r) => {
      fill(d, r, [214, 212, 202], 6);
      for (const x0 of [3, 10]) for (let y = 5; y < 8; y++) for (let x = x0; x < x0 + 3; x++) put(d, x, y, [40, 38, 36]);
      put(d, 7, 9, [60, 58, 54]); put(d, 8, 9, [60, 58, 54]);
      for (let x = 4; x < 12; x++) put(d, x, 12, x % 2 ? [60, 58, 54] : [190, 188, 178]);
    });
    make('mob_ribs', (d, r) => {
      fill(d, r, [30, 28, 26], 4);
      for (let y = 1; y < 16; y += 3) for (let x = 2; x < 14; x++) put(d, x, y, vary([210, 208, 198], r, 8));
      for (let y = 0; y < 16; y++) { put(d, 7, y, [210, 208, 198]); put(d, 8, y, [210, 208, 198]); }
    });
    // rampant
    make('mob_rampant', (d, r) => {
      fill(d, r, [90, 170, 70], 14);
      for (let k = 0; k < 40; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), vary([60, 130, 50], r, 12));
      for (let k = 0; k < 12; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [170, 214, 150]);
    });
    make('mob_rampant_face', (d, r) => {
      fill(d, r, [90, 170, 70], 12);
      for (let k = 0; k < 30; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), vary([60, 130, 50], r, 12));
      const B = [20, 26, 18];
      for (let y = 4; y < 8; y++) for (const x0 of [3, 9]) for (let x = x0; x < x0 + 4; x++) put(d, x, y, B);
      for (let y = 8; y < 14; y++) for (let x = 6; x < 10; x++) put(d, x, y, B);
      for (let y = 10; y < 15; y++) { put(d, 5, y, B); put(d, 10, y, B); }
    });
    // gluant
    make('mob_slime', (d, r) => {
      fill(d, r, [110, 196, 90], 10);
      for (let x = 0; x < 16; x++) { put(d, x, 0, [80, 160, 66]); put(d, x, 15, [80, 160, 66]); put(d, 0, x, [80, 160, 66]); put(d, 15, x, [80, 160, 66]); }
      for (let k = 0; k < 10; k++) put(d, 2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), [150, 226, 130]);
    });
    make('mob_slime_face', (d, r) => {
      fill(d, r, [110, 196, 90], 10);
      for (let x = 0; x < 16; x++) { put(d, x, 0, [80, 160, 66]); put(d, x, 15, [80, 160, 66]); put(d, 0, x, [80, 160, 66]); put(d, 15, x, [80, 160, 66]); }
      for (const x0 of [3, 10]) for (let y = 4; y < 7; y++) for (let x = x0; x < x0 + 3; x++) put(d, x, y, [30, 60, 26]);
      put(d, 9, 10, [30, 60, 26]); put(d, 10, 10, [30, 60, 26]);
    });
    // cube de magma
    make('mob_magma', (d, r) => {
      fill(d, r, [58, 22, 14], 8);
      for (let k = 0; k < 5; k++) {
        const y = Math.floor(r() * 16);
        for (let x = 0; x < 16; x++) if (r() < 0.7) put(d, x, (y + Math.floor(x / 6)) % 16, vary([250, 120, 30], r, 20));
      }
    });
    make('mob_magma_face', (d, r) => {
      fill(d, r, [58, 22, 14], 8);
      for (let x = 0; x < 16; x++) if (r() < 0.6) put(d, x, 12, [250, 120, 30]);
      for (const x0 of [3, 10]) for (let y = 5; y < 7; y++) for (let x = x0; x < x0 + 3; x++) put(d, x, y, [255, 214, 90]);
    });
  });

  // ------------------------------------------------ outils communs --
  const solid = (w, x, y, z) => w.solidAt(Math.floor(x), Math.floor(y), Math.floor(z));
  // Direction -> vitesse, en évitant les falaises.
  function walk(e, m, dir, speed, cliff) {
    if (dir === null || dir === undefined) return [0, 0];
    const dx = -Math.sin(dir), dz = -Math.cos(dir);
    if (cliff !== false && m.onGround) {
      const w = e.game.world, ax = m.x + dx * (m.hw + 0.6), az = m.z + dz * (m.hw + 0.6), ay = m.y;
      if (!solid(w, ax, ay - 1, az) && !solid(w, ax, ay - 2, az) && !solid(w, ax, ay - 3, az) && !solid(w, ax, ay, az)) return [0, 0];
    }
    return [dx * speed, dz * speed];
  }
  function wander(e, m, dt, speed, chance) {
    m.ai.timer -= dt;
    if (m.ai.timer <= 0) {
      m.ai.timer = 2 + e.rand() * 3;
      m.ai.dir = e.rand() < (chance || 0.5) ? e.rand() * TAU : null;
    }
    return walk(e, m, m.ai.dir, speed);
  }
  // Rien de solide entre la créature et le joueur (vue dégagée).
  function sees(e, m, p, eyeH) {
    const w = e.game.world, ex = m.x, ey = m.y + (eyeH || 1.5), ez = m.z;
    const dx = p.x - ex, dy = p.y + 1.5 - ey, dz = p.z - ez, d = Math.hypot(dx, dy, dz);
    if (d < 0.5) return true;
    return !w.raycast(ex, ey, ez, dx / d, dy / d, dz / d, d, (id) => CM.blocks[id].solid && CM.blocks[id].opaque !== false);
  }
  // Brûle au soleil.
  function sunBurn(e, m, dt, c) {
    const g = e.game, w = g.world;
    if (w.nether || g.daylight <= 0.45 || w.skyAt(Math.floor(m.x), Math.floor(m.y + 1.5), Math.floor(m.z)) < 12) return;
    // prend feu (1 point par seconde, flammes visibles de tous) ; l'eau et l'ombre le sauvent
    if (!CM.isWater(w.get(Math.floor(m.x), Math.floor(m.y + 0.4), Math.floor(m.z)))) m.fire = Math.max(m.fire || 0, 1.5);
  }
  function bite(e, m, p, n, cause, reach) {
    if (!p.alive || m.ai.attackCd > 0) return false;
    const d = Math.hypot(p.x - m.x, p.z - m.z), dy = p.y - m.y;
    if (d > (reach || 1.3) + m.hw || dy < -1.6 || dy > Math.max(1.8, m.h)) return false;
    m.ai.attackCd = 1;
    e.hitPlayer(p, n, m, cause);
    return true;
  }
  const noLoot = () => {};
  const I = () => CM.I, Bk = () => CM.B;
  const drop = (e, m, id, n) => {
    if (id !== undefined && n > 0) e.addDrop(id, n, m.x, m.y + 0.5, m.z);
  };

  // ------------------------------------------------ dessin commun --
  const Lr = () => CM.Textures.layer;
  const head6 = (side, face) => [side, side, side, side, side, face];

  // ================================================== PAISIBLES ======
  MOBS.chicken = {
    name: 'Poule', aliases: ['poule', 'poulet', 'chicken', 'cocotte'], hw: 0.22, h: 0.72, hp: 4, speed: 1.1, passive: true,
    sound: 'cluck', breed: ['SEEDS', 'BEETROOT_SEEDS', 'PUMPKIN_SEEDS', 'MELON_SEEDS'], group: [2, 4],
    // bat des ailes et descend doucement ; pond parfois une plume
    tick(e, m, dt) {
      if (!m.onGround && m.vy < -3) m.vy = -3;
      if (m.tame && m.baby <= 0 && e.rand() < dt / 400) drop(e, m, I().FEATHER, 1);
    },
    loot(e, m, meat, more) {
      drop(e, m, I().FEATHER, Math.floor(e.rand() * 3) + more());
      drop(e, m, meat, 1 + more());
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), W = L.mob_chicken;
      const flap = !m.onGround ? Math.sin(t * 30) * 0.9 : m.moving ? Math.sin(m.walk * 2) * 0.15 : 0;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.18, 0.28, -0.24, 0.18, 0.6, 0.26], W, l, f);
      e.part(batch, e.M, 0, 0.55, -0.2, 0, [-0.13, 0, -0.13, 0.13, 0.32, 0.09], head6(W, L.mob_chicken_face), l, f);
      e.part(batch, e.M, 0, 0.55, -0.2, 0, [-0.06, 0.1, -0.24, 0.06, 0.18, -0.13], L.mob_beak, l, f);
      e.part(batch, e.M, 0, 0.55, -0.2, 0, [-0.04, 0.02, -0.18, 0.04, 0.1, -0.13], L.mob_wattle, l, f);
      e.part(batch, e.M, -0.19, 0.55, 0, 0, [-0.04, -0.24, -0.16, 0, 0, 0.18], W, l, f, null, 0, -flap);
      e.part(batch, e.M, 0.19, 0.55, 0, 0, [0, -0.24, -0.16, 0.04, 0, 0.18], W, l, f, null, 0, flap);
      e.part(batch, e.M, -0.08, 0.28, 0, sw * 0.8, [-0.02, -0.28, -0.02, 0.02, 0, 0.02], L.mob_beak, l, f);
      e.part(batch, e.M, 0.08, 0.28, 0, -sw * 0.8, [-0.02, -0.28, -0.02, 0.02, 0, 0.02], L.mob_beak, l, f);
    },
  };
  MOBS.cow = {
    name: 'Vache', aliases: ['vache', 'cow', 'boeuf', 'taureau'], hw: 0.45, h: 1.35, hp: 10, speed: 1.1, passive: true,
    sound: 'moo', breed: ['WHEAT'], group: [1, 3],
    loot(e, m, meat, more) {
      drop(e, m, I().LEATHER, Math.floor(e.rand() * 3) + more());
      drop(e, m, meat, 1 + Math.floor(e.rand() * 3) + more());
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), H = L.mob_cow;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.4, 0.62, -0.62, 0.4, 1.22, 0.62], H, l, f);
      const hb = Math.sin(t * 1.5 + m.age) * 0.06;
      e.part(batch, e.M, 0, 1.08, -0.6, hb, [-0.26, -0.22, -0.3, 0.26, 0.24, 0.04], head6(H, L.mob_cow_face), l, f);
      e.part(batch, e.M, 0, 1.08, -0.6, hb, [-0.36, 0.14, -0.2, -0.26, 0.22, -0.1], L.mob_horn, l, f);
      e.part(batch, e.M, 0, 1.08, -0.6, hb, [0.26, 0.14, -0.2, 0.36, 0.22, -0.1], L.mob_horn, l, f);
      for (const [x, z, ph] of [[-0.24, -0.44, 1], [0.24, -0.44, -1], [-0.24, 0.44, -1], [0.24, 0.44, 1]])
        e.part(batch, e.M, x, 0.64, z, sw * 0.6 * ph, [-0.12, -0.64, -0.12, 0.12, 0, 0.12], H, l, f);
    },
  };
  MOBS.rabbit = {
    name: 'Lapin', aliases: ['lapin', 'rabbit', 'lievre'], hw: 0.2, h: 0.5, hp: 3, speed: 1.9, passive: true,
    sound: 'squeak', breed: ['CARROT', 'GOLDEN_CARROT'], hop: true, group: [1, 3],
    loot(e, m, meat, more) {
      drop(e, m, meat, e.rand() < 0.6 ? 1 + more() : 0);
      if (e.rand() < 0.3) drop(e, m, I().LEATHER, 1);
    },
    render(e, batch, m, l, f, sw) {
      const L = Lr(), F = L.mob_rabbit;
      const crouch = m.onGround ? 0 : 0.1;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.15, 0.08 + crouch, -0.16, 0.15, 0.36 + crouch, 0.22], F, l, f);
      e.part(batch, e.M, 0, 0.3 + crouch, -0.16, 0, [-0.12, 0, -0.18, 0.12, 0.22, 0.02], head6(F, L.mob_rabbit_face), l, f);
      e.part(batch, e.M, -0.06, 0.52 + crouch, -0.08, -0.2, [-0.03, 0, -0.03, 0.03, 0.26, 0.03], F, l, f);
      e.part(batch, e.M, 0.06, 0.52 + crouch, -0.08, -0.2, [-0.03, 0, -0.03, 0.03, 0.26, 0.03], F, l, f);
      e.part(batch, e.M, 0, 0.26 + crouch, 0.22, 0, [-0.05, -0.05, 0, 0.05, 0.05, 0.08], L.mob_goat, l, f);
      e.part(batch, e.M, -0.1, 0.1, 0.1, m.onGround ? 0 : 0.8, [-0.04, -0.1, -0.12, 0.04, 0, 0.06], F, l, f);
      e.part(batch, e.M, 0.1, 0.1, 0.1, m.onGround ? 0 : 0.8, [-0.04, -0.1, -0.12, 0.04, 0, 0.06], F, l, f);
    },
  };
  MOBS.deer = {
    name: 'Cerf', aliases: ['cerf', 'deer', 'biche', 'daim'], hw: 0.35, h: 1.5, hp: 10, speed: 1.4, passive: true,
    sound: 'hmm', breed: ['APPLE'], group: [1, 3], skittish: true,
    loot(e, m, meat, more) {
      drop(e, m, I().LEATHER, Math.floor(e.rand() * 2) + more());
      drop(e, m, meat, 1 + Math.floor(e.rand() * 2) + more());
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), D = L.mob_deer;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.26, 0.72, -0.5, 0.26, 1.14, 0.5], D, l, f);
      const nb = m.moving ? 0 : Math.max(0, Math.sin(t * 0.7 + m.age)) * 0.9;
      e.part(batch, e.M, 0, 1.08, -0.44, -0.35 + nb, [-0.1, 0, -0.1, 0.1, 0.42, 0.1], D, l, f);
      e.part(batch, e.M, 0, 1.08, -0.44, -0.35 + nb, [-0.14, 0.38, -0.34, 0.14, 0.6, 0.06], head6(D, L.mob_deer_face), l, f);
      if (!(m.baby > 0))
        for (const s of [-1, 1]) {
          e.part(batch, e.M, 0, 1.08, -0.44, -0.35 + nb, [s * 0.06 - 0.03, 0.6, -0.08, s * 0.06 + 0.03, 0.9, -0.02], L.mob_antler, l, f);
          e.part(batch, e.M, 0, 1.08, -0.44, -0.35 + nb, [Math.min(s * 0.06, s * 0.24), 0.82, -0.08, Math.max(s * 0.06, s * 0.24), 0.86, -0.02], L.mob_antler, l, f);
        }
      for (const [x, z, ph] of [[-0.14, -0.38, 1], [0.14, -0.38, -1], [-0.14, 0.38, -1], [0.14, 0.38, 1]])
        e.part(batch, e.M, x, 0.74, z, sw * 0.7 * ph, [-0.06, -0.74, -0.06, 0.06, 0, 0.06], D, l, f);
    },
  };
  MOBS.goat = {
    name: 'Chèvre', aliases: ['chevre', 'goat', 'bouc', 'bouquetin'], hw: 0.33, h: 1.15, hp: 10, speed: 1.3, passive: true,
    sound: 'baa', breed: ['WHEAT'], group: [1, 3], retaliate: true, ram: 3, cause: 'Une chèvre',
    // saute très haut de temps en temps (rochers)
    tick(e, m, dt) {
      if (m.onGround && m.moving && e.rand() < dt * 0.15) m.vy = 11;
    },
    loot(e, m, meat, more) {
      drop(e, m, meat, 1 + Math.floor(e.rand() * 2) + more());
      if (e.rand() < 0.4) drop(e, m, I().LEATHER, 1);
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), G = L.mob_goat;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.28, 0.52, -0.42, 0.28, 1.0, 0.42], G, l, f);
      const hb = Math.sin(t * 2 + m.age) * 0.05;
      e.part(batch, e.M, 0, 0.92, -0.42, hb, [-0.14, -0.14, -0.32, 0.14, 0.22, 0.04], head6(G, L.mob_goat_face), l, f);
      e.part(batch, e.M, 0, 0.92, -0.42, hb, [-0.05, -0.36, -0.28, 0.05, -0.14, -0.2], G, l, f);
      e.part(batch, e.M, 0, 0.92, -0.42, hb - 0.5, [-0.14, 0.16, -0.02, -0.07, 0.46, 0.05], L.mob_goat_horn, l, f);
      e.part(batch, e.M, 0, 0.92, -0.42, hb - 0.5, [0.07, 0.16, -0.02, 0.14, 0.46, 0.05], L.mob_goat_horn, l, f);
      for (const [x, z, ph] of [[-0.16, -0.3, 1], [0.16, -0.3, -1], [-0.16, 0.3, -1], [0.16, 0.3, 1]])
        e.part(batch, e.M, x, 0.54, z, sw * 0.7 * ph, [-0.08, -0.54, -0.08, 0.08, 0, 0.08], G, l, f);
    },
  };
  MOBS.bat = {
    name: 'Chauve-souris', aliases: ['chauve_souris', 'bat', 'chauvesouris'], hw: 0.22, h: 0.5, hp: 3, speed: 3, passive: true,
    sound: 'squeak', fly: true, ambient: true,
    // vole au hasard dans les grottes, fuit le sol et le plafond
    update(e, m, dt) {
      const w = e.game.world, r = e.rand;
      m.ai.timer -= dt;
      if (m.ai.timer <= 0 || m.hitX || m.hitZ) {
        m.ai.timer = 0.4 + r() * 1.2;
        m.ai.dir = r() * TAU;
        m.ai.vy = (r() - 0.5) * 4;
      }
      let vy = m.ai.vy || 0;
      if (solid(w, m.x, m.y - 1.2, m.z)) vy = Math.max(vy, 1.5);
      if (solid(w, m.x, m.y + m.h + 0.8, m.z)) vy = Math.min(vy, -1.5);
      if (m.ai.flee > 0) m.ai.flee -= dt;
      return { tvx: -Math.sin(m.ai.dir) * 3, tvz: -Math.cos(m.ai.dir) * 3, tvy: vy };
    },
    loot: noLoot,
    xp: 0,
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), Bt = L.mob_bat, wing = Math.sin(t * 28 + m.age * 3) * 0.9;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.09, 0.12, -0.1, 0.09, 0.4, 0.1], Bt, l, f);
      e.part(batch, e.M, 0, 0.36, -0.02, 0, [-0.1, 0, -0.12, 0.1, 0.16, 0.08], head6(Bt, L.mob_bat_face), l, f);
      e.part(batch, e.M, -0.07, 0.5, -0.02, 0, [-0.03, 0, -0.02, 0.01, 0.08, 0.02], Bt, l, f);
      e.part(batch, e.M, 0.07, 0.5, -0.02, 0, [-0.01, 0, -0.02, 0.03, 0.08, 0.02], Bt, l, f);
      e.part(batch, e.M, -0.09, 0.34, 0, 0, [-0.5, -0.18, -0.01, 0, 0.02, 0.01], L.mob_bat_wing, l, f, null, 0, wing);
      e.part(batch, e.M, 0.09, 0.34, 0, 0, [0, -0.18, -0.01, 0.5, 0.02, 0.01], L.mob_bat_wing, l, f, null, 0, -wing);
    },
  };

  // ==================================================== NEUTRE =======
  // Loup : paisible tant qu'on ne le frappe pas ; alors toute la meute attaque.
  MOBS.wolf = {
    name: 'Loup', aliases: ['loup', 'wolf', 'louve'], hw: 0.3, h: 0.85, hp: 12, speed: 1.4, passive: true, neutral: true,
    sound: 'growl', group: [2, 4], xp: 3,
    onHurt(e, m, by) {
      const foe = by && by.alive !== undefined ? by : e.nearestPlayer(m.x, m.y, m.z);
      for (const o of e.mobs) {
        if (o.type !== 'wolf' || o.dead || Math.hypot(o.x - m.x, o.z - m.z) > 16) continue;
        o.ai.angry = 25;
        o.ai.foe = foe;
      }
    },
    update(e, m, dt, c) {
      if (m.ai.angry > 0) {
        m.ai.angry -= dt;
        const p = m.ai.foe && m.ai.foe.alive !== false ? m.ai.foe : c.p;
        const d = Math.hypot(p.x - m.x, p.z - m.z);
        if (!p.alive || d > 30) m.ai.angry = 0;
        m.ai.chasing = true;
        const [tvx, tvz] = walk(e, m, toward(p.x - m.x, p.z - m.z), 4.6, false);
        bite(e, m, p, 3, 'Un loup');
        if (c.distL < 20 && e.rand() < dt * 0.6) CM.Audio.play('growl');
        return { tvx, tvz };
      }
      m.ai.chasing = false;
      const [tvx, tvz] = wander(e, m, dt, 1.4, 0.5);
      if (c.distL < 14 && e.rand() < dt * 0.03) CM.Audio.play('growl', { pitch: 1.4 });
      return { tvx, tvz };
    },
    loot: noLoot,
    render(e, batch, m, l, f, sw) {
      const L = Lr(), W = L.mob_wolf, face = m.ai.chasing ? L.mob_wolf_angry : L.mob_wolf_face;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.18, 0.42, -0.42, 0.18, 0.76, 0.34], W, l, f);
      e.part(batch, e.M, 0, 0.44, -0.42, 0, [-0.23, 0.02, -0.02, 0.23, 0.4, 0.14], W, l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [-0.16, -0.12, -0.26, 0.16, 0.18, 0.02], head6(W, face), l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [-0.07, -0.12, -0.4, 0.07, 0.0, -0.26], W, l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [-0.14, 0.18, -0.12, -0.06, 0.3, -0.06], W, l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [0.06, 0.18, -0.12, 0.14, 0.3, -0.06], W, l, f);
      e.part(batch, e.M, 0, 0.66, 0.34, m.ai.chasing ? -0.2 : 0.7, [-0.05, -0.05, 0, 0.05, 0.05, 0.36], W, l, f);
      for (const [x, z, ph] of [[-0.1, -0.3, 1], [0.1, -0.3, -1], [-0.1, 0.26, -1], [0.1, 0.26, 1]])
        e.part(batch, e.M, x, 0.44, z, sw * 0.8 * ph, [-0.05, -0.44, -0.05, 0.05, 0, 0.05], W, l, f);
    },
  };

  // =================================================== HOSTILES ======
  // Araignée : attaque la nuit (le jour, seulement si on la frappe), grimpe aux murs, bondit.
  MOBS.spider = {
    name: 'Araignée', aliases: ['araignee', 'spider'], hw: 0.62, h: 0.85, hp: 16, speed: 3.1, hostile: true, xp: 5, sound: 'skitter',
    onHurt(e, m) {
      m.ai.angry = 20;
    },
    update(e, m, dt, c) {
      const { p, distP, dyp, g } = c;
      const w = g.world;
      const day = !w.nether && g.daylight > 0.45 && w.skyAt(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z)) >= 12;
      if (m.ai.angry > 0) m.ai.angry -= dt;
      let tvx = 0, tvz = 0, climb = false;
      if ((!day || m.ai.angry > 0) && p.alive && distP < 20 && Math.abs(dyp) < 12) {
        m.ai.chasing = true;
        const dir = toward(p.x - m.x, p.z - m.z);
        [tvx, tvz] = walk(e, m, dir, 3.2, false);
        // bond sur sa proie
        if (distP < 4 && distP > 1.6 && m.onGround && m.ai.attackCd <= 0 && e.rand() < dt * 1.5) {
          m.vy = 6.5;
          m.vx = -Math.sin(dir) * 7;
          m.vz = -Math.cos(dir) * 7;
          m.knock = 0.25;
        }
        bite(e, m, p, 2, 'Une araignée', 0.9);
      } else {
        m.ai.chasing = false;
        [tvx, tvz] = wander(e, m, dt, 1.6, 0.5);
      }
      if ((m.hitX || m.hitZ) && (tvx || tvz)) climb = true;
      if (c.distL < 12 && e.rand() < dt * 0.15) CM.Audio.play('skitter');
      return { tvx, tvz, climb };
    },
    loot(e, m, meat, more) {
      drop(e, m, I().ROPE, Math.floor(e.rand() * 3) + more());
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), S = L.mob_spider;
      e.part(batch, e.M, 0, 0, 0.1, 0, [-0.42, 0.24, 0, 0.42, 0.78, 0.8], S, l, f);
      e.part(batch, e.M, 0, 0, 0, 0, [-0.24, 0.3, -0.36, 0.24, 0.62, 0.12], S, l, f);
      e.part(batch, e.M, 0, 0.44, -0.36, 0, [-0.26, -0.16, -0.32, 0.26, 0.2, 0.02], head6(S, L.mob_spider_face), l, f, [f, f, f, f, f, f ? 2 : 1]);
      const run = m.moving ? t * 14 + m.age : 0;
      for (let i = 0; i < 4; i++) {
        const z = -0.24 + i * 0.16, spread = (i - 1.5) * 0.45;
        for (const s of [-1, 1]) {
          const lift = m.moving ? Math.sin(run + i * 1.7 + (s > 0 ? Math.PI : 0)) * 0.22 : 0;
          e.part(batch, e.M, s * 0.2, 0.52, z, 0, s > 0 ? [0, -0.04, -0.04, 0.95, 0.04, 0.04] : [-0.95, -0.04, -0.04, 0, 0.04, 0.04], S, l, f, null, s * spread, s * (-0.55 + lift));
        }
      }
    },
  };
  // Squelette : garde ses distances et tire des flèches ; brûle au soleil.
  MOBS.skeleton = {
    name: 'Squelette', aliases: ['squelette', 'skeleton', 'archer'], hw: 0.3, h: 1.95, hp: 16, speed: 2.4, hostile: true, xp: 5, sound: 'rattle',
    update(e, m, dt, c) {
      const { p, distP, dyp } = c;
      sunBurn(e, m, dt, c);
      if (m.dead) return {};
      let tvx = 0, tvz = 0, face;
      m.ai.special = false;
      if (p.alive && distP < 20 && Math.abs(dyp) < 12) {
        m.ai.chasing = true;
        const dir = toward(p.x - m.x, p.z - m.z);
        face = dir;
        const see = sees(e, m, p);
        if (distP > 11 || !see) [tvx, tvz] = walk(e, m, dir, 2.4);
        else if (distP < 5) [tvx, tvz] = walk(e, m, dir + Math.PI, 2.2);
        else {
          // pas de côté en visant
          m.ai.strafe = (m.ai.strafe || 1) * (e.rand() < dt * 0.4 ? -1 : 1);
          [tvx, tvz] = walk(e, m, dir + (Math.PI / 2) * m.ai.strafe, 1.1);
        }
        m.ai.bowT = see && distP < 16 ? (m.ai.bowT || 0) + dt : 0;
        m.ai.special = m.ai.bowT > 0.6;
        const every = { easy: 2.6, normal: 2, hard: 1.4 }[e.game.difficulty] || 2;
        if (m.ai.bowT >= every) {
          m.ai.bowT = 0;
          const sx = m.x - Math.sin(dir) * 0.4, sy = m.y + 1.45, sz = m.z - Math.cos(dir) * 0.4;
          const dx = p.x - sx, dy = p.y + 1.1 - sy, dz = p.z - sz, d = Math.hypot(dx, dz);
          const sp = 24, tt = d / sp, err = { easy: 0.12, normal: 0.07, hard: 0.035 }[e.game.difficulty] || 0.07;
          const vx = (dx / d) * sp + (e.rand() - 0.5) * sp * err, vz = (dz / d) * sp + (e.rand() - 0.5) * sp * err;
          e.shootArrow(sx, sy, sz, vx, dy / Math.max(tt, 0.05) + 10 * tt, vz, m);
        }
      } else {
        m.ai.chasing = false;
        m.ai.bowT = 0;
        [tvx, tvz] = wander(e, m, dt, 1.2, 0.5);
      }
      if (c.distL < 14 && e.rand() < dt * 0.1) CM.Audio.play('rattle');
      return { tvx, tvz, face };
    },
    loot(e, m, meat, more) {
      drop(e, m, I().ARROW, Math.floor(e.rand() * 3) + more());
      drop(e, m, I().BONE_MEAL, 1 + Math.floor(e.rand() * 2) + more());
      if (e.rand() < 0.04) e.addDrop(I().BOW, 1, m.x, m.y + 0.5, m.z, { xp: 0 });
    },
    render(e, batch, m, l, f, sw) {
      const L = Lr(), Bn = L.mob_bone;
      const leg = [-0.05, -0.85, -0.05, 0.05, 0, 0.05];
      e.part(batch, e.M, -0.1, 0.85, 0, sw * 0.6, leg, Bn, l, f);
      e.part(batch, e.M, 0.1, 0.85, 0, -sw * 0.6, leg, Bn, l, f);
      e.part(batch, e.M, 0, 0, 0, 0, [-0.22, 0.85, -0.1, 0.22, 1.5, 0.1], [Bn, Bn, Bn, Bn, L.mob_ribs, L.mob_ribs], l, f);
      const aim = m.ai.chasing ? -1.5 : sw * 0.5;
      const arm = [-0.05, -0.68, -0.05, 0.05, 0.04, 0.05];
      e.part(batch, e.M, -0.28, 1.46, 0, aim, arm, Bn, l, f, null, m.ai.chasing ? 0.25 : 0);
      e.part(batch, e.M, 0.28, 1.46, 0, m.ai.chasing ? aim : -aim, arm, Bn, l, f, null, m.ai.chasing ? -0.35 : 0);
      e.part(batch, e.M, 0, 1.5, 0, 0, [-0.22, 0, -0.22, 0.22, 0.44, 0.22], head6(Bn, L.mob_skull), l, f);
      // l'arc, tenu dans la main gauche (plaque verticale)
      const info = CM.itemInfo(CM.I.BOW), bow = info && L[info.tex];
      if (bow !== undefined) {
        const draw = m.ai.special ? 0.06 : 0;
        e.part(batch, e.M, -0.28, 1.46, 0, aim, [0, -0.98 + draw, -0.26, 0, -0.46 + draw, 0.26], [bow, bow, -1, -1, -1, -1], l, f, null, m.ai.chasing ? 0.25 : 0);
      }
    },
  };
  // Rampant : s'approche en silence, siffle… et explose.
  MOBS.rampant = {
    name: 'Rampant', aliases: ['rampant', 'creeper', 'explosif'], hw: 0.3, h: 1.7, hp: 16, speed: 2.3, hostile: true, xp: 5, sound: 'hiss',
    update(e, m, dt, c) {
      const { p, distP, dyp, g } = c;
      let tvx = 0, tvz = 0;
      m.ai.fuse = m.ai.fuse || 0;
      if (p.alive && distP < 18 && Math.abs(dyp) < 10) {
        m.ai.chasing = true;
        const dir = toward(p.x - m.x, p.z - m.z);
        if (distP < 3 && Math.abs(dyp) < 3 && sees(e, m, p, 1.2)) {
          if (m.ai.fuse === 0 && c.distL < 24) CM.Audio.play('hiss');
          m.ai.fuse += dt;
          m.yaw = dir;
        } else {
          m.ai.fuse = Math.max(0, m.ai.fuse - dt * 1.5);
          [tvx, tvz] = walk(e, m, dir, 2.4);
        }
      } else {
        m.ai.chasing = false;
        m.ai.fuse = Math.max(0, m.ai.fuse - dt * 1.5);
        [tvx, tvz] = wander(e, m, dt, 1.1, 0.4);
      }
      m.ai.special = m.ai.fuse > 0;
      if (m.ai.fuse >= 1.5) {
        m.dead = true;
        g.explode(m.x, m.y + 0.6, m.z, g.difficulty === 'hard' ? 3.2 : 2.6);
        return {};
      }
      return { tvx, tvz };
    },
    loot(e, m, meat, more) {
      drop(e, m, I().GUNPOWDER, Math.floor(e.rand() * 3) + more());
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), R = L.mob_rampant;
      // gonfle et clignote en blanc avant d'exploser
      if (m.ai.special) m.fuseVis = (m.fuseVis || 0) + 1 / 60;
      else m.fuseVis = 0;
      const k = Math.min(1, (m.fuseVis || 0) / 1.5);
      const flash = m.ai.special && Math.floor(t * (6 + k * 12)) % 2 ? 1 : f;
      CM.mat4.compose(e.M, m.x, m.y, m.z, m.yaw, 0, 0, (m.baby > 0 ? 0.55 : 1) * (1 + k * 0.18));
      e.part(batch, e.M, 0, 0, 0, 0, [-0.22, 0.4, -0.13, 0.22, 1.25, 0.13], R, l, flash);
      e.part(batch, e.M, 0, 1.25, 0, 0, [-0.23, 0, -0.23, 0.23, 0.46, 0.23], head6(R, L.mob_rampant_face), l, flash);
      for (const [x, z, ph] of [[-0.12, -0.2, 1], [0.12, -0.2, -1], [-0.12, 0.2, -1], [0.12, 0.2, 1]])
        e.part(batch, e.M, x, 0.4, z, sw * 0.7 * ph, [-0.1, -0.4, -0.1, 0.1, 0, 0.1], R, l, flash);
    },
  };
  // Gluant (et cube de magma) : saute vers sa proie ; se divise en plus petits quand il meurt.
  function blobUpdate(e, m, dt, c) {
    const { p, distP, dyp } = c, def = e.defOf(m);
    let tvx = 0, tvz = 0;
    m.ai.hopT = (m.ai.hopT || 0) - dt;
    const chase = p.alive && distP < 18 && Math.abs(dyp) < 10;
    m.ai.chasing = chase;
    if (m.onGround && m.ai.hopT <= 0) {
      m.ai.hopT = (chase ? 0.9 : 2.2) + e.rand() * 1.2;
      const dir = chase ? toward(p.x - m.x, p.z - m.z) : e.rand() * TAU;
      const sp = (chase ? 3.2 : 1.5) * (0.7 + def.size * 0.5);
      m.vy = def.jump || 7 + def.size * 2.5;
      m.vx = -Math.sin(dir) * sp;
      m.vz = -Math.cos(dir) * sp;
      m.knock = 0.5;
      m.yaw = dir;
      if (c.distL < 16) CM.Audio.play('squish', { pitch: 1.5 - def.size * 0.6 });
    }
    if (def.dmg) bite(e, m, p, def.dmg, def.cause, 0.5);
    return { tvx, tvz, keep: true };
  }
  function blobSplit(e, m) {
    const def = e.defOf(m);
    if (!def.child || m.baby > 0) return;
    const n = 2 + Math.floor(e.rand() * 3);
    for (let i = 0; i < n; i++) {
      const s = e.addMob(def.child, m.x + (e.rand() - 0.5) * def.size, m.y + 0.3, m.z + (e.rand() - 0.5) * def.size);
      if (s) {
        s.vy = 4;
        s.vx = (e.rand() - 0.5) * 4;
        s.vz = (e.rand() - 0.5) * 4;
      }
    }
  }
  function blobRender(face, body, glow) {
    return function (e, batch, m, l, f) {
      const def = e.defOf(m), s = def.size, L = Lr();
      const sq = m.onGround ? 1 : 1.12;
      const ff = glow ? 1 : f;
      CM.mat4.compose(e.M, m.x, m.y, m.z, m.yaw, 0, 0, 1);
      e.part(batch, e.M, 0, 0, 0, 0, [-s / 2 / sq, 0, -s / 2 / sq, s / 2 / sq, s * sq, s / 2 / sq], head6(L[body], L[face]), glow ? [1, 1] : l, f && glow ? 2 : ff);
    };
  }
  // (particules à la mort : la texture du corps)
  const FX = { chicken: 'mob_chicken', cow: 'mob_cow', rabbit: 'mob_rabbit', deer: 'mob_deer', goat: 'mob_goat', bat: 'mob_bat', wolf: 'mob_wolf', spider: 'mob_spider', skeleton: 'mob_bone', rampant: 'mob_rampant' };
  for (const k in FX) MOBS[k].fxTex = FX[k];
  const blob = (o) =>
    Object.assign({ hostile: true, update: blobUpdate, onDeath: blobSplit, sound: 'squish', noJump: true, fxTex: o.fireproof ? 'mob_magma' : 'mob_slime' }, o, { hw: o.size / 2, h: o.size });
  MOBS.slime = blob({
    name: 'Gluant', aliases: ['gluant', 'slime', 'gelee'], size: 1.0, hp: 16, speed: 1, dmg: 3, cause: 'Un gluant', child: 'slime_mid', xp: 4,
    loot: noLoot, render: blobRender('mob_slime_face', 'mob_slime'),
  });
  MOBS.slime_mid = blob({
    name: 'Gluant moyen', aliases: ['gluant_moyen'], size: 0.52, hp: 4, speed: 1, dmg: 2, cause: 'Un gluant', child: 'slime_small', xp: 2,
    loot: noLoot, render: blobRender('mob_slime_face', 'mob_slime'),
  });
  MOBS.slime_small = blob({
    name: 'Petit gluant', aliases: ['petit_gluant', 'gluant_petit'], size: 0.26, hp: 1, speed: 1, dmg: 0, xp: 1,
    loot(e, m, meat, more) {
      drop(e, m, I().SLIMEBALL, Math.floor(e.rand() * 3) + more());
    },
    render: blobRender('mob_slime_face', 'mob_slime'),
  });
  MOBS.magma = blob({
    name: 'Cube de magma', aliases: ['cube_de_magma', 'magma', 'magma_cube'], size: 0.85, hp: 16, speed: 1, dmg: 4, cause: 'Un cube de magma', child: 'magma_small', xp: 4,
    fireproof: true, jump: 10, loot: noLoot, render: blobRender('mob_magma_face', 'mob_magma', true),
  });
  MOBS.magma_small = blob({
    name: 'Petit cube de magma', aliases: ['petit_cube_de_magma', 'magma_petit'], size: 0.36, hp: 3, speed: 1, dmg: 2, cause: 'Un cube de magma', xp: 1,
    fireproof: true, jump: 8,
    loot(e, m, meat, more) {
      if (e.rand() < 0.5) drop(e, m, I().MAGMA_CREAM, 1 + more());
    },
    render: blobRender('mob_magma_face', 'mob_magma', true),
  });
})();
