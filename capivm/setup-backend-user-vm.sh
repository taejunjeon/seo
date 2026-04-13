#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-$HOME/seo}"
NODE_VERSION="${NODE_VERSION:-v22.14.0}"
NODE_DIST="node-${NODE_VERSION}-linux-x64"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.tar.xz"

mkdir -p \
  "$APP_ROOT/repo" \
  "$APP_ROOT/shared/backend-data" \
  "$APP_ROOT/shared/backend-logs" \
  "$APP_ROOT/shared/env" \
  "$APP_ROOT/shared/secrets" \
  "$APP_ROOT/tmp"

if [[ ! -x "$APP_ROOT/node/bin/node" ]]; then
  curl -fsSL "$NODE_URL" -o "$APP_ROOT/tmp/${NODE_DIST}.tar.xz"
  tar -xJf "$APP_ROOT/tmp/${NODE_DIST}.tar.xz" -C "$APP_ROOT"
  rm -rf "$APP_ROOT/node"
  mv "$APP_ROOT/${NODE_DIST}" "$APP_ROOT/node"
fi

cat > "$APP_ROOT/env.sh" <<EOF
export APP_ROOT="$APP_ROOT"
export PATH="$APP_ROOT/node/bin:\$PATH"
EOF

echo "User-space VM setup completed."
echo "Run: source $APP_ROOT/env.sh"
echo "Node: $APP_ROOT/node/bin/node"
