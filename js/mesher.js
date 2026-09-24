'use strict';
// Construction des maillages des sections 16x16x16 (occlusion ambiante + lumière douce).
(function () {
  const { H } = CM.WORLD;
  const P = 18; // taille de la copie locale avec bordure
  const PP = P * P;
  const BORDER = 0xffff;

  // Format de sommet (16 octets) : int16 x,y,z (1/16 de bloc), int16 uv (u*32+v)
  //                                 uint16 couche, uint8 ciel, bloc, ombrage, drapeaux, 2 octets libres
  // Drapeaux : 1 = ondule au vent (feuilles, plantes), 2 = eau (vagues), 4 = plante (pied fixe)
  const STRIDE = 16;
  CM.VERTEX_STRIDE = STRIDE;
  class QuadBuf {
    constructor(cap) {
      this.alloc(cap);
      this.n = 0;
    }
    alloc(cap) {
      const old = this.u8;
      this.cap = cap;
      this.buf = new ArrayBuffer(cap * STRIDE * 4);
      this.i16 = new Int16Array(this.buf);
      this.u16 = new Uint16Array(this.buf);
      this.u8 = new Uint8Array(this.buf);
      if (old) this.u8.set(old.subarray(0, Math.min(old.length, this.u8.length)));
    }
    reset() {
      this.n = 0;
    }
    // Ajoute un quad : 4 sommets [x,y,z,u,v] + lumières par sommet.
    quad(vs, layer, sky, blk, shade, flags) {
      if (this.n >= this.cap) this.alloc(this.cap * 2);
      const base = this.n * 4;
      for (let k = 0; k < 4; k++) {
        const v = vs[k];
        const o16 = (base + k) * 8;
        const o8 = (base + k) * STRIDE;
        this.i16[o16] = v[0];
        this.i16[o16 + 1] = v[1];
        this.i16[o16 + 2] = v[2];
        this.i16[o16 + 3] = v[3] * 32 + v[4];
        this.u16[o16 + 4] = layer;
        this.u8[o8 + 10] = sky[k];
        this.u8[o8 + 11] = blk[k];
        this.u8[o8 + 12] = shade[k];
        this.u8[o8 + 13] = flags || 0;
      }
      this.n++;
    }
    result() {
      return { data: this.u8.slice(0, this.n * 4 * STRIDE), quads: this.n };
    }
  }

  // Faces : 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z. Sommets [cx,cy,cz,u,v] (u,v en pixels).
  const FACES = [
    { n: [1, 0, 0], v: [[1, 0, 1, 0, 16], [1, 0, 0, 16, 16], [1, 1, 0, 16, 0], [1, 1, 1, 0, 0]] },
    { n: [-1, 0, 0], v: [[0, 0, 0, 0, 16], [0, 0, 1, 16, 16], [0, 1, 1, 16, 0], [0, 1, 0, 0, 0]] },
    { n: [0, 1, 0], v: [[0, 1, 1, 0, 16], [1, 1, 1, 16, 16], [1, 1, 0, 16, 0], [0, 1, 0, 0, 0]] },
    { n: [0, -1, 0], v: [[0, 0, 0, 0, 16], [1, 0, 0, 16, 16], [1, 0, 1, 16, 0], [0, 0, 1, 0, 0]] },
    { n: [0, 0, 1], v: [[0, 0, 1, 0, 16], [1, 0, 1, 16, 16], [1, 1, 1, 16, 0], [0, 1, 1, 0, 0]] },
    { n: [0, 0, -1], v: [[1, 0, 0, 0, 16], [0, 0, 0, 16, 16], [0, 1, 0, 16, 0], [1, 1, 0, 0, 0]] },
  ];
  CM.FACES = FACES;
  const FACE_SHADE = [0.64, 0.64, 1.0, 0.5, 0.82, 0.82];
  const AO_CURVE = [0.48, 0.66, 0.83, 1.0];
  const padOff = (dx, dy, dz) => dy * PP + dz * P + dx;

  // Décalages (dans la copie locale) des voisins utilisés pour l'AO de chaque sommet.
  for (const f of FACES) {
    const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
    const t1 = axis === 0 ? 1 : 0;
    const t2 = axis === 2 ? 1 : 2;
    f.nOff = padOff(f.n[0], f.n[1], f.n[2]);
    f.ao = f.v.map((v) => {
      const d1 = [0, 0, 0], d2 = [0, 0, 0];
      d1[t1] = v[t1] ? 1 : -1;
      d2[t2] = v[t2] ? 1 : -1;
      const s1 = padOff(f.n[0] + d1[0], f.n[1] + d1[1], f.n[2] + d1[2]);
      const s2 = padOff(f.n[0] + d2[0], f.n[1] + d2[1], f.n[2] + d2[2]);
      const c = padOff(f.n[0] + d1[0] + d2[0], f.n[1] + d1[1] + d2[1], f.n[2] + d1[2] + d2[2]);
      return [s1, s2, c];
    });
  }

  // Tables par identifiant de bloc (65536 entrées pour couvrir la valeur BORDER).
  const OPQ = new Uint8Array(65536); // cube plein opaque (cache les faces voisines)
  const SHAPE_H = new Uint8Array(65536); // hauteur (1/16) des blocs partiels opaques (dalles, tapis)
  const WAVE = new Uint8Array(65536); // ondule au vent
  let LAYERS = null; // couches de texture par bloc et par face
  const opts = { smoothLight: true, waving: true };
  CM.Mesher = {
    opts,
    init() {
      OPQ.fill(0);
      SHAPE_H.fill(0);
      WAVE.fill(0);
      OPQ[BORDER] = 1;
      LAYERS = [];
      const L = CM.Textures.layer;
      for (let id = 0; id < CM.blocks.length; id++) {
        const b = CM.blocks[id];
        if (!b) continue;
        OPQ[id] = b.opaque && b.render === 'cube' ? 1 : 0;
        if ((b.render === 'slab' || b.render === 'carpet') && b.opaque) SHAPE_H[id] = Math.round(b.height * 16);
        WAVE[id] = b.wave ? 1 : 0;
        if (b.tex) LAYERS[id] = [L[b.tex.side], L[b.tex.side], L[b.tex.top], L[b.tex.bottom], L[b.tex.front], L[b.tex.back || b.tex.side]];
      }
      CM.blockLayers = LAYERS;
    },
    build,
  };

  const padId = new Uint16Array(P * P * P);
  const padL = new Uint8Array(P * P * P);
  const opaqueBuf = new QuadBuf(4096);
  const waterBuf = new QuadBuf(1024);
  const vs = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  const sky4 = [0, 0, 0, 0], blk4 = [0, 0, 0, 0], sh4 = [0, 0, 0, 0], ao4 = [0, 0, 0, 0];
  const vtmp = [null, null, null, null];

  // Tables : pour chaque position de la copie locale, tronçon voisin (0..2) et coordonnée locale.
  const PADC = new Int8Array(P), PADL = new Int8Array(P);
  for (let p = 0; p < P; p++) {
    const l = p - 1;
    PADC[p] = l < 0 ? 0 : l > 15 ? 2 : 1;
    PADL[p] = l & 15;
  }
  const near = new Array(9);

  // Copie la section (cx, sy, cz) et une bordure d'un bloc lue dans les 8 tronçons voisins.
  function fillPad(world, cx, sy, cz) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) near[(dz + 1) * 3 + dx + 1] = world.chunks.get(CM.ckey(cx + dx, cz + dz)) || null;
    const oy = sy * 16 - 1;
    let solidCount = 0;
    let p = 0;
    for (let py = 0; py < P; py++) {
      const y = oy + py;
      for (let pz = 0; pz < P; pz++) {
        const cz3 = PADC[pz] * 3, lz = PADL[pz];
        for (let px = 0; px < P; px++, p++) {
          if (y < 0) {
            padId[p] = BORDER;
            padL[p] = 0;
            continue;
          }
          if (y >= H) {
            padId[p] = 0;
            padL[p] = 0xf0;
            continue;
          }
          const c = near[cz3 + PADC[px]];
          if (!c) {
            padId[p] = BORDER;
            padL[p] = 0xf0;
            continue;
          }
          const i = (y << 8) | (lz << 4) | PADL[px];
          const id = c.blocks[i];
          padId[p] = id;
          padL[p] = c.light[i];
          if (id && px > 0 && px < 17 && py > 0 && py < 17 && pz > 0 && pz < 17) solidCount++;
        }
      }
    }
    return solidCount;
  }

  // Lumière douce et AO pour une face de cube. self : lumière lue dans la case elle-même
  // (faces internes des blocs partiels, qui ne touchent pas la case voisine).
  function faceLighting(p, f, smoothAO, self) {
    const n = self ? p : p + f.nOff;
    const smooth = opts.smoothLight;
    for (let k = 0; k < 4; k++) {
      const [s1, s2, c] = f.ao[k];
      let ls = padL[n] >> 4, lb = padL[n] & 15;
      if (!smooth || self) {
        ao4[k] = 3;
        sky4[k] = Math.round(ls * 17);
        blk4[k] = Math.round(lb * 17);
        continue;
      }
      const o1 = OPQ[padId[p + s1]], o2 = OPQ[padId[p + s2]], oc = OPQ[padId[p + c]];
      ao4[k] = smoothAO ? (o1 && o2 ? 0 : 3 - o1 - o2 - oc) : 3;
      let cnt = 1;
      if (!o1) { cnt++; ls += padL[p + s1] >> 4; lb += padL[p + s1] & 15; }
      if (!o2) { cnt++; ls += padL[p + s2] >> 4; lb += padL[p + s2] & 15; }
      if (!oc && !(o1 && o2)) { cnt++; ls += padL[p + c] >> 4; lb += padL[p + c] & 15; }
      sky4[k] = Math.round((ls / cnt) * 17);
      blk4[k] = Math.round((lb / cnt) * 17);
    }
  }

  function setVerts(f, bx, by, bz, fs, hgt, useAO) {
    for (let k = 0; k < 4; k++) {
      const v = f.v[k];
      const t = vs[k];
      t[0] = bx + v[0] * 16;
      t[1] = by + v[1] * hgt;
      t[2] = bz + v[2] * 16;
      t[3] = v[3];
      // faces latérales des blocs partiels : bas de la texture
      t[4] = hgt < 16 && f.n[1] === 0 ? (v[4] ? 16 : 16 - hgt) : v[4];
      sh4[k] = Math.round(255 * fs * (useAO ? AO_CURVE[ao4[k]] : 1));
    }
  }

  function build(world, cx, sy, cz) {
    opaqueBuf.reset();
    waterBuf.reset();
    const count = fillPad(world, cx, sy, cz);
    if (count === 0) return { opaque: null, water: null };
    const defs = CM.blocks;
    const WATER = CM.B.WATER;
    const waving = opts.waving;
    for (let ly = 0; ly < 16; ly++)
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const p = (ly + 1) * PP + (lz + 1) * P + (lx + 1);
          const id = padId[p];
          if (id === 0) continue;
          const b = defs[id];
          const bx = lx * 16, by = ly * 16, bz = lz * 16;
          const r = b.render;
          const wflag = waving && WAVE[id] ? 1 : 0;
          if (r === 'cube' || r === 'glass') {
            const layers = LAYERS[id];
            for (let fi = 0; fi < 6; fi++) {
              const f = FACES[fi];
              const nid = padId[p + f.nOff];
              if (OPQ[nid] || (nid === id && r === 'glass')) continue;
              faceLighting(p, f, true, false);
              setVerts(f, bx, by, bz, FACE_SHADE[fi], 16, true);
              emitQuad(opaqueBuf, layers[fi], ao4[0] + ao4[2] < ao4[1] + ao4[3], wflag);
            }
          } else if (r === 'slab' || r === 'carpet') {
            const layers = LAYERS[id];
            const hgt = Math.round(b.height * 16);
            for (let fi = 0; fi < 6; fi++) {
              const f = FACES[fi];
              const nid = padId[p + f.nOff];
              if (fi === 2) {
                // dessus : à mi-hauteur, jamais caché par le voisin du dessus
                faceLighting(p, f, false, true);
                setVerts(f, bx, by, bz, FACE_SHADE[fi], hgt, false);
                emitQuad(opaqueBuf, layers[fi], false, 0);
                continue;
              }
              if (OPQ[nid]) continue;
              if (fi !== 3 && SHAPE_H[nid] >= hgt) continue;
              faceLighting(p, f, fi === 3, fi !== 3);
              setVerts(f, bx, by, bz, FACE_SHADE[fi], hgt, fi === 3);
              emitQuad(opaqueBuf, layers[fi], false, 0);
            }
          } else if (r === 'tglass') {
            // verre teinté, glace, miel, slime : translucides, dessinés avec l'eau
            const layers = LAYERS[id];
            for (let fi = 0; fi < 6; fi++) {
              const f = FACES[fi];
              const nid = padId[p + f.nOff];
              if (nid === id || OPQ[nid]) continue;
              // pas de face contre l'eau sous la glace (évite les faces superposées)
              if (nid === WATER && fi === 3) continue;
              faceLighting(p, f, false, false);
              setVerts(f, bx, by, bz, FACE_SHADE[fi], 16, false);
              emitQuad(waterBuf, layers[fi], false, 0);
            }
          } else if (r === 'water') {
            const above = padId[p + PP];
            // sous la glace, la surface monte jusqu'en haut du bloc (pas de fente)
            const underT = above !== BORDER && defs[above] && defs[above].render === 'tglass';
            const topH = above === WATER || underT ? 16 : 14;
            const layer = LAYERS[id][2];
            for (let fi = 0; fi < 6; fi++) {
              const f = FACES[fi];
              const nid = padId[p + f.nOff];
              if (nid === WATER || OPQ[nid]) continue;
              // contre la glace : seule la surface reste visible
              if (fi !== 2 && nid !== BORDER && defs[nid] && defs[nid].render === 'tglass') continue;
              if (fi === 3 && nid !== 0) continue;
              faceLighting(p, f, false, false);
              for (let k = 0; k < 4; k++) {
                const v = f.v[k];
                const t = vs[k];
                t[0] = bx + v[0] * 16;
                t[1] = by + (v[1] ? topH : 0);
                t[2] = bz + v[2] * 16;
                t[3] = v[3];
                t[4] = v[4];
                sh4[k] = Math.round(255 * FACE_SHADE[fi]);
              }
              const flag = fi === 2 && topH === 14 ? 2 : 0;
              waterBuf.quad(vs, layer, sky4, blk4, sh4, flag);
              // surface visible aussi depuis le dessous (sous l'eau)
              if (fi === 2) {
                vtmp[0] = vs[3]; vtmp[1] = vs[2]; vtmp[2] = vs[1]; vtmp[3] = vs[0];
                waterBuf.quad(vtmp, layer, sky4, blk4, sh4, flag);
              }
            }
          } else if (r === 'cross') {
            const l = padL[p];
            const s = Math.round((l >> 4) * 17), bl = Math.round((l & 15) * 17);
            for (let k = 0; k < 4; k++) {
              sky4[k] = s;
              blk4[k] = bl;
              sh4[k] = 235;
            }
            const layer = LAYERS[id][0];
            const a = 2, c = 14;
            const pf = wflag ? 5 : 0; // plante : ondule, pied fixe
            crossQuad(bx + a, bz + a, bx + c, bz + c, by, layer, pf);
            crossQuad(bx + c, bz + a, bx + a, bz + c, by, layer, pf);
          } else if (r === 'door') {
            solidBox(opaqueBuf, LAYERS[id], bx, by, bz, b.box, p);
          } else if (r === 'torch') {
            for (let k = 0; k < 4; k++) {
              sky4[k] = 255;
              blk4[k] = 255;
              sh4[k] = 255;
            }
            boxQuads(opaqueBuf, LAYERS[id][0], bx + 7, by, bz + 7, bx + 9, by + 10, bz + 9, 7, 6, 9, 16);
          }
        }
    return {
      opaque: opaqueBuf.n ? opaqueBuf.result() : null,
      water: waterBuf.n ? waterBuf.result() : null,
    };
  }

  function emitQuad(buf, layer, flip, flags) {
    if (flip) {
      vtmp[0] = vs[1]; vtmp[1] = vs[2]; vtmp[2] = vs[3]; vtmp[3] = vs[0];
      const s0 = sky4[0], b0 = blk4[0], h0 = sh4[0];
      sky4[0] = sky4[1]; sky4[1] = sky4[2]; sky4[2] = sky4[3]; sky4[3] = s0;
      blk4[0] = blk4[1]; blk4[1] = blk4[2]; blk4[2] = blk4[3]; blk4[3] = b0;
      sh4[0] = sh4[1]; sh4[1] = sh4[2]; sh4[2] = sh4[3]; sh4[3] = h0;
      buf.quad(vtmp, layer, sky4, blk4, sh4, flags);
    } else buf.quad(vs, layer, sky4, blk4, sh4, flags);
  }

  // Plan diagonal double face pour les plantes.
  function crossQuad(x0, z0, x1, z1, y, layer, flags) {
    const q = [[x0, y, z0, 0, 16], [x1, y, z1, 16, 16], [x1, y + 16, z1, 16, 0], [x0, y + 16, z0, 0, 0]];
    opaqueBuf.quad(q, layer, sky4, blk4, sh4, flags);
    const r = [q[1], q[0], q[3], q[2]];
    opaqueBuf.quad(r, layer, sky4, blk4, sh4, flags);
  }

  // Boîte pleine (porte) dans la case : box = [x0, y0, z0, x1, y1, z1] en 1/16 de bloc.
  // Texture calée sur la grille du bloc, éclairage de la case elle-même.
  function solidBox(buf, layers, bx, by, bz, box, p) {
    const l = padL[p];
    const s = Math.round((l >> 4) * 17), bl = Math.round((l & 15) * 17);
    const [x0, y0, z0, x1, y1, z1] = box;
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi];
      const sh = Math.round(255 * FACE_SHADE[fi]);
      for (let k = 0; k < 4; k++) {
        const v = f.v[k];
        const X = v[0] ? x1 : x0, Y = v[1] ? y1 : y0, Z = v[2] ? z1 : z0;
        const t = vs[k];
        t[0] = bx + X;
        t[1] = by + Y;
        t[2] = bz + Z;
        if (f.n[0]) {
          t[3] = f.n[0] > 0 ? 16 - Z : Z;
          t[4] = 16 - Y;
        } else if (f.n[2]) {
          t[3] = f.n[2] > 0 ? X : 16 - X;
          t[4] = 16 - Y;
        } else {
          t[3] = X;
          t[4] = f.n[1] > 0 ? Z : 16 - Z;
        }
        sky4[k] = s;
        blk4[k] = bl;
        sh4[k] = sh;
      }
      buf.quad(vs, layers[fi], sky4, blk4, sh4, 0);
    }
  }

  // Petite boîte (torche) avec coordonnées de texture personnalisées.
  function boxQuads(buf, layer, x0, y0, z0, x1, y1, z1, u0, v0, u1, v1) {
    for (let fi = 0; fi < 6; fi++) {
      if (fi === 3) continue;
      const f = FACES[fi];
      const q = f.v.map((v) => {
        let u = v[3] ? u1 : u0;
        let vv = v[4] ? v1 : v0;
        if (fi === 2) vv = v[4] ? v0 + 2 : v0;
        return [v[0] ? x1 : x0, v[1] ? y1 : y0, v[2] ? z1 : z0, u, vv];
      });
      buf.quad(q, layer, sky4, blk4, sh4, 0);
    }
  }
})();
