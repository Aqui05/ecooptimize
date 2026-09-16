"""
EcoOptimize - Simulateur de capteurs energetiques
Publie periodiquement des mesures de production, consommation et distribution
d'energie verte pour plusieurs noeuds (sites), via MQTT.
"""
import json
import os
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
PUBLISH_INTERVAL_SECONDS = float(os.getenv("PUBLISH_INTERVAL_SECONDS", "2"))
NODE_COUNT = int(os.getenv("NODE_COUNT", "4"))

TOPIC_TEMPLATE = "ecooptimize/nodes/{node_id}/telemetry"

# Chaque noeud simule un petit site de production (solaire/eolien) avec sa
# propre charge de consommation locale. On ajoute un bruit aleatoire et,
# occasionnellement, un pic de consommation pour declencher la logique
# d'optimisation cote backend.


class SensorNode:
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.base_production = random.uniform(3.0, 8.0)   # kW
        self.base_consumption = random.uniform(2.0, 6.0)  # kW
        self.online = True

    def read(self) -> dict:
        # Panne aleatoire rare (~2%) pour illustrer la tolerance aux pannes
        if random.random() < 0.02:
            self.online = not self.online

        production = max(0.0, self.base_production + random.uniform(-1.0, 1.0))
        consumption = max(0.0, self.base_consumption + random.uniform(-0.5, 1.5))

        # Pic de charge occasionnel (~5%) pour tester la detection de surcharge
        if random.random() < 0.05:
            consumption += random.uniform(3.0, 6.0)

        return {
            "node_id": self.node_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "online": self.online,
            "production_kw": round(production, 2),
            "consumption_kw": round(consumption, 2),
            "distributed_kw": round(min(production, consumption), 2),
        }


def build_client() -> mqtt.Client:
    client = mqtt.Client(client_id="ecooptimize-simulator", protocol=mqtt.MQTTv311)
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
    return client


def main():
    nodes = [SensorNode(f"node-{i+1}") for i in range(NODE_COUNT)]
    client = build_client()
    client.loop_start()

    print(f"[simulator] publishing {NODE_COUNT} nodes to {MQTT_HOST}:{MQTT_PORT} "
          f"every {PUBLISH_INTERVAL_SECONDS}s")

    try:
        while True:
            for node in nodes:
                payload = node.read()
                topic = TOPIC_TEMPLATE.format(node_id=node.node_id)
                client.publish(topic, json.dumps(payload), qos=1)
            time.sleep(PUBLISH_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
