'use strict';
// Textures pixel-art 16x16 générées procéduralement (aucune image externe).
(function () {
  const T = (CM.Textures = { names: [], layer: {}, canvases: {}, icons: {} });

  function make(name, fn) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(16, 16);
    const rand = CM.rng(CM.hashString(name) ^ 0x5bd1e995);
    fn(img.data, rand);
    ctx.putImageData(img, 0, 0);
    T.layer[name] = T.names.length;
    T.names.push(name);
    T.canvases[name] = c;
    return c;
  }

  // ---------------------------------------------------------- outils ----
  function put(d, x, y, c, a) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const i = (y * 16 + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = a !== undefined ? a : c[3] !== undefined ? c[3] : 255;
  }
  function get(d, x, y) {
    const i = (y * 16 + x) * 4;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }
  function mul(c, f) {
    return [c[0] * f, c[1] * f, c[2] * f, c[3] !== undefined ? c[3] : 255];
  }
  function vary(c, rand, amt) {
    const v = (rand() - 0.5) * 2 * amt;
    return [c[0] + v, c[1] + v, c[2] + v, c[3] !== undefined ? c[3] : 255];
  }
  function fill(d, rand, base, amt) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(base, rand, amt));
  }
  function speckle(d, rand, color, prob, amt) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rand() < prob) put(d, x, y, vary(color, rand, amt || 6));
  }
  function line(d, x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(d, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function disc(d, cx, cy, r, fn) {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= r) fn(x, y, dist);
      }
  }
  function copyFrom(d, name) {
    const src = T.canvases[name].getContext('2d').getImageData(0, 0, 16, 16).data;
    for (let i = 0; i < 1024; i++) d[i] = src[i];
  }
  // Dessin à partir d'un modèle ASCII + palette.
  function art(d, rows, pal) {
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch !== '.' && pal[ch]) put(d, x, y, pal[ch]);
      }
  }
  function ore(d, rand, main, hi, clusters) {
    for (let k = 0; k < clusters; k++) {
      const cx = 1 + Math.floor(rand() * 13);
      const cy = 1 + Math.floor(rand() * 13);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [2, 1], [1, 2]];
      const n = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const p = pts[Math.floor(rand() * pts.length)];
        put(d, cx + p[0], cy + p[1], vary(main, rand, 12));
      }
      put(d, cx, cy, hi);
    }
  }

  // ---------------------------------------------------------- blocs -----
  make('stone', (d, r) => {
    fill(d, r, [127, 127, 127], 12);
    for (let k = 0; k < 9; k++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16), len = 2 + Math.floor(r() * 3);
      const c = r() < 0.6 ? [104, 104, 106] : [148, 148, 150];
      for (let i = 0; i < len; i++) put(d, (x + i) % 16, y, vary(c, r, 5));
    }
  });
  make('cobble', (d, r) => {
    const pts = [];
    for (let i = 0; i < 10; i++) pts.push([r() * 16, r() * 16, 105 + r() * 50]);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        let d1 = 1e9, d2 = 1e9, best = 0;
        for (let i = 0; i < pts.length; i++) {
          for (let ox = -16; ox <= 16; ox += 16)
            for (let oy = -16; oy <= 16; oy += 16) {
              const dd = Math.hypot(x + 0.5 - pts[i][0] - ox, y + 0.5 - pts[i][1] - oy);
              if (dd < d1) { d2 = d1; d1 = dd; best = i; } else if (dd < d2) d2 = dd;
            }
        }
        const g = d2 - d1 < 1.1 ? 72 : pts[best][2];
        put(d, x, y, vary([g, g, g + 2], r, 7));
      }
  });
  make('dirt', (d, r) => {
    fill(d, r, [121, 85, 58], 12);
    speckle(d, r, [92, 64, 44], 0.14);
    speckle(d, r, [146, 106, 74], 0.08);
  });
  make('grass_top', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const v = (r() - 0.5) * 34;
        put(d, x, y, [92 + v * 0.6, 158 + v, 58 + v * 0.4]);
      }
    speckle(d, r, [72, 128, 44], 0.12);
    speckle(d, r, [120, 182, 76], 0.06);
  });
  make('grass_side', (d, r) => {
    copyFrom(d, 'dirt');
    for (let x = 0; x < 16; x++) {
      const depth = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
      for (let y = 0; y < depth; y++) {
        const v = (r() - 0.5) * 30;
        put(d, x, y, [92 + v * 0.6, 158 + v, 58 + v * 0.4]);
      }
      if (r() < 0.5) put(d, x, depth, [70, 122, 44]);
    }
  });
  make('sand', (d, r) => {
    fill(d, r, [222, 209, 160], 8);
    speckle(d, r, [198, 182, 136], 0.1);
    speckle(d, r, [238, 228, 190], 0.05);
  });
  make('water', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) put(d, x, y, vary([46, 98, 205], r, 8), 170);
    for (let k = 0; k < 12; k++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16), len = 2 + Math.floor(r() * 4);
      for (let i = 0; i < len; i++) put(d, (x + i) % 16, y, [84, 142, 232], 180);
    }
  });
  make('log_side', (d, r) => {
    const cols = [];
    for (let x = 0; x < 16; x++) cols.push((r() - 0.5) * 22 + (r() < 0.25 ? -26 : 0));
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const v = cols[x] + (r() - 0.5) * 10;
        put(d, x, y, [108 + v, 80 + v * 0.8, 48 + v * 0.6]);
      }
  });
  make('log_top', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dist = Math.hypot(x - 7.5, y - 7.5);
        let c;
        if (dist > 7) c = [100, 74, 44];
        else c = Math.floor(dist * 1.2) % 2 ? [182, 146, 92] : [158, 122, 76];
        put(d, x, y, vary(c, r, 6));
      }
  });
  make('leaves', (d, r) => {
    fill(d, r, [58, 124, 42], 12);
    speckle(d, r, [36, 88, 28], 0.26, 5);
    speckle(d, r, [86, 154, 58], 0.09, 5);
  });
  make('planks', (d, r) => {
    const offs = [3, 11, 6, 14];
    for (let y = 0; y < 16; y++) {
      const board = Math.floor(y / 4);
      const bv = (r() - 0.5) * 14;
      for (let x = 0; x < 16; x++) {
        let c = [176 + bv, 136 + bv, 84 + bv * 0.6];
        if (y % 4 === 3 || x === offs[board]) c = [120, 88, 52];
        put(d, x, y, vary(c, r, 6));
      }
    }
  });
  make('coal_ore', (d, r) => {
    copyFrom(d, 'stone');
    ore(d, r, [38, 38, 40], [74, 74, 78], 6);
  });
  make('iron_ore', (d, r) => {
    copyFrom(d, 'stone');
    ore(d, r, [206, 160, 124], [240, 206, 176], 6);
  });
  make('deepstone', (d, r) => {
    fill(d, r, [72, 74, 88], 9);
    for (let k = 0; k < 10; k++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16), len = 3 + Math.floor(r() * 5);
      for (let i = 0; i < len; i++) put(d, (x + i) % 16, y, vary([56, 58, 70], r, 4));
    }
  });
  make('crystal_ore', (d, r) => {
    copyFrom(d, 'deepstone');
    ore(d, r, [70, 214, 232], [214, 255, 255], 6);
  });
  make('bedrock', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const v = 34 + Math.floor(r() * 4) * 22;
        put(d, x, y, [v, v, v + 3]);
      }
  });
  make('glass', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, [214, 236, 246]);
      put(d, i, 15, [170, 200, 214]);
      put(d, 0, i, [214, 236, 246]);
      put(d, 15, i, [170, 200, 214]);
    }
    line(d, 3, 7, 7, 3, [236, 248, 255]);
    line(d, 4, 9, 9, 4, [236, 248, 255]);
    line(d, 10, 12, 12, 10, [236, 248, 255]);
  });
  make('torch', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
    for (let y = 8; y < 16; y++) {
      put(d, 7, y, [132, 94, 54]);
      put(d, 8, y, [98, 68, 40]);
    }
    put(d, 7, 6, [255, 244, 170]);
    put(d, 8, 6, [255, 214, 90]);
    put(d, 7, 7, [255, 190, 70]);
    put(d, 8, 7, [240, 140, 40]);
  });
  make('table_top', (d, r) => {
    copyFrom(d, 'planks');
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, [110, 78, 44]);
      put(d, i, 15, [110, 78, 44]);
      put(d, 0, i, [110, 78, 44]);
      put(d, 15, i, [110, 78, 44]);
    }
    for (let i = 2; i < 14; i++) {
      put(d, i, 5, [128, 94, 56]);
      put(d, i, 10, [128, 94, 56]);
      put(d, 5, i, [128, 94, 56]);
      put(d, 10, i, [128, 94, 56]);
    }
  });
  make('table_side', (d, r) => {
    copyFrom(d, 'planks');
    for (let x = 0; x < 16; x++) {
      put(d, x, 0, [150, 112, 66]);
      put(d, x, 1, [110, 78, 44]);
    }
    // scie
    for (let x = 3; x < 9; x++) {
      put(d, x, 5, [190, 190, 196]);
      put(d, x, 6, [150, 150, 158]);
    }
    for (let x = 3; x < 9; x += 2) put(d, x, 7, [150, 150, 158]);
    put(d, 9, 5, [90, 60, 32]);
    put(d, 10, 5, [90, 60, 32]);
    // marteau
    for (let y = 4; y < 12; y++) put(d, 12, y, [96, 66, 36]);
    for (let x = 10; x < 15; x++) put(d, x, 4, [150, 150, 158]);
  });
  make('table_front', (d, r) => {
    copyFrom(d, 'table_side');
    for (let y = 9; y < 14; y++) for (let x = 3; x < 8; x++) put(d, x, y, vary([88, 62, 34], r, 5));
  });
  function chestBase(d, r) {
    copyFrom(d, 'planks');
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, [96, 66, 36]); put(d, i, 15, [96, 66, 36]);
      put(d, 0, i, [96, 66, 36]); put(d, 15, i, [96, 66, 36]);
    }
  }
  make('chest_top', (d, r) => chestBase(d, r));
  make('chest_side', (d, r) => {
    chestBase(d, r);
    for (let x = 0; x < 16; x++) put(d, x, 5, [82, 56, 30]);
  });
  make('chest_front', (d, r) => {
    chestBase(d, r);
    for (let x = 0; x < 16; x++) put(d, x, 5, [82, 56, 30]);
    for (let y = 4; y < 8; y++) for (let x = 7; x < 9; x++) put(d, x, y, [200, 200, 210]);
    put(d, 7, 7, [120, 120, 130]); put(d, 8, 7, [120, 120, 130]);
  });
  make('stonebrick', (d, r) => {
    fill(d, r, [124, 124, 128], 7);
    for (let x = 0; x < 16; x++) {
      put(d, x, 7, [86, 86, 90]);
      put(d, x, 15, [86, 86, 90]);
    }
    for (let y = 0; y < 7; y++) put(d, 7, y, [86, 86, 90]);
    for (let y = 8; y < 15; y++) put(d, 15, y, [86, 86, 90]);
    for (let x = 0; x < 16; x++) {
      put(d, x, 0, vary([146, 146, 150], r, 4));
      put(d, x, 8, vary([146, 146, 150], r, 4));
    }
  });
  make('forge_side', (d, r) => {
    copyFrom(d, 'stonebrick');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = get(d, x, y);
      put(d, x, y, [c[0] * 0.85, c[1] * 0.83, c[2] * 0.83]);
    }
  });
  make('forge_front', (d, r) => {
    copyFrom(d, 'forge_side');
    for (let y = 6; y < 14; y++)
      for (let x = 4; x < 12; x++) {
        if (y === 6 && (x === 4 || x === 11)) continue;
        put(d, x, y, [26, 18, 16]);
      }
    for (let x = 4; x < 12; x++) {
      put(d, x, 13, r() < 0.5 ? [255, 190, 60] : [240, 110, 30]);
      if (r() < 0.7) put(d, x, 12, r() < 0.5 ? [255, 150, 40] : [220, 80, 20]);
      if (r() < 0.3) put(d, x, 11, [255, 220, 110]);
    }
  });
  make('forge_top', (d, r) => {
    fill(d, r, [104, 102, 102], 8);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, (x + y) % 2 ? [40, 34, 32] : [70, 60, 56]);
  });
  make('snow', (d, r) => {
    fill(d, r, [242, 246, 255], 4);
    speckle(d, r, [218, 230, 248], 0.12, 4);
  });
  make('flower', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
    for (let y = 8; y < 16; y++) put(d, 8, y, [58, 138, 40]);
    put(d, 6, 11, [70, 150, 48]); put(d, 7, 11, [70, 150, 48]);
    put(d, 9, 12, [70, 150, 48]); put(d, 10, 12, [70, 150, 48]);
    disc(d, 8, 5, 2.6, (x, y, dist) => put(d, x, y, dist > 1.8 ? [186, 28, 44] : [226, 50, 64]));
    put(d, 8, 5, [250, 220, 70]);
  });
  make('tallgrass', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
    for (let b = 0; b < 8; b++) {
      const x0 = 1 + r() * 14, h = 5 + r() * 10, lean = (r() - 0.5) * 5;
      const g = 0.8 + r() * 0.4;
      for (let y = 15; y > 15 - h; y--) {
        const t = (15 - y) / h;
        put(d, Math.round(x0 + lean * t * t), y, [74 * g, 150 * g, 50 * g]);
      }
    }
  });
  make('sapling', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
    for (let y = 9; y < 16; y++) put(d, 7 + (y > 12 ? 1 : 0), y, [110, 80, 46]);
    disc(d, 7.5, 6, 4.2, (x, y) => {
      if (r() < 0.82) put(d, x, y, vary(r() < 0.3 ? [40, 96, 32] : [62, 138, 46], r, 10));
    });
  });
  make('berrybush', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const e = ((x - 7.5) / 7.5) ** 2 + ((y - 9) / 6.5) ** 2;
        if (e < 1 && r() < 0.8) put(d, x, y, vary(r() < 0.3 ? [34, 90, 34] : [52, 118, 44], r, 10));
      }
    for (let k = 0; k < 8; k++) {
      const a = r() * Math.PI * 2, rr = r() * 5;
      const x = Math.round(7.5 + Math.cos(a) * rr), y = Math.round(9 + Math.sin(a) * rr * 0.8);
      put(d, x, y, [206, 28, 52]);
      put(d, x + 1, y, [160, 18, 40]);
      put(d, x, y - 1, [255, 130, 140]);
    }
  });
  make('lamp', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dist = Math.hypot(x - 7.5, y - 7.5);
        const t = CM.clamp(1 - dist / 9, 0, 1);
        put(d, x, y, [60 + 150 * t, 200 + 55 * t, 222 + 33 * t]);
      }
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, [70, 70, 92]); put(d, i, 15, [52, 52, 70]);
      put(d, 0, i, [70, 70, 92]); put(d, 15, i, [52, 52, 70]);
      put(d, i, 7, [80, 80, 104]); put(d, 7, i, [80, 80, 104]);
    }
  });
  make('skystone', (d, r) => {
    fill(d, r, [214, 218, 238], 7);
    speckle(d, r, [188, 184, 226], 0.16, 5);
    speckle(d, r, [255, 255, 255], 0.03, 0);
  });
  make('shard_ore', (d, r) => {
    copyFrom(d, 'skystone');
    ore(d, r, [255, 200, 64], [255, 248, 196], 6);
  });
  make('bricks', (d, r) => {
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / 4);
      for (let x = 0; x < 16; x++) {
        const mortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7;
        put(d, x, y, mortar ? vary([178, 168, 158], r, 5) : vary([158, 72, 52], r, 12));
      }
    }
  });
  function mushroomSpots(d, r) {
    const spots = [[3, 3], [10, 2], [6, 8], [12, 10], [2, 12], [8, 13]];
    for (const [sx, sy] of spots) {
      put(d, sx, sy, [246, 236, 252]);
      put(d, sx + 1, sy, [236, 222, 246]);
      put(d, sx, sy + 1, [236, 222, 246]);
      put(d, sx + 1, sy + 1, [220, 204, 232]);
    }
  }
  make('mushroom_top', (d, r) => {
    fill(d, r, [156, 58, 186], 10);
    mushroomSpots(d, r);
  });
  make('mushroom_side', (d, r) => {
    fill(d, r, [156, 58, 186], 10);
    mushroomSpots(d, r);
    for (let x = 0; x < 16; x++) {
      put(d, x, 14, [112, 36, 138]);
      put(d, x, 15, [96, 28, 118]);
    }
  });
  make('mushroom_bottom', (d, r) => {
    fill(d, r, [222, 200, 186], 6);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      line(d, 8, 8, Math.round(8 + Math.cos(a) * 8), Math.round(8 + Math.sin(a) * 8), [178, 150, 136]);
    }
    disc(d, 7.5, 7.5, 1.6, (x, y) => put(d, x, y, [200, 180, 170]));
  });
  make('dawn_heart', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dist = Math.abs(x - 7.5) + Math.abs(y - 7.5);
        const t = CM.clamp(1 - dist / 11, 0, 1);
        put(d, x, y, [236 + 19 * t, 150 + 100 * t, 40 + 170 * t]);
      }
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, [200, 110, 30]); put(d, i, 15, [170, 90, 20]);
      put(d, 0, i, [200, 110, 30]); put(d, 15, i, [170, 90, 20]);
    }
    line(d, 7, 2, 2, 7, [255, 255, 230]);
    line(d, 8, 2, 13, 7, [255, 255, 230]);
    line(d, 2, 8, 7, 13, [255, 190, 90]);
    line(d, 13, 8, 8, 13, [255, 190, 90]);
  });

  // ------------------------------------------------------- créatures -----
  make('mouflon_wool', (d, r) => {
    fill(d, r, [232, 226, 210], 8);
    for (let k = 0; k < 18; k++) {
      const x = Math.floor(r() * 15), y = Math.floor(r() * 15);
      put(d, x, y, [206, 198, 180]);
      put(d, x + 1, y, [214, 206, 190]);
    }
  });
  make('mouflon_face', (d, r) => {
    fill(d, r, [104, 80, 62], 6);
    for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) put(d, x, y, vary([232, 226, 210], r, 8));
    put(d, 3, 6, [240, 240, 240]); put(d, 4, 6, [20, 20, 20]);
    put(d, 11, 6, [20, 20, 20]); put(d, 12, 6, [240, 240, 240]);
    for (let x = 6; x < 10; x++) put(d, x, 11, [60, 42, 34]);
    put(d, 7, 10, [230, 160, 160]); put(d, 8, 10, [230, 160, 160]);
  });
  make('mouflon_skin', (d, r) => fill(d, r, [98, 76, 60], 8));
  make('mouflon_horn', (d, r) => {
    fill(d, r, [196, 176, 140], 8);
    for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x++) put(d, x, y, [160, 140, 108]);
  });
  make('ombre_body', (d, r) => {
    fill(d, r, [24, 18, 34], 5);
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(r() * 16);
      for (let y = 0; y < 16; y++) if (r() < 0.6) put(d, (x + Math.floor(y / 5)) % 16, y, [52, 28, 80]);
    }
  });
  make('ombre_face', (d, r) => {
    fill(d, r, [18, 12, 26], 4);
    for (const ex of [3, 10]) {
      put(d, ex, 6, [200, 70, 255]); put(d, ex + 1, 6, [240, 170, 255]);
      put(d, ex, 7, [160, 40, 220]); put(d, ex + 1, 7, [200, 70, 255]);
    }
    for (let x = 5; x < 11; x++) put(d, x, 11 + (x % 2), [70, 30, 100]);
  });
  make('skin', (d, r) => fill(d, r, [214, 168, 128], 5));
  make('sleeve', (d, r) => fill(d, r, [58, 110, 168], 6));
  // autres joueurs (multijoueur) : visage, cheveux, pantalon
  const HAIR = [92, 60, 34];
  make('player_face', (d, r) => {
    fill(d, r, [214, 168, 128], 5);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(HAIR, r, 8));
    for (const x of [0, 1, 14, 15]) put(d, x, 4, vary(HAIR, r, 8));
    for (const ex of [3, 10]) {
      put(d, ex, 8, [255, 255, 255]); put(d, ex + 1, 8, [255, 255, 255]);
      put(d, ex + (ex < 8 ? 1 : 0), 8, [52, 72, 150]);
      put(d, ex, 9, [230, 230, 236]); put(d, ex + 1, 9, [230, 230, 236]);
    }
    put(d, 7, 10, [190, 140, 104]); put(d, 8, 10, [190, 140, 104]);
    for (let x = 5; x < 11; x++) put(d, x, 12, [150, 86, 70]);
  });
  make('player_head', (d, r) => {
    fill(d, r, [214, 168, 128], 5);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) if (y < 4 || r() < 0.5) put(d, x, y, vary(HAIR, r, 8));
  });
  make('player_hair', (d, r) => fill(d, r, HAIR, 9));
  // golem de fer : fer patiné, fissures et lierre
  const golemBase = (d, r) => {
    fill(d, r, [196, 190, 180], 10);
    speckle(d, r, [160, 154, 146], 0.18, 8);
    line(d, 3, 2, 6, 7, [120, 114, 108]);
    line(d, 11, 9, 13, 14, [120, 114, 108]);
  };
  make('golem_body', (d, r) => {
    golemBase(d, r);
    for (let y = 0; y < 16; y++) if (r() < 0.55) put(d, 1 + (y % 3 === 0 ? 1 : 0), y, vary([74, 128, 52], r, 14));
    for (let k = 0; k < 6; k++) put(d, 1 + Math.floor(r() * 3), Math.floor(r() * 16), vary([96, 150, 70], r, 10));
  });
  make('golem_face', (d, r) => {
    golemBase(d, r);
    for (let x = 2; x < 14; x++) put(d, x, 5, [110, 104, 98]);
    for (const ex of [4, 10]) { put(d, ex, 7, [150, 30, 20]); put(d, ex + 1, 7, [120, 20, 14]); }
  });
  // villageois : visage (sourcils, yeux verts) et crâne
  make('villager_face', (d, r) => {
    fill(d, r, [190, 140, 108], 5);
    for (let x = 2; x < 14; x++) put(d, x, 5, [70, 44, 30]);
    for (const ex of [3, 10]) {
      put(d, ex, 7, [255, 255, 255]); put(d, ex + 1, 7, [60, 140, 60]);
      put(d, ex, 8, [230, 230, 230]); put(d, ex + 1, 8, [40, 100, 40]);
    }
    for (let x = 5; x < 11; x++) put(d, x, 14, [120, 70, 55]);
  });
  make('villager_head', (d, r) => {
    fill(d, r, [190, 140, 108], 5);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary([110, 72, 44], r, 8));
  });
  make('player_pants', (d, r) => {
    fill(d, r, [44, 62, 118], 7);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) if (r() < 0.3) put(d, x, y, [60, 82, 146]);
  });
  make('white', (d, r) => fill(d, r, [255, 255, 255], 0));
  make('ropeline', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) put(d, x, y, vary((x + y) % 6 < 3 ? [176, 132, 80] : [128, 92, 52], r, 6));
  });
  make('hook', (d, r) => {
    fill(d, r, [176, 178, 190], 14);
    for (let i = 0; i < 16; i++) put(d, i, i, [230, 232, 240]);
  });
  make('smoke', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, [60, 50, 70], 0);
    disc(d, 7.5, 7.5, 7, (x, y, dist) => put(d, x, y, [90, 70, 110], 255));
  });

  // ---------------------------------------------------------- fissures ---
  (function () {
    const r = CM.rng(1234);
    const pts = [];
    const seen = new Set();
    const heads = [];
    for (let b = 0; b < 6; b++) heads.push([7 + Math.floor(r() * 3) - 1, 7 + Math.floor(r() * 3) - 1]);
    for (let step = 0; step < 16; step++) {
      for (const h of heads) {
        h[0] += Math.floor(r() * 3) - 1;
        h[1] += Math.floor(r() * 3) - 1;
        h[0] = CM.clamp(h[0], 0, 15);
        h[1] = CM.clamp(h[1], 0, 15);
        const k = h[0] + ',' + h[1];
        if (!seen.has(k)) {
          seen.add(k);
          pts.push([h[0], h[1]]);
        }
      }
    }
    for (let s = 0; s < 10; s++) {
      make('crack_' + s, (d) => {
        for (let i = 0; i < 1024; i++) d[i] = 0;
        const n = Math.floor(((s + 1) / 10) * pts.length);
        for (let i = 0; i < n; i++) put(d, pts[i][0], pts[i][1], [16, 16, 16], 190);
      });
    }
  })();

  // ------------------------------------------------------------ objets ---
  function clear(d) {
    for (let i = 0; i < 1024; i++) d[i] = 0;
  }
  make('stick', (d) => {
    clear(d);
    line(d, 3, 13, 12, 4, [138, 100, 58]);
    line(d, 4, 13, 13, 4, [96, 68, 38]);
    line(d, 3, 12, 11, 4, [170, 130, 80]);
  });
  make('fiber', (d, r) => {
    clear(d);
    for (let k = 0; k < 4; k++) {
      let x = 4 + k * 2, y = 14;
      for (let i = 0; i < 11; i++) {
        put(d, x, y, [80 + k * 12, 160 - k * 8, 60]);
        y--;
        if (i % 3 === 1) x += k % 2 ? 1 : -1;
      }
    }
  });
  make('rope', (d) => {
    clear(d);
    for (let k = 0; k < 3; k++) {
      disc(d, 8, 5 + k * 3, 4.6 - k * 0.2, (x, y, dist) => {
        if (dist > 3.2) put(d, x, y, (x + y) % 2 ? [172, 132, 80] : [138, 100, 58]);
      });
    }
  });
  make('iron_ingot', (d) => {
    clear(d);
    art(d, [
      '................',
      '................',
      '................',
      '................',
      '................',
      '.....hhhhhhhh...',
      '....hHHHHHHHmd..',
      '...hHHHHHHHmmd..',
      '..hhhhhhhhhmdd..',
      '..mmmmmmmmmmdd..',
      '..mmmmmmmmmmd...',
      '..dddddddddd....',
    ], { h: [236, 236, 240], H: [214, 214, 222], m: [180, 180, 190], d: [124, 124, 136] });
  });
  make('coal', (d, r) => {
    clear(d);
    disc(d, 7.5, 8, 5.3, (x, y, dist) => {
      if (dist > 4.6 && r() < 0.4) return;
      put(d, x, y, vary(dist < 2 && x < 8 && y < 8 ? [84, 84, 90] : [40, 40, 44], r, 8));
    });
  });
  make('shadow_essence', (d, r) => {
    clear(d);
    disc(d, 7.5, 8.5, 5.5, (x, y, dist) => {
      const t = 1 - dist / 5.5;
      put(d, x, y, [50 + 150 * t, 20 + 80 * t, 80 + 170 * t]);
    });
    put(d, 6, 6, [240, 210, 255]);
    put(d, 7, 2, [150, 80, 200]);
    put(d, 8, 1, [110, 50, 160]);
  });
  make('crystal', (d) => {
    clear(d);
    art(d, [
      '................',
      '.......h........',
      '......hHm.......',
      '.....hHHmm......',
      '....hHHHmmm.....',
      '...hHHHHmmmm....',
      '..hHHHHHmmmmd...',
      '..mmmmmmmdddd...',
      '...mmmmmdddd....',
      '....mmmmddd.....',
      '.....mmmdd......',
      '......mmd.......',
      '.......d........',
    ], { h: [236, 255, 255], H: [150, 240, 250], m: [70, 200, 222], d: [30, 130, 160] });
  });
  make('sky_shard', (d) => {
    clear(d);
    art(d, [
      '................',
      '.......h........',
      '.......hm.......',
      '......hHm.......',
      '......hHm.......',
      '.hhhhhHHHmmmmm..',
      '...hHHHHHHHmm...',
      '.....hHHHHm.....',
      '....hHHmHHmm....',
      '....hHm..hmm....',
      '...hm......mm...',
      '...m........m...',
    ], { h: [255, 255, 220], H: [255, 222, 110], m: [226, 160, 40] });
  });
  make('berries', (d) => {
    clear(d);
    for (const [cx, cy] of [[5, 10], [10, 10], [7.5, 6.5]]) {
      disc(d, cx, cy, 2.6, (x, y, dist) => put(d, x, y, dist > 1.8 ? [150, 16, 40] : [210, 32, 58]));
      put(d, Math.round(cx - 1), Math.round(cy - 1), [255, 140, 150]);
    }
    line(d, 8, 3, 11, 1, [60, 130, 40]);
    put(d, 12, 2, [80, 160, 50]);
  });
  make('raw_meat', (d) => {
    clear(d);
    art(d, [
      '................',
      '................',
      '.....ffffff.....',
      '...ffmmmmmmff...',
      '..fmmmmMMmmmmf..',
      '..fmmMMMMMmmmf..',
      '.fmmmMMMMmmmmf..',
      '.fmmmmmmmmmmmf..',
      '.fmmmmmmmmmmf...',
      '..fmmmmmmmmf....',
      '...ffmmmmff.bb..',
      '.....ffff..bwb..',
      '...........bb...',
    ], { f: [244, 206, 196], m: [206, 70, 76], M: [230, 110, 116], b: [230, 226, 214], w: [255, 255, 250] });
  });
  make('cooked_meat', (d) => {
    clear(d);
    art(d, [
      '................',
      '................',
      '.....ffffff.....',
      '...ffmmmmmmff...',
      '..fmmgmmmgmmmf..',
      '..fmmmgmmmgmmf..',
      '.fmgmmmgmmmgmf..',
      '.fmmgmmmgmmmmf..',
      '.fmmmgmmmgmmf...',
      '..fmmmmmmmmf....',
      '...ffmmmmff.bb..',
      '.....ffff..bwb..',
      '...........bb...',
    ], { f: [120, 70, 36], m: [156, 92, 48], g: [96, 52, 26], b: [230, 226, 214], w: [255, 255, 250] });
  });
  make('grapple', (d) => {
    clear(d);
    art(d, [
      '...........rr...',
      '..........r..r..',
      '.........r....r.',
      '........r.......',
      '.......Hm.......',
      '.......Hm.......',
      '.......Hm.......',
      '.......Hm.......',
      '.......Hm.......',
      '..h....Hm....h..',
      '..Hm...Hm...mH..',
      '...Hm.HHmm.mH...',
      '....HHHmmmmH....',
      '......Hmm.......',
      '.......m........',
    ], { h: [236, 236, 244], H: [196, 196, 206], m: [120, 120, 134], r: [170, 128, 76] });
  });
  make('feather_charm', (d) => {
    clear(d);
    art(d, [
      '.....ss.........',
      '....s..s........',
      '....s..s........',
      '.....ss.........',
      '......g.........',
      '.....wwc........',
      '....wwwcc.......',
      '....wwwcc.......',
      '...wwwwccc......',
      '...wwwwccc......',
      '...wwwcccc......',
      '....wwccc.......',
      '....wwcc........',
      '.....qq.........',
      '......q.........',
      '.......q........',
    ], { s: [170, 130, 80], g: [230, 190, 60], w: [248, 250, 255], c: [140, 220, 240], q: [200, 200, 210] });
  });
  make('stamina_charm', (d) => {
    clear(d);
    disc(d, 7.5, 9, 6, (x, y, dist) => put(d, x, y, dist > 5 ? [150, 110, 40] : [60, 50, 40]));
    art(d, [
      '......ss........',
      '.....s..s.......',
      '................',
      '................',
      '........yy......',
      '.......yy.......',
      '......yy........',
      '.....yyyyy......',
      '........yy......',
      '.......yy.......',
      '......yy........',
      '.....y..........',
    ], { s: [170, 130, 80], y: [250, 230, 60] });
  });

  // Outils : modèles ASCII, colorés selon le matériau.
  const TOOL_ART = {
    pickaxe: [
      '................',
      '...hhhhhh.......',
      '..hHHHHHHhh.....',
      '...ddddddHHh....',
      '........ddHHh...',
      '........sSdHh...',
      '.......sS..dHh..',
      '......sS...dHh..',
      '.....sS.....dh..',
      '....sS......dh..',
      '...sS.......d...',
      '..sS............',
      '.sS.............',
      'sS..............',
    ],
    axe: [
      '................',
      '........hh......',
      '.......hHHh.....',
      '......hHHHHsS...',
      '......hHHHsS....',
      '.......dhsS.....',
      '........sS......',
      '.......sS.......',
      '......sS........',
      '.....sS.........',
      '....sS..........',
      '...sS...........',
      '..sS............',
      '.sS.............',
    ],
    shovel: [
      '................',
      '..........hhh...',
      '.........hHHHh..',
      '........hHHHHh..',
      '........hHHHh...',
      '........dhhd....',
      '.......sS.......',
      '......sS........',
      '.....sS.........',
      '....sS..........',
      '...sS...........',
      '..sS............',
      '.sS.............',
      'sS..............',
    ],
    sword: [
      '................',
      '.............hh.',
      '............hHh.',
      '...........hHh..',
      '..........hHh...',
      '.........hHh....',
      '........hHh.....',
      '.......hHh......',
      '..g...hHh.......',
      '...g.hHh........',
      '....gHh.........',
      '....sg..........',
      '...sS.g.........',
      '..sS............',
      '.ss.............',
    ],
  };
  TOOL_ART.hoe = [
    '................',
    '.....hhhhhh.....',
    '....hHHHHHHh....',
    '....ddd..sSh....',
    '........sS......',
    '.......sS.......',
    '......sS........',
    '.....sS.........',
    '....sS..........',
    '...sS...........',
    '..sS............',
    '.sS.............',
    'sS..............',
  ];
  // Un outil par type et par matériau (bois, pierre, fer, cristal, or, diamant, netherite).
  for (const type of Object.keys(TOOL_ART)) {
    for (const m of CM.TOOL_MATS) {
      make(type + '_' + m.key.toLowerCase(), (d) => {
        clear(d);
        const pal = Object.assign({ s: [138, 100, 58], S: [96, 68, 38], g: [90, 70, 50] }, m.color);
        if (m.key === 'NETHERITE') pal.g = [150, 110, 60];
        art(d, TOOL_ART[type], pal);
      });
    }
  }

  // armures : icônes (contour sombre, couleur du matériau) et « peau » unie pour les joueurs qui la portent
  const ARMOR_ART = {"HELMET": ["", "", "", "....oooooooo....", "...oHHhhhhhhdo..", "..oHhhhhhhhhhdo.", "..ohhhhhhhhhhdo.", "..ohhoooooohhdo.", "..ohho....ohhdo.", "..oddo....oddo..", "..oooo....oooo.."], "CHESTPLATE": ["", "..oooo....oooo..", ".oHhho....ohhdo.", ".ohhhoooooohhdo.", ".ohhhhhhhhhhhdo.", ".oooohhhhhhdooo.", "....oHhhhhhdo...", "....ohhhhhhdo...", "....ohhhhhhdo...", "....ohhhhhhdo...", "....oddddddddo..", "....oooooooooo.."], "LEGGINGS": ["", "", "...ooooooooooo..", "...oHhhhhhhhdo..", "...ohhhhhhhhdo..", "...ohhhoohhhdo..", "...ohhho.ohhdo..", "...ohhho.ohhdo..", "...ohhho.ohhdo..", "...ohhho.ohhdo..", "...odddo.oddo...", "...ooooo.oooo..."], "BOOTS": ["", "", "", "", "", "..oooo....oooo..", "..oHho....oHho..", "..ohho....ohho..", "..ohho....ohho..", ".oohhoo..oohhoo.", ".ohhhdo..ohhhdo.", ".odddddo.odddddo", ".oooooooooooooo."]};
  for (const m of CM.ARMOR_MATS) {
    const pal = Object.assign({ o: m.color.d.map((v) => v * 0.42) }, m.color);
    for (const [pk] of CM.ARMOR_PIECES) make('armor_' + pk.toLowerCase() + '_' + m.key.toLowerCase(), (d) => {
      clear(d);
      art(d, ARMOR_ART[pk], pal);
    });
    make('armor_skin_' + m.key.toLowerCase(), (d, r) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(y < 2 || x === 0 ? m.color.H : y > 13 || x === 15 ? m.color.d : m.color.h, r, 6));
      for (let x = 2; x < 14; x += 4) put(d, x, 3, m.color.H);
    });
  }

  // ======================================================= variété (v3) ===
  const INGOT_ROWS = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....hhhhhhhh...',
    '....hHHHHHHHmd..',
    '...hHHHHHHHmmd..',
    '..hhhhhhhhhmdd..',
    '..mmmmmmmmmmdd..',
    '..mmmmmmmmmmd...',
    '..dddddddddd....',
  ];
  const GEM_ROWS = [
    '................',
    '.......h........',
    '......hHm.......',
    '.....hHHmm......',
    '....hHHHmmm.....',
    '...hHHHHmmmm....',
    '..hHHHHHmmmmd...',
    '..mmmmmmmdddd...',
    '...mmmmmdddd....',
    '....mmmmddd.....',
    '.....mmmdd......',
    '......mmd.......',
    '.......d........',
  ];
  const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const pal4 = (c) => ({ h: shade(c, 1.35), H: shade(c, 1.15), m: c, d: shade(c, 0.65) });

  // ---- essences de bois : écorce, cerne, planches, feuilles, pousse ----
  function woodSet(t, p) {
    make(t + '_log_side', (d, r) => {
      const cols = [];
      for (let x = 0; x < 16; x++) cols.push((r() - 0.5) * 20 + (r() < 0.25 ? -22 : 0));
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const v = cols[x] + (r() - 0.5) * 10;
          put(d, x, y, [p.bark[0] + v, p.bark[1] + v * 0.85, p.bark[2] + v * 0.7]);
        }
      if (p.style === 'birch') {
        for (let k = 0; k < 9; k++) {
          const x = Math.floor(r() * 14), y = Math.floor(r() * 16), len = 2 + Math.floor(r() * 3);
          for (let i = 0; i < len; i++) put(d, x + i, y, vary([40, 40, 38], r, 8));
        }
      } else if (p.style === 'crystal') {
        for (let k = 0; k < 3; k++) {
          let x = Math.floor(r() * 16);
          for (let y = 0; y < 16; y++) {
            put(d, x, y, [110, 230, 250]);
            if (r() < 0.3) x = (x + (r() < 0.5 ? 15 : 1)) % 16;
          }
        }
      } else if (p.style === 'jungle') {
        speckle(d, r, [70, 110, 40], 0.08, 6);
      } else if (p.style === 'stem') {
        if (p.stemSpeck) speckle(d, r, p.stemSpeck, 0.1, 10);
        for (let k = 0; k < 3; k++) {
          const x = Math.floor(r() * 16);
          for (let y = 0; y < 16; y++) put(d, x, y, vary(shade(p.bark, 1.3), r, 8));
        }
      }
    });
    make(t + '_log_top', (d, r) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const dist = Math.hypot(x - 7.5, y - 7.5);
          const c = dist > 7 ? p.bark : Math.floor(dist * 1.2) % 2 ? p.ring1 : p.ring2;
          put(d, x, y, vary(c, r, 6));
        }
    });
    make(t + '_planks', (d, r) => {
      const offs = [3, 11, 6, 14];
      for (let y = 0; y < 16; y++) {
        const board = Math.floor(y / 4);
        const bv = (r() - 0.5) * 14;
        for (let x = 0; x < 16; x++) {
          let c = [p.plank[0] + bv, p.plank[1] + bv, p.plank[2] + bv * 0.6];
          if (y % 4 === 3 || x === offs[board]) c = shade(p.plank, 0.7);
          put(d, x, y, vary(c, r, 6));
        }
      }
    });
    make(t + '_leaves', (d, r) => {
      fill(d, r, p.leaf, 12);
      if (p.leafStyle === 'wart') {
        for (let y = 0; y < 16; y += 2)
          for (let x = 0; x < 16; x += 2) {
            const c = vary(shade(p.leaf, 0.75 + r() * 0.5), r, 6);
            put(d, x, y, c); put(d, x + 1, y, c); put(d, x, y + 1, shade(c, 0.9)); put(d, x + 1, y + 1, shade(c, 0.9));
          }
        return;
      }
      if (p.leafStyle === 'blossom') {
        speckle(d, r, shade(p.leaf, 0.8), 0.2, 6);
        speckle(d, r, [250, 214, 230], 0.12, 5);
        speckle(d, r, [90, 140, 60], 0.05, 5);
        return;
      }
      if (p.leafStyle === 'needles') {
        for (let y = 0; y < 16; y += 2) for (let x = (y / 2) % 2; x < 16; x += 2) put(d, x, y, vary(shade(p.leaf, 0.65), r, 6));
      } else speckle(d, r, shade(p.leaf, 0.62), 0.26, 5);
      speckle(d, r, shade(p.leaf, 1.3), p.leafStyle === 'crystal' ? 0.14 : 0.08, 5);
      if (p.leafStyle === 'crystal') speckle(d, r, [235, 255, 255], 0.05, 0);
    });
    make(t + '_sapling', (d, r) => {
      clear(d);
      if (p.sapling === 'fungus') {
        for (let y = 9; y < 16; y++) { put(d, 7, y, [220, 200, 170]); put(d, 8, y, [196, 176, 150]); }
        for (let y = 4; y < 9; y++) for (let x = 3; x < 13; x++) {
          if (y === 4 && (x < 5 || x > 10)) continue;
          put(d, x, y, vary(p.cap, r, 12));
        }
        put(d, 6, 5, shade(p.cap, 1.4)); put(d, 10, 6, shade(p.cap, 1.4));
        return;
      }
      for (let y = 9; y < 16; y++) put(d, 7 + (y > 12 ? 1 : 0), y, p.bark);
      if (p.leafStyle === 'needles') {
        for (let y = 1; y < 12; y++) {
          const w = Math.floor((y % 4) + y / 4);
          for (let x = 8 - w; x <= 7 + w; x++) if (r() < 0.85) put(d, x, y, vary(p.leaf, r, 10));
        }
      } else {
        disc(d, 7.5, 6, 4.2, (x, y) => {
          if (r() < 0.82) put(d, x, y, vary(r() < 0.3 ? shade(p.leaf, 0.7) : p.leaf, r, 10));
        });
      }
    });
  }
  woodSet('birch', { bark: [218, 216, 206], ring1: [214, 198, 150], ring2: [190, 172, 124], plank: [206, 188, 134], leaf: [104, 156, 70], style: 'birch' });
  woodSet('spruce', { bark: [72, 52, 32], ring1: [150, 112, 70], ring2: [120, 88, 52], plank: [114, 84, 52], leaf: [46, 88, 62], leafStyle: 'needles' });
  woodSet('acacia', { bark: [106, 100, 92], ring1: [196, 104, 54], ring2: [170, 86, 44], plank: [174, 92, 52], leaf: [112, 142, 48] });
  woodSet('jungle', { bark: [98, 78, 40], ring1: [178, 128, 82], ring2: [150, 104, 64], plank: [162, 116, 82], leaf: [46, 142, 32], style: 'jungle' });
  woodSet('willow', { bark: [92, 84, 64], ring1: [168, 158, 112], ring2: [140, 130, 92], plank: [152, 146, 104], leaf: [86, 128, 62] });
  woodSet('crystal', { bark: [72, 52, 120], ring1: [170, 140, 230], ring2: [130, 104, 200], plank: [150, 124, 206], leaf: [120, 196, 238], style: 'crystal', leafStyle: 'crystal' });

  // ---- variantes d'herbe ----
  function grassSet(t, top, sideBand, opts) {
    opts = opts || {};
    make(t + '_top', (d, r) => {
      if (opts.topFrom) copyFrom(d, opts.topFrom);
      else {
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const v = (r() - 0.5) * 30;
            put(d, x, y, [top[0] + v * 0.6, top[1] + v, top[2] + v * 0.4]);
          }
        speckle(d, r, shade(top, 0.78), 0.12);
        if (opts.speck) speckle(d, r, opts.speck, 0.1, 6);
      }
    });
    make(t + '_side', (d, r) => {
      copyFrom(d, 'dirt');
      for (let x = 0; x < 16; x++) {
        const depth = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
        for (let y = 0; y < depth; y++) put(d, x, y, vary(sideBand, r, 12));
        if (r() < 0.5) put(d, x, depth, shade(sideBand, 0.75));
      }
    });
  }
  grassSet('snowy_grass', null, [236, 242, 252], { topFrom: 'snow' });
  grassSet('dry_grass', [168, 164, 78], [150, 148, 70]);
  grassSet('lush_grass', [66, 176, 44], [62, 160, 40]);
  grassSet('swamp_grass', [86, 104, 52], [80, 96, 48]);
  grassSet('podzol', [112, 80, 44], [104, 74, 40], { speck: [150, 98, 50] });
  grassSet('crystal_moss', [124, 96, 196], [112, 88, 184], { speck: [120, 230, 240] });

  // ---- roches, sables, argiles ----
  make('sandstone_top', (d, r) => {
    fill(d, r, [216, 200, 150], 5);
    speckle(d, r, [200, 184, 134], 0.08, 4);
  });
  make('sandstone_side', (d, r) => {
    for (let y = 0; y < 16; y++) {
      const band = y < 3 ? [226, 212, 162] : y > 12 ? [196, 178, 128] : [214, 198, 148];
      for (let x = 0; x < 16; x++) put(d, x, y, vary(band, r, 5));
    }
    for (let x = 0; x < 16; x++) put(d, x, 3, [190, 172, 124]);
  });
  make('carved_sandstone', (d, r) => {
    copyFrom(d, 'sandstone_side');
    for (let i = 2; i < 14; i++) {
      put(d, i, 2, [180, 160, 112]); put(d, i, 13, [180, 160, 112]);
      put(d, 2, i, [180, 160, 112]); put(d, 13, i, [180, 160, 112]);
    }
    line(d, 5, 5, 10, 10, [170, 150, 104]);
    line(d, 10, 5, 5, 10, [170, 150, 104]);
    disc(d, 7.5, 7.5, 1.2, (x, y) => put(d, x, y, [196, 176, 126]));
  });
  make('red_sand', (d, r) => {
    fill(d, r, [190, 104, 52], 8);
    speckle(d, r, [166, 86, 40], 0.12);
    speckle(d, r, [214, 128, 70], 0.06);
  });
  make('red_sandstone_top', (d, r) => {
    fill(d, r, [182, 98, 46], 5);
    speckle(d, r, [160, 84, 38], 0.08, 4);
  });
  make('red_sandstone_side', (d, r) => {
    for (let y = 0; y < 16; y++) {
      const band = y < 3 ? [194, 108, 52] : y > 12 ? [160, 82, 36] : [180, 96, 44];
      for (let x = 0; x < 16; x++) put(d, x, y, vary(band, r, 5));
    }
    for (let x = 0; x < 16; x++) put(d, x, 3, [150, 76, 34]);
  });
  const TERRA = { terracotta: [160, 92, 64], terracotta_red: [142, 60, 46], terracotta_yellow: [186, 134, 54], terracotta_brown: [98, 66, 46], terracotta_white: [206, 176, 160] };
  for (const [name, c] of Object.entries(TERRA)) {
    make(name, (d, r) => {
      fill(d, r, c, 4);
      speckle(d, r, shade(c, 0.9), 0.1, 3);
    });
  }
  make('gravel', (d, r) => {
    fill(d, r, [128, 122, 118], 10);
    for (let k = 0; k < 22; k++) {
      const x = Math.floor(r() * 15), y = Math.floor(r() * 15);
      const c = r() < 0.5 ? [96, 90, 88] : r() < 0.5 ? [160, 154, 150] : [118, 100, 86];
      put(d, x, y, c); put(d, x + 1, y, shade(c, 0.9)); put(d, x, y + 1, shade(c, 0.85));
    }
  });
  make('clay', (d, r) => {
    fill(d, r, [160, 166, 180], 4);
    for (let k = 0; k < 6; k++) {
      const y = Math.floor(r() * 16), x = Math.floor(r() * 12);
      for (let i = 0; i < 4; i++) put(d, x + i, y, [146, 152, 166]);
    }
  });
  make('mud', (d, r) => {
    fill(d, r, [70, 56, 46], 7);
    speckle(d, r, [54, 42, 34], 0.15, 4);
    speckle(d, r, [104, 90, 78], 0.05, 4);
  });
  make('ice', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary([150, 196, 246], r, 6), 200);
    line(d, 2, 12, 7, 7, [226, 244, 255, 220]);
    line(d, 7, 7, 13, 5, [226, 244, 255, 220]);
    line(d, 9, 14, 14, 10, [200, 230, 255, 220]);
  });
  function rock(name, base, ...specks) {
    make(name, (d, r) => {
      fill(d, r, base, 7);
      for (const [c, p] of specks) speckle(d, r, c, p, 5);
    });
  }
  rock('granite', [154, 106, 88], [[120, 80, 66], 0.2], [[186, 140, 122], 0.12], [[90, 60, 52], 0.05]);
  rock('diorite', [196, 196, 194], [[140, 140, 140], 0.14], [[230, 230, 228], 0.12], [[90, 90, 92], 0.05]);
  rock('andesite', [134, 134, 136], [[112, 112, 116], 0.2], [[158, 158, 160], 0.14]);
  function polished(name, from) {
    make(name, (d, r) => {
      copyFrom(d, from);
      // lisse la pierre : chaque pixel se rapproche de la couleur moyenne
      const avg = [0, 0, 0];
      for (let i = 0; i < 256; i++) for (let k = 0; k < 3; k++) avg[k] += d[i * 4 + k] / 256;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const c = get(d, x, y);
          put(d, x, y, [avg[0] + (c[0] - avg[0]) * 0.35, avg[1] + (c[1] - avg[1]) * 0.35, avg[2] + (c[2] - avg[2]) * 0.35]);
        }
      for (let i = 0; i < 16; i++) {
        put(d, i, 0, shade(get(d, i, 0), 1.18)); put(d, 0, i, shade(get(d, 0, i), 1.18));
        put(d, i, 15, shade(get(d, i, 15), 0.7)); put(d, 15, i, shade(get(d, 15, i), 0.7));
      }
    });
  }
  polished('polished_granite', 'granite');
  polished('polished_diorite', 'diorite');
  polished('polished_andesite', 'andesite');
  function mossy(name, from) {
    make(name, (d, r) => {
      copyFrom(d, from);
      for (let k = 0; k < 5; k++) {
        const cx = r() * 16, cy = r() * 16, rad = 1.5 + r() * 2.5;
        disc(d, cx, cy, rad, (x, y) => {
          if (r() < 0.75) put(d, x, y, vary([74, 116, 50], r, 12));
        });
      }
    });
  }
  mossy('mossy_cobble', 'cobble');
  mossy('mossy_stonebrick', 'stonebrick');

  // ---- plantes ----
  make('cactus_side', (d, r) => {
    fill(d, r, [66, 130, 50], 8);
    for (let y = 0; y < 16; y++) {
      put(d, 0, y, [44, 96, 36]); put(d, 15, y, [44, 96, 36]);
      put(d, 4, y, [54, 112, 42]); put(d, 11, y, [54, 112, 42]);
    }
    for (let k = 0; k < 8; k++) put(d, 2 + Math.floor(r() * 12), Math.floor(r() * 16), [226, 222, 180]);
  });
  make('cactus_top', (d, r) => {
    fill(d, r, [80, 146, 58], 8);
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, [44, 96, 36]); put(d, i, 15, [44, 96, 36]); put(d, 0, i, [44, 96, 36]); put(d, 15, i, [44, 96, 36]);
    }
    disc(d, 7.5, 7.5, 2, (x, y) => put(d, x, y, [110, 170, 80]));
  });
  make('dead_bush', (d, r) => {
    clear(d);
    const c = [124, 88, 48];
    line(d, 8, 15, 8, 8, c);
    line(d, 8, 10, 4, 5, c);
    line(d, 8, 9, 12, 4, c);
    line(d, 8, 12, 12, 9, c);
    line(d, 5, 6, 3, 3, c);
    line(d, 11, 5, 13, 2, c);
  });
  make('fern', (d, r) => {
    clear(d);
    for (const [x0, lean] of [[7, -4], [8, 3], [6, -1], [9, 1]]) {
      for (let y = 15; y > 3; y--) {
        const t = (15 - y) / 12;
        const x = Math.round(x0 + lean * t * t);
        put(d, x, y, vary([58, 128, 44], r, 10));
        if (y % 2 === 0) {
          put(d, x - 1, y, [50, 112, 38]);
          put(d, x + 1, y, [70, 146, 54]);
        }
      }
    }
  });
  function flowerTex(name, petal, center) {
    make(name, (d, r) => {
      clear(d);
      for (let y = 8; y < 16; y++) put(d, 8, y, [58, 138, 40]);
      put(d, 7, 12, [70, 150, 48]); put(d, 9, 11, [70, 150, 48]);
      disc(d, 8, 5.5, 2.6, (x, y, dist) => put(d, x, y, dist > 1.8 ? shade(petal, 0.8) : petal));
      put(d, 8, 5, center); put(d, 8, 6, center);
    });
  }
  flowerTex('dandelion', [250, 214, 40], [230, 170, 20]);
  flowerTex('cornflower', [70, 110, 230], [40, 60, 150]);
  flowerTex('tulip', [242, 124, 36], [196, 80, 20]);
  flowerTex('daisy', [246, 246, 240], [236, 196, 40]);
  make('crystal_flower', (d, r) => {
    clear(d);
    for (let y = 9; y < 16; y++) put(d, 8, y, [90, 70, 150]);
    art(d, [
      '................',
      '.......h........',
      '......hHm.......',
      '...h..hHm..h....',
      '...Hm.hHm.Hm....',
      '....HmhHmHm.....',
      '.....HHHHm......',
      '......Hmm.......',
    ], { h: [236, 255, 255], H: [130, 230, 250], m: [90, 150, 230] });
  });
  function shroomTex(name, cap, spots) {
    make(name, (d, r) => {
      clear(d);
      for (let y = 10; y < 16; y++) { put(d, 7, y, [226, 214, 196]); put(d, 8, y, [206, 192, 172]); }
      for (let y = 6; y < 10; y++) for (let x = 4; x < 12; x++) {
        if ((y === 6 && (x < 6 || x > 9))) continue;
        put(d, x, y, vary(cap, r, 8));
      }
      if (spots) { put(d, 6, 7, [250, 250, 250]); put(d, 9, 8, [250, 250, 250]); put(d, 8, 6, [250, 250, 250]); }
    });
  }
  shroomTex('red_shroom', [200, 34, 34], true);
  shroomTex('brown_shroom', [150, 106, 72], false);
  make('melon_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(x % 4 < 2 ? [90, 150, 40] : [120, 176, 56], r, 8));
  });
  make('melon_top', (d, r) => {
    fill(d, r, [110, 164, 50], 8);
    disc(d, 7.5, 7.5, 2, (x, y) => put(d, x, y, [80, 120, 40]));
  });
  make('pumpkin_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(x % 5 === 0 ? [186, 100, 20] : [226, 136, 32], r, 8));
  });
  make('pumpkin_top', (d, r) => {
    fill(d, r, [210, 124, 28], 8);
    for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) put(d, x, y, [96, 76, 36]);
  });
  make('jack_face', (d, r) => {
    copyFrom(d, 'pumpkin_side');
    const glow = [255, 222, 90];
    art(d, [
      '................',
      '................',
      '................',
      '...gg......gg...',
      '...ggg....ggg...',
      '................',
      '.......gg.......',
      '................',
      '..gggggggggggg..',
      '..g.gggggggg.g..',
      '....gg....gg....',
    ], { g: glow });
  });

  // ---- minerais et blocs de métal ----
  make('copper_ore', (d, r) => {
    copyFrom(d, 'stone');
    ore(d, r, [206, 116, 72], [236, 170, 120], 6);
    speckle(d, r, [90, 170, 150], 0.03, 0);
  });
  make('gold_ore', (d, r) => {
    copyFrom(d, 'stone');
    ore(d, r, [236, 196, 60], [255, 240, 150], 6);
  });
  make('ruby_ore', (d, r) => {
    copyFrom(d, 'stone');
    ore(d, r, [206, 30, 60], [255, 140, 160], 5);
  });
  function metalBlock(name, c) {
    make(name, (d, r) => {
      fill(d, r, c, 5);
      for (let i = 0; i < 16; i++) {
        put(d, i, 0, shade(c, 1.25)); put(d, 0, i, shade(c, 1.25));
        put(d, i, 15, shade(c, 0.7)); put(d, 15, i, shade(c, 0.7));
      }
      line(d, 3, 3, 7, 3, shade(c, 1.3));
      line(d, 3, 4, 5, 4, shade(c, 1.2));
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) put(d, x, y, shade(c, 0.6));
    });
  }
  metalBlock('copper_block', [196, 110, 66]);
  metalBlock('gold_block', [240, 200, 60]);
  metalBlock('iron_block', [210, 210, 216]);
  metalBlock('coal_block', [34, 34, 38]);
  function gemBlock(name, c) {
    make(name, (d, r) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const f = ((x + y) % 8 < 4 ? 1.1 : 0.9) * (x % 8 === 0 || y % 8 === 0 ? 0.75 : 1);
          put(d, x, y, vary(shade(c, f), r, 6));
        }
      speckle(d, r, [255, 255, 255], 0.03, 0);
    });
  }
  gemBlock('crystal_block', [90, 210, 230]);
  gemBlock('ruby_block', [190, 30, 56]);
  make('lantern_side', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const t = CM.clamp(1 - Math.hypot(x - 7.5, y - 8) / 8, 0, 1);
        put(d, x, y, [255, 170 + 80 * t, 70 + 150 * t]);
      }
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, [150, 84, 50]); put(d, i, 15, [150, 84, 50]);
      put(d, 0, i, [170, 96, 58]); put(d, 15, i, [130, 72, 42]);
      put(d, i, 5, [170, 96, 58]); put(d, 7, i, [170, 96, 58]); put(d, 8, i, [150, 84, 50]);
    }
  });
  make('lantern_top', (d, r) => {
    fill(d, r, [170, 96, 58], 6);
    disc(d, 7.5, 7.5, 2.5, (x, y) => put(d, x, y, [255, 230, 150]));
  });

  // ---- objets ----
  make('apple', (d, r) => {
    clear(d);
    disc(d, 7.5, 9, 5, (x, y, dist) => put(d, x, y, dist > 4 ? [150, 16, 24] : [214, 36, 40]));
    put(d, 5, 7, [255, 150, 150]); put(d, 6, 6, [255, 190, 190]);
    line(d, 8, 4, 9, 2, [96, 66, 36]);
    put(d, 10, 2, [70, 150, 48]); put(d, 11, 3, [70, 150, 48]);
  });
  make('golden_apple', (d, r) => {
    clear(d);
    disc(d, 7.5, 9, 5, (x, y, dist) => put(d, x, y, dist > 4 ? [196, 146, 20] : [250, 214, 60]));
    put(d, 5, 7, [255, 250, 210]); put(d, 6, 6, [255, 255, 240]);
    line(d, 8, 4, 9, 2, [96, 66, 36]);
    put(d, 10, 2, [70, 150, 48]); put(d, 11, 3, [70, 150, 48]);
  });
  make('melon_slice', (d, r) => {
    clear(d);
    for (let y = 4; y < 14; y++)
      for (let x = 2; x < 14; x++) {
        if (y - 4 < Math.abs(x - 7.5) * 0.9) continue;
        const edge = y >= 12;
        put(d, x, y, edge ? [70, 140, 40] : y === 11 ? [236, 236, 200] : [226, 60, 60]);
      }
    for (const [x, y] of [[6, 8], [9, 9], [7, 10], [10, 7]]) put(d, x, y, [30, 20, 20]);
  });
  make('mushroom_stew', (d, r) => {
    clear(d);
    for (let y = 8; y < 14; y++) for (let x = 2; x < 14; x++) {
      if (y === 13 && (x < 4 || x > 11)) continue;
      put(d, x, y, y === 8 ? [196, 140, 90] : [136, 92, 54]);
    }
    for (let x = 3; x < 13; x++) put(d, x, 7, [170, 110, 70]);
    put(d, 5, 7, [200, 40, 40]); put(d, 9, 7, [220, 200, 170]);
  });
  make('copper_ingot', (d) => { clear(d); art(d, INGOT_ROWS, pal4([200, 112, 70])); });
  make('gold_ingot', (d) => { clear(d); art(d, INGOT_ROWS, pal4([230, 186, 50])); });
  make('ruby', (d) => { clear(d); art(d, GEM_ROWS, pal4([196, 30, 60])); });
  make('feather', (d, r) => {
    clear(d);
    line(d, 3, 13, 12, 2, [200, 200, 210]);
    for (let k = 0; k < 9; k++) {
      const x = 4 + k, y = 12 - k;
      line(d, x, y - 1, x + 2, y + 1, [246, 248, 255]);
      put(d, x - 1, y - 1, [226, 232, 244]);
    }
  });
  make('ruby_charm', (d) => {
    clear(d);
    disc(d, 7.5, 9.5, 5.5, (x, y, dist) => put(d, x, y, dist > 4.5 ? [220, 170, 50] : [60, 40, 30]));
    art(d, [
      '......ss........',
      '.....s..s.......',
      '................',
      '................',
      '................',
      '.......h........',
      '......hHm.......',
      '.....hHHmm......',
      '.....mmmdd......',
      '......mdd.......',
      '.......d........',
    ], Object.assign({ s: [170, 130, 80] }, pal4([200, 30, 60])));
  });
  make('pumpkin_pie', (d, r) => {
    clear(d);
    for (let y = 7; y < 13; y++) for (let x = 2; x < 14; x++) put(d, x, y, y < 9 ? [226, 140, 50] : [200, 150, 90]);
    for (let x = 2; x < 14; x++) { put(d, x, 7, [236, 196, 130]); put(d, x, 12, [170, 110, 60]); }
  });

  // ---- nouvelles créatures ----
  make('boar_hide', (d, r) => {
    fill(d, r, [96, 70, 50], 10);
    for (let k = 0; k < 30; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [66, 48, 34]);
  });
  make('boar_face', (d, r) => {
    fill(d, r, [104, 76, 54], 8);
    put(d, 4, 5, [20, 20, 20]); put(d, 11, 5, [20, 20, 20]);
    for (let y = 9; y < 14; y++) for (let x = 5; x < 11; x++) put(d, x, y, [196, 140, 120]);
    put(d, 6, 11, [90, 50, 40]); put(d, 9, 11, [90, 50, 40]);
  });
  make('boar_tusk', (d, r) => fill(d, r, [236, 230, 210], 5));
  make('penguin_body', (d, r) => fill(d, r, [30, 32, 40], 5));
  make('penguin_belly', (d, r) => {
    fill(d, r, [30, 32, 40], 5);
    disc(d, 7.5, 9, 6.5, (x, y) => put(d, x, y, vary([236, 238, 242], r, 5)));
  });
  make('penguin_face', (d, r) => {
    fill(d, r, [30, 32, 40], 5);
    for (let y = 6; y < 14; y++) for (let x = 3; x < 13; x++) put(d, x, y, [236, 238, 242]);
    put(d, 5, 7, [10, 10, 10]); put(d, 10, 7, [10, 10, 10]);
  });
  make('penguin_beak', (d, r) => fill(d, r, [240, 150, 40], 6));

  // ============================================= nouveaux blocs (v4) ===
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const WHITE = [255, 255, 255], BLACKC = [0, 0, 0];
  function border(d, c1, c2) {
    for (let i = 0; i < 16; i++) {
      put(d, i, 0, c1); put(d, 0, i, c1);
      put(d, i, 15, c2); put(d, 15, i, c2);
    }
  }
  function crackLines(d, r, c, n) {
    for (let k = 0; k < n; k++) {
      let x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      const len = 4 + Math.floor(r() * 6);
      for (let i = 0; i < len; i++) {
        put(d, x, y, c);
        if (r() < 0.5) x += r() < 0.5 ? -1 : 1;
        else y += r() < 0.5 ? -1 : 1;
      }
    }
  }
  function cellNoise(d, r, n, fn) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([r() * 16, r() * 16, r()]);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        let d1 = 1e9, d2 = 1e9, best = 0;
        for (let i = 0; i < pts.length; i++)
          for (let ox = -16; ox <= 16; ox += 16)
            for (let oy = -16; oy <= 16; oy += 16) {
              const dd = Math.hypot(x + 0.5 - pts[i][0] - ox, y + 0.5 - pts[i][1] - oy);
              if (dd < d1) { d2 = d1; d1 = dd; best = i; } else if (dd < d2) d2 = dd;
            }
        fn(x, y, pts[best][2], d2 - d1, d1);
      }
  }

  // Générateurs utilisés par les descriptions de CM.TEXSPEC (voir blocks.js).
  const GEN = {
    // porte : s.half 0 (bas, panneaux + poignée), 1 (haut, vitrée), 2 (icône complète)
    door(d, r, s) {
      const c = s.c, dark = shade(s.c, 0.62), mid = shade(s.c, 0.82);
      const plank = (x0, x1, y0, y1) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(d, x, y, vary(x % 4 === 0 ? mid : c, r, 7));
      };
      const glass = (x0, x1, y0, y1) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(d, x, y, vary([176, 210, 226], r, 6));
      };
      if (s.half === 2) {
        for (let i = 0; i < 1024; i++) d[i] = 0;
        plank(4, 11, 0, 15);
        for (let y = 0; y < 16; y++) { put(d, 4, y, dark); put(d, 11, y, dark); }
        for (let x = 4; x <= 11; x++) { put(d, x, 0, dark); put(d, x, 15, dark); put(d, x, 7, dark); }
        glass(6, 9, 2, 5);
        put(d, 10, 9, [60, 60, 66]); put(d, 10, 10, [90, 90, 96]);
        return;
      }
      plank(0, 15, 0, 15);
      for (let i = 0; i < 16; i++) { put(d, 0, i, dark); put(d, 15, i, dark); }
      if (s.half === 1) {
        for (let x = 0; x < 16; x++) put(d, x, 0, dark);
        glass(3, 7, 3, 7); glass(9, 13, 3, 7); glass(3, 7, 9, 12); glass(9, 13, 9, 12);
        for (let x = 2; x <= 14; x++) { put(d, x, 2, dark); put(d, x, 8, dark); put(d, x, 13, dark); }
        for (let y = 2; y <= 13; y++) { put(d, 2, y, dark); put(d, 8, y, dark); put(d, 14, y, dark); }
      } else {
        for (let x = 0; x < 16; x++) put(d, x, 15, dark);
        for (const [x0, x1, y0, y1] of [[3, 7, 3, 12], [9, 13, 3, 12]]) {
          for (let x = x0; x <= x1; x++) { put(d, x, y0, dark); put(d, x, y1, shade(s.c, 1.12)); }
          for (let y = y0; y <= y1; y++) { put(d, x0, y, dark); put(d, x1, y, shade(s.c, 1.12)); }
        }
        put(d, 12, 0, [70, 70, 76]); put(d, 12, 1, [110, 110, 116]); put(d, 13, 1, [70, 70, 76]);
      }
    },
    // lit : dessus (couverture rouge et oreiller) ou côté (couverture sur le cadre en bois)
    bed(d, r, s) {
      const red = [168, 36, 40], wood = [150, 110, 66];
      if (s.part === 0) {
        fill(d, r, red, 8);
        for (let y = 1; y < 5; y++) for (let x = 1; x < 15; x++) put(d, x, y, vary([236, 234, 228], r, 5));
        for (let x = 0; x < 16; x++) put(d, x, 6, shade(red, 0.8));
      } else {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(y < 9 ? red : wood, r, 7));
        for (let x = 0; x < 16; x++) put(d, x, 9, shade(wood, 0.7));
        for (let y = 10; y < 16; y++) for (let x = 3; x < 13; x++) put(d, x, y, [0, 0, 0, 0]);
      }
    },
    // cultures : kind (carrot, potato, beetroot, pumpkin, melon), stage 0..3
    crop(d, r, s) {
      clear(d);
      const st = s.stage;
      if (s.kind === 'pumpkin' || s.kind === 'melon') {
        // tige qui s'allonge, puis jaunit (citrouille) ou reste verte (pastèque) une fois adulte
        const h = [5, 8, 11, 13][st];
        const col = st === 3 ? (s.kind === 'pumpkin' ? [196, 170, 60] : [150, 176, 60]) : [96, 170, 60];
        for (let y = 15; y > 15 - h; y--) put(d, 7 + ((y >> 2) & 1), y, vary(col, r, 10));
        for (let k = 1; k <= st + 1; k++) {
          const y = 15 - Math.round((h * k) / (st + 2));
          const side = k % 2 ? -1 : 1;
          put(d, 7 + ((y >> 2) & 1) + side, y, vary(shade(col, 0.85), r, 8));
          put(d, 7 + ((y >> 2) & 1) + side * 2, y - 1, vary(shade(col, 0.75), r, 8));
        }
        return;
      }
      const h = [3, 5, 8, 10][st];
      const leaf = s.kind === 'potato' ? [70, 150, 50] : s.kind === 'beetroot' ? [70, 140, 50] : [60, 160, 50];
      for (const x0 of [2, 5, 8, 11, 14]) {
        const hh = h - (x0 === 2 || x0 === 14 ? 1 : 0);
        for (let y = 15; y > 15 - hh; y--) {
          const c = s.kind === 'beetroot' && y > 15 - hh + 1 ? [150, 40, 50] : leaf;
          put(d, x0, y, vary(c, r, 12));
          if (y < 15 - hh / 2 && (y + x0) % 2 === 0) put(d, x0 + (x0 < 8 ? -1 : 1), y, vary(shade(leaf, 1.15), r, 10));
        }
        if (st === 3) {
          // le légume dépasse de la terre
          const c = s.kind === 'carrot' ? [240, 130, 30] : s.kind === 'potato' ? [200, 160, 80] : [130, 20, 40];
          put(d, x0, 15, c);
          if (s.kind !== 'carrot') put(d, x0 + (x0 < 8 ? 1 : -1), 15, shade(c, 0.85));
          if (s.kind === 'potato') put(d, x0, 14 - hh, [236, 236, 240]);
        }
      }
    },
    rock(d, r, s) {
      fill(d, r, s.c, s.v || 7);
      for (const [c, p] of s.s || []) speckle(d, r, c, p, 5);
    },
    wool(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const k = ((x + (y >> 1)) % 4 < 2 ? 1.05 : 0.93) * (y % 2 ? 0.97 : 1.02);
          put(d, x, y, vary(shade(s.c, k), r, 5));
        }
      for (let k = 0; k < 10; k++) {
        const x = Math.floor(r() * 15), y = Math.floor(r() * 15);
        put(d, x, y, shade(s.c, 0.84));
        put(d, x + 1, y + 1, shade(s.c, 0.88));
      }
    },
    concrete(d, r, s) {
      fill(d, r, s.c, 2);
      speckle(d, r, shade(s.c, 0.93), 0.14, 2);
      speckle(d, r, shade(s.c, 1.06), 0.06, 2);
    },
    powder(d, r, s) {
      const c = mixc(s.c, WHITE, 0.12);
      fill(d, r, c, 9);
      speckle(d, r, shade(s.c, 0.82), 0.22, 6);
      speckle(d, r, mixc(s.c, WHITE, 0.4), 0.12, 6);
    },
    terracotta(d, r, s) {
      fill(d, r, s.c, 4);
      speckle(d, r, shade(s.c, 0.9), 0.1, 3);
    },
    glazed(d, r, s) {
      // motif en moulinet : un quart dessiné au hasard puis tourné quatre fois
      const rr = CM.rng(1000 + s.p * 7919);
      const c1 = s.c, c2 = mixc(s.c, WHITE, 0.55), c3 = shade(s.c, 0.55), c4 = mixc(s.c, [255, 230, 160], 0.35);
      const pal = [c1, c2, c3, c4];
      const q = [];
      for (let y = 0; y < 8; y++) {
        q.push([]);
        for (let x = 0; x < 8; x++) q[y].push(0);
      }
      for (let k = 0; k < 7; k++) {
        const ci = Math.floor(rr() * 4);
        const x0 = Math.floor(rr() * 7), y0 = Math.floor(rr() * 7), w = 1 + Math.floor(rr() * 4), h = 1 + Math.floor(rr() * 3);
        for (let y = y0; y < Math.min(8, y0 + h); y++) for (let x = x0; x < Math.min(8, x0 + w); x++) q[y][x] = ci;
      }
      for (let i = 0; i < 8; i++) q[i][i] = 2;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const c = pal[q[y][x]];
          put(d, x, y, vary(c, r, 4));
          put(d, 15 - y, x, vary(c, r, 4));
          put(d, 15 - x, 15 - y, vary(c, r, 4));
          put(d, y, 15 - x, vary(c, r, 4));
        }
    },
    sglass(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const edge = x === 0 || y === 0 || x === 15 || y === 15;
          put(d, x, y, edge ? shade(s.c, 0.8) : vary(s.c, r, 3), edge ? 225 : 118);
        }
      line(d, 3, 6, 6, 3, mixc(s.c, WHITE, 0.6).concat([160]));
      line(d, 3, 9, 9, 3, mixc(s.c, WHITE, 0.5).concat([150]));
    },
    bricks(d, r, s) {
      const bh = s.small ? 4 : 4, bw = s.small ? 6 : 8;
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / bh);
        const off = row % 2 ? Math.floor(bw / 2) : 0;
        const bv = (CM.hash3(row, 3, 0, s.c[0]) - 0.5) * 16;
        for (let x = 0; x < 16; x++) {
          const mortar = y % bh === bh - 1 || (x + off) % bw === bw - 1;
          if (mortar) put(d, x, y, vary(s.m, r, 4));
          else {
            const top = y % bh === 0;
            put(d, x, y, vary(shade(s.c, top ? 1.12 : 1), r, 6).map((v, i) => (i < 3 ? v + bv : v)));
          }
        }
      }
    },
    tiles(d, r, s) {
      const ts = s.ts || 8;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const edgeD = x % ts === ts - 1 || y % ts === ts - 1;
          const edgeL = x % ts === 0 || y % ts === 0;
          put(d, x, y, edgeD ? vary(s.m, r, 4) : edgeL ? vary(shade(s.c, 1.15), r, 4) : vary(s.c, r, 5));
        }
    },
    polished(d, r, s) {
      fill(d, r, s.c, 3);
      speckle(d, r, shade(s.c, 0.94), 0.1, 2);
      border(d, shade(s.c, 1.18), shade(s.c, 0.72));
    },
    smooth(d, r, s) {
      fill(d, r, s.c, 2);
      for (let i = 0; i < 16; i++) {
        put(d, i, 0, shade(s.c, 0.8)); put(d, i, 15, shade(s.c, 0.8));
        put(d, 0, i, shade(s.c, 0.8)); put(d, 15, i, shade(s.c, 0.8));
      }
      speckle(d, r, shade(s.c, 0.96), 0.08, 2);
    },
    flat(d, r, s) {
      fill(d, r, s.c, 2);
      speckle(d, r, shade(s.c, 0.97), 0.1, 2);
    },
    chiseled(d, r, s) {
      GEN.polished(d, r, s);
      const dk = shade(s.c, 0.62), lt = shade(s.c, 1.2);
      for (let i = 2; i < 14; i++) {
        put(d, i, 2, dk); put(d, i, 13, lt);
        put(d, 2, i, dk); put(d, 13, i, lt);
      }
      disc(d, 7.5, 7.5, 3.4, (x, y, dist) => put(d, x, y, dist > 2.4 ? dk : dist > 1.4 ? shade(s.c, 1.05) : lt));
    },
    cracked(d, r, s) {
      copyFrom(d, s.from);
      const c = get(d, 5, 5);
      crackLines(d, r, shade(c, 0.45), 4);
    },
    cobble(d, r, s) {
      cellNoise(d, r, 10, (x, y, v, edge) => {
        put(d, x, y, edge < 1.1 ? shade(s.c, 0.6) : vary(shade(s.c, 0.85 + v * 0.35), r, 6));
      });
    },
    streaks(d, r, s) {
      const cols = [];
      for (let x = 0; x < 16; x++) cols.push((r() - 0.5) * 26);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(s.c.map((v) => v + cols[x]), r, 5));
    },
    rings(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          put(d, x, y, vary(shade(s.c, Math.floor(dist) % 2 ? 0.88 : 1.08), r, 4));
        }
    },
    pillar(d, r, s) {
      fill(d, r, s.c, 3);
      for (let y = 0; y < 16; y++) {
        put(d, 0, y, shade(s.c, 1.15)); put(d, 1, y, shade(s.c, 1.05));
        put(d, 15, y, shade(s.c, 0.75)); put(d, 14, y, shade(s.c, 0.86));
        if (y % 5 === 2) put(d, 7, y, shade(s.c, 0.9));
      }
    },
    mottled(d, r, s) {
      cellNoise(d, r, 9, (x, y, v) => put(d, x, y, vary(mixc(s.c, s.c2, v), r, 7)));
    },
    lamp(d, r, s) {
      cellNoise(d, r, 11, (x, y, v, edge) => put(d, x, y, vary(edge < 1.2 ? s.c2 : mixc(s.c2, s.c, 0.55 + v * 0.45), r, 6)));
    },
    froglight(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const t = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) / 8;
          put(d, x, y, vary(mixc(s.c, s.c2, t * t), r, 5));
        }
    },
    magma(d, r, s) {
      cellNoise(d, r, 9, (x, y, v, edge) => {
        if (edge < 1.3) put(d, x, y, vary([255, 150 + 60 * v, 40], r, 12));
        else put(d, x, y, vary(shade(s.c, 0.45 + v * 0.3), r, 6));
      });
    },
    soul(d, r, s) {
      fill(d, r, s.c, 8);
      speckle(d, r, shade(s.c, 0.75), 0.2, 5);
      for (const [cx, cy] of [[4, 4], [11, 9]]) {
        put(d, cx, cy, shade(s.c, 0.45)); put(d, cx + 2, cy, shade(s.c, 0.45));
        put(d, cx, cy + 2, shade(s.c, 0.5)); put(d, cx + 1, cy + 3, shade(s.c, 0.5)); put(d, cx + 2, cy + 2, shade(s.c, 0.5));
      }
    },
    ore(d, r, s) {
      copyFrom(d, s.base);
      ore(d, r, s.c, s.hi, s.n || 6);
    },
    gem(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const f = ((x + y) % 8 < 4 ? 1.1 : 0.9) * (x % 8 === 0 || y % 8 === 0 ? 0.75 : 1);
          put(d, x, y, vary(shade(s.c, f), r, 6));
        }
      speckle(d, r, WHITE, 0.03, 0);
    },
    metal(d, r, s) {
      const c = s.c;
      fill(d, r, c, 5);
      border(d, shade(c, 1.25), shade(c, 0.7));
      line(d, 3, 3, 7, 3, shade(c, 1.3));
      line(d, 3, 4, 5, 4, shade(c, 1.2));
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) put(d, x, y, shade(c, 0.6));
    },
    raw(d, r, s) {
      cellNoise(d, r, 8, (x, y, v, edge, d1) => {
        const k = edge < 1 ? 0.6 : 0.8 + (1 - Math.min(1, d1 / 5)) * 0.45;
        put(d, x, y, vary(shade(s.c, k), r, 6));
      });
    },
    ice(d, r, s) {
      fill(d, r, s.c, 6);
      for (let k = 0; k < 5; k++) {
        const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
        line(d, x, y, Math.min(15, x + 3 + Math.floor(r() * 5)), Math.max(0, y - 2 - Math.floor(r() * 4)), mixc(s.c, WHITE, 0.55));
      }
    },
    sponge(d, r, s) {
      fill(d, r, s.c, 8);
      for (let k = 0; k < 14; k++) {
        const x = Math.floor(r() * 15), y = Math.floor(r() * 15);
        put(d, x, y, shade(s.c, 0.6));
        if (r() < 0.5) put(d, x + 1, y, shade(s.c, 0.7));
      }
    },
    hay(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const band = s.top ? (Math.hypot(x - 7.5, y - 7.5) | 0) % 3 === 0 : y % 3 === 0;
          put(d, x, y, vary(shade(s.c, band ? 0.8 : 1 + (r() - 0.5) * 0.2), r, 6));
        }
      if (!s.top) for (let x = 0; x < 16; x++) { put(d, x, 4, [120, 60, 30]); put(d, x, 11, [120, 60, 30]); }
    },
    honeycomb(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const row = Math.floor(y / 4), off = row % 2 ? 2 : 0;
          const edge = y % 4 === 0 || (x + off) % 4 === 0;
          put(d, x, y, vary(edge ? shade(s.c, 0.7) : shade(s.c, 1.08), r, 6));
        }
    },
    jelly(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const edge = x === 0 || y === 0 || x === 15 || y === 15;
          const inner = x >= 4 && x <= 11 && y >= 4 && y <= 11;
          put(d, x, y, vary(edge ? shade(s.c, 0.85) : inner ? shade(s.c, 0.95) : mixc(s.c, WHITE, 0.2), r, 4), edge ? 235 : inner ? 215 : 165);
        }
    },
    shroomblock(d, r, s) {
      fill(d, r, s.c, 7);
      if (s.spots) for (let k = 0; k < 7; k++) disc(d, 1 + r() * 14, 1 + r() * 14, 1 + r() * 1.2, (x, y) => put(d, x, y, vary([240, 236, 230], r, 5)));
    },
    stem(d, r, s) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(shade(s.c, x % 3 === 0 ? 0.92 : 1), r, 5));
    },
    coral(d, r, s) {
      fill(d, r, s.c, 10);
      for (let k = 0; k < 16; k++) {
        const x = Math.floor(r() * 15), y = Math.floor(r() * 15);
        put(d, x, y, mixc(s.c, WHITE, 0.35));
        put(d, x + 1, y, shade(s.c, 0.72));
      }
    },
    sculk(d, r, s) {
      fill(d, r, s.c, 5);
      speckle(d, r, [20, 60, 70], 0.2, 5);
      speckle(d, r, [40, 200, 210], 0.05, 10);
    },
    grassside(d, r, s) {
      copyFrom(d, 'dirt');
      for (let x = 0; x < 16; x++) {
        const depth = 2 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
        for (let y = 0; y < depth; y++) put(d, x, y, vary(s.c, r, 10));
      }
    },
    roots(d, r, s) {
      fill(d, r, s.c, 9);
      speckle(d, r, shade(s.c, 0.8), 0.15, 5);
      for (let k = 0; k < 4; k++) {
        let x = Math.floor(r() * 16);
        for (let y = Math.floor(r() * 6); y < 16; y++) {
          put(d, x, y, [196, 156, 110]);
          if (r() < 0.3) x = (x + (r() < 0.5 ? 15 : 1)) % 16;
        }
      }
    },
    debris(d, r, s) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const t = Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2) + Math.cos(y * 0.8);
          put(d, x, y, vary(shade(s.c, 0.8 + t * 0.18), r, 6));
        }
      speckle(d, r, [150, 110, 96], 0.05, 6);
    },
    cut(d, r, s) {
      fill(d, r, s.c, 4);
      for (let x = 0; x < 16; x++) { put(d, x, 7, s.m); put(d, x, 15, s.m); put(d, x, 0, shade(s.c, 1.08)); put(d, x, 8, shade(s.c, 1.08)); }
      for (let y = 0; y < 7; y++) put(d, 15, y, s.m);
      for (let y = 8; y < 15; y++) put(d, 7, y, s.m);
    },
    custom(d, r, s) {
      CUSTOM[s.f](d, r);
    },
    nylium(d, r, s) {
      copyFrom(d, 'netherrack');
      for (let x = 0; x < 16; x++) {
        const depth = 2 + (r() < 0.5 ? 1 : 0) + (r() < 0.2 ? 2 : 0);
        for (let y = 0; y < depth; y++) put(d, x, y, vary(s.c, r, 14));
      }
    },
    // ----- plantes (fond transparent)
    flower(d, r, s) {
      clear(d);
      const stem = [58, 138, 40], leaf = [70, 150, 48];
      const p = s.petal, c = s.center;
      const st = s.style;
      const top = st === 'big' ? 4 : st === 'small' ? 9 : 6;
      for (let y = top + 2; y < 16; y++) put(d, 8, y, stem);
      put(d, 7, 12, leaf); put(d, 6, 11, leaf); put(d, 9, 13, leaf); put(d, 10, 12, leaf);
      if (st === 'ball') disc(d, 8, top, 3, (x, y, dist) => put(d, x, y, vary(dist > 2 ? shade(p, 0.8) : p, r, 12)));
      else if (st === 'small') {
        for (const [ox, oy] of [[-3, 0], [0, -1], [3, 1]]) {
          disc(d, 8 + ox, top + oy, 1.3, (x, y) => put(d, x, y, p));
          put(d, 8 + ox, top + oy, c);
          line(d, 8 + ox, top + oy + 1, 8, 15, stem);
        }
      } else if (st === 'orchid') {
        disc(d, 8, top, 2.8, (x, y, dist) => put(d, x, y, dist > 1.6 ? p : c));
        put(d, 5, top + 2, p); put(d, 11, top + 2, p);
      } else if (st === 'bells') {
        line(d, 8, top, 11, top - 2, stem);
        for (const [x, y] of [[9, top + 1], [11, top], [7, top + 3], [10, top + 4]]) {
          put(d, x, y, p); put(d, x + 1, y, p); put(d, x, y + 1, shade(p, 0.85)); put(d, x + 1, y + 1, shade(p, 0.85));
        }
        for (let y = 9; y < 16; y++) { put(d, 5, y, leaf); put(d, 6, y - 1, leaf); }
      } else if (st === 'tulip') {
        for (let y = top - 3; y <= top + 1; y++) for (let x = 6; x <= 10; x++) {
          if (y === top - 3 && (x === 7 || x === 9)) continue;
          put(d, x, y, vary(x === 6 || x === 10 ? shade(p, 0.8) : p, r, 8));
        }
        put(d, 8, top - 1, c);
      } else if (st === 'rose') {
        disc(d, 8, top, 2.8, (x, y, dist) => put(d, x, y, vary(dist > 1.8 ? shade(p, 0.75) : p, r, 10)));
        put(d, 8, top, c);
      } else if (st === 'bush') {
        for (let y = 3; y < 16; y++) for (let x = 2; x < 14; x++) {
          const e = ((x - 7.5) / 6) ** 2 + ((y - 9) / 6.5) ** 2;
          if (e < 1 && r() < 0.8) put(d, x, y, vary(r() < 0.3 ? [34, 90, 34] : [52, 118, 44], r, 10));
        }
        for (let k = 0; k < 6; k++) disc(d, 3 + r() * 10, 3 + r() * 9, 1.2, (x, y) => put(d, x, y, vary(p, r, 10)));
      } else {
        // grande fleur (tournesol, pivoine)
        disc(d, 8, top + 1, 4, (x, y, dist) => put(d, x, y, dist > 2 ? vary(p, r, 10) : vary(c, r, 8)));
      }
    },
    reeds(d, r, s) {
      clear(d);
      for (const x0 of [3, 8, 12]) {
        for (let y = 0; y < 16; y++) {
          const seg = y % 5 === 0;
          put(d, x0, y, vary(seg ? shade(s.c, 0.75) : s.c, r, 8));
          put(d, x0 + 1, y, vary(shade(s.c, 0.85), r, 8));
        }
        if (r() < 0.7) { put(d, x0 - 1, 6, shade(s.c, 0.9)); put(d, x0 - 2, 5, shade(s.c, 0.9)); }
      }
    },
    rootsplant(d, r, s) {
      clear(d);
      for (let b = 0; b < 7; b++) {
        const x0 = 2 + r() * 12, h = 5 + r() * 9, lean = (r() - 0.5) * 6;
        for (let y = 15; y > 15 - h; y--) {
          const t = (15 - y) / h;
          put(d, Math.round(x0 + lean * t * t), y, vary(s.c, r, 14));
        }
      }
    },
    sprouts(d, r, s) {
      clear(d);
      for (let b = 0; b < 9; b++) {
        const x0 = 1 + Math.floor(r() * 14), h = 2 + Math.floor(r() * 4);
        for (let y = 15; y > 15 - h; y--) put(d, x0, y, vary(s.c, r, 14));
        put(d, x0 + 1, 15 - h, mixc(s.c, WHITE, 0.3));
      }
    },
    bush(d, r, s) {
      clear(d);
      for (let y = 2; y < 16; y++)
        for (let x = 1; x < 15; x++) {
          const e = ((x - 7.5) / 7) ** 2 + ((y - 8) / 6.5) ** 2;
          if (e < 1 && r() < 0.85) put(d, x, y, vary(r() < 0.3 ? shade(s.c, 0.7) : s.c, r, 10));
        }
      for (let y = 12; y < 16; y++) put(d, 8, y, [96, 70, 40]);
      if (s.flowers) for (let k = 0; k < 7; k++) {
        const x = 3 + Math.floor(r() * 10), y = 3 + Math.floor(r() * 8);
        put(d, x, y, s.flowers); put(d, x + 1, y, shade(s.flowers, 0.85));
      }
    },
    fan(d, r, s) {
      clear(d);
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.33;
        line(d, 8, 15, Math.round(8 + Math.cos(a) * 7), Math.round(15 + Math.sin(a) * 11), vary(s.c, r, 12));
      }
      for (let k = 0; k < 10; k++) put(d, 3 + Math.floor(r() * 10), 4 + Math.floor(r() * 8), mixc(s.c, WHITE, 0.3));
    },
  };

  // ---- essences de bois supplémentaires ----
  woodSet('dark_oak', { bark: [60, 46, 28], ring1: [110, 80, 46], ring2: [84, 60, 34], plank: [72, 48, 24], leaf: [52, 96, 34] });
  woodSet('cherry', { bark: [58, 34, 44], ring1: [228, 176, 170], ring2: [206, 150, 146], plank: [226, 178, 172], leaf: [236, 162, 196], leafStyle: 'blossom' });
  woodSet('mangrove', { bark: [86, 64, 48], ring1: [150, 70, 60], ring2: [124, 56, 48], plank: [118, 54, 48], leaf: [90, 136, 48] });
  woodSet('crimson', { bark: [110, 26, 44], ring1: [124, 58, 84], ring2: [98, 44, 66], plank: [104, 52, 74], leaf: [118, 12, 12], style: 'stem', leafStyle: 'wart', sapling: 'fungus', cap: [180, 30, 30] });
  woodSet('warped', { bark: [58, 56, 76], ring1: [60, 130, 124], ring2: [44, 104, 100], plank: [44, 104, 100], leaf: [22, 120, 118], style: 'stem', stemSpeck: [40, 200, 180], leafStyle: 'wart', sapling: 'fungus', cap: [20, 150, 140] });
  make('oak_log_side', (d) => copyFrom(d, 'log_side'));
  // Bûches écorcées : le bois clair apparaît sous l'écorce.
  const STRIP = {
    oak: [176, 136, 84], birch: [206, 188, 134], spruce: [128, 96, 60], acacia: [180, 96, 54], jungle: [168, 122, 84], willow: [160, 152, 108],
    crystal: [156, 128, 210], dark_oak: [96, 70, 44], cherry: [220, 170, 160], mangrove: [126, 58, 50], crimson: [132, 56, 86], warped: [52, 128, 120],
  };
  for (const [t, c] of Object.entries(STRIP)) {
    make('stripped_' + t + '_side', (d, r) => {
      const cols = [];
      for (let x = 0; x < 16; x++) cols.push((r() - 0.5) * 14);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(c.map((v) => v + cols[x]), r, 5));
    });
    make('stripped_' + t + '_top', (d, r) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const dist = Math.hypot(x - 7.5, y - 7.5);
          const k = dist > 7 ? 0.85 : Math.floor(dist * 1.2) % 2 ? 1.05 : 0.92;
          put(d, x, y, vary(shade(c, k), r, 5));
        }
    });
  }
  // ---- bambou ----
  const BAM = [118, 150, 40], BAM2 = [206, 190, 90];
  make('bamboo_block_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(shade(BAM, x % 4 === 0 ? 0.75 : y % 8 === 3 ? 0.85 : 1), r, 6));
  });
  make('bamboo_block_top', (d, r) => {
    fill(d, r, BAM2, 5);
    for (const [cx, cy] of [[4, 4], [11, 4], [4, 11], [11, 11]]) disc(d, cx, cy, 2.6, (x, y, dist) => put(d, x, y, dist > 1.8 ? shade(BAM, 0.8) : shade(BAM2, 0.8)));
  });
  make('stripped_bamboo_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(shade(BAM2, x % 4 === 0 ? 0.8 : y % 8 === 3 ? 0.9 : 1), r, 5));
  });
  make('stripped_bamboo_top', (d, r) => {
    fill(d, r, BAM2, 5);
    for (const [cx, cy] of [[4, 4], [11, 4], [4, 11], [11, 11]]) disc(d, cx, cy, 2.6, (x, y, dist) => put(d, x, y, dist > 1.8 ? shade(BAM2, 0.75) : shade(BAM2, 0.9)));
  });
  make('bamboo_planks', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(shade(BAM2, x % 4 === 3 ? 0.72 : y % 8 === 7 ? 0.8 : 1), r, 5));
  });
  make('bamboo_mosaic', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const cell = ((x >> 2) + (y >> 3)) % 2;
        const line2 = cell ? x % 4 === 3 : y % 4 === 3;
        put(d, x, y, vary(shade(BAM2, line2 ? 0.72 : cell ? 1 : 0.9), r, 5));
      }
    for (let x = 0; x < 16; x++) { put(d, x, 7, shade(BAM2, 0.6)); put(d, x, 15, shade(BAM2, 0.6)); }
  });
  make('bamboo', (d, r) => {
    clear(d);
    for (let y = 0; y < 16; y++) {
      const seg = y % 6 === 0;
      put(d, 7, y, vary(seg ? shade(BAM, 0.7) : BAM, r, 6));
      put(d, 8, y, vary(seg ? shade(BAM, 0.6) : shade(BAM, 0.85), r, 6));
    }
    for (const [x, y] of [[9, 3], [10, 2], [11, 2], [6, 9], [5, 8], [4, 8]]) put(d, x, y, [80, 150, 50]);
  });

  // ---- blocs utilitaires ----
  const PL = [176, 136, 84];
  const CUSTOM = {
    note_block(d, r) {
      copyFrom(d, 'planks');
      border(d, [96, 66, 36], [96, 66, 36]);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, [60, 40, 24]);
      art(d, ['', '', '', '', '.....nnnn', '.....n..n', '.....n..n', '....nn.nn', '...nnn.nnn', '....n...n'], { n: [230, 220, 200] });
    },
  };
  // ---- textures décrites dans blocks.js (familles de blocs) ----
  for (const [name, spec] of Object.entries(CM.TEXSPEC)) {
    if (T.layer[name] !== undefined) continue;
    const g = GEN[spec.type];
    if (!g) throw new Error('Générateur de texture inconnu : ' + spec.type);
    make(name, (d, r) => g(d, r, spec));
  }

  make('bookshelf', (d, r) => {
    copyFrom(d, 'planks');
    for (let row = 0; row < 2; row++) {
      const y0 = 1 + row * 8;
      for (let x = 0; x < 16; x++) { put(d, x, y0 - 1, [120, 88, 52]); put(d, x, y0 + 6, [96, 66, 36]); }
      let x = 1;
      while (x < 15) {
        const w = 1 + Math.floor(r() * 2), h = 4 + Math.floor(r() * 3);
        const col = [[150, 40, 40], [50, 80, 150], [60, 120, 60], [140, 110, 50], [110, 60, 120], [40, 40, 50]][Math.floor(r() * 6)];
        for (let xx = x; xx < Math.min(15, x + w); xx++) for (let yy = y0 + 6 - h; yy < y0 + 6; yy++) put(d, xx, yy, vary(col, r, 10));
        x += w + (r() < 0.2 ? 1 : 0);
      }
    }
  });
  make('tnt_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(x % 4 === 0 ? [180, 30, 20] : [214, 50, 36], r, 8));
    for (let y = 5; y < 11; y++) for (let x = 0; x < 16; x++) put(d, x, y, [236, 232, 220]);
    art(d, ['', '', '', '', '', '', '..TTT.T..T.TTT..', '...T..TT.T..T...', '...T..T.TT..T...', '...T..T..T..T...'], { T: [30, 30, 30] });
  });
  make('tnt_top', (d, r) => {
    fill(d, r, [214, 50, 36], 8);
    disc(d, 7.5, 7.5, 2, (x, y) => put(d, x, y, [60, 50, 40]));
    line(d, 8, 7, 10, 4, [150, 150, 150]);
  });
  make('tnt_bottom', (d, r) => fill(d, r, [190, 40, 30], 8));
  make('cartography_top', (d, r) => {
    copyFrom(d, 'planks');
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) put(d, x, y, vary([226, 214, 170], r, 6));
    line(d, 3, 10, 7, 6, [120, 90, 60]); line(d, 7, 6, 12, 9, [120, 90, 60]);
    disc(d, 10, 5, 1.5, (x, y) => put(d, x, y, [80, 140, 200]));
  });
  make('cartography_side', (d, r) => {
    copyFrom(d, 'dark_oak_planks');
    for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary([220, 206, 160], r, 6));
    line(d, 4, 9, 11, 6, [120, 90, 60]);
  });
  make('fletching_top', (d, r) => {
    copyFrom(d, 'birch_planks');
    line(d, 3, 12, 12, 3, [120, 90, 60]);
    line(d, 10, 3, 12, 3, [240, 240, 240]); line(d, 12, 3, 12, 5, [240, 240, 240]);
  });
  make('fletching_side', (d, r) => {
    copyFrom(d, 'birch_planks');
    for (let x = 0; x < 16; x++) put(d, x, 2, [150, 120, 80]);
    for (const x of [4, 8, 12]) { put(d, x, 6, [240, 240, 240]); put(d, x, 7, [200, 200, 200]); put(d, x, 8, [120, 90, 60]); put(d, x, 9, [120, 90, 60]); }
  });
  make('smithing_top', (d, r) => {
    fill(d, r, [58, 58, 64], 6);
    border(d, [90, 90, 96], [40, 40, 44]);
    for (let x = 3; x < 13; x++) put(d, x, 8, [110, 110, 118]);
  });
  make('smithing_bottom', (d, r) => copyFrom(d, 'dark_oak_planks'));
  make('smithing_side', (d, r) => {
    copyFrom(d, 'dark_oak_planks');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary([60, 60, 66], r, 5));
    for (let y = 7; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, vary([150, 150, 160], r, 5));
  });
  make('loom_top', (d, r) => {
    copyFrom(d, 'planks');
    for (let x = 2; x < 14; x += 2) for (let y = 1; y < 15; y++) put(d, x, y, [226, 220, 210]);
  });
  make('loom_side', (d, r) => {
    copyFrom(d, 'planks');
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary((x + y) % 2 ? [190, 60, 60] : [230, 220, 200], r, 6));
  });
  make('barrel_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(shade([128, 92, 56], x % 4 === 0 ? 0.75 : 1), r, 7));
    for (let x = 0; x < 16; x++) { put(d, x, 2, [70, 70, 76]); put(d, x, 13, [70, 70, 76]); }
  });
  make('barrel_top', (d, r) => {
    fill(d, r, [128, 92, 56], 6);
    border(d, [90, 64, 38], [90, 64, 38]);
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, [80, 56, 32]);
  });
  make('beehive_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(shade([196, 150, 80], y % 4 === 3 ? 0.78 : 1), r, 6));
  });
  make('beehive_front', (d, r) => {
    copyFrom(d, 'beehive_side');
    for (let y = 9; y < 12; y++) for (let x = 6; x < 10; x++) put(d, x, y, [40, 26, 12]);
    for (let x = 3; x < 13; x++) put(d, x, 4, [236, 180, 40]);
  });
  make('beehive_top', (d, r) => {
    fill(d, r, [180, 140, 76], 6);
    for (let i = 0; i < 16; i++) { put(d, i, 7, [150, 110, 60]); put(d, 7, i, [150, 110, 60]); }
  });
  make('jukebox_side', (d, r) => {
    copyFrom(d, 'planks');
    border(d, [96, 66, 36], [96, 66, 36]);
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary([110, 76, 44], r, 5));
  });
  make('jukebox_top', (d, r) => {
    copyFrom(d, 'jukebox_side');
    for (let x = 3; x < 13; x++) { put(d, x, 7, [30, 20, 14]); put(d, x, 8, [30, 20, 14]); }
  });
  make('target_side', (d, r) => {
    copyFrom(d, 'hay_side');
    disc(d, 7.5, 7.5, 6.5, (x, y, dist) => put(d, x, y, Math.floor(dist / 1.6) % 2 ? [236, 232, 220] : [210, 40, 40]));
  });
  make('target_top', (d, r) => copyFrom(d, 'target_side'));
  const STONEC = [128, 128, 128];
  make('furnace_side', (d, r) => {
    copyFrom(d, 'cobble');
    for (let x = 0; x < 16; x++) put(d, x, 0, [150, 150, 150]);
  });
  make('furnace_top', (d, r) => {
    fill(d, r, [118, 118, 118], 7);
    border(d, [150, 150, 150], [90, 90, 90]);
  });
  make('furnace_front', (d, r) => {
    copyFrom(d, 'furnace_side');
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) put(d, x, y, [30, 26, 24]);
    for (let x = 4; x < 12; x++) if (r() < 0.8) put(d, x, 13, r() < 0.5 ? [255, 180, 60] : [230, 100, 30]);
    for (let x = 3; x < 13; x++) put(d, x, 6, [80, 80, 80]);
  });
  make('blast_side', (d, r) => {
    copyFrom(d, 'smooth_stone');
    for (let y = 0; y < 16; y += 5) for (let x = 0; x < 16; x++) put(d, x, y, [110, 110, 114]);
  });
  make('blast_top', (d, r) => {
    fill(d, r, [96, 96, 100], 6);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, (x + y) % 2 ? [60, 60, 64] : [80, 80, 84]);
  });
  make('blast_front', (d, r) => {
    copyFrom(d, 'blast_side');
    for (let y = 7; y < 14; y++) for (let x = 3; x < 13; x++) put(d, x, y, (x % 2) ? [40, 40, 44] : [24, 20, 20]);
    for (let x = 3; x < 13; x++) if (r() < 0.7) put(d, x, 13, [255, 160, 50]);
  });
  make('smoker_side', (d, r) => {
    copyFrom(d, 'furnace_side');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y < 3 || y > 12) put(d, x, y, vary([110, 80, 50], r, 6));
  });
  make('smoker_top', (d, r) => {
    fill(d, r, [80, 76, 74], 6);
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, [40, 36, 34]);
  });
  make('smoker_bottom', (d, r) => fill(d, r, [110, 80, 50], 6));
  make('smoker_front', (d, r) => {
    copyFrom(d, 'smoker_side');
    for (let y = 6; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, [30, 26, 24]);
    for (let x = 4; x < 12; x++) if (r() < 0.6) put(d, x, 11, [255, 150, 50]);
  });
  make('dispenser_front', (d, r) => {
    copyFrom(d, 'furnace_side');
    disc(d, 7.5, 7.5, 3, (x, y, dist) => put(d, x, y, dist > 2 ? [70, 70, 70] : [24, 24, 24]));
  });
  make('dropper_front', (d, r) => {
    copyFrom(d, 'furnace_side');
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, [24, 24, 24]);
  });
  make('observer_side', (d, r) => {
    copyFrom(d, 'furnace_top');
    for (let y = 6; y < 10; y++) for (let x = 0; x < 16; x++) put(d, x, y, [70, 70, 74]);
  });
  make('observer_top', (d, r) => {
    copyFrom(d, 'furnace_top');
    for (let x = 0; x < 16; x++) put(d, x, 8, [170, 30, 30]);
  });
  make('observer_front', (d, r) => {
    fill(d, r, STONEC, 6);
    border(d, [150, 150, 150], [90, 90, 90]);
    for (let y = 5; y < 11; y++) for (const x of [3, 4, 11, 12]) put(d, x, y, [30, 30, 30]);
    for (let x = 5; x < 11; x++) put(d, x, 10, [30, 30, 30]);
  });
  make('carved_pumpkin', (d, r) => {
    copyFrom(d, 'pumpkin_side');
    art(d, ['', '', '', '...dd......dd...', '...ddd....ddd...', '', '.......dd.......', '', '..dddddddddddd..', '..d.dddddddd.d..', '....dd....dd....'], { d: [60, 30, 10] });
  });
  make('tinted_glass', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary([46, 40, 56], r, 5), 255);
    border(d, [80, 70, 96], [30, 26, 36]);
    line(d, 3, 7, 7, 3, [100, 90, 120]);
  });
  make('soul_lantern_side', (d, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const t = CM.clamp(1 - Math.hypot(x - 7.5, y - 8) / 8, 0, 1);
        put(d, x, y, [60 + 80 * t, 170 + 70 * t, 200 + 55 * t]);
      }
    for (let i = 0; i < 16; i++) { put(d, i, 0, [60, 60, 70]); put(d, i, 15, [60, 60, 70]); put(d, 0, i, [70, 70, 80]); put(d, 15, i, [50, 50, 60]); put(d, 7, i, [70, 70, 80]); }
  });
  make('soul_lantern_top', (d, r) => {
    fill(d, r, [66, 66, 76], 6);
    disc(d, 7.5, 7.5, 2.5, (x, y) => put(d, x, y, [140, 230, 250]));
  });
  make('soul_torch', (d, r) => {
    clear(d);
    for (let y = 8; y < 16; y++) { put(d, 7, y, [132, 94, 54]); put(d, 8, y, [98, 68, 40]); }
    put(d, 7, 6, [220, 255, 255]); put(d, 8, 6, [130, 230, 250]); put(d, 7, 7, [90, 200, 240]); put(d, 8, 7, [60, 160, 220]);
  });
  make('farmland_top', (d, r) => {
    fill(d, r, [96, 64, 40], 8);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [70, 46, 28]);
  });
  for (let s = 0; s < 4; s++) {
    make('wheat_' + s, (d, r) => {
      clear(d);
      const h = [4, 7, 11, 13][s];
      const col = s === 3 ? [200, 170, 70] : s === 2 ? [140, 170, 60] : [80, 160, 50];
      for (const x0 of [2, 5, 8, 11, 14]) {
        for (let y = 15; y > 15 - h; y--) put(d, x0, y, vary(col, r, 12));
        if (s === 3) { put(d, x0 - 1, 15 - h, [220, 190, 90]); put(d, x0, 14 - h, [230, 200, 100]); put(d, x0 + 1, 15 - h + 1, [210, 180, 80]); }
      }
    });
  }

  // ---- nouveaux objets ----
  make('diamond', (d) => { clear(d); art(d, GEM_ROWS, pal4([80, 220, 214])); });
  make('emerald', (d) => { clear(d); art(d, GEM_ROWS, pal4([30, 190, 90])); });
  make('amethyst_shard', (d) => {
    clear(d);
    art(d, ['', '.........h', '........hH', '.......hHm', '......hHm.', '.....hHm..', '....hHm...', '...hHm....', '..hHm.....', '..Hmd.....', '..md......'], pal4([150, 100, 210]));
  });
  make('quartz', (d) => {
    clear(d);
    art(d, ['', '', '.....h.....h', '....hHm...hHm', '....HHm...Hmm', '...hHmm..hHmm', '...Hmmd..Hmmd', '..hHmd..hHmd', '..Hmmd..Hmmd', '..mmdd..mmdd'], pal4([226, 220, 214]));
  });
  make('lapis', (d, r) => {
    clear(d);
    disc(d, 7.5, 8.5, 5, (x, y, dist) => put(d, x, y, vary(dist > 4 ? [24, 50, 140] : [40, 76, 190], r, 10)));
    speckle(d, r, [220, 190, 80], 0.02, 0);
  });
  make('redstone', (d, r) => {
    clear(d);
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 5;
      put(d, Math.round(7.5 + Math.cos(a) * rr), Math.round(10 + Math.sin(a) * rr * 0.6), vary([200, 20, 16], r, 20));
    }
  });
  make('glowstone_dust', (d, r) => {
    clear(d);
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 5;
      put(d, Math.round(7.5 + Math.cos(a) * rr), Math.round(10 + Math.sin(a) * rr * 0.6), vary([250, 210, 110], r, 20));
    }
  });
  make('sugar', (d, r) => {
    clear(d);
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 5;
      put(d, Math.round(7.5 + Math.cos(a) * rr), Math.round(10 + Math.sin(a) * rr * 0.6), vary([246, 246, 250], r, 8));
    }
  });
  make('bone_meal', (d, r) => {
    clear(d);
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 5;
      put(d, Math.round(7.5 + Math.cos(a) * rr), Math.round(10 + Math.sin(a) * rr * 0.6), vary([236, 232, 220], r, 12));
    }
  });
  make('netherite_scrap', (d, r) => {
    clear(d);
    disc(d, 7.5, 8.5, 5, (x, y, dist) => put(d, x, y, vary(dist > 4 ? [60, 44, 40] : [96, 70, 62], r, 10)));
    line(d, 4, 7, 10, 6, [140, 110, 96]);
  });
  make('netherite_ingot', (d) => { clear(d); art(d, INGOT_ROWS, pal4([70, 64, 68])); });
  make('leather', (d, r) => {
    clear(d);
    for (let y = 3; y < 14; y++) for (let x = 3; x < 13; x++) {
      if ((y === 3 || y === 13) && (x < 5 || x > 10)) continue;
      put(d, x, y, vary([150, 86, 50], r, 10));
    }
  });
  make('paper', (d, r) => {
    clear(d);
    for (let y = 3; y < 14; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary([240, 238, 226], r, 4));
    for (let y = 5; y < 13; y += 2) line(d, 5, y, 10, y, [190, 190, 200]);
  });
  make('book', (d, r) => {
    clear(d);
    for (let y = 3; y < 14; y++) for (let x = 3; x < 13; x++) put(d, x, y, x < 5 ? [100, 46, 30] : [150, 70, 40]);
    for (let y = 4; y < 13; y++) put(d, 12, y, [240, 238, 226]);
  });
  make('seeds', (d, r) => {
    clear(d);
    for (let k = 0; k < 7; k++) {
      const x = 4 + Math.floor(r() * 8), y = 5 + Math.floor(r() * 7);
      put(d, x, y, [70, 140, 40]); put(d, x + 1, y, [40, 100, 30]);
    }
  });
  make('wheat', (d, r) => {
    clear(d);
    for (let k = 0; k < 4; k++) line(d, 4 + k * 2, 15, 7 + k, 3, [200, 170, 70]);
    for (let y = 2; y < 8; y++) { put(d, 7 + (y % 2), y, [230, 200, 100]); put(d, 9, y + 1, [210, 180, 80]); }
  });
  make('bread', (d, r) => {
    clear(d);
    for (let y = 6; y < 12; y++) for (let x = 2; x < 14; x++) {
      if ((y === 6 || y === 11) && (x < 4 || x > 11)) continue;
      put(d, x, y, vary(y < 8 ? [196, 130, 60] : [216, 160, 84], r, 6));
    }
    for (const x of [5, 8, 11]) put(d, x, 7, [150, 96, 40]);
  });
  make('heart', (d) => {
    clear(d);
    art(d, ['', '', '', '...rr...rr', '..rRRr.rrRr', '..rRRrrrrrr', '..rrrrrrrrr', '...rrrrrrr', '....rrrrr', '.....rrr', '......r'], { r: [220, 30, 50], R: [255, 150, 160] });
  });
  // ---- agriculture ----
  make('farmland_wet_top', (d, r) => {
    fill(d, r, [66, 42, 26], 6);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [44, 28, 16]);
  });
  const carrotTex = (d, r, body, hi) => {
    clear(d);
    for (let k = 0; k < 9; k++) {
      const cx = 4 + k * 0.75, cy = 13 - k;
      const rad = k < 2 ? 0.5 : k < 5 ? 1.2 : 1.6;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) <= rad) put(d, Math.round(cx + dx), Math.round(cy + dy), vary(dx + dy < 0 ? hi : body, r, 8));
    }
    for (const [x, y] of [[8, 9], [6, 11], [9, 7]]) put(d, x, y, shade(body, 0.75));
    line(d, 11, 4, 13, 1, [60, 150, 40]); line(d, 11, 4, 14, 3, [80, 180, 50]); line(d, 11, 4, 11, 1, [60, 150, 40]);
  };
  make('carrot', (d, r) => carrotTex(d, r, [236, 124, 28], [250, 170, 70]));
  make('golden_carrot', (d, r) => carrotTex(d, r, [224, 180, 40], [255, 236, 130]));
  const potatoTex = (d, r, c, spot) => {
    clear(d);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const e = ((x - 7.5) / 5.5) ** 2 + ((y - 8.5) / 4.2) ** 2;
      if (e <= 1) put(d, x, y, vary(e > 0.7 ? shade(c, 0.8) : x + y < 14 ? mixc(c, WHITE, 0.15) : c, r, 7));
    }
    for (const [x, y] of [[5, 7], [9, 10], [10, 6], [6, 11]]) put(d, x, y, spot);
  };
  make('potato', (d, r) => potatoTex(d, r, [200, 162, 88], [150, 116, 60]));
  make('baked_potato', (d, r) => potatoTex(d, r, [214, 150, 60], [120, 70, 30]));
  make('beetroot', (d, r) => {
    clear(d);
    disc(d, 7.5, 10, 4.5, (x, y, dist) => put(d, x, y, vary(dist > 3.5 ? [110, 16, 36] : x + y < 16 ? [180, 40, 64] : [150, 26, 48], r, 8)));
    put(d, 7, 15, [110, 16, 36]);
    line(d, 7, 5, 5, 1, [60, 140, 50]); line(d, 8, 5, 10, 1, [70, 150, 60]); line(d, 7, 5, 8, 2, [150, 40, 50]);
  });
  const seedTex = (d, r, c, n) => {
    clear(d);
    for (let k = 0; k < n; k++) {
      const x = 3 + Math.floor(r() * 9), y = 4 + Math.floor(r() * 8);
      put(d, x, y, vary(c, r, 10)); put(d, x + 1, y, vary(shade(c, 0.8), r, 8)); put(d, x, y + 1, vary(shade(c, 0.9), r, 8));
    }
  };
  make('beetroot_seeds', (d, r) => seedTex(d, r, [176, 150, 100], 6));
  make('pumpkin_seeds', (d, r) => seedTex(d, r, [236, 228, 190], 5));
  make('melon_seeds', (d, r) => seedTex(d, r, [96, 70, 44], 6));
  make('beetroot_soup', (d, r) => {
    clear(d);
    for (let y = 8; y < 14; y++) for (let x = 2; x < 14; x++) {
      if (y === 13 && (x < 4 || x > 11)) continue;
      put(d, x, y, y === 8 ? [196, 140, 90] : [136, 92, 54]);
    }
    for (let x = 3; x < 13; x++) put(d, x, 7, vary([170, 30, 50], r, 12));
    put(d, 6, 7, [220, 80, 90]);
  });
  const bucketTex = (d, r, water) => {
    clear(d);
    for (let y = 5; y < 14; y++) {
      const inset = Math.floor((y - 5) / 4);
      for (let x = 3 + inset; x < 13 - inset; x++) put(d, x, y, vary(x < 6 ? [196, 196, 204] : x > 10 - inset ? [120, 120, 130] : [160, 160, 170], r, 5));
    }
    for (let x = 3; x < 13; x++) put(d, x, 5, water ? [48, 96, 220] : [70, 70, 80]);
    if (water) for (let x = 4; x < 12; x++) put(d, x, 6, [70, 130, 240]);
    line(d, 3, 5, 5, 2, [110, 110, 120]); line(d, 5, 2, 10, 2, [110, 110, 120]); line(d, 10, 2, 12, 5, [110, 110, 120]);
  };
  make('bucket', (d, r) => bucketTex(d, r, false));
  make('water_bucket', (d, r) => bucketTex(d, r, true));
  make('slimeball', (d, r) => {
    clear(d);
    disc(d, 7.5, 8.5, 4.5, (x, y, dist) => put(d, x, y, dist > 3.5 ? [80, 150, 60] : [120, 200, 96], 235));
    put(d, 6, 6, [210, 250, 200]);
  });
  make('honeycomb', (d, r) => {
    clear(d);
    for (let y = 4; y < 13; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary((x + (y % 2)) % 3 === 0 ? [190, 110, 20] : [240, 170, 40], r, 6));
  });
  make('flint', (d, r) => {
    clear(d);
    art(d, ['', '', '......hh', '.....hHmm', '....hHmmm', '...hHmmmd', '...Hmmmdd', '...mmmdd', '....mdd'], pal4([70, 70, 76]));
  });
  make('flint_and_steel', (d, r) => {
    clear(d);
    art(d, ['', '', '..ssss', '.s....s', '.s....s', '..s..s', '...s', '', '.........ff', '........fFFf', '.......fFFff', '........fff'], { s: [200, 200, 210], f: [70, 70, 76], F: [110, 110, 118] });
  });
  make('berry_jam', (d, r) => {
    clear(d);
    for (let y = 4; y < 14; y++) for (let x = 4; x < 12; x++) put(d, x, y, y < 6 ? [220, 220, 230] : [170, 20, 40]);
    for (let x = 3; x < 13; x++) put(d, x, 4, [150, 110, 70]);
  });
  make('honey_bottle', (d, r) => {
    clear(d);
    for (let y = 6; y < 14; y++) for (let x = 4; x < 12; x++) put(d, x, y, [240, 170, 40]);
    for (let y = 3; y < 6; y++) for (let x = 6; x < 10; x++) put(d, x, y, [220, 230, 240]);
    put(d, 5, 8, [255, 230, 150]);
  });
  for (const dye of CM.DYES) {
    make('dye_' + dye.key.toLowerCase(), (d, r) => {
      clear(d);
      const c = dye.c;
      for (let y = 5; y < 14; y++) for (let x = 3; x < 13; x++) {
        const e = ((x - 7.5) / 5) ** 2 + ((y - 9.5) / 4.5) ** 2;
        if (e < 1) put(d, x, y, vary(e > 0.6 ? shade(c, 0.78) : c, r, 6));
      }
      for (let x = 6; x < 10; x++) put(d, x, 4, [150, 110, 70]);
      put(d, 6, 8, mixc(c, WHITE, 0.5));
    });
  }


  // ------------------------------------------------- tableau de textures --
  T.count = () => T.names.length;
  T.pixels = function () {
    const n = T.names.length;
    const data = new Uint8Array(16 * 16 * 4 * n);
    for (let i = 0; i < n; i++) {
      const px = T.canvases[T.names[i]].getContext('2d').getImageData(0, 0, 16, 16).data;
      data.set(px, i * 1024);
    }
    return data;
  };

  // ----------------------------------------- boîtes de sélection des plantes --
  // D'après les pixels visibles de la texture : une fleur basse a une petite boîte.
  // Les deux plans en croix vont de (2, 2) à (14, 14) : la colonne u est à 2 + 0,75 u.
  for (const b of CM.blocks) {
    if (!b || b.render !== 'cross' || !T.canvases[b.tex.side]) continue;
    const px = T.canvases[b.tex.side].getContext('2d').getImageData(0, 0, 16, 16).data;
    let u0 = 16, u1 = -1, v0 = 16;
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        if (px[(y * 16 + x) * 4 + 3] > 24) {
          u0 = Math.min(u0, x);
          u1 = Math.max(u1, x);
          v0 = Math.min(v0, y);
        }
    if (u1 < 0) continue;
    let lo = Math.min(2 + 0.75 * u0, 14 - 0.75 * (u1 + 1));
    lo = Math.min(Math.max(0, Math.floor(lo)), 6);
    const top = Math.max(3, 16 - v0);
    b.sel = [lo / 16, 0, lo / 16, (16 - lo) / 16, top / 16, (16 - lo) / 16];
  }

  // --------------------------------------------------------- icônes ------
  // Icônes isométriques des blocs et icônes plates des objets (data URL).
  const ICON = 64;
  function blockIcon(b) {
    const c = document.createElement('canvas');
    c.width = c.height = ICON;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const s = ICON / 32;
    // blocs partiels (dalles, tapis) : on ne dessine que le bas des faces latérales
    const h = b.render === 'slab' || b.render === 'carpet' ? Math.max(b.height, 2 / 16) : 1;
    const drop = 16 * (1 - h);
    const faces = [
      // [texture, a, b, c, d, e, f, assombrissement, face latérale]
      [b.tex.top, 15 / 16, -7.5 / 16, 15 / 16, 7.5 / 16, 1, 8 + drop, 0, false],
      [b.tex.front, 15 / 16, 7.5 / 16, 0, 1, 1, 8 + drop, 0.22, true],
      [b.tex.side, 15 / 16, -7.5 / 16, 0, 1, 16, 15.5 + drop, 0.42, true],
    ];
    for (const [tex, a, bb, cc, dd, e, f, dark, side] of faces) {
      ctx.setTransform(a * s, bb * s, cc * s, dd * s, e * s, f * s);
      if (side) ctx.drawImage(T.canvases[tex], 0, drop, 16, 16 - drop, 0, 0, 16, 16 - drop);
      else ctx.drawImage(T.canvases[tex], 0, 0);
      if (dark > 0) {
        ctx.fillStyle = 'rgba(0,0,0,' + dark + ')';
        ctx.fillRect(0, 0, 16, side ? 16 - drop : 16);
      }
    }
    return c.toDataURL();
  }
  function flatIcon(tex) {
    const c = document.createElement('canvas');
    c.width = c.height = ICON;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(T.canvases[tex], 0, 0, ICON, ICON);
    return c.toDataURL();
  }
  T.buildIcons = function () {
    for (const b of CM.blocks) {
      if (!b || !b.tex || b.id === 0) continue;
      const cubeLike = b.render === 'cube' || b.render === 'glass' || b.render === 'tglass' || b.render === 'slab' || b.render === 'carpet';
      T.icons[b.id] = cubeLike ? blockIcon(b) : flatIcon(b.iconTex || b.tex.side);
    }
    for (const it of CM.items) if (it) T.icons[it.id] = flatIcon(it.tex);
  };
})();
