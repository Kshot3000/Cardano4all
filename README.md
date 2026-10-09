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
- **Transaction outputs decoder** — a whole outputs field's CBOR on
  its own (body key 1): every output a transaction creates, in the
  order encoded and numbered from 0 (an output's position is the
  index every later reference to it uses), with the field's exact
  BigInt lovelace total. The field is a plain list
  (`[* transaction_output]`), and the decoder follows the list
  semantics exactly: the same output twice decodes as two outputs
  (it is not a set like inputs, nor a map like mint), and the
  empty list decodes — the grammar admits it, the ledger's UTxO
  rules require non-empty inputs only (there is no outputs
  counterpart to `InputSetEmptyUTxO`), and pycardano serialises a
  body carrying `01 80`; value conservation still leaves an empty
  field no room in a real transaction. Each entry passes the
  output decoder's gates unchanged through the shared
  `parseTxOutNode`, and one failing entry refuses the whole field.
  Proven against pycardano 0.19.2's `TransactionBody`
  serialisations (fields extracted by span, re-wrapped and read
  back by the oracle; each output's format read off its emitted
  bytes — pycardano serialises body outputs in the array form
  whenever one fits it, the map form only when a Babbage field
  requires it): a single output, a mixed pair, a rich triple
  (inline datum, Plutus V2 reference script, enterprise address),
  a duplicated output, the empty-field probe, and the outputs of
  a real mainnet transaction (three outputs totalling
  318,675,542,791 lovelace).
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
- **Transaction inputs decoder** — one transaction's inputs field
  CBOR on its own (body key 0): every UTxO reference the transaction
  spends, in the familiar `transaction-ID#index` form, in the order
  encoded. Follows the Conway CDDL fetched from
  IntersectMBO/cardano-ledger (`transaction_input = [transaction_id,
  index]`, `transaction_id = hash32`, index a `uint .size 2`), and
  the field's set form in both serialisations the CDDL allows — a
  plain array or CBOR set tag 258. Repeated references are rejected
  (the field is a set), an empty set is rejected (a transaction must
  spend at least one output — a long-standing ledger rule, restated
  in CIP-0031), and an index above 65,535 is rejected even though
  pycardano serialises one: the CDDL's `.size 2` governs the range
  and the oracle only proves byte shapes, the same split as the mint
  decoder. Proven against pycardano 0.19.2's `TransactionBody`
  serialisation: a single input, two inputs including the index
  maximum, the same pair in the other order, and the tag-258 set
  form of the pair all decode field-for-field.
- **Required signers decoder** — one transaction's required
  signers field CBOR on its own (body key 14): every key hash the
  transaction declares must sign it, in the order encoded. Follows
  the Conway CDDL fetched from IntersectMBO/cardano-ledger
  (`required_signers = nonempty_set<addr_keyhash>`,
  `addr_keyhash = hash28`, `nonempty_set<a> = #6.258([+ a]) /
  [+ a]`): at least one entry, every hash exactly 28 bytes,
  repeated hashes rejected, and both serialisations decode.
  Two pycardano behaviours the CDDL overrules, recorded here so
  nobody "fixes" the decoder to match them: pycardano serialises
  an empty `required_signers` list to `80` with the field present,
  where the grammar's `[+ a]` forbids an empty set outright; and
  it serialises a duplicated hash twice and reads it back as two
  entries, where a set carries each hash once. (On the 28-byte
  size the two agree: pycardano's `VerificationKeyHash` asserts
  it too.) One contrast with the inputs decoder, recorded for the
  same reason: the inputs field is a plain `set<>`, so its empty
  rejection rests on the must-spend-a-UTxO validity rule — this
  field's rests on the grammar itself. Proven against pycardano
  0.19.2's `TransactionBody` serialisation: a single signer, two
  signers, three signers in a non-sorted order, and the tag-258
  set form of the pair all decode field-for-field.
- **Reference inputs decoder** — one transaction's reference
  inputs field CBOR on its own (body key 18): every UTxO the
  transaction reads without spending (CIP-31), in the familiar
  `transaction-ID#index` form, in the order encoded. The entry
  shape is the inputs decoder's (`transaction_input =
  [transaction_id, index]`, `transaction_id = hash32`, index a
  `uint .size 2`), but the field rule differs in one word, recorded
  here so nobody "aligns" the two: the Conway CDDL fetched from
  IntersectMBO/cardano-ledger makes this field a
  `nonempty_set<transaction_input>` (`#6.258([+ a]) / [+ a]`), so
  an empty field is rejected by the grammar itself — where the
  inputs field is a plain `set<>` and its empty rejection rests on
  the separate must-spend-a-UTxO validity rule. Repeated references
  are likewise rejected (a set; the same transaction ID at a
  different index is a different reference), and an index above
  65,535 is rejected per the `.size 2`. Two of those gates
  overrule pycardano, which serialises an empty reference-inputs
  list to `80` with the field present, a duplicated reference
  twice (reading it back as two entries), and an index of 65,536
  happily: the CDDL governs cardinality, ranges and set semantics,
  the oracle only proves byte shapes, the same split as the mint
  decoder. Proven against pycardano 0.19.2's `TransactionBody`
  serialisation: a single reference, two references including the
  index maximum, the same pair in the other order, the same
  transaction ID at two indices, and the tag-258 set form of the
  pair all decode field-for-field.
- **Collateral inputs decoder** — one transaction's collateral
  field CBOR on its own (body key 13): the UTxOs a script
  transaction puts at risk — untouched if its Plutus scripts pass,
  taken as the fee if one fails — in the familiar
  `transaction-ID#index` form, in the order encoded. The entry
  shape is the inputs decoder's (`transaction_input =
  [transaction_id, index]`, `transaction_id = hash32`, index a
  `uint .size 2`), and the field rule is the Conway CDDL's
  `nonempty_set<transaction_input>` (`#6.258([+ a]) / [+ a]`), so
  an empty field is rejected by the grammar itself and repeated
  references are rejected (a set; the same transaction ID at a
  different index is a different reference). This field carries
  one gate no sibling field has, recorded here so nobody removes
  it as an inconsistency: at most **3 entries**, under the live
  protocol parameter `max_collateral_inputs` (the ledger's
  TooManyCollateralInputs validity rule), verified via Koios
  `epoch_params` for epoch 660 — re-verify it there before
  changing the constant, because governance can move it. All four
  gates overrule pycardano, which serialises an empty collateral
  list to `80` with the field present, a duplicated reference
  twice (reading it back as two entries), an index of 65,536, and
  even four collateral inputs (reading them back as four): the
  CDDL and the live protocol parameters govern cardinality,
  ranges and set semantics, the oracle only proves byte shapes,
  the same split as the mint decoder. Proven against pycardano
  0.19.2's `TransactionBody` serialisation: a single entry, three
  entries at the cap including the index maximum and the same
  transaction ID at two indices, the same three in the other
  order, and the tag-258 set form of the three all decode
  field-for-field.
- **Certificates decoder** — one transaction's certificates
  field CBOR on its own (body key 4): the stake, pool, committee
  and DRep actions a transaction carries, in the order encoded.
  The Conway CDDL's field rule is `certificates =
  nonempty_oset<certificate>` (`#6.258([+ a]) / [+ a]`) — an
  ordered set — and all seventeen Conway certificate types
  decode (0–4, 7–18): account registration / unregistration
  (plain and with-deposit forms), delegation to a stake pool
  and/or a DRep, pool registration and retirement, the combined
  registration-and-delegation forms, committee authorisation and
  resignation, and DRep registration / unregistration / update.
  Credentials are `[0, addr_keyhash]` or `[1, script_hash]`; a
  DRep is a key hash, a script hash, `[2]` (always abstain) or
  `[3]` (always no confidence) — the constant DReps carry no hash,
  so a hash after a 2 or 3 is rejected; anchors are
  `[url ≤ 128 bytes, hash32]` or nil; deposits and refunds are
  exact coins. A pool registration decodes the full `pool_params`
  group in place: operator, VRF key hash, pledge, cost, the
  margin as a `unit_interval` (CBOR tag 30 over
  `[numerator, denominator]`, denominator above zero and
  numerator at most the denominator, per the CDDL's own comment),
  the reward account (a 29-byte reward address, header type
  14/15 — also shown in bech32), the owners (a set of key hashes,
  plain or tag-258 form, no repeats), all three relay kinds
  (ports ≤ 65,535, IPv4/IPv6 byte strings of exactly 4/16 bytes,
  DNS names ≤ 128 bytes) and the metadata pointer. Two gates
  overrule the oracle, recorded here so nobody "aligns" them
  away: the empty set and a duplicated certificate are both
  rejected even though pycardano serialises an empty certificates
  list to `80` with the field present and the same certificate
  twice (reading it back as two) — the field is an ordered set,
  and the CDDL governs cardinality and set semantics while the
  oracle only proves byte shapes, the same split as the mint
  decoder. Types 5 and 6 (genesis / MIR certificates) do not
  exist in the Conway CDDL and are rejected. One oracle quirk is
  also recorded: pycardano reads its own type-16 DRep
  registration back as a list nested inside the ordered set —
  its encoding is byte-identical to the CDDL form and round-trips
  exactly, which is what the proof asserts. Proven against
  pycardano 0.19.2's `TransactionBody` serialisation
  (whole-body round-trip asserted byte-for-byte in the
  generator): every one of the seventeen types on its own —
  including a full pool registration with five relays of all
  three kinds, two owners and metadata, and a minimal one with
  no owners, relays or metadata — a three-certificate
  combination in encoded order, and the tag-258 ordered-set
  form of it all decode field-for-field.
- **Voting procedures decoder** — one transaction's voting
  procedures field CBOR on its own (body key 19): who voted on
  which governance actions, and how, in the order encoded. The
  Conway CDDL's field rule is `voting_procedures =
  {+ voter => {+ gov_action_id => voting_procedure}}` — both
  maps are non-empty. A voter is `[code, hash28]`: 0 = committee
  hot key hash, 1 = committee hot script hash, 2 = DRep key
  hash, 3 = DRep script hash, 4 = stake pool key hash (a pool
  voter is a key hash only — there is no script form). A
  governance action ID is `[transaction_id: hash32,
  gov_action_index: uint .size 2]`, and a voting procedure is
  `[vote, anchor / nil]` with vote 0 = no, 1 = yes, 2 = abstain
  and the anchor `[url ≤ 128 bytes, hash32]` or nil. Map
  semantics are enforced at both levels: the same voter twice,
  or the same action twice under one voter, is rejected — the
  same action under different voters is the normal case and
  decodes. One gate overrules the oracle, recorded here so
  nobody "aligns" it away: the empty map is rejected even
  though pycardano serialises an empty `VotingProcedures` to
  `a0` with the field present — the CDDL's `{+ }` grammar
  governs emptiness while the oracle only proves byte shapes,
  the same split as the mint decoder. On the index range the
  two authorities agree: pycardano's `GovActionId` itself
  raises above 65,535. Note also that pycardano's dict
  serialiser emits map keys in canonical encoded-byte order,
  not insertion order; this decoder preserves the encoded
  order it is given. Proven against pycardano 0.19.2's
  `TransactionBody` serialisation (whole-body round-trip
  asserted byte-for-byte in the generator): a DRep key-hash
  yes vote with no anchor, a committee hot script-hash no vote
  with an anchor at action index 65,535, a stake pool abstain,
  and a two-voter map in which one DRep votes on two actions
  and a committee member votes on one of the same actions
  decode field-for-field.
- **Governance proposals decoder** — one transaction's proposals
  field CBOR on its own (body key 20): the governance actions
  the transaction proposes, in the order encoded. The Conway
  CDDL's field rule is `proposal_procedures =
  nonempty_oset<proposal_procedure>` — a non-empty ordered
  set, plain array or CBOR set tag 258 (pycardano emits the
  tag form); the same proposal twice is rejected. Each
  proposal is `[deposit, reward_account, gov_action,
  anchor]`: the deposit (returned to the reward account,
  shown as the 29-byte reward address in bech32 with the
  same gate as the withdrawals decoder), the action, and an
  anchor that is required here (a URL of at most 128 bytes
  and its data hash). All seven actions decode: info (the
  one-element array `[6]`), no confidence, hard fork
  initiation (protocol version `[major 0..12, minor]`),
  parameter change, treasury withdrawals (per-account
  amounts and an exact total; the map may be empty per the
  CDDL's `{*}`), committee update (cold credentials to
  remove as a set, additions with their expiry epochs, and
  the quorum as a unit interval) and new constitution —
  each naming its previous governance action
  (`[hash32, index .size 2]`) or none, and a guardrails
  script hash where the action carries one. A parameter
  change validates every named update: keys must be a
  subset of 0–11 and 16–33 (keys 12–15 do not exist in the
  Conway update, and a repeated key is rejected), sized
  integers are range-checked (`.size 2` / `.size 4`),
  intervals are CBOR tag 30 with the CDDL's own unit
  interval constraints (denominator above zero, numerator
  at most the denominator; a nonnegative interval's
  numerator may exceed it), cost models map a language byte
  0–255 to int64 values, execution prices are a pair of
  nonnegative intervals, execution-unit caps run to
  max_int64, and the threshold arrays hold exactly 5 (pool)
  and 10 (DRep) unit intervals. An empty update map decodes
  (every key in the CDDL map is optional; pycardano emits
  `a0` for one too). Four oracle divergences are recorded
  here so nobody "aligns" them away: pycardano 0.19.2
  cannot represent a hard fork initiation action at all —
  its `protocol_version` field is mistyped as a Fraction
  (construction validates against the pair form,
  serialisation validates against Fraction, parsing a real
  `[major, minor]` array raises) and its stale range check
  would refuse majors 0 and 11–12 — so that vector is built
  from the CDDL text and the decoder follows the CDDL's
  0..12. Its validator crashes on a cost-models update (a
  bare `Dict` type hint), so that vector is CDDL-built too;
  and it emits a new-constitution proposal it cannot parse
  back (its tuple restore path raises), so that vector is
  proven encoder-side plus CDDL. The empty field and an
  anchor URL over 128 bytes are both rejected even though
  pycardano emits them (`d90102 80`, a 149-byte URL) — the
  CDDL governs cardinality and sizes, the oracle only proves
  byte shapes, the same split as the mint decoder. On the
  previous-action index the authorities agree: pycardano's
  `GovActionId` itself raises above 65,535. Proven against
  pycardano 0.19.2's `TransactionBody` serialisation
  (whole-body round-trip asserted byte-for-byte in the
  generator): an info action, a no-confidence motion with a
  previous action, a fifteen-field parameter change
  including both threshold arrays and the live execution
  prices, a minimal parameter change, treasury withdrawals
  over two accounts, a committee update, and a two-proposal
  field in encoded order decode field-for-field, alongside
  the CDDL-built hard-fork and cost-models vectors.
- **Auxiliary data decoder** — one transaction's auxiliary
  data block on its own: the metadata and auxiliary scripts
  carried beside the body (the body commits only to this
  block's blake2b-256 hash at key 7, and the decode shows
  that hash so the two can be matched). All three Conway
  CDDL forms decode: a bare metadata map, the Shelley-era
  array `[metadata, [* native_script]]`, and the Alonzo-era
  map under CBOR tag 259 (`? 0` metadata, `? 1` native
  scripts, `? 2/3/4` Plutus V1/V2/V3 scripts — every key
  optional, no key repeated, no other key admitted). A
  metadatum is a map, a list, an integer, or a byte or text
  string of at most 64 bytes, nested freely — the two size
  caps are the ledger's, and pycardano 0.19.2 agrees for
  once (it raises on a 65-byte string of either kind).
  Labels are `uint .size 8` per the CDDL (the ledger type
  is Word64) and a repeated label is rejected; two oracle
  divergences are recorded here so nobody "aligns" them
  away: pycardano serialises a negative label (`a1 20 01`)
  and a bignum label the ledger cannot hold, so the CDDL
  governs labels. Integer values are the ledger's
  arbitrary-precision Integer, so the bignum forms (CBOR
  tags 2 and 3) decode to their exact decimal — the
  oracle emits those too. Native scripts decode
  recursively (sig / all / any / atLeast — the count is
  not capped at the list length, the CDDL states no such
  bound and the oracle serialises 5-of-1 — after /
  before), and every script, native or Plutus, is shown
  with its script hash: blake2b-224 of the language tag
  byte followed by the script's exact serialised bytes,
  recovered from the parse spans for native scripts,
  never re-serialised. Proven against pycardano 0.19.2's
  `AuxiliaryData` serialisation (round-trip asserted in
  the generator): bare metadata, empty metadata, the
  Shelley array, the full Alonzo map (metadata, a
  timelock and all three Plutus versions), a scripts-only
  Alonzo map and a metadata-only one decode
  field-for-field, with native script hashes matching
  pycardano's own and Plutus hashes cross-checked against
  hashlib's blake2b-224.
- **Token metadata viewer (CIP-25 / CIP-27)** — the
  auxiliary data decoder above shows label 721 as raw
  CBOR; this tool interprets it. Paste transaction
  metadata (the bare map, or an auxiliary data block in
  any of its three serialisations — the metadata must
  satisfy the ledger's metadatum grammar the decoder
  above enforces: strings of at most 64 bytes, no
  repeated map key) and the CIP-25 token metadata is
  read out per policy and asset: `name` and `image`
  (both required by the CIP), `mediaType`, `description`,
  the `files` list (whose entries require `mediaType`
  and `src`), and any further properties, rendered.
  Every string property may be one text string or an
  array of text chunks, rejoined here — a 103-character
  royalty address as a single string is refused, as the
  ledger itself would refuse it, because chunking is
  the only legal form. Version 1 (the policy ID as a
  56-character hex text key, asset names as text) and
  version 2 (both as raw bytes; the version sits at the
  721 level as an integer or a "1.0"-style text) both
  decode. Label 777 is read as CIP-27 royalties: the
  `rate` — a decimal string in [0, 1] — and the `addr`
  it is paid to, the rate also shown as a percentage
  computed from the string with exact decimal
  arithmetic, never a float. The one deliberate
  divergence from the sibling decoders' strictness,
  recorded here so nobody "aligns" it away: structural
  violations (a non-map where a map belongs, a policy
  key that is not a policy ID, a rate that is not a
  decimal fraction) refuse the whole input, but a
  MISSING required property (an asset with no `name`
  or no `image`, an image with no URI scheme) is
  reported as a warning on the asset instead of a
  refusal — real mints omit them, and a viewer that
  refuses real metadata helps nobody. Proven against
  vectors built with cbor2 from the CIP-25 / CIP-27
  texts (both versions, chunked strings, a combined
  721 + 777 + 674 map in all three input forms, and
  the warnings cases), with the rejection set beside
  them (a 55-character policy key, a rate above 1, an
  integer rate, an integer image, a 65-byte string,
  version 3, a non-map files entry, a repeated label).
  One honest limit on the proof: a sweep of 150
  consecutive mainnet blocks (October 2026) found no
  label-721 metadata at all — new mints have largely
  moved to CIP-68 datums — so the interpretation layer
  rests on the CIP texts themselves, and the real-chain
  vector in the suite is a current mainnet auxiliary
  data block (label 674, cross-checked against Koios's
  own rendering) proving the extraction layer against
  the chain as it is today.
- **CIP-68 datum metadata viewer** — the successor
  standard to the CIP-25 viewer above, and the one new
  mints actually use: the metadata lives in the inline
  datum of a reference NFT's output, as Plutus data of
  the form Constr 0 `[metadata, version, extra]`.
  Paste that datum (an output's inline datum is exactly
  what explorers and Koios show) and, optionally, the
  asset name of the reference NFT or the user token.
  The datum must first satisfy the hub's Plutus data
  grammar (byte strings of at most 64 bytes, the
  ledger's bounded_bytes), be constructor 0 with
  exactly three fields, and carry a non-negative
  integer version — anything else refuses. The
  metadata field then decodes three ways, all from the
  CIP-68 text: a direct property map (the 222 NFT,
  333 FT and 444 RFT standards) read out property by
  property — byte-string keys as text, integer values
  exact, a byte-string list rejoined as one URI, the
  `files` list expanded with its own entries, nested
  values rendered as Plutus data; the version-4
  nested form, whose only key is the byte string
  "721", unpacked per policy ID and asset name; and
  the generic form (a list, an integer or a byte
  string where a map could be), shown uninterpreted.
  The extra field — the issuer's own script data,
  required to be present and at least Unit — is
  rendered as Plutus data, never interpreted. The
  same strictness split as the CIP-25 viewer, recorded
  so nobody "aligns" it away: structural violations
  (a two-field datum, constructor 1, a text or
  negative version, a non-byte-string or repeated
  property key) refuse the input, while a missing
  `name` or `image`/`logo` property — and a files
  entry without `mediaType` or `src` — is a warning
  on the asset, because real datums omit them. The
  asset name, when given, is read as a CIP-67 label:
  the 4-byte prefix `[0000 | 16-bit label | CRC-8
  checksum | 0000]` is decoded and the checksum
  (CRC-8, polynomial 0x07, over the two label bytes)
  is verified before the label is believed — 100 is
  the reference NFT, 222 the NFT user token, 333 the
  FT and 444 the RFT class — and the matching
  reference NFT name (label 100 over the same name
  content) is computed, which is the lookup the CIP
  prescribes. Proven against the CIP-67 text's own
  fourteen prefix vectors (0 to 65535, checksums
  included), pycardano 0.19.2 serialisations that
  round-trip byte-for-byte (222 direct with files,
  333 direct, 444 with an integer extra field, the
  version-4 nested map, both generic forms), the
  rejection set beside them, and one real mainnet
  datum: the inline datum of an ADA Handle reference
  NFT (policy f0ff48bb…, name (100)heptasean, fetched
  via Koios from the UTxO that still holds it — its
  eleven direct properties, its version, its map
  extra field and the (222) user token's label,
  checksum and reference name all read off the chain
  artefact itself).
- **Transaction witness set decoder** — one transaction's
  witness set on its own, the second element of every
  transaction: the signatures and scripts that authorise
  the body. Conway CDDL `transaction_witness_set` — every
  key optional (an empty set `a0` decodes; a script-only
  transaction legitimately carries no key witness), no key
  repeated, no other key admitted. Key witnesses show the
  key, its blake2b-224 key hash (the hash addresses and
  bodies actually name) and the 64-byte signature — the
  two sizes are the CDDL's, overruling pycardano 0.19.2,
  which serialises a 63-byte signature happily. Native
  scripts decode recursively with hashes over their exact
  serialised bytes. Bootstrap (Byron-era) witnesses decode
  as `[public_key, signature, chain_code, attributes]` —
  the last two are plain `bytes` in the Shelley, Babbage
  and Conway CDDL texts, so no size is imposed; pycardano
  0.19.2 has no bootstrap class at all (its field is
  `List[Any]` with a TODO in the source), so that vector
  is built from the CDDL text and proven by the oracle's
  own `from_cbor` round-trip. Plutus V1/V2/V3 scripts sit
  in `nonempty_set`s, so a repeated script is rejected —
  the oracle serialises the same V2 script twice — while
  the list-held sections keep duplicates, as the grammar
  says. Plutus data must be real `plutus_data`
  (constructors, maps, lists, integers including the
  bignum forms, byte strings of at most 64 bytes) and
  each datum is shown with its datum hash, blake2b-256
  over its exact bytes. Redeemers decode in both
  serialisations — the legacy array and the Conway map
  (repeated keys rejected) — with tags 0–5 (spend, mint,
  cert, reward, voting, proposing), indices held to
  `uint .size 4` and ex-units to `0..max_int64`, all
  overruling the oracle, which serialises an index of
  2^32 and a negative memory value. Signatures are shown
  as carried, never verified — that needs the body too.
  Proven against pycardano 0.19.2's
  `TransactionWitnessSet` serialisations (round-trip
  asserted in the generator) and a real mainnet witness
  set (from the Plutus transaction the inspector tests
  carry, fetched via Koios), whose key hash matches its
  body's required signer.
- **Redeemers decoder** — a standalone redeemers field on
  its own (witness set key 5): the instructions a
  transaction gives its Plutus scripts — which script runs,
  on what, with what data and what execution budget. Conway
  CDDL `redeemers = [+ redeemer] /
  {+ [tag, index] => [data, ex_units]}`, redeemer_tag 0–5
  (spend, mint, cert, reward, voting, proposing), index
  `uint .size 4`, data `plutus_data`, ex-units each
  `0..max_int64`; both forms must name at least one
  redeemer. The two forms differ in exactly one semantic:
  the array form is a list, so the same redeemer twice
  decodes as two entries (the oracle serialises it so),
  while the map form is keyed by `[tag, index]`, so a
  repeated key is rejected. The remaining gates overrule
  the oracle (probed in the generator): pycardano 0.19.2
  serialises an empty redeemer list with the field present
  (`a10580`), an index of 2^32 and a negative ex-unit —
  all rejected here per the CDDL. Each datum is shown
  rendered plus its datum hash, blake2b-256 of its exact
  bytes. Validation reuses the proven witness set decoder
  via a synthetic one-key witness set — the script data
  hash calculator's seam — so there is no second redeemer
  gate to drift; a whole witness set pasted here is
  refused (its map keys are integers, not `[tag, index]`
  pairs). Whether an index points at a real input, policy
  or voter needs the body too — that is the full
  transaction decoder's cross-check below. Proven against
  pycardano 0.19.2's `TransactionWitnessSet` serialisations
  (each field extracted by span from a whole witness set,
  re-wrapped and read back by the oracle in the
  generator): a single redeemer, the two-entry array form,
  the same redeemer twice, the range extremes (proposing
  tag, index 2^32−1, ex-units at max_int64), the two-entry
  map form, a bignum (2^70) datum in map form, and the
  redeemers of a real mainnet transaction (the Plutus
  transaction the witness tests carry, fetched via
  Koios — spend #0 and #1 plus reward #0, budgets and
  datum hashes read off the oracle's parse).
- **Plutus data decoder** — a standalone Plutus data field
  on its own (witness set key 4): the datums a transaction
  carries in its witness set for its scripts to consume.
  Conway CDDL: the field is `nonempty_set<plutus_data>` —
  tag 258 or a plain array (pycardano emits the plain form;
  the chain also carries tag-258 sets over indefinite
  arrays), at least one entry, each entry a real
  `plutus_data`: a constructor, a map, a list, an integer
  (bignum tags included) or a byte string of at most 64
  bytes. An empty field, a 65-byte byte string and a text
  string are all rejected — the last two overrule the
  oracle, which serialises both when handed them as raw
  CBOR (probed in the generator), and pycardano serialises
  an empty field too (`a10480`). One recorded wire fact:
  the field is a set, but the same datum can appear twice
  on the wire (the oracle serialises a duplicate twice) and
  the decoder shows entries exactly as encoded, in encoded
  order. Each datum is shown rendered plus its datum hash,
  blake2b-256 over its exact bytes — the hash an output
  carries when it references a datum instead of inlining
  it. Validation reuses the proven witness set decoder via
  a synthetic one-key witness set — the redeemers
  decoder's seam — so there is no second datum gate to
  drift; a whole witness set or a single bare datum pasted
  here is refused. Proven against pycardano 0.19.2's
  `TransactionWitnessSet` serialisations (each field
  extracted by span from a whole witness set, re-wrapped
  and read back by the oracle in the generator): a plain
  integer, a bounded byte string, a Constr datum, a
  five-entry mix, both bignum signs, and the Plutus data
  of a real mainnet transaction (fetched via Koios, block
  14043871 — a tag-258 indefinite set holding two Constr
  datums; the stored inspector transaction's witness set
  carries no datums, its outputs use inline datums).
- **Key witnesses decoder** — a standalone key witnesses
  field on its own (witness set key 0): the ordinary
  Shelley key signatures that authorise a transaction's
  inputs. Conway CDDL: the field is
  `nonempty_list<vkeywitness>` — tag 258 or a plain array,
  at least one entry — and a vkeywitness is
  `[vkey, signature]` with the vkey exactly 32 bytes and
  the signature exactly 64. The field is a LIST, not a
  set, so the same witness twice decodes as two entries
  (pycardano serialises a duplicated witness twice and
  reads it back as two, probed in the generator) — the
  same treatment the witness set decoder gives key 0. The
  remaining gates overrule the oracle, also probed:
  pycardano 0.19.2 serialises an empty field (`a10080`), a
  63-byte signature and a 31-byte vkey; all three are
  refused here per the CDDL. Each witness is shown with
  its key hash, blake2b-224 of the vkey — the hash a
  body's required signer list (key 14) names. Validation
  reuses the proven witness set decoder via a synthetic
  one-key witness set (`a100` ‖ field), the seam the
  redeemers and Plutus data decoders use, so there is no
  second witness gate to drift; a whole witness set or a
  single bare witness pasted here is refused. Proven
  against pycardano 0.19.2's `TransactionWitnessSet`
  serialisations (each field extracted from a whole
  witness set, re-wrapped as `{0: field}` and read back
  by the oracle in the generator): a single witness, a
  two-witness field, the same witness twice, the tag-258
  form, and a real mainnet field extracted by span from
  the stored witness set — one witness in tag-258 form
  whose key hash is its body's required signer.
  Signatures are shown, never cryptographically verified.
- **Native scripts decoder** — a standalone native scripts
  field on its own (witness set key 1): the multisig and
  timelock scripts that authorise script-address inputs
  and native-script minting policies. Conway CDDL: the
  field is `nonempty_list<native_script>` — tag 258 or a
  plain array, at least one entry — and a native script
  is `[0, addr_keyhash]` (the hash exactly 28 bytes),
  `[1, [* native_script]]` all, `[2, [* native_script]]`
  any, `[3, n, [* native_script]]` at least n, or a
  timelock `[4, slot]` / `[5, slot]` (CDDL
  script_invalid_before / script_invalid_hereafter, shown
  as "after" / "before" — the naming the hub's builder
  and sibling decoders use). Scripts nest freely; every
  script is shown with its script hash, blake2b-224 over
  the 0x00 language byte and its exact span bytes — for a
  minting script, its policy ID. The field is a LIST, so
  the same script twice decodes as two entries (pycardano
  serialises a duplicate twice and reads it back as two).
  Child lists may be empty and atLeast states no
  n ≤ children bound (5-of-1 decodes) — the grammar's
  `[* native_script]` states neither. The gates that
  overrule the oracle, probed in the generator: an empty
  field is refused though pycardano serialises one
  (`a10180`), and a negative atLeast threshold or
  timelock slot is refused though pycardano serialises
  and reads back both (a threshold is a count, a slot is
  a slot; both sibling decoders gate the same way). On
  code 6 and a 27-byte signature hash the authorities
  agree — both are refused, and the oracle cannot read
  the first back or construct the second. Validation
  reuses the proven witness set decoder via a synthetic
  one-key witness set (`a101` ‖ field), the seam the
  redeemers, Plutus data and key witnesses decoders use;
  a whole witness set or a single bare script pasted
  here is refused. Proven against pycardano 0.19.2's
  `TransactionWitnessSet` serialisations (each field
  extracted from a whole witness set, re-wrapped as
  `{1: field}` and read back by the oracle in the
  generator): a single signature script, a signature
  plus an all, a nested script exercising every code
  with oracle hashes at every level, the same script
  twice, the tag-258 form, an empty all and a 5-of-1
  atLeast — and a real mainnet field decodes
  hash-for-hash (tx `87a7ac8b…`, block 14044379, fetched
  via Koios: its key-1 field arrives in tag-258 form
  holding one script, `all(sig 207655f9…, before
  215122509)`, script hash `06b85d3e…`). The hunt is
  recorded because it measures the field's rarity: two
  Koios sweeps span-walked 3,444 recent mainnet witness
  sets (the walker verified exact against the stored
  real witness set; 2,584 sets carried key 0 alone) and
  found exactly one key-1 field — current traffic
  authorises almost entirely with key witnesses and
  Plutus scripts. Scripts are decoded, never evaluated
  — satisfaction needs the transaction around them.
- **Full transaction decoder** — a whole transaction on its
  own: the four-element Conway array `[body, witness_set,
  is_valid, auxiliary_data / nil]` (the three-element form
  without the flag decodes too). The three proven decoders
  above are composed over the array elements' exact byte
  spans, and the parts are then checked against each other —
  the checks only a whole transaction makes possible: the
  auxiliary data's blake2b-256 against the hash the body
  commits to at key 7 (match, mismatch, declared-but-absent,
  attached-but-undeclared); every required signer (key 14)
  against the key hashes of the key and bootstrap witnesses
  present; every output datum hash against the Plutus data
  in the witness set; and every redeemer index against the
  count of inputs, mint policies, certificates, withdrawals,
  voters or proposals it can point at (indices address the
  ledger's canonically ordered lists, so this is a range
  check, not a mapping). Strictness composes: any part
  failing its own decoder's gates refuses the whole
  transaction. Proven against pycardano 0.19.2 full
  `Transaction` serialisations (oracle `from_cbor`
  round-trip asserted in the generator): witnessed and
  unwitnessed required signers, all four auxiliary-hash
  states, the is-valid flag false, datum and redeemer checks
  passing and failing in the expected places; the legacy
  form and an over-cap auxiliary block are byte-assembled
  from oracle parts. A real mainnet Plutus transaction (the
  one the inspector and witness tests carry, fetched via
  Koios) decodes end-to-end with its auxiliary hash matching
  and its required signer witnessed. Stated on the page:
  signatures are not cryptographically verified and the
  script data hash is not recomputed there — the languages
  a transaction runs are not all visible inside it; the
  calculator below does that job. The checks are structural.
- **Script data hash calculator** — the blake2b-256 a
  transaction body commits to at key 11 whenever it runs
  Plutus scripts: blake2b-256(redeemers ‖ datums ‖ language
  views) over the parts exactly as serialised. The redeemers
  (witness key 5, either serialisation — they hash
  differently) and the Plutus data (key 4) are pasted as
  their own CBOR and validated by the witness decoder's
  gates first; the language views are built from the current
  mainnet cost models (Koios `epoch_params` epoch 660,
  protocol version 11: Plutus V1 332, V2 332, V3 350 values;
  V3 carries four negative values, encoded as signed CBOR).
  The ledger's asymmetries are built in: absent datums
  contribute zero bytes while absent redeemers contribute
  the empty map, no redeemers means empty views whatever is
  ticked, and Plutus V1 enters under its preserved
  historical encoding (byte-string key holding uint 0,
  byte-string value holding the indefinite-length array —
  the language-view bug kept for compatibility,
  cardano-ledger#2512). Proven against pycardano 0.19.2's
  `script_data_hash` driven by the live cost models (V2 and
  V3, array- and map-form redeemers, the empty and
  datums-only defaults) and against the chain itself: the
  redeemer bytes of a real mainnet Plutus transaction with
  V2 ticked reproduce its body key 11 exactly. One caveat,
  recorded plainly: pycardano's bundled V1 cost model is a
  stale 166-value snapshot, so the V1 values are the live
  parameters from the same Koios channel that proved V2 on
  chain, and only the V1 encoding form comes from the
  oracle's code.
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
