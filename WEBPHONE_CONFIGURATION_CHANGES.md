# Webphone Configuration Changes

## Summary

The webphone default configuration has been updated to include working settings that will be included in every Docker build.

## Changes Made

### 1. Updated `avr-phone/src/index.html`

Added default values to `phoneOptions`:

```javascript
var phoneOptions = {
    loadAlternateLang: true,
    wssServer: "localhost",      // WebSocket server address
    WebSocketPort: "9088",      // HTTP server WebSocket (ws://) - mapped from 8088
    ServerPath: "/ws",          // HTTP server WebSocket path
    SipDomain: "localhost",     // SIP domain
    SipUsername: "2000",        // Default SIP username (matches Asterisk endpoint 2000)
    SipPassword: "2000",        // Default SIP password (matches Asterisk endpoint 2000)
    profileName: "Test User"     // Default display name
}
```

### 2. Updated `avr-phone/src/phone.js`

Added logic to apply defaults from `phoneOptions` when localStorage is empty:

```javascript
// Apply defaults from phoneOptions if not set in localStorage
if (typeof phoneOptions !== 'undefined') {
    if (profileName === null && phoneOptions.profileName) profileName = phoneOptions.profileName;
    if (wssServer === null && phoneOptions.wssServer) wssServer = phoneOptions.wssServer;
    if (WebSocketPort === null && phoneOptions.WebSocketPort) WebSocketPort = phoneOptions.WebSocketPort;
    if (ServerPath === null && phoneOptions.ServerPath !== undefined) ServerPath = phoneOptions.ServerPath;
    if (SipDomain === null && phoneOptions.SipDomain) SipDomain = phoneOptions.SipDomain;
    if (SipUsername === null && phoneOptions.SipUsername) SipUsername = phoneOptions.SipUsername;
    if (SipPassword === null && phoneOptions.SipPassword) SipPassword = phoneOptions.SipPassword;
}
```

## Working Configuration

These settings have been tested and confirmed working:

- **WebSocket Server**: `localhost`
- **WebSocket Port**: `9088` (maps to Asterisk HTTP server on port 8088)
- **WebSocket Path**: `/ws` (HTTP server WebSocket endpoint)
- **SIP Domain**: `localhost`
- **SIP Username**: `2000`
- **SIP Password**: `2000`
- **Display Name**: `Test User`

## How It Works

1. When the webphone loads, it first checks `localStorage` for saved settings
2. If `localStorage` is empty, it uses the defaults from `phoneOptions` in `index.html`
3. Users can override these defaults by entering credentials in the webphone settings dialog
4. Settings are saved to `localStorage` and persist across page reloads

## Docker Build

When you build the Docker image with:
```bash
docker-compose -f docker-compose-local-dev.yml build avr-phone
```

The default configuration will be included in the `index.html` file, so every fresh installation will have these working settings pre-configured.

## Testing

To test with a fresh installation:
1. Clear browser localStorage: `localStorage.clear()` in browser console
2. Reload the page
3. The webphone should automatically connect with the default credentials

## Files Modified

- `avr-phone/src/index.html` - Added default `phoneOptions` with working settings
- `avr-phone/src/phone.js` - Added logic to apply defaults from `phoneOptions`

## Notes

- The HTTP server's WebSocket endpoint (`/ws` on port 8088) is used instead of the direct PJSIP WebSocket transport (port 8090) because it provides better compatibility
- For production deployments, update the `wssServer` to your domain name and use `wss://` protocol
- The `ServerPath: "/ws"` is required for the HTTP server WebSocket endpoint
- The default credentials (`2000`/`2000`) match the Asterisk endpoint configured in `avr-infra/asterisk/conf/pjsip.conf`

