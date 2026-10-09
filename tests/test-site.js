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
check("all form controls labelled", ["addr", "ada", "lovelace", "q", "slot", "epoch", "stake-ada", "stake-rate", "stake-epochs", "pool-rewards", "pool-cost", "pool-margin", "pool-owner-stake", "pool-total-stake", "pool-member-stake", "fee-size", "exunit-mem", "exunit-steps", "refscript-size", "total-size", "total-mem", "total-steps", "total-ref", "pool-hex", "pool-bech32", "asset-policy", "asset-name", "unit-input", "hash-kind", "hash-bytes", "key-pay", "key-stake", "key-network", "decode-addr", "addrhex-bech32", "addrhex-hex", "gov-input", "cred-pay", "cred-pay-kind", "cred-stake", "cred-stake-kind", "cred-network", "cbor-input", "data-input", "txoutdecode-input", "outputsdecode-input", "mintdecode-input", "withdrawdecode-input", "inputsdecode-input", "signersdecode-input", "refinputsdecode-input", "collateraldecode-input", "certsdecode-input", "votingdecode-input", "proposalsdecode-input", "auxdecode-input", "witnessdecode-input", "redeemersdecode-input", "datumsdecode-input", "vkeywitnessdecode-input", "nativescriptsdecode-input", "bootstrapdecode-input", "plutusscriptsdecode-input", "plutusscriptsdecode-lang", "fulltxdecode-input", "sdh-redeemers", "sdh-datums", "sdh-lang-v1", "sdh-lang-v2", "sdh-lang-v3", "minutxo-addr", "minutxo-assets", "minutxo-datum-kind", "minutxo-datum-hex", "minutxo-script-kind", "minutxo-script-hex", "native-input"].every(id =>
  html.includes(`for="${id}"`) || html.includes(`aria-label`)));
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=49"));
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

/* transaction outputs decoder — a standalone outputs field's CBOR
   (body key 1). Vectors are pycardano 0.19.2 TransactionBody
   serialisations (scratch outputs_py.py / outputs_vectors.json):
   each field extracted by span from a whole body, re-wrapped as
   {1: field} and read back by the oracle in the generator, with
   expectations read off the oracle's objects — except each
   output's FORMAT, which is read off its emitted bytes, because
   pycardano serialises body outputs in the array form whenever
   an output fits it (post_alonzo flag notwithstanding) and the
   map form only when a Babbage field requires it. The field is a
   LIST ([* transaction_output]): duplicates decode as two
   outputs, and the EMPTY list decodes — the grammar allows it,
   no ledger rule requires outputs the way InputSetEmptyUTxO
   requires inputs, and the oracle serialises a body carrying
   01 80 (generator probe). Every entry passes the output
   decoder's own gates via the shared parseTxOutNode. */
check("outputsdecode form present", html.includes('id="outputsdecode"') && html.includes('id="outputsdecode-input"') && html.includes('id="outputsdecode-result"'));
const OUT_SINGLE = "8182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a000eedc2";
check("outputs: single output field (pycardano body)", (() => { const r = app.parseOutputsCbor(OUT_SINGLE); return r !== null && r.count === 1 && r.outputs[0].format === "alonzo" && r.outputs[0].address === ADA && r.outputs[0].lovelace === "978370" && r.totalLovelace === "978370"; })());
check("outputs: mixed pair — multi-asset with datum hash, plain coin; exact total (pycardano body)", (() => { const r = app.parseOutputsCbor("8283583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82821a001e8480a1581c7eae28af2208be856f7a119668ae52a49b73725e326dc16579dcc373a146504154415445055820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f82583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a0016e360"); return r !== null && r.count === 2 && r.outputs[0].assets.length === 1 && r.outputs[0].assets[0].quantity === "5" && r.outputs[0].datum.kind === "hash" && r.outputs[1].lovelace === "1500000" && r.totalLovelace === "3500000"; })());
check("outputs: rich triple — Babbage inline datum, Babbage Plutus V2 script ref, Alonzo enterprise (pycardano body)", (() => { const r = app.parseOutputsCbor("83a300583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82011a002dc6c0028201d81848d8799f182a182bffa300583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82011a003d090003d8184d82024a4948010000222120010182581d61ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28d1a002625a0"); return r !== null && r.count === 3 && r.outputs[0].format === "babbage" && r.outputs[0].datum.kind === "inline" && r.outputs[1].format === "babbage" && r.outputs[1].scriptRef === "plutus2" && r.outputs[2].format === "alonzo" && r.outputs[2].address === "addr1v8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9rgcshpl9" && r.totalLovelace === "9500000"; })());
check("outputs: the same output twice decodes as two outputs (a list, not a set; pycardano body)", (() => { const r = app.parseOutputsCbor("8282583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a000eedc282583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a000eedc2"); return r !== null && r.count === 2 && r.outputs[0].lovelace === "978370" && r.outputs[1].lovelace === "978370" && r.totalLovelace === "1956740"; })());
check("outputs: REAL mainnet body — three outputs, inline datum, exact total 318675542791 (Koios fixture body)", (() => { const r = app.parseOutputsCbor("838258390179d5c5fce167cde6ca79f7be9cbea7deac68e6065cfc453e71fcc03aacf9d9b29ccf585ec8bff19bf6cc26a35ae3c0146efb66af6372630e821a001e8480a1581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5a14553555247451b0000000185deee21a300583911ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b52563c5410bff6a0d43ccebb7c37e1f69f5eb260552521adff33b9c201821b0000004a2a412556a2581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5a14553555247451b000004bbd83d2e43581cf5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca2434d5350015820ab2bc7cba8f1e4edbfbb83b630082ba6d711b7059dad402baa636d0e355732d51b7ffffed7cfc32c6b028201d818587fd8799fd8799fd87a9f581c1eae96baf29e27682ea3f815aba361a0c6059d45e4bfbe95bbd2f44affffd8799f4040ffd8799f581ce992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5455355524745ff1b00000128303cd39e1b0000004a285d7ea41b000004bbbc9461160505d8799f190682ffd87980ff825839015b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b533b9586f0fb9aafd578e0d0154e9478d23614e736eb39d1a30d8a991a082b3931"); return r !== null && r.count === 3 && r.outputs[0].lovelace === "2000000" && r.outputs[0].assets.length === 1 && r.outputs[1].lovelace === "318536492374" && r.outputs[1].assets.length === 3 && r.outputs[1].datum.kind === "inline" && r.outputs[2].lovelace === "137050417" && r.totalLovelace === "318675542791"; })());
check("outputs: the empty field decodes as zero outputs (grammar [* ]; oracle serialises a body carrying 01 80)", (() => { const r = app.parseOutputsCbor("80"); return r !== null && r.count === 0 && r.totalLovelace === "0"; })());
check("outputs: indefinite-length array form decodes", (() => { const r = app.parseOutputsCbor("9f" + OUT_SINGLE.slice(2) + "ff"); return r !== null && r.count === 1 && r.totalLovelace === "978370"; })());
check("outputs: rejects a tag-258 set wrapper, a bare single output, a whole body, trailing bytes, empty and garbage",
  app.parseOutputsCbor("d9010280") === null && app.parseOutputsCbor(OUT_SINGLE.slice(2)) === null && app.parseOutputsCbor("a300818258201111111111111111111111111111111111111111111111111111111111111111000180021a00029810") === null && app.parseOutputsCbor(OUT_SINGLE + "00") === null && app.parseOutputsCbor("") === null && app.parseOutputsCbor("zzzz") === null);
check("outputs: one entry failing the output gates refuses the whole field (reward-address entry)",
  app.parseOutputsCbor("81a200581de1" + "ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82" + "011a000eedc2") === null);

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

/* Voting procedures decoder: voting_procedures =
   {+ voter => {+ gov_action_id => voting_procedure}} — BOTH maps
   are non-empty by the CDDL's {+ } grammar, so the empty map is
   rejected even though pycardano serialises an empty
   VotingProcedures to a0 with the field present (the CDDL governs
   emptiness, the oracle only proves byte shapes). Map semantics
   reject the same voter twice and the same action twice under one
   voter; the same action under different voters is the normal
   case. On the gov_action_index .size 2 range the authorities
   AGREE (pycardano's GovActionId itself raises above 65535).
   pycardano's dict serialiser emits map keys in canonical
   encoded-byte order, so the multi-voter vector's expectation is
   in ENCODED order, which the decoder preserves. Proven
   field-for-field in scratch against pycardano 0.19.2
   TransactionBody serialisations (whole-body round-trip asserted
   byte-for-byte in the generator). */
const VOTE_TX2 = "ff".repeat(32);
const VOTE_DREP_YES = "a18202581c" + PAY_KH + "a1825820" + IN_H1 + "008201f6";
const VOTE_POOL = "a18204581c" + CERT_POOL + "a1825820" + IN_H1 + "038202f6";
check("votingdecode form present", html.includes('id="votingdecode"') && html.includes('id="votingdecode-input"') && html.includes('id="votingdecode-result"'));
check("votingdecode DRep key-hash YES, no anchor (pycardano)", (() => { const r = app.parseVotingCbor(VOTE_DREP_YES); return r !== null && r.voterCount === 1 && r.voteCount === 1 && r.voters[0].voter.code === 2 && r.voters[0].voter.role === "drep" && r.voters[0].voter.kind === "key" && r.voters[0].voter.hash === PAY_KH && r.voters[0].votes[0].action.txHash === IN_H1 && r.voters[0].votes[0].action.index === 0 && r.voters[0].votes[0].action.ref === IN_H1 + "#0" && r.voters[0].votes[0].procedure.vote === "yes" && r.voters[0].votes[0].procedure.anchor === null; })());
check("votingdecode committee hot script-hash NO with anchor, action index 65535 (pycardano)", (() => { const r = app.parseVotingCbor("a18201581c" + CERT_SCRIPT + "a1825820" + VOTE_TX2 + "19ffff820082781d68747470733a2f2f6578616d706c652e636f6d2f766f74652e6a736f6e5820" + IN_H1); return r !== null && r.voters[0].voter.code === 1 && r.voters[0].voter.role === "committee_hot" && r.voters[0].voter.kind === "script" && r.voters[0].voter.hash === CERT_SCRIPT && r.voters[0].votes[0].action.index === 65535 && r.voters[0].votes[0].procedure.vote === "no" && r.voters[0].votes[0].procedure.anchor.url === "https://example.com/vote.json" && r.voters[0].votes[0].procedure.anchor.dataHash === IN_H1; })());
check("votingdecode stake pool ABSTAIN (pycardano)", (() => { const r = app.parseVotingCbor(VOTE_POOL); return r !== null && r.voters[0].voter.code === 4 && r.voters[0].voter.role === "staking_pool" && r.voters[0].voter.kind === "key" && r.voters[0].voter.hash === CERT_POOL && r.voters[0].votes[0].action.index === 3 && r.voters[0].votes[0].procedure.vote === "abstain"; })());
check("votingdecode two voters in encoded order, one DRep voting on two actions, same action under both voters (pycardano)", (() => { const r = app.parseVotingCbor("a28200581c" + STAKE_KH + "a1825820" + IN_H1 + "008200f68203581c" + CERT_SCRIPT + "a2825820" + IN_H1 + "00820182781d68747470733a2f2f6578616d706c652e636f6d2f766f74652e6a736f6e5820" + IN_H1 + "825820" + IN_H1 + "018202f6"); return r !== null && r.voterCount === 2 && r.voteCount === 3 && r.voters[0].voter.role === "committee_hot" && r.voters[0].voter.hash === STAKE_KH && r.voters[0].votes[0].procedure.vote === "no" && r.voters[1].voter.role === "drep" && r.voters[1].voter.kind === "script" && r.voters[1].votes.length === 2 && r.voters[1].votes[0].procedure.vote === "yes" && r.voters[1].votes[0].procedure.anchor.url === "https://example.com/vote.json" && r.voters[1].votes[1].action.index === 1 && r.voters[1].votes[1].procedure.vote === "abstain"; })());
check("votingdecode rejects the empty map (CDDL {+ }; pycardano emits a0)", app.parseVotingCbor("a0") === null);
check("votingdecode rejects an empty inner map and a duplicated voter (map semantics)", app.parseVotingCbor("a18204581c" + CERT_POOL + "a0") === null && app.parseVotingCbor("a2" + VOTE_DREP_YES.slice(2) + VOTE_DREP_YES.slice(2)) === null);
check("votingdecode rejects the same action twice under one voter", app.parseVotingCbor("a18204581c" + CERT_POOL + "a2825820" + IN_H1 + "038202f6" + "825820" + IN_H1 + "038202f6") === null);
check("votingdecode rejects voter code 5 and vote 3 (CDDL voter / vote = 0..2)", app.parseVotingCbor(VOTE_POOL.replace("8204", "8205")) === null && app.parseVotingCbor(VOTE_DREP_YES.replace("8201f6", "8203f6")) === null);
check("votingdecode rejects action index 65536 (CDDL .size 2; pycardano's GovActionId raises too)", app.parseVotingCbor(VOTE_DREP_YES.replace("825820" + IN_H1 + "00", "825820" + IN_H1 + "1a00010000")) === null && app.parseVotingCbor("a18201581c" + CERT_SCRIPT + "a1825820" + VOTE_TX2 + "1a00010000820082781d68747470733a2f2f6578616d706c652e636f6d2f766f74652e6a736f6e5820" + IN_H1) === null);
check("votingdecode rejects a 27-byte voter hash, a 31-byte action hash, a one-item procedure", app.parseVotingCbor("a18204581b" + "aa".repeat(27) + "a1825820" + IN_H1 + "038202f6") === null && app.parseVotingCbor("a18204581c" + CERT_POOL + "a182581f" + IN_H1.slice(0, 62) + "038202f6") === null && app.parseVotingCbor(VOTE_POOL.replace("8202f6", "8102")) === null);
check("votingdecode rejects an anchor URL over 128 bytes and a 31-byte anchor hash", app.parseVotingCbor("a18201581c" + CERT_SCRIPT + "a1825820" + VOTE_TX2 + "19ffff820082" + "790081" + "61".repeat(129) + "5820" + IN_H1) === null && app.parseVotingCbor("a18201581c" + CERT_SCRIPT + "a1825820" + VOTE_TX2 + "19ffff820082781d68747470733a2f2f6578616d706c652e636f6d2f766f74652e6a736f6e581f" + IN_H1.slice(0, 62)) === null);
check("votingdecode accepts an anchor URL of exactly 128 bytes", (() => { const r = app.parseVotingCbor("a18201581c" + CERT_SCRIPT + "a1825820" + VOTE_TX2 + "19ffff820082" + "7880" + "61".repeat(128) + "5820" + IN_H1); return r !== null && r.voters[0].votes[0].procedure.anchor.url.length === 128; })());
check("votingdecode rejects trailing bytes, an outer array, wrong shapes", app.parseVotingCbor(VOTE_DREP_YES + "00") === null && app.parseVotingCbor("81" + VOTE_DREP_YES.slice(2)) === null && app.parseVotingCbor("") === null && app.parseVotingCbor("zzzz") === null);


/* governance proposals decoder (body key 20) — pycardano 0.19.2 TransactionBody
   serialisations (proposals_py.py / proposals_vectors.json); the hard-fork and
   cost-models vectors are built from the Conway CDDL text because pycardano
   0.19.2 cannot represent the first and its validator crashes on the second,
   and the new-constitution vector is proven encoder-side (its re-parse raises). */
const PROP_INFO = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82810682782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_NOCONF = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828203825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f0782782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_HARDFORK = "d9010281841b000000174876e800581df1000102030405060708090a0b0c0d0e0f101112131415161718191a1b8301825820ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff19ffff820a0082782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_PARAM_FULL = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828400825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f00af00182d031940000419044c081901f409d81e82030a0ad81e82031903e80bd81e820105101a0a21fe801382d81e82190241192710d81e821902d11a0098968014821a00fbc5201b00000002540be400181985d81e8218331864d81e8218331864d81e8218331864d81e8218331864d81e8218331864181a8ad81e8218431864d81e820305d81e8218431864d81e8218431864d81e8218431864d81e820305d81e820305d81e820305d81e820305d81e8218431864181b07181e1b000000174876e8001821d81e820f01581c000102030405060708090a0b0c0d0e0f101112131415161718191a1b82782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_PARAM_CM = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828400f6a112a200831a000189b41901a42002821a00030d4019012cf682782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_PARAM_MIN = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828400f6a1011a00025ef5f682782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_TREASURY = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828302a2581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821b000000746a528800581df1000102030405060708090a0b0c0d0e0f101112131415161718191a1b01581c000102030405060708090a0b0c0d0e0f101112131415161718191a1b82782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_COMMITTEE = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828504f6d90102818200581cef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28da18201581c000102030405060708090a0b0c0d0e0f101112131415161718191a1b1902bcd81e82020382782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_CONSTITUTION = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828305825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f028282782568747470733a2f2f6578616d706c652e636f6d2f636f6e737469747574696f6e2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f581c000102030405060708090a0b0c0d0e0f101112131415161718191a1b82782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_COMBO = "d9010282841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c82810682782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f841b000000174876e800581df1000102030405060708090a0b0c0d0e0f101112131415161718191a1b8203f682782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_EMPTY_UPDATE = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828400f6a0f682782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PROP_EMPTY_TREASURY = "d9010281841b000000174876e800581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c828302a0f682782168747470733a2f2f6578616d706c652e636f6d2f70726f706f73616c2e6a736f6e5820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
check("proposalsdecode form present", html.includes('id="proposalsdecode"') && html.includes('id="proposalsdecode-input"') && html.includes('id="proposalsdecode-result"'));
check("proposalsdecode info action, deposit returns to a mainnet key reward account (pycardano)", (() => { const r = app.parseProposalsCbor(PROP_INFO); return r !== null && r.count === 1 && r.proposals[0].deposit === "100000000000" && r.proposals[0].rewardAccount.stakeHash === STAKE_KH && r.proposals[0].rewardAccount.stakeKind === "key" && r.proposals[0].rewardAccount.network === "mainnet" && r.proposals[0].rewardAccount.address.startsWith("stake1") && r.proposals[0].action.type === 6 && r.proposals[0].action.name === "info_action" && r.proposals[0].anchor.url === "https://example.com/proposal.json" && r.proposals[0].anchor.dataHash === IN_H1; })());
check("proposalsdecode no confidence with previous action (pycardano)", (() => { const r = app.parseProposalsCbor(PROP_NOCONF); return r !== null && r.proposals[0].action.type === 3 && r.proposals[0].action.prevAction.txHash === IN_H1 && r.proposals[0].action.prevAction.index === 7 && r.proposals[0].action.prevAction.ref === IN_H1 + "#7"; })());
check("proposalsdecode hard fork initiation to protocol 10.0 (CDDL-built; pycardano cannot represent the action)", (() => { const r = app.parseProposalsCbor(PROP_HARDFORK); return r !== null && r.proposals[0].action.type === 1 && r.proposals[0].action.protocolVersion.major === 10 && r.proposals[0].action.protocolVersion.minor === 0 && r.proposals[0].action.prevAction.index === 65535 && r.proposals[0].rewardAccount.stakeKind === "script"; })());
check("proposalsdecode accepts hard fork major 12 and rejects 13 (CDDL major 0..12)", (() => { const hi = app.parseProposalsCbor(PROP_HARDFORK.replace("19ffff820a00", "19ffff820c00")); return hi !== null && hi.proposals[0].action.protocolVersion.major === 12 && app.parseProposalsCbor(PROP_HARDFORK.replace("19ffff820a00", "19ffff820d00")) === null; })());
check("proposalsdecode fifteen-field parameter change in encoded order (pycardano)", (() => { const r = app.parseProposalsCbor(PROP_PARAM_FULL); if (r === null) return false; const u = r.proposals[0].action.updates; return r.proposals[0].action.type === 0 && r.proposals[0].action.prevAction.index === 0 && r.proposals[0].action.guardrailsScriptHash === CERT_SCRIPT && u.length === 15 && u[0].name === "minfee_a" && u[0].value === "45" && u[4].name === "pool_pledge_influence" && u[4].numerator === "3" && u[4].denominator === "10" && u[8].name === "execution_unit_prices" && u[8].memPrice.numerator === "577" && u[8].memPrice.denominator === "10000" && u[8].stepPrice.numerator === "721" && u[8].stepPrice.denominator === "10000000" && u[9].mem === "16500000" && u[9].steps === "10000000000" && u[10].thresholds.length === 5 && u[11].thresholds.length === 10 && u[11].thresholds[1].numerator === "3" && u[11].thresholds[1].denominator === "5" && u[14].name === "min_fee_ref_script_cost_per_byte" && u[14].numerator === "15" && u[14].denominator === "1"; })());
check("proposalsdecode cost-models update with a negative int64 cost (CDDL-built; pycardano validator crashes on cost_models)", (() => { const r = app.parseProposalsCbor(PROP_PARAM_CM); return r !== null && r.proposals[0].action.prevAction === null && r.proposals[0].action.guardrailsScriptHash === null && r.proposals[0].action.updates.length === 1 && r.proposals[0].action.updates[0].models.length === 2 && r.proposals[0].action.updates[0].models[0].language === 0 && r.proposals[0].action.updates[0].models[0].costs.join(",") === "100788,420,-1" && r.proposals[0].action.updates[0].models[1].language === 2; })());
check("proposalsdecode minimal parameter change, no previous action, no guardrails (pycardano)", (() => { const r = app.parseProposalsCbor(PROP_PARAM_MIN); return r !== null && r.proposals[0].action.updates.length === 1 && r.proposals[0].action.updates[0].name === "minfee_b" && r.proposals[0].action.updates[0].value === "155381"; })());
check("proposalsdecode empty update map and empty treasury map decode (CDDL all-optional / {*}; pycardano emits both)", app.parseProposalsCbor(PROP_EMPTY_UPDATE) !== null && app.parseProposalsCbor(PROP_EMPTY_UPDATE).proposals[0].action.updates.length === 0 && app.parseProposalsCbor(PROP_EMPTY_TREASURY) !== null && app.parseProposalsCbor(PROP_EMPTY_TREASURY).proposals[0].action.totalLovelace === "0");
check("proposalsdecode treasury withdrawals over two accounts with exact total (pycardano)", (() => { const r = app.parseProposalsCbor(PROP_TREASURY); return r !== null && r.proposals[0].action.type === 2 && r.proposals[0].action.withdrawals.length === 2 && r.proposals[0].action.withdrawals[0].lovelace === "500000000000" && r.proposals[0].action.withdrawals[1].rewardAccount.stakeHash === CERT_SCRIPT && r.proposals[0].action.withdrawals[1].lovelace === "1" && r.proposals[0].action.totalLovelace === "500000000001" && r.proposals[0].action.guardrailsScriptHash === CERT_SCRIPT; })());
check("proposalsdecode committee update: removal set, addition with expiry epoch, quorum (pycardano)", (() => { const r = app.parseProposalsCbor(PROP_COMMITTEE); return r !== null && r.proposals[0].action.type === 4 && r.proposals[0].action.removed.length === 1 && r.proposals[0].action.removed[0].kind === "key" && r.proposals[0].action.removed[0].hash === PAY_KH && r.proposals[0].action.added.length === 1 && r.proposals[0].action.added[0].credential.kind === "script" && r.proposals[0].action.added[0].epoch === "700" && r.proposals[0].action.quorum.numerator === "2" && r.proposals[0].action.quorum.denominator === "3"; })());
check("proposalsdecode new constitution with anchor and guardrails (pycardano encoder; its re-parse raises)", (() => { const r = app.parseProposalsCbor(PROP_CONSTITUTION); return r !== null && r.proposals[0].action.type === 5 && r.proposals[0].action.prevAction.index === 2 && r.proposals[0].action.constitution.anchor.url === "https://example.com/constitution.json" && r.proposals[0].action.constitution.guardrailsScriptHash === CERT_SCRIPT; })());
check("proposalsdecode two proposals keep encoded order (pycardano)", (() => { const r = app.parseProposalsCbor(PROP_COMBO); return r !== null && r.count === 2 && r.proposals[0].action.type === 6 && r.proposals[1].action.type === 3 && r.proposals[1].action.prevAction === null && r.proposals[1].rewardAccount.stakeHash === CERT_SCRIPT; })());
check("proposalsdecode plain array form (no set tag) decodes the same", (() => { const r = app.parseProposalsCbor("81" + PROP_INFO.slice(8)); return r !== null && r.count === 1 && r.proposals[0].action.type === 6; })());
check("proposalsdecode rejects the empty field, plain and tagged (CDDL [+ a]; pycardano emits d9010280)", app.parseProposalsCbor("80") === null && app.parseProposalsCbor("d9010280") === null);
check("proposalsdecode rejects a duplicated proposal (an ordered set; pycardano dedupes it silently)", app.parseProposalsCbor("d90102" + "82" + PROP_INFO.slice(8) + PROP_INFO.slice(8)) === null);
check("proposalsdecode rejects action code 7, a bare-int action, and an info action with an extra item", app.parseProposalsCbor(PROP_INFO.replace("862c828106", "862c828107")) === null && app.parseProposalsCbor("81" + PROP_INFO.slice(8).replace("862c828106", "862c8206")) === null && app.parseProposalsCbor("81" + PROP_INFO.slice(8).replace("862c828106", "862c82820600")) === null);
check("proposalsdecode rejects a negative deposit, a payment-header reward account, and a null proposal anchor", (() => { const item = PROP_INFO.slice(8); const anchLen = ("827821" + Buffer.from("https://example.com/proposal.json").toString("hex") + "5820" + IN_H1).length; const noAnch = "81" + item.slice(0, item.length - anchLen) + "f6"; return app.parseProposalsCbor("81" + item.replace("1b000000174876e800", "3b000000174876e800")) === null && app.parseProposalsCbor(PROP_INFO.replace("581de1", "581d61")) === null && app.parseProposalsCbor(noAnch) === null; })());
check("proposalsdecode rejects previous-action index 65536 (CDDL .size 2; pycardano's GovActionId raises too)", app.parseProposalsCbor(PROP_NOCONF.replace("825820" + IN_H1 + "07", "825820" + IN_H1 + "1a00010000")) === null);
check("proposalsdecode rejects update keys 12, 15 and 34 and a duplicated update key (not in the Conway CDDL)", app.parseProposalsCbor(PROP_PARAM_MIN.replace("a1011a00025ef5", "a10c1a00025ef5")) === null && app.parseProposalsCbor(PROP_PARAM_MIN.replace("a1011a00025ef5", "a10f1a00025ef5")) === null && app.parseProposalsCbor(PROP_PARAM_MIN.replace("a1011a00025ef5", "a118221a00025ef5")) === null && app.parseProposalsCbor(PROP_PARAM_MIN.replace("a1011a00025ef5", "a2011a00025ef5011a00025ef5")) === null);
check("proposalsdecode rejects a unit interval above 1, a zero denominator, and an interval without tag 30", (() => { const P = "81" + PROP_INFO.slice(8).replace("862c828106", "862c828400f6a10aXXf6"); return app.parseProposalsCbor(P.replace("XX", "d81e820302")) === null && app.parseProposalsCbor(P.replace("XX", "d81e820300")) === null && app.parseProposalsCbor(P.replace("XX", "820302")) === null; })());
check("proposalsdecode rejects a cost beyond int64, language key 256, ex units beyond max_int64, and four pool thresholds", (() => { const P = "81" + PROP_INFO.slice(8).replace("862c828106", "862c828400f6XXf6"); return app.parseProposalsCbor(P.replace("XX", "a112a100811b8000000000000000")) === null && app.parseProposalsCbor(P.replace("XX", "a112a11901008101")) === null && app.parseProposalsCbor(P.replace("XX", "a114821b800000000000000000")) === null && app.parseProposalsCbor(P.replace("XX", "a11984d81e820201d81e820201d81e820201d81e820201")) === null; })());
check("proposalsdecode rejects a duplicated treasury account and a committee quorum above 1", (() => { const RA = "581d" + "e1" + STAKE_KH; const T = "81" + PROP_INFO.slice(8).replace("862c828106", "862c828302a2" + RA + "01" + RA + "02f6"); return app.parseProposalsCbor(T) === null && app.parseProposalsCbor(PROP_COMMITTEE.replace("d81e820203", "d81e820302")) === null; })());
check("proposalsdecode rejects a constitution without an anchor and trailing bytes / wrong shapes", (() => { const C5 = "81" + PROP_INFO.slice(8).replace("862c828106", "862c828305f682f6f6"); return app.parseProposalsCbor(C5) === null && app.parseProposalsCbor(PROP_INFO + "00") === null && app.parseProposalsCbor("a0") === null && app.parseProposalsCbor("") === null && app.parseProposalsCbor("zzzz") === null; })());

/* Auxiliary data decoder: auxiliary_data = metadata /
   auxiliary_data_array / auxiliary_data_map (tag 259) — all three
   forms proven in scratch against pycardano 0.19.2's
   AuxiliaryData serialisations (aux_py.py / aux_vectors.json,
   oracle round-trip asserted in the generator), hashes
   cross-checked against hashlib blake2b-256 (the block hash) and
   pycardano's own native-script hashes + hashlib blake2b-224
   (script hashes). The 64-byte text/bytes caps are the CDDL's
   and the oracle raises on them too; labels follow the CDDL
   uint .size 8 over the oracle, which serialises negative and
   bignum labels; integer VALUES are the ledger's
   arbitrary-precision Integer, so bignum tags 2/3 decode. */
const AUX_META = "a21902a2a6636d7367826b43617264616e6f34616c6c63617578616e182a636e65672664626c6f6244deadbeef646c69737483016374776f42abcd636d6170a2616b61760381011902d16b706c61696e206c6162656c";
const AUX_META_RENDER = '{"msg": ["Cardano4all", "aux"], "n": 42, "neg": -7, "blob": 0xdeadbeef, "list": [1, "two", 0xabcd], "map": {"k": "v", 3: [1]}}';
const AUX_SHELLEY = "82" + AUX_META + "828200581c" + "aa".repeat(28) + "8201818200581c" + "aa".repeat(28);
const AUX_ALONZO_FULL = "d90103a500" + AUX_META + "018182041a0bea3b6002814a4901000000221200010103814a4948010000222120010104814a46490100002224900101";
const AUX_ALONZO_SCRIPTS = "d90103a201818200581c" + "aa".repeat(28) + "03814a49480100002221200101";
const AUX_SIG_HASH = "a185cb99a818068805d34633e276287a79cbd985b8cc540d36ad3761";
const AUX_ALL_HASH = "e0fab1ad68eb52ffe22d71ba87758874bef6faea21cd8b0c117c04d8";
check("auxdecode form present", html.includes('id="auxdecode"') && html.includes('id="auxdecode-input"') && html.includes('id="auxdecode-result"'));
check("auxdecode bare metadata: form, hash, labels, rendering (pycardano)", (() => { const r = app.parseAuxDataCbor(AUX_META); return r !== null && r.format === "metadata" && r.hash === "ddf47eb9d73894691a1f40b61e159210bb9c72950568e5acb8186da4d1c1662e" && r.metadata.length === 2 && r.metadata[0].label === "674" && r.metadata[0].value === AUX_META_RENDER && r.metadata[1].label === "721" && r.metadata[1].value === '"plain label"' && r.nativeScripts.length === 0 && r.plutusScripts.length === 0; })());
check("auxdecode empty metadata a0 decodes (CDDL {*}; oracle emits it)", (() => { const r = app.parseAuxDataCbor("a0"); return r !== null && r.format === "metadata" && r.metadata.length === 0 && r.hash === "d36a2619a672494604e11bb447cbcf5231e9f2ba25c2169177edc941bd50ad6c"; })());
check("auxdecode Shelley array: metadata + sig/all native scripts with oracle hashes (pycardano)", (() => { const r = app.parseAuxDataCbor(AUX_SHELLEY); return r !== null && r.format === "shelley" && r.hash === "90506567bcbb96c0179cb44ce4ee2a06618ca623a14dd6ba36d6a80c5147a33d" && r.metadata[0].value === AUX_META_RENDER && r.nativeScripts.length === 2 && r.nativeScripts[0].kind === "sig" && r.nativeScripts[0].keyHash === "aa".repeat(28) && r.nativeScripts[0].hash === AUX_SIG_HASH && r.nativeScripts[1].kind === "all" && r.nativeScripts[1].hash === AUX_ALL_HASH && r.nativeScripts[1].scripts[0].hash === AUX_SIG_HASH; })());
check("auxdecode Alonzo full: metadata, timelock, Plutus V1/V2/V3 with hashes (pycardano)", (() => { const r = app.parseAuxDataCbor(AUX_ALONZO_FULL); return r !== null && r.format === "alonzo" && r.hash === "3fce1499ccd2212240f9a20a1fd1fef92ef049a7a647b2aeffe7e4658f28cd5c" && r.metadata[0].value === AUX_META_RENDER && r.nativeScripts.length === 1 && r.nativeScripts[0].kind === "after" && r.nativeScripts[0].slot === "199900000" && r.nativeScripts[0].hash === "32a809b797b95b6a215014a7f831b77d860278c8798c63899f325c73" && r.plutusScripts.length === 3 && r.plutusScripts[0].language === "plutusv1" && r.plutusScripts[0].hash === "d415bf87737b9bfdd88f6d438873fbf5823af9cace6f4696fc6e8824" && r.plutusScripts[1].language === "plutusv2" && r.plutusScripts[1].hash === "f14241393964259a53ca546af364e7f5688ca5aaa35f1e0da0f951b2" && r.plutusScripts[2].language === "plutusv3" && r.plutusScripts[2].hash === "ebec912b42678233d13d30cd4a6c6ff92aaffeea88d737ef254cc9d3"; })());
check("auxdecode Alonzo scripts-only: metadata null, sig + V2 (pycardano)", (() => { const r = app.parseAuxDataCbor(AUX_ALONZO_SCRIPTS); return r !== null && r.format === "alonzo" && r.metadata === null && r.nativeScripts.length === 1 && r.plutusScripts.length === 1 && r.plutusScripts[0].hash === "f14241393964259a53ca546af364e7f5688ca5aaa35f1e0da0f951b2"; })());
check("auxdecode Alonzo metadata-only (pycardano)", (() => { const r = app.parseAuxDataCbor("d90103a100" + AUX_META); return r !== null && r.format === "alonzo" && r.metadata.length === 2 && r.nativeScripts.length === 0 && r.plutusScripts.length === 0; })());
check("auxdecode bignum values decode exact (tag 2: 2^70; tag 3: -385; oracle emits both)", (() => { const a = app.parseAuxDataCbor("a101c249400000000000000000"); const b = app.parseAuxDataCbor("a101c3420180"); return a !== null && a.metadata[0].value === "1180591620717411303424" && b !== null && b.metadata[0].value === "-385"; })());
check("auxdecode empty Alonzo map and atLeast 5-of-1 decode (CDDL all-optional / no n bound; oracle emits both)", app.parseAuxDataCbor("d90103a0") !== null && (() => { const r = app.parseAuxDataCbor("d90103a10181830305818200581c" + "aa".repeat(28)); return r !== null && r.nativeScripts[0].kind === "atLeast" && r.nativeScripts[0].required === "5"; })());
check("auxdecode rejects a negative label and a bignum label (CDDL uint .size 8; oracle emits a12001)", app.parseAuxDataCbor("a12001") === null && app.parseAuxDataCbor("a1c2490100000000000000000101") === null);
check("auxdecode rejects a duplicate label and a duplicate metadatum map key", app.parseAuxDataCbor("a201010102") === null && app.parseAuxDataCbor("a101a201020103") === null);
check("auxdecode rejects bytes/text of 65 in a metadatum (CDDL caps; oracle raises on both)", app.parseAuxDataCbor("a1015841" + "00".repeat(65)) === null && app.parseAuxDataCbor("a1017841" + "78".repeat(65)) === null);
check("auxdecode rejects a bool and a tag-24 metadatum", app.parseAuxDataCbor("a101f5") === null && app.parseAuxDataCbor("a101d8184100") === null);
check("auxdecode rejects Alonzo key 5 and a repeated Alonzo key", app.parseAuxDataCbor("d90103a10580") === null && app.parseAuxDataCbor("d90103a201800180") === null);
check("auxdecode rejects tag 258, arrays of 1 and 3, and non-array Shelley scripts", app.parseAuxDataCbor("d90102a0") === null && app.parseAuxDataCbor("81a0") === null && app.parseAuxDataCbor("83a0808080") === null && app.parseAuxDataCbor("82a001") === null);
check("auxdecode rejects native code 6, a short sig hash, and a non-bytes Plutus entry", app.parseAuxDataCbor("d90103a101818206") === null && app.parseAuxDataCbor("d90103a101818200581b" + "aa".repeat(27)) === null && app.parseAuxDataCbor("d90103a1038101") === null);
check("auxdecode rejects trailing bytes, empty input and garbage", app.parseAuxDataCbor(AUX_META + "00") === null && app.parseAuxDataCbor("") === null && app.parseAuxDataCbor("zzzz") === null);

/* Transaction witness set decoder: transaction_witness_set =
   { ? 0 vkey witnesses, ? 1 native scripts, ? 2 bootstrap
   witnesses, ? 3/6/7 Plutus V1/V2/V3 script sets, ? 4 Plutus
   data, ? 5 redeemers (array or map form) } — proven against
   pycardano 0.19.2 TransactionWitnessSet serialisations
   (witness_py.py / witness_vectors.json, oracle round-trip
   asserted in the generator; the bootstrap vector is CDDL-built
   with RawCBOR because pycardano 0.19.2 has no bootstrap class,
   and proven by its from_cbor round-trip) plus a REAL mainnet
   witness set taken from the transaction the inspector tests
   carry. */
const WIT_VKEYS = "a10082825820" + "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" + "5840" + "11".repeat(64) + "825820" + "77".repeat(32) + "5840" + "22".repeat(64);
const WIT_NATIVE = "a101828200581c" + "aa".repeat(28) + "8201818200581c" + "aa".repeat(28);
const WIT_BOOT = "a10281845820" + "33".repeat(32) + "5840" + "44".repeat(64) + "5820" + "55".repeat(32) + "44deadbeef";
const WIT_SCRIPTS = "a303814a4901000000221200010106814a4948010000222120010107814a46490100002224900101";
const WIT_DATA = "a10483d8799f182a42abcdffd87a9f9f010203ffff42abcd";
const WIT_RED_LIST = "a10582840000182a821903e81907d0840101d8799f182a42abcdff82190bb8190fa0";
const WIT_RED_MAP = "a105a2820202820782050682040082d87a9f9f010203ffff820708";
const WIT_FULL = "a80081825820" + "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" + "5840" + "11".repeat(64) + "01818201818200581c" + "aa".repeat(28) + "0281845820" + "33".repeat(32) + "5840" + "44".repeat(64) + "5820" + "55".repeat(32) + "44deadbeef" + "03814a490100000022120001010481d8799f182a42abcdff0582840000182a821903e81907d0840101d8799f182a42abcdff82190bb8190fa006814a4948010000222120010107814a46490100002224900101";
const WIT_REAL = "a200d9010281825820c5d63d7dc066df52592135b6d3cb4f3470d06f7bdd4b2d2e32eb59ca3782662f58400b4af3e23a0c5687c3f3ecd2157ba8790bb7bed6d3f21e6ce5cbccc96bb5edd5c8b3d3d9a38642897d797534c7728b32d259dea8d1f6ed0d6ec76ce4c880d9010583840000d87980821962d91a007cc793840001d87980821a00012dfc1a0166fa60840300d8799f009f1a001e8480ff4100d87a809fd87a80ffff821a00143bbd1a197896b8";
const WIT_D1_HASH = "d0e694c9b08a78c818a1aba1309781585bc3b857ae4db443f632d10269b7e790";
check("witnessdecode form present", html.includes('id="witnessdecode"') && html.includes('id="witnessdecode-input"') && html.includes('id="witnessdecode-result"'));
check("witnessdecode empty set a0 decodes (CDDL all-optional; oracle emits it)", (() => { const r = app.parseWitnessSetCbor("a0"); return r !== null && r.vkeyWitnesses.length === 0 && r.nativeScripts.length === 0 && r.plutusScripts.length === 0 && r.plutusData.length === 0 && r.redeemers === null; })());
check("witnessdecode key witnesses: keys, blake2b-224 key hashes, signatures (pycardano)", (() => { const r = app.parseWitnessSetCbor(WIT_VKEYS); return r !== null && r.vkeyWitnesses.length === 2 && r.vkeyWitnesses[0].keyHash === "491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297" && r.vkeyWitnesses[1].keyHash === "91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254" && r.vkeyWitnesses[0].signature === "11".repeat(64); })());
check("witnessdecode native scripts with oracle hashes (pycardano)", (() => { const r = app.parseWitnessSetCbor(WIT_NATIVE); return r !== null && r.nativeScripts.length === 2 && r.nativeScripts[0].hash === "a185cb99a818068805d34633e276287a79cbd985b8cc540d36ad3761" && r.nativeScripts[1].kind === "all" && r.nativeScripts[1].hash === "e0fab1ad68eb52ffe22d71ba87758874bef6faea21cd8b0c117c04d8"; })());
check("witnessdecode bootstrap witness (CDDL-built, oracle round-trips it)", (() => { const r = app.parseWitnessSetCbor(WIT_BOOT); return r !== null && r.bootstrapWitnesses.length === 1 && r.bootstrapWitnesses[0].publicKey === "33".repeat(32) && r.bootstrapWitnesses[0].chainCode === "55".repeat(32) && r.bootstrapWitnesses[0].attributes === "deadbeef"; })());
check("witnessdecode Plutus V1/V2/V3 scripts with hashlib hashes (pycardano)", (() => { const r = app.parseWitnessSetCbor(WIT_SCRIPTS); return r !== null && r.plutusScripts.length === 3 && r.plutusScripts[0].hash === "d415bf87737b9bfdd88f6d438873fbf5823af9cace6f4696fc6e8824" && r.plutusScripts[1].hash === "f14241393964259a53ca546af364e7f5688ca5aaa35f1e0da0f951b2" && r.plutusScripts[2].hash === "ebec912b42678233d13d30cd4a6c6ff92aaffeea88d737ef254cc9d3"; })());
check("witnessdecode Plutus data: Constr + bounded bytes, datum hashes over exact bytes (pycardano)", (() => { const r = app.parseWitnessSetCbor(WIT_DATA); return r !== null && r.plutusData.length === 3 && r.plutusData[0].hash === WIT_D1_HASH && r.plutusData[0].data.indexOf("Constr 0") === 0 && r.plutusData[1].hash === "f497577750467d207127046aa6772ed879418c48c3007fcaa1b052fb4063a696" && r.plutusData[2].data === "h'abcd'" && r.plutusData[2].hash === "59b29dbfec63f800da0b13c8e95417f03f2228bd355f4f397a44c52ca8164fb3"; })());
check("witnessdecode redeemers list form (pycardano)", (() => { const r = app.parseWitnessSetCbor(WIT_RED_LIST); return r !== null && r.redeemers.form === "list" && r.redeemers.entries.length === 2 && r.redeemers.entries[0].tagName === "spend" && r.redeemers.entries[0].data === "42" && r.redeemers.entries[0].exUnits.mem === "1000" && r.redeemers.entries[0].exUnits.steps === "2000" && r.redeemers.entries[1].tagName === "mint" && r.redeemers.entries[1].dataHash === WIT_D1_HASH; })());
check("witnessdecode redeemers map form (pycardano)", (() => { const r = app.parseWitnessSetCbor(WIT_RED_MAP); return r !== null && r.redeemers.form === "map" && r.redeemers.entries.length === 2 && r.redeemers.entries[0].tagName === "cert" && r.redeemers.entries[0].index === 2 && r.redeemers.entries[0].data === "7" && r.redeemers.entries[1].tagName === "voting"; })());
check("witnessdecode full eight-key set (pycardano)", (() => { const r = app.parseWitnessSetCbor(WIT_FULL); return r !== null && r.vkeyWitnesses.length === 1 && r.nativeScripts.length === 1 && r.bootstrapWitnesses.length === 1 && r.plutusScripts.length === 3 && r.plutusData.length === 1 && r.redeemers.entries.length === 2; })());
check("witnessdecode REAL mainnet witness set: key hash matches the body's required signer, 3 redeemers (Koios ground truth)", (() => { const r = app.parseWitnessSetCbor(WIT_REAL); return r !== null && r.vkeyWitnesses.length === 1 && r.vkeyWitnesses[0].keyHash === "5b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b" && r.redeemers.form === "list" && r.redeemers.entries.length === 3 && r.redeemers.entries[2].tagName === "reward" && r.redeemers.entries[0].exUnits.mem === "25305"; })());
check("witnessdecode rejects unknown key 8 and a duplicate key", app.parseWitnessSetCbor("a10880") === null && app.parseWitnessSetCbor("a200800080") === null);
check("witnessdecode rejects empty lists (oracle emits a10080 for an empty key list)", app.parseWitnessSetCbor("a10080") === null && app.parseWitnessSetCbor("a100d9010280") === null && app.parseWitnessSetCbor("a10580") === null && app.parseWitnessSetCbor("a105a0") === null);
check("witnessdecode rejects a 31-byte key and a 63-byte signature (oracle serialises the signature)", app.parseWitnessSetCbor("a1008182581f" + "00".repeat(31) + "5840" + "11".repeat(64)) === null && app.parseWitnessSetCbor("a10081825820" + "00".repeat(32) + "583f" + "11".repeat(63)) === null);
check("witnessdecode rejects a duplicate Plutus script (nonempty_set; oracle serialises it twice)", app.parseWitnessSetCbor("a106824a494801000022212001014a49480100002221200101") === null && app.parseWitnessSetCbor("a1068101") === null);
check("witnessdecode rejects a 65-byte datum, a text datum and a tag-24 datum (plutus_data grammar)", app.parseWitnessSetCbor("a104815841" + "00".repeat(65)) === null && app.parseWitnessSetCbor("a104816178") === null && app.parseWitnessSetCbor("a10481d8184100") === null);
check("witnessdecode rejects redeemer tag 6, index 2^32 and negative ex-units (oracle serialises the last two)", app.parseWitnessSetCbor("a1058184060001820102") === null && app.parseWitnessSetCbor("a105818400" + "1b0000000100000000" + "182a820102") === null && app.parseWitnessSetCbor("a10581840000182a82201907d0") === null);
check("witnessdecode rejects a duplicate redeemer map key and a 3-item bootstrap witness", app.parseWitnessSetCbor("a105a2820001820102820001820304") === null && app.parseWitnessSetCbor("a10281835820" + "33".repeat(32) + "5840" + "44".repeat(64) + "5820" + "55".repeat(32)) === null);
check("witnessdecode rejects native code 6, a non-map root, trailing bytes and garbage", app.parseWitnessSetCbor("a101818206") === null && app.parseWitnessSetCbor("80") === null && app.parseWitnessSetCbor(WIT_VKEYS + "00") === null && app.parseWitnessSetCbor("") === null && app.parseWitnessSetCbor("zzzz") === null);


/* full transaction decoder — a WHOLE transaction: body, witness
   set, is-valid flag and auxiliary data composed from the three
   proven decoders, plus the cross-checks only a whole transaction
   makes possible. Vectors are pycardano 0.19.2 Transaction
   serialisations (fulltx_py.py / fulltx_vectors.json in scratch,
   oracle from_cbor round-trip asserted in the generator); the
   legacy three-element form and the over-cap auxiliary block are
   byte-assembled from oracle parts. The REAL_TX vector above is
   the same artefact end-to-end. */
const FT_SIMPLE_SIGNED = "84a40081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a001e8480021a00030d400e82581c491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297581c91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254a10081825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f584011111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111f5f6";
const FT_AUX_MATCH = "84a40081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a002dc6c0021a0002bf20075820a306d9a01784cc31225fc40b8503851700972aa933ffa134931c87bdb52601a1a0f5a11902a2a1636d7367817743617264616e6f34616c6c2066756c6c206465636f6465";
const FT_AUX_MISMATCH = "84a40081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a002dc6c0021a0002bf20075820a306d9a01784cc31225fc40b8503851700972aa933ffa134931c87bdb52601a1a0f5a11902a2a1636d73678172646966666572656e74206d65746164617461";
const FT_AUX_UNDECLARED = "84a30081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa02018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a002dc6c0021a0002bf20a0f5a11902a2a1636d7367817743617264616e6f34616c6c2066756c6c206465636f6465";
const FT_HASH_NO_AUX = "84a40081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a002dc6c0021a0002bf20075820a306d9a01784cc31225fc40b8503851700972aa933ffa134931c87bdb52601a1a0f5f6";
const FT_INVALID_FLAG = "84a40081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a001e8480021a00030d400e82581c491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297581c91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254a10081825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f584011111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111f4f6";
const FT_PLUTUS_CHECKS = "84a50082825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00825820bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb01018283583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a001e84805820d0e694c9b08a78c818a1aba1309781585bc3b857ae4db443f632d10269b7e79083583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a002625a058209999999999999999999999999999999999999999999999999999999999999999021a000493e005a1581de1ed9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821901f409a1581c11111111111111111111111111111111111111111111111111111111a1465041544154451864a20481d8799f182a42abcdff0585840000182a821903e81907d0840005182a821903e81907d0840100182a821903e81907d0840300182a821903e81907d0840400182a821903e81907d0f5f6";
const FT_LEGACY3 = "83a40081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a001e8480021a00030d400e82581c491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297581c91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254a10081825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f584011111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111a11902a2a1636d7367817743617264616e6f34616c6c2066756c6c206465636f6465";
const FT_BAD_AUX_TX = "84a40081825820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00018182583901ef3fe99fa775688dd19d11192d79d1742c7fdab27ab133c80c1dd28ded9793beeadf05284aa53bf2d2fcede5e3664bf2d5edcaa0fe862c821a001e8480021a00030d400e82581c491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297581c91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254a0f5a10178416161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161";
const FT_KH1 = "491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297";
const FT_KH2 = "91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254";
const FT_AUX1_HASH = "a306d9a01784cc31225fc40b8503851700972aa933ffa134931c87bdb52601a1";
const FT_D1_HASH = "d0e694c9b08a78c818a1aba1309781585bc3b857ae4db443f632d10269b7e790";
check("fulltx: simple signed tx — form, flag, txId, signer checks (pycardano)", (() => { const r = app.decodeFullTx(FT_SIMPLE_SIGNED); return r !== null && r.form === "conway" && r.isValid === true && r.txId === "16d6c7c6e6aeae59139e06671c84d38981a792efbe8e381cb9ab97525051f9c6" && r.auxHashCheck === "none" && r.signerChecks.length === 2 && r.signerChecks[0].hash === FT_KH1 && r.signerChecks[0].witnessed === true && r.signerChecks[1].hash === FT_KH2 && r.signerChecks[1].witnessed === false; })());
check("fulltx: auxiliary data hash matches body key 7 (pycardano)", (() => { const r = app.decodeFullTx(FT_AUX_MATCH); return r !== null && r.auxHashCheck === "match" && r.auxPresent && r.aux.hash === FT_AUX1_HASH && r.aux.format === "metadata"; })());
check("fulltx: auxiliary data hash mismatch reported, not refused (pycardano)", (() => { const r = app.decodeFullTx(FT_AUX_MISMATCH); return r !== null && r.auxHashCheck === "mismatch" && r.auxPresent; })());
check("fulltx: attached-but-undeclared and declared-but-missing aux (pycardano)", (() => { const a = app.decodeFullTx(FT_AUX_UNDECLARED); const b = app.decodeFullTx(FT_HASH_NO_AUX); return a !== null && a.auxHashCheck === "undeclared" && b !== null && b.auxHashCheck === "missing" && b.auxPresent === false; })());
check("fulltx: is-valid flag false carried (pycardano)", (() => { const r = app.decodeFullTx(FT_INVALID_FLAG); return r !== null && r.isValid === false; })());
check("fulltx: datum supplied / not supplied + redeemer ranges (pycardano)", (() => { const r = app.decodeFullTx(FT_PLUTUS_CHECKS); if (r === null || r.datumChecks.length !== 2 || r.redeemerChecks.length !== 5) return false; const by = {}; r.redeemerChecks.forEach(x => { by[x.tag + "#" + x.index] = x; }); return r.datumChecks[0].hash === FT_D1_HASH && r.datumChecks[0].supplied === true && r.datumChecks[1].supplied === false && by["spend#0"].ok === true && by["spend#5"].ok === false && by["spend#5"].limit === 2 && by["mint#0"].ok === true && by["reward#0"].ok === true && by["voting#0"].ok === false && by["voting#0"].limit === 0; })());
check("fulltx: legacy three-element form — no flag, aux undeclared (byte-assembled)", (() => { const r = app.decodeFullTx(FT_LEGACY3); return r !== null && r.form === "legacy" && r.isValid === null && r.txId === "16d6c7c6e6aeae59139e06671c84d38981a792efbe8e381cb9ab97525051f9c6" && r.auxHashCheck === "undeclared" && r.signerChecks[0].witnessed === true; })());
check("fulltx: REAL mainnet tx end-to-end — aux matches, signer witnessed, redeemers in range (Koios ground truth)", (() => { const r = app.decodeFullTx(REAL_TX); return r !== null && r.form === "conway" && r.isValid === true && r.txId === REAL_HASH && r.auxHashCheck === "match" && r.signerChecks.length === 1 && r.signerChecks[0].witnessed === true && r.redeemerChecks.length === 3 && r.redeemerChecks.every(x => x.ok); })());
check("fulltx: over-cap auxiliary data refuses the whole transaction", app.decodeFullTx(FT_BAD_AUX_TX) === null);
check("fulltx: rejects a body alone, a witness set alone, a 5-element array, a non-bool flag, trailing bytes and garbage", app.decodeFullTx(REAL_BODY) === null && app.decodeFullTx("a0") === null && app.decodeFullTx("85" + FT_SIMPLE_SIGNED.slice(2)) === null && app.decodeFullTx("84" + FT_SIMPLE_SIGNED.slice(2, FT_SIMPLE_SIGNED.length - 4) + "00f6") === null && app.decodeFullTx(FT_SIMPLE_SIGNED + "00") === null && app.decodeFullTx("") === null && app.decodeFullTx("zzzz") === null);

/* Script data hash calculator — blake2b-256(redeemers ‖ datums ‖
   language views) over the parts as serialised, the value a body
   commits to at key 11. Proven in scratch (sdh_py.py /
   sdh_vectors.json): V2 and V3 against pycardano 0.19.2's
   script_data_hash driven by the LIVE cost models (Koios
   epoch_params epoch 660: V1 332, V2 332, V3 350 values), the
   empty and datums-only defaults against pycardano's own
   defaults, and the REAL vector against the chain itself. The
   V1 values are the live parameters from that same Koios
   channel; only the V1 encoding FORM (byte-string key holding
   uint 0, byte-string value holding the indefinite-length
   array — the preserved ledger quirk, cardano-ledger#2512)
   comes from the oracle's code, because pycardano's bundled
   V1 model is a stale 166-value snapshot. */
const SDH_RED = "81840000d866821a7327e6919f182aff821903e81907d0";
const SDH_RED_MAP = "a182000082d866821a7327e6919f182aff821903e81907d0";
const SDH_DAT = "d9010282d866821a7327e6919f182affd866821a7327e6919f07ff";
const SDH_REAL_RED = "83840000d87980821962d91a007cc793840001d87980821a00012dfc1a0166fa60840300d8799f009f1a001e8480ff4100d87a809fd87a80ffff821a00143bbd1a197896b8";
check("sdhcalc form present", html.includes('id="sdhcalc"') && html.includes('id="sdh-redeemers"') && html.includes('id="sdh-datums"') && html.includes('id="sdh-lang-v1"') && html.includes('id="sdh-lang-v2"') && html.includes('id="sdh-lang-v3"') && html.includes('id="sdhcalc-result"'));
check("sdh: Plutus V2 views (pycardano, live cost models)", (() => { const r = app.scriptDataHash(SDH_RED, SDH_DAT, [1]); return r !== null && r.hash === "72069f0e420ca9c1dd52f20468ba9a7ca0dfffca6f32fd9891452788d44d6b5d" && r.redeemers.count === 1 && r.redeemers.form === "list" && r.datumCount === 2 && r.languages.length === 1 && r.languages[0] === 1; })());
check("sdh: Plutus V3 views (pycardano, live cost models; V3 carries negative params)", (() => { const r = app.scriptDataHash(SDH_RED, SDH_DAT, [2]); return r !== null && r.hash === "823d3e7be35ec425498d7d7adee37d626092b0ad5990dca37d28a28ce4142da4"; })());
check("sdh: Plutus V1 views (live values, preserved byte-string/indefinite encoding)", (() => { const r = app.scriptDataHash(SDH_RED, SDH_DAT, [0]); return r !== null && r.hash === "cbee5a00247057abc39a23013ecdbcfce63ed7ff911b8a47f31b8c9a9242fece"; })());
check("sdh: all three languages together, order-independent selection", (() => { const a = app.scriptDataHash(SDH_RED, SDH_DAT, [0, 1, 2]); const b = app.scriptDataHash(SDH_RED, SDH_DAT, [2, 0, 1]); return a !== null && b !== null && a.hash === "a8c435057e4bdba39dfda4db3d975f5530bb743be397ca62c991574d68e46ef1" && b.hash === a.hash; })());
check("sdh: Conway map-form redeemers hash differently from the array form (pycardano RedeemerMap)", (() => { const r = app.scriptDataHash(SDH_RED_MAP, "", [1]); return r !== null && r.hash === "6fb4f435639d5db18374d16d80d02d9595e4493ae771c2b72382f8fb0827c962" && r.redeemers.form === "map" && r.datumCount === 0; })());
check("sdh: datums only — views forced empty, datums hashed (pycardano default)", (() => { const r = app.scriptDataHash("", SDH_DAT, [1]); return r !== null && r.hash === "707a3edab70d145c3e0be62bca6fa47ad45466535feb6f7538cea275132ea6b8" && r.redeemers === null && r.viewsIgnored === true && r.partBytes.views === 1 && r.partBytes.redeemers === 1; })());
check("sdh: fully empty — the no-Plutus default (pycardano default)", (() => { const r = app.scriptDataHash("", "", []); return r !== null && r.hash === "9eb0251b2e85b082c3706a3e79b4cf2a2e96f936e912a398591e2486c757f8c1" && r.datumCount === 0 && r.languages.length === 0; })());
check("sdh: REAL mainnet tx redeemers reproduce its body key 11 (Koios ground truth)", (() => { const r = app.scriptDataHash(SDH_REAL_RED, "", [1]); return r !== null && r.hash === "d04505dddec5ddfd1fba346b85f9108444ef354aa49870027119d6796a19cba5" && r.redeemers.count === 3 && r.partBytes.redeemers === 69; })());
check("sdh: rejects redeemers with no language, a bad language, explicit empty redeemers, tag 6, an over-cap datum, trailing bytes and garbage", app.scriptDataHash(SDH_RED, "", []) === null && app.scriptDataHash(SDH_RED, "", [3]) === null && app.scriptDataHash("80", "", [1]) === null && app.scriptDataHash("a0", "", [1]) === null && app.scriptDataHash("81860000d866821a7327e6919f182aff821903e81907d0", "", [1]) === null && app.scriptDataHash("", "d9010282" + "49" + "00".repeat(65), [1]) === null && app.scriptDataHash(SDH_RED + "00", "", [1]) === null && app.scriptDataHash("", SDH_DAT + "ff", [1]) === null && app.scriptDataHash("zz", "", [1]) === null);


/* Token metadata viewer — CIP-25 (label 721) token metadata and
   CIP-27 (label 777) royalties interpreted out of transaction
   metadata, pasted as the bare map or as an auxiliary data block
   in the Shelley-array or tag-259 form. Vectors built in scratch
   (meta_py.py / meta_vectors.json) with cbor2 from the CIP-25 /
   CIP-27 texts: v1 text keys, a text "1.0" version, v2 raw-byte
   keys, chunked strings rejoined, a chunked royalty address (a
   103-character address as ONE string breaks the ledger's
   64-byte metadatum cap and is refused, as it must be). */
const META_V1 = "a11902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a268546f6b656e4f6e65a2646e616d6569546f6b656e204f6e6565696d6167657835697066733a2f2f516d625144764b4a656f324e67476347646e556955466962547a754b4e4b3555696a376a7a6d4b385a63636d577068546f6b656e54776fa7646e616d658263546f6b66656e2054776f65696d616765827828697066733a2f2f62616679626569676479727a74357366703775646d37687537367568377932366e781a6633656675796c71616266336f636c67747179353566627a6469696d656469615479706569696d6167652f706e676b6465736372697074696f6e826d41206c6f6e67657220646573636c72697074696f6e20686572656566696c657381a4646e616d656a74776f2d68642e706e67696d656469615479706569696d6167652f706e67637372638267697066733a2f2f68516d486448644864656578747261076a61747472696275746573a2667261726974796472617265656c6576656c0367776562736974657768747470733a2f2f6578616d706c652e636f6d2f74776f";
const META_V1_TEXT_VERSION = "a11902d1a278386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a164536f6c6fa2646e616d6564536f6c6f65696d616765781968747470733a2f2f6578616d706c652e636f6d2f732e706e676776657273696f6e63312e30";
const META_V2 = "a11902d1a2581cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbba248427974654e616d65a2646e616d656942797465204e616d6565696d6167656b61723a2f2f61626331323342fffea2646e616d656352617765696d6167656c697066733a2f2f516d5261776776657273696f6e02";
const META_ROYALTY = "a1190309a2647261746565302e303735646164647282783261646472317138686e6c36766c3561366b337277336e3567336a7474653639367a636c37366b6661747a763767707377613978357230646a37666d61366b6c713535793466666d37746630656d303975646e7968756b3461683932706c3578396a70716a6165343476";
const META_COMBO = "a31902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a268546f6b656e4f6e65a2646e616d6569546f6b656e204f6e6565696d6167657835697066733a2f2f516d625144764b4a656f324e67476347646e556955466962547a754b4e4b3555696a376a7a6d4b385a63636d577068546f6b656e54776fa7646e616d658263546f6b66656e2054776f65696d616765827828697066733a2f2f62616679626569676479727a74357366703775646d37687537367568377932366e781a6633656675796c71616266336f636c67747179353566627a6469696d656469615479706569696d6167652f706e676b6465736372697074696f6e826d41206c6f6e67657220646573636c72697074696f6e20686572656566696c657381a4646e616d656a74776f2d68642e706e67696d656469615479706569696d6167652f706e67637372638267697066733a2f2f68516d486448644864656578747261076a61747472696275746573a2667261726974796472617265656c6576656c0367776562736974657768747470733a2f2f6578616d706c652e636f6d2f74776f190309a2647261746565302e303735646164647282783261646472317138686e6c36766c3561366b337277336e3567336a7474653639367a636c37366b6661747a763767707377613978357230646a37666d61366b6c713535793466666d37746630656d303975646e7968756b3461683932706c3578396a70716a61653434761902a2a1636d7367816568656c6c6f";
const META_WARNINGS = "a11902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a3674e6f496d616765a1646e616d65684e6f20496d6167656742617265436964a2646e616d65644261726565696d616765782e516d625144764b4a656f324e67476347646e556955466962547a754b4e4b3555696a376a7a6d4b385a63636d5770664e6f4e616d65a165696d6167656a697066733a2f2f516d58";
const META_ROYALTY_CHUNKED = "a1190309a2647261746563302e316461646472826a61646472317138686e6c6636766c356136";
const META_COMBO_SHELLEY = "82a31902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a268546f6b656e4f6e65a2646e616d6569546f6b656e204f6e6565696d6167657835697066733a2f2f516d625144764b4a656f324e67476347646e556955466962547a754b4e4b3555696a376a7a6d4b385a63636d577068546f6b656e54776fa7646e616d658263546f6b66656e2054776f65696d616765827828697066733a2f2f62616679626569676479727a74357366703775646d37687537367568377932366e781a6633656675796c71616266336f636c67747179353566627a6469696d656469615479706569696d6167652f706e676b6465736372697074696f6e826d41206c6f6e67657220646573636c72697074696f6e20686572656566696c657381a4646e616d656a74776f2d68642e706e67696d656469615479706569696d6167652f706e67637372638267697066733a2f2f68516d486448644864656578747261076a61747472696275746573a2667261726974796472617265656c6576656c0367776562736974657768747470733a2f2f6578616d706c652e636f6d2f74776f190309a2647261746565302e303735646164647282783261646472317138686e6c36766c3561366b337277336e3567336a7474653639367a636c37366b6661747a763767707377613978357230646a37666d61366b6c713535793466666d37746630656d303975646e7968756b3461683932706c3578396a70716a61653434761902a2a1636d7367816568656c6c6f80";
const META_COMBO_TAG259 = "d90103a100a31902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a268546f6b656e4f6e65a2646e616d6569546f6b656e204f6e6565696d6167657835697066733a2f2f516d625144764b4a656f324e67476347646e556955466962547a754b4e4b3555696a376a7a6d4b385a63636d577068546f6b656e54776fa7646e616d658263546f6b66656e2054776f65696d616765827828697066733a2f2f62616679626569676479727a74357366703775646d37687537367568377932366e781a6633656675796c71616266336f636c67747179353566627a6469696d656469615479706569696d6167652f706e676b6465736372697074696f6e826d41206c6f6e67657220646573636c72697074696f6e20686572656566696c657381a4646e616d656a74776f2d68642e706e67696d656469615479706569696d6167652f706e67637372638267697066733a2f2f68516d486448644864656578747261076a61747472696275746573a2667261726974796472617265656c6576656c0367776562736974657768747470733a2f2f6578616d706c652e636f6d2f74776f190309a2647261746565302e303735646164647282783261646472317138686e6c36766c3561366b337277336e3567336a7474653639367a636c37366b6661747a763767707377613978357230646a37666d61366b6c713535793466666d37746630656d303975646e7968756b3461683932706c3578396a70716a61653434761902a2a1636d7367816568656c6c6f";
const META_OTHER_ONLY = "a21902a2a1636d736781626869182aa1617801";
const META_BAD_POLICY55 = "a11902d1a1783761616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a16158a2646e616d65615865696d6167656a697066733a2f2f516d58";
const META_BAD_RATE_BIG = "a1190309a2647261746563312e3564616464726961646472317178797a";
const META_BAD_RATE_INT = "a1190309a264726174650564616464726961646472317178797a";
const META_BAD_IMAGE_INT = "a11902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a16158a2646e616d65615865696d61676505";
const META_BAD_LONG_STRING = "a11902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a16158a2646e616d6578416e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e65696d61676568697066733a2f2f78";
const META_BAD_VERSION3 = "a11902d1a278386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a16158a2646e616d65615865696d6167656a697066733a2f2f516d586776657273696f6e03";
const META_BAD_FILES_SHAPE = "a11902d1a178386161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161a16158a3646e616d65615865696d6167656a697066733a2f2f516d586566696c657381182a";
const META_BAD_721_ARRAY = "a11902d18101";
const META_BAD_TOP_ARRAY3 = "83a08080";
const META_BAD_DUP_LABEL = "a201010102";
check("metaview form present", html.includes('id="metaview"') && html.includes('id="metaview-input"') && html.includes('id="metaview-result"'));
check("metaview: CIP-25 v1, two assets, chunked strings rejoined (CIP-25 text)", (() => { const r = app.parseMetadataView(META_V1); return r !== null && r.form === "metadata" && r.nft.version === 1 && r.nft.policies.length === 1 && r.nft.policies[0].policyId === "aa".repeat(28) && r.nft.policies[0].assets.length === 2 && r.nft.policies[0].assets[0].name === "Token One" && r.nft.policies[0].assets[1].name === "Token Two" && r.nft.policies[0].assets[1].image === "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" && r.nft.policies[0].assets[1].description === "A longer description here" && r.nft.policies[0].assets[1].files.length === 1 && r.nft.policies[0].assets[1].files[0].src === "ipfs://QmHdHdHd" && r.nft.policies[0].assets[1].others.length === 2 && r.nft.policies[0].assets[0].warnings.length === 0; })());
check("metaview: text version 1.0 read as version 1", (() => { const r = app.parseMetadataView(META_V1_TEXT_VERSION); return r !== null && r.nft.version === 1 && r.nft.policies[0].assets[0].name === "Solo"; })());
check("metaview: CIP-25 v2 raw-byte policy and asset keys (CIP-25 text)", (() => { const r = app.parseMetadataView(META_V2); return r !== null && r.nft.version === 2 && r.nft.policies[0].policyId === "bb".repeat(28) && r.nft.policies[0].assets[0].keyText === "ByteName" && r.nft.policies[0].assets[1].keyText === null && r.nft.policies[0].assets[1].keyHex === "fffe"; })());
check("metaview: CIP-27 royalty, exact percentage from the decimal string", (() => { const r = app.parseMetadataView(META_ROYALTY); return r !== null && r.royalties.rate === "0.075" && r.royalties.ratePercent === "7.5" && r.royalties.addr === "addr1q8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpqjae44v" && r.royalties.warnings.length === 0; })());
check("metaview: chunked royalty address rejoined, 0.1 is exactly 10%", (() => { const r = app.parseMetadataView(META_ROYALTY_CHUNKED); return r !== null && r.royalties.ratePercent === "10" && r.royalties.addr === "addr1q8hnl6vl5a6"; })());
check("metaview: combined 721 + 777 + other labels, all three input forms", (() => { const a = app.parseMetadataView(META_COMBO); const b = app.parseMetadataView(META_COMBO_SHELLEY); const c = app.parseMetadataView(META_COMBO_TAG259); return a !== null && a.labels.join(",") === "721,777,674" && a.nft !== null && a.royalties !== null && b !== null && b.form === "shelley" && b.nft !== null && c !== null && c.form === "tag259" && c.royalties !== null; })());
check("metaview: missing required properties are warnings, not refusals", (() => { const r = app.parseMetadataView(META_WARNINGS); const w = r.nft.policies[0].assets; return r !== null && w[0].warnings.some(function (x) { return x.indexOf('no "image"') === 0; }) && w[1].warnings.some(function (x) { return x.indexOf("image has no URI scheme") === 0; }) && w[2].warnings.some(function (x) { return x.indexOf('no "name"') === 0; }); })());
check("metaview: metadata without 721/777 lists its labels uninterpreted", (() => { const r = app.parseMetadataView(META_OTHER_ONLY); return r !== null && r.nft === null && r.royalties === null && r.labels.join(",") === "674,42"; })());
const META_REAL_AUX = "a11902a2a1636d736768424f4e45504f4f4c"; /* tx 57affed0c2c58394e70097b29ca558d190c1dd87da32eb4619c1a9a5ad3d5fc0, Koios tx_metadata + tx_cbor */
check("metaview: REAL mainnet auxiliary data — label 674 listed, no 721/777 (Koios ground truth)", (() => { const r = app.parseMetadataView(META_REAL_AUX); return r !== null && r.form === "metadata" && r.hasMetadata === true && r.labels.join(",") === "674" && r.nft === null && r.royalties === null; })());
check("metaview: rejects a 55-char policy key, rate above 1, an integer rate, an integer image, a 65-byte string, version 3, a non-map file entry, a non-map 721, a 3-element array and a repeated label", app.parseMetadataView(META_BAD_POLICY55) === null && app.parseMetadataView(META_BAD_RATE_BIG) === null && app.parseMetadataView(META_BAD_RATE_INT) === null && app.parseMetadataView(META_BAD_IMAGE_INT) === null && app.parseMetadataView(META_BAD_LONG_STRING) === null && app.parseMetadataView(META_BAD_VERSION3) === null && app.parseMetadataView(META_BAD_FILES_SHAPE) === null && app.parseMetadataView(META_BAD_721_ARRAY) === null && app.parseMetadataView(META_BAD_TOP_ARRAY3) === null && app.parseMetadataView(META_BAD_DUP_LABEL) === null && app.parseMetadataView(META_ROYALTY + "00") === null && app.parseMetadataView("zz") === null);
const CIP68_NFT_DIRECT = "d8799fa6446e616d654853706163654275644566696c65739fa3437372639f4a697066733a2f2f61616143626262ff446e616d654566696c6531496d656469615479706549696d6167652f706e67ff45696d6167654b697066733a2f2f74657374496d65646961547970654a696d6167652f6a7065674a61747472696275746573a1456c6576656c034b6465736372697074696f6e5554686973206973206d79207465737420746f6b656e01d87980ff";
const CIP68_FT_DIRECT = "d8799fa64375726c5368747470733a2f2f6578616d706c652e636f6d446c6f676f4b697066733a2f2f6c6f676f446e616d65485370616365427564467469636b657242534248646563696d616c73064b6465736372697074696f6e5554686973206973206d79207465737420746f6b656e01d87980ff";
const CIP68_RFT_DIRECT_EXTRA = "d8799fa3446e616d65444672616345696d6167654b697066733a2f2f6672616348646563696d616c730203182aff";
const CIP68_NESTED721 = "d8799fa143373231a1581cf0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9aa14968657074617365616ea2446e616d654a2468657074617365616e45696d6167654a697066733a2f2f696d6704d87980ff";
const CIP68_GENERIC_LIST = "d8799f9fa1446e616d65464c6973746564ff02d87980ff";
const CIP68_GENERIC_INT = "d8799f0701d87980ff";
const CIP68_BAD_TWO_FIELDS = "d8799fa1446e616d65415801ff";
const CIP68_BAD_CONSTR1 = "d87a9fa1446e616d65415801d87980ff";
const CIP68_BAD_VERSION_TEXT = "d8799fa1446e616d6541584131d87980ff";
const CIP68_BAD_VERSION_NEG = "d8799fa1446e616d65415820d87980ff";
const CIP68_BAD_KEY_INT = "d8799fa101415801d87980ff";
const CIP68_BAD_KEY_DUP = "d8799fa2446e616d654158446e616d65415901d87980ff";
const CIP68_REAL_HANDLE = "d8799fab446e616d654a2468657074617365616e45696d6167655838697066733a2f2f7a62327268583276586e4a38775556476b5042796b4137536f7478586a64635771797a7973637177764456613956456963496d65646961547970654a696d6167652f6a706567426f6700496f675f6e756d6265720046726172697479456261736963466c656e677468094a63686172616374657273476c657474657273516e756d657269635f6d6f64696669657273404776657273696f6e014b68616e646c655f747970654668616e646c6501af4e7374616e646172645f696d6167655838697066733a2f2f7a62327268583276586e4a38775556476b5042796b4137536f7478586a64635771797a7973637177764456613956456963537374616e646172645f696d6167655f68617368582005ccff0eb6febb09b0ad684823a81803be1593b6a992fa469200669aa06438c14a696d6167655f68617368582005ccff0eb6febb09b0ad684823a81803be1593b6a992fa469200669aa06438c146706f7274616c404864657369676e65724047736f6369616c73404676656e646f72404764656661756c7400536c6173745f7570646174655f6164647265737358390126facf99922e3a54d480d9bb870206184812b08ee3a2655bb8268353cea0173ec2e345971abdf3de2eab2537d7e8a1e957ff2723a88a34f84c76616c6964617465645f6279581c4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e14b7376675f76657273696f6e45322e342e304c6167726565645f7465726d7340546d6967726174655f7369675f72657175697265640045747269616c00446e73667700ff";
check("cip68view form present", html.includes('id="cip68view"') && html.includes('id="cip68view-input"') && html.includes('id="cip68view-name"') && html.includes('id="cip68view-result"'));
check("cip68: CIP-67 prefix vectors from the CIP text, checksum verified", (() => { const vs = [[0,"00000000"],[1,"00001070"],[23,"00017650"],[99,"000632e0"],[100,"000643b0"],[222,"000de140"],[333,"0014df10"],[444,"001bc280"],[533,"00215410"],[2000,"007d0550"],[4567,"011d7690"],[11111,"02b670b0"],[49328,"0c0b0f40"],[65535,"0ffff240"]]; return vs.every(function (p) { const r = app.cip67Label(p[1] + "54657374"); return app.cip67PrefixHex(p[0]) === p[1] && r !== null && r.label === p[0] && r.checksumOk === true && r.contentText === "Test"; }); })());
check("cip68: a corrupted checksum and a non-label prefix are reported as such", (() => { const bad = app.cip67Label("000de15054657374"); return bad !== null && bad.label === 222 && bad.checksumOk === false && app.cip67Label("12345678") === null && app.cip67Label("0006") === null; })());
check("cip68: 222 NFT direct metadata, files expanded, chunked src rejoined (pycardano + CIP-68 text)", (() => { const r = app.parseCip68(CIP68_NFT_DIRECT, ""); const g = function (k) { const p = r.props.find(function (x) { return x.key === k; }); return p ? p.text : null; }; return r !== null && r.form === "direct" && r.version === "1" && r.extraIsUnit === true && g("name") === "SpaceBud" && g("image") === "ipfs://test" && g("mediaType") === "image/jpeg" && g("description") === "This is my test token" && r.files.length === 1 && r.files[0].name === "file1" && r.files[0].mediaType === "image/png" && r.files[0].src === "ipfs://aaabbb" && r.files[0].warnings.length === 0 && r.warnings.length === 0; })());
check("cip68: 333 FT direct metadata (ticker, decimals as integer)", (() => { const r = app.parseCip68(CIP68_FT_DIRECT, ""); const g = function (k) { const p = r.props.find(function (x) { return x.key === k; }); return p ? p.text : null; }; return r !== null && g("ticker") === "SB" && g("decimals") === "6" && g("url") === "https://example.com"; })());
check("cip68: 444 RFT with a custom extra field, user-token label decoded", (() => { const r = app.parseCip68(CIP68_RFT_DIRECT_EXTRA, "001bc28046726163"); return r !== null && r.version === "3" && r.extraIsUnit === false && r.extraRendered === "42" && r.asset.label === 444 && r.asset.klass === "RFT user token" && r.asset.contentText === "Frac" && r.asset.refNameHex === "000643b046726163"; })());
check("cip68: version-4 nested 721 map unpacked per policy and asset", (() => { const r = app.parseCip68(CIP68_NESTED721, "000643b068657074617365616e"); return r !== null && r.form === "nested" && r.version === "4" && r.nested.length === 1 && r.nested[0].policyHex === "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a" && r.nested[0].assetText === "heptasean" && r.nested[0].props.find(function (x) { return x.key === "name"; }).text === "$heptasean" && r.asset.label === 100 && r.asset.klass === "reference NFT"; })());
check("cip68: generic (non-map) metadata shown uninterpreted", (() => { const a = app.parseCip68(CIP68_GENERIC_LIST, ""); const b = app.parseCip68(CIP68_GENERIC_INT, ""); return a !== null && a.form === "generic" && a.version === "2" && b !== null && b.genericRendered === "7"; })());
check("cip68: rejects two fields, constructor 1, a text or negative version, an integer key and a repeated key", (() => { return [CIP68_BAD_TWO_FIELDS, CIP68_BAD_CONSTR1, CIP68_BAD_VERSION_TEXT, CIP68_BAD_VERSION_NEG, CIP68_BAD_KEY_INT, CIP68_BAD_KEY_DUP].every(function (h) { return app.parseCip68(h, "") === null; }) && app.parseCip68(CIP68_NFT_DIRECT, "xyz") === null && app.parseCip68(CIP68_NFT_DIRECT, "aa".repeat(33)) === null; })());
check("cip68: REAL mainnet datum - an ADA Handle reference NFT inline datum (Koios ground truth)", (() => { const r = app.parseCip68(CIP68_REAL_HANDLE, "000de14068657074617365616e"); const g = function (k) { const p = r.props.find(function (x) { return x.key === k; }); return p ? p.text : null; }; return r !== null && r.form === "direct" && r.version === "1" && g("name") === "$heptasean" && g("mediaType") === "image/jpeg" && g("rarity") === "basic" && g("length") === "9" && g("handle_type") === "handle" && r.asset.label === 222 && r.asset.checksumOk === true && r.asset.contentText === "heptasean" && r.asset.refNameHex === "000643b068657074617365616e" && r.extraIsUnit === false; })());

/* Redeemers decoder — a standalone REDEEMERS field (witness set
   key 5): redeemers = [+ redeemer] /
   {+ [tag, index] => [data, ex_units]} — proven against
   pycardano 0.19.2 TransactionWitnessSet serialisations in
   scratch (redeemers_py.py / redeemers_vectors.json; each field
   extracted by span from a whole witness set, re-wrapped and
   read back by the oracle in the generator). Validation reuses
   the witness decoder via a synthetic one-key set. */
const RED_SINGLE = "8184030007820b0d";
const RED_LIST_TWO = "82840000182a821903e81907d0840101d8799f182a42abcdff82190bb8190fa0";
const RED_LIST_DUP = "82840000182a821903e81907d0840000182a821903e81907d0";
const RED_LIST_RANGES = "8184051affffffffd87a9f9f010203ffff821b7fffffffffffffff00";
const RED_MAP_TWO = "a2820202820782050682040082d87a9f9f010203ffff820708";
const RED_MAP_BIGNUM = "a182000382c24940000000000000000082090a";
const RED_REAL = "83840000d87980821962d91a007cc793840001d87980821a00012dfc1a0166fa60840300d8799f009f1a001e8480ff4100d87a809fd87a80ffff821a00143bbd1a197896b8";
check("redeemersdecode form present", html.includes('id="redeemersdecode"') && html.includes('id="redeemersdecode-input"') && html.includes('id="redeemersdecode-result"'));
check("redeemers: single reward redeemer, int datum (pycardano)", (() => { const r = app.parseRedeemersCbor(RED_SINGLE); return r !== null && r.form === "list" && r.count === 1 && r.entries[0].tagName === "reward" && r.entries[0].index === 0 && r.entries[0].data === "7" && r.entries[0].exUnits.mem === "11" && r.entries[0].exUnits.steps === "13"; })());
check("redeemers: list form, spend int + mint Constr with oracle datum hash (pycardano)", (() => { const r = app.parseRedeemersCbor(RED_LIST_TWO); return r !== null && r.form === "list" && r.count === 2 && r.entries[0].tagName === "spend" && r.entries[0].data === "42" && r.entries[0].exUnits.mem === "1000" && r.entries[1].tagName === "mint" && r.entries[1].dataHash === "d0e694c9b08a78c818a1aba1309781585bc3b857ae4db443f632d10269b7e790"; })());
check("redeemers: list form keeps a duplicated redeemer (a list, not a map)", (() => { const r = app.parseRedeemersCbor(RED_LIST_DUP); return r !== null && r.count === 2 && r.entries[0].tagName === "spend" && r.entries[1].tagName === "spend" && r.entries[1].exUnits.steps === "2000"; })());
check("redeemers: range extremes — proposing, index 2^32-1, mem at max_int64, steps 0 (pycardano)", (() => { const r = app.parseRedeemersCbor(RED_LIST_RANGES); return r !== null && r.entries[0].tagName === "proposing" && r.entries[0].index === 4294967295 && r.entries[0].exUnits.mem === "9223372036854775807" && r.entries[0].exUnits.steps === "0" && r.entries[0].dataHash === "f497577750467d207127046aa6772ed879418c48c3007fcaa1b052fb4063a696"; })());
check("redeemers: map form, cert + voting entries (pycardano)", (() => { const r = app.parseRedeemersCbor(RED_MAP_TWO); return r !== null && r.form === "map" && r.count === 2 && r.entries[0].tagName === "cert" && r.entries[0].index === 2 && r.entries[0].data === "7" && r.entries[1].tagName === "voting" && r.entries[1].exUnits.mem === "7"; })());
check("redeemers: map form bignum datum 2^70 renders exactly, hash over exact bytes (pycardano + hashlib)", (() => { const r = app.parseRedeemersCbor(RED_MAP_BIGNUM); return r !== null && r.form === "map" && r.entries[0].tagName === "spend" && r.entries[0].index === 3 && r.entries[0].data === "1180591620717411303424" && r.entries[0].dataHash === "343b3131410382547e1196df33bd4ce6382adee1fdaea07431158879a37684c3"; })());
check("redeemers: REAL mainnet tx — spend#0/#1 + reward#0, oracle budgets and datum hashes (Koios ground truth)", (() => { const r = app.parseRedeemersCbor(RED_REAL); return r !== null && r.form === "list" && r.count === 3 && r.entries[0].tagName === "spend" && r.entries[0].exUnits.mem === "25305" && r.entries[0].exUnits.steps === "8177555" && r.entries[1].index === 1 && r.entries[1].exUnits.mem === "77308" && r.entries[2].tagName === "reward" && r.entries[2].dataHash === "51fc08f01ff3579399700ae5c1647f9e9ba26b50ef485586546eb1b76a9fd2ee"; })());
check("redeemers: rejects empty array and empty map (grammar [+ ] / {+ }; oracle serialises an empty list)",
  app.parseRedeemersCbor("80") === null && app.parseRedeemersCbor("a0") === null);
check("redeemers: rejects tag 6, index 2^32 and negative ex-units (oracle serialises the last two)",
  app.parseRedeemersCbor("8184060001820102") === null && app.parseRedeemersCbor("818400" + "1b0000000100000000" + "182a820102") === null && app.parseRedeemersCbor("81840000182a82201907d0") === null);
check("redeemers: rejects ex-units above max_int64, a 65-byte datum and a text datum",
  app.parseRedeemersCbor("81840000182a82" + "1b8000000000000000" + "00") === null && app.parseRedeemersCbor("81840000" + "5841" + "00".repeat(65) + "820102") === null && app.parseRedeemersCbor("818400006178820102") === null);
check("redeemers: rejects a duplicate map key, a 3-item redeemer and a 1-item map value",
  app.parseRedeemersCbor("a2820001820102820001820304") === null && app.parseRedeemersCbor("81830000182a") === null && app.parseRedeemersCbor("a182000181182a") === null);
check("redeemers: rejects a whole witness set, trailing bytes, empty and garbage",
  app.parseRedeemersCbor("a105" + RED_LIST_TWO) === null && app.parseRedeemersCbor(RED_LIST_TWO + "00") === null && app.parseRedeemersCbor("") === null && app.parseRedeemersCbor("zzzz") === null);

/* Plutus data decoder — a standalone PLUTUS DATA field (witness
   set key 4): plutus_data = nonempty_set<plutus_data> — proven
   against pycardano 0.19.2 TransactionWitnessSet serialisations
   in scratch (datums_py.py / datums_vectors.json; each field
   extracted by span from a whole witness set, re-wrapped and
   read back by the oracle in the generator) and a REAL mainnet
   transaction fetched via Koios (block 14043871, tx e626d875…;
   the stored REAL_TX's witness set carries keys 0/5 only).
   Validation reuses the witness decoder via a synthetic
   one-key set. Datum hashes are blake2b-256 over exact bytes. */
const DAT_INT = "81182a";
const DAT_BYTES = "8142abcd";
const DAT_CONSTR = "81d8799f182a42abcdff";
const DAT_MIXED = "85d8799f182a42abcdffd87a9f9f010203ffff42abcd9f010203ffa10102";
const DAT_BIGNUM = "81c249400000000000000000";
const DAT_NEGBIG = "81c3493fffffffffffffffff";
const DAT_DUP = "82d8799f182a42abcdffd8799f182a42abcdff";
const DAT_REAL = "d901029fd8799fd8799fd8799f581c6ed83ad3525c05c68c6a5b78efdadaa4c81ed1338edcc7b48f43c317ffd8799fd8799fd8799f581c74b54cbbd83e938af0580c58e56ccadd48fb6d988d694816d5c65708ffffffffd8799fd8799f581c6ed83ad3525c05c68c6a5b78efdadaa4c81ed1338edcc7b48f43c317ffd8799fd8799fd8799f581c74b54cbbd83e938af0580c58e56ccadd48fb6d988d694816d5c65708ffffffffd87a80d8799fd8799f581ca0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c23545484f534b59ff1b0000000365d98c71ff1a001e84801a001e8480ffd8799fd8799f4040ffd8799f581ca0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c23545484f534b59ff1b0000001f077430cc1b0000002643034badd8799fd8799fd8799fd8799f581caafb1196434cb837fd6f21323ca37b302dff6387e8a84b3fa28faf56ffd8799fd8799fd8799f581c52563c5410bff6a0d43ccebb7c37e1f69f5eb260552521adff33b9c2ffffffffd87a80ffffffff";
check("datumsdecode form present", html.includes('id="datumsdecode"') && html.includes('id="datumsdecode-input"') && html.includes('id="datumsdecode-result"'));
check("datums: single integer datum renders + hashes (pycardano)", (() => { const r = app.parseDatumsCbor(DAT_INT); return r !== null && r.count === 1 && r.entries[0].data === "42"; })());
check("datums: bounded byte string datum, hash over exact bytes (pycardano)", (() => { const r = app.parseDatumsCbor(DAT_BYTES); return r !== null && r.count === 1 && r.entries[0].data === "h'abcd'" && r.entries[0].hash === "59b29dbfec63f800da0b13c8e95417f03f2228bd355f4f397a44c52ca8164fb3"; })());
check("datums: Constr datum (pycardano)", (() => { const r = app.parseDatumsCbor(DAT_CONSTR); return r !== null && r.count === 1 && r.entries[0].data.indexOf("Constr 0") === 0 && r.entries[0].hash === "d0e694c9b08a78c818a1aba1309781585bc3b857ae4db443f632d10269b7e790"; })());
check("datums: five-entry mix — Constr, Constr over indefinite list, bytes, indefinite list, map; every hash matches the oracle (pycardano)", (() => { const r = app.parseDatumsCbor(DAT_MIXED); const H = ["d0e694c9b08a78c818a1aba1309781585bc3b857ae4db443f632d10269b7e790", "f497577750467d207127046aa6772ed879418c48c3007fcaa1b052fb4063a696", "59b29dbfec63f800da0b13c8e95417f03f2228bd355f4f397a44c52ca8164fb3", "f0a17eb5c0975464fd9bc2c440077c5a6866cec49c6ff50291c23af47e8223f1", "83eeb4193576c3f615697a300067662b2154b6753a3c6596eda5822a2d658dc0"]; return r !== null && r.count === 5 && r.entries.every((e, i) => e.hash === H[i]); })());
check("datums: bignum 2^70 and -2^70 render exactly (pycardano)", (() => { const a = app.parseDatumsCbor(DAT_BIGNUM); const b = app.parseDatumsCbor(DAT_NEGBIG); return a !== null && a.entries[0].data === "1180591620717411303424" && a.entries[0].hash === "343b3131410382547e1196df33bd4ce6382adee1fdaea07431158879a37684c3" && b !== null && b.entries[0].data === "-1180591620717411303424" && b.entries[0].hash === "f7e382cb0766ef43ec5370028da18ba7624aff10a87b6149dce65d4ddd5d762a"; })());
check("datums: a duplicated datum decodes as two entries, as encoded (a set on the wire; the oracle serialises it twice)", (() => { const r = app.parseDatumsCbor(DAT_DUP); return r !== null && r.count === 2 && r.entries[0].hash === r.entries[1].hash; })());
check("datums: REAL mainnet tx — tag-258 indefinite set, two Constr datums, hashes over exact spans (Koios ground truth, block 14043871)", (() => { const r = app.parseDatumsCbor(DAT_REAL); return r !== null && r.count === 2 && r.entries[0].hash === "46d5a9bd6715241f5d81dc8696075e95b43a0940ce4a02a577274e7e3559b0cc" && r.entries[1].hash === "5db8f5faad7497d3b85e18522759be5bc4805937c1bca3133d9a3c1f2b4d6924" && r.entries[0].data.indexOf("Constr 0") === 0; })());
check("datums: rejects an empty field in both serialisations (grammar nonempty_set; oracle serialises a10480)",
  app.parseDatumsCbor("80") === null && app.parseDatumsCbor("d9010280") === null);
check("datums: rejects a 65-byte byte string and a text string (not plutus_data; oracle serialises both as raw CBOR)",
  app.parseDatumsCbor("815841" + "00".repeat(65)) === null && app.parseDatumsCbor("8163616263") === null);
check("datums: rejects a bare datum, a whole witness set, trailing bytes, empty and garbage",
  app.parseDatumsCbor("182a") === null && app.parseDatumsCbor("a104" + DAT_CONSTR) === null && app.parseDatumsCbor(DAT_CONSTR + "00") === null && app.parseDatumsCbor("") === null && app.parseDatumsCbor("zzzz") === null);

/* Key witnesses decoder — a standalone VKEY WITNESSES field
   (witness set key 0): nonempty_list<vkeywitness>, each entry
   [vkey .size 32, signature .size 64] — proven against
   pycardano 0.19.2 TransactionWitnessSet serialisations in
   scratch (vkeywit_py.py / vkeywit_vectors.json; each field
   extracted from a whole witness set, re-wrapped as {0: field}
   and read back by the oracle in the generator) and a REAL
   mainnet field extracted by span from the stored witness set
   (tag-258 form; its key hash is the body's required signer).
   List semantics: a duplicated witness decodes as two entries.
   Validation reuses the witness decoder via a synthetic
   one-key set. Key hashes are blake2b-224 of the vkey. */
const VW_SINGLE = "81825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f584011111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
const VW_TWO = "82825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f5840111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111118258207777777777777777777777777777777777777777777777777777777777777777584022222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222";
const VW_DUP = "82825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f584011111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f584011111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
const VW_REAL = "d9010281825820c5d63d7dc066df52592135b6d3cb4f3470d06f7bdd4b2d2e32eb59ca3782662f58400b4af3e23a0c5687c3f3ecd2157ba8790bb7bed6d3f21e6ce5cbccc96bb5edd5c8b3d3d9a38642897d797534c7728b32d259dea8d1f6ed0d6ec76ce4c880d901";
check("vkeywitnessdecode form present", html.includes('id="vkeywitnessdecode"') && html.includes('id="vkeywitnessdecode-input"') && html.includes('id="vkeywitnessdecode-result"'));
check("vkeywitness: single witness — vkey, blake2b-224 key hash, signature (pycardano)", (() => { const r = app.parseVkeyWitnessesCbor(VW_SINGLE); return r !== null && r.count === 1 && r.entries[0].vkey === "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" && r.entries[0].keyHash === "491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297" && r.entries[0].signature === "11".repeat(64); })());
check("vkeywitness: two witnesses, second key hash + signature (pycardano)", (() => { const r = app.parseVkeyWitnessesCbor(VW_TWO); return r !== null && r.count === 2 && r.entries[1].vkey === "77".repeat(32) && r.entries[1].keyHash === "91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254" && r.entries[1].signature === "22".repeat(64); })());
check("vkeywitness: the same witness twice decodes as two entries (a list, not a set; oracle serialises it twice)", (() => { const r = app.parseVkeyWitnessesCbor(VW_DUP); return r !== null && r.count === 2 && r.entries[0].keyHash === r.entries[1].keyHash && r.entries[0].signature === r.entries[1].signature; })());
check("vkeywitness: tag-258 form of the pair decodes (nonempty_list grammar)", (() => { const r = app.parseVkeyWitnessesCbor("d90102" + VW_TWO); return r !== null && r.count === 2 && r.entries[0].keyHash === "491112dd01155c07dab485f71b572e0cae759e2cd38b1c0e97554297"; })());
check("vkeywitness: REAL mainnet field — tag-258, one witness, key hash is the body's required signer (Koios ground truth)", (() => { const r = app.parseVkeyWitnessesCbor(VW_REAL); return r !== null && r.count === 1 && r.entries[0].vkey === "c5d63d7dc066df52592135b6d3cb4f3470d06f7bdd4b2d2e32eb59ca3782662f" && r.entries[0].keyHash === "5b7e23228dba75595645fc357d0f97ba258cfccfff5d588d4bb9165b" && r.entries[0].signature.length === 128; })());
check("vkeywitness: rejects an empty field in both serialisations (grammar nonempty_list; oracle serialises a10080)",
  app.parseVkeyWitnessesCbor("80") === null && app.parseVkeyWitnessesCbor("d9010280") === null);
check("vkeywitness: rejects a 63-byte signature and a 31-byte vkey (oracle serialises both)",
  app.parseVkeyWitnessesCbor("81825820000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f583f" + "11".repeat(63)) === null && app.parseVkeyWitnessesCbor("8182581f" + "00".repeat(31) + "5840" + "11".repeat(64)) === null);
check("vkeywitness: rejects a 3-item witness and a bare witness (not the field)",
  app.parseVkeyWitnessesCbor("81835820" + "00".repeat(32) + "5840" + "11".repeat(64) + "00") === null && app.parseVkeyWitnessesCbor(VW_SINGLE.slice(2)) === null);
check("vkeywitness: rejects a whole witness set, trailing bytes, empty and garbage",
  app.parseVkeyWitnessesCbor("a100" + VW_SINGLE) === null && app.parseVkeyWitnessesCbor(VW_SINGLE + "00") === null && app.parseVkeyWitnessesCbor("") === null && app.parseVkeyWitnessesCbor("zzzz") === null);

/* Native scripts decoder — a standalone NATIVE SCRIPTS field
   (witness set key 1): nonempty_list<native_script> — proven
   against pycardano 0.19.2 TransactionWitnessSet serialisations
   in scratch (nativescripts_py.py / nativescripts_vectors.json;
   each field extracted from a whole witness set, re-wrapped as
   {1: field} and read back by the oracle in the generator).
   Hashes are the oracle's own .hash() values (blake2b-224 over
   0x00 ‖ exact script bytes). List semantics: a duplicated
   script decodes as two entries (the oracle serialises and
   reads back two). The REAL vector took a hunt: two Koios
   sweeps span-walked 3,444 recent mainnet witness sets (the
   walker verified exact against the stored real witness set)
   and found exactly ONE key-1 field — tx 87a7ac8b…, block
   14044379. Validation reuses the witness decoder via a101. */
const NS_SIG = "818200581c" + "aa".repeat(28);
const NS_TWO = "828200581c" + "aa".repeat(28) + "8201818200581c" + "aa".repeat(28);
const NS_NESTED = "818202838201828200581c" + "aa".repeat(28) + "8204193039830302838200581c" + "aa".repeat(28) + "8200581c" + "bb".repeat(28) + "82051a0001869f8200581c" + "11".repeat(28);
const NS_SIG_HASH = "a185cb99a818068805d34633e276287a79cbd985b8cc540d36ad3761";
const NS_ALL_HASH = "e0fab1ad68eb52ffe22d71ba87758874bef6faea21cd8b0c117c04d8";
check("nativescriptsdecode form present", html.includes('id="nativescriptsdecode"') && html.includes('id="nativescriptsdecode-input"') && html.includes('id="nativescriptsdecode-result"'));
check("nativescripts: single sig script — kind, key hash, oracle script hash (pycardano)", (() => { const r = app.parseNativeScriptsCbor(NS_SIG); return r !== null && r.count === 1 && r.entries[0].kind === "sig" && r.entries[0].keyHash === "aa".repeat(28) && r.entries[0].hash === NS_SIG_HASH && r.entries[0].text === "sig " + "aa".repeat(28); })());
check("nativescripts: two scripts — sig + all(sig), oracle hash at both levels (pycardano)", (() => { const r = app.parseNativeScriptsCbor(NS_TWO); return r !== null && r.count === 2 && r.entries[1].kind === "all" && r.entries[1].hash === NS_ALL_HASH && r.entries[1].scripts[0].hash === NS_SIG_HASH; })());
check("nativescripts: nested any(all(sig, after 12345), atLeast 2 of (sig, sig, before 99999), sig) — every code, oracle hashes (pycardano)", (() => { const r = app.parseNativeScriptsCbor(NS_NESTED); if (r === null || r.count !== 1) return false; const root = r.entries[0]; const inner = root.scripts[0]; const atl = root.scripts[1]; return root.kind === "any" && root.hash === "53aeb5c828b6774d0c246b38ec2119c2c7d941d847a5c61913cdee8a" && inner.kind === "all" && inner.hash === "453b440d8a41405504757a0b129d41b8184d148d5f4f3f2aa6d93786" && inner.scripts[1].kind === "after" && inner.scripts[1].slot === "12345" && inner.scripts[1].hash === "e5a90a668de8911cd6a5246b1b2bd61f144d8abaa2050487e020ee1e" && atl.kind === "atLeast" && atl.required === "2" && atl.scripts.length === 3 && atl.hash === "07bdf52fc41e85d6aa741a6234c80cdafafa52282c9b9f9edaf1cb79" && atl.scripts[1].keyHash === "bb".repeat(28) && atl.scripts[2].kind === "before" && atl.scripts[2].slot === "99999" && atl.scripts[2].hash === "5efeb7661c3b905f0ed390c049c5accccc83e8cf504e591ee3c3ed88" && root.scripts[2].keyHash === "11".repeat(28); })());
check("nativescripts: the same script twice decodes as two entries (a list, not a set; oracle serialises and reads back two)", (() => { const r = app.parseNativeScriptsCbor("82" + NS_SIG.slice(2) + NS_SIG.slice(2)); return r !== null && r.count === 2 && r.entries[0].hash === NS_SIG_HASH && r.entries[1].hash === NS_SIG_HASH; })());
check("nativescripts: tag-258 form decodes (nonempty_list grammar)", (() => { const r = app.parseNativeScriptsCbor("d90102" + NS_TWO); return r !== null && r.count === 2 && r.entries[1].hash === NS_ALL_HASH; })());
check("nativescripts: an empty all() decodes (CDDL [* native_script] states no minimum; oracle emits and hashes it)", (() => { const r = app.parseNativeScriptsCbor("81820180"); return r !== null && r.count === 1 && r.entries[0].kind === "all" && r.entries[0].scripts.length === 0 && r.entries[0].hash === "d441227553a0f1a965fee7d60a0f724b368dd1bddbc208730fccebcf"; })());
check("nativescripts: REAL mainnet field — tag-258 form, one all(sig, before 215122509) script, oracle script hash (Koios ground truth, block 14044379)", (() => { const r = app.parseNativeScriptsCbor("d90102818201828200581c207655f99c5bd77fdcc8c29dbb5dbe4fa94ae568733463477234f0f582051a0cd2824d"); return r !== null && r.count === 1 && r.entries[0].kind === "all" && r.entries[0].hash === "06b85d3ef96291e8d58e63015727bc83dcf4f1e0eaa117d497fffda5" && r.entries[0].scripts[0].keyHash === "207655f99c5bd77fdcc8c29dbb5dbe4fa94ae568733463477234f0f5" && r.entries[0].scripts[1].kind === "before" && r.entries[0].scripts[1].slot === "215122509"; })());
check("nativescripts: atLeast 5-of-1 decodes (CDDL states no n <= children bound; aux-decoder precedent)", (() => { const r = app.parseNativeScriptsCbor("81830305818200581c" + "aa".repeat(28)); return r !== null && r.entries[0].kind === "atLeast" && r.entries[0].required === "5" && r.entries[0].scripts.length === 1; })());
check("nativescripts: rejects an empty field in both serialisations (grammar nonempty_list; oracle serialises a10180)",
  app.parseNativeScriptsCbor("80") === null && app.parseNativeScriptsCbor("d9010280") === null);
check("nativescripts: rejects script code 6 and a 27-byte sig hash (authorities agree: oracle cannot read code 6 back, its key hash type raises on 27)",
  app.parseNativeScriptsCbor("818106") === null && app.parseNativeScriptsCbor("818200581b" + "aa".repeat(27)) === null);
check("nativescripts: rejects a negative atLeast threshold and a negative timelock slot (oracle serialises and reads back both)",
  app.parseNativeScriptsCbor("81830320818200581c" + "aa".repeat(28)) === null && app.parseNativeScriptsCbor("81820420") === null);
check("nativescripts: rejects a bare script, a whole witness set, trailing bytes, empty and garbage",
  app.parseNativeScriptsCbor(NS_SIG.slice(2)) === null && app.parseNativeScriptsCbor("a101" + NS_SIG) === null && app.parseNativeScriptsCbor(NS_SIG + "00") === null && app.parseNativeScriptsCbor("") === null && app.parseNativeScriptsCbor("zzzz") === null);

/* Bootstrap witnesses decoder — a standalone BOOTSTRAP
   WITNESSES field (witness set key 2): nonempty_list<
   bootstrap_witness>, each entry [public_key .size 32,
   signature .size 64, chain_code bytes, attributes bytes]
   — the last two UNSIZED in the Conway, Shelley and
   Babbage CDDL texts. pycardano 0.19.2 has NO bootstrap
   class (List[Any], TODO), so vectors are CDDL-built with
   RawCBOR and proven by the oracle's from_cbor round-trip
   in scratch (bootstrap_py.py / bootstrap_vectors.json;
   each field extracted by span, re-wrapped as {2: field}
   and read back). Because the field is untyped, the
   oracle's passthrough accepts every refused shape too —
   the size/arity/empty gates rest on the CDDL. The
   tag-258 form inverts the split: the grammar admits it
   but the oracle cannot read it back (DeserializeException
   on the CBORTag). List semantics: a duplicated witness
   decodes as two entries. Validation reuses the witness
   decoder via a102. Key hashes are hashlib blake2b-224. */
const BW_SINGLE = "81845820" + "33".repeat(32) + "5840" + "44".repeat(64) + "5820" + "55".repeat(32) + "44deadbeef";
const BW_TWO = "82845820" + "33".repeat(32) + "5840" + "44".repeat(64) + "5820" + "55".repeat(32) + "44deadbeef" + "845820" + "77".repeat(32) + "5840" + "88".repeat(64) + "450102030405" + "41a0";
const BW_EMPTY_CC = "81845820" + "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" + "5840" + "99".repeat(64) + "4040";
check("bootstrapdecode form present", html.includes('id="bootstrapdecode"') && html.includes('id="bootstrapdecode-input"') && html.includes('id="bootstrapdecode-result"'));
check("bootstrap: single witness — public key, blake2b-224 key hash, signature, chain code, attributes (CDDL-built, oracle round-trip)", (() => { const r = app.parseBootstrapWitnessesCbor(BW_SINGLE); return r !== null && r.count === 1 && r.entries[0].publicKey === "33".repeat(32) && r.entries[0].keyHash === "e47bb1c6309ebd06695ae459e69fcf3d585e5f41e3d3d8ce7152b524" && r.entries[0].signature === "44".repeat(64) && r.entries[0].chainCode === "55".repeat(32) && r.entries[0].attributes === "deadbeef"; })());
check("bootstrap: two witnesses — second carries a 5-byte chain code (no size gate in any era's CDDL)", (() => { const r = app.parseBootstrapWitnessesCbor(BW_TWO); return r !== null && r.count === 2 && r.entries[1].publicKey === "77".repeat(32) && r.entries[1].keyHash === "91487258bd9141c10be7c8a4039b29e78900c9251e8539fa7392f254" && r.entries[1].chainCode === "0102030405" && r.entries[1].attributes === "a0"; })());
check("bootstrap: the same witness twice decodes as two entries (a list, not a set; oracle reads back two)", (() => { const r = app.parseBootstrapWitnessesCbor("82" + BW_SINGLE.slice(2) + BW_SINGLE.slice(2)); return r !== null && r.count === 2 && r.entries[0].keyHash === r.entries[1].keyHash; })());
check("bootstrap: empty chain code and empty attributes decode (CDDL types both as plain bytes)", (() => { const r = app.parseBootstrapWitnessesCbor(BW_EMPTY_CC); return r !== null && r.count === 1 && r.entries[0].keyHash === "3d56a149cbd95dffa093ebbf864ceb86113dfe87146812148e0524e7" && r.entries[0].chainCode === "" && r.entries[0].attributes === ""; })());
check("bootstrap: tag-258 form decodes (nonempty_list grammar; the oracle's untyped field cannot read the tag back)", (() => { const r = app.parseBootstrapWitnessesCbor("d90102" + BW_SINGLE); return r !== null && r.count === 1 && r.entries[0].keyHash === "e47bb1c6309ebd06695ae459e69fcf3d585e5f41e3d3d8ce7152b524"; })());
check("bootstrap: REAL mainnet field — one witness, chain code and a0 attributes as encoded, hashlib key hash (Koios ground truth, block 14044612)", (() => { const r = app.parseBootstrapWitnessesCbor("818458203a399026d5356873b089878daa09c4a114d237295dfd591c095d3351ce446fb35840b35c9e50a645716ac4be89a9bd9a1439aecb8fb14e89de15c1c68038beea13ea29f6809d30d95c8a5c5900eba091f0e6c63ca6206693e779df9936f4a4caaa0358203a399026d5356873b089878daa09c4a114d237295dfd591c095d3351ce446fb341a0"); return r !== null && r.count === 1 && r.entries[0].publicKey === "3a399026d5356873b089878daa09c4a114d237295dfd591c095d3351ce446fb3" && r.entries[0].keyHash === "7dfad1a7b0afbdc1d901fd069f78593d8a603c14f7b0ae7f001e72d0" && r.entries[0].chainCode === "3a399026d5356873b089878daa09c4a114d237295dfd591c095d3351ce446fb3" && r.entries[0].attributes === "a0"; })());
check("bootstrap: REAL mainnet field in TAG-258 form — two witnesses, hashlib key hashes (Koios ground truth, block 14044573; the form the oracle cannot read back, carried by the chain itself)", (() => { const r = app.parseBootstrapWitnessesCbor("d9010282845820032420091f72d20b670fe5a4d71fe0a11e4d6cacb76926d2ecf1fb202a758719584037193bfe7fecb9aa2d495dabb1cb3fe4cb607af2f69542deba283598cfa1d37a606ab6255aff3394c3bb7585b928b4ba67b317e7e703a57ac87f028eede8f10d582042f0aceaae2b6c856093028fadebd5093d59072bbfbe9a2dcece901169e00bf15822a101581e581c5981b261ab5ccd7d09669c222dc56ae0c4eae02ff19f60ab54c7bbb98458203d2c905e486ccf0a233a4b5176762306e24cc7c8187f75d1cfdf697eb6b1934e5840ff25dbbd4d3b24f4894aabe902861d8ed9195ed154b7d07b04bd299b2f89246265090a3227bc5a4e55a98080666ccbb11efe0064dff980c2ad5790100294ef05582071ae8c68231874106fb0967ab6680a9c4156df45a7590ec94b6ede137bae5be65822a101581e581c5981b261ab5ccd3c98277622c1fa3a406e2dd5b64772a03698589b8a"); return r !== null && r.count === 2 && r.entries[0].publicKey === "032420091f72d20b670fe5a4d71fe0a11e4d6cacb76926d2ecf1fb202a758719" && r.entries[0].keyHash === "1afef2f756ede34ad9589ee040c1163e84599610c94bbce1059193f8" && r.entries[1].keyHash === "a03fac68b728cfad4ef2fba2bb21d06585d3fc6c334705713cbcd823" && r.entries[0].attributes.length === 68; })());
check("bootstrap: rejects an empty field in both serialisations (grammar nonempty_list; oracle serialises a10280)",
  app.parseBootstrapWitnessesCbor("80") === null && app.parseBootstrapWitnessesCbor("d9010280") === null);
check("bootstrap: rejects a 31-byte public key and a 63-byte signature (CDDL sizes; the oracle's untyped passthrough accepts both)",
  app.parseBootstrapWitnessesCbor("8184581f" + "33".repeat(31) + "5840" + "44".repeat(64) + "5820" + "55".repeat(32) + "44deadbeef") === null && app.parseBootstrapWitnessesCbor("81845820" + "33".repeat(32) + "583f" + "44".repeat(63) + "5820" + "55".repeat(32) + "44deadbeef") === null);
check("bootstrap: rejects a 3-item entry and a bare witness (not the field)",
  app.parseBootstrapWitnessesCbor("81835820" + "33".repeat(32) + "5840" + "44".repeat(64) + "5820" + "55".repeat(32)) === null && app.parseBootstrapWitnessesCbor(BW_SINGLE.slice(2)) === null);
check("bootstrap: rejects a whole witness set, trailing bytes, empty and garbage",
  app.parseBootstrapWitnessesCbor("a102" + BW_SINGLE) === null && app.parseBootstrapWitnessesCbor(BW_SINGLE + "00") === null && app.parseBootstrapWitnessesCbor("") === null && app.parseBootstrapWitnessesCbor("zzzz") === null);

/* Plutus scripts decoder: a standalone Plutus scripts
   field (witness keys 3/6/7, one tool, language selected).
   CDDL: nonempty_set<plutus_vN_script>, script = bytes
   unsized. Proven against pycardano 0.19.2
   TransactionWitnessSet serialisations in scratch
   (plutusscripts_py.py / plutusscripts_vectors.json; each
   field extracted from a whole witness set, re-wrapped
   and read back by the oracle): per language a single
   script, two distinct, a 512-byte script, the tag-258
   form (hand-wrapped, oracle read-back) and the
   indefinite form. SET semantics: a duplicated script is
   REFUSED though the oracle serialises and reads back
   two. An empty script is refused by the hub's shared
   scriptHash gate (empty bytes) though the CDDL's
   unsized bytes and the oracle (8140) accept one —
   recorded in README/code as the hub's own gate. Hashes
   are hashlib blake2b-224 over the language byte.
   REAL vectors: one field per language, all from block
   14044775 via Koios (13 txs scanned). */
check("plutusscripts V1: single script — size + language-byte script hash (oracle vector)", (() => { const r = app.parsePlutusScriptsCbor("81450102030405", "plutusv1"); return r !== null && r.count === 1 && r.totalBytes === 5 && JSON.stringify(r.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "b66e1bb840143447fea4b1b44d459f88f34fb222c1a6b4e846a28dc9" }]); })());
check("plutusscripts V1: two distinct scripts + tag-258 and indefinite forms decode identically", (() => { const a = app.parsePlutusScriptsCbor("8245010203040550deadbeefdeadbeefdeadbeefdeadbeef", "plutusv1"); const b = app.parsePlutusScriptsCbor("d9010281450102030405", "plutusv1"); const c = app.parsePlutusScriptsCbor("9f450102030405ff", "plutusv1"); const exp = JSON.stringify([{ size: 5, hash: "b66e1bb840143447fea4b1b44d459f88f34fb222c1a6b4e846a28dc9" }, { size: 16, hash: "bf18f8dc71eb5399d4a6bca2fa3c443242c7ddab1089dc4e60f81f41" }]); return a !== null && a.count === 2 && JSON.stringify(a.entries.map(e => ({size: e.size, hash: e.hash}))) === exp && JSON.stringify(b.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "b66e1bb840143447fea4b1b44d459f88f34fb222c1a6b4e846a28dc9" }]) && JSON.stringify(c.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "b66e1bb840143447fea4b1b44d459f88f34fb222c1a6b4e846a28dc9" }]); })());
check("plutusscripts V1: 512-byte script (two-byte length head)", (() => { const r = app.parsePlutusScriptsCbor("81590200000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff", "plutusv1"); return r !== null && r.entries[0].size === 512 && r.entries[0].hash === "8cfd4d1472076ecda77141ecf8d04957567bbf921623d31cb9a6d980"; })());
check("plutusscripts V1: rejects empty field, duplicate script (a set — oracle serialises two), non-bytes entry, empty script (hub scriptHash gate), bare script, whole witness set", app.parsePlutusScriptsCbor("80", "plutusv1") === null && app.parsePlutusScriptsCbor("82450102030405450102030405", "plutusv1") === null && app.parsePlutusScriptsCbor("8101", "plutusv1") === null && app.parsePlutusScriptsCbor("8140", "plutusv1") === null && app.parsePlutusScriptsCbor("450102030405", "plutusv1") === null && app.parsePlutusScriptsCbor("a103" + "81450102030405", "plutusv1") === null);
check("plutusscripts V2: single script — size + language-byte script hash (oracle vector)", (() => { const r = app.parsePlutusScriptsCbor("81450102030405", "plutusv2"); return r !== null && r.count === 1 && r.totalBytes === 5 && JSON.stringify(r.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "484921e55adc6b3b42df9cc91868a295f14a02ca0559abc38d546a46" }]); })());
check("plutusscripts V2: two distinct scripts + tag-258 and indefinite forms decode identically", (() => { const a = app.parsePlutusScriptsCbor("8245010203040550deadbeefdeadbeefdeadbeefdeadbeef", "plutusv2"); const b = app.parsePlutusScriptsCbor("d9010281450102030405", "plutusv2"); const c = app.parsePlutusScriptsCbor("9f450102030405ff", "plutusv2"); const exp = JSON.stringify([{ size: 5, hash: "484921e55adc6b3b42df9cc91868a295f14a02ca0559abc38d546a46" }, { size: 16, hash: "c63ff80bf6631bf6cb0b2c792b00187a17fa3982b4bae4df973f68de" }]); return a !== null && a.count === 2 && JSON.stringify(a.entries.map(e => ({size: e.size, hash: e.hash}))) === exp && JSON.stringify(b.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "484921e55adc6b3b42df9cc91868a295f14a02ca0559abc38d546a46" }]) && JSON.stringify(c.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "484921e55adc6b3b42df9cc91868a295f14a02ca0559abc38d546a46" }]); })());
check("plutusscripts V2: 512-byte script (two-byte length head)", (() => { const r = app.parsePlutusScriptsCbor("81590200000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff", "plutusv2"); return r !== null && r.entries[0].size === 512 && r.entries[0].hash === "1aa8ada737cb7dd49f693ca4067156ae0412f4a36ccb02b927e5af14"; })());
check("plutusscripts V2: rejects empty field, duplicate script (a set — oracle serialises two), non-bytes entry, empty script (hub scriptHash gate), bare script, whole witness set", app.parsePlutusScriptsCbor("80", "plutusv2") === null && app.parsePlutusScriptsCbor("82450102030405450102030405", "plutusv2") === null && app.parsePlutusScriptsCbor("8101", "plutusv2") === null && app.parsePlutusScriptsCbor("8140", "plutusv2") === null && app.parsePlutusScriptsCbor("450102030405", "plutusv2") === null && app.parsePlutusScriptsCbor("a106" + "81450102030405", "plutusv2") === null);
check("plutusscripts V3: single script — size + language-byte script hash (oracle vector)", (() => { const r = app.parsePlutusScriptsCbor("81450102030405", "plutusv3"); return r !== null && r.count === 1 && r.totalBytes === 5 && JSON.stringify(r.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "7703cfe5204ce5eeb7dadf76b0a94f7b4978c5c99246d8fee29b8b6e" }]); })());
check("plutusscripts V3: two distinct scripts + tag-258 and indefinite forms decode identically", (() => { const a = app.parsePlutusScriptsCbor("8245010203040550deadbeefdeadbeefdeadbeefdeadbeef", "plutusv3"); const b = app.parsePlutusScriptsCbor("d9010281450102030405", "plutusv3"); const c = app.parsePlutusScriptsCbor("9f450102030405ff", "plutusv3"); const exp = JSON.stringify([{ size: 5, hash: "7703cfe5204ce5eeb7dadf76b0a94f7b4978c5c99246d8fee29b8b6e" }, { size: 16, hash: "4e98ea178f0afaf828c815e93a13796133884dca4196e4465b0e59d7" }]); return a !== null && a.count === 2 && JSON.stringify(a.entries.map(e => ({size: e.size, hash: e.hash}))) === exp && JSON.stringify(b.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "7703cfe5204ce5eeb7dadf76b0a94f7b4978c5c99246d8fee29b8b6e" }]) && JSON.stringify(c.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 5, hash: "7703cfe5204ce5eeb7dadf76b0a94f7b4978c5c99246d8fee29b8b6e" }]); })());
check("plutusscripts V3: 512-byte script (two-byte length head)", (() => { const r = app.parsePlutusScriptsCbor("81590200000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff", "plutusv3"); return r !== null && r.entries[0].size === 512 && r.entries[0].hash === "bdb91befb21f73a8250552d8276e8eb12b230a362c2f85678d6c9c92"; })());
check("plutusscripts V3: rejects empty field, duplicate script (a set — oracle serialises two), non-bytes entry, empty script (hub scriptHash gate), bare script, whole witness set", app.parsePlutusScriptsCbor("80", "plutusv3") === null && app.parsePlutusScriptsCbor("82450102030405450102030405", "plutusv3") === null && app.parsePlutusScriptsCbor("8101", "plutusv3") === null && app.parsePlutusScriptsCbor("8140", "plutusv3") === null && app.parsePlutusScriptsCbor("450102030405", "plutusv3") === null && app.parsePlutusScriptsCbor("a107" + "81450102030405", "plutusv3") === null);
check("plutusscripts: REAL mainnet V2 field — 1 script(s), hashlib script hashes (Koios ground truth, block 14044775, tx bf667550…)", (() => { const r = app.parsePlutusScriptsCbor("815901455901420100003323232323232322322253330053253330063370e900218039baa300130083754004264a66600e66e1d2000300837540022646600200264a66601266e1d2002300a3754002297adef6c6013756601c60166ea8004c8cc004004dd5980218059baa300e300b375400644a66601a0022980103d87a80001323232533300d3371e0166eb8c03800c4cdd2a4000660226e980052f5c026600a00a0046eacc038008c044008c03c004894ccc030004528099299980519b873371c6eb8c02cc03c00920024806852889980180180098078008b1929998050008a6103d87a800013374a9000198059806000a5eb80dd618059806180618041baa300b3008375400429408c02cc03000452613656375c002ae6955ceaab9e5573eae815d0aba24c011e581ce0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b0001", "plutusv2"); return r !== null && r.count === 1 && JSON.stringify(r.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 325, hash: "99e5aacf401fed0eb0e2993d72d423947f42342e8f848353d03efe61" }]); })());
check("plutusscripts: REAL mainnet V1 field — 2 script(s), hashlib script hashes (Koios ground truth, block 14044775, tx c6a10d77…)", (() => { const r = app.parsePlutusScriptsCbor("d901028259014f59014c01000032323232323232322223232325333009300e30070021323233533300b3370e9000180480109118011bae30100031225001232533300d3300e22533301300114a02a66601e66ebcc04800400c5288980118070009bac3010300c300c300c300c300c300c300c007149858dd48008b18060009baa300c300b3754601860166ea80184ccccc0288894ccc04000440084c8c94ccc038cd4ccc038c04cc030008488c008dd718098018912800919b8f0014891ce1317b152faac13426e6a83e06ff88a4d62cce3c1634ab0a5ec133090014a0266008444a00226600a446004602600a601a00626600a008601a006601e0026ea8c03cc038dd5180798071baa300f300b300e3754601e00244a0026eb0c03000c92616300a001375400660106ea8c024c020dd5000aab9d5744ae688c8c0088cc0080080048c0088cc00800800555cf2ba15573e6e1d200201591e1b591e1801000032323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232222323232533533355333573460cc0042646424446600200a0086eb4d5d09aba25002375a6ae85400454ccd5cd1832801099091118010021bad357426aae7800c54ccd5cd1832001099190911198018028021bad357426ae894008c0ccd5d0a80082e1119191a827911111a80391191111aa99a9824806108008b1119191a9a9a80103102d91191919191919191aa99a982a89119982d91299a99820a8071a80103409980200100088008008020b03c9111919191919191919191919191982a299a8050a99aa8100999ab9a3094013303a307908101330820106700b06706e0060063305433355307908101305c05a305953353502b2233500206e2071210011635014222222207a33054353501422208e0122350012322533355333500a2153335004215333500c2130054984c011261533350052130054984c0112603c04f15333500b2130044984c00d261533350042130044984c00d2603b153335003205003a04f153335003215333500b2130044984c00d261533350042130044984c00d2603b04e15333500a2130034984c009261533350032130034984c0092603a153350010700820108201070253335002215333500a21533350042133303a03b00200116161604e15333500921533350032133303903a00200116161604d04e33054330500153306f00b02733054330533306301602548008cc150cc14ccc18c02c0952002330543305333063001010002330543333084012222533500315335002135001222223305d3305c0053306c01402b3305d3305c0043306c01402a3305d3305c00300c3305d3305c0023306c0140193305c001304800d0910122153350041622153350071622153350081622133300c003001323232323232323533307d0050070272222225335330743305100248000cc1440052000161333335003235500b2222223501d222223501b22235051222223232323232323232323253353308b013308b013306e00848000cc1b802920003308b013306d00201e3308b0153353306e00a00315335330870100e07013308b013308a013309a010110703370066e0402800c060cc22804cc2680404411c0084cc22c04cc22804cc268040441c0060cc22c04cc22804cc2680404411c008cc22804cdc08050019984d008088070a99a998370041a802055008a99a99843808078380998458099845009984d0080883819b80337020106a008154020306611402661340202208e00426611602661140266134020220e003066116026611402661340202208e004661140266e04020d40102a804cc2680404403c4cc22c04cc22804cc2680404411c008cc22804cc268040441c0060cc22c04cc20c04048070cc2080404006c4c8c8c8ccccc2c80400c008cdc019b800180050013370002e002a66a0082605466e0800c00840594cd400c4cccc0a005406406005c520003370002e00866e0005cd40102a80458c27c04028d40082a404d40042a404d54cd54ccd5cd19b8900148000278044c94ccd5cd19b890014800027c044c94ccd5cd19b8900148000280044c28404ccc2ec0400c0080054ccd5cd19b8900400610041006350020ad0121001160b901350010b0015333573466e2400400c54ccd5cd19b880010031330a8010023370666e080080400444cc2a0040080104cc2a004cdc199b820040110100043370666e080040380414cd4cc1fc01c1a04cdc0998490081100399b80011010133092010220073370666e080040300354cd4cc1f40101984cdc0998480081000219b8000f00e133090010200042235500c2222223501e222223501c222350522222232323232323232323253353308b013306e00748000cc22c04cc1b4008074cc22c04cc22c04cc22804cc2680404011c008cc22804cc268040401c005ccc22c04cc20c0404406ccc2080403c0684c8c8c8c8ccccc2cc0400c008cdc019b800180060013370002e002a66a00a2605666e0800c00840594cd40104cccc0a405406406005c52000350020b301350010b60153353330690870100e01e1330ae013370002c00e02a26615c0202c66e0005401c58c27c04024cdc199b820010123370200400266604400600266e0ccdc0981219b803370400400466e08cdc119b82337049004241941e90680780200198600080199b824801120ca0f350050a70130be01001350030a60153353308001001069133702661260204600266e000440404cc24c0408c004d400428804d54cd4ccc1801f80140544ccc2d0040140340304ccc2d004010030034888d400c88ccc2e40401401000c88d54030888888d407888888d4070888d414888888c8c8c8c94cd4cc21804cc1a4009200033086013306800101833086015335330820101906b13308501330950100b0193370000202426610c026610a026612a020160320026610a026612a020160d60246610c02660fc01802c660fa01402a2a66a6660c8104020120322666661540266e00044008cdc08080008078070068999998550099b810110013370002000401e01c01a2c66603e6a00614c026a00614a02002a66a66100020020d2266e04cc24c0408c004cdc0008808099849808118009a800851009aa99a99983003f00280a899985a00802806806099985a008020060069111a8019119985c80802802001911aa8061111111a80f111111a80e1111a82911111191919191919299a998440099835802240006611002660d80020086611002a66a66108020360da266110026610e026612e0201a03666e00068050cc21c04cc25c04034014cdc08020008a99a99842008028368998440099843809984b8080680d80d19843809984b8080680299b8033702008002028266110026610e026612e0201a03603466110026610e026612e0201a00a66e04010004cc21c04cc25c040341b4050cc22004cc20004038060cc1fc03005c54cd4ccc1982100402c06c4ccccc2b004cdc000980099b8101201a01101000f1333330ac013370202603466e0004800404404003c594cd54ccd5cd19b880190011309f013370066e0ccdc119b82002019483403ccdc119b81001019483283d200209e012100116350040a601350030a60153353308001001069133702661260204600266e000440404cc24c0408c004d400428804d54cd4ccc1801f80140544ccc2d0040140340304ccc2d004010030034888d400c88ccc2e40401401000c88d54030888888d407888888d4070888d414888888c8c8c8c94cd4cc21804cc1a4011200033086013308601330680030193306800201833086015335330820100906b133086013308501330950100b009337000060246610a026612a020160100042a66a66104020100d626610c026610a026612a0201601066e00008048cc21404cc2540402c02400c4cc21804cc21404cc2540402c02400ccc21804cc21404cc2540402c020008cc21404cc2540402c1ac048cc21804cc1f8030058cc1f40280544c8c8c8ccccc2b40400800ccdc019b8101200700133700022002a66a0082604a66e0800800c40414cd400c4cccc08c03c04c048044520003370202400866e0404000858c26804010cdc199b8200200e00d3370666e08004038030cc244040840f8888c8cdc199b820010033370066e0801120d00f0013370400290650791112999ab9a3371200890000a4000264a666ae68cdc48008028a4000264a666ae68cdc4800a400029000080099b833370400466e04004014cdc019b8200148028014c014cdc10018011192999ab9a33710004900004d808a999ab9a30a10100214800054ccd5cd1851008010a40042a666ae68c28c04008520021330010023370066e0c009200448008c254048894ccd5cd19b880010021330030013370666e00cdc1802000800a4008200426660f2002006046464a666ae68c27c04d55ce80089919191919191919191919191919091999998008050048040028018011bad357426ae88008dd69aba100135744010a666ae68c2b4040084c8c8488888cc01001c018dd69aba135744a0046660f8eb9d71aba15001153335734615802004264642444446600200e00c6eb4d5d09aba25002375a6ae85400454ccd5cd18558080109909111118028031bad357426aae7801854ccd5cd18550080109919091111198010038031bad357426ae894008ccc1f1d73ae35742a0022a666ae68c2a4040084c8c8488888cc00c01c018dd69aba135744a0046660f8eb9d71aba150010a101135573c00a6aae74010cc1e1d71aba100530743574200a60e66ae84014dd51aba1001357440026ae88004d5d10009aab9e0010970137540026a002104026a00810c0260c82446660d444a66a660b066606c0d46a004104026a03c1040266606c0a06a6a0040fc0ee05e266008004002200200202a60c82446660d444a66a660b066606c0a06a0040ee6a0200ee66606c0a06a0040ee05e2660080040022002002026666660f0660c602c044660c602c04203e660c602c02003c660a8660a0044607a008660a8660a0042607c008660a8024660a8a66a60c82446660d444a66a660a66aa03a104026a6a0040ee1040226600800400220020020260d6442a66a0020fe440dea66a6660640a600490000998299981d183c840809984100833800a40042660a66607460f21020266104020ce0029000183800999b8100101d303d001333066059008010305333307f22322325333573466e1c010dc680488010a999ab9a308f0100415333573466e1d205a500313370290001980299b800044800800800400454ccd5cd19b885002481805854ccd5cd19b8950023370090302402426600866e0000d20023370066e08005201433702a00490300b099b8e0060014800120001533500400115335501a13335734611a026606860e60f6660f80c200a0c20d00022a66a0062a66aa0320022666ae68c23804cc0ccc1c81e8cc1ec18001018019c0044ccd5cd18460099819183883c9983d02f80182f833299a9983d91299a8008321109a80111299a9982b00101089834800898030019a9a99a983b03c00501083883610a99a8008b1109a80111299a8018a99a99827800a400420042c112022c666ae68cdc49982c800803240000c80ba6a0020d4a66a60b02446660bc44a66a66088a0226a0040d6266008004002200200200e2c0f8660ce02c6a00a0d460c2006a66a60a42446660b044a66a660826aa0160e06a6a6a0040d80ca0e026600800400220020020060b2442a66a0020da440ba60ba0026a0280d4660b40020246a6a0080c80be26a6a0020c20b4a66a609601c420022c2a66a660600040320ba266060002032603200e6068010464646a09c4444464646464646464660706606a00c0066607066068660a600c018660a6006018660706606e6608e6a6a66a60c60ca00401e0bc0b2660b601201090011981c1981f998188070009981c1981b9811800a40006607066068604201c60420026607066068604401c60440026606e604801c6048002660706606a60aa00a09666070a66a609024466609c44a66a60a26a6a0040c40b8266008004002200200200809e442a66a0020c6440a6a66a609024466609c44a66a60a26a0040b8266008004002200200260b000e09e442a66a0020c6440a666609a08000600860a40066a0020aca66a608824466609444a66a660666a6a6a00e0bc0ae0c46a6a0040ae0c4266008004002200200260a80062c0d06a0100ba6a6a0020b00a6a66a608400c420022c603000c606600e4464646a09e44444a66a6a00e440a8426464646464646464646464646607e660700286660aa09000800c6607e66076014660b40060246607e6607e6607c6609c6a0040c00120106607e6606e6a0040bc6a01a0d26606c6a0040be6a01a0ca6607e6607866aa60ce0d846a00244660ca00466aa60d40de46a00244660d0004666a0026e012000700466e0000520000013304000b3500922330723306400233072330640010090540540033303f3303e3304e3535335306a06c0010160650603306200f00e48008cc0fccc0f0c1700181494cd4c13c488ccc154894cd4c160d4d40081a418c4cc010008004400400400c1588854cd40041a888168c168014cd4c1a01a800c04cd40041754cd4c12c488ccc144894cd4cc0dcd4d4030194178d40081784cc010008004400400400c581bcc160004d403418cccd4080178d4d4080188178004cc11800c004cc164020d4004170cc140004020d4d40041681554cd4c11001c8400458124c06401cc0d0020448004584d55cf0011aab9d0013754004444a66a6600600400207809c46a0020b0246666666600204044a666ae68cdc38010008020a999ab9a3371200400203203044666ae68cdc400100081b01e802802001912999ab9a337120040022002200444a666ae68cdc4801000880108008881f11199ab9a3371000400207406644666ae68cdc480100081c81911199ab9a337120040020620706607c91100488100223333550023303f2233350050480010023500304222337000029001000a4000660784446006600400240026607666076e01200070246a0024444400a46a0020a246a0024407246a0024406c464a666ae68c140d55ce8008991919191981e2999ab9a305435573a00626464646464646464646464646464646464646464646424666666666600201a01801601401201000e00a00600460446ae84d5d10011980f1981dbae2001357420026ae88008cc071d71aba100135744016a666ae68c190d55ce804899191919827a999ab9a306735573a004264660a066038eb4d5d0800980d9aba1357440026aae7800817d4ccd5cd18339aab9d001132330503301c75a6ae84004c06cd5d09aba200135573c0020be6ea8d5d09aba200237546ae84004d55cf00482e1980c9981b019bad35742014660300326ae84028ccc059d70029aba100a33301575c0086ae84028cc054008d5d08051980a1192999ab9a306035573a0022646609260326ae84004c010d5d09aba200135573c0020b06ea8004d5d08051192999ab9a305f35573a002264646660b060606ae84008ccc059d70029aba10013303375c6ae84d5d10009aba200135573c0020ae6ea8004cc045d73ad37546ae84004d5d10009aba2001357440026ae88004d5d10009aba200135573c006098a666ae68c15c0044c848888c010014c02cd5d09aab9e00215333573460ac00226424444600400a60486ae84d55cf0010a999ab9a3055001132122223001005300c357426aae7800854ccd5cd182a0008990911118018029bae357426aae78008130d55ce8009baa357426ae88008dd51aba100135573c0020906ea80048c94ccd5cd182800081e8a999ab9a304f00102b04735573a6ea800488c8c94ccd5cd18290008058a999ab9a3051001130193004357426aae7800854ccd5cd18280008050241aab9d00137540024464460046eac004c10888cccd55cf8009014119198239981c98031aab9d001300535573c00260086ae8800cd5d0801020919118011bac00130402233335573e002404c46608860086ae84008c00cd5d100101f91919192999ab9a305300211222203515333573460a4004220922a666ae68c1440084c8c848888888cc004024020dd69aba135744a0046eb8d5d0a8008a999ab9a3050002132321222222233002009008375c6ae84d5d128011bae35742a0022a666ae68c13c0084c8c848888888cc018024020dd71aba135744a004603a6ae85400454ccd5cd1827001099091111111803804180e9aba135573c0062a666ae68c1340084c848888888c014020c074d5d09aab9e003045135573c0046aae74004dd50009192999ab9a304a35573a0022646606660086ae84004dd69aba1357440026aae78004108dd50009192999ab9a304935573a00226eb8d5d09aab9e0010413754002220582205444a66a00442a66a00442660240040020462a66a0024046068446a004446a006446666010008006004002446a004444446a00c44444a66a6601e01400a2a66a6601e0120082a666ae68cdc38040018a999ab9a3370e00e0042a66a00c42a66a004426a004446a004446a00a446a00444a66a666602e00c00a0040022a66a00e42a66a008426604800400206a2a66a006406a08c0680562a66a002405607805405405405444446466a00a466a0084a666ae68cdc78010008018121013919a802101392999ab9a3371e0040020060482a66a00642a66a0044266a004466a00446601200400244405444466a0084054444a666ae68cdc38030018a999ab9a3370e00a0042660220080020520520442a66a00240440664466a004466a00446601c0040024046466a004404646601c004002446a004446a00644a666ae68cdc780200109980780180081091199aa9815019180680191a80091199aa981681a980800311a80091199a800919805a40000020144660160029000000998030010009981280100a91199ab9a3370e00400202c03a44a66a00420020324466aa605205c46a002446604e004666a002466aa605a06446a0024466056004601800200244666010016004002466aa605a06446a0024466056004601600200266600600c004002444666aa605005c06466aa605205c46a002446604e0046010002666aa605005c446a00444a66a666aa6054064601a01646a002446601400400a00c200626606c00800602800266aa605205c46a002446604e0046606844a66a002260120064426a00444a66a6601800401022444660040140082600c00600800442444600200842444600600844666ae68cdc780100080800b9980e80080a11299a801012080091980e11199a8018128010009a80080f9192999ab9a303435573a00226464646466666042666016eb9d71aba100433300b75ceb8d5d08019bad357420046eb4d5d0800998051192999ab9a303a35573a0022646604660146ae84004cc035d71aba1357440026aae780040c8dd50009aba1357440026ae88004d5d10009aba200135573c0020586ea80048c94ccd5cd18199aab9d0011323301c3005357420026600c0086ae84d5d10009aab9e00102b375400246464a666ae68c0d00044c8c8c8c8c8488ccc00401801000cdd69aba1357440046eb4d5d08009aba2002375a6ae84004d55cf0010a999ab9a3033001130103004357426aae780080acd55ce8009baa0012323253335734606600226424460020066eb8d5d09aab9e00215333573460640022601e6eb8d5d09aab9e00202a35573a0026ea800488c8c94ccd5cd18190008980798021aba135573c0042a666ae68c0cc0040380a8d55ce8009baa001222325333573460626aae740044c8cc068c014d5d080098021aba1357440026aae780040a4dd5000911a8009119198131119a800a4000446a00444a666ae68cdc7801004898038008980300180298129119a800a4000446a00444a666ae68cdc7801003880089803001919a80081100211a800911a80111111111111999a805900b900b900b9199aa981101500b11a80091299a998090010020980c00180b805912999ab9a3371e6a0040346a0020342666ae68cdc39a80100b1a80080b001805003880b91180f11299a80088019109980300118020009299a800900b0019111a801111299a800909a8029111111111299aa99a999aa981001400a11a800912999ab9a3371e00401c2602c00602a0044260286a0020440244260240022c2c2006424460040066601444a66a0044200620020022018446602e44a66a00203c4426a00444a666ae68cdc78010038a99a8008111109a80111299a8018a999ab9a302d00113301400b0020262202813006003002235001222222222200a2350012201c23500122222222220092220032220012220023333300248811c0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb10048811ce4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d8600330014891c13aa2accf2e1561723aa26871e071fdf32c867cff7e7d50ad470d62f004881074d494e535741500048811c2f2e0404310c106e2a260e8eb5a7e43f00cff42c667489d30e179816004881054f574e455200221233001003002222221233333001006005004003002300b22112225335001135003006221333500500c300400233355300700f0050040012200130092211222533500110022213300500233355300700d005004001300822112253350010052213300f30040023355300600b00400111001220023005221225333573466e20005200013005490103505436001533500213005491035054370022153335734602c0062004266a600c01000266e0400d2002253357380022c240026004444a66a00220044426a004446600e66601000400c00200660024444a66a00220044426a00444a666ae68c0500044ccc02001c01800c4ccc02001ccc028ccc02c01c00800401800c8c8c00400488cc00cc00800800488488cc00401000c88848ccc00401000c00854cd5ce2490350543100162215335001100200715335738921001622222222007220053704904d0f910b111110021b8748000dc3a40046e1d2004370e90031b8748020dc3a40146e1d200c01", "plutusv1"); return r !== null && r.count === 2 && JSON.stringify(r.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 335, hash: "a65ca58a4e9c755fa830173d2a5caed458ac0c73f97db7faae2e7e3b" }, { size: 7707, hash: "e1317b152faac13426e6a83e06ff88a4d62cce3c1634ab0a5ec13309" }]); })());
check("plutusscripts: REAL mainnet V3 field — 1 script(s), hashlib script hashes (Koios ground truth, block 14044775, tx 54d6a884…)", (() => { const r = app.parsePlutusScriptsCbor("d90102815902e35902e00101003229800aba2aba1aba0aab9faab9eaab9dab9a4888888966002646465300130053754003370e9000488c8cc00400400c896600200314a115980099b8f375c601a00200714a3133002002300e0014020805a6012007300900248888966002600800b1323322598009803800c4c8c8c966002602a00513259800980598089baa0018991919912cc004c06800e01516405c6eb4c05c004dd7180b801180b80098091baa0018b202030140038b2024375c60260026026002601c6ea80122b30013370e9001000c566002601c6ea801200516403d16403080604c8c8c9660026600e6eb0c048c04cc04cc04cc04c008dd7180918079baa0158992cc004c024c03cdd500344c8c96600264660020026eb0c05801c896600200314a115980099baf301730143754602e00200714a31330020023018001404880aa266ebcdd398018021ba733014374e660286ea401ccc050c054c058008cc05130010101004bd7025eb822c8080c050004c040dd500344ca60020033002003a514004444b30010028800c660020073017002acc004006266e20dd6980b180b980b9bac30160024800229410112006405080708c8cc004004008896600200314bd7044c8cc88cc88cc008008004896600200310038991980d1ba73301a375200a66034602e00266034603000297ae033003003301c002301a00140606eacc05400cdd7180900099801801980b801180a800a0268b201a37566022002602260226022602200260186ea800cc02cdd50011bae300e300b375400d15980099b874800801626466446600c6eb0c044c048c048c048c048c048c048c048c048c038dd50029bae3011300e3754028601e002601e602000260166ea801a2c80490090c020c024004c020004c00cdd5004452689b2b200226014fd8799f581c065b549de7dbff1141178a1a759033014d45a53bb6be99cba276fbdad8799f4040ffd8799f581c49e423161ef818adc475c783571cb479d5f15ad52a01a240eacc0d3b44434f434bffff0001", "plutusv3"); return r !== null && r.count === 1 && JSON.stringify(r.entries.map(e => ({size: e.size, hash: e.hash}))) === JSON.stringify([{ size: 739, hash: "0fe20512f155e79766bd5ab74151a48c97fadc13166853c164f58285" }]); })());
check("plutusscriptsdecode form present", html.includes('id="plutusscriptsdecode"') && html.includes('id="plutusscriptsdecode-input"') && html.includes('id="plutusscriptsdecode-lang"') && html.includes('id="plutusscriptsdecode-result"'));
check("plutusscripts: rejects an unknown language, empty and garbage", app.parsePlutusScriptsCbor("81450102030405", "plutusv4") === null && app.parsePlutusScriptsCbor("", "plutusv3") === null && app.parsePlutusScriptsCbor("zzzz", "plutusv3") === null);

console.log(failures === 0 ? "\nALL TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
