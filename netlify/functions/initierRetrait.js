const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const admin = require("./lib/firebaseAdmin");
const { config, obtenirCleSecrete, verifierAuth } = require("./lib/mypvit");

const db = admin.firestore();

/* ═══════════════════════════════════════════════════════════════
   INITIER UN RETRAIT — appelé "GIVE_CHANGE" (rendu de monnaie)
   côté MyPVit. C'est SYNCHRONE : MyPVit répond directement
   SUCCESS ou FAILED, pas de webhook à attendre.
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

  const userRef = db.collection("users").doc(uid);
  const reference = uuidv4().replace(/-/g, "").slice(0, 13);

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      const solde = doc.data().solde || 0;
      if (solde < montant) {
        const erreur = new Error("Solde insuffisant.");
        erreur.statusCode = 400;
        throw erreur;
      }
      t.update(userRef, { solde: admin.firestore.FieldValue.increment(-montant) });
    });
  } catch (erreur) {
    return { statusCode: erreur.statusCode || 500, body: JSON.stringify({ erreur: erreur.message }) };
  }

  await db.collection("transactions").doc(reference).set({
    uid,
    type: "retrait",
    montant,
    statut: "en_cours",
    telephone,
    operateur,
    cree_le: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    const { accountCode, urlC
