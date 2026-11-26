# Trust model — noescape

This is the human-readable companion to [docs/security.md](security.md) and the two diagrams embedded in the README.

## What the game trusts

| Trusted thing                                   | Why                                                                                                 | What happens if it fails                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Zama KMS threshold signatures                   | Only a threshold of signers can produce a valid decryption proof; no single party holds the secret. | `FHE.checkSignatures` rejects the proof, so state is not changed. The case stays encrypted.                           |
| FHEVM coprocessor / `@fhevm/solidity` semantics | Encrypted handles, ACLs and `FHE.select` behave as specified by the protocol.                       | The onchain replay checks every path step and answer at close; a mismatch emits a fail code rather than a false pass. |
| Relayer availability                            | Required to submit decryption/permit requests and fetch clear values.                               | A turn is retryable and resumable; the UI shows real elapsed seconds and an explicit error. No plaintext is invented. |
| Sepolia finality                                | Transactions and events are the published record.                                                   | Reorgs are handled by normal client re-reads; receipts are waited on before decoding.                                 |
| Cloudflare Turnstile                            | Bot check for the one-per-day gas drip.                                                             | A rejected challenge blocks only the drip, never gameplay for an already-funded badge.                                |

## What the game does not need you to trust

- **The developers.** No address, including the deployer and the GasTap operator, is granted a fugitive handle while a case is open. `/secret` demonstrates the relayer's real refusal, and ACL tests assert that the detective, another signer and the deployer all fail user decryption.
- **The server.** The only server component is a Vercel function that verifies Turnstile and calls `GasTap.drip`. It never sees game state, handles, clear values or player keys.
- **Other players.** Search codes are granted only to the acting detective; in Most Wanted, each hunter sees only their own stamps while positions are public moves.
- **The browser.** Orders are validated again onchain, and the contract replays the whole case with KMS-signed cleartexts before emitting `CaseVerified`. A modified client cannot forge a clue or a move.
- **The burner key.** It holds only drip gas and test cUSDT; it lives in the player's `localStorage`, is never uploaded, and is not an account credential.

## Boundary summary

The contract is the single authority. Players send plaintext orders and receive only handles they are allowed to decrypt. The KMS is the only source of clear values, and its proofs are checked against stored handles in fixed order. The encrypted AI runs entirely inside the contract, so the fugitive's position never appears in storage as plaintext, in an event, in a revert message or in a server log.

## Known limits

The relayer can be slow on Sepolia; KMS availability is a liveness dependency, not a confidentiality risk. The contracts are unaudited and deployed only to Sepolia. The GasTap operator can spend only the capped daily drip amount; withdrawal is owner-only and the owner key is held by the founder.
