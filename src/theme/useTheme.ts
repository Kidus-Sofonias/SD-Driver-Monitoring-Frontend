import { darkColors, lightColors } from "./palettes";
import { useApp } from "../state/AppContext";

export function useThemeColors() {
  const { themeMode } = useApp();
  return themeMode === "dark" ? darkColors : lightColors;
}
