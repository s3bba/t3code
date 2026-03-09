import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceDevShellRuntime } from "./WorkspaceDevShell";

describe("WorkspaceDevShellRuntime", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when project dev shell support is disabled", async () => {
    const commandRunner = vi.fn();
    const runtime = new WorkspaceDevShellRuntime(commandRunner);

    await expect(
      runtime.resolveEnvironmentOverlay({
        cwd: process.cwd(),
        devShell: { kind: "none" },
      }),
    ).resolves.toBeNull();
    expect(commandRunner).not.toHaveBeenCalled();
  });

  it("captures, caches, and invalidates nix flake environments per cwd", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "t3code-dev-shell-"));
    tempDirs.push(cwd);
    const flakePath = path.join(cwd, "flake.nix");
    fs.writeFileSync(flakePath, '{ description = "test"; }', "utf8");

    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: "PATH=/nix/store/bin\0IN_NIX_SHELL=1\0PWD=/tmp/ignored\0",
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      })
      .mockResolvedValueOnce({
        stdout: "PATH=/nix/store/bin\0IN_NIX_SHELL=1\0NEW_FLAG=1\0",
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });
    const runtime = new WorkspaceDevShellRuntime(commandRunner);

    const first = await runtime.resolveEnvironmentOverlay({
      cwd,
      devShell: { kind: "nix-flake" },
    });
    const second = await runtime.resolveEnvironmentOverlay({
      cwd,
      devShell: { kind: "nix-flake" },
    });

    expect(first).toEqual({
      PATH: "/nix/store/bin",
      IN_NIX_SHELL: "1",
    });
    expect(second).toEqual(first);
    expect(commandRunner).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 20));
    fs.appendFileSync(flakePath, "\n# invalidate cache\n", "utf8");

    const third = await runtime.resolveEnvironmentOverlay({
      cwd,
      devShell: { kind: "nix-flake" },
    });

    expect(commandRunner).toHaveBeenCalledTimes(2);
    expect(third).toEqual({
      PATH: "/nix/store/bin",
      IN_NIX_SHELL: "1",
      NEW_FLAG: "1",
    });
  });
});
