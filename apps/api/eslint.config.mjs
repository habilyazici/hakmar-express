// @ts-check
import eslint from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // ---------------------------------------------------------------------
  // Modular-monolith boundaries.
  //
  // The folder layout already implied these rules; nothing enforced them, so
  // three had quietly been broken: `common` importing `auth`'s types, Users
  // writing Auth's refresh_tokens, and Spatial Forecast importing a DTO out
  // of Tables. Convention on its own does not survive a deadline — this does.
  //
  //   (root)    main.ts / app.module.ts: the composition root. Elements
  //             match folders, so these stay unclassified and unrestricted
  //             — composing every module is the job they exist to do.
  //   shared    src/common: the kernel. May never import a module.
  //   platform  prisma, cache, config: infrastructure. Same restriction.
  //   module    every other folder under src: a feature or supporting module
  //
  // Modules may depend on each other, but only through the neighbour's
  // index.ts. Reaching past it — importing `../auth/auth.service` rather than
  // `../auth` — is how a module's internals silently become public API that
  // cannot be changed without a search across the whole repo.
  //
  // test/ is deliberately outside this: the e2e suites build testing modules
  // out of controllers, and a controller is an HTTP entry point rather than
  // something a module should be exporting to its neighbours.
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      // Without this the bundled node resolver only looks for .js, so
      // `from '../sales'` never resolves to src/sales/index.ts, every
      // cross-module import is classified as unknown, and every rule
      // below passes without ever having been applied.
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.json'] },
      },
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/common' },
        { type: 'platform', pattern: 'src/{prisma,cache,config}' },
        { type: 'module', pattern: 'src/*', capture: ['name'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'shared' } },
              allow: {
                to: { element: { types: { anyOf: ['shared', 'platform'] } } },
              },
              message:
                'The shared kernel may not depend on a feature module — the dependency arrow only points inwards.',
            },
            {
              from: { element: { type: 'platform' } },
              allow: {
                to: { element: { types: { anyOf: ['shared', 'platform'] } } },
              },
              message:
                'Infrastructure may not depend on a feature module.',
            },
            {
              from: { element: { type: 'module' } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ['shared', 'platform', 'module'] },
                  },
                },
              },
            },
            {
              disallow: {
                to: {
                  element: {
                    types: { anyOf: ['shared', 'platform', 'module'] },
                    internalPath: '!index.ts',
                  },
                },
              },
              message:
                "Import this module through its index.ts, not its internals — everything a neighbour is meant to use is exported there.",
            },
          ],
        },
      ],
    },
  },
  {
    // e2e tests assert on raw HTTP response bodies (supertest types them as
    // `any`); casting every access would add noise without catching real bugs.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
