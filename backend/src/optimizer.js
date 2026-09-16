// Logique d'optimisation simple pour EcoOptimize.
// Objectif pedagogique : illustrer une decision distribuee prise a partir
// de l'etat de plusieurs noeuds, pas un algorithme de recherche operationnelle
// complet (ca, c'est pour le M1 CNS :)).

const OVERLOAD_THRESHOLD_KW = 2.0; // consommation - production au-dela de ce seuil = surcharge

/**
 * @param {Object.<string, object>} latestByNode - dernier releve connu par noeud
 * @returns {{alerts: object[], suggestions: object[]}}
 */
function analyze(latestByNode) {
  const nodes = Object.values(latestByNode);
  const alerts = [];
  const suggestions = [];

  const deficits = []; // noeuds en surcharge (besoin d'energie)
  const surpluses = []; // noeuds avec de la marge disponible

  for (const node of nodes) {
    if (!node.online) {
      alerts.push({
        node_id: node.node_id,
        timestamp: new Date().toISOString(),
        type: "node_offline",
        message: `Le noeud ${node.node_id} ne repond plus.`,
      });
      continue;
    }

    const balance = node.production_kw - node.consumption_kw;
    if (balance < -OVERLOAD_THRESHOLD_KW) {
      const deficit = Math.abs(balance);
      deficits.push({ node_id: node.node_id, deficit });
      alerts.push({
        node_id: node.node_id,
        timestamp: new Date().toISOString(),
        type: "overload",
        message: `Surcharge detectee sur ${node.node_id} : deficit de ${deficit.toFixed(2)} kW.`,
      });
    } else if (balance > OVERLOAD_THRESHOLD_KW) {
      surpluses.push({ node_id: node.node_id, surplus: balance });
    }
  }

  // Appariement glouton simple : chaque noeud en deficit se voit proposer
  // le noeud en surplus le plus proche de son besoin.
  for (const d of deficits) {
    surpluses.sort((a, b) => b.surplus - a.surplus);
    const match = surpluses.find((s) => s.surplus > 0);
    if (match) {
      const transferred = Math.min(d.deficit, match.surplus);
      suggestions.push({
        from_node: match.node_id,
        to_node: d.node_id,
        suggested_kw: Number(transferred.toFixed(2)),
      });
      match.surplus -= transferred;
    }
  }

  return { alerts, suggestions };
}

module.exports = { analyze, OVERLOAD_THRESHOLD_KW };
