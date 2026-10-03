# Cinematic Agent V1 — real LTX generation

This version keeps the application intentionally small but connects the first real video engine: the public `Lightricks/ltx-video-distilled` Gradio Space on Hugging Face.

## What works
- React frontend + Express backend
- Real Hugging Face Gradio API call to `/text_to_video`
- 2–8 second generation
- 16:9 / 9:16 / 1:1 dimensions
- Generated MP4 is downloaded by the backend and served by the app
- Prompt/model/settings/output metadata is appended to `data/generations.jsonl`
- Optional Hugging Face token support through settings or `HF_TOKEN`
- Provider boundary remains in place for future Wan, HunyuanVideo, ComfyUI, or your own model
- Express serves the built frontend, so the project can be deployed as one free web service

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

For production-style local serving:

```bash
npm run build
npm start
```

Then open `http://localhost:8787`.

## Deploy on Render

Create a **Web Service** from this repository.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

Environment variable (optional):

```text
HF_TOKEN=hf_your_token
```

The free Render service is suitable for testing, but its filesystem is ephemeral. The saved videos and JSONL dataset are therefore a V1 testing store, not permanent training storage.

## Important architecture decision

The app does not scrape the Hugging Face webpage. It calls the Space's documented Gradio API. The first provider is LTX only. More providers should be added as adapters after this end-to-end path is working.

The long-term dataset path is:

`prompt → model → parameters → generated video → evaluation → training dataset`


## GPU worker milestone

The application now has a provider-neutral media task contract and a real ComfyUI worker adapter. It does not assume a particular GPU provider.

To execute a real ComfyUI generation:

1. Run ComfyUI on the machine that has the GPU.
2. Export `COMFYUI_URL` with its reachable URL.
3. Export `COMFYUI_WORKFLOW_PATH` pointing to a real ComfyUI API-format workflow JSON.
4. The workflow may use these placeholders where appropriate: `{{prompt}}`, `{{negative_prompt}}`, `{{seed}}`, `{{width}}`, `{{height}}`, `{{duration}}`, `{{frames}}`.
5. Test `GET /api/workers` before spending GPU time.
6. Use `POST /api/media/generate` for provider-neutral video tasks or the existing ComfyUI provider option.

The example workflow in `workflows/comfyui/api-workflow.example.json` is documentation only; it is not a runnable video workflow. This prevents the application from pretending that a model is installed when it is not.
