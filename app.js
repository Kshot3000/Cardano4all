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
   required entries with their types (0 inputs, 1 outputs: array,
   2 fee: integer) so an arbitrary CBOR map is not mislabelled as a
   transaction; anything else returns null. Inputs may be a plain array
   OR a CBOR set (tag 258) — the CDDL's set<transaction_input> allows
   both, and most mainnet transactions today use the set form; an
   earlier version of this function accepted only the array form and
   rejected real set-encoded transactions (fixed 2026-10-08, proven by
   the mainnet vector in the tests whose computed ID equals its
   on-chain hash). Capped at the mainnet max_tx_size (16,384 bytes).
   Proven against pycardano 0.19.2: Transaction.id agreed with this
   function on bodies carrying a ttl, a validity interval start and an
   auxiliary data hash, and on the full transaction arrays wrapping
   them. */
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
  var inputsNode = seen["0"];
  if (!inputsNode || !(inputsNode.t === "array" ||
      (inputsNode.t === "tag" && inputsNode.n === 258n && inputsNode.item.t === "array"))) return null;
  if (!seen["1"] || seen["1"].t !== "array") return null;
  if (!seen["2"] || seen["2"].t !== "int") return null;
  var digest = blake2b(bodyBytes, 32);
  if (digest === null) return null;
  return { txId: bytesToHex(digest), source: source, bodyBytes: bodyBytes.length, totalBytes: bytes.length };
}

/* Transaction inspector — decode a transaction body (or a whole
   transaction; the body is taken out of it) into what it actually does:
   inputs, outputs with addresses/values/assets/datums/reference
   scripts, the declared fee, validity interval, withdrawals, mint,
   collateral, signers, governance entry counts and hashes. Field
   numbering follows the Conway ledger CDDL exactly (eras/conway
   cddl): 0 inputs, 1 outputs, 2 fee, 3 ttl, 4 certificates,
   5 withdrawals, 7 auxiliary data hash, 8 validity interval start,
   9 mint, 11 script data hash, 13 collateral, 14 required signers,
   15 network id, 16 collateral return, 17 total collateral,
   18 reference inputs, 19 voting procedures, 20 proposal procedures,
   21 current treasury value, 22 donation — keys 6/10/12 do not exist
   in the Conway body. (The shifted numbering was verified three ways:
   the CDDL file itself, two independent libraries, and a real mainnet
   Plutus transaction from block 14,040,547 decoded field-by-field —
   that vector is in the tests, and its computed ID equals its
   on-chain hash.) Gated on the proven txId() above; anything txId
   rejects, and any malformed sub-structure (a bad input reference, an
   output that does not parse, a negative fee, a zero or out-of-int64-
   range mint quantity), returns null — refuse, never guess. Outputs
   accept both serialisations the ledger allows (the Babbage map form
   and the Alonzo array form). Output addresses are re-encoded from
   their raw bytes and gated on the proven CIP-19 decoder; a payload
   that is not a Shelley address (Byron-era, malformed) is reported
   with address null and its hex shown instead. Honest limit, stated
   on the page too: a body names inputs by reference only, so input
   amounts are not in the body and no balance check is possible from
   it — the fee shown is the fee the body declares. Proven against
   pycardano 0.19.2 in scratch: four bodies/full transactions covering
   every field above matched field-for-field, plus the real mainnet
   transaction. */
function inspectTx(raw) {
  var idRes = txId(raw);
  if (idRes === null) return null;
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  var parsed = cborParseItem(bytes, 0, 0);
  var bodyNode = parsed.node.t === "map" ? parsed.node : parsed.node.items[0];
  var seen = {};
  for (var i = 0; i < bodyNode.pairs.length; i++) {
    var bk = bodyNode.pairs[i][0], bv = bodyNode.pairs[i][1];
    if (bk.t !== "int") return null;
    var bks = bk.v.toString();
    if (seen[bks] !== undefined) return null; /* duplicate body key */
    seen[bks] = bv;
  }
  function unwrapSet(n) { return (n.t === "tag" && n.n === 258n && n.item.t === "array") ? n.item : n; }
  function safeNum(v) { return v <= 9007199254740991n ? Number(v) : null; }
  function parseRef(n) {
    if (n.t !== "array" || n.items.length !== 2) return null;
    if (n.items[0].t !== "bytes" || n.items[0].bytes.length !== 32) return null;
    if (n.items[1].t !== "int" || n.items[1].v < 0n) return null;
    var idx = safeNum(n.items[1].v);
    return idx === null ? null : { txHash: bytesToHex(n.items[0].bytes), index: idx };
  }
  function parseRefList(n) {
    n = unwrapSet(n);
    if (n.t !== "array") return null;
    var out = [];
    for (var j = 0; j < n.items.length; j++) { var r = parseRef(n.items[j]); if (r === null) return null; out.push(r); }
    return out;
  }
  function parseMultiAsset(n, forMint) {
    if (n.t !== "map") return null;
    var out = [];
    for (var a = 0; a < n.pairs.length; a++) {
      var pol = n.pairs[a][0], names = n.pairs[a][1];
      if (pol.t !== "bytes" || pol.bytes.length !== 28 || names.t !== "map") return null;
      for (var b = 0; b < names.pairs.length; b++) {
        var nm = names.pairs[b][0], qty = names.pairs[b][1];
        if (nm.t !== "bytes" || nm.bytes.length > 32 || qty.t !== "int") return null;
        if (forMint ? (qty.v === 0n || qty.v < -9223372036854775808n || qty.v > 9223372036854775807n) : qty.v <= 0n) return null;
        var nameHex = bytesToHex(nm.bytes);
        out.push({ policy: bytesToHex(pol.bytes), name: nameHex, nameText: assetNameText(nameHex), quantity: qty.v.toString() });
      }
    }
    out.sort(function (x, y) { return (x.policy + x.name) < (y.policy + y.name) ? -1 : 1; });
    return out;
  }
  function parseValue(n) {
    if (n.t === "int") return n.v < 0n ? null : { lovelace: n.v.toString(), assets: [] };
    if (n.t === "array" && n.items.length === 2 && n.items[0].t === "int" && n.items[0].v >= 0n) {
      var assets = parseMultiAsset(n.items[1], false);
      return assets === null ? null : { lovelace: n.items[0].v.toString(), assets: assets };
    }
    return null;
  }
  function addressFromBytes(bts) {
    if (!bts.length) return null;
    var header = bts[0], type = header >> 4, net = header & 15;
    if (net !== 0 && net !== 1) return null;
    var isReward = type === 14 || type === 15;
    var hrp = isReward ? (net === 1 ? "stake" : "stake_test") : (net === 1 ? "addr" : "addr_test");
    var s = encodeAddressBytes(hrp, bts);
    if (s === null) return null;
    return decodeAddress(s) !== null ? s : null;
  }
  function parseDatumOption(n) {
    if (n.t !== "array" || n.items.length !== 2 || n.items[0].t !== "int") return "bad";
    if (n.items[0].v === 0n) {
      return (n.items[1].t === "bytes" && n.items[1].bytes.length === 32) ? { kind: "hash", hash: bytesToHex(n.items[1].bytes) } : "bad";
    }
    if (n.items[0].v === 1n) {
      return (n.items[1].t === "tag" && n.items[1].n === 24n && n.items[1].item.t === "bytes") ? { kind: "inline", hex: bytesToHex(n.items[1].item.bytes) } : "bad";
    }
    return "bad";
  }
  function parseScriptRef(n) {
    if (n.t !== "tag" || n.n !== 24n || n.item.t !== "bytes") return "bad";
    var inner = cborParseItem(n.item.bytes, 0, 0);
    if (!inner || inner.next !== n.item.bytes.length || inner.node.t !== "array" || !inner.node.items.length || inner.node.items[0].t !== "int") return "bad";
    var lang = inner.node.items[0].v;
    if (lang === 0n) return "native";
    if (lang === 1n) return "plutus1";
    if (lang === 2n) return "plutus2";
    if (lang === 3n) return "plutus3";
    return "bad";
  }
  function parseOutput(n) {
    if (n.t === "map") {
      var m = {};
      for (var a = 0; a < n.pairs.length; a++) {
        var kk = n.pairs[a][0];
        if (kk.t !== "int") return null;
        var kks = kk.v.toString();
        if (m[kks] !== undefined) return null;
        m[kks] = n.pairs[a][1];
      }
      if (!m["0"] || m["0"].t !== "bytes" || !m["1"]) return null;
      var val = parseValue(m["1"]); if (val === null) return null;
      var datum = { kind: "none" };
      if (m["2"] !== undefined) { datum = parseDatumOption(m["2"]); if (datum === "bad") return null; }
      var sref = null;
      if (m["3"] !== undefined) { sref = parseScriptRef(m["3"]); if (sref === "bad") return null; }
      for (var key in m) if (["0", "1", "2", "3"].indexOf(key) < 0) return null;
      return { address: addressFromBytes(m["0"].bytes), addressHex: bytesToHex(m["0"].bytes), lovelace: val.lovelace, assets: val.assets, datum: datum, scriptRef: sref };
    }
    if (n.t === "array") {
      if (n.items.length < 2 || n.items.length > 3 || n.items[0].t !== "bytes") return null;
      var val2 = parseValue(n.items[1]); if (val2 === null) return null;
      var datum2 = { kind: "none" };
      if (n.items.length === 3) {
        if (n.items[2].t !== "bytes" || n.items[2].bytes.length !== 32) return null;
        datum2 = { kind: "hash", hash: bytesToHex(n.items[2].bytes) };
      }
      return { address: addressFromBytes(n.items[0].bytes), addressHex: bytesToHex(n.items[0].bytes), lovelace: val2.lovelace, assets: val2.assets, datum: datum2, scriptRef: null };
    }
    return null;
  }
  function uintField(key) {
    var n = seen[key];
    if (n === undefined) return null;
    if (n.t !== "int" || n.v < 0n) return "bad";
    return n.v;
  }

  var inputs = parseRefList(seen["0"]); if (inputs === null) return null;
  var outputs = [], outTotal = 0n;
  for (var o = 0; o < seen["1"].items.length; o++) {
    var po = parseOutput(seen["1"].items[o]); if (po === null) return null;
    outputs.push(po); outTotal += BigInt(po.lovelace);
  }
  var fee = seen["2"].v; if (fee < 0n) return null;

  var ttl = uintField("3"); if (ttl === "bad") return null;
  var certCount = 0;
  if (seen["4"] !== undefined) { var cn = unwrapSet(seen["4"]); if (cn.t !== "array") return null; certCount = cn.items.length; }
  var withdrawals = [], wdTotal = 0n;
  if (seen["5"] !== undefined) {
    if (seen["5"].t !== "map") return null;
    for (var w = 0; w < seen["5"].pairs.length; w++) {
      var wk = seen["5"].pairs[w][0], wv = seen["5"].pairs[w][1];
      if (wk.t !== "bytes" || wv.t !== "int" || wv.v < 0n) return null;
      var wa = addressFromBytes(wk.bytes); if (wa === null) return null;
      withdrawals.push({ address: wa, lovelace: wv.v.toString() }); wdTotal += wv.v;
    }
  }
  var auxHash = null;
  if (seen["7"] !== undefined) { if (seen["7"].t !== "bytes" || seen["7"].bytes.length !== 32) return null; auxHash = bytesToHex(seen["7"].bytes); }
  var validityStart = uintField("8"); if (validityStart === "bad") return null;
  var mint = [];
  if (seen["9"] !== undefined) { mint = parseMultiAsset(seen["9"], true); if (mint === null) return null; }
  var sdh = null;
  if (seen["11"] !== undefined) { if (seen["11"].t !== "bytes" || seen["11"].bytes.length !== 32) return null; sdh = bytesToHex(seen["11"].bytes); }
  var collateral = [];
  if (seen["13"] !== undefined) { collateral = parseRefList(seen["13"]); if (collateral === null) return null; }
  var signers = [];
  if (seen["14"] !== undefined) {
    var sn = unwrapSet(seen["14"]); if (sn.t !== "array") return null;
    for (var s2 = 0; s2 < sn.items.length; s2++) {
      if (sn.items[s2].t !== "bytes" || sn.items[s2].bytes.length !== 28) return null;
      signers.push(bytesToHex(sn.items[s2].bytes));
    }
  }
  var networkId = null;
  if (seen["15"] !== undefined) {
    if (seen["15"].t !== "int" || (seen["15"].v !== 0n && seen["15"].v !== 1n)) return null;
    networkId = Number(seen["15"].v);
  }
  var collateralReturn = null;
  if (seen["16"] !== undefined) { collateralReturn = parseOutput(seen["16"]); if (collateralReturn === null) return null; }
  var totalCollateral = uintField("17"); if (totalCollateral === "bad") return null;
  var referenceInputs = [];
  if (seen["18"] !== undefined) { referenceInputs = parseRefList(seen["18"]); if (referenceInputs === null) return null; }
  var voteCount = 0;
  if (seen["19"] !== undefined) { if (seen["19"].t !== "map") return null; voteCount = seen["19"].pairs.length; }
  var proposalCount = 0;
  if (seen["20"] !== undefined) { var pn = unwrapSet(seen["20"]); if (pn.t !== "array") return null; proposalCount = pn.items.length; }
  var treasury = uintField("21"); if (treasury === "bad") return null;
  var donation = uintField("22"); if (donation === "bad") return null;

  return {
    txId: idRes.txId, source: idRes.source, bodyBytes: idRes.bodyBytes,
    inputs: inputs, outputs: outputs, outputTotal: outTotal.toString(),
    fee: fee.toString(),
    ttl: ttl === null ? null : safeNum(ttl),
    validityStart: validityStart === null ? null : safeNum(validityStart),
    certificates: certCount,
    withdrawals: withdrawals, withdrawalTotal: wdTotal.toString(),
    auxDataHash: auxHash, mint: mint, scriptDataHash: sdh,
    collateral: collateral, requiredSigners: signers, networkId: networkId,
    collateralReturn: collateralReturn,
    totalCollateral: totalCollateral === null ? null : totalCollateral.toString(),
    referenceInputs: referenceInputs,
    votingProcedures: voteCount, proposals: proposalCount,
    treasuryValue: treasury === null ? null : treasury.toString(),
    donation: donation === null ? null : donation.toString()
  };
}

/* Value decoder — a standalone transaction-output VALUE on its own:
   the CBOR cardano-cli prints for --tx-out, indexers store, and the
   transaction inspector above only ever shows inside an output.
   Ledger CDDL: value = coin / [coin, multiasset],
   multiasset = { policy_id => { asset_name => quantity }} with
   policy_id a 28-byte hash, asset_name 0-32 bytes and every quantity
   a POSITIVE integer in an output value (a mint may carry negative
   quantities — that is a different field with a different rule, and
   it is rejected here). Stricter than the inspector's internal value
   parser in one deliberate way: a policy or asset name appearing
   TWICE is rejected, because a value is a map — the quantity of one
   asset lives in exactly one entry, and a serialisation that repeats
   a key is not a well-formed ledger value. Exact BigInt quantities
   throughout (uint64-max included); input capped at max_tx_size
   (16,384) like the transaction tools — no value inside a legal
   transaction can be larger. Proven against pycardano 0.19.2's Value
   serialisation in scratch (value_py.py / value_vectors.json):
   coin-only, max-supply coin, one asset, empty name at uint64-max
   quantity, and a two-policy bundle all decode field-for-field.
   Display only — nothing is signed or sent. */
function parseValueCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t === "int") {
    if (n.v < 0n) return null;
    return { lovelace: n.v.toString(), assets: [], assetCount: 0, policyCount: 0 };
  }
  if (n.t !== "array" || n.items.length !== 2) return null;
  var coin = n.items[0], ma = n.items[1];
  if (coin.t !== "int" || coin.v < 0n || ma.t !== "map") return null;
  var assets = [], seenPol = {}, policyCount = 0;
  for (var a = 0; a < ma.pairs.length; a++) {
    var pol = ma.pairs[a][0], names = ma.pairs[a][1];
    if (pol.t !== "bytes" || pol.bytes.length !== 28 || names.t !== "map") return null;
    var polHex = bytesToHex(pol.bytes);
    if (seenPol[polHex] !== undefined) return null; /* duplicate policy key */
    seenPol[polHex] = true; policyCount++;
    var seenName = {};
    for (var b = 0; b < names.pairs.length; b++) {
      var nm = names.pairs[b][0], qty = names.pairs[b][1];
      if (nm.t !== "bytes" || nm.bytes.length > 32 || qty.t !== "int") return null;
      if (qty.v <= 0n) return null; /* output quantities are positive */
      var nameHex = bytesToHex(nm.bytes);
      if (seenName[nameHex] !== undefined) return null; /* duplicate asset name */
      seenName[nameHex] = true;
      assets.push({ policy: polHex, name: nameHex, nameText: assetNameText(nameHex), quantity: qty.v.toString() });
    }
  }
  assets.sort(function (x, y) { return (x.policy + x.name) < (y.policy + y.name) ? -1 : 1; });
  return { lovelace: coin.v.toString(), assets: assets, assetCount: assets.length, policyCount: policyCount };
}

/* Transaction output decoder — a standalone transaction OUTPUT on
   its own: the CBOR a block, an indexer or cardano-cli carries for one
   output, which until now only ever appeared inside the transaction
   inspector's output rendering. Both serialisations the ledger allows
   decode: the Babbage map form {0: address bytes, 1: value,
   2: datum option, 3: script reference} and the Alonzo array form
   [address bytes, value] / [address bytes, value, datum hash].
   Two deliberate strictnesses beyond the inspector's internal output
   parser, in the same spirit as the value decoder: the address must
   be a Shelley PAYMENT address (a reward address is not an output
   address, and Byron-era or malformed bytes are rejected rather than
   shown as raw hex), and repeated map keys — output keys, policy IDs
   or asset names — are rejected, because each of those is a map.
   Output values follow the value rule (positive quantities only).
   Proven against pycardano 0.19.2's TransactionOutput serialisation
   in scratch (txout_py.py / txout_vectors.json): Babbage coin-only,
   multi-asset with a datum hash, an inline Plutus datum, Plutus V2
   and native reference scripts, an enterprise-address output, and
   both Alonzo forms decode field-for-field. The node-level parser
   below (parseTxOutNode) is shared with the outputs field decoder
   that follows it, so a single output and an output inside a field
   pass exactly the same gates — there is no second output gate to
   drift. Display only — nothing is signed or sent. */
function parseTxOutNode(n) {
  function parseValueStrict(vn) {
    if (vn.t === "int") return vn.v < 0n ? null : { lovelace: vn.v.toString(), assets: [] };
    if (vn.t !== "array" || vn.items.length !== 2 || vn.items[0].t !== "int" || vn.items[0].v < 0n) return null;
    var ma = vn.items[1];
    if (ma.t !== "map") return null;
    var assets = [], seenPol = {};
    for (var a = 0; a < ma.pairs.length; a++) {
      var pol = ma.pairs[a][0], names = ma.pairs[a][1];
      if (pol.t !== "bytes" || pol.bytes.length !== 28 || names.t !== "map") return null;
      var polHex = bytesToHex(pol.bytes);
      if (seenPol[polHex] !== undefined) return null;
      seenPol[polHex] = true;
      var seenName = {};
      for (var b = 0; b < names.pairs.length; b++) {
        var nm = names.pairs[b][0], qty = names.pairs[b][1];
        if (nm.t !== "bytes" || nm.bytes.length > 32 || qty.t !== "int" || qty.v <= 0n) return null;
        var nameHex = bytesToHex(nm.bytes);
        if (seenName[nameHex] !== undefined) return null;
        seenName[nameHex] = true;
        assets.push({ policy: polHex, name: nameHex, nameText: assetNameText(nameHex), quantity: qty.v.toString() });
      }
    }
    assets.sort(function (x, y) { return (x.policy + x.name) < (y.policy + y.name) ? -1 : 1; });
    return { lovelace: vn.items[0].v.toString(), assets: assets };
  }
  function addressFromBytes(bts) {
    if (!bts.length) return null;
    var header = bts[0], type = header >> 4, net = header & 15;
    if (net !== 0 && net !== 1) return null;
    if (type === 14 || type === 15) return null; /* reward address: not an output address */
    var s = encodeAddressBytes(net === 1 ? "addr" : "addr_test", bts);
    if (s === null) return null;
    return decodeAddress(s) !== null ? s : null;
  }
  function parseDatumOption(dn) {
    if (dn.t !== "array" || dn.items.length !== 2 || dn.items[0].t !== "int") return "bad";
    if (dn.items[0].v === 0n) {
      return (dn.items[1].t === "bytes" && dn.items[1].bytes.length === 32) ? { kind: "hash", hash: bytesToHex(dn.items[1].bytes) } : "bad";
    }
    if (dn.items[0].v === 1n) {
      return (dn.items[1].t === "tag" && dn.items[1].n === 24n && dn.items[1].item.t === "bytes") ? { kind: "inline", hex: bytesToHex(dn.items[1].item.bytes) } : "bad";
    }
    return "bad";
  }
  function parseScriptRef(sn) {
    if (sn.t !== "tag" || sn.n !== 24n || sn.item.t !== "bytes") return "bad";
    var inner = cborParseItem(sn.item.bytes, 0, 0);
    if (!inner || inner.next !== sn.item.bytes.length || inner.node.t !== "array" || !inner.node.items.length || inner.node.items[0].t !== "int") return "bad";
    var lang = inner.node.items[0].v;
    if (lang === 0n) return "native";
    if (lang === 1n) return "plutus1";
    if (lang === 2n) return "plutus2";
    if (lang === 3n) return "plutus3";
    return "bad";
  }
  if (n.t === "map") {
    var m = {};
    for (var i = 0; i < n.pairs.length; i++) {
      var kk = n.pairs[i][0];
      if (kk.t !== "int") return null;
      var kks = kk.v.toString();
      if (m[kks] !== undefined) return null;
      m[kks] = n.pairs[i][1];
    }
    for (var key in m) if (["0", "1", "2", "3"].indexOf(key) < 0) return null;
    if (!m["0"] || m["0"].t !== "bytes" || !m["1"]) return null;
    var addr = addressFromBytes(m["0"].bytes); if (addr === null) return null;
    var val = parseValueStrict(m["1"]); if (val === null) return null;
    var datum = { kind: "none" };
    if (m["2"] !== undefined) { datum = parseDatumOption(m["2"]); if (datum === "bad") return null; }
    var sref = null;
    if (m["3"] !== undefined) { sref = parseScriptRef(m["3"]); if (sref === "bad") return null; }
    return { format: "babbage", address: addr, addressHex: bytesToHex(m["0"].bytes), lovelace: val.lovelace, assets: val.assets, datum: datum, scriptRef: sref };
  }
  if (n.t === "array") {
    if (n.items.length < 2 || n.items.length > 3 || n.items[0].t !== "bytes") return null;
    var addr2 = addressFromBytes(n.items[0].bytes); if (addr2 === null) return null;
    var val2 = parseValueStrict(n.items[1]); if (val2 === null) return null;
    var datum2 = { kind: "none" };
    if (n.items.length === 3) {
      if (n.items[2].t !== "bytes" || n.items[2].bytes.length !== 32) return null;
      datum2 = { kind: "hash", hash: bytesToHex(n.items[2].bytes) };
    }
    return { format: "alonzo", address: addr2, addressHex: bytesToHex(n.items[0].bytes), lovelace: val2.lovelace, assets: val2.assets, datum: datum2, scriptRef: null };
  }
  return null;
}

function parseTxOutCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  return parseTxOutNode(parsed.node);
}

/* Transaction outputs decoder — a standalone OUTPUTS FIELD on its
   own (body key 1): the array of outputs a transaction creates,
   which until now could only be read one output at a time with
   the decoder above or as part of a whole body in the inspector.
   Ledger CDDL (Conway): 1 : [* transaction_output] — a plain
   LIST, and that one word carries this field's whole semantics:
   - ORDER is data: an output's position in the list is the index
     every later reference to it uses (txHash#index), so entries
     are shown in encoded order, numbered from 0;
   - DUPLICATES are legal: two identical outputs are two UTxOs,
     not a repeated key — the field is not a set (inputs, key 0)
     and not a map (mint, key 9), so nothing here is deduplicated;
   - the EMPTY list DECODES: the grammar's [* ] allows it, the
     ledger's UTxO rules require non-empty INPUTS only (there is
     no outputs counterpart to InputSetEmptyUTxO), and pycardano
     serialises a body carrying 01 80 — an empty outputs field is
     a shape the ledger's grammar admits even though value
     conservation leaves it no room in a real transaction (its
     inputs' value would have to equal the fee exactly, with
     nothing left to carry forward). This is the one compound
     body field whose empty form is not refused, and it is
     refused nowhere else by accident: every sibling's emptiness
     gate names its own authority in its own comment.
   Each entry passes the output decoder's gates unchanged via
   parseTxOutNode — Shelley payment address, positive quantities,
   no repeated key inside any output — and any entry failing
   refuses the whole field, never a partial list. The result
   carries the exact BigInt total of the outputs' lovelace.
   A tag-258 wrapper is refused (the field is not a set), as is
   a single bare output (the output decoder's shape, not this
   field's) and a whole body (the inspector's). Input capped at
   max_tx_size (16,384) like the transaction tools. Proven
   against pycardano 0.19.2's TransactionBody serialisations in
   scratch (outputs_py.py / outputs_vectors.json — each field
   extracted by span from a whole body, re-wrapped as {1: field}
   and read back by the oracle in the generator; expectations
   read off the oracle's objects, with each output's format read
   off its emitted bytes: pycardano serialises body outputs in
   the array form whenever an output fits it, the map form only
   when a Babbage field requires it): a single output, a mixed
   pair (multi-asset with a datum hash, plain coin), a rich
   triple (inline datum, Plutus V2 reference script, enterprise
   address), the same output twice, the oracle's empty-body
   probe, and the outputs of a REAL mainnet transaction (the
   Minswap transaction the inspector tests carry: three outputs,
   318,675,542,791 lovelace in total). Display only — nothing
   is signed or sent. */
function parseOutputsCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t !== "array") return null;
  var outputs = [], total = 0n;
  for (var i = 0; i < n.items.length; i++) {
    var o = parseTxOutNode(n.items[i]);
    if (o === null) return null;
    outputs.push(o);
    total += BigInt(o.lovelace);
  }
  return { outputs: outputs, count: outputs.length, totalLovelace: total.toString() };
}

/* Mint / burn decoder — a standalone transaction MINT field on its
   own (body key 9): the map a transaction carries when it creates or
   destroys native assets, which until now only ever appeared inside
   the transaction inspector's mint list. Ledger CDDL (Conway):
   mint = {+ policy_id => {+ asset_name => nonzero_int64}} — at least
   one policy, at least one asset per policy, and every quantity a
   NON-ZERO int64: positive mints, negative burns, and zero is not a
   legal entry (pycardano silently drops zero-quantity assets when
   serialising, and the ledger field cannot carry one). Quantities
   are therefore NOT the output rule — the value and output decoders
   reject negatives, this one requires the sign. Two deliberate
   strictnesses in the spirit of the sibling decoders: repeated
   policy or asset-name keys are rejected (a mint is a map), and the
   empty map is rejected even though pycardano serialises an empty
   MultiAsset to it — the CDDL's "+" means a mint field that exists
   names at least one asset. Exact BigInt quantities throughout;
   input capped at max_tx_size (16,384) like the transaction tools.
   Proven against pycardano 0.19.2's MultiAsset serialisation in
   scratch (mint_py.py / mint_vectors.json): a pure mint, a pure
   burn, a mixed two-policy mint+burn, and both int64 extremes decode
   field-for-field. Display only — nothing is signed or sent. */
function parseMintCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t !== "map" || n.pairs.length === 0) return null;
  var assets = [], seenPol = {}, policyCount = 0, mintCount = 0, burnCount = 0;
  for (var a = 0; a < n.pairs.length; a++) {
    var pol = n.pairs[a][0], names = n.pairs[a][1];
    if (pol.t !== "bytes" || pol.bytes.length !== 28 || names.t !== "map" || names.pairs.length === 0) return null;
    var polHex = bytesToHex(pol.bytes);
    if (seenPol[polHex] !== undefined) return null; /* duplicate policy key */
    seenPol[polHex] = true; policyCount++;
    var seenName = {};
    for (var b = 0; b < names.pairs.length; b++) {
      var nm = names.pairs[b][0], qty = names.pairs[b][1];
      if (nm.t !== "bytes" || nm.bytes.length > 32 || qty.t !== "int") return null;
      if (qty.v === 0n || qty.v < -9223372036854775808n || qty.v > 9223372036854775807n) return null; /* nonzero int64 */
      var nameHex = bytesToHex(nm.bytes);
      if (seenName[nameHex] !== undefined) return null; /* duplicate asset name */
      seenName[nameHex] = true;
      var isMint = qty.v > 0n;
      if (isMint) mintCount++; else burnCount++;
      assets.push({ policy: polHex, name: nameHex, nameText: assetNameText(nameHex), quantity: qty.v.toString(), action: isMint ? "mint" : "burn" });
    }
  }
  assets.sort(function (x, y) { return (x.policy + x.name) < (y.policy + y.name) ? -1 : 1; });
  return { assets: assets, assetCount: assets.length, policyCount: policyCount, mintCount: mintCount, burnCount: burnCount };
}

/* Withdrawals decoder — a standalone transaction WITHDRAWALS field
   on its own (body key 5): the map a transaction carries when it
   takes staking rewards out of reward accounts, which until now
   only ever appeared inside the transaction inspector's withdrawal
   list. Ledger CDDL (Conway, fetched from IntersectMBO/cardano-ledger
   this run): withdrawals = {+ reward_account => coin}, with
   coin = uint — at least one entry, every key a reward account and
   every amount an unsigned amount (the parser's major type 0 caps
   it at uint64, the uint64-max vector below included). Two
   deliberate strictnesses in the spirit of the sibling decoders:
   the key must be a Shelley REWARD address (29 bytes, header type
   14 key / 15 script — a payment address is not a reward account,
   the mirror of the output decoder rejecting reward addresses),
   verified end-to-end through the proven CIP-19 decoder, and
   repeated reward-account keys are rejected (a withdrawals field
   is a map). Unlike the mint field, a ZERO amount is accepted:
   the CDDL says plain coin here, not nonzero — the mint decoder's
   zero ban comes from its own field's nonzero_int64 rule and does
   not carry over. Exact BigInt amounts throughout; input capped at
   max_tx_size (16,384) like the transaction tools. Proven against
   pycardano 0.19.2's Withdrawals serialisation in scratch
   (withdraw_gen.py / withdraw_vectors.json): a single mainnet key
   withdrawal, a mixed key + script pair, a testnet withdrawal, a
   zero amount and the uint64 maximum decode field-for-field.
   Display only — nothing is signed or sent. */
function parseWithdrawalsCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t !== "map" || n.pairs.length === 0) return null;
  var entries = [], seen = {}, total = 0n;
  for (var i = 0; i < n.pairs.length; i++) {
    var k = n.pairs[i][0], v = n.pairs[i][1];
    if (k.t !== "bytes" || k.bytes.length !== 29 || v.t !== "int" || v.v < 0n) return null;
    var header = k.bytes[0], type = header >> 4, net = header & 15;
    if ((type !== 14 && type !== 15) || (net !== 0 && net !== 1)) return null;
    var hex = bytesToHex(k.bytes);
    if (seen[hex] !== undefined) return null; /* duplicate reward account */
    seen[hex] = true;
    var addr = encodeAddressBytes(net === 1 ? "stake" : "stake_test", k.bytes);
    if (addr === null || decodeAddress(addr) === null) return null;
    total += v.v;
    entries.push({ address: addr, addressHex: hex, stakeKind: type === 15 ? "script" : "key", network: net === 1 ? "mainnet" : "testnet", stakeHash: bytesToHex(k.bytes.slice(1)), lovelace: v.v.toString() });
  }
  entries.sort(function (x, y) { return x.addressHex < y.addressHex ? -1 : 1; });
  return { entries: entries, count: entries.length, totalLovelace: total.toString() };
}

/* Transaction inputs decoder — a standalone transaction INPUTS field
   on its own (body key 0): the set of UTxO references a transaction
   spends, which until now only ever appeared inside the transaction
   inspector's input list. Ledger CDDL (Conway):
   transaction_input = [transaction_id, index] with
   transaction_id = hash32 (exactly 32 bytes) and index a
   uint .size 2 (0-65535, the position of the output in the
   transaction that created it), and the field itself a
   set<transaction_input> — serialised either as a plain array or
   under CBOR set tag 258, the two forms the CDDL's set definition
   allows; both decode here (the txId run's lesson: a proof set must
   include both, because pycardano emits only the plain array while
   most mainnet transactions carry tag 258). Three deliberate
   strictnesses in the spirit of the sibling decoders: a repeated
   reference (same transaction ID AND index) is rejected — the field
   is a set, and spending one UTxO twice is not a thing; an index
   above 65535 is rejected even though pycardano serialises one —
   the CDDL's .size 2 is the authority for the range, the oracle
   only proves byte shapes (the mint run's lesson); and the empty
   set is rejected, because a transaction must spend at least one
   output (a long-standing ledger rule, restated in CIP-0031) — an
   inputs field naming nothing spends nothing. Entries are shown in
   the order encoded, each also in the familiar
   transaction-ID#index reference form cardano-cli and explorers
   use. Input capped at max_tx_size (16,384) like the transaction
   tools. Proven against pycardano 0.19.2's TransactionBody
   serialisation in scratch (inputs_py.py / inputs_vectors.json):
   a single input, two inputs including the index maximum, the
   same pair in the other order, and the tag-258 set form of the
   pair all decode field-for-field. Display only — nothing is
   signed or sent. */
function parseInputsCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t === "tag" && n.n === 258n) n = n.item;
  if (n.t !== "array" || n.items.length === 0) return null;
  var entries = [], seen = {};
  for (var i = 0; i < n.items.length; i++) {
    var it = n.items[i];
    if (it.t !== "array" || it.items.length !== 2) return null;
    if (it.items[0].t !== "bytes" || it.items[0].bytes.length !== 32) return null;
    if (it.items[1].t !== "int" || it.items[1].v < 0n || it.items[1].v > 65535n) return null;
    var txHash = bytesToHex(it.items[0].bytes);
    var index = Number(it.items[1].v);
    var key = txHash + "#" + index;
    if (seen[key] !== undefined) return null; /* duplicate reference: a set */
    seen[key] = true;
    entries.push({ txHash: txHash, index: index, ref: key });
  }
  return { entries: entries, count: entries.length };
}

/* Required signers decoder — a standalone REQUIRED SIGNERS field on
   its own (body key 14): the set of key hashes a transaction
   declares must sign it (native-script and Plutus witnesses are
   checked against it), which until now only ever appeared inside
   the transaction inspector's signer list. Ledger CDDL (Conway):
   required_signers = nonempty_set<addr_keyhash> with
   addr_keyhash = hash28 (exactly 28 bytes), and
   nonempty_set<a> = #6.258([+ a]) / [+ a] — serialised either
   under CBOR set tag 258 or as a plain array; both decode here
   (pycardano emits only the plain array). The gates each rest on
   the CDDL text itself, and two of them overrule the oracle, in
   the mint run's split (the CDDL governs cardinality and set
   semantics, the oracle only proves byte shapes): the field must
   name AT LEAST ONE signer — the grammar's [+ a] forbids the
   empty set outright, unlike the inputs field (a plain set<>,
   whose empty rejection rests on the separate must-spend-a-UTxO
   validity rule) — even though pycardano serialises an empty
   required_signers list to 80 with the field present; and a
   repeated key hash is rejected — the field is a set — even
   though pycardano serialises a duplicated hash twice and reads
   it back as two entries. A 32-byte hash is rejected by both the
   CDDL and pycardano itself (its VerificationKeyHash asserts the
   28-byte size): a transaction ID is not a key hash. Entries are
   shown in the order encoded. Input capped at max_tx_size
   (16,384) like the transaction tools. Proven against pycardano
   0.19.2's TransactionBody serialisation in scratch
   (signers_py.py / signers_vectors.json): a single signer, two
   signers, three signers in a non-sorted order, and the tag-258
   set form of the pair all decode field-for-field. Display
   only — nothing is signed or sent. */
function parseSignersCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t === "tag" && n.n === 258n) n = n.item;
  if (n.t !== "array" || n.items.length === 0) return null;
  var entries = [], seen = {};
  for (var i = 0; i < n.items.length; i++) {
    var it = n.items[i];
    if (it.t !== "bytes" || it.bytes.length !== 28) return null;
    var h = bytesToHex(it.bytes);
    if (seen[h] !== undefined) return null; /* duplicate key hash: a set */
    seen[h] = true;
    entries.push(h);
  }
  return { entries: entries, count: entries.length };
}

/* Reference inputs decoder — a standalone REFERENCE INPUTS field
   on its own (body key 18): the UTxOs a transaction READS without
   spending (CIP-31 — a script can see a referenced output's datum
   and a reference script can be taken from it, while the UTxO
   itself stays unspent and can be referenced by many transactions),
   which until now only ever appeared inside the transaction
   inspector's reference list. The entry shape is the inputs
   field's — Ledger CDDL (Conway): transaction_input =
   [transaction_id: hash32, index: uint .size 2] — but the field
   rule differs from inputs in exactly one word, and that word
   changes the emptiness authority: 18 : nonempty_set<transaction_input>
   against key 0's plain set<transaction_input>, with
   nonempty_set<a> = #6.258([+ a]) / [+ a] — serialised either under
   CBOR set tag 258 or as a plain array; both decode here
   (pycardano emits only the plain array). So an empty field is
   rejected by the GRAMMAR ITSELF here, where the inputs decoder's
   empty rejection rests on the separate must-spend-a-UTxO validity
   rule (the signers run's three-authorities note). The other two
   gates also overrule the oracle, in the mint run's split (the
   CDDL governs ranges and set semantics, the oracle only proves
   byte shapes): a repeated reference is rejected — the field is a
   set — even though pycardano serialises a duplicated reference
   twice and reads it back as two entries (the same transaction ID
   at a DIFFERENT index is a different reference and decodes); and
   an index above 65,535 is rejected per the CDDL .size 2 even
   though pycardano serialises 65536 happily. Entries are shown in
   the order encoded, in the familiar txHash#index form. Input
   capped at max_tx_size (16,384) like the transaction tools.
   Proven against pycardano 0.19.2's TransactionBody serialisation
   in scratch (refinputs_py.py / refinputs_vectors.json): a single
   reference, two references including the index maximum, the same
   pair in the other order, the same transaction ID at two
   indices, and the tag-258 set form of the pair all decode
   field-for-field. Display only — nothing is read from the chain,
   signed or sent. */
function parseRefInputsCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t === "tag" && n.n === 258n) n = n.item;
  if (n.t !== "array" || n.items.length === 0) return null;
  var entries = [], seen = {};
  for (var i = 0; i < n.items.length; i++) {
    var it = n.items[i];
    if (it.t !== "array" || it.items.length !== 2) return null;
    if (it.items[0].t !== "bytes" || it.items[0].bytes.length !== 32) return null;
    if (it.items[1].t !== "int" || it.items[1].v < 0n || it.items[1].v > 65535n) return null;
    var txHash = bytesToHex(it.items[0].bytes);
    var index = Number(it.items[1].v);
    var key = txHash + "#" + index;
    if (seen[key] !== undefined) return null; /* duplicate reference: a set */
    seen[key] = true;
    entries.push({ txHash: txHash, index: index, ref: key });
  }
  return { entries: entries, count: entries.length };
}

/* Collateral inputs decoder — a standalone COLLATERAL field on
   its own (body key 13): the UTxOs a script transaction puts at
   risk — if its Plutus scripts pass, the collateral is NOT spent;
   if a script fails phase-2 validation, the ledger takes the
   collateral as the fee instead. Until now this field only ever
   appeared inside the transaction inspector's collateral list.
   The entry shape is the inputs field's — Ledger CDDL (Conway):
   transaction_input = [transaction_id: hash32, index: uint
   .size 2] — and the field rule is 13 :
   nonempty_set<transaction_input>, with nonempty_set<a> =
   #6.258([+ a]) / [+ a] — serialised either under CBOR set tag
   258 or as a plain array; both decode here (pycardano emits only
   the plain array). FOUR gates, from THREE authorities, kept
   separate like the sibling runs: an empty field is rejected by
   the CDDL GRAMMAR ITSELF (nonempty_set's [+ a], the same
   authority as the signers and reference-inputs fields); a
   repeated reference is rejected because the field is a SET; an
   index above 65,535 is rejected per the CDDL .size 2; and MORE
   THAN THREE entries are rejected under the live protocol
   parameter max_collateral_inputs = 3 (the ledger's
   TooManyCollateralInputs validity rule — the count cap no
   sibling field has; verified via Koios epoch_params for epoch
   660 on 2026-10-08, the channel that carries it; re-verify it
   there before changing the constant). The first three gates
   overrule the oracle, in the mint run's split (the CDDL governs
   cardinality, ranges and set semantics, the oracle only proves
   byte shapes): pycardano serialises an empty collateral list to
   80 with the field present, a duplicated reference twice
   (reading it back as two entries), and an index of 65,536
   happily — and the fourth overrules it too: pycardano serialises
   FOUR collateral inputs and reads them back as four. Entries are
   shown in the order encoded, in the familiar txHash#index form.
   Input capped at max_tx_size (16,384) like the transaction
   tools. Proven against pycardano 0.19.2's TransactionBody
   serialisation in scratch (collateral_py.py /
   collateral_vectors.json): a single entry, three entries AT the
   cap including the index maximum and the same transaction ID at
   two indices, the same three in the other order, and the tag-258
   set form of the three all decode field-for-field. Display
   only — nothing is put at risk, signed or sent. */
var MAX_COLLATERAL_INPUTS = 3;
function parseCollateralCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t === "tag" && n.n === 258n) n = n.item;
  if (n.t !== "array" || n.items.length === 0) return null;
  if (n.items.length > MAX_COLLATERAL_INPUTS) return null; /* live pp cap */
  var entries = [], seen = {};
  for (var i = 0; i < n.items.length; i++) {
    var it = n.items[i];
    if (it.t !== "array" || it.items.length !== 2) return null;
    if (it.items[0].t !== "bytes" || it.items[0].bytes.length !== 32) return null;
    if (it.items[1].t !== "int" || it.items[1].v < 0n || it.items[1].v > 65535n) return null;
    var txHash = bytesToHex(it.items[0].bytes);
    var index = Number(it.items[1].v);
    var key = txHash + "#" + index;
    if (seen[key] !== undefined) return null; /* duplicate reference: a set */
    seen[key] = true;
    entries.push({ txHash: txHash, index: index, ref: key });
  }
  return { entries: entries, count: entries.length };
}

/* Certificates decoder — a standalone CERTIFICATES field on its
   own (body key 4): the stake, pool, committee and DRep actions a
   transaction carries — registering or retiring a stake credential
   or a pool, delegating stake or voting power, authorising a
   committee hot credential, registering a DRep — which until now
   only ever appeared inside the transaction inspector as a count.
   Ledger CDDL (Conway): certificates =
   nonempty_oset<certificate> = #6.258([+ certificate]) /
   [+ certificate], an ORDERED set: an empty field is forbidden by
   the grammar itself, and the same certificate twice is not a
   thing (the same credential in two DIFFERENT certificates is
   fine — registering and delegating in one transaction is the
   normal wallet flow). All seventeen Conway certificate types
   decode (0-4, 7-18; types 5 and 6 were genesis / MIR
   certificates from earlier eras and do not exist in the Conway
   CDDL, so they are rejected, as is any other unknown type).
   The parts: a credential is [0, addr_keyhash] or [1, script_hash]
   (28 bytes either way); a DRep is [0, key hash], [1, script hash],
   [2] (always abstain) or [3] (always no confidence) — the two
   constant DReps carry NO hash, so a hash after a 2 or 3 is
   rejected; an anchor is [url (text, at most 128 bytes), hash32]
   or nil; deposits and refunds are coin (exact, shown as decimal
   strings). A pool registration (type 3) carries the full
   pool_params group in place: operator (pool key hash), VRF key
   hash (32 bytes), pledge and cost (coin), margin — a
   unit_interval, CBOR tag 30 over [numerator, denominator] with
   denominator above zero and numerator at most the denominator,
   the two constraints the CDDL's own comment states — the reward
   account (a 29-byte reward address: header type 14/15, network
   0/1; shown in bech32 as well as hex), the pool owners (a set of
   key hashes — plain array or tag-258 form, no repeats), the
   relays (single-host address with optional port and IPv4/IPv6
   byte strings of exactly 4/16 bytes, single-host name, and
   multi-host name, DNS names at most 128 bytes, ports at most
   65,535), and the pool metadata ([url, hash bytes] or nil).
   Two gates overrule the oracle, in the mint run's split (the
   CDDL governs cardinality and set semantics, the oracle only
   proves byte shapes): the empty set and a duplicated
   certificate are both rejected even though pycardano 0.19.2
   serialises an empty certificates list to 80 with the field
   present and serialises the same certificate twice, reading it
   back as two. (One oracle quirk is recorded so nobody chases
   it: pycardano reads its own type-16 DRep registration back as
   a list nested inside the ordered set — its ENCODING is
   byte-identical to the CDDL form and round-trips exactly, which
   is what the proof below asserts.) Input capped at max_tx_size
   (16,384) like the transaction tools. Proven against pycardano
   0.19.2's TransactionBody serialisation in scratch (certs_py.py
   / certs_vectors.json, whole-body round-trip asserted
   byte-for-byte in the generator): every one of the seventeen
   types on its own — including a full pool registration with
   five relays of all three kinds, two owners and metadata, and
   a minimal one with no owners, relays or metadata — a
   three-certificate combination in encoded order, and the
   tag-258 ordered-set form of it all decode field-for-field.
   Display only — nothing is registered, signed or sent. */
function parseCertificatesCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t === "tag" && n.n === 258n) n = n.item;
  if (n.t !== "array" || n.items.length === 0) return null;
  function textBytesOk(node, max) {
    return node.t === "text" && new TextEncoder().encode(node.v).length <= max;
  }
  function cred(node) {
    if (!node || node.t !== "array" || node.items.length !== 2) return null;
    if (node.items[0].t !== "int" || (node.items[0].v !== 0n && node.items[0].v !== 1n)) return null;
    if (node.items[1].t !== "bytes" || node.items[1].bytes.length !== 28) return null;
    return { kind: node.items[0].v === 0n ? "key" : "script", hash: bytesToHex(node.items[1].bytes) };
  }
  function hash28(node) {
    return (node && node.t === "bytes" && node.bytes.length === 28) ? bytesToHex(node.bytes) : null;
  }
  function coinStr(node) {
    return (node && node.t === "int" && node.v >= 0n) ? node.v.toString() : null;
  }
  function drep(node) {
    if (!node || node.t !== "array" || node.items.length < 1 || node.items.length > 2) return null;
    if (node.items[0].t !== "int") return null;
    var k = node.items[0].v;
    if (k === 2n && node.items.length === 1) return { kind: "always_abstain" };
    if (k === 3n && node.items.length === 1) return { kind: "always_no_confidence" };
    if ((k === 0n || k === 1n) && node.items.length === 2) {
      var h = hash28(node.items[1]);
      if (h === null) return null;
      return { kind: k === 0n ? "key" : "script", hash: h };
    }
    return null;
  }
  function anchorOrBad(node) {
    if (node.t === "null") return null;
    if (node.t !== "array" || node.items.length !== 2) return "bad";
    if (!textBytesOk(node.items[0], 128)) return "bad";
    if (node.items[1].t !== "bytes" || node.items[1].bytes.length !== 32) return "bad";
    return { url: node.items[0].v, dataHash: bytesToHex(node.items[1].bytes) };
  }
  function relay(node) {
    if (!node || node.t !== "array" || node.items.length < 2 || node.items[0].t !== "int") return null;
    var k = node.items[0].v;
    function port(node2) {
      if (node2.t === "null") return null;
      if (node2.t === "int" && node2.v >= 0n && node2.v <= 65535n) return Number(node2.v);
      return "bad";
    }
    if (k === 0n) {
      if (node.items.length !== 4) return null;
      var p = port(node.items[1]); if (p === "bad") return null;
      var v4 = null, v6 = null;
      if (node.items[2].t === "bytes" && node.items[2].bytes.length === 4) v4 = node.items[2].bytes.join(".");
      else if (node.items[2].t !== "null") return null;
      if (node.items[3].t === "bytes" && node.items[3].bytes.length === 16) {
        var groups = [];
        for (var g = 0; g < 8; g++) groups.push(((node.items[3].bytes[2 * g] << 8) | node.items[3].bytes[2 * g + 1]).toString(16).padStart(4, "0"));
        v6 = groups.join(":");
      } else if (node.items[3].t !== "null") return null;
      return { kind: "single_host_addr", port: p, ipv4: v4, ipv6: v6 };
    }
    if (k === 1n) {
      if (node.items.length !== 3) return null;
      var p1 = port(node.items[1]); if (p1 === "bad") return null;
      if (!textBytesOk(node.items[2], 128)) return null;
      return { kind: "single_host_name", port: p1, dnsName: node.items[2].v };
    }
    if (k === 2n) {
      if (node.items.length !== 2) return null;
      if (!textBytesOk(node.items[1], 128)) return null;
      return { kind: "multi_host_name", dnsName: node.items[1].v };
    }
    return null;
  }
  function poolParams(items) {
    var operator = hash28(items[1]); if (operator === null) return null;
    if (!items[2] || items[2].t !== "bytes" || items[2].bytes.length !== 32) return null;
    var pledge = coinStr(items[3]); if (pledge === null) return null;
    var cost = coinStr(items[4]); if (cost === null) return null;
    var mg = items[5];
    if (!mg || mg.t !== "tag" || mg.n !== 30n || mg.item.t !== "array" || mg.item.items.length !== 2) return null;
    if (mg.item.items[0].t !== "int" || mg.item.items[1].t !== "int") return null;
    if (mg.item.items[1].v <= 0n || mg.item.items[0].v < 0n || mg.item.items[0].v > mg.item.items[1].v) return null;
    var ra = items[6];
    if (!ra || ra.t !== "bytes" || ra.bytes.length !== 29) return null;
    var rHead = ra.bytes[0], rType = rHead >> 4, rNet = rHead & 15;
    if ((rType !== 14 && rType !== 15) || (rNet !== 0 && rNet !== 1)) return null;
    var reward = { hex: bytesToHex(ra.bytes), address: encodeAddressBytes(rNet === 1 ? "stake" : "stake_test", ra.bytes) };
    if (reward.address === null) return null;
    var ow = items[7];
    if (ow && ow.t === "tag" && ow.n === 258n) ow = ow.item;
    if (!ow || ow.t !== "array") return null;
    var owners = [], seenO = {};
    for (var oi = 0; oi < ow.items.length; oi++) {
      var oh = hash28(ow.items[oi]); if (oh === null) return null;
      if (seenO[oh] !== undefined) return null;
      seenO[oh] = true; owners.push(oh);
    }
    if (!items[8] || items[8].t !== "array") return null;
    var relays = [];
    for (var ri = 0; ri < items[8].items.length; ri++) {
      var rl = relay(items[8].items[ri]); if (rl === null) return null;
      relays.push(rl);
    }
    var md = items[9], metadata = null;
    if (md.t === "null") metadata = null;
    else if (md.t === "array" && md.items.length === 2 && textBytesOk(md.items[0], 128) && md.items[1].t === "bytes") {
      metadata = { url: md.items[0].v, hash: bytesToHex(md.items[1].bytes) };
    } else return null;
    return { operator: operator, vrfKeyHash: bytesToHex(items[2].bytes), pledge: pledge, cost: cost,
      margin: { numerator: mg.item.items[0].v.toString(), denominator: mg.item.items[1].v.toString() },
      rewardAccount: reward, owners: owners, relays: relays, metadata: metadata };
  }
  function nodeKey(node) {
    if (node.t === "int") return "i" + node.v.toString();
    if (node.t === "bytes") return "b" + bytesToHex(node.bytes);
    if (node.t === "text") return "t" + node.v;
    if (node.t === "null") return "n";
    if (node.t === "bool") return node.v ? "y" : "z";
    if (node.t === "tag") return "g" + node.n.toString() + "(" + nodeKey(node.item) + ")";
    if (node.t === "array") return "a[" + node.items.map(nodeKey).join(",") + "]";
    if (node.t === "map") return "m{" + node.pairs.map(function (pr) { return nodeKey(pr[0]) + "=" + nodeKey(pr[1]); }).join(",") + "}";
    return "?" + node.t;
  }
  var NAMES = { 0: "account_registration", 1: "account_unregistration", 2: "delegation_to_stake_pool",
    3: "pool_registration", 4: "pool_retirement", 7: "account_registration_deposit",
    8: "account_unregistration_deposit", 9: "delegation_to_drep", 10: "delegation_to_stake_pool_and_drep",
    11: "account_registration_delegation_to_stake_pool", 12: "account_registration_delegation_to_drep",
    13: "account_registration_delegation_to_stake_pool_and_drep", 14: "committee_authorization",
    15: "committee_resignation", 16: "drep_registration", 17: "drep_unregistration", 18: "drep_update" };
  var certs = [], seen = {};
  for (var ci = 0; ci < n.items.length; ci++) {
    var cn = n.items[ci];
    if (cn.t !== "array" || cn.items.length < 2 || cn.items[0].t !== "int") return null;
    var type = Number(cn.items[0].v);
    if (NAMES[type] === undefined) return null;
    var key = nodeKey(cn);
    if (seen[key] !== undefined) return null;
    seen[key] = true;
    var c = { type: type, name: NAMES[type] }, it = cn.items;
    if (type === 0 || type === 1) {
      if (it.length !== 2) return null;
      c.credential = cred(it[1]); if (c.credential === null) return null;
    } else if (type === 2) {
      if (it.length !== 3) return null;
      c.credential = cred(it[1]); c.pool = hash28(it[2]);
      if (c.credential === null || c.pool === null) return null;
    } else if (type === 3) {
      if (it.length !== 10) return null;
      c.poolParams = poolParams(it); if (c.poolParams === null) return null;
    } else if (type === 4) {
      if (it.length !== 3) return null;
      c.pool = hash28(it[1]); c.epoch = coinStr(it[2]);
      if (c.pool === null || c.epoch === null) return null;
    } else if (type === 7 || type === 8 || type === 17) {
      if (it.length !== 3) return null;
      c.credential = cred(it[1]); c.coin = coinStr(it[2]);
      if (c.credential === null || c.coin === null) return null;
    } else if (type === 9) {
      if (it.length !== 3) return null;
      c.credential = cred(it[1]); c.drep = drep(it[2]);
      if (c.credential === null || c.drep === null) return null;
    } else if (type === 10) {
      if (it.length !== 4) return null;
      c.credential = cred(it[1]); c.pool = hash28(it[2]); c.drep = drep(it[3]);
      if (c.credential === null || c.pool === null || c.drep === null) return null;
    } else if (type === 11) {
      if (it.length !== 4) return null;
      c.credential = cred(it[1]); c.pool = hash28(it[2]); c.coin = coinStr(it[3]);
      if (c.credential === null || c.pool === null || c.coin === null) return null;
    } else if (type === 12) {
      if (it.length !== 4) return null;
      c.credential = cred(it[1]); c.drep = drep(it[2]); c.coin = coinStr(it[3]);
      if (c.credential === null || c.drep === null || c.coin === null) return null;
    } else if (type === 13) {
      if (it.length !== 5) return null;
      c.credential = cred(it[1]); c.pool = hash28(it[2]); c.drep = drep(it[3]); c.coin = coinStr(it[4]);
      if (c.credential === null || c.pool === null || c.drep === null || c.coin === null) return null;
    } else if (type === 14) {
      if (it.length !== 3) return null;
      c.coldCredential = cred(it[1]); c.hotCredential = cred(it[2]);
      if (c.coldCredential === null || c.hotCredential === null) return null;
    } else if (type === 15 || type === 18) {
      if (it.length !== 3) return null;
      if (type === 15) { c.coldCredential = cred(it[1]); if (c.coldCredential === null) return null; }
      else { c.credential = cred(it[1]); if (c.credential === null) return null; }
      c.anchor = anchorOrBad(it[2]); if (c.anchor === "bad") return null;
    } else if (type === 16) {
      if (it.length !== 4) return null;
      c.credential = cred(it[1]); c.coin = coinStr(it[2]);
      if (c.credential === null || c.coin === null) return null;
      c.anchor = anchorOrBad(it[3]); if (c.anchor === "bad") return null;
    }
    certs.push(c);
  }
  return { certificates: certs, count: certs.length };
}

/* Voting procedures decoder — a standalone VOTING PROCEDURES
   field on its own (body key 19): who voted on which governance
   actions, and how, which until now only ever appeared inside
   the transaction inspector as a governance-field count.
   Ledger CDDL (Conway): voting_procedures =
   {+ voter => {+ gov_action_id => voting_procedure}} — a
   NON-EMPTY map of voters, each with a NON-EMPTY map of the
   governance actions they voted on. A voter is
   [code, hash28]: 0 = committee hot key hash, 1 = committee hot
   script hash, 2 = DRep key hash, 3 = DRep script hash,
   4 = stake pool key hash (a pool voter is a key hash only —
   there is no script form). A gov_action_id is
   [transaction_id: hash32, gov_action_index: uint .size 2], the
   same .size 2 bound as a transaction input index. A
   voting_procedure is [vote, anchor / nil]: vote is
   0 = no, 1 = yes, 2 = abstain, and the optional anchor is
   [url (text, at most 128 bytes), data hash32] or nil.
   Map semantics are enforced at both levels: the same voter
   twice, or the same governance action twice under one voter,
   is rejected — the same action under DIFFERENT voters is the
   normal case and decodes. One gate overrules the oracle, in
   the mint run's split (the CDDL governs emptiness, the oracle
   only proves byte shapes): the empty map is rejected even
   though pycardano 0.19.2 serialises an empty VotingProcedures
   to a0 with the field present. On the index range the two
   authorities AGREE: pycardano's GovActionId itself raises
   above 65535. Note pycardano's dict serialiser emits map keys
   in canonical encoded-byte order, not insertion order; this
   decoder preserves the ENCODED order it is given, like the
   sibling map decoders. Input capped at max_tx_size (16,384)
   like the transaction tools. Proven against pycardano
   0.19.2's TransactionBody serialisation in scratch
   (voting_py.py / voting_vectors.json, whole-body round-trip
   asserted byte-for-byte in the generator): a DRep key-hash
   yes vote with no anchor, a committee hot script-hash no vote
   with an anchor at action index 65535, a stake pool abstain,
   and a two-voter map in which one DRep votes on two actions
   and a committee member votes on one of the same actions
   decode field-for-field. Display only — nothing is voted,
   signed or sent. */
function parseVotingCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t !== "map" || n.pairs.length === 0) return null;
  var ROLES = { 0: "committee_hot", 1: "committee_hot", 2: "drep", 3: "drep", 4: "staking_pool" };
  var VOTES = { 0: "no", 1: "yes", 2: "abstain" };
  var voters = [], seenVoter = {}, voteCount = 0;
  for (var i = 0; i < n.pairs.length; i++) {
    var vk = n.pairs[i][0], vv = n.pairs[i][1];
    if (vk.t !== "array" || vk.items.length !== 2) return null;
    if (vk.items[0].t !== "int" || ROLES[Number(vk.items[0].v)] === undefined) return null;
    if (vk.items[1].t !== "bytes" || vk.items[1].bytes.length !== 28) return null;
    var code = Number(vk.items[0].v);
    var vHash = bytesToHex(vk.items[1].bytes);
    var vKey = code + ":" + vHash;
    if (seenVoter[vKey] !== undefined) return null; /* same voter twice: a map */
    seenVoter[vKey] = true;
    if (vv.t !== "map" || vv.pairs.length === 0) return null;
    var votes = [], seenAction = {};
    for (var j = 0; j < vv.pairs.length; j++) {
      var ak = vv.pairs[j][0], av = vv.pairs[j][1];
      if (ak.t !== "array" || ak.items.length !== 2) return null;
      if (ak.items[0].t !== "bytes" || ak.items[0].bytes.length !== 32) return null;
      if (ak.items[1].t !== "int" || ak.items[1].v < 0n || ak.items[1].v > 65535n) return null;
      var txHash = bytesToHex(ak.items[0].bytes);
      var index = Number(ak.items[1].v);
      var aKey = txHash + "#" + index;
      if (seenAction[aKey] !== undefined) return null; /* same action twice under one voter */
      seenAction[aKey] = true;
      if (av.t !== "array" || av.items.length !== 2) return null;
      if (av.items[0].t !== "int" || VOTES[Number(av.items[0].v)] === undefined) return null;
      var anchor = null, an = av.items[1];
      if (an.t === "null") anchor = null;
      else if (an.t === "array" && an.items.length === 2 &&
        an.items[0].t === "text" && new TextEncoder().encode(an.items[0].v).length <= 128 &&
        an.items[1].t === "bytes" && an.items[1].bytes.length === 32) {
        anchor = { url: an.items[0].v, dataHash: bytesToHex(an.items[1].bytes) };
      } else return null;
      votes.push({ action: { txHash: txHash, index: index, ref: aKey },
        procedure: { vote: VOTES[Number(av.items[0].v)], voteCode: Number(av.items[0].v), anchor: anchor } });
      voteCount++;
    }
    voters.push({ voter: { code: code, role: ROLES[code], kind: code % 2 === 1 ? "script" : "key", hash: vHash }, votes: votes });
  }
  return { voters: voters, voterCount: voters.length, voteCount: voteCount };
}

/* Governance proposals decoder — a standalone PROPOSALS
   field on its own (body key 20): the governance actions a
   transaction proposes, which until now only ever appeared
   inside the transaction inspector as a governance-field
   count. Ledger CDDL (Conway): proposal_procedures =
   nonempty_oset<proposal_procedure> — a NON-EMPTY ordered
   set, serialised as a plain array or under CBOR set tag
   258 (pycardano emits the tag form); the same proposal
   twice is rejected (set semantics — pycardano's ordered
   set silently dedupes it, the CDDL governs). Each
   proposal_procedure is [deposit: coin, reward_account,
   gov_action, anchor]: the deposit that backs the proposal
   (returned to the reward account if it expires or is
   enacted), the reward account as a 29-byte reward address
   with header type 14/15 (the CDDL types the field as bare
   bytes; this decoder applies the same reward-address gate
   as the withdrawals decoder, and shows the bech32 form),
   and an anchor that is REQUIRED here (unlike a vote's
   optional rationale anchor): [url (text, at most 128
   bytes), data hash32]. A gov_action is an array whose
   first item is its code, except that the info action is
   the one-element array [6] (the CDDL's group choice
   contributes just the code): 0 = parameter change
   [0, previous action / nil, protocol_param_update,
   guardrails script hash / nil], 1 = hard fork initiation
   [1, previous / nil, protocol_version], 2 = treasury
   withdrawals [2, {+ reward_account => coin} (the map may
   be empty per the CDDL's {*}), guardrails / nil],
   3 = no confidence [3, previous / nil], 4 = update
   committee [4, previous / nil, set of cold credentials to
   remove, {cold credential => expiry epoch} to add,
   quorum unit_interval], 5 = new constitution
   [5, previous / nil, [anchor, guardrails / nil]].
   A previous action is a gov_action_id
   [transaction_id: hash32, index: uint .size 2] or nil.
   protocol_version is [major 0..12, minor: uint .size 4]
   per the CDDL. The protocol_param_update is a map whose
   keys are a subset of 0-11, 16-33 (keys 12-15 do not
   exist in the Conway update; a repeated key is rejected):
   coin fields and sized integers are range-checked per
   the CDDL (uint .size 2 / .size 4), intervals are CBOR
   tag 30 (unit_interval: denominator above zero and
   numerator at most the denominator, per the CDDL's own
   comment; nonnegative_interval: denominator above zero,
   numerator may exceed it), cost models map a language
   byte 0..255 to int64 values, execution prices are a pair
   of nonnegative intervals, execution-unit caps are
   0..max_int64, and the voting thresholds are arrays of
   exactly 5 (pool) and 10 (DRep) unit intervals. An EMPTY
   update map decodes — every key in the CDDL map is
   optional — and pycardano agrees, emitting a0 for one.
   ORACLE DIVERGENCES, recorded so nobody "aligns" them
   away: pycardano 0.19.2 cannot represent a hard fork
   initiation action AT ALL (its protocol_version field is
   mistyped as a Fraction: construction validates against
   the pair form, serialisation validates against Fraction,
   and parsing a real [major, minor] array raises), and
   its own stale range check would also refuse majors
   0 and 11-12 that the CDDL allows — so the hard-fork
   vector is built from the CDDL text and this decoder
   follows the CDDL range 0..12. Its validator also
   crashes on a cost_models update (a bare Dict type hint),
   so that vector is likewise CDDL-built; and it EMITS a
   new-constitution proposal it cannot parse back (its
   tuple restore path raises), so that vector is proven
   encoder-side plus CDDL. Two permissive-oracle gates
   follow the usual split (the CDDL governs, the oracle
   only proves byte shapes): the empty field is rejected
   even though pycardano emits d90102 80 for one, and an
   anchor URL over 128 bytes is rejected even though
   pycardano serialises one. On the previous-action index
   the authorities agree: pycardano's GovActionId itself
   raises above 65,535. Proven in scratch
   (proposals_py.py / proposals_vectors.json /
   proposals_proto.js, 61/61): pycardano TransactionBody
   serialisations with whole-body round-trips asserted
   byte-for-byte (info, no-confidence, a fifteen-field
   parameter change incl. both threshold arrays and the
   live execution prices, a minimal parameter change,
   treasury withdrawals over two accounts, a committee
   update, and a two-proposal field in encoded order)
   decode field-for-field, alongside the CDDL-built
   hard-fork and cost-models vectors. Input capped at
   max_tx_size (16,384) like the transaction tools.
   Display only — nothing is proposed, signed or sent. */
function parseProposalsCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var n = parsed.node;
  if (n.t === "tag" && n.n === 258n) n = n.item;
  if (n.t !== "array" || n.items.length === 0) return null;
  var MAX_U16 = 65535n, MAX_U32 = 4294967295n, MAX_U64 = 18446744073709551615n,
    MAX_I64 = 9223372036854775807n, MIN_I64 = -9223372036854775808n;
  function textBytesOk(node, max) {
    return node.t === "text" && new TextEncoder().encode(node.v).length <= max;
  }
  function coinStr(node) {
    return (node && node.t === "int" && node.v >= 0n) ? node.v.toString() : null;
  }
  function uintUpTo(node, max) {
    return (node && node.t === "int" && node.v >= 0n && node.v <= max) ? node.v : null;
  }
  function hashHex(node, len) {
    return (node && node.t === "bytes" && node.bytes.length === len) ? bytesToHex(node.bytes) : null;
  }
  function cred(node) {
    if (!node || node.t !== "array" || node.items.length !== 2) return null;
    if (node.items[0].t !== "int" || (node.items[0].v !== 0n && node.items[0].v !== 1n)) return null;
    var h = hashHex(node.items[1], 28); if (h === null) return null;
    return { kind: node.items[0].v === 0n ? "key" : "script", hash: h };
  }
  function rewardAccount(node) {
    if (!node || node.t !== "bytes" || node.bytes.length !== 29) return null;
    var header = node.bytes[0], type = header >> 4, net = header & 15;
    if ((type !== 14 && type !== 15) || (net !== 0 && net !== 1)) return null;
    var addr = encodeAddressBytes(net === 1 ? "stake" : "stake_test", node.bytes);
    if (addr === null || decodeAddress(addr) === null) return null;
    return { address: addr, addressHex: bytesToHex(node.bytes),
      stakeKind: type === 15 ? "script" : "key", network: net === 1 ? "mainnet" : "testnet",
      stakeHash: bytesToHex(node.bytes.slice(1)) };
  }
  function anchorReq(node) {
    if (!node || node.t !== "array" || node.items.length !== 2) return null;
    if (!textBytesOk(node.items[0], 128)) return null;
    var h = hashHex(node.items[1], 32); if (h === null) return null;
    return { url: node.items[0].v, dataHash: h };
  }
  function prevOrBad(node) {
    if (node.t === "null") return null;
    if (node.t !== "array" || node.items.length !== 2) return "bad";
    var tx = hashHex(node.items[0], 32); if (tx === null) return "bad";
    var ix = uintUpTo(node.items[1], MAX_U16); if (ix === null) return "bad";
    return { txHash: tx, index: Number(ix), ref: tx + "#" + Number(ix) };
  }
  function hashOrBad(node) {
    if (node.t === "null") return null;
    var h = hashHex(node, 28);
    return h === null ? "bad" : h;
  }
  function interval(node, isUnit) {
    if (!node || node.t !== "tag" || node.n !== 30n) return null;
    var it = node.item;
    if (!it || it.t !== "array" || it.items.length !== 2) return null;
    if (it.items[0].t !== "int" || it.items[1].t !== "int") return null;
    var num = it.items[0].v, den = it.items[1].v;
    if (num < 0n || den <= 0n) return null;
    if (isUnit && num > den) return null;
    return { numerator: num.toString(), denominator: den.toString() };
  }
  function intervalList(node, count, isUnit) {
    if (!node || node.t !== "array" || node.items.length !== count) return null;
    var out = [];
    for (var i = 0; i < count; i++) {
      var iv = interval(node.items[i], isUnit); if (iv === null) return null;
      out.push(iv);
    }
    return out;
  }
  function nodeKey(node) {
    if (node.t === "int") return "i" + node.v.toString();
    if (node.t === "bytes") return "b" + bytesToHex(node.bytes);
    if (node.t === "text") return "t" + node.v;
    if (node.t === "null") return "n";
    if (node.t === "bool") return node.v ? "y" : "z";
    if (node.t === "tag") return "g" + node.n.toString() + "(" + nodeKey(node.item) + ")";
    if (node.t === "array") return "a[" + node.items.map(nodeKey).join(",") + "]";
    if (node.t === "map") return "m{" + node.pairs.map(function (pr) { return nodeKey(pr[0]) + "=" + nodeKey(pr[1]); }).join(",") + "}";
    return "?" + node.t;
  }
  var PARAMS = {
    0: ["minfee_a", "coin"], 1: ["minfee_b", "coin"],
    2: ["max_block_body_size", "u32"], 3: ["max_transaction_size", "u32"],
    4: ["max_block_header_size", "u16"], 5: ["key_deposit", "coin"],
    6: ["pool_deposit", "coin"], 7: ["maximum_epoch", "u32"],
    8: ["n_opt", "u16"], 9: ["pool_pledge_influence", "nonneg"],
    10: ["expansion_rate", "unit"], 11: ["treasury_growth_rate", "unit"],
    16: ["min_pool_cost", "coin"], 17: ["ada_per_utxo_byte", "coin"],
    18: ["cost_models", "costmodels"], 19: ["execution_unit_prices", "prices"],
    20: ["max_tx_execution_units", "exunits"], 21: ["max_block_execution_units", "exunits"],
    22: ["max_value_size", "u32"], 23: ["collateral_percentage", "u16"],
    24: ["max_collateral_inputs", "u16"], 25: ["pool_voting_thresholds", "poolthr"],
    26: ["drep_voting_thresholds", "drep thr"], 27: ["min_committee_size", "u16"],
    28: ["committee_term_limit", "u32"], 29: ["governance_action_validity_period", "u32"],
    30: ["governance_action_deposit", "coin"], 31: ["drep_deposit", "coin"],
    32: ["drep_inactivity_period", "u32"], 33: ["min_fee_ref_script_cost_per_byte", "nonneg"]
  };
  function paramUpdate(node) {
    if (!node || node.t !== "map") return null;
    var updates = [], seen = {};
    for (var i = 0; i < node.pairs.length; i++) {
      var k = node.pairs[i][0], v = node.pairs[i][1];
      if (k.t !== "int" || k.v < 0n || k.v > 4294967295n) return null;
      var key = Number(k.v), spec = PARAMS[key];
      if (spec === undefined) return null;
      if (seen[key] !== undefined) return null;
      seen[key] = true;
      var name = spec[0], kind = spec[1], u = { key: key, name: name };
      if (kind === "coin") {
        var cv = coinStr(v); if (cv === null) return null;
        u.value = cv;
      } else if (kind === "u32" || kind === "u16") {
        var uv = uintUpTo(v, kind === "u32" ? MAX_U32 : MAX_U16); if (uv === null) return null;
        u.value = uv.toString();
      } else if (kind === "unit" || kind === "nonneg") {
        var iv = interval(v, kind === "unit"); if (iv === null) return null;
        u.numerator = iv.numerator; u.denominator = iv.denominator;
      } else if (kind === "costmodels") {
        if (v.t !== "map") return null;
        var models = [], seenLang = {};
        for (var j = 0; j < v.pairs.length; j++) {
          var lk = v.pairs[j][0], lv = v.pairs[j][1];
          if (lk.t !== "int" || lk.v < 0n || lk.v > 255n) return null;
          var lang = Number(lk.v);
          if (seenLang[lang] !== undefined) return null;
          seenLang[lang] = true;
          if (lv.t !== "array") return null;
          var costs = [];
          for (var m = 0; m < lv.items.length; m++) {
            var c = lv.items[m];
            if (c.t !== "int" || c.v < MIN_I64 || c.v > MAX_I64) return null;
            costs.push(c.v.toString());
          }
          models.push({ language: lang, costs: costs });
        }
        u.models = models;
      } else if (kind === "prices") {
        if (v.t !== "array" || v.items.length !== 2) return null;
        var mp = interval(v.items[0], false), sp = interval(v.items[1], false);
        if (mp === null || sp === null) return null;
        u.memPrice = mp; u.stepPrice = sp;
      } else if (kind === "exunits") {
        if (v.t !== "array" || v.items.length !== 2) return null;
        var mem = uintUpTo(v.items[0], MAX_I64), steps = uintUpTo(v.items[1], MAX_I64);
        if (mem === null || steps === null) return null;
        u.mem = mem.toString(); u.steps = steps.toString();
      } else if (kind === "poolthr" || kind === "drep thr") {
        var th = intervalList(v, kind === "poolthr" ? 5 : 10, true);
        if (th === null) return null;
        u.thresholds = th;
      }
      updates.push(u);
    }
    return updates;
  }
  function govAction(node) {
    if (!node || node.t !== "array" || node.items.length === 0) return null;
    if (node.items[0].t !== "int") return null;
    var code = node.items[0].v, it = node.items;
    if (code === 6n) {
      if (it.length !== 1) return null;
      return { type: 6, name: "info_action" };
    }
    if (code === 0n) {
      if (it.length !== 4) return null;
      var pv0 = prevOrBad(it[1]); if (pv0 === "bad") return null;
      var upd = paramUpdate(it[2]); if (upd === null) return null;
      var g0 = hashOrBad(it[3]); if (g0 === "bad") return null;
      return { type: 0, name: "parameter_change", prevAction: pv0, updates: upd, guardrailsScriptHash: g0 };
    }
    if (code === 1n) {
      if (it.length !== 3) return null;
      var pv1 = prevOrBad(it[1]); if (pv1 === "bad") return null;
      var ver = it[2];
      if (!ver || ver.t !== "array" || ver.items.length !== 2) return null;
      var major = uintUpTo(ver.items[0], 12n), minor = uintUpTo(ver.items[1], MAX_U32);
      if (major === null || minor === null) return null;
      return { type: 1, name: "hard_fork_initiation", prevAction: pv1,
        protocolVersion: { major: Number(major), minor: Number(minor) } };
    }
    if (code === 2n) {
      if (it.length !== 3) return null;
      var wm = it[1];
      if (!wm || wm.t !== "map") return null;
      var withdrawals = [], seenW = {}, total = 0n;
      for (var wi = 0; wi < wm.pairs.length; wi++) {
        var ra = rewardAccount(wm.pairs[wi][0]); if (ra === null) return null;
        if (seenW[ra.addressHex] !== undefined) return null;
        seenW[ra.addressHex] = true;
        var amt = coinStr(wm.pairs[wi][1]); if (amt === null) return null;
        total += BigInt(amt);
        withdrawals.push({ rewardAccount: ra, lovelace: amt });
      }
      var g2 = hashOrBad(it[2]); if (g2 === "bad") return null;
      return { type: 2, name: "treasury_withdrawals", withdrawals: withdrawals,
        totalLovelace: total.toString(), guardrailsScriptHash: g2 };
    }
    if (code === 3n) {
      if (it.length !== 2) return null;
      var pv3 = prevOrBad(it[1]); if (pv3 === "bad") return null;
      return { type: 3, name: "no_confidence", prevAction: pv3 };
    }
    if (code === 4n) {
      if (it.length !== 5) return null;
      var pv4 = prevOrBad(it[1]); if (pv4 === "bad") return null;
      var rem = it[2];
      if (rem && rem.t === "tag" && rem.n === 258n) rem = rem.item;
      if (!rem || rem.t !== "array") return null;
      var removed = [], seenR = {};
      for (var ri = 0; ri < rem.items.length; ri++) {
        var rc = cred(rem.items[ri]); if (rc === null) return null;
        var rk = rc.kind + ":" + rc.hash;
        if (seenR[rk] !== undefined) return null;
        seenR[rk] = true; removed.push(rc);
      }
      var add = it[3];
      if (!add || add.t !== "map") return null;
      var added = [], seenA = {};
      for (var ai = 0; ai < add.pairs.length; ai++) {
        var ac = cred(add.pairs[ai][0]); if (ac === null) return null;
        var ak = ac.kind + ":" + ac.hash;
        if (seenA[ak] !== undefined) return null;
        seenA[ak] = true;
        var ep = uintUpTo(add.pairs[ai][1], MAX_U64); if (ep === null) return null;
        added.push({ credential: ac, epoch: ep.toString() });
      }
      var quorum = interval(it[4], true); if (quorum === null) return null;
      return { type: 4, name: "update_committee", prevAction: pv4,
        removed: removed, added: added, quorum: quorum };
    }
    if (code === 5n) {
      if (it.length !== 3) return null;
      var pv5 = prevOrBad(it[1]); if (pv5 === "bad") return null;
      var con = it[2];
      if (!con || con.t !== "array" || con.items.length !== 2) return null;
      var ca = anchorReq(con.items[0]); if (ca === null) return null;
      var g5 = hashOrBad(con.items[1]); if (g5 === "bad") return null;
      return { type: 5, name: "new_constitution", prevAction: pv5,
        constitution: { anchor: ca, guardrailsScriptHash: g5 } };
    }
    return null;
  }
  var proposals = [], seenP = {};
  for (var pi = 0; pi < n.items.length; pi++) {
    var pn = n.items[pi];
    if (pn.t !== "array" || pn.items.length !== 4) return null;
    var pk = nodeKey(pn);
    if (seenP[pk] !== undefined) return null;
    seenP[pk] = true;
    var deposit = coinStr(pn.items[0]); if (deposit === null) return null;
    var reward = rewardAccount(pn.items[1]); if (reward === null) return null;
    var action = govAction(pn.items[2]); if (action === null) return null;
    var anchor = anchorReq(pn.items[3]); if (anchor === null) return null;
    proposals.push({ deposit: deposit, rewardAccount: reward, action: action, anchor: anchor });
  }
  return { proposals: proposals, count: proposals.length };
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


/* Auxiliary data decoder — a standalone AUXILIARY DATA block on
   its own: the metadata and auxiliary scripts a transaction
   carries BESIDE its body (the body only holds this block's
   blake2b-256 hash, at key 7). Until now this block only ever
   appeared inside the transaction inspector as that hash. Ledger
   CDDL (Conway): auxiliary_data = metadata /
   auxiliary_data_array / auxiliary_data_map — THREE forms, all
   decoded here: (1) a bare metadata map {* metadatum_label =>
   metadatum}; (2) the Shelley-era array [metadata,
   [* native_script]]; (3) the Alonzo-era map under CBOR tag 259,
   { ? 0 : metadata, ? 1 : [* native_script], ? 2 :
   [* plutus_v1_script], ? 3 : [* plutus_v2_script], ? 4 :
   [* plutus_v3_script] } — every key optional, no key repeated,
   no other key admitted. A metadatum is a map, a list, an
   integer, a byte string of at most 64 bytes or a text string
   of at most 64 bytes, nested freely; those two size caps are
   the ledger's, and the oracle AGREES for once — pycardano
   0.19.2 raises on a 65-byte string of either kind. Labels are
   uint .size 8 per the CDDL (the ledger type is Word64), and a
   repeated label is rejected like every map in this hub; here
   the CDDL governs OVER the oracle, which serialises a negative
   label (a1 20 01) and a bignum label the ledger cannot hold.
   Integer VALUES are the ledger's arbitrary-precision Integer,
   so the bignum forms (tags 2 and 3) decode to their exact
   decimal — the oracle emits them too (2^70 round-trips). A
   native script decodes recursively ([0, key hash] sig, [1,…]
   all, [2,…] any, [3, n, […]] atLeast — n is NOT capped at the
   list length, the CDDL states no such bound and the oracle
   serialises 5-of-1 — [4, slot] after, [5, slot] before), and
   every script, native or Plutus, is shown with its script
   hash: blake2b-224 of the language tag byte (0 native, 1/2/3
   Plutus V1/V2/V3) followed by the script's exact serialised
   bytes — for native scripts those bytes are recovered from
   the parse spans, never re-serialised. The block's own hash
   (blake2b-256 of the bytes as given) is shown too: it is the
   value a body commits to at key 7. Input capped at
   max_tx_size (16,384) like the transaction tools — auxiliary
   data counts toward a transaction's size. Proven against
   pycardano 0.19.2's AuxiliaryData serialisations in scratch
   (aux_py.py / aux_vectors.json, oracle round-trip asserted in
   the generator): bare metadata, empty metadata, the Shelley
   array, the full Alonzo map (metadata + a timelock + all
   three Plutus versions), a scripts-only Alonzo map and a
   metadata-only one all decode field-for-field, with script
   hashes cross-checked against pycardano's own native-script
   hashes and hashlib's blake2b-224 for the Plutus ones.
   Display only — nothing is signed or sent. */
function parseAuxDataCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var root = parsed.node;
  var digest = blake2b(bytes, 32);
  if (digest === null) return null;
  var hash = bytesToHex(digest);

  /* Byte span of every node, recovered by re-walking the parse:
     a child's span starts where its parent's head ends, and its
     end is the parser's own next offset. Native script hashes
     are taken over these exact bytes (the txId lesson: hash
     the bytes as transmitted, never a re-serialisation). */
  function headLen(pos) {
    var ai = bytes[pos] & 31;
    if (ai < 24 || ai === 31) return 1;
    if (ai === 24) return 2;
    if (ai === 25) return 3;
    if (ai === 26) return 5;
    return 9;
  }
  function spanTree(node, pos) {
    var end = cborParseItem(bytes, pos, 0);
    if (!end) return null;
    var span = { start: pos, end: end.next, children: [] };
    var kids = [];
    if (node.t === "array") kids = node.items;
    else if (node.t === "map") node.pairs.forEach(function (pr) { kids.push(pr[0]); kids.push(pr[1]); });
    else if (node.t === "tag") kids = [node.item];
    else return span;
    var childPos = pos + headLen(pos);
    for (var i = 0; i < kids.length; i++) {
      var cs = spanTree(kids[i], childPos);
      if (cs === null) return null;
      span.children.push(cs);
      childPos = cs.end;
    }
    return span;
  }
  var rootSpan = spanTree(root, 0);
  if (rootSpan === null) return null;

  function bignumValue(n) {
    /* tag 2: the byte string as an unsigned integer; tag 3: -1 - that */
    if (n.t !== "tag" || (n.n !== 2n && n.n !== 3n) || n.item.t !== "bytes") return null;
    var v = 0n;
    for (var i = 0; i < n.item.bytes.length; i++) v = (v << 8n) + BigInt(n.item.bytes[i]);
    return n.n === 2n ? v : -1n - v;
  }
  function renderMetadatum(n) {
    if (n.t === "int") return n.v.toString();
    var big = bignumValue(n);
    if (big !== null) return big.toString();
    if (n.t === "text") {
      if (new TextEncoder().encode(n.v).length > 64) return null;
      return JSON.stringify(n.v);
    }
    if (n.t === "bytes") {
      if (n.bytes.length > 64) return null;
      return "0x" + bytesToHex(n.bytes);
    }
    if (n.t === "array") {
      var parts = [];
      for (var i = 0; i < n.items.length; i++) {
        var r = renderMetadatum(n.items[i]);
        if (r === null) return null;
        parts.push(r);
      }
      return "[" + parts.join(", ") + "]";
    }
    if (n.t === "map") {
      var seen = {}, ps = [];
      for (var j = 0; j < n.pairs.length; j++) {
        var kr = renderMetadatum(n.pairs[j][0]);
        if (kr === null || seen[kr] !== undefined) return null;
        seen[kr] = true;
        var vr = renderMetadatum(n.pairs[j][1]);
        if (vr === null) return null;
        ps.push(kr + ": " + vr);
      }
      return "{" + ps.join(", ") + "}";
    }
    return null; /* bool / null / simple / float / other tags: not metadatum */
  }
  function parseMetadata(n) {
    if (n.t !== "map") return null;
    var seen = {}, out = [];
    for (var i = 0; i < n.pairs.length; i++) {
      var lab = n.pairs[i][0];
      if (lab.t !== "int" || lab.v < 0n) return null; /* uint .size 8 (parser caps at 2^64-1) */
      var labStr = lab.v.toString();
      if (seen[labStr] !== undefined) return null; /* a map: one value per label */
      seen[labStr] = true;
      var val = renderMetadatum(n.pairs[i][1]);
      if (val === null) return null;
      out.push({ label: labStr, value: val });
    }
    return out;
  }
  function scriptHashOfSpan(span) {
    var d = blake2b([0].concat(bytes.slice(span.start, span.end)), 28);
    return d === null ? null : bytesToHex(d);
  }
  function decodeNative(n, span) {
    if (n.t !== "array" || n.items.length === 0 || n.items[0].t !== "int") return null;
    var code = n.items[0].v;
    var selfHash = scriptHashOfSpan(span);
    if (selfHash === null) return null;
    function childScripts() {
      var arrNode = n.items[n.items.length - 1], arrSpan = span.children[span.children.length - 1];
      if (arrNode.t !== "array") return null;
      var out = [];
      for (var i = 0; i < arrNode.items.length; i++) {
        var d = decodeNative(arrNode.items[i], arrSpan.children[i]);
        if (d === null) return null;
        out.push(d);
      }
      return out;
    }
    function joined(list) { return list.map(function (d) { return d.text; }).join(", "); }
    if (code === 0n) {
      if (n.items.length !== 2 || n.items[1].t !== "bytes" || n.items[1].bytes.length !== 28) return null;
      var kh = bytesToHex(n.items[1].bytes);
      return { kind: "sig", keyHash: kh, text: "sig " + kh, hash: selfHash };
    }
    if (code === 1n || code === 2n) {
      if (n.items.length !== 2) return null;
      var subs = childScripts();
      if (subs === null) return null;
      var kind = code === 1n ? "all" : "any";
      return { kind: kind, scripts: subs, text: kind + "(" + joined(subs) + ")", hash: selfHash };
    }
    if (code === 3n) {
      if (n.items.length !== 3 || n.items[1].t !== "int" || n.items[1].v < 0n) return null;
      var subs3 = childScripts();
      if (subs3 === null) return null;
      return { kind: "atLeast", required: n.items[1].v.toString(), scripts: subs3, text: "atLeast " + n.items[1].v.toString() + " of (" + joined(subs3) + ")", hash: selfHash };
    }
    if (code === 4n || code === 5n) {
      if (n.items.length !== 2 || n.items[1].t !== "int" || n.items[1].v < 0n) return null;
      var kindT = code === 4n ? "after" : "before";
      return { kind: kindT, slot: n.items[1].v.toString(), text: kindT + " " + n.items[1].v.toString(), hash: selfHash };
    }
    return null;
  }
  function decodeNativeList(n, span) {
    if (n.t !== "array") return null;
    var out = [];
    for (var i = 0; i < n.items.length; i++) {
      var d = decodeNative(n.items[i], span.children[i]);
      if (d === null) return null;
      out.push(d);
    }
    return out;
  }
  function parsePlutusList(n, kind) {
    if (n.t !== "array") return null;
    var out = [];
    for (var i = 0; i < n.items.length; i++) {
      if (n.items[i].t !== "bytes") return null;
      var h = scriptHash(kind, bytesToHex(n.items[i].bytes));
      if (h === null) return null;
      out.push({ language: kind, size: n.items[i].bytes.length, hash: h });
    }
    return out;
  }

  var format = null, metadata = null, nativeScripts = [], plutusScripts = [];
  if (root.t === "map") {
    format = "metadata";
    metadata = parseMetadata(root);
    if (metadata === null) return null;
  } else if (root.t === "array") {
    if (root.items.length !== 2) return null;
    format = "shelley";
    metadata = parseMetadata(root.items[0]);
    if (metadata === null) return null;
    nativeScripts = decodeNativeList(root.items[1], rootSpan.children[1]);
    if (nativeScripts === null) return null;
  } else if (root.t === "tag" && root.n === 259n && root.item.t === "map") {
    format = "alonzo";
    var mapSpan = rootSpan.children[0];
    var seenKey = {};
    var kinds = { "2": "plutusv1", "3": "plutusv2", "4": "plutusv3" };
    for (var i = 0; i < root.item.pairs.length; i++) {
      var k = root.item.pairs[i][0], v = root.item.pairs[i][1];
      if (k.t !== "int" || k.v < 0n || k.v > 4n) return null;
      var ks = k.v.toString();
      if (seenKey[ks] !== undefined) return null;
      seenKey[ks] = true;
      var vSpan = mapSpan.children[2 * i + 1];
      if (ks === "0") { metadata = parseMetadata(v); if (metadata === null) return null; }
      else if (ks === "1") { nativeScripts = decodeNativeList(v, vSpan); if (nativeScripts === null) return null; }
      else {
        var pl = parsePlutusList(v, kinds[ks]);
        if (pl === null) return null;
        plutusScripts = plutusScripts.concat(pl);
      }
    }
  } else return null;
  return { format: format, hash: hash, metadata: metadata, nativeScripts: nativeScripts, plutusScripts: plutusScripts };
}

/* Transaction witness set decoder — a standalone WITNESS SET
   on its own: the second element of every transaction, the
   signatures and scripts that authorise the body, which until
   now only ever appeared inside a whole transaction (and the
   inspector does not decode it at all). Ledger CDDL (Conway):
   transaction_witness_set = { ? 0 : nonempty_list<vkeywitness>,
   ? 1 : nonempty_list<native_script>, ? 2 :
   nonempty_list<bootstrap_witness>, ? 3 :
   nonempty_set<plutus_v1_script>, ? 4 :
   nonempty_list<plutus_data>, ? 5 : redeemers, ? 6 :
   nonempty_set<plutus_v2_script>, ? 7 :
   nonempty_set<plutus_v3_script> } — every key optional (an
   empty witness set a0 decodes; a script-only transaction
   legitimately carries no key witness), no key repeated, no
   other key admitted. nonempty_list and nonempty_set are both
   #6.258([+ a]) / [+ a] — set tag 258 or a plain array, at
   least one entry either way, so an empty list at any key is
   rejected even though pycardano 0.19.2 serialises one (a10080
   probed). The LIST keys (0, 1, 2, 4) keep duplicates — the
   grammar is a list — while the SET keys (3, 6, 7) reject a
   repeated script, overruling the oracle, which serialises the
   same Plutus V2 script twice. A vkey witness is [vkey,
   signature] with vkey exactly 32 bytes and signature exactly
   64 (the oracle serialises a 63-byte signature happily; the
   CDDL sizes govern); each key is also shown as its key hash,
   blake2b-224 of the key — the hash addresses and bodies
   actually name. A bootstrap (Byron-era) witness is
   [public_key, signature, chain_code, attributes] — the last
   two are plain `bytes` in the CDDL (Shelley, Babbage and
   Conway texts all leave them unsized), so no size is imposed
   here either; pycardano 0.19.2 has NO bootstrap class (the
   field is List[Any] with a TODO in its source), so that vector
   is built from the CDDL text and proven by the oracle's own
   from_cbor round-trip. Native scripts decode recursively
   exactly as in the auxiliary data decoder, hashes over their
   exact serialised bytes (span tree, never re-serialised);
   Plutus scripts show size and script hash (language byte ‖
   bytes, blake2b-224). A Plutus datum must be a real
   plutus_data — a constructor (tags 121–127, 1280–1400, or 102
   wrapping [alternative, fields]), a map, a list, an integer
   (bignum tags 2/3 included) or a byte string of at most 64
   bytes (bounded_bytes) — and is shown rendered plus its datum
   hash, blake2b-256 of its exact bytes: the hash an output
   would commit to. Redeemers come in BOTH serialisations: the
   legacy array [+ redeemer], redeemer = [tag, index, data,
   ex_units], and the Conway map {+ [tag, index] => [data,
   ex_units]} with repeated keys rejected; tag is 0–5 (spend,
   mint, cert, reward, voting, proposing), index is uint .size
   4 and the ex-units are 0..max_int64 each — all three gates
   overrule the oracle, which serialises an index of 2^32 and a
   negative memory value. Input capped at max_tx_size (16,384)
   like the transaction tools. Proven against pycardano
   0.19.2's TransactionWitnessSet serialisations in scratch
   (witness_py.py / witness_vectors.json, oracle round-trip
   asserted in the generator): the empty set, key witnesses,
   native scripts, a CDDL-built bootstrap witness, all three
   Plutus versions, three datum shapes, both redeemer forms and
   a full eight-key set decode field-for-field, and a REAL
   mainnet witness set (the Plutus transaction the inspector
   tests carry, fetched via Koios) decodes with its key hash
   matching the body's required signer. Display only — the
   signatures are shown, never verified against a body (that
   needs the body too — the inspector's job), and nothing is
   signed or sent. */
function parseWitnessSetCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var root = parsed.node;
  if (root.t !== "map") return null;

  /* Byte spans, recovered exactly as in the auxiliary data
     decoder: native script hashes and datum hashes are taken
     over the bytes as transmitted, never a re-serialisation. */
  function headLen(pos) {
    var ai = bytes[pos] & 31;
    if (ai < 24 || ai === 31) return 1;
    if (ai === 24) return 2;
    if (ai === 25) return 3;
    if (ai === 26) return 5;
    return 9;
  }
  function spanTree(node, pos) {
    var end = cborParseItem(bytes, pos, 0);
    if (!end) return null;
    var span = { start: pos, end: end.next, children: [] };
    var kids = [];
    if (node.t === "array") kids = node.items;
    else if (node.t === "map") node.pairs.forEach(function (pr) { kids.push(pr[0]); kids.push(pr[1]); });
    else if (node.t === "tag") kids = [node.item];
    else return span;
    var childPos = pos + headLen(pos);
    for (var i = 0; i < kids.length; i++) {
      var cs = spanTree(kids[i], childPos);
      if (cs === null) return null;
      span.children.push(cs);
      childPos = cs.end;
    }
    return span;
  }
  var rootSpan = spanTree(root, 0);
  if (rootSpan === null) return null;

  var MAX_I64 = 9223372036854775807n, MAX_U32 = 4294967295n;
  function unwrapNonempty(n, span) {
    if (n.t === "tag" && n.n === 258n) { n = n.item; span = span.children[0]; }
    if (n.t !== "array" || n.items.length === 0) return null;
    return { node: n, span: span };
  }
  function keyHashOf(bts) {
    var d = blake2b(bts, 28);
    return d === null ? null : bytesToHex(d);
  }
  function scriptHashOfSpan(span) {
    var d = blake2b([0].concat(bytes.slice(span.start, span.end)), 28);
    return d === null ? null : bytesToHex(d);
  }
  function decodeNative(n, span) {
    if (n.t !== "array" || n.items.length === 0 || n.items[0].t !== "int") return null;
    var code = n.items[0].v;
    var selfHash = scriptHashOfSpan(span);
    if (selfHash === null) return null;
    function childScripts() {
      var arrNode = n.items[n.items.length - 1], arrSpan = span.children[span.children.length - 1];
      if (arrNode.t !== "array") return null;
      var out = [];
      for (var i = 0; i < arrNode.items.length; i++) {
        var d = decodeNative(arrNode.items[i], arrSpan.children[i]);
        if (d === null) return null;
        out.push(d);
      }
      return out;
    }
    function joined(list) { return list.map(function (d) { return d.text; }).join(", "); }
    if (code === 0n) {
      if (n.items.length !== 2 || n.items[1].t !== "bytes" || n.items[1].bytes.length !== 28) return null;
      var kh = bytesToHex(n.items[1].bytes);
      return { kind: "sig", keyHash: kh, text: "sig " + kh, hash: selfHash };
    }
    if (code === 1n || code === 2n) {
      if (n.items.length !== 2) return null;
      var subs = childScripts();
      if (subs === null) return null;
      var kind = code === 1n ? "all" : "any";
      return { kind: kind, scripts: subs, text: kind + "(" + joined(subs) + ")", hash: selfHash };
    }
    if (code === 3n) {
      if (n.items.length !== 3 || n.items[1].t !== "int" || n.items[1].v < 0n) return null;
      var subs3 = childScripts();
      if (subs3 === null) return null;
      return { kind: "atLeast", required: n.items[1].v.toString(), scripts: subs3, text: "atLeast " + n.items[1].v.toString() + " of (" + joined(subs3) + ")", hash: selfHash };
    }
    if (code === 4n || code === 5n) {
      if (n.items.length !== 2 || n.items[1].t !== "int" || n.items[1].v < 0n) return null;
      var kindT = code === 4n ? "after" : "before";
      return { kind: kindT, slot: n.items[1].v.toString(), text: kindT + " " + n.items[1].v.toString(), hash: selfHash };
    }
    return null;
  }
  function validPlutusData(n, depth) {
    if (depth > 100) return false;
    if (n.t === "int") return true;
    if (n.t === "bytes") return n.bytes.length <= 64;
    if (n.t === "array") {
      for (var i = 0; i < n.items.length; i++) if (!validPlutusData(n.items[i], depth + 1)) return false;
      return true;
    }
    if (n.t === "map") {
      for (var j = 0; j < n.pairs.length; j++)
        if (!validPlutusData(n.pairs[j][0], depth + 1) || !validPlutusData(n.pairs[j][1], depth + 1)) return false;
      return true;
    }
    if (n.t === "tag") {
      if ((n.n === 2n || n.n === 3n) && n.item.t === "bytes") return n.item.bytes.length <= 64;
      if (n.n === 102n) {
        if (n.item.t !== "array" || n.item.items.length !== 2) return false;
        if (n.item.items[0].t !== "int" || n.item.items[0].v < 0n) return false;
        if (n.item.items[1].t !== "array") return false;
        for (var k = 0; k < n.item.items[1].items.length; k++)
          if (!validPlutusData(n.item.items[1].items[k], depth + 1)) return false;
        return true;
      }
      if ((n.n >= 121n && n.n <= 127n) || (n.n >= 1280n && n.n <= 1400n)) {
        if (n.item.t !== "array") return false;
        for (var m = 0; m < n.item.items.length; m++)
          if (!validPlutusData(n.item.items[m], depth + 1)) return false;
        return true;
      }
      return false;
    }
    return false;
  }
  function datumEntry(n, span) {
    if (!validPlutusData(n, 0)) return null;
    var d = blake2b(bytes.slice(span.start, span.end), 32);
    if (d === null) return null;
    return { data: cborRender(n), hash: bytesToHex(d) };
  }
  var TAG_NAMES = ["spend", "mint", "cert", "reward", "voting", "proposing"];
  function exUnits(n) {
    if (n.t !== "array" || n.items.length !== 2) return null;
    var m = n.items[0], s = n.items[1];
    if (m.t !== "int" || s.t !== "int" || m.v < 0n || s.v < 0n || m.v > MAX_I64 || s.v > MAX_I64) return null;
    return { mem: m.v.toString(), steps: s.v.toString() };
  }
  function redeemerEntry(tagN, idxN, dataN, dataSpan, exN) {
    if (tagN.t !== "int" || tagN.v < 0n || tagN.v > 5n) return null;
    if (idxN.t !== "int" || idxN.v < 0n || idxN.v > MAX_U32) return null;
    var de = datumEntry(dataN, dataSpan);
    if (de === null) return null;
    var ex = exUnits(exN);
    if (ex === null) return null;
    return { tag: Number(tagN.v), tagName: TAG_NAMES[Number(tagN.v)], index: Number(idxN.v),
             data: de.data, dataHash: de.hash, exUnits: ex };
  }
  function parseRedeemers(n, span) {
    var out = [];
    if (n.t === "array") {
      if (n.items.length === 0) return null;
      for (var i = 0; i < n.items.length; i++) {
        var it = n.items[i], iSpan = span.children[i];
        if (it.t !== "array" || it.items.length !== 4) return null;
        var r = redeemerEntry(it.items[0], it.items[1], it.items[2], iSpan.children[2], it.items[3]);
        if (r === null) return null;
        out.push(r);
      }
      return { form: "list", entries: out };
    }
    if (n.t === "map") {
      if (n.pairs.length === 0) return null;
      var seen = {};
      for (var j = 0; j < n.pairs.length; j++) {
        var k = n.pairs[j][0], v = n.pairs[j][1], vSpan = span.children[2 * j + 1];
        if (k.t !== "array" || k.items.length !== 2) return null;
        if (v.t !== "array" || v.items.length !== 2) return null;
        var r2 = redeemerEntry(k.items[0], k.items[1], v.items[0], vSpan.children[0], v.items[1]);
        if (r2 === null) return null;
        var kk = r2.tag + "#" + r2.index;
        if (seen[kk] !== undefined) return null; /* a map: one value per key */
        seen[kk] = true;
        out.push(r2);
      }
      return { form: "map", entries: out };
    }
    return null;
  }

  var vkeyWitnesses = [], nativeScripts = [], bootstrapWitnesses = [],
      plutusScripts = [], plutusData = [], redeemers = null;
  var seenKey = {};
  for (var pi = 0; pi < root.pairs.length; pi++) {
    var key = root.pairs[pi][0], val = root.pairs[pi][1], valSpan = rootSpan.children[2 * pi + 1];
    if (key.t !== "int" || key.v < 0n || key.v > 7n) return null;
    var ks = key.v.toString();
    if (seenKey[ks] !== undefined) return null;
    seenKey[ks] = true;
    if (ks === "0") {
      var lw = unwrapNonempty(val, valSpan); if (lw === null) return null;
      for (var a = 0; a < lw.node.items.length; a++) {
        var w = lw.node.items[a];
        if (w.t !== "array" || w.items.length !== 2) return null;
        if (w.items[0].t !== "bytes" || w.items[0].bytes.length !== 32) return null;
        if (w.items[1].t !== "bytes" || w.items[1].bytes.length !== 64) return null;
        var wkh = keyHashOf(w.items[0].bytes); if (wkh === null) return null;
        vkeyWitnesses.push({ vkey: bytesToHex(w.items[0].bytes), keyHash: wkh, signature: bytesToHex(w.items[1].bytes) });
      }
    } else if (ks === "1") {
      var ln = unwrapNonempty(val, valSpan); if (ln === null) return null;
      for (var b = 0; b < ln.node.items.length; b++) {
        var nd = decodeNative(ln.node.items[b], ln.span.children[b]);
        if (nd === null) return null;
        nativeScripts.push(nd);
      }
    } else if (ks === "2") {
      var lb = unwrapNonempty(val, valSpan); if (lb === null) return null;
      for (var c = 0; c < lb.node.items.length; c++) {
        var bw = lb.node.items[c];
        if (bw.t !== "array" || bw.items.length !== 4) return null;
        if (bw.items[0].t !== "bytes" || bw.items[0].bytes.length !== 32) return null;
        if (bw.items[1].t !== "bytes" || bw.items[1].bytes.length !== 64) return null;
        if (bw.items[2].t !== "bytes" || bw.items[3].t !== "bytes") return null;
        var bkh = keyHashOf(bw.items[0].bytes); if (bkh === null) return null;
        bootstrapWitnesses.push({ publicKey: bytesToHex(bw.items[0].bytes), keyHash: bkh,
          signature: bytesToHex(bw.items[1].bytes), chainCode: bytesToHex(bw.items[2].bytes),
          attributes: bytesToHex(bw.items[3].bytes) });
      }
    } else if (ks === "3" || ks === "6" || ks === "7") {
      var lp = unwrapNonempty(val, valSpan); if (lp === null) return null;
      var kind = ks === "3" ? "plutusv1" : ks === "6" ? "plutusv2" : "plutusv3";
      var seenS = {};
      for (var d = 0; d < lp.node.items.length; d++) {
        if (lp.node.items[d].t !== "bytes") return null;
        var shex = bytesToHex(lp.node.items[d].bytes);
        if (seenS[shex] !== undefined) return null; /* a set: no repeated script */
        seenS[shex] = true;
        var sh = scriptHash(kind, shex); if (sh === null) return null;
        plutusScripts.push({ language: kind, size: lp.node.items[d].bytes.length, hash: sh });
      }
    } else if (ks === "4") {
      var ld = unwrapNonempty(val, valSpan); if (ld === null) return null;
      for (var e = 0; e < ld.node.items.length; e++) {
        var de = datumEntry(ld.node.items[e], ld.span.children[e]);
        if (de === null) return null;
        plutusData.push(de);
      }
    } else if (ks === "5") {
      redeemers = parseRedeemers(val, valSpan);
      if (redeemers === null) return null;
    }
  }
  return { vkeyWitnesses: vkeyWitnesses, nativeScripts: nativeScripts,
           bootstrapWitnesses: bootstrapWitnesses, plutusScripts: plutusScripts,
           plutusData: plutusData, redeemers: redeemers };
}

/* Redeemers decoder — a standalone REDEEMERS field on its own
   (witness set key 5): the instructions a transaction gives its
   Plutus scripts — which script runs, on what, with what data and
   what execution budget — which until now only ever appeared
   inside the witness set decoder and the script data hash
   calculator. Ledger CDDL (Conway): redeemers =
   [+ redeemer] / {+ redeemer_key => redeemer_value}, with
   redeemer = [tag, index, data, ex_units] in the legacy array
   form and redeemer_key = [tag, index], redeemer_value =
   [data, ex_units] in the Conway map form; redeemer_tag = 0..5
   (spend, mint, cert, reward, voting, proposing), index is
   uint .size 4, data is plutus_data and ex_units is
   [mem, steps] with each 0..max_int64. BOTH forms must name at
   least one redeemer (the grammar's + in both alternatives).
   The two forms differ in exactly one semantic, and the shipped
   copy records it so nobody "aligns" them: the ARRAY form is a
   list — the same redeemer twice decodes as two entries (the
   oracle serialises it so) — while the MAP form is keyed by
   [tag, index], so a repeated key is rejected (one value per
   key; the oracle's RedeemerMap cannot even hold two). The
   remaining gates overrule the oracle, in the sibling runs'
   split (the CDDL governs ranges and cardinality, the oracle
   only proves byte shapes): an empty field is rejected though
   pycardano serialises an empty redeemer list with the field
   present (a10580, probed in the generator); tag 6, an index of
   2^32 and a negative ex-unit are rejected though pycardano
   serialises the last two (both probed); a datum must be a
   real plutus_data (constructor, map, list, integer incl.
   bignum tags 2/3, or a byte string of at most 64 bytes — a
   65-byte datum and a text datum are rejected) and is shown
   rendered plus its datum hash, blake2b-256 of its exact
   bytes — the hash the script data hash commits to.
   Validation REUSES the proven witness set decoder via a
   synthetic one-key witness set — the script data hash
   calculator's seam — so there is no second redeemer gate to
   drift: this function cleans the input, wraps it as key 5 and
   returns that decoder's redeemers. A whole witness set pasted
   here is refused (its map keys are integers, not [tag, index]
   pairs) — the witness set decoder above reads those. Entries
   are shown in the order encoded. Input capped at max_tx_size
   (16,384) like the transaction tools. Proven against
   pycardano 0.19.2's TransactionWitnessSet serialisations in
   scratch (redeemers_py.py / redeemers_vectors.json, each
   field extracted by span from a whole witness set, re-wrapped
   and read back by the oracle in the generator): a single
   redeemer, the two-entry array form, the same redeemer twice
   in array form, the range extremes (proposing tag, index
   2^32−1, ex-units at max_int64), the two-entry map form, a
   bignum datum in map form, and the redeemers of a REAL
   mainnet transaction (the Plutus transaction the witness
   tests carry, fetched via Koios) all decode field-for-field.
   Display only — a redeemer index is only checked for range
   here; whether it points at a real input, policy or voter
   needs the body too (the full transaction decoder's
   cross-check), and nothing is signed or sent. */
function parseRedeemersCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var w = parseWitnessSetCbor("a105" + bytesToHex(bytes));
  if (w === null || w.redeemers === null) return null;
  return { form: w.redeemers.form, entries: w.redeemers.entries, count: w.redeemers.entries.length };
}

/* Plutus data decoder — a standalone PLUTUS DATA field on its
   own (witness set key 4): the datums a transaction carries in
   its witness set for its scripts to consume, which until now
   only ever appeared inside the witness set decoder, the
   CIP-68 viewer (which interprets ONE datum as token
   metadata) and the script data hash calculator (which only
   counts them). Ledger CDDL (Conway): plutus_data (the field)
   = nonempty_set<plutus_data> — a set (tag 258 or a plain
   array; pycardano emits the plain form, the chain also
   carries the tag-258 form, incl. indefinite-length arrays)
   with at least one entry, where each entry is a plutus_data:
   a constructor (tags 121–127 for alternatives 0–6, tags
   1280–1400 for 7–127) over a list of fields, a map, a list,
   an integer (incl. the bignum tags 2/3), or a byte string of
   at most 64 bytes — a text string is NOT plutus_data and a
   65-byte byte string is refused, both overruling the oracle,
   which serialises both when handed them as raw CBOR (probed
   in the generator). An empty field is refused though
   pycardano serialises one (a10480, probed). SET SEMANTICS,
   recorded so nobody "fixes" it either way: the field is a
   set, but the wire can carry the same datum twice (pycardano
   serialises a duplicated datum twice, probed) and this
   decoder — like the witness set decoder it delegates to —
   shows entries exactly as encoded, in encoded order; a
   datum hash lookup does not care which copy it finds.
   Validation REUSES the proven witness set decoder via a
   synthetic one-key witness set — the same seam the
   redeemers decoder and the script data hash calculator use —
   so there is no second datum gate to drift: this function
   cleans the input, wraps it as key 4 and returns that
   decoder's Plutus data, each entry rendered plus its datum
   hash, blake2b-256 over its EXACT span bytes (the hash an
   output commits to when it carries a datum by hash). A whole
   witness set pasted here is refused (its top level is a map,
   not a set) — the witness set decoder above reads those, and
   a single bare datum is refused (it is not the field).
   Input capped at max_tx_size (16,384) like the transaction
   tools. Proven against pycardano 0.19.2's
   TransactionWitnessSet serialisations in scratch
   (datums_py.py / datums_vectors.json, each field extracted
   by span from a whole witness set, re-wrapped and read back
   by the oracle in the generator): a plain integer, a bounded
   byte string, a Constr datum, a five-entry mix (Constr,
   Constr over an indefinite list, bytes, an indefinite list,
   a map), both bignum signs (2^70 and −2^70), and the Plutus
   data of a REAL mainnet transaction fetched via Koios this
   run (block 14043871, tx e626d875… — a tag-258 set over an
   indefinite array holding two Constr datums; the stored
   REAL_TX's witness set carries keys 0/5 only, its outputs
   use inline datums) all decode hash-for-hash. Display only —
   which output or redeemer a datum belongs to needs the rest
   of the transaction (the full transaction decoder's datum
   availability check), and nothing is signed or sent. */
function parseDatumsCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var w = parseWitnessSetCbor("a104" + bytesToHex(bytes));
  if (w === null || w.plutusData.length === 0) return null;
  return { entries: w.plutusData, count: w.plutusData.length };
}

/* Key witnesses decoder — a standalone VKEY WITNESSES field on
   its own (witness set key 0): the ordinary Shelley key
   signatures that authorise a transaction's inputs, which until
   now only ever appeared inside the witness set decoder and the
   full transaction decoder's signer check. Ledger CDDL
   (Conway): the field is nonempty_list<vkeywitness> =
   #6.258([+ vkeywitness]) / [+ vkeywitness] — tag 258 or a
   plain array, at least one entry either way — and a
   vkeywitness is [vkey, signature] with the vkey exactly
   32 bytes and the signature exactly 64. LIST SEMANTICS, the
   field's one subtlety, recorded so nobody "fixes" it: the
   grammar is a list, not a set, so the same witness twice
   decodes as two entries (pycardano serialises a duplicated
   witness twice and reads it back as two, probed in the
   generator) — exactly as the witness set decoder treats key 0.
   The remaining gates overrule the oracle, also probed:
   pycardano 0.19.2 serialises an empty field (a10080), a
   63-byte signature and a 31-byte vkey — all three refused
   here per the CDDL. Each witness is shown with its key hash,
   blake2b-224 of the vkey — the hash addresses and required
   signer lists actually name — so a field can be matched
   against a body's key 14 without decoding the whole set.
   Validation REUSES the proven witness set decoder via a
   synthetic one-key witness set (a100 ‖ field) — the seam the
   redeemers and Plutus data decoders already use — so there
   is no second witness gate to drift. A whole witness set
   pasted here is refused (its top level is a map, not a
   list) — the witness set decoder above reads those — and a
   single bare witness is refused (it is not the field).
   Input capped at max_tx_size (16,384) like the transaction
   tools. Proven against pycardano 0.19.2's
   TransactionWitnessSet serialisations in scratch
   (vkeywit_py.py / vkeywit_vectors.json, each field extracted
   from a whole witness set, re-wrapped as {0: field} and read
   back by the oracle in the generator): a single witness, a
   two-witness field, the same witness twice, the tag-258
   form, and a REAL mainnet field extracted by span from the
   stored witness set (one witness, tag-258 form, whose key
   hash 5b7e2322… is its body's required signer) all decode
   key-for-key and signature-for-signature. Display only —
   signatures are shown, never cryptographically verified
   (that needs the body too — the full transaction decoder
   performs the signer presence check), and nothing is signed
   or sent. */
function parseVkeyWitnessesCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var w = parseWitnessSetCbor("a100" + bytesToHex(bytes));
  if (w === null || w.vkeyWitnesses.length === 0) return null;
  return { entries: w.vkeyWitnesses, count: w.vkeyWitnesses.length };
}

/* Native scripts decoder — a standalone NATIVE SCRIPTS field
   on its own (witness set key 1): the multisig and timelock
   scripts a transaction carries to authorise script-address
   inputs and native-script minting policies, which until now
   only ever appeared inside the witness set decoder and the
   auxiliary data decoder. Ledger CDDL (Conway): the field is
   nonempty_list<native_script> = #6.258([+ native_script]) /
   [+ native_script] — tag 258 or a plain array, at least one
   entry either way — and a native_script is one of
   [0, addr_keyhash] a single required signature (the hash
   exactly 28 bytes), [1, [* native_script]] all of the
   children, [2, [* native_script]] any of them,
   [3, n, [* native_script]] at least n of them, and the two
   timelocks [4, slot] / [5, slot] — CDDL
   script_invalid_before / script_invalid_hereafter, shown as
   "after <slot>" / "before <slot>" (the slots from which /
   until which the script can be satisfied), the naming the
   hub's native script builder and both sibling decoders use.
   Scripts nest freely; every script, nested or not, is shown
   with its script hash — blake2b-224 over the 0x00 language
   byte followed by the script's EXACT span bytes, never a
   re-serialisation (the span-tree technique) — which for a
   top-level script is its policy ID when it mints.
   LIST SEMANTICS, recorded so nobody "fixes" it: the grammar
   is a list, not a set, so the same script twice decodes as
   two entries (pycardano serialises a duplicated script
   twice and reads it back as two, probed in the generator) —
   exactly as the witness set decoder treats key 1.
   The child lists of all/any/atLeast may be EMPTY — the
   grammar's [* native_script] states no minimum, pycardano
   emits an all-of-nothing and hashes it, and atLeast states
   no n <= children bound either (5-of-1 decodes, the
   auxiliary decoder's precedent). The remaining gates
   overrule the oracle, probed in the generator: an empty
   FIELD is refused though pycardano serialises one
   (a10180); a negative atLeast threshold and a negative
   timelock slot are refused though pycardano serialises and
   reads back both (a threshold is a count and a slot is a
   slot; the CDDL types the threshold int64, but no ledger
   count is negative, and both sibling decoders gate the
   same way — the seam below keeps all three identical).
   On two gates the authorities AGREE: an unknown script
   code (6) is refused, and pycardano cannot even read one
   back; a 27-byte signature hash is refused, and
   pycardano's VerificationKeyHash raises on it too.
   Validation REUSES the proven witness set decoder via a
   synthetic one-key witness set (a101 ‖ field) — the seam
   the redeemers, Plutus data and key witnesses decoders
   use — so there is no second native script gate to drift.
   A whole witness set pasted here is refused (its top level
   is a map, not a list) — the witness set decoder above
   reads those — and a single bare script is refused (it is
   not the field). Input capped at max_tx_size (16,384) like
   the transaction tools. Proven against pycardano 0.19.2's
   TransactionWitnessSet serialisations in scratch
   (nativescripts_py.py / nativescripts_vectors.json, each
   field extracted from a whole witness set, re-wrapped as
   {1: field} and read back by the oracle in the generator):
   a single signature script, a signature plus an all, a
   nested any(all(sig, after), atLeast 2 of (sig, sig,
   before), sig) exercising every code with oracle hashes at
   every level, the same script twice, the tag-258 form, an
   empty all and a 5-of-1 atLeast all decode as the oracle
   reads them — and a REAL mainnet field decodes
   hash-for-hash: tx 87a7ac8b… (block 14044379, fetched
   via Koios this run) carries its key-1 field in tag-258
   form holding one script, all(sig 207655f9…, before
   215122509), whose script hash 06b85d3e… is the oracle's
   own hash of the same bytes. The hunt for it is itself
   recorded: two Koios sweeps span-walked 3,444 recent
   mainnet witness sets (the walker verified exact
   against the stored real witness set; 2,584 of the sets
   carried key 0 alone) and found exactly ONE key-1
   field — current mainnet traffic authorises almost
   entirely with key witnesses and Plutus scripts, and
   native scripts ride in auxiliary data and reference
   outputs far more than in witness sets. Display only —
   whether a script is
   SATISFIED (signatures present, slot in range) needs the
   rest of the transaction, and nothing is signed or sent. */
function parseNativeScriptsCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var w = parseWitnessSetCbor("a101" + bytesToHex(bytes));
  if (w === null || w.nativeScripts.length === 0) return null;
  return { entries: w.nativeScripts, count: w.nativeScripts.length };
}

/* Bootstrap witnesses decoder — a standalone BOOTSTRAP
   WITNESSES field on its own (witness set key 2): the
   witnesses that authorise spending from BYRON-era
   (base58, non-HD-checksummed derivation) addresses, which
   until now only ever appeared inside the witness set
   decoder and the full transaction decoder's signer check.
   Ledger CDDL (Conway): the field is
   nonempty_list<bootstrap_witness> = #6.258([+ w]) /
   [+ w] — tag 258 or a plain array, at least one entry —
   and a bootstrap_witness is
   [public_key, signature, chain_code, attributes] with
   the public key exactly 32 bytes (vkey) and the signature
   exactly 64. The chain code and attributes carry NO size
   in the grammar — plain `bytes` in the Conway, Shelley
   AND Babbage CDDL texts (verified against all three in
   the witness set run) — so an entry with an empty chain
   code and empty attributes DECODES, as does a five-byte
   chain code: imposing the 32 bytes Byron HD derivation
   happens to use would invent a gate the ledger does not
   have. LIST SEMANTICS: the grammar is a list, so the
   same witness twice decodes as two entries — exactly
   as the witness set decoder treats key 2. Each witness
   is shown with its key hash, blake2b-224 of the public
   key — the hash a body's required signer list (key 14)
   names for a Byron input too. ORACLE STATE, recorded
   precisely: pycardano 0.19.2 has NO bootstrap witness
   class (bootstrap_witness is List[Any] with a TODO in
   the source), so the vectors are built from the CDDL
   text with RawCBOR and proven by the oracle's own
   from_cbor round-trip reading them back (encoder-side
   proof); because the field is untyped, the oracle's
   passthrough also ACCEPTS every refused shape probed —
   an empty field (it serialises one itself, a10280), a
   31-byte public key, a 63-byte signature and a
   three-item entry all read back — those gates rest on
   the CDDL alone. The tag-258 form inverts the usual
   split: the grammar admits it (nonempty_list) and this
   decoder accepts it, but the oracle CANNOT read it
   back (its untyped field raises DeserializeException
   on the CBORTag) — for this one form the CDDL and the
   seam's sibling-field precedent are the authorities.
   Validation REUSES the proven witness set decoder via
   a synthetic one-key witness set (a102 ‖ field) — the
   seam the redeemers, Plutus data, key witnesses and
   native scripts decoders use — so there is no second
   bootstrap gate to drift. A whole witness set pasted
   here is refused (its top level is a map, not a list)
   — the witness set decoder above reads those — and a
   single bare witness is refused (it is not the field).
   Input capped at max_tx_size (16,384) like the
   transaction tools. Proven in scratch (bootstrap_py.py
   / bootstrap_vectors.json, each field extracted by
   span from a whole TransactionWitnessSet serialisation,
   re-wrapped as {2: field} and read back by the oracle
   in the generator): a single witness, two witnesses
   (the second carrying a five-byte chain code), the
   same witness twice, and an entry with empty chain
   code and empty attributes all decode field-for-field
   with hashlib key hashes — and two REAL mainnet fields
   decode field-for-field: this run's Koios hunts
   span-walked 2,844 recent mainnet witness sets and
   found exactly two key-2 fields, both in sets carrying
   key 2 ALONE (Byron-only transactions still occur, in
   bursts: the two finds sit five blocks apart, blocks
   14044612 and 14044617, after 2,466 consecutive sets
   without one). The shipped vector is tx 41aec33c…
   (block 14044612): one witness whose chain code
   repeats its public key bytes exactly as encoded and
   whose attributes are the single byte a0 (an empty
   map) — shown as carried, not normalised; its key hash
   7dfad1a7… is hashlib's blake2b-224 of the public key,
   and the oracle reads the field back as one entry.
   Display only — signatures are shown,
   never cryptographically verified, and nothing is
   signed or sent. */
function parseBootstrapWitnessesCbor(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var w = parseWitnessSetCbor("a102" + bytesToHex(bytes));
  if (w === null || w.bootstrapWitnesses.length === 0) return null;
  return { entries: w.bootstrapWitnesses, count: w.bootstrapWitnesses.length };
}

/* Full transaction decoder — a WHOLE transaction on its own:
   the four-element Conway array [body, witness_set, is_valid,
   auxiliary_data / nil] that cardano-cli and wallets emit (CDDL
   `transaction`), or the three-element [body, witness_set,
   auxiliary_data / nil] form that predates the is-valid flag.
   Until now the hub decoded every PART of a transaction — the
   inspector does the body, the witness decoder the witness set,
   the auxiliary decoder the metadata block — but nothing put a
   whole transaction together and CHECKED THE PARTS AGAINST EACH
   OTHER. This composes those three proven decoders over the
   exact byte spans of the array's elements (located with the
   proven CBOR parser, never re-serialised — the txId lesson)
   and adds the consistency checks only a whole transaction
   makes possible:
   - auxiliary data hash: blake2b-256 of the attached auxiliary
     data against the hash the body commits to at key 7 —
     match, mismatch, declared-but-absent, attached-but-
     undeclared, or neither;
   - required signers: every key hash the body names at key 14
     checked against the key hashes of the key and bootstrap
     witnesses actually present (a signer may also be covered
     by a native script in the set — that is reported as the
     plain witness fact, not guessed at);
   - datum availability: every output carrying a datum HASH
     checked against the Plutus data in the witness set — the
     datum a script spending that output will need;
   - redeemer ranges: every redeemer's index checked against
     the count of things it can point at in the body (inputs
     for spend, mint policies for mint, certificates, withdrawn
     reward accounts, voters, proposals) — an index past the end
     points at nothing. Indices address the ledger's canonically
     ordered lists, so this is a range check, not a mapping.
   Strictness composes too: if any part fails its own decoder's
   gates (a malformed body, a witness set the witness decoder
   rejects, auxiliary data over the metadatum caps) the whole
   transaction is refused — a decoder that quietly skipped a
   broken part would misdescribe the transaction. A body alone
   is refused here (the inspector's job), as is anything that
   is not a 3- or 4-element array with a map witness set and,
   in the Conway form, a boolean is-valid flag. Honest limits,
   stated on the page too: signatures are shown via the witness
   decoder, NOT cryptographically verified (no Ed25519 check is
   performed), and the script data hash is not recomputed HERE
   (the languages a transaction runs are not all visible in
   it — the script data hash calculator below does that job
   from the witness parts and a language selection). Input capped at max_tx_size (16,384) like the
   other transaction tools. Proven against pycardano 0.19.2
   full Transaction serialisations in scratch (fulltx_py.py /
   fulltx_vectors.json, oracle from_cbor round-trip asserted in
   the generator): a signed body with one witnessed and one
   unwitnessed required signer, auxiliary data matching /
   mismatching / undeclared / declared-but-absent, the is-valid
   flag false, and a Plutus transaction whose datum and redeemer
   checks pass and fail in the expected places; the legacy
   three-element form and an over-cap auxiliary block are
   byte-assembled from oracle parts (pycardano emits only the
   four-element form). A REAL mainnet transaction — the Plutus
   transaction the inspector and witness tests carry, fetched
   via Koios — decodes end-to-end with its auxiliary hash
   matching and its required signer witnessed. Display only;
   nothing is signed or sent. */
function decodeFullTx(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var root = parsed.node;
  if (root.t !== "array" || (root.items.length !== 3 && root.items.length !== 4)) return null;
  var ai = bytes[0] & 31;
  if (ai === 31) return null; /* indefinite-length array: not a serialised tx */
  var head = cborReadUint(bytes, 1, ai);
  if (!head) return null;
  var spans = [], pos = head.next;
  for (var i = 0; i < root.items.length; i++) {
    var p = cborParseItem(bytes, pos, 0);
    if (!p) return null;
    spans.push([pos, p.next]);
    pos = p.next;
  }
  if (pos !== bytes.length) return null;
  function spanHex(s) { return bytesToHex(bytes.slice(s[0], s[1])); }

  var form = root.items.length === 4 ? "conway" : "legacy";
  var isValid = null, auxNode, auxSpan;
  if (root.items[1].t !== "map") return null; /* the witness set is a map */
  if (form === "conway") {
    if (root.items[2].t !== "bool") return null;
    isValid = root.items[2].v;
    auxNode = root.items[3]; auxSpan = spans[3];
  } else {
    auxNode = root.items[2]; auxSpan = spans[2];
  }

  var body = inspectTx(spanHex(spans[0]));
  if (body === null) return null;
  var wset = parseWitnessSetCbor(spanHex(spans[1]));
  if (wset === null) return null;
  var aux = null;
  if (auxNode.t !== "null") {
    aux = parseAuxDataCbor(spanHex(auxSpan));
    if (aux === null) return null;
  }

  var auxHashCheck;
  if (body.auxDataHash !== null && aux !== null)
    auxHashCheck = body.auxDataHash === aux.hash ? "match" : "mismatch";
  else if (body.auxDataHash !== null) auxHashCheck = "missing";
  else if (aux !== null) auxHashCheck = "undeclared";
  else auxHashCheck = "none";

  var witnessed = {};
  wset.vkeyWitnesses.forEach(function (w) { witnessed[w.keyHash] = true; });
  wset.bootstrapWitnesses.forEach(function (w) { witnessed[w.keyHash] = true; });
  var signerChecks = body.requiredSigners.map(function (h) {
    return { hash: h, witnessed: witnessed[h] === true };
  });

  var datumHashes = {};
  wset.plutusData.forEach(function (d) { datumHashes[d.hash] = true; });
  var datumChecks = [];
  body.outputs.forEach(function (o, idx) {
    if (o.datum.kind === "hash")
      datumChecks.push({ output: idx, hash: o.datum.hash, supplied: datumHashes[o.datum.hash] === true });
  });

  var policySet = {};
  body.mint.forEach(function (a) { policySet[a.policy] = true; });
  var limits = { spend: body.inputs.length, mint: Object.keys(policySet).length,
                 cert: body.certificates, reward: body.withdrawals.length,
                 voting: body.votingProcedures, proposing: body.proposals };
  var redeemerChecks = [];
  if (wset.redeemers !== null) {
    wset.redeemers.entries.forEach(function (r) {
      redeemerChecks.push({ tag: r.tagName, index: r.index, limit: limits[r.tagName],
                            ok: r.index < limits[r.tagName] });
    });
  }

  return { form: form, isValid: isValid, txId: body.txId,
           totalBytes: bytes.length, bodyBytes: body.bodyBytes,
           body: body, witnesses: wset,
           auxPresent: aux !== null, aux: aux, auxHashCheck: auxHashCheck,
           signerChecks: signerChecks, datumChecks: datumChecks,
           redeemerChecks: redeemerChecks };
}

/* Token metadata viewer — CIP-25 (label 721) and CIP-27
   (label 777) interpreted out of transaction metadata, pasted
   either as the bare metadata map or as a whole auxiliary data
   block in any of its three serialisations (the auxiliary data
   decoder above shows the same bytes uninterpreted). The
   metadata must satisfy the ledger's metadatum grammar — maps,
   lists, integers, and byte/text strings of at most 64 bytes
   each, no repeated map key anywhere — because that is the only
   metadata that can exist on chain. Interpretation then follows
   the two CIPs: under 721, a policy map (version 1: the policy
   ID as a 56-character hex TEXT key and asset names as text;
   version 2: both as raw bytes, the version named at the 721
   level as an integer or a "1.0"-style text) whose assets carry
   name and image (both REQUIRED), optional mediaType and
   description, and an optional files list whose entries require
   mediaType and src by the CIP; every string property may be a
   single text string or an array of text chunks, joined here.
   Under 777, a royalty: a rate given as a decimal string in
   [0, 1] and the address it is paid to. STRUCTURAL violations
   (a non-map where a map belongs, a policy key that is not a
   policy ID, a rate that is not a decimal fraction, a string
   property of the wrong type) refuse the whole input; MISSING
   required properties are reported as warnings on the asset
   instead, because real mints omit them and a viewer that
   refuses real metadata helps nobody — the warnings are the
   honest part. The percentage is computed from the rate string
   with exact decimal arithmetic, never a float. */
function parseMetadataView(raw) {
  var bytes = cleanHex(raw, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var root = parsed.node;

  var form = null, metaNode = null;
  if (root.t === "map") { form = "metadata"; metaNode = root; }
  else if (root.t === "array" && root.items.length === 2 &&
           root.items[0].t === "map" && root.items[1].t === "array") {
    form = "shelley"; metaNode = root.items[0];
  } else if (root.t === "tag" && root.n === 259n && root.item.t === "map") {
    form = "tag259";
    for (var ti = 0; ti < root.item.pairs.length; ti++) {
      var tk = root.item.pairs[ti][0];
      if (tk.t !== "int" || tk.v < 0n || tk.v > 4n) return null;
      if (tk.v === 0n) metaNode = root.item.pairs[ti][1];
    }
  } else return null;
  if (metaNode === null) {
    return { form: form, hasMetadata: false, labels: [], nft: null, royalties: null };
  }
  if (metaNode.t !== "map") return null;

  function metaOk(n) {
    if (n.t === "int") return true;
    if (n.t === "text") return new TextEncoder().encode(n.v).length <= 64;
    if (n.t === "bytes") return n.bytes.length <= 64;
    if (n.t === "tag" && (n.n === 2n || n.n === 3n) && n.item.t === "bytes") {
      return n.item.bytes.length <= 64; /* bignum metadatum */
    }
    if (n.t === "array") {
      for (var i = 0; i < n.items.length; i++) if (!metaOk(n.items[i])) return false;
      return true;
    }
    if (n.t === "map") {
      var seen = {};
      for (var j = 0; j < n.pairs.length; j++) {
        var k = n.pairs[j][0];
        if (k.t !== "int" && k.t !== "text" && k.t !== "bytes") return false;
        var kr = cborRender(k);
        if (seen[kr] !== undefined) return false; /* one value per key */
        seen[kr] = true;
        if (!metaOk(k) || !metaOk(n.pairs[j][1])) return false;
      }
      return true;
    }
    return false; /* bool / null / simple / float / other tags */
  }
  if (!metaOk(metaNode)) return null;

  var labels = [], byLabel = {};
  for (var li = 0; li < metaNode.pairs.length; li++) {
    var lk = metaNode.pairs[li][0];
    if (lk.t !== "int" || lk.v < 0n) return null;
    var ls = lk.v.toString();
    labels.push(ls);
    byLabel[ls] = metaNode.pairs[li][1];
  }

  function metaString(n) {
    if (n.t === "text") return n.v;
    if (n.t === "array") {
      var parts = [];
      for (var i = 0; i < n.items.length; i++) {
        if (n.items[i].t !== "text") return null;
        parts.push(n.items[i].v);
      }
      return parts.join("");
    }
    return null;
  }
  function utf8Len(s) { return new TextEncoder().encode(s).length; }
  function noScheme(s) { return !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(s); }

  var nft = null;
  if (byLabel["721"] !== undefined) {
    var n721 = byLabel["721"];
    if (n721.t !== "map") return null;
    var version = 1, policyPairs = [];
    for (var vi = 0; vi < n721.pairs.length; vi++) {
      var vk = n721.pairs[vi][0], vv = n721.pairs[vi][1];
      if (vk.t === "text" && vk.v === "version") {
        if (vv.t === "int" && (vv.v === 1n || vv.v === 2n)) version = Number(vv.v);
        else if (vv.t === "text" && /^([12])(\.0+)?$/.test(vv.v)) version = Number(vv.v.charAt(0));
        else return null;
      } else policyPairs.push(n721.pairs[vi]);
    }
    var policies = [];
    for (var pi = 0; pi < policyPairs.length; pi++) {
      var pk = policyPairs[pi][0], pv = policyPairs[pi][1], policyId;
      if (version === 2) {
        if (pk.t !== "bytes" || pk.bytes.length !== 28) return null;
        policyId = bytesToHex(pk.bytes);
      } else {
        if (pk.t !== "text" || !/^[0-9a-fA-F]{56}$/.test(pk.v)) return null;
        policyId = pk.v.toLowerCase();
      }
      if (pv.t !== "map") return null;
      var assets = [];
      for (var ai = 0; ai < pv.pairs.length; ai++) {
        var ak = pv.pairs[ai][0], av = pv.pairs[ai][1];
        var asset = { keyText: null, keyHex: null, name: null, image: null,
                      mediaType: null, description: null, files: [], others: [],
                      warnings: [] };
        if (version === 2) {
          if (ak.t !== "bytes" || ak.bytes.length > 32) return null;
          asset.keyHex = bytesToHex(ak.bytes);
          try {
            var dec = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(ak.bytes));
            if (/^[\x20-\x7e]*$/.test(dec)) asset.keyText = dec;
          } catch (e) { /* raw byte name: hex only */ }
        } else {
          if (ak.t !== "text") return null;
          asset.keyText = ak.v;
          asset.keyHex = bytesToHex(Array.prototype.slice.call(new TextEncoder().encode(ak.v)));
          if (utf8Len(ak.v) > 32) {
            asset.warnings.push("asset name is " + utf8Len(ak.v) + " bytes — longer than the 32-byte asset-name limit, so no minted asset can carry it");
          }
        }
        if (av.t !== "map") return null;
        for (var qi = 0; qi < av.pairs.length; qi++) {
          var qk = av.pairs[qi][0], qv = av.pairs[qi][1];
          if (qk.t !== "text") return null;
          var key = qk.v;
          if (key === "name" || key === "image" || key === "mediaType" || key === "description") {
            var sv = metaString(qv);
            if (sv === null) return null;
            asset[key] = sv;
          } else if (key === "files") {
            if (qv.t !== "array") return null;
            for (var fi = 0; fi < qv.items.length; fi++) {
              var fn = qv.items[fi];
              if (fn.t !== "map") return null;
              var file = { name: null, mediaType: null, src: null, others: [], warnings: [] };
              for (var fj = 0; fj < fn.pairs.length; fj++) {
                var fk = fn.pairs[fj][0], fv = fn.pairs[fj][1];
                if (fk.t !== "text") return null;
                if (fk.v === "name" || fk.v === "mediaType" || fk.v === "src") {
                  var fsv = metaString(fv);
                  if (fsv === null) return null;
                  file[fk.v] = fsv;
                } else file.others.push({ key: fk.v, rendered: cborRender(fv) });
              }
              if (file.mediaType === null) file.warnings.push("file entry without a mediaType — CIP-25 requires one inside files");
              if (file.src === null) file.warnings.push("file entry without a src");
              else if (noScheme(file.src)) file.warnings.push("file src has no URI scheme — CIP-25 requires a full URI (ipfs://…, https://…, ar://… or a data: URL)");
              asset.files.push(file);
            }
          } else asset.others.push({ key: key, rendered: cborRender(qv) });
        }
        if (asset.name === null) asset.warnings.push("no \"name\" — CIP-25 requires one");
        if (asset.image === null) asset.warnings.push("no \"image\" — CIP-25 requires one");
        else if (noScheme(asset.image)) asset.warnings.push("image has no URI scheme — CIP-25 requires a full URI (ipfs://…, https://…, ar://… or a data: URL); a bare content ID does not resolve in viewers");
        assets.push(asset);
      }
      policies.push({ policyId: policyId, assets: assets });
    }
    nft = { version: version, policies: policies };
  }

  var royalties = null;
  if (byLabel["777"] !== undefined) {
    var n777 = byLabel["777"];
    if (n777.t !== "map") return null;
    royalties = { rate: null, ratePercent: null, addr: null, others: [], warnings: [] };
    for (var ri = 0; ri < n777.pairs.length; ri++) {
      var rk = n777.pairs[ri][0], rv = n777.pairs[ri][1];
      if (rk.t !== "text") return null;
      if (rk.v === "rate") {
        var rs = metaString(rv);
        if (rs === null || !/^(0(\.\d+)?|1(\.0+)?)$/.test(rs)) return null;
        royalties.rate = rs;
        var rm = /^([01])(?:\.(\d+))?$/.exec(rs);
        var frac = rm[2] || "";
        var scaled = BigInt(rm[1] + frac) * 100n, denom = 10n ** BigInt(frac.length);
        var whole = scaled / denom, rem = scaled % denom;
        royalties.ratePercent = rem === 0n ? whole.toString() :
          whole.toString() + "." + rem.toString().padStart(frac.length, "0").replace(/0+$/, "");
      } else if (rk.v === "addr") {
        if (rv.t === "bytes") {
          royalties.addr = bytesToHex(rv.bytes);
          royalties.warnings.push("royalty address given as raw bytes, shown as hex — CIP-27 names a bech32 address string");
        } else {
          var as = metaString(rv);
          if (as === null) return null;
          royalties.addr = as;
          if (!/^(addr|addr_test|stake|stake_test)1/.test(as)) {
            royalties.warnings.push("royalty address is not a bech32 address string (addr1… / addr_test1… / stake1…)");
          }
        }
      } else royalties.others.push({ key: rk.v, rendered: cborRender(rv) });
    }
    if (royalties.rate === null) royalties.warnings.push("no \"rate\" — CIP-27 requires one");
    if (royalties.addr === null) royalties.warnings.push("no \"addr\" — CIP-27 requires one");
  }

  return { form: form, hasMetadata: true, labels: labels, nft: nft, royalties: royalties };
}

/* CIP-68 datum metadata viewer (candidate) — CIP-0068's datum form:
   Constr 0 [metadata, version, extra] where the metadata in the
   222 / 333 / 444 standards is a property map with byte-string keys
   (or, at version 4, the nested "721" map), plus CIP-0067 asset
   name labels: a 4-byte prefix [0000 | 16-bit label | CRC-8
   checksum | 0000] on the asset name. Provenance: the CIP-0067 /
   CIP-0068 texts (prefix test vectors, datum CDDL, class table),
   pycardano serialisations and one real mainnet datum (an ADA
   Handle reference NFT's inline datum, via Koios) in scratch. */
var CIP68_CLASSES = { "100": "reference NFT", "222": "NFT user token", "333": "FT user token", "444": "RFT user token" };
function cip68Crc8(labelBytes) {
  var crc = 0;
  for (var i = 0; i < labelBytes.length; i++) {
    crc ^= labelBytes[i];
    for (var j = 0; j < 8; j++) crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}
function cip68Utf8(bytes) {
  if (typeof TextDecoder === "undefined") return null;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); }
  catch (e) { return null; }
}
function cip67PrefixHex(label) {
  var crc = cip68Crc8([(label >> 8) & 0xff, label & 0xff]);
  var v = ((label << 12) | (crc << 4)) >>> 0;
  return bytesToHex([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
}
function cip67LabelFromBytes(nameBytes) {
  if (!nameBytes || nameBytes.length < 4) return null;
  var v = ((nameBytes[0] << 24) | (nameBytes[1] << 16) | (nameBytes[2] << 8) | nameBytes[3]) >>> 0;
  if ((v >>> 28) !== 0 || (v & 0xf) !== 0) return null; /* the 0000 brackets */
  var label = (v >>> 12) & 0xffff;
  var crc = (v >>> 4) & 0xff;
  var content = Array.prototype.slice.call(nameBytes, 4);
  return { label: label, checksumOk: cip68Crc8([(label >> 8) & 0xff, label & 0xff]) === crc,
           contentHex: bytesToHex(content), contentText: cip68Utf8(content) };
}
function cip67Label(raw) {
  var s = (raw || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^([0-9a-f]{2})+$/.test(s) || s.length > 64) return null;
  return cip67LabelFromBytes(hexToBytes(s));
}
function cip68Value(node) {
  if (node.t === "bytes") {
    var t = cip68Utf8(node.bytes);
    return t !== null ? { text: t, rendered: null } : { text: null, rendered: "h'" + bytesToHex(node.bytes) + "'" };
  }
  if (node.t === "int") return { text: node.v.toString(), rendered: null };
  if (node.t === "array" && node.items.length > 0 && node.items.every(function (x) { return x.t === "bytes"; })) {
    var all = [];
    node.items.forEach(function (x) { all = all.concat(Array.prototype.slice.call(x.bytes)); });
    var jt = cip68Utf8(all);
    if (jt !== null) return { text: jt, rendered: null };
  }
  return { text: null, rendered: cborRender(node) };
}
function cip68Props(mapNode) {
  var props = [], files = [], warnings = [], seen = {};
  for (var i = 0; i < mapNode.pairs.length; i++) {
    var k = mapNode.pairs[i][0], val = mapNode.pairs[i][1];
    if (k.t !== "bytes") return null; /* CIP-68 property keys are byte strings */
    var kh = bytesToHex(k.bytes);
    if (seen[kh] !== undefined) return null; /* a map: one value per key */
    seen[kh] = 1;
    var keyText = cip68Utf8(k.bytes);
    if (keyText === "files" && val.t === "array") {
      for (var f = 0; f < val.items.length; f++) {
        var fn = val.items[f];
        if (fn.t !== "map") { warnings.push("a files entry is not a map — shown uninterpreted in the raw decode"); continue; }
        var file = { name: null, mediaType: null, src: null, others: [], warnings: [] }, fseen = {};
        for (var g = 0; g < fn.pairs.length; g++) {
          var fk = fn.pairs[g][0], fv = fn.pairs[g][1];
          if (fk.t !== "bytes") return null;
          var fkh = bytesToHex(fk.bytes);
          if (fseen[fkh] !== undefined) return null;
          fseen[fkh] = 1;
          var fkt = cip68Utf8(fk.bytes), fvv = cip68Value(fv);
          if (fkt === "name") file.name = fvv.text !== null ? fvv.text : fvv.rendered;
          else if (fkt === "mediaType") file.mediaType = fvv.text !== null ? fvv.text : fvv.rendered;
          else if (fkt === "src") file.src = fvv.text !== null ? fvv.text : fvv.rendered;
          else file.others.push({ key: fkt !== null ? fkt : "0x" + fkh, text: fvv.text, rendered: fvv.rendered });
        }
        if (file.mediaType === null) file.warnings.push('file has no "mediaType"');
        if (file.src === null) file.warnings.push('file has no "src"');
        files.push(file);
      }
      continue;
    }
    var v = cip68Value(val);
    props.push({ key: keyText, keyHex: kh, text: v.text, rendered: v.rendered });
    if (keyText === "decimals" && val.t !== "int") warnings.push('"decimals" is not an integer');
  }
  var has = function (name) { return props.some(function (p) { return p.key === name; }); };
  if (!has("name")) warnings.push('no "name" property');
  if (!has("image") && !has("logo")) warnings.push('no "image" (or "logo") property');
  return { props: props, files: files, warnings: warnings };
}
function parseCip68(rawDatum, rawName) {
  /* Plutus data grammar gate — a self-contained copy of the
     witness decoder's proven gate (bounded bytes ≤ 64, bignums,
     Constr tags 121–127 / 1280–1400, tag 102), so this tool does
     not drift from the hub's one definition of valid data. */
  function validData(n, depth) {
    if (depth > 100) return false;
    if (n.t === "int") return true;
    if (n.t === "bytes") return n.bytes.length <= 64;
    if (n.t === "array") {
      for (var i = 0; i < n.items.length; i++) if (!validData(n.items[i], depth + 1)) return false;
      return true;
    }
    if (n.t === "map") {
      for (var j = 0; j < n.pairs.length; j++)
        if (!validData(n.pairs[j][0], depth + 1) || !validData(n.pairs[j][1], depth + 1)) return false;
      return true;
    }
    if (n.t === "tag") {
      if ((n.n === 2n || n.n === 3n) && n.item.t === "bytes") return n.item.bytes.length <= 64;
      if (n.n === 102n) {
        if (n.item.t !== "array" || n.item.items.length !== 2) return false;
        if (n.item.items[0].t !== "int" || n.item.items[0].v < 0n) return false;
        if (n.item.items[1].t !== "array") return false;
        for (var k = 0; k < n.item.items[1].items.length; k++)
          if (!validData(n.item.items[1].items[k], depth + 1)) return false;
        return true;
      }
      if ((n.n >= 121n && n.n <= 127n) || (n.n >= 1280n && n.n <= 1400n)) {
        if (n.item.t !== "array") return false;
        for (var m = 0; m < n.item.items.length; m++)
          if (!validData(n.item.items[m], depth + 1)) return false;
        return true;
      }
      return false;
    }
    return false;
  }
  var asset = null;
  if (rawName !== undefined && rawName !== null && String(rawName).trim() !== "") {
    var ns = String(rawName).trim().toLowerCase().replace(/^0x/, "");
    if (!/^([0-9a-f]{2})+$/.test(ns) || ns.length > 64) return null;
    var nb = hexToBytes(ns), lab = cip67LabelFromBytes(nb);
    asset = { nameHex: ns, nameText: cip68Utf8(nb), label: null, checksumOk: null, klass: null, contentHex: null, contentText: null, refNameHex: null };
    if (lab !== null) {
      asset.label = lab.label; asset.checksumOk = lab.checksumOk;
      asset.klass = CIP68_CLASSES[String(lab.label)] || null;
      asset.contentHex = lab.contentHex; asset.contentText = lab.contentText;
      asset.refNameHex = cip67PrefixHex(100) + lab.contentHex;
    }
  }
  var bytes = cleanHex(rawDatum, MAX_TX_SIZE);
  if (bytes === null) return null;
  var parsed = cborParseItem(bytes, 0, 0);
  if (!parsed || parsed.next !== bytes.length) return null;
  var node = parsed.node;
  if (!validData(node, 0)) return null;
  var fields = null;
  if (node.t === "tag" && node.n === 121n && node.item.t === "array") fields = node.item.items;
  else if (node.t === "tag" && node.n === 102n && node.item.t === "array" && node.item.items.length === 2 &&
           node.item.items[0].t === "int" && node.item.items[0].v === 0n && node.item.items[1].t === "array") fields = node.item.items[1].items;
  if (fields === null || fields.length !== 3) return null; /* datum = Constr 0 [metadata, version, extra] */
  var metaNode = fields[0], verNode = fields[1], extraNode = fields[2];
  if (verNode.t !== "int" || verNode.v < 0n) return null;
  var out = { version: verNode.v.toString(), form: "generic", props: [], files: [], warnings: [],
              nested: [], genericRendered: null, extraRendered: cborRender(extraNode),
              extraIsUnit: false, asset: asset };
  if (verNode.v > 4n) out.warnings.push("datum version " + out.version + " is newer than CIP-68 version 4 — the metadata is shown as written");
  out.extraIsUnit = (extraNode.t === "tag" && extraNode.n === 121n && extraNode.item.t === "array" && extraNode.item.items.length === 0) ||
    (extraNode.t === "tag" && extraNode.n === 102n && extraNode.item.t === "array" && extraNode.item.items.length === 2 &&
     extraNode.item.items[0].t === "int" && extraNode.item.items[0].v === 0n && extraNode.item.items[1].t === "array" && extraNode.item.items[1].items.length === 0);
  if (metaNode.t !== "map") { out.genericRendered = cborRender(metaNode); return out; }
  /* nested "721" form (version 4): the map's only key is the bytes "721" */
  if (metaNode.pairs.length === 1 && metaNode.pairs[0][0].t === "bytes" &&
      bytesToHex(metaNode.pairs[0][0].bytes) === "373231" && metaNode.pairs[0][1].t === "map") {
    out.form = "nested";
    var polMap = metaNode.pairs[0][1], pseen = {};
    for (var i = 0; i < polMap.pairs.length; i++) {
      var pk = polMap.pairs[i][0], pv = polMap.pairs[i][1];
      if (pk.t !== "bytes" || pv.t !== "map") return null;
      var ph = bytesToHex(pk.bytes);
      if (pseen[ph] !== undefined) return null;
      pseen[ph] = 1;
      var aseen = {};
      for (var j = 0; j < pv.pairs.length; j++) {
        var ak = pv.pairs[j][0], av = pv.pairs[j][1];
        if (ak.t !== "bytes" || av.t !== "map") return null;
        var ah = bytesToHex(ak.bytes);
        if (aseen[ah] !== undefined) return null;
        aseen[ah] = 1;
        var sub = cip68Props(av);
        if (sub === null) return null;
        out.nested.push({ policyHex: ph, policyBytes: pk.bytes.length, assetHex: ah,
                          assetText: cip68Utf8(ak.bytes), props: sub.props, files: sub.files, warnings: sub.warnings });
      }
    }
    return out;
  }
  var direct = cip68Props(metaNode);
  if (direct === null) return null;
  out.form = "direct"; out.props = direct.props; out.files = direct.files; out.warnings = out.warnings.concat(direct.warnings);
  return out;
}

if (typeof module !== "undefined" && module.exports) {

/* Script data hash calculator — the blake2b-256 a transaction
   BODY commits to at key 11 whenever the transaction runs Plutus
   scripts: blake2b-256(redeemers ‖ datums ‖ language_views) over
   the parts as SERIALISED (the txId lesson — bytes as
   transmitted, never re-serialised). The full transaction
   decoder above deliberately does not recompute it: the
   languages a transaction runs are not all visible inside it
   (a reference script lives in somebody else's output), so this
   tool takes the two witness parts and the language selection
   from the user and does exactly the ledger's computation.
   - Redeemers (witness key 5) are pasted as their own CBOR, in
     EITHER serialisation (the legacy array or the Conway map —
     they hash differently, which is the point of taking bytes
     as transmitted), and are validated by the proven witness
     decoder before being hashed; when the field is present it
     is non-empty, so an explicitly empty redeemers encoding is
     refused. No redeemers pasted at all contributes the empty
     map a0 — pycardano's default, asserted in the generator.
   - Datums (witness key 4) are pasted as their own CBOR (a set
     of plutus_data), validated the same way — and contribute
     ZERO bytes when absent, not an empty set: the asymmetry is
     the ledger's own (pycardano script_data_hash: datum_bytes
     is b"" when there are no datums, while redeemer_bytes is
     the serialised empty map).
   - Language views: one entry per language the transaction
     runs, built from the CURRENT protocol cost models (live
     mainnet parameters, Koios epoch_params epoch 660, protocol
     version 11: Plutus V1 332 values, V2 332, V3 350 — V3
     carries four negative values, so integers are encoded as
     signed CBOR, never as unsigned magnitudes). Plutus V2 and
     V3 enter as uint key → definite array. Plutus V1 enters
     under the ledger's preserved historical encoding (the
     "language view" bug, cardano-ledger#2512): the KEY is the
     byte string holding the CBOR of uint 0, and the VALUE is a
     byte string holding the INDEFINITE-length array of the
     parameters. When there are no redeemers the views are the
     empty map whatever languages are ticked — a transaction
     that executes nothing has no language views (pycardano
     forces cost_models={} in that case; asserted). Redeemers
     with NO language ticked are refused: that hash belongs to
     no real transaction.
   Proven in scratch (sdh_py.py / sdh_vectors.json): synthetic
   redeemers + datums against pycardano 0.19.2's
   script_data_hash driven by the live cost models for V2 and
   V3 (both array- and map-form redeemers), the fully-empty and
   datums-only defaults against pycardano's own defaults, and —
   the chain proof — the redeemer bytes of a REAL mainnet
   Plutus transaction (the Minswap transaction the inspector
   tests carry, fetched via Koios) with Plutus V2 ticked
   reproduce its body key 11 exactly. ONE ORACLE CAVEAT,
   recorded plainly: pycardano's BUNDLED Plutus V1 cost model
   is a stale 166-value snapshot (its serialised V1 view is
   475 bytes against 900 for the live model), so the V1 values
   here are the live parameters from the same Koios channel
   that proved V2 on chain, and only the V1 ENCODING FORM is
   taken from the oracle's code. Re-verify the three models
   against Koios epoch_params whenever the protocol version
   moves. Display only; nothing is signed or sent. */
  var SDH_CM_V1 = [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1,
    11183, 32, 201305, 8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 16000, 100, 16000, 100, 100, 100, 16000, 100, 94375, 32, 132994,
    32, 61462, 4, 72010, 178, 0, 1, 22151, 32, 91189, 769, 4,
    2, 85848, 228465, 122, 0, 1, 1, 1000, 42921, 4, 2, 30623,
    28755, 75, 1, 898148, 27279, 1, 51775, 558, 1, 39184, 1000, 60594,
    1, 141895, 32, 83150, 32, 15299, 32, 76049, 1, 13169, 4, 22100,
    10, 28999, 74, 1, 28999, 74, 1, 43285, 552, 1, 44749, 541,
    1, 33852, 32, 68246, 32, 72362, 32, 7243, 32, 7391, 32, 11546,
    32, 85848, 228465, 122, 0, 1, 1, 90434, 519, 0, 1, 74433,
    32, 85848, 228465, 122, 0, 1, 1, 85848, 228465, 122, 0, 1,
    1, 270652, 22588, 4, 1457325, 64566, 4, 20467, 1, 4, 0, 141992,
    32, 100788, 420, 1, 1, 81663, 32, 59498, 32, 20142, 32, 24588,
    32, 20744, 32, 25933, 32, 24623, 32, 53384111, 14333, 10, 955506, 213312,
    0, 2, 43053543, 10, 43574283, 26308, 10, 16000, 100, 16000, 100, 962335,
    18, 2780678, 6, 442008, 1, 52538055, 3756, 18, 267929, 18, 76433006, 8868,
    18, 52948122, 18, 1995836, 36, 3227919, 12, 901022, 1, 166917843, 4307, 36,
    284546, 36, 158221314, 26549, 36, 74698472, 36, 333849714, 1, 254006273, 72, 2174038,
    72, 2261318, 64571, 4, 207616, 8310, 4, 1293828, 28716, 63, 0, 1,
    1006041, 43623, 251, 0, 1, 100181, 726, 719, 0, 1, 100181, 726,
    719, 0, 1, 100181, 726, 719, 0, 1, 107878, 680, 0, 1,
    95336, 1, 281145, 18848, 0, 1, 180194, 159, 1, 1, 158519, 8942,
    0, 1, 159378, 8813, 0, 1, 107490, 3298, 1, 106057, 655, 1,
    1964219, 24520, 3, 607153, 231697, 53144, 0, 1, 116711, 1957, 4, 231883,
    10, 1000, 24838, 7, 1, 232010, 32, 321837444, 25087669, 18, 617887431, 67302824,
    36, 356924, 18413, 45, 21, 219951, 9444, 1, 1000, 172116, 183150, 6,
    24, 21, 213283, 618401, 1998, 28258, 1, 1000, 38159, 2, 22, 1000,
    95933, 1, 1, 11, 1000, 277577, 12, 21
  ];
  var SDH_CM_V2 = [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1,
    11183, 32, 201305, 8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 16000, 100, 16000, 100, 100, 100, 16000, 100, 94375, 32, 132994,
    32, 61462, 4, 72010, 178, 0, 1, 22151, 32, 91189, 769, 4,
    2, 85848, 228465, 122, 0, 1, 1, 1000, 42921, 4, 2, 30623,
    28755, 75, 1, 898148, 27279, 1, 51775, 558, 1, 39184, 1000, 60594,
    1, 141895, 32, 83150, 32, 15299, 32, 76049, 1, 13169, 4, 22100,
    10, 28999, 74, 1, 28999, 74, 1, 43285, 552, 1, 44749, 541,
    1, 33852, 32, 68246, 32, 72362, 32, 7243, 32, 7391, 32, 11546,
    32, 85848, 228465, 122, 0, 1, 1, 90434, 519, 0, 1, 74433,
    32, 85848, 228465, 122, 0, 1, 1, 85848, 228465, 122, 0, 1,
    1, 955506, 213312, 0, 2, 270652, 22588, 4, 1457325, 64566, 4, 20467,
    1, 4, 0, 141992, 32, 100788, 420, 1, 1, 81663, 32, 59498,
    32, 20142, 32, 24588, 32, 20744, 32, 25933, 32, 24623, 32, 43053543,
    10, 53384111, 14333, 10, 43574283, 26308, 10, 1293828, 28716, 63, 0, 1,
    1006041, 43623, 251, 0, 1, 16000, 100, 16000, 100, 962335, 18, 2780678,
    6, 442008, 1, 52538055, 3756, 18, 267929, 18, 76433006, 8868, 18, 52948122,
    18, 1995836, 36, 3227919, 12, 901022, 1, 166917843, 4307, 36, 284546, 36,
    158221314, 26549, 36, 74698472, 36, 333849714, 1, 254006273, 72, 2174038, 72, 2261318,
    64571, 4, 207616, 8310, 4, 100181, 726, 719, 0, 1, 100181, 726,
    719, 0, 1, 100181, 726, 719, 0, 1, 107878, 680, 0, 1,
    95336, 1, 281145, 18848, 0, 1, 180194, 159, 1, 1, 158519, 8942,
    0, 1, 159378, 8813, 0, 1, 107490, 3298, 1, 106057, 655, 1,
    1964219, 24520, 3, 607153, 231697, 53144, 0, 1, 116711, 1957, 4, 231883,
    10, 1000, 24838, 7, 1, 232010, 32, 321837444, 25087669, 18, 617887431, 67302824,
    36, 356924, 18413, 45, 21, 219951, 9444, 1, 1000, 172116, 183150, 6,
    24, 21, 213283, 618401, 1998, 28258, 1, 1000, 38159, 2, 22, 1000,
    95933, 1, 1, 11, 1000, 277577, 12, 21
  ];
  var SDH_CM_V3 = [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1,
    11183, 32, 201305, 8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 16000, 100, 16000, 100, 100, 100, 16000, 100, 94375, 32, 132994,
    32, 61462, 4, 72010, 178, 0, 1, 22151, 32, 91189, 769, 4,
    2, 85848, 123203, 7305, -900, 1716, 960, 57, 85848, 0, 1, 1,
    1000, 42921, 4, 2, 30623, 28755, 75, 1, 898148, 27279, 1, 51775,
    558, 1, 39184, 1000, 60594, 1, 141895, 32, 83150, 32, 15299, 32,
    76049, 1, 13169, 4, 22100, 10, 28999, 74, 1, 28999, 74, 1,
    43285, 552, 1, 44749, 541, 1, 33852, 32, 68246, 32, 72362, 32,
    7243, 32, 7391, 32, 11546, 32, 85848, 123203, 7305, -900, 1716, 960,
    57, 85848, 0, 1, 90434, 519, 0, 1, 74433, 32, 85848, 123203,
    7305, -900, 1716, 960, 57, 85848, 0, 1, 1, 85848, 123203, 7305,
    -900, 1716, 960, 57, 85848, 0, 1, 955506, 213312, 0, 2, 270652,
    22588, 4, 1457325, 64566, 4, 20467, 1, 4, 0, 141992, 32, 100788,
    420, 1, 1, 81663, 32, 59498, 32, 20142, 32, 24588, 32, 20744,
    32, 25933, 32, 24623, 32, 43053543, 10, 53384111, 14333, 10, 43574283, 26308,
    10, 16000, 100, 16000, 100, 962335, 18, 2780678, 6, 442008, 1, 52538055,
    3756, 18, 267929, 18, 76433006, 8868, 18, 52948122, 18, 1995836, 36, 3227919,
    12, 901022, 1, 166917843, 4307, 36, 284546, 36, 158221314, 26549, 36, 74698472,
    36, 333849714, 1, 254006273, 72, 2174038, 72, 2261318, 64571, 4, 207616, 8310,
    4, 1293828, 28716, 63, 0, 1, 1006041, 43623, 251, 0, 1, 100181,
    726, 719, 0, 1, 100181, 726, 719, 0, 1, 100181, 726, 719,
    0, 1, 107878, 680, 0, 1, 95336, 1, 281145, 18848, 0, 1,
    180194, 159, 1, 1, 158519, 8942, 0, 1, 159378, 8813, 0, 1,
    107490, 3298, 1, 106057, 655, 1, 1964219, 24520, 3, 607153, 231697, 53144,
    0, 1, 116711, 1957, 4, 231883, 10, 1000, 24838, 7, 1, 232010,
    32, 321837444, 25087669, 18, 617887431, 67302824, 36, 356924, 18413, 45, 21, 219951,
    9444, 1, 1000, 172116, 183150, 6, 24, 21, 213283, 618401, 1998, 28258,
    1, 1000, 38159, 2, 22, 1000, 95933, 1, 1, 11, 1000, 277577,
    12, 21
  ];
var SDH_COST_MODELS = [SDH_CM_V1, SDH_CM_V2, SDH_CM_V3];
function sdhEncInt(v) { /* cost model values are int64; CBOR signed integer, shortest form */
  return v >= 0 ? cborHead(0, BigInt(v)) : cborHead(1, BigInt(-1 - v));
}
function scriptDataHash(redRaw, datRaw, langs) {
  if (!Array.isArray(langs)) return null;
  var langSet = {}, chosen = [], li;
  for (li = 0; li < langs.length; li++) {
    if (langs[li] !== 0 && langs[li] !== 1 && langs[li] !== 2) return null;
    if (langSet[langs[li]] === undefined) { langSet[langs[li]] = true; chosen.push(langs[li]); }
  }
  chosen.sort(function (a, b) { return a - b; });

  var redInfo = null, redBytes = null;
  var redHex = (redRaw || "").trim();
  if (redHex !== "") {
    redBytes = cleanHex(redHex, MAX_TX_SIZE);
    if (redBytes === null) return null;
    /* validated by the proven witness decoder, via a synthetic
       one-key witness set — its gates are this field's gates */
    var w = parseWitnessSetCbor("a105" + bytesToHex(redBytes));
    if (w === null || w.redeemers === null) return null;
    redInfo = { count: w.redeemers.entries.length, form: w.redeemers.form };
  }
  var datBytes = [], datCount = 0;
  var datHex = (datRaw || "").trim();
  if (datHex !== "") {
    datBytes = cleanHex(datHex, MAX_TX_SIZE);
    if (datBytes === null) return null;
    var w2 = parseWitnessSetCbor("a104" + bytesToHex(datBytes));
    if (w2 === null) return null;
    datCount = w2.plutusData.length;
  }
  var views;
  if (redInfo !== null) {
    if (chosen.length === 0) return null; /* redeemers but no language: a hash no real transaction carries */
    var entries = [];
    chosen.forEach(function (l) {
      var params = SDH_COST_MODELS[l], body = [], pi;
      for (pi = 0; pi < params.length; pi++) body = body.concat(sdhEncInt(params[pi]));
      if (l === 0) {
        var inner = [0x9f].concat(body, [0xff]);
        entries = entries.concat([0x41, 0x00], cborHead(2, BigInt(inner.length)), inner);
      } else {
        entries = entries.concat(cborHead(0, BigInt(l)), cborHead(4, BigInt(params.length)), body);
      }
    });
    views = cborHead(5, BigInt(chosen.length)).concat(entries);
  } else {
    views = [0xa0];
    redBytes = [0xa0];
  }
  var digest = blake2b(redBytes.concat(datBytes, views), 32);
  if (digest === null) return null;
  return { hash: bytesToHex(digest), redeemers: redInfo, datumCount: datCount,
           languages: redInfo !== null ? chosen : [],
           viewsIgnored: redInfo === null && chosen.length > 0,
           partBytes: { redeemers: redBytes.length, datums: datBytes.length, views: views.length } };
}

  module.exports = { verifyBech32, inspectAddress, adaToLovelace, lovelaceToAda, bech32Encode, slotToEpoch, epochStart, nowSlotEpoch, stakingEstimate, poolRewardSplit, minFee, exunitCost, refScriptFee, totalTxFee, depositTotal, minUtxo, poolIdFromHex, poolIdToHex, blake2b160, blake2b, assetFingerprint, assetUnit, assetNameText, parseAssetUnit, datumHash, scriptHash, keyHash, buildAddress, decodeAddress, addressToHex, addressFromHex, govCredBech32, govCredLegacyBech32, govActionBech32, parseGovId, decodeCbor, encodePlutusData, nativeScript, txId, inspectTx, parseValueCbor, parseTxOutCbor, parseOutputsCbor, parseMintCbor, parseWithdrawalsCbor, parseInputsCbor, parseSignersCbor, parseRefInputsCbor, parseCollateralCbor, parseCertificatesCbor, parseVotingCbor, parseProposalsCbor, parseAuxDataCbor, parseWitnessSetCbor, parseRedeemersCbor, parseDatumsCbor, parseVkeyWitnessesCbor, parseNativeScriptsCbor, parseBootstrapWitnessesCbor, decodeFullTx, scriptDataHash, bech32DecodeBytes, convertBits, hexToBytes, parseMetadataView, parseCip68, cip67Label, cip67PrefixHex };
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

    /* --- transaction inspector (Conway body decode) --- */
    document.getElementById("txinspect").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = inspectTx(document.getElementById("txinspect-input").value);
      var out = document.getElementById("txinspect-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of a transaction body or a whole transaction (at most 16,384 bytes) whose body fully decodes: inputs, outputs and fee are required, and every output, withdrawal, mint entry and reference must be well-formed. A datum, a script or any other CBOR item is not a transaction.";
        return;
      }
      var lines = [];
      lines.push("Transaction ID: " + res.txId + (res.source === "transaction" ? " (body taken from the full transaction, " + res.bodyBytes + " bytes)" : " (" + res.bodyBytes + "-byte body)"));
      lines.push("");
      lines.push("Inputs (" + res.inputs.length + ") — spent by this transaction:");
      res.inputs.forEach(function (inp, i) { lines.push("  " + (i + 1) + ". " + inp.txHash + "#" + inp.index); });
      lines.push("");
      lines.push("Outputs (" + res.outputs.length + "):");
      res.outputs.forEach(function (o, i) {
        lines.push("  " + (i + 1) + ". " + (o.address === null ? "address bytes " + o.addressHex + " (not a Shelley address — Byron-era or malformed)" : o.address));
        lines.push("     " + o.lovelace + " lovelace (" + lovelaceToAda(o.lovelace) + " ADA)");
        o.assets.forEach(function (a) {
          lines.push("     + " + a.quantity + " × policy " + a.policy + ", name " + (a.name === "" ? "(empty)" : a.name) + (a.nameText === null ? "" : " (\"" + a.nameText + "\")") + " — fingerprint " + assetFingerprint(a.policy, a.name));
        });
        if (o.datum.kind === "hash") lines.push("     datum hash: " + o.datum.hash);
        if (o.datum.kind === "inline") lines.push("     inline datum (CBOR): " + o.datum.hex);
        if (o.scriptRef !== null) lines.push("     reference script: " + ({ native: "native script", plutus1: "Plutus V1 script", plutus2: "Plutus V2 script", plutus3: "Plutus V3 script" })[o.scriptRef]);
      });
      lines.push("Total output: " + res.outputTotal + " lovelace (" + lovelaceToAda(res.outputTotal) + " ADA)");
      lines.push("");
      lines.push("Declared fee: " + res.fee + " lovelace (" + lovelaceToAda(res.fee) + " ADA)");
      if (res.ttl !== null) lines.push("Valid until slot: " + res.ttl + " (time to live)");
      if (res.validityStart !== null) lines.push("Valid from slot: " + res.validityStart);
      if (res.withdrawals.length) {
        lines.push("");
        lines.push("Reward withdrawals (" + res.withdrawals.length + "), total " + res.withdrawalTotal + " lovelace:");
        res.withdrawals.forEach(function (w) { lines.push("  " + w.address + " — " + w.lovelace + " lovelace"); });
      }
      if (res.mint.length) {
        lines.push("");
        lines.push("Mint (positive = minted, negative = burned):");
        res.mint.forEach(function (a) {
          lines.push("  " + a.quantity + " × policy " + a.policy + ", name " + (a.name === "" ? "(empty)" : a.name) + (a.nameText === null ? "" : " (\"" + a.nameText + "\")"));
        });
      }
      var gov = [];
      if (res.certificates) gov.push(res.certificates + " certificate(s)");
      if (res.votingProcedures) gov.push(res.votingProcedures + " voting procedure(s)");
      if (res.proposals) gov.push(res.proposals + " governance proposal(s)");
      if (gov.length) lines.push("Also in the body: " + gov.join(", ") + ".");
      if (res.collateral.length) {
        lines.push("");
        lines.push("Collateral (" + res.collateral.length + "): " + res.collateral.map(function (c) { return c.txHash + "#" + c.index; }).join(", "));
        if (res.totalCollateral !== null) lines.push("Total collateral: " + res.totalCollateral + " lovelace");
        if (res.collateralReturn !== null) lines.push("Collateral return: " + (res.collateralReturn.address === null ? "address bytes " + res.collateralReturn.addressHex : res.collateralReturn.address) + " — " + res.collateralReturn.lovelace + " lovelace");
      }
      if (res.referenceInputs.length) lines.push("Reference inputs (" + res.referenceInputs.length + "): " + res.referenceInputs.map(function (c) { return c.txHash + "#" + c.index; }).join(", "));
      if (res.requiredSigners.length) lines.push("Required signers (key hashes): " + res.requiredSigners.join(", "));
      if (res.scriptDataHash !== null) lines.push("Script data hash: " + res.scriptDataHash);
      if (res.auxDataHash !== null) lines.push("Auxiliary data hash: " + res.auxDataHash);
      if (res.networkId !== null) lines.push("Network ID: " + res.networkId + (res.networkId === 1 ? " (mainnet)" : " (testnet)"));
      if (res.treasuryValue !== null) lines.push("Current treasury value: " + res.treasuryValue + " lovelace");
      if (res.donation !== null) lines.push("Treasury donation: " + res.donation + " lovelace");
      lines.push("");
      lines.push("A body names its inputs by reference — their amounts are not in the body, so no balance or fee-sufficiency check is possible from the body alone. The fee above is the fee the body declares.");
      out.textContent = lines.join("\n");
    });

    /* --- value decoder (a standalone output value's CBOR) --- */
    document.getElementById("valuedecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseValueCbor(document.getElementById("valuedecode-input").value);
      var out = document.getElementById("valuedecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one output value: a bare coin amount, or [coin, {policy: {name: quantity}}]. Policies are 28 bytes, names at most 32 bytes, quantities positive (a mint's negative quantities are a different field), and no policy or asset name may repeat. A whole output or transaction is not a value — the transaction inspector above decodes those.";
        return;
      }
      var lines = [];
      lines.push(res.lovelace + " lovelace (" + lovelaceToAda(res.lovelace) + " ADA)");
      if (res.assetCount) {
        lines.push("");
        lines.push("Native assets (" + res.assetCount + " across " + res.policyCount + (res.policyCount === 1 ? " policy" : " policies") + "):");
        res.assets.forEach(function (a) {
          lines.push("  " + a.quantity + " × policy " + a.policy + ", name " + (a.name === "" ? "(empty)" : a.name) + (a.nameText === null ? "" : " (\"" + a.nameText + "\")") + " — fingerprint " + assetFingerprint(a.policy, a.name));
        });
      }
      out.textContent = lines.join("\n");
    });

    /* --- transaction output decoder (a standalone output's CBOR) --- */
    document.getElementById("txoutdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseTxOutCbor(document.getElementById("txoutdecode-input").value);
      var out = document.getElementById("txoutdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one transaction output: the Babbage map form {0: address, 1: value, 2: datum option, 3: script reference} or the Alonzo array form [address, value] / [address, value, datum hash]. The address must be a Shelley payment address, output quantities are positive, and no map key may repeat. A value alone or a whole transaction is a different shape — the value decoder and transaction inspector above decode those.";
        return;
      }
      var lines = [];
      lines.push("Serialisation: " + (res.format === "babbage" ? "Babbage map form" : "Alonzo array form"));
      lines.push("Address: " + res.address);
      lines.push(res.lovelace + " lovelace (" + lovelaceToAda(res.lovelace) + " ADA)");
      res.assets.forEach(function (a) {
        lines.push("  + " + a.quantity + " \u00d7 policy " + a.policy + ", name " + (a.name === "" ? "(empty)" : a.name) + (a.nameText === null ? "" : " (\"" + a.nameText + "\")") + " — fingerprint " + assetFingerprint(a.policy, a.name));
      });
      if (res.datum.kind === "hash") lines.push("Datum hash: " + res.datum.hash);
      if (res.datum.kind === "inline") lines.push("Inline datum (CBOR): " + res.datum.hex);
      if (res.scriptRef !== null) lines.push("Reference script: " + ({ native: "native script", plutus1: "Plutus V1 script", plutus2: "Plutus V2 script", plutus3: "Plutus V3 script" })[res.scriptRef]);
      out.textContent = lines.join("\n");
    });

    /* --- transaction outputs decoder (a standalone outputs field's CBOR) --- */
    document.getElementById("outputsdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseOutputsCbor(document.getElementById("outputsdecode-input").value);
      var out = document.getElementById("outputsdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one outputs field (body key 1): an array of transaction outputs, each in the Babbage map form or the Alonzo array form, each address a Shelley payment address with positive quantities and no repeated key inside any output. A single output alone is the output decoder's shape above; a whole body is the transaction inspector's.";
        return;
      }
      var lines = [];
      if (res.count === 0) {
        lines.push("Outputs field — empty: the array carries no outputs. The grammar ([* transaction_output]) admits the empty list and no ledger rule requires outputs the way the inputs rule does — but value conservation leaves it no room in a real transaction, whose inputs' value would have to equal the fee exactly.");
        out.textContent = lines.join("\n");
        return;
      }
      lines.push("Outputs — " + res.count + (res.count === 1 ? " output" : " outputs") + " totalling " + res.totalLovelace + " lovelace (" + lovelaceToAda(res.totalLovelace) + " ADA), in the order encoded:");
      res.outputs.forEach(function (o, i) {
        lines.push("");
        lines.push("  #" + i + " (" + (o.format === "babbage" ? "Babbage map form" : "Alonzo array form") + "): " + o.address);
        lines.push("      " + o.lovelace + " lovelace (" + lovelaceToAda(o.lovelace) + " ADA)");
        o.assets.forEach(function (a) {
          lines.push("      + " + a.quantity + " \u00d7 policy " + a.policy + ", name " + (a.name === "" ? "(empty)" : a.name) + (a.nameText === null ? "" : " (\"" + a.nameText + "\")") + " — fingerprint " + assetFingerprint(a.policy, a.name));
        });
        if (o.datum.kind === "hash") lines.push("      Datum hash: " + o.datum.hash);
        if (o.datum.kind === "inline") lines.push("      Inline datum (CBOR): " + o.datum.hex);
        if (o.scriptRef !== null) lines.push("      Reference script: " + ({ native: "native script", plutus1: "Plutus V1 script", plutus2: "Plutus V2 script", plutus3: "Plutus V3 script" })[o.scriptRef]);
      });
      lines.push("");
      lines.push("An output's number is the index every later reference to it uses (transaction ID + #index). The same output twice is two UTxOs — the field is a list, not a set.");
      out.textContent = lines.join("\n");
    });

    /* --- mint / burn decoder (a standalone mint field's CBOR) --- */
    document.getElementById("mintdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseMintCbor(document.getElementById("mintdecode-input").value);
      var out = document.getElementById("mintdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one mint field: {policy: {name: quantity}} with at least one policy and one asset per policy, policies 28 bytes, names at most 32 bytes, and every quantity a non-zero int64 — positive mints, negative burns, zero is not a legal entry. An output value (positive quantities with a coin) or a whole transaction is a different shape — the value decoder and transaction inspector above decode those.";
        return;
      }
      var lines = [];
      lines.push((res.mintCount + res.burnCount) + (res.assetCount === 1 ? " asset" : " assets") + " across " + res.policyCount + (res.policyCount === 1 ? " policy" : " policies") + ": " + res.mintCount + " minting, " + res.burnCount + " burning");
      res.assets.forEach(function (a) {
        lines.push("  " + (a.action === "mint" ? "mint +" : "burn ") + a.quantity + " \u00d7 policy " + a.policy + ", name " + (a.name === "" ? "(empty)" : a.name) + (a.nameText === null ? "" : " (\"" + a.nameText + "\")") + " — fingerprint " + assetFingerprint(a.policy, a.name));
      });
      out.textContent = lines.join("\n");
    });


    /* --- withdrawals decoder (a standalone withdrawals field's CBOR) --- */
    document.getElementById("withdrawdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseWithdrawalsCbor(document.getElementById("withdrawdecode-input").value);
      var out = document.getElementById("withdrawdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one withdrawals field: {reward address bytes: amount} with at least one entry, every key a Shelley reward address (stake1… / stake_test1…) and every amount a whole number of lovelace. A payment address is not a reward account, and no account may appear twice. An output value, a mint field or a whole transaction is a different shape — the decoders and transaction inspector above decode those.";
        return;
      }
      var lines = [];
      lines.push((res.count === 1 ? "1 withdrawal" : res.count + " withdrawals") + ", total " + res.totalLovelace + " lovelace (" + lovelaceToAda(res.totalLovelace) + " ADA):");
      res.entries.forEach(function (e) {
        lines.push("  " + e.address + " (" + e.stakeKind + " credential, " + e.network + ") — " + e.lovelace + " lovelace (" + lovelaceToAda(e.lovelace) + " ADA)");
      });
      out.textContent = lines.join("\n");
    });

    /* --- transaction inputs decoder (a standalone inputs field's CBOR) --- */
    document.getElementById("inputsdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseInputsCbor(document.getElementById("inputsdecode-input").value);
      var out = document.getElementById("inputsdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one inputs field: a set of [transaction ID, index] pairs — a plain array or the tag-258 set form — with at least one entry, every transaction ID exactly 32 bytes, every index between 0 and 65,535, and no reference repeated. One input on its own, an output, a mint field or a whole transaction is a different shape — the decoders and transaction inspector above decode those.";
        return;
      }
      var lines = [];
      lines.push((res.count === 1 ? "1 input" : res.count + " inputs") + " (the UTxOs this transaction spends):");
      res.entries.forEach(function (e) {
        lines.push("  " + e.ref + "  (transaction " + e.txHash + ", output " + e.index + ")");
      });
      out.textContent = lines.join("\n");
    });

    /* --- required signers decoder (a standalone required-signers field's CBOR) --- */
    document.getElementById("signersdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseSignersCbor(document.getElementById("signersdecode-input").value);
      var out = document.getElementById("signersdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one required signers field: a non-empty set of key hashes — a plain array or the tag-258 set form — with every hash exactly 28 bytes and no hash repeated. A single hash on its own, an inputs field or a whole transaction is a different shape — the decoders and transaction inspector above decode those.";
        return;
      }
      var lines = [];
      lines.push((res.count === 1 ? "1 required signer" : res.count + " required signers") + " (key hashes this transaction declares must sign it):");
      res.entries.forEach(function (h) {
        lines.push("  " + h);
      });
      out.textContent = lines.join("\n");
    });

    /* --- reference inputs decoder (a standalone reference-inputs field's CBOR) --- */
    document.getElementById("refinputsdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseRefInputsCbor(document.getElementById("refinputsdecode-input").value);
      var out = document.getElementById("refinputsdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one reference inputs field: a non-empty set of [transaction ID, index] pairs — a plain array or the tag-258 set form — with every transaction ID exactly 32 bytes, every index between 0 and 65,535, and no reference repeated. One reference on its own, an inputs field (same shape, different field) or a whole transaction is a different shape — the decoders and transaction inspector above decode those.";
        return;
      }
      var lines = [];
      lines.push((res.count === 1 ? "1 reference input" : res.count + " reference inputs") + " (the UTxOs this transaction reads without spending):");
      res.entries.forEach(function (e) {
        lines.push("  " + e.ref + "  (transaction " + e.txHash + ", output " + e.index + ")");
      });
      out.textContent = lines.join("\n");
    });

    document.getElementById("collateraldecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseCollateralCbor(document.getElementById("collateraldecode-input").value);
      var out = document.getElementById("collateraldecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one collateral field: a non-empty set of at most 3 [transaction ID, index] pairs (the current max_collateral_inputs protocol parameter) — a plain array or the tag-258 set form — with every transaction ID exactly 32 bytes, every index between 0 and 65,535, and no reference repeated. One entry on its own, an inputs or reference-inputs field (same shape, different field) or a whole transaction is a different shape — the decoders and transaction inspector above decode those.";
        return;
      }
      var lines = [];
      lines.push((res.count === 1 ? "1 collateral input" : res.count + " collateral inputs") + " (the UTxOs this transaction puts at risk if its scripts fail):");
      res.entries.forEach(function (e) {
        lines.push("  " + e.ref + "  (transaction " + e.txHash + ", output " + e.index + ")");
      });
      out.textContent = lines.join("\n");
    });


    document.getElementById("certsdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseCertificatesCbor(document.getElementById("certsdecode-input").value);
      var out = document.getElementById("certsdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one certificates field: a non-empty ordered set of certificates — a plain array or the tag-258 set form — using only the seventeen Conway certificate types (0–4 and 7–18), with every credential and pool hash exactly 28 bytes, every coin a non-negative integer, and no certificate repeated. One certificate on its own, a whole transaction, or a genesis / MIR certificate (types 5 and 6, which do not exist in the Conway CDDL) is a different shape — the transaction inspector above reads whole transactions.";
        return;
      }
      var LABEL = { account_registration: "Account registration", account_unregistration: "Account unregistration", delegation_to_stake_pool: "Delegation to a stake pool", pool_registration: "Pool registration", pool_retirement: "Pool retirement", account_registration_deposit: "Account registration (with deposit)", account_unregistration_deposit: "Account unregistration (with deposit refund)", delegation_to_drep: "Delegation to a DRep", delegation_to_stake_pool_and_drep: "Delegation to a stake pool and a DRep", account_registration_delegation_to_stake_pool: "Account registration and delegation to a stake pool", account_registration_delegation_to_drep: "Account registration and delegation to a DRep", account_registration_delegation_to_stake_pool_and_drep: "Account registration and delegation to a stake pool and a DRep", committee_authorization: "Committee authorisation", committee_resignation: "Committee resignation", drep_registration: "DRep registration", drep_unregistration: "DRep unregistration", drep_update: "DRep update" };
      function credText(c) { return (c.kind === "key" ? "key hash " : "script hash ") + c.hash; }
      function drepText(d) {
        if (d.kind === "always_abstain") return "always abstain";
        if (d.kind === "always_no_confidence") return "always no confidence";
        return (d.kind === "key" ? "key hash " : "script hash ") + d.hash;
      }
      function anchorText(a) { return a === null ? "no anchor" : "anchor " + a.url + " (data hash " + a.dataHash + ")"; }
      function poolText(h) { var b = poolIdFromHex(h); return h + (b ? " (" + b + ")" : ""); }
      var lines = [];
      lines.push((res.count === 1 ? "1 certificate" : res.count + " certificates") + " (the stake, pool and governance actions this transaction carries):");
      res.certificates.forEach(function (c, i) {
        lines.push("  " + (i + 1) + ". " + LABEL[c.name] + " (type " + c.type + ")");
        if (c.credential) lines.push("      credential: " + credText(c.credential));
        if (c.coldCredential) lines.push("      cold credential: " + credText(c.coldCredential));
        if (c.hotCredential) lines.push("      hot credential: " + credText(c.hotCredential));
        if (c.pool) lines.push("      pool: " + poolText(c.pool));
        if (c.coin !== undefined) lines.push("      amount: " + c.coin + " lovelace (" + lovelaceToAda(c.coin) + " ADA) — a deposit when registering, a refund when unregistering");
        if (c.epoch !== undefined) lines.push("      retires at epoch: " + c.epoch);
        if (c.drep) lines.push("      DRep: " + drepText(c.drep));
        if (c.anchor !== undefined) lines.push("      " + anchorText(c.anchor));
        if (c.poolParams) {
          var p = c.poolParams;
          lines.push("      operator (pool): " + poolText(p.operator));
          lines.push("      VRF key hash: " + p.vrfKeyHash);
          lines.push("      pledge: " + p.pledge + " lovelace (" + lovelaceToAda(p.pledge) + " ADA)");
          lines.push("      cost: " + p.cost + " lovelace (" + lovelaceToAda(p.cost) + " ADA)");
          lines.push("      margin: " + p.margin.numerator + "/" + p.margin.denominator);
          lines.push("      reward account: " + p.rewardAccount.address + " (hex " + p.rewardAccount.hex + ")");
          lines.push("      owners: " + (p.owners.length ? p.owners.join(", ") : "none"));
          if (p.relays.length === 0) lines.push("      relays: none");
          p.relays.forEach(function (r) {
            if (r.kind === "single_host_addr") lines.push("      relay: single host address — port " + (r.port === null ? "none" : r.port) + ", IPv4 " + (r.ipv4 === null ? "none" : r.ipv4) + ", IPv6 " + (r.ipv6 === null ? "none" : r.ipv6));
            else if (r.kind === "single_host_name") lines.push("      relay: single host name — " + r.dnsName + (r.port === null ? "" : ", port " + r.port));
            else lines.push("      relay: multi host name (SRV) — " + r.dnsName);
          });
          lines.push("      metadata: " + (p.metadata === null ? "none" : p.metadata.url + " (hash " + p.metadata.hash + ")"));
        }
      });
      out.textContent = lines.join("\n");
    });

    /* --- voting procedures decoder (a standalone voting field's CBOR) --- */
    document.getElementById("votingdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseVotingCbor(document.getElementById("votingdecode-input").value);
      var out = document.getElementById("votingdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one voting procedures field: a non-empty map of voters — committee hot, DRep or stake pool credentials, key hash or script hash — each with a non-empty map of the governance actions they voted on (transaction ID + index 0–65,535), every procedure a vote (no, yes or abstain) with an anchor or none, and no voter or action repeated. An empty map, one voter on its own or a whole transaction is a different shape — the transaction inspector above reads whole transactions.";
        return;
      }
      var ROLE = { committee_hot: "Constitutional committee (hot credential)", drep: "DRep", staking_pool: "Stake pool" };
      var lines = [];
      lines.push(res.voteCount + (res.voteCount === 1 ? " vote" : " votes") + " from " + res.voterCount + (res.voterCount === 1 ? " voter" : " voters") + " (who voted on which governance actions, and how):");
      res.voters.forEach(function (e) {
        lines.push("  " + ROLE[e.voter.role] + " — " + (e.voter.kind === "key" ? "key hash " : "script hash ") + e.voter.hash);
        e.votes.forEach(function (x) {
          lines.push("      on action " + x.action.ref + " (transaction " + x.action.txHash + ", action " + x.action.index + "): " + x.procedure.vote.toUpperCase() +
            (x.procedure.anchor === null ? "" : " — anchor " + x.procedure.anchor.url + " (data hash " + x.procedure.anchor.dataHash + ")"));
        });
      });
      out.textContent = lines.join("\n");
    });

    /* --- governance proposals decoder (a standalone proposals field's CBOR) --- */
    document.getElementById("auxdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseAuxDataCbor(document.getElementById("auxdecode-input").value);
      var out = document.getElementById("auxdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one auxiliary data block: a bare metadata map (labels 0 to 2^64-1, values nested maps, lists, integers — bignum tags included — byte or text strings of at most 64 bytes each), the Shelley-era array of metadata and native scripts, or the Alonzo-era map under tag 259 (key 0 metadata, 1 native scripts, 2/3/4 Plutus V1/V2/V3 scripts). A whole transaction is a different shape — the transaction inspector above reads whole transactions and shows this block's hash.";
        return;
      }
      var formName = res.format === "metadata" ? "bare metadata map" : res.format === "shelley" ? "Shelley-era array (metadata + native scripts)" : "Alonzo-era map (CBOR tag 259)";
      var lines = [];
      lines.push("Auxiliary data — " + formName + ".");
      lines.push("Auxiliary data hash (the value a transaction body commits to at key 7): " + res.hash);
      if (res.metadata !== null) {
        if (res.metadata.length === 0) lines.push("Metadata: none (an empty metadata map).");
        else {
          lines.push("Metadata:");
          res.metadata.forEach(function (e) { lines.push("Label " + e.label + ": " + e.value); });
        }
      }
      res.nativeScripts.forEach(function (s) { lines.push("Native script: " + s.text + " — script hash " + s.hash); });
      res.plutusScripts.forEach(function (s) {
        var lang = s.language === "plutusv1" ? "Plutus V1" : s.language === "plutusv2" ? "Plutus V2" : "Plutus V3";
        lines.push(lang + " script (" + s.size + (s.size === 1 ? " byte" : " bytes") + ") — script hash " + s.hash);
      });
      if ((res.metadata === null || res.metadata.length === 0) && res.nativeScripts.length === 0 && res.plutusScripts.length === 0)
        lines.push("This auxiliary data block carries no metadata and no scripts.");
      out.textContent = lines.join("\n");
    });

    /* --- token metadata viewer (CIP-25 label 721, CIP-27 label 777) --- */
    document.getElementById("metaview").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseMetadataView(document.getElementById("metaview-input").value);
      var out = document.getElementById("metaview-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of transaction metadata — the bare metadata map, or a whole auxiliary data block in any of its three serialisations — carrying label 721 (CIP-25 token metadata) or label 777 (CIP-27 royalties). On chain every string is at most 64 bytes (longer values travel as arrays of chunks), map keys never repeat, and a royalty rate is a decimal fraction between 0 and 1. The auxiliary data decoder above shows the same bytes without interpreting them.";
        return;
      }
      var formName = res.form === "metadata" ? "bare metadata map" : res.form === "shelley" ? "Shelley-era auxiliary data (metadata + native scripts)" : "Alonzo-era auxiliary data (CBOR tag 259)";
      var lines = [];
      lines.push("Metadata — from a " + formName + ".");
      if (!res.hasMetadata) {
        lines.push("This auxiliary data carries no metadata at all.");
        out.textContent = lines.join("\n");
        return;
      }
      lines.push(res.labels.length ? "Labels present: " + res.labels.join(", ") + "." : "The metadata map is empty — no labels at all.");
      if (res.nft) {
        lines.push("");
        lines.push("CIP-25 token metadata (label 721, version " + res.nft.version + "):");
        res.nft.policies.forEach(function (p) {
          lines.push("Policy " + p.policyId + " — " + p.assets.length + (p.assets.length === 1 ? " asset:" : " assets:"));
          p.assets.forEach(function (a) {
            lines.push("  • Asset " + (a.keyText !== null ? JSON.stringify(a.keyText) : "with raw byte name") + " (asset name hex " + a.keyHex + ")");
            if (a.name !== null) lines.push("    Name: " + a.name);
            if (a.image !== null) lines.push("    Image: " + a.image);
            if (a.mediaType !== null) lines.push("    Media type: " + a.mediaType);
            if (a.description !== null) lines.push("    Description: " + a.description);
            a.files.forEach(function (f) {
              var parts = [];
              if (f.name !== null) parts.push("name " + f.name);
              if (f.mediaType !== null) parts.push("media type " + f.mediaType);
              if (f.src !== null) parts.push("src " + f.src);
              lines.push("    File: " + (parts.length ? parts.join(", ") : "(empty entry)"));
              f.others.forEach(function (o) { lines.push("      " + o.key + ": " + o.rendered); });
              f.warnings.forEach(function (w) { lines.push("      Warning: " + w + "."); });
            });
            a.others.forEach(function (o) { lines.push("    " + o.key + ": " + o.rendered); });
            a.warnings.forEach(function (w) { lines.push("    Warning: " + w + "."); });
          });
        });
        if (res.nft.policies.length === 0) lines.push("The 721 map names no policies — no token metadata to show.");
      }
      if (res.royalties) {
        lines.push("");
        lines.push("CIP-27 royalties (label 777):");
        if (res.royalties.rate !== null) lines.push("  • Rate: " + res.royalties.rate + " — " + res.royalties.ratePercent + "% of each sale price.");
        if (res.royalties.addr !== null) lines.push("  • Paid to: " + res.royalties.addr);
        res.royalties.others.forEach(function (o) { lines.push("  • " + o.key + ": " + o.rendered); });
        res.royalties.warnings.forEach(function (w) { lines.push("  • Warning: " + w + "."); });
      }
      if (!res.nft && !res.royalties && res.labels.length) {
        lines.push("No CIP-25 (label 721) or CIP-27 (label 777) content — the labels above are shown uninterpreted by the auxiliary data decoder above.");
      }
      out.textContent = lines.join("\n");
    });
    /* --- CIP-68 datum metadata viewer (+ CIP-67 asset name labels) --- */
    document.getElementById("cip68view").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseCip68(document.getElementById("cip68view-input").value, document.getElementById("cip68view-name").value);
      var out = document.getElementById("cip68view-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of a CIP-68 metadata datum — constructor 0 with exactly three fields: the metadata, the version integer and the extra data field (at least Unit) — optionally with the asset name hex of the reference NFT or user token (at most 32 bytes). The datum must be valid Plutus data (byte strings of at most 64 bytes); a property map's keys are byte strings and no key may repeat. Transaction metadata (CIP-25) is a different shape — the token metadata viewer above reads it.";
        return;
      }
      function propLines(props, files, warnings, indent) {
        var ls = [];
        props.forEach(function (p) { ls.push(indent + (p.key !== null ? p.key : "0x" + p.keyHex) + ": " + (p.text !== null ? p.text : p.rendered)); });
        files.forEach(function (f) {
          var parts = [];
          if (f.name !== null) parts.push("name " + f.name);
          if (f.mediaType !== null) parts.push("media type " + f.mediaType);
          if (f.src !== null) parts.push("src " + f.src);
          ls.push(indent + "File: " + (parts.length ? parts.join(", ") : "(empty entry)"));
          f.others.forEach(function (o) { ls.push(indent + "  " + o.key + ": " + (o.text !== null ? o.text : o.rendered)); });
          f.warnings.forEach(function (w) { ls.push(indent + "  Warning: " + w + "."); });
        });
        warnings.forEach(function (w) { ls.push(indent + "Warning: " + w + "."); });
        return ls;
      }
      var lines = [];
      if (res.asset) {
        if (res.asset.label === null) {
          lines.push("Asset name " + res.asset.nameHex + " carries no CIP-67 label — its first four bytes are not a bracketed label prefix.");
        } else {
          lines.push("Asset name: CIP-67 label " + res.asset.label + (res.asset.klass ? " — " + res.asset.klass : " — no registered class") + ", checksum " + (res.asset.checksumOk ? "valid" : "INVALID — the prefix does not match its label") + "; name content " + (res.asset.contentText !== null && res.asset.contentText !== "" ? JSON.stringify(res.asset.contentText) : "0x" + res.asset.contentHex) + ".");
          lines.push(res.asset.label === 100 ? "This is the reference NFT's own name." : "Its reference NFT is named " + res.asset.refNameHex + " under the same policy.");
        }
        lines.push("");
      }
      lines.push("CIP-68 datum — version " + res.version + "; extra field: " + (res.extraIsUnit ? "Unit (no extra data)." : "custom data, shown as Plutus data: " + res.extraRendered + "."));
      if (res.form === "direct") {
        lines.push("Metadata (direct property map):");
        lines = lines.concat(propLines(res.props, res.files, [], "  "));
      } else if (res.form === "nested") {
        lines.push("Metadata (nested map — the version-4 form, CIP-25-style organisation):");
        res.nested.forEach(function (e) {
          lines.push("  Policy " + e.policyHex + (e.policyBytes !== 28 ? " (warning: a policy ID is 28 bytes)" : "") + " — asset " + (e.assetText !== null ? JSON.stringify(e.assetText) : "0x" + e.assetHex) + " (asset name hex " + e.assetHex + "):");
          lines = lines.concat(propLines(e.props, e.files, e.warnings, "    "));
        });
        if (res.nested.length === 0) lines.push("  The nested map names no assets.");
      } else {
        lines.push("Metadata is not a property map — the generic CIP-68 form allows a list, an integer or a byte string here; shown as Plutus data: " + res.genericRendered);
      }
      res.warnings.forEach(function (w) { lines.push("Warning: " + w + "."); });
      out.textContent = lines.join("\n");
    });
    /* --- transaction witness set decoder (a standalone witness set's CBOR) --- */
    document.getElementById("witnessdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseWitnessSetCbor(document.getElementById("witnessdecode-input").value);
      var out = document.getElementById("witnessdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one transaction witness set: a map with optional keys 0 (key witnesses), 1 (native scripts), 2 (bootstrap witnesses), 3 (Plutus V1 scripts), 4 (Plutus data), 5 (redeemers, array or map form), 6 (Plutus V2 scripts) and 7 (Plutus V3 scripts) — every list or set non-empty, keys and signatures at their ledger sizes, redeemer tags 0–5 with 32-bit indices and ex-units within int64. A whole transaction is a different shape — the transaction inspector above reads whole transactions.";
        return;
      }
      var lines = [];
      var total = res.vkeyWitnesses.length + res.nativeScripts.length + res.bootstrapWitnesses.length + res.plutusScripts.length + res.plutusData.length + (res.redeemers ? res.redeemers.entries.length : 0);
      lines.push("Transaction witness set — " + total + (total === 1 ? " entry" : " entries") + " in total.");
      res.vkeyWitnesses.forEach(function (w, i) {
        lines.push("Key witness " + (i + 1) + ": key " + w.vkey);
        lines.push("  key hash " + w.keyHash + " — signature " + w.signature);
      });
      res.nativeScripts.forEach(function (s) { lines.push("Native script: " + s.text + " — script hash " + s.hash); });
      res.bootstrapWitnesses.forEach(function (bw, i) {
        lines.push("Bootstrap witness " + (i + 1) + " (Byron-era): public key " + bw.publicKey + " — key hash " + bw.keyHash);
        lines.push("  signature " + bw.signature);
        lines.push("  chain code " + bw.chainCode + " — attributes 0x" + bw.attributes);
      });
      res.plutusScripts.forEach(function (s) {
        var lang = s.language === "plutusv1" ? "Plutus V1" : s.language === "plutusv2" ? "Plutus V2" : "Plutus V3";
        lines.push(lang + " script (" + s.size + (s.size === 1 ? " byte" : " bytes") + ") — script hash " + s.hash);
      });
      res.plutusData.forEach(function (d, i) {
        lines.push("Plutus datum " + (i + 1) + ": " + d.data);
        lines.push("  datum hash " + d.hash);
      });
      if (res.redeemers) {
        lines.push("Redeemers (" + (res.redeemers.form === "map" ? "Conway map form" : "legacy array form") + "):");
        res.redeemers.entries.forEach(function (rd) {
          lines.push("  " + rd.tagName + " #" + rd.index + ": data " + rd.data + " (datum hash " + rd.dataHash + ") — ex-units mem " + rd.exUnits.mem + ", steps " + rd.exUnits.steps);
        });
      }
      if (total === 0) lines.push("This witness set is empty — it authorises nothing on its own; a transaction carrying it would need its witnesses supplied another way.");
      lines.push("Signatures are shown as carried, not verified — checking one needs the transaction body it signs.");
      out.textContent = lines.join("\n");
    });

    /* --- redeemers decoder (a standalone redeemers field's CBOR) --- */
    document.getElementById("redeemersdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseRedeemersCbor(document.getElementById("redeemersdecode-input").value);
      var out = document.getElementById("redeemersdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one redeemers field (witness set key 5): the legacy array of [tag, index, data, ex-units] entries, or the Conway map from [tag, index] to [data, ex-units] — non-empty either way, tags 0–5, indices within 32 bits, data a real Plutus datum and ex-units within int64. A whole witness set is a different shape — the witness set decoder above reads those.";
        return;
      }
      var lines = [];
      lines.push("Redeemers (" + (res.form === "map" ? "Conway map form" : "legacy array form") + ") — " + res.count + (res.count === 1 ? " redeemer" : " redeemers") + ":");
      res.entries.forEach(function (rd) {
        lines.push("  " + rd.tagName + " #" + rd.index + ": data " + rd.data + " (datum hash " + rd.dataHash + ") — ex-units mem " + rd.exUnits.mem + ", steps " + rd.exUnits.steps);
      });
      lines.push("Each index addresses the transaction's canonically ordered inputs, mint policies, certificates, withdrawals, voters or proposals — whether it points at a real one needs the body too (the full transaction decoder checks that).");
      out.textContent = lines.join("\n");
    });

    /* --- Plutus data decoder (a standalone Plutus data field's CBOR) --- */
    document.getElementById("datumsdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseDatumsCbor(document.getElementById("datumsdecode-input").value);
      var out = document.getElementById("datumsdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one Plutus data field (witness set key 4): a non-empty set of Plutus data (tag 258 or a plain array), each entry a constructor, map, list, integer or byte string of at most 64 bytes. A whole witness set is a different shape — the witness set decoder above reads those; a single bare datum is not the field.";
        return;
      }
      var lines = [];
      lines.push("Plutus data — " + res.count + (res.count === 1 ? " datum" : " datums") + ", in the order encoded:");
      res.entries.forEach(function (d, i) {
        lines.push("  #" + i + ": " + d.data + " (datum hash " + d.hash + ")");
      });
      lines.push("Each datum hash is blake2b-256 over the datum's exact bytes — the hash an output carries when it references a datum instead of inlining it. Which output or redeemer consumes a datum needs the rest of the transaction (the full transaction decoder checks datum availability).");
      out.textContent = lines.join("\n");
    });

    /* --- key witnesses decoder (a standalone vkey witnesses field's CBOR) --- */
    document.getElementById("vkeywitnessdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseVkeyWitnessesCbor(document.getElementById("vkeywitnessdecode-input").value);
      var out = document.getElementById("vkeywitnessdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one key witnesses field (witness set key 0): a non-empty list of [vkey, signature] pairs (tag 258 or a plain array), each vkey exactly 32 bytes and each signature exactly 64. A whole witness set is a different shape — the witness set decoder above reads those; a single bare witness is not the field.";
        return;
      }
      var lines = [];
      lines.push("Key witnesses — " + res.count + (res.count === 1 ? " witness" : " witnesses") + ", in the order encoded:");
      res.entries.forEach(function (w, i) {
        lines.push("  #" + i + ": key " + w.vkey);
        lines.push("     key hash " + w.keyHash);
        lines.push("     signature " + w.signature);
      });
      lines.push("The key hash is blake2b-224 of the key — the hash a body's required signer list (key 14) names. Signatures are shown as carried, not verified — checking one needs the transaction body it signs (the full transaction decoder checks signer presence).");
      out.textContent = lines.join("\n");
    });

    /* --- native scripts decoder (a standalone native scripts field's CBOR) --- */
    document.getElementById("nativescriptsdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseNativeScriptsCbor(document.getElementById("nativescriptsdecode-input").value);
      var out = document.getElementById("nativescriptsdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one native scripts field (witness set key 1): a non-empty list of native scripts (tag 258 or a plain array), each a [0, key hash] signature script, a [1, […]] all, a [2, […]] any, a [3, n, […]] at-least-n, or a [4, slot] / [5, slot] timelock, nesting freely. A whole witness set is a different shape — the witness set decoder above reads those; a single bare script is not the field.";
        return;
      }
      var lines = [];
      lines.push("Native scripts — " + res.count + (res.count === 1 ? " script" : " scripts") + ", in the order encoded:");
      res.entries.forEach(function (s, i) {
        lines.push("  #" + i + ": " + s.text);
        lines.push("     script hash " + s.hash);
      });
      lines.push("Each script hash is blake2b-224 over the 0x00 language byte and the script's exact bytes — for a minting script, its policy ID. Whether a script is satisfied (signatures present, slot in range) needs the rest of the transaction; scripts are decoded here, not evaluated.");
      out.textContent = lines.join("\n");
    });

    /* --- bootstrap witnesses decoder (a standalone bootstrap witnesses field's CBOR) --- */
    document.getElementById("bootstrapdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseBootstrapWitnessesCbor(document.getElementById("bootstrapdecode-input").value);
      var out = document.getElementById("bootstrapdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one bootstrap witnesses field (witness set key 2): a non-empty list of [public key, signature, chain code, attributes] entries (tag 258 or a plain array), each public key exactly 32 bytes and each signature exactly 64; the chain code and attributes are byte strings of any length, including empty. A whole witness set is a different shape — the witness set decoder above reads those; a single bare witness is not the field.";
        return;
      }
      var lines = [];
      lines.push("Bootstrap witnesses — " + res.count + (res.count === 1 ? " witness" : " witnesses") + ", in the order encoded:");
      res.entries.forEach(function (w, i) {
        lines.push("  #" + i + ": public key " + w.publicKey);
        lines.push("     key hash " + w.keyHash);
        lines.push("     signature " + w.signature);
        lines.push("     chain code " + (w.chainCode === "" ? "(empty)" : w.chainCode));
        lines.push("     attributes " + (w.attributes === "" ? "(empty)" : w.attributes));
      });
      lines.push("The key hash is blake2b-224 of the public key — the hash a body's required signer list (key 14) names. The chain code and attributes are shown as carried: the ledger grammar gives them no size, and Byron's HD derivation data rides in them. Signatures are shown as carried, not verified — checking one needs the transaction body it signs (the full transaction decoder checks signer presence).");
      out.textContent = lines.join("\n");
    });

    /* --- full transaction decoder (a whole transaction's CBOR) --- */
    document.getElementById("fulltxdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = decodeFullTx(document.getElementById("fulltxdecode-input").value);
      var out = document.getElementById("fulltxdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one whole transaction: the Conway array [body, witness set, is-valid flag, auxiliary data or null], or the older three-element form without the flag. Every part must pass its own decoder's gates — a malformed body, witness set or auxiliary block refuses the whole transaction. A body alone is the transaction inspector's job; a witness set or auxiliary block alone has its own decoder above.";
        return;
      }
      var b = res.body, w = res.witnesses, lines = [];
      lines.push("Full transaction — " + (res.form === "conway" ? "Conway four-element form" : "legacy three-element form (no is-valid flag)") + ", " + res.totalBytes + " bytes in total, body " + res.bodyBytes + " bytes.");
      lines.push("Transaction ID: " + res.txId);
      if (res.isValid !== null) lines.push("Is-valid flag: " + (res.isValid ? "true — the transaction declares its scripts passed (phase-2 validation succeeded when it was built)" : "false — the transaction declares phase-2 validation FAILED; if it is accepted on chain it is recorded for its collateral only"));
      lines.push("");
      lines.push("Body: " + b.inputs.length + (b.inputs.length === 1 ? " input" : " inputs") + ", " + b.outputs.length + (b.outputs.length === 1 ? " output" : " outputs") + " totalling " + b.outputTotal + " lovelace (" + lovelaceToAda(b.outputTotal) + " ADA), declared fee " + b.fee + " lovelace (" + lovelaceToAda(b.fee) + " ADA).");
      var extras = [];
      if (b.mint.length) extras.push(b.mint.length + " mint entr" + (b.mint.length === 1 ? "y" : "ies"));
      if (b.withdrawals.length) extras.push(b.withdrawals.length + " withdrawal(s)");
      if (b.certificates) extras.push(b.certificates + " certificate(s)");
      if (b.collateral.length) extras.push(b.collateral.length + " collateral input(s)");
      if (b.referenceInputs.length) extras.push(b.referenceInputs.length + " reference input(s)");
      if (b.votingProcedures) extras.push(b.votingProcedures + " voter(s) with voting procedures");
      if (b.proposals) extras.push(b.proposals + " governance proposal(s)");
      if (extras.length) lines.push("Also in the body: " + extras.join(", ") + ". (Full body detail: the transaction inspector above.)");
      lines.push("");
      var wparts = [];
      if (w.vkeyWitnesses.length) wparts.push(w.vkeyWitnesses.length + " key witness(es)");
      if (w.nativeScripts.length) wparts.push(w.nativeScripts.length + " native script(s)");
      if (w.bootstrapWitnesses.length) wparts.push(w.bootstrapWitnesses.length + " bootstrap witness(es)");
      if (w.plutusScripts.length) wparts.push(w.plutusScripts.length + " Plutus script(s)");
      if (w.plutusData.length) wparts.push(w.plutusData.length + " Plutus datum item(s)");
      if (w.redeemers) wparts.push(w.redeemers.entries.length + " redeemer(s)");
      lines.push("Witness set: " + (wparts.length ? wparts.join(", ") + "." : "empty — nothing in it authorises the body."));
      lines.push("Auxiliary data: " + (res.auxPresent ? "present (" + res.aux.format + " form" + (res.aux.metadata && res.aux.metadata.length ? ", " + res.aux.metadata.length + " metadata label(s)" : "") + "), hash " + res.aux.hash + "." : "none attached."));
      lines.push("");
      lines.push("Consistency checks (body against witnesses and auxiliary data):");
      var auxLine = { match: "auxiliary data hash MATCHES the hash the body commits to at key 7",
                      mismatch: "auxiliary data hash DOES NOT MATCH the hash the body commits to at key 7 — this auxiliary data does not belong to this body",
                      missing: "the body commits to an auxiliary data hash at key 7 but NO auxiliary data is attached",
                      undeclared: "auxiliary data is attached but the body declares no hash for it at key 7",
                      none: "no auxiliary data and no auxiliary data hash — nothing to check" }[res.auxHashCheck];
      lines.push("  • " + auxLine + ".");
      if (res.signerChecks.length) {
        res.signerChecks.forEach(function (s) {
          lines.push("  • required signer " + s.hash + ": " + (s.witnessed ? "a key witness with this hash IS present" : "NO key witness with this hash is present (a native script in the set can also cover a required signer)") + ".");
        });
      } else lines.push("  • the body names no required signers.");
      if (res.datumChecks.length) {
        res.datumChecks.forEach(function (d) {
          lines.push("  • output " + (d.output + 1) + " datum hash " + d.hash + ": " + (d.supplied ? "the datum IS supplied in the witness set" : "the datum is NOT in the witness set — a script spending this output cannot run until it is supplied") + ".");
        });
      } else lines.push("  • no output carries a datum hash.");
      if (res.redeemerChecks.length) {
        res.redeemerChecks.forEach(function (r) {
          lines.push("  • redeemer " + r.tag + " #" + r.index + ": " + (r.ok ? "in range — the body has " + r.limit + " it can point at" : "OUT OF RANGE — the body has only " + r.limit + " for it to point at") + ".");
        });
      } else lines.push("  • no redeemers in the witness set.");
      lines.push("");
      lines.push("Signatures are NOT cryptographically verified by this tool. The script data hash is not recomputed here — the languages a transaction runs are not all visible inside it (reference scripts live in other outputs) — the script data hash calculator below recomputes it from the witness parts and the languages you name. The checks above are structural: the parts of the transaction agree with each other, or they do not.");
      out.textContent = lines.join("\n");
    });

    /* --- script data hash calculator (redeemers + datums + language views) --- */
    document.getElementById("sdhcalc").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var langs = [];
      if (document.getElementById("sdh-lang-v1").checked) langs.push(0);
      if (document.getElementById("sdh-lang-v2").checked) langs.push(1);
      if (document.getElementById("sdh-lang-v3").checked) langs.push(2);
      var res = scriptDataHash(document.getElementById("sdh-redeemers").value,
                               document.getElementById("sdh-datums").value, langs);
      var out = document.getElementById("sdhcalc-result");
      if (!res) {
        out.textContent = "Enter the redeemers CBOR from a witness set (key 5 — the legacy array or the Conway map, non-empty, tags 0–5 with 32-bit indices and ex-units within int64) and, if the witness set carries Plutus data, its CBOR too (key 4 — a non-empty set of Plutus data), and tick every Plutus language the transaction runs. Redeemers with no language ticked are refused — that hash belongs to no real transaction. Leave both boxes empty for the no-Plutus default.";
        return;
      }
      var names = ["Plutus V1", "Plutus V2", "Plutus V3"];
      var lines = [];
      lines.push("Script data hash: " + res.hash);
      lines.push("This is the value the transaction body must carry at key 11 (script_data_hash) for this combination of redeemers, datums and languages.");
      lines.push("");
      if (res.redeemers) {
        lines.push("Redeemers: " + res.redeemers.count + (res.redeemers.count === 1 ? " redeemer" : " redeemers") + " (" + (res.redeemers.form === "map" ? "Conway map form" : "legacy array form") + "), " + res.partBytes.redeemers + " bytes — hashed exactly as pasted.");
      } else {
        lines.push("Redeemers: none pasted — the empty map (a0, 1 byte) is hashed, as the ledger's own construction does.");
      }
      lines.push("Datums: " + (res.datumCount ? res.datumCount + (res.datumCount === 1 ? " datum" : " datums") + ", " + res.partBytes.datums + " bytes — hashed exactly as pasted." : "none pasted — datums contribute ZERO bytes to this hash (not an empty set: the asymmetry is the ledger's)."));
      if (res.redeemers) {
        lines.push("Language views: " + res.languages.map(function (l) { return names[l]; }).join(", ") + " — " + res.partBytes.views + " bytes, from the current mainnet cost models (epoch 660: V1 332, V2 332, V3 350 values). Plutus V1 enters under its preserved historical encoding: its key and its model are both wrapped as byte strings, the model as an indefinite-length array.");
      } else if (res.viewsIgnored) {
        lines.push("Language views: none — with no redeemers there is nothing to execute, so the ticked language(s) do not enter the hash; the views are the empty map.");
      } else {
        lines.push("Language views: the empty map — nothing executes, so no language views enter the hash.");
      }
      if (!res.redeemers && !res.datumCount) lines.push("With no redeemers and no datums this is the default no-Plutus value — a transaction that runs no Plutus scripts carries NO script data hash at key 11 at all.");
      out.textContent = lines.join("\\n");
    });

    document.getElementById("proposalsdecode").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var res = parseProposalsCbor(document.getElementById("proposalsdecode-input").value);
      var out = document.getElementById("proposalsdecode-result");
      if (!res) {
        out.textContent = "Enter the CBOR hex of one proposals field: a non-empty set (plain array or set tag 258) of proposals, each a deposit, a reward account for its return, one governance action and its anchor — an info action, a motion of no confidence, a hard fork initiation, a parameter change, treasury withdrawals, a committee update or a new constitution — with no proposal repeated. An empty set, one proposal on its own or a whole transaction is a different shape — the transaction inspector above reads whole transactions.";
        return;
      }
      function prevLine(pa) {
        return pa === null ? "no previous governance action" :
          "previous action " + pa.ref + " (transaction " + pa.txHash + ", action " + pa.index + ")";
      }
      function guardLine(g) {
        return g === null ? "no guardrails script" : "guardrails script hash " + g;
      }
      function updateLine(u) {
        if (u.value !== undefined) return u.name + " → " + u.value;
        if (u.models !== undefined) return u.name + " → " + u.models.map(function (m) {
          return "language " + m.language + ": " + m.costs.length + (m.costs.length === 1 ? " value" : " values");
        }).join("; ");
        if (u.memPrice !== undefined) return u.name + " → memory price " + u.memPrice.numerator + "/" + u.memPrice.denominator +
          ", step price " + u.stepPrice.numerator + "/" + u.stepPrice.denominator;
        if (u.mem !== undefined) return u.name + " → memory " + u.mem + ", steps " + u.steps;
        if (u.thresholds !== undefined) return u.name + " → " + u.thresholds.map(function (t) {
          return t.numerator + "/" + t.denominator;
        }).join(", ");
        return u.name + " → " + u.numerator + "/" + u.denominator;
      }
      var lines = [];
      lines.push(res.count + (res.count === 1 ? " governance proposal" : " governance proposals") + " (the actions this transaction proposes):");
      res.proposals.forEach(function (p, i) {
        var a = p.action;
        lines.push("Proposal " + (i + 1) + " — deposit " + p.deposit + " lovelace (" + lovelaceToAda(p.deposit) +
          " ADA), returned to reward account " + p.rewardAccount.address + " (" + p.rewardAccount.stakeKind + " credential, " + p.rewardAccount.network + ")");
        if (a.name === "info_action") {
          lines.push("  Action: info action — no direct effect on the chain");
        } else if (a.name === "no_confidence") {
          lines.push("  Action: motion of no confidence — " + prevLine(a.prevAction));
        } else if (a.name === "hard_fork_initiation") {
          lines.push("  Action: hard fork initiation — protocol version " + a.protocolVersion.major + "." + a.protocolVersion.minor + " — " + prevLine(a.prevAction));
        } else if (a.name === "parameter_change") {
          lines.push("  Action: parameter change — " + prevLine(a.prevAction) + ", " + guardLine(a.guardrailsScriptHash));
          if (a.updates.length === 0) lines.push("      (the update names no parameters)");
          a.updates.forEach(function (u) { lines.push("      " + updateLine(u)); });
        } else if (a.name === "treasury_withdrawals") {
          lines.push("  Action: treasury withdrawals totalling " + a.totalLovelace + " lovelace (" + lovelaceToAda(a.totalLovelace) + " ADA) — " + guardLine(a.guardrailsScriptHash));
          a.withdrawals.forEach(function (w) {
            lines.push("      " + w.lovelace + " lovelace (" + lovelaceToAda(w.lovelace) + " ADA) to " + w.rewardAccount.address);
          });
        } else if (a.name === "update_committee") {
          lines.push("  Action: update constitutional committee — " + prevLine(a.prevAction) +
            ", quorum " + a.quorum.numerator + "/" + a.quorum.denominator);
          a.removed.forEach(function (c) {
            lines.push("      remove cold credential (" + c.kind + " hash " + c.hash + ")");
          });
          a.added.forEach(function (e) {
            lines.push("      add cold credential (" + e.credential.kind + " hash " + e.credential.hash + "), term expiring at epoch " + e.epoch);
          });
        } else if (a.name === "new_constitution") {
          lines.push("  Action: new constitution — " + prevLine(a.prevAction) + ", " + guardLine(a.constitution.guardrailsScriptHash));
          lines.push("      constitution anchor " + a.constitution.anchor.url + " (data hash " + a.constitution.anchor.dataHash + ")");
        }
        lines.push("  Anchor: " + p.anchor.url + " (data hash " + p.anchor.dataHash + ")");
      });
      out.textContent = lines.join("\n");
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
