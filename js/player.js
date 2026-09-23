'use strict';
// Joueur : déplacements, endurance, ruée, double saut, grappin, minage, combat.
(function () {
  const B = CM.B;
  const I = CM.I;
  const mat4 = CM.mat4;

  const GRAVITY = 28;
  const REACH = 5;
  const GRAPPLE_RANGE = 34;

  class Player {
    constructor(game) {
      this.game = game;
      this.hw = 0.3;
      this.h = 1.8;
      this.eyeH = 1.62;
      this.M = mat4.create();
      this.P = mat4.create();
      this.R = mat4.create();
      this.reset(game.world.spawn);
    }

    reset(sp) {
      this.x = sp.x; this.y = sp.y; this.z = sp.z;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.yaw = 0; this.pitch = 0;
      this.onGround = false;
      this.health = 20;
      this.stamina = 100;
      this.exhausted = false;
      this.alive = true;
      this.invul = 1;
      this.hurtFlash = 0;
      this.staminaDelay = 0;
      this.vigor = 0;
      this.regen = 0;
      this.fallStart = this.y;
      this.dashCd = 0; this.dashTime = 0;
      this.usedDouble = false;
      this.jumpCd = 0;
      this.hook = null;
      this.mining = null;
      this.combo = 0; this.comboTimer = 0; this.lastBreak = -10;
      this.attackCd = 0; this.useCd = 0;
      this.swing = 0;
      this.bob = 0; this.bobAmp = 0;
      this.stepDist = 0;
      this.inWater = false; this.headInWater = false;
      this.target = null;
      this.sprinting = false;
    }

    get maxStamina() {
      return 100 + (this.game.inventory.has(I.STAMINA_CHARM) ? 50 : 0);
    }
    eye() {
      return [this.x, this.y + this.eyeH, this.z];
    }
    look() {
      const cp = Math.cos(this.pitch);
      return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
    }
    spend(n) {
      this.stamina = Math.max(0, this.stamina - n);
      this.staminaDelay = 0.9;
      if (this.stamina <= 0 && !this.exhausted) {
        this.exhausted = true;
        this.game.ui.toast('Épuisé ! Repose-toi un instant…', 'warn');
      }
    }

    // --------------------------------------------------------------------
    update(dt, input) {
      const g = this.game, w = g.world;
      if (!this.alive) return;
      this.invul = Math.max(0, this.invul - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.dashTime = Math.max(0, this.dashTime - dt);
      this.jumpCd = Math.max(0, this.jumpCd - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.useCd = Math.max(0, this.useCd - dt);
      this.staminaDelay = Math.max(0, this.staminaDelay - dt);
      this.vigor = Math.max(0, this.vigor - dt);
      this.swing = Math.max(0, this.swing - dt * 3.2);
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) this.combo = 0;

      const k = input.keys;
      const fx = Math.floor(this.x), fz = Math.floor(this.z);
      this.inWater = w.get(fx, Math.floor(this.y + 0.4), fz) === B.WATER;
      const wasHeadIn = this.headInWater;
      this.headInWater = w.get(fx, Math.floor(this.y + this.eyeH), fz) === B.WATER;
      if (this.inWater && !this.wasInWater && this.vy < -6) CM.Audio.play('splash');
      this.wasInWater = this.inWater;

      // ----- direction souhaitée
      const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
      const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
      let wx = -Math.sin(this.yaw) * f + Math.cos(this.yaw) * s;
      let wz = -Math.cos(this.yaw) * f - Math.sin(this.yaw) * s;
      const wl = Math.hypot(wx, wz);
      if (wl > 0) { wx /= wl; wz /= wl; }

      let speed = 4.3;
      this.sprinting = false;
      if ((k.ShiftLeft || k.ShiftRight) && f > 0 && !this.exhausted && this.stamina > 0) {
        speed = 6.6;
        this.sprinting = true;
        this.spend(15 * dt);
      }
      if (this.inWater) speed = this.sprinting ? 3.6 : 2.6;

      // ----- ruée
      if (input.pressed.KeyF && this.dashCd <= 0) {
        if (this.exhausted || this.stamina < 20) g.ui.toast("Pas assez d'endurance pour la ruée", 'warn');
        else {
          let dx = wx, dz = wz;
          if (!wl) { dx = -Math.sin(this.yaw); dz = -Math.cos(this.yaw); }
          this.vx = dx * 16;
          this.vz = dz * 16;
          this.vy = Math.max(this.vy, 2);
          this.dashTime = 0.2;
          this.dashCd = 0.8;
          this.invul = Math.max(this.invul, 0.3);
          this.spend(20);
          CM.Audio.play('dash');
          g.entities.burst(CM.Textures.layer.white, this.x, this.y + 0.9, this.z, 10, { speed: 2, grav: 0, life: 0.35, size: 0.06 });
        }
      }

      // ----- accélération horizontale
      if (this.dashTime <= 0) {
        if (this.onGround || this.inWater) {
          const acc = this.inWater ? 8 : 16;
          this.vx += (wx * speed - this.vx) * Math.min(1, acc * dt);
          this.vz += (wz * speed - this.vz) * Math.min(1, acc * dt);
        } else {
          // contrôle aérien qui conserve l'élan (grappin, ruée)
          if (wl) {
            const cur = this.vx * wx + this.vz * wz;
            const add = speed - cur;
            if (add > 0) {
              const a = Math.min(add, 22 * dt);
              this.vx += wx * a;
              this.vz += wz * a;
            }
          }
          const drag = Math.max(0, 1 - 0.25 * dt);
          this.vx *= drag;
          this.vz *= drag;
        }
      }

      // ----- saut / nage / double saut
      const standBlock = w.get(fx, Math.floor(this.y - 0.05), fz);
      if (this.inWater) {
        if (k.Space) this.vy = Math.min(this.vy + 16 * dt, Math.max(this.vy, 3.4));
        else this.vy = Math.max(this.vy - 7 * dt, -2.8);
        this.vy -= 2 * dt;
        // s'extraire de l'eau en nageant contre un rebord
        if (k.Space && (this.hitX || this.hitZ) && !this.headInWater) this.vy = 9.5;
      } else {
        const grav = this.hook ? GRAVITY * 0.45 : this.dashTime > 0 ? GRAVITY * 0.3 : GRAVITY;
        this.vy -= grav * dt;
        if (k.Space && this.onGround && this.jumpCd <= 0) {
          const bounce = standBlock === B.MUSHROOM;
          this.vy = bounce ? 14 : 8.6;
          this.jumpCd = 0.15;
          if (bounce) CM.Audio.play('bounce');
          this.stamina = Math.max(0, this.stamina - 1);
        } else if (input.pressed.Space && !this.onGround) {
          if (this.hook) {
            this.releaseHook(true);
          } else if (!this.usedDouble && g.inventory.has(I.FEATHER_CHARM)) {
            if (this.exhausted || this.stamina < 12) g.ui.toast("Pas assez d'endurance", 'warn');
            else {
              this.vy = 8.8;
              this.usedDouble = true;
              this.spend(12);
              CM.Audio.play('jump2');
              g.entities.burst(CM.Textures.layer.white, this.x, this.y, this.z, 12, { speed: 2.5, grav: 2, life: 0.5, size: 0.07 });
            }
          }
        }
      }
      this.vy = Math.max(this.vy, -55);

      // ----- grappin
      if (this.hook) this.updateHook(dt);

      // ----- déplacement + collisions
      const prevVy = this.vy;
      const wasGround = this.onGround;
      CM.Physics.move(w, this, this.vx * dt, this.vy * dt, this.vz * dt);
      if (this.hitY) this.vy = 0;
      if (this.hitX && this.hook) this.vx *= 0.5;
      if (this.hitZ && this.hook) this.vz *= 0.5;

      // ----- chute, rebond
      if (this.landed) {
        const under = w.get(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z));
        const fall = this.fallStart - this.y;
        if (under === B.MUSHROOM && prevVy < -4) {
          this.vy = Math.min(24, -prevVy * 0.85);
          this.onGround = false;
          CM.Audio.play('bounce');
          g.entities.burst(CM.blockLayers[B.MUSHROOM][2], this.x, this.y, this.z, 8, { speed: 3 });
        } else if (fall > 3.6 && !this.inWater) {
          this.damage(Math.floor(fall - 3), null, null, 'La gravité');
        }
        if (!wasGround && fall > 1) CM.Audio.play('step', { mat: this.matUnder() });
      }
      if (this.onGround || this.inWater || this.hook) {
        this.fallStart = this.y;
        if (this.onGround) this.usedDouble = false;
      } else this.fallStart = Math.max(this.fallStart, this.y);

      // ----- endurance, souffle, santé
      if (this.headInWater) {
        this.stamina = Math.max(0, this.stamina - 7 * dt);
        this.staminaDelay = 0.5;
        if (this.stamina <= 0) {
          this.drown = (this.drown || 0) + dt;
          if (this.drown > 1) {
            this.drown = 0;
            this.damage(2, null, null, 'La noyade');
          }
        }
        if (!wasHeadIn) g.ui.toast('Sous l’eau, ton endurance sert de souffle !', 'info', 'water');
      } else if (this.staminaDelay <= 0) {
        const rate = (this.vigor > 0 ? 45 : 24) * (this.onGround || this.inWater ? 1 : 0.35);
        this.stamina = Math.min(this.maxStamina, this.stamina + rate * dt);
      }
      if (this.exhausted && this.stamina >= 30) this.exhausted = false;
      if (this.health < 20 && this.stamina > 30) {
        this.regen += dt * (this.vigor > 0 ? 2.5 : 1);
        if (this.regen >= 4) {
          this.regen = 0;
          this.health = Math.min(20, this.health + 1);
        }
      }

      // ----- pas et balancement
      const hs = Math.hypot(this.vx, this.vz);
      if (this.onGround && hs > 0.5) {
        this.bob += hs * dt * 1.9;
        this.bobAmp = Math.min(1, this.bobAmp + dt * 4);
        this.stepDist += hs * dt;
        if (this.stepDist > (this.sprinting ? 2.2 : 1.8)) {
          this.stepDist = 0;
          CM.Audio.play('step', { mat: this.matUnder() });
        }
      } else this.bobAmp = Math.max(0, this.bobAmp - dt * 4);

      if (this.y < -30) this.damage(100, null, null, 'Le vide');

      // ----- visée, minage, combat, utilisation
      this.updateTarget();
      this.updateActions(dt, input);
    }

    matUnder() {
      const id = this.game.world.get(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z));
      return id ? CM.blocks[id].sound : 'stone';
    }

    updateTarget() {
      const e = this.eye(), d = this.look();
      this.target = this.game.world.raycast(e[0], e[1], e[2], d[0], d[1], d[2], REACH, (id) => id !== B.WATER);
    }

    // ------------------------------------------------------------ grappin --
    fireHook() {
      const g = this.game;
      if (this.hook) {
        this.releaseHook(false);
        return;
      }
      if (this.exhausted || this.stamina < 8) {
        g.ui.toast("Pas assez d'endurance pour le grappin", 'warn');
        return;
      }
      const e = this.eye(), d = this.look();
      const hit = g.world.raycast(e[0], e[1], e[2], d[0], d[1], d[2], GRAPPLE_RANGE, (id) => CM.blocks[id].solid);
      if (!hit) {
        CM.Audio.play('click');
        g.ui.toast('Hors de portée du grappin (' + GRAPPLE_RANGE + ' blocs)', 'info', 'grapple-range');
        return;
      }
      this.hook = { x: e[0] + d[0] * hit.t, y: e[1] + d[1] * hit.t, z: e[2] + d[2] * hit.t, bx: hit.x, by: hit.y, bz: hit.z, t: 0 };
      this.spend(8);
      this.swing = 1;
      CM.Audio.play('grapple');
      g.stats.grapples = (g.stats.grapples || 0) + 1;
    }
    releaseHook(boost) {
      if (boost) {
        this.vy = Math.max(this.vy, 0) + 6;
        CM.Audio.play('jump2');
      }
      this.hook = null;
    }
    updateHook(dt) {
      const h = this.hook, w = this.game.world;
      h.t += dt;
      const held = this.game.inventory.held();
      if (!held || held.id !== I.GRAPPLE || !w.solidAt(h.bx, h.by, h.bz) || h.t > 5) {
        this.hook = null;
        return;
      }
      const e = this.eye();
      const dx = h.x - e[0], dy = h.y - e[1], dz = h.z - e[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 1.4) {
        this.hook = null;
        this.vy = Math.max(this.vy, 3);
        return;
      }
      const pull = 55;
      this.vx += (dx / dist) * pull * dt;
      this.vy += (dy / dist) * pull * dt;
      this.vz += (dz / dist) * pull * dt;
      const sp = Math.hypot(this.vx, this.vy, this.vz);
      if (sp > 24) {
        this.vx *= 24 / sp;
        this.vy *= 24 / sp;
        this.vz *= 24 / sp;
      }
    }

    // ---------------------------------------------------- actions --------
    heldInfo() {
      const s = this.game.inventory.held();
      return s ? CM.itemInfo(s.id) : null;
    }
    masteryOf(stack) {
      return stack && stack.xp !== undefined ? CM.masteryLevel(stack.xp) : 1;
    }

    // Temps pour casser un bloc avec l'objet en main.
    breakInfo(id) {
      const b = CM.blocks[id];
      if (b.hardness <= 0) return { time: 0.05, harvest: true };
      const stack = this.game.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      let speed = 1;
      let harvest = b.tier === 0;
      if (info && info.type === 'tool' && b.tool && info.toolType === b.tool) {
        speed = CM.TOOL_SPEED[info.tier] * (1 + 0.12 * (this.masteryOf(stack) - 1));
        harvest = info.tier >= b.tier;
      }
      let time = (b.hardness * 1.5) / speed;
      if (!harvest) time *= 3.3;
      time /= this.comboMult();
      if (this.exhausted) time *= 1.6;
      if (this.inWater && !this.onGround) time *= 2;
      return { time, harvest };
    }
    comboMult() {
      return 1 + 0.1 * Math.max(0, Math.min(this.combo, 7) - 1);
    }

    updateActions(dt, input) {
      const g = this.game;
      const e = this.eye(), d = this.look();
      // attaque
      if (input.pressed.mouse0 && this.attackCd <= 0) {
        const mh = g.entities.raycastMob(e[0], e[1], e[2], d[0], d[1], d[2], 3.6);
        if (mh && (!this.target || mh.t < this.target.t)) {
          this.attack(mh.mob);
          this.mining = null;
          return;
        }
        this.swing = 1;
      }
      // minage
      if (input.mouse[0] && this.target) {
        const t = this.target;
        const b = CM.blocks[t.id];
        if (!b.unbreakable && b.hardness >= 0) {
          if (!this.mining || this.mining.x !== t.x || this.mining.y !== t.y || this.mining.z !== t.z || this.mining.id !== t.id) {
            this.mining = { x: t.x, y: t.y, z: t.z, id: t.id, progress: 0, snd: 0 };
          }
          const bi = this.breakInfo(t.id);
          this.mining.progress += dt / bi.time;
          this.mining.snd -= dt;
          if (this.swing < 0.3) this.swing = 1;
          if (this.mining.snd <= 0) {
            this.mining.snd = 0.22;
            CM.Audio.play('dig', { mat: b.sound });
            g.entities.burst(CM.blockLayers[t.id][0], t.x + 0.5 + t.nx * 0.52, t.y + 0.5 + t.ny * 0.52, t.z + 0.5 + t.nz * 0.52, 2, { speed: 2, spread: 0.5 });
          }
          if (this.mining.progress >= 1) {
            this.breakBlock(t.x, t.y, t.z, t.id, bi.harvest, true);
            this.mining = null;
          }
        }
      } else this.mining = null;

      // utilisation (clic droit)
      if (input.mouse[2] && (input.pressed.mouse2 || this.useCd <= 0)) {
        this.use(input);
      }
    }

    attack(mob) {
      const g = this.game;
      const stack = g.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      let dmg = 1;
      if (info && info.type === 'tool') {
        dmg = info.toolType === 'sword' ? CM.SWORD_DAMAGE[info.tier] : info.tier + 1;
        if (info.toolType === 'sword') dmg += Math.floor((this.masteryOf(stack) - 1) / 2);
      }
      let crit = false;
      if (!this.onGround && this.vy < -1) {
        dmg *= 1.5;
        crit = true;
      }
      if (this.dashTime > 0) {
        dmg += 2;
        crit = true;
      }
      this.attackCd = 0.38;
      this.swing = 1;
      g.entities.hurtMob(mob, dmg, [this.x, this.z]);
      if (crit) g.entities.burst(CM.Textures.layer.white, mob.x, mob.y + mob.h * 0.7, mob.z, 10, { speed: 4, grav: 4, life: 0.5, size: 0.05, emissive: true });
      if (info && info.toolType === 'sword') this.gainXp(stack, mob.dead ? 4 : 1);
    }

    gainXp(stack, n) {
      const before = CM.masteryLevel(stack.xp || 0);
      stack.xp = (stack.xp || 0) + n;
      const after = CM.masteryLevel(stack.xp);
      if (after > before) {
        CM.Audio.play('level');
        this.game.ui.toast('Maîtrise ↑ ' + CM.itemName(stack.id) + ' ' + '★'.repeat(after), 'gold');
      }
      this.game.inventory.changed();
    }

    breakBlock(x, y, z, id, harvest, primary) {
      const g = this.game, w = g.world;
      const b = CM.blocks[id];
      w.setBlock(x, y, z, 0);
      if (id === B.CHEST) g.spillChest(x, y, z);
      g.entities.blockParticles(id, x, y, z, primary ? 16 : 8);
      CM.Audio.play('break', { mat: b.sound });
      g.stats.mined[id] = (g.stats.mined[id] || 0) + 1;
      // plantes et torches posées dessus tombent aussi
      const above = w.get(x, y + 1, z);
      if (above && (CM.blocks[above].plant || above === B.TORCH)) {
        this.breakBlock(x, y + 1, z, above, true, false);
      }
      if (!primary) {
        if (harvest) for (const [did, n] of CM.blockDrops(id, Math.random)) g.entities.addDrop(did, n, x + 0.5, y + 0.4, z + 0.5);
        return;
      }
      // combo de minage
      const now = g.clock;
      if (now - this.lastBreak < 2.4) this.combo = Math.min(this.combo + 1, 99);
      else this.combo = 1;
      this.lastBreak = now;
      this.comboTimer = 2.4;
      if (this.combo >= 2) CM.Audio.play('combo', { level: this.combo });
      if (this.combo === 5 || this.combo === 10 || this.combo === 20) g.ui.toast('Combo x' + this.combo + ' — minage accéléré !', 'gold');
      let mult = 1;
      if (harvest && b.ore && this.combo >= 5 && Math.random() < 0.35) {
        mult = 2;
        g.ui.toast('Double butin !', 'gold');
      }
      if (harvest) {
        for (const [did, n] of CM.blockDrops(id, Math.random)) g.entities.addDrop(did, n * mult, x + 0.5, y + 0.4, z + 0.5);
      } else if (b.tier > 0) {
        g.ui.toast('Il faut un meilleur outil pour récolter : ' + b.name, 'warn', 'tool' + id);
      }
      this.spend(0.6);
      // maîtrise de l'outil
      const stack = g.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      if (info && info.type === 'tool' && info.toolType === b.tool) {
        this.gainXp(stack, b.ore ? 2 : 1);
        // pioche de cristal : minage de filon
        if (info.toolType === 'pickaxe' && info.tier === 4 && b.ore) this.veinMine(x, y, z, id);
        // hache en fer ou mieux : abat l'arbre entier
        if (info.toolType === 'axe' && info.tier >= 3 && id === B.LOG) this.fellTree(x, y, z);
      }
    }

    fellTree(x, y, z) {
      const w = this.game.world;
      const logs = [];
      const leaves = [];
      const seen = new Set([x + ',' + y + ',' + z]);
      let queue = [[x, y, z]];
      while (queue.length && logs.length < 48) {
        const [cx, cy, cz] = queue.shift();
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = 0; dy <= 1; dy++)
            for (let dz = -1; dz <= 1; dz++) {
              const nx = cx + dx, ny = cy + dy, nz = cz + dz;
              const key = nx + ',' + ny + ',' + nz;
              if (seen.has(key)) continue;
              seen.add(key);
              if (w.get(nx, ny, nz) === B.LOG) {
                logs.push([nx, ny, nz]);
                queue.push([nx, ny, nz]);
              }
            }
      }
      if (!logs.length) return;
      // feuillage accroché aux bûches abattues
      queue = logs.slice();
      const depth = new Map(logs.map((l) => [l.join(','), 0]));
      while (queue.length && leaves.length < 160) {
        const c = queue.shift();
        const d = depth.get(c.join(','));
        if (d >= 3) continue;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const n = [c[0] + dx, c[1] + dy, c[2] + dz];
          const key = n.join(',');
          if (depth.has(key)) continue;
          depth.set(key, d + 1);
          if (w.get(n[0], n[1], n[2]) === B.LEAVES) {
            leaves.push(n);
            queue.push(n);
          }
        }
      }
      for (const [lx, ly, lz] of logs) this.breakBlock(lx, ly, lz, B.LOG, true, false);
      for (const [lx, ly, lz] of leaves) this.breakBlock(lx, ly, lz, B.LEAVES, true, false);
      this.game.ui.toast('Timber ! L’arbre entier tombe (+' + logs.length + ' bûches)', 'gold');
    }

    veinMine(x, y, z, id) {
      const w = this.game.world;
      const seen = new Set([x + ',' + y + ',' + z]);
      const queue = [[x, y, z]];
      const found = [];
      while (queue.length && found.length < 14) {
        const [cx, cy, cz] = queue.shift();
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (let dz = -1; dz <= 1; dz++) {
              const nx = cx + dx, ny = cy + dy, nz = cz + dz;
              const key = nx + ',' + ny + ',' + nz;
              if (seen.has(key)) continue;
              seen.add(key);
              if (w.get(nx, ny, nz) === id) {
                found.push([nx, ny, nz]);
                queue.push([nx, ny, nz]);
              }
            }
      }
      for (const [fx, fy, fz] of found) this.breakBlock(fx, fy, fz, id, true, false);
      if (found.length) this.game.ui.toast('Filon ! +' + found.length + ' blocs', 'gold');
    }

    use(input) {
      const g = this.game, w = g.world, inv = g.inventory;
      const t = this.target;
      const stack = inv.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      this.useCd = 0.22;
      const shift = input.keys.ShiftLeft || input.keys.ShiftRight;
      if (input.pressed.mouse2 && t && CM.blocks[t.id].station && !(info && info.isBlock && shift)) {
        g.ui.openInventory();
        return;
      }
      if (input.pressed.mouse2 && t && t.id === B.CHEST && !(info && info.isBlock && shift)) {
        g.ui.openChest(g.chestAt(t.x, t.y, t.z));
        return;
      }
      if (!info) return;
      if (info.type === 'food') {
        if (!input.pressed.mouse2) return;
        if (this.health >= 20 && this.stamina >= this.maxStamina - 1) {
          g.ui.toast('Tu es en pleine forme.', 'info', 'full');
          return;
        }
        this.health = Math.min(20, this.health + info.heal);
        this.stamina = Math.min(this.maxStamina, this.stamina + info.stamina);
        if (info.vigor) {
          this.vigor = info.vigor;
          g.ui.toast('Vigueur : récupération accélérée (' + info.vigor + ' s)', 'gold');
        }
        inv.consumeHeld(1);
        this.swing = 1;
        this.useCd = 0.5;
        CM.Audio.play('eat');
        g.entities.burst(CM.Textures.layer[info.tex], this.x - Math.sin(this.yaw) * 0.4, this.y + 1.4, this.z - Math.cos(this.yaw) * 0.4, 8, { speed: 1.5, size: 0.06 });
        return;
      }
      if (info.type === 'grapple') {
        if (input.pressed.mouse2) this.fireHook();
        return;
      }
      if (!info.isBlock || !t) return;
      // position de pose
      let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
      if (CM.blocks[t.id].replaceable && t.id !== B.WATER) {
        px = t.x; py = t.y; pz = t.z;
      }
      if (!w.inside(px, py, pz)) return;
      const cur = w.get(px, py, pz);
      if (cur !== 0 && !CM.blocks[cur].replaceable) return;
      const b = info.block;
      if (b.plant) {
        const below = w.get(px, py - 1, pz);
        if (below !== B.GRASS && below !== B.DIRT) return;
      }
      if (b.render === 'torch') {
        const sup = w.solidAt(px, py - 1, pz) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => w.solidAt(px + dx, py, pz + dz));
        if (!sup || cur === B.WATER) return;
      }
      if (b.solid) {
        const hit = (ex, ey, ez, hw, h) => ex + hw > px && ex - hw < px + 1 && ey + h > py && ey < py + 1 && ez + hw > pz && ez - hw < pz + 1;
        if (hit(this.x, this.y, this.z, this.hw, this.h)) return;
        for (const m of g.entities.mobs) if (hit(m.x, m.y, m.z, m.hw, m.h)) return;
      }
      w.setBlock(px, py, pz, stack.id);
      if (stack.id === B.SAPLING) g.saplings.add(px + ',' + py + ',' + pz);
      g.stats.placed[stack.id] = (g.stats.placed[stack.id] || 0) + 1;
      CM.Audio.play('place', { mat: b.sound });
      this.swing = 1;
      if (stack.id === B.DAWN_HEART) g.onDawnHeart(px, py, pz);
      inv.consumeHeld(1);
    }

    damage(n, sx, sz, cause) {
      const g = this.game;
      if (!this.alive || this.invul > 0 || n <= 0) return;
      this.health -= n;
      this.invul = 0.55;
      this.hurtFlash = 0.45;
      CM.Audio.play('hurt');
      if (sx !== null && sx !== undefined) {
        const dx = this.x - sx, dz = this.z - sz;
        const l = Math.hypot(dx, dz) || 1;
        this.vx += (dx / l) * 7;
        this.vz += (dz / l) * 7;
        this.vy = Math.max(this.vy, 5);
      }
      if (this.health <= 0) {
        this.health = 0;
        this.die(cause);
      }
    }

    die(cause) {
      const g = this.game;
      this.alive = false;
      this.hook = null;
      const inv = g.inventory;
      for (let i = 0; i < 36; i++) {
        const s = inv.slots[i];
        if (!s) continue;
        const extra = s.xp !== undefined ? { xp: s.xp } : null;
        g.entities.addDrop(s.id, s.count, this.x, this.y + 1, this.z, extra);
        inv.slots[i] = null;
      }
      inv.changed();
      g.stats.deaths = (g.stats.deaths || 0) + 1;
      g.ui.showDeath(cause);
    }

    respawn() {
      const w = this.game.world;
      w.stream(w.spawn.x, w.spawn.z, 2, 0);
      w.fixSpawn();
      this.reset(w.spawn);
      this.game.ui.hideDeath();
    }

    // ------------------------------------------------- main à l'écran ----
    buildHand(batch, time) {
      const stack = this.game.inventory.held();
      const l = [this.game.world.skyAt(Math.floor(this.x), Math.floor(this.y + 1.6), Math.floor(this.z)) / 15,
        this.game.world.blockLightAt(Math.floor(this.x), Math.floor(this.y + 1.6), Math.floor(this.z)) / 15];
      const sw = Math.sin(Math.min(1, 1 - this.swing) * Math.PI);
      const swingOn = this.swing > 0 ? sw : 0;
      const bx = Math.sin(this.bob) * 0.035 * this.bobAmp;
      const by = -Math.abs(Math.cos(this.bob)) * 0.03 * this.bobAmp;
      const M = this.M;
      const L = CM.Textures.layer;
      if (!stack) {
        mat4.compose(M, 0.48 + bx - swingOn * 0.12, -0.44 + by + swingOn * 0.08, -0.62 - swingOn * 0.18, 0.3, -1.25 - swingOn * 0.5, 0, 1);
        batch.box(M, -0.07, -0.2, -0.07, 0.07, 0.2, 0.07, L.skin, l[0], l[1], 0);
        batch.box(M, -0.075, -0.52, -0.075, 0.075, -0.2, 0.075, L.sleeve, l[0], l[1], 0);
        return;
      }
      const info = CM.itemInfo(stack.id);
      const cubeish = info.isBlock && (info.block.render === 'cube' || info.block.render === 'glass');
      if (cubeish) {
        mat4.compose(M, 0.44 + bx - swingOn * 0.12, -0.38 + by + swingOn * 0.1, -0.7 - swingOn * 0.2, 0.75 + swingOn * 0.3, 0.12 - swingOn * 0.6, 0, 1);
        batch.box(M, -0.16, -0.16, -0.16, 0.16, 0.16, 0.16, CM.blockLayers[stack.id], l[0], l[1], info.block.light ? 1 : 0);
      } else {
        const layer = info.isBlock ? CM.blockLayers[stack.id][0] : L[info.tex];
        mat4.compose(M, 0.52 + bx - swingOn * 0.1, -0.36 + by + swingOn * 0.05, -0.72 - swingOn * 0.15, -0.55, -0.2 - swingOn * 1.1, 0.3, 1);
        const emi = (info.isBlock && info.block.light) || stack.id === B.TORCH ? 1 : 0;
        batch.box(M, -0.2, -0.2, 0, 0.2, 0.2, 0, [-1, -1, -1, -1, layer, -1], l[0], l[1], emi);
      }
    }

    // Lumière dynamique : tenir une torche ou une lanterne éclaire autour.
    heldLight() {
      const s = this.game.inventory.held();
      if (!s) return 0;
      if (s.id === B.TORCH || s.id === B.LAMP || s.id === B.DAWN_HEART) return 1;
      if (s.id === B.MUSHROOM || s.id === B.CRYSTAL_ORE) return 0.6;
      return 0;
    }
  }

  CM.Player = Player;
})();
