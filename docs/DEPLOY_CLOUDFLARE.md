# Cloudflare deployment assessment

## Current status

This repository is a full Node.js/Express application, not a static-only frontend. The backend launches FFmpeg/ffprobe with `child_process`, writes working files under `data/` and `output/`, and expects PostgreSQL plus provider secrets. It cannot be deployed as a complete application by uploading the Vite build to Cloudflare Pages alone.

Cloudflare Pages can host the built frontend, but it will not run `node server/index.js` as a persistent Express server. Cloudflare Workers/Pages Functions are not a drop-in host for this backend: the application depends on a native FFmpeg executable, child processes, a writable working filesystem, and long-running generation jobs. Cloudflare's Node.js compatibility does not make those server dependencies automatically available.

## Build and start commands for the current application

For a conventional Node.js host that supports FFmpeg and a persistent Node process:

- Install/build command: `npm install && npm run build`
- Start command: `npm start`
- `npm start` runs `node server/index.js`.
- The app listens on `process.env.PORT` or port `8787`.
- Node.js 20+ and FFmpeg/ffprobe must be installed in the runtime image.
- Set production secrets as environment variables; do not commit them.

These commands are **not sufficient for a Cloudflare Pages deployment**. Do not set them in Pages expecting Pages to launch this Express server.

## Cloudflare-only route

To keep the entire deployment on Cloudflare, the architecture needs a Cloudflare Containers deployment (Workers Paid plan) for the existing Node/FFmpeg server, fronted by a Worker, with durable object storage such as R2 for uploaded/generated media and a durable database for user/project/job state. The container must install FFmpeg, expose the Express port, and use persistent external storage rather than relying on the container's local filesystem. A Worker entry point, container image configuration, bindings, and production smoke tests still need to be added and verified before calling this Cloudflare deployment live-ready.

Do not deploy a Pages-only build as if generation, login, uploads, or export were working. A static frontend can load while all those API features fail.

## Required production environment

At minimum, configure:

- `NODE_ENV=production`
- `PORT` (provided by the runtime/container)
- `DATABASE_URL` pointing to PostgreSQL reachable from the container
- `DATABASE_SSL=true` when the database requires TLS
- `APP_SESSION_SECRET` as a long random secret
- `APP_ALLOWED_ORIGINS` set to the exact HTTPS frontend origin(s)
- `APP_TRUST_PROXY` configured to match the actual trusted proxy topology; do not blindly trust arbitrary client-supplied forwarding headers
- Provider secrets such as `HF_TOKEN` or `LUMAAI_API_KEY`, only for providers being used
- Password-reset delivery settings if self-service reset is enabled
- Any required ComfyUI endpoint/workflow settings

Before real users, verify HTTPS cookie behavior, database connectivity/migrations, upload limits, provider connectivity, generation and export completion, process restart recovery, and deletion/retention behavior. Keep paid generation disabled until quotas and actual cost controls are configured.

## Go-live verdict

The repository can be built for a conventional Node/FFmpeg host using the commands above, but **Cloudflare-only production deployment is not ready to declare live** until the Container/Worker deployment path and external media storage are implemented and tested. This note intentionally does not claim a successful Cloudflare deployment.
