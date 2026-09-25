'use strict';
// Textures animées (comme dans Minecraft) : le feu et les flammes des torches ont 8 images
// qui défilent (12 images par seconde, toutes en même temps). Les images d'une animation se
// suivent dans le tableau de textures : le shader ajoute le numéro de l'image à la couche.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const FRAMES = 8;
  CM.ANIM_FRAMES = FRAMES;

  M.textures.push(function (X) {
    const { make, put, get, copyFrom } = X;
    // bruit périodique (16 pixels) pour des flammes qui bouclent sans à-coup
    const hash = (x, y) => {
      x = ((x % 16) + 16) % 16;
      y = ((y % 16) + 16) % 16;
      let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const smooth = (t) => t * t * (3 - 2 * t);
    const vnoise = (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
      const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    // Feu : les langues de flamme montent de 4 pixels par image (la boucle fait 32 pixels).
    for (let f = 0; f < FRAMES; f++)
      make('fire_a' + f, (d) => {
        for (let i = 0; i < 1024; i++) d[i] = 0;
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const h = (15 - y) / 15;
            const n = 0.6 * vnoise(x * 0.5, (y + f * 4) * 0.5) + 0.4 * vnoise(x, y + f * 4);
            const I = 1.2 - h * 1.35 + (n - 0.5) * 1.0;
            if (I < 0.16) continue;
            const c = I > 0.95 ? [255, 244, 168] : I > 0.7 ? [255, 204, 70] : I > 0.42 ? [250, 138, 34] : [214, 62, 20];
            put(d, x, y, c, I > 0.42 ? 255 : 210);
          }
      });
    // Torches : la flamme scintille et une petite pointe apparaît et disparaît.
    const torchAnim = (base) => {
      for (let f = 0; f < FRAMES; f++)
        make(base + '_a' + f, (d) => {
          copyFrom(d, base);
          let top = 16, tx = 7, bright = null, best = -1;
          for (let y = 0; y < 8; y++)
            for (let x = 0; x < 16; x++) {
              const c = get(d, x, y);
              if (c[3] < 10) continue;
              const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(f * 1.57 + x * 1.7 + y * 2.3));
              put(d, x, y, [Math.min(255, c[0] * k + 10), Math.min(255, c[1] * k + 6), Math.min(255, c[2] * k)], c[3]);
              const lum = c[0] + c[1] + c[2];
              if (lum > best) (best = lum), (bright = c);
              if (y < top) (top = y), (tx = x);
            }
          if (bright && top > 0 && f % 4 !== 3) put(d, f % 2 ? tx + 1 : tx, top - 1, bright, f % 4 === 1 ? 150 : 230);
        });
    };
    torchAnim('torch');
    torchAnim('soul_torch');
    torchAnim('rs_torch_on');
    // les blocs utilisent la première image ; le maillage marque leurs faces comme animées
    const map = { fire: 'fire_a0', torch: 'torch_a0', soul_torch: 'soul_torch_a0', rs_torch_on: 'rs_torch_on_a0' };
    const firsts = new Set(Object.values(map));
    for (const b of CM.blocks) {
      if (!b || !b.tex || typeof b.tex !== 'object') continue;
      let hit = false;
      for (const k of Object.keys(b.tex)) {
        if (map[b.tex[k]]) b.tex[k] = map[b.tex[k]];
        // (plusieurs blocs peuvent partager le même objet de textures)
        if (firsts.has(b.tex[k])) hit = true;
      }
      if (hit) b.animTex = true;
    }
  });
})();
