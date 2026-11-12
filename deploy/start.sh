#!/bin/sh
set -eu
cd /app

# Refuse startup when the host cannot enforce the compiler's namespace boundary.
if ! bwrap \
  --unshare-all --die-with-parent --new-session --clearenv \
  --ro-bind /app/.tools/rootfs / \
  --ro-bind /app/.tools/.TinyTeX /tex \
  --proc /proc --dev /dev \
  --size 1048576 --tmpfs /tmp \
  --chdir /tmp \
  /bin/sh -c '
    test ! -e /app && test ! -e /home && test ! -e /etc/passwd &&
    test -z "${CLERK_SECRET_KEY-}" &&
    { IFS= read -r header; ! IFS= read -r route; } < /proc/net/route
  '; then
  printf '%s\n' 'Compiler sandbox unavailable. Check this service namespace permissions.' >&2
  exit 1
fi

exec /usr/local/bin/node node_modules/next/dist/bin/next start \
  --hostname 0.0.0.0 --port "${PORT:-3000}"
