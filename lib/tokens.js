// @ts-check
//
// Dracolich design tokens: the one source for every colour and radius in the
// interface. `tailwind.config.js` builds its theme from this file and components
// import it for the places a class name cannot reach (`shadowColor`, an icon's
// `color`, gradient stops, animated styles).
//
// This is the only file under `app/`, `components/` and `lib/` that may hold a
// colour literal; the `no-restricted-syntax` rules in `eslint.config.js` fail
// the lint anywhere else. It is plain CommonJS so that Tailwind can `require`
// it without a build step.
//
// Names and values follow the Dracolich design system (`docs/design/`, landing
// with issue #2). A change to a token is made there first.

/**
 * Colour tokens. In a class name the key is written in kebab case:
 * `palette.lair900` is `bg-lair-900`, `palette.boneDim` is `text-bone-dim`.
 */
const palette = {
  // The lair: three steps of depth, then decoration and control edges.
  lair900: "#0C0A14", // app background
  lair800: "#14111E", // navigation bar, tab bar, drawer and sheets
  lair700: "#1D182B", // cards, panels, menus, inputs
  hairline: "#2D2540", // decorative dividers and panel outlines
  edge: "#6F6490", // borders of inputs, chips and other controls

  // Bone: words.
  bone: "#ECE9DF", // primary text
  boneDim: "#A39F93", // secondary text and resting icons
  boneFaint: "#8F8B81", // placeholders and captions

  // Soulfire: the one light. It marks what is active.
  soulfire: "#9B6BF2", // links, active icons, focus rings, the glow
  soulfireDeep: "#6D3FD1", // fill of the primary button, with bone text
  soulfireDim: "#6F4DAE", // pressed and disabled soulfire

  // The hoard: game objects only.
  hoardGold: "#D4B25E", // multicolour identity, rare cards, a favourited deck
  manaWhite: "#F8F6E8",
  manaBlue: "#5C9EE5",
  manaBlack: "#2D2A30", // always drawn with manaBlackRing
  manaBlackRing: "#8E8798",
  manaRed: "#D14B3D",
  manaGreen: "#5BA66B",
  manaColorless: "#A5A5A5",
  rarityCommon: "#8F8B81",
  rarityUncommon: "#C0C0C0",
  rarityRare: "#D4B25E", // same as hoardGold
  rarityMythic: "#F97316",

  // States. These still hold the values they had before the design system:
  // danger equals manaRed, warning equals hoardGold and success equals
  // manaGreen. Issue #6 gives them their own values.
  danger: "#D14B3D",
  warning: "#D4B25E",
  success: "#5BA66B",

  // Not in the palette. Pure white and black, for scrims, shadows and the text
  // on a filled button until issue #6 settles that pairing.
  white: "#FFFFFF",
  black: "#000000",
};

/**
 * Values that were in the code before the design system and have no token in
 * it. They are kept so this change alters nothing a person can see. Each names
 * the issue that removes it. Do not use them in new code.
 */
const legacy = {
  rarityBonus: "#EC4899", // pink "bonus" rarity pip; issue #5 removes or maps it
  chartBlack: "#5A4F58", // black in the colour pie chart; issue #5
  dotIdle: "#3A3A45", // resting page dot in the stack editor; issue #7
  cardBackBrown: "#2A1810", // placeholder card back; issue #8 replaces the card back
  pageGlowViolet: "#4B3282", // web page background gradient, top; issue #7
  pageGlowBlue: "#283C82", // web page background gradient, bottom right; issue #7
};

/** Corner radii in points. `full` makes a pill or a circle of any size. */
const radii = {
  sm: 4, // badges and small marks
  md: 8, // buttons, inputs and list rows
  lg: 12, // panels, tiles, menus and sheets
  full: 9999,
};

/**
 * Spacing in points. Tailwind's default scale already has these values under
 * the same numbers (`p-4` is 16), so class names need no extra configuration.
 */
const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 };

/**
 * A token at a given opacity, as a CSS colour React Native also accepts.
 * Call it outside worklets: `alpha(palette.soulfire, 0.45)`.
 *
 * @param {string} hex six-digit hex colour, such as a value from `palette`
 * @param {number} opacity from 0 to 1
 * @returns {string}
 */
function alpha(hex, opacity) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/** Shadows. `glowSoulfire` is the only shadow with colour in the system. */
const shadow = {
  glowSoulfire: `0 0 18px ${alpha(palette.soulfire, 0.45)}`,
};

/**
 * @param {string} key camel case, such as `boneDim` or `lair900`
 * @returns {string} kebab case, such as `bone-dim` or `lair-900`
 */
function kebab(key) {
  return key.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();
}

/**
 * The colour tokens keyed the way Tailwind writes them. White and black are
 * left to Tailwind's own `white` and `black`.
 *
 * @returns {Record<string, string>}
 */
function tailwindColors() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(palette)) {
    if (key === "white" || key === "black") continue;
    out[kebab(key)] = value;
  }
  return out;
}

/**
 * The radius scale for Tailwind: `rounded-sm`, `rounded-md`, `rounded-lg` and
 * `rounded-full`.
 *
 * @returns {Record<string, string>}
 */
function tailwindRadius() {
  return {
    sm: `${radii.sm}px`,
    md: `${radii.md}px`,
    lg: `${radii.lg}px`,
    full: `${radii.full}px`,
  };
}

module.exports = {
  palette,
  legacy,
  radii,
  space,
  shadow,
  alpha,
  tailwindColors,
  tailwindRadius,
};
