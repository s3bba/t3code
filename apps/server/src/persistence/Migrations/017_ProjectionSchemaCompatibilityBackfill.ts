import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const hasColumn = (
  columns: ReadonlyArray<{
    readonly name: string;
  }>,
  columnName: string,
) => columns.some((column) => column.name === columnName);

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // `stack/all` previously shipped `ProjectionProjectsDevShell` as migration 14.
  // After upstream added migrations 14 and 15, databases from that stack skip the
  // new 14 entirely during upgrade because the migrator keys off the numeric frontier.
  const proposedPlanColumns = yield* sql<{
    readonly name: string;
  }>`PRAGMA table_info(projection_thread_proposed_plans)`;

  if (!hasColumn(proposedPlanColumns, "implemented_at")) {
    yield* sql`
      ALTER TABLE projection_thread_proposed_plans
      ADD COLUMN implemented_at TEXT
    `;
  }

  if (!hasColumn(proposedPlanColumns, "implementation_thread_id")) {
    yield* sql`
      ALTER TABLE projection_thread_proposed_plans
      ADD COLUMN implementation_thread_id TEXT
    `;
  }

  const turnColumns = yield* sql<{ readonly name: string }>`PRAGMA table_info(projection_turns)`;

  if (!hasColumn(turnColumns, "source_proposed_plan_thread_id")) {
    yield* sql`
      ALTER TABLE projection_turns
      ADD COLUMN source_proposed_plan_thread_id TEXT
    `;
  }

  if (!hasColumn(turnColumns, "source_proposed_plan_id")) {
    yield* sql`
      ALTER TABLE projection_turns
      ADD COLUMN source_proposed_plan_id TEXT
    `;
  }
});
