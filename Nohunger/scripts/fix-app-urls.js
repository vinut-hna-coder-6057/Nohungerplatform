const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "public", "js", "app.js");
let code = fs.readFileSync(appPath, "utf8");

const fixes = [
  ['fetch("/api/admin/stats"', 'fetch(`${API}/api/admin/stats`'],
  ['fetch("/api/admin/donations"', 'fetch(`${API}/api/admin/donations`'],
  ['fetch("/api/admin/users"', 'fetch(`${API}/api/admin/users`'],
  ['fetch(`/api/admin/users`)', 'fetch(`${API}/api/admin/users`, { headers: getAuthHeaders({ json: false }) })'],
  ["openUserPopup('${escapeHtml(x._id)}')\"\"", "openUserPopup('${escapeHtml(x._id)}')\""],
  ["updateRequest('${'${escapeHtml(n.requestId)}'}'", "updateRequest('${escapeHtml(n.requestId)}'"],
];

for (const [from, to] of fixes) {
  code = code.split(from).join(to);
}

fs.writeFileSync(appPath, code);
