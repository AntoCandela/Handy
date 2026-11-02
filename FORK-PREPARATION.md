# Personal fork publication preparation

This checkout is being prepared as an unofficial source preview. Nothing in this
document authorizes a push, pull request, release, or change to upstream Handy.

## Scope and attribution

The README describes the custom overlays, history workspace, local writing
profiles, appearance presets, and refreshed settings and navigation. Upstream
documentation is retained and explicitly identified. Keep LICENSE and all
existing third-party notices. Downloaded models retain their own licenses;
the application license does not replace those terms.

## Local inspection — 2026-11-01

- The original `origin` remote still points to `cjpais/Handy`. The verified
  personal fork, `https://github.com/AntoCandela/Handy`, is configured as `fork`
  and is this development branch's push destination. Local commit preparation
  does not upload source or create a pull request.
- Candidate tracked and untracked source filenames were inspected. No personal
  database, recording, transcript export, private key, or Dev build directory
  appeared in the candidate set. No candidate exceeded 10 MiB.
- The tracked Silero VAD GGUF and notification WAV files are existing application
  resources, not personal recordings or downloaded dictation model caches.
- Changed text was checked for this workstation's absolute home path and common
  credential/private-key signatures; none matched. This is a limited hygiene
  check, not a complete secret or historical repository audit.
- Explicit ignore rules now protect the Dev directory, environment files,
  private keys, root recording/transcript/cache directories, and database files.
  Ignore rules do not protect a file already tracked or force-added.
- The MIT license and original attribution are unchanged.

## Known limitations

- Windows is the primary validation platform for the custom changes. Native
  focus restoration, clipboard delivery, tray interactions, and monitor changes
  still need manual release testing. Browser fixtures mock native commands.
- Local cleanup and translation are optional and experimental. They require
  separately installed Ollama and local GGUF weights. They currently preserve
  the original on failures or inputs over 4,000 UTF-8 bytes. No new end-to-end
  Ollama validation was performed during this preparation.
- New strings are provided in English; other languages need translation review.
- Legacy external-provider helpers remain in the source, although these custom
  writing profiles bypass that processing path. Removing them is a separate
  refactor, not a prerequisite to describing this experimental source accurately.
- A full review of every accumulated application change and Git history is not
  claimed by this publication preparation.

## Before publishing source

1. Review the final diff and all untracked source files, including test fixtures.
   Never include `.handy-dev.local`, screenshots containing real transcripts,
   environment files, app settings, logs, models copied from a user cache, or
   recordings. Use synthetic text for any future public screenshots.
2. Explicitly authorize upload to the verified `AntoCandela/Handy` fork.
3. Verify both remote URLs before pushing any commit. This checkout shares Git
   configuration with other worktrees, so the original remote name `origin` was
   preserved instead of renaming it to `upstream`. Use `fork` for publication.
4. Review inherited Actions before enabling them. In particular,
   `main-build.yml` builds packaging artifacts on pushes to main and
   `release.yml` creates releases when manually dispatched. They still use
   upstream packaging assumptions. Do not advertise those artifacts as fork
   installers.
5. Stage only reviewed files, inspect the staged diff, commit the source preview,
   and push only to the personal fork. Do not open an upstream PR automatically.

## Before distributing installers

- Choose a distinct app name and identifier, install location, update endpoint,
  and signing configuration. The default Tauri config still identifies the
  official Handy application; it is not ready for distributing this fork.
- Keep upstream updater keys/endpoints out of a fork release configuration.
- Validate clean installation, coexistence with official Handy, upgrades,
  history migration, uninstall behavior, and platform permissions.
- Validate optional writing profiles with an actual local runtime, including
  unavailable-model and failed-generation recovery.
- Review redistribution notices for bundled native libraries and resources.

Until then, use the isolated Dev commands in LOCAL-DEVELOPMENT.md. The Dev
configuration disables bundling and its launcher disables update checks.

## Reproducible checks

Preparation results on 2026-11-01: frontend build and lint passed; the three
direct regression scripts below passed; all 13 tests in the five listed browser
specs passed using installed Chrome and a local Playwright configuration.
The frontend build reported its existing large-chunk warning. Native tests and
installer validation were not rerun for these documentation/ignore changes.

```sh
bun run build
bun run lint
bun src/overlay/liveDraft.test.ts
bun src/components/settings/history/historyView.test.ts
bun src/components/settings/history/correctionCandidate.test.ts
bunx playwright install chromium
bunx playwright test tests/appearance.spec.ts tests/model-picker.spec.ts tests/overlay-status.spec.ts tests/workspace.spec.ts tests/models.spec.ts
```

Native checks need the prerequisites in BUILD.md. Close Handy Dev before native
tests or builds on Windows because the build stages libraries used by the app.
No native application source was changed by this publication preparation.
