import { Platform } from "react-native";

export const colors = {
  ink: "#102236",
  text: "#1A3149",
  heading: "#0E2438",
  panel: "#FFFFFF",
  panelRaised: "#F3F7FB",
  panelMuted: "#EAF2F8",
  line: "#D7E2EC",
  mist: "#F8FBFF",
  muted: "#667C92",
  accent: "#D9EEF2",
  accentStrong: "#0F7C90",
  accentDeep: "#12314A",
  caution: "#DB9A37",
  danger: "#DA6A6A",
  lowRisk: "#33A06F",
  mediumRisk: "#CF9A36",
  highRisk: "#D16161",
  glow: "#D7EFF8",
  canvas: "#ECF3F7",
  darkSurface: "#10253A",
  darkSurfaceDeep: "#081A2B"
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  xxxl: 48
};

export const radius = {
  sm: 14,
  md: 22,
  lg: 28,
  xl: 34,
  pill: 999
};

export const type = {
  hero: 36,
  title: 22,
  section: 18,
  body: 15,
  caption: 12,
  micro: 11
};

export const fontFamily = {
  display: Platform.select({
    ios: "System",
    android: "sans-serif",
    web: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    default: "System",
  }),
  heading: Platform.select({
    ios: "System",
    android: "sans-serif-medium",
    web: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    default: "System",
  }),
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    web: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    default: "System",
  }),
};
