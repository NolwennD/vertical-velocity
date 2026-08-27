# Vertical Velocity

A web-based tool that analyzes GPX files to display the average vertical velocity of climbs with an annotated elevation profile.

## What it does

- **Load GPX files** via file picker or drag-and-drop
- **Analyze climb data** to calculate vertical velocity metrics
- **Visualize results** with an interactive elevation profile chart
- **Display statistics** including climb count, total elevation gain, and average gradient
- **Export insights** about your climbing performance

## Key Features

🔒 **Privacy First** — Everything runs in the browser. Your track data never leaves your device.

📊 **Interactive Chart** — Hover over the elevation profile to highlight individual climbs and see detailed statistics.

📱 **Responsive Design** — Works on desktop and mobile browsers.

🌍 **Multilingual** — Select your preferred language from the interface.

⚙️ **Customizable** — Adjust immobility detection settings (stop radius and minimum duration) to refine climb detection.

## Getting Started

1. Visit the app at [https://nolwennd.github.io/vertical-velocity/](https://nolwennd.github.io/vertical-velocity/)
2. Click the dropzone or drag-and-drop a `.gpx` file
3. Review your climbing analysis instantly

## Technical Details

- **Built with**: TypeScript, Vite, Chart.js
- **No runtime dependencies** except `chart.js`, `chartjs-plugin-annotation`, and `@tmcw/togeojson`
- **Tested** with Vitest, Playwright (E2E), and Stryker (mutation testing)
- **Code quality**: Biome linter, TypeScript strict mode, no unsafe casts

## Development

```bash
pnpm install
pnpm dev          # Start dev server
pnpm check        # Run all checks (type, lint, unit tests, mutations)
pnpm test:e2e     # Run Playwright tests
pnpm build        # Build for production