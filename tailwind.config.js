/** @type {import('tailwindcss').Config} */
//
// The theme comes from the design tokens in `lib/tokens.js`, the one source
// for colours and radii. Add or change a value there, never here.
//
// Colour classes use the token's name in kebab case: `bg-lair-900`,
// `text-bone-dim`, `border-hairline`, `text-soulfire`, `bg-hoard-gold`,
// `text-danger`. Radius classes are `rounded-sm` (4), `rounded-md` (8),
// `rounded-lg` (12) and `rounded-full`.
const { legacy, tailwindColors, tailwindRadius } = require("./lib/tokens");

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: tailwindColors(),
      // Not classes: read by theme("legacy.…") in global.css only.
      legacy,
      fontFamily: {
        // Cinzel is loaded in app/_layout.tsx via @expo-google-fonts/cinzel.
        // Mirrors the v0 design exploration where Cinzel is the entire app's
        // font (not just brand surfaces). `sans` is the tailwind default —
        // overriding it makes every `<Text>` that doesn't specify a font
        // class inherit Cinzel automatically. Native gets the same default
        // via a Text.defaultProps patch in app/_layout.tsx.
        sans: ["Cinzel_400Regular", "Cinzel", "serif"],
        brand: ["Cinzel_700Bold", "Cinzel", "serif"],
        display: ["Cinzel_700Bold", "Cinzel", "serif"],
        body: ["Cinzel_400Regular", "Cinzel", "serif"],
      },
      borderRadius: tailwindRadius(),
    },
  },
  plugins: [],
};
