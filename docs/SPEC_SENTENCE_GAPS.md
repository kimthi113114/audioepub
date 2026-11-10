# Sentence pauses in the audiobook player

## Story and acceptance criteria

As a phone audiobook listener, I want to choose a pause between sentences so that
I can adjust narration rhythm.

- The desktop player and mobile player sheet offer exactly 0, 100, 200, 300 ms.
- The default is 0 ms. The selected value is visible and survives reload.
- After a sentence finishes naturally, every TTS engine waits the selected extra
  duration before starting the next sentence. Existing synthesis/network latency
  may add to this duration.
- Changing the setting affects the next scheduled sentence boundary.
- Manual next/previous/jump remains immediate; empty text and errors do not add
  sentence pauses.
- Pausing, stopping, changing chapter, or seeking invalidates pending callbacks.
- Chapter transition and sleep-timer policies retain their existing behavior.
- Four choices fit a narrow phone screen, with 44px tall tap targets.

## Architecture

Persist `sentenceGapMs` in the existing settings store, defaulting to zero when
older settings are merged. Both player layouts use one shared control. Schedule
the gap in the common sentence-completion path, with one timeout reference and
the existing playback generation guard. Prefetch remains active during the gap;
there is no per-engine queue expansion or change to EPUB chapter rendering.

## Verification

Check actual media completion-to-next-play timing through mobile CDP, persistence,
manual navigation, and cancellation during a gap. Run TypeScript, production
build, lint, and existing transport regressions. Chromium emulation does not
guarantee exact timer precision on a locked or backgrounded iPhone Safari tab.

Verified through mobile CDP with real HTMLAudioElement natural completion:

- All four gap settings delay the next playback as configured (with normal
  browser scheduling overhead); 0 ms dispatches immediately.
- At 375px, all choices fit and their tap targets are at least 44px tall.
- Selection persists through a real settings-store reload.
- Pause/resume during a gap continues at the next sentence; manual next, seek,
  chapter selection, and stop cancel the previous pending gap.
- TypeScript/production build and lint pass; lint retains 13 existing warnings.
  The four transport/queue regression tests also pass.
