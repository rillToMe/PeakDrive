# Health Check Module (ditDriveAPI)

## Endpoints

- GET /health
  - Lightweight check, no database validation
  - Returns service status and server time

- GET /health/full
  - Full diagnostics: API, database, and storage
  - Returns overall status plus detailed component results

## Example curl Requests

curl -i http://localhost:5133/health

curl -i http://localhost:5133/health/full

## Example JSON Response

/health

{
  "status": "ok",
  "service": "ditDriveAPI",
  "time": "2026-02-04T00:00:00.0000000Z"
}

/health/full

{
  "status": "ok",
  "api": true,
  "database": {
    "connected": true,
    "provider": "Neon PostgreSQL",
    "latencyMs": 20
  },
  "storage": {
    "exists": true,
    "writable": true,
    "path": "storage/"
  }
}

## Debugging Tips

- If database.connected = false, check your connection string and network access to Neon PostgreSQL.
- If storage.exists = false, verify Storage:RootPath and folder availability on the server.
- If storage.writable = false, check write permissions for the storage directory.
- If status = fail, inspect the detailed database and storage info returned by /health/full.