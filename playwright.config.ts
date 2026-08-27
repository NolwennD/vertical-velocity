import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: BASE_URL, locale: "en-GB" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    // Un serveur déjà debout n'est pas instrumenté : sous couverture, en démarrer un.
    reuseExistingServer: !process.env.VITE_COVERAGE,
  },
});
