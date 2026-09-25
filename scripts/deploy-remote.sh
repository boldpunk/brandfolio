#!/bin/sh
# Runs ON the server as root, piped in over SSH by .github/workflows/deploy.yml.
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

if ! command -v nginx >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  echo "=== installing nginx and certbot ==="
  apt-get update -q
  apt-get install -y -q nginx certbot python3-certbot-nginx
  systemctl enable --now nginx
fi
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null
fi

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
  nginx -t
  systemctl reload nginx
fi

if ! grep -q "ssl_certificate" "$CONF"; then
  echo "=== certificate for $NAMES ==="
  set -- ; for n in $NAMES; do set -- "$@" -d "$n"; done
  certbot --nginx "$@" --non-interactive --agree-tos --redirect --register-unsafely-without-email \
    || echo "certbot failed: check that the DNS A record of $DEPLOY_DOMAIN points to this server; the site stays on http for now"
fi

nginx -t && systemctl reload nginx
echo "published: $(readlink "$ROOT/current")"
