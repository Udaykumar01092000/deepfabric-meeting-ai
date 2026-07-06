const test = require('node:test');
const assert = require('node:assert/strict');
const { extractDecisions } = require('../services/extractionService');

test('does not extract generic decision prompt as a decision', () => {
  const transcript = `
Rahul: Good morning everyone. Today we need to finalize the Q3 roadmap and prepare for the beta release.
Priya: Before we start, the authentication module is almost complete. Jonathan, can you finish the login UI by next Wednesday?
Jonathan: Yes, I'll complete the login UI by Wednesday, July 8.
Rahul: Great. Sarah, please finish the authentication APIs by Friday, July 10.
Sarah: Sure, I'll complete the authentication APIs before Friday.
David: QA can't begin testing until both the frontend and backend are ready.
Rahul: That's fine. David, once both tasks are complete, prepare the regression test plan by July 13.
David: I'll do that.
Priya: We also need to integrate email notifications into the application.
Rahul: Good point. Sarah, can you investigate SendGrid integration and provide an implementation proposal by July 9?
Sarah: Yes, I'll prepare the proposal.
Jonathan: The current dashboard layout still has responsive issues on tablets. I'll fix those before July 11.
Rahul: Excellent.
Priya: One concern is that we still don't have approval from the security team.
Rahul: Yes, that's a blocker. Without security approval we cannot release the beta.
David: Another risk is limited QA resources because two engineers are on leave next week.
Rahul: Understood.
Rahul: Let's make a decision today. The beta release will be postponed by one week to ensure quality.
Everyone: Agreed.
Rahul: Sarah, after completing the API work, coordinate with Jonathan to verify the complete login flow.
Sarah: Sure.
Rahul: Jonathan, please review the API documentation before integration.
Jonathan: I'll review it tomorrow.
Rahul: Perfect. Let's meet again next Monday to review progress.
`;

  const decisions = extractDecisions(transcript, ['Rahul', 'Priya', 'Sarah', 'Jonathan', 'David']);
  assert.equal(Array.isArray(decisions), true);
  assert.equal(decisions.length, 1);
  assert.ok(decisions[0].statement.toLowerCase().includes('postponed by one week'));
});
