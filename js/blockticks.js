'use strict';
// Blocs qui évoluent seuls : l'eau et la lave qui coulent, le feu (comme dans Minecraft).
// Seul l'hôte (ou la partie solo) les simule ; les invités reçoivent les blocs modifiés.
(function () {
  const B = CM.B;
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const NB6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const WATER_DELAY = 0.25; // 5 ticks de Minecraft
  const LAVA_DELAY = 1.5; // 30 ticks (10 dans le Nether)
  const MAX_FLUID_PER_FRAME = 160;
  const MAX_FIRES = 400;

  const blk = (id) => CM.blocks[id];
  const kindOf = (id) => CM.WATERY[id]; // 1 eau, 2 lave, 0 autre
  const idsOf = (kind) => (kind === 2 ? CM.LAVA_IDS : CM.WATER_IDS);
  // Niveau « efficace » : une chute nourrit les côtés comme une source.
  const effLevel = (id) => {
    const l = blk(id).level;
    return l === 8 ? 0 : l;
  };
  // Un liquide peut-il entrer dans cette case ? (air, plantes, torches, feu… qu'il emporte ou brûle)
  const canFlow = (id) => {
    if (id === 0) return true;
    const b = blk(id);
    if (CM.WATERY[id] || b.solid || b.portal) return false;
    return b.replaceable || b.plant || b.render === 'torch' || !!b.fire;
  };

  // Direction du courant dans une case de liquide qui coule : vers les niveaux plus bas et le vide.
  CM.flowVector = function (w, x, y, z) {
    const id = w.get(x, y, z), kind = kindOf(id), b = blk(id);
    if (!kind || b.level === 0) return null;
    const L = b.level === 8 ? 0 : b.level;
    let vx = 0, vz = 0;
    for (const [dx, dz] of DIRS4) {
      const n = w.get(x + dx, y, z + dz);
      if (kindOf(n) === kind) {
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
      this.dueLava = new Map(); // lave : idem, plus lente
      this.fires = new Map(); // feu : clé -> { age, due }
      this.embers = new Map(); // lave près de blocs inflammables : clé -> prochain essai d'allumage
      this.portalChecks = new Set(); // portails dont un voisin a changé (cadre peut-être cassé)
    }
    get world() {
      return this.game.world;
    }
    get active() {
      return !this.game.net.isClient;
    }
    get nether() {
      return this.world && this.world.type === 'nether';
    }
    // Au chargement d'une partie (ou d'une dimension) : les feux déjà présents reprennent.
    reset() {
      this.due.clear();
      this.dueLava.clear();
      this.fires.clear();
      this.embers.clear();
      this.portalChecks.clear();
      if (!this.active || !this.world) return;
      for (const [x, y, z] of this.world.editedWhere((id) => id === B.FIRE)) this.addFire(x, y, z);
      // liquides posés ou qui coulaient encore : ils reprennent (sans rien changer s'ils sont stables)
      for (const [x, y, z, id] of this.world.editedWhere((id) => CM.isLava(id) || (CM.isWater(id) && blk(id).level !== 0))) this.schedule(x, y, z, kindOf(id));
    }
    schedule(x, y, z, kind) {
      const k = x + ',' + y + ',' + z;
      const map = kind === 2 ? this.dueLava : this.due;
      if (!map.has(k)) map.set(k, this.t + (kind === 2 ? (this.nether ? LAVA_DELAY / 3 : LAVA_DELAY) : WATER_DELAY));
    }
    addFire(x, y, z) {
      const k = x + ',' + y + ',' + z;
      // un feu né d'un autre garde à peu près son âge (sinon l'incendie ne s'arrêterait jamais)
      if (!this.fires.has(k)) this.fires.set(k, { age: this.spawnAge || 0, due: this.t + 1.5 + Math.random() * 0.5 });
    }
    // Pose un feu issu du feu d'âge « age » (comme dans Minecraft : il vieillit parfois d'un cran).
    spreadFire(X, Y, Z, age) {
      this.spawnAge = Math.min(15, age + (Math.random() < 0.2 ? 1 : 0));
      this.world.setBlock(X, Y, Z, B.FIRE);
      this.spawnAge = 0;
    }
    // Un bloc a changé : les liquides voisins réagissent, un nouveau feu commence à vivre.
    onEdit(x, y, z, id) {
      if (!this.active) return;
      const w = this.world;
      if (kindOf(id)) this.schedule(x, y, z, kindOf(id));
      for (const [dx, dy, dz] of NB6) {
        const kind = kindOf(w.get(x + dx, y + dy, z + dz));
        if (kind) this.schedule(x + dx, y + dy, z + dz, kind);
      }
      if (id === B.FIRE) this.addFire(x, y, z);
      if (!blk(id).portal) {
        for (const [dx, dy, dz] of NB6) if (blk(w.get(x + dx, y + dy, z + dz)).portal) this.portalChecks.add(x + dx + ',' + (y + dy) + ',' + (z + dz));
      }
    }

    update(dt) {
      if (!this.active || !this.world) return;
      this.t += dt;
      if (this.portalChecks.size) {
        const list = [...this.portalChecks];
        this.portalChecks.clear();
        for (const k of list) {
          const [x, y, z] = k.split(',').map(Number);
          this.game.checkPortal(x, y, z);
        }
      }
      let n = 0;
      for (const map of [this.due, this.dueLava]) {
        for (const [k, t] of map) {
          if (t > this.t || n >= MAX_FLUID_PER_FRAME) break;
          map.delete(k);
          n++;
          const [x, y, z] = k.split(',').map(Number);
          this.tickFluid(x, y, z);
        }
      }
      if (this.fires.size) {
        for (const [k, f] of this.fires) {
          if (f.due > this.t) continue;
          const [x, y, z] = k.split(',').map(Number);
          this.tickFire(x, y, z, f, k);
        }
      }
      if (this.embers.size) {
        for (const [k, t] of this.embers) {
          if (t > this.t) continue;
          this.embers.delete(k);
          const [x, y, z] = k.split(',').map(Number);
          if (CM.isLava(this.world.get(x, y, z))) this.lavaIgnite(x, y, z, true);
        }
      }
    }

    // ------------------------------------------------------- liquides --
    // Réglages du liquide : pas de niveau par case, distance de recherche des trous.
    step(kind) {
      return kind === 2 && !this.nether ? 2 : 1;
    }
    tickFluid(x, y, z) {
      const w = this.world;
      if (y < CM.WORLD.MINY || y >= CM.WORLD.H || !w.loaded(x, z)) return;
      const id = w.get(x, y, z), kind = kindOf(id);
      if (!kind) return;
      if (kind === 2 && this.lavaMeetsWater(x, y, z, id)) return;
      const lvl = blk(id).level;
      if (lvl !== 0) {
        const nl = this.targetLevel(x, y, z, kind);
        if (nl !== lvl) {
          w.setBlock(x, y, z, nl < 0 ? 0 : idsOf(kind)[nl]);
          return;
        }
      }
      this.spread(x, y, z, lvl, kind);
      if (kind === 2) this.lavaIgnite(x, y, z, false);
    }
    // Lave contre eau : la source durcit en obsidienne, la lave qui coule en galets.
    lavaMeetsWater(x, y, z, id) {
      const w = this.world;
      for (const [dx, dy, dz] of NB6) {
        if (dy < 0) continue;
        if (!CM.isWater(w.get(x + dx, y + dy, z + dz))) continue;
        w.setBlock(x, y, z, blk(id).level === 0 ? B.OBSIDIAN : B.COBBLE);
        this.fizz(x, y, z);
        return true;
      }
      return false;
    }
    fizz(x, y, z) {
      const g = this.game, p = g.player;
      if (p && Math.hypot(p.x - x, p.y - y, p.z - z) < 20) CM.Audio.play('burn');
      if (g.entities) g.entities.burst(CM.Textures.layer.smoke, x + 0.5, y + 1, z + 0.5, 6, { speed: 0.6, grav: -2, life: 0.8, size: 0.12 });
    }
    // Niveau que devrait avoir une case de liquide qui coule, d'après ses voisines (-1 : elle disparaît).
    targetLevel(x, y, z, kind) {
      const w = this.world;
      if (kindOf(w.get(x, y + 1, z)) === kind) return 8;
      let best = 99, sources = 0;
      for (const [dx, dz] of DIRS4) {
        const n = w.get(x + dx, y, z + dz);
        if (kindOf(n) !== kind) continue;
        if (blk(n).level === 0) sources++;
        best = Math.min(best, effLevel(n));
      }
      // source infinie (eau seulement) : deux sources voisines et un appui (bloc solide ou source) dessous
      const below = w.get(x, y - 1, z);
      if (kind === 1 && sources >= 2 && (blk(below).solid || below === B.WATER)) return 0;
      const out = best + this.step(kind);
      return out <= 7 ? out : -1;
    }
    spread(x, y, z, lvl, kind) {
      const w = this.world;
      const below = w.get(x, y - 1, z), bk = kindOf(below), bb = blk(below);
      // la lave qui tombe sur de l'eau la change en pierre
      if (kind === 2 && bk === 1) {
        w.setBlock(x, y - 1, z, B.STONE);
        this.fizz(x, y - 1, z);
        return;
      }
      const hole = y > CM.WORLD.MINY && (canFlow(below) || bk === kind);
      if (y > CM.WORLD.MINY && (canFlow(below) || (bk === kind && bb.level !== 0 && bb.level !== 8))) this.flowInto(x, y - 1, z, 8, kind);
      // le liquide qui coule tombe plutôt que de s'étaler ; une source s'étale toujours
      if (hole && lvl !== 0) return;
      const st = this.step(kind);
      const out = lvl === 0 || lvl === 8 ? st : lvl + st;
      if (out > 7) return;
      for (const [dx, dz] of this.bestDirs(x, y, z, kind)) {
        const n = w.get(x + dx, y, z + dz), nb = blk(n);
        if (canFlow(n) || (kindOf(n) === kind && nb.level !== 0 && nb.level !== 8 && nb.level > out)) this.flowInto(x + dx, y, z + dz, out, kind);
      }
    }
    flowInto(x, y, z, l, kind) {
      const w = this.world, g = this.game;
      if (!w.loaded(x, z)) return;
      const id = w.get(x, y, z), b = blk(id);
      if (id && !kindOf(id) && !b.fire) {
        // l'eau emporte plantes et torches (qui tombent en objets), la lave les brûle
        if (kind === 1) for (const [did, n] of CM.blockDrops(id, Math.random)) g.entities.addDrop(did, n, x + 0.5, y + 0.3, z + 0.5);
        else this.fizz(x, y, z);
      }
      w.setBlock(x, y, z, idsOf(kind)[l]);
    }
    // Comme dans Minecraft : le liquide part vers le trou le plus proche (4 blocs au plus, 2 pour la lave), sinon partout.
    bestDirs(x, y, z, kind) {
      const reach = kind === 2 && !this.nether ? 2 : 4;
      let best = Infinity;
      const res = [];
      for (const [dx, dz] of DIRS4) {
        const d = this.holeDist(x + dx, y, z + dz, dx, dz, 1, kind, reach);
        if (d === null) continue;
        if (d < best) {
          best = d;
          res.length = 0;
        }
        if (d === best) res.push([dx, dz]);
      }
      return res;
    }
    holeDist(x, y, z, fdx, fdz, depth, kind, reach) {
      const w = this.world;
      const id = w.get(x, y, z), b = blk(id);
      if (!canFlow(id) && !(kindOf(id) === kind && b.level !== 0)) return null;
      const below = w.get(x, y - 1, z);
      if (canFlow(below) || kindOf(below) === kind) return depth;
      if (depth >= reach) return 1000;
      let best = 1000;
      for (const [dx, dz] of DIRS4) {
        if (dx === -fdx && dz === -fdz) continue;
        const d = this.holeDist(x + dx, y, z + dz, dx, dz, depth + 1, kind, reach);
        if (d !== null && d < best) best = d;
      }
      return best;
    }
    // La lave met parfois le feu à l'air voisin des blocs inflammables (et réessaie tant qu'il y en a).
    lavaIgnite(x, y, z, roll) {
      const g = this.game, w = this.world;
      if (!g.options.fireSpread || this.fires.size > MAX_FIRES) return;
      let found = false;
      for (let dy = 0; dy <= 2; dy++)
        for (let dz = -2; dz <= 2; dz++)
          for (let dx = -2; dx <= 2; dx++) {
            const X = x + dx, Y = y + dy, Z = z + dz;
            if (w.get(X, Y, Z) !== 0) continue;
            let flam = false;
            for (const [ex, ey, ez] of NB6) if (blk(w.get(X + ex, Y + ey, Z + ez)).flam) flam = true;
            if (!flam) continue;
            found = true;
            if (roll && Math.random() < 0.08) {
              w.setBlock(X, Y, Z, B.FIRE);
              return;
            }
          }
      const k = x + ',' + y + ',' + z;
      if (found && this.embers.size < 600 && !this.embers.has(k)) this.embers.set(k, this.t + 3 + Math.random() * 6);
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
      // comme dans Minecraft : un tick toutes les 1,5 à 2 s, l'âge (0 à 15) monte d'un cran une fois sur trois
      if (f.age < 15 && Math.random() < 1 / 3) f.age++;
      f.due = this.t + 1.5 + Math.random() * 0.5;
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
        // rien à brûler autour : il s'éteint vite ; sinon il ne meurt qu'une fois vieux (âge 15)
        if (!flamNear && (!bb.solid || f.age > 3)) return this.extinguish(x, y, z, k);
        if (f.age >= 15 && Math.random() < 0.25 && !bb.flam) return this.extinguish(x, y, z, k);
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
        // le bloc brûlé devient du feu (surtout si le feu est jeune) ou disparaît
        if (Math.random() * (f.age + 10) < 5) this.spreadFire(X, Y, Z, f.age);
        else w.setBlock(X, Y, Z, 0);
      }
      // difficulté : le feu se propage plus facilement (comme dans Minecraft)
      const dif = { peaceful: 0, easy: 1, normal: 2, hard: 3 }[g.difficulty];
      const boost = (dif === undefined ? 2 : dif) * 7;
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
            const l = Math.floor((enc + 40 + boost) / (f.age + 30));
            if (l > 0 && Math.floor(Math.random() * odds) <= l) this.spreadFire(X, Y, Z, f.age);
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
