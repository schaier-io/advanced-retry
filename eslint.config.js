const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const nodePlugin = require('eslint-plugin-node');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      node: nodePlugin,
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'warn',
      'node/no-missing-import': 'off',
      'node/no-empty-function': 'off',
      'node/no-unsupported-features/es-syntax': 'off',
      'node/no-missing-require': 'off',
      'node/shebang': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      quotes: ['warn', 'single', { avoidEscape: true }],
      'node/no-unpublished-import': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettierConfig,
];
