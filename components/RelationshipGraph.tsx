import React, { useMemo } from 'react';
import { PerformerProfile, PerformerRelationship } from '../types';

interface RelationshipGraphProps {
  performers: PerformerProfile[];
  relationships: PerformerRelationship[];
  selectedPerformerId?: string | null;
  onSelectPerformer?: (id: string) => void;
}

interface Node {
  id: string;
  name: string;
  x: number;
  y: number;
  performer: PerformerProfile;
}

interface Edge {
  from: string;
  to: string;
  relationship: PerformerRelationship;
}

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  performers,
  relationships,
  selectedPerformerId,
  onSelectPerformer
}) => {
  const { nodes, edges } = useMemo(() => {
    // Create nodes in a circle layout
    const nodeMap = new Map<string, Node>();
    const angleStep = (2 * Math.PI) / Math.max(performers.length, 1);
    const radius = 150;

    performers.forEach((performer, index) => {
      const angle = index * angleStep - Math.PI / 2; // Start at top
      const x = 200 + radius * Math.cos(angle);
      const y = 200 + radius * Math.sin(angle);
      
      nodeMap.set(performer.id, {
        id: performer.id,
        name: performer.name,
        x,
        y,
        performer
      });
    });

    // Create edges
    const edgeMap = new Map<string, Edge>();
    relationships.forEach(rel => {
      const key = `${rel.performerId}-${rel.targetId}`;
      if (nodeMap.has(rel.performerId) && nodeMap.has(rel.targetId)) {
        edgeMap.set(key, {
          from: rel.performerId,
          to: rel.targetId,
          relationship: rel
        });
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values())
    };
  }, [performers, relationships]);

  const getRelationshipColor = (rel: PerformerRelationship): string => {
    switch (rel.type) {
      case 'romantic':
        return rel.attraction && rel.attraction > 70
          ? '#ec4899' // Pink for high attraction
          : '#f472b6'; // Lighter pink
      case 'ally':
        return '#10b981'; // Green
      case 'rival':
        return '#ef4444'; // Red
      case 'mentor':
        return '#3b82f6'; // Blue
      case 'suspicious':
        return '#f59e0b'; // Amber
      default:
        return '#6b7280'; // Gray
    }
  };

  const getRelationshipWidth = (rel: PerformerRelationship): number => {
    return Math.max(1, (rel.intensity / 100) * 3);
  };

  const getRelationshipOpacity = (rel: PerformerRelationship): number => {
    return 0.3 + (rel.intensity / 100) * 0.7;
  };

  return (
    <div className="relative w-full h-full min-h-[400px] bg-[#111315] rounded-lg border border-gray-800 overflow-hidden">
      <svg width="100%" height="100%" viewBox="0 0 400 400" className="absolute inset-0">
        {/* Draw edges */}
        {edges.map(edge => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const color = getRelationshipColor(edge.relationship);
          const width = getRelationshipWidth(edge.relationship);
          const opacity = getRelationshipOpacity(edge.relationship);
          const isSelected = selectedPerformerId === edge.from || selectedPerformerId === edge.to;

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={color}
              strokeWidth={isSelected ? width + 1 : width}
              opacity={isSelected ? Math.min(1, opacity + 0.3) : opacity}
              strokeDasharray={edge.relationship.type === 'suspicious' ? '5,5' : '0'}
              className="transition-all duration-300"
            />
          );
        })}

        {/* Draw nodes */}
        {nodes.map(node => {
          const isSelected = selectedPerformerId === node.id;
          const relationshipsForNode = relationships.filter(
            r => r.performerId === node.id || r.targetId === node.id
          );
          const romanceCount = relationshipsForNode.filter(r => r.type === 'romantic').length;
          const conflictCount = relationshipsForNode.filter(r => r.type === 'rival').length;

          return (
            <g key={node.id}>
              {/* Glow effect for selected */}
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="28"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  opacity="0.5"
                  className="animate-pulse"
                />
              )}
              
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r="20"
                fill={isSelected ? '#3b82f6' : '#1e1f20'}
                stroke={isSelected ? '#60a5fa' : '#4b5563'}
                strokeWidth={isSelected ? '3' : '2'}
                className="cursor-pointer transition-all duration-200 hover:scale-110"
                onClick={() => onSelectPerformer?.(node.id)}
              />
              
              {/* Romance indicator */}
              {romanceCount > 0 && (
                <circle
                  cx={node.x + 12}
                  cy={node.y - 12}
                  r="6"
                  fill="#ec4899"
                  stroke="#1e1f20"
                  strokeWidth="1.5"
                />
              )}
              
              {/* Conflict indicator */}
              {conflictCount > 0 && (
                <circle
                  cx={node.x - 12}
                  cy={node.y - 12}
                  r="6"
                  fill="#ef4444"
                  stroke="#1e1f20"
                  strokeWidth="1.5"
                />
              )}

              {/* Node label */}
              <text
                x={node.x}
                y={node.y + 35}
                textAnchor="middle"
                fill={isSelected ? '#60a5fa' : '#9ca3af'}
                fontSize="11"
                fontWeight={isSelected ? 'bold' : 'normal'}
                className="pointer-events-none select-none"
              >
                {node.name.length > 12 ? node.name.slice(0, 10) + '...' : node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-3 p-3 bg-[#1e1f20]/90 backdrop-blur-sm rounded-lg border border-gray-700 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#ec4899]" />
          <span className="text-gray-300">Romance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#10b981]" />
          <span className="text-gray-300">Ally</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#ef4444]" />
          <span className="text-gray-300">Rival</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#3b82f6]" />
          <span className="text-gray-300">Mentor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#f59e0b] border-dashed border-t-2" />
          <span className="text-gray-300">Suspicious</span>
        </div>
      </div>
    </div>
  );
};

export default RelationshipGraph;

