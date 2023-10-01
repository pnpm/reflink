#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use napi::{bindgen_prelude::AsyncTask, Env, Error, JsNumber, Result, Task};
use std::path::PathBuf;
use reflink;

pub struct AsyncReflink {
    src: PathBuf,
    dst: PathBuf,
}

#[napi]
impl Task for AsyncReflink {
    type Output = ();
    type JsValue = JsNumber;

    fn compute(&mut self) -> Result<Self::Output> {
        match reflink::reflink(&self.src, &self.dst) {
            Ok(_) => Ok(()),
            Err(err) => Err(Error::from_reason(format!("Reflink error: {:?}", err))),
        }
    }

    fn resolve(&mut self, env: Env, _: ()) -> Result<Self::JsValue> {
        env.create_int32(0)
    }
}

#[napi]
impl Task for reflink_sync {
    type Output = ();
    type JsValue = JsNumber;

    fn compute(&mut self) -> Result<Self::Output> {
        match reflink::reflink(&self.src, &self.dst) {
            Ok(_) => Ok(()),
            Err(err) => Err(Error::from_reason(format!("Reflink error: {:?}", err))),
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
    match reflink::reflink(&src_path, &dst_path) {
        Ok(_) => Ok(env.create_int32(0)?),
        Err(err) => Err(Error::from_reason(format!("Reflink error: {:?}", err))),
    }
}

