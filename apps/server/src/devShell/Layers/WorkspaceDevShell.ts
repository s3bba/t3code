import fs from "node:fs/promises";
import path from "node:path";

import type { ProjectDevShell, WorkspaceDevShellEvent } from "@t3tools/contracts";
import { Effect, Layer } from "effect";

import { createLogger } from "../../logger";
import { type ProcessRunOptions, type ProcessRunResult, runProcess } from "../../processRunner";
import {
  WorkspaceDevShell,
  WorkspaceDevShellError,
  type WorkspaceDevShellShape,
} from "../Services/WorkspaceDevShell.ts";

const NIX_CAPTURE_TIMEOUT_MS = 15 * 60_000;
const NIX_CAPTURE_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const STRIPPED_CAPTURE_KEYS = new Set(["OLDPWD", "PROMPT_COMMAND", "PS1", "PWD", "SHLVL", "_"]);

type CommandRunner = (
  command: string,
  args: readonly string[],
  options: ProcessRunOptions,
) => Promise<ProcessRunResult>;

interface WorkspaceDevShellCacheEntry {
  readonly fingerprint: string;
  readonly overlay: Record<string, string>;
}

function parseNullSeparatedEnvironment(input: string): Record<string, string> {
  const entries = input.split("\0");
  const environment: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.length === 0) {
      continue;
    }
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = entry.slice(0, separatorIndex);
    const value = entry.slice(separatorIndex + 1);
    environment[key] = value;
  }
  return environment;
}

function diffEnvironment(
  capturedEnvironment: Record<string, string>,
  baseEnvironment: NodeJS.ProcessEnv,
): Record<string, string> {
  const overlay: Record<string, string> = {};
  for (const [key, value] of Object.entries(capturedEnvironment)) {
    if (STRIPPED_CAPTURE_KEYS.has(key)) {
      continue;
    }
    if (baseEnvironment[key] === value) {
      continue;
    }
    overlay[key] = value;
  }
  return overlay;
}

export class WorkspaceDevShellRuntime {
  private readonly cache = new Map<string, WorkspaceDevShellCacheEntry>();
  private readonly inFlight = new Map<string, Promise<Record<string, string>>>();
  private readonly listeners = new Set<(event: WorkspaceDevShellEvent) => void>();
  private readonly logger = createLogger("workspace-dev-shell");

  constructor(private readonly commandRunner: CommandRunner = runProcess) {}

  async resolveEnvironmentOverlay(input: {
    readonly cwd: string;
    readonly devShell: ProjectDevShell;
  }): Promise<Record<string, string> | null> {
    switch (input.devShell.kind) {
      case "none":
        return null;
      case "nix-flake":
        return this.resolveNixFlakeEnvironment(input.cwd);
    }
  }

  private async resolveNixFlakeEnvironment(cwd: string): Promise<Record<string, string>> {
    const fingerprint = await this.readNixFlakeFingerprint(cwd);
    const cached = this.cache.get(cwd);
    if (cached && cached.fingerprint === fingerprint) {
      return cached.overlay;
    }

    const inFlightKey = `${cwd}\u0000${fingerprint}`;
    const existing = this.inFlight.get(inFlightKey);
    if (existing) {
      return existing;
    }

    this.emit({
      type: "loading",
      cwd,
      createdAt: new Date().toISOString(),
    });
    const promise = this.captureNixFlakeEnvironment(cwd)
      .then((overlay) => {
        this.cache.set(cwd, { fingerprint, overlay });
        this.emit({
          type: "ready",
          cwd,
          createdAt: new Date().toISOString(),
        });
        return overlay;
      })
      .catch((error) => {
        this.emit({
          type: "error",
          cwd,
          createdAt: new Date().toISOString(),
          message:
            error instanceof Error
              ? error.message.trim() || "Failed to prepare nix dev shell."
              : "Failed to prepare nix dev shell.",
        });
        throw error;
      })
      .finally(() => {
        this.inFlight.delete(inFlightKey);
      });

    this.inFlight.set(inFlightKey, promise);
    return promise;
  }

  private async readNixFlakeFingerprint(cwd: string): Promise<string> {
    const flakePath = path.join(cwd, "flake.nix");
    const flakeStat = await fs.stat(flakePath).catch(() => null);
    if (!flakeStat || !flakeStat.isFile()) {
      throw new Error(
        `Nix flake dev shell is enabled for '${cwd}', but '${flakePath}' was not found.`,
      );
    }

    const lockPath = path.join(cwd, "flake.lock");
    const lockStat = await fs.stat(lockPath).catch(() => null);
    const lockFingerprint =
      lockStat && lockStat.isFile() ? `${lockStat.size}:${lockStat.mtimeMs}` : "missing";

    return `${flakeStat.size}:${flakeStat.mtimeMs}:${lockFingerprint}`;
  }

  private async captureNixFlakeEnvironment(cwd: string): Promise<Record<string, string>> {
    this.logger.info("capturing nix dev shell environment", { cwd });
    const result = await this.commandRunner("nix", ["develop", "--command", "env", "-0"], {
      cwd,
      timeoutMs: NIX_CAPTURE_TIMEOUT_MS,
      maxBufferBytes: NIX_CAPTURE_MAX_BUFFER_BYTES,
      outputMode: "truncate",
    });

    const capturedEnvironment = parseNullSeparatedEnvironment(result.stdout);
    const overlay = diffEnvironment(capturedEnvironment, process.env);
    this.logger.info("captured nix dev shell environment", {
      cwd,
      overlayKeys: Object.keys(overlay).length,
    });
    return overlay;
  }

  subscribe(listener: (event: WorkspaceDevShellEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: WorkspaceDevShellEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export interface WorkspaceDevShellLiveOptions {
  readonly commandRunner?: CommandRunner;
}

export function makeWorkspaceDevShellLive(options?: WorkspaceDevShellLiveOptions) {
  return Layer.sync(WorkspaceDevShell, (): WorkspaceDevShellShape => {
    const runtime = new WorkspaceDevShellRuntime(options?.commandRunner);
    return {
      resolveEnvironmentOverlay: (input) =>
        Effect.tryPromise({
          try: () => runtime.resolveEnvironmentOverlay(input),
          catch: (cause) =>
            new WorkspaceDevShellError({
              cwd: input.cwd,
              message:
                cause instanceof Error
                  ? cause.message
                  : "Failed to resolve workspace dev shell environment.",
              cause,
            }),
        }),
      subscribe: (listener) => Effect.sync(() => runtime.subscribe(listener)),
    };
  });
}

export const WorkspaceDevShellLive = makeWorkspaceDevShellLive();
