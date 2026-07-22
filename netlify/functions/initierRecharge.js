const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const admin = require("./lib/firebaseAdmin");
const { config, obtenirCleSecrete, verifierAuth } = require("./lib/mypvit");

const db = admin.firestore();

/* ═══════════════════════════════════════════════════════════════
   INITIER UNE RECHARGE — le client demande à créditer son solde.
   ═══════════════════════════════════════════════════════════════ */

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let decoded;
  try {
    decoded = await verifierAuth(event);
  } catch (erreur) {
    return { statusCode: erreur.statusCode || 401, body: JSON.stringify({ erreur: erreur.message }) };
  }
  const uid = decoded.uid;

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ erreur: "JSON invalide" }) };
  }

  const { montant, telephone, operateur } = data;

  if (!montant || montant <= 150) {
    return { statusCode: 400, body: JSON.stringify({ erreur: "Montant invalide (minimum 151 XAF)." }) };
  }
  if (!telephone || !operateur) {
    return { statusCode: 400, body: JSON.stringify({ erreur: "Téléphone et opérateur requis." }) };
  }

  const { accountCode, restUrlCode, callbackCode } = config();

  let secret;
  try {
    secret = await obtenirCleSecrete();
  } catch (e) {
    return { statusCode: 503, body: JSON.stringify({ erreur: e.message }) };
  }

  const reference = uuidv4().replace(/-/g, "").slice(0, 13);

  await db.collection("transactions").doc(reference).set({
    uid,
    type: "recharge",
    montant,
    statut: "en_attente",
    telephone,
    operateur,
    cree_le: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    const reponse = await fetch(`https://api.mypvit.pro/${restUrlCode}/rest`, {
      method: "POST",
      headers: {
        "X-Secret": secret,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent: "DAMES-APP",
        amount: montant,
        callback_url_code: callbackCode,
        customer_account_number: telephone,
        merchant_operation_account_code: accountCode,
        transaction_type: "PAYMENT",
        owner_charge: "CUSTOMER",
        owner_charge_operator: "CUSTOMER",
        free_info: "Recharge wallet Dames Mise Réelle",
        product: "RECHARGE WALLET",
        operator_code: operateur,
        reference,
        service: "RESTFUL",
      }),
    });

    const resultat = await reponse.json();

    if (resultat.status !== "PENDING") {
      await db.collection("transactions").doc(reference).update({ statut: "echec_initiation" });
      return { statusCode: 500, body: JSON.stringify({ erreur: resultat.message || "Échec de l'initiation du paiement." }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        reference,
        message: "Demande envoyée. Valide le paiement sur ton téléphone (notification Airtel/Moov Money).",
      }),
    };
  } catch (erreur) {
    await db.collection("transactions").doc(reference).update({ statut: "echec_initiation" });
    return { statusCode: 500, body: JSON.stringify({ erreur: "Erreur réseau vers MyPVit." }) };
  }
};
