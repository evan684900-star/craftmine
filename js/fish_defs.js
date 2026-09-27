'use strict';
// Pêche, bateaux, créatures aquatiques et cuisine.
// - Objets : canne à pêche, poissons (morue, saumon, poisson tropical ; crus ou cuits), bateau,
//   biscuits, tarte aux pommes, ragoût, soupes.
// - Blocs : gâteau (4 parts, se mange posé), four à pain (station de cuisine).
// - Créatures : morue, saumon, poisson tropical (8 couleurs), poisson-globe, calmar, dauphin.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});
  const TAU = Math.PI * 2;

  // Effet (sans potion) donné par les dauphins : on nage bien plus vite.
  if (CM.EFFECTS) CM.EFFECTS.dolphins_grace = { key: 'dolphins_grace', name: 'Grâce du dauphin', de: 'de grâce du dauphin', color: [120, 170, 220], icon: '🐬' };

  // ------------------------------------------------------- objets --
  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1480, 'FISHING_ROD', { name: 'Canne à pêche', tex: 'fishing_rod', stack: 1, type: 'rod', desc: 'Clic droit : lancer le flotteur dans l’eau. Quand il plonge (bulles, plouf !), clic droit vite pour ferrer. Sur une créature : on la tire vers soi.' });
    defItem(1481, 'RAW_COD', { name: 'Morue crue', tex: 'raw_cod', type: 'food', food: 2, sat: 0.4, desc: 'Se pêche. À cuire à la forge (ou en sushi avec du varech séché).' });
    defItem(1482, 'COOKED_COD', { name: 'Morue cuite', tex: 'cooked_cod', type: 'food', food: 5, sat: 6 });
    defItem(1483, 'RAW_SALMON', { name: 'Saumon cru', tex: 'raw_salmon', type: 'food', food: 2, sat: 0.4, desc: 'Se pêche. À cuire à la forge.' });
    defItem(1484, 'COOKED_SALMON', { name: 'Saumon cuit', tex: 'cooked_salmon', type: 'food', food: 6, sat: 9.6 });
    defItem(1485, 'TROPICAL_FISH', { name: 'Poisson tropical', tex: 'tropical_fish', type: 'food', food: 1, sat: 0.2, desc: 'Des océans chauds. Les dauphins en raffolent.' });
    defItem(1486, 'BOAT', { name: 'Bateau', tex: 'boat_item', stack: 1, type: 'boat', desc: 'Clic droit sur l’eau pour le poser, clic droit dessus pour monter. Il va là où tu te diriges (vite sur la glace) ; accroupis-toi pour descendre, frappe-le pour le reprendre.' });
    defItem(1487, 'COOKIE', { name: 'Biscuit', tex: 'cookie', type: 'food', food: 2, sat: 0.4 });
    defItem(1488, 'APPLE_PIE', { name: 'Tarte aux pommes', tex: 'apple_pie', type: 'food', food: 8, sat: 6, stack: 16 });
    defItem(1489, 'MEAT_STEW', { name: 'Ragoût', tex: 'meat_stew', type: 'food', food: 10, sat: 12, stack: 16, desc: 'Viande, pomme de terre, carotte et champignon : très nourrissant.' });
    defItem(1490, 'FISH_SOUP', { name: 'Soupe de poisson', tex: 'fish_soup', type: 'food', food: 10, sat: 12, stack: 16 });
    defItem(1491, 'VEGETABLE_SOUP', { name: 'Soupe de légumes', tex: 'veg_soup', type: 'food', food: 8, sat: 9.6, stack: 16 });
    defItem(1492, 'SUSHI', { name: 'Sushi', tex: 'sushi', type: 'food', food: 4, sat: 5, desc: 'Poisson cru et varech : pas besoin de le cuire.' });
  });

  // -------------------------------------------------------- blocs --
  // Gâteau : 4 états (entier, puis 3, 2, 1 part) ; clic droit : on en mange une part.
  const CAKE_X = [1, 5, 8, 12];
  M.blocks.push(function (K) {
    const { nb } = K;
    CAKE_X.forEach((x0, k) => {
      nb(k ? 'CAKE_' + k : 'CAKE', {
        name: 'Gâteau', render: 'model', opaque: false, solid: true, hardness: 0.5, sound: 'wool', drop: 0, hidden: k > 0,
        tex: 'cake_side', iconTex: 'cake_item', box: [x0, 0, 1, 15, 8, 15],
        model: [{ b: [x0, 0, 1, 15, 8, 15], t: ['cake_side', k ? 'cake_inner' : 'cake_side', 'cake_top', 'cake_bottom', 'cake_side', 'cake_side'] }],
        use: (g, t) => CM.Cooking.eatCake(g, t),
      });
    });
    nb('OVEN', {
      name: 'Four à pain', tex: { top: 'oven_top', bottom: 'oven_top', side: 'oven_side', front: 'oven_front' }, hardness: 3, tool: 'pickaxe', tier: 1, sound: 'stone', light: 9, station: 'oven',
    });
  });

  // ----------------------------------------------------- recettes --
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.STATION_NAMES.oven = 'Four à pain';
    CM.STATION_NEAR.oven = 'un four à pain';
    const smelt = (out, n, ing, k) => CM.recipes.push(r(out, n, [[ing, k], [I.COAL, 1]], 'forge', 'nourriture'));
    smelt(I.COOKED_COD, 2, I.RAW_COD, 2);
    smelt(I.COOKED_SALMON, 2, I.RAW_SALMON, 2);
    const cake = r(B.CAKE, 1, [[I.MILK_BUCKET, 3], [I.SUGAR, 2], [I.EGG, 1], [I.WHEAT, 3]], 'oven', 'nourriture');
    cake.ret = [[I.BUCKET, 3]]; // on récupère les seaux
    CM.recipes.push(
      r(I.FISHING_ROD, 1, [[I.STICK, 3], [I.ROPE, 2]], null, 'outils'),
      r(I.BOAT, 1, [['planks', 5]], 'table', 'objets'),
      r(B.OVEN, 1, [[B.BRICKS, 6], [B.FURNACE, 1], [B.COBBLE, 2]], 'table', 'deco'),
      cake,
      r(I.COOKIE, 8, [[I.WHEAT, 2], [I.DYE_BROWN, 1]], 'oven', 'nourriture'),
      r(I.APPLE_PIE, 2, [[I.APPLE, 3], [I.SUGAR, 1], [I.EGG, 1], [I.WHEAT, 1]], 'oven', 'nourriture'),
      r(I.BREAD, 3, [[I.WHEAT, 3], [I.EGG, 1]], 'oven', 'nourriture'),
      r(I.MEAT_STEW, 1, [[I.COOKED_MEAT, 1], [I.BAKED_POTATO, 1], [I.CARROT, 1], [B.BROWN_SHROOM, 1]], null, 'nourriture'),
      r(I.FISH_SOUP, 1, [[I.COOKED_COD, 1], [I.COOKED_SALMON, 1], [I.POTATO, 1], [I.CARROT, 1]], null, 'nourriture'),
      r(I.VEGETABLE_SOUP, 1, [[I.CARROT, 2], [I.POTATO, 1], [I.BEETROOT, 2]], null, 'nourriture'),
      r(I.SUSHI, 2, [[I.RAW_SALMON, 1], [I.RAW_COD, 1], [B.DRIED_KELP_BLOCK, 1]], null, 'nourriture'),
    );
  });

  // ----------------------------------------------------- textures --
  const FISH = {
    cod: { body: [176, 150, 110], belly: [224, 214, 190], fin: [150, 124, 90] },
    salmon: { body: [166, 60, 50], belly: [226, 140, 110], fin: [110, 40, 34] },
    puffer: { body: [228, 200, 70], belly: [246, 240, 200], fin: [200, 150, 40] },
  };
  const TROPIC = [[240, 110, 30], [60, 120, 230], [240, 220, 60], [230, 60, 150], [80, 200, 120], [250, 250, 250], [150, 80, 220], [60, 200, 220]];
  const TROPIC2 = [[250, 250, 250], [250, 220, 60], [40, 40, 50], [250, 250, 250], [240, 120, 40], [240, 100, 40], [250, 220, 60], [240, 90, 90]];
  CM.TROPIC_COLORS = TROPIC;
  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    // poisson vu de profil (objet) : corps ovale, queue, œil
    const fishIcon = (d, r, c, belly, fin, cooked) => {
      clear(d);
      for (let y = 3; y < 13; y++)
        for (let x = 1; x < 12; x++) {
          const k = Math.hypot((x - 6.2) / 5.2, (y - 8) / 3.6);
          if (k < 1) put(d, x, y, vary(y > 9 ? belly : c, r, 10));
        }
      for (let y = 4; y < 12; y++) for (let x = 11; x < 15; x++) if (Math.abs(y - 8) <= (x - 10) * 1.1) put(d, x, y, vary(fin, r, 8));
      for (let x = 4; x < 9; x++) put(d, x, 3, vary(fin, r, 8));
      if (!cooked) put(d, 3, 7, [20, 20, 20]);
      else for (let k = 0; k < 8; k++) put(d, 2 + Math.floor(r() * 9), 5 + Math.floor(r() * 6), [110, 70, 40]);
    };
    const brown = (c) => c.map((v, i) => Math.round(v * 0.62 + [70, 40, 10][i] * 0.38));
    make('raw_cod', (d, r) => fishIcon(d, r, FISH.cod.body, FISH.cod.belly, FISH.cod.fin));
    make('cooked_cod', (d, r) => fishIcon(d, r, brown(FISH.cod.body), brown(FISH.cod.belly), brown(FISH.cod.fin), true));
    make('raw_salmon', (d, r) => fishIcon(d, r, FISH.salmon.body, FISH.salmon.belly, FISH.salmon.fin));
    make('cooked_salmon', (d, r) => fishIcon(d, r, brown(FISH.salmon.body), brown(FISH.salmon.belly), brown(FISH.salmon.fin), true));
    make('tropical_fish', (d, r) => {
      fishIcon(d, r, TROPIC[0], TROPIC[0], TROPIC2[0]);
      for (let y = 4; y < 13; y++) for (const x of [5, 6, 9]) if (d[(y * 16 + x) * 4 + 3]) put(d, x, y, [250, 250, 250]);
    });
    make('fishing_rod', (d, r) => {
      clear(d);
      for (let k = 1; k < 15; k++) put(d, k, 15 - k, vary([120, 84, 44], r, 10));
      for (let y = 2; y < 13; y++) put(d, 14, y, [210, 210, 210]);
      put(d, 13, 13, [200, 40, 40]); put(d, 14, 13, [200, 40, 40]); put(d, 13, 14, [240, 240, 240]); put(d, 14, 14, [240, 240, 240]);
    });
    make('boat_item', (d, r) => {
      clear(d);
      for (let y = 7; y < 13; y++) {
        const a = 1 + (y - 7) * 0.7, b = 15 - (y - 7) * 0.7;
        for (let x = Math.round(a); x < Math.round(b); x++) put(d, x, y, vary(y === 7 ? [150, 110, 64] : [176, 132, 80], r, 10));
      }
      for (let y = 3; y < 10; y++) put(d, 5 + Math.floor((y - 3) / 3), y, [110, 80, 44]);
      for (let x = 1; x < 15; x++) put(d, x, 8, [120, 86, 50]);
    });
    make('cookie', (d, r) => {
      clear(d);
      for (let y = 3; y < 14; y++) for (let x = 3; x < 14; x++) if (Math.hypot(x - 8, y - 8.5) < 5.3) put(d, x, y, vary([206, 146, 80], r, 12));
      for (let k = 0; k < 7; k++) put(d, 4 + Math.floor(r() * 8), 5 + Math.floor(r() * 8), [80, 44, 24]);
    });
    const pie = (d, r, fill1) => {
      clear(d);
      for (let y = 5; y < 14; y++) for (let x = 1; x < 15; x++) if (Math.abs(x - 7.5) < 7 - (y < 7 ? 7 - y : 0)) put(d, x, y, vary(y > 11 ? [196, 140, 76] : [222, 170, 96], r, 10));
      for (let x = 3; x < 13; x += 3) put(d, x, 7, fill1);
      for (let x = 2; x < 14; x += 4) put(d, x, 9, fill1);
    };
    make('apple_pie', (d, r) => pie(d, r, [190, 60, 40]));
    const bowl = (d, r, soup, bits) => {
      clear(d);
      for (let y = 8; y < 14; y++) for (let x = 2; x < 14; x++) if (Math.abs(x - 7.5) < 6.5 - (y - 8) * 0.6) put(d, x, y, vary([140, 96, 56], r, 8));
      for (let x = 2; x < 14; x++) put(d, x, 8, vary(soup, r, 10));
      for (let x = 3; x < 13; x++) put(d, x, 7, vary(soup, r, 10));
      for (const [x, c] of bits) put(d, x, 7, c);
    };
    make('meat_stew', (d, r) => bowl(d, r, [150, 90, 50], [[4, [226, 130, 40]], [7, [180, 120, 70]], [10, [90, 60, 40]]]));
    make('fish_soup', (d, r) => bowl(d, r, [226, 180, 110], [[5, [240, 230, 210]], [9, [226, 140, 110]]]));
    make('veg_soup', (d, r) => bowl(d, r, [180, 60, 60], [[4, [230, 140, 40]], [8, [220, 200, 150]], [11, [230, 140, 40]]]));
    make('sushi', (d, r) => {
      clear(d);
      for (let y = 5; y < 13; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, y - 9) < 4.6) put(d, x, y, vary([30, 50, 30], r, 6));
      for (let y = 6; y < 12; y++) for (let x = 4; x < 12; x++) if (Math.hypot(x - 7.5, y - 9) < 3.4) put(d, x, y, vary([244, 244, 240], r, 5));
      for (let y = 8; y < 11; y++) for (let x = 6; x < 10; x++) put(d, x, y, vary([240, 130, 100], r, 8));
    });
    // gâteau
    make('cake_top', (d, r) => {
      fill(d, r, [248, 246, 244], 4);
      for (let k = 0; k < 9; k++) put(d, 1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), [220, 40, 50]);
    });
    make('cake_side', (d, r) => {
      fill(d, r, [200, 140, 80], 8);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) if (y < 3 || r() < 0.5) put(d, x, y, vary([248, 246, 244], r, 4));
      for (let x = 0; x < 16; x++) put(d, x, 10, vary([230, 190, 150], r, 6));
    });
    make('cake_inner', (d, r) => {
      fill(d, r, [230, 200, 150], 8);
      for (let x = 0; x < 16; x++) { put(d, x, 0, [248, 246, 244]); put(d, x, 1, [248, 246, 244]); put(d, x, 9, [200, 40, 50]); }
    });
    make('cake_bottom', (d, r) => fill(d, r, [180, 120, 64], 8));
    make('cake_item', (d, r) => {
      clear(d);
      for (let y = 5; y < 14; y++) for (let x = 1; x < 15; x++) put(d, x, y, vary(y < 8 ? [248, 246, 244] : y === 11 ? [230, 190, 150] : [200, 140, 80], r, 6));
      for (let x = 2; x < 14; x += 3) put(d, x, 5, [220, 40, 50]);
      for (let x = 3; x < 14; x += 4) put(d, x, 8, [248, 246, 244]);
    });
    // four à pain : briques et bouche du four
    const brick = (d, r) => {
      fill(d, r, [150, 74, 56], 10);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [196, 184, 170]);
      for (let y = 0; y < 16; y++) put(d, (Math.floor(y / 4) % 2) * 8 + 3, y, [196, 184, 170]);
    };
    make('oven_side', brick);
    make('oven_top', (d, r) => {
      brick(d, r);
      for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, vary([60, 56, 54], r, 6));
    });
    make('oven_front', (d, r) => {
      brick(d, r);
      for (let y = 6; y < 15; y++) for (let x = 3; x < 13; x++) if (y > 8 || Math.hypot(x - 7.5, y - 9) < 5) put(d, x, y, vary(y > 12 ? [255, 150, 40] : [40, 26, 20], r, 8));
      for (let x = 4; x < 12; x++) if (r() < 0.6) put(d, x, 12, [255, 200, 80]);
    });
    // ligne et flotteur
    make('fish_line', (d, r) => fill(d, r, [40, 40, 44], 2));
    make('bobber_red', (d, r) => fill(d, r, [210, 36, 36], 6));
    make('bobber_white', (d, r) => fill(d, r, [240, 240, 240], 4));
    make('boat_wood', (d, r) => {
      fill(d, r, [168, 124, 74], 10);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [120, 86, 50]);
    });
    make('boat_dark', (d, r) => fill(d, r, [110, 80, 46], 8));
    // créatures
    for (const [k, c] of Object.entries(FISH)) {
      make('mob_' + k, (d, r) => {
        fill(d, r, c.body, 10);
        for (let y = 11; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(c.belly, r, 8));
        if (k === 'cod') for (let n = 0; n < 16; n++) put(d, Math.floor(r() * 16), Math.floor(r() * 10), [140, 120, 86]);
      });
      make('mob_' + k + '_face', (d, r) => {
        fill(d, r, c.body, 8);
        for (let y = 11; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(c.belly, r, 6));
        put(d, 2, 6, [16, 16, 16]); put(d, 13, 6, [16, 16, 16]); put(d, 2, 5, [240, 240, 240]); put(d, 13, 5, [240, 240, 240]);
        for (let x = 6; x < 10; x++) put(d, x, 11, [60, 40, 30]);
      });
      make('mob_' + k + '_fin', (d, r) => fill(d, r, c.fin, 10));
    }
    make('mob_puffer_spike', (d, r) => fill(d, r, [250, 250, 230], 4));
    TROPIC.forEach((c, i) => {
      make('mob_tropical_' + i, (d, r) => {
        fill(d, r, c, 8);
        for (let y = 0; y < 16; y++) for (const x of [4, 5, 10, 11]) put(d, x, y, vary(TROPIC2[i], r, 6));
      });
      make('mob_tropical_face_' + i, (d, r) => {
        fill(d, r, c, 8);
        put(d, 3, 6, [16, 16, 16]); put(d, 12, 6, [16, 16, 16]);
      });
      make('mob_tropical_fin_' + i, (d, r) => fill(d, r, TROPIC2[i], 8));
    });
    make('mob_squid', (d, r) => {
      fill(d, r, [44, 62, 110], 10);
      for (let n = 0; n < 20; n++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [70, 92, 140]);
    });
    make('mob_squid_face', (d, r) => {
      fill(d, r, [44, 62, 110], 8);
      for (const x0 of [3, 10]) for (let y = 6; y < 9; y++) for (let x = x0; x < x0 + 3; x++) put(d, x, y, y === 7 && x === x0 + 1 ? [10, 10, 10] : [230, 230, 220]);
    });
    make('mob_squid_leg', (d, r) => fill(d, r, [58, 76, 124], 10));
    make('mob_dolphin', (d, r) => {
      fill(d, r, [110, 130, 150], 6);
      for (let y = 10; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary([210, 218, 226], r, 5));
    });
    make('mob_dolphin_face', (d, r) => {
      fill(d, r, [110, 130, 150], 6);
      for (let y = 10; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary([210, 218, 226], r, 5));
      put(d, 3, 6, [16, 16, 20]); put(d, 12, 6, [16, 16, 20]);
      for (let x = 4; x < 12; x++) put(d, x, 11, [90, 100, 110]);
    });
    make('mob_dolphin_fin', (d, r) => fill(d, r, [90, 108, 128], 6));
    make('ink', (d, r) => fill(d, r, [14, 14, 22], 6));
  });

  // ================================================= NAGE ============
  const water = (w, x, y, z) => CM.isWater(w.get(Math.floor(x), Math.floor(y), Math.floor(z)));
  // Donne un effet à un joueur (celui de cet écran ou un invité).
  function giveEffect(e, q, k, t, l) {
    const g = e.game;
    if (q === g.player) CM.Effects.add(q, k, t, l);
    else if (q.pid !== undefined) g.net.sendTo(q.pid, { t: 'act', a: { a: 'eff', k, t, l } });
  }
  // Nage au hasard sans quitter l'eau ; hors de l'eau, frétille (et finit par s'étouffer).
  function swim(e, m, dt, c, sp, o) {
    const w = e.game.world, r = e.rand, mid = m.y + m.h * 0.5;
    o = o || {};
    if (!water(w, m.x, mid, m.z)) {
      m.ai.dry = (m.ai.dry || 0) + dt;
      if (m.ai.dry > (o.dryMax || 5)) {
        m.ai.dry -= 2;
        e.hurtMob(m, 1, null, false);
      }
      if (m.onGround && r() < dt * 2.5) {
        if (Math.hypot(e.game.player.x - m.x, e.game.player.z - m.z) < 12) CM.Audio.play('flop');
        return { jump: true, tvx: (r() - 0.5) * 4, tvz: (r() - 0.5) * 4 };
      }
      return {};
    }
    m.ai.dry = 0;
    m.ai.timer -= dt;
    let dir = m.ai.dir, speed = sp, vy = m.ai.vy || 0;
    // fuit le joueur qui approche
    const p = c.p;
    if (o.skittish && p.alive && c.distP < 5 && Math.abs(c.dyp) < 4) {
      dir = Math.atan2(c.dxp, c.dzp);
      speed = sp * 2.2;
    } else if (o.goal) {
      dir = Math.atan2(-(o.goal[0] - m.x), -(o.goal[2] - m.z));
      vy = Math.max(-2, Math.min(2, (o.goal[1] - m.y) * 1.5));
      speed = o.goalSpeed || sp;
    } else if (m.ai.timer <= 0 || m.hitX || m.hitZ || dir === undefined || dir === null) {
      m.ai.timer = 1 + r() * 3;
      m.ai.dir = dir = r() * TAU;
      m.ai.vy = vy = (r() - 0.5) * 1.4;
    }
    // reste dans l'eau : demi-tour devant la berge
    const nx = m.x - Math.sin(dir) * (m.hw + 0.7), nz = m.z - Math.cos(dir) * (m.hw + 0.7);
    if (!water(w, nx, mid, nz) && !o.goal) {
      m.ai.dir = dir = dir + Math.PI * (0.6 + r() * 0.8);
      m.ai.timer = 1.5;
    }
    if (!o.surface && !water(w, m.x, m.y + m.h + 0.35, m.z)) vy = Math.min(vy, -0.7); // sous la surface
    if (!water(w, m.x, m.y - 0.3, m.z) && !water(w, nx, m.y - 0.3, nz)) vy = Math.max(vy, 0.5); // au-dessus du fond
    return { tvx: -Math.sin(dir) * speed, tvz: -Math.cos(dir) * speed, tvy: vy };
  }
  const drop = (e, m, id, n) => {
    if (id !== undefined && n > 0) e.addDrop(id, n, m.x, m.y + 0.3, m.z);
  };
  const Lr = () => CM.Textures.layer;
  const six = (side, face) => [side, side, side, side, side, face];
  // corps de poisson : tronc, queue qui ondule, nageoire dorsale
  function fishBody(e, batch, m, l, f, t, L, body, face, fin, len, hh, ww) {
    const wag = Math.sin(t * 10 + m.age * 3) * (m.moving ? 0.5 : 0.25);
    e.part(batch, e.M, 0, 0, 0, 0, [-ww, 0.02, -len * 0.5, ww, 0.02 + hh, len * 0.5], six(body, face), l, f);
    e.part(batch, e.M, 0, 0.02 + hh * 0.5, len * 0.5 - 0.02, 0, [-0.01, -hh * 0.55, 0, 0.01, hh * 0.55, len * 0.35], fin, l, f, null, wag);
    e.part(batch, e.M, 0, 0.02 + hh, -len * 0.1, 0, [-0.01, 0, -len * 0.2, 0.01, hh * 0.35, len * 0.2], fin, l, f);
    e.part(batch, e.M, ww, 0.04, -len * 0.15, 0, [0, 0, 0, 0.01, hh * 0.3, len * 0.18], fin, l, f, null, 0, -0.4);
    e.part(batch, e.M, -ww, 0.04, -len * 0.15, 0, [-0.01, 0, 0, 0, hh * 0.3, len * 0.18], fin, l, f, null, 0, 0.4);
  }
  const fishLoot = (id) => (e, m, meat, more) => {
    const I = CM.I;
    drop(e, m, m.fire > 0 && I['COOKED_' + id.replace('RAW_', '')] !== undefined ? I['COOKED_' + id.replace('RAW_', '')] : I[id], 1);
    if (e.rand() < 0.05) drop(e, m, I.BONE_MEAL, 1);
  };

  MOBS.cod = {
    name: 'Morue', aliases: ['morue', 'cod', 'poisson'], hw: 0.22, h: 0.3, hp: 3, speed: 1.6, passive: true, swim: true, ambient: true, water: true,
    sound: 'flop', xp: 1, group: [3, 6],
    update: (e, m, dt, c) => swim(e, m, dt, c, 1.6, { skittish: true }),
    loot: fishLoot('RAW_COD'),
    render(e, batch, m, l, f, sw, t) {
      const L = Lr();
      fishBody(e, batch, m, l, f, t, L, L.mob_cod, L.mob_cod_face, L.mob_cod_fin, 0.5, 0.2, 0.08);
    },
  };
  MOBS.salmon = {
    name: 'Saumon', aliases: ['saumon', 'salmon'], hw: 0.25, h: 0.32, hp: 3, speed: 2, passive: true, swim: true, ambient: true, water: true,
    sound: 'flop', xp: 1, group: [3, 5],
    update: (e, m, dt, c) => swim(e, m, dt, c, 2, { skittish: true }),
    loot: fishLoot('RAW_SALMON'),
    render(e, batch, m, l, f, sw, t) {
      const L = Lr();
      fishBody(e, batch, m, l, f, t, L, L.mob_salmon, L.mob_salmon_face, L.mob_salmon_fin, 0.62, 0.22, 0.09);
    },
  };
  MOBS.tropical_fish = {
    name: 'Poisson tropical', aliases: ['poisson_tropical', 'tropical', 'tropical_fish', 'poisson-clown'], hw: 0.18, h: 0.34, hp: 3, speed: 1.5, passive: true, swim: true, ambient: true, water: true,
    sound: 'flop', xp: 1, group: [4, 8],
    init(m, e) {
      m.variant = Math.floor(e.rand() * 8);
    },
    update: (e, m, dt, c) => swim(e, m, dt, c, 1.5, { skittish: true }),
    loot: (e, m) => drop(e, m, CM.I.TROPICAL_FISH, 1),
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), v = m.variant || 0;
      fishBody(e, batch, m, l, f, t, L, L['mob_tropical_' + v], L['mob_tropical_face_' + v], L['mob_tropical_fin_' + v], 0.3, 0.26, 0.05);
    },
  };
  MOBS.pufferfish = {
    name: 'Poisson-globe', aliases: ['poisson_globe', 'pufferfish', 'globe'], hw: 0.2, h: 0.3, hp: 3, speed: 1.2, passive: true, swim: true, ambient: true, water: true,
    sound: 'flop', xp: 1,
    // se gonfle quand un joueur approche ; le toucher gonflé empoisonne
    update(e, m, dt, c) {
      const p = c.p;
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      const near = p.alive && c.distP < 2.6 && Math.abs(c.dyp) < 2.5;
      m.ai.puff = near ? 3 : Math.max(0, (m.ai.puff || 0) - dt);
      m.ai.special = m.ai.puff > 0;
      if (m.ai.special && p.alive && c.distP < 1.2 && Math.abs(c.dyp + 0.5) < 1.6 && m.ai.attackCd <= 0) {
        m.ai.attackCd = 1.5;
        e.hitPlayer(p, 1, m, 'Un poisson-globe');
        giveEffect(e, p, 'poison', 6, 1);
      }
      return swim(e, m, dt, c, m.ai.special ? 0.4 : 1.2);
    },
    loot: (e, m) => drop(e, m, CM.I.PUFFERFISH, 1),
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), B = L.mob_puffer, F = L.mob_puffer_face, S = L.mob_puffer_spike, fin = L.mob_puffer_fin;
      if (m.ai.special) {
        e.part(batch, e.M, 0, 0, 0, 0, [-0.25, 0, -0.25, 0.25, 0.5, 0.25], six(B, F), l, f);
        for (const [x, y, z] of [[0.25, 0.25, 0], [-0.25, 0.25, 0], [0, 0.5, 0], [0, 0, 0], [0, 0.25, 0.25], [0.2, 0.45, 0.2], [-0.2, 0.45, -0.2], [0.2, 0.05, -0.2], [-0.2, 0.05, 0.2]])
          e.part(batch, e.M, x, y, z, 0, [-0.03, -0.03, -0.03, 0.03, 0.03, 0.03], S, l, f);
      } else {
        e.part(batch, e.M, 0, 0, 0, 0, [-0.12, 0.04, -0.14, 0.12, 0.26, 0.14], six(B, F), l, f);
        e.part(batch, e.M, 0, 0.14, 0.14, 0, [-0.01, -0.07, 0, 0.01, 0.07, 0.1], fin, l, f, null, Math.sin(t * 9) * 0.4);
      }
    },
  };
  MOBS.squid = {
    name: 'Calmar', aliases: ['calmar', 'squid', 'pieuvre'], hw: 0.4, h: 0.8, hp: 10, speed: 1, passive: true, swim: true, ambient: true, water: true,
    sound: 'splash', xp: 2,
    // avance par à-coups ; blessé, il crache de l'encre et file
    update(e, m, dt, c) {
      m.ai.pulse = ((m.ai.pulse || 0) + dt) % 2.2;
      if (m.ai.flee > 0) m.ai.flee -= dt;
      const o = swim(e, m, dt, c, m.ai.flee > 0 ? 4 : m.ai.pulse < 0.5 ? 2.2 : 0.3, { skittish: m.ai.flee > 0 });
      return o;
    },
    onHurt(e, m) {
      m.ai.flee = 3;
      e.burst(Lr().ink, m.x, m.y + 0.4, m.z, 24, { speed: 1.5, grav: 0, life: 1.6, size: 0.14, spread: 0.6 });
    },
    loot: (e, m, meat, more) => drop(e, m, CM.I.DYE_BLACK, 1 + Math.floor(e.rand() * 3) + (more || 0)),
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), B = L.mob_squid, leg = L.mob_squid_leg, pulse = (m.ai.pulse || 0) < 0.5 ? Math.sin(((m.ai.pulse || 0) / 0.5) * Math.PI) : 0;
      e.part(batch, e.M, 0, 0.3, 0, 0, [-0.3, 0, -0.3, 0.3, 0.55, 0.3], six(B, L.mob_squid_face), l, f);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, x = Math.sin(a) * 0.22, z = Math.cos(a) * 0.22;
        const sp = 0.25 + pulse * 0.6 + Math.sin(t * 3 + k) * 0.08;
        e.part(batch, e.M, x, 0.32, z, -Math.cos(a) * sp, [-0.035, -0.5, -0.035, 0.035, 0, 0.035], leg, l, f, null, 0, Math.sin(a) * sp);
      }
    },
  };
  MOBS.dolphin = {
    name: 'Dauphin', aliases: ['dauphin', 'dolphin'], hw: 0.45, h: 0.6, hp: 10, speed: 5, passive: true, swim: true, ambient: true, water: true,
    sound: 'dolphin', xp: 3, group: [2, 4],
    // nage vite près de la surface, fait des bonds ; suit les nageurs et les bateaux
    // (et leur donne la grâce du dauphin) ; se défend si on le frappe
    update(e, m, dt, c) {
      const g = e.game, w = g.world, r = e.rand, p = c.p;
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      if (m.ai.angry > 0) m.ai.angry -= dt;
      m.ai.leap = (m.ai.leap === undefined ? 3 + r() * 6 : m.ai.leap) - dt;
      if (r() < dt * 0.15 && c.distL < 20) CM.Audio.play('dolphin', { pitch: 0.9 + r() * 0.3 });
      const wet = water(w, m.x, m.y + m.h * 0.5, m.z);
      const buddy = p.alive && c.distP < 18 && Math.abs(c.dyp) < 8 && (water(w, p.x, p.y + 0.4, p.z) || (p.riding !== null && p.riding !== undefined) || p.flags & 512 || m.ai.angry > 0);
      let goal = null;
      if (buddy && c.distP > 2.5) goal = [p.x + Math.sin(m.age * 0.7) * 2.5, Math.min(p.y, m.y + 1), p.z + Math.cos(m.age * 0.7) * 2.5];
      if (m.ai.angry > 0 && p.alive && c.distP < 1.6 + m.hw && Math.abs(c.dyp) < 1.5 && m.ai.attackCd <= 0) {
        m.ai.attackCd = 1.2;
        e.hitPlayer(p, 3, m, 'Un dauphin');
      }
      // grâce du dauphin pour qui nage à côté
      m.ai.grace = (m.ai.grace || 0) - dt;
      if (m.ai.grace <= 0) {
        m.ai.grace = 2;
        for (const q of e.plist) if (q.alive !== false && Math.hypot(q.x - m.x, q.y - m.y, q.z - m.z) < 7 && water(w, q.x, q.y + 0.4, q.z)) giveEffect(e, q, 'dolphins_grace', 5, 1);
      }
      const o = swim(e, m, dt, c, buddy ? 6 : 3.2, { surface: true, dryMax: 40, goal, goalSpeed: 6.5 });
      // bond hors de l'eau quand il file en surface
      if (wet && m.ai.leap <= 0 && !water(w, m.x, m.y + m.h + 0.4, m.z) && Math.hypot(m.vx, m.vz) > 2) {
        m.ai.leap = 4 + r() * 8;
        m.vy = 7.5;
        if (c.distL < 24) CM.Audio.play('splash');
      } else if (wet && o.tvy !== undefined && !buddy) o.tvy = Math.max(o.tvy, water(w, m.x, m.y + m.h + 1.2, m.z) ? 0.8 : o.tvy); // remonte respirer
      return o;
    },
    onHurt(e, m) {
      m.ai.angry = 12;
    },
    loot: (e, m) => drop(e, m, m.fire > 0 ? CM.I.COOKED_COD : CM.I.RAW_COD, Math.floor(e.rand() * 2)),
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), B = L.mob_dolphin, fin = L.mob_dolphin_fin, tail = Math.sin(t * 8 + m.age) * 0.35;
      e.part(batch, e.M, 0, 0, 0, 0, [-0.28, 0.02, -0.55, 0.28, 0.5, 0.45], six(B, L.mob_dolphin_face), l, f);
      e.part(batch, e.M, 0, 0.12, -0.55, 0, [-0.1, 0, -0.25, 0.1, 0.14, 0], B, l, f);
      e.part(batch, e.M, 0, 0.48, -0.05, 0, [-0.03, 0, -0.1, 0.03, 0.24, 0.16], fin, l, f, null, -0.4);
      e.part(batch, e.M, 0, 0.26, 0.45, 0, [-0.14, -0.12, 0, 0.14, 0.12, 0.4], B, l, f, null, tail);
      e.part(batch, e.M, 0, 0.26, 0.82, 0, [-0.34, -0.02, -0.05, 0.34, 0.03, 0.14], fin, l, f, null, tail * 1.4);
      e.part(batch, e.M, 0.28, 0.12, -0.2, 0, [0, -0.02, 0, 0.26, 0.03, 0.16], fin, l, f, null, 0, -0.5);
      e.part(batch, e.M, -0.28, 0.12, -0.2, 0, [-0.26, -0.02, 0, 0, 0.03, 0.16], fin, l, f, null, 0, 0.5);
    },
  };
})();
