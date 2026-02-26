# create-rando-app

Scaffold a Dev Rando-compatible JavaScript project with a built-in dependency validation script.

## Usage

```bash
npx create-rando-app@latest my-rando-solution
```

## Options

```bash
npx create-rando-app@latest my-rando-solution \
  --challenge starter-rando \
  --required esbuild,lodash \
  --min-deps 3
```

- `--challenge <slug>` sets the challenge slug in `devrando.config.json`.
- `--required <pkg1,pkg2>` sets required dependencies.
- `--min-deps <n>` enforces minimum dependency count for validation.
- `--force` allows writing into a non-empty directory.
- `--help` prints usage.

## Generated Files

- `package.json` with `validate:rando` script.
- `devrando.config.json` challenge metadata.
- `scripts/verify-rando.js` local validation logic.
- `src/index.js` placeholder implementation entrypoint.

## Why

Dev Rando challenges are dependency-driven. This CLI gives every participant a consistent local baseline before they submit a public repository URL to the platform.
