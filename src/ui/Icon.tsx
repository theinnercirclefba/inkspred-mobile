import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

/**
 * Single, correctly-typed entry point for icons.
 *
 * Under Expo SDK 54 this app and the web app both run React 19, so the old
 * cross-version cast (React 18 app vs React 19 @types hoisted at the workspace
 * root) is no longer needed — Ionicons types cleanly against the shared React
 * 19 JSX namespace. Keeping this as the icon API means callers import from one
 * place and never touch @expo/vector-icons directly.
 */
export type IconName = ComponentProps<typeof Ionicons>["name"];

export type IconProps = ComponentProps<typeof Ionicons>;

export const Icon = Ionicons;
