'use strict';
// Construction des maillages des sections 16x16x16 (occlusion ambiante + lumière douce).
(function () {
  const { H, MINY } = CM.WORLD;
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
        this.u8[o8 + 13] = (flags || 0) | fk4[k];
        this.u16[o16 + 7] = col4[k];
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
  const ORIENT = new Uint8Array(65536); // orientation (+1) des blocs tournés : textures pivotées
  let LAYERS = null; // couches de texture par bloc et par face
  // Rotation des coordonnées de texture (quarts de tour autour du centre).
  const rotUV = (t, k) => {
    const u = t[3], v = t[4];
    if (k === 1) { t[3] = 16 - v; t[4] = u; } else if (k === 2) { t[3] = 16 - u; t[4] = 16 - v; } else if (k === 3) { t[3] = v; t[4] = 16 - u; }
  };
  // ROTK[face * 6 + d] : quarts de tour pour que le « haut » de la texture pointe vers d
  // (faces perpendiculaires à d ; les faces avant et arrière gardent leur sens).
  const ROTK = new Uint8Array(36);
  {
    const DV = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi];
      for (let d = 0; d < 6; d++) {
        if (Math.abs(f.n[0] * DV[d][0] + f.n[1] * DV[d][1] + f.n[2] * DV[d][2]) === 1) continue;
        for (let k = 0; k < 4; k++) {
          const uv = f.v.map((v) => {
            const t = [0, 0, 0, v[3], v[4]];
            rotUV(t, k);
            return t;
          });
          let dir = null;
          for (let a = 0; a < 4 && !dir; a++)
            for (let c = 0; c < 4; c++)
              if (a !== c && uv[a][3] === uv[c][3] && uv[a][4] < uv[c][4]) {
                dir = [f.v[a][0] - f.v[c][0], f.v[a][1] - f.v[c][1], f.v[a][2] - f.v[c][2]];
                break;
              }
          if (dir && dir[0] === DV[d][0] && dir[1] === DV[d][1] && dir[2] === DV[d][2]) {
            ROTK[fi * 6 + d] = k;
            break;
          }
        }
      }
    }
  }
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
        ORIENT[id] = b.orient !== undefined ? b.orient + 1 : 0;
        const lay = (n) => {
          if (L[n] === undefined) console.warn('Texture manquante : ' + n + ' (' + b.key + ')');
          return L[n] === undefined ? L.stone : L[n];
        };
        if (b.tex) LAYERS[id] = b.faces ? b.faces.map(lay) : [L[b.tex.side], L[b.tex.side], L[b.tex.top], L[b.tex.bottom], L[b.tex.front], L[b.tex.back || b.tex.side]];
        // modèles : boîtes avec leurs textures (une ou six)
        if (b.model) b._parts = b.model.map((q) => ({ b: q.b, L: typeof q.t === 'string' ? [0, 0, 0, 0, 0, 0].map(() => lay(q.t)) : q.t.map(lay) }));
      }
      // palette des couleurs de lumière (extension Lumière réaliste, voir light.js)
      EMIT.fill(0);
      for (const [i, e] of (CM.LIGHT_PAL || []).entries()) {
        PR[i] = e.c[0];
        PG[i] = e.c[1];
        PB[i] = e.c[2];
        PF[i] = e.f ? 1 : 0;
      }
      for (const b of CM.blocks) if (b && b.light >= 6 && !b.portal && b.render !== 'water' && b.render !== 'lava') EMIT[b.id] = 1;
      SPECIAL.dust = [L.rs_dust_line, L.rs_dust_dot, L.rs_dust_cross];
      SPECIAL.bedrock = [0, 0, 0, 0, 0, 0].map(() => L.bedrock);
      CM.blockLayers = LAYERS;
    },
    build,
  };

  const padId = new Uint16Array(P * P * P);
  const padL = new Uint8Array(P * P * P);
  const padC = new Uint8Array(P * P * P); // couleur de la lumière des blocs (index de palette)
  // Couleur de la lumière par sommet (RGB565, 0 = teinte chaude par défaut) et vacillement (drapeau 8)
  const col4 = [0, 0, 0, 0], fk4 = [0, 0, 0, 0];
  const PR = new Float32Array(256).fill(1), PG = new Float32Array(256).fill(0.82), PB = new Float32Array(256).fill(0.58), PF = new Uint8Array(256);
  const EMIT = new Uint8Array(65536); // sources de lumière (halos, flammes)
  let cr = 0, cg = 0, cb = 0, cw = 0, cf = 0;
  const colAdd = (q) => {
    const lb = padL[q] & 15;
    if (!lb) return;
    const w = lb * lb * lb, ci = padC[q];
    cr += PR[ci] * w;
    cg += PG[ci] * w;
    cb += PB[ci] * w;
    cf += PF[ci] * w;
    cw += w;
  };
  const colOut = (k) => {
    if (!cw) {
      col4[k] = 0;
      fk4[k] = 0;
    } else {
      const r = Math.min(31, Math.round((cr / cw) * 31)), g = Math.min(63, Math.round((cg / cw) * 63)), b = Math.min(31, Math.round((cb / cw) * 31));
      col4[k] = (r << 11) | (g << 5) | b || 1;
      fk4[k] = cf / cw > 0.5 ? 8 : 0;
    }
    cr = cg = cb = cw = cf = 0;
  };
  function setColFlat(q) {
    colAdd(q);
    colOut(0);
    col4[1] = col4[2] = col4[3] = col4[0];
    fk4[1] = fk4[2] = fk4[3] = fk4[0];
  }
  const SPECIAL = {}; // couches utiles aux rendus particuliers (fil de redstone…)
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
    const oy = MINY + sy * 16 - 1;
    let solidCount = 0;
    let p = 0;
    for (let py = 0; py < P; py++) {
      const y = oy + py;
      for (let pz = 0; pz < P; pz++) {
        const cz3 = PADC[pz] * 3, lz = PADL[pz];
        for (let px = 0; px < P; px++, p++) {
          padC[p] = 0;
          if (y < MINY) {
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
          const i = ((y - MINY) << 8) | (lz << 4) | PADL[px];
          const id = c.blocks[i];
          padId[p] = id;
          padL[p] = c.light[i];
          padC[p] = c.lcol[i];
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
      colAdd(n);
      if (!smooth || self) {
        ao4[k] = 3;
        sky4[k] = Math.round(ls * 17);
        blk4[k] = Math.round(lb * 17);
        colOut(k);
        continue;
      }
      const o1 = OPQ[padId[p + s1]], o2 = OPQ[padId[p + s2]], oc = OPQ[padId[p + c]];
      ao4[k] = smoothAO ? (o1 && o2 ? 0 : 3 - o1 - o2 - oc) : 3;
      let cnt = 1;
      if (!o1) { cnt++; ls += padL[p + s1] >> 4; lb += padL[p + s1] & 15; colAdd(p + s1); }
      if (!o2) { cnt++; ls += padL[p + s2] >> 4; lb += padL[p + s2] & 15; colAdd(p + s2); }
      if (!oc && !(o1 && o2)) { cnt++; ls += padL[p + c] >> 4; lb += padL[p + c] & 15; colAdd(p + c); }
      sky4[k] = Math.round((ls / cnt) * 17);
      blk4[k] = Math.round((lb / cnt) * 17);
      colOut(k);
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
    if (count === 0) return { opaque: null, water: null, emit: null };
    const emit = [];
    const defs = CM.blocks;
    const WATERY = CM.WATERY;
    const waving = opts.waving;
    // hauteur de la surface d'une case d'eau (en 1/16) : pleine sous de l'eau ou de la glace,
    // 14 pour une source ou une chute, de plus en plus basse en s'éloignant de la source
    const wTop = (pp) => {
      const ab = padId[pp + PP];
      if (ab !== BORDER && (WATERY[ab] === WATERY[padId[pp]] || (defs[ab] && defs[ab].render === 'tglass'))) return 16;
      const l = defs[padId[pp]].level;
      return l === 0 || l === 8 ? 14 : Math.max(2, 14 - Math.round(l * 1.6));
    };
    for (let ly = 0; ly < 16; ly++)
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const p = (ly + 1) * PP + (lz + 1) * P + (lx + 1);
          const id = padId[p];
          if (id === 0) continue;
          const b = defs[id];
          const bx = lx * 16, by = ly * 16, bz = lz * 16;
          col4[0] = col4[1] = col4[2] = col4[3] = fk4[0] = fk4[1] = fk4[2] = fk4[3] = 0;
          if (EMIT[id] && emit.length < 256) emit.push(cx * 16 + lx, MINY + sy * 16 + ly, cz * 16 + lz, id);
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
              if (ORIENT[id]) {
                const k = ROTK[fi * 6 + ORIENT[id] - 1];
                if (k) for (let q = 0; q < 4; q++) rotUV(vs[q], k);
              }
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
              if (WATERY[nid] === 1 && fi === 3) continue;
              faceLighting(p, f, false, false);
              setVerts(f, bx, by, bz, FACE_SHADE[fi], 16, false);
              emitQuad(waterBuf, layers[fi], false, 0);
            }
          } else if (r === 'water' || r === 'lava') {
            // eau (translucide) et lave (opaque et lumineuse) : même forme, hauteur selon le niveau
            const lava = r === 'lava', buf = lava ? opaqueBuf : waterBuf;
            const topH = wTop(p);
            const layer = LAYERS[id][2];
            for (let fi = 0; fi < 6; fi++) {
              const f = FACES[fi];
              const nid = padId[p + f.nOff];
              if (OPQ[nid]) continue;
              // contre un liquide plus bas du même genre : seule la partie qui dépasse est visible
              let baseH = 0;
              if (nid !== BORDER && WATERY[nid] === WATERY[id]) {
                if (fi === 2 || fi === 3) continue;
                baseH = wTop(p + f.nOff);
                if (baseH >= topH) continue;
              }
              // contre la glace : seule la surface reste visible
              if (fi !== 2 && nid !== BORDER && defs[nid] && defs[nid].render === 'tglass') continue;
              if (fi === 3 && nid !== 0) continue;
              if (lava) {
                for (let k = 0; k < 4; k++) sky4[k] = blk4[k] = 255;
              } else faceLighting(p, f, false, false);
              for (let k = 0; k < 4; k++) {
                const v = f.v[k];
                const t = vs[k];
                t[0] = bx + v[0] * 16;
                t[1] = by + (v[1] ? topH : baseH);
                t[2] = bz + v[2] * 16;
                t[3] = v[3];
                t[4] = v[4];
                sh4[k] = Math.round(255 * (lava ? 0.85 + FACE_SHADE[fi] * 0.15 : FACE_SHADE[fi]));
              }
              const flag = !lava && fi === 2 && topH === 14 ? 2 : 0;
              buf.quad(vs, layer, sky4, blk4, sh4, flag);
              // surface visible aussi depuis le dessous (sous l'eau)
              if (fi === 2 && !lava) {
                vtmp[0] = vs[3]; vtmp[1] = vs[2]; vtmp[2] = vs[1]; vtmp[3] = vs[0];
                waterBuf.quad(vtmp, layer, sky4, blk4, sh4, flag);
              }
            }
          } else if (r === 'portal') {
            // portail : plan épais translucide, lumineux ; pas de face entre deux blocs de portail
            const [x0, y0, z0, x1, y1, z1] = b.box;
            for (let fi = 0; fi < 6; fi++) {
              const nid = padId[p + FACES[fi].nOff];
              if (OPQ[nid] || (nid !== BORDER && defs[nid] && defs[nid].portal)) continue;
              const f = FACES[fi];
              for (let k = 0; k < 4; k++) {
                const v = f.v[k];
                const t = vs[k];
                t[0] = bx + (v[0] ? x1 : x0);
                t[1] = by + (v[1] ? y1 : y0);
                t[2] = bz + (v[2] ? z1 : z0);
                t[3] = v[3];
                t[4] = v[4];
                sky4[k] = blk4[k] = sh4[k] = 255;
              }
              waterBuf.quad(vs, LAYERS[id][fi], sky4, blk4, sh4, 0);
            }
          } else if (r === 'cross') {
            const l = padL[p];
            setColFlat(p);
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
          } else if (r === 'boxes') {
            for (const q of b.boxes) solidBox(opaqueBuf, LAYERS[id], bx, by, bz, q, p);
          } else if (r === 'model') {
            const o = ORIENT[id];
            for (const q of b._parts) solidBox(opaqueBuf, q.L, bx, by, bz, q.b, p, o);
          } else if (r === 'rsdiode') {
            // répéteur, comparateur : un répéteur alimenté par le côté est verrouillé (barre)
            const o = ORIENT[id], rs = b.rs;
            let locked = false;
            if (rs.k === 'repeater') {
              for (const s of rs.facing === 0 || rs.facing === 1 ? [4, 5] : [0, 1]) {
                const nb = defs[padId[p + NOFF[s]]];
                const nr = nb && nb.rs;
                if (nr && (nr.k === 'repeater' || nr.k === 'comparator') && nr.facing === OPP6[s] && nr.on) locked = true;
              }
            }
            for (let i = 0; i < b._parts.length; i++) if (!(locked && i === b.lockPart)) solidBox(opaqueBuf, b._parts[i].L, bx, by, bz, b._parts[i].b, p, o);
            if (locked) solidBox(opaqueBuf, SPECIAL.bedrock, bx, by, bz, b.lockBar, p, o);
          } else if (r === 'cable') {
            // câble électrique : un nœud et un bras vers chaque bloc électrique voisin
            solidBox(opaqueBuf, LAYERS[id], bx, by, bz, [5, 5, 5, 11, 11, 11], p);
            for (let d = 0; d < 6; d++) {
              const nb = defs[padId[p + NOFF[d]]];
              if (nb && nb.tech) solidBox(opaqueBuf, LAYERS[id], bx, by, bz, CABLE_ARM[d], p);
            }
          } else if (r === 'wire' || r === 'tripwire') {
            meshWire(b, id, p, bx, by, bz, r === 'wire');
          } else if (r === 'rail') {
            meshRail(b, id, p, bx, by, bz);
          } else if (r === 'fire') {
            // flammes : deux plans en croix et quatre plans près des bords, toujours lumineux
            for (let k = 0; k < 4; k++) {
              sky4[k] = 255;
              blk4[k] = 255;
              sh4[k] = 255;
            }
            const layer = LAYERS[id][0], ff = waving ? 5 : 0;
            crossQuad(bx + 2, bz + 2, bx + 14, bz + 14, by, layer, ff);
            crossQuad(bx + 14, bz + 2, bx + 2, bz + 14, by, layer, ff);
            crossQuad(bx + 1, bz, bx + 1, bz + 16, by, layer, ff);
            crossQuad(bx + 15, bz, bx + 15, bz + 16, by, layer, ff);
            crossQuad(bx, bz + 1, bx + 16, bz + 1, by, layer, ff);
            crossQuad(bx, bz + 15, bx + 16, bz + 15, by, layer, ff);
          } else if (r === 'torch') {
            // torche allumée : pleine lumière ; torche de redstone éteinte : lumière de la case
            const l = padL[p];
            setColFlat(p);
            for (let k = 0; k < 4; k++) {
              sky4[k] = b.light ? 255 : Math.round((l >> 4) * 17);
              blk4[k] = b.light ? 255 : Math.round((l & 15) * 17);
              sh4[k] = b.light ? 255 : 230;
            }
            if (b.wall) {
              // torche murale : pied contre le mur, penchée vers l'extérieur (sommet décalé de 4/16)
              const [dx, dz] = b.wall;
              const x0 = dx > 0 ? 0 : dx < 0 ? 14 : 7, z0 = dz > 0 ? 0 : dz < 0 ? 14 : 7;
              boxQuads(opaqueBuf, LAYERS[id][0], bx + x0, by + 3, bz + z0, bx + x0 + 2, by + 13, bz + z0 + 2, 7, 6, 9, 16, dx * 4, dz * 4);
            } else boxQuads(opaqueBuf, LAYERS[id][0], bx + 7, by, bz + 7, bx + 9, by + 10, bz + 9, 7, 6, 9, 16);
          }
        }
    return {
      emit: emit.length ? emit : null,
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
      const c0 = col4[0], f0 = fk4[0];
      col4[0] = col4[1]; col4[1] = col4[2]; col4[2] = col4[3]; col4[3] = c0;
      fk4[0] = fk4[1]; fk4[1] = fk4[2]; fk4[2] = fk4[3]; fk4[3] = f0;
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
  function solidBox(buf, layers, bx, by, bz, box, p, orient) {
    const l = padL[p];
    setColFlat(p);
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
      if (orient) {
        const k = ROTK[fi * 6 + orient - 1];
        if (k) for (let q = 0; q < 4; q++) rotUV(vs[q], k);
      }
      buf.quad(vs, layers[fi], sky4, blk4, sh4, 0);
    }
  }

  // ---- fil de redstone et ficelle : lignes à plat, reliées aux voisins ----
  const NOFF = [padOff(1, 0, 0), padOff(-1, 0, 0), padOff(0, 1, 0), padOff(0, -1, 0), padOff(0, 0, 1), padOff(0, 0, -1)];
  const OPP6 = [1, 0, 3, 2, 5, 4];
  const CABLE_ARM = [[11, 6, 6, 16, 10, 10], [0, 6, 6, 5, 10, 10], [6, 11, 6, 10, 16, 10], [6, 0, 6, 10, 5, 10], [6, 6, 11, 10, 10, 16], [6, 6, 0, 10, 10, 5]];
  const HD4 = [0, 1, 4, 5];
  let wireP = 0;
  const wireGet = (dx, dy, dz) => {
    const id = padId[wireP + padOff(dx, dy, dz)];
    return id === BORDER ? 0 : id;
  };
  // Quad horizontal (dessus) entre (x0, z0) et (x1, z1) à la hauteur y ; uv : 0 texture droite, 1 tournée.
  function flatQuad(x0, z0, x1, z1, y, layer, rot, flags) {
    const q = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
    for (let k = 0; k < 4; k++) {
      const t = vs[k];
      t[0] = q[k][0];
      t[1] = y;
      t[2] = q[k][1];
      // coordonnées de texture d'après la position dans la case
      const lx = t[0] - flatQuad.bx, lz = t[2] - flatQuad.bz;
      if (rot) {
        t[3] = lz;
        t[4] = lx;
      } else {
        t[3] = lx;
        t[4] = lz;
      }
    }
    opaqueBuf.quad(vs, layer, sky4, blk4, sh4, flags || 0);
  }
  function meshWire(b, id, p, bx, by, bz, isDust) {
    wireP = p;
    const l = padL[p];
    setColFlat(p);
    let sky = Math.round((l >> 4) * 17), bl = Math.round((l & 15) * 17), sh = 235;
    let layers, sides, up = 0;
    if (isDust) {
      const c = CM.RSX.wireConn(wireGet);
      sides = c.sides;
      up = c.up;
      const lv = b.rs.level;
      sh = Math.round(255 * (0.32 + 0.68 * (lv / 15)));
      bl = Math.max(bl, lv * 9);
      layers = SPECIAL.dust;
    } else {
      sides = CM.RSX.tripConn(wireGet);
      layers = [LAYERS[id][0], LAYERS[id][0], LAYERS[id][0]];
    }
    for (let k = 0; k < 4; k++) {
      sky4[k] = sky;
      blk4[k] = bl;
      sh4[k] = sh;
    }
    flatQuad.bx = bx;
    flatQuad.bz = bz;
    const y = by + 1;
    const E = sides & 1, W = sides & 2, S = sides & 4, N = sides & 8;
    const cnt = (E ? 1 : 0) + (W ? 1 : 0) + (S ? 1 : 0) + (N ? 1 : 0);
    if (cnt === 0) {
      if (isDust) flatQuad(bx, bz, bx + 16, bz + 16, y, layers[2], 0);
      else flatQuad(bx, bz, bx + 16, bz + 16, y, layers[0], 0);
    } else if (!(E || W)) flatQuad(bx, bz, bx + 16, bz + 16, y, layers[0], 0); // nord-sud
    else if (!(S || N)) flatQuad(bx, bz, bx + 16, bz + 16, y, layers[0], 1); // est-ouest
    else {
      if (isDust) flatQuad(bx + 4, bz + 4, bx + 12, bz + 12, y, layers[1], 0);
      if (E) flatQuad(bx + 8, bz, bx + 16, bz + 16, y, layers[0], 1);
      if (W) flatQuad(bx, bz, bx + 8, bz + 16, y, layers[0], 1);
      if (S) flatQuad(bx, bz + 8, bx + 16, bz + 16, y, layers[0], 0);
      if (N) flatQuad(bx, bz, bx + 16, bz + 8, y, layers[0], 0);
    }
    // le fil grimpe sur le flanc du bloc voisin
    if (up) {
      for (let k = 0; k < 4; k++) {
        if (!(up & (1 << k))) continue;
        const d = HD4[k];
        const xa = d === 0 ? bx + 15 : d === 1 ? bx + 1 : bx, xb = d === 0 ? bx + 15 : d === 1 ? bx + 1 : bx + 16;
        const za = d === 4 ? bz + 15 : d === 5 ? bz + 1 : bz, zb = d === 4 ? bz + 15 : d === 5 ? bz + 1 : bz + 16;
        const q = [[xa, by, za, 0, 16], [xb, by, zb, 16, 16], [xb, by + 16, zb, 16, 0], [xa, by + 16, za, 0, 0]];
        for (let i = 0; i < 4; i++) {
          const t = vs[i];
          t[0] = q[i][0];
          t[1] = q[i][1];
          t[2] = q[i][2];
          // ligne verticale : u à travers la face, v le long de la hauteur
          t[3] = q[i][3];
          t[4] = q[i][4];
        }
        opaqueBuf.quad(vs, layers[0], sky4, blk4, sh4, 0);
        vtmp[0] = vs[3]; vtmp[1] = vs[2]; vtmp[2] = vs[1]; vtmp[3] = vs[0];
        opaqueBuf.quad(vtmp, layers[0], sky4, blk4, sh4, 0);
      }
    }
  }
  // ---- rails : à plat, en montée ou en virage ----
  function meshRail(b, id, p, bx, by, bz) {
    const l = padL[p];
    setColFlat(p);
    const sky = Math.round((l >> 4) * 17), bl = Math.round((l & 15) * 17);
    for (let k = 0; k < 4; k++) {
      sky4[k] = sky;
      blk4[k] = bl;
      sh4[k] = 235;
    }
    const s = b.rs.shape, layer = LAYERS[id][0];
    // coins (0,0) (16,0) (16,16) (0,16) : hauteurs selon la montée
    const h = [1, 1, 1, 1];
    if (s === 2) { h[1] = h[2] = 17; } // monte vers l'est (+x)
    else if (s === 3) { h[0] = h[3] = 17; } // vers l'ouest
    else if (s === 4) { h[2] = h[3] = 17; } // vers le sud (+z)
    else if (s === 5) { h[0] = h[1] = 17; } // vers le nord
    const cx = [0, 16, 16, 0], cz = [0, 0, 16, 16];
    // rotation de la texture : rails droits dessinés nord-sud, virage dessiné sud-est
    // (un quart de tour de rotUV fait tourner la texture dans le sens inverse des aiguilles d'une montre)
    const rot = s === 1 || s === 2 || s === 3 ? 1 : s === 7 ? 3 : s === 8 ? 2 : s === 9 ? 1 : 0;
    const order = [3, 2, 1, 0];
    for (let i = 0; i < 4; i++) {
      const c = order[i];
      const t = vs[i];
      t[0] = bx + cx[c];
      t[1] = by + h[c];
      t[2] = bz + cz[c];
      t[3] = cx[c];
      t[4] = cz[c];
      if (rot) rotUV(t, rot);
    }
    opaqueBuf.quad(vs, layer, sky4, blk4, sh4, 0);
    vtmp[0] = vs[3]; vtmp[1] = vs[2]; vtmp[2] = vs[1]; vtmp[3] = vs[0];
    opaqueBuf.quad(vtmp, layer, sky4, blk4, sh4, 0);
  }

  // Petite boîte (torche) avec coordonnées de texture personnalisées.
  // shx, shz : décalage du haut de la boîte (torche penchée) ; le dessous est alors visible.
  function boxQuads(buf, layer, x0, y0, z0, x1, y1, z1, u0, v0, u1, v1, shx, shz) {
    const lean = !!(shx || shz);
    for (let fi = 0; fi < 6; fi++) {
      if (fi === 3 && !lean) continue;
      const f = FACES[fi];
      const q = f.v.map((v) => {
        let u = v[3] ? u1 : u0;
        let vv = v[4] ? v1 : v0;
        if (fi === 2) vv = v[4] ? v0 + 2 : v0;
        else if (fi === 3) vv = v[4] ? v1 : v1 - 2;
        const top = v[1] ? 1 : 0;
        return [(v[0] ? x1 : x0) + (top ? shx || 0 : 0), v[1] ? y1 : y0, (v[2] ? z1 : z0) + (top ? shz || 0 : 0), u, vv];
      });
      buf.quad(q, layer, sky4, blk4, sh4, 0);
    }
  }
})();
