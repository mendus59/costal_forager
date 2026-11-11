/**
 * The tide map page, ported from TideWidget's web map (web/js/app.js). NOAA
 * tide stations are dots colored by the tide, blue at low tide through teal
 * and yellow to red at high tide, and a slider (with play) moves the time
 * across the next 24 hours so the tide sweeps along the coast like a radar
 * loop. A search box finds stations by name or id, and places (beach, town or
 * address) with the stations closest to them.
 *
 * Like the beach map it runs Leaflet in a WebView (Android/iOS) or an iframe
 * (web). The page fetches the station list and predictions from NOAA itself
 * (the API sends CORS headers), only for stations on screen. The app sends
 * `setData` ({ dark, center }) and gets back `{ type: 'ready' }` and
 * `{ type: 'station', id, name, state, lat, lng }` when a station's "Week
 * view" is tapped.
 */

export interface TideMapData {
  dark: boolean;
  /** Where to center the map (the user's location), or null to keep it. */
  center: { lat: number; lng: number } | null;
}

export interface StationPick {
  id: string;
  name: string;
  state: string | null;
  lat: number;
  lng: number;
}

export type TideMapMessage = { type: 'ready' } | ({ type: 'station' } & StationPick);

export const TIDE_MAP_SOURCE = 'coastal-forager-tide-map';

export function parseTideMapMessage(raw: unknown): TideMapMessage | null {
  try {
    const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!m || typeof m !== 'object' || (m as { source?: unknown }).source !== TIDE_MAP_SOURCE) return null;
    const msg = m as Record<string, unknown>;
    if (msg.type === 'ready') return { type: 'ready' };
    if (msg.type === 'station' && typeof msg.id === 'string' && typeof msg.name === 'string') {
      return {
        type: 'station',
        id: msg.id,
        name: msg.name,
        state: typeof msg.state === 'string' ? msg.state : null,
        lat: Number(msg.lat),
        lng: Number(msg.lng),
      };
    }
  } catch {
    // Not one of ours.
  }
  return null;
}

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';

export const TIDE_MAP_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.min.css">
<script src="${LEAFLET}/leaflet.min.js"></script>
<style>
  :root { --bg: #ffffff; --fg: #10242b; --muted: #5b6b73; --line: #2159cc; --card: rgba(255,255,255,0.96); --border: #d5dde0; --accent: #0b6e79; }
  body.dark { --bg: #0d1518; --fg: #e8f0f2; --muted: #9fb0b6; --line: #5b8ef0; --card: rgba(20,30,34,0.96); --border: #2a3a40; --accent: #4fb3bf; }
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #dfe7ea; }
  body { font: 14px/1.35 -apple-system, system-ui, Roboto, sans-serif; color: var(--fg); }
  body.dark, body.dark #map { background: #0d1518; }
  .card { position: absolute; z-index: 1000; background: var(--card); border: 1px solid var(--border); border-radius: 14px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.12); }
  .search { top: 10px; left: 10px; right: 10px; padding: 0; }
  .search input { box-sizing: border-box; width: 100%; border: 0; background: transparent; color: var(--fg);
                  font: inherit; font-size: 16px; padding: 11px 14px; outline: none; }
  .results { list-style: none; margin: 0; padding: 0 0 6px; border-top: 1px solid var(--border); max-height: 50vh; overflow: auto; }
  .results li { padding: 8px 14px; cursor: pointer; }
  .results li[aria-selected="true"], .results li:hover { background: rgba(11,110,121,0.12); }
  .results small { color: var(--muted); display: block; }
  .results .place { color: var(--accent); font-weight: 600; }
  .scrubber { left: 10px; right: 10px; bottom: 22px; padding: 8px 14px 10px; }
  .scrub-head { display: flex; align-items: center; gap: 8px; }
  .scrub-head strong { flex: 1; text-align: center; }
  .legend { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 12px; }
  .legend i { width: 10px; height: 10px; border-radius: 5px; display: inline-block; }
  .bar { height: 6px; border-radius: 3px; margin: 2px 0 0;
         background: linear-gradient(90deg, rgb(33,89,204), rgb(26,179,191) 35%, rgb(250,204,64) 65%, rgb(224,56,51)); opacity: .55; }
  .scrub-head button { border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 8px;
                       font: inherit; padding: 3px 10px; cursor: pointer; }
  input[type=range] { width: 100%; margin: 6px 0 0; accent-color: var(--accent); }
  .toast { left: 10px; right: 10px; top: 60px; padding: 10px 14px; color: #b3261e; display: none; }
  .leaflet-popup-content { margin: 10px 12px; font: 14px/1.35 -apple-system, system-ui, Roboto, sans-serif; }
  .tw-name { font-weight: 600; font-size: 15px; padding-right: 12px; }
  .tw-sub { color: #5b6b73; margin-top: 2px; }
  .tw-row { margin-top: 2px; }
  .tw-row .hi { color: #e03833; } .tw-row .lo { color: #2159cc; }
  .tw-open { display: inline-block; margin-top: 8px; padding: 6px 10px; border: 0; border-radius: 8px;
             background: #0b6e79; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  #err { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; padding: 24px;
         text-align: center; font: 15px system-ui, sans-serif; color: #5b6b73; }
</style>
</head>
<body>
<div id="map" aria-label="Tide map"></div>
<div class="card search">
  <input id="search" type="search" placeholder="Find a beach, town, address or station" autocomplete="off" aria-label="Find a place or tide station">
  <ul id="results" class="results" role="listbox" hidden></ul>
</div>
<div id="toast" class="card toast" role="alert"></div>
<section class="card scrubber" aria-label="Time">
  <div class="scrub-head">
    <button id="play" type="button" aria-label="Play the next 24 hours">&#9654;</button>
    <span class="legend"><i style="background:rgb(33,89,204)"></i>Low</span>
    <strong id="time">Now</strong>
    <span class="legend">High<i style="background:rgb(224,56,51)"></i></span>
    <button id="now" type="button" hidden>Now</button>
  </div>
  <div class="bar" aria-hidden="true"></div>
  <input id="slider" type="range" min="0" max="24" step="0.25" value="0" aria-label="Hours from now">
</section>
<div id="err">The tide map needs an internet connection to load.</div>
<script>
(function () {
  var SOURCE = ${JSON.stringify(TIDE_MAP_SOURCE)};
  function send(msg) {
    msg.source = SOURCE;
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    else if (window.parent !== window) window.parent.postMessage(msg, '*');
  }
  if (typeof L === 'undefined') { document.getElementById('err').style.display = 'flex'; return; }
  function $(id) { return document.getElementById(id); }

  var API = 'https://api.tidesandcurrents.noaa.gov';
  var START = Math.floor(Date.now() / 1000);
  var MAX_PER_PAN = 60, CONCURRENCY = 6;
  var state = { stations: [], byId: {}, forecasts: {}, loading: {}, markers: {}, offset: 0, dark: null, centered: false };

  // ---- tide math (packages/core/src/tidemath.ts, from TideWidget) ----
  function bracket(ev, t) {
    for (var i = 0; i < ev.length; i++) if (ev[i].t > t) break;
    if (i <= 0 || i >= ev.length) return null;
    var a = ev[i - 1], b = ev[i];
    return { a: a, b: b, f: (t - a.t) / (b.t - a.t) };
  }
  function ease(f) { return (1 - Math.cos(Math.PI * f)) / 2; }
  function height(ev, t) { var br = bracket(ev, t); return br ? br.a.h + (br.b.h - br.a.h) * ease(br.f) : null; }
  function phase(ev, t) { var br = bracket(ev, t); if (!br) return null; return br.a.k === 'L' ? ease(br.f) : 1 - ease(br.f); }
  var STOPS = [[0, [33, 89, 204]], [0.35, [26, 179, 191]], [0.65, [250, 204, 64]], [1, [224, 56, 51]]];
  function color(p) {
    p = Math.min(1, Math.max(0, p));
    var j = 1; while (j < STOPS.length - 1 && STOPS[j][0] < p) j++;
    var p0 = STOPS[j - 1][0], c0 = STOPS[j - 1][1], p1 = STOPS[j][0], c1 = STOPS[j][1], f = (p - p0) / (p1 - p0);
    return 'rgb(' + c0.map(function (c, k) { return Math.trunc(c + (c1[k] - c) * f); }).join(',') + ')';
  }
  function nextHL(ev, t) {
    var hi = null, lo = null;
    for (var i = 0; i < ev.length; i++) {
      if (ev[i].t <= t) continue;
      if (ev[i].k === 'H' && !hi) hi = ev[i];
      if (ev[i].k === 'L' && !lo) lo = ev[i];
    }
    return { high: hi, low: lo };
  }

  // ---- formatting ----
  var fmtWhen = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  var fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  function when(sec) {
    var d = new Date(sec * 1000);
    return (d.toDateString() === new Date().toDateString() ? fmtTime : fmtWhen).format(d);
  }
  function ft(h) { return (h > 0 ? '+' : '') + h.toFixed(1) + ' ft'; }
  function label(s) { return s.state ? s.name + ', ' + s.state : s.name; }
  function timeSec() { return START + Math.round(state.offset * 3600); }
  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.style.display = msg ? 'block' : 'none';
    if (msg) setTimeout(function () { if (el.textContent === msg) el.style.display = 'none'; }, 8000);
  }
  function km(a, b) {
    var r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.pow(Math.sin(dLng / 2), 2);
    return 12742 * Math.asin(Math.sqrt(h));
  }
  function miles(k) { var m = k / 1.609344; return (m < 10 ? m.toFixed(1) : Math.round(m)) + ' mi'; }

  // ---- NOAA ----
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()); }
  function getForecast(id) {
    if (state.forecasts[id]) return Promise.resolve(state.forecasts[id]);
    var begin = new Date((START - 18 * 3600) * 1000);
    var q = new URLSearchParams({ station: id, product: 'predictions', interval: 'hilo', datum: 'MLLW', units: 'english',
      time_zone: 'gmt', format: 'json', begin_date: ymd(begin), range: '108', application: 'costal_forager' });
    return fetch(API + '/api/prod/datagetter?' + q).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (body) {
      if (body.error) throw new Error(body.error.message);
      var ev = (body.predictions || []).map(function (p) {
        return { t: Date.parse(p.t.replace(' ', 'T') + ':00Z') / 1000, h: parseFloat(p.v), k: p.type === 'H' ? 'H' : 'L' };
      }).filter(function (e) { return isFinite(e.t) && isFinite(e.h); }).sort(function (a, b) { return a.t - b.t; });
      state.forecasts[id] = ev;
      return ev;
    });
  }
  function loadVisible() {
    if (!state.stations.length) return;
    var b = map.getBounds(), c = map.getCenter();
    var todo = state.stations.filter(function (s) {
      return b.contains([s.lat, s.lng]) && !state.forecasts[s.id] && !state.loading[s.id];
    }).sort(function (x, y) { return c.distanceTo([x.lat, x.lng]) - c.distanceTo([y.lat, y.lng]); }).slice(0, MAX_PER_PAN);
    todo.forEach(function (s) { state.loading[s.id] = true; });
    var failures = 0, queue = todo.slice();
    function worker() {
      var s = queue.shift();
      if (!s) return Promise.resolve();
      return getForecast(s.id).then(function () { paint(s.id); }, function () { failures++; })
        .then(function () { delete state.loading[s.id]; return worker(); });
    }
    var workers = [];
    for (var i = 0; i < CONCURRENCY; i++) workers.push(worker());
    Promise.all(workers).then(function () {
      if (todo.length && failures === todo.length) toast("Couldn't reach NOAA for tide predictions. Check your connection.");
    });
  }

  // ---- map ----
  var map = L.map('map', { preferCanvas: true, zoomControl: false, worldCopyJump: true }).setView([47.6, -122.4], 9);
  L.control.zoom({ position: 'topright' }).addTo(map);
  map.attributionControl.setPrefix('Tides: NOAA CO-OPS, not for navigation');
  map.getContainer().querySelector('.leaflet-top.leaflet-right').style.marginTop = '58px';
  var tiles = null;
  function setTiles(isDark) {
    if (state.dark === isDark) return;
    state.dark = isDark;
    document.body.className = isDark ? 'dark' : '';
    if (tiles) map.removeLayer(tiles);
    var base = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
    tiles = L.tileLayer(base + (isDark ? 'Canvas/World_Dark_Gray_Base' : 'World_Topo_Map') + '/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: isDark ? 16 : 19, attribution: '&copy; Esri, &copy; OpenStreetMap'
    }).addTo(map);
    Object.keys(state.markers).forEach(paint);
  }
  var renderer = L.canvas({ padding: 0.5 });
  function unloaded() { return state.dark ? '#53606f' : '#a7b3c2'; }
  function popup(s) {
    var box = document.createElement('div');
    var name = document.createElement('div'); name.className = 'tw-name'; name.textContent = label(s);
    var sub = document.createElement('div'); sub.className = 'tw-sub'; sub.textContent = 'NOAA station ' + s.id;
    box.appendChild(name); box.appendChild(sub);
    var ev = state.forecasts[s.id];
    if (ev) {
      var t = timeSec(), h = height(ev, t), n = nextHL(ev, t);
      if (h !== null) sub.textContent += ' \\u00b7 ' + ft(h) + (state.offset ? ' at ' + when(t) : ' now');
      [['hi', '\\u25b2 High', n.high], ['lo', '\\u25bc Low', n.low]].forEach(function (r) {
        if (!r[2]) return;
        var row = document.createElement('div'); row.className = 'tw-row';
        var a = document.createElement('span'); a.className = r[0]; a.textContent = r[1];
        row.appendChild(a); row.appendChild(document.createTextNode('  ' + when(r[2].t) + '  ' + ft(r[2].h)));
        box.appendChild(row);
      });
    }
    var btn = document.createElement('button'); btn.className = 'tw-open'; btn.textContent = 'Week view';
    btn.onclick = function () { send({ type: 'station', id: s.id, name: s.name, state: s.state, lat: s.lat, lng: s.lng }); };
    box.appendChild(btn);
    return box;
  }
  function addMarkers() {
    state.stations.forEach(function (s) {
      var m = L.circleMarker([s.lat, s.lng], { renderer: renderer, radius: 5, weight: 1.5, color: '#fff', fillColor: unloaded(), fillOpacity: 0.9 })
        .bindTooltip(label(s), { direction: 'top', offset: [0, -6] });
      m.bindPopup(function () { return popup(s); });
      m.on('click', function () {
        getForecast(s.id).then(function () { paint(s.id); if (m.isPopupOpen()) m.setPopupContent(popup(s)); }, function () {});
      });
      m.addTo(map);
      state.markers[s.id] = m;
    });
  }
  function paint(id) {
    var m = state.markers[id], ev = state.forecasts[id];
    if (!m) return;
    var p = ev ? phase(ev, timeSec()) : null;
    m.setStyle(p === null ? { fillColor: unloaded(), radius: 5, fillOpacity: 0.9, color: state.dark ? '#0d1518' : '#fff' }
                          : { fillColor: color(p), radius: 7, fillOpacity: 1, color: state.dark ? '#0d1518' : '#fff' });
  }
  function paintAll() { Object.keys(state.forecasts).forEach(paint); }
  map.on('moveend', loadVisible);

  // ---- time scrubber ----
  var playTimer = null;
  function setOffset(h) {
    state.offset = h;
    $('slider').value = h;
    $('time').textContent = h === 0 ? 'Now' : fmtWhen.format(new Date(timeSec() * 1000));
    $('now').hidden = h === 0;
    paintAll();
  }
  function stopPlay() { clearInterval(playTimer); playTimer = null; $('play').innerHTML = '&#9654;'; }
  $('slider').addEventListener('input', function (e) { stopPlay(); setOffset(parseFloat(e.target.value)); });
  $('now').addEventListener('click', function () { stopPlay(); setOffset(0); });
  $('play').addEventListener('click', function () {
    if (playTimer) return stopPlay();
    if (state.offset >= 24) setOffset(0);
    $('play').innerHTML = '&#10074;&#10074;';
    playTimer = setInterval(function () {
      var next = Math.min(24, state.offset + 0.25);
      setOffset(next);
      if (next >= 24) stopPlay();
    }, 120);
  });

  // ---- search ----
  var results = [], active = -1, placeTimer = null, lastPlaceQuery = '';
  function nearestStations(p, n) {
    return state.stations.map(function (s) { return { s: s, km: km(p, s) }; })
      .sort(function (a, b) { return a.km - b.km; }).slice(0, n);
  }
  function renderResults() {
    var ul = $('results');
    ul.replaceChildren.apply(ul, results.map(function (r, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      var main = document.createElement('span'); main.textContent = r.label;
      if (r.kind === 'place' || r.kind === 'find') main.className = 'place';
      var small = document.createElement('small'); small.textContent = r.detail;
      li.appendChild(main); li.appendChild(small);
      li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(r); });
      li.addEventListener('touchend', function (e) { e.preventDefault(); pick(r); });
      return li;
    }));
    ul.hidden = !results.length;
  }
  function openStation(s, zoom) {
    map.flyTo([s.lat, s.lng], zoom || Math.max(map.getZoom(), 11), { duration: 0.8 });
    var m = state.markers[s.id];
    if (m) map.once('moveend', function () { m.fire('click'); m.openPopup(); });
  }
  function pick(r) {
    if (r.kind === 'find') return searchPlaces(r.query);
    $('search').value = ''; results = []; renderResults(); $('search').blur();
    if (r.kind === 'station') return openStation(r.station, 11);
    // A place: show it and its closest station.
    var near = nearestStations(r, 1)[0];
    if (near) openStation(near.s, 11);
    else map.flyTo([r.lat, r.lng], 11);
  }
  function stationResults(q) {
    return state.stations.filter(function (s) {
      return s.id === q || (s.name + ' ' + (s.state || '')).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 6).map(function (s) {
      return { kind: 'station', label: label(s), detail: 'Tide station ' + s.id, station: s };
    });
  }
  function searchPlaces(q) {
    if (q === lastPlaceQuery) return;
    lastPlaceQuery = q;
    // OpenStreetMap's geocoder: free, no key; asked only on Enter or a pause, to stay within its usage policy.
    // Prefer places in view, so "Port Town" near Puget Sound finds Port Townsend, WA first.
    var b = map.getBounds();
    var url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q: q, format: 'jsonv2', limit: '4', countrycodes: 'us',
      viewbox: [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].map(function (v) { return v.toFixed(3); }).join(',') });
    fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      if ($('search').value.trim().toLowerCase() !== q) return;
      var places = list.map(function (p) {
        var at = { lat: +p.lat, lng: +p.lon };
        var near = nearestStations(at, 3);
        return { kind: 'place', label: p.display_name.split(',').slice(0, 2).join(','), lat: at.lat, lng: at.lng,
          detail: near.length ? 'Nearest: ' + near.map(function (n, i) { return (i === 0 ? '\\u2605 ' : '') + n.s.name + ' (' + miles(n.km) + ')'; }).join(', ') : '' };
      });
      results = stationResults(q).concat(places.length ? places : [{ kind: 'none', label: 'No places found', detail: '' }]);
      active = -1; renderResults();
    }, function () { toast("Couldn't search places. Check your connection."); });
  }
  $('search').addEventListener('input', function (e) {
    var q = e.target.value.trim().toLowerCase();
    active = -1;
    clearTimeout(placeTimer);
    if (q.length < 2) { results = []; return renderResults(); }
    results = stationResults(q);
    if (q.length >= 3) results.push({ kind: 'find', label: 'Search places for \\u201c' + e.target.value.trim() + '\\u201d', detail: 'Beaches, towns and addresses', query: q });
    renderResults();
    if (q.length >= 4) placeTimer = setTimeout(function () { searchPlaces(q); }, 900);
  });
  $('search').addEventListener('keydown', function (e) {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { active = (active + 1) % results.length; renderResults(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = (active - 1 + results.length) % results.length; renderResults(); e.preventDefault(); }
    else if (e.key === 'Enter') { var q = $('search').value.trim().toLowerCase(); if (active < 0 && q.length >= 3) searchPlaces(q); else pick(results[Math.max(active, 0)]); }
    else if (e.key === 'Escape') { results = []; renderResults(); }
  });
  $('search').addEventListener('blur', function () { setTimeout(function () { results = []; renderResults(); }, 150); });

  // ---- app messages ----
  window.__twSetData = function (data) {
    setTiles(!!data.dark);
    if (data.center && !state.centered) {
      state.centered = true;
      map.setView([data.center.lat, data.center.lng], 10);
    }
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.source === SOURCE && d.type === 'setData') window.__twSetData(d.data);
  });

  // ---- start ----
  setOffset(0);
  fetch(API + '/mdapi/prod/webapi/stations.json?type=tidepredictions').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (body) {
    state.stations = (body.stations || []).map(function (s) {
      return { id: String(s.id), name: s.name, state: s.state || null, lat: +s.lat, lng: +s.lng };
    }).filter(function (s) { return isFinite(s.lat) && isFinite(s.lng); });
    state.stations.forEach(function (s) { state.byId[s.id] = s; });
    addMarkers();
    loadVisible();
  }).catch(function () { toast("Couldn't load the station list from NOAA."); });
  // Keep "now" current while the map stays open.
  setInterval(function () {
    var drift = (Date.now() / 1000 - START) / 3600;
    if (drift > 0.25 && state.offset === 0 && !playTimer) { START = Math.floor(Date.now() / 1000); paintAll(); }
  }, 60000);
  send({ type: 'ready' });
})();
</script>
</body>
</html>`;
