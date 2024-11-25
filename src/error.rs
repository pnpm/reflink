use napi_derive::napi;
use std::io::ErrorKind;

/// Infer error code and its number.
///
/// The error number should match `require('os').constants.errno[code]`
fn error_code(kind: ErrorKind) -> Option<(&'static str, i16)> {
    // For now, we only return some error codes that pnpm uses.
    // Future contributors may add more if they need it.
    Some(match kind {
        ErrorKind::AlreadyExists => ("EEXIST", 17),
        ErrorKind::InvalidInput | ErrorKind::NotFound => ("ENOENT", 2),
        ErrorKind::PermissionDenied => ("EPERM", 1),
        _ => None,
    })
}

/// Contains all properties to construct an actual error.
#[derive(Debug, Clone)]
#[napi(constructor)]
pub struct ReflinkError {
    pub message: String,
    pub path: String,
    pub dest: String,
    pub code: Option<&'static str>,
    pub errno: Option<i16>,
}

impl ReflinkError {
    pub fn new(io_error: std::io::Error, path: String, dest: String) -> Self {
        let message = format!("{io_error}, reflink '{path}' -> '{dest}'");
        let (code, errno) = match error_code(io_error.kind()) {
            Some((code, errno)) => (Some(code), Some(errno)),
            None => (None, None),
        };
        ReflinkError {
            message,
            path,
            dest,
            code,
            errno,
        }
    }
}
