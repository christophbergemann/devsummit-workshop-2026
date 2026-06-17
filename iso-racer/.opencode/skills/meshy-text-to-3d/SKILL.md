---
name: meshy-text-to-3d
description: Use when the user wants to generate 3D models from text with Meshy-6 (fal-ai/meshy/v6/text-to-3d) via the fal.ai API. Triggers on requests like "generate a 3D model", "text to 3D", "make a mesh", "create a GLB/OBJ/FBX model", "meshy", or "fal 3d generation". Covers untextured (preview) and fully textured (full) model generation, plus optional rigging and animation.
---

# Meshy-6 text-to-3D (fal.ai) model generation

Generate 3D models from a text prompt using the Meshy-6 model through the
fal.ai Model API (`fal-ai/meshy/v6/text-to-3d`). Output is a GLB/FBX/OBJ/USDZ
mesh, optionally textured, rigged, and animated.

## Prerequisites

- A fal.ai API key set in the `FAL_KEY` environment variable. See
  "API key setup" below.
- Node.js 18+ (the helper script relies on the built-in global `fetch`).
- The helper script uses raw HTTP via the built-in `fetch`, so no SDK install
  is strictly required. If the user prefers the official client:
  - JavaScript: `npm install @fal-ai/client`
  - Python: `pip install fal-client`

## Endpoint

| Task          | Endpoint ID                  | Queue URL                                       |
| ------------- | ---------------------------- | ----------------------------------------------- |
| Text-to-3D    | `fal-ai/meshy/v6/text-to-3d` | `https://queue.fal.run/fal-ai/meshy/v6/text-to-3d` |

This is a **queue-based, long-running** endpoint. The flow is:

1. `POST` to the queue URL → returns a `request_id`.
2. `GET .../requests/{request_id}/status` → poll until `COMPLETED`.
3. `GET .../requests/{request_id}` → fetch the result with model URLs.

Authentication header on every request: `Authorization: Key $FAL_KEY`.

## Input parameters

| Field                     | Type     | Default      | Notes                                                                                       |
| ------------------------- | -------- | ------------ | ------------------------------------------------------------------------------------------- |
| `prompt`                  | string   | —            | **Required.** What the model is. Max 600 chars.                                             |
| `mode`                    | enum     | `full`       | `preview` (untextured geometry, 20 credits) or `full` (textured, 30+ credits).              |
| `model_type`              | enum     | `standard`   | `standard` (high-detail) or `lowpoly`. `lowpoly` ignores remesh controls.                   |
| `topology`                | enum     | `triangle`   | `quad` (smooth surfaces) or `triangle` (detailed geometry).                                 |
| `target_polycount`        | int      | `30000`      | Target polygon count.                                                                       |
| `should_remesh`           | bool     | `true`       | Enable remesh phase. `false` returns raw triangle mesh.                                     |
| `symmetry_mode`           | enum     | `auto`       | `off`, `auto`, `on`.                                                                         |
| `seed`                    | int      | —            | Seed for reproducible results.                                                              |
| `enable_pbr`              | bool     | `false`      | Generate PBR maps (metallic, roughness, normal) plus base color.                            |
| `pose_mode`               | enum     | `""`         | `a-pose`, `t-pose`, or empty for no specific pose.                                           |
| `enable_prompt_expansion` | bool     | `false`      | Use an LLM to expand the prompt with more detail.                                           |
| `texture_prompt`          | string   | —            | Extra prompt to guide texturing (`full` mode only).                                         |
| `texture_image_url`       | string   | —            | 2D image to guide texturing (`full` mode only).                                             |
| `enable_rigging`          | bool     | `false`      | Auto-rig as a humanoid. Best with clearly defined limbs.                                     |
| `rigging_height_meters`   | float    | `1.7`        | Character height in meters (only when rigging).                                             |
| `enable_animation`        | bool     | `false`      | Apply an animation preset. Requires `enable_rigging`.                                        |
| `animation_action_id`     | int      | `92`         | Animation preset ID in `[0, 696]` (`0` = Idle). Only when `enable_animation`.               |
| `enable_safety_checker`   | bool     | `true`       | Check input for safety before processing.                                                   |

## Output schema

```json
{
  "model_glb": { "content_type": "model/gltf-binary", "url": "https://...", "file_name": "model.glb" },
  "thumbnail": { "content_type": "image/png", "url": "https://...", "file_name": "preview.png" },
  "model_urls": {
    "glb":  { "url": "https://...model.glb" },
    "fbx":  { "url": "https://...model.fbx" },
    "obj":  { "url": "https://...model.obj" },
    "usdz": { "url": "https://...model.usdz" }
  },
  "texture_urls": [ { "base_color": { "url": "https://...texture_0.png" } } ],
  "seed": 4002110719,
  "prompt": "..."
}
```

Rigging/animation add `rigged_character_glb`, `rigged_character_fbx`,
`animation_glb`, `animation_fbx`, and `basic_animations` to the output.

The asset `url`s are fal CDN links. Download them to save locally.

## Usage

Use the bundled helper script. It reads `FAL_KEY` from the environment, submits
the request, polls the queue until completion, prints the result URLs, and
optionally downloads every asset.

Generate a textured model:

```bash
node scripts/generate.js "a rustic wooden treasure chest with iron bands" \
  --mode full --out ./out
```

Quick untextured preview (cheaper, faster):

```bash
node scripts/generate.js "a low-poly sci-fi spaceship" \
  --mode preview --model-type lowpoly --out ./out
```

Rigged + animated humanoid:

```bash
node scripts/generate.js "a cartoon robot character with arms and legs" \
  --enable-rigging --enable-animation --animation-action-id 92 --out ./out
```

Run `node scripts/generate.js --help` for all flags.

If the user prefers inline SDK code instead of the script, the minimal
JavaScript form is:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/meshy/v6/text-to-3d", {
  input: { prompt: "a rustic wooden treasure chest with iron bands" },
  logs: true,
  onQueueUpdate: (u) => {
    if (u.status === "IN_PROGRESS") u.logs.forEach((l) => console.log(l.message));
  },
});
console.log(result.data.model_urls.glb.url);
```

## Notes

- Generation is not instant; `full` mode can take a few minutes. The helper
  script polls with `--poll-interval` (default 5s) up to `--timeout` (default
  600s).
- `preview` mode returns geometry only (no `texture_urls`). Use `full` for
  textured output.
- Credits: `preview` ~20, `full` ~30 (plus optional texture guidance). Confirm
  with the user before running expensive batches.

## API key setup

The key lives in the `FAL_KEY` environment variable. Create one at
<https://fal.ai/dashboard/keys> (choose **API** scope), then set it one of
these ways:

- Shell session (macOS/Linux): `export FAL_KEY="your-api-key-here"`
- Persist it: add that `export` line to `~/.zshrc` (this machine uses zsh).
- Project `.env` file: add `FAL_KEY=your-api-key-here` and load it before running.

Never hardcode the key into source files or commit it to git.
