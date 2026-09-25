'use strict';
// Équipement : bouclier (tenu dans la main secondaire ou la main principale).
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });

  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1327, 'SHIELD', {
      name: 'Bouclier', tex: 'shield', stack: 1, type: 'shield', maxDur: 336,
      desc: 'Maintiens le clic droit pour le lever : il arrête les coups venus de devant (créatures, flèches, joueurs, explosions). Le mieux : dans la main secondaire.',
    });
  });

  M.recipes.push(function (K) {
    const { r } = K;
    CM.recipes.push(r(CM.I.SHIELD, 1, [['planks', 6], [CM.I.IRON_INGOT, 1]], 'table', 'armures'));
  });

  M.textures.push(function (X) {
    const { make, put, fill, vary, border } = X;
    const WOOD = [150, 108, 62], WOOD_D = [112, 78, 42], IRON = [196, 198, 204], IRON_D = [132, 134, 142];
    // face avant du bouclier : planches, bord et bosse de fer
    make('shield_face', (d, r) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(x % 5 === 0 ? WOOD_D : WOOD, r, 8));
      border(d, IRON, IRON_D);
      for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) put(d, x, y, vary(IRON, r, 6));
      put(d, 7, 7, [236, 238, 242]);
    });
    make('shield_back', (d, r) => {
      fill(d, r, WOOD_D, 8);
      border(d, IRON_D, IRON_D);
      for (let y = 5; y < 11; y++) put(d, 7, y, [80, 56, 30]), put(d, 8, y, [80, 56, 30]);
    });
    make('shield_edge', (d, r) => fill(d, r, IRON, 8));
    make('shield', (d, r) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
      for (let y = 1; y < 15; y++) {
        const w = y < 11 ? 6 : 6 - (y - 10);
        for (let x = 8 - w; x < 8 + w; x++) {
          const edge = x === 8 - w || x === 8 + w - 1 || y === 1 || y === 14 || (y >= 11 && (x === 8 - w || x === 8 + w - 1));
          put(d, x, y, edge ? IRON_D : vary(x % 4 === 0 ? WOOD_D : WOOD, r, 8));
        }
      }
      for (let y = 6; y < 9; y++) for (let x = 7; x < 9; x++) put(d, x, y, IRON);
    });
  });
})();
