import test from 'ava';
import { join } from 'path';
import { reflinkFileSync, reflinkFile } from '../index.js';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';

test.serial('clone file sync', async (t) => {
  const src = join(process.cwd(), 'file.txt');
  const dest = join(process.cwd(), 'file2.txt');

  await rm(dest, { force: true });

  reflinkFileSync(src, dest);

  t.is(existsSync(dest), true);
});

test.serial('clone file async', async (t) => {
  const src = join(process.cwd(), 'file.txt');
  const dest = join(process.cwd(), 'file2.txt');

  await rm(dest, { force: true });

  await reflinkFile(src, dest);

  t.is(existsSync(dest), true);
});

test.serial('should fail if the destination file exists', async (t) => {
  const src = join(process.cwd(), 'file.txt');
  const dest = join(process.cwd(), 'file2.txt');

  await rm(dest, { force: true });

  reflinkFileSync(src, dest);

  t.throws(() => reflinkFileSync(src, dest));
});

test.serial('should fail if the source file does not exist', async (t) => {
  const src = join(process.cwd(), 'file3.txt');
  const dest = join(process.cwd(), 'file2.txt');

  await rm(dest, { force: true });

  t.throws(() => reflinkFileSync(src, dest));
});

test.serial('should fail if the source file is a directory', async (t) => {
  const src = join(process.cwd(), 'src');
  const dest = join(process.cwd(), 'file2.txt');

  await rm(dest, { force: true });

  t.throws(() => reflinkFileSync(src, dest));
});

test.serial('should fail if the parent directory does not exist', async (t) => {
  const src = join(process.cwd(), 'file.txt');
  const dest = join(process.cwd(), 'dir1', 'file2.txt');

  await rm(dest, { force: true });

  t.throws(() => reflinkFileSync(src, dest));
});
