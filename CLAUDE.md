# Vertical Velocity

Page web qui charge un GPX et affiche la vitesse ascensionnelle moyenne des parties
montantes, sur un profil altimétrique annoté.

Tout s'exécute dans le navigateur. Aucune trace ne part sur le réseau.

- Conception : [docs/superpowers/specs/2026-08-26-vertical-velocity-design.md](docs/superpowers/specs/2026-08-26-vertical-velocity-design.md)
- Plan d'implémentation : [docs/superpowers/plans/2026-08-26-vertical-velocity.md](docs/superpowers/plans/2026-08-26-vertical-velocity.md)

## Commandes

```bash
pnpm check          # LA commande de vérification : tsc → biome → vitest → stryker
```

`check` enchaîne les quatre contrôles **dans cet ordre**, du plus rapide et du plus
informatif au plus lent, et s'arrête au premier échec. L'ordre n'est pas indifférent : un
type qui ne compile pas rend les autres verdicts sans valeur, et Stryker relance la suite
des centaines de fois — le faire tourner avant d'avoir un vert stable est du temps perdu.

Les mêmes contrôles séparément, quand on cherche un point précis :

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # biome check
pnpm test           # suite complète
pnpm test:mutation  # Stryker : mesure ce que les tests attrapent vraiment
pnpm test:related   # seuls les tests important les fichiers passés en argument
pnpm format         # biome format --write
pnpm dev            # serveur de développement
pnpm build          # dist/
```

Gestionnaire : **pnpm** (figé par `packageManager`). Jamais `npm` ni `yarn`.

**TypeScript 7**, le portage natif. À savoir avant d'ajouter un outil : elle n'expose plus
l'API compilateur JavaScript — ni `createProgram`, ni `readConfigFile`, ni
`parseConfigFileTextToJson`. `tsc` en ligne de commande fonctionne normalement, mais tout
outil qui pilote TypeScript par son API échoue avec un `TypeError: ... is not a function`.
Si un outil casse de cette façon, c'est la première piste.

Trois réglages non évidents dans `stryker.config.json`, chacun pour une raison précise :

- `plugins` déclare explicitement `@stryker-mutator/vitest-runner` : l'arborescence stricte
  de pnpm empêche Stryker de le découvrir seul.
- `tsconfigFile` pointe vers `tsconfig.stryker-noop.json`, **qui n'existe pas volontairement**.
  Le préprocesseur de Stryker ne sert qu'à réécrire les chemins `extends` et `references`
  d'un tsconfig quand ils sortent du bac à sable ; notre tsconfig n'a ni l'un ni l'autre, il
  n'a donc rien à faire. Ne lui donner aucun fichier le court-circuite — et évite ainsi
  l'appel à l'API compilateur que TypeScript 7 ne fournit plus. Si un `extends` ou un
  `references` apparaît un jour dans `tsconfig.json`, ce contournement devra être revu.
- `cleanTempDir: "always"` supprime le bac à sable après chaque exécution. Sans lui, vitest
  y retrouve une copie des tests et les compte deux fois — silencieusement, puisqu'ils
  passent. `vite.config.ts` exclut le dossier pour la même raison, en défense de plus.

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

1. **test** — **modélise d'abord le problème par des types**, puis écrit le test, constate le
   rouge et rapporte l'échec réel.

   Les types font partie de l'énoncé, pas de la solution : déclarer que `Track` a au moins
   deux points, c'est dire ce qui est valide, exactement le travail de celui qui spécifie. Et
   l'on n'écrit pas un test sans le vocabulaire qu'il parle — il est donc normal que les
   types précèdent le test.

   **La frontière : ce qui disparaît à la compilation appartient à l'agent test, ce qui
   existe à l'exécution appartient à l'agent code.** Alias de types, interfaces, unions,
   tuples, signatures : au test. Corps de fonction, corps de classe, valeur, constante,
   algorithme : au code. Le critère est vérifiable sans discussion — il suffit de se demander
   si la chose subsiste dans le JavaScript produit.

   Un rouge de typage est un rouge légitime : rendre un état absurde inexprimable fait
   échouer `tsc`, et c'est ce qui force le changement.

2. **code** — écrit le minimum pour le vert. Ne touche pas à `tests/`, ni aux types posés par
   l'agent test : ce sont son énoncé. Si le test ou un type lui paraît faux, il s'arrête et le
   signale au lieu de le corriger.
3. **ponytail** — relit avec la skill `ponytail:ponytail-review` et **rend un rapport, rien
   de plus**. Cette skill est conçue pour ne rien modifier : à la fin de son passage,
   `git diff` doit être identique à ce qu'il était avant. Un agent ponytail qui a écrit dans
   des fichiers a détourné son rôle.
4. **code, à nouveau** — applique les recommandations du rapport. **Les recommandations non
   ambiguës sont appliquées**, pas seulement lues ; en écarter une demande une justification
   explicite. Chaque modification relance aussitôt les tests impactés : une simplification
   qui casse le vert est une simplification à revoir.

Séparer la relecture de son application n'est pas une formalité. Celui qui relit cherche ce
qui cloche sans avoir à défendre son propre code ; celui qui applique juge chaque
proposition sur pièce au lieu de l'exécuter. Un même agent qui relit et corrige tend à
justifier ce qu'il vient d'écrire.

Ce qui est ambigu ne se tranche pas dans l'urgence : laisser un commentaire
`// ponytail: <question ouverte>` à l'endroit concerné. `/ponytail-debt` les récolte ensuite.

**Toute modification de code relance immédiatement les tests impactés**
(`pnpm test:related <fichier>`). En fin de cycle, avant le commit, `pnpm check` passe en
entier.

Aucun agent ne déclare un état sans l'avoir constaté : le rouge comme le vert se rapportent
avec la sortie réelle de la commande.

## Commits

- Messages **en français**, à l'impératif ou à l'indicatif présent.
- **Auteur unique** : l'identité du dépôt, sans ligne `Co-Authored-By`, sans surcharge
  `-c user.name` / `-c user.email`.
- Indexer explicitement les fichiers voulus. **Pas de `git add -A`** : il a déjà ratissé des
  fichiers de configuration locaux et un fichier temporaire non désirés.
