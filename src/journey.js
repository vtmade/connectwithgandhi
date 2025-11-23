/**
 * Gandhi's Journey - Scrollytelling Experience
 */

import scrollama from 'scrollama';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Configuration
const CONFIG = {
  dataPath: '/data/journey.json',
  map: {
    initialView: [20.5937, 78.9629], // India center
    initialZoom: 4,
    maxZoom: 18,
    minZoom: 2
  }
};

// Global state
let map = null;
let markers = {};
let currentMarker = null;
let journeyData = null;
let scroller = null;

// Initialize app
async function init() {
  console.log('Initializing Gandhi Journey...');

  try {
    // Load journey data
    journeyData = await loadJourneyData();
    console.log(`Loaded ${journeyData.journeyPoints.length} journey points`);

    // Initialize map
    initMap();

    // Create timeline narrative
    createNarrative();

    // Setup scrollytelling
    setupScrollytelling();

    console.log('Journey initialization complete!');
  } catch (error) {
    console.error('Error initializing:', error);
  }
}

async function loadJourneyData() {
  const response = await fetch(CONFIG.dataPath);
  const data = await response.json();
  return data;
}

function initMap() {
  // Initialize Leaflet map
  map = L.map('map', {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(CONFIG.map.initialView, CONFIG.map.initialZoom);

  // Add tile layer - using CartoDB Dark Matter for beautiful dark theme
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: CONFIG.map.maxZoom,
    minZoom: CONFIG.map.minZoom
  }).addTo(map);

  // Add all location markers
  journeyData.locations.forEach(location => {
    const marker = L.circleMarker([location.lat, location.lng], {
      radius: 6,
      fillColor: '#06B6D4',
      color: '#fff',
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.6
    }).addTo(map);

    marker.bindPopup(`
      <strong>${location.name}</strong><br/>
      ${location.country}<br/>
      ${location.count} documents
    `);

    markers[location.name] = marker;
  });

  console.log('Map initialized with', Object.keys(markers).length, 'markers');
}

function createNarrative() {
  const narrative = document.getElementById('narrative');

  // Sample selection - take key documents across timeline
  // Group by location and year for better storytelling
  const selectedPoints = selectKeyDocuments(journeyData.journeyPoints, 50);

  selectedPoints.forEach((point, index) => {
    const step = document.createElement('div');
    step.className = 'step';
    step.setAttribute('data-step', index);
    step.setAttribute('data-lat', point.lat);
    step.setAttribute('data-lng', point.lng);
    step.setAttribute('data-location', point.location);

    // Phase badge
    const phaseBadge = point.phase ? `
      <div class="phase-badge" style="background-color: ${point.phaseColor}20; color: ${point.phaseColor}; border: 1px solid ${point.phaseColor}">
        ${point.phase}
      </div>
    ` : '';

    step.innerHTML = `
      ${phaseBadge}
      <h2>${point.title}</h2>
      <div class="meta">
        <span class="location">📍 ${point.location}, ${point.country}</span>
        <span>📅 ${point.date}</span>
        <span>📄 ${point.type}</span>
      </div>
      <div class="content">
        ${formatContent(point.contentPreview)}
      </div>
    `;

    narrative.appendChild(step);
  });

  console.log('Created', selectedPoints.length, 'narrative steps');
}

function selectKeyDocuments(points, targetCount) {
  // Strategy: Sample documents evenly across the timeline
  // Prioritize first/last occurrence at each location

  const locationFirstLast = {};

  // Track first and last at each location
  points.forEach(point => {
    if (!locationFirstLast[point.location]) {
      locationFirstLast[point.location] = { first: point, last: point };
    } else {
      locationFirstLast[point.location].last = point;
    }
  });

  const selected = new Set();

  // Add first and last for each location
  Object.values(locationFirstLast).forEach(({ first, last }) => {
    selected.add(first);
    if (first !== last) selected.add(last);
  });

  // Fill remaining slots with evenly distributed samples
  const step = Math.floor(points.length / targetCount);
  for (let i = 0; i < points.length && selected.size < targetCount; i += step) {
    selected.add(points[i]);
  }

  // Convert to array and sort by date
  return Array.from(selected).sort((a, b) =>
    a.sortDate.localeCompare(b.sortDate)
  );
}

function formatContent(text) {
  // Simple formatting - clean up extra whitespace
  return text
    .replace(/\{(\d+)\}/g, '') // Remove footnote markers
    .replace(/\s+/g, ' ')
    .trim();
}

function setupScrollytelling() {
  // Setup Scrollama
  scroller = scrollama();

  scroller
    .setup({
      step: '.step',
      offset: 0.5,
      debug: false
    })
    .onStepEnter(handleStepEnter)
    .onStepExit(handleStepExit);

  // Resize handler
  window.addEventListener('resize', () => {
    scroller.resize();
  });
}

function handleStepEnter(response) {
  const { element, index, direction } = response;

  // Update active class
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  element.classList.add('active');

  // Get location data
  const lat = parseFloat(element.getAttribute('data-lat'));
  const lng = parseFloat(element.getAttribute('data-lng'));
  const location = element.getAttribute('data-location');

  // Fly to location on map
  map.flyTo([lat, lng], 8, {
    duration: 1.5,
    easeLinearity: 0.25
  });

  // Highlight marker
  if (currentMarker) {
    currentMarker.setStyle({
      radius: 6,
      fillColor: '#06B6D4',
      weight: 2
    });
  }

  if (markers[location]) {
    currentMarker = markers[location];
    currentMarker.setStyle({
      radius: 10,
      fillColor: '#F59E0B',
      weight: 3
    });
    currentMarker.openPopup();
  }
}

function handleStepExit(response) {
  // Optional: handle exit if needed
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { init };
