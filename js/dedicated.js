'use strict';
// Serveur dédié : le jeu tourne sans image ni son sur une machine allumée 24 h/24
// (voir serveur/serveur.js), comme hôte permanent de la partie « SERVEUR ».
// Son propre joueur est invisible : il ne compte ni pour les créatures, ni pour les autres joueurs.
// Le monde est enregistré sur le disque de la machine (et non dans le navigateur).
(function () {
  const D = (CM.Dedicated = { on: false, cfg: {}, max: 10 });
  CM.SERVER_CODE = 'SERVEUR'; // code affiché aux joueurs
  CM.SERVER_PEER = 'craftmine16-serveur-officiel'; // identifiant du serveur sur le réseau de mise en relation

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (s) => {
    try {
      if (window.cmServerLog) window.cmServerLog(String(s));
      else console.log(s);
    } catch (e) {
      /* ignore */
    }
  };
  D.log = log;

  // Réglages du nouveau monde (config.json de la machine).
  function worldSettings(c) {
    const ext = [].concat(c.extensions || []);
    return {
      mode: c.mode === 'creatif' || c.mode === 'creative' ? 'creative' : 'survival',
      difficulty: ['peaceful', 'easy', 'normal', 'hard'].includes(c.difficulte) ? c.difficulte : { paisible: 'peaceful', facile: 'easy', difficile: 'hard' }[c.difficulte] || 'normal',
      type: ['normal', 'flat', 'islands', 'city', 'amplified'].includes(c.type) ? c.type : { ville: 'city', plat: 'flat', archipel: 'islands', amplifie: 'amplified' }[c.type] || 'normal',
      biomeSize: 'normal',
      bonusChest: !!c.coffreBonus,
      dayCycle: c.cycleJour !== false,
      guestCheats: !!c.triches,
      ext: { tech: ext.includes('electricite'), light: ext.includes('lumiere') || c.lumiere !== false, gravity: ext.includes('gravite'), guns: ext.includes('armes'), vehicles: ext.includes('vehicules') },
    };
  }
  function seedOf(v) {
    if (v === undefined || v === null || v === '') return Math.floor(Math.random() * 4000000000);
    if (/^-?\d+$/.test(String(v))) return Math.abs(+v) % 4294967296;
    return CM.hashString(String(v));
  }

  D.start = async function (g) {
    D.on = true;
    g.dedicated = true;
    document.body.classList.add('dedicated');
    const c = (D.cfg = (window.cmServerConfig ? await window.cmServerConfig() : null) || {});
    D.max = Math.max(2, Math.min(20, c.maxJoueurs | 0 || 10));
    // (rien à dessiner : on économise la machine)
    Object.assign(g.options, { maxFps: 20, renderDist: 4, particles: 0, touchControls: 'off', toasts: 0, perf: false, autosave: 60, minimap: 0, keepInventory: !!c.garderInventaire });
    g.applyOptions();
    let save = null;
    try {
      const s = window.cmServerLoad ? await window.cmServerLoad() : null;
      if (s) save = JSON.parse(s);
    } catch (e) {
      log('⚠ Sauvegarde illisible : ' + e.message + ' (un nouveau monde est créé)');
    }
    if (save && save.seed !== undefined) {
      log('🌍 Chargement du monde (graine ' + save.seed + ')…');
      await g.startWorld(save.seed, save);
    } else {
      const seed = seedOf(c.graine);
      log('🌍 Création d’un nouveau monde (graine ' + seed + ')…');
      await g.startWorld(seed, null, worldSettings(c));
    }
    g.ui.hide('start');
    parkPlayer(g);
    // journal de la machine : tout ce qui s'écrit dans le tchat (messages, arrivées, départs, commandes)
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.textContent) log('💬 ' + n.textContent);
    }).observe(g.net.chatEl, { childList: true });
    await openServer(g);
    D.save(g);
    setInterval(() => watch(g), 20000);
  };

  // Le joueur du serveur : immobile au-dessus du point de départ, jamais blessé.
  function parkPlayer(g) {
    const p = g.player, sp = g.worlds.overworld.spawn;
    p.x = sp.x;
    p.z = sp.z;
    p.y = Math.min(CM.WORLD.H - 3, sp.y + 40);
    p.vx = p.vy = p.vz = 0;
    p.flying = true;
  }

  async function openServer(g) {
    const c = D.cfg;
    for (let k = 0; ; k++) {
      try {
        await g.net.host(c.nom || 'Serveur', !!c.pvp, CM.SERVER_PEER);
        break;
      } catch (e) {
        log('⚠ Ouverture impossible (' + ((e && (e.type || e.message)) || e) + '), nouvel essai dans 15 s');
        await sleep(15000);
      }
    }
    g.net.rules.cmds = !!(g.settings && g.settings.guestCheats);
    g.net.sendCfg();
    log('✅ Serveur ouvert ! On le rejoint avec le bouton « Serveur » du jeu.');
  }

  // Connexion au réseau de mise en relation perdue pour de bon : on rouvre.
  let reopening = false;
  async function watch(g) {
    const net = g.net;
    if (reopening || g.state !== 'playing') return;
    if (net.isHost && net.peer && !net.peer.destroyed) return;
    reopening = true;
    log('⚠ Serveur coupé du réseau, réouverture…');
    try {
      if (net.peer) net.peer.destroy();
    } catch (e) {
      /* ignore */
    }
    net.reset();
    await openServer(g);
    reopening = false;
  }

  // Sauvegarde sur le disque de la machine.
  D.save = function (g) {
    if (!g.world || g.state !== 'playing' || !window.cmServerSave) return;
    try {
      return window.cmServerSave(JSON.stringify(g.saveData()));
    } catch (e) {
      log('⚠ Sauvegarde impossible : ' + e.message);
    }
  };

  // Avant un arrêt : chaque joueur envoie sa progression, puis le monde est enregistré.
  D.shutdown = async function (g) {
    if (g.net.isHost && g.net.links.size) {
      g.net.broadcast({ t: 'rsave' });
      await sleep(2500);
    }
    await D.save(g);
    if (g.net.isHost) g.net.broadcast({ t: 'bye', r: 'Le serveur CraftMine redémarre (mise à jour ou maintenance). Reviens dans une minute !' });
  };

  // À chaque image : nuit passée si tous les joueurs du monde normal dorment.
  D.tick = function (g, dt) {
    const pls = [...g.net.remotes.values()].filter((rp) => rp.seen && rp.alive && rp.dim === 'overworld');
    const all = pls.length > 0 && pls.every((rp) => rp.flags & 32);
    D.sleepT = all ? (D.sleepT || 0) + dt : 0;
    if (D.sleepT > 2.5 && g.daylight < 0.45) {
      D.sleepT = 0;
      if (g.time > 0.4) g.dayCount++;
      g.time = 0.02;
      g.net.broadcast({ t: 'time', ti: g.time, d: g.dayCount, l: g.dayLen });
      g.net.sys('☀ Tout le monde dort : jour ' + (g.dayCount + 1));
    }
    const p = g.player;
    if (p && (Math.abs(p.vy) > 0 || !p.flying)) parkPlayer(g);
  };

  // /admin : mot de passe du fichier config.json de la machine.
  const fails = new Map();
  // Commande tapée sur la machine (commande « craftmine cmd … »), avec les droits de l'hôte.
  D.run = function (line) {
    line = String(line || '').trim();
    if (!line) return;
    CM.Commands.run(line.startsWith('/') ? line : '/annonce ' + line);
  };
  D.status = function () {
    const g = CM.game, net = g && g.net;
    return {
      ok: !!(g && g.state === 'playing' && net && net.isHost && net.peer && !net.peer.destroyed),
      joueurs: net ? [...net.links.values()].map((e) => e.name) : [],
      jour: g ? g.dayCount + 1 : 0,
    };
  };
  D.checkAdmin = function (pid, pw) {
    const want = String(D.cfg.motDePasseAdmin || '');
    const f = fails.get(pid) || { n: 0, t: 0 };
    if (f.n >= 3 && performance.now() - f.t < 60000) return 'wait';
    if (want.length >= 4 && String(pw || '') === want) {
      fails.delete(pid);
      return 'ok';
    }
    fails.set(pid, { n: f.n + 1, t: performance.now() });
    return 'bad';
  };
})();
