require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");

const db = require("./db");
const optimizer = require("./optimizer");

const PORT = process.env.PORT || 4000;
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const TOPIC = "ecooptimize/nodes/+/telemetry";

// Etat en memoire du dernier releve connu par noeud (utilise par l'API et
// l'optimiseur -- pas besoin d'aller relire la base a chaque requete).
const latestByNode = {};
let recentAlertsCache = [];

// Debounce des alertes : on ne persiste/notifie que sur un changement d'etat
// (ex: noeud qui devient "overload") plutot qu'a chaque message MQTT --
// sinon la meme alerte est ecrite en base plusieurs fois par seconde tant
// que la situation persiste.
const activeAlertTypeByNode = {};

async function start() {
  await db.init();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      db_driver: db.driver,
      mqtt_connected: mqttClient.connected,
      nodes_seen: Object.keys(latestByNode).length,
    });
  });

  app.get("/api/nodes", (req, res) => {
    res.json(Object.values(latestByNode));
  });

  app.get("/api/nodes/:id/history", async (req, res) => {
    const limit = Number(req.query.limit || 100);
    const history = await db.getHistory(req.params.id, limit);
    res.json(history);
  });

  app.get("/api/alerts", async (req, res) => {
    const alerts = await db.getRecentAlerts(50);
    res.json(alerts);
  });

  app.get("/api/summary", (req, res) => {
    const nodes = Object.values(latestByNode);
    const production = nodes.reduce((sum, n) => sum + (n.production_kw || 0), 0);
    const consumption = nodes.reduce((sum, n) => sum + (n.consumption_kw || 0), 0);
    const { suggestions } = optimizer.analyze(latestByNode);

    res.json({
      total_production_kw: Number(production.toFixed(2)),
      total_consumption_kw: Number(consumption.toFixed(2)),
      balance_kw: Number((production - consumption).toFixed(2)),
      redistribution_suggestions: suggestions,
      nodes_online: nodes.filter((n) => n.online).length,
      nodes_total: nodes.length,
    });
  });

  app.listen(PORT, () => {
    console.log(`[backend] API REST disponible sur http://localhost:${PORT}`);
  });

  // --- Connexion MQTT ---
  var mqttClient = mqtt.connect(MQTT_URL, { clientId: "ecooptimize-backend" });

  mqttClient.on("connect", () => {
    console.log(`[backend] connecte au broker MQTT (${MQTT_URL})`);
    mqttClient.subscribe(TOPIC, (err) => {
      if (err) console.error("[backend] echec abonnement MQTT:", err.message);
    });
  });

  mqttClient.on("message", async (topic, payloadBuffer) => {
    try {
      const reading = JSON.parse(payloadBuffer.toString());
      latestByNode[reading.node_id] = reading;

      await db.insertReading(reading);

      const { alerts } = optimizer.analyze(latestByNode);
      const newAlerts = alerts.filter((alert) => {
        const previousType = activeAlertTypeByNode[alert.node_id];
        activeAlertTypeByNode[alert.node_id] = alert.type;
        return previousType !== alert.type;
      });

      // Noeuds qui etaient en alerte et ne le sont plus : on efface leur
      // etat pour qu'une future recidive redeclenche bien une notification.
      const alertedNodeIds = new Set(alerts.map((a) => a.node_id));
      for (const nodeId of Object.keys(activeAlertTypeByNode)) {
        if (!alertedNodeIds.has(nodeId)) delete activeAlertTypeByNode[nodeId];
      }

      for (const alert of newAlerts) {
        await db.insertAlert(alert);
      }
      if (newAlerts.length > 0) recentAlertsCache = newAlerts;
    } catch (err) {
      console.error("[backend] message MQTT invalide:", err.message);
    }
  });

  mqttClient.on("error", (err) => {
    console.error("[backend] erreur MQTT:", err.message);
  });
}

start().catch((err) => {
  console.error("[backend] erreur au demarrage:", err);
  process.exit(1);
});
