#!/usr/bin/env node
/**
 * Generate or edit images with Nano Banana Pro (Gemini 3 Pro Image) via fal.ai.
 *
 * Reads the API key from the FAL_KEY environment variable. Uses only Node.js
 * built-ins (global fetch, fs, path), so no extra dependencies are required.
 * Requires Node.js 18+ for the global fetch API.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const GENERATE_URL = "https://fal.run/fal-ai/nano-banana-pro";
const EDIT_URL = "https://fal.run/fal-ai/nano-banana-pro/edit";

const ASPECT_RATIOS = [
  "auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16",
];
const OUTPUT_FORMATS = ["jpeg", "png", "webp"];
const RESOLUTIONS = ["1K", "2K", "4K"];
const SAFETY_TOLERANCES = ["1", "2", "3", "4", "5", "6"];

function die(message) {
  console.error(message);
  process.exit(1);
}

const USAGE = `Generate/edit images with fal.ai Nano Banana Pro.

Usage:
  node generate.js "<prompt>" [options]

Options:
  --edit                    Use the edit endpoint (requires --image-url).
  --image-url <url>         Source image URL for editing. Repeat for multiple
                            images (up to 14).
  --num-images <n>          Number of images (1-4). Default 1.
  --seed <n>                Seed for reproducible output.
  --aspect-ratio <ratio>    One of: ${ASPECT_RATIOS.join(", ")}.
  --output-format <fmt>     One of: ${OUTPUT_FORMATS.join(", ")}. Default png.
  --resolution <res>        One of: ${RESOLUTIONS.join(", ")}. Default 1K (4K billed double).
  --safety-tolerance <n>    1 strictest .. 6 least strict. Default 4.
  --enable-web-search       Allow the model to use web info.
  --limit-generations       Limit to one generation per prompt round.
  --out <dir>               Directory to download generated images into.
  -h, --help                Show this help.
`;

function parseArgs(argv) {
  const args = {
    prompt: undefined,
    edit: false,
    imageUrls: [],
    numImages: 1,
    seed: undefined,
    aspectRatio: undefined,
    outputFormat: "png",
    resolution: "1K",
    safetyTolerance: "4",
    enableWebSearch: false,
    limitGenerations: false,
    out: undefined,
  };

  const needValue = (i, name) => {
    if (i + 1 >= argv.length) die(`${name} requires a value.`);
    return argv[i + 1];
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      case "--edit":
        args.edit = true;
        break;
      case "--image-url":
        args.imageUrls.push(needValue(i, "--image-url"));
        i++;
        break;
      case "--num-images":
        args.numImages = parseInt(needValue(i, "--num-images"), 10);
        i++;
        break;
      case "--seed":
        args.seed = parseInt(needValue(i, "--seed"), 10);
        i++;
        break;
      case "--aspect-ratio":
        args.aspectRatio = needValue(i, "--aspect-ratio");
        i++;
        if (!ASPECT_RATIOS.includes(args.aspectRatio)) {
          die(`--aspect-ratio must be one of: ${ASPECT_RATIOS.join(", ")}`);
        }
        break;
      case "--output-format":
        args.outputFormat = needValue(i, "--output-format");
        i++;
        if (!OUTPUT_FORMATS.includes(args.outputFormat)) {
          die(`--output-format must be one of: ${OUTPUT_FORMATS.join(", ")}`);
        }
        break;
      case "--resolution":
        args.resolution = needValue(i, "--resolution");
        i++;
        if (!RESOLUTIONS.includes(args.resolution)) {
          die(`--resolution must be one of: ${RESOLUTIONS.join(", ")}`);
        }
        break;
      case "--safety-tolerance":
        args.safetyTolerance = needValue(i, "--safety-tolerance");
        i++;
        if (!SAFETY_TOLERANCES.includes(args.safetyTolerance)) {
          die(`--safety-tolerance must be one of: ${SAFETY_TOLERANCES.join(", ")}`);
        }
        break;
      case "--enable-web-search":
        args.enableWebSearch = true;
        break;
      case "--limit-generations":
        args.limitGenerations = true;
        break;
      case "--out":
        args.out = needValue(i, "--out");
        i++;
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
    num_images: args.numImages,
    output_format: args.outputFormat,
    resolution: args.resolution,
    safety_tolerance: args.safetyTolerance,
    enable_web_search: args.enableWebSearch,
    limit_generations: args.limitGenerations,
  };
  if (args.seed !== undefined && !Number.isNaN(args.seed)) {
    payload.seed = args.seed;
  }
  if (args.aspectRatio !== undefined) {
    payload.aspect_ratio = args.aspectRatio;
  }
  if (args.edit) {
    payload.image_urls = args.imageUrls;
  }
  return payload;
}

async function callApi(url, payload, apiKey) {
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    die(`Network error: ${e.message}`);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    die(`API error ${resp.status}: ${body}`);
  }

  return resp.json();
}

async function download(url, destDir, index) {
  fs.mkdirSync(destDir, { recursive: true });
  const name = url.split("/").pop().split("?")[0] || `image_${index}.png`;
  const outPath = path.join(destDir, name);
  const resp = await fetch(url);
  if (!resp.ok) {
    die(`Failed to download ${url}: ${resp.status}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    die("FAL_KEY is not set. Export it first: export FAL_KEY='your-api-key-here'");
  }

  if (!(args.numImages >= 1 && args.numImages <= 4)) {
    die("--num-images must be between 1 and 4.");
  }

  if (args.edit && args.imageUrls.length === 0) {
    die("--edit requires at least one --image-url.");
  }
  if (!args.edit && args.imageUrls.length > 0) {
    die("--image-url is only valid with --edit.");
  }

  const url = args.edit ? EDIT_URL : GENERATE_URL;
  const payload = buildPayload(args);

  const result = await callApi(url, payload, apiKey);
  const images = result.images || [];
  if (images.length === 0) {
    die(`No images returned. Raw response: ${JSON.stringify(result)}`);
  }

  console.log(`Generated ${images.length} image(s):`);
  for (let i = 0; i < images.length; i++) {
    const imgUrl = images[i].url || "";
    console.log(`  [${i}] ${imgUrl}`);
    if (args.out && imgUrl) {
      const saved = await download(imgUrl, args.out, i);
      console.log(`      saved -> ${saved}`);
    }
  }

  if (result.description) {
    console.log(`\nDescription: ${result.description}`);
  }
}

main();
