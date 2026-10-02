'use strict';
// Menu du joueur (G) : onglets Terrain, Équipe, Argent, Classements, Gestes et Compte
// (les règles et les données sont dans social.js ; ici, seulement l'affichage et les boutons).
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const q = (s) => '"' + String(s).replace(/"/g, '') + '"';
  const low = (s) => String(s || '').toLowerCase();
  const put = (id, html) => {
    const el = $(id);
    if (el._h !== html) el.innerHTML = el._h = html;
  };
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const icon = (id) => '<i class="ic" style="background-image:url(' + CM.Textures.icons[id] + ')"></i>';
  const COIN = '🪙';
  const DIMS = ['', ' · Nether', ' · End'];

  const U = {
    sub: 'shop',
    qty: 1,
    topCat: 'c',
    qT: 0,
    sure: null,

    // Onglet ouvert : on demande à l'hôte ce qui n'arrive pas tout seul.
    opened(g, tab) {
      this.sure = null;
      if (tab === 'top' || tab === 'argent' || tab === 'compte') this.query(g);
      if (tab === 'compte' && CM.Skins) CM.Skins.preview(g);
    },
    query(g) {
      this.qT = 5;
      if (g.net.active) CM.Social.req('q');
    },
    tick(g, dt, tab) {
      if (tab !== 'top' && tab !== 'argent') return;
      this.qT -= dt;
      if (this.qT <= 0) this.query(g);
    },
    render(g, tab) {
      if (tab === 'terrain') this.terrain(g);
      else if (tab === 'equipe') this.team(g);
      else if (tab === 'argent') this.money(g);
      else if (tab === 'top') this.top(g);
      else if (tab === 'gestes') this.gestures(g);
      else if (tab === 'compte') this.account(g);
    },
    online(g) {
      const n = g.net, set = new Set();
      if (n.active && !(n.isHost && CM.Dedicated.on)) set.add(low(n.name));
      for (const rp of n.remotes.values()) set.add(low(rp.name));
      return set;
    },

    // ------------------------------------------------------------ terrain --
    terrain(g) {
      const S = CM.Social, P = S.pub(), me = low(S.myName()), p = g.player, dim = g.playerDim;
      const k = S.ck(dim, p.x, p.z), o = P.claims[k], adm = S.amAdmin();
      const cx = Math.floor(p.x / 16), cz = Math.floor(p.z / 16);
      const mine = Object.keys(P.claims).filter((x) => P.claims[x] === me);
      const name = (x) => esc((P.names && P.names[x]) || x);
      const where = 'Tronçon <b>' + cx + ', ' + cz + '</b>';
      let h;
      if (!o) h = '<div class="tp-row"><span class="tp-name">📍 ' + where + ' : libre</span><button data-tp="claim" class="tp-go"' + (mine.length >= P.lim && !adm ? ' disabled' : '') + '>Protéger ce tronçon</button></div>';
      else if (o === me) h = '<div class="tp-row"><span class="tp-name">📍 ' + where + ' : <b>à toi</b></span><button data-tp="unclaim">Le rendre</button></div>';
      else h = '<div class="tp-row"><span class="tp-name">📍 ' + where + ' : terrain de <b>' + name(o) + '</b></span>' + (adm ? '<button data-tp="unclaim">Le rendre (admin)</button>' : '') + '</div>';
      put('ter-here', h);
      put('ter-count', '(' + mine.length + ' / ' + P.lim + ')');
      put('ter-list', mine.length
        ? mine
            .map((x) => {
              const d = +x[0], [a, b] = x.slice(2).split(',').map(Number);
              return '<div class="tp-row"><span class="tp-name"><b>' + a + ', ' + b + '</b> <i>blocs ' + a * 16 + '…' + (a * 16 + 15) + ' / ' + b * 16 + '…' + (b * 16 + 15) + (DIMS[d] || '') + '</i></span><button data-tp="unclaimk" data-k="' + esc(x) + '" title="Rendre">✕</button></div>';
            })
            .join('')
        : '<div class="tp-empty">Aucun terrain. Va là où tu construis et clique sur « Protéger ce tronçon ».</div>');
      const tr = P.trust[me] || [];
      put('ter-trust', tr.length ? tr.map((x) => '<div class="tp-row"><span class="tp-name"><b>' + name(x) + '</b></span><button data-tp="untrust" data-n="' + name(x) + '" title="Retirer">✕</button></div>').join('') : '<div class="tp-empty">Personne. (Ton équipe a déjà le droit.)</div>');
      this.claimMap(g);
      $('ter-bigmap').classList.toggle('hidden', g.net.code !== CM.SERVER_CODE);
    },
    // Petite carte : 9 × 9 tronçons autour du joueur, terrains en couleur.
    claimMap(g) {
      const cv = $('ter-map'), ctx = cv.getContext('2d'), S = CM.Social, P = S.pub(), p = g.player, dim = g.playerDim;
      const N = 9, B = 16, W = N * B; // 144 blocs de côté, 1 pixel par bloc
      if (cv.width !== W) cv.width = cv.height = W;
      const cx = Math.floor(p.x / B), cz = Math.floor(p.z / B), x0 = (cx - 4) * B, z0 = (cz - 4) * B;
      const img = ctx.createImageData(W, W), px = img.data;
      let budget = 3000; // (colonnes nouvelles à calculer à chaque fois : le reste suit)
      for (let j = 0; j < W; j++)
        for (let i = 0; i < W; i++) {
          let v = CM.Comfort.mapColor(g, x0 + i, z0 + j, false);
          if (!v && budget > 0) {
            budget--;
            v = CM.Comfort.mapColor(g, x0 + i, z0 + j, true);
          }
          const o = (j * W + i) * 4;
          px[o] = v ? v[0] : 18;
          px[o + 1] = v ? v[1] : 20;
          px[o + 2] = v ? v[2] : 26;
          px[o + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
      const me = low(S.myName()), team = S.teamOf(me);
      const d = CM.dimId(dim);
      for (let b = 0; b < N; b++)
        for (let a = 0; a < N; a++) {
          const o = P.claims[d + ':' + (cx - 4 + a) + ',' + (cz - 4 + b)];
          if (!o) continue;
          const fr = o === me ? 0 : (team && team.m.includes(o)) || (P.trust[o] || []).includes(me) ? 1 : 2;
          ctx.fillStyle = ['rgba(80,220,120,0.38)', 'rgba(90,170,255,0.38)', 'rgba(240,80,80,0.38)'][fr];
          ctx.fillRect(a * B, b * B, B, B);
          ctx.strokeStyle = ['rgba(80,220,120,0.9)', 'rgba(90,170,255,0.9)', 'rgba(240,80,80,0.9)'][fr];
          ctx.lineWidth = 1;
          ctx.strokeRect(a * B + 0.5, b * B + 0.5, B - 1, B - 1);
        }
      // tronçon où l'on est
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeRect(4 * B + 0.5, 4 * B + 0.5, B - 1, B - 1);
      // le joueur
      const ax = p.x - x0, az = p.z - z0, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(ax + fx * 6, az + fz * 6);
      ctx.lineTo(ax - fx * 4 - fz * 4, az - fz * 4 + fx * 4);
      ctx.lineTo(ax - fx * 4 + fz * 4, az - fz * 4 - fx * 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },

    // ------------------------------------------------------------- équipe --
    team(g) {
      const S = CM.Social, P = S.pub(), me = low(S.myName()), t = S.teamOf(me), on = this.online(g);
      const name = (x) => esc((P.names && P.names[x]) || x);
      show('eq-create', !t);
      show('eq-invite', !!t);
      if (!t) {
        const inv = Object.values(P.teams).filter((x) => (x.inv || []).includes(me));
        put('eq-info', inv.map((x) => '<div class="tp-row req"><span class="tp-name">📨 Invitation : <b>' + esc(x.n) + '</b> [' + esc(x.tag) + '] · ' + x.m.length + ' joueur' + (x.m.length > 1 ? 's' : '') + '</span><button data-tp="eqjoin" data-n="' + esc(x.n) + '" class="tp-ok">Rejoindre</button><button data-tp="eqno">Refuser</button></div>').join('') + '<div class="tp-empty">Tu n’as pas d’équipe. Crée la tienne (le TAG, 4 lettres au plus, s’affiche devant ton pseudo) :</div>');
        return;
      }
      const boss = t.o === me;
      let h = '<div class="eq-card"><span class="eq-tagb">[' + esc(t.tag) + ']</span> <b>' + esc(t.n) + '</b> · ' + t.m.length + ' / 12 joueurs</div>';
      h += t.m
        .map((x) => '<div class="tp-row"><span class="tp-name">' + (on.has(x) ? '🟢' : '⚪') + ' <b>' + name(x) + '</b>' + (x === t.o ? ' <i>chef</i>' : '') + (x === me ? ' <i>toi</i>' : '') + '</span>' + (boss && x !== me ? '<button data-tp="eqkick" data-n="' + name(x) + '">Exclure</button>' : '') + '</div>')
        .join('');
      if ((t.inv || []).length) h += '<div class="tp-empty">Invités (pas encore venus) : ' + t.inv.map(name).join(', ') + '</div>';
      const sure = this.sure === 'eqdis' || this.sure === 'eqleave';
      h += '<div class="tp-row"><span class="tp-name"></span>' + (boss ? '<button data-tp="eqdis">' + (this.sure === 'eqdis' ? 'Vraiment dissoudre ?' : 'Dissoudre l’équipe') + '</button>' : '') + '<button data-tp="eqleave">' + (this.sure === 'eqleave' ? 'Vraiment quitter ?' : 'Quitter l’équipe') + '</button></div>';
      if (!sure) this.sure = null;
      put('eq-info', h);
    },

    // ------------------------------------------------------------- argent --
    money(g) {
      const S = CM.Social, coins = S.coins(S.myName()), creative = g.mode === 'creative';
      put('ar-bal', COIN + ' <b>' + coins + '</b> pièce' + (coins > 1 ? 's' : '') + (creative ? ' <span class="tp-empty">(pas de boutique en mode créatif)</span>' : ''));
      for (const b of document.querySelectorAll('#pm-argent .pm-sub button')) b.classList.toggle('on', b.dataset.sub === this.sub);
      for (const b of document.querySelectorAll('#pm-argent .ar-qty button')) b.classList.toggle('on', +b.dataset.q === this.qty);
      show('ar-shop', this.sub === 'shop');
      show('ar-hdv', this.sub === 'hdv');
      show('ar-pay', this.sub === 'pay');
      if (this.sub === 'shop') {
        const f = CM.Commands.norm($('ar-search').value || '');
        const inv = g.inventory;
        put('ar-shop-list', S.shop()
          .filter((s) => !f || CM.Commands.norm(CM.itemName(s.id)).includes(f))
          .map((s) => {
            const have = inv.count(s.id), n = this.qty;
            const buy = s.buy ? '<button data-tp="buy" data-id="' + s.id + '" class="tp-go"' + (creative || coins < s.buy * n ? ' disabled' : '') + ' title="' + s.buy + ' ' + COIN + ' pièce">Acheter ' + s.buy * n + ' ' + COIN + '</button>' : '';
            const sell = s.sell ? '<button data-tp="sell" data-id="' + s.id + '"' + (creative || !have ? ' disabled' : '') + ' title="' + s.sell + ' ' + COIN + ' pièce">Vendre ' + s.sell * Math.min(n, have || n) + ' ' + COIN + '</button>' : '';
            return '<div class="tp-row">' + icon(s.id) + '<span class="tp-name">' + esc(CM.itemName(s.id)) + (have ? ' <i>(tu en as ' + have + ')</i>' : '') + '</span>' + buy + sell + '</div>';
          })
          .join('') || '<div class="tp-empty">Rien trouvé.</div>');
      } else if (this.sub === 'hdv') {
        const held = g.inventory.held();
        put('ar-held', held ? icon(held.id) + '<span>' + (held.count > 1 ? held.count + ' × ' : '') + esc(CM.itemName(held.id)) + '</span>' : '<span class="tp-empty">Prends en main l’objet à vendre</span>');
        const me = low(S.myName()), l = S.listingsOf();
        put('ar-hdv-list', l.length
          ? l
              .map((x) => {
                const mine = low(x.s) === me;
                const lab = (x.it.count > 1 ? x.it.count + ' × ' : '') + esc(CM.itemInfo(x.it.id) ? CM.itemName(x.it.id) : '?') + (x.it.ench ? ' ✨' : '');
                return '<div class="tp-row">' + (CM.itemInfo(x.it.id) ? icon(x.it.id) : '') + '<span class="tp-name">' + lab + ' <i>' + (mine ? 'à toi' : 'de ' + esc(x.s)) + '</i></span>' + (mine ? '<button data-tp="unlist" data-i="' + x.i + '">Retirer</button>' : '<button data-tp="hbuy" data-i="' + x.i + '" class="tp-go"' + (creative || coins < x.p ? ' disabled' : '') + '>Acheter ' + x.p + ' ' + COIN + '</button>') + '</div>';
              })
              .join('')
          : '<div class="tp-empty">Rien en vente pour l’instant. Mets en vente l’objet que tu tiens en main : les autres joueurs pourront l’acheter, même quand tu n’es pas là.</div>');
      }
    },

    // -------------------------------------------------------- classements --
    top(g) {
      const S = CM.Social;
      put('top-cats', S.TOPS.map(([f, t]) => '<button data-top="' + f + '"' + (f === this.topCat ? ' class="on"' : '') + '>' + t + '</button>').join(''));
      const tops = S.R && S.R.top;
      const def = S.TOPS.find((x) => x[0] === this.topCat);
      const l = (tops && tops[this.topCat]) || [];
      const me = low(S.myName());
      put('top-list', !tops ? '<div class="tp-empty">Chargement…</div>' : l.length ? l.map((r, i) => '<div class="top-row' + (low(r[0]) === me ? ' me' : '') + '"><b>' + (['🥇', '🥈', '🥉'][i] || i + 1 + '.') + '</b><span>' + esc(S.label(r[0])) + '</span>' + esc(def[2](r[1])) + '</div>').join('') : '<div class="tp-empty">Personne encore.</div>');
    },

    // -------------------------------------------------------------- gestes --
    gestures(g) {
      const E = CM.Emotes;
      put('ge-list', E ? E.LIST.map((e) => '<button data-tp="geste" data-n="' + e.k + '">' + e.icon + ' ' + esc(e.name) + '</button>').join('') : '');
    },

    // -------------------------------------------------------------- compte --
    account(g) {
      const S = CM.Social, n = g.net;
      let h;
      if (n.isClient) {
        const pw = S.me && S.me.pw;
        h = '<div class="tp-row"><span class="tp-name">🔐 Ton pseudo <b>' + esc(n.name) + '</b> est protégé : seul cet appareil peut l’utiliser sur ce serveur.</span></div>' +
          '<div class="tp-empty">' + (pw ? '🔑 Mot de passe choisi : tu peux jouer avec ce pseudo depuis un autre appareil (tape-le à la connexion). Tu peux le changer ici.' : 'Pour jouer avec ce pseudo depuis un autre appareil (téléphone, ordinateur…), choisis un mot de passe : il te sera demandé là-bas.') + '</div>';
      } else if (n.active) h = '<div class="tp-empty">Tu es l’hôte de la partie : ton pseudo est à toi. Les pseudos des invités sont protégés (un appareil chacun, ou leur mot de passe) ; « /liberer pseudo » en libère un.</div>';
      else h = '<div class="tp-empty">En solo, rien à protéger. Sur un serveur, ton pseudo sera réservé à cet appareil.</div>';
      put('ac-info', h);
      show('ac-pwbox', !!n.isClient);
    },

    // ------------------------------------------------------------ boutons --
    click(g, b) {
      const T = CM.Teleport, S = CM.Social, n = b.dataset.n;
      if (b.dataset.sub) {
        this.sub = b.dataset.sub;
        if (this.sub === 'hdv') this.query(g);
        T.render(g);
        return;
      }
      if (b.dataset.q) {
        this.qty = +b.dataset.q;
        T.render(g);
        return;
      }
      if (b.dataset.top) {
        this.topCat = b.dataset.top;
        T.render(g);
        return;
      }
      const act = b.dataset.tp;
      if (act !== 'eqdis' && act !== 'eqleave') this.sure = null;
      switch (act) {
        case 'claim':
          return T.run(g, '/terrain prendre');
        case 'unclaim':
          return T.run(g, '/terrain rendre');
        case 'unclaimk':
          return T.run(g, '/terrain rendre ' + b.dataset.k);
        case 'trust': {
          const v = $('ter-friend').value.trim();
          if (!v) return;
          $('ter-friend').value = '';
          return T.run(g, '/terrain ami ' + q(v));
        }
        case 'untrust':
          return T.run(g, '/terrain retirer ' + q(n));
        case 'eqcreate': {
          const nm = $('eq-name').value.trim(), tag = $('eq-tag').value.trim();
          if (!nm) return;
          T.run(g, '/equipe creer ' + q(nm) + (tag ? ' ' + q(tag) : ''));
          $('eq-name').value = $('eq-tag').value = '';
          return;
        }
        case 'eqinv': {
          const v = $('eq-who').value.trim();
          if (!v) return;
          $('eq-who').value = '';
          return T.run(g, '/equipe inviter ' + q(v));
        }
        case 'eqjoin':
          return T.run(g, '/equipe rejoindre ' + q(n));
        case 'eqno':
          return T.run(g, '/equipe refuser');
        case 'eqkick':
          return T.run(g, '/equipe exclure ' + q(n));
        case 'eqleave':
        case 'eqdis':
          // (deux appuis : on demande confirmation)
          if (this.sure !== act) {
            this.sure = act;
            T.render(g);
            return;
          }
          this.sure = null;
          return T.run(g, act === 'eqdis' ? '/equipe dissoudre' : '/equipe quitter');
        case 'buy':
          return S.req('buy', { id: +b.dataset.id, n: this.qty });
        case 'sell':
          return S.sell(g, +b.dataset.id, this.qty);
        case 'hlist': {
          S.listHeld(g, $('ar-price').value);
          T.render(g);
          return;
        }
        case 'hbuy':
          return S.req('hbuy', { i: +b.dataset.i });
        case 'unlist':
          return S.req('unlist', { i: +b.dataset.i });
        case 'pay': {
          const who = $('ar-pay-who').value.trim(), v = $('ar-pay-n').value;
          if (!who || !v) return;
          T.run(g, '/payer ' + q(who) + ' ' + Math.round(+v));
          $('ar-pay-n').value = '';
          return;
        }
        case 'setpw': {
          const v = $('ac-pw').value;
          if (v.length < 4) {
            T.onOut('Mot de passe : 4 caractères au moins', 'err');
            return;
          }
          $('ac-pw').value = '';
          return S.req('pw', { pw: v });
        }
        case 'geste':
          return T.run(g, '/geste ' + n);
        case 'skinoff':
          if (CM.Skins) CM.Skins.clear(g);
          return;
      }
    },
    input(g, el) {
      if (el.id === 'ar-search') CM.Teleport.render(g);
    },
    change(g, el) {
      if (el.id === 'ac-skin' && el.files && el.files[0] && CM.Skins) {
        CM.Skins.load(g, el.files[0]);
        el.value = '';
      }
    },

    // ---------------------------------------- coffre : propriétaire, verrou --
    chest(g) {
      const own = $('chest-owner'), btn = $('chest-lock');
      if (!own || !btn) return;
      const S = CM.Social, k = g.net.chestKey;
      const o = S.on() && k && k[0] !== 'C' ? S.pub().own[k] : null;
      $('chest-own').classList.toggle('hidden', !o);
      if (!o) return;
      const P = S.pub(), mine = o[0] === low(S.myName());
      own.textContent = mine ? (o[1] ? '🔓 Ton coffre, ouvert à tous' : '🔒 Ton coffre (toi, ton équipe, tes amis)') : (o[1] ? '🔓 Coffre public de ' : '🔒 Coffre de ') + ((P.names && P.names[o[0]]) || o[0]);
      btn.classList.toggle('hidden', !mine && !S.amAdmin());
      btn.textContent = o[1] ? '🔒 Verrouiller' : '🔓 Rendre public';
      btn.onclick = () => S.req('pub', { k, v: o[1] ? 0 : 1 });
    },
  };
  CM.SocialUI = U;
})();
