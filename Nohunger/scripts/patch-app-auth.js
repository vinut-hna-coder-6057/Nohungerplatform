const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "public", "js", "app.js");
let code = fs.readFileSync(appPath, "utf8");

// Standardize fetch headers to use JWT
code = code.replace(
  /headers:\s*\{\s*"Content-Type"\s*:\s*"application\/json"\s*\}/g,
  "headers: getAuthHeaders()"
);

code = code.replace(
  /headers:\s*\{\s*"Content-Type"\s*:\s*"application\/json",\s*\}/g,
  "headers: getAuthHeaders()"
);

// GET requests without body
code = code.replace(
  /await fetch\(`\$\{API\}\/api\/(profile|notifications|my-activity|admin\/stats|admin\/users|admin\/donations)[^`]*`\)/g,
  (match) => match.replace(")", ", { headers: getAuthHeaders({ json: false }) })")
);

code = code.replace(
  /await fetch\("http:\/\/localhost:4000\/api\/admin\/(stats|donations|users)[^"]*"\)/g,
  (match) => match.replace(")", ", { headers: getAuthHeaders({ json: false }) })")
);

code = code.replace(
  /await fetch\(`http:\/\/localhost:4000\/api\/admin\/delete-user\/\$\{id\}`,\{\s*method:"DELETE"\s*\}\)/g,
  'await fetch(`${API}/api/admin/delete-user/${id}`,{ method:"DELETE", headers: getAuthHeaders({ json: false }) })'
);

// Admin login success - store token
code = code.replace(
  /if\(data\.success\)\{\s*sessionStorage\.setItem\("isAdmin","true"\);/,
  `if(data.success){
      sessionStorage.setItem("isAdmin","true");
      if(data.token) sessionStorage.setItem("adminToken", data.token);`
);

// User login success - store token
code = code.replace(
  /sessionStorage\.setItem\("userEmail", email\.toLowerCase\(\)\.trim\(\)\);\s*alert\("✅ Login successful!"\);/,
  `sessionStorage.setItem("userEmail", email.toLowerCase().trim());
    if(data.token) sessionStorage.setItem("token", data.token);
    alert("✅ Login successful!");`
);

// Logout clears tokens
code = code.replace(
  /sessionStorage\.clear\(\);\s*location\.reload\(\);/,
  `sessionStorage.clear();
localStorage.removeItem("lockedRole");
localStorage.removeItem("locationValue");
location.reload();`
);

// Remove email from update-status body (server uses JWT)
code = code.replace(
  /body: JSON\.stringify\(\{\s*requestId,\s*status,\s*email: sessionStorage\.getItem\("userEmail"\)\s*\}\)/,
  "body: JSON.stringify({ requestId, status })"
);

// Remove email from notify body identity (server uses JWT) - keep other fields
code = code.replace(
  /body: JSON\.stringify\(\{\s*fromRole: role,\s*location: locationValue,\s*email: sessionStorage\.getItem\("userEmail"\),/,
  "body: JSON.stringify({ fromRole: role, location: locationValue,"
);

// registerRole - remove email from body
code = code.replace(
  /body: JSON\.stringify\(\{\s*email: sessionStorage\.getItem\("userEmail"\),\s*role: role,\s*location: locationValue\s*\}\)/,
  "body: JSON.stringify({ role: role, location: locationValue })"
);

// logout body - server uses JWT now
code = code.replace(
  /body: JSON\.stringify\(\{\s*email: sessionStorage\.getItem\("userEmail"\)\s*\}\)/,
  "body: JSON.stringify({})"
);

// XSS: escape server-sourced fields in notification templates (realtime handler)
code = code.replace(
  /<h4 style="margin:0 0 6px 0;">\$\{n\.message\}<\/h4>/g,
  '<h4 style="margin:0 0 6px 0;">${escapeHtml(n.message)}</h4>'
);
code = code.replace(
  /<p><b>👤 \$\{n\.donorName \|\| \(n\.senderEmail \|\| ""\)\.split\("@"\)\[0\] \|\| "User"\}<\/b><\/p>/g,
  '<p><b>👤 ${escapeHtml(n.donorName || (n.senderEmail || "").split("@")[0] || "User")}</b></p>'
);
code = code.replace(
  /<p><b>🍛 Item:<\/b> \$\{n\.foodItem \|\| "Not Provided"\}<\/b><\/p>/g,
  '<p><b>🍛 Item:</b> ${escapeHtml(n.foodItem || "Not Provided")}</p>'
);

// Fix food item lines (two patterns)
code = code.replace(
  /\$\{n\.foodItem \|\| "Not Provided"\}/g,
  '${escapeHtml(n.foodItem || "Not Provided")}'
);
code = code.replace(
  /\$\{n\.quantity \|\| "Not Provided"\}/g,
  '${escapeHtml(n.quantity || "Not Provided")}'
);
code = code.replace(
  /\$\{n\.location\}/g,
  '${escapeHtml(n.location)}'
);
code = code.replace(
  /\$\{n\.status\}/g,
  '${escapeHtml(n.status)}'
);
code = code.replace(
  /onclick="updateRequest\('\$\{n\.requestId\}'/g,
  `onclick="updateRequest('${'${escapeHtml(n.requestId)}'}'`.replace("${'${escapeHtml(n.requestId)}'}", "${escapeHtml(n.requestId)}")
);

// Simpler fix for requestId in onclick
code = code.replace(
  /updateRequest\('\$\{n\.requestId\}'/g,
  "updateRequest('${escapeHtml(n.requestId)}'"
);
code = code.replace(
  /openTracking\('\$\{n\.requestId\}'/g,
  "openTracking('${escapeHtml(n.requestId)}'"
);

// Bell notification box fields
code = code.replace(
  /\$\{n\.senderEmail \|\| "Unknown User"\}/g,
  '${escapeHtml(n.senderEmail || "Unknown User")}'
);
code = code.replace(
  /\$\{n\.foodItem \|\| "-"\}/g,
  '${escapeHtml(n.foodItem || "-")}'
);
code = code.replace(
  /\$\{n\.quantity \|\| "-"\}/g,
  '${escapeHtml(n.quantity || "-")}'
);
code = code.replace(
  /\$\{n\.foodType \|\| "-"\}/g,
  '${escapeHtml(n.foodType || "-")}'
);

// Profile fields
code = code.replace(
  /\$\{data\.name \|\| "-"\}/g,
  '${escapeHtml(data.name || "-")}'
);
code = code.replace(
  /\$\{data\.location \|\| "-"\}/g,
  '${escapeHtml(data.location || "-")}'
);
code = code.replace(
  /\$\{(data\.role \|\| "")\.toUpperCase\(\)\}/g,
  '${escapeHtml((data.role || "").toUpperCase())}'
);

// Admin user list
code = code.replace(
  /<b>\$\{x\.name \|\| "No Name"\}<\/b><br>\s*\$\{x\.email\}/g,
  '<b>${escapeHtml(x.name || "No Name")}</b><br>${escapeHtml(x.email)}'
);
code = code.replace(
  /Role: \$\{x\.role \|\| "-"\} \| 📍 \$\{x\.location \|\| "-"\}/g,
  'Role: ${escapeHtml(x.role || "-")} | 📍 ${escapeHtml(x.location || "-")}'
);
code = code.replace(
  /onclick="event\.stopPropagation\(\);deleteUser\('\$\{x\._id\}'\)/g,
  "onclick=\"event.stopPropagation();deleteUser('${escapeHtml(x._id)}')\""
);
code = code.replace(
  /onclick="openUserPopup\('\$\{x\._id\}'\)/g,
  "onclick=\"openUserPopup('${escapeHtml(x._id)}')\""
);

// Activity output
code = code.replace(
  /<b>\$\{d\.message\}<\/b><br>\s*📍 \$\{d\.location\}/g,
  '<b>${escapeHtml(d.message)}</b><br>📍 ${escapeHtml(d.location)}'
);
code = code.replace(
  /📌 Status: \$\{d\.status\}/g,
  '📌 Status: ${escapeHtml(d.status)}'
);

// Admin donations
code = code.replace(
  /<b style="font-size:15px;">🍛 \$\{x\.foodDetails\}<\/b>/g,
  '<b style="font-size:15px;">🍛 ${escapeHtml(x.foodDetails)}</b>'
);

fs.writeFileSync(appPath, code);
