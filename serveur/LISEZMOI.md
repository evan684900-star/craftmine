# Serveur CraftMine

Un monde CraftMine ouvert **24 h/24** sur une machine louée (VPS). Les joueurs le rejoignent avec le
bouton **« Serveur »** du menu principal : pas de code à taper, et chacun retrouve ses constructions
et son inventaire à chaque visite.

Le jeu tourne sur la machine dans un navigateur invisible (Chromium), sans image ni son. Il est
l'hôte permanent de la partie : tout le multijoueur de CraftMine marche comme d'habitude. La mise en
relation passe par le même service que les parties entre amis, donc **aucun port à ouvrir et aucun
nom de domaine** ne sont nécessaires.

## Installation (Ubuntu 22.04 ou 24.04, 1 cœur et 2 Go de mémoire suffisent)

1. Connecte-toi à la machine depuis ton ordinateur (Windows : ouvre **PowerShell**) :

   ```
   ssh root@ADRESSE_IP_DE_LA_MACHINE
   ```

   Tape `yes` à la première connexion, puis le mot de passe (il ne s'affiche pas pendant la frappe,
   c'est normal).

2. Colle cette commande et appuie sur Entrée :

   ```
   curl -fsSL https://craftmine16.vercel.app/serveur/installer.sh | bash
   ```

   L'installation prend 5 à 10 minutes. À la fin, elle affiche le **mot de passe administrateur**.

3. C'est tout : le serveur démarre, et redémarre tout seul si la machine redémarre ou si le jeu
   plante. Il se met aussi à jour tout seul quand une nouvelle version de CraftMine sort.

## Les commandes de la machine

| Commande | Ce qu'elle fait |
| --- | --- |
| `craftmine journal` | Voir ce qui se passe : arrivées, tchat, erreurs (Ctrl+C pour quitter) |
| `craftmine etat` | En marche ? Qui est connecté ? |
| `craftmine cmd /annonce Salut !` | Taper une commande du jeu en tant que serveur (`/bannir`, `/temps midi`, `/meteo clair`…) |
| `craftmine config` | Changer les réglages (voir ci-dessous), puis redémarrage automatique |
| `craftmine motdepasse` | Afficher le mot de passe administrateur |
| `craftmine redemarrer` · `arreter` · `demarrer` | Contrôler le serveur |
| `craftmine sauvegardes` | Copies du monde (une par heure, 3 jours gardés) |
| `craftmine nouveau-monde` | Recommencer avec un nouveau monde (l'ancien est gardé) |
| `craftmine mettre-a-jour` | Réinstaller la dernière version du serveur |

## Réglages (`craftmine config`)

| Réglage | Valeurs |
| --- | --- |
| `nom` | Nom du serveur dans le tchat |
| `graine` | Graine du monde (vide : au hasard). Seulement pour un nouveau monde |
| `type` | `normal`, `ville`, `plat`, `archipel`, `amplifie`. Seulement pour un nouveau monde |
| `mode` | `survie` ou `creatif` |
| `difficulte` | `paisible`, `facile`, `normal`, `difficile` |
| `extensions` | Liste parmi `lumiere`, `electricite`, `armes`, `vehicules`, `gravite`. Seulement pour un nouveau monde |
| `triches` | `true` : tout le monde peut utiliser les commandes de triche |
| `pvp` | `true` : combats entre joueurs |
| `garderInventaire` | `true` : on garde son inventaire à la mort |
| `maxJoueurs` | Nombre de joueurs en même temps (10 par défaut, 20 au plus) |
| `motDePasseAdmin` | Mot de passe de `/admin` (4 caractères au moins) |

## Administrateurs

Dans le jeu, tape **`/admin MOT_DE_PASSE`** : tu as alors les triches et les commandes de l'hôte
(`/expulser`, `/bannir`, `/debannir`, `/triche`, `/regle`…). Personne d'autre ne voit le mot de passe.
Après 3 essais faux, il faut attendre une minute.

## Fichiers (dans `/opt/craftmine`)

- `config.json` : les réglages
- `monde.json` : le monde et la progression de chaque joueur (enregistré chaque minute et à l'arrêt)
- `sauvegardes/` : une copie par heure
- `serveur.js` : le programme du serveur
