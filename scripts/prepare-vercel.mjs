import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Package only tracked frontend/shared source. Never upload Hardhat keys,
// local env files, deployment receipts, or node_modules to the demo host.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = await mkdtemp(path.join(tmpdir(), "hbar-checkout-vercel-"));
const files = execFileSync(
  "git",
  ["ls-files", "-z", "packages/nextjs", "packages/checkout"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
for (const source of files) {
  if (source.split("/").some((part) => part.startsWith(".env"))) continue;
  const relative = source.startsWith("packages/nextjs/")
    ? source.slice("packages/nextjs/".length)
    : source;
  const target = path.join(destination, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, source), target);
}
const manifest = JSON.parse(
  await readFile(path.join(destination, "package.json"), "utf8"),
);
const workspace = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
manifest.name = "hbar-checkout-demo";
manifest.engines = { node: "22.x" };
manifest.workspaces = ["packages/checkout"];
manifest.devDependencies.typescript = workspace.devDependencies.typescript;
manifest.devDependencies["@types/node"] =
  workspace.devDependencies["@types/node"];
await writeFile(
  path.join(destination, "package.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  path.join(destination, "vercel.json"),
  JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: "nextjs",
      installCommand: "npm ci",
      buildCommand: "npm run build",
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  path.join(destination, ".vercelignore"),
  "node_modules\n.next\n.env*\n*.tsbuildinfo\n",
);
execFileSync(
  "npm",
  [
    "install",
    "--package-lock-only",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  {
    cwd: destination,
    stdio: ["ignore", "ignore", "inherit"],
  },
);
console.log(destination);
