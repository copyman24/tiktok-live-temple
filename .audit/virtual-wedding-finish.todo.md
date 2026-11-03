# Stage finish pass

## Session pickup

- [x] Read the project checkpoint first using [Resume storage](../references/resume-storage.md). A successful read gives the note and artifacts without requiring a path from the previous session. If the pointer is missing, locate the prior trail through a local transcript under Claude Code's per-project transcripts directory at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/<encoded-cwd>/*.jsonl` (`node <plugin>/skills/reflect/scripts/claude-project-dir.mjs` prints this session's directory, which holds the earlier sessions that started in the same directory. For one that started elsewhere, pass its start directory: `node <plugin>/skills/reflect/scripts/claude-project-dir.mjs "<start directory>"`. Do not glob across other directories under `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/`, that crosses workspace boundaries and reads private chats from unrelated projects), a cloud-agent URL, or a pushed branch. An unavailable or incomplete checkpoint needs diagnosis rather than a silent fallback. For transcript fallback, read the metadata overview and last messages first, then scan back for the decision points. Parse a long transcript in a subagent and keep the reduced timeline in the main thread (the **principle-guard-the-context-window** skill). Pick each subagent's reasoning level for the job, per the Subagents section of the **poteto-mode** skill.
- [x] Reconstruct operational state. The branch and worktree, what already landed (`git log`, `git diff` against the base), the open todos, the decisions made. Use the prior trail to recover progress. For claims about human rulings, follow [Claims about human decisions](../../why/references/epistemics.md#claims-about-human-decisions). An agent summary is not the original ruling.
- [x] Diff done vs pending. Compare what shipped against what was planned, name the resume point, do not re-run the prior repro or redo completed work. Recheck claims that affect the remaining work without repeating completed investigations. Read artifacts linked by the resume note, including requested questions or checklists.
- [x] Route the remaining work to the matching playbook and pick the verdict: continue the execution, ship a finished recommendation, ratify or override a prior conclusion, or postmortem a failed run. The pickup playbook ends here. The routed playbook owns the rest.
- [x] Verify the inherited claims against the original goal on the real artifact (the **principle-prove-it-works** skill). A passing prior self-report is not the proof.

## Phase gates

- [ ] **Blocked.** `build-phase advance` requires plan and asset approval. Session `56aee4b2ef31ae5bdc08f8d299a7ad600a0e717855bc82fba3f2187c63b21d4f` has `receipt: null`; `serve` exits 2 because no reviewer can open a browser in this session, and `verify` exits 1 while the decision is pending.
- [ ] Close hero from a valid comp-sized capture and the measured hero diff.
- [ ] Close sections and motion against the rendered stage.
- [ ] Capture and close responsive checks at comp, desktop, and mobile sizes.
- [ ] Run the required design detector once and prepare the full finish-review packet.
- [ ] Obtain a fresh finish review, act on its actual disposition, document the visual system, and record the disposition with `build-phase finish`.
- [x] If any required human approval or reviewer is unavailable, record the precise open gate and report the blocker.
- [ ] **BLOCKED: independent trail review.** The active user routing maps judgment and prose to `inherit-parent`, so a different-family audit reviewer cannot be dispatched.

## Resume evidence

- The shared resume pointer was missing. The Codex transcript for thread `01a19d17-08a3-72c1-9c93-adda1462fa50` was found and its latest user/developer messages were read.
- The app source, bundles, and interaction verification are inherited from `.audit/virtual-wedding-app.todo.md` and `.audit/virtual-wedding.tsv`.
- The current build-phase state still has `plates` open with a passing 2/2 score; `hero`, `sections`, `motion`, `responsive`, and `review` are pending.
- agent-browser rendered the current stage at 941×1672 and saved `.impeccable/review/virtual-wedding-stage-plate-review.png`.
- No finish disposition is recorded because the required user plan approval blocks every later phase and the independent finish review.
- The finish reviewer and no-comments review were not dispatched because the component-review approval gate remains open.
- Completion pass 2 tried `component-review prepare`, a fresh capture, `lifecycle --hosted`, and `serve` while a named agent-browser session was active. The review remains pending with no receipt.
- Completion pass 3 rechecked the current completion report and review session. The same pending receipt and six open phases remain.
