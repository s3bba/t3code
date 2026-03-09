import { lstat, mkdir, readdir, rm, symlink } from "node:fs/promises";
import { join, relative } from "node:path";

type PackageManifest = {
  name?: string;
  bin?: string | Record<string, string>;
};

const root = process.cwd();
const bunRoot = join(root, "node_modules/.bun");
const bunEntries = (await readdir(bunRoot)).toSorted();

for (const entry of bunEntries) {
  const modulesRoot = join(bunRoot, entry, "node_modules");
  if (!(await exists(modulesRoot))) {
    continue;
  }
  const binRoot = join(modulesRoot, ".bin");
  await rm(binRoot, { recursive: true, force: true });
  await mkdir(binRoot, { recursive: true });

  const packageDirs = await collectPackages(modulesRoot);
  for (const packageDir of packageDirs) {
    const manifest = await readManifest(packageDir);
    if (!manifest?.bin) {
      continue;
    }

    const seen = new Set<string>();
    if (typeof manifest.bin === "string") {
      const fallback = manifest.name ?? packageDir.split("/").pop();
      if (fallback) {
        await linkBinary(binRoot, fallback, packageDir, manifest.bin, seen);
      }
      continue;
    }

    for (const [name, target] of Object.entries(manifest.bin).toSorted((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      await linkBinary(binRoot, name, packageDir, target, seen);
    }
  }
}

async function collectPackages(modulesRoot: string): Promise<string[]> {
  const found: string[] = [];
  const topLevel = (await readdir(modulesRoot)).toSorted();
  for (const name of topLevel) {
    if (name === ".bin" || name === ".bun") {
      continue;
    }

    const full = join(modulesRoot, name);
    if (!(await isDirectory(full))) {
      continue;
    }

    if (name.startsWith("@")) {
      const scoped = (await readdir(full)).toSorted();
      for (const child of scoped) {
        const scopedDir = join(full, child);
        if (await isDirectory(scopedDir)) {
          found.push(scopedDir);
        }
      }
      continue;
    }

    found.push(full);
  }

  return found.toSorted();
}

async function readManifest(dir: string): Promise<PackageManifest | null> {
  const file = Bun.file(join(dir, "package.json"));
  if (!(await file.exists())) {
    return null;
  }
  return (await file.json()) as PackageManifest;
}

async function linkBinary(
  binRoot: string,
  name: string,
  packageDir: string,
  target: string,
  seen: Set<string>,
): Promise<void> {
  if (!name || !target) {
    return;
  }

  const normalizedName = normalizeBinName(name);
  if (seen.has(normalizedName)) {
    return;
  }

  const resolved = join(packageDir, target);
  const script = Bun.file(resolved);
  if (!(await script.exists())) {
    return;
  }

  seen.add(normalizedName);
  const destination = join(binRoot, normalizedName);
  const relativeTarget = relative(binRoot, resolved);
  await rm(destination, { force: true });
  await symlink(relativeTarget.length === 0 ? "." : relativeTarget, destination);
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

function normalizeBinName(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}
