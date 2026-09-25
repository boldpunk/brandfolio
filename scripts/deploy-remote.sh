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

nginx -t && systemctl reload nginx
echo "published: $(readlink "$ROOT/current")"
