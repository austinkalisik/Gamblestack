#!/usr/bin/env bash
set -Eeuo pipefail

REPO="https://github.com/austinkalisik/Gamblestack.git"
BRANCH="tidalwave-deploy"
APP="/opt/gamblestack"
DOMAIN="${DOMAIN:-bet.tidalwavesoftwebsolutions.tech}"
SERVER_IP="${SERVER_IP:-187.52.117.54}"
COMPOSE_FILE="$APP/docker-compose.tidalwave.yml"
APACHE_CONF=""
ACME_ROOT="/var/www/gamblestack-acme"

log(){ printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die(){ echo "[ERROR] $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root."

echo "============================================================"
echo " AUSKAL-404 / TIDALWAVE SOFTWEB SOLUTIONS"
echo " GAMBLESTACK - RUSH REPLACEMENT DEPLOYMENT"
echo "============================================================"
echo "Repo   : $REPO"
echo "Branch : $BRANCH"
echo "Domain : $DOMAIN"
echo

# 1. Remove only the previous Rush deployment.
log "Removing previous Rush deployment"

systemctl disable --now tidalwave-rush-tick.timer 2>/dev/null || true
systemctl disable --now tidalwave-rush.service 2>/dev/null || true
rm -f /etc/systemd/system/tidalwave-rush.service
rm -f /etc/systemd/system/tidalwave-rush-tick.service
rm -f /etc/systemd/system/tidalwave-rush-tick.timer

if command -v podman >/dev/null 2>&1; then
  podman rm -f tidalwave-rush >/dev/null 2>&1 || true
  podman rmi localhost/tidalwave-rush:latest >/dev/null 2>&1 || true
fi

rm -rf /opt/tidalwave-rush
rm -f /usr/local/sbin/tidalwave-rush-tick
rm -f /etc/apache2/conf.d/tidalwave-rush.conf 2>/dev/null || true
rm -f /etc/httpd/conf.d/tidalwave-rush.conf 2>/dev/null || true
rm -f /etc/apache2/sites-enabled/tidalwave-rush.conf 2>/dev/null || true
rm -f /etc/apache2/sites-available/tidalwave-rush.conf 2>/dev/null || true

systemctl daemon-reload

# 2. Required host tools.
log "Checking host dependencies"

if command -v dnf >/dev/null 2>&1; then
  PM=dnf
elif command -v yum >/dev/null 2>&1; then
  PM=yum
elif command -v apt-get >/dev/null 2>&1; then
  PM=apt
else
  die "Unsupported package manager."
fi

if [ "$PM" = "apt" ]; then
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y git curl openssl ca-certificates podman python3 python3-pip iproute2
else
  "$PM" install -y git curl openssl ca-certificates podman python3 python3-pip iproute || true
fi

command -v git >/dev/null || die "git is unavailable."
command -v podman >/dev/null || die "podman is unavailable."

COMPOSE_KIND=""
if podman compose version >/dev/null 2>&1; then
  COMPOSE_KIND="podman-compose-plugin"
elif command -v podman-compose >/dev/null 2>&1; then
  COMPOSE_KIND="podman-compose"
else
  log "Installing podman-compose"
  if [ "$PM" = "apt" ]; then
    apt-get install -y podman-compose 2>/dev/null || python3 -m pip install podman-compose
  else
    "$PM" install -y podman-compose 2>/dev/null || python3 -m pip install podman-compose
  fi
  command -v podman-compose >/dev/null || die "Could not install podman-compose."
  COMPOSE_KIND="podman-compose"
fi

compose() {
  if [ "$COMPOSE_KIND" = "podman-compose-plugin" ]; then
    podman compose -f "$COMPOSE_FILE" "$@"
  else
    podman-compose -f "$COMPOSE_FILE" "$@"
  fi
}

# 3. Stop an existing Gamblestack deployment while preserving volumes and secrets.
PRESERVED_ENV=""
if [ -f "$APP/.env" ]; then
  PRESERVED_ENV="/root/gamblestack-env-preserved-$(date +%Y%m%d_%H%M%S)"
  cp -p "$APP/.env" "$PRESERVED_ENV"
fi

systemctl disable --now gamblestack.service 2>/dev/null || true

if [ -f "$COMPOSE_FILE" ]; then
  compose down >/dev/null 2>&1 || true
fi

# 4. Clone the deployment branch.
log "Cloning Gamblestack"

rm -rf "$APP"
git clone --branch "$BRANCH" --single-branch "$REPO" "$APP"
cd "$APP"

echo "[PASS] $(git log -1 --oneline)"

# 5. Generate or preserve deployment secrets and private bind ports.
port_free() {
  ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":${1}$"
}

if [ -n "$PRESERVED_ENV" ] && [ -f "$PRESERVED_ENV" ]; then
  cp -p "$PRESERVED_ENV" "$APP/.env"
  echo "[PASS] Existing Gamblestack environment preserved."
else
  WEB_PORT=""
  API_PORT=""

  for p in $(seq 3200 3299); do
    if port_free "$p"; then WEB_PORT="$p"; break; fi
  done
  for p in $(seq 4200 4299); do
    if port_free "$p"; then API_PORT="$p"; break; fi
  done

  [ -n "$WEB_PORT" ] || die "No free web port in 3200-3299."
  [ -n "$API_PORT" ] || die "No free API port in 4200-4299."

  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  RABBITMQ_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 48)"

  cat > "$APP/.env" <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
RABBITMQ_PASSWORD=$RABBITMQ_PASSWORD
WEB_BIND_PORT=$WEB_PORT
API_BIND_PORT=$API_PORT
DATABASE_URL=postgres://gamblestack:$POSTGRES_PASSWORD@postgres:5432/gamblestack
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://gamblestack:$RABBITMQ_PASSWORD@rabbitmq:5672
JWT_PRIVATE_KEY=$JWT_SECRET
JWT_PUBLIC_KEY=$JWT_SECRET
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://$DOMAIN
REAL_MONEY_ENABLED=false
PAYMENTS_ENABLED=false
EOF
  chmod 600 "$APP/.env"
fi

set -a
. "$APP/.env"
set +a

# 6. Create an isolated DNS-free Podman network, then start private infrastructure.
log "Preparing DNS-free Gamblestack Podman network"

# Remove only failed/stale Gamblestack containers from earlier attempts.
for c in \
  gamblestack-postgres gamblestack-redis gamblestack-rabbitmq \
  gamblestack-auth gamblestack-wallet gamblestack-sportsbook \
  gamblestack-games gamblestack-api gamblestack-web
do
  podman rm -f "$c" >/dev/null 2>&1 || true
done

# cPanel/hosting DNS may own port 53 on the host.  Do not stop it.
# Disable Aardvark DNS for this network and use fixed private service IPs.
podman network rm -f gamblestack_default >/dev/null 2>&1 || true
podman network rm -f gamblestack-net >/dev/null 2>&1 || true

podman network create \
  --disable-dns \
  --subnet 10.203.77.0/24 \
  --gateway 10.203.77.1 \
  gamblestack-net >/dev/null

echo "[PASS] Created DNS-free gamblestack-net on 10.203.77.0/24"

podman run --rm \
  --network gamblestack-net \
  docker.io/library/alpine:3.20 \
  true >/dev/null 2>&1 \
  || die "DNS-free Gamblestack network could not start a test container."

echo "[PASS] DNS-free network startup test"

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^$key=" "$APP/.env"; then
    sed -i "s|^$key=.*|$key=$value|" "$APP/.env"
  else
    printf '%s=%s\n' "$key" "$value" >> "$APP/.env"
  fi
}

upsert_env DATABASE_URL "postgres://gamblestack:$POSTGRES_PASSWORD@10.203.77.10:5432/gamblestack"
upsert_env REDIS_URL "redis://10.203.77.11:6379"
upsert_env RABBITMQ_URL "amqp://gamblestack:$RABBITMQ_PASSWORD@10.203.77.12:5672"
upsert_env AUTH_URL "http://10.203.77.21:4001"
upsert_env WALLET_URL "http://10.203.77.22:4002"
upsert_env SPORTSBOOK_URL "http://10.203.77.23:4003"
upsert_env GAMES_URL "http://10.203.77.24:4004"

chmod 600 "$APP/.env"

# Reload the corrected environment into this installer process.
set -a
. "$APP/.env"
set +a

log "Starting PostgreSQL, Redis and RabbitMQ"

compose up -d postgres redis rabbitmq

for i in $(seq 1 40); do
  if podman exec gamblestack-postgres pg_isready -U gamblestack -d gamblestack >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

podman exec gamblestack-postgres pg_isready -U gamblestack -d gamblestack >/dev/null 2>&1 \
  || die "PostgreSQL did not become ready."

log "Applying database migrations"

podman exec gamblestack-postgres psql -U gamblestack -d gamblestack -v ON_ERROR_STOP=1 \
  -c 'CREATE TABLE IF NOT EXISTS gamblestack_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());' \
  >/dev/null

for f in "$APP"/infra/migrations/*.sql; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  applied="$(podman exec gamblestack-postgres psql -U gamblestack -d gamblestack -tAc \
    "SELECT count(*) FROM gamblestack_migrations WHERE filename='$name';")"

  if [ "$applied" = "0" ]; then
    echo "  -> $name"
    podman exec -i gamblestack-postgres psql -U gamblestack -d gamblestack -v ON_ERROR_STOP=1 < "$f"
    podman exec gamblestack-postgres psql -U gamblestack -d gamblestack -v ON_ERROR_STOP=1 \
      -c "INSERT INTO gamblestack_migrations(filename) VALUES ('$name');" >/dev/null
  else
    echo "  -> $name [already applied]"
  fi
done

# 7. Build and start application services.
log "Building and starting Gamblestack"

compose up -d --build

# 8. Wait for local services.
log "Waiting for API and web"

API_READY=0
WEB_READY=0

for i in $(seq 1 60); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${API_BIND_PORT}/health" >/dev/null 2>&1; then
    API_READY=1
  fi
  if curl -fsS --max-time 3 "http://127.0.0.1:${WEB_BIND_PORT}/" >/dev/null 2>&1; then
    WEB_READY=1
  fi
  if [ "$API_READY" = "1" ] && [ "$WEB_READY" = "1" ]; then
    break
  fi
  sleep 2
done

if [ "$API_READY" != "1" ] || [ "$WEB_READY" != "1" ]; then
  echo
  echo "=== CONTAINER STATUS ==="
  podman ps -a --filter name=gamblestack
  echo
  echo "=== API LOGS ==="
  podman logs --tail 120 gamblestack-api 2>/dev/null || true
  echo
  echo "=== WEB LOGS ==="
  podman logs --tail 120 gamblestack-web 2>/dev/null || true
  die "Gamblestack did not become healthy."
fi

echo "[PASS] API http://127.0.0.1:${API_BIND_PORT}/health"
echo "[PASS] Web http://127.0.0.1:${WEB_BIND_PORT}/"

# 9. Persist the complete stack through systemd.
log "Creating systemd service"

cat > /usr/local/sbin/gamblestack-compose <<EOF
#!/usr/bin/env bash
set -e
cd "$APP"
EOF

if [ "$COMPOSE_KIND" = "podman-compose-plugin" ]; then
  cat >> /usr/local/sbin/gamblestack-compose <<EOF
exec "$(command -v podman)" compose -f "$COMPOSE_FILE" "\$@"
EOF
else
  cat >> /usr/local/sbin/gamblestack-compose <<EOF
exec "$(command -v podman-compose)" -f "$COMPOSE_FILE" "\$@"
EOF
fi

chmod 750 /usr/local/sbin/gamblestack-compose

cat > /etc/systemd/system/gamblestack.service <<EOF
[Unit]
Description=Tidalwave Gamblestack
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP
ExecStart=/usr/local/sbin/gamblestack-compose up -d
ExecStop=/usr/local/sbin/gamblestack-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable gamblestack.service >/dev/null

# 10. Apache reverse proxy.
log "Configuring Apache reverse proxy"

mkdir -p "$ACME_ROOT/.well-known/acme-challenge"

if command -v a2enmod >/dev/null 2>&1; then
  a2enmod proxy proxy_http headers ssl >/dev/null 2>&1 || true
fi

if [ -d /etc/apache2/conf.d ]; then
  APACHE_CONF="/etc/apache2/conf.d/tidalwave-gamblestack.conf"
  APACHE_SERVICE="httpd"
elif [ -d /etc/httpd/conf.d ]; then
  APACHE_CONF="/etc/httpd/conf.d/tidalwave-gamblestack.conf"
  APACHE_SERVICE="httpd"
elif [ -d /etc/apache2/sites-available ]; then
  APACHE_CONF="/etc/apache2/sites-available/tidalwave-gamblestack.conf"
  APACHE_SERVICE="apache2"
else
  die "Apache configuration directory was not found."
fi

cat > "$APACHE_CONF" <<EOF
<VirtualHost $SERVER_IP:80>
    ServerName $DOMAIN
    ProxyPreserveHost On
    ProxyRequests Off

    Alias /.well-known/acme-challenge/ "$ACME_ROOT/.well-known/acme-challenge/"
    <Directory "$ACME_ROOT/.well-known/acme-challenge/">
        Require all granted
    </Directory>
    ProxyPass /.well-known/acme-challenge/ !

    RequestHeader set X-Forwarded-Proto "http"

    ProxyPass        /api/ http://127.0.0.1:${API_BIND_PORT}/
    ProxyPassReverse /api/ http://127.0.0.1:${API_BIND_PORT}/

    ProxyPass        / http://127.0.0.1:${WEB_BIND_PORT}/
    ProxyPassReverse / http://127.0.0.1:${WEB_BIND_PORT}/
</VirtualHost>
EOF

if [ -d /etc/apache2/sites-enabled ] && [ "$APACHE_CONF" = "/etc/apache2/sites-available/tidalwave-gamblestack.conf" ]; then
  ln -sfn "$APACHE_CONF" /etc/apache2/sites-enabled/tidalwave-gamblestack.conf
fi

apachectl configtest
systemctl reload "$APACHE_SERVICE" 2>/dev/null || systemctl restart "$APACHE_SERVICE"

# 11. Best-effort TLS if certbot is already available.
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && command -v certbot >/dev/null 2>&1; then
  certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email || true
fi

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
  cat >> "$APACHE_CONF" <<EOF

<VirtualHost $SERVER_IP:443>
    ServerName $DOMAIN
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem

    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "https"

    ProxyPass        /api/ http://127.0.0.1:${API_BIND_PORT}/
    ProxyPassReverse /api/ http://127.0.0.1:${API_BIND_PORT}/

    ProxyPass        / http://127.0.0.1:${WEB_BIND_PORT}/
    ProxyPassReverse / http://127.0.0.1:${WEB_BIND_PORT}/
</VirtualHost>
EOF
  apachectl configtest
  systemctl reload "$APACHE_SERVICE" 2>/dev/null || systemctl restart "$APACHE_SERVICE"
fi

# 12. Final audit.
echo
echo "============================================================"
echo " GAMBLESTACK DEPLOYMENT COMPLETE"
echo "============================================================"
echo
echo "Git:"
git log -1 --oneline
echo
echo "Containers:"
podman ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'NAMES|gamblestack' || true
echo
echo "API:"
curl -fsS "http://127.0.0.1:${API_BIND_PORT}/health" || true
echo
echo
echo "Sportsbook:"
curl -fsS "http://127.0.0.1:${API_BIND_PORT}/sportsbook/markets" || true
echo
echo
echo "Public URL:"
echo "  http://$DOMAIN"
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "  https://$DOMAIN"
else
  echo "  HTTPS pending DNS/certificate configuration"
fi
echo
echo "Mode:"
echo "  REAL_MONEY_ENABLED=false"
echo "  PAYMENTS_ENABLED=false"
echo
echo "Useful commands:"
echo "  systemctl status gamblestack"
echo "  /usr/local/sbin/gamblestack-compose ps"
echo "  podman logs -f gamblestack-api"
echo "  podman logs -f gamblestack-web"
echo
echo "NOTE: This repository is an MVP. The included sportsbook markets and"
echo "casino engine are demos until licensed odds/game providers and the"
echo "necessary compliance/payment integrations are connected."
echo "============================================================"
