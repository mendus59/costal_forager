/**
 * The beach map page. It runs Leaflet with Esri basemap tiles (no API key), inside a WebView on Android/iOS and an iframe on web, so both
 * platforms share one map. The app sends it markers with `setData` and gets
 * back `{ type: 'ready' }` and `{ type: 'open', bidn }` messages.
 */

export interface MapPoint {
  bidn: string;
  name: string;
  lat: number;
  lng: number;
  /** Marker fill color. */
  color: string;
  /** Short status shown in the popup, such as "Open for oysters". */
  label: string;
}

export interface MapData {
  points: MapPoint[];
  dark: boolean;
}

export type MapMessage = { type: 'ready' } | { type: 'open'; bidn: string };

export const MAP_SOURCE = 'coastal-forager-map';

export function parseMapMessage(raw: unknown): MapMessage | null {
  try {
    const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!m || typeof m !== 'object' || (m as { source?: unknown }).source !== MAP_SOURCE) return null;
    const msg = m as { type?: unknown; bidn?: unknown };
    if (msg.type === 'ready') return { type: 'ready' };
    if (msg.type === 'open' && typeof msg.bidn === 'string') return { type: 'open', bidn: msg.bidn };
  } catch {
    // Not one of ours.
  }
  return null;
}

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';

export const MAP_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.min.css">
<script src="${LEAFLET}/leaflet.min.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #dfe7ea; }
  body.dark, body.dark #map { background: #0d1518; }
  .leaflet-popup-content { margin: 10px 12px; font: 14px/1.35 -apple-system, system-ui, Roboto, sans-serif; }
  .cf-name { font-weight: 600; font-size: 15px; }
  .cf-label { color: #5b6b73; margin-top: 2px; }
  .cf-open { display: inline-block; margin-top: 8px; padding: 6px 10px; border: 0; border-radius: 8px;
             background: #0b6e79; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  #err { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; padding: 24px;
         text-align: center; font: 15px system-ui, sans-serif; color: #5b6b73; }
</style>
</head>
<body>
<div id="map"></div>
<div id="err">The map needs an internet connection to load.</div>
<script>
(function () {
  var SOURCE = ${JSON.stringify(MAP_SOURCE)};
  function send(msg) {
    msg.source = SOURCE;
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    else if (window.parent !== window) window.parent.postMessage(msg, '*');
  }
  if (typeof L === 'undefined') {
    document.getElementById('err').style.display = 'flex';
    return;
  }
  var map = L.map('map', { preferCanvas: true, zoomControl: true, attributionControl: true })
    .setView([47.4, -123.2], 7);
  var tiles = null, dark = null, layer = L.layerGroup().addTo(map), fitted = false;
  function setTiles(isDark) {
    if (dark === isDark) return;
    dark = isDark;
    document.body.className = isDark ? 'dark' : '';
    if (tiles) map.removeLayer(tiles);
    var base = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
    tiles = L.tileLayer(base + (isDark ? 'Canvas/World_Dark_Gray_Base' : 'World_Topo_Map') + '/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: isDark ? 16 : 19,
      attribution: '&copy; Esri, &copy; OpenStreetMap'
    }).addTo(map);
  }
  function popup(p) {
    var box = document.createElement('div');
    var name = document.createElement('div'); name.className = 'cf-name'; name.textContent = p.name;
    var label = document.createElement('div'); label.className = 'cf-label'; label.textContent = p.label;
    var btn = document.createElement('button'); btn.className = 'cf-open'; btn.textContent = 'View beach';
    btn.onclick = function () { send({ type: 'open', bidn: p.bidn }); };
    box.appendChild(name); box.appendChild(label); box.appendChild(btn);
    return box;
  }
  window.__cfSetData = function (data) {
    setTiles(!!data.dark);
    layer.clearLayers();
    var bounds = [];
    for (var i = 0; i < data.points.length; i++) {
      var p = data.points[i];
      L.circleMarker([p.lat, p.lng], {
        radius: 7, weight: 1.5, color: data.dark ? '#0d1518' : '#ffffff', fillColor: p.color, fillOpacity: 0.95
      }).bindPopup(popup(p)).addTo(layer);
      bounds.push([p.lat, p.lng]);
    }
    if (!fitted && bounds.length) {
      fitted = true;
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.source === SOURCE && d.type === 'setData') window.__cfSetData(d.data);
  });
  send({ type: 'ready' });
})();
</script>
</body>
</html>`;
