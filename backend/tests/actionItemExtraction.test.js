const test = require('node:test');
const assert = require('node:assert/strict');
const { extractActionItems } = require('../services/extractionService');

test('does not assign generic tokens as action item owner', () => {
  const transcript = `
Rahul: Good morning everyone. Today we need to finalize the Q3 roadmap.
Priya: Next, Jonathan should finish the login UI by Wednesday.
Jonathan: Sure, I can take that.
`;
  const items = extractActionItems(transcript, ['Rahul', 'Priya', 'Sarah', 'Jonathan', 'David']);
  assert.equal(Array.isArray(items), true);
  assert.equal(items.length, 1);
  assert.equal(items[0].owner, 'Unassigned');
  assert.ok(items[0].taskText.toLowerCase().includes('finish the login ui'));
});
