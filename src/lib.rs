#![deny(clippy::all)]

mod error;

use copy_on_write::reflink_file_sync;
use error::{object_to_error, reflink_error};
use napi::{bindgen_prelude::AsyncTask, Env, JsNumber, Result, Task};
use napi_derive::napi;
use pipe_trait::Pipe;

pub struct AsyncReflink {
    src: String,
    dst: String,
}

#[napi]
impl Task for AsyncReflink {
    type Output = std::result::Result<(), std::io::Error>;
    type JsValue = JsNumber;

    fn compute(&mut self) -> Result<Self::Output> {
        Ok(reflink_file_sync(&self.src, &self.dst))
    }

    fn resolve(&mut self, env: Env, output: Self::Output) -> Result<Self::JsValue> {
        match output {
            Ok(()) => env.create_int32(0),
            Err(io_error) => reflink_error(env, io_error, &self.src, &self.dst)?
                .pipe(object_to_error)
                .pipe(Err),
        }
    }
}

// Async version
#[napi(js_name = "reflinkFile")]
pub fn reflink_task(src: String, dst: String) -> AsyncTask<AsyncReflink> {
    AsyncTask::new(AsyncReflink { src, dst })
}

// Sync version
#[napi(js_name = "reflinkFileSync")]
pub fn reflink_sync(env: Env, src: String, dst: String) -> Result<JsNumber> {
    match reflink_file_sync(&src, &dst) {
        Ok(()) => env.create_int32(0),
        Err(io_error) => reflink_error(env, io_error, &src, &dst)?
            .pipe(object_to_error)
            .pipe(Err),
    }
}

#[test]
pub fn test_pyc_file() {
    let src = "fixtures/sample.pyc";
    let dst = "fixtures/sample.pyc.reflink";

    let dst_path = std::path::Path::new(dst);

    // Remove the destination file if it already exists
    if dst_path.try_exists().unwrap() {
        std::fs::remove_file(dst).unwrap();
    }

    // Run the reflink operation
    let result = reflink_file_sync(src, dst);
    assert!(result.is_ok());

    println!("Reflinked {src:?} -> {dst:?}");

    // Further validation: compare the contents of both files to make sure they are identical
    let src_contents = std::fs::read(src).expect("Failed to read source file");
    let dst_contents = std::fs::read(dst).expect("Failed to read destination file");

    assert_eq!(src_contents, dst_contents);

    // Remove the destination file
    std::fs::remove_file(dst).unwrap();

    println!("File contents match, reflink operation successful")
}
