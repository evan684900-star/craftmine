'use strict';
// Interface : HUD, inventaire, fabrication, inventaire créatif, journal, options, menus.
(function () {
  const $ = (id) => document.getElementById(id);
  // Texte sans accents ni majuscules (pour la recherche).
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const I = CM.I;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Texte d'aide partagé (menu principal + onglet « Mécaniques »).
  const GUIDE = [
    ['🍗 La faim', "La barre de faim (à droite des cœurs) baisse quand tu cours, sautes, mines, nages ou te bats. Faim presque pleine : tes cœurs remontent tout seuls. Faim à zéro : tu perds de la vie. En dessous de 3 cuisses tu ne peux plus courir ni faire de ruée. Chaque aliment rend de la faim et de la saturation (qui retarde la prochaine fringale) : la viande grillée, le pain et la tarte à la citrouille sont les plus nourrissants. Sous l'eau, surveille tes bulles d'air."],
    ['🌾 Agriculture', "Laboure la terre avec une houe (clic droit), puis plante : graines de blé ou de betterave (herbes hautes), carottes et pommes de terre (herbes hautes, villages, coffres), graines de citrouille ou de pastèque (1 citrouille = 4 graines, 1 tranche = 1 graine). Avec de l'eau à 4 blocs ou moins, la terre devient irriguée (plus sombre) et tout pousse 2,5 fois plus vite ; laissée sèche et vide, elle redevient de la terre. Un seau (3 lingots de fer) ramasse de l'eau et la verse où tu veux (versée juste avant de toucher le sol, elle annule les dégâts de chute : le fameux MLG !). Une tige adulte fait pousser une citrouille ou une pastèque sur une case libre à côté. La poudre d'os accélère tout."],
    ['🐑 Élevage', "Clic droit sur un animal avec sa nourriture : blé pour les mouflons ; carotte, pomme de terre ou betterave pour les sangliers. Deux animaux nourris se rejoignent et font un petit, qui grandit en 5 minutes (le nourrir l'accélère). Les animaux suivent celui qui tient leur nourriture. Un animal nourri devient un animal d'élevage : il reste à sa place et il est gardé dans la sauvegarde."],
    ['🛡 Armures', "Cinq matériaux (cuir, or, fer, diamant, netherite) et quatre pièces : casque (5 matériaux), plastron (8), jambières (7), bottes (4), à l'Établi. La netherite s'obtient en améliorant une pièce en diamant avec un lingot de netherite à la table de forgeron. Pour l'enfiler : clic droit avec la pièce en main, Maj+clic dans l'inventaire, ou pose-la dans les 4 cases d'armure en haut de l'inventaire. L'armure réduit les dégâts des créatures, des explosions et des autres joueurs (jusqu'à 80 %), mais pas ceux de la chute, de la faim ou de la noyade. Chaque coup reçu l'use ; à 0 elle casse. Les icônes au-dessus des cœurs montrent ta protection, le panneau en bas à droite la durabilité de chaque pièce. Le forgeron et le boucher des villages en vendent, les coffres en cachent."],
    ['✨ Expérience', "La barre verte au-dessus de la barre d'objets montre ton niveau. On gagne de l'expérience en minant du charbon, des diamants, des émeraudes, du lapis, de la redstone, du quartz, du cristal ou des rubis, en tuant des Ombres (5) et des animaux, en échangeant avec les villageois, en faisant naître des petits et en fondant à la forge. À la mort, elle est perdue (sauf si l'inventaire est conservé)."],
    ['📚 Enchantements', "Fabrique une table d'enchantement (1 livre, 2 diamants, 4 obsidiennes, à l'Établi) et fais clic droit dessus. Pose un outil, une épée ou une pièce d'armure dans la case : 3 offres apparaissent, chacune avec son niveau requis ; elle coûte 1, 2 ou 3 lapis-lazuli et autant de niveaux. Jusqu'à 15 bibliothèques autour de la table (à 2 blocs, avec de l'air entre) débloquent les offres de niveau 30. Outils : Efficacité, Fortune, Toucher de soie. Épée : Tranchant, Recul, Aura de feu, Butin (hache : Tranchant aussi). Armure : Protection, Solidité, Épines (plastron), Chute amortie (bottes), Apnée (casque). Un objet ne s'enchante qu'une fois ; une pièce en diamant garde ses enchantements quand on l'améliore en netherite."],
    ['🔨 Enclume', "3 blocs de fer + 4 lingots de fer, à l'Établi. Clic droit dessus : à gauche l'armure abîmée, à droite son matériau (cuir, lingot d'or ou de fer, diamant, lingot de netherite) : chaque unité rend 25 % de la durabilité. Ou mets deux objets identiques : leurs durabilités s'additionnent (+12 %) et leurs enchantements se réunissent (deux niveaux égaux donnent le niveau au-dessus, par exemple Tranchant III + Tranchant III = Tranchant IV). Coûte des niveaux d'expérience (40 ou plus : trop cher)."],
    ['💧 Eau et 🔥 feu', "L'eau coule comme dans Minecraft : jusqu'à 7 blocs à plat, sans limite vers le bas, vers le trou le plus proche ; deux sources côte à côte en créent une troisième. Le courant entraîne joueurs, créatures et objets. Au seau, on ne ramasse qu'une source. Le briquet (lingot de fer + silex) allume un feu sur le bloc visé et amorce la TNT. Le feu brûle le bois, les feuilles, la laine et les herbes et se propage (désactivable dans Options > Jeu) ; il enflamme joueurs et créatures (l'eau les éteint) et détruit les objets au sol. Pour éteindre une flamme : clic gauche ou toucher dessus (ou clic sur le bloc qui brûle)."],
    ['🍞 Manger', "Garde le clic droit enfoncé 1 seconde avec un aliment en main (sur téléphone, un toucher suffit : tu manges jusqu'au bout sauf si tu changes d'objet). On avance lentement pendant qu'on mange."],
    ['🪝 Grappin', "Fabrique-le avec 3 lingots de fer et 2 cordes. En main, clic droit sur un bloc jusqu'à 34 blocs : tu es tiré vers lui en gardant ton élan. Saut pendant la traction pour te décrocher avec un bond."],
    ['💨 Ruée et double saut', "La touche de ruée (F) lance un sprint éclair (tu es brièvement invulnérable et tu frappes plus fort). Tu peux la diriger pendant qu'elle dure : tourne la caméra ou change de direction, même dans l'élan en l'air. L'Amulette de plume, gardée dans l'inventaire, donne un double saut."],
    ['🔥 Combo de minage', "Casse des blocs à la suite (moins de 2,4 s d'écart) : chaque niveau de combo accélère le minage. À partir de x5, les minerais peuvent donner un double butin."],
    ['⭐ Maîtrise des outils', "Les outils ne s'usent jamais. Ils gagnent de l'expérience et montent jusqu'à ★★★★★. Sept matériaux : bois, pierre, or (très rapide), fer, cristal, diamant et netherite (le meilleur, à la table de forgeron). Une hache en fer abat l'arbre entier, la pioche de cristal mine tout un filon, et la hache écorce les bûches (clic droit)."],
    ['📖 Fabrication libre', "Pas de grille : ouvre l'inventaire (E) et choisis une recette (plus de 400, avec recherche et catégories). Certaines demandent un Établi, une Forge / un Fourneau ou une Table de forgeron à moins de 4 blocs. La forge sert à fondre et cuire avec du charbon."],
    ['🌑 Les Ombres', "La nuit et dans les grottes sombres, des Ombres apparaissent (leurs yeux brillent dans le noir). Elles brûlent au soleil et ont peur de la lumière : elles refusent d'entrer dans la zone d'une torche et y souffrent. Éclaire ta base ! Leur nombre dépend de la difficulté et des jours passés."],
    ['🧱 Plus de 500 blocs', "Laine, béton, poudre de béton (devient du béton au contact de l'eau), terre cuite et verre en 16 couleurs, tapis, dalles (deux dalles = un bloc), 12 essences de bois et leurs versions écorcées, ardoise des abîmes, tuf, calcite, pierre noire, basalte, blocs du Nether et de l'End, prismarine, quartz, coraux, grenouillampes, TNT (à allumer au briquet)…"],
    ['🎨 Mode créatif', "Choisis-le en créant un monde (ou en pause > Options > Jeu). Blocs infinis, vol (appuie deux fois sur saut), minage instantané, pas de dégâts ni de faim. L'onglet Créatif de l'inventaire contient tous les blocs et objets ; le clic molette copie le bloc visé."],
    ['🍄 Champignons rebond', "Dans les grottes poussent des champignons violets lumineux. Saute dessus pour rebondir très haut ; tomber dessus annule les dégâts de chute (comme le bloc de slime et la botte de foin)."],
    ['🏝 Îles célestes', "Des îles flottent au-dessus du monde (vers la couche 75). Leur pierre renferme des Éclats célestes. Certaines portent des ruines de purpur et de pierre de l'End."],
    ['🗺 Biomes', "Plus de 20 biomes : plaines, prairies fleuries, forêts (chêne, bouleau, chêne noir), bosquets de cerisiers, taïga, taïga enneigée, toundra, pics de glace, savane, jungle, bambouseraie, marais, mangrove, désert, canyon rouge, montagnes, champignonnière, terres volcaniques, forêts fongiques, océans chauds à coraux, océans, lacs… et la Sylve cristalline. La taille des biomes se règle en créant le monde."],
    ['⛏ Minerais', "Charbon, fer, cuivre, or (canyons rouges), lapis-lazuli, redstone, diamant (très profond, surtout sous y = 0), émeraude et rubis (montagnes), cristal (sous la couche 20), quartz et or du Nether (terres volcaniques), débris antiques → netherite, et éclats célestes. Sous la couche 14, les minerais sont dans l'ardoise des abîmes."],
    ['🏛 Ruines', "Des ruines cachent un coffre rempli de butin : lingots, nourriture, diamants, livres, pousses, parfois un rubis ou un éclat céleste."],
    ['🌋 Lave', "La lave coule comme l'eau, mais lentement et sur 3 blocs seulement (7 dans le Nether). Elle éclaire, brûle tout ce qui y tombe (4 points de dégâts par demi-seconde, puis 15 s en feu), détruit les objets (sauf la netherite) et peut enflammer le bois voisin. Au contact de l'eau : une source devient de l'obsidienne, la lave qui coule des galets, et la lave qui tombe dans l'eau de la pierre. Le seau la ramasse et la reverse. On en trouve au fond des cavernes (vers y = −55), dans les terres volcaniques et partout dans le Nether."],
    ['🌀 Le Nether', "Construis un cadre d'obsidienne (4 de large, 5 de haut au minimum, coins facultatifs) et allume l'intérieur au briquet. Reste 3 secondes et demie dans le portail violet (1 s en créatif) pour passer dans le Nether : cavernes géantes, océan de lave, forêts carmin et biscornues, vallées des âmes, deltas de basalte, pierre lumineuse, quartz, or et débris antiques. Des Ombres ardentes y rôdent de jour comme de nuit, sans craindre la lumière, et mettent le feu. Les forteresses en briques du Nether cachent un coffre. Un bloc parcouru dans le Nether vaut 8 blocs dans le monde normal : le portail d'arrivée est construit tout seul, ou retrouvé s'il existe déjà. Casser le cadre éteint le portail. L'eau s'y évapore et les lits y explosent ! Mort dans le Nether : retour au monde normal. En multijoueur, chacun voyage seul, comme dans Minecraft : on ne voit que les joueurs de sa dimension (la liste des joueurs, en pause, indique qui est dans le Nether)."],
    ['🕳 Profondeurs', "Le monde descend jusqu'à y = −64, comme dans Minecraft : sous y = 0, l'ardoise des abîmes remplace la pierre (plus longue à miner), avec de grandes cavernes, beaucoup de diamants et de redstone, du lapis, de l'or, du fer, du cristal et de rares débris antiques (netherite). Zones de sculk, géodes d'améthyste profondes, et du magma brûlant près du socle. Prends des torches !"],
    ['🏘 Villages', "Dans les plaines, forêts, taïgas, savanes et déserts, des villages entourent un puits : maisons, champs (blé, carottes, pommes de terre, betteraves), forge, bibliothèque et lampadaires. Certaines maisons ont un coffre. Clic droit (ou toucher) sur un villageois pour échanger : vends-lui récoltes, viande, charbon, papier, laine ou essences d'ombre contre des émeraudes, puis achète pain, outils, lanternes, rubis… Les villages n'apparaissent que dans les mondes créés depuis leur ajout."],
    ['🚪 Portes et lits', "Porte : 6 planches d'une même essence (chêne, sapin, bouleau, acacia) donnent 3 portes à l'Établi ; clic droit pour l'ouvrir ou la fermer. Lit : 3 laines + 3 planches. Clic droit sur un lit pour y placer ton point de réapparition ; la nuit, tu t'y couches et passes au matin (en multijoueur, quand tout le monde est couché). Pas de sommeil si des Ombres rôdent tout près !"],
    ['💬 Commandes', "Ouvre le tchat (T, Entrée, / ou 💬 sur téléphone) et tape « / » : plus de 80 commandes, en solo comme en multijoueur. Des suggestions s'affichent pendant la frappe ; Tab complète, ↑ reprend la commande précédente. /aide les liste par catégorie. Exemples : /donner diamant 64 · /donner épée_en_diamant · /kit outils · /mode créatif · /temps midi · /météo orage · /tp ~ ~20 ~ · /tp Bob · /spawn · /defmaison base puis /maison base · /retour · /vol · /vitesse 2 · /soigner · /xp 30L · /enchanter tranchant 5 · /invoquer ombre 3 · /tuer ombres · /remplir ~-3 ~ ~-3 ~3 ~4 ~3 verre creux · /sphere 5 verre · /annuler · /localiser village · /regle faim off. Les objets s'écrivent en français avec des _ à la place des espaces (lingot_de_fer), ~ veut dire « ici ». En multijoueur, l'hôte autorise les triches aux invités avec /triche on."],
    ['🌦 Météo', "/météo pluie, /météo orage ou /météo clair (avec une durée en minutes si tu veux). La pluie s'arrête sous les toits et les feuilles, devient de la neige dans les biomes froids, assombrit le ciel et éteint un joueur en feu. L'orage lance des éclairs qui blessent et allument des feux."],
    ['🧱 Gravité réaliste (extension)', "À cocher en créant le monde. TOUS les blocs obéissent à la gravité, terrain naturel compris. Un bloc tient s'il est posé sur un bloc qui tient, ou accroché par le côté à des blocs qui tiennent, sans dépasser dans le vide de plus de : 7 blocs pour le métal, 6 pour la roche naturelle et les minerais, 5 pour le bois et les feuilles, 4 pour la pierre taillée, les pavés et les briques, 3 pour la glace, 2 pour la terre, l'herbe, la neige et la laine, 1 pour le verre. Le sable, le gravier et la poudre de béton ont besoin d'un appui juste dessous. Chaque couche peut dépasser un peu plus que celle du dessous : un plafond épais tient mieux qu'un plafond fin. Ce qui ne tient plus tombe d'un seul morceau jusqu'au premier appui : creuse sous un arbre et il tombe entier dans le trou, creuse une salle trop large et son plafond s'écroule, retire un pilier et le pont s'effondre. Les arbres sont d'un seul tenant (troncs coudés, feuilles pendantes). Le terrain généré qui ne tiendrait pas (grand plafond de grotte) reste en place tant qu'on n'y touche pas ; dès qu'on le dérange, il s'écroule. Un bloc qui tombe de haut fait mal ; le verre, la glace et les feuilles se brisent ; un coffre garde son contenu."],
    ['✋ Deuxième main et 🛡 bouclier', "La case « main secondaire » est à côté des cases d'armure dans l'inventaire (X échange les deux mains ; elle apparaît à gauche de la barre d'objets, touche-la sur téléphone pour échanger). Une torche en main secondaire éclaire en permanence ; avec un outil ou une épée en main, le clic droit pose le bloc de la main secondaire (torches, blocs de construction…). Bouclier : 6 planches + 1 lingot de fer à l'Établi. Maintiens le clic droit pour le lever (on marche plus lentement) : il arrête tous les coups venus de devant — Ombres, sangliers, flèches, autres joueurs et même les explosions — et repousse l'assaillant. Il s'use à chaque coup arrêté (336 de durabilité)."],
    ['🔴 Redstone', "Comme dans Minecraft. La poudre de redstone se pose au sol et transporte le courant sur 15 blocs. Sources : levier, boutons (pierre 1 s, bois 1,5 s, aussi touché par une flèche), plaques de pression (pierre, bois, or et fer selon le poids), torche de redstone (inverseur), bloc de redstone, capteur de lumière du jour, crochet et fil de déclenchement, cible (plus la flèche est au centre, plus le signal est fort), capteur de sculk (pas de tous les joueurs et des créatures, blocs posés ou cassés ; pas accroupi : silencieux), coffre piégé (quand on l'ouvre), rail détecteur. Composants : répéteur (délai 1 à 4, clic droit ; verrouillable par le côté), comparateur (comparer / soustraire, lit le remplissage des coffres), observateur, pistons et pistons collants (12 blocs, slime et miel collent), distributeur (tire des flèches, pose l'eau, lance les wagonnets…), dropper, entonnoir, lampe, ampoule de cuivre (s'allume et s'éteint à chaque impulsion), portes et trappes en fer (seulement par la redstone), bloc musical, TNT. Recettes : catégorie Redstone."],
    ['🛤 Rails et wagonnets', "Pose des rails (ils tournent et montent tout seuls d'après leurs voisins). Wagonnet : clic droit sur un rail pour le poser, clic droit dessus pour monter, accroupi pour descendre, « avancer » pour le pousser un peu. Le rail de propulsion alimenté accélère (éteint, il freine), le rail détecteur émet un signal quand un wagonnet passe, le rail activateur fait exploser le wagonnet de TNT et descendre le passager. Wagonnets de stockage (27 cases) et à entonnoir (aspire objets et coffres au-dessus) ; frappe un wagonnet pour le récupérer."],
    ['🏹 Arc et flèches', "Arc : 3 bâtons + 3 ficelles (la ficelle vient des fibres). Maintiens le clic droit pour bander (1 s = pleine puissance), relâche pour tirer. Les flèches plantées se ramassent. Flèches : silex + bâton + plume."],
    ['⚡ Électricité (extension)', "À cocher en créant le monde. Nouveaux minerais : zinc, étain, bauxite (aluminium) et lithium tout au fond. Fabrique un Établi d'ingénieur pour les recettes. Un réseau = des blocs électriques qui se touchent, reliés par des câbles. Générateurs : panneau solaire (le jour), éolienne (plus elle est haute, plus elle produit), roue à eau (de l'eau autour), générateur à charbon (charbon, bois, bâtons), manivelle (clic droit). Batterie : stocke l'énergie (5 niveaux). Machines : lampes et néons de 8 couleurs, broyeur (1 minerai → 2 poudres, pierre → gravier → sable), four électrique (sans charbon), foreuse (creuse un tunnel de 2 blocs de haut et avance toute seule ; clic droit pour vider sa récolte ; donne-lui des câbles et elle les pose derrière elle pour rester branchée ; sinon elle continue sur sa réserve d'énergie ; un coffre collé derrière la rend fixe), tapis roulant (transporte et remplit le coffre au bout), ventilateur (souffle jusqu'à 8 blocs, vers le haut il fait voler). Un signal de redstone arrête une machine. Multimètre : état du réseau ; clé à molette : tourner une machine, accroupi pour la démonter. Et aussi : panneau solaire avancé (8 ⚡/s), générateur géothermique (4 ⚡/s par bloc de lave qui le touche), bobine Tesla (foudroie les Ombres à 8 blocs), ascenseur électrique (saute pour monter au suivant, accroupis-toi pour descendre), aspirateur (ramasse les objets à 6 blocs), moissonneuse automatique (récolte et replante les cultures mûres à 4 blocs), lampadaire. Outils rechargeables au Chargeur : perceuse électrique (pioche + pelle très rapides), tronçonneuse (abat l'arbre entier), lampe torche (éclaire fort, même en main secondaire), pistolet laser (clic droit, 32 blocs, 8 dégâts)."],
    ['💡 Lumière réaliste (extension)', "Chaque lumière a sa couleur : torches orangées, redstone rouge, néons colorés, lanternes des âmes bleues, lave, portail violet… Les flammes vacillent, les lampes ont un halo la nuit, les torches fument, et la lumière des torches s'ajoute à celle du jour (un coin sombre s'éclaire même en plein jour). Se désactive dans Options > Graphismes."],
    ['🗿 Golem de fer', "Il garde les villages et écrase les Ombres. Construis le tien : 2 blocs de fer l'un sur l'autre, 1 bloc de fer de chaque côté en haut (un T), puis une citrouille par-dessus. Il patrouille autour de l'endroit où tu l'as construit. Attention : il se venge si tu le frappes, lui ou un villageois."],
    ['🐗 Faune', "Mouflons dans les prairies (laine, viande), sangliers dans les forêts (cuir ; ils chargent si on les attaque !), pingouins sur la neige (plumes pour l'Amulette de plume)."],
    ["☀ Le Cœur d'aube", "Le but final : forge le Cœur d'aube (4 éclats célestes, 4 essences d'ombre, 4 cristaux, 2 lingots de fer) et pose-le. Il chasse les Ombres alentour pour toujours."],
  ];

  const OBJECTIVES = [
    { t: 'Coupe du bois', d: 'Maintiens le clic gauche sur un tronc d’arbre pour récolter 3 bûches.', done: (g) => CM.TAGS.logs.reduce((n, id) => n + (g.stats.mined[id] || 0), 0) >= 3 },
    { t: 'Fabrique un établi', d: 'Ouvre l’inventaire (E) : bûches → planches, puis établi.', done: (g) => g.crafted(CM.B.TABLE) },
    { t: 'Ta première pioche', d: 'Pose l’établi (clic droit) et fabrique une pioche en bois à côté.', done: (g) => g.crafted(I.PICKAXE_1) },
    { t: 'L’âge de pierre', d: 'Mine de la pierre (tu obtiens des galets) et fabrique une pioche en pierre.', done: (g) => g.crafted(I.PICKAXE_2) },
    { t: 'Lumière contre les Ombres', d: 'Trouve du charbon et fabrique des torches. Les Ombres fuient la lumière.', done: (g) => g.crafted(CM.B.TORCH) },
    { t: 'La forge', d: 'Fabrique une forge (8 galets) près de l’établi.', done: (g) => g.crafted(CM.B.FORGE) || g.crafted(CM.B.FURNACE) },
    { t: 'Le fer', d: 'Mine du minerai de fer (pioche en pierre) et fonds-le à la forge.', done: (g) => g.crafted(I.IRON_INGOT) },
    { t: 'Le grappin', d: 'Herbes hautes → fibres → cordes. Puis grappin : 3 lingots + 2 cordes.', done: (g) => g.crafted(I.GRAPPLE) },
    { t: 'Les profondeurs', d: 'Descends sous la couche 20 et mine du cristal avec une pioche en fer.', done: (g) => (g.stats.mined[CM.B.CRYSTAL_ORE] || 0) >= 1 },
    { t: 'Chasseur d’Ombres', d: 'Vaincs une Ombre (la nuit ou dans une grotte sombre) pour son essence.', done: (g) => (g.stats.kills.ombre || 0) >= 1 },
    { t: 'Vers les îles célestes', d: 'Monte sur une île flottante et mine un éclat céleste.', done: (g) => (g.stats.mined[CM.B.SHARD_ORE] || 0) >= 1 },
    { t: 'Le Cœur d’aube', d: 'Forge le Cœur d’aube et pose-le pour chasser les Ombres.', done: (g) => (g.stats.placed[CM.B.DAWN_HEART] || 0) >= 1 },
  ];
  CM.OBJECTIVES = OBJECTIVES;

  // Petites icônes pixel-art du HUD (cœurs, cuisses, bulles).
  function pixIcon(rows, pal) {
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    const ctx = c.getContext('2d');
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const col = pal[rows[y][x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    return c.toDataURL();
  }
  const HEART = ['.xx...xx.', 'xhhx.xrrx', 'xhrrxrrrx', 'xrrrrrrrx', '.xrrrrrx.', '..xrrrx..', '...xrx...', '....x....'];
  function heartIcon(kind) {
    const rows = HEART.map((row) => row.split('').map((ch, x) => (ch === 'x' || ch === '.' ? ch : kind === 'full' || (kind === 'half' && x < 5) ? ch : 'e')).join(''));
    return pixIcon(rows, { x: '#1a0a0a', h: '#ff9a9a', r: '#e0263a', e: '#3a1c22' });
  }
  const DRUM = ['.....xxx.', '....xmmmx', '...xmhmmx', '...xmmmmx', '..xxmmmx.', '.xbxxxx..', 'xbx......', '.x.......'];
  function foodIcon(kind) {
    const rows = DRUM.map((row) => row.split('').map((ch, x) => (ch === 'x' || ch === '.' ? ch : kind === 'full' || (kind === 'half' && x >= 4) ? ch : 'e')).join(''));
    return pixIcon(rows, { x: '#1a0e06', m: '#b5652b', h: '#e39a55', b: '#eee4d0', e: '#3b2518' });
  }
  // icône de protection (un plastron) : 2 points d'armure par icône, comme dans Minecraft
  const CHEST_ICON = ['.xx...xx.', 'xhwx.xwwx', 'xwwwxwwsx', 'xwwwwwwsx', '.xwwwwsx.', '.xwwwwsx.', '.xwwwwsx.', '.xxxxxxx.'];
  function armorIcon(kind) {
    const rows = CHEST_ICON.map((row) => row.split('').map((ch, x) => (ch === 'x' || ch === '.' ? ch : kind === 'full' || (kind === 'half' && x < 5) ? ch : 'e')).join(''));
    return pixIcon(rows, { x: '#16181f', h: '#ffffff', w: '#c9ced8', s: '#8b919e', e: '#2c3040' });
  }
  const durColor = (k) => 'hsl(' + Math.round(k * 120) + ', 85%, 48%)';
  const BUBBLE = ['..xxx..', '.xhwwx.', 'xhwwwwx', 'xwwwwwx', 'xwwwwwx', '.xwwwx.', '..xxx..'];
  const bubbleIcon = (kind) => pixIcon(kind === 'pop' ? ['.......', '..x.x..', '.x...x.', '.......', '.x...x.', '..x.x..', '.......'] : BUBBLE, { x: '#1d4a8a', h: '#ffffff', w: '#8fd0ff' });

  // --------------------------------------------------------- Options ---
  const pct = (v) => v + ' %';
  const OPTION_TABS = [
    ['graph', 'Graphismes', [
      { k: 'renderDist', t: 'range', label: "Distance d'affichage", min: 3, max: 16, step: 1, fmt: (v) => v + ' tronçons (' + v * 16 + ' blocs)' },
      { k: 'fov', t: 'range', label: 'Champ de vision', min: 50, max: 110, step: 1, fmt: (v) => v + '°' },
      { k: 'brightness', t: 'range', label: 'Luminosité', min: 0, max: 100, step: 5, fmt: (v) => (v <= 5 ? 'Sombre' : v >= 95 ? 'Très lumineux' : v + ' %') },
      { k: 'resolution', t: 'range', label: 'Résolution de rendu', min: 40, max: 100, step: 5, fmt: pct, note: 'Baisse-la si le jeu rame.' },
      { k: 'maxFps', t: 'select', label: 'Images par seconde max', opts: [[0, 'Illimitées'], [30, '30'], [60, '60'], [120, '120']] },
      { k: 'particles', t: 'select', label: 'Particules', opts: [[2, 'Toutes'], [1, 'Réduites'], [0, 'Aucune']] },
      { k: 'smoothLight', t: 'check', label: 'Éclairage doux et ombres dans les coins' },
      { k: 'realLight', t: 'check', label: 'Lumière réaliste (couleurs, flammes qui vacillent, halos)', note: 'Extension Lumière réaliste : sans effet dans un monde créé avec l’extension décochée.' },
      { k: 'halos', t: 'check', label: 'Halos autour des lampes et des torches (lumière réaliste)' },
      { k: 'waving', t: 'check', label: 'Feuillage et plantes qui ondulent au vent' },
      { k: 'clouds', t: 'check', label: 'Nuages' },
      { k: 'viewBob', t: 'check', label: 'Balancement de la vue en marchant' },
      { k: 'dynFov', t: 'check', label: 'Champ de vision dynamique (course, ruée)' },
      { k: 'showHand', t: 'check', label: 'Afficher la main et l’objet tenu' },
    ]],
    ['ctrl', 'Contrôles', [
      { k: 'sens', t: 'range', label: 'Sensibilité de la souris', min: 0.2, max: 3, step: 0.1, fmt: (v) => (+v).toFixed(1) },
      { k: 'invertY', t: 'check', label: "Inverser l'axe vertical" },
      { k: 'toggleSprint', t: 'check', label: 'Course : un appui suffit (au lieu de maintenir la touche)' },
      { k: 'autoJump', t: 'check', label: 'Saut automatique devant une marche' },
      { k: 'touchControls', t: 'select', label: 'Contrôles tactiles (téléphone, tablette)', opts: [['auto', 'Automatiques (écran tactile détecté)'], ['on', 'Toujours activés'], ['off', 'Désactivés']] },
      { k: 'touchSens', t: 'range', label: 'Sensibilité tactile (caméra)', min: 0.3, max: 3, step: 0.1, fmt: (v) => (+v).toFixed(1) },
      { k: 'touchSize', t: 'range', label: 'Taille des boutons tactiles', min: 70, max: 150, step: 5, fmt: pct },
      { k: 'touchAim', t: 'select', label: 'Visée tactile (toucher et appui long)', opts: [['finger', 'Au doigt : sur le bloc touché'], ['center', 'Au centre de l’écran (réticule)']] },
      { k: 'touchOpacity', t: 'range', label: 'Opacité des boutons tactiles', min: 20, max: 100, step: 5, fmt: pct },
      {
        t: 'button', label: 'Disposer les boutons tactiles…', note: 'Place chaque bouton où tu veux, change sa taille et son opacité, ou masque-le.',
        run: (g, ui) => {
          ui.hide('options');
          g.touch.openEditor(() => {
            ui.show('options');
            ui.renderOptions();
          });
        },
      },
      { t: 'binds' },
    ]],
    ['game', 'Jeu', [
      { t: 'world' },
      { k: 'dayLength', t: 'select', label: "Durée d'une journée", opts: [[5, '5 minutes'], [10, '10 minutes'], [20, '20 minutes'], [40, '40 minutes']] },
      { k: 'keepInventory', t: 'check', label: "Garder l'inventaire à la mort" },
      { k: 'fireSpread', t: 'check', label: 'Le feu se propage (bois, feuilles, laine, herbes…)', note: 'Désactivé : le feu reste là où on l’allume et brûle sans rien détruire.' },
      { k: 'showQuests', t: 'check', label: 'Afficher le guide (objectifs à l’écran)' },
      { k: 'autosave', t: 'select', label: 'Sauvegarde automatique', opts: [[30, 'Toutes les 30 s'], [45, 'Toutes les 45 s'], [120, 'Toutes les 2 min'], [300, 'Toutes les 5 min']] },
    ]],
    ['audio', 'Audio', [
      { k: 'volume', t: 'range', label: 'Volume général', min: 0, max: 100, step: 1, fmt: pct },
      { k: 'sfxVolume', t: 'range', label: 'Blocs et actions', min: 0, max: 100, step: 1, fmt: pct },
      { k: 'mobVolume', t: 'range', label: 'Créatures', min: 0, max: 100, step: 1, fmt: pct },
      { k: 'uiVolume', t: 'range', label: 'Interface', min: 0, max: 100, step: 1, fmt: pct },
    ]],
    ['ui', 'Interface', [
      { k: 'guiScale', t: 'range', label: "Taille de l'interface", min: 70, max: 140, step: 5, fmt: pct },
      { k: 'crosshair', t: 'select', label: 'Réticule', opts: [['cross', 'Croix'], ['dot', 'Point'], ['circle', 'Cercle'], ['none', 'Aucun']] },
      { k: 'toasts', t: 'select', label: 'Notifications', opts: [[2, 'Toutes'], [1, 'Importantes seulement'], [0, 'Aucune']] },
      { k: 'showCoords', t: 'check', label: 'Afficher les coordonnées' },
      { k: 'showFps', t: 'check', label: 'Afficher les images par seconde' },
      { k: 'showBiome', t: 'check', label: 'Afficher le nom du biome' },
      { k: 'itemNames', t: 'check', label: "Afficher le nom de l'objet en main" },
    ]],
  ];
  const BIND_LABELS = {
    forward: 'Avancer', back: 'Reculer', left: 'Aller à gauche', right: 'Aller à droite', jump: 'Sauter / nager / monter (vol)',
    sprint: 'Courir', sneak: "S'accroupir / descendre (vol)", dash: 'Ruée', inventory: 'Inventaire', drop: "Jeter l'objet", swap: 'Échanger les deux mains',
  };
  const MODE_NAMES = { survival: 'Survie', creative: 'Créatif' };
  const DIFF_NAMES = { peaceful: 'Paisible', easy: 'Facile', normal: 'Normale', hard: 'Difficile' };
  const TYPE_NAMES = { normal: 'Normal', amplified: 'Amplifié', flat: 'Plat', islands: 'Archipel' };

  // Catégorie d'un bloc/objet pour l'inventaire créatif.
  function creativeCat(id) {
    const info = CM.itemInfo(id);
    if (info && info.ext === 'tech') return 'tech';
    if (id >= CM.ITEM_BASE) return info && (info.type === 'cart' || info.id === CM.I.STRING) ? 'redstone' : 'items';
    const b = CM.blocks[id];
    if (b.ext === 'tech') return 'tech';
    if (b.rs && b.rs.k !== 'door' && b.rs.k !== 'note' && b.rs.k !== 'tnt') return 'redstone';
    for (const f of Object.keys(CM.COLOR)) if (Object.values(CM.COLOR[f]).includes(id)) return 'color';
    if (b.plant || b.wood && b.id === CM.woodOf(id).leaves || b.soil || b.farmland || /CORAL|SNOW|ICE|MUSHROOM|CACTUS|MELON|PUMPKIN|SAND|GRAVEL|CLAY|MUD|MOSS|DIRT/.test(b.key) && !/SANDSTONE|BRICK/.test(b.key)) return 'nature';
    if (b.ore || /_BLOCK$/.test(b.key) && /IRON|GOLD|COPPER|DIAMOND|EMERALD|LAPIS|REDSTONE|NETHERITE|RUBY|CRYSTAL|COAL|AMETHYST|RAW/.test(b.key) || /COPPER/.test(b.key)) return 'ores';
    if (b.light || b.station || b.container || b.tnt || b.note || b.render === 'glass' || b.render === 'torch' || /TABLE|LOOM|JUKEBOX|TARGET|DISPENSER|DROPPER|OBSERVER|BOOKSHELF|BEEHIVE|SPONGE|HAY|SLIME|HONEY/.test(b.key)) return 'deco';
    return 'build';
  }

  class UI {
    constructor(game) {
      this.game = game;
      this.cursor = null;
      this.invOpen = false;
      this.tab = 'craft';
      this.filter = 'tout';
      this.onlyCan = false;
      this.search = '';
      this.cSearch = '';
      this.cCat = 'all';
      this.toastKeys = new Map();
      this.dirtyInv = true;
      this.lastHealth = -1;
      this.lastFood = -1;
      this.lastAir = -1;
      this.lastSel = -1;
      this.itemNameT = 0;
      this.stations = {};
      this.bindWaiting = null;
      this.optTab = 'graph';
      this.hearts = { full: heartIcon('full'), half: heartIcon('half'), empty: heartIcon('empty') };
      this.foods = { full: foodIcon('full'), half: foodIcon('half'), empty: foodIcon('empty') };
      this.bubbles = { full: bubbleIcon('full'), pop: bubbleIcon('pop') };
      this.armorIcons = { full: armorIcon('full'), half: armorIcon('half'), empty: armorIcon('empty') };
      this.buildHUD();
      this.buildInventory();
      this.buildGuide();
      this.buildNewWorld();
      $('inv-close').addEventListener('click', () => this.closeInventory());
      const toggle = (id, key) => $(id).addEventListener('click', () => {
        this[key] = !this[key];
        $(id).classList.toggle('on', this[key]);
      });
      toggle('inv-quick', 'quickMode');
      toggle('inv-half', 'halfMode');
      $('btn-opt-reset').addEventListener('click', () => {
        if (!confirm('Remettre toutes les options (et les touches) par défaut ?')) return;
        Object.assign(this.game.options, CM.DEFAULT_OPTIONS, { binds: null });
        if (CM.isTouchDevice()) CM.applyMobileDefaults(this.game.options);
        this.game.binds = Object.assign({}, CM.DEFAULT_BINDS);
        this.game.applyOptions();
        this.renderOptions();
      });
    }

    // ------------------------------------------------------------- HUD --
    buildHUD() {
      const hb = $('hotbar');
      hb.innerHTML = '';
      this.hotSlots = [];
      for (let i = 0; i < 9; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        hb.appendChild(s);
        this.hotSlots.push(s);
      }
      const mk = (id, n) => {
        const el = $(id);
        el.innerHTML = '';
        const out = [];
        for (let i = 0; i < n; i++) out.push(el.appendChild(document.createElement('i')));
        return out;
      };
      this.heartEls = mk('hearts', 10);
      this.armorEls = mk('armor', 10);
      this.lastArmor = -1;
      this.armorSig = null;
      this.foodEls = mk('food', 10);
      this.airEls = mk('air', 10);
    }

    slotHTML(s, keyNum) {
      if (!s) return keyNum ? '<span class="key">' + keyNum + '</span>' : '';
      const icon = CM.Textures.icons[s.id];
      let h = '<div class="icon" style="background-image:url(' + icon + ')"></div>';
      if (s.ench) h += '<div class="glint" style="-webkit-mask-image:url(' + icon + ');mask-image:url(' + icon + ')"></div>';
      if (s.count > 1) h += '<span class="count">' + s.count + '</span>';
      const wi = s.xp !== undefined && CM.itemInfo(s.id);
      if (wi && wi.charge) {
        // objet électrique : barre de charge bleue
        const k = CM.chargeLeft(s) / wi.charge;
        h += '<div class="dur"><div style="width:' + Math.round(k * 100) + '%;background:' + (k > 0.25 ? '#4fc3ff' : '#ff8a4f') + '"></div></div>';
      } else if (wi && (wi.type === 'armor' || wi.type === 'shield')) {
        // armure : barre de durabilité (dès qu'elle est entamée), du vert au rouge
        if (s.xp > 0) {
          const k = Math.max(0, 1 - s.xp / wi.maxDur);
          h += '<div class="dur"><div style="width:' + Math.round(k * 100) + '%;background:' + durColor(k) + '"></div></div>';
        }
      } else if (s.xp !== undefined) {
        const lvl = CM.masteryLevel(s.xp);
        h += '<span class="stars">' + '★'.repeat(lvl) + '</span>';
        if (lvl < 5) {
          const a = CM.MASTERY_XP[lvl - 1], b = CM.MASTERY_XP[lvl];
          h += '<div class="xp"><div style="width:' + Math.round(((s.xp - a) / (b - a)) * 100) + '%"></div></div>';
        }
      }
      return h;
    }

    renderHotbar() {
      const inv = this.game.inventory;
      const oh = $('offhand-hud');
      oh.classList.toggle('hidden', !inv.offhand);
      if (inv.offhand) oh.innerHTML = this.slotHTML(inv.offhand);
      for (let i = 0; i < 9; i++) {
        this.hotSlots[i].innerHTML = this.slotHTML(inv.slots[i]);
        this.hotSlots[i].classList.toggle('sel', i === inv.selected);
      }
    }

    showTouchHint() {
      const h = $('t-hint');
      h.classList.remove('hidden');
      clearTimeout(this.hintT);
      this.hintT = setTimeout(() => h.classList.add('hidden'), 7000);
    }

    // Appelé au lancement d'une partie.
    worldStarted() {
      this.lastObj = undefined;
      this.lastHealth = this.lastFood = this.lastAir = -1;
      this.updateObjective();
      this.optionsChanged();
      const creative = this.game.mode === 'creative';
      $('tab-btn-creative').classList.toggle('hidden', !creative);
      // extensions du monde : catégories visibles seulement si elles sont actives
      for (const el of document.querySelectorAll('.ext-tech')) el.classList.toggle('hidden', !CM.extOn('tech'));
      if (!CM.extOn('tech') && this.filter === 'tech') this.filter = 'tout';
      if (!creative && this.tab === 'creative') this.setTab('craft');
      if (creative && this.tab === 'craft') this.setTab('creative');
    }
    optionsChanged() {
      const g = this.game, K = g.binds, kn = (a) => '<b>' + esc(g.keyName(K[a])) + '</b>';
      $('ab-dash-key').textContent = g.keyName(K.dash);
      $('start-keys').innerHTML =
        '<div>' + kn('forward') + kn('left') + kn('back') + kn('right') + ' se déplacer</div>' +
        '<div>' + kn('jump') + ' sauter · ' + kn('sprint') + ' courir</div>' +
        '<div>' + kn('dash') + ' ruée · ' + kn('inventory') + ' inventaire &amp; fabrication</div>' +
        '<div><b>Clic gauche</b> miner / frapper</div>' +
        '<div><b>Clic droit</b> poser / utiliser / manger</div>' +
        '<div><b>1-9 / molette</b> barre rapide · ' + kn('swap') + ' changer de main · <b>Échap</b> pause</div>';
      if (this.game.player) this.lastHealth = this.lastFood = -1;
      if ($('options').classList.contains('hidden') === false) this.renderOptions();
    }

    update(dt) {
      const g = this.game, p = g.player, inv = g.inventory, o = g.options;
      const creative = g.mode === 'creative';
      if (this.dirtyInv) {
        this.dirtyInv = false;
        this.renderHotbar();
        if (this.invOpen) this.renderInventory();
        $('ab-double').classList.toggle('hidden', !inv.has(I.FEATHER_CHARM) || creative);
      }
      if (inv.selected !== this.lastSel) {
        this.lastSel = inv.selected;
        this.renderHotbar();
        const s = inv.held();
        $('item-name').textContent = s ? CM.itemName(s.id) : '';
        $('item-name').style.opacity = s && o.itemNames ? 1 : 0;
        this.itemNameT = 2;
      }
      if (this.itemNameT > 0) {
        this.itemNameT -= dt;
        if (this.itemNameT <= 0) $('item-name').style.opacity = 0;
      }
      // cœurs, faim, bulles (cachés en créatif)
      $('hearts').classList.toggle('hidden', creative);
      $('food').classList.toggle('hidden', creative);
      const hp = Math.ceil(p.health);
      const nHearts = p.maxHealth / 2;
      if (nHearts !== this.heartEls.length) {
        const he = $('hearts');
        while (this.heartEls.length < nHearts) this.heartEls.push(he.appendChild(document.createElement('i')));
        while (this.heartEls.length > nHearts) he.removeChild(this.heartEls.pop());
        this.lastHealth = -1;
      }
      if (hp !== this.lastHealth) {
        this.lastHealth = hp;
        for (let i = 0; i < nHearts; i++) {
          const v = hp - i * 2;
          this.heartEls[i].style.backgroundImage = 'url(' + (v >= 2 ? this.hearts.full : v === 1 ? this.hearts.half : this.hearts.empty) + ')';
        }
        $('hearts').classList.toggle('low', hp <= 6 && hp > 0);
      }
      this.updateArmorHUD(creative);
      // expérience : barre verte et niveau au-dessus de la barre d'objets (comme dans Minecraft)
      const li = p.levelInfo();
      $('xpbar').classList.toggle('hidden', creative);
      if (li.level !== this.lastLvl || li.left !== this.lastXpLeft) {
        this.lastLvl = li.level;
        this.lastXpLeft = li.left;
        $('xp-fill').style.width = (li.frac * 100).toFixed(1) + '%';
        $('xp-level').textContent = li.level > 0 ? li.level : '';
      }
      const food = Math.ceil(p.food);
      if (food !== this.lastFood) {
        this.lastFood = food;
        for (let i = 0; i < 10; i++) {
          const v = food - (9 - i) * 2; // se vide de gauche à droite comme dans Minecraft
          this.foodEls[i].style.backgroundImage = 'url(' + (v >= 2 ? this.foods.full : v === 1 ? this.foods.half : this.foods.empty) + ')';
        }
      }
      $('food').classList.toggle('low', food <= 6);
      $('food').classList.toggle('shake', p.sat <= 0 && food <= 6);
      const showAir = p.headInWater || p.air < 14.9;
      $('air').classList.toggle('hidden', !showAir || creative);
      const air = Math.ceil((p.air / 15) * 10);
      if (showAir && air !== this.lastAir) {
        this.lastAir = air;
        for (let i = 0; i < 10; i++) {
          const k = 9 - i;
          this.airEls[i].style.backgroundImage = k < air ? 'url(' + this.bubbles.full + ')' : k === air ? 'url(' + this.bubbles.pop + ')' : 'none';
        }
      }
      $('ab-dash').classList.toggle('cool', p.dashCd > 0 || !p.canSprint());
      $('ab-dash').classList.toggle('hidden', p.flying);
      $('ab-fly').classList.toggle('hidden', !p.flying);
      // combo
      const combo = $('combo');
      if (p.combo >= 2) {
        combo.classList.remove('hidden');
        if (this.lastCombo !== p.combo) {
          $('combo-text').textContent = 'COMBO x' + p.combo;
          combo.classList.remove('pulse');
          void combo.offsetWidth;
          combo.classList.add('pulse');
        }
        $('combo-fill').style.width = (p.comboTimer / 2.4) * 100 + '%';
      } else combo.classList.add('hidden');
      this.lastCombo = p.combo;
      // effets
      $('vignette').style.opacity = Math.min(1, p.hurtFlash * 2 + (p.health <= 4 && p.alive && !creative ? 0.35 + Math.sin(g.clock * 5) * 0.15 : 0));
      $('hud').classList.toggle('burning', p.burning > 0);
      const pf = Math.min(0.9, (p.portalT || 0) / p.portalTime());
      if (pf !== this.portalFx) $('portal-fx').style.opacity = (this.portalFx = pf);
      $('water-overlay').style.opacity = p.headInWater ? 1 : 0;
      // horloge, biome, coordonnées
      this.clockT = (this.clockT || 0) - dt;
      if (this.clockT <= 0) {
        this.clockT = 0.25;
        const night = g.daylight < 0.35;
        const hours = Math.floor(((g.time + 0.25) % 1) * 24) % 24;
        const hh = String(hours).padStart(2, '0');
        let h = (night ? '<span class="danger">☾ Nuit ' : '<span>☀ Jour ') + (g.dayCount + 1) + '</span> · ' + hh + 'h';
        if (o.showBiome) h += '<div class="biome">' + g.world.biomeName(p.x, p.z) + (g.world.villageNear(p.x, p.z, 0) ? ' · Village' : '') + '</div>';
        if (o.showCoords) h += '<div class="biome">X ' + Math.floor(p.x) + ' · Y ' + Math.floor(p.y) + ' · Z ' + Math.floor(p.z) + '</div>';
        if (o.showFps) h += '<div class="biome">' + Math.round(g.fps) + ' images/s</div>';
        if (creative) h += '<div class="biome gold">Mode créatif</div>';
        $('clock').innerHTML = h;
        this.updateObjective();
        if (this.invOpen) {
          this.refreshStations();
          this.renderVitals();
        }
      }
      if (this.debug) this.updateDebug();
    }

    updateObjective() {
      const g = this.game;
      let idx = OBJECTIVES.findIndex((o) => !o.done(g));
      const done = idx < 0 ? OBJECTIVES.length : idx;
      if (this.lastObj !== undefined && done > this.lastObj) {
        const o = OBJECTIVES[this.lastObj];
        if (o && o.done(g) && g.options.showQuests) {
          this.toast('Objectif accompli : ' + o.t, 'good');
          CM.Audio.play('objective');
          $('objective').classList.remove('flash');
          void $('objective').offsetWidth;
          $('objective').classList.add('flash');
        }
      }
      this.lastObj = done;
      $('obj-count').textContent = '(' + done + '/' + OBJECTIVES.length + ')';
      if (idx < 0) {
        $('obj-title').textContent = 'Toutes les quêtes sont accomplies !';
        $('obj-desc').textContent = 'Le monde est à toi. Construis, explore, affronte la nuit.';
      } else {
        $('obj-title').textContent = OBJECTIVES[idx].t;
        $('obj-desc').textContent = OBJECTIVES[idx].d;
      }
    }

    toggleDebug() {
      this.debug = !this.debug;
      $('debug').classList.toggle('hidden', !this.debug);
    }
    toggleHud() {
      $('hud').classList.toggle('bare');
    }
    updateDebug() {
      const g = this.game, p = g.player, w = g.world;
      const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
      const t = p.target;
      $('debug').textContent =
        'FPS ' + g.fps.toFixed(0) + ' · graine ' + w.seed + '\n' +
        'XYZ ' + p.x.toFixed(1) + ' / ' + p.y.toFixed(1) + ' / ' + p.z.toFixed(1) + '\n' +
        'Biome ' + w.biomeName(p.x, p.z) + '\n' +
        'Lumière ciel ' + w.skyAt(fx, fy + 1, fz) + ' · bloc ' + w.blockLightAt(fx, fy + 1, fz) + '\n' +
        'Tronçons ' + w.chunks.size + ' · sections ' + g.renderer.stats.drawn + ' · faces ' + g.renderer.stats.quads + '\n' +
        'Créatures ' + g.entities.mobs.length + ' · objets ' + g.entities.drops.length + ' · particules ' + g.entities.particles.length + '\n' +
        'Faim ' + p.food + ' · saturation ' + p.sat.toFixed(1) + ' · épuisement ' + p.exh.toFixed(2) + '\n' +
        'Visée ' + (t ? CM.blocks[t.id].name + ' (' + t.x + ',' + t.y + ',' + t.z + ')' : '—') + '\n' +
        'Heure ' + g.time.toFixed(3) + ' · lumière du jour ' + g.daylight.toFixed(2);
    }

    toast(msg, type, key) {
      const level = this.game.options.toasts;
      if (level === 0) return;
      if (level === 1 && type !== 'warn' && type !== 'gold') return;
      const k = key || msg;
      const now = performance.now();
      if (this.toastKeys.has(k) && now - this.toastKeys.get(k) < 3500) return;
      this.toastKeys.set(k, now);
      const box = $('toasts');
      const el = document.createElement('div');
      el.className = 'toast ' + (type || '');
      el.textContent = msg;
      box.appendChild(el);
      while (box.children.length > 4) box.removeChild(box.firstChild);
      setTimeout(() => el.classList.add('fade'), 2600);
      setTimeout(() => el.remove(), 3200);
    }

    pickup(id, n) {
      const box = $('pickups');
      const last = box.lastElementChild;
      if (last && last.dataset.id === String(id) && !last.classList.contains('fade')) {
        last.dataset.n = +last.dataset.n + n;
        last.querySelector('span').textContent = '+' + last.dataset.n + ' ' + CM.itemName(id);
        clearTimeout(last._t);
        last._t = setTimeout(() => this.fadePickup(last), 1800);
        return;
      }
      const el = document.createElement('div');
      el.className = 'pickup';
      el.dataset.id = id;
      el.dataset.n = n;
      el.innerHTML = '<i style="background-image:url(' + CM.Textures.icons[id] + ')"></i><span>+' + n + ' ' + esc(CM.itemName(id)) + '</span>';
      box.appendChild(el);
      while (box.children.length > 6) box.removeChild(box.firstChild);
      el._t = setTimeout(() => this.fadePickup(el), 1800);
    }
    fadePickup(el) {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 600);
    }

    // ------------------------------------------------------ inventaire --
    buildInventory() {
      const main = $('inv-main'), hot = $('inv-hot');
      main.innerHTML = '';
      hot.innerHTML = '';
      this.invSlots = [];
      const mk = (i, parent) => {
        const s = document.createElement('div');
        s.className = 'slot';
        s.dataset.i = i;
        s.addEventListener('pointerdown', (e) => this.slotClick(this.game.inventory.slots, i, e, 'inv'));
        s.addEventListener('mouseenter', (e) => this.showTip(this.game.inventory.slots[i], e));
        s.addEventListener('mouseleave', () => this.hideTip());
        parent.appendChild(s);
        this.invSlots[i] = s;
      };
      for (let i = 9; i < 36; i++) mk(i, main);
      for (let i = 0; i < 9; i++) mk(i, hot);
      $('ench-slot').addEventListener('pointerdown', (e) => this.enchClick(e));
      for (const k of ['a', 'b']) {
        $('anvil-' + k).addEventListener('pointerdown', (e) => this.anvilClick(k, e));
        $('anvil-' + k).addEventListener('mouseenter', (e) => this.anvil && this.showTip(this.anvil[k], e));
        $('anvil-' + k).addEventListener('mouseleave', () => this.hideTip());
      }
      $('anvil-out').addEventListener('mouseenter', (e) => {
        const r = this.anvil && CM.anvilResult(this.anvil.a, this.anvil.b);
        if (r && r.out) this.showTip(r.out, e);
      });
      $('anvil-out').addEventListener('mouseleave', () => this.hideTip());
      this.tapOrPress($('anvil-go'), () => this.doAnvil());
      $('ench-slot').addEventListener('mouseenter', (e) => this.ench && this.showTip(this.ench.item, e));
      $('ench-slot').addEventListener('mouseleave', () => this.hideTip());
      // cases d'armure : casque, plastron, jambières, bottes
      const ar = $('inv-armor');
      ar.innerHTML = '';
      this.armorSlots = [];
      for (let k = 0; k < 4; k++) {
        const s = document.createElement('div');
        s.className = 'slot armor-slot';
        s.title = CM.ARMOR_PIECES[k][1];
        s.addEventListener('pointerdown', (e) => this.armorClick(k, e));
        s.addEventListener('mouseenter', (e) => this.showTip(this.game.inventory.armor[k], e));
        s.addEventListener('mouseleave', () => this.hideTip());
        ar.appendChild(s);
        this.armorSlots.push(s);
      }
      // main secondaire (bouclier, torche, blocs…)
      const oh = document.createElement('div');
      oh.className = 'slot armor-slot offhand-slot';
      oh.title = 'Main secondaire';
      oh.addEventListener('pointerdown', (e) => this.offhandClick(e));
      oh.addEventListener('mouseenter', (e) => this.showTip(this.game.inventory.offhand, e));
      oh.addEventListener('mouseleave', () => this.hideTip());
      ar.appendChild(oh);
      this.offhandSlot = oh;
      this.tapOrPress($('offhand-hud'), () => this.game.swapHands());
      const cg = $('chest-grid');
      this.chestSlots = [];
      for (let i = 0; i < 27; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        s.addEventListener('pointerdown', (e) => this.chest && this.slotClick(this.chest, i, e, 'chest'));
        s.addEventListener('mouseenter', (e) => this.chest && this.showTip(this.chest[i], e));
        s.addEventListener('mouseleave', () => this.hideTip());
        cg.appendChild(s);
        this.chestSlots.push(s);
      }
      const inv = $('inventory');
      document.addEventListener('pointerdown', (e) => (this.lastTouch = e.pointerType === 'touch'), true);
      inv.addEventListener('contextmenu', (e) => e.preventDefault());
      const follow = (e) => {
        const c = $('cursor-stack');
        c.style.left = e.clientX + 'px';
        c.style.top = e.clientY + 'px';
        const tt = $('tooltip');
        tt.style.left = Math.min(e.clientX + 16, window.innerWidth - 300) + 'px';
        tt.style.top = e.clientY + 12 + 'px';
      };
      inv.addEventListener('pointermove', follow);
      inv.addEventListener('pointerdown', follow, true);
      // Jeter un objet en le sortant du cadre (comme dans Minecraft) : clic hors des panneaux avec un
      // objet au curseur (clic gauche : tout, clic droit ou « Moitié » : un seul), ou glisser un objet
      // pris dans une case et le relâcher dehors.
      const outside = (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        return !!el && !el.closest('.panel') && !el.closest('#tooltip');
      };
      inv.addEventListener('pointerdown', (e) => {
        if (!this.cursor || !outside(e)) return;
        e.preventDefault();
        this.throwCursor(e.button === 2 || this.halfMode ? 1 : this.cursor.count);
      });
      inv.addEventListener('pointermove', (e) => $('cursor-stack').classList.toggle('drop', !!this.cursor && outside(e)));
      document.addEventListener('pointerup', (e) => {
        const drag = this.dragPick;
        this.dragPick = null;
        if (!drag || !this.invOpen || !this.cursor || this.cursor !== drag.stack) return;
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12 && outside(e)) this.throwCursor(this.cursor.count);
      });
      document.querySelectorAll('.side-panel .tabs button').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
      document.querySelectorAll('#tab-craft .filters button').forEach((b) =>
        b.addEventListener('click', () => {
          this.filter = b.dataset.f;
          document.querySelectorAll('#tab-craft .filters button').forEach((x) => x.classList.toggle('active', x === b));
          this.renderRecipes();
        }),
      );
      const stop = (e) => e.stopPropagation();
      $('recipe-search').addEventListener('input', (e) => {
        this.search = norm(e.target.value.trim());
        this.renderRecipes();
      });
      $('recipe-search').addEventListener('keydown', stop);
      $('only-can').addEventListener('change', (e) => {
        this.onlyCan = e.target.checked;
        this.renderRecipes();
      });
      $('creative-search').addEventListener('input', (e) => {
        this.cSearch = norm(e.target.value.trim());
        this.renderCreative();
      });
      $('creative-search').addEventListener('keydown', stop);
      $('creative-cat').addEventListener('change', (e) => {
        this.cCat = e.target.value;
        this.renderCreative();
      });
      // grille créative (construite une seule fois)
      this.creativeIds = [];
      for (const b of CM.blocks) if (b && b.id && b.id !== CM.B.WATER && b.tex && !b.hidden) this.creativeIds.push(b.id);
      for (const it of CM.items) if (it) this.creativeIds.push(it.id);
      const grid = $('creative-grid');
      this.creativeEls = new Map();
      for (const id of this.creativeIds) {
        const el = document.createElement('div');
        el.className = 'slot';
        el.innerHTML = '<div class="icon" style="background-image:url(' + CM.Textures.icons[id] + ')"></div>';
        this.tapOrPress(el, (e) => this.creativeClick(id, e));
        el.addEventListener('mouseenter', (e) => this.showTip({ id, count: 1, xp: CM.hasWear(id) ? 0 : undefined }, e));
        el.addEventListener('mouseleave', () => this.hideTip());
        grid.appendChild(el);
        const info = CM.itemInfo(id);
        this.creativeEls.set(id, { el, cat: creativeCat(id), name: norm(CM.itemName(id)), ext: (info && info.ext) || null });
      }
    }

    // Souris : réagit dès l'appui. Doigt : au « clic » seulement, pour pouvoir faire
    // défiler les listes sans fabriquer ou prendre d'objet par erreur.
    tapOrPress(el, fn) {
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') fn(e);
      });
      el.addEventListener('click', (e) => {
        if (this.lastTouch) fn(e);
      });
    }

    setTab(tab) {
      this.tab = tab;
      document.querySelectorAll('.side-panel .tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
      for (const t of ['craft', 'creative', 'journal', 'guide']) $('tab-' + t).classList.toggle('hidden', t !== tab);
      if (tab === 'journal') this.renderJournal();
      if (tab === 'creative') this.renderCreative();
    }

    renderCreative() {
      let n = 0;
      for (const [, o] of this.creativeEls) {
        const show = (this.cCat === 'all' || o.cat === this.cCat) && (!this.cSearch || o.name.includes(this.cSearch)) && (!o.ext || CM.extOn(o.ext));
        o.el.classList.toggle('hidden', !show);
        if (show) n++;
      }
      $('creative-count').textContent = n + ' blocs et objets';
    }
    creativeClick(id, e) {
      e.preventDefault();
      const info = CM.itemInfo(id);
      const stack = { id, count: e.button === 2 || this.halfMode ? 1 : info.stack };
      if (CM.hasWear(id)) stack.xp = 0;
      CM.Audio.play('click');
      if (e.shiftKey || this.quickMode) {
        this.game.inventory.add(id, stack.count, CM.freshExtra(id));
        return;
      }
      if (this.cursor && this.cursor.id === id && this.cursor.count < info.stack) this.cursor.count = info.stack;
      else this.cursor = stack;
      this.renderInventory();
    }

    buildGuide() {
      const html = GUIDE.map(([t, d]) => '<h3>' + t + '</h3><p>' + d + '</p>').join('');
      $('tab-guide').innerHTML = html;
      $('help').innerHTML =
        '<h3>Commandes (modifiables dans Options &gt; Contrôles)</h3><ul>' +
        '<li><b>ZQSD / WASD</b> : se déplacer · <b>Espace</b> : sauter / nager · <b>Maj</b> : courir · <b>C</b> : s’accroupir</li>' +
        '<li><b>F</b> : ruée · <b>E</b> : inventaire et fabrication · <b>Échap</b> : pause · <b>F1</b> : masquer l’interface · <b>F3</b> : infos</li>' +
        '<li><b>Clic gauche</b> (maintenu) : miner / frapper · <b>Clic droit</b> : poser, manger, utiliser · <b>Clic molette</b> : choisir le bloc visé</li>' +
        '<li><b>1-9</b> ou <b>molette</b> : choisir l’objet en main · <b>Q</b> : jeter</li></ul>' +
        '<h3>Sur téléphone ou tablette</h3><ul>' +
        '<li>Tiens le téléphone en mode paysage. Pouce gauche : le joystick apparaît là où tu poses le doigt.</li>' +
        '<li>Glisse ailleurs pour regarder. <b>Touche un bloc</b> pour poser à côté, utiliser ou frapper ; <b>garde le doigt appuyé dessus</b> pour le casser (visée au doigt, modifiable dans Options › Contrôles).</li>' +
        '<li>Options › Contrôles › <b>Disposer les boutons tactiles</b> : place chaque bouton où tu veux, change sa taille et son opacité, ou masque-le.</li>' +
        '<li>Boutons : ⤒ saut (deux fois pour voler en créatif), ⤓ s’accroupir, » courir, ⚡ ruée, ✋ poser au centre de l’écran, 🎒 inventaire, ⏸ pause, 🗑 jeter.</li>' +
        '<li>Dans l’inventaire, « Rapide » remplace Maj+clic et « Moitié » remplace le clic droit.</li></ul>' +
        '<h3>Multijoueur (gratuit)</h3><ul>' +
        '<li><b>Héberger</b> : lance ton monde, puis <b>Pause › Ouvrir aux amis</b>. Tu obtiens un code de 5 caractères (et un lien à partager).</li>' +
        '<li><b>Rejoindre</b> : menu principal › <b>Multijoueur</b>, choisis un pseudo et tape le code.</li>' +
        '<li><b>T</b> ou <b>Entrée</b> (💬 sur téléphone) : tchat. Coffres partagés, créatures communes, combats entre joueurs si l’hôte les autorise. Les invités n’ont les commandes de triche que si l’hôte tape <b>/triche on</b>.</li>' +
        '<li>L’hôte garde le monde et la progression de ses invités : il doit laisser le jeu ouvert. Jusqu’à 8 joueurs.</li></ul>' +
        '<h3>Le concept</h3><p>Comme dans Minecraft : un monde en cubes à miner, des ressources à récolter, des outils à fabriquer, la faim à gérer et des nuits dangereuses. Mais certaines règles changent :</p>' +
        html;
    }

    // Échanges avec un villageois.
    openTrade(m) {
      if (this.invOpen || !this.game.player.alive) return;
      if (!m.prof) m.prof = CM.villagerProf(m);
      this.trade = m.prof;
      this.chest = null;
      $('trade-title').textContent = 'Villageois — ' + m.prof.name;
      CM.Audio.play('hmm');
      this.openInventory(true);
    }
    renderTrade() {
      const inv = this.game.inventory, t = this.trade;
      const list = $('trade-list');
      list.innerHTML = '';
      const icon = (id, n) => '<span class="ti"><i style="background-image:url(' + CM.Textures.icons[id] + ')"></i>' + n + '</span>';
      t.offers.forEach((o) => {
        const can = o.give.every(([id, n]) => inv.count(id) >= n);
        const row = document.createElement('div');
        row.className = 'trade' + (can ? '' : ' off');
        row.innerHTML = o.give.map(([id, n]) => icon(id, n)).join('') + '<span class="arrow">→</span>' + icon(o.get[0], o.get[1]) +
          '<span class="tname">' + esc(CM.itemName(o.get[0])) + '</span>';
        const b = document.createElement('button');
        b.textContent = 'Échanger';
        b.disabled = !can;
        this.tapOrPress(b, (e) => this.doTrade(o, (e && e.shiftKey) || this.quickMode));
        row.appendChild(b);
        list.appendChild(row);
      });
    }
    doTrade(o, many) {
      const g = this.game, inv = g.inventory;
      let n = 0;
      do {
        if (!o.give.every(([id, k]) => inv.count(id) >= k)) break;
        for (const [id, k] of o.give) inv.remove(id, k);
        const [gid, gk] = o.get;
        const extra = CM.freshExtra(gid);
        const left = inv.add(gid, gk, extra);
        if (left > 0) g.dropNearPlayer(gid, left, extra);
        n++;
      } while (many && n < 64);
      if (n) {
        CM.Audio.play('pop');
        CM.Audio.play('hmm');
        g.player.addXp(n * (3 + Math.floor(Math.random() * 4)));
        inv.changed();
      }
    }

    openChest(slots, title) {
      this.chest = slots;
      $('chest-title').textContent = title || 'Coffre';
      this.openInventory(true);
    }
    openInventory(withChest) {
      if (this.invOpen || !this.game.player.alive) return;
      if (!withChest) {
        this.chest = null;
        this.trade = null;
        this.ench = null;
        this.anvil = null;
      }
      document.querySelector('.side-panel').classList.toggle('chest-mode', !!this.chest);
      document.querySelector('.side-panel').classList.toggle('trade-mode', !!this.trade || !!this.ench || !!this.anvil);
      $('anvil-panel').classList.toggle('hidden', !this.anvil);
      $('trade-panel').classList.toggle('hidden', !this.trade);
      $('ench-panel').classList.toggle('hidden', !this.ench);
      $('chest-panel').classList.toggle('hidden', !this.chest);
      if (this.chest) CM.Audio.play('place', { mat: 'wood' });
      this.invOpen = true;
      this.game.releaseMouse();
      $('inventory').classList.remove('hidden');
      this.refreshStations();
      this.renderInventory();
      this.renderVitals();
      if (this.tab === 'journal') this.renderJournal();
      if (this.tab === 'creative') this.renderCreative();
    }
    closeInventory() {
      if (!this.invOpen) return;
      this.invOpen = false;
      if (this.cursor) {
        const left = this.game.inventory.add(this.cursor.id, this.cursor.count, CM.stackExtra(this.cursor));
        if (left > 0 && this.game.mode !== 'creative') this.game.dropNearPlayer(this.cursor.id, left, this.cursor);
        this.cursor = null;
      }
      if (this.ench && this.ench.item) {
        const it = this.ench.item;
        const left = this.game.inventory.add(it.id, 1, CM.stackExtra(it));
        if (left > 0) this.game.dropNearPlayer(it.id, 1, it);
      }
      this.ench = null;
      // l'enclume rend ses objets
      if (this.anvil) {
        for (const it of [this.anvil.a, this.anvil.b]) {
          if (!it) continue;
          const left = this.game.inventory.add(it.id, it.count, CM.stackExtra(it));
          if (left > 0) this.game.dropNearPlayer(it.id, left, it);
        }
      }
      this.anvil = null;
      this.game.chestClosed();
      this.chest = null;
      this.trade = null;
      $('cursor-stack').classList.add('hidden');
      this.hideTip();
      $('inventory').classList.add('hidden');
      this.game.captureMouse();
    }

    renderVitals() {
      const g = this.game, p = g.player;
      if (g.mode === 'creative') {
        $('inv-vitals').innerHTML = 'Mode créatif · ' + DIFF_NAMES[g.difficulty];
        return;
      }
      $('inv-vitals').innerHTML =
        '❤ <b>' + Math.ceil(p.health) + '</b>/' + p.maxHealth + ' · 🍗 Faim <b>' + p.food + '</b>/20 · Saturation <b>' + p.sat.toFixed(1) + '</b> · ✨ Niveau <b>' + p.level + '</b>' +
        (p.food <= 6 ? ' · <span class="warn">trop faim pour courir</span>' : p.food >= 18 && p.health < p.maxHealth ? ' · <span class="good">régénération</span>' : '');
    }

    refreshStations() {
      const st = this.game.nearbyStations();
      const changed = st.table !== this.stations.table || st.forge !== this.stations.forge || st.smithing !== this.stations.smithing || st.atelier !== this.stations.atelier;
      this.stations = st;
      const one = (k, n) => '<span class="station ' + (st[k] ? 'on' : '') + '">' + (st[k] ? '✔' : '✖') + ' ' + n + '</span>';
      $('stations').innerHTML = one('table', 'Établi') + one('forge', 'Forge / fourneau') + one('smithing', 'Table de forgeron') + (CM.extOn('tech') ? one('atelier', "Établi d'ingénieur") : '');
      if (changed && this.invOpen) this.renderRecipes();
    }

    renderInventory() {
      const inv = this.game.inventory;
      for (let i = 0; i < 36; i++) this.invSlots[i].innerHTML = this.slotHTML(inv.slots[i], i < 9 ? i + 1 : 0);
      for (let k = 0; k < 4; k++) {
        const s = inv.armor[k];
        // case vide : silhouette de la pièce attendue
        this.armorSlots[k].innerHTML = s ? this.slotHTML(s) : '<div class="icon ph" style="background-image:url(' + CM.Textures.icons[CM.armorOf(CM.ARMOR_PIECES[k][0], 'IRON')] + ')"></div>';
      }
      this.offhandSlot.innerHTML = inv.offhand ? this.slotHTML(inv.offhand) : '<div class="icon ph" style="background-image:url(' + CM.Textures.icons[CM.I.SHIELD] + ')"></div>';
      const pts = inv.armorPoints();
      $('inv-prot').innerHTML = '🛡 Protection <b>' + pts + '</b>/20' + (pts ? ' · environ −' + Math.round(pts * 4) + ' % de dégâts' : ' · aucune armure portée');
      if (this.chest)
        for (let i = 0; i < 27; i++) {
          this.chestSlots[i].style.display = i < this.chest.length ? '' : 'none';
          if (i < this.chest.length) this.chestSlots[i].innerHTML = this.slotHTML(this.chest[i]);
        }
      if (this.trade) this.renderTrade();
      if (this.ench) this.renderEnchant();
      if (this.anvil) this.renderAnvil();
      const c = $('cursor-stack');
      if (this.cursor) {
        c.innerHTML = this.slotHTML(this.cursor);
        c.classList.remove('hidden');
      } else c.classList.add('hidden');
      if (this.tab === 'craft') this.renderRecipes();
    }

    // Range un stack dans des cases (fusion puis cases vides). Renvoie le reste.
    stowInto(s, slots, from, to) {
      const max = CM.itemInfo(s.id).stack;
      for (let j = from; j < to && s.count > 0; j++) {
        const t = slots[j];
        if (t && t.id === s.id && t.count < max) {
          const n = Math.min(max - t.count, s.count);
          t.count += n;
          s.count -= n;
        }
      }
      for (let j = from; j < to && s.count > 0; j++) {
        if (!slots[j]) {
          slots[j] = Object.assign({}, s);
          s.count = 0;
        }
      }
      return s.count;
    }

    // Clic sur une case d'un conteneur (inventaire ou coffre).
    slotClick(slots, i, e, kind) {
      e.preventDefault();
      const inv = this.game.inventory;
      const s = slots[i];
      const max = (id) => CM.itemInfo(id).stack;
      CM.Audio.play('click');
      // sur écran tactile, les boutons « Rapide » et « Moitié » remplacent Maj et le clic droit
      const shift = e.shiftKey || this.quickMode;
      const button = this.halfMode && e.button === 0 ? 2 : e.button;
      if (shift && s && !this.cursor) {
        const si = CM.itemInfo(s.id);
        // enclume ouverte : Maj+clic pose l'objet dans la première case libre
        if (kind === 'inv' && this.anvil && (!this.anvil.a || !this.anvil.b)) {
          this.anvil[this.anvil.a ? 'b' : 'a'] = s;
          slots[i] = null;
          inv.changed();
          return;
        }
        // table d'enchantement ouverte : Maj+clic pose l'objet dans sa case
        if (kind === 'inv' && this.ench && !this.ench.item && CM.enchantKind(s.id)) {
          this.ench.item = s;
          slots[i] = null;
          inv.changed();
          return;
        }
        // Maj+clic sur une armure : on l'enfile si la case est libre
        if (kind === 'inv' && !this.chest && si.type === 'armor' && !inv.armor[si.slot]) {
          inv.armor[si.slot] = s;
          slots[i] = null;
          CM.Audio.play('equip', { mat: si.mat });
          inv.changed();
          return;
        }
        if (kind === 'chest') this.stowInto(s, inv.slots, 0, 36);
        else if (this.chest) this.stowInto(s, this.chest, 0, this.chest.length);
        else if (i >= 9) this.stowInto(s, inv.slots, 0, 9);
        else this.stowInto(s, inv.slots, 9, 36);
        if (s.count <= 0) slots[i] = null;
        inv.changed();
        return;
      }
      if (button === 0) {
        if (!this.cursor) {
          if (s) {
            this.cursor = s;
            slots[i] = null;
            this.dragPick = { stack: s, x: e.clientX, y: e.clientY };
          }
        } else if (!s) {
          slots[i] = this.cursor;
          this.cursor = null;
        } else if (s.id === this.cursor.id && max(s.id) > 1) {
          const n = Math.min(max(s.id) - s.count, this.cursor.count);
          s.count += n;
          this.cursor.count -= n;
          if (this.cursor.count <= 0) this.cursor = null;
        } else {
          slots[i] = this.cursor;
          this.cursor = s;
        }
      } else if (button === 2) {
        if (!this.cursor) {
          if (s) {
            const half = Math.ceil(s.count / 2);
            this.cursor = Object.assign({}, s, { count: half });
            s.count -= half;
            if (s.count <= 0) slots[i] = null;
          }
        } else if (!s) {
          slots[i] = Object.assign({}, this.cursor, { count: 1 });
          if (--this.cursor.count <= 0) this.cursor = null;
        } else if (s.id === this.cursor.id && s.count < max(s.id)) {
          s.count++;
          if (--this.cursor.count <= 0) this.cursor = null;
        }
      }
      inv.changed();
      this.showTip(slots[i], e);
    }

    // ------------------------------------------ table d'enchantement --
    openEnchant(x, y, z) {
      if (this.invOpen || !this.game.player.alive) return;
      this.trade = null;
      this.chest = null;
      this.ench = { x, y, z, item: null, shelves: this.game.countShelves(x, y, z) };
      CM.Audio.play('enchant');
      this.openInventory(true);
    }
    renderEnchant() {
      const e = this.ench, g = this.game, p = g.player, inv = g.inventory, I = CM.I;
      const creative = g.mode === 'creative';
      $('ench-slot').innerHTML = e.item ? this.slotHTML(e.item) : '<div class="icon ph" style="background-image:url(' + CM.Textures.icons[I.BOOK] + ')"></div>';
      const lapis = inv.count(I.LAPIS), lvl = p.level;
      $('ench-info').innerHTML = '📚 Bibliothèques <b>' + e.shelves + '</b>/15<br>✨ Niveau <b>' + lvl + '</b> · 🔷 Lapis <b>' + lapis + '</b>';
      const box = $('ench-offers');
      box.innerHTML = '';
      if (!e.item) {
        box.innerHTML = '<div class="ench-empty">Pose ici un outil, une épée ou une pièce d’armure.</div>';
        return;
      }
      if (e.item.ench) {
        box.innerHTML = '<div class="ench-empty">Cet objet est déjà enchanté.</div>';
        return;
      }
      CM.enchantOffers(e.item.id, e.shelves, p.enchSeed).forEach((o, i) => {
        const keys = Object.keys(o.ench);
        const hint = CM.enchName(keys[0], o.ench[keys[0]]) + (keys.length > 1 ? ' …?' : '');
        const need = creative ? '' : lvl < o.cost ? 'Il faut le niveau ' + o.cost : lapis < o.lapis ? 'Il faut ' + o.lapis + ' lapis-lazuli' : '';
        const row = document.createElement('div');
        row.className = 'ench-offer' + (need ? ' off' : '');
        row.innerHTML = '<span class="ench-cost">' + o.cost + '</span><div class="ench-mid"><div class="ench-hint">' + esc(hint) + '</div>' +
          '<div class="ench-sub' + (need ? ' warn' : '') + '">' + (need || '−' + o.lapis + ' niveau' + (o.lapis > 1 ? 'x' : '') + ' · ' + o.lapis + ' lapis') + '</div></div>';
        const b = document.createElement('button');
        b.textContent = 'Enchanter';
        b.disabled = !!need;
        this.tapOrPress(b, () => this.doEnchant(i));
        row.appendChild(b);
        box.appendChild(row);
      });
    }
    doEnchant(i) {
      const e = this.ench, g = this.game, p = g.player, inv = g.inventory, I = CM.I;
      if (!e || !e.item || e.item.ench) return;
      const o = CM.enchantOffers(e.item.id, e.shelves, p.enchSeed)[i];
      const creative = g.mode === 'creative';
      if (!creative && (p.level < o.cost || inv.count(I.LAPIS) < o.lapis)) return;
      e.item.ench = Object.assign({}, o.ench);
      if (!creative) {
        p.spendLevels(o.lapis);
        inv.remove(I.LAPIS, o.lapis);
      }
      p.enchSeed = (Math.random() * 4294967296) >>> 0; // nouvelles offres pour la suite
      g.stats.enchanted = (g.stats.enchanted || 0) + 1;
      CM.Audio.play('enchant');
      g.entities.burst(CM.Textures.layer.ench_glyph, e.x + 0.5, e.y + 1.2, e.z + 0.5, 24, { speed: 2.2, grav: -0.6, life: 1.3, size: 0.1, emissive: true, full: true, spread: 1 });
      this.toast('✨ ' + Object.entries(o.ench).map(([k, l]) => CM.enchName(k, l)).join(', '), 'gold');
      inv.changed();
    }
    enchClick(ev) {
      ev.preventDefault();
      const e = this.ench;
      if (!e) return;
      CM.Audio.play('click');
      if ((ev.shiftKey || this.quickMode) && e.item && !this.cursor) {
        if (this.game.inventory.add(e.item.id, 1, CM.stackExtra(e.item)) === 0) e.item = null;
      } else if (this.cursor) {
        if (!CM.enchantKind(this.cursor.id)) {
          this.toast('On n’enchante que les outils, les épées et les armures', 'info', 'enchonly');
          return;
        }
        const prev = e.item;
        e.item = Object.assign({}, this.cursor, { count: 1 });
        this.cursor = this.cursor.count > 1 ? Object.assign({}, this.cursor, { count: this.cursor.count - 1 }) : prev || null;
      } else if (e.item) {
        this.cursor = e.item;
        e.item = null;
      }
      this.game.inventory.changed();
    }

    // ---------------------------------------------------------- enclume --
    openAnvil(x, y, z) {
      if (this.invOpen || !this.game.player.alive) return;
      this.trade = null;
      this.chest = null;
      this.ench = null;
      this.anvil = { x, y, z, a: null, b: null };
      CM.Audio.play('place', { mat: 'metal' });
      this.openInventory(true);
    }
    renderAnvil() {
      const an = this.anvil, g = this.game, p = g.player;
      const ph = (id) => '<div class="icon ph" style="background-image:url(' + CM.Textures.icons[id] + ')"></div>';
      $('anvil-a').innerHTML = an.a ? this.slotHTML(an.a) : ph(CM.I.CHESTPLATE_IRON);
      $('anvil-b').innerHTML = an.b ? this.slotHTML(an.b) : ph(CM.I.IRON_INGOT);
      const res = CM.anvilResult(an.a, an.b);
      $('anvil-out').innerHTML = res && res.out ? this.slotHTML(res.out) : '';
      const creative = g.mode === 'creative';
      let info = '', ok = false;
      if (!an.a || !an.b) info = 'Pose l’objet à gauche et le matériau (ou un deuxième objet identique) à droite.';
      else if (res.error) info = '<span class="warn">' + esc(res.error) + '</span>';
      else if (!creative && res.cost > CM.ANVIL_MAX) info = esc(res.text) + '<br><span class="warn">Trop cher ! (' + res.cost + ' niveaux)</span>';
      else if (!creative && p.level < res.cost) info = esc(res.text) + '<br><span class="warn">Il faut ' + res.cost + ' niveau' + (res.cost > 1 ? 'x' : '') + ' (tu en as ' + p.level + ')</span>';
      else {
        info = esc(res.text) + '<br>Coût : <span class="cost">' + (creative ? 'gratuit (créatif)' : res.cost + ' niveau' + (res.cost > 1 ? 'x' : '')) + '</span>';
        ok = true;
      }
      $('anvil-info').innerHTML = info;
      $('anvil-go').disabled = !ok;
    }
    doAnvil() {
      const an = this.anvil, g = this.game, p = g.player;
      if (!an) return;
      const res = CM.anvilResult(an.a, an.b);
      if (!res || !res.out) return;
      const creative = g.mode === 'creative';
      if (!creative && (res.cost > CM.ANVIL_MAX || p.level < res.cost)) return;
      if (!creative) p.spendLevels(res.cost);
      an.a = res.out;
      an.b.count -= res.useB;
      if (an.b.count <= 0) an.b = null;
      g.stats.anvil = (g.stats.anvil || 0) + 1;
      CM.Audio.play('anvil');
      g.entities.burst(CM.Textures.layer.white, an.x + 0.5, an.y + 1.05, an.z + 0.5, 14, { speed: 3, grav: 6, life: 0.5, size: 0.05, emissive: true });
      this.toast('🔨 ' + CM.itemName(res.out.id) + ' : ' + res.text.replace(/^[^:]*: /, ''), 'good');
      g.inventory.changed();
    }
    anvilClick(k, ev) {
      ev.preventDefault();
      const an = this.anvil;
      if (!an) return;
      CM.Audio.play('click');
      const s = an[k];
      if ((ev.shiftKey || this.quickMode) && s && !this.cursor) {
        const left = this.game.inventory.add(s.id, s.count, CM.stackExtra(s));
        if (left <= 0) an[k] = null;
        else s.count = left;
      } else if (this.cursor) {
        if (s && s.id === this.cursor.id && CM.itemInfo(s.id).stack > 1) {
          const n = Math.min(CM.itemInfo(s.id).stack - s.count, this.cursor.count);
          s.count += n;
          this.cursor.count -= n;
          if (this.cursor.count <= 0) this.cursor = null;
        } else {
          an[k] = this.cursor;
          this.cursor = s || null;
        }
      } else if (s) {
        this.cursor = s;
        an[k] = null;
      }
      this.game.inventory.changed();
    }

    // Clic sur une case d'armure : n'accepte que la pièce correspondante.
    // Case de la main secondaire : n'importe quel objet (une pile).
    offhandClick(e) {
      e.preventDefault();
      const inv = this.game.inventory, s = inv.offhand;
      CM.Audio.play('click');
      if ((e.shiftKey || this.quickMode) && s && !this.cursor) {
        const left = inv.add(s.id, s.count, CM.stackExtra(s));
        inv.offhand = left > 0 ? Object.assign({}, s, { count: left }) : null;
      } else if (this.cursor) {
        const c = this.cursor;
        if (s && s.id === c.id && !CM.stackExtra(s) && !CM.stackExtra(c)) {
          const max = CM.itemInfo(s.id).stack || 64, n = Math.min(max - s.count, c.count);
          s.count += n;
          c.count -= n;
          this.cursor = c.count > 0 ? c : null;
        } else {
          inv.offhand = c;
          this.cursor = s || null;
        }
      } else if (s) {
        this.cursor = s;
        inv.offhand = null;
      }
      inv.changed();
      this.showTip(inv.offhand, e);
    }
    armorClick(k, e) {
      e.preventDefault();
      const inv = this.game.inventory, s = inv.armor[k];
      const fits = (st) => {
        const i = st && CM.itemInfo(st.id);
        return !!i && i.type === 'armor' && i.slot === k;
      };
      CM.Audio.play('click');
      if ((e.shiftKey || this.quickMode) && s && !this.cursor) {
        if (inv.add(s.id, 1, CM.stackExtra(s) || { xp: 0 }) === 0) inv.armor[k] = null;
      } else if (this.cursor) {
        if (!fits(this.cursor)) {
          this.toast('Cette case est pour : ' + CM.ARMOR_PIECES[k][1].toLowerCase(), 'info', 'armorslot');
          return;
        }
        inv.armor[k] = Object.assign({}, this.cursor, { count: 1 });
        this.cursor = s || null;
        CM.Audio.play('equip', { mat: CM.itemInfo(inv.armor[k].id).mat });
      } else if (s) {
        this.cursor = s;
        inv.armor[k] = null;
      }
      inv.changed();
      this.showTip(inv.armor[k], e);
    }

    // Icônes de protection au-dessus des cœurs et panneau des pièces portées (en bas à droite).
    updateArmorHUD(creative) {
      const inv = this.game.inventory;
      const pts = inv.armorPoints();
      $('armor').classList.toggle('hidden', creative || pts <= 0);
      if (pts !== this.lastArmor) {
        this.lastArmor = pts;
        for (let i = 0; i < 10; i++) {
          const v = pts - i * 2;
          this.armorEls[i].style.backgroundImage = 'url(' + (v >= 2 ? this.armorIcons.full : v === 1 ? this.armorIcons.half : this.armorIcons.empty) + ')';
        }
      }
      const sig = inv.armor.map((s) => (s ? s.id + ':' + (s.xp || 0) : '-')).join(',');
      if (sig === this.armorSig) return;
      this.armorSig = sig;
      const worn = inv.armor.filter(Boolean);
      $('armor-panel').classList.toggle('hidden', !worn.length);
      $('hud').classList.toggle('has-armor', worn.length > 0);
      $('armor-panel').innerHTML =
        '<div class="ap-head">🛡 Armure portée · <b>' + pts + '</b>/20</div>' +
        worn
          .map((s) => {
            const info = CM.itemInfo(s.id), left = Math.max(0, info.maxDur - (s.xp || 0)), k = left / info.maxDur;
            return (
              '<div class="ap-row' + (k <= 0.1 ? ' low' : '') + '"><i style="background-image:url(' + CM.Textures.icons[s.id] + ')"></i>' +
              '<div class="ap-mid"><span class="ap-name">' + esc(info.name) + '</span><span class="ap-bar"><b style="width:' + Math.round(k * 100) + '%;background:' + durColor(k) + '"></b></span></div>' +
              '<span class="ap-num">' + left + '<small>/' + info.maxDur + '</small></span></div>'
            );
          })
          .join('');
    }

    // Jette n objets du curseur devant le joueur.
    throwCursor(n) {
      const c = this.cursor;
      if (!c || n <= 0) return;
      n = Math.min(n, c.count);
      this.game.dropNearPlayer(c.id, n, c);
      c.count -= n;
      if (c.count <= 0) this.cursor = null;
      CM.Audio.play('pop');
      $('cursor-stack').classList.remove('drop');
      this.game.inventory.changed();
    }

    showTip(s, e) {
      const tt = $('tooltip');
      if (!s || this.cursor || (e && e.pointerType === 'touch') || (this.game.touch && this.game.touch.enabled && !(e && e.pointerType === 'mouse'))) {
        tt.classList.add('hidden');
        return;
      }
      tt.innerHTML = this.tipHTML(s.id, s);
      tt.classList.remove('hidden');
      if (e) {
        tt.style.left = Math.min(e.clientX + 16, window.innerWidth - 300) + 'px';
        tt.style.top = e.clientY + 12 + 'px';
      }
    }
    hideTip() {
      $('tooltip').classList.add('hidden');
    }
    tipHTML(id, s) {
      const info = CM.itemInfo(id);
      let h = '<b' + (s && s.ench ? ' class="tt-ench"' : '') + '>' + esc(info.name) + '</b>';
      if (s && s.ench) for (const [k, l] of Object.entries(s.ench)) if (CM.ENCHANTS[k]) h += '<div class="tt-ench">✨ ' + CM.enchName(k, l) + ' <span class="tt-sub">(' + CM.ENCHANTS[k].desc + ')</span></div>';
      else if (CM.enchantKind(id)) h += '<div class="tt-sub">Enchantable (table d’enchantement)</div>';
      if (info.type === 'tool') {
        const lvl = CM.masteryLevel((s && s.xp) || 0);
        const spd = info.toolType === 'sword' ? 'Dégâts ' + (info.damage + Math.floor((lvl - 1) / 2)) : info.toolType === 'hoe' ? 'Laboure la terre (clic droit)' : 'Vitesse ×' + (info.speed * (1 + 0.12 * (lvl - 1))).toFixed(1) + ' · dégâts ' + info.damage;
        h += '<div class="tt-gold">Maîtrise ' + '★'.repeat(lvl) + '☆'.repeat(5 - lvl) + (s && s.xp !== undefined ? ' · ' + s.xp + ' XP' : '') + '</div>';
        h += '<div class="tt-sub">' + spd + ' · ne s’use jamais</div>';
        if (info.toolType === 'pickaxe') h += '<div class="tt-sub">Récolte jusqu’au niveau ' + CM.TIER_NAMES[Math.min(info.tier, 5)] + '.</div>';
        if (info.toolType === 'pickaxe' && info.mat === 'CRYSTAL') h += '<div class="tt-sub">Mine les filons de minerai d’un coup.</div>';
        if (info.toolType === 'axe' && info.tier >= 3) h += '<div class="tt-sub">Abat l’arbre entier d’un coup.</div>';
        if (info.toolType === 'axe') h += '<div class="tt-sub">Clic droit sur une bûche : l’écorcer.</div>';
      } else if (info.type === 'food') {
        h += '<div class="tt-sub">Clic droit maintenu 1 s pour manger : +' + info.food / 2 + ' 🍗 (saturation ' + info.sat + ')' + (info.regen ? ', Régénération' : '') + '</div>';
        if (info.plant) h += '<div class="tt-sub">Clic droit sur de la terre labourée pour planter.</div>';
        for (const [ty, foods] of Object.entries(CM.BREED_FOOD)) if (foods.includes(info.id)) h += '<div class="tt-sub">Plaît aux ' + (ty === 'boar' ? 'sangliers' : 'mouflons') + ' (élevage).</div>';
      } else if (info.type === 'charm') {
        h += '<div class="tt-gold">' + info.desc + '</div>';
      } else if (info.charge) {
        h += '<div class="tt-gold">' + info.desc + '</div>';
        h += '<div class="tt-sub">⚡ Charge ' + Math.round(CM.chargeLeft(s || { id, xp: 0 })) + '/' + info.charge + '</div>';
      } else if (info.type === 'shield') {
        const used = (s && s.xp) || 0, left = info.maxDur - used;
        h += '<div class="tt-gold">' + info.desc + '</div>';
        h += '<div class="tt-sub">Durabilité <span style="color:' + durColor(left / info.maxDur) + '">' + left + '/' + info.maxDur + '</span> · s’use à chaque coup arrêté · ' + esc(this.game.keyName(this.game.binds.swap)) + ' : changer de main</div>';
      } else if (info.type === 'grapple') {
        h += '<div class="tt-sub">Clic droit : s’accrocher à un bloc (34 blocs). Saut : se décrocher.</div>';
      } else if (info.type === 'seeds') {
        h += '<div class="tt-sub">Clic droit sur de la terre labourée pour planter.</div>';
      } else if (info.type === 'armor') {
        const used = (s && s.xp) || 0, left = info.maxDur - used;
        h += '<div class="tt-gold">🛡 Protection +' + info.armor + (info.tough ? ' · Robustesse +' + info.tough : '') + '</div>';
        h += '<div class="tt-sub">Durabilité <span style="color:' + durColor(left / info.maxDur) + '">' + left + '/' + info.maxDur + '</span> · s’use à chaque coup reçu</div>';
        h += '<div class="tt-sub">Clic droit avec en main, ou Maj+clic dans l’inventaire, pour l’enfiler.</div>';
      } else if (info.type === 'bucket') {
        h += '<div class="tt-sub">' + info.desc + '</div>';
      } else if (info.type === 'bonemeal') {
        h += '<div class="tt-sub">Clic droit : fait pousser cultures, pousses et fleurs.</div>';
      } else if (info.type === 'igniter') {
        h += '<div class="tt-sub">Clic droit sur une TNT pour l’allumer.</div>';
      } else if (info.dye) {
        h += '<div class="tt-sub">Teint la laine, le verre, la terre cuite et le béton.</div>';
      } else if (info.isBlock) {
        const b = info.block;
        const bits = [];
        if (b.light) bits.push('Lumineux (' + b.light + ')');
        if (b.station) bits.push('Station de fabrication');
        if (b.container) bits.push('Rangement (' + (b.slots || 27) + ' cases)');
        if (b.bounce) bits.push('Rebondissant');
        if (CM.TAGS.saplings.includes(b.id)) bits.push('Pose-la au soleil : un arbre poussera');
        if (b.slip) bits.push('Glissant');
        if (b.slow) bits.push('Ralentit la marche');
        if (b.hurts) bits.push('Blesse au contact !');
        if (b.render === 'slab') bits.push('Dalle : pose-en deux l’une sur l’autre pour un bloc plein');
        if (b.becomes) bits.push('Devient du béton au contact de l’eau');
        if (b.tnt) bits.push('S’allume avec un briquet ou une torche (clic droit)');
        if (b.note) bits.push('Clic droit : joue une note');
        if (b.tier > 1) bits.push('Pioche en ' + CM.TIER_NAMES[b.tier] + ' requise');
        if (bits.length) h += '<div class="tt-sub">' + bits.join(' · ') + '</div>';
      }
      return h;
    }

    renderRecipes() {
      const g = this.game, inv = g.inventory, st = this.stations;
      const box = $('recipes');
      const creative = g.mode === 'creative';
      const list = CM.recipes
        .map((r, i) => ({ r, i, can: creative || inv.canCraft(r, st) }))
        .filter((o) => (!o.r.ext || CM.extOn(o.r.ext)) && (this.filter === 'tout' || o.r.cat === this.filter) && (!this.onlyCan || o.can))
        .filter((o) => !this.search || norm(CM.itemName(o.r.out)).includes(this.search) || o.r.ing.some(([id]) => norm(CM.ingName(id)).includes(this.search)));
      list.sort((a, b) => (b.can ? 1 : 0) - (a.can ? 1 : 0));
      $('recipe-count').textContent = list.length + ' recette' + (list.length > 1 ? 's' : '') + (list.length ? ' — fais défiler la liste pour tout voir' : '');
      let h = '';
      for (const { r, i, can } of list) {
        const ing = r.ing
          .map(([id, n]) => {
            const have = inv.count(id);
            const shown = typeof id === 'string' ? CM.tagMembers(id).find((m) => inv.has(m)) || CM.tagMembers(id)[0] : id;
            return '<span class="ing ' + (have >= n || creative ? '' : 'miss') + '"><i style="background-image:url(' + CM.Textures.icons[shown] + ')"></i>' + n + ' ' + esc(CM.ingName(id)) + '</span>';
          })
          .join('');
        const stn = r.station ? '<span class="r-station ' + (st[r.station] ? '' : 'miss') + '">' + CM.STATION_NAMES[r.station] + '</span>' : '';
        h +=
          '<div class="recipe ' + (can ? 'can' : '') + '" data-r="' + i + '">' +
          '<div class="slot">' + this.slotHTML({ id: r.out, count: r.n }) + '</div>' +
          '<div class="r-body"><div class="r-name">' + esc(CM.itemName(r.out)) + (r.n > 1 ? ' ×' + r.n : '') + '</div><div class="r-ing">' + ing + '</div></div>' +
          stn + '</div>';
      }
      if (!list.length) h = '<div class="hint">Aucune recette ne correspond.</div>';
      const scroll = box.scrollTop;
      box.innerHTML = h;
      box.scrollTop = scroll;
      box.querySelectorAll('.recipe').forEach((el) => {
        const r = CM.recipes[+el.dataset.r];
        this.tapOrPress(el, (e) => {
          e.preventDefault();
          this.craft(r, e.shiftKey || this.quickMode);
        });
        el.addEventListener('mouseenter', (e) => this.showTip({ id: r.out, count: r.n, xp: CM.hasWear(r.out) ? 0 : undefined }, e));
        el.addEventListener('mouseleave', () => this.hideTip());
      });
    }

    craft(r, many) {
      const g = this.game, inv = g.inventory;
      if (g.mode === 'creative') {
        const info = CM.itemInfo(r.out);
        inv.add(r.out, many ? info.stack : r.n, CM.freshExtra(r.out));
        CM.Audio.play('craft');
        return;
      }
      if (!inv.canCraft(r, this.stations)) {
        if (r.station && !this.stations[r.station]) this.toast('Il faut être près d’' + CM.STATION_NEAR[r.station] + ' (4 blocs)', 'warn');
        else this.toast('Ingrédients manquants', 'warn');
        return;
      }
      const times = many ? inv.maxCrafts(r) : 1;
      let done = 0;
      for (let k = 0; k < times; k++) {
        // amélioration en netherite : la pièce garde ses enchantements
        const src = r.station === 'smithing' && CM.hasWear(r.ing[0][0]) ? inv.slots.find((s) => s && s.id === r.ing[0][0] && s.ench) : null;
        const ench = src && Object.assign({}, src.ench);
        const left = inv.craft(r);
        if (left > 0) g.dropNearPlayer(r.out, left, ench ? { xp: 0, ench } : null);
        else if (ench) {
          const o = inv.slots.find((s) => s && s.id === r.out && !s.ench);
          if (o) o.ench = ench;
        }
        g.stats.crafted[r.out] = (g.stats.crafted[r.out] || 0) + r.n;
        done++;
        if (CM.itemInfo(r.out).stack === 1) break;
      }
      // la forge rapporte un peu d'expérience (comme le four de Minecraft)
      if (r.station === 'forge') g.player.addXp(done * Math.max(1, Math.round(r.n * 0.35)));
      CM.Audio.play('craft');
      this.updateObjective();
    }

    renderJournal() {
      const g = this.game;
      let cur = OBJECTIVES.findIndex((o) => !o.done(g));
      let h = '';
      OBJECTIVES.forEach((o, i) => {
        const done = o.done(g);
        h += '<div class="journal-item ' + (done ? 'done' : i === cur ? 'current' : '') + '"><div class="jt">' + (done ? '✔ ' : i === cur ? '➤ ' : '') + o.t + '</div><div class="jd">' + o.d + '</div></div>';
      });
      const s = g.stats;
      const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
      h +=
        '<div class="stats">' +
        '<div>Jours survécus : <b>' + g.dayCount + '</b></div>' +
        '<div>Blocs minés : <b>' + sum(s.mined) + '</b></div>' +
        '<div>Blocs posés : <b>' + sum(s.placed) + '</b></div>' +
        '<div>Ombres vaincues : <b>' + (s.kills.ombre || 0) + '</b></div>' +
        '<div>Grappins lancés : <b>' + (s.grapples || 0) + '</b></div>' +
        '<div>Morts : <b>' + (s.deaths || 0) + '</b></div>' +
        '<div>Graine : <b>' + g.world.seed + '</b></div>' +
        '<div>Types de blocs posés : <b>' + Object.keys(s.placed).length + '</b></div>' +
        '</div>';
      $('tab-journal').innerHTML = h;
    }

    // ---------------------------------------------------- nouveau monde --
    buildNewWorld() {
      const upd = () => {
        const s = this.newWorldSettings();
        const d = [];
        d.push(s.mode === 'creative' ? 'Créatif : blocs infinis, vol, aucun danger.' : 'Survie : récolte, faim, nuits dangereuses.');
        if (s.difficulty === 'peaceful') d.push('Paisible : aucune Ombre et la faim remonte seule.');
        if (s.difficulty === 'hard') d.push('Difficile : Ombres nombreuses et dégâts renforcés, la faim peut tuer.');
        if (s.type === 'amplified') d.push('Amplifié : reliefs gigantesques.');
        if (s.type === 'flat') d.push('Plat : un monde d’herbe parfaitement plat, idéal pour construire.');
        if (s.type === 'islands') d.push('Archipel : des îles dispersées sur un grand océan.');
        $('nw-desc').textContent = d.join(' ');
      };
      for (const id of ['nw-mode', 'nw-diff', 'nw-type', 'nw-biome']) $(id).addEventListener('change', upd);
      $('seed').addEventListener('keydown', (e) => e.stopPropagation());
      upd();
    }
    openNewWorld() {
      $('seed').value = '';
      this.show('newworld');
    }
    newWorldSettings() {
      return {
        mode: $('nw-mode').value,
        difficulty: $('nw-diff').value,
        type: $('nw-type').value,
        biomeSize: $('nw-biome').value,
        bonusChest: $('nw-bonus').checked,
        dayCycle: $('nw-daycycle').checked,
        ext: { tech: $('nw-ext-tech').checked, light: $('nw-ext-light').checked, gravity: $('nw-ext-gravity').checked },
      };
    }
    refreshPause() {
      const g = this.game;
      if (!g.world) return;
      const net = g.net;
      $('pause-info').innerHTML =
        'Graine : <b>' + g.world.seed + '</b> · ' + MODE_NAMES[g.mode] + ' · ' + DIFF_NAMES[g.difficulty] + ' · monde ' + TYPE_NAMES[g.settings.type || 'normal'] +
        '<br>Jour ' + (g.dayCount + 1) + ' · ' + g.world.editCount() + ' blocs modifiés' +
        (net.active ? '<br><br>' + net.playersHTML() : '');
      // multijoueur : l'invité ne gère pas la sauvegarde du monde
      $('btn-guide').textContent = g.options.showQuests ? 'Masquer le guide' : 'Afficher le guide';
      $('btn-lan').textContent = net.isHost ? 'Inviter des amis (code ' + net.code + ')' : 'Ouvrir aux amis (multijoueur)';
      $('btn-lan').classList.toggle('hidden', net.isClient);
      $('btn-export2').classList.toggle('hidden', net.isClient);
      $('btn-save').classList.toggle('hidden', net.isClient);
      $('btn-quit').textContent = net.isClient ? 'Quitter la partie' : net.isHost ? 'Sauvegarder et fermer la partie' : 'Sauvegarder et quitter';
    }

    // ------------------------------------------------------- options -----
    openOptions(inGame) {
      this.optInGame = inGame;
      this.renderOptions();
      this.show('options');
    }
    renderOptions() {
      const g = this.game, o = g.options;
      $('opt-tabs').innerHTML = OPTION_TABS.map(([k, n]) => '<button data-o="' + k + '" class="' + (k === this.optTab ? 'active' : '') + '">' + n + '</button>').join('');
      $('opt-tabs').querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          this.optTab = b.dataset.o;
          this.bindWaiting = null;
          this.renderOptions();
        }),
      );
      const body = $('opt-body');
      body.innerHTML = '';
      const items = OPTION_TABS.find((t) => t[0] === this.optTab)[2];
      for (const it of items) {
        if (it.t === 'binds') {
          const h = document.createElement('div');
          h.className = 'opt binds';
          h.innerHTML = '<div class="opt-sub">Touches</div>' + Object.keys(BIND_LABELS).map((a) =>
            '<div class="bind"><span>' + BIND_LABELS[a] + '</span><button data-a="' + a + '" class="' + (this.bindWaiting === a ? 'wait' : '') + '">' +
            (this.bindWaiting === a ? 'Appuie sur une touche…' : esc(g.keyName(g.binds[a]))) + '</button></div>').join('');
          h.querySelectorAll('button').forEach((b) =>
            b.addEventListener('click', () => {
              this.bindWaiting = b.dataset.a;
              this.renderOptions();
            }),
          );
          body.appendChild(h);
          continue;
        }
        if (it.t === 'button') {
          const d = document.createElement('div');
          d.className = 'opt';
          const b = document.createElement('button');
          b.textContent = it.label;
          b.addEventListener('click', () => it.run(g, this));
          d.appendChild(b);
          if (it.note) {
            const n = document.createElement('div');
            n.className = 'small-note';
            n.textContent = it.note;
            d.appendChild(n);
          }
          body.appendChild(d);
          continue;
        }
        if (it.t === 'world') {
          if (!this.optInGame || !g.world) {
            const n = document.createElement('div');
            n.className = 'small-note';
            n.textContent = 'Le mode de jeu et la difficulté se choisissent en créant un monde (et se modifient ici pendant une partie).';
            body.appendChild(n);
            continue;
          }
          const mkSel = (label, value, opts, fn) => {
            const d = document.createElement('div');
            d.className = 'opt';
            d.innerHTML = '<label>' + label + '</label><select>' + opts.map(([v, n]) => '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
            d.querySelector('select').addEventListener('change', (e) => fn(e.target.value));
            body.appendChild(d);
          };
          if (g.net.isClient) {
            const n = document.createElement('div');
            n.className = 'small-note';
            n.textContent = 'Partie de ' + g.net.hostName + ' : ' + MODE_NAMES[g.mode] + ', ' + DIFF_NAMES[g.difficulty] + '. Le mode de jeu, la difficulté, la durée des journées et « garder l’inventaire » sont réglés par l’hôte.';
            body.appendChild(n);
            continue;
          }
          mkSel('Mode de jeu (ce monde)', g.mode, Object.entries(MODE_NAMES), (v) => {
            g.setMode(v);
            this.worldStarted();
          });
          mkSel('Difficulté (ce monde)', g.difficulty, Object.entries(DIFF_NAMES), (v) => g.setDifficulty(v));
          continue;
        }
        const d = document.createElement('div');
        d.className = 'opt' + (it.t === 'check' ? ' check' : '');
        if (it.t === 'range') {
          d.innerHTML = '<label>' + it.label + ' <span></span></label><input type="range" min="' + it.min + '" max="' + it.max + '" step="' + it.step + '" />' + (it.note ? '<div class="opt-note">' + it.note + '</div>' : '');
          const inp = d.querySelector('input'), span = d.querySelector('span');
          inp.value = o[it.k];
          span.textContent = it.fmt(o[it.k]);
          inp.addEventListener('input', () => {
            o[it.k] = +inp.value;
            span.textContent = it.fmt(o[it.k]);
            g.applyOptions();
          });
        } else if (it.t === 'check') {
          d.innerHTML = '<label><input type="checkbox" /> ' + it.label + '</label>';
          const inp = d.querySelector('input');
          inp.checked = !!o[it.k];
          inp.addEventListener('change', () => {
            o[it.k] = inp.checked;
            g.applyOptions();
          });
        } else if (it.t === 'select') {
          d.innerHTML = '<label>' + it.label + '</label><select>' + it.opts.map(([v, n]) => '<option value="' + v + '"' + (String(v) === String(o[it.k]) ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
          d.querySelector('select').addEventListener('change', (e) => {
            o[it.k] = typeof CM.DEFAULT_OPTIONS[it.k] === 'number' ? +e.target.value : e.target.value;
            g.applyOptions();
          });
        }
        body.appendChild(d);
      }
    }
    // Capture d'une touche pour la réaffectation (renvoie true si la touche est consommée).
    captureKey(e) {
      if (!this.bindWaiting) return false;
      e.preventDefault();
      e.stopPropagation();
      const g = this.game, a = this.bindWaiting;
      this.bindWaiting = null;
      if (e.code !== 'Escape') {
        // si la touche servait déjà à une autre action, on échange
        const other = Object.keys(g.binds).find((k) => g.binds[k] === e.code && k !== a);
        if (other) g.binds[other] = g.binds[a];
        g.binds[a] = e.code;
        g.applyOptions();
      }
      this.renderOptions();
      return true;
    }

    // ---------------------------------------------------------- écrans --
    show(id) {
      $(id).classList.remove('hidden');
    }
    hide(id) {
      $(id).classList.add('hidden');
    }
    showDeath(cause) {
      this.closeInventory();
      $('death-cause').textContent = (cause || 'Quelque chose') + ' a eu raison de vous.';
      $('death-note').textContent = this.game.keepInventory() ? 'Tu gardes ton inventaire (option activée).' : 'Vos objets sont tombés sur place. Allez vite les récupérer !';
      this.game.releaseMouse();
      this.show('death');
    }
    hideDeath() {
      this.hide('death');
    }
  }

  CM.UI = UI;
})();
