# Rehearsal — production video path

Date: 2026-11-26. Target: https://noescape-case.vercel.app. Viewport: 1440×900. Fresh Chromium context per run, with a pre-funded dev burner seeded in `localStorage` — this is the Phase 10 "pre-fund the recording burner" control, so Turnstile is skipped (`alreadyFunded`) and the guest drip is not exercised here. No video, voice or screen recording was made by the agent.

Shot mapping follows the Phase 10 plan in `03-thesis-proof-scope-demo.md`: title, case open, turns, `/secret` refusal, case-file proof, Most Wanted. The proof shot uses the already verified featured case **#2** instead of waiting for the new live case to end; live turns took 30–63 s each, so capturing a full 12-turn case twice would not fit a clean rehearsal. T43 must write the script against this reliable path and mark the featured-case substitution.

## Run 1 — case #14

| Shot                 | Seconds | Note                                                       |
| -------------------- | ------: | ---------------------------------------------------------- |
| 1 title              |     8.0 | Title and "Take the case" ready after state settles        |
| 2 open case          |    24.4 | Prior case abandoned, new case #14 opened, coach dismissed |
| 3 turn 1             |    30.1 | Decoded; **wait > 25 s**                                   |
| 3 turn 2             |    39.1 | Decoded; **wait > 25 s**                                   |
| 3 turn 3             |    63.1 | Decoded; **wait > 25 s** (slowest of the run)              |
| 3 turn 4             |    45.1 | Decoded; **wait > 25 s**                                   |
| 4 secret refusal     |     2.3 | Relayer refused as expected                                |
| 5 featured case file |     2.1 | `/case/2/file` shows VERIFIED                              |
| 6 most wanted        |     0.2 | Daily header rendered from cache                           |

Glitches: none. Console/page errors: none. All four turns decoded on the first attempt; no retry was needed.

## Run 2 — case #15

| Shot                 | Seconds | Note                                                       |
| -------------------- | ------: | ---------------------------------------------------------- |
| 1 title              |     8.0 | Title and "Take the case" ready after state settles        |
| 2 open case          |    27.8 | Prior case abandoned, new case #15 opened; **wait > 25 s** |
| 3 turn 1             |    30.1 | Decoded; **wait > 25 s**                                   |
| 3 turn 2             |    39.1 | Decoded; **wait > 25 s**                                   |
| 3 turn 3             |    51.1 | Decoded; **wait > 25 s**                                   |
| 3 turn 4             |    45.1 | Decoded; **wait > 25 s**                                   |
| 4 secret refusal     |     1.8 | Relayer refused as expected                                |
| 5 featured case file |     2.1 | `/case/2/file` shows VERIFIED                              |
| 6 most wanted        |     0.2 | Daily header rendered from cache                           |

Glitches: none. Console/page errors: none. All four turns decoded on the first attempt.

## Notes for the recording

- Turn latency is dominated by the Sepolia block plus KMS decryption; the dispatch strip shows the real per-step seconds. Editing may trim these waits, but footage must not be sped up; show "waits trimmed" on screen.
- The failed first rehearsal attempt was a harness race (clicking "Take the case" before the active-case lookup settled) and a case-file shot against a still-active case; both were corrected in the rehearsal script, not in the product. No product glitch was found, so no product fix was needed.
- The 8 s title shot is an intentional settle time for automation; the founder can start narration immediately on the visible title.
- Each run used a fresh browser profile and a fresh onchain case; the two runs are independent and reproducible with `E2E_BURNER_KEY` pointing at a funded dev burner.
