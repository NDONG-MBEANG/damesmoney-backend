const admin = require("./lib/firebaseAdmin");

const db = admin.firestore();

/* ═══════════════════════════════════════════════════════════════
   RÉCEPTION DE LA CLÉ SECRÈTE — MyPVit envoie ici, en différé,
   la nouvelle clé après un appel à /renew-secret.

   Payload attendu :
   { "operation_account_code": "...", "secret_key": "sk_live_...", "expires_in": 3600 }

   URL publique à déclarer dans MyPVit (Paramétrages → Urls →
   type "Réception de clé secrète") :
   https://damesmoney.netlify.app/.netlify/functions/recevoirCleSecrete
   ═══════════════════════════════════════════════════════════════ */

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { secret_key, expires_in } = JSON.parse(event.body || "{}");
    if (!secret_key || !expires_in) {
      return { statusCode: 400, body: JSON.stringify({ erreur: "secret_key ou expires_in manquant" }) };
    }

    await db.collection("config").doc("mypvit").set({
      secret: secret_key,
      expireLe: Date.now() + expires_in * 1000,
      recu_le: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { statusCode: 200, body: JSON.stringify({ recu: true }) };
  } catch (erreur) {
    console.error("Erreur réception clé secrète MyPVit :", erreur);
    return { statusCode: 500, body: JSON.stringify({ erreur: "Erreur serveur" }) };
  }
};
