const fetch = require("node-fetch");
const admin = require("./firebaseAdmin");

const db = admin.firestore();

/* ═══════════════════════════════════════════════════════════════
   CONFIGURATION — à renseigner dans Netlify (Site settings →
   Environment variables) :

   MYPVIT_ACCOUNT_CODE
   MYPVIT_PASSWORD
   MYPVIT_URL_CODE
   MYPVIT_CALLBACK_CODE
   MYPVIT_RECEPTION_CODE
   ═══════════════════════════════════════════════════════════════ */

function config() {
  return {
    accountCode: process.env.MYPVIT_ACCOUNT_CODE,
    password: process.env.MYPVIT_PASSWORD,
    urlCode: process.env.MYPVIT_URL_CODE,
    callbackCode: process.env.MYPVIT_CALLBACK_CODE,
    receptionCode: process.env.MYPVIT_RECEPTION_CODE,
  };
}

/* ═══════════════════════════════════════════════════════════════
   CLÉ SECRÈTE — MyPVit ne renvoie PAS la clé directement en
   réponse à /renew-secret. Cet appel déclenche juste l'envoi ;
   la vraie clé arrive ensuite par webhook sur l'URL de réception
   (voir recevoirCleSecrete.js), qui la stocke ici dans Firestore.
   ═══════════════════════════════════════════════════════════════ */

async function declencherRenouvellement() {
  const { accountCode, urlCode, password, receptionCode } = config();

  const reponse = await fetch(`https://api.mypvit.pro/${urlCode}/renew-secret`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      operationAccountCode: accountCode,
      receptionUrlCode: receptionCode,
      password: password,
    }),
  });

  const resultat = await reponse.json();
  if (resultat.status_code !== "200") {
    throw new Error("Échec de la demande de renouvellement : " + JSON.stringify(resultat));
  }
  return resultat;
}

async functi
