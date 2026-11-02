/* ================= MAP / TRACKING ================= */
var trackMap = null;
var ngoMarker = null;
var receiverMarker = null;
var routeControl = null;
var previousLatLng = null;
var currentTrackedRequest = null;

window.openTracking = function (requestId) {
  if (!window.L) {
    alert("Map service is unavailable.");
    return;
  }
  currentTrackedRequest = requestId;
  document.getElementById("trackModal").style.display = "flex";
  setTimeout(() => {
    if (trackMap) trackMap.remove();
    trackMap = L.map("trackMap");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(trackMap);
    trackMap.setView([20.5937, 78.9629], 5);
    trackMap.invalidateSize();
    receiverMarker = null;
    ngoMarker = null;
    routeControl = null;
    previousLatLng = null;
  }, 200);
  socket.emit("joinRequestRoom", requestId);
};

window.closeTrackModal = function () {
  document.getElementById("trackModal").style.display = "none";
  if (trackMap) trackMap.remove();
  trackMap = null;
  receiverMarker = null;
  ngoMarker = null;
  routeControl = null;
  previousLatLng = null;
};

function handleNgoLiveLocation(data) {
  if (!trackMap || !window.L) return;
  const { ngoLat, ngoLng, receiverLat, receiverLng, eta } = data || {};
  if (![ngoLat, ngoLng, receiverLat, receiverLng].every(Number.isFinite)) return;
  const arrivalText = document.getElementById("arrivalText");
  if (arrivalText && Number.isFinite(eta)) arrivalText.textContent = `Arriving in ${eta} minutes`;
  const ngoPos = L.latLng(ngoLat, ngoLng);
  const receiverPos = L.latLng(receiverLat, receiverLng);
  if (!receiverMarker) receiverMarker = L.marker(receiverPos).addTo(trackMap).bindPopup("Receiver Location");
  else receiverMarker.setLatLng(receiverPos);
  if (!ngoMarker) {
    ngoMarker = L.marker(ngoPos).addTo(trackMap);
    previousLatLng = ngoPos;
  } else {
    animateVehicle(previousLatLng, ngoPos);
    previousLatLng = ngoPos;
  }
  if (routeControl) trackMap.removeControl(routeControl);
  if (L.Routing) {
    routeControl = L.Routing.control({
      waypoints: [ngoPos, receiverPos],
      createMarker: () => null,
      addWaypoints: false,
      draggableWaypoints: false
    }).addTo(trackMap);
  }
  trackMap.fitBounds(new L.featureGroup([ngoMarker, receiverMarker]).getBounds().pad(0.3));
}

function animateVehicle(start, end) {
  if (!start || !end || !ngoMarker) return;
  const duration = 2000;
  const startTime = performance.now();
  function animate(time) {
    const progress = Math.min((time - startTime) / duration, 1);
    ngoMarker.setLatLng([
      start.lat + (end.lat - start.lat) * progress,
      start.lng + (end.lng - start.lng) * progress
    ]);
    if (progress < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
