'use strict';
// Touches de fonction F1 à F11 : interface, capture d'écran, débogage (et ses combinaisons F3 + touche),
// mode de jeu, vues, vidéo, zones où les monstres apparaissent, caméra cinématique, sauvegarde, zoom, plein écran.
(function () {
  const $ = (id) => document.getElementById(id);
  const F = (CM.FKeys = {
    f3: false, // F3 maintenue
    f3Used: false, // une combinaison F3 + touche a servi : pas de bascule de l'écran de débogage
    chunks: false, // F3+G : bordures des tronçons
    boxes: false, // F3+B : boîtes de collision
    spawns: false, // F7 : zones où les monstres peuvent apparaître
    cine: false, // F8 : caméra cinématique
    zoom: false, // F10
    look: [0, 0], // mouvement de souris pas encore appliqué (caméra cinématique)
    lookV: [0, 0],
    shot: false, // capture demandée pour la prochaine image
    rec: null, // enregistrement vidéo en cours
    modeAsk: 0, // F4 : instant du premier appui
  });

  const HELP = [
    ['F1', 'masquer l’interface et la main (pour les belles images)'],
    ['F2', 'capture d’écran (image PNG téléchargée)'],
    ['F3', 'informations de débogage (maintiens F3 + une touche : F3+Q pour la liste)'],
    ['F4', 'changer de mode de jeu, survie ⇄ créatif (appuie deux fois)'],
    ['F5', 'changer de vue : 1re personne → de derrière → de face'],
    ['F6', 'filmer une vidéo avec le son (F6 à nouveau pour arrêter)'],
    ['F7', 'montrer où les monstres peuvent apparaître (rouge : tout le temps, jaune : la nuit)'],
    ['F8', 'caméra cinématique (mouvements de souris adoucis)'],
    ['F9', 'sauvegarde rapide'],
    ['F10', 'zoom (comme une longue-vue)'],
    ['F11', 'plein écran'],
  ];
  const COMBOS = [
    ['F3 + A', 'recharger l’affichage du monde'],
    ['F3 + B', 'boîtes de collision des créatures'],
    ['F3 + C', 'copier les coordonnées (commande /tp)'],
    ['F3 + D', 'effacer le tchat'],
    ['F3 + G', 'bordures des tronçons (16 × 16 blocs)'],
    ['F3 + H', 'infobulles avancées (identifiants, durabilité)'],
    ['F3 + Q', 'cette liste'],
  ];
  F.HELP = HELP;
  F.COMBOS = COMBOS;

  const toast = (g, s, key) => g.ui.toast(s, 'info', key || s);
  const onOff = (v) => (v ? 'activé' : 'désactivé');

  // ----------------------------------------------------------- touches --
  // Appui sur une touche pendant la partie. Renvoie true si la touche est prise ici.
  F.keydown = function (g, e) {
    const c = e.code;
    // combinaisons F3 + touche (la touche ne fait alors rien d'autre : F3+Q ne jette rien)
    if (F.f3 && c !== 'F3') {
      // (la lettre imprimée sur la touche : F3 + A est bien la touche A, en AZERTY comme en QWERTY)
      const k = e.key && e.key.length === 1 && /[a-z]/i.test(e.key) ? 'Key' + e.key.toUpperCase() : c;
      const fn = COMBO_FN[k];
      if (fn) {
        e.preventDefault();
        if (!e.repeat) fn(g);
        F.f3Used = true;
        return true;
      }
      return false;
    }
    if (!/^F([1-9]|1[01])$/.test(c)) return false;
    e.preventDefault(); // (F5 rechargerait la page, F1 ouvrirait l'aide du navigateur…)
    if (e.repeat) return true;
    const free = !g.paused && !g.ui.invOpen && !g.ui.modal;
    switch (c) {
      case 'F1':
        g.ui.toggleHud();
        break;
      case 'F2':
        F.shot = true;
        break;
      case 'F3':
        F.f3 = true;
        F.f3Used = false;
        break;
      case 'F4':
        if (free) F.mode(g);
        break;
      case 'F5':
        if (free) g.toggleView(true);
        break;
      case 'F6':
        F.video(g);
        break;
      case 'F7':
        F.spawns = !F.spawns;
        F.spawnT = 0;
        toast(g, '👾 Zones d’apparition des monstres : ' + onOff(F.spawns) + (F.spawns ? ' (rouge : tout le temps · jaune : la nuit)' : ''), 'fk7');
        break;
      case 'F8':
        F.cine = !F.cine;
        F.look[0] = F.look[1] = F.lookV[0] = F.lookV[1] = 0;
        toast(g, '🎬 Caméra cinématique ' + onOff(F.cine), 'fk8');
        break;
      case 'F9':
        g.save(false);
        break;
      case 'F10':
        F.zoom = !F.zoom;
        toast(g, F.zoom ? '🔍 Zoom ×4 (F10 pour revenir)' : '🔍 Zoom désactivé', 'fk10');
        break;
      case 'F11':
        g.toggleFullscreen();
        break;
    }
    return true;
  };
  F.keyup = function (g, e) {
    if (e.code !== 'F3' || !F.f3) return;
    F.f3 = false;
    if (!F.f3Used && g.state === 'playing') g.ui.toggleDebug();
  };
  // fenêtre quittée : F3 n'est plus tenue
  F.blur = function () {
    F.f3 = false;
  };

  const COMBO_FN = {
    KeyA(g) {
      g.renderer.freeAll();
      toast(g, '🔄 Affichage du monde rechargé', 'fk3a');
    },
    KeyB(g) {
      F.boxes = !F.boxes;
      toast(g, '📦 Boîtes de collision : ' + (F.boxes ? 'affichées' : 'masquées'), 'fk3b');
    },
    KeyC(g) {
      const p = g.player, r = (v) => Math.round(v * 100) / 100;
      const s = '/tp ' + r(p.x) + ' ' + r(p.y) + ' ' + r(p.z);
      copy(s).then((ok) => toast(g, ok ? '📋 Coordonnées copiées : ' + s : '📋 ' + s + ' (copie impossible ici)', 'fk3c'));
    },
    KeyD(g) {
      if (g.net.chatEl) g.net.chatEl.innerHTML = '';
      toast(g, '💬 Tchat effacé', 'fk3d');
    },
    KeyG(g) {
      F.chunks = !F.chunks;
      toast(g, '🟨 Bordures des tronçons : ' + (F.chunks ? 'affichées' : 'masquées'), 'fk3g');
    },
    KeyH(g) {
      g.ui.advTips = !g.ui.advTips;
      toast(g, '🏷 Infobulles avancées : ' + (g.ui.advTips ? 'affichées' : 'masquées'), 'fk3h');
    },
    KeyQ(g) {
      const pr = CM.Commands.print;
      pr('⌨ Touches F :', 'ann');
      for (const [k, d] of HELP) pr(k + ' : ' + d, 'info');
      pr('⌨ Combinaisons (maintiens F3) :', 'ann');
      for (const [k, d] of COMBOS) pr(k + ' : ' + d, 'info');
    },
  };

  function copy(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => copyOld(s));
    return Promise.resolve(copyOld(s));
  }
  function copyOld(s) {
    try {
      const t = document.createElement('textarea');
      t.value = s;
      t.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------ mode de jeu --
  // Deux appuis rapprochés sur F4 : pas de changement de mode par accident.
  F.mode = function (g) {
    const net = g.net, now = performance.now();
    const to = g.mode === 'creative' ? 'survie' : 'créatif';
    if (net.isClient && !net.rules.cmds) {
      g.ui.toast('🎮 Changer de mode : l’hôte doit d’abord autoriser les triches (/triche on)', 'warn', 'fk4');
      return;
    }
    if (now - F.modeAsk > 2500) {
      F.modeAsk = now;
      g.ui.toast('🎮 Appuie encore sur F4 pour passer en mode ' + to, 'info', 'fk4');
      return;
    }
    F.modeAsk = 0;
    CM.Commands.run('/mode ' + (g.mode === 'creative' ? 'survie' : 'creatif'));
  };

  // ------------------------------------------------ capture d'écran --
  const stamp = () => {
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '_' + z(d.getHours()) + '-' + z(d.getMinutes()) + '-' + z(d.getSeconds());
  };
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  // Juste après le dessin de l'image (le contenu WebGL n'est lisible qu'à ce moment-là).
  F.afterRender = function (g) {
    if (!F.shot) return;
    F.shot = false;
    const name = 'craftmine_' + stamp() + '.png';
    g.canvas.toBlob((b) => {
      if (!b) return g.ui.toast('📸 Capture impossible', 'warn', 'fk2');
      download(b, name);
      g.ui.toast('📸 Capture enregistrée : ' + name, 'good', 'fk2');
    }, 'image/png');
    CM.Audio.play('shutter');
    const fl = $('fk-flash');
    if (fl) {
      fl.classList.remove('go');
      void fl.offsetWidth;
      fl.classList.add('go');
    }
  };

  // ---------------------------------------------------------- vidéo --
  F.video = function (g) {
    if (F.rec) return F.stopVideo(g);
    const MR = window.MediaRecorder;
    if (!MR || !g.canvas.captureStream) return g.ui.toast('🎥 Ce navigateur ne sait pas filmer le jeu', 'warn', 'fk6');
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const type = types.find((t) => MR.isTypeSupported && MR.isTypeSupported(t)) || '';
    let stream, dest = null;
    try {
      stream = g.canvas.captureStream(30);
      CM.Audio.init();
      const A = CM.Audio;
      if (A.ctx && A.master && A.ctx.createMediaStreamDestination) {
        dest = A.ctx.createMediaStreamDestination();
        A.master.connect(dest);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      }
      const mr = new MR(stream, type ? { mimeType: type, videoBitsPerSecond: 6000000 } : undefined);
      const parts = [];
      mr.ondataavailable = (e) => e.data && e.data.size && parts.push(e.data);
      mr.onstop = () => {
        const mime = mr.mimeType || type || 'video/webm';
        const name = 'craftmine_' + stamp() + (mime.includes('mp4') ? '.mp4' : '.webm');
        if (parts.length) download(new Blob(parts, { type: mime.split(';')[0] }), name);
        g.ui.toast(parts.length ? '🎥 Vidéo enregistrée : ' + name : '🎥 Vidéo vide', parts.length ? 'good' : 'warn', 'fk6');
      };
      mr.start(1000);
      F.rec = { mr, dest, t0: performance.now(), stream };
    } catch (e) {
      console.error(e);
      if (dest) CM.Audio.master.disconnect(dest);
      return g.ui.toast('🎥 Impossible de filmer : ' + e.message, 'warn', 'fk6');
    }
    toast(g, '🎥 Enregistrement… (F6 pour arrêter, 5 minutes au plus)', 'fk6');
    $('fk-rec').classList.remove('hidden');
  };
  F.stopVideo = function (g) {
    const r = F.rec;
    if (!r) return;
    F.rec = null;
    try {
      if (r.mr.state !== 'inactive') r.mr.stop();
    } catch (e) {
      console.error(e);
    }
    for (const t of r.stream.getTracks()) if (t.kind === 'video') t.stop();
    if (r.dest) {
      try {
        CM.Audio.master.disconnect(r.dest);
      } catch (e) {
        /* déjà débranché */
      }
    }
    $('fk-rec').classList.add('hidden');
  };

  // ------------------------------------------------ à chaque image --
  F.frame = function (g, dt) {
    // caméra cinématique : le regard rattrape doucement la souris
    if (F.cine && (F.look[0] || F.look[1] || F.lookV[0] || F.lookV[1])) {
      const p = g.player, k = 1 - Math.exp(-dt * 7);
      for (let i = 0; i < 2; i++) {
        F.lookV[i] += (F.look[i] - F.lookV[i]) * k;
        const d = F.lookV[i] * Math.min(1, dt * 6);
        F.look[i] -= d;
        if (i === 0) p.yaw -= d;
        else p.pitch = CM.clamp(p.pitch - d, -1.55, 1.55);
        if (Math.abs(F.look[i]) < 1e-5 && Math.abs(F.lookV[i]) < 1e-5) F.look[i] = F.lookV[i] = 0;
      }
    }
    if (F.rec) {
      const s = Math.floor((performance.now() - F.rec.t0) / 1000);
      $('fk-rec-t').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (s >= 300) F.stopVideo(g);
    }
  };
  // Mouvement de souris (renvoie true s'il est gardé pour la caméra cinématique).
  F.mouse = function (dyaw, dpitch) {
    if (!F.cine) return false;
    F.look[0] += dyaw;
    F.look[1] += dpitch;
    return true;
  };
  F.fovMul = () => (F.zoom ? 0.25 : 1);
  F.sensMul = () => (F.zoom ? 0.3 : 1);

  // ------------------------------------------------ traits à dessiner --
  // Listes de segments { v: [x, y, z, …] relatifs à la caméra, c: couleur } pour le moteur de rendu.
  F.lines = function (g, cam) {
    const out = [];
    if (F.chunks) chunkLines(g, cam, out);
    if (F.boxes) boxLines(g, cam, out);
    if (F.spawns) spawnLines(g, cam, out);
    return out.length ? out : null;
  };
  function seg(v, cam, x0, y0, z0, x1, y1, z1) {
    v.push(x0 - cam[0], y0 - cam[1], z0 - cam[2], x1 - cam[0], y1 - cam[1], z1 - cam[2]);
  }
  function box(v, cam, x0, y0, z0, x1, y1, z1) {
    for (const y of [y0, y1]) {
      seg(v, cam, x0, y, z0, x1, y, z0);
      seg(v, cam, x1, y, z0, x1, y, z1);
      seg(v, cam, x1, y, z1, x0, y, z1);
      seg(v, cam, x0, y, z1, x0, y, z0);
    }
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) seg(v, cam, x, y0, z, x, y1, z);
  }
  function chunkLines(g, cam, out) {
    const p = g.player, W = CM.WORLD;
    const cx = Math.floor(p.x / 16) * 16, cz = Math.floor(p.z / 16) * 16;
    const lo = W.MINY, hi = W.H;
    // coins des tronçons voisins (rouge)
    const red = [];
    for (let i = -2; i <= 3; i++)
      for (let j = -2; j <= 3; j++) {
        if ((i === 0 || i === 1) && (j === 0 || j === 1)) continue;
        seg(red, cam, cx + i * 16, lo, cz + j * 16, cx + i * 16, hi, cz + j * 16);
      }
    out.push({ v: red, c: [1, 0.2, 0.2, 0.7] });
    // tronçon où l'on est : quadrillage tous les 2 blocs près du joueur (jaune), sections de 16 (bleu)
    const yel = [], blue = [];
    const ya = Math.max(lo, Math.floor(p.y / 2) * 2 - 24), yb = Math.min(hi, ya + 50);
    for (let k = 2; k < 16; k += 2) {
      seg(yel, cam, cx + k, ya, cz, cx + k, yb, cz);
      seg(yel, cam, cx + k, ya, cz + 16, cx + k, yb, cz + 16);
      seg(yel, cam, cx, ya, cz + k, cx, yb, cz + k);
      seg(yel, cam, cx + 16, ya, cz + k, cx + 16, yb, cz + k);
    }
    for (let y = ya; y <= yb; y += 2) {
      const arr = (y - lo) % 16 === 0 ? blue : yel;
      seg(arr, cam, cx, y, cz, cx + 16, y, cz);
      seg(arr, cam, cx + 16, y, cz, cx + 16, y, cz + 16);
      seg(arr, cam, cx + 16, y, cz + 16, cx, y, cz + 16);
      seg(arr, cam, cx, y, cz + 16, cx, y, cz);
    }
    for (const [x, z] of [[cx, cz], [cx + 16, cz], [cx + 16, cz + 16], [cx, cz + 16]]) seg(blue, cam, x, lo, z, x, hi, z);
    out.push({ v: yel, c: [1, 0.9, 0.2, 0.55] });
    out.push({ v: blue, c: [0.3, 0.55, 1, 0.9] });
  }
  function boxLines(g, cam, out) {
    const E = g.entities, p = g.player, v = [], eye = [];
    const near = (x, y, z) => Math.abs(x - p.x) < 48 && Math.abs(y - p.y) < 48 && Math.abs(z - p.z) < 48;
    for (const m of E.mobs) {
      if (m.dead || !near(m.x, m.y, m.z)) continue;
      const hw = m.hw || 0.3, h = m.h || 1;
      box(v, cam, m.x - hw, m.y, m.z - hw, m.x + hw, m.y + h, m.z + hw);
      const ey = m.y + h * 0.85; // hauteur des yeux (rouge)
      seg(eye, cam, m.x - hw, ey, m.z - hw, m.x + hw, ey, m.z - hw);
      seg(eye, cam, m.x + hw, ey, m.z - hw, m.x + hw, ey, m.z + hw);
      seg(eye, cam, m.x + hw, ey, m.z + hw, m.x - hw, ey, m.z + hw);
      seg(eye, cam, m.x - hw, ey, m.z + hw, m.x - hw, ey, m.z - hw);
    }
    for (const d of E.drops) if (!d.dead && near(d.x, d.y, d.z)) box(v, cam, d.x - 0.125, d.y, d.z - 0.125, d.x + 0.125, d.y + 0.25, d.z + 0.125);
    for (const c of E.carts || []) {
      if (c.dead || !near(c.x, c.y, c.z)) continue;
      const hw = c.hw || 0.45, h = c.h || 0.7;
      box(v, cam, c.x - hw, c.y, c.z - hw, c.x + hw, c.y + h, c.z + hw);
    }
    const pl = [];
    for (const rp of g.net.remotes.values()) {
      if (!rp.seen || rp.dim !== g.dim || !rp.alive) continue;
      box(pl, cam, rp.rx - 0.3, rp.ry, rp.rz - 0.3, rp.rx + 0.3, rp.ry + 1.8, rp.rz + 0.3);
    }
    if (g.thirdView() && p.alive) box(pl, cam, p.x - 0.3, p.y, p.z - 0.3, p.x + 0.3, p.y + 1.8, p.z + 0.3);
    out.push({ v, c: [1, 1, 1, 0.85] });
    if (eye.length) out.push({ v: eye, c: [1, 0.25, 0.25, 0.9] });
    if (pl.length) out.push({ v: pl, c: [0.4, 0.9, 1, 0.9] });
  }
  // Mêmes règles que l'apparition des monstres : sol solide, deux blocs d'air, pas de liquide,
  // lumière des blocs < 4 ; rouge si le ciel est sombre aussi (tout le temps), jaune sinon (la nuit).
  function spawnLines(g, cam, out) {
    const p = g.player, w = g.world;
    F.spawnT = (F.spawnT || 0) - 1;
    if (F.spawnT <= 0 || !F.spawnList || F.spawnDim !== g.dim) {
      F.spawnT = 20;
      F.spawnDim = g.dim;
      const red = [], yel = [];
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z), R = 16;
      for (let x = px - R; x <= px + R; x++)
        for (let z = pz - R; z <= pz + R; z++) {
          if (!w.loaded(x, z)) continue;
          for (let y = Math.max(CM.WORLD.MINY + 1, py - 10); y <= Math.min(CM.WORLD.H - 2, py + 6); y++) {
            if (!w.solidAt(x, y - 1, z) || w.solidAt(x, y, z) || w.solidAt(x, y + 1, z)) continue;
            if (CM.isFluid(w.get(x, y, z)) || CM.isFluid(w.get(x, y - 1, z))) continue;
            if (w.blockLightAt(x, y, z) >= 4) continue;
            (w.skyAt(x, y, z) < 4 ? red : yel).push(x, y, z);
          }
        }
      F.spawnList = [red, yel];
    }
    const cols = [[1, 0.15, 0.15, 0.85], [1, 0.85, 0.1, 0.85]];
    F.spawnList.forEach((l, i) => {
      if (!l.length) return;
      const v = [];
      for (let k = 0; k < l.length; k += 3) {
        const x = l[k], y = l[k + 1] + 0.02, z = l[k + 2];
        seg(v, cam, x + 0.15, y, z + 0.15, x + 0.85, y, z + 0.85);
        seg(v, cam, x + 0.85, y, z + 0.15, x + 0.15, y, z + 0.85);
      }
      out.push({ v, c: cols[i] });
    });
  }

  // (éléments d'écran : éclair blanc de la capture, voyant d'enregistrement)
  F.init = function () {
    if ($('fk-flash')) return;
    const fl = document.createElement('div');
    fl.id = 'fk-flash';
    document.body.appendChild(fl);
    const rec = document.createElement('div');
    rec.id = 'fk-rec';
    rec.className = 'hidden';
    rec.innerHTML = '<i></i> REC <span id="fk-rec-t">0:00</span>';
    document.body.appendChild(rec);
  };
})();
