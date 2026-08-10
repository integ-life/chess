# Null game moves crash fix

## Root cause

Some older or migrated game rows can contain `moves: null`. The library and play-history lists render `game.moves.length`, so a single row with null moves crashed the React route.

## Change

Game records are normalized at frontend API, IndexedDB, and sync boundaries so non-array moves become `[]`. Backend game reads and writes also normalize empty or `null` move payloads to `[]`.
