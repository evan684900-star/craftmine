'use strict';
// Confort : boussole (vers le lit), boussole de récupération (vers le lieu de la mort), carte ;
// textures de l'apparence des joueurs (peau, visage, cheveux).
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });

  // Apparence : teintes de peau et couleurs de cheveux.
  CM.SKIN_TONES = [[214, 168, 128], [240, 204, 172], [182, 132, 96], [142, 98, 66], [96, 64, 44]];
  CM.SKIN_NAMES = ['Claire', 'Très claire', 'Mate', 'Foncée', 'Très foncée'];
  CM.HAIR_COLORS = [[92, 60, 34], [30, 26, 24], [222, 190, 110], [172, 72, 30], [228, 228, 228], [64, 96, 206]];
  CM.HAIR_NAMES = ['Châtains', 'Noirs', 'Blonds', 'Roux', 'Blancs', 'Bleus'];

  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1509, 'COMPASS', { name: 'Boussole', tex: 'compass', stack: 1, type: 'compass', target: 'bed', desc: 'Tenue en main : montre la direction de ton lit (ou du point de départ) et la distance.' });
    defItem(1510, 'RECOVERY_COMPASS', { name: 'Boussole de récupération', tex: 'recovery_compass', stack: 1, type: 'compass', target: 'death', desc: 'Tenue en main : montre où tu es mort la dernière fois (pour retrouver tes objets).' });
    defItem(1511, 'MAP', { name: 'Carte', tex: 'map_item', stack: 1, type: 'map', desc: 'Tenue en main : une grande carte des environs (joueurs, lit, lieu de ta mort, monstres).' });
  });
  M.recipes.push(function (K) {
    const { r } = K;
    const I = CM.I;
    CM.recipes.push(
      r(I.COMPASS, 1, [[I.IRON_INGOT, 4], [I.REDSTONE, 1]], 'table', 'outils'),
      r(I.RECOVERY_COMPASS, 1, [[I.COMPASS, 1], [I.SHADOW_ESSENCE, 4]], 'table', 'outils'),
      r(I.MAP, 1, [[I.PAPER, 8], [I.COMPASS, 1]], 'table', 'outils'),
    );
  });

  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    const compass = (d, r, rim, dial, needle) => {
      clear(d);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const k = Math.hypot(x - 7.5, y - 7.5);
          if (k < 7.2) put(d, x, y, k > 5.8 ? vary(rim, r, 10) : dial);
        }
      for (let k = 0; k < 5; k++) put(d, 7 + (k < 3 ? 0 : 1), 3 + k, needle);
      for (let k = 0; k < 4; k++) put(d, 8, 8 + k, [60, 60, 70]);
      put(d, 7, 7, [240, 240, 240]); put(d, 8, 7, [240, 240, 240]);
    };
    make('compass', (d, r) => compass(d, r, [150, 150, 160], [226, 222, 206], [210, 40, 40]));
    make('recovery_compass', (d, r) => compass(d, r, [40, 50, 70], [40, 90, 110], [120, 240, 230]));
    make('map_item', (d, r) => {
      clear(d);
      for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) put(d, x, y, vary([222, 206, 160], r, 8));
      for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
        const v = Math.sin(x * 0.9) + Math.cos(y * 0.8);
        put(d, x, y, v > 0.9 ? [90, 150, 210] : v > -0.4 ? vary([110, 170, 90], r, 12) : [170, 150, 110]);
      }
      put(d, 9, 7, [200, 30, 30]); put(d, 8, 8, [200, 30, 30]); put(d, 10, 8, [200, 30, 30]);
    });
    // apparence : peau (bras, tête), visage sans cheveux, cheveux (dessus / tour de tête)
    CM.SKIN_TONES.forEach((c, i) => {
      make('skin_' + i, (d, r) => fill(d, r, c, 5));
      make('face_' + i, (d, r) => {
        fill(d, r, c, 5);
        for (const ex of [3, 10]) {
          put(d, ex, 8, [255, 255, 255]); put(d, ex + 1, 8, [255, 255, 255]);
          put(d, ex + (ex < 8 ? 1 : 0), 8, [52, 72, 150]);
          put(d, ex, 9, [230, 230, 236]); put(d, ex + 1, 9, [230, 230, 236]);
        }
        const dk = c.map((v) => Math.round(v * 0.82));
        put(d, 7, 10, dk); put(d, 8, 10, dk);
        for (let x = 5; x < 11; x++) put(d, x, 12, [Math.round(c[0] * 0.7), Math.round(c[1] * 0.5), Math.round(c[2] * 0.5)]);
      });
    });
    CM.HAIR_COLORS.forEach((c, i) => {
      make('hair_top_' + i, (d, r) => fill(d, r, c, 9));
      // tour de tête : 4 rangées de cheveux en haut, franges irrégulières, le reste transparent
      make('hair_side_' + i, (d, r) => {
        clear(d);
        for (let x = 0; x < 16; x++) {
          const n = 3 + (r() < 0.5 ? 1 : 0) + (x === 0 || x === 15 ? 1 : 0);
          for (let y = 0; y < n; y++) put(d, x, y, vary(c, r, 9));
        }
      });
      make('hair_back_' + i, (d, r) => {
        clear(d);
        for (let x = 0; x < 16; x++) {
          const n = 9 + Math.floor(r() * 3);
          for (let y = 0; y < n; y++) put(d, x, y, vary(c, r, 9));
        }
      });
    });
  });
})();
