'use strict';
// Blocs qui évoluent seuls : l'eau qui coule et le feu (comme dans Minecraft).
// Seul l'hôte (ou la partie solo) les simule ; les invités reçoivent les blocs modifiés.
(function () {
  const B = CM.B;
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const NB6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const WATER_DELAY = 0.25; // 5 ticks de Minecraft
  const MAX_WATER_PER_FRAME = 160;
  const MAX_FIRES = 400;

  const blk = (id) => CM.blocks[id];
  // Niveau « efficace » : une chute nourrit les côtés comme une source.
  const effLevel = (id) => {
    const l = blk(id).level;
    return l === 8 ? 0 : l;
  };
  // L'eau peut-elle entrer dans cette case ? (air, plantes, torches, feu… qu'elle emporte)
  const canFlow = (id) => {
    if (id === 0) return true;
    const b = blk(id);
    if (b.water || b.solid) return false;
    return b.replaceable || b.plant || b.render === 'torch' || !!b.fire;
  };

  // Direction du courant dans une case d'eau qui coule : vers les niveaux plus bas et le vide.
  CM.flowVector = function (w, x, y, z) {
    const b = blk(w.get(x, y, z));
    if (!b.water || b.level === 0) return null;
    const L = b.level === 8 ? 0 : b.level;
    let vx = 0, vz = 0;
    for (const [dx, dz] of DIRS4) {
      const n = w.get(x + dx, y, z + dz), nb = blk(n);
      if (nb.water) {
        const d = effLevel(n) - L;
        vx += dx * d;
        vz += dz * d;
      } else if (canFlow(n)) {
        vx += dx * (8 - L) * 0.5;
        vz += dz * (8 - L) * 0.5;
      }
    }
    const l = Math.hypot(vx, vz);
    if (l < 1e-3) return b.level === 8 ? [0, 0, -1] : null;
    return [vx / l, vz / l, b.level === 8 ? -1 : 0];
  };

  class BlockTicks {
    constructor(game) {
      this.game = game;
      this.t = 0;
      this.due = new Map(); // eau : clé -> instant (dans l'ordre d'insertion = ordre des échéances)
      this.fires = new Map(); // feu : clé -> { age, due }
    }
    get world() {
      return this.game.world;
    }
    get active() {
      return !this.game.net.isClient;
    }
    // Au chargement d'une partie : les feux déjà présents reprennent.
    reset() {
      this.due.clear();
      this.fires.clear();
      if (!this.active) return;
      for (const [x, y, z] of this.world.editedWhere((id) => id === B.FIRE)) this.addFire(x, y, z);
    }
    schedule(x, y, z) {
      const k = x + ',' + y + ',' + z;
      if (!this.due.has(k)) this.due.set(k, this.t + WATER_DELAY);
    }
    addFire(x, y, z) {
      const k = x + ',' + y + ',' + z;
      if (!this.fires.has(k)) this.fires.set(k, { age: 0, due: this.t + 1 + Math.random() });
    }
    // Un bloc a changé : l'eau voisine réagit, un nouveau feu commence à vivre.
    onEdit(x, y, z, id) {
      if (!this.active) return;
      const w = this.world;
      if (CM.isWater(id)) this.schedule(x, y, z);
      for (const [dx, dy, dz] of NB6) if (CM.isWater(w.get(x + dx, y + dy, z + dz))) this.schedule(x + dx, y + dy, z + dz);
      if (id === B.FIRE) this.addFire(x, y, z);
    }

    update(dt) {
      if (!this.active || !this.world) return;
      this.t += dt;
      let n = 0;
      for (const [k, t] of this.due) {
        if (t > this.t || n >= MAX_WATER_PER_FRAME) break;
        this.due.delete(k);
        n++;
        const [x, y, z] = k.split(',').map(Number);
        this.tickWater(x, y, z);
      }
      if (this.fires.size) {
        for (const [k, f] of this.fires) {
          if (f.due > this.t) continue;
          const [x, y, z] = k.split(',').map(Number);
          this.tickFire(x, y, z, f, k);
        }
      }
    }

    // ------------------------------------------------------------ eau --
    tickWater(x, y, z) {
      const w = this.world;
      if (y < CM.WORLD.MINY || y >= CM.WORLD.H || !w.loaded(x, z)) return;
      const id = w.get(x, y, z);
      if (!CM.isWater(id)) return;
      const lvl = blk(id).level;
      if (lvl !== 0) {
        const nl = this.targetLevel(x, y, z);
        if (nl !== lvl) {
          w.setBlock(x, y, z, nl < 0 ? 0 : CM.WATER_IDS[nl]);
          return;
        }
      }
      this.spread(x, y, z, lvl);
    }
    // Niveau que devrait avoir une case d'eau qui coule, d'après ses voisines (-1 : elle disparaît).
    targetLevel(x, y, z) {
      const w = this.world;
      if (CM.isWater(w.get(x, y + 1, z))) return 8;
      let best = 99, sources = 0;
      for (const [dx, dz] of DIRS4) {
        const n = w.get(x + dx, y, z + dz);
        if (!CM.isWater(n)) continue;
        if (blk(n).level === 0) sources++;
        best = Math.min(best, effLevel(n));
      }
      // source infinie : deux sources voisines et un appui (bloc solide ou source) dessous
      const below = w.get(x, y - 1, z);
      if (sources >= 2 && (blk(below).solid || below === B.WATER)) return 0;
      return best + 1 <= 7 ? best + 1 : -1;
    }
    spread(x, y, z, lvl) {
      const w = this.world;
      const below = w.get(x, y - 1, z), bb = blk(below);
      const hole = y > 0 && (canFlow(below) || bb.water);
      if (y > 0 && (canFlow(below) || (bb.water && bb.level !== 0 && bb.level !== 8))) this.flowInto(x, y - 1, z, 8);
      // l'eau qui coule tombe plutôt que de s'étaler ; une source s'étale toujours
      if (hole && lvl !== 0) return;
      const out = lvl === 0 || lvl === 8 ? 1 : lvl + 1;
      if (out > 7) return;
      for (const [dx, dz] of this.bestDirs(x, y, z)) {
        const n = w.get(x + dx, y, z + dz), nb = blk(n);
        if (canFlow(n) || (nb.water && nb.level !== 0 && nb.level !== 8 && nb.level > out)) this.flowInto(x + dx, y, z + dz, out);
      }
    }
    flowInto(x, y, z, l) {
      const w = this.world, g = this.game;
      if (!w.loaded(x, z)) return;
      const id = w.get(x, y, z), b = blk(id);
      // l'eau emporte plantes et torches (qui tombent en objets) et éteint le feu
      if (id && !b.water && !b.fire) for (const [did, n] of CM.blockDrops(id, Math.random)) g.entities.addDrop(did, n, x + 0.5, y + 0.3, z + 0.5);
      w.setBlock(x, y, z, CM.WATER_IDS[l]);
    }
    // Comme dans Minecraft : l'eau part vers le trou le plus proche (4 blocs au plus), sinon partout.
    bestDirs(x, y, z) {
      let best = Infinity;
      const res = [];
      for (const [dx, dz] of DIRS4) {
        const d = this.holeDist(x + dx, y, z + dz, dx, dz, 1);
        if (d === null) continue;
        if (d < best) {
          best = d;
          res.length = 0;
        }
        if (d === best) res.push([dx, dz]);
      }
      return res;
    }
    holeDist(x, y, z, fdx, fdz, depth) {
      const w = this.world;
      const id = w.get(x, y, z), b = blk(id);
      if (!canFlow(id) && !(b.water && b.level !== 0)) return null;
      const below = w.get(x, y - 1, z);
      if (canFlow(below) || CM.isWater(below)) return depth;
      if (depth >= 4) return 1000;
      let best = 1000;
      for (const [dx, dz] of DIRS4) {
        if (dx === -fdx && dz === -fdz) continue;
        const d = this.holeDist(x + dx, y, z + dz, dx, dz, depth + 1);
        if (d !== null && d < best) best = d;
      }
      return best;
    }

    // ------------------------------------------------------------ feu --
    tickFire(x, y, z, f, k) {
      const w = this.world, g = this.game;
      if (!w.loaded(x, z)) {
        f.due = this.t + 2;
        return;
      }
      if (w.get(x, y, z) !== B.FIRE) {
        this.fires.delete(k);
        return;
      }
      f.age++;
      f.due = this.t + 1.5 + Math.random();
      const below = w.get(x, y - 1, z), bb = blk(below);
      const eternal = below === B.NETHERRACK || below === B.MAGMA;
      let wet = false, flamNear = false;
      for (const [dx, dy, dz] of NB6) {
        const n = w.get(x + dx, y + dy, z + dz);
        if (CM.isWater(n)) wet = true;
        if (blk(n).flam) flamNear = true;
      }
      if (wet) return this.extinguish(x, y, z, k);
      if (!eternal) {
        if (!flamNear && !bb.solid) return this.extinguish(x, y, z, k);
        if (!flamNear && f.age > 3 && Math.random() < 0.25) return this.extinguish(x, y, z, k);
        if (f.age > 15 && Math.random() < 0.25 && !bb.flam) return this.extinguish(x, y, z, k);
      }
      if (!g.options.fireSpread || this.fires.size > MAX_FIRES) return;
      // les blocs inflammables autour brûlent (et prennent feu à leur tour)
      for (const [dx, dy, dz] of NB6) {
        const X = x + dx, Y = y + dy, Z = z + dz, b = blk(w.get(X, Y, Z));
        if (!b.flam || Math.random() * (dy ? 250 : 300) >= b.flam[1]) continue;
        if (b.tnt) {
          g.primeTnt(X, Y, Z);
          continue;
        }
        w.setBlock(X, Y, Z, Math.random() < 0.6 && f.age < 10 ? B.FIRE : 0);
      }
      // et le feu saute dans l'air voisin des blocs inflammables (plus facilement vers le haut)
      for (let dy = -1; dy <= 4; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy && !dz) continue;
            const X = x + dx, Y = y + dy, Z = z + dz;
            if (w.get(X, Y, Z) !== 0) continue;
            let enc = 0;
            for (const [ex, ey, ez] of NB6) {
              const fl = blk(w.get(X + ex, Y + ey, Z + ez)).flam;
              if (fl && fl[0] > enc) enc = fl[0];
            }
            if (!enc) continue;
            const odds = 100 + (dy > 1 ? (dy - 1) * 100 : 0);
            if (Math.random() * odds < (enc + 40) / (f.age + 30)) w.setBlock(X, Y, Z, B.FIRE);
          }
    }
    extinguish(x, y, z, k) {
      this.fires.delete(k);
      this.world.setBlock(x, y, z, 0);
      const p = this.game.player;
      if (p && Math.hypot(p.x - x, p.z - z) < 16) CM.Audio.play('burn');
    }
  }

  CM.BlockTicks = BlockTicks;
})();
