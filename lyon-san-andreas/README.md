# LUGDUNUM — Lyon en monde ouvert (Three.js)

Jeu d'action en monde ouvert à la 3ᵉ personne situé à Lyon : Presqu'île, Croix-Rousse,
Part-Dieu, Vieux Lyon, Fourvière, Perrache, Confluence, Rhône et Saône.

## Lancer le jeu

Le jeu doit être servi par un petit serveur local : ouvrir `index.html` en double-cliquant ne
marche pas, car les navigateurs bloquent les modules JavaScript en `file://`.

1. Ouvrir un terminal dans le dossier `lyon-san-andreas`.
2. Lancer **une** de ces commandes :
   - avec Python : `python3 -m http.server 8000` (sous Windows : `py -m http.server 8000`)
   - avec Node.js : `npx serve -l 8000`
3. Ouvrir **http://localhost:8000** dans Chrome, Edge ou Firefox.
4. Cliquer sur **JOUER**.

Une connexion Internet est nécessaire : Three.js et les polices sont téléchargés depuis un CDN.

## Jouer sur iPhone / iPad / Android

Le jeu reconnaît automatiquement les écrans tactiles. Tenez le téléphone **à l'horizontale** :

- **pouce gauche** : joystick (poussé à fond = sprint)
- **glisser à droite** : tourner la caméra
- boutons **SAUT**, **E** (entrer), **CAM**, **CARTE** et **?** (aide)

Il faut un iPhone à jour (iOS 16.4 ou plus récent).

## Commandes (ordinateur)

| Touche | Action |
|---|---|
| ZQSD / WASD / flèches | se déplacer |
| Souris | tourner la caméra |
| Molette / V | distance de la caméra |
| Maj | sprinter (consomme l'endurance) |
| Espace | sauter |
| E / F | entrer (cercles lumineux) |
| M | grande carte (clic = téléportation) |
| T (maintenir) | accélérer le temps |
| H | aide · Échap : pause |

## Organisation du code

```
index.html              page du jeu (HUD, menus, carte)
css/hud.css             styles de l'interface
js/main.js              boucle de jeu, ciel, cycle jour/nuit, états du jeu
js/world/mapLyon.js     relief, fleuves, ponts, rues, immeubles, monuments, collisions, radar
js/world/interiors.js   entrées des bâtiments (intérieurs : prochaine étape)
js/entities/player.js   personnage, caméra TPS, vie/armure/endurance/argent
js/entities/vehicles.js voitures, motos, police (étape 2)
js/entities/weapons.js  armes et combat (étape 4)
js/entities/trafficNpc.js piétons et circulation (étape 2)
js/systems/police.js    indice de recherche (étape 4)
js/ui/hud.js            HUD + radar + grande carte
js/ui/touch.js          joystick et boutons tactiles (téléphone, tablette)
```

## Avancement

- [x] **Étape 1** : ville de Lyon explorable, personnage, caméra, HUD, radar, jour/nuit
- [ ] **Étape 2** : véhicules, motos, trafic et piétons
- [ ] **Étape 3** : intérieurs (planque, centre commercial, gares, hôpital, armurerie)
- [ ] **Étape 4** : armes, combat et police
