# Chicken King — site de commande en ligne (click & collect)

## À lire en premier (pour Claude Code)

- Le propriétaire est **débutant complet** en programmation. Explique chaque étape simplement, **en français**, sans jargon.
- Avance **étape par étape** (voir « Ordre de construction ») et montre le résultat à la fin de chaque étape avant de passer à la suivante.
- Avant toute action qui coûte de l'argent, publie quelque chose ou ne peut pas être annulée, **demande d'abord**.
- Quand le propriétaire doit faire quelque chose lui-même (créer un compte, copier une clé), donne-lui les instructions clic par clic.
- `prototype.html` est la maquette validée par le propriétaire : reprends son design, ses textes et son parcours.

## Le projet

Site web pour le snack **Chicken King** : les clients consultent le menu, composent leur commande, paient en ligne et viennent la récupérer au comptoir avec un **numéro de commande**. Le patron voit les commandes arriver en direct sur une tablette.

Le site doit être pensé **d'abord pour le téléphone** (la plupart des clients commanderont depuis leur mobile) et pouvoir être ajouté à l'écran d'accueil (PWA).

## Infos du snack

- **Adresse** : Résidence Quai des Lilas, 136 rue Antoine Arnaud, 69400 Villefranche-sur-Saône
- **Téléphone** : 04 26 47 34 32
- **Horaires** : tous les jours, 11:00 – 23:00 (fuseau Europe/Paris)
- En dehors des horaires, le site affiche « Fermé » et **bloque les commandes**.
- Logo : `public/logo.png`

## Stack technique conseillée

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** : base de données Postgres, comptes clients (Auth), temps réel (Realtime) pour l'écran patron
- **Stripe Checkout** : paiement par carte (+ Apple Pay / Google Pay)
- **Vercel** : hébergement
- Les clés secrètes vont dans des variables d'environnement, jamais dans le code.

## Design

- Fond noir de la marque, rouge pour les actions, texte blanc cassé, étiquettes de prix jaunes (comme le menu affiché au snack).
- Polices : Anton (titres), Barlow (texte), Barlow Condensed (étiquettes).
- Barre de catégories qui défile en haut, bouton panier rouge flottant en bas, personnalisation des produits dans un panneau qui monte du bas de l'écran.
- Reprendre `prototype.html` comme référence visuelle.

## Menu complet

Prix en euros TTC.

### À composer
| Produit | Prix | Viandes |
|---|---|---|
| Simple (1 galette) | 7,50 | 1 |
| Maxi (2 galettes) | 11,50 | 2 |
| Sandwich baguette | 7,50 | 1 |
| Wrap | 7,50 | 1 |
| Bowl | 8,00 | 1 |

Options pour chaque produit « À composer » :
- **Viande** (obligatoire, nombre exact selon le produit) : Steak, Poulet, Cordon bleu, Tenders, Kebab, Fish, Merguez, Nuggets
- **Sauces** (0 à 2) : Mayo, Ketchup, Burger, Blanche, Barbecue, Fish, Algérienne, Curry, Samouraï, Harissa, Tartare
- **Suppléments** (plusieurs possibles) : Cheddar 0,60 · Chèvre 0,60 · Raclette 0,60 · Boursin 0,60 · Olives 0,60 · Crudités 0,50 · Poivrons 0,60 · Œuf 1,00 · Jambon 1,00 · Chorizo 1,00 · Bacon 1,00 · Lardons 1,00 · Rösti 1,50 · Viande en plus 2,00
- **Gratinage** (0 ou 1, 1,00 €) : Cheddar, Mozza, Raclette, Chèvre, Oignon crispy, Bleu
- **Formule** : Seul, ou Menu frites + boisson 33 cl (+3,00 €)

### Chicken Box
| Box | Pour | Seul | Menu | Composition au choix |
|---|---|---|---|---|
| Box 1 | 1 personne | 6,90 | 9,90 | 3 tenders + 3 wings, ou 4 tenders, ou 6 wings |
| Box 2 | 2-3 personnes | 12,90 | 16,90 | 6 tenders + 6 wings, ou 12 tenders, ou 12 wings |
| Box 3 | 4-5 personnes | 27,90 | 31,90 | 16 tenders + 16 wings, ou 32 tenders, ou 32 wings |
| Box 4 | 6-7 personnes | 35,90 | 39,90 | 20 tenders + 20 wings, ou 40 tenders, ou 40 wings |

### Smash burgers (prix seul)
Smash Simple 6,50 · Smash Double 8,50 · Smash Chicken 6,50 · Smash Fish 6,50
Formule menu frites + boisson : +3,00 €

### Burgers (prix seul)
Tous avec sauce burger, crudités et cheddar, sauf indication.
| Burger | Prix | Composition |
|---|---|---|
| Cheese | 4,50 | Steak 80 g |
| Double Cheese | 6,50 | 2 steaks 80 g |
| Triple Cheese | 8,50 | 3 steaks 80 g |
| Chicken | 5,50 | Chicken |
| Fish | 5,50 | Fish, sauce fish |
| Bap's | 6,50 | Steak 80 g, rösti |
| Monster | 7,00 | Steak 80 g, tenders |
| Chèvre | 6,00 | Steak 80 g, chèvre |
| Raclette | 6,00 | Steak 80 g, raclette |
| Bacon | 6,50 | Steak 80 g, bacon |

Formule menu frites + boisson : +3,00 €

### Tex-Mex
Bouchées camembert, Jalapeños, Sticks mozza, Nuggets, Onion rings
Par 5 : 4,90 · Par 10 : 8,90

### Accompagnements
Frites : petite 2,00 · grande 3,00
Potatoes : petite 2,50 · grande 3,50

### Boissons 33 cl (dans les formules menu)
Coca-Cola, Coca-Cola Zéro, Fanta Orange, Oasis Tropical, Ice Tea Pêche, Eau

Pas de desserts.

**Le menu doit être stocké en base de données** (pas en dur dans le code), pour que le patron puisse plus tard changer un prix ou masquer un produit en rupture.

## Parcours client

1. Le client arrive sur le menu, **sans avoir besoin de compte** (mode invité).
2. Il touche un produit, choisit ses options ; le prix se met à jour en direct. Le bouton « Ajouter » reste bloqué tant que les choix obligatoires ne sont pas faits.
3. Il ouvre le panier : modifier les quantités, retirer un article, voir le total.
4. Il clique sur « Commander » :
   - **Invité** : prénom, nom et téléphone obligatoires (format français, 10 chiffres).
   - **Compte** (facultatif) : création avec e-mail et mot de passe ; prénom, nom et téléphone pré-remplis aux commandes suivantes, historique des commandes.
5. Retrait : « dès que possible » (pas de créneaux pour l'instant).
6. Paiement par carte via Stripe Checkout.
7. Après paiement confirmé : page de confirmation avec le **numéro de commande** en très grand et le statut en direct (Reçue → En préparation → Prête).

## Numéro de commande

- Entier de **1 à 999**, remis à **1 chaque jour** (jour calculé en Europe/Paris).
- Attribué **uniquement quand le paiement est confirmé** (webhook Stripe `checkout.session.completed`), pas avant.
- Attribution sans doublon même si deux commandes arrivent en même temps : utiliser une fonction Postgres avec verrou ou un compteur par jour mis à jour de façon atomique.

## Écran patron (`/patron`)

- Protégé par connexion (compte patron uniquement, rôle vérifié côté serveur).
- Pensé pour une tablette posée au comptoir : gros textes, gros boutons.
- Les nouvelles commandes payées apparaissent **en temps réel** (Supabase Realtime) avec un **son** (activé par un bouton au démarrage, car les navigateurs bloquent le son automatique).
- Chaque commande affiche : numéro, prénom et nom, téléphone, heure, détail des articles et options, total.
- Boutons de statut : Reçue → En préparation → Prête. Le client voit le changement en direct sur sa page de confirmation.
- Filtre : en cours / terminées, uniquement le jour en cours par défaut.

## Données (proposition)

- `categories`, `products`, `option_groups`, `options` : le menu
- `orders` : id, numéro du jour, date, client (prénom, nom, téléphone), user_id facultatif, total, statut paiement, statut préparation, id session Stripe
- `order_items` : produit, quantité, options choisies, prix unitaire au moment de la commande
- `profiles` : infos client liées au compte
- Activer la **Row Level Security** : un client ne voit que ses propres commandes ; seul le patron voit tout.

## Sécurité

- **Le prix est toujours recalculé côté serveur** à partir de la base, jamais celui envoyé par le navigateur.
- Vérifier la signature des webhooks Stripe.
- Aucune clé secrète dans le code envoyé au navigateur.
- Refuser les commandes en dehors des horaires d'ouverture, côté serveur aussi.

## Ordre de construction

1. **Site sans serveur** : menu, personnalisation, panier, formulaire, numéro de commande simulé. Reprendre `prototype.html`. Montrer le résultat au propriétaire.
2. **Supabase** : guider la création du compte et du projet, créer les tables, charger le menu, comptes clients, enregistrement des commandes, écran patron en temps réel.
3. **Stripe** : guider la création du compte, d'abord en **mode test** (cartes de test), webhook, numéro de commande à la confirmation.
4. **Mise en ligne** sur Vercel, puis passage de Stripe en mode réel **seulement avec l'accord du propriétaire**.
5. Bonus plus tard : SMS ou notification quand la commande est prête, impression de tickets, gestion des ruptures de stock depuis l'écran patron.

## Fichiers fournis

- `prototype.html` : maquette validée (design et parcours)
- `public/logo.png` : logo Chicken King
- `public/tacos.png` : photo du tacos sur fond blanc (les autres photos produits viendront plus tard ; en attendant, utiliser des vignettes texte comme dans le prototype)

## Points encore à confirmer avec le propriétaire

- Liste exacte des boissons 33 cl
- Contenu exact des formules menu des Chicken Box (nombre de frites et de boissons)
- Photos des autres produits
- Mentions légales, CGV et politique de confidentialité (obligatoires pour vendre en ligne en France) : proposer des modèles à faire relire
