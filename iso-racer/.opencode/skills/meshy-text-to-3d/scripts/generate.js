#!/usr/bin/env node
/**
 * Generate 3D models from text with Meshy-6 (fal-ai/meshy/v6/text-to-3d) via fal.ai.
 *
 * Reads the API key from the FAL_KEY environment variable. Uses only Node.js
 * built-ins (global fetch, fs, path), so no extra dependencies are required.
 * Requires Node.js 18+ for the global fetch API.
 *
 * This is a queue-based (long-running) endpoint: the script submits a request,
 * polls the queue status until completion, then fetches and (optionally)
 * downloads the resulting model files.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ENDPOINT = "fal-ai/meshy/v6/text-to-3d";
const QUEUE_BASE = `https://queue.fal.run/${ENDPOINT}`;

const MODES = ["preview", "full"];
const MODEL_TYPES = ["standard", "lowpoly"];
const TOPOLOGIES = ["quad", "triangle"];
const SYMMETRY_MODES = ["off", "auto", "on"];
const POSE_MODES = ["a-pose", "t-pose", ""];

function die(message) {
  console.error(message);
  process.exit(1);
}

const USAGE = `Generate 3D models from text with fal.ai Meshy-6 (text-to-3d).

Usage:
  node generate.js "<prompt>" [options]

Options:
  --mode <mode>             One of: ${MODES.join(", ")}. Default full.
                            'preview' = untextured geometry, 'full' = textured.
  --model-type <type>       One of: ${MODEL_TYPES.join(", ")}. Default standard.
  --topology <topo>         One of: ${TOPOLOGIES.join(", ")}. Default triangle.
  --target-polycount <n>    Target polygon count. Default 30000.
  --no-remesh               Disable the remesh phase (returns raw triangle mesh).
  --symmetry-mode <m>       One of: ${SYMMETRY_MODES.join(", ")}. Default auto.
  --seed <n>                Seed for reproducible results.
  --enable-pbr              Generate PBR maps (metallic, roughness, normal).
  --pose-mode <p>           One of: a-pose, t-pose. Default none.
  --enable-prompt-expansion Expand the prompt with an LLM before generating.
  --texture-prompt <text>   Extra prompt to guide texturing (full mode only).
  --texture-image-url <url> 2D image to guide texturing (full mode only).
  --enable-rigging          Auto-rig the model as a humanoid character.
  --rigging-height <m>      Character height in meters. Default 1.7.
  --enable-animation        Apply an animation preset (requires --enable-rigging).
  --animation-action-id <n> Animation preset ID [0-696]. Default 92.
  --no-safety-checker       Disable the input safety checker.
  --out <dir>               Directory to download model/texture files into.
  --poll-interval <sec>     Seconds between status polls. Default 5.
  --timeout <sec>           Max seconds to wait for completion. Default 600.
  -h, --help                Show this help.
`;

function parseArgs(argv) {
  const args = {
    prompt: undefined,
    mode: "full",
    modelType: "standard",
    topology: "triangle",
    targetPolycount: 30000,
    shouldRemesh: true,
    symmetryMode: "auto",
    seed: undefined,
    enablePbr: false,
    poseMode: "",
    enablePromptExpansion: false,
    texturePrompt: undefined,
    textureImageUrl: undefined,
    enableRigging: false,
    riggingHeight: 1.7,
    enableAnimation: false,
    animationActionId: 92,
    enableSafetyChecker: true,
    out: undefined,
    pollInterval: 5,
    timeout: 600,
  };

  const needValue = (i, name) => {
    if (i + 1 >= argv.length) die(`${name} requires a value.`);
    return argv[i + 1];
  };
  const checkEnum = (val, allowed, name) => {
    if (!allowed.includes(val)) die(`${name} must be one of: ${allowed.join(", ")}`);
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      case "--mode":
        args.mode = needValue(i, "--mode"); i++;
        checkEnum(args.mode, MODES, "--mode");
        break;
      case "--model-type":
        args.modelType = needValue(i, "--model-type"); i++;
        checkEnum(args.modelType, MODEL_TYPES, "--model-type");
        break;
      case "--topology":
        args.topology = needValue(i, "--topology"); i++;
        checkEnum(args.topology, TOPOLOGIES, "--topology");
        break;
      case "--target-polycount":
        args.targetPolycount = parseInt(needValue(i, "--target-polycount"), 10); i++;
        break;
      case "--no-remesh":
        args.shouldRemesh = false;
        break;
      case "--symmetry-mode":
        args.symmetryMode = needValue(i, "--symmetry-mode"); i++;
        checkEnum(args.symmetryMode, SYMMETRY_MODES, "--symmetry-mode");
        break;
      case "--seed":
        args.seed = parseInt(needValue(i, "--seed"), 10); i++;
        break;
      case "--enable-pbr":
        args.enablePbr = true;
        break;
      case "--pose-mode":
        args.poseMode = needValue(i, "--pose-mode"); i++;
        checkEnum(args.poseMode, POSE_MODES, "--pose-mode");
        break;
      case "--enable-prompt-expansion":
        args.enablePromptExpansion = true;
        break;
      case "--texture-prompt":
        args.texturePrompt = needValue(i, "--texture-prompt"); i++;
        break;
      case "--texture-image-url":
        args.textureImageUrl = needValue(i, "--texture-image-url"); i++;
        break;
      case "--enable-rigging":
        args.enableRigging = true;
        break;
      case "--rigging-height":
        args.riggingHeight = parseFloat(needValue(i, "--rigging-height")); i++;
        break;
      case "--enable-animation":
        args.enableAnimation = true;
        break;
      case "--animation-action-id":
        args.animationActionId = parseInt(needValue(i, "--animation-action-id"), 10); i++;
        break;
      case "--no-safety-checker":
        args.enableSafetyChecker = false;
        break;
      case "--out":
        args.out = needValue(i, "--out"); i++;
        break;
      case "--poll-interval":
        args.pollInterval = parseFloat(needValue(i, "--poll-interval")); i++;
        break;
      case "--timeout":
        args.timeout = parseFloat(needValue(i, "--timeout")); i++;
        break;
      default:
        if (a.startsWith("-")) {
          die(`Unknown option: ${a}`);
        }
        if (args.prompt === undefined) {
          args.prompt = a;
        } else {
          die(`Unexpected argument: ${a}`);
        }
    }
  }

  if (args.prompt === undefined) {
    die("A text prompt is required.\n\n" + USAGE);
  }

  return args;
}

function buildPayload(args) {
  const payload = {
    prompt: args.prompt,
    mode: args.mode,
    model_type: args.modelType,
    topology: args.topology,
    target_polycount: args.targetPolycount,
    should_remesh: args.shouldRemesh,
    symmetry_mode: args.symmetryMode,
    enable_pbr: args.enablePbr,
    enable_prompt_expansion: args.enablePromptExpansion,
    enable_rigging: args.enableRigging,
    rigging_height_meters: args.riggingHeight,
    enable_animation: args.enableAnimation,
    animation_action_id: args.animationActionId,
    enable_safety_checker: args.enableSafetyChecker,
  };
  if (args.seed !== undefined && !Number.isNaN(args.seed)) payload.seed = args.seed;
  if (args.poseMode) payload.pose_mode = args.poseMode;
  if (args.texturePrompt !== undefined) payload.texture_prompt = args.texturePrompt;
  if (args.textureImageUrl !== undefined) payload.texture_image_url = args.textureImageUrl;
  return payload;
}

function authHeaders(apiKey) {
  return { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" };
}

async function submit(payload, apiKey) {
  let resp;
  try {
    resp = await fetch(QUEUE_BASE, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    die(`Network error on submit: ${e.message}`);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    die(`Submit error ${resp.status}: ${body}`);
  }
  const data = await resp.json();
  if (!data.request_id) {
    die(`No request_id returned. Raw response: ${JSON.stringify(data)}`);
  }
  // The queue returns the canonical status/response URLs. These use the app
  // base prefix (e.g. fal-ai/meshy) rather than the full endpoint path, so we
  // must use them as-is instead of reconstructing from ENDPOINT.
  return {
    requestId: data.request_id,
    statusUrl: data.status_url || `${QUEUE_BASE}/requests/${data.request_id}/status`,
    responseUrl: data.response_url || `${QUEUE_BASE}/requests/${data.request_id}`,
  };
}

async function getStatus(statusUrl, apiKey) {
  const resp = await fetch(statusUrl, { headers: authHeaders(apiKey) });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    die(`Status error ${resp.status}: ${body}`);
  }
  return resp.json();
}

async function getResult(responseUrl, apiKey) {
  const resp = await fetch(responseUrl, { headers: authHeaders(apiKey) });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    die(`Result error ${resp.status}: ${body}`);
  }
  return resp.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollUntilDone(statusUrl, apiKey, pollInterval, timeout) {
  const deadline = Date.now() + timeout * 1000;
  let lastStatus = "";
  while (Date.now() < deadline) {
    const status = await getStatus(statusUrl, apiKey);
    if (status.status !== lastStatus) {
      console.log(`  status: ${status.status}`);
      lastStatus = status.status;
    }
    if (status.status === "COMPLETED") return;
    if (status.status === "FAILED" || status.status === "ERROR") {
      die(`Generation failed. Raw status: ${JSON.stringify(status)}`);
    }
    await sleep(pollInterval * 1000);
  }
  die(`Timed out waiting (${timeout}s) at ${statusUrl}.`);
}

async function download(url, destDir, fallbackName) {
  fs.mkdirSync(destDir, { recursive: true });
  const name = url.split("/").pop().split("?")[0] || fallbackName;
  const outPath = path.join(destDir, name);
  const resp = await fetch(url);
  if (!resp.ok) {
    die(`Failed to download ${url}: ${resp.status}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return outPath;
}

function collectFiles(result) {
  // Returns [{ label, url }] for every downloadable asset in the result.
  const files = [];
  const push = (label, file) => {
    if (file && file.url) files.push({ label, url: file.url });
  };

  if (result.model_urls) {
    for (const fmt of ["glb", "fbx", "obj", "usdz", "blend", "stl"]) {
      push(`model.${fmt}`, result.model_urls[fmt]);
    }
  } else {
    push("model.glb", result.model_glb);
  }

  push("thumbnail", result.thumbnail);

  if (Array.isArray(result.texture_urls)) {
    result.texture_urls.forEach((tex, i) => {
      for (const map of ["base_color", "metallic", "normal", "roughness"]) {
        push(`texture[${i}].${map}`, tex[map]);
      }
    });
  }

  push("rigged_character.glb", result.rigged_character_glb);
  push("rigged_character.fbx", result.rigged_character_fbx);
  push("animation.glb", result.animation_glb);
  push("animation.fbx", result.animation_fbx);

  return files;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    die("FAL_KEY is not set. Export it first: export FAL_KEY='your-api-key-here'");
  }

  if (args.prompt.length > 600) {
    die("--prompt must be at most 600 characters.");
  }
  if (args.enableAnimation && !args.enableRigging) {
    die("--enable-animation requires --enable-rigging.");
  }
  if (args.animationActionId < 0 || args.animationActionId > 696) {
    die("--animation-action-id must be in [0, 696].");
  }

  const payload = buildPayload(args);

  console.log(`Submitting to ${ENDPOINT} ...`);
  const { requestId, statusUrl, responseUrl } = await submit(payload, apiKey);
  console.log(`  request_id: ${requestId}`);

  console.log("Waiting for generation to complete (this can take a few minutes)...");
  await pollUntilDone(statusUrl, apiKey, args.pollInterval, args.timeout);

  const result = await getResult(responseUrl, apiKey);

  const primary = result.model_urls && result.model_urls.glb
    ? result.model_urls.glb.url
    : (result.model_glb && result.model_glb.url) || "";
  if (!primary) {
    die(`No model returned. Raw response: ${JSON.stringify(result)}`);
  }

  console.log("\nDone. Output files:");
  const files = collectFiles(result);
  for (const f of files) {
    console.log(`  ${f.label}: ${f.url}`);
  }

  if (result.seed !== undefined) console.log(`\nseed: ${result.seed}`);
  if (result.actual_prompt) console.log(`actual_prompt: ${result.actual_prompt}`);

  if (args.out) {
    console.log(`\nDownloading into ${args.out} ...`);
    for (const f of files) {
      const saved = await download(f.url, args.out, f.label.replace(/[^\w.-]/g, "_"));
      console.log(`  ${f.label} -> ${saved}`);
    }
  }
}

main();
