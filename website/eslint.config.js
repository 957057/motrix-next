import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

const rules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-empty': ['error', { allowEmptyCatch: false }],
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'prefer-const': 'error',
  'no-var': 'error',
}

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts', '*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules,
  },
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...rules,
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['tools/**/*.mjs', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
    rules: { 'prefer-const': 'error', 'no-var': 'error' },
  },
  eslintConfigPrettier,
]
