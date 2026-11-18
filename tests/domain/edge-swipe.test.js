import test from 'node:test';
import assert from 'node:assert/strict';
import { isOpenSwipe } from '../../src/hooks/useEdgeSwipe.js';

test('a clear swipe right from the left strip opens the menu', () => {
  assert.equal(isOpenSwipe({ x: 40, y: 300 }, { x: 120, y: 310 }), true);
  assert.equal(isOpenSwipe({ x: 2, y: 300 }, { x: 90, y: 300 }), true);
});

test('scrolling, short moves and swipes that start further in do not', () => {
  assert.equal(isOpenSwipe({ x: 40, y: 300 }, { x: 70, y: 300 }), false); // too short
  assert.equal(isOpenSwipe({ x: 40, y: 300 }, { x: 120, y: 420 }), false); // mostly vertical
  assert.equal(isOpenSwipe({ x: 200, y: 300 }, { x: 320, y: 300 }), false); // started away from the edge
  assert.equal(isOpenSwipe({ x: 60, y: 300 }, { x: 20, y: 300 }), false); // leftwards
});
