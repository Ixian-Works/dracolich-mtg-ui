// Cross-platform glass-morphism surface.
//
// v0 uses `bg-card/60 backdrop-blur-md border` for translucent panels and
// `bg-card/80 backdrop-blur-lg` for the navbar ("glass" / "glass-strong").
// Backdrop-blur works on web (CSS filter), is partially supported on iOS
// (via `@react-native-community/blur` — extra native dep), and is not
// available on Android without significant work.
//
// To stay dep-light and consistent, we use a translucent solid surface
// everywhere, then add a real CSS backdrop-filter on web. On native this
// renders as a semi-opaque dark surface — close enough to the design
// without the blur, and the mystical palette already does most of the
// visual work.
//
// Variants:
//   - default: bg-lair-700/60 + border, used for tiles and panels
//   - strong:  bg-lair-800/80 + thicker border, used for the navbar / modals
//
// Usage:
//   <GlassSurface variant="strong" className="rounded-lg p-6">...</GlassSurface>

import { Platform, View, type ViewProps } from "react-native";
import { alpha, palette } from "@/lib/tokens";

interface GlassSurfaceProps extends ViewProps {
  variant?: "default" | "strong";
}

export function GlassSurface({
  variant = "default",
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  // Translucent fill — alpha values chosen empirically so the radial body
  // gradient still shows through on web. On native the gradient isn't
  // present, but the alpha-blended fill against the solid lair-900 background
  // still reads as a layered surface.
  const fill =
    variant === "strong"
      ? alpha(palette.lair800, 0.78) // lair-800 at 78%
      : alpha(palette.lair700, 0.62); // lair-700 at 62%

  const borderColor =
    variant === "strong" ? alpha(palette.hairline, 0.85) : alpha(palette.hairline, 0.60);

  // Web gets a real backdrop-filter. Native and Android skip it.
  const webBlur =
    Platform.OS === "web"
      ? ({
          backdropFilter: variant === "strong" ? "blur(16px)" : "blur(12px)",
          WebkitBackdropFilter: variant === "strong" ? "blur(16px)" : "blur(12px)",
        } as object)
      : null;

  // Merge into a single style object — see comment in components/ui/glow.tsx
  // for why we avoid style arrays in this codebase.
  const mergedStyle = Object.assign(
    {
      backgroundColor: fill,
      borderColor,
      borderWidth: 1,
    },
    webBlur,
    Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style
  );

  return (
    <View style={mergedStyle} {...rest}>
      {children}
    </View>
  );
}
