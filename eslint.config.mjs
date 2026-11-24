// ESLint configuration (Lab 4 and Lab 5: "npm run lint" in the CI pipeline).
// One flat config for the whole repository: NestJS server and React client, TypeScript only.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'server/coverage/**',
      'server/uploads/**',
      'server/dev-emails/**',
      'client/vite.config.js',
      'client/vite.config.d.ts',
      // Lab 5 JavaScript exercises, outside the TypeScript source directories.
      'js-practice.js',
      'practice/**',
      // Measurement script that needs Playwright, which is not a dependency of the project.
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Omitting properties with a rest destructuring is intended (saveFields, error filter).
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['server/src/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // Test files use mocks and partial objects.
    files: ['server/src/**/*.spec.ts', 'server/src/common/testing/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: { globals: globals.node },
  },
);
