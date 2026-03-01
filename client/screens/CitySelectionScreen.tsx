import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
  FadeIn,
  FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CityThemes, Shadows } from "@/constants/theme";
import { CITIES, CityConfig } from "@/constants/cities";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CityCardProps {
  city: CityConfig;
  index: number;
  onPress: () => void;
}

function CityCard({ city, index, onPress }: CityCardProps) {
  const scale = useSharedValue(1);
  const cityTheme = CityThemes[city.id as keyof typeof CityThemes];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(300 + index * 100).duration(600).springify()}
    >
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.cityCard, animatedStyle]}
        testID={`city-card-${city.id}`}
      >
        <LinearGradient
          colors={[cityTheme.accentLight, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardContent}>
            <View>
              <ThemedText style={styles.cityName} type="h1">
                {city.name}
              </ThemedText>
              <ThemedText
                style={[styles.tagline, { color: cityTheme.accent }]}
                type="small"
              >
                {city.tagline}
              </ThemedText>
            </View>
            <View
              style={[
                styles.micIcon,
                { backgroundColor: cityTheme.accent },
              ]}
            >
              <Feather name="mic" size={20} color="#000" />
            </View>
          </View>
        </LinearGradient>
        <View
          style={[
            styles.accentLine,
            { backgroundColor: cityTheme.accent },
          ]}
        />
      </AnimatedPressable>
    </Animated.View>
  );
}

function StreetStoriesBanner({ onPress, theme }: { onPress: (city: CityConfig) => void; theme: any }) {
  return (
    <Animated.View entering={FadeInDown.delay(700).duration(600).springify()}>
      <View style={styles.streetStoriesSection}>
        <ThemedText style={styles.streetStoriesTitle} type="h3">
          Street Stories
        </ThemedText>
        <ThemedText style={[styles.streetStoriesDesc, { color: theme.textSecondary }]} type="small">
          Point your camera at any building. Hear its story from a local.
        </ThemedText>
        <View style={styles.streetStoriesCities}>
          {CITIES.map((city) => {
            const ct = CityThemes[city.id as keyof typeof CityThemes];
            return (
              <Pressable
                key={city.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPress(city);
                }}
                style={[
                  styles.streetStoryChip,
                  { borderColor: `${ct.accent}40` },
                ]}
                testID={`street-stories-${city.id}`}
              >
                <View style={[styles.streetStoryDot, { backgroundColor: ct.accent }]} />
                <ThemedText style={[styles.streetStoryChipText, { color: ct.accent }]} type="caption">
                  {city.name}
                </ThemedText>
                <Feather name="compass" size={12} color={ct.accent} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

interface SmartCityToolProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  onPress: (city: CityConfig) => void;
  theme: any;
  delay: number;
}

function SmartCityTool({ icon, title, description, onPress, theme, delay }: SmartCityToolProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(600).springify()}>
      <View style={styles.toolCard}>
        <View style={styles.toolHeader}>
          <View style={styles.toolIconContainer}>
            <Feather name={icon} size={20} color="#FFF" />
          </View>
          <View style={styles.toolTextContainer}>
            <ThemedText style={styles.toolTitle} type="h4">{title}</ThemedText>
            <ThemedText style={[styles.toolDesc, { color: theme.textSecondary }]} type="small">
              {description}
            </ThemedText>
          </View>
        </View>
        <View style={styles.toolCities}>
          {CITIES.map((city) => {
            const ct = CityThemes[city.id as keyof typeof CityThemes];
            return (
              <Pressable
                key={city.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPress(city);
                }}
                style={[styles.streetStoryChip, { borderColor: `${ct.accent}40` }]}
                testID={`${title.toLowerCase().replace(/\s+/g, "-")}-${city.id}`}
              >
                <View style={[styles.streetStoryDot, { backgroundColor: ct.accent }]} />
                <ThemedText style={[styles.streetStoryChipText, { color: ct.accent }]} type="caption">
                  {city.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

export default function CitySelectionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const handleCityPress = (city: CityConfig) => {
    navigation.navigate("Chat", { cityId: city.id });
  };

  const handleStreetStories = (city: CityConfig) => {
    navigation.navigate("StreetStories", { cityId: city.id });
  };

  const handleSafetyPulse = (city: CityConfig) => {
    navigation.navigate("SafetyPulse", { cityId: city.id });
  };

  const handleNeighborhoodPulse = (city: CityConfig) => {
    navigation.navigate("NeighborhoodPulse", { cityId: city.id });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing["5xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeIn.delay(100).duration(800)}
          style={styles.header}
        >
          <ThemedText style={styles.appName} type="caption">
            LOCALHERE
          </ThemedText>
          <ThemedText style={styles.heroText} type="display">
            Talk to{"\n"}a local
          </ThemedText>
          <ThemedText
            style={[styles.heroSubtext, { color: theme.textSecondary }]}
            type="body"
          >
            Voice conversations with AI locals who know every secret of the city
          </ThemedText>
        </Animated.View>

        <View style={styles.cardsContainer}>
          {CITIES.map((city, index) => (
            <CityCard
              key={city.id}
              city={city}
              index={index}
              onPress={() => handleCityPress(city)}
            />
          ))}
        </View>

        <StreetStoriesBanner onPress={handleStreetStories} theme={theme} />

        <Animated.View entering={FadeInDown.delay(800).duration(600).springify()}>
          <View style={styles.smartCitySection}>
            <ThemedText style={styles.smartCityTitle} type="h3">
              Locals' Lowdown
            </ThemedText>
            <ThemedText style={[styles.smartCitySubtitle, { color: theme.textSecondary }]} type="small">
              Insider intelligence on the vibe and your safety
            </ThemedText>
          </View>
        </Animated.View>

        <View style={styles.toolsContainer}>
          <SmartCityTool
            icon="shield"
            title="Safety Pulse"
            description="Hyper-local voice safety briefing. Emergency services, well-lit routes, and tips only locals know."
            onPress={handleSafetyPulse}
            theme={theme}
            delay={900}
          />
          <SmartCityTool
            icon="activity"
            title="Neighborhood Pulse"
            description="Real-time neighborhood vibe. What's open, crowd levels, transit tips, and local events near you."
            onPress={handleNeighborhoodPulse}
            theme={theme}
            delay={1000}
          />
        </View>
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
  header: {
    marginBottom: Spacing["5xl"],
  },
  appName: {
    marginBottom: Spacing.lg,
    opacity: 0.5,
  },
  heroText: {
    marginBottom: Spacing.lg,
  },
  heroSubtext: {
    maxWidth: 280,
    lineHeight: 26,
  },
  cardsContainer: {
    gap: Spacing.lg,
  },
  cityCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardGradient: {
    padding: Spacing.xl,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cityName: {
    marginBottom: Spacing.xs,
  },
  tagline: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  micIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  accentLine: {
    height: 3,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  streetStoriesSection: {
    marginTop: Spacing["4xl"],
    paddingTop: Spacing["3xl"],
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  streetStoriesTitle: {
    color: "#FFF",
    marginBottom: Spacing.sm,
  },
  streetStoriesDesc: {
    lineHeight: 22,
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  streetStoriesCities: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  streetStoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  streetStoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  streetStoryChipText: {
    letterSpacing: 1,
    fontSize: 11,
  },
  smartCitySection: {
    marginTop: Spacing["4xl"],
    paddingTop: Spacing["3xl"],
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  smartCityTitle: {
    color: "#FFF",
    marginBottom: Spacing.sm,
  },
  smartCitySubtitle: {
    lineHeight: 22,
    maxWidth: 320,
  },
  toolsContainer: {
    gap: Spacing.lg,
    marginTop: Spacing.xl,
  },
  toolCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: Spacing.lg,
  },
  toolHeader: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  toolIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  toolTextContainer: {
    flex: 1,
  },
  toolTitle: {
    color: "#FFF",
    marginBottom: 4,
  },
  toolDesc: {
    lineHeight: 20,
  },
  toolCities: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
});
