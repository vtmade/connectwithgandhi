/**
 * Gandhi's Geographic Journey
 * Hierarchical: Location → Theme Cloud → Documents → Full Content
 */

import scrollama from 'scrollama';
import L from 'leaflet';

const CONFIG = {
  dataPath: '/data/journey.json',
  map: {
    initialCenter: [20, 77],
    initialZoom: 4,
    maxZoom: 18,
    minZoom: 2
  }
};

let map = null;
let markers = {};
let journeyData = null;
let locationGroups = {};
let allLocationGroups = {}; // Store unfiltered data
let scroller = null;
let minYear = 1895;
let maxYear = 1930;
let currentYearRange = [1895, 1930];

async function init() {
  console.log('Loading journey data...');

  try {
    const response = await fetch(CONFIG.dataPath);
    const data = await response.json();
    journeyData = data.journeyPoints;

    console.log(`Loaded ${journeyData.length} documents`);

    groupByLocation();
    buildUI();
    initMap();
    setupScrollTracking();

  } catch (error) {
    console.error('Error:', error);
    document.getElementById('app').innerHTML = `
      <div class="loading" style="color: #f44336;">Error: ${error.message}</div>
    `;
  }
}

function groupByLocation() {
  locationGroups = {};

  // Calculate year range
  const years = journeyData.map(d => d.year).filter(y => y);
  minYear = Math.min(...years);
  maxYear = Math.max(...years);
  currentYearRange = [minYear, maxYear];

  journeyData.forEach(doc => {
    const loc = doc.location;
    if (!locationGroups[loc]) {
      locationGroups[loc] = {
        name: loc,
        lat: doc.lat,
        lng: doc.lng,
        country: doc.country,
        documents: [],
        themes: {}
      };
    }
    locationGroups[loc].documents.push(doc);

    // Count themes
    doc.themes.forEach(theme => {
      if (!locationGroups[loc].themes[theme]) {
        locationGroups[loc].themes[theme] = [];
      }
      locationGroups[loc].themes[theme].push(doc);
    });
  });

  // Sort documents by date
  Object.values(locationGroups).forEach(location => {
    location.documents.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  });

  // Sort locations by earliest document
  const sorted = Object.values(locationGroups).sort((a, b) =>
    a.documents[0].sortDate.localeCompare(b.documents[0].sortDate)
  );

  locationGroups = {};
  sorted.forEach(loc => {
    locationGroups[loc.name] = loc;
  });

  // Store unfiltered version
  allLocationGroups = JSON.parse(JSON.stringify(locationGroups));

  console.log(`Grouped into ${Object.keys(locationGroups).length} locations (${minYear}-${maxYear})`);
}

function initMap() {
  map = L.map('map', {
    center: CONFIG.map.initialCenter,
    zoom: CONFIG.map.initialZoom,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: CONFIG.map.maxZoom
  }).addTo(map);

  Object.values(locationGroups).forEach(loc => addLocationMarker(loc));
}

function addLocationMarker(location) {
  const markerHtml = `
    <div class="map-marker" style="
      width: 12px; height: 12px;
      background: #4fc3f7;
      border: 2px solid #0a0a0a;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(79, 195, 247, 0.5);
    "></div>
  `;

  const icon = L.divIcon({
    html: markerHtml,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

  const marker = L.marker([location.lat, location.lng], { icon })
    .bindPopup(`
      <div style="
        background: #0a0a0a; color: #e0e0e0;
        padding: 0.75rem; min-width: 200px;
        border: 1px solid #2a2a2a;
      ">
        <strong style="color: #4fc3f7; font-size: 1rem; display: block; margin-bottom: 0.5rem;">
          ${location.name}
        </strong>
        <div style="font-size: 0.85rem; color: #888;">
          ${location.country}
        </div>
        <div style="font-size: 0.85rem; color: #4fc3f7; margin-top: 0.5rem;">
          ${location.documents.length} documents
        </div>
      </div>
    `)
    .addTo(map);

  markers[location.name] = marker;
}

function buildUI() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div id="container">
      <div id="sidebar">
        <div id="sidebar-header">
          <h1>Letters Across Time & Place</h1>
          <div class="subtitle">
            Journey through ${journeyData.length.toLocaleString()} letters and writings of Mahatma Gandhi (1884-1948)
          </div>
          <div class="explore-note">
            Scroll to explore locations • Click themes to filter documents • Slide timeline to navigate through years
          </div>
          <div class="credits-header">
            <div>Scrollytelling by <a href="https://github.com/vtmade/vtmade" target="_blank" rel="noopener">Vinay Thakur</a></div>
            <div>Data: <a href="https://github.com/AbelTheGeorge/Collected-Works-of-Mahatma-Gandhi" target="_blank" rel="noopener">The Collected Works of Mahatma Gandhi</a> organized by Abel George</div>
            <div>Source: Government of India CWMG Project (1956-1994)</div>
          </div>
        </div>
        <div id="locations-list"></div>
      </div>

      <div id="map-container">
        <div class="map-overlay" id="mapOverlay">
          <h2 id="mapLocationName">Gandhi's Geographic Journey</h2>
          <div class="location-meta" id="mapLocationMeta">Explore documents by time and place</div>
          ${renderTimeline()}
        </div>
        <div id="map"></div>
      </div>
    </div>
  `;

  const locationsList = document.getElementById('locations-list');

  Object.values(locationGroups).forEach((location, index) => {
    const section = document.createElement('div');
    section.className = 'location-section';
    section.setAttribute('data-location', location.name);
    section.setAttribute('data-step', index);

    // Theme cloud
    const themeCloud = renderThemeCloud(location);

    // Documents (initially hidden)
    const documentsHTML = `
      <div class="documents-list" id="docs-${location.name.replace(/\s/g, '-')}">
        ${location.documents.map(doc => renderDocumentCard(doc)).join('')}
      </div>
    `;

    section.innerHTML = `
      <div class="location-header">
        <h2>${location.name}, ${location.country}</h2>
        <div class="doc-count">${location.documents.length} docs</div>
      </div>
      ${themeCloud}
      ${documentsHTML}
    `;

    locationsList.appendChild(section);
  });

  // Add event listeners after DOM is ready
  setupThemeClicks();
  setupDocumentClicks();
  setupTimelineSlider();
}

function renderTimeline() {
  // Generate year markers every 5 years
  const yearMarkers = [];
  const startYear = Math.ceil(minYear / 5) * 5; // Round up to nearest 5
  for (let year = startYear; year <= maxYear; year += 5) {
    yearMarkers.push(year);
  }

  return `
    <div class="map-timeline">
      <div class="timeline-header">
        <h3>Time Period</h3>
        <div class="timeline-range">
          <span id="timeline-year">${maxYear}</span>
          <span class="window">(5-year window)</span>
        </div>
      </div>
      <div class="timeline-slider">
        <input type="range" id="year-slider" min="${minYear + 4}" max="${maxYear}" value="${maxYear}" step="1">
        <div class="timeline-years">
          ${yearMarkers.map(year => `<span>${year}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function setupTimelineSlider() {
  const slider = document.getElementById('year-slider');
  if (!slider) return;

  slider.addEventListener('input', (e) => {
    const endYear = parseInt(e.target.value);
    const startYear = endYear - 4; // 5-year window (inclusive)

    currentYearRange = [startYear, endYear];

    // Update display
    document.getElementById('timeline-year').textContent = `${startYear} - ${endYear}`;

    // Filter data with 5-year window
    filterByYearRange(startYear, endYear);
  });
}

function filterByYearRange(startYear, endYear) {
  // Filter documents by year range
  const filteredDocs = journeyData.filter(doc =>
    doc.year >= startYear && doc.year <= endYear
  );

  // Regroup by location
  locationGroups = {};
  filteredDocs.forEach(doc => {
    const loc = doc.location;
    if (!locationGroups[loc]) {
      locationGroups[loc] = {
        name: loc,
        lat: doc.lat,
        lng: doc.lng,
        country: doc.country,
        documents: [],
        themes: {}
      };
    }
    locationGroups[loc].documents.push(doc);

    // Count themes
    doc.themes.forEach(theme => {
      if (!locationGroups[loc].themes[theme]) {
        locationGroups[loc].themes[theme] = [];
      }
      locationGroups[loc].themes[theme].push(doc);
    });
  });

  // Sort
  Object.values(locationGroups).forEach(location => {
    location.documents.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  });

  const sorted = Object.values(locationGroups).sort((a, b) =>
    a.documents[0].sortDate.localeCompare(b.documents[0].sortDate)
  );

  locationGroups = {};
  sorted.forEach(loc => {
    locationGroups[loc.name] = loc;
  });

  // Update UI
  updateFilteredUI(filteredDocs.length);
}

function updateFilteredUI(docCount) {
  // Update subtitle with new counts
  const subtitle = document.querySelector('#sidebar-header .subtitle');
  if (subtitle) {
    subtitle.textContent = `Journey through ${docCount.toLocaleString()} letters and writings of Mahatma Gandhi (1884-1948)`;
  }

  // Rebuild locations list
  const locationsList = document.getElementById('locations-list');
  locationsList.innerHTML = '';

  Object.values(locationGroups).forEach((location, index) => {
    const section = document.createElement('div');
    section.className = 'location-section';
    section.setAttribute('data-location', location.name);
    section.setAttribute('data-step', index);

    const themeCloud = renderThemeCloud(location);
    const documentsHTML = `
      <div class="documents-list" id="docs-${location.name.replace(/\s/g, '-')}">
        ${location.documents.map(doc => renderDocumentCard(doc)).join('')}
      </div>
    `;

    section.innerHTML = `
      <div class="location-header">
        <h2>${location.name}, ${location.country}</h2>
        <div class="doc-count">${location.documents.length} docs</div>
      </div>
      ${themeCloud}
      ${documentsHTML}
    `;

    locationsList.appendChild(section);
  });

  // Re-setup event listeners
  setupThemeClicks();
  setupDocumentClicks();

  // Update markers on map
  updateMapMarkers();

  // Resize scrollama
  if (scroller) {
    scroller.resize();
  }
}

function updateMapMarkers() {
  // Remove all existing markers
  Object.values(markers).forEach(marker => {
    map.removeLayer(marker);
  });
  markers = {};

  // Add markers for filtered locations
  Object.values(locationGroups).forEach(loc => addLocationMarker(loc));
}

function renderThemeCloud(location) {
  const themes = Object.keys(location.themes).sort((a, b) =>
    location.themes[b].length - location.themes[a].length
  );

  return `
    <div class="theme-cloud">
      <div class="theme-cloud-header">Themes in ${location.name}</div>
      <div class="theme-tags">
        ${themes.map(theme => `
          <div class="theme-tag" data-location="${location.name}" data-theme="${theme}">
            ${theme}
            <span class="count">${location.themes[theme].length}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDocumentCard(doc) {
  // Extract addressee
  let addressee = '';
  const letterMatch = doc.title.match(/LETTER TO (.+)/i);
  if (letterMatch) {
    addressee = letterMatch[1];
  }

  // Generate summary in Gandhi's voice
  const summary = generateSummary(doc);

  return `
    <div class="document-card" data-doc-id="${doc.id}">
      <div class="doc-title">${doc.title}</div>
      <div class="doc-meta">
        <span>📅 ${formatDate(doc.date)}</span>
        ${addressee ? `<span>✉️ ${addressee}</span>` : ''}
        <span>📄 ${doc.type}</span>
        ${doc.themes.length > 0 ? `<span>🏷️ ${doc.themes[0]}</span>` : ''}
      </div>
      <div class="doc-summary">${summary}</div>
      <div class="expand-btn">Read full document →</div>
      <div class="doc-preview">${doc.fullContent || doc.contentPreview}</div>
    </div>
  `;
}

function generateSummary(doc) {
  // Generate a Gandhi-style philosophical summary based on themes
  const content = doc.contentPreview.toLowerCase();
  const themes = doc.themes;

  if (themes.includes('Satyagraha')) {
    return '"Truth and non-violence remain the foundation of all meaningful action. Only through steadfast adherence to these principles can we achieve lasting change."';
  } else if (themes.includes('Non-violence')) {
    return '"Violence breeds violence. The path of non-violence may be difficult, but it is the only path that leads to true victory of the spirit."';
  } else if (themes.includes('Independence')) {
    return '"True independence cannot be won through force. Swaraj must be earned through self-discipline and moral courage."';
  } else if (themes.includes('Religion')) {
    return '"All religions are true paths to the same divine truth. Unity in diversity must be our guiding principle."';
  } else if (themes.includes('Social Reform')) {
    return '"The measure of a civilization is how it treats its weakest members. Social reform is not charity but justice."';
  } else if (themes.includes('Economics')) {
    return '"True economics is the economics of justice. The spinning wheel is not just craft, it is the symbol of self-reliance and dignity."';
  } else {
    // Generic summary based on first sentence
    const firstSentence = doc.contentPreview.split('.')[0];
    return `"${firstSentence.substring(0, 150)}..."`;
  }
}

function formatDate(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${day}, ${year}`;
  }
  return dateStr;
}

function setupThemeClicks() {
  document.querySelectorAll('.theme-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      const location = tag.getAttribute('data-location');
      const theme = tag.getAttribute('data-theme');
      const docsContainer = document.getElementById(`docs-${location.replace(/\s/g, '-')}`);

      // Toggle active state
      const wasActive = tag.classList.contains('active');

      // Clear all active tags in this location
      tag.closest('.theme-cloud').querySelectorAll('.theme-tag').forEach(t => {
        t.classList.remove('active');
      });

      if (wasActive) {
        // Hide documents
        docsContainer.classList.remove('visible');
      } else {
        // Show documents for this theme
        tag.classList.add('active');
        docsContainer.classList.add('visible');

        // Filter documents by theme
        const allDocs = docsContainer.querySelectorAll('.document-card');
        allDocs.forEach(docCard => {
          const docId = docCard.getAttribute('data-doc-id');
          const doc = journeyData.find(d => d.id === docId);
          if (doc && doc.themes.includes(theme)) {
            docCard.style.display = 'block';
          } else {
            docCard.style.display = 'none';
          }
        });
      }
    });
  });
}

function setupDocumentClicks() {
  document.querySelectorAll('.document-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');
      const btn = card.querySelector('.expand-btn');
      if (card.classList.contains('expanded')) {
        btn.textContent = '↑ Collapse';
      } else {
        btn.textContent = 'Read full document →';
      }
    });
  });
}

function setupScrollTracking() {
  scroller = scrollama();

  scroller
    .setup({
      step: '.location-section',
      offset: 0.3,
      debug: false
    })
    .onStepEnter(handleLocationEnter);

  window.addEventListener('resize', () => {
    scroller.resize();
  });
}

function handleLocationEnter(response) {
  const { element } = response;
  const locationName = element.getAttribute('data-location');
  const location = locationGroups[locationName];

  document.querySelectorAll('.location-section').forEach(s => {
    s.classList.remove('active');
  });
  element.classList.add('active');

  updateMapOverlay(location);

  map.flyTo([location.lat, location.lng], 10, {
    duration: 1.5,
    easeLinearity: 0.2
  });

  // Highlight marker
  Object.values(markers).forEach(marker => {
    const el = marker.getElement();
    if (el) {
      el.querySelector('.map-marker').style.cssText = `
        width: 12px; height: 12px;
        background: #4fc3f7;
        border: 2px solid #0a0a0a;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(79, 195, 247, 0.5);
      `;
    }
  });

  const activeMarker = markers[locationName];
  if (activeMarker) {
    const el = activeMarker.getElement();
    if (el) {
      el.querySelector('.map-marker').style.cssText = `
        width: 20px; height: 20px;
        background: #4fc3f7;
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(79, 195, 247, 0.8);
        animation: pulse-marker 2s infinite;
      `;
    }
    activeMarker.openPopup();
  }
}

function updateMapOverlay(location) {
  const name = document.getElementById('mapLocationName');
  const meta = document.getElementById('mapLocationMeta');

  name.textContent = location.name;

  const themeList = Object.keys(location.themes).slice(0, 3).join(', ');
  meta.innerHTML = `
    ${location.country} • ${location.documents.length} documents • Themes: ${themeList}
  `;
}

// Styles
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse-marker {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.8; }
  }

  .leaflet-popup-content-wrapper {
    background: #0a0a0a;
    border: 1px solid #2a2a2a;
    border-radius: 0;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .leaflet-popup-tip {
    background: #0a0a0a;
    border: 1px solid #2a2a2a;
  }

  .leaflet-control-zoom a {
    background: #1a1a1a;
    color: #4fc3f7;
    border: 1px solid #2a2a2a;
  }
`;
document.head.appendChild(style);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { init };
