//! Effective Windows Shell protocol associations.
use crate::error::AppError;
use std::os::windows::ffi::OsStringExt;
use windows_sys::Win32::UI::Shell::{AssocQueryStringW, ASSOCF_IS_PROTOCOL, ASSOCSTR_EXECUTABLE};

pub fn handler(protocol: &str) -> Result<Option<std::path::PathBuf>, AppError> {
    let scheme: Vec<u16> = protocol.encode_utf16().chain(Some(0)).collect();
    let mut output = vec![0u16; 32768];
    let mut length = output.len() as u32;
    // SAFETY: Both strings are terminated and the output buffer has length capacity.
    let result = unsafe {
        AssocQueryStringW(
            ASSOCF_IS_PROTOCOL,
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
        return Ok(Some(
            std::ffi::OsString::from_wide(&output[..length]).into(),
        ));
    }
    // No association and an association pointing to a missing executable both need repair.
    if matches!(result as u32, 0x80070483 | 0x80070002 | 0x80070003) {
        return Ok(None);
    }
    Err(AppError::Protocol(format!(
        "Shell association query failed: 0x{:08x}",
        result as u32
    )))
}

pub fn is_default(protocol: &str) -> Result<bool, AppError> {
    let expected = std::env::current_exe()?;
    Ok(handler(protocol)?.is_some_and(|path| {
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
    let program = format!("{identity}.{protocol}");
    let executable = std::env::current_exe()?;
    let executable = dunce::simplified(&executable).to_string_lossy();
    let name = app.config().product_name.as_deref().unwrap_or("Rayburst");
    let (key, _) = root.create_subkey(format!("Software\\Classes\\{program}"))?;
    key.set_value("", &format!("{name} {protocol}"))?;
    key.set_value("URL Protocol", &"")?;
    key.create_subkey("DefaultIcon")?
        .0
        .set_value("", &format!("\"{executable}\",0"))?;
    key.create_subkey("shell\\open\\command")?
        .0
        .set_value("", &format!("\"{executable}\" \"%1\""))?;
    let capabilities = format!("Software\\{identity}\\Capabilities");
    let (key, _) = root.create_subkey(&capabilities)?;
    key.set_value("ApplicationName", &name)?;
    key.set_value("ApplicationIcon", &format!("\"{executable}\",0"))?;
    key.create_subkey("URLAssociations")?
        .0
        .set_value(protocol, &program)?;
    root.create_subkey("Software\\RegisteredApplications")?
        .0
        .set_value(identity, &capabilities)?;
    Ok(())
}
