// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Colours live in lib/tokens.js and nowhere else. These selectors catch a hex
// colour ("#D4B25E", "#000") or an rgb()/rgba() written in a string or a
// template literal, including inside a className.
const HEX = '/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\\b/';
const RGB = '/\\brgba?\\(/';
const COLOUR_LITERAL_MESSAGE =
  'Colour literals belong in lib/tokens.js. Use a token instead: palette.soulfire, ' +
  'alpha(palette.soulfire, 0.45), or a class such as bg-lair-900.';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['app/**/*.{js,jsx,ts,tsx}', 'components/**/*.{js,jsx,ts,tsx}', 'lib/**/*.{js,jsx,ts,tsx}'],
    ignores: ['lib/tokens.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${HEX}]`, message: COLOUR_LITERAL_MESSAGE },
        { selector: `TemplateElement[value.raw=${HEX}]`, message: COLOUR_LITERAL_MESSAGE },
        { selector: `Literal[value=${RGB}]`, message: COLOUR_LITERAL_MESSAGE },
        { selector: `TemplateElement[value.raw=${RGB}]`, message: COLOUR_LITERAL_MESSAGE },
      ],
    },
  },
]);
