import { Text as RNText, type TextProps as RNTextProps } from "react-native";

type Variant =
  | "body"
  | "bodyMedium"
  | "bodySemibold"
  | "display"
  | "displayBold"
  | "blackletter"
  | "caption"
  | "label";

export interface TextProps extends RNTextProps {
  variant?: Variant;
  className?: string;
}

// Each variant pins its font family (so weight renders correctly on both
// platforms — RN doesn't synthesise weights for custom fonts) plus sensible
// default size/colour. Override any of it with className.
const VARIANTS: Record<Variant, string> = {
  body: "font-sans text-[15px] leading-[22px] text-bone-100",
  bodyMedium: "font-sans-medium text-[15px] leading-[22px] text-bone-100",
  bodySemibold: "font-sans-semibold text-[15px] leading-[22px] text-bone-100",
  display: "font-display text-2xl leading-8 text-bone-100",
  displayBold: "font-display-bold text-3xl leading-9 text-bone-100",
  blackletter: "font-blackletter text-3xl text-bone-100",
  caption: "font-sans text-xs leading-4 text-bone-500",
  label:
    "font-sans-semibold text-[11px] leading-4 tracking-[1.5px] uppercase text-bone-500",
};

export function Text({ variant = "body", className, ...rest }: TextProps) {
  return <RNText className={`${VARIANTS[variant]} ${className ?? ""}`} {...rest} />;
}
