# LocalHere: The Pulse of the City

## Inspiration
I am an avid tourist having visited pretty much all the major cities in the US. But often times, I wind up confused with safety and the best local experiences and not just tourist traps. I wanted to build something that felt like having a local best friend in your pocket—someone who tells you where the real vibe is, which subway entrance is better lit at 11 PM, and the story behind that weird mural on the corner that isn't in any guidebook.

## What it does
LocalHere is a voice-first AI guide for NYC, Boston, and Nashville. It provides:
- **Voice Conversations**: Talk naturally to AI locals with authentic regional accents.
- **Street Stories**: Point your camera at landmarks to hear their "Only Locals" backstories.
- **Locals' Lowdown**: Real-time safety pulses and neighborhood vibe checks based on your exact GPS and time of day.
- **Accessibility Scout**: Multimodal AI analysis of building entrances and transit for accessibility features.

## How we built it
- **Frontend**: React Native with Expo SDK 54, utilizing a "Liquid Glass" UI aesthetic.
- **AI Brain**: OpenAI GPT-4o for reasoning and Whisper for high-accuracy voice transcription.
- **Vision**: Google Gemini 2.5 Flash for multimodal identification of landmarks and accessibility features.
- **Voice**: ElevenLabs for soulful, city-specific text-to-speech synthesis.
- **Backend**: Express.js with TypeScript handling the orchestration of AI services and audio processing.

## Challenges we ran into
The biggest challenge was low-latency audio processing on mobile. Converting high-quality voice recordings into AI-ready formats while maintaining a conversational "pulse" required fine-tuning buffer management and server-side synthesis. We also had to balance the "Only Locals" personality—ensuring the AI felt opinionated and authentic without being unhelpful.

## Accomplishments that we're proud of
We are incredibly proud of the seamless integration of vision and voice. Seeing the app identify a specific NYC storefront and immediately narrate its history in a gravelly Brooklyn accent felt like magic. We're also proud of the **Accessibility Scout** feature, which turns multimodal AI into a practical tool for inclusive travel.

## What we learned
We learned that the best AI interfaces are the ones that disappear. By removing text inputs and focusing entirely on voice and vision, the technology steps back and the *experience* of the city steps forward. 

$$ \text{Authenticity} = \frac{\text{Local Knowledge} + \text{Real-time Context}}{\text{Tourist Traps}} $$

## What's next for LocalHere
We plan to expand to more cities like Chicago and New Orleans, integrate real-time transit data APIs for even more precise "Pulse" updates, and add a "Local Meetup" feature where the AI can suggest community events happening in the next hour.
