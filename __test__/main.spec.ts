import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { join } from 'path';
import { reflinkFileSync, reflinkFile } from '../index.js';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const sandboxDir = join(process.cwd(), `__reflink-tests-${randomUUID()}`);

const sandboxFiles = [
  {
    path: join(sandboxDir, 'file1.txt'),
    content: 'Hello World!',
  },
  {
    path: join(sandboxDir, 'file2.txt'),
    content: 'Hello World!',
  },
  {
    path: join(sandboxDir, 'file3.txt'),
    content: 'Hello World!',
  },
];

describe('reflink', () => {
  beforeAll(async () => {
    await mkdir(sandboxDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(sandboxDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // remove the sandbox directory and recreate it
    await rm(sandboxDir, { recursive: true, force: true });
    await mkdir(sandboxDir, { recursive: true });

    // create the files again
    await Promise.all(
      sandboxFiles.map(async (file) => {
        await writeFile(file.path, file.content);
      })
    );
  });

  it('should correctly clone a file (sync)', () => {
    const file = sandboxFiles[0];

    reflinkFileSync(file.path, join(sandboxDir, 'file1-copy.txt'));

    const content = readFileSync(join(sandboxDir, 'file1-copy.txt'), 'utf-8');

    expect(content).toBe(file.content);
  });

  it('should correctly clone a file (async)', async () => {
    const file = sandboxFiles[0];

    await reflinkFile(file.path, join(sandboxDir, 'file1-copy.txt'));

    const content = readFileSync(join(sandboxDir, 'file1-copy.txt'), 'utf-8');

    expect(content).toBe(file.content);
  });

  it('should keep the same content in source file after editing the cloned file', async () => {
    const file = sandboxFiles[0];

    await reflinkFile(file.path, join(sandboxDir, 'file1-copy.txt'));

    await writeFile(
      join(sandboxDir, 'file1-copy.txt'),
      file.content + '\nAdded content!'
    );

    const originalContent = readFileSync(file.path, 'utf-8');

    expect(originalContent).toBe(file.content);
  });

  it('should fail if the source file does not exist (sync)', () => {
    expect(() => {
      reflinkFileSync(
        join(sandboxDir, 'file-does-not-exist.txt'),
        join(sandboxDir, 'file1-copy.txt')
      );
    }).toThrow();
  });

  it('should fail if the source file does not exist (async)', async () => {
    await expect(
      reflinkFile(
        join(sandboxDir, 'file-does-not-exist.txt'),
        join(sandboxDir, 'file1-copy.txt')
      )
    ).rejects.toThrow();
  });

  it('should fail if the destination file already exists (sync)', () => {
    expect(() => {
      reflinkFileSync(sandboxFiles[0].path, sandboxFiles[1].path);
    }).toThrow();
  });

  it('should fail if the destination file already exists (async)', async () => {
    await expect(
      reflinkFile(sandboxFiles[0].path, sandboxFiles[1].path)
    ).rejects.toThrow();
  });

  it('should fail if the source file is a directory (sync)', () => {
    expect(() => {
      reflinkFileSync(sandboxDir, sandboxFiles[1].path);
    }).toThrow();
  });

  it('should fail if the source file is a directory (async)', async () => {
    await expect(
      reflinkFile(sandboxDir, sandboxFiles[1].path)
    ).rejects.toThrow();
  });

  it('should fail if the source and destination files are the same (sync)', () => {
    expect(() => {
      reflinkFileSync(sandboxFiles[0].path, sandboxFiles[0].path);
    }).toThrow();
  });

  it('should fail if the source and destination files are the same (async)', async () => {
    await expect(
      reflinkFile(sandboxFiles[0].path, sandboxFiles[0].path)
    ).rejects.toThrow();
  });

  it('should fail if the destination parent directory does not exist (sync)', () => {
    expect(() => {
      reflinkFileSync(
        sandboxFiles[0].path,
        join(sandboxDir, 'does-not-exist', 'file1-copy.txt')
      );
    }).toThrow();
  });

  it('should correctly clone 1000 files (sync)', async () => {
    const files = Array.from({ length: 1000 }, (_, i) => ({
      path: join(sandboxDir, `file${i}.txt`),
      content: 'Hello World!',
    }));

    await Promise.all(
      files.map(async (file) => writeFile(file.path, file.content))
    );

    await Promise.all(
      files.map(async (file, i) =>
        reflinkFileSync(file.path, join(sandboxDir, `file${i}-copy.txt`))
      )
    );

    files.forEach((file, i) => {
      const content = readFileSync(
        join(sandboxDir, `file${i}-copy.txt`),
        'utf-8'
      );
      expect(content).toBe(file.content);
    });
  });

  it('should correctly clone 1000 files (async)', async () => {
    const files = Array.from({ length: 1000 }, (_, i) => ({
      path: join(sandboxDir, `file${i}.txt`),
      content: 'Hello World!',
    }));

    await Promise.all(
      files.map(async (file) => writeFile(file.path, file.content))
    );

    await Promise.all(
      files.map(async (file, i) =>
        reflinkFile(file.path, join(sandboxDir, `file${i}-copy.txt`))
      )
    );

    files.forEach((file, i) => {
      const content = readFileSync(
        join(sandboxDir, `file${i}-copy.txt`),
        'utf-8'
      );
      expect(content).toBe(file.content);
    });
  });
});
