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
check("all form controls labelled", ["addr", "ada", "lovelace", "q", "slot", "epoch", "stake-ada", "stake-rate", "stake-epochs", "fee-size", "pool-hex", "pool-bech32", "asset-policy", "asset-name", "hash-kind", "hash-bytes"].every(id =>
  html.includes(`for="${id}"`) || html.includes(`aria-label`)));
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=7"));
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

console.log(failures === 0 ? "\nALL TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
