import jsxA11y from 'eslint-plugin-jsx-a11y';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts'],
  },
  // Accessibility lint for JSX. The `next` preset only covers a couple
  // of a11y rules; jsx-a11y/recommended adds ~30 more (alt-text on img,
  // label-has-associated-control on form fields, no-redundant-roles,
  // role-supports-aria-props, etc.). We keep these as `error` so
  // violations fail CI rather than rot as warnings.
  //
  // The plugin itself is already registered by `eslint-config-next` —
  // we only override the rule set, not the plugin binding (which would
  // raise "Cannot redefine plugin" in flat config).
  {
    files: ['**/*.{tsx,jsx}'],
    rules: jsxA11y.configs.recommended.rules,
  },
  {
    rules: {
      // Allow intentionally-unused parameters when underscore-prefixed
      // (common for mocks and destructured rest patterns).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];

export default eslintConfig;
