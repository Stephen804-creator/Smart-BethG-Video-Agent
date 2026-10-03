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
