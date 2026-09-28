# Silo 18 — document de conception

Balade immersive en 3D voxel dans le Silo 18 de la série *Silo* (Apple TV+), du dôme du niveau 1
jusqu'à la cavité du forage, avec une vue d'ensemble en coupe qui décrit chaque niveau.
Projet personnel. Le moteur vient de **Cité-ruche** (dossier voisin).

---

## 1. Décisions prises

| Sujet | Décision |
| --- | --- |
| Canon | La série fait foi ; les romans de Hugh Howey complètent quand elle se tait |
| Spoilers | Saisons 1 à 3 : deux époques au choix, saison 1 (an 143) et saison 3 (an 144, après la rébellion) |
| Rôle du joueur | Observateur : on marche, on descend l'escalier, on regarde, on écoute |
| Rendu | Voxels de 0,1 m (moteur de Cité-ruche), formes courbes voxelisées en 2D |
| Chargement | Les niveaux proches sont construits en détail par des workers, les autres sont des coques simplifiées instanciées |
| Vue d'ensemble | Coupe du silo dans les strates du sol, liste des 144 niveaux, fiche par niveau, « Visiter ce niveau » |
| Extérieur | Oui, par le sas : combinaison, visière (simulation / réalité), capteur à nettoyer, oxygène limité |
| Langue | Tout en français (interface, panneaux, annonces vocales) |

---

## 2. Dimensions

La série ne donne ni plan ni cotes : les valeurs ci-dessous sont déduites des images
(proportions de l'escalier, des coursives et de la salle du générateur) puis arrondies.

| Élément | Valeur |
| --- | --- |
| Niveaux | 144, hauteur d'étage 6 m (dalle 0,6 m) : environ 864 m du niveau 1 au niveau 144 |
| Silo | Rayon 41,2 m (paroi extérieure à 40 m) |
| Escalier | Noyau Ø 4,8 m, marches jusqu'à 6,4 m du centre ; 30 contremarches de 20 cm par niveau ; paliers alternés à 0° / 180° |
| Puits central | Coursives à 16 m du centre, 12 colonnes à bagues lumineuses, façades à 20,4 m |
| Plan d'un étage | Zone A (20,8–27 m), couloir circulaire (27,2–29,2 m), zone B (29,4–40 m) ; passages tous les 90° |
| Sous le niveau 144 | Salle du générateur (21 m), dalle de 9,1 m (les « 30 pieds »), cavité du forage (30 m) |
| Surface | Le dôme coiffe le niveau 1 ; le sol extérieur est à +26 m ; rampe de sortie en pente de 30 % |

---

## 3. Programme des niveaux

Quatre zones : le **Haut** (1–49), les **Mids** (50–104), le **bas des Mids** (105–129) et
**Mechanical** / les Profondeurs (130–144). Les numéros vus dans la série sont repris.
Quand elle ne situe pas un lieu, l'emplacement est choisi pour rester cohérent et la fiche le
marque **« supposé »**.

- **Canon (série)**, entre autres : cafétéria, écran géant, poste du shérif, cellule et sas (1) ; appartement
  du shérif (6) ; porteurs (10) ; Judiciaire et salle des reliques (14) ; IT, salle des serveurs
  et Coffre (19) ; salle des observateurs (20) ; bar (26) ; centre médical (50) ; moulin (59) ;
  hôpital des Mids (62) ; mines (70) ; fermes (80, 122) ; Brèche (87, saison 3) ;
  école des Mids (72) ; cafétéria des Mids (90) ; relais de l'IT (126) ; barricade de Mechanical (130) ;
  atelier de Juliette (140) ; le fond, l'atelier de Martha et le générateur (144).
- **Supposé** : bureau du maire (2), marchés, école du Haut, parc, auberge, Approvisionnement,
  traitement des eaux, fonderie, tri, et les étages de logements et de cultures qui comblent
  le reste. Il faut plusieurs étages de fermes pour nourrir dix mille personnes.
- Le programme complet, avec les épisodes cités, est dans `src/world/levels.ts`.

---

## 4. Moteur

- **Voxels** : le moteur empile des boîtes (12 triangles au plus chacune) ; le shader dessine le
  quadrillage de 0,1 m. Les murs courbes passent par un voxeliseur 2D (anneaux, secteurs,
  rectangles orientés) qui fusionne les rangées en grands rectangles. Leurs normales sont lissées :
  sans cela, chaque marche du voxel crée une rayure.
- **Chargement** : 2 à 4 workers génèrent les niveaux (≈ 130 ms chacun). Les niveaux à ±3
  autour du joueur (réglable de ±2 à ±4) sont affichés en détail ; ceux de ±4 et ±5 restent en
  mémoire mais sont remplacés à l'écran par leur coque, pour éviter de les reconstruire en
  faisant demi-tour. Les coques lointaines sont instanciées par tranches de 6 niveaux, ce qui
  laisse la caméra écarter les tranches hors du champ.
- **Collisions** : une couche par niveau chargé, des boîtes mobiles (palan, portes du sas) et une
  hauteur analytique pour le terrain extérieur.
- **Rendu** : éclairage par un pool de lumières proches, occlusion ambiante en espace écran,
  halo, étalonnage final (teinte, grain, gamma). Les écrans des cafétérias et de la cellule
  affichent en direct l'image d'une caméra placée sur le capteur.
- **Extérieur** : terrain en quadtree de chunks voxel, ciel, autres silos, ville en ruine.
  La visière bascule le shader entre le monde réel et la simulation verte.

---

## 5. Réglages

Menu (Échap) : époque, niveau de départ, halo, occlusion, annonces, niveaux détaillés,
résolution, sensibilité, luminosité, gamma (double-clic : valeur par défaut), champ de vision,
volume. La luminosité, le gamma et le détail sont mémorisés dans le navigateur.

---

## 6. Limites connues, pistes

- Au-delà du rayon de détail, les coques ne gardent que le puits, les façades et quelques volumes.
- Les figurants suivent des trajets fixes et ne réagissent pas au joueur.
- Le relief extérieur garde ses marches de 20 cm : elles restent visibles de près.
- Pistes : sons propres à chaque lieu, porteurs qui descendent réellement l'escalier.
