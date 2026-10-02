'use strict';
// Gestes (menu G → Gestes, ou /geste <nom>) : saluer, danser, s'asseoir… Les autres joueurs les
// voient (le geste part avec l'état du joueur). Bouger, frapper ou être touché l'arrête.
(function () {
  const PI = Math.PI;
  const sin = Math.sin;
  // dur : durée en secondes (0 : jusqu'à ce qu'on bouge)
  const LIST = [
    { k: 'saluer', icon: '👋', name: 'Saluer', dur: 2.6 },
    { k: 'danser', icon: '💃', name: 'Danser', dur: 0 },
    { k: 'asseoir', icon: '🪑', name: 'S’asseoir', dur: 0 },
    { k: 'hourra', icon: '🙌', name: 'Hourra !', dur: 2.4 },
    { k: 'applaudir', icon: '👏', name: 'Applaudir', dur: 3 },
    { k: 'reverence', icon: '🙇', name: 'Révérence', dur: 2 },
    { k: 'montrer', icon: '👉', name: 'Montrer', dur: 3 },
    { k: 'reflechir', icon: '🤔', name: 'Réfléchir', dur: 4 },
    { k: 'desespoir', icon: '🤦', name: 'Désespoir', dur: 2.2 },
    // mèmes
    { k: 'dab', icon: '😎', name: 'Dab', dur: 2, meme: true },
    { k: 'tpose', icon: '✝', name: 'T-pose', dur: 0, meme: true },
    { k: 'floss', icon: '🕺', name: 'Floss', dur: 0, meme: true },
    { k: 'griddy', icon: '🏃', name: 'Griddy', dur: 0, meme: true },
    { k: 'gangnam', icon: '🐴', name: 'Gangnam Style', dur: 0, meme: true },
    { k: 'carlton', icon: '🎵', name: 'Carlton', dur: 0, meme: true },
    { k: 'loser', icon: '🫵', name: 'L sur le front', dur: 3, meme: true },
    { k: 'toupie', icon: '🌀', name: 'Toupie', dur: 2.5, meme: true },
  ];
  const ALIASES = { wave: 'saluer', salut: 'saluer', dance: 'danser', danse: 'danser', sit: 'asseoir', assis: 'asseoir', cheer: 'hourra', clap: 'applaudir', bravo: 'applaudir', bow: 'reverence', point: 'montrer', think: 'reflechir', facepalm: 'desespoir', t_pose: 'tpose', t: 'tpose', l: 'loser', spin: 'toupie', gangnam_style: 'gangnam' };

  const E = {
    LIST,
    byId: (id) => LIST[(id | 0) - 1] || null,
    // Pose du personnage pendant le geste (t : secondes depuis le début), ou null quand il est fini.
    // ra / la : bras droit / gauche [rotation vers l'avant, écart sur le côté (vers l'extérieur > 0)]
    pose(id, t, pitch) {
      const e = E.byId(id);
      if (!e || t < 0 || (e.dur && t > e.dur)) return null;
      // (on entre dans la pose et on en sort en douceur)
      const env = Math.max(0, Math.min(1, t / 0.22, e.dur ? (e.dur - t) / 0.22 : 1));
      const p = { ra: [0, 0.05], la: [0, 0.05], lean: 0, dy: 0, roll: 0, yaw: 0, hp: 0, legs: null, sit: false, env };
      switch (e.k) {
        case 'saluer':
          p.ra = [2.75, 0.2 + 0.4 * sin(t * 10)];
          break;
        case 'danser':
          p.ra = [2.5 + 0.5 * sin(t * 6), 0.35];
          p.la = [2.5 + 0.5 * sin(t * 6 + PI), 0.35];
          p.roll = 0.12 * sin(t * 3);
          p.yaw = 0.3 * sin(t * 3);
          p.dy = Math.abs(sin(t * 6)) * 0.08;
          p.legs = [0.35 * sin(t * 6), -0.35 * sin(t * 6)];
          break;
        case 'asseoir':
          p.sit = true;
          p.dy = -0.52;
          p.ra = [0.75, 0.08];
          p.la = [0.75, 0.08];
          p.legs = [1.5, 1.5];
          break;
        case 'hourra':
          p.ra = [2.95, 0.3 + 0.08 * sin(t * 14)];
          p.la = [2.95, 0.3 + 0.08 * sin(t * 14)];
          p.dy = Math.abs(sin(t * 7)) * 0.2;
          break;
        case 'applaudir': {
          const c = Math.abs(sin(t * 9));
          p.ra = [1.25, -0.15 - 0.3 * c];
          p.la = [1.25, -0.15 - 0.3 * c];
          break;
        }
        case 'reverence':
          p.lean = 0.85;
          p.ra = [0.35, 0.05];
          p.la = [-0.3, 0.05];
          p.hp = 0.3;
          break;
        case 'montrer':
          p.ra = [PI / 2 + Math.max(-1.2, Math.min(1.2, pitch || 0)) * 0.9, 0];
          break;
        case 'reflechir':
          p.ra = [2.15, -0.7];
          p.la = [0.9, -0.55];
          p.hp = 0.2;
          break;
        case 'desespoir':
          p.ra = [2.45, -0.8];
          p.hp = 0.45;
          break;
        // --- mèmes ---
        case 'dab':
          // la tête plonge dans le coude, l'autre bras tendu vers le ciel
          p.ra = [2.3, 1.15];
          p.la = [1.95, -1.25];
          p.hp = 0.6;
          p.yaw = 0.35;
          break;
        case 'tpose':
          p.ra = [0, PI / 2];
          p.la = [0, PI / 2];
          break;
        case 'floss': {
          // les bras passent devant et derrière, les hanches de l'autre côté
          const c = sin(t * 7), s2 = sin(t * 14);
          p.ra = [0.55 * s2, 0.15 + 0.55 * c];
          p.la = [-0.55 * s2, 0.15 - 0.55 * c];
          p.roll = -0.12 * c;
          break;
        }
        case 'griddy': {
          const s3 = sin(t * 10);
          p.lean = 0.3;
          p.ra = [0.6 + 1.0 * s3, 0.15];
          p.la = [0.6 - 1.0 * s3, 0.15];
          p.legs = [0.7 * s3, -0.7 * s3];
          p.dy = Math.abs(s3) * 0.07;
          break;
        }
        case 'gangnam': {
          // les poignets croisés comme sur des rênes, petits sauts d'une jambe sur l'autre
          const s4 = sin(t * 7);
          p.ra = [1.35 + 0.15 * s4, -0.4];
          p.la = [1.35 + 0.15 * s4, -0.4];
          p.dy = Math.abs(s4) * 0.16;
          p.legs = [0.45 * Math.max(0, s4), 0.45 * Math.max(0, -s4)];
          break;
        }
        case 'carlton': {
          const c5 = sin(t * 5);
          p.ra = [0.9 + 0.2 * c5, 0.25 + 0.55 * c5];
          p.la = [0.9 - 0.2 * c5, 0.25 - 0.55 * c5];
          p.roll = 0.08 * c5;
          p.yaw = 0.3 * c5;
          p.legs = [0.15 * c5, -0.15 * c5];
          break;
        }
        case 'loser':
          // la main en « L » sur le front, en sautillant
          p.ra = [2.65, -0.65];
          p.hp = -0.15;
          p.dy = Math.abs(sin(t * 6)) * 0.12;
          p.legs = [0.3 * sin(t * 6), -0.3 * sin(t * 6)];
          break;
        case 'toupie':
          p.ra = [0, 1.3];
          p.la = [0, 1.3];
          p.yaw = t * 11;
          p.dy = 0.05 * Math.abs(sin(t * 11));
          break;
      }
      return p;
    },
    // Le joueur de cet écran fait un geste.
    start(g, k) {
      const i = LIST.findIndex((e) => e.k === k);
      if (i < 0) return false;
      const p = g.player;
      p.emote = i + 1;
      p.emoteT = g.clock;
      return true;
    },
    // À chaque image : bouger, frapper, être touché ou tomber arrête le geste.
    update(g, p) {
      if (!p.emote) return;
      const e = E.byId(p.emote), t = g.clock - p.emoteT;
      if (!e || !p.alive || (e.dur && t > e.dur) || Math.hypot(p.vx, p.vz) > 0.6 || p.swing > 0.9 || p.hurtFlash > 0.3 || p.flying || (!p.onGround && t > 0.3) || p.sleeping || (p.mount !== null && p.mount !== undefined) || (p.riding !== null && p.riding !== undefined)) p.emote = 0;
    },
    // Caméra plus basse quand on est assis.
    camDrop(p) {
      const e = p.emote ? E.byId(p.emote) : null;
      return e && e.k === 'asseoir' ? 0.5 * Math.min(1, (CM.game.clock - p.emoteT) / 0.22) : 0;
    },
  };

  CM.Commands.def('geste emote gestes', {
    cat: 'Amusant', local: true, usage: '<' + LIST.map((e) => e.k).join(' | ') + ' | stop>', desc: 'un geste que les autres joueurs voient (bouger l’arrête)',
    args: [() => LIST.map((e) => e.k).concat(['stop'])],
    run(ctx, a, o) {
      const g = CM.game, n = CM.Commands.norm(a[0] || '');
      if (!n) return o.info('Gestes : ' + LIST.map((e) => e.icon + ' ' + e.k).join(' · ') + ' (aussi dans le menu ' + g.keyName(g.binds.tpmenu) + ' → Gestes)');
      if (n === 'stop' || n === 'arret') {
        g.player.emote = 0;
        return o.ok('Geste arrêté');
      }
      const k = ALIASES[n] || n;
      const e = LIST.find((x) => x.k === k || x.k.startsWith(k));
      if (!e) CM.Commands.bad('Geste inconnu : « ' + a[0] + ' » (' + LIST.map((x) => x.k).join(', ') + ')');
      if (!g.player.alive) CM.Commands.bad('Impossible pour l’instant');
      E.start(g, e.k);
      o.ok(e.icon + ' ' + e.name + (g.net.active ? ' : les autres te voient' : '') + ' (vue de derrière : touche ' + g.keyName(g.binds.view) + ')');
    },
  });
  CM.Emotes = E;
})();
