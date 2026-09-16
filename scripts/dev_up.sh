#!/bin/sh
# Lance tout le stack EcoOptimize en local, SANS Docker :
# broker MQTT embarque + backend (stockage memoire) + simulateur.
# Pratique pour developper/demontrer rapidement. Pour la vraie stack
# (MySQL, Mosquitto reel), utiliser `docker compose up --build`.
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT_DIR/.dev-pids"
mkdir -p "$PID_DIR"

echo "==> Installation des dependances (si besoin)..."
(cd "$ROOT_DIR/scripts" && npm install --no-audit --no-fund --silent)
(cd "$ROOT_DIR/backend" && npm install --no-audit --no-fund --silent)

echo "==> Demarrage du broker MQTT de developpement..."
setsid nohup node "$ROOT_DIR/scripts/dev_broker.js" > "$ROOT_DIR/.dev-broker.log" 2>&1 < /dev/null &
echo $! > "$PID_DIR/broker.pid"
sleep 1

echo "==> Demarrage du backend (stockage memoire)..."
(cd "$ROOT_DIR/backend" && \
  setsid nohup env DB_DRIVER=memory MQTT_URL=mqtt://localhost:1883 PORT=4000 \
  node src/index.js > "$ROOT_DIR/.dev-backend.log" 2>&1 < /dev/null & echo $! > "$PID_DIR/backend.pid")
sleep 1

echo "==> Demarrage du simulateur..."
(cd "$ROOT_DIR/simulator" && \
  setsid nohup env MQTT_HOST=localhost MQTT_PORT=1883 NODE_COUNT=4 PUBLISH_INTERVAL_SECONDS=2 \
  python3 simulate.py > "$ROOT_DIR/.dev-simulator.log" 2>&1 < /dev/null & echo $! > "$PID_DIR/simulator.pid")

echo ""
echo "Stack demarree. API disponible sur http://localhost:4000"
echo "Voir les donnees en direct : ./scripts/watch.py"
echo "Arreter le stack           : ./scripts/dev_down.sh"
