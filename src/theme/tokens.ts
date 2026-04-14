import { Platform } from "react-native";

export const colors = {
  ink: "#04101B",
  text: "#DCE9F6",
  heading: "#F4FBFF",
  panel: "#FFFFFF",
  panelRaised: "#102338",
  panelMuted: "#153049",
  line: "#223E59",
  mist: "#F8FBFF",
  muted: "#8FA8BF",
  accent: "#0E2438",
  accentStrong: "#7DD3FC",
  accentDeep: "#C7F36B",
  caution: "#FFB780",
  danger: "#FF9A92",
  lowRisk: "#6DE2A1",
  mediumRisk: "#FFC56B",
  highRisk: "#FF8F8F",
  glow: "#123650",
  canvas: "#04101B",
  darkSurface: "#071728",
  darkSurfaceDeep: "#03101D",
  sky: "#7DD3FC",
  aqua: "#5EEAD4",
  lime: "#C7F36B",
  peach: "#FFB780"
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
