# The Girly Club — site vitrine avec visite 3D

Site mobile-first du club de sport **The Girly Club** (Vaulx-en-Velin) :
accueil vidéo, visite 3D interactive du club, disciplines, tarifs et infos pratiques.

**Technologies** : Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · React Three Fiber / Drei (3D).

## Lancer le site sur son ordinateur

```bash
cd girly-club
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

## Où modifier quoi ?

| Je veux changer…                        | Fichier                                   |
| --------------------------------------- | ----------------------------------------- |
| Le lien Planity, TikTok, adresse, horaires, dates Black Friday | `src/lib/site.ts`  |
| Les prix, les disciplines, les abonnements | `src/data/disciplines.ts`              |
| La vidéo d'accueil                      | déposer `public/videos/hero.mp4` (+ `hero-poster.jpg`) |
| Le logo                                 | `src/components/Logo.tsx`                 |
| Les mentions légales (à compléter !)    | `src/app/mentions-legales/page.tsx`       |
| La salle 3D et ses équipements          | `src/components/three/`                   |

### La visite 3D

- `three/equipment.tsx` : les équipements dessinés avec des formes simples (Reformer, sac de frappe,
  cabine d'aquabike, haltères, médecine-ball). Ils pourront être remplacés plus tard par de vrais
  modèles 3D (fichiers `.glb` dans `public/models/`, chargés avec `useGLTF` de Drei).
- `three/hotspots.ts` : les points cliquables (position de l'étiquette, point visé par la caméra).
- `three/ClubScene.tsx` : la scène, la caméra (rotation limitée pour ne pas se perdre) et les étiquettes.
- `three/ClubTour.tsx` : la section de la page (chargement différé, bulle d'info, boutons).

Performances : la 3D n'est téléchargée que lorsque la section approche de l'écran, le rendu se met
en pause quand elle n'est plus visible, et sur téléphone la page défile normalement tant que la
visiteuse n'a pas touché « Explorer en 3D ».

## Mise en ligne sur Vercel

1. Créer un compte gratuit sur https://vercel.com (bouton « Sign Up » → « Continue with GitHub »).
2. Cliquer sur « Add New… » → « Project » → choisir le dépôt GitHub.
3. Dans **Root Directory**, cliquer sur « Edit » et choisir le dossier `girly-club`.
4. Laisser les autres réglages par défaut (Vercel détecte Next.js tout seul) → « Deploy ».

Aucune clé secrète n'est nécessaire pour ce site.
