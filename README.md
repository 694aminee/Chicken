# Chicken King — commande en ligne (click & collect)

Site de commande du snack Chicken King. Voir `CLAUDE.md` pour le cahier des charges complet.

## Où en est-on ?

**Étape 1 terminée : le site sans serveur.**
Menu, personnalisation des produits, panier, formulaire client, numéro de commande simulé,
page de confirmation avec statut, et écran patron de démonstration (`/patron`).

Pour l'instant tout est gardé dans la mémoire du navigateur : aucune vraie commande n'est
envoyée et aucun paiement n'est fait. Supabase (étape 2) puis Stripe (étape 3) viendront ensuite.

## Lancer le site sur un ordinateur

Il faut [Node.js](https://nodejs.org) (version 20 ou plus).

```bash
npm install      # une seule fois : télécharge les outils
npm run dev      # démarre le site sur http://localhost:3000
```

En dehors des horaires (11:00 – 23:00, heure de Paris), le site affiche « Fermé » et bloque
les commandes. Pour tester quand même, créer un fichier `.env.local` contenant :

```
NEXT_PUBLIC_TOUJOURS_OUVERT=1
```

(À ne jamais mettre sur le site en ligne.)

## Pages

| Adresse | Contenu |
|---|---|
| `/` | Menu |
| `/commandes` | Commandes du jour du client |
| `/commande/…` | Confirmation : numéro de commande et statut en direct |
| `/infos` | Horaires, adresse, téléphone |
| `/patron` | Écran patron (démo : commandes de ce navigateur) |

Astuce : ouvre `/patron` dans un 2ᵉ onglet ; quand tu changes le statut d'une commande,
la page de confirmation du client se met à jour toute seule.

## Où est quoi ?

- `src/lib/menu.ts` : le menu et les prix (ira en base de données à l'étape 2)
- `src/lib/pricing.ts` : calcul des prix et vérification des choix
- `src/lib/hours.ts` : horaires d'ouverture
- `src/components/` : les morceaux d'écran (panneaux, panier, écran patron…)
- `src/app/` : les pages
- `prototype.html` : la maquette validée
