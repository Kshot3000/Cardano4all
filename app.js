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

var ADDRESS_BUILD_TYPES = { base: 0, enterprise: 6, reward: 14 };

function keyHashHex(raw) {
  var h = (raw || "").trim().toLowerCase();
  return /^[0-9a-f]{56}$/.test(h) ? h : null;
}

function buildAddress(kind, network, payHashRaw, stakeHashRaw) {
  if (!(kind in ADDRESS_BUILD_TYPES)) return null;
  if (network !== "mainnet" && network !== "testnet") return null;
  var header = (ADDRESS_BUILD_TYPES[kind] << 4) | (network === "mainnet" ? 1 : 0);
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
  module.exports = { verifyBech32, inspectAddress, adaToLovelace, lovelaceToAda, bech32Encode, slotToEpoch, epochStart, nowSlotEpoch, stakingEstimate, minFee, poolIdFromHex, poolIdToHex, blake2b160, blake2b, assetFingerprint, datumHash, scriptHash, keyHash, buildAddress, decodeAddress, addressToHex, addressFromHex, govCredBech32, govCredLegacyBech32, govActionBech32, parseGovId, bech32DecodeBytes, convertBits, hexToBytes };
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
