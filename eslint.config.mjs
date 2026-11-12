import js from '@eslint/js';
import globals from 'globals';

export default [
  {ignores:['node_modules/**', 'coverage/**', '.netlify/**']},
  js.configs.recommended,
  {
    files:['app.js', 'preview.js', 'js/**/*.js'],
    languageOptions:{ecmaVersion:2024, sourceType:'module', globals:globals.browser}
  },
  {
    files:['netlify/**/*.mjs', 'tests/**/*.mjs', '*.config.mjs'],
    languageOptions:{ecmaVersion:2024, sourceType:'module', globals:globals.node}
  },
  {
    rules:{
      'no-empty':['error', {allowEmptyCatch:true}],
      'no-unused-vars':['error', {argsIgnorePattern:'^_', caughtErrorsIgnorePattern:'^_'}]
    }
  }
];
