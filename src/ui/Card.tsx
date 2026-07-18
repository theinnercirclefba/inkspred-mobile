import { type ReactNode } from "react";
import { View, type ViewProps } from "react-native";

type Tone = "default" | "raised";

export interface CardProps extends ViewProps {
  children: ReactNode;
  tone?: Tone;
  /** Apply internal padding. Default true. */
  padded?: boolean;
  className?: string;
}

const TONE: Record<Tone, string> = {
  default: "bg-ink-900 border border-ink-700",
  raised: "bg-ink-800 border border-ink-600",
};

/**
 * A bordered surface panel — the base container for list rows, stat tiles and
 * detail blocks. Mirrors the web app's ink-900 card + ink-700 hairline border.
 */
export function Card({
  children,
  tone = "default",
  padded = true,
  className,
  ...rest
}: CardProps) {
  return (
    <View
      className={`rounded-2xl ${TONE[tone]} ${padded ? "p-4" : ""} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </View>
  );
}
