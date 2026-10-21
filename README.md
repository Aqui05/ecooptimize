# EcoOptimize

Prototype de plateforme IoT pour suivre en temps réel la production, la
distribution et la consommation d'énergie verte dans un réseau local de
noeuds connectés, et suggérer une répartition de l'énergie entre ces noeuds.

## Démo

[![Démo EcoOptimize](demo/demo.svg)](demo/demo.svg)

Le tableau de bord en terminal (`scripts/watch.py`) interroge l'API en
direct : production et consommation totales, état de chaque noeud, alertes
de surcharge et suggestions de répartition.

## Architecture

```
[simulateur Python] --MQTT--> [broker Mosquitto] --MQTT--> [backend Node.js]
     (4 noeuds simulés,                                          |
      pannes/pics aléatoires)                          stocke dans MySQL
                                                                   |
                                                          détecte les surcharges
                                                          et propose une répartition
                                                          (src/optimizer.js)
                                                                   |
                                                           expose une API REST
                                                              /       \
                                                  scripts/watch.py   app Flutter
                                                  (terminal, démo)   (mobile)
```

| Dossier              | Rôle                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simulator/`         | Simule plusieurs noeuds (sites de production/consommation d'énergie), publie des mesures périodiques via MQTT, avec pannes et pics de charge aléatoires |
| `broker/`            | Configuration Mosquitto (broker MQTT, utilisé par Docker)                                                                                               |
| `backend/`           | Microservice Node.js : ingestion MQTT, persistance MySQL, détection de surcharge, suggestions de répartition, API REST                                  |
| `docker-compose.yml` | Orchestration complète (broker + MySQL + backend + simulateur)                                                                                          |
| `scripts/`           | Outils de développement : lancer la pile sans Docker, afficher les données en direct                                                                    |
| `demo/`              | Enregistrement de la démo (asciicast + SVG animé)                                                                                                       |

L'application mobile (tableau de bord et historique par noeud) qui
consomme cette API est dans un dépôt séparé :
[ecooptimize_mobile](https://github.com/Aqui05/ecooptimize_mobile).

## API REST

| Route                                  | Description                                                               |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `GET /health`                          | État du service (connexion MQTT, base de données)                         |
| `GET /api/nodes`                       | Dernier état connu de chaque noeud                                        |
| `GET /api/nodes/:id/history?limit=100` | Historique d'un noeud                                                     |
| `GET /api/alerts`                      | Alertes récentes (surcharge, noeud hors ligne)                            |
| `GET /api/summary`                     | Production/consommation totales + suggestions de répartition entre noeuds |

## Lancer le projet

### Avec Docker (pile complète : Mosquitto + MySQL)

```
docker compose up --build
curl http://localhost:4000/api/summary
```

### Sans Docker (développement rapide)

Un broker MQTT embarqué et un stockage en mémoire, pour itérer sans
dépendance externe :

```
./scripts/dev_up.sh      # démarre broker + backend + simulateur
./scripts/watch.py       # tableau de bord en direct dans le terminal
./scripts/dev_down.sh    # arrête tout
```

## Résilience

- **Pannes de noeuds** : le simulateur met aléatoirement des noeuds hors
  ligne ; le backend le détecte et le signale (`node_offline`) sans s'arrêter.
- **Alertes sans répétition** : une alerte n'est émise qu'au changement
  d'état (par exemple le passage en surcharge), pas à chaque message MQTT.
- **API tolérante** : `/api/summary`, `/api/nodes` et `/api/alerts` sont
  interrogés indépendamment côté client ; l'échec d'un endpoint n'empêche pas
  d'afficher les autres.


## Reproduire la démo

```
pip install asciinema
./scripts/dev_up.sh
asciinema rec -c "python3 scripts/watch.py --interval 3 --duration 20" demo/demo.cast
npx svg-term-cli --in demo/demo.cast --out demo/demo.svg --window --no-cursor
```

## Auteur

Aquilas KIKISSAGBE — [@Aqui05](https://github.com/Aqui05)
