import type { ComponentType } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Single, correctly-typed entry point for icons.
 *
 * @expo/vector-icons is hoisted to the workspace root, where it resolves the
 * web app's React 19 @types (whose `Component` dropped the legacy `refs`
 * field). This native app runs React 18, so the raw `Ionicons` class trips
 * TS2786 ("cannot be used as a JSX component") when rendered against the app's
 * React 18 JSX namespace. Re-casting the class to this app's own
 * `ComponentType` reconciles the two React type copies without touching the
 * shared workspace-root install.
 *
 * Props are declared explicitly rather than inferred via `ComponentProps`,
 * because inferring from the React-19-typed class re-triggers the same
 * cross-version constraint failure.
 */
export type IconName = keyof typeof Ionicons.glyphMap;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export const Icon = Ionicons as unknown as ComponentType<IconProps>;
