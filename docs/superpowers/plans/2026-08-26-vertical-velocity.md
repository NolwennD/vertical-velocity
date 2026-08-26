# Vertical Velocity — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une page web qui charge un GPX, détecte les parties montantes et affiche pour chacune sa vitesse ascensionnelle moyenne, sur un profil altimétrique annoté doublé d'un tableau.

**Architecture :** tout s'exécute dans le navigateur. Le parsing est isolé derrière un adaptateur ; l'analyse est une suite de fonctions pures recevant leurs seuils en paramètre ; seuls `main.ts` et `ui/` touchent au DOM.

**Tech Stack :** Vite, TypeScript, Chart.js + chartjs-plugin-annotation, @tmcw/togeojson, Vitest, Playwright, Biome, lefthook, pnpm.

**Spec :** [`docs/superpowers/specs/2026-08-26-vertical-velocity-design.md`](../specs/2026-08-26-vertical-velocity-design.md)

## Global Constraints

- Gestionnaire de paquets : **pnpm** 11.5.1, figé par le champ `packageManager`. Node 24.10.0.
- Dépendances d'exécution limitées à **`chart.js`**, **`chartjs-plugin-annotation`**, **`@tmcw/togeojson`**. Aucune autre sans décision explicite.
- TypeScript en mode **`strict`** avec **`noUncheckedIndexedAccess`**.
- Le vocabulaire du code n'emploie jamais l'acronyme « VAM » : forme développée `verticalVelocity` / `vertical-velocity`.
- Unités **métriques** partout : mètres, m/h. Aucune conversion en pieds.
- Tout nombre affiché passe par **`Intl.NumberFormat`** avec la locale active. Jamais de concaténation.
- **Aucune lecture de variable globale enfouie dans la logique.** Ce qui vient de l'extérieur entre par un paramètre : parseur, `navigator.languages`, stockage, seuils.
- Les fonctions d'analyse reçoivent les seuils en **paramètre à valeur par défaut** : `f(..., t: Thresholds = DEFAULTS)`.
- `vite.config.ts` avec **`base: './'`**.
- Langue par défaut : **anglais**.
- Commits en français, à l'auteur du dépôt, **sans ligne de co-auteur**.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/constants.ts` | Type `Thresholds` et objet `DEFAULTS` — les neuf seuils commentés |
| `src/gpx/parser.ts` | Contrat : `TrackPoint`, `GpxParser`, `GpxError` et ses codes |
| `src/gpx/togeojson-adapter.ts` | Implémentation du contrat via `@tmcw/togeojson` |
| `src/analysis/geo.ts` | Haversine, distances cumulées |
| `src/analysis/smooth.ts` | Médiane 5 points puis moyenne glissante 30 m |
| `src/analysis/stops.ts` | Arrêts (6 m / 10 s), coupures d'enregistrement (60 s), ventilation du temps |
| `src/analysis/climbs.ts` | Découpage en suites montantes, fusion des creux, filtrage |
| `src/analysis/vertical-velocity.ts` | Type `Climb`, métriques par montée, pipeline `analyse()` |
| `src/i18n/index.ts` | Détection, mémorisation, `t()`, formatage des nombres |
| `src/i18n/en.ts`, `src/i18n/fr.ts` | Dictionnaires |
| `src/ui/dropzone.ts` | Sélecteur de fichier et glisser-déposer |
| `src/ui/chart.ts` | Profil Chart.js et bandes annotées |
| `src/ui/table.ts` | Tableau des montées, survol synchronisé |
| `src/ui/language-select.ts` | Sélecteur de langue |
| `src/main.ts` | Câblage, orchestration, affichage des erreurs |
| `tests/fixtures/` | Trace synthétique et `real-file-anonymised.gpx` |

## Note sur les tests

Chaque tâche décrit ses tests sous forme de **règles** et d'**exemples**, à la manière de
l'example mapping. La règle énonce le comportement attendu ; les exemples donnent les cas
concrets à couvrir. Les questions ouvertes sont signalées et doivent être tranchées avant
d'écrire le test, pas pendant.

L'implémenteur écrit les assertions lui-même, en respectant le cycle : test rouge d'abord,
implémentation minimale ensuite, test vert, commit.

---

### Task 1 : Socle du projet

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `lefthook.yml`, `index.html`, `src/main.ts`, `src/styles.css`

**Interfaces:**
- Consumes: rien
- Produces: les scripts `dev`, `build`, `preview`, `lint`, `format`, `typecheck`, `test`, `test:e2e`

- [ ] **Step 1 : Initialiser le projet**

`pnpm init`, puis renseigner `"packageManager": "pnpm@11.5.1"` et `"type": "module"`.

- [ ] **Step 2 : Installer les dépendances**

```bash
pnpm add chart.js chartjs-plugin-annotation @tmcw/togeojson
```

```bash
pnpm add -D vite typescript @biomejs/biome vitest lefthook knip
```

- [ ] **Step 3 : Configurer TypeScript**

`tsconfig.json` avec `strict: true`, `noUncheckedIndexedAccess: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `noEmit: true`, `lib: ["ES2022", "DOM"]`.

- [ ] **Step 4 : Configurer Vite**

`vite.config.ts` exportant `defineConfig({ base: './' })`.

- [ ] **Step 5 : Configurer Biome et lefthook**

`biome.json` : lint et format activés. `lefthook.yml` : un hook `pre-commit` lançant `biome format --write` sur les fichiers indexés, avec `stage_fixed: true`. Le hook ne lance **ni** lint bloquant, **ni** tests, **ni** typecheck. Installer avec `pnpm lefthook install`.

- [ ] **Step 6 : Page minimale**

`index.html` avec les conteneurs vides : `#dropzone`, `#chart`, `#table`, `#message`, `#language`. `src/main.ts` réduit à un log. `src/styles.css` vide.

- [ ] **Step 7 : Déclarer les scripts**

`dev`, `build`, `preview`, `lint` (`biome check`), `format` (`biome format --write`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `knip`.

- [ ] **Step 8 : Vérifier le socle**

Lancer `pnpm lint`, `pnpm typecheck`, `pnpm build`. Les trois doivent réussir. Lancer `pnpm dev` et constater que la page se charge sans erreur de console.

- [ ] **Step 9 : Commit**

```bash
git add -A && git commit -m "Met en place le socle Vite, TypeScript, Biome et lefthook"
```

---

### Task 2 : Seuils et contrat de parsing

**Files:**
- Create: `src/constants.ts`, `src/gpx/parser.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  ```ts
  export type Thresholds = {
    medianWindowPoints: number;   // 5
    smoothingWindowM: number;     // 30
    stopRadiusM: number;          // 6
    stopMinDurationS: number;     // 10
    recordingGapS: number;        // 60
    mergeMaxDropM: number;        // 10
    mergeMaxDistanceM: number;    // 200
    minClimbGainM: number;        // 20
    minClimbGrade: number;        // 0.02
  };
  export const DEFAULTS: Thresholds;

  export type TrackPoint = { lat: number; lon: number; ele: number; time: Date };
  export type GpxErrorCode = 'invalid-xml' | 'no-track-points' | 'no-elevation' | 'no-time';
  export class GpxError extends Error { readonly code: GpxErrorCode }
  export type GpxParser = (xml: string) => TrackPoint[];
  ```

- [ ] **Step 1 : Écrire les deux fichiers**

Chaque seuil de `DEFAULTS` porte un commentaire d'une ligne rappelant ce qu'il décide. `GpxError` transporte un `code` typé, jamais un message libre : c'est lui que l'interface traduit.

- [ ] **Step 2 : Vérifier**

`pnpm typecheck` et `pnpm lint` passent. Pas de test unitaire : ce sont des déclarations.

- [ ] **Step 3 : Commit**

```bash
git add -A && git commit -m "Déclare les seuils par défaut et le contrat de parsing GPX"
```

---

### Task 3 : Géométrie

**Files:**
- Create: `src/analysis/geo.ts`, `tests/geo.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`
- Produces:
  ```ts
  export function haversine(a: TrackPoint, b: TrackPoint): number;          // mètres
  export function cumulativeDistances(points: readonly TrackPoint[]): number[];
  ```

**Tests — intention**

> **Règle : `haversine` rend la distance orthodromique en mètres.**
> - deux points séparés d'un degré de latitude → ≈ 111 320 m, à 0,1 % près
> - deux points identiques → 0
> - l'ordre des arguments ne change pas le résultat

> **Règle : `cumulativeDistances` rend un tableau de même longueur que l'entrée, croissant, commençant à 0.**
> - trois points alignés espacés de 100 m → `[0, 100, 200]`
> - un seul point → `[0]`
> - tableau vide → `[]`

- [ ] **Step 1 : Écrire les tests des deux règles ci-dessus, et les voir échouer**

Run: `pnpm test geo` — attendu : échec, module introuvable.

- [ ] **Step 2 : Implémenter `geo.ts`**

Rayon terrestre 6 371 000 m.

- [ ] **Step 3 : Voir les tests passer**

Run: `pnpm test geo`

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "Ajoute le calcul des distances haversine"
```

---

### Task 4 : Adaptateur de parsing

**Files:**
- Create: `src/gpx/togeojson-adapter.ts`, `tests/togeojson-adapter.test.ts`, `tests/fixtures/minimal.gpx`
- Move: `real-file-anonymised.gpx` → `tests/fixtures/real-file-anonymised.gpx`

**Interfaces:**
- Consumes: `TrackPoint`, `GpxParser`, `GpxError`, `GpxErrorCode`
- Produces: `export const parseGpx: GpxParser;`

**Tests — intention**

Les tests visent le **contrat**, pas la librairie : ils doivent rester valables si l'adaptateur est un jour remplacé. Aucun test ne mentionne GeoJSON.

> **Règle : un GPX valide devient une suite de `TrackPoint` dans l'ordre du fichier.**
> - trois `<trkpt>` avec `<ele>` et `<time>` → trois points, coordonnées et altitudes exactes, `time` en `Date`
> - deux `<trkseg>` consécutifs → les points sont concaténés en une seule suite
> - `tests/fixtures/real-file-anonymised.gpx` → 3422 points

> **Règle : les défaillances remontent en `GpxError` portant un code du domaine.**
> - une chaîne qui n'est pas du XML → code `invalid-xml`
> - un XML bien formé sans aucun `<trkpt>` → code `no-track-points`
> - un GPX dont aucun point ne porte `<ele>` → code `no-elevation`
> - un GPX dont aucun point ne porte `<time>` → code `no-time`
> - aucune erreur ne laisse fuir un message ou un type venu de la librairie

> **Règle : les points partiellement renseignés sont ignorés sans faire échouer le parsing.**
> - sur cinq points dont un sans `<ele>` → quatre points rendus
> - sur cinq points dont un sans `<time>` → quatre points rendus

> **Question à trancher avant d'écrire le test** : un fichier où *certains* points portent
> `<ele>` et d'autres non doit-il rendre les points valides, ou lever `no-elevation` ?
> Décision retenue : rendre les points valides, et ne lever `no-elevation` que si **aucun**
> point n'en porte. Le fichier reste exploitable tant qu'il subsiste des points complets.

- [ ] **Step 1 : Déplacer la fixture réelle**

```bash
mkdir -p tests/fixtures && git mv real-file-anonymised.gpx tests/fixtures/ 2>/dev/null || mv real-file-anonymised.gpx tests/fixtures/
```

- [ ] **Step 2 : Écrire `tests/fixtures/minimal.gpx`**

Un GPX 1.1 de trois points, altitudes et horodatages explicites, sans extensions.

- [ ] **Step 3 : Écrire les tests des trois règles, et les voir échouer**

Run: `pnpm test togeojson-adapter`

- [ ] **Step 4 : Implémenter l'adaptateur**

`toGeoJSON.gpx()` rend une `FeatureCollection`. Les altitudes sont la troisième composante des coordonnées ; les horodatages vivent dans `properties.coordinateProperties.times`. L'adaptateur réunit les deux, filtre les points incomplets et traduit toute défaillance en `GpxError`.

- [ ] **Step 5 : Voir les tests passer**

Run: `pnpm test togeojson-adapter`

- [ ] **Step 6 : Commit**

```bash
git add -A && git commit -m "Ajoute l'adaptateur de parsing GPX et les fixtures de test"
```

---

### Task 5 : Lissage de l'altitude

**Files:**
- Create: `src/analysis/smooth.ts`, `tests/smooth.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`, `Thresholds`, `DEFAULTS`
- Produces:
  ```ts
  export function smoothElevations(
    points: readonly TrackPoint[],
    cumulative: readonly number[],
    t?: Thresholds,
  ): number[];
  ```

**Tests — intention**

> **Règle : le filtre médian supprime les altitudes aberrantes isolées.**
> - une rampe régulière dont un seul point est décalé de +40 m → le pic disparaît
> - deux points aberrants **consécutifs** au milieu d'une fenêtre de 5 → sont encore corrigés
> - trois points aberrants consécutifs → ne le sont plus, et c'est le comportement attendu d'une médiane sur 5

> **Règle : la moyenne glissante travaille sur une fenêtre exprimée en mètres, pas en points.**
> - deux traces de même géométrie, l'une échantillonnée toutes les secondes, l'autre toutes les cinq secondes → altitudes lissées comparables à 1 m près
> - une rampe régulière → reste une rampe, altitudes inchangées à 0,5 m près
> - une vraie rupture de pente (plat puis 8 %) → conservée, non rabotée

> **Règle : la sortie a toujours la longueur de l'entrée.**
> - tableau vide → tableau vide
> - un seul point → un seul élément, égal à son altitude

- [ ] **Step 1 : Écrire les tests des trois règles, et les voir échouer**

Run: `pnpm test smooth`

- [ ] **Step 2 : Implémenter `smooth.ts`**

Deux passes. La fenêtre glissante est centrée : elle s'étend de part et d'autre du point courant jusqu'à couvrir `smoothingWindowM` au total, soit la moitié de chaque côté.

- [ ] **Step 3 : Voir les tests passer**

Run: `pnpm test smooth`

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "Ajoute le lissage de l'altitude"
```

---

### Task 6 : Arrêts et ventilation du temps

**Files:**
- Create: `src/analysis/stops.ts`, `tests/stops.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`, `Thresholds`, `DEFAULTS`, `haversine`
- Produces:
  ```ts
  export function findStops(points: readonly TrackPoint[], t?: Thresholds): boolean[];
  export type TimeBreakdown = { movingS: number; stoppedS: number; gapS: number };
  export function timeBreakdown(
    points: readonly TrackPoint[],
    stopped: readonly boolean[],
    fromIdx: number,
    toIdx: number,
    t?: Thresholds,
  ): TimeBreakdown;
  ```

**Tests — intention**

> **Règle : un arrêt est une immobilité d'au moins 10 s dans un rayon de 6 m.**
> - 30 s à la même position → marqué arrêt
> - 6 s à la même position → **non** marqué : trop bref
> - 30 s de dérive lente dans un rayon de 4 m → marqué arrêt, le bruit GPS ne l'annule pas
> - 30 s de progression régulière à 4 km/h → non marqué

> **Règle : un intervalle de plus de 60 s est une coupure d'enregistrement, ni mouvement ni arrêt.**
> - un saut de 10 min entre deux points éloignés → compté en `gapS`
> - un saut de 10 min entre deux points au même endroit → compté en `gapS`, pas en `stoppedS`
> - un intervalle de 59 s → n'est pas une coupure

> **Règle : `timeBreakdown` ventile la durée totale sans en perdre.**
> - sur n'importe quel segment, `movingS + stoppedS + gapS` égale l'écart entre le premier et le dernier horodatage
> - un segment sans arrêt ni coupure → `movingS` égale la durée totale, les deux autres à 0

> **Question à trancher avant d'écrire le test** : les bornes d'un arrêt appartiennent-elles
> au temps arrêté ou au temps de mouvement ? Décision retenue : l'intervalle entre deux
> points tous deux marqués arrêtés compte comme arrêt ; un intervalle entre un point en
> mouvement et un point arrêté compte comme mouvement. Le temps d'arrêt est ainsi
> légèrement sous-estimé plutôt que sur-estimé, ce qui évite de gonfler artificiellement la
> vitesse ascensionnelle.

- [ ] **Step 1 : Écrire les tests des trois règles, et les voir échouer**

Run: `pnpm test stops`

- [ ] **Step 2 : Implémenter `stops.ts`**

Parcours avant : depuis chaque point candidat, étendre tant que la distance au point d'ancrage reste sous `stopRadiusM` ; si la durée atteinte atteint `stopMinDurationS`, marquer toute la portion et reprendre après elle.

- [ ] **Step 3 : Voir les tests passer**

Run: `pnpm test stops`

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "Ajoute la détection des arrêts et la ventilation du temps"
```

---

### Task 7 : Découpage des montées

**Files:**
- Create: `src/analysis/climbs.ts`, `tests/climbs.test.ts`

**Interfaces:**
- Consumes: `Thresholds`, `DEFAULTS`
- Produces:
  ```ts
  export type Segment = { startIdx: number; endIdx: number };
  export function detectClimbs(
    smoothed: readonly number[],
    cumulative: readonly number[],
    t?: Thresholds,
  ): Segment[];
  ```

**Tests — intention**

C'est la tâche où le passage des seuils en paramètre porte ses fruits : chaque exemple se
construit en faisant varier un seuil sur une même donnée.

> **Règle : les suites de points dont l'altitude croît forment les segments candidats.**
> - un profil en dents de scie de trois montées franches → trois segments
> - un profil strictement descendant → aucun segment
> - un profil plat → aucun segment

> **Règle : deux segments voisins fusionnent si le creux qui les sépare est mineur.**
> - creux de 8 m sur 150 m → fusion, un seul segment
> - creux de 25 m sur 150 m → pas de fusion, deux segments
> - creux de 8 m sur 400 m → pas de fusion : c'est la distance qui tranche, pas seulement la perte
> - trois montées séparées par deux creux mineurs → une seule montée au bout du compte

> **Règle : un segment n'est retenu que s'il dépasse le gain et la pente minimum.**
> - montée de 15 m à 5 % → rejetée, gain insuffisant
> - montée de 20 m à 5 % → retenue, exactement au seuil
> - montée de 60 m sur 3 km, soit 2 % → retenue, exactement au seuil
> - montée de 60 m sur 4 km, soit 1,5 % → rejetée, pente insuffisante

> **Règle : le dénivelé est mesuré sur l'altitude lissée fournie, la fonction ne lisse pas elle-même.**
> - appeler avec des altitudes déjà lissées et des altitudes brutes donne des résultats différents, ce qui est attendu

- [ ] **Step 1 : Écrire les tests des quatre règles, et les voir échouer**

Run: `pnpm test climbs`

- [ ] **Step 2 : Implémenter `climbs.ts`**

Trois passes distinctes et lisibles : repérage des suites croissantes, fusion, filtrage. Ne pas les entremêler.

- [ ] **Step 3 : Voir les tests passer**

Run: `pnpm test climbs`

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "Ajoute le découpage des parties montantes"
```

---

### Task 8 : Métriques et pipeline d'analyse

**Files:**
- Create: `src/analysis/vertical-velocity.ts`, `tests/vertical-velocity.test.ts`

**Interfaces:**
- Consumes: tout ce qui précède
- Produces:
  ```ts
  export type Climb = {
    startIdx: number;
    endIdx: number;
    gain: number;                      // mètres
    distance: number;                  // mètres
    avgGrade: number;                  // fraction : 0.075 pour 7,5 %
    movingS: number;
    elapsedS: number;
    verticalVelocityMoving: number;    // m/h
    verticalVelocityElapsed: number;   // m/h
  };
  export type Analysis = {
    points: readonly TrackPoint[];
    cumulative: readonly number[];
    smoothed: readonly number[];
    climbs: readonly Climb[];
  };
  export function analyse(points: readonly TrackPoint[], t?: Thresholds): Analysis;
  ```

**Tests — intention**

> **Règle : la vitesse ascensionnelle est le dénivelé divisé par la durée, en m/h.**
> - 300 m en 30 min sans arrêt → 600 m/h sur les deux mesures
> - 300 m en 30 min dont 10 min d'arrêt → 900 m/h en mouvement, 600 m/h en total
> - une montée sans arrêt → les deux mesures sont **égales**, et le test doit le vérifier explicitement

> **Règle : `analyse` enchaîne les étapes et rend un tout cohérent.**
> - `cumulative`, `smoothed` et `points` ont la même longueur
> - chaque `Climb` a `startIdx < endIdx`, tous deux dans les bornes de `points`
> - les montées sont ordonnées et ne se chevauchent pas

> **Règle : la fixture réelle sert de test de non-régression à valeurs figées.**
> - `tests/fixtures/real-file-anonymised.gpx` → trois montées
> - la première porte un temps d'arrêt non nul et deux vitesses **différentes**
> - les deux autres portent un temps d'arrêt nul et deux vitesses **égales**
> - les valeurs exactes sont relevées à la première exécution puis figées, avec un commentaire disant qu'elles décrivent le comportement de l'algorithme et non une vérité de terrain

> **Question à trancher avant d'écrire le test** : que vaut `verticalVelocityMoving` si le
> temps de mouvement d'une montée est nul — cas théorique d'un segment entièrement couvert
> par une coupure d'enregistrement ? Décision retenue : rendre `0` plutôt qu'`Infinity`, et
> couvrir ce cas par un exemple dédié.

- [ ] **Step 1 : Écrire les tests des trois règles, et les voir échouer**

Run: `pnpm test vertical-velocity`

- [ ] **Step 2 : Implémenter les métriques et `analyse`**

- [ ] **Step 3 : Voir les tests passer, puis figer les valeurs de la fixture réelle**

Run: `pnpm test vertical-velocity`

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "Ajoute le calcul des vitesses ascensionnelles et le pipeline d'analyse"
```

---

### Task 9 : Internationalisation

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/fr.ts`, `tests/i18n.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  ```ts
  export type Lang = 'en' | 'fr';
  export type MessageKey = keyof typeof import('./en').en;
  // Le paramètre `stored` est l'injection du stockage : la fonction ne lit ni
  // navigator ni localStorage, c'est main.ts qui les lui passe.
  export function detectLanguage(languages: readonly string[], stored: string | null): Lang;
  export type I18n = {
    lang: Lang;
    t(key: MessageKey): string;
    formatNumber(value: number, digits?: number): string;
  };
  export function createI18n(lang: Lang): I18n;
  ```

**Tests — intention**

> **Règle : la langue vient du choix mémorisé, sinon du navigateur, sinon de l'anglais.**
> - `['fr-FR', 'en']` sans choix mémorisé → français
> - `['de-DE']` sans choix mémorisé → anglais, aucune langue connue
> - `['fr-FR']` avec `'en'` mémorisé → anglais, le choix explicite l'emporte
> - liste vide → anglais
> - une valeur mémorisée invalide → anglais, et non une erreur

> **Règle : les dictionnaires portent exactement les mêmes clés.**
> - un test compare les jeux de clés de `en` et `fr` et échoue si l'un déborde
> - ce test est la garantie qu'une chaîne ajoutée d'un côté n'est pas oubliée de l'autre

> **Règle : les nombres suivent la locale active.**
> - `940.5` en anglais → séparateur décimal point
> - `940.5` en français → séparateur décimal virgule
> - le test compare à la sortie d'`Intl.NumberFormat`, jamais à une chaîne écrite en dur, afin de ne pas dépendre de la version d'ICU

- [ ] **Step 1 : Écrire les dictionnaires**

Toutes les chaînes de l'interface : titres, en-têtes de tableau, libellés d'axes, les six messages d'erreur, le libellé du sélecteur.

- [ ] **Step 2 : Écrire les tests des trois règles, et les voir échouer**

Run: `pnpm test i18n`

- [ ] **Step 3 : Implémenter `i18n/index.ts`**

`detectLanguage` ne lit **pas** `navigator` : elle reçoit la liste. C'est `main.ts` qui la lui passe.

- [ ] **Step 4 : Voir les tests passer**

Run: `pnpm test i18n`

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "Ajoute l'internationalisation anglais et français"
```

---

### Task 10 : Chargement du fichier et câblage

**Files:**
- Create: `src/ui/dropzone.ts`, `src/ui/language-select.ts`
- Modify: `src/main.ts`, `index.html`, `src/styles.css`

**Interfaces:**
- Consumes: `parseGpx`, `analyse`, `createI18n`, `detectLanguage`, `GpxError`
- Produces:
  ```ts
  export function mountDropzone(root: HTMLElement, onFile: (file: File) => void): void;
  export function mountLanguageSelect(
    root: HTMLElement, current: Lang, onChange: (lang: Lang) => void,
  ): void;
  ```

- [ ] **Step 1 : Implémenter la zone de dépôt**

Clic ouvrant le sélecteur, et gestion de `dragover` / `drop`. Après chargement, la zone se réduit à une ligne portant le nom du fichier et un moyen d'en changer.

- [ ] **Step 2 : Implémenter le sélecteur de langue**

- [ ] **Step 3 : Câbler `main.ts`**

Lecture du fichier, parsing, analyse, rendu. Chaque `GpxError` est traduite par son `code` en message via `t()`, et remplace le graphe : quand le calcul est impossible, on le dit et on n'affiche rien d'autre.

Une seule exception, qui n'est pas une erreur : **« aucune montée détectée »**. Là le calcul a bien eu lieu et son résultat est vide — le profil est affiché, accompagné de la note correspondante.

- [ ] **Step 4 : Vérifier à la main**

`pnpm dev`, charger `tests/fixtures/real-file-anonymised.gpx`, constater l'absence d'erreur de console. Le graphe n'existe pas encore : seul le compte des montées est affiché temporairement.

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "Ajoute le chargement du fichier et le câblage de la page"
```

---

### Task 11 : Profil altimétrique annoté

**Files:**
- Create: `src/ui/chart.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Analysis`, `Climb`, `I18n`
- Produces:
  ```ts
  export type ChartHandle = {
    highlight(climbIndex: number | null): void;
    destroy(): void;
  };
  export function renderChart(
    canvas: HTMLCanvasElement,
    analysis: Analysis,
    i18n: I18n,
    onHoverClimb: (climbIndex: number | null) => void,
  ): ChartHandle;
  ```

- [ ] **Step 1 : Tracer le profil**

Courbe remplie de l'altitude **lissée** en fonction de la distance. Axe X en kilomètres, axe Y en mètres, libellés issus d'`i18n`.

- [ ] **Step 2 : Ajouter les bandes**

Une annotation `box` par montée via `chartjs-plugin-annotation`, numérotée, étiquetée `① 940 m/h` avec la vitesse **en mouvement** seule, formatée par `i18n.formatNumber`.

- [ ] **Step 3 : Infobulle et survol**

L'infobulle d'une bande donne le détail complet de la montée. Le survol appelle `onHoverClimb`, et `highlight()` permet au tableau de piloter la mise en évidence en retour.

- [ ] **Step 4 : Vérifier à la main**

`pnpm dev` avec la fixture réelle : trois bandes, aux bons endroits, lisibles.

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "Ajoute le profil altimétrique et les bandes annotées"
```

---

### Task 12 : Tableau des montées

**Files:**
- Create: `src/ui/table.ts`
- Modify: `src/main.ts`, `src/styles.css`

**Interfaces:**
- Consumes: `Climb`, `I18n`
- Produces:
  ```ts
  export function renderTable(
    root: HTMLElement,
    climbs: readonly Climb[],
    i18n: I18n,
    onHoverClimb: (climbIndex: number | null) => void,
  ): void;
  ```

- [ ] **Step 1 : Construire le tableau**

Colonnes : numéro, altitude départ, altitude arrivée, D+, distance, pente moyenne, temps de mouvement, temps total, vitesse ascensionnelle mouvement, vitesse ascensionnelle totale. Tous les nombres via `i18n.formatNumber`.

- [ ] **Step 2 : Ajouter la ligne de synthèse**

Agrégat de l'ensemble des montées : D+ cumulé, distance cumulée, temps cumulés, et les deux vitesses recalculées sur ces totaux — **non** une moyenne des vitesses ligne à ligne, qui serait fausse.

- [ ] **Step 3 : Synchroniser le survol**

Survoler une ligne appelle `onHoverClimb`, que `main.ts` relaie vers `ChartHandle.highlight`.

- [ ] **Step 4 : Vérifier à la main**

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "Ajoute le tableau des montées et la synchronisation du survol"
```

---

### Task 13 : Tests d'interface

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/app.spec.ts`, `tests/fixtures/synthetic.gpx`, `tests/fixtures/no-elevation.gpx`
- Modify: `package.json`

**Interfaces:**
- Consumes: l'application complète
- Produces: le script `test:e2e`

- [ ] **Step 1 : Installer et configurer Playwright**

```bash
pnpm add -D @playwright/test && pnpm exec playwright install --with-deps chromium
```

`playwright.config.ts` avec un `webServer` lançant `pnpm dev`.

- [ ] **Step 2 : Écrire la trace synthétique**

`synthetic.gpx` : montées et arrêts aux valeurs choisies, résultats connus exactement. `no-elevation.gpx` : des `<trkpt>` sans `<ele>`.

**Tests — intention**

> **Règle : une trace valide produit un graphe et un tableau conformes.**
> - charger `synthetic.gpx` → le tableau liste le nombre attendu de montées, avec les valeurs attendues
> - charger `real-file-anonymised.gpx` → trois lignes, la première portant deux vitesses différentes
> - le canvas du graphe est présent et non vide

> **Règle : une trace inexploitable affiche un message et non un graphe.**
> - charger `no-elevation.gpx` → le message d'altitude absente s'affiche, le graphe est absent
> - charger un fichier texte quelconque → le message de GPX invalide s'affiche

> **Règle : le changement de langue réécrit l'affichage sans recharger les données.**
> - basculer en français → les en-têtes sont traduits et le séparateur décimal devient une virgule
> - le nombre de lignes du tableau ne change pas
> - rebasculer en anglais rétablit l'état initial

> **Règle : les deux modes de chargement sont équivalents.**
> - déposer le fichier par glisser-déposer → même tableau qu'en passant par le sélecteur

> **Règle : le survol relie les deux vues.**
> - survoler une ligne du tableau → la bande correspondante change d'aspect

- [ ] **Step 3 : Écrire les tests des cinq règles, et les voir échouer ou passer selon l'état de l'application**

Run: `pnpm test:e2e`

- [ ] **Step 4 : Corriger l'application jusqu'au vert**

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "Ajoute les tests d'interface Playwright"
```

---

### Task 14 : Intégration continue et publication

**Files:**
- Create: `.github/workflows/deploy.yml`, `.gitlab-ci.yml`, `knip.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: tous les scripts de `package.json`
- Produces: rien pour le code

- [ ] **Step 1 : Écrire le workflow GitHub**

Corepack, `pnpm install --frozen-lockfile`, puis `lint`, `typecheck`, `test`, installation du navigateur, `test:e2e`, `build`, publication via `actions/deploy-pages`. Déclenché sur la branche principale.

- [ ] **Step 2 : Écrire `.gitlab-ci.yml`**

Même enchaînement. GitLab exige que l'artefact publié se nomme `public/` : le job copie `dist/` vers `public/` après le build.

- [ ] **Step 3 : Configurer knip et vérifier**

Run: `pnpm knip` — aucun export ni dépendance orpheline.

- [ ] **Step 4 : Écrire le README**

Ce que fait la page, comment la lancer, comment lancer les tests, et le rappel que les seuils vivent dans `src/constants.ts`.

- [ ] **Step 5 : Vérifier la chaîne complète**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`

- [ ] **Step 6 : Commit**

```bash
git add -A && git commit -m "Ajoute l'intégration continue et la publication sur Pages"
```

---

### Task 15 : Validation sur trace réelle

**Files:**
- Modify: `src/constants.ts` si un seuil doit bouger

- [ ] **Step 1 : Examiner le résultat sur la fixture réelle**

`pnpm dev`, charger `tests/fixtures/real-file-anonymised.gpx`, et confronter les trois montées détectées au profil affiché : les bandes couvrent-elles ce que l'œil identifie comme des montées, ni plus ni moins ?

- [ ] **Step 2 : Éprouver `stopRadiusM`**

C'est le seuil le plus discutable des neuf. Comparer le temps d'arrêt de la première montée à ce que le profil suggère. Si de la progression lente est comptée comme arrêt, descendre à 4 m et réexécuter.

- [ ] **Step 3 : Ajuster et figer**

Tout seuil modifié voit son commentaire mis à jour dans `constants.ts`, et les valeurs figées du test de non-régression recalculées.

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "Ajuste les seuils après validation sur trace réelle"
```
