# Add gFlyfy SSH Host

Added `gFlyfy` to `~/.ssh/config` with `HostName 100.99.167.13`, `User songyy`, and the existing `~/.ssh/id_rsa` identity.

Verification:
- `ssh -G gFlyfy` resolves the alias to `100.99.167.13`.
- A non-interactive SSH probe reached host key verification and stopped with `Host key verification failed`, so the alias is configured but the host key still needs to be accepted or corrected.
