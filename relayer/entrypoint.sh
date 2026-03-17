#!/bin/sh
# Fix volume permissions (Railway mounts as root)
chown -R node:node /app/data 2>/dev/null || true
exec su-exec node node dist/index.js
