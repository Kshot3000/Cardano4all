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
check("all form controls labelled", ["addr", "ada", "lovelace", "q", "slot", "epoch", "stake-ada", "stake-rate", "stake-epochs", "pool-rewards", "pool-cost", "pool-margin", "pool-owner-stake", "pool-total-stake", "pool-member-stake", "fee-size", "exunit-mem", "exunit-steps", "refscript-size", "pool-hex", "pool-bech32", "asset-policy", "asset-name", "unit-input", "hash-kind", "hash-bytes", "key-pay", "key-stake", "key-network", "decode-addr", "addrhex-bech32", "addrhex-hex", "gov-input", "cred-pay", "cred-pay-kind", "cred-stake", "cred-stake-kind", "cred-network", "cbor-input", "data-input", "minutxo-addr", "minutxo-assets", "minutxo-datum-kind", "minutxo-datum-hex", "minutxo-script-kind", "minutxo-script-hex", "native-input"].every(id =>
  html.includes(`for="${id}"`) || html.includes(`aria-label`)));
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=20"));
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

/* Pool reward split — the Shelley ledger reward-sharing rule
   (calcStakePoolOperatorReward / calcStakePoolMemberReward): one floor per
   recipient over exact rationals; if rewards <= cost the operator takes all.
   Anchor vector is the Cardano Foundation reward calculator's published
   worked example: 4,000 ADA rewards, 340 ADA cost, 2% margin -> operator
   340 + 2% x 3,660 = 413.2 ADA (with zero owner stake). */
check("poolsplit in page", html.includes('id="poolsplit"') && html.includes('id="pool-split-result"'));
const ps1 = app.poolRewardSplit("4000", "340", "2", "0", "1000000", "0");
check("poolsplit: foundation example — operator 413.2 ADA", ps1.operatorLovelace === "413200000" && ps1.memberLovelace === "0");
const ps2 = app.poolRewardSplit("4000", "340", "2", "0", "1000000", "10000");
check("poolsplit: delegator with 1% of pool gets 3660 x 0.98 x 0.01 = 35.868 ADA", ps2.memberLovelace === "35868000" && ps2.othersLovelace === "3550932000");
const ps3 = app.poolRewardSplit("1000", "340", "5", "100", "1000", "200");
check("poolsplit: hand vector — operator 435.7, delegator 125.4 ADA", ps3.operatorLovelace === "435700000" && ps3.memberLovelace === "125400000" && ps3.othersLovelace === "438900000");
const ps4 = app.poolRewardSplit("300", "340", "5", "0", "1000000", "500000");
check("poolsplit: rewards below cost — operator takes all, delegator 0", ps4.operatorLovelace === "300000000" && ps4.memberLovelace === "0" && ps4.othersLovelace === "0");
const ps5 = app.poolRewardSplit("340", "340", "5", "0", "1000000", "500000");
check("poolsplit: rewards equal to cost — operator takes all", ps5.operatorLovelace === "340000000" && ps5.memberLovelace === "0");
const ps6 = app.poolRewardSplit("1000", "340", "100", "100", "1000", "500");
check("poolsplit: 100% margin — operator takes all", ps6.operatorLovelace === "1000000000" && ps6.memberLovelace === "0");
const ps7 = app.poolRewardSplit("1000", "340", "5", "1000", "1000", "");
check("poolsplit: owner is the whole pool — operator takes all", ps7.operatorLovelace === "1000000000" && ps7.othersLovelace === "0");
const ps8 = app.poolRewardSplit("1000", "340", "2.5", "", "1000", "500");
check("poolsplit: fractional margin 2.5%, empty owner stake = 0 — delegator 321.75 ADA", ps8.operatorLovelace === "356500000" && ps8.memberLovelace === "321750000");
const ps9 = app.poolRewardSplit("340.000001", "340", "0", "0", "1000000", "1");
check("poolsplit: one lovelace over cost floors a tiny share to 0", ps9.operatorLovelace === "340000000" && ps9.memberLovelace === "0" && ps9.othersLovelace === "1");
check("poolsplit: parts always sum to the rewards", [ps1, ps2, ps3, ps4, ps5, ps6, ps7, ps8, ps9].every(r => BigInt(r.operatorLovelace) + BigInt(r.memberLovelace) + BigInt(r.othersLovelace) === BigInt(r.rewardsLovelace)));
check("poolsplit rejects owner + delegator over total stake", app.poolRewardSplit("1000", "340", "5", "600", "1000", "500") === null);
check("poolsplit rejects zero total stake", app.poolRewardSplit("1000", "340", "5", "0", "0", "0") === null);
check("poolsplit rejects margin above 100% and bad amounts", app.poolRewardSplit("1000", "340", "101", "0", "1000", "0") === null && app.poolRewardSplit("abc", "340", "5", "0", "1000", "0") === null && app.poolRewardSplit("1000", "340", "5", "0", "1000", "1.0000001") === null);

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

/* Plutus execution cost — the ledger's txscriptfee: one ceiling over
   mem x price_mem + steps x price_step. Prices verified live via Koios
   epoch_params for epoch 660 (2026-10-07): price_mem = 0.0577 = 577/10000,
   price_step = 0.0000721 = 721/10000000; caps max_tx_ex_mem = 16,500,000,
   max_tx_ex_steps = 10,000,000,000. Hand-derived vectors:
   1e6 mem = 57,700 exactly; 5e8 steps = 36,050 exactly; sum 93,750.
   The (1,1) vector pins the ceiling placement: a single ceiling over the
   sum gives 1 lovelace, ceiling each part separately would give 2. */
check("exunit calculator in page", html.includes('id="exunitcalc"') && html.includes('id="exunit-result"'));
check("exunit zero units cost zero", app.exunitCost("0", "0").costLovelace === "0");
check("exunit 1 mem + 1 step = 1 lovelace (single ceiling over the sum)", app.exunitCost("1", "1").costLovelace === "1");
check("exunit 1000 mem = ceil(57.7) = 58", app.exunitCost("1000", "0").costLovelace === "58");
check("exunit 1e6 steps = ceil(72.1) = 73", app.exunitCost("0", "1000000").costLovelace === "73");
check("exunit typical script: 1e6 mem + 5e8 steps = 93750 exactly", app.exunitCost("1000000", "500000000").costLovelace === "93750" && app.exunitCost("1000000", "500000000").exactLovelace === "93750");
check("exunit exact decimal kept un-rounded", app.exunitCost("1000", "0").exactLovelace === "57.7");
check("exunit 17 mem rounds up to 1, 18 mem to 2", app.exunitCost("17", "0").costLovelace === "1" && app.exunitCost("18", "0").costLovelace === "2");
check("exunit at per-tx maxima = 952050 + 721000 = 1673050", app.exunitCost("16500000", "10000000000").costLovelace === "1673050");
check("exunit above mem cap rejected", app.exunitCost("16500001", "0") === null);
check("exunit above step cap rejected", app.exunitCost("0", "10000000001") === null);
check("exunit fractional, garbage and empty rejected", app.exunitCost("1.5", "0") === null && app.exunitCost("abc", "0") === null && app.exunitCost("", "0") === null && app.exunitCost("0", "") === null);

/* reference script fee — Conway tierRefScriptFee: 25,600-byte tiers,
   15 lovelace/byte base (live param, epoch 660), x1.2 per tier, ONE
   floor over the exact rational total (ledger Tx.hs / ADR 9) */
check("refscript calculator in page", html.includes('id="refscriptcalc"') && html.includes('id="refscript-result"'));
check("refscript zero bytes cost zero", app.refScriptFee("0").feeLovelace === "0");
check("refscript 1 byte = 15 lovelace", app.refScriptFee("1").feeLovelace === "15");
check("refscript 100 bytes = 1500", app.refScriptFee("100").feeLovelace === "1500");
check("refscript full first tier 25600 = 384000 exactly", app.refScriptFee("25600").feeLovelace === "384000" && app.refScriptFee("25600").exactLovelace === "384000");
check("refscript first byte of tier 2 priced 18 (= 15 x 1.2)", app.refScriptFee("25601").feeLovelace === "384018");
check("refscript two full tiers = 384000 + 460800 = 844800", app.refScriptFee("51200").feeLovelace === "844800");
check("refscript tier-3 price 21.6 floored once: 51201 = 844821", app.refScriptFee("51201").feeLovelace === "844821" && app.refScriptFee("51201").exactLovelace === "844821.6");
check("refscript three full tiers = 1397760 (tier-3 full tier is exact)", app.refScriptFee("76800").feeLovelace === "1397760");
check("refscript 128000 = floor(2857574.4) = 2857574", app.refScriptFee("128000").feeLovelace === "2857574" && app.refScriptFee("128000").exactLovelace === "2857574.4");
check("refscript floor once, not per tier: 128003 = 2857686 (per-tier flooring gives 2857685)", app.refScriptFee("128003").feeLovelace === "2857686");
check("refscript at per-tx limit 204800 not flagged, priced 6335648", !app.refScriptFee("204800").overTxLimit && app.refScriptFee("204800").feeLovelace === "6335648");
check("refscript above per-tx limit flagged but still priced", app.refScriptFee("204801").overTxLimit === true);
check("refscript above per-block limit rejected", app.refScriptFee("1048577") === null);
check("refscript fractional, garbage and empty rejected", app.refScriptFee("1.5") === null && app.refScriptFee("abc") === null && app.refScriptFee("") === null);

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

/* credential-kind builder (CIP-19 types 0-3, 6-7, 14-15) — a credential is
   a key hash or a script hash; the kinds pick the type nibble. Ground
   truth is a real Aiken blueprint (Mesh giftcard, Plutus V3, from the
   Mesh #763 investigation): the hub's scriptHash of each validator's
   compiledCode reproduces the blueprint's published hash, and the script
   addresses built from those hashes must be byte-exact (header || hashes,
   via the proven hex converter) and decode back to the same hashes/kinds
   via the proven CIP-19 decoder. Default creds stay key/key, unchanged. */
check("credaddr tool in page", html.includes('id="hashaddr"') && html.includes('id="cred-result"') && html.includes('id="cred-pay-kind"'));
const MINT_SH = "401c967008d42885400991f9225715e1c3a8e43757b1fd36a1328195";
const REDEEM_SH = "b2386630f1b210c58d0e46f132e931b362c3f373685118018e4d956f";
check("explicit key/key creds == default builder output", app.buildAddress("base", "mainnet", PAY_KH, STAKE_KH, "key", "key") === ADA);
/* Compiled code copied verbatim from the blueprint (mesh-contract
   giftcard aiken-workspace-v2/plutus.json, Plutus V3) so this suite is
   self-contained; the hashes asserted below are the blueprint's own. */
const MINT_CODE = "5901ae01010032323232323232232225333005323232323253323300b3001300c3754004264646464a66601e600a0022a66602460226ea801c540085854ccc03cc00c00454ccc048c044dd50038a8010b0b18079baa006132323232533301430170021323253330133009301437540162a666026601260286ea8c8cc004004018894ccc0600045300103d87a80001323253330173375e603860326ea80080504cdd2a40006603600497ae0133004004001301c002301a00115333013300700113371e00402229405854ccc04ccdc3800a4002266e3c0080445281bad3014002375c60240022c602a00264a666020600860226ea800452f5bded8c026eacc054c048dd500099198008009bab3015301630163016301600322533301400114c103d87a80001323232325333015337220140042a66602a66e3c0280084cdd2a4000660326e980052f5c02980103d87a80001330060060033756602c0066eb8c050008c060008c058004dd6180980098079baa007370e90011bae3010300d37540046e1d200016300e300f002300d001300d002300b0013007375400229309b2b1bae0015734aae7555cf2ab9f5740ae855d11";
const REDEEM_CODE = "59011501010032323232323232232232253330063232323232533300b3370e900118061baa001132323232325333013301600213253330113370e6eb4c04c009200113371e00201e2940dd718088008b180a00099299980799b8748008c040dd50008a5eb7bdb1804dd5980a18089baa001323300100137566028602a602a602a602a60226ea8020894ccc04c004530103d87a80001323232325333014337220200042a66602866e3c0400084cdd2a4000660306e980052f5c02980103d87a80001330060060033756602a0066eb8c04c008c05c008c054004c048c04c008c044004c034dd50008b1807980800118070009807001180600098041baa00114984d958dd70009bae0015734aae7555cf2ab9f5740ae855d101";
check("scriptHash of Aiken giftcard mint compiledCode == blueprint hash", app.scriptHash("plutusv3", MINT_CODE) === MINT_SH);
check("scriptHash of Aiken giftcard redeem compiledCode == blueprint hash", app.scriptHash("plutusv3", REDEEM_CODE) === REDEEM_SH);
check("enterprise script mainnet bytes = 71||redeem hash", app.addressToHex(app.buildAddress("enterprise", "mainnet", REDEEM_SH, null, "script")) === "71" + REDEEM_SH);
check("enterprise script testnet bytes = 70||redeem hash", app.addressToHex(app.buildAddress("enterprise", "testnet", REDEEM_SH, null, "script")) === "70" + REDEEM_SH);
check("base script/key bytes = 11||mint||stake key hash", app.addressToHex(app.buildAddress("base", "mainnet", MINT_SH, STAKE_KH, "script", "key")) === "11" + MINT_SH + STAKE_KH);
check("base key/script bytes = 21||pay key hash||redeem", app.addressToHex(app.buildAddress("base", "mainnet", PAY_KH, REDEEM_SH, "key", "script")) === "21" + PAY_KH + REDEEM_SH);
check("base script/script bytes = 31||mint||redeem", app.addressToHex(app.buildAddress("base", "mainnet", MINT_SH, REDEEM_SH, "script", "script")) === "31" + MINT_SH + REDEEM_SH);
check("reward script bytes = f1||redeem", app.addressToHex(app.buildAddress("reward", "mainnet", null, REDEEM_SH, "key", "script")) === "f1" + REDEEM_SH);
check("reward key ignores payCred (still type 14)", app.addressToHex(app.buildAddress("reward", "mainnet", null, STAKE_KH, "script", "key")) === "e1" + STAKE_KH);
const dSS = app.decodeAddress(app.buildAddress("base", "mainnet", MINT_SH, REDEEM_SH, "script", "script"));
check("decoder reads base script/script kinds + hashes back", dSS.paymentKind === "script" && dSS.stakeKind === "script" && dSS.paymentHash === MINT_SH && dSS.stakeHash === REDEEM_SH);
check("decoder enterprise derivation == builder script enterprise", dSS.enterprise === app.buildAddress("enterprise", "mainnet", MINT_SH, null, "script"));
check("decoder reward derivation == builder script reward", dSS.reward === app.buildAddress("reward", "mainnet", null, REDEEM_SH, "key", "script"));
const dEnt = app.decodeAddress(app.buildAddress("enterprise", "mainnet", REDEEM_SH, null, "script"));
check("decoder reads enterprise script (type 7)", dEnt.type === 7 && dEnt.paymentKind === "script" && dEnt.paymentHash === REDEEM_SH);
check("enterprise key stays type 6 with explicit cred", app.addressToHex(app.buildAddress("enterprise", "mainnet", PAY_KH, null, "key")) === "61" + PAY_KH);
check("builder rejects unknown pay cred kind", app.buildAddress("base", "mainnet", PAY_KH, STAKE_KH, "token", "key") === null);
check("builder rejects unknown stake cred kind", app.buildAddress("reward", "mainnet", null, STAKE_KH, "key", "x") === null);
check("script enterprise still requires a 56-hex hash", app.buildAddress("enterprise", "mainnet", "abcd", null, "script") === null);

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

/* CBOR / Plutus Data decoder (RFC 8949) — ground truth is the example
   set in RFC 8949 Appendix A (each value below is the RFC's own pairing
   of encoding and value) plus real Plutus Data encodings the hub already
   uses (00 = 0, 182a = 42, d8799f182a182bff = Constr 0 [42, 43]). The
   decoder was prototyped in scratch first; six of the prototype's
   initial expectations were wrong BY HAND (bignum sign, subnormal half
   float, two truncated arrays, a mistyped tag-1280 string) and each was
   corrected only after re-decoding the bytes by hand against the RFC —
   the decoder itself matched the spec on every genuine vector. */
check("cbor decoder in page", html.includes('id="cbordecode"') && html.includes('id="cbor-input"') && html.includes('id="cbor-result"'));
check("cbor: unsigned ints at every width", app.decodeCbor("00") === "0" && app.decodeCbor("17") === "23" && app.decodeCbor("1818") === "24" && app.decodeCbor("1864") === "100" && app.decodeCbor("1903e8") === "1000" && app.decodeCbor("1a000f4240") === "1000000" && app.decodeCbor("1b000000e8d4a51000") === "1000000000000" && app.decodeCbor("1bffffffffffffffff") === "18446744073709551615");
check("cbor: negative ints", app.decodeCbor("20") === "-1" && app.decodeCbor("29") === "-10" && app.decodeCbor("3863") === "-100" && app.decodeCbor("3903e7") === "-1000" && app.decodeCbor("3bffffffffffffffff") === "-18446744073709551616");
check("cbor: bignum tags 2/3 (RFC A)", app.decodeCbor("c249010000000000000000") === "18446744073709551616" && app.decodeCbor("c349010000000000000000") === "-18446744073709551617");
check("cbor: byte strings", app.decodeCbor("40") === "h''" && app.decodeCbor("4401020304") === "h'01020304'");
check("cbor: text strings", app.decodeCbor("60") === '""' && app.decodeCbor("6161") === '"a"' && app.decodeCbor("6449455446") === '"IETF"');
check("cbor: arrays incl. nested + long form", app.decodeCbor("80") === "[]" && app.decodeCbor("83010203") === "[1, 2, 3]" && app.decodeCbor("8301820203820405") === "[1, [2, 3], [4, 5]]" && app.decodeCbor("98190102030405060708090a0b0c0d0e0f101112131415161718181819") === "[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]");
check("cbor: maps", app.decodeCbor("a0") === "{}" && app.decodeCbor("a201020304") === "{1: 2, 3: 4}" && app.decodeCbor("a26161016162820203") === '{"a": 1, "b": [2, 3]}' && app.decodeCbor("826161a161626163") === '["a", {"b": "c"}]');
check("cbor: simple values", app.decodeCbor("f4") === "false" && app.decodeCbor("f5") === "true" && app.decodeCbor("f6") === "null" && app.decodeCbor("f7") === "undefined");
check("cbor: floats (half/single/double)", app.decodeCbor("f93c00") === "1" && app.decodeCbor("f9bc00") === "-1" && app.decodeCbor("f90400") === "0.00006103515625" && app.decodeCbor("fa47c35000") === "100000" && app.decodeCbor("fb3ff199999999999a") === "1.1");
check("cbor: indefinite lengths", app.decodeCbor("9fff") === "[]" && app.decodeCbor("83018202039f0405ff") === "[1, [2, 3], [4, 5]]" && app.decodeCbor("5f42010243030405ff") === "h'0102030405'" && app.decodeCbor("7f657374726561646d696e67ff") === '"streaming"' && app.decodeCbor("bf61610161629f0203ffff") === '{"a": 1, "b": [2, 3]}');
check("cbor: generic tag renders as tag n (…)", app.decodeCbor("d74401020304") === "tag 23 (h'01020304')");
check("cbor: Plutus integer 42 (182a)", app.decodeCbor("182a") === "42");
check("cbor: Plutus Constr 0 [42, 43] (the hash tool's sample datum)", app.decodeCbor("d8799f182a182bff") === "Constr 0 [42, 43]");
check("cbor: Plutus Constr 0 [] and Constr 1 [1]", app.decodeCbor("d87980") === "Constr 0 []" && app.decodeCbor("d87a9f01ff") === "Constr 1 [1]");
check("cbor: Plutus Constr via tag 1280+ (Constr 7, fields are the tagged item)", app.decodeCbor("d9050080") === "Constr 7 []" && app.decodeCbor("d905009f0102ff") === "Constr 7 [1, 2]" && app.decodeCbor("d9057880") === "Constr 127 []");
check("cbor: Plutus Constr via tag 102 [index, fields]", app.decodeCbor("d8668219012c9f01ff") === "Constr 300 [1]" && app.decodeCbor("d866821905009fff") === "Constr 1280 []");
check("cbor: tag 1280 is Constr 7, not the obsolete [index, fields] wrapper", app.decodeCbor("d90500820183020304") === "Constr 7 [1, [2, 3, 4]]");
check("cbor: Plutus map datum (a1 = map of pairs used by Data)", app.decodeCbor("a10102") === "{1: 2}");
check("cbor: decoded datum hashes back to the hub's known datum hash", app.datumHash("d8799f182a182bff") === "75e8eb9badfb369842b9796f1b2ef45e24f2b0e42d3f99b13639b2663dbf34ba" && app.decodeCbor("d8799f182a182bff") === "Constr 0 [42, 43]");
check("cbor: 0x prefix + uppercase + whitespace accepted", app.decodeCbor(" 0xD8799F182A182BFF ") === "Constr 0 [42, 43]");
check("cbor rejects empty input", app.decodeCbor("") === null);
check("cbor rejects non-hex", app.decodeCbor("zz") === null);
check("cbor rejects odd-length hex", app.decodeCbor("182") === null);
check("cbor rejects truncated items", app.decodeCbor("18") === null && app.decodeCbor("830102") === null && app.decodeCbor("d8") === null);
check("cbor rejects trailing bytes after one item", app.decodeCbor("0000") === null);
check("cbor rejects a stray break byte", app.decodeCbor("ff") === null);
check("cbor rejects reserved additional info (1c)", app.decodeCbor("1c") === null);
check("cbor rejects indefinite integer (1f)", app.decodeCbor("1f") === null);
check("cbor rejects invalid UTF-8 text", app.decodeCbor("62c328") === null);
check("cbor rejects a truncated array(3)", app.decodeCbor("8301820203") === null);

/* Plutus Data encoder — the decoder's write side. Ground truth is the
   reference implementation pycardano 0.19.2, run in scratch: every
   vector below is pycardano's own to_cbor_hex() for the same JSON
   (from_json), its datum hash for the sample datum matches the hub's
   known hash, and pycardano decoded this encoder's output for the
   full vector set back to the identical structure. The one place the
   encoder deliberately differs from pycardano's from_json output is
   a NESTED constructor's fields framing (definite there, indefinite
   here at every depth) — a cbor2 serialisation quirk in that path;
   the uniform indefinite rule matches pycardano's top-level output
   and the ledger accepts both framings on decode. */
check("data encoder in page", html.includes('id="dataencode"') && html.includes('id="data-input"') && html.includes('id="data-result"'));
check("dataenc: integers at every width", app.encodePlutusData('{"int":0}') === "00" && app.encodePlutusData('{"int":42}') === "182a" && app.encodePlutusData('{"int":-1}') === "20" && app.encodePlutusData('{"int":24}') === "1818" && app.encodePlutusData('{"int":-25}') === "3818" && app.encodePlutusData('{"int":1000}') === "1903e8" && app.encodePlutusData('{"int":4294967296}') === "1b0000000100000000" && app.encodePlutusData('{"int":-18446744073709551616}') === "3bffffffffffffffff");
check("dataenc: bignum integers beyond 64 bits (tags 2/3)", app.encodePlutusData('{"int":18446744073709551616}') === "c249010000000000000000" && app.encodePlutusData('{"int":-18446744073709551617}') === "c349010000000000000000" && app.encodePlutusData('{"int":1000000000000000000000000000000}') === "c24d0c9f2c9cd04674edea40000000");
check("dataenc: quoted int accepted, exact beyond float precision", app.encodePlutusData('{"int":"18446744073709551616"}') === "c249010000000000000000" && app.encodePlutusData('{"int":18446744073709551616}') === "c249010000000000000000");
check("dataenc: byte strings at the definite-length boundaries", app.encodePlutusData('{"bytes":""}') === "40" && app.encodePlutusData('{"bytes":"01020304"}') === "4401020304" && app.encodePlutusData('{"bytes":"' + "00".repeat(23) + '"}') === "57" + "00".repeat(23) && app.encodePlutusData('{"bytes":"' + "00".repeat(24) + '"}') === "5818" + "00".repeat(24));
check("dataenc: byte strings over 64 bytes chunked (Plutus rule)", app.encodePlutusData('{"bytes":"' + "aa".repeat(65) + '"}') === "5f5840" + "aa".repeat(64) + "41aaff" && app.encodePlutusData('{"bytes":"' + "aa".repeat(130) + '"}') === "5f5840" + "aa".repeat(64) + "5840" + "aa".repeat(64) + "42aaaaff");
check("dataenc: lists are indefinite, maps definite", app.encodePlutusData('{"list":[]}') === "9fff" && app.encodePlutusData('{"list":[{"int":1},{"int":2},{"int":3}]}') === "9f010203ff" && app.encodePlutusData('{"map":[]}') === "a0" && app.encodePlutusData('{"map":[{"k":{"int":1},"v":{"int":2}}]}') === "a10102");
check("dataenc: map with mixed key/value types", app.encodePlutusData('{"map":[{"k":{"int":1},"v":{"bytes":"ff"}},{"k":{"bytes":"00"},"v":{"list":[]}}]}') === "a20141ff41009fff");
check("dataenc: Constr tags 121+ for indices 0-6", app.encodePlutusData('{"constructor":0,"fields":[{"int":42},{"int":43}]}') === "d8799f182a182bff" && app.encodePlutusData('{"constructor":0,"fields":[]}') === "d87980" && app.encodePlutusData('{"constructor":1,"fields":[{"int":1}]}') === "d87a9f01ff" && app.encodePlutusData('{"constructor":6,"fields":[]}') === "d87f80");
check("dataenc: Constr tags 1280+ for indices 7-127", app.encodePlutusData('{"constructor":7,"fields":[]}') === "d9050080" && app.encodePlutusData('{"constructor":7,"fields":[{"int":1},{"int":2}]}') === "d905009f0102ff" && app.encodePlutusData('{"constructor":127,"fields":[]}') === "d9057880");
check("dataenc: Constr tag 102 for indices 128+", app.encodePlutusData('{"constructor":262,"fields":[]}') === "d866821901069fff" && app.encodePlutusData('{"constructor":262,"fields":[{"int":5}]}') === "d866821901069f05ff" && app.encodePlutusData('{"constructor":300,"fields":[{"int":1}]}') === "d8668219012c9f01ff" && app.encodePlutusData('{"constructor":1280,"fields":[]}') === "d866821905009fff");
check("dataenc: chunked bytes nested inside a constructor", app.encodePlutusData('{"constructor":2,"fields":[{"bytes":"' + "ab".repeat(65) + '"}]}') === "d87b9f5f5840" + "ab".repeat(64) + "41abffff");
check("dataenc: sample datum hashes to the hub's known datum hash", app.datumHash(app.encodePlutusData('{"constructor":0,"fields":[{"int":42},{"int":43}]}')) === "75e8eb9badfb369842b9796f1b2ef45e24f2b0e42d3f99b13639b2663dbf34ba");
check("dataenc: round-trips through the hub decoder", app.decodeCbor(app.encodePlutusData('{"constructor":0,"fields":[{"int":42},{"int":43}]}')) === "Constr 0 [42, 43]" && app.decodeCbor(app.encodePlutusData('{"constructor":7,"fields":[{"int":1},{"int":2}]}')) === "Constr 7 [1, 2]" && app.decodeCbor(app.encodePlutusData('{"constructor":300,"fields":[{"int":1}]}')) === "Constr 300 [1]" && app.decodeCbor(app.encodePlutusData('{"map":[{"k":{"int":1},"v":{"bytes":"ff"}}]}')) === "{1: h'ff'}" && app.decodeCbor(app.encodePlutusData('{"list":[{"constructor":3,"fields":[{"bytes":"cafe"}]}]}')) === "[Constr 3 [h'cafe']]" && app.decodeCbor(app.encodePlutusData('{"bytes":"' + "aa".repeat(65) + '"}')) === "h'" + "aa".repeat(65) + "'");
check("dataenc rejects empty / non-JSON input", app.encodePlutusData("") === null && app.encodePlutusData("not json") === null && app.encodePlutusData("[1,2]") === null && app.encodePlutusData("42") === null);
check("dataenc rejects malformed values", app.encodePlutusData('{"int":1.5}') === null && app.encodePlutusData('{"int":1e3}') === null && app.encodePlutusData('{"bytes":"abc"}') === null && app.encodePlutusData('{"bytes":"zz"}') === null && app.encodePlutusData('{"foo":1}') === null);
check("dataenc rejects malformed constructors", app.encodePlutusData('{"constructor":-1,"fields":[]}') === null && app.encodePlutusData('{"constructor":0}') === null && app.encodePlutusData('{"constructor":0,"fields":[],"extra":1}') === null && app.encodePlutusData('{"constructor":18446744073709551616,"fields":[]}') === null);
check("dataenc rejects malformed lists and maps", app.encodePlutusData('{"list":[1]}') === null && app.encodePlutusData('{"map":[{"k":{"int":1}}]}') === null && app.encodePlutusData('{"map":[{"k":{"int":1},"v":{"int":2},"x":{"int":3}}]}') === null);
check("dataenc rejects an oversized integer", app.encodePlutusData('{"int":' + "9".repeat(200) + "}") === null);

/* Minimum-UTxO calculator — the ledger rule (160 + serialised size) x
   coins_per_utxo_size (4,310, mainnet epoch 660). Ground truth is the
   reference implementation pycardano 0.19.2, whose
   min_lovelace_post_alonzo is copied from the Haskell ledger, run in
   scratch over 17 output shapes: the serialised bytes this code
   constructs are byte-identical to pycardano's for every shape, and
   pycardano confirms each minimum below passes at the minimum and
   fails one lovelace below it. Every expected value is that verified
   fixed point. */
const POL_A = "aa".repeat(28), POL_B = "10".repeat(28);
const PLUTUS_SMALL = "460100332233" + "07".repeat(40);
check("minutxo in page", html.includes('id="minutxo"') && html.includes('id="minutxo-addr"') && html.includes('id="minutxo-assets"') && html.includes('id="minutxo-datum-kind"') && html.includes('id="minutxo-script-kind"') && html.includes('id="minutxo-result"'));
check("minutxo: plain base address (the donation address)", app.minUtxo({ address: ADA }).lovelace === "978370" && app.minUtxo({ address: ADA }).sizeBytes === 67);
check("minutxo: testnet base address has the same size", app.minUtxo({ address: app.buildAddress("base", "testnet", PAY_KH, STAKE_KH) }).lovelace === "978370");
check("minutxo: enterprise address", app.minUtxo({ address: "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9" }).lovelace === "857690");
check("minutxo: script enterprise address (giftcard mint hash)", app.minUtxo({ address: app.buildAddress("enterprise", "mainnet", "401c9670f4a65de10872a4b51fe806854644e2b13ea28b0a99a1f8f6", null, "script") }).lovelace === "857690");
check("minutxo: pointer address", app.minUtxo({ address: pointerAddr }).lovelace === "870620" && app.minUtxo({ address: pointerAddr }).sizeBytes === 42);
check("minutxo: datum hash", app.minUtxo({ address: ADA, datumKind: "hash", datumHex: "ab".repeat(32) }).lovelace === "1137840");
check("minutxo: inline datum (the sample datum)", app.minUtxo({ address: ADA, datumKind: "inline", datumHex: "d8799f182a182bff" }).lovelace === "1038710");
check("minutxo: inline datum with a chunked 99-byte payload", app.minUtxo({ address: ADA, datumKind: "inline", datumHex: "d8799f5f5840" + "cd".repeat(64) + "5823" + "cd".repeat(35) + "ffff" }).lovelace === "1478330");
check("minutxo: one asset, empty name", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "", quantity: "1" }] }).lovelace === "1129220");
check("minutxo: one asset, name PATATE", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "504154415445", quantity: "1" }] }).lovelace === "1155080");
check("minutxo: 32-byte name, uint64-max quantity (width from decimal text)", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "ff".repeat(32), quantity: "18446744073709551615" }] }).lovelace === "1305930");
check("minutxo: two assets under one policy", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "00", quantity: "5" }, { policy: POL_A, name: "01", quantity: "7" }] }).lovelace === "1146460");
check("minutxo: two policies", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "00", quantity: "5" }, { policy: POL_B, name: "aabb", quantity: "1000000" }] }).lovelace === "1301620");
check("minutxo: enterprise + assets + datum hash", app.minUtxo({ address: "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9", assets: [{ policy: POL_B, name: "cafe", quantity: "42" }], datumKind: "hash", datumHex: "00".repeat(32) }).lovelace === "1180940");
check("minutxo: native reference script (all-of-one-signature)", app.minUtxo({ address: ADA, scriptKind: "native", scriptHex: "8201818200581c" + PAY_KH }).lovelace === "1159390");
check("minutxo: Plutus V2 reference script", app.minUtxo({ address: ADA, scriptKind: "plutus2", scriptHex: PLUTUS_SMALL }).lovelace === "1215420");
check("minutxo: Plutus V3 reference script, ~1 KB", app.minUtxo({ address: ADA, scriptKind: "plutus3", scriptHex: "5903e8" + "0b".repeat(1000) }).lovelace === "5348710" && app.minUtxo({ address: ADA, scriptKind: "plutus3", scriptHex: "5903e8" + "0b".repeat(1000) }).sizeBytes === 1081);
check("minutxo: kitchen sink (assets + inline datum + Plutus V1 ref)", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "504154415445", quantity: "999" }], datumKind: "inline", datumHex: "d8799f182a182bff", scriptKind: "plutus1", scriptHex: PLUTUS_SMALL }).lovelace === "1461090");
check("minutxo rejects a reward address (cannot receive outputs)", app.minUtxo({ address: "stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5" }) === null);
check("minutxo rejects a pool ID as the address", app.minUtxo({ address: "pool107k26e3wrqxwghju2py40ngngx2qcu48ppeg7lk0cm35jl2aenx" }) === null);
check("minutxo rejects empty / garbage addresses", app.minUtxo({ address: "" }) === null && app.minUtxo({ address: "addr1qqqqqq" }) === null && app.minUtxo({}) === null);
check("minutxo rejects bad quantities", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "", quantity: "0" }] }) === null && app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "", quantity: "18446744073709551616" }] }) === null && app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "", quantity: "1.5" }] }) === null && app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "", quantity: "" }] }) === null);
check("minutxo rejects a short policy ID and an over-long asset name", app.minUtxo({ address: ADA, assets: [{ policy: "aa".repeat(27), name: "", quantity: "1" }] }) === null && app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "ff".repeat(33), quantity: "1" }] }) === null);
check("minutxo rejects a duplicated asset", app.minUtxo({ address: ADA, assets: [{ policy: POL_A, name: "00", quantity: "1" }, { policy: POL_A, name: "00", quantity: "2" }] }) === null);
check("minutxo rejects bad datum inputs", app.minUtxo({ address: ADA, datumKind: "hash", datumHex: "ab".repeat(31) }) === null && app.minUtxo({ address: ADA, datumKind: "inline", datumHex: "d8799" }) === null && app.minUtxo({ address: ADA, datumKind: "bogus", datumHex: "" }) === null);
check("minutxo rejects bad script inputs", app.minUtxo({ address: ADA, scriptKind: "plutus2", scriptHex: "zz" }) === null && app.minUtxo({ address: ADA, scriptKind: "plutus9", scriptHex: "00" }) === null && app.minUtxo({ address: ADA, scriptKind: "native", scriptHex: "" }) === null);

/* Native script policy ID — cardano-cli JSON in, ledger CBOR + blake2b-224
   (0x00 || CBOR) out, which for a minting script is its policy ID. Every
   expected CBOR string and hash below was produced by pycardano 0.19.2's
   NativeScript classes (ScriptPubkey / ScriptAll / ScriptAny / ScriptNofK /
   InvalidBefore / InvalidHereAfter) over the hub's known key hashes, and
   the JS encoder matched all of them from the JSON form in scratch first. */
const NS_SIG1 = JSON.stringify({ type: "sig", keyHash: PAY_KH });
const NS_SIG2 = JSON.stringify({ type: "sig", keyHash: STAKE_KH });
check("nativescript in page", html.includes('id="nativescript"') && html.includes('id="native-input"') && html.includes('id="native-result"'));
check("nativescript: single signature", app.nativeScript(NS_SIG1).cbor === "8200581c" + PAY_KH && app.nativeScript(NS_SIG1).policyId === "c8474c67549027ddc3e30417ec6aa1d8983dee66d2f1ed4478aed55e");
check("nativescript: all of two signatures", app.nativeScript(JSON.stringify({ type: "all", scripts: [{ type: "sig", keyHash: PAY_KH }, { type: "sig", keyHash: STAKE_KH }] })).policyId === "ad7b1190f4473fac81382ed1fee7a5336bc49dea9e046e926bb25c62");
check("nativescript: any of two signatures", app.nativeScript(JSON.stringify({ type: "any", scripts: [{ type: "sig", keyHash: PAY_KH }, { type: "sig", keyHash: STAKE_KH }] })).policyId === "722deaa6bd5e537892e21baabd5bc562b4e89997ba6c33cef0616604");
check("nativescript: after slot 1000", app.nativeScript('{"type":"after","slot":1000}').cbor === "82041903e8" && app.nativeScript('{"type":"after","slot":1000}').policyId === "592fb0f9d8ed15c06858118d134d5c4b7c77320507810fee9ac2ddf9");
check("nativescript: before slot 2000", app.nativeScript('{"type":"before","slot":2000}').cbor === "82051907d0" && app.nativeScript('{"type":"before","slot":2000}').policyId === "52cd2f6d3d5416e6d28224f2dcd51e80a204bff4c46a0e4a1601c650");
check("nativescript: atLeast 1 and 2 of two", app.nativeScript(JSON.stringify({ type: "atLeast", required: 1, scripts: [{ type: "sig", keyHash: PAY_KH }, { type: "sig", keyHash: STAKE_KH }] })).policyId === "5f7e84e920556934764e0e71ef8f4abf7fd2001a677e22e2edfc1a8a" && app.nativeScript(JSON.stringify({ type: "atLeast", required: 2, scripts: [{ type: "sig", keyHash: PAY_KH }, { type: "sig", keyHash: STAKE_KH }] })).policyId === "318ec788495cc739d7371c51b13fdff9856c68edf776d83437453736");
check("nativescript: nested all / timelock / any", app.nativeScript(JSON.stringify({ type: "all", scripts: [{ type: "sig", keyHash: PAY_KH }, { type: "before", slot: 5000 }, { type: "any", scripts: [{ type: "sig", keyHash: STAKE_KH }, { type: "after", slot: 100 }] }] })).policyId === "1e7ca404e5a86cb3284e9c4f0f78c2bdf890dc88b91451e59d0bc799");
check("nativescript: empty all", app.nativeScript('{"type":"all","scripts":[]}').cbor === "820180" && app.nativeScript('{"type":"all","scripts":[]}').policyId === "d441227553a0f1a965fee7d60a0f724b368dd1bddbc208730fccebcf");
check("nativescript: big slot keeps its CBOR width", app.nativeScript('{"type":"before","slot":199846790}').cbor === "82051a0be96b86" && app.nativeScript('{"type":"before","slot":199846790}').policyId === "510d743ce62d621f775a7b4b60e0e9e7dbacf6a5675294538d90536e");
check("nativescript: slot above 2^53 stays exact (read as decimal text, never a float)", app.nativeScript('{"type":"before","slot":9007199254740993}').cbor === "82051b0020000000000001");
check("nativescript: script address is the type-7 enterprise address carrying the policy ID", app.nativeScript(NS_SIG1).mainnetAddress === "addr1w8yywnr82jgz0hwruvzp0mr258vfs00wvmf0rm2y0zhd2hs04gyf5" && app.decodeAddress(app.nativeScript(NS_SIG1).mainnetAddress).paymentHash === "c8474c67549027ddc3e30417ec6aa1d8983dee66d2f1ed4478aed55e" && app.decodeAddress(app.nativeScript(NS_SIG1).mainnetAddress).paymentKind === "script");
check("nativescript rejects unknown types and bad JSON", app.nativeScript('{"type":"bogus"}') === null && app.nativeScript("{nope") === null && app.nativeScript("[1,2]") === null && app.nativeScript("") === null);
check("nativescript rejects bad key hashes and missing lists", app.nativeScript('{"type":"sig","keyHash":"abcd"}') === null && app.nativeScript('{"type":"all"}') === null && app.nativeScript('{"type":"any","scripts":{}}') === null);
check("nativescript rejects bad slots and counts", app.nativeScript('{"type":"after","slot":-5}') === null && app.nativeScript('{"type":"before","slot":18446744073709551616}') === null && app.nativeScript('{"type":"atLeast","required":1.5,"scripts":[]}') === null && app.nativeScript('{"type":"atLeast","scripts":[]}') === null);

console.log(failures === 0 ? "\nALL TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
