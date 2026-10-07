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
