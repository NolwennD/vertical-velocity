# Vertical Velocity — spécification de conception

Date : 2026-08-26

## Objectif

Une page web qui charge un fichier GPX issu d'un enregistrement de sortie sportive et
affiche le profil altimétrique de la trace, en surlignant chaque partie montante et en
indiquant sa vitesse ascensionnelle moyenne.

Tout le traitement se fait dans le navigateur. Aucune trace n'est transmise sur le réseau.

## Périmètre

Inclus :

- chargement d'un fichier GPX par sélecteur de fichier ou glisser-déposer
- détection automatique des parties montantes
- profil altimétrique annoté et tableau détaillé des montées
- vitesse ascensionnelle calculée sur le temps de mouvement et sur le temps total
- interface anglais / français avec sélecteur
- publication sur GitHub Pages et GitLab Pages

Exclus :

- comparaison entre plusieurs sorties, historique, stockage des traces
- conversion d'unités (pieds, miles) : tout est métrique
- analyse des descentes, de la fréquence cardiaque, de la puissance
- seuils réglables depuis l'interface

## Définitions

**Vitesse ascensionnelle** : dénivelé positif d'un segment divisé par sa durée, exprimé en
mètres par heure (m/h). Calculée deux fois par montée, sur le temps de mouvement et sur le
temps total.

**Partie montante** (ou montée) : portion de la trace dont l'altitude lissée croît, après
fusion des creux mineurs et rejet des segments trop courts ou trop plats. Critères exacts
au chapitre « Algorithme ».

**Temps de mouvement** : temps total du segment moins les arrêts détectés.

**Arrêt** : portion durant laquelle la position reste dans un rayon de 6 m pendant au moins
10 secondes consécutives.

## Interface

Trois zones empilées dans une page unique.

### Zone de dépôt

Un cadre acceptant le glisser-déposer d'un `.gpx`, cliquable pour ouvrir le sélecteur de
fichier. Une fois un fichier chargé, elle se réduit à une ligne indiquant le nom du fichier
et permettant d'en changer.

### Profil altimétrique

Altitude en fonction de la **distance**, et non du temps : le profil reste ainsi
reconnaissable et une pause ne l'étire pas. Courbe remplie, en gris neutre, tracée sur
l'altitude lissée pour rester cohérente avec les chiffres annoncés.

Chaque montée détectée est surlignée par une bande verticale colorée et numérotée, portant
une étiquette courte de la forme `① 940 m/h`. Seule la vitesse ascensionnelle en temps de
mouvement figure sur le graphe ; afficher les deux mesures sur chaque bande le rendrait
illisible. Le survol d'une bande ouvre une infobulle avec le détail complet.

### Tableau des montées

Une ligne par montée : numéro, altitude de départ, altitude d'arrivée, dénivelé positif,
distance, pente moyenne, temps de mouvement, temps total, vitesse ascensionnelle en
mouvement, vitesse ascensionnelle totale. Une ligne de synthèse agrège l'ensemble des
montées.

Survoler une ligne du tableau surligne la bande correspondante sur le graphe, et
inversement.

### Sélecteur de langue

Un `<select>` discret en haut à droite de la page.

## Architecture

Vite + TypeScript, sans framework d'interface. Chart.js et `chartjs-plugin-annotation` pour
le rendu du graphe : le plugin fournit nativement les bandes annotées, ce dont dépend tout
l'affichage. uPlot serait plus léger mais imposerait de dessiner les bandes à la main ;
ECharts offre `markArea` en natif mais pèse près d'un mégaoctet.

**Dépendances d'exécution : `chart.js`, `chartjs-plugin-annotation` et `@tmcw/togeojson`.**

Le parsing GPX s'appuie sur `@tmcw/togeojson`, de loin la plus utilisée des librairies du
domaine — environ 1,2 million de téléchargements mensuels, contre 50 000 pour la suivante.
Sans dépendance, sous licence BSD-2, typée. C'est le choix conservateur : elle absorbe les
variantes du format (GPX 1.0 et 1.1, espaces de noms, extensions) qu'un parseur maison
finirait par rencontrer.

Elle convertit vers GeoJSON, une forme qui n'est pas la nôtre : les horodatages atterrissent
dans `properties.coordinateProperties.times`, séparés de la géométrie. **Un adaptateur
absorbe cet écart** — `gpx/togeojson-adapter.ts` implémente le contrat déclaré par
`gpx/parser.ts`, qui ne connaît que `Track` et les erreurs du domaine. Aucun autre
module ne voit passer de GeoJSON. Changer de librairie, ou revenir à `DOMParser`, revient
alors à écrire un second adaptateur.

L'extraction des montées, elle, n'emploie aucune dépendance, faute d'équivalent : aucune
librairie JS ne fait de détection de segments montants. C'est de toute façon le cœur de
l'application, dont la valeur tient entièrement aux seuils retenus.

**Gestionnaire de paquets : pnpm** (11.24.0 sur la machine de développement, Node 24.10.0).
Le champ `packageManager` du `package.json` fige la version, et `pnpm-lock.yaml` est
versionné. Les deux CI installent avec `--frozen-lockfile`, ce qui fait échouer le build si
le verrou et le `package.json` divergent, plutôt que de résoudre silencieusement des
versions différentes de celles testées en local.

Un module a une responsabilité. Tout ce qui calcule est une fonction pure ne touchant
jamais au DOM, donc testable sans navigateur.

```
src/
  constants.ts                 DEFAULTS : les seuils de l'algorithme, commentés
  gpx/
    parser.ts                  contrat : GpxParser, TrackPoint, Track, erreurs
    togeojson-adapter.ts       implémentation du contrat via @tmcw/togeojson
  analysis/
    geo.ts                     haversine, distances cumulées
    smooth.ts                  médiane 5 points puis moyenne glissante 30 m
    stops.ts                   arrêts (6 m / 10 s), coupures d'enregistrement (60 s)
    climbs.ts                  découpage, fusion des creux, filtrage
    vertical-velocity.ts       métriques par montée → Climb[]
  i18n/
    index.ts                   détection, mémorisation, fonction t()
    en.ts                      dictionnaire anglais
    fr.ts                      dictionnaire français
  ui/
    dropzone.ts                sélecteur de fichier et glisser-déposer
    chart.ts                   Chart.js et bandes annotées
    table.ts                   tableau, survol synchronisé avec le graphe
    language-select.ts         sélecteur de langue
  main.ts                      câblage, orchestration, affichage des erreurs
  styles.css
```

Le vocabulaire du code n'emploie pas l'acronyme « VAM » : les champs et modules portent la
forme développée `verticalVelocity` / `vertical-velocity`.

### Testabilité

Pas de conteneur d'injection de dépendances. La testabilité vient de la pureté des
fonctions, pas d'un mécanisme de câblage : `smooth(points)` ou `detectClimbs(points)`
prennent des données et rendent des données, il n'y a rien à y injecter. Un conteneur
ajouterait de l'indirection sur un projet dont les coutures avec l'extérieur se comptent
sur les doigts d'une main.

**La règle qui en tient lieu : aucune lecture de variable globale enfouie dans la logique.**
Ce qui vient de l'extérieur entre par un paramètre. Concrètement :

| Couture | Traitement |
|---|---|
| Parseur GPX | `GpxParser` est un type de fonction, passé en paramètre |
| `navigator.languages` | `detect(languages)` reçoit la liste, ne la lit pas |
| `localStorage` | une interface de stockage en paramètre, en mémoire dans les tests |
| Seuils | paramètre à valeur par défaut : `detectClimbs(points, thresholds = DEFAULTS)` |
| Chart.js | rien à injecter, le rendu se vérifie dans un vrai navigateur |

Le passage des seuils en paramètre est ce qui permet de vérifier les règles de fusion et de
filtrage — qu'un creux de 8 m fusionne et qu'un creux de 25 m sépare — sans fabriquer des
données autour de valeurs figées ni simuler un module. `constants.ts` ne contient plus que
l'objet `DEFAULTS`.

### Modèle de données

```ts
type TrackPoint = {
  lat: number;
  lon: number;
  ele: number;      // mètres, altitude brute
  time: Date;
};

// Une trace exploitable : au moins deux points. Le type interdit d'exprimer les
// cas qui n'ont pas de sens, pour qu'aucune fonction d'analyse n'ait à les
// traiter. La garantie est établie une seule fois, par le parsing, et se propage
// ensuite à tout le pipeline. Reste un tableau, donc utilisable partout où l'on
// attend `readonly TrackPoint[]`.
type Track = readonly [TrackPoint, TrackPoint, ...TrackPoint[]];

// Le contrat que tout adaptateur de parsing doit remplir. Il ne mentionne ni
// GeoJSON ni XML : le reste de l'application ignore d'où viennent les points.
type GpxParser = (xml: string) => Track;

type Climb = {
  startIdx: number;
  endIdx: number;
  gain: number;                      // mètres, mesuré sur l'altitude lissée
  distance: number;                  // mètres
  avgGrade: number;                  // fraction (0.075 pour 7,5 %)
  movingS: number;                   // secondes, hors arrêts
  elapsedS: number;                  // secondes, du premier au dernier point
  verticalVelocityMoving: number;    // m/h
  verticalVelocityElapsed: number;   // m/h
};
```

### Flux de données

`main.ts` enchaîne : fichier → texte → `parse` → `TrackPoint[]` → distances cumulées →
altitude lissée → détection des arrêts → découpage des montées → métriques → rendu du
graphe et du tableau. Seul `main.ts` et les modules `ui/` touchent au DOM.

## Algorithme

### 1. Extraction

Tous les `<trkpt>` porteurs de latitude, longitude, `<ele>` et `<time>`. Plusieurs
`<trkseg>` sont concaténés en une seule série. Les points auxquels il manque l'altitude ou
l'heure sont ignorés silencieusement.

### 2. Distances

Formule de haversine entre points consécutifs, cumulée. Sert d'axe X et de dénominateur
pour la pente.

### 3. Lissage de l'altitude

Deux passes successives :

1. **Filtre médian sur 5 points**, qui supprime les altitudes aberrantes isolées — un
   altimètre décroche parfois brutalement sur un ou deux points.
2. **Moyenne glissante sur une fenêtre de 30 mètres de distance**, et non sur un nombre
   fixe de points : la fréquence d'enregistrement varie selon l'appareil (1 s, 5 s, ou
   « intelligent »), une fenêtre exprimée en mètres donne le même lissage partout.

### 4. Arrêts et coupures

Un **arrêt** est une portion maximale de points restant tous dans un rayon de 6 m autour du
premier point de la portion, et dont la durée atteint 10 secondes. Le temps correspondant
est retiré du temps de mouvement.

Rayon et durée forment ensemble une vitesse implicite : rester dans 6 m pendant 10 s
correspond à moins de 2,2 km/h. Au-dessus, on marche ; en dessous, on piétine. Le rayon est
volontairement proche de la précision horizontale d'un GPS à ciel ouvert, afin qu'un point
immobile y reste et qu'un point qui progresse en sorte.

Un intervalle de plus de 60 secondes entre deux points est traité comme une **coupure
d'enregistrement** (montre mise en pause) : ce temps n'est compté ni comme mouvement ni
comme arrêt.

### 5. Découpage des montées

1. Repérer les suites de points dont l'altitude lissée croît.
2. Fusionner deux suites voisines si le creux qui les sépare perd moins de 10 m sur moins
   de 200 m. Un col comporte des replats et des faux plats descendants ; sans cette
   tolérance, une montée de 600 m serait découpée en une quinzaine de morceaux et chaque
   vitesse perdrait son sens.
3. Ne conserver que les segments d'au moins 20 m de dénivelé positif et 2 % de pente
   moyenne. En dessous, il s'agit d'une bosse ou d'une dérive de l'altimètre. Le seuil de
   pente écarte en outre les longues portions gagnant 20 m sur 3 km.

### 6. Métriques

Dénivelé positif mesuré sur l'altitude lissée. Vitesse ascensionnelle = dénivelé divisé par
la durée en heures, calculée une fois sur le temps de mouvement et une fois sur le temps
total.

### Seuils

Tous rassemblés et commentés dans l'objet `DEFAULTS` de `src/constants.ts`, que chaque
fonction d'analyse reçoit en paramètre par défaut.

| Constante | Valeur | Rôle |
|---|---|---|
| `MEDIAN_WINDOW_POINTS` | 5 | Largeur du filtre médian sur l'altitude |
| `SMOOTHING_WINDOW_M` | 30 | Fenêtre de la moyenne glissante, en mètres |
| `STOP_RADIUS_M` | 6 | Rayon en deçà duquel la position est jugée inchangée |
| `STOP_MIN_DURATION_S` | 10 | Durée minimale d'immobilité constituant un arrêt |
| `RECORDING_GAP_S` | 60 | Au-delà, l'intervalle est une coupure d'enregistrement |
| `MERGE_MAX_DROP_M` | 10 | Perte d'altitude tolérée dans un creux fusionné |
| `MERGE_MAX_DISTANCE_M` | 200 | Longueur tolérée d'un creux fusionné |
| `MIN_CLIMB_GAIN_M` | 20 | Dénivelé minimum pour retenir une montée |
| `MIN_CLIMB_GRADE` | 0.02 | Pente moyenne minimum pour retenir une montée |

`STOP_RADIUS_M` est le seuil le plus sensible. En trail raide, en ski de randonnée dans de
la neige lourde ou en portage, on progresse parfois sous 2 km/h : l'algorithme classerait
alors du véritable effort comme un arrêt et surestimerait la vitesse ascensionnelle en
mouvement. C'est le premier réglage à revoir après essai sur une trace réelle.

## Internationalisation

Anglais et français, anglais par défaut. Pas de librairie : la page compte une trentaine de
chaînes et `i18next` pèserait plus lourd que le reste du code.

**Détection** : `navigator.languages` est parcouru dans l'ordre, la première langue
disposant d'un dictionnaire est retenue, sinon l'anglais.

**Mémorisation** : un choix explicite est enregistré en `localStorage` et prime sur la
détection aux visites suivantes.

**Changement de langue** : les textes, en-têtes de tableau, titres d'axes et messages
d'erreur sont réécrits, l'attribut `lang` de `<html>` est mis à jour et le graphe est
redessiné avec ses nouveaux libellés. Les données déjà chargées ne sont pas recalculées.

**Nombres** : tous formatés via `Intl.NumberFormat` avec la locale active, jamais par
concaténation de chaînes — le séparateur décimal diffère entre `940.5` et `940,5`.

**Unités** : mètres et m/h dans toutes les langues. La langue de l'interface et le système
d'unités sont deux réglages distincts ; mêler l'un au dictionnaire compliquerait les
calculs pour un besoin non exprimé.

## Gestion des erreurs

Chaque cas affiche un message explicite à la place du graphe.

| Cas | Comportement |
|---|---|
| Le fichier n'est pas du XML, ou pas un GPX | Message « fichier GPX invalide » |
| Moins de deux `<trkpt>` exploitables | Message « aucun point de trace » — cas des GPX ne contenant qu'un `<rte>`, ou d'une trace d'un seul point, dont on ne peut tirer ni distance, ni durée, ni montée |
| Aucun `<ele>` | Message « altitude absente » — fréquent sur les traces de planificateurs |
| Aucun `<time>` | Message « horodatage absent ». Sans temps, aucune vitesse n'est calculable : on ne montre rien plutôt qu'un profil qui laisserait croire à une analyse |
| Aucune montée au-dessus des seuils | Le profil est affiché, avec une note indiquant qu'aucune montée d'au moins 20 m n'a été trouvée |
| Points isolés sans altitude ou sans heure | Ignorés silencieusement |

## Qualité

**Lint et formatage** : Biome. Un seul outil, une seule dépendance, un fichier de config,
exécution quasi instantanée.

**Analyse statique** : TypeScript en mode `strict`, avec `noUncheckedIndexedAccess` — le
code indexe en permanence des tableaux de points, et ce drapeau force à traiter le cas hors
bornes. Un script `typecheck` lance `tsc --noEmit` indépendamment du build, afin que la
vérification de types soit une étape de CI pouvant échouer seule. **knip** repère les
exports, fichiers et dépendances devenus inutiles.

**Hook de pré-commit** : **lefthook**, limité au formatage. Le hook lance
`biome format --write` sur les seuls fichiers indexés, puis réindexe ce qu'il a modifié
(`stage_fixed: true`) — c'est précisément la partie fastidieuse à écrire à la main, et la
raison de préférer lefthook à un script `.git/hooks` maison.

Le hook ne fait rien d'autre : il ne bloque jamais un commit. Le lint bloquant, la
vérification de types et les tests restent lancés à la main pendant le développement, et de
façon systématique en CI. Un commit reste ainsi instantané, tout en gardant un dépôt dont
le formatage ne bouge jamais.

**Mutation** : le code de l'analyse évite la mutation. Les données arrivent propres du
parsing et sont transformées sans être altérées ; aucun effet de bord dans un `map`, un
`filter` ou un `reduce`. Là où un parcours linéaire l'impose — une somme courante ne s'écrit
pas en O(n) sans accumulateur — la mutation reste locale à la fonction, qui demeure pure vue
du dehors.

### Tests unitaires (Vitest et fast-check)

Chaque règle est d'abord examinée sous l'angle de l'**invariant** : existe-t-il quelque
chose de vrai sur toutes les entrées, et pas seulement sur les trois exemples retenus ?
`fast-check` engendre alors des centaines d'entrées et réduit le contre-exemple quand la
propriété tombe. Les exemples chiffrés restent nécessaires : la propriété dit ce qui est
toujours vrai, l'exemple dit ce qui est vrai ici, et une propriété seule passerait sur une
implémentation qui rend systématiquement zéro.

### Tests de mutation (Stryker)

Lancés en dernier, une fois l'analyse couverte par ses propriétés, et hors du chemin
critique de publication. Stryker altère le code — inverse une comparaison, décale une borne
— et relance les tests : un mutant survivant désigne une ligne que rien ne vérifie. C'est ce
qui dit si les seuils sont réellement testés.

### Détail des tests unitaires

Un fichier par module d'analyse, sur des traces synthétiques construites à la main.

- `geo` — distance entre deux coordonnées connues
- `smooth` — un pic isolé disparaît, une rampe régulière reste intacte
- `stops` — une pause de 30 s est retirée, un ralentissement de 6 s ne l'est pas, un
  intervalle de 10 min est traité comme coupure
- `climbs` — un profil en dents de scie donne le nombre attendu de montées ; un creux de
  8 m fusionne, un creux de 25 m sépare, une bosse de 15 m est rejetée
- `vertical-velocity` — dénivelé et durée connus donnent les m/h attendus
- `togeojson-adapter` — GPX valide, sans altitude, sans heure, à plusieurs `<trkseg>` ;
  chaque cas d'erreur remonte comme erreur du domaine, jamais comme fuite de GeoJSON. Ces
  tests ne visent que l'adaptateur : écrits contre le contrat `GpxParser`, ils resteront
  valables pour toute implémentation ultérieure.
- `i18n` — `['fr-FR', 'en']` donne le français, `['de-DE']` l'anglais, un choix mémorisé
  l'emporte sur les deux

### Tests d'interface (Playwright)

Playwright plutôt que jsdom pour une raison précise : Chart.js dessine dans un `<canvas>`,
que jsdom n'implémente pas. Playwright pilote un vrai navigateur et sait alimenter un
`<input type="file">`.

- charger un GPX de référence : le tableau liste le nombre attendu de montées avec les
  bonnes valeurs
- charger un GPX sans altitude : le message d'erreur s'affiche, pas le graphe
- basculer la langue : en-têtes traduits et séparateur décimal correct
- déposer un fichier par glisser-déposer : même résultat que par le sélecteur
- survoler une ligne du tableau : la bande correspondante réagit

## Publication

`vite.config.ts` avec `base: './'`, produisant des URL d'actifs relatives. Le build
fonctionne indifféremment à la racine d'un domaine ou dans un sous-chemin de type
`/vertical-velocity/`, sans reconfiguration selon l'hébergeur.

Deux fichiers de CI coexistent dans le dépôt, chaque plateforme ignorant celui de l'autre :

- `.github/workflows/deploy.yml` — GitHub Actions, publication via `actions/deploy-pages`
- `.gitlab-ci.yml` — job `pages` : GitLab exige que l'artefact publié se nomme `public/`,
  le job copie donc `dist/` vers `public/` après le build

Enchaînement identique des deux côtés : `pnpm install --frozen-lockfile` → lint →
typecheck → tests unitaires → tests Playwright → build → publication. Un échec à n'importe
quelle étape empêche la mise en ligne. Les CI activent pnpm via Corepack et installent le
navigateur Playwright avant les tests d'interface.

## Jeux d'essai

Deux traces versionnées dans `tests/fixtures/`. Aucune trace personnelle n'entre dans le
dépôt : il est destiné à être public.

**Trace synthétique** — générée de toutes pièces avec des montées et des arrêts aux valeurs
choisies. Les résultats attendus étant connus exactement, les assertions sont précises et
stables.

**`real-file-anonymised.gpx`** — extrait d'une sortie réelle, déjà produit et vérifié. Il
apporte le bruit GPS authentique que la génération synthétique ne sait pas imiter, et
couvre les cas voulus : trois montées, dont une avec arrêt et une coupure d'enregistrement.
Il sert de test de non-régression à valeurs figées, et de support à la validation manuelle
des seuils en fin d'implémentation. L'anonymisation ayant préservé distances, altitudes et
intervalles de temps, aucune trace non anonymisée n'est nécessaire.
