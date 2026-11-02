//! Windows live editor delivery. Recording continues during editing; the final
//! pipeline waits for the webview to merge its draft and deliver it once.
use super::*;
use std::sync::{Mutex, MutexGuard};
use tokio::sync::oneshot;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, IsWindow, SetForegroundWindow,
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Phase {
    Idle,
    Recording,
    Ready,
    Submitting,
}

#[derive(Clone, Copy)]
struct Destination {
    hwnd: usize,
    process: u32,
}

struct Session {
    id: u64,
    phase: Phase,
    target: Option<Destination>,
    response: Option<oneshot::Sender<String>>,
}

static SESSION: Mutex<Session> = Mutex::new(Session {
    id: 0,
    phase: Phase::Idle,
    target: None,
    response: None,
});

fn session() -> MutexGuard<'static, Session> {
    SESSION.lock().unwrap_or_else(|e| e.into_inner())
}

pub(crate) fn start(id: u64) {
    let target = unsafe {
        let hwnd = GetForegroundWindow();
        let mut process = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process));
        (!hwnd.is_invalid() && process != 0).then_some(Destination {
            hwnd: hwnd.0 as usize,
            process,
        })
    };
    *session() = Session {
        id,
        phase: Phase::Recording,
        target,
        response: None,
    };
}

pub(crate) fn cancel() {
    let mut current = session();
    current.phase = Phase::Idle;
    current.response = None; // wakes the waiting pipeline without a paste
}

pub(crate) fn blocks_shortcuts() -> bool {
    matches!(session().phase, Phase::Ready | Phase::Submitting)
}

fn require_overlay(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "recording_overlay" {
        Ok(())
    } else {
        Err("This command is only available in the recording overlay".into())
    }
}

pub(crate) enum ReviewOutcome {
    Unchanged,
    Applied(String),
    Cancelled,
}

#[derive(Clone, serde::Serialize)]
struct Ready {
    id: String,
    text: String,
    raw: String,
}

pub(crate) async fn review(app: &AppHandle, id: u64, raw: &str, text: &str) -> ReviewOutcome {
    let receiver = {
        let mut current = session();
        if current.id != id {
            return ReviewOutcome::Cancelled;
        }
        if current.phase != Phase::Recording {
            current.phase = Phase::Idle;
            return ReviewOutcome::Unchanged;
        }
        let (sender, receiver) = oneshot::channel();
        current.response = Some(sender);
        current.phase = Phase::Ready;
        receiver
    };
    let ready = Ready {
        id: id.to_string(),
        text: text.to_owned(),
        raw: raw.to_owned(),
    };
    let handle = app.clone();
    if app
        .run_on_main_thread(move || {
            {
                let current = session();
                if current.id != id || current.phase != Phase::Ready {
                    return;
                }
            }
            // Do not re-show/reset the overlay or steal focus. The webview
            // flushes IME input, merges the final source, then submits its draft.
            let result = handle.emit_to("recording_overlay", "overlay-editor-finalize", ready);
            if let Err(error) = result {
                log::error!("Could not open overlay editor: {error}");
                cancel();
            }
        })
        .is_err()
    {
        cancel();
    }
    match receiver.await {
        Ok(text) => ReviewOutcome::Applied(text),
        Err(_) => ReviewOutcome::Cancelled,
    }
}

fn valid_submission(current: &Session, id: u64) -> bool {
    current.id == id && current.phase == Phase::Ready && current.response.is_some()
}

fn restore(target: Destination) -> Result<(), String> {
    let hwnd = HWND(target.hwnd as *mut core::ffi::c_void);
    // Validate both the window and owning process; HWNDs may be reused after close.
    unsafe {
        let mut process = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process));
        if !IsWindow(Some(hwnd)).as_bool() || process != target.process {
            return Err("The original destination window is no longer available".into());
        }
        if GetForegroundWindow() != hwnd
            && (!SetForegroundWindow(hwnd).as_bool() || GetForegroundWindow() != hwnd)
        {
            return Err("Could not return focus to the original destination".into());
        }
    }
    Ok(())
}

pub async fn submit_overlay_edit(
    window: tauri::WebviewWindow,
    id: String,
    text: String,
) -> Result<(), String> {
    require_overlay(&window)?;
    let id = id.parse::<u64>().map_err(|_| "Invalid edit session")?;
    if text.len() > 1_000_000 {
        return Err("Edited text is too large".into());
    }
    let target = {
        let mut current = session();
        if !valid_submission(&current, id) {
            return Err("This edit session has already ended".into());
        }
        let target = current
            .target
            .ok_or("No original destination is available")?;
        current.phase = Phase::Submitting;
        target
    };
    let app = window.app_handle().clone();
    let (sender, receiver) = oneshot::channel();
    let scheduled = app.run_on_main_thread(move || {
        let _ = sender.send(restore(target));
    });
    let result = if let Err(error) = scheduled {
        Err(error.to_string())
    } else {
        receiver
            .await
            .map_err(|_| "Focus restoration was interrupted".to_string())
            .and_then(|r| r)
    };
    let result = match result {
        Ok(()) => {
            let app = app.clone();
            let output = text.clone();
            tauri::async_runtime::spawn_blocking(move || {
                {
                    let current = session();
                    if current.id != id || current.phase != Phase::Submitting {
                        return Err("The edit session was cancelled".into());
                    }
                }
                if unsafe { GetForegroundWindow().0 as usize } != target.hwnd {
                    return Err("The paste destination lost focus".into());
                }
                if output.is_empty() {
                    Ok(())
                } else {
                    crate::utils::paste(output, app)
                }
            })
            .await
            .map_err(|e| e.to_string())
            .and_then(|r| r)
        }
        Err(error) => Err(error),
    };
    let mut current = session();
    if current.id == id && current.phase == Phase::Submitting {
        if result.is_ok() {
            current.phase = Phase::Idle;
            if let Some(sender) = current.response.take() {
                let _ = sender.send(text);
            }
        } else {
            current.phase = Phase::Ready;
            drop(current);
            let _ = window.set_focus();
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_closed_destination_is_rejected_without_pasting() {
        assert!(restore(Destination {
            hwnd: 0,
            process: 0
        })
        .is_err());
    }
    #[test]
    fn stale_and_duplicate_editor_submissions_are_rejected() {
        let (sender, _receiver) = oneshot::channel();
        let mut current = Session {
            id: 4,
            phase: Phase::Ready,
            target: None,
            response: Some(sender),
        };
        assert!(valid_submission(&current, 4));
        assert!(!valid_submission(&current, 3));
        current.phase = Phase::Submitting;
        assert!(!valid_submission(&current, 4));
        current.phase = Phase::Idle;
        assert!(!valid_submission(&current, 4));
    }
}
