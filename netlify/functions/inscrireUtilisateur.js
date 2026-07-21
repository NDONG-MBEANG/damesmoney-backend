const admin = require("./lib/firebaseAdmin");
const { verifierAuth } = require("./lib/mypvit");

const db = admin.firestore();

/* ═══════════════════════════════════════════════════════════════
   INSCRIPTION — crée le document users/{uid} et vérifie que le
   numéro de téléphone n'est pas déjà utilisé par un autre compte.
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

  const { telephone, nom } = data;
  if (!telephone || !nom) {
    return { statusCode: 400, body: JSON.stringify({ erreur: "Téléphone et nom requis." }) };
  }

  const existant = await db.collection("users")
    .where("telephone", "==", telephone)
    .limit(1)
    .get();

  if (!existant.empty) {
    return { statusCode: 409, body: JSON.stringify({ erreur: "Ce numéro est déjà associé à un compte." }) };
  }

  await db.collection("users").doc(uid).set({
    telephone,
    nom,
    email: decoded.email || null,
    solde: 0,
    solde_reserve: 0,
    statut: "actif",
    sous_surveillance: false,
    parties_jouees: 0,
    parties_gagnees: 0,
    cree_le: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { statusCode: 200, body: JSON.stringify({ succes: true }) };
};
