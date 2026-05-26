# MIXHIVE asset pipeline (ComfyUI)

Every branded illustration in `public/art/` is reproducible from a versioned ComfyUI workflow in `assets/comfy-workflows/`. This doc is the operator runbook: how to invoke each workflow, where the output lands, and what post-processing the file needs before it ships.

Local ComfyUI is at `~/ComfyUI/`. The user has it installed and ready.

## Why ComfyUI

The user explicitly asked for pro-grade tools rather than ImageMagick / Pillow generic raster work. ComfyUI gives us:

- Versioned, reproducible workflow graphs (the JSON files commit cleanly to git).
- SDXL + ControlNet conditioning so the bespoke crown-M logo refinement keeps the original silhouette.
- Batch generation for sprite sheets (16-frame bee swarm in one pass).
- Free, local, no API key, no third-party data leak.

## One-time setup

```bash
# Start the ComfyUI HTTP server (binds to 0.0.0.0:8188 so the workflows can be loaded from a remote browser too).
cd ~/ComfyUI
python main.py --listen --port 8188
```

Open <http://localhost:8188> in a browser. The UI loads.

Required model files (one-time download — these are not committed):

| Slot                  | File                                             | Where it goes                  |
| --------------------- | ------------------------------------------------ | ------------------------------ |
| SDXL base checkpoint  | `sd_xl_base_1.0.safetensors`                     | `~/ComfyUI/models/checkpoints/`|
| ControlNet (Canny)    | `control-lora-canny-rank256.safetensors`         | `~/ComfyUI/models/controlnet/` |

Hugging Face has both under the official `stabilityai/` org (free, no auth).

## Running a workflow

For each `assets/comfy-workflows/NN-*.json`:

1. In the ComfyUI tab, click **Load** (or drag the JSON onto the canvas). The graph appears.
2. If the workflow has a `LoadImage` node (workflows `01` and `07`), the first time you'll be prompted for the source — see the per-workflow notes below.
3. Click **Queue Prompt**.
4. Output PNGs land in `~/ComfyUI/output/` with the workflow's `filename_prefix`.
5. Inspect them, pick the keeper, copy to the slot under `public/art/`. Discard the rest.
6. Commit ONLY the final selected files — never the multi-take output dump.

## Per-workflow notes

### `01-crown-m-logo.json`
- **Pre-load:** `cp public/mixhive.png ~/ComfyUI/input/mixhive-source-crown.png`. The workflow's LoadImage points at that name.
- **Output:** `~/ComfyUI/output/mixhive-logo-crown-m_*.png` (2048×2048 with alpha).
- **Post:** rename to `public/art/logo-crown-m@2x.png`. Optionally trace via `potrace public/art/logo-crown-m@2x.png -s -o public/art/logo-crown-m.svg` for a vector copy.

### `02-honeycomb-tile.json`
- **Output:** `~/ComfyUI/output/mixhive-honeycomb-tile_*.png` (512×512).
- **Verify seamlessness:** in any image editor, tile 2×2 and look for visible seams along the edges. If a seam is visible, re-run with a different seed (edit node 21's `seed` value, +1 each time).
- **Post:** copy to `public/art/honeycomb-tile.png`.

### `03-bee-sprite-sheet.json`
- **Output:** 16 individual frames `mixhive-bee-frame_001.png` … `_016.png`.
- **Post:** composite into a 4×4 atlas with ImageMagick (it's already installed for this single composite step — only the *generation* avoids magick; layout doesn't):
  ```bash
  cd ~/ComfyUI/output
  magick montage mixhive-bee-frame_*.png -tile 4x4 -geometry 256x256+0+0 -background none \
    /home/kilisan/dj-nef-website/mixhive/public/art/bee-swarm.png
  ```
- **Three.js consumption:** load as a `THREE.Texture` with `repeat=(0.25, 0.25)` and offset stepped per animation frame.

### `04-honey-drip-frames.json`
- **Output:** 12 banner frames `mixhive-honey-drip_001.png` … `_012.png` (1920×256 each).
- **Post:** two options:
  - **SVG path morph (recommended):** open each frame in Inkscape, trace bitmap → SVG path. Save the 12 paths as `public/art/honey-drip/frame-NN.svg`. Framer Motion morphs between them on transition.
  - **Lottie:** import the frames into After Effects, export `.lottie`. Drop into `public/art/honey-drip.lottie`. Use `<DotLottiePlayer>` on the client.

### `05-hero-bg-plate.json`
- **Output:** `mixhive-hero-plate_*.png` (~3840×2160).
- **Post:** compress through Squoosh CLI (free, npm-installable):
  ```bash
  npx @squoosh/cli --mozjpeg '{"quality":78,"progressive":true}' mixhive-hero-plate_001.png
  mv mixhive-hero-plate_001.jpg /home/kilisan/dj-nef-website/mixhive/public/art/hero-plate@3x.jpg
  ```

### `06-icon-glyphs.json`
- **Slot loop:** the workflow renders one icon per run. Substitute the slot description into node `10`'s prompt where it says `{SLOT}` (see the workflow's `_meta.slots` list — 10 slots). Set `filename_prefix` to `mixhive-icon-<slot-name>` per run.
- **Post:** each output goes through Inkscape SVG trace:
  ```bash
  for icon in hive-feed swarm-chat nectar-upload queen-mode mix-vault \
              vinyl-marketplace buzz-alerts hive-radar beecast-live honeydrop-nft; do
    inkscape ~/ComfyUI/output/mixhive-icon-${icon}_001.png \
      --actions="select-all;object-to-path;export-type:svg;export-do" \
      --export-filename=public/art/icons/${icon}.svg
  done
  ```

### `07-dj-portrait-style.json`
- **Pre-load:** copy any source portrait to `~/ComfyUI/input/user-portrait.png`.
- **Output:** `mixhive-portrait-styled_*.png`.
- **Use:** reusable; not committed in v1. Eventually wired to the `ProfilePictureUpload` component as a "stylize my photo" optional step.

## What gets committed

- **Workflow JSONs** — always.
- **`public/art/*`** — only the final picked outputs, after Squoosh / Inkscape.
- **`~/ComfyUI/output/*`** — never. Add a personal gitignore-equivalent: this dir is outside the repo, so it's naturally excluded.

## Regenerating after a brand tweak

If `src/styles/tokens.ts` ships new brand colours, update the prompts in the workflow JSONs to match (search/replace the old hex with the new), bump `_meta.version`, regenerate. The JSON files are the source of truth — no need to remember the prompt by heart.

## Troubleshooting

- **`KeyError: 'ckpt_name'` at queue time:** the SDXL checkpoint isn't downloaded. See "One-time setup".
- **Tile shows visible seams:** re-run `02-honeycomb-tile.json` with seed+1. Three seeds usually find a clean one.
- **Bee sprites have inconsistent angles between frames:** the batched generation walks the latent space too aggressively for small images. Switch node 21's `sampler_name` to `dpmpp_2m` (less stochastic).
- **CUDA out of memory:** drop node 20's `batch_size`. Rebatch sprite atlas as 4 runs of 4 frames instead of one run of 16.
