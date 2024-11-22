#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;
use copy_on_write::reflink_file_sync;
use napi::{bindgen_prelude::AsyncTask, Env, Error, JsNumber, Result, Task};

pub struct AsyncReflink {
    src: String,
    dst: String,
}

#[napi]
impl Task for AsyncReflink {
    type Output = ();
    type JsValue = JsNumber;

    fn compute(&mut self) -> Result<Self::Output> {
        reflink_file_sync(&self.src, &self.dst).map_err(|err| {
            Error::from_reason(format!(
                "{err}, reflink '{src}' -> '{dst}'",
                src = self.src,
                dst = self.dst,
            ))
        })
    }

    fn resolve(&mut self, env: Env, _: ()) -> Result<Self::JsValue> {
        env.create_int32(0)
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
        Ok(_) => Ok(env.create_int32(0)?),
        Err(err) => Err(Error::from_reason(format!(
            "{err}, reflink '{src}' -> '{dst}'"
        ))),
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
