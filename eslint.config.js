import eslint from '@eslint/js';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.astro/**',
      'dist/**',
      'node_modules/**',
      'identity-sources/**',
      'professional-identity/archive/**',
      'professional-identity/scripts/**',
      'src/data/generated/public-portfolio.json',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['src/pages/**/*.{astro,ts}', 'src/layouts/**/*.{astro,ts}', 'src/components/**/*.{astro,ts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/professional-identity.json', '**/professional-identity/**', '**/identity-sources/**'],
              message: 'UI code may consume only the compiled public data gateway.',
            },
          ],
        },
      ],
    },
  },
);
