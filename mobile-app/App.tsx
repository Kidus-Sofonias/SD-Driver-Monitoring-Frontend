import React from "react";
import { SafeAreaView, StatusBar, StyleSheet } from "react-native";

import { SafeDrivingApp } from "./src/screens/SafeDrivingApp";
import { AppProvider } from "./src/state/AppContext";
import { useThemeColors } from "./src/theme/useTheme";

export default function App() {
  return (
    <AppProvider>
      <ThemedApp />
    </AppProvider>
  );
}

function ThemedApp() {
  const colors = useThemeColors();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.canvas }]}>
      <StatusBar barStyle={colors.canvas === "#08111C" ? "light-content" : "dark-content"} />
      <SafeDrivingApp />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
