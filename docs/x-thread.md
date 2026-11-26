# X thread draft — noescape

Five posts. The founder posts this after H9; the agent does not post, record or generate media. Replace the bracketed video placeholder with the founder's real recording link.

## Post 1 / 5 — identity + video

`noescape` is a manhunt where the fugitive lives inside the encryption. Nobody on Earth knows where it is — not the player, not the chain, not us — yet it runs from you, and every clue it gives is provably true.

Turn-based hidden movement on Sepolia. Three detectives, a 12×10 city, 12 hours to catch it. KMS signatures reveal the whole path at the end and the contract re-checks every move.

Video: [VIDEO LINK — founder to add after H9]

Play it: https://noescape-case.vercel.app

@zama #ZamaDeveloperProgram

## Post 2 / 5 — why it could not exist on a transparent chain

The start and exit are drawn by `FHE.randEuint8` inside the contract. Each turn the AI scores five candidate cells with encrypted noise, encrypted distances and encrypted camera masks, then selects the maximum inside the ciphertext. No branch reads a plaintext position, and no address — including ours — is granted a fugitive handle.

Your Search/Sprint orders are public. The answer is not: NOTHING, COLD or FRESH is user-decrypted only by the detective who searched. `docs/security.md` lists every ACL grant and why it exists.

Live refusal demo: https://noescape-case.vercel.app/secret

## Post 3 / 5 — proof, not a claim

At case close, two fixed KMS batches decrypt the path and every answer. The contract verifies the signatures against stored handles and replays the rules onchain before emitting `CaseVerified`. A forged report, swapped batch or replayed proof fails.

Featured case #2 was played through the production UI and verified onchain: https://noescape-case.vercel.app/case/2/file

The independent local replay and every transaction is in `docs/proof.md`: https://github.com/PhiBao/noescape/blob/main/docs/proof.md

## Post 4 / 5 — daily Most Wanted

Same secret fugitive for everyone each UTC day, with private intel: your stamps are encrypted to you, while only your detective's position is public. Entry and payout use confidential cUSDT (ERC-7984) transfers, and an underfunded entry is recorded as unpaid rather than sneaking in for free.

The two diagrams in the README show the full ACL table and one encrypted turn: https://github.com/PhiBao/noescape/blob/main/README.md

## Post 5 / 5 — feedback wanted

Built Nov 24–Dec 14 2026 as a Sepolia prototype with AI coding agents working from a written plan. unaudited, testnet only, and deliberately slow in places — the UI shows real elapsed seconds instead of hiding them.

We would love feedback on: does the encrypted AI feel like a worthy opponent? Are the worded stamps convincing? How should a confidential daily bounty be presented?

This project is not audited, endorsed or operated by Zama. Use at your own risk.
