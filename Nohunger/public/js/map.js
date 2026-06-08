/* ================= MAP / TRACKING ================= */
var trackMap = null;
var ngoMarker = null;
var receiverMarker = null;
var routeControl = null;
var previousLatLng = null;
var currentTrackedRequest = null;

window.openTracking = function (requestId) {
currentTrackedRequest = requestId;

document.getElementById("trackModal").style.display = "flex";

setTimeout(() => {
if (trackMap) {
trackMap.remove();
}

```
trackMap = L.map("trackMap");

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(trackMap);

// Default India View
trackMap.setView([20.5937, 78.9629], 5);
trackMap.invalidateSize();

// Reset all tracking objects
receiverMarker = null;
ngoMarker = null;
routeControl = null;
previousLatLng = null;
```

}, 200);

socket.emit("joinRequestRoom", requestId);
};

window.closeTrackModal = function () {
document.getElementById("trackModal").style.display = "none";

if (trackMap) {
trackMap.remove();
trackMap = null;
}

receiverMarker = null;
ngoMarker = null;
routeControl = null;
previousLatLng = null;
};

/* ================= NGO LIVE LOCATION UPDATE ================= */

function handleNgoLiveLocation(data) {
if (!trackMap) return;

const { ngoLat, ngoLng, receiverLat, receiverLng, eta } = data;

const arrivalText = document.getElementById("arrivalText");

if (arrivalText && eta) {
arrivalText.innerText = "Arriving in " + eta + " minutes";
}

const ngoPos = L.latLng(ngoLat, ngoLng);
const receiverPos = L.latLng(receiverLat, receiverLng);

// Receiver Icon
const homeIcon = L.icon({
iconUrl: "https://cdn-icons-png.flaticon.com/512/1946/1946436.png",
iconSize: [40, 40],
iconAnchor: [20, 40]
});

// NGO Vehicle Icon
const vehicleIcon = L.icon({
iconUrl: "https://cdn-icons-png.flaticon.com/512/1046/1046784.png",
iconSize: [38, 38],
iconAnchor: [19, 19]
});

// Create receiver marker only when real coordinates arrive
if (!receiverMarker) {
receiverMarker = L.marker(receiverPos, {
icon: homeIcon
})
.addTo(trackMap)
.bindPopup("Receiver Location");
} else {
receiverMarker.setLatLng(receiverPos);
}

// Create NGO marker only when real coordinates arrive
if (!ngoMarker) {
ngoMarker = L.marker(ngoPos, {
icon: vehicleIcon
}).addTo(trackMap);

```
previousLatLng = ngoPos;
```

} else {
animateVehicle(previousLatLng, ngoPos);
previousLatLng = ngoPos;
}

// Remove previous route
if (routeControl) {
trackMap.removeControl(routeControl);
}

// Draw route
routeControl = L.Routing.control({
waypoints: [
ngoPos,
receiverPos
],
createMarker: () => null,
addWaypoints: false,
draggableWaypoints: false,
lineOptions: {
styles: [{
color: "#1E90FF",
weight: 6,
opacity: 0.9
}]
}
}).addTo(trackMap);

// Auto zoom
const group = new L.featureGroup([
ngoMarker,
receiverMarker
]);

trackMap.fitBounds(
group.getBounds().pad(0.3)
);
}

/* ================= VEHICLE ANIMATION ================= */

function animateVehicle(start, end) {
if (!start || !end || !ngoMarker) return;

const duration = 2000;
const startTime = performance.now();

function animate(time) {
const progress = Math.min(
(time - startTime) / duration,
1
);

```
const lat =
  start.lat +
  (end.lat - start.lat) * progress;

const lng =
  start.lng +
  (end.lng - start.lng) * progress;

ngoMarker.setLatLng([lat, lng]);

if (progress < 1) {
  requestAnimationFrame(animate);
}
```

}

requestAnimationFrame(animate);
}
