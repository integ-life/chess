# Deploy Migration Order Fix

During the auth deployment, the backend binary uploaded successfully but the public health check returned `502` because the remote backend process exited at startup.

Root cause: the existing production SQLite database did not have `games.user_id` or `explorations.user_id`. `Store.Open` executed the full embedded migration first, and that migration tried to create indexes on `user_id` before the compatibility column-add logic ran.

Fix: run existing-database compatibility migration before executing the embedded migration, and skip column-add attempts when a fresh database does not have the table yet.

Verification:
- Reproduced locally with an old-schema SQLite file.
- Confirmed the old-schema file now starts successfully.
- `go test ./...` passed.
- Redeployed backend and verified `https://xq-api.songyangyu.com/api/health` returned version `20260707-084036`.
