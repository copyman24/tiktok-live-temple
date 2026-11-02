# TikTok prayer interaction feature

## Feature playbook

- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
  - [x] **Blocking first steps.** Traced the parser, ritual event, WebSocket, and live screen before setting the event shape.
  - [x] **Independent workstreams.** Fixed the event contract before the end-to-end implementation changed both layers.
  - [x] **Shared mutable state.** Kept the queue and display timers in the client; the backend only broadcasts accepted pairs.
  - [x] **Smallest safe decomposition.** Used one implementation owner to keep the event and animation contract aligned.
- [x] Delegate code-writing to a subagent using your configured feature model (default in poteto-mode's Models section) with a specific scope (file paths, named data shape and its organizing structure per `principle-model-the-domain`, a state machine over scattered booleans, a table/registry over branching, a typed model over repeated shape assumptions, chosen before the delegate writes logic, and success criteria). Pick each subagent's reasoning level for the job, per the Subagents section. When the implementation admits multiple valid shapes (error handling, abstraction layer, test structure), delegate via the `arena` skill instead so the runners surface the alternatives and the cross-judge guards the pick. Mandatory: no skip-with-reason escape, and Laziness Protocol does not override it (the gain is review separation, not lines saved). A subagent forbidden to spawn satisfies this by owning the diff directly with the same review separation. No "standing by" reply that waits on a nested agent. Give every file-writing delegate its own worktree (spawn it with `isolation: "worktree"`, or hand it an exclusive branch), and do not write files or run a suite in a worktree a delegate still holds. On Claude Code, `isolation: "worktree"` branches from the remote default branch unless the `worktree.baseRef` setting is `"head"`. When the delegate builds on commits the default branch lacks, commit them, create its worktree with `git worktree add <path> -b <delegate-branch> HEAD`, and name that base commit in the brief. Fencing a file in the brief's prose is not a lock (`principle-separate-before-serializing-shared-state`). Comments per `Comments`. Surgical edits, re-ground against the source for upstream-derived files. Port shared-primitive improvements to all consumers and verify each. Commit liberally.
- [x] Verify on the matching surface at 1080×1920 and 360×640; inspect accepted comments, handle, merit delta, reduced motion, and exit cleanup.
- [x] Keep one ordered code commit because the backend event, DOM, client queue, and animation form one feature unit.
- [x] Resolve the candidate differences through the arena cross-judge before implementation; no design dispute remained.
- [x] Run `Opening a PR`; opened a ready PR against the current `fork/main` base.

## Throughput checkpoint

- [x] **Blocking first steps.** Trace TikTok chat through sanitization, ritual emission, WebSocket delivery, and live-screen rendering before choosing the comment display contract.
- [x] **Independent workstreams.** Backend chat notification and frontend prayer-slip rendering are disjoint layers; their shared event shape must be fixed before parallel implementation.
- [x] **Shared mutable state.** Keep the random comment pool and rotation timer in the live client; the backend only publishes validated viewer-comment pairs.
- [x] **Smallest safe decomposition.** Use one implementation owner because the backend event shape and background animation must ship as one compatible feature.

## Arena playbook

- [x] Frame.
- [x] Fan out.
- [x] Cross-judge.
- [x] Pick a base.
- [x] Graft.
- [x] Verify.

## Architect playbook

- [x] Ground.
- [x] Sketch.
- [x] Agree. n/a: no human checkpoint was requested, so proceed from the synthesized design.
- [x] Implement.
- [x] Scrap. n/a: implementation matches the accepted sketch; no feature was dropped.
