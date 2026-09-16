// Broker MQTT minimal, uniquement pour le developpement local sans Docker.
// En production (docker-compose.yml), c'est Mosquitto qui est utilise --
// ce script n'est qu'une commodite pour iterer vite sur le backend/simulateur.
const aedes = require("aedes")();
const server = require("net").createServer(aedes.handle);

const PORT = process.env.MQTT_PORT || 1883;
server.listen(PORT, () => {
  console.log(`[dev-broker] broker MQTT de developpement sur le port ${PORT}`);
});
