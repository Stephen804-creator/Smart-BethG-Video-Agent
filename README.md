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

## Security and deployment configuration

Production startup now fails closed unless authentication is configured. Set these as deployment environment variables; do not put provider secrets in the UI or in repository files:

```text
APP_AUTH_PASSWORD=long-private-password
APP_SESSION_SECRET=random-secret
APP_ALLOWED_ORIGINS=https://your-allowed-origin.example
HF_TOKEN=optional
LUMAAI_API_KEY=optional
COMFYUI_URL=optional
COMFYUI_WORKFLOW_PATH=optional
DATABASE_SSL=true
```

The application uses an HttpOnly session cookie, protected output/assets, explicit CORS origins, login and API rate limits, and server-managed provider configuration. The old settings write endpoint no longer accepts secrets. Internal ComfyUI URLs are trusted deployment configuration rather than request-controlled input, removing the public SSRF configuration path.

Generation endpoints now enqueue work and return a job ID immediately. Poll `/api/jobs/:jobId` for completion. The worker queue prevents a browser/Render HTTP request from remaining open for the entire provider generation time.

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

Environment variables are required for production authentication. Provider credentials are optional depending on which workers you use:

```text
APP_AUTH_PASSWORD=choose-a-private-password
APP_SESSION_SECRET=generate-a-long-random-secret
APP_ALLOWED_ORIGINS=https://your-render-service.onrender.com
HF_TOKEN=hf_your_token
LUMAAI_API_KEY=
COMFYUI_URL=
COMFYUI_WORKFLOW_PATH=
DATABASE_SSL=true
```

Never commit these values.

The free Render service is suitable for testing, but its filesystem is ephemeral. PostgreSQL is now the durable path for generation records when DATABASE_URL is configured; JSONL remains a local fallback during this migration. Film-project editing still uses the V1 JSON store and is the next storage migration target.

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


## Product roadmap

The full feature and engineering roadmap is maintained in [docs/FEATURE_ROADMAP.md](./docs/FEATURE_ROADMAP.md). It covers the planned Director Workspace, story/world systems, scene and shot intelligence, continuity, provider routing, generation operations, video understanding, audio, editing, serialized production, evaluation, dataset infrastructure, and future custom-model integration.

Development follows the roadmap incrementally. Features are considered complete only when the underlying data, backend/API, UI, persistence, integration, error handling, and real behavior are implemented—not when a placeholder screen exists.


## Current engineering status

The security and execution layer is intentionally being hardened before expanding the media intelligence surface. Authentication, protected media, environment-only provider secrets, rate limiting, asynchronous generation jobs, verified PostgreSQL TLS, shared generation QC/dataset finalization, and repository housekeeping are implemented. The remaining storage migration will move film-project state from synchronous JSON rewrites into the database layer, and the editing/effects/audio controls will remain metadata-only until a real render/export worker is connected.