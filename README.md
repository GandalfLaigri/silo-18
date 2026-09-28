# Silo 18

Balade en 3D voxel dans le Silo 18 de la série *Silo* (Apple TV+) : 144 niveaux reliés par un seul escalier,
du dôme du niveau 1 jusqu'à la salle du générateur et la cavité du forage. Three.js + TypeScript + Vite,
moteur repris de Cité-ruche (voxels de 0,1 m).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # version statique dans dist/
```

Paramètres d'URL : `?niveau=62` (niveau de départ), `?epoque=s3` (saison 3, après la rébellion).

Réglages (Échap) : luminosité, **gamma** (double-clic pour revenir à 1), niveaux détaillés (±2 à ±4 :
à baisser sur une machine modeste), résolution, halo, occlusion. Choix de conception : [CONCEPTION.md](CONCEPTION.md).

## Commandes

| Touche | Action |
| --- | --- |
| ZQSD / WASD | marcher (Maj : courir) · Espace : sauter |
| Tab | vue d'ensemble en coupe (fiche de chaque niveau, « Visiter ce niveau ») |
| M | lieux notables des niveaux chargés |
| E | interagir (sas, capteur) |
| V | visière du casque : simulation / réalité (dehors) |
| F | vol libre (Espace monter, C descendre) |
| N | jour / nuit · H : masquer l'aide · Échap : menu |

## Contenu

- **Architecture** : noyau central, escalier hélicoïdal (30 marches par niveau), paliers et passerelles,
  coursives à colonnes et bagues lumineuses, façades percées, couloir circulaire, logements meublés.
- **Lieux canon** (saisons 1 à 3) : cafétéria et écran géant, poste du shérif, cellule 3, sas ; bureau du maire ;
  Judiciaire et salle des reliques ; IT, salle des serveurs, le Coffre ; salle des observateurs ; hôpital des Mids ;
  moulin ; mines ; fermes ; Approvisionnement ; Mechanical ; atelier de Martha ; salle du générateur ;
  cavité et machine de forage, campement de George, porte du Coffre avancé ; la Brèche (saison 3).
  Les emplacements non donnés par la série sont marqués « supposé » dans les fiches (`src/world/levels.ts`).
- **Dehors** : sas interactif, combinaison, visière qui montre le faux monde vert, capteur à nettoyer,
  corps des nettoyeurs, arbre mort, ville en ruine, autres silos dont le Silo 17.
- **Écrans** : la vue du capteur est rendue en direct sur les écrans des cafétérias et de la cellule 3.

## Structure

- `src/gen/` : génération (workers) — `atrium.ts` (puits), `plan.ts`, `interior.ts`, `special.ts`, `civic.ts`,
  `work.ts`, `deep.ts` (fond), `gap.ts` (Brèche), `outside.ts` (surface), `level.ts`, `worker.ts`.
- `src/world/voxel2d.ts` : formes courbes voxelisées (anneaux, secteurs) ; `levels.ts` : programme des 144 niveaux.
- `src/silo.ts` : chargement des niveaux proches, coques lointaines instanciées, collisions par tranche.
- `src/overview.ts`, `src/outside.ts`, `src/airlock.ts`, `src/props.ts`, `src/render/`.
