import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { motion } from 'framer-motion'
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  Filter,
  Download,
  Settings as SettingsIcon
} from 'lucide-react'
import { useQuery } from 'react-query'
import { graphService } from '../services/graphService'

interface Node {
  id: string
  label: string
  type: 'note' | 'person' | 'location' | 'document' | 'project' | 'concept'
  size: number
  color: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface Link {
  source: string | Node
  target: string | Node
  relationship: string
  strength: number
}

interface GraphData {
  nodes: Node[]
  links: Link[]
}

/**
 * Knowledge Graph Component
 * 
 * Interactive D3.js-based visualization of the knowledge base
 * showing relationships between notes, people, locations, and concepts
 */
const KnowledgeGraph: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [zoomLevel, setZoomLevel] = useState(1)

  // Fetch graph data
  const allowedTypes = ['note', 'person', 'location', 'document', 'project', 'concept'] as const
  const { data: graphData, isLoading, error } = useQuery<GraphData>(
    ['knowledgeGraph', searchTerm, filterType],
    async () => {
      // Only pass valid filters to getGraph
      const filters: any = {}
      if (filterType !== 'all') filters.type = filterType
      // Fetch and map the result to GraphData
      const result = await graphService.getGraph(filters)
      // Filter nodes to allowed types only
      const nodes = (result.nodes ?? []).filter(
        (n: any) => allowedTypes.includes(n.type)
      ).map((n: any) => ({
        ...n,
        // Optionally, cast type to the union type
        type: n.type as Node['type']
      }))
      // Filter links to only those whose source and target are in the filtered nodes
      const nodeIds = new Set(nodes.map((n: any) => n.id))
      const links = (result.edges ?? [])
        .filter(
          (l: any) =>
            nodeIds.has(typeof l.source === 'object' ? l.source.id : l.source) &&
            nodeIds.has(typeof l.target === 'object' ? l.target.id : l.target)
        )
        .map((l: any) => ({
          source: l.source,
          target: l.target,
          relationship: l.relationship ?? '',
          strength: l.strength ?? 1
        }))
      return {
        nodes,
        links
      }
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  )

  // D3 simulation and rendering
  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Clear previous content
    svg.selectAll('*').remove()

    // Set up SVG dimensions
    svg.attr('width', width).attr('height', height)

    // Create main group for zoom/pan
    const g = svg.append('g').attr('class', 'graph-container')

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    svg.call(zoom)

    // Create force simulation
    const simulation = d3.forceSimulation<Node>(graphData.nodes)
      .force('link', d3.forceLink<Node, Link>(graphData.links)
        .id(d => d.id)
        .distance(d => 50 + (1 / d.strength) * 100)
        .strength(d => d.strength)
      )
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMax(400)
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<Node>()
        .radius(d => d.size + 5)
      )

    // Create link elements
    const links = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('class', 'graph-link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.strength * 5))

    // Create link labels
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(graphData.links)
      .enter()
      .append('text')
      .attr('class', 'link-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text(d => d.relationship)

    // Create node groups
    const nodeGroups = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group graph-node')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    // Add circles to nodes
    const circles = nodeGroups.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Add labels to nodes
    const labels = nodeGroups.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.size + 15)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text(d => d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label)

    // Add type indicators
    const typeIndicators = nodeGroups.append('text')
      .attr('class', 'type-indicator')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', '10px')
      .attr('fill', '#fff')
      .text(d => getTypeIcon(d.type))

    // Node interaction handlers
    nodeGroups
      .on('click', (event, d) => {
        setSelectedNode(d)
        // Highlight connected nodes and links
        highlightConnectedElements(d, links, nodeGroups)
      })
      .on('mouseover', (event, d) => {
        // Show tooltip
        showTooltip(event, d)
      })
      .on('mouseout', () => {
        hideTooltip()
        // Reset highlights
        links.attr('stroke-opacity', 0.6)
        circles.attr('opacity', 1)
      })

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!)

      linkLabels
        .attr('x', d => ((d.source as Node).x! + (d.target as Node).x!) / 2)
        .attr('y', d => ((d.source as Node).y! + (d.target as Node).y!) / 2)

      nodeGroups
        .attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Helper functions
    function getTypeIcon(type: string): string {
      const icons = {
        note: '📝',
        person: '👤',
        location: '📍',
        document: '📄',
        project: '🚀',
        concept: '💡'
      }
      return icons[type as keyof typeof icons] || '•'
    }

    function highlightConnectedElements(node: Node, links: any, nodes: any) {
      // Fade all elements
      links.attr('stroke-opacity', 0.1)
      nodes.select('circle').attr('opacity', 0.3)

      // Highlight connected links
      links
        .filter((l: Link) => 
          (l.source as Node).id === node.id || (l.target as Node).id === node.id
        )
        .attr('stroke-opacity', 1)
        .attr('stroke', '#ff6b35')

      // Highlight connected nodes
      const connectedNodeIds = graphData?.links
        ? graphData.links
            .filter(l => 
              (l.source as Node).id === node.id || (l.target as Node).id === node.id
            )
            .map(l => 
              (l.source as Node).id === node.id ? 
                (l.target as Node).id : 
                (l.source as Node).id
            )
        : []

      nodes
        .filter((n: Node) => n.id === node.id || connectedNodeIds.includes(n.id))
        .select('circle')
        .attr('opacity', 1)
    }

    function showTooltip(event: MouseEvent, node: Node) {
      const tooltip = d3.select('body').append('div')
        .attr('class', 'graph-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('opacity', 0)

      tooltip.html(`
        <strong>${node.label}</strong><br/>
        Type: ${node.type}<br/>
        Connections: ${(graphData?.links ?? []).filter(l => 
          (l.source as Node).id === node.id || (l.target as Node).id === node.id
        ).length}
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1)
    }

    function hideTooltip() {
      d3.selectAll('.graph-tooltip').remove()
    }

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [graphData])

  // Graph controls
  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(
          d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
          1.5
        )
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(
          d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
          1 / 1.5
        )
    }
  }

  const handleReset = () => {
    if (svgRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(
          d3.zoom<SVGSVGElement, unknown>().transform as any,
          d3.zoomIdentity.translate(0, 0).scale(1)
        )
    }
  }

  const exportGraph = () => {
    if (svgRef.current) {
      const svgData = new XMLSerializer().serializeToString(svgRef.current)
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `knowledge-graph-${Date.now()}.svg`
      link.click()
      
      URL.revokeObjectURL(url)
    }
  }

  const nodeTypes = ['all', 'note', 'person', 'location', 'document', 'project', 'concept']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-secondary-600">Loading knowledge graph...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-600">
          <p className="mb-2">Failed to load knowledge graph</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="graph-container relative h-full">
      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg border border-secondary-200 p-4"
      >
        {/* Search and Filter */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-secondary-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search nodes..."
              className="input text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-secondary-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input text-sm"
              aria-label="Filter node type"
            >
              {nodeTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded hover:bg-secondary-100 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <span className="text-xs text-secondary-600 min-w-12 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            className="p-2 rounded hover:bg-secondary-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleReset}
            className="p-2 rounded hover:bg-secondary-100 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Export */}
        <button
          onClick={exportGraph}
          className="w-full btn-secondary text-sm"
        >
          <Download className="w-4 h-4 mr-2" />
          Export SVG
        </button>
      </motion.div>

      {/* Node Details Panel */}
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-secondary-200 p-4 w-64"
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-lg">{selectedNode.label}</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-secondary-400 hover:text-secondary-600"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Type:</span> {selectedNode.type}
            </div>
            <div>
              <span className="font-medium">Connections:</span>{' '}
              {graphData?.links.filter(l => 
                (l.source as Node).id === selectedNode.id || 
                (l.target as Node).id === selectedNode.id
              ).length || 0}
            </div>
          </div>
          
          <button
            className="w-full mt-3 btn-primary text-sm"
            onClick={() => {
              // Navigate to the selected node's content
              window.location.href = `/node/${selectedNode.id}`
            }}
          >
            View Details
          </button>
        </motion.div>
      )}

      {/* Graph SVG */}
      <div ref={containerRef} className="w-full h-full">
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* Statistics */}
      {graphData && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-secondary-200 px-3 py-2">
          <div className="flex items-center gap-4 text-xs text-secondary-600">
            <span>{graphData.nodes.length} nodes</span>
            <span>{graphData.links.length} connections</span>
            <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeGraph
