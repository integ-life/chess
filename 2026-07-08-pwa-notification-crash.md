# PWA notification crash fix

## Root cause

Some installed/PWA browser environments reject direct `new Notification(...)` calls and throw `Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead.` The online match notification effect did not catch that exception, so React surfaced it as an application error.

## Change

Online match notifications now prefer `ServiceWorkerRegistration.showNotification()` when a service worker registration is available. Permission requests and fallback page notifications are guarded with `try/catch`, so unsupported notification paths degrade silently instead of crashing the app.
