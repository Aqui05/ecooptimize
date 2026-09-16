// Couche d'acces aux donnees.
// DB_DRIVER=mysql  -> utilise MySQL (docker-compose), pour la vraie stack distribuee
// DB_DRIVER=memory -> stockage en memoire, pratique pour tester en local sans Docker

const DRIVER = process.env.DB_DRIVER || "memory";

let pool = null;

// MySQL DATETIME attend "YYYY-MM-DD HH:MM:SS", pas de l'ISO 8601
// ("2026-09-14T08:08:43.364Z") -- d'ou l'erreur "Incorrect datetime value".
function toMysqlDatetime(isoString) {
  return new Date(isoString).toISOString().slice(0, 19).replace("T", " ");
}

async function initMysql() {
  const mysql = require("mysql2/promise");
  pool = await mysql.createPool({
    host: process.env.DB_HOST || "mysql",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "ecooptimize",
    password: process.env.DB_PASSWORD || "ecooptimize",
    database: process.env.DB_NAME || "ecooptimize",
    waitForConnections: true,
    connectionLimit: 10,
  });
}

// --- Stockage memoire (mode dev) ---
const memory = {
  readings: [], // { node_id, timestamp, online, production_kw, consumption_kw, distributed_kw }
  alerts: [],   // { node_id, timestamp, type, message }
};

async function init() {
  if (DRIVER === "mysql") {
    await initMysql();
  }
}

async function insertReading(reading) {
  if (DRIVER === "mysql") {
    await pool.execute(
      `INSERT INTO readings (node_id, ts, online, production_kw, consumption_kw, distributed_kw)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        reading.node_id,
        toMysqlDatetime(reading.timestamp),
        reading.online ? 1 : 0,
        reading.production_kw,
        reading.consumption_kw,
        reading.distributed_kw,
      ]
    );
  } else {
    memory.readings.push(reading);
    if (memory.readings.length > 5000) memory.readings.shift();
  }
}

async function insertAlert(alert) {
  if (DRIVER === "mysql") {
    await pool.execute(
      `INSERT INTO alerts (node_id, ts, type, message) VALUES (?, ?, ?, ?)`,
      [alert.node_id, toMysqlDatetime(alert.timestamp), alert.type, alert.message]
    );
  } else {
    memory.alerts.push(alert);
    if (memory.alerts.length > 500) memory.alerts.shift();
  }
}

async function getHistory(nodeId, limit = 100) {
  if (DRIVER === "mysql") {
    const [rows] = await pool.execute(
      `SELECT node_id, ts AS timestamp, online, production_kw, consumption_kw, distributed_kw
       FROM readings WHERE node_id = ? ORDER BY ts DESC LIMIT ?`,
      [nodeId, limit]
    );
    return rows;
  }
  return memory.readings
    .filter((r) => r.node_id === nodeId)
    .slice(-limit)
    .reverse();
}

async function getRecentAlerts(limit = 50) {
  if (DRIVER === "mysql") {
    const [rows] = await pool.execute(
      `SELECT node_id, ts AS timestamp, type, message FROM alerts
       ORDER BY ts DESC LIMIT ?`,
      [limit]
    );
    return rows;
  }
  return memory.alerts.slice(-limit).reverse();
}

module.exports = {
  driver: DRIVER,
  init,
  insertReading,
  insertAlert,
  getHistory,
  getRecentAlerts,
};
