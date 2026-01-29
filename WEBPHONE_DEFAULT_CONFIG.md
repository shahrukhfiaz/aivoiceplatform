# Webphone Default Configuration

This document describes the default configuration for the AVR webphone that is built into the Docker image.

## Working Configuration

The following settings have been tested and confirmed working for local development:

### WebSocket Settings
- **WebSocket Server**: `localhost`
- **WebSocket Port**: `9088` (maps to Asterisk's HTTP server WebSocket on port 8088)
- **WebSocket Path**: `/ws` (HTTP server WebSocket endpoint)
- **Protocol**: `ws://` (automatically selected for localhost)

### SIP Settings
- **SIP Domain**: `localhost`
- **SIP Username**: `2000` (matches Asterisk endpoint 2000)
- **SIP Password**: `2000` (matches Asterisk endpoint 2000)
- **Display Name**: `Test User`

## Configuration Location

The default configuration is set in:
- **File**: `avr-phone/src/index.html`
- **Variable**: `phoneOptions`

## How It Works

1. When the webphone loads, it reads settings from `phoneOptions` in `index.html`
2. If settings are not found in `localStorage`, it uses the defaults from `phoneOptions`
3. Users can override these defaults by entering credentials in the webphone settings dialog
4. Settings are saved to `localStorage` and persist across page reloads

## Docker Build

When building the Docker image, these defaults are included in the `index.html` file, so every fresh installation will have these working settings pre-configured.

## Asterisk Endpoint Configuration

The default credentials (`2000`/`2000`) match the Asterisk endpoint configured in:
- **File**: `avr-infra/asterisk/conf/pjsip.conf`
- **Endpoint**: `2000`
- **Transport**: `transport-ws` (WebSocket on port 8090, mapped to 9088 via HTTP server)

## Port Mapping

The webphone connects to:
- **External Port**: `9088` (on host)
- **Internal Port**: `8088` (in Docker container)
- **Asterisk HTTP Server**: Listens on `0.0.0.0:8088`
- **WebSocket Endpoint**: `/ws` on the HTTP server

## Notes

- The HTTP server's WebSocket endpoint (`/ws` on port 8088) is used instead of the direct PJSIP WebSocket transport (port 8090) because it provides better compatibility
- For production deployments, update the `wssServer` to your domain name and use `wss://` protocol
- The `ServerPath: "/ws"` is required for the HTTP server WebSocket endpoint

