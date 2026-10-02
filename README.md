# CraftMine — L'Aube des Éclats

Un jeu de type **Minecraft en 3D** qui tourne directement dans le navigateur. Le principe reste le même : un monde en cubes à miner, des ressources à récolter, des outils à fabriquer, la faim à gérer et des nuits dangereuses. Certaines mécaniques changent : grappin, ruée, combos de minage, outils qui progressent, Ombres qui craignent la lumière, îles célestes…

Aucune image ni aucun son externe : le moteur WebGL2, les textures pixel-art (plus de 600) et les effets sonores sont générés par le code. Seul le multijoueur utilise une bibliothèque, PeerJS (fournie dans `js/vendor/`, chargée seulement quand on joue à plusieurs).

## Lancer le jeu

- **Le plus simple** : ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari 15+).
- Ou via un petit serveur local :
  ```bash
  npx serve .        # puis ouvrir l'adresse affichée
  # ou
  python3 -m http.server 8000
  ```

Sur ordinateur, il faut un clavier et une souris (le jeu utilise le verrouillage du pointeur). Sur **téléphone ou tablette**, des contrôles tactiles s'affichent automatiquement (voir plus bas). La partie est sauvegardée automatiquement dans le navigateur (localStorage).

### Nouveau monde

Le bouton **Nouveau monde** ouvre un écran de création :

| Réglage | Choix |
| --- | --- |
| Graine | vide = vraiment aléatoire ; un nombre ou un texte donne toujours le même monde |
| Mode de jeu | Survie ou **Créatif** (blocs infinis, vol, pas de dégâts) |
| Difficulté | Paisible (ni Ombres ni faim), Facile, Normale, Difficile |
| Type de monde | Normal, Amplifié (reliefs géants), Plat, Archipel (beaucoup d'océan), **Ville** (rues, immeubles, gratte-ciel) |
| Taille des biomes | Petits, Normaux, Grands |
| Coffre de départ, cycle jour/nuit | activables |

La graine du monde est affichée dans le menu pause et avec **F3**.

### Changer d'appareil

La partie est enregistrée dans le navigateur. Pour la transférer :

1. **Exporter la sauvegarde** (menu principal ou menu pause) télécharge un fichier `.zip` (par exemple `craftmine-sauvegarde-jour5-2026-09-23.zip`).
2. Copie ce fichier sur l'autre appareil (clé USB, e-mail, cloud…).
3. Sur l'autre appareil, ouvre le jeu et clique sur **Importer une sauvegarde** dans le menu principal, choisis le `.zip`, puis **Continuer**.

Les sauvegardes des versions précédentes restent compatibles : leur paysage est généré avec l'ancien générateur, pour que les constructions ne soient pas déplacées.

## Commandes

Toutes les touches se changent dans **Options > Contrôles**.

| Touche | Action |
| --- | --- |
| **ZQSD / WASD** | Se déplacer. Les touches suivent leur place sur le clavier, et le jeu reconnaît tout seul un clavier AZERTY ou QWERTY : les noms affichés (aide, Options › Contrôles) sont ceux de ton clavier, et en AZERTY la carte est sur **M**. Choix forcé : Options › Contrôles › Clavier |
| **Espace** | Sauter, nager, double saut (avec l'amulette), monter en vol (créatif, double appui pour voler) |
| **Maj** | Courir |
| **C** | S'accroupir (on ne tombe pas du bord) / descendre en vol |
| **F** | Ruée : une accélération fulgurante, brièvement invulnérable |
| **Clic gauche** (maintenu) | Miner / frapper |
| **Clic droit** | Poser un bloc, ouvrir la table d'enchantement ou l'enclume, allumer un feu (briquet), enfiler une armure, manger (maintenir 1 s), utiliser un outil (écorcer, labourer), semer, nourrir un animal, lancer le grappin, ouvrir un coffre |
| **Clic molette** | Prendre le bloc visé |
| **E** | Inventaire, fabrication, inventaire créatif, journal, aide |
| **1–9 / molette** | Choisir l'objet en main |
| **A** en AZERTY (**Q** en QWERTY) | Jeter l'objet en main (avec Ctrl : toute la pile) |
| **Échap** | Pause |
| **F1 … F11** | Touches de fonction (voir ci-dessous) |
| **P** | **Plein écran** (aussi : bouton « ⛶ Plein écran » du menu principal et du menu Pause, bouton ⛶ sur téléphone ; option « Plein écran automatique » dans Options > Interface) |
| **V** · **R** · **H** | Vue de derrière · recharger (arme à feu) · klaxon, sirène (véhicule) |

### Touches F

| Touche | Action |
| --- | --- |
| **F1** | Masquer l'interface et la main (pour les belles images) |
| **F2** | Capture d'écran : l'image PNG est téléchargée |
| **F3** | Informations de débogage. En maintenant F3 : **A** recharger l'affichage du monde · **B** boîtes de collision des créatures · **C** copier ta position (commande /tp) · **D** effacer le tchat · **G** bordures des tronçons (16 × 16) · **H** infobulles avancées (identifiant, durabilité) · **Q** la liste |
| **F4** | Deux appuis : survie ⇄ créatif (si les triches sont permises) |
| **F5** | Vue à la 1re personne → de derrière → de face |
| **F6** | Filmer une vidéo avec le son (F6 pour arrêter, 5 minutes au plus) |
| **F7** | Croix là où les monstres peuvent apparaître : rouges tout le temps, jaunes la nuit |
| **F8** | Caméra cinématique (mouvements de souris adoucis) |
| **F9** | Sauvegarde rapide |
| **F10** | Zoom ×4 |
| **F11** | Plein écran |

### Sur téléphone ou tablette

Tiens l'appareil en **mode paysage** (un message le rappelle en mode portrait).

| Geste / bouton | Action |
| --- | --- |
| Pouce en bas à gauche de l'écran | Joystick : il apparaît sous le doigt, plus on pousse plus on va vite |
| Glisser ailleurs | Regarder autour |
| Toucher un bloc | Poser un bloc contre lui, l'utiliser (coffre, établi…), manger (le repas continue tout seul pendant 1 s), ou frapper la créature touchée |
| Garder le doigt appuyé sur un bloc | Le casser (on peut glisser pour tourner la caméra sans lâcher) |
| ⤒ / ⤓ | Sauter (deux fois pour voler en créatif) / s'accroupir ou descendre en vol |
| » / ⚡ | Courir (bascule) / ruée |
| ✋ | Poser ou utiliser au centre de l'écran |
| 🎒 · 🗑 · ⏸ | Inventaire · jeter l'objet en main · pause |
| Barre rapide | Toucher une case pour la choisir |

Dans l'inventaire, les boutons **Rapide** (comme Maj+clic) et **Moitié** (comme le clic droit) remplacent les raccourcis de la souris. Au premier lancement sur téléphone, le jeu choisit des réglages plus légers (distance d'affichage 5, résolution 75 %) et active le saut automatique. **Options > Contrôles** permet de forcer ou désactiver les contrôles tactiles, de régler leur sensibilité et la taille des boutons, et de choisir la visée : *au doigt* (par défaut, on agit sur le bloc touché) ou *au centre de l'écran* (réticule). **Disposer les boutons tactiles…** ouvre un éditeur : on fait glisser chaque bouton où on veut, on règle sa taille (50 à 200 %) et son opacité, on peut le masquer, et un curseur règle l'opacité de tous les boutons. La disposition est gardée dans le navigateur. Sur iPhone, *Partager > Sur l'écran d'accueil* ouvre le jeu en plein écran.

### Serveur CraftMine (bouton « Serveur »)

Un monde ouvert **24 h/24** sur une machine louée : bouton **🖥️ Serveur** du menu principal, un pseudo, **Rejoindre**. Pas de code à taper, et chacun retrouve ses constructions et son inventaire à chaque visite (garde le même pseudo). Jusqu'à 10 joueurs (réglable jusqu'à 20).

- Le jeu tourne sur la machine sans image ni son (navigateur invisible) et sert d'hôte permanent. Son joueur à lui est invisible et ne compte pas. Le monde est enregistré sur le disque chaque minute et à l'arrêt, avec une copie par heure.
- **`/admin <mot de passe>`** : triches et commandes de l'hôte. **`/expulser`**, **`/bannir`**, **`/debannir`** pour la modération (aussi dans une partie entre amis, pour l'hôte).
- **Pause → 🛡 Administration** (ou `/panel`) : le panneau d'administration, pour l'hôte et les administrateurs (sur le serveur, on s'y connecte avec le mot de passe). Joueurs connectés (aller vers eux, les faire venir, les nommer administrateurs, les expulser, les bannir), bannis, pseudos protégés à libérer, nombre de tronçons protégés par joueur, réglages (nom, mode, difficulté, nombre de joueurs, PvP, garder l'inventaire, triches, extensions : sur le serveur, ils sont écrits dans `config.json` de la machine), heure, météo, annonce, sauvegarde et redémarrage du serveur, copies du monde (en faire une, revenir à une copie), sans passer par la machine. En commande : `/serveur`, `/nommeradmin`, `/retireradmin`.
- Installation en une commande et commandes de la machine (`craftmine journal`, `craftmine config`…) : voir [serveur/LISEZMOI.md](serveur/LISEZMOI.md).

### Multijoueur (gratuit, sans serveur)

Jusqu'à 8 joueurs dans le même monde, sur ordinateur comme sur téléphone.

1. **L'hôte** lance son monde (Nouveau monde ou Continuer), ouvre le menu **Pause** et clique sur **« Ouvrir aux amis »**. Il choisit un pseudo, autorise ou non les combats entre joueurs, et reçoit un **code de 5 caractères** (bouton pour partager le lien d'invitation `…/?join=CODE`).
2. **Les invités** cliquent sur **Multijoueur** dans le menu principal, choisissent un pseudo et tapent le code.

| Touche | Action |
| --- | --- |
| **T**, **Entrée** ou **/** (💬 sur téléphone) | Tchat et commandes |
| **Tab** (maintenue) | Joueurs connectés, en haut de l'écran (sur téléphone : toucher « 🌐 CODE · N joueurs ») |
| **G** | Menu du joueur (aussi dans Pause), en onglets : Téléportation, Terrain, Équipe, Argent, Classements, Compte (voir ci-dessous). Rien de plus ne reste affiché pendant le jeu |

- Les navigateurs se connectent **directement entre eux** (WebRTC). Le serveur public et gratuit de [PeerJS](https://peerjs.com) sert seulement à les mettre en relation ; aucun compte, aucun serveur à payer.
- **L'hôte fait autorité** : il garde le monde, les créatures, les objets au sol, les coffres, l'heure et les réglages (mode de jeu, difficulté, durée des journées, « garder l'inventaire »). Chaque invité gère ses déplacements, son inventaire, sa faim et sa santé.
- Les autres joueurs sont visibles avec leur pseudo au-dessus de la tête et **l'objet qu'ils tiennent en main**. Les coffres sont partagés (un seul joueur à la fois), les blocs posés et cassés, les explosions et les créatures sont vus par tous.
- **Sauvegarde** : la progression de chaque invité (position, inventaire, statistiques) est rangée dans la sauvegarde de l'hôte, sous son pseudo, et retrouvée quand il revient. La partie solo de l'invité sur son propre appareil n'est pas touchée.
- **Limites** : la partie n'existe que tant que l'hôte a le jeu ouvert et au premier plan (sur téléphone, verrouiller l'écran met la partie en pause pour tout le monde). Certains réseaux très fermés (Wi-Fi d'école ou d'entreprise) peuvent bloquer la connexion directe ; PeerJS fournit un relais de secours, sinon essaie un autre réseau (la 4G par exemple).

### 🧭 Menu du joueur (touche G) : vie du serveur

Tout se règle dans ce menu (ou par les commandes) ; l'hôte garde tout dans la sauvegarde du monde.

- **🌀 Téléportation** : tes maisons (définir, y aller, supprimer) et les demandes aux autres joueurs (aller chez lui, l'inviter ici, accepter, refuser). Impossible pendant un combat : il faut 10 s sans donner ni recevoir de coup.
- **👤 Compte — pseudo protégé** : un pseudo appartient au premier appareil qui l'utilise sur la partie (le navigateur garde une clé secrète). Pour jouer avec depuis un autre appareil, choisis un **mot de passe** dans cet onglet : l'autre appareil le demandera à la connexion. Changé d'appareil sans mot de passe ? Un administrateur **libère** le pseudo (panneau d'administration, ou `/liberer pseudo`) : on garde ses pièces et ses terrains. Les droits d'administrateur sont gardés d'une connexion à l'autre.
- **🏡 Terrain** : protège le **tronçon** où tu es (carré de 16 × 16 blocs, du fond jusqu'au ciel ; 16 par joueur, réglable par l'administrateur). Sur tes tronçons, seuls toi, ton équipe et tes **amis autorisés** cassent, posent, ouvrent les portes et les coffres, utilisent les animaux ; les explosions ne les abîment pas. Petite carte des terrains autour de toi. `/terrain prendre | rendre | ami <joueur> | retirer <joueur> | liste`.
- **🔒 Coffres verrouillés** : un coffre (tonneau, four…) appartient à celui qui l'a posé ; seuls lui, son équipe et ses amis l'ouvrent ou le cassent. Bouton dans le coffre (ou `/coffre public`) pour l'ouvrir à tous.
- **🛡 Équipe** : crée-la (nom et TAG de 4 lettres), invite, rejoins, quitte, exclus (le chef). Le **[TAG]** s'affiche devant le pseudo, **pas de dégâts entre coéquipiers**, vous construisez sur les terrains les uns des autres. Tchat d'équipe : **`/e message`**.
- **🪙 Argent** : des **pièces** pour chaque créature hostile vaincue. **Boutique** du serveur (acheter, revendre ×1, ×16, ×64), **hôtel des ventes** (mets en vente l'objet que tu tiens, à ton prix ; on te paie même si tu n'es pas là), **payer** un joueur (`/payer joueur montant`). Pas d'argent en mode créatif. Administrateur : `/donnerpieces joueur montant`.
- **🏆 Classements** : les plus riches, créatures vaincues, joueurs vaincus, blocs posés et cassés, temps de jeu (aussi `/classement`).

### 💬 Commandes du tchat

Plus de 80 commandes, **en solo comme en multijoueur** : ouvre le tchat (**T**, **Entrée**, **/** ou 💬 sur téléphone) et tape `/`. Des suggestions s'affichent pendant la frappe (commandes, puis objets, joueurs, créatures, enchantements, biomes…) ; **Tab** complète, **↑ / ↓** reprend les commandes précédentes. `/aide` donne la liste, `/aide <catégorie>` ou `/aide <commande>` le détail.

- Objets et blocs par leur **nom français** (espaces → `_` : `lingot_de_fer`, `épée_en_diamant`, accents facultatifs) ou anglais (`diamond`, `torch`).
- Coordonnées **relatives** avec `~` : `/tp ~ ~20 ~`, `/remplir ~-3 ~ ~-3 ~3 ~4 ~3 verre creux`. Sans coordonnées, les constructions se font sur le **bloc visé** (jusqu'à 120 blocs).
- Joueurs : un pseudo (le début suffit), `moi`, ou `@a` / `tous` pour tout le monde.
- ✦ = **triche**. En solo tout est permis. En multijoueur, l'hôte a tout ; les invités ont les commandes d'information et de discussion, et les triches seulement si l'hôte tape `/triche on`. Ce qui touche au monde s'exécute chez l'hôte, ce qui touche un joueur chez ce joueur.

| Catégorie | Commandes |
| --- | --- |
| **Infos** | `/aide [commande / catégorie]` liste des commandes, ou le détail de l’une d’elles · `/coords` ta position, ta direction, le biome et la dimension · `/graine` la graine du monde · `/biome` le biome où tu te trouves · `/heure` le jour et l’heure du monde · `/liste` les joueurs connectés · `/stats` tes statistiques de partie · `/version` version du jeu et extensions actives · `/localiser <village / biome>` direction et distance du village ou du biome le plus proche ✦ · `/calcul <expression>` calculatrice (+ − × ÷ ^ %, parenthèses, sqrt, pi…) |
| **Tchat** | `/msg <joueur> <message>` message privé à un joueur · `/moi <action>` raconte ce que tu fais (« * Bob danse ») · `/annonce <message>` grande annonce à l’écran de tous ✦ · `/effacer` efface le tchat de ton écran |
| **Amusant** | `/de [faces]` lance un dé (6 faces par défaut), résultat pour tout le monde · `/pileouface` pile ou face, pour tout le monde · `/enflammer [joueur / @a] [secondes]` met le feu à un joueur (l’eau l’éteint) ✦ · `/propulser [joueur / @a] [force]` envoie un joueur en l’air ✦ |
| **Joueur** | `/donner <objet> [nombre] [joueur]` donne un objet (nom français ou anglais : diamant, lingot_de_fer, torch…) ✦ · `/kit <depart / outils / armure / netherite / nourriture / construction / redstone / electricite> [joueur]` un lot d’objets tout prêt ✦ · `/soigner [joueur / @a]` rend toute la vie, éteint le feu ✦ · `/nourrir [joueur / @a]` remplit la barre de faim ✦ · `/guerir [joueur / @a]` vie + faim au maximum ✦ · `/vider [joueur / @a] [tout]` vide l’inventaire (« tout » : armure et main secondaire aussi) ✦ · `/invincible [on / off] [joueur / @a]` plus aucun dégât (sauf le vide) ✦ · `/vision [on / off] [joueur / @a]` on voit clair la nuit et dans les grottes ✦ · `/xp <nombre>[L] [joueur / @a]` donne de l’expérience (points, ou niveaux avec L : /xp 10L) ✦ · `/niveau <niveau> [joueur / @a]` fixe ton niveau d’expérience ✦ · `/reparer [tout] [joueur]` répare l’objet en main (armure, bouclier) ou recharge un outil électrique ; « tout » : tout l’inventaire ✦ · `/enchanter <enchantement> [niveau]` enchante l’objet en main (sans table ni niveaux) ✦ · `/desenchanter` retire tous les enchantements de l’objet en main ✦ · `/plein` complète la pile en main (64) ✦ |
| **Partie** | `/mode <survie / créatif>` change le mode de jeu (pour tout le monde en multijoueur) ✦ · `/creatif` passe en mode créatif ✦ · `/survie` passe en mode survie ✦ · `/difficulte <paisible / facile / normal / difficile>` change la difficulté ✦ · `/regle [règle] [on / off]` règles de la partie (sans rien : la liste) ✦ · `/triche [on / off]` hôte : autorise (ou non) les triches aux invités ✦ · `/defspawn` le point de départ du monde devient ta position ✦ · `/sauver` sauvegarde la partie maintenant |
| **Créatures** | `/tuer [joueur / @a / créatures / animaux / ombres / villageois / golems / objets]` tue un joueur (toi par défaut) ou des créatures proches ✦ · `/invoquer <créature> [nombre] [x y z]` fait apparaître des créatures, de la TNT, un éclair… (là où tu vises) ✦ · `/raid [stop]` lance un raid de pillards sur le village proche (ou l'arrête) ✦ · `/saison [printemps / ete / automne / hiver]` affiche ou change la saison ✦ · `/nettoyer` retire tous les objets posés au sol ✦ · `/creatures` compte les créatures chargées autour |
| **Déplacement** | `/vol [on / off] [joueur / @a]` permet de voler, même en survie (double appui sur saut) ✦ · `/vitesse <0.1 à 10> [joueur / @a]` vitesse de déplacement (1 = normale) ✦ · `/saut <0 à 10> [joueur / @a]` sauts plus hauts (0 = normal) ; amortit aussi les chutes ✦ · `/tp <x y z> / <joueur> / <joueur> <x y z> / <joueur> <joueur>` téléportation (~ = position actuelle : /tp ~ ~10 ~) ✦ · `/haut` remonte à la surface (au-dessus de toi) ✦ · `/sauter` téléporte sur le bloc que tu vises (jusqu’à 120 blocs) ✦ · `/spawn [joueur / @a]` retour au point de départ du monde ✦ · `/lit` retourne à ton lit ✦ · `/retour` revient où tu étais avant ta dernière téléportation (ou ta mort) ✦ · `/aleatoire [distance]` téléportation au hasard (1000 blocs par défaut) ✦ · `/maison [nom]` va à une maison enregistrée (/defmaison) ; pas pendant un combat · `/defmaison [nom]` enregistre ta position comme maison (10 au plus) · `/maisons` liste tes maisons · `/suppmaison <nom>` supprime une maison · `/tpa <joueur>` demande à aller chez un joueur · `/tpaici <joueur>` lui demande de venir · `/tpaccepter [joueur]` · `/tprefuser [joueur]` (une demande dure 60 s ; les maisons des invités sont gardées par l'hôte ou le serveur) · `/nether` voyage dans le Nether (un portail t’attend à l’arrivée) ✦ · `/end` voyage dans l’End (sur la plateforme d’obsidienne) ✦ · `/monde` retour au monde normal ✦ |
| **Monde** | `/temps <jour / midi / nuit / minuit / aube / soir / 14h / ajouter 2h>` change l’heure du monde ✦ · `/jour` le matin tout de suite ✦ · `/nuit` la nuit tout de suite ✦ · `/cycle [on / off]` arrête ou relance le cycle jour/nuit ✦ · `/meteo <clair / pluie / orage> [durée en minutes]` change la météo (neige dans les biomes froids) ✦ · `/foudre [joueur]` la foudre tombe là où tu vises (ou sur un joueur) ✦ · `/explosion [puissance 1-10]` explosion là où tu vises ✦ · `/eteindre [rayon]` éteint les feux autour de toi ✦ |
| **Construction** | `/poser [x y z] <bloc>` pose un bloc (sans coordonnées : contre le bloc visé) ✦ · `/remplir <x1 y1 z1> <x2 y2 z2> <bloc> [creux / contour / garder / remplacer <bloc>]` remplit une boîte (20 000 blocs au plus) ✦ · `/remplacer <rayon> <bloc à remplacer> <nouveau bloc>` remplace un bloc par un autre autour de toi ✦ · `/sphere <rayon> <bloc> [creuse]` une boule autour du bloc visé ✦ · `/dome <rayon> <bloc>` un dôme creux posé sur le bloc visé ✦ · `/creuser [rayon]` creuse une boule de vide autour du bloc visé ✦ · `/mur <longueur> <hauteur> <bloc>` un mur devant toi, à partir du bloc visé ✦ · `/colonne <hauteur> <bloc>` une colonne sur le bloc visé ✦ · `/plateforme [rayon] [bloc]` une plateforme sous tes pieds (verre par défaut) ✦ · `/annuler` annule ta dernière construction par commande (8 au plus) ✦ · `/arbre [essence]` fait pousser un arbre sur le bloc visé ✦ · `/pousser [rayon]` fait pousser cultures et pousses autour de toi ✦ |

## Mécaniques

| Mécanique | Dans CraftMine |
| --- | --- |
| 🎬 **Animations** | **Main** : l'objet sort quand on en change, le coup suit une courbe façon Minecraft, la main garde un léger retard quand on tourne la tête et respire au repos. **Caméra** : elle penche du côté d'un coup reçu, se balance un peu en marchant et plonge à l'atterrissage. **Joueurs** : le corps suit la tête (elle tourne seule jusqu'à 50°), les pas démarrent et s'arrêtent en douceur, les bras bougent au repos ; à la mort, le joueur tombe sur le côté puis disparaît dans un nuage. **Créatures** : rotation lissée, pas progressifs, petit rebond, recul quand elles sont touchées, chute sur le côté à la mort ; animaux et villageois tournent la tête vers toi. **Objets** ramassés : ils filent vers le joueur. **Interface** : menus qui apparaissent en douceur, case choisie soulevée, cœurs qui clignotent ou ondulent, barre d'expérience fluide. |
| 🍗 **Faim** | Comme dans Minecraft : 10 cuisses, saturation et épuisement. Courir, sauter, nager, miner, se battre et la ruée font baisser la faim. Faim presque pleine : la vie remonte seule. Faim à zéro : on perd de la vie. Sous 3 cuisses, plus de course ni de ruée. Sous l'eau, des bulles d'air remplacent l'ancien souffle. |
| 🌾 **Agriculture** | Houe pour labourer, puis blé, carottes, pommes de terre, betteraves, citrouilles et pastèques. La terre labourée à 4 blocs ou moins d'une eau devient **irriguée** (plus sombre) : les cultures y poussent 2,5 fois plus vite ; sèche et vide, elle redevient de la terre. Le **seau** (3 lingots de fer) ramasse et verse l'eau ; versée juste avant de toucher le sol, elle annule les dégâts de chute (**MLG**). Les tiges adultes font pousser leur citrouille ou pastèque sur une case voisine. Poudre d'os pour accélérer. Nouvelles recettes : pomme de terre cuite, soupe de betterave, carotte dorée, graines, bloc de pastèque, teintures. |
| 🐑 **Élevage** | Clic droit sur un animal avec sa nourriture (blé : mouflon, vache, chèvre ; carotte, pomme de terre ou betterave : sanglier ; graines : poule ; carotte : lapin ; pomme : cerf) : il devient amoureux, rejoint un autre animal nourri et ils ont un petit, qui grandit en 5 minutes. Les animaux suivent le joueur qui tient leur nourriture. Les animaux nourris ne disparaissent plus et sont gardés dans la sauvegarde. |
| 🛡 **Armures** | Cuir, or, fer, diamant et netherite : casque, plastron, jambières et bottes (5 / 8 / 7 / 4 matériaux à l'Établi ; netherite = pièce en diamant + lingot de netherite à la table de forgeron). On les enfile par clic droit en main, Maj+clic ou dans les 4 cases d'armure de l'inventaire. Protection et robustesse comme dans Minecraft (jusqu'à 80 % de dégâts en moins contre les créatures, les explosions et les autres joueurs ; rien contre la chute, la faim ou la noyade). L'armure **s'use** à chaque coup reçu et casse à 0 (avertissement à 10 %). Au-dessus des cœurs, des icônes montrent la protection ; en bas à droite, un panneau liste les pièces portées avec leur durabilité. Visible sur les autres joueurs en multijoueur. En vente chez le forgeron et le boucher des villages, et dans certains coffres. |
| ✨ **Expérience** | Une barre verte avec le niveau, au-dessus de la barre d'objets (comme dans Minecraft). On en gagne en minant charbon, diamant, émeraude, lapis, redstone, quartz, cristal et rubis (pas avec Toucher de soie), en tuant des Ombres et des animaux, en échangeant avec les villageois, en faisant naître des petits et en fondant à la forge. Perdue à la mort, sauf si l'inventaire est conservé. |
| 📚 **Enchantements** | **Table d'enchantement** (1 livre + 2 diamants + 4 obsidiennes à l'Établi), avec un livre qui flotte et s'ouvre quand on approche. On y pose un outil, une épée ou une pièce d'armure : 3 offres tirées comme dans Minecraft, qui coûtent 1 à 3 lapis-lazuli et autant de niveaux (il faut au moins le niveau affiché). Jusqu'à 15 **bibliothèques** autour (à 2 blocs, avec de l'air entre) donnent des offres jusqu'au niveau 30. Les plus importants de Minecraft, sur les mêmes objets : **Efficacité**, **Fortune**, **Toucher de soie** (pioche, hache, pelle, houe) ; **Tranchant**, **Recul**, **Aura de feu** (viande cuite), **Butin** (épée ; Tranchant aussi sur la hache) ; **Protection**, **Solidité**, **Épines** (plastron), **Chute amortie** (bottes), **Apnée** (casque). Les outils ne s'usant jamais, Solidité ne concerne que les armures. Objets enchantés : reflet violet, liste dans l'info-bulle, synchronisés en multijoueur ; parfois dans les coffres des ruines. |
| 🔨 **Enclume** | 3 blocs de fer + 4 lingots de fer à l'Établi. Répare une armure avec son matériau (cuir, or, fer, diamant, netherite : 25 % de durabilité par unité) ou fusionne deux objets identiques (durabilités additionnées + 12 %, enchantements réunis : deux niveaux égaux donnent le niveau au-dessus). Coûte des niveaux d'expérience ; 40 ou plus : « Trop cher ! ». |
| 💧 **Eau qui coule** | Comme dans Minecraft : l'eau s'étale sur 7 blocs, tombe sans limite, va vers le trou le plus proche (4 blocs) ; deux sources voisines en créent une nouvelle. Elle emporte plantes et torches, éteint le feu, et son courant entraîne joueurs, créatures et objets. Seules les sources se ramassent au seau. Les lacs et océans existants ne bougent que si l'on touche à leurs bords. |
| 🌋 **Lave** | Elle coule comme l'eau mais lentement, sur 3 blocs (7 dans le Nether), éclaire, brûle (4 points par demi-seconde, puis 15 s en feu), ralentit, détruit les objets (sauf la netherite) et peut mettre le feu au bois voisin. Source + eau = **obsidienne** ; lave qui coule + eau = galets ; lave qui tombe dans l'eau = pierre. Le seau la ramasse et la reverse. Lacs de lave au fond des cavernes (y ≤ −55), mares dans les terres volcaniques (mondes récents), océan de lave dans le Nether. |
| 🌀 **Nether** | Cadre d'obsidienne (intérieur de 2 × 3 à 21 × 21, coins facultatifs) allumé au briquet ; rester 3,5 s dans le portail (1 s en créatif) pour voyager. Coordonnées ÷ 8 : le portail d'arrivée est retrouvé (16 blocs autour dans le Nether, 128 dans le monde normal) ou construit, avec une plateforme si besoin. Le Nether : cavernes entre un sol et un plafond de bedrock, océan de lave sous y = 31, 5 biomes (désolation, forêts carmin et biscornue, vallée des âmes, deltas de basalte), brume colorée, pierre lumineuse, quartz, or du Nether, débris antiques, **forteresses** (donjon + ponts, coffre de butin) et **Ombres ardentes** (insensibles au feu, sans peur de la lumière, elles enflamment). Casser le cadre éteint le portail ; l'eau s'évapore, les lits explosent. Mort dans le Nether : retour au lit ou au départ du monde normal. Sauvegarde des deux mondes. En multijoueur, chacun voyage seul, comme dans Minecraft : l'hôte fait vivre les deux mondes en même temps (créatures, lave, feu) tant qu'un joueur s'y trouve, on ne voit que les joueurs de sa dimension, et un invité qui se reconnecte revient dans la dimension où il était. |
| 🔥 **Feu** | Le briquet allume un feu sur n'importe quel bloc solide (et amorce toujours la TNT). Le feu brûle et se propage dans le bois, les feuilles, la laine, les tapis, les herbes, les bibliothèques et le foin (Options > Jeu pour désactiver la propagation), s'éteint seul sur un bloc qui ne brûle pas, brûle éternellement sur la roche du Nether et le magma. Il enflamme joueurs et créatures (l'eau les éteint ; viande cuite avec Aura de feu), détruit les objets au sol et amorce la TNT voisine. |
| 📦 **Objets au sol** | Un objet jeté ou tombé disparaît au bout de **5 minutes** (il clignote ses 10 dernières secondes), comme dans Minecraft. |
| 🍞 **Manger** | Tout aliment se mange en 1 seconde (clic droit maintenu ; sur téléphone un toucher suffit). On avance lentement pendant le repas ; relâcher avant la fin annule. |
| 🪝 **Grappin** | 3 lingots de fer + 2 cordes. Clic droit sur un bloc jusqu'à 34 blocs : tu es tiré vers lui en gardant ton élan. |
| 💨 **Ruée et double saut** | `F` lance une ruée (plus de dégâts si tu frappes pendant). Elle se dirige en direct : tourne la caméra ou change de touche pendant la ruée, et même l'élan en l'air qui suit prend le virage. L'*Amulette de plume* donne un double saut. |
| 🔥 **Combo de minage** | Casser des blocs à la suite accélère le minage. À partir de x5, les minerais peuvent donner un double butin. |
| ⭐ **Maîtrise des outils** | Les outils ne s'usent jamais : ils gagnent de l'expérience et montent jusqu'à ★★★★★. 7 matériaux (bois, pierre, or, fer, cristal, diamant, netherite) et 5 types (pioche, hache, pelle, épée, houe). Hache en fer : abat l'arbre entier. Pioche de cristal : mine tout le filon. |
| 📖 **Fabrication sans grille** | Un livre de plus de 400 recettes, avec recherche et catégories (Outils, Blocs, Déco, Objets, Nourriture). Certaines demandent un **établi**, une **forge / un fourneau** ou une **table de forgeron** à moins de 4 blocs. |
| 🐴 **Animaux apprivoisés** | **Loup** + os (des squelettes) : collier rouge, il te suit (et te rejoint de loin), attaque ce qui te frappe, ce que tu frappes et les monstres proches, s'assoit sur clic droit, la viande le soigne. **Cheval** (plaines, savane) : on le monte main vide, il rue jusqu'à t'accepter (la nourriture l'adoucit) ; dressé et **sellé** (5 cuirs + 2 fers), il galope à 13 blocs/s, saute haut, monte les marches (accroupi pour descendre) ; 4 robes, poulains avec carottes/pommes dorées. **Lait** (seau sur une vache), **œufs** pondus par les poules, à lancer (parfois un poussin). Sauvegardés (maître, selle, robe) et partagés en multijoueur ; les autres joueurs te voient à cheval. |
| 🧪 **Potions** | **Alambic** (3 pierres + essence d'ombre + poudre lumineuse) : 1 ingrédient + 3 fioles, 12 s. Fiole d'eau + **verrue du Nether** (bloc de verrues des forêts carmin) = potion étrange, puis 12 ingrédients → **16 effets** (vitesse, force, soin, régénération, poison, résistance au feu, apnée, vision nocturne, saut, chute lente, résistance, célérité, et par corruption à l'œil fermenté : lenteur, faiblesse, dégâts, invisibilité). Redstone : plus longue ; poudre lumineuse : niveau II ; poudre à canon : **jetable** (touche joueurs et créatures autour). Lait : enlève tout. Effets affichés en haut à droite, sauvegardés, `/effet`. L'invisibilité cache le joueur aux autres et aux monstres. |
| 🔆 **Balise** | 5 verres + 3 obsidiennes + éclat céleste, sur une pyramide (1 à 4 étages) de blocs de fer, d'or, de diamant, d'émeraude ou de netherite : faisceau lumineux et effet (vitesse, célérité, résistance, saut, force, régénération ; clic droit pour changer) à tous les joueurs à 20–50 blocs, en multijoueur aussi. |
| 🎣 **Pêche** | Canne (3 bâtons + 2 cordes) : on lance le flotteur, des bulles approchent, il plonge : clic droit dans la seconde pour ferrer. Poissons (morue, saumon, tropical, globe), bric-à-brac, trésors (selle, émeraudes, diamant, pomme dorée…) et expérience ; plus rapide sous la pluie. La ligne accroche aussi les créatures (on les tire vers soi). Les autres joueurs voient ta ligne. |
| ⛵ **Bateaux** | 5 planches. Posé sur l'eau, il va là où l'on se dirige (8 blocs/s, bien plus sur la glace), dérive avec le courant, se reprend en le frappant ; on peut pêcher dedans. Piloté par son passager en multijoueur (sans décalage), sauvegardé. |
| 🐬 **Vie aquatique** | Morues, saumons, poissons tropicaux (8 couleurs, océans chauds), poissons-globes (se gonflent, piquent et empoisonnent), calmars (nuage d'encre, teinture noire), dauphins (bonds hors de l'eau, suivent nageurs et bateaux, **grâce du dauphin** : nage ×2). Ils apparaissent dans les rivières, lacs et océans et frétillent hors de l'eau. |
| 🍰 **Cuisine** | **Four à pain** : gâteau (se pose, 4 parts ; les seaux de lait sont rendus), biscuits, tarte aux pommes, pain. Forge : morue et saumon cuits. Ragoût, soupe de poisson, soupe de légumes, sushis. |
| 🏹 **Arbalète et trident** | Arbalète : charge (clic droit maintenu), tir puissant ; Charge rapide, Tir multiple, Perforation. Arc enchantable (Puissance, Frappe, Flamme, Infinité). Trident : mêlée 9, lancer (clic maintenu puis relâché), Loyauté (revient), Impulsion (propulse dans l'eau / sous la pluie), Canalisation (foudre pendant l'orage), Empalement. **Noyés** : sortent des eaux la nuit, certains lancent leur trident (qu'ils laissent parfois). |
| 🪽 **Élytres** | À la place du plastron : saut en l'air pour planer (physique de Minecraft : piquer pour accélérer, cabrer pour remonter), **fusées** pour la propulsion (et feux d'artifice au sol), énergie cinétique contre les murs, usure (réparation au cuir). Les autres joueurs te voient planer, ailes ouvertes. |
| 🪧 **Panneaux** | Au sol (tournés vers soi) ou au mur ; 4 lignes écrites dans une fenêtre, texte peint en perspective sur la planche (caché derrière les murs), couleur à la teinture, modifiables. |
| 🖼 **Tableaux, cadres, porte-armures** | 14 tableaux peints par le jeu (1 × 1 à 4 × 2, le plus grand qui tient), cadres (mur, sol, plafond ; objet exposé et tourné), porte-armures (armure, élytres, arme en main). Ils tombent s'ils perdent leur support ; sauvegardés et partagés en multijoueur. |
| 🎵 **Juke-box** | 8 disques, 8 morceaux composés par le jeu (accords, basse, mélodie en A-B-A, arpèges, batterie, écho selon le style), son spatialisé, notes qui s'envolent. Disques : coffres des ruines, rampant tué par un squelette. |
| 🗺 **Carte et boussoles** | Mini-carte (touche M : masquée / petite / grande) avec relief, joueurs, lit, lieu de la mort, monstres ; carte tenue en main (grande) ; boussole vers le lit, boussole de récupération vers le lieu de la dernière mort (l'aiguille s'affole dans une autre dimension). |
| 💀 **Mort** | Coordonnées affichées (écran de mort et tchat), objets au sol pendant 20 minutes au lieu de 5. |
| 🧰 **Tri et recherche** | Tri de l'inventaire et des coffres (piles regroupées, rangées par type) ; recherche d'un objet dans les coffres à 48 blocs (distance, direction, étincelles ; aussi pour les invités). |
| 🏆 **Succès** | 41 succès (bannière, annonce aux autres joueurs, liste dans le Journal), sauvegardés par joueur. |
| 🎨 **Apparence** | Peau, cheveux, haut, pantalon, cape : vus par les autres joueurs en multijoueur (et bras à l'écran). |
| 🏚 **Structures** | (Mondes créés depuis cette version.) **Donjons** souterrains avec un **générateur de monstres** et des coffres ; **puits de mine** (galeries étayées, rails, torches, **toiles d'araignée** qui engluent, coffres, générateurs d'araignées) ; **temples du désert** (deux tours, salle au trésor à 4 coffres piégée par une plaque de pression et 9 TNT) ; **cabanes de sorcière** sur pilotis dans les marais. Chaque structure a son propre butin. **Sorcière** : garde ses distances, lance des potions (lenteur, poison, dégâts, faiblesse), boit pour se soigner. |
| 👁 **Forts souterrains** | (Mondes créés depuis cette version.) Trois forts à 700-1 200 blocs du centre : couloirs, bibliothèque, réserves avec coffres, salle du portail (12 cadres autour d'un bassin de lave). **Œil de l'End** (perle + larme d'ardent) : lancé, il file vers le fort le plus proche ; 12 yeux dans les cadres ouvrent le portail. |
| 🐉 **L'End** | Grande île de pierre de l'End, 10 piliers d'obsidienne coiffés de **cristaux** qui soignent le **dragon** (il tourne, crache son souffle, fonce, se pose). Vaincu : portail de sortie, **œuf du dragon**, **élytres**. Îles lointaines : **chorus** (le fruit téléporte) et **tours de purpur** avec coffres. **Arpenteurs** : neutres, ils se fâchent si on les regarde, se téléportent, laissent des **perles** (lancer = téléportation). |
| 🍂 **Saisons** | (Mondes créés depuis cette version, `/regle saisons`.) 5 jours chacune, affichées sous l'horloge. Printemps : feuillage tendre, cultures plus rapides, la neige fond. Été : plus d'étoiles filantes. Automne : feuilles jaunes, orange et rouges, herbe jaunie. Hiver : givre sur les feuilles et l'herbe, neige dans les biomes tempérés qui recouvre le sol, cultures lentes (sauf éclairées). |
| 🌌 **Ciel** | Aurores boréales (biomes froids, et partout l'hiver) et étoiles filantes la nuit. |
| 🌿 **Grottes luxuriantes** | (Mondes récents.) Mousse, argile, azalées, herbes et **lianes à baies lumineuses** qui éclairent (baies comestibles). |
| 🔊 **Profondeurs sombres** | Sous y = 0 : sculk, capteurs et **hurleurs de sculk**. Tes pas (sauf accroupi) les font hurler : **obscurité**, et au 4e avertissement le **gardien aveugle** sort de terre (il entend les pas, coups terribles, onde sonique à travers les murs ; il repart sous terre s'il n'entend plus rien). Butin : **éclats d'écho** (boussole de récupération). |
| 🪸 **Récifs de corail** | Branches de corail, gorgones dessinées dans l'eau, **cornichons de mer** lumineux, poissons tropicaux. |
| 🏘 **Villageois qui évoluent** | Chaque habitant garde son métier et progresse avec les échanges : Novice → Apprenti → Compagnon → Expert → Maître (insigne sur la robe). Chaque niveau débloque de nouveaux échanges (boussole, carte, table d'enchantement, lit, selle, potions, pommes dorées…). |
| 🏴 **Pillards et raids** | Patrouilles de **pillards** (arbalète) et de **vindicateurs** (hache) dès le 3e jour ; leur capitaine porte une bannière. Le tuer donne **Mauvais présage** : entrer dans un village déclenche un **raid** (3 à 5 vagues : pillards, vindicateurs, sorcière, **ravageur**) qui s'en prend aussi aux villageois et aux golems. Victoire : **Héros du village** (prix réduits), **totem d'immortalité** et émeraudes. Barre du raid en haut de l'écran. |
| 👊 **Boss** | **Géant des Ombres** une nuit sur dix (coup au sol, orbes d'ombre, Ombres appelées ; il se dissipe à l'aube). **Gardien du Nether** dans chaque forteresse (vol, boules de feu, Ombres ardentes) : il laisse une **étoile du Nether** (balise). Barres de vie en haut de l'écran, partagées en multijoueur. |
| 🗿 **Totem d'immortalité** | En main ou en main secondaire : il te sauve une fois de la mort (1 cœur, régénération, résistance au feu). |
| 🐾 **Créatures** | **Paisibles** : mouflon, sanglier, manchot, **poule** (plumes, plane en tombant), **vache** (cuir, viande), **lapin** (bonds, déserts et prairies), **cerf** (s'enfuit), **chèvre** (montagnes, sauts géants, charge si on la frappe), **chauve-souris** (grottes). **Neutre** : **loup** (taïgas, en meute : frappe-en un, toute la meute attaque). **Hostiles** (la nuit, dans le noir) : l'Ombre, **araignée** (grimpe aux murs, bondit, neutre le jour ; corde), **squelette** (archer, garde ses distances, prend feu au soleil ; flèches, poudre d'os), **rampant** (siffle puis explose ; **poudre à canon** : 5 + 4 sables = TNT), **gluant** (marais et profondeurs, se divise en 2 à 4 plus petits ; boules de slime). **Nether** : Ombre ardente et **cube de magma** (se divise ; **crème de magma** : 4 = bloc de magma). Le golem de fer défend les villages contre tous les monstres. `/invoquer` les fait apparaître. |
| 🌑 **Les Ombres** | La nuit et dans les grottes sombres. Une vague apparaît à la tombée de la nuit ; leur nombre dépend de la difficulté et des jours passés. Elles brûlent au soleil et refusent d'entrer dans la lumière des torches. |
| 🎨 **Mode créatif** | Vol, blocs infinis, minage instantané, onglet *Créatif* avec tous les blocs et objets (recherche + catégories). Changeable en pause > Options > Jeu. |
| 💥 **TNT** | S'allume au briquet (ou avec une torche) et explose en réaction en chaîne. |
| 🔴 **Redstone** | Tout comme dans Minecraft, simulé à 20 ticks par seconde : poudre (15 blocs), torches (inverseurs, grillent si on les fait clignoter trop vite), leviers, boutons, plaques de pression (4 sortes), répéteurs (délai, verrouillage), comparateurs (comparer / soustraire, lecture des conteneurs), observateurs, pistons et pistons collants (12 blocs, slime et miel), distributeurs, droppers, entonnoirs, lampes, ampoules de cuivre, capteurs de lumière du jour, crochets et fils de déclenchement, cibles, capteurs de sculk, coffres piégés, portes et trappes en fer, bloc musical et TNT. |
| 🛤 **Rails et wagonnets** | Rails qui se raccordent tout seuls (virages, montées), rails de propulsion, détecteurs et activateurs ; wagonnets (on monte dedans), de stockage, de TNT et à entonnoir. Les entonnoirs et les comparateurs communiquent avec les wagonnets. |
| 🏹 **Arc et flèches** | Arc à bander (1 s pour la pleine puissance), flèches qui se plantent et se ramassent, qui activent les cibles et les boutons en bois ; les distributeurs tirent aussi des flèches. |
| ⚡ **Extension Électricité** | À cocher en créant le monde (inspirée du mod Create, en plus simple). Minerais de zinc, d'étain, de bauxite et de lithium ; laiton, bronze, silicium, circuits, moteurs. Câbles, panneaux solaires, éoliennes (plus hautes = plus de vent), roues à eau, générateurs à charbon, manivelle, batteries, lampes électriques et néons de 8 couleurs, broyeur (double les minerais), four électrique, foreuse qui avance en creusant un tunnel (elle ramasse sa récolte et pose des câbles derrière elle), tapis roulants, ventilateurs (ascenseurs à air vers le haut), multimètre et clé à molette. Aussi : panneau solaire avancé, générateur géothermique, bobine Tesla (foudroie les Ombres), ascenseur électrique, aspirateur, moissonneuse automatique, lampadaire, et des outils rechargeables au Chargeur (perceuse électrique, tronçonneuse, lampe torche, pistolet laser). Un signal de redstone arrête les machines. |
| 🧱 **Extension Gravité réaliste** | À cocher en créant le monde. **Tous** les blocs obéissent à la gravité, terrain naturel compris : chaque matériau supporte un porte-à-faux limité (métal 7 blocs, roche naturelle et minerais 6, bois et feuilles 5, pierre taillée, pavés et briques 4, glace 3, terre, neige et laine 2, verre 1 ; sable, gravier et poudre de béton : aucun) et chaque couche peut dépasser un peu plus que celle du dessous. Ce qui ne tient plus tombe **d'un seul morceau** jusqu'au premier appui (un arbre dont on creuse le pied tombe entier dans le trou, un plafond trop large s'écroule, un pont perd son pilier…), en chaîne, blesse ce qu'il écrase ; le verre, la glace et les feuilles se brisent, un coffre garde son contenu. Les arbres sont d'un seul tenant (troncs coudés, feuilles pendantes). Le terrain généré qui ne tiendrait pas reste en place tant qu'on n'y touche pas. Les extensions sont toutes décochées par défaut. |
| ✋ **Deuxième main et 🛡 bouclier** | Case « main secondaire » dans l'inventaire (touche X pour échanger les mains) : une torche y éclaire en permanence, et avec un outil en main le clic droit pose le bloc de la main secondaire. Bouclier (6 planches + 1 fer) : clic droit maintenu pour le lever, il arrête les coups venus de devant (créatures, flèches, joueurs, explosions) et s'use. Visible par les autres joueurs. |
| 🌦 **Météo** | Elle **change toute seule** : beau temps 10 à 25 minutes, puis pluie (3 à 8 min) ou orage (2 à 6 min), annoncés à l'écran (`/regle meteo_auto off` pour la figer). Aussi `/météo pluie`, `/météo orage` ou `/météo clair` (durée en minutes en option). Pluie qui s'arrête sous les toits et les feuilles, **neige** dans les biomes froids, ciel gris et nuages sombres, brume plus proche ; l'orage lance des **éclairs** (zigzag lumineux, flash, tonnerre) qui blessent et mettent le feu. La pluie éteint un joueur en feu. Sauvegardée, et synchronisée en multijoueur. |
| 🔥 **Flammes animées** | Le feu et les flammes des torches (normales, des âmes, de redstone) sont animés sur 8 images. |
| 💡 **Extension Lumière réaliste** | Lumière colorée (torches orangées, redstone rouge, néons, lanternes des âmes…), flammes qui vacillent, halos la nuit, fumée des torches, lumière des torches qui s'ajoute à celle du jour, lumière tenue en main colorée. Cochée par défaut à la création du monde, désactivable dans les Options. |
| 🔫 **Extension Armes à feu** | À cocher en créant le monde. Établi d’armurier (4 fers, 4 planches, 2 poudres à canon) : pièces d’arme, munitions (balles de pistolet, balles de fusil, cartouches de chasse, roquettes, cartouches de gaz, grenades) et **12 armes** en 3D : pistolet, revolver, pistolet-mitrailleur, fusil d’assaut, fusil à pompe (8 plombs, rechargé cartouche par cartouche), fusil à double canon, carabine de chasse (lunette ×2), fusil de précision (lunette ×5, traverse deux créatures), mitrailleuse (6 canons qui tournent), lance-roquettes et lance-grenades (explosions), lance-flammes (met le feu). Clic gauche : tirer ; clic droit : viser ; **R** : recharger (touche réglable). Les balles restent dans l’arme (barre jaune), recul, dispersion (moindre en visant, plus forte en courant ou en sautant), dégâts ×1,6 à la tête, le verre vole en éclats, traçantes, éclair au bout du canon, marqueur de touche, sons propres à chaque arme. Grenade à main (rebondit, explose en 3 s). La nuit, des **bandits** cagoulés tirent au pistolet. Munitions et parfois une arme dans les coffres. Multijoueur (tirs, dégâts, combats entre joueurs), boutons 🔫 🎯 ↻ sur téléphone, 4 succès. |
| 🚗 **Extension Véhicules** | À cocher en créant le monde. Établi de mécanicien (6 fers, 2 planches, 2 redstone) : roues, moteurs, bidons d’essence et **11 véhicules** en 3D : **char d’assaut** (chenilles qui tournent sur place, tourelle qui suit ton regard, canon à obus explosifs au clic gauche avec des obus de char, blindage qui protège l’équipage des créatures, des balles et des explosions, il écrase les créatures, les haies et le verre), voiture (4 places), voiture de sport décapotable (100 km/h), 4x4 et quad tout-terrain (sable et neige sans ralentir, ils montent les marches), camion avec une benne de 27 cases, moto, voiture de police (gyrophares et sirène), hélicoptère (rotor qui tourne ; saut : monter, course : descendre), avion (décollage à 13 blocs/s, il suit ton regard) et bateau à moteur. Clic droit pour le poser et pour monter (les autres montent comme passagers), accroupi pour descendre. Gaz, frein, virages, frein à main (dérapage), klaxon (**H**), phares la nuit, compteur de vitesse, carburant (bidon : +40 %, charbon : +8 %), réparation au lingot de fer, peinture avec une teinture. Chocs, balles et explosions l’abîment : à 0, il prend feu puis explose. Accroupi + clic gauche : le ranger. Il renverse les créatures. Les véhicules sont **solides** : on ne les traverse pas (ni les créatures), on peut grimper sur leur toit et rester dessus pendant qu'ils roulent. **Vue de derrière** (touche **V**, bouton 👁 sur téléphone), par défaut en véhicule. Multijoueur (conducteur et passagers), 3 succès. |
| 🚀 **Extension Optimisation** | Comme le mod Sodium : plus d’images par seconde, sans rien changer à l’image. Le monde est parcouru depuis la caméra en ne passant que là où l’air (ou le verre, l’eau…) relie deux côtés d’une section de 16 × 16 × 16 : les grottes sous tes pieds, l’intérieur des montagnes et les pièces fermées ne sont plus dessinés. Les sections sont dessinées de la plus proche à la plus lointaine (la carte graphique saute les pixels cachés), les créatures derrière toi ou cachées par le terrain ne sont plus dessinées, rien n’est dessiné au-delà du brouillard du Nether, et la **résolution dynamique** baisse la résolution (jusqu’à 50 %) quand ça rame. Mesures : 25 à 50 % de faces dessinées en moins, 50 à 80 % d’images par seconde en plus. Réglage de l’appareil (pour tous les mondes) : case dans l’écran Nouveau monde ou Options › Graphismes. |
| 🏙 **Monde Ville** | Type de monde à choisir en créant la partie. Un quadrillage infini de rues : asphalte, lignes jaunes, passages piétons, trottoirs, lampadaires, feux tricolores, bornes incendie, poubelles (à fouiller) et bancs. Entre les rues, des îlots de 36 × 36 blocs : **gratte-ciel** de verre au centre (jusqu’à 12 étages, antenne ou héliport sur le toit), bureaux, immeubles, commerces avec auvent, **maisons** à toit à deux pans avec jardin, haie, arbre et parfois une piscine, **parcs** avec fontaine, arbres et bancs, **parkings**, **commissariat**, **station-service** (pompes sous un auvent), grande place centrale. Chaque étage est éclairé et relié par une **échelle** jusqu’au toit ; des coffres (butin selon le bâtiment : armes au commissariat, essence à la station…). Sous la ville : roche et minerais. Des **citadins** se promènent le jour ; la nuit, des Ombres et des bandits. Avec l’extension Véhicules, des voitures sont garées dans les parkings (et des voitures de police au commissariat). L’**échelle** (7 bâtons → 3) existe dans tous les mondes : avance ou saute pour monter, accroupis-toi pour rester. |
| ☀ **Objectif final** | Forger le **Cœur d'aube** (4 éclats célestes, 4 essences d'ombre, 4 cristaux, 2 lingots de fer) et le poser : il chasse définitivement les Ombres alentour. |

Un **journal de quêtes** guide la progression ; on le masque (et on le remet) avec le bouton « Masquer le guide » du menu Pause, la croix du panneau ou les Options :
bois → établi → pioche → pierre → torches → forge → fer → grappin → cristal → essence d'ombre → îles célestes → Cœur d'aube.

## Contenu

- **584 blocs**, 163 objets et 546 recettes (dont 42 blocs et 64 recettes de l’extension Électricité), dont :
  - 16 couleurs de laine, tapis, béton, poudre de béton (devient du béton au contact de l'eau), terre cuite, terre cuite émaillée et verre teinté ;
  - 12 essences de bois (chêne, bouleau, sapin, acacia, acajou, saule, bois cristallin, chêne noir, cerisier, palétuvier, carmin, biscornu) avec bûches écorcées, bois, planches, feuilles et pousses, plus le bambou ;
  - pierres : pierre lisse, taillée, fissurée, sculptée, granite/diorite/andésite polis, ardoise des abîmes (et ses briques, tuiles…), tuf, calcite, spéléothème, pierre noire, basalte, obsidienne ;
  - Nether et End : roche et briques du Nether, quartz, sable et terre des âmes, pierre lumineuse, magma, nylium, pierre de l'End, purpur, prismarine, lanterne aquatique ;
  - 55 dalles (deux dalles l'une sur l'autre redonnent le bloc plein) ;
  - 55 escaliers, dans les mêmes matières que les dalles (6 blocs → 4 escaliers). Ils se posent tournés dans le sens du regard, ou à l'envers quand on vise le dessous d'un bloc ou le haut d'une face. Deux escaliers qui se rejoignent forment un coin intérieur ou extérieur, comme dans Minecraft, et on les monte en marchant, sans sauter ;
  - minerais de charbon, fer, cuivre, or, lapis-lazuli, redstone, diamant, émeraude, rubis, cristal, quartz, or du Nether, débris antiques et éclats célestes (et leurs versions dans l'ardoise des abîmes), blocs de métal et de minerai brut, cuivre oxydé ;
  - décoration : bibliothèque, TNT, fourneau, haut fourneau, fumoir, tonneau, ruche, juke-box, bloc musical (joue des notes), cible, tables de cartographie/d'archerie/de forgeron, métier à tisser, grenouillampes, champilampe, lampe à redstone, lanterne des âmes, éponge, blocs de slime et de miel, coraux, sculk, champignons géants ;
  - plantes : 19 fleurs, fougère, herbes, canne à sucre, bambou, azalées, racines du Nether, gorgones, blé.
- **Monde infini** (graine au choix, 160 blocs de haut : de y = −64, le socle, à y = 95) avec **25 biomes** : plaines, prairie fleurie, forêt, forêt de bouleaux, forêt de chênes noirs, bosquet de cerisiers, taïga, taïga enneigée, toundra, pics de glace, savane, jungle, bambouseraie, marais, mangrove, désert, canyon rouge, montagnes, champignonnière, terres volcaniques, forêt fongique, Sylve cristalline, océan, océan chaud (récifs de corail) et lacs — plus le **Nether** et ses 5 biomes, derrière un portail d'obsidienne.
- **Profondeurs** (sous y = 0, comme dans Minecraft) : ardoise des abîmes et tuf, grandes cavernes, diamants et redstone plus fréquents, lapis, or, fer, cristal, un peu de cuivre, de rares débris antiques, zones de sculk, géodes profondes et sol de magma près du socle. Les anciens mondes gagnent aussi ces couches : seul leur socle en y = 0 disparaît, tout le reste (constructions comprises) reste en place.
- Géodes d'améthyste, sculk dans les profondeurs, ruines (en pierre, en grès, en pierre noire ou en prismarine sous l'océan) avec un coffre de butin, îles célestes et îles de l'End avec un sanctuaire de purpur.
- **Villages** (plaines, prairies, forêts, bouleaux, cerisiers, taïga, taïga enneigée, toundra, savane, désert) : un puits sur la place, des chemins, des lampadaires, des maisons dans le bois du biome (grès à toits plats dans le désert, toits enneigés dans le froid), des grandes maisons, des champs irrigués (blé, et dans les mondes récents carottes, pommes de terre et betteraves), une forge et une bibliothèque. Certaines maisons ont un coffre (celui du forgeron est mieux garni). L'indicateur de biome affiche « · Village » quand on y entre. Les villages apparaissent dans les mondes créés à partir de cette version (les anciens mondes ne changent pas, pour ne pas abîmer les constructions).
- **Villageois** : ils vivent autour de leur village et y reviennent s'ils s'en éloignent. Clic droit (ou toucher sur téléphone) pour **échanger** : chacun a un métier (fermier, forgeron, bibliothécaire, berger, boucher, prêtre) et achète tes récoltes, ta viande, ton charbon, ton papier, ta laine ou tes essences d'ombre contre des **émeraudes**, qu'il échange ensuite contre du pain, des outils en fer, une pioche en diamant, des lanternes, de la laine colorée, un rubis… Il **progresse** avec les échanges (Novice → Maître) et débloque de nouvelles offres.
- **Torches** posées au sol ou accrochées au mur visé, penchées comme dans Minecraft ; une torche murale tombe si on casse son mur.
- **Hitbox précises** : torches, fleurs, herbes, cultures, portes, lits, dalles et tapis ont une boîte de visée et de collision à leur vraie taille (on vise le bloc derrière une fleur, on passe à côté d'une porte ouverte, on s'arrête contre le battant d'une porte fermée).
- **Portes** (chêne, sapin, bouleau, acacia ; 6 planches → 3 portes à l'Établi) : clic droit pour ouvrir ou fermer. Une porte se pose sur deux blocs de haut et s'oriente selon ton regard ; les maisons des villages en ont une.
- **Lit** (3 laines + 3 planches à l'Établi) : clic droit dessus pour en faire ton **point de réapparition** ; la nuit, tu t'y couches et passes directement au matin. En multijoueur, le jour se lève quand tous les joueurs sont couchés. Impossible de dormir si des Ombres rôdent tout près. Chaque maison de village a un lit.
- **Golem de fer** : il garde les villages assez peuplés et chasse les Ombres alentour. Tu peux en construire un : 4 blocs de fer en forme de T (deux l'un sur l'autre, un de chaque côté en haut), puis une citrouille (sculptée, lanterne-citrouille ou normale) posée dessus. Il reste près de l'endroit où il a été construit (même après avoir quitté la partie). Il est costaud (100 PV) et se venge si on le frappe, lui ou un villageois !
- Éclairage par propagation (ciel + blocs), occlusion ambiante, cycle jour/nuit, nuages, eau animée, glace et verre translucides, feuillage qui ondule.
- Créatures : *Mouflons* (viande, laine, cuir), *Sangliers* (viande, cuir ; ils chargent si on les attaque), *Pingouins* (plumes), *Villageois* (échanges), *Golems de fer* (protecteurs, lingots de fer), *Ombres* (essence d'ombre) et, dans le Nether, *Ombres ardentes* (quartz, or, poudre lumineuse).
- Amulettes : plume (double saut), satiété (la faim baisse deux fois moins vite), rubis (+2 cœurs).
- Le monde est découpé en tronçons de 16 × 16 blocs, générés à la volée autour du joueur. Chaque modification est enregistrée et réappliquée quand on revient.

## Paramètres

**Options** (menu principal ou pause) est organisé en onglets :

- **Graphismes** : distance d'affichage (3 à 16 tronçons), champ de vision, luminosité, résolution de rendu, limite d'images par seconde, particules, éclairage doux, feuillage qui ondule, nuages, balancement de la vue, champ de vision dynamique, main visible.
- **Contrôles** : sensibilité, axe inversé, course en un appui, saut automatique, contrôles tactiles (auto / activés / désactivés), sensibilité tactile, taille et opacité des boutons, visée au doigt ou au centre, **éditeur de disposition des boutons tactiles**, **réaffectation de toutes les touches**.
- **Jeu** : mode de jeu et difficulté du monde en cours, durée d'une journée, garder l'inventaire à la mort, objectifs à l'écran, fréquence de sauvegarde automatique.
- **Audio** : volume général, blocs et actions, créatures, interface.
- **Interface** : taille de l'interface, réticule, notifications, coordonnées, images par seconde, nom du biome, nom de l'objet en main.

## Structure du code

```
index.html        page, interface (HUD, inventaire, menus)
style.css         styles de l'interface
js/util.js        maths, bruit simplex, matrices
js/zip.js         lecture/écriture de fichiers .zip (export/import des sauvegardes)
js/blocks.js      blocs (0-999 puis 4000 et plus), objets (1000-3999), outils, recettes (identifiants 16 bits)
js/textures.js    textures pixel-art générées + icônes
js/world.js       monde infini par tronçons : génération (monde normal et Nether), biomes, lumière, lancer de rayon
js/blockticks.js  blocs qui évoluent seuls : eau et lave qui coulent, feu, portails cassés
js/mesher.js      maillage des sections 16×16×16 (AO, lumière douce, dalles, escaliers, translucides, faces reliées par l’air)
js/renderer.js    rendu WebGL2 (monde, ciel, entités, eau, sections cachées de l’extension Optimisation)
js/entities.js    physique, créatures, TNT, objets au sol, particules
js/mob_defs.js    nouvelles créatures (poule, vache, lapin, cerf, chèvre, chauve-souris, loup, araignée, squelette, rampant, gluant, cube de magma)
js/potions.js     effets, potions, alambic et balise
js/fish_defs.js   pêche et cuisine : objets, gâteau, four à pain, créatures aquatiques
js/fishing.js     canne à pêche (flotteur, touche, prises), bateaux, gâteau
js/weapon_defs.js arbalète, trident, élytres, fusées, enchantements, Noyé
js/weapons.js     tir, lancer, Loyauté, Impulsion, vol plané, fusées
js/deco_defs.js   panneaux, tableaux (peints par le jeu), cadres, porte-armures, disques
js/deco.js        décoration posée (partagée), texte des panneaux, juke-box et musique
js/comfort_defs.js boussoles, carte, textures de l'apparence
js/comfort.js     mini-carte, boussoles, mort, tri, recherche dans les coffres, succès, apparence
js/structure_defs.js générateur de monstres, toile d'araignée, sorcière
js/structures.js  donjons, puits de mine, temples du désert, cabanes de sorcière (génération, butin, générateurs)
js/raid_defs.js   pillard, vindicateur, ravageur, Géant des Ombres, gardien du Nether, totem, étoile du Nether
js/raids.js       villageois qui progressent, patrouilles, raids, boss, totem, barres de vie
js/cave_defs.js   lianes lumineuses, hurleur de sculk, cornichons de mer, éclat d'écho, gardien aveugle
js/caves.js       grottes luxuriantes, profondeurs sombres, récifs (génération), hurleurs, obscurité
js/seasons.js     saisons (teinte du feuillage, neige, cultures), aurores boréales, étoiles filantes
js/end_defs.js    cadre et portail de l'End, œuf, chorus, perle, œil, Arpenteur, dragon, cristaux
js/end.js         forts souterrains, œil de l'End, dimension de l'End (îles, piliers, tours), combat du dragon
js/gun_defs.js    armes à feu (extension) : caractéristiques, objets, munitions, recettes, textures, bandit
js/guns.js        tir, visée et lunette, recul, rechargement, roquettes et grenades, lance-flammes, modèles 3D, HUD, réseau
js/vehicle_defs.js véhicules (extension) : caractéristiques, objets, recettes, textures, établi de mécanicien
js/dedicated.js   serveur dédié : jeu sans image, hôte permanent, sauvegarde sur disque, /admin, réglages écrits sur la machine
js/admin.js       panneau d'administration (Pause → Administration)
js/teleport.js    menu du joueur (G) : onglets, téléportation (maisons, demandes aux joueurs)
js/social.js      vie du serveur : pseudos protégés, terrains, coffres verrouillés, équipes, pièces, boutique, hôtel des ventes, classements
js/social_ui.js   onglets Terrain, Équipe, Argent, Classements, Compte du menu du joueur
serveur/          programme de la machine (serveur.js), installation (installer.sh), guide (LISEZMOI.md)
js/fkeys.js       touches F : capture d’écran, vidéo, vues, bordures des tronçons, boîtes, zones des monstres, zoom…
js/vehicles.js    conduite, vol, bateau, carburant, dégâts, passagers, klaxon et sirène, caméra de derrière, modèles 3D, réseau
js/city_defs.js   échelle, asphalte, trottoir, lampadaire, feu tricolore, borne incendie, poubelle, banc, pompe à essence, citadin
js/city.js        monde Ville : rues, îlots (gratte-ciel, immeubles, maisons, parcs, parkings, commissariat…), butin, voitures garées
js/player.js      joueur : déplacements, faim, minage, combat, grappin, mode créatif…
js/touch.js       contrôles tactiles : joystick, caméra au doigt, boutons
js/net.js         multijoueur pair à pair : hôte, invités, synchronisation, tchat
js/commands.js    commandes du tchat (/aide) : registre, arguments, complétion, relais multijoueur
js/weather.js     météo : pluie, neige, orage et éclairs
js/vendor/        PeerJS 1.5.5 (licence MIT), chargé seulement en multijoueur
js/inventory.js   inventaire et fabrication
js/ui.js          interface, inventaire créatif, options, journal, aide
js/audio.js       effets sonores WebAudio
js/main.js        boucle de jeu, jour/nuit, dimensions et portails, sauvegarde, entrées
```
