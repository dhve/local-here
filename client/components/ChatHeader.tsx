import React from "react";
import { View, StyleSheet } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

interface ChatHeaderProps {
  cityName: string;
  accentColor: string;
}

export function ChatHeader({ cityName, accentColor }: ChatHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
      <ThemedText type="h4" style={styles.title}>
        {cityName} Local
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    letterSpacing: -0.3,
  },
});
