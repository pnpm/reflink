import { afterAll, describe, expect, it } from 'vitest';
import { constants } from 'os';
import { join, resolve } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { randomUUID, createHash } from 'crypto';
import { rimraf } from 'rimraf';
import { reflinkFileSync, reflinkFile } from '../index.js';

const sandboxDir = () => join(process.cwd(), `__reflink-tests-${randomUUID()}`);

const sandboxFiles = [
  {
    path: 'file1.txt',
    content: 'Hello World!',
    sha: createHash('sha256').update('Hello World!').digest('hex'),
  },
  {
    path: 'file2.txt',
    content: 'Hello World!',
    sha: createHash('sha256').update('Hello World!').digest('hex'),
  },
  {
    path: 'file3.txt',
    content: 'Hello World!',
    sha: createHash('sha256').update('Hello World!').digest('hex'),
  },
];

const sandboxDirectories: string[] = [];

async function prepare(dir: string) {
  await mkdir(dir, { recursive: true });

  sandboxDirectories.push(dir);

  return Promise.all(
    sandboxFiles.map(async (file) => {
      await writeFile(join(dir, file.path), file.content);
      return {
        ...file,
        path: join(dir, file.path),
      };
    })
  );
}

describe('reflink', () => {
  afterAll(async () => {
    await Promise.all(
      sandboxDirectories.map(async (dir) => {
        await rimraf(dir).catch(() => {});
      })
    );
  });

  it('should correctly clone a file (sync)', async () => {
    const dir = sandboxDir();
    const files = await prepare(dir);
    const file = files[0];

    reflinkFileSync(file.path, join(dir, 'file1-copy.txt'));

    const content = readFileSync(join(dir, 'file1-copy.txt'), 'utf-8');

    expect(content).toBe(file.content);
  });

  it('should correctly clone a file (async)', async () => {
    const dir = sandboxDir();
    const files = await prepare(dir);
    const file = files[0];

    await reflinkFile(file.path, join(dir, 'file1-copy.txt'));

    const content = readFileSync(join(dir, 'file1-copy.txt'), 'utf-8');

    expect(content).toBe(file.content);
  });

  it('should keep the same content in source file after editing the cloned file', async () => {
    const dir = sandboxDir();
    const files = await prepare(dir);
    const file = files[0];

    await reflinkFile(file.path, join(dir, 'file1-copy.txt'));

    await writeFile(
      join(dir, 'file1-copy.txt'),
      file.content + '\nAdded content!'
    );

    const originalContent = readFileSync(file.path, 'utf-8');

    expect(originalContent).toBe(file.content);
  });

  it('should fail if the source file does not exist (sync)', async () => {
    const dir = sandboxDir();
    await prepare(dir);

    try {
      reflinkFileSync(
        join(dir, 'file-does-not-exist.txt'),
        join(dir, 'file1-copy.txt')
      );
    } catch (error) {
      expect(error).toMatchObject({
        message: expect.any(String),
        code: 'ENOENT',
        errno: constants.errno.ENOENT,
      });
      return;
    }
    throw new Error('Expecting an error, but none was thrown');
  });

  it('should fail if the source file does not exist (async)', async () => {
    const dir = sandboxDir();
    await prepare(dir);

    await expect(
      reflinkFile(
        join(dir, 'file-does-not-exist.txt'),
        join(dir, 'file1-copy.txt')
      )
    ).rejects.toMatchObject({
      message: expect.any(String),
      code: 'ENOENT',
      errno: constants.errno.ENOENT,
    });
  });

  it('should fail if the destination file already exists (sync)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);

    try {
      reflinkFileSync(sandboxFiles[0].path, sandboxFiles[1].path);
    } catch (error) {
      expect(error).toMatchObject({
        message: expect.any(String),
        code: 'EEXIST',
        errno: constants.errno.EEXIST,
      });
      return;
    }
    throw new Error('Expecting an error, but none was thrown');
  });

  it('should fail if the destination file already exists (async)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    await expect(
      reflinkFile(sandboxFiles[0].path, sandboxFiles[1].path)
    ).rejects.toMatchObject({
      message: expect.any(String),
      code: 'EEXIST',
      errno: constants.errno.EEXIST,
    });
  });

  it('should fail if the source file is a directory (sync)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    expect(() => {
      reflinkFileSync(dir, sandboxFiles[1].path);
    }).toThrow();
  });

  it('should fail if the source file is a directory (async)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    await expect(reflinkFile(dir, sandboxFiles[1].path)).rejects.toThrow();
  });

  it('should fail if the source and destination files are the same (sync)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    expect(() => {
      reflinkFileSync(sandboxFiles[0].path, sandboxFiles[0].path);
    }).toThrow();
  });

  it('should fail if the source and destination files are the same (async)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    await expect(
      reflinkFile(sandboxFiles[0].path, sandboxFiles[0].path)
    ).rejects.toThrow();
  });

  it('should fail if the destination parent directory does not exist (sync)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    expect(() => {
      reflinkFileSync(
        sandboxFiles[0].path,
        join(dir, 'does-not-exist', 'file1-copy.txt')
      );
    }).toThrow();
  });

  it('should not fail with relative paths', async () => {
    const file = {
      path: 'file.txt',
      content: 'Hello World!',
    };

    const dest = 'file-copy.txt';

    await rm(dest, { force: true });
    await writeFile(file.path, file.content);

    await reflinkFile(file.path, dest);

    const content = readFileSync(dest, 'utf-8');

    expect(content).toBe(file.content);

    // clean both files
    await rm('file.txt');
    await rm('file-copy.txt');
  });

  it('should not fail with nested relative paths', async () => {
    const file = {
      path: 'nested/file.txt',
      content: 'Hello World!',
    };

    const dest = 'nested/file-copy.txt';

    await rm(dest, { force: true });
    await mkdir('nested', { recursive: true });
    await writeFile(file.path, file.content);

    await reflinkFile(file.path, dest);

    const content = readFileSync(dest, 'utf-8');

    expect(content).toBe(file.content);

    // clean both files
    await rm('nested', { recursive: true });
  });

  it('should correctly clone 1000 files (sync)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);

    const files = Array.from({ length: 1000 }, (_, i) => ({
      path: join(dir, `file${i}.txt`),
      content: 'Hello World!',
    }));

    await Promise.all(
      files.map(async (file) => writeFile(file.path, file.content))
    );

    await Promise.all(
      files.map(async (file, i) =>
        reflinkFileSync(file.path, join(dir, `file${i}-copy.txt`))
      )
    );

    files.forEach((file, i) => {
      const content = readFileSync(join(dir, `file${i}-copy.txt`), 'utf-8');
      expect(content).toBe(file.content);
    });
  });

  it('should correctly clone 1000 files (async)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    const files = Array.from({ length: 1000 }, (_, i) => ({
      path: join(dir, `file${i}.txt`),
      content: 'Hello World!',
      hash: createHash('sha256').update('Hello World!').digest('hex'),
    }));

    await Promise.all(
      files.map(async (file) => writeFile(file.path, file.content))
    );

    await Promise.all(
      files.map(async (file, i) =>
        reflinkFile(file.path, join(dir, `file${i}-copy.txt`))
      )
    );

    files.forEach((file, i) => {
      const content = readFileSync(join(dir, `file${i}-copy.txt`), 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      expect(content).toBe(file.content);
      expect(hash).toBe(file.hash);
    });
  });

  it('should keep the same hash when cloning a file more than 3,000 times', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    const srcFile = {
      path: resolve('./package.json'),
      content: readFileSync(join('./package.json'), 'utf-8'),
    };

    const destFiles = Array.from({ length: 3_000 }, (_, i) => ({
      path: join(dir, `file1-copy-${i}.txt`),
      hash: createHash('sha256').update(srcFile.content).digest('hex'),
    }));

    const clonedFiles = await Promise.all(
      destFiles.map(async (file) => {
        reflinkFileSync(srcFile.path, file.path);
        return file;
      })
    );

    clonedFiles.forEach((file) => {
      const sourceContent = readFileSync(srcFile.path, 'utf-8');
      const sourceHash = createHash('sha256')
        .update(sourceContent)
        .digest('hex');

      expect(file.hash).toBe(sourceHash);

      const destContent = readFileSync(file.path, 'utf-8');
      const destHash = createHash('sha256').update(destContent).digest('hex');
      expect(destContent).toBe(sourceContent);
      expect(destHash).toBe(sourceHash);
    });
  });

  it('should clone "sample.pyc" file correctly (sync)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    const srcFile = {
      path: resolve(join('fixtures', 'sample.pyc')),
      content: readFileSync(join('fixtures', 'sample.pyc')),
    };

    const destFile = {
      path: join(dir, 'sample.pyc'),
      hash: createHash('sha256').update(srcFile.content).digest('hex'),
    };

    reflinkFileSync(srcFile.path, destFile.path);

    const destContent = readFileSync(destFile.path);
    const destHash = createHash('sha256').update(destContent).digest('hex');

    expect(destContent).toStrictEqual(srcFile.content);
    expect(destHash).toStrictEqual(destFile.hash);
  });

  /**
   * The issue with empty cloned files doesn't seem related to ASCII characters
   */
  it.skip('should clone "ascii-file.js" file correctly (sync)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    const srcFile = {
      path: resolve(join('fixtures', 'ascii-file.js')),
      content: readFileSync(join('fixtures', 'ascii-file.js')),
    };

    const destFile = {
      path: join(dir, 'ascii-file.js'),
      hash: createHash('sha256').update(srcFile.content).digest('hex'),
    };

    reflinkFileSync(srcFile.path, destFile.path);

    const destContent = readFileSync(destFile.path);
    const destHash = createHash('sha256').update(destContent).digest('hex');

    const sourceContent = readFileSync(srcFile.path);
    const sourceHash = createHash('sha256').update(sourceContent).digest('hex');

    expect(sourceContent).toStrictEqual(srcFile.content);
    expect(sourceHash).toStrictEqual(destFile.hash);

    expect(destContent).toStrictEqual(srcFile.content);
    expect(destHash).toStrictEqual(destFile.hash);
  });

  it('should clone "sample.pyc" file correctly (async)', async () => {
    const dir = sandboxDir();
    const sandboxFiles = await prepare(dir);
    const srcFile = {
      path: resolve(join('fixtures', 'sample.pyc')),
      content: readFileSync(join('fixtures', 'sample.pyc')),
    };

    const destFile = {
      path: join(dir, 'sample.pyc'),
      hash: createHash('sha256').update(srcFile.content).digest('hex'),
    };

    await reflinkFile(srcFile.path, destFile.path);

    const destContent = readFileSync(destFile.path);
    const destHash = createHash('sha256').update(destContent).digest('hex');

    expect(destContent).toStrictEqual(srcFile.content);
    expect(destHash).toStrictEqual(destFile.hash);
  });
});
