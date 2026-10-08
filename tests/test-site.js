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
check("all form controls labelled", ["addr", "ada", "lovelace", "q", "slot", "epoch", "stake-ada", "stake-rate", "stake-epochs", "pool-rewards", "pool-cost", "pool-margin", "pool-owner-stake", "pool-total-stake", "pool-member-stake", "fee-size", "exunit-mem", "exunit-steps", "refscript-size", "total-size", "total-mem", "total-steps", "total-ref", "pool-hex", "pool-bech32", "asset-policy", "asset-name", "unit-input", "hash-kind", "hash-bytes", "key-pay", "key-stake", "key-network", "decode-addr", "addrhex-bech32", "addrhex-hex", "gov-input", "cred-pay", "cred-pay-kind", "cred-stake", "cred-stake-kind", "cred-network", "cbor-input", "data-input", "txoutdecode-input", "mintdecode-input", "withdrawdecode-input", "inputsdecode-input", "signersdecode-input", "refinputsdecode-input", "collateraldecode-input", "certsdecode-input", "minutxo-addr", "minutxo-assets", "minutxo-datum-kind", "minutxo-datum-hex", "minutxo-script-kind", "minutxo-script-hex", "native-input"].every(id =>
  html.includes(`for="${id}"`) || html.includes(`aria-label`)));
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=33"));
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

/* total minimum fee — the ledger minimum is the exact sum of the three
   proven parts; hand-derived vectors (arithmetic from the component
   rules, not from the code) */
check("totalfee form present", html.includes('id="totalfeecalc"') && html.includes('id="totalfee-result"'));
check("total plain 200-byte tx = size fee only", JSON.stringify(app.totalTxFee("200", "0", "0", "0")) === JSON.stringify({ sizeFeeLovelace: "164181", exunitFeeLovelace: "0", refScriptFeeLovelace: "0", totalLovelace: "164181" }));
check("total script tx: 199381 + 93750 = 293131", app.totalTxFee("1000", "1000000", "500000000", "0").totalLovelace === "293131");
check("total rounding probes combined: 177381 + 1 + 2857686 = 3035068", app.totalTxFee("500", "1", "1", "128003").totalLovelace === "3035068" && app.totalTxFee("500", "1", "1", "128003").exunitFeeLovelace === "1" && app.totalTxFee("500", "1", "1", "128003").refScriptFeeLovelace === "2857686");
check("total at all per-tx maxima: 876277 + 1673050 + 6335648 = 8884975", app.totalTxFee("16384", "16500000", "10000000000", "204800").totalLovelace === "8884975");
check("total ref 1 byte adds exactly 15", app.totalTxFee("200", "0", "0", "1").totalLovelace === "164196");
check("total rejects size 0 and over-max size", app.totalTxFee("0", "0", "0", "0") === null && app.totalTxFee("16385", "0", "0", "0") === null);
check("total rejects over-cap execution units", app.totalTxFee("200", "16500001", "0", "0") === null && app.totalTxFee("200", "0", "10000000001", "0") === null);
check("total rejects ref scripts over the per-tx limit (impossible tx, though the standalone tool prices it flagged)", app.totalTxFee("200", "0", "0", "204801") === null);
check("total rejects empty, garbage and fractional in any field", app.totalTxFee("", "0", "0", "0") === null && app.totalTxFee("200", "", "0", "0") === null && app.totalTxFee("200", "0", "0", "abc") === null && app.totalTxFee("200.5", "0", "0", "0") === null);
check("total is the exact sum of its parts on assorted inputs", [["300", "123456", "987654321", "999"], ["1", "17", "0", "25601"], ["999", "16500000", "1", "76800"]].every(function (c) {
  var t = app.totalTxFee(c[0], c[1], c[2], c[3]);
  return t && t.totalLovelace === (BigInt(app.minFee(c[0]).feeLovelace) + BigInt(app.exunitCost(c[1], c[2]).costLovelace) + BigInt(app.refScriptFee(c[3]).feeLovelace)).toString();
}));

/* ledger deposits — parameters verified live via Koios epoch_params
   epoch 660 on 2026-10-07 (key_deposit 2000000, pool_deposit 500000000,
   drep_deposit 500000000, gov_action_deposit 100000000000); vectors are
   hand-derived lovelace arithmetic from those parameters */
check("deposit form present", html.includes('id="depositcalc"') && html.includes('id="deposit-result"'));
check("one stake registration = 2 ADA", JSON.stringify(app.depositTotal("1", "0", "0", "0")) === JSON.stringify({ stakeLovelace: "2000000", poolLovelace: "0", drepLovelace: "0", govLovelace: "0", totalLovelace: "2000000" }));
check("one new pool = 500 ADA", app.depositTotal("0", "1", "0", "0").totalLovelace === "500000000");
check("one DRep = 500 ADA", app.depositTotal("0", "0", "1", "0").totalLovelace === "500000000");
check("one governance action = 100,000 ADA", app.depositTotal("0", "0", "0", "1").totalLovelace === "100000000000");
check("combo 2 stake + 1 pool + 1 drep + 1 gov = 101,004 ADA", app.depositTotal("2", "1", "1", "1").totalLovelace === "101004000000");
check("3 stake + 2 drep = 1,006 ADA", app.depositTotal("3", "0", "2", "0").totalLovelace === "1006000000");
check("all zero counts = 0", app.depositTotal("0", "0", "0", "0").totalLovelace === "0");
check("count cap boundary: 10000 stake = 20,000 ADA", app.depositTotal("10000", "0", "0", "0").totalLovelace === "20000000000");
check("deposit rejects empty, garbage, fractional, negative and over-cap in any field", app.depositTotal("", "0", "0", "0") === null && app.depositTotal("1", "", "0", "0") === null && app.depositTotal("1", "0", "abc", "0") === null && app.depositTotal("1", "0", "0", "1.5") === null && app.depositTotal("-1", "0", "0", "0") === null && app.depositTotal("1", "0", "0", "10001") === null);
check("deposit total is the exact sum of its parts on assorted inputs", [["5", "3", "0", "2"], ["0", "7", "7", "0"], ["9999", "1", "1", "1"], ["10", "0", "0", "10"]].every(function (c) {
  var t = app.depositTotal(c[0], c[1], c[2], c[3]);
  return t && t.totalLovelace === (BigInt(t.stakeLovelace) + BigInt(t.poolLovelace) + BigInt(t.drepLovelace) + BigInt(t.govLovelace)).toString();
}));

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

/* Transaction ID — blake2b-256 of the body CBOR, nothing else. Bodies and
   full transactions below were built by pycardano 0.19.2 and its
   Transaction.id agreed with every expected ID in scratch first; the
   empty-draft vector's expected hash came from Python hashlib. Bodies
   reuse the hub's known key hashes in a base address output. */
const TX_BODY1 = "a30081825820000000000000000000000000000000000000000000000000000000000000000000018182583901" + PAY_KH + STAKE_KH + "1a001e8480021a00030d40";
const TX_ID1 = "4b999e818b9748f5a6dc41505e8b93ee10df99c9b4f860f8d70034ca219cddbf";
const TX_BODY2 = "a40082825820" + "00".repeat(32) + "00825820" + "ab".repeat(32) + "03018282583901" + PAY_KH + STAKE_KH + "1a001e848082583901" + PAY_KH + STAKE_KH + "1a001e8480021a00029810031a0be9bfc7";
const TX_ID2 = "c75202a9d2dd4c2e3a236c7b9c053fd8402f6df2524b88e33a95e52a44dbeb0d";
const TX_BODY3 = "a60081825820" + "00".repeat(32) + "00018182583901" + PAY_KH + STAKE_KH + "1a001e8480021a0002bf20031a0bebc200075820" + "11".repeat(32) + "081a0bdc7fc0";
const TX_ID3 = "8100226584ea4826cd2e46f860d06370e69e3df4ebc9e1fd43d3756362062639";
check("txid form present", html.includes('id="txidcalc"') && html.includes('id="txid-input"') && html.includes('id="txid-result"'));
check("txid: simple body (pycardano)", app.txId(TX_BODY1).txId === TX_ID1 && app.txId(TX_BODY1).source === "body");
check("txid: body with ttl and two inputs/outputs (pycardano)", app.txId(TX_BODY2).txId === TX_ID2);
check("txid: body with aux data hash, validity start and ttl (pycardano)", app.txId(TX_BODY3).txId === TX_ID3);
check("txid: full transaction yields its body's ID", app.txId("84" + TX_BODY1 + "a0f5f6").txId === TX_ID1 && app.txId("84" + TX_BODY1 + "a0f5f6").source === "transaction" && app.txId("84" + TX_BODY3 + "a0f5f6").txId === TX_ID3);
check("txid: empty draft body {0:[],1:[],2:5} (hashlib)", app.txId("a3008001800205").txId === "af13324af31f408113a777515bd5c60f04075c66d4aadc26e3ee90d043665e2b");
check("txid: 0x prefix and surrounding space tolerated", app.txId(" 0x" + TX_BODY1 + " ").txId === TX_ID1);
check("txid rejects non-body CBOR (datum, plain array, map without the required entries)", app.txId("d8799f182a182bff") === null && app.txId("8100") === null && app.txId("a10001") === null && app.txId("a30000018180021a00030d40") === null);
check("txid rejects malformed transactions (trailing bytes, 2-element array, witness set not a map, is_valid not a bool)", app.txId(TX_BODY1 + "00") === null && app.txId("82" + TX_BODY1 + "a0") === null && app.txId("84" + TX_BODY1 + "80f5f6") === null && app.txId("84" + TX_BODY1 + "a000f6") === null);
check("txid rejects garbage, empty and oversize input", app.txId("zzzz") === null && app.txId("") === null && app.txId("00".repeat(16385)) === null);

/* Transaction inspector — Conway body decode, field numbering per the
   ledger CDDL. Bodies A/B/C were built by pycardano 0.19.2 and matched
   field-for-field in scratch (txinspect_proto.js). The REAL_TX vector is
   a genuine mainnet Plutus transaction fetched from Koios (block
   14,040,547, epoch 660): its inputs/collateral/signers/reference inputs
   are CBOR sets (tag 258), its outputs use the Alonzo array form, and its
   computed transaction ID must equal its on-chain hash — the ground
   truth no library mediates. */
const TXINSP_A = "a40082825820111111111111111111111111111111111111111111111111111111111111111100825820222222222222222222222222222222222222222222222222222222222222222203018282583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a004c4b4082581d61ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d1a000eedc2021a00029810031a0bebc200";
const TXINSP_B = "a30081825820333333333333333333333333333333333333333333333333333333333333333301018383583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82821a001e8480a1581caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1465041544154450758204444444444444444444444444444444444444444444444444444444444444444a300583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82011a0016e360028201d81848d8799f182a182bffa300583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82011a0016e36003d818582582008201818200581cef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d021a00030d40";
const TXINSP_C = "b00081825820555555555555555555555555555555555555555555555555555555555555555500018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a002dc6c0021a0002bf20031a0bea3b60048182008200581cef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d05a1581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a0012d6870758209999999999999999999999999999999999999999999999999999999999999999081a0be8b4c009a1581caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2434e45571864434f4c44240b582088888888888888888888888888888888888888888888888888888888888888880d818258206666666666666666666666666666666666666666666666666666666666666666020e81581cef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d0f011082581d61ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d1a00061a80111a0007a1201281825820777777777777777777777777777777777777777777777777777777777777777700";
const REAL_TX = "84ad00d90102838258201df884688be3d4c3c13a82123d614c465b0ba93b3f7433f1c33b1d258ee40e40008258204faa94b0846a4b83fc60bd884c3a6509de6a8b554873d409f20a786170b351660182582097afc9515414ff0f521da97d636fb9ff72a85d04a421d7d953a309d93f84ab800301838258390179d5c5fce167cde6ca79f7be9cbea7deac68e6065cfc453e71fcc03aacf9d9b29ccf585ec8bff19bf6cc26a35ae3c0146efb66af6372630e821a001e8480a1581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5a14553555247451b0000000185deee21a300583911ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b52563c5410bff6a0d43ccebb7c37e1f69f5eb260552521adff33b9c201821b0000004a2a412556a2581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5a14553555247451b000004bbd83d2e43581cf5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca2434d5350015820ab2bc7cba8f1e4edbfbb83b630082ba6d711b7059dad402baa636d0e355732d51b7ffffed7cfc32c6b028201d818587fd8799fd8799fd87a9f581c1eae96baf29e27682ea3f815aba361a0c6059d45e4bfbe95bbd2f44affffd8799f4040ffd8799f581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5455355524745ff1b00000128303cd39e1b0000004a285d7ea41b000004bbbc9461160505d8799f190682ffd87980ff825839015b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b533b9586f0fb9aafd578e0d0154e9478d23614e736eb39d1a30d8a991a082b3931021a000a2d6a031a0be9cf6e05a1581df11eae96baf29e27682ea3f815aba361a0c6059d45e4bfbe95bbd2f44a000758205160f88b929bf8a6c57c285b889488f9137c0ef3cfd0bcf408a10020e69146d5081a0be9ceba0b5820d04505dddec5ddfd1fba346b85f9108444ef354aa49870027119d6796a19cba50dd901028182582097afc9515414ff0f521da97d636fb9ff72a85d04a421d7d953a309d93f84ab80030ed9010281581c5b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b10825839015b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b533b9586f0fb9aafd578e0d0154e9478d23614e736eb39d1a30d8a991a07ca96db111a004c4b4012d90102848258200dc17712e37a4e741767db2f90d4ffbf69faf88b9bed4c47864f7bd912924bea00825820cf4ecddde0d81f9ce8fcc881a85eb1f8ccdaf6807f03fea4cd02da896a621776008258202536194d2a976370a932174c10975493ab58fd7c16395d50e62b7c0e1949baea00825820d46bd227bd2cf93dedd22ae9b6d92d30140cf0d68b756f6608e38d680c61ad1700a200d9010281825820c5d63d7dc066df52592135b6d3cb4f3470d06f7bdd4b2d2e32eb59ca3782662f58400b4af3e23a0c5687c3f3ecd2157ba8790bb7bed6d3f21e6ce5cbccc96bb5edd5c8b3d3d9a38642897d797534c7728b32d259dea8d1f6ed0d6ec76ce4c880d9010583840000d87980821962d91a007cc793840001d87980821a00012dfc1a0166fa60840300d8799f009f1a001e8480ff4100d87a809fd87a80ffff821a00143bbd1a197896b8f5a11902a2a1636d736781774d696e737761703a204f72646572204578656375746564";
const REAL_BODY = "ad00d90102838258201df884688be3d4c3c13a82123d614c465b0ba93b3f7433f1c33b1d258ee40e40008258204faa94b0846a4b83fc60bd884c3a6509de6a8b554873d409f20a786170b351660182582097afc9515414ff0f521da97d636fb9ff72a85d04a421d7d953a309d93f84ab800301838258390179d5c5fce167cde6ca79f7be9cbea7deac68e6065cfc453e71fcc03aacf9d9b29ccf585ec8bff19bf6cc26a35ae3c0146efb66af6372630e821a001e8480a1581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5a14553555247451b0000000185deee21a300583911ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b52563c5410bff6a0d43ccebb7c37e1f69f5eb260552521adff33b9c201821b0000004a2a412556a2581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5a14553555247451b000004bbd83d2e43581cf5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca2434d5350015820ab2bc7cba8f1e4edbfbb83b630082ba6d711b7059dad402baa636d0e355732d51b7ffffed7cfc32c6b028201d818587fd8799fd8799fd87a9f581c1eae96baf29e27682ea3f815aba361a0c6059d45e4bfbe95bbd2f44affffd8799f4040ffd8799f581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5455355524745ff1b00000128303cd39e1b0000004a285d7ea41b000004bbbc9461160505d8799f190682ffd87980ff825839015b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b533b9586f0fb9aafd578e0d0154e9478d23614e736eb39d1a30d8a991a082b3931021a000a2d6a031a0be9cf6e05a1581df11eae96baf29e27682ea3f815aba361a0c6059d45e4bfbe95bbd2f44a000758205160f88b929bf8a6c57c285b889488f9137c0ef3cfd0bcf408a10020e69146d5081a0be9ceba0b5820d04505dddec5ddfd1fba346b85f9108444ef354aa49870027119d6796a19cba50dd901028182582097afc9515414ff0f521da97d636fb9ff72a85d04a421d7d953a309d93f84ab80030ed9010281581c5b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b10825839015b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b533b9586f0fb9aafd578e0d0154e9478d23614e736eb39d1a30d8a991a07ca96db111a004c4b4012d90102848258200dc17712e37a4e741767db2f90d4ffbf69faf88b9bed4c47864f7bd912924bea00825820cf4ecddde0d81f9ce8fcc881a85eb1f8ccdaf6807f03fea4cd02da896a621776008258202536194d2a976370a932174c10975493ab58fd7c16395d50e62b7c0e1949baea00825820d46bd227bd2cf93dedd22ae9b6d92d30140cf0d68b756f6608e38d680c61ad1700";
const REAL_HASH = "b64551255acfaa9d709b862e0df7e4d2d836b29735213bb6b70558fe6a673f28";
check("txinspect form present", html.includes('id="txinspect"') && html.includes('id="txinspect-input"') && html.includes('id="txinspect-result"'));
check("txid: set-encoded (tag 258) inputs accepted — real mainnet tx ID equals its on-chain hash", app.txId(REAL_TX).txId === REAL_HASH && app.txId(REAL_TX).source === "transaction" && app.txId(REAL_BODY).txId === REAL_HASH && app.txId(REAL_BODY).source === "body");
check("txinspect A: simple body (pycardano)", (() => { const r = app.inspectTx(TXINSP_A); return r !== null && r.source === "body" && r.inputs.length === 2 && r.inputs[1].txHash === "2222222222222222222222222222222222222222222222222222222222222222" && r.inputs[1].index === 3 && r.outputs[0].address === ADA && r.outputs[0].lovelace === "5000000" && r.outputs[1].address === "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9" && r.outputTotal === "5978370" && r.fee === "170000" && r.ttl === 200000000 && r.mint.length === 0 && r.certificates === 0; })());
check("txinspect B: assets, datum hash, inline datum, native script ref (pycardano)", (() => { const r = app.inspectTx(TXINSP_B); return r !== null && r.outputs[0].assets.length === 1 && r.outputs[0].assets[0].quantity === "7" && r.outputs[0].assets[0].nameText === "PATATE" && r.outputs[0].datum.kind === "hash" && r.outputs[0].datum.hash === "4444444444444444444444444444444444444444444444444444444444444444" && r.outputs[1].datum.kind === "inline" && r.outputs[1].datum.hex === "d8799f182a182bff" && r.outputs[2].scriptRef === "native" && r.outputTotal === "5000000"; })());
check("txinspect C: mint/burn, withdrawal, signers, collateral, hashes, cert (pycardano)", (() => { const r = app.inspectTx(TXINSP_C); return r !== null && r.mint.length === 2 && r.mint[0].quantity === "100" && r.mint[0].nameText === "NEW" && r.mint[1].quantity === "-5" && r.withdrawals.length === 1 && r.withdrawals[0].lovelace === "1234567" && r.withdrawals[0].address === "stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5" && r.requiredSigners.length === 1 && r.requiredSigners[0] === PAY_KH && r.networkId === 1 && r.scriptDataHash === "8888888888888888888888888888888888888888888888888888888888888888" && r.auxDataHash === "9999999999999999999999999999999999999999999999999999999999999999" && r.totalCollateral === "500000" && r.collateralReturn.address === "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9" && r.collateral[0].txHash === "6666666666666666666666666666666666666666666666666666666666666666" && r.collateral[0].index === 2 && r.referenceInputs[0].txHash === "7777777777777777777777777777777777777777777777777777777777777777" && r.certificates === 1 && r.validityStart === 199800000; })());
check("txinspect REAL: mainnet Plutus tx decoded end-to-end (Koios ground truth)", (() => { const r = app.inspectTx(REAL_TX); return r !== null && r.txId === REAL_HASH && r.source === "transaction" && r.fee === "666986" && r.ttl === 199872366 && r.validityStart === 199872186 && r.scriptDataHash === "d04505dddec5ddfd1fba346b85f9108444ef354aa49870027119d6796a19cba5" && r.auxDataHash === "5160f88b929bf8a6c57c285b889488f9137c0ef3cfd0bcf408a10020e69146d5" && r.collateral.length === 1 && r.collateral[0].txHash === "97afc9515414ff0f521da97d636fb9ff72a85d04a421d7d953a309d93f84ab80" && r.collateral[0].index === 3 && r.requiredSigners[0] === "5b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b" && r.totalCollateral === "5000000" && r.collateralReturn.lovelace === "130717403" && r.collateralReturn.address === "addr1q9dhugez3ka82k2kgh7r2lg0j7aztr8uell46kydfwu3vk6n8w2cdu8mn2ha278q6q25a9rc6gmpfeekavuargcd32vsvxhl7e" && r.referenceInputs.length === 4 && r.inputs[0].txHash === "1df884688be3d4c3c13a82123d614c465b0ba93b3f7433f1c33b1d258ee40e40" && r.withdrawals[0].address === "stake17y02a946720zw6pw50upt2arvxsvvpvaghjtl054h0f0gjsfyjz59" && r.withdrawals[0].lovelace === "0" && r.outputTotal === "318675542791" && r.outputs.some(function (o) { return o.datum.kind === "inline"; }); })());
check("txinspect rejects non-transactions and malformed bodies", app.inspectTx("d8799f182a182bff") === null && app.inspectTx("") === null && app.inspectTx("zzzz") === null && app.inspectTx("a3008001800220") === null && app.inspectTx("a300800181000205") === null && app.inspectTx("a40080008001800205") === null && app.inspectTx(REAL_TX + "00") === null);

/* --- value decoder ---
   Vectors are pycardano 0.19.2 Value serialisations, generated and
   self-verified in scratch (value_py.py / value_vectors.json): its
   encoder emits exactly these bytes, cbor2 confirms the structure,
   and Value.from_cbor decodes the array forms back. NOTE the
   uint64-max quantity below is a STRING literal on purpose — routing
   18446744073709551615 through a JS number rounds it to
   18446744073709552000 (the float trap from the Data-encoder run),
   and the scratch A/B driver failed on exactly that before the
   baseline was corrected. pycardano quirk recorded in README:
   Value.from_cbor refuses the bare-coin form its own encoder emits;
   the ledger CDDL (value = coin / [coin, multiasset]) allows it. */
const V_POL = "7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc373";
check("valuedecode form present", html.includes('id="valuedecode"') && html.includes('id="valuedecode-input"') && html.includes('id="valuedecode-result"'));
check("valuedecode coin-only (pycardano)", (() => { const r = app.parseValueCbor("1a000eedc2"); return r !== null && r.lovelace === "978370" && r.assetCount === 0 && r.policyCount === 0; })());
check("valuedecode zero coin (pycardano)", (() => { const r = app.parseValueCbor("00"); return r !== null && r.lovelace === "0" && r.assets.length === 0; })());
check("valuedecode max-supply coin exact (pycardano)", (() => { const r = app.parseValueCbor("1b009fdf42f6e48000"); return r !== null && r.lovelace === "45000000000000000"; })());
check("valuedecode one asset PATATE (pycardano)", (() => { const r = app.parseValueCbor("821a001e8480a1581c" + V_POL + "a14650415441544501"); return r !== null && r.lovelace === "2000000" && r.assetCount === 1 && r.assets[0].policy === V_POL && r.assets[0].name === "504154415445" && r.assets[0].nameText === "PATATE" && r.assets[0].quantity === "1"; })());
check("valuedecode empty name at uint64-max quantity, exact as text (pycardano)", (() => { const r = app.parseValueCbor("821a004c4b40a1581c" + V_POL + "a1401bffffffffffffffff"); return r !== null && r.lovelace === "5000000" && r.assets[0].name === "" && r.assets[0].quantity === "18446744073709551615"; })());
check("valuedecode two policies, sorted, non-UTF8 name has no text (pycardano)", (() => { const r = app.parseValueCbor("821a075bcd15a2581c" + V_POL + "a1465041544154451a000f4240581c" + "aa".repeat(28) + "a243fffe0018635820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f07"); return r !== null && r.lovelace === "123456789" && r.assetCount === 3 && r.policyCount === 2 && r.assets[0].policy === V_POL && r.assets[0].quantity === "1000000" && r.assets[1].name === "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" && r.assets[1].quantity === "7" && r.assets[2].name === "fffe00" && r.assets[2].nameText === null && r.assets[2].quantity === "99"; })());
check("valuedecode empty multiasset map matches the inspector's reading", (() => { const r = app.parseValueCbor("8201a0"); return r !== null && r.lovelace === "1" && r.assetCount === 0; })());
check("valuedecode rejects negative coin, mint-shaped quantities, oversize parts", app.parseValueCbor("20") === null && app.parseValueCbor("8220a0") === null && app.parseValueCbor("8201a1581c" + V_POL + "a14650415441544500") === null && app.parseValueCbor("8201a1581c" + V_POL + "a14650415441544520") === null && app.parseValueCbor("8201a1581b" + V_POL.slice(0, 54) + "a0") === null && app.parseValueCbor("8201a1581c" + V_POL + "a15821" + "00".repeat(33) + "01") === null);
check("valuedecode rejects duplicate keys, trailing bytes, non-values", app.parseValueCbor("8201a2581c" + V_POL + "a14650415441544501" + "581c" + V_POL + "a14650415441544502") === null && app.parseValueCbor("8201a1581c" + V_POL + "a24650415441544501" + "4650415441544502") === null && app.parseValueCbor("1a000eedc2" + "00") === null && app.parseValueCbor("d8799f182a182bff") === null && app.parseValueCbor("6568656c6c6f") === null && app.parseValueCbor("8301a001") === null && app.parseValueCbor("") === null && app.parseValueCbor("zzzz") === null);

/* transaction output decoder — a standalone output's CBOR, in both
   serialisations. All hex vectors are pycardano 0.19.2
   TransactionOutput serialisations (scratch txout_py.py /
   txout_vectors.json): ADDR_BYTES is the donation address's raw bytes
   (01 || PAY_KH || STAKE_KH, the hashes proven in the builder tests),
   ENT_BYTES its enterprise form (61 || PAY_KH). Deliberate
   strictness beyond the inspector's internal parser: the address
   must be a Shelley payment address (reward rejected), and repeated
   map keys (output keys, policies, asset names) are rejected. */
const ADDR_BYTES = "583901" + "ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d" + "ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82";
check("txoutdecode form present", html.includes('id="txoutdecode"') && html.includes('id="txoutdecode-input"') && html.includes('id="txoutdecode-result"'));
check("txoutdecode babbage coin-only (pycardano)", (() => { const r = app.parseTxOutCbor("a200" + ADDR_BYTES + "011a000eedc2"); return r !== null && r.format === "babbage" && r.address === ADA && r.lovelace === "978370" && r.assets.length === 0 && r.datum.kind === "none" && r.scriptRef === null; })());
check("txoutdecode babbage asset + datum hash (pycardano)", (() => { const r = app.parseTxOutCbor("a300" + ADDR_BYTES + "01821a001e8480a1581c" + V_POL + "a146504154415445050282005820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"); return r !== null && r.lovelace === "2000000" && r.assets.length === 1 && r.assets[0].nameText === "PATATE" && r.assets[0].quantity === "5" && r.datum.kind === "hash" && r.datum.hash === "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"; })());
check("txoutdecode babbage inline datum (pycardano)", (() => { const r = app.parseTxOutCbor("a300" + ADDR_BYTES + "011a002dc6c0028201d81848d8799f182a182bff"); return r !== null && r.lovelace === "3000000" && r.datum.kind === "inline" && r.datum.hex === "d8799f182a182bff"; })());
check("txoutdecode babbage Plutus V2 script ref (pycardano)", (() => { const r = app.parseTxOutCbor("a300" + ADDR_BYTES + "011a003d090003d8184d82024a49480100002221200101"); return r !== null && r.lovelace === "4000000" && r.scriptRef === "plutus2"; })());
check("txoutdecode babbage native script ref (pycardano)", (() => { const r = app.parseTxOutCbor("a300" + ADDR_BYTES + "011a0044aa2003d818582582008201818200581c" + "aa".repeat(28)); return r !== null && r.lovelace === "4500000" && r.scriptRef === "native"; })());
check("txoutdecode alonzo coin-only (pycardano)", (() => { const r = app.parseTxOutCbor("82" + ADDR_BYTES + "1a000eedc2"); return r !== null && r.format === "alonzo" && r.address === ADA && r.lovelace === "978370" && r.datum.kind === "none"; })());
check("txoutdecode alonzo datum hash (pycardano)", (() => { const r = app.parseTxOutCbor("83" + ADDR_BYTES + "1a001e84805820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"); return r !== null && r.format === "alonzo" && r.lovelace === "2000000" && r.datum.kind === "hash"; })());
check("txoutdecode babbage enterprise address (pycardano)", (() => { const r = app.parseTxOutCbor("a200581d61" + "ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d" + "011a0016e360"); return r !== null && r.address === "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9" && r.lovelace === "1500000"; })());
check("txoutdecode rejects reward address, bare value, trailing bytes", app.parseTxOutCbor("a200581de1" + "ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82" + "011a000eedc2") === null && app.parseTxOutCbor("1a000eedc2") === null && app.parseTxOutCbor("a200" + ADDR_BYTES + "011a000eedc2" + "00") === null && app.parseTxOutCbor("") === null && app.parseTxOutCbor("zzzz") === null);
check("txoutdecode rejects duplicate and unknown map keys", app.parseTxOutCbor("a300" + ADDR_BYTES + "00" + ADDR_BYTES + "011a000eedc2") === null && app.parseTxOutCbor("a300" + ADDR_BYTES + "011a000eedc20400") === null);

/* mint / burn decoder — a standalone mint field's CBOR (body key 9).
   All hex vectors are pycardano 0.19.2 MultiAsset serialisations
   (scratch mint_py.py / mint_vectors.json), self-verified by
   MultiAsset.from_cbor round-trip in the generator. The rule is the
   Conway CDDL's, fetched from IntersectMBO/cardano-ledger this run:
   mint = {+ policy_id => {+ asset_name => nonzero_int64}} — hence the
   empty map, an empty per-policy map and a zero quantity are all
   rejected even though pycardano serialises an empty MultiAsset to
   a0 and silently drops zero-quantity assets. NOTE the int64
   extremes below are STRING literals on purpose — routing
   9223372036854775807 through a JS number (or a plain JSON baseline)
   rounds it (the float trap); the scratch A/B driver failed on
   exactly that before its baseline was corrected. */
check("mintdecode form present", html.includes('id="mintdecode"') && html.includes('id="mintdecode-input"') && html.includes('id="mintdecode-result"'));
check("mintdecode pure mint PATATE +100 (pycardano)", (() => { const r = app.parseMintCbor("a1581c" + V_POL + "a1465041544154451864"); return r !== null && r.assetCount === 1 && r.policyCount === 1 && r.mintCount === 1 && r.burnCount === 0 && r.assets[0].policy === V_POL && r.assets[0].nameText === "PATATE" && r.assets[0].quantity === "100" && r.assets[0].action === "mint"; })());
check("mintdecode pure burn, empty name, -5 (pycardano)", (() => { const r = app.parseMintCbor("a1581c" + V_POL + "a14024"); return r !== null && r.assets[0].name === "" && r.assets[0].quantity === "-5" && r.assets[0].action === "burn" && r.burnCount === 1; })());
check("mintdecode mixed two policies, mint + burn (pycardano)", (() => { const r = app.parseMintCbor("a2581c" + V_POL + "a1465041544154451a000f4240581c" + "aa".repeat(28) + "a243fffe0038625820" + "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f07"); return r !== null && r.assetCount === 3 && r.policyCount === 2 && r.mintCount === 2 && r.burnCount === 1 && r.assets[0].quantity === "1000000" && r.assets[2].quantity === "-99" && r.assets[2].nameText === null && r.assets[2].action === "burn"; })());
check("mintdecode int64 max exact as text (pycardano)", (() => { const r = app.parseMintCbor("a1581c" + V_POL + "a1434d41581b7fffffffffffffff"); return r !== null && r.assets[0].quantity === "9223372036854775807"; })());
check("mintdecode int64 min exact as text (pycardano)", (() => { const r = app.parseMintCbor("a1581c" + V_POL + "a1434d494e3b7fffffffffffffff"); return r !== null && r.assets[0].quantity === "-9223372036854775808"; })());
check("mintdecode rejects zero quantity and out-of-int64 quantities", app.parseMintCbor("a1581c" + V_POL + "a1415800") === null && app.parseMintCbor("a1581c" + "aa".repeat(28) + "a141591b8000000000000000") === null && app.parseMintCbor("a1581c" + "aa".repeat(28) + "a141593b8000000000000000") === null);
check("mintdecode rejects empty mint and empty policy maps (CDDL +)", app.parseMintCbor("a0") === null && app.parseMintCbor("a1581c" + "aa".repeat(28) + "a0") === null);
check("mintdecode rejects value shapes, bare coin, trailing bytes", app.parseMintCbor("821a001e8480a1581c" + V_POL + "a14650415441544501") === null && app.parseMintCbor("1a000eedc2") === null && app.parseMintCbor("a1581c" + V_POL + "a1465041544154451864" + "00") === null && app.parseMintCbor("") === null && app.parseMintCbor("zzzz") === null);
check("mintdecode rejects duplicate keys and oversize parts", app.parseMintCbor("a2581c" + "aa".repeat(28) + "a1415801" + "581c" + "aa".repeat(28) + "a1415802") === null && app.parseMintCbor("a1581c" + "aa".repeat(28) + "a2415801415802") === null && app.parseMintCbor("a1581b" + "aa".repeat(27) + "a1415801") === null && app.parseMintCbor("a1581c" + "aa".repeat(28) + "a15821" + "00".repeat(33) + "01") === null);

/* withdrawals decoder — a standalone withdrawals field's CBOR (body key 5).
   All hex vectors are pycardano 0.19.2 Withdrawals serialisations
   (scratch withdraw_gen.py / withdraw_vectors.json; keys are raw
   reward-address bytes), self-verified by Withdrawals.from_cbor
   round-trip in the generator. The rule is the Conway CDDL's,
   fetched from IntersectMBO/cardano-ledger this run:
   withdrawals = {+ reward_account => coin}, coin = uint — hence
   the empty map is rejected (the "+") but a ZERO amount is
   accepted, the exact opposite of the mint field's nonzero rule;
   don't "align" the two. Keys must be Shelley reward addresses
   (29 bytes, type 14 key / 15 script), proven through decodeAddress. */
const REW_MAIN = "stake1u8ke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsfy7dg5";
const REW_SCRIPT = "stake17xerse3s7xepp3vdper0zvhfxxek9slnwd59zxqp3exe2mcnf80yw";
const REW_TEST = "stake_test1urke0ya7at0s22z255al95huahj7xejt7t27mj4ql6rzeqsww50vf";
const REW_BYTES = "581de1" + STAKE_KH;
check("withdrawdecode form present", html.includes('id="withdrawdecode"') && html.includes('id="withdrawdecode-input"') && html.includes('id="withdrawdecode-result"'));
check("withdrawdecode single mainnet key (pycardano)", (() => { const r = app.parseWithdrawalsCbor("a1" + REW_BYTES + "1a001e8480"); return r !== null && r.count === 1 && r.totalLovelace === "2000000" && r.entries[0].address === REW_MAIN && r.entries[0].stakeKind === "key" && r.entries[0].network === "mainnet" && r.entries[0].stakeHash === STAKE_KH && r.entries[0].lovelace === "2000000"; })());
check("withdrawdecode mixed key + script pair, total (pycardano)", (() => { const r = app.parseWithdrawalsCbor("a2581de1" + STAKE_KH + "1a0016e360581df1" + REDEEM_SH + "1a0ee6b280"); return r !== null && r.count === 2 && r.totalLovelace === "251500000" && r.entries.some(e => e.address === REW_SCRIPT && e.stakeKind === "script" && e.lovelace === "250000000"); })());
check("withdrawdecode testnet key (pycardano)", (() => { const r = app.parseWithdrawalsCbor("a1581de0" + STAKE_KH + "1a075bcd15"); return r !== null && r.entries[0].address === REW_TEST && r.entries[0].network === "testnet" && r.entries[0].lovelace === "123456789"; })());
check("withdrawdecode uint64-max exact as text (pycardano)", (() => { const r = app.parseWithdrawalsCbor("a1" + REW_BYTES + "1bffffffffffffffff"); return r !== null && r.entries[0].lovelace === "18446744073709551615" && r.totalLovelace === "18446744073709551615"; })());
check("withdrawdecode zero amount accepted (CDDL coin, not nonzero)", (() => { const r = app.parseWithdrawalsCbor("a1" + REW_BYTES + "00"); return r !== null && r.entries[0].lovelace === "0" && r.totalLovelace === "0"; })());
check("withdrawdecode rejects empty map (CDDL +)", app.parseWithdrawalsCbor("a0") === null);
check("withdrawdecode rejects payment address and negative amount", app.parseWithdrawalsCbor("a1581d61" + STAKE_KH + "01") === null && app.parseWithdrawalsCbor("a1" + REW_BYTES + "20") === null);
check("withdrawdecode rejects duplicate accounts and trailing bytes", app.parseWithdrawalsCbor("a2" + REW_BYTES + "01" + REW_BYTES + "02") === null && app.parseWithdrawalsCbor("a1" + REW_BYTES + "1a001e8480" + "00") === null && app.parseWithdrawalsCbor("") === null && app.parseWithdrawalsCbor("zzzz") === null);
check("withdrawdecode rejects bad network, short key, mint/value shapes", app.parseWithdrawalsCbor("a1581de3" + STAKE_KH + "01") === null && app.parseWithdrawalsCbor("a1581ce1" + STAKE_KH.slice(0, 54) + "01") === null && app.parseWithdrawalsCbor("1a000eedc2") === null && app.parseWithdrawalsCbor("a1581c" + "aa".repeat(28) + "a1465041544154451864") === null);


/* --- transaction inputs decoder: pycardano TransactionBody field 0 --- */
const IN_H1 = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const IN_H2 = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const IN_ONE = "825820" + IN_H1 + "00";
check("inputsdecode form present", html.includes('id="inputsdecode"') && html.includes('id="inputsdecode-input"') && html.includes('id="inputsdecode-result"'));
check("inputsdecode single input (pycardano)", (() => { const r = app.parseInputsCbor("81" + IN_ONE); return r !== null && r.count === 1 && r.entries[0].txHash === IN_H1 && r.entries[0].index === 0 && r.entries[0].ref === IN_H1 + "#0"; })());
check("inputsdecode two inputs incl. index max, order kept (pycardano)", (() => { const r = app.parseInputsCbor("82" + IN_ONE + "825820" + IN_H2 + "19ffff"); return r !== null && r.count === 2 && r.entries[1].txHash === IN_H2 && r.entries[1].index === 65535 && r.entries[1].ref === IN_H2 + "#65535"; })());
check("inputsdecode tag-258 set form decodes the same (CDDL set)", (() => { const r = app.parseInputsCbor("d9010282" + IN_ONE + "825820" + IN_H2 + "19ffff"); return r !== null && r.count === 2 && r.entries[0].ref === IN_H1 + "#0" && r.entries[1].index === 65535; })());
check("inputsdecode rejects empty set, plain and tagged (must spend at least one)", app.parseInputsCbor("80") === null && app.parseInputsCbor("d9010280") === null);
check("inputsdecode rejects index 65536 (CDDL .size 2; pycardano emits it)", app.parseInputsCbor("81" + "825820" + IN_H1 + "1a00010000") === null);
check("inputsdecode rejects duplicate reference, accepts same tx other index", app.parseInputsCbor("82" + IN_ONE + IN_ONE) === null && app.parseInputsCbor("82" + IN_ONE + "825820" + IN_H1 + "03") !== null);
check("inputsdecode rejects a lone input, short hash, negative index", app.parseInputsCbor(IN_ONE) === null && app.parseInputsCbor("818241" + "aa".repeat(31) + "00") === null && app.parseInputsCbor("81825820" + IN_H1 + "20") === null);
check("inputsdecode rejects trailing bytes, other tags, wrong shapes", app.parseInputsCbor("81" + IN_ONE + "00") === null && app.parseInputsCbor("d81881" + IN_ONE) === null && app.parseInputsCbor("a0") === null && app.parseInputsCbor("") === null && app.parseInputsCbor("zzzz") === null);


/* required signers decoder — a standalone required signers field's CBOR
   (body key 14). All hex vectors are pycardano 0.19.2 TransactionBody
   serialisations (scratch signers_py.py / signers_vectors.json),
   self-verified by TransactionBody.from_cbor round-trip in the
   generator. The rule is the Conway CDDL's: required_signers =
   nonempty_set<addr_keyhash>, addr_keyhash = hash28 (28 bytes),
   nonempty_set<a> = #6.258([+ a]) / [+ a] — hence the empty set and
   a repeated hash are rejected even though pycardano serialises an
   empty list to 80 with the field present and a duplicated hash
   twice: the CDDL governs cardinality and set semantics, the oracle
   only proves byte shapes (the mint run's split). */
check("signersdecode form present", html.includes('id="signersdecode"') && html.includes('id="signersdecode-input"') && html.includes('id="signersdecode-result"'));
check("signersdecode single signer (pycardano)", (() => { const r = app.parseSignersCbor("81581c" + PAY_KH); return r !== null && r.count === 1 && r.entries[0] === PAY_KH; })());
check("signersdecode two signers (pycardano)", (() => { const r = app.parseSignersCbor("82581c" + PAY_KH + "581c" + STAKE_KH); return r !== null && r.count === 2 && r.entries[0] === PAY_KH && r.entries[1] === STAKE_KH; })());
check("signersdecode three signers, encoded order kept (pycardano)", (() => { const r = app.parseSignersCbor("83581c000102030405060708090a0b0c0d0e0f101112131415161718191a1b581c" + STAKE_KH + "581c" + PAY_KH); return r !== null && r.count === 3 && r.entries[0] === "000102030405060708090a0b0c0d0e0f101112131415161718191a1b" && r.entries[1] === STAKE_KH && r.entries[2] === PAY_KH; })());
check("signersdecode tag-258 set form decodes the same (CDDL nonempty_set)", (() => { const r = app.parseSignersCbor("d9010282581c" + PAY_KH + "581c" + STAKE_KH); return r !== null && r.count === 2 && r.entries[0] === PAY_KH && r.entries[1] === STAKE_KH; })());
check("signersdecode rejects empty set, plain and tagged (CDDL [+ a]; pycardano emits 80)", app.parseSignersCbor("80") === null && app.parseSignersCbor("d9010280") === null);
check("signersdecode rejects duplicate hash (a set; pycardano emits it twice)", app.parseSignersCbor("82581c" + PAY_KH + "581c" + PAY_KH) === null);
check("signersdecode rejects 32-byte and 27-byte hashes", app.parseSignersCbor("815820" + "00".repeat(32)) === null && app.parseSignersCbor("81581b" + "00".repeat(27)) === null);
check("signersdecode rejects lone hash, inputs shape, trailing bytes", app.parseSignersCbor("581c" + PAY_KH) === null && app.parseSignersCbor("81825820" + "00".repeat(32) + "00") === null && app.parseSignersCbor("81581c" + PAY_KH + "00") === null && app.parseSignersCbor("") === null && app.parseSignersCbor("zzzz") === null);

/* reference inputs decoder — a standalone reference inputs field's
   CBOR (body key 18). All hex vectors are pycardano 0.19.2
   TransactionBody serialisations (scratch refinputs_py.py /
   refinputs_vectors.json), self-verified by TransactionBody.from_cbor
   round-trip in the generator. The entry shape is the inputs
   decoder's (transaction_input = [hash32, uint .size 2]) but the
   field rule is the Conway CDDL's nonempty_set<transaction_input>
   (#6.258([+ a]) / [+ a]) — hence the empty set is rejected by the
   GRAMMAR ITSELF here, where the inputs field (a plain set<>) rests
   its empty rejection on the must-spend validity rule; and a
   repeated reference and an index of 65,536 are rejected even
   though pycardano serialises all three: the CDDL governs
   cardinality, ranges and set semantics, the oracle only proves
   byte shapes (the mint run's split). */
check("refinputsdecode form present", html.includes('id="refinputsdecode"') && html.includes('id="refinputsdecode-input"') && html.includes('id="refinputsdecode-result"'));
check("refinputsdecode single reference (pycardano)", (() => { const r = app.parseRefInputsCbor("81" + "825820" + IN_H2 + "01"); return r !== null && r.count === 1 && r.entries[0].txHash === IN_H2 && r.entries[0].index === 1 && r.entries[0].ref === IN_H2 + "#1"; })());
check("refinputsdecode two references incl. index max, order kept (pycardano)", (() => { const r = app.parseRefInputsCbor("82" + IN_ONE + "825820" + IN_H2 + "19ffff"); return r !== null && r.count === 2 && r.entries[0].ref === IN_H1 + "#0" && r.entries[1].txHash === IN_H2 && r.entries[1].index === 65535; })());
check("refinputsdecode reversed pair keeps encoded order (pycardano)", (() => { const r = app.parseRefInputsCbor("82825820" + IN_H2 + "19ffff" + "825820" + IN_H1 + "03"); return r !== null && r.count === 2 && r.entries[0].ref === IN_H2 + "#65535" && r.entries[1].ref === IN_H1 + "#3"; })());
check("refinputsdecode tag-258 set form decodes the same (CDDL nonempty_set)", (() => { const r = app.parseRefInputsCbor("d9010282" + IN_ONE + "825820" + IN_H2 + "19ffff"); return r !== null && r.count === 2 && r.entries[0].ref === IN_H1 + "#0" && r.entries[1].index === 65535; })());
check("refinputsdecode same transaction at two indices accepted (pycardano)", (() => { const r = app.parseRefInputsCbor("82" + IN_ONE + "825820" + IN_H1 + "07"); return r !== null && r.count === 2 && r.entries[1].ref === IN_H1 + "#7"; })());
check("refinputsdecode rejects empty set, plain and tagged (CDDL [+ a]; pycardano emits 80)", app.parseRefInputsCbor("80") === null && app.parseRefInputsCbor("d9010280") === null);
check("refinputsdecode rejects duplicate reference (a set; pycardano round-trips it twice)", app.parseRefInputsCbor("82" + IN_ONE + IN_ONE) === null);
check("refinputsdecode rejects index 65536 (CDDL .size 2; pycardano emits it)", app.parseRefInputsCbor("81" + "825820" + IN_H1 + "1a00010000") === null);
check("refinputsdecode rejects a lone reference, short hash, negative index", app.parseRefInputsCbor(IN_ONE) === null && app.parseRefInputsCbor("818241" + "aa".repeat(31) + "00") === null && app.parseRefInputsCbor("81825820" + IN_H1 + "20") === null);
check("refinputsdecode rejects trailing bytes, other tags, wrong shapes", app.parseRefInputsCbor("81" + IN_ONE + "00") === null && app.parseRefInputsCbor("d81881" + IN_ONE) === null && app.parseRefInputsCbor("a0") === null && app.parseRefInputsCbor("") === null && app.parseRefInputsCbor("zzzz") === null);

/* collateral inputs decoder — a standalone collateral field's CBOR
   (body key 13). All hex vectors are pycardano 0.19.2 TransactionBody
   serialisations (scratch collateral_py.py /
   collateral_vectors.json), self-verified by TransactionBody.from_cbor
   round-trip in the generator (encoded ORDER asserted, not sorted).
   The entry shape is the inputs decoder's (transaction_input =
   [hash32, uint .size 2]) and the field rule is the Conway CDDL's
   nonempty_set<transaction_input> (#6.258([+ a]) / [+ a]) — hence
   the empty set is rejected by the GRAMMAR ITSELF, like the signers
   and reference-inputs fields — plus the gate no sibling field has:
   at most 3 entries, under the live protocol parameter
   max_collateral_inputs = 3 (Koios epoch_params, epoch 660,
   verified 2026-10-08; the ledger's TooManyCollateralInputs rule).
   A repeated reference, an index of 65,536 and FOUR entries are all
   rejected even though pycardano serialises every one of them: the
   CDDL and the live protocol parameters govern cardinality, ranges
   and set semantics, the oracle only proves byte shapes (the mint
   run's split). */
check("collateraldecode form present", html.includes('id="collateraldecode"') && html.includes('id="collateraldecode-input"') && html.includes('id="collateraldecode-result"'));
check("collateraldecode single entry (pycardano)", (() => { const r = app.parseCollateralCbor("81" + "825820" + IN_H2 + "01"); return r !== null && r.count === 1 && r.entries[0].txHash === IN_H2 && r.entries[0].index === 1 && r.entries[0].ref === IN_H2 + "#1"; })());
check("collateraldecode three entries at the cap, incl. index max + same tx at two indices (pycardano)", (() => { const r = app.parseCollateralCbor("83" + IN_ONE + "825820" + IN_H2 + "19ffff" + "825820" + IN_H1 + "07"); return r !== null && r.count === 3 && r.entries[0].ref === IN_H1 + "#0" && r.entries[1].index === 65535 && r.entries[2].ref === IN_H1 + "#7"; })());
check("collateraldecode reversed three keep encoded order (pycardano)", (() => { const r = app.parseCollateralCbor("83825820" + IN_H1 + "07" + "825820" + IN_H2 + "19ffff" + IN_ONE); return r !== null && r.count === 3 && r.entries[0].ref === IN_H1 + "#7" && r.entries[1].ref === IN_H2 + "#65535" && r.entries[2].ref === IN_H1 + "#0"; })());
check("collateraldecode tag-258 set form decodes the same (CDDL nonempty_set)", (() => { const r = app.parseCollateralCbor("d9010283" + IN_ONE + "825820" + IN_H2 + "19ffff" + "825820" + IN_H1 + "07"); return r !== null && r.count === 3 && r.entries[0].ref === IN_H1 + "#0" && r.entries[2].index === 7; })());
check("collateraldecode rejects four entries (live pp max_collateral_inputs = 3; pycardano emits four)", app.parseCollateralCbor("84" + IN_ONE + "825820" + IN_H2 + "01" + "825820" + "aa".repeat(32) + "02" + "825820" + IN_H1 + "07") === null);
check("collateraldecode rejects empty set, plain and tagged (CDDL [+ a]; pycardano emits 80)", app.parseCollateralCbor("80") === null && app.parseCollateralCbor("d9010280") === null);
check("collateraldecode rejects duplicate reference (a set; pycardano round-trips it twice)", app.parseCollateralCbor("82" + IN_ONE + IN_ONE) === null);
check("collateraldecode rejects index 65536 (CDDL .size 2; pycardano emits it)", app.parseCollateralCbor("81" + "825820" + IN_H1 + "1a00010000") === null);
check("collateraldecode rejects a lone entry, short hash, negative index", app.parseCollateralCbor(IN_ONE) === null && app.parseCollateralCbor("818241" + "aa".repeat(31) + "00") === null && app.parseCollateralCbor("81825820" + IN_H1 + "20") === null);
check("collateraldecode rejects trailing bytes, other tags, wrong shapes", app.parseCollateralCbor("81" + IN_ONE + "00") === null && app.parseCollateralCbor("d81881" + IN_ONE) === null && app.parseCollateralCbor("a0") === null && app.parseCollateralCbor("") === null && app.parseCollateralCbor("zzzz") === null);

/* Certificates decoder: certificates = nonempty_oset<certificate>
   (#6.258([+ a]) / [+ a]) — the empty set is rejected by the GRAMMAR
   ITSELF, and a repeated certificate is rejected because the field
   is an ordered set, even though pycardano serialises an empty list
   to 80 with the field present and the same certificate twice,
   reading it back as two (the CDDL governs cardinality and set
   semantics, the oracle only proves byte shapes). Types 5 and 6
   (genesis / MIR) do not exist in the Conway CDDL and are rejected.
   All seventeen Conway types were proven field-for-field in scratch
   against pycardano 0.19.2 TransactionBody serialisations
   (whole-body round-trip asserted byte-for-byte). */
const CERT_SCRIPT = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b";
const CERT_POOL = "aa".repeat(28);
const CERT_REG = "8182008200581c" + PAY_KH;
check("certsdecode form present", html.includes('id="certsdecode"') && html.includes('id="certsdecode-input"') && html.includes('id="certsdecode-result"'));
check("certsdecode account registration, key credential (pycardano)", (() => { const r = app.parseCertificatesCbor(CERT_REG); return r !== null && r.count === 1 && r.certificates[0].type === 0 && r.certificates[0].credential.kind === "key" && r.certificates[0].credential.hash === PAY_KH; })());
check("certsdecode account unregistration, script credential (pycardano)", (() => { const r = app.parseCertificatesCbor("8182018201581c" + CERT_SCRIPT); return r !== null && r.certificates[0].type === 1 && r.certificates[0].credential.kind === "script" && r.certificates[0].credential.hash === CERT_SCRIPT; })());
check("certsdecode full pool registration: params, margin, reward, owners, 5 relays, metadata (pycardano)", (() => { const r = app.parseCertificatesCbor("818a03581c" + CERT_POOL + "5820" + "ff".repeat(32) + "1b000000174876e8001a0a21fe80d81e82011832581de1" + STAKE_KH + "82581c" + STAKE_KH + "581c" + PAY_KH + "858400190bb94401020304f68400f6f65020010db80000000000000000000000018301191f907172656c61792e6578616d706c652e636f6d8301f671706c61696e2e6578616d706c652e636f6d82026f7372762e6578616d706c652e636f6d82781d68747470733a2f2f6578616d706c652e636f6d2f6d6574612e6a736f6e5820" + "bb".repeat(32)); if (r === null) return false; const p = r.certificates[0].poolParams; return r.certificates[0].type === 3 && p.operator === CERT_POOL && p.vrfKeyHash === "ff".repeat(32) && p.pledge === "100000000000" && p.cost === "170000000" && p.margin.numerator === "1" && p.margin.denominator === "50" && p.rewardAccount.hex === "e1" + STAKE_KH && app.decodeAddress(p.rewardAccount.address).stakeHash === STAKE_KH && p.owners.length === 2 && p.owners[0] === STAKE_KH && p.owners[1] === PAY_KH && p.relays.length === 5 && p.relays[0].ipv4 === "1.2.3.4" && p.relays[0].port === 3001 && p.relays[1].ipv6 === "2001:0db8:0000:0000:0000:0000:0000:0001" && p.relays[2].dnsName === "relay.example.com" && p.relays[2].port === 8080 && p.relays[3].port === null && p.relays[4].kind === "multi_host_name" && p.metadata.url === "https://example.com/meta.json" && p.metadata.hash === "bb".repeat(32); })());
check("certsdecode minimal pool registration: zero pledge/cost, margin 0/1, no owners/relays/metadata (pycardano)", (() => { const r = app.parseCertificatesCbor("818a03581c" + CERT_POOL + "5820" + "ff".repeat(32) + "0000d81e820001581de0" + STAKE_KH + "8080f6"); if (r === null) return false; const p = r.certificates[0].poolParams; return p.pledge === "0" && p.cost === "0" && p.margin.numerator === "0" && p.margin.denominator === "1" && p.owners.length === 0 && p.relays.length === 0 && p.metadata === null; })());
check("certsdecode pool retirement epoch is an exact string (pycardano)", (() => { const r = app.parseCertificatesCbor("818304581c" + CERT_POOL + "1902bc"); return r !== null && r.certificates[0].type === 4 && r.certificates[0].pool === CERT_POOL && r.certificates[0].epoch === "700"; })());
check("certsdecode vote delegation to always-abstain DRep, which carries no hash (pycardano)", (() => { const r = app.parseCertificatesCbor("8183098200581c" + PAY_KH + "8102"); return r !== null && r.certificates[0].type === 9 && r.certificates[0].drep.kind === "always_abstain" && r.certificates[0].drep.hash === undefined; })());
check("certsdecode committee resignation without anchor (pycardano)", (() => { const r = app.parseCertificatesCbor("81830f8201581c" + CERT_SCRIPT + "f6"); return r !== null && r.certificates[0].type === 15 && r.certificates[0].coldCredential.kind === "script" && r.certificates[0].anchor === null; })());
check("certsdecode DRep registration with coin and anchor (pycardano)", (() => { const r = app.parseCertificatesCbor("8184108200581c" + PAY_KH + "1a1dcd650082781f68747470733a2f2f6578616d706c652e636f6d2f616e63686f722e6a736f6e5820" + IN_H1); return r !== null && r.certificates[0].type === 16 && r.certificates[0].coin === "500000000" && r.certificates[0].anchor.url === "https://example.com/anchor.json" && r.certificates[0].anchor.dataHash === IN_H1; })());
check("certsdecode three-certificate combination keeps encoded order; same credential in different certs accepted (pycardano)", (() => { const r = app.parseCertificatesCbor("8382008200581c" + PAY_KH + "83028200581c" + PAY_KH + "581c" + CERT_POOL + "8304581c" + CERT_POOL + "1902bc"); return r !== null && r.count === 3 && r.certificates[0].type === 0 && r.certificates[1].type === 2 && r.certificates[2].type === 4; })());
check("certsdecode tag-258 ordered-set form decodes the same (CDDL nonempty_oset)", (() => { const r = app.parseCertificatesCbor("d901028382008200581c" + PAY_KH + "83028200581c" + PAY_KH + "581c" + CERT_POOL + "8304581c" + CERT_POOL + "1902bc"); return r !== null && r.count === 3 && r.certificates[2].epoch === "700"; })());
check("certsdecode rejects empty set, plain and tagged (CDDL [+ a]; pycardano emits 80)", app.parseCertificatesCbor("80") === null && app.parseCertificatesCbor("d9010280") === null);
check("certsdecode rejects a duplicated certificate (an ordered set; pycardano round-trips it twice)", app.parseCertificatesCbor("82" + CERT_REG.slice(2) + CERT_REG.slice(2)) === null);
check("certsdecode rejects unknown types 5 and 19 (not in the Conway CDDL)", app.parseCertificatesCbor("8182058200581c" + PAY_KH) === null && app.parseCertificatesCbor("8182138200581c" + PAY_KH) === null);
check("certsdecode rejects a lone certificate, bad credential kind, short hash, negative coin", app.parseCertificatesCbor(CERT_REG.slice(2)) === null && app.parseCertificatesCbor("8182008202581c" + PAY_KH) === null && app.parseCertificatesCbor("818200820041" + "aa".repeat(27)) === null && app.parseCertificatesCbor("8183078200581c" + PAY_KH + "20") === null);
check("certsdecode rejects a hash after always-abstain and DRep kind 4", app.parseCertificatesCbor("8183098200581c" + PAY_KH + "8202581c" + PAY_KH) === null && app.parseCertificatesCbor("8183098200581c" + PAY_KH + "8104") === null);
check("certsdecode rejects margin above 1, zero denominator, and margin without tag 30 (unit_interval)", app.parseCertificatesCbor("818a03581c" + CERT_POOL + "5820" + "ff".repeat(32) + "0000d81e8218331832581de0" + STAKE_KH + "8080f6") === null && app.parseCertificatesCbor("818a03581c" + CERT_POOL + "5820" + "ff".repeat(32) + "0000d81e820100581de0" + STAKE_KH + "8080f6") === null && app.parseCertificatesCbor("818a03581c" + CERT_POOL + "5820" + "ff".repeat(32) + "000082011832581de0" + STAKE_KH + "8080f6") === null);
check("certsdecode rejects a 28-byte reward account and a payment-header reward account", app.parseCertificatesCbor("818a03581c" + CERT_POOL + "5820" + "ff".repeat(32) + "0000d81e820001581c" + STAKE_KH + "8080f6") === null && app.parseCertificatesCbor("818a03581c" + CERT_POOL + "5820" + "ff".repeat(32) + "0000d81e820001581d61" + STAKE_KH + "8080f6") === null);
check("certsdecode rejects trailing bytes, other tags, wrong shapes", app.parseCertificatesCbor(CERT_REG + "00") === null && app.parseCertificatesCbor("d818" + CERT_REG) === null && app.parseCertificatesCbor("a0") === null && app.parseCertificatesCbor("") === null && app.parseCertificatesCbor("zzzz") === null);

console.log(failures === 0 ? "\nALL TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
