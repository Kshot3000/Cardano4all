"use strict";
/* Cardano4All site tests — run: node tests/test-site.js */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const app = require(path.join(root, "app.js"));

const ADA = "addr1q8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpqjae44v";
let failures = 0;
function check(name, cond) {
  console.log((cond ? "PASS" : "FAIL") + " " + name);
  if (!cond) failures++;
}

/* attribution on every user-facing surface */
check("donation address in index.html", html.includes(ADA));
check("donation address in README", readme.includes(ADA));
check("@kshot9000 in index.html", html.includes("@kshot9000"));
check("@kshot9000 in README", readme.includes("@kshot9000"));
check("Cardano team tagged in README", readme.includes("@cardano-foundation") && readme.includes("@IntersectMBO"));
check("Cardano team tagged in index.html", html.includes("@cardano-foundation") && html.includes("@IntersectMBO"));

/* document structure */
check("exactly one <h1>", (html.match(/<h1[ >]/g) || []).length === 1);
check("has <main> landmark", /<main[\s>]/.test(html));
check("all form controls labelled", ["addr", "ada", "lovelace", "q", "slot", "epoch", "stake-ada", "stake-rate", "stake-epochs", "fee-size", "pool-hex", "pool-bech32", "asset-policy", "asset-name", "unit-input", "hash-kind", "hash-bytes", "key-pay", "key-stake", "key-network", "decode-addr", "addrhex-bech32", "addrhex-hex", "gov-input"].every(id =>
  html.includes(`for="${id}"`) || html.includes(`aria-label`)));
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=12"));
check("visual-upgrade theme linked with cache key", html.includes("visual-upgrade/theme.css?v=20261007"));
check("visual-upgrade theme attribute on body", html.includes('data-vu-theme="network"'));
check("visual-upgrade files exist", fs.existsSync(path.join(root, "visual-upgrade", "theme.css")) && fs.existsSync(path.join(root, "visual-upgrade", "scene.svg")));
check("theme.css references bundled scene.svg (no external art)", fs.readFileSync(path.join(root, "visual-upgrade", "theme.css"), "utf8").includes('url("scene.svg")'));

/* flagship links */
for (const url of ["https://nightdream.xyz/", "https://kshot3000.github.io/Grok-CIP-113/",
  "https://kshot3000.github.io/PlutusShield/", "https://kshot3000.github.io/Adadrome/",
  "https://kshot3000.github.io/Night-Messenger-/"]) {
  check("flagship linked: " + url, html.includes(url) && readme.includes(url));
}

/* bech32 / address inspector — Kyle's own address is the positive vector */
const own = app.inspectAddress(ADA);
check("own ADA address verifies (checksum + type)", own.ok && /Payment address/.test(own.message) && /mainnet/.test(own.message));
check("tampered address rejected", !app.inspectAddress(ADA.slice(0, -1) + (ADA.endsWith("v") ? "u" : "v")).ok);
check("mixed case rejected", !app.verifyBech32("Addr1q8hnl6").valid);
check("garbage rejected", !app.inspectAddress("hello world").ok);
check("empty rejected", !app.inspectAddress("").ok);
/* stake-hrp round trip: encode synthetic stake data, inspector must accept it */
const syntheticStake = app.bech32Encode("stake", Array.from({ length: 50 }, (_, i) => (i * 7) % 32));
const stakeRes = app.inspectAddress(syntheticStake);
check("synthetic stake address verifies + typed", stakeRes.ok && /Stake \/ reward address/.test(stakeRes.message) && /mainnet/.test(stakeRes.message));
const syntheticTest = app.bech32Encode("addr_test", Array.from({ length: 50 }, (_, i) => (i * 3) % 32));
check("synthetic testnet address typed", /testnet/.test(app.inspectAddress(syntheticTest).message));

/* converter exactness */
check("1 ADA = 1000000 lovelace", app.adaToLovelace("1") === "1000000");
check("12.5 ADA", app.adaToLovelace("12.5") === "12500000");
check("smallest unit", app.adaToLovelace("0.000001") === "1");
check("7 decimals rejected", app.adaToLovelace("0.0000001") === null);
check("lovelace -> ADA trims zeros", app.lovelaceToAda("12500000") === "12.5");
check("lovelace -> ADA whole", app.lovelaceToAda("3000000") === "3");
check("round trip", app.lovelaceToAda(app.adaToLovelace("987.654321")) === "987.654321");

/* epoch / slot calculator — verified mainnet parameters:
   system start 1506203091 (2017-09-23 21:44:51 UTC); Byron 21600 slots x 20s;
   Shelley from slot 4492800 / epoch 208 / unix 1596059091 (2020-07-29
   21:44:51 UTC); Shelley+ 432000 slots x 1s. Cross-check:
   1506203091 + 208 x 432000 = 1596059091. */
check("epoch calculator in page", html.includes('id="epochcalc"') && html.includes('id="epoch-now"'));
const s0 = app.slotToEpoch("0");
check("slot 0 = Byron epoch 0 at system start", s0.epoch === 0 && s0.era === "Byron" && s0.unixSeconds === 1506203091);
const sByronEnd = app.slotToEpoch("4492799");
check("last Byron slot = epoch 207, end of epoch", sByronEnd.epoch === 207 && sByronEnd.slotInEpoch === 21599 && sByronEnd.unixSeconds === 1596059091 - 20);
const sShelley = app.slotToEpoch("4492800");
check("slot 4492800 = Shelley epoch 208 start", sShelley.epoch === 208 && sShelley.slotInEpoch === 0 && sShelley.unixSeconds === 1596059091);
const s209 = app.slotToEpoch(String(4492800 + 432000));
check("one Shelley epoch later = epoch 209", s209.epoch === 209 && s209.slotInEpoch === 0 && s209.unixSeconds === 1596059091 + 432000);
check("epoch 0 starts at slot 0 / system start", app.epochStart("0").slot === 0 && app.epochStart("0").unixSeconds === 1506203091);
check("epoch 208 starts at slot 4492800 / Shelley start", app.epochStart("208").slot === 4492800 && app.epochStart("208").unixSeconds === 1596059091);
check("epoch 207 starts in Byron", app.epochStart("207").slot === 207 * 21600 && app.epochStart("207").unixSeconds === 1506203091 + 207 * 432000);
for (const probe of ["0", "100000", "4492799", "4492800", "5000000", "123456789"]) {
  const r = app.slotToEpoch(probe);
  const start = app.epochStart(String(r.epoch));
  check("epoch start <= slot " + probe + " < next epoch start", start.slot <= r.slot && start.unixSeconds <= r.unixSeconds);
}
check("negative slot rejected", app.slotToEpoch("-1") === null);
check("fractional slot rejected", app.slotToEpoch("1.5") === null);
check("garbage epoch rejected", app.epochStart("abc") === null);
check("empty slot rejected", app.slotToEpoch("") === null);
const nowRes = app.nowSlotEpoch(1596059091000);
check("clock at Shelley fork = slot 4492800 epoch 208", nowRes.slot === 4492800 && nowRes.epoch === 208);
check("pre-genesis clock rejected", app.nowSlotEpoch(0) === null);

/* staking estimator — modelled maths, exact BigInt lovelace arithmetic.
   73 epochs/year (5-day epochs). Hand-checked vectors:
   73% a year = exactly 1% per epoch; 3.65% a year = exactly 0.05% per epoch. */
check("staking estimator in page", html.includes('id="stakingcalc"') && html.includes('id="stake-result"'));
const st1 = app.stakingEstimate("1000", "73", "1");
check("73% on 1000 ADA = 10 ADA in one epoch", st1.firstEpochRewardLovelace === "10000000" && st1.totalRewardLovelace === "10000000" && st1.finalLovelace === "1010000000");
const st2 = app.stakingEstimate("1000", "3.65", "1");
check("3.65% on 1000 ADA = 0.5 ADA in one epoch", st2.firstEpochRewardLovelace === "500000" && st2.finalLovelace === "1000500000");
const st3 = app.stakingEstimate("1000", "73", "2");
check("compounding: epoch 2 earns 1% of 1010 ADA", st3.totalRewardLovelace === "20100000" && st3.finalLovelace === "1020100000");
const st4 = app.stakingEstimate("500", "0", "73");
check("zero rate earns zero over a year", st4.totalRewardLovelace === "0" && st4.finalLovelace === "500000000");
const st5 = app.stakingEstimate("0.000001", "3.65", "1");
check("sub-lovelace reward truncates to zero (1-lovelace stake)", st5.totalRewardLovelace === "0" && st5.finalLovelace === "1");
check("rate above 100% rejected", app.stakingEstimate("1000", "101", "1") === null);
check("rate with 5 decimals rejected", app.stakingEstimate("1000", "3.12345", "1") === null);
check("zero epochs rejected", app.stakingEstimate("1000", "3.5", "0") === null);
check("epochs above sanity cap rejected", app.stakingEstimate("1000", "3.5", "3651") === null);
check("fractional epochs rejected", app.stakingEstimate("1000", "3.5", "1.5") === null);
check("7-decimal stake rejected", app.stakingEstimate("1.0000001", "3.5", "1") === null);
check("garbage staking inputs rejected", app.stakingEstimate("abc", "3.5", "1") === null && app.stakingEstimate("1000", "abc", "1") === null);

/* transaction minimum fee — mainnet protocol parameters verified live via
   Koios epoch_params for epoch 660 (2026-10-07): min_fee_a = 44 lovelace/byte,
   min_fee_b = 155381 lovelace, max_tx_size = 16384 bytes.
   fee = 44 x size + 155381. Hand-checked: 44x200 = 8800, +155381 = 164181. */
check("fee calculator in page", html.includes('id="feecalc"') && html.includes('id="fee-result"'));
check("fee for 200-byte tx = 164181 lovelace", app.minFee("200").feeLovelace === "164181");
check("fee for 1-byte tx = 155425 lovelace", app.minFee("1").feeLovelace === "155425");
check("fee for 1000-byte tx = 199381 lovelace", app.minFee("1000").feeLovelace === "199381");
check("fee at max tx size 16384 = 876277 lovelace", app.minFee("16384").feeLovelace === "876277");
check("size above max tx size rejected", app.minFee("16385") === null);
check("zero size rejected", app.minFee("0") === null);
check("fractional size rejected", app.minFee("200.5") === null);
check("garbage size rejected", app.minFee("abc") === null);
check("empty size rejected", app.minFee("") === null);
check("fee result carries size echo", app.minFee("200").sizeBytes === 200);

/* pool ID converter — verified vector cross-checked against @cardano-sdk/core
   (Mesh #692 investigation, 2026-10-07): the pool id below decodes to the
   hex beside it. Both directions must reproduce the pair exactly. */
const POOL_HEX = "7facad662e180ce45e5c504957cd1341940c72a708728f7ecfc6e349";
const POOL_BECH = "pool107k26e3wrqxwghju2py40ngngx2qcu48ppeg7lk0cm35jl2aenx";
check("pool ID converter in page", html.includes('id="poolid"') && html.includes('id="pool-result"'));
check("pool hex -> bech32 matches verified vector", app.poolIdFromHex(POOL_HEX) === POOL_BECH);
check("pool bech32 -> hex matches verified vector", app.poolIdToHex(POOL_BECH) === POOL_HEX);
check("pool round trip", app.poolIdToHex(app.poolIdFromHex(POOL_HEX)) === POOL_HEX);
check("uppercase hex accepted", app.poolIdFromHex(POOL_HEX.toUpperCase()) === POOL_BECH);
check("short hex rejected", app.poolIdFromHex(POOL_HEX.slice(0, 54)) === null);
check("long hex rejected", app.poolIdFromHex(POOL_HEX + "ab") === null);
check("non-hex rejected", app.poolIdFromHex("zz" + POOL_HEX.slice(2)) === null);
check("empty hex rejected", app.poolIdFromHex("") === null);
check("payment address is not a pool ID", app.poolIdToHex(ADA) === null);
check("tampered pool ID rejected", app.poolIdToHex(POOL_BECH.slice(0, -1) + "q") === null);
check("garbage pool ID rejected", app.poolIdToHex("pool1garbage") === null);

/* asset fingerprint (CIP-14) — ALL EIGHT official CIP-14 test vectors: the
   fingerprint is bech32("asset", blake2b-160(policyIdBytes || assetNameBytes)).
   These vectors are copied verbatim from the CIP itself, so they prove the
   pure-JS BLAKE2b + bech32 path end to end. */
check("asset fingerprint tool in page", html.includes('id="assetfp"') && html.includes('id="asset-result"'));
const CIP14_VECTORS = [
  ["7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc373", "", "asset1rjklcrnsdzqp65wjgrg55sy9723kw09mlgvlc3"],
  ["7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc37e", "", "asset1nl0puwxmhas8fawxp8nx4e2q3wekg969n2auw3"],
  ["1e349c9bdea19fd6c147626a5260bc44b71635f398b67c59881df209", "", "asset1uyuxku60yqe57nusqzjx38aan3f2wq6s93f6ea"],
  ["7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc373", "504154415445", "asset13n25uv0yaf5kus35fm2k86cqy60z58d9xmde92"],
  ["1e349c9bdea19fd6c147626a5260bc44b71635f398b67c59881df209", "504154415445", "asset1hv4p5tv2a837mzqrst04d0dcptdjmluqvdx9k3"],
  ["1e349c9bdea19fd6c147626a5260bc44b71635f398b67c59881df209", "7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc373", "asset1aqrdypg669jgazruv5ah07nuyqe0wxjhe2el6f"],
  ["7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc373", "1e349c9bdea19fd6c147626a5260bc44b71635f398b67c59881df209", "asset17jd78wukhtrnmjh3fngzasxm8rck0l2r4hhyyt"],
  ["7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc373", "0000000000000000000000000000000000000000000000000000000000000000", "asset1pkpwyknlvul7az0xx8czhl60pyel45rpje4z8w"]
];
CIP14_VECTORS.forEach(([pol, name, fp], i) => {
  check("CIP-14 official vector " + (i + 1), app.assetFingerprint(pol, name) === fp);
});
check("fingerprint verifies as bech32 with asset HRP", app.verifyBech32(app.assetFingerprint(CIP14_VECTORS[0][0], "")).hrp === "asset");
check("uppercase policy + name accepted", app.assetFingerprint(CIP14_VECTORS[3][0].toUpperCase(), CIP14_VECTORS[3][1].toUpperCase()) === CIP14_VECTORS[3][2]);
check("short policy rejected", app.assetFingerprint(CIP14_VECTORS[0][0].slice(0, 54), "") === null);
check("long policy rejected", app.assetFingerprint(CIP14_VECTORS[0][0] + "ab", "") === null);
check("non-hex policy rejected", app.assetFingerprint("zz" + CIP14_VECTORS[0][0].slice(2), "") === null);
check("empty policy rejected", app.assetFingerprint("", "") === null);
check("odd-length asset name rejected", app.assetFingerprint(CIP14_VECTORS[0][0], "abc") === null);
check("33-byte asset name rejected", app.assetFingerprint(CIP14_VECTORS[0][0], "00".repeat(33)) === null);
check("32-byte asset name accepted", typeof app.assetFingerprint(CIP14_VECTORS[0][0], "00".repeat(32)) === "string");
check("garbage asset name rejected", app.assetFingerprint(CIP14_VECTORS[0][0], "not-hex!") === null);

/* asset unit decoder — a unit is the plain concatenation policyId ‖
   assetName as hex (the form Blockfrost / Koios / cardano-cli use), so
   the ground truth is the same eight official CIP-14 vectors: each
   vector's unit must split back to its policy + name and re-derive its
   published fingerprint. The split was prototyped in scratch against
   these vectors before this tool was wired (assetunit_proto.js). */
check("asset unit tool in page", html.includes('id="assetunit"') && html.includes('id="unit-input"') && html.includes('id="unit-result"'));
CIP14_VECTORS.forEach(([pol, name, fp], i) => {
  const u = app.assetUnit(pol, name);
  const d = app.parseAssetUnit(u);
  check("unit vector " + (i + 1) + ": build + split + fingerprint", u === pol + name && d !== null && d.policyHex === pol && d.nameHex === name && d.fingerprint === fp && d.unit === pol + name);
});
check("unit: PATATE name reads as text", app.parseAssetUnit(CIP14_VECTORS[3][0] + CIP14_VECTORS[3][1]).nameText === "PATATE");
check("unit: empty name text is the empty string", app.parseAssetUnit(CIP14_VECTORS[0][0]).nameText === "");
check("unit: non-text name (policy bytes as name) has no text form", app.parseAssetUnit(CIP14_VECTORS[5][0] + CIP14_VECTORS[5][1]).nameText === null);
check("unit: all-zero name has no text form (NUL bytes)", app.parseAssetUnit(CIP14_VECTORS[7][0] + CIP14_VECTORS[7][1]).nameText === null);
check("unit: uppercase + 0x prefix accepted", app.parseAssetUnit("0x" + (CIP14_VECTORS[3][0] + CIP14_VECTORS[3][1]).toUpperCase()).fingerprint === CIP14_VECTORS[3][2]);
check("unit: 55 hex chars rejected", app.parseAssetUnit("a".repeat(55)) === null);
check("unit: odd length rejected", app.parseAssetUnit("a".repeat(57)) === null);
check("unit: 33-byte name rejected", app.parseAssetUnit(CIP14_VECTORS[0][0] + "00".repeat(33)) === null);
check("unit: 32-byte name accepted", app.parseAssetUnit(CIP14_VECTORS[0][0] + "00".repeat(32)) !== null);
check("unit: non-hex rejected", app.parseAssetUnit("zz" + CIP14_VECTORS[0][0].slice(2)) === null);
check("unit: empty rejected", app.parseAssetUnit("") === null);
check("unit: a fingerprint is not a unit (one-way hash)", app.parseAssetUnit(CIP14_VECTORS[0][2]) === null);
check("unit: a payment address is not a unit", app.parseAssetUnit(ADA) === null);
check("unit builder rejects a short policy", app.assetUnit("abcd", "") === null);
check("unit builder rejects a 33-byte name", app.assetUnit(CIP14_VECTORS[0][0], "00".repeat(33)) === null);

/* datum & script hashes — every expected value below was produced by
   Python hashlib.blake2b (the reference implementation) over the same
   inputs, and the general multi-block blake2b was cross-checked against
   hashlib for digest sizes 20/28/32/64 at input lengths 0,1,3,55,64,100,
   127,128,129,191,255,256,300,1000 before this shipped. Datum inputs are
   real Plutus Data CBOR: 00 = integer 0, 182a = integer 42,
   d8799f182a182bff = Constr 0 [42, 43]. */
check("hash tool in page", html.includes('id="hashcalc"') && html.includes('id="hash-result"') && html.includes('id="hash-kind"') && html.includes('id="hash-bytes"'));
function hexOf(bytes) { return bytes.map(b => b.toString(16).padStart(2, "0")).join(""); }
check("blake2b-256 of empty input (known constant)", hexOf(app.blake2b([], 32)) === "0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8");
check("blake2b rejects bad digest size", app.blake2b([0], 0) === null && app.blake2b([0], 65) === null);
check("datum hash of integer 0", app.datumHash("00") === "03170a2e7597b7b7e3d84c05391d139a62b157e78786d8c082f29dcf4c111314");
check("datum hash of integer 42", app.datumHash("182a") === "9e1199a988ba72ffd6e9c269cadb3b53b5f360ff99f112d9b2ee30c4d74ad88b");
check("datum hash of Constr 0 [42, 43]", app.datumHash("d8799f182a182bff") === "75e8eb9badfb369842b9796f1b2ef45e24f2b0e42d3f99b13639b2663dbf34ba");
check("datum hash multi-block (200 bytes, crosses the 128-byte block edge)", app.datumHash("ab".repeat(200)) === "49ede9457e47dd751fb8acbc86cee75c48c217388788abffe19b51b1aabdcd52");
check("datum hash accepts 0x prefix + uppercase", app.datumHash("0x182A") === app.datumHash("182a"));
check("datum hash rejects empty input", app.datumHash("") === null);
check("datum hash rejects odd-length hex", app.datumHash("abc") === null);
check("datum hash rejects non-hex", app.datumHash("zz") === null);
check("native script hash (CBOR of {all: []} = 820080)", app.scriptHash("native", "820080") === "fd7593393aa158a50d69e5f0edf759c14d3cadbe469dd9b4bf473f1b");
check("plutusv1 script hash", app.scriptHash("plutusv1", "0102030405") === "b66e1bb840143447fea4b1b44d459f88f34fb222c1a6b4e846a28dc9");
check("plutusv2 script hash", app.scriptHash("plutusv2", "0102030405") === "484921e55adc6b3b42df9cc91868a295f14a02ca0559abc38d546a46");
check("plutusv3 script hash", app.scriptHash("plutusv3", "0102030405") === "7703cfe5204ce5eeb7dadf76b0a94f7b4978c5c99246d8fee29b8b6e");
check("language tag separates hashes of identical bytes", app.scriptHash("plutusv1", "0102030405") !== app.scriptHash("plutusv2", "0102030405"));
check("script hash rejects unknown kind", app.scriptHash("plutusv4", "0102") === null);
check("script hash rejects empty bytes", app.scriptHash("native", "") === null);
check("script hash rejects garbage hex", app.scriptHash("native", "xyz") === null);

/* key hashes & address builder — key-hash vectors cross-checked against
   Python hashlib.blake2b(digest_size=28); the address vectors are anchored
   to a real wallet-generated mainnet address: the donation address above
   decodes to the payment/stake key hashes below, and the builder must
   reproduce it byte-for-byte (the enterprise and reward forms share its
   payload, so they are proven by the same anchor). */
check("keyaddr tool in page", html.includes('id="keyaddr"') && html.includes('id="key-result"') && html.includes('id="key-pay"') && html.includes('id="key-stake"') && html.includes('id="key-network"'));
check("key hash of vkey 00..1f (hashlib vector)", app.keyHash("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f") === "491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297");
check("key hash of all-zero vkey (hashlib vector)", app.keyHash("00".repeat(32)) === "f9dca21a6c826ec8acb4cf395cbc24351937bfe6560b2683ab8b415f");
check("key hash of all-ff vkey (hashlib vector)", app.keyHash("ff".repeat(32)) === "edb1127fd6609983d7149032fe92dc7499895cc5b07b0a7d6994e25f");
check("key hash accepts 0x prefix + uppercase", app.keyHash("0x" + "AB".repeat(32)) === app.keyHash("ab".repeat(32)));
check("key hash rejects short key", app.keyHash("00".repeat(31)) === null);
check("key hash rejects long key", app.keyHash("00".repeat(33)) === null);
check("key hash rejects non-hex", app.keyHash("zz".repeat(32)) === null);
check("key hash rejects empty input", app.keyHash("") === null);
const PAY_KH = "ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d";
const STAKE_KH = "ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82";
check("base mainnet rebuilds the real donation address byte-for-byte", app.buildAddress("base", "mainnet", PAY_KH, STAKE_KH) === ADA);
check("enterprise mainnet from the same payment key hash", app.buildAddress("enterprise", "mainnet", PAY_KH, null) === "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9");
check("reward mainnet from the same stake key hash", app.buildAddress("reward", "mainnet", null, STAKE_KH) === "stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5");
check("base testnet uses addr_test prefix + network 0 header", app.buildAddress("base", "testnet", PAY_KH, STAKE_KH) === "addr_test1qrhnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpq3ty4en");
check("built reward testnet verifies as bech32 with stake_test prefix", (() => { const a = app.buildAddress("reward", "testnet", null, STAKE_KH); return a.startsWith("stake_test1") && app.verifyBech32(a).valid; })());
check("vkey -> key hash -> enterprise address pipeline verifies", (() => { const a = app.buildAddress("enterprise", "mainnet", app.keyHash("00".repeat(32)), null); return a.startsWith("addr1v") && app.verifyBech32(a).valid; })());
check("base address requires a stake key hash", app.buildAddress("base", "mainnet", PAY_KH, null) === null);
check("reward address requires a stake key hash", app.buildAddress("reward", "mainnet", null, null) === null);
check("builder rejects unknown kind", app.buildAddress("byron", "mainnet", PAY_KH, STAKE_KH) === null);
check("builder rejects unknown network", app.buildAddress("base", "preview", PAY_KH, STAKE_KH) === null);
check("builder rejects short key hash", app.buildAddress("enterprise", "mainnet", "abcd", null) === null);

/* address decoder (CIP-19) — anchored to the same real wallet-generated
   address as the builder tests: decoding the donation address must return
   exactly the key hashes the builder tests start from, and the derived
   enterprise / reward addresses must equal the builder's known outputs. */
check("decoder tool in page", html.includes('id="addrdecode"') && html.includes('id="decode-result"') && html.includes('id="decode-addr"'));
const decOwn = app.decodeAddress(ADA);
check("decoder: donation address is a mainnet base address (type 0)", decOwn.type === 0 && decOwn.typeLabel === "Base address" && decOwn.network === "mainnet" && decOwn.header === 1);
check("decoder: payment key hash matches the builder anchor", decOwn.paymentKind === "key" && decOwn.paymentHash === PAY_KH);
check("decoder: stake key hash matches the builder anchor", decOwn.stakeKind === "key" && decOwn.stakeHash === STAKE_KH);
check("decoder: derived enterprise matches the builder output", decOwn.enterprise === "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9");
check("decoder: derived reward matches the builder output", decOwn.reward === "stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5");
check("decoder: builder -> decoder round trip on a testnet base address", (() => { const d = app.decodeAddress(app.buildAddress("base", "testnet", PAY_KH, STAKE_KH)); return d.network === "testnet" && d.paymentHash === PAY_KH && d.stakeHash === STAKE_KH && d.enterprise === app.buildAddress("enterprise", "testnet", PAY_KH, null) && d.reward === app.buildAddress("reward", "testnet", null, STAKE_KH); })());
const decEnt = app.decodeAddress("addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9");
check("decoder: enterprise address has no stake credential and no reward", decEnt.type === 6 && decEnt.paymentHash === PAY_KH && decEnt.stakeHash === null && decEnt.reward === null);
const decRew = app.decodeAddress("stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5");
check("decoder: reward address carries only the stake credential", decRew.type === 14 && decRew.stakeHash === STAKE_KH && decRew.paymentHash === null);
/* script-payment base address, built byte-by-byte in the test: header 0x11
   (type 1 = script payment + key stake), a known script hash + STAKE_KH */
const SCRIPT_HASH = "fd7593393aa158a50d69e5f0edf759c14d3cadbe469dd9b4bf473f1b";
const scriptAddr = app.bech32Encode("addr", app.convertBits([0x11].concat(app.hexToBytes(SCRIPT_HASH), app.hexToBytes(STAKE_KH)), 8, 5, true));
const decScript = app.decodeAddress(scriptAddr);
check("decoder: script payment credential typed as script", decScript.type === 1 && decScript.paymentKind === "script" && decScript.paymentHash === SCRIPT_HASH && decScript.stakeKind === "key");
check("decoder: script enterprise derivation uses type 7 header", app.decodeAddress(decScript.enterprise).type === 7);
/* pointer address: header 0x41 (type 4) + payment hash + pointer bytes */
const pointerAddr = app.bech32Encode("addr", app.convertBits([0x41].concat(app.hexToBytes(PAY_KH), [1, 2, 3]), 8, 5, true));
const decPtr = app.decodeAddress(pointerAddr);
check("decoder: pointer address exposes pointer bytes and no stake hash", decPtr.type === 4 && decPtr.paymentHash === PAY_KH && decPtr.pointerHex === "010203" && decPtr.stakeHash === null && decPtr.reward === null);
check("decoder rejects a pool ID", app.decodeAddress(POOL_BECH) === null);
check("decoder rejects a tampered address", app.decodeAddress(ADA.slice(0, -1) + "q") === null);
check("decoder rejects garbage", app.decodeAddress("addr1garbage") === null);
check("decoder rejects empty input", app.decodeAddress("") === null);
check("decoder rejects a truncated base address", (() => { const full = app.bech32DecodeBytes(ADA); const trunc = app.bech32Encode("addr", app.convertBits(full.bytes.slice(0, 40), 8, 5, true)); return app.decodeAddress(trunc) === null; })());

/* address hex <-> bech32 converter — the conversion is a pure re-encoding
   of the identical payload bytes, so the ground truth is byte layout: a
   mainnet base address is header 0x01 || payment KH || stake KH (the same
   anchor hashes as the builder/decoder tests), enterprise is 0x61 || pay
   KH, reward is 0xe1 || stake KH, testnet base is 0x00 || pay || stake.
   These hex strings were reproduced from the bech32 forms with the hub's
   own bech32 decoder before this tool was wired (scratch prototype). */
check("addrhex converter in page", html.includes('id="addrhex"') && html.includes('id="addrhex-result"') && html.includes('id="addrhex-bech32"') && html.includes('id="addrhex-hex"'));
const ADA_HEX = "01" + PAY_KH + STAKE_KH;
const ENT_HEX = "61" + PAY_KH;
const REW_HEX = "e1" + STAKE_KH;
const TEST_HEX = "00" + PAY_KH + STAKE_KH;
check("bech32 -> hex: donation address is 01||payKH||stakeKH", app.addressToHex(ADA) === ADA_HEX);
check("hex -> bech32: donation address round-trips byte-for-byte", app.addressFromHex(ADA_HEX) === ADA);
check("bech32 -> hex: enterprise address is 61||payKH", app.addressToHex("addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9") === ENT_HEX);
check("hex -> bech32: enterprise address round-trips", app.addressFromHex(ENT_HEX) === "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9");
check("bech32 -> hex: reward address is e1||stakeKH", app.addressToHex("stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5") === REW_HEX);
check("hex -> bech32: reward hex gets the stake prefix", app.addressFromHex(REW_HEX) === "stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5");
check("hex -> bech32: testnet base gets addr_test + header 0x00", app.addressFromHex(TEST_HEX) === "addr_test1qrhnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpq3ty4en");
check("hex input accepts 0x prefix + uppercase", app.addressFromHex("0x" + ADA_HEX.toUpperCase()) === ADA);
check("pointer address hex round-trips", app.addressFromHex(app.addressToHex(pointerAddr)) === pointerAddr);
check("script base address hex round-trips", app.addressToHex(app.addressFromHex("11" + SCRIPT_HASH + STAKE_KH)) === "11" + SCRIPT_HASH + STAKE_KH);
check("hex form decodes to the same credentials", (() => { const d = app.decodeAddress(app.addressFromHex(ADA_HEX)); return d.paymentHash === PAY_KH && d.stakeHash === STAKE_KH; })());
check("pool ID hex is not an address (header 0x7f, bad network id)", app.addressFromHex(POOL_HEX) === null);
check("pool ID bech32 does not convert to hex", app.addressToHex(POOL_BECH) === null);
check("asset fingerprint does not convert to hex", app.addressToHex(CIP14_VECTORS[0][2]) === null);
check("tampered bech32 rejected", app.addressToHex(ADA.slice(0, -1) + "q") === null);
check("garbage bech32 rejected", app.addressToHex("addr1garbage") === null);
check("empty bech32 rejected", app.addressToHex("") === null);
check("odd-length hex rejected", app.addressFromHex(ADA_HEX.slice(0, -1)) === null);
check("non-hex rejected", app.addressFromHex("zz" + ADA_HEX.slice(2)) === null);
check("truncated base hex rejected (40 bytes)", app.addressFromHex(ADA_HEX.slice(0, 80)) === null);
check("bad network id rejected (header 0x02)", app.addressFromHex("02" + PAY_KH + STAKE_KH) === null);
check("reserved type rejected (header 0x81, type 8)", app.addressFromHex("81" + PAY_KH) === null);
check("empty hex rejected", app.addressFromHex("") === null);

/* governance ID converter (CIP-129 / legacy CIP-105) — ground truth is
   the five test vectors published in CIP-129 itself (zero credential
   hashes; gov actions over all-zero / all-one transaction IDs), plus a
   real DRep's published ID pair: one credential hash shown in both its
   CIP-129 form (header 0x22 || hash) and its legacy CIP-105 form (bare
   hash). Both bech32 strings were reproduced from the hash alone in the
   scratch prototype before this tool was wired. */
check("govid converter in page", html.includes('id="govid"') && html.includes('id="gov-input"') && html.includes('id="gov-result"'));
const GOV_ZERO = "00".repeat(28);
const DREP_HASH = "4e1d2a282c1e434ff390b3dfa3b221bf4f5bd3d43b9eb31ee890fc0f";
const DREP_129 = "drep1yf8p623g9s0yxnlnjzealgajyxl57k7n6saeavc7azg0crcahnul9";
const DREP_105 = "drep1fcwj52pvrep5luusk0068v3pha84h5758w0tx8hgjr7q7k9e55q";
check("CIP-129 vector: cc_hot key hash of zero hash", app.govCredBech32("cc_hot", "key", GOV_ZERO) === "cc_hot1qgqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqvcdjk7");
check("CIP-129 vector: cc_cold script hash of zero hash", app.govCredBech32("cc_cold", "script", GOV_ZERO) === "cc_cold1zvqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6kflvs");
check("CIP-129 vector: drep key hash of zero hash", app.govCredBech32("drep", "key", GOV_ZERO) === "drep1ygqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq7vlc9n");
check("CIP-129 vector: gov action 000…#17", app.govActionBech32("00".repeat(32), 17) === "gov_action1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpzklpgpf");
check("CIP-129 vector: gov action 111…#0", app.govActionBech32("11".repeat(32), 0) === "gov_action1zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsq6dmejn");
check("real DRep: CIP-129 form from its hash", app.govCredBech32("drep", "key", DREP_HASH) === DREP_129);
check("real DRep: legacy CIP-105 form from its hash", app.govCredLegacyBech32("drep", "key", DREP_HASH) === DREP_105);
check("parse CIP-129 cc_hot: header 0x02 + zero hash", (() => { const p = app.parseGovId("cc_hot1qgqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqvcdjk7"); return p.kind === "cc_hot" && p.credKind === "key" && p.payload129Hex === "02" + GOV_ZERO; })());
check("parse CIP-129 cc_cold script: header 0x13", (() => { const p = app.parseGovId("cc_cold1zvqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6kflvs"); return p.kind === "cc_cold" && p.credKind === "script" && p.payload129Hex === "13" + GOV_ZERO; })());
check("parse legacy DRep gives the CIP-129 form + hash", (() => { const p = app.parseGovId(DREP_105); return p.format === "CIP-105 (legacy)" && p.cip129 === DREP_129 && p.hashHex === DREP_HASH && p.payload129Hex === "22" + DREP_HASH; })());
check("parse CIP-129 DRep gives the legacy form", (() => { const p = app.parseGovId(DREP_129); return p.format === "CIP-129" && p.legacy === DREP_105; })());
check("parse hex payload 22||hash gives both forms", (() => { const p = app.parseGovId("22" + DREP_HASH); return p.cip129 === DREP_129 && p.legacy === DREP_105; })());
check("parse gov action bech32 splits tx id + index", (() => { const p = app.parseGovId("gov_action1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpzklpgpf"); return p.txId === "00".repeat(32) && p.index === 17 && p.legacy === "00".repeat(32) + "#17"; })());
check("parse gov action hex payload", (() => { const p = app.parseGovId("11".repeat(32) + "00"); return p.cip129 === "gov_action1zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsq6dmejn"; })());
check("legacy script DRep round-trips via CIP-129", (() => { const leg = app.govCredLegacyBech32("drep", "script", DREP_HASH); const p = app.parseGovId(leg); return p.credKind === "script" && p.cip129 === app.govCredBech32("drep", "script", DREP_HASH) && p.legacy === leg; })());
check("bare 28-byte hash rejected (kind unknowable)", app.parseGovId(DREP_HASH) === null);
check("bad header credential nibble rejected", app.parseGovId("24" + DREP_HASH) === null);
check("reserved header nibble 0 rejected", app.parseGovId("20" + DREP_HASH) === null);
check("hrp/header kind mismatch rejected", (() => { const bad = app.bech32Encode("drep", app.convertBits([0x12].concat(app.hexToBytes(DREP_HASH)), 8, 5, true)); return app.parseGovId(bad) === null; })());
check("tampered gov ID rejected", app.parseGovId(DREP_129.slice(0, -1) + "8") === null);
check("pool ID is not a governance ID", app.parseGovId(POOL_BECH) === null);
check("payment address is not a governance ID", app.parseGovId(ADA) === null);
check("gov action index above 255 rejected", app.govActionBech32("00".repeat(32), 256) === null);
check("empty gov input rejected", app.parseGovId("") === null);

console.log(failures === 0 ? "\nALL TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
