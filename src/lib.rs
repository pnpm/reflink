#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use napi::{bindgen_prelude::AsyncTask, Env, Error, JsNumber, Result, Task};
use std::path::PathBuf;
use reflink_copy;
use std::fs;

// Return a napi::Result, so you can use napi::Error
fn has_null_bytes(path: &PathBuf) -> Result<bool> {
    match fs::read(path) {
        Ok(content) => Ok(content.iter().any(|&byte| byte == 0)),
        Err(io_err) => {
            println!("Error reading file: {}", io_err.to_string());
            Err(Error::from_reason(io_err.to_string()))
        }
    }
}


#[cfg(not(target_os = "windows"))]
extern crate xattr;

pub struct AsyncReflink {
    src: PathBuf,
    dst: PathBuf,
}

#[cfg(not(target_os = "windows"))]
fn set_destination_metadata(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    let metadata_key = "user.reflink_destinations";
    
    let mut destinations = match xattr::get(src, metadata_key) {
        Ok(Some(data)) => String::from_utf8_lossy(&data).to_string(),
        _ => String::from(""),
    };

    if !destinations.is_empty() {
        destinations.push_str(",");
    }
    destinations.push_str(dst.to_str().unwrap());

    xattr::set(src, metadata_key, destinations.as_bytes())
}

#[napi]
impl Task for AsyncReflink {
    type Output = ();
    type JsValue = JsNumber;

    fn compute(&mut self) -> Result<Self::Output> {
        let mut retry_count = 0;
        loop {
            match reflink_copy::reflink(&self.src, &self.dst) {
                Ok(_) => {
                    #[cfg(not(target_os = "windows"))]
                    {
                        if let Err(err) = set_destination_metadata(&self.src, &self.dst) {
                            return Err(Error::from_reason(err.to_string()));
                        }
                    }
                    // Check for null bytes in the destination file
                    let contains_null = has_null_bytes(&self.dst).map_err(|e| Error::from_reason(e.to_string()))?;
                    
                    if !contains_null {
                        return Ok(());
                    } else {
                        // Delete the destination and retry if it contains null bytes
                        fs::remove_file(&self.dst).map_err(|e| Error::from_reason(e.to_string()))?;
                        retry_count += 1;

                        if retry_count >= 3 {  // Limit the number of retries
                            return Err(Error::from_reason("Maximum retry attempts reached".to_string()));
                        }
                    }
                },
                Err(err) => return Err(Error::from_reason(format!(
                    "{}, reflink '{}' -> '{}'",
                    err.to_string(),
                    self.src.display(),
                    self.dst.display()
                ))),
            }
        }
    }

    fn resolve(&mut self, env: Env, _: ()) -> Result<Self::JsValue> {
        env.create_int32(0)
    }
}

// Async version
#[napi(js_name = "reflinkFile")]
pub fn reflink_task(src: String, dst: String) -> AsyncTask<AsyncReflink> {
    let src_path = PathBuf::from(src);
    let dst_path = PathBuf::from(dst);
    AsyncTask::new(AsyncReflink { src: src_path, dst: dst_path })
}

// Sync version
#[napi(js_name = "reflinkFileSync")]
pub fn reflink_sync(env: Env, src: String, dst: String) -> Result<JsNumber> {
    let src_path = PathBuf::from(src.clone());
    let dst_path = PathBuf::from(dst.clone());
    let mut retry_count = 0;

    loop {
        // Attempt to perform reflink
        let reflink_result = reflink_copy::reflink(&src_path, &dst_path);

        match reflink_result {
            Ok(_) => {
                // Check if the source and destination files differ
                if let Ok(differs) = has_null_bytes(&dst_path) {
                    if differs {
                        if retry_count >= 3 {  // Max retry count
                            return Err(Error::from_reason(format!(
                                "Max retries reached, could not create identical reflink for '{}' -> '{}'",
                                src_path.display(),
                                dst_path.display()
                            )));
                        }
                        // Remove the destination and retry
                        if let Err(err) = fs::remove_file(&dst_path) {
                            return Err(Error::from_reason(format!(
                                "Failed to remove destination file '{}': {}",
                                dst_path.display(),
                                err.to_string()
                            )));
                        }
                        retry_count += 1;
                        continue; // Retry the operation
                    }
                }

                // Metadata and return handling here (existing code)
                #[cfg(not(target_os = "windows"))]
                {
                    if let Err(err) = set_destination_metadata(&src_path, &dst_path) {
                        return Err(Error::from_reason(err.to_string()));
                    }
                }
                return Ok(env.create_int32(0)?);
            },
            Err(err) => {
                return Err(Error::from_reason(format!(
                    "{}, reflink '{}' -> '{}'",
                    err.to_string(),
                    src_path.display(),
                    dst_path.display()
                )));
            },
        }
    }
}
