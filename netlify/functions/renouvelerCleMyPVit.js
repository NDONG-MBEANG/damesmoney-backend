const { schedule } = require("@netlify/functions");
const { declencherRenouvellement } = require("./lib/mypvit");

/* ═══════════════════════════════════════════════════════════════
   RENOUVELLEMENT AUTOMATIQUE — la clé expire toutes les 3600s
   (1h). On la renouvelle toutes les 30 min pour garder une marge
   de sécurité confortable.
   ═══════════════════════════════════════════════════════════════ */

const handlerDeBase = async function () {
  await declencherRenouvellement();
  console.log("Renouvellement de la clé secrète MyPVit déclenché.");
  return { statusCode: 200 };
};

exports.handler = schedule("*/30 * * * *", handlerDeBase);
