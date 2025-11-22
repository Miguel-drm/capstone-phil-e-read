# WebSocket Environment Variables Setup

This guide explains how to configure WebSocket URLs for the frontend using environment variables in Render.

## Environment Variables

The frontend supports separate WebSocket URLs for Tagalog and English services:

### Recommended (Language-Specific)

Set these in your Render frontend service:

```
VITE_VOSK_WS_URL_TAGALOG=wss://vigilant-celebration.up.railway.app
VITE_VOSK_WS_URL_ENGLISH=wss://philiready-websocket-english.up.railway.app
```

### Fallback (Single URL - Deprecated)

If you only set one URL, it will be used for both languages (not recommended):

```
VITE_VOSK_WS_URL=wss://your-service.up.railway.app
```

**Note**: Using a single URL will only work if that service supports both languages. For best results, use separate URLs for each language.

## How to Set in Render

1. Go to your Render dashboard
2. Select your frontend service (e.g., `phileread-frontend`)
3. Navigate to **Environment** tab
4. Click **Edit** on the Environment Variables card
5. Add the following variables:

   | KEY | VALUE |
   |-----|-------|
   | `VITE_VOSK_WS_URL_TAGALOG` | `wss://vigilant-celebration.up.railway.app` |
   | `VITE_VOSK_WS_URL_ENGLISH` | `wss://philiready-websocket-english.up.railway.app` |

6. Click **Save Changes**
7. The service will automatically redeploy with the new environment variables

## Default Values

If no environment variables are set, the code will use these defaults:

- **Tagalog**: `wss://vigilant-celebration.up.railway.app`
- **English**: `wss://philiready-websocket-english.up.railway.app`

## Priority Order

The code checks environment variables in this order:

1. **Language-specific variable** (e.g., `VITE_VOSK_WS_URL_TAGALOG` for Tagalog)
2. **Fallback variable** (`VITE_VOSK_WS_URL`)
3. **Hardcoded default** (if no env vars are set)

## Example Configuration

### Render Environment Variables:

```
VITE_VOSK_WS_URL_TAGALOG=wss://vigilant-celebration.up.railway.app
VITE_VOSK_WS_URL_ENGLISH=wss://philiready-websocket-english.up.railway.app
```

### Result:

- Tagalog stories → Connects to `wss://vigilant-celebration.up.railway.app?lang=tagalog`
- English stories → Connects to `wss://philiready-websocket-english.up.railway.app?lang=english`

## Troubleshooting

### Connection Fails

1. Verify the Railway services are running and publicly accessible
2. Check that the URLs use `wss://` (secure WebSocket) not `ws://`
3. Ensure the URLs don't have trailing slashes
4. Check Railway dashboard for the correct public URLs

### Using Wrong Service

- Make sure you're setting both `VITE_VOSK_WS_URL_TAGALOG` and `VITE_VOSK_WS_URL_ENGLISH`
- Remove the old `VITE_VOSK_WS_URL` if you want to use separate services
- Redeploy after changing environment variables

## Notes

- Environment variables starting with `VITE_` are exposed to the browser
- Never put sensitive credentials in `VITE_` variables
- WebSocket URLs are safe to expose (they're public endpoints)
- Changes to environment variables require a redeploy to take effect

