const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "public", "index.html");
let html = fs.readFileSync(htmlPath, "utf8");

html = html.replace(
  /<script src="js\/config\.js"><\/script>[\s\S]*?<script src="js\/app\.js"><\/script>/,
  `<script src="js/config.js"></script>
<script src="js/app.js"></script>`
);

fs.writeFileSync(htmlPath, html);
