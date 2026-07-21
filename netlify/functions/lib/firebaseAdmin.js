const admin = require("firebase-admin");

/* ═══════════════════════════════════════════════════════════════
   INITIALISATION FIREBASE ADMIN — sur Netlify, il n'y a pas
   d'identifiants automatiques comme sur Firebase Functions.
   On utilise une clé de compte de service, stockée en entier
   (le JSON complet) dans la variable d'environnement Netlify
   FIREBASE_SERVICE_ACCOUNT_JSON.

   Comment l'obtenir (gratuit, ne nécessite PAS le plan Blaze) :
   Firebase Console → ⚙️ Paramètres du projet → Comptes de service
   → "Générer une nouvelle clé privée" → un fichier .json est
   téléchargé → colle tout son contenu dans la variable Netlify.
   ═══════════════════════════════════════════════════════════════ */

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON manquant. Ajoute cette variable d'environnement dans Netlify (Site settings → Environment variables)."
    );
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
