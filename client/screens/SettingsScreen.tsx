import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Switch,
  Pressable,
  Image,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const STORAGE_KEYS = {
  DISPLAY_NAME: "@localhere/display_name",
  VOICE_ENABLED: "@localhere/voice_enabled",
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const name = await AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_NAME);
      const voice = await AsyncStorage.getItem(STORAGE_KEYS.VOICE_ENABLED);
      if (name) setDisplayName(name);
      if (voice !== null) setVoiceEnabled(voice === "true");
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveDisplayName = async (name: string) => {
    setDisplayName(name);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, name);
    } catch (error) {
      console.error("Error saving display name:", error);
    }
  };

  const toggleVoice = async (value: boolean) => {
    setVoiceEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VOICE_ENABLED, value.toString());
    } catch (error) {
      console.error("Error saving voice setting:", error);
    }
  };

  const clearHistory = () => {
    if (Platform.OS === "web") {
      if (confirm("This will clear all your conversation history. Continue?")) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      Alert.alert(
        "Clear History",
        "This will clear all your conversation history. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear",
            style: "destructive",
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing["2xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <Animated.View 
          entering={FadeIn.delay(100).duration(400)}
          style={styles.avatarSection}
        >
          <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Image
              source={require("../../assets/images/avatar-default.png")}
              style={styles.avatar}
              resizeMode="cover"
            />
          </View>
          <Pressable style={styles.changeAvatarButton}>
            <ThemedText style={{ color: theme.link }} type="bodyMedium">
              Change Avatar
            </ThemedText>
          </Pressable>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
            type="caption"
          >
            PROFILE
          </ThemedText>
          <View
            style={[
              styles.inputCard,
              { 
                backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF",
              },
              Shadows.soft,
            ]}
          >
            <View style={styles.inputRow}>
              <View style={[styles.inputIcon, { backgroundColor: `${theme.link}15` }]}>
                <Feather name="user" size={18} color={theme.link} />
              </View>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your name"
                placeholderTextColor={theme.textMuted}
                value={displayName}
                onChangeText={saveDisplayName}
                testID="display-name-input"
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
            type="caption"
          >
            PREFERENCES
          </ThemedText>

          <View
            style={[
              styles.settingsCard,
              { 
                backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF",
              },
              Shadows.soft,
            ]}
          >
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.inputIcon, { backgroundColor: "#10B98115" }]}>
                  <Feather name="volume-2" size={18} color="#10B981" />
                </View>
                <View style={styles.settingTextContainer}>
                  <ThemedText type="bodyMedium">Auto-play Voice</ThemedText>
                  <ThemedText
                    style={{ color: theme.textMuted }}
                    type="caption"
                  >
                    Automatically play AI responses
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={voiceEnabled}
                onValueChange={toggleVoice}
                trackColor={{ false: theme.backgroundTertiary, true: "#10B981" }}
                thumbColor="#FFFFFF"
                testID="voice-toggle"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.backgroundTertiary }]} />

            <Pressable
              onPress={clearHistory}
              style={styles.settingRow}
              testID="clear-history-button"
            >
              <View style={styles.settingLeft}>
                <View style={[styles.inputIcon, { backgroundColor: "#EF444415" }]}>
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </View>
                <ThemedText style={{ color: "#EF4444" }} type="bodyMedium">
                  Clear Conversation History
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(400).duration(400)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
            type="caption"
          >
            ABOUT
          </ThemedText>

          <View
            style={[
              styles.settingsCard,
              { 
                backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF",
              },
              Shadows.soft,
            ]}
          >
            <View style={styles.aboutRow}>
              <ThemedText type="body">Version</ThemedText>
              <ThemedText style={{ color: theme.textMuted }} type="body">
                1.0.0
              </ThemedText>
            </View>
          </View>

          <ThemedText
            style={[styles.footerText, { color: theme.textMuted }]}
            type="caption"
          >
            LocalHere uses AI to provide local recommendations. Responses are generated and may not always be accurate. Always verify important information.
          </ThemedText>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
  },
  changeAvatarButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing["3xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
    letterSpacing: 1,
  },
  inputCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  inputIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    height: 44,
  },
  settingsCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
  footerText: {
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 18,
  },
});
