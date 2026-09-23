'use strict';
// Construction des maillages des sections 16x16x16 (occlusion ambiante + lumière douce).
(function () {
  const { W, D, H } = CM.WORLD;
  const P = 18; // taille de la copie locale avec bordure
  const PP = P * P;
  const BORDER = 255;

  // Format de sommet (12 octets) : int16 x,y,z (1/16 de bloc), int16 uv (u*32+v)
  //                                 uint8 couche, ciel, bloc, ombrage
  class QuadBuf {
    constructor(cap) {
      this.alloc(cap);
      this.n = 0;
    }
    alloc(cap) {
      const old = this.u8;
      this.cap = cap;
      this.buf = new ArrayBuffer(cap * 48);
      this.i16 = new Int16Array(this.buf);
      this.u8 = new Uint8Array(this.buf);
      if (old) this.u8.set(old.subarray(0, Math.min(old.length, this.u8.length)));
    }
    reset() {
      this.n = 0;
    }
    // Ajoute un quad : 4 sommets [x,y,z,u,v] + lumières par sommet.
    quad(vs, layer, sky, blk, shade) {
      if (this.n >= this.cap) this.alloc(this.cap * 2);
      const base = this.n * 4;
      for (let k = 0; k < 4; k++) {
        const v = vs[k];
        const o16 = (base + k) * 6;
        const o8 = (base + k) * 12;
        this.i16[o16] = v[0];
        this.i16[o16 + 1] = v[1];
        this.i16[o16 + 2] = v[2];
        this.i16[o16 + 3] = v[3] * 32 + v[4];
        this.u8[o8 + 8] = layer;
        this.u8[o8 + 9] = sky[k];
        this.u8[o8 + 10] = blk[k];
        this.u8[o8 + 11] = shade[k];
      }
      this.n++;
    }
    result() {
      return { data: this.u8.slice(0, this.n * 48), quads: this.n };
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

  let OPQ = null; // opaque visuellement (cube plein)
  let LAYERS = null; // couches de texture par bloc et par face
  CM.Mesher = {
    init() {
      OPQ = new Uint8Array(256);
      LAYERS = [];
      for (let id = 0; id < 256; id++) {
        const b = CM.blocks[id];
        if (!b) {
          OPQ[id] = id === BORDER ? 1 : 0;
          continue;
        }
        OPQ[id] = b.opaque && b.render === 'cube' ? 1 : 0;
        if (b.tex) {
          const L = CM.Textures.layer;
          LAYERS[id] = [L[b.tex.side], L[b.tex.side], L[b.tex.top], L[b.tex.bottom], L[b.tex.front], L[b.tex.front]];
        }
      }
      CM.blockLayers = LAYERS;
    },
    build,
  };

  const padId = new Uint8Array(P * P * P);
  const padL = new Uint8Array(P * P * P);
  const opaqueBuf = new QuadBuf(4096);
  const waterBuf = new QuadBuf(1024);
  const vs = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  const sky4 = [0, 0, 0, 0], blk4 = [0, 0, 0, 0], sh4 = [0, 0, 0, 0], ao4 = [0, 0, 0, 0];
  const vtmp = [null, null, null, null];

  function fillPad(world, sx, sy, sz) {
    const blocks = world.blocks, light = world.light;
    const ox = sx * 16 - 1, oy = sy * 16 - 1, oz = sz * 16 - 1;
    let solidCount = 0;
    let p = 0;
    for (let py = 0; py < P; py++) {
      const y = oy + py;
      for (let pz = 0; pz < P; pz++) {
        const z = oz + pz;
        for (let px = 0; px < P; px++, p++) {
          const x = ox + px;
          if (y < 0) {
            padId[p] = BORDER;
            padL[p] = 0;
          } else if (y >= H) {
            padId[p] = 0;
            padL[p] = 0xf0;
          } else if (x < 0 || x >= W || z < 0 || z >= D) {
            padId[p] = BORDER;
            padL[p] = 0xf0;
          } else {
            const i = (y * D + z) * W + x;
            const id = blocks[i];
            padId[p] = id;
            padL[p] = light[i];
            if (id && px > 0 && px < 17 && py > 0 && py < 17 && pz > 0 && pz < 17) solidCount++;
          }
        }
      }
    }
    return solidCount;
  }

  // Lumière douce et AO pour une face de cube.
  function faceLighting(p, f, smoothAO) {
    const n = p + f.nOff;
    for (let k = 0; k < 4; k++) {
      const [s1, s2, c] = f.ao[k];
      const o1 = OPQ[padId[p + s1]], o2 = OPQ[padId[p + s2]], oc = OPQ[padId[p + c]];
      ao4[k] = smoothAO ? (o1 && o2 ? 0 : 3 - o1 - o2 - oc) : 3;
      let cnt = 1;
      let ls = padL[n] >> 4, lb = padL[n] & 15;
      if (!o1) { cnt++; ls += padL[p + s1] >> 4; lb += padL[p + s1] & 15; }
      if (!o2) { cnt++; ls += padL[p + s2] >> 4; lb += padL[p + s2] & 15; }
      if (!oc && !(o1 && o2)) { cnt++; ls += padL[p + c] >> 4; lb += padL[p + c] & 15; }
      sky4[k] = Math.round((ls / cnt) * 17);
      blk4[k] = Math.round((lb / cnt) * 17);
    }
  }

  function build(world, sx, sy, sz) {
    opaqueBuf.reset();
    waterBuf.reset();
    const count = fillPad(world, sx, sy, sz);
    if (count === 0) return { opaque: null, water: null };
    const defs = CM.blocks;
    const WATER = CM.B.WATER;
    for (let ly = 0; ly < 16; ly++)
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          const p = (ly + 1) * PP + (lz + 1) * P + (lx + 1);
          const id = padId[p];
          if (id === 0) continue;
          const b = defs[id];
          const bx = lx * 16, by = ly * 16, bz = lz * 16;
          const r = b.render;
          if (r === 'cube' || r === 'glass') {
            const layers = LAYERS[id];
            for (let fi = 0; fi < 6; fi++) {
              const f = FACES[fi];
              const nid = padId[p + f.nOff];
              if (OPQ[nid] || (nid === id && r === 'glass')) continue;
              faceLighting(p, f, true);
              const fs = FACE_SHADE[fi];
              for (let k = 0; k < 4; k++) {
                const v = f.v[k];
                const t = vs[k];
                t[0] = bx + v[0] * 16;
                t[1] = by + v[1] * 16;
                t[2] = bz + v[2] * 16;
                t[3] = v[3];
                t[4] = v[4];
                sh4[k] = Math.round(255 * fs * AO_CURVE[ao4[k]]);
              }
              emitQuad(opaqueBuf, layers[fi], ao4[0] + ao4[2] < ao4[1] + ao4[3]);
            }
          } else if (r === 'water') {
            const aboveWater = padId[p + PP] === WATER;
            const topH = aboveWater ? 16 : 14;
            const layer = LAYERS[id][2];
            for (let fi = 0; fi < 6; fi++) {
              const f = FACES[fi];
              const nid = padId[p + f.nOff];
              if (nid === WATER || OPQ[nid]) continue;
              if (fi === 3 && nid !== 0) continue;
              faceLighting(p, f, false);
              const fs = FACE_SHADE[fi];
              for (let k = 0; k < 4; k++) {
                const v = f.v[k];
                const t = vs[k];
                t[0] = bx + v[0] * 16;
                t[1] = by + (v[1] ? topH : 0);
                t[2] = bz + v[2] * 16;
                t[3] = v[3];
                t[4] = v[4];
                sh4[k] = Math.round(255 * fs);
              }
              emitQuad(waterBuf, layer, false);
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
            crossQuad(bx + a, bz + a, bx + c, bz + c, by, layer);
            crossQuad(bx + c, bz + a, bx + a, bz + c, by, layer);
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

  function emitQuad(buf, layer, flip) {
    if (flip) {
      vtmp[0] = vs[1]; vtmp[1] = vs[2]; vtmp[2] = vs[3]; vtmp[3] = vs[0];
      const s0 = sky4[0], b0 = blk4[0], h0 = sh4[0];
      sky4[0] = sky4[1]; sky4[1] = sky4[2]; sky4[2] = sky4[3]; sky4[3] = s0;
      blk4[0] = blk4[1]; blk4[1] = blk4[2]; blk4[2] = blk4[3]; blk4[3] = b0;
      sh4[0] = sh4[1]; sh4[1] = sh4[2]; sh4[2] = sh4[3]; sh4[3] = h0;
      buf.quad(vtmp, layer, sky4, blk4, sh4);
    } else buf.quad(vs, layer, sky4, blk4, sh4);
  }

  // Plan diagonal double face pour les plantes.
  function crossQuad(x0, z0, x1, z1, y, layer) {
    const q = [[x0, y, z0, 0, 16], [x1, y, z1, 16, 16], [x1, y + 16, z1, 16, 0], [x0, y + 16, z0, 0, 0]];
    opaqueBuf.quad(q, layer, sky4, blk4, sh4);
    const r = [q[1], q[0], q[3], q[2]];
    opaqueBuf.quad(r, layer, sky4, blk4, sh4);
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
      buf.quad(q, layer, sky4, blk4, sh4);
    }
  }
})();
