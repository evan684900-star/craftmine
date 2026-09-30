'use strict';
// Véhicules (extension) : ce sont des « wagonnets » (carts.js) d'un type de CM.VEH. L'hôte les simule
// quand personne ne conduit ; le conducteur (hôte ou invité) pilote sa copie et envoie sa position.
// Conduite (voitures, moto, quad, camion), vol (hélicoptère, avion), bateau à moteur ; carburant,
// dégâts et explosion, passagers, klaxon et sirène, peinture, benne du camion, caméra de derrière,
// compteur, sons ; modèles 3D.
(function () {
  const E = CM.Entities.prototype, mat4 = CM.mat4;
  const r2 = (v) => Math.round(v * 100) / 100;
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const wrap = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const isVeh = (c) => !!(c && CM.VEH[c.type]);
  const FUEL_USE = 0.16; // % par seconde à plein régime

  const V = (CM.Vehicles = {
    isVeh,
    // État par défaut d'un véhicule posé.
    init(c) {
      const d = CM.VEH[c.type];
      c.hw = d.hw;
      c.h = d.h;
      if (c.vhp === undefined) c.vhp = d.hp;
      if (c.fuel === undefined) c.fuel = 60;
      if (c.color === undefined) c.color = d.color;
      if (!Array.isArray(c.pax)) c.pax = [];
      if (d.chest && !c.slots) c.slots = new Array(d.chest).fill(null);
      c.spd = c.spd || 0;
      c.steer = 0;
      c.rot = 0;
      c.thr = c.thr || 0;
      c.pitchV = c.pitchV || 0;
      if (d.cannon) {
        if (c.tyaw === undefined) c.tyaw = c.yaw || 0; // tourelle (cap et hausse du canon)
        c.tpitch = c.tpitch || 0;
        c.reload = 0;
      }
      c.hp = 999; // (les coups de carts.js passent par vehicles.js)
    },
    seatsFree(c) {
      const d = CM.VEH[c.type];
      return (c.rider === null || c.rider === undefined ? 1 : 0) + Math.max(0, d.seats.length - 1 - (c.pax || []).length);
    },
    // Place de celui qui est à bord : 0 conducteur, 1.. passagers, -1 pas à bord.
    seatOf(c, who) {
      if (c.rider === who) return 0;
      const i = (c.pax || []).indexOf(who);
      return i < 0 ? -1 : i + 1;
    },
    // Position d'une place dans le monde.
    seatPos(c, i) {
      const d = CM.VEH[c.type], s = d.seats[Math.min(i, d.seats.length - 1)];
      const cy = Math.cos(c.yaw || 0), sy = Math.sin(c.yaw || 0);
      // repère du véhicule : avant = -z local ; x local vers la droite
      const wx = s[0] * cy + s[2] * sy, wz = -s[0] * sy + s[2] * cy;
      return [c.x + wx, c.y + s[1], c.z + wz];
    },

    // ------------------------------------------------------------ physique --
    // Un pas de simulation. ctl : { thr (-1..1), steer (-1..1), up (-1..1), brake } ou null.
    step(g, c, dt, ctl) {
      const d = CM.VEH[c.type], w = g.world;
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
      let vf = c.vx * fx + c.vz * fz, sx = c.vx - fx * vf, sz = c.vz - fz * vf;
      const fuelOk = c.fuel > 0 || g.mode === 'creative';
      const thr = ctl && fuelOk ? ctl.thr : 0;
      const bx = Math.floor(c.x), bz = Math.floor(c.z);
      const under = CM.blocks[w.get(bx, Math.floor(c.y - 0.08), bz)];
      const wetAt = (y) => CM.isWater(w.get(bx, Math.floor(y), bz));
      const inWater = wetAt(c.y + 0.3);
      if (d.fly) return this.fly(g, c, dt, ctl, fuelOk, vf, sx, sz, fx, fz);
      if (d.water) {
        // bateau à moteur : flotte, file sur l'eau, s'échoue sur terre
        const surf = wetAt(c.y + 0.05) || wetAt(c.y - 0.3);
        const maxV = surf ? d.maxV : 1.2;
        vf += thr * d.acc * dt * (thr < 0 ? 0.6 : 1);
        vf *= Math.pow(surf ? 0.55 : 0.02, dt);
        vf = Math.max(-maxV * 0.35, Math.min(maxV, vf));
        const turn = ctl ? ctl.steer * d.turn * Math.min(1, Math.abs(vf) / 4 + 0.25) : 0;
        c.yaw = wrap(c.yaw - turn * dt * Math.sign(vf || 1));
        sx *= Math.pow(0.05, dt);
        sz *= Math.pow(0.05, dt);
        // flottaison : la coque juste sous la surface de l'eau
        let top = Math.floor(c.y + 1);
        while (top > c.y - 2 && !wetAt(top)) top--;
        if (wetAt(top)) {
          const s = top + 1;
          c.vy += ((s - 0.35 - c.y) * 30 - c.vy * 6) * dt;
        } else c.vy -= 28 * dt;
        if (surf && Math.abs(vf) > 6 && Math.random() < dt * 20) g.entities.burst(CM.Textures.layer.white, c.x - fx * 1.3, c.y + 0.3, c.z - fz * 1.3, 2, { speed: 2, grav: 8, life: 0.5, size: 0.08 });
        c.vx = fx * vf + sx;
        c.vz = fz * vf + sz;
        c.spd = vf;
        this.move(g, c, dt, 0.6);
        return;
      }
      // ---- véhicules à roues
      const ice = !!under && (under.slip || /ICE/.test(under.key));
      const soft = !!under && !d.offroad && (/SAND|SNOW|MUD|SOUL|GRAVEL/.test(under.key) || under.slow);
      let maxV = d.maxV * (soft ? 0.55 : 1) * (inWater ? 0.2 : 1);
      if (c.onGround) {
        if (thr > 0) vf += (vf < -0.5 ? d.acc * 2 : d.acc) * thr * dt;
        else if (thr < 0) vf += (vf > 0.5 ? d.acc * 2.2 : d.acc * 0.6) * thr * dt;
        else vf *= Math.pow(ice ? 0.9 : 0.45, dt); // roue libre
        if (ctl && ctl.brake) vf *= Math.pow(0.08, dt);
        vf = Math.max(-maxV * 0.35, Math.min(maxV, vf));
        // virage : impossible à l'arrêt, plus serré à basse vitesse
        const steer = ctl ? ctl.steer : 0;
        c.steer += (steer - c.steer) * Math.min(1, dt * 8);
        const k = d.tracked ? 1 : Math.min(1, Math.abs(vf) / 5) * (1 - Math.min(0.45, Math.abs(vf) / d.maxV * 0.45));
        // (chenilles : il tourne même à l'arrêt ; en marche arrière, le virage s'inverse)
        const dir = d.tracked ? (vf < -0.5 ? -1 : 1) : Math.sign(vf);
        c.yaw = wrap(c.yaw - c.steer * d.turn * k * dir * dt);
        // adhérence : la glace et le frein à main font déraper
        const grip = ice ? 0.35 : ctl && ctl.brake ? 0.55 : d.grip;
        const keep = Math.pow(1 - grip, dt * 6);
        sx *= keep;
        sz *= keep;
      } else {
        vf *= Math.pow(0.97, dt);
      }
      c.vx = fx * vf + sx;
      c.vz = fz * vf + sz;
      c.spd = vf;
      c.vy = Math.max(c.vy - 28 * dt, -40);
      this.move(g, c, dt, d.step || 0);
    },
    // Déplacement avec montée des marches (step : hauteur franchie).
    move(g, c, dt, step) {
      const w = g.world, sp = Math.hypot(c.vx, c.vz);
      const ox = c.x, oz = c.z, oy = c.y;
      CM.Physics.move(w, c, c.vx * dt, c.vy * dt, c.vz * dt);
      if (c.hitY) c.vy = 0;
      c.onGround = !!c.landed;
      if ((c.hitX || c.hitZ) && step > 0 && sp > 0.5) {
        // un bloc devant : on essaie de monter dessus
        const up = Math.ceil(step);
        for (let h = 0.55; h <= up + 0.05; h += 0.5) {
          const nx = ox + c.vx * dt, nz = oz + c.vz * dt, ny = Math.floor(oy + 0.01) + h + 0.01;
          if (h > step + 0.05) break;
          if (!CM.Physics.overlaps(w, nx, ny, nz, c.hw, c.h)) {
            c.x = nx;
            c.y = ny;
            c.z = nz;
            c.hitX = c.hitZ = false;
            return;
          }
        }
      }
      // char : il écrase ce qui est fragile devant lui (feuilles, verre, cactus, citrouilles…)
      if ((c.hitX || c.hitZ) && CM.VEH[c.type].crush && sp > 0.5 && this.crush(g, c)) return;
      // choc contre un mur à pleine vitesse : le véhicule s'abîme
      if ((c.hitX || c.hitZ) && sp > 9 && !g.net.isClient) this.damage(g, c, (sp - 9) * 2.5, 'crash');
      if (c.hitX) c.vx *= -0.15;
      if (c.hitZ) c.vz *= -0.15;
      // (sur la route, la vitesse perdue dans le choc est reportée)
      if (c.hitX || c.hitZ) c.spd *= 0.3;
    },
    // Blocs fragiles devant le char : ils volent en éclats (true s'il y en avait).
    crush(g, c) {
      const w = g.world, d = CM.VEH[c.type], fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), s = Math.sign(c.spd || 1);
      let n = 0;
      for (let side = -1; side <= 1; side++)
        for (let y = Math.floor(c.y + 0.05); y < c.y + d.h; y++) {
          const x = Math.floor(c.x + fx * s * (d.hw + 0.4) + Math.cos(c.yaw) * side * d.hw * 0.8);
          const z = Math.floor(c.z + fz * s * (d.hw + 0.4) - Math.sin(c.yaw) * side * d.hw * 0.8);
          const id = w.get(x, y, z), b = CM.blocks[id];
          if (!id || !b || b.unbreakable || !(/LEAVES|GLASS|ICE$|CACTUS|PUMPKIN|MELON|HAY|BAMBOO|WOOL|SNOW/.test(b.key) || b.plant) || b.hardness > 1) continue;
          w.setBlock(x, y, z, 0);
          const lay = CM.blockLayers[id] && CM.blockLayers[id][0];
          if (lay !== undefined) g.entities.burst(lay, x + 0.5, y + 0.5, z + 0.5, 6, { speed: 3, size: 0.08 });
          CM.Audio.play('break', { mat: b.sound });
          n++;
        }
      return n > 0;
    },
    // Char : la tourelle suit le regard du pilote ; clic gauche : un obus (un obus de char par tir).
    turret(p, c, dt, input) {
      const g = p.game, inv = g.inventory;
      const want = wrap(p.yaw - c.tyaw);
      c.tyaw = wrap(c.tyaw + Math.max(-1.4 * dt, Math.min(1.4 * dt, want)));
      const wp = Math.max(-0.12, Math.min(0.5, p.pitch + 0.08));
      c.tpitch += Math.max(-0.8 * dt, Math.min(0.8 * dt, wp - c.tpitch));
      c.reload = Math.max(0, (c.reload || 0) - dt);
      if (!input.pressed.mouse0 || g.ui.invOpen) return;
      if (c.reload > 0) return g.ui.toast('Canon en rechargement…', 'info', 'tank');
      if (!p.creative && !inv.has(CM.I.TANK_SHELL)) return g.ui.toast('Il faut un obus de char (établi de mécanicien)', 'warn', 'tank');
      if (!p.creative) inv.remove(CM.I.TANK_SHELL, 1);
      c.reload = 3.5;
      const cp = Math.cos(c.tpitch), dir = [-Math.sin(c.tyaw) * cp, Math.sin(c.tpitch), -Math.cos(c.tyaw) * cp];
      const t = this.turretBase(c), mz = [t[0] + dir[0] * 3.3, t[1] + dir[1] * 3.3, t[2] + dir[2] * 3.3];
      g.entities.shootArrow(mz[0], mz[1], mz[2], dir[0] * 48, dir[1] * 48 + 1, dir[2] * 48, p, 'shell', 0, { np: 1 });
      // recul, fumée, bruit
      c.vx -= dir[0] * 2;
      c.vz -= dir[2] * 2;
      p.pitch = Math.min(1.55, p.pitch + 0.05);
      g.entities.burst(CM.Textures.layer.smoke, mz[0], mz[1], mz[2], 12, { speed: 2.5, grav: -0.6, life: 1.1, size: 0.22 });
      g.entities.burst(CM.Textures.layer.muzzle, mz[0], mz[1], mz[2], 6, { speed: 3, grav: 0, life: 0.15, size: 0.3, emissive: true });
      CM.Audio.play('gun', { g: 'cannon' });
      if (g.net.isClient) g.net.send({ t: 'vact', id: c.uid, a: 'cannon' });
      else this.fxAll(g, { k: 'veh_cannon', x: r2(mz[0]), y: r2(mz[1]), z: r2(mz[2]) });
    },
    // Pivot de la tourelle (dans le monde).
    turretBase(c) {
      const cy = Math.cos(c.yaw || 0), sy = Math.sin(c.yaw || 0), lz = 0.1;
      return [c.x + lz * sy, c.y + 1.75, c.z + lz * cy];
    },
    // L'équipage d'un char est à l'abri des coups venus de dehors (créatures, explosions, balles).
    armored(p) {
      if (!p || p.riding === null || p.riding === undefined) return false;
      const c = p.game.entities.cartByUid && p.game.entities.cartByUid(p.riding);
      return !!(c && CM.VEH[c.type] && CM.VEH[c.type].cannon);
    },
    // Hélicoptère et avion.
    fly(g, c, dt, ctl, fuelOk, vf, sx, sz, fx, fz) {
      const d = CM.VEH[c.type];
      if (d.fly === 'heli') {
        c.rot = (c.rot || 0) + dt * (fuelOk && (ctl || !c.onGround) ? 28 : c.onGround ? 0 : 14);
        const tv = ctl && fuelOk ? ctl.thr * d.maxV : 0;
        vf += (tv - vf) * Math.min(1, dt * 1.6);
        sx *= Math.pow(0.2, dt);
        sz *= Math.pow(0.2, dt);
        if (ctl) c.yaw = wrap(c.yaw - ctl.steer * d.turn * dt);
        const tvy = !fuelOk ? -5 : ctl ? ctl.up * d.climb : c.onGround ? -2 : -0.8;
        c.vy += (tvy - c.vy) * Math.min(1, dt * 3);
        c.pitchV = -vf / d.maxV * 0.25; // penché en avant quand il avance
      } else {
        // avion : les gaz (avancer / reculer) règlent la vitesse ; il suit le regard du pilote
        if (ctl && fuelOk) c.thr = Math.max(0, Math.min(1, c.thr + ctl.thr * dt * 0.6));
        else if (!fuelOk) c.thr = Math.max(0, c.thr - dt * 0.3);
        const target = c.thr * d.maxV;
        vf += (target - vf) * Math.min(1, dt * (c.onGround ? 0.8 : 0.4));
        if (c.onGround && ctl && ctl.brake) vf *= Math.pow(0.1, dt);
        c.rot = (c.rot || 0) + dt * (4 + vf * 2);
        const fast = vf > d.minV;
        if (ctl) {
          // cap : touches gauche / droite et regard du pilote
          const want = ctl.look !== undefined ? wrap(ctl.look - c.yaw) : 0;
          const turn = (-ctl.steer * d.turn + (Math.abs(want) > 0.05 ? Math.sign(want) * Math.min(Math.abs(want), 1) * 0.9 : 0)) * (fast || c.onGround ? 1 : 0.5);
          c.yaw = wrap(c.yaw + turn * dt);
          c.roll = (c.roll || 0) + ((c.onGround ? 0 : -turn * 0.35) - (c.roll || 0)) * Math.min(1, dt * 3);
        }
        // tangage : vers là où regarde le pilote, seulement assez vite
        const wantPitch = ctl && fast ? Math.max(-0.55, Math.min(0.55, ctl.pitch || 0)) : c.onGround ? 0 : -0.25;
        c.pitchV += (wantPitch - c.pitchV) * Math.min(1, dt * 1.5);
        if (c.onGround && c.pitchV < 0) c.pitchV = 0;
        sx *= Math.pow(0.05, dt);
        sz *= Math.pow(0.05, dt);
        const lift = fast ? 1 : Math.max(0, vf / d.minV) ** 2;
        c.vy = Math.sin(c.pitchV) * vf * (fast ? 1 : 0.4) - (1 - lift) * 9;
      }
      const hv = d.fly === 'plane' ? Math.cos(c.pitchV) : 1;
      c.vx = fx * vf * hv + sx;
      c.vz = fz * vf * hv + sz;
      c.spd = vf;
      const vyBefore = c.vy;
      this.move(g, c, dt, 0);
      // atterrissage trop brutal
      if (c.hitY && vyBefore < -11 && !g.net.isClient) this.damage(g, c, (-vyBefore - 11) * 4, 'crash');
    },

    // --------------------------------------------------------- hôte --
    hostTick(ents, c, dt) {
      const g = ents.game, d = CM.VEH[c.type];
      if (!c.init) {
        c.init = true;
        this.init(c);
      }
      // passagers partis (déconnectés, morts, autre dimension)
      c.pax = (c.pax || []).filter((q) => (q === 'local' ? g.player.alive && g.player.riding === c.uid && g.dim === g.playerDim : g.net.remotes.get(q) && g.net.remotes.get(q).alive !== false && g.net.remotes.get(q).dim === g.dim));
      // sans conducteur : il ralentit et tombe (l'hôte le simule)
      if (c.rider === null || c.rider === undefined) this.step(g, c, dt, null);
      // conducteur de cet écran : c'est ride() qui le fait avancer
      // carburant
      if (c.rider !== null && c.rider !== undefined && g.mode !== 'creative') c.fuel = Math.max(0, (c.fuel || 0) - FUEL_USE * dt * (0.25 + Math.abs(c.thrIn || 0) * 0.75));
      // renverse les créatures (et les joueurs, si les combats sont permis)
      const sp = Math.abs(c.spd || 0);
      if ((sp > 5 || (d.tracked && sp > 1)) && !d.fly) {
        const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
        for (const m of ents.mobs) {
          if (m.dead || now(g) - (m.vHit || -9) < 0.6) continue;
          const dx = m.x - c.x, dz = m.z - c.z;
          if (Math.abs(m.y - c.y) > 1.6 || Math.hypot(dx, dz) > d.hw + m.hw + 0.5) continue;
          if ((dx * fx + dz * fz) * Math.sign(c.spd) < 0) continue; // (seulement devant)
          m.vHit = now(g);
          ents.hurtMob(m, d.tracked ? 12 + sp * 3 : sp * 1.1, [c.x, c.z], false, c.rider === 'local' ? g.player : null);
          m.vx = fx * sp * 0.8 * Math.sign(c.spd);
          m.vz = fz * sp * 0.8 * Math.sign(c.spd);
          m.vy = 5;
          if (!d.tracked) this.damage(g, c, 1, 'hit');
        }
      }
      if (c.y < CM.WORLD.MINY - 20) c.dead = true;
      if (c.burn > 0) {
        c.burn -= dt;
        if (Math.random() < dt * 20) ents.burst(CM.Textures.layer.smoke, c.x, c.y + d.h, c.z, 1, { speed: 1, grav: -2, life: 1.2, size: 0.3 });
        if (c.burn <= 0) this.explode(g, c);
      }
    },
    // Dégâts (hôte) ; à 0, le véhicule prend feu puis explose.
    damage(g, c, n, why) {
      if (g.mode === 'creative' && why !== 'explosion') return;
      c.vhp = (c.vhp === undefined ? CM.VEH[c.type].hp : c.vhp) - n;
      if (why === 'crash' && n > 2) {
        CM.Audio.play('break', { mat: 'metal' });
        this.fxAll(g, { k: 'veh_crash', x: c.x, y: c.y, z: c.z });
      }
      if (c.vhp <= 0 && !(c.burn > 0)) c.burn = 2.5;
    },
    explode(g, c) {
      if (c.dead) return;
      c.dead = true;
      const ents = g.entities;
      if (c.rider !== null && c.rider !== undefined) ents.dismount(c);
      for (const q of c.pax || []) this.dropPax(g, c, q);
      c.pax = [];
      for (const s of c.slots || []) if (s) ents.addDrop(s.id, s.count, c.x, c.y + 0.5, c.z, CM.stackExtra(s));
      ents.addDrop(CM.I.IRON_INGOT, 2 + Math.floor(Math.random() * 3), c.x, c.y + 0.5, c.z);
      g.explode(c.x, c.y + 0.6, c.z, 3);
    },
    dropPax(g, c, q) {
      if (q === 'local') {
        g.player.riding = null;
        g.player.vehSeat = 0;
      } else g.net.sendTo(q, { t: 'unride' });
    },
    fxAll(g, m) {
      if (g.net.isHost) g.net.fx(m);
    },

    // --------------------------------------------- joueur de cet écran --
    // À bord (conducteur ou passager) : true (les déplacements normaux sont remplacés).
    ride(p, c, dt, input) {
      const g = p.game, d = CM.VEH[c.type], K = g.binds, k = input.keys;
      if (!c.init) {
        c.init = true;
        this.init(c);
      }
      // (invité : sa place d'après l'instantané de l'hôte)
      const s0 = this.seatOf(c, g.net.isClient ? g.net.pid : 'local');
      const seat = s0 >= 0 ? s0 : g.net.isClient ? 1 : 0; // (invité pas encore confirmé : passager)
      p.vehSeat = seat;
      const driver = seat === 0;
      if (driver) {
        let f = (k[K.forward] ? 1 : 0) - (k[K.back] ? 1 : 0);
        let s = (k[K.right] ? 1 : 0) - (k[K.left] ? 1 : 0);
        if (input.analog) {
          f = input.analog.y;
          s = input.analog.x;
        }
        const ctl = { thr: f, steer: s, brake: !d.fly && !!k[K.jump], up: (k[K.jump] ? 1 : 0) - (k[K.sprint] ? 1 : 0), look: p.yaw, pitch: p.pitch };
        if (d.fly === 'plane') ctl.brake = !!k[K.sprint];
        if (d.cannon) {
          this.turret(p, c, dt, input);
          // (le clic gauche est pour le canon : on ne frappe pas, on ne casse rien)
          input.pressed.mouse0 = false;
          input.mouse[0] = false;
        }
        c.thrIn = f;
        const x0 = c.x, z0 = c.z;
        this.step(g, c, dt, ctl);
        // (succès : distance conduite ou volée, vitesse maximale)
        const st = g.stats, moved = Math.hypot(c.x - x0, c.z - z0);
        if (moved < 5) {
          if (d.fly && !c.onGround) st.flown = (st.flown || 0) + moved;
          else st.driven = (st.driven || 0) + moved;
          st.topSpeed = Math.max(st.topSpeed || 0, Math.abs(c.spd || 0));
        }
        if (g.net.isClient) {
          // l'invité conduit sa copie et envoie la position à l'hôte
          c.tx = undefined;
          p.vposT = (p.vposT || 0) - dt;
          if (p.vposT <= 0) {
            p.vposT = 0.08;
            g.net.send({ t: 'bpos', id: c.uid, p: [r2(c.x), r2(c.y), r2(c.z), r2(c.yaw)], v: [r2(c.spd || 0), r2(c.steer || 0), r2(c.pitchV || 0), r2(c.roll || 0), r2(f), r2(c.tyaw || 0), r2(c.tpitch || 0)] });
          }
        }
        // klaxon, sirène
        if (input.pressed[K.horn]) this.horn(g, c);
        this.engineSound(g, c, dt, true);
      }
      // la place suit le véhicule
      const sp = this.seatPos(c, seat);
      p.x = sp[0];
      p.y = sp[1];
      p.z = sp[2];
      p.vx = c.vx || 0;
      p.vy = 0;
      p.vz = c.vz || 0;
      p.fallStart = p.y;
      p.onGround = true;
      p.flying = p.sneaking = p.sprinting = false;
      p.eyeOffset = 0.45;
      // la nuit, les phares éclairent (lumière tenue par le conducteur)
      p.vehLight = driver && g.daylight < 0.5 ? 1 : 0;
      return true;
    },
    horn(g, c) {
      const d = CM.VEH[c.type];
      if (d.siren) {
        c.siren = !c.siren;
        if (g.net.isClient) g.net.send({ t: 'vact', id: c.uid, a: 'siren' });
        else this.fxAll(g, { k: 'veh_siren', x: c.x, y: c.y, z: c.z, id: c.uid, on: c.siren ? 1 : 0 });
        g.ui.toast(c.siren ? '🚨 Sirène allumée' : 'Sirène éteinte', 'info', 'siren');
        return;
      }
      CM.Audio.play('klaxon', { pitch: d.fly ? 0.8 : c.type === 'truck' ? 0.7 : c.type === 'moto' ? 1.3 : 1 });
      if (g.net.isClient) g.net.send({ t: 'vact', id: c.uid, a: 'horn' });
      else this.fxAll(g, { k: 'veh_horn', x: c.x, y: c.y, z: c.z, ty: c.type });
    },
    // Bruit du moteur (et des pales) ; les véhicules des autres, plus bas.
    engineSound(g, c, dt, mine) {
      const d = CM.VEH[c.type];
      c.sndT = (c.sndT || 0) - dt;
      if (c.sndT > 0) return;
      if (d.fly === 'heli') {
        if (!(c.rot > 0) || (c.onGround && !mine)) return;
        c.sndT = 0.11;
        CM.Audio.play('rotor', { vol: mine ? 0.6 : 0.3 });
        return;
      }
      if (!mine && Math.abs(c.spd || 0) < 0.5) return;
      const sp = Math.abs(c.spd || 0) / d.maxV;
      c.sndT = 0.09;
      CM.Audio.play('engine', { pitch: (c.type === 'tank' ? 0.42 : c.type === 'truck' ? 0.6 : c.type === 'sport' ? 1.2 : c.type === 'moto' ? 1.35 : 1) * (0.7 + sp * 1.3), vol: mine ? 0.5 : 0.22 });
      if (c.siren && Math.floor(g.clock * 2) !== c.sirenT) {
        c.sirenT = Math.floor(g.clock * 2);
        CM.Audio.play('siren', { pitch: c.sirenT % 2 ? 1 : 0.8, vol: mine ? 0.5 : 0.35 });
      }
    },
    // Descente : à gauche du véhicule (ou au-dessus s'il n'y a pas la place).
    exitSpot(g, c) {
      const d = CM.VEH[c.type], w = g.world;
      const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
      for (const side of [-1, 1]) {
        const off = d.hw + 0.7;
        const x = c.x + side * off * cy, z = c.z - side * off * sy;
        for (const dy of [0, 1, -1]) {
          const y = Math.floor(c.y) + dy;
          if (!CM.Physics.overlaps(w, x, y + 0.01, z, 0.3, 1.8) && CM.Physics.overlaps(w, x, y - 0.5, z, 0.3, 0.4)) return [x, y + 0.01, z];
        }
      }
      return [c.x, c.y + d.h + 0.1, c.z];
    },

    // -------------------------------------------------- interactions --
    // Clic droit sur un véhicule : carburant, réparation, peinture, benne, monter.
    interact(p, c) {
      const g = p.game, inv = g.inventory, held = inv.held(), info = held && CM.itemInfo(held.id), d = CM.VEH[c.type];
      const act = (a, extra) => {
        if (g.net.isClient) g.net.send(Object.assign({ t: 'vact', id: c.uid, a }, extra || {}));
        else this.apply(g, c, a, extra || {}, 'local');
      };
      if (info && (held.id === CM.I.FUEL_CAN || held.id === CM.I.COAL || held.id === CM.I.CHARCOAL)) {
        if ((c.fuel || 0) >= 99) return g.ui.toast('Le réservoir est plein', 'info', 'fuel');
        act('fuel', { n: held.id === CM.I.FUEL_CAN ? 40 : 8 });
        if (!p.creative) inv.consumeHeld(1);
        CM.Audio.play('fizz', { vol: 0.4 });
        g.ui.toast('⛽ Plein fait', 'good', 'fuel');
        return true;
      }
      if (info && held.id === CM.I.IRON_INGOT && (c.vhp === undefined || c.vhp < d.hp)) {
        act('repair', { n: d.hp * 0.25 });
        if (!p.creative) inv.consumeHeld(1);
        CM.Audio.play('anvil');
        g.ui.toast('🔧 Réparé', 'good', 'repair');
        return true;
      }
      if (info && info.dye && !d.fixed) {
        act('paint', { c: info.dye });
        if (!p.creative) inv.consumeHeld(1);
        CM.Audio.play('place', { mat: 'wool' });
        return true;
      }
      if (p.sneaking && c.slots) {
        g.openCartChest(c);
        return true;
      }
      if (p.riding !== null && p.riding !== undefined) return false;
      if (!this.seatsFree(c)) return g.ui.toast('Plus de place à bord', 'info', 'vfull');
      return p.rideCart(c);
    },
    // Action sur un véhicule, appliquée par l'hôte (who : 'local' ou numéro de l'invité).
    apply(g, c, a, m, who) {
      const d = CM.VEH[c.type];
      if (!c.init) {
        c.init = true;
        this.init(c);
      }
      if (a === 'fuel') c.fuel = Math.min(100, (c.fuel || 0) + Math.max(0, Math.min(40, +m.n || 0)));
      else if (a === 'repair') {
        c.vhp = Math.min(d.hp, (c.vhp || 0) + Math.max(0, Math.min(d.hp, +m.n || 0)));
        c.burn = 0;
      } else if (a === 'paint' && CM.DYES.some((dy) => dy.key === m.c) && !d.fixed) c.color = m.c;
      else if (a === 'horn') this.fxAll(g, { k: 'veh_horn', x: c.x, y: c.y, z: c.z, ty: c.type });
      else if (a === 'cannon' && d.cannon) this.fxAll(g, { k: 'veh_cannon', x: r2(c.x), y: r2(c.y + 2), z: r2(c.z) });
      else if (a === 'siren' && d.siren) {
        c.siren = !c.siren;
        this.fxAll(g, { k: 'veh_siren', x: c.x, y: c.y, z: c.z, id: c.uid, on: c.siren ? 1 : 0 });
      }
    },
    // Coup porté : accroupi (ou en créatif), on range le véhicule ; sinon il s'abîme.
    hit(ents, c, dmg, by) {
      const g = ents.game;
      if (c.dead) return;
      const pick = g.mode === 'creative' || (by && by.sneaking);
      const empty = (c.rider === null || c.rider === undefined) && !(c.pax || []).length;
      if (pick && empty) {
        c.dead = true;
        if (c.slots) {
          if (g.net.active) g.net.chestGone('C' + c.uid);
          else if (g.ui.chest === c.slots) g.ui.closeInventory();
        }
        ents.addDrop(CM.CART_ITEMS[c.type], 1, c.x, c.y + 0.5, c.z);
        for (const s of c.slots || []) if (s) ents.addDrop(s.id, s.count, c.x, c.y + 0.5, c.z, CM.stackExtra(s));
        CM.Audio.play('pop');
        return;
      }
      CM.Audio.play('hit');
      this.damage(g, c, dmg, 'hit');
    },
    // Pose d'un véhicule (objet en main).
    place(p, stack, info) {
      const g = p.game, w = g.world, type = info.vehicle, d = CM.VEH[type];
      const e = p.eye(), dir = p.aim();
      const h = w.raycast(e[0], e[1], e[2], dir[0], dir[1], dir[2], 7, (id) => CM.isWater(id) || CM.blocks[id].solid);
      if (!h) return g.ui.toast('Vise le sol (ou l’eau) pour poser le véhicule', 'info', 'veh');
      let at;
      if (CM.isWater(h.id)) {
        if (!d.water) return g.ui.toast('Ce véhicule ne va pas sur l’eau', 'info', 'veh');
        at = [h.x + 0.5, h.y + 0.6, h.z + 0.5];
      } else at = [h.x + 0.5 + h.nx * 0.5, h.y + (h.ny === 1 ? 1 : 0) + 0.01, h.z + 0.5 + h.nz * 0.5];
      if (CM.Physics.overlaps(w, at[0], at[1], at[2], d.hw * 0.8, d.h)) {
        // un peu plus haut ?
        at[1] += 1;
        if (CM.Physics.overlaps(w, at[0], at[1], at[2], d.hw * 0.8, d.h)) return g.ui.toast('Pas assez de place ici', 'warn', 'veh');
      }
      g.entities.addCart(type, at[0], at[1], at[2], { yaw: p.yaw });
      if (!p.creative) p.consume(1);
      CM.Audio.play('place', { mat: 'metal' });
      p.swing = 1;
    },

    // ---------------------------------------------------------- réseau --
    // Données supplémentaires dans l'instantané des invités.
    snap(c) {
      const pax = (c.pax || []).map((q) => (q === 'local' ? 0 : q));
      return [Math.round(c.fuel || 0), Math.round(c.vhp === undefined ? CM.VEH[c.type].hp : c.vhp), c.color || CM.VEH[c.type].color, (c.siren ? 1 : 0) | (c.burn > 0 ? 2 : 0), pax, r2(c.spd || 0), r2(c.steer || 0), r2(c.pitchV || 0), r2(c.roll || 0), r2(c.thr || 0), r2(c.tyaw || 0), r2(c.tpitch || 0)];
    },
    unsnap(c, x, own) {
      if (!Array.isArray(x)) return;
      c.fuel = +x[0] || 0;
      c.vhp = +x[1] || 0;
      if (typeof x[2] === 'string') c.color = x[2];
      c.siren = !!(x[3] & 1);
      c.burn = x[3] & 2 ? 1 : 0;
      c.pax = Array.isArray(x[4]) ? x[4] : [];
      if (own) return; // (notre propre conduite fait foi)
      c.spd = +x[5] || 0;
      c.steer = +x[6] || 0;
      c.pitchV = +x[7] || 0;
      c.roll = +x[8] || 0;
      c.thr = +x[9] || 0;
      if (x.length > 10) {
        c.tyaw = +x[10] || 0;
        c.tpitch = +x[11] || 0;
      }
    },
    // Effets reçus (klaxon, sirène, choc).
    onFx(g, m) {
      const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
      if (m.k === 'veh_cannon' && d < 160) {
        CM.Audio.play('gun', { g: 'cannon', vol: Math.max(0.2, 1 - d / 140) });
        g.entities.burst(CM.Textures.layer.smoke, m.x, m.y, m.z, 10, { speed: 2.5, grav: -0.6, life: 1.1, size: 0.22 });
      } else if (m.k === 'veh_horn' && d < 64) CM.Audio.play('klaxon', { vol: Math.max(0.2, 1 - d / 64), pitch: m.ty === 'truck' ? 0.7 : m.ty === 'moto' ? 1.3 : 1 });
      else if (m.k === 'veh_crash' && d < 40) CM.Audio.play('break', { mat: 'metal' });
      else if (m.k === 'veh_siren') {
        const c = g.entities.cartByUid(m.id);
        if (c) c.siren = !!m.on;
      }
    },

    // Véhicule où quelqu'un est assis (position de sa place).
    vehicleAt(ents, x, y, z) {
      for (const c of ents.carts || []) {
        if (c.dead || !isVeh(c)) continue;
        const d = CM.VEH[c.type];
        for (let i = 0; i < d.seats.length; i++) {
          const s = this.seatPos(c, i);
          if (Math.abs(s[0] - x) < 0.4 && Math.abs(s[1] - y) < 0.6 && Math.abs(s[2] - z) < 0.4) return c;
        }
      }
      return null;
    },

    // --------------------------------------------------------- caméra --
    // Caméra de derrière (véhicule, ou vue à la 3e personne) : position corrigée contre les murs.
    thirdPerson(g, eye, fwd, dist) {
      const w = g.world;
      const h = w.raycast(eye[0], eye[1], eye[2], -fwd[0], -fwd[1], -fwd[2], dist, (id) => CM.blocks[id].solid && CM.blocks[id].opaque);
      const t = h ? Math.max(0.3, h.t - 0.3) : dist;
      return [eye[0] - fwd[0] * t, eye[1] - fwd[1] * t, eye[2] - fwd[2] * t];
    },
    camDist(c) {
      const d = CM.VEH[c.type];
      return d.fly === 'plane' ? 9 : d.fly === 'heli' ? 8 : c.type === 'truck' || c.type === 'tank' ? 8.5 : c.type === 'moto' || c.type === 'quad' ? 4.5 : 6;
    },

    // ------------------------------------------------------------ HUD --
    hud(g) {
      const el = $('veh-hud'), p = g.player;
      if (!el) return;
      const c = p && p.alive && p.riding !== null && p.riding !== undefined ? g.entities.cartByUid(p.riding) : null;
      if (!c || !isVeh(c) || g.state !== 'playing') {
        if (!el.classList.contains('hidden')) el.classList.add('hidden');
        return;
      }
      const d = CM.VEH[c.type], kmh = Math.round(Math.abs(c.spd || 0) * 3.6);
      const fuel = g.mode === 'creative' ? '∞' : Math.round(c.fuel || 0) + ' %';
      const hp = Math.max(0, Math.round(((c.vhp === undefined ? d.hp : c.vhp) / d.hp) * 100));
      const alt = d.fly ? ' · ↥ ' + Math.round(c.y) : '';
      let thr = d.fly === 'plane' ? ' · gaz ' + Math.round((c.thr || 0) * 100) + ' %' : '';
      if (d.cannon) thr = ' · 💥 ' + (c.reload > 0 ? c.reload.toFixed(1) + ' s' : 'prêt') + ' (' + (p.creative ? '∞' : g.inventory.count(CM.I.TANK_SHELL)) + ')';
      const key = kmh + '|' + fuel + '|' + hp + '|' + alt + thr + (c.burn > 0 ? 'b' : '');
      if (el.dataset.k === key) return;
      el.dataset.k = key;
      el.classList.remove('hidden');
      el.innerHTML = '<div class="vh-name">' + d.name + (c.burn > 0 ? ' · 🔥 va exploser !' : '') + '</div><div class="vh-speed">' + kmh + '<small> km/h</small></div>' +
        '<div class="vh-bars"><span class="' + ((c.fuel || 0) < 15 && g.mode !== 'creative' ? 'low' : '') + '">⛽ ' + fuel + '</span><span class="' + (hp < 30 ? 'low' : '') + '">🔧 ' + hp + ' %</span>' + alt + thr + '</div>';
    },

    // -------------------------------------------------------- rendu --
    paint(c) {
      const L = CM.Textures.layer;
      return c.type === 'police' ? L.veh_police : L['veh_paint_' + String(c.color || CM.VEH[c.type].color).toLowerCase()] || L.veh_paint_red;
    },
    render(ents, batch) {
      const g = ents.game;
      for (const c of ents.carts || []) {
        if (c.dead || !isVeh(c)) continue;
        if (!c.init) {
          c.init = true;
          this.init(c);
        }
        // (invité : vitesse estimée d'après le déplacement)
        if (c.lx !== undefined && !(g.player.riding === c.uid && (g.player.vehSeat || 0) === 0)) {
          const dd = Math.hypot(c.x - c.lx, c.z - c.lz);
          c.wheel = (c.wheel || 0) + dd * 2 * Math.sign(c.spd || 1);
        } else c.wheel = (c.wheel || 0) + (c.spd || 0) * 0.033;
        c.lx = c.x;
        c.lz = c.z;
        if (g.net.isClient || c.rider !== 'local') {
          if (CM.VEH[c.type].fly === 'heli') c.rot = (c.rot || 0) + (c.onGround && Math.abs(c.spd || 0) < 0.1 && !(c.rider !== null && c.rider !== undefined) ? 0 : 0.5);
          else if (CM.VEH[c.type].fly === 'plane') c.rot = (c.rot || 0) + 0.2 + Math.abs(c.spd || 0) * 0.05;
          if (Math.hypot(g.player.x - c.x, g.player.z - c.z) < 40 && (c.rider !== null && c.rider !== undefined)) this.engineSound(g, c, 1 / 30, false);
        }
        this.drawModel(ents, batch, c, g.clock);
      }
    },
    drawModel(ents, batch, c, clock) {
      const L = CM.Textures.layer, M = ents.M, l = ents.lightAt(c.x, c.y + 0.8, c.z);
      const d = CM.VEH[c.type], P = this.paint(c), G = L.veh_glass, K = L.veh_black, DK = L.veh_dark, CH = L.veh_chrome, S = L.veh_seat;
      const night = ents.game.daylight < 0.5;
      const lit = night && (c.rider !== null && c.rider !== undefined);
      const HL = lit ? [1, 1, 1] : null;
      mat4.compose(M, c.x, c.y, c.z, c.yaw || 0, c.pitchV || 0, c.roll || 0, 1);
      const box = (x0, y0, z0, x1, y1, z1, t, emi) => batch.box(M, x0, y0, z0, x1, y1, z1, t, emi ? 1 : l[0], emi ? 1 : l[1], emi ? 1 : 0);
      // vitres : côtés et avant/arrière en verre, dessus peint (ordre des faces : +x, -x, +y, -y, +z, -z)
      const cabin = (x0, y0, z0, x1, y1, z1, top) => batch.box(M, x0, y0, z0, x1, y1, z1, [G, G, top || P, DK, G, G], l[0], l[1], 0);
      const wheel = (x, y, z, r, w, steer) => {
        const W = ents.W || (ents.W = mat4.create()), Q = ents.WQ || (ents.WQ = mat4.create());
        mat4.compose(Q, x, y, z, steer ? -(c.steer || 0) * 0.45 : 0, c.wheel || 0, 0, 1);
        mat4.multiply(W, M, Q);
        batch.box(W, -w / 2, -r, -r, w / 2, r, r, [L.veh_hub, L.veh_hub, L.veh_tire, L.veh_tire, L.veh_tire, L.veh_tire], l[0], l[1], 0);
      };
      const lights = (y, z, hw, x0) => {
        box(-hw, y, z - 0.02, -hw + x0, y + 0.14, z, L.veh_head, lit);
        box(hw - x0, y, z - 0.02, hw, y + 0.14, z, L.veh_head, lit);
      };
      const tails = (y, z, hw, x0) => {
        box(-hw, y, z, -hw + x0, y + 0.12, z + 0.02, L.veh_tail, lit);
        box(hw - x0, y, z, hw, y + 0.12, z + 0.02, L.veh_tail, lit);
      };
      switch (c.type) {
        case 'car':
        case 'police': {
          box(-0.9, 0.28, -1.1, 0.9, 0.78, 1.1, P);
          cabin(-0.82, 0.78, -0.4, 0.82, 1.74, 0.95);
          box(-0.92, 0.25, -1.16, 0.92, 0.42, -1.1, DK);
          box(-0.92, 0.25, 1.1, 0.92, 0.42, 1.16, DK);
          box(-0.7, 0.44, -0.2, 0.7, 0.52, 0.95, S);
          lights(0.5, -1.1, 0.8, 0.28);
          tails(0.52, 1.1, 0.8, 0.26);
          for (const [x, z, st] of [[-0.8, -0.72, 1], [0.8, -0.72, 1], [-0.8, 0.72, 0], [0.8, 0.72, 0]]) wheel(x, 0.3, z, 0.3, 0.22, st);
          if (c.type === 'police') {
            const blink = c.siren && Math.floor(clock * 6) % 2;
            box(-0.5, 1.74, 0.15, -0.05, 1.86, 0.4, L.veh_siren_red, c.siren && blink);
            box(0.05, 1.74, 0.15, 0.5, 1.86, 0.4, L.veh_siren_blue, c.siren && !blink);
          }
          break;
        }
        case 'sport': {
          box(-0.92, 0.2, -1.2, 0.92, 0.6, 1.15, P);
          // décapotable : pare-brise seulement
          batch.box(M, -0.8, 0.6, -0.42, 0.8, 1.02, -0.36, G, l[0], l[1], 0);
          box(-0.92, 0.6, -0.36, -0.82, 0.72, 0.7, P);
          box(0.82, 0.6, -0.36, 0.92, 0.72, 0.7, P);
          box(-0.9, 0.62, 0.95, 0.9, 0.68, 1.12, P); // aileron
          box(-0.85, 0.6, 1.0, -0.75, 0.66, 1.05, K);
          box(0.75, 0.6, 1.0, 0.85, 0.66, 1.05, K);
          box(-0.6, 0.35, 0.0, 0.6, 0.45, 0.6, S);
          lights(0.36, -1.2, 0.85, 0.3);
          tails(0.4, 1.15, 0.85, 0.3);
          for (const [x, z, st] of [[-0.82, -0.78, 1], [0.82, -0.78, 1], [-0.82, 0.78, 0], [0.82, 0.78, 0]]) wheel(x, 0.28, z, 0.28, 0.26, st);
          break;
        }
        case 'jeep': {
          box(-0.95, 0.55, -1.15, 0.95, 1.05, 1.15, P);
          box(-0.95, 1.05, -0.55, -0.85, 1.75, 1.1, K); // arceaux
          box(0.85, 1.05, -0.55, 0.95, 1.75, 1.1, K);
          box(-0.95, 1.65, -0.55, 0.95, 1.75, 1.1, K);
          batch.box(M, -0.9, 1.05, -0.6, 0.9, 1.6, -0.52, G, l[0], l[1], 0); // pare-brise
          box(-0.8, 0.9, -0.1, 0.8, 1.0, 1.0, S);
          lights(0.8, -1.15, 0.85, 0.25);
          tails(0.8, 1.15, 0.85, 0.2);
          box(-0.3, 0.6, 1.15, 0.3, 1.2, 1.3, L.veh_tire); // roue de secours
          for (const [x, z, st] of [[-0.85, -0.75, 1], [0.85, -0.75, 1], [-0.85, 0.75, 0], [0.85, 0.75, 0]]) wheel(x, 0.45, z, 0.45, 0.32, st);
          break;
        }
        case 'truck': {
          box(-1.05, 0.5, -1.9, 1.05, 1.3, -0.5, P); // cabine
          cabin(-1.0, 1.3, -1.9, 1.0, 2.2, -0.5);
          box(-1.05, 0.4, -0.45, 1.05, 0.6, 2.1, DK); // châssis
          box(-1.05, 0.6, -0.4, 1.05, 2.3, 2.1, L.veh_cargo); // benne
          box(-0.8, 1.1, -1.4, 0.8, 1.2, -0.7, S);
          lights(0.7, -1.9, 0.95, 0.3);
          tails(0.65, 2.1, 0.95, 0.25);
          for (const [x, z, st] of [[-0.95, -1.35, 1], [0.95, -1.35, 1], [-0.95, 0.9, 0], [0.95, 0.9, 0], [-0.95, 1.6, 0], [0.95, 1.6, 0]]) wheel(x, 0.42, z, 0.42, 0.3, st);
          break;
        }
        case 'moto': {
          box(-0.14, 0.45, -0.55, 0.14, 0.75, 0.45, P);
          box(-0.16, 0.55, -0.15, 0.16, 0.72, 0.1, DK); // moteur
          box(-0.12, 0.75, 0.0, 0.12, 0.82, 0.7, S); // selle
          box(-0.03, 0.6, -0.75, 0.03, 1.1, -0.68, CH); // fourche
          box(-0.4, 1.05, -0.74, 0.4, 1.1, -0.69, K); // guidon
          box(-0.08, 0.95, -0.82, 0.08, 1.05, -0.76, L.veh_head, lit);
          box(-0.06, 0.62, 0.7, 0.06, 0.7, 0.74, L.veh_tail, lit);
          wheel(0, 0.36, -0.72, 0.36, 0.14, 1);
          wheel(0, 0.36, 0.62, 0.36, 0.16, 0);
          break;
        }
        case 'quad': {
          box(-0.55, 0.45, -0.75, 0.55, 0.8, 0.75, P);
          box(-0.3, 0.8, -0.1, 0.3, 0.9, 0.6, S);
          box(-0.03, 0.8, -0.6, 0.03, 1.15, -0.5, CH);
          box(-0.45, 1.1, -0.6, 0.45, 1.15, -0.54, K);
          lights(0.6, -0.75, 0.45, 0.2);
          for (const [x, z, st] of [[-0.6, -0.55, 1], [0.6, -0.55, 1], [-0.6, 0.55, 0], [0.6, 0.55, 0]]) wheel(x, 0.38, z, 0.38, 0.3, st);
          break;
        }
        case 'heli': {
          box(-0.8, 0.35, -1.0, 0.8, 1.9, 1.0, P);
          batch.box(M, -0.78, 0.8, -1.5, 0.78, 1.8, -1.0, [G, G, P, DK, G, G], l[0], l[1], 0); // cockpit vitré
          box(-0.2, 1.2, 1.0, 0.2, 1.55, 3.9, P); // queue
          box(-0.05, 1.3, 3.6, 0.05, 2.3, 3.95, P); // dérive
          box(-0.75, 0.0, -1.1, -0.65, 0.08, 1.2, K); // patins
          box(0.65, 0.0, -1.1, 0.75, 0.08, 1.2, K);
          box(-0.72, 0.08, -0.6, -0.66, 0.4, -0.5, K);
          box(0.66, 0.08, -0.6, 0.72, 0.4, -0.5, K);
          box(-0.72, 0.08, 0.6, -0.66, 0.4, 0.7, K);
          box(0.66, 0.08, 0.6, 0.72, 0.4, 0.7, K);
          box(-0.6, 0.6, -0.6, 0.6, 0.7, 0.6, S);
          box(-0.08, 1.9, -0.08, 0.08, 2.15, 0.08, K); // mât
          const R = ents.W || (ents.W = mat4.create()), Q = ents.WQ || (ents.WQ = mat4.create());
          mat4.compose(Q, 0, 2.15, 0, c.rot || 0, 0, 0, 1);
          mat4.multiply(R, M, Q);
          batch.box(R, -3.4, 0, -0.12, 3.4, 0.05, 0.12, L.veh_rotor, l[0], l[1], 0);
          batch.box(R, -0.12, 0, -3.4, 0.12, 0.05, 3.4, L.veh_rotor, l[0], l[1], 0);
          mat4.compose(Q, 0.12, 1.9, 3.8, 0, c.rot * 1.7 || 0, 0, 1);
          mat4.multiply(R, M, Q);
          batch.box(R, 0, -0.5, -0.05, 0.04, 0.5, 0.05, L.veh_rotor, l[0], l[1], 0);
          box(-0.1, 0.4, -1.52, 0.1, 0.55, -1.49, L.veh_head, lit);
          break;
        }
        case 'plane': {
          box(-0.5, 0.55, -2.0, 0.5, 1.4, 2.4, P); // fuselage
          cabin(-0.45, 1.4, -0.7, 0.45, 2.1, 0.9);
          box(-3.6, 0.95, -0.7, 3.6, 1.07, 0.55, P); // ailes
          box(-1.5, 1.2, 2.1, 1.5, 1.28, 2.6, P); // stabilisateur
          box(-0.06, 1.28, 2.1, 0.06, 2.2, 2.6, P); // dérive
          box(-3.6, 0.95, -0.72, -3.3, 1.07, -0.7, L.veh_tail, lit);
          box(3.3, 0.95, -0.72, 3.6, 1.07, -0.7, L.veh_siren_blue, lit);
          box(-0.2, 0.75, -2.15, 0.2, 1.15, -2.0, DK); // nez
          const R = ents.W || (ents.W = mat4.create()), Q = ents.WQ || (ents.WQ = mat4.create());
          mat4.compose(Q, 0, 0.95, -2.2, 0, 0, c.rot || 0, 1);
          mat4.multiply(R, M, Q);
          batch.box(R, -1.1, -0.08, -0.03, 1.1, 0.08, 0.03, L.veh_rotor, l[0], l[1], 0); // hélice
          box(-0.04, 0.2, -1.5, 0.04, 0.6, -1.4, K); // train d'atterrissage
          box(-1.1, 0.2, 0.2, -1.0, 0.95, 0.3, K);
          box(1.0, 0.2, 0.2, 1.1, 0.95, 0.3, K);
          wheel(0, 0.2, -1.45, 0.2, 0.12, 1);
          wheel(-1.05, 0.2, 0.25, 0.2, 0.14, 0);
          wheel(1.05, 0.2, 0.25, 0.2, 0.14, 0);
          box(-0.3, 1.0, -0.4, 0.3, 1.1, 0.8, S);
          break;
        }
        case 'tank': {
          const TR = L.veh_track;
          box(-1.3, 0.25, -1.9, 1.3, 1.15, 1.9, P); // caisse
          box(-1.15, 1.15, -1.5, 1.15, 1.35, 1.6, P);
          box(-1.45, 0.0, -2.05, -0.95, 0.85, 2.05, TR); // chenilles
          box(0.95, 0.0, -2.05, 1.45, 0.85, 2.05, TR);
          box(-1.5, 0.75, -2.0, -0.9, 0.85, 2.0, P); // garde-boue
          box(0.9, 0.75, -2.0, 1.5, 0.85, 2.0, P);
          for (const zz of [-1.5, -0.75, 0, 0.75, 1.5]) {
            wheel(-1.2, 0.34, zz, 0.3, 0.52, 0);
            wheel(1.2, 0.34, zz, 0.3, 0.52, 0);
          }
          lights(0.95, -1.9, 1.1, 0.25);
          tails(0.95, 1.9, 1.1, 0.2);
          // tourelle (tourne indépendamment de la caisse) et canon
          const R = ents.W || (ents.W = mat4.create()), Q = ents.WQ || (ents.WQ = mat4.create());
          const T2 = ents.W2 || (ents.W2 = mat4.create()), Q2 = ents.WQ2 || (ents.WQ2 = mat4.create());
          mat4.compose(Q, 0, 1.35, 0.1, wrap((c.tyaw === undefined ? c.yaw : c.tyaw) - (c.yaw || 0)), 0, 0, 1);
          mat4.multiply(R, M, Q);
          batch.box(R, -0.85, 0, -0.85, 0.85, 0.65, 0.95, P, l[0], l[1], 0);
          batch.box(R, -0.3, 0.65, 0.2, 0.3, 0.78, 0.7, DK, l[0], l[1], 0); // trappe
          batch.box(R, 0.5, 0.65, 0.5, 0.55, 1.8, 0.55, K, l[0], l[1], 0); // antenne
          mat4.compose(Q2, 0, 0.35, -0.8, 0, c.tpitch || 0, 0, 1);
          mat4.multiply(T2, R, Q2);
          batch.box(T2, -0.22, -0.2, -0.3, 0.22, 0.2, 0.1, DK, l[0], l[1], 0); // masque
          batch.box(T2, -0.1, -0.1, -2.55, 0.1, 0.1, -0.3, K, l[0], l[1], 0); // tube
          batch.box(T2, -0.14, -0.14, -2.8, 0.14, 0.14, -2.55, DK, l[0], l[1], 0); // frein de bouche
          break;
        }
        case 'speedboat': {
          box(-0.95, 0.0, -0.9, 0.95, 0.7, 1.4, P); // coque
          box(-0.7, 0.1, -1.6, 0.7, 0.7, -0.9, P); // proue
          box(-0.35, 0.2, -1.95, 0.35, 0.7, -1.6, P);
          batch.box(M, -0.85, 0.7, -0.5, 0.85, 1.15, -0.4, G, l[0], l[1], 0); // pare-brise
          box(-0.8, 0.45, -0.3, 0.8, 0.55, 1.2, S);
          box(-0.25, 0.3, 1.4, 0.25, 0.95, 1.75, DK); // moteur
          break;
        }
      }
      // en feu (va exploser)
      if (c.burn > 0 && Math.random() < 0.5) ents.burst(CM.Textures.layer.flame || CM.Textures.layer.smoke, c.x, c.y + d.h * 0.7, c.z, 1, { speed: 1.5, grav: -3, life: 0.5, size: 0.2, emissive: true });
    },
  });
  const now = (g) => g.clock;

  // --------------------------------------------------------------- succès --
  if (CM.Comfort && CM.Comfort.ACH) {
    const add = [
      ['permis', '🚗', 'Permis de conduire', 'Parcourir 1 000 blocs au volant', (g) => (g.stats.driven || 0) >= 1000],
      ['bolide', '🏎', 'Bolide', 'Dépasser 100 km/h', (g) => (g.stats.topSpeed || 0) * 3.6 >= 100],
      ['pilote', '🚁', 'Pilote', 'Voler sur 500 blocs en hélicoptère ou en avion', (g) => (g.stats.flown || 0) >= 500],
    ].map(([k, icon, name, desc, test]) => ({ k, icon, name, desc, test, ext: 'vehicles' }));
    const A = CM.Comfort.ACH, at = A.findIndex((a) => a.k === 'aube');
    A.splice(at < 0 ? A.length : at, 0, ...add);
  }

  // ------------------------------------------------ branchements sur carts.js --
  const add0 = E.addCart;
  E.addCart = function (type, x, y, z, from) {
    const c = add0.call(this, type, x, y, z, from);
    if (c && isVeh(c)) {
      c.init = true;
      V.init(c);
    }
    return c;
  };
  const list0 = E.cartList;
  E.cartList = function () {
    const out = list0.call(this);
    const vs = (this.carts || []).filter((c) => !c.dead);
    for (let i = 0; i < out.length; i++) {
      const c = vs[i];
      if (c && isVeh(c)) out[i].v = { f: Math.round(c.fuel || 0), h: Math.round(c.vhp === undefined ? CM.VEH[c.type].hp : c.vhp), c: c.color };
    }
    return out;
  };
  const ray0 = E.raycastCart;
  E.raycastCart = function (ox, oy, oz, dx, dy, dz, maxD) {
    let best = ray0.call(this, ox, oy, oz, dx, dy, dz, maxD);
    if (best && isVeh(best.cart)) best = null; // (boîte de wagonnet : pas pour les véhicules)
    for (const c of this.carts || []) {
      if (c.dead || !isVeh(c)) continue;
      const d = CM.VEH[c.type], r = d.fly === 'plane' ? 1.4 : d.hw + 0.15;
      const t = CM.rayBox(ox, oy, oz, dx, dy, dz, c.x - r, c.y, c.z - r, c.x + r, c.y + d.h, c.z + r);
      if (t >= 0 && t < (best ? best.t : maxD)) best = { cart: c, t };
    }
    return best;
  };
  const mount0 = E.mount;
  E.mount = function (c, who) {
    if (!isVeh(c)) return mount0.call(this, c, who);
    if (!c.init) {
      c.init = true;
      V.init(c);
    }
    if (V.seatOf(c, who) >= 0) return true;
    if (c.rider === null || c.rider === undefined) {
      c.rider = who;
      return true;
    }
    if ((c.pax || []).length < CM.VEH[c.type].seats.length - 1) {
      c.pax.push(who);
      return true;
    }
    return false;
  };
  const dis0 = E.dismount;
  E.dismount = function (c) {
    if (!isVeh(c)) return dis0.call(this, c);
    const g = this.game;
    if (c.rider === 'local') {
      const p = g.player, at = V.exitSpot(g, c);
      p.riding = null;
      p.x = at[0];
      p.y = at[1];
      p.z = at[2];
      p.fallStart = p.y;
    } else if (c.rider !== null && c.rider !== undefined) g.net.sendTo(c.rider, { t: 'unride' });
    c.rider = null;
  };
  const hit0 = E.hitCart;
  E.hitCart = function (c, dmg) {
    if (!isVeh(c)) return hit0.call(this, c, dmg);
    if (this.remote) {
      this.game.net.send({ t: 'hitcart', id: c.uid, d: dmg, s: this.game.player.sneaking ? 1 : 0 });
      return;
    }
    V.hit(this, c, dmg * 3, this.game.player);
  };
  // Explosion (hôte) : les véhicules proches s'abîment.
  V.explosion = function (g, x, y, z, power) {
    for (const c of g.entities.carts || []) {
      if (c.dead || !isVeh(c)) continue;
      const k = Math.max(0, 1 - Math.hypot(c.x - x, c.y + 0.5 - y, c.z - z) / (power * 2));
      if (k > 0) V.damage(g, c, k * 60, 'explosion');
    }
  };
})();
