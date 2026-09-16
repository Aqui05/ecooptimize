#!/bin/sh
# Arrete les processus demarres par dev_up.sh
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT_DIR/.dev-pids"

for name in broker backend simulator; do
  pidfile="$PID_DIR/$name.pid"
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      echo "==> $name arrete (pid $pid)"
    fi
    rm -f "$pidfile"
  fi
done

echo "Stack de developpement arretee."
