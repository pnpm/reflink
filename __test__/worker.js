const { parentPort } = require('worker_threads');
const { reflinkFileSync, reflinkFile } = require('../index.js');

parentPort?.on('message', async (data) => {
  if (data.type === 'sync') {
    reflinkFileSync(data.src, data.dest);
  } else {
    await reflinkFile(data.src, data.dest);
  }

  // console.log(`Cloned to ${data.dest} at ${new Date().toISOString()}`);

  parentPort?.postMessage({ type: 'done' });
  // Kill the worker
  parentPort?.close();
});
