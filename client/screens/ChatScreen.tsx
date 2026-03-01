import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CityThemes } from "@/constants/theme";
import { getCityById, CityConfig } from "@/constants/cities";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
}

interface QuickAskOption {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  question: string;
}

const QUICK_ASKS: QuickAskOption[] = [
  { id: "eat", label: "Best food nearby", icon: "coffee", question: "What's the best place to eat near me right now? I want something authentic, not touristy." },
  { id: "hidden", label: "Hidden gems here", icon: "star", question: "What are the hidden gems near where I am right now? Things only locals would know about." },
  { id: "nightlife", label: "Nightlife tonight", icon: "music", question: "What's the best nightlife near me tonight? Where are locals actually going?" },
  { id: "culture", label: "Culture & history", icon: "book-open", question: "What's the most interesting cultural or historical thing near where I'm standing right now?" },
  { id: "vibe", label: "What's the vibe?", icon: "wind", question: "What's the vibe like in this neighborhood right now? What's open, who's around, what's the energy like?" },
  { id: "walk", label: "Best walk from here", icon: "map", question: "What's the best walking route from where I am right now? I want to see the real neighborhood." },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PulsingRing({ color, delay = 0 }: { color: string; delay?: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: delay }),
        withTiming(2.5, { duration: 1500 })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: delay }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.pulsingRing,
        { borderColor: color },
        style,
      ]}
    />
  );
}

function VoiceVisualizer({ isActive, color }: { isActive: boolean; color: string }) {
  const bars = [0, 1, 2, 3, 4];
  
  return (
    <View style={styles.visualizer}>
      {bars.map((i) => (
        <VisualizerBar key={i} index={i} isActive={isActive} color={color} />
      ))}
    </View>
  );
}

function VisualizerBar({ index, isActive, color }: { index: number; isActive: boolean; color: string }) {
  const height = useSharedValue(20);

  useEffect(() => {
    if (isActive) {
      height.value = withRepeat(
        withSequence(
          withTiming(20 + Math.random() * 40, { duration: 150 + index * 50 }),
          withTiming(10 + Math.random() * 20, { duration: 150 + index * 50 })
        ),
        -1,
        true
      );
    } else {
      height.value = withSpring(20);
    }
  }, [isActive]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.visualizerBar,
        { backgroundColor: color },
        style,
      ]}
    />
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const city = getCityById(route.params.cityId);
  const cityTheme = city ? CityThemes[city.id as keyof typeof CityThemes] : CityThemes.nyc;

  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isQuickAsking, setIsQuickAsking] = useState(false);
  const [activeQuickAsk, setActiveQuickAsk] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const audioPlayer = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(audioPlayer);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const micScale = useSharedValue(1);
  const micGlow = useSharedValue(0);
  const baseUrl = getApiUrl();

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
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

  useEffect(() => {
    if (isRecording) {
      micGlow.value = withRepeat(
        withTiming(1, { duration: 1000 }),
        -1,
        true
      );
    } else {
      micGlow.value = withSpring(0);
    }
  }, [isRecording]);

  const enableLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationEnabled(true);
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isMountedRef.current) {
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    enableLocation();
  }, []);

  const micButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(micGlow.value, [0, 1], [0, 0.8], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(micGlow.value, [0, 1], [1, 1.3], Extrapolation.CLAMP) }],
  }));

  const handleQuickAsk = useCallback(async (quickAsk: QuickAskOption) => {
    if (!city || isProcessing || isQuickAsking) return;
    setIsQuickAsking(true);
    setActiveQuickAsk(quickAsk.id);
    setErrorMessage("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const userEntry: ConversationEntry = {
      id: Date.now().toString(),
      role: "user",
      content: quickAsk.label,
    };
    setConversation((prev) => [...prev, userEntry]);

    try {
      const response = await fetch(`${baseUrl}/api/quick-ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: quickAsk.question,
          cityId: city.id,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          history: conversation.map((c) => ({ role: c.role, content: c.content })),
        }),
      });

      const data = await response.json();
      if (!isMountedRef.current) return;

      if (!response.ok || data.error) {
        setErrorMessage(data.error || "Something went wrong");
        setIsQuickAsking(false);
        setActiveQuickAsk(null);
        return;
      }

      const aiEntry: ConversationEntry = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
      };
      setConversation((prev) => [...prev, aiEntry]);

      if (data.audioUrl) {
        const fullAudioUrl = `${baseUrl}${data.audioUrl}`;
        setAudioUri(fullAudioUrl);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrorMessage("Connection failed. Please try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsQuickAsking(false);
        setActiveQuickAsk(null);
      }
    }
  }, [city, conversation, userLocation, isProcessing, isQuickAsking, baseUrl]);

  const handleMicPress = useCallback(async () => {
    if (!city || !permissionGranted || isProcessing || isQuickAsking) return;

    if (isRecording) {
      await audioRecorder.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setLiveTranscript("Processing...");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const recordingUri = audioRecorder.uri;
      if (!recordingUri) {
        setIsProcessing(false);
        return;
      }

      try {
        const response = await fetch(recordingUri);
        const blob = await response.blob();

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];

          try {
            const apiResponse = await fetch(`${baseUrl}/api/voice-chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audio: base64Audio,
                cityId: city.id,
                latitude: userLocation?.latitude,
                longitude: userLocation?.longitude,
                history: conversation.map((c) => ({
                  role: c.role,
                  content: c.content,
                })),
              }),
            });

            const data = await apiResponse.json();

            if (!apiResponse.ok || data.error) {
              setErrorMessage(data.error || "Something went wrong");
              setIsProcessing(false);
              return;
            }

            const userEntry: ConversationEntry = {
              id: Date.now().toString(),
              role: "user",
              content: data.userTranscript || "...",
            };

            const aiEntry: ConversationEntry = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.response,
              audioUrl: data.audioUrl,
            };

            setConversation((prev) => [...prev, userEntry, aiEntry]);
            setUserTranscript(data.userTranscript || "");
            setIsProcessing(false);

            if (data.audioUrl) {
              const fullAudioUrl = `${baseUrl}${data.audioUrl}`;
              setAudioUri(fullAudioUrl);
            } else {
              setErrorMessage("Voice response unavailable");
            }
          } catch (fetchError) {
            console.error("API error:", fetchError);
            setIsProcessing(false);
            setErrorMessage("Connection failed. Please try again.");
          }
        };
      } catch (error) {
        console.error("Error processing voice:", error);
        setIsProcessing(false);
        setErrorMessage("Could not process recording. Please try again.");
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      micScale.value = withSequence(
        withSpring(0.9, { damping: 15 }),
        withSpring(1, { damping: 15 })
      );
      try {
        await audioRecorder.prepareToRecordAsync();
        await audioRecorder.record();
        setIsRecording(true);
        setUserTranscript("");
        setErrorMessage("");
        setLiveTranscript("Listening...");
      } catch (error) {
        console.error("Error starting recording:", error);
        setErrorMessage("Microphone not available. Use Expo Go on your phone.");
      }
    }
  }, [city, isRecording, audioRecorder, conversation, permissionGranted, isProcessing, isQuickAsking, userLocation, baseUrl]);

  const handleMicPressIn = () => {
    micScale.value = withSpring(0.95, { damping: 15 });
  };

  const handleMicPressOut = () => {
    micScale.value = withSpring(1, { damping: 15 });
  };

  if (!city) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>City not found</ThemedText>
      </ThemedView>
    );
  }

  const hasConversation = conversation.length > 0;
  const isIdle = !isRecording && !isProcessing && !isPlaying && !isQuickAsking;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={20}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>

          <Animated.View
            entering={FadeIn.duration(600)}
            style={styles.cityHeader}
          >
            <View style={[styles.statusDot, { backgroundColor: cityTheme.accent }]} />
            <ThemedText type="caption" style={styles.cityLabel}>
              {city.name.toUpperCase()} LOCAL
            </ThemedText>
          </Animated.View>

          {locationEnabled ? (
            <View style={[styles.locationBadge, { backgroundColor: `${cityTheme.accent}20` }]}>
              <Feather name="navigation" size={12} color={cityTheme.accent} />
            </View>
          ) : (
            <Pressable onPress={enableLocation} style={styles.locationButton} hitSlop={20} testID="button-enable-location">
              <Feather name="navigation" size={16} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        {!hasConversation && isIdle ? (
          <View style={styles.welcomeContainer}>
            <Animated.View entering={FadeIn.duration(800).delay(200)}>
              <ThemedText style={[styles.welcomeText, { color: theme.textMuted }]} type="h2">
                Ask me{"\n"}anything
              </ThemedText>
              {locationEnabled ? (
                <Animated.View entering={FadeIn.duration(600).delay(500)}>
                  <ThemedText style={[styles.welcomeSubtext, { color: `${cityTheme.accent}90` }]} type="small">
                    I know exactly where you are
                  </ThemedText>
                </Animated.View>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(600).delay(400)} style={styles.quickAsksContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickAsksScroll}
              >
                {QUICK_ASKS.map((qa, index) => (
                  <Animated.View
                    key={qa.id}
                    entering={FadeInUp.duration(400).delay(500 + index * 80)}
                  >
                    <Pressable
                      onPress={() => handleQuickAsk(qa)}
                      disabled={isQuickAsking}
                      style={[
                        styles.quickAskChip,
                        {
                          borderColor: `${cityTheme.accent}30`,
                          opacity: isQuickAsking ? 0.5 : 1,
                        },
                        activeQuickAsk === qa.id ? { backgroundColor: `${cityTheme.accent}20`, borderColor: cityTheme.accent } : null,
                      ]}
                      testID={`quick-ask-${qa.id}`}
                    >
                      {activeQuickAsk === qa.id ? (
                        <ActivityIndicator size="small" color={cityTheme.accent} />
                      ) : (
                        <Feather name={qa.icon} size={14} color={cityTheme.accent} />
                      )}
                      <ThemedText style={[styles.quickAskText, { color: theme.text }]} type="small">
                        {qa.label}
                      </ThemedText>
                    </Pressable>
                  </Animated.View>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.transcriptContainer}>
            {isRecording ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText
                  style={[styles.listeningText, { color: cityTheme.accent }]}
                  type="bodyMedium"
                >
                  Listening...
                </ThemedText>
              </Animated.View>
            ) : isProcessing ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText
                  style={[styles.listeningText, { color: theme.textSecondary }]}
                  type="bodyMedium"
                >
                  Thinking...
                </ThemedText>
              </Animated.View>
            ) : isQuickAsking ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText
                  style={[styles.listeningText, { color: cityTheme.accent }]}
                  type="bodyMedium"
                >
                  Asking your local...
                </ThemedText>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(600).delay(300)}>
                <ThemedText
                  style={[styles.promptText, { color: theme.textMuted }]}
                  type="h2"
                >
                  Tap to talk
                </ThemedText>

                {conversation.length > 0 ? (
                  <Animated.View entering={FadeInUp.duration(400).delay(400)} style={styles.inlineQuickAsks}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineQuickAsksScroll}>
                      {QUICK_ASKS.slice(0, 4).map((qa) => (
                        <Pressable
                          key={qa.id}
                          onPress={() => handleQuickAsk(qa)}
                          disabled={isQuickAsking}
                          style={[styles.inlineChip, { borderColor: `${cityTheme.accent}25` }]}
                          testID={`inline-ask-${qa.id}`}
                        >
                          <Feather name={qa.icon} size={12} color={cityTheme.accent} />
                          <ThemedText style={[styles.inlineChipText, { color: `${cityTheme.accent}CC` }]} type="caption">
                            {qa.label}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </Animated.View>
                ) : null}
              </Animated.View>
            )}
          </View>
        )}

        <View style={[styles.micContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          {isPlaying ? (
            <VoiceVisualizer isActive={true} color={cityTheme.accent} />
          ) : null}

          <View style={styles.micButtonWrapper}>
            {isRecording ? (
              <>
                <PulsingRing color={cityTheme.accent} delay={0} />
                <PulsingRing color={cityTheme.accent} delay={500} />
                <PulsingRing color={cityTheme.accent} delay={1000} />
              </>
            ) : null}

            <Animated.View style={[styles.micGlow, { backgroundColor: cityTheme.accent }, glowStyle]} />

            <AnimatedPressable
              onPress={handleMicPress}
              onPressIn={handleMicPressIn}
              onPressOut={handleMicPressOut}
              disabled={!permissionGranted || isProcessing || isQuickAsking}
              style={[
                styles.micButton,
                {
                  backgroundColor: isRecording ? cityTheme.accent : "rgba(255,255,255,0.1)",
                  borderColor: isRecording ? cityTheme.accent : "rgba(255,255,255,0.2)",
                  opacity: permissionGranted && !isQuickAsking ? 1 : 0.5,
                },
                micButtonStyle,
              ]}
              testID="mic-button"
            >
              <Feather
                name={isRecording ? "square" : "mic"}
                size={32}
                color={isRecording ? "#000" : "#FFF"}
              />
            </AnimatedPressable>
          </View>

          {!permissionGranted ? (
            <ThemedText
              style={[styles.permissionText, { color: theme.textMuted }]}
              type="small"
            >
              Microphone access required
            </ThemedText>
          ) : null}

          {userTranscript && !isRecording && !isQuickAsking ? (
            <Animated.View
              entering={FadeInUp.duration(300)}
              style={styles.userTranscriptContainer}
            >
              <View style={[styles.userTranscriptBubble, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                <ThemedText style={[styles.userTranscriptLabel, { color: theme.textMuted }]} type="small">
                  You said:
                </ThemedText>
                <ThemedText style={[styles.userTranscriptText, { color: theme.text }]} type="body">
                  "{userTranscript}"
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}

          {errorMessage ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
              <ThemedText style={[styles.errorText, { color: "#FF6B6B" }]} type="small">
                {errorMessage}
              </ThemedText>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.sm,
  },
  cityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cityLabel: {
    opacity: 0.7,
  },
  locationBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  locationButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: Spacing["5xl"],
  },
  welcomeText: {
    textAlign: "center",
    opacity: 0.6,
    marginBottom: Spacing.sm,
  },
  welcomeSubtext: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
    letterSpacing: 1,
  },
  quickAsksContainer: {
    marginTop: Spacing.xl,
  },
  quickAsksScroll: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  quickAskChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  quickAskText: {
    lineHeight: 18,
  },
  inlineQuickAsks: {
    marginTop: Spacing.xl,
    alignItems: "center",
  },
  inlineQuickAsksScroll: {
    gap: Spacing.sm,
  },
  inlineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  inlineChipText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  transcriptContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  listeningText: {
    textAlign: "center",
  },
  promptText: {
    textAlign: "center",
    opacity: 0.6,
  },
  micContainer: {
    alignItems: "center",
    gap: Spacing["3xl"],
  },
  visualizer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 60,
  },
  visualizerBar: {
    width: 4,
    borderRadius: 2,
  },
  micButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulsingRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  micGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  permissionText: {
    textAlign: "center",
  },
  userTranscriptContainer: {
    width: "100%",
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  userTranscriptBubble: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  userTranscriptLabel: {
    marginBottom: Spacing.xs,
    opacity: 0.7,
  },
  userTranscriptText: {
    lineHeight: 22,
  },
  errorContainer: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    textAlign: "center",
  },
});
