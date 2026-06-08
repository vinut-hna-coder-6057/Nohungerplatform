const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "public", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

// First <style> block (main styles)
const firstStyle = html.match(/<style>\s*([\s\S]*?)<\/style>/);
if (firstStyle) {
  fs.writeFileSync(
    path.join(__dirname, "..", "public", "css", "style.css"),
    firstStyle[1].trim() + "\n"
  );
}

// donorPop animation (second small style block before activity page)
const donorPopStyle = html.match(
  /<!-- Animation -->\s*<style>\s*([\s\S]*?)<\/style>/
);
if (donorPopStyle) {
  const cssPath = path.join(__dirname, "..", "public", "css", "style.css");
  fs.appendFileSync(cssPath, "\n" + donorPopStyle[1].trim() + "\n");
  
}

// Main script block
const scriptMatch = html.match(
  /<script>\s*([\s\S]*?)<\/script>\s*\n<!-- TRACK ORDER MODAL -->/
);
if (scriptMatch) {
  fs.writeFileSync(
    path.join(__dirname, "..", "public", "js", "main.js"),
    scriptMatch[1].trim() + "\n"
  );
  
} else {
  console.error("Script block not found");
  process.exit(1);
}
