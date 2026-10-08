# Cardano4All — Cardano 4 All

Builder hub for the **Cardano blockchain** — open-source apps, tools and guides,
built and maintained by Kyle Cox (@kshot9000).

**Live hub:** https://kshot3000.github.io/Cardano4all/

> Tagging the Cardano team: @cardano-foundation @IntersectMBO — this is an
> independent community builder hub for the Cardano ecosystem (16 catalogued
> projects, 5 live sites at launch). Team feedback and corrections welcome.

## What is Cardano?

Cardano is a proof-of-stake Layer-1 blockchain built on an extended-UTXO model:
transactions are deterministic — you know the fee and whether a transaction
will validate before you submit it. Its native token is ADA (1 ADA =
1,000,000 lovelace). Smart contracts are written in Aiken or Plutus, governance
is on-chain under CIP-1694, and Midnight is its privacy partner chain.

- Official site: https://cardano.org/
- Developer portal: https://developers.cardano.org/
- This builder repo: https://github.com/Kshot3000/Cardano4all

## Flagship projects (live)

| Project | Status | What it is |
|---|---|---|
| [NightDream](https://nightdream.xyz/) | ✅ live | Cardano analytics desk — live charts, DEX liquidity, CIP-30 portfolios, Midnight/NIGHT desk with DUST calculator. ([source](https://github.com/Kshot3000/nightdream.xyz)) |
| [PRISM — CIP-113 Studio](https://kshot3000.github.io/Grok-CIP-113/) | ✅ live | CIP-113 programmable-token design/research studio: token rules, exact BigInt transfer modelling, CIP-30 read-only wallet connect, live Koios explorer. Design/research only — no minting or signing. ([source](https://github.com/Kshot3000/Grok-CIP-113)) |
| [PlutusShield](https://kshot3000.github.io/PlutusShield/) | ✅ live | Cardano Preview + Midnight Preprod DeFi/smart-contract insurance — Aiken validators, Compact registry, SDK, oracle relay. Testnet only, unaudited. ([source](https://github.com/Kshot3000/PlutusShield)) |
| [Adadrome](https://kshot3000.github.io/Adadrome/) | ✅ live | ve(3,3) DEX on Cardano with concentrated liquidity — demo front-end. ([source](https://github.com/Kshot3000/Adadrome)) |
| [Night Messenger](https://kshot3000.github.io/Night-Messenger-/) | ✅ live | Private DMs on Midnight with selective disclosure (web + Android). ([source](https://github.com/Kshot3000/Night-Messenger-)) |

## Full catalogue

| Repo | What it does |
|---|---|
| [ADA-Staking-Rewards-Tracker](https://github.com/Kshot3000/ADA-Staking-Rewards-Tracker) | Track staking rewards over time |
| [Epoch-Tracker](https://github.com/Kshot3000/Epoch-Tracker) | Tracks epochs and payouts in ADA and CNTs |
| [Sundaeswap-Aggregator](https://github.com/Kshot3000/Sundaeswap-Aggregator) | SundaeSwap aggregator & deposit fixes |
| [MInswap-LP](https://github.com/Kshot3000/MInswap-LP) | Minswap LP trading-fee tracker for farms and pools |
| [Minswap-FIX](https://github.com/Kshot3000/Minswap-FIX) | Minswap security fixes & white-hat audit patches |
| [MInswap-Sec](https://github.com/Kshot3000/MInswap-Sec) | Minswap security research notes |
| [Midnight-GrokBot-Agent](https://github.com/Kshot3000/Midnight-GrokBot-Agent) | Midnight build lab — Compact starters, Lace kit, agent escrow |
| [nocturne](https://github.com/Kshot3000/nocturne) | Private messaging & email on Midnight |
| [Cardano-Midnight-Qwen-Builder](https://github.com/Kshot3000/Cardano-Midnight-Qwen-Builder) | Agent escrow, network monitors, privacy dashboards |
| [Ada](https://github.com/Kshot3000/Ada) | Browser AI agent for the Cardano blockchain |
| [Cardano-Ai-24-7-coder](https://github.com/Kshot3000/Cardano-Ai-24-7-coder) | 24/7 AI coder scanning & building for Cardano |
| [x402-cardano](https://github.com/Kshot3000/x402-cardano) | x402 payments protocol for Cardano (fork, upstream fix work) |

## Tools on the hub (no wallet needed)

- **Address inspector** — verifies the bech32 checksum of any Cardano address
  locally in your browser and identifies payment vs stake, mainnet vs testnet.
- **ADA ⇄ lovelace converter** — exact BigInt conversion, no float rounding.
- **Epoch / slot calculator** — slot ⇄ epoch conversion across the Byron and
  Shelley eras from the fixed mainnet protocol parameters, fully offline.
- **Staking rewards estimator** — modelled rewards at an annual rate you
  assume, split evenly over Cardano's 73 five-day epochs a year and compounded
  per epoch in exact BigInt lovelace maths. An estimate only — not live chain
  data and not a promise of returns.
- **Pool reward split calculator** — how one epoch's pool rewards divide
  between the operator and delegators, by the Shelley ledger's own
  reward-sharing rule: the fixed cost comes out first (if rewards don't
  cover it, the operator takes them all), then the margin on what remains,
  then the rest shared by stake — the operator's own stake included — with
  each share floored to whole lovelace exactly as the ledger floors it,
  in exact BigInt rational maths. Verified against the Cardano
  Foundation reward calculator's published worked example (4,000 ADA
  rewards, 340 ADA cost, 2% margin → operator 413.2 ADA). It divides a
  reward total you supply — it does not predict what a pool will earn.
- **Transaction fee calculator** — the mainnet minimum fee from the protocol
  formula (44 lovelace/byte × transaction size + 155,381 lovelace, parameters
  verified live via Koios for epoch 660), in exact BigInt lovelace maths.
  Labelled as the size-based floor: script execution and reference-script
  costs come on top.
- **Plutus execution cost calculator** — the script part of a transaction's
  fee: the ledger's txscriptfee, ⌈ memory × 0.0577 + steps × 0.0000721 ⌉
  lovelace, with one ceiling over the sum exactly as the ledger defines it
  and exact BigInt rational maths (prices verified live via Koios for
  epoch 660; per-transaction unit caps enforced). It prices execution
  units you supply — measuring a script to find its units is node work.
- **Reference script fee calculator** — the Conway-era charge for using
  reference scripts: their total size priced in 25,600-byte tiers at
  15 lovelace/byte (the live `min_fee_ref_script_cost_per_byte` parameter,
  verified via Koios for epoch 660), each following tier 1.2× the previous
  price, floored once over the exact rational total — the ledger's
  `tierRefScriptFee`. The 204,800-byte per-transaction limit is flagged,
  not silently priced past.
- **Total minimum fee calculator** — the ledger's minimum fee for a whole
  transaction is the exact sum of the three parts above (size fee +
  `txscriptfee` + tiered reference-script fee), so this composes the
  three proven calculators and adds no rounding of its own. Validation
  composes too: any input past a per-transaction protocol limit —
  including reference scripts over 204,800 bytes — is rejected rather
  than priced, since no valid transaction exists to quote.
- **Ledger deposits calculator** — the refundable ADA a transaction
  must put down to register on chain, at the live mainnet protocol
  parameters (verified via Koios for epoch 660): stake credential
  registration 2 ADA (`key_deposit`), new stake pool registration
  500 ADA (`pool_deposit`), DRep registration 500 ADA (`drep_deposit`),
  governance action proposal 100,000 ADA (`gov_action_deposit`) — each
  charged once per registration, totalled exactly. Deposits are not
  fees: they return on deregistration, pool retirement, or when a
  governance action is enacted or expires; updating an existing pool
  charges no new pool deposit.
- **Transaction ID calculator** — a transaction's ID is blake2b-256 of
  its body's CBOR bytes and nothing else, so it is fixed before signing.
  Paste a body's CBOR hex, or a whole transaction's (the array
  `cardano-cli` and wallets emit) and the body is extracted by span —
  never re-serialised, since the hash covers the bytes as transmitted.
  The body is gated on the ledger's required entries (inputs, outputs,
  fee, with their types) so arbitrary CBOR is not mislabelled as a
  transaction. Proven against pycardano 0.19.2, whose `Transaction.id`
  agreed on bodies carrying a TTL, a validity interval start and an
  auxiliary data hash, and on the full transactions wrapping them.
  Inputs are accepted in both serialisations the ledger allows — a
  plain array or a CBOR set (tag 258), the form most mainnet
  transactions use today.
- **Transaction inspector** — paste a transaction or body CBOR hex and
  read what it does: inputs spent, outputs with addresses, lovelace,
  native assets (with CIP-14 fingerprints), datums and reference
  scripts, the declared fee, validity interval, reward withdrawals,
  mints/burns, collateral, required signers and governance entry
  counts. Field numbering follows the Conway ledger CDDL itself
  (script data hash is key 11, collateral 13, reference inputs 18),
  and both ledger output serialisations (Babbage map form, Alonzo
  array form) decode. Proven against pycardano 0.19.2 field-for-field
  on bodies covering every field, and end-to-end on a real mainnet
  Plutus transaction whose computed ID equals its on-chain hash.
  Honest limit: a body names inputs by reference, so their amounts
  are not in the body and no balance check is possible from it.
- **Value decoder** — one output's value CBOR on its own (the form
  `cardano-cli` prints for an output amount): the lovelace plus every
  native asset with policy ID, name, exact BigInt quantity and CIP-14
  fingerprint. Follows the ledger CDDL (`value = coin / [coin,
  multiasset]`), requires positive quantities, and rejects repeated
  policy or asset-name keys — a value is a map, so one asset's
  quantity lives in exactly one entry. Proven against pycardano
  0.19.2's `Value` serialisation: coin-only, the full 45 billion ADA
  supply as one coin, an empty asset name at the uint64-max quantity,
  and a two-policy bundle all decode field-for-field. (Its decode of a
  bare-coin value also surfaced a pycardano quirk: `Value.from_cbor`
  refuses the bare-coin form its own encoder emits.)
- **Transaction output decoder** — one transaction output's CBOR on
  its own: address, lovelace and native assets (with CIP-14
  fingerprints), datum (hash or inline) and reference script, in both
  serialisations the ledger allows (the Babbage map form and the
  Alonzo array form). Stricter than the inspector's internal output
  parser in two deliberate ways: the address must be a Shelley
  payment address (a reward address is not an output address), and
  repeated map keys — output keys, policy IDs or asset names — are
  rejected. Proven against pycardano 0.19.2's `TransactionOutput`
  serialisation: Babbage coin-only, multi-asset with a datum hash, an
  inline Plutus datum, Plutus V2 and native reference scripts, an
  enterprise-address output, and both Alonzo forms all decode
  field-for-field.
- **Mint / burn decoder** — one transaction's mint field CBOR on its
  own (body key 9): every created or destroyed asset with policy ID,
  name, exact signed BigInt quantity, CIP-14 fingerprint and a
  mint/burn label. Follows the Conway CDDL fetched from
  IntersectMBO/cardano-ledger (`mint = {+ policy_id => {+ asset_name
  => nonzero_int64}}`): at least one policy and one asset per policy,
  every quantity a non-zero int64 — positive mints, negative burns —
  and repeated policy or asset-name keys rejected. Proven against
  pycardano 0.19.2's `MultiAsset` serialisation: a pure mint, a pure
  burn, a mixed two-policy mint+burn and both int64 extremes decode
  field-for-field. (Two pycardano behaviours the CDDL overrules,
  recorded here so nobody "fixes" the decoder to match them:
  pycardano serialises an empty `MultiAsset` to the empty map the
  CDDL's `+` forbids in a mint field, and it silently drops
  zero-quantity assets instead of carrying them.)
- **Withdrawals decoder** — one transaction's withdrawals field
  CBOR on its own (body key 5): every reward account with its stake
  credential kind (key or script), network and exact amount, plus
  the total. Follows the Conway CDDL fetched from
  IntersectMBO/cardano-ledger (`withdrawals = {+ reward_account =>
  coin}`, `coin = uint`): at least one entry, repeated accounts
  rejected, and keys must be Shelley reward addresses — a payment
  address is not a reward account, the mirror of the output decoder
  rejecting reward addresses. One deliberate contrast with the mint
  decoder, recorded so nobody "aligns" them: a zero amount is
  accepted here, because this field's rule is plain `coin` where
  the mint field's is `nonzero_int64`. Proven against pycardano
  0.19.2's `Withdrawals` serialisation: a single mainnet key
  withdrawal, a mixed key + script pair, a testnet withdrawal, a
  zero amount and the uint64 maximum decode field-for-field.
- **Minimum-UTxO calculator** — the least ADA a transaction output may
  hold, by the ledger's own rule: (160 + the output's serialised size) ×
  `coins_per_utxo_size` (4,310 lovelace/byte on mainnet, verified live via
  Koios for epoch 660). The output's serialised bytes are constructed
  exactly from the described contents — receiving address, native-asset
  bundle, datum (hash or inline) and reference script (native or Plutus
  V1/V2/V3) — never estimated from counts, and the result is the fixed
  point whose own coin encoding satisfies the rule. Proven against the
  reference implementation pycardano (whose minimum-UTxO function is
  copied from the Haskell ledger): byte-identical serialisations across
  17 output shapes, and each computed minimum passes pycardano's check
  at the minimum and fails one lovelace below it. A plain output to a
  base address needs 978,370 lovelace.
- **Pool ID converter** — converts a stake pool ID between its 56-character
  hex form and its bech32 (`pool1…`) form, locally and offline, with full
  bech32 checksum verification on the way back.
- **Asset fingerprint (CIP-14)** — computes a native asset's user-facing
  `asset1…` fingerprint from its policy ID + asset-name hex: bech32 over
  blake2b-160 of the concatenated bytes, locally and offline (a pure-JS
  BLAKE2b proven against all eight official CIP-14 test vectors). One-way
  by design — a fingerprint cannot be reversed to the policy ID and name.
- **Asset unit decoder** — splits a native asset's API "unit" (the long hex
  string Blockfrost, Koios and `cardano-cli` use: policy ID hex concatenated
  with asset-name hex) back into its policy ID and asset name — the name also
  shown as text when its bytes are readable UTF-8 — and derives the asset's
  CIP-14 fingerprint from the parts, locally and offline. Proven against all
  eight official CIP-14 test vectors in both directions. A fingerprint
  (`asset1…`) is a one-way hash, not a unit, and is rejected.
- **Datum & script hashes** — a datum hash (blake2b-256 of the datum's CBOR
  bytes) and script hashes (blake2b-224 of the language tag + script bytes:
  native, PlutusV1/V2/V3 — for a minting script the hash is its policy ID),
  computed locally from hex input. The shared pure-JS BLAKE2b is now the
  general multi-block form, cross-checked against Python `hashlib.blake2b`
  for digest sizes 20/28/32/64 and inputs up to 1,000 bytes.
- **CBOR / Plutus Data decoder** — reads one CBOR item (RFC 8949) from hex
  back into its structure, locally and offline: the read side of the datum
  hash tool above. Integers decode exactly as BigInt, byte strings render
  as `h'…'`, and Plutus constructors render as `Constr` (tags 121–127 and
  the tag-1280 `[index, fields]` form; bignum tags 2/3 render as the integer
  they encode). Indefinite-length items — the style Plutus Data uses — are
  supported; truncated input, trailing bytes and invalid-UTF-8 text are
  rejected. Proven against the RFC 8949 Appendix A example set and real
  Plutus Data encodings (`d8799f182a182bff` = `Constr 0 [42, 43]`).
  Structure only — it does not validate a datum against a script's schema.
  The decoder recognises all three Plutus constructor tag forms
  (121–127, 1280–1400, and tag 102 wrapping `[index, fields]`).
- **Plutus Data encoder** — the decoder's write side: paste one Plutus
  Data value in the detailed JSON schema (`{"int": …}`, `{"bytes": "…"}`,
  `{"list": […]}`, `{"map": [{"k": …, "v": …}]}`,
  `{"constructor": …, "fields": […]}`) and get its exact CBOR plus its
  datum hash, locally and offline. Integers are exact at any size
  (never read through a float; magnitudes beyond 64 bits use the
  bignum tags), byte strings over 64 bytes are chunked into 64-byte
  pieces as Plutus requires, and constructors use the tag forms above.
  Proven against the reference implementation pycardano: its encodings
  match this encoder's across the test-vector set, it decodes this
  encoder's output back to the identical structure, and the sample
  datum `{"constructor":0,"fields":[{"int":42},{"int":43}]}` encodes to
  `d8799f182a182bff` and hashes to that datum's known hash.
- **Key hashes & address builder** — the blake2b-224 key hash of a public
  payment/stake verification key, and the addresses built from key hashes
  (CIP-19 layout): base, enterprise and reward, mainnet or testnet, locally
  and offline. Key-hash maths cross-checked against Python
  `hashlib.blake2b`; the builder is proven end-to-end by rebuilding a real
  wallet-generated mainnet address byte-for-byte from its key hashes.
  Public verification keys only — never a private/signing key.
- **Address builder — from credential hashes** — builds addresses directly
  from 28-byte credential hashes, where each credential can be a key hash
  or a script hash (CIP-19 types 0–3, 6–7, 14–15): base, enterprise and
  reward, mainnet or testnet, locally and offline. This closes the script
  workflow on one page — hash a Plutus script with the tool above, paste
  its script hash as a script payment credential, and get the enterprise
  script address its funds lock to. Proven byte-for-byte (header ‖ hashes)
  and end-to-end from a real Aiken blueprint: its compiled code hashes to
  the blueprint's published script hashes, and the built script addresses
  decode back to exactly those hashes and credential kinds.
- **Address decoder (CIP-19)** — the builder in reverse: paste any Shelley
  base, pointer, enterprise or reward address to decode its one-byte header
  (type + network), extract the payment and stake credential hashes inside
  it, and derive the related enterprise and reward addresses from the same
  hashes, locally and offline. Proven against a real wallet-generated
  address: decoding it returns exactly its known key hashes and re-derives
  the builder's enterprise/reward outputs. Byron addresses predate the
  header layout and are not decoded.
- **Address hex ⇄ bech32 converter** — the same Shelley address in its two
  wild forms: bech32 (`addr1…` / `stake1…`) for people and explorers, raw
  hex for machines (CIP-30 wallets return addresses as hex; APIs and
  `cardano-cli` accept the hex form). A pure re-encoding of the identical
  payload bytes — header byte + credential hashes — gated on the full
  CIP-19 decode in both directions, so only valid Shelley addresses
  convert. Proven byte-for-byte against a real wallet-generated address
  (its hex form is `01` ‖ payment key hash ‖ stake key hash).
- **Governance ID converter (CIP-129)** — decodes and converts Conway
  governance identifiers: DRep credentials, Constitutional Committee
  hot/cold credentials and governance action IDs (transaction ID + index).
  Accepts the CIP-129 bech32 form (header byte ‖ 28-byte hash), the legacy
  CIP-105 bech32 form (bare hash, `*_script` prefixes for script
  credentials), or the hex payload, and shows both bech32 forms plus the
  header, kind and credential hash. Proven against all five test vectors
  published in CIP-129 itself and against a real DRep's published ID pair
  (the same hash in its CIP-129 and legacy forms, reproduced both ways).
- **Native script — policy ID & script address** — paste a native
  (multisig / timelock) script in the `cardano-cli` JSON form (`sig`,
  `all`, `any`, `atLeast`, `after`, `before`, nesting freely) and get its
  exact ledger CBOR, its policy ID (the script hash a minting script's
  assets live under) and the enterprise script address it locks. Slots
  and counts are handled as exact integers at any size. Every encoding
  and hash is proven against pycardano 0.19.2's NativeScript classes,
  and the derived script address is proven by decoding it back through
  the hub's own CIP-19 address decoder.

## Guides

- [Getting started building on Cardano](guides/getting-started.md) — official
  docs, wallets, testnets and data APIs, in learning order.

## How the hourly builder loop works

1. An hourly loop works this repo: improving, fixing, and building for Cardano —
   correctness first, then new apps and tools, accessibility, performance and
   docs accuracy.
2. Anything shipped is tested (`node tests/test-site.js`) and verified against
   the live GitHub Pages site before it's claimed done. A run that can't produce
   a genuine improvement ships nothing — quiet runs beat mediocre changes.
3. Finished work is committed and pushed to `main` with a descriptive message —
   the commit history is the run log.
4. Every user-facing surface carries the builder's ADA donation address and X
   account, and tags the Cardano team where the platform supports it.

## Support

ADA donations (click-copy on the hub):
`addr1q8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpqjae44v`

Built by Kyle Cox — [@kshot9000 on X](https://x.com/kshot9000) ·
[github.com/Kshot3000](https://github.com/Kshot3000)

*Independent builder project — not affiliated with the Cardano Foundation,
IOG, or Intersect.*
