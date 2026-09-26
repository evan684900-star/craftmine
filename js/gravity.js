'use strict';
// Extension « Gravité réaliste » (cochée à la création du monde) : TOUS les blocs solides
// (terrain naturel compris : roche, terre, arbres, plafonds de grottes, constructions…) doivent
// être soutenus.
// - Un bloc tient s'il est posé sur un bloc qui tient, ou accroché par le côté à des blocs qui
//   tiennent, sans dépasser dans le vide de plus que son matériau ne le permet (porte-à-faux).
// - Sable, gravier et poudre de béton : jamais de porte-à-faux, il leur faut un appui dessous.
// - Après chaque modification, une zone autour est recalculée couche par couche, de bas en haut ;
//   ce qui ne tient plus tombe (en chaîne : chaque chute est une nouvelle modification). Le terrain
//   généré qui ne tiendrait pas selon ces règles (grand plafond de grotte…) reste tant qu'on n'y
//   touche pas : dès qu'on le dérange, tout le morceau fragile s'écroule.
// - Les blocs qui se touchent tombent d'un seul morceau (un arbre, un pan de falaise, un plafond) :
//   tout le morceau descend de la même hauteur jusqu'au premier appui, puis on recalcule.
// L'hôte (ou la partie solo) simule ; les blocs qui tombent sont des entités.
(function () {
  const DV = CM.DIRV;
  const { MINY, H } = CM.WORLD;
  const blk = (id) => CM.blocks[id] || CM.blocks[0];
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const R = 8; // rayon horizontal de la zone recalculée
  const DOWN = 12, UP = 20; // hauteur de la zone sous / au-dessus de la modification
  const SIDE = 2 * R + 1;
  const MAX_REGIONS = 12, BUDGET_MS = 3; // zones recalculées par image (au moins une)
  const MAX_FALLS = 256; // chutes lancées au plus par zone (le reste suivra)
  const MAX_DROP = 96; // hauteur de chute calculée au plus
  // voisins : les 6 faces, puis arêtes et coins (dg = 1 : ne comptent que pour les arbres)
  const N26 = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const m = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        if (m) N26.push([dx, dy, dz, m > 1 ? 1 : 0]);
      }
  N26.sort((a, b) => a[3] - b[3]);
  const INF = 1000;

  // blocs meubles : tombent dès qu'ils n'ont plus d'appui dessous
  for (const b of CM.blocks) if (b && /^(SAND|RED_SAND|GRAVEL|CONCRETE_POWDER_.*)$/.test(b.key)) b.loose = true;
  // Porte (appui) : tout ce qui est solide
  const holds = (b) => b.solid && !!b.col && !CM.isFluid(b.id);
  // Peut tomber (les blocs de deux cases, portes et lits, et la roche-mère restent)
  const fallable = (b) => holds(b) && !b.unbreakable && b.hardness >= 0 && !b.portal && !b.door && !b.bed;
  const ROCK = /^(STONE|DEEPSTONE|GRANITE|DIORITE|ANDESITE|TUFF|CALCITE|BASALT|SMOOTH_BASALT|BLACKSTONE|NETHERRACK|END_STONE|OBSIDIAN|CRYING_OBSIDIAN|SANDSTONE|RED_SANDSTONE|DRIPSTONE_BLOCK|MAGMA|AMETHYST_BLOCK|BUDDING_AMETHYST|TERRACOTTA.*|SOUL_SOIL|SOUL_SAND)$/;
  // Porte-à-faux autorisé (blocs dans le vide à l'horizontale) selon le matériau
  function span(b) {
    if (b.loose) return 0;
    if (/LEAVES/.test(b.key)) return 5;
    if (b.sound === 'metal') return 7;
    if (b.sound === 'wood') return 5;
    if (b.ore || ROCK.test(b.key)) return 6;
    if (/ICE/.test(b.key)) return 3;
    if (b.sound === 'glass') return 1;
    if (b.sound === 'grass' || b.sound === 'sand' || b.sound === 'gravel' || b.sound === 'snow') return 2;
    if (b.sound === 'wool') return 2;
    return 4; // pierre taillée, briques, béton…
  }
  CM.gravitySpan = span;
  // Fragile : se brise en tombant de haut
  const fragile = (b) => /LEAVES|GLASS|ICE/.test(b.key) || b.sound === 'glass';
  // tables par identifiant (plus rapide dans les boucles)
  // Arbres (bûches, feuilles, champignons géants) : d'un seul tenant, comme un vrai arbre ; ce qui
  // est relié à une partie qui tient (même par un coin, même pendu dessous) tient aussi, à 6 près.
  const TREE_REACH = 6;
  const ORGANIC = /^(LOG|.*_LOG|.*_WOOD|.*LEAVES.*|MUSHROOM_STEM|.*_MUSHROOM_BLOCK|.*WART_BLOCK|SHROOMLIGHT)$/;
  let HOLD = null, FALL = null, SPAN = null, LOOSE = null, ORG = null;
  function tables() {
    const n = CM.blocks.length;
    HOLD = new Uint8Array(n);
    FALL = new Uint8Array(n);
    SPAN = new Uint8Array(n);
    LOOSE = new Uint8Array(n);
    ORG = new Uint8Array(n);
    for (const v of CM.WOODS || []) for (const id of [v.log, v.leaves]) if (CM.blocks[id]) CM.blocks[id].organic = true;
    for (const b of CM.blocks) {
      if (!b) continue;
      HOLD[b.id] = holds(b) ? 1 : 0;
      FALL[b.id] = fallable(b) ? 1 : 0;
      SPAN[b.id] = span(b);
      LOOSE[b.id] = b.loose ? 1 : 0;
      ORG[b.id] = holds(b) && (b.organic || ORGANIC.test(b.key)) ? 1 : 0;
    }
  }

  class Gravity {
    constructor(bt) {
      this.bt = bt;
      this.queue = new Map(); // "x,y,z" → [x, y, z, bloc d'avant la modification]
      if (!HOLD) tables();
      const L = SIDE * SIDE, N = L * (DOWN + UP + 1);
      this.ids = new Uint16Array(N);
      this.st = new Uint8Array(N); // tient (maintenant)
      this.stB = new Uint8Array(N); // tenait (avant les modifications)
      this.mark = new Uint8Array(N);
      this.q3 = new Int32Array(N);
      this.od = new Uint8Array(N);
      this.below = new Uint8Array(L);
      this.d = new Int16Array(L);
      this.bfs = new Int32Array(L * 4);
    }
    get w() {
      return this.bt.world;
    }
    get g() {
      return this.bt.game;
    }
    reset() {
      this.queue.clear();
    }
    get on() {
      return CM.extOn('gravity');
    }
    onEdit(x, y, z, id, old) {
      if (!this.on) return;
      const k = key(x, y, z);
      if (!this.queue.has(k)) this.queue.set(k, [x, y, z, old === undefined ? id : old]);
    }
    update() {
      if (!this.on || !this.queue.size) return;
      const t0 = performance.now();
      for (let n = 0; this.queue.size && n < MAX_REGIONS && (n < 1 || performance.now() - t0 < BUDGET_MS); n++) {
        const [k0, [x, y, z]] = this.queue.entries().next().value;
        if (!this.w.loaded(x, z)) {
          this.queue.delete(k0);
          continue;
        }
        // les modifications proches sont traitées ensemble ; celles de la zone donnent l'état d'avant
        const edits = [], ctx = [];
        for (const [k, [a, b, c, old]] of this.queue) {
          if (Math.abs(a - x) > R || Math.abs(c - z) > R || b < y - DOWN || b > y + UP) continue;
          if (Math.abs(a - x) <= R / 2 && Math.abs(c - z) <= R / 2 && b >= y - DOWN / 2 && b <= y + UP / 2) {
            edits.push(a, b, c, old);
            this.queue.delete(k);
          } else ctx.push(a, b, c, old);
        }
        this.region(x, y, z, edits, ctx);
      }
    }
    // Stabilité couche par couche, de bas en haut (out[n] = 1 : le bloc tient).
    solve(out, NY) {
      const ids = this.ids, d = this.d, bfs = this.bfs, below = this.below, L = SIDE * SIDE;
      for (let ly = 0; ly < NY; ly++) {
        const base = ly * L;
        let qh = 0, qt = 0;
        for (let c = 0; c < L; c++) {
          const id = ids[base + c];
          if (!HOLD[id]) {
            d[c] = INF;
            continue;
          }
          const i = c % SIDE, j = (c / SIDE) | 0;
          // posé sur un bloc qui tient, ou bord de zone (supposé tenir), ou bloc qui ne tombe jamais
          if ((ly ? out[base - L + c] : below[c]) || i === 0 || j === 0 || i === SIDE - 1 || j === SIDE - 1 || !FALL[id]) {
            d[c] = 0;
            bfs[qt++] = c;
          } else d[c] = INF;
        }
        // porte-à-faux : de proche en proche sur la couche
        while (qh < qt) {
          const c = bfs[qh++];
          if (LOOSE[ids[base + c]]) continue; // le sable ne retient rien sur le côté
          const i = c % SIDE, j = (c / SIDE) | 0, nd = d[c] + 1;
          for (let k = 0; k < 4; k++) {
            const ni = i + (k === 0 ? 1 : k === 1 ? -1 : 0), nj = j + (k === 2 ? 1 : k === 3 ? -1 : 0);
            if (ni < 0 || nj < 0 || ni >= SIDE || nj >= SIDE) continue;
            const n = nj * SIDE + ni, nid = ids[base + n];
            if (!HOLD[nid] || LOOSE[nid] || d[n] <= nd || nd > SPAN[nid]) continue;
            d[n] = nd;
            bfs[qt++] = n;
          }
        }
        for (let c = 0; c < L; c++) out[base + c] = HOLD[ids[base + c]] && d[c] < INF ? 1 : 0;
      }
      // arbres : de proche en proche (26 voisins) depuis leurs parties qui tiennent
      const od = this.od, q = this.q3, N = NY * L;
      let qh = 0, qt = 0;
      for (let n = 0; n < N; n++)
        if (ORG[ids[n]] && out[n]) {
          od[n] = 0;
          q[qt++] = n;
        } else od[n] = 255;
      while (qh < qt) {
        const n = q[qh++];
        if (od[n] >= TREE_REACH) continue;
        const ly = (n / L) | 0, c = n - ly * L, i = c % SIDE, j = (c / SIDE) | 0;
        for (const [dx, dy, dz] of N26) {
          const ni = i + dx, nj = j + dz, nl = ly + dy;
          if (ni < 0 || nj < 0 || nl < 0 || ni >= SIDE || nj >= SIDE || nl >= NY) continue;
          const m = nl * L + nj * SIDE + ni;
          if (!ORG[ids[m]] || od[m] !== 255) continue;
          od[m] = od[n] + 1;
          out[m] = 1;
          q[qt++] = m;
        }
      }
    }
    // Recalcule la zone autour de (cx, cy, cz) : tombe ce que les modifications ont dérangé.
    // - ce qui tenait avant et ne tient plus ;
    // - ce qui ne tient pas et touche une case modifiée (on a remué un morceau déjà fragile) ;
    // … avec tout le morceau instable qui y est attaché. Le reste du terrain naturel ne bouge pas.
    region(cx, cy, cz, edits, ctx) {
      const w = this.w, ids = this.ids, st = this.st, stB = this.stB, mark = this.mark, q = this.q3, below = this.below;
      const L = SIDE * SIDE, x0 = cx - R, z0 = cz - R, y0 = Math.max(MINY, cy - DOWN), y1 = Math.min(H - 1, cy + UP);
      const NY = y1 - y0 + 1, N = NY * L;
      // lecture colonne par colonne (un tronçon non chargé compte comme de la roche)
      for (let j = 0; j < SIDE; j++)
        for (let i = 0; i < SIDE; i++) {
          const x = x0 + i, z = z0 + j, ch = w.chunkAt(x, z), c = j * SIDE + i;
          const col = ((z & 15) << 4) | (x & 15);
          for (let y = y0; y <= y1; y++) ids[(y - y0) * L + c] = ch ? ch.blocks[((y - MINY) << 8) | col] : 1;
          // couche du dessous (hors zone) : ce qui est solide est supposé tenir
          below[c] = y0 - 1 < MINY || !ch || HOLD[ch.blocks[((y0 - 1 - MINY) << 8) | col]] ? 1 : 0;
        }
      const cells = (list, fn) => {
        for (let e = 0; e < list.length; e += 4) {
          const x = list[e] - x0, y = list[e + 1] - y0, z = list[e + 2] - z0;
          if (x >= 0 && z >= 0 && x < SIDE && z < SIDE && y >= 0 && y < NY) fn(y * L + z * SIDE + x, list[e + 3]);
        }
      };
      this.solve(st, NY);
      // état d'avant : seulement si un appui a pu disparaître (poser un bloc n'en retire jamais)
      let removal = false;
      const lost = (n, old) => {
        const id = ids[n];
        if (HOLD[old] && (!HOLD[id] || SPAN[id] < SPAN[old] || LOOSE[id] > LOOSE[old])) removal = true;
      };
      cells(edits, lost);
      cells(ctx, lost);
      if (removal) {
        const now = [];
        const swap = (n, old) => {
          now.push(n, ids[n]);
          ids[n] = old;
        };
        cells(ctx, swap);
        cells(edits, swap);
        this.solve(stB, NY);
        for (let e = now.length - 2; e >= 0; e -= 2) ids[now[e]] = now[e + 1];
      }
      // graines, puis tout le morceau instable attaché
      mark.fill(0, 0, N);
      let qt = 0;
      const seed = (n) => {
        const id = ids[n];
        if (mark[n] || !HOLD[id] || !FALL[id] || st[n]) return;
        mark[n] = 1;
        q[qt++] = n;
      };
      const around = (n, diag) => {
        const ly = (n / L) | 0, c = n - ly * L, i = c % SIDE, j = (c / SIDE) | 0;
        for (const [dx, dy, dz, dg] of N26) {
          if (dg && !diag) continue;
          const ni = i + dx, nj = j + dz, nl = ly + dy;
          if (ni < 0 || nj < 0 || nl < 0 || ni >= SIDE || nj >= SIDE || nl >= NY) continue;
          const m = nl * L + nj * SIDE + ni;
          if (dg && !ORG[ids[n]] && !ORG[ids[m]]) continue;
          seed(m);
        }
      };
      cells(edits, (n) => {
        seed(n);
        around(n, false);
      });
      if (removal) for (let n = 0; n < N; n++) if (stB[n] && !st[n]) seed(n);
      for (let h = 0; h < qt; h++) around(q[h], true);
      if (!qt) return;
      // de bas en haut
      const order = Array.from(q.subarray(0, qt)).sort((a, b) => a - b);
      const falls = [];
      for (let e = 0; e < order.length && falls.length < MAX_FALLS; e++) {
        const n = order[e], ly = (n / L) | 0, c = n - ly * L;
        falls.push([x0 + (c % SIDE), y0 + ly, z0 + ((c / SIDE) | 0), ids[n]]);
      }
      // chaque bloc lâché devient une entité qui tombe (avec son morceau)
      const dist = this.drops(falls);
      falls.forEach(([x, y, z, id], i) => {
        if (dist[i] > 0 && w.get(x, y, z) === id) this.fall(x, y, z, id, dist[i]);
      });
    }
    // Morceaux : les blocs lâchés qui se touchent (le sable ne se lie que de haut en bas, les
    // arbres aussi par les coins) forment un morceau qui descend d'un bloc : de la hauteur du plus
    // petit vide sous l'un de ses blocs (0 : il repose déjà sur quelque chose, il reste).
    drops(falls) {
      const w = this.w, idx = new Map(), n = falls.length;
      falls.forEach((f, i) => idx.set(key(f[0], f[1], f[2]), i));
      const comp = new Int32Array(n).fill(-1), dist = [];
      let nc = 0;
      for (let s = 0; s < n; s++) {
        if (comp[s] >= 0) continue;
        const q = [s];
        comp[s] = nc;
        let best = MAX_DROP;
        for (let h = 0; h < q.length; h++) {
          const [x, y, z, id] = falls[q[h]];
          if (!idx.has(key(x, y - 1, z))) {
            // vide sous ce bloc (les blocs qui tombent aussi ne comptent pas comme appui)
            let k = 0;
            for (let Y = y - 1; k < best && Y >= MINY; Y--, k++) if (HOLD[w.get(x, Y, z)] && !idx.has(key(x, Y, z))) break;
            best = Math.min(best, k);
          }
          for (const [dx, dy, dz, dg] of N26) {
            const j = idx.get(key(x + dx, y + dy, z + dz));
            if (j === undefined || comp[j] >= 0) continue;
            const jd = falls[j][3];
            if (dg && !ORG[id] && !ORG[jd]) continue;
            if (!dy && (LOOSE[id] || LOOSE[jd])) continue;
            comp[j] = nc;
            q.push(j);
          }
        }
        dist[nc++] = best;
      }
      return falls.map((f, i) => dist[comp[i]]);
    }
    // Le bloc devient une entité qui tombe (avec le contenu d'un coffre, la charge d'une batterie…) ;
    // ce qui était posé dessus ou accroché (torche, fleur…) saute.
    fall(x, y, z, id, dist) {
      const g = this.g, w = this.w, k = g.bkey(x, y, z);
      const inv = g.chests.get(k) || null;
      if (inv) g.chests.delete(k);
      const td = g.techData && g.techData[k];
      if (td) delete g.techData[k];
      if (inv) g.net.chestGone(k);
      w.setBlock(x, y, z, 0);
      g.entities.addFalling(id, x + 0.5, y, z + 0.5, inv, td, dist);
      const above = w.get(x, y + 1, z), ab = blk(above);
      if (above && !ab.solid && (ab.plant || ab.render === 'torch' || ab.render === 'carpet' || ab.render === 'cross')) {
        w.setBlock(x, y + 1, z, 0);
        for (const [did, n] of CM.blockDrops(above, Math.random)) g.entities.addDrop(did, n, x + 0.5, y + 1.2, z + 0.5);
      }
      for (const dd of CM.HDIRS) {
        const X = x + DV[dd][0], Z = z + DV[dd][2], nid = w.get(X, y, Z), nb = blk(nid);
        if (nb.wall && nb.wall[0] === DV[dd][0] && nb.wall[1] === DV[dd][2]) {
          w.setBlock(X, y, Z, 0);
          for (const [did, n] of CM.blockDrops(nid, Math.random)) g.entities.addDrop(did, n, X + 0.5, y + 0.3, Z + 0.5);
        }
      }
    }
  }
  CM.Gravity = Gravity;

  // ------------------------------------------------ blocs qui tombent --
  const E = CM.Entities.prototype;
  const base = { update: E.updateExtra, remote: E.updateExtraRemote, render: E.renderExtra, snap: E.snapExtra, apply: E.applyExtra };
  const r2 = (v) => Math.round(v * 100) / 100;
  // dist : hauteur de chute prévue (le morceau entier se pose en même temps)
  E.addFalling = function (id, x, y, z, inv, td, dist) {
    if (!this.falling) this.falling = [];
    const f = { uid: CM.newUid(), id, x, y, z, vy: 0, y0: y, inv: inv || null, td: td || null };
    if (dist !== undefined && y - dist >= MINY) f.ty = y - dist;
    // trop de blocs en l'air à la fois : celui-ci tombe d'un coup
    if (this.falling.length >= 300) {
      const w = this.game.world, bx = Math.floor(x), bz = Math.floor(z);
      let Y = Math.floor(y);
      while (Y > MINY && !holds(blk(w.get(bx, Y - 1, bz))) && (f.ty === undefined || Y > f.ty)) Y--;
      f.dead = true;
      this.landFalling(f, Y);
      return;
    }
    this.falling.push(f);
  };
  E.updateFalling = function (dt) {
    const g = this.game, w = g.world;
    for (const f of this.falling) {
      if (f.dead) continue;
      f.vy = Math.max(f.vy - 30 * dt, -40);
      const ny = f.y + f.vy * dt;
      const bx = Math.floor(f.x), bz = Math.floor(f.z);
      if (ny < MINY - 2) {
        f.dead = true;
        continue;
      }
      // toutes les cases traversées pendant ce pas (un bloc posé entre-temps l'arrête)
      const stop = Math.max(Math.floor(ny), f.ty === undefined ? MINY : f.ty);
      let hit = null;
      for (let c = Math.floor(f.y) - 1; c >= stop; c--)
        if (holds(blk(w.get(bx, c, bz)))) {
          hit = c + 1;
          break;
        }
      if (hit === null && f.ty !== undefined && ny <= f.ty) hit = f.ty;
      if (hit !== null) this.landFalling(f, hit);
      else f.y = ny;
    }
    this.falling = this.falling.filter((f) => !f.dead);
  };
  E.landFalling = function (f, Y) {
    const g = this.game, w = g.world, b = blk(f.id);
    const bx = Math.floor(f.x), bz = Math.floor(f.z);
    f.dead = true;
    const drop = f.y0 - Y;
    // dégâts à ce qui se trouve dessous (plus il tombe de haut, plus ça fait mal)
    const inside = (e, hw, h) => e.x + hw > bx && e.x - hw < bx + 1 && e.z + hw > bz && e.z - hw < bz + 1 && e.y < Y + 1 && e.y + h > Y;
    // (sable et gravier : moitié moins ; métal : moitié plus)
    const heavy = b.loose ? 0.5 : b.sound === 'metal' ? 1.5 : 1;
    const dmg = Math.min(10, Math.round(Math.max(0, drop - 1) * 1.5 * heavy));
    let occupied = false;
    for (const q of this.plist) {
      if (q.alive === false || !inside(q, 0.3, 1.8)) continue;
      occupied = true;
      if (dmg > 0) q.damage(dmg, null, null, 'Un bloc qui tombe');
    }
    for (const m of this.mobs) {
      if (m.dead || !inside(m, m.hw, m.h)) continue;
      occupied = true;
      if (dmg > 0) this.hurtMob(m, dmg, null);
    }
    const target = w.get(bx, Y, bz), tb = blk(target);
    const p = g.player, near = p && Math.hypot(p.x - f.x, p.z - f.z) < 24;
    const spillInv = () => {
      for (const it of f.inv || []) if (it) this.addDrop(it.id, it.count, f.x, Y + 0.4, f.z, CM.stackExtra(it));
    };
    const spill = () => {
      for (const [did, n] of CM.blockDrops(f.id, Math.random)) this.addDrop(did, n, f.x, Y + 0.3, f.z);
      spillInv();
    };
    if (fragile(b) && drop > 2) {
      // verre, feuilles, glace : se brisent
      this.blockParticles(f.id, bx, Y, bz, 14);
      if (near) CM.Audio.play('break', { mat: b.sound });
      spill();
      return;
    }
    if (!occupied && (target === 0 || tb.replaceable || CM.isFluid(target))) {
      // le coffre garde son contenu, la batterie sa charge…
      const k = g.bkey(bx, Y, bz);
      if (f.inv) g.chests.set(k, f.inv);
      if (f.td && g.techData) g.techData[k] = f.td;
      w.setBlock(bx, Y, bz, f.id);
      if (near) CM.Audio.play('place', { mat: b.sound });
      this.blockParticles(f.id, bx, Y, bz, 6);
    } else {
      this.addDrop(f.id, 1, f.x, Y + 0.3, f.z);
      spillInv();
    }
  };
  E.renderFalling = function (batch) {
    for (const f of this.falling || []) {
      if (f.dead) continue;
      const l = this.lightAt(f.x, f.y + 0.5, f.z);
      CM.mat4.compose(this.M, f.x, f.y, f.z, 0, 0, 0, 1);
      const b = blk(f.id), h = b.render === 'slab' ? b.height : 1;
      batch.box(this.M, -0.5, 0, -0.5, 0.5, h, 0.5, CM.blockLayers[f.id], l[0], l[1], b.light ? 1 : 0);
    }
  };
  E.updateExtra = function (dt) {
    base.update.call(this, dt);
    if (this.falling && this.falling.length) this.updateFalling(dt);
  };
  E.updateExtraRemote = function (dt) {
    base.remote.call(this, dt);
    const k = Math.min(1, dt * 14);
    for (const f of this.falling || []) {
      if (f.tx === undefined) continue;
      f.x += (f.tx - f.x) * k;
      f.y += (f.ty - f.y) * k;
      f.z += (f.tz - f.z) * k;
    }
  };
  E.renderExtra = function (batch) {
    base.render.call(this, batch);
    this.renderFalling(batch);
  };
  E.snapExtra = function (near) {
    const s = base.snap.call(this, near);
    s.fb = (this.falling || []).filter((f) => !f.dead && near(f)).map((f) => [f.uid, f.id, r2(f.x), r2(f.y), r2(f.z)]);
    return s;
  };
  E.applyExtra = function (s) {
    base.apply.call(this, s);
    const old = new Map((this.falling || []).map((f) => [f.uid, f]));
    this.falling = [];
    for (const a of s.fb || []) {
      if (!Array.isArray(a) || !CM.blocks[a[1]]) continue;
      const [uid, id, x, y, z] = a;
      let f = old.get(uid);
      if (!f) f = { uid, id, x, y, z };
      f.tx = x;
      f.ty = y;
      f.tz = z;
      this.falling.push(f);
    }
  };
})();
