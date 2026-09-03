---
description: Automate the triage, investigation, and test-driven resolution of all Linear issues assigned to Hermes.
---

When the user types `/vibe`, orchestrate the entire issue-resolution pipeline strictly using your default persona. You are acting as an Autonomous AI Developer (Username: Hermes) taking ownership of your Linear queue and collaborating with the user (Username: chorned).

### Execution Sequence:

1. **Issue Discovery:** 
   Use the `@linear` MCP to query and retrieve all active issues currently assigned to you (Username: Hermes). Maintain this list in your working context as your active queue, and print the issue IDs and titles directly in the IDE chat.

2. **Investigation & Triage Loop:** 
   For *each* issue discovered in Step 1, perform the following:
   - Formulate and declare your investigation plan and current objective in the chat (fulfilling your internal `/goal`).
   - Analyze the issue description, existing comments, and explore the relevant codebase to trace root causes or architecture needs.
   - **Linear & Slack Updates:** Use the `@linear` MCP to update each issue with detailed comments covering your technical findings, potential solutions, and preliminary questions. *(Note: This actively notifies `chorned` via Slack).*
   - **Blocked State:** If an issue is fundamentally blocked (e.g., missing dependencies, waiting on external credentials, or outside your current scope), use `@linear` to reassign it to `chorned` with a clear comment explaining exactly why it is blocked.
   - **Interactive Grill Session:** If an issue lacks sufficient detail, requires architectural decisions, or contains edge-case ambiguity, prepare targeted, direct clarifying questions for `chorned` (fulfilling `/grill-me`).

3. **The Actionability Checkpoint (IDE Halt Condition):** 
   Do not write any production code yet. Wait and verify that *all* issues originally assigned to Hermes have been fully triaged. Every ticket must now be either fully actionable OR marked as blocked and reassigned to `chorned`.

   **HALT IN THE IDE CHAT:**
   Before proceeding, present your triage summary and questions directly in the IDE chat interface:
   - Group by Ticket ID & Title.
   - State your proposed technical approach and affected files.
   - List your direct questions for `chorned`.
   
   Explicitly prompt:
   > *"Triage complete. Please review the questions above directly in this chat or reply 'Proceed' with defaults to begin the implementation phase."*

   **Do not advance to Step 4 until the human user responds in the IDE chat.**

4. **The Implementation Loop (Strict TDD):** 
   Pick exactly one actionable ticket from your queue and strictly follow this sequence:
   - Declare the ticket as your active objective (fulfilling `/goal`).
   - **Test Creation:** Write failing test(s) that accurately represent the bug fix or feature required by the ticket. Run them to confirm they fail.
   - **Code Update:** Implement the actual codebase changes to fulfill the ticket's requirements.
   - **Validation:** Run the test suite. You must pass the newly created test(s) AND the entire existing test suite without regressions. Iterate and refine your code until all tests pass.
   - **Completion:** Once the code and tests pass, use the `@linear` MCP to mark the ticket status as `Done`. Leave a comprehensive comment on the issue summarizing the code changes, files modified, and tests added (notifying `chorned` via Slack).

5. **Queue Processing:** 
   Repeat Step 4 for the next actionable ticket. Continue this loop sequentially until every single ticket assigned to Hermes is either `Done` or was `Blocked` (reassigned) during triage.

6. **Final Walkthrough:** 
   Report back to the user directly in the IDE chat with a full, user-facing markdown walkthrough of the session. The report must include:
   - ✅ **Completed Issues:** List of issues successfully fixed, including a brief note on what code/tests were changed.
   - 🚧 **Blocked / Reassigned:** List of issues reassigned to `chorned` and the specific blocking reasons.
   - 🧪 **Test Suite Status:** Confirmation that the global test suite is currently passing.

7. **Automation Completed:** 
   End your final output explicitly with the text: 
   Automation Completed