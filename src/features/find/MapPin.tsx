import { useEffect, useState } from "react";
import { View } from "react-native";
import { colors } from "../../ui/tokens";

/**
 * A single artist map pin. Oxblood by default, gold when selected, with a
 * subtle scale bump so the active artist reads at a glance.
 *
 * react-native-maps only rasterises a custom marker view while
 * `tracksViewChanges` is true; leaving it on for every pin is a perf drain, so
 * we flip it on for a beat whenever `selected` changes, then back off. The
 * parent reads `tracking` to drive the Marker prop.
 */
export function useMarkerTracking(selected: boolean): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), 400);
    return () => clearTimeout(t);
  }, [selected]);
  return tracking;
}

export function MapPin({ selected }: { selected: boolean }) {
  const fill = selected ? colors.gold[400] : colors.oxblood[500];
  const border = selected ? colors.gold[300] : colors.oxblood[400];
  const size = selected ? 26 : 20;

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderWidth: 2,
          borderColor: border,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View
          style={{
            position: "absolute",
            alignSelf: "center",
            top: size / 2 - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.ink[950],
            opacity: 0.35,
          }}
        />
      </View>
      {/* Tail */}
      <View
        style={{
          width: 3,
          height: selected ? 8 : 6,
          backgroundColor: border,
          marginTop: -2,
          borderRadius: 2,
        }}
      />
    </View>
  );
}
