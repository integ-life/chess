# Online match cancel

## Root cause

The online waiting screen had no way to leave matchmaking or a newly-created room. Closing the screen locally would leave the server-side waiting match available until another online action touched the hub.

## Change

Added an authenticated cancel endpoint for waiting online matches. The frontend waiting panel now shows a cancel button and also handles the short connection window by cancelling the match once the server returns its id.
