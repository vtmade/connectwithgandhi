/**
 * Gandhi Knowledge Graph - Main Application
 */

import { RadialChart } from './radial.js';

// Configuration
const CONFIG = {
  dataPath: '/data/',
  files: {
    nodes: 'nodes.json',
    edges: 'edges.json',
    metadata: 'metadata.json'
  }
};

// Global state
let chart = null;
let metadata = null;

// Initialize application
async function init() {
  console.log('Initializing Gandhi Knowledge Graph...');

  try {
    // Initialize radial chart
    chart = new RadialChart('#graph-container');

    // Load data
    await chart.loadData(
      CONFIG.dataPath + CONFIG.files.nodes,
      CONFIG.dataPath + CONFIG.files.edges,
      CONFIG.dataPath + CONFIG.files.metadata
    );

    // Render radial chart
    chart.render();

    // Update UI
    updateStats();

    // Setup event listeners
    setupEventListeners();

    // Hide loading screen
    hideLoading();

    // Let simulation run for a bit, then fit to view
    setTimeout(() => {
      console.log('Fitting graph to view...');
      graph.zoomFit();
    }, 1500);

    console.log('✓ Application initialized successfully');

  } catch (error) {
    console.error('Failed to initialize:', error);
    showError('Failed to load data. Please refresh the page.');
  }
}

async function loadMetadata() {
  const response = await fetch(CONFIG.dataPath + CONFIG.files.metadata);
  return await response.json();
}

function hideLoading() {
  const loading = document.getElementById('loading-screen');
  const app = document.getElementById('app');

  loading.classList.add('hidden');
  app.classList.remove('hidden');
}

function showError(message) {
  const loading = document.getElementById('loading-screen');
  loading.querySelector('.loading-text').textContent = message;
  loading.querySelector('.loading-spinner').style.display = 'none';
}

function updateStats() {
  document.getElementById('node-count').textContent = chart.nodes.length.toLocaleString();
  document.getElementById('edge-count').textContent = chart.edges.length.toLocaleString();
}

function setupEventListeners() {
  // Arc selection
  document.addEventListener('arcSelected', (event) => {
    const arcData = event.detail.data;
    showArcDetails(arcData);
  });

  // Graph filtered
  document.addEventListener('graphFiltered', (event) => {
    updateStats();
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }

    const matches = graph.searchNode(query);
    displaySearchResults(matches.slice(0, 10));
  });

  searchInput.addEventListener('blur', () => {
    // Delay to allow click on results
    setTimeout(() => {
      searchResults.classList.add('hidden');
    }, 200);
  });

  // Type filters
  const typeFilters = document.querySelectorAll('.filter-group input[type="checkbox"]');
  typeFilters.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const activeTypes = new Set();
      typeFilters.forEach(cb => {
        if (cb.checked) activeTypes.add(cb.value);
      });

      graph.applyFilters({ types: activeTypes });
    });
  });

  // Timeline slider
  const timelineSlider = document.getElementById('timeline-slider');
  const currentYearDisplay = document.getElementById('current-year');

  timelineSlider.addEventListener('input', (e) => {
    const year = parseInt(e.target.value);
    currentYearDisplay.textContent = year;

    // Apply year filter
    graph.applyFilters({ year: year });
  });

  // Reset button
  document.getElementById('reset-view').addEventListener('click', () => {
    graph.reset();

    // Reset UI
    typeFilters.forEach(cb => cb.checked = true);
    timelineSlider.value = timelineSlider.max;
    currentYearDisplay.textContent = timelineSlider.max;
    searchInput.value = '';

    closePanel();
  });

  // Zoom controls
  document.getElementById('zoom-in').addEventListener('click', () => {
    chart.zoomIn();
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    chart.zoomOut();
  });

  document.getElementById('zoom-fit')?.addEventListener('click', () => {
    // Radial chart doesn't need fit
    chart.reset();
  });

  // Close panel
  document.getElementById('close-panel').addEventListener('click', () => {
    closePanel();
    chart.reset();
  });

  // Click on background to clear selection
  document.getElementById('graph-svg').addEventListener('click', (e) => {
    if (e.target.tagName === 'svg') {
      chart.reset();
      closePanel();
    }
  });

  // Radial chart doesn't need physics controls - skip
}

function displaySearchResults(results) {
  const container = document.getElementById('search-results');

  if (results.length === 0) {
    container.innerHTML = '<div style="padding: 12px; color: #999;">No results found</div>';
    container.classList.remove('hidden');
    return;
  }

  container.innerHTML = results.map(node => `
    <div class="search-result-item" data-node-id="${node.id}" style="
      padding: 12px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background 0.2s;
    " onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
      <div style="font-weight: 500;">${node.label}</div>
      <div style="font-size: 0.85rem; color: #666; margin-top: 4px;">
        ${node.type} ${node.properties?.date ? `• ${node.properties.date}` : ''}
      </div>
    </div>
  `).join('');

  container.classList.remove('hidden');

  // Add click handlers
  container.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const nodeId = item.dataset.nodeId;
      graph.focusNode(nodeId);
      container.classList.add('hidden');
      document.getElementById('search-input').value = '';
    });
  });
}

function showArcDetails(arcData) {
  const panel = document.getElementById('reading-panel');
  const content = document.getElementById('panel-content');

  let html = `
    <h2>${arcData.name}</h2>
    <div class="metadata">
      <div class="metadata-item">
        <div class="metadata-label">Type</div>
        <div class="metadata-value">${arcData.category ? 'Theme Category' : 'Theme'}</div>
      </div>
      ${arcData.documentCount ? `
      <div class="metadata-item">
        <div class="metadata-label">Documents</div>
        <div class="metadata-value">${arcData.documentCount}</div>
      </div>
      ` : ''}
    </div>
    <div class="content-text">
      ${arcData.category ?
        `This is a major thematic category in Gandhi's writings. Click on the sub-themes to explore specific topics.` :
        `This theme appears in ${arcData.documentCount || 0} documents in the sample. Explore connected nodes to see related documents.`
      }
    </div>
  `;

  content.innerHTML = html;
  panel.classList.remove('hidden');
}

function showNodeDetails(node) {
  const panel = document.getElementById('reading-panel');
  const content = document.getElementById('panel-content');

  // Build content based on node type
  let html = '';

  if (node.type === 'document') {
    html = `
      <h2>${node.properties.title}</h2>
      <div class="metadata">
        <div class="metadata-item">
          <div class="metadata-label">Type</div>
          <div class="metadata-value">${node.properties.docType}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Date Written</div>
          <div class="metadata-value">${node.properties.date}</div>
        </div>
        ${node.properties.addressee ? `
        <div class="metadata-item">
          <div class="metadata-label">Addressed To</div>
          <div class="metadata-value">${node.properties.addressee}</div>
        </div>
        ` : ''}
        ${node.properties.writtenFrom ? `
        <div class="metadata-item">
          <div class="metadata-label">Written From</div>
          <div class="metadata-value">${node.properties.writtenFrom}</div>
        </div>
        ` : ''}
        <div class="metadata-item">
          <div class="metadata-label">Volume</div>
          <div class="metadata-value">Vol ${node.properties.volume}, Section ${node.properties.section}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Language</div>
          <div class="metadata-value">${node.properties.language}</div>
        </div>
        ${node.properties.source ? `
        <div class="metadata-item">
          <div class="metadata-label">Source</div>
          <div class="metadata-value">${node.properties.source}</div>
        </div>
        ` : ''}
      </div>

      <div class="document-context" style="background: rgba(6, 182, 212, 0.1); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--color-primary);">Context</h3>
        <p style="font-size: 0.95rem; line-height: 1.6;">
          This ${node.properties.docType.toLowerCase()} was written ${node.properties.date ? 'on ' + node.properties.date : 'during Gandhi\'s lifetime'}${node.properties.writtenFrom ? ' from ' + node.properties.writtenFrom : ''}${node.properties.addressee ? ' and addressed to ' + node.properties.addressee : ''}.
          ${node.properties.source ? ' Originally published in ' + node.properties.source + '.' : ''}
        </p>
      </div>

      <div class="content-text">
        ${formatContent(node.properties.fullContent)}
      </div>
      ${formatFootnotes(node.properties.footnotes)}
    `;
  } else if (node.type === 'theme') {
    html = `
      <h2>${node.properties.name}</h2>
      <div class="metadata">
        <div class="metadata-item">
          <div class="metadata-label">Type</div>
          <div class="metadata-value">Theme</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Related Documents</div>
          <div class="metadata-value">${node.properties.documentCount}</div>
        </div>
      </div>
      <div class="content-text">
        <strong>Keywords:</strong> ${node.properties.keywords.join(', ')}
        <br/><br/>
        This theme appears in ${node.properties.documentCount} documents in the sample.
        Click on connected nodes to explore related documents.
      </div>
    `;
  } else if (node.type === 'person') {
    html = `
      <h2>${node.properties.name}</h2>
      <div class="metadata">
        <div class="metadata-item">
          <div class="metadata-label">Type</div>
          <div class="metadata-value">Person</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Mentions</div>
          <div class="metadata-value">${node.properties.mentionCount}</div>
        </div>
      </div>
      <div class="content-text">
        Mentioned ${node.properties.mentionCount} times in the sampled documents.
        <br/><br/>
        Explore connected documents to see references and context.
      </div>
    `;
  } else if (node.type === 'event') {
    html = `
      <h2>${node.properties.name}</h2>
      <div class="metadata">
        <div class="metadata-item">
          <div class="metadata-label">Type</div>
          <div class="metadata-value">Historical Event</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Date</div>
          <div class="metadata-value">${node.properties.date}</div>
        </div>
      </div>
      <div class="content-text">
        A significant historical event from ${node.properties.year}.
        <br/><br/>
        Explore connected documents to see how Gandhi wrote about this event.
      </div>
    `;
  } else if (node.type === 'period') {
    html = `
      <h2>${node.properties.decade}</h2>
      <div class="metadata">
        <div class="metadata-item">
          <div class="metadata-label">Type</div>
          <div class="metadata-value">Time Period</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Documents</div>
          <div class="metadata-value">${node.properties.documentCount}</div>
        </div>
      </div>
      <div class="content-text">
        ${node.properties.documentCount} documents from this decade in the sample.
        <br/><br/>
        Explore connected documents from this time period.
      </div>
    `;
  } else {
    html = `
      <h2>${node.label}</h2>
      <div class="content-text">
        Type: ${node.type}
        <br/><br/>
        ${JSON.stringify(node.properties, null, 2)}
      </div>
    `;
  }

  content.innerHTML = html;
  panel.classList.remove('hidden');
}

function formatContent(content) {
  if (!content) return '';

  // Replace footnote markers with superscript
  let formatted = content.replace(/\{(\d+)\}/g, '<sup>[$1]</sup>');

  // Basic paragraph breaks (double newline)
  formatted = formatted.replace(/\n\n/g, '<br/><br/>');

  return formatted;
}

function formatFootnotes(footnotes) {
  if (!footnotes || Object.keys(footnotes).length === 0) return '';

  let html = '<div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd;">';
  html += '<h3 style="font-size: 1.2rem; margin-bottom: 1rem;">Footnotes</h3>';

  for (const [num, text] of Object.entries(footnotes)) {
    html += `<div style="margin-bottom: 1rem;">
      <strong>[${num}]</strong> ${text}
    </div>`;
  }

  html += '</div>';
  return html;
}

function closePanel() {
  document.getElementById('reading-panel').classList.add('hidden');
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.chart = chart;
