/* =========================
   MATCH RULES (preserved from original)
========================= */
const MATCH_RULES = {
  donor: ["receiver", "ngo"],
  receiver: ["donor", "ngo"],
  ngo: ["donor", "receiver"]
};

const PORT = process.env.PORT || 4000;

module.exports = { MATCH_RULES, PORT };
