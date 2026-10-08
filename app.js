"use strict";
/* Cardano4All hub logic: project filtering, bech32 address inspector,
   exact ADA <-> lovelace conversion. Pure functions are exported for tests. */

var BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values) {
  var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  var chk = 1;
  for (var i = 0; i < values.length; i++) {
    var top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[i];
    for (var j = 0; j < 5; j++) {
      if ((top >> j) & 1) chk ^= GEN[j];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  var out = [];
  for (var i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (var j = 0; j < hrp.length; j++) out.push(hrp.charCodeAt(j) & 31);
  return out;
}

/* Returns {valid:true, hrp} or {valid:false, reason}. Verifies the bech32
   checksum (BIP-173 polymod == 1); Cardano uses the original bech32, not bech32m. */
function verifyBech32(str) {
  if (typeof str !== "string") return { valid: false, reason: "not text" };
  var s = str.trim();
  if (s.length < 8 || s.length > 1083) return { valid: false, reason: "unusual length" };
  var lower = s.toLowerCase();
  if (s !== lower && s !== s.toUpperCase()) return { valid: false, reason: "mixed case" };
  s = lower;
  var pos = s.lastIndexOf("1");
  if (pos < 1 || pos + 7 > s.length) return { valid: false, reason: "no bech32 separator" };
  var hrp = s.slice(0, pos);
  var dataPart = s.slice(pos + 1);
  var values = [];
  for (var i = 0; i < dataPart.length; i++) {
    var v = BECH32_CHARSET.indexOf(dataPart[i]);
    if (v === -1) return { valid: false, reason: "character outside the bech32 charset" };
    values.push(v);
  }
  var polymod = bech32Polymod(bech32HrpExpand(hrp).concat(values));
  if (polymod !== 1) return { valid: false, reason: "checksum mismatch" };
  return { valid: true, hrp: hrp };
}

function bech32CreateChecksum(hrp, dataValues) {
  var values = bech32HrpExpand(hrp).concat(dataValues).concat([0, 0, 0, 0, 0, 0]);
  var polymod = bech32Polymod(values) ^ 1;
  var out = [];
  for (var i = 0; i < 6; i++) out.push((polymod >> (5 * (5 - i))) & 31);
  return out;
}

function bech32Encode(hrp, dataValues) {
  var combined = dataValues.concat(bech32CreateChecksum(hrp, dataValues));
  var out = hrp + "1";
  for (var i = 0; i < combined.length; i++) out += BECH32_CHARSET[combined[i]];
  return out;
}

var ADDRESS_TYPES = [
  { hrp: "addr", label: "Payment address", network: "mainnet" },
  { hrp: "addr_test", label: "Payment address", network: "testnet" },
  { hrp: "stake", label: "Stake / reward address", network: "mainnet" },
  { hrp: "stake_test", label: "Stake / reward address", network: "testnet" }
];

function inspectAddress(raw) {
  var s = (raw || "").trim();
  if (!s) return { ok: false, message: "Paste an address first." };
  var check = verifyBech32(s);
  if (!check.valid) {
    return { ok: false, message: "Not a valid bech32 address: " + check.reason + "." };
  }
  for (var i = 0; i < ADDRESS_TYPES.length; i++) {
    if (check.hrp === ADDRESS_TYPES[i].hrp) {
      return {
        ok: true,
        message: ADDRESS_TYPES[i].label + " · " + ADDRESS_TYPES[i].network +
          " · bech32 checksum valid. Always double-check the full address before sending funds."
      };
    }
  }
  return { ok: true, message: "Valid bech32 (human-readable part '" + check.hrp + "'), but not a recognised Cardano payment or stake address prefix." };
}

/* Exact conversions using BigInt. ADA strings may have up to 6 decimals. */
function adaToLovelace(adaStr) {
  var s = (adaStr || "").trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) return null;
  var parts = s.split(".");
  var whole = BigInt(parts[0]);
  var frac = BigInt(((parts[1] || "") + "000000").slice(0, 6));
  return (whole * 1000000n + frac).toString();
}

function lovelaceToAda(lovelaceStr) {
  var s = (lovelaceStr || "").trim();
  if (!/^\d+$/.test(s)) return null;
  var v = BigInt(s);
  var whole = v / 1000000n;
  var frac = (v % 1000000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? whole.toString() + "." + frac : whole.toString();
}

/* Cardano mainnet time parameters (protocol constants, not live data).
   Byron era: 21,600 slots/epoch x 20s slots, system start 1506203091
   (2017-09-23 21:44:51 UTC). Shelley began at absolute slot 4,492,800 =
   epoch 208, unix 1596059091 (2020-07-29 21:44:51 UTC) — check:
   1506203091 + 208 x 432,000 = 1596059091. Shelley and later:
   432,000 slots/epoch x 1s slots. Absolute slot numbering is continuous
   across the Byron -> Shelley transition. */
var SYSTEM_START_UNIX = 1506203091;
var BYRON_SLOTS_PER_EPOCH = 21600;
var BYRON_SLOT_SECONDS = 20;
var SHELLEY_START_SLOT = 4492800;
var SHELLEY_START_EPOCH = 208;
var SHELLEY_START_UNIX = 1596059091;
var SLOTS_PER_EPOCH = 432000;
var SLOT_SECONDS = 1;

function parseSlot(raw) {
  var s = (raw || "").trim();
  if (!/^\d+$/.test(s)) return null;
  var v = Number(s);
  return Number.isSafeInteger(v) ? v : null;
}

/* slot -> {era, epoch, slotInEpoch, epochSlots, unixSeconds} or null */
function slotToEpoch(raw) {
  var slot = parseSlot(raw);
  if (slot === null) return null;
  if (slot < SHELLEY_START_SLOT) {
    return {
      slot: slot,
      era: "Byron",
      epoch: Math.floor(slot / BYRON_SLOTS_PER_EPOCH),
      slotInEpoch: slot % BYRON_SLOTS_PER_EPOCH,
      epochSlots: BYRON_SLOTS_PER_EPOCH,
      unixSeconds: SYSTEM_START_UNIX + slot * BYRON_SLOT_SECONDS
    };
  }
  var rel = slot - SHELLEY_START_SLOT;
  return {
    slot: slot,
    era: "Shelley or later",
    epoch: SHELLEY_START_EPOCH + Math.floor(rel / SLOTS_PER_EPOCH),
    slotInEpoch: rel % SLOTS_PER_EPOCH,
    epochSlots: SLOTS_PER_EPOCH,
    unixSeconds: SHELLEY_START_UNIX + rel * SLOT_SECONDS
  };
}

/* epoch -> {slot, unixSeconds} of that epoch's first slot, or null */
function epochStart(raw) {
  var epoch = parseSlot(raw);
  if (epoch === null) return null;
  if (epoch < SHELLEY_START_EPOCH) {
    return {
      slot: epoch * BYRON_SLOTS_PER_EPOCH,
      unixSeconds: SYSTEM_START_UNIX + epoch * BYRON_SLOTS_PER_EPOCH * BYRON_SLOT_SECONDS
    };
  }
  return {
    slot: SHELLEY_START_SLOT + (epoch - SHELLEY_START_EPOCH) * SLOTS_PER_EPOCH,
    unixSeconds: SHELLEY_START_UNIX + (epoch - SHELLEY_START_EPOCH) * SLOTS_PER_EPOCH * SLOT_SECONDS
  };
}

/* Staking rewards estimator — MODELLED maths, not live chain data and not
   a promise of returns. A Cardano epoch is 5 days, so a year holds
   365 / 5 = 73 epochs. The annual rate the user assumes is split evenly
   across those 73 epochs; each epoch's reward is computed in lovelace with
   exact BigInt rational arithmetic (no floats) and added to the stake
   (compounding), truncating any sub-lovelace fraction per epoch, as real
   rewards are paid in whole lovelace. Actual pool rewards vary with pool
   performance, saturation, operator fees and protocol parameters. */
var EPOCHS_PER_YEAR = 73;
var MAX_STAKE_EPOCHS = 3650; /* 50 years of epochs — sanity cap */

/* "3.65" -> { digits: 365n, scale: 2 }; rates above 100% are rejected. */
function parseAnnualRate(raw) {
  var s = (raw || "").trim();
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return null;
  var parts = s.split(".");
  var scale = (parts[1] || "").length;
  var digits = BigInt(parts[0] + (parts[1] || ""));
  if (digits > 100n * (10n ** BigInt(scale))) return null;
  return { digits: digits, scale: scale };
}

/* stakingEstimate(stakeAda, annualRatePercent, epochCount) ->
   { stakeLovelace, firstEpochRewardLovelace, totalRewardLovelace,
     finalLovelace, epochs } (all amounts as decimal strings) or null. */
function stakingEstimate(stakeStr, rateStr, epochsStr) {
  var lovelaceStr = adaToLovelace(stakeStr);
  if (lovelaceStr === null) return null;
  var rate = parseAnnualRate(rateStr);
  if (rate === null) return null;
  var epochs = parseSlot(epochsStr);
  if (epochs === null || epochs < 1 || epochs > MAX_STAKE_EPOCHS) return null;
  /* per-epoch fraction = (digits / 10^scale) percent / 73 epochs a year */
  var den = 100n * (10n ** BigInt(rate.scale)) * BigInt(EPOCHS_PER_YEAR);
  var current = BigInt(lovelaceStr);
  var totalReward = 0n;
  var firstReward = 0n;
  for (var i = 0; i < epochs; i++) {
    var reward = (current * rate.digits) / den;
    if (i === 0) firstReward = reward;
    totalReward += reward;
    current += reward;
  }
  return {
    stakeLovelace: lovelaceStr,
    firstEpochRewardLovelace: firstReward.toString(),
    totalRewardLovelace: totalReward.toString(),
    finalLovelace: current.toString(),
    epochs: epochs
  };
}

/* Pool reward split — the ledger's own reward-sharing rule (Shelley ledger
   calcStakePoolOperatorReward / calcStakePoolMemberReward), applied to ONE
   epoch's pool rewards f, the pool's declared fixed cost and margin, and
   stake amounts. Exact rational BigInt arithmetic with ONE floor per
   recipient, exactly as the ledger floors:
     if f <= cost:  operator gets all of f, every member gets 0
     otherwise:     operator = cost + floor((f - cost) x (m + (1 - m) x owner/total))
                    member   = floor((f - cost) x (1 - m) x member/total)
   where m is the margin as a fraction and owner/member/total are stake
   amounts (their ratio is what matters, so ADA or lovelace both work —
   this tool takes ADA). Verified against the Cardano Foundation reward
   calculator's published worked example: 4,000 ADA rewards, 340 ADA cost,
   2% margin, zero owner stake -> operator 413.2 ADA. This splits a reward
   total the user supplies; it does not predict what a pool will earn —
   the total itself depends on blocks minted, saturation and protocol
   parameters. "others" is the residual (the rest of the members together,
   plus any lovelace the per-member flooring leaves undistributed when the
   ledger pays each member separately). */
/* poolRewardSplit(rewardsAda, costAda, marginPercent, ownerStakeAda,
   totalStakeAda, memberStakeAda) -> { rewardsLovelace, operatorLovelace,
   memberLovelace, othersLovelace } (decimal strings) or null.
   Owner and member stake may be left empty (= 0). */
function poolRewardSplit(rewardsStr, costStr, marginStr, ownerStr, totalStr, memberStr) {
  var fStr = adaToLovelace(rewardsStr);
  var costStrL = adaToLovelace(costStr);
  var totalStrL = adaToLovelace(totalStr);
  if (fStr === null || costStrL === null || totalStrL === null) return null;
  var ownerStrL = (ownerStr || "").trim() === "" ? "0" : adaToLovelace(ownerStr);
  var memberStrL = (memberStr || "").trim() === "" ? "0" : adaToLovelace(memberStr);
  if (ownerStrL === null || memberStrL === null) return null;
  var margin = parseAnnualRate(marginStr); /* a percent parser: 0-100%, up to 4 decimals */
  if (margin === null) return null;
  var f = BigInt(fStr), cost = BigInt(costStrL), total = BigInt(totalStrL);
  var owner = BigInt(ownerStrL), member = BigInt(memberStrL);
  if (total <= 0n || owner > total || member > total - owner) return null;
  var operator, memberOut;
  if (f <= cost) {
    operator = f; memberOut = 0n;
  } else {
    var rest = f - cost;
    var md = 100n * (10n ** BigInt(margin.scale)); /* margin fraction denominator */
    var mn = margin.digits;                        /* margin fraction numerator */
    operator = cost + (rest * (mn * total + (md - mn) * owner)) / (md * total);
    memberOut = (rest * (md - mn) * member) / (md * total);
  }
  return {
    rewardsLovelace: f.toString(),
    operatorLovelace: operator.toString(),
    memberLovelace: memberOut.toString(),
    othersLovelace: (f - operator - memberOut).toString()
  };
}

/* Transaction minimum fee — mainnet protocol parameters, verified against
   the Koios epoch_params endpoint for epoch 660 on 2026-10-07
   (min_fee_a = 44, min_fee_b = 155381, max_tx_size = 16384):
   minFee = min_fee_a x txSizeBytes + min_fee_b, in lovelace, exact BigInt
   arithmetic. This is the size-based minimum only: transactions that run
   Plutus scripts also pay execution-unit costs, and transactions carrying
   reference scripts pay an additional per-byte charge, so real fees for
   script transactions are higher. Wallets may also pay above the minimum. */
var MIN_FEE_A = 44n;
var MIN_FEE_B = 155381n;
var MAX_TX_SIZE = 16384;

/* minFee(txSizeBytes) -> { sizeBytes, feeLovelace } (fee as decimal string)
   or null for empty, fractional, non-numeric, zero or over-max sizes. */
function minFee(sizeStr) {
  var size = parseSlot(sizeStr);
  if (size === null || size < 1 || size > MAX_TX_SIZE) return null;
  return {
    sizeBytes: size,
    feeLovelace: (MIN_FEE_A * BigInt(size) + MIN_FEE_B).toString()
  };
}

/* Plutus execution-unit cost — the script part of the ledger minimum
   fee (the formal ledger specification's minfee adds
   txscriptfee(prices)(total execution units) on top of the size fee):
     txscriptfee = ceil(mem x price_mem + steps x price_step)
   with ONE ceiling over the sum (the ledger definition; ceiling each
   part separately would overcharge — 1 memory unit + 1 step costs
   1 lovelace, not 2). Mainnet prices, verified against the Koios
   epoch_params endpoint for epoch 660 on 2026-10-07:
   price_mem = 0.0577 lovelace/unit = 577/10000,
   price_step = 0.0000721 lovelace/unit = 721/10000000.
   Exact BigInt rational arithmetic on the common denominator 10^7.
   Per-transaction caps are the protocol maxima from the same endpoint
   (max_tx_ex_mem = 16,500,000, max_tx_ex_steps = 10,000,000,000): a
   transaction whose total units exceed them is invalid, so they are
   rejected rather than priced. This prices the units a script is
   budgeted or measured at — evaluating a script to FIND its units is
   node work this offline page does not do. */
var EXUNIT_PRICE_MEM_NUM = 577000n;   /* per 10^7 lovelace */
var EXUNIT_PRICE_STEP_NUM = 721n;     /* per 10^7 lovelace */
var EXUNIT_DEN = 10000000n;
var MAX_TX_EX_MEM = 16500000n;
var MAX_TX_EX_STEPS = 10000000000n;

/* exunitCost(memStr, stepsStr) -> { memUnits, stepUnits, exactLovelace,
   costLovelace } (units and cost as decimal strings; exactLovelace is the
   un-rounded rational total as an exact decimal string) or null for
   empty, fractional, non-numeric or over-cap inputs. */
function exunitCost(memStr, stepsStr) {
  var m = (memStr || "").trim(), s = (stepsStr || "").trim();
  if (!/^\d+$/.test(m) || !/^\d+$/.test(s)) return null;
  var mem = BigInt(m), steps = BigInt(s);
  if (mem > MAX_TX_EX_MEM || steps > MAX_TX_EX_STEPS) return null;
  var num = mem * EXUNIT_PRICE_MEM_NUM + steps * EXUNIT_PRICE_STEP_NUM;
  var cost = (num + EXUNIT_DEN - 1n) / EXUNIT_DEN;
  var whole = num / EXUNIT_DEN, frac = num % EXUNIT_DEN;
  var exact = whole.toString();
  if (frac !== 0n) exact += "." + frac.toString().padStart(7, "0").replace(/0+$/, "");
  return {
    memUnits: mem.toString(),
    stepUnits: steps.toString(),
    exactLovelace: exact,
    costLovelace: cost.toString()
  };
}

/* Reference script fee — the third part of the Conway-era minimum fee
   (ledger eras/conway Tx.hs tierRefScriptFee; design recorded in the
   ledger's ADR 9). A transaction that uses reference scripts pays for
   their TOTAL size (every referenced script counted, duplicates
   included) in tiers of 25,600 bytes: the first tier is priced at the
   protocol parameter min_fee_ref_script_cost_per_byte, and each
   following tier's per-byte price is the previous one multiplied by
   1.2. The floor is applied ONCE, to the final total — the accumulator
   is an exact rational throughout, so a fractional tier followed by
   more bytes is NOT the same as flooring each tier (128,003 bytes
   costs 2,857,686 lovelace; flooring per tier would give 2,857,685).
   Mainnet values, verified against the Koios epoch_params endpoint
   for epoch 660 on 2026-10-07: cost per byte = 15 lovelace (the
   multiplier 6/5 and the 25,600-byte stride are the Conway genesis
   values the ledger carries as governance-set parameters). Hard
   ledger limits: at most 204,800 reference-script bytes per
   transaction and 1,048,576 per block — sizes above the per-block
   limit are rejected here rather than priced. */
var REFSCRIPT_COST_PER_BYTE = 15n;
var REFSCRIPT_TIER_BYTES = 25600n;
var REFSCRIPT_MAX_TX_BYTES = 204800n;
var REFSCRIPT_MAX_BLOCK_BYTES = 1048576n;

/* refScriptFee(sizeStr) -> { sizeBytes, feeLovelace, exactLovelace,
   overTxLimit } (decimal strings; exactLovelace is the un-floored
   total) or null for empty, fractional, non-numeric or
   over-block-limit inputs. Sizes above the per-transaction limit are
   still priced, flagged via overTxLimit, so the cost of an oversize
   draft stays visible. */
function refScriptFee(sizeStr) {
  var s = (sizeStr || "").trim();
  if (!/^\d+$/.test(s)) return null;
  var n = BigInt(s);
  if (n > REFSCRIPT_MAX_BLOCK_BYTES) return null;
  var accNum = 0n, accDen = 1n;      /* exact rational running total */
  var priceNum = REFSCRIPT_COST_PER_BYTE, priceDen = 1n;
  var rem = n;
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a === 0n ? 1n : a; }
  function addTier(bytes) {
    accNum = accNum * priceDen + priceNum * bytes * accDen;
    accDen = accDen * priceDen;
    var g = gcd(accNum, accDen);
    if (g > 1n) { accNum /= g; accDen /= g; }
  }
  while (rem >= REFSCRIPT_TIER_BYTES) {
    addTier(REFSCRIPT_TIER_BYTES);
    priceNum *= 6n; priceDen *= 5n;
    rem -= REFSCRIPT_TIER_BYTES;
  }
  addTier(rem);
  var exact = null;
  var d = accDen, j = 0n;
  while (d % 5n === 0n) { d /= 5n; j++; }
  if (d === 1n) {   /* denominator is a power of 5: exact decimal exists */
    var scaled = (accNum * (2n ** j)).toString();
    if (j === 0n) exact = scaled;
    else {
      scaled = scaled.padStart(Number(j) + 1, "0");
      var cut = scaled.length - Number(j);
      var frac = scaled.slice(cut).replace(/0+$/, "");
      exact = scaled.slice(0, cut) + (frac ? "." + frac : "");
    }
  }
  return {
    sizeBytes: n.toString(),
    feeLovelace: (accNum / accDen).toString(),
    exactLovelace: exact,
    overTxLimit: n > REFSCRIPT_MAX_TX_BYTES
  };
}

/* Total minimum fee — the ledger's minimum fee for a whole transaction
   is the SUM of the three parts above, each already proven on its own
   in this file: the size fee (44 x size + 155,381), the script part
   txscriptfee (one ceiling over mem x price_mem + steps x price_step)
   and, since Conway, the tiered reference-script fee (floored once).
   The formal ledger specification's minfee adds the script fee to the
   size fee, and Conway adds the reference-script charge the same way;
   the rounded parts are all integers by then, so the total is an exact
   integer sum with NO further rounding. This composer adds no maths of
   its own — it exists so the three parts are never added by hand.
   Validation composes strictly: any part that would make the
   transaction invalid makes the total null — including reference
   scripts over the 204,800-byte per-transaction limit (the standalone
   reference-script tool prices those with a warning flag; a total fee
   for a transaction that cannot exist must not be quoted). Zero
   execution units and zero reference-script bytes are the plain
   transaction case and price as 0. */

/* totalTxFee(sizeStr, memStr, stepsStr, refStr) -> { sizeFeeLovelace,
   exunitFeeLovelace, refScriptFeeLovelace, totalLovelace } (decimal
   strings) or null when any part is empty, fractional, non-numeric or
   beyond a per-transaction limit. */
function totalTxFee(sizeStr, memStr, stepsStr, refStr) {
  var sf = minFee(sizeStr);
  if (!sf) return null;
  var ec = exunitCost(memStr, stepsStr);
  if (!ec) return null;
  var rf = refScriptFee(refStr);
  if (!rf || rf.overTxLimit) return null;
  var total = BigInt(sf.feeLovelace) + BigInt(ec.costLovelace) + BigInt(rf.feeLovelace);
  return {
    sizeFeeLovelace: sf.feeLovelace,
    exunitFeeLovelace: ec.costLovelace,
    refScriptFeeLovelace: rf.feeLovelace,
    totalLovelace: total.toString()
  };
}

/* Ledger deposits — the refundable ADA a transaction must put down
   when it registers things on chain (Conway era). Each registration
   or proposal charges its protocol parameter exactly once:
     stake credential registration  stakeAddressDeposit (Koios
                                    key_deposit)    =     2,000,000
     NEW stake pool registration    stakePoolDeposit (Koios
                                    pool_deposit)   =   500,000,000
     DRep registration              dRepDeposit      =   500,000,000
     governance action proposal     govActionDeposit = 100,000,000,000
   lovelace, all verified against the live protocol parameters via
   Koios epoch_params for epoch 660 on 2026-10-07 (the two Conway
   values also match the published Chang-era parameter tables).
   The total is the exact integer sum — no rounding anywhere.
   Deposits are NOT fees: a stake deposit comes back when the
   credential is deregistered, a pool deposit when the pool retires,
   a DRep deposit on deregistration, and a governance action deposit
   when the action is enacted or expires (it is paid to the
   proposal's reward account). Two ledger subtleties the counts must
   respect: re-registering (updating) an EXISTING pool charges no new
   pool deposit, and a delegation certificate on its own charges
   nothing — only registrations and proposals do. Counts are capped
   at 10,000 each as an input sanity bound (not a protocol limit). */
var STAKE_REG_DEPOSIT = 2000000n;
var POOL_REG_DEPOSIT = 500000000n;
var DREP_REG_DEPOSIT = 500000000n;
var GOV_ACTION_DEPOSIT = 100000000000n;
var MAX_DEPOSIT_COUNT = 10000n;

function parseDepositCount(raw) {
  var t = (raw || "").trim();
  if (!/^\d+$/.test(t)) return null;
  var n = BigInt(t);
  return n <= MAX_DEPOSIT_COUNT ? n : null;
}

/* depositTotal(stakeStr, poolStr, drepStr, govStr) -> itemised
   { stakeLovelace, poolLovelace, drepLovelace, govLovelace,
   totalLovelace } as decimal strings, or null for empty, fractional,
   negative, non-numeric or over-cap counts in any field. */
function depositTotal(stakeStr, poolStr, drepStr, govStr) {
  var s = parseDepositCount(stakeStr), p = parseDepositCount(poolStr),
      d = parseDepositCount(drepStr), g = parseDepositCount(govStr);
  if (s === null || p === null || d === null || g === null) return null;
  var stake = s * STAKE_REG_DEPOSIT, pool = p * POOL_REG_DEPOSIT,
      drep = d * DREP_REG_DEPOSIT, gov = g * GOV_ACTION_DEPOSIT;
  return {
    stakeLovelace: stake.toString(),
    poolLovelace: pool.toString(),
    drepLovelace: drep.toString(),
    govLovelace: gov.toString(),
    totalLovelace: (stake + pool + drep + gov).toString()
  };
}

var COINS_PER_UTXO_BYTE = 4310n;
var UTXO_ENTRY_OVERHEAD = 160n;

/* Minimum-UTxO calculator — every transaction output must carry at
   least a minimum amount of ADA, set by the ledger rule (Babbage era,
   Cardano Ledger Babbage/Rules/Utxo.hs getMinCoinTxOut):
     min lovelace = (160 + size) x coinsPerUTxOByte
   where "size" is the length in bytes of the output serialised in the
   current (Babbage) form — the map {0: address bytes, 1: value,
   2: datum option, 3: script reference} — and coinsPerUTxOByte is the
   protocol parameter coins_per_utxo_size = 4310 lovelace/byte on
   mainnet (verified against the live protocol parameters via Koios,
   epoch 660, on 2026-10-07; if governance changes it, minima scale in
   proportion). The coin amount inside the output is itself part of the
   serialisation, so the result is the fixed point: the least lovelace
   amount whose own encoding still satisfies the rule.
   This function CONSTRUCTS the serialised output byte-for-byte from
   the described contents (it does not estimate sizes from counts), so
   asset-name lengths, quantity widths, datum and script bytes all cost
   exactly what they cost on chain. Proven against the reference
   implementation pycardano 0.19.2 (whose min_lovelace_post_alonzo is
   copied from the Haskell ledger): for 17 output shapes — base /
   enterprise / pointer / script addresses, datum hashes, inline
   datums, single- and multi-policy asset bundles, native and Plutus
   v1/v2/v3 reference scripts, and combinations — the constructed
   serialisation is byte-identical to pycardano's, and pycardano
   confirms each computed minimum passes at the minimum and fails one
   lovelace below it. Inputs are validated strictly: the address must
   be a Shelley payment address (reward addresses cannot receive
   outputs), quantities are read as decimal text into BigInt (never
   through a float) and must fit the ledger's uint64, duplicate
   policy+name pairs are rejected, and datum/script payloads are
   capped at the 16,384-byte maximum transaction size. */
function utxoOutputBytes(addrBytes, assetGroups, datum, script, coin) {
  var entries = [], nEntries = 0, i, j, pols, names, ma, inner;
  entries.push(cborHead(0, 0n), cborHead(2, BigInt(addrBytes.length)), addrBytes);
  nEntries++;
  if (assetGroups.length > 0) {
    ma = cborHead(5, BigInt(assetGroups.length));
    for (i = 0; i < assetGroups.length; i++) {
      pols = assetGroups[i];
      ma = ma.concat(cborHead(2, 28n), pols.policyBytes, cborHead(5, BigInt(pols.assets.length)));
      for (j = 0; j < pols.assets.length; j++) {
        ma = ma.concat(cborHead(2, BigInt(pols.assets[j].nameBytes.length)), pols.assets[j].nameBytes,
          cborHead(0, pols.assets[j].quantity));
      }
    }
    entries.push(cborHead(0, 1n), [0x82], cborHead(0, coin), ma);
  } else {
    entries.push(cborHead(0, 1n), cborHead(0, coin));
  }
  nEntries++;
  if (datum !== null) {
    if (datum.kind === "hash") {
      entries.push(cborHead(0, 2n), [0x82, 0x00], cborHead(2, 32n), datum.bytes);
    } else { /* inline: datum option [1, #6.24(bytes .cbor data)] */
      entries.push(cborHead(0, 2n), [0x82, 0x01, 0xd8, 0x18],
        cborHead(2, BigInt(datum.bytes.length)), datum.bytes);
    }
    nEntries++;
  }
  if (script !== null) {
    if (script.kind === "native") { /* script = [0, native script] */
      inner = [0x82, 0x00].concat(script.bytes);
    } else { /* script = [language tag 1/2/3, script bytes] */
      inner = [0x82, script.kind === "plutus1" ? 1 : script.kind === "plutus2" ? 2 : 3]
        .concat(cborHead(2, BigInt(script.bytes.length)), script.bytes);
    }
    entries.push(cborHead(0, 3n), [0xd8, 0x18], cborHead(2, BigInt(inner.length)), inner);
    nEntries++;
  }
  return cborHead(5, BigInt(nEntries)).concat(entries.flat());
}

function cleanHex(raw, maxBytes) {
  var hex = (raw || "").trim().toLowerCase().replace(/^0x/, "").replace(/\s+/g, "");
  if (!/^([0-9a-f]{2})+$/.test(hex)) return null;
  var bytes = hexToBytes(hex);
  return bytes.length <= maxBytes ? bytes : null;
}

/* spec: { address (bech32), assets: [{policy, name, quantity}] with
   policy/name as hex text and quantity as decimal text, datumKind:
   "none"|"hash"|"inline", datumHex, scriptKind: "none"|"native"|
   "plutus1"|"plutus2"|"plutus3", scriptHex }
   -> { lovelace (decimal string), sizeBytes } or null. */
function minUtxo(spec) {
  var addrHex, dec, addrBytes, groups, byPolicy, seen, i, a, polBytes, nameBytes, qty;
  var datum = null, script = null, coin, size, min, iter;
  if (!spec || typeof spec !== "object") return null;
  addrHex = addressToHex(spec.address);
  dec = decodeAddress(spec.address);
  if (addrHex === null || dec === null || dec.type > 7) return null; /* payment addresses only */
  addrBytes = hexToBytes(addrHex);
  groups = []; byPolicy = {}; seen = {};
  var assets = spec.assets || [];
  if (!Array.isArray(assets) || assets.length > 200) return null;
  for (i = 0; i < assets.length; i++) {
    a = assets[i] || {};
    polBytes = cleanHex(a.policy, 28);
    if (polBytes === null || polBytes.length !== 28) return null;
    nameBytes = (a.name || "").trim() === "" ? [] : cleanHex(a.name, 32);
    if (nameBytes === null) return null;
    if (!/^\d+$/.test((a.quantity || "").trim())) return null;
    qty = BigInt((a.quantity || "").trim());
    if (qty < 1n || qty > 18446744073709551615n) return null;
    var key = bytesToHex(polBytes) + "/" + bytesToHex(nameBytes);
    if (seen[key]) return null; /* a value cannot hold the same asset twice */
    seen[key] = true;
    if (!byPolicy[key.slice(0, 56)]) { byPolicy[key.slice(0, 56)] = { policyBytes: polBytes, assets: [] }; groups.push(byPolicy[key.slice(0, 56)]); }
    byPolicy[key.slice(0, 56)].assets.push({ nameBytes: nameBytes, quantity: qty });
  }
  if (spec.datumKind === "hash") {
    var dh = cleanHex(spec.datumHex, 32);
    if (dh === null || dh.length !== 32) return null;
    datum = { kind: "hash", bytes: dh };
  } else if (spec.datumKind === "inline") {
    var db = cleanHex(spec.datumHex, MAX_TX_SIZE);
    if (db === null) return null;
    datum = { kind: "inline", bytes: db };
  } else if (spec.datumKind !== undefined && spec.datumKind !== "none") return null;
  if (spec.scriptKind === "native" || spec.scriptKind === "plutus1" ||
      spec.scriptKind === "plutus2" || spec.scriptKind === "plutus3") {
    var sb = cleanHex(spec.scriptHex, MAX_TX_SIZE);
    if (sb === null) return null;
    script = { kind: spec.scriptKind, bytes: sb };
  } else if (spec.scriptKind !== undefined && spec.scriptKind !== "none") return null;
  coin = 1000000n;
  for (iter = 0; iter < 10; iter++) {
    size = utxoOutputBytes(addrBytes, groups, datum, script, coin).length;
    min = (UTXO_ENTRY_OVERHEAD + BigInt(size)) * COINS_PER_UTXO_BYTE;
    if (min === coin) return { lovelace: min.toString(), sizeBytes: size };
    coin = min;
  }
  return null;
}

/* Pool ID converter — a Cardano stake pool ID is a 28-byte blake2b-224
   hash of the pool's cold verification key. Explorers and tooling show it
   in two forms: 56 hex characters, or bech32 with the "pool" HRP (CIP-19).
   Converting between them is pure regrouping: hex bytes -> 5-bit groups
   (padded) -> bech32 with checksum; and back with strict padding checks.
   Verified vector (cross-checked against @cardano-sdk/core in the Mesh
   #692 investigation, 2026-10-07):
   hex 7facad662e180ce45e5c504957cd1341940c72a708728f7ecfc6e349
   <-> pool107k26e3wrqxwghju2py40ngngx2qcu48ppeg7lk0cm35jl2aenx */
function convertBits(data, fromBits, toBits, pad) {
  var acc = 0, bits = 0, out = [];
  var maxv = (1 << toBits) - 1;
  for (var i = 0; i < data.length; i++) {
    var v = data[i];
    if (v < 0 || (v >> fromBits) !== 0) return null;
    acc = (acc << fromBits) | v;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (toBits - bits)) & maxv);
  } else {
    if (bits >= fromBits) return null;
    if (((acc << (toBits - bits)) & maxv) !== 0) return null;
  }
  return out;
}

function hexToBytes(hex) {
  var out = [];
  for (var i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function bytesToHex(bytes) {
  return bytes.map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

/* poolIdFromHex("7fac…") -> "pool1…" or null unless exactly 28 bytes of hex */
function poolIdFromHex(raw) {
  var s = (raw || "").trim().toLowerCase();
  if (!/^[0-9a-f]{56}$/.test(s)) return null;
  var groups = convertBits(hexToBytes(s), 8, 5, true);
  return groups === null ? null : bech32Encode("pool", groups);
}

/* poolIdToHex("pool1…") -> 56-char lowercase hex or null. Requires a valid
   bech32 checksum, the "pool" HRP, and exactly 28 decoded bytes. */
function poolIdToHex(raw) {
  var s = (raw || "").trim();
  var check = verifyBech32(s);
  if (!check.valid || check.hrp !== "pool") return null;
  var lower = s.toLowerCase();
  var dataPart = lower.slice(lower.lastIndexOf("1") + 1, -6); /* strip checksum */
  var values = [];
  for (var i = 0; i < dataPart.length; i++) values.push(BECH32_CHARSET.indexOf(dataPart[i]));
  var bytes = convertBits(values, 5, 8, false);
  if (bytes === null || bytes.length !== 28) return null;
  return bytesToHex(bytes);
}

/* Asset fingerprint (CIP-14) — the user-facing ID of a Cardano native
   asset: bech32 (HRP "asset") over blake2b-160(policyIdBytes || assetNameBytes).
   One-way by design: a fingerprint identifies an asset but cannot be
   reversed back to its policy ID and asset name. The BLAKE2b below is a
   pure-JS implementation (RFC 7693, BigInt 64-bit words, unkeyed, fanout 1,
   depth 1) proven against ALL eight official CIP-14 test vectors in
   tests/test-site.js, and cross-checked against Python hashlib.blake2b.
   Fingerprint inputs stay tiny (28-byte policy + up to 32-byte name), but
   the implementation below is the general multi-block BLAKE2b, shared with
   the datum/script hash tool. */
var BLAKE2B_IV = [0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n, 0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n];
var BLAKE2B_SIGMA = [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3],[11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4],[7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8],[9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13],[2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9],[12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11],[13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10],[6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5],[10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0]];
var MASK64 = (1n << 64n) - 1n;
function rotr64(x, n) { return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & MASK64; }

/* blake2b(bytes, outLen) -> array of outLen bytes (1..64), or null.
   General multi-block BLAKE2b: inputs of any length are compressed block
   by block with the running byte counter, the final block flagged. Proven
   in tests/test-site.js against Python hashlib.blake2b for digest sizes
   20/28/32/64 and input lengths 0..1000 bytes (block boundaries incl.). */
function blake2b(input, outLen) {
  if (!input || typeof outLen !== "number" || outLen < 1 || outLen > 64) return null;
  var h = BLAKE2B_IV.slice();
  h[0] ^= 0x01010000n ^ BigInt(outLen); /* param word: digest len, key 0, fanout 1, depth 1 */
  function compress(blockBytes, counter, isLast) {
    var m = [];
    for (var w = 0; w < 16; w++) {
      var word = 0n;
      for (var j = 7; j >= 0; j--) word = (word << 8n) | BigInt(blockBytes[w * 8 + j]);
      m.push(word);
    }
    var v = h.concat(BLAKE2B_IV);
    v[12] ^= BigInt(counter); /* bytes compressed so far (inputs < 2^64) */
    if (isLast) v[14] ^= MASK64; /* final block flag */
    function G(a, b, c, d, x, y) {
      v[a] = (v[a] + v[b] + x) & MASK64; v[d] = rotr64(v[d] ^ v[a], 32);
      v[c] = (v[c] + v[d]) & MASK64; v[b] = rotr64(v[b] ^ v[c], 24);
      v[a] = (v[a] + v[b] + y) & MASK64; v[d] = rotr64(v[d] ^ v[a], 16);
      v[c] = (v[c] + v[d]) & MASK64; v[b] = rotr64(v[b] ^ v[c], 63);
    }
    for (var r = 0; r < 12; r++) {
      var s = BLAKE2B_SIGMA[r % 10];
      G(0, 4, 8, 12, m[s[0]], m[s[1]]); G(1, 5, 9, 13, m[s[2]], m[s[3]]);
      G(2, 6, 10, 14, m[s[4]], m[s[5]]); G(3, 7, 11, 15, m[s[6]], m[s[7]]);
      G(0, 5, 10, 15, m[s[8]], m[s[9]]); G(1, 6, 11, 12, m[s[10]], m[s[11]]);
      G(2, 7, 8, 13, m[s[12]], m[s[13]]); G(3, 4, 9, 14, m[s[14]], m[s[15]]);
    }
    for (var k = 0; k < 8; k++) h[k] ^= v[k] ^ v[k + 8];
  }
  var offset = 0;
  var counter = 0;
  while (input.length - offset > 128) {
    counter += 128;
    compress(input.slice(offset, offset + 128), counter, false);
    offset += 128;
  }
  var lastLen = input.length - offset;
  counter += lastLen;
  var lastBlock = [];
  for (var i = 0; i < 128; i++) lastBlock.push(i < lastLen ? input[offset + i] : 0);
  compress(lastBlock, counter, true);
  var out = [];
  for (var q = 0; q < 8 && out.length < outLen; q++) {
    var hv = h[q];
    for (var b2 = 0; b2 < 8 && out.length < outLen; b2++) { out.push(Number(hv & 255n)); hv >>= 8n; }
  }
  return out;
}

/* blake2b160(bytes) -> array of 20 bytes (CIP-14 fingerprint digest). */
function blake2b160(input) {
  if (!input) return null;
  return blake2b(input, 20);
}

/* assetFingerprint(policyIdHex, assetNameHex) -> "asset1…" or null.
   Policy ID must be exactly 56 hex chars (28 bytes); the asset name is hex
   of 0–32 bytes (empty allowed) — the form explorers display. */
function assetFingerprint(policyRaw, nameRaw) {
  var policy = (policyRaw || "").trim().toLowerCase();
  var name = (nameRaw || "").trim().toLowerCase();
  if (!/^[0-9a-f]{56}$/.test(policy)) return null;
  if (!/^([0-9a-f]{2}){0,32}$/.test(name)) return null;
  var digest = blake2b160(hexToBytes(policy).concat(hexToBytes(name)));
  if (digest === null) return null;
  var groups = convertBits(digest, 8, 5, true);
  return groups === null ? null : bech32Encode("asset", groups);
}

/* Native asset unit decoder — APIs (Blockfrost, Koios, cardano-cli)
   identify a native asset by its "unit": the policy ID hex concatenated
   with the asset-name hex, one long hex string. This splits a unit back
   into its parts and derives the CIP-14 fingerprint from them. The
   reverse split is exact — a unit is a plain concatenation, first 28
   bytes policy ID, the remaining 0–32 bytes the asset name. A CIP-14
   fingerprint (asset1…) is a hash and is NOT a unit: it cannot be
   decoded back, and this tool rejects it. The asset name is also shown
   as text when its bytes are valid UTF-8 with no control characters —
   many token names are plain text — otherwise only the hex is shown.
   Proven against all eight official CIP-14 test vectors: each vector's
   unit (policy ‖ name) decodes to exactly its published fingerprint. */
function assetUnit(policyRaw, nameRaw) {
  var policy = (policyRaw || "").trim().toLowerCase().replace(/^0x/, "");
  var name = (nameRaw || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{56}$/.test(policy)) return null;
  if (!/^([0-9a-f]{2}){0,32}$/.test(name)) return null;
  return policy + name;
}

function assetNameText(nameHex) {
  if (nameHex === "") return "";
  var bytes = hexToBytes(nameHex);
  if (bytes === null) return null;
  if (typeof TextDecoder !== "undefined") {
    var txt;
    try { txt = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); }
    catch (e) { return null; }
    for (var i = 0; i < txt.length; i++) {
      var c = txt.charCodeAt(i);
      if (c < 0x20 || c === 0x7f) return null;
    }
    return txt;
  }
  var out = "";
  for (var j = 0; j < bytes.length; j++) {
    if (bytes[j] < 0x20 || bytes[j] > 0x7e) return null;
    out += String.fromCharCode(bytes[j]);
  }
  return out;
}

/* parseAssetUnit(raw) -> { unit, policyHex, nameHex, nameText,
   fingerprint } or null. Accepts the unit hex (56–120 hex chars, an
   optional 0x prefix, any case). */
function parseAssetUnit(raw) {
  var s = (raw || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^([0-9a-f]{2})+$/.test(s)) return null;
  if (s.length < 56 || s.length > 120) return null;
  var policyHex = s.slice(0, 56);
  var nameHex = s.slice(56);
  var fp = assetFingerprint(policyHex, nameHex);
  if (fp === null) return null;
  return { unit: s, policyHex: policyHex, nameHex: nameHex,
    nameText: assetNameText(nameHex), fingerprint: fp };
}

/* Datum & script hashes — the two hashes Cardano developers reach for
   daily. A datum hash is blake2b-256 of the datum's CBOR bytes (the
   serialised Plutus Data). A script hash is blake2b-224 of a one-byte
   language tag followed by the script bytes: 0x00 native, 0x01 PlutusV1,
   0x02 PlutusV2, 0x03 PlutusV3 (the ledger's hashScript rule — the same
   rule the Mesh #763 fix shipped for Plutus scripts). A script hash IS
   the script's policy ID when the script mints. Input is raw bytes as
   hex: for Plutus scripts that means the flat-encoded script bytes (the
   compiledCode from an Aiken blueprint), NOT the CBOR-wrapped form some
   tools display. All vectors in tests/test-site.js were cross-checked
   against Python hashlib.blake2b before this shipped. */
var SCRIPT_HASH_TAGS = { native: 0, plutusv1: 1, plutusv2: 2, plutusv3: 3 };
var HASH_MAX_HEX = 65536; /* 32 KiB of bytes — far above any real script */

function hashHexBytes(raw) {
  var hex = (raw || "").trim().toLowerCase().replace(/^0x/, "");
  if (hex.length === 0 || hex.length > HASH_MAX_HEX) return null;
  if (!/^([0-9a-f]{2})+$/.test(hex)) return null;
  return hexToBytes(hex);
}

function datumHash(dataHex) {
  var bytes = hashHexBytes(dataHex);
  if (bytes === null) return null;
  var digest = blake2b(bytes, 32);
  return digest === null ? null : bytesToHex(digest);
}

function scriptHash(kind, scriptHex) {
  if (!(kind in SCRIPT_HASH_TAGS)) return null;
  var bytes = hashHexBytes(scriptHex);
  if (bytes === null) return null;
  var digest = blake2b([SCRIPT_HASH_TAGS[kind]].concat(bytes), 28);
  return digest === null ? null : bytesToHex(digest);
}

/* Key hashes & address builder. A Cardano key hash is blake2b-224 of the
   32-byte Ed25519 verification key — the hash is what actually appears in
   addresses, not the key itself. Addresses (CIP-19 layout) are a one-byte
   header (address type in the high nibble, network id in the low nibble:
   1 = mainnet, 0 = testnet) followed by the key hashes, bech32-encoded:
   base (type 0) = payment + stake key hash, enterprise (type 6) = payment
   key hash only, reward (type 14) = stake key hash only under the stake
   prefix. Key-hash vectors in the tests were cross-checked against Python
   hashlib.blake2b, and the base-address builder is proven end-to-end
   against a real wallet-generated mainnet address (it rebuilds the
   donation address on this page byte-for-byte from its key hashes). */
function keyHash(vkeyRaw) {
  var vkey = (vkeyRaw || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(vkey)) return null;
  var digest = blake2b(hexToBytes(vkey), 28);
  return digest === null ? null : bytesToHex(digest);
}

function keyHashHex(raw) {
  var h = (raw || "").trim().toLowerCase();
  return /^[0-9a-f]{56}$/.test(h) ? h : null;
}

/* The CIP-19 type nibble is fixed by WHICH credentials the address carries:
   base = pay key/script x stake key/script (types 0-3), enterprise =
   payment credential only (6 key / 7 script), reward = stake credential
   only (14 key / 15 script). payCred / stakeCred default to "key", so
   every call the key builder above makes behaves exactly as before;
   passing "script" builds the script-credential forms — e.g. the
   enterprise address a Plutus script's funds lock to, from the script
   hash the datum & script hash tool computes. Proven in the tests
   byte-for-byte (header || hashes via the hex converter) and end-to-end
   from a real Aiken blueprint: its compiledCode hashes (Plutus V3) to
   the blueprint's published script hashes, whose script addresses the
   proven CIP-19 decoder reads back with the same hashes and kinds. */
function buildAddress(kind, network, payHashRaw, stakeHashRaw, payCred, stakeCred) {
  if (network !== "mainnet" && network !== "testnet") return null;
  payCred = payCred === undefined ? "key" : payCred;
  stakeCred = stakeCred === undefined ? "key" : stakeCred;
  if (payCred !== "key" && payCred !== "script") return null;
  if (stakeCred !== "key" && stakeCred !== "script") return null;
  var type;
  if (kind === "base") type = (payCred === "script" ? 1 : 0) + (stakeCred === "script" ? 2 : 0);
  else if (kind === "enterprise") type = payCred === "script" ? 7 : 6;
  else if (kind === "reward") type = stakeCred === "script" ? 15 : 14;
  else return null;
  var header = (type << 4) | (network === "mainnet" ? 1 : 0);
  var payload, hrp;
  if (kind === "reward") {
    var stakeOnly = keyHashHex(stakeHashRaw);
    if (stakeOnly === null) return null;
    payload = [header].concat(hexToBytes(stakeOnly));
    hrp = network === "mainnet" ? "stake" : "stake_test";
  } else {
    var pay = keyHashHex(payHashRaw);
    if (pay === null) return null;
    payload = [header].concat(hexToBytes(pay));
    if (kind === "base") {
      var stake = keyHashHex(stakeHashRaw);
      if (stake === null) return null;
      payload = payload.concat(hexToBytes(stake));
    }
    hrp = network === "mainnet" ? "addr" : "addr_test";
  }
  var groups = convertBits(payload, 8, 5, true);
  return groups === null ? null : bech32Encode(hrp, groups);
}

/* Address decoder (CIP-19) — the reverse of the builder above. A Shelley
   address payload is a one-byte header (address type in the high nibble,
   network id in the low nibble: 1 = mainnet, 0 = testnet) followed by
   28-byte credential hashes. Types: 0-3 base (payment key/script x stake
   key/script, 57-byte payload), 4-5 pointer (payment credential + a chain
   pointer in place of the stake hash), 6-7 enterprise (payment credential
   only, 29 bytes), 14-15 reward (stake credential only, 29 bytes, stake
   prefix). The decoder extracts the credentials and derives the related
   enterprise / reward addresses from the same hashes — derivations are
   pure byte rearrangement + bech32, proven in the tests by decoding a real
   wallet-generated mainnet address to its known key hashes and re-deriving
   the exact enterprise and reward addresses the builder produces. Byron
   addresses (no header byte, CBOR-wrapped payload) return null. */
function bech32DecodeBytes(raw) {
  var s = (raw || "").trim();
  var check = verifyBech32(s);
  if (!check.valid) return null;
  var lower = s.toLowerCase();
  var dataPart = lower.slice(lower.lastIndexOf("1") + 1, -6); /* strip checksum */
  var values = [];
  for (var i = 0; i < dataPart.length; i++) values.push(BECH32_CHARSET.indexOf(dataPart[i]));
  var bytes = convertBits(values, 5, 8, false);
  return bytes === null ? null : { hrp: check.hrp, bytes: bytes };
}

function encodeAddressBytes(hrp, bytes) {
  var groups = convertBits(bytes, 8, 5, true);
  return groups === null ? null : bech32Encode(hrp, groups);
}

/* decodeAddress("addr1…") -> { type, typeLabel, network, header,
   paymentKind, paymentHash, stakeKind, stakeHash, pointerHex,
   enterprise, reward } or null. Hashes are lowercase hex; fields that a
   type does not carry are null. The hrp family and the header network bit
   must agree (addr/stake = mainnet id 1, addr_test/stake_test = id 0). */
function decodeAddress(raw) {
  var dec = bech32DecodeBytes(raw);
  if (dec === null) return null;
  var isStakeHrp = dec.hrp === "stake" || dec.hrp === "stake_test";
  var isAddrHrp = dec.hrp === "addr" || dec.hrp === "addr_test";
  if (!isStakeHrp && !isAddrHrp) return null;
  var bytes = dec.bytes;
  if (bytes.length < 29) return null;
  var header = bytes[0];
  var type = header >> 4;
  var netId = header & 15;
  var network = netId === 1 ? "mainnet" : netId === 0 ? "testnet" : null;
  if (network === null) return null;
  if ((dec.hrp === "addr" || dec.hrp === "stake") !== (netId === 1)) return null;
  if (isStakeHrp !== (type === 14 || type === 15)) return null;
  var addrHrp = network === "mainnet" ? "addr" : "addr_test";
  var stakeHrp = network === "mainnet" ? "stake" : "stake_test";
  var out = {
    type: type, network: network, header: header,
    paymentKind: null, paymentHash: null,
    stakeKind: null, stakeHash: null, pointerHex: null,
    enterprise: null, reward: null
  };
  function enterpriseFrom(payKind, payBytes) {
    var h = ((payKind === "script" ? 7 : 6) << 4) | netId;
    return encodeAddressBytes(addrHrp, [h].concat(payBytes));
  }
  function rewardFrom(stakeKind, stakeBytes) {
    var h = ((stakeKind === "script" ? 15 : 14) << 4) | netId;
    return encodeAddressBytes(stakeHrp, [h].concat(stakeBytes));
  }
  if (type >= 0 && type <= 3) {
    if (bytes.length !== 57) return null;
    out.typeLabel = "Base address";
    out.paymentKind = (type === 1 || type === 3) ? "script" : "key";
    out.stakeKind = (type === 2 || type === 3) ? "script" : "key";
    out.paymentHash = bytesToHex(bytes.slice(1, 29));
    out.stakeHash = bytesToHex(bytes.slice(29, 57));
    out.enterprise = enterpriseFrom(out.paymentKind, bytes.slice(1, 29));
    out.reward = rewardFrom(out.stakeKind, bytes.slice(29, 57));
    return out;
  }
  if (type === 4 || type === 5) {
    if (bytes.length <= 29) return null;
    out.typeLabel = "Pointer address";
    out.paymentKind = type === 5 ? "script" : "key";
    out.paymentHash = bytesToHex(bytes.slice(1, 29));
    out.pointerHex = bytesToHex(bytes.slice(29));
    out.enterprise = enterpriseFrom(out.paymentKind, bytes.slice(1, 29));
    return out;
  }
  if (type === 6 || type === 7) {
    if (bytes.length !== 29) return null;
    out.typeLabel = "Enterprise address";
    out.paymentKind = type === 7 ? "script" : "key";
    out.paymentHash = bytesToHex(bytes.slice(1, 29));
    out.enterprise = encodeAddressBytes(addrHrp, bytes);
    return out;
  }
  if (type === 14 || type === 15) {
    if (bytes.length !== 29) return null;
    out.typeLabel = "Reward address";
    out.stakeKind = type === 15 ? "script" : "key";
    out.stakeHash = bytesToHex(bytes.slice(1, 29));
    out.reward = encodeAddressBytes(stakeHrp, bytes);
    return out;
  }
  return null; /* types 8-13: Byron / reserved — not Shelley header addresses */
}

/* Address hex <-> bech32 converter. The same Shelley address bytes are
   shown two ways in the wild: bech32 (addr1… / stake1…) for people and
   explorers, and raw hex for machines — CIP-30 wallets return addresses
   as hex (api.getUsedAddresses / getRewardAddresses), and APIs and
   cardano-cli accept the hex form. The conversion is pure re-encoding of
   the identical payload bytes (header byte + credential hashes), so it
   is exact in both directions. Both directions are gated on the CIP-19
   decoder above: only payloads that decode as a valid Shelley address
   (known type, network id 0/1, exact length for the type, hrp family
   agreeing with the header) convert at all — pool IDs, asset
   fingerprints, Byron payloads and truncated bytes all return null.
   Proven in the tests against a real wallet-generated address: its hex
   form is 01 || payment key hash || stake key hash, byte-for-byte. */
function addressToHex(raw) {
  if (decodeAddress(raw) === null) return null;
  var dec = bech32DecodeBytes(raw);
  return dec === null ? null : bytesToHex(dec.bytes);
}

function addressFromHex(raw) {
  var hex = (raw || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^([0-9a-f]{2})+$/.test(hex)) return null;
  var bytes = hexToBytes(hex);
  if (bytes.length < 29) return null;
  var header = bytes[0];
  var type = header >> 4;
  var netId = header & 15;
  if (netId !== 0 && netId !== 1) return null;
  var lenOk = ((type >= 0 && type <= 3) && bytes.length === 57) ||
    ((type === 4 || type === 5) && bytes.length > 29) ||
    ((type === 6 || type === 7 || type === 14 || type === 15) && bytes.length === 29);
  if (!lenOk) return null;
  var hrp = (type === 14 || type === 15)
    ? (netId === 1 ? "stake" : "stake_test")
    : (netId === 1 ? "addr" : "addr_test");
  var encoded = encodeAddressBytes(hrp, bytes);
  if (encoded === null) return null;
  /* final gate: the encoded form must itself pass the full CIP-19 decode */
  return decodeAddress(encoded) === null ? null : encoded;
}

/* Governance ID converter (CIP-129 / legacy CIP-105) — Conway-era
   governance identifiers: DRep credentials (drep…), Constitutional
   Committee hot/cold credentials (cc_hot… / cc_cold…) and governance
   action IDs (gov_action…). CIP-129 encodes a credential as
   header || 28-byte hash, where the header's high nibble is the kind
   (0 = CC hot, 1 = CC cold, 2 = DRep) and the low nibble is the
   credential type (2 = key hash, 3 = script hash); a gov action ID is
   the 32-byte transaction ID with the action index appended as one
   byte. The older CIP-105 form encodes the bare 28-byte hash, with the
   script forms under *_script prefixes. The two forms cause real
   confusion — some tools accept only one — so this tool parses either
   (or the hex payload) and shows both. Pure re-encoding + header
   validation, offline. Proven against all five test vectors published
   in CIP-129 itself, and against a real DRep's published ID pair:
   hash 4e1d2a28…90fc0f is drep1yf8p6… (CIP-129, header 0x22) and
   drep1fcwj5… (legacy CIP-105) — both reproduced here from the hash. */
var GOV_KIND_BASE = { cc_hot: 0x00, cc_cold: 0x10, drep: 0x20 };
var GOV_BASE_KIND = { 0: "cc_hot", 1: "cc_cold", 2: "drep" };
var GOV_KIND_LABEL = {
  cc_hot: "Constitutional Committee hot credential",
  cc_cold: "Constitutional Committee cold credential",
  drep: "DRep credential",
  gov_action: "Governance action ID"
};

function govCredBech32(kind, credKind, hashHex) {
  var hash = hexToBytes((hashHex || "").trim().toLowerCase().replace(/^0x/, ""));
  if (hash === null || hash.length !== 28 || !(kind in GOV_KIND_BASE)) return null;
  var nib = credKind === "key" ? 2 : credKind === "script" ? 3 : null;
  if (nib === null) return null;
  return encodeAddressBytes(kind, [GOV_KIND_BASE[kind] | nib].concat(hash));
}

function govCredLegacyBech32(kind, credKind, hashHex) {
  var hash = hexToBytes((hashHex || "").trim().toLowerCase().replace(/^0x/, ""));
  if (hash === null || hash.length !== 28 || !(kind in GOV_KIND_BASE)) return null;
  if (credKind !== "key" && credKind !== "script") return null;
  return encodeAddressBytes(credKind === "script" ? kind + "_script" : kind, hash);
}

function govActionBech32(txHex, index) {
  var tx = hexToBytes((txHex || "").trim().toLowerCase().replace(/^0x/, ""));
  if (tx === null || tx.length !== 32) return null;
  if (!Number.isInteger(index) || index < 0 || index > 255) return null;
  return encodeAddressBytes("gov_action", tx.concat([index]));
}

/* parseGovId(raw) -> { format, kind, kindLabel, credKind, hashHex,
   txId, index, payloadHex, bech32, cip129, legacy } or null.
   Accepts a CIP-129 bech32 ID, a legacy CIP-105 bech32 ID, or the hex
   payload (29 bytes header||hash for a credential, 33 bytes
   txID||index for a gov action). A bare 28-byte hash is rejected: its
   kind (DRep vs committee) cannot be known from the hash alone. */
function parseGovId(raw) {
  var s = (raw || "").trim();
  if (!s) return null;
  var hex = s.toLowerCase().replace(/^0x/, "");
  if (/^([0-9a-f]{2})+$/.test(hex)) {
    var hb = hexToBytes(hex);
    if (hb.length === 33) {
      var txId = bytesToHex(hb.slice(0, 32));
      var ga = govActionBech32(txId, hb[32]);
      return { format: "CIP-129", kind: "gov_action", kindLabel: GOV_KIND_LABEL.gov_action,
        credKind: null, hashHex: null, txId: txId, index: hb[32], payloadHex: hex,
        bech32: ga, cip129: ga, legacy: txId + "#" + hb[32] };
    }
    if (hb.length === 29) {
      var hkind = GOV_BASE_KIND[hb[0] >> 4];
      var hnib = hb[0] & 15;
      if (!hkind || (hnib !== 2 && hnib !== 3)) return null;
      var hcred = hnib === 2 ? "key" : "script";
      var hhash = bytesToHex(hb.slice(1));
      var h129 = govCredBech32(hkind, hcred, hhash);
      return { format: "CIP-129", kind: hkind, kindLabel: GOV_KIND_LABEL[hkind],
        credKind: hcred, hashHex: hhash, txId: null, index: null, payloadHex: hex, payload129Hex: hex,
        bech32: h129, cip129: h129, legacy: govCredLegacyBech32(hkind, hcred, hhash) };
    }
    return null;
  }
  var dec = bech32DecodeBytes(s);
  if (dec === null) return null;
  var bytes = dec.bytes;
  if (dec.hrp === "gov_action") {
    if (bytes.length !== 33) return null;
    var gtx = bytesToHex(bytes.slice(0, 32));
    return { format: "CIP-129", kind: "gov_action", kindLabel: GOV_KIND_LABEL.gov_action,
      credKind: null, hashHex: null, txId: gtx, index: bytes[32],
      payloadHex: bytesToHex(bytes), bech32: s.toLowerCase(), cip129: s.toLowerCase(),
      legacy: gtx + "#" + bytes[32] };
  }
  var kind = null, legacyCred = null;
  if (dec.hrp in GOV_KIND_BASE) kind = dec.hrp;
  else if (dec.hrp.slice(-7) === "_script" && (dec.hrp.slice(0, -7) in GOV_KIND_BASE)) {
    kind = dec.hrp.slice(0, -7); legacyCred = "script";
  }
  if (kind === null) return null;
  if (bytes.length === 29 && legacyCred === null) {
    if (GOV_BASE_KIND[bytes[0] >> 4] !== kind) return null;
    var nib = bytes[0] & 15;
    if (nib !== 2 && nib !== 3) return null;
    var cred = nib === 2 ? "key" : "script";
    var hash = bytesToHex(bytes.slice(1));
    return { format: "CIP-129", kind: kind, kindLabel: GOV_KIND_LABEL[kind],
      credKind: cred, hashHex: hash, txId: null, index: null,
      payloadHex: bytesToHex(bytes), payload129Hex: bytesToHex(bytes), bech32: s.toLowerCase(), cip129: s.toLowerCase(),
      legacy: govCredLegacyBech32(kind, cred, hash) };
  }
  if (bytes.length === 28) {
    var lcred = legacyCred || "key";
    var lhash = bytesToHex(bytes);
    return { format: "CIP-105 (legacy)", kind: kind, kindLabel: GOV_KIND_LABEL[kind],
      credKind: lcred, hashHex: lhash, txId: null, index: null,
      payloadHex: bytesToHex(bytes),
      payload129Hex: bytesToHex([GOV_KIND_BASE[kind] | (lcred === "key" ? 2 : 3)].concat(bytes)),
      bech32: s.toLowerCase(),
      cip129: govCredBech32(kind, lcred, lhash), legacy: s.toLowerCase() };
  }
  return null;
}

/* CBOR decoder (RFC 8949) with Plutus Data awareness — the read side of
   the datum hash tool above: paste a datum's CBOR (or any CBOR) as hex
   and read back its structure. Integers decode as exact BigInt (no float
   rounding, however large); byte strings render as h'…'; Plutus
   constructor tags render as Constr (tags 121–127 directly, tags
   1280–1400 as index + 7, tag 102 in its [index, fields] form), and
   bignum tags 2/3 render as the integer
   they encode. Indefinite-length items (the 9f…ff style Plutus Data
   uses) are supported. Trailing bytes, truncation, reserved additional
   information and invalid UTF-8 in text strings are all rejected — the
   input must be exactly one complete CBOR item. Proven against the
   RFC 8949 Appendix A example set and real Plutus Data encodings
   (d8799f182a182bff = Constr 0 [42, 43]) in tests/test-site.js; the
   decoder was prototyped in scratch and every vector hand-verified
   before it was wired in. Display only — nothing is signed or sent. */
var CBOR_MAX_DEPTH = 100;
var CBOR_MAX_LENGTH = 100000;

function cborReadUint(bytes, pos, ai) {
  if (ai < 24) return { v: BigInt(ai), next: pos };
  var n = ai === 24 ? 1 : ai === 25 ? 2 : ai === 26 ? 4 : ai === 27 ? 8 : -1;
  if (n < 0 || pos + n > bytes.length) return null;
  var v = 0n;
  for (var i = 0; i < n; i++) v = (v << 8n) | BigInt(bytes[pos + i]);
  return { v: v, next: pos + n };
}

function cborHalfToNumber(h) {
  var sign = (h & 0x8000) ? -1 : 1;
  var exp = (h >> 10) & 0x1f;
  var frac = h & 0x03ff;
  if (exp === 0) return sign * (frac / 1024) * Math.pow(2, -14);
  if (exp === 31) return frac === 0 ? sign * Infinity : NaN;
  return sign * (1 + frac / 1024) * Math.pow(2, exp - 15);
}

/* Parse one CBOR item at bytes[pos]; returns { node, next } or null.
   Node: { t:"int", v:BigInt } | { t:"bytes", bytes:[…] } |
   { t:"text", v } | { t:"array", items } | { t:"map", pairs:[[k,v]] } |
   { t:"tag", n:BigInt, item } | { t:"bool", v } | { t:"null" } |
   { t:"undef" } | { t:"float", v } | { t:"simple", n } */
function cborParseItem(bytes, pos, depth) {
  if (depth > CBOR_MAX_DEPTH || pos >= bytes.length) return null;
  var ib = bytes[pos];
  var major = ib >> 5, ai = ib & 31;
  pos += 1;
  if (ai === 28 || ai === 29 || ai === 30) return null; /* reserved */

  if (major === 0 || major === 1) {
    if (ai === 31) return null;
    var ri = cborReadUint(bytes, pos, ai);
    if (!ri) return null;
    return { node: { t: "int", v: major === 0 ? ri.v : -1n - ri.v }, next: ri.next };
  }
  if (major === 2 || major === 3) {
    var isText = major === 3;
    if (ai === 31) {
      var chunks = [], nextIndef = pos;
      for (;;) {
        if (nextIndef >= bytes.length) return null;
        if (bytes[nextIndef] === 0xff) { nextIndef += 1; break; }
        var sub = cborParseItem(bytes, nextIndef, depth + 1);
        if (!sub || sub.node.t !== (isText ? "text" : "bytes")) return null;
        chunks.push(sub.node);
        nextIndef = sub.next;
      }
      if (isText) return { node: { t: "text", v: chunks.map(function (c) { return c.v; }).join("") }, next: nextIndef };
      var allBytes = [];
      chunks.forEach(function (c) { allBytes = allBytes.concat(c.bytes); });
      return { node: { t: "bytes", bytes: allBytes }, next: nextIndef };
    }
    var rb = cborReadUint(bytes, pos, ai);
    if (!rb || rb.v > BigInt(CBOR_MAX_LENGTH)) return null;
    var len = Number(rb.v);
    if (rb.next + len > bytes.length) return null;
    var rawBytes = bytes.slice(rb.next, rb.next + len);
    if (isText) {
      var text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(rawBytes)); }
      catch (e) { return null; }
      return { node: { t: "text", v: text }, next: rb.next + len };
    }
    return { node: { t: "bytes", bytes: rawBytes }, next: rb.next + len };
  }
  if (major === 4 || major === 5) {
    var isMap = major === 5;
    var count = null, nextSeq = pos;
    if (ai !== 31) {
      var rc = cborReadUint(bytes, pos, ai);
      if (!rc || rc.v > BigInt(CBOR_MAX_LENGTH)) return null;
      count = Number(rc.v);
      nextSeq = rc.next;
    }
    var items = [], pairs = [];
    for (;;) {
      if (count !== null && (isMap ? pairs.length >= count : items.length >= count)) break;
      if (count === null) {
        if (nextSeq >= bytes.length) return null;
        if (bytes[nextSeq] === 0xff) { nextSeq += 1; break; }
      }
      var first = cborParseItem(bytes, nextSeq, depth + 1);
      if (!first) return null;
      nextSeq = first.next;
      if (isMap) {
        var second = cborParseItem(bytes, nextSeq, depth + 1);
        if (!second) return null;
        nextSeq = second.next;
        pairs.push([first.node, second.node]);
      } else items.push(first.node);
    }
    return { node: isMap ? { t: "map", pairs: pairs } : { t: "array", items: items }, next: nextSeq };
  }
  if (major === 6) {
    if (ai === 31) return null;
    var rt = cborReadUint(bytes, pos, ai);
    if (!rt) return null;
    var inner = cborParseItem(bytes, rt.next, depth + 1);
    if (!inner) return null;
    return { node: { t: "tag", n: rt.v, item: inner.node }, next: inner.next };
  }
  /* major 7: simple values and floats */
  if (ai < 20) return { node: { t: "simple", n: ai }, next: pos };
  if (ai === 20) return { node: { t: "bool", v: false }, next: pos };
  if (ai === 21) return { node: { t: "bool", v: true }, next: pos };
  if (ai === 22) return { node: { t: "null" }, next: pos };
  if (ai === 23) return { node: { t: "undef" }, next: pos };
  if (ai === 24) {
    if (pos >= bytes.length) return null;
    if (bytes[pos] < 32) return null;
    return { node: { t: "simple", n: bytes[pos] }, next: pos + 1 };
  }
  if (ai === 25) {
    if (pos + 2 > bytes.length) return null;
    return { node: { t: "float", v: cborHalfToNumber((bytes[pos] << 8) | bytes[pos + 1]) }, next: pos + 2 };
  }
  if (ai === 26 || ai === 27) {
    var nf = ai === 26 ? 4 : 8;
    if (pos + nf > bytes.length) return null;
    var view = new DataView(new Uint8Array(bytes.slice(pos, pos + nf)).buffer);
    return { node: { t: "float", v: nf === 4 ? view.getFloat32(0) : view.getFloat64(0) }, next: pos + nf };
  }
  return null; /* ai === 31 here is a stray break */
}

function cborRender(node) {
  switch (node.t) {
    case "int": return node.v.toString();
    case "bytes": return "h'" + bytesToHex(node.bytes) + "'";
    case "text": return JSON.stringify(node.v);
    case "array": return "[" + node.items.map(cborRender).join(", ") + "]";
    case "map": return "{" + node.pairs.map(function (p) { return cborRender(p[0]) + ": " + cborRender(p[1]); }).join(", ") + "}";
    case "bool": return node.v ? "true" : "false";
    case "null": return "null";
    case "undef": return "undefined";
    case "float": return isNaN(node.v) ? "NaN" : String(node.v);
    case "simple": return "simple(" + node.n + ")";
    case "tag": {
      var n = node.n;
      /* Plutus Data constructors, in the encoding current tooling uses
         (cross-checked against pycardano): tags 121–127 are Constr
         (tag − 121) directly; tags 1280–1400 are Constr (tag − 1280 + 7)
         with the fields list as the tagged item; tag 102 wraps
         [alternative, fields]. An earlier version here read tag 1280
         itself as the [alternative, fields] wrapper — obsolete: under
         the current encoding the item after tag 1280 IS Constr 7's
         fields list. */
      if (n >= 121n && n <= 127n && node.item.t === "array") {
        return "Constr " + (n - 121n).toString() + " " + cborRender(node.item);
      }
      if (n >= 1280n && n <= 1400n && node.item.t === "array") {
        return "Constr " + (n - 1280n + 7n).toString() + " " + cborRender(node.item);
      }
      if (n === 102n && node.item.t === "array" && node.item.items.length === 2 &&
          node.item.items[0].t === "int" && node.item.items[1].t === "array") {
        return "Constr " + node.item.items[0].v.toString() + " " + cborRender(node.item.items[1]);
      }
      /* Bignum tags 2 (positive) / 3 (negative, −1 − n) over a byte string. */
      if ((n === 2n || n === 3n) && node.item.t === "bytes" && node.item.bytes.length > 0) {
        var mag = 0n;
        node.item.bytes.forEach(function (b) { mag = (mag << 8n) | BigInt(b); });
        return (n === 2n ? mag : -1n - mag).toString();
      }
      return "tag " + n.toString() + " (" + cborRender(node.item) + ")";
    }
  }
  return null;
}

/* decodeCbor(hex) -> the rendered structure of exactly one CBOR item,
   or null for malformed, truncated or trailing-garbage input. */
function decodeCbor(raw) {
  var s = (raw || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^([0-9a-f]{2})+$/.test(s)) return null;
  var bytes = hexToBytes(s);
  if (bytes.length === 0 || bytes.length > 65536) return null;
  var r = cborParseItem(bytes, 0, 0);
  if (!r || r.next !== bytes.length) return null;
  return cborRender(r.node);
}

/* Plutus Data encoder — the write side of the decoder above. Input is
   the detailed JSON schema used across Cardano tooling (the form
   cardano-db-sync and Blockfrost show for datums):
     {"int": 42}                          an integer, exact at any size
     {"bytes": "deadbeef"}                a byte string, as hex
     {"list": [ … ]}                      a list of data values
     {"map": [{"k": …, "v": …}, …]}       a map of data values
     {"constructor": 0, "fields": [ … ]}  a constructor with fields
   Encoding rules, each pinned against the reference implementation
   pycardano (0.19.2) in scratch before wiring, and end-to-end by the
   datum-hash anchor below:
   - integers use the shortest CBOR form; magnitudes at or beyond 2^64
     use bignum tags 2 (positive) / 3 (negative) over the magnitude's
     minimal big-endian bytes;
   - byte strings of up to 64 bytes are definite-length; longer ones
     are indefinite-length in 64-byte chunks (Plutus Core spec §D.5);
   - lists are indefinite-length (9f…ff), maps definite-length;
   - constructors use tag 121 + index (index 0–6), tag 1280 + index − 7
     (index 7–127), or tag 102 wrapping [index, fields] (index ≥ 128);
     a constructor's fields list is indefinite-length when non-empty
     and the definite empty list (80) when empty, matching pycardano;
   - {"constructor":0,"fields":[{"int":42},{"int":43}]} encodes to
     d8799f182a182bff — the decoder's sample datum — and hashes to that
     datum's known hash, tying encoder, decoder and hash tool together.
   Numbers in the JSON are read as decimal text (never through a float),
   so a 30-digit integer encodes exactly; "int" given as a quoted
   decimal string is accepted too. Structure is validated strictly:
   unknown keys, missing map keys/values, odd-length byte hex, negative
   or oversized constructor indices and trailing JSON garbage are all
   rejected. Caps: 64 KiB of JSON text, depth 100, 1,000 items per
   list/map/fields, 128 digits per integer, 8 KiB per byte string. */
function cborHead(major, v) { /* v: BigInt >= 0; shortest-form head */
  var m = major << 5, out = [], s;
  if (v < 24n) return [m | Number(v)];
  if (v < 256n) return [m | 24, Number(v)];
  if (v < 65536n) return [m | 25, Number(v >> 8n), Number(v & 255n)];
  if (v < 4294967296n) { for (s = 24n; s >= 0n; s -= 8n) out.push(Number((v >> s) & 255n)); return [m | 26].concat(out); }
  for (s = 56n; s >= 0n; s -= 8n) out.push(Number((v >> s) & 255n));
  return [m | 27].concat(out);
}
function bigIntMagnitudeBytes(v) { /* v: BigInt > 0 -> minimal BE bytes */
  var hex = v.toString(16); if (hex.length % 2) hex = "0" + hex;
  return hexToBytes(hex);
}
function encodeDataInt(v) { /* v: BigInt -> CBOR integer bytes */
  var mag;
  if (v >= 0n) {
    if (v < 18446744073709551616n) return cborHead(0, v);
    mag = bigIntMagnitudeBytes(v);
    return [0xc2].concat(cborHead(2, BigInt(mag.length)), mag);
  }
  mag = -1n - v;
  if (mag < 18446744073709551616n) return cborHead(1, mag);
  mag = bigIntMagnitudeBytes(mag);
  return [0xc3].concat(cborHead(2, BigInt(mag.length)), mag);
}
function encodeDataBytes(bytes) {
  var out, i, chunk;
  if (bytes.length <= 64) return cborHead(2, BigInt(bytes.length)).concat(bytes);
  out = [0x5f];
  for (i = 0; i < bytes.length; i += 64) {
    chunk = bytes.slice(i, i + 64);
    out = out.concat(cborHead(2, BigInt(chunk.length)), chunk);
  }
  out.push(0xff);
  return out;
}
function encodeDataListItems(items, depth) {
  var out = [0x9f], i, e;
  for (i = 0; i < items.length; i++) {
    e = encodeDataNode(items[i], depth + 1);
    if (!e) return null;
    out = out.concat(e);
  }
  out.push(0xff);
  return out;
}
function encodeDataNode(node, depth) {
  var out, i, ek, ev, fieldsEnc;
  if (depth > 100) return null;
  switch (node.t) {
    case "int": return encodeDataInt(node.v);
    case "bytes": return encodeDataBytes(node.bytes);
    case "list": return encodeDataListItems(node.items, depth);
    case "map":
      out = cborHead(5, BigInt(node.pairs.length));
      for (i = 0; i < node.pairs.length; i++) {
        ek = encodeDataNode(node.pairs[i][0], depth + 1);
        ev = encodeDataNode(node.pairs[i][1], depth + 1);
        if (!ek || !ev) return null;
        out = out.concat(ek, ev);
      }
      return out;
    case "constr":
      if (node.index < 128n) {
        fieldsEnc = node.fields.length === 0 ? [0x80] : encodeDataListItems(node.fields, depth);
        if (!fieldsEnc) return null;
        return cborHead(6, node.index < 7n ? 121n + node.index : 1280n + node.index - 7n).concat(fieldsEnc);
      }
      fieldsEnc = encodeDataListItems(node.fields, depth);
      if (!fieldsEnc) return null;
      return cborHead(6, 102n).concat([0x82], encodeDataInt(node.index), fieldsEnc);
  }
  return null;
}
function validateDataNode(obj, depth) {
  var keys, s, items, pairs, fields, i, n, k, v, idx;
  if (depth > 100 || obj === null || typeof obj !== "object" || Array.isArray(obj)) return null;
  keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === "int") {
    s = obj.int;
    if (typeof s !== "string" || !/^-?\d+$/.test(s) || s.replace("-", "").length > 128) return null;
    return { t: "int", v: BigInt(s) };
  }
  if (keys.length === 1 && keys[0] === "bytes") {
    s = obj.bytes;
    if (typeof s !== "string") return null;
    s = s.trim().toLowerCase().replace(/^0x/, "");
    if (!/^([0-9a-f]{2})*$/.test(s) || s.length > 16384) return null;
    return { t: "bytes", bytes: hexToBytes(s) };
  }
  if (keys.length === 1 && keys[0] === "list") {
    if (!Array.isArray(obj.list) || obj.list.length > 1000) return null;
    items = [];
    for (i = 0; i < obj.list.length; i++) {
      n = validateDataNode(obj.list[i], depth + 1);
      if (!n) return null;
      items.push(n);
    }
    return { t: "list", items: items };
  }
  if (keys.length === 1 && keys[0] === "map") {
    if (!Array.isArray(obj.map) || obj.map.length > 1000) return null;
    pairs = [];
    for (i = 0; i < obj.map.length; i++) {
      if (obj.map[i] === null || typeof obj.map[i] !== "object" || Array.isArray(obj.map[i])) return null;
      if (Object.keys(obj.map[i]).length !== 2 || !("k" in obj.map[i]) || !("v" in obj.map[i])) return null;
      k = validateDataNode(obj.map[i].k, depth + 1);
      v = validateDataNode(obj.map[i].v, depth + 1);
      if (!k || !v) return null;
      pairs.push([k, v]);
    }
    return { t: "map", pairs: pairs };
  }
  if (keys.length === 2 && "constructor" in obj && "fields" in obj) {
    s = obj.constructor;
    if (typeof s !== "string" || !/^\d+$/.test(s)) return null;
    idx = BigInt(s);
    if (idx > 18446744073709551615n) return null;
    if (!Array.isArray(obj.fields) || obj.fields.length > 1000) return null;
    fields = [];
    for (i = 0; i < obj.fields.length; i++) {
      n = validateDataNode(obj.fields[i], depth + 1);
      if (!n) return null;
      fields.push(n);
    }
    return { t: "constr", index: idx, fields: fields };
  }
  return null;
}
/* encodePlutusData(jsonText) -> CBOR hex, or null for any input that is
   not exactly one valid Plutus Data value in the detailed JSON schema. */
function encodePlutusData(text) {
  var quoted, root, node, out;
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 65536) return null;
  quoted = text.replace(/"(int|constructor)"\s*:\s*(-?\d+)/g, "\"$1\":\"$2\"");
  try { root = JSON.parse(quoted); } catch (e) { return null; }
  node = validateDataNode(root, 0);
  if (!node) return null;
  out = encodeDataNode(node, 0);
  if (!out) return null;
  return bytesToHex(out);
}

/* Native scripts (multisig / timelock) — the cardano-cli JSON form in,
   the ledger CBOR and the policy ID out. A native script serialises as
   a CBOR array whose first item names the constructor (ledger CDDL):
   [0, key hash] a signature, [1, [scripts]] all-of, [2, [scripts]]
   any-of, [3, n, [scripts]] at-least-n-of, [4, slot] valid after that
   slot ("after"), [5, slot] valid before that slot ("before"). The
   script hash — which is also the policy ID for a minting script — is
   blake2b-224(0x00 || CBOR bytes), the hub's existing native scriptHash.
   Slots and "required" counts travel as decimal TEXT into BigInt (the
   JSON literals are pre-quoted before JSON.parse), so a slot above
   2^53 stays exact instead of being rounded by a float. Every encoding
   and hash here was proven against pycardano 0.19.2's NativeScript
   classes in scratch before wiring. */
var NATIVE_UINT64_MAX = 18446744073709551615n;
function parseScriptUint(v) {
  var b;
  if (typeof v === "string") {
    if (!/^\d+$/.test(v)) return null;
    b = BigInt(v);
  } else if (typeof v === "number") {
    if (!Number.isSafeInteger(v) || v < 0) return null;
    b = BigInt(v);
  } else return null;
  return b <= NATIVE_UINT64_MAX ? b : null;
}
function encodeNativeScript(node, depth, budget) {
  if (depth > 100 || budget.n <= 0) return null;
  budget.n--;
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  function children(list) {
    if (!Array.isArray(list)) return null;
    var bytes = cborHead(4, BigInt(list.length)), j, c;
    for (j = 0; j < list.length; j++) {
      c = encodeNativeScript(list[j], depth + 1, budget);
      if (c === null) return null;
      bytes = bytes.concat(c);
    }
    return bytes;
  }
  switch (node.type) {
    case "sig": {
      var kh = typeof node.keyHash === "string" ? node.keyHash.trim().toLowerCase() : "";
      if (!/^[0-9a-f]{56}$/.test(kh)) return null;
      return cborHead(4, 2n).concat(cborHead(0, 0n), cborHead(2, 28n), hexToBytes(kh));
    }
    case "all":
    case "any": {
      var kids = children(node.scripts);
      if (kids === null) return null;
      return cborHead(4, 2n).concat(cborHead(0, node.type === "all" ? 1n : 2n), kids);
    }
    case "atLeast": {
      var req = parseScriptUint(node.required);
      if (req === null) return null;
      var kids2 = children(node.scripts);
      if (kids2 === null) return null;
      return cborHead(4, 3n).concat(cborHead(0, 3n), cborHead(0, req), kids2);
    }
    case "after":
    case "before": {
      var slot = parseScriptUint(node.slot);
      if (slot === null) return null;
      return cborHead(4, 2n).concat(cborHead(0, node.type === "after" ? 4n : 5n), cborHead(0, slot));
    }
    default: return null;
  }
}
function nativeScript(text) {
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 65536) return null;
  var quoted = text.replace(/"(slot|required)"\s*:\s*(\d+)/g, "\"$1\":\"$2\"");
  var root;
  try { root = JSON.parse(quoted); } catch (e) { return null; }
  var bytes = encodeNativeScript(root, 0, { n: 10000 });
  if (bytes === null) return null;
  var cborHex = bytesToHex(bytes);
  var policyId = scriptHash("native", cborHex);
  if (policyId === null) return null;
  return {
    cbor: cborHex,
    policyId: policyId,
    mainnetAddress: buildAddress("enterprise", "mainnet", policyId, null, "script"),
    testnetAddress: buildAddress("enterprise", "testnet", policyId, null, "script")
  };
}

/* Transaction ID — the identifier every explorer shows for a transaction
   is blake2b-256 of the transaction BODY's CBOR bytes, and nothing else:
   the witness set, the is-valid flag and the auxiliary data are not part
   of it, so a transaction's ID is fixed before it is signed. Input may be
   the body alone (a CBOR map) or a whole transaction (the CBOR array
   [body, witness set, is_valid, auxiliary data] that cardano-cli and
   wallets emit); for a whole transaction the body's exact original bytes
   are taken out by span and hashed — never re-serialised, since the hash
   covers the bytes as transmitted. The body is gated on the ledger's
   required entries with their types (0 inputs: array, 1 outputs: array,
   2 fee: integer) so an arbitrary CBOR map is not mislabelled as a
   transaction; anything else returns null. Capped at the mainnet
   max_tx_size (16,384 bytes). Proven against pycardano 0.19.2:
   Transaction.id agreed with this function on bodies carrying a ttl, a
   validity interval start and an auxiliary data hash, and on the full
   transaction arrays wrapping them. */
function txId(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var node = parsed.node, bodyNode = null, bodyBytes = null, source = null;
  if (node.t === "map") {
    bodyNode = node; bodyBytes = bytes; source = "body";
  } else if (node.t === "array") {
    if (node.items.length !== 3 && node.items.length !== 4) return null;
    if (node.items[0].t !== "map" || node.items[1].t !== "map") return null;
    if (node.items.length === 4 && node.items[2].t !== "bool") return null;
    var ai = bytes[0] & 31;
    if (ai === 31) return null; /* indefinite-length array: not a serialised tx */
    var head = cborReadUint(bytes, 1, ai);
    if (!head) return null;
    var bodyParsed = cborParseItem(bytes, head.next, 0);
    if (!bodyParsed) return null;
    bodyNode = node.items[0];
    bodyBytes = bytes.slice(head.next, bodyParsed.next);
    source = "transaction";
  } else return null;
  var seen = {};
  for (var i = 0; i < bodyNode.pairs.length; i++) {
    var k = bodyNode.pairs[i][0], v = bodyNode.pairs[i][1];
    if (k.t !== "int") return null;
    seen[k.v.toString()] = v;
  }
  if (!seen["0"] || seen["0"].t !== "array") return null;
  if (!seen["1"] || seen["1"].t !== "array") return null;
  if (!seen["2"] || seen["2"].t !== "int") return null;
  var digest = blake2b(bodyBytes, 32);
  if (digest === null) return null;
  return { txId: bytesToHex(digest), source: source, bodyBytes: bodyBytes.length, totalBytes: bytes.length };
}

/* Current slot/epoch derived from the local clock + the fixed parameters
   above. An estimate from wall-clock time, NOT live chain data. */
function nowSlotEpoch(nowMs) {
  var unix = Math.floor((typeof nowMs === "number" ? nowMs : Date.now()) / 1000);
  if (unix < SYSTEM_START_UNIX) return null;
  if (unix < SHELLEY_START_UNIX) {
    return slotToEpoch(String(Math.floor((unix - SYSTEM_START_UNIX) / BYRON_SLOT_SECONDS)));
  }
  return slotToEpoch(String(SHELLEY_START_SLOT + (unix - SHELLEY_START_UNIX)));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { verifyBech32, inspectAddress, adaToLovelace, lovelaceToAda, bech32Encode, slotToEpoch, epochStart, nowSlotEpoch, stakingEstimate, poolRewardSplit, minFee, exunitCost, refScriptFee, totalTxFee, depositTotal, minUtxo, poolIdFromHex, poolIdToHex, blake2b160, blake2b, assetFingerprint, assetUnit, assetNameText, parseAssetUnit, datumHash, scriptHash, keyHash, buildAddress, decodeAddress, addressToHex, addressFromHex, govCredBech32, govCredLegacyBech32, govActionBech32, parseGovId, decodeCbor, encodePlutusData, nativeScript, txId, bech32DecodeBytes, convertBits, hexToBytes };
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    /* --- project filtering --- */
    var cards = Array.prototype.slice.call(document.querySelectorAll("#cards .card"));
    var q = document.getElementById("q");
    var status = document.getElementById("filter-status");
    var noResults = document.getElementById("no-results");
    var activeFilter = "all";
    function applyFilter() {
      var needle = (q.value || "").toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var catOk = activeFilter === "all" || (card.getAttribute("data-cat") || "").split(" ").indexOf(activeFilter) !== -1;
        var textOk = !needle || (card.getAttribute("data-name") + " " + card.textContent).toLowerCase().indexOf(needle) !== -1;
        var show = catOk && textOk;
        card.hidden = !show;
        if (show) shown++;
      });
      noResults.hidden = shown !== 0;
      status.textContent = shown + (shown === 1 ? " project shown" : " projects shown");
    }
    q.addEventListener("input", applyFilter);
    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        activeFilter = chip.getAttribute("data-filter");
        applyFilter();
      });
    });
    applyFilter();

    /* --- address inspector --- */
    document.getElementById("inspector").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = inspectAddress(document.getElementById("addr").value);
      document.getElementById("addr-result").textContent = res.message;
    });

    /* --- converter (two-way, whichever field changed last) --- */
    var adaInput = document.getElementById("ada");
    var lovInput = document.getElementById("lovelace");
    var convResult = document.getElementById("conv-result");
    adaInput.addEventListener("input", function () {
      var out = adaToLovelace(adaInput.value);
      if (adaInput.value.trim() === "") { lovInput.value = ""; convResult.textContent = ""; return; }
      lovInput.value = out === null ? "" : out;
      convResult.textContent = out === null ? "Enter an ADA amount with at most 6 decimal places." : adaInput.value.trim() + " ADA = " + out + " lovelace";
    });
    lovInput.addEventListener("input", function () {
      var out = lovelaceToAda(lovInput.value);
      if (lovInput.value.trim() === "") { adaInput.value = ""; convResult.textContent = ""; return; }
      adaInput.value = out === null ? "" : out;
      convResult.textContent = out === null ? "Lovelace must be a whole number." : lovInput.value.trim() + " lovelace = " + out + " ADA";
    });

    /* --- epoch / slot calculator (two-way, offline from protocol constants) --- */
    var slotInput = document.getElementById("slot");
    var epochInput = document.getElementById("epoch");
    var epochResult = document.getElementById("epoch-result");
    function fmtUnix(u) { return new Date(u * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC"); }
    slotInput.addEventListener("input", function () {
      var res = slotToEpoch(slotInput.value);
      if (slotInput.value.trim() === "") { epochInput.value = ""; epochResult.textContent = ""; return; }
      if (!res) { epochResult.textContent = "Enter a whole slot number (0 or higher)."; return; }
      epochInput.value = String(res.epoch);
      epochResult.textContent = "Slot " + slotInput.value.trim() + " is in epoch " + res.epoch +
        " (" + res.era + " era), slot " + res.slotInEpoch + " of " + res.epochSlots +
        " in that epoch · " + fmtUnix(res.unixSeconds);
    });
    epochInput.addEventListener("input", function () {
      var res = epochStart(epochInput.value);
      if (epochInput.value.trim() === "") { slotInput.value = ""; epochResult.textContent = ""; return; }
      if (!res) { epochResult.textContent = "Enter a whole epoch number (0 or higher)."; return; }
      slotInput.value = String(res.slot);
      epochResult.textContent = "Epoch " + epochInput.value.trim() + " starts at slot " + res.slot +
        " · " + fmtUnix(res.unixSeconds);
    });
    /* --- staking rewards estimator (modelled, exact BigInt maths) --- */
    document.getElementById("stakingcalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = stakingEstimate(
        document.getElementById("stake-ada").value,
        document.getElementById("stake-rate").value,
        document.getElementById("stake-epochs").value);
      var out = document.getElementById("stake-result");
      if (!res) {
        out.textContent = "Enter a stake amount (up to 6 decimals), an annual rate from 0 to 100% (up to 4 decimals), and 1 to 3650 epochs.";
        return;
      }
      out.textContent = "First epoch ≈ " + lovelaceToAda(res.firstEpochRewardLovelace) + " ADA · total over " +
        res.epochs + (res.epochs === 1 ? " epoch" : " epochs") + " ≈ " + lovelaceToAda(res.totalRewardLovelace) +
        " ADA · ending stake ≈ " + lovelaceToAda(res.finalLovelace) +
        " ADA. Modelled estimate only — actual pool rewards vary and are not promised.";
    });

    /* --- pool reward split (ledger reward-sharing rule, exact BigInt maths) --- */
    document.getElementById("poolsplit").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = poolRewardSplit(
        document.getElementById("pool-rewards").value,
        document.getElementById("pool-cost").value,
        document.getElementById("pool-margin").value,
        document.getElementById("pool-owner-stake").value,
        document.getElementById("pool-total-stake").value,
        document.getElementById("pool-member-stake").value);
      var out = document.getElementById("pool-split-result");
      if (!res) {
        out.textContent = "Enter the epoch rewards, the pool's fixed cost and margin (0 to 100%), and stake amounts — the total pool stake must be above zero, and the operator's stake plus the delegator's stake cannot exceed it. Amounts take up to 6 decimals.";
        return;
      }
      out.textContent = "Of " + lovelaceToAda(res.rewardsLovelace) + " ADA in pool rewards: the operator receives " +
        lovelaceToAda(res.operatorLovelace) + " ADA (fixed cost + margin + the operator's own stake share) · this delegator receives " +
        lovelaceToAda(res.memberLovelace) + " ADA · all other delegators together receive " +
        lovelaceToAda(res.othersLovelace) + " ADA. Split by the ledger's reward-sharing rule — it divides a reward total you supply, it does not predict what a pool will earn.";
    });

    /* --- transaction minimum fee (size-based, exact BigInt maths) --- */
    document.getElementById("feecalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = minFee(document.getElementById("fee-size").value);
      var out = document.getElementById("fee-result");
      if (!res) {
        out.textContent = "Enter a whole transaction size in bytes, from 1 to 16384 (the mainnet maximum transaction size).";
        return;
      }
      out.textContent = "Minimum fee for a " + res.sizeBytes + "-byte transaction = " + res.feeLovelace +
        " lovelace (" + lovelaceToAda(res.feeLovelace) + " ADA). Size-based minimum only — Plutus script execution and reference scripts cost extra, and a wallet may pay above the minimum.";
    });

    /* --- Plutus execution cost (ledger txscriptfee, exact BigInt maths) --- */
    document.getElementById("exunitcalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = exunitCost(
        document.getElementById("exunit-mem").value,
        document.getElementById("exunit-steps").value);
      var out = document.getElementById("exunit-result");
      if (!res) {
        out.textContent = "Enter whole execution units — memory from 0 to 16,500,000 and steps from 0 to 10,000,000,000 (the per-transaction protocol maxima).";
        return;
      }
      out.textContent = "Execution cost for " + res.memUnits + " memory units and " + res.stepUnits +
        " steps = " + res.costLovelace + " lovelace (" + lovelaceToAda(res.costLovelace) +
        " ADA), the exact " + res.exactLovelace + " lovelace rounded up once, as the ledger rounds it. " +
        "This is the script part of the fee only — the size-based fee comes on top, and a wallet may pay above the minimum.";
    });

    /* --- reference script fee (ledger tierRefScriptFee, exact BigInt maths) --- */
    document.getElementById("refscriptcalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = refScriptFee(document.getElementById("refscript-size").value);
      var out = document.getElementById("refscript-result");
      if (!res) {
        out.textContent = "Enter a whole number of bytes from 0 to 1,048,576 (the per-block limit for reference scripts).";
        return;
      }
      out.textContent = "Reference script fee for " + res.sizeBytes + " bytes = " + res.feeLovelace +
        " lovelace (" + lovelaceToAda(res.feeLovelace) + " ADA)" +
        (res.exactLovelace && res.exactLovelace !== res.feeLovelace
          ? ", the exact " + res.exactLovelace + " lovelace floored once, as the ledger floors it"
          : "") +
        ". This comes on top of the size-based fee and any execution cost." +
        (res.overTxLimit
          ? " Warning: that is over the 204,800-byte per-transaction limit — no single transaction can carry that much reference script; split it across transactions."
          : "");
    });

    /* --- total minimum fee (size + execution + reference scripts) --- */
    document.getElementById("totalfeecalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = totalTxFee(
        document.getElementById("total-size").value,
        document.getElementById("total-mem").value,
        document.getElementById("total-steps").value,
        document.getElementById("total-ref").value);
      var out = document.getElementById("totalfee-result");
      if (!res) {
        out.textContent = "Enter the whole transaction: size 1 to 16,384 bytes; memory 0 to 16,500,000 units and steps 0 to 10,000,000,000 (0 if it runs no Plutus script); reference scripts 0 to 204,800 bytes total (0 if it uses none). Each limit is a per-transaction protocol maximum — past one, no valid transaction exists to price.";
        return;
      }
      out.textContent = "Total minimum fee = " + res.totalLovelace + " lovelace (" + lovelaceToAda(res.totalLovelace) +
        " ADA): size fee " + res.sizeFeeLovelace + " + execution cost " + res.exunitFeeLovelace +
        " + reference script fee " + res.refScriptFeeLovelace + " lovelace. This is the ledger minimum for the figures entered — a wallet may pay above it, and this prices the units entered; measuring a script to find its units is node work.";
    });

    /* --- ledger deposits calculator (refundable registration deposits) --- */
    document.getElementById("depositcalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = depositTotal(
        document.getElementById("dep-stake").value,
        document.getElementById("dep-pool").value,
        document.getElementById("dep-drep").value,
        document.getElementById("dep-gov").value);
      var out = document.getElementById("deposit-result");
      if (!res) {
        out.textContent = "Enter whole-number counts (0 to 10,000 each) for every field: stake credential registrations, NEW stake pool registrations, DRep registrations and governance action proposals in the transaction.";
        return;
      }
      out.textContent = "Total deposits = " + res.totalLovelace + " lovelace (" + lovelaceToAda(res.totalLovelace) +
        " ADA): stake registrations " + res.stakeLovelace + " + new pools " + res.poolLovelace +
        " + DReps " + res.drepLovelace + " + governance actions " + res.govLovelace +
        " lovelace. Deposits are refundable — they come back on deregistration, pool retirement, or when a governance action is enacted or expires; they are not fees. Updating an existing pool charges no new pool deposit.";
    });

    /* --- transaction ID (blake2b-256 of the body CBOR) --- */
    document.getElementById("txidcalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = txId(document.getElementById("txid-input").value);
      var out = document.getElementById("txid-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of a transaction body (a CBOR map holding inputs, outputs and fee) or of a whole transaction (the CBOR array of body, witness set, is-valid flag and auxiliary data), at most 16,384 bytes. A datum, a script or any other CBOR item is not a transaction body and has no transaction ID.";
        return;
      }
      out.textContent = "Transaction ID: " + res.txId + (res.source === "transaction"
        ? " — taken from the body inside the full transaction (" + res.bodyBytes + " of " + res.totalBytes + " bytes); the witness set, is-valid flag and auxiliary data are not part of the ID, so it does not change when the transaction is signed."
        : " — blake2b-256 of the " + res.bodyBytes + "-byte body; the ID is fixed before signing, since witnesses are not part of it.");
    });

    /* --- minimum-UTxO calculator (ledger formula, serialised size) --- */
    document.getElementById("minutxo").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var out = document.getElementById("minutxo-result");
      var assets = [], badLine = false;
      document.getElementById("minutxo-assets").value.split("\n").forEach(function (line) {
        var parts = line.split(",").map(function (p) { return p.trim(); });
        if (parts.length === 1 && parts[0] === "") return;
        if (parts.length !== 3) { badLine = true; return; }
        assets.push({ policy: parts[0], name: parts[1], quantity: parts[2] });
      });
      var spec = {
        address: document.getElementById("minutxo-addr").value,
        assets: assets,
        datumKind: document.getElementById("minutxo-datum-kind").value,
        datumHex: document.getElementById("minutxo-datum-hex").value,
        scriptKind: document.getElementById("minutxo-script-kind").value,
        scriptHex: document.getElementById("minutxo-script-hex").value
      };
      var res = badLine ? null : minUtxo(spec);
      if (!res) {
        out.textContent = "Check the inputs: a Shelley payment address (base, enterprise or pointer — reward addresses can't receive outputs); each asset line as policy ID (56 hex), asset name hex (may be empty), quantity (a whole number, at most 18446744073709551615), with no asset listed twice; a datum hash is exactly 64 hex characters, an inline datum is its CBOR hex; a reference script is its CBOR hex (native) or its script-bytes hex (Plutus).";
        return;
      }
      out.textContent = "Minimum for this output = " + res.lovelace + " lovelace (" + lovelaceToAda(res.lovelace) +
        " ADA). The output serialises to " + res.sizeBytes + " bytes in the current (Babbage) form, and the ledger minimum is (160 + " +
        res.sizeBytes + ") x 4,310 lovelace at the current mainnet protocol parameter (coins_per_utxo_size, epoch 660). " +
        "An output holding less is rejected by the ledger; wallets normally add a safety margin on top.";
    });

    /* --- pool ID converter (two-way, offline bech32 <-> hex) --- */
    var poolHexInput = document.getElementById("pool-hex");
    var poolBechInput = document.getElementById("pool-bech32");
    var poolResult = document.getElementById("pool-result");
    poolHexInput.addEventListener("input", function () {
      var out = poolIdFromHex(poolHexInput.value);
      if (poolHexInput.value.trim() === "") { poolBechInput.value = ""; poolResult.textContent = ""; return; }
      poolBechInput.value = out === null ? "" : out;
      poolResult.textContent = out === null ? "Enter the pool ID as exactly 56 hex characters (28 bytes)." : "Pool ID in bech32 form: " + out;
    });
    poolBechInput.addEventListener("input", function () {
      var out = poolIdToHex(poolBechInput.value);
      if (poolBechInput.value.trim() === "") { poolHexInput.value = ""; poolResult.textContent = ""; return; }
      poolHexInput.value = out === null ? "" : out;
      poolResult.textContent = out === null ? "Enter a valid bech32 pool ID (starts with pool1, checksum must verify)." : "Pool ID in hex form: " + out;
    });

    /* --- asset fingerprint (CIP-14, one-way, offline) --- */
    document.getElementById("assetfp").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = assetFingerprint(
        document.getElementById("asset-policy").value,
        document.getElementById("asset-name").value);
      var out = document.getElementById("asset-result");
      if (!res) {
        out.textContent = "Enter the policy ID as exactly 56 hex characters and the asset name as hex (0 to 64 hex characters, empty allowed).";
        return;
      }
      out.textContent = "Asset fingerprint (CIP-14): " + res + " — the one-way user-facing ID for this asset; it cannot be reversed back to the policy ID and asset name.";
    });

    /* --- asset unit decoder (unit hex -> policy + name + CIP-14 fingerprint, offline) --- */
    document.getElementById("assetunit").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var out = document.getElementById("unit-result");
      var res = parseAssetUnit(document.getElementById("unit-input").value);
      if (!res) {
        out.textContent = "Enter an asset unit as hex: the 56-character policy ID followed by the asset name in hex (0 to 64 more characters). An asset1… fingerprint is a one-way hash, not a unit — it cannot be decoded back to the policy ID and name.";
        return;
      }
      var lines = ["Policy ID: " + res.policyHex];
      lines.push(res.nameHex === "" ? "Asset name: (empty — the asset has no name bytes)" :
        "Asset name (hex): " + res.nameHex);
      if (res.nameHex !== "" && res.nameText !== null) lines.push("Asset name as text: " + res.nameText);
      if (res.nameHex !== "" && res.nameText === null) lines.push("Asset name as text: not readable text (the name bytes are not printable UTF-8) — the hex above is the exact name.");
      lines.push("Fingerprint (CIP-14): " + res.fingerprint);
      out.textContent = lines.join("\n");
    });

    /* --- datum & script hashes (blake2b, offline) --- */
    document.getElementById("hashcalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var kind = document.getElementById("hash-kind").value;
      var raw = document.getElementById("hash-bytes").value;
      var out = document.getElementById("hash-result");
      var res = kind === "datum" ? datumHash(raw) : scriptHash(kind, raw);
      if (!res) {
        out.textContent = "Enter the bytes as hex (whole bytes, at least one). For a datum that is the CBOR of the Plutus Data; for a Plutus script, the flat script bytes (a blueprint's compiledCode), not the CBOR-wrapped form.";
        return;
      }
      if (kind === "datum") {
        out.textContent = "Datum hash (blake2b-256 of the data CBOR): " + res;
      } else {
        var label = { native: "Native script", plutusv1: "PlutusV1", plutusv2: "PlutusV2", plutusv3: "PlutusV3" }[kind];
        out.textContent = label + " script hash (blake2b-224 of the language tag + script bytes): " + res + " — for a minting script this hash is its policy ID.";
      }
    });

    /* --- key hashes & address builder (offline, from verification keys) --- */
    document.getElementById("keyaddr").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var network = document.getElementById("key-network").value;
      var payKey = document.getElementById("key-pay").value;
      var stakeKey = document.getElementById("key-stake").value;
      var out = document.getElementById("key-result");
      var payHash = keyHash(payKey);
      if (payHash === null) {
        out.textContent = "Enter the payment verification key as exactly 64 hex characters (32 bytes). This tool works on public verification keys only — never paste a private or signing key anywhere.";
        return;
      }
      var lines = ["Payment key hash (blake2b-224 of the verification key): " + payHash];
      lines.push("Enterprise address (" + network + ", payment key only, cannot earn staking rewards): " +
        buildAddress("enterprise", network, payHash, null));
      if (stakeKey.trim() !== "") {
        var stakeHash = keyHash(stakeKey);
        if (stakeHash === null) {
          out.textContent = "The stake verification key must be exactly 64 hex characters (32 bytes), or left empty.";
          return;
        }
        lines.push("Stake key hash: " + stakeHash);
        lines.push("Base address (" + network + ", payment + stake — the normal wallet address): " +
          buildAddress("base", network, payHash, stakeHash));
        lines.push("Reward address (" + network + ", where staking rewards land): " +
          buildAddress("reward", network, null, stakeHash));
      }
      out.textContent = lines.join("\n");
    });

    /* --- address builder from credential hashes (key or script, offline) --- */
    document.getElementById("hashaddr").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var network = document.getElementById("cred-network").value;
      var payHash = document.getElementById("cred-pay").value;
      var payCred = document.getElementById("cred-pay-kind").value;
      var stakeHash = document.getElementById("cred-stake").value;
      var stakeCred = document.getElementById("cred-stake-kind").value;
      var out = document.getElementById("cred-result");
      if (keyHashHex(payHash) === null) {
        out.textContent = "Enter the payment credential hash as exactly 56 hex characters (28 bytes) — a key hash from the tool above, or a script hash (a minting script's hash is its policy ID).";
        return;
      }
      var lines = ["Enterprise address (" + network + ", payment " + payCred + " only" +
        (payCred === "script" ? " — funds sent here can only be spent by the script" : ", cannot earn staking rewards") + "): " +
        buildAddress("enterprise", network, payHash, null, payCred, stakeCred)];
      if (stakeHash.trim() !== "") {
        if (keyHashHex(stakeHash) === null) {
          out.textContent = "The stake credential hash must be exactly 56 hex characters (28 bytes), or left empty.";
          return;
        }
        lines.push("Base address (" + network + ", payment " + payCred + " + stake " + stakeCred + " — the full address): " +
          buildAddress("base", network, payHash, stakeHash, payCred, stakeCred));
        lines.push("Reward address (" + network + ", stake " + stakeCred + ", where staking rewards land): " +
          buildAddress("reward", network, null, stakeHash, payCred, stakeCred));
      }
      out.textContent = lines.join("\n");
    });

    /* --- address decoder (CIP-19 header + credentials, offline) --- */
    document.getElementById("addrdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var out = document.getElementById("decode-result");
      var res = decodeAddress(document.getElementById("decode-addr").value);
      if (!res) {
        out.textContent = "Enter a valid Shelley-era address (base, pointer, enterprise or reward, with a verifying bech32 checksum). Byron addresses predate the header-byte layout and are not decoded here.";
        return;
      }
      var lines = [res.typeLabel + " · " + res.network + " · header byte 0x" + res.header.toString(16).padStart(2, "0") + " (type " + res.type + ")"];
      if (res.paymentHash) lines.push("Payment credential (" + res.paymentKind + " hash): " + res.paymentHash);
      if (res.stakeHash) lines.push("Stake credential (" + res.stakeKind + " hash): " + res.stakeHash);
      if (res.pointerHex) lines.push("Stake pointer (raw bytes, a chain pointer instead of a stake credential): " + res.pointerHex);
      if (res.enterprise && res.type !== 6 && res.type !== 7) lines.push("Its enterprise address (payment credential only — cannot earn staking rewards): " + res.enterprise);
      if (res.reward && res.type !== 14 && res.type !== 15) lines.push("Its reward address (where this stake's rewards land): " + res.reward);
      out.textContent = lines.join("\n");
    });

    /* --- address hex <-> bech32 converter (two-way, offline) --- */
    var addrBechInput = document.getElementById("addrhex-bech32");
    var addrHexInput = document.getElementById("addrhex-hex");
    var addrHexResult = document.getElementById("addrhex-result");
    addrBechInput.addEventListener("input", function () {
      var out = addressToHex(addrBechInput.value);
      if (addrBechInput.value.trim() === "") { addrHexInput.value = ""; addrHexResult.textContent = ""; return; }
      addrHexInput.value = out === null ? "" : out;
      addrHexResult.textContent = out === null ? "Enter a valid Shelley address (base, pointer, enterprise or reward, with a verifying bech32 checksum). Byron addresses have no header-byte form and do not convert." : "Address in hex form (the form CIP-30 wallets return): " + out;
    });
    addrHexInput.addEventListener("input", function () {
      var out = addressFromHex(addrHexInput.value);
      if (addrHexInput.value.trim() === "") { addrBechInput.value = ""; addrHexResult.textContent = ""; return; }
      addrBechInput.value = out === null ? "" : out;
      addrHexResult.textContent = out === null ? "Enter the address bytes as hex (a Shelley header byte followed by 28-byte credential hashes — 58 hex characters for enterprise/reward, 114 for base)." : "Address in bech32 form: " + out;
    });

    /* --- governance ID converter (CIP-129 / legacy CIP-105, offline) --- */
    document.getElementById("govid").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var out = parseGovId(document.getElementById("gov-input").value);
      var el = document.getElementById("gov-result");
      if (out === null) {
        el.textContent = "Enter a governance ID: a CIP-129 bech32 ID (drep1…, cc_hot1…, cc_cold1…, gov_action1…), a legacy CIP-105 bech32 ID (including the *_script forms), or the hex payload (header byte + 28-byte hash, or transaction ID + one index byte). A bare 28-byte hash cannot be converted — its kind is not in the hash.";
        return;
      }
      if (out.kind === "gov_action") {
        el.textContent = out.kindLabel + " (" + out.format + ")\n" +
          "Transaction ID: " + out.txId + "\n" +
          "Action index: " + out.index + " — written in text form as " + out.legacy + "\n" +
          "Bech32 (CIP-129): " + out.cip129 + "\n" +
          "Hex payload: " + out.payloadHex;
        return;
      }
      el.textContent = out.kindLabel + " — " + (out.credKind === "key" ? "key hash" : "script hash") + " credential (" + out.format + " form entered)\n" +
        "Credential hash: " + out.hashHex + "\n" +
        "CIP-129 form: " + out.cip129 + "\n" +
        "Legacy CIP-105 form: " + out.legacy + "\n" +
        "Hex payload (CIP-129, header + hash): " + out.payload129Hex;
    });

    /* --- CBOR / Plutus Data decoder (RFC 8949, offline, display only) --- */
    document.getElementById("cbordecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var out = document.getElementById("cbor-result");
      var res = decodeCbor(document.getElementById("cbor-input").value);
      if (res === null) {
        out.textContent = "Enter exactly one complete CBOR item as hex — a datum's CBOR from an explorer or cardano-cli, for example. Truncated input, trailing bytes after the item, and text strings that are not valid UTF-8 are rejected.";
        return;
      }
      out.textContent = res + "\nDecoded locally from the CBOR bytes (RFC 8949) — integers are exact, byte strings show as h'…', and Plutus constructors show as Constr. Decoding shows structure only; it does not verify that a datum matches any particular script's schema.";
    });

    /* --- Plutus Data encoder (detailed JSON -> CBOR + datum hash) --- */
    document.getElementById("dataencode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var out = document.getElementById("data-result");
      var hex = encodePlutusData(document.getElementById("data-input").value);
      if (hex === null) {
        out.textContent = "Enter exactly one Plutus Data value in the detailed JSON form — {\"int\": …}, {\"bytes\": \"…\"}, {\"list\": […]}, {\"map\": [{\"k\": …, \"v\": …}]} or {\"constructor\": …, \"fields\": […]}. Unknown keys, odd-length byte hex and negative constructor indices are rejected.";
        return;
      }
      out.textContent = "CBOR: " + hex + "\nDatum hash: " + datumHash(hex) + "\nReads back as: " + decodeCbor(hex) + "\nEncoded locally — integers are exact at any size (never read through a floating-point number), byte strings over 64 bytes are chunked the way Plutus requires, and the datum hash is the blake2b-256 of these exact CBOR bytes.";
    });

    /* --- native script (multisig / timelock): policy ID, CBOR, script address --- */
    document.getElementById("nativescript").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var out = document.getElementById("native-result");
      var res = nativeScript(document.getElementById("native-input").value);
      if (res === null) {
        out.textContent = "Enter one native script as cardano-cli JSON: {\"type\":\"sig\",\"keyHash\":\"…\"} (keyHash is exactly 56 hex characters), {\"type\":\"all\",\"scripts\":[…]}, {\"type\":\"any\",\"scripts\":[…]}, {\"type\":\"atLeast\",\"required\":2,\"scripts\":[…]}, {\"type\":\"after\",\"slot\":…} or {\"type\":\"before\",\"slot\":…}. Scripts nest freely; slots and counts are whole numbers.";
        return;
      }
      out.textContent = "Policy ID (script hash): " + res.policyId + "\nCBOR: " + res.cbor + "\nScript address (mainnet): " + res.mainnetAddress + "\nScript address (testnet): " + res.testnetAddress + "\nComputed locally, offline. The script address is the enterprise address locked by this script — funds sent there can only be spent when the script's conditions are met.";
    });

    var now = nowSlotEpoch(Date.now());
    if (now) {
      document.getElementById("epoch-now").textContent =
        "By your device clock it is about slot " + now.slot +
        ", epoch " + now.epoch + " — computed offline from the fixed protocol parameters, not live chain data.";
    }

    /* --- copy donation address --- */
    document.getElementById("copy-address").addEventListener("click", function () {
      var addr = document.getElementById("donation-address").textContent.trim();
      var done = function () { document.getElementById("copy-status").textContent = "ADA address copied."; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addr).then(done, function () {
          document.getElementById("copy-status").textContent = "Copy failed — select the address text manually.";
        });
      } else {
        document.getElementById("copy-status").textContent = "Select the address text to copy it.";
      }
    });
  });
}
