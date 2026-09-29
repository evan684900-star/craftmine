'use strict';
// Armes à feu (extension) : tir instantané (balles, plombs), visée et lunette, recul, rechargement
// (les balles du chargeur sont dans stack.xp), roquettes et grenades (projectiles de carts.js),
// lance-flammes, grenades à main, bandits ; effets (éclair, traçantes, impacts), modèles 3D des
// armes (en main et chez les autres joueurs), HUD (munitions, marqueur de touche, lunette) et réseau.
(function () {
  const E = CM.Entities.prototype, mat4 = CM.mat4;
  const r2 = (v) => Math.round(v * 100) / 100;
  const $ = (id) => document.getElementById(id);
  const GRENADE_FUSE = 3;
  const POWER = { missile: 3.6, grenade: 2.6, hgrenade: 3 };
  const glassy = (b) => b && /GLASS|ICE$/.test(b.key) && !b.unbreakable && b.hardness >= 0 && b.hardness < 1;

  // --------------------------------------------------------- modèles --
  // Boîtes [x0, y0, z0, x1, y1, z1, texture] ; canon vers -z, crosse vers +z, poignée en dessous.
  // (sight : hauteur de la mire, pour aligner la visée ; muzzle : bout du canon)
  const MODELS = {
    PISTOL: { scale: 1.5, sight: 0.05, muzzle: -0.2, parts: [[-0.025, 0, -0.2, 0.025, 0.045, 0.02, 'dark'], [-0.022, -0.012, -0.17, 0.022, 0, 0.02, 'metal'], [-0.021, -0.13, -0.005, 0.021, -0.012, 0.045, 'black'], [-0.005, -0.045, -0.07, 0.005, -0.012, -0.06, 'black'], [-0.004, 0.045, -0.19, 0.004, 0.055, -0.18, 'black']] },
    REVOLVER: { scale: 1.4, sight: 0.05, muzzle: -0.24, parts: [[-0.016, 0.01, -0.24, 0.016, 0.042, -0.05, 'chrome'], [-0.032, -0.012, -0.08, 0.032, 0.05, -0.01, 'metal'], [-0.02, -0.012, -0.01, 0.02, 0.04, 0.03, 'chrome'], [-0.022, -0.14, 0.005, 0.022, -0.012, 0.05, 'wood'], [-0.004, 0.042, -0.23, 0.004, 0.056, -0.22, 'chrome']] },
    SMG: { scale: 1.2, sight: 0.06, muzzle: -0.3, parts: [[-0.028, -0.01, -0.24, 0.028, 0.05, 0.06, 'dark'], [-0.012, 0.008, -0.3, 0.012, 0.032, -0.24, 'black'], [-0.02, -0.12, -0.02, 0.02, -0.01, 0.03, 'black'], [-0.016, -0.2, -0.16, 0.016, -0.01, -0.11, 'black'], [-0.01, 0.0, 0.06, 0.01, 0.03, 0.22, 'metal'], [-0.01, -0.06, 0.2, 0.01, 0.03, 0.22, 'metal'], [-0.005, 0.05, -0.05, 0.005, 0.065, 0, 'black']] },
    RIFLE: { sight: 0.085, muzzle: -0.66, parts: [[-0.03, -0.02, -0.26, 0.03, 0.055, 0.06, 'dark'], [-0.012, 0.01, -0.66, 0.012, 0.034, -0.44, 'black'], [-0.03, -0.018, -0.46, 0.03, 0.05, -0.26, 'olive'], [-0.026, -0.07, 0.06, 0.026, 0.045, 0.32, 'olive'], [-0.02, -0.19, -0.2, 0.02, -0.02, -0.12, 'black'], [-0.02, -0.13, -0.02, 0.02, -0.02, 0.03, 'black'], [-0.012, 0.055, -0.1, 0.012, 0.085, 0.0, 'black'], [-0.004, 0.034, -0.64, 0.004, 0.07, -0.62, 'black']] },
    SHOTGUN: { sight: 0.06, muzzle: -0.72, parts: [[-0.028, -0.01, -0.2, 0.028, 0.05, 0.06, 'dark'], [-0.016, 0.02, -0.72, 0.016, 0.052, -0.2, 'metal'], [-0.014, -0.012, -0.66, 0.014, 0.018, -0.2, 'dark'], [-0.03, -0.03, -0.5, 0.03, 0.022, -0.3, 'wood'], [-0.026, -0.1, 0.06, 0.026, 0.04, 0.36, 'wood'], [-0.003, 0.052, -0.71, 0.003, 0.06, -0.7, 'chrome']] },
    DOUBLE_BARREL: { sight: 0.06, muzzle: -0.62, parts: [[-0.034, 0.012, -0.62, 0, 0.05, -0.12, 'metal'], [0, 0.012, -0.62, 0.034, 0.05, -0.12, 'dark'], [-0.03, -0.02, -0.4, 0.03, 0.014, -0.16, 'wood'], [-0.03, -0.02, -0.14, 0.03, 0.055, 0.04, 'metal'], [-0.026, -0.11, 0.04, 0.026, 0.04, 0.36, 'wood']] },
    HUNTING_RIFLE: { sight: 0.1, muzzle: -0.8, parts: [[-0.012, 0.02, -0.8, 0.012, 0.042, -0.3, 'black'], [-0.028, -0.03, -0.6, 0.028, 0.03, -0.05, 'wood'], [-0.026, -0.03, -0.1, 0.026, 0.052, 0.06, 'dark'], [-0.026, -0.12, 0.06, 0.026, 0.035, 0.38, 'wood'], [-0.018, 0.06, -0.2, 0.018, 0.098, 0.02, 'black'], [-0.022, 0.056, -0.24, 0.022, 0.1, -0.2, 'lens'], [-0.006, 0.052, -0.06, 0.006, 0.06, -0.04, 'black']] },
    SNIPER: { sight: 0.115, muzzle: -0.92, parts: [[-0.013, 0.02, -0.92, 0.013, 0.046, -0.3, 'black'], [-0.024, 0.012, -0.95, 0.024, 0.054, -0.88, 'dark'], [-0.032, -0.03, -0.32, 0.032, 0.058, 0.08, 'dark'], [-0.028, -0.1, 0.08, 0.028, 0.045, 0.4, 'dark'], [-0.02, -0.14, 0.02, 0.02, -0.03, 0.07, 'black'], [-0.018, -0.1, -0.12, 0.018, -0.03, -0.05, 'black'], [-0.024, 0.07, -0.26, 0.024, 0.118, 0.04, 'black'], [-0.028, 0.066, -0.3, 0.028, 0.122, -0.26, 'lens'], [-0.006, 0.058, -0.06, 0.006, 0.07, -0.02, 'black'], [-0.01, -0.12, -0.72, -0.004, 0.02, -0.7, 'metal'], [0.004, -0.12, -0.72, 0.01, 0.02, -0.7, 'metal']] },
    MINIGUN: { sight: 0.12, muzzle: -0.78, spin: true, parts: [[-0.08, -0.07, -0.24, 0.08, 0.1, 0.14, 'dark'], [-0.03, -0.18, -0.02, 0.03, -0.07, 0.05, 'black'], [-0.035, 0.1, -0.1, 0.035, 0.13, 0.08, 'black'], [-0.07, -0.06, -0.78, 0.07, 0.08, -0.74, 'metal'], [-0.07, -0.06, -0.3, 0.07, 0.08, -0.26, 'metal']] },
    ROCKET_LAUNCHER: { sight: 0.12, muzzle: -0.6, parts: [[-0.065, -0.065, -0.6, 0.065, 0.065, 0.4, 'olive'], [-0.075, -0.075, -0.6, 0.075, 0.075, -0.52, 'dark'], [-0.075, -0.075, 0.32, 0.075, 0.075, 0.4, 'dark'], [-0.02, -0.2, -0.12, 0.02, -0.065, -0.07, 'black'], [-0.02, -0.18, 0.05, 0.02, -0.065, 0.1, 'black'], [-0.015, 0.065, -0.2, 0.015, 0.12, -0.1, 'black']] },
    GRENADE_LAUNCHER: { sight: 0.09, muzzle: -0.5, parts: [[-0.045, -0.03, -0.5, 0.045, 0.06, -0.14, 'dark'], [-0.06, -0.06, -0.16, 0.06, 0.07, 0.02, 'black'], [-0.05, -0.05, -0.12, 0.05, 0.06, -0.02, 'metal'], [-0.024, -0.14, 0.0, 0.024, -0.02, 0.05, 'black'], [-0.024, -0.08, 0.04, 0.024, 0.04, 0.32, 'olive'], [-0.01, 0.06, -0.3, 0.01, 0.09, -0.24, 'black']] },
    FLAMETHROWER: { sight: 0.08, muzzle: -0.6, parts: [[-0.022, 0.0, -0.6, 0.022, 0.04, -0.1, 'dark'], [-0.03, -0.01, -0.64, 0.03, 0.05, -0.58, 'metal'], [-0.06, -0.16, -0.14, 0.06, 0.02, 0.2, 'red'], [-0.024, -0.14, -0.3, 0.024, 0.0, -0.24, 'black'], [-0.024, -0.12, 0.2, 0.024, 0.02, 0.34, 'black'], [-0.012, 0.04, -0.66, 0.012, 0.05, -0.62, 'orange']] },
  };
  const layerOf = (t) => CM.Textures.layer['gunm_' + t];

  const G = (CM.Guns = {
    fx: [], // traçantes, éclairs, flammes : { k, a, b, t }
    marker: 0,
    markerHead: false,
    MODELS,
    def(stack) {
      const i = stack && CM.itemInfo(stack.id);
      return i && i.gun ? CM.GUNS[i.gun] : null;
    },
    ammoLeft(g, gd) {
      if (g.player.creative) return Infinity;
      return g.inventory.count(CM.I[gd.ammo]) * (gd.per || 1);
    },
    // Rien de solide entre deux points (tir des bandits) ?
    clearShot(w, x0, y0, z0, x1, y1, z1) {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz) || 1;
      return !w.raycast(x0, y0, z0, dx / d, dy / d, dz / d, d, (id) => !CM.isFluid(id) && CM.blocks[id].solid && !glassy(CM.blocks[id]));
    },
    // Multiplicateurs de la sensibilité de la souris et de la vitesse de marche.
    sensMul(p) {
      const gd = p && p.gunAim > 0.5 ? this.def(p.game.inventory.held()) : null;
      return gd && gd.zoom > 1.5 ? 1 / Math.sqrt(gd.zoom * 1.6) : 1;
    },
    speedMul(p) {
      const gd = this.def(p.game.inventory.held());
      if (!gd) return 1;
      return (gd.heavy || 1) * (p.gunAim > 0.3 ? 0.6 : 1);
    },
    fovMul(p) {
      const gd = p.gunAim > 0 ? this.def(p.game.inventory.held()) : null;
      if (!gd) return 1;
      return 1 / (1 + ((gd.zoom || 1) - 1) * p.gunAim);
    },

    // ------------------------------------------------- joueur local --
    // Arme ou grenade en main : true si les clics ont été pris.
    update(p, dt, input) {
      const g = p.game, inv = g.inventory, held = inv.held(), info = held && CM.itemInfo(held.id);
      p.gunCd = Math.max(0, (p.gunCd || 0) - dt);
      p.gunKick = Math.max(0, (p.gunKick || 0) - dt * 7);
      p.gunFlash = Math.max(0, (p.gunFlash || 0) - dt);
      if (info && info.type === 'grenade') {
        this.reset(p);
        return this.grenadeHold(p, dt, input, held);
      }
      const gd = info && info.gun ? CM.GUNS[info.gun] : null;
      if (!gd || !p.alive) {
        this.reset(p);
        return false;
      }
      // changement d'arme : le rechargement en cours est perdu
      if (p.gunSlot !== inv.selected || p.gunId !== held.id) {
        p.gunSlot = inv.selected;
        p.gunId = held.id;
        p.gunReload = null;
        p.gunSpin = 0;
        p.gunCd = Math.max(p.gunCd, 0.25);
        CM.Audio.play('equip', { mat: 'iron' });
      }
      // clic droit sur une porte, un coffre, une station… : on laisse faire
      const tb = p.target ? CM.blocks[p.target.id] : null;
      if (input.pressed.mouse2 && tb && (tb.door || tb.container || tb.station || tb.bed || tb.use || tb.enchanter || tb.anvil) && !input.mouse[0]) return false;
      const busy = g.ui.invOpen;
      const aiming = !!input.mouse[2] && !busy && !p.gunReload && !p.sprinting;
      p.gunAim = Math.max(0, Math.min(1, (p.gunAim || 0) + (aiming ? dt * 7 : -dt * 9)));
      if (input.pressed[g.binds.reload] && !busy) this.startReload(p, held, gd);
      if (p.gunReload) {
        this.reloadTick(p, dt, held, gd);
        if (!(gd.perShell && input.pressed.mouse0 && (held.xp | 0) > 0)) return true;
        p.gunReload = null; // (fusil à pompe : un tir interrompt le rechargement)
      }
      // mitrailleuse : le canon se lance avant de tirer
      if (gd.spin) {
        const want = input.mouse[0] && !busy;
        p.gunSpin = Math.max(0, Math.min(1, (p.gunSpin || 0) + (want ? dt / gd.spin : -dt * 1.5)));
        if (want && p.gunSpin < 1 && Math.random() < dt * 8) CM.Audio.play('spin', { pitch: 0.6 + p.gunSpin });
      }
      p.gunRot = (p.gunRot || 0) + dt * 30 * (p.gunSpin || 0);
      let want = gd.auto ? input.mouse[0] : input.pressed.mouse0;
      if (gd.spin && p.gunSpin < 1) want = false;
      if (!want || busy || p.gunCd > 0) return true;
      const loaded = held.xp | 0;
      if (loaded <= 0 && !p.creative) {
        if (this.ammoLeft(g, gd) > 0) this.startReload(p, held, gd);
        else if (input.pressed.mouse0 || !gd.auto || Math.random() < dt * 3) {
          CM.Audio.play('dry');
          g.ui.toast('Plus de munitions : ' + CM.itemName(CM.I[gd.ammo]).toLowerCase() + ' (établi d’armurier)', 'warn', 'noammo');
          p.gunCd = 0.35;
        }
        return true;
      }
      this.fire(p, held, gd);
      return true;
    },
    reset(p) {
      p.gunAim = Math.max(0, (p.gunAim || 0) - 0.2);
      p.gunReload = null;
      p.gunSpin = 0;
      p.gunId = null;
    },
    startReload(p, stack, gd) {
      const g = p.game;
      if (p.gunReload || (stack.xp | 0) >= gd.mag) return;
      if (this.ammoLeft(g, gd) <= 0) {
        CM.Audio.play('dry');
        g.ui.toast('Plus de munitions : ' + CM.itemName(CM.I[gd.ammo]).toLowerCase(), 'warn', 'noammo');
        return;
      }
      p.gunReload = { t: gd.reload, total: gd.reload };
      p.gunAim = 0;
      CM.Audio.play('reload', { pitch: gd.perShell ? 1.2 : 1 });
      if (g.net.active) this.sendFx(g, { k: 'rl', x: r2(p.x), y: r2(p.y + 1.5), z: r2(p.z) });
    },
    reloadTick(p, dt, stack, gd) {
      const g = p.game, inv = g.inventory, rl = p.gunReload;
      rl.t -= dt;
      if (rl.t > 0) return;
      const need = gd.perShell ? 1 : gd.mag - (stack.xp | 0);
      let got;
      if (p.creative) got = need;
      else {
        // (lance-flammes : une cartouche de gaz donne plusieurs jets)
        const per = gd.per || 1, items = Math.min(inv.count(CM.I[gd.ammo]), Math.ceil(need / per));
        inv.remove(CM.I[gd.ammo], items);
        got = Math.min(need, items * per);
      }
      stack.xp = Math.min(gd.mag, (stack.xp | 0) + got);
      inv.changed();
      CM.Audio.play('click', { pitch: 0.7 });
      // fusil à pompe : une cartouche à la fois, tant qu'il en reste
      if (gd.perShell && (stack.xp | 0) < gd.mag && this.ammoLeft(g, gd) > 0) {
        rl.t = gd.reload;
        CM.Audio.play('reload', { pitch: 1.3 });
      } else p.gunReload = null;
    },

    // ------------------------------------------------------------ tir --
    muzzleAt(p) {
      const e = p.eye(), d = p.aim(), yaw = p.yaw;
      const rx = Math.cos(yaw), rz = -Math.sin(yaw), k = 1 - (p.gunAim || 0);
      return [e[0] + d[0] * 0.9 + rx * 0.22 * k, e[1] + d[1] * 0.9 - 0.16 * k - 0.05, e[2] + d[2] * 0.9 + rz * 0.22 * k];
    },
    fire(p, stack, gd) {
      const g = p.game, inv = g.inventory;
      p.gunCd = gd.rate;
      if (!p.creative) {
        stack.xp = Math.max(0, (stack.xp | 0) - 1);
        // (la barre de munitions de la case suit, sans tout redessiner à chaque balle)
        const now = g.clock;
        if (!(now - (p.gunInvT || 0) < 0.25) || stack.xp === 0) {
          p.gunInvT = now;
          inv.changed();
        } else inv.netDirty = true;
      }
      const e = p.eye(), d = p.aim(), mz = this.muzzleAt(p);
      const moving = Math.hypot(p.vx, p.vz) > 1, air = !p.onGround && !p.flying;
      const spread = (gd.spread + (gd.aim - gd.spread) * (p.gunAim || 0)) * (moving ? 1.4 : 1) * (air ? 1.8 : 1);
      const ends = [];
      if (gd.proj === 'missile' || gd.proj === 'grenade') {
        // (lancé depuis l'axe de la vue : jamais depuis l'intérieur d'un bloc voisin)
        const v = gd.proj === 'missile' ? 42 : 24, dir = this.jitter(d, spread);
        g.entities.shootArrow(e[0] + d[0] * 0.5, e[1] + d[1] * 0.5 - 0.1, e[2] + d[2] * 0.5, dir[0] * v, dir[1] * v + (gd.proj === 'grenade' ? 2.5 : 0), dir[2] * v, p, gd.proj, 0, { np: 1 });
      } else if (gd.proj === 'flame') {
        this.flame(p, gd, e, d, mz);
        ends.push([mz[0] + d[0] * 8, mz[1] + d[1] * 8, mz[2] + d[2] * 8]);
      }
      else for (let i = 0; i < (gd.pellets || 1); i++) ends.push(this.hitscan(p, gd, e, this.jitter(d, spread)));
      // recul
      const kick = gd.recoil * (p.gunAim > 0.5 ? 0.6 : 1) * (p.sneaking ? 0.7 : 1);
      p.pitch = Math.min(1.55, p.pitch + kick);
      p.yaw += (Math.random() - 0.5) * kick * 0.5;
      p.gunKick = Math.min(1.4, (p.gunKick || 0) + (gd.proj === 'flame' ? 0.05 : 0.6 + gd.recoil * 4));
      if (gd.proj !== 'flame') p.gunFlash = 0.05;
      if (gd.proj === 'missile') {
        // souffle arrière
        const b = p.aim();
        g.entities.burst(CM.Textures.layer.smoke, p.x - b[0] * 1.2, p.y + 1.4 - b[1], p.z - b[2] * 1.2, 14, { speed: 3, grav: -0.5, life: 0.9, size: 0.3 });
      }
      this.shotFx(g, gd, mz, ends, 1);
      // (lance-flammes : les autres joueurs voient le jet, sans un message à chaque flamme)
      if (g.net.active && (gd.proj !== 'flame' || !(g.clock - (p.gunNetT || 0) < 0.15))) {
        p.gunNetT = g.clock;
        this.sendFx(g, { k: 'shot', g: stack.id, a: mz.map(r2), b: ends.map((q) => q.map(r2)) });
      }
    },
    jitter(d, s) {
      if (!s) return d;
      // cône gaussien autour de la direction visée
      const a = Math.random() * Math.PI * 2, r = s * Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * 0.7;
      let ux = -d[2], uy = 0, uz = d[0];
      let ul = Math.hypot(ux, uz);
      if (ul < 1e-4) {
        ux = 1;
        ul = 1;
      }
      ux /= ul;
      uz /= ul;
      const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      const x = d[0] + ux * ca + vx * sa, y = d[1] + uy * ca + vy * sa, z = d[2] + uz * ca + vz * sa, l = Math.hypot(x, y, z);
      return [x / l, y / l, z / l];
    },
    // Balle : traverse le verre (qui se brise), s'arrête sur un bloc ; blesse créatures et joueurs.
    hitscan(p, gd, e, d) {
      const g = p.game, w = g.world;
      let ox = e[0], oy = e[1], oz = e[2], left = gd.range, pierce = gd.pierce | 0, glass = 3;
      const hitSet = new Set();
      for (let guard = 0; guard < 6; guard++) {
        const bh = w.raycast(ox, oy, oz, d[0], d[1], d[2], left, (id) => !CM.isFluid(id) && (CM.blocks[id].solid || glassy(CM.blocks[id])));
        const maxT = bh ? bh.t : left;
        // créatures et joueurs sur le trajet, du plus proche au plus lointain
        const cands = [];
        for (const m of g.entities.mobs) {
          if (m.dead || hitSet.has(m)) continue;
          const t = CM.rayBox(ox, oy, oz, d[0], d[1], d[2], m.x - m.hw, m.y, m.z - m.hw, m.x + m.hw, m.y + m.h, m.z + m.hw);
          if (t >= 0 && t < maxT) cands.push({ t, m });
        }
        if (g.net.active && g.net.rules.pvp)
          for (const rp of g.net.remotes.values()) {
            if (!rp.seen || !rp.alive || rp.dim !== g.playerDim || hitSet.has(rp)) continue;
            const t = CM.rayBox(ox, oy, oz, d[0], d[1], d[2], rp.x - 0.3, rp.y, rp.z - 0.3, rp.x + 0.3, rp.y + 1.8, rp.z + 0.3);
            if (t >= 0 && t < maxT) cands.push({ t, rp });
          }
        cands.sort((a, b) => a.t - b.t);
        for (const c of cands) {
          const hy = oy + d[1] * c.t;
          if (c.m) {
            hitSet.add(c.m);
            const head = hy > c.m.y + c.m.h * 0.78, st = g.stats;
            // (succès : tir à la tête, tir de loin)
            if (head) st.headshots = (st.headshots || 0) + 1;
            st.longShot = Math.max(st.longShot || 0, Math.round(Math.hypot(ox - e[0], oy - e[1], oz - e[2]) + c.t));
            this.hitMob(p, c.m, gd.dmg * (head ? 1.6 : 1), gd, head);
          } else {
            hitSet.add(c.rp);
            const head = hy > c.rp.y + 1.45;
            this.hitPlayer(p, c.rp, gd.dmg * (head ? 1.6 : 1), head);
          }
          if (pierce-- <= 0) return [ox + d[0] * c.t, oy + d[1] * c.t, oz + d[2] * c.t];
        }
        if (!bh) return [ox + d[0] * left, oy + d[1] * left, oz + d[2] * left];
        const hx = ox + d[0] * bh.t, hy = oy + d[1] * bh.t, hz = oz + d[2] * bh.t, b = CM.blocks[bh.id];
        if (glassy(b) && glass-- > 0) {
          // le verre vole en éclats et la balle continue
          p.breakBlock(bh.x, bh.y, bh.z, bh.id, false, true);
          ox = hx + d[0] * 0.05;
          oy = hy + d[1] * 0.05;
          oz = hz + d[2] * 0.05;
          left -= bh.t + 0.05;
          continue;
        }
        // impact : éclats du bloc
        const lay = CM.blockLayers[bh.id] && CM.blockLayers[bh.id][0];
        if (lay !== undefined) g.entities.burst(lay, hx - d[0] * 0.05, hy - d[1] * 0.05, hz - d[2] * 0.05, 4, { speed: 2.5, spread: 0.05, size: 0.05, life: 0.5 });
        g.entities.burst(CM.Textures.layer.smoke, hx - d[0] * 0.08, hy - d[1] * 0.08, hz - d[2] * 0.08, 1, { speed: 0.4, grav: -0.5, life: 0.5, size: 0.08 });
        if (Math.random() < 0.3) CM.Audio.play('ricochet', { vol: 0.5 });
        return [hx, hy, hz];
      }
      return [ox, oy, oz];
    },
    hitMob(p, m, dmg, gd, head) {
      const g = p.game, ents = g.entities;
      if (p.creative) dmg = Math.max(dmg, 30);
      dmg = Math.max(0.5, dmg + (CM.Effects.dmgBonus(p) || 0) * 0.5);
      this.marker = 0.22;
      this.markerHead = head;
      ents.burst(CM.Textures.layer.white, m.x, m.y + m.h * (head ? 0.85 : 0.55), m.z, head ? 8 : 4, { speed: 3, grav: 4, life: 0.35, size: 0.05, emissive: true });
      if (g.net.isClient) {
        m.hurt = 0.35;
        m.localHit = g.clock;
        CM.Audio.play(m.type === 'ombre' || m.type === 'ardent' ? 'shadow_hurt' : 'hit');
        g.net.send({ t: 'ghit', id: m.uid, d: r2(dmg), kb: gd.kb | 0, fi: gd.proj === 'flame' ? 1 : 0 });
        return;
      }
      ents.hurtMob(m, dmg, [p.x, p.z], false, p, { kb: gd.kb | 0, fire: gd.proj === 'flame' ? 1 : 0 });
      if (m.dead && p === g.player) g.stats.gunKills = (g.stats.gunKills || 0) + 1;
    },
    hitPlayer(p, rp, dmg, head) {
      const g = p.game;
      this.marker = 0.22;
      this.markerHead = head;
      if (g.net.isHost) rp.damage(dmg, p.x, p.z, g.net.name, true, 0); // (les balles passent entre les temps d'invulnérabilité)
      else g.net.send({ t: 'gpvp', to: rp.pid, d: r2(dmg) });
    },
    // Lance-flammes : un cône de 8 blocs ; les créatures s'enflamment, le bois aussi.
    flame(p, gd, e, d, mz) {
      const g = p.game, w = g.world, L = CM.Textures.layer;
      for (let i = 0; i < 3; i++) {
        const q = this.jitter(d, 0.12), sp = 9 + Math.random() * 4;
        g.entities.burst(L.flame, mz[0], mz[1], mz[2], 1, { speed: 0.8, spread: 0.1, vx: q[0] * sp + p.vx, vy: q[1] * sp, vz: q[2] * sp + p.vz, grav: -2, life: 0.7, size: 0.18, emissive: true });
      }
      const bh = w.raycast(e[0], e[1], e[2], d[0], d[1], d[2], gd.range, (id) => !CM.isFluid(id) && CM.blocks[id].solid);
      const reach = bh ? bh.t : gd.range;
      const now = g.clock;
      for (const m of g.entities.mobs) {
        if (m.dead) continue;
        const cx = m.x - e[0], cy = m.y + m.h / 2 - e[1], cz = m.z - e[2], dist = Math.hypot(cx, cy, cz);
        if (dist > reach + 0.5 || dist < 0.1) continue;
        const dot = (cx * d[0] + cy * d[1] + cz * d[2]) / dist;
        if (dot < 0.93 || now - (m.flameT || -9) < 0.25) continue;
        m.flameT = now;
        this.hitMob(p, m, gd.dmg * 4, gd, false);
      }
      if (g.net.active && g.net.rules.pvp)
        for (const rp of g.net.remotes.values()) {
          if (!rp.seen || !rp.alive || rp.dim !== g.playerDim) continue;
          const cx = rp.x - e[0], cy = rp.y + 0.9 - e[1], cz = rp.z - e[2], dist = Math.hypot(cx, cy, cz);
          if (dist > reach + 0.5 || (cx * d[0] + cy * d[1] + cz * d[2]) / (dist || 1) < 0.93 || now - (rp.flameT || -9) < 0.3) continue;
          rp.flameT = now;
          this.hitPlayer(p, rp, 2.5, false);
        }
      // le bloc touché prend feu (bois, laine, feuilles…)
      if (bh && Math.random() < 0.08 && CM.blocks[bh.id].flam) {
        const fx = bh.x + bh.nx, fy = bh.y + bh.ny, fz = bh.z + bh.nz;
        if (w.get(fx, fy, fz) === 0) w.setBlock(fx, fy, fz, CM.B.FIRE);
      }
      if (Math.random() < 0.35) CM.Audio.play('flame');
    },

    // --------------------------------------------------------- effets --
    // Éclair, traçantes, son (local = 1 : c'est notre tir).
    shotFx(g, gd, mz, ends, local) {
      const pl = g.player, dist = Math.hypot(mz[0] - pl.x, mz[1] - pl.y, mz[2] - pl.z);
      if (dist > 160) return;
      if (gd.proj === 'flame') {
        if (!local && dist < 40) CM.Audio.play('flame', { vol: Math.max(0.2, 1 - dist / 40) });
        return;
      }
      CM.Audio.play('gun', { g: gd.snd, vol: local ? 1 : Math.max(0.15, 1 - dist / 120) });
      if (!local) this.fx.push({ k: 'flash', a: mz, t: 0.06 });
      for (const b of ends) if (Math.random() < (gd.pellets ? 0.35 : 0.8)) this.fx.push({ k: 'tracer', a: mz, b, t: 0.07 });
      if (gd.proj !== 'flame' && Math.random() < 0.6) g.entities.burst(CM.Textures.layer.smoke, mz[0], mz[1], mz[2], 1, { speed: 0.5, grav: -1, life: 0.6, size: 0.1 });
    },
    sendFx(g, m) {
      if (g.net.isHost) g.net.fx(Object.assign({ x: m.x !== undefined ? m.x : m.a[0], y: m.y !== undefined ? m.y : m.a[1], z: m.z !== undefined ? m.z : m.a[2] }, m, { k: 'gun_' + m.k }));
      else g.net.send(Object.assign({ t: 'gfx' }, m));
    },
    // Effet reçu (d'un autre joueur).
    onFx(g, m) {
      if (m.k === 'gun_rl') {
        if (Math.hypot(m.x - g.player.x, m.z - g.player.z) < 24) CM.Audio.play('reload', { vol: 0.5 });
        return;
      }
      const gid = CM.GUN_OF[m.g | 0];
      if (!gid || !Array.isArray(m.a)) return;
      const gd = CM.GUNS[gid], num = (v) => (Number.isFinite(+v) ? +v : 0);
      const ends = Array.isArray(m.b) ? m.b.slice(0, 12).filter(Array.isArray).map((q) => q.map(num)) : [];
      if (gd.proj === 'flame') {
        const a = m.a.map(num), dir = ends[0] ? [ends[0][0] - a[0], ends[0][1] - a[1], ends[0][2] - a[2]] : null;
        if (dir) for (let i = 0; i < 8; i++) g.entities.burst(CM.Textures.layer.flame, a[0], a[1], a[2], 1, { speed: 0.8, spread: 0.1, vx: dir[0] * 1.2, vy: dir[1] * 1.2, vz: dir[2] * 1.2, grav: -2, life: 0.7, size: 0.18, emissive: true });
      }
      this.shotFx(g, gd, m.a.map(num), ends, 0);
    },
    tick(g, dt) {
      this.marker = Math.max(0, this.marker - dt);
      for (const f of this.fx) f.t -= dt;
      this.fx = this.fx.filter((f) => f.t > 0);
      this.hud(g);
    },
    // Traçantes et éclairs (dans le monde).
    render(g, batch, cam) {
      const L = CM.Textures.layer;
      for (const f of this.fx) {
        if (f.k === 'flash') {
          const M = this.flashM || (this.flashM = mat4.create());
          mat4.compose(M, f.a[0], f.a[1], f.a[2], Math.random() * 6, Math.random() * 6, 0, 1);
          batch.box(M, -0.12, -0.12, -0.12, 0.12, 0.12, 0.12, L.muzzle, 1, 1, 1);
          continue;
        }
        const a = f.a, b = f.b, dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
        if (len < 0.5) continue;
        // segment qui file : un morceau de la trajectoire, orienté face à la caméra
        const k0 = Math.max(0, 1 - f.t / 0.07 - 0.15), k1 = Math.min(1, k0 + Math.min(1, 6 / len));
        const p0 = [a[0] + dx * k0, a[1] + dy * k0, a[2] + dz * k0], p1 = [a[0] + dx * k1, a[1] + dy * k1, a[2] + dz * k1];
        const mx = (p0[0] + p1[0]) / 2 - cam[0], my = (p0[1] + p1[1]) / 2 - cam[1], mz = (p0[2] + p1[2]) / 2 - cam[2];
        let sx = dy * mz - dz * my, sy = dz * mx - dx * mz, sz = dx * my - dy * mx;
        const sl = Math.hypot(sx, sy, sz) || 1, wdt = 0.012;
        sx = (sx / sl) * wdt;
        sy = (sy / sl) * wdt;
        sz = (sz / sl) * wdt;
        batch.quad([[p0[0] - sx, p0[1] - sy, p0[2] - sz], [p0[0] + sx, p0[1] + sy, p0[2] + sz], [p1[0] + sx, p1[1] + sy, p1[2] + sz], [p1[0] - sx, p1[1] - sy, p1[2] - sz]], [[0, 0], [1, 0], [1, 1], [0, 1]], L.tracer, 1, 1, 1, 1);
      }
    },
    // Modèle 3D de l'arme (matrice M : origine à la poignée, canon vers -z).
    drawModel(batch, M, key, l, rot, flash) {
      const md = MODELS[key];
      if (!md) return;
      for (const q of md.parts) batch.box(M, q[0], q[1], q[2], q[3], q[4], q[5], layerOf(q[6]), l[0], l[1], 0);
      if (md.spin) {
        // six canons qui tournent
        for (let i = 0; i < 6; i++) {
          const a = (rot || 0) + (i * Math.PI) / 3, cx = Math.cos(a) * 0.042, cy = 0.01 + Math.sin(a) * 0.042;
          batch.box(M, cx - 0.012, cy - 0.012, -0.78, cx + 0.012, cy + 0.012, -0.24, layerOf(i % 2 ? 'metal' : 'dark'), l[0], l[1], 0);
        }
      }
      if (flash) {
        const z = md.muzzle, s = 0.07 + Math.random() * 0.04;
        batch.box(M, -s, 0.02 - s, z - s * 2, s, 0.02 + s, z, CM.Textures.layer.muzzle, 1, 1, 1);
      }
    },
    // Arme en main (vue à la première personne).
    drawHand(p, batch, stack, l, bx, by) {
      const gd = this.def(stack), key = CM.itemInfo(stack.id).gun, md = MODELS[key];
      if (!md) return false;
      const M = p.M, a = p.gunAim || 0;
      // lunette : l'arme disparaît derrière la vue de la lunette
      if (gd.scope && a > 0.85) return true;
      const kick = p.gunKick || 0, rl = p.gunReload ? Math.sin(Math.min(1, 1 - p.gunReload.t / p.gunReload.total) * Math.PI) : 0;
      // à la hanche : en bas à droite ; en visant : la mire au centre de l'écran
      const S = md.scale || 1;
      const hx = 0.3 * (1 - a) + bx * (1 - a * 0.8), hy = -0.3 * (1 - a) - (md.sight + 0.006) * S * a + by * (1 - a * 0.8) - rl * 0.2;
      const hz = -0.66 + 0.1 * a + kick * 0.07;
      mat4.compose(M, hx, hy, hz, 0.1 * (1 - a) + rl * 0.5, kick * 0.12 + rl * 0.5, -rl * 0.4, S);
      this.drawModel(batch, M, key, l, p.gunRot, p.gunFlash > 0);
      return true;
    },

    // ------------------------------------------------------------ HUD --
    hud(g) {
      const p = g.player, el = $('gun-hud');
      if (!el) return;
      const stack = g.inventory.held(), gd = p && p.alive ? this.def(stack) : null;
      const scope = $('scope');
      if (!gd || g.state !== 'playing') {
        if (!el.classList.contains('hidden')) el.classList.add('hidden');
        if (scope && !scope.classList.contains('hidden')) scope.classList.add('hidden');
        this.showMarker(false);
        return;
      }
      el.classList.remove('hidden');
      const left = this.ammoLeft(g, gd), n = stack.xp | 0;
      const txt = (p.creative ? '∞' : n + ' / ' + gd.mag) + ' · ' + (left === Infinity ? '∞' : left);
      const rl = p.gunReload ? Math.round((1 - p.gunReload.t / p.gunReload.total) * 100) : -1;
      const key = txt + '|' + rl + '|' + stack.id;
      if (el.dataset.k !== key) {
        el.dataset.k = key;
        el.innerHTML = '<div class="gh-name">' + CM.itemName(stack.id) + '</div><div class="gh-ammo' + (!p.creative && n === 0 ? ' empty' : '') + '">' + txt + '</div>' +
          (rl >= 0 ? '<div class="gh-reload"><div style="width:' + rl + '%"></div></div>' : '<div class="gh-hint">' + (!p.creative && n === 0 ? 'R : recharger' : '') + '</div>');
      }
      if (scope) scope.classList.toggle('hidden', !(gd.scope && p.gunAim > 0.85));
      this.showMarker(this.marker > 0);
    },
    showMarker(on) {
      const mk = $('hitmarker');
      if (!mk) return;
      mk.classList.toggle('hidden', !on);
      mk.classList.toggle('head', on && this.markerHead);
    },

    // --------------------------------------------------- grenade à main --
    grenadeHold(p, dt, input, stack) {
      const g = p.game;
      if (input.mouse[2] && !g.ui.invOpen) {
        if (!p.grenT) CM.Audio.play('click', { pitch: 1.6 }); // goupille
        p.grenT = (p.grenT || 0) + dt;
        return true;
      }
      if (p.grenT > 0.15) {
        const e = p.eye(), d = p.aim(), sp = 9 + Math.min(1, p.grenT) * 9;
        g.entities.shootArrow(e[0] + d[0] * 0.5, e[1] + d[1] * 0.5, e[2] + d[2] * 0.5, d[0] * sp + p.vx * 0.5, d[1] * sp + 3, d[2] * sp + p.vz * 0.5, p, 'hgrenade', 0, { np: 1 });
        if (!p.creative) g.inventory.consumeHeld(1);
        p.swing = 1;
        CM.Audio.play('bow', { pitch: 0.5 });
        p.grenT = 0;
        return true;
      }
      p.grenT = 0;
      return false;
    },

    // Coffres trouvés dans le monde (extension active) : munitions, pièces, parfois une arme.
    bonusLoot(g, slots, x, y, z) {
      if (!CM.extOn('guns') || g.world.end) return;
      const r = CM.rng((CM.hash3(x, y, z, g.world.seed + 4242) * 4294967296) >>> 0), I = CM.I;
      const add = (id, count, xp) => {
        const free = [];
        for (let i = 0; i < slots.length; i++) if (!slots[i]) free.push(i);
        if (!free.length) return;
        const it = { id, count };
        if (xp !== undefined) it.xp = xp;
        slots[free[Math.floor(r() * free.length)]] = it;
      };
      if (r() < 0.4) add(I.AMMO_PISTOL, 4 + Math.floor(r() * 12));
      if (r() < 0.25) add(I.AMMO_RIFLE, 4 + Math.floor(r() * 10));
      if (r() < 0.2) add(I.AMMO_SHELL, 2 + Math.floor(r() * 6));
      if (r() < 0.25) add(I.GUN_PARTS, 1 + Math.floor(r() * 3));
      if (r() < 0.1) add(I.GRENADE, 1 + Math.floor(r() * 3));
      if (r() < 0.08) {
        const pool = ['PISTOL', 'REVOLVER', 'SMG', 'SHOTGUN', 'DOUBLE_BARREL', 'HUNTING_RIFLE'], k = pool[Math.floor(r() * pool.length)];
        add(I[k], 1, Math.floor(r() * CM.GUNS[k].mag));
      }
    },

    // ------------------------------------------------ tir d'une créature --
    // Balle d'un bandit vers sa cible (précision acc : probabilité de toucher).
    mobShot(e, m, t, acc, dmg, cause) {
      const g = e.game, sx = m.x - Math.sin(m.yaw) * 0.5, sy = m.y + 1.4, sz = m.z - Math.cos(m.yaw) * 0.5;
      const hit = Math.random() < acc, ty = t.y + 1 + (hit ? 0 : (Math.random() - 0.5) * 2.5);
      const tx = t.x + (hit ? 0 : (Math.random() - 0.5) * 3), tz = t.z + (hit ? 0 : (Math.random() - 0.5) * 3);
      if (hit) e.hitPlayer(t, dmg, m, cause);
      const a = [sx, sy, sz], b = [tx, ty, tz];
      this.shotFx(g, CM.GUNS.PISTOL, a, [b], 0);
      if (g.net.isHost) g.net.fx({ k: 'gun_shot', g: CM.I.PISTOL, x: r2(sx), y: r2(sy), z: r2(sz), a: a.map(r2), b: [b.map(r2)] });
    },
  });

  // ------------------------------------------- projectiles (roquette, grenades) --
  const upd0 = E.updateSpecialArrow, ren0 = E.renderSpecialArrow;
  E.updateSpecialArrow = function (a, dt) {
    if (a.kind !== 'missile' && a.kind !== 'grenade' && a.kind !== 'hgrenade') return upd0.call(this, a, dt);
    const g = this.game, w = g.world, L = CM.Textures.layer;
    const boom = () => {
      a.dead = true;
      g.explode(a.x, a.y, a.z, POWER[a.kind]);
    };
    if (a.kind === 'hgrenade' && a.age > GRENADE_FUSE) {
      boom();
      return true;
    }
    if (a.age > 20 || a.y < CM.WORLD.MINY - 10) {
      a.dead = true;
      return true;
    }
    const steps = Math.max(1, Math.ceil((Math.hypot(a.vx, a.vy, a.vz) * dt) / 0.4));
    for (let s = 0; s < steps; s++) {
      const h = dt / steps;
      const nx = a.x + a.vx * h, ny = a.y + a.vy * h, nz = a.z + a.vz * h;
      // roquette et grenade du lance-grenades : explosent au contact (créature, joueur, bloc)
      if (a.kind !== 'hgrenade') {
        let touch = w.solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (!touch && a.age > 0.08)
          for (const m of this.mobs) if (!m.dead && Math.abs(m.x - nx) < m.hw + 0.25 && ny > m.y - 0.2 && ny < m.y + m.h + 0.2 && Math.abs(m.z - nz) < m.hw + 0.25) touch = true;
        if (!touch && a.age > 0.15)
          for (const q of this.plist) if (q.alive !== false && Math.abs(q.x - nx) < 0.55 && ny > q.y - 0.2 && ny < q.y + 2 && Math.abs(q.z - nz) < 0.55) touch = true;
        if (touch) {
          boom();
          return true;
        }
        a.x = nx;
        a.y = ny;
        a.z = nz;
      } else {
        // grenade à main : rebondit
        if (w.solidAt(Math.floor(nx), Math.floor(a.y), Math.floor(a.z))) a.vx *= -0.4;
        else a.x = nx;
        if (w.solidAt(Math.floor(a.x), Math.floor(a.y), Math.floor(nz))) a.vz *= -0.4;
        else a.z = nz;
        if (w.solidAt(Math.floor(a.x), Math.floor(ny), Math.floor(a.z))) {
          if (Math.abs(a.vy) > 3) CM.Audio.play('dig', { mat: 'metal' });
          a.vy *= -0.35;
          a.vx *= 0.7;
          a.vz *= 0.7;
        } else a.y = ny;
      }
    }
    if (a.kind === 'missile') {
      a.vy -= 2 * dt;
      if (Math.random() < dt * 40) this.burst(L.smoke, a.x, a.y, a.z, 1, { speed: 0.4, grav: -0.3, life: 0.8, size: 0.2 });
      if (Math.random() < dt * 30) this.burst(L.muzzle, a.x, a.y, a.z, 1, { speed: 0.5, grav: 0, life: 0.15, size: 0.12, emissive: true });
    } else {
      a.vy -= 22 * dt;
      if (Math.random() < dt * 8) this.burst(L.smoke, a.x, a.y + 0.1, a.z, 1, { speed: 0.2, grav: -1, life: 0.5, size: 0.06 });
    }
    return true;
  };
  E.renderSpecialArrow = function (batch, a, l) {
    if (a.kind !== 'missile' && a.kind !== 'grenade' && a.kind !== 'hgrenade') return ren0.call(this, batch, a, l);
    const L = CM.Textures.layer;
    if (a.kind === 'missile') {
      // orientation d'après la vitesse (ou le déplacement chez les invités)
      let vx = a.vx, vy = a.vy, vz = a.vz;
      if (!vx && !vy && !vz && a.lx !== undefined) {
        vx = a.x - a.lx;
        vy = a.y - a.ly;
        vz = a.z - a.lz;
      }
      a.lx = a.x;
      a.ly = a.y;
      a.lz = a.z;
      const yaw = Math.atan2(vx, vz), pitch = Math.atan2(-vy, Math.hypot(vx, vz));
      mat4.compose(this.M, a.x, a.y, a.z, yaw || 0, pitch || 0, 0, 1);
      batch.box(this.M, -0.06, -0.06, -0.3, 0.06, 0.06, 0.2, L.gunm_olive, l[0], l[1], 0);
      batch.box(this.M, -0.05, -0.05, 0.2, 0.05, 0.05, 0.34, L.gunm_orange, l[0], l[1], 0);
      batch.box(this.M, -0.04, -0.04, -0.42, 0.04, 0.04, -0.3, L.muzzle, 1, 1, 1);
      return true;
    }
    const t = (a.age || 0) * 9;
    mat4.compose(this.M, a.x, a.y, a.z, t, t * 0.6, 0, 1);
    batch.box(this.M, -0.08, -0.1, -0.08, 0.08, 0.1, 0.08, L.gunm_olive, l[0], l[1], 0);
    batch.box(this.M, -0.03, 0.1, -0.03, 0.03, 0.15, 0.03, L.gunm_metal, l[0], l[1], 0);
    return true;
  };
  const remote0 = E.updateExtraRemote;
  if (remote0)
    E.updateExtraRemote = function (dt) {
      remote0.call(this, dt);
      for (const a of this.arrows || []) if (a.kind === 'missile' || a.kind === 'grenade' || a.kind === 'hgrenade') a.age = (a.age || 0) + dt;
    };

  // --------------------------------------------------------------- succès --
  if (CM.Comfort && CM.Comfort.ACH) {
    const add = [
      ['gachette', '🔫', 'Gâchette facile', 'Vaincre une créature avec une arme à feu', (g) => (g.stats.gunKills || 0) > 0],
      ['mille', '🎯', 'En plein dans le mille', 'Toucher une créature à la tête', (g) => (g.stats.headshots || 0) > 0],
      ['lynx', '🔭', 'Œil de lynx', 'Toucher une créature à plus de 100 blocs', (g) => (g.stats.longShot || 0) >= 100],
      ['justicier', '🦹', 'Justicier', 'Vaincre 10 bandits', (g) => (g.stats.kills.bandit || 0) >= 10],
    ].map(([k, icon, name, desc, test]) => ({ k, icon, name, desc, test, ext: 'guns' }));
    const A = CM.Comfort.ACH, at = A.findIndex((a) => a.k === 'aube');
    A.splice(at < 0 ? A.length : at, 0, ...add);
  }

  // --------------------------------------------------- apparition des bandits --
  // La nuit, en surface : parfois un bandit à la place d'une Ombre (souvent en ville).
  const hostile0 = E.hostileFor;
  E.hostileFor = function (w, x, y, z) {
    const t = hostile0.call(this, w, x, y, z);
    if (!CM.extOn('guns') || w.nether || w.end || y < CM.WORLD.SEA - 4) return t;
    const city = w.city && w.city.urban && w.city.urban(x, z);
    return this.rand() < (city ? 0.35 : 0.08) ? 'bandit' : t;
  };
})();
