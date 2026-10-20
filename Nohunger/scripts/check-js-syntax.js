const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "uploads"]);
const files = [];

function collectJavaScript(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        collectJavaScript(path.join(directory, entry.name));
      }
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.join(directory, entry.name));
    }
  }
}

collectJavaScript(root);

let failures = 0;
for (const file of files) {
  try {
    new vm.Script(fs.readFileSync(file, "utf8"), { filename: path.relative(root, file) });
  } catch (error) {
    failures += 1;
    process.stderr.write(`${path.relative(root, file)}: ${error.message}\n`);
  }
}

process.stdout.write(`JavaScript syntax: ${files.length - failures} passed, ${failures} failed\n`);
if (failures > 0) process.exitCode = 1;
