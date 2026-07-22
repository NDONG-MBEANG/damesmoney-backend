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
    const { accountCode, restUrlCode } = config();
    const secret = await obtenirCleSecrete();

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
        callback_url_code: "",
        customer_account_number: telephone,
        merchant_operation_account_code: accountCode,
        transaction_type: "GIVE_CHANGE",
        owner_charge: "MERCHANT",
        owner_charge_operator: "MERCHANT",
        free_info: "Retrait wallet",
        product: "RETRAIT WALLET",
        operator_code: operateur,
        reference,
        service: "RESTFUL",
      }),
    });

    const resultat = await reponse.json();

    if (resultat.status === "SUCCESS") {
      await db.collection("transactions").doc(reference).update({ statut: "reussi" });
      return { statusCode: 200, body: JSON.stringify({ succes: true, message: "Retrait effectué avec succès." }) };
    } else {
      await userRef.update({ solde: admin.firestore.FieldValue.increment(montant) });
      await db.collection("transactions").doc(reference).update({ statut: "echec" });
      return { statusCode: 500, body: JSON.stringify({ erreur: resultat.message || "Échec du retrait, solde recrédité." }) };
    }
  } catch (erreur) {
    await userRef.update({ solde: admin.firestore.FieldValue.increment(montant) });
    await db.collection("transactions").doc(reference).update({ statut: "echec" });
    return { statusCode: 500, body: JSON.stringify({ erreur: "Erreur lors du retrait, solde recrédité." }) };
  }
};
