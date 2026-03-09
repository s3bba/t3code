import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const DEFAULT_PROJECT_DEV_SHELL_JSON = '{"kind":"none"}';

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE projection_projects
    ADD COLUMN dev_shell_json TEXT NOT NULL DEFAULT '{"kind":"none"}'
  `;

  yield* sql`
    UPDATE projection_projects
    SET dev_shell_json = ${DEFAULT_PROJECT_DEV_SHELL_JSON}
    WHERE dev_shell_json IS NULL
  `;
});
