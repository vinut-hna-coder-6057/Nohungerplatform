/**
 * Generate a bcrypt hash for ADMIN_PASSWORD_HASH in .env
 * Usage: node scripts/hash-admin-password.js yourPassword
 */
require("dotenv").config();
const bcrypt = require("bcrypt");

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hash-admin-password.js <password>");
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log("Add this to your .env file:");
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
});
