//! User-adjusted Windows overlay geometry. Separate from transcription settings.
use super::*;
use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

static TRACK_USER_LAYOUT: AtomicBool = AtomicBool::new(false);
const STORE: &str = "overlay-layout.json";

#[derive(Clone, Copy, Deserialize, Serialize)]
struct Layout {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale: f64,
}

fn store(app: &AppHandle) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    app.store(crate::portable::store_path(STORE))
        .map_err(|e| e.to_string())
}

pub(super) fn reset(app: &AppHandle) -> Result<(), String> {
    TRACK_USER_LAYOUT.store(false, Ordering::Relaxed);
    let store = store(app)?;
    store.delete("live");
    store.delete("compact");
    store.save().map_err(|e| e.to_string())?;
    let _ = app.emit_to("recording_overlay", "overlay-layout-custom", false);
    Ok(())
}

pub(super) fn prepare(window: &tauri::WebviewWindow, streaming: bool) {
    TRACK_USER_LAYOUT.store(false, Ordering::Relaxed);
    let _ = window.set_resizable(true);
    let text_scale = windows_text_scale_factor();
    let (width, height) = if streaming {
        (280.0, 120.0)
    } else {
        (224.0, 50.0)
    };
    let min = Some(tauri::LogicalSize::new(
        width * text_scale,
        height * text_scale,
    ));
    let _ = window.set_min_size(min);
    let custom = store(window.app_handle())
        .ok()
        .and_then(|s| s.get(if streaming { "live" } else { "compact" }))
        .is_some();
    let _ = window.emit("overlay-layout-custom", custom);
}

// Windows can begin resizing from the native border before the webview receives
// a mouse-down. Include that path without mistaking our own SetWindowPos for a
// user gesture. The GUI flag is scoped to this window's UI thread.
fn native_adjustment_active(window: &tauri::WebviewWindow) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetGUIThreadInfo, GetWindowThreadProcessId, GUITHREADINFO, GUI_INMOVESIZE,
    };
    let Ok(hwnd) = window.hwnd() else {
        return false;
    };
    let mut info = GUITHREADINFO {
        cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
        ..Default::default()
    };
    // Valid live HWND; info points to a correctly-sized writable structure.
    unsafe {
        let thread = GetWindowThreadProcessId(hwnd, None);
        GetGUIThreadInfo(thread, &mut info).is_ok() && (info.flags.0 & GUI_INMOVESIZE.0) != 0
    }
}

pub(super) fn track(window: &tauri::WebviewWindow) {
    let window = window.clone();
    window.clone().on_window_event(move |event| {
        if !matches!(
            event,
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)
        ) {
            return;
        }
        if !TRACK_USER_LAYOUT.load(Ordering::Relaxed) && !native_adjustment_active(&window) {
            return;
        }
        let (Ok(pos), Ok(size), Ok(scale), Ok(store)) = (
            window.outer_position(),
            window.inner_size(),
            window.scale_factor(),
            store(window.app_handle()),
        ) else {
            return;
        };
        let layout = Layout {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
            scale: scale * windows_text_scale_factor(),
        };
        if let Ok(value) = serde_json::to_value(layout) {
            // The store debounces disk writes while the native move/resize loop runs.
            store.set(
                if WINDOWS_OVERLAY_IS_STREAMING.load(Ordering::Relaxed) {
                    "live"
                } else {
                    "compact"
                },
                value,
            );
            let _ = window.emit("overlay-layout-custom", true);
        }
    });
}

pub(super) fn begin() {
    TRACK_USER_LAYOUT.store(true, Ordering::Relaxed);
}

pub(super) fn stop() {
    TRACK_USER_LAYOUT.store(false, Ordering::Relaxed);
}

/// Clamp to the available desktop, including monitors left/above the primary.
fn clamp_bounds(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    area: &tauri::PhysicalRect<i32, u32>,
) -> (i32, i32, i32, i32) {
    let width = width.max(1).min(area.size.width.max(1) as i32);
    let height = height.max(1).min(area.size.height.max(1) as i32);
    (
        x.clamp(
            area.position.x,
            area.position.x + area.size.width as i32 - width,
        ),
        y.clamp(
            area.position.y,
            area.position.y + area.size.height as i32 - height,
        ),
        width,
        height,
    )
}

pub(super) fn bounds(app: &AppHandle, width: f64, height: f64) -> Option<(i32, i32, i32, i32)> {
    let live = WINDOWS_OVERLAY_IS_STREAMING.load(Ordering::Relaxed);
    let store = store(app).ok()?;
    let own = store.get(if live { "live" } else { "compact" });
    let own_layout = own.is_some();
    // Preserve the existing live-to-compact anchor until the compact form has
    // its own user adjustment. Never overwrite the live panel's dimensions.
    let saved: Layout =
        serde_json::from_value(own.or_else(|| if live { None } else { store.get("live") })?)
            .ok()?;
    if !saved.scale.is_finite()
        || saved.scale <= 0.0
        || saved.width == 0
        || saved.height == 0
        || saved.width > i32::MAX as u32
        || saved.height > i32::MAX as u32
    {
        return None;
    }
    let monitors = app.available_monitors().ok()?;
    let center = (
        saved.x.saturating_add((saved.width / 2) as i32),
        saved.y.saturating_add((saved.height / 2) as i32),
    );
    let monitor = monitors
        .into_iter()
        .find(|m| is_mouse_within_monitor(center, m.position(), m.size()))
        .or_else(|| get_monitor_with_cursor(app))?;
    let scale = monitor.scale_factor() * windows_text_scale_factor();
    let (x, y, w, h) = restored_bounds(
        saved,
        own_layout,
        live,
        scale,
        width,
        height,
        settings::get_settings(app).overlay_position == OverlayPosition::Top,
    );
    Some(clamp_bounds(x, y, w, h, monitor.work_area()))
}

fn restored_bounds(
    saved: Layout,
    own: bool,
    live: bool,
    scale: f64,
    width: f64,
    height: f64,
    top: bool,
) -> (i32, i32, i32, i32) {
    let (min_w, min_h) = if live { (280.0, 120.0) } else { (224.0, 50.0) };
    let w = if own {
        (saved.width as f64 / saved.scale).max(min_w)
    } else {
        width
    };
    let h = if own {
        (saved.height as f64 / saved.scale).max(min_h)
    } else {
        height
    };
    let w = (w * scale).round() as i32;
    let h = (h * scale).round() as i32;
    let x = if own {
        saved.x
    } else {
        saved.x.saturating_add((saved.width as i32 - w) / 2)
    };
    let y = if own || top {
        saved.y
    } else {
        saved.y.saturating_add(saved.height as i32 - h)
    };
    (x, y, w, h)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn compact_restores_its_own_size_instead_of_using_live_dimensions() {
        let saved = Layout {
            x: 100,
            y: 200,
            width: 360,
            height: 90,
            scale: 1.0,
        };
        assert_eq!(
            restored_bounds(saved, true, false, 1.0, 256.0, 50.0, false),
            (100, 200, 360, 90)
        );
        assert_eq!(
            restored_bounds(saved, true, false, 1.5, 256.0, 50.0, false),
            (100, 200, 540, 135)
        );
    }

    #[test]
    fn first_compact_appearance_keeps_live_center_and_anchor_without_live_size() {
        let saved = Layout {
            x: 100,
            y: 200,
            width: 600,
            height: 300,
            scale: 1.0,
        };
        assert_eq!(
            restored_bounds(saved, false, false, 1.0, 256.0, 50.0, false),
            (272, 450, 256, 50)
        );
        assert_eq!(
            restored_bounds(saved, false, false, 1.0, 256.0, 50.0, true),
            (272, 200, 256, 50)
        );
        assert_eq!(
            restored_bounds(saved, true, true, 1.0, 400.0, 120.0, false),
            (100, 200, 600, 300)
        );
    }

    #[test]
    fn layout_recovers_on_a_smaller_negative_origin_desktop() {
        let area = tauri::PhysicalRect {
            position: PhysicalPosition::new(-1920, -200),
            size: PhysicalSize::new(1920, 1040),
        };
        assert_eq!(
            clamp_bounds(3000, 1600, 400, 240, &area),
            (-400, 600, 400, 240)
        );
        assert_eq!(
            clamp_bounds(-4000, -900, 3000, 2000, &area),
            (-1920, -200, 1920, 1040)
        );
    }
}
