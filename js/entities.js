'use strict';
// Physique, créatures (Mouflons, Ombres), objets au sol et particules.
(function () {
  const mat4 = CM.mat4;
  const B = CM.B;
  const I = CM.I;

  // ---------------------------------------------------------- physique ---
  const EPS = 1e-4;
  // Chaque case a sa boîte de collision (bloc plein, dalle, tapis, battant de porte…).
  CM.Physics = {
    // Parcourt les boîtes solides qui chevauchent la boîte ; fn(x, y, z, boîte) peut renvoyer true pour arrêter.
    each(world, x, y, z, hw, h, fn) {
      const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw - 1e-7);
      const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-7);
      const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw - 1e-7);
      const FULL = CM.FULL_BOX;
      for (let yy = y0; yy <= y1; yy++)
        for (let zz = z0; zz <= z1; zz++)
          for (let xx = x0; xx <= x1; xx++) {
            const b = world.colBox(xx, yy, zz);
            if (!b) continue;
            if (b.stair) {
              // escalier : moitié pleine + marche (forme selon les escaliers voisins)
              for (const q of CM.stairParts(world, xx, yy, zz)) {
                if (yy + q[4] <= y || yy + q[1] >= y + h) continue;
                if (xx + q[3] <= x - hw || xx + q[0] >= x + hw || zz + q[5] <= z - hw || zz + q[2] >= z + hw) continue;
                if (fn(xx, yy, zz, q)) return true;
              }
              continue;
            }
            if (b !== FULL) {
              if (yy + b[4] <= y || yy + b[1] >= y + h) continue;
              if (xx + b[3] <= x - hw || xx + b[0] >= x + hw || zz + b[5] <= z - hw || zz + b[2] >= z + hw) continue;
            }
            if (fn(xx, yy, zz, b)) return true;
          }
      return false;
    },
    overlaps(world, x, y, z, hw, h) {
      return this.each(world, x, y, z, hw, h, () => true);
    },
    // Hauteur du plus haut obstacle chevauché (ou -Infinity).
    topOf(world, x, y, z, hw, h) {
      let top = -Infinity;
      this.each(world, x, y, z, hw, h, (xx, yy, zz, b) => {
        top = Math.max(top, yy + b[4]);
      });
      return top;
    },
    // Déplace une boîte (e.x, e.y, e.z = centre du bas ; e.hw demi-largeur ; e.h hauteur).
    // e.stepUp : hauteur qu'on peut franchir sans sauter (dalles, tapis).
    move(world, e, dx, dy, dz) {
      e.hitX = e.hitY = e.hitZ = false;
      e.landed = false;
      const canStep = e.stepUp && e.onGround;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
      dx /= steps;
      dy /= steps;
      dz /= steps;
      for (let s = 0; s < steps; s++) {
        if (dy) {
          e.y += dy;
          if (this.overlaps(world, e.x, e.y, e.z, e.hw, e.h)) {
            if (dy < 0) {
              e.y = this.topOf(world, e.x, e.y, e.z, e.hw, e.h) + EPS;
              e.landed = true;
            } else {
              let low = Infinity;
              this.each(world, e.x, e.y, e.z, e.hw, e.h, (xx, yy, zz, b) => {
                low = Math.min(low, yy + b[1]);
              });
              e.y = low - e.h - EPS;
            }
            e.hitY = true;
            dy = 0;
          }
        }
        for (const axis of ['x', 'z']) {
          const dv = axis === 'x' ? dx : dz;
          if (!dv) continue;
          e[axis] += dv;
          if (!this.overlaps(world, e.x, e.y, e.z, e.hw, e.h)) continue;
          // petite marche : on monte dessus si la place est libre
          if (canStep) {
            const top = this.topOf(world, e.x, e.y, e.z, e.hw, e.h);
            const rise = top - e.y;
            if (rise > 0 && rise <= e.stepUp && !this.overlaps(world, e.x, top + EPS, e.z, e.hw, e.h)) {
              e.y = top + EPS;
              e.stepped = (e.stepped || 0) + rise;
              continue;
            }
          }
          // on s'arrête contre la face de la boîte la plus proche devant soi
          const prev = e[axis] - dv, a0 = axis === 'x' ? 0 : 2;
          let edge = dv > 0 ? Infinity : -Infinity;
          this.each(world, e.x, e.y, e.z, e.hw, e.h, (xx, yy, zz, b) => {
            const c = axis === 'x' ? xx : zz;
            if (dv > 0) {
              const f = c + b[a0];
              if (f >= prev + e.hw - 1e-3) edge = Math.min(edge, f);
            } else {
              const f = c + b[a0 + 3];
              if (f <= prev - e.hw + 1e-3) edge = Math.max(edge, f);
            }
          });
          if (edge === Infinity || edge === -Infinity) {
            // déjà coincé dans un bloc : on se cale sur la case comme avant
            const cell = Math.floor(dv > 0 ? e[axis] + e.hw : e[axis] - e.hw);
            e[axis] = dv > 0 ? cell - e.hw - EPS : cell + 1 + e.hw + EPS;
          } else e[axis] = dv > 0 ? edge - e.hw - EPS : edge + e.hw + EPS;
          if (axis === 'x') { e.hitX = true; dx = 0; } else { e.hitZ = true; dz = 0; }
        }
      }
      // au sol ?
      e.onGround = e.landed || (e.vy <= 0 && this.overlaps(world, e.x, e.y - 0.02, e.z, e.hw, 0.02));
    },
  };

  // Intersection rayon / boîte (méthode des dalles). Renvoie t ou -1.
  CM.rayBox = function (ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = 1e9;
    const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < lo[a] || o[a] > hi[a]) return -1;
      } else {
        let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return -1;
      }
    }
    return tmin;
  };

  const LOOKERS = new Set(['villager', 'mouflon', 'boar']); // (tournent la tête vers le joueur)
  const DROP_LIFE = 300; // durée de vie d'un objet au sol (secondes)
  CM.DROP_LIFE = DROP_LIFE;
  const MOBS = {
    // pick : la boîte de frappe déborde un peu (tête et museau dépassent du corps)
    mouflon: { hw: 0.4, h: 1.15, hp: 8, speed: 1.4, passive: true, pick: 1.35 },
    boar: { hw: 0.45, h: 0.95, hp: 12, speed: 1.5, passive: true, pick: 1.25 },
    penguin: { hw: 0.28, h: 0.95, hp: 6, speed: 1.1, passive: true },
    ombre: { hw: 0.3, h: 1.95, hp: 16, speed: 3.4 },
    villager: { hw: 0.3, h: 1.95, hp: 20, speed: 1.1, passive: true },
    golem: { hw: 0.65, h: 2.6, hp: 100, speed: 0.9 },
    // Ombre ardente (Nether) : insensible au feu et à la lave, n'a pas peur de la lumière, enflamme
    ardent: { hw: 0.3, h: 1.95, hp: 20, speed: 3.2, fireproof: true, ignites: true },
  };
  MOBS.ombre.hostile = MOBS.ardent.hostile = true;
  // créatures ajoutées par d'autres fichiers (mob_defs.js)
  for (const [k, d] of Object.entries((CM.MORE && CM.MORE.mobs) || {})) MOBS[k] = d;
  CM.MOBS = MOBS;
  // Élevage : la nourriture qui rend un animal amoureux (il suit aussi le joueur qui la tient).
  CM.BREED_FOOD = { mouflon: [I.WHEAT], boar: [I.CARROT, I.POTATO, I.BEETROOT] };
  for (const [k, d] of Object.entries(MOBS)) if (d.breed) CM.BREED_FOOD[k] = d.breed.map((key) => (I[key] !== undefined ? I[key] : CM.B[key])).filter((id) => id !== undefined);
  const BABY_TIME = 300; // un petit devient adulte en 5 minutes
  const BABY_SCALE = 0.55;

  // Métiers des villageois : robe et échanges ([ce qu'on donne], [ce qu'on reçoit]).
  const PROFS = [
    ['Fermier', 'wool_brown', [
      [[['WHEAT', 20]], ['EMERALD', 1]], [[['CARROT', 16]], ['EMERALD', 1]], [[['POTATO', 16]], ['EMERALD', 1]], [[['BEETROOT', 12]], ['EMERALD', 1]],
      [[['EMERALD', 1]], ['BREAD', 6]], [[['EMERALD', 1]], ['PUMPKIN_SEEDS', 4]], [[['EMERALD', 1]], ['MELON_SEEDS', 4]],
      [[['EMERALD', 2]], ['PUMPKIN_PIE', 3]], [[['EMERALD', 3]], ['GOLDEN_CARROT', 3]], [[['EMERALD', 6]], ['GOLDEN_APPLE', 1]],
    ]],
    ['Forgeron', 'wool_gray', [
      [[['COAL', 12]], ['EMERALD', 1]], [[['IRON_INGOT', 4]], ['EMERALD', 1]], [[['EMERALD', 3]], ['AXE_IRON', 1]],
      [[['EMERALD', 4]], ['PICKAXE_IRON', 1]], [[['EMERALD', 5]], ['SWORD_IRON', 1]], [[['EMERALD', 12], ['DIAMOND', 2]], ['PICKAXE_DIAMOND', 1]],
      [[['EMERALD', 4]], ['HELMET_IRON', 1]], [[['EMERALD', 7]], ['CHESTPLATE_IRON', 1]], [[['EMERALD', 6]], ['LEGGINGS_IRON', 1]],
      [[['EMERALD', 3]], ['BOOTS_IRON', 1]], [[['EMERALD', 14], ['DIAMOND', 3]], ['CHESTPLATE_DIAMOND', 1]],
    ]],
    ['Bibliothécaire', 'wool', [
      [[['PAPER', 24]], ['EMERALD', 1]], [[['EMERALD', 1]], ['BOOK', 2]], [[['EMERALD', 1]], ['GLASS', 6]],
      [[['EMERALD', 1]], ['LANTERN', 2]], [[['EMERALD', 2]], ['BOOKSHELF', 1]], [[['EMERALD', 5]], ['LAPIS', 8]],
      [[['BOOK', 4]], ['EMERALD', 1]], [[['EMERALD', 4]], ['COMPASS', 1]], [[['EMERALD', 6]], ['MAP', 1]],
      [[['EMERALD', 12]], ['ENCHANTING_TABLE', 1]],
    ]],
    ['Berger', 'wool_green', [
      [[['WOOL', 16]], ['EMERALD', 1]], [[['EMERALD', 1]], ['WOOL_RED', 4]], [[['EMERALD', 1]], ['WOOL_BLUE', 4]],
      [[['EMERALD', 1]], ['WOOL_YELLOW', 4]], [[['EMERALD', 2]], ['LOOM', 1]], [[['STRING', 14]], ['EMERALD', 1]],
      [[['EMERALD', 2]], ['CARPET', 8]], [[['EMERALD', 3]], ['BED', 1]], [[['EMERALD', 2]], ['PAINTING', 3]],
      [[['EMERALD', 4]], ['ITEM_FRAME', 4]],
    ]],
    ['Boucher', 'wool_red', [
      [[['RAW_MEAT', 10]], ['EMERALD', 1]], [[['LEATHER', 6]], ['EMERALD', 1]], [[['EMERALD', 1]], ['COOKED_MEAT', 5]],
      [[['EMERALD', 1]], ['MUSHROOM_STEW', 2]], [[['EMERALD', 2]], ['CHESTPLATE_LEATHER', 1]], [[['EMERALD', 1]], ['BOOTS_LEATHER', 1]],
      [[['EMERALD', 1]], ['COOKED_SALMON', 4]], [[['EMERALD', 2]], ['CAKE', 1]], [[['EMERALD', 4]], ['SADDLE', 1]],
      [[['EMERALD', 5]], ['GOLDEN_CARROT', 4]],
    ]],
    ['Prêtre', 'wool_purple', [
      [[['SHADOW_ESSENCE', 4]], ['EMERALD', 1]], [[['EMERALD', 1]], ['REDSTONE', 4]], [[['EMERALD', 2]], ['GLOWSTONE_DUST', 4]],
      [[['EMERALD', 3]], ['TORCH', 16]], [[['EMERALD', 8]], ['RUBY', 1]], [[['NETHER_WART', 6]], ['EMERALD', 1]],
      [[['EMERALD', 4]], ['POTION_HEALING', 1]], [[['EMERALD', 5]], ['POTION_NIGHT_VISION', 1]],
      [[['EMERALD', 6]], ['POTION_REGENERATION', 1]], [[['EMERALD', 10]], ['GOLDEN_APPLE', 2]],
    ]],
  ];
  // Niveaux des villageois : échanges faits pour atteindre chaque niveau (novice → maître).
  const VLV = [0, 3, 8, 16, 28];
  CM.VILLAGER_LEVELS = ['Novice', 'Apprenti', 'Compagnon', 'Expert', 'Maître'];
  CM.villagerLevel = (xp) => {
    let l = 1;
    while (l < VLV.length && xp >= VLV[l]) l++;
    return l;
  };
  CM.villagerNext = (lv) => VLV[lv]; // échanges pour le niveau suivant (undefined : maître)
  CM.PROF_COUNT = PROFS.length;
  const itemId = (k) => (CM.I[k] !== undefined ? CM.I[k] : CM.B[k]);
  // Métier d'un villageois : fixé par sa maison (village + numéro d'habitant), sinon par son identifiant.
  // Chaque niveau débloque de nouveaux échanges (les 2 premiers dès le niveau Novice).
  CM.villagerProf = function (m) {
    const pi = m.profIdx !== undefined ? m.profIdx % PROFS.length : Math.floor(CM.hash3(m.uid, 5, 7, 0) * PROFS.length);
    const [name, robe, offers] = PROFS[pi];
    const lv = m.vlv || 1;
    const all = offers
      .map(([give, get]) => ({ give: give.map(([k, n]) => [itemId(k), n]), get: [itemId(get[0]), get[1]] }))
      .filter((o) => o.give.every(([id]) => id !== undefined && CM.itemInfo(id)) && o.get[0] !== undefined && CM.itemInfo(o.get[0]));
    const n = all.length;
    all.forEach((o, i) => (o.lv = i < 2 ? 1 : Math.min(5, 2 + Math.floor(((i - 2) * 4) / Math.max(1, n - 2)))));
    return { name, robe, lv, offers: all, pi };
  };

  let NEXT_UID = 1; // identifiant des entités (partagé avec les invités en multijoueur)
  CM.newUid = () => NEXT_UID++;
  const vilG = (w, p) => w.villageNear(p.x, p.z, 48);
  const NOBODY = { x: 1e9, y: 0, z: 1e9, alive: false, hw: 0.3, h: 1.8, damage() {} };

  class Mob {
    constructor(type, x, y, z) {
      const def = MOBS[type];
      this.uid = NEXT_UID++;
      this.type = type;
      this.x = x; this.y = y; this.z = z;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.hw = def.hw; this.h = def.h; this.stepUp = 0.55;
      this.hp = def.hp; this.maxHp = def.hp;
      this.yaw = Math.random() * Math.PI * 2;
      this.onGround = false;
      this.hurt = 0;
      this.knock = 0;
      this.walk = 0;
      this.dead = false;
      this.age = 0;
      this.ai = { timer: 0, dir: null, flee: 0, attackCd: 0, chasing: false, angry: 0 };
      this.love = 0; // amoureux (secondes restantes)
      this.loveCd = 0; // repos après avoir eu un petit
      this.baby = 0; // petit : secondes avant d'être adulte
      this.tame = false; // animal d'élevage : gardé (et sauvegardé) même loin du joueur
    }
  }

  class Entities {
    constructor(game) {
      this.game = game;
      this.mobs = [];
      this.drops = [];
      this.particles = [];
      this.corpses = []; // créatures tuées, en train de tomber (animation)
      this.pickups = []; // objets ramassés, en train de voler vers le joueur (animation)
      this.spawnTimer = 0;
      this.tnts = [];
      this.nightfall = false;
      this.remote = false; // invité : l'hôte simule, on ne fait qu'afficher
      this.plist = [];
      this.rand = Math.random;
      this.M = mat4.create();
      this.P = mat4.create();
      this.R = mat4.create();
    }
    clear() {
      this.mobs.length = 0;
      this.drops.length = 0;
      this.particles.length = 0;
      this.tnts.length = 0;
      if (this.arrows) this.arrows.length = 0;
      if (this.carts) this.carts.length = 0;
      if (this.falling) this.falling.length = 0;
    }
    // TNT allumée : tombe, clignote puis explose.
    addTnt(x, y, z, fuse) {
      if (this.remote) {
        this.game.net.requestTnt(x, y, z, fuse);
        return;
      }
      this.tnts.push({ uid: NEXT_UID++, x, y, z, vx: 0, vy: 3, vz: 0, hw: 0.49, h: 0.98, fuse, onGround: false });
    }

    addMob(type, x, y, z) {
      const m = new Mob(type, x, y, z);
      if (MOBS[type].init) MOBS[type].init(m, this);
      if (!this.remote) this.mobs.push(m);
      return m;
    }
    // Clic droit d'un joueur sur une créature avec un objet (id) : os, selle, seau, monter…
    // x.host : on applique ce qui change le monde ; x.local : ce qui change l'inventaire (ce joueur est ici).
    interact(m, q, id, local, consume, give) {
      const def = MOBS[m.type];
      if (!def.interact || m.dead) return false;
      const g = this.game;
      return def.interact(this, m, { q, id, host: !this.remote, local, name: CM.playerName(g, q), consume: consume || (() => {}), give: give || (() => {}) });
    }
    // Monture : qui la monte (« local » : le joueur de cet écran chez l'hôte ; sinon le numéro de l'invité).
    riderOf(m) {
      const g = this.game;
      if (m.rider === 'local') return g.player.mount === m.uid && g.player.alive ? g.player : null;
      const rp = g.net.remotes.get(m.rider);
      // (grâce de 2 s : la position « à cheval » de l'invité arrive juste après sa demande)
      return rp && rp.alive && (rp.flags & 128 || g.clock - (m.riderT || 0) < 2) ? rp : null;
    }
    // life : durée de vie (secondes) si ce n'est pas la durée normale (objets perdus à la mort).
    addDrop(id, count, x, y, z, extra, vel, life) {
      if (this.remote) {
        this.game.net.requestDrop(id, count, x, y, z, extra, vel, life);
        return;
      }
      const r = this.rand;
      this.drops.push({
        uid: NEXT_UID++, id, count, extra: extra || null,
        x, y, z, hw: 0.125, h: 0.25,
        vx: vel ? vel[0] : (r() - 0.5) * 3,
        vy: vel ? vel[1] : 3 + r() * 2,
        vz: vel ? vel[2] : (r() - 0.5) * 3,
        age: 0, pickDelay: vel ? 1.2 : 0.25, onGround: false, dead: false,
        spin: r() * 6, life: life > DROP_LIFE ? Math.min(3600, life) : undefined,
      });
    }

    // Particules : petits carrés texturés.
    burst(layer, x, y, z, n, o) {
      o = o || {};
      const q = this.game.options.particles;
      if (q === 0) return;
      if (q === 1) n = Math.ceil(n / 3);
      const r = this.rand;
      for (let i = 0; i < n; i++) {
        const sp = o.speed || 3;
        this.particles.push({
          x: x + (r() - 0.5) * (o.spread || 0.6),
          y: y + (r() - 0.5) * (o.spread || 0.6),
          z: z + (r() - 0.5) * (o.spread || 0.6),
          vx: (r() - 0.5) * sp + (o.vx || 0),
          vy: r() * sp * (o.up === undefined ? 1 : o.up) + (o.lift || 0) + (o.vy || 0),
          vz: (r() - 0.5) * sp + (o.vz || 0),
          life: (o.life || 0.8) * (0.6 + r() * 0.6),
          layer,
          u0: Math.floor(r() * 12) / 16,
          v0: Math.floor(r() * 12) / 16,
          size: (o.size || 0.1) * (0.7 + r() * 0.6),
          grav: o.grav === undefined ? 16 : o.grav,
          flags: o.emissive ? 1 : 0,
          full: !!o.full,
        });
      }
    }
    blockParticles(id, x, y, z, n) {
      const layers = CM.blockLayers[id];
      if (!layers) return;
      this.burst(layers[0], x + 0.5, y + 0.5, z + 0.5, n || 14, { speed: 4, spread: 0.8, size: 0.065 });
    }

    // ------------------------------------------------------ mise à jour --
    // Joueurs simulés (l'hôte voit aussi ses invités).
    players() {
      const g = this.game;
      return g.net && g.net.isHost ? g.net.simPlayers() : [g.player];
    }
    nearestPlayer(x, y, z) {
      let best = null, bd = Infinity;
      for (const p of this.plist) {
        let d = Math.hypot(p.x - x, (p.y - y) * 0.5, p.z - z) + (p.alive ? 0 : 1e6);
        // invisible (potion) : les monstres ne le voient que tout près
        if (d > 3 && (p === this.game.player ? CM.Effects.invisible(p) : p.flags & 256)) continue;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      // personne dans cette dimension (simulée par l'hôte) : un joueur fictif très loin
      return best || NOBODY;
    }

    update(dt) {
      const g = this.game;
      const w = g.world;
      if (this.remote) this.updateRemote(dt);
      else {
        this.plist = this.players();
        for (const m of this.mobs) this.updateMob(m, dt);
        for (const d of this.drops) this.updateDrop(d, dt);
        this.updateTnts(dt);
        this.updateExtra(dt);
      }
      if (this.remote) this.updateExtraRemote(dt);
      for (const p of this.particles) {
        p.life -= dt;
        p.vy -= p.grav * dt;
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
        if (w.solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
          p.vx *= 0.3;
          p.vz *= 0.3;
          p.vy = 0;
        } else {
          p.x = nx;
          p.y = ny;
          p.z = nz;
        }
      }
      this.tnts = this.tnts.filter((t) => !t.dead);
      // rampants et bandits retirés du jeu : ceux qui restaient disparaissent (sans exploser)
      if (!this.remote) for (const m of this.mobs) if (m.type === 'rampant' || m.type === 'bandit') m.dead = true;
      this.mobs = this.mobs.filter((m) => !m.dead);
      this.drops = this.drops.filter((d) => !d.dead);
      this.particles = this.particles.filter((p) => p.life > 0);
      if (this.particles.length > 1500) this.particles.splice(0, this.particles.length - 1500);
      if (this.remote) return;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1;
        this.spawnTick();
      }
    }

    updateTnts(dt) {
      const g = this.game, w = g.world;
      for (const t of this.tnts) {
        t.fuse -= dt;
        t.vy = Math.max(t.vy - 28 * dt, -40);
        CM.Physics.move(w, t, 0, t.vy * dt, 0);
        if (t.hitY) t.vy = 0;
        if (t.fuse <= 0) {
          t.dead = true;
          g.explode(t.x, t.y + 0.5, t.z, 3.3);
        } else if (this.rand() < dt * 20) this.burst(CM.Textures.layer.smoke, t.x, t.y + 1.1, t.z, 1, { speed: 0.5, grav: -2, life: 0.6, size: 0.12 });
      }
    }

    // ------------------------------------------ invité (multijoueur) --
    // Instantané envoyé par l'hôte : { m: créatures, d: objets au sol, tn: TNT }.
    applySnapshot(s) {
      const oldM = new Map(this.mobs.map((m) => [m.uid, m]));
      const keep = new Set((s.m || []).map((a) => a[0]));
      // (retirées par l'hôte : gardées un instant, pour l'animation de mort qui peut arriver après)
      this.lastGone = this.mobs.filter((m) => !keep.has(m.uid) && !m.corpse);
      this.mobs = [];
      for (const a of s.m || []) {
        const [uid, type, x, y, z, yaw, fl, pet, ex] = a;
        if (!MOBS[type]) continue;
        let m = oldM.get(uid);
        if (!m || m.type !== type) {
          m = new Mob(type, x, y, z);
          m.uid = uid;
          m.yaw = yaw;
        }
        m.tx = x; m.ty = y; m.tz = z; m.tyaw = yaw;
        if (fl & 1 && !m.hflag) {
          m.hurt = Math.max(m.hurt, 0.35);
          // coup donné par quelqu'un d'autre : on l'entend aussi
          const p = this.game.player;
          if (!(this.game.clock - (m.localHit || -9) < 0.6) && Math.hypot(p.x - x, p.z - z) < 20) CM.Audio.play(type === 'ombre' || type === 'ardent' ? 'shadow_hurt' : 'hit');
        }
        m.hflag = fl & 1;
        m.ai.chasing = !!(fl & 2);
        if (!!(fl & 4) !== m.baby > 0) this.setBaby(m, fl & 4 ? 1 : 0);
        m.love = fl & 8 ? 1 : 0;
        m.loveCd = fl & 16 ? 1 : 0;
        m.fire = fl & 32 ? 1 : 0;
        m.ai.special = !!(fl & 64); // rampant qui siffle, squelette qui bande son arc
        m.zzz = fl & 128 ? true : null; // villageois endormi
        // apprivoisé (1), assis (2), sellé (4), robe (8 × n), monté (64)
        const pb = pet | 0;
        m.tame = !!(pb & 1);
        m.sit = !!(pb & 2);
        m.saddle = !!(pb & 4);
        m.variant = (pb >> 3) & 7;
        m.ridden = !!(pb & 64);
        // villageois : métier et niveau ; boss : points de vie (%)
        if (ex !== undefined) {
          if (type === 'villager') {
            const pi = ex & 15, lv = (ex >> 4) & 7;
            if (m.profIdx !== pi || m.vlv !== lv) m.prof = null;
            m.profIdx = pi;
            m.vlv = lv;
            m.vxp = ex >> 7;
          } else m.hpPct = ex;
        }
        this.mobs.push(m);
      }
      const oldD = new Map(this.drops.map((d) => [d.uid, d]));
      this.drops = [];
      for (const [uid, id, count, x, y, z, age] of s.d || []) {
        if (!CM.itemInfo(id)) continue;
        let d = oldD.get(uid);
        if (!d) d = { uid, id, x, y, z, age: Number.isFinite(age) ? age : 0, spin: this.rand() * 6, hw: 0.125, h: 0.25 };
        d.id = id;
        d.count = count;
        d.tx = x; d.ty = y; d.tz = z;
        this.drops.push(d);
        oldD.delete(uid);
      }
      // objets disparus tout près d'un joueur : ramassés, ils volent vers lui
      for (const d of oldD.values()) {
        const q = this.nearPlayer(d.x, d.y, d.z, 1.8);
        if (q) this.addPickup(d, q);
      }
      const oldT = new Map(this.tnts.map((t) => [t.uid, t]));
      this.tnts = [];
      for (const [uid, x, y, z, fuse] of s.tn || []) {
        let t = oldT.get(uid);
        if (!t) t = { uid, x, y, z };
        t.tx = x; t.ty = y; t.tz = z;
        t.fuse = fuse;
        this.tnts.push(t);
      }
      this.applyExtra(s);
    }

    // Invité : déplacements lissés vers les positions reçues + ambiance (sons, étincelles).
    updateRemote(dt) {
      const g = this.game, p = g.player, r = this.rand;
      const k = Math.min(1, dt * 12);
      const lerp = (o) => {
        if (Math.hypot(o.tx - o.x, o.ty - o.y, o.tz - o.z) > 8) {
          o.x = o.tx; o.y = o.ty; o.z = o.tz;
        } else {
          o.x += (o.tx - o.x) * k;
          o.y += (o.ty - o.y) * k;
          o.z += (o.tz - o.z) * k;
        }
      };
      for (const m of this.mobs) {
        const ox = m.x, oz = m.z;
        if (m.uid === p.mount) {
          m.tx = p.x;
          m.ty = p.y;
          m.tz = p.z;
          m.tyaw = p.yaw;
        }
        lerp(m);
        let d = m.tyaw - m.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        m.yaw += d * k;
        const sp = Math.hypot(m.x - ox, m.z - oz) / Math.max(dt, 1e-3);
        m.walk += Math.min(sp, 8) * dt * 3.2;
        m.moving = sp > 0.3;
        m.age += dt;
        m.hurt = Math.max(0, m.hurt - dt);
        const dist = Math.hypot(p.x - m.x, p.z - m.z);
        if (m.love > 0 && dist < 40 && r() < dt * 3) this.hearts(m, 1);
        if (m.fire > 0 && dist < 40 && r() < dt * 14) this.flames(m);
        const def = MOBS[m.type];
        if (def.sound && !(def.passive && !def.neutral)) {
          if (dist < 14 && r() < dt * 0.08) CM.Audio.play(def.sound);
        } else if (MOBS[m.type].passive) {
          if (dist < 14 && r() < dt * 0.04) CM.Audio.play(def.sound || (m.type === 'mouflon' ? 'baa' : m.type === 'boar' ? 'grunt' : m.type === 'villager' ? 'hmm' : 'squeak'));
        } else {
          if (dist < 16 && r() < dt * 0.12) CM.Audio.play('shadow');
          if (g.daylight < 0.4 && dist < 40 && r() < dt * 2.5) this.burst(CM.Textures.layer.ombre_face, m.x + (r() - 0.5) * 0.5, m.y + 1.2 + r() * 0.6, m.z + (r() - 0.5) * 0.5, 1, { speed: 0.3, grav: -0.6, life: 0.9, size: 0.05, emissive: true });
        }
      }
      for (const d of this.drops) {
        lerp(d);
        d.age += dt;
      }
      for (const t of this.tnts) {
        lerp(t);
        t.fuse = Math.max(0, t.fuse - dt);
        if (r() < dt * 20) this.burst(CM.Textures.layer.smoke, t.x, t.y + 1.1, t.z, 1, { speed: 0.5, grav: -2, life: 0.6, size: 0.12 });
      }
    }

    updateMob(m, dt) {
      if (m.dead) return; // (tuée entre deux images)
      const g = this.game, w = g.world, r = this.rand;
      const p = this.nearestPlayer(m.x, m.y, m.z);
      const lp = g.player;
      const distL = Math.hypot(lp.x - m.x, lp.z - m.z); // distance au joueur de cet écran (sons, effets)
      if (!w.loaded(m.x, m.z)) {
        if (m.tame) this.stash(m);
        m.dead = true;
        return;
      }
      m.age += dt;
      // monture : elle suit son cavalier (c'est lui qui la dirige)
      if (m.rider !== undefined && m.rider !== null) {
        const q = this.riderOf(m);
        if (!q) m.rider = null;
        else {
          const ox = m.x, oz = m.z;
          m.x = q.x;
          m.y = q.y;
          m.z = q.z;
          m.yaw = q.yaw;
          const sp = Math.hypot(m.x - ox, m.z - oz) / Math.max(dt, 1e-3);
          m.speedVis = sp;
          m.walk += Math.min(sp, 14) * dt * 2.2;
          m.moving = sp > 0.3;
          m.vx = m.vy = m.vz = 0;
          m.hurt = Math.max(0, m.hurt - dt);
          return;
        }
      }
      if (m.love > 0) {
        m.love -= dt;
        if (distL < 40 && r() < dt * 3) this.hearts(m, 1);
      }
      if (m.loveCd > 0) m.loveCd -= dt;
      if (m.baby > 0) {
        m.baby -= dt;
        if (m.baby <= 0) this.setBaby(m, 0);
      }
      // en feu (Aura de feu) : 1 point de dégât par seconde, l'eau l'éteint
      if (m.fire > 0 && MOBS[m.type].fireproof) m.fire = 0;
      if (m.fire > 0) {
        m.fire -= dt;
        m.fireT = (m.fireT || 0) - dt;
        if (CM.isWater(w.get(Math.floor(m.x), Math.floor(m.y + 0.4), Math.floor(m.z)))) m.fire = 0;
        else if (m.fireT <= 0) {
          m.fireT = 1;
          this.hurtMob(m, 1, null, false, m.fireBy);
          if (m.dead) return;
        }
        if (distL < 40 && r() < dt * 14) this.flames(m);
      }
      m.hurt = Math.max(0, m.hurt - dt);
      m.knock = Math.max(0, m.knock - dt);
      m.ai.attackCd = Math.max(0, m.ai.attackCd - dt);
      // villageois : la nuit, il rentre chez lui et dort dans son lit
      if (m.type === 'villager' && this.villagerNight(m, dt)) return;
      const fx = Math.floor(m.x), fz = Math.floor(m.z);
      const inWater = CM.isWater(w.get(fx, Math.floor(MOBS[m.type].swim ? m.y + m.h * 0.5 : m.y + 0.4), fz));
      const inLava = CM.isLava(w.get(fx, Math.floor(m.y + 0.4), fz)) || CM.isLava(w.get(fx, Math.floor(m.y + 0.05), fz));
      const fireproof = MOBS[m.type].fireproof;
      // dans les flammes : la créature prend feu ; dans la lave, elle brûle vite
      if (!fireproof && w.get(fx, Math.floor(m.y + 0.2), fz) === B.FIRE && !(m.fire > 0)) m.fire = 8;
      if (inLava && !fireproof) {
        m.fire = Math.max(m.fire || 0, 15);
        m.lavaT = (m.lavaT || 0) - dt;
        if (m.lavaT <= 0) {
          m.lavaT = 0.5;
          this.hurtMob(m, 4, null, false, m.fireBy);
          if (m.dead) return;
        }
      }
      let tvx = 0, tvz = 0, jump = false, tvy = 0, climb = false, face;
      const def = MOBS[m.type];
      const dxp = p.x - m.x, dzp = p.z - m.z, dyp = p.y - m.y;
      const distP = Math.hypot(dxp, dzp);
      const ctx = { p, distP, dxp, dzp, dyp, distL, g };
      if (def.tick) def.tick(this, m, dt, ctx);
      // cerf : s'enfuit quand on approche (sauf avec sa nourriture en main)
      if (def.skittish && p.alive && distP < 7 && m.ai.flee <= 0 && !this.tempter(m) && !(m.love > 0)) m.ai.flee = 3;

      if (def.update) {
        // comportement propre (mob_defs.js)
        const o = def.update(this, m, dt, ctx) || {};
        if (m.dead) return;
        tvx = o.tvx || 0;
        tvz = o.tvz || 0;
        tvy = o.tvy || 0;
        climb = !!o.climb;
        face = o.face;
        jump = !!o.jump;
      } else if (m.type === 'golem') {
        // golem de fer : chasse les Ombres autour de lui ; se fâche contre qui l'attaque
        let tgt = null, td = 18;
        if (m.ai.angry > 0 && m.ai.foe && m.ai.foe.alive) {
          m.ai.angry -= dt;
          tgt = m.ai.foe;
          td = Math.hypot(tgt.x - m.x, tgt.z - m.z);
          if (td > 32) m.ai.angry = 0;
        } else {
          m.ai.foe = null;
          for (const o of this.mobs) {
            if (!MOBS[o.type].hostile || o.dead || Math.abs(o.y - m.y) > 8) continue;
            const d = Math.hypot(o.x - m.x, o.z - m.z);
            if (d < td) {
              td = d;
              tgt = o;
            }
          }
        }
        m.ai.chasing = !!tgt;
        m.ai.swing = Math.max(0, (m.ai.swing || 0) - dt);
        if (tgt) {
          const dx = tgt.x - m.x, dz = tgt.z - m.z;
          const dir = Math.atan2(-dx, -dz);
          if (td > 1.8) {
            tvx = -Math.sin(dir) * 2.6;
            tvz = -Math.cos(dir) * 2.6;
          } else m.yaw = dir;
          if (td < 2.5 && Math.abs(tgt.y - m.y) < 2.6 && m.ai.attackCd <= 0) {
            m.ai.attackCd = 1.3;
            m.ai.swing = 0.5;
            if (tgt.damage) this.hitPlayer(tgt, 7, m, 'Un golem de fer');
            else {
              this.hurtMob(tgt, 22, [m.x, m.z]);
              tgt.vy = 9;
            }
            if (distL < 24) CM.Audio.play('golem');
          }
        } else {
          // ronde tranquille autour de son village
          m.ai.timer -= dt;
          if (m.ai.timer <= 0) {
            m.ai.timer = 3 + r() * 5;
            m.ai.dir = r() < 0.5 ? r() * Math.PI * 2 : null;
          }
          if (m.home) {
            const hx = m.home[0] - m.x, hz = m.home[1] - m.z;
            if (hx * hx + hz * hz > 16 * 16) m.ai.dir = Math.atan2(-hx, -hz);
          }
          if (m.ai.dir !== null) {
            const dx = -Math.sin(m.ai.dir), dz = -Math.cos(m.ai.dir);
            const ax = Math.floor(m.x + dx * 1.2), az = Math.floor(m.z + dz * 1.2), ay = Math.floor(m.y);
            if (m.onGround && !w.solidAt(ax, ay - 1, az) && !w.solidAt(ax, ay - 2, az) && !w.solidAt(ax, ay, az)) m.ai.dir = null;
            else {
              tvx = dx * def.speed;
              tvz = dz * def.speed;
            }
          }
        }
      } else if (def.passive && m.ai.angry > 0) {
        // sanglier en colère : charge le joueur
        m.ai.angry -= dt;
        if (distP > 22 || !p.alive) m.ai.angry = 0;
        const dir = Math.atan2(-dxp, -dzp);
        tvx = -Math.sin(dir) * 4.3;
        tvz = -Math.cos(dir) * 4.3;
        if (p.alive && distP < 1.3 + m.hw && Math.abs(dyp) < 1.5 && m.ai.attackCd <= 0) {
          m.ai.attackCd = 1;
          this.hitPlayer(p, def.ram || 2, m, def.cause || 'Un sanglier');
          // la chèvre envoie valser
          if (def.ram && p === g.player) {
            p.vx += (dxp / (distP || 1)) * 9;
            p.vz += (dzp / (distP || 1)) * 9;
            p.vy = Math.max(p.vy, 5);
          }
        }
      } else if (def.passive) {
        let speed = def.speed;
        if (m.ai.flee > 0) {
          m.ai.flee -= dt;
          // (fuit ce qui l'a frappé, ou un pillard proche ; sinon le joueur)
          const ff = m.ai.fleeFrom;
          m.ai.dir = ff ? Math.atan2(ff[0] - m.x, ff[1] - m.z) : Math.atan2(dxp, dzp);
          speed = 4.2;
          if (m.hitX || m.hitZ) m.ai.dir += (r() - 0.5) * 2;
        } else if (CM.BREED_FOOD[m.type] && (this.findMate(m) || this.tempter(m))) {
          // amoureux : rejoint un partenaire ; sinon suit le joueur qui tient sa nourriture
          const mate = this.findMate(m), o = mate || this.tempter(m);
          const dx = o.x - m.x, dz = o.z - m.z, d = Math.hypot(dx, dz);
          m.ai.dir = d > (mate ? 0.7 : 2.2) ? Math.atan2(-dx, -dz) : null;
          if (m.ai.dir === null) m.yaw = Math.atan2(-dx, -dz);
          m.ai.timer = 0.5;
          if (mate) speed = def.speed * 1.3;
          if (mate && d < 1.4) this.breed(m, mate);
        } else {
          m.ai.timer -= dt;
          if (m.ai.timer <= 0) {
            m.ai.timer = 2 + r() * 4;
            m.ai.dir = r() < 0.6 ? r() * Math.PI * 2 : null;
          }
          // villageois : retour vers le centre du village s'il s'en éloigne
          if (m.home) {
            const hx = m.home[0] - m.x, hz = m.home[1] - m.z;
            if (hx * hx + hz * hz > 20 * 20) m.ai.dir = Math.atan2(-hx, -hz);
          }
          // villageois qui rentre chez lui (la nuit tombe) : vers le seuil de sa porte
          if (m.goTo) {
            const dx = m.goTo[0] - m.x, dz = m.goTo[1] - m.z;
            m.ai.dir = Math.hypot(dx, dz) > 0.3 ? Math.atan2(-dx, -dz) : null;
            m.ai.timer = 0.3;
            speed = def.speed * 1.4;
          }
        }
        if (m.ai.dir !== null) {
          const dx = -Math.sin(m.ai.dir), dz = -Math.cos(m.ai.dir);
          // évite les falaises
          const ax = Math.floor(m.x + dx * 0.9), az = Math.floor(m.z + dz * 0.9), ay = Math.floor(m.y);
          if (m.onGround && !w.solidAt(ax, ay - 1, az) && !w.solidAt(ax, ay - 2, az) && !w.solidAt(ax, ay, az) && m.ai.flee <= 0) {
            m.ai.dir = null;
          } else {
            tvx = dx * speed;
            tvz = dz * speed;
          }
        }
        if (distL < 14 && r() < dt * 0.04) CM.Audio.play(def.sound || (m.type === 'mouflon' ? 'baa' : m.type === 'boar' ? 'grunt' : m.type === 'villager' ? 'hmm' : 'squeak'));
        if (def.hop && (tvx || tvz) && m.onGround) jump = true; // le lapin avance par bonds
      } else if (m.type === 'ombre' || m.type === 'ardent') {
        const ardent = m.type === 'ardent';
        const bl = ardent ? 0 : w.blockLightAt(fx, Math.floor(m.y + 0.5), fz);
        const sky = ardent ? 0 : w.skyAt(fx, Math.floor(m.y + 1.5), fz);
        // brûle au soleil
        if (g.daylight > 0.45 && sky >= 12) {
          this.hurtMob(m, 4 * dt, null, true);
          if (r() < dt * 12) this.burst(CM.Textures.layer.smoke, m.x, m.y + 1.2, m.z, 1, { speed: 0.6, grav: -2, life: 1, size: 0.25 });
          if (distL < 24 && r() < dt * 2) CM.Audio.play('burn');
        }
        // craint la lumière des torches
        if (bl >= 9) {
          this.hurtMob(m, 3 * dt, null, true);
          m.ai.flee = 0.8;
          if (r() < dt * 8) this.burst(CM.Textures.layer.smoke, m.x, m.y + 1, m.z, 1, { speed: 0.8, grav: -2, life: 0.8, size: 0.22 });
        }
        let dir = null, speed = def.speed;
        m.ai.chasing = false;
        if (m.ai.flee > 0) {
          m.ai.flee -= dt;
          dir = Math.atan2(dxp, dzp);
        } else if (p.alive && distP < 28 && Math.abs(dyp) < 12) {
          dir = Math.atan2(-dxp, -dzp);
          m.ai.chasing = true;
          if (distP < 10) speed = 3.9;
        } else {
          m.ai.timer -= dt;
          if (m.ai.timer <= 0) {
            m.ai.timer = 2 + r() * 3;
            m.ai.dir = r() < 0.5 ? r() * Math.PI * 2 : null;
          }
          dir = m.ai.dir;
          speed = 1.2;
        }
        if (dir !== null) {
          let dx = -Math.sin(dir), dz = -Math.cos(dir);
          // refuse d'entrer dans une zone éclairée : contourne
          const ax = Math.floor(m.x + dx * 1.2), az = Math.floor(m.z + dz * 1.2);
          if (!ardent && m.ai.flee <= 0 && w.blockLightAt(ax, Math.floor(m.y + 0.5), az) >= 8) {
            const side = (Math.floor(m.age / 3) % 2 ? 1 : -1) * Math.PI / 2;
            dx = -Math.sin(dir + side);
            dz = -Math.cos(dir + side);
            speed *= 0.5;
            m.ai.chasing = false;
          }
          tvx = dx * speed;
          tvz = dz * speed;
        }
        // attaque
        const midSolid = w.solidAt(Math.floor((m.x + p.x) / 2), Math.floor(Math.max(m.y, p.y) + 1.2), Math.floor((m.z + p.z) / 2));
        if (p.alive && distP < 1.25 && dyp > -1.5 && dyp < 1.8 && m.ai.attackCd <= 0 && !midSolid) {
          m.ai.attackCd = 1.1;
          this.hitPlayer(p, ardent ? 4 : 3, m, ardent ? 'Une Ombre ardente' : 'Une Ombre');
        }
        if (distL < 16 && r() < dt * 0.12) CM.Audio.play('shadow');
        if (ardent && distL < 40 && r() < dt * 10) this.flames(m);
        // la nuit, de petites étincelles violettes trahissent leur présence
        if (!ardent && g.daylight < 0.4 && distL < 40 && r() < dt * 2.5) this.burst(CM.Textures.layer.ombre_face, m.x + (r() - 0.5) * 0.5, m.y + 1.2 + r() * 0.6, m.z + (r() - 0.5) * 0.5, 1, { speed: 0.3, grav: -0.6, life: 0.9, size: 0.05, emissive: true });
      }

      if ((m.hitX || m.hitZ) && m.onGround && (tvx || tvz) && !def.noJump) jump = true;
      const swimming = def.swim && inWater;
      if (m.knock <= 0) {
        const acc = swimming ? 4 : m.onGround ? 10 : 2.5;
        m.vx += (tvx - m.vx) * Math.min(1, acc * dt);
        m.vz += (tvz - m.vz) * Math.min(1, acc * dt);
      }
      if (swimming) {
        // poissons, calmars, dauphins : ils nagent dans les trois directions
        m.vy += (tvy - m.vy) * Math.min(1, dt * 3);
        m.vx *= Math.pow(0.5, dt);
        m.vz *= Math.pow(0.5, dt);
      } else if (inWater || inLava) {
        const fv = CM.flowVector(w, fx, Math.floor(m.y + 0.4), fz);
        if (fv) {
          m.vx += fv[0] * (inLava ? 2 : 6) * dt;
          m.vz += fv[1] * (inLava ? 2 : 6) * dt;
        }
        m.vy += (inLava ? 18 : 22) * dt;
        m.vy = Math.min(m.vy, 2.5);
        m.vy -= 14 * dt;
        m.vx *= inLava ? 0.8 : 0.9;
        m.vz *= inLava ? 0.8 : 0.9;
      } else if (def.fly) m.vy += (tvy - m.vy) * Math.min(1, dt * 3); // chauve-souris
      else m.vy -= 28 * dt;
      m.vy = Math.max(m.vy, -40);
      if (jump) m.vy = def.hop ? 6 : 8.2;
      if (climb) m.vy = Math.max(m.vy, 3.5); // araignée : grimpe aux murs
      // toile d'araignée : tout s'y englue (sauf les araignées)
      if (m.type !== 'spider' && CM.Structures && CM.Structures.inWeb(w, m.x, m.y, m.z, m.h)) {
        m.vx *= 0.25;
        m.vz *= 0.25;
        m.vy = Math.max(-1.2, Math.min(m.vy, 1.2));
      }
      const my0 = m.y;
      CM.Physics.move(w, m, m.vx * dt, m.vy * dt, m.vz * dt);
      if (CM.Vehicles && this.carts && this.carts.length) CM.Vehicles.collide(this.game, m, null, my0); // (véhicules solides)
      if (m.hitY) m.vy = 0;
      const sp = Math.hypot(m.vx, m.vz);
      m.walk += sp * dt * 3.2;
      m.moving = sp > 0.3;
      if (face !== undefined || (sp > 0.3 && m.knock <= 0)) {
        const target = face !== undefined ? face : Math.atan2(-m.vx, -m.vz);
        let d = target - m.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        m.yaw += d * Math.min(1, dt * 8);
      }
      if (m.y < CM.WORLD.MINY - 20) m.dead = true;
    }

    // by : joueur à l'origine du coup (autre joueur en multijoueur).
    // opts (enchantements de l'arme) : kb = Recul, fire = Aura de feu, loot = Butin.
    hurtMob(m, dmg, src, silent, by, opts) {
      const g = this.game;
      if (by && by === g.player) by.combatT = g.clock; // (on se bat : pas de téléportation pendant 10 s)
      if (this.remote) {
        // invité : l'hôte applique le coup, on montre seulement l'impact tout de suite
        if (!silent) {
          m.hurt = 0.35;
          m.localHit = g.clock;
          CM.Audio.play(m.type === 'ombre' || m.type === 'ardent' ? 'shadow_hurt' : 'hit');
        }
        g.net.hitMob(m, dmg, opts);
        return;
      }
      // on ne blesse pas son propre animal
      if (m.tame && m.owner !== undefined && by && by.alive !== undefined && CM.isPetOwner && CM.isPetOwner(g, by, m)) return;
      m.hp -= dmg;
      if (opts) {
        if (opts.fire) {
          m.fire = Math.max(m.fire || 0, 4 * opts.fire);
          m.fireBy = by || null;
        }
        if (opts.loot) m.looting = opts.loot;
      }
      if (!silent) {
        m.hurt = 0.35;
        if (src) {
          const dx = m.x - src[0], dz = m.z - src[1];
          const l = Math.hypot(dx, dz) || 1;
          const kb = (m.type === 'golem' ? 1.2 : 7) * (1 + 0.6 * ((opts && opts.kb) || 0));
          m.vx = (dx / l) * kb;
          m.vz = (dz / l) * kb;
          m.vy = m.type === 'golem' ? 1 : 5;
          m.knock = 0.3;
        }
        // un joueur frappe le golem (ou un villageois devant lui) : le golem riposte
        if (by && by.alive !== undefined) {
          if (m.type === 'golem') {
            m.ai.angry = 30;
            m.ai.foe = by;
          } else if (m.type === 'villager') {
            for (const o of this.mobs) {
              if (o.type === 'golem' && Math.hypot(o.x - m.x, o.z - m.z) < 32) {
                o.ai.angry = 30;
                o.ai.foe = by;
              }
            }
          }
        }
        if (Math.hypot(g.player.x - m.x, g.player.z - m.z) < 32) CM.Audio.play(m.type === 'ombre' || m.type === 'ardent' ? 'shadow_hurt' : 'hit');
        if (m.type === 'boar' || MOBS[m.type].retaliate) m.ai.angry = 12;
        else if (MOBS[m.type].passive && !MOBS[m.type].neutral) {
          m.ai.flee = 5;
          m.ai.fleeFrom = src && !(by && by.alive !== undefined) ? [src[0], src[1]] : null;
        }
        if (MOBS[m.type].onHurt) MOBS[m.type].onHurt(this, m, by);
        if (m.type === 'golem') CM.Audio.play('golem');
      }
      if (m.hp <= 0 && !m.dead) this.killMob(m, by);
    }

    defOf(m) {
      return MOBS[m.type];
    }
    killMob(m, by) {
      m.dead = true;
      const r = this.rand;
      const g = this.game;
      // expérience pour le joueur qui l'a tué (Ombre 5, animal 1 à 3)
      const def = MOBS[m.type];
      const xp = def.xp !== undefined ? (m.baby > 0 ? 0 : def.xp) : m.type === 'ombre' ? 5 : m.type === 'ardent' ? 8 : m.type === 'golem' || m.type === 'villager' || m.baby > 0 ? 0 : 1 + Math.floor(r() * 3);
      CM.Social.onKill(g, by, m.type); // (pièces pour celui qui a vaincu une créature hostile)
      if (by && by.pid) g.net.sendTo(by.pid, { t: 'kill', ty: m.type, xp });
      else {
        g.stats.kills[m.type] = (g.stats.kills[m.type] || 0) + 1;
        if (by === g.player) g.player.addXp(xp);
      }
      // Butin : jusqu'à « niveau » objets de plus par sorte ; tué en feu (Aura de feu) : viande cuite
      const lo = m.looting || 0, more = () => (lo ? Math.floor(r() * (lo + 1)) : 0);
      const meat = m.fire > 0 ? I.COOKED_MEAT : I.RAW_MEAT;
      if (m.baby > 0) {
        // un petit ne donne rien
      } else if (def.loot) {
        def.loot(this, m, meat, more);
      } else if (m.type === 'mouflon') {
        this.addDrop(meat, 1 + (r() < 0.5 ? 1 : 0) + more(), m.x, m.y + 0.5, m.z);
        if (r() < 0.7) this.addDrop(B.WOOL, 1 + more(), m.x, m.y + 0.5, m.z);
        if (r() < 0.35 + lo * 0.15) this.addDrop(I.LEATHER, 1, m.x, m.y + 0.5, m.z);
      } else if (m.type === 'boar') {
        this.addDrop(meat, 1 + Math.floor(r() * 3) + more(), m.x, m.y + 0.5, m.z);
        if (r() < 0.7) this.addDrop(I.LEATHER, 1 + (r() < 0.3 ? 1 : 0) + more(), m.x, m.y + 0.5, m.z);
      } else if (m.type === 'penguin') {
        this.addDrop(I.FEATHER, 1 + (r() < 0.5 ? 1 : 0) + more(), m.x, m.y + 0.5, m.z);
      } else if (m.type === 'villager') {
        // rien : on ne gagne rien à s'en prendre aux villageois
      } else if (m.type === 'golem') {
        this.addDrop(I.IRON_INGOT, 3 + Math.floor(r() * 3), m.x, m.y + 1, m.z);
        if (r() < 0.6) this.addDrop(B.FLOWER, 1 + Math.floor(r() * 2), m.x, m.y + 1, m.z);
        // golem construit : il ne reviendra pas
        if (m.built && g.golemHomes) g.golemHomes = g.golemHomes.filter((h) => h[0] !== m.home[0] || h[2] !== m.home[1]);
      } else if (m.type === 'ardent') {
        this.addDrop(I.QUARTZ, 1 + Math.floor(r() * 2) + more(), m.x, m.y + 0.8, m.z);
        if (r() < 0.35 + lo * 0.1) this.addDrop(I.GOLD_INGOT, 1, m.x, m.y + 0.8, m.z);
        if (r() < 0.25) this.addDrop(I.GLOWSTONE_DUST, 1 + more(), m.x, m.y + 0.8, m.z);
        if (r() < 0.25 + lo * 0.1) this.addDrop(I.ARDENT_TEAR, 1, m.x, m.y + 0.8, m.z);
      } else {
        this.addDrop(I.SHADOW_ESSENCE, 1 + (r() < 0.3 ? 1 : 0) + more(), m.x, m.y + 0.8, m.z);
      }
      this.killFx(m.type, m.x, m.y, m.z);
      if (g.net) g.net.fx({ k: 'kill', ty: m.type, x: m.x, y: m.y, z: m.z });
      if (def.onDeath) def.onDeath(this, m, by); // gluant : se divise ; capitaine pillard : mauvais présage
    }
    // Objet ramassé : il file vers le joueur en rapetissant (seulement à l'écran).
    addPickup(d, q) {
      if (this.game.dedicated || this.pickups.length > 40) return;
      this.pickups.push({ id: d.id, x: d.x, y: d.y + 0.1, z: d.z, q, t: 0 });
    }
    // Joueur (soi ou un autre) le plus proche d'un point, à moins de r blocs.
    nearPlayer(x, y, z, r) {
      let best = null, bd = r * r;
      const g = this.game, list = [g.player].concat(g.net && g.net.active ? [...g.net.remotes.values()].filter((q) => q.dim === g.playerDim) : []);
      for (const q of list) {
        if (!q || q.alive === false) continue;
        const qx = q.rx !== undefined ? q.rx : q.x, qy = q.ry !== undefined ? q.ry : q.y, qz = q.rz !== undefined ? q.rz : q.z;
        const dd = (qx - x) ** 2 + (qy + 0.8 - y) ** 2 + (qz - z) ** 2;
        if (dd < bd) {
          bd = dd;
          best = q;
        }
      }
      return best;
    }
    // Créature tuée : une copie tombe sur le côté avant de disparaître (voir render). L'invité
    // retrouve la créature dans sa liste, ou parmi celles que l'hôte vient de retirer.
    addCorpse(type, x, y, z) {
      const def = MOBS[type];
      if (this.game.dedicated || !def || def.boss || (def.h || 1) > 3.2) return;
      let best = null, bd = 2.5;
      for (const m of this.lastGone ? this.mobs.concat(this.lastGone) : this.mobs) {
        if (m.type !== type || m.corpse) continue;
        const d = (m.x - x) ** 2 + (m.y - y) ** 2 + (m.z - z) ** 2;
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      if (!best || this.corpses.length > 24) return;
      best.corpse = true;
      const c = Object.assign({}, best, { corpse: false, hurt: 0, moving: false });
      this.corpses.push({ m: c, t: 0 });
    }
    // Nuage de particules à la mort d'une créature.
    killFx(type, x, y, z) {
      this.addCorpse(type, x, y, z);
      const L = CM.Textures.layer, def = MOBS[type];
      if (def && def.fxTex) {
        this.burst(L[def.fxTex], x, y + def.h * 0.5, z, 10 + Math.round(def.h * 8), { speed: 3 });
        this.burst(L.smoke, x, y + def.h * 0.5, z, 6, { speed: 1.5, grav: -1, life: 0.8, size: 0.2 });
      } else if (type === 'mouflon') this.burst(L.mouflon_wool, x, y + 0.6, z, 16, { speed: 3 });
      else if (type === 'boar') this.burst(L.boar_hide, x, y + 0.5, z, 14, { speed: 3 });
      else if (type === 'penguin' || type === 'villager') this.burst(L.white, x, y + 0.8, z, 14, { speed: 3, size: 0.06 });
      else if (type === 'golem') this.burst(L.golem_body, x, y + 1.3, z, 30, { speed: 4, size: 0.1 });
      else if (type === 'ardent') {
        this.burst(L.smoke, x, y + 1, z, 18, { speed: 2.5, grav: -1.5, life: 1.2, size: 0.3 });
        this.burst(L.flame, x, y + 1, z, 16, { speed: 3, grav: -2, life: 0.7, size: 0.12, emissive: true });
      } else {
        this.burst(L.smoke, x, y + 1, z, 22, { speed: 2.5, grav: -1.5, life: 1.2, size: 0.3 });
        this.burst(L.ombre_face, x, y + 1, z, 10, { speed: 4, emissive: true });
      }
    }

    updateDrop(d, dt) {
      const g = this.game, w = g.world;
      if (!w.loaded(d.x, d.z)) return; // figé tant que son tronçon n'est pas chargé
      d.age += dt;
      d.pickDelay -= dt;
      if (d.age > (d.life || DROP_LIFE)) d.dead = true; // disparaît au bout de 5 minutes (20 pour les objets perdus à la mort)
      const cell = w.get(Math.floor(d.x), Math.floor(d.y + 0.1), Math.floor(d.z));
      const inWater = CM.isWater(cell);
      // un objet tombé dans le feu ou la lave brûle (sauf la netherite)
      if ((cell === B.FIRE || CM.isLava(cell)) && d.age > 0.5 && !CM.itemInfo(d.id).fireproof) {
        d.dead = true;
        this.burst(CM.Textures.layer.smoke, d.x, d.y + 0.2, d.z, 4, { speed: 0.6, grav: -2, life: 0.8, size: 0.15 });
        return;
      }
      if (inWater) {
        d.vy += (2 - d.vy) * Math.min(1, dt * 3);
        // le courant emporte les objets (pratique pour les ramasser en bout de champ)
        const fv = CM.flowVector(w, Math.floor(d.x), Math.floor(d.y + 0.1), Math.floor(d.z));
        if (fv) {
          d.vx += (fv[0] * 2.2 - d.vx) * Math.min(1, dt * 3);
          d.vz += (fv[1] * 2.2 - d.vz) * Math.min(1, dt * 3);
        }
      } else d.vy -= 18 * dt;
      // le joueur le plus proche l'attire (un invité seulement s'il a de la place)
      let p = null, dist = 3;
      for (const q of this.plist) {
        if (!q.alive || (q !== g.player && !q.canTake(d.id))) continue;
        const dd = Math.hypot(q.x - d.x, q.y + 0.8 - d.y, q.z - d.z);
        if (dd < dist) {
          dist = dd;
          p = q;
        }
      }
      if (p && d.pickDelay <= 0) {
        const dx = p.x - d.x, dy = p.y + 0.8 - d.y, dz = p.z - d.z;
        d.vx += (dx / dist) * 30 * dt;
        d.vy += (dy / dist) * 30 * dt + 18 * dt;
        d.vz += (dz / dist) * 30 * dt;
        if (dist < 1.0 && p !== g.player) {
          g.net.give(p, d);
          d.dead = true;
          this.addPickup(d, p);
        } else if (dist < 1.0) {
          const left = g.inventory.add(d.id, d.count, d.extra);
          if (left < d.count) {
            CM.Audio.play('pop');
            g.onPickup(d.id, d.count - left);
          }
          d.count = left;
          if (left <= 0) {
            d.dead = true;
            this.addPickup(d, p);
          }
          else d.pickDelay = 1;
        }
      }
      CM.Physics.move(w, d, d.vx * dt, d.vy * dt, d.vz * dt);
      if (d.hitY) d.vy = 0;
      if (d.onGround) {
        d.vx *= Math.max(0, 1 - dt * 8);
        d.vz *= Math.max(0, 1 - dt * 8);
      }
      if (d.y < CM.WORLD.MINY - 20) d.dead = true;
    }

    // ------------------------------------------------------ apparitions --
    spawnTick() {
      const g = this.game, w = g.world, r = this.rand;
      const pls = this.plist;
      // disparition : trop loin de tous les joueurs
      for (const m of this.mobs) {
        let dist = Infinity;
        for (const q of pls) dist = Math.min(dist, Math.hypot(m.x - q.x, m.z - q.z));
        if (MOBS[m.type].persist) continue; // (dragon, cristaux : ils restent)
        if (dist > (MOBS[m.type].passive || MOBS[m.type].boss ? 110 : 70)) {
          if (m.tame) this.stash(m);
          m.dead = true;
        }
      }
      // animaux d'élevage mis de côté : ils reviennent quand un joueur s'approche
      const pen = w.nether || w.end ? [] : g.animals || []; // (les animaux restent dans le monde normal)
      for (let i = pen.length - 1; i >= 0; i--) {
        const a = pen[i];
        if (!w.loaded(a[1], a[3]) || !pls.some((q) => Math.hypot(a[1] - q.x, a[3] - q.z) < 90)) continue;
        pen.splice(i, 1);
        if (!MOBS[a[0]]) continue;
        const m = this.addMob(a[0], a[1], a[2], a[3]);
        m.tame = true;
        if (a[4] > 0) this.setBaby(m, a[4]);
        this.restoreTame(m, a[5]);
      }
      const nightfall = this.nightfall;
      this.nightfall = false;
      const alive = pls.filter((q) => q.alive);
      // (règle « apparition des créatures » : /regle apparition_creatures off)
      if (CM.gameRule && !CM.gameRule(g, 'mobSpawn')) return;
      for (const p of alive.length ? alive : pls.includes(g.player) ? [g.player] : []) this.spawnAround(p, w, r, nightfall);
    }

    // Apparitions autour d'un joueur (chaque joueur a son propre voisinage).
    spawnAround(p, w, r, nightfall) {
      const g = this.game;
      if (w.nether) return this.spawnNether(p, w, r);
      if (w.end) return this.spawnEnd ? this.spawnEnd(p, w, r) : undefined;
      const { H } = CM.WORLD;
      let nMouf = 0, nOmbre = 0;
      for (const m of this.mobs) {
        if (m.dead) continue;
        const dist = Math.hypot(m.x - p.x, m.z - p.z);
        if (m.type === 'villager' || m.type === 'golem' || m.tame || MOBS[m.type].ambient) continue;
        if (MOBS[m.type].passive) {
          if (dist <= 110) nMouf++;
        } else if (dist <= 70) nOmbre++;
      }
      // golems : un par village assez grand, et ceux construits par les joueurs
      const homes = [];
      if (vilG(w, p)) {
        const v = vilG(w, p);
        if (v.pop >= 4) homes.push([v.x, v.z, v.spots[0]]);
      }
      for (const h of g.golemHomes || []) if (Math.hypot(h[0] - p.x, h[2] - p.z) < 64) homes.push([h[0], h[2], [h[0], h[1], h[2]]]);
      for (const [hx, hz, spot] of homes) {
        if (r() > 0.3 || this.mobs.some((m) => m.type === 'golem' && !m.dead && m.home && m.home[0] === hx && m.home[1] === hz)) continue;
        const [sx, sy, sz] = spot;
        const built = (g.golemHomes || []).some((h) => h[0] === hx && h[2] === hz);
        if (!w.loaded(sx, sz) || w.solidAt(sx, sy, sz) || w.solidAt(sx, sy + 1, sz) || w.solidAt(sx, sy + 2, sz) || Math.hypot(sx - p.x, sz - p.z) < (built ? 1.5 : 5)) continue;
        const gm = this.addMob('golem', sx + 0.5, sy, sz + 0.5);
        gm.home = [hx, hz];
        gm.built = built;
      }
      // villageois : les habitants du village le plus proche
      const vil = vilG(w, p);
      if (vil && r() < 0.5) {
        let n = 0;
        for (const m of this.mobs) if (m.type === 'villager' && !m.dead && m.home && m.home[0] === vil.x && m.home[1] === vil.z) n++;
        // (pas pendant un raid sur ce village)
        if (n < vil.pop && !(CM.Raids && CM.Raids.busy(g, vil))) {
          const [sx, sy, sz] = vil.spots[Math.floor(r() * vil.spots.length)];
          if (w.loaded(sx, sz) && !w.solidAt(sx, sy, sz) && !w.solidAt(sx, sy + 1, sz) && w.solidAt(sx, sy - 1, sz) && Math.hypot(sx - p.x, sz - p.z) > 6) {
            const m = this.addMob('villager', sx + 0.5, sy, sz + 0.5);
            m.home = [vil.x, vil.z];
            // habitant n° i du village : il garde son métier et son expérience (sauvegardée)
            const used = new Set(this.mobs.filter((o) => o !== m && o.type === 'villager' && !o.dead && o.home && o.home[0] === vil.x && o.home[1] === vil.z).map((o) => o.vidx));
            let i = 0;
            while (used.has(i)) i++;
            m.vidx = i;
            m.vid = vil.x + ',' + vil.z + ',' + i;
            m.profIdx = Math.floor(CM.hash3(vil.x, i, vil.z, 5) * PROFS.length);
            m.vxp = (g.vilXp && g.vilXp[m.vid]) || 0;
            m.vlv = CM.villagerLevel(m.vxp);
          }
        }
      }
      if (nMouf < 9 && r() < 0.3) {
        for (let t = 0; t < 4; t++) {
          const a = r() * Math.PI * 2, dd = 24 + r() * 30;
          const x = Math.floor(p.x + Math.cos(a) * dd), z = Math.floor(p.z + Math.sin(a) * dd);
          if (!w.loaded(x, z)) continue;
          const y = w.groundBelow(x, H - 1, z);
          const type = this.animalFor(w.column(x, z).bi);
          const under = CM.blocks[w.get(x, y, z)];
          if (type && y > 0 && (under.soil || (type === 'rabbit' && under.sound === 'sand') || (type === 'goat' && /STONE|SNOW/.test(under.key))) && w.skyAt(x, y + 1, z) >= 14) {
            this.addMob(type, x + 0.5, y + 1, z + 0.5);
            // certains vivent en groupe (poules, loups…)
            const gr = MOBS[type].group;
            if (gr) {
              const n = gr[0] - 1 + Math.floor(r() * (gr[1] - gr[0] + 1));
              for (let k = 0; k < n; k++) {
                const X = x + Math.floor((r() - 0.5) * 5), Z = z + Math.floor((r() - 0.5) * 5);
                if (!w.loaded(X, Z)) continue;
                const Y = w.groundBelow(X, H - 1, Z);
                if (Y > 0 && Math.abs(Y - y) < 3 && !w.solidAt(X, Y + 1, Z)) this.addMob(type, X + 0.5, Y + 1, Z + 0.5);
              }
            }
            break;
          }
        }
      }
      // chauves-souris dans les grottes sombres
      this.spawnBats(p, w, r);
      // poissons, calmars et dauphins dans les rivières, lacs et océans
      this.spawnWater(p, w, r);
      // la sorcière de la cabane des marais
      if (CM.Structures && r() < 0.2) CM.Structures.spawnWitch(g, p);
      // Ombres : plus nombreuses selon la difficulté et les jours passés.
      if (g.difficulty === 'peaceful' || g.mode === 'creative') return;
      const dif = { easy: 0.6, normal: 1, hard: 1.5 }[g.difficulty] || 1;
      const night = g.daylight < 0.45;
      const maxO = Math.round(Math.min(16, (night ? 6 : 3) + g.dayCount * 0.7) * dif);
      // tombée de la nuit : une première vague apparaît d'un coup
      let tries = nOmbre < maxO && p.alive && r() < 0.8 ? 1 : 0;
      if (nightfall) tries = Math.max(0, Math.min(maxO - nOmbre, 3 + Math.round(dif)));
      for (let n = 0; n < tries; n++) this.spawnOmbre(p, w, r);
    }
    spawnWater(p, w, r) {
      if (r() > 0.35) return;
      const BIO = CM.BIO;
      let fish = 0, squid = 0, dol = 0, drowned = 0;
      for (const m of this.mobs) {
        if (m.dead || !MOBS[m.type].water || Math.hypot(m.x - p.x, m.z - p.z) > 64) continue;
        if (m.type === 'drowned') drowned++;
        else if (m.type === 'squid') squid++;
        else if (m.type === 'dolphin') dol++;
        else fish++;
      }
      for (let t = 0; t < 4; t++) {
        const a = r() * Math.PI * 2, dd = 14 + r() * 34;
        const x = Math.floor(p.x + Math.cos(a) * dd), z = Math.floor(p.z + Math.sin(a) * dd);
        if (!w.loaded(x, z)) continue;
        const gy = w.groundBelow(x, CM.WORLD.H - 1, z);
        let top = gy + 1;
        while (top < CM.WORLD.H - 1 && CM.isWater(w.get(x, top, z))) top++;
        const depth = top - gy - 1;
        if (depth < 2) continue;
        const bi = w.column(x, z).bi, ocean = bi === BIO.OCEAN || bi === BIO.WARM_OCEAN, warm = bi === BIO.WARM_OCEAN;
        let type;
        const k = r(), g = this.game;
        // Noyés : la nuit (ou dans les eaux sombres), s'il y a des monstres
        const dark = g.daylight < 0.45 || w.skyAt(x, gy + 1, z) < 8;
        if (dark && drowned < 3 && k < 0.2 && g.difficulty !== 'peaceful' && g.mode !== 'creative') {
          this.addMob('drowned', x + 0.5, gy + 1, z + 0.5);
          return;
        }
        if (ocean && depth >= 5 && dol < 4 && k < 0.12) type = 'dolphin';
        else if (depth >= 4 && squid < 3 && k < 0.3) type = 'squid';
        else if (fish < 10) type = warm ? (k < 0.7 ? 'tropical_fish' : k < 0.85 ? 'pufferfish' : 'cod') : ocean ? (k < 0.65 ? 'cod' : k < 0.9 ? 'salmon' : 'pufferfish') : k < 0.6 ? 'salmon' : 'cod';
        if (!type) continue;
        const y = gy + 1 + Math.floor(r() * Math.max(1, depth - 1));
        const gr = MOBS[type].group, n = gr ? gr[0] + Math.floor(r() * (gr[1] - gr[0] + 1)) : 1;
        for (let i = 0; i < n; i++) {
          const X = x + (r() - 0.5) * 3, Z = z + (r() - 0.5) * 3;
          if (CM.isWater(w.get(Math.floor(X), y, Math.floor(Z)))) this.addMob(type, X, y + 0.1, Z);
        }
        return;
      }
    }
    // Canne à pêche : la créature accrochée est tirée vers le pêcheur.
    pullMob(m, v) {
      if (!m || m.dead || !Array.isArray(v)) return;
      const c = (n, a) => Math.max(-a, Math.min(a, Number(n) || 0));
      m.vx = c(v[0], 12);
      m.vy = c(v[1], 9);
      m.vz = c(v[2], 12);
      m.knock = 0.5;
    }
    spawnBats(p, w, r) {
      if (r() > 0.25) return;
      let n = 0;
      for (const m of this.mobs) if (!m.dead && m.type === 'bat' && Math.hypot(m.x - p.x, m.z - p.z) < 40) n++;
      if (n >= 4) return;
      for (let t = 0; t < 6; t++) {
        const x = Math.floor(p.x + (r() - 0.5) * 40), z = Math.floor(p.z + (r() - 0.5) * 40), y = Math.floor(p.y + (r() - 0.5) * 16);
        if (!w.loaded(x, z) || y < CM.WORLD.MINY + 2) continue;
        if (w.solidAt(x, y, z) || w.solidAt(x, y + 1, z) || CM.isFluid(w.get(x, y, z))) continue;
        if (w.skyAt(x, y, z) > 2 || w.blockLightAt(x, y, z) > 5) continue;
        this.addMob('bat', x + 0.5, y, z + 0.5);
        return;
      }
    }
    // Villageois la nuit : il va jusqu'au seuil de sa maison, puis se couche dans son lit ; au matin,
    // il ressort par sa porte. Frappé (ou son lit cassé), il se réveille. Vrai s'il dort.
    villagerNight(m, dt) {
      const g = this.game, w = g.world, BED = CM.B.BED;
      const night = g.daylight < 0.35, morning = g.daylight > 0.45;
      const h0 = m.zzz;
      if (h0) {
        if (morning || m.hurt > 0 || m.ai.flee > 0 || w.get(h0.bed[0], h0.bed[1], h0.bed[2]) !== BED) {
          m.zzz = null;
          m.goTo = null;
          if (morning && !(m.hurt > 0)) {
            m.x = h0.door[0] + 0.5;
            m.y = h0.door[1];
            m.z = h0.door[2] + 0.5;
          } else m.y = h0.bed[1] + 0.6; // (debout sur son lit)
          m.vx = m.vy = m.vz = 0;
          return false;
        }
        m.x = h0.bed[0] + 0.5;
        m.y = h0.bed[1] + 9 / 16;
        m.z = h0.bed[2] + 0.5;
        m.yaw = h0.yaw;
        m.vx = m.vy = m.vz = 0;
        m.moving = false;
        m.speedVis = 0;
        return true;
      }
      if (!night || !m.home || m.ai.flee > 0) {
        m.goTo = null;
        m.goT = 0;
        return false;
      }
      let h = m.homeBed;
      if (h && w.loaded(h.bed[0], h.bed[2]) && w.get(h.bed[0], h.bed[1], h.bed[2]) !== BED) h = m.homeBed = null;
      if (!h) h = m.homeBed = this.pickBed(m);
      if (!h) return false; // (pas de lit libre : il reste dehors)
      const dx = h.door[0] + 0.5 - m.x, dz = h.door[2] + 0.5 - m.z;
      m.goT = (m.goT || 0) + dt;
      // arrivé devant sa porte (ou coincé depuis longtemps) : il entre et se couche
      if ((Math.hypot(dx, dz) < 1.1 && Math.abs(h.door[1] - m.y) < 2) || m.goT > 45) {
        m.zzz = h;
        m.goTo = null;
        m.goT = 0;
        return true;
      }
      m.goTo = [h.door[0] + 0.5, h.door[2] + 0.5];
      return false;
    }
    // Lit libre le plus proche dans le village du villageois.
    pickBed(m) {
      const w = this.game.world, v = w.villageNear(m.home[0], m.home[1], 4);
      if (!v || !w.villageHomes) return null;
      const taken = new Set();
      for (const o of this.mobs) if (o !== m && o.type === 'villager' && !o.dead && o.homeBed) taken.add(o.homeBed.bed.join());
      let best = null, bd = Infinity;
      for (const h of w.villageHomes(v)) {
        if (taken.has(h.bed.join()) || !w.loaded(h.bed[0], h.bed[2]) || w.get(h.bed[0], h.bed[1], h.bed[2]) !== CM.B.BED) continue;
        const d = Math.hypot(h.door[0] - m.x, h.door[2] - m.z);
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      return best;
    }

    // Quel monstre apparaît ici (la nuit ou dans le noir) ?
    hostileFor(w, x, y, z) {
      const r = this.rand(), bi = w.column(x, z).bi;
      // gluants : dans les marais, et tout au fond (sous y = 0)
      if ((bi === CM.BIO.SWAMP || bi === CM.BIO.MANGROVE || y < 0) && r < 0.3) return 'slime';
      if (MOBS.witch && w.structures && r > 0.975) return 'witch'; // (rare) une sorcière rôde
      if (MOBS.arpenteur && r > 0.94 && r <= 0.975 && y > 0) return 'arpenteur'; // (rare) un Arpenteur, la nuit en surface
      // (plus de rampants : retirés du jeu)
      if (r < 0.46) return 'ombre';
      if (r < 0.7) return 'spider';
      return 'skeleton';
    }

    // Nether : des Ombres ardentes rôdent partout, de jour comme de nuit, même à la lumière.
    spawnNether(p, w, r) {
      const g = this.game;
      if (g.difficulty === 'peaceful' || g.mode === 'creative' || !p.alive) return;
      let n = 0;
      for (const m of this.mobs) if (!m.dead && MOBS[m.type].hostile && Math.hypot(m.x - p.x, m.z - p.z) < 70) n++;
      const dif = { easy: 0.6, normal: 1, hard: 1.5 }[g.difficulty] || 1;
      if (n >= Math.round(5 * dif) || r() > 0.5) return;
      for (let t = 0; t < 10; t++) {
        const a = r() * Math.PI * 2, dd = 14 + r() * 24;
        const x = Math.floor(p.x + Math.cos(a) * dd), z = Math.floor(p.z + Math.sin(a) * dd);
        if (!w.loaded(x, z)) continue;
        for (let k = 0; k < 12; k++) {
          const y = Math.floor(p.y) - 10 + Math.floor(r() * 20);
          if (!w.solidAt(x, y - 1, z) || w.solidAt(x, y, z) || w.solidAt(x, y + 1, z)) continue;
          if (CM.isFluid(w.get(x, y, z)) || CM.isFluid(w.get(x, y - 1, z)) || CM.isFluid(w.get(x, y + 1, z))) continue;
          const m = this.addMob(r() < 0.3 ? 'magma' : 'ardent', x + 0.5, y, z + 0.5);
          this.burst(CM.Textures.layer.smoke, m.x, m.y + 1, m.z, 10, { speed: 1.5, grav: -1, life: 1, size: 0.3 });
          return;
        }
      }
    }

    spawnOmbre(p, w, r) {
      const g = this.game;
      const { H } = CM.WORLD;
      for (let t = 0; t < 8; t++) {
        const a = r() * Math.PI * 2, dd = 16 + r() * 22;
        const x = Math.floor(p.x + Math.cos(a) * dd), z = Math.floor(p.z + Math.sin(a) * dd);
        if (!w.loaded(x, z)) continue;
        if (g.nearDawnHeart(x, z, 48)) continue;
        // d'abord en surface (la nuit), sinon dans les grottes proches du joueur
        const surf = w.groundBelow(x, H - 1, z) + 1;
        const cands = [];
        if (Math.abs(surf - p.y) < 24) cands.push(surf);
        for (let y = Math.min(H - 3, Math.floor(p.y) + 8); y > Math.max(CM.WORLD.MINY + 1, Math.floor(p.y) - 16); y--) cands.push(y);
        for (const y of cands) {
          if (!w.solidAt(x, y - 1, z) || w.solidAt(x, y, z) || w.solidAt(x, y + 1, z)) continue;
          if (CM.isFluid(w.get(x, y, z)) || CM.isFluid(w.get(x, y - 1, z))) continue;
          const bl = w.blockLightAt(x, y, z);
          // (en plein air : seulement quand la nuit est bien tombée, on a le temps de se coucher)
          const sky = w.skyAt(x, y, z) * (g.nightReady() ? 0.2 : 1);
          if (bl < 4 && sky < 4) {
            const type = this.hostileFor(w, x, y, z);
            if (MOBS[type].hw > 0.45 && (w.solidAt(x + 1, y, z) || w.solidAt(x - 1, y, z) || w.solidAt(x, y, z + 1) || w.solidAt(x, y, z - 1))) continue; // (trop large)
            const m = this.addMob(type, x + 0.5, y, z + 0.5);
            this.burst(CM.Textures.layer.smoke, m.x, m.y + 1, m.z, 10, { speed: 1.5, grav: -1, life: 1, size: 0.3 });
            return true;
          }
        }
      }
      return false;
    }

    // Animal typique d'un biome (null s'il n'y en a pas).
    animalFor(bi) {
      const BIO = CM.BIO, r = this.rand();
      const pick = (list) => {
        let t = 0;
        for (const [k, w] of list) if (r < (t += w)) return k;
        return list[list.length - 1][0];
      };
      switch (bi) {
        case BIO.SNOWY_TAIGA:
        case BIO.ICE_SPIKES:
        case BIO.TUNDRA: return pick([['penguin', 0.5], ['wolf', 0.2], ['rabbit', 0.15], ['goat', 0.15]]);
        case BIO.TAIGA: return pick([['boar', 0.3], ['wolf', 0.25], ['deer', 0.25], ['rabbit', 0.2]]);
        case BIO.FOREST:
        case BIO.BIRCH:
        case BIO.DARK_FOREST: return pick([['boar', 0.3], ['deer', 0.25], ['mouflon', 0.15], ['chicken', 0.15], ['rabbit', 0.1], ['wolf', 0.05]]);
        case BIO.JUNGLE:
        case BIO.BAMBOO:
        case BIO.MANGROVE:
        case BIO.SWAMP:
        case BIO.CRYSTAL: return pick([['boar', 0.5], ['chicken', 0.3], ['mouflon', 0.2]]);
        case BIO.PLAINS:
        case BIO.FLOWERS: return pick([['mouflon', 0.26], ['cow', 0.26], ['chicken', 0.2], ['rabbit', 0.13], ['horse', 0.15]]);
        case BIO.CHERRY: return pick([['mouflon', 0.4], ['rabbit', 0.3], ['deer', 0.3]]);
        case BIO.MUSHROOM: return pick([['cow', 0.7], ['mouflon', 0.3]]);
        case BIO.SAVANNA: return pick([['cow', 0.35], ['mouflon', 0.2], ['chicken', 0.2], ['horse', 0.25]]);
        case BIO.MOUNTAINS: return pick([['goat', 0.55], ['mouflon', 0.45]]);
        case BIO.DESERT:
        case BIO.BADLANDS: return r < 0.5 ? 'rabbit' : null;
        default: return null;
      }
    }

    flames(m) {
      const s = m.baby > 0 ? BABY_SCALE : 1;
      this.burst(CM.Textures.layer.flame, m.x + (this.rand() - 0.5) * m.hw * 2, m.y + this.rand() * m.h * s, m.z + (this.rand() - 0.5) * m.hw * 2, 1, { speed: 0.4, grav: -2.5, life: 0.5, size: 0.1, emissive: true });
    }
    // Une créature frappe un joueur (local ou invité) ; elle est transmise pour les Épines.
    hitPlayer(p, n, m, cause) {
      if (p === this.game.player) {
        const h0 = p.health;
        p.damage(n, m.x, m.z, cause, false, m);
        // l'Ombre ardente met le feu (seulement si le coup a porté)
        if (MOBS[m.type].ignites && p.health < h0) p.burning = Math.max(p.burning || 0, 4);
      } else p.damage(n, m.x, m.z, cause, false, 0, m);
    }

    // ------------------------------------------------------- élevage --
    hearts(m, n) {
      const s = m.baby > 0 ? BABY_SCALE : 1;
      this.burst(CM.Textures.layer.heart, m.x, m.y + m.h + 0.2 * s, m.z, n, { speed: 0.6, grav: -1.2, life: 1, size: 0.12, spread: 0.4, emissive: true, full: true });
    }
    setBaby(m, t) {
      const def = MOBS[m.type];
      m.baby = t;
      m.hw = def.hw * (t > 0 ? BABY_SCALE : 1);
      m.h = def.h * (t > 0 ? BABY_SCALE : 1);
    }
    // Nourrir un animal : amoureux (adulte) ou croissance accélérée (petit). Renvoie true si accepté.
    feedMob(m) {
      const foods = CM.BREED_FOOD[m.type];
      if (!foods || m.dead) return false;
      const def = MOBS[m.type];
      if (def.tameFirst && !m.tame) return false; // (loup, cheval : d'abord l'apprivoiser)
      // loup blessé : la viande le soigne
      if (def.healFood && m.hp < m.maxHp) {
        m.hp = Math.min(m.maxHp, m.hp + 4);
        this.hearts(m, 3);
        return true;
      }
      if (m.baby > 0) {
        m.baby = Math.max(0.01, m.baby - BABY_TIME * 0.1);
        this.hearts(m, 2);
      } else {
        if (m.love > 0 || m.loveCd > 0) return false;
        m.love = 30;
        this.hearts(m, 6);
      }
      m.tame = true;
      m.ai.flee = 0;
      if (this.game.net) this.game.net.fx({ k: 'love', x: m.x, y: m.y + m.h, z: m.z });
      return true;
    }
    findMate(m) {
      if (m.love <= 0 || m.baby > 0) return null;
      let best = null, bd = 8;
      for (const o of this.mobs) {
        if (o === m || o.type !== m.type || o.dead || o.love <= 0 || o.baby > 0) continue;
        const d = Math.hypot(o.x - m.x, o.z - m.z);
        if (d < bd && Math.abs(o.y - m.y) < 3) {
          bd = d;
          best = o;
        }
      }
      return best;
    }
    // Joueur proche qui tient la nourriture de cet animal.
    tempter(m) {
      const foods = CM.BREED_FOOD[m.type], g = this.game;
      for (const q of this.plist) {
        if (!q.alive || Math.hypot(q.x - m.x, q.z - m.z) > 8 || Math.abs(q.y - m.y) > 3) continue;
        const held = q === g.player ? g.inventory.held() && g.inventory.held().id : q.held;
        if (held && foods.includes(held)) return q;
      }
      return null;
    }
    breed(a, b) {
      a.love = b.love = 0;
      a.loveCd = b.loveCd = 60;
      const baby = this.addMob(a.type, (a.x + b.x) / 2, Math.max(a.y, b.y), (a.z + b.z) / 2);
      this.setBaby(baby, BABY_TIME);
      baby.tame = true;
      if (a.owner !== undefined) baby.owner = a.owner; // (petit d'animaux apprivoisés : même maître)
      if (MOBS[a.type].mount) baby.variant = this.rand() < 0.5 ? a.variant : b.variant;
      baby.yaw = a.yaw;
      this.hearts(baby, 8);
      const p = this.game.player, here = this.game.dim === this.game.playerDim;
      if (Math.hypot(p.x - a.x, p.z - a.z) < 20) CM.Audio.play(a.type === 'mouflon' ? 'baa' : 'grunt');
      this.game.stats.bred = (this.game.stats.bred || 0) + 1;
      if (here && Math.hypot(p.x - a.x, p.z - a.z) < 16) p.addXp(1 + Math.floor(this.rand() * 7));
      if (this.game.net) this.game.net.fx({ k: 'love', x: baby.x, y: baby.y + 0.8, z: baby.z, n: 8 });
    }
    // Animal d'élevage qui sort de la zone chargée : mis de côté (et sauvegardé).
    stash(m) {
      const g = this.game;
      if (!g.animals) g.animals = [];
      g.animals.push(this.tameEntry(m));
    }
    tameEntry(m) {
      const e = [m.type, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, Math.round(m.z * 10) / 10, Math.round(m.baby)];
      // animal apprivoisé : maître, assis, selle, robe, dressage
      if (m.owner !== undefined || m.variant !== undefined || m.temper) e.push({ o: m.owner, s: m.sit ? 1 : 0, sa: m.saddle ? 1 : 0, v: m.variant, t: m.temper || 0, hp: Math.round(m.hp) });
      return e;
    }
    // Pour la sauvegarde : animaux présents + mis de côté.
    tameList() {
      const out = (this.game.animals || []).slice();
      for (const m of this.mobs) if (m.tame && !m.dead) out.push(this.tameEntry(m));
      return out;
    }
    restoreTame(m, x) {
      if (!x || typeof x !== 'object') return;
      if (typeof x.o === 'string') m.owner = x.o.slice(0, 32);
      m.sit = !!x.s;
      m.saddle = !!x.sa;
      if (Number.isFinite(x.v)) m.variant = x.v | 0;
      m.temper = +x.t || 0;
      if (m.owner !== undefined && m.type === 'wolf') m.maxHp = 20;
      if (Number.isFinite(x.hp) && x.hp > 0) m.hp = Math.min(m.maxHp, x.hp);
    }

    // Rayon vers les créatures (pour attaquer).
    raycastMob(ox, oy, oz, dx, dy, dz, maxD) {
      let best = null, bestT = maxD;
      const mount = this.game.player && this.game.player.mount;
      for (const m of this.mobs) {
        if (m.uid === mount || m.dead) continue;
        const hw = m.hw * (MOBS[m.type].pick || 1);
        const t = CM.rayBox(ox, oy, oz, dx, dy, dz, m.x - hw, m.y, m.z - hw, m.x + hw, m.y + m.h, m.z + hw);
        if (t >= 0 && t < bestT) {
          bestT = t;
          best = m;
        }
      }
      return best ? { mob: best, t: bestT } : null;
    }

    // ------------------------------------------------------------ rendu --
    lightAt(x, y, z) {
      const w = this.game.world;
      const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
      return [w.skyAt(fx, fy, fz) / 15, w.blockLightAt(fx, fy, fz) / 15];
    }

    part(batch, base, px, py, pz, rx, box, layers, l, flags, faceFlags, ry, rz) {
      mat4.compose(this.P, px, py, pz, ry || 0, rx, rz || 0, 1);
      mat4.multiply(this.R, base, this.P);
      batch.box(this.R, box[0], box[1], box[2], box[3], box[4], box[5], layers, l[0], l[1], flags, null, faceFlags);
    }

    // Une créature. roll : chute sur le côté (morte). Pour toutes : rotation lissée, pas qui
    // démarrent et s'arrêtent en douceur, léger rebond en marchant, recul quand elle est touchée.
    drawMob(batch, m, time, dt, roll) {
      const L = CM.Textures.layer;
      const def = MOBS[m.type];
      const l = this.lightAt(m.x, m.y + 0.6, m.z);
      const flags = m.hurt > 0 || roll ? 2 : 0;
      if (m.ryaw === undefined) m.ryaw = m.yaw;
      let dy = m.yaw - m.ryaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      m.ryaw += Math.abs(dy) > 2.5 ? dy : dy * Math.min(1, dt * 10);
      m.wamp = (m.wamp || 0) + ((m.moving && !roll ? 1 : 0) - (m.wamp || 0)) * Math.min(1, dt * 7);
      const ground = !def.fly && !def.water && !def.swim;
      const bounce = ground ? Math.abs(Math.sin(m.walk)) * 0.035 * m.wamp : 0;
      const knock = m.hurt > 0 && !roll ? Math.sin((m.hurt / 0.35) * Math.PI) * 0.18 : 0;
      // (villageois endormi : couché sur le dos, la tête sur son lit)
      if (m.zzz && !roll) mat4.compose(this.M, m.x - Math.sin(m.ryaw) * 1.7, m.y + 0.2, m.z - Math.cos(m.ryaw) * 1.7, m.ryaw, Math.PI / 2, 0, 1);
      else mat4.compose(this.M, m.x, m.y + bounce, m.z, m.ryaw, -knock, roll || 0, m.baby > 0 ? BABY_SCALE : 1);
      const sw = m.zzz ? 0 : Math.sin(m.walk) * m.wamp;
      // animaux et villageois : la tête se tourne vers le joueur proche
      if (LOOKERS.has(m.type)) {
        const p = this.game.player, dx = p.x - m.x, dz = p.z - m.z;
        let want = 0;
        if (!roll && !m.zzz && p.alive && dx * dx + dz * dz < 49) {
          const a = Math.atan2(-dx, -dz) - m.ryaw;
          want = CM.clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1.1, 1.1);
        }
        m.look = (m.look || 0) + (want - (m.look || 0)) * Math.min(1, dt * 5);
      }
      {
      if (def.render) {
        def.render(this, batch, m, l, flags, sw, time);
      } else if (m.type === 'mouflon') {
        const wool = L.mouflon_wool, skin = L.mouflon_skin;
        this.part(batch, this.M, 0, 0, 0, 0, [-0.33, 0.42, -0.5, 0.33, 1.02, 0.5], wool, l, flags);
        const hb = Math.sin(time * 2 + m.age) * 0.05;
        this.part(batch, this.M, 0, 0.92, -0.48, hb, [-0.2, -0.12, -0.38, 0.2, 0.28, 0.02], [skin, skin, wool, skin, skin, L.mouflon_face], l, flags, null, m.look || 0);
        this.part(batch, this.M, 0, 0.92, -0.48, hb, [-0.32, 0.08, -0.26, -0.2, 0.24, -0.06], L.mouflon_horn, l, flags, null, m.look || 0);
        this.part(batch, this.M, 0, 0.92, -0.48, hb, [0.2, 0.08, -0.26, 0.32, 0.24, -0.06], L.mouflon_horn, l, flags, null, m.look || 0);
        const legs = [[-0.2, -0.32, 1], [0.2, -0.32, -1], [-0.2, 0.32, -1], [0.2, 0.32, 1]];
        for (const [lx, lz, ph] of legs) this.part(batch, this.M, lx, 0.45, lz, sw * 0.7 * ph, [-0.09, -0.45, -0.09, 0.09, 0, 0.09], skin, l, flags);
      } else if (m.type === 'boar') {
        const hide = L.boar_hide;
        this.part(batch, this.M, 0, 0, 0, 0, [-0.38, 0.35, -0.55, 0.38, 0.92, 0.55], hide, l, flags);
        const hb = Math.sin(time * 3 + m.age) * 0.04;
        this.part(batch, this.M, 0, 0.7, -0.55, hb, [-0.26, -0.22, -0.36, 0.26, 0.24, 0.02], [hide, hide, hide, hide, hide, L.boar_face], l, flags, null, m.look || 0);
        this.part(batch, this.M, 0, 0.7, -0.55, hb, [-0.22, -0.2, -0.44, -0.14, -0.04, -0.34], L.boar_tusk, l, flags, null, m.look || 0);
        this.part(batch, this.M, 0, 0.7, -0.55, hb, [0.14, -0.2, -0.44, 0.22, -0.04, -0.34], L.boar_tusk, l, flags, null, m.look || 0);
        const legs = [[-0.22, -0.36, 1], [0.22, -0.36, -1], [-0.22, 0.36, -1], [0.22, 0.36, 1]];
        for (const [lx, lz, ph] of legs) this.part(batch, this.M, lx, 0.36, lz, sw * 0.8 * ph, [-0.1, -0.36, -0.1, 0.1, 0, 0.1], hide, l, flags);
      } else if (m.type === 'penguin') {
        const bodyT = L.penguin_body, waddle = m.moving ? Math.sin(m.walk * 1.5) * 0.12 : 0;
        this.part(batch, this.M, 0, 0, 0, 0, [-0.24, 0.12, -0.2, 0.24, 0.72, 0.2], [bodyT, bodyT, bodyT, bodyT, bodyT, L.penguin_belly], l, flags, null, 0, waddle);
        this.part(batch, this.M, 0, 0.72, 0, 0, [-0.19, 0, -0.18, 0.19, 0.32, 0.18], [bodyT, bodyT, bodyT, bodyT, bodyT, L.penguin_face], l, flags, null, 0, waddle);
        this.part(batch, this.M, 0, 0.72, 0, 0, [-0.06, 0.1, -0.32, 0.06, 0.18, -0.18], L.penguin_beak, l, flags, null, 0, waddle);
        const flap = m.moving ? Math.sin(m.walk * 3) * 0.3 : 0.1;
        this.part(batch, this.M, -0.25, 0.66, 0, 0, [-0.05, -0.42, -0.12, 0, 0, 0.12], bodyT, l, flags, null, 0, -flap - 0.15);
        this.part(batch, this.M, 0.25, 0.66, 0, 0, [0, -0.42, -0.12, 0.05, 0, 0.12], bodyT, l, flags, null, 0, flap + 0.15);
        this.part(batch, this.M, -0.1, 0.12, -0.04, sw * 0.5, [-0.08, -0.12, -0.14, 0.08, 0, 0.06], L.penguin_beak, l, flags);
        this.part(batch, this.M, 0.1, 0.12, -0.04, -sw * 0.5, [-0.08, -0.12, -0.14, 0.08, 0, 0.06], L.penguin_beak, l, flags);
      } else if (m.type === 'golem') {
        const G = L.golem_body;
        const leg = [-0.2, -0.95, -0.2, 0.2, 0, 0.2];
        this.part(batch, this.M, -0.26, 0.95, 0, sw * 0.5, leg, G, l, flags);
        this.part(batch, this.M, 0.26, 0.95, 0, -sw * 0.5, leg, G, l, flags);
        this.part(batch, this.M, 0, 0, 0, 0, [-0.45, 0.95, -0.28, 0.45, 1.55, 0.28], G, l, flags);
        this.part(batch, this.M, 0, 0, 0, 0, [-0.62, 1.55, -0.34, 0.62, 2.2, 0.34], G, l, flags);
        // bras : balancement, levés quand il charge, frappe vers le haut
        const hit = (m.ai.swing || 0) > 0 ? Math.sin(((0.5 - m.ai.swing) / 0.5) * Math.PI) * 1.8 : 0;
        const armA = hit || (m.ai.chasing ? 0.35 : sw * 0.45);
        const arm = [-0.17, -1.55, -0.17, 0.17, 0.05, 0.17];
        this.part(batch, this.M, -0.8, 2.12, 0, hit ? armA : armA, arm, G, l, flags);
        this.part(batch, this.M, 0.8, 2.12, 0, hit ? armA : -armA, arm, G, l, flags);
        this.part(batch, this.M, 0, 2.18, -0.12, 0, [-0.24, 0, -0.26, 0.24, 0.48, 0.22], [G, G, G, G, G, L.golem_face], l, flags);
        this.part(batch, this.M, 0, 2.18, -0.12, 0, [-0.05, 0.04, -0.38, 0.05, 0.26, -0.26], G, l, flags);
      } else if (m.type === 'villager') {
        if (!m.prof) m.prof = CM.villagerProf(m);
        const robe = L[m.prof.robe] || L.wool;
        const skin = L.skin;
        this.part(batch, this.M, -0.12, 0.62, 0, sw * 0.5, [-0.11, -0.62, -0.11, 0.11, 0, 0.11], robe, l, flags);
        this.part(batch, this.M, 0.12, 0.62, 0, -sw * 0.5, [-0.11, -0.62, -0.11, 0.11, 0, 0.11], robe, l, flags);
        this.part(batch, this.M, 0, 0, 0, 0, [-0.27, 0.35, -0.17, 0.27, 1.45, 0.17], robe, l, flags);
        // bras croisés
        this.part(batch, this.M, 0, 1.12, -0.2, 0, [-0.3, -0.12, -0.1, 0.3, 0.1, 0.1], robe, l, flags);
        this.part(batch, this.M, 0, 1.12, -0.2, 0, [-0.14, -0.1, -0.12, 0.14, 0.08, 0.08], skin, l, flags);
        const nod = Math.sin(time * 1.3 + m.age) * 0.08;
        const vh = L.villager_head;
        this.part(batch, this.M, 0, 1.45, 0, nod, [-0.23, 0, -0.23, 0.23, 0.56, 0.23], [vh, vh, vh, skin, vh, L.villager_face], l, flags, null, m.look || 0);
        this.part(batch, this.M, 0, 1.45, 0, nod, [-0.05, 0.08, -0.34, 0.05, 0.3, -0.23], skin, l, flags, null, m.look || 0);
        // insigne de niveau sur la robe : pierre, fer, or, émeraude, diamant
        const bk = ['STONE', 'IRON_BLOCK', 'GOLD_BLOCK', 'EMERALD_BLOCK', 'DIAMOND_BLOCK'][(m.vlv || 1) - 1];
        const bl = CM.B[bk] !== undefined && CM.blockLayers[CM.B[bk]];
        if (bl) this.part(batch, this.M, 0, 0.95, -0.17, 0, [-0.07, -0.07, -0.02, 0.07, 0.07, 0], bl[0], l, flags);
      } else {
        const body = m.type === 'ardent' ? L.ardent_body : L.ombre_body;
        this.part(batch, this.M, 0, 0, 0, 0, [-0.25, 0.8, -0.13, 0.25, 1.52, 0.13], body, l, flags);
        this.part(batch, this.M, -0.12, 0.8, 0, sw * 0.6, [-0.1, -0.8, -0.1, 0.1, 0, 0.1], body, l, flags);
        this.part(batch, this.M, 0.12, 0.8, 0, -sw * 0.6, [-0.1, -0.8, -0.1, 0.1, 0, 0.1], body, l, flags);
        const armA = m.ai.chasing ? -1.35 + Math.sin(time * 6 + m.age) * 0.1 : sw * 0.5;
        this.part(batch, this.M, -0.34, 1.48, 0, armA, [-0.08, -0.74, -0.08, 0.08, 0.04, 0.08], body, l, flags);
        this.part(batch, this.M, 0.34, 1.48, 0, m.ai.chasing ? armA : -armA, [-0.08, -0.74, -0.08, 0.08, 0.04, 0.08], body, l, flags);
        const ff = [flags, flags, flags, flags, flags, flags ? 2 : 1];
        this.part(batch, this.M, 0, 1.52, 0, 0, [-0.22, 0, -0.22, 0.22, 0.44, 0.22], [body, body, body, body, body, m.type === 'ardent' ? L.ardent_face : L.ombre_face], l, flags, ff);
      }
      }
    }

    render(batch, cam, time) {
      const L = CM.Textures.layer;
      const cull = cam.cull; // (extension Optimisation : créatures derrière nous ou cachées par le terrain)
      const dt = Math.min(0.1, Math.max(0, time - (this.renderT === undefined ? time : this.renderT)));
      this.renderT = time;
      for (const m of this.mobs) {
        if (m.corpse) continue; // (déjà dessinée en train de tomber)
        if (cull && !cull(m.x, m.y + 0.5, m.z, 3)) continue;
        this.drawMob(batch, m, time, dt, 0);
      }
      // créatures tuées : elles tombent sur le côté, rouges, puis disparaissent dans un nuage
      for (const c of this.corpses) {
        c.t += dt;
        if (c.t >= 0.95) {
          if (!c.done) {
            c.done = true;
            const h = (MOBS[c.m.type] && MOBS[c.m.type].h) || 1;
            this.burst(L.smoke, c.m.x, c.m.y + h * 0.4, c.m.z, 8, { speed: 1.2, grav: -1.5, life: 0.7, size: 0.18, spread: Math.min(1.6, h) });
            this.burst(L.white, c.m.x, c.m.y + h * 0.4, c.m.z, 6, { speed: 1.5, grav: -0.5, life: 0.5, size: 0.06, spread: Math.min(1.6, h) });
          }
          continue;
        }
        if (cull && !cull(c.m.x, c.m.y + 0.5, c.m.z, 3)) continue;
        const k = Math.min(1, c.t / 0.5);
        this.drawMob(batch, c.m, time, dt, k * k * (Math.PI / 2));
      }
      if (this.corpses.length && this.corpses.every((c) => c.done)) this.corpses.length = 0;
      for (const t of this.tnts) {
        const l = this.lightAt(t.x, t.y + 0.5, t.z);
        const flash = (t.fuse * 4) % 1 < 0.5 ? 1 : 0;
        const sc = 1 + Math.max(0, 0.4 - t.fuse) * 0.3;
        mat4.compose(this.M, t.x, t.y, t.z, 0, 0, 0, sc);
        batch.box(this.M, -0.5, 0, -0.5, 0.5, 1, 0.5, CM.blockLayers[B.TNT], flash ? 1 : l[0], flash ? 1 : l[1], flash);
      }
      this.renderExtra(batch);
      for (const d of this.drops) {
        if (!this.game.world.loaded(d.x, d.z) || (cull && !cull(d.x, d.y, d.z, 1))) continue;
        // les 10 dernières secondes, il clignote avant de disparaître
        const age = d.age - ((d.life || DROP_LIFE) - DROP_LIFE);
        if (age > DROP_LIFE - 10 && Math.floor(age * (age > DROP_LIFE - 3 ? 8 : 4)) % 2) continue;
        const l = this.lightAt(d.x, d.y + 0.2, d.z);
        const bob = Math.sin(d.age * 3 + d.spin) * 0.06 + 0.1;
        mat4.compose(this.M, d.x, d.y + bob, d.z, d.age * 1.6 + d.spin, 0, 0, 1);
        this.drawItem(batch, this.M, d.id, l, 0.25);
        if (d.count > 1) {
          mat4.compose(this.P, 0.08, 0.06, 0.06, 0.3, 0, 0, 1);
          mat4.multiply(this.R, this.M, this.P);
          this.drawItem(batch, this.R, d.id, l, 0.25);
        }
      }
      // objets ramassés : ils filent vers le joueur en rapetissant (0,15 s)
      for (const k of this.pickups) {
        k.t += dt;
        const q = k.q, f = Math.min(1, k.t / 0.15), e = f * f;
        const qx = q.rx !== undefined ? q.rx : q.x, qy = (q.ry !== undefined ? q.ry : q.y) + (q === this.game.player ? 0.6 : 0.9), qz = q.rz !== undefined ? q.rz : q.z;
        const l = this.lightAt(k.x, k.y + 0.2, k.z);
        mat4.compose(this.M, k.x + (qx - k.x) * e, k.y + (qy - k.y) * e, k.z + (qz - k.z) * e, k.t * 6, 0, 0, 1 - 0.6 * e);
        this.drawItem(batch, this.M, k.id, l, 0.25);
      }
      this.pickups = this.pickups.filter((k) => k.t < 0.15);
      // particules (panneaux face caméra)
      const rx = cam.right, uy = cam.up;
      for (const p of this.particles) {
        const l = p.flags ? [1, 1] : this.lightAt(p.x, p.y, p.z);
        const s = p.size;
        const q = [
          [p.x - rx[0] * s - uy[0] * s, p.y - rx[1] * s - uy[1] * s, p.z - rx[2] * s - uy[2] * s],
          [p.x + rx[0] * s - uy[0] * s, p.y + rx[1] * s - uy[1] * s, p.z + rx[2] * s - uy[2] * s],
          [p.x + rx[0] * s + uy[0] * s, p.y + rx[1] * s + uy[1] * s, p.z + rx[2] * s + uy[2] * s],
          [p.x - rx[0] * s + uy[0] * s, p.y - rx[1] * s + uy[1] * s, p.z - rx[2] * s + uy[2] * s],
        ];
        const u0 = p.full ? 0 : p.u0, v0 = p.full ? 0 : p.v0, du = p.full ? 1 : 0.25;
        batch.quad(q, [[u0, v0 + du], [u0 + du, v0 + du], [u0 + du, v0], [u0, v0]], p.layer, l[0], l[1], 1, p.flags);
      }
    }

    // Dessine un objet (cube pour un bloc, plaque pour un objet) centré en bas.
    drawItem(batch, m, id, l, size) {
      const h = size / 2;
      if (CM.isBlockId(id)) {
        const b = CM.blocks[id];
        if (b.stair) {
          // escalier : moitié basse et marche
          batch.box(m, -h, 0, -h, h, h, h, CM.blockLayers[id], l[0], l[1], 0);
          batch.box(m, -h, h, -h, 0, size, h, CM.blockLayers[id], l[0], l[1], 0);
          return;
        }
        if (b.render === 'cube' || b.render === 'glass' || b.render === 'tglass' || b.render === 'slab' || b.render === 'carpet') {
          batch.box(m, -h, 0, -h, h, size, h, CM.blockLayers[id], l[0], l[1], b.light ? 1 : 0);
          return;
        }
        const layer = CM.blockLayers[id][0];
        batch.box(m, -h * 1.4, 0, 0, h * 1.4, size * 1.4, 0, [-1, -1, -1, -1, layer, -1], l[0], l[1], b.light ? 1 : 0);
        return;
      }
      const layer = CM.Textures.layer[CM.items[id].tex];
      batch.box(m, -h * 1.4, 0, 0, h * 1.4, size * 1.4, 0, [-1, -1, -1, -1, layer, -1], l[0], l[1], 0);
    }
  }

  CM.Entities = Entities;
})();
