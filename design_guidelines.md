# LocalHere Design Guidelines

## Brand Identity

**Purpose**: LocalHere connects travelers with AI locals who provide authentic, insider knowledge about NYC, Boston, and Nashville.

**Aesthetic Direction**: Editorial/Magazine meets Travel Companion
- Sophisticated yet approachable
- Emphasizes locality and authenticity over tourist kitsch
- Clean typography hierarchy with curated city photography
- Voice-first interface that feels conversational, not robotic

**Memorable Element**: Each city has a distinct voice personality and color accent, making the app feel like you're texting three different local friends.

## Navigation Architecture

**Type**: Stack-Only (simple, conversation-focused)

**Flow**:
1. City Selection (entry point)
2. Chat Interface (main screen)
3. Settings (modal from chat header)

**No authentication needed** - utility-focused, local storage only. Settings screen includes user display name and avatar customization.

## Screen-by-Screen Specifications

### 1. City Selection Screen
**Purpose**: Choose which city's local to talk to

**Layout**:
- Transparent header with "LocalHere" title (center)
- Right header button: Settings icon
- Scrollable content with top inset: headerHeight + Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl

**Components**:
- Hero text: "Talk to a local"
- Three large city cards (vertical stack)
  - City name in display font
  - Subtle tagline ("Your NYC insider", "Your Boston guide", "Your Nashville local")
  - Distinctive illustration or photo for each city
  - Each card has city-specific accent color border/overlay
  - Touch feedback: scale down slightly + opacity 0.9
- Cards have shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.08, shadowRadius: 8

**Empty State**: N/A (always shows 3 cities)

### 2. Chat Interface
**Purpose**: Conversation with the city's AI local

**Layout**:
- Custom header (non-transparent):
  - Left: Back arrow
  - Center: City name + "Local" subtitle
  - Right: Settings icon
- Message list (scrollable, inverted)
- Bottom: Fixed input bar with safe area bottom inset + Spacing.md
- No additional bottom inset needed for message list (handled by input bar)

**Components**:
- Welcome message (auto-generated): "Hey! I'm a [city] local. Ask me anything about neighborhoods, food, nightlife, hidden gems..."
- Message bubbles:
  - User messages: Right-aligned, primary color background, white text
  - AI messages: Left-aligned, light surface color, dark text
  - Rounded corners, comfortable padding
- Voice playback button on AI messages (play/pause icon)
- Input bar:
  - Text input with placeholder: "Ask about [city]..."
  - Send button (arrow icon) - only visible when text present
  - Voice record button (mic icon, floating style with subtle shadow)
  - Shadow specs for voice button: shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2

**Empty State**: Show conversation starter suggestions as tappable chips above input

### 3. Settings Screen (Modal)
**Purpose**: User profile and app preferences

**Layout**:
- Default navigation header with "Settings" title
- Left: Close button
- Scrollable form
- Bottom inset: insets.bottom + Spacing.xl

**Components**:
- Avatar selection (1 preset circular avatar, tappable to customize)
- Display name text input
- App preferences section:
  - Voice response toggle
  - Conversation history toggle (clear history button)
- About section (version, terms, privacy policy links)

## Color Palette

**Base Colors**:
- Background: #FAFAF9 (warm white)
- Surface: #FFFFFF
- Text Primary: #1A1A1A
- Text Secondary: #6B6B6B

**City Accent Colors** (used for cards, highlights):
- NYC: #E63946 (bold red - energy, hustle)
- Boston: #1D3557 (deep navy - classic, historic)
- Nashville: #F4A261 (warm gold - music, warmth)

**Interactive**:
- Primary (user messages): #2C2C2C (charcoal)
- AI message background: #F1F1F0

**Semantic**:
- Error: #DC2626
- Success: #16A34A

## Typography

**Font**: Merriweather (serif) for display/city names paired with Inter (sans-serif) for body/UI

**Type Scale**:
- Display: 32pt, Bold (Merriweather) - City names
- Title: 24pt, Semibold (Inter) - Screen titles
- Headline: 18pt, Semibold (Inter) - Section headers
- Body: 16pt, Regular (Inter) - Messages, body text
- Caption: 14pt, Regular (Inter) - Timestamps, labels
- Small: 12pt, Regular (Inter) - Metadata

## Assets to Generate

1. **icon.png** - App icon
   - Stylized location pin with chat bubble
   - WHERE USED: Device home screen

2. **splash-icon.png** - Splash screen icon
   - Same as app icon, simplified
   - WHERE USED: App launch screen

3. **nyc-city.png** - NYC illustration
   - Minimalist cityscape (skyline silhouette or iconic landmark)
   - Color: Grayscale with NYC red accent
   - WHERE USED: NYC card on City Selection screen

4. **boston-city.png** - Boston illustration
   - Historic architecture reference (brownstones or harbor)
   - Color: Grayscale with Boston navy accent
   - WHERE USED: Boston card on City Selection screen

5. **nashville-city.png** - Nashville illustration
   - Music-inspired (guitar or honky-tonk reference)
   - Color: Grayscale with Nashville gold accent
   - WHERE USED: Nashville card on City Selection screen

6. **empty-conversation.png** - Empty chat state
   - Speech bubbles with ellipsis, friendly and minimal
   - Color: Neutral gray tones
   - WHERE USED: Chat screen before first message sent

7. **avatar-default.png** - Default user avatar
   - Simple, friendly circular avatar
   - Gender-neutral design
   - WHERE USED: Settings screen, user profile

**Visual Style for Assets**: Clean, editorial illustrations with subtle textures. Avoid flat material design - add slight grain or paper texture for warmth. Keep illustrations sophisticated, not cartoonish.