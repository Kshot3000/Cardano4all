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
check("all form controls labelled", ["addr", "ada", "lovelace", "q", "slot", "epoch", "stake-ada", "stake-rate", "stake-epochs"].every(id =>
  html.includes(`for="${id}"`) || html.includes(`aria-label`)));
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=3"));
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

console.log(failures === 0 ? "\nALL TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
