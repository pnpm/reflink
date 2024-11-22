use napi::{bindgen_prelude::FromNapiValue, Env, JsError, JsObject};
use pipe_trait::Pipe;
use std::io::ErrorKind;

/// Infer error code and its number.
///
/// The error number should match `require('os').constants.errno[code]`
fn error_code(kind: ErrorKind) -> Option<(&'static str, i16)> {
    // For now, we only return some error codes that pnpm uses.
    // Future contributors may add more if they need it.
    Some(match kind {
        ErrorKind::AlreadyExists => ("EEXIST", 17),
        ErrorKind::NotFound => ("ENOENT", 2),
        ErrorKind::PermissionDenied => ("EPERM", 1),
        _ => return None,
    })
}

/// Create an error object with additional properties.
///
/// The additional properties are the same as Node.js errors except `syscall`.
pub fn reflink_error(
    env: Env,
    io_error: std::io::Error,
    src: &str,
    dst: &str,
) -> Result<JsObject, napi::Error> {
    let mut error_object = format!("{io_error}, reflink '{src}' -> '{dst}'")
        .pipe(napi::Error::from_reason)
        .pipe(JsError::from)
        .pipe(move |js_error| js_error.into_unknown(env))
        .pipe(JsObject::from_unknown)?;

    error_object.set_named_property("path", src).ok();
    error_object.set_named_property("dest", dst).ok();
    if let Some((code, errno)) = error_code(io_error.kind()) {
        error_object.set_named_property("code", code).ok();
        error_object.set_named_property("errno", errno).ok();
    }

    Ok(error_object)
}

/// Convert an error object into an N-API error.
pub fn object_to_error(error_object: JsObject) -> napi::Error {
    error_object.into_unknown().into()
}
