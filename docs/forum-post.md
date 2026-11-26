# noescape — forum introduction

**Title: noescape — a manhunt where the fugitive hides inside encryption**

Intro (≈150 words):

`noescape` is a turn-based manhunt on Sepolia. Encrypted randomness creates a fugitive that moves each turn under a small AI computed over ciphertext. Nobody can read its position during a case — not the player, operator, or us. Three detectives search; every clue is true and decryptable only by the right detective: NOTHING, COLD, FRESH. At capture or dawn, KMS signatures decrypt the whole path and the contract replays every move and answer onchain before emitting `CaseVerified`. The daily Most Wanted case adds private intel and a confidential cUSDT bounty paid with ERC-7984 transfers. Every answer is checked again when the case closes. No backend knows the secret; the game works only because the fugitive stays encrypted. Try the demo, watch a verified case file, and read the proof and security notes linked below. This is a Sepolia prototype, not audited or endorsed by Zama. Use at your own risk.

Links:

- Live demo: https://noescape-case.vercel.app
- Source: https://github.com/PhiBao/noescape
- Verified featured case: https://noescape-case.vercel.app/case/2/file
- Proof and transactions: https://github.com/PhiBao/noescape/blob/main/docs/proof.md
- Security model: https://github.com/PhiBao/noescape/blob/main/docs/security.md
- Overview of what is encrypted: https://noescape-case.vercel.app/secret

Feedback wanted on:

1. Does the fugitive's encrypted AI feel like a worthy opponent, or is it too predictable after a few turns?
2. Are the search clues and the onchain replay convincing without needing to trust the developer?
3. How should a confidential daily case with private intel and a hidden pot be presented to players?
4. Is the turn latency acceptable for a demo on a testnet, and where would you want progress feedback?

Tags: @zama #ZamaDeveloperProgram
