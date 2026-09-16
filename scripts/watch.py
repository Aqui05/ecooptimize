#!/usr/bin/env python3
"""
Affiche en direct l'etat d'EcoOptimize (summary, noeuds, alertes) en
interrogeant l'API REST. Fonctionne que le backend tourne via Docker
(docker compose up) ou via ./scripts/dev_up.sh.

Usage : ./scripts/watch.py [--url http://localhost:4000] [--interval 3]
"""
import argparse
import json
import time
import urllib.error
import urllib.request

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"


def fetch(base_url, path):
    with urllib.request.urlopen(f"{base_url}{path}", timeout=5) as response:
        return json.loads(response.read())


def render(base_url):
    print("\033[2J\033[H", end="")  # clear screen
    print(f"{BOLD}{BLUE}EcoOptimize — tableau de bord temps reel{RESET}")
    print(f"{DIM}{time.strftime('%H:%M:%S')} · {base_url}{RESET}\n")

    try:
        summary = fetch(base_url, "/api/summary")
    except (urllib.error.URLError, ConnectionError):
        print(f"{RED}Backend injoignable sur {base_url}.{RESET}")
        print(f"{DIM}Lancez `docker compose up` ou `./scripts/dev_up.sh`.{RESET}")
        return

    print(f"{BOLD}Résumé{RESET}")
    print(f"  Production   : {GREEN}{summary['total_production_kw']:>6.1f} kW{RESET}")
    print(f"  Consommation : {YELLOW}{summary['total_consumption_kw']:>6.1f} kW{RESET}")
    balance = summary["balance_kw"]
    balance_color = GREEN if balance >= 0 else RED
    print(f"  Balance      : {balance_color}{balance:>6.1f} kW{RESET}")
    print(f"  Noeuds       : {summary['nodes_online']}/{summary['nodes_total']} en ligne\n")

    if summary["redistribution_suggestions"]:
        print(f"{BOLD}Suggestions de répartition{RESET}")
        for s in summary["redistribution_suggestions"]:
            print(f"  {s['from_node']} → {s['to_node']} : {s['suggested_kw']:.1f} kW")
        print()

    nodes = fetch(base_url, "/api/nodes")
    print(f"{BOLD}Noeuds{RESET}")
    for n in sorted(nodes, key=lambda x: x["node_id"]):
        status = f"{GREEN}en ligne{RESET}" if n["online"] else f"{DIM}hors ligne{RESET}"
        print(
            f"  {n['node_id']:<10} {status:<20} "
            f"prod {n['production_kw']:>5.1f} kW  conso {n['consumption_kw']:>5.1f} kW"
        )

    alerts = fetch(base_url, "/api/alerts")
    if alerts:
        print(f"\n{BOLD}Alertes récentes{RESET}")
        for a in alerts[:5]:
            print(f"  {RED}⚠{RESET}  {a['message']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:4000")
    parser.add_argument("--interval", type=float, default=3.0)
    parser.add_argument(
        "--duration", type=float, default=None,
        help="Arret automatique apres N secondes (pratique pour les démos/enregistrements).",
    )
    args = parser.parse_args()

    start_time = time.time()
    try:
        while True:
            render(args.url)
            if args.duration is not None and (time.time() - start_time) >= args.duration:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nArret.")


if __name__ == "__main__":
    main()
