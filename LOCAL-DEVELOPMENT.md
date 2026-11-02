# Local Handy development on Windows

Run `bun install` once, then `bun run dev:local`.

To use the already compiled local build without recompiling, run `bun run start:local`.
Use `dev:local` when editing, so changes are reloaded. The launcher refreshes
installed tool paths even when the terminal was opened before their installation.

This launches **Handy Dev** with app identifier `com.pais.handy.dev`, separate
settings/history under `%APPDATA%\com.pais.handy.dev`, and update checks disabled.
Autostart is disabled for this identity. The normal installed app is not replaced.
Do not install a generated Handy installer over the normal installation.

The launcher copies completed Handy model caches to
`.handy-dev.local/huggingface` without overwriting existing development copies.
It never links to the original models. Its first run may take a little time and
needs additional disk space. Settings and recordings are not copied. Complete
the development app's onboarding and select an already downloaded model.

Quit normal Handy using its tray menu before testing Dev, so their microphone
and global shortcuts do not compete. Quit Dev before reopening normal Handy.
Closing a settings window alone may leave either app running in the tray.

To prepare model copies without launching: `bun run scripts/dev-local.ts --prepare-only`.

Native prerequisites are listed in BUILD.md: Rust, Microsoft C++ build tools,
CMake, and the Vulkan SDK. Keep this work local; no commit, push, or PR is needed.

## Windows overlay layouts

For streaming and non-streaming models, drag the control bar to move the overlay,
or drag any edge/corner to resize it. Text selection and Cancel remain separate
actions. Compact and live layouts are saved independently across recordings and
restarts, so changing models does not overwrite the other layout. Settings >
Advanced > Overlay layout > Reset overlay restores both sizes and placements; choosing
Top or Bottom also resets it. If a monitor disappears, the saved layout is clamped
back onto an available desktop. Other platforms retain their existing behavior.

## Edit while recording

On Windows, the Live overlay is an editable text field. Click into it and type,
select, delete or paste while dictation continues. There is no Edit button.
Moving uses the control bar; resizing uses the edges/corners.

Each manual change protects the text currently visible. Subsequent speech is
appended separately; revisions to tentative recognition cannot replace that
protected text. The caret/selection stay in place during speech updates, and
IME composition is allowed to finish before final delivery.

Stop dictation with the usual shortcut. The final recognition result is merged
with the draft and pasted into the original window. If you made corrections,
those take precedence over optional automatic post-processing. Without edits,
the configured final processing is preserved. A paste/focus failure keeps the
draft visible with a retry action. A very large recognition rewrite is blocked
for manual recovery instead of guessing at the merge.

This requires a streaming-capable model. Non-streaming models retain their
existing compact overlay. Changes stay in Handy Dev, separate from installed Handy.

## Local writing and transcript workspace

General > Writing profiles offers Dictation, Clean up wording, and Translate to
English. The profile applies to ordinary dictation, the legacy post-processing
shortcut, and retranscription. External provider processing is bypassed in this
personal build. Existing provider settings are retained but not used.

Cleanup and translation require Ollama on 127.0.0.1:11434 and an installed local
GGUF text model (default gemma3:4b). Check model verifies model metadata without
sending transcript text. Remote models, proxies and redirects are rejected.
No model is downloaded automatically. Failure, incomplete output, or input over
4,000 UTF-8 bytes preserves the original text. The first request can be slow;
the text model unloads afterward to free memory for speech recognition.

History > expand an entry > Edit transcript lets you title, correct, copy and
export text. Saving marks the entry Saved and preserves corrections across
retranscription. Original recognition results remain available. Unsaved drafts
are stored locally and recovered when reopening the same entry; stale drafts
cannot overwrite newer saved versions. Repeated word corrections suggest an
addition to vocabulary, but only explicit approval changes vocabulary.

## Appearance presets

General > Appearance includes Classic, Slate, Forest, High Contrast, and
Paper and Dusk. Light/Dark/System remains the existing saved theme setting.
Accent and normal/large text size are independent preferences. The style
selection persists in this app's local webview storage and synchronizes to
its recording overlay. Reset style and text size restores Classic defaults
without changing Light/Dark/System. No custom theme files are loaded.
