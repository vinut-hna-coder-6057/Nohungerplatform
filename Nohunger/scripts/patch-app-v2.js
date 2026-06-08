const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "public", "js", "app.js");
let code = fs.readFileSync(appPath, "utf8");

// Ensure app.js does not duplicate core.js (strip if accidentally merged)
const domIdx = code.indexOf('document.addEventListener("DOMContentLoaded"');
if (domIdx > 0) {
  code = code.slice(domIdx);
}

// lockedRole JSON parse on reconnect
code = code.replace(
  /const savedRole = localStorage\.getItem\("lockedRole"\);/,
  `const savedRoleRaw = localStorage.getItem("lockedRole");
 const savedRole = parseLockedRole(savedRoleRaw);`
);

code = code.replace(
  /if \(savedRole && savedLocation\) \{/,
  `if (savedRole && savedLocation && email) {
   socket.auth = getSocketAuth();`
);

// update-status + save-receiver-location auth headers
code = code.replace(
  /headers:\s*\{\s*"Content-Type"\s*:\s*"application\/json"\s*\}/g,
  "headers: getAuthHeaders()"
);

code = code.replace(
  /body:\s*JSON\.stringify\(\{\s*requestId,\s*status,\s*email:\s*sessionStorage\.getItem\("userEmail"\)\s*\}\)/,
  "body: JSON.stringify({ requestId, status })"
);

// Admin login token
if (!code.includes('sessionStorage.setItem("adminToken"')) {
  code = code.replace(
    /sessionStorage\.setItem\("isAdmin","true"\);/,
    `sessionStorage.setItem("isAdmin","true");
      if(data.token) sessionStorage.setItem("adminToken", data.token);`
  );
}

// User login token + socket auth
code = code.replace(
  /sessionStorage\.setItem\("userEmail", email\.toLowerCase\(\)\.trim\(\)\);/,
  `sessionStorage.setItem("userEmail", email.toLowerCase().trim());
    if(data.token) {
      sessionStorage.setItem("token", data.token);
      socket.auth = getSocketAuth();
    }`
);

// registerRole: fetch first, then socket emit with refreshed token
code = code.replace(
  /socket\.emit\("registerLocation",\{\s*role,\s*location: locationValue,\s*email: sessionStorage\.getItem\("userEmail"\)\s*\}\);\s*try\{\s*await fetch\(`\$\{API\}\/api\/registerRole`/,
  `try{
     const regRes = await fetch(\`\${API}/api/registerRole\``
);

code = code.replace(
  /body: JSON\.stringify\(\{ role: role, location: locationValue \}\)\s*\}\);\s*\}catch\(e\)\{/,
  `body: JSON.stringify({ role: role, location: locationValue })
     });
     const regData = await regRes.json();
     if (regData.token) {
       sessionStorage.setItem("token", regData.token);
       socket.auth = getSocketAuth();
     }
   }catch(e){`
);

code = code.replace(
  /\}catch\(e\)\{\s*console\.log\(e\);\s*\}\s*showPage\("mainDashboard"\);/,
  `}catch(e){
     console.log(e);
   }

 socket.emit("registerLocation",{
  role,
  location: locationValue,
  email: sessionStorage.getItem("userEmail")
 });

   showPage("mainDashboard");`
);

// NGO GPS watch
code = code.replace(
  /if\(status === "ngo_accepted"\)\{\s*socket\.emit\("joinRequestRoom", requestId\);\s*navigator\.geolocation\.watchPosition/,
  `if(status === "ngo_accepted"){
  socket.emit("joinRequestRoom", requestId);
  clearNgoGpsWatch();
  window.ngoGpsWatchId = navigator.geolocation.watchPosition`
);

if (!code.includes('status === "ngo_delivered" || status === "received"')) {
  code = code.replace(
    /timeout:5000\s*\}\);\s*\}/,
    `timeout:5000
  });

}

if(status === "ngo_delivered" || status === "received"){
  clearNgoGpsWatch();
}`
  );
}

// Logout clears GPS
code = code.replace(
  /sessionStorage\.clear\(\);\s*location\.reload\(\);/,
  `clearNgoGpsWatch();
sessionStorage.clear();
localStorage.removeItem("lockedRole");
localStorage.removeItem("locationValue");
location.reload();`
);

// Hardcoded localhost
code = code.split("http://localhost:4000").join("${API}");

// escapeHtml for notification fields not yet escaped
const escapeFields = [
  ["${n.message}", "${escapeHtml(n.message)}"],
  ['${n.donorName || (n.senderEmail || "").split("@")[0] || "User"}', '${escapeHtml(n.donorName || (n.senderEmail || "").split("@")[0] || "User")}'],
  ['${n.foodItem || "Not Provided"}', '${escapeHtml(n.foodItem || "Not Provided")}'],
  ['${n.quantity || "Not Provided"}', '${escapeHtml(n.quantity || "Not Provided")}'],
  ['${n.location}', '${escapeHtml(n.location)}'],
  ['${n.status}', '${escapeHtml(n.status)}'],
  ["updateRequest('${n.requestId}'", "updateRequest('${escapeHtml(n.requestId)}'"],
  ["openTracking('${n.requestId}'", "openTracking('${escapeHtml(n.requestId)}'"],
];

for (const [from, to] of escapeFields) {
  if (code.includes(from) && !code.includes(to)) {
    code = code.split(from).join(to);
  }
}

fs.writeFileSync(appPath, code);