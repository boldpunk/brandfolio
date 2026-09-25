#!/bin/sh
# Runs ON the server, piped in over SSH by .github/workflows/deploy.yml.
# Publishes one release of the static site and keeps the previous three.
# Touches only /var/www/brandfolio and /etc/nginx/sites-*/brandfolio.conf;
# other sites on the server (molly.uz, mebelflow.uz) are left alone.
set -eu
: "${DEPLOY_DOMAIN:?}" "${RELEASE:?}"

ROOT=/var/www/brandfolio
UPLOAD=/tmp/brandfolio-upload/$RELEASE.tgz

echo "=== release $RELEASE ==="
mkdir -p "$ROOT/releases/$RELEASE"
tar -xzf "$UPLOAD" -C "$ROOT/releases/$RELEASE"
rm -f "$UPLOAD"
ln -sfn "$ROOT/releases/$RELEASE" "$ROOT/current.tmp"
mv -Tf "$ROOT/current.tmp" "$ROOT/current"
ls -1t "$ROOT/releases" | tail -n +4 | while read -r old; do rm -rf "$ROOT/releases/$old"; done

CONF=/etc/nginx/sites-available/brandfolio.conf
if [ ! -f "$CONF" ]; then
  echo "=== nginx site for $DEPLOY_DOMAIN (first deploy) ==="
  cat > "$CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DEPLOY_DOMAIN;
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
  nginx -t
  systemctl reload nginx
fi

if command -v certbot >/dev/null 2>&1 && ! grep -q "ssl_certificate" "$CONF"; then
  echo "=== certificate for $DEPLOY_DOMAIN ==="
  certbot --nginx -d "$DEPLOY_DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email \
    || echo "certbot failed: check that DNS for $DEPLOY_DOMAIN points to this server; the site stays on http"
fi

nginx -t && systemctl reload nginx
echo "published: $ROOT/current -> $(readlink "$ROOT/current")"
