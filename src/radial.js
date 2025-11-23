/**
 * D3.js Radial Sunburst Chart for Gandhi Knowledge Graph
 * Hierarchical visualization of Philosophical, Social, and Political themes
 */

import * as d3 from 'd3';

export class RadialChart {
  constructor(containerId, options = {}) {
    this.container = d3.select(containerId);
    this.svg = this.container.select('svg');

    // Get dimensions
    this.updateDimensions();

    // Options
    this.colorScheme = options.colorScheme || {};
    this.themeHierarchy = options.themeHierarchy || {};

    // Data
    this.hierarchyData = null;
    this.nodes = [];
    this.edges = [];
    this.documents = [];

    // State
    this.selectedNode = null;

    // Initialize
    this.init();
  }

  init() {
    // Set SVG dimensions
    this.svg
      .attr('width', this.width)
      .attr('height', this.height);

    // Clear existing content
    this.svg.selectAll('*').remove();

    // Create main group centered
    this.g = this.svg.append('g')
      .attr('class', 'radial-group')
      .attr('transform', `translate(${this.width / 2},${this.height / 2})`);

    // Setup zoom
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        this.g.attr('transform',
          `translate(${this.width / 2},${this.height / 2}) scale(${event.transform.k})`);
      });

    this.svg.call(zoom);
    this.zoom = zoom;
  }

  updateDimensions() {
    const rect = this.container.node().getBoundingClientRect();
    this.width = rect.width || 800;
    this.height = rect.height || 600;
    this.radius = Math.min(this.width, this.height) / 2 - 40;
  }

  async loadData(nodesPath, edgesPath, metadataPath) {
    try {
      const [nodes, edges, metadata] = await Promise.all([
        d3.json(nodesPath),
        d3.json(edgesPath),
        d3.json(metadataPath)
      ]);

      this.nodes = nodes;
      this.edges = edges;
      this.colorScheme = metadata.colorScheme;
      this.themeHierarchy = metadata.themeHierarchy;
      this.documents = nodes.filter(n => n.type === 'document');

      // Build hierarchy from theme data
      this.buildHierarchy();

      console.log('Loaded radial data:', {
        nodes: this.nodes.length,
        themes: this.hierarchyData.children.length
      });

      return { nodes, edges, metadata };
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  buildHierarchy() {
    // Create root node
    const root = {
      name: "Gandhi's Themes",
      children: []
    };

    // Build 3-layer hierarchy: Categories > Subcategories > Themes
    Object.keys(this.themeHierarchy).forEach(categoryKey => {
      const category = this.themeHierarchy[categoryKey];
      const categoryNode = {
        name: category.name,
        category: categoryKey,
        color: category.color,
        children: []
      };

      // Add subcategories
      Object.keys(category.themes).forEach(subcategoryKey => {
        const subcategory = category.themes[subcategoryKey];
        const subcategoryNode = {
          name: subcategory.name,
          category: categoryKey,
          subcategory: subcategoryKey,
          color: category.color,
          children: []
        };

        // Add themes under this subcategory
        const themeNodes = this.nodes.filter(n =>
          n.type === 'theme' &&
          n.properties.category === categoryKey &&
          n.properties.subcategory === subcategoryKey
        );

        themeNodes.forEach(theme => {
          // Count connected documents
          const connectedDocs = this.edges.filter(e =>
            (e.source === theme.id || e.target === theme.id) &&
            (this.nodes.find(n => n.id === e.source)?.type === 'document' ||
             this.nodes.find(n => n.id === e.target)?.type === 'document')
          );

          subcategoryNode.children.push({
            name: theme.properties.name,
            id: theme.id,
            value: connectedDocs.length || 1,
            category: categoryKey,
            subcategory: subcategoryKey,
            color: category.color,
            documentCount: theme.properties.documentCount || 0
          });
        });

        // Only add subcategory if it has themes
        if (subcategoryNode.children.length > 0) {
          categoryNode.children.push(subcategoryNode);
        }
      });

      // Only add category if it has subcategories
      if (categoryNode.children.length > 0) {
        root.children.push(categoryNode);
      }
    });

    this.hierarchyData = root;
  }

  render() {
    console.log('Rendering radial cluster chart');

    // Create hierarchy
    const hierarchy = d3.hierarchy(this.hierarchyData);

    // Create radial cluster layout
    const cluster = d3.cluster()
      .size([2 * Math.PI, this.radius - 100])
      .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

    cluster(hierarchy);

    // Create link generator for radial links
    const linkRadial = d3.linkRadial()
      .angle(d => d.x)
      .radius(d => d.y);

    // Draw links
    const links = this.g.selectAll('.link')
      .data(hierarchy.links())
      .join('path')
      .attr('class', 'link')
      .attr('d', linkRadial)
      .attr('fill', 'none')
      .attr('stroke', d => this.getLinkColor(d.target))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.4);

    // Draw nodes
    const nodes = this.g.selectAll('.node')
      .data(hierarchy.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => this.onNodeClick(event, d))
      .on('mouseover', (event, d) => this.onNodeHover(event, d))
      .on('mouseout', () => this.onNodeOut());

    // Add circles for nodes
    nodes.append('circle')
      .attr('r', d => this.getNodeRadius(d))
      .attr('fill', d => this.getNodeColor(d))
      .attr('stroke', d => this.getNodeStroke(d))
      .attr('stroke-width', 2);

    // Add labels
    nodes.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.x < Math.PI === !d.children ? 6 : -6)
      .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
      .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
      .text(d => {
        const name = d.data.name;
        return name.length > 30 ? name.substring(0, 28) + '...' : name;
      })
      .style('font-size', d => {
        if (d.depth === 0) return '16px';
        if (d.depth === 1) return '13px';
        return '11px';
      })
      .style('font-weight', d => d.depth <= 1 ? 'bold' : 'normal')
      .style('fill', d => {
        if (d.depth === 0) return '#06B6D4';
        if (d.depth === 1) return '#E2E8F0';
        return '#CBD5E1';
      })
      .clone(true).lower()
      .attr('stroke', '#1E293B')
      .attr('stroke-width', 3);

    // Store references
    this.linkElements = links;
    this.nodeElements = nodes;
  }

  getNodeRadius(d) {
    if (d.depth === 0) return 12; // Root
    if (d.depth === 1) return 8;  // Main Categories (5 categories)
    if (d.depth === 2) return 6;  // Subcategories
    if (d.depth === 3) return 5;  // Individual Themes
    return 4;
  }

  getNodeColor(d) {
    if (d.depth === 0) return '#06B6D4'; // Root is cyan

    // Find the category (depth 1 parent)
    let category = d;
    while (category.depth > 1) {
      category = category.parent;
    }

    return category.data.color || '#64748B';
  }

  getNodeStroke(d) {
    if (d.depth === 0) return '#0EA5E9';
    return this.getNodeColor(d);
  }

  getLinkColor(d) {
    // Find the category for coloring
    let category = d;
    while (category.depth > 1) {
      category = category.parent;
    }

    return category.data.color || '#64748B';
  }

  getArcColor(d) {
    // Root uses gradient
    if (d.depth === 0) return '#1E293B';

    // Category level (depth 1) - use category color
    if (d.depth === 1) {
      return d.data.color || '#64748B';
    }

    // Theme level (depth 2) - use lighter shade of category color
    if (d.parent && d.parent.data.color) {
      return this.lightenColor(d.parent.data.color, 20);
    }

    return '#94A3B8';
  }

  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  onNodeClick(event, d) {
    event.stopPropagation();
    this.selectedNode = d;

    // Highlight connected nodes and links
    this.highlightPath(d);

    // Dispatch event for UI
    const customEvent = new CustomEvent('arcSelected', {
      detail: { node: d, data: d.data }
    });
    document.dispatchEvent(customEvent);
  }

  onNodeHover(event, d) {
    // Show tooltip
    const tooltip = d3.select('body').selectAll('.tooltip').data([0]);
    const tooltipEnter = tooltip.enter().append('div').attr('class', 'tooltip');
    const tooltipMerge = tooltipEnter.merge(tooltip);

    let content = `<strong>${d.data.name}</strong><br/>`;
    if (d.depth === 0) {
      content += `Root - ${d.children ? d.children.length : 0} categories`;
    } else if (d.depth === 1) {
      content += `Main Category<br/>`;
      content += `${d.children ? d.children.length : 0} subcategories`;
    } else if (d.depth === 2) {
      content += `Subcategory<br/>`;
      content += `${d.children ? d.children.length : 0} themes`;
    } else if (d.depth === 3) {
      content += `Theme<br/>`;
      content += `${d.data.documentCount || 0} documents`;
    }

    tooltipMerge
      .html(content)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY + 10) + 'px')
      .classed('visible', true);

    // Highlight node
    d3.select(event.currentTarget).select('circle')
      .attr('r', this.getNodeRadius(d) * 1.5);
  }

  onNodeOut() {
    d3.select('.tooltip').classed('visible', false);

    if (!this.selectedNode) {
      this.nodeElements?.selectAll('circle')
        .attr('r', d => this.getNodeRadius(d));
    }
  }

  highlightPath(d) {
    // Get path to root
    const pathNodes = new Set();
    let current = d;
    while (current) {
      pathNodes.add(current);
      current = current.parent;
    }

    // Highlight nodes in path
    this.nodeElements?.selectAll('circle')
      .attr('stroke-width', node => pathNodes.has(node) ? 4 : 2)
      .attr('fill-opacity', node => pathNodes.has(node) ? 1 : 0.3);

    // Highlight links in path
    this.linkElements
      ?.attr('stroke-opacity', link =>
        pathNodes.has(link.source) && pathNodes.has(link.target) ? 0.8 : 0.1
      )
      .attr('stroke-width', link =>
        pathNodes.has(link.source) && pathNodes.has(link.target) ? 3 : 2
      );
  }

  reset() {
    this.selectedNode = null;

    this.nodeElements?.selectAll('circle')
      .attr('stroke-width', 2)
      .attr('fill-opacity', 1)
      .attr('r', d => this.getNodeRadius(d));

    this.linkElements
      ?.attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2);
  }

  zoomIn() {
    this.svg.transition().call(this.zoom.scaleBy, 1.3);
  }

  zoomOut() {
    this.svg.transition().call(this.zoom.scaleBy, 0.7);
  }

  destroy() {
    this.svg.selectAll('*').remove();
  }
}
