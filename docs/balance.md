# Balance — noescape

## Method

The simulator uses the same TypeScript map, masks, brain, turn order and search encoding as the product. It is deterministic: each run uses a 32-bit linear congruential generator seeded from the CLI.

- 1,000 cases per row, seed `1`.
- The fugitive's start index and secret exit are drawn uniformly. AI noise is drawn uniformly from 0–7.
- Each bot keeps 600 weighted particles. A particle carries a possible current cell, path history and secret-exit hypothesis.
- Initial particles cover the eight legal starts and four exits uniformly.
- After each non-terminal turn, particles inconsistent with the detective destinations, decrypted search codes, public camera report, or an escape under their exit hypothesis are removed.
- Fewer than 200 surviving particles are resampled back to 600. An empty filter reseeds uniformly over all 83 walkable cells.
- Both bots choose each detective's destination to maximise `Σ weight / (1 + distance)` over particle cells, plus `5 × weight` for particles on the destination. Destinations are distinct and every detective searches.
- The naive bot advances particles by a uniformly random legal step or stay. The expert bot advances them with the real `brainStep` policy and freshly sampled noise, while retaining each particle's exit hypothesis.
- The random-walk fugitive uses the same uniform legal-step control as the naive particles.

## Final table

Weights were not tuned: the settled defaults meet every required band.

| Fugitive     | Detective bot | Caught | Escaped |  Dawn | Avg capture turn |
| ------------ | ------------- | -----: | ------: | ----: | ---------------: |
| Encrypted AI | Naive         |  51.1% |   28.9% | 20.0% |             7.49 |
| Encrypted AI | Expert        |  73.1% |   25.6% |  1.3% |             7.18 |
| Random walk  | Naive         |  75.6% |    1.1% | 23.3% |             6.38 |

Chosen weights: `W_SAFE=16`, `W_FAR=8`, `W_TOWARD=8`, `W_UNSEEN=4`, noise bound `8`.

## Required bands

| Band                                                  |                     Result | Status |
| ----------------------------------------------------- | -------------------------: | ------ |
| Naive × AI caught 45–65%                              |                      51.1% | PASS   |
| Expert × AI caught 55–75%                             |                      73.1% | PASS   |
| Naive × random caught at least naive × AI + 15 points |    75.6% vs 66.1% required | PASS   |
| AI escaped share 15–40%                               | 28.9% naive / 25.6% expert | PASS   |
| Average AI capture turn at least 6.5                  |   7.49 naive / 7.18 expert | PASS   |

`packages/engine/test/sim.test.ts` runs 200 cases per row with seed `7` and the percentage bands widened by ±5 points.

## Reproduce

```sh
pnpm -F engine sim -- --cases 1000 --seed 1 --bot naive --fugitive ai
pnpm -F engine sim -- --cases 1000 --seed 1 --bot expert --fugitive ai
pnpm -F engine sim -- --cases 1000 --seed 1 --bot naive --fugitive random
pnpm -F engine test
```
