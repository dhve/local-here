# Objective
Add three Smart Cities features to LocalHere: Safety Pulse, Accessibility Scout, and Neighborhood Pulse. These target hackathon tracks: Best Use of Gemini API, Best Use of ElevenLabs, Best Use of AI, Best General Theme.

# Tasks

### T001: Backend - Add Safety Pulse and Neighborhood Pulse endpoints
- **Blocked By**: []
- **Details**:
  - Add `POST /api/safety-pulse` endpoint using Gemini to generate safety briefings from GPS + city + time
  - Add `POST /api/neighborhood-pulse` endpoint using Gemini to generate neighborhood status
  - Both endpoints also call ElevenLabs to generate voice narration, store in audioStorage
  - Add `accessibilityMode` flag support to existing `/api/identify-location` endpoint
  - Files: server/routes.ts
  - Acceptance: All three endpoints respond correctly

### T002: Frontend - SafetyPulseScreen
- **Blocked By**: [T001]
- **Details**:
  - Create SafetyPulseScreen.tsx with GPS permission, pulsing shield animation, loading state
  - Fetches /api/safety-pulse with GPS + cityId + time
  - Displays safety info cards + plays ElevenLabs narration
  - Dark theme, city-specific accent colors
  - Files: client/screens/SafetyPulseScreen.tsx
  - Acceptance: Screen loads, requests GPS, shows safety briefing with audio

### T003: Frontend - NeighborhoodPulseScreen
- **Blocked By**: [T001]
- **Details**:
  - Create NeighborhoodPulseScreen.tsx with GPS permission, pulsing animation, loading state
  - Fetches /api/neighborhood-pulse with GPS + cityId + time
  - Displays neighborhood info + plays ElevenLabs narration
  - Dark theme, city-specific accent colors
  - Files: client/screens/NeighborhoodPulseScreen.tsx
  - Acceptance: Screen loads, requests GPS, shows neighborhood briefing with audio

### T004: Frontend - Accessibility Scout toggle in Street Stories
- **Blocked By**: [T001]
- **Details**:
  - Add accessibility mode toggle button to StreetStoriesScreen
  - When enabled, sends accessibilityMode: true to /api/identify-location
  - Visual badge showing "ACCESSIBILITY" mode is active
  - Files: client/screens/StreetStoriesScreen.tsx
  - Acceptance: Toggle works, identify results show accessibility info

### T005: Navigation and CitySelectionScreen updates
- **Blocked By**: [T002, T003]
- **Details**:
  - Add SafetyPulse and NeighborhoodPulse routes to RootStackNavigator
  - Add "Smart City Tools" section to CitySelectionScreen with Safety Pulse and Neighborhood Pulse entries
  - Files: client/navigation/RootStackNavigator.tsx, client/screens/CitySelectionScreen.tsx
  - Acceptance: New features accessible from home screen, navigation works

### T006: Update replit.md
- **Blocked By**: [T005]
- **Details**:
  - Update replit.md with new features, endpoints, and screens
  - Files: replit.md
