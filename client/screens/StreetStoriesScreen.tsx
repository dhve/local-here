import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import Animated, {
  FadeIn,
  FadeOut,
  FadeInUp,
  FadeInDown,
  SlideInUp,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CityThemes } from "@/constants/theme";
import { getCityById } from "@/constants/cities";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type StreetStoriesRouteProp = RouteProp<RootStackParamList, "StreetStories">;

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getAmbientTint(timeOfDay: string): string {
  switch (timeOfDay) {
    case "morning": return "rgba(255, 200, 120, 0.06)";
    case "evening": return "rgba(255, 140, 80, 0.08)";
    case "night": return "rgba(80, 100, 180, 0.08)";
    default: return "rgba(255, 255, 255, 0.02)";
  }
}

function FilmGrainOverlay() {
  return <View style={styles.filmGrain} pointerEvents="none" />;
}

export default function StreetStoriesScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<StreetStoriesRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const city = getCityById(route.params.cityId);
  const cityTheme = city ? CityThemes[city.id as keyof typeof CityThemes] : CityThemes.nyc;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [insiderMode, setInsiderMode] = useState(false);
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const [audioOnlyMode, setAudioOnlyMode] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifiedPlace, setIdentifiedPlace] = useState<{
    name: string;
    category: string;
    story: string;
    localInsight: string;
  } | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isMountedRef = useRef(true);

  const timeOfDay = getTimeOfDay();
  const ambientTint = getAmbientTint(timeOfDay);
  const baseUrl = getApiUrl();

  const audioPlayer = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(audioPlayer);

  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      await setAudioModeAsync({ playsInSilentMode: true });
    })();

    return () => {
      isMountedRef.current = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setAudioUri(null);
    }
  }, [playerStatus.didJustFinish]);

  useEffect(() => {
    if (audioUri && playerStatus.isLoaded && !playerStatus.playing) {
      audioPlayer.play();
    }
  }, [audioUri, playerStatus.isLoaded, playerStatus.playing]);

  useEffect(() => {
    if (!locationPermission?.granted) return;

    (async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isMountedRef.current) {
          setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }

        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
          (newLoc) => {
            if (isMountedRef.current) {
              setLocation({ latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude });
            }
          }
        );
      } catch {}
    })();
  }, [locationPermission?.granted]);

  useEffect(() => {
    (async () => {
      try {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        if (batteryLevel > 0 && batteryLevel < 0.15) {
          setLowBattery(true);
          setAudioOnlyMode(true);
        }
      } catch {}
    })();
  }, []);

  const handleExit = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const toggleInsider = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInsiderMode((prev) => !prev);
  }, []);

  const toggleAccessibility = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAccessibilityMode((prev) => !prev);
  }, []);

  const handleIdentifyCapture = useCallback(async () => {
    if (!cameraRef.current || !city || !location || isIdentifying || audioOnlyMode) return;
    setIsIdentifying(true);
    setIdentifiedPlace(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
      });

      if (!photo?.base64 || !isMountedRef.current) {
        setIsIdentifying(false);
        return;
      }

      const url = new URL("/api/identify-location", baseUrl);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: photo.base64,
          cityId: city.id,
          latitude: location.latitude,
          longitude: location.longitude,
          insiderMode,
          timeOfDay,
          accessibilityMode,
        }),
      });

      if (!response.ok) {
        console.error("Identify failed:", response.status);
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;

      if (data.story) {
        setIdentifiedPlace({
          name: data.name || "Unknown spot",
          category: data.category || "other",
          story: data.story,
          localInsight: data.localInsight || "",
        });

        try {
          const audioUrl = new URL("/api/story-audio", baseUrl);
          const audioResponse = await fetch(audioUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.story, cityId: city.id }),
          });

          if (audioResponse.ok) {
            const audioData = await audioResponse.json();
            if (audioData.audioUrl && isMountedRef.current) {
              const fullAudioUrl = new URL(audioData.audioUrl, baseUrl);
              setAudioUri(fullAudioUrl.href);
            }
          }
        } catch (audioError) {
          console.error("Audio generation failed:", audioError);
        }
      }
    } catch (error) {
      console.error("Identify capture failed:", error);
    } finally {
      if (isMountedRef.current) setIsIdentifying(false);
    }
  }, [city, location, insiderMode, accessibilityMode, timeOfDay, baseUrl, isIdentifying, audioOnlyMode]);

  const dismissIdentified = useCallback(() => {
    setIdentifiedPlace(null);
    setAudioUri(null);
  }, []);

  if (!cameraPermission) {
    return (
      <View style={[styles.container, { backgroundColor: "#0A0A0A" }]}>
        <ActivityIndicator color={cityTheme.accent} />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    const cameraDeniedPermanently = cameraPermission.status === "denied" && !cameraPermission.canAskAgain;
    return (
      <View style={[styles.container, styles.permissionScreen, { backgroundColor: "#0A0A0A" }]}>
        <View style={[styles.permissionContent, { paddingTop: insets.top + Spacing["3xl"] }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={20}>
            <Feather name="arrow-left" size={24} color="#FFF" />
          </Pressable>
          <View style={styles.permissionCenter}>
            <View style={[styles.permissionIcon, { borderColor: cityTheme.accent }]}>
              <Feather name="camera" size={32} color={cityTheme.accent} />
            </View>
            <ThemedText type="h2" style={styles.permissionTitle}>
              Camera Access
            </ThemedText>
            <ThemedText type="body" style={styles.permissionDesc}>
              Street Stories uses your camera to identify buildings and landmarks
            </ThemedText>
            {cameraDeniedPermanently && Platform.OS !== "web" ? (
              <Pressable
                onPress={async () => { try { await Linking.openSettings(); } catch {} }}
                style={[styles.permissionButton, { backgroundColor: cityTheme.accent }]}
                testID="button-open-settings-camera"
              >
                <ThemedText type="bodyMedium" style={{ color: "#000" }}>
                  Open Settings
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={requestCameraPermission}
                style={[styles.permissionButton, { backgroundColor: cityTheme.accent }]}
                testID="button-enable-camera"
              >
                <ThemedText type="bodyMedium" style={{ color: "#000" }}>
                  Enable Camera
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (!locationPermission || !locationPermission.granted) {
    const locationDeniedPermanently = locationPermission?.status === "denied" && !locationPermission?.canAskAgain;
    return (
      <View style={[styles.container, styles.permissionScreen, { backgroundColor: "#0A0A0A" }]}>
        <View style={[styles.permissionContent, { paddingTop: insets.top + Spacing["3xl"] }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={20}>
            <Feather name="arrow-left" size={24} color="#FFF" />
          </Pressable>
          <View style={styles.permissionCenter}>
            <View style={[styles.permissionIcon, { borderColor: cityTheme.accent }]}>
              <Feather name="map-pin" size={32} color={cityTheme.accent} />
            </View>
            <ThemedText type="h2" style={styles.permissionTitle}>
              Location Access
            </ThemedText>
            <ThemedText type="body" style={styles.permissionDesc}>
              We need your location to identify what you're looking at
            </ThemedText>
            {locationDeniedPermanently && Platform.OS !== "web" ? (
              <Pressable
                onPress={async () => { try { await Linking.openSettings(); } catch {} }}
                style={[styles.permissionButton, { backgroundColor: cityTheme.accent }]}
                testID="button-open-settings-location"
              >
                <ThemedText type="bodyMedium" style={{ color: "#000" }}>
                  Open Settings
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={requestLocationPermission}
                style={[styles.permissionButton, { backgroundColor: cityTheme.accent }]}
                testID="button-enable-location"
              >
                <ThemedText type="bodyMedium" style={{ color: "#000" }}>
                  Enable Location
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {audioOnlyMode ? (
        <View style={[styles.audioOnlyBg, { backgroundColor: "#0A0A0A" }]}>
          <View style={[styles.audioOnlyGrain, { backgroundColor: ambientTint }]} />
        </View>
      ) : (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      )}

      <View style={[styles.ambientOverlay, { backgroundColor: ambientTint }]} pointerEvents="none" />
      <FilmGrainOverlay />

      {timeOfDay === "night" ? (
        <View style={styles.nightOverlay} pointerEvents="none" />
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={handleExit} style={styles.exitButton} hitSlop={20} testID="button-exit-stories">
          <View style={styles.exitButtonInner}>
            <Feather name="x" size={20} color="#FFF" />
          </View>
        </Pressable>

        <Animated.View entering={FadeIn.duration(800).delay(200)} style={styles.modeIndicator}>
          <View style={[styles.modeIndicatorDot, { backgroundColor: cityTheme.accent }]} />
          <ThemedText style={styles.modeIndicatorText} type="caption">
            STREET STORIES
          </ThemedText>
        </Animated.View>

        <View style={styles.topBarRight}>
          <Pressable onPress={toggleAccessibility} style={styles.insiderToggle} hitSlop={20} testID="button-accessibility-toggle">
            <View style={[styles.insiderButtonInner, accessibilityMode ? { backgroundColor: cityTheme.accent } : null]}>
              <Feather name="compass" size={16} color={accessibilityMode ? "#000" : "#FFF"} />
            </View>
          </Pressable>
          <Pressable onPress={toggleInsider} style={styles.insiderToggle} hitSlop={20} testID="button-insider-toggle">
            <View style={[styles.insiderButtonInner, insiderMode ? { backgroundColor: cityTheme.accent } : null]}>
              <Feather name="eye" size={16} color={insiderMode ? "#000" : "#FFF"} />
            </View>
          </Pressable>
        </View>
      </View>

      {insiderMode ? (
        <Animated.View
          entering={FadeInDown.duration(400)}
          exiting={FadeOut.duration(300)}
          style={[styles.insiderBadge, { backgroundColor: `${cityTheme.accent}20`, borderColor: `${cityTheme.accent}40` }]}
        >
          <Feather name="lock" size={12} color={cityTheme.accent} />
          <ThemedText style={[styles.insiderBadgeText, { color: cityTheme.accent }]} type="caption">
            LOCALS ONLY
          </ThemedText>
        </Animated.View>
      ) : null}

      {accessibilityMode ? (
        <Animated.View
          entering={FadeInDown.duration(400)}
          exiting={FadeOut.duration(300)}
          style={[styles.accessibilityBadge, { backgroundColor: `${cityTheme.accent}20`, borderColor: `${cityTheme.accent}40` }, insiderMode ? { top: 132 } : null]}
        >
          <Feather name="compass" size={12} color={cityTheme.accent} />
          <ThemedText style={[styles.insiderBadgeText, { color: cityTheme.accent }]} type="caption">
            ACCESSIBILITY
          </ThemedText>
        </Animated.View>
      ) : null}

      {!audioOnlyMode && !identifiedPlace ? (
        <Animated.View
          entering={FadeInUp.duration(600).delay(800)}
          style={[styles.captureButtonContainer, { bottom: insets.bottom + Spacing.xl }]}
        >
          <Pressable
            onPress={handleIdentifyCapture}
            disabled={isIdentifying || !location}
            style={[
              styles.captureButton,
              { borderColor: cityTheme.accent },
              isIdentifying ? { opacity: 0.5 } : null,
            ]}
            testID="button-identify-capture"
          >
            {isIdentifying ? (
              <ActivityIndicator size="small" color={cityTheme.accent} />
            ) : (
              <View style={styles.captureButtonContent}>
                <Feather name="crosshair" size={22} color={cityTheme.accent} />
                <ThemedText style={[styles.captureButtonText, { color: cityTheme.accent }]} type="caption">
                  IDENTIFY
                </ThemedText>
              </View>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {identifiedPlace ? (
        <Animated.View
          entering={SlideInUp.duration(500).springify()}
          exiting={FadeOut.duration(400)}
          style={[styles.identifiedCard, { paddingBottom: insets.bottom + Spacing.lg }]}
        >
          <Pressable onPress={dismissIdentified} style={styles.identifiedDismiss} hitSlop={20}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <View style={[styles.identifiedCardInner, { borderColor: `${cityTheme.accent}30` }]}>
            <View style={styles.identifiedHeader}>
              <Feather name="map-pin" size={16} color={cityTheme.accent} />
              <ThemedText style={styles.identifiedName} type="h4">
                {identifiedPlace.name}
              </ThemedText>
            </View>
            <ThemedText style={[styles.identifiedCategory, { color: cityTheme.accent }]} type="caption">
              {identifiedPlace.category.toUpperCase().replace("_", " ")}
            </ThemedText>
            <ThemedText style={styles.identifiedStory} type="small">
              {identifiedPlace.story}
            </ThemedText>
            {identifiedPlace.localInsight ? (
              <View style={[styles.insightPill, { backgroundColor: `${cityTheme.accent}15`, borderColor: `${cityTheme.accent}25` }]}>
                <Feather name="message-circle" size={12} color={cityTheme.accent} />
                <ThemedText style={styles.insightText} type="small">
                  {identifiedPlace.localInsight}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {isIdentifying ? (
        <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.identifyingOverlay}>
          <View style={styles.identifyingPill}>
            <ActivityIndicator size="small" color={cityTheme.accent} />
            <ThemedText style={styles.loadingText} type="small">
              Looking at this spot...
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}

      {lowBattery ? (
        <Animated.View entering={FadeIn.duration(400)} style={[styles.batteryWarning, { bottom: insets.bottom + 90 }]}>
          <Feather name="battery" size={14} color="#FFE66D" />
          <ThemedText style={styles.batteryText} type="caption">
            Low battery - audio only mode
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  audioOnlyBg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  audioOnlyGrain: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  filmGrain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(200, 180, 160, 0.03)",
  },
  nightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 20, 50, 0.15)",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  exitButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  exitButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeIndicatorText: {
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 2,
    fontSize: 10,
  },
  insiderToggle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  insiderButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  insiderBadge: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 10,
  },
  insiderBadgeText: {
    letterSpacing: 2,
    fontSize: 10,
  },
  accessibilityBadge: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 10,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
  },
  batteryWarning: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },
  batteryText: {
    color: "#FFE66D",
    fontSize: 10,
  },
  captureButtonContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonContent: {
    alignItems: "center",
    gap: 2,
  },
  captureButtonText: {
    fontSize: 8,
    letterSpacing: 1.5,
  },
  identifiedCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  identifiedDismiss: {
    alignSelf: "flex-end",
    marginBottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  identifiedCardInner: {
    backgroundColor: "rgba(10, 10, 10, 0.9)",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  identifiedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  identifiedName: {
    flex: 1,
    color: "#FFF",
  },
  identifiedCategory: {
    marginTop: 6,
    letterSpacing: 2,
    fontSize: 10,
  },
  identifiedStory: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 10,
    lineHeight: 20,
  },
  insightPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  insightText: {
    flex: 1,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  identifyingOverlay: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    zIndex: 15,
  },
  identifyingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  permissionScreen: {
    justifyContent: "center",
  },
  permissionContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.sm,
  },
  permissionCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xl,
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  permissionTitle: {
    color: "#FFF",
    textAlign: "center",
  },
  permissionDesc: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 24,
  },
  permissionButton: {
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
});
