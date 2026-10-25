import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const STEP_POINT = [0, 1, 3, 5, 6];
const truckHtml = `<div class="truck-pin"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>`;

export default function DeliveryMap({ route, step }) {
  const el = useRef(null);
  const map = useRef(null);
  const truck = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
    L.polyline(route, { color: "#0E7C74", weight: 5, opacity: 0.85 }).addTo(m);
    const pin = (txt) => L.divIcon({ className: "", html: `<div class="map-label">${txt}</div>`, iconSize: [0, 0] });
    L.circleMarker(route[0], { radius: 7, color: "#0F3D3A", fillColor: "#fff", fillOpacity: 1, weight: 3 }).addTo(m);
    L.marker(route[0], { icon: pin("Supplier yard") }).addTo(m);
    L.circleMarker(route[route.length - 1], { radius: 7, color: "#146C3B", fillColor: "#1E8A4C", fillOpacity: 1, weight: 3 }).addTo(m);
    L.marker(route[route.length - 1], { icon: pin("Nguyen Kitchen job site") }).addTo(m);
    truck.current = L.marker(route[STEP_POINT[step] ?? 0], { icon: L.divIcon({ className: "", html: truckHtml, iconSize: [36, 36], iconAnchor: [18, 18] }) }).addTo(m);
    m.fitBounds(L.latLngBounds(route).pad(0.15));
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (truck.current) truck.current.setLatLng(route[STEP_POINT[step] ?? 0]);
  }, [step, route]);

  return <div ref={el} className="map" data-testid="delivery-map" role="img" aria-label="Delivery route map from supplier yard to Nguyen Kitchen job site" />;
}
