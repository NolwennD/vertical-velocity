import istanbul from "vite-plugin-istanbul";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  // base relative : le build fonctionne à la racine d'un domaine comme dans
  // un sous-chemin type /vertical-velocity/, sans reconfiguration.
  base: "./",
  // requireEnv : le greffon ne s'active que sous VITE_COVERAGE, sinon il
  // instrumenterait aussi les runs vitest, dont le fournisseur istanbul
  // instrumente déjà.
  plugins: [istanbul({ include: "src/*", extension: [".ts"], requireEnv: true })],
  // Le greffon l'activerait de lui-même en le disant à chaque run vitest, qui
  // sert. Au build il reste faux : rien ne publie un mégaoctet de sourcemap.
  build: { sourcemap: command === "serve" },
  test: {
    // Stryker recopie tout le projet dans son bac à sable pour y muter le code.
    // Sans cette exclusion, vitest y retrouve les tests et les compte deux fois.
    exclude: [...configDefaults.exclude, ".stryker-tmp/**", "e2e/**"],
    coverage: {
      provider: "istanbul",
      include: ["src/**"],
      // Les deux campagnes déposent leur JSON au même endroit, nyc les fusionne.
      // Vitest passe en premier et nettoie le dossier.
      reporter: ["json"],
      reportsDirectory: ".nyc_output",
    },
  },
}));
