// Programme du Silo 18, niveau par niveau.
// « Canon » : lieu ou fait montré ou cité dans la série (épisode entre parenthèses).
// « Supposé » : emplacement ou fonction déduits (niveau exact inconnu, livres de Hugh Howey, cohérence).
import { NLEV } from '../config';

export type ZoneId = 'haut' | 'mids' | 'basmids' | 'bas';
export const ZONES: Record<ZoneId, { name: string; short: string; color: string; range: [number, number] }> = {
  haut: { name: 'Up Top · le Haut', short: 'UP TOP', color: '#d9b36a', range: [1, 49] },
  mids: { name: 'Mids · le Milieu', short: 'MIDS', color: '#7fb0a0', range: [50, 104] },
  basmids: { name: 'Lower Mids · bas des Mids', short: 'LOWER MIDS', color: '#8c9fb8', range: [105, 129] },
  bas: { name: 'Down Deep · les Profondeurs', short: 'DOWN DEEP', color: '#c7704a', range: [130, 144] },
};
export const zoneOf = (n: number): ZoneId => (n <= 49 ? 'haut' : n <= 104 ? 'mids' : n <= 129 ? 'basmids' : 'bas');

/** Type de niveau : pilote la génération (plan, façade, coque lointaine). */
export type LevelKind =
  | 'sommet' | 'logements' | 'bureaux' | 'marche' | 'ferme' | 'parc' | 'medical' | 'ecole'
  | 'moulin' | 'auberge' | 'mines' | 'approvisionnement' | 'eau' | 'mecanique' | 'fond';

/** Équipements repérables : pilotent le placement de salles et de panneaux. */
export type PlaceKey =
  | 'cafeteria' | 'sherif' | 'cellule' | 'sas' | 'maire' | 'appart' | 'porteurs' | 'judiciaire' | 'reliques'
  | 'it' | 'serveurs' | 'coffre' | 'combinaisons' | 'observateurs' | 'recyclage' | 'bar' | 'controle' | 'marche'
  | 'ecole' | 'clinique' | 'pouponniere' | 'soins' | 'morgue' | 'moulin' | 'auberge' | 'mines' | 'ferme' | 'parc'
  | 'adjoints' | 'approvisionnement' | 'reserve' | 'eau' | 'relais' | 'barricade' | 'fonderie' | 'atelier'
  | 'cantine_meca' | 'tri' | 'dortoir' | 'electronique' | 'generateur' | 'breche' | 'reparation' | 'radio' | 'hydroponie' | 'planque';

export interface Place {
  key: PlaceKey;
  name: string;
  canon: boolean;
  /** Épisode(s) ou source. */
  ref?: string;
  /** Numéro d'appartement, d'occupant… */
  label?: string;
}

export interface LevelInfo {
  n: number;
  zone: ZoneId;
  kind: LevelKind;
  title: string;
  canon: boolean;
  places: Place[];
  desc: string;
  /** Précisions propres à la saison 3 (an 144). */
  s3?: string;
}

type Def = Omit<LevelInfo, 'n' | 'zone' | 'canon'> & { canon?: boolean };

const P = (key: PlaceKey, name: string, canon: boolean, ref?: string, label?: string): Place => ({ key, name, canon, ref, label });

// ---------------------------------------------------------------------------
// Niveaux documentés
// ---------------------------------------------------------------------------
const DEFS: Record<number, Def> = {
  1: {
    kind: 'sommet', title: 'Cafétéria et poste du shérif', canon: true,
    places: [
      P('cafeteria', 'Cafétéria du niveau 1', true, 'S1E1'),
      P('sherif', 'Poste du shérif du niveau 1', true, 'S1E1'),
      P('cellule', 'Cellule d’attente 3', true, 'S1E1'),
      P('sas', 'Sas vers l’extérieur', true, 'S1E1'),
    ],
    desc: 'Sommet du silo. La grande cafétéria occupe une large part de l’étage : ses tables font face à l’immense écran qui diffuse jour et nuit l’image du capteur extérieur (la colline morte, l’arbre sec, les corps des nettoyeurs). Les jours de nettoyage, les places s’obtiennent par tirage au sort. Au fond, le poste du shérif, la cellule d’attente 3 (lit, chaise, écran) et le sas qui mène dehors. Au-dessus du puits s’élève le dôme de béton nervuré et son globe de verre.',
    s3: 'An 144 : Juliette Nichols, revenue de l’extérieur sans mémoire, est devenue maire. Les réunions publiques hebdomadaires se tiennent ici.',
  },
  2: {
    kind: 'bureaux', title: 'Bureau du maire',
    places: [P('maire', 'Bureau du maire', true, 'S1E1 (niveau supposé)')],
    desc: 'Bureau du maire : un bureau et son terminal, des fauteuils pour recevoir, une collection d’alcools, et les registres tenus par chaque maire depuis la rébellion. La série ne donne pas son niveau ; il est placé ici, au plus près du poste du shérif.',
    s3: 'Juliette Nichols occupe désormais la fonction ; Robert Sims préside le nouveau Conseil du silo.',
  },
  4: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [], desc: 'Coursives calmes et appartements bien tenus du Haut. Le shérif adjoint Sam Marnes y passe pour rejoindre la maire Ruth Jahns (S1E2).' },
  6: {
    kind: 'logements', title: 'Appartement du shérif', canon: true,
    places: [P('appart', 'Appartement du shérif', true, 'S1E1', 'Holston et Allison Becker')],
    desc: 'Appartement de fonction du shérif, occupé par Holston et Allison Becker, puis par Juliette Nichols et enfin par Paul Billings et sa famille. Le miroir de la salle de bains cache une caméra des observateurs de l’IT (S1E6).',
  },
  8: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('recyclage', 'Station de recyclage', false)], desc: 'Juliette le traverse en descendant chercher ses affaires dans les Profondeurs (S1E4). Une des douze stations de recyclage y est placée ici par hypothèse.' },
  9: {
    kind: 'logements', title: 'Logements du Haut', canon: true,
    places: [P('appart', 'Appartement 9129', true, 'S1E4', 'Sam Marnes')],
    desc: 'Le shérif adjoint Sam Marnes vivait à l’appartement 9129, avec ses mots croisés et ses souvenirs de patrouille.',
  },
  10: {
    kind: 'bureaux', title: 'Répartition des porteurs', canon: true,
    places: [P('porteurs', 'Bureau de répartition des porteurs', true, 'S1E2')],
    desc: 'Le bureau de répartition (Dispatch) coordonne les porteurs, seuls autorisés à transporter les marchandises d’un niveau à l’autre. Les anciens porteurs, genoux usés, y finissent leur carrière. Le shérif y vérifie qui était dans l’escalier la nuit de la mort de George Wilkins.',
  },
  11: {
    kind: 'marche', title: 'Marché du Haut',
    places: [P('marche', 'Marché', false, 'S3E2 (niveau supposé)')],
    desc: 'Étals de tissus, de légumes et de pièces de récupération payés en crédits. La série montre un marché animé en saison 3 sans donner son niveau.',
    s3: 'C’est dans la foule d’un marché que Juliette échappe à son garde du corps (S3E2).',
  },
  12: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [], desc: 'La maire Jahns et le shérif adjoint Marnes le dépassent au début de leur longue descente vers le niveau 144 (S1E3).' },
  14: {
    kind: 'bureaux', title: 'Judiciaire', canon: true,
    places: [
      P('judiciaire', 'Bureaux du Judiciaire', true, 'S1E3'),
      P('judiciaire', 'Bureau de la juge Meadows', true, 'S1E7'),
      P('reliques', 'Salle des reliques', true, 'S1E6'),
    ],
    desc: 'Siège du Judiciaire, chargé de faire respecter le Pacte et de confisquer les reliques. Deux agents gardent l’entrée. Le bureau de la juge Mary Meadows a une fenêtre sur l’escalier ; derrière celui de Robert Sims, une chambre scellée conserve les reliques ensachées et numérotées.',
    s3: 'Robert Sims est devenu juge. Les bureaux sont souvent déserts (S3E4).',
  },
  15: {
    kind: 'logements', title: 'Allée des cadres', canon: true,
    places: [P('appart', 'Appartement de la juge Meadows', true, 'S1E7', 'Mary Meadows')],
    desc: 'L’allée des cadres (Manager’s Row) regroupe les logements des responsables. La juge Mary Meadows y habitait.',
  },
  16: { kind: 'ecole', title: 'École du Haut', places: [P('ecole', 'École', false, 'S3E3 (niveau supposé)')], desc: 'Salles de classe des enfants du Haut. Robert Sims y dépose son fils Anthony (S3E3) ; le niveau est supposé, proche de chez eux.' },
  17: {
    kind: 'logements', title: 'Logements du Haut', canon: true,
    places: [P('appart', 'Appartement des Sims', true, 'S1E5', 'Robert, Camille et Anthony Sims'), P('appart', 'Appartement 1727', true, 'S1E1', 'Gloria Hildebrandt')],
    desc: 'Ici vivent Robert, Camille et Anthony Sims, ainsi que Gloria Hildebrandt (appartement 1727) avant son internement aux soins de longue durée.',
  },
  19: {
    kind: 'bureaux', title: 'Département IT', canon: true,
    places: [
      P('it', 'Bureaux de l’IT', true, 'S1E1'),
      P('it', 'Bureau de Bernard Holland', true, 'S1E3'),
      P('serveurs', 'Salle des serveurs', true, 'S1E6'),
      P('coffre', 'Le Coffre', true, 'S1E10'),
      P('combinaisons', 'Salle des combinaisons', true, 'S3E1'),
    ],
    desc: 'Le département IT fait tourner les ordinateurs du silo. Ses bureaux ne dépendent pas du générateur : une ligne d’alimentation venue de l’extérieur les relie au Silo 1. Derrière la salle des serveurs, le Coffre, accessible au seul chef de l’IT, abrite le livre de l’Ordre et la Voix qui donne les instructions.',
    s3: 'Camille Sims dirige l’IT et reçoit les ordres de la Voix. Les Outsiders y volent un casque dans la salle des combinaisons.',
  },
  20: {
    kind: 'logements', title: 'Recyclage et salle des observateurs', canon: true,
    places: [P('recyclage', 'Station de recyclage d’Ellis', true, 'S1E4'), P('observateurs', 'Placard du concierge · salle des observateurs', true, 'S1E5')],
    desc: 'Une des douze stations de recyclage, tenue par Ellis : les biens de Holston Becker y ont été apportés. Un placard de concierge, gardé secret de père en fils, cache la salle des observateurs, où les écrans des caméras cachées surveillent tout le silo.',
  },
  22: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('appart', 'Appartement 2215', true, 'S1E4', 'Patrick et Doris Kennedy')], desc: 'Patrick et Doris Kennedy vivaient à l’appartement 2215. Après la mort de Doris, le Logement l’a relogé seul au même niveau.' },
  23: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [], desc: 'En fuyant le Judiciaire, Juliette enjambe la rambarde et atterrit sur la passerelle du niveau 23 (S1E9).' },
  24: { kind: 'ferme', title: 'Hydroponie du Haut', places: [P('hydroponie', 'Cultures hydroponiques', false)], desc: 'Bacs de culture sous lampes, légumes feuilles et herbes. Le silo nourrit ses dix mille habitants avec plusieurs étages de fermes ; celui-ci est supposé.' },
  26: { kind: 'logements', title: 'Le bar du 26', canon: true, places: [P('bar', 'Bar', true, 'S1E7')], desc: 'Un bar, saccagé un soir par des clients venus du bas des Mids (S1E7).' },
  27: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [], desc: 'Juliette et Paul Billings le traversent pendant l’enquête sur la mort de Sam Marnes (S1E4).' },
  29: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('appart', 'Appartement 2926', true, 'S1E4', 'Charles Martin')], desc: 'Charles Martin vivait à l’appartement 2926, dans la partie haute du niveau.' },
  30: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('controle', 'Poste de contrôle du Judiciaire', true, 'S1E8')], desc: 'Le Judiciaire y installe un poste de contrôle pendant la traque de Juliette et de la relique de niveau rouge (S1E8).' },
  31: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('appart', 'Appartement 31325', true, 'S1E4', 'Kelly Trudeau'), P('appart', 'Appartement de Regina Jackson', true, 'S1E6')], desc: 'Kelly Trudeau (appartement 31325) et Regina Jackson habitent ce niveau.' },
  36: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('appart', 'Appartement de Douglas Trumbull', true, 'S1E6')], desc: 'Douglas Trumbull, agent du Judiciaire et meurtrier de la maire Jahns, vivait ici.' },
  40: { kind: 'parc', title: 'Le Parc', places: [P('parc', 'Parc', true, 'S1E3 (niveau supposé)')], desc: 'Arbres, pelouses et tables de pique-nique sous des lampes de jour. La maire Jahns et Sam Marnes y déjeunent pendant leur descente (S1E3). Le niveau n’est pas donné ; il se situe entre l’IT (19) et le centre médical (50).' },
  42: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('appart', 'Appartement 42311', true, 'S1E1', 'George Wilkins (an 126)')], desc: 'George Wilkins a vécu à l’appartement 42311 à partir de l’an 126, d’après son dossier.' },
  45: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [P('appart', 'Appartement 4529', true, 'S1E4', 'Franky Brown')], desc: 'Franky Brown vivait à l’appartement 4529.' },
  47: { kind: 'logements', title: 'Logements du Haut', canon: true, places: [], desc: 'Pendant la course vers le sommet, les coureurs passent le niveau 47 au moment où Juliette poursuit Trumbull dans l’escalier (S1E4).' },
  50: { kind: 'medical', title: 'Début des Mids · centre médical', canon: true, places: [P('clinique', 'Centre médical', true, 'S1E3')], desc: 'Le niveau 50 marque le début des Mids. Le docteur Pete Nichols, père de Juliette, y exerce au centre médical.' },
  52: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [P('appart', 'Appartement 52346', true, 'S1E4', 'Wayne Gantry')], desc: 'Wayne Gantry vit à l’appartement 52346. Les observateurs y remplacent des caméras par d’autres, prises à l’hôpital des Mids (S1E7).' },
  55: { kind: 'marche', title: 'Marché des Mids', places: [P('marche', 'Marché', false), P('reparation', 'Réparation informatique', true, 'S1E1 (niveau supposé)')], desc: 'Marché des Mids. George Wilkins y tenait un petit stand de réparation informatique où il a ouvert le disque dur avec Allison Becker (S1E1) ; le niveau exact n’est pas donné.' },
  59: { kind: 'moulin', title: 'Le moulin', canon: true, places: [P('moulin', 'Moulin', true, 'S2E5'), P('appart', 'Appartement 109', true, 'S2E3', 'Rick et Phoebe Wells')], desc: 'Le moulin broie le grain du silo. Il tombe en panne une semaine sur deux, et les porteurs doivent alors descendre les bacs de grain vers les moulins inférieurs (S2E5).' },
  61: { kind: 'logements', title: 'Recyclage des Mids', canon: true, places: [P('recyclage', 'Station de recyclage', true, 'S1E4')], desc: 'Une des douze stations de recyclage. Juliette y apporte les affaires de sa mère et de son frère après leur mort.' },
  62: {
    kind: 'medical', title: 'Hôpital des Mids', canon: true,
    places: [P('clinique', 'Hôpital des Mids', true, 'S1E7'), P('pouponniere', 'Pouponnière', true, 'S1E3'), P('soins', 'Soins de longue durée', true, 'S1E7'), P('morgue', 'Morgue', true, 'S1E2 (niveau supposé)')],
    desc: 'Hôpital des Mids : la pouponnière du docteur Nichols et de l’infirmière Alice, et les soins de longue durée des infirmières Amy et Tim, où Gloria Hildebrandt est internée. Juliette s’y cache dans la pouponnière pendant la traque (S1E8).',
  },
  63: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [P('appart', 'Appartement 63324', true, 'S1E4', 'Ralf Melby')], desc: 'Ralf Melby vit à l’appartement 63324.' },
  68: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [P('appart', 'Appartement 68328', true, 'S1E1', 'George Wilkins (an 130)')], desc: 'George Wilkins a habité l’appartement 68328 à partir de l’an 130.' },
  69: { kind: 'auberge', title: 'L’auberge', places: [P('auberge', 'Auberge', true, 'S1E1 (niveau supposé)')], desc: 'Auberge pour les voyageurs de l’escalier, avec un grand réfectoire commun. Allison Becker y dort le soir du Jour de la Liberté, pendant qu’une troupe joue une pièce sur la rébellion (S1E1). Elle se trouve « après le niveau 68 ».' },
  70: { kind: 'mines', title: 'Entrée des mines', canon: true, places: [P('mines', 'Entrée des mines', true, 'S1E2'), P('porteurs', 'Station de porteurs de Calvin', true, 'S2E5')], desc: 'Entrée des mines, où le Judiciaire envoie les condamnés (possession de relique, union non autorisée). Station de porteurs tenue par Calvin. Juliette s’y arrête pour boire après son arrestation (S1E9).', s3: 'Camille fait gazer les galeries pour tuer Lukas Kyle, qui creusait vers la ligne d’alimentation (S3E3).' },
  72: { kind: 'ecole', title: 'École des Mids', canon: true, places: [P('ecole', 'École', false)], desc: 'Le cousin de l’adjoint Hank vit ici et lui demande si ses enfants peuvent aller à l’école sans danger (S1E4). L’école est placée ici par hypothèse.' },
  73: { kind: 'logements', title: 'La planque d’Asa', canon: true, places: [P('planque', 'Planque d’Asa', true, 'S2E5')], desc: 'Camille Sims y cache Knox et Shirley, cernés par une foule, chez son contact Asa (S2E5).' },
  76: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [P('appart', 'Appartement 76213', true, 'S1E1', 'George Wilkins (naissance, an 112)')], desc: 'George Wilkins est né à l’appartement 76213 en l’an 112.' },
  78: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [P('appart', 'Appartement 78329', true, 'S1E1', 'George Wilkins (an 114)')], desc: 'Hanna Haslam est née dans l’escalier à ce niveau. Les haut-parleurs du 78 annoncent la coupure de huit heures pour réparer le générateur (S1E3).' },
  79: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [P('radio', 'Point radio', true, 'S1E5')], desc: 'Juliette y monte tard le soir pour parler en secret à Martha Walker par radio (S1E6).' },
  80: { kind: 'ferme', title: 'Les fermes', canon: true, places: [P('ferme', 'Fermes', true, 'S1E3')], desc: 'Une partie des fermes : champs de blé sous lampes, cultures et élevage. Pendant la coupure du générateur, l’adjoint LaFontaine signale que tout est calme jusqu’aux fermes (S1E3).' },
  87: { kind: 'logements', title: 'Quartiers de la reconstruction', canon: true, places: [P('breche', 'La Brèche', true, 'S3E1')], desc: 'Après la rébellion, Knox et Shirley s’installent ici pour superviser la reconstruction de l’escalier.', s3: 'La bombe de la rébellion a arraché l’escalier : c’est « la Brèche ». Des palans provisoires, pourtant interdits par le Pacte, font passer gens et charges pendant les travaux.' },
  90: { kind: 'logements', title: 'Cafétéria des Mids', canon: true, places: [P('cafeteria', 'Cafétéria des Mids', true, 'S2E10 (niveau supposé)'), P('adjoints', 'Poste des adjoints des Mids', true, 'S2E10 (niveau supposé)')], desc: 'Cafétéria des Mids, avec son écran sur l’extérieur. Pendant la rébellion, elle sert de prison d’appoint aux meneurs arrêtés, à côté du poste des adjoints des Mids (S2E10).' },
  92: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [], desc: 'Knox et Shirley, déguisés en porteurs, y sont repérés dans l’escalier (S2E5).' },
  98: { kind: 'logements', title: 'Logements des Mids', canon: true, places: [], desc: 'Y vit l’homme qui a autrefois dénoncé Patrick Kennedy pour contrefaçon (S1E9).' },
  105: { kind: 'logements', title: 'Poste des adjoints du 105', canon: true, places: [P('adjoints', 'Poste des adjoints', true, 'S1E4')], desc: 'Poste des adjoints du shérif. On le dit « bas des Mids » ou déjà « Profondeurs ». Sandy y demande sa mutation après la mort de Holston et de Sam Marnes.' },
  110: { kind: 'approvisionnement', title: 'Approvisionnement', places: [P('approvisionnement', 'Approvisionnement (Supply)', true, 'S1E3 (niveau supposé)'), P('reserve', 'Réserve critique', true, 'S2')], desc: 'Magasins du service Approvisionnement, gardés par des chiens : Juliette les distrait avec du bacon pour voler du ruban thermique (S1E3). La réserve critique, sous clé, garde les biens impossibles à fabriquer dans le silo.' },
  120: { kind: 'logements', title: 'La rambarde du 120', canon: true, places: [P('barricade', 'Barricade', true, 'S2E6')], desc: 'George Wilkins est passé par-dessus la rambarde à ce niveau (S1E1). Après l’envoi de Juliette au nettoyage, la plupart des caméras de l’IT sous le 120 ont été détruites. En saison 2, la barricade y est déplacée depuis le 130.' },
  122: { kind: 'ferme', title: 'Ferme du bas des Mids', canon: true, places: [P('ferme', 'Ferme', true, 'S2E6')], desc: 'La ferme du bas des Mids. Sa perte, cédée aux insurgés de Mechanical avec dix niveaux, vaut à l’équipe de Bernard une sévère réprimande (S2E6).' },
  124: { kind: 'logements', title: 'Logements des Profondeurs', canon: true, places: [P('appart', 'Appartement de Carla McLain', true, 'S1E10', 'Carla McLain')], desc: 'Carla McLain, cheffe de l’Approvisionnement, vit à ce niveau.' },
  125: { kind: 'logements', title: 'Logements des Profondeurs', canon: true, places: [], desc: 'Enfant, Robert Sims voit la famille de son harceleur, Richard Elliot, mutée ici : son père, prétendu concierge, avait arrangé le transfert (S1E5).' },
  126: { kind: 'logements', title: 'Relais de l’IT', canon: true, places: [P('relais', 'Relais de signal de l’IT', true, 'S1E10'), P('recyclage', 'Station de recyclage', true, 'S1E10')], desc: 'Un relais de signal de l’IT et une station de recyclage.' },
  128: { kind: 'eau', title: 'Traitement des eaux', places: [P('eau', 'Traitement des eaux', false)], desc: 'Bassins de décantation, filtres et pompes. Le silo recycle toute son eau ; l’emplacement est supposé.', s3: 'En saison 3, Camille prévoit d’ajouter la « vitamine D+ », un produit d’oubli, à l’eau du silo (S3E3).' },
  130: { kind: 'mecanique', title: 'Mechanical · la barricade', canon: true, places: [P('barricade', 'Barricade', true, 'S2E5'), P('atelier', 'Ateliers de Mechanical', false)], desc: 'Début du domaine de Mechanical. Après le meurtre de la juge Meadows, une barricade est dressée ici dans l’escalier pour empêcher Knox et Shirley de regagner Mechanical (S2E5).' },
  132: { kind: 'mecanique', title: 'Fonderie', places: [P('fonderie', 'Fonderie', false)], desc: 'Fonderie et atelier de forge de Mechanical : on refond ici le métal récupéré.' },
  135: { kind: 'mecanique', title: 'Cafétéria de Mechanical', places: [P('cantine_meca', 'Cafétéria de Mechanical', true, 'S1E2 (niveau supposé)')], desc: 'Grande salle aux nombreuses tables, avec son écran sur l’extérieur. On y fête le passage d’un apprenti (la fête d’ombre de Terry Cooper) et on y suit les nettoyages.' },
  137: { kind: 'mecanique', title: 'Tri et récupération', places: [P('tri', 'Salle de récupération et chaîne de tri', true, 'S1E4 (niveau supposé)')], desc: 'La chute d’ordures traverse tout le silo et aboutit ici : ce qui se répare remonte vers le recyclage, le reste part à l’incinérateur. L’affectation à l’équipe de récupération est une punition.' },
  138: { kind: 'mecanique', title: 'Poste des adjoints des Profondeurs', places: [P('adjoints', 'Poste des adjoints des Profondeurs', true, 'S2E3 (niveau supposé)')], desc: 'Poste des adjoints des Profondeurs. Teddy y est détenu pour ses graffitis « Juliette vit » ; l’émeute qui suit coûte la vie à Terry Cooper et à un manifestant (S2E3).' },
  140: { kind: 'mecanique', title: 'Chez Juliette', canon: true, places: [P('appart', 'Appartement de Juliette Nichols', true, 'S1E2'), P('dortoir', 'Dortoirs de Mechanical', false)], desc: 'Juliette Nichols vivait ici, dans un petit appartement : un lit et un coin séjour.' },
  144: {
    kind: 'fond', title: 'Niveau 144 · le fond', canon: true,
    places: [P('electronique', 'Atelier d’électronique de Martha Walker', true, 'S1E2'), P('appart', 'Appartement 14413', true, 'S1E1', 'George Wilkins (an 141)'), P('generateur', 'Salle du générateur', true, 'S1E1')],
    desc: 'Dernier niveau du silo. Martha Walker, qui ne quitte jamais les Profondeurs, y tient son atelier d’électronique encombré d’appareils à réparer. Au sol, les bouches de ventilation de la salle du générateur, juste en dessous.',
  },
};

// ---------------------------------------------------------------------------
// Niveaux non documentés : fonction plausible selon la zone
// ---------------------------------------------------------------------------
const FARMS = new Set([25, 81, 82, 83, 96, 97, 118, 119, 121]);
const SCHOOLS = new Set([34, 86]);
const MARKETS = new Set([33, 75, 100, 114]);
const RECYCLING = new Set([32, 44, 85, 97, 109, 118, 136]);   // + 8, 20, 61, 126 : douze stations
const SUPPLY = new Set([111, 112]);
const MECH_SPECIAL: Record<number, [string, string]> = {
  131: ['Ateliers de Mechanical', 'Tours, établis et pièces détachées. Mechanical entretient ici pompes, moteurs et tuyauteries du silo.'],
  133: ['Ateliers de Mechanical', 'Ateliers de chaudronnerie et de soudure.'],
  134: ['Dortoirs de Mechanical', 'Dortoirs et logements des familles de Mechanical, plus bruyants et plus libres qu’ailleurs.'],
  136: ['Recyclage des Profondeurs', 'Une station de recyclage et des ateliers de remise en état.'],
  139: ['Pompes et ventilation', 'Salles des pompes de drainage et des grands ventilateurs qui font circuler l’air du silo.'],
  141: ['Dortoirs de Mechanical', 'Logements d’ouvriers de Mechanical.'],
  142: ['Ateliers de Mechanical', 'Magasins de pièces et ateliers de rebobinage des moteurs.'],
  143: ['Ateliers de Mechanical', 'Ateliers de Mechanical, au-dessus du fond du silo.'],
};

function generic(n: number): Def {
  const z = zoneOf(n);
  if (FARMS.has(n)) return { kind: 'ferme', title: n < 50 ? 'Hydroponie du Haut' : n < 105 ? 'Fermes des Mids' : 'Fermes du bas', places: [P('ferme', 'Cultures', false)], desc: 'Étage de cultures sous lampes : blé, légumes et vergers nains, avec de petits élevages. Emplacement supposé : il faut plusieurs étages de fermes pour nourrir dix mille personnes.' };
  if (SCHOOLS.has(n)) return { kind: 'ecole', title: 'École', places: [P('ecole', 'École', false)], desc: 'Salles de classe et petite cour couverte. Emplacement supposé.' };
  if (MARKETS.has(n)) return { kind: 'marche', title: 'Marché', places: [P('marche', 'Marché', false)], desc: 'Étals, ateliers de couture et de réparation, échoppes de nourriture. Emplacement supposé.' };
  if (SUPPLY.has(n)) return { kind: 'approvisionnement', title: 'Approvisionnement', places: [P('approvisionnement', 'Entrepôts', false)], desc: 'Entrepôts de l’Approvisionnement : casiers numérotés, balances, guichet de distribution. Emplacement supposé.' };
  if (z === 'bas') {
    const [t, d] = MECH_SPECIAL[n] ?? ['Mechanical', 'Domaine de Mechanical : ateliers, tuyauteries, logements d’ouvriers.'];
    return { kind: 'mecanique', title: t, places: [P('atelier', t, false)], desc: d };
  }
  const rec = RECYCLING.has(n) ? [P('recyclage', 'Station de recyclage', false)] : [];
  const title = z === 'haut' ? 'Logements du Haut' : z === 'mids' ? 'Logements des Mids' : 'Logements du bas des Mids';
  const desc = z === 'haut'
    ? 'Appartements du Haut, plus spacieux et mieux éclairés : familles de cadres, employés de l’IT et du Judiciaire.'
    : z === 'mids'
      ? 'Appartements serrés des Mids, petits commerces et ateliers en façade ; le cœur populaire du silo.'
      : 'Logements plus modestes du bas des Mids, entre les fermes et les ateliers des Profondeurs.';
  return { kind: 'logements', title, places: rec, desc: desc + (rec.length ? ' Une des douze stations de recyclage est placée ici par hypothèse.' : '') };
}

export const LEVELS: LevelInfo[] = [];
for (let n = 1; n <= NLEV; n++) {
  const d = DEFS[n] ?? generic(n);
  const canon = d.canon ?? d.places.some((p) => p.canon && !(p.ref ?? '').includes('supposé'));
  LEVELS.push({ n, zone: zoneOf(n), canon, ...d });
}
export const levelInfo = (n: number) => LEVELS[Math.max(1, Math.min(NLEV, n)) - 1];

/** Espaces sous le niveau 144 (vue d'ensemble). */
export const BELOW = [
  {
    key: 'generateur', title: 'Salle du générateur', canon: true,
    desc: 'Sous le niveau 144, une salle de plusieurs étages abrite le générateur. Il tourne à la vapeur haute pression, venue d’une source inconnue installée par les Fondateurs, et alimente tout le silo sauf l’IT. Une salle de contrôle vitrée domine la turbine. En saison 1, Juliette et Terry Cooper redressent une aube faussée pendant une coupure de huit heures (S1E3).',
  },
  {
    key: 'dalle', title: 'La dalle de trente pieds', canon: true,
    desc: 'Une dalle de béton de neuf mètres d’épaisseur scelle la cavité où repose la machine qui a creusé le silo.',
  },
  {
    key: 'cavite', title: 'La cavité du forage', canon: true,
    desc: 'Cylindre de plusieurs niveaux de haut, aussi large que le silo, au sol couvert d’une fine couche d’eau. La machine de forage y a été « abandonnée sur place » : un corps central de plusieurs étages et huit bras de trois foreuses. George Wilkins y avait installé son campement et ses reliques. Un tunnel mène à une immense porte circulaire, le Coffre avancé, où parle la Voix.',
  },
];

/** Au-dessus du niveau 1. */
export const ABOVE = [
  { key: 'dome', title: 'Le dôme', canon: true, desc: 'Coupole de béton nervurée percée de panneaux lumineux, coiffée au centre d’un grand globe de verre posé sur le noyau de l’escalier.' },
  { key: 'dehors', title: 'L’extérieur', canon: true, desc: 'Terre morte sous un ciel brun. Depuis le sas, une rampe remonte vers la colline surveillée par le capteur. Au loin, les tours en ruine d’une grande ville et, disséminées alentour, les têtes des autres silos. Dans le casque des nettoyeurs, une simulation montre au contraire un monde verdoyant.' },
];
