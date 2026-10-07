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
- **Transaction fee calculator** — the mainnet minimum fee from the protocol
  formula (44 lovelace/byte × transaction size + 155,381 lovelace, parameters
  verified live via Koios for epoch 660), in exact BigInt lovelace maths.
  Labelled as the size-based floor: script execution and reference-script
  costs come on top.
- **Pool ID converter** — converts a stake pool ID between its 56-character
  hex form and its bech32 (`pool1…`) form, locally and offline, with full
  bech32 checksum verification on the way back.
- **Asset fingerprint (CIP-14)** — computes a native asset's user-facing
  `asset1…` fingerprint from its policy ID + asset-name hex: bech32 over
  blake2b-160 of the concatenated bytes, locally and offline (a pure-JS
  BLAKE2b proven against all eight official CIP-14 test vectors). One-way
  by design — a fingerprint cannot be reversed to the policy ID and name.
- **Datum & script hashes** — a datum hash (blake2b-256 of the datum's CBOR
  bytes) and script hashes (blake2b-224 of the language tag + script bytes:
  native, PlutusV1/V2/V3 — for a minting script the hash is its policy ID),
  computed locally from hex input. The shared pure-JS BLAKE2b is now the
  general multi-block form, cross-checked against Python `hashlib.blake2b`
  for digest sizes 20/28/32/64 and inputs up to 1,000 bytes.
- **Key hashes & address builder** — the blake2b-224 key hash of a public
  payment/stake verification key, and the addresses built from key hashes
  (CIP-19 layout): base, enterprise and reward, mainnet or testnet, locally
  and offline. Key-hash maths cross-checked against Python
  `hashlib.blake2b`; the builder is proven end-to-end by rebuilding a real
  wallet-generated mainnet address byte-for-byte from its key hashes.
  Public verification keys only — never a private/signing key.
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
