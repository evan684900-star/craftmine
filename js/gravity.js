'use strict';
// Extension « Gravité réaliste » (cochée à la création du monde).
// - Sable, gravier et poudre de béton tombent dès qu'il n'y a plus rien dessous (même naturels).
// - Les blocs posés par les joueurs doivent tenir : en montant ou en descendant par des blocs
//   solides, ils doivent rejoindre le terrain naturel (ou le fond du monde) en ne faisant pas plus
//   de pas à l'horizontale que leur matériau ne le permet (porte-à-faux : bois 5, pierre 3, métal 7,
//   terre et verre 1…). Sinon ils tombent, et leurs voisins sont vérifiés à leur tour.
// - Le terrain naturel (jamais modifié) reste en place : les grottes ne s'effondrent pas.
// L'hôte (ou la partie solo) simule ; les blocs qui tombent sont des entités.
(function () {
  const DV = CM.DIRV;
  const { MINY, H } = CM.WORLD;
  const blk = (id) => CM.blocks[id] || CM.blocks[0];
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const MAX_NODES = 2500; // au-delà, on considère la construction comme tenue (trop grande à explorer)
  const PER_TICK = 40; // vérifications par passage (20 par seconde)
  const NEAR = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 2) NEAR.push([dx, dy, dz]);

  const CUBES = new Set(['cube', 'glass', 'tglass', 'slab']);
  // blocs meubles : tombent dès qu'ils n'ont plus d'appui dessous
  for (const b of CM.blocks) if (b && /^(SAND|RED_SAND|GRAVEL|CONCRETE_POWDER_.*)$/.test(b.key)) b.loose = true;
  // Peut tomber ?
  const fallable = (b) => b.solid && !!b.col && CUBES.has(b.render) && !b.unbreakable && b.hardness >= 0 && !b.portal && !b.container && !b.rs && !b.tech && !b.door && !b.bed;
  // Porte (appui) : tout ce qui est solide
  const holds = (b) => b.solid && !!b.col && !CM.isFluid(b.id);
  // Porte-à-faux autorisé (pas à l'horizontale) selon le matériau
  function span(b) {
    if (b.loose) return 0;
    if (/LEAVES/.test(b.key)) return 5;
    if (b.sound === 'metal') return 7;
    if (b.sound === 'wood') return 5;
    if (b.sound === 'glass') return 1;
    if (b.sound === 'grass' || b.sound === 'sand' || b.sound === 'gravel' || b.sound === 'snow') return 1;
    if (b.sound === 'wool') return 2;
    return 3;
  }
  CM.gravitySpan = span;
  // Fragile : se brise en tombant de haut
  const fragile = (b) => /LEAVES|GLASS|ICE/.test(b.key) || b.sound === 'glass';

  class Gravity {
    constructor(bt) {
      this.bt = bt;
      this.queue = new Set();
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
    // Un bloc a changé : lui et ses voisins proches sont revérifiés.
    onEdit(x, y, z) {
      if (!this.on) return;
      for (const [dx, dy, dz] of NEAR) this.queue.add(key(x + dx, y + dy, z + dz));
    }
    update() {
      if (!this.on || !this.queue.size) return;
      const w = this.w;
      let n = 0;
      for (const k of this.queue) {
        this.queue.delete(k);
        const [x, y, z] = k.split(',').map(Number);
        if (w.loaded(x, z)) this.check(x, y, z);
        if (++n >= PER_TICK) break;
      }
    }
    check(x, y, z) {
      const w = this.w, id = w.get(x, y, z), b = blk(id);
      if (!id || !fallable(b)) return;
      // le terrain naturel tient (sauf le sable et le gravier)
      if (!b.loose && !w.isEdited(x, y, z)) return;
      if (this.stable(x, y, z, b)) return;
      this.fall(x, y, z, id);
    }
    stable(x, y, z, b) {
      const w = this.w;
      if (b.loose) return y - 1 < MINY || holds(blk(w.get(x, y - 1, z)));
      const S = span(b);
      // parcours 0-1 : monter ou descendre ne coûte rien, un pas de côté coûte 1
      const best = new Map([[key(x, y, z), 0]]);
      let dq = [[x, y, z, 0]], head = 0, nodes = 0;
      const later = [];
      while (head < dq.length || later.length) {
        if (head >= dq.length) {
          dq = later.splice(0, later.length);
          head = 0;
        }
        const [cx, cy, cz, c] = dq[head++];
        if (best.get(key(cx, cy, cz)) < c) continue;
        if (++nodes > MAX_NODES) return true;
        for (let d = 0; d < 6; d++) {
          const nx = cx + DV[d][0], ny = cy + DV[d][1], nz = cz + DV[d][2];
          if (ny < MINY) return true;
          if (ny >= H) continue;
          if (!w.loaded(nx, nz)) return true;
          const nb = blk(w.get(nx, ny, nz));
          if (!holds(nb)) continue;
          if (nb.unbreakable) return true;
          const vertical = d === 2 || d === 3;
          // terrain naturel : ancrage (le sable naturel ne porte que par-dessus)
          if (!w.isEdited(nx, ny, nz) && !(nb.loose && !vertical)) return true;
          if (nb.loose && !vertical) continue;
          const nc = c + (vertical ? 0 : 1);
          if (nc > S) continue;
          const nk = key(nx, ny, nz);
          const old = best.get(nk);
          if (old !== undefined && old <= nc) continue;
          best.set(nk, nc);
          if (vertical) dq.push([nx, ny, nz, nc]);
          else later.push([nx, ny, nz, nc]);
        }
      }
      return false;
    }
    // Le bloc devient une entité qui tombe ; ce qui était posé dessus (torche, fleur…) saute.
    fall(x, y, z, id) {
      const g = this.g, w = this.w;
      w.setBlock(x, y, z, 0);
      g.entities.addFalling(id, x + 0.5, y, z + 0.5);
      const above = w.get(x, y + 1, z), ab = blk(above);
      if (above && !ab.solid && (ab.plant || ab.render === 'torch' || ab.render === 'carpet' || ab.render === 'cross')) {
        w.setBlock(x, y + 1, z, 0);
        for (const [did, n] of CM.blockDrops(above, Math.random)) g.entities.addDrop(did, n, x + 0.5, y + 1.2, z + 0.5);
      }
      for (const d of CM.HDIRS) {
        const X = x + DV[d][0], Z = z + DV[d][2], nid = w.get(X, y, Z), nb = blk(nid);
        if (nb.wall && nb.wall[0] === DV[d][0] && nb.wall[1] === DV[d][2]) {
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
  E.addFalling = function (id, x, y, z) {
    if (!this.falling) this.falling = [];
    this.falling.push({ uid: CM.newUid(), id, x, y, z, vy: 0, y0: y });
  };
  E.updateFalling = function (dt) {
    const g = this.game, w = g.world;
    for (const f of this.falling) {
      if (f.dead) continue;
      f.vy = Math.max(f.vy - 30 * dt, -40);
      const ny = f.y + f.vy * dt;
      const bx = Math.floor(f.x), bz = Math.floor(f.z), cell = Math.floor(ny);
      if (ny < MINY - 2) {
        f.dead = true;
        continue;
      }
      const cb = blk(w.get(bx, cell, bz));
      if (cell >= MINY && holds(cb)) this.landFalling(f, cell + 1);
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
    const spill = () => {
      for (const [did, n] of CM.blockDrops(f.id, Math.random)) this.addDrop(did, n, f.x, Y + 0.3, f.z);
    };
    if (fragile(b) && drop > 2) {
      // verre, feuilles, glace : se brisent
      this.blockParticles(f.id, bx, Y, bz, 14);
      if (near) CM.Audio.play('break', { mat: b.sound });
      spill();
      return;
    }
    if (!occupied && (target === 0 || tb.replaceable || CM.isFluid(target))) {
      w.setBlock(bx, Y, bz, f.id);
      if (near) CM.Audio.play('place', { mat: b.sound });
      this.blockParticles(f.id, bx, Y, bz, 6);
    } else {
      this.addDrop(f.id, 1, f.x, Y + 0.3, f.z);
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
