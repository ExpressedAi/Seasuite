import React, { useMemo, useRef, useEffect, useState } from 'react';
import { KnowledgeEntity } from '../types';

interface Node {
  id: string;
  name: string;
  entity: KnowledgeEntity;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  connections: number;
}

interface Edge {
  from: string;
  to: string;
  relationshipType: string;
  strength: number;
}

interface KnowledgeGraphVisualizationProps {
  entities: KnowledgeEntity[];
  selectedEntity: KnowledgeEntity | null;
  onEntitySelect: (entity: KnowledgeEntity) => void;
  onPathFind?: (from: string, to: string) => void;
}

const KnowledgeGraphVisualization: React.FC<KnowledgeGraphVisualizationProps> = ({
  entities,
  selectedEntity,
  onEntitySelect,
  onPathFind
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
  const [pathFrom, setPathFrom] = useState<string | null>(null);

  // Build graph structure
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeMap = new Map<string, Edge>();

    // Create nodes
    entities.forEach((entity, index) => {
      const connectionCount = Object.values(entity.relationships || {}).reduce(
        (sum, targets) => sum + (Array.isArray(targets) ? targets.length : 0),
        0
      );

      // Initial circle layout
      const angle = (index / entities.length) * 2 * Math.PI;
      const radius = 200;
      const x = 400 + radius * Math.cos(angle);
      const y = 300 + radius * Math.sin(angle);

      nodeMap.set(entity.name, {
        id: entity.name,
        name: entity.name,
        entity,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: Math.max(8, Math.min(20, 8 + connectionCount * 0.5)),
        connections: connectionCount
      });
    });

    // Create edges
    entities.forEach(entity => {
      Object.entries(entity.relationships || {}).forEach(([relType, targets]) => {
        if (!Array.isArray(targets)) return;
        
        targets.forEach(target => {
          if (target === entity.name) return; // Skip self-loops
          if (!nodeMap.has(target)) return; // Skip missing targets
          
          const edgeKey = `${entity.name}-${target}`;
          const reverseKey = `${target}-${entity.name}`;
          
          if (!edgeMap.has(edgeKey) && !edgeMap.has(reverseKey)) {
            edgeMap.set(edgeKey, {
              from: entity.name,
              to: target,
              relationshipType: relType,
              strength: 1
            });
          }
        });
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values())
    };
  }, [entities]);

  // Force-directed simulation (simplified)
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrame: number;
    const iterations = 100;
    let currentIteration = 0;

    const simulate = () => {
      if (currentIteration >= iterations) return;

      // Apply forces
      nodes.forEach(node => {
        node.vx *= 0.9; // Damping
        node.vy *= 0.9;
      });

      // Repulsion between nodes
      nodes.forEach((node, i) => {
        nodes.slice(i + 1).forEach(other => {
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (distance * distance);
          
          node.vx -= (dx / distance) * force * 0.1;
          node.vy -= (dy / distance) * force * 0.1;
          other.vx += (dx / distance) * force * 0.1;
          other.vy += (dy / distance) * force * 0.1;
        });
      });

      // Attraction along edges
      edges.forEach(edge => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return;

        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = distance * 0.01;

        fromNode.vx += (dx / distance) * force;
        fromNode.vy += (dy / distance) * force;
        toNode.vx -= (dx / distance) * force;
        toNode.vy -= (dy / distance) * force;
      });

      // Update positions
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
        
        // Keep nodes in bounds
        node.x = Math.max(50, Math.min(750, node.x));
        node.y = Math.max(50, Math.min(550, node.y));
      });

      currentIteration++;
      animationFrame = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [nodes, edges]);

  const handleNodeClick = (node: Node, event: React.MouseEvent) => {
    if (pathFrom && pathFrom !== node.id && onPathFind) {
      onPathFind(pathFrom, node.id);
      setPathFrom(null);
    } else {
      onEntitySelect(node.entity);
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        setPathFrom(node.id);
      }
    }
  };

  const handleNodeMouseDown = (node: Node, event: React.MouseEvent<SVGCircleElement>) => {
    if (event.button !== 0) return;
    setDraggedNode(node.id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: event.clientX - rect.left - node.x,
        y: event.clientY - rect.top - node.y
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNode) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const node = nodes.find(n => n.id === draggedNode);
    if (!node) return;

    node.x = event.clientX - rect.left - dragOffset.x;
    node.y = event.clientY - rect.top - dragOffset.y;
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  // Find path between two nodes
  const findPath = (from: string, to: string): string[] => {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [from] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (node === to) return path;
      if (visited.has(node)) continue;
      visited.add(node);

      edges.forEach(edge => {
        if (edge.from === node && !visited.has(edge.to)) {
          queue.push({ node: edge.to, path: [...path, edge.to] });
        } else if (edge.to === node && !visited.has(edge.from)) {
          queue.push({ node: edge.from, path: [...path, edge.from] });
        }
      });
    }

    return [];
  };

  const [pathHighlight, setPathHighlight] = useState<string[]>([]);

  const handlePathFind = (from: string, to: string) => {
    const path = findPath(from, to);
    setPathHighlight(path);
    if (path.length > 0 && onPathFind) {
      onPathFind(from, to);
    }
  };

  const getNodeColor = (node: Node): string => {
    if (pathHighlight.includes(node.id)) return '#10b981'; // Green for path
    if (selectedEntity?.name === node.id) return '#3b82f6'; // Blue for selected
    if (hoveredNode === node.id) return '#8b5cf6'; // Purple for hover
    if (pathFrom === node.id) return '#f59e0b'; // Amber for path start
    
    // Color based on connection count for visual interest
    const connectionRatio = node.connections / Math.max(1, Math.max(...nodes.map(n => n.connections)));
    if (connectionRatio > 0.7) return '#ec4899'; // Pink for highly connected
    if (connectionRatio > 0.4) return '#8b5cf6'; // Purple for medium connected
    return '#60a5fa'; // Blue for less connected
  };

  const getEdgeColor = (edge: Edge): string => {
    const fromInPath = pathHighlight.includes(edge.from);
    const toInPath = pathHighlight.includes(edge.to);
    if (fromInPath && toInPath) return '#10b981'; // Green for path edges
    if (selectedEntity?.name === edge.from || selectedEntity?.name === edge.to) return '#3b82f6';
    if (hoveredNode === edge.from || hoveredNode === edge.to) return '#8b5cf6';
    return '#4b5563'; // Dark gray
  };

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gradient-to-br from-[#111315] to-[#0a0b0c] rounded-lg border border-gray-800 space-y-4">
        <div className="text-6xl animate-pulse">🌐</div>
        <p className="text-lg font-medium">No entities to visualize</p>
        <p className="text-sm text-gray-600">Save memories with tags to build the graph</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-[#111315] via-[#0f1214] to-[#0a0b0c] rounded-lg border border-gray-800 overflow-hidden shadow-2xl">
      <div className="absolute top-3 left-3 z-10 bg-[#1e1f20]/90 backdrop-blur-sm border border-gray-700/50 rounded-lg p-3 text-xs text-gray-400 shadow-lg">
        <div className="flex items-center gap-2">
          <span>🎯</span>
          <span>Click to select • Shift+Click to find path • Drag to move</span>
        </div>
        {pathFrom && (
          <div className="mt-2 pt-2 border-t border-gray-700/50 text-amber-400 flex items-center gap-2">
            <span className="animate-pulse">✨</span>
            <span>Click destination to find path...</span>
          </div>
        )}
      </div>
      
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 800 600"
        className="cursor-move"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Edges */}
        {edges.map(edge => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const color = getEdgeColor(edge);
          const isHighlighted = pathHighlight.includes(edge.from) && pathHighlight.includes(edge.to);

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={color}
              strokeWidth={isHighlighted ? 3 : hoveredNode === edge.from || hoveredNode === edge.to ? 2 : 1}
              opacity={isHighlighted ? 0.9 : hoveredNode === edge.from || hoveredNode === edge.to ? 0.6 : 0.3}
              className="transition-all duration-200"
              strokeDasharray={isHighlighted ? '0' : hoveredNode === edge.from || hoveredNode === edge.to ? '5,5' : '0'}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const color = getNodeColor(node);
          const isSelected = selectedEntity?.name === node.id;
          const isInPath = pathHighlight.includes(node.id);

          const isHovered = hoveredNode === node.id;
          const glowRadius = isSelected ? node.radius + 8 : isHovered ? node.radius + 5 : 0;
          
          return (
            <g key={node.id}>
              {/* Glow effect for selected/hovered nodes */}
              {(isSelected || isHovered || isInPath) && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={glowRadius}
                  fill={isSelected ? '#3b82f6' : isInPath ? '#10b981' : '#8b5cf6'}
                  opacity={isSelected ? 0.3 : isInPath ? 0.2 : 0.2}
                  className="pointer-events-none transition-all duration-300"
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={color}
                stroke={isSelected ? '#60a5fa' : isInPath ? '#34d399' : isHovered ? '#a78bfa' : 'transparent'}
                strokeWidth={isSelected || isInPath ? 3 : isHovered ? 2 : 0}
                className="cursor-pointer transition-all duration-200 hover:scale-110"
                onClick={(e) => handleNodeClick(node, e)}
                onMouseDown={(e) => handleNodeMouseDown(node, e)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ filter: isSelected || isHovered ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))' : 'none' }}
              />
              {(isSelected || hoveredNode === node.id || isInPath) && (
                <text
                  x={node.x}
                  y={node.y - node.radius - 8}
                  textAnchor="middle"
                  fill={color}
                  fontSize={isSelected ? '12' : '10'}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  className="pointer-events-none select-none"
                  style={{ 
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                    filter: isSelected ? 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))' : 'none'
                  }}
                >
                  {node.name.length > 20 ? `${node.name.slice(0, 17)}...` : node.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Statistics overlay */}
      <div className="absolute bottom-3 right-3 bg-[#1e1f20]/90 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 text-xs text-gray-400 shadow-lg">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-purple-400">🌐</span>
            <span>Nodes: <span className="text-gray-200 font-semibold">{nodes.length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400">🔗</span>
            <span>Connections: <span className="text-gray-200 font-semibold">{edges.length}</span></span>
          </div>
          {selectedEntity && (
            <div className="mt-3 pt-3 border-t border-gray-700/50">
              <div className="text-gray-200 font-semibold mb-1 flex items-center gap-1">
                <span className="text-amber-400">⭐</span>
                {selectedEntity.name.length > 20 ? `${selectedEntity.name.slice(0, 17)}...` : selectedEntity.name}
              </div>
              <div className="text-gray-400">
                Connections: <span className="text-blue-300 font-semibold">{nodes.find(n => n.id === selectedEntity.name)?.connections || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphVisualization;

