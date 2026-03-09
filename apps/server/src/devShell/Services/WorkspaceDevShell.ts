import type { ProjectDevShell, WorkspaceDevShellEvent } from "@t3tools/contracts";
import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

export class WorkspaceDevShellError extends Schema.TaggedErrorClass<WorkspaceDevShellError>()(
  "WorkspaceDevShellError",
  {
    cwd: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface WorkspaceDevShellShape {
  readonly resolveEnvironmentOverlay: (input: {
    readonly cwd: string;
    readonly devShell: ProjectDevShell;
  }) => Effect.Effect<Record<string, string> | null, WorkspaceDevShellError>;
  readonly subscribe: (
    listener: (event: WorkspaceDevShellEvent) => void,
  ) => Effect.Effect<() => void>;
}

export class WorkspaceDevShell extends ServiceMap.Service<
  WorkspaceDevShell,
  WorkspaceDevShellShape
>()("t3/devShell/Services/WorkspaceDevShell") {}
