'use strict';
// Décoration : panneaux (texte), tableaux (peints par le jeu), cadres, porte-armures, disques.
// Les tableaux, cadres et porte-armures sont des objets posés (deco.js), pas des blocs.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });

  // Tableaux : clé, nom, largeur, hauteur (en blocs).
  const PAINTINGS = [
    ['soleil', 'Soleil couchant', 1, 1], ['bouquet', 'Bouquet', 1, 1], ['lune', 'Clair de lune', 1, 1], ['ombre', 'Portrait d’Ombre', 1, 1],
    ['prairie', 'La prairie', 2, 1], ['mer', 'Voilier', 2, 1], ['desert', 'Dunes', 2, 1],
    ['phare', 'Le phare', 1, 2], ['cascade', 'Cascade', 1, 2],
    ['montagnes', 'Sommets', 2, 2], ['village', 'Le village', 2, 2], ['nebuleuse', 'Nébuleuse', 2, 2],
    ['panorama', 'Panorama', 4, 2], ['aurore', 'Aurore boréale', 4, 2],
  ].map(([k, name, w, h]) => ({ k, name, w, h }));
  CM.PAINTINGS = PAINTINGS;

  // Disques : clé, titre, couleur de l'étiquette, style musical (deco.js).
  const DISCS = [
    ['aube', 'Aube', [240, 200, 80]], ['clairiere', 'Clairière', [110, 200, 110]], ['cavernes', 'Cavernes', [110, 110, 130]],
    ['maree', 'Marée', [80, 150, 220]], ['forge', 'Forge', [220, 90, 50]], ['etoiles', 'Étoiles', [150, 110, 230]],
    ['pixel', 'Pixel', [240, 110, 200]], ['orage', 'Orage', [70, 80, 110]],
  ];
  CM.DISCS = DISCS.map(([k, name, c]) => ({ k, name, c }));

  // ------------------------------------------------------- objets --
  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1498, 'PAINTING', { name: 'Tableau', tex: 'painting_item', type: 'painting', desc: 'Clic droit sur un mur : un tableau au hasard, le plus grand qui tient. Frappe-le pour le reprendre.' });
    defItem(1499, 'ITEM_FRAME', { name: 'Cadre', tex: 'frame_item', type: 'frame', desc: 'Se pose sur un mur, le sol ou le plafond. Clic droit avec un objet pour l’exposer, puis pour le tourner ; frappe-le pour reprendre l’objet.' });
    defItem(1500, 'ARMOR_STAND', { name: 'Porte-armure', tex: 'stand_item', stack: 16, type: 'stand', desc: 'Se pose au sol. Clic droit avec une pièce d’armure pour l’en habiller, avec une arme pour la lui donner, main vide pour reprendre.' });
    CM.DISC_IDS = [];
    CM.DISCS.forEach((d, i) => {
      defItem(1501 + i, 'DISC_' + d.k.toUpperCase(), { name: 'Disque « ' + d.name + ' »', tex: 'disc_' + d.k, stack: 1, type: 'disc', disc: i, desc: 'Clic droit sur un juke-box pour l’écouter. Une musique composée par le jeu.' });
      CM.DISC_IDS.push(1501 + i);
    });
  });

  // -------------------------------------------------------- blocs --
  // Panneaux : le bloc ne sert qu'à la sélection ; la planche et le texte sont dessinés par deco.js.
  M.blocks.push(function (K) {
    const { nb } = K;
    const base = { render: 'model', model: [], opaque: false, solid: false, hardness: 1, tool: 'axe', sound: 'wood', tex: 'planks', iconTex: 'sign_icon', sign: true, pushDestroy: true };
    nb('SIGN', Object.assign({}, base, {
      name: 'Panneau', box: [5, 0, 5, 11, 16, 11],
      place: (P) => {
        if (!P.t) return 0;
        if (P.t.ny === 1) return CM.B.SIGN;
        if (P.t.ny === 0) return CM.B.WALL_SIGN;
        return 0;
      },
      afterPlace: (g, x, y, z, p) => CM.Deco && CM.Deco.signPlaced(g, x, y, z, p),
      use: (g, t) => CM.Deco.signUse(g, t),
    }));
    nb('WALL_SIGN', Object.assign({}, base, { name: 'Panneau mural', hidden: true, drop: 0, box: [2, 4, 2, 14, 12, 14], use: (g, t) => CM.Deco.signUse(g, t) }));
  });

  // ----------------------------------------------------- recettes --
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.blocks[B.WALL_SIGN].drop = B.SIGN;
    CM.recipes.push(
      r(B.SIGN, 3, [['planks', 6], [I.STICK, 1]], 'table', 'deco'),
      r(I.PAINTING, 1, [[I.STICK, 8], [B.WOOL || B.WOOL_WHITE, 1]], 'table', 'deco'),
      r(I.ITEM_FRAME, 1, [[I.STICK, 8], [I.LEATHER, 1]], 'table', 'deco'),
      r(I.ARMOR_STAND, 1, [[I.STICK, 6], [B.SMOOTH_STONE_SLAB || B.STONE_SLAB || B.SMOOTH_STONE, 1]], 'table', 'deco'),
    );
  });

  // ----------------------------------------------------- textures --
  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    make('sign_icon', (d, r) => {
      clear(d);
      for (let y = 2; y < 10; y++) for (let x = 1; x < 15; x++) put(d, x, y, vary(y === 2 || y === 9 || x === 1 || x === 14 ? [120, 86, 50] : [176, 132, 80], r, 8));
      for (let y = 10; y < 15; y++) for (let x = 7; x < 9; x++) put(d, x, y, vary([110, 80, 46], r, 8));
      for (const y of [4, 6]) for (let x = 3; x < 13; x++) if (r() < 0.7) put(d, x, y, [60, 40, 24]);
    });
    make('sign_board', (d, r) => {
      fill(d, r, [176, 132, 80], 10);
      for (let y = 0; y < 16; y += 5) for (let x = 0; x < 16; x++) put(d, x, y, vary([150, 110, 64], r, 6));
    });
    make('painting_item', (d, r) => {
      clear(d);
      for (let y = 2; y < 14; y++) for (let x = 1; x < 15; x++) put(d, x, y, y === 2 || y === 13 || x === 1 || x === 14 ? [120, 80, 40] : y < 8 ? [120, 180, 230] : [90, 160, 70]);
      for (let y = 5; y < 8; y++) for (let x = 9; x < 12; x++) put(d, x, y, [250, 220, 90]);
      for (let x = 3; x < 8; x++) put(d, x, 8 - Math.abs(x - 5), [70, 130, 60]);
    });
    make('painting_back', (d, r) => fill(d, r, [150, 110, 70], 10));
    make('frame_item', (d, r) => {
      clear(d);
      for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) put(d, x, y, y < 4 || y > 11 || x < 4 || x > 11 ? vary([150, 106, 60], r, 12) : [120, 84, 50]);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, vary([160, 120, 80], r, 6));
    });
    make('frame_wood', (d, r) => fill(d, r, [150, 106, 60], 12));
    make('frame_leather', (d, r) => fill(d, r, [140, 90, 56], 8));
    make('stand_item', (d, r) => {
      clear(d);
      for (let y = 14; y < 16; y++) for (let x = 3; x < 13; x++) put(d, x, y, [150, 150, 150]);
      for (let y = 2; y < 14; y++) put(d, 7, y, [176, 132, 80]), put(d, 8, y, [150, 110, 64]);
      for (let x = 3; x < 13; x++) put(d, x, 5, [176, 132, 80]);
      for (let y = 5; y < 10; y++) { put(d, 3, y, [160, 120, 70]); put(d, 12, y, [160, 120, 70]); }
      for (let y = 0; y < 3; y++) for (let x = 6; x < 10; x++) put(d, x, y, [190, 150, 100]);
    });
    make('stand_wood', (d, r) => fill(d, r, [176, 132, 80], 10));
    make('stand_stone', (d, r) => fill(d, r, [150, 150, 152], 8));
    // disques : noir, sillons, étiquette colorée
    CM.DISCS.forEach((disc) => {
      make('disc_' + disc.k, (d, r) => {
        clear(d);
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const k = Math.hypot(x - 7.5, y - 7.5);
            if (k > 7.4) continue;
            if (k < 1) put(d, x, y, [20, 20, 20]);
            else if (k < 3.2) put(d, x, y, vary(disc.c, r, 10));
            else put(d, x, y, Math.floor(k * 2) % 2 ? [36, 36, 40] : [22, 22, 26]);
          }
        put(d, 5, 4, [120, 120, 130]); put(d, 4, 5, [120, 120, 130]);
      });
    });
    // tableaux : chaque œuvre est peinte en entier puis découpée en carreaux de 16 × 16
    const cache = {};
    const art = (p) => {
      if (cache[p.k]) return cache[p.k];
      const W = p.w * 16, H = p.h * 16, px = new Array(W * H);
      let seed = 0;
      for (const ch of p.k) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const set = (x, y, c) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c;
      };
      const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
      const sky = (top, bot, h) => {
        for (let y = 0; y < (h || H); y++) for (let x = 0; x < W; x++) set(x, y, mix(top, bot, y / ((h || H) - 1)));
      };
      const rect = (x0, y0, x1, y1, c) => {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, c);
      };
      const disk = (cx, cy, rr, c) => {
        for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) if (Math.hypot(x - cx, y - cy) <= rr) set(x, y, c);
      };
      const hills = (base, amp, fr, c, c2) => {
        const ph = rnd() * 6;
        for (let x = 0; x < W; x++) {
          const top = base + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.7 + ph * 2) * amp * 0.4;
          for (let y = Math.floor(top); y < H; y++) set(x, y, c2 && y > top + 3 ? c2 : c);
        }
      };
      const stars = (n, h) => {
        for (let i = 0; i < n; i++) set(rnd() * W, rnd() * (h || H), rnd() < 0.3 ? [255, 255, 200] : [220, 220, 255]);
      };
      const tree = (x, y, s, c) => {
        rect(x, y - s, x + 1, y, [90, 60, 36]);
        disk(x, y - s - 1, Math.max(1, Math.floor(s * 0.6)), c || [50, 120, 50]);
      };
      switch (p.k) {
        case 'soleil':
          sky([250, 130, 60], [120, 60, 120], 10);
          disk(8, 9, 3, [255, 220, 110]);
          rect(0, 10, 16, 16, [40, 60, 120]);
          for (let x = 5; x < 12; x += 2) set(x, 11 + (x % 3), [255, 200, 120]);
          break;
        case 'bouquet':
          rect(0, 0, 16, 16, [60, 44, 60]);
          rect(6, 10, 10, 15, [170, 190, 220]);
          rect(5, 15, 11, 16, [110, 80, 60]);
          for (const [x, y, c] of [[5, 6, [230, 60, 70]], [8, 4, [250, 220, 70]], [11, 6, [180, 90, 220]], [7, 7, [250, 250, 250]], [10, 8, [240, 120, 40]]]) {
            set(x, y + 1, [60, 140, 60]); set(x, y + 2, [60, 140, 60]);
            disk(x, y, 1, c);
          }
          break;
        case 'lune':
          sky([10, 14, 40], [30, 40, 90]);
          stars(18);
          disk(10, 5, 3, [240, 240, 220]);
          disk(11, 4, 3, [16, 22, 56]);
          hills(12, 1.5, 0.5, [20, 30, 30]);
          break;
        case 'ombre':
          sky([70, 30, 110], [30, 10, 50]);
          disk(8, 7, 4, [20, 10, 30]);
          rect(4, 11, 12, 16, [20, 10, 30]);
          set(6, 7, [220, 120, 255]); set(10, 7, [220, 120, 255]);
          break;
        case 'prairie':
          sky([120, 180, 240], [200, 230, 250], 10);
          disk(26, 3, 2, [255, 240, 150]);
          hills(10, 1.5, 0.25, [90, 170, 70], [70, 140, 60]);
          tree(8, 11, 4);
          for (let i = 0; i < 10; i++) set(rnd() * W, 12 + rnd() * 4, rnd() < 0.5 ? [240, 90, 90] : [250, 240, 120]);
          for (const cx of [5, 18]) rect(cx, 3, cx + 5, 4, [250, 250, 250]);
          break;
        case 'mer':
          sky([110, 170, 230], [220, 235, 250], 9);
          rect(0, 9, 32, 16, [40, 100, 170]);
          for (let i = 0; i < 16; i++) set(rnd() * W, 10 + rnd() * 6, [180, 210, 240]);
          rect(12, 7, 20, 9, [130, 80, 40]);
          for (let y = 1; y < 7; y++) for (let x = 15 - (y - 1) * 0.6; x < 16; x++) set(x, y, [250, 250, 240]);
          rect(16, 1, 17, 7, [90, 60, 30]);
          break;
        case 'desert':
          sky([250, 210, 120], [250, 240, 200], 9);
          disk(24, 4, 3, [255, 250, 200]);
          hills(10, 2, 0.2, [226, 190, 110], [210, 170, 96]);
          rect(7, 5, 8, 12, [70, 140, 60]);
          rect(5, 7, 6, 9, [70, 140, 60]); rect(5, 8, 7, 9, [70, 140, 60]);
          rect(9, 6, 10, 8, [70, 140, 60]); rect(8, 7, 10, 8, [70, 140, 60]);
          break;
        case 'phare':
          sky([10, 20, 50], [40, 60, 110], 24);
          stars(14, 14);
          rect(0, 24, 16, 32, [30, 60, 110]);
          rect(3, 22, 13, 26, [70, 70, 76]);
          for (let y = 8; y < 22; y++) rect(6, y, 10, y + 1, Math.floor(y / 3) % 2 ? [230, 60, 60] : [240, 240, 240]);
          rect(5, 5, 11, 8, [250, 240, 150]);
          for (let x = 0; x < 6; x++) set(x, 6, [250, 240, 180]);
          break;
        case 'cascade':
          rect(0, 0, 16, 32, [90, 150, 70]);
          rect(0, 0, 16, 6, [140, 190, 240]);
          rect(0, 6, 5, 32, [110, 110, 116]); rect(11, 6, 16, 32, [110, 110, 116]);
          for (let y = 6; y < 28; y++) for (let x = 5; x < 11; x++) set(x, y, (x + y) % 4 ? [120, 180, 240] : [220, 240, 255]);
          rect(0, 28, 16, 32, [50, 110, 180]);
          for (let i = 0; i < 10; i++) set(4 + rnd() * 8, 27 + rnd() * 3, [250, 250, 255]);
          break;
        case 'montagnes':
          sky([120, 170, 230], [210, 225, 245], 20);
          for (const [cx, hh, c] of [[8, 16, [110, 110, 130]], [22, 20, [90, 90, 110]], [30, 12, [120, 120, 140]]])
            for (let y = 22 - hh; y < 22; y++) {
              const half = (y - (22 - hh)) * 0.9;
              for (let x = cx - half; x <= cx + half; x++) set(x, y, y < 22 - hh + hh * 0.3 ? [245, 245, 250] : c);
            }
          rect(0, 22, 32, 32, [60, 110, 170]);
          for (let i = 0; i < 12; i++) set(rnd() * W, 23 + rnd() * 9, [150, 190, 230]);
          for (const x of [2, 5, 27, 30]) tree(x, 23, 3, [40, 90, 50]);
          break;
        case 'village':
          sky([130, 180, 240], [220, 235, 250], 14);
          rect(0, 14, 32, 32, [100, 170, 80]);
          for (const [x, y, w2, c] of [[3, 16, 8, [220, 200, 160]], [15, 12, 10, [200, 180, 150]], [4, 25, 7, [210, 190, 150]], [18, 24, 9, [230, 210, 170]]]) {
            rect(x, y, x + w2, y + 6, c);
            for (let k = 0; k < 4; k++) rect(x - 1 + k, y - 1 - k, x + w2 + 1 - k, y - k, [170, 70, 50]);
            rect(x + Math.floor(w2 / 2) - 1, y + 3, x + Math.floor(w2 / 2) + 1, y + 6, [100, 70, 40]);
          }
          rect(12, 22, 16, 32, [190, 170, 120]);
          break;
        case 'nebuleuse':
          rect(0, 0, 32, 32, [8, 6, 20]);
          for (let i = 0; i < 500; i++) {
            const a = rnd() * 6.28, rr = rnd() * 14;
            const x = 16 + Math.cos(a) * rr * (1 + rnd() * 0.4), y = 16 + Math.sin(a) * rr * 0.7;
            set(x, y, mix([200, 60, 160], [60, 120, 230], rr / 14));
          }
          stars(30);
          disk(16, 16, 2, [255, 240, 220]);
          break;
        case 'panorama':
          sky([250, 150, 80], [120, 70, 140], 20);
          disk(44, 14, 4, [255, 220, 140]);
          hills(18, 4, 0.15, [70, 50, 90]);
          hills(24, 3, 0.22, [50, 40, 60]);
          for (let i = 0; i < 5; i++) {
            const x = 10 + i * 9, y = 6 + (i % 2) * 2;
            set(x, y, [30, 20, 40]); set(x - 1, y - 1, [30, 20, 40]); set(x + 1, y - 1, [30, 20, 40]);
          }
          break;
        case 'aurore':
          sky([8, 12, 30], [20, 30, 60]);
          stars(40, 18);
          for (let x = 0; x < W; x++) {
            const c0 = 8 + Math.sin(x * 0.2) * 3 + Math.sin(x * 0.07) * 4;
            for (let y = Math.max(0, c0 - 4); y < c0 + 6; y++) {
              const t = (y - c0 + 4) / 10;
              set(x, y, mix([80, 240, 160], [150, 90, 220], t));
            }
          }
          hills(24, 2, 0.1, [230, 235, 245]);
          for (let x = 2; x < W; x += 5) for (let k = 0; k < 6; k++) rect(x - Math.floor(k / 2), 27 - k, x + 1 + Math.floor(k / 2), 28 - k, [20, 50, 36]);
          break;
      }
      // cadre de bois
      for (let x = 0; x < W; x++) {
        set(x, 0, [100, 66, 36]);
        set(x, H - 1, [90, 60, 32]);
      }
      for (let y = 0; y < H; y++) {
        set(0, y, [100, 66, 36]);
        set(W - 1, y, [90, 60, 32]);
      }
      return (cache[p.k] = { W, H, px });
    };
    for (const p of PAINTINGS)
      for (let j = 0; j < p.h; j++)
        for (let i = 0; i < p.w; i++)
          make('paint_' + p.k + '_' + i + '_' + j, (d) => {
            const a = art(p);
            for (let y = 0; y < 16; y++)
              for (let x = 0; x < 16; x++) {
                const c = a.px[(j * 16 + y) * a.W + i * 16 + x] || [128, 128, 128];
                put(d, x, y, c);
              }
          });
  });
})();
