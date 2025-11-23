/**
 * D3.js Force-Directed Graph for Gandhi Knowledge Graph
 */

import * as d3 from 'd3';

export class KnowledgeGraph {
  constructor(containerId, options = {}) {
    this.container = d3.select(containerId);
    this.svg = this.container.select('svg');

    // Get dimensions - ensure we have valid values
    this.updateDimensions();
    console.log('Graph dimensions:', { width: this.width, height: this.height });

    // Options
    this.colorScheme = options.colorScheme || {};
    this.sizeMapping = options.sizeMapping || { small: 5, medium: 8, large: 12, xlarge: 16 };

    // Data
    this.nodes = [];
    this.edges = [];
    this.originalNodes = [];
    this.originalEdges = [];

    // Selection state
    this.selectedNode = null;
    this.filters = {
      types: new Set(['theme', 'person', 'event', 'period']),
      year: null
    };

    // Initialize
    this.init();
  }

  init() {
    // Set SVG dimensions explicitly
    this.svg
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);

    // Clear any existing content
    this.svg.selectAll('*').remove();

    // Create main group for zooming/panning
    this.g = this.svg.append('g').attr('class', 'graph-group');

    // Create groups for links and nodes (links first so nodes appear on top)
    this.linkGroup = this.g.append('g').attr('class', 'links');
    this.nodeGroup = this.g.append('g').attr('class', 'nodes');

    // Setup zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
        this.currentZoom = event.transform.k;
        this.updateLabelsVisibility();
      });

    this.svg.call(zoom);

    // Store zoom behavior and current zoom level
    this.zoom = zoom;
    this.currentZoom = 1;

    // Display settings (can be controlled by UI)
    this.displaySettings = {
      nodeOpacity: 1.0,
      linkOpacity: 0.5,
      linkThickness: 1.5
    };

    // Create force simulation (will be configured when data loads)
    this.createSimulation();
  }

  updateDimensions() {
    const rect = this.container.node().getBoundingClientRect();
    this.width = rect.width || 800;
    this.height = rect.height || 600;
    console.log('Updated dimensions:', { width: this.width, height: this.height });
  }

  createSimulation() {
    // Initialize force simulation with timeline-based x positioning
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    console.log('Creating simulation with center:', { centerX, centerY });
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink()
        .id(d => d.id)
        .distance(80)
        .strength(0.3)
      )
      .force('charge', d3.forceManyBody()
        .strength(-200)
        .distanceMax(300)
      )
      .force('center', d3.forceCenter(centerX, centerY)
        .strength(0.05)
      )
      .force('x', d3.forceX(d => this.getTimelineX(d)).strength(0.8))
      .force('y', d3.forceY(d => this.getTimelineY(d)).strength(0.3))
      .force('collision', d3.forceCollide()
        .radius(d => this.getNodeSize(d) + 4)
        .strength(0.7)
      );
  }

  getTimelineX(node) {
    // Map years 1884-1929 to horizontal position across the width
    const minYear = 1884;
    const maxYear = 1929;
    const margin = 100; // Margin from edges

    let year = null;

    if (node.type === 'period') {
      // Period nodes use their decade year
      year = node.properties?.year || minYear;
    } else if (node.type === 'document' || node.type === 'event') {
      // Documents and events use their specific year
      year = node.properties?.year || minYear;
    } else if (node.type === 'theme' || node.type === 'person') {
      // Use calculated average year from connected documents
      year = node.properties?.avgYear || (minYear + (maxYear - minYear) / 2);
    } else {
      // Default to middle of timeline
      year = (minYear + maxYear) / 2;
    }

    // Map year to x position
    const yearRange = maxYear - minYear;
    const xRange = this.width - (2 * margin);
    const x = margin + ((year - minYear) / yearRange) * xRange;

    return x;
  }

  getTimelineY(node) {
    // Group nodes vertically by type for better organization
    const centerY = this.height / 2;
    const verticalSpacing = this.height / 6;

    switch(node.type) {
      case 'event':
        return centerY - verticalSpacing * 1.5;
      case 'person':
        return centerY - verticalSpacing * 0.5;
      case 'document':
        return centerY;
      case 'theme':
        return centerY + verticalSpacing * 0.5;
      case 'period':
        return centerY + verticalSpacing * 1.5;
      default:
        return centerY;
    }
  }

  async loadData(nodesPath, edgesPath) {
    try {
      const [nodes, edges] = await Promise.all([
        d3.json(nodesPath),
        d3.json(edgesPath)
      ]);

      this.originalNodes = nodes;
      this.originalEdges = edges;

      // Initialize node positions at center with random spread
      const centerX = this.width / 2;
      const centerY = this.height / 2;

      console.log('Initializing nodes at center:', { centerX, centerY });

      this.nodes = nodes.map(node => ({
        ...node,
        x: centerX + (Math.random() - 0.5) * 300,
        y: centerY + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0
      }));

      this.edges = [...edges];

      // Calculate average years for themes and people based on connected documents
      this.calculateAverageYears();

      console.log('Loaded data:', {
        nodes: this.nodes.length,
        edges: this.edges.length,
        sampleEdge: this.edges[0]
      });

      return { nodes, edges };
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  calculateAverageYears() {
    // Calculate average years for themes and people based on connected documents
    const yearSums = {};
    const yearCounts = {};

    // Initialize
    this.nodes.forEach(node => {
      if (node.type === 'theme' || node.type === 'person') {
        yearSums[node.id] = 0;
        yearCounts[node.id] = 0;
      }
    });

    // Accumulate years from connected documents
    this.edges.forEach(edge => {
      const sourceNode = this.nodes.find(n => n.id === edge.source);
      const targetNode = this.nodes.find(n => n.id === edge.target);

      // If edge connects a document to a theme/person, use document's year
      if (sourceNode?.type === 'document' && sourceNode.properties?.year) {
        if (targetNode?.type === 'theme' || targetNode?.type === 'person') {
          yearSums[targetNode.id] += sourceNode.properties.year;
          yearCounts[targetNode.id]++;
        }
      }
      if (targetNode?.type === 'document' && targetNode.properties?.year) {
        if (sourceNode?.type === 'theme' || sourceNode?.type === 'person') {
          yearSums[sourceNode.id] += targetNode.properties.year;
          yearCounts[sourceNode.id]++;
        }
      }
    });

    // Calculate averages and store in node properties
    this.nodes.forEach(node => {
      if ((node.type === 'theme' || node.type === 'person') && yearCounts[node.id] > 0) {
        const avgYear = Math.round(yearSums[node.id] / yearCounts[node.id]);
        if (!node.properties) node.properties = {};
        node.properties.avgYear = avgYear;
      }
    });
  }

  getNodeColor(node) {
    return this.colorScheme[node.type] || '#999';
  }

  getNodeSize(node) {
    if (typeof node.size === 'number') return node.size;
    return this.sizeMapping[node.size] || this.sizeMapping.medium;
  }

  render() {
    console.log('Rendering graph with', this.nodes.length, 'nodes and', this.edges.length, 'edges');

    // Render links
    const link = this.linkGroup
      .selectAll('line')
      .data(this.edges)
      .join('line')
      .attr('class', 'link')
      .attr('stroke-width', d => Math.max(Math.sqrt(d.weight || 1) * this.displaySettings.linkThickness, this.displaySettings.linkThickness))
      .style('opacity', this.displaySettings.linkOpacity)
      .attr('stroke', d => {
        // Match edge colors to target node type
        const sourceNode = this.nodes.find(n => n.id === (d.source.id || d.source));
        const targetNode = this.nodes.find(n => n.id === (d.target.id || d.target));

        // Use target node color, or source if target not found
        const nodeToUse = targetNode || sourceNode;
        if (nodeToUse) {
          return this.getNodeColor(nodeToUse);
        }

        return 'rgba(100, 163, 184, 0.3)';
      });

    // Render nodes
    const node = this.nodeGroup
      .selectAll('g.node')
      .data(this.nodes)
      .join('g')
      .attr('class', 'node')
      .attr('data-type', d => d.type)
      .call(this.drag());

    // Add circles
    node.selectAll('circle')
      .data(d => [d])
      .join('circle')
      .attr('class', 'node-circle')
      .attr('r', d => this.getNodeSize(d))
      .attr('fill', d => this.getNodeColor(d))
      .style('opacity', this.displaySettings.nodeOpacity);

    // Add labels (visibility based on zoom and node size)
    node.selectAll('text')
      .data(d => [d])
      .join('text')
      .attr('class', 'node-label')
      .attr('dy', d => this.getNodeSize(d) + 10)
      .text(d => d.label)
      .style('font-size', d => {
        const size = this.getNodeSize(d);
        return size > 5 ? '10px' : '8px';
      });

    // Add interactions
    node
      .on('click', (event, d) => this.onNodeClick(event, d))
      .on('mouseover', (event, d) => this.onNodeHover(event, d))
      .on('mouseout', (event, d) => this.onNodeOut(event, d));

    // Update simulation
    this.simulation
      .nodes(this.nodes)
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .attr('transform', d => `translate(${d.x},${d.y})`);
      });

    this.simulation.force('link').links(this.edges);

    // Use gentle restart to avoid jarring movements
    this.simulation.alpha(0.3).restart();

    // Store references
    this.linkElements = link;
    this.nodeElements = node;

    // Update label visibility
    this.updateLabelsVisibility();
  }

  updateLabelsVisibility() {
    if (!this.nodeElements) return;

    const zoom = this.currentZoom || 1;

    this.nodeElements.selectAll('.node-label')
      .style('opacity', d => {
        const size = this.getNodeSize(d);

        // Always show for large nodes (reduced threshold)
        if (size >= 6) return 1;

        // Show medium nodes at zoom > 1
        if (size >= 4 && zoom > 1) return 1;

        // Show small nodes at zoom > 2
        if (zoom > 2) return 1;

        return 0;
      })
      .style('font-size', d => {
        const size = this.getNodeSize(d);
        const baseSize = size > 5 ? 10 : 8;
        return `${Math.min(baseSize * Math.sqrt(zoom), 14)}px`;
      });
  }

  drag() {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  onNodeClick(event, node) {
    event.stopPropagation();

    this.selectedNode = node;

    // Highlight connected nodes
    this.highlightConnections(node);

    // Dispatch custom event for UI to handle
    const customEvent = new CustomEvent('nodeSelected', {
      detail: { node }
    });
    document.dispatchEvent(customEvent);
  }

  onNodeHover(event, node) {
    // Show tooltip
    const tooltip = d3.select('body').selectAll('.tooltip').data([0]);
    const tooltipEnter = tooltip.enter().append('div').attr('class', 'tooltip');
    const tooltipMerge = tooltipEnter.merge(tooltip);

    tooltipMerge
      .html(`
        <strong>${node.label}</strong><br/>
        Type: ${node.type}<br/>
        ${node.properties?.date ? `Date: ${node.properties.date}<br/>` : ''}
        ${node.properties?.documentCount ? `Documents: ${node.properties.documentCount}` : ''}
      `)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY + 10) + 'px')
      .classed('visible', true);
  }

  onNodeOut(event, node) {
    d3.select('.tooltip').classed('visible', false);
  }

  highlightConnections(node) {
    // Find all connected nodes and links
    const connectedNodeIds = new Set();
    const connectedLinkIds = new Set();

    this.edges.forEach(edge => {
      if (edge.source.id === node.id) {
        connectedNodeIds.add(edge.target.id);
        connectedLinkIds.add(edge.id);
      } else if (edge.target.id === node.id) {
        connectedNodeIds.add(edge.source.id);
        connectedLinkIds.add(edge.id);
      }
    });

    // Highlight/dim nodes
    this.nodeElements
      .classed('dimmed', d => d.id !== node.id && !connectedNodeIds.has(d.id))
      .classed('selected', d => d.id === node.id);

    // Highlight/dim links
    this.linkElements
      .classed('highlighted', d => connectedLinkIds.has(d.id))
      .classed('dimmed', d => !connectedLinkIds.has(d.id));
  }

  clearHighlight() {
    this.selectedNode = null;
    this.nodeElements?.classed('dimmed', false).classed('selected', false);
    this.linkElements?.classed('highlighted', false).classed('dimmed', false);
  }

  applyFilters(filters) {
    this.filters = { ...this.filters, ...filters };

    // Store current node positions
    const nodePositions = new Map();
    this.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        nodePositions.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
      }
    });

    // Filter nodes
    this.nodes = this.originalNodes.filter(node => {
      // Always show documents - they connect everything
      if (node.type === 'document') {
        // Filter documents by year if timeline is set
        if (this.filters.year && node.properties?.year) {
          if (node.properties.year > this.filters.year) {
            return false;
          }
        }
        return true;
      }

      // Type filter for non-document nodes
      if (!this.filters.types.has(node.type)) return false;

      // Year filter - for period nodes, check the decade year
      if (this.filters.year) {
        if (node.type === 'period') {
          // Period nodes represent decades, keep them if their decade is <= filter year
          if (node.properties?.year && node.properties.year > this.filters.year) {
            return false;
          }
        } else if (node.properties?.year) {
          // For other nodes, filter by their year property
          if (node.properties.year > this.filters.year) {
            return false;
          }
        }
      }

      return true;
    });

    // Restore positions for nodes that are still visible
    this.nodes.forEach(node => {
      const savedPos = nodePositions.get(node.id);
      if (savedPos) {
        node.x = savedPos.x;
        node.y = savedPos.y;
        node.vx = savedPos.vx || 0;
        node.vy = savedPos.vy || 0;
      }
    });

    // Filter edges to only include edges between visible nodes
    const nodeIds = new Set(this.nodes.map(n => n.id));
    this.edges = this.originalEdges.filter(edge => {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    // Re-render
    this.render();

    // Dispatch event
    const event = new CustomEvent('graphFiltered', {
      detail: { nodeCount: this.nodes.length, edgeCount: this.edges.length }
    });
    document.dispatchEvent(event);
  }

  zoomIn() {
    this.svg.transition().call(this.zoom.scaleBy, 1.3);
  }

  zoomOut() {
    this.svg.transition().call(this.zoom.scaleBy, 0.7);
  }

  zoomFit() {
    try {
      const bounds = this.g.node().getBBox();
      const fullWidth = this.width;
      const fullHeight = this.height;
      const width = bounds.width;
      const height = bounds.height;
      const midX = bounds.x + width / 2;
      const midY = bounds.y + height / 2;

      console.log('Zoom fit bounds:', { bounds, fullWidth, fullHeight });

      if (width === 0 || height === 0) {
        console.warn('Empty bounds, using fallback zoom');
        // Fallback: just center at current position
        this.svg.transition()
          .duration(750)
          .call(
            this.zoom.transform,
            d3.zoomIdentity.translate(0, 0).scale(0.8)
          );
        return;
      }

      const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
      const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

      console.log('Applying zoom:', { scale, translate });

      this.svg.transition()
        .duration(750)
        .call(
          this.zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    } catch (error) {
      console.error('Error in zoomFit:', error);
    }
  }

  searchNode(query) {
    const lowerQuery = query.toLowerCase();
    const matches = this.originalNodes.filter(node =>
      node.label.toLowerCase().includes(lowerQuery) ||
      node.properties?.name?.toLowerCase().includes(lowerQuery)
    );
    return matches;
  }

  focusNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Zoom to node
    const scale = 2;
    const translate = [
      this.width / 2 - scale * node.x,
      this.height / 2 - scale * node.y
    ];

    this.svg.transition()
      .duration(750)
      .call(
        this.zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );

    // Select node
    setTimeout(() => {
      this.onNodeClick({ stopPropagation: () => {} }, node);
    }, 800);
  }

  reset() {
    this.clearHighlight();
    this.filters = {
      types: new Set(['theme', 'person', 'event', 'period']),
      year: null
    };

    // Re-center all nodes
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    this.nodes.forEach(node => {
      node.fx = null;
      node.fy = null;
    });

    // Update force centers with timeline positioning
    this.simulation
      .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
      .force('x', d3.forceX(d => this.getTimelineX(d)).strength(0.8))
      .force('y', d3.forceY(d => this.getTimelineY(d)).strength(0.3))
      .alpha(1)
      .restart();

    this.applyFilters(this.filters);

    setTimeout(() => {
      this.zoomFit();
    }, 1000);
  }

  destroy() {
    this.simulation.stop();
    this.svg.selectAll('*').remove();
  }

  // Physics control methods
  updateRepelForce(strength) {
    this.simulation.force('charge').strength(strength);
    this.simulation.alpha(0.3).restart();
  }

  updateLinkDistance(distance) {
    this.simulation.force('link').distance(distance);
    this.simulation.alpha(0.3).restart();
  }

  updateCenterForce(strength) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    this.simulation.force('center').strength(strength * 0.05);
    // X force is timeline-based, keep it strong
    this.simulation.force('x').strength(0.8);
    // Y force can be adjusted
    this.simulation.force('y').strength(strength * 0.3);
    this.simulation.alpha(0.3).restart();
  }

  // Display control methods
  updateNodeOpacity(opacity) {
    this.displaySettings.nodeOpacity = opacity;
    if (this.nodeElements) {
      this.nodeElements.selectAll('.node-circle')
        .style('opacity', opacity);
    }
  }

  updateLinkOpacity(opacity) {
    this.displaySettings.linkOpacity = opacity;
    if (this.linkElements) {
      this.linkElements.style('opacity', opacity);
    }
  }

  updateLinkThickness(thickness) {
    this.displaySettings.linkThickness = thickness;
    if (this.linkElements) {
      this.linkElements.attr('stroke-width', d =>
        Math.max(Math.sqrt(d.weight || 1) * thickness, thickness)
      );
    }
  }
}
