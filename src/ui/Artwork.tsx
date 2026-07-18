import { useState } from "react";
import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { colors } from "./tokens";

interface ArtworkProps {
  /** Public image URL, or null to render the branded gradient fallback. */
  uri?: string | null;
  /** Seed string (handle) for deterministic fallback tinting. */
  seed: string;
  /** Monogram shown on the fallback tile. */
  initials?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  rounded?: string;
}

// Two-tone accent pairs — deterministically chosen so an artist's tile is
// stable across renders. Layered as a diagonal wash to imply a gradient
// without pulling in a native gradient dependency.
const ACCENTS: { a: string; b: string }[] = [
  { a: "#2b2b34", b: "#141419" },
  { a: colors.oxblood[600], b: "#141419" },
  { a: "#33323b", b: "#0d0d10" },
  { a: "#3a3226", b: "#141419" },
];

function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = (h * 33) ^ input.charCodeAt(i);
  return Math.abs(h);
}

/**
 * A square artwork/avatar tile. Renders the artist's real image when present,
 * otherwise a deterministic two-tone tile carrying their monogram — the same
 * "never a broken image" treatment the web profile uses.
 */
export function Artwork({ uri, seed, initials, className, style, rounded = "rounded-2xl" }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  const showImage = uri && !failed;
  const accent = ACCENTS[hash(seed) % ACCENTS.length];

  if (showImage) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        className={`${rounded} ${className ?? ""}`}
        style={style as StyleProp<ImageStyle>}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className={`items-center justify-center overflow-hidden ${rounded} border border-ink-700 ${className ?? ""}`}
      style={[{ backgroundColor: accent.b }, style]}
    >
      {/* Diagonal wash */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -20,
          left: -20,
          right: -20,
          bottom: -20,
          backgroundColor: accent.a,
          opacity: 0.55,
          transform: [{ rotate: "18deg" }, { translateY: -30 }],
        }}
      />
      {initials ? (
        <Text variant="display" className="text-bone-100" style={{ opacity: 0.9 }}>
          {initials}
        </Text>
      ) : null}
    </View>
  );
}

/** Two-letter monogram from a display name. */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
