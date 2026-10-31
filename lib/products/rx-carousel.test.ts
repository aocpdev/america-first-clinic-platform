import test from "node:test";
import assert from "node:assert/strict";
import { rxCarouselMetrics } from "./rx-carousel";

test("carousel indicator shows the visible portion and follows the scroll position", () => {
  assert.deepEqual(rxCarouselMetrics(400, 600, 0), { previous: false, next: true, progress: 0, thumbWidth: 66.67, thumbLeft: 0 });
  assert.deepEqual(rxCarouselMetrics(400, 600, 100), { previous: true, next: true, progress: 50, thumbWidth: 66.67, thumbLeft: 16.67 });
  assert.deepEqual(rxCarouselMetrics(400, 600, 200), { previous: true, next: false, progress: 100, thumbWidth: 66.67, thumbLeft: 33.33 });
});
test("overscroll is clamped and subpixel edges disable the correct arrow", () => {
  assert.deepEqual(rxCarouselMetrics(400, 600, -30), rxCarouselMetrics(400, 600, 0));
  assert.deepEqual(rxCarouselMetrics(400, 600, 230), rxCarouselMetrics(400, 600, 200));
  assert.equal(rxCarouselMetrics(400, 600, 199.5).next, false);
});
test("empty, single-page and invalid sizes have no navigation; mobile resize recalculates", () => {
  for (const [viewport, content] of [[0, 0], [400, 300], [400, 400], [NaN, 600]]) {
    const state = rxCarouselMetrics(viewport, content, 0);
    assert.equal(state.previous, false); assert.equal(state.next, false); assert.equal(state.thumbWidth, 100);
  }
  assert.equal(rxCarouselMetrics(200, 600, 0).thumbWidth, 33.33);
});
