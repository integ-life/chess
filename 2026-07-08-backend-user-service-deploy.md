# Backend user service deployment

## Context

Production backend was previously started by `start-backend.sh` with `nohup setsid`, so the process was not attached to a named user-level service.

## Change

- Created and enabled `~/.config/systemd/user/chinese-chess-backend.service` on `gFlyfy`.
- Updated `scripts/deploy-backend-gflyfy.sh` to install or refresh the user service and run `systemctl --user restart chinese-chess-backend.service` during deploy.
- Re-ran backend deployment after the script change.

## Verification

- `systemctl --user status chinese-chess-backend.service` is active and enabled.
- Public health check returned version `20260708-023903`.
- Production SQLite `games` table has the new `tree` column.
