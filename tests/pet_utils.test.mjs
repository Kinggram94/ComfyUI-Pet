import test from "node:test";
import assert from "node:assert/strict";
import {
  clampPercent,
  formatGB,
  placePopover,
  usageLevel,
} from "../web/pet_utils.js";

test("clampPercent keeps valid values and rejects non-numbers", () => {
  assert.equal(clampPercent(0), 0);
  assert.equal(clampPercent(42.6), 42.6);
  assert.equal(clampPercent(100), 100);
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(150), 100);
  assert.equal(clampPercent("37.5"), 37.5);
  assert.equal(clampPercent(null), null);
  assert.equal(clampPercent(undefined), null);
  assert.equal(clampPercent(""), null);
  assert.equal(clampPercent(NaN), null);
});

test("usageLevel marks high and critical usage", () => {
  assert.equal(usageLevel(20), "");
  assert.equal(usageLevel(84.9), "");
  assert.equal(usageLevel(85), "high");
  assert.equal(usageLevel(94.9), "high");
  assert.equal(usageLevel(95), "crit");
  assert.equal(usageLevel(100), "crit");
  assert.equal(usageLevel(null), "");
});

test("formatGB renders one decimal", () => {
  assert.equal(formatGB(0), "0.0");
  assert.equal(formatGB(1024 ** 3), "1.0");
  assert.equal(formatGB(3.25 * 1024 ** 3), "3.3");
  assert.equal(formatGB(null), "0.0");
});

test("placePopover prefers above and centers on the anchor", () => {
  const p = placePopover(
    { left: 500, top: 600, width: 192, height: 192 },
    { width: 240, height: 300 },
    { width: 1000, height: 900 },
  );
  assert.equal(p.below, false);
  assert.equal(p.left, 476);
  assert.equal(p.top, 290);
  assert.equal(p.arrowX, 120);
});

test("placePopover flips below when there is no room above", () => {
  const p = placePopover(
    { left: 100, top: 40, width: 192, height: 192 },
    { width: 300, height: 200 },
    { width: 1000, height: 900 },
  );
  assert.equal(p.below, true);
  assert.equal(p.top, 242);
});

test("placePopover clamps to viewport and keeps the arrow inside", () => {
  const p = placePopover(
    { left: 985, top: 600, width: 10, height: 10 },
    { width: 300, height: 200 },
    { width: 1000, height: 900 },
  );
  assert.equal(p.left, 692);
  assert.ok(p.arrowX >= 16 && p.arrowX <= 284);
});

test("placePopover handles panels wider than the viewport", () => {
  const p = placePopover(
    { left: 100, top: 600, width: 100, height: 100 },
    { width: 1200, height: 200 },
    { width: 800, height: 600 },
  );
  assert.equal(p.left, 8);
  assert.ok(p.arrowX >= 16 && p.arrowX <= 1184);
});
