import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CitySelectionScreen from "@/screens/CitySelectionScreen";
import ChatScreen from "@/screens/ChatScreen";
import StreetStoriesScreen from "@/screens/StreetStoriesScreen";
import SafetyPulseScreen from "@/screens/SafetyPulseScreen";
import NeighborhoodPulseScreen from "@/screens/NeighborhoodPulseScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import { useTheme } from "@/hooks/useTheme";

export type RootStackParamList = {
  CitySelection: undefined;
  Chat: { cityId: string };
  StreetStories: { cityId: string };
  SafetyPulse: { cityId: string };
  NeighborhoodPulse: { cityId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundRoot },
        animation: "fade",
      }}
    >
      <Stack.Screen name="CitySelection" component={CitySelectionScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen
        name="StreetStories"
        component={StreetStoriesScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="SafetyPulse"
        component={SafetyPulseScreen}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="NeighborhoodPulse"
        component={NeighborhoodPulseScreen}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: "modal",
          headerShown: true,
          headerTitle: "Settings",
          headerStyle: { backgroundColor: theme.backgroundDefault },
          headerTintColor: theme.text,
        }}
      />
    </Stack.Navigator>
  );
}
