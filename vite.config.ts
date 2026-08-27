import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // base relative : le build fonctionne à la racine d'un domaine comme dans
  // un sous-chemin type /vertical-velocity/, sans reconfiguration.
  base: "./",
  test: {
    // Stryker recopie tout le projet dans son bac à sable pour y muter le code.
    // Sans cette exclusion, vitest y retrouve les tests et les compte deux fois.
    exclude: [...configDefaults.exclude, ".stryker-tmp/**", "e2e/**"],
  },
});
