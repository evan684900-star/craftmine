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
    defItem(1365, 'GUNPOWDER', { name: 'Poudre à canon', tex: 'gunpowder', desc: 'À l’établi : charbon + poudre d’os + silex = 2 poudres. Aussi sur les squelettes, les sorcières, et à la boutique du serveur. 5 poudres + 4 sables : une TNT.' });
    defItem(1366, 'MAGMA_CREAM', { name: 'Crème de magma', tex: 'magma_cream', desc: 'Laissée par les petits cubes de magma. 4 crèmes : un bloc de magma.' });
    defItem(1367, 'BONE', { name: 'Os', tex: 'bone', desc: 'Laissé par les squelettes. Clic droit sur un loup pour l’apprivoiser ; donne 3 poudres d’os.' });
    defItem(1368, 'SADDLE', { name: 'Selle', tex: 'saddle', stack: 1, desc: 'Clic droit sur un cheval dressé pour la lui mettre, puis clic droit pour le monter.' });
    defItem(1369, 'EGG', { name: 'Œuf', tex: 'egg', stack: 16, type: 'egg', desc: 'Pondu par les poules. Clic droit pour le lancer (parfois, un poussin en sort).' });
    defItem(1370, 'MILK_BUCKET', { name: 'Seau de lait', tex: 'milk_bucket', stack: 1, type: 'food', food: 1, sat: 0.5, always: true, milk: true, desc: 'Clic droit sur une vache avec un seau. À boire : enlève les effets (poison…).' });
  });
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.recipes.push(r(B.TNT, 1, [[I.GUNPOWDER, 5], ['sand', 4]], 'table', 'deco'));
    // poudre à canon : charbon (ou charbon de bois) + poudre d'os + silex (les rampants n'existent plus)
    CM.recipes.push(r(I.GUNPOWDER, 2, [[I.COAL, 1], [I.BONE_MEAL, 1], [I.FLINT, 1]], 'table', 'objets'));
    if (I.CHARCOAL) CM.recipes.push(r(I.GUNPOWDER, 2, [[I.CHARCOAL, 1], [I.BONE_MEAL, 1], [I.FLINT, 1]], 'table', 'objets'));
    if (B.MAGMA) CM.recipes.push(r(B.MAGMA, 1, [[I.MAGMA_CREAM, 4]], 'table', 'blocs'));
    CM.recipes.push(r(I.BONE_MEAL, 3, [[I.BONE, 1]], null, 'objets'));
    CM.recipes.push(r(I.SADDLE, 1, [[I.LEATHER, 5], [I.IRON_INGOT, 2]], 'table', 'objets'));
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
    make('bone', (d, r) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
      for (let k = 2; k < 14; k++) put(d, k, 15 - k, vary([232, 230, 218], r, 8));
      for (const [x, y] of [[2, 12], [3, 14], [1, 13], [13, 3], [12, 1], [14, 2]]) put(d, x, y, [236, 234, 222]);
    });
    make('saddle', (d, r) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
      for (let y = 4; y < 11; y++) for (let x = 2; x < 14; x++) if (!(y === 4 && (x < 4 || x > 11))) put(d, x, y, vary([120, 70, 36], r, 12));
      for (let x = 5; x < 11; x++) put(d, x, 4, [150, 92, 50]);
      for (let y = 11; y < 15; y++) { put(d, 4, y, [60, 40, 24]); put(d, 11, y, [60, 40, 24]); }
      put(d, 4, 14, [190, 190, 196]); put(d, 11, 14, [190, 190, 196]);
    });
    make('egg', (d, r) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
      for (let y = 3; y < 15; y++) for (let x = 3; x < 13; x++) if (Math.hypot((x - 7.5) / 4.6, (y - 9.2) / (y < 9 ? 6.2 : 5)) < 1) put(d, x, y, vary([232, 214, 180], r, 8));
      put(d, 6, 6, [248, 240, 222]);
    });
    make('milk_bucket', (d, r) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
      for (let y = 4; y < 15; y++) for (let x = 3 + Math.floor((y - 4) / 4); x < 13 - Math.floor((y - 4) / 4); x++) put(d, x, y, vary([176, 180, 188], r, 10));
      for (let x = 4; x < 12; x++) { put(d, x, 5, [248, 248, 244]); put(d, x, 6, [240, 240, 236]); }
      for (let x = 3; x < 13; x++) put(d, x, 4, [120, 124, 130]);
    });
    // cheval (4 robes)
    const ROBES = [[120, 76, 40], [160, 96, 50], [228, 222, 210], [46, 36, 30]];
    ROBES.forEach((c, i) => {
      make('mob_horse_' + i, (d, r) => {
        fill(d, r, c, 8);
        for (let k = 0; k < 14; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), vary(c.map((v) => v * 0.85), r, 6));
      });
      make('mob_horse_face_' + i, (d, r) => {
        fill(d, r, c, 6);
        eyes(d, 4, [16, 12, 10], [16, 12, 10], 2);
        for (let y = 11; y < 16; y++) for (let x = 4; x < 12; x++) put(d, x, y, vary(c.map((v) => v * 0.7), r, 4));
        put(d, 5, 13, [20, 16, 14]); put(d, 10, 13, [20, 16, 14]);
        if (i !== 2) for (let y = 2; y < 10; y++) put(d, 7, y, [236, 232, 224]);
      });
    });
    make('mob_mane', (d, r) => fill(d, r, [40, 30, 24], 10));
    make('mob_leather', (d, r) => {
      fill(d, r, [112, 64, 32], 10);
      for (let x = 0; x < 16; x++) { put(d, x, 0, [80, 46, 24]); put(d, x, 15, [80, 46, 24]); }
    });
    make('mob_collar', (d, r) => fill(d, r, [200, 30, 36], 8));
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
    if (w.nether || w.end || g.daylight <= 0.45 || w.skyAt(Math.floor(m.x), Math.floor(m.y + 1.5), Math.floor(m.z)) < 12) return;
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
    // bat des ailes et descend doucement ; pond un œuf toutes les 5 à 10 minutes
    tick(e, m, dt) {
      if (!m.onGround && m.vy < -3) m.vy = -3;
      if (m.baby > 0) return;
      if (m.eggT === undefined) m.eggT = 300 + e.rand() * 300;
      m.eggT -= dt;
      if (m.eggT <= 0) {
        m.eggT = 300 + e.rand() * 300;
        drop(e, m, I().EGG, 1);
        if (Math.hypot(e.game.player.x - m.x, e.game.player.z - m.z) < 16) CM.Audio.play('pop');
      }
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
    // seau vide : on la trait
    interact(e, m, x) {
      if (x.id !== CM.I.BUCKET || m.baby > 0) return false;
      if (x.local) {
        x.consume(1);
        x.give(CM.I.MILK_BUCKET, 1);
        CM.Audio.play('splash');
      }
      return true;
    },
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
      if (e.rand() < 0.12 + 0.05 * more()) drop(e, m, I().RABBIT_FOOT, 1);
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
  // Nom du joueur (solo et hôte : « » ou son pseudo ; invité : son pseudo).
  const pname = (g, q) => (q === g.player ? (g.net.active ? g.net.name : '') : q.name || '');
  CM.playerName = pname;
  const isOwner = (g, q, m) => m.owner !== undefined && (pname(g, q) === m.owner || (q === g.player && !g.net.isClient && (m.owner === '' || m.owner === g.net.name)));
  CM.isPetOwner = isOwner;
  // Le maître d'un animal apprivoisé (parmi les joueurs simulés ici).
  function ownerOf(e, m) {
    const g = e.game;
    for (const q of e.plist) if (q.alive !== false && isOwner(g, q, m)) return q;
    return null;
  }
  // Message à un joueur (d'ici ou invité).
  function tell(e, q, s) {
    const g = e.game;
    if (q === g.player) g.ui.toast(s, 'good', 'pet');
    else if (q && q.pid !== undefined) g.net.sendTo(q.pid, { t: 'cr', s, k: 'ok' });
  }
  CM.petTell = tell;
  // Animal apprivoisé : suit son maître (ou reste assis) et le défend.
  function petUpdate(e, m, dt, c, speed) {
    const own = ownerOf(e, m);
    m.ai.chasing = false;
    if (m.sit) return {};
    let tgt = m.ai.foe && !m.ai.foe.dead && m.ai.foe.type ? m.ai.foe : null;
    if (own) {
      for (const o of [own.lastAttacker, own.lastTarget]) {
        if (!o || !o.type || o.dead || o === m || (o.tame && o.owner === m.owner) || e.game.clock - (o === own.lastAttacker ? own.lastAttackT || 0 : own.lastTargetT || 0) > 12) continue;
        if (Math.hypot(o.x - own.x, o.z - own.z) < 16) tgt = o;
      }
      if (!tgt)
        for (const o of e.mobs)
          if (!o.dead && CM.MOBS[o.type].hostile && Math.hypot(o.x - own.x, o.z - own.z) < 8 && Math.abs(o.y - own.y) < 4) {
            tgt = o;
            break;
          }
    }
    m.ai.foe = tgt;
    if (tgt) {
      m.ai.chasing = true;
      const d = Math.hypot(tgt.x - m.x, tgt.z - m.z);
      const [tvx, tvz] = walk(e, m, toward(tgt.x - m.x, tgt.z - m.z), 4.8, false);
      if (d < m.hw + tgt.hw + 0.9 && Math.abs(tgt.y - m.y) < 2 && m.ai.attackCd <= 0) {
        m.ai.attackCd = 1;
        e.hurtMob(tgt, 4, [m.x, m.z]);
        if (c.distL < 20) CM.Audio.play('growl', { pitch: 1.2 });
      }
      return { tvx, tvz };
    }
    if (!own) return { tvx: 0, tvz: 0 };
    const d = Math.hypot(own.x - m.x, own.z - m.z);
    // trop loin : il rejoint son maître d'un coup (comme dans Minecraft)
    if ((d > 24 || Math.abs(own.y - m.y) > 12) && own.onGround !== false) {
      const w = e.game.world, a = e.rand() * TAU, x = own.x + Math.cos(a) * 1.5, z = own.z + Math.sin(a) * 1.5;
      if (w.loaded(x, z) && !solid(w, x, own.y + 0.1, z) && !solid(w, x, own.y + 1, z)) {
        m.x = x;
        m.y = own.y;
        m.z = z;
        m.vx = m.vy = m.vz = 0;
      }
      return {};
    }
    if (d > 3.5) {
      const [tvx, tvz] = walk(e, m, toward(own.x - m.x, own.z - m.z), d > 8 ? 4.6 : speed || 2.4, false);
      return { tvx, tvz };
    }
    return { face: toward(own.x - m.x, own.z - m.z) };
  }

  // Loup : paisible tant qu'on ne le frappe pas ; alors toute la meute attaque. Un os l'apprivoise :
  // il suit son maître, le défend, s'assoit (clic droit) ; la viande le soigne.
  MOBS.wolf = {
    name: 'Loup', aliases: ['loup', 'wolf', 'louve', 'chien'], hw: 0.3, h: 0.85, hp: 12, speed: 1.4, passive: true, neutral: true,
    sound: 'growl', group: [2, 4], xp: 3, tameFirst: true, healFood: true, breed: ['RAW_MEAT', 'COOKED_MEAT'],
    onHurt(e, m, by) {
      if (m.tame) {
        m.sit = false;
        return;
      }
      const foe = by && by.alive !== undefined ? by : e.nearestPlayer(m.x, m.y, m.z);
      for (const o of e.mobs) {
        if (o.type !== 'wolf' || o.dead || o.tame || Math.hypot(o.x - m.x, o.z - m.z) > 16) continue;
        o.ai.angry = 25;
        o.ai.foe = foe;
      }
    },
    interact(e, m, x) {
      const I = CM.I;
      if (!m.tame) {
        if (x.id !== I.BONE || m.ai.angry > 0) return false;
        if (x.local) x.consume(1);
        if (x.host) {
          if (e.rand() < 1 / 3) {
            m.tame = true;
            m.owner = x.name;
            m.sit = false;
            m.ai.angry = 0;
            m.ai.foe = null;
            m.hp = m.maxHp = 20;
            e.hearts(m, 7);
            tell(e, x.q, '🐺 Le loup est apprivoisé ! Il te suit et te défend (clic droit : assis / debout).');
          } else e.burst(CM.Textures.layer.smoke, m.x, m.y + 0.8, m.z, 6, { speed: 0.8, grav: -1, life: 0.8, size: 0.15 });
        }
        return true;
      }
      if (x.id === I.RAW_MEAT || x.id === I.COOKED_MEAT) return false; // (nourrir : soin ou petit)
      if (!isOwner(e.game, x.q, m)) return false;
      if (x.host) {
        m.sit = !m.sit;
        m.ai.foe = null;
        tell(e, x.q, m.sit ? '🐺 Assis !' : '🐺 Au pied !');
      }
      return true;
    },
    update(e, m, dt, c) {
      if (m.tame) return petUpdate(e, m, dt, c, 2.6);
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
      const L = Lr(), W = L.mob_wolf, face = m.ai.chasing && !m.tame ? L.mob_wolf_angry : L.mob_wolf_face;
      const sit = !!m.sit, bodyTilt = sit ? -0.55 : 0;
      e.part(batch, e.M, 0, sit ? 0.2 : 0.42, 0.3, bodyTilt, [-0.18, 0, -0.72, 0.18, 0.34, 0.04], W, l, f);
      e.part(batch, e.M, 0, 0.44, -0.42, 0, [-0.23, 0.02, -0.02, 0.23, 0.4, 0.14], W, l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [-0.16, -0.12, -0.26, 0.16, 0.18, 0.02], head6(W, face), l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [-0.07, -0.12, -0.4, 0.07, 0.0, -0.26], W, l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [-0.14, 0.18, -0.12, -0.06, 0.3, -0.06], W, l, f);
      e.part(batch, e.M, 0, 0.66, -0.46, 0, [0.06, 0.18, -0.12, 0.14, 0.3, -0.06], W, l, f);
      if (m.tame) e.part(batch, e.M, 0, 0.44, -0.42, 0, [-0.24, 0.1, -0.03, 0.24, 0.2, 0.15], L.mob_collar, l, f);
      e.part(batch, e.M, 0, sit ? 0.2 : 0.66, 0.34, m.ai.chasing ? -0.2 : 0.7, [-0.05, -0.05, 0, 0.05, 0.05, 0.36], W, l, f);
      for (const [x, z, ph] of [[-0.1, -0.3, 1], [0.1, -0.3, -1]]) e.part(batch, e.M, x, 0.44, z, sit ? 0 : sw * 0.8 * ph, [-0.05, -0.44, -0.05, 0.05, 0, 0.05], W, l, f);
      for (const [x, z, ph] of [[-0.1, 0.26, -1], [0.1, 0.26, 1]])
        if (sit) e.part(batch, e.M, x, 0.12, z - 0.1, -1.4, [-0.05, -0.3, -0.05, 0.05, 0, 0.05], W, l, f);
        else e.part(batch, e.M, x, 0.44, z, sw * 0.8 * ph, [-0.05, -0.44, -0.05, 0.05, 0, 0.05], W, l, f);
    },
  };

  // Cheval : on le dresse en le montant (il rue, puis accepte) ; les pommes, le blé et les carottes
  // dorées l'adoucissent. Dressé et sellé, on le monte et on le dirige (très rapide, saute haut).
  const HORSE_FOOD = { WHEAT: 3, APPLE: 5, CARROT: 4, GOLDEN_CARROT: 12, GOLDEN_APPLE: 20 };
  MOBS.horse = {
    name: 'Cheval', aliases: ['cheval', 'horse', 'jument', 'poney'], hw: 0.6, h: 1.6, hp: 20, speed: 1.3, passive: true,
    sound: 'neigh', breed: ['GOLDEN_CARROT', 'GOLDEN_APPLE'], group: [2, 4], xp: 2, tameFirst: true, mount: true,
    init(m, e) {
      m.variant = Math.floor(e.rand() * 4);
    },
    interact(e, m, x) {
      const I = CM.I;
      const food = Object.keys(HORSE_FOOD).find((k) => I[k] === x.id);
      if (food && !(m.tame && (food === 'GOLDEN_CARROT' || food === 'GOLDEN_APPLE') && m.hp >= m.maxHp && m.baby <= 0 && !(m.love > 0))) {
        if (x.local) x.consume(1);
        if (x.host) {
          m.temper = Math.min(100, (m.temper || 0) + HORSE_FOOD[food]);
          m.hp = Math.min(m.maxHp, m.hp + 2);
          e.hearts(m, 2);
        }
        if (x.local) CM.Audio.play('eat');
        return true;
      }
      if (food) return false; // (carotte dorée à un cheval dressé : élevage)
      if (x.id === I.SADDLE && m.tame && !m.saddle) {
        if (x.local) x.consume(1);
        if (x.host) m.saddle = true;
        if (x.local) CM.Audio.play('equip', { mat: 'leather' });
        return true;
      }
      if (m.baby > 0) return false;
      if (m.tame && !m.saddle) {
        if (x.local) CM.Audio.play('neigh');
        if (x.local && x.q === e.game.player) e.game.ui.toast('Il lui faut une selle pour que tu le montes (5 cuirs + 2 fers à l’établi)', 'info', 'saddle');
        return true;
      }
      return 'mount';
    },
    // monté pour le dresser : il rue ; plus il est habitué (nourriture, essais), plus il accepte
    buck(e, m, q) {
      m.temper = Math.min(100, (m.temper || 0) + 6);
      if (e.rand() * 100 < m.temper + 10) {
        m.tame = true;
        m.owner = pname(e.game, q);
        e.hearts(m, 7);
        tell(e, q, '🐴 Le cheval est dressé ! Mets-lui une selle pour le diriger.');
        return true;
      }
      e.burst(CM.Textures.layer.smoke, m.x, m.y + 1.2, m.z, 8, { speed: 1, grav: -1, life: 0.8, size: 0.15 });
      m.vy = 5;
      return false;
    },
    loot(e, m, meat, more) {
      drop(e, m, I().LEATHER, Math.floor(e.rand() * 3) + more());
      if (m.saddle) drop(e, m, I().SADDLE, 1);
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), v = m.variant || 0, H = L['mob_horse_' + v], face = L['mob_horse_face_' + v], mane = L.mob_mane;
      const gal = m.moving ? Math.min(1.2, 0.6 + (m.speedVis || 0) * 0.08) : 0;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.34, 0.86, -0.72, 0.34, 1.46, 0.72], H, l, f);
      const hb = m.moving ? Math.sin(m.walk * 2) * 0.05 : Math.sin(t * 1.3 + m.age) * 0.04;
      // encolure, tête, crinière
      e.part(batch, e.M, 0, 1.3, -0.6, -0.5 + hb, [-0.13, 0, -0.2, 0.13, 0.62, 0.1], H, l, f);
      e.part(batch, e.M, 0, 1.3, -0.6, -0.5 + hb, [-0.04, 0.05, 0.08, 0.04, 0.74, 0.18], mane, l, f);
      e.part(batch, e.M, 0, 1.3, -0.6, 0.35 + hb, [-0.15, 0.42, -0.62, 0.15, 0.72, -0.08], head6(H, face), l, f);
      e.part(batch, e.M, 0, 1.3, -0.6, 0.35 + hb, [-0.12, 0.72, -0.2, -0.05, 0.84, -0.12], H, l, f);
      e.part(batch, e.M, 0, 1.3, -0.6, 0.35 + hb, [0.05, 0.72, -0.2, 0.12, 0.84, -0.12], H, l, f);
      // queue
      e.part(batch, e.M, 0, 1.36, 0.72, 0.5 + (m.moving ? Math.sin(m.walk * 2) * 0.2 : 0), [-0.06, -0.62, 0, 0.06, 0, 0.1], mane, l, f);
      // selle
      if (m.saddle) {
        e.part(batch, e.M, 0, 0, 0, 0, [-0.36, 1.4, -0.28, 0.36, 1.52, 0.3], L.mob_leather, l, f);
        e.part(batch, e.M, 0, 0, 0, 0, [-0.37, 1.0, -0.06, 0.37, 1.4, 0.04], L.mob_leather, l, f);
      }
      for (const [x, z, ph] of [[-0.2, -0.56, 1], [0.2, -0.56, -1], [-0.2, 0.56, -1], [0.2, 0.56, 1]])
        e.part(batch, e.M, x, 0.88, z, sw * (0.6 + gal) * ph, [-0.09, -0.88, -0.09, 0.09, 0, 0.09], H, l, f);
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
      const day = !w.nether && !w.end && g.daylight > 0.45 && w.skyAt(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z)) >= 12;
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
      if (e.rand() < 0.5) drop(e, m, I().SPIDER_EYE, 1);
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
      drop(e, m, I().BONE, Math.floor(e.rand() * 3) + more());
      if (e.rand() < 0.3) drop(e, m, I().GUNPOWDER, 1); // (les rampants n'existent plus : la poudre vient d'ici)
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
      // tué par la flèche d'un squelette : il laisse un disque (comme dans Minecraft)
      if (m.shotBy === 'skeleton' && CM.DISC_IDS) drop(e, m, CM.DISC_IDS[Math.floor(e.rand() * CM.DISC_IDS.length)], 1);
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
  const FX = { horse: 'mob_horse_0', chicken: 'mob_chicken', cow: 'mob_cow', rabbit: 'mob_rabbit', deer: 'mob_deer', goat: 'mob_goat', bat: 'mob_bat', wolf: 'mob_wolf', spider: 'mob_spider', skeleton: 'mob_bone', rampant: 'mob_rampant' };
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
