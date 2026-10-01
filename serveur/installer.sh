#!/usr/bin/env bash
# Installation (ou mise à jour) du serveur CraftMine sur Ubuntu 22.04 / 24.04, en root :
#
#   curl -fsSL https://craftmine16.vercel.app/serveur/installer.sh | bash
#
# Relancer la même commande met le serveur à jour : le monde et config.json sont gardés.
set -euo pipefail
SITE="${CRAFTMINE_SITE:-https://craftmine16.vercel.app}"
DIR=/opt/craftmine
export DEBIAN_FRONTEND=noninteractive

if [ "$(id -u)" != 0 ]; then
  echo "Lance ce script en root (connecte-toi avec : ssh root@TON_IP)"
  exit 1
fi
step() { echo; echo "=== $1"; }

step "1/7 Mise à jour du système (quelques minutes)"
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::=--force-confold
apt-get install -y curl ca-certificates nano

step "2/7 Node.js"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

step "3/7 Mémoire d'appoint (2 Go sur le disque)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | head -3

step "4/7 Fichiers du serveur"
id craftmine >/dev/null 2>&1 || useradd --system --create-home --home-dir "$DIR" --shell /usr/sbin/nologin craftmine
mkdir -p "$DIR"
for f in serveur.js package.json config.exemple.json; do
  curl -fsSL "$SITE/serveur/$f?t=$(date +%s)" -o "$DIR/$f"
done
NEWCFG=0
if [ ! -f "$DIR/config.json" ]; then
  PW=$(tr -dc 'a-z0-9' </dev/urandom | head -c 10 || true)
  sed "s/a-changer/$PW/" "$DIR/config.exemple.json" > "$DIR/config.json"
  NEWCFG=1
fi
chown -R craftmine:craftmine "$DIR"

step "5/7 Navigateur invisible (Chromium, environ 300 Mo)"
cd "$DIR"
sudo -u craftmine env HOME="$DIR" npm install --omit=dev --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH="$DIR/navigateurs" "$DIR/node_modules/.bin/playwright" install-deps chromium
sudo -u craftmine env HOME="$DIR" PLAYWRIGHT_BROWSERS_PATH="$DIR/navigateurs" "$DIR/node_modules/.bin/playwright" install chromium

step "6/7 Relais réseau (pour les joueurs en 4G)"
# En 4G, les opérateurs empêchent la connexion directe entre le téléphone et le serveur : le jeu passe
# alors par ce relais (coturn), joignable sur le port 443 (TCP) comme un site web. Il ne relaie que
# vers cette machine : il ne peut servir à rien d'autre.
apt-get install -y --no-install-recommends coturn
IP=$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}')
cat > /etc/turnserver.conf <<EOF
# Relais WebRTC du serveur CraftMine (écrit par installer.sh)
listening-port=443
alt-listening-port=3478
relay-ip=$IP
min-port=49160
max-port=49400
fingerprint
lt-cred-mech
user=craftmine:craftmine16-relais
realm=craftmine
no-cli
no-tls
no-dtls
no-multicast-peers
denied-peer-ip=0.0.0.0-255.255.255.255
denied-peer-ip=::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
allowed-peer-ip=$IP
log-file=syslog
simple-log
EOF
if [ -f /etc/default/coturn ]; then sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn; fi
# (port 443 : il faut le droit d'ouvrir un port réservé)
mkdir -p /etc/systemd/system/coturn.service.d
printf '[Service]\nAmbientCapabilities=CAP_NET_BIND_SERVICE\nCapabilityBoundingSet=CAP_NET_BIND_SERVICE\n' > /etc/systemd/system/coturn.service.d/craftmine.conf
systemctl daemon-reload
systemctl enable coturn >/dev/null 2>&1
systemctl restart coturn
sleep 1
if systemctl is-active coturn >/dev/null; then echo "Relais actif ($IP, ports 443 et 3478)"; else echo "⚠ Le relais n'a pas démarré (journalctl -u coturn)"; fi

step "7/7 Service (démarre tout seul, même après un redémarrage de la machine)"
cat > /etc/systemd/system/craftmine.service <<EOF
[Unit]
Description=Serveur CraftMine
After=network-online.target
Wants=network-online.target

[Service]
User=craftmine
WorkingDirectory=$DIR
Environment=HOME=$DIR
Environment=PLAYWRIGHT_BROWSERS_PATH=$DIR/navigateurs
ExecStart=/usr/bin/node $DIR/serveur.js
Restart=always
RestartSec=10
TimeoutStopSec=40
# (arrêt : d'abord serveur.js, qui sauvegarde le monde puis ferme le navigateur lui-même)
KillMode=mixed

[Install]
WantedBy=multi-user.target
EOF

cat > /usr/local/bin/craftmine <<'EOF'
#!/usr/bin/env bash
# Commandes du serveur CraftMine (tape « craftmine » pour la liste)
DIR=/opt/craftmine
case "${1:-aide}" in
  journal) journalctl -u craftmine -f -n 60 -o cat ;;
  etat) systemctl is-active craftmine; cat "$DIR/etat.json" 2>/dev/null; echo ;;
  cmd) shift; [ -n "$*" ] && echo "$*" >> "$DIR/commandes.txt" && chown craftmine:craftmine "$DIR/commandes.txt" && echo "Envoyé : $*  (réponse : craftmine journal)" ;;
  redemarrer) systemctl restart craftmine && echo "Serveur redémarré" ;;
  arreter) systemctl stop craftmine && echo "Serveur arrêté" ;;
  demarrer) systemctl start craftmine && echo "Serveur démarré" ;;
  config) nano "$DIR/config.json" && systemctl restart craftmine && echo "Réglages enregistrés, serveur redémarré" ;;
  motdepasse) grep motDePasseAdmin "$DIR/config.json" ;;
  sauvegardes) ls -lh "$DIR/sauvegardes" 2>/dev/null || echo "Pas encore de sauvegarde" ;;
  nouveau-monde)
    read -r -p "Remplacer le monde par un nouveau ? (l'ancien est gardé dans sauvegardes/) [oui/non] " r
    if [ "$r" = "oui" ]; then
      systemctl stop craftmine
      mkdir -p "$DIR/sauvegardes"
      [ -f "$DIR/monde.json" ] && mv "$DIR/monde.json" "$DIR/sauvegardes/ancien-monde-$(date +%F_%H-%M).json"
      chown -R craftmine:craftmine "$DIR/sauvegardes"
      systemctl start craftmine && echo "Nouveau monde en préparation (craftmine journal pour suivre)"
    fi ;;
  mettre-a-jour) curl -fsSL https://craftmine16.vercel.app/serveur/installer.sh | bash ;;
  *)
    echo "Commandes du serveur CraftMine :"
    echo "  craftmine journal        voir ce qui se passe (Ctrl+C pour quitter)"
    echo "  craftmine etat           en marche ? joueurs connectés"
    echo "  craftmine cmd /annonce Salut !   commande dans le jeu (/bannir, /temps midi, …)"
    echo "  craftmine config         changer les réglages (nom, mode, mot de passe…)"
    echo "  craftmine motdepasse     mot de passe administrateur (/admin dans le jeu)"
    echo "  craftmine redemarrer | arreter | demarrer"
    echo "  craftmine sauvegardes    copies du monde (une par heure)"
    echo "  craftmine nouveau-monde  recommencer avec un nouveau monde"
    echo "  craftmine mettre-a-jour  mettre à jour le serveur" ;;
esac
EOF
chmod +x /usr/local/bin/craftmine

systemctl daemon-reload
systemctl enable craftmine >/dev/null 2>&1
systemctl restart craftmine

echo
echo "======================================================="
echo " ✅ Serveur CraftMine installé et lancé !"
echo "    Dans le jeu : bouton « Serveur » du menu principal."
if [ "$NEWCFG" = 1 ]; then
  echo "    Mot de passe administrateur : $PW"
  echo "    (dans le jeu, tape : /admin $PW)"
fi
echo "    Suivre le démarrage : craftmine journal"
echo "    Toutes les commandes : craftmine"
echo "======================================================="
