import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { join, resolve } from 'path';
import { reflinkFileSync, reflinkFile } from '../index.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { randomUUID, createHash } from 'crypto';

const sandboxDir = join(process.cwd(), `__reflink-tests-${randomUUID()}`);

const sandboxFiles = [
  {
    path: join(sandboxDir, 'file1.txt'),
    content: 'Hello World!',
    sha: createHash('sha256').update('Hello World!').digest('hex'),
  },
  {
    path: join(sandboxDir, 'file2.txt'),
    content: 'Hello World!',
    sha: createHash('sha256').update('Hello World!').digest('hex'),
  },
  {
    path: join(sandboxDir, 'file3.txt'),
    content: 'Hello World!',
    sha: createHash('sha256').update('Hello World!').digest('hex'),
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
      hash: createHash('sha256').update('Hello World!').digest('hex'),
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
      const hash = createHash('sha256').update(content).digest('hex');
      expect(content).toBe(file.content);
      expect(hash).toBe(file.hash);
    });
  });

  it('should keep the same hash when cloning a file more than 3,000 times', async () => {
    const srcFile = {
      path: resolve('./package.json'),
      content: readFileSync(join('./package.json'), 'utf-8'),
    };

    const destFiles = Array.from({ length: 3_000 }, (_, i) => ({
      path: join(sandboxDir, `file1-copy-${i}.txt`),
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
    const srcFile = {
      path: resolve(join('fixtures', 'sample.pyc')),
      content: readFileSync(join('fixtures', 'sample.pyc')),
    };

    const destFile = {
      path: join(sandboxDir, 'sample.pyc'),
      hash: createHash('sha256').update(srcFile.content).digest('hex'),
    };

    reflinkFileSync(srcFile.path, destFile.path);

    const destContent = readFileSync(destFile.path);
    const destHash = createHash('sha256').update(destContent).digest('hex');

    expect(destContent).toStrictEqual(srcFile.content);
    expect(destHash).toStrictEqual(destFile.hash);
  });

  /**
   * The issue with empty cloned files doesnt seem related to ASCII characters
   */
  it.skip('should clone "ascii-file.js" file correctly (sync)', async () => {
    const srcFile = {
      path: resolve(join('fixtures', 'ascii-file.js')),
      content: readFileSync(join('fixtures', 'ascii-file.js')),
    };

    const destFile = {
      path: join(sandboxDir, 'ascii-file.js'),
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
    const srcFile = {
      path: resolve(join('fixtures', 'sample.pyc')),
      content: readFileSync(join('fixtures', 'sample.pyc')),
    };

    const destFile = {
      path: join(sandboxDir, 'sample.pyc'),
      hash: createHash('sha256').update(srcFile.content).digest('hex'),
    };

    await reflinkFile(srcFile.path, destFile.path);

    const destContent = readFileSync(destFile.path);
    const destHash = createHash('sha256').update(destContent).digest('hex');

    expect(destContent).toStrictEqual(srcFile.content);
    expect(destHash).toStrictEqual(destFile.hash);
  });
});
