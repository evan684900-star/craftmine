'use strict';
// Monde « Ville » : échelle (utile partout), asphalte et marquages, trottoir, plaque d'égout,
// lampadaire, feu tricolore, borne incendie, poubelle, banc, pompe à essence ; les citadins.
// La génération (rues, immeubles, gratte-ciel, maisons, parcs…) est dans city.js.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});

  M.blocks.push(function (K) {
    const { nb } = K;
    // Échelle : contre un mur (une variante par mur), on y grimpe.
    const LAD = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const base = nb('LADDER', { name: 'Échelle', render: 'model', opaque: false, solid: false, hardness: 0.4, tool: 'axe', sound: 'wood', climb: true, model: [{ b: [0, 0, 0, 16, 16, 1], t: 'ladder' }], tex: 'ladder', iconTex: 'ladder', box: [0, 0, 0, 16, 16, 2], hidden: false });
    // wall : direction du mur vers l'échelle (l'échelle est collée au mur, du côté opposé)
    base.ladderSet = LAD.map((wall, i) => {
      const [dx, dz] = wall;
      // le mur est en (-dx, -dz) : la plaque touche ce côté de la case
      const bx = dx === 1 ? [0, 0, 0, 1, 16, 16] : dx === -1 ? [15, 0, 0, 16, 16, 16] : dz === 1 ? [0, 0, 0, 16, 16, 1] : [0, 0, 15, 16, 16, 16];
      const sel = dx === 1 ? [0, 0, 0, 2, 16, 16] : dx === -1 ? [14, 0, 0, 16, 16, 16] : dz === 1 ? [0, 0, 0, 16, 16, 2] : [0, 0, 14, 16, 16, 16];
      return nb('LADDER_' + i, { name: 'Échelle', render: 'model', opaque: false, solid: false, hardness: 0.4, tool: 'axe', sound: 'wood', climb: true, drop: base.id, hidden: true, wall, model: [{ b: bx, t: 'ladder' }], tex: 'ladder', box: sel }).id;
    });
    const road = (key, name, tex) => nb(key, { name, tex, hardness: 1.5, tool: 'pickaxe', tier: 1, sound: 'stone', city: true });
    road('ASPHALT', 'Asphalte', 'asphalt');
    road('ASPHALT_LINE', 'Asphalte (marquage blanc)', 'asphalt_line');
    road('ASPHALT_YELLOW', 'Asphalte (ligne jaune)', 'asphalt_yellow');
    road('SIDEWALK', 'Trottoir', 'sidewalk');
    road('MANHOLE', 'Plaque d’égout', 'manhole');
    nb('LAMP_POST', { name: 'Poteau', render: 'model', opaque: false, hardness: 2, tool: 'pickaxe', sound: 'metal', model: [{ b: [6, 0, 6, 10, 16, 10], t: 'post' }], tex: 'post', iconTex: 'post', box: [6, 0, 6, 10, 16, 10] });
    nb('LAMP_HEAD', { name: 'Tête de lampadaire', render: 'model', opaque: false, hardness: 1, tool: 'pickaxe', sound: 'glass', light: 15, model: [{ b: [6, 0, 6, 10, 4, 10], t: 'post' }, { b: [2, 4, 2, 14, 7, 14], t: 'lamp_glow' }, { b: [1, 7, 1, 15, 9, 15], t: 'post' }], tex: 'lamp_glow', iconTex: 'lamp_glow', box: [1, 0, 1, 15, 9, 15] });
    nb('TRAFFIC_LIGHT', { name: 'Feu tricolore', render: 'model', opaque: false, hardness: 2, tool: 'pickaxe', sound: 'metal', light: 6, model: [{ b: [5, 0, 5, 11, 16, 11], t: 'traffic_side' }, { b: [4, 1, 4, 12, 15, 12], t: ['traffic_side', 'traffic_side', 'post', 'post', 'traffic_face', 'traffic_face'] }], tex: 'traffic_face', iconTex: 'traffic_face', box: [4, 0, 4, 12, 16, 12] });
    nb('FIRE_HYDRANT', { name: 'Borne incendie', render: 'model', opaque: false, hardness: 2, tool: 'pickaxe', sound: 'metal', model: [{ b: [5, 0, 5, 11, 10, 11], t: 'hydrant' }, { b: [3, 5, 6, 13, 8, 10], t: 'hydrant' }, { b: [6, 10, 6, 10, 12, 10], t: 'hydrant' }], tex: 'hydrant', iconTex: 'hydrant', box: [3, 0, 5, 13, 12, 11] });
    nb('TRASH_BIN', { name: 'Poubelle', render: 'model', opaque: false, hardness: 1.5, tool: 'pickaxe', sound: 'metal', container: true, slots: 9, model: [{ b: [3, 0, 3, 13, 12, 13], t: 'bin_side' }, { b: [2, 12, 2, 14, 14, 14], t: 'bin_lid' }], tex: { top: 'bin_lid', bottom: 'bin_side', side: 'bin_side' }, iconTex: 'bin_side', box: [2, 0, 2, 14, 14, 14] });
    nb('BENCH', { name: 'Banc', render: 'model', opaque: false, hardness: 1.5, tool: 'axe', sound: 'wood', model: [{ b: [0, 6, 2, 16, 8, 14], t: 'bench_wood' }, { b: [1, 0, 3, 3, 6, 13], t: 'post' }, { b: [13, 0, 3, 15, 6, 13], t: 'post' }, { b: [0, 8, 12, 16, 15, 14], t: 'bench_wood' }], tex: 'bench_wood', iconTex: 'bench_wood', box: [0, 0, 2, 16, 8, 14] });
    nb('FUEL_PUMP', { name: 'Pompe à essence', render: 'model', opaque: false, hardness: 2.5, tool: 'pickaxe', sound: 'metal', fuelPump: true, light: 4, model: [{ b: [3, 0, 4, 13, 16, 12], t: ['pump_side', 'pump_side', 'pump_top', 'pump_side', 'pump_face', 'pump_face'] }, { b: [13, 6, 7, 15, 12, 9], t: 'post' }], tex: 'pump_face', iconTex: 'pump_face', box: [3, 0, 4, 15, 16, 12] });
  });

  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.recipes.push(
      r(B.LADDER, 3, [[I.STICK, 7]], 'table', 'deco'),
      r(B.ASPHALT, 8, [[B.GRAVEL, 8], [I.COAL, 1]], 'forge', 'blocs'),
      r(B.ASPHALT_LINE, 4, [[B.ASPHALT, 4], [CM.DYE_ITEM.WHITE, 1]], 'table', 'blocs'),
      r(B.ASPHALT_YELLOW, 4, [[B.ASPHALT, 4], [CM.DYE_ITEM.YELLOW, 1]], 'table', 'blocs'),
      r(B.SIDEWALK, 4, [[B.SMOOTH_STONE, 4]], 'table', 'blocs'),
      r(B.MANHOLE, 1, [[I.IRON_INGOT, 2], [B.ASPHALT, 1]], 'table', 'blocs'),
      r(B.LAMP_POST, 4, [[I.IRON_INGOT, 2]], 'table', 'deco'),
      r(B.LAMP_HEAD, 1, [[I.IRON_INGOT, 1], [I.GLOWSTONE_DUST, 2], [B.GLASS, 1]], 'table', 'deco'),
      r(B.TRAFFIC_LIGHT, 1, [[I.IRON_INGOT, 2], [I.REDSTONE, 1], [CM.DYE_ITEM.LIME, 1], [CM.DYE_ITEM.YELLOW, 1]], 'table', 'deco'),
      r(B.FIRE_HYDRANT, 1, [[I.IRON_INGOT, 3], [CM.DYE_ITEM.RED, 1]], 'table', 'deco'),
      r(B.TRASH_BIN, 1, [[I.IRON_INGOT, 4]], 'table', 'deco'),
      r(B.BENCH, 1, [['planks', 3], [I.IRON_INGOT, 1]], 'table', 'deco'),
      r(B.FUEL_PUMP, 1, [[I.IRON_INGOT, 5], [I.REDSTONE, 2], [B.GLASS, 1]], 'table', 'deco'),
    );
  });

  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    const rect = (d, r, x0, y0, x1, y1, c, v) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(d, x, y, vary(c, r, v || 0));
    };
    const AS = [52, 54, 58];
    make('asphalt', (d, r) => {
      fill(d, r, AS, 7);
      for (let k = 0; k < 18; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? [70, 72, 76] : [40, 41, 44]);
    });
    make('asphalt_line', (d, r) => {
      fill(d, r, AS, 7);
      rect(d, r, 5, 0, 11, 16, [226, 228, 230], 6);
    });
    make('asphalt_yellow', (d, r) => {
      fill(d, r, AS, 7);
      rect(d, r, 6, 0, 10, 16, [236, 190, 40], 8);
    });
    make('sidewalk', (d, r) => {
      fill(d, r, [168, 168, 164], 8);
      for (let x = 0; x < 16; x++) put(d, x, 0, [128, 128, 124]), put(d, x, 8, [128, 128, 124]);
      for (let y = 0; y < 8; y++) put(d, 0, y, [128, 128, 124]);
      for (let y = 8; y < 16; y++) put(d, 8, y, [128, 128, 124]);
    });
    make('manhole', (d, r) => {
      fill(d, r, AS, 7);
      for (let y = 1; y < 15; y++)
        for (let x = 1; x < 15; x++) {
          const q = Math.hypot(x - 7.5, y - 7.5);
          if (q < 6.8) put(d, x, y, q > 5.8 ? [50, 50, 54] : (x + y) % 3 === 0 ? [96, 98, 104] : [72, 74, 80]);
        }
    });
    make('post', (d, r) => {
      fill(d, r, [46, 50, 54], 5);
      for (let y = 0; y < 16; y++) put(d, 1, y, [80, 86, 92]);
    });
    make('lamp_glow', (d, r) => fill(d, r, [255, 238, 180], 6));
    make('traffic_side', (d, r) => fill(d, r, [34, 36, 38], 4));
    make('traffic_face', (d, r) => {
      fill(d, r, [30, 32, 34], 4);
      const lamp = (cy, c) => {
        for (let y = cy - 2; y <= cy + 1; y++) for (let x = 6; x <= 9; x++) put(d, x, y, c);
      };
      lamp(3, [255, 50, 40]);
      lamp(8, [110, 90, 30]);
      lamp(13, [40, 90, 50]);
    });
    make('hydrant', (d, r) => {
      fill(d, r, [200, 34, 30], 10);
      for (let x = 0; x < 16; x++) put(d, x, 2, [236, 80, 70]);
    });
    make('bin_side', (d, r) => {
      fill(d, r, [58, 96, 64], 8);
      for (let x = 1; x < 16; x += 3) for (let y = 2; y < 14; y++) put(d, x, y, [42, 72, 48]);
    });
    make('bin_lid', (d, r) => fill(d, r, [46, 78, 52], 6));
    make('bench_wood', (d, r) => {
      fill(d, r, [150, 104, 60], 10);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [110, 74, 40]);
    });
    make('pump_side', (d, r) => {
      fill(d, r, [210, 40, 36], 8);
      rect(d, r, 2, 2, 14, 6, [240, 240, 240], 4);
    });
    make('pump_top', (d, r) => fill(d, r, [230, 230, 232], 5));
    make('pump_face', (d, r) => {
      fill(d, r, [210, 40, 36], 8);
      rect(d, r, 3, 2, 13, 7, [30, 40, 40], 4);
      rect(d, r, 4, 3, 12, 6, [90, 230, 120], 6);
      rect(d, r, 5, 9, 11, 14, [236, 236, 236], 4);
    });
    make('ladder', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++) {
        put(d, 2, y, vary([120, 84, 46], r, 8));
        put(d, 3, y, vary([100, 70, 38], r, 8));
        put(d, 12, y, vary([120, 84, 46], r, 8));
        put(d, 13, y, vary([100, 70, 38], r, 8));
      }
      for (const y of [2, 6, 10, 14]) for (let x = 4; x < 12; x++) put(d, x, y, vary([140, 100, 58], r, 8));
    });
    // citadins : chemises (teintes des véhicules), visages
    for (const [k, hair] of [['a', [60, 40, 24]], ['b', [220, 190, 110]], ['c', [30, 28, 30]], ['d', [150, 60, 30]]]) {
      make('mob_citizen_face_' + k, (d, r) => {
        fill(d, r, [210, 164, 130], 5);
        for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) put(d, x, y, hair);
        put(d, 4, 8, [40, 30, 30]), put(d, 11, 8, [40, 30, 30]);
        for (let x = 6; x < 10; x++) put(d, x, 12, [150, 90, 80]);
      });
      make('mob_citizen_hair_' + k, (d, r) => fill(d, r, hair, 6));
    }
  });

  // ------------------------------------------------------------ citadin --
  // Habitant de la ville : se promène sur les trottoirs, fuit si on l'attaque.
  const SHIRTS = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'WHITE', 'ORANGE', 'PURPLE', 'CYAN', 'GRAY', 'PINK'];
  MOBS.citizen = {
    name: 'Citadin', aliases: ['citadin', 'habitant', 'passant'], hw: 0.3, h: 1.85, hp: 16, speed: 1.6, passive: true, xp: 0, sound: 'hmm',
    update(e, m, dt) {
      if (m.variant === undefined) m.variant = Math.floor(e.rand() * 1000);
      if (m.ai.flee > 0) {
        m.ai.flee -= dt;
        const a = m.ai.fleeDir === undefined ? (m.ai.fleeDir = e.rand() * Math.PI * 2) : m.ai.fleeDir;
        return { tvx: -Math.sin(a) * 4.2, tvz: -Math.cos(a) * 4.2, face: a, jump: (m.hitX || m.hitZ) && m.onGround };
      }
      m.ai.fleeDir = undefined;
      m.ai.timer = (m.ai.timer || 0) - dt;
      if (m.ai.timer <= 0 || m.hitX || m.hitZ) {
        m.ai.timer = 3 + e.rand() * 5;
        // marche le long de la rue (axes x ou z), parfois s'arrête
        m.ai.dir = e.rand() < 0.25 ? null : Math.floor(e.rand() * 4) * (Math.PI / 2);
      }
      if (m.ai.dir === null || m.ai.dir === undefined) return {};
      return { tvx: -Math.sin(m.ai.dir) * 1.5, tvz: -Math.cos(m.ai.dir) * 1.5, face: m.ai.dir, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    loot(e, m) {
      const I = CM.I, k = e.rand();
      if (k < 0.25) e.addDrop(I.BREAD, 1, m.x, m.y + 0.5, m.z);
      else if (k < 0.4) e.addDrop(I.APPLE, 1, m.x, m.y + 0.5, m.z);
      else if (k < 0.5) e.addDrop(I.EMERALD, 1, m.x, m.y + 0.5, m.z);
      else if (k < 0.6) e.addDrop(I.PAPER, 1 + Math.floor(e.rand() * 3), m.x, m.y + 0.5, m.z);
    },
    render(e, batch, m, l, f, sw) {
      const L = CM.Textures.layer, v = m.variant || 0, hk = 'abcd'[v % 4];
      const shirt = L['veh_paint_' + SHIRTS[Math.floor(v / 4) % SHIRTS.length].toLowerCase()] || L.mob_bandit_cloth;
      const pants = [L.mob_bandit_pants, L.veh_dark, L.bench_wood][Math.floor(v / 40) % 3] || L.mob_bandit_pants;
      const skin = L.mob_bandit_skin, hair = L['mob_citizen_hair_' + hk], face = L['mob_citizen_face_' + hk];
      e.part(batch, e.M, -0.12, 0.72, 0, sw * 0.7, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], pants, l, f);
      e.part(batch, e.M, 0.12, 0.72, 0, -sw * 0.7, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], pants, l, f);
      e.part(batch, e.M, 0, 0.72, 0, 0, [-0.25, 0, -0.13, 0.25, 0.68, 0.13], shirt, l, f);
      e.part(batch, e.M, -0.36, 1.36, 0, -sw * 0.6, [-0.1, -0.64, -0.1, 0.1, 0.04, 0.1], shirt, l, f);
      e.part(batch, e.M, 0.36, 1.36, 0, sw * 0.6, [-0.1, -0.64, -0.1, 0.1, 0.04, 0.1], shirt, l, f);
      e.part(batch, e.M, -0.36, 1.36, 0, -sw * 0.6, [-0.09, -0.72, -0.09, 0.09, -0.62, 0.09], skin, l, f);
      e.part(batch, e.M, 0.36, 1.36, 0, sw * 0.6, [-0.09, -0.72, -0.09, 0.09, -0.62, 0.09], skin, l, f);
      e.part(batch, e.M, 0, 1.4, 0, 0, [-0.22, 0, -0.22, 0.22, 0.44, 0.22], [skin, skin, hair, skin, skin, face], l, f);
    },
  };
})();
