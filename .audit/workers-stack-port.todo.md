# Workers migration checklist

**Superseded:** The user changed the target to a Windows Tauri desktop app and asked to retain ZeroTTS as a sidecar. No Workers source code from this attempt remains. Keep this checklist and its log as history only.

- [x] Read the Principles section of the **poteto-mode** skill.
- [ ] Phase A: Frame the migration with a falsifiable end condition, scope, and blockers.
- [ ] Phase B: Design the workflow and establish a Workers runtime check before feature work.
- [ ] Phase C: Implement one independently verifiable migration unit at a time.
- [ ] Phase D: Keep the decision trail as each design choice and verification lands.
- [ ] Phase E: Verify the complete app in a Workers runtime and hand back open limits.
- [ ] Architect phase A: Ground the existing app and its boundaries.
- [ ] Architect phase B: Produce competing type and module sketches, compare and synthesize them.
- [ ] Architect phase C: Proceed with the chosen sketch. No user checkpoint was requested.
- [ ] Architect phase D: Implement against the accepted sketch and record deviations.
- [ ] Architect phase E: Scrap and redesign only if implementation exposes a repeated structural failure.
- [ ] Arena phase A: Frame the artifact and gradeable architecture rubric.
- [ ] Arena phase B: Compare at least two independent Workers architecture sketches.
- [ ] Arena phase C: Cross-judge only if a different-family model is allowed by routing.
- [ ] Arena phases D–F: Pick, synthesize, and verify one coherent design.
- [ ] Keep the current TikTok-to-screen and OBS behavior, with no TikTok or SaaS auth.
- [ ] Move routing, state, WebSockets, TikTok event intake, persistence, and TTS into Workers-compatible services.
- [ ] Prove the actual Workers runtime serves the UI and handles both screen notifications and app commands.
