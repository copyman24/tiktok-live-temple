### Bug fix

**You own this task. Plan, review, verify.** Delegate investigation and the fix to subagents, stay in the lead. Pick each subagent's reasoning level for the job, per the Subagents section of poteto-mode.

1. Reproduce it yourself on the matching surface via the driver skill (Non-negotiables), even when a debug or instrumentation protocol says to ask the user to reproduce. Ask the user only with a stated, specific reason the control surface cannot reach the target, and only after driving it as far as it goes. If it won't reproduce directly, synthesize the trigger, tighten conditions, or instrument until it fires.
2. Binary-search the cause. Form the candidate hypotheses, then rule them out until one survives. Seed them with how over the affected subsystem and the why skill for regression history. Each pass, take the split that cuts the most remaining problem space, get runtime evidence, eliminate. When program state is unclear, add instrumentation or logging and read it as the code runs. Don't guess. Drive a long or stubborn hunt with Claude Code's loop skill. Confirm the surviving mechanism with runtime evidence before the step-3 architect/interrogate fan-out.
3. Plan the fix. If it crosses a function boundary, architect first. Delegate implementation to a subagent using your configured bug-fix model (default in poteto-mode's Models section) with a specific scope.
4. Verify on the same surface. The original repro now passes. "Inconclusive" or wrong-surface is not a pass. Flag it. Unit tests show branch behavior, not bug absence.
5. Stage the commits so the failing repro lands before the fix in git history. See the tdd skill for the failing-test-first cadence when the bug has a cheap local test path. Skip it when the test would be expensive, integration-heavy, or unclear.
6. Run Opening a PR.

### Task-specific

- [x] Read the Vietnamese report and trace each request to the current livestream renderer.
- [x] Reproduce the current 9:16 OBS stage and inspect its rendered layout.
- [x] Implement the six requested livestream changes while preserving ritual, audio, and RPC behavior.
- [x] Drive the same stage with simulated comments and gifts, then inspect the rendered result.
- [x] Review the final diff and clean up temporary verification state.

## Verification record

- Chromium `/?obs=1` at 540×960 showed the generic connection label, the operator-only simulator toggle, all three gift icons, and five merit-sorted leaderboard rows.
- `temple.comment` rendered the latest text for the same commenter and anchored the bubble by viewer ID; it disappeared after its timeout.
- `temple.offerGift` rendered the donor name, loaded avatar, gift name, and `× 3`; the notice disappeared after its timeout.
- Enabling auto-simulation changed total merit from 9,105 to 9,125. It was disabled after the check.
- `node --check server.js`, `node --check public/js/live.js`, and `git diff --check` passed.
- Actual TikTok Studio safe-area behavior was not available to inspect; verification used the app's 9:16 OBS output.

skip: Subagent delegation is prohibited by the active collaboration instructions; perform the required grounding and design work in-thread.
skip: TDD is not used because this is an integration-heavy browser surface; verify behavior by driving the running app.
