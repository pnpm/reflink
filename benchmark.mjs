import { join } from 'path';
import { mkdir, rm, writeFile, link } from 'fs/promises';
import { linkSync } from 'fs';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import { reflinkFileSync, reflinkFile } from './index.js';

const sandboxDir = join(process.cwd(), `__link-tests-${randomUUID()}`);
const testFilePath = join(sandboxDir, 'testFile.txt');

const results = {};

async function setup() {
  await rm(sandboxDir, { recursive: true, force: true });
  await mkdir(sandboxDir, { recursive: true });
  await writeFile(testFilePath, 'Hello, world!');
}

async function teardown() {
  await rm(sandboxDir, { recursive: true, force: true });
}

async function runBenchmark(name, fn) {
  await setup();
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    const destPath = join(sandboxDir, `clone-${i}.txt`);
    await fn(destPath);
  }
  const end = performance.now();
  const time = end - start;
  results[name] = time.toFixed(2);
  console.log(chalk.green(`${name}: ${chalk.blue(time)} ms`));
  await teardown();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(chalk.bold('Running Benchmarks...'));

  await runBenchmark('Node fs.linkSync', (destPath) => {
    linkSync(testFilePath, destPath);
  });
  await delay(2000);

  await runBenchmark('Node fs.promises.link', async (destPath) => {
    await link(testFilePath, destPath);
  });
  await delay(2000);

  await runBenchmark('reflinkFileSync', (destPath) => {
    reflinkFileSync(testFilePath, destPath);
  });
  await delay(2000);

  await runBenchmark('reflinkFile', async (destPath) => {
    await reflinkFile(testFilePath, destPath);
  });

  console.log(chalk.bold('\nBenchmark Summary:'));
  for (const [name, time] of Object.entries(results)) {
    console.log(`${name}: ${time} ms`);
  }

  const fastest = Object.entries(results).sort((a, b) => a[1] - b[1])[0];
  console.log(
    chalk.green.bold(`\nFastest is ${fastest[0]} with ${fastest[1]} ms`)
  );
}

main().catch((err) => {
  console.error(chalk.red('An error occurred:', err));
  process.exit(1);
});
