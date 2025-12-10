---
title: Sound effects
subtitle: Learn how to create high-quality sound effects from text with ElevenLabs.
---

## Overview

<script src="https://elevenlabs.io/player/audioNativeHelper.js" type="text/javascript"></script>

ElevenLabs [sound effects](/docs/api-reference/text-to-sound-effects/convert) API turns text descriptions into high-quality audio effects with precise control over timing, style and complexity. The model understands both natural language and audio terminology, enabling you to:

- Generate cinematic sound design for films & trailers
- Create custom sound effects for games & interactive media
- Produce Foley and ambient sounds for video content

Listen to an example:

<elevenlabs-audio-player
audio-title="Cinematic braam"
audio-src="https://storage.googleapis.com/eleven-public-cdn/documentation_assets/audio/sfx-cinematic-braam.mp3"
/>

## Usage

Sound effects are generated using text descriptions & two optional parameters:

- **Duration**: Set a specific length for the generated audio (in seconds)

  - Default: Automatically determined based on the prompt
  - Range: 0.1 to 30 seconds
  - Cost: 40 credits per second when duration is specified

- **Looping**: Enable seamless looping for sound effects longer than 30 seconds

  - Creates sound effects that can be played on repeat without perceptible start/end points
  - Perfect for atmospheric sounds, ambient textures, and background elements
  - Example: Generate 30s of 'soft rain' then loop it endlessly for atmosphere in audiobooks, films, games

- **Prompt influence**: Control how strictly the model follows the prompt

  - High: More literal interpretation of the prompt
  - Low: More creative interpretation with added variations

<CardGroup cols={2}>
  <Card
    title="Products"
    icon="duotone book-user"
    href="/docs/creative-platform/playground/sound-effects"
  >
    Step-by-step guide for using sound effects in ElevenLabs.
  </Card>
  <Card
    title="Developers"
    icon="duotone code"
    href="/docs/developers/guides/cookbooks/sound-effects"
  >
    Learn how to integrate sound effects into your application.
  </Card>
</CardGroup>

### Prompting guide

#### Simple effects

For basic sound effects, use clear, concise descriptions:

- "Glass shattering on concrete"
- "Heavy wooden door creaking open"
- "Thunder rumbling in the distance"

<elevenlabs-audio-player
    audio-title="Wood chopping"
    audio-src="https://storage.googleapis.com/eleven-public-cdn/documentation_assets/audio/sfx-wood-chopping.mp3"
/>

#### Complex sequences

For multi-part sound effects, describe the sequence of events:

- "Footsteps on gravel, then a metallic door opens"
- "Wind whistling through trees, followed by leaves rustling"
- "Sword being drawn, then clashing with another blade"

<elevenlabs-audio-player
    audio-title="Walking and then falling"
    audio-src="https://storage.googleapis.com/eleven-public-cdn/documentation_assets/audio/sfx-walking-falling.mp3"
/>

#### Musical elements

The API also supports generation of musical components:

- "90s hip-hop drum loop, 90 BPM"
- "Vintage brass stabs in F minor"
- "Atmospheric synth pad with subtle modulation"

<elevenlabs-audio-player
    audio-title="90s drum loop"
    audio-src="https://storage.googleapis.com/eleven-public-cdn/documentation_assets/audio/sfx-90s-drum-loop.mp3"
/>

#### Audio Terminology

Common terms that can enhance your prompts:

- **Impact**: Collision or contact sounds between objects, from subtle taps to dramatic crashes
- **Whoosh**: Movement through air effects, ranging from fast and ghostly to slow-spinning or rhythmic
- **Ambience**: Background environmental sounds that establish atmosphere and space
- **One-shot**: Single, non-repeating sound
- **Loop**: Repeating audio segment
- **Stem**: Isolated audio component
- **Braam**: Big, brassy cinematic hit that signals epic or dramatic moments, common in trailers
- **Glitch**: Sounds of malfunction, jittering, or erratic movement, useful for transitions and sci-fi
- **Drone**: Continuous, textured sound that creates atmosphere and suspense

## FAQ

<AccordionGroup>
  <Accordion title="What's the maximum duration for generated effects?">
    The maximum duration is 30 seconds per generation. For longer sequences, you can either generate
    multiple effects and combine them, or use the looping feature to create seamless repeating sound
    effects.
  </Accordion>
  <Accordion title="Can I generate music with this API?">
    Yes, you can generate musical elements like drum loops, bass lines, and melodic samples.
    However, for full music production, consider combining multiple generated elements.
  </Accordion>
  <Accordion title="How do I ensure consistent quality?">
    Use detailed prompts, appropriate duration settings, and high prompt influence for more
    predictable results. For complex sounds, generate components separately and combine them.
  </Accordion>
  <Accordion title="What audio formats are supported?">
    Generated audio is provided in MP3 format with professional-grade quality. For WAV downloads of
    non-looping sound effects, audio is delivered at 48kHz sample rate - the industry standard for
    film, TV, video, and game audio, ensuring no resampling is needed for professional workflows.
  </Accordion>
  <Accordion title="How do looping sound effects work?">
    Looping sound effects are designed to play seamlessly on repeat without noticeable start or end
    points. This is perfect for creating continuous atmospheric sounds, ambient textures, or
    background elements that need to play indefinitely. For example, you can generate 30 seconds of
    rain sounds and loop them endlessly for background atmosphere in audiobooks, films, or games.
  </Accordion>
</AccordionGroup>
