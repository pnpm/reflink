// @ts-check
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { rimraf } from 'rimraf';
import chalk from 'chalk';
import { reflinkFile } from './index.js';

async function main() {
  const originalSrcPath = path.resolve('./package.json');
  const originalContent = await fs.readFile(originalSrcPath, 'utf-8');

  let iteration = 0;

  while (iteration < 50) {
    // Remove and recreate the sandbox directory
    rimraf.sync('./sandbox'); // Using synchronous rimraf for simplicity
    await fs.mkdir('./sandbox', { recursive: true });

    // Create a random name for the new base file and copy package.json to sandbox directory
    const randomName = `base-${Math.random().toString(36).substring(2)}.json`;
    const newSrcPath = path.join('./sandbox', randomName);
    await fs.writeFile(newSrcPath, originalContent);

    const srcFile = {
      path: newSrcPath,
      content: originalContent,
    };
    const srcHash = createHash(srcFile.content);

    for (let i = 0; i < 1000; i++) {
      const destPath = path.join('./sandbox', `file1-copy-${i}.txt`);

      await reflinkFile(srcFile.path, destPath);

      const destContent = await fs.readFile(destPath, 'utf-8');
      const destHash = createHash(destContent);

      if (destHash !== srcHash) {
        console.log(`Hash mismatch detected on file: ${destPath}`);
        console.log(`Src Hash: ${srcHash}, Dest Hash: ${destHash}`);
        return;
      }
    }

    iteration++;

    console.log(
      chalk.green(
        `Iteration ${iteration} successful ${chalk.gray.dim(
          `[${iteration * 1000} files cloned successfully]`
        )}`
      )
    );
  }
}

function createHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

main().catch((err) => {
  console.error(err);
});
