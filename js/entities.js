'use strict';
// Physique, créatures (Mouflons, Ombres), objets au sol et particules.
(function () {
  const mat4 = CM.mat4;
  const B = CM.B;
  const I = CM.I;

  // ---------------------------------------------------------- physique ---
  const EPS = 1e-4;
  CM.Physics = {
    overlaps(world, x, y, z, hw, h) {
      const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw - 1e-7);
      const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-7);
      const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw - 1e-7);
      for (let yy = y0; yy <= y1; yy++)
        for (let zz = z0; zz <= z1; zz++)
          for (let xx = x0; xx <= x1; xx++) if (world.solidAt(xx, yy, zz)) return true;
      return false;
    },
    // Déplace une boîte (e.x, e.y, e.z = centre du bas ; e.hw demi-largeur ; e.h hauteur).
    move(world, e, dx, dy, dz) {
      e.hitX = e.hitY = e.hitZ = false;
      e.landed = false;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
      dx /= steps;
      dy /= steps;
      dz /= steps;
      for (let s = 0; s < steps; s++) {
        if (dy) {
          e.y += dy;
          if (this.overlaps(world, e.x, e.y, e.z, e.hw, e.h)) {
            if (dy < 0) {
              e.y = Math.floor(e.y) + 1 + EPS;
              e.landed = true;
            } else e.y = Math.floor(e.y + e.h) - e.h - EPS;
            e.hitY = true;
            dy = 0;
          }
        }
        if (dx) {
          e.x += dx;
          if (this.overlaps(world, e.x, e.y, e.z, e.hw, e.h)) {
            e.x = dx > 0 ? Math.floor(e.x + e.hw) - e.hw - EPS : Math.floor(e.x - e.hw) + 1 + e.hw + EPS;
            e.hitX = true;
            dx = 0;
          }
        }
        if (dz) {
          e.z += dz;
          if (this.overlaps(world, e.x, e.y, e.z, e.hw, e.h)) {
            e.z = dz > 0 ? Math.floor(e.z + e.hw) - e.hw - EPS : Math.floor(e.z - e.hw) + 1 + e.hw + EPS;
            e.hitZ = true;
            dz = 0;
          }
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

  const MOBS = {
    mouflon: { hw: 0.4, h: 1.15, hp: 8, speed: 1.4 },
    ombre: { hw: 0.3, h: 1.95, hp: 16, speed: 3.4 },
  };

  class Mob {
    constructor(type, x, y, z) {
      const def = MOBS[type];
      this.type = type;
      this.x = x; this.y = y; this.z = z;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.hw = def.hw; this.h = def.h;
      this.hp = def.hp; this.maxHp = def.hp;
      this.yaw = Math.random() * Math.PI * 2;
      this.onGround = false;
      this.hurt = 0;
      this.knock = 0;
      this.walk = 0;
      this.dead = false;
      this.age = 0;
      this.ai = { timer: 0, dir: null, flee: 0, attackCd: 0, chasing: false };
    }
  }

  class Entities {
    constructor(game) {
      this.game = game;
      this.mobs = [];
      this.drops = [];
      this.particles = [];
      this.spawnTimer = 0;
      this.rand = Math.random;
      this.M = mat4.create();
      this.P = mat4.create();
      this.R = mat4.create();
    }
    clear() {
      this.mobs.length = 0;
      this.drops.length = 0;
      this.particles.length = 0;
    }

    addMob(type, x, y, z) {
      const m = new Mob(type, x, y, z);
      this.mobs.push(m);
      return m;
    }
    addDrop(id, count, x, y, z, extra, vel) {
      const r = this.rand;
      this.drops.push({
        id, count, extra: extra || null,
        x, y, z, hw: 0.125, h: 0.25,
        vx: vel ? vel[0] : (r() - 0.5) * 3,
        vy: vel ? vel[1] : 3 + r() * 2,
        vz: vel ? vel[2] : (r() - 0.5) * 3,
        age: 0, pickDelay: vel ? 1.2 : 0.25, onGround: false, dead: false,
        spin: r() * 6,
      });
    }

    // Particules : petits carrés texturés.
    burst(layer, x, y, z, n, o) {
      o = o || {};
      const r = this.rand;
      for (let i = 0; i < n; i++) {
        const sp = o.speed || 3;
        this.particles.push({
          x: x + (r() - 0.5) * (o.spread || 0.6),
          y: y + (r() - 0.5) * (o.spread || 0.6),
          z: z + (r() - 0.5) * (o.spread || 0.6),
          vx: (r() - 0.5) * sp,
          vy: r() * sp * (o.up === undefined ? 1 : o.up) + (o.lift || 0),
          vz: (r() - 0.5) * sp,
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
    update(dt) {
      const g = this.game;
      for (const m of this.mobs) this.updateMob(m, dt);
      for (const d of this.drops) this.updateDrop(d, dt);
      const w = g.world;
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
      this.mobs = this.mobs.filter((m) => !m.dead);
      this.drops = this.drops.filter((d) => !d.dead);
      this.particles = this.particles.filter((p) => p.life > 0);
      if (this.particles.length > 1500) this.particles.splice(0, this.particles.length - 1500);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1;
        this.spawnTick();
      }
    }

    updateMob(m, dt) {
      const g = this.game, w = g.world, p = g.player, r = this.rand;
      if (!w.loaded(m.x, m.z)) {
        m.dead = true;
        return;
      }
      m.age += dt;
      m.hurt = Math.max(0, m.hurt - dt);
      m.knock = Math.max(0, m.knock - dt);
      m.ai.attackCd = Math.max(0, m.ai.attackCd - dt);
      const fx = Math.floor(m.x), fz = Math.floor(m.z);
      const inWater = w.get(fx, Math.floor(m.y + 0.4), fz) === B.WATER;
      let tvx = 0, tvz = 0, jump = false;
      const def = MOBS[m.type];
      const dxp = p.x - m.x, dzp = p.z - m.z, dyp = p.y - m.y;
      const distP = Math.hypot(dxp, dzp);

      if (m.type === 'mouflon') {
        let speed = def.speed;
        if (m.ai.flee > 0) {
          m.ai.flee -= dt;
          m.ai.dir = Math.atan2(dxp, dzp);
          speed = 4.2;
          if (m.hitX || m.hitZ) m.ai.dir += (r() - 0.5) * 2;
        } else {
          m.ai.timer -= dt;
          if (m.ai.timer <= 0) {
            m.ai.timer = 2 + r() * 4;
            m.ai.dir = r() < 0.6 ? r() * Math.PI * 2 : null;
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
        if (distP < 14 && r() < dt * 0.04) CM.Audio.play('baa');
      } else if (m.type === 'ombre') {
        const bl = w.blockLightAt(fx, Math.floor(m.y + 0.5), fz);
        const sky = w.skyAt(fx, Math.floor(m.y + 1.5), fz);
        // brûle au soleil
        if (g.daylight > 0.45 && sky >= 12) {
          this.hurtMob(m, 4 * dt, null, true);
          if (r() < dt * 12) this.burst(CM.Textures.layer.smoke, m.x, m.y + 1.2, m.z, 1, { speed: 0.6, grav: -2, life: 1, size: 0.25 });
          if (r() < dt * 2) CM.Audio.play('burn');
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
          if (m.ai.flee <= 0 && w.blockLightAt(ax, Math.floor(m.y + 0.5), az) >= 8) {
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
          p.damage(3, m.x, m.z, 'Une Ombre');
        }
        if (distP < 16 && r() < dt * 0.12) CM.Audio.play('shadow');
      }

      if ((m.hitX || m.hitZ) && m.onGround && (tvx || tvz)) jump = true;
      if (m.knock <= 0) {
        const acc = m.onGround ? 10 : 2.5;
        m.vx += (tvx - m.vx) * Math.min(1, acc * dt);
        m.vz += (tvz - m.vz) * Math.min(1, acc * dt);
      }
      if (inWater) {
        m.vy += 22 * dt;
        m.vy = Math.min(m.vy, 2.5);
        m.vy -= 14 * dt;
        m.vx *= 0.9;
        m.vz *= 0.9;
      } else m.vy -= 28 * dt;
      m.vy = Math.max(m.vy, -40);
      if (jump) m.vy = 8.2;
      CM.Physics.move(w, m, m.vx * dt, m.vy * dt, m.vz * dt);
      if (m.hitY) m.vy = 0;
      const sp = Math.hypot(m.vx, m.vz);
      m.walk += sp * dt * 3.2;
      m.moving = sp > 0.3;
      if (sp > 0.3 && m.knock <= 0) {
        const target = Math.atan2(-m.vx, -m.vz);
        let d = target - m.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        m.yaw += d * Math.min(1, dt * 8);
      }
      if (m.y < -20) m.dead = true;
    }

    hurtMob(m, dmg, src, silent) {
      m.hp -= dmg;
      if (!silent) {
        m.hurt = 0.35;
        if (src) {
          const dx = m.x - src[0], dz = m.z - src[1];
          const l = Math.hypot(dx, dz) || 1;
          m.vx = (dx / l) * 7;
          m.vz = (dz / l) * 7;
          m.vy = 5;
          m.knock = 0.3;
        }
        CM.Audio.play(m.type === 'ombre' ? 'shadow_hurt' : 'hit');
        if (m.type === 'mouflon') m.ai.flee = 5;
      }
      if (m.hp <= 0 && !m.dead) this.killMob(m);
    }

    killMob(m) {
      m.dead = true;
      const r = this.rand;
      const g = this.game;
      g.stats.kills[m.type] = (g.stats.kills[m.type] || 0) + 1;
      if (m.type === 'mouflon') {
        this.addDrop(I.RAW_MEAT, 1 + (r() < 0.5 ? 1 : 0), m.x, m.y + 0.5, m.z);
        if (r() < 0.7) this.addDrop(B.WOOL, 1, m.x, m.y + 0.5, m.z);
        this.burst(CM.Textures.layer.mouflon_wool, m.x, m.y + 0.6, m.z, 16, { speed: 3 });
      } else {
        this.addDrop(I.SHADOW_ESSENCE, 1 + (r() < 0.3 ? 1 : 0), m.x, m.y + 0.8, m.z);
        this.burst(CM.Textures.layer.smoke, m.x, m.y + 1, m.z, 22, { speed: 2.5, grav: -1.5, life: 1.2, size: 0.3 });
        this.burst(CM.Textures.layer.ombre_face, m.x, m.y + 1, m.z, 10, { speed: 4, emissive: true });
      }
    }

    updateDrop(d, dt) {
      const g = this.game, w = g.world, p = g.player;
      if (!w.loaded(d.x, d.z)) return; // figé tant que son tronçon n'est pas chargé
      d.age += dt;
      d.pickDelay -= dt;
      if (d.age > 600) d.dead = true;
      const inWater = w.get(Math.floor(d.x), Math.floor(d.y + 0.1), Math.floor(d.z)) === B.WATER;
      if (inWater) {
        d.vy += (2 - d.vy) * Math.min(1, dt * 3);
      } else d.vy -= 18 * dt;
      const dx = p.x - d.x, dy = p.y + 0.8 - d.y, dz = p.z - d.z;
      const dist = Math.hypot(dx, dy, dz);
      if (p.alive && d.pickDelay <= 0 && dist < 3) {
        d.vx += (dx / dist) * 30 * dt;
        d.vy += (dy / dist) * 30 * dt + 18 * dt;
        d.vz += (dz / dist) * 30 * dt;
        if (dist < 1.0) {
          const left = g.inventory.add(d.id, d.count, d.extra);
          if (left < d.count) {
            CM.Audio.play('pop');
            g.onPickup(d.id, d.count - left);
          }
          d.count = left;
          if (left <= 0) d.dead = true;
          else d.pickDelay = 1;
        }
      }
      CM.Physics.move(w, d, d.vx * dt, d.vy * dt, d.vz * dt);
      if (d.hitY) d.vy = 0;
      if (d.onGround) {
        d.vx *= Math.max(0, 1 - dt * 8);
        d.vz *= Math.max(0, 1 - dt * 8);
      }
      if (d.y < -20) d.dead = true;
    }

    // ------------------------------------------------------ apparitions --
    spawnTick() {
      const g = this.game, p = g.player, w = g.world, r = this.rand;
      const { H } = CM.WORLD;
      let nMouf = 0, nOmbre = 0;
      for (const m of this.mobs) {
        const dist = Math.hypot(m.x - p.x, m.z - p.z);
        if (m.type === 'mouflon') {
          if (dist > 110) m.dead = true;
          else nMouf++;
        } else {
          if (dist > 70) m.dead = true;
          else nOmbre++;
        }
      }
      if (nMouf < 9 && r() < 0.3) {
        for (let t = 0; t < 4; t++) {
          const a = r() * Math.PI * 2, dd = 24 + r() * 30;
          const x = Math.floor(p.x + Math.cos(a) * dd), z = Math.floor(p.z + Math.sin(a) * dd);
          if (!w.loaded(x, z)) continue;
          const y = w.groundBelow(x, H - 1, z);
          if (y > 0 && w.get(x, y, z) === B.GRASS && w.skyAt(x, y + 1, z) >= 14) {
            this.addMob('mouflon', x + 0.5, y + 1, z + 0.5);
            break;
          }
        }
      }
      const maxO = Math.min(10, 3 + g.dayCount);
      if (nOmbre < maxO && p.alive && r() < 0.5) {
        for (let t = 0; t < 6; t++) {
          const a = r() * Math.PI * 2, dd = 14 + r() * 22;
          const x = Math.floor(p.x + Math.cos(a) * dd), z = Math.floor(p.z + Math.sin(a) * dd);
          if (!w.loaded(x, z)) continue;
          if (g.nearDawnHeart(x, z, 48)) continue;
          const yTop = Math.min(H - 3, Math.floor(p.y) + 10);
          for (let y = yTop; y > Math.max(2, Math.floor(p.y) - 16); y--) {
            if (!w.solidAt(x, y - 1, z) || w.solidAt(x, y, z) || w.solidAt(x, y + 1, z)) continue;
            if (w.get(x, y, z) === B.WATER) continue;
            const bl = w.blockLightAt(x, y, z);
            const sky = w.skyAt(x, y, z) * (g.daylight > 0.45 ? 1 : 0.2);
            if (bl < 4 && sky < 4) {
              const m = this.addMob('ombre', x + 0.5, y, z + 0.5);
              this.burst(CM.Textures.layer.smoke, m.x, m.y + 1, m.z, 10, { speed: 1.5, grav: -1, life: 1, size: 0.3 });
              t = 99;
              break;
            }
          }
        }
      }
    }

    // Rayon vers les créatures (pour attaquer).
    raycastMob(ox, oy, oz, dx, dy, dz, maxD) {
      let best = null, bestT = maxD;
      for (const m of this.mobs) {
        const t = CM.rayBox(ox, oy, oz, dx, dy, dz, m.x - m.hw, m.y, m.z - m.hw, m.x + m.hw, m.y + m.h, m.z + m.hw);
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

    part(batch, base, px, py, pz, rx, box, layers, l, flags, faceFlags, ry) {
      mat4.compose(this.P, px, py, pz, ry || 0, rx, 0, 1);
      mat4.multiply(this.R, base, this.P);
      batch.box(this.R, box[0], box[1], box[2], box[3], box[4], box[5], layers, l[0], l[1], flags, null, faceFlags);
    }

    render(batch, cam, time) {
      const L = CM.Textures.layer;
      for (const m of this.mobs) {
        const l = this.lightAt(m.x, m.y + 0.6, m.z);
        const flags = m.hurt > 0 ? 2 : 0;
        mat4.compose(this.M, m.x, m.y, m.z, m.yaw, 0, 0, 1);
        const sw = m.moving ? Math.sin(m.walk) : 0;
        if (m.type === 'mouflon') {
          const wool = L.mouflon_wool, skin = L.mouflon_skin;
          this.part(batch, this.M, 0, 0, 0, 0, [-0.33, 0.42, -0.5, 0.33, 1.02, 0.5], wool, l, flags);
          const hb = Math.sin(time * 2 + m.age) * 0.05;
          this.part(batch, this.M, 0, 0.92, -0.48, hb, [-0.2, -0.12, -0.38, 0.2, 0.28, 0.02], [skin, skin, wool, skin, skin, L.mouflon_face], l, flags);
          this.part(batch, this.M, 0, 0.92, -0.48, hb, [-0.32, 0.08, -0.26, -0.2, 0.24, -0.06], L.mouflon_horn, l, flags);
          this.part(batch, this.M, 0, 0.92, -0.48, hb, [0.2, 0.08, -0.26, 0.32, 0.24, -0.06], L.mouflon_horn, l, flags);
          const legs = [[-0.2, -0.32, 1], [0.2, -0.32, -1], [-0.2, 0.32, -1], [0.2, 0.32, 1]];
          for (const [lx, lz, ph] of legs) this.part(batch, this.M, lx, 0.45, lz, sw * 0.7 * ph, [-0.09, -0.45, -0.09, 0.09, 0, 0.09], skin, l, flags);
        } else {
          const body = L.ombre_body;
          this.part(batch, this.M, 0, 0, 0, 0, [-0.25, 0.8, -0.13, 0.25, 1.52, 0.13], body, l, flags);
          this.part(batch, this.M, -0.12, 0.8, 0, sw * 0.6, [-0.1, -0.8, -0.1, 0.1, 0, 0.1], body, l, flags);
          this.part(batch, this.M, 0.12, 0.8, 0, -sw * 0.6, [-0.1, -0.8, -0.1, 0.1, 0, 0.1], body, l, flags);
          const armA = m.ai.chasing ? -1.35 + Math.sin(time * 6 + m.age) * 0.1 : sw * 0.5;
          this.part(batch, this.M, -0.34, 1.48, 0, armA, [-0.08, -0.74, -0.08, 0.08, 0.04, 0.08], body, l, flags);
          this.part(batch, this.M, 0.34, 1.48, 0, m.ai.chasing ? armA : -armA, [-0.08, -0.74, -0.08, 0.08, 0.04, 0.08], body, l, flags);
          const ff = [flags, flags, flags, flags, flags, flags ? 2 : 1];
          this.part(batch, this.M, 0, 1.52, 0, 0, [-0.22, 0, -0.22, 0.22, 0.44, 0.22], [body, body, body, body, body, L.ombre_face], l, flags, ff);
        }
      }
      for (const d of this.drops) {
        if (!this.game.world.loaded(d.x, d.z)) continue;
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
      if (id < 256) {
        const b = CM.blocks[id];
        if (b.render === 'cube' || b.render === 'glass') {
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
