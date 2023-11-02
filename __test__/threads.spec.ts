import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Worker } from 'worker_threads';
import { join, relative, resolve, sep } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { randomUUID, createHash } from 'crypto';

const TEST_DIR = resolve(__dirname, '__reflink-tests-' + randomUUID());
const workerFile =
  `.${sep}` + relative(process.cwd(), join(__dirname, 'worker.js'));

describe('reflink worker', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('clone the same file to different location simultaneously (sync)', async () => {
    const src = {
      path: join(process.cwd(), 'fixtures', 'ascii-file.js'),
      content: readFileSync(join(process.cwd(), 'fixtures', 'ascii-file.js')),
    };

    const destFiles = Array.from({ length: 100 }, () => ({
      path: join(TEST_DIR, `dest-${randomUUID()}.js`),
    }));

    await writeFile(src.path, src.content);

    const workers = destFiles.map((dest) => {
      const worker = new Worker(workerFile);

      worker.on('error', (err) => {
        throw err;
      });

      return worker;
    });

    workers.forEach((worker, i) => {
      worker.postMessage({
        type: 'sync',
        src: src.path,
        dest: destFiles[i].path,
      });
    });

    await Promise.all(
      workers.map(
        (worker) => new Promise((resolve) => worker.on('message', resolve))
      )
    );

    const srcHash = createHash('sha256').update(src.content).digest('hex');

    for (const dest of destFiles) {
      const destContent = readFileSync(dest.path, 'utf8');
      const destHash = createHash('sha256').update(destContent).digest('hex');

      expect(destHash).toBe(srcHash);
    }
  });

  it('clone the same file to different location simultaneously (async)', async () => {
    const src = {
      path: join(process.cwd(), 'fixtures', 'ascii-file.js'),
      content: readFileSync(join(process.cwd(), 'fixtures', 'ascii-file.js')),
    };

    const destFiles = Array.from({ length: 100 }, () => ({
      path: join(TEST_DIR, `dest-${randomUUID()}.js`),
    }));

    await writeFile(src.path, src.content);

    const workers = destFiles.map((dest) => {
      const worker = new Worker(workerFile);

      worker.on('error', (err) => {
        throw err;
      });

      return worker;
    });

    workers.forEach((worker, i) => {
      worker.postMessage({
        type: 'async',
        src: src.path,
        dest: destFiles[i].path,
      });
    });

    await Promise.all(
      workers.map(
        (worker) => new Promise((resolve) => worker.on('message', resolve))
      )
    );

    const srcHash = createHash('sha256').update(src.content).digest('hex');

    for (const dest of destFiles) {
      const destContent = readFileSync(dest.path, 'utf8');
      const destHash = createHash('sha256').update(destContent).digest('hex');

      expect(destHash).toBe(srcHash);
    }
  });
});
