# Vertical Velocity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a web page that loads a GPX file, detects the climbs, and displays for each one its average vertical velocity, on an annotated elevation profile paired with a table.

**Architecture:** everything runs in the browser. Parsing is isolated behind an adapter; analysis is a series of pure functions receiving their thresholds as a parameter; only `main.ts` and `ui/` touch the DOM.

**Tech Stack:** Vite, TypeScript, Chart.js + chartjs-plugin-annotation, @tmcw/togeojson, Vitest, fast-check, Playwright, Biome, lefthook, Stryker, pnpm.

**Spec:** [`docs/superpowers/specs/2026-08-26-vertical-velocity-design.md`](../specs/2026-08-26-vertical-velocity-design.md)

## Global Constraints

- Package manager: **pnpm** 11.24.0, pinned via the `packageManager` field. Node 24.10.0.
- Runtime dependencies limited to **`chart.js`**, **`chartjs-plugin-annotation`**, **`@tmcw/togeojson`**. No others without an explicit decision.
- TypeScript in **`strict`** mode with **`noUncheckedIndexedAccess`**.
- The code's vocabulary never uses the acronym "VAM": the spelled-out form `verticalVelocity` / `vertical-velocity` is used instead.
- **Metric** units everywhere: meters, m/h. No conversion to feet.
- Every displayed number goes through **`Intl.NumberFormat`** with the active locale. Never string concatenation.
- **No reading of a global variable buried inside the logic.** Anything coming from outside enters through a parameter: parser, `navigator.languages`, storage, thresholds.
- Analysis functions receive thresholds as a **parameter with a default value**: `f(..., t: Thresholds = DEFAULTS)`.
- **Avoid mutation as much as possible.** Data arrives clean from parsing, and analysis transforms it without altering it. In particular, never a side effect inside a `map`, a `filter`, or a `reduce`: these functions transform, they don't accumulate inside their closure. Where a linear traversal is unavoidable — a running sum can't be written in O(n) without an accumulator — mutation stays **local to the function**, on a variable that never escapes its scope, and the function remains pure from the outside.
- `vite.config.ts` with **`base: './'`**.
- Default language: **English**.
- Commits in French, under the repository's author, **with no co-author line**.

## File Structure

| File | Responsibility |
|---|---|
| `src/constants.ts` | `Thresholds` type and `DEFAULTS` object — the nine commented thresholds |
| `src/gpx/parser.ts` | Contract: `TrackPoint`, `Track` (≥ 2 points), `GpxParser`, `GpxError` |
| `src/gpx/togeojson-adapter.ts` | Contract implementation via `@tmcw/togeojson` |
| `src/analysis/geo.ts` | Haversine, cumulative distances |
| `src/analysis/smooth.ts` | 5-point median then 30 m moving average |
| `src/analysis/stops.ts` | Stops (6 m / 10 s), recording gaps (60 s), time breakdown |
| `src/analysis/climbs.ts` | Splitting into ascending runs, dip merging, filtering |
| `src/analysis/vertical-velocity.ts` | `Climb` type, per-climb metrics, `analyse()` pipeline |
| `src/i18n/index.ts` | Detection, persistence, `t()`, number formatting |
| `src/i18n/en.ts`, `src/i18n/fr.ts` | Dictionaries |
| `src/ui/dropzone.ts` | File picker and drag-and-drop |
| `src/ui/chart.ts` | Chart.js profile and annotated bands |
| `src/ui/table.ts` | Climbs table, synchronized hover |
| `src/ui/language-select.ts` | Language selector |
| `src/main.ts` | Wiring, orchestration, error display |
| `tests/fixtures/` | Synthetic track and `real-file-anonymised.gpx` |

## Note on Tests

Each task describes its tests as **rules** and **examples**, in the style of
example mapping. The rule states the expected behavior; the examples give
the concrete cases to cover. Open questions are flagged and must be settled
before writing the test, not during.

The implementer writes the assertions themselves, following the cycle described below.

### Look for Properties Before Examples

For each rule, first ask whether there is an **invariant** that holds for
all inputs, not just the three chosen cases. A property is checked with
**fast-check**, which generates hundreds of inputs and automatically
shrinks the counterexample when it fails.

Examples of domain invariants: a distance is always positive or zero; it
doesn't depend on the order of the arguments; cumulative distances are
increasing and of the same length as the input; smoothing never changes the
number of points; the sum of moving time, stopped time, and gap time always
equals the total duration.

Concrete numeric examples are still necessary — they anchor real values,
and a property alone would pass on an implementation that always returns
zero. The two complement each other: **the property says what is always
true, the example says what is true here**. The search order matters:
looking for the property first often reveals that three examples were
covering only a single case.

Mutation testing (Stryker, task 16) comes **after**, never before: it
measures the strength of the existing tests. Submitting them to it without
having looked for the invariants would amount to measuring an
already-known weakness.

## Execution Method

The ping-pong TDD cycle, the division of roles between agents, the test
loop, and the commit conventions are described in
**[CLAUDE.md](../../../CLAUDE.md)**, at the repository root. They apply to
all tasks in this plan.

Reminder of the one point specific to this plan: **the unit of work is a
rule**, not an entire task or a single example. A rule's examples form the
cases of a single test block. A task with four rules yields four cycles.

---

### Task 1: Project Foundation

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `lefthook.yml`, `index.html`, `src/main.ts`, `src/styles.css`

**Interfaces:**
- Consumes: nothing
- Produces: the `dev`, `build`, `preview`, `lint`, `format`, `typecheck`, `test`, `test:e2e` scripts

- [ ] **Step 1: Initialize the project**

`pnpm init`, then set `"packageManager": "pnpm@11.24.0"` and `"type": "module"`.

- [ ] **Step 2: Install the dependencies**

```bash
pnpm add chart.js chartjs-plugin-annotation @tmcw/togeojson
```

```bash
pnpm add -D vite typescript @biomejs/biome vitest lefthook knip
```

- [ ] **Step 3: Configure TypeScript**

`tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `noEmit: true`, `lib: ["ES2022", "DOM"]`.

- [ ] **Step 4: Configure Vite**

`vite.config.ts` exporting `defineConfig({ base: './' })`.

- [ ] **Step 5: Configure Biome and lefthook**

`biome.json`: lint and format enabled. `lefthook.yml`: a `pre-commit` hook running `biome format --write` on staged files, with `stage_fixed: true`. The hook runs **neither** a blocking lint, **nor** tests, **nor** typecheck. Install with `pnpm lefthook install`.

- [ ] **Step 6: Minimal page**

`index.html` with the empty containers: `#dropzone`, `#chart`, `#table`, `#message`, `#language`. `src/main.ts` reduced to a log. `src/styles.css` empty.

- [ ] **Step 7: Declare the scripts**

`dev`, `build`, `preview`, `lint` (`biome check`), `format` (`biome format --write`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:related` (`vitest related --run`), `knip`.

`test:related` is the test-loop command described above: it only runs the tests importing the files passed to it.

- [ ] **Step 8: Verify the foundation**

Run `pnpm lint`, `pnpm typecheck`, `pnpm build`. All three must succeed. Run `pnpm dev` and confirm the page loads without a console error.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "Met en place le socle Vite, TypeScript, Biome et lefthook"
```

---

### Task 2: Thresholds and Parsing Contract

**Files:**
- Create: `src/constants.ts`, `src/gpx/parser.ts`

**Interfaces:**
- Consumes: nothing
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
  export type Track = readonly [TrackPoint, TrackPoint, ...TrackPoint[]];
  export type GpxParser = (xml: string) => Track;
  ```

- [ ] **Step 1: Write the two files**

Each threshold in `DEFAULTS` carries a one-line comment stating what it decides. `GpxError` carries a typed `code`, never a free-form message: it is the `code` that the interface translates.

- [ ] **Step 2: Verify**

`pnpm typecheck` and `pnpm lint` pass. No unit test: these are declarations.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Déclare les seuils par défaut et le contrat de parsing GPX"
```

---

### Task 3: Geometry

**Files:**
- Create: `src/analysis/geo.ts`, `tests/geo.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`
- Produces:
  ```ts
  export function haversine(a: TrackPoint, b: TrackPoint): number;          // meters
  export function cumulativeDistances(points: Track): number[];
  ```

**Tests — intent**

> **Rule: `haversine` returns the great-circle distance in meters.**
> - two points one degree of latitude apart → ≈ 111,195 m, within 0.1%
>   (i.e. `6,371,000 × π/180`; not to be confused with the 111,320 m of a degree of
>   longitude at the equator, which is computed from the equatorial radius)
> - two identical points → 0
> - the order of the arguments doesn't change the result

> **Rule: `cumulativeDistances` returns an array of the same length as the input, increasing, starting at 0.**
> - three points in a line, 100 m apart → `[0, 100, 200]`
> - a single point → `[0]`
> - empty array → `[]`

- [ ] **Step 1: Write the tests for the two rules above, and watch them fail**

Run: `pnpm test geo` — expected: failure, module not found.

- [ ] **Step 2: Implement `geo.ts`**

Earth radius 6,371,000 m.

- [ ] **Step 3: Watch the tests pass**

Run: `pnpm test geo`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Ajoute le calcul des distances haversine"
```

---

### Task 4: Parsing Adapter

**Files:**
- Create: `src/gpx/togeojson-adapter.ts`, `tests/togeojson-adapter.test.ts`, `tests/fixtures/minimal.gpx`
- Move: `real-file-anonymised.gpx` → `tests/fixtures/real-file-anonymised.gpx`

**Interfaces:**
- Consumes: `TrackPoint`, `GpxParser`, `GpxError`, `GpxErrorCode`
- Produces: `export const parseGpx: GpxParser;   // returns a Track: at least two points`

**Tests — intent**

The tests target the **contract**, not the library: they must stay valid even if the adapter is replaced one day. No test mentions GeoJSON.

> **Rule: a valid GPX becomes a sequence of `TrackPoint` in the file's order.**
> - three `<trkpt>` with `<ele>` and `<time>` → three points, exact coordinates and elevations, `time` as a `Date`
> - two consecutive `<trkseg>` → the points are concatenated into a single sequence
> - `tests/fixtures/real-file-anonymised.gpx` → 3422 points

> **Rule: failures surface as a `GpxError` carrying a domain code.**
> - a string that isn't XML → code `invalid-xml`
> - well-formed XML with no `<trkpt>` at all → code `no-track-points`
> - a GPX where no point carries `<ele>` → code `no-elevation`
> - a GPX where no point carries `<time>` → code `no-time`
> - no error leaks a message or a type coming from the library

> **Rule: partially populated points are ignored without failing the parsing.**
> - out of five points, one without `<ele>` → four points returned
> - out of five points, one without `<time>` → four points returned

> **Question to settle before writing the test**: should a file where *some* points carry
> `<ele>` and others don't return the valid points, or raise `no-elevation`?
> Decision made: return the valid points, and only raise `no-elevation` if **no**
> point carries one. The file stays usable as long as complete points remain.

- [ ] **Step 1: Move the real fixture**

```bash
mkdir -p tests/fixtures && git mv real-file-anonymised.gpx tests/fixtures/ 2>/dev/null || mv real-file-anonymised.gpx tests/fixtures/
```

- [ ] **Step 2: Write `tests/fixtures/minimal.gpx`**

A GPX 1.1 with three points, explicit elevations and timestamps, no extensions.

- [ ] **Step 3: Write the tests for the three rules, and watch them fail**

Run: `pnpm test togeojson-adapter`

- [ ] **Step 4: Implement the adapter**

`toGeoJSON.gpx()` returns a `FeatureCollection`. Elevations are the third component of the coordinates; timestamps live in `properties.coordinateProperties.times`. The adapter joins the two, filters out incomplete points, and translates any failure into a `GpxError`.

- [ ] **Step 5: Watch the tests pass**

Run: `pnpm test togeojson-adapter`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Ajoute l'adaptateur de parsing GPX et les fixtures de test"
```

---

### Task 5: Elevation Smoothing

**Files:**
- Create: `src/analysis/smooth.ts`, `tests/smooth.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`, `Thresholds`, `DEFAULTS`
- Produces:
  ```ts
  export function smoothElevations(
    points: Track,
    cumulative: readonly number[],
    t?: Thresholds,
  ): number[];
  ```

**Tests — intent**

> **Rule: the median filter removes isolated outlier elevations.**
> - a steady ramp where a single point is offset by +40 m → the spike disappears
> - two **consecutive** outlier points in the middle of a window of 5 → are still corrected
> - three consecutive outlier points → are no longer corrected, which is the expected behavior of a median over 5

> **Rule: the moving average works on a window expressed in meters, not in points.**
> - two tracks with the same geometry, one sampled every second, the other every five seconds → smoothed elevations comparable within 1 m
> - a steady ramp → stays a ramp, elevations unchanged within 0.5 m
> - a real grade break (flat then 8%) → preserved, not smoothed away

> **Rule: the output always has the length of the input.**
> - empty array → empty array
> - a single point → a single element, equal to its elevation

- [ ] **Step 1: Write the tests for the three rules, and watch them fail**

Run: `pnpm test smooth`

- [ ] **Step 2: Implement `smooth.ts`**

Two passes. The moving window is centered: it extends on both sides of the current point until it covers `smoothingWindowM` in total, i.e. half on each side.

- [ ] **Step 3: Watch the tests pass**

Run: `pnpm test smooth`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Ajoute le lissage de l'altitude"
```

---

### Task 6: Stops and Time Breakdown

**Files:**
- Create: `src/analysis/stops.ts`, `tests/stops.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`, `Thresholds`, `DEFAULTS`, `haversine`
- Produces:
  ```ts
  export function findStops(points: Track, t?: Thresholds): boolean[];
  export type TimeBreakdown = { movingS: number; stoppedS: number; gapS: number };
  export function timeBreakdown(
    points: Track,
    stopped: readonly boolean[],
    fromIdx: number,
    toIdx: number,
    t?: Thresholds,
  ): TimeBreakdown;
  ```

**Tests — intent**

> **Rule: a stop is at least 10 s of immobility within a 6 m radius.**
> - 30 s at the same position → marked as a stop
> - 6 s at the same position → **not** marked: too brief
> - 30 s of slow drift within a 4 m radius → marked as a stop, GPS noise doesn't cancel it
> - 30 s of steady progress at 4 km/h → not marked

> **Rule: a gap of more than 60 s is a recording gap, neither movement nor a stop.**
> - a 10 min jump between two distant points → counted in `gapS`
> - a 10 min jump between two points at the same location → counted in `gapS`, not in `stoppedS`
> - a 59 s interval → is not a gap

> **Rule: `timeBreakdown` allocates the total duration without losing any of it.**
> - on any segment, `movingS + stoppedS + gapS` equals the gap between the first and last timestamp
> - a segment with no stop or gap → `movingS` equals the total duration, the other two are 0

> **Question to settle before writing the test**: do the boundaries of a stop belong to the
> stopped time or the moving time? Decision made: the interval between two
> points both marked as stopped counts as stopped; an interval between a point in
> motion and a stopped point counts as moving. Stopped time is thus
> slightly underestimated rather than overestimated, which avoids artificially inflating the
> vertical velocity.

- [ ] **Step 1: Write the tests for the three rules, and watch them fail**

Run: `pnpm test stops`

- [ ] **Step 2: Implement `stops.ts`**

Forward pass: from each candidate point, extend while the distance to the anchor point stays under `stopRadiusM`; if the duration reached hits `stopMinDurationS`, mark the whole span and resume after it.

- [ ] **Step 3: Watch the tests pass**

Run: `pnpm test stops`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Ajoute la détection des arrêts et la ventilation du temps"
```

---

### Task 7: Climb Splitting

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

**Tests — intent**

This is the task where passing thresholds as parameters pays off: each example
is built by varying one threshold on the same data.

> **Rule: sequences of points whose elevation increases form the candidate segments.**
> - a sawtooth profile with three clear climbs → three segments
> - a strictly descending profile → no segments
> - a flat profile → no segments

> **Rule: two neighboring segments merge if the dip separating them is minor.**
> - an 8 m dip over 150 m → merge, a single segment
> - a 25 m dip over 150 m → no merge, two segments
> - an 8 m dip over 400 m → no merge: it's the distance that decides, not just the loss
> - three climbs separated by two minor dips → a single climb in the end

> **Rule: a segment is kept only if it exceeds the minimum gain and grade.**
> - a 15 m climb at 5% → rejected, insufficient gain
> - a 20 m climb at 5% → kept, exactly at the threshold
> - a 60 m climb over 3 km, i.e. 2% → kept, exactly at the threshold
> - a 60 m climb over 4 km, i.e. 1.5% → rejected, insufficient grade

> **Rule: the elevation gain is measured on the supplied smoothed elevation, the function doesn't smooth it itself.**
> - calling with already-smoothed elevations versus raw elevations gives different results, which is expected

- [ ] **Step 1: Write the tests for the four rules, and watch them fail**

Run: `pnpm test climbs`

- [ ] **Step 2: Implement `climbs.ts`**

Three distinct, readable passes: spotting the increasing runs, merging, filtering. Don't interleave them.

- [ ] **Step 3: Watch the tests pass**

Run: `pnpm test climbs`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Ajoute le découpage des parties montantes"
```

---

### Task 8: Metrics and Analysis Pipeline

**Files:**
- Create: `src/analysis/vertical-velocity.ts`, `tests/vertical-velocity.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces:
  ```ts
  export type Climb = {
    startIdx: number;
    endIdx: number;
    gain: number;                      // meters
    distance: number;                  // meters
    avgGrade: number;                  // fraction: 0.075 for 7.5%
    movingS: number;
    elapsedS: number;
    verticalVelocityMoving: number;    // m/h
    verticalVelocityElapsed: number;   // m/h
  };
  export type Analysis = {
    points: Track;
    cumulative: readonly number[];
    smoothed: readonly number[];
    climbs: readonly Climb[];
  };
  export function analyse(points: Track, t?: Thresholds): Analysis;
  ```

**Tests — intent**

> **Rule: vertical velocity is the elevation gain divided by the duration, in m/h.**
> - 300 m in 30 min with no stop → 600 m/h on both measures
> - 300 m in 30 min including 10 min of stop → 900 m/h moving, 600 m/h total
> - a climb with no stop → the two measures are **equal**, and the test must verify this explicitly

> **Rule: `analyse` chains the steps and returns a coherent whole.**
> - `cumulative`, `smoothed`, and `points` have the same length
> - each `Climb` has `startIdx < endIdx`, both within the bounds of `points`
> - the climbs are ordered and don't overlap

> **Rule: the real fixture serves as a regression test with pinned values.**
> - `tests/fixtures/real-file-anonymised.gpx` → three climbs
> - the first one carries a nonzero stopped time and two **different** velocities
> - the other two carry a zero stopped time and two **equal** velocities
> - the exact values are recorded on the first run and then pinned, with a comment stating that they describe the algorithm's behavior and not ground truth

> **Question to settle before writing the test**: what should `verticalVelocityMoving` be if a
> climb's moving time is zero — the theoretical case of a segment entirely covered
> by a recording gap? Decision made: return `0` rather than `Infinity`, and
> cover this case with a dedicated example.

- [ ] **Step 1: Write the tests for the three rules, and watch them fail**

Run: `pnpm test vertical-velocity`

- [ ] **Step 2: Implement the metrics and `analyse`**

- [ ] **Step 3: Watch the tests pass, then pin the real fixture's values**

Run: `pnpm test vertical-velocity`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Ajoute le calcul des vitesses ascensionnelles et le pipeline d'analyse"
```

---

### Task 9: Internationalization

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/fr.ts`, `tests/i18n.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export type Lang = 'en' | 'fr';
  export type MessageKey = keyof typeof import('./en').en;
  // The `stored` parameter is the storage injection: the function reads
  // neither navigator nor localStorage, main.ts passes them to it.
  export function detectLanguage(languages: readonly string[], stored: string | null): Lang;
  export type I18n = {
    lang: Lang;
    t(key: MessageKey): string;
    formatNumber(value: number, digits?: number): string;
  };
  export function createI18n(lang: Lang): I18n;
  ```

**Tests — intent**

> **Rule: the language comes from the stored choice, otherwise from the browser, otherwise English.**
> - `['fr-FR', 'en']` with no stored choice → French
> - `['de-DE']` with no stored choice → English, no known language
> - `['fr-FR']` with `'en'` stored → English, the explicit choice wins
> - empty list → English
> - an invalid stored value → English, not an error

> **Rule: the dictionaries carry exactly the same keys.**
> - a test compares the key sets of `en` and `fr` and fails if one has extra keys
> - this test guarantees that a string added on one side isn't forgotten on the other

> **Rule: numbers follow the active locale.**
> - `940.5` in English → decimal point separator
> - `940.5` in French → decimal comma separator
> - the test compares against `Intl.NumberFormat`'s output, never against a hardcoded string, so as not to depend on the ICU version

- [ ] **Step 1: Write the dictionaries**

All the interface strings: titles, table headers, axis labels, the six error messages, the selector's label.

- [ ] **Step 2: Write the tests for the three rules, and watch them fail**

Run: `pnpm test i18n`

- [ ] **Step 3: Implement `i18n/index.ts`**

`detectLanguage` does **not** read `navigator`: it receives the list. `main.ts` is what passes it.

- [ ] **Step 4: Watch the tests pass**

Run: `pnpm test i18n`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Ajoute l'internationalisation anglais et français"
```

---

### Task 10: File Loading and Wiring

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

- [ ] **Step 1: Implement the drop zone**

A click opens the file picker, plus handling of `dragover` / `drop`. After loading, the zone shrinks to a line carrying the file name and a way to change it.

- [ ] **Step 2: Implement the language selector**

- [ ] **Step 3: Wire up `main.ts`**

Reading the file, parsing, analysis, rendering. Each `GpxError` is translated by its `code` into a message via `t()`, and replaces the chart: when the computation is impossible, it's stated and nothing else is displayed.

One exception, which isn't an error: **"no climb detected"**. There the computation did take place and its result is empty — the profile is displayed, accompanied by the corresponding note.

- [ ] **Step 4: Verify by hand**

`pnpm dev`, load `tests/fixtures/real-file-anonymised.gpx`, confirm there's no console error. The chart doesn't exist yet: only the climb count is temporarily displayed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Ajoute le chargement du fichier et le câblage de la page"
```

---

### Task 11: Annotated Elevation Profile

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

- [ ] **Step 1: Draw the profile**

Filled curve of **smoothed** elevation against distance. X axis in kilometers, Y axis in meters, labels sourced from `i18n`.

- [ ] **Step 2: Add the bands**

One `box` annotation per climb via `chartjs-plugin-annotation`, numbered, labeled `① 940 m/h` with the **moving** velocity alone, formatted by `i18n.formatNumber`.

- [ ] **Step 3: Tooltip and hover**

A band's tooltip gives the full detail of the climb. Hovering calls `onHoverClimb`, and `highlight()` lets the table drive the highlighting back.

- [ ] **Step 4: Verify by hand**

`pnpm dev` with the real fixture: three bands, in the right places, legible.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Ajoute le profil altimétrique et les bandes annotées"
```

---

### Task 12: Climbs Table

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

- [ ] **Step 1: Build the table**

Columns: number, start elevation, end elevation, elevation gain, distance, average grade, moving time, total time, moving vertical velocity, total vertical velocity. All numbers via `i18n.formatNumber`.

- [ ] **Step 2: Add the summary row**

Aggregate of all the climbs: cumulative elevation gain, cumulative distance, cumulative times, and the two velocities recalculated on these totals — **not** an average of the row-by-row velocities, which would be wrong.

- [ ] **Step 3: Synchronize the hover**

Hovering over a row calls `onHoverClimb`, which `main.ts` relays to `ChartHandle.highlight`.

- [ ] **Step 4: Verify by hand**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Ajoute le tableau des montées et la synchronisation du survol"
```

---

### Task 13: Interface Tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/app.spec.ts`, `tests/fixtures/synthetic.gpx`, `tests/fixtures/no-elevation.gpx`
- Modify: `package.json`

**Interfaces:**
- Consumes: the complete application
- Produces: the `test:e2e` script

- [ ] **Step 1: Install and configure Playwright**

**Already done**: `@playwright/test` 1.62.1 is installed and the browser downloaded.

```bash
pnpm exec playwright install chromium
```

No `--with-deps` locally: the development machine already runs a chromium and a firefox, so the system libraries are present. Verified — the browser launches and `canvas.getContext('2d')` responds, which is what Chart.js depends on. In CI, however, `--with-deps` remains necessary: the runner containers are bare.

The system's browsers aren't reused directly: the local chromium is a snap package, sandboxed, unable to access the temporary profiles that Playwright creates outside its cage.

`playwright.config.ts` with a `webServer` launching `pnpm dev`.

- [ ] **Step 2: Write the synthetic track**

`synthetic.gpx`: climbs and stops at chosen values, exactly known results. `no-elevation.gpx`: `<trkpt>` with no `<ele>`.

**Tests — intent**

> **Rule: a valid track produces a matching chart and table.**
> - load `synthetic.gpx` → the table lists the expected number of climbs, with the expected values
> - load `real-file-anonymised.gpx` → three rows, the first carrying two different velocities
> - the chart's canvas is present and not empty

> **Rule: an unusable track displays a message and not a chart.**
> - load `no-elevation.gpx` → the missing-elevation message is displayed, the chart is absent
> - load some arbitrary text file → the invalid-GPX message is displayed

> **Rule: changing the language rewrites the display without reloading the data.**
> - switch to French → the headers are translated and the decimal separator becomes a comma
> - the number of rows in the table doesn't change
> - switching back to English restores the initial state

> **Rule: the two loading modes are equivalent.**
> - drop the file via drag-and-drop → the same table as when going through the file picker

> **Rule: hovering links the two views.**
> - hover over a table row → the corresponding band changes appearance

- [ ] **Step 3: Write the tests for the five rules, and watch them fail or pass depending on the application's state**

Run: `pnpm test:e2e`

- [ ] **Step 4: Fix the application until green**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Ajoute les tests d'interface Playwright"
```

---

### Task 14: Continuous Integration and Publishing

**Files:**
- Create: `.github/workflows/deploy.yml`, `.gitlab-ci.yml`, `knip.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: all the scripts in `package.json`
- Produces: nothing for the code

- [ ] **Step 1: Write the GitHub workflow**

Corepack, `pnpm install --frozen-lockfile`, then `lint`, `typecheck`, `test`, browser installation, `test:e2e`, `build`, publishing via `actions/deploy-pages`. Triggered on the main branch.

- [ ] **Step 2: Write `.gitlab-ci.yml`**

Same sequence. GitLab requires the published artifact to be named `public/`: the job copies `dist/` to `public/` after the build.

- [ ] **Step 3: Configure knip and verify**

Run: `pnpm knip` — no orphaned export or dependency.

- [ ] **Step 4: Write the README**

What the page does, how to run it, how to run the tests, and a reminder that the thresholds live in `src/constants.ts`.

- [ ] **Step 5: Verify the full chain**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Ajoute l'intégration continue et la publication sur Pages"
```

---

### Task 15: Validation on Real Track

**Files:**
- Modify: `src/constants.ts` if a threshold needs to move

- [ ] **Step 1: Examine the result on the real fixture**

`pnpm dev`, load `tests/fixtures/real-file-anonymised.gpx`, and check the three detected climbs against the displayed profile: do the bands cover what the eye identifies as climbs, no more and no less?

- [ ] **Step 2: Stress-test `stopRadiusM`**

This is the most debatable of the nine thresholds. Compare the first climb's stopped time to what the profile suggests. If slow progress is being counted as a stop, lower it to 4 m and rerun.

- [ ] **Step 3: Adjust and pin**

Any modified threshold has its comment updated in `constants.ts`, and the pinned values of the regression test recalculated.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Ajuste les seuils après validation sur trace réelle"
```

---

### Task 16: Mutation Testing

**Files:**
- Create: `stryker.config.json`
- Modify: `package.json`, `.github/workflows/deploy.yml`, `.gitlab-ci.yml`

**Interfaces:**
- Consumes: the complete Vitest suite
- Produces: the `test:mutation` script

This task comes **last**, once the analysis is fully written and covered by its
properties. Stryker alters the source code — flips a comparison, shifts a
boundary, replaces a constant with zero — then reruns the tests on each variant. A
surviving mutant points to a line that nothing truly verifies.

This is the tool that tells whether the thresholds are really tested: replacing `>= 20`
with `> 20` in the climb filtering must fail a test, otherwise the example "a 20 m
climb kept, exactly at the threshold" proves nothing.

- [ ] **Step 1: Install and configure**

```bash
pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner
```

`stryker.config.json` limited to `src/analysis/**` and `src/gpx/**`: the core of the
computation. The `ui/` modules are covered by Playwright, which Stryker can't
drive, and mutating them would only produce noise.

- [ ] **Step 2: Establish the baseline**

Run `pnpm test:mutation`, record the resulting score and the list of surviving
mutants. Don't set a threshold before seeing this number: a threshold decided in
advance is either trivial to reach or arbitrarily punitive.

- [ ] **Step 3: Deal with the survivors**

For each surviving mutant, decide between two cases and write it down:

- **the test is missing** — the mutation changes a behavior that matters, and nothing sees it.
  Add the example or property that catches it.
- **the mutation is harmless** — it concerns a detail with no observable consequence
  (a strict or loose boundary where no real data ever lands exactly on it). Exclude it
  explicitly, with a comment stating why.

Never write a test with the sole purpose of killing a mutant: a test that describes no
intended behavior is dead weight that displays a good score.

- [ ] **Step 4: Set the threshold and wire up the CI**

`thresholds.break` set slightly below the observed score, to catch a regression
without failing the CI on the first rounding. The job is **separate and non-blocking for the
publication**: Stryker reruns the suite hundreds of times, it has no place on the
critical path of a deployment.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Ajoute les tests de mutation"
```
