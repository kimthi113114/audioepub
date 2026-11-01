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

**Multi-engine TTS** is the core complexity. `src/hooks/useTTS.ts` orchestrates all engines (`engineMode`: `edge | kokoro | vieneu | neural (Piper) | system (Web Speech)`), with one service per engine in `src/services/`:
- `edgeTTSService` — fetches MP3 from the server-side `/api/tts` (Microsoft Edge neural voices).
- `kokoroClientService` — Kokoro-82M running in-browser (WebGPU/ONNX).
- `vieneuService` — VieNeu-TTS via the server (backed by the local Python worker).
- `piperService` — Piper VITS in-browser via ONNX wasm served from `/onnx/`.
- `lookaheadQueue` — prefetches sentence N+1 audio blobs while N plays and revokes object URLs to avoid leaks.

**Server side** (`server/`): `ttsMiddleware.js` is a Connect-style middleware used by Vite in dev (`vite.config.ts`); `server.cjs` is a separate standalone prod server that duplicates the `/api/tts` Edge-TTS logic (keep the two in sync). `ttsMiddleware.js` also lazily spawns `server/tts_worker.py` (FastAPI on `127.0.0.1:5055`, needs Python with torch/soundfile/fastapi) for Kokoro/VieNeu server-side synthesis.

**Reader**: `src/utils/epubHelper.ts` + `components/ReaderView.tsx` (epub.js). Other components: BookShelf, PlayerBar, voice pickers (VoiceDrawer/VoiceModal), SleepTimerModal, iOSGuideModal.

## Project rules (from AGENTS.md; UI/docs are in Vietnamese)

- **OOM prevention:** render only the single current chapter in the DOM; discard the old chapter's content before loading a new one. Never render the whole book.
- **TOC:** must have a search/filter box and be virtualized — books can have thousands of chapters.
- **iOS Safari first:** audio needs a touch-gesture unlock; pin each `SpeechSynthesisUtterance` on `window` to avoid Safari GC killing audio; use `100dvh` and safe-area padding; keep MediaSession/background audio alive.
- TTS must auto-advance to the next chapter at chapter end, support karaoke highlight/auto-scroll and a sleep timer with fade-out.
- Themes: Dark / Light / Sepia via AntD v5 tokens; target small phones (<390px).
