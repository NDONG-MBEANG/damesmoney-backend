const admin = require("./lib/firebaseAdmin");

const db = admin.firestore();

/* ═══════════════════════════════════════════════════════════════
   WEBHOOK MYPVIT — reçoit la confirmation finale d'une transaction
   (SUCCESS ou FAILED) et crédite le solde du joueur si succès.

   URL publique à déclarer dans MyPVit (type "Callback") :
   https://damesmoney.netlify.app/.netlify/functions/callbackMyPVit
   ═══════════════════════════════════════════════════════════════ */

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ erreur: "JSON invalide" }) };
  }

  const { merchantReferenceId, status, amount, transactionId, code } = payload;

  try {
    if (!merchantReferenceId) {
      return { statusCode: 400, body: JSON.stringify({ transactionId, responseCode: code }) };
    }

    const ref = db.collection("transactions").doc(merchantReferenceId);
    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) return;
      const donnees = doc.data();

      if (donnees.statut === "reussi" || donnees.statut === "echec") return;

      if (status === "SUCCESS") {
        const userRef = db.collection("users").doc(donnees.uid);
        t.update(userRef, { solde: admin.firestore.FieldValue.increment(amount) });
        t.update(ref, { statut: "reussi", transactionIdMypvit: transactionId, traite_le: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        t.update(ref, { statut: "echec", transactionIdMypvit: transactionId, traite_le: admin.firestore.FieldValue.serverTimestamp() });
      }
    });

    return { statusCode: 200, body: JSON.stringify({ transactionId, responseCode: code }) };
  } catch (erreur) {
    console.error("Erreur callback MyPVit :", erreur);
    return { statusCode: 200, body: JSON.stringify({ transactionId, responseCode: code }) };
  }
};
