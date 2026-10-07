# Getting started building on Cardano

The resources I actually use, in the order I'd learn them. Every link below was
checked live when this guide was written.

## 1. Learn the model first

Cardano is a UTXO chain — transactions consume and create UTXOs, and fees and
validity are deterministic. That one fact explains most of how Cardano dApps
differ from Ethereum ones.

- Developer portal: https://developers.cardano.org/
- Official docs: https://docs.cardano.org/

## 2. Get a wallet and testnet ADA

- Lace (IOG's wallet): https://www.lace.io/
- Work on **Preprod** or **Preview** testnets first. The testnet faucet is
  linked from https://docs.cardano.org/ (Cardano Testnets → Tools → Faucet).
  Testnet ADA has no value — never pay for it.

## 3. Read chain data without running a node

- **Koios** — free, community-run REST API: https://koios.rest/
- **Blockfrost** — hosted API with a free tier: https://blockfrost.io/

PRISM (in this hub's catalogue) reads live chain data from Koios if you want a
working example.

## 4. Build transactions in the browser

- **MeshJS** — TypeScript SDK and CIP-30 wallet integration: https://meshjs.dev/

## 5. Write smart contracts

- **Aiken** — the modern functional language for Cardano validators, with the
  best developer experience in the ecosystem: https://aiken-lang.org/
- Plutus (Haskell) is the original route; Aiken compiles to the same
  Plutus Core. PlutusShield's validators (catalogued here) are Aiken.

## Ground rules I build by

- Testnet first, always. Label testnet software as testnet software.
- Verify addresses character-for-character — use the address inspector on the
  [Cardano4All hub](https://kshot3000.github.io/Cardano4all/) (it verifies the
  bech32 checksum locally).
- 1 ADA = 1,000,000 lovelace. Do money maths in integers (BigInt), never floats.

---

By Kyle Cox (@kshot9000) · Cardano4All: https://github.com/Kshot3000/Cardano4all
ADA donations: addr1q8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpqjae44v
