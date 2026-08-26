# Vertical Velocity

Web page that loads a GPX file and displays the average vertical velocity of climbs, on
an annotated elevation profile.

Everything runs in the browser. No track data ever leaves over the network.

- Design: [docs/superpowers/specs/2026-08-26-vertical-velocity-design.md](docs/superpowers/specs/2026-08-26-vertical-velocity-design.md)
- Implementation plan: [docs/superpowers/plans/2026-08-26-vertical-velocity.md](docs/superpowers/plans/2026-08-26-vertical-velocity.md)

## Commands

```bash
pnpm check          # THE verification command: tsc → biome → vitest → stryker
```

`check` runs the four checks **in this order**, from fastest and most informative to
slowest, and stops at the first failure. The order isn't arbitrary: a type that doesn't
compile makes the other verdicts worthless, and Stryker reruns the suite hundreds of
times — running it before you have a stable green is wasted time.

The same checks run separately, when you're after a specific point:

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # biome check
pnpm test           # full suite
pnpm test:mutation  # Stryker: measures what the tests actually catch
pnpm test:related   # only the tests importing the files passed as arguments
pnpm format         # biome format --write
pnpm dev            # dev server
pnpm build          # dist/
```

Package manager: **pnpm** (pinned via `packageManager`). Never `npm` or `yarn`.

**TypeScript 7**, the native port. Know this before adding a tool: it no longer exposes
the JavaScript compiler API — no `createProgram`, no `readConfigFile`, no
`parseConfigFileTextToJson`. `tsc` on the command line works normally, but any tool that
drives TypeScript through its API fails with a `TypeError: ... is not a function`. If a
tool breaks this way, that's the first thing to check.

Three non-obvious settings in `stryker.config.json`, each for a specific reason:

- `plugins` explicitly declares `@stryker-mutator/vitest-runner`: pnpm's strict directory
  layout keeps Stryker from discovering it on its own.
- `tsconfigFile` points to `tsconfig.stryker-noop.json`, **which deliberately does not
  exist**. Stryker's preprocessor only rewrites a tsconfig's `extends` and `references`
  paths when they point outside the sandbox; our tsconfig has neither, so it has nothing
  to do. Giving it no file at all short-circuits this — which avoids the compiler API
  call that TypeScript 7 no longer provides. If an `extends` or a `references` ever shows
  up in `tsconfig.json`, this workaround will need revisiting.
- `cleanTempDir: "always"` removes the sandbox after every run. Without it, vitest finds
  a copy of the tests there and counts them twice — silently, since they pass.
  `vite.config.ts` excludes the folder for the same reason, as an extra safeguard.

## Code rules

- **Runtime dependencies limited to `chart.js`, `chartjs-plugin-annotation`,
  `@tmcw/togeojson`.** No others without an explicit decision from the owner.
- **Never `!` or `as`** to silence the compiler. `noUncheckedIndexedAccess` is enabled,
  and deliberately so: if the type rejects an access, it's the shape of the code that
  needs to change.
- **Make impossible states unrepresentable.** The `Track` type guarantees at least two
  points; no analysis function therefore has to handle an empty track. The guarantee is
  established once, at parse time, and propagates from there.
- **Avoid mutation.** Never a side effect inside a `map`, a `filter`, or a `reduce`:
  these functions transform, they don't accumulate into their closure. Where a linear
  pass requires it — a running sum can't be written in O(n) without an accumulator —
  mutation stays local to the function, which remains pure from the outside. And never a
  quadratic version in the name of purity: `[...acc, x]` inside a `reduce` is
  unacceptable over tens of thousands of points.
- **No reading of a global variable buried inside the logic.** Anything coming from the
  outside enters through a parameter: parser, `navigator.languages`, storage, thresholds.
- **Thresholds are a parameter with a default value**: `f(..., t: Thresholds =
  DEFAULTS)`. This is what lets tests vary one without touching the module's state.
- **No "VAM" acronym**: spelled out as `verticalVelocity` / `vertical-velocity`.
- **Metric units** everywhere. Every displayed number goes through `Intl.NumberFormat`
  with the active locale, never through concatenation.
- Only `main.ts` and `ui/` touch the DOM.

## Test rules

- **Look for the property before the examples.** Is there an invariant that holds
  across all inputs? `fast-check` verifies it over hundreds of cases and shrinks the
  counterexample. Concrete examples remain necessary: the property states what's always
  true, the example states what's true here.
- **A property must not re-run the algorithm under test.** If the test redoes the same
  calculation in the same order, it passes by construction and proves nothing.
- **Example mapping structure**: one `describe` per rule, one `it` per example, named
  after what it states. Don't compact these.
- Mutation tests (Stryker) come last: they measure the strength of the existing tests,
  not the correctness of the code.

## Method: ping-pong TDD

The unit of work is **a rule**, not a task or a single example. Three separate agents
per cycle, then a commit:

1. **test** — **models the problem with types first**, then writes the test, observes
   red, and reports the actual failure.

   Types are part of the specification, not the solution: declaring that `Track` has at
   least two points states what's valid, which is exactly the job of whoever writes the
   specification. And you don't write a test without the vocabulary it speaks in — so
   it's only natural that types come before the test.

   **The boundary: whatever disappears at compile time belongs to the test agent,
   whatever exists at runtime belongs to the code agent.** Type aliases, interfaces,
   unions, tuples, signatures: to the test agent. Function bodies, class bodies, values,
   constants, algorithms: to the code agent. The criterion is checkable without debate —
   just ask whether the thing survives in the emitted JavaScript.

   A type-level red is a legitimate red: making an impossible state unrepresentable
   makes `tsc` fail, and that's what forces the change.

2. **code** — writes the minimum for green. Doesn't touch `tests/`, or the types laid
   down by the test agent: those are its specification. If a test or a type looks wrong
   to it, it stops and reports it instead of fixing it.
3. **ponytail** — reviews with the `ponytail:ponytail-review` skill and **produces a
   report, nothing more**. This skill is designed to change nothing: by the end of its
   pass, `git diff` must be identical to what it was before. A ponytail agent that has
   written to files has strayed from its role.
4. **code, again** — applies the report's recommendations. **Unambiguous
   recommendations are applied**, not just read; setting one aside requires an explicit
   justification. Each change immediately reruns the affected tests: a simplification
   that breaks green is a simplification to revisit.

Separating the review from its application isn't a formality. Whoever reviews looks for
what's wrong without having to defend their own code; whoever applies it judges each
proposal on its merits instead of just carrying it out. The same agent reviewing and
fixing tends to justify what it just wrote.

Whatever is ambiguous doesn't get settled under pressure: leave a
`// ponytail: <open question>` comment at the spot in question. `/ponytail-debt`
collects them afterward.

**Every code change immediately reruns the affected tests** (`pnpm test:related
<file>`). At the end of the cycle, before the commit, `pnpm check` runs in full.

No agent declares a state without having observed it: red and green alike are reported
with the actual command output.

## Commits

- Messages **in French**, in the imperative or present indicative.
- **Single author**: the repository's identity, no `Co-Authored-By` line, no `-c
  user.name` / `-c user.email` override.
- Explicitly stage the intended files. **No `git add -A`**: it has already swept up
  unwanted local configuration files and a temporary file.
