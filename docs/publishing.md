# LinkedIn Publishing Setup

The workflow keeps drafts locally and sends only an explicitly approved, hash-matched final post to LinkedIn.

See [the architecture view](architecture.md) for the end-to-end decision flow.

## Prerequisites

1. Create a LinkedIn Developer application.
2. Add an HTTPS OAuth callback URL.
3. Enable **Share on LinkedIn** for `w_member_social` and **Sign In with LinkedIn using OpenID Connect** for `openid` and `profile`. Availability depends on LinkedIn approval and the app's Products configuration.
4. Provide the client ID, client secret, redirect URI, and current API version to the application at runtime. The authorized member URN is derived from OpenID user info.
5. Confirm the current API version before publishing. Do not keep a permanent hard-coded default.

## Publishing Sequence

1. Start the local control panel with `npm start`.
2. Generate a cryptographically random OAuth state and store it in the user's server-side session.
3. Redirect the user to the URL from `buildAuthorizationUrl`.
4. On callback, verify the returned state before exchanging the authorization code.
5. Keep the access token in server memory only. Restarting requires authorization again.
6. Save the optimized record as JSON and run `npm run approve -- content/drafts/<record>.json` after the user approves the exact final text.
7. Choose one final action: publish an approved text-only post now through the control panel, or use the exact approved text to schedule manually in LinkedIn.
8. For a future LinkedIn post, use LinkedIn's native scheduler. It continues while the local server is stopped and supports media and native company tags.
9. Persist the returned `x-restli-id` immediately for immediate API publication.

## Runtime Setup On Windows

Do not paste credentials into chat or save them in workspace files. In the terminal that will run the server:

```powershell
$env:LINKEDIN_CLIENT_ID = Read-Host "LinkedIn client ID"
$secret = Read-Host "LinkedIn client secret" -AsSecureString
$env:LINKEDIN_CLIENT_SECRET = [System.Net.NetworkCredential]::new("", $secret).Password
$env:LINKEDIN_REDIRECT_URI = Read-Host "Public HTTPS callback URL"
$env:LINKEDIN_API_VERSION = "202609"
npm start
```

Register the exact callback URL in the Developer Portal. It must end with `/auth/linkedin/callback`. A public HTTPS reverse proxy or tunnel may forward that URL to `http://127.0.0.1:3000`; do not expose any other local service.

## Failure Handling

The client marks `429` and `5xx` responses as potentially retryable but deliberately does not retry publication automatically. An ambiguous write may already have succeeded, and the API does not document an idempotency key. Reconcile the result before another attempt to avoid duplicate posts.

The initial adapter supports text posts only. Images, videos, and documents require LinkedIn's respective upload API before they can be attached automatically. Until that adapter is added, create a manual handoff containing the selected files, alt text, reference links, requested company tags, and final hashtags. Do not silently publish a text-only version when attachments were approved.

Company names in post text are not native LinkedIn tags. A native tag requires a supported official API mention format and a verified organization identifier; otherwise retain it as a manual handoff request using the company's public LinkedIn Page URL.

## Scheduling Limits

The local app is for immediate API publication only. For posts scheduled later, copy the approved content into LinkedIn and use its native scheduler. This avoids missed posts when the local server is stopped and supports media and native company tags.

Playwright may test an application UI against mocked API responses. It must not automate LinkedIn login, typing, posting, likes, comments, connections, or scraping.