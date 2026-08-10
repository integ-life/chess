# Online match resume

## Root cause

Online matches lived only in the backend process memory. Deploying the backend restarted the process and cleared the in-memory match hub, so existing clients kept polling match ids that no longer existed.

## Change

Open online matches are now persisted to SQLite with full board state, clocks, players, room code, and bot-thinking state. The backend can restore a match by id, room code, or latest open match for the current user, and the play page automatically resumes an unfinished online match when opened.
