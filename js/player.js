'use strict';
// Joueur : déplacements, faim, souffle, ruée, double saut, grappin, minage, combat, mode créatif.
(function () {
  const B = CM.B;
  const I = CM.I;
  const mat4 = CM.mat4;

  const GRAVITY = 28;
  const REACH = 5;
  const GRAPPLE_RANGE = 34;
  const MAX_AIR = 15; // secondes de souffle sous l'eau
  // Faim (comme dans Minecraft) : 20 points, saturation, épuisement.
  const EXH = { sprint: 0.1, swim: 0.012, jump: 0.05, sprintJump: 0.2, mine: 0.005, attack: 0.1, hurt: 0.1, heal: 6, dash: 1.2, double: 0.6, grapple: 0.4 };

  class Player {
    constructor(game) {
      this.game = game;
      this.hw = 0.3;
      this.h = 1.8;
      this.eyeH = 1.62;
      this.stepUp = 0.55;
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
      this.food = 20;
      this.sat = 5;
      this.exh = 0;
      this.air = MAX_AIR;
      this.regenT = 0;
      this.starveT = 0;
      this.drownT = 0;
      this.regenEffect = 0;
      this.alive = true;
      this.invul = 1;
      this.hurtFlash = 0;
      this.fallStart = this.y;
      this.dashCd = 0; this.dashTime = 0;
      this.usedDouble = false;
      this.jumpCd = 0;
      this.hook = null;
      this.mining = null;
      this.combo = 0; this.comboTimer = 0; this.lastBreak = -10;
      this.attackCd = 0; this.useCd = 0; this.breakCd = 0;
      this.swing = 0;
      this.bob = 0; this.bobAmp = 0;
      this.stepDist = 0;
      this.inWater = false; this.headInWater = false;
      this.target = null;
      this.sprinting = false;
      this.sprintToggle = false;
      this.sneaking = false;
      this.flying = false;
      this.lastJumpTap = -10;
      this.eyeOffset = 0;
    }

    get creative() {
      return this.game.mode === 'creative';
    }
    get maxHealth() {
      return 20 + (this.game.inventory.has(I.RUBY_CHARM) ? 4 : 0);
    }
    eye() {
      return [this.x, this.y + this.eyeH - this.eyeOffset, this.z];
    }
    look() {
      const cp = Math.cos(this.pitch);
      return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
    }
    // Ajoute de l'épuisement (fait baisser la saturation puis la faim).
    exhaust(n) {
      if (this.creative || this.game.difficulty === 'peaceful') return;
      if (this.game.inventory.has(I.STAMINA_CHARM)) n *= 0.5;
      this.exh += n;
      while (this.exh >= 4) {
        this.exh -= 4;
        if (this.sat > 0) this.sat = Math.max(0, this.sat - 1);
        else this.food = Math.max(0, this.food - 1);
      }
    }
    canSprint() {
      return this.creative || this.food > 6;
    }

    // --------------------------------------------------------------------
    update(dt, input) {
      const g = this.game, w = g.world, K = g.binds;
      if (!this.alive) return;
      this.invul = Math.max(0, this.invul - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.dashTime = Math.max(0, this.dashTime - dt);
      this.jumpCd = Math.max(0, this.jumpCd - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.useCd = Math.max(0, this.useCd - dt);
      this.breakCd = Math.max(0, this.breakCd - dt);
      this.regenEffect = Math.max(0, this.regenEffect - dt);
      this.swing = Math.max(0, this.swing - dt * 3.2);
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) this.combo = 0;
      if (!this.creative) this.flying = false;

      const k = input.keys;
      const fx = Math.floor(this.x), fz = Math.floor(this.z);
      this.inWater = w.get(fx, Math.floor(this.y + 0.4), fz) === B.WATER;
      const wasHeadIn = this.headInWater;
      this.headInWater = w.get(fx, Math.floor(this.y + this.eyeH), fz) === B.WATER;
      if (this.inWater && !this.wasInWater && this.vy < -6) CM.Audio.play('splash');
      this.wasInWater = this.inWater;

      // ----- direction souhaitée
      let f = (k[K.forward] ? 1 : 0) - (k[K.back] ? 1 : 0);
      let s = (k[K.right] ? 1 : 0) - (k[K.left] ? 1 : 0);
      // joystick tactile : direction et intensité analogiques
      let mag = 1;
      if (input.analog) {
        f = input.analog.y;
        s = input.analog.x;
        mag = Math.min(1, Math.hypot(f, s));
      }
      let wx = -Math.sin(this.yaw) * f + Math.cos(this.yaw) * s;
      let wz = -Math.cos(this.yaw) * f - Math.sin(this.yaw) * s;
      const wl = Math.hypot(wx, wz);
      if (wl > 0) { wx /= wl; wz /= wl; }

      // ----- vol (mode créatif) : double appui sur saut
      if (this.creative && input.pressed[K.jump]) {
        if (g.clock - this.lastJumpTap < 0.3) {
          this.flying = !this.flying;
          this.vy = 0;
          this.lastJumpTap = -10;
          g.ui.toast(this.flying ? 'Vol activé (saut : monter, ' + g.keyName(K.sneak) + ' : descendre)' : 'Vol désactivé', 'info', 'fly');
        } else this.lastJumpTap = g.clock;
      }

      const under = CM.blocks[w.get(fx, Math.floor(this.y - 0.05), fz)];
      this.sneaking = !this.flying && !!k[K.sneak] && !this.inWater;
      this.eyeOffset += ((this.sneaking ? 0.25 : 0) - this.eyeOffset) * Math.min(1, dt * 12);
      // course : maintenir ou basculer (option)
      const sprintKey = !!k[K.sprint];
      if (g.options.toggleSprint) {
        if (input.pressed[K.sprint]) this.sprintToggle = !this.sprintToggle;
        if (f <= 0) this.sprintToggle = false;
      }
      const wantSprint = g.options.toggleSprint ? this.sprintToggle : sprintKey;
      let speed = 4.3;
      this.sprinting = false;
      if (wantSprint && f > 0 && !this.sneaking && this.canSprint()) {
        speed = 6.6;
        this.sprinting = true;
      } else if (wantSprint && f > 0 && !this.canSprint() && this.onGround) {
        g.ui.toast('Trop faim pour courir : mange quelque chose !', 'warn', 'nosprint');
      }
      if (this.sneaking) speed = 1.6;
      if (this.inWater) speed = this.sprinting ? 3.6 : 2.6;
      if (this.onGround && under.slow) speed *= under.slow;
      if (this.onGround && under.slip) speed *= 1.15;
      if (this.flying) speed = this.sprinting ? 21 : 11;
      if (mag < 1) speed *= Math.max(0.3, mag);

      // ----- ruée
      if (input.pressed[K.dash] && this.dashCd <= 0 && !this.flying) {
        if (!this.canSprint()) g.ui.toast('Trop faim pour la ruée', 'warn', 'nodash');
        else {
          let dx = wx, dz = wz;
          if (!wl) { dx = -Math.sin(this.yaw); dz = -Math.cos(this.yaw); }
          this.vx = dx * 16;
          this.vz = dz * 16;
          this.vy = Math.max(this.vy, 2);
          this.dashTime = 0.2;
          this.dashCd = 1;
          this.invul = Math.max(this.invul, 0.3);
          this.exhaust(EXH.dash);
          CM.Audio.play('dash');
          g.entities.burst(CM.Textures.layer.white, this.x, this.y + 0.9, this.z, 10, { speed: 2, grav: 0, life: 0.35, size: 0.06 });
        }
      }

      // ----- accélération horizontale
      const px0 = this.x, pz0 = this.z;
      if (this.dashTime <= 0) {
        if (this.flying) {
          this.vx += (wx * speed - this.vx) * Math.min(1, 10 * dt);
          this.vz += (wz * speed - this.vz) * Math.min(1, 10 * dt);
        } else if (this.onGround || this.inWater) {
          const slip = this.onGround && under.slip;
          const acc = this.inWater ? 8 : slip ? 1.2 * (1 - under.slip) * 60 : 16;
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

      // ----- saut / nage / double saut / vol
      const standBlock = w.get(fx, Math.floor(this.y - 0.05), fz);
      if (this.flying) {
        const up = (k[K.jump] ? 1 : 0) - (k[K.sneak] ? 1 : 0);
        this.vy += (up * 9 - this.vy) * Math.min(1, 10 * dt);
      } else if (this.inWater) {
        if (k[K.jump]) this.vy = Math.min(this.vy + 16 * dt, Math.max(this.vy, 3.4));
        else this.vy = Math.max(this.vy - 7 * dt, -2.8);
        this.vy -= 2 * dt;
        // s'extraire de l'eau en nageant contre un rebord
        if (k[K.jump] && (this.hitX || this.hitZ) && !this.headInWater) this.vy = 9.5;
      } else {
        const grav = this.hook ? GRAVITY * 0.45 : this.dashTime > 0 ? GRAVITY * 0.3 : GRAVITY;
        this.vy -= grav * dt;
        // saut automatique (option) : face à une marche d'un bloc en avançant
        let autoJump = false;
        if (g.options.autoJump && this.onGround && f > 0 && (this.hitX || this.hitZ)) {
          const ax = Math.floor(this.x + wx * 0.7), az = Math.floor(this.z + wz * 0.7), ay = Math.floor(this.y + 0.05);
          autoJump = w.solidHeight(ax, ay, az) >= 1 && !w.solidAt(ax, ay + 1, az) && !w.solidAt(ax, ay + 2, az);
        }
        if ((k[K.jump] || autoJump) && this.onGround && this.jumpCd <= 0) {
          const bounce = standBlock === B.MUSHROOM || standBlock === B.SLIME_BLOCK;
          const honey = standBlock === B.HONEY_BLOCK;
          this.vy = bounce ? 14 : honey ? 5 : 8.6;
          this.jumpCd = 0.15;
          if (bounce) CM.Audio.play('bounce');
          this.exhaust(this.sprinting ? EXH.sprintJump : EXH.jump);
        } else if (input.pressed[K.jump] && !this.onGround) {
          if (this.hook) {
            this.releaseHook(true);
          } else if (!this.usedDouble && g.inventory.has(I.FEATHER_CHARM) && !this.creative) {
            if (!this.canSprint()) g.ui.toast('Trop faim pour le double saut', 'warn', 'nodouble');
            else {
              this.vy = 8.8;
              this.usedDouble = true;
              this.exhaust(EXH.double);
              CM.Audio.play('jump2');
              g.entities.burst(CM.Textures.layer.white, this.x, this.y, this.z, 12, { speed: 2.5, grav: 2, life: 0.5, size: 0.07 });
            }
          }
        }
      }
      this.vy = Math.max(this.vy, -55);

      // ----- grappin
      if (this.hook) this.updateHook(dt);

      // ----- déplacement + collisions (accroupi : on ne tombe pas du bord)
      const prevVy = this.vy;
      const wasGround = this.onGround;
      if (this.sneaking && this.onGround) {
        const ox = this.x, oz = this.z;
        CM.Physics.move(w, this, this.vx * dt, 0, 0);
        if (!CM.Physics.overlaps(w, this.x, this.y - 0.6, this.z, this.hw, 0.6)) { this.x = ox; this.vx = 0; }
        CM.Physics.move(w, this, 0, 0, this.vz * dt);
        if (!CM.Physics.overlaps(w, this.x, this.y - 0.6, this.z, this.hw, 0.6)) { this.z = oz; this.vz = 0; }
        this.onGround = true;
        CM.Physics.move(w, this, 0, this.vy * dt, 0);
      } else CM.Physics.move(w, this, this.vx * dt, this.vy * dt, this.vz * dt);
      if (this.hitY) this.vy = 0;
      if (this.hitX && this.hook) this.vx *= 0.5;
      if (this.hitZ && this.hook) this.vz *= 0.5;
      if (this.flying && this.onGround && !k[K.jump]) this.flying = false;
      const moved = Math.hypot(this.x - px0, this.z - pz0);
      if (this.sprinting) this.exhaust(EXH.sprint * moved);
      else if (this.inWater) this.exhaust(EXH.swim * moved);

      // ----- chute, rebond
      if (this.landed) {
        const under2 = w.get(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z));
        const fall = this.fallStart - this.y;
        const bouncy = under2 === B.MUSHROOM || under2 === B.SLIME_BLOCK;
        if (bouncy && prevVy < -4 && !this.sneaking) {
          this.vy = Math.min(24, -prevVy * 0.85);
          this.onGround = false;
          CM.Audio.play('bounce');
          g.entities.burst(CM.blockLayers[under2][2], this.x, this.y, this.z, 8, { speed: 3 });
        } else if (fall > 3.6 && !this.inWater && !bouncy && under2 !== B.HAY_BLOCK && under2 !== B.HONEY_BLOCK) {
          this.damage(Math.floor(fall - 3), null, null, 'La gravité');
        }
        if (!wasGround && fall > 1) CM.Audio.play('step', { mat: this.matUnder() });
      }
      if (this.onGround || this.inWater || this.hook || this.flying) {
        this.fallStart = this.y;
        if (this.onGround) this.usedDouble = false;
      } else this.fallStart = Math.max(this.fallStart, this.y);

      // ----- souffle, faim, santé
      this.updateVitals(dt, wasHeadIn);

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

      if (this.y < -30) this.damage(100, null, null, 'Le vide', true);
      if (this.invul <= 0 && this.touching((b) => b.hurts)) this.damage(1, null, null, this.touching((b) => b.id === B.MAGMA) ? 'Le magma' : 'Un cactus');

      // ----- visée, minage, combat, utilisation
      this.updateTarget();
      this.updateActions(dt, input);
    }

    updateVitals(dt, wasHeadIn) {
      const g = this.game;
      if (this.creative) {
        this.air = MAX_AIR;
        this.food = 20;
        this.health = Math.max(this.health, this.maxHealth);
        return;
      }
      if (this.headInWater) {
        this.air = Math.max(0, this.air - dt);
        if (this.air <= 0) {
          this.drownT += dt;
          if (this.drownT > 1) {
            this.drownT = 0;
            this.damage(2, null, null, 'La noyade');
          }
        }
        if (!wasHeadIn) g.ui.toast('Sous l’eau : surveille tes bulles d’air !', 'info', 'water');
      } else this.air = Math.min(MAX_AIR, this.air + dt * 6);
      // Mode paisible : la faim remonte toute seule.
      if (g.difficulty === 'peaceful') {
        this.regenT += dt;
        if (this.regenT >= 1) {
          this.regenT = 0;
          this.food = Math.min(20, this.food + 1);
          if (this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 1);
        }
        return;
      }
      if (this.health > this.maxHealth) this.health = this.maxHealth;
      // Régénération : faim presque pleine (plus rapide avec la saturation ou la pomme dorée).
      if (this.health < this.maxHealth && (this.food >= 18 || this.regenEffect > 0)) {
        const fast = (this.food >= 20 && this.sat > 0) || this.regenEffect > 0;
        this.regenT += dt;
        if (this.regenT >= (fast ? 0.6 : 4)) {
          this.regenT = 0;
          this.health = Math.min(this.maxHealth, this.health + 1);
          if (this.regenEffect <= 0) this.exhaust(fast ? Math.min(6, this.sat + 1) : EXH.heal);
        }
      } else this.regenT = 0;
      // Famine : faim à zéro -> dégâts (s'arrête à 10 PV en facile, 1 en normal).
      if (this.food <= 0) {
        this.starveT += dt;
        if (this.starveT >= 4) {
          this.starveT = 0;
          const floor = g.difficulty === 'easy' ? 10 : g.difficulty === 'normal' ? 1 : 0;
          if (this.health > floor) this.damage(1, null, null, 'La faim', true);
          g.ui.toast('Tu meurs de faim : mange quelque chose !', 'warn', 'starve');
        }
      } else this.starveT = 0;
    }

    // Un bloc qui vérifie test() touche-t-il le joueur ?
    touching(test) {
      const w = this.game.world, e = 0.06;
      const x0 = Math.floor(this.x - this.hw - e), x1 = Math.floor(this.x + this.hw + e);
      const y0 = Math.floor(this.y - e), y1 = Math.floor(this.y + this.h);
      const z0 = Math.floor(this.z - this.hw - e), z1 = Math.floor(this.z + this.hw + e);
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (test(CM.blocks[w.get(x, y, z)])) return true;
      return false;
    }

    matUnder() {
      const id = this.game.world.get(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z));
      return id ? CM.blocks[id].sound : 'stone';
    }

    updateTarget() {
      const e = this.eye(), d = this.look();
      this.target = this.game.world.raycast(e[0], e[1], e[2], d[0], d[1], d[2], this.creative ? 7 : REACH, (id) => id !== B.WATER);
    }

    // ------------------------------------------------------------ grappin --
    fireHook() {
      const g = this.game;
      if (this.hook) {
        this.releaseHook(false);
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
      this.exhaust(EXH.grapple);
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
      if (this.creative) return { time: 0, harvest: false };
      if (b.hardness <= 0) return { time: 0.05, harvest: true };
      const stack = this.game.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      let speed = 1;
      let harvest = b.tier === 0;
      if (info && info.type === 'tool' && b.tool && info.toolType === b.tool) {
        speed = info.speed * (1 + 0.12 * (this.masteryOf(stack) - 1));
        harvest = info.tier >= b.tier;
      }
      let time = (b.hardness * 1.5) / speed;
      if (!harvest) time *= 3.3;
      time /= this.comboMult();
      if (this.inWater && !this.onGround) time *= 2;
      if (!this.onGround && !this.inWater && !this.flying) time *= 1.5;
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
        // autre joueur (combats entre joueurs autorisés par l'hôte)
        const ph = g.net.active ? g.net.raycastPlayer(e, d, 3.6) : null;
        if (ph && (!mh || ph.t < mh.t) && (!this.target || ph.t < this.target.t)) {
          this.attackPlayer(ph.rp);
          this.mining = null;
          return;
        }
        if (mh && (!this.target || mh.t < this.target.t)) {
          this.attack(mh.mob);
          this.mining = null;
          return;
        }
        this.swing = 1;
      }
      // choisir le bloc visé (clic molette)
      if (input.pressed.mouse1 && this.target) this.pickBlock(this.target.id);
      // minage
      if (input.mouse[0] && this.target) {
        const t = this.target;
        const b = CM.blocks[t.id];
        if (!b.unbreakable && b.hardness >= 0) {
          if (this.creative) {
            if (this.breakCd <= 0) {
              this.breakBlock(t.x, t.y, t.z, t.id, false, true);
              this.breakCd = 0.22;
              this.swing = 1;
            }
          } else {
          if (!this.mining || this.mining.x !== t.x || this.mining.y !== t.y || this.mining.z !== t.z || this.mining.id !== t.id) {
            this.mining = { x: t.x, y: t.y, z: t.z, id: t.id, progress: 0, snd: 0, h: b.height };
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
        }
      } else this.mining = null;

      // utilisation (clic droit)
      if (input.mouse[2] && (input.pressed.mouse2 || this.useCd <= 0)) {
        this.use(input);
      }
    }

    // Mode créatif : met le bloc visé dans la main.
    pickBlock(id) {
      const inv = this.game.inventory;
      const drop = CM.blocks[id];
      if (!drop || id === B.WATER) return;
      for (let i = 0; i < 9; i++) {
        if (inv.slots[i] && inv.slots[i].id === id) {
          inv.selected = i;
          return;
        }
      }
      if (!this.creative) return;
      let slot = inv.slots.findIndex((s, i) => i < 9 && !s);
      if (slot < 0) slot = inv.selected;
      inv.slots[slot] = { id, count: 64 };
      inv.selected = slot;
      inv.changed();
    }

    // Dégâts du coup porté avec l'objet en main.
    hitDamage() {
      const stack = this.game.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      let dmg = 1;
      if (info && info.type === 'tool') {
        dmg = info.damage;
        if (info.toolType === 'sword') dmg += Math.floor((this.masteryOf(stack) - 1) / 2);
      }
      if (!this.onGround && this.vy < -1) dmg *= 1.5;
      if (this.dashTime > 0) dmg += 2;
      return dmg;
    }
    attackPlayer(rp) {
      this.attackCd = 0.38;
      this.swing = 1;
      this.exhaust(EXH.attack);
      this.game.net.pvpHit(rp, this.hitDamage());
    }

    attack(mob) {
      const g = this.game;
      const stack = g.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      let dmg = 1;
      if (info && info.type === 'tool') {
        dmg = info.damage;
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
      if (this.creative) dmg = Math.max(dmg, 50);
      this.attackCd = 0.38;
      this.swing = 1;
      this.exhaust(EXH.attack);
      g.entities.hurtMob(mob, dmg, [this.x, this.z]);
      if (crit) g.entities.burst(CM.Textures.layer.white, mob.x, mob.y + mob.h * 0.7, mob.z, 10, { speed: 4, grav: 4, life: 0.5, size: 0.05, emissive: true });
      if (info && info.toolType === 'sword') this.gainXp(stack, mob.dead ? 4 : 1);
    }

    gainXp(stack, n) {
      if (this.creative) return;
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
      if (b.container) g.chestAt(x, y, z); // un coffre de ruine se remplit avant d'être cassé
      w.setBlock(x, y, z, 0);
      if (b.container) g.spillChest(x, y, z);
      g.entities.blockParticles(id, x, y, z, primary ? 16 : 8);
      CM.Audio.play('break', { mat: b.sound });
      g.stats.mined[id] = (g.stats.mined[id] || 0) + 1;
      // plantes, torches et tapis posés dessus tombent aussi
      const above = w.get(x, y + 1, z);
      const ab = CM.blocks[above];
      if (above && (ab.plant || ab.render === 'torch' || above === B.CACTUS || ab.render === 'carpet' || above === B.SUGAR_CANE || above === B.BAMBOO)) {
        this.breakBlock(x, y + 1, z, above, !this.creative, false);
      }
      if (this.creative) return;
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
        g.ui.toast('Il faut une pioche en ' + CM.TIER_NAMES[b.tier] + ' (ou mieux) pour récolter : ' + b.name, 'warn', 'tool' + id);
      }
      this.exhaust(EXH.mine);
      // maîtrise de l'outil
      const stack = g.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      if (info && info.type === 'tool' && info.toolType === b.tool) {
        this.gainXp(stack, b.ore ? 2 : 1);
        // pioche de cristal : minage de filon
        if (info.toolType === 'pickaxe' && info.mat === 'CRYSTAL' && b.ore) this.veinMine(x, y, z, id);
        // hache en fer ou mieux : abat l'arbre entier
        const wood = CM.woodOf(id);
        if (info.toolType === 'axe' && info.tier >= 3 && wood && id === wood.log) this.fellTree(x, y, z, wood);
      }
    }

    fellTree(x, y, z, wood) {
      const w = this.game.world;
      const logs = [];
      const leaves = [];
      const seen = new Set([x + ',' + y + ',' + z]);
      let queue = [[x, y, z]];
      while (queue.length && logs.length < 64) {
        const [cx, cy, cz] = queue.shift();
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = 0; dy <= 1; dy++)
            for (let dz = -1; dz <= 1; dz++) {
              const nx = cx + dx, ny = cy + dy, nz = cz + dz;
              const key = nx + ',' + ny + ',' + nz;
              if (seen.has(key)) continue;
              seen.add(key);
              if (w.get(nx, ny, nz) === wood.log) {
                logs.push([nx, ny, nz]);
                queue.push([nx, ny, nz]);
              }
            }
      }
      if (!logs.length) return;
      // feuillage accroché aux bûches abattues
      queue = logs.slice();
      const depth = new Map(logs.map((l) => [l.join(','), 0]));
      while (queue.length && leaves.length < 200) {
        const c = queue.shift();
        const d = depth.get(c.join(','));
        if (d >= 3) continue;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const n = [c[0] + dx, c[1] + dy, c[2] + dz];
          const key = n.join(',');
          if (depth.has(key)) continue;
          depth.set(key, d + 1);
          if (w.get(n[0], n[1], n[2]) === wood.leaves) {
            leaves.push(n);
            queue.push(n);
          }
        }
      }
      for (const [lx, ly, lz] of logs) this.breakBlock(lx, ly, lz, wood.log, true, false);
      for (const [lx, ly, lz] of leaves) this.breakBlock(lx, ly, lz, wood.leaves, true, false);
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

    // Consomme un objet tenu (sauf en créatif).
    consume(n) {
      if (!this.creative) this.game.inventory.consumeHeld(n || 1);
    }

    use(input) {
      const g = this.game, w = g.world, inv = g.inventory;
      const t = this.target;
      const stack = inv.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      this.useCd = 0.22;
      const sneak = this.sneaking;
      const tb = t ? CM.blocks[t.id] : null;
      // interactions avec le bloc visé (accroupi : on pose un bloc à la place)
      if (input.pressed.mouse2 && t && !(info && info.isBlock && sneak)) {
        if (tb.station) {
          g.ui.openInventory();
          return;
        }
        if (tb.container) {
          g.openChestAt(t.x, t.y, t.z, tb.name);
          return;
        }
        if (tb.note) {
          const n = ((t.x * 7 + t.y * 3 + t.z * 5) % 24 + 24) % 24;
          g.noteBlocks = g.noteBlocks || {};
          const k = t.x + ',' + t.y + ',' + t.z;
          g.noteBlocks[k] = ((g.noteBlocks[k] === undefined ? n : g.noteBlocks[k]) + 1) % 25;
          g.noteFx(t.x, t.y, t.z, g.noteBlocks[k]);
          g.net.noteChanged(t.x, t.y, t.z, g.noteBlocks[k]);
          this.swing = 1;
          return;
        }
        if (tb.tnt && info && (info.type === 'igniter' || stack.id === B.TORCH)) {
          g.primeTnt(t.x, t.y, t.z);
          this.swing = 1;
          return;
        }
      }
      if (!info) return;
      if (info.type === 'food') {
        if (!input.pressed.mouse2) return;
        if (this.food >= 20 && !info.always && !this.creative) {
          g.ui.toast('Tu n’as pas faim.', 'info', 'full');
          return;
        }
        this.food = Math.min(20, this.food + info.food);
        this.sat = Math.min(this.food, this.sat + info.sat);
        if (info.regen) {
          this.regenEffect = info.regen;
          g.ui.toast('Régénération (' + info.regen + ' s)', 'gold');
        }
        this.consume(1);
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
      if (!t) return;
      // outils utilisés sur un bloc
      if (info.type === 'tool') {
        if (!input.pressed.mouse2) return;
        // hache : écorcer une bûche
        const wd = CM.woodOf(t.id);
        if (info.toolType === 'axe' && wd && (t.id === wd.log || t.id === wd.wood)) {
          w.setBlock(t.x, t.y, t.z, t.id === wd.log ? wd.strippedLog : wd.strippedWood);
          CM.Audio.play('break', { mat: 'wood' });
          g.entities.blockParticles(t.id, t.x, t.y, t.z, 8);
          this.swing = 1;
          return;
        }
        // houe : labourer la terre
        if (info.toolType === 'hoe' && (tb.soil || t.id === B.DIRT) && t.id !== B.FARMLAND && !CM.blocks[w.get(t.x, t.y + 1, t.z)].solid) {
          const above = w.get(t.x, t.y + 1, t.z);
          if (above && CM.blocks[above].plant) w.setBlock(t.x, t.y + 1, t.z, 0);
          w.setBlock(t.x, t.y, t.z, B.FARMLAND);
          CM.Audio.play('step', { mat: 'gravel' });
          this.swing = 1;
          this.gainXp(stack, 1);
          return;
        }
        return;
      }
      if (info.type === 'seeds') {
        if (!input.pressed.mouse2) return;
        if (t.id === B.FARMLAND && t.ny === 1 && w.get(t.x, t.y + 1, t.z) === 0) {
          w.setBlock(t.x, t.y + 1, t.z, B.WHEAT_0);
          g.crops.add(t.x + ',' + (t.y + 1) + ',' + t.z);
          this.consume(1);
          CM.Audio.play('place', { mat: 'grass' });
          this.swing = 1;
        } else g.ui.toast('Les graines se plantent sur de la terre labourée (houe + clic droit sur la terre)', 'info', 'seeds');
        return;
      }
      if (info.type === 'bonemeal') {
        if (!input.pressed.mouse2) return;
        if (g.growAt(t.x, t.y, t.z, true)) {
          this.consume(1);
          this.swing = 1;
          g.entities.burst(CM.Textures.layer.white, t.x + 0.5, t.y + 0.8, t.z + 0.5, 12, { speed: 2, grav: -1, life: 0.8, size: 0.06, emissive: true });
        }
        return;
      }
      if (info.type === 'igniter') return;
      if (!info.isBlock || !t) return;
      const b = info.block;
      // dalle posée sur une dalle identique : bloc plein
      if (b.render === 'slab' && t.id === stack.id && t.ny === 1) {
        w.setBlock(t.x, t.y, t.z, b.full);
        this.afterPlace(b, stack.id, t.x, t.y, t.z);
        return;
      }
      // position de pose
      let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
      if (tb.replaceable && t.id !== B.WATER) {
        px = t.x; py = t.y; pz = t.z;
      }
      if (!w.inside(px, py, pz)) return;
      const cur = w.get(px, py, pz);
      if (cur !== 0 && !CM.blocks[cur].replaceable) {
        // dalle posée à côté d'une dalle identique (case déjà occupée par la même dalle)
        if (cur === stack.id && b.render === 'slab') {
          w.setBlock(px, py, pz, b.full);
          this.afterPlace(b, stack.id, px, py, pz);
        }
        return;
      }
      const below = w.get(px, py - 1, pz);
      const bb = CM.blocks[below];
      if (b.plant) {
        if (b.needsFarmland ? below !== B.FARMLAND : b.soilAny ? !bb.solid : !bb.soil) {
          g.ui.toast(b.needsFarmland ? 'Se plante sur de la terre labourée' : b.soilAny ? 'Il faut un bloc solide dessous' : 'Se plante sur de l’herbe ou de la terre', 'warn', 'plant');
          return;
        }
      }
      if (b.render === 'carpet' && !bb.solid) return;
      if (stack.id === B.SUGAR_CANE && below !== B.SUGAR_CANE && !(bb.soil || below === B.SAND || below === B.RED_SAND)) return;
      if (b.needsBelow === 'sand' && below !== B.SAND && below !== B.RED_SAND && below !== B.CACTUS) {
        g.ui.toast('Le cactus se plante sur du sable', 'warn', 'cactus');
        return;
      }
      if (b.render === 'torch') {
        const sup = w.solidAt(px, py - 1, pz) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => w.solidAt(px + dx, py, pz + dz));
        if (!sup || cur === B.WATER) return;
      }
      if (b.solid) {
        const top = py + b.height;
        const hit = (ex, ey, ez, hw, h) => ex + hw > px && ex - hw < px + 1 && ey + h > py && ey < top && ez + hw > pz && ez - hw < pz + 1;
        if (hit(this.x, this.y, this.z, this.hw, this.h)) {
          // un tapis ou une dalle sous les pieds : on se hisse dessus
          if (b.height <= 0.55 && this.y < top && !CM.Physics.overlaps(w, this.x, top + 0.001, this.z, this.hw, this.h)) this.y = top + 0.001;
          else return;
        }
        for (const m of g.entities.mobs) if (hit(m.x, m.y, m.z, m.hw, m.h)) return;
        for (const rp of g.net.remotes.values()) if (rp.seen && rp.alive && hit(rp.x, rp.y, rp.z, rp.hw, rp.h)) return;
      }
      let place = stack.id;
      // poudre de béton au contact de l'eau : béton
      if (b.becomes && [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => w.get(px + dx, py + dy, pz + dz) === B.WATER)) place = b.becomes;
      w.setBlock(px, py, pz, place);
      this.afterPlace(b, stack.id, px, py, pz);
    }

    afterPlace(b, id, px, py, pz) {
      const g = this.game;
      if (CM.TAGS.saplings.includes(id)) g.saplings.add(px + ',' + py + ',' + pz);
      if (b.crop !== undefined) g.crops.add(px + ',' + py + ',' + pz);
      g.stats.placed[id] = (g.stats.placed[id] || 0) + 1;
      CM.Audio.play('place', { mat: b.sound });
      this.swing = 1;
      if (id === B.DAWN_HEART) g.onDawnHeart(px, py, pz);
      this.consume(1);
    }

    damage(n, sx, sz, cause, bypass) {
      const g = this.game;
      if (!this.alive || n <= 0) return;
      if (this.creative && cause !== 'Le vide') return;
      if (this.invul > 0 && !bypass) return;
      if (sx !== null && sx !== undefined) {
        // difficulté : dégâts des créatures
        n *= g.difficulty === 'easy' ? 0.6 : g.difficulty === 'hard' ? 1.4 : 1;
        n = Math.max(1, Math.round(n));
      }
      this.health -= n;
      this.invul = 0.55;
      this.hurtFlash = 0.45;
      this.exhaust(EXH.hurt);
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
      this.flying = false;
      const inv = g.inventory;
      if (!g.keepInventory()) {
        for (let i = 0; i < 36; i++) {
          const s = inv.slots[i];
          if (!s) continue;
          const extra = s.xp !== undefined ? { xp: s.xp } : null;
          g.entities.addDrop(s.id, s.count, this.x, this.y + 1, this.z, extra);
          inv.slots[i] = null;
        }
        inv.changed();
      }
      g.stats.deaths = (g.stats.deaths || 0) + 1;
      g.net.died(cause);
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
      if (!this.game.options.showHand) return;
      const stack = this.game.inventory.held();
      const l = [this.game.world.skyAt(Math.floor(this.x), Math.floor(this.y + 1.6), Math.floor(this.z)) / 15,
        this.game.world.blockLightAt(Math.floor(this.x), Math.floor(this.y + 1.6), Math.floor(this.z)) / 15];
      const sw = Math.sin(Math.min(1, 1 - this.swing) * Math.PI);
      const swingOn = this.swing > 0 ? sw : 0;
      const bobOn = this.game.options.viewBob ? 1 : 0;
      const bx = Math.sin(this.bob) * 0.035 * this.bobAmp * bobOn;
      const by = -Math.abs(Math.cos(this.bob)) * 0.03 * this.bobAmp * bobOn;
      const M = this.M;
      const L = CM.Textures.layer;
      if (!stack) {
        mat4.compose(M, 0.48 + bx - swingOn * 0.12, -0.44 + by + swingOn * 0.08, -0.62 - swingOn * 0.18, 0.3, -1.25 - swingOn * 0.5, 0, 1);
        batch.box(M, -0.07, -0.2, -0.07, 0.07, 0.2, 0.07, L.skin, l[0], l[1], 0);
        batch.box(M, -0.075, -0.52, -0.075, 0.075, -0.2, 0.075, L.sleeve, l[0], l[1], 0);
        return;
      }
      const info = CM.itemInfo(stack.id);
      const r = info.isBlock ? info.block.render : '';
      const cubeish = info.isBlock && (r === 'cube' || r === 'glass' || r === 'tglass' || r === 'slab' || r === 'carpet');
      if (cubeish) {
        mat4.compose(M, 0.44 + bx - swingOn * 0.12, -0.38 + by + swingOn * 0.1, -0.7 - swingOn * 0.2, 0.75 + swingOn * 0.3, 0.12 - swingOn * 0.6, 0, 1);
        const hh = 0.32 * Math.max(info.block.height, 0.1);
        batch.box(M, -0.16, -0.16, -0.16, 0.16, -0.16 + hh, 0.16, CM.blockLayers[stack.id], l[0], l[1], info.block.light ? 1 : 0);
      } else {
        const layer = info.isBlock ? CM.blockLayers[stack.id][0] : L[info.tex];
        mat4.compose(M, 0.52 + bx - swingOn * 0.1, -0.36 + by + swingOn * 0.05, -0.72 - swingOn * 0.15, -0.55, -0.2 - swingOn * 1.1, 0.3, 1);
        const emi = info.isBlock && info.block.light ? 1 : 0;
        batch.box(M, -0.2, -0.2, 0, 0.2, 0.2, 0, [-1, -1, -1, -1, layer, -1], l[0], l[1], emi);
      }
    }

    // Lumière dynamique : tenir une torche ou une lanterne éclaire autour.
    heldLight() {
      const s = this.game.inventory.held();
      if (!s || s.id >= CM.ITEM_BASE) return 0;
      const b = CM.blocks[s.id];
      if (!b) return 0;
      if (b.light >= 12) return 1;
      if (b.light >= 5) return 0.6;
      return 0;
    }
  }

  CM.Player = Player;
})();
