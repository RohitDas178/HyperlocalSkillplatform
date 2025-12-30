(function(){
  // map.js: requests geolocation and displays a Leaflet map (fallback if Google API not provided)
  async function ensureLocationAndSend() {
    if (!navigator.geolocation) return console.warn('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // save to server if authenticated
      const token = localStorage.getItem('skilloc_token');
      if (token) {
        try {
          await fetch('/api/client/location', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ latitude: lat, longitude: lng }) });
        } catch(e){ console.warn('Could not save location', e); }
      }
      // create map container if missing
      let container = document.getElementById('skilloc-map');
      if (!container) {
        container = document.createElement('div');
        container.id = 'skilloc-map';
        container.style.height = '300px';
        container.style.margin = '12px 0';
        const main = document.querySelector('.main-content') || document.body;
        main.insertBefore(container, main.firstChild);
      }

      // Try to use Google Maps if API available
      if (window.google && window.google.maps) {
        const map = new google.maps.Map(container, { center: { lat, lng }, zoom: 14 });
        new google.maps.Marker({ position: { lat, lng }, map, title: 'You are here' });
        return;
      }

      // Otherwise use Leaflet from CDN (fallback)
      if (!window.L) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.onload = () => renderLeaflet(container, lat, lng);
        document.body.appendChild(s);
      } else {
        renderLeaflet(container, lat, lng);
      }
    }, (err) => {
      console.warn('Geolocation failed', err);
    }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
  }

  function renderLeaflet(container, lat, lng) {
    try {
      const map = L.map(container).setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      L.marker([lat, lng]).addTo(map).bindPopup('You are here').openPopup();
    } catch (e) { console.warn(e); }
  }

  // expose a simple function that page can call when ready
  window.skillocMapInit = ensureLocationAndSend;
})();
