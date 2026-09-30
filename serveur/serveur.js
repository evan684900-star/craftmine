'use strict';
// Serveur CraftMine : fait tourner le jeu (sans image ni son) dans un navigateur invisible,
// comme hôte permanent de la partie « SERVEUR ». Les joueurs le rejoignent avec le bouton
// « Serveur » du menu. Le monde est enregistré dans monde.json (+ copies dans sauvegardes/).
//
//   node serveur.js            lance le serveur (fait par le service craftmine)
//   node serveur.js cmd "…"    envoie une commande au serveur en marche (/annonce, /bannir…)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const CFG_FILE = path.join(DIR, 'config.json');
const SAVE = path.join(DIR, 'monde.json');
const BACKUPS = path.join(DIR, 'sauvegardes');
const INBOX = path.join(DIR, 'commandes.txt');
const STATUS = path.join(DIR, 'etat.json');

const stamp = () => new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
const log = (s) => console.log(new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) + '  ' + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------ « node serveur.js cmd … »
if (process.argv[2] === 'cmd') {
  const line = process.argv.slice(3).join(' ').trim();
  if (!line) {
    console.log('Exemple : node serveur.js cmd "/annonce Bonjour à tous !"');
    process.exit(1);
  }
  fs.appendFileSync(INBOX, line + '\n');
  console.log('Commande envoyée : ' + line + '  (réponse dans le journal : craftmine journal)');
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
const SITE = String(cfg.site || 'https://craftmine16.vercel.app').replace(/\/+$/, '');
const { chromium } = require('playwright');

let browser = null, page = null, lastBackup = 0, stopping = false, version = null, okSince = Date.now();

// Écriture sûre : fichier temporaire puis renommage (jamais de monde.json à moitié écrit).
function writeSave(json) {
  if (typeof json !== 'string' || json.length < 20 || json[0] !== '{') return;
  const tmp = SAVE + '.tmp';
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, SAVE);
  // une copie par heure, les 72 dernières gardées (3 jours)
  if (Date.now() - lastBackup > 3600e3) {
    lastBackup = Date.now();
    fs.mkdirSync(BACKUPS, { recursive: true });
    fs.copyFileSync(SAVE, path.join(BACKUPS, 'monde-' + stamp() + '.json'));
    const list = fs.readdirSync(BACKUPS).filter((f) => f.startsWith('monde-')).sort();
    while (list.length > 72) fs.unlinkSync(path.join(BACKUPS, list.shift()));
  }
}

// Empreinte du jeu en ligne : quand elle change (mise à jour de CraftMine), le serveur redémarre.
async function onlineVersion() {
  const h = crypto.createHash('sha1');
  for (const f of ['index.html', 'js/net.js', 'js/main.js', 'js/dedicated.js']) {
    const r = await fetch(SITE + '/' + f + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(f + ' : ' + r.status);
    h.update(await r.text());
  }
  return h.digest('hex');
}

async function start() {
  log('🚀 Démarrage du serveur CraftMine (' + SITE + ')');
  try {
    version = await onlineVersion();
  } catch (e) {
    log('⚠ Site injoignable (' + e.message + '), nouvel essai dans 30 s');
    await sleep(30000);
    return process.exit(1);
  }
  browser = await chromium.launch({
    // (c'est nous qui fermons le navigateur, après la dernière sauvegarde)
    handleSIGTERM: false, handleSIGINT: false, handleSIGHUP: false,
    args: [
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--mute-audio', '--disable-dev-shm-usage',
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
  page = await ctx.newPage();
  const pub = Object.assign({}, cfg);
  delete pub.site;
  delete pub.peerserver;
  await page.exposeFunction('cmServerConfig', () => pub);
  await page.exposeFunction('cmServerLoad', () => (fs.existsSync(SAVE) ? fs.readFileSync(SAVE, 'utf8') : null));
  await page.exposeFunction('cmServerSave', (json) => {
    try {
      writeSave(json);
    } catch (e) {
      log('⚠ Écriture de la sauvegarde impossible : ' + e.message);
    }
  });
  await page.exposeFunction('cmServerLog', (s) => log(s));
  page.on('pageerror', (e) => log('⚠ ' + e.message));
  page.on('crash', () => {
    log('💥 Le jeu a planté : redémarrage');
    process.exit(1);
  });
  // (peerserver : serveur de mise en relation local, pour les essais)
  await page.goto(SITE + '/?server=1&t=' + Date.now() + (cfg.peerserver ? '&peerserver=' + cfg.peerserver : ''), { waitUntil: 'load', timeout: 180000 });
  setInterval(tick, 5000);
  setInterval(checkUpdate, 10 * 60e3);
}

// Toutes les 5 s : commandes tapées sur la machine, état du serveur.
let tickBusy = false, lastStatus = '', fails = 0;
async function tick() {
  if (tickBusy || stopping) return;
  tickBusy = true;
  try {
    if (fs.existsSync(INBOX)) {
      const lines = fs.readFileSync(INBOX, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
      fs.unlinkSync(INBOX);
      for (const l of lines) {
        log('⌨ ' + l);
        await page.evaluate((l) => CM.Dedicated.run(l), l);
      }
    }
    const st = await Promise.race([page.evaluate(() => CM.Dedicated.status()), sleep(20000).then(() => null)]);
    if (!st) throw new Error('le jeu ne répond plus');
    if (st.ok) okSince = Date.now();
    else if (Date.now() - okSince > 5 * 60e3) throw new Error('serveur fermé depuis 5 minutes');
    const txt = JSON.stringify(st);
    if (txt !== lastStatus) {
      lastStatus = txt;
      fs.writeFileSync(STATUS, JSON.stringify(Object.assign({ maj: new Date().toISOString() }, st), null, 1));
    }
    fails = 0;
  } catch (e) {
    // (trois échecs de suite : le jeu est bloqué, on relance tout)
    if (++fails >= 3 || /5 minutes|répond plus/.test(e.message)) {
      log('💥 ' + e.message + ' : redémarrage');
      await stop(1);
    }
  }
  tickBusy = false;
}

// Nouvelle version de CraftMine en ligne : on prévient, on sauvegarde et on redémarre.
async function checkUpdate() {
  if (stopping) return;
  let v;
  try {
    v = await onlineVersion();
  } catch (e) {
    return;
  }
  if (v === version) return;
  log('🔄 Nouvelle version de CraftMine : redémarrage dans 30 s');
  await page.evaluate(() => CM.game.net.sysAll('🔄 Mise à jour de CraftMine : le serveur redémarre dans 30 secondes. Recharge la page puis reviens !')).catch(() => {});
  await sleep(30000);
  await stop(0);
}

async function stop(code) {
  if (stopping) return;
  stopping = true;
  try {
    await Promise.race([page.evaluate(() => CM.Dedicated.shutdown(CM.game)), sleep(20000)]);
    log('💾 Monde sauvegardé');
  } catch (e) {
    log('⚠ Sauvegarde finale impossible : ' + e.message);
  }
  try {
    await Promise.race([browser.close(), sleep(5000)]);
  } catch (e) {
    /* ignore */
  }
  process.exit(code);
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));

start().catch((e) => {
  log('💥 Démarrage impossible : ' + e.message);
  process.exit(1);
});
