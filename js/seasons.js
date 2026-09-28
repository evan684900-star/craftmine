'use strict';
// Saisons (mondes créés depuis cette version, règle /regle saisons) : 5 jours chacune.
// - Printemps : feuillage tendre, les cultures poussent plus vite, la neige fond.
// - Été : étoiles filantes plus nombreuses.
// - Automne : feuilles jaunes, orange et rouges, herbe qui jaunit.
// - Hiver : couleurs éteintes, il neige dans les biomes tempérés et la neige s'accumule,
//   les cultures poussent lentement (sauf éclairées par des torches), aurores boréales.
// Ciel : aurores boréales (biomes froids, et partout l'hiver) et étoiles filantes la nuit.
(function () {
  const TAU = Math.PI * 2;
  const S = (CM.Seasons = {
    LEN: 5, // jours par saison
    NAMES: ['Printemps', 'Été', 'Automne', 'Hiver'],
    ICONS: ['🌸', '☀', '🍂', '❄'],
    meteor: null,
    meteorT: 12,
    aurora: 0,
    snowT: 0,
  });
  let TEMPERATE = null, COLD = null, SNOWY_OK = null;
  const sets = () => {
    if (TEMPERATE) return;
    const B = CM.BIO;
    TEMPERATE = new Set(['PLAINS', 'FOREST', 'BIRCH', 'TAIGA', 'MOUNTAINS', 'FLOWERS', 'CHERRY', 'DARK_FOREST', 'MEADOW', 'SWAMP', 'OLD_GROWTH'].map((k) => B[k]).filter((v) => v !== undefined));
    COLD = new Set(['SNOWY_TAIGA', 'TUNDRA', 'ICE_SPIKES'].map((k) => B[k]).filter((v) => v !== undefined));
  };
  // Saisons actives ? (règle de la partie, activée par défaut dans les nouveaux mondes)
  S.on = (g) => (g.net && g.net.isClient ? !!g.net.rules.seasons : !!g.settings && g.settings.seasons === true);
  // Position dans l'année : saison en cours et poids de chacune (fondu pendant le dernier jour).
  S.state = function (g) {
    const f = ((g.dayCount + (g.time || 0)) / S.LEN) % 4;
    const i = Math.floor(f), t = f - i;
    const w = [0, 0, 0, 0];
    const b = CM.smoothstep(0.8, 1, t);
    w[i] = 1 - b;
    w[(i + 1) % 4] += b;
    return { i, w, day: Math.floor(((g.dayCount % (S.LEN * 4)) % S.LEN)) + 1 };
  };
  S.index = (g) => (S.on(g) ? S.state(g).i : -1);
  S.label = function (g) {
    if (!S.on(g)) return '';
    const s = S.state(g);
    return S.ICONS[s.i] + ' ' + S.NAMES[s.i];
  };
  S.winter = (g) => S.on(g) && S.state(g).w[3] > 0.5;
  // Pousse des cultures selon la saison (l'hiver, une serre éclairée pousse normalement).
  S.growth = function (g, x, y, z) {
    if (!S.on(g) || g.dim !== 'overworld') return 1;
    const w = S.state(g).w;
    const f = w[0] * 1.5 + w[1] + w[2] * 0.8 + w[3] * 0.35;
    if (w[3] > 0.5 && g.world.blockLightAt(x, y, z) >= 9) return 1;
    return f;
  };

  // l'hiver, il neige aussi dans les biomes tempérés
  const cold0 = CM.Weather.cold;
  CM.Weather.cold = function (g, x, z) {
    if (cold0(g, x, z)) return true;
    if (!S.winter(g) || g.world.nether || g.world.end) return false;
    sets();
    return TEMPERATE.has(g.world.column(Math.floor(x), Math.floor(z)).bi);
  };

  // ---------------------------------------------------- neige (hôte) --
  // L'hiver, par temps de neige, elle recouvre le sol autour des joueurs ; au printemps, elle fond.
  S.tick = function (g, dt) {
    if (!S.on(g) || g.dim !== 'overworld') return;
    S.snowT -= dt;
    if (S.snowT > 0) return;
    S.snowT = 0.5;
    sets();
    const w = g.world, st = S.state(g), B = CM.B, H = CM.WORLD.H;
    const snowing = st.w[3] > 0.5 && g.weather && g.weather.type !== 'clear' && (g.wLevel || 0) > 0.5;
    const melting = st.w[3] < 0.2;
    if (!snowing && !melting) return;
    for (const q of g.entities.plist) {
      if (q.alive === false) continue;
      for (let k = 0; k < (snowing ? 8 : 12); k++) {
        const x = Math.floor(q.x + (Math.random() - 0.5) * 56), z = Math.floor(q.z + (Math.random() - 0.5) * 56);
        if (!w.loaded(x, z)) continue;
        const bi = w.column(x, z).bi;
        if (!TEMPERATE.has(bi)) continue;
        const y = w.groundBelow(x, H - 1, z);
        if (y <= CM.WORLD.MINY) continue;
        const id = w.get(x, y, z), b = CM.blocks[id];
        if (snowing) {
          const up = w.get(x, y + 1, z);
          if (up !== 0 && !(CM.blocks[up].plant && CM.blocks[up].replaceable)) continue;
          if (!b.solid || b.render !== 'cube' || CM.isFluid(id) || w.skyAt(x, y + 1, z) < 15) continue;
          w.setBlock(x, y + 1, z, B.SNOW_LAYER);
        } else if (melting) {
          // (groundBelow saute les tapis : on regarde juste au-dessus)
          const up = w.get(x, y + 1, z);
          if (up === B.SNOW_LAYER && w.skyAt(x, y + 1, z) >= 14) w.setBlock(x, y + 1, z, 0);
          else if (id === B.SNOW_LAYER) w.setBlock(x, y, z, 0);
        }
      }
    }
  };

  // ------------------------------------------------ ciel (chaque écran) --
  // Teinte des feuillages, aurores boréales, étoiles filantes : pour le rendu.
  S.env = function (g, env, dt) {
    const w = g.world, p = g.player;
    const on = S.on(g) && !w.nether && !w.end;
    const st = on ? S.state(g) : null;
    env.season = st ? [st.w[0], st.w[2], st.w[3]] : [0, 0, 0];
    // aurores : biomes froids ; l'hiver partout (plus pâles)
    sets();
    let want = 0;
    if (!w.nether && !w.end && env.night > 0.5 && !(env.rain > 0.3)) {
      const bi = w.column(Math.floor(p.x), Math.floor(p.z)).bi;
      want = COLD.has(bi) ? 1 : st ? st.w[3] * 0.75 : 0;
      want *= CM.smoothstep(0.5, 0.9, env.night);
    }
    S.aurora += (want - S.aurora) * Math.min(1, dt * 0.5);
    env.aurora = S.aurora;
    // étoiles filantes (plus nombreuses l'été)
    env.meteor = null;
    if (!w.nether && !w.end && env.night > 0.7 && !(env.rain > 0.3)) {
      if (S.meteor) {
        S.meteor.t += dt / S.meteor.len;
        if (S.meteor.t >= 1) S.meteor = null;
      } else {
        S.meteorT -= dt * (st ? 1 + st.w[1] * 3 : 1);
        if (S.meteorT <= 0) {
          S.meteorT = 8 + Math.random() * 30;
          const az = Math.random() * TAU, el = 0.35 + Math.random() * 0.6, da = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4);
          const dir = (a, e) => [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
          S.meteor = { a: dir(az, el), b: dir(az + da, el - 0.12 - Math.random() * 0.25), t: 0, len: 0.7 + Math.random() * 0.6 };
          g.stats.meteors = (g.stats.meteors || 0) + 1;
        }
      }
      if (S.meteor) env.meteor = S.meteor;
    } else S.meteor = null;
  };

  // ----------------------------------------------------------- succès --
  if (CM.Comfort && CM.Comfort.ACH) {
    const A = CM.Comfort.ACH, at = A.findIndex((a) => a.k === 'aube');
    A.splice(at < 0 ? A.length : at, 0,
      { k: 'etoile', icon: '🌠', name: 'Fais un vœu', desc: 'Voir une étoile filante', test: (g) => (g.stats.meteors || 0) > 0 },
      { k: 'saisons', icon: '🍂', name: 'Une année passe', desc: 'Vivre les quatre saisons', test: (g) => S.on(g) && g.dayCount >= S.LEN * 3 + 1 },
    );
  }
})();
