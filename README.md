# @refclone/refclone

[![npm version](https://badge.fury.io/js/%40refclone%2Frefclone.svg)](https://www.npmjs.com/package/@refclone/refclone)
[![Build Status](https://github.com/pnpm/refclone/workflows/CI/badge.svg)](https://github.com/pnpm/refclone/actions)

Copy-on-write file cloning for Node.js, powered by NAPI-RS and built upon [reflink-copy](https://github.com/cargo-bins/reflink-copy). This package supports a variety of platforms, including ARM and x86 architectures.

### Supported Platforms
    - Linux
    - MacOS
    - Windows (Server 2012+ and Windows Dev Drives)

## Installation

Just install `@refclone/refclone` using your favorite package manager:

```bash
pnpm add @refclone/refclone
```

## Usage

The package provides both synchronous and asynchronous methods to clone files.

### TypeScript Usage

First, import the package:

```typescript
import { reflinkFileSync, reflinkFile } from '@refclone/refclone';
```

#### Synchronous Method

```typescript
reflinkFileSync('source.txt', 'destination.txt');
```

#### Asynchronous Method

```typescript
await reflinkFile('source.txt', 'destination.txt');
```

## Testing

This package is tested using `vitest`. You can run the tests locally using:

```bash
yarn install
yarn build
yarn test
```
