/**
 * Interactive Horizontal Tree Visualization with Document Viewer
 * MECE-based hierarchical exploration of Gandhi's writings
 */

import * as d3 from 'd3';

const CONFIG = {
  dataPath: '/data/radial_tree.json',
  width: null,
  height: null,
  colors: {
    // Period colors
    'Early Life & Education': '#FF6B9D',
    'South Africa Struggle': '#FFA07A',
    'Return to India': '#FFD700',
    'Non-cooperation Movement': '#98D8C8',
    'Civil Disobedience Era': '#6495ED',
    'Final Years & Independence': '#DA70D6',

    // Theme colors
    'Philosophy of Truth & Non-violence': '#FF1493',
    'Freedom Struggle & Independence': '#FF4500',
    'Social Reform & Equality': '#32CD32',
    'Economic Self-reliance & Village Life': '#FFD700',
    'Religion & Spiritual Life': '#9370DB',
    'Education & Character Building': '#20B2AA',
    'Health & Wellness': '#FF69B4',
    'Political Organization & Congress': '#4169E1',
    'Personal Correspondence & Relationships': '#DDA0DD'
  },
  colorPalette: [
    '#FF6B9D', '#FFA07A', '#FFD700', '#98D8C8', '#6495ED', '#DA70D6',
    '#FF1493', '#FF4500', '#32CD32', '#20B2AA', '#9370DB', '#4169E1'
  ]
};

let treeData = null;
let svg = null;
let g = null;
let root = null;
let zoom = null;
let i = 0;
let duration = 750;

async function init() {
  try {
    console.log('Fetching data from:', CONFIG.dataPath);
    const response = await fetch(CONFIG.dataPath, {
      mode: 'cors',
      redirect: 'follow'
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    treeData = await response.json();

    console.log('Loaded tree data:', treeData);

    buildUI();
    createVisualization();

  } catch (error) {
    console.error('Error loading data:', error);
    document.getElementById('app').innerHTML = `
      <div class="loading" style="color: #f44336;">
        <p>Error loading data: ${error.message}</p>
        <p style="font-size: 0.9rem; margin-top: 1rem;">Check browser console for details.</p>
      </div>
    `;
  }
}

function buildUI() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div id="container">
      <div id="sidebar">
        <div class="sidebar-left">
          <div class="title-section">
            <h1>Gandhi's Collected Works Explorer</h1>
            <div class="subtitle">Interactive Thematic Navigation of 45,458 Documents (1869-1948)</div>
            <div class="usage-note">
              <strong>How to use:</strong> Click nodes to expand → Navigate themes → Explore document types → Read individual writings in right panel
            </div>
            <div class="viz-credit">
              Visualization created by <a href="https://github.com/vtmade/vtmade" target="_blank">Vinay Thakur</a>
            </div>
          </div>

          <button id="reset-btn" onclick="resetTree()">↻ Reset View</button>

          <div class="stats" id="stats">
            <div class="stat-item">
              <span class="stat-value" id="stat-documents">-</span>
              <span class="stat-label">Documents</span>
            </div>
          </div>
        </div>

        <div class="sidebar-right">
          <div class="credits">
            <div>Data Source: <a href="https://github.com/AbelTheGeorge/Collected-Works-of-Mahatma-Gandhi" target="_blank">Collected Works of Mahatma Gandhi</a></div>
            <div>Original compilation by Publications Division, Ministry of Information & Broadcasting, Government of India</div>
          </div>
        </div>
      </div>

      <div id="viz-container">
        <div id="tree-canvas"></div>
      </div>

      <div id="document-viewer">
        <div class="viewer-header">Document Viewer</div>
        <div id="document-content">
          <div style="text-align: center; padding: 3rem 2rem; color: var(--color-text-dim);">
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">Select a document to view</p>
            <p style="font-size: 0.9rem; line-height: 1.6;">
              Navigate through the tree and click on any document to see its full details, including metadata, thematic context, and complete content.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  updateStats();
}

window.resetTree = function() {
  console.log('Resetting tree to initial state');

  // Collapse all nodes except root
  root.descendants().forEach(d => {
    if (d.depth > 0) {
      d._children = d.children;
      d.children = null;
    }
  });

  // Clear document viewer
  const content = document.getElementById('document-content');
  content.innerHTML = `
    <div style="text-align: center; padding: 3rem 2rem; color: var(--color-text-dim);">
      <p style="font-size: 1.1rem; margin-bottom: 1rem;">Select a document to view</p>
      <p style="font-size: 0.9rem; line-height: 1.6;">
        Navigate through the tree and click on any document to see its full details, including metadata, thematic context, and complete content.
      </p>
    </div>
  `;

  // Reset zoom and center
  const container = document.getElementById('tree-canvas');
  const height = container.clientHeight;

  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(100, height / 2));

  update(root);
};

function updateStats() {
  // Count all documents in the tree
  let totalDocs = 0;
  function countDocs(node) {
    if (node.children) {
      node.children.forEach(child => countDocs(child));
    } else if (node.doc) {
      totalDocs++;
    }
  }
  treeData.children.forEach(cat => countDocs(cat));

  document.getElementById('stat-documents').textContent = totalDocs.toLocaleString();
}

function createVisualization() {
  const container = document.getElementById('tree-canvas');
  const width = container.clientWidth;
  const height = container.clientHeight;

  CONFIG.width = width;
  CONFIG.height = height;

  // Create SVG
  svg = d3.select('#tree-canvas')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', '#0a0a0a');

  g = svg.append('g')
    .attr('transform', `translate(100, ${height / 2})`);

  // Add zoom and pan behavior
  zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);
  svg.call(zoom.transform, d3.zoomIdentity.translate(100, height / 2));

  // Create hierarchy
  root = d3.hierarchy(treeData);

  // Assign initial positions
  root.x0 = 0;
  root.y0 = 0;

  // Collapse ALL nodes except root - show only "Collected Works"
  root.descendants().forEach(d => {
    if (d.depth > 0) {
      d._children = d.children;
      d.children = null;
    }
  });

  update(root);
}

function update(source) {
  console.log('Update called with source:', source.data.name);

  // Create tree layout with better separation for deeper nodes
  const treeLayout = d3.tree()
    .size([CONFIG.height - 100, CONFIG.width - 400])
    .separation((a, b) => {
      // More spacing for deeper levels
      const baseSpacing = a.parent == b.parent ? 1 : 1.5;
      const depthMultiplier = 1 + (a.depth * 0.1); // Increase spacing by 10% per depth level
      return baseSpacing * depthMultiplier;
    });

  // Compute new tree layout
  treeLayout(root);

  const nodes = root.descendants();
  const links = root.links();

  // Normalize for fixed-depth with increased spacing for deeper levels
  nodes.forEach(d => {
    // Increase horizontal spacing as we go deeper
    const baseSpacing = 200;
    const depthIncrement = 50; // Add 50px per level
    d.y = d.depth * (baseSpacing + (d.depth * depthIncrement));
  });

  console.log('Total nodes:', nodes.length, 'Total links:', links.length);

  // ********** Update Links **********
  const link = g.selectAll('path.link')
    .data(links, d => d.target.id || (d.target.id = ++i));

  // Enter new links
  const linkEnter = link.enter()
    .insert('path', 'g')
    .attr('class', 'link')
    .attr('d', d => {
      const o = {x: source.x0, y: source.y0};
      return diagonal(o, o);
    })
    .attr('stroke', d => getNodeColor(d.target))
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.4)
    .attr('fill', 'none');

  // Update existing + entering links
  const linkUpdate = linkEnter.merge(link);

  linkUpdate.transition()
    .duration(duration)
    .attr('d', d => diagonal(d.source, d.target));

  // Remove exiting links
  link.exit()
    .transition()
    .duration(duration)
    .attr('d', d => {
      const o = {x: source.x, y: source.y};
      return diagonal(o, o);
    })
    .remove();

  // ********** Update Nodes **********
  const node = g.selectAll('g.node')
    .data(nodes, d => d.id || (d.id = ++i));

  // Enter new nodes at parent's previous position
  const nodeEnter = node.enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${source.y0},${source.x0})`)
    .on('click', click);

  nodeEnter.append('circle')
    .attr('r', 1e-6)
    .style('fill', d => d._children ? getNodeColor(d) : '#fff')
    .style('stroke', d => getNodeColor(d))
    .style('stroke-width', 2);

  nodeEnter.append('text')
    .attr('dy', '.35em')
    .attr('x', 13)
    .attr('text-anchor', 'start')
    .text(d => {
      const name = d.data.name;
      if (d.depth === 0) return name;
      if (name.length > 50) return name.substring(0, 50) + '...';
      return name;
    })
    .style('fill', '#e0e0e0')
    .style('font-size', d => {
      if (d.depth === 0) return '16px';
      if (d.depth === 1) return '14px';
      if (d.depth === 2) return '12px';
      return '10px';
    })
    .style('font-weight', d => d.depth <= 1 ? 700 : d.depth === 2 ? 600 : 400)
    .style('fill-opacity', 1e-6);

  // Update existing + entering nodes
  const nodeUpdate = nodeEnter.merge(node);

  nodeUpdate.transition()
    .duration(duration)
    .attr('transform', d => `translate(${d.y},${d.x})`);

  nodeUpdate.select('circle')
    .attr('r', d => {
      if (d.depth === 0) return 10;
      if (d.depth === 1) return 8;
      if (d.depth === 2) return 6;
      return 4;
    })
    .style('fill', d => d._children ? getNodeColor(d) : '#fff')
    .attr('cursor', 'pointer');

  nodeUpdate.select('text')
    .style('fill-opacity', 1);

  // Remove exiting nodes
  const nodeExit = node.exit()
    .transition()
    .duration(duration)
    .attr('transform', d => `translate(${source.y},${source.x})`)
    .remove();

  nodeExit.select('circle')
    .attr('r', 1e-6);

  nodeExit.select('text')
    .style('fill-opacity', 1e-6);

  // Store old positions for transition
  nodes.forEach(d => {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

// Diagonal path generator for horizontal tree
function diagonal(s, d) {
  return `M ${s.y} ${s.x}
          C ${(s.y + d.y) / 2} ${s.x},
            ${(s.y + d.y) / 2} ${d.x},
            ${d.y} ${d.x}`;
}

// Toggle children on click
function click(event, d) {
  console.log('Clicked:', d.data.name, 'depth:', d.depth, 'children:', !!d.children, '_children:', !!d._children, 'doc:', !!d.data.doc);

  // Check if this is a leaf node (document)
  if (d.data.doc) {
    console.log('Opening document viewer for:', d.data.name);
    showDocumentViewer(d);
    return;
  }

  // Toggle children
  if (d.children) {
    console.log('Collapsing node');
    d._children = d.children;
    d.children = null;
  } else if (d._children) {
    console.log('Expanding node');
    d.children = d._children;
    d._children = null;
  } else {
    console.log('No children to toggle');
  }

  update(d);
}

function getNodeColor(d) {
  if (d.depth === 0) return '#ffa726';

  // Color by top-level period (depth 1)
  if (d.depth === 1) {
    return CONFIG.colors[d.data.name] || CONFIG.colorPalette[0];
  }

  // Color by second level theme (depth 2)
  if (d.depth === 2) {
    return CONFIG.colors[d.data.name] || CONFIG.colorPalette[d.parent.children.indexOf(d) % CONFIG.colorPalette.length];
  }

  // For deeper nodes, inherit from period
  let node = d;
  while (node.depth > 1) {
    node = node.parent;
  }

  const periodName = node.data.name;
  const baseColor = CONFIG.colors[periodName] || CONFIG.colorPalette[0];

  // Lighten colors for deeper levels
  if (d.depth === 3) return d3.color(baseColor).brighter(0.5);
  if (d.depth === 4) return d3.color(baseColor).brighter(1);
  return d3.color(baseColor).brighter(1.5);
}

function showDocumentViewer(doc) {
  console.log('showDocumentViewer called with:', doc.data.name);
  console.log('Document data:', doc.data.doc);

  const viewer = document.getElementById('document-viewer');
  const content = document.getElementById('document-content');

  if (!viewer) {
    console.error('Document viewer element not found!');
    return;
  }

  if (!content) {
    console.error('Document content element not found!');
    return;
  }

  // Extract theme path from ancestors
  const themes = [];
  let current = doc;
  while (current.parent) {
    themes.unshift(current.parent.data.name);
    current = current.parent;
  }

  console.log('Theme path:', themes);

  // Generate context summary based on theme path
  const category = themes[1] || 'General';
  const theme = themes[2] || '';
  const subtheme = themes[3] || '';
  const topic = themes[4] || '';

  let contextSummary = '';
  if (category && theme) {
    contextSummary = `This document is categorized under <strong>${category}</strong>, specifically relating to <strong>${theme}</strong>`;
    if (subtheme) contextSummary += ` and focuses on <strong>${subtheme}</strong>`;
    if (topic) contextSummary += `, particularly addressing <strong>${topic}</strong>`;
    contextSummary += '.';
  }

  // Generate document type description
  const typeDesc = {
    'LETTER': 'a personal letter',
    'SPEECH': 'a public speech or address',
    'ARTICLE': 'an article or essay',
    'STATEMENT': 'a public statement',
    'INTERVIEW': 'an interview',
    'MESSAGE': 'a message or greeting',
    'TELEGRAM': 'a telegram',
    'ADDRESS': 'a formal address'
  };
  const docTypeDesc = typeDesc[doc.data.doc.type] || 'a document';

  const htmlContent = `
    <h2 style="color: var(--color-accent); margin-bottom: 1.5rem; line-height: 1.4;">${doc.data.doc.title}</h2>

    <div class="doc-meta" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--color-bg); border-radius: 4px;">
      <div class="doc-meta-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.9rem;">
        <span class="meta-label" style="color: var(--color-text-dim); font-weight: 500;">Date</span>
        <span class="meta-value" style="color: var(--color-text);">${doc.data.doc.date}</span>
      </div>
      <div class="doc-meta-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.9rem;">
        <span class="meta-label" style="color: var(--color-text-dim); font-weight: 500;">Type</span>
        <span class="meta-value" style="color: var(--color-text);">${doc.data.doc.type}</span>
      </div>
      <div class="doc-meta-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.9rem;">
        <span class="meta-label" style="color: var(--color-text-dim); font-weight: 500;">Volume</span>
        <span class="meta-value" style="color: var(--color-text);">${doc.data.doc.volume}</span>
      </div>
      ${doc.data.doc.addressee && doc.data.doc.addressee !== 'Unknown' ? `
      <div class="doc-meta-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.9rem;">
        <span class="meta-label" style="color: var(--color-text-dim); font-weight: 500;">To</span>
        <span class="meta-value" style="color: var(--color-text);">${doc.data.doc.addressee}</span>
      </div>
      ` : ''}
      ${doc.data.doc.source && doc.data.doc.source !== 'Unknown' ? `
      <div class="doc-meta-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.9rem;">
        <span class="meta-label" style="color: var(--color-text-dim); font-weight: 500;">Source</span>
        <span class="meta-value" style="color: var(--color-text);">${doc.data.doc.source}</span>
      </div>
      ` : ''}
    </div>

    <div class="doc-section" style="margin-bottom: 2rem;">
      <h3 style="font-size: 0.9rem; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1rem; font-weight: 600;">Thematic Context</h3>
      <div class="theme-badges" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
        ${themes.slice(1).map(t => `<div class="theme-badge" style="padding: 0.4rem 0.8rem; background: rgba(255, 167, 38, 0.1); border: 1px solid var(--color-accent); border-radius: 12px; font-size: 0.85rem; color: var(--color-accent);">${t.replace(/\s*\(\d+\s+docs\)/, '')}</div>`).join('')}
      </div>
      <p style="margin-top: 1rem; line-height: 1.6; color: #94a3b8; font-size: 0.9rem;">
        ${contextSummary}
      </p>
    </div>

    <div class="doc-section" style="margin-bottom: 2rem;">
      <h3 style="font-size: 0.9rem; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1rem; font-weight: 600;">About This Document</h3>
      <p style="line-height: 1.6; color: #94a3b8; font-size: 0.9rem;">
        This is ${docTypeDesc} ${doc.data.doc.addressee && doc.data.doc.addressee !== 'Unknown' ? `written to <strong>${doc.data.doc.addressee}</strong>` : ''}
        dated <strong>${doc.data.doc.date}</strong>,
        found in Volume <strong>${doc.data.doc.volume}</strong> of the Collected Works of Mahatma Gandhi.
      </p>
    </div>

    <div class="doc-section" style="margin-bottom: 2rem;">
      <h3 style="font-size: 0.9rem; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1rem; font-weight: 600;">Full Content</h3>
      <div class="doc-content" style="line-height: 1.8; color: var(--color-text); font-size: 0.95rem; white-space: pre-wrap;">${doc.data.doc.fullContent || doc.data.doc.preview}</div>
    </div>
  `;

  content.innerHTML = htmlContent;
  console.log('Content HTML set, length:', htmlContent.length);

  // Document viewer is now always visible - no need to toggle visibility
  console.log('Document content updated');
}

// Handle window resize
let resizeTimeout;
window.addEventListener('resize', () => {
  if (!treeData) return;

  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const container = document.getElementById('tree-canvas');
    const width = container.clientWidth;
    const height = container.clientHeight;

    CONFIG.width = width;
    CONFIG.height = height;

    svg.attr('width', width).attr('height', height);

    // Update tree layout size
    update(root);
  }, 250);
});

// Initialize
init();
