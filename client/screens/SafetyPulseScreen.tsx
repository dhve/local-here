import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CityThemes } from "@/constants/theme";
import { getCityById } from "@/constants/cities";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type SafetyPulseRouteProp = RouteProp<RootStackParamList, "SafetyPulse">;

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

interface SafetyData {
  neighborhood: string;
  safetyLevel: "safe" | "moderate" | "caution" | "avoid";
  narration: string;
  tips: string[];
  emergencyNearby: { type: string; name: string; distance: string }[];
  wellLitAreas: string;
  transitSafety: string;
  audioUrl?: string;
}

function PulsingShield({ color }: { color: string }) {
  const scale1 = useSharedValue(1);
  const opacity1 = useSharedValue(0.4);
  const scale2 = useSharedValue(1);
  const opacity2 = useSharedValue(0.3);

  useEffect(() => {
    scale1.value = withRepeat(withTiming(2, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false);
    opacity1.value = withRepeat(withSequence(withTiming(0.4, { duration: 0 }), withTiming(0, { duration: 2000 })), -1, false);
    scale2.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(2, { duration: 2000, easing: Easing.out(Easing.ease) })), -1, false);
    opacity2.value = withRepeat(withSequence(withTiming(0.3, { duration: 700 }), withTiming(0, { duration: 2000 })), -1, false);
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: opacity1.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));

  return (
    <View style={styles.shieldContainer}>
      <Animated.View style={[styles.shieldRing, { borderColor: color }, ring1Style]} />
      <Animated.View style={[styles.shieldRing, { borderColor: color }, ring2Style]} />
      <View style={[styles.shieldIcon, { backgroundColor: `${color}20` }]}>
        <Feather name="shield" size={40} color={color} />
      </View>
    </View>
  );
}

const SAFETY_COLORS: Record<string, string> = {
  safe: "#2ED573",
  moderate: "#FFE66D",
  caution: "#FF9F43",
  avoid: "#FF4757",
};

const SAFETY_LABELS: Record<string, string> = {
  safe: "SAFE",
  moderate: "MODERATE",
  caution: "USE CAUTION",
  avoid: "AVOID AREA",
};

const EMERGENCY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  hospital: "plus-circle",
  police: "shield",
  fire: "alert-triangle",
};

export default function SafetyPulseScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<SafetyPulseRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const city = getCityById(route.params.cityId);
  const cityTheme = city ? CityThemes[city.id as keyof typeof CityThemes] : CityThemes.nyc;

  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [safetyData, setSafetyData] = useState<SafetyData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isMountedRef = useRef(true);
  const baseUrl = getApiUrl();

  const audioPlayer = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(audioPlayer);

  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      await setAudioModeAsync({ playsInSilentMode: true });
    })();
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setIsPlaying(false);
      setAudioUri(null);
    }
  }, [playerStatus.didJustFinish]);

  useEffect(() => {
    if (audioUri && playerStatus.isLoaded && !playerStatus.playing) {
      audioPlayer.play();
      setIsPlaying(true);
    }
  }, [audioUri, playerStatus.isLoaded, playerStatus.playing]);

  const fetchSafetyPulse = useCallback(async () => {
    if (!city || isLoading) return;
    setIsLoading(true);
    setErrorMessage("");
    setSafetyData(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      const response = await fetch(`${baseUrl}/api/safety-pulse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId: city.id,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timeOfDay: getTimeOfDay(),
        }),
      });

      const data = await response.json();
      if (!isMountedRef.current) return;

      if (!response.ok || data.error) {
        setErrorMessage(data.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      setSafetyData(data);

      if (data.audioUrl) {
        setAudioUri(`${baseUrl}${data.audioUrl}`);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        const isLocationError = err?.message?.includes("Location") || err?.code === "ERR_LOCATION";
        setErrorMessage(isLocationError ? "Could not get your location. Make sure GPS is enabled." : "Connection failed. Check your network.");
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [city, isLoading, baseUrl]);

  useEffect(() => {
    if (locationPermission?.granted && !safetyData && !isLoading) {
      fetchSafetyPulse();
    }
  }, [locationPermission?.granted]);

  if (!city) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>City not found</ThemedText>
      </ThemedView>
    );
  }

  if (!locationPermission || !locationPermission.granted) {
    const denied = locationPermission?.status === "denied" && !locationPermission?.canAskAgain;
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.permissionContent, { paddingTop: insets.top + Spacing.xl }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={20}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.permissionCenter}>
            <View style={[styles.permissionIcon, { borderColor: cityTheme.accent }]}>
              <Feather name="navigation" size={32} color={cityTheme.accent} />
            </View>
            <ThemedText type="h2" style={styles.permissionTitle}>Location Required</ThemedText>
            <ThemedText type="body" style={[styles.permissionDesc, { color: theme.textSecondary }]}>
              Safety Pulse needs your exact location to give you hyper-local safety info
            </ThemedText>
            {denied && Platform.OS !== "web" ? (
              <Pressable
                onPress={async () => { try { await Linking.openSettings(); } catch {} }}
                style={[styles.actionButton, { backgroundColor: cityTheme.accent }]}
                testID="button-open-settings"
              >
                <ThemedText type="bodyMedium" style={{ color: "#000" }}>Open Settings</ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={requestLocationPermission}
                style={[styles.actionButton, { backgroundColor: cityTheme.accent }]}
                testID="button-enable-location"
              >
                <ThemedText type="bodyMedium" style={{ color: "#000" }}>Enable Location</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </ThemedView>
    );
  }

  const safetyColor = safetyData ? SAFETY_COLORS[safetyData.safetyLevel] || SAFETY_COLORS.moderate : cityTheme.accent;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={20} testID="button-back-safety">
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={[styles.statusDot, { backgroundColor: cityTheme.accent }]} />
            <ThemedText type="caption" style={{ opacity: 0.7 }}>SAFETY PULSE</ThemedText>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <PulsingShield color={cityTheme.accent} />
            <Animated.View entering={FadeIn.duration(600).delay(400)}>
              <ThemedText type="bodyMedium" style={[styles.loadingText, { color: theme.textSecondary }]}>
                Scanning your area...
              </ThemedText>
            </Animated.View>
          </View>
        ) : safetyData ? (
          <View style={styles.resultsContainer}>
            <Animated.View entering={FadeInDown.duration(600)} style={styles.neighborhoodHeader}>
              <ThemedText type="h2" style={styles.neighborhoodName}>
                {safetyData.neighborhood}
              </ThemedText>
              <View style={[styles.safetyBadge, { backgroundColor: `${safetyColor}20`, borderColor: `${safetyColor}40` }]}>
                <Feather name="shield" size={14} color={safetyColor} />
                <ThemedText type="caption" style={{ color: safetyColor, letterSpacing: 2 }}>
                  {SAFETY_LABELS[safetyData.safetyLevel] || "MODERATE"}
                </ThemedText>
              </View>
            </Animated.View>

            {isPlaying ? (
              <Animated.View entering={FadeIn.duration(300)} style={[styles.playingIndicator, { borderColor: `${cityTheme.accent}30` }]}>
                <Feather name="volume-2" size={16} color={cityTheme.accent} />
                <ThemedText type="small" style={{ color: cityTheme.accent }}>Playing briefing...</ThemedText>
              </Animated.View>
            ) : null}

            {safetyData.tips.length > 0 ? (
              <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.section}>
                <ThemedText type="h4" style={styles.sectionTitle}>Local Safety Tips</ThemedText>
                {safetyData.tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <View style={[styles.tipDot, { backgroundColor: cityTheme.accent }]} />
                    <ThemedText type="small" style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</ThemedText>
                  </View>
                ))}
              </Animated.View>
            ) : null}

            {safetyData.emergencyNearby.length > 0 ? (
              <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.section}>
                <ThemedText type="h4" style={styles.sectionTitle}>Emergency Services Nearby</ThemedText>
                {safetyData.emergencyNearby.map((e, i) => (
                  <View key={i} style={[styles.emergencyCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
                    <View style={[styles.emergencyIcon, { backgroundColor: `${cityTheme.accent}15` }]}>
                      <Feather name={EMERGENCY_ICONS[e.type] || "alert-circle"} size={18} color={cityTheme.accent} />
                    </View>
                    <View style={styles.emergencyInfo}>
                      <ThemedText type="bodyMedium" style={styles.emergencyName}>{e.name}</ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textMuted }}>{e.distance}</ThemedText>
                    </View>
                  </View>
                ))}
              </Animated.View>
            ) : null}

            {safetyData.wellLitAreas ? (
              <Animated.View entering={FadeInUp.duration(500).delay(600)} style={[styles.infoCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
                <Feather name="sun" size={18} color={cityTheme.accent} />
                <View style={styles.infoCardContent}>
                  <ThemedText type="bodyMedium" style={styles.infoCardTitle}>Well-Lit Areas</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 20 }}>{safetyData.wellLitAreas}</ThemedText>
                </View>
              </Animated.View>
            ) : null}

            {safetyData.transitSafety ? (
              <Animated.View entering={FadeInUp.duration(500).delay(800)} style={[styles.infoCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
                <Feather name="navigation" size={18} color={cityTheme.accent} />
                <View style={styles.infoCardContent}>
                  <ThemedText type="bodyMedium" style={styles.infoCardTitle}>Transit Safety</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 20 }}>{safetyData.transitSafety}</ThemedText>
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInUp.duration(500).delay(1000)}>
              <Pressable
                onPress={fetchSafetyPulse}
                style={[styles.refreshButton, { borderColor: `${cityTheme.accent}40` }]}
                testID="button-refresh-safety"
              >
                <Feather name="refresh-cw" size={16} color={cityTheme.accent} />
                <ThemedText type="bodyMedium" style={{ color: cityTheme.accent }}>Refresh</ThemedText>
              </Pressable>
            </Animated.View>
          </View>
        ) : errorMessage ? (
          <View style={styles.loadingContainer}>
            <Feather name="alert-circle" size={48} color="#FF4757" />
            <ThemedText type="body" style={[styles.errorText, { color: theme.textSecondary }]}>{errorMessage}</ThemedText>
            <Pressable
              onPress={fetchSafetyPulse}
              style={[styles.actionButton, { backgroundColor: cityTheme.accent, marginTop: Spacing.xl }]}
              testID="button-retry-safety"
            >
              <ThemedText type="bodyMedium" style={{ color: "#000" }}>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
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
    paddingHorizontal: Spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing["3xl"],
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["7xl"],
    gap: Spacing.xl,
  },
  shieldContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  shieldRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  shieldIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    textAlign: "center",
  },
  resultsContainer: {
    gap: Spacing.xl,
  },
  neighborhoodHeader: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  neighborhoodName: {
    color: "#FFF",
  },
  safetyBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  playingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    color: "#FFF",
    marginBottom: Spacing.xs,
  },
  tipRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
  },
  emergencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyInfo: {
    flex: 1,
    gap: 2,
  },
  emergencyName: {
    color: "#FFF",
  },
  infoCard: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoCardContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  infoCardTitle: {
    color: "#FFF",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  permissionContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  permissionCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
    paddingBottom: Spacing["7xl"],
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    color: "#FFF",
    textAlign: "center",
  },
  permissionDesc: {
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 24,
  },
  actionButton: {
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  errorText: {
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 24,
  },
});
