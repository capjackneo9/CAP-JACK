#!/bin/sh
set -e
# Apply pending database migrations, then start the server.
node /opt/prisma/node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
exec node server.js
