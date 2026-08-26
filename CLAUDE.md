# Vertical Velocity

Page web qui charge un GPX et affiche la vitesse ascensionnelle moyenne des parties
montantes, sur un profil altimétrique annoté.

Tout s'exécute dans le navigateur. Aucune trace ne part sur le réseau.

- Conception : [docs/superpowers/specs/2026-08-26-vertical-velocity-design.md](docs/superpowers/specs/2026-08-26-vertical-velocity-design.md)
- Plan d'implémentation : [docs/superpowers/plans/2026-08-26-vertical-velocity.md](docs/superpowers/plans/2026-08-26-vertical-velocity.md)

## Commandes

```bash
pnpm dev            # serveur de développement
pnpm test           # suite complète
pnpm test:related   # seuls les tests important les fichiers passés en argument
pnpm typecheck      # tsc --noEmit
pnpm lint           # biome check
pnpm format         # biome format --write
pnpm build          # dist/
```

```bash
pnpm test:mutation  # Stryker : mesure ce que les tests attrapent vraiment
```

Gestionnaire : **pnpm** (figé par `packageManager`). Jamais `npm` ni `yarn`.

**TypeScript reste sur la ligne 5.x.** La 7 est le portage natif : elle n'expose plus l'API
compilateur JavaScript — ni `createProgram`, ni `readConfigFile`, ni
`parseConfigFileTextToJson` — et tout outil qui pilote TypeScript par cette API casse dessus,
Stryker le premier. Nous n'employons `tsc` qu'en ligne de commande, donc la 7 ne nous
apporterait rien en échange.

Deux réglages non évidents dans `stryker.config.json` : `plugins` déclare explicitement
`@stryker-mutator/vitest-runner`, que l'arborescence stricte de pnpm empêche Stryker de
découvrir seul.

## Règles de code

- **Dépendances d'exécution limitées à `chart.js`, `chartjs-plugin-annotation`,
  `@tmcw/togeojson`.** Aucune autre sans décision explicite du propriétaire.
- **Jamais `!` ni `as`** pour faire taire le compilateur. `noUncheckedIndexedAccess` est actif
  et c'est voulu : si le type refuse un accès, c'est la forme du code qu'il faut changer.
- **Rendre les états absurdes inexprimables.** Le type `Track` garantit au moins deux points ;
  aucune fonction d'analyse n'a donc à traiter la trace vide. La garantie s'établit une fois,
  au parsing, et se propage.
- **Éviter la mutation.** Jamais d'effet de bord dans un `map`, un `filter` ou un `reduce` :
  ces fonctions transforment, elles n'accumulent pas dans leur fermeture. Là où un parcours
  linéaire l'impose — une somme courante ne s'écrit pas en O(n) sans accumulateur — la
  mutation reste locale à la fonction, qui demeure pure vue du dehors. Et jamais de version
  quadratique au nom de la pureté : `[...acc, x]` dans un `reduce` est inacceptable sur des
  dizaines de milliers de points.
- **Aucune lecture de variable globale enfouie dans la logique.** Ce qui vient de l'extérieur
  entre par un paramètre : parseur, `navigator.languages`, stockage, seuils.
- **Les seuils sont un paramètre à valeur par défaut** : `f(..., t: Thresholds = DEFAULTS)`.
  C'est ce qui permet aux tests d'en faire varier un sans toucher à l'état du module.
- **Pas d'acronyme « VAM »** : forme développée `verticalVelocity` / `vertical-velocity`.
- **Unités métriques** partout. Tout nombre affiché passe par `Intl.NumberFormat` avec la
  locale active, jamais par concaténation.
- Seuls `main.ts` et `ui/` touchent au DOM.

## Règles de test

- **Chercher la propriété avant les exemples.** Existe-t-il un invariant vrai sur toutes les
  entrées ? `fast-check` le vérifie sur des centaines de cas et réduit le contre-exemple.
  Les exemples chiffrés restent nécessaires : la propriété dit ce qui est toujours vrai,
  l'exemple dit ce qui est vrai ici.
- **Une propriété ne doit pas réexécuter l'algorithme testé.** Si le test refait le même
  calcul dans le même ordre, il passe par construction et ne prouve rien.
- **Structure example mapping** : un `describe` par règle, un `it` par exemple, nommé par ce
  qu'il énonce. Ne pas compacter.
- Les tests de mutation (Stryker) viennent en dernier : ils mesurent la force des tests
  existants, pas la justesse du code.

## Méthode : TDD en ping-pong

L'unité de travail est **une règle**, pas une tâche ni un exemple isolé. Trois agents
distincts par cycle, puis un commit :

1. **test** — écrit le test, constate le rouge, rapporte l'échec réel. Ne touche pas à `src/`.
2. **code** — écrit le minimum pour le vert. Ne touche pas à `tests/`. Si le test lui paraît
   faux, il s'arrête et le signale au lieu de le corriger.
3. **ponytail** — relit avec la skill `ponytail:ponytail-review`. **Ses recommandations non
   ambiguës sont appliquées**, pas seulement proposées ; en écarter une demande une
   justification explicite.

Ce qui est ambigu ne se tranche pas dans l'urgence : laisser un commentaire
`// ponytail: <question ouverte>` à l'endroit concerné. `/ponytail-debt` les récolte ensuite.

**Toute modification de code relance immédiatement les tests impactés**
(`pnpm test:related <fichier>`). La suite complète tourne une fois par cycle, avant le commit.

Aucun agent ne déclare un état sans l'avoir constaté : le rouge comme le vert se rapportent
avec la sortie réelle de la commande.

## Commits

- Messages **en français**, à l'impératif ou à l'indicatif présent.
- **Auteur unique** : l'identité du dépôt, sans ligne `Co-Authored-By`, sans surcharge
  `-c user.name` / `-c user.email`.
- Indexer explicitement les fichiers voulus. **Pas de `git add -A`** : il a déjà ratissé des
  fichiers de configuration locaux et un fichier temporaire non désirés.
