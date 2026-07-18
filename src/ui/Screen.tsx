import { type ReactNode } from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. Default false. */
  scroll?: boolean;
  /** Apply default horizontal + vertical padding. Default true. */
  padded?: boolean;
  /** Which safe-area edges to inset. Default top/left/right (tab bar owns bottom). */
  edges?: Edge[];
  className?: string;
}

/**
 * The root container for every screen — paints the ink-950 canvas and honours
 * the device safe areas. Matches the web app's dark-first shell.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ["top", "left", "right"],
  className,
}: ScreenProps) {
  const inner = padded ? "px-5 py-4" : "";

  return (
    <SafeAreaView edges={edges} className="flex-1 bg-ink-950">
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={`grow ${inner} ${className ?? ""}`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${inner} ${className ?? ""}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
