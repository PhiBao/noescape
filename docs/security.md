# Security review — noescape

Scope: `NoEscapeCase.sol`, `MostWanted.sol`, `GasTap.sol`, `apps/web/api/drip.ts`, and the React/web chain layer at commit `HEAD` during T36. Method: source-first review of access control, reentrancy, encrypted-value branching, ACL grants, proof replay, integer bounds and griefing, plus the browser/drip boundary and CSP. No live shared service was probed beyond the already-authorized production headers and preview gameplay.

## Summary

| Severity            | Open findings                   |
| ------------------- | ------------------------------- |
| High                | 0                               |
| Medium              | 0                               |
| Low / informational | 4 accepted residual notes below |

No interface, storage layout, rules constants or dependency changes were needed. Fixes from this review are in T36 (`apps/web/vercel.json`, this document) and T35 (`apps/web/api/drip.ts`, `apps/web/src/chain/errors.ts`).

## Contract review

### NoEscapeCase.sol

- **Access control.** `openCase` rejects a second active case for `msg.sender` (`NoEscapeCase.sol:130-132`). `playTurn` and `abandonCase` require `msg.sender == cases[id].detective` (`:263`, `:354`). `resolveReport`, `submitReveal` and views are intentionally permissionless after end; they only mutate one-time flags or read state.
- **Reentrancy.** The contract makes no ETH or token external call. State is written before events. No reentrancy path exists.
- **Encrypted branching.** FHE work uses `FHE.and/ne/or/eq/select` and `FugitiveBrain` (`:179-210`); all Solidity `if` statements inspect only plaintext status, flags, turn numbers and fixed bounds. No branch reads an encrypted value.
- **ACL grants.** `openCase` grants `allowThis` on start/pos/p1/p2/trail/exit (`:162-167`). `_runTurn` grants `allowThis` on codes/reward handles/noise and `allow(code, detective)` only to the case detective (`:201-217`). `_makeRevealPublic` publishes only start, exit, per-turn position, noise and searched codes after `_end` (`:307-321`). No fugitive handle is ever granted to an address. This matches A§7.6 and is asserted by the mock ACL tests.
- **Proof replay.** `_resolveReport` returns early when `tr.resolved` (`:280`), checks signatures against the stored unique report handle (`:283`) and then records the clear once. `submitReveal` checks both fixed-order batches (`:472-473`) and uses one-time `verified` state. Old proofs cannot be replayed for a different handle.
- **Bounds/griefing.** `turn` stops at `CityMapData.TURNS` (`:266`); report status is masked to two bits; `validOrders` rejects unreachable/shared/non-walkable destinations; abandoning is counted in stats and frees the active slot (`:339-343`). Anyone may resolve or reveal a finished case, which is intended and cannot change the outcome.
- **Finding:** none High/Medium. **Informational:** permissionless resolve/reveal is safe because outcomes are KMS-proved and one-time.

### MostWanted.sol

- **Access control.** `join` and `hunt` require `hunterOf[day][msg.sender].joined`; `hunt` enforces one action per `watchNo` (`:331-335`). `claimCapture` accepts any caller but pays `action.hunter`, never the caller (`:388`, `:395`), so front-running cannot steal the bounty. `closeDay` requires the UTC day to have ended (`:409`).
- **Reentrancy.** External calls are only official `IERC7984` token calls. In `join`, `confidentialTransferFrom` returns an encrypted value that is checked with `FHE.eq` before pot update; in `claimCapture`, status, winner and rollover are written before `confidentialTransfer` (`:386-395`). The token is the verified cUSDTMock wrapper from spike C, not attacker-controlled.
- **Encrypted branching.** Capture/paid/secret-exit decisions use `FHE.ne/select/eq` (`:344-350`, `:390-391`). Solidity conditions read only plaintext status, joined flag, watch and bounds.
- **ACL grants.** Contract-owned handles receive `allowThis`; search codes are granted to the acting hunter only (`:347-348`); payout gets `allowTransient` for the token (`:394`). Public decryption is limited to the per-watch camera report and capture flags (`:280`, `:350`) and, at close, path/noise/codes/caught handles (`:356-368`). No fugitive handle is granted to a player.
- **Proof replay.** `claimCapture` checks the signature against `action.caught` (`:383`) and the day becomes `STATUS_CAUGHT`, so a second call reverts `DayOver`. Daily reveal parts are KMS-checked with per-part start/kind tracking (`:581`).
- **Bounds/griefing.** Hunter count is capped at 64, steps at 48, watch at 48 half-hours, and `hunterNo` is `uint16` plus a fresh public exitless case each UTC day. Each join pays a fee and `paid = eq(sent, FEE)` prevents free entry (spike C). Sybils cost one fee each; allowed by D36.
- **Finding:** none High/Medium. **Low (accepted):** anyone can close/verify a day, but the result is KMS-bound and immutable; this is a liveness benefit, not a trust issue.

### GasTap.sol

- **Access control.** `drip` is `onlyOperator whenNotPaused` (`:96`); all configuration and withdrawal are `onlyOwner` (`:116-153`). The operator key is gas-only and separate from the owner key (D28).
- **Reentrancy.** `drip` writes `lastDrip` and `_spentToday` before `to.call` (`:107-110`). The recipient is chosen by the operator, not by an untrusted caller; a reentrant call would see the updated cooldown/cap. `withdraw` is owner-only and holds no further state.
- **Bounds.** `setDrip` ≤ 0.02 ETH and `setDailyCap` ≤ 1 ETH (`:124`, `:132`); one UTC-day cooldown, balance check and daily cap bound drain even if the operator key leaks.
- **Finding:** none High/Medium. **Low (accepted):** the owner can withdraw the whole tap balance; this is the documented owner capability and the owner key is held by the founder.

## Drip function and frontend

- `apps/web/api/drip.ts` validates `isAddress`, verifies Turnstile `action=drip`, checks the hostname (or an explicitly registered `.vercel.app` preview), simulates before writing, maps custom errors to 400/403/409/429/503, and logs only address, outcome and tx hash. The Turnstile secret, operator key and RPC URL come from Vercel env and are never logged. T35 fixed nested `DailyCapReached` message mapping.
- No `dangerouslySetInnerHTML`, `eval`, `new Function` or `innerHTML` usage exists under `apps/web/src`. The only `<style>` is a static Most Wanted map rule. The burner key stays in `localStorage` and is never sent to a server; copy/import are explicit user actions on `/record`.
- Third-party browser origins are limited to the Turnstile script/frame, the allowlisted RPC endpoints and the Zama relayer. The CSP below enforces this.

**Informational:** Cloudflare rejects `*.vercel.app` in the widget hostname allowlist, so preview hostnames are registered explicitly (D31a). This is an operational step, not a code finding.

## Headers

`apps/web/vercel.json` now sets:

- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com`; `worker-src 'self' blob:`; `connect-src` limited to self, `data:` (FHEVM SDK's data-URL WASM feature probe, no external origin), Chainstack Sepolia, publicnode Sepolia, `relayer.testnet.zama.org` and Cloudflare; `frame-src https://challenges.cloudflare.com`; `img-src 'self' data:`; `style-src 'self' 'unsafe-inline'`; `font-src 'self' data:`; plus `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, USB and MIDI.

`data:` is allowed in `font-src` because Vite inlines the Fontsource subsets as data URLs, and in `connect-src` because the FHEVM SDK probes `fetch('data:text/plain;base64,YQ==')` to choose its WASM loader (no external network origin is added). No other scheme or host is allowed.

Production header check and a full preview case are recorded in the T26/T36 evidence notes; no Open High or Medium findings remain.
