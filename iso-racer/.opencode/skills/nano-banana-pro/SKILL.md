---
name: nano-banana-pro
description: Use when the user wants to generate or edit images with Google's Nano Banana Pro (Gemini 3 Pro Image) via the fal.ai API. Triggers on requests like "generate an image", "make a picture", "nano banana", "fal image generation", or "edit this image with fal". Covers text-to-image and image editing through the fal-ai/nano-banana-pro endpoints.
---

# Nano Banana Pro (fal.ai) image generation

Generate and edit images using Google's Nano Banana Pro model (Gemini 3 Pro
Image) through the fal.ai Model API.

## Prerequisites

- A fal.ai API key set in the `FAL_KEY` environment variable. See
  "API key setup" below.
- Node.js 18+ (the helper script relies on the built-in global `fetch`).
- The helper script uses raw HTTP via the built-in `fetch`, so no SDK install
  is strictly required. If the user prefers the official client:
  - JavaScript: `npm install @fal-ai/client`
  - Python: `pip install fal-client`

## Endpoints

| Task           | Endpoint ID                  | URL                                          |
| -------------- | ---------------------------- | -------------------------------------------- |
| Text-to-image  | `fal-ai/nano-banana-pro`      | `https://fal.run/fal-ai/nano-banana-pro`      |
| Image editing  | `fal-ai/nano-banana-pro/edit` | `https://fal.run/fal-ai/nano-banana-pro/edit` |

Authentication header on every request: `Authorization: Key $FAL_KEY`.

## Input parameters

Text-to-image (`fal-ai/nano-banana-pro`):

| Field               | Type    | Default | Notes                                                                                  |
| ------------------- | ------- | ------- | -------------------------------------------------------------------------------------- |
| `prompt`            | string  | —       | **Required.** Natural-language description of the image.                               |
| `num_images`        | int     | `1`     | Range `1`–`4`.                                                                          |
| `seed`              | int     | —       | Seed for reproducible output.                                                          |
| `aspect_ratio`      | enum    | `1:1`   | `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`.        |
| `output_format`     | enum    | `png`   | `jpeg`, `png`, `webp`.                                                                  |
| `resolution`        | enum    | `1K`    | `1K`, `2K`, `4K`. 4K is billed at double rate.                                          |
| `safety_tolerance`  | enum    | `4`     | `1` (strictest) to `6` (least strict).                                                 |
| `sync_mode`         | bool    | `false` | If `true`, returns a data URI instead of a CDN URL.                                     |
| `limit_generations` | bool    | `false` | Force a single generation per prompt round.                                            |
| `enable_web_search` | bool    | `false` | Let the model pull current info from the web.                                          |

Image editing (`fal-ai/nano-banana-pro/edit`) takes all of the above plus:

| Field        | Type           | Default | Notes                                                                  |
| ------------ | -------------- | ------- | ---------------------------------------------------------------------- |
| `image_urls` | list<string>  | —       | **Required.** Source image URLs to edit/blend (up to 14 images).       |

Note: for edit, `aspect_ratio` defaults to `auto`.

## Output schema

```json
{
  "images": [
    { "content_type": "image/png", "file_name": "...", "url": "https://..." }
  ],
  "description": ""
}
```

The image `url` is a fal CDN link. Download it to save locally.

## Usage

Use the bundled helper script. It reads `FAL_KEY` from the environment, calls
the endpoint, prints the result URLs, and optionally downloads the images.

Generate an image:

```bash
node scripts/generate.js "a futuristic cityscape at sunset" \
  --aspect-ratio 16:9 --resolution 2K --num-images 2 --out ./out
```

Edit / blend existing images:

```bash
node scripts/generate.js "make the man drive the car down the coast" \
  --edit \
  --image-url https://example.com/a.png \
  --image-url https://example.com/b.png \
  --out ./out
```

Run `node scripts/generate.js --help` for all flags.

If the user prefers inline SDK code instead of the script, the minimal
JavaScript form is:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/nano-banana-pro", {
  input: { prompt: "a futuristic cityscape at sunset" },
});
console.log(result.data.images[0].url);
```

## API key setup

The key lives in the `FAL_KEY` environment variable. Create one at
<https://fal.ai/dashboard/keys> (choose **API** scope), then set it one of
these ways:

- Shell session (macOS/Linux): `export FAL_KEY="your-api-key-here"`
- Persist it: add that `export` line to `~/.zshrc` (this machine uses zsh).
- Project `.env` file: add `FAL_KEY=your-api-key-here` and load it before running.

Never hardcode the key into source files or commit it to git.
