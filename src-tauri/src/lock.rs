//! App lock on macOS: Touch ID, or the Mac's password when Touch ID is not available or fails
//! (LocalAuthentication, policy "device owner authentication"), so nobody gets locked out.

use std::sync::mpsc;
use std::sync::Mutex;

use block2::RcBlock;
use objc2::runtime::Bool;
use objc2_foundation::{NSError, NSString};
use objc2_local_authentication::{LAContext, LAPolicy};

const POLICY: LAPolicy = LAPolicy::DeviceOwnerAuthentication;

/// Whether this Mac can authenticate the owner (Touch ID or a login password).
#[tauri::command]
pub fn can_lock() -> bool {
    let context = unsafe { LAContext::new() };
    unsafe { context.canEvaluatePolicy_error(POLICY) }.is_ok()
}

/// Shows the system's Touch ID / password prompt; true when the owner was recognised.
/// `reason` completes the system sentence "Vaarpapieren is trying to …".
#[tauri::command]
pub async fn authenticate(reason: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = unsafe { LAContext::new() };
        let (tx, rx) = mpsc::channel::<bool>();
        let tx = Mutex::new(Some(tx));
        // The reply arrives on a queue of the system; the context stays alive until then.
        let reply = RcBlock::new(move |ok: Bool, _error: *mut NSError| {
            if let Some(tx) = tx.lock().ok().and_then(|mut t| t.take()) {
                let _ = tx.send(ok.as_bool());
            }
        });
        unsafe { context.evaluatePolicy_localizedReason_reply(POLICY, &NSString::from_str(&reason), &reply) };
        Ok(rx.recv().unwrap_or(false))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    /// Manual check: `cargo test --lib lock -- --ignored --nocapture` (no prompt is shown).
    #[test]
    #[ignore]
    fn reports_whether_this_mac_can_authenticate() {
        println!("can_lock = {}", super::can_lock());
    }
}
