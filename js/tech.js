'use strict';
// Extension « Électricité » : réseaux électriques, générateurs, batteries et machines.
// Un réseau = des blocs électriques qui se touchent (câbles, machines, batteries…).
// L'hôte (ou la partie solo) fait le bilan toutes les 0,5 s avec le moteur de redstone de
// la dimension ; un signal de redstone arrête une machine ou une lampe (comme dans Create).
(function () {
  const DV = CM.DIRV, OPP = CM.OPP;
  const blk = (id) => CM.blocks[id] || CM.blocks[0];
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const unkey = (k) => k.split(',').map(Number);
  const CAP = 4000; // énergie d'une batterie pleine
  const STEP = 10; // bilan toutes les 10 ticks de jeu (0,5 s)
  const DT = STEP / 20;
  const BELT = 2; // vitesse des tapis (blocs par seconde)
  const FAN_RANGE = 8;
  const DRILL_RES = 1000; // réserve d'énergie d'une foreuse (elle continue loin du réseau)

  const S = (rs) => rs.techS || (rs.techS = { nets: [], of: new Map(), pow: new Set(), crank: new Map(), out: new Map(), movers: [] });
  // Données durables d'un bloc (charge, combustible, progression), sauvegardées avec la partie.
  const TD = (g, x, y, z) => {
    if (!g.techData) g.techData = {};
    const k = g.bkey(x, y, z);
    return g.techData[k] || (g.techData[k] = {});
  };
  // Vue sur certaines cases d'un conteneur (l'entonnoir remplit l'entrée, vide la sortie).
  const view = (arr, idx) =>
    new Proxy(arr, {
      get(t, p) {
        if (p === 'length') return idx.length;
        if (typeof p === 'string' && /^\d+$/.test(p)) return t[idx[+p]];
        return t[p];
      },
      set(t, p, v) {
        if (typeof p === 'string' && /^\d+$/.test(p)) t[idx[+p]] = v;
        else t[p] = v;
        return true;
      },
    });
  const fits = (slot, id, n) => {
    if (!slot) return true;
    const info = CM.itemInfo(id);
    return slot.id === id && !CM.stackExtra(slot) && slot.count + n <= ((info && info.stack) || 64);
  };
  const addTo = (slots, i, id, n) => {
    if (!slots[i]) slots[i] = { id, count: n };
    else slots[i].count += n;
  };
  const take = (slots, i, n) => {
    slots[i].count -= n;
    if (slots[i].count <= 0) slots[i] = null;
  };

  // Production d'un générateur (énergie par seconde).
  function genOutput(rs, x, y, z, b) {
    const g = rs.g, w = rs.w, t = b.tech;
    switch (t.gen) {
      case 'solar': {
        if (g.dim === 'nether' || w.skyAt(x, y + 1, z) < 15) return 0;
        return t.max * Math.max(0, Math.min(1, (g.daylight - 0.2) / 0.8));
      }
      case 'water':
        return Math.min(t.max, waterAround(w, x, y, z, b.rs.axis) * 2.5);
      case 'wind':
        if (g.dim === 'nether' || w.skyAt(x, y + 1, z) < 15) return 0;
        return windOf(y);
      default:
        return 0;
    }
  }
  const windOf = (y) => Math.max(0.5, Math.min(8, (y - 48) / 8));
  // Eau autour de la roue (dans le plan de la roue).
  function waterAround(w, x, y, z, axis) {
    const N = axis === 0 ? [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] : [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
    let n = 0;
    for (const [dx, dy, dz] of N) if (CM.isWater(w.get(x + dx, y + dy, z + dz))) n++;
    return n;
  }
  // Travail en attente d'une machine ?
  function wants(rs, x, y, z, b) {
    const g = rs.g, t = b.tech;
    switch (t.use) {
      case 'crusher': {
        const sl = g.chestAt(x, y, z), s = sl[0];
        const rec = s && CM.TECH_CRUSH.get(s.id);
        return !!rec && fits(sl[1], rec[0], rec[1]);
      }
      case 'efurnace': {
        const sl = g.chestAt(x, y, z), s = sl[0];
        const rec = s && CM.TECH_SMELT.get(s.id);
        return !!rec && s.count >= rec.k && fits(sl[1], rec.out, rec.n);
      }
      case 'drill':
        return drillPlan(rs, x, y, z, b).work;
      default:
        return true;
    }
  }
  function setState(rs, x, y, z, id, changes) {
    const nid = CM.rsWith(id, changes);
    if (nid !== id) rs.set(x, y, z, nid);
    return nid;
  }

  // ------------------------------------------------------------ bilan --
  function step(rs) {
    const g = rs.g, w = rs.w, s = S(rs);
    // réseaux : composantes connexes des blocs électriques chargés
    const of = new Map(), nets = [];
    for (const k of rs.watch.tech) {
      if (of.has(k)) continue;
      const [x0, , z0] = unkey(k);
      if (!w.loaded(x0, z0)) continue;
      if (!blk(w.get(...unkey(k))).tech) continue;
      const net = { i: nets.length, nodes: [], gens: [], bats: [], users: [], cranks: 0, prod: 0, use: 0, need: 0, stored: 0, cap: 0 };
      const q = [k];
      of.set(k, net.i);
      while (q.length) {
        const c = q.pop();
        net.nodes.push(c);
        const [x, y, z] = unkey(c);
        for (let d = 0; d < 6; d++) {
          const X = x + DV[d][0], Y = y + DV[d][1], Z = z + DV[d][2], nk = key(X, Y, Z);
          if (of.has(nk) || !w.loaded(X, Z) || !blk(w.get(X, Y, Z)).tech) continue;
          of.set(nk, net.i);
          q.push(nk);
        }
      }
      nets.push(net);
    }
    s.of = of;
    s.nets = nets;
    const pow = new Set();
    for (const net of nets) {
      for (const k of net.nodes) {
        const [x, y, z] = unkey(k);
        const id = w.get(x, y, z), b = blk(id), t = b.tech;
        if (t.k === 'gen') net.gens.push([x, y, z, id, b]);
        else if (t.k === 'bat') net.bats.push([x, y, z, id]);
        else if (t.k === 'use') net.users.push([x, y, z, id, b]);
        else if (t.k === 'crank' && s.crank.has(k)) {
          net.cranks += s.crank.get(k);
          s.crank.delete(k);
        }
      }
      // production des générateurs « gratuits »
      let prod = 0;
      const coal = [];
      for (const [x, y, z, id, b] of net.gens) {
        if (b.tech.gen === 'coal') {
          coal.push([x, y, z, id, b]);
          continue;
        }
        const o = genOutput(rs, x, y, z, b);
        s.out.set(key(x, y, z), o / b.tech.max);
        prod += o;
      }
      // machines qui veulent travailler (un signal de redstone les arrête)
      const active = [];
      let need = 0;
      for (const u of net.users) {
        const [x, y, z, , b] = u;
        if (rs.powered(x, y, z)) continue;
        if (!wants(rs, x, y, z, b)) continue;
        active.push(u);
        need += b.tech.rate * DT;
      }
      for (const [x, y, z] of net.bats) net.stored += TD(g, x, y, z).e || 0;
      net.cap = net.bats.length * CAP;
      // générateurs à charbon : ils brûlent s'il manque de l'énergie ou si les batteries ne sont pas pleines
      const hungry = need > prod * DT + net.cranks || net.stored < net.cap - 1;
      for (const [x, y, z, id, b] of coal) {
        const td = TD(g, x, y, z);
        if (!(td.f > 0) && hungry && !rs.powered(x, y, z)) {
          const sl = g.chestAt(x, y, z), f = sl[0];
          const burn = f && CM.TECH_FUEL.get(f.id);
          if (burn) {
            take(sl, 0, 1);
            td.f = burn;
          }
        }
        let o = 0;
        if (td.f > 0) {
          o = b.tech.max;
          td.f = Math.max(0, td.f - DT);
        }
        s.out.set(key(x, y, z), o / b.tech.max);
        prod += o;
        setState(rs, x, y, z, id, { lit: td.f > 0 });
      }
      net.prod = prod;
      // distribution : production, énergie de la manivelle, puis batteries
      let e = prod * DT + net.cranks, stored = net.stored, used = 0;
      for (const u of active) {
        const n = u[4].tech.rate * DT;
        if (e >= n) e -= n;
        else if (e + stored >= n) {
          stored -= n - e;
          e = 0;
        } else {
          // foreuse : elle puise dans sa réserve quand le réseau ne suffit pas
          if (u[4].tech.use === 'drill') {
            const td = TD(g, u[0], u[1], u[2]);
            if ((td.r || 0) >= n) {
              td.r -= n;
              pow.add(key(u[0], u[1], u[2]));
            }
          }
          continue;
        }
        used += n;
        pow.add(key(u[0], u[1], u[2]));
      }
      net.use = used / DT;
      net.need = need / DT;
      const total = stored + e;
      stored = Math.min(net.cap, total);
      net.stored = stored;
      // le surplus remplit la réserve des foreuses
      let left = total - stored;
      for (const [x, y, z, , b] of net.users) {
        if (left <= 0) break;
        if (b.tech.use !== 'drill') continue;
        const td = TD(g, x, y, z), add = Math.min(left, DRILL_RES - (td.r || 0), 40 * DT);
        if (add > 0) {
          td.r = (td.r || 0) + add;
          left -= add;
        }
      }
      // charge répartie entre les batteries (et niveau affiché)
      for (const [x, y, z, id] of net.bats) {
        const td = TD(g, x, y, z);
        td.e = net.bats.length ? stored / net.bats.length : 0;
        setState(rs, x, y, z, id, { level: Math.max(0, Math.min(4, Math.round((td.e / CAP) * 4))) });
      }
    }
    s.pow = pow;
    // effets des machines
    const movers = [];
    for (const net of nets)
      for (const [x, y, z, id, b] of net.users) {
        const on = pow.has(key(x, y, z));
        switch (b.tech.use) {
          case 'lamp':
            setState(rs, x, y, z, id, { on });
            break;
          case 'crusher':
            setState(rs, x, y, z, id, { on });
            if (on) work(rs, x, y, z, 3, () => crushOne(g, x, y, z));
            break;
          case 'efurnace':
            setState(rs, x, y, z, id, { on });
            if (on) work(rs, x, y, z, 2.5, () => smeltOne(g, x, y, z));
            break;
          case 'drill':
            if (on) drillStep(rs, x, y, z, id, b);
            break;
          case 'conveyor':
          case 'fan':
            setState(rs, x, y, z, id, { on });
            if (on) movers.push([x, y, z, b.tech.use, b.rs.facing]);
            break;
        }
      }
    s.movers = movers;
    // données de blocs disparus
    if (g.techData && rs.gt % 200 === 0) {
      const pre = g.dim === 'nether' ? 'N' : '';
      for (const k of Object.keys(g.techData)) {
        const own = pre ? k[0] === 'N' : k[0] !== 'N';
        if (own && !rs.watch.tech.has(pre ? k.slice(1) : k)) delete g.techData[k];
      }
    }
  }
  function work(rs, x, y, z, secs, done) {
    const td = TD(rs.g, x, y, z);
    td.p = (td.p || 0) + DT / secs;
    if (td.p >= 1) {
      td.p = 0;
      done();
    }
  }
  function crushOne(g, x, y, z) {
    const sl = g.chestAt(x, y, z), s = sl[0];
    const rec = s && CM.TECH_CRUSH.get(s.id);
    if (!rec || !fits(sl[1], rec[0], rec[1])) return;
    take(sl, 0, 1);
    addTo(sl, 1, rec[0], rec[1]);
    const p = g.player;
    if (p && Math.hypot(p.x - x, p.z - z) < 16) CM.Audio.play('dig', { mat: 'gravel' });
    g.entities.burst(CM.Textures.layer.white, x + 0.5, y + 1.05, z + 0.5, 4, { speed: 1.5, size: 0.05, life: 0.4 });
  }
  function smeltOne(g, x, y, z) {
    const sl = g.chestAt(x, y, z), s = sl[0];
    const rec = s && CM.TECH_SMELT.get(s.id);
    if (!rec || s.count < rec.k || !fits(sl[1], rec.out, rec.n)) return;
    take(sl, 0, rec.k);
    addTo(sl, 1, rec.out, rec.n);
  }
  // Foreuse : casse ce qu'il y a devant elle puis avance d'un bloc (tunnel de 2 blocs de haut
  // à l'horizontale). Avec un conteneur collé derrière, elle reste fixe et le remplit.
  const DRILL_AIR = 6; // blocs de vide traversés d'affilée (petites grottes) avant de s'arrêter
  function drillPlan(rs, x, y, z, b) {
    const w = rs.w, f = b.rs.facing;
    const bx = x - DV[f][0], by = y - DV[f][1], bz = z - DV[f][2];
    const fixed = !!blk(w.get(bx, by, bz)).container;
    const X = x + DV[f][0], Y = y + DV[f][1], Z = z + DV[f][2];
    const plan = { fixed, X, Y, Z, bx, by, bz, targets: [], move: false, work: false, why: '' };
    if (Y <= CM.WORLD.MINY || Y >= CM.WORLD.H - 1 || !w.loaded(X, Z)) {
      plan.why = 'bout du monde';
      return plan;
    }
    const cells = [[X, Y, Z]];
    if (!fixed && f !== 2 && f !== 3) cells.push([X, Y + 1, Z]);
    for (const [cx, cy, cz] of cells) {
      const id = w.get(cx, cy, cz);
      if (!id) continue;
      const fb = blk(id);
      const bad = CM.isFluid(id) ? 'liquide devant' : fb.unbreakable || fb.hardness < 0 || fb.portal ? 'bloc incassable devant' : '';
      if (bad) {
        if (cy === Y) {
          plan.why = bad;
          plan.targets.length = 0;
          return plan;
        }
        continue;
      }
      plan.targets.push([cx, cy, cz, id]);
    }
    const air = TD(rs.g, x, y, z).air || 0;
    plan.move = !plan.targets.length && !fixed && w.get(X, Y, Z) === 0 && air < DRILL_AIR;
    plan.work = plan.targets.length > 0 || plan.move;
    if (!plan.work) plan.why = fixed ? 'rien à creuser devant' : air >= DRILL_AIR ? 'plus rien à creuser' : 'bloquée';
    return plan;
  }
  function drillStep(rs, x, y, z, id, b) {
    const g = rs.g, w = rs.w, td = TD(g, x, y, z);
    const plan = drillPlan(rs, x, y, z, b);
    const p = g.player, near = p && Math.hypot(p.x - x, p.z - z) < 16;
    if (plan.targets.length) {
      const hard = Math.max(...plan.targets.map((t) => blk(t[3]).hardness));
      td.p = (td.p || 0) + DT / Math.max(0.5, hard * 0.75);
      const [tx, ty, tz, tid] = plan.targets[0];
      g.entities.blockParticles(tid, tx, ty, tz, 3);
      if (near) CM.Audio.play('dig', { mat: blk(tid).sound });
      if (td.p < 1) return;
      td.p = 0;
      td.air = 0;
      td.dug = true;
      const back = blk(w.get(plan.bx, plan.by, plan.bz));
      const dst = plan.fixed ? (back.tech ? CM.Tech.inputSlots(rs, plan.bx, plan.by, plan.bz) : g.chestAt(plan.bx, plan.by, plan.bz)) : g.chestAt(x, y, z);
      for (const [cx, cy, cz, cid] of plan.targets) {
        const cb = blk(cid);
        // un coffre cassé laisse tomber son contenu
        if (cb.container) {
          g.chestAt(cx, cy, cz);
          g.spillChest(cx, cy, cz);
        }
        const drops = CM.blockDrops(cid, Math.random);
        w.setBlock(cx, cy, cz, 0);
        if (near) CM.Audio.play('break', { mat: cb.sound });
        for (const [did, n] of drops) {
          const left = dst ? CM.insertStack(dst, { id: did, count: n }, true) : n;
          if (left > 0) g.entities.addDrop(did, left, cx + 0.5, cy + 0.3, cz + 0.5);
        }
      }
    } else if (plan.move) {
      td.p = (td.p || 0) + DT / 0.5;
      if (td.p < 1) return;
      td.p = 0;
      // avancer dans du vide (le bloc devant était déjà creusé) : compté
      if (!td.dug) td.air = (td.air || 0) + 1;
      td.dug = false;
      drillMove(rs, x, y, z, id, plan);
    }
  }
  // La foreuse avance d'un bloc : son inventaire et sa réserve la suivent ; si elle transporte
  // des câbles, elle en pose un derrière elle (elle reste reliée au réseau).
  function drillMove(rs, x, y, z, id, plan) {
    const g = rs.g, w = rs.w, k = g.bkey(x, y, z);
    if (g.net.locks.has(k) || g.soloChest === k) return; // quelqu'un regarde dans la foreuse
    const { X, Y, Z } = plan, nk = g.bkey(X, Y, Z);
    const inv = g.chestAt(x, y, z);
    g.chests.delete(k);
    g.chests.set(nk, inv);
    if (g.techData[k]) {
      g.techData[nk] = g.techData[k];
      delete g.techData[k];
    }
    let trail = 0;
    const ci = inv.findIndex((s) => s && s.id === CM.B.CABLE);
    if (ci >= 0) {
      take(inv, ci, 1);
      trail = CM.B.CABLE;
    }
    w.setBlock(X, Y, Z, id);
    w.setBlock(x, y, z, trail);
    const p = g.player;
    if (p && Math.hypot(p.x - X, p.z - Z) < 16) CM.Audio.play('piston', { out: true });
  }

  // ------------------------------------ tapis et ventilateurs (chaque tick) --
  function moveTick(rs) {
    const s = S(rs), g = rs.g, w = rs.w, ents = g.entities, dt = 0.05;
    if (!s.movers.length) return;
    for (const [x, y, z, kind, f] of s.movers) {
      if (kind === 'conveyor') {
        const vx = DV[f][0] * BELT, vz = DV[f][2] * BELT;
        const fx = x + DV[f][0], fz = z + DV[f][2];
        const front = blk(w.get(fx, y, fz));
        const dst = front.container || (front.rs && front.rs.k === 'hopper') ? (front.tech ? CM.Tech.inputSlots(rs, fx, y, fz) : g.chestAt(fx, y, fz)) : null;
        for (const d of ents.drops) {
          if (d.dead || Math.floor(d.x) !== x || Math.floor(d.z) !== z || d.y < y + 0.1 || d.y > y + 0.7) continue;
          d.vx = vx;
          d.vz = vz;
          // recentre sur le tapis
          if (vx) d.vz = (z + 0.5 - d.z) * 4;
          else d.vx = (x + 0.5 - d.x) * 4;
          // au bout du tapis : dans le conteneur
          const edge = vx ? (vx > 0 ? x + 1 - d.x : d.x - x) : vz > 0 ? z + 1 - d.z : d.z - z;
          if (dst && edge < 0.3) {
            const left = CM.insertStack(dst, { id: d.id, count: d.count, extra: d.extra }, true);
            if (left < d.count) {
              d.count = left;
              if (!left) d.dead = true;
            }
          }
        }
        for (const m of ents.mobs) {
          if (m.dead || Math.floor(m.x) !== x || Math.floor(m.z) !== z || m.y < y + 0.1 || m.y > y + 0.6) continue;
          CM.Physics.move(w, m, vx * dt, 0, vz * dt);
        }
      } else {
        // ventilateur : souffle dans sa direction jusqu'au premier bloc plein
        let len = FAN_RANGE;
        for (let i = 1; i <= FAN_RANGE; i++)
          if (w.solidAt(x + DV[f][0] * i, y + DV[f][1] * i, z + DV[f][2] * i)) {
            len = i - 1;
            break;
          }
        if (!len) continue;
        const push = (o, h) => {
          const cx = o.x - (x + 0.5), cy = o.y + h / 2 - (y + 0.5), cz = o.z - (z + 0.5);
          const along = cx * DV[f][0] + cy * DV[f][1] + cz * DV[f][2];
          if (along < 0.3 || along > len + 0.5) return;
          const px = cx - along * DV[f][0], py = cy - along * DV[f][1], pz = cz - along * DV[f][2];
          if (Math.hypot(px, py, pz) > 0.8) return;
          const k = (1 - along / (FAN_RANGE + 1)) * 18 * dt;
          o.vx = (o.vx || 0) + DV[f][0] * k;
          o.vy = (o.vy || 0) + DV[f][1] * k * 1.8;
          o.vz = (o.vz || 0) + DV[f][2] * k;
        };
        for (const d of ents.drops) if (!d.dead) push(d, 0.25);
        for (const m of ents.mobs) if (!m.dead) push(m, m.h);
      }
    }
  }

  CM.Tech = {
    CAP,
    tick(rs) {
      if (rs.gt % STEP === 0) step(rs);
      moveTick(rs);
    },
    neighbor() {},
    readLevel(rs, x, y, z) {
      const b = blk(rs.w.get(x, y, z)), t = b.tech;
      if (t.k === 'bat') return Math.round(((TD(rs.g, x, y, z).e || 0) / CAP) * 15);
      if (t.k === 'gen') return Math.round((S(rs).out.get(key(x, y, z)) || 0) * 15);
      return 0;
    },
    inputSlots(rs, x, y, z) {
      const b = blk(rs.w.get(x, y, z));
      if (!b.container) return null;
      return view(rs.g.chestAt(x, y, z), [0]);
    },
    outputSlots(rs, x, y, z) {
      const b = blk(rs.w.get(x, y, z));
      if (!b.container) return null;
      return b.slots >= 2 ? view(rs.g.chestAt(x, y, z), [1]) : [];
    },
    // Manivelle : +25 d'énergie dans le réseau.
    crank(g, x, y, z) {
      if (g.net.isClient) g.net.send({ t: 'crank', x, y, z });
      else {
        const rs = g.ticks.rs;
        if (!rs) return false;
        const s = S(rs), k = key(x, y, z);
        s.crank.set(k, Math.min(200, (s.crank.get(k) || 0) + 25));
      }
      CM.Audio.play('rsclick', { pitch: 0.6 + Math.random() * 0.2 });
      g.entities.burst(CM.Textures.layer.white, x + 0.5, y + 0.8, z + 0.5, 3, { speed: 1, size: 0.04, life: 0.3, emissive: true });
      return true;
    },
    // Multimètre (et clic sur une batterie) : état du réseau.
    info(g, x, y, z) {
      const rs = g.ticks.rs;
      if (!rs) return null;
      const s = S(rs), i = s.of.get(key(x, y, z));
      const b = blk(g.world.get(x, y, z));
      if (i === undefined) return b.tech ? '⚡ ' + b.name + ' : réseau en cours de calcul…' : null;
      const n = s.nets[i], f = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
      let t = '⚡ Réseau de ' + n.nodes.length + ' bloc' + (n.nodes.length > 1 ? 's' : '') + ' · production ' + f(n.prod) + '/s · consommation ' + f(n.use) + '/s';
      if (n.need > n.use + 0.01) t += ' (il manque ' + f(n.need - n.use) + '/s)';
      if (n.cap) t += ' · batteries ' + Math.round((n.stored / n.cap) * 100) + ' % (' + Math.round(n.stored) + '/' + n.cap + ')';
      if (b.tech.k === 'gen' && b.tech.gen === 'coal') t += ' · combustible ' + Math.ceil(TD(g, x, y, z).f || 0) + ' s';
      if (b.tech.use === 'drill') {
        const plan = drillPlan(rs, x, y, z, b);
        t += ' · réserve de la foreuse ' + Math.round(TD(g, x, y, z).r || 0) + '/' + DRILL_RES + (plan.fixed ? ' · fixe (conteneur derrière)' : '') + (plan.why ? ' · ' + plan.why : '');
      }
      if (rs.powered(x, y, z) && b.tech.k === 'use') t += ' · arrêtée par la redstone';
      return t;
    },
    meter(g, x, y, z) {
      if (g.net.isClient) {
        g.net.send({ t: 'meter', x, y, z });
        return true;
      }
      const t = this.info(g, x, y, z);
      if (t) g.ui.toast(t, 'info', 'meter');
      return !!t;
    },
    // Clé : tourner une machine, ou la démonter (accroupi).
    wrench(g, t, p) {
      const w = g.world, b = blk(t.id);
      if (!b.tech && !(b.rs && b.rs.fam)) return false;
      if (p.sneaking && b.tech) {
        w.setBlock(t.x, t.y, t.z, 0);
        const base = b.drop !== undefined ? b.drop : t.id;
        if (g.mode !== 'creative' && base) {
          const left = g.inventory.add(base, 1);
          if (left) g.entities.addDrop(base, left, t.x + 0.5, t.y + 0.5, t.z + 0.5);
        }
        CM.Audio.play('break', { mat: b.sound });
        return true;
      }
      const rs = b.rs;
      if (!b.tech && !['repeater', 'comparator', 'observer', 'dispenser', 'dropper', 'hopper'].includes(rs.k)) return false;
      const f = rs && rs.fam && CM.RSFAM[rs.fam];
      const field = f && f.fields.find(([n]) => n === 'facing' || n === 'axis');
      if (!field) return false;
      const vals = field[1], nv = vals[(vals.indexOf(rs[field[0]]) + 1) % vals.length];
      const nid = CM.rsWith(t.id, { [field[0]]: nv });
      if (nid === t.id) return false;
      w.setBlock(t.x, t.y, t.z, nid);
      CM.Audio.play('rsclick', { pitch: 1.5 });
      return true;
    },
    // Joueur de cet écran : tapis sous ses pieds, ventilateurs (hôte comme invité).
    playerTick(g, p, dt) {
      if (!p.alive || p.flying || p.riding !== null && p.riding !== undefined) return;
      const w = g.world;
      const fx = Math.floor(p.x), fz = Math.floor(p.z);
      const under = blk(w.get(fx, Math.floor(p.y - 0.02), fz));
      if (under.rs && under.rs.fam === 'conveyor' && under.rs.on && p.onGround) {
        const f = under.rs.facing;
        CM.Physics.move(w, p, DV[f][0] * BELT * dt, 0, DV[f][2] * BELT * dt);
      }
      for (const k of g.techAnim || []) {
        const [x, y, z] = unkey(k);
        if (Math.abs(x - p.x) > FAN_RANGE + 2 || Math.abs(y - p.y) > FAN_RANGE + 2 || Math.abs(z - p.z) > FAN_RANGE + 2) continue;
        const b = blk(w.get(x, y, z));
        if (!b.rs || b.rs.fam !== 'fan' || !b.rs.on) continue;
        const f = b.rs.facing;
        let len = FAN_RANGE;
        for (let i = 1; i <= FAN_RANGE; i++)
          if (w.solidAt(x + DV[f][0] * i, y + DV[f][1] * i, z + DV[f][2] * i)) {
            len = i - 1;
            break;
          }
        const cx = p.x - (x + 0.5), cy = p.y + 0.9 - (y + 0.5), cz = p.z - (z + 0.5);
        const along = cx * DV[f][0] + cy * DV[f][1] + cz * DV[f][2];
        if (along < 0.3 || along > len + 0.8) continue;
        const px = cx - along * DV[f][0], py = cy - along * DV[f][1], pz = cz - along * DV[f][2];
        if (Math.hypot(px, py, pz) > 1) continue;
        const kk = (1 - along / (FAN_RANGE + 1)) * dt;
        if (f === 2) {
          p.vy = Math.min(8, p.vy + 40 * kk);
          p.fallStart = p.y;
        } else if (f === 3) p.vy -= 20 * kk;
        else {
          p.vx += DV[f][0] * 30 * kk;
          p.vz += DV[f][2] * 30 * kk;
        }
      }
    },
    // Pièces qui tournent : roues à eau, éoliennes, ventilateurs, broyeurs.
    render(g, batch) {
      const p = g.player, w = g.world, ents = g.entities, L = CM.Textures.layer, t = g.clock;
      const M = this.M || (this.M = CM.mat4.create());
      for (const k of g.techAnim) {
        const [x, y, z] = unkey(k);
        if (Math.abs(x + 0.5 - p.x) > 48 || Math.abs(z + 0.5 - p.z) > 48 || Math.abs(y - p.y) > 32) continue;
        const b = blk(w.get(x, y, z));
        if (!b.anim) continue;
        const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
        const l = ents.lightAt(cx, y + (b.opaque ? 1 : 0.5), cz);
        if (b.anim === 'water') {
          const spin = waterAround(w, x, y, z, b.rs.axis) > 0 ? t * 1.6 : 0;
          const ax = b.rs.axis === 0;
          for (let i = 0; i < 8; i++) {
            const a = spin + (i * Math.PI) / 4;
            if (ax) CM.mat4.compose(M, cx, cy, cz, 0, a, 0, 1);
            else CM.mat4.compose(M, cx, cy, cz, 0, 0, a, 1);
            if (ax) batch.box(M, -0.36, 0.22, -0.05, 0.36, 0.98, 0.05, L.wheel_paddle, l[0], l[1], 0);
            else batch.box(M, -0.05, 0.22, -0.36, 0.05, 0.98, 0.36, L.wheel_paddle, l[0], l[1], 0);
          }
        } else if (b.anim === 'wind') {
          const f = b.rs.facing, open = g.dim !== 'nether' && w.skyAt(x, y + 1, z) >= 15;
          const spin = open ? t * windOf(y) * 0.45 : 0;
          const ry = f === 4 ? 0 : f === 5 ? Math.PI : f === 0 ? Math.PI / 2 : -Math.PI / 2;
          for (let i = 0; i < 3; i++) {
            CM.mat4.compose(M, cx + DV[f][0] * 0.45, cy + 0.05, cz + DV[f][2] * 0.45, ry, 0, spin + (i * Math.PI * 2) / 3, 1);
            batch.box(M, -0.09, 0.08, 0.02, 0.09, 1.7, 0.07, L.turbine_blade, l[0], l[1], 0);
          }
          CM.mat4.compose(M, cx + DV[f][0] * 0.45, cy + 0.05, cz + DV[f][2] * 0.45, ry, 0, spin, 1);
          batch.box(M, -0.12, -0.12, 0, 0.12, 0.12, 0.12, L.alu_casing, l[0], l[1], 0);
        } else if (b.anim === 'fan') {
          const f = b.rs.facing, spin = b.rs.on ? t * 14 : 0;
          const ry = f === 4 ? 0 : f === 5 ? Math.PI : f === 0 ? Math.PI / 2 : f === 1 ? -Math.PI / 2 : 0;
          const rx = f === 2 ? -Math.PI / 2 : f === 3 ? Math.PI / 2 : 0;
          const lf = ents.lightAt(cx + DV[f][0], cy + DV[f][1], cz + DV[f][2]);
          for (let i = 0; i < 4; i++) {
            CM.mat4.compose(M, cx, cy, cz, ry, rx, spin + (i * Math.PI) / 2, 1);
            batch.box(M, -0.08, 0.04, 0.27, 0.08, 0.42, 0.3, L.fan_blade, lf[0], lf[1], 0);
          }
        } else if (b.anim === 'crusher' && b.rs.on) {
          const lt = ents.lightAt(cx, y + 1, cz);
          for (const [dz, dir] of [[-0.2, 1], [0.2, -1]]) {
            CM.mat4.compose(M, cx, y + 0.86, cz + dz, 0, t * 6 * dir, 0, 1);
            batch.box(M, -0.36, -0.14, -0.14, 0.36, 0.14, 0.14, L.roller, lt[0], lt[1], 0);
          }
        }
      }
    },
  };
})();
