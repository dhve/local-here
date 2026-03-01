export const Colors = {
  light: {
    text: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.7)",
    textMuted: "rgba(255,255,255,0.5)",
    buttonText: "#FFFFFF",
    tabIconDefault: "rgba(255,255,255,0.5)",
    tabIconSelected: "#FFFFFF",
    link: "#FFFFFF",
    backgroundRoot: "#0A0A0A",
    backgroundDefault: "#111111",
    backgroundSecondary: "#1A1A1A",
    backgroundTertiary: "#252525",
    userMessage: "rgba(255,255,255,0.1)",
    aiMessage: "rgba(255,255,255,0.05)",
    error: "#FF4757",
    success: "#2ED573",
    overlay: "rgba(0,0,0,0.6)",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.7)",
    textMuted: "rgba(255,255,255,0.5)",
    buttonText: "#FFFFFF",
    tabIconDefault: "rgba(255,255,255,0.5)",
    tabIconSelected: "#FFFFFF",
    link: "#FFFFFF",
    backgroundRoot: "#0A0A0A",
    backgroundDefault: "#111111",
    backgroundSecondary: "#1A1A1A",
    backgroundTertiary: "#252525",
    userMessage: "rgba(255,255,255,0.1)",
    aiMessage: "rgba(255,255,255,0.05)",
    error: "#FF4757",
    success: "#2ED573",
    overlay: "rgba(0,0,0,0.6)",
  },
};

export const CityThemes = {
  nyc: {
    accent: "#FF6B6B",
    accentLight: "rgba(255, 107, 107, 0.15)",
    gradient: ["#FF6B6B", "#EE5A5A"] as const,
  },
  boston: {
    accent: "#4ECDC4",
    accentLight: "rgba(78, 205, 196, 0.15)",
    gradient: ["#4ECDC4", "#3DBDB4"] as const,
  },
  nashville: {
    accent: "#FFE66D",
    accentLight: "rgba(255, 230, 109, 0.15)",
    gradient: ["#FFE66D", "#F5D85C"] as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
  "7xl": 80,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: "DMSerifDisplay_400Regular",
    letterSpacing: -1,
  },
  h1: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: "DMSerifDisplay_400Regular",
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  h3: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "SpaceGrotesk_500Medium",
    letterSpacing: 1,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "SpaceGrotesk_500Medium",
  },
};

export const Shadows = {
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  }),
};
