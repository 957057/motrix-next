//! Effective Windows Shell protocol associations.
use crate::error::AppError;
use std::os::windows::ffi::OsStringExt;
use windows_sys::Win32::UI::Shell::{
    AssocQueryStringW, SHChangeNotify, ASSOCF_IS_PROTOCOL, ASSOCSTR_EXECUTABLE, SHCNE_ASSOCCHANGED,
    SHCNF_IDLIST,
};

pub struct Handler {
    pub path: Option<std::path::PathBuf>,
    pub unavailable: bool,
}

fn missing_handler(result: i32) -> Result<Handler, AppError> {
    match result as u32 {
        0x80070483 => Ok(Handler {
            path: None,
            unavailable: false,
        }),
        0x800401f5 | 0x80070002 | 0x80070003 => Ok(Handler {
            path: None,
            unavailable: true,
        }),
        _ => Err(AppError::Protocol(format!(
            "Shell association query failed: 0x{result:08x}"
        ))),
    }
}

pub fn handler(protocol: &str) -> Result<Handler, AppError> {
    let scheme: Vec<u16> = protocol.encode_utf16().chain(Some(0)).collect();
    let mut output = vec![0u16; 32768];
    let mut length = output.len() as u32;
    // SAFETY: Both strings are terminated and the output buffer has length capacity.
    let result = unsafe {
        AssocQueryStringW(
            if protocol.starts_with('.') {
                0
            } else {
                ASSOCF_IS_PROTOCOL
            },
            ASSOCSTR_EXECUTABLE,
            scheme.as_ptr(),
            std::ptr::null(),
            output.as_mut_ptr(),
            &mut length,
        )
    };
    if result == 0 {
        let length = output
            .iter()
            .position(|ch| *ch == 0)
            .unwrap_or(output.len());
        return Ok(Handler {
            path: Some(std::ffi::OsString::from_wide(&output[..length]).into()),
            unavailable: false,
        });
    }
    missing_handler(result)
}

pub fn is_default(protocol: &str) -> Result<bool, AppError> {
    let expected = std::env::current_exe()?;
    Ok(handler(protocol)?.path.is_some_and(|path| {
        dunce::simplified(&path)
            .to_string_lossy()
            .eq_ignore_ascii_case(&dunce::simplified(&expected).to_string_lossy())
    }))
}

/// Advertise public download schemes in Windows Default Apps. This registers
/// a candidate; only the Shell query establishes which application is default.
pub fn register_candidate(app: &tauri::AppHandle, protocol: &str) -> Result<(), AppError> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let root = RegKey::predef(HKEY_CURRENT_USER);
    let identity = &app.config().identifier;
    let program = format!("{identity}.{}", protocol.trim_start_matches('.'));
    let executable = std::env::current_exe()?;
    let executable = dunce::simplified(&executable).to_string_lossy();
    let name = app.config().product_name.as_deref().unwrap_or("Rayburst");
    let (key, _) = root.create_subkey(format!("Software\\Classes\\{program}"))?;
    key.set_value("", &format!("{name} {protocol}"))?;
    if !protocol.starts_with('.') {
        key.set_value("URL Protocol", &"")?;
    }
    key.create_subkey("DefaultIcon")?
        .0
        .set_value("", &format!("\"{executable}\",0"))?;
    key.create_subkey("shell\\open\\command")?
        .0
        .set_value("", &format!("\"{executable}\" \"%1\""))?;
    let capabilities = format!("Software\\{identity}\\Capabilities");
    let (key, _) = root.create_subkey(&capabilities)?;
    key.set_value("ApplicationName", &name)?;
    key.set_value(
        "ApplicationDescription",
        &"Download files and media with Rayburst",
    )?;
    key.set_value("ApplicationIcon", &format!("\"{executable}\",0"))?;
    key.create_subkey(if protocol.starts_with('.') {
        "FileAssociations"
    } else {
        "URLAssociations"
    })?
    .0
    .set_value(protocol, &program)?;
    root.create_subkey("Software\\RegisteredApplications")?
        .0
        .set_value(identity, &capabilities)?;
    notify_changed();
    Ok(())
}

/// Notify the Shell after a completed registration, rather than refreshing icons alone.
pub fn notify_changed() {
    // SAFETY: SHCNE_ASSOCCHANGED takes no item pointers.
    unsafe {
        SHChangeNotify(
            SHCNE_ASSOCCHANGED as i32,
            SHCNF_IDLIST,
            std::ptr::null(),
            std::ptr::null(),
        );
    }
}

/// This supplies a legacy default without modifying Windows' protected UserChoice.
pub fn register_file_default(app: &tauri::AppHandle) -> Result<(), AppError> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let (key, _) =
        RegKey::predef(HKEY_CURRENT_USER).create_subkey("Software\\Classes\\.torrent")?;
    key.set_value("", &format!("{}.torrent", app.config().identifier))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::missing_handler;
    #[test]
    fn missing_applications_are_repairable_but_access_errors_are_not_hidden() {
        for result in [0x800401f5u32, 0x80070002, 0x80070003] {
            assert!(
                missing_handler(result as i32)
                    .expect("missing application")
                    .unavailable
            );
        }
        assert!(
            !missing_handler(0x80070483u32 as i32)
                .expect("unassigned")
                .unavailable
        );
        assert!(missing_handler(0x80070005u32 as i32).is_err());
    }
}
