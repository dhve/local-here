import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Linking,
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
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CityThemes } from "@/constants/theme";
import { getCityById } from "@/constants/cities";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type NeighborhoodPulseRouteProp = RouteProp<RootStackParamList, "NeighborhoodPulse">;

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

interface PulseData {
  neighborhood: string;
  vibe: string;
  narration: string;
  openNow: { name: string; type: string; note: string }[];
  transitTips: string;
  crowdLevel: "quiet" | "moderate" | "busy" | "packed";
  localEvents: string;
  insiderTip: string;
  audioUrl?: string;
}

const CROWD_LABELS: Record<string, string> = {
  quiet: "QUIET",
  moderate: "MODERATE",
  busy: "BUSY",
  packed: "PACKED",
};

const CROWD_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  quiet: "moon",
  moderate: "users",
  busy: "trending-up",
  packed: "zap",
};

const PLACE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  cafe: "coffee",
  restaurant: "shopping-bag",
  bar: "glass-water",
  shop: "shopping-bag",
  venue: "music",
};

function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withTiming(2.5, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1500 }), -1, false);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.pulsingDotContainer}>
      <Animated.View style={[styles.pulsingRing, { borderColor: color }, ringStyle]} />
      <View style={[styles.pulsingCenter, { backgroundColor: color }]} />
    </View>
  );
}

export default function NeighborhoodPulseScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<NeighborhoodPulseRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const city = getCityById(route.params.cityId);
  const cityTheme = city ? CityThemes[city.id as keyof typeof CityThemes] : CityThemes.nyc;

  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [pulseData, setPulseData] = useState<PulseData | null>(null);
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

  const fetchPulse = useCallback(async () => {
    if (!city || isLoading) return;
    setIsLoading(true);
    setErrorMessage("");
    setPulseData(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      const response = await fetch(`${baseUrl}/api/neighborhood-pulse`, {
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

      setPulseData(data);

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
    if (locationPermission?.granted && !pulseData && !isLoading) {
      fetchPulse();
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
              <Feather name="activity" size={32} color={cityTheme.accent} />
            </View>
            <ThemedText type="h2" style={styles.permissionTitle}>Location Required</ThemedText>
            <ThemedText type="body" style={[styles.permissionDesc, { color: theme.textSecondary }]}>
              Neighborhood Pulse needs your location to show what's happening around you
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
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={20} testID="button-back-pulse">
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={[styles.statusDot, { backgroundColor: cityTheme.accent }]} />
            <ThemedText type="caption" style={{ opacity: 0.7 }}>NEIGHBORHOOD PULSE</ThemedText>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <PulsingDot color={cityTheme.accent} />
            <Animated.View entering={FadeIn.duration(600).delay(400)}>
              <ThemedText type="bodyMedium" style={[styles.loadingText, { color: theme.textSecondary }]}>
                Reading the neighborhood...
              </ThemedText>
            </Animated.View>
          </View>
        ) : pulseData ? (
          <View style={styles.resultsContainer}>
            <Animated.View entering={FadeInDown.duration(600)} style={styles.neighborhoodHeader}>
              <ThemedText type="h2" style={styles.neighborhoodName}>
                {pulseData.neighborhood}
              </ThemedText>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: `${cityTheme.accent}20`, borderColor: `${cityTheme.accent}40` }]}>
                  <Feather name={CROWD_ICONS[pulseData.crowdLevel] || "users"} size={14} color={cityTheme.accent} />
                  <ThemedText type="caption" style={{ color: cityTheme.accent, letterSpacing: 2 }}>
                    {CROWD_LABELS[pulseData.crowdLevel] || "MODERATE"}
                  </ThemedText>
                </View>
              </View>
            </Animated.View>

            {pulseData.vibe ? (
              <Animated.View entering={FadeInUp.duration(500).delay(200)} style={[styles.vibeCard, { borderColor: `${cityTheme.accent}30` }]}>
                <Feather name="wind" size={18} color={cityTheme.accent} />
                <ThemedText type="body" style={{ color: theme.textSecondary, flex: 1, lineHeight: 22 }}>
                  {pulseData.vibe}
                </ThemedText>
              </Animated.View>
            ) : null}

            {isPlaying ? (
              <Animated.View entering={FadeIn.duration(300)} style={[styles.playingIndicator, { borderColor: `${cityTheme.accent}30` }]}>
                <Feather name="volume-2" size={16} color={cityTheme.accent} />
                <ThemedText type="small" style={{ color: cityTheme.accent }}>Playing pulse...</ThemedText>
              </Animated.View>
            ) : null}

            {pulseData.openNow.length > 0 ? (
              <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.section}>
                <ThemedText type="h4" style={styles.sectionTitle}>Open Now</ThemedText>
                {pulseData.openNow.map((place, i) => (
                  <View key={i} style={[styles.placeCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
                    <View style={[styles.placeIcon, { backgroundColor: `${cityTheme.accent}15` }]}>
                      <Feather name={PLACE_ICONS[place.type] || "map-pin"} size={16} color={cityTheme.accent} />
                    </View>
                    <View style={styles.placeInfo}>
                      <ThemedText type="bodyMedium" style={{ color: "#FFF" }}>{place.name}</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textMuted, lineHeight: 18 }}>{place.note}</ThemedText>
                    </View>
                  </View>
                ))}
              </Animated.View>
            ) : null}

            {pulseData.transitTips ? (
              <Animated.View entering={FadeInUp.duration(500).delay(600)} style={[styles.infoCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
                <Feather name="navigation" size={18} color={cityTheme.accent} />
                <View style={styles.infoCardContent}>
                  <ThemedText type="bodyMedium" style={{ color: "#FFF" }}>Transit</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 20 }}>{pulseData.transitTips}</ThemedText>
                </View>
              </Animated.View>
            ) : null}

            {pulseData.localEvents ? (
              <Animated.View entering={FadeInUp.duration(500).delay(800)} style={[styles.infoCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
                <Feather name="calendar" size={18} color={cityTheme.accent} />
                <View style={styles.infoCardContent}>
                  <ThemedText type="bodyMedium" style={{ color: "#FFF" }}>Happening Today</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 20 }}>{pulseData.localEvents}</ThemedText>
                </View>
              </Animated.View>
            ) : null}

            {pulseData.insiderTip ? (
              <Animated.View entering={FadeInUp.duration(500).delay(1000)} style={[styles.insiderTipCard, { backgroundColor: `${cityTheme.accent}10`, borderColor: `${cityTheme.accent}25` }]}>
                <Feather name="message-circle" size={16} color={cityTheme.accent} />
                <View style={styles.insiderTipContent}>
                  <ThemedText type="caption" style={{ color: cityTheme.accent, letterSpacing: 2, marginBottom: 4 }}>INSIDER TIP</ThemedText>
                  <ThemedText type="small" style={{ color: theme.text, lineHeight: 20 }}>{pulseData.insiderTip}</ThemedText>
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInUp.duration(500).delay(1200)}>
              <Pressable
                onPress={fetchPulse}
                style={[styles.refreshButton, { borderColor: `${cityTheme.accent}40` }]}
                testID="button-refresh-pulse"
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
              onPress={fetchPulse}
              style={[styles.actionButton, { backgroundColor: cityTheme.accent, marginTop: Spacing.xl }]}
              testID="button-retry-pulse"
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
  pulsingDotContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  pulsingRing: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
  },
  pulsingCenter: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
  badges: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  vibeCard: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    alignItems: "flex-start",
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
  placeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  placeInfo: {
    flex: 1,
    gap: 2,
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
  insiderTipCard: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  insiderTipContent: {
    flex: 1,
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
