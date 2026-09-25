'use strict';
// Flèches (arc, distributeur) et wagonnets sur rails (comme dans Minecraft).
// L'hôte (ou la partie solo) simule ; les invités reçoivent un instantané et dessinent.
(function () {
  const E = CM.Entities.prototype;
  const mat4 = CM.mat4;
  const DV = CM.DIRV;
  const r2 = (v) => Math.round(v * 100) / 100;
  const railRs = (id) => {
    const rs = (CM.blocks[id] || CM.blocks[0]).rs;
    return rs && rs.k === 'rail' ? rs : null;
  };
  const MAXV = 8; // vitesse maximale d'un wagonnet (blocs par seconde)

  // Objet donné à un joueur (local ou invité).
  E.giveTo = function (q, id, n) {
    const g = this.game;
    if (q === g.player) {
      const left = g.inventory.add(id, n);
      if (left < n) {
        CM.Audio.play('pop');
        g.onPickup(id, n - left);
      }
      if (left > 0) this.addDrop(id, left, q.x, q.y + 0.5, q.z);
    } else if (q.pid !== undefined) g.net.sendTo(q.pid, { t: 'give', id, n });
  };

  // ------------------------------------------------------------ flèches --
  E.shootArrow = function (x, y, z, vx, vy, vz, shooter) {
    if (this.remote) {
      this.game.net.send({ t: 'arrow', p: [r2(x), r2(y), r2(z)], v: [r2(vx), r2(vy), r2(vz)] });
      return;
    }
    const g = this.game;
    if (!this.arrows) this.arrows = [];
    this.arrows.push({ uid: CM.newUid(), x, y, z, vx, vy, vz, age: 0, stuck: false, shooter: shooter || null, pick: !shooter || g.mode !== 'creative' });
    CM.Audio.play('bow', { pitch: 0.9 + Math.random() * 0.2 });
  };
  E.updateArrows = function (dt) {
    const g = this.game, w = g.world;
    for (const a of this.arrows) {
      a.age += dt;
      if (a.age > 60) a.dead = true;
      if (a.dead) continue;
      if (a.stuck) {
        if (!w.get(a.bx, a.by, a.bz)) a.stuck = false; // le bloc a disparu : la flèche retombe
        else {
          if (a.pick && a.age > 0.4)
            for (const q of this.plist) {
              if (q.alive === false || Math.hypot(q.x - a.x, q.y + 0.9 - a.y, q.z - a.z) > 1.4) continue;
              this.giveTo(q, CM.I.ARROW, 1);
              a.dead = true;
              break;
            }
          continue;
        }
      }
      const sp = Math.hypot(a.vx, a.vy, a.vz);
      const len = sp * dt;
      if (len > 1e-4) {
        const dx = a.vx / sp, dy = a.vy / sp, dz = a.vz / sp;
        let hit = null, ht = len;
        for (const m of this.mobs) {
          if (m.dead) continue;
          const t = CM.rayBox(a.x, a.y, a.z, dx, dy, dz, m.x - m.hw, m.y, m.z - m.hw, m.x + m.hw, m.y + m.h, m.z + m.hw);
          if (t >= 0 && t < ht) {
            ht = t;
            hit = { m };
          }
        }
        for (const q of this.plist) {
          if (q.alive === false || (q === a.shooter && a.age < 0.4)) continue;
          const t = CM.rayBox(a.x, a.y, a.z, dx, dy, dz, q.x - 0.3, q.y, q.z - 0.3, q.x + 0.3, q.y + 1.8, q.z + 0.3);
          if (t >= 0 && t < ht) {
            ht = t;
            hit = { p: q };
          }
        }
        const bh = w.raycast(a.x, a.y, a.z, dx, dy, dz, ht, (id) => !CM.isFluid(id) && !(CM.blocks[id].rs && CM.blocks[id].rs.k === 'tripwire'));
        if (bh) {
          // plantée dans le bloc
          a.x += dx * Math.max(0, bh.t - 0.04);
          a.y += dy * Math.max(0, bh.t - 0.04);
          a.z += dz * Math.max(0, bh.t - 0.04);
          a.yaw = Math.atan2(dx, dz);
          a.pitch = Math.atan2(-dy, Math.hypot(dx, dz));
          a.stuck = true;
          a.bx = bh.x;
          a.by = bh.y;
          a.bz = bh.z;
          a.vx = a.vy = a.vz = 0;
          const p = g.player;
          if (p && Math.hypot(p.x - a.x, p.z - a.z) < 24) CM.Audio.play('arrowhit');
          const rs = CM.blocks[bh.id].rs;
          if (rs && rs.k === 'target' && g.ticks.rs) g.ticks.rs.hitTarget(bh.x, bh.y, bh.z, a.x + dx * 0.04, a.y + dy * 0.04, a.z + dz * 0.04);
          if (rs && rs.k === 'button' && rs.wood && !rs.on) w.setBlock(bh.x, bh.y, bh.z, CM.rsWith(bh.id, { on: true }));
          if (CM.blocks[bh.id].tnt && a.fire) g.primeTnt(bh.x, bh.y, bh.z);
          continue;
        }
        if (hit) {
          const dmg = Math.max(1, Math.round(sp * 0.13));
          const by = a.shooter && (a.shooter === g.player || a.shooter.pid !== undefined) ? a.shooter : null;
          if (hit.m) this.hurtMob(hit.m, dmg, [a.x - dx, a.z - dz], false, by);
          else if (hit.p === g.player) hit.p.damage(dmg, a.x - dx, a.z - dz, 'Une flèche');
          else hit.p.damage(dmg, a.x - dx, a.z - dz, 'Une flèche');
          a.dead = true;
          CM.Audio.play('arrowhit');
          continue;
        }
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.z += a.vz * dt;
      }
      a.vy -= 20 * dt;
      const drag = Math.pow(CM.isWater(w.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))) ? 0.6 : 0.99, dt * 20);
      a.vx *= drag;
      a.vy *= drag;
      a.vz *= drag;
      if (a.y < CM.WORLD.MINY - 20) a.dead = true;
    }
    this.arrows = this.arrows.filter((a) => !a.dead);
  };
  E.renderArrows = function (batch) {
    const L = CM.Textures.layer.arrow_ent;
    for (const a of this.arrows || []) {
      const l = this.lightAt(a.x, a.y, a.z);
      let yaw = a.yaw, pitch = a.pitch;
      if (!a.stuck && (a.vx || a.vy || a.vz)) {
        yaw = Math.atan2(a.vx, a.vz);
        pitch = Math.atan2(-a.vy, Math.hypot(a.vx, a.vz));
      }
      mat4.compose(this.M, a.x, a.y, a.z, yaw || 0, pitch || 0, 0, 1);
      batch.box(this.M, -0.025, -0.025, -0.55, 0.025, 0.025, 0.05, L, l[0], l[1], 0);
      batch.box(this.M, -0.06, -0.01, -0.55, 0.06, 0.01, -0.42, CM.Textures.layer.white, l[0], l[1], 0);
    }
  };

  // ----------------------------------------------------------- wagonnets --
  E.addCart = function (type, x, y, z, from) {
    if (this.remote) {
      this.game.net.send({ t: 'cart', ty: type, p: [r2(x), r2(y), r2(z)] });
      return null;
    }
    if (!this.carts) this.carts = [];
    const c = Object.assign(
      { uid: CM.newUid(), type, x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, hw: 0.45, h: 0.7, onGround: false, rider: null, hp: 6, fuse: 0, lock: 0, hc: 0 },
      from || {},
    );
    if ((type === 'chest' || type === 'hopper') && !c.slots) c.slots = new Array(type === 'chest' ? 27 : 5).fill(null);
    this.carts.push(c);
    return c;
  };
  // Pour la sauvegarde : état des wagonnets de cette dimension.
  E.cartList = function () {
    return (this.carts || []).filter((c) => !c.dead).map((c) => ({ type: c.type, x: r2(c.x), y: r2(c.y), z: r2(c.z), yaw: r2(c.yaw), slots: c.slots || undefined }));
  };
  E.cartByUid = function (uid) {
    return (this.carts || []).find((c) => c.uid === uid && !c.dead) || null;
  };
  E.raycastCart = function (ox, oy, oz, dx, dy, dz, maxD) {
    let best = null, bt = maxD;
    for (const c of this.carts || []) {
      if (c.dead) continue;
      const t = CM.rayBox(ox, oy, oz, dx, dy, dz, c.x - 0.5, c.y, c.z - 0.5, c.x + 0.5, c.y + 0.75, c.z + 0.5);
      if (t >= 0 && t < bt) {
        bt = t;
        best = c;
      }
    }
    return best ? { cart: best, t: bt } : null;
  };
  // Rail sous le wagonnet (la case du wagonnet, ou celle du dessous).
  const railAt = (w, c) => {
    const x = Math.floor(c.x), z = Math.floor(c.z);
    for (const y of [Math.floor(c.y + 0.1), Math.floor(c.y + 0.1) - 1]) {
      const rs = railRs(w.get(x, y, z));
      if (rs) return { x, y, z, rs };
    }
    return null;
  };
  // Hauteur des rails en montée à la position (fx, fz) dans la case (0..1).
  const railY = (shape, fx, fz) => (shape === 2 ? fx : shape === 3 ? 1 - fx : shape === 4 ? fz : shape === 5 ? 1 - fz : 0);
  E.updateCarts = function (dt) {
    const g = this.game, w = g.world;
    for (const c of this.carts) {
      if (c.dead) continue;
      if (!w.loaded(c.x, c.z)) continue;
      // passager parti (mort, déconnecté, autre dimension) : la place se libère
      if (c.rider === 'local' && (g.dim !== g.playerDim || !g.player.alive || g.player.riding !== c.uid)) c.rider = null;
      if (typeof c.rider === 'number') {
        const rp = g.net.remotes.get(c.rider);
        if (!rp || !rp.seen || rp.alive === false || rp.dim !== g.dim) c.rider = null;
      }
      if (c.rider === null) c.push = null;
      const r = railAt(w, c);
      if (r) this.cartOnRail(c, r, dt);
      else {
        c.vy = Math.max(c.vy - 28 * dt, -40);
        const fr = c.onGround ? Math.pow(0.5, dt * 20) : Math.pow(0.99, dt * 20);
        c.vx *= fr;
        c.vz *= fr;
        CM.Physics.move(w, c, c.vx * dt, c.vy * dt, c.vz * dt);
        if (c.hitY) c.vy = 0;
        if (c.hitX) c.vx = 0;
        if (c.hitZ) c.vz = 0;
      }
      // les joueurs et créatures qui marchent contre un wagonnet vide le poussent
      if (!c.rider) {
        for (const q of this.plist) {
          if (q.alive === false || q.riding === c.uid) continue;
          const dx = c.x - q.x, dz = c.z - q.z, d = Math.hypot(dx, dz);
          if (d < 0.75 && d > 0.01 && Math.abs(q.y - c.y) < 1.2) {
            c.vx += (dx / d) * 6 * dt;
            c.vz += (dz / d) * 6 * dt;
          }
        }
      }
      // deux wagonnets qui se touchent s'écartent
      for (const o of this.carts) {
        if (o === c || o.dead) continue;
        const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz);
        if (d < 0.9 && d > 0.001 && Math.abs(c.y - o.y) < 0.8) {
          c.vx += (dx / d) * 4 * dt;
          c.vz += (dz / d) * 4 * dt;
        }
      }
      if (Math.hypot(c.vx, c.vz) > 0.3) c.yaw = Math.atan2(c.vx, c.vz);
      // TNT allumée
      if (c.fuse > 0) {
        c.fuse -= dt;
        if (this.rand() < dt * 20) this.burst(CM.Textures.layer.smoke, c.x, c.y + 1, c.z, 1, { speed: 0.5, grav: -2, life: 0.6, size: 0.12 });
        if (c.fuse <= 0) {
          c.dead = true;
          g.explode(c.x, c.y + 0.5, c.z, 4);
        }
      }
      if (c.type === 'hopper' && !c.lock) this.cartHopper(c, dt);
      if (c.y < CM.WORLD.MINY - 20) c.dead = true;
      // bruit de roulement
      const p = g.player, sp = Math.hypot(c.vx, c.vz);
      if (sp > 1 && p && Math.hypot(p.x - c.x, p.z - c.z) < 16 && this.rand() < dt * 3) CM.Audio.play('cart', { pitch: 0.6 + sp / 10, vol: Math.min(1, sp / 6) });
    }
    this.carts = this.carts.filter((c) => !c.dead);
  };
  E.cartOnRail = function (c, r, dt) {
    const g = this.game, rs = r.rs, shape = rs.shape;
    const ex = CM.RAIL_EXITS[shape];
    const a = ex[0][0], b = ex[1][0];
    // segment de la voie dans la case : du milieu du bord a au milieu du bord b
    const ax = 0.5 + DV[a][0] * 0.5, az = 0.5 + DV[a][2] * 0.5;
    const bx = 0.5 + DV[b][0] * 0.5, bz = 0.5 + DV[b][2] * 0.5;
    let ux = bx - ax, uz = bz - az;
    const ul = Math.hypot(ux, uz);
    ux /= ul;
    uz /= ul;
    // vitesse le long de la voie (on garde sa valeur dans les virages)
    let sp = Math.hypot(c.vx, c.vz);
    if (c.vx * ux + c.vz * uz < 0) sp = -sp;
    // pente : la gravité tire vers le bas de la montée
    if (shape >= 2 && shape <= 5) {
      const upDir = ex[1][1] ? b : a;
      const s = DV[upDir][0] * ux + DV[upDir][2] * uz; // +1 si « b » est en haut
      sp -= s * 9 * dt;
    }
    // rails de propulsion
    if (rs.type === 'powered') {
      if (rs.on) {
        if (Math.abs(sp) > 0.05) sp += Math.sign(sp) * 16 * dt;
        else {
          // à l'arrêt contre un bloc : départ dans l'autre sens
          const sa = CM.blocks[g.world.get(r.x + DV[a][0], r.y, r.z + DV[a][2])].solid, sb = CM.blocks[g.world.get(r.x + DV[b][0], r.y, r.z + DV[b][2])].solid;
          if (sa && !sb) sp = 2;
          else if (sb && !sa) sp = -2;
        }
      } else {
        sp *= Math.pow(0.4, dt * 20);
        if (Math.abs(sp) < 0.1) sp = 0;
      }
    }
    // rail activateur alimenté
    if (rs.type === 'activator') {
      if (rs.on) {
        if (c.type === 'tnt' && c.fuse <= 0) c.fuse = 4;
        if (c.rider !== null && c.rider !== undefined) this.dismount(c);
        c.lock = 1;
      } else c.lock = 0;
    }
    // le passager avance un peu en appuyant sur « avancer »
    const push = c.rider === 'local' ? g.player.cartPush : c.rider !== null ? c.push : null;
    if (push) {
      const [px, pz] = push;
      sp += (px * ux + pz * uz) * 4 * dt;
    }
    sp *= Math.pow(c.rider ? 0.997 : 0.985, dt * 20);
    sp = Math.max(-MAXV, Math.min(MAXV, sp));
    if (Math.abs(sp) < 0.005) sp = 0;
    // déplacement puis recalage sur la voie
    let nx = c.x + ux * sp * dt, nz = c.z + uz * sp * dt;
    let fx = nx - r.x, fz = nz - r.z;
    const px = fx - ax, pz = fz - az;
    let t = px * ux + pz * uz;
    t = Math.max(-0.2, Math.min(ul + 0.2, t));
    fx = ax + ux * t;
    fz = az + uz * t;
    nx = r.x + fx;
    nz = r.z + fz;
    // arrêt contre un bloc au bout de la voie
    const cellX = Math.floor(nx), cellZ = Math.floor(nz);
    if ((cellX !== r.x || cellZ !== r.z) && CM.blocks[g.world.get(cellX, r.y, cellZ)].solid && !railRs(g.world.get(cellX, r.y + 1, cellZ))) {
      sp = -sp * 0.3;
      nx = c.x;
      nz = c.z;
    }
    c.x = nx;
    c.z = nz;
    c.y = r.y + 1 / 16 + railY(shape, Math.min(1, Math.max(0, nx - r.x)), Math.min(1, Math.max(0, nz - r.z)));
    c.vx = ux * sp;
    c.vz = uz * sp;
    c.vy = 0;
    c.onGround = true;
  };
  // Wagonnet à entonnoir : aspire les objets et le conteneur au-dessus.
  E.cartHopper = function (c, dt) {
    c.hc = (c.hc || 0) - dt;
    if (c.hc > 0) return;
    c.hc = 0.2;
    const g = this.game, w = g.world;
    const x = Math.floor(c.x), y = Math.floor(c.y + 0.1), z = Math.floor(c.z);
    const ab = CM.blocks[w.get(x, y + 1, z)];
    if (ab.container) {
      const src = g.chestAt(x, y + 1, z);
      for (let i = 0; i < src.length; i++) {
        const s = src[i];
        if (!s) continue;
        if (CM.insertStack(c.slots, { id: s.id, count: 1, extra: CM.stackExtra(s) })) {
          s.count--;
          if (s.count <= 0) src[i] = null;
          break;
        }
      }
    }
    for (const d of this.drops) {
      if (d.dead || Math.abs(d.x - c.x) > 1 || Math.abs(d.z - c.z) > 1 || d.y < c.y - 0.5 || d.y > c.y + 1.5) continue;
      const left = CM.insertStack(c.slots, { id: d.id, count: d.count, extra: d.extra }, true);
      if (left < d.count) {
        d.count = left;
        if (!left) d.dead = true;
      }
    }
  };
  E.mount = function (c, who) {
    if (c.type !== 'cart' || (c.rider !== null && c.rider !== undefined)) return false;
    c.rider = who;
    return true;
  };
  E.dismount = function (c) {
    const g = this.game;
    if (c.rider === 'local') {
      const p = g.player;
      p.riding = null;
      p.y = c.y + 0.8;
      p.fallStart = p.y;
    } else if (c.rider !== null && c.rider !== undefined) g.net.sendTo(c.rider, { t: 'unride' });
    c.rider = null;
  };
  // Coup porté à un wagonnet : il casse au bout de quelques coups et rend son objet.
  E.hitCart = function (c, dmg) {
    const g = this.game;
    if (this.remote) {
      g.net.send({ t: 'hitcart', id: c.uid, d: dmg });
      return;
    }
    c.hp -= dmg;
    c.vx += (Math.random() - 0.5) * 2;
    c.vz += (Math.random() - 0.5) * 2;
    CM.Audio.play('hit');
    if (c.hp > 0 && g.mode !== 'creative') return;
    c.dead = true;
    if (c.rider !== null && c.rider !== undefined) this.dismount(c);
    if (c.slots) {
      if (g.net.active) g.net.chestGone('C' + c.uid);
      else if (g.ui.chest === c.slots) g.ui.closeInventory();
    }
    this.addDrop(CM.CART_ITEMS[c.type] || CM.I.MINECART, 1, c.x, c.y + 0.5, c.z);
    for (const s of c.slots || []) if (s) this.addDrop(s.id, s.count, c.x, c.y + 0.5, c.z, CM.stackExtra(s));
    if (c.type === 'tnt' && c.fuse <= 0 && Math.hypot(c.vx, c.vz) > 5) g.explode(c.x, c.y + 0.5, c.z, 4);
  };
  E.renderCarts = function (batch) {
    const L = CM.Textures.layer;
    for (const c of this.carts || []) {
      if (c.dead) continue;
      const l = this.lightAt(c.x, c.y + 0.4, c.z);
      mat4.compose(this.M, c.x, c.y, c.z, c.yaw || 0, 0, 0, 1);
      const M = this.M, body = L.cart_body, inner = L.cart_inner;
      batch.box(M, -0.45, 0.06, -0.62, 0.45, 0.14, 0.62, [body, body, inner, body, body, body], l[0], l[1], 0);
      batch.box(M, -0.45, 0.14, -0.62, -0.38, 0.62, 0.62, body, l[0], l[1], 0);
      batch.box(M, 0.38, 0.14, -0.62, 0.45, 0.62, 0.62, body, l[0], l[1], 0);
      batch.box(M, -0.38, 0.14, -0.62, 0.38, 0.62, -0.55, body, l[0], l[1], 0);
      batch.box(M, -0.38, 0.14, 0.55, 0.38, 0.62, 0.62, body, l[0], l[1], 0);
      const top = c.type === 'chest' ? CM.blockLayers[CM.B.CHEST] : c.type === 'tnt' ? CM.blockLayers[CM.B.TNT] : c.type === 'hopper' ? CM.blockLayers[CM.RSFAM.hopper.base] : null;
      if (top) {
        const flash = c.type === 'tnt' && c.fuse > 0 && (c.fuse * 4) % 1 < 0.5 ? 1 : 0;
        batch.box(M, -0.36, 0.14, -0.36, 0.36, 0.86, 0.36, top, flash ? 1 : l[0], flash ? 1 : l[1], flash);
      }
    }
  };

  // ---------------------------------------------- mise à jour et réseau --
  E.updateExtra = function (dt) {
    if (this.arrows && this.arrows.length) this.updateArrows(dt);
    if (this.carts && this.carts.length) this.updateCarts(dt);
  };
  E.updateExtraRemote = function (dt) {
    const k = Math.min(1, dt * 12);
    for (const o of (this.arrows || []).concat(this.carts || [])) {
      if (o.tx === undefined) continue;
      if (Math.hypot(o.tx - o.x, o.ty - o.y, o.tz - o.z) > 6) {
        o.x = o.tx;
        o.y = o.ty;
        o.z = o.tz;
      } else {
        o.x += (o.tx - o.x) * k;
        o.y += (o.ty - o.y) * k;
        o.z += (o.tz - o.z) * k;
      }
    }
  };
  E.renderExtra = function (batch) {
    this.renderArrows(batch);
    this.renderCarts(batch);
  };
  // Instantané pour un invité : flèches et wagonnets proches.
  E.snapExtra = function (near) {
    const ar = [], ca = [];
    for (const a of this.arrows || []) {
      if (a.dead || !near(a)) continue;
      const yaw = a.stuck ? a.yaw : Math.atan2(a.vx, a.vz), pitch = a.stuck ? a.pitch : Math.atan2(-a.vy, Math.hypot(a.vx, a.vz));
      ar.push([a.uid, r2(a.x), r2(a.y), r2(a.z), r2(yaw || 0), r2(pitch || 0)]);
    }
    for (const c of this.carts || []) {
      if (c.dead || !near(c)) continue;
      ca.push([c.uid, c.type, r2(c.x), r2(c.y), r2(c.z), r2(c.yaw || 0), c.rider === 'local' ? 0 : c.rider === null || c.rider === undefined ? -1 : c.rider, c.fuse > 0 ? 1 : 0]);
    }
    return { ar, ca };
  };
  E.applyExtra = function (s) {
    const oldA = new Map((this.arrows || []).map((a) => [a.uid, a]));
    this.arrows = [];
    for (const [uid, x, y, z, yaw, pitch] of s.ar || []) {
      let a = oldA.get(uid);
      if (!a) a = { uid, x, y, z, vx: 0, vy: 0, vz: 0 };
      a.tx = x;
      a.ty = y;
      a.tz = z;
      a.yaw = yaw;
      a.pitch = pitch;
      a.stuck = true;
      this.arrows.push(a);
    }
    const oldC = new Map((this.carts || []).map((c) => [c.uid, c]));
    this.carts = [];
    for (const [uid, type, x, y, z, yaw, rider, lit] of s.ca || []) {
      let c = oldC.get(uid);
      if (!c) c = { uid, type, x, y, z, vx: 0, vy: 0, vz: 0, hw: 0.45, h: 0.7 };
      c.type = type;
      c.tx = x;
      c.ty = y;
      c.tz = z;
      c.yaw = yaw;
      c.rider = rider === -1 ? null : rider;
      c.fuse = lit ? 1 : 0;
      this.carts.push(c);
    }
  };
})();
