import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  allowPasswordToggle?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences";
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  allowPasswordToggle,
  multiline,
  autoCapitalize = "none"
}: Props) {
  const colors = useThemeColors();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const shouldTogglePassword = secureTextEntry && allowPasswordToggle;
  const resolvedSecureEntry = shouldTogglePassword ? !passwordVisible : secureTextEntry;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          {
            borderColor: colors.line,
            backgroundColor: colors.panelRaised,
          },
          multiline ? styles.multiline : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={resolvedSecureEntry}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          style={[
            styles.input,
            {
              color: colors.heading,
            },
          ]}
        />
        {shouldTogglePassword ? (
          <Pressable
            onPress={() => setPasswordVisible((current) => !current)}
            style={styles.passwordToggle}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
          >
            <Text style={[styles.passwordToggleLabel, { color: colors.accentStrong }]}>{passwordVisible ? "🙈" : "👁"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  label: {
    fontSize: type.micro,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  inputShell: {
    borderWidth: 1,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: type.body
  },
  multiline: {
    minHeight: 100,
    alignItems: "flex-start"
  },
  passwordToggle: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  passwordToggleLabel: {
    fontSize: type.caption,
    fontWeight: "700",
  }
});
