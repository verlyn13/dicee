---
title: Introduction
subtitle: >-
  Explore the ElevenLabs API reference with comprehensive guides, code examples,
  and endpoint documentation
hide-feedback: true
---

## Installation

You can interact with the API through HTTP or Websocket requests from any language, via our official Python bindings or our official Node.js libraries.

To install the official Python bindings, run the following command:

```bash
pip install elevenlabs
```

To install the official Node.js library, run the following command in your Node.js project directory:

```bash
npm install @elevenlabs/elevenlabs-js
```

## Tracking generation costs

Access response headers to retrieve generation metadata including character costs.

<CodeBlocks>
  <CodeBlock title="Python">
    ```python
    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key="your_api_key")

    # Get raw response with headers
    response = client.text_to_speech.with_raw_response.convert(
        text="Hello, world!",
        voice_id="voice_id"
    )

    # Access character cost from headers
    char_cost = response.headers.get("x-character-count")
    request_id = response.headers.get("request-id")
    audio_data = response.data
    ```

  </CodeBlock>

  <CodeBlock title="JavaScript">
    ```typescript
    import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

    const client = new ElevenLabsClient({ apiKey: 'your_api_key' });

    // Get raw response with headers
    const { data, rawResponse } = await client.textToSpeech
      .convert('voice_id', {
        text: 'Hello, world!',
        modelId: 'eleven_multilingual_v2',
      })
      .withRawResponse();

    // Access character cost from headers
    const charCost = rawResponse.headers.get('x-character-count');
    const requestId = rawResponse.headers.get('request-id');
    const audioData = data;
    ```

  </CodeBlock>
</CodeBlocks>

The raw response provides access to:

- Response data - The actual API response content
- HTTP headers - Metadata including character costs and request IDs

<div id="overview-wave">
  <ElevenLabsWaveform color="gray" className="h-[500px]" />
</div>
