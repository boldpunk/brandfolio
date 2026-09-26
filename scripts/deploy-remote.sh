#!/bin/sh
# Runs ON the server as root, piped in over SSH by .github/workflows/deploy.yml.
# Safe on a shared server: it only adds its own nginx site (like molly.conf
# next to mebelflow.conf) and only reloads nginx after `nginx -t` passes.
# Publishes one release of the static site into /var/www/brandfolio and keeps
# the three latest. On the first run it installs nginx and certbot if missing,
# writes /etc/nginx/sites-available/brandfolio.conf and requests a certificate
# for the domain (and www when its DNS record exists). Other nginx sites are
# not touched.
set -eu
: "${DEPLOY_DOMAIN:?}" "${RELEASE:?}"
export DEBIAN_FRONTEND=noninteractive

ROOT=/var/www/brandfolio
UPLOAD=/tmp/brandfolio-upload/$RELEASE.tgz
CONF=/etc/nginx/sites-available/brandfolio.conf

if ! command -v nginx >/dev/null 2>&1; then
  # Fresh server only. On a server that already runs nginx (for example with
  # mebelflow.uz and molly.uz) nothing is installed or reconfigured.
  echo "=== installing nginx and certbot (fresh server) ==="
  apt-get update -q
  apt-get install -y -q nginx certbot python3-certbot-nginx
  systemctl enable --now nginx
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow 'Nginx Full' >/dev/null
  fi
fi

# Never touch nginx while its current config is broken: that is someone else's
# problem to fix, and a reload would fail for every site anyway.
nginx -t

echo "=== release $RELEASE ==="
mkdir -p "$ROOT/releases/$RELEASE"
tar -xzf "$UPLOAD" -C "$ROOT/releases/$RELEASE"
rm -f "$UPLOAD"
chmod -R a+rX "$ROOT/releases/$RELEASE"
ln -sfn "$ROOT/releases/$RELEASE" "$ROOT/current.tmp"
mv -Tf "$ROOT/current.tmp" "$ROOT/current"
ls -1t "$ROOT/releases" | tail -n +4 | while read -r old; do rm -rf "$ROOT/releases/$old"; done

# www is added when it resolves, so a missing record does not break the cert.
NAMES="$DEPLOY_DOMAIN"
if getent hosts "www.$DEPLOY_DOMAIN" >/dev/null 2>&1; then NAMES="$DEPLOY_DOMAIN www.$DEPLOY_DOMAIN"; fi

if [ ! -f "$CONF" ]; then
  echo "=== nginx site for $NAMES ==="
  cat > "$CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $NAMES;
    root $ROOT/current;
    index index.html;

    # Single-page app: unknown paths get index.html.
    location / {
        try_files \$uri /index.html;
    }
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files \$uri =404;
    }
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
NGINX
  ln -sf "$CONF" /etc/nginx/sites-enabled/brandfolio.conf
  if ! nginx -t; then
    # Roll back our site so the other sites keep working.
    rm -f /etc/nginx/sites-enabled/brandfolio.conf "$CONF"
    echo "nginx rejected the brandfolio site; it was removed again, other sites untouched"
    exit 1
  fi
  systemctl reload nginx
fi

# A site written before www resolved lists only the bare domain; widen it
# (while certbot has not taken the file over yet) so the certificate fits.
if ! grep -q "ssl_certificate" "$CONF" && ! grep -q "server_name $NAMES;" "$CONF"; then
  cp "$CONF" "$CONF.bak"
  sed -i "s/^\( *server_name \).*;/\1$NAMES;/" "$CONF"
  if nginx -t; then
    systemctl reload nginx
  else
    mv "$CONF.bak" "$CONF"
  fi
  rm -f "$CONF.bak"
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot is not installed; the site is served over http only"
elif ! getent ahostsv4 "$DEPLOY_DOMAIN" | awk '{print $1}' | grep -qxF "$(curl -4 -fsS --max-time 10 https://api.ipify.org || echo none)"; then
  echo "DNS of $DEPLOY_DOMAIN does not point to this server yet; certificate postponed, re-run the deploy after DNS is updated"
elif ! grep -q "ssl_certificate" "$CONF"; then
  echo "=== certificate for $NAMES ==="
  set -- ; for n in $NAMES; do set -- "$@" -d "$n"; done
  certbot --nginx "$@" --non-interactive --agree-tos --keep-until-expiring --redirect --register-unsafely-without-email \
    || echo "certbot failed: check that the DNS A record of $DEPLOY_DOMAIN points to this server; the site stays on http for now"
fi

# ------------------------------------------------------------------ API
# Accounts, cloud projects and share links (server-dist/server.mjs). Runs as
# its own system user on 127.0.0.1:3517 with a private Node in
# /opt/brandfolio/node, so the Node versions of other sites never matter.
# nginx forwards /api/ to it through a snippet included in our site only.
API_UPLOAD=/tmp/brandfolio-upload/$RELEASE-api.tgz
if [ -f "$API_UPLOAD" ]; then
  API_ROOT=/opt/brandfolio/api
  NODE_DIR=/opt/brandfolio/node
  DATA=/var/lib/brandfolio
  UNIT=/etc/systemd/system/brandfolio-api.service
  SNIPPET=/etc/nginx/snippets/brandfolio-api.conf

  # node:sqlite needs Node 22.13 or newer; the official build is fetched once.
  if ! "$NODE_DIR/bin/node" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; then
    echo "=== installing Node 22 into $NODE_DIR ==="
    case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64) ARCH=arm64 ;; *) echo "unsupported CPU $(uname -m)"; exit 1 ;; esac
    BASE=https://nodejs.org/dist/latest-v22.x
    FILE=$(curl -fsSL "$BASE/SHASUMS256.txt" | awk -v a="linux-$ARCH.tar.xz" '$2 ~ a"$" {print $2}')
    SUM=$(curl -fsSL "$BASE/SHASUMS256.txt" | awk -v f="$FILE" '$2 == f {print $1}')
    curl -fsSL -o /tmp/brandfolio-node.tar.xz "$BASE/$FILE"
    echo "$SUM  /tmp/brandfolio-node.tar.xz" | sha256sum -c -
    rm -rf "$NODE_DIR.tmp" && mkdir -p "$NODE_DIR.tmp"
    tar -xJf /tmp/brandfolio-node.tar.xz -C "$NODE_DIR.tmp" --strip-components=1
    rm -f /tmp/brandfolio-node.tar.xz
    rm -rf "$NODE_DIR" && mv "$NODE_DIR.tmp" "$NODE_DIR"
  fi

  id brandfolio >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin brandfolio
  mkdir -p "$DATA" "$API_ROOT/releases/$RELEASE" /etc/brandfolio
  chown brandfolio:brandfolio "$DATA" && chmod 750 "$DATA"
  # Settings that are not in the repository (ADMIN_EMAILS, payment keys) live here.
  [ -f /etc/brandfolio/api.env ] || { printf '# Brandfolio API settings, for example:\n# ADMIN_EMAILS=you@example.com\n' > /etc/brandfolio/api.env; chmod 640 /etc/brandfolio/api.env; chgrp brandfolio /etc/brandfolio/api.env; }

  tar -xzf "$API_UPLOAD" -C "$API_ROOT/releases/$RELEASE"
  rm -f "$API_UPLOAD"
  chmod -R a+rX "$API_ROOT/releases/$RELEASE"
  PREVIOUS=$(readlink "$API_ROOT/current" 2>/dev/null || true)
  ln -sfn "$API_ROOT/releases/$RELEASE" "$API_ROOT/current.tmp"
  mv -Tf "$API_ROOT/current.tmp" "$API_ROOT/current"

  cat > "$UNIT.new" <<UNITFILE
[Unit]
Description=Brandfolio API
After=network.target

[Service]
User=brandfolio
Group=brandfolio
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3517
Environment=DATA_DIR=$DATA
EnvironmentFile=-/etc/brandfolio/api.env
WorkingDirectory=$API_ROOT/current
ExecStart=$NODE_DIR/bin/node $API_ROOT/current/server.mjs
Restart=on-failure
RestartSec=2
MemoryMax=512M
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA

[Install]
WantedBy=multi-user.target
UNITFILE
  if ! cmp -s "$UNIT.new" "$UNIT"; then mv "$UNIT.new" "$UNIT"; systemctl daemon-reload; else rm -f "$UNIT.new"; fi
  systemctl enable brandfolio-api >/dev/null 2>&1
  systemctl restart brandfolio-api

  healthy=no
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS --max-time 3 http://127.0.0.1:3517/api/health >/dev/null 2>&1; then healthy=yes; break; fi
    sleep 1
  done
  if [ "$healthy" != yes ]; then
    journalctl -u brandfolio-api -n 40 --no-pager || true
    if [ -n "$PREVIOUS" ]; then
      echo "API release $RELEASE is unhealthy; rolling back to $PREVIOUS"
      ln -sfn "$PREVIOUS" "$API_ROOT/current.tmp" && mv -Tf "$API_ROOT/current.tmp" "$API_ROOT/current"
      systemctl restart brandfolio-api
    fi
    exit 1
  fi
  ls -1t "$API_ROOT/releases" | tail -n +4 | while read -r old; do rm -rf "$API_ROOT/releases/$old"; done

  mkdir -p /etc/nginx/snippets
  cat > "$SNIPPET" <<'NGINX'
# Brandfolio API (brandfolio-api.service). Included from brandfolio.conf only.
location /api/ {
    proxy_pass http://127.0.0.1:3517;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 6m;
    proxy_read_timeout 60s;
}
NGINX
  # Include it in every server block of our site that serves the app (the
  # HTTPS one after certbot); the HTTP redirect block has no root line.
  if ! grep -q "brandfolio-api.conf" "$CONF"; then
    cp "$CONF" "$CONF.bak"
    sed -i "s|^\( *\)root $ROOT/current;|&\n\1include $SNIPPET;|" "$CONF"
    if nginx -t; then
      rm -f "$CONF.bak"
    else
      mv "$CONF.bak" "$CONF"
      echo "nginx rejected the API include; the site keeps working without /api"
      exit 1
    fi
  fi
fi

nginx -t && systemctl reload nginx
echo "published: $(readlink "$ROOT/current")"
