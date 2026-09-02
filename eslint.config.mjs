import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                // GNOME Shell & GJS globals
                global: 'readonly',
                _: 'readonly',
                console: 'readonly',
                imports: 'readonly',
                TextDecoder: 'readonly',
                TextEncoder: 'readonly',
            },
        },
        rules: {
            // GJS / GNOME Extension style rules
            'camelcase': ['error', {
                properties: 'never',
                allow: ['^vfunc_', '^_vfunc_', '^on_', '^_init'],
            }],
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            'no-undef': 'error',
            'eqeqeq': ['error', 'smart'],
            'prefer-const': 'error',
            'no-var': 'error',
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
            'prefer-arrow-callback': 'error',
            'arrow-body-style': ['error', 'as-needed'],
        },
    },
    {
        ignores: [
            'node_modules/',
            'dist/',
            '.icm/',
            'graphify-out/',
            '*.zip',
            'test-prefs.js',
        ],
    },
];
