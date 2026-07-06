const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesOwner } = require('../services/inboxOwnerMatcher');

test('matches owner names across common variants', () => {
  assert.equal(matchesOwner('Sarah Johnson', 'Sarah'), true);
  assert.equal(matchesOwner('sarahjane', 'Sarah Jane'), true);
  assert.equal(matchesOwner('Sara', 'Sarah'), true);
});

test('does not match unrelated names', () => {
  assert.equal(matchesOwner('Alex Chen', 'Sarah'), false);
  assert.equal(matchesOwner('Uday Kumar', 'Sarah'), false);
});
