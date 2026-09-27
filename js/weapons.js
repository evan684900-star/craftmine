'use strict';
// Arbalète (charge, tir multiple, perforation), trident (lancer, Loyauté, Impulsion, Canalisation,
// Empalement), élytres (vol plané, usure, énergie cinétique) et fusées (propulsion, feu d'artifice).
// Les projectiles sont des « flèches » (carts.js) de genre 'trident' ou 'rocket'.
(function () {
  const E = CM.Entities.prototype, mat4 = CM.mat4;
  const TAU = Math.PI * 2;
  const wrap = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };

  const W = (CM.Weapons = {
    chargeTime: (stack) => Math.max(0.25, 1.25 - 0.25 * CM.enchLevel(stack, 'quick_charge')),
    // Arme tenue (joueur de cet écran). true : l'action du clic droit est prise.
    update(p, dt, input) {
      const g = p.game, inv = g.inventory, held = inv.held(), info = held && CM.itemInfo(held.id);
      if (info && info.type === 'crossbow') {
        if (!input.mouse[2]) p.xbowWait = false;
        if (info.loaded) {
          p.xbowT = 0;
          if (input.pressed.mouse2 && !p.xbowWait && !g.ui.invOpen) {
            this.fireCrossbow(p, held);
            return true;
          }
          return false;
        }
        if (input.mouse[2] && !p.xbowWait && !g.ui.invOpen && (p.creative || inv.has(CM.I.ARROW))) {
          p.xbowT = (p.xbowT || 0) + dt;
          if (p.xbowT >= this.chargeTime(held)) {
            if (!p.creative) inv.remove(CM.I.ARROW, 1);
            held.id = CM.I.CROSSBOW_LOADED;
            inv.changed();
            p.xbowT = 0;
            p.xbowWait = true;
            CM.Audio.play('click', { pitch: 0.5 });
          }
          return true;
        }
        if (input.pressed.mouse2 && !p.creative && !inv.has(CM.I.ARROW)) g.ui.toast('Il faut une flèche pour charger l’arbalète', 'info', 'xbow');
        p.xbowT = 0;
        return false;
      }
      p.xbowT = 0;
      if (info && info.type === 'trident') {
        if (input.mouse[2] && !g.ui.invOpen) {
          p.tridT = (p.tridT || 0) + dt;
          return true;
        }
        if (p.tridT >= 0.45) {
          p.tridT = 0;
          this.throwTrident(p, held);
          return true;
        }
        p.tridT = 0;
      } else p.tridT = 0;
      return false;
    },
    fireCrossbow(p, stack) {
      const g = p.game, e = p.eye(), d = p.aim(), sp = 62;
      const multi = CM.enchLevel(stack, 'multishot'), pierce = CM.enchLevel(stack, 'piercing');
      for (const a of multi ? [0, -0.18, 0.18] : [0]) {
        const c = Math.cos(a), s = Math.sin(a), dx = d[0] * c - d[2] * s, dz = d[0] * s + d[2] * c;
        g.entities.shootArrow(e[0] + dx * 0.4, e[1] + d[1] * 0.4 - 0.1, e[2] + dz * 0.4, dx * sp, d[1] * sp, dz * sp, p, undefined, 0, { pi: pierce, np: a !== 0 || p.creative ? 1 : 0 });
      }
      stack.id = CM.I.CROSSBOW;
      g.inventory.changed();
      p.swing = 1;
      p.xbowWait = true;
      CM.Audio.play('bow', { pitch: 1.5 });
    },
    throwTrident(p, stack) {
      const g = p.game, rip = CM.enchLevel(stack, 'riptide');
      if (rip) {
        // Impulsion : on est projeté (seulement mouillé : dans l'eau ou sous la pluie)
        const wet = p.inWater || ((g.wLevel || 0) > 0.5 && CM.Weather.exposed(g, p.x, p.y + 1.7, p.z));
        if (!wet) {
          g.ui.toast('Impulsion : seulement dans l’eau ou sous la pluie', 'info', 'riptide');
          return;
        }
        const d = p.look(), v = 12 + rip * 6;
        p.vx = d[0] * v;
        p.vy = d[1] * v + 3;
        p.vz = d[2] * v;
        p.riptideT = 0.9;
        p.riptideHit = new Set();
        p.fallStart = p.y;
        p.swing = 1;
        CM.Audio.play('dash', { pitch: 0.8 });
        g.entities.burst(CM.Textures.layer.white, p.x, p.y + 1, p.z, 16, { speed: 3, grav: 0, life: 0.5, size: 0.06 });
        return;
      }
      const e = p.eye(), d = p.aim(), sp = 32;
      g.entities.shootArrow(e[0] + d[0] * 0.5, e[1] + d[1] * 0.5 - 0.1, e[2] + d[2] * 0.5, d[0] * sp, d[1] * sp + 1, d[2] * sp, p, 'trident', CM.I.TRIDENT, { ench: stack.ench, np: p.creative ? 1 : 0 });
      if (!p.creative) {
        g.inventory.slots[g.inventory.selected] = null;
        g.inventory.changed();
      }
      p.swing = 1;
      CM.Audio.play('bow', { pitch: 0.55 });
    },
    // Riptide : les créatures touchées pendant l'élan sont blessées.
    riptide(p, dt) {
      if (!(p.riptideT > 0)) return;
      p.riptideT -= dt;
      const g = p.game;
      for (const m of g.entities.mobs) {
        if (m.dead || p.riptideHit.has(m.uid) || Math.hypot(m.x - p.x, m.y + m.h / 2 - p.y - 0.9, m.z - p.z) > 1.6) continue;
        p.riptideHit.add(m.uid);
        g.entities.hurtMob(m, 8, [p.x, p.z], false, p);
      }
      if (Math.random() < dt * 30) g.entities.burst(CM.Textures.layer.white, p.x, p.y + 0.9, p.z, 2, { speed: 1.5, grav: 0, life: 0.4, size: 0.05 });
    },

    // --------------------------------------------------------- élytres --
    wearing(p) {
      const s = p.game.inventory.armor[1], i = s && CM.itemInfo(s.id);
      return i && i.elytra ? s : null;
    },
    stopGlide(p) {
      p.gliding = false;
      p.boostT = 0;
      p.h = 1.8;
    },
    // Vol plané : true si le vol a remplacé les déplacements de cette image.
    glide(p, dt, input, wasHeadIn) {
      const g = p.game, w = g.world, K = g.binds;
      const el = this.wearing(p), info = el && CM.itemInfo(el.id);
      const usable = el && (el.xp || 0) < info.maxDur - 1;
      const free = p.alive && !p.flying && !p.inFluid && (p.mount === null || p.mount === undefined) && (p.riding === null || p.riding === undefined);
      if (!p.gliding) {
        if (!(free && usable && !p.onGround && input.pressed[K.jump] && p.vy < 1)) return false;
        p.gliding = true;
        p.glideWear = 0;
        p.h = 0.6;
        CM.Audio.play('dash', { pitch: 0.6 });
      }
      if (!free || !usable || p.onGround) {
        if (el && !usable) g.ui.toast('Élytres abîmées : répare-les avec du cuir à l’enclume', 'warn', 'elytra');
        this.stopGlide(p);
        return false;
      }
      // physique du vol (comme dans Minecraft, par secondes : 20 pas par seconde)
      const k = dt * 20, look = p.look(), cp = Math.cos(p.pitch), c2 = cp * cp;
      const hl = Math.hypot(look[0], look[2]) || 1, fx = look[0] / hl, fz = look[2] / hl;
      let hs = Math.hypot(p.vx, p.vz);
      p.vy += (-0.08 + c2 * 0.06) * 20 * k;
      if (p.vy < 0 && hl > 0) {
        const t = -p.vy * 0.1 * c2 * k;
        p.vy += t;
        p.vx += fx * t;
        p.vz += fz * t;
      }
      if (p.pitch > 0 && hl > 0) {
        const t = hs * Math.sin(p.pitch) * 0.04 * k;
        p.vy += t * 3.2;
        p.vx -= fx * t;
        p.vz -= fz * t;
      }
      hs = Math.hypot(p.vx, p.vz);
      p.vx += (fx * hs - p.vx) * Math.min(1, 0.1 * k);
      p.vz += (fz * hs - p.vz) * Math.min(1, 0.1 * k);
      // fusée : poussée vers là où l'on regarde
      if (p.boostT > 0) {
        p.boostT -= dt;
        const a = Math.min(1, dt * 1.8);
        p.vx += (look[0] * 32 - p.vx) * a;
        p.vy += (look[1] * 32 - p.vy) * a;
        p.vz += (look[2] * 32 - p.vz) * a;
        if (Math.random() < dt * 30) g.entities.burst(CM.Textures.layer.white, p.x, p.y + 0.3, p.z, 1, { speed: 0.4, grav: 0, life: 0.6, size: 0.08, emissive: true });
      }
      p.vx *= Math.pow(0.99, k);
      p.vy *= Math.pow(0.98, k);
      p.vz *= Math.pow(0.99, k);
      const before = Math.hypot(p.vx, p.vz), vy0 = p.vy;
      CM.Physics.move(w, p, p.vx * dt, p.vy * dt, p.vz * dt);
      // contre un mur à pleine vitesse : ça fait mal (énergie cinétique)
      if (p.hitX || p.hitZ) {
        if (before > 14) p.damage((before - 14) * 0.5, null, null, 'L’énergie cinétique', true);
        if (p.hitX) p.vx = 0;
        if (p.hitZ) p.vz = 0;
      }
      if (p.hitY) {
        if (vy0 < -18 && p.onGround) p.damage((-vy0 - 18) * 0.5, null, null, 'Un atterrissage trop rapide', true);
        p.vy = 0;
      }
      p.fallStart = p.y;
      // usure : un point par seconde de vol (Solidité : moins souvent)
      p.glideWear += dt;
      if (p.glideWear >= 1) {
        p.glideWear -= 1;
        const ub = CM.enchLevel(el, 'unbreaking');
        if (!p.creative && Math.random() >= ub / (ub + 1)) {
          el.xp = (el.xp || 0) + 1;
          g.ui.dirtyInv = true;
        }
      }
      p.eyeOffset += (1.15 - p.eyeOffset) * Math.min(1, dt * 10);
      p.sneaking = p.sprinting = false;
      if (Math.hypot(p.vx, p.vy, p.vz) > 12 && Math.random() < dt * 4) CM.Audio.play('cast', { vol: 0.4 });
      p.updateVitals(dt, wasHeadIn);
      p.updateTarget();
      p.updateActions(dt, input);
      return true;
    },
    // Fusée tenue : propulsion en vol, sinon feu d'artifice.
    useRocket(p) {
      const g = p.game;
      if (p.gliding) {
        p.boostT = 1.4;
        CM.Audio.play('fuse', { pitch: 1.6 });
      } else {
        const t = p.target, e = p.eye(), d = p.aim();
        const x = t ? t.x + 0.5 + t.nx * 0.6 : e[0] + d[0] * 1.5, y = t ? t.y + 0.5 + t.ny * 0.6 : e[1] + d[1] * 1.5, z = t ? t.z + 0.5 + t.nz * 0.6 : e[2] + d[2] * 1.5;
        g.entities.shootArrow(x, y, z, (Math.random() - 0.5) * 1.5, 18, (Math.random() - 0.5) * 1.5, p, 'rocket', CM.I.FIREWORK);
      }
      p.consume(1);
      p.swing = 1;
      p.useCd = 0.3;
    },
    // Bonus de mêlée d'une arme (trident) ; Empalement contre les créatures aquatiques.
    melee(stack, info, mob) {
      let dmg = info.melee || 1;
      const imp = CM.enchLevel(stack, 'impaling');
      if (imp && mob && CM.MOBS[mob.type] && CM.MOBS[mob.type].water) dmg += 2.5 * imp;
      return dmg;
    },
  });

  // ---------------------------------------------- projectiles spéciaux --
  // Trident et fusée (appelé par updateArrows pour ces genres). true : géré.
  E.updateSpecialArrow = function (a, dt) {
    const g = this.game, w = g.world;
    if (a.kind === 'rocket') {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z += a.vz * dt;
      a.vy += 4 * dt;
      if (Math.random() < dt * 40) this.burst(CM.Textures.layer.white, a.x, a.y - 0.3, a.z, 1, { speed: 0.3, grav: 1, life: 0.5, size: 0.05, emissive: true });
      if (a.age > 1.2 || w.solidAt(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))) {
        a.dead = true;
        // gerbe de couleurs
        const L = CM.Textures.layer, cols = ['concrete_red', 'concrete_yellow', 'concrete_light_blue', 'concrete_lime', 'concrete_magenta', 'concrete_orange'];
        const c1 = L[cols[Math.floor(Math.random() * cols.length)]] || L.white, c2 = L[cols[Math.floor(Math.random() * cols.length)]] || L.white;
        this.burst(c1, a.x, a.y, a.z, 40, { speed: 7, grav: 2, life: 1.4, size: 0.1, emissive: true, full: true });
        this.burst(c2, a.x, a.y, a.z, 30, { speed: 4, grav: 2, life: 1.2, size: 0.08, emissive: true, full: true });
        if (g.net) g.net.fx({ k: 'firework', x: Math.round(a.x * 10) / 10, y: Math.round(a.y * 10) / 10, z: Math.round(a.z * 10) / 10 });
        CM.Audio.play('explode', { pitch: 1.8, vol: 0.5 });
      }
      return true;
    }
    if (a.kind !== 'trident') return false;
    // Loyauté : il revient vers son lanceur
    if (a.ret) {
      const q = a.shooter;
      if (!q || q.alive === false || (q !== g.player && q.pid === undefined)) {
        a.dead = true;
        this.addDrop(a.item, 1, a.x, a.y, a.z, { xp: 0, ench: a.ench || undefined });
        return true;
      }
      const dx = q.x - a.x, dy = q.y + 1.2 - a.y, dz = q.z - a.z, d = Math.hypot(dx, dy, dz);
      if (d < 1.3) {
        a.dead = true;
        if (a.pick) this.giveTo(q, a.item, 1, { xp: 0, ench: a.ench || undefined });
        return true;
      }
      const sp = 12 + 5 * a.loyal;
      a.vx = (dx / d) * sp;
      a.vy = (dy / d) * sp;
      a.vz = (dz / d) * sp;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z += a.vz * dt;
      a.stuck = false;
      return true;
    }
    if (a.stuck) {
      // planté : on le ramasse (ou, fidèle, il revient)
      if (!w.get(a.bx, a.by, a.bz)) a.stuck = false;
      else if (a.loyal && a.age > 0.5) a.ret = true;
      else if (!a.pick) {
        if (a.age > 2) a.dead = true;
      } else if (a.age > 0.5)
        for (const q of this.plist) {
          if (q.alive === false || Math.hypot(q.x - a.x, q.y + 0.9 - a.y, q.z - a.z) > 1.6) continue;
          this.giveTo(q, a.item, 1, { xp: 0, ench: a.ench || undefined });
          a.dead = true;
          break;
        }
      return true;
    }
    return false; // en vol : trajectoire comme une flèche (updateArrows)
  };
  // Un trident touche une créature ou un joueur.
  E.tridentHit = function (a, hit) {
    const g = this.game;
    let dmg = 8;
    const imp = a.ench && a.ench.impaling;
    if (hit.m && imp && CM.MOBS[hit.m.type].water) dmg += 2.5 * imp;
    const by = a.shooter && (a.shooter === g.player || a.shooter.pid !== undefined) ? a.shooter : null;
    if (hit.m) this.hurtMob(hit.m, dmg, [a.x - a.vx * 0.01, a.z - a.vz * 0.01], false, by);
    else if (hit.p) hit.p.damage(dmg, a.x - a.vx * 0.01, a.z - a.vz * 0.01, a.shooter && a.shooter.type ? 'Un trident de Noyé' : 'Un trident');
    // Canalisation : pendant un orage, la foudre frappe la cible
    const tgt = hit.m || hit.p;
    if (a.ench && a.ench.channeling && tgt && CM.Weather.state(g).type === 'thunder' && CM.Weather.exposed(g, tgt.x, tgt.y + 2, tgt.z)) CM.Weather.strike(g, tgt.x, tgt.z);
    CM.Audio.play('arrowhit', { pitch: 0.7 });
    // il rebondit et retombe (ou revient)
    a.vx *= -0.1;
    a.vz *= -0.1;
    a.vy = 3;
    a.spent = true;
    if (a.loyal) a.ret = true;
    if (!a.pick && a.shooter && a.shooter.type) a.dead = true;
  };
  // Dessin : trident (manche, garde, trois pointes) et fusée.
  E.renderSpecialArrow = function (batch, a, l) {
    const L = CM.Textures.layer;
    if (a.kind === 'rocket') {
      mat4.compose(this.M, a.x, a.y, a.z, 0, 0, 0, 1);
      batch.box(this.M, -0.05, -0.25, -0.05, 0.05, 0.1, 0.05, L.rocket_ent, 1, 1, 1);
      return true;
    }
    if (a.kind !== 'trident') return false;
    let yaw = a.yaw, pitch = a.pitch;
    if (!a.stuck && (a.vx || a.vy || a.vz)) {
      yaw = Math.atan2(a.vx, a.vz);
      pitch = Math.atan2(-a.vy, Math.hypot(a.vx, a.vz));
    }
    if (a.ret) {
      yaw = Math.atan2(-a.vx, -a.vz);
      pitch = Math.atan2(a.vy, Math.hypot(a.vx, a.vz));
    }
    mat4.compose(this.M, a.x, a.y, a.z, yaw || 0, pitch || 0, 0, 1);
    const S = L.trident_ent, T = L.trident_tip, M = this.M;
    batch.box(M, -0.03, -0.03, -1.2, 0.03, 0.03, 0.05, S, l[0], l[1], 0);
    batch.box(M, -0.16, -0.03, -0.02, 0.16, 0.03, 0.05, T, l[0], l[1], 0);
    for (const x of [-0.14, 0, 0.14]) batch.box(M, x - 0.025, -0.025, 0.05, x + 0.025, 0.025, x ? 0.28 : 0.34, T, l[0], l[1], 0);
    return true;
  };

  // --------------------------------------------- joueurs (autres écrans) --
  // Ailes des élytres dans le dos d'un joueur (ouvertes en vol).
  W.renderWings = function (ents, batch, M, l, fl, gliding) {
    const L = CM.Textures.layer, s = gliding ? 1.1 : 0.2;
    ents.part(batch, M, -0.08, 1.3, 0.14, gliding ? 0.2 : 0.12, [-0.5, -0.9, 0, 0, 0, 0.04], L.elytra_wing, l, fl, null, 0, -s);
    ents.part(batch, M, 0.08, 1.3, 0.14, gliding ? 0.2 : 0.12, [0, -0.9, 0, 0.5, 0, 0.04], L.elytra_wing, l, fl, null, 0, s);
  };
  // Matrice d'un joueur allongé en vol plané (pivot au milieu du corps).
  W.glideMatrix = function (out, tmpA, tmpB, x, y, z, yaw, pitch) {
    mat4.compose(tmpA, x, y + 0.3, z, yaw, -Math.PI / 2 + Math.max(-0.8, Math.min(0.8, pitch)) * 0.6, 0, 1);
    mat4.compose(tmpB, 0, -0.9, 0, 0, 0, 0, 1);
    mat4.multiply(out, tmpA, tmpB);
  };
  W.wrap = wrap;
})();
