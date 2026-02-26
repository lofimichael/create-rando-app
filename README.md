# create-rando-app

Scaffold a Dev Rando-compatible JavaScript project with strict dependency integrity verification.

## Usage

```bash
npx create-rando-app@latest my-rando-solution
```

## Hosted generator mode

```bash
npx create-rando-app@latest my-rando-solution \
  --api-base https://web-production-f1b94.up.railway.app \
  --approach balanced \
  --seed deadbeef \
  --deps 12 \
  --dev-deps 6
```

- `--bundle-url <url>` fetches an existing hosted bundle.
- `--api-base <url>` creates a hosted bundle from the platform API.
- `--seed <value>` controls deterministic generation.
- `--approach <name>` chooses strategy (`balanced`, `stable`, `chaos`, `framework`).
- `--deps <n>` and `--dev-deps <n>` tune bundle sizes.

## Local fallback mode

```bash
npx create-rando-app@latest my-rando-solution \
  --required esbuild,lodash \
  --min-deps 3
```

- `--challenge <slug>` sets the challenge slug in `devrando.config.json`.
- `--required <pkg1,pkg2>` seeds local dependencies.
- `--min-deps <n>` enforces minimum dependency count.
- `--force` allows writing into a non-empty directory.
- `--help` prints usage.

## Generated Files

- `package.json` with fully inlined `verify` crypto/integrity command (`verify-deps` kept as alias).
- `devrando.config.json` challenge metadata.
- `src/index.js` placeholder implementation entrypoint.

## Why

Dev Rando challenges are dependency-driven. This CLI gives every participant a deterministic bundle and strict local integrity checks before they submit a public repository URL to the platform.
