'use strict';
// Joueur : déplacements, faim, souffle, ruée, double saut, grappin, minage, combat, mode créatif.
(function () {
  const B = CM.B;
  const I = CM.I;
  const mat4 = CM.mat4;

  const GRAVITY = 28;
  const REACH = 5;
  const GRAPPLE_RANGE = 34;
  const EAT_TIME = 1; // secondes pour manger n’importe quel aliment
  const MAX_AIR = 15; // secondes de souffle sous l'eau
  // Faim (comme dans Minecraft) : 20 points, saturation, épuisement.
  const EXH = { sprint: 0.1, swim: 0.012, jump: 0.05, sprintJump: 0.2, mine: 0.005, attack: 0.1, hurt: 0.1, heal: 6, dash: 1.2, double: 0.6, grapple: 0.4 };

  // Expérience (comme dans Minecraft) : points à gagner pour passer du niveau L au suivant.
  const xpNeed = (L) => (L <= 15 ? 2 * L + 7 : L <= 30 ? 5 * L - 38 : 9 * L - 158);
  CM.xpNeed = xpNeed;

  class Player {
    constructor(game) {
      this.game = game;
      this.xpTotal = 0; // points d'expérience cumulés (perdus à la mort)
      this.enchSeed = (Math.random() * 4294967296) >>> 0; // fixe les offres de la table d'enchantement
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
      this.dashAir = false; // élan de ruée en l'air (encore dirigeable)
      this.usedDouble = false;
      this.jumpCd = 0;
      this.hook = null;
      this.mining = null;
      this.combo = 0; this.comboTimer = 0; this.lastBreak = -10;
      this.attackCd = 0; this.useCd = 0; this.breakCd = 0;
      this.eating = null; // { id, slot, t } : en train de manger
      this.burning = 0; // en feu (secondes restantes)
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
      this.aimDir = null; // écran tactile : direction du doigt (sinon, le centre de l'écran)
      this.sleeping = null; // { x, y, z, t0 } : couché dans un lit
      this.riding = null; // wagonnet où l'on est assis (identifiant)
      this.bowT = 0; // arc bandé depuis (secondes)
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
    // Direction dans laquelle on vise (le doigt sur écran tactile, sinon le regard).
    aim() {
      return this.aimDir || this.look();
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
      // couché dans un lit : on ne bouge plus (la faim continue)
      if (this.sleeping) {
        const s = this.sleeping;
        this.x = s.x + 0.5;
        this.y = s.y + 9 / 16;
        this.z = s.z + 0.5;
        this.vx = this.vy = this.vz = 0;
        this.fallStart = this.y;
        this.mining = null;
        this.target = null;
        this.eyeOffset = 1.15;
        this.updateVitals(dt, false);
        return;
      }

      const k = input.keys;
      const fx = Math.floor(this.x), fz = Math.floor(this.z);
      this.inWater = CM.isWater(w.get(fx, Math.floor(this.y + 0.4), fz));
      const wasHeadIn = this.headInWater;
      this.headInWater = CM.isWater(w.get(fx, Math.floor(this.y + this.eyeH), fz));
      // lave : on s'y enfonce lentement, on y nage à peine
      this.inLava = CM.isLava(w.get(fx, Math.floor(this.y + 0.4), fz)) || CM.isLava(w.get(fx, Math.floor(this.y + 0.05), fz));
      this.headInLava = CM.isLava(w.get(fx, Math.floor(this.y + this.eyeH), fz));
      this.inFluid = this.inWater || this.inLava;
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
      this.sneaking = !this.flying && !!k[K.sneak] && !this.inFluid;
      // assis dans un wagonnet : on suit le wagonnet (s'accroupir pour descendre)
      if (this.riding !== null && this.riding !== undefined) {
        const c = (g.entities.carts || []).find((o) => o.uid === this.riding && !o.dead);
        if (!c || (!g.net.isClient && c.rider !== 'local') || input.pressed[K.sneak]) this.leaveCart(c);
        else {
          this.x = c.x;
          this.y = c.y + 0.25;
          this.z = c.z;
          this.vx = this.vy = this.vz = 0;
          this.fallStart = this.y;
          this.onGround = true;
          this.flying = this.sneaking = this.sprinting = false;
          this.eyeOffset = 0.3;
          this.cartPush = wl > 0 && f > 0 ? [wx, wz] : null;
          if (g.net.isClient) {
            this.cpushT = (this.cpushT || 0) - dt;
            if (this.cpushT <= 0 && (this.cartPush || this.cpushSent)) {
              this.cpushT = 0.2;
              this.cpushSent = !!this.cartPush;
              g.net.send({ t: 'cpush', v: this.cartPush ? [Math.round(wx * 100) / 100, Math.round(wz * 100) / 100] : [0, 0] });
            }
          }
          this.updateVitals(dt, wasHeadIn);
          this.updateTarget();
          this.updateActions(dt, input);
          return;
        }
      }
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
      if (this.eating) {
        speed = Math.min(speed, 1.6);
        this.sprinting = false;
      }
      if (this.inWater) speed = this.sprinting ? 3.6 : 2.6;
      if (this.inLava) speed = this.sprinting ? 1.6 : 1.2;
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
          this.dashAir = true;
          this.dashCd = 1;
          this.invul = Math.max(this.invul, 0.3);
          this.exhaust(EXH.dash);
          CM.Audio.play('dash');
          g.entities.burst(CM.Textures.layer.white, this.x, this.y + 0.9, this.z, 10, { speed: 2, grav: 0, life: 0.35, size: 0.06 });
        }
      }

      // ----- ruée dirigeable : pendant la poussée, la trajectoire suit les touches de
      // déplacement (ou le regard si aucune n'est appuyée) ; ensuite, l'élan en l'air
      // continue de tourner vers la direction voulue
      if (this.dashTime > 0) {
        if (wl) this.steer(wx, wz, 22 * dt);
        else this.steer(-Math.sin(this.yaw), -Math.cos(this.yaw), 22 * dt);
      } else if (this.dashAir && wl && !this.onGround && !this.inFluid && !this.hook) {
        this.steer(wx, wz, 8 * dt);
      }

      // ----- accélération horizontale
      const px0 = this.x, pz0 = this.z;
      if (this.dashTime <= 0) {
        if (this.flying) {
          this.vx += (wx * speed - this.vx) * Math.min(1, 10 * dt);
          this.vz += (wz * speed - this.vz) * Math.min(1, 10 * dt);
        } else if (this.onGround || this.inFluid) {
          const slip = this.onGround && under.slip;
          const acc = this.inLava ? 5 : this.inWater ? 8 : slip ? 1.2 * (1 - under.slip) * 60 : 16;
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

      // ----- courant : l'eau (et un peu la lave) qui coule entraîne le joueur
      if (this.inFluid && !this.flying) {
        const fv = CM.flowVector(w, fx, Math.floor(this.y + 0.4), fz);
        if (fv) {
          const push = this.inLava ? 3 : 9;
          this.vx += fv[0] * push * dt;
          this.vz += fv[1] * push * dt;
          if (fv[2] < 0) this.vy -= 6 * dt;
        }
      }

      // ----- saut / nage / double saut / vol
      const standBlock = w.get(fx, Math.floor(this.y - 0.05), fz);
      if (this.flying) {
        const up = (k[K.jump] ? 1 : 0) - (k[K.sneak] ? 1 : 0);
        this.vy += (up * 9 - this.vy) * Math.min(1, 10 * dt);
      } else if (this.inLava) {
        if (k[K.jump]) this.vy = Math.min(this.vy + 10 * dt, Math.max(this.vy, 2.2));
        else this.vy = Math.max(this.vy - 5 * dt, -1.6);
        if (k[K.jump] && (this.hitX || this.hitZ) && !this.headInLava) this.vy = 7.5;
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
        } else if (fall > 3.6 && !this.inFluid && !bouncy && under2 !== B.HAY_BLOCK && under2 !== B.HONEY_BLOCK && !CM.isWater(w.get(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z)))) {
          // (atterrir dans l'eau, même versée au dernier moment avec un seau, annule la chute)
          this.damage(Math.floor(fall - 3), null, null, 'La gravité');
        }
        if (!wasGround && fall > 1) CM.Audio.play('step', { mat: this.matUnder() });
      }
      if (this.onGround || this.inFluid || this.hook || this.flying) {
        if (this.dashTime <= 0) this.dashAir = false;
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
          // les pas font vibrer les capteurs de sculk (sauf accroupi, comme dans Minecraft)
          if (!this.sneaking && g.ticks.rs && !g.net.isClient && g.dim === g.playerDim) g.ticks.rs.vibrate(this.x, this.y + 0.5, this.z);
        }
      } else this.bobAmp = Math.max(0, this.bobAmp - dt * 4);

      if (this.y < CM.WORLD.MINY - 30) this.damage(100, null, null, 'Le vide', true);
      if (this.invul <= 0 && this.touching((b) => b.hurts)) this.damage(1, null, null, this.touching((b) => b.id === B.MAGMA) ? 'Le magma' : 'Un cactus');
      // feu : dans les flammes on s'enflamme ; en feu, 1 point de dégât par seconde, l'eau éteint
      if (!this.creative && this.touching((b) => b.fire)) {
        this.burning = Math.max(this.burning || 0, 8);
        if (this.invul <= 0) this.damage(1, null, null, 'Le feu');
      }
      // lave : 4 points de dégâts toutes les demi-secondes et 15 s de brûlure en sortant
      if (!this.creative && (this.inLava || this.touching((b) => b.lava))) {
        this.burning = Math.max(this.burning || 0, 15);
        if (this.invul <= 0) {
          this.damage(4, null, null, 'La lave');
          this.invul = Math.min(this.invul, 0.5);
          CM.Audio.play('burn');
        }
      }
      if (this.burning > 0) {
        this.burning -= dt;
        if (this.inWater || this.creative) this.burning = 0;
        this.burnT = (this.burnT || 0) - dt;
        if (this.burnT <= 0 && this.burning > 0) {
          this.burnT = 1;
          this.damage(1, null, null, 'Le feu', true);
        }
        if (Math.random() < dt * 20) g.entities.burst(CM.Textures.layer.flame, this.x + (Math.random() - 0.5) * 0.6, this.y + Math.random() * 1.6, this.z + (Math.random() - 0.5) * 0.6, 1, { speed: 0.4, grav: -2.5, life: 0.5, size: 0.1, emissive: true });
      }

      // portail du Nether : rester dedans quelques secondes pour voyager
      const inPortal = !g.switching && this.touching((b) => b.portal);
      if (inPortal && !this.portalLock) {
        if (!(this.portalT > 0)) CM.Audio.play('portal');
        this.portalT = (this.portalT || 0) + dt;
        if (this.portalT >= this.portalTime()) {
          this.portalT = 0;
          this.portalLock = true;
          g.enterPortal(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z));
        }
      } else {
        if (!inPortal) this.portalLock = false;
        this.portalT = Math.max(0, (this.portalT || 0) - dt * 2);
      }

      // tapis roulants et ventilateurs (extension Électricité)
      if (CM.Tech) CM.Tech.playerTick(g, this, dt);

      // ----- visée, minage, combat, utilisation
      this.updateTarget();
      this.updateActions(dt, input);
    }

    // Wagonnets : monter, descendre.
    rideCart(c) {
      const g = this.game;
      if (c.type !== 'cart' || (c.rider !== null && c.rider !== undefined)) return false;
      if (g.net.isClient) g.net.send({ t: 'ride', id: c.uid });
      else if (!g.entities.mount(c, 'local')) return false;
      this.riding = c.uid;
      this.mining = null;
      return true;
    }
    leaveCart(c) {
      const g = this.game;
      this.riding = null;
      this.cartPush = null;
      this.eyeOffset = 0;
      if (g.net.isClient) g.net.send({ t: 'unride' });
      else if (c && c.rider === 'local') c.rider = null;
      if (c) this.y = c.y + 0.1;
      this.fallStart = this.y;
    }
    // Arc : la flèche part d'autant plus vite que l'arc a été bandé longtemps (1 s = pleine puissance).
    shootBow() {
      const g = this.game, f = Math.min(1, this.bowT);
      const power = Math.min(1, (f * f + 2 * f) / 3);
      if (power < 0.1) return;
      if (!this.creative && !g.inventory.remove(CM.I.ARROW, 1)) return;
      const e = this.eye(), d = this.aim(), sp = power * 55;
      g.entities.shootArrow(e[0] + d[0] * 0.4, e[1] + d[1] * 0.4 - 0.1, e[2] + d[2] * 0.4, d[0] * sp + this.vx * 0.5, d[1] * sp, d[2] * sp + this.vz * 0.5, this);
      if (g.net.isClient) CM.Audio.play('bow', { pitch: 0.9 + Math.random() * 0.2 });
      this.swing = 1;
    }

    // Tourne la vitesse horizontale vers (tx, tz) sans changer sa valeur. k : part du virage (0-1).
    steer(tx, tz, k) {
      const s = Math.hypot(this.vx, this.vz);
      if (s < 0.01) return;
      const cx = this.vx / s, cz = this.vz / s;
      k = Math.min(1, k);
      let nx = cx + (tx - cx) * k, nz = cz + (tz - cz) * k;
      const n = Math.hypot(nx, nz);
      if (n < 0.15) {
        // demi-tour : on passe directement à la nouvelle direction
        nx = tx;
        nz = tz;
      } else {
        nx /= n;
        nz /= n;
      }
      this.vx = nx * s;
      this.vz = nz * s;
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
        // Apnée (casque) : le souffle dure plus longtemps
        this.air = Math.max(0, this.air - dt / (1 + CM.enchLevel(g.inventory.armor[0], 'respiration')));
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
    portalTime() {
      return this.creative ? 1 : 3.5;
    }
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
      const e = this.eye(), d = this.aim();
      this.target = this.game.world.raycast(e[0], e[1], e[2], d[0], d[1], d[2], this.creative ? 7 : REACH, (id) => !CM.isFluid(id) && !CM.blocks[id].portal);
    }

    // ------------------------------------------------------------ grappin --
    fireHook() {
      const g = this.game;
      if (this.hook) {
        this.releaseHook(false);
        return;
      }
      const e = this.eye(), d = this.aim();
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
        const eff = CM.enchLevel(stack, 'efficiency');
        if (eff) speed += eff * eff + 1; // Efficacité (comme dans Minecraft)
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
      const e = this.eye(), d = this.aim();
      if (this.eating) this.updateEating(dt, input);
      // attaque
      if (input.pressed.mouse0 && this.attackCd <= 0) {
        const mh = g.entities.raycastMob(e[0], e[1], e[2], d[0], d[1], d[2], 3.6);
        // wagonnet : quelques coups le cassent (il rend son objet)
        const ch = g.entities.raycastCart(e[0], e[1], e[2], d[0], d[1], d[2], 3.6);
        if (ch && ch.cart.uid !== this.riding && (!mh || ch.t < mh.t) && (!this.target || ch.t < this.target.t)) {
          g.entities.hitCart(ch.cart, 2);
          this.swing = 1;
          this.attackCd = 0.25;
          this.mining = null;
          return;
        }
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
            this.mining = { x: t.x, y: t.y, z: t.z, id: t.id, progress: 0, snd: 0, box: t.box };
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

      // arc : maintenir le clic droit pour bander, relâcher pour tirer
      const held = g.inventory.held();
      if (held && held.id === CM.I.BOW) {
        if (input.mouse[2] && !g.ui.invOpen && (this.creative || g.inventory.has(CM.I.ARROW))) {
          this.bowT = (this.bowT || 0) + dt;
          return;
        }
        if (this.bowT > 0) this.shootBow();
        this.bowT = 0;
      } else this.bowT = 0;
      // clic droit sur un wagonnet : on monte dedans, ou on ouvre son coffre
      if (input.pressed.mouse2) {
        const ch = g.entities.raycastCart(e[0], e[1], e[2], d[0], d[1], d[2], 4.5);
        if (ch && ch.cart.uid !== this.riding && (!this.target || ch.t < this.target.t)) {
          const c = ch.cart;
          if (c.type === 'chest' || c.type === 'hopper') g.openCartChest(c);
          else if (c.type === 'cart' && (this.riding === null || this.riding === undefined)) this.rideCart(c);
          this.swing = 1;
          return;
        }
      }
      // clic droit sur un villageois : échanges ; sur un animal avec sa nourriture : élevage
      if (input.pressed.mouse2) {
        const vm = g.entities.raycastMob(e[0], e[1], e[2], d[0], d[1], d[2], 4.5);
        if (vm && (!this.target || vm.t < this.target.t)) {
          if (vm.mob.type === 'villager') {
            g.ui.openTrade(vm.mob);
            return;
          }
          if (this.feed(vm.mob)) return;
        }
      }
      // utilisation (clic droit)
      if (input.mouse[2] && (input.pressed.mouse2 || this.useCd <= 0)) {
        this.use(input);
      }
    }

    // Seau : ramasse une case d'eau, ou la verse (l'eau posée ne coule pas).
    useBucket(stack, info) {
      const g = this.game, w = g.world, inv = g.inventory;
      const e = this.eye(), d = this.aim(), reach = this.creative ? 7 : REACH;
      const swap = (id) => {
        if (this.creative) return;
        if (stack.count <= 1) {
          inv.slots[inv.selected] = { id, count: 1 };
          inv.changed();
        } else {
          inv.consumeHeld(1);
          const left = inv.add(id, 1);
          if (left) g.entities.addDrop(id, left, this.x, this.y + 1, this.z);
        }
      };
      if (!info.water && !info.lava) {
        // seule une source se ramasse (le liquide qui coule, non)
        const h = w.raycast(e[0], e[1], e[2], d[0], d[1], d[2], reach, (id) => id === B.WATER || id === B.LAVA || CM.blocks[id].solid);
        if (!h || (h.id !== B.WATER && h.id !== B.LAVA)) return;
        w.setBlock(h.x, h.y, h.z, 0);
        swap(h.id === B.LAVA ? I.LAVA_BUCKET : I.WATER_BUCKET);
        CM.Audio.play(h.id === B.LAVA ? 'burn' : 'splash');
        this.swing = 1;
        return;
      }
      const t = this.target;
      if (!t) return;
      const tb = CM.blocks[t.id];
      let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
      if (tb.replaceable && !CM.isWater(t.id)) {
        px = t.x; py = t.y; pz = t.z;
      }
      const cur = w.get(px, py, pz);
      const fluid = info.lava ? B.LAVA : B.WATER;
      // on peut verser dans un liquide qui coule (il devient une source), pas sur une source
      if (!w.inside(px, py, pz) || (cur !== 0 && !CM.blocks[cur].replaceable) || cur === fluid) return;
      this.swing = 1;
      swap(I.BUCKET);
      // l'eau s'évapore dans le Nether
      if (!info.lava && w.type === 'nether') {
        CM.Audio.play('burn');
        g.entities.burst(CM.Textures.layer.smoke, px + 0.5, py + 0.5, pz + 0.5, 12, { speed: 1, grav: -2, life: 0.9, size: 0.14 });
        return;
      }
      // eau et lave qui se rencontrent : obsidienne (source) ou galets (lave qui coule)
      const other = info.lava ? CM.isWater(cur) : CM.isLava(cur);
      if (other) {
        w.setBlock(px, py, pz, cur === B.WATER || cur === B.LAVA ? B.OBSIDIAN : B.COBBLE);
        CM.Audio.play('burn');
        g.entities.burst(CM.Textures.layer.smoke, px + 0.5, py + 1, pz + 0.5, 8, { speed: 0.6, grav: -2, life: 0.8, size: 0.12 });
        return;
      }
      w.setBlock(px, py, pz, fluid);
      CM.Audio.play(info.lava ? 'burn' : 'splash');
    }

    // Donne à un animal la nourriture tenue (blé : mouflon ; carotte, pomme de terre, betterave : sanglier).
    feed(mob) {
      const g = this.game, stack = g.inventory.held();
      const foods = CM.BREED_FOOD[mob.type];
      if (!stack || !foods || !foods.includes(stack.id)) return false;
      if (g.entities.remote) {
        // invité : l'hôte décide ; on vérifie ce qu'on voit pour ne pas gaspiller
        if ((mob.baby <= 0 && (mob.love > 0 || mob.loveCd > 0)) || mob.dead) return false;
        g.net.feedMob(mob);
        g.entities.hearts(mob, 4);
      } else if (!g.entities.feedMob(mob)) {
        if (mob.loveCd > 0) g.ui.toast('Cet animal a besoin de repos avant un nouveau petit', 'info', 'lovecd');
        return false;
      }
      this.consume(1);
      this.swing = 1;
      this.useCd = 0.3;
      CM.Audio.play('eat');
      return true;
    }

    // Manger prend un moment : on garde le clic droit enfoncé (sur écran tactile, ça continue tout seul).
    startEating(stack, info, input) {
      const g = this.game;
      if (this.food >= 20 && !info.always && !this.creative) {
        if (input.pressed.mouse2) g.ui.toast('Tu n’as pas faim.', 'info', 'full');
        return;
      }
      this.eating = { id: stack.id, slot: g.inventory.selected, t: 0, chew: 0, touch: !!(g.touch && g.touch.enabled) };
    }
    updateEating(dt, input) {
      const g = this.game, ea = this.eating, stack = g.inventory.held();
      if (!this.alive || !stack || stack.id !== ea.id || g.inventory.selected !== ea.slot || (!ea.touch && !input.mouse[2])) {
        this.eating = null;
        return;
      }
      const info = CM.itemInfo(ea.id);
      ea.t += dt;
      ea.chew -= dt;
      if (ea.chew <= 0) {
        ea.chew = 0.24;
        CM.Audio.play('eat');
        const layer = CM.Textures.layer[info.tex];
        g.entities.burst(layer, this.x - Math.sin(this.yaw) * 0.4, this.y + 1.4, this.z - Math.cos(this.yaw) * 0.4, 3, { speed: 1.2, size: 0.05 });
      }
      if (ea.t < EAT_TIME) return;
      this.eating = null;
      this.food = Math.min(20, this.food + info.food);
      this.sat = Math.min(this.food, this.sat + info.sat);
      if (info.regen) {
        this.regenEffect = info.regen;
        g.ui.toast('Régénération (' + info.regen + ' s)', 'gold');
      }
      this.consume(1);
      this.useCd = 0.35;
      CM.Audio.play('pop');
    }

    // Mode créatif : met le bloc visé dans la main.
    pickBlock(id) {
      const inv = this.game.inventory;
      // variantes (porte ouverte, torche murale, culture…) : l'objet correspondant
      if (CM.blocks[id] && CM.blocks[id].hidden) id = CM.blocks[id].drop;
      const drop = CM.blocks[id];
      if (!id || !drop || CM.isWater(id)) return;
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
    // ------------------------------------------------------ expérience --
    levelInfo() {
      let L = 0, left = this.xpTotal;
      while (left >= xpNeed(L)) left -= xpNeed(L++);
      return { level: L, frac: left / xpNeed(L), left };
    }
    get level() {
      return this.levelInfo().level;
    }
    addXp(n) {
      n = Math.round(n);
      if (n <= 0 || this.creative || !this.alive) return;
      const before = this.level;
      this.xpTotal += n;
      const after = this.level;
      if (after > before) {
        CM.Audio.play('level');
        if (after % 5 === 0) this.game.ui.toast('Niveau ' + after + ' !', 'gold');
      } else CM.Audio.play('xp');
    }
    // Dépense des niveaux (table d'enchantement) en gardant la progression du niveau en cours.
    spendLevels(k) {
      const { level, frac } = this.levelInfo();
      const L = Math.max(0, level - k);
      let total = 0;
      for (let i = 0; i < L; i++) total += xpNeed(i);
      this.xpTotal = total + Math.floor(frac * xpNeed(L));
    }

    hitDamage() {
      const stack = this.game.inventory.held();
      const info = stack ? CM.itemInfo(stack.id) : null;
      let dmg = 1;
      if (info && info.type === 'tool') {
        dmg = info.damage;
        if (info.toolType === 'sword') dmg += Math.floor((this.masteryOf(stack) - 1) / 2);
        const sh = CM.enchLevel(stack, 'sharpness');
        if (sh) dmg += 0.5 * sh + 0.5;
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
        const sh = CM.enchLevel(stack, 'sharpness');
        if (sh) dmg += 0.5 * sh + 0.5; // Tranchant
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
      // Recul, Aura de feu, Butin
      const opts = stack && info.type === 'tool' ? { kb: CM.enchLevel(stack, 'knockback'), fire: CM.enchLevel(stack, 'fire'), loot: CM.enchLevel(stack, 'looting') } : null;
      g.entities.hurtMob(mob, dmg, [this.x, this.z], false, this, opts);
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
      // porte : l'autre moitié part avec
      if (b.door) {
        const oy = b.door.half ? y - 1 : y + 1, o = w.get(x, oy, z);
        if (CM.blocks[o].door && CM.blocks[o].door.set === b.door.set) w.setBlock(x, oy, z, 0);
      }
      g.entities.blockParticles(id, x, y, z, primary ? 16 : 8);
      CM.Audio.play('break', { mat: b.sound });
      g.stats.mined[id] = (g.stats.mined[id] || 0) + 1;
      // plantes, torches et tapis posés dessus tombent aussi
      const above = w.get(x, y + 1, z);
      const ab = CM.blocks[above];
      if (above && (ab.plant || (ab.render === 'torch' && !ab.wall) || above === B.CACTUS || ab.render === 'carpet' || above === B.SUGAR_CANE || above === B.BAMBOO || (ab.door && !ab.door.half))) {
        this.breakBlock(x, y + 1, z, above, !this.creative, false);
      }
      // torches murales accrochées à ce bloc
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nid = w.get(x + dx, y, z + dz), nbk = CM.blocks[nid];
        if (nbk.wall && nbk.wall[0] === dx && nbk.wall[1] === dz) this.breakBlock(x + dx, y, z + dz, nid, !this.creative, false);
      }
      if (this.creative) return;
      if (!primary) {
        if (harvest) {
          for (const [did, n] of this.harvestDrops(id, b)) g.entities.addDrop(did, n, x + 0.5, y + 0.4, z + 0.5);
          if (b.ore && !this.silkHeld()) this.addXp(CM.oreXp(id, Math.random));
        }
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
        for (const [did, n] of this.harvestDrops(id, b)) g.entities.addDrop(did, n * mult, x + 0.5, y + 0.4, z + 0.5);
        if (b.ore && !this.silkHeld()) this.addXp(CM.oreXp(id, Math.random));
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

    // Outil en main enchanté ? (Toucher de soie, Fortune)
    silkHeld() {
      const s = this.game.inventory.held();
      return !!s && CM.itemInfo(s.id).type === 'tool' && CM.enchLevel(s, 'silk') > 0;
    }
    // Butin d'un bloc cassé : Toucher de soie (le bloc lui-même), Fortune (plus d'objets des minerais).
    harvestDrops(id, b) {
      const s = this.game.inventory.held();
      const tool = s && CM.itemInfo(s.id).type === 'tool' ? s : null;
      if (CM.enchLevel(tool, 'silk') && !b.plant && !b.hidden && !b.door && !b.container && !b.bed && b.crop === undefined && !b.farmland) return [[id, 1]];
      const drops = CM.blockDrops(id, Math.random);
      const f = CM.enchLevel(tool, 'fortune');
      if (f && b.ore) for (const d of drops) if (d[0] >= CM.ITEM_BASE) d[1] *= 1 + Math.max(0, Math.floor(Math.random() * (f + 2)) - 1);
      return drops;
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
      // objet qui agit sur le bloc visé (multimètre, clé à molette…)
      if (input.pressed.mouse2 && t && info && info.useOn && info.useOn(g, t, this)) {
        this.swing = 1;
        return;
      }
      // interactions avec le bloc visé (accroupi : on pose un bloc à la place)
      if (input.pressed.mouse2 && t && !(info && info.isBlock && sneak)) {
        // bloc qui réagit au clic droit (levier, bouton, répéteur, trappe…)
        if (tb.use && tb.use(g, t, this)) {
          this.swing = 1;
          return;
        }
        if (tb.station) {
          g.ui.openInventory();
          return;
        }
        if (tb.enchanter) {
          g.ui.openEnchant(t.x, t.y, t.z);
          return;
        }
        if (tb.anvil) {
          g.ui.openAnvil(t.x, t.y, t.z);
          return;
        }
        if (tb.door) {
          g.toggleDoor(t.x, t.y, t.z);
          this.swing = 1;
          return;
        }
        if (tb.bed) {
          g.tryBed(t.x, t.y, t.z);
          this.swing = 1;
          return;
        }
        if (tb.container) {
          g.openChestAt(t.x, t.y, t.z, tb.name);
          return;
        }
        if (tb.note) {
          const n = ((t.x * 7 + t.y * 3 + t.z * 5) % 24 + 24) % 24;
          g.noteBlocks = g.noteBlocks || {};
          const k = g.bkey(t.x, t.y, t.z);
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
      // semer : graines, carotte, pomme de terre (clic droit sur le dessus de la terre labourée)
      if (info.plant && input.pressed.mouse2 && t && tb.farmland && t.ny === 1 && w.get(t.x, t.y + 1, t.z) === 0) {
        w.setBlock(t.x, t.y + 1, t.z, info.plant);
        g.crops.add(t.x + ',' + (t.y + 1) + ',' + t.z);
        this.consume(1);
        CM.Audio.play('place', { mat: 'grass' });
        this.swing = 1;
        return;
      }
      if (info.type === 'food') {
        if (!this.eating) this.startEating(stack, info, input);
        return;
      }
      if (info.type === 'bucket') {
        if (input.pressed.mouse2) this.useBucket(stack, info);
        return;
      }
      // armure en main : on l'enfile (échange avec la pièce portée)
      if (info.type === 'armor') {
        if (input.pressed.mouse2 && g.inventory.equipHeld()) {
          CM.Audio.play('equip', { mat: info.mat });
          this.swing = 1;
        }
        return;
      }
      if (info.type === 'grapple') {
        if (input.pressed.mouse2) this.fireHook();
        return;
      }
      // wagonnet : se pose sur un rail
      if (info.type === 'cart') {
        if (!input.pressed.mouse2 || !t) return;
        const rs = tb.rs;
        if (!rs || rs.k !== 'rail') {
          g.ui.toast('Les wagonnets se posent sur des rails', 'info', 'cartrail');
          return;
        }
        g.entities.addCart(info.cart, t.x + 0.5, t.y + 1 / 16, t.z + 0.5);
        this.consume(1);
        CM.Audio.play('place', { mat: 'metal' });
        this.swing = 1;
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
        if (info.toolType === 'hoe' && (tb.soil || t.id === B.DIRT) && !tb.farmland && !CM.blocks[w.get(t.x, t.y + 1, t.z)].solid) {
          const above = w.get(t.x, t.y + 1, t.z);
          if (above && CM.blocks[above].plant) w.setBlock(t.x, t.y + 1, t.z, 0);
          g.till(t.x, t.y, t.z);
          CM.Audio.play('step', { mat: 'gravel' });
          this.swing = 1;
          this.gainXp(stack, 1);
          return;
        }
        return;
      }
      if (info.type === 'seeds') {
        if (input.pressed.mouse2) g.ui.toast('Les graines se plantent sur de la terre labourée (houe + clic droit sur la terre)', 'info', 'seeds');
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
      // briquet : allume un feu sur la face visée (la TNT, elle, s'amorce plus haut)
      if (info.type === 'igniter') {
        if (!input.pressed.mouse2) return;
        let fx2 = t.x + t.nx, fy2 = t.y + t.ny, fz2 = t.z + t.nz;
        if (tb.replaceable && !CM.isWater(t.id) && !tb.fire) {
          fx2 = t.x; fy2 = t.y; fz2 = t.z;
        }
        const cur = w.get(fx2, fy2, fz2);
        if (!w.inside(fx2, fy2, fz2) || CM.isFluid(cur) || (cur !== 0 && !CM.blocks[cur].replaceable)) return;
        // dans un cadre d'obsidienne : le portail du Nether s'allume
        if (g.tryLightPortal(fx2, fy2, fz2)) {
          CM.Audio.play('ignite');
          this.swing = 1;
          return;
        }
        const under = CM.blocks[w.get(fx2, fy2 - 1, fz2)];
        const flamNear = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => CM.blocks[w.get(fx2 + dx, fy2 + dy, fz2 + dz)].flam);
        if (!under.solid && !flamNear) return;
        w.setBlock(fx2, fy2, fz2, B.FIRE);
        CM.Audio.play('ignite');
        this.swing = 1;
        return;
      }
      // bloc à poser (un objet peut en poser un : poudre de redstone, ficelle…)
      const pid = info.isBlock ? stack.id : info.places;
      if (!pid || !t) return;
      const b = CM.blocks[pid];
      // dalle posée sur une dalle identique : bloc plein
      if (b.render === 'slab' && b.full && t.id === stack.id && t.ny === 1) {
        w.setBlock(t.x, t.y, t.z, b.full);
        this.afterPlace(b, stack.id, t.x, t.y, t.z);
        return;
      }
      // position de pose
      let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
      if (tb.replaceable && !CM.isWater(t.id)) {
        px = t.x; py = t.y; pz = t.z;
      }
      if (!w.inside(px, py, pz)) return;
      const cur = w.get(px, py, pz);
      if (cur !== 0 && !CM.blocks[cur].replaceable) {
        // dalle posée à côté d'une dalle identique (case déjà occupée par la même dalle)
        if (cur === stack.id && b.render === 'slab' && b.full) {
          w.setBlock(px, py, pz, b.full);
          this.afterPlace(b, stack.id, px, py, pz);
        }
        return;
      }
      const below = w.get(px, py - 1, pz);
      const bb = CM.blocks[below];
      if (b.plant) {
        if (b.needsFarmland ? !bb.farmland : b.soilAny ? !bb.solid : !bb.soil) {
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
      // torche : posée sur le dessus d'un bloc plein, ou accrochée au mur visé
      if (b.render === 'torch') {
        if (CM.isFluid(cur)) return;
        const full = (x, y, z) => w.colBox(x, y, z) === CM.FULL_BOX;
        let tid = 0;
        if (t.ny === 0 && !tb.replaceable && full(t.x, t.y, t.z)) tid = CM.wallTorch(pid, t.nx, t.nz);
        else if (full(px, py - 1, pz)) tid = pid;
        else {
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (full(px - dx, py, pz - dz)) {
              tid = CM.wallTorch(pid, dx, dz);
              break;
            }
          }
        }
        if (!tid) return;
        w.setBlock(px, py, pz, tid);
        this.afterPlace(b, stack.id, px, py, pz);
        return;
      }
      // porte : deux cases libres, tournée face au joueur
      if (b.door) {
        const up = w.get(px, py + 1, pz);
        if (!bb.solid || !w.inside(px, py + 1, pz) || (up !== 0 && !CM.blocks[up].replaceable)) return;
        const inDoor = (ex, ey, ez, hw, h) => ex + hw > px && ex - hw < px + 1 && ey + h > py && ey < py + 2 && ez + hw > pz && ez - hw < pz + 1;
        if (inDoor(this.x, this.y, this.z, this.hw, this.h)) return;
        for (const m of g.entities.mobs) if (inDoor(m.x, m.y, m.z, m.hw, m.h)) return;
        const axis = Math.abs(Math.cos(this.yaw)) >= Math.abs(Math.sin(this.yaw)) ? 0 : 1;
        w.setBlock(px, py, pz, b.door.set[axis * 2]);
        w.setBlock(px, py + 1, pz, b.door.set[4 + axis * 2]);
        this.afterPlace(b, stack.id, px, py, pz);
        return;
      }
      if (b.col) {
        const c = b.col, top = py + c[4];
        const hit = (ex, ey, ez, hw, h) => ex + hw > px + c[0] && ex - hw < px + c[3] && ey + h > py + c[1] && ey < top && ez + hw > pz + c[2] && ez - hw < pz + c[5];
        if (hit(this.x, this.y, this.z, this.hw, this.h)) {
          // un tapis ou une dalle sous les pieds : on se hisse dessus
          if (c[4] <= 0.55 && this.y < top && !CM.Physics.overlaps(w, this.x, top + 0.001, this.z, this.hw, this.h)) this.y = top + 0.001;
          else return;
        }
        for (const m of g.entities.mobs) if (hit(m.x, m.y, m.z, m.hw, m.h)) return;
        for (const rp of g.net.remotes.values()) if (rp.seen && rp.alive && rp.dim === g.playerDim && hit(rp.x, rp.y, rp.z, rp.hw, rp.h)) return;
      }
      let place = pid;
      // blocs orientés ou soumis à une règle de pose (redstone, rails, trappes…)
      if (b.place) {
        const e = this.eye(), d = this.aim();
        place = b.place({ w, x: px, y: py, z: pz, t, look6: CM.lookDir6(d[0], d[1], d[2]), lookH: CM.lookDirH(d[0], d[2]), hitY: e[1] + d[1] * t.t, player: this });
        if (!place) return;
      }
      // enclume : tournée selon le regard
      if (b.anvil) place = CM.ANVILS[Math.abs(Math.cos(this.yaw)) >= Math.abs(Math.sin(this.yaw)) ? 0 : 1];
      // poudre de béton au contact de l'eau : béton
      if (b.becomes && [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => CM.isWater(w.get(px + dx, py + dy, pz + dz)))) place = b.becomes;
      w.setBlock(px, py, pz, place);
      // un rail se relie aux rails voisins
      if (CM.blocks[place].rs && CM.blocks[place].rs.k === 'rail') CM.railFixNeighbors(w, px, py, pz);
      this.afterPlace(b, stack.id, px, py, pz);
    }

    afterPlace(b, id, px, py, pz) {
      const g = this.game;
      if (CM.TAGS.saplings.includes(id)) g.saplings.add(px + ',' + py + ',' + pz);
      if (b.crop !== undefined) g.crops.add(px + ',' + py + ',' + pz);
      if (b.farmland) g.farmland.add(px + ',' + py + ',' + pz);
      g.stats.placed[id] = (g.stats.placed[id] || 0) + 1;
      CM.Audio.play('place', { mat: b.sound });
      this.swing = 1;
      if (id === B.DAWN_HEART) g.onDawnHeart(px, py, pz);
      // citrouille sur un T de blocs de fer : golem de fer
      if (id === B.JACK_O_LANTERN || id === B.CARVED_PUMPKIN || id === B.PUMPKIN) g.tryBuildGolem(px, py, pz);
      this.consume(1);
    }

    // attacker : créature qui frappe (pour les Épines).
    damage(n, sx, sz, cause, bypass, attacker) {
      const g = this.game;
      if (!this.alive || n <= 0) return;
      if (this.sleeping && !(this.creative && cause !== 'Le vide')) g.wake('hurt');
      if (this.creative && cause !== 'Le vide') return;
      if (this.invul > 0 && !bypass) return;
      if (sx !== null && sx !== undefined) {
        // difficulté : dégâts des créatures
        n *= g.difficulty === 'easy' ? 0.6 : g.difficulty === 'hard' ? 1.4 : 1;
        n = Math.max(1, Math.round(n));
        // créatures, explosions, autres joueurs : l'armure encaisse (pas la chute, la faim ou la noyade)
        n = this.armorAbsorb(n);
      }
      n = this.enchantProtect(n, cause);
      if (attacker && !attacker.dead) this.thorns(attacker);
      this.health -= n;
      // (la brûlure qui dure ne protège pas des autres coups)
      if (!(bypass && cause === 'Le feu')) this.invul = 0.55;
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

    // Armure portée : réduit les dégâts (formule de Minecraft, 80 % au plus) et s'use à chaque coup.
    armorAbsorb(n) {
      const g = this.game, inv = g.inventory;
      const pts = inv.armorPoints();
      if (pts <= 0) return n;
      const tough = inv.armorToughness();
      const f = Math.min(20, Math.max(pts / 5, pts - n / (2 + tough / 4)));
      const wear = Math.max(1, Math.floor(n / 4));
      inv.armor.forEach((s, k) => {
        if (!s) return;
        const info = CM.itemInfo(s.id);
        // Solidité : chance de ne pas s'user (armure : 60 % + 40 % / (niveau + 1))
        const u = CM.enchLevel(s, 'unbreaking');
        if (u && Math.random() >= 0.6 + 0.4 / (u + 1)) return;
        s.xp = (s.xp || 0) + wear;
        const left = info.maxDur - s.xp;
        const warnAt = Math.max(5, Math.floor(info.maxDur * 0.1));
        const plural = k >= 2, nm = info.name.charAt(0).toLowerCase() + info.name.slice(1); // jambières, bottes
        if (left <= 0) {
          inv.armor[k] = null;
          g.ui.toast(plural ? 'Tes ' + nm + ' se sont cassées !' : 'Ton ' + nm + ' s’est cassé !', 'warn');
          CM.Audio.play('break', { mat: info.mat === 'LEATHER' ? 'wool' : 'metal' });
          g.entities.burst(CM.Textures.layer[info.tex], this.x, this.y + 1.2 - k * 0.35, this.z, 12, { speed: 3, size: 0.08 });
        } else if (left <= warnAt && left + wear > warnAt) g.ui.toast((plural ? 'Tes ' + nm + ' sont presque usées' : 'Ton ' + nm + ' est presque usé') + ' (' + left + '/' + info.maxDur + ')', 'warn');
      });
      inv.changed();
      return Math.round(n * (1 - f / 25) * 2) / 2;
    }

    // Protection (toutes les pièces) et Chute amortie (bottes) : −4 % par point, 80 % au plus.
    enchantProtect(n, cause) {
      if (cause === 'Le vide' || cause === 'La faim' || cause === 'La noyade') return n;
      const inv = this.game.inventory;
      let epf = 0;
      for (const s of inv.armor) epf += CM.enchLevel(s, 'protection');
      if (cause === 'La gravité') epf += 3 * CM.enchLevel(inv.armor[3], 'feather');
      if (!epf) return n;
      return Math.round(n * (1 - Math.min(20, epf) / 25) * 2) / 2;
    }
    // Épines (plastron) : blesse la créature qui frappe (et use un peu plus le plastron).
    thorns(m) {
      const s = this.game.inventory.armor[1];
      const t = CM.enchLevel(s, 'thorns');
      if (!t || Math.random() >= 0.15 * t) return;
      this.game.entities.hurtMob(m, 1 + Math.floor(Math.random() * 4), [this.x, this.z], false, this);
      s.xp = (s.xp || 0) + 2;
      if (s.xp >= CM.itemInfo(s.id).maxDur) this.game.inventory.armor[1] = null;
      this.game.inventory.changed();
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
          const extra = CM.stackExtra(s);
          g.entities.addDrop(s.id, s.count, this.x, this.y + 1, this.z, extra);
          inv.slots[i] = null;
        }
        inv.armor.forEach((s, k) => {
          if (s) g.entities.addDrop(s.id, 1, this.x, this.y + 1, this.z, CM.stackExtra(s) || { xp: 0 });
          inv.armor[k] = null;
        });
        inv.changed();
      }
      if (!g.keepInventory()) this.xpTotal = 0;
      g.stats.deaths = (g.stats.deaths || 0) + 1;
      g.net.died(cause);
      g.ui.showDeath(cause);
    }

    respawn() {
      const g = this.game, w = g.world;
      // mort dans le Nether : comme dans Minecraft, retour au monde normal (lit ou départ)
      if (g.dim === 'nether') {
        const rs = g.respawnPoint();
        g.ui.hideDeath();
        this.reset({ x: rs.x, y: rs.y, z: rs.z });
        // invité : l'hôte renvoie le monde normal à jour
        if (g.net.isClient) g.net.requestRespawn(rs);
        else g.changeDim('overworld', { at: { x: rs.x, y: rs.y, z: rs.z }, quiet: true, then: () => this.respawn() });
        return;
      }
      // lit : on y réapparaît s'il existe encore
      const bed = this.bed;
      if (bed) {
        w.stream(bed[0], bed[2], 2, 0);
        if (w.loaded(bed[0], bed[2]) && CM.blocks[w.get(bed[0], bed[1], bed[2])].bed) {
          this.reset({ x: bed[0] + 0.5, y: bed[1] + 9 / 16 + 0.01, z: bed[2] + 0.5 });
          g.ui.hideDeath();
          return;
        }
        this.bed = null;
        g.ui.toast('Ton lit a disparu : retour au point de départ du monde', 'warn');
      }
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
        if (this.eating) {
          // porté à la bouche, petits mouvements de mastication
          const k = Math.min(1, this.eating.t / 0.15), chew = Math.abs(Math.sin(this.eating.t * 16)) * 0.035 * k;
          mat4.compose(M, 0.52 - 0.36 * k, -0.36 + 0.1 * k - chew, -0.72 + 0.2 * k, -0.55 + 0.4 * k, -0.2 + 0.25 * k, 0.3, 1);
        } else mat4.compose(M, 0.52 + bx - swingOn * 0.1, -0.36 + by + swingOn * 0.05, -0.72 - swingOn * 0.15, -0.55, -0.2 - swingOn * 1.1, 0.3, 1);
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
