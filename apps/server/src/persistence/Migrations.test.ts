import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Migrator from "effect/unstable/sql/Migrator";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "./Migrations.ts";
import Migration0001 from "./Migrations/001_OrchestrationEvents.ts";
import Migration0002 from "./Migrations/002_OrchestrationCommandReceipts.ts";
import Migration0003 from "./Migrations/003_CheckpointDiffBlobs.ts";
import Migration0004 from "./Migrations/004_ProviderSessionRuntime.ts";
import Migration0005 from "./Migrations/005_Projections.ts";
import Migration0006 from "./Migrations/006_ProjectionThreadSessionRuntimeModeColumns.ts";
import Migration0007 from "./Migrations/007_ProjectionThreadMessageAttachments.ts";
import Migration0008 from "./Migrations/008_ProjectionThreadActivitySequence.ts";
import Migration0009 from "./Migrations/009_ProviderSessionRuntimeMode.ts";
import Migration0010 from "./Migrations/010_ProjectionThreadsRuntimeMode.ts";
import Migration0011 from "./Migrations/011_OrchestrationThreadCreatedRuntimeMode.ts";
import Migration0012 from "./Migrations/012_ProjectionThreadsInteractionMode.ts";
import Migration0013 from "./Migrations/013_ProjectionThreadProposedPlans.ts";
import Migration0016 from "./Migrations/016_ProjectionProjectsDevShell.ts";
import * as SqliteClient from "./NodeSqliteClient.ts";

const layer = it.layer(SqliteClient.layerMemory());

const oldStackLoader = Migrator.fromRecord({
  "1_OrchestrationEvents": Migration0001,
  "2_OrchestrationCommandReceipts": Migration0002,
  "3_CheckpointDiffBlobs": Migration0003,
  "4_ProviderSessionRuntime": Migration0004,
  "5_Projections": Migration0005,
  "6_ProjectionThreadSessionRuntimeModeColumns": Migration0006,
  "7_ProjectionThreadMessageAttachments": Migration0007,
  "8_ProjectionThreadActivitySequence": Migration0008,
  "9_ProviderSessionRuntimeMode": Migration0009,
  "10_ProjectionThreadsRuntimeMode": Migration0010,
  "11_OrchestrationThreadCreatedRuntimeMode": Migration0011,
  "12_ProjectionThreadsInteractionMode": Migration0012,
  "13_ProjectionThreadProposedPlans": Migration0013,
  "14_ProjectionProjectsDevShell": Migration0016,
});

const runOldStackMigrations = Migrator.make({});

const hasColumn = (
  columns: ReadonlyArray<{
    readonly name: string;
  }>,
  columnName: string,
) => columns.some((column) => column.name === columnName);

layer("Migrations", (it) => {
  it.effect("upgrades databases created by the old stack/all migration numbering", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runOldStackMigrations({ loader: oldStackLoader });

      const proposedPlanColumnsBefore = yield* sql<{
        readonly name: string;
      }>`PRAGMA table_info(projection_thread_proposed_plans)`;
      const turnColumnsBefore = yield* sql<{
        readonly name: string;
      }>`PRAGMA table_info(projection_turns)`;

      assert.equal(hasColumn(proposedPlanColumnsBefore, "implemented_at"), false);
      assert.equal(hasColumn(proposedPlanColumnsBefore, "implementation_thread_id"), false);
      assert.equal(hasColumn(turnColumnsBefore, "source_proposed_plan_thread_id"), false);
      assert.equal(hasColumn(turnColumnsBefore, "source_proposed_plan_id"), false);

      yield* runMigrations;

      const projectColumns = yield* sql<{
        readonly name: string;
      }>`PRAGMA table_info(projection_projects)`;
      const proposedPlanColumns = yield* sql<{
        readonly name: string;
      }>`PRAGMA table_info(projection_thread_proposed_plans)`;
      const turnColumns = yield* sql<{
        readonly name: string;
      }>`PRAGMA table_info(projection_turns)`;

      assert.equal(hasColumn(projectColumns, "dev_shell_json"), true);
      assert.equal(hasColumn(proposedPlanColumns, "implemented_at"), true);
      assert.equal(hasColumn(proposedPlanColumns, "implementation_thread_id"), true);
      assert.equal(hasColumn(turnColumns, "source_proposed_plan_thread_id"), true);
      assert.equal(hasColumn(turnColumns, "source_proposed_plan_id"), true);
    }),
  );
});
