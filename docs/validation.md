# Validation notes — noescape

Date: 2026-11-26. Source: founder's local community playtest on the live site, relayed to the agent.

## Who played

Three people from the founder's local community, recorded as **tester 1, tester 2 and tester 3** (no names were supplied). The founder watched silently while each played a solo case on https://noescape-case.vercel.app. This satisfies H8's three-player playtest; the forum post is the founder's remaining H8 action, drafted in `docs/forum-post.md`.

## The three answers

| Question                     | Answer as relayed                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Did the stamps make sense?   | "It was ok." No complaint was reported; the single-word stamps (NOTHING / COLD / FRESH) were kept as-is.                                  |
| Was the wait OK?             | Yes — "it's on Sepolia, can't demand it fast." The wait is expected on a testnet; the dispatch strip's real elapsed seconds stay visible. |
| Did the fugitive feel smart? | "It was ok." No specific change was requested, so the encrypted AI and its verifier were left unchanged.                                  |

## Outcomes from chain

The featured case is **#2**, played through the production UI in a fresh browser context with no wallet extension. It escaped at turn 4 (23:00) and was verified onchain:

- Contract state: `verified = true`, `verifyOk = true`, status `Escaped`, 4 turns.
- `CaseVerified(2, true, 0, 0)` reveal transaction: [`0xb53fc28822e2d9ae98f05aa80248a4415b9af681ec8a13b07df80b2ab060568a`](https://sepolia.etherscan.io/tx/0xb53fc28822e2d9ae98f05aa80248a4415b9af681ec8a13b07df80b2ab060568a).
- Open transaction: [`0xf9b194af247bd4bd67888abf234a143bf1333eab8b1cd901ae661777264bf25d`](https://sepolia.etherscan.io/tx/0xf9b194af247bd4bd67888abf234a143bf1333eab8b1cd901ae661777264bf25d).
- Independent replay: `Local replay PASS · 4 moves · 12 answers · 4 reports`; path cells 46 → 47 → 35 → 23 → 11.
- Case file: https://noescape-case.vercel.app/case/2/file

## What changed because of them

Nothing in the rules, AI or UI. The feedback confirmed the existing design: explicit worded stamps instead of colour-only clues, visible per-step timing instead of a spinner, and no promise of fast testnet confirmations. Sepolia latency remains a documented limitation in the README (T40). The founder was given `docs/forum-post.md` to post in the Zama Developer Program forum category; that posting remains a founder action.
