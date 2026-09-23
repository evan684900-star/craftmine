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
  make('wool', (d, r) => {
    fill(d, r, [236, 236, 228], 7);
    for (let k = 0; k < 14; k++) {
      const x = Math.floor(r() * 15), y = Math.floor(r() * 15);
      put(d, x, y, [212, 212, 202]);
      put(d, x + 1, y + 1, [212, 212, 202]);
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
  const TIER_COLORS = [
    null,
    { h: [178, 138, 84], H: [206, 166, 110], d: [132, 98, 58] },
    { h: [138, 138, 140], H: [170, 170, 174], d: [96, 96, 100] },
    { h: [214, 214, 222], H: [244, 244, 250], d: [150, 150, 162] },
    { h: [80, 214, 232], H: [190, 250, 255], d: [36, 150, 176] },
  ];
  for (const type of Object.keys(TOOL_ART)) {
    for (let tier = 1; tier <= 4; tier++) {
      make(type + '_' + tier, (d) => {
        clear(d);
        const pal = Object.assign({ s: [138, 100, 58], S: [96, 68, 38], g: [90, 70, 50] }, TIER_COLORS[tier]);
        art(d, TOOL_ART[type], pal);
      });
    }
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

  // --------------------------------------------------------- icônes ------
  // Icônes isométriques des blocs et icônes plates des objets (data URL).
  const ICON = 64;
  function blockIcon(b) {
    const c = document.createElement('canvas');
    c.width = c.height = ICON;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const s = ICON / 32;
    const faces = [
      // [texture, a, b, c, d, e, f, assombrissement]
      [b.tex.top, 15 / 16, -7.5 / 16, 15 / 16, 7.5 / 16, 1, 8, 0],
      [b.tex.front, 15 / 16, 7.5 / 16, 0, 1, 1, 8, 0.22],
      [b.tex.side, 15 / 16, -7.5 / 16, 0, 1, 16, 15.5, 0.42],
    ];
    for (const [tex, a, bb, cc, dd, e, f, dark] of faces) {
      ctx.setTransform(a * s, bb * s, cc * s, dd * s, e * s, f * s);
      ctx.drawImage(T.canvases[tex], 0, 0);
      if (dark > 0) {
        ctx.fillStyle = 'rgba(0,0,0,' + dark + ')';
        ctx.fillRect(0, 0, 16, 16);
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
      T.icons[b.id] = b.render === 'cube' || b.render === 'glass' ? blockIcon(b) : flatIcon(b.tex.side);
    }
    for (const it of CM.items) if (it) T.icons[it.id] = flatIcon(it.tex);
  };
})();
