# Client roadmap from the legacy frontend

This document maps the existing `frontend/public` pages to the React app in `client`. The legacy HTML is the source inventory; `backend/routes` is the source of truth for supported data and actions.

## Pages and coverage

| Legacy page(s) | React destination | Status / notes |
| --- | --- | --- |
| `index.html` | `/` | Rebuilt landing page. |
| `authHub.html` | `/login`, `/register` | Login and registration use `/auth/login` and `/auth/register`; verification is required before login. |
| `forgot.html`, `reset.html` | `/forgot-password` | Request reset code and set a new password using auth API. |
| `dashboard.html` | `/dashboard` | Profile-backed workspace, creation shortcuts, token balance. |
| `text-handler.html` | `/create/note` | Creates notes through `/api/note/upload-note`. |
| `image-handler.html`, `test.html` | `/create/image` | Uploads photos through `/api/image/upload-asset`. `test.html` appears to be a duplicate/debug page. |
| `recorder.html` | `/create/voice` | Browser microphone recording and `/api/audio/upload-voice`. |
| `noteview.html` | `/note/:id` | Reads view-limited notes through `/api/note/read-note/:id`. |
| `view-asset.html` | `/image/:id` | Reads view-limited image content through `/api/image/view-asset/:id`. |
| `voiceView.html` | `/voice/:id` | Plays the stream from `/api/audio/stream-voice/:id`. |
| `profile.html`, `settings.html` | `/profile` | Profile display and public tag updates. Settings with no backend behavior are intentionally omitted. |
| `giftToken.html` | `/gift-tokens` | Transfers tokens with password confirmation. |
| `buyToken.html` | `/tokens` | Payment details, supported token packs and receipt submission. |
| `shop.html` | `/skins` | Browse and purchase platform skins. |
| `userSkin.html` | `/skins/inventory` | View owned skins and equip one. |
| `admin-dashboard.html`, `adminUsers.html` | `/admin` | Admin user list, verification, deletion, direct token balance updates, password resets, pending top-ups, payment account settings and skin upload. |
| `adminSkin.html` | `/admin#settings` | Skin upload form is in the admin workspace. |
| `token-manger.html` | `/admin#topups` and `/admin#settings` | Top-up approvals are implemented. Updating bank details remains to be added to the admin UI. |
| `Terms.html`, `Policy.html`, `credits.html` | `/terms`, `/privacy`, `/credits` | Basic React informational pages. Legal copy should be reviewed by the service owner before publication. |
| `404.html` | `*` | React not-found page. |

## Legacy features without backend routes

`room.html`, `play.html`, and `music.html` describe game rooms and music preferences. There are no matching room/game/music routes in `backend/routes`, so the React client does not pretend these features work. Add backend contracts before rebuilding those flows.

## Backend/API notes

- Axios lives in `src/api/client.js`; set `VITE_API_URL` to the API origin when deploying.
- The server builds share URLs from the requesting frontend Origin when that origin is allowed by `CLIENT_ORIGINS`; `PUBLIC_SITE_URL` is an optional fixed-origin override. The React client uses `/note/:id`, `/image/:id` and `/voice/:id`.
- Public note, image and audio viewers use React routes; the API checks recipient restrictions and view/plays limits.
- The payment API accepts receipt URLs. It does not upload receipt files.
- The admin API provides a password-reset operation, but no existing admin screen clearly exposes it; add that action before calling admin coverage complete.

## Suggested remaining work

1. Add content library/history APIs if users need to manage links they previously created; the current backend has no listing endpoint for a user's content.
2. Decide whether legacy game rooms and music settings are still product requirements, then define their backend API.
3. Review legal page copy with the product owner.
