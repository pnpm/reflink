#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use napi::{bindgen_prelude::AsyncTask, Env, Error, JsNumber, Result, Task};
use std::path::PathBuf;
use reflink_copy;

pub struct AsyncReflink {
    src: PathBuf,
    dst: PathBuf,
}

#[napi]
impl Task for AsyncReflink {
    type Output = ();
    type JsValue = JsNumber;

    fn compute(&mut self) -> Result<Self::Output> {
        match reflink_copy::reflink(&self.src, &self.dst) {
            Ok(_) => {
                Ok(())
            },
            Err(err) => return Err(Error::from_reason(format!(
                "{}, reflink '{}' -> '{}'",
                err.to_string(),
                self.src.display(),
                self.dst.display()
            ))),
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
    let src_path = PathBuf::from(src);
    let dst_path = PathBuf::from(dst);
    match reflink_copy::reflink(&src_path, &dst_path) {
        Ok(_) => Ok(env.create_int32(0)?),
        Err(err) => Err(Error::from_reason(format!(
            "{}, reflink '{}' -> '{}'",
            err.to_string(),
            src_path.display(),
            dst_path.display()
        ))),
    }
}

#[test]
pub fn test_pyc_file() {
    let src = std::path::Path::new("fixtures/sample.pyc");
    let dst = std::path::Path::new("fixtures/sample.pyc.reflink");

    // Remove the destination file if it already exists
    if dst.exists() {
        std::fs::remove_file(&dst).unwrap();
    }

    // Run the reflink operation
    let result = reflink_copy::reflink(&src, &dst);
    assert!(result.is_ok());

    println!("Reflinked '{}' -> '{}'", src.display(), dst.display());

    // Further validation: compare the contents of both files to make sure they are identical
    let src_contents = std::fs::read(&src).expect("Failed to read source file");
    let dst_contents = std::fs::read(&dst).expect("Failed to read destination file");

    assert_eq!(src_contents, dst_contents);

    // Remove the destination file
    std::fs::remove_file(&dst).unwrap();

    println!("File contents match, reflink operation successful")
}