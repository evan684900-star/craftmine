'use strict';
// Moteur de redstone (comme dans Minecraft) : 20 ticks de jeu par seconde, un tick de
// redstone = 2 ticks de jeu. Seul l'hôte (ou la partie solo) simule ; les invités reçoivent
// les blocs modifiés. Un moteur par dimension (il vit dans BlockTicks).
(function () {
  const DV = CM.DIRV, OPP = CM.OPP, HD = CM.HDIRS;
  const R = CM.RSX;
  const blk = (id) => CM.blocks[id] || CM.blocks[0];
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const unkey = (k) => k.split(',').map(Number);
  // Voisinage mis à jour quand un bloc change : jusqu'à 2 cases (comme les mises à jour de Minecraft).
  const NEAR = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 2) NEAR.push([dx, dy, dz]);
  const MAX_UPDATES = 30000;

  // ---------------------------------------------------------------- rails --
  // Formes : 0 N-S, 1 E-O, 2 monte vers l'est, 3 vers l'ouest, 4 vers le sud, 5 vers le nord,
  // 6 virage sud-est, 7 sud-ouest, 8 nord-ouest, 9 nord-est. Sorties : [direction, montée].
  const EXITS = [[[5, 0], [4, 0]], [[0, 0], [1, 0]], [[1, 0], [0, 1]], [[0, 0], [1, 1]], [[5, 0], [4, 1]], [[4, 0], [5, 1]], [[4, 0], [0, 0]], [[4, 0], [1, 0]], [[5, 0], [1, 0]], [[5, 0], [0, 0]]];
  CM.RAIL_EXITS = EXITS;
  const railRs = (id) => {
    const rs = blk(id).rs;
    return rs && rs.k === 'rail' ? rs : null;
  };
  // Rail voisin dans la direction d (même hauteur, un cran au-dessus ou en dessous).
  function railNeighbor(w, x, y, z, d) {
    const nx = x + DV[d][0], nz = z + DV[d][2];
    for (const dy of [0, 1, -1]) if (railRs(w.get(nx, y + dy, nz))) return [nx, y + dy, nz];
    return null;
  }
  const railExits = (rs) => EXITS[rs.shape].map((e) => e[0]);
  // Le rail en (x, y, z) mène-t-il vers la direction d ?
  const railGoes = (w, x, y, z, d) => {
    const rs = railRs(w.get(x, y, z));
    return !!rs && railExits(rs).includes(d);
  };
  // Forme d'un nouveau rail d'après ses voisins (comme dans Minecraft, simplifié).
  CM.railShapeAt = function (w, x, y, z, curves) {
    const has = {}, up = {};
    let n = 0;
    for (const d of HD) {
      const nx = x + DV[d][0], nz = z + DV[d][2];
      if (railRs(w.get(nx, y + 1, nz))) {
        has[d] = up[d] = true;
        n++;
      } else if (railRs(w.get(nx, y, nz)) || railRs(w.get(nx, y - 1, nz))) {
        has[d] = true;
        n++;
      }
    }
    if (!n) return 0;
    const ns = has[4] || has[5], ew = has[0] || has[1];
    if (curves && ns && ew) {
      const s = has[4] ? 4 : 5, e = has[0] ? 0 : 1;
      return s === 4 ? (e === 0 ? 6 : 7) : e === 1 ? 8 : 9;
    }
    if (ew && !ns) return up[0] ? 2 : up[1] ? 3 : 1;
    return up[4] ? 4 : up[5] ? 5 : 0;
  };
  // Après la pose d'un rail : les rails voisins encore libres se tournent vers lui.
  CM.railFixNeighbors = function (w, x, y, z) {
    for (const d of HD) {
      const p = railNeighbor(w, x, y, z, d);
      if (!p) continue;
      const id = w.get(p[0], p[1], p[2]), rs = railRs(id);
      let linked = 0;
      for (const e of railExits(rs)) {
        const q = railNeighbor(w, p[0], p[1], p[2], e);
        if (q && railGoes(w, q[0], q[1], q[2], OPP[e])) linked++;
      }
      if (linked >= 2 || railGoes(w, p[0], p[1], p[2], OPP[d])) continue;
      const shape = CM.railShapeAt(w, p[0], p[1], p[2], rs.type === 'rail');
      const nid = CM.rsWith(id, { shape });
      if (nid !== id && CM.blocks[nid].rs.shape === shape) w.setBlock(p[0], p[1], p[2], nid);
    }
  };

  class Redstone {
    constructor(bt) {
      this.bt = bt;
      this.g = bt.game;
      this.reset();
    }
    get w() {
      return this.bt.world;
    }
    get active() {
      return this.bt.active;
    }
    reset() {
      this.gt = 0;
      this.acc = 0;
      this.sched = new Map();
      this.queue = [];
      this.queued = new Set();
      this.dirtyWires = new Set();
      this.data = new Map();
      this.applyingWire = false;
      this.internal = 0;
      this.pressed = new Set(); // plaques, fils, rails détecteurs actuellement enfoncés
      this.occ = new Map();
      this.watch = { daylight: new Set(), hopper: new Set(), sculk: new Set(), tech: new Set() };
      const w = this.w;
      if (!w || !this.active) return;
      for (const [x, y, z, id] of w.editedWhere((i) => !!(blk(i).rs || blk(i).tech))) {
        this.track(x, y, z, id);
        // les composants reprennent là où ils en étaient
        if (blk(id).rs) this.queuePos(x, y, z);
      }
    }
    // Composants à surveiller en continu (capteurs, entonnoirs, machines).
    track(x, y, z, id) {
      const b = blk(id), rs = b.rs, k = key(x, y, z);
      for (const s of Object.values(this.watch)) s.delete(k);
      if (rs && rs.k === 'daylight') this.watch.daylight.add(k);
      else if (rs && rs.k === 'hopper') this.watch.hopper.add(k);
      else if (rs && rs.k === 'sculk') this.watch.sculk.add(k);
      if (b.tech) this.watch.tech.add(k);
    }
    getD(x, y, z, t) {
      return this.data.get(t + key(x, y, z)) || 0;
    }
    setD(x, y, z, t, v) {
      const k = t + key(x, y, z);
      if (v) this.data.set(k, v);
      else this.data.delete(k);
    }
    set(x, y, z, id) {
      this.internal++;
      this.w.setBlock(x, y, z, id);
      this.internal--;
    }

    // ------------------------------------------------------ évènements --
    onEdit(x, y, z, id) {
      if (!this.active) return;
      const w = this.w;
      // un observateur regarde cette case : impulsion dans 2 ticks
      for (let e = 0; e < 6; e++) {
        const X = x + DV[e][0], Y = y + DV[e][1], Z = z + DV[e][2];
        const rs = blk(w.get(X, Y, Z)).rs;
        if (rs && rs.k === 'observer' && rs.facing === OPP[e] && !rs.on) this.schedule(X, Y, Z, 2);
      }
      this.track(x, y, z, id);
      this.notify(x, y, z, this.applyingWire);
      // ficelle coupée ou posée : les crochets le long de la ligne réagissent
      for (const d of HD) {
        const rs = blk(w.get(x + DV[d][0], y, z + DV[d][2])).rs;
        if (rs && (rs.k === 'tripwire' || rs.k === 'hook')) this.hookScan(x, y, z);
      }
      // vibration pour les capteurs de sculk (sauf les changements faits par la redstone elle-même)
      if (!this.internal && this.watch.sculk.size) this.vibrate(x + 0.5, y + 0.5, z + 0.5);
    }
    notify(x, y, z, skipWires) {
      const w = this.w;
      for (const [dx, dy, dz] of NEAR) {
        const X = x + dx, Y = y + dy, Z = z + dz;
        const b = blk(w.get(X, Y, Z));
        if (!b.rs && !b.tech) continue;
        if (b.rs && b.rs.k === 'wire') {
          if (!skipWires) this.dirtyWires.add(key(X, Y, Z));
          if (dx || dy || dz) continue;
        }
        this.queuePos(X, Y, Z);
      }
    }
    queuePos(x, y, z) {
      const k = key(x, y, z);
      if (this.queued.has(k)) return;
      this.queued.add(k);
      this.queue.push(k);
    }
    schedule(x, y, z, ticks) {
      const k = key(x, y, z);
      if (this.sched.has(k)) return;
      this.sched.set(k, this.gt + Math.max(1, ticks));
    }

    // --------------------------------------------------------- ticks ----
    update(dt) {
      if (!this.active || !this.w) return;
      this.acc += dt;
      let n = 0;
      while (this.acc >= 0.05 && n < 4) {
        this.acc -= 0.05;
        this.tick();
        n++;
      }
      if (this.acc > 0.2) this.acc = 0;
    }
    tick() {
      this.gt++;
      const w = this.w;
      // actions programmées
      if (this.sched.size) {
        const due = [];
        for (const [k, t] of this.sched) if (t <= this.gt) due.push(k);
        for (const k of due) {
          this.sched.delete(k);
          const [x, y, z] = unkey(k);
          if (w.loaded(x, z)) this.tickBlock(x, y, z);
        }
      }
      if (this.gt % 2 === 0) this.presence();
      if (this.gt % 20 === 0) this.daylightTick();
      if (this.watch.hopper.size) this.hopperTick();
      if (this.watch.tech.size && CM.Tech) CM.Tech.tick(this);
      this.flush();
    }
    // Mises à jour en attente, puis recalcul des fils (jusqu'à ce que tout soit stable).
    flush() {
      const w = this.w;
      let guard = 0, n = 0;
      while ((this.queue.length || this.dirtyWires.size) && guard++ < 64) {
        while (this.queue.length && n++ < MAX_UPDATES) {
          const k = this.queue.shift();
          this.queued.delete(k);
          const [x, y, z] = unkey(k);
          if (w.loaded(x, z)) this.updateBlock(x, y, z);
        }
        if (this.dirtyWires.size) {
          const list = [...this.dirtyWires];
          this.dirtyWires.clear();
          this.recomputeWires(list);
        }
      }
      if (this.queue.length) {
        this.queue.length = 0;
        this.queued.clear();
      }
    }

    // ------------------------------------------------------- puissance --
    // Puissance « directe » (forte) émise par le bloc en (x, y, z) vers son voisin dans la direction d.
    direct(x, y, z, d, noWire) {
      const rs = blk(this.w.get(x, y, z)).rs;
      if (!rs) return 0;
      switch (rs.k) {
        case 'wire':
          return !noWire && rs.level && this.wireEmits(x, y, z, d) ? rs.level : 0;
        case 'torch':
          return rs.lit && d === 2 ? 15 : 0;
        case 'lever':
        case 'button':
          return rs.on && d === rs.attach ? 15 : 0;
        case 'plate':
          return d === 3 ? this.getD(x, y, z, 'pl') : 0;
        case 'repeater':
          return rs.on && d === rs.facing ? 15 : 0;
        case 'comparator':
          return d === rs.facing ? this.compOut(x, y, z, rs) : 0;
        case 'observer':
          return rs.on && d === OPP[rs.facing] ? 15 : 0;
        case 'hook':
          return rs.st === 2 && d === rs.attach ? 15 : 0;
        case 'trapped':
          return d === 3 ? this.getD(x, y, z, 'tc') : 0;
        case 'rail':
          return rs.type === 'detector' && rs.on && d === 3 ? 15 : 0;
        case 'sculk':
          return d === 3 ? this.getD(x, y, z, 'sk') : 0;
        default:
          return 0;
      }
    }
    // Puissance « faible » (celle que voit un composant voisin).
    signal(x, y, z, d, noWire) {
      const b = blk(this.w.get(x, y, z));
      if (b.conductor) return this.directInto(x, y, z, noWire);
      const rs = b.rs;
      if (!rs) return 0;
      switch (rs.k) {
        case 'rblock':
          return 15;
        case 'wire':
          return !noWire && rs.level && this.wireEmits(x, y, z, d) ? rs.level : 0;
        case 'torch':
          return rs.lit && d !== rs.attach ? 15 : 0;
        case 'lever':
        case 'button':
          return rs.on ? 15 : 0;
        case 'plate':
          return this.getD(x, y, z, 'pl');
        case 'repeater':
          return rs.on && d === rs.facing ? 15 : 0;
        case 'comparator':
          return d === rs.facing ? this.compOut(x, y, z, rs) : 0;
        case 'observer':
          return rs.on && d === OPP[rs.facing] ? 15 : 0;
        case 'hook':
          return rs.st === 2 ? 15 : 0;
        case 'target':
          return this.getD(x, y, z, 'tg');
        case 'daylight':
          return this.getD(x, y, z, 'dl');
        case 'trapped':
          return this.getD(x, y, z, 'tc');
        case 'rail':
          return rs.type === 'detector' && rs.on ? 15 : 0;
        case 'sculk':
          return this.getD(x, y, z, 'sk');
        default:
          return 0;
      }
    }
    directInto(x, y, z, noWire) {
      let m = 0;
      for (let e = 0; e < 6; e++) {
        const v = this.direct(x + DV[e][0], y + DV[e][1], z + DV[e][2], OPP[e], noWire);
        if (v > m && (m = v) >= 15) break;
      }
      return m;
    }
    // Plus forte puissance reçue par un composant (sauf depuis la direction `except`).
    input(x, y, z, except) {
      let m = 0;
      for (let e = 0; e < 6; e++) {
        if (e === except) continue;
        const v = this.signal(x + DV[e][0], y + DV[e][1], z + DV[e][2], OPP[e], false);
        if (v > m && (m = v) >= 15) break;
      }
      return m;
    }
    powered(x, y, z, except) {
      return this.input(x, y, z, except) > 0;
    }

    // --------------------------------------------------------- fils ----
    wireEmits(x, y, z, d) {
      if (d === 3) return true;
      if (d === 2) return false;
      const w = this.w;
      const { sides } = R.wireConn((dx, dy, dz) => w.get(x + dx, y + dy, z + dz));
      if (!sides) return true;
      const k = HD.indexOf(d);
      if (sides & (1 << k)) return true;
      // une seule liaison : le fil file tout droit et alimente aussi le côté opposé
      if ((sides & (sides - 1)) === 0) return !!(sides & (1 << HD.indexOf(OPP[d])));
      return false;
    }
    wireLinks(x, y, z) {
      const w = this.w, out = [];
      const openAbove = !R.conductor(w.get(x, y + 1, z));
      for (const d of HD) {
        const nx = x + DV[d][0], nz = z + DV[d][2];
        const n = w.get(nx, y, nz);
        if (R.isWire(n)) out.push([nx, y, nz]);
        else {
          if (!R.conductor(n) && R.isWire(w.get(nx, y - 1, nz))) out.push([nx, y - 1, nz]);
          if (openAbove && R.isWire(w.get(nx, y + 1, nz))) out.push([nx, y + 1, nz]);
        }
      }
      return out;
    }
    wireSource(x, y, z) {
      let m = 0;
      for (let e = 0; e < 6; e++) {
        const v = this.signal(x + DV[e][0], y + DV[e][1], z + DV[e][2], OPP[e], true);
        if (v > m && (m = v) >= 15) break;
      }
      return m;
    }
    // Réseau de fils relié : niveaux = source la plus forte moins la distance.
    recomputeWires(list) {
      const w = this.w, seen = new Set();
      for (const k0 of list) {
        if (seen.has(k0)) continue;
        const [x0, y0, z0] = unkey(k0);
        if (!R.isWire(w.get(x0, y0, z0))) continue;
        // pas de support : la poudre tombe
        if (!R.solidTop(w.get(x0, y0 - 1, z0))) {
          this.pop(x0, y0, z0);
          continue;
        }
        const nodes = [], idx = new Map(), adj = [];
        const stack = [[x0, y0, z0]];
        idx.set(k0, 0);
        nodes.push([x0, y0, z0]);
        seen.add(k0);
        while (stack.length && nodes.length < 4096) {
          const [x, y, z] = stack.pop();
          const i = idx.get(key(x, y, z));
          const links = this.wireLinks(x, y, z);
          adj[i] = [];
          for (const q of links) {
            const kq = key(q[0], q[1], q[2]);
            let j = idx.get(kq);
            if (j === undefined) {
              j = nodes.length;
              idx.set(kq, j);
              nodes.push(q);
              seen.add(kq);
              stack.push(q);
            }
            adj[i].push(j);
          }
        }
        const n = nodes.length;
        const lvl = new Int8Array(n).fill(-1);
        const buckets = [];
        for (let l = 0; l < 16; l++) buckets.push([]);
        for (let i = 0; i < n; i++) {
          if (!adj[i]) adj[i] = this.wireLinks(...nodes[i]).map((q) => idx.get(key(q[0], q[1], q[2]))).filter((j) => j !== undefined);
          const s = this.wireSource(...nodes[i]);
          if (s > 0) buckets[s].push(i);
        }
        for (let l = 15; l >= 1; l--)
          for (const i of buckets[l]) {
            if (lvl[i] >= l) continue;
            lvl[i] = l;
            if (l > 1) for (const j of adj[i]) if (lvl[j] < l - 1) buckets[l - 1].push(j);
          }
        this.applyingWire = true;
        for (let i = 0; i < n; i++) {
          const [x, y, z] = nodes[i];
          const id = w.get(x, y, z), rs = blk(id).rs;
          const l = Math.max(0, lvl[i]);
          if (rs && rs.k === 'wire' && rs.level !== l) this.set(x, y, z, CM.RS_WIRE[l]);
        }
        this.applyingWire = false;
      }
    }

    // ------------------------------------------------------ composants --
    pop(x, y, z) {
      const w = this.w, g = this.g, id = w.get(x, y, z);
      if (!id) return;
      this.set(x, y, z, 0);
      for (const [did, n] of CM.blockDrops(id, Math.random)) g.entities.addDrop(did, n, x + 0.5, y + 0.3, z + 0.5);
    }
    // Le composant tient-il encore (bloc porteur) ?
    supported(x, y, z, rs) {
      const w = this.w;
      switch (rs.k) {
        case 'wire':
        case 'repeater':
        case 'comparator':
        case 'plate':
        case 'rail':
          return R.solidTop(w.get(x, y - 1, z));
        case 'torch':
          return rs.attach === 3 ? R.solidTop(w.get(x, y - 1, z)) : R.fullFace(w.get(x + DV[rs.attach][0], y, z + DV[rs.attach][2]));
        case 'lever':
        case 'button':
        case 'hook':
          return R.fullFace(w.get(x + DV[rs.attach][0], y + DV[rs.attach][1], z + DV[rs.attach][2]));
        default:
          return true;
      }
    }
    torchInput(x, y, z, rs) {
      const a = rs.attach;
      return this.signal(x + DV[a][0], y + DV[a][1], z + DV[a][2], OPP[a], false) > 0;
    }
    repIn(x, y, z, rs) {
      const b = OPP[rs.facing];
      const X = x + DV[b][0], Z = z + DV[b][2];
      const s = this.signal(X, y, Z, rs.facing, false);
      if (s) return s;
      const r2 = blk(this.w.get(X, y, Z)).rs;
      return r2 && r2.k === 'wire' ? r2.level : 0;
    }
    sideIn(x, y, z, rs) {
      let m = 0;
      for (const s of rs.facing === 0 || rs.facing === 1 ? [4, 5] : [0, 1]) {
        const X = x + DV[s][0], Z = z + DV[s][2];
        const r2 = blk(this.w.get(X, y, Z)).rs;
        if (!r2) continue;
        let v = 0;
        if (r2.k === 'wire') v = r2.level;
        else if (r2.k === 'rblock') v = 15;
        else if ((r2.k === 'repeater' || r2.k === 'comparator' || r2.k === 'observer') && (r2.k === 'observer' ? OPP[r2.facing] : r2.facing) === OPP[s]) v = this.signal(X, y, Z, OPP[s], false);
        if (v > m) m = v;
      }
      return m;
    }
    locked(x, y, z, rs) {
      for (const s of rs.facing === 0 || rs.facing === 1 ? [4, 5] : [0, 1]) {
        const r2 = blk(this.w.get(x + DV[s][0], y, z + DV[s][2])).rs;
        if (r2 && (r2.k === 'repeater' || r2.k === 'comparator') && r2.facing === OPP[s] && (r2.k === 'repeater' ? r2.on : this.compOut(x + DV[s][0], y, z + DV[s][2], r2) > 0)) return true;
      }
      return false;
    }
    // Contenu d'un conteneur (ou ampoule…) lu par un comparateur, 0 à 15.
    readBlock(x, y, z) {
      const b = blk(this.w.get(x, y, z));
      const fill = (slots) => {
        let f = 0, any = false;
        for (const s of slots) {
          if (!s) continue;
          any = true;
          f += s.count / (CM.itemInfo(s.id).stack || 64);
        }
        return any ? Math.floor(1 + (f / slots.length) * 14) : 0;
      };
      if (b.container && !this.g.net.isClient) return fill(this.g.chestAt(x, y, z));
      // rail détecteur : contenu du wagonnet (à coffre / à entonnoir) posé dessus
      if (b.rs && b.rs.k === 'rail' && b.rs.type === 'detector') {
        const c = (this.g.entities.carts || []).find((o) => !o.dead && o.slots && Math.floor(o.x) === x && Math.floor(o.z) === z && Math.floor(o.y + 0.1) === y);
        return c ? fill(c.slots) : 0;
      }
      if (b.rs && b.rs.k === 'bulb') return b.rs.lit ? 15 : 0;
      if (b.tech && CM.Tech) return CM.Tech.readLevel(this, x, y, z);
      return -1;
    }
    compRear(x, y, z, rs) {
      const bk = OPP[rs.facing];
      const X = x + DV[bk][0], Z = z + DV[bk][2];
      let r = this.signal(X, y, Z, rs.facing, false);
      const rd = this.readBlock(X, y, Z);
      if (rd >= 0) r = Math.max(r, rd);
      else if (blk(this.w.get(X, y, Z)).conductor && r < 15) {
        const r2 = this.readBlock(X + DV[bk][0], y, Z + DV[bk][2]);
        if (r2 >= 0) r = Math.max(r, r2);
      }
      const w2 = blk(this.w.get(X, y, Z)).rs;
      if (w2 && w2.k === 'wire') r = Math.max(r, w2.level);
      return r;
    }
    compCalc(x, y, z, rs) {
      const r = this.compRear(x, y, z, rs), s = this.sideIn(x, y, z, rs);
      return rs.mode ? Math.max(0, r - s) : r >= s ? r : 0;
    }
    compOut(x, y, z, rs) {
      const k = 'co' + key(x, y, z);
      const v = this.data.get(k);
      return v === undefined ? (rs.on ? 15 : 0) : v;
    }
    pistonPowered(x, y, z, rs) {
      return this.powered(x, y, z, rs.facing);
    }

    // Un voisin a changé : le composant réévalue son état.
    updateBlock(x, y, z) {
      const w = this.w, id = w.get(x, y, z), b = blk(id), rs = b.rs;
      if (b.tech && CM.Tech) CM.Tech.neighbor(this, x, y, z);
      if (!rs) return;
      if (!this.supported(x, y, z, rs)) {
        this.pop(x, y, z);
        return;
      }
      const k = key(x, y, z);
      switch (rs.k) {
        case 'wire':
          this.dirtyWires.add(k);
          break;
        case 'torch':
          if (!this.torchInput(x, y, z, rs) !== rs.lit) this.schedule(x, y, z, 2);
          break;
        case 'repeater':
          if (this.locked(x, y, z, rs)) break;
          if (this.repIn(x, y, z, rs) > 0 !== rs.on) this.schedule(x, y, z, rs.delay * 2);
          break;
        case 'comparator': {
          const out = this.compCalc(x, y, z, rs);
          if (out !== this.compOut(x, y, z, rs) || out > 0 !== rs.on) this.schedule(x, y, z, 2);
          break;
        }
        case 'lamp': {
          const p = this.powered(x, y, z);
          if (p && !rs.on) this.set(x, y, z, CM.rsWith(id, { on: true }));
          else if (!p && rs.on) this.schedule(x, y, z, 4);
          break;
        }
        case 'button':
          if (rs.on) this.schedule(x, y, z, rs.wood ? 30 : 20);
          break;
        case 'piston':
          if (this.pistonPowered(x, y, z, rs) !== rs.ext) this.schedule(x, y, z, 1);
          else if (rs.ext) {
            const h = blk(w.get(x + DV[rs.facing][0], y + DV[rs.facing][1], z + DV[rs.facing][2])).rs;
            if (!h || h.k !== 'phead' || h.facing !== rs.facing) this.set(x, y, z, CM.rsWith(id, { ext: false }));
          }
          break;
        case 'phead': {
          const f = rs.facing;
          const bs = blk(w.get(x - DV[f][0], y - DV[f][1], z - DV[f][2])).rs;
          if (!bs || bs.k !== 'piston' || !bs.ext || bs.facing !== f) this.set(x, y, z, 0);
          break;
        }
        case 'dispenser':
        case 'dropper': {
          const p = this.powered(x, y, z), t = this.getD(x, y, z, 'tr');
          if (p && !t) {
            this.setD(x, y, z, 'tr', 1);
            this.schedule(x, y, z, 4);
          } else if (!p && t) this.setD(x, y, z, 'tr', 0);
          break;
        }
        case 'hopper':
          this.setD(x, y, z, 'hl', this.powered(x, y, z) ? 1 : 0);
          break;
        case 'note': {
          const p = this.powered(x, y, z), last = this.getD(x, y, z, 'np');
          if (p && !last) this.playNote(x, y, z);
          this.setD(x, y, z, 'np', p ? 1 : 0);
          break;
        }
        case 'tnt':
          if (this.powered(x, y, z)) this.g.primeTnt(x, y, z);
          break;
        case 'door': {
          const dr = b.door, y0 = dr.half ? y - 1 : y;
          const p = this.powered(x, y0, z) || this.powered(x, y0 + 1, z);
          const last = this.getD(x, y0, z, 'dp');
          if (p !== !!last) {
            this.setD(x, y0, z, 'dp', p ? 1 : 0);
            if (!!dr.open !== p) this.g.setDoorOpen(x, y, z, p);
          }
          break;
        }
        case 'trapdoor': {
          const p = this.powered(x, y, z), last = this.getD(x, y, z, 'dp');
          if (p !== !!last) {
            this.setD(x, y, z, 'dp', p ? 1 : 0);
            if (rs.open !== p) {
              this.set(x, y, z, CM.rsWith(id, { open: p }));
              CM.Audio.play('door', { open: p });
            }
          }
          break;
        }
        case 'bulb': {
          const p = this.powered(x, y, z), last = this.getD(x, y, z, 'bp');
          if (p && !last) {
            this.set(x, y, z, CM.rsWith(id, { lit: !rs.lit }));
            CM.Audio.play('rsclick', { pitch: rs.lit ? 0.8 : 1.3 });
          }
          this.setD(x, y, z, 'bp', p ? 1 : 0);
          break;
        }
        case 'rail':
          if (rs.type === 'powered' || rs.type === 'activator') {
            const p = this.railPowered(x, y, z, rs);
            if (p !== rs.on) this.set(x, y, z, CM.rsWith(id, { on: p }));
          }
          break;
        case 'hook':
          this.evalHook(x, y, z);
          break;
        default:
          break;
      }
    }

    // Action programmée (délai écoulé).
    tickBlock(x, y, z) {
      const w = this.w, id = w.get(x, y, z), rs = blk(id).rs;
      if (!rs) return;
      switch (rs.k) {
        case 'torch': {
          const want = !this.torchInput(x, y, z, rs);
          if (want === rs.lit) break;
          // grillée : trop de changements en peu de temps (8 en 3 secondes)
          const tk = 'tb' + key(x, y, z);
          const hist = (this.data.get(tk) || []).filter((t) => this.gt - t < 60);
          if (want && hist.length >= 8) {
            this.data.set(tk, hist);
            this.g.entities.burst(CM.Textures.layer.smoke, x + 0.5, y + 0.8, z + 0.5, 6, { speed: 0.6, grav: -2, life: 0.8, size: 0.12 });
            CM.Audio.play('burn');
            this.sched.set(key(x, y, z), this.gt + 160);
            break;
          }
          hist.push(this.gt);
          this.data.set(tk, hist);
          this.set(x, y, z, CM.rsWith(id, { lit: want }));
          break;
        }
        case 'repeater': {
          if (this.locked(x, y, z, rs)) break;
          const want = this.repIn(x, y, z, rs) > 0;
          if (want !== rs.on) {
            this.set(x, y, z, CM.rsWith(id, { on: want }));
            // impulsion plus courte que le délai : elle dure au moins le délai, puis on relit l'entrée
            if (want) this.schedule(x, y, z, rs.delay * 2);
          }
          break;
        }
        case 'comparator': {
          const out = this.compCalc(x, y, z, rs), before = this.compOut(x, y, z, rs);
          this.data.set('co' + key(x, y, z), out);
          if (out > 0 !== rs.on) this.set(x, y, z, CM.rsWith(id, { on: out > 0 }));
          else if (out !== before) this.notify(x, y, z, false);
          break;
        }
        case 'lamp':
          if (!this.powered(x, y, z)) this.set(x, y, z, CM.rsWith(id, { on: false }));
          break;
        case 'observer':
          if (!rs.on) {
            this.set(x, y, z, CM.rsWith(id, { on: true }));
            this.schedule(x, y, z, 2);
          } else this.set(x, y, z, CM.rsWith(id, { on: false }));
          break;
        case 'button':
          if (rs.on) {
            if (rs.wood && this.arrowIn(x, y, z)) this.schedule(x, y, z, 30);
            else {
              this.set(x, y, z, CM.rsWith(id, { on: false }));
              CM.Audio.play('rsclick', { pitch: 0.8 });
            }
          }
          break;
        case 'plate':
        case 'tripwire':
          if (!this.occ.has(key(x, y, z))) this.release(x, y, z);
          break;
        case 'rail':
          if (rs.type === 'detector' && !this.occ.has(key(x, y, z))) this.release(x, y, z);
          break;
        case 'piston': {
          const want = this.pistonPowered(x, y, z, rs);
          if (want && !rs.ext) this.extend(x, y, z, rs);
          else if (!want && rs.ext) this.retract(x, y, z, rs);
          break;
        }
        case 'dispenser':
        case 'dropper':
          this.dispense(x, y, z, rs);
          break;
        case 'target':
          this.setD(x, y, z, 'tg', 0);
          this.notify(x, y, z, false);
          break;
        case 'sculk':
          if (rs.active) {
            this.setD(x, y, z, 'sk', 0);
            this.set(x, y, z, CM.rsWith(id, { active: false }));
            this.setD(x, y, z, 'cd', this.gt + 10);
          }
          break;
        default:
          break;
      }
    }

    // ------------------------------------------------ présence (plaques) --
    // Joueurs, créatures, objets, flèches et wagonnets : plaques, fils de déclenchement, rails détecteurs.
    presence() {
      const g = this.g, w = this.w, ents = g.entities;
      const occ = new Map();
      const mark = (x, y, z, hw, kind) => {
        const y0 = Math.floor(y + 0.02);
        for (let X = Math.floor(x - hw); X <= Math.floor(x + hw); X++)
          for (let Z = Math.floor(z - hw); Z <= Math.floor(z + hw); Z++) {
            for (const Y of [y0, y0 - 1]) {
              const rs = blk(w.get(X, Y, Z)).rs;
              if (!rs || (rs.k !== 'plate' && rs.k !== 'tripwire' && !(rs.k === 'rail' && rs.type === 'detector'))) continue;
              if (rs.k === 'rail' && kind !== 'cart') continue;
              if (Y === y0 - 1 && y - Y > 1.3) continue;
              const k = key(X, Y, Z);
              let o = occ.get(k);
              if (!o) occ.set(k, (o = { p: 0, m: 0, i: 0, c: 0 }));
              o[kind === 'player' ? 'p' : kind === 'mob' ? 'm' : kind === 'cart' ? 'c' : 'i']++;
            }
          }
      };
      const players = g.net && g.net.isHost ? g.net.simPlayers() : [g.player];
      for (const p of players) if (p && p.alive !== false) mark(p.x, p.y, p.z, 0.3, 'player');
      for (const m of ents.mobs) if (!m.dead) mark(m.x, m.y, m.z, m.hw, 'mob');
      for (const d of ents.drops) if (!d.dead) mark(d.x, d.y, d.z, 0.12, 'item');
      for (const a of ents.arrows || []) if (!a.dead) mark(a.x, a.y, a.z, 0.05, 'item');
      for (const c of ents.carts || []) if (!c.dead) mark(c.x, c.y, c.z, 0.45, 'cart');
      this.occ = occ;
      // créatures qui marchent : vibrations pour les capteurs de sculk
      if (this.watch.sculk.size) {
        if (!this.steps) this.steps = new WeakMap();
        for (const m of ents.mobs) {
          if (m.dead || !m.onGround) continue;
          const last = this.steps.get(m);
          if (!last) {
            this.steps.set(m, [m.x, m.z]);
            continue;
          }
          const d = Math.hypot(m.x - last[0], m.z - last[1]);
          if (d > 4) this.steps.set(m, [m.x, m.z]);
          else if (d > 1.8) {
            this.steps.set(m, [m.x, m.z]);
            this.vibrate(m.x, m.y + 0.5, m.z);
          }
        }
      }
      for (const [k, o] of occ) {
        const [x, y, z] = unkey(k);
        const id = w.get(x, y, z), rs = blk(id).rs;
        if (rs.k === 'plate') {
          const all = o.p + o.m + o.i + o.c;
          const pw = rs.plate === 'stone' ? (o.p + o.m > 0 ? 15 : 0) : rs.plate === 'wood' ? (all ? 15 : 0) : rs.plate === 'light' ? Math.min(15, all) : Math.min(15, Math.ceil(all / 10));
          if (pw && (!rs.on || this.getD(x, y, z, 'pl') !== pw)) {
            this.setD(x, y, z, 'pl', pw);
            if (!rs.on) {
              this.set(x, y, z, CM.rsWith(id, { on: true }));
              CM.Audio.play('rsclick', { pitch: 0.9 });
            } else this.notify(x, y, z, false);
            this.notify(x, y - 1, z, false);
          }
          if (pw) this.pressed.add(k);
        } else if (rs.k === 'tripwire') {
          if (!rs.on) {
            this.set(x, y, z, CM.rsWith(id, { on: true }));
            this.hookScan(x, y, z);
          }
          this.pressed.add(k);
        } else if (rs.k === 'rail') {
          if (!rs.on) {
            this.set(x, y, z, CM.rsWith(id, { on: true }));
            this.notify(x, y - 1, z, false);
          }
          this.pressed.add(k);
        }
      }
      for (const k of this.pressed) {
        if (occ.has(k)) continue;
        const [x, y, z] = unkey(k);
        const rs = blk(w.get(x, y, z)).rs;
        if (!rs) {
          this.pressed.delete(k);
          continue;
        }
        this.schedule(x, y, z, rs.k === 'plate' ? 20 : 10);
      }
    }
    release(x, y, z) {
      const w = this.w, id = w.get(x, y, z), rs = blk(id).rs, k = key(x, y, z);
      this.pressed.delete(k);
      if (!rs) return;
      if (rs.k === 'plate') {
        this.setD(x, y, z, 'pl', 0);
        if (rs.on) {
          this.set(x, y, z, CM.rsWith(id, { on: false }));
          CM.Audio.play('rsclick', { pitch: 0.7 });
        }
        this.notify(x, y - 1, z, false);
      } else if (rs.k === 'tripwire') {
        if (rs.on) {
          this.set(x, y, z, CM.rsWith(id, { on: false }));
          this.hookScan(x, y, z);
        }
      } else if (rs.k === 'rail' && rs.on) {
        this.set(x, y, z, CM.rsWith(id, { on: false }));
        this.notify(x, y - 1, z, false);
      }
    }
    arrowIn(x, y, z) {
      for (const a of this.g.entities.arrows || []) if (!a.dead && Math.floor(a.x) === x && Math.floor(a.y) === y && Math.floor(a.z) === z) return true;
      return false;
    }

    // ----------------------------------------- crochets et ficelle ----
    // Crochets reliés par la ficelle passant par (x, y, z) : on les réévalue.
    hookScan(x, y, z) {
      const w = this.w;
      for (const d of HD) {
        for (let k = 1; k <= 41; k++) {
          const X = x + DV[d][0] * k, Z = z + DV[d][2] * k;
          const rs = blk(w.get(X, y, Z)).rs;
          if (rs && rs.k === 'tripwire') continue;
          if (rs && rs.k === 'hook' && rs.facing === OPP[d]) this.evalHook(X, y, Z);
          break;
        }
      }
      const rs0 = blk(w.get(x, y, z)).rs;
      if (rs0 && rs0.k === 'hook') this.evalHook(x, y, z);
    }
    evalHook(x, y, z) {
      const w = this.w, id = w.get(x, y, z), rs = blk(id).rs;
      if (!rs || rs.k !== 'hook') return;
      const f = rs.facing;
      let done = false, tripped = false, k = 1;
      for (; k <= 41; k++) {
        const r2 = blk(w.get(x + DV[f][0] * k, y, z + DV[f][2] * k)).rs;
        if (r2 && r2.k === 'tripwire') {
          if (r2.on) tripped = true;
          continue;
        }
        if (r2 && r2.k === 'hook' && r2.facing === OPP[f] && k > 1) done = true;
        break;
      }
      const st = done ? (tripped ? 2 : 1) : 0;
      if (st !== rs.st) {
        this.set(x, y, z, CM.rsWith(id, { st }));
        if (st === 2) CM.Audio.play('rsclick', { pitch: 1.4 });
        const a = rs.attach;
        this.notify(x + DV[a][0], y, z + DV[a][2], false);
      }
      if (done) {
        const X = x + DV[f][0] * k, Z = z + DV[f][2] * k;
        const oid = w.get(X, y, Z), ors = blk(oid).rs;
        if (ors.st !== st) {
          this.set(X, y, Z, CM.rsWith(oid, { st }));
          const a = ors.attach;
          this.notify(X + DV[a][0], y, Z + DV[a][2], false);
        }
      }
    }

    // ----------------------------------------------------- capteurs ----
    daylightTick() {
      const g = this.g, w = this.w;
      for (const k of this.watch.daylight) {
        const [x, y, z] = unkey(k);
        const rs = blk(w.get(x, y, z)).rs;
        if (!rs || rs.k !== 'daylight' || !w.loaded(x, z)) continue;
        const sky = w.skyAt(x, y, z);
        let p = w.nether ? 0 : Math.round(sky * CM.clamp((g.daylight - 0.1) / 0.8, 0, 1));
        if (rs.inv) p = 15 - p;
        if (p !== this.getD(x, y, z, 'dl')) {
          this.setD(x, y, z, 'dl', p);
          this.notify(x, y, z, false);
        }
      }
    }
    // Vibration (pas, bloc posé ou cassé…) : les capteurs de sculk à 8 blocs s'activent.
    vibrate(x, y, z) {
      const w = this.w;
      for (const k of this.watch.sculk) {
        const [X, Y, Z] = unkey(k);
        const d = Math.hypot(X + 0.5 - x, Y + 0.5 - y, Z + 0.5 - z);
        if (d > 8 || d < 0.6) continue;
        const id = w.get(X, Y, Z), rs = blk(id).rs;
        if (!rs || rs.k !== 'sculk' || rs.active || this.getD(X, Y, Z, 'cd') > this.gt) continue;
        const p = Math.max(1, Math.min(15, Math.round(15 - (d / 8) * 14)));
        this.setD(X, Y, Z, 'sk', p);
        this.set(X, Y, Z, CM.rsWith(id, { active: true }));
        this.schedule(X, Y, Z, 30);
        const pl = this.g.player;
        if (pl && Math.hypot(pl.x - X, pl.z - Z) < 16) CM.Audio.play('rsclick', { pitch: 0.5 });
      }
    }
    // Une flèche touche une cible : puissance selon la précision.
    hitTarget(x, y, z, hx, hy, hz) {
      const w = this.w, rs = blk(w.get(x, y, z)).rs;
      if (!rs || rs.k !== 'target') return;
      const d = Math.max(Math.abs(hx - x - 0.5), Math.abs(hy - y - 0.5), Math.abs(hz - z - 0.5));
      // distance au centre de la face touchée (la plus petite des deux autres coordonnées)
      const off = [Math.abs(hx - x - 0.5), Math.abs(hy - y - 0.5), Math.abs(hz - z - 0.5)].sort((a, b) => a - b);
      const acc = Math.max(off[0], off[1]);
      void d;
      const p = Math.max(1, Math.min(15, Math.ceil(15 * (1 - acc / 0.5))));
      this.setD(x, y, z, 'tg', p);
      this.notify(x, y, z, false);
      this.sched.delete(key(x, y, z));
      this.schedule(x, y, z, 20);
    }
    // Coffre piégé : nombre de joueurs qui regardent dedans (puissance = ce nombre).
    setViewers(x, y, z, n) {
      const rs = blk(this.w.get(x, y, z)).rs;
      if (!rs || rs.k !== 'trapped') return;
      n = Math.min(15, Math.max(0, n));
      if (this.getD(x, y, z, 'tc') === n) return;
      this.setD(x, y, z, 'tc', n);
      this.notify(x, y, z, false);
      this.notify(x, y - 1, z, false);
      this.flush();
    }
    playNote(x, y, z) {
      const g = this.g;
      if (blk(this.w.get(x, y + 1, z)).solid) return;
      const n0 = ((x * 7 + y * 3 + z * 5) % 24 + 24) % 24;
      const k = g.bkey(x, y, z);
      const n = g.noteBlocks[k] === undefined ? n0 : g.noteBlocks[k];
      g.noteFx(x, y, z, n);
      if (g.net.isHost) g.net.toDim({ t: 'note', x, y, z, n }, g.dim);
    }
    // Chaîne de rails de propulsion (8 au plus) : alimentée si l'un d'eux reçoit du courant.
    railPowered(x, y, z, rs) {
      if (this.powered(x, y, z)) return true;
      const w = this.w, seen = new Set([key(x, y, z)]);
      let front = [[x, y, z, 0]];
      while (front.length) {
        const next = [];
        for (const [X, Y, Z, dpt] of front) {
          if (dpt >= 8) continue;
          const r2 = railRs(w.get(X, Y, Z));
          for (const e of railExits(r2)) {
            const q = railNeighbor(w, X, Y, Z, e);
            if (!q) continue;
            const kq = key(q[0], q[1], q[2]);
            if (seen.has(kq)) continue;
            seen.add(kq);
            const r3 = railRs(w.get(q[0], q[1], q[2]));
            if (!r3 || r3.type !== rs.type) continue;
            if (this.powered(q[0], q[1], q[2])) return true;
            next.push([q[0], q[1], q[2], dpt + 1]);
          }
        }
        front = next;
      }
      return false;
    }

    // -------------------------------------------------------- pistons ----
    reaction(id, x, y) {
      const b = blk(id);
      if (!id) return 'air';
      if (y < CM.WORLD.MINY || y >= CM.WORLD.H) return 'block';
      if (CM.isFluid(id) || b.replaceable || b.plant || b.pushDestroy || b.render === 'cross' || b.render === 'torch' || b.door || b.bed || b.fire || b.render === 'carpet') return 'destroy';
      if (b.immovable || b.container || b.unbreakable || b.hardness < 0 || b.portal || b.station || b.enchanter || id === CM.B.OBSIDIAN || id === CM.B.CRYING_OBSIDIAN || b.tech) return 'block';
      return 'normal';
    }
    // Blocs à déplacer (algorithme de Minecraft : 12 au plus, blocs de slime et de miel collants).
    resolve(px, py, pz, f, extending) {
      const w = this.w;
      const dir = extending ? f : OPP[f];
      const start = extending ? [px + DV[f][0], py + DV[f][1], pz + DV[f][2]] : [px + DV[f][0] * 2, py + DV[f][1] * 2, pz + DV[f][2] * 2];
      const pk = key(px, py, pz);
      const toPush = [], pushSet = new Set(), toDestroy = [];
      const get = (p) => w.get(p[0], p[1], p[2]);
      const at = (p, d, n) => [p[0] + DV[d][0] * n, p[1] + DV[d][1] * n, p[2] + DV[d][2] * n];
      const sticky = (id) => id === CM.B.SLIME_BLOCK || id === CM.B.HONEY_BLOCK;
      const stick = (a, b) => !((a === CM.B.SLIME_BLOCK && b === CM.B.HONEY_BLOCK) || (a === CM.B.HONEY_BLOCK && b === CM.B.SLIME_BLOCK)) && (sticky(a) || sticky(b));
      const pushable = (p, allowDestroy) => {
        const r = this.reaction(get(p), p[0], p[1]);
        return r === 'normal' || (r === 'destroy' && allowDestroy);
      };
      const add = (p) => {
        toPush.push(p);
        pushSet.add(key(p[0], p[1], p[2]));
      };
      const addLine = (origin) => {
        let id = get(origin);
        if (!id) return true;
        if (!pushable(origin, false)) return true;
        if (key(origin[0], origin[1], origin[2]) === pk || pushSet.has(key(origin[0], origin[1], origin[2]))) return true;
        let i = 1;
        if (i + toPush.length > 12) return false;
        while (sticky(id)) {
          const p = at(origin, OPP[dir], i);
          const prev = id;
          id = get(p);
          if (!id || !stick(prev, id) || !pushable(p, false) || key(p[0], p[1], p[2]) === pk) break;
          i++;
          if (i + toPush.length > 12) return false;
        }
        for (let j = i - 1; j >= 0; j--) add(at(origin, OPP[dir], j));
        for (let j = 1; ; j++) {
          const p = at(origin, dir, j);
          const kp = key(p[0], p[1], p[2]);
          if (pushSet.has(kp)) {
            for (const q of toPush.slice()) if (sticky(get(q)) && !branch(q)) return false;
            return true;
          }
          const id2 = get(p);
          if (!id2) return true;
          if (!pushable(p, true) || kp === pk) return false;
          if (this.reaction(id2, p[0], p[1]) === 'destroy') {
            toDestroy.push(p);
            return true;
          }
          if (toPush.length >= 12) return false;
          add(p);
        }
      };
      const branch = (p) => {
        const id = get(p);
        for (let d = 0; d < 6; d++) {
          if (d === dir || d === OPP[dir]) continue;
          const q = at(p, d, 1);
          if (stick(get(q), id) && !addLine(q)) return false;
        }
        return true;
      };
      const r0 = this.reaction(get(start), start[0], start[1]);
      if (r0 === 'block') return null;
      if (r0 === 'destroy') return extending ? { toPush, toDestroy: [start], dir } : { toPush, toDestroy: [], dir };
      if (r0 === 'air') return { toPush, toDestroy, dir };
      if (!addLine(start)) return null;
      for (let i = 0; i < toPush.length; i++) if (sticky(get(toPush[i])) && !branch(toPush[i])) return null;
      return { toPush, toDestroy, dir };
    }
    moveBlocks(res) {
      const w = this.w, g = this.g, d = res.dir;
      for (const p of res.toDestroy) {
        const id = w.get(p[0], p[1], p[2]);
        this.set(p[0], p[1], p[2], 0);
        if (!CM.isFluid(id)) for (const [did, n] of CM.blockDrops(id, Math.random)) g.entities.addDrop(did, n, p[0] + 0.5, p[1] + 0.3, p[2] + 0.5);
      }
      const moves = res.toPush.map((p) => [p[0], p[1], p[2], w.get(p[0], p[1], p[2])]);
      for (const [x, y, z] of moves) this.set(x, y, z, 0);
      const cells = [];
      for (const [x, y, z, id] of moves) {
        const X = x + DV[d][0], Y = y + DV[d][1], Z = z + DV[d][2];
        this.set(X, Y, Z, id);
        cells.push([X, Y, Z]);
      }
      return cells;
    }
    extend(x, y, z, rs) {
      const w = this.w, f = rs.facing, id = w.get(x, y, z);
      const res = this.resolve(x, y, z, f, true);
      if (!res) return;
      const cells = this.moveBlocks(res);
      this.set(x, y, z, CM.rsWith(id, { ext: true }));
      const hx = x + DV[f][0], hy = y + DV[f][1], hz = z + DV[f][2];
      this.set(hx, hy, hz, CM.rsWith(CM.RSFAM.piston_head.base, { facing: f, sticky: !!rs.sticky }));
      cells.push([hx, hy, hz]);
      this.pushEntities(cells, f);
      this.pistonSound(x, y, z, true);
    }
    retract(x, y, z, rs) {
      const w = this.w, f = rs.facing, id = w.get(x, y, z);
      const hx = x + DV[f][0], hy = y + DV[f][1], hz = z + DV[f][2];
      const h = blk(w.get(hx, hy, hz)).rs;
      if (h && h.k === 'phead' && h.facing === f) this.set(hx, hy, hz, 0);
      this.set(x, y, z, CM.rsWith(id, { ext: false }));
      if (rs.sticky) {
        const tx = x + DV[f][0] * 2, ty = y + DV[f][1] * 2, tz = z + DV[f][2] * 2;
        const tid = w.get(tx, ty, tz);
        if (tid && this.reaction(tid, tx, ty) === 'normal') {
          const res = this.resolve(x, y, z, f, false);
          if (res) this.moveBlocks(res);
        }
      }
      this.pistonSound(x, y, z, false);
    }
    pistonSound(x, y, z, out) {
      const p = this.g.player;
      if (p && Math.hypot(p.x - x, p.y - y, p.z - z) < 24) CM.Audio.play('piston', { out });
    }
    // Les entités dans les cases poussées avancent d'un bloc.
    pushEntities(cells, d) {
      const g = this.g, ents = g.entities;
      const hit = (x, y, z, hw, h) => cells.some(([X, Y, Z]) => x + hw > X && x - hw < X + 1 && y + h > Y && y < Y + 1 && z + hw > Z && z - hw < Z + 1);
      const push = (o) => {
        o.x += DV[d][0];
        o.y += DV[d][1] + (d === 2 ? 0.05 : 0);
        o.z += DV[d][2];
        if (d === 2 && o.vy !== undefined) o.vy = Math.max(o.vy, 0);
      };
      const p = g.player;
      if (g.dim === g.playerDim && p.alive && hit(p.x, p.y, p.z, p.hw, p.h)) push(p);
      for (const m of ents.mobs) if (!m.dead && hit(m.x, m.y, m.z, m.hw, m.h)) push(m);
      for (const o of ents.drops) if (!o.dead && hit(o.x, o.y, o.z, 0.12, 0.25)) push(o);
      for (const c of ents.carts || []) if (!c.dead && hit(c.x, c.y, c.z, 0.45, 0.7)) push(c);
      if (g.net.isHost) for (const rp of g.net.remotes.values()) if (rp.seen && rp.alive && rp.dim === g.dim && hit(rp.x, rp.y, rp.z, 0.3, 1.8)) g.net.sendTo(rp.pid, { t: 'push', v: DV[d] });
    }

    // --------------------------------------------- distributeurs ----
    dispense(x, y, z, rs) {
      const g = this.g, w = this.w;
      const slots = g.chestAt(x, y, z);
      const full = [];
      slots.forEach((s, i) => s && full.push(i));
      const pl = g.player, near = pl && Math.hypot(pl.x - x, pl.y - y, pl.z - z) < 20;
      if (!full.length) {
        if (near) CM.Audio.play('rsclick', { pitch: 0.6 });
        return;
      }
      const i = full[Math.floor(Math.random() * full.length)];
      const s = slots[i], info = CM.itemInfo(s.id);
      const f = rs.facing, fx = x + DV[f][0], fy = y + DV[f][1], fz = z + DV[f][2];
      const front = w.get(fx, fy, fz), fb = blk(front);
      const take = () => {
        s.count--;
        if (s.count <= 0) slots[i] = null;
      };
      const I = CM.I;
      let done = false;
      if (rs.k === 'dropper') {
        if (fb.container) {
          const tgt = g.chestAt(fx, fy, fz);
          if (CM.insertStack(tgt, { id: s.id, count: 1, extra: CM.stackExtra(s) })) {
            take();
            done = true;
          }
        }
      } else if (info.type === 'bucket' && (info.water || info.lava)) {
        if (!front || (fb.replaceable && !CM.isFluid(front))) {
          if (!(info.water && w.nether)) w.setBlock(fx, fy, fz, info.lava ? CM.B.LAVA : CM.B.WATER);
          slots[i] = { id: I.BUCKET, count: 1 };
          done = true;
        }
      } else if (s.id === I.BUCKET) {
        if (front === CM.B.WATER || front === CM.B.LAVA) {
          w.setBlock(fx, fy, fz, 0);
          const filled = front === CM.B.LAVA ? I.LAVA_BUCKET : I.WATER_BUCKET;
          take();
          if (!CM.insertStack(slots, { id: filled, count: 1 })) g.entities.addDrop(filled, 1, fx + 0.5, fy + 0.5, fz + 0.5);
          done = true;
        }
      } else if (s.id === CM.B.TNT) {
        take();
        g.entities.addTnt(fx + 0.5, fy, fz + 0.5, 4);
        done = true;
      } else if (info.type === 'igniter') {
        if (fb.tnt) g.primeTnt(fx, fy, fz);
        else if (!front) w.setBlock(fx, fy, fz, CM.B.FIRE);
        done = true;
      } else if (s.id === I.BONE_MEAL) {
        if (g.growAt(fx, fy, fz, true)) take();
        done = true;
      } else if (s.id === I.ARROW && g.entities.shootArrow) {
        take();
        const sp = 18;
        g.entities.shootArrow(fx + 0.5 - DV[f][0] * 0.3, fy + 0.5 - DV[f][1] * 0.3, fz + 0.5 - DV[f][2] * 0.3, DV[f][0] * sp, DV[f][1] * sp + (f < 2 || f > 3 ? 1.5 : 0), DV[f][2] * sp, null);
        done = true;
      } else if (info.type === 'cart' && g.entities.addCart) {
        if (railRs(front)) {
          take();
          g.entities.addCart(info.cart, fx + 0.5, fy, fz + 0.5);
        }
        done = true;
      }
      if (!done) {
        const extra = CM.stackExtra(s);
        const id = s.id;
        take();
        g.entities.addDrop(id, 1, fx + 0.5 - DV[f][0] * 0.3, fy + 0.4, fz + 0.5 - DV[f][2] * 0.3, extra, [DV[f][0] * 4 + (Math.random() - 0.5), DV[f][1] * 4 + 1.5, DV[f][2] * 4 + (Math.random() - 0.5)]);
      }
      if (near) CM.Audio.play('dispense');
      g.entities.burst(CM.Textures.layer.smoke, fx + 0.5 - DV[f][0] * 0.4, fy + 0.5, fz + 0.5 - DV[f][2] * 0.4, 4, { speed: 0.8, grav: -1, life: 0.6, size: 0.1 });
    }

    // --------------------------------------------------- entonnoirs ----
    hopperTick() {
      const g = this.g, w = this.w;
      for (const k of this.watch.hopper) {
        const [x, y, z] = unkey(k);
        if (!w.loaded(x, z)) continue;
        const rs = blk(w.get(x, y, z)).rs;
        if (!rs || rs.k !== 'hopper') continue;
        const cd = this.getD(x, y, z, 'hc');
        if (cd > this.gt || this.getD(x, y, z, 'hl')) continue;
        const slots = g.chestAt(x, y, z);
        let moved = false;
        // pousse un objet dans le conteneur visé
        const f = rs.facing, tx = x + DV[f][0], ty = y + DV[f][1], tz = z + DV[f][2];
        // (ou un wagonnet à coffre / à entonnoir dans la case visée)
        const cartIn = (X, Y, Z) => (g.entities.carts || []).find((c) => !c.dead && c.slots && Math.floor(c.x) === X && Math.floor(c.z) === Z && Math.floor(c.y + 0.1) === Y);
        const tcart = !blk(w.get(tx, ty, tz)).solid ? cartIn(tx, ty, tz) : null;
        if (blk(w.get(tx, ty, tz)).container || blk(w.get(tx, ty, tz)).tech || tcart) {
          const tgt = tcart ? tcart.slots : CM.Tech && blk(w.get(tx, ty, tz)).tech ? CM.Tech.inputSlots(this, tx, ty, tz) : g.chestAt(tx, ty, tz);
          if (tgt)
            for (let i = 0; i < slots.length && !moved; i++) {
              const s = slots[i];
              if (!s) continue;
              if (CM.insertStack(tgt, { id: s.id, count: 1, extra: CM.stackExtra(s) })) {
                s.count--;
                if (s.count <= 0) slots[i] = null;
                moved = true;
              }
            }
        }
        // aspire depuis le conteneur au-dessus, ou les objets posés dessus
        const ab = blk(w.get(x, y + 1, z));
        const scart = !ab.solid ? cartIn(x, y + 1, z) : null;
        if (ab.container || ab.tech || scart) {
          const src = scart ? scart.slots : ab.tech && CM.Tech ? CM.Tech.outputSlots(this, x, y + 1, z) : g.chestAt(x, y + 1, z);
          if (src)
            for (let i = 0; i < src.length; i++) {
              const s = src[i];
              if (!s) continue;
              if (CM.insertStack(slots, { id: s.id, count: 1, extra: CM.stackExtra(s) })) {
                s.count--;
                if (s.count <= 0) src[i] = null;
                moved = true;
                break;
              }
            }
        } else if (!ab.solid) {
          for (const d of g.entities.drops) {
            if (d.dead || d.x < x || d.x > x + 1 || d.z < z || d.z > z + 1 || d.y < y + 0.6 || d.y > y + 2) continue;
            const left = CM.insertStack(slots, { id: d.id, count: d.count, extra: d.extra }, true);
            if (left < d.count) {
              moved = true;
              d.count = left;
              if (!left) d.dead = true;
            }
          }
        }
        if (moved) {
          this.setD(x, y, z, 'hc', this.gt + 8);
          this.notify(x, y, z, false);
          if (blk(w.get(tx, ty, tz)).container) this.notify(tx, ty, tz, false);
        }
      }
    }
  }

  // Range un objet dans des cases (fusionne avec les piles identiques). Renvoie true si tout
  // est rangé ; avec `partial`, renvoie le nombre restant.
  CM.insertStack = function (slots, it, partial) {
    const info = CM.itemInfo(it.id);
    if (!info) return partial ? it.count : false;
    const max = info.stack || 64;
    const extra = it.extra || null;
    let left = it.count;
    const same = (s) => s && s.id === it.id && !CM.stackExtra(s) && !extra;
    for (let i = 0; i < slots.length && left > 0; i++) {
      const s = slots[i];
      if (same(s) && s.count < max) {
        const n = Math.min(left, max - s.count);
        s.count += n;
        left -= n;
      }
    }
    for (let i = 0; i < slots.length && left > 0; i++) {
      if (slots[i]) continue;
      const n = Math.min(left, max);
      slots[i] = Object.assign({ id: it.id, count: n }, extra || {});
      left -= n;
    }
    if (partial) return left;
    if (left > 0) {
      // pas la place : on annule (rien n'a été pris à la source)
      return false;
    }
    return true;
  };

  CM.Redstone = Redstone;
})();
