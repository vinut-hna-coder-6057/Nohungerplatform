const fs = require("fs");
const path = require("path");

const jsDir = path.join(__dirname, "..", "public", "js");
const mainJs = fs.readFileSync(path.join(jsDir, "main.js"), "utf8");

const domMarker = 'document.addEventListener("DOMContentLoaded", ()=>{';
const domIndex = mainJs.indexOf(domMarker);

if (domIndex === -1) {
  console.error("DOMContentLoaded marker not found");
  process.exit(1);
}

// config.js
fs.writeFileSync(path.join(jsDir, "config.js"), `const API = "http://localhost:4000";\n`);

const coreHelpers = `window.escapeHtml = function(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

window.getAuthHeaders = function(options = {}) {
  const { json = true } = options;
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";
  const token = isAdmin
    ? sessionStorage.getItem("adminToken")
    : sessionStorage.getItem("token");
  if (token) headers["Authorization"] = \`Bearer \${token}\`;
  return headers;
};

`;

// core.js: helpers + socket init, state, showPage (everything before DOMContentLoaded)
const coreBlock = coreHelpers + mainJs
  .slice(mainJs.indexOf("const socket"), domIndex)
  .trim() + "\n";
fs.writeFileSync(path.join(jsDir, "core.js"), coreBlock);

// app.js: DOMContentLoaded wrapper only
const domBlock = mainJs.slice(domIndex).trim();
fs.writeFileSync(path.join(jsDir, "app.js"), domBlock + "\n");

// Update index.html
const htmlPath = path.join(__dirname, "..", "public", "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace(
  /<script src="js\/config\.js"><\/script>[\s\S]*?<script src="js\/app\.js"><\/script>/,
  `<script src="js/config.js"></script>
<script src="js/core.js"></script>
<script src="js/app.js"></script>`
);
fs.writeFileSync(htmlPath, html);
