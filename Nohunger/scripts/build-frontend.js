const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "public", "index.html");
const mainJsPath = path.join(__dirname, "..", "public", "js", "main.js");

let html = fs.readFileSync(htmlPath, "utf8");
let mainJs = fs.readFileSync(mainJsPath, "utf8");

// config.js
const configJs = `/* API base URL - same as original monolithic file */
const API = "http://localhost:4000";
`;
fs.writeFileSync(path.join(__dirname, "..", "public", "js", "config.js"), configJs);

// Remove API line from main.js (now in config.js)
mainJs = mainJs.replace(/^const API = "http:\/\/localhost:4000";\n/, "");
fs.writeFileSync(path.join(__dirname, "..", "public", "js", "app.js"), mainJs);

// Remove first style block from HTML
html = html.replace(/<style>[\s\S]*?<\/style>\s*\n?<\/head>/, `<link rel="stylesheet" href="css/style.css" />\n</head>`);

// Remove donorPop inline style block
html = html.replace(/<!-- Animation -->\s*<style>[\s\S]*?<\/style>\s*\n?/, "");

// Remove main script block, add script tags before track modal
const scriptTags = `
<script src="js/config.js"></script>
<script src="js/app.js"></script>
`;

html = html.replace(/<script>[\s\S]*?<\/script>\s*\n<!-- TRACK ORDER MODAL -->/, scriptTags + "\n<!-- TRACK ORDER MODAL -->");

fs.writeFileSync(htmlPath, html);