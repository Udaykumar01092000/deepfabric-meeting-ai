const test = require('node:test');
const assert = require('node:assert/strict');
const { extractActionItems } = require('../services/extractionService');

test('generic tokens are not treated as action item owners', () => {
  const transcript = `
Rahul: Good morning everyone. Today we need to finalize the Q3 roadmap.
Priya: Next, Jonathan should finish the login UI by Wednesday.
Jonathan: Sure, I can take that.
`;
  const items = extractActionItems(transcript, ['Rahul', 'Priya', 'Sarah', 'Jonathan', 'David']);
  assert.equal(items.length, 2);
  const roadmapItem = items.find(i => i.taskText.toLowerCase().includes('finalize the q3 roadmap'));
  assert.ok(roadmapItem, 'Expected roadmap item extracted');
  assert.equal(roadmapItem.owner, 'Unassigned');
  const loginItem = items.find(i => i.taskText.toLowerCase().includes('finish the login ui'));
  assert.ok(loginItem, 'Expected login item extracted');
  assert.equal(loginItem.owner, 'Jonathan');
});
