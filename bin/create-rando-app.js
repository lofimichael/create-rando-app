#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

function printUsage() {
  console.log("create-rando-app <directory> [options]");
  console.log("");
  console.log("Hosted mode:");
  console.log("  --bundle-url <url>     Use an existing hosted seed bundle URL");
  console.log("  --api-base <url>       Create a hosted bundle via API base URL");
  console.log("  --seed <value>         Seed when creating bundle via API");
  console.log("  --approach <name>      balanced|stable|chaos|framework");
  console.log("  --deps <n>             dependency count for API bundle generation");
  console.log("  --dev-deps <n>         dev dependency count for API bundle generation");
  console.log("");
  console.log("Local fallback mode:");
  console.log("  --challenge <slug>     Challenge slug (default: starter-rando)");
  console.log("  --required <a,b,c>     Required dependency list (default: esbuild)");
  console.log("  --min-deps <n>         Minimum dependency count (default: 3)");
  console.log("");
  console.log("General:");
  console.log("  --force                Allow non-empty target directory");
  console.log("  --help                 Print usage");
}

function parseArgs(args) {
  const options = {
    challenge: "starter-rando",
    required: [ "esbuild" ],
    minDeps: 3,
    bundleUrl: "",
    apiBase: "",
    seed: "",
    approach: "balanced",
    deps: 12,
    devDeps: 6,
    force: false,
    help: false
  };
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    if (token === "--force") {
      options.force = true;
      continue;
    }
    if (token === "--challenge") {
      options.challenge = args[i + 1] || options.challenge;
      i += 1;
      continue;
    }
    if (token === "--bundle-url") {
      options.bundleUrl = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--api-base") {
      options.apiBase = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--seed") {
      options.seed = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--approach") {
      options.approach = args[i + 1] || options.approach;
      i += 1;
      continue;
    }
    if (token === "--deps") {
      const parsed = Number.parseInt(args[i + 1] || "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.deps = parsed;
      }
      i += 1;
      continue;
    }
    if (token === "--dev-deps") {
      const parsed = Number.parseInt(args[i + 1] || "", 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        options.devDeps = parsed;
      }
      i += 1;
      continue;
    }
    if (token === "--required") {
      const raw = args[i + 1] || "";
      options.required = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (token === "--min-deps") {
      const parsed = Number.parseInt(args[i + 1] || "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.minDeps = parsed;
      }
      i += 1;
      continue;
    }
    if (token.startsWith("-")) {
      throw new Error(`Unknown option: ${token}`);
    }

    positionals.push(token);
  }

  return { options, positionals };
}

function normalizePackageName(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 214) || "rando-app";
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

function ensureDirectory(targetDir, force) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    return;
  }

  const entries = fs.readdirSync(targetDir);
  if (entries.length > 0 && !force) {
    throw new Error(`Target directory is not empty: ${targetDir}. Use --force to continue.`);
  }
}

function normalizeMap(obj) {
  return Object.fromEntries(
    Object.entries(obj || {})
      .map(([name, version]) => [String(name), String(version)])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function depsHashFor(dependencies, devDependencies) {
  const canonical = JSON.stringify({
    dependencies: normalizeMap(dependencies),
    devDependencies: normalizeMap(devDependencies)
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function buildPackageJson(packageName, dependencies, devDependencies, bundleSlug = "local-seed") {
  return JSON.stringify({
    name: packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      prepare: "npm run verify:rando",
      dev: "node src/index.js",
      "validate:rando": "node scripts/verify-rando.js",
      "verify:rando": "node scripts/verify-rando.js",
      test: "npm run validate:rando"
    },
    dependencies: normalizeMap(dependencies),
    devDependencies: normalizeMap(devDependencies),
    keywords: [ "dev-rando", "challenge", "seed-bundle", bundleSlug ]
  }, null, 2) + "\n";
}

function buildDevRandoConfig({
  challengeSlug,
  requiredPackages,
  minDeps,
  seedBundleSlug,
  approach,
  seed,
  dependencies,
  devDependencies
}) {
  const allowedDependencies = normalizeMap(dependencies);
  const allowedDevDependencies = normalizeMap(devDependencies);
  const depsHash = depsHashFor(allowedDependencies, allowedDevDependencies);

  return JSON.stringify({
    challengeSlug,
    seedBundleSlug,
    seed,
    approach,
    algorithmVersion: "v1",
    ecosystem: "npm",
    depsHash,
    allowed: {
      dependencies: allowedDependencies,
      devDependencies: allowedDevDependencies
    },
    constraints: {
      requiredPackages,
      minDependencies: minDeps
    }
  }, null, 2) + "\n";
}

function buildValidatorScript() {
  return `import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

const config = JSON.parse(fs.readFileSync("devrando.config.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

const dependencies = packageJson.dependencies || {};
const devDependencies = packageJson.devDependencies || {};

const normalizeMap = (obj) =>
  Object.fromEntries(
    Object.entries(obj || {})
      .map(([name, version]) => [String(name), String(version)])
      .sort(([left], [right]) => left.localeCompare(right))
  );

const allowedDependencies = normalizeMap(config.allowed?.dependencies || {});
const allowedDevDependencies = normalizeMap(config.allowed?.devDependencies || {});
const currentDependencies = normalizeMap(dependencies);
const currentDevDependencies = normalizeMap(devDependencies);

const canonical = JSON.stringify({
  dependencies: currentDependencies,
  devDependencies: currentDevDependencies
});
const depsHash = crypto.createHash("sha256").update(canonical).digest("hex");
assert.equal(depsHash, config.depsHash, "Dependencies integrity check failed");

const allowedNames = new Set([
  ...Object.keys(allowedDependencies),
  ...Object.keys(allowedDevDependencies)
]);
const currentNames = new Set([
  ...Object.keys(currentDependencies),
  ...Object.keys(currentDevDependencies)
]);

const unexpected = [ ...currentNames ].filter((name) => !allowedNames.has(name));
const missing = [ ...allowedNames ].filter((name) => !currentNames.has(name));
assert.equal(unexpected.length, 0, \`Unexpected dependencies present: \${unexpected.join(", ")}\`);
assert.equal(missing.length, 0, \`Expected dependencies missing: \${missing.join(", ")}\`);

const minDependencies = Number(config.constraints?.minDependencies || 1);
assert.ok(currentNames.size >= minDependencies, \`Need at least \${minDependencies} dependencies, found \${currentNames.size}.\`);

const lsOutput = execSync("npm ls --depth=0 --json", { stdio: ["ignore", "pipe", "pipe"] }).toString();
const npmTree = JSON.parse(lsOutput);
const extraneous = Object.entries(npmTree.dependencies || {})
  .filter(([, meta]) => meta && meta.extraneous)
  .map(([name]) => name);
assert.equal(extraneous.length, 0, \`Extraneous installed packages detected: \${extraneous.join(", ")}\`);

console.log("✨ READY TO RANDO ✨ Dependencies integrity verified");
`;
}

function buildReadme(directoryName, challengeSlug) {
  return `# ${directoryName}

Generated by create-rando-app.

## Challenge

- Slug: \`${challengeSlug}\`

## Commands

- \`npm install\`
- \`npm run validate:rando\`
- \`npm run dev\`
`;
}

function buildEntryPoint() {
  return `console.log("Implement your Dev Rando solution here.");\n`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} from ${url}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

function apiBaseUrl(input) {
  return String(input || "").replace(/\/+$/, "");
}

function withQuery(url, params) {
  const parsed = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    parsed.searchParams.set(key, String(value));
  });
  return parsed.toString();
}

async function fetchHostedBundle(options, packageName) {
  if (options.bundleUrl) {
    const url = withQuery(options.bundleUrl, { include_starter: "true", package_name: packageName });
    return fetchJson(url);
  }

  if (options.apiBase) {
    const endpoint = `${apiBaseUrl(options.apiBase)}/api/v1/seed_bundles`;
    return fetchJson(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: options.seed || undefined,
        approach: options.approach || "balanced",
        dependency_count: options.deps,
        dev_dependency_count: options.devDeps,
        challenge_slug: options.challenge || undefined,
        package_name: packageName
      })
    });
  }

  return null;
}

function writeFiles(targetDir, files) {
  Object.entries(files || {}).forEach(([relativePath, content]) => {
    writeFile(path.join(targetDir, relativePath), String(content));
  });
}

function localFallbackBundle(options, packageName) {
  const requiredPackages = options.required.length > 0 ? options.required : [ "esbuild" ];
  const dependencies = Object.fromEntries(requiredPackages.map((dependency) => [ dependency, "latest" ]));
  const devDependencies = {};
  const seed = options.seed || crypto.randomBytes(8).toString("hex");
  const approach = options.approach || "balanced";

  const config = buildDevRandoConfig({
    challengeSlug: options.challenge,
    requiredPackages,
    minDeps: options.minDeps,
    seedBundleSlug: "local-seed",
    approach,
    seed,
    dependencies,
    devDependencies
  });

  return {
    slug: "local-seed",
    starter: {
      files: {
        "package.json": buildPackageJson(packageName, dependencies, devDependencies, "local-seed"),
        "devrando.config.json": config,
        "scripts/verify-rando.js": buildValidatorScript(),
        "src/index.js": buildEntryPoint(),
        ".gitignore": "node_modules\n.DS_Store\n",
        "README.md": buildReadme(packageName, options.challenge)
      }
    }
  };
}

function run() {
  const parsed = parseArgs(process.argv.slice(2));
  const { options, positionals } = parsed;
  if (options.help) {
    printUsage();
    return;
  }

  const directoryName = positionals[0] || "rando-app";
  const targetDir = path.resolve(process.cwd(), directoryName);
  const packageName = normalizePackageName(path.basename(targetDir));

  ensureDirectory(targetDir, options.force);

  return fetchHostedBundle(options, packageName)
    .catch((error) => {
      throw new Error(`Hosted bundle request failed. ${error.message}`);
    })
    .then((hostedPayload) => hostedPayload || localFallbackBundle(options, packageName))
    .then((payload) => {
      if (!payload.starter || !payload.starter.files) {
        throw new Error("Invalid bundle payload. Missing starter files.");
      }

      writeFiles(targetDir, payload.starter.files);

      console.log(`Scaffolded Dev Rando project at: ${targetDir}`);
      if (payload.slug) {
        console.log(`Bundle: ${payload.slug}`);
      }
      console.log("Next steps:");
      console.log(`1) cd ${path.basename(targetDir)}`);
      console.log("2) npm install");
      console.log("3) npm run verify:rando");
      console.log("4) npm run dev");
    });
}

try {
  await run();
} catch (error) {
  console.error(`create-rando-app failed: ${error.message}`);
  process.exit(1);
}
