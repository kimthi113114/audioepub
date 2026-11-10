# Mobile chapter navigation and connection recovery

## Scroll reader controls

As a reader in continuous scroll mode, I want a tap on text or empty reading
space to hide/show header and footer, so that I can read without distractions.

- Given a short tap on the reading surface, controls toggle exactly once,
  including a touch followed by the browser's synthetic click.
- Given a swipe, cancelled gesture, long press, or text selection, controls do
  not toggle accidentally and native vertical scrolling remains available.
- Given desktop width, the hidden state is honored by both header and chapter
  bar instead of being overridden by responsive CSS.
- Existing listening gestures and chapter-by-chapter rendering remain intact.

Native CDP touch validation covers 375px text taps, body margins, exposed outer
container space in a short chapter, and 1280px desktop controls. Each tap toggles
once, including a trusted synthetic click after touch. Swipes, drag-and-return,
and cancelled touches do not toggle; cancelling a press does not start playback.
This is Chromium emulation evidence, not a physical Safari test.

## User stories and acceptance criteria

As a mobile listener, I want a chapter selection to begin at the first sentence,
so that I hear the whole chapter.

- Given playback is playing or loading in the middle of a chapter, when I select
  the next/previous chapter or a TOC chapter, then old playback is invalidated
  immediately and the selected chapter starts at sentence zero and the top.
- Given playback is paused, when I select a chapter, then its position resets
  while playback remains paused.
- Given navigation happens rapidly, when earlier asynchronous work finishes,
  then it cannot overwrite the latest selected chapter or sentence.
- Given a chapter changes, then only the current chapter is rendered in the DOM.
- Given I pause or close the player during loading, then completion must not
  start playback again.

As a phone listener using Tailscale, I want playback to recover after changing
between Wi-Fi and mobile data, so that I do not lose sentences.

- Given an audio request fails or hangs temporarily, when the server becomes
  reachable again, then playback retries the same sentence and retains its voice.
- Given the browser still reports online during a VPN route change, then timed
  retries still recover without depending on an `online` event.
- Given playback is waiting for connection recovery, then the player displays
  loading and explains that it is reconnecting.
- Given I pause, stop, select another sentence/chapter, or change voices, then
  stale requests and timers cannot resume old playback.
- Given the browser requires another playback gesture, then the player becomes
  paused and asks the listener to tap Play rather than silently skipping text.

## Architecture

### Continuous chapter playback on Safari

As a Safari listener, I want automatic chapter changes to keep listening active,
so that I do not need to press Play after each chapter.

- Given natural completion with sentence gap 0 or 300 ms, the next chapter must
  start at its first sentence and continue beyond that first sentence.
- Chapter preparation preserves the audio session and keepalive; it does not
  invoke the public user-pause operation or prime an expired audio source.
- A same-chapter DOM refresh only refreshes sentence elements, without replacing
  the live TTS list or invalidating its pending audio/gap.
- Late recovery promises from the previous media source cannot cancel playback
  in the next chapter. Genuine current-source interruption still permits Pause.
- Empty/image-only sections are skipped while listening; reaching the book's
  final chapter ends playback cleanly rather than remaining in loading.
- Pause/stop during preparation prevents delayed autoplay. Background-to-visible
  changes preserve playback and the spoken index.

The reader owns chapter navigation, resets sentence/scroll anchors, cancels the
previous chapter's debounced resume save, and ignores stale chapter rendering or
headless extraction. The app coordinates playback intent: pause old audio before
navigation and resume the new sentence list only if listening was active.

The TTS engine owns generation checks, retry timers, and audio queue lifetimes.
Remote requests have a finite timeout covering headers and the audio body.
Transport failures retry the current sentence with capped backoff; online and
visibility events can wake pending recovery. Successful audio and prefetched
blobs remain bounded to the existing small sentence queue. EPUB rendering remains
chapter by chapter, with no database schema change.

## Validation scope

Run `tsc -b`, `vite build`, and `oxlint src`, plus mobile CDP regression with an
isolated browser profile, synthetic EPUB, and deterministic audio/network fixture.
Emulation verifies application recovery and mobile layout; it does not reproduce
an actual iPhone's screen-lock restrictions or prove Tailscale routing is reachable
over a particular carrier.

Verified during implementation:

- Four Node regressions pass: transient transport/HTTP errors, timeouts before
  headers and during the response body, stale queue rejection, and serial queue
  reset after chapter changes.
- Mobile Chromium CDP uses real HTMLAudioElement playback with a generated WAV
  and synthetic EPUB; only the remote TTS responses are intercepted.
- At 375px, mid-chapter next starts sentence one at the top with a single iframe
  and no horizontal overflow; navigation while paused stays paused.
- At 390px, connection resets recover the same sentence without an online event.
  Pausing during recovery prevents an online event from restarting playback.
- Simulated hidden-to-visible transitions preserve the spoken sentence and block
  indices; rapid next-next navigation selects the final chapter at sentence one.
- Stopping during recovery prevents both retries and reopening the player.
- Seven mobile regression groups passed with 32 API requests, including 14
  deliberate connection-reset failures. Physical Safari/Tailscale remains untested.
- `tsc -b`, `vite build`, and `oxlint src` pass. Lint retains 13 warnings;
  the build reports Piper externalization and bundle-size warnings.
- The server's idle cleanup interval is unreferenced so importing middleware from
  Vite configuration no longer keeps the completed build process alive.
