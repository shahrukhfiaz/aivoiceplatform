# Docker Socket Path Fix

## Issue
The `/docker/containers` endpoint was returning a 500 Internal Server Error because the backend was trying to connect to a Windows Docker socket path on a Linux system.

## Root Cause
The `avr-app/backend/.env` file had:
```
DOCKER_SOCKET_PATH=//./pipe/docker_engine
```

This is a Windows named pipe path, but the system is running Linux, which uses a Unix socket at `/var/run/docker.sock`.

## Fix Applied

1. **Updated `.env` file**: Changed `DOCKER_SOCKET_PATH` from `//./pipe/docker_engine` to `/var/run/docker.sock`

2. **Improved DockerService**: Added logging to help debug Docker connection issues in the future

## Verification

After the fix:
- Backend restarted successfully
- No more "connect ENOENT //./pipe/docker_engine" errors
- Docker socket is accessible at `/var/run/docker.sock`

## Testing

To test the Docker containers endpoint:
1. Log in to the frontend at `http://localhost:3000`
2. Navigate to `/dockers` page
3. The containers list should now load without errors

## Notes

- The backend needs access to `/var/run/docker.sock` to manage Docker containers
- The user must be in the `docker` group (already configured)
- For production deployments, ensure the Docker socket path matches the host OS

