# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server (also mounts the TTS API middleware + /onnx/ wasm fallback)
npm run build     # tsc -b && vite build  -> dist/
npm run lint      # oxlint src
node server.cjs   # Production server: serves dist/ + /api/tts on PORT (default 5173)
```

No test runner is configured; verification is `tsc -b`, `vite build`, `oxlint`, plus manual/CDP testing on mobile. `npm install` runs `scripts/patch-piper.js`, which patches `node_modules/@mintplex-labs/piper-tts-web` (speakerId support, local `/onnx/` base instead of cdnjs) — re-run it if node_modules is reinstalled.

## Architecture

AudioEpub is a client-side React 19 + AntD + Zustand app for reading EPUBs and listening via TTS (Vietnamese-focused). Books/bookmarks persist in IndexedDB via Dexie (`src/db`), settings in `src/store/useSettingsStore.ts`.

**Multi-engine TTS** is the core complexity. `src/hooks/useTTS.ts` orchestrates all engines (`engineMode`: `edge | kokoro | vieneu | vtts | neural (Piper) | system (Web Speech)`), with one service per engine in `src/services/`:
- `edgeTTSService` — MP3 from `/api/tts` (Microsoft Edge neural voices).
- `kokoroClientService` — Kokoro-Vietnamese via `/api/tts` (server-side Python worker, despite the name).
- `vieneuService` — VieNeu-TTS via `/api/tts`; the user picks Nano (24 kHz) or Turbo (48 kHz) in settings (`vieneuMode`); the worker loads one model at a time.
- `vttsService` — V-TTS (VITS, ONNX Runtime Web) running **in the browser**, ~175 MB downloaded once into Cache Storage; fast only when the page is cross-origin isolated (Vite dev headers / `public/coi-serviceworker.js` on static hosts). License of the model is non-commercial.
- `piperService` — Piper VITS in-browser via ONNX wasm served from `/onnx/`.
- `lookaheadQueue` — prefetches upcoming sentences (`prefetchSerial` = one synthesis at a time, in order, for slow engines) and revokes object URLs.

All `/api/tts` calls go through `utils/apiBase.ts` so a static deployment can point at a remote server / the Cloudflare Worker (`cloudflare/`, Edge voices only).

**Static build**: `npm run build:static` -> `dist-static/` (relative base, no onnx folder). It can hold the git repo that is published to GitHub Pages (`kimthi113114/audioepub`); the script keeps `dist-static/.git`. Without a server the app falls back to on-device voices.

**Server side** (`server/`): `ttsMiddleware.js` is a Connect-style middleware used by Vite in dev (`vite.config.ts`); `server.cjs` is a separate standalone prod server that duplicates the Edge-TTS part of `/api/tts` (keep in sync). `ttsMiddleware.js` also lazily spawns `server/tts_worker.py` (FastAPI on `127.0.0.1:5055`, Python with torch/soundfile/fastapi/vieneu/kokoro_vietnamese) for Kokoro/VieNeu.

**Reader**: `src/utils/epubHelper.ts` + `components/ReaderView.tsx` (epub.js). Listening UI: `Player.tsx` (mini-player + full sheet; replaced PlayerBar), voice pickers (VoiceDrawer/VoiceModal), SleepTimerModal, StorageModal (cache manager), AudioLogModal (iOS lock-screen debugging), ReaderSettingsSheet. Theme colours come from `src/theme/palettes.ts` (CSS variables + AntD tokens + epub themes).

## Project rules (from AGENTS.md; UI/docs are in Vietnamese)

- **OOM prevention:** render only the single current chapter in the DOM; discard the old chapter's content before loading a new one. Never render the whole book.
- **TOC:** must have a search/filter box and be virtualized — books can have thousands of chapters.
- **iOS Safari first:** audio needs a touch-gesture unlock; pin each `SpeechSynthesisUtterance` on `window` to avoid Safari GC killing audio; use `100dvh` and safe-area padding; keep MediaSession/background audio alive.
- TTS must auto-advance to the next chapter at chapter end, support karaoke highlight/auto-scroll and a sleep timer with fade-out.
- Themes: Dark / Light / Sepia via AntD v5 tokens; target small phones (<390px).
