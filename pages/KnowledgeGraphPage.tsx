import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KnowledgeEntity, TagScore, Memory } from '../types';
import { getAllMemories, getAllEntities, clearKnowledge, getTagScores } from '../services/db';
import { processAndStoreEntities } from '../services/aiService';
import { SearchIcon, RefreshIcon, TrashIcon, InsightIcon } from '../components/icons/Icons';
import KnowledgeGraphVisualization from '../components/KnowledgeGraphVisualization';

const buildGraphFromMemories = (memories: Memory[]): KnowledgeEntity[] => {
    const tagMap = new Map<string, KnowledgeEntity>();
    const memoryNodes: KnowledgeEntity[] = [];

    memories.forEach(memory => {
        const snippet = memory.summary.length > 80 ? `${memory.summary.slice(0, 77)}…` : memory.summary;
        const memoryName = memory.id ? `Memory #${memory.id}` : `Memory ${new Date(memory.timestamp).toLocaleString()}`;

        memoryNodes.push({
            name: memoryName,
            relationships: {
                summary: [snippet],
                tags: memory.tags
            }
        });

        memory.tags.forEach((tag, index, tags) => {
            const normalizedTag = tag.trim();
            if (!normalizedTag) return;

            if (!tagMap.has(normalizedTag)) {
                tagMap.set(normalizedTag, {
                    name: normalizedTag,
                    relationships: {
                        memories: [],
                        co_occurs_with: []
                    }
                });
            }

            const tagEntity = tagMap.get(normalizedTag)!;
            const memoriesList = tagEntity.relationships.memories || [];
            if (!memoriesList.includes(memoryName)) {
                tagEntity.relationships.memories = [...memoriesList, memoryName];
            }

            tags.forEach(otherTag => {
                const normalizedOther = otherTag.trim();
                if (!normalizedOther || normalizedOther === normalizedTag) return;
                const existing = tagEntity.relationships.co_occurs_with || [];
                if (!existing.includes(normalizedOther)) {
                    tagEntity.relationships.co_occurs_with = [...existing, normalizedOther];
                }
            });
        });
    });

    return [...Array.from(tagMap.values()), ...memoryNodes];
};

const KnowledgeGraphPage: React.FC = () => {
    const [entities, setEntities] = useState<KnowledgeEntity[]>([]);
    const [tagScores, setTagScores] = useState<TagScore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntity, setSelectedEntity] = useState<KnowledgeEntity | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'graph'>('graph');
    const [insights, setInsights] = useState<string | null>(null);
    const [relatedEntities, setRelatedEntities] = useState<KnowledgeEntity[]>([]);

    const loadGraph = async () => {
        setIsLoading(true);
        try {
            const [memories, knowledge, tags] = await Promise.all([getAllMemories(), getAllEntities(), getTagScores()]);
            const graph = buildGraphFromMemories(memories);
            const combined = [...graph, ...knowledge].reduce((acc, entity) => {
                const existing = acc.get(entity.name);
                if (!existing) {
                    acc.set(entity.name, entity);
                } else {
                    const relationships = { ...existing.relationships };
                    Object.entries(entity.relationships || {}).forEach(([key, value]) => {
                        const arr = new Set([...(relationships[key] || []), ...(value || [])]);
                        relationships[key] = Array.from(arr);
                    });
                    acc.set(entity.name, { ...existing, relationships });
                }
                return acc;
            }, new Map<string, KnowledgeEntity>());
            const sorted = Array.from(combined.values()).sort((a, b) => a.name.localeCompare(b.name));
            setEntities(sorted);
            setTagScores(tags);
        } catch (error) {
            console.error('Failed to build knowledge graph from memories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadGraph();
        const listener = () => loadGraph();
        window.addEventListener('memories-updated', listener);
        window.addEventListener('performer-interactions-updated', listener as EventListener);
        return () => {
            window.removeEventListener('memories-updated', listener);
            window.removeEventListener('performer-interactions-updated', listener as EventListener);
        };
    }, []);

    const handleClearKnowledge = async () => {
        const confirmation = window.confirm('Clear all knowledge graph nodes? This will remove stored relationships.');
        if (!confirmation) return;
        try {
            await clearKnowledge();
            await loadGraph();
        } catch (error) {
            console.error('Failed to clear knowledge graph:', error);
        }
    };

    const handleRebuildFromMemories = async () => {
        const confirmation = window.confirm('Run the knowledge graph builder? This may use additional LLM calls.');
        if (!confirmation) return;
        try {
            const memories = await getAllMemories();
            for (const memory of memories) {
                try {
                    await processAndStoreEntities(memory.conversation, {
                        conversationId: `memory-${memory.id ?? memory.timestamp}`,
                        timestamp: memory.timestamp,
                        tags: memory.tags
                    });
                } catch (error) {
                    console.warn('Failed to enrich knowledge graph for memory', memory.id, error);
                }
            }
            await loadGraph();
        } catch (error) {
            console.error('Failed to rebuild knowledge graph:', error);
        }
    };

    const filteredEntities = useMemo(() => {
        if (!searchTerm.trim()) return entities;
        const query = searchTerm.toLowerCase();
        return entities.filter(entity => {
            if (entity.name.toLowerCase().includes(query)) return true;
            return Object.entries(entity.relationships || {}).some(([relType, targets]) => {
                if (relType.toLowerCase().includes(query)) return true;
                return (targets || []).some(target => target.toLowerCase().includes(query));
            });
        });
    }, [entities, searchTerm]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search.slice(1));
        const preselect = params.get('tag');
        if (preselect) {
            const match = filteredEntities.find(entity => entity.name.toLowerCase() === preselect.toLowerCase());
            if (match) {
                setSelectedEntity(match);
            }
        }
    }, [filteredEntities]);

    const handleEntityClick = (entity: KnowledgeEntity) => {
        setSelectedEntity(entity);
    };

    const handleTargetClick = (targetName: string) => {
        const targetEntity = entities.find(e => e.name === targetName);
        if (targetEntity) {
            setSelectedEntity(targetEntity);
        }
    };

    const handleEntitySelect = (entity: KnowledgeEntity) => {
        setSelectedEntity(entity);
        
        // Find related entities
        const related = new Set<string>();
        Object.values(entity.relationships || {}).forEach(targets => {
            if (Array.isArray(targets)) {
                targets.forEach(target => related.add(target));
            }
        });
        
        const relatedList = entities.filter(e => related.has(e.name));
        setRelatedEntities(relatedList);
    };

    const handlePathFind = (from: string, to: string) => {
        const fromEntity = entities.find(e => e.name === from);
        const toEntity = entities.find(e => e.name === to);
        if (fromEntity && toEntity) {
            setInsights(`**Path Analysis**: ${from} → ${to}\n\nThese entities are connected through the knowledge graph. Explore their relationships to understand how they relate.`);
        }
    };

    const connectionCount = useMemo(() => {
        return entities.reduce((sum, e) => 
            sum + Object.values(e.relationships || {}).reduce((s, targets) => 
                s + (Array.isArray(targets) ? targets.length : 0), 0), 0
        );
    }, [entities]);

    const generateInsights = async () => {
        if (entities.length === 0) return;
        
        const topTags = tagScores.sort((a, b) => b.score - a.score).slice(0, 10);
        const topTagNames = topTags.map(t => t.tag).join(', ');
        const entityCount = entities.length;

        setInsights(`## 🧠 Knowledge Graph Insights

**Network Overview**:
- **${entityCount}** entities weaving through your knowledge web 🌐
- **${connectionCount}** connections binding them together 🔗
- **${topTags.length}** highly-tagged concepts lighting up the graph ✨

**Top Concepts**:
${topTagNames ? topTagNames.split(', ').map((tag, i) => `${i + 1}. **${tag}** (score: ${topTags[i]?.score.toFixed(2)})`).join('\n') : 'No tags yet - start tagging memories to see patterns emerge!'}

**Graph Health**:
- Average connections per entity: ${(connectionCount / Math.max(entityCount, 1)).toFixed(1)}
- Most connected hub: ${entities.reduce((max, e) => {
    const conns = Object.values(e.relationships || {}).reduce((s, t) => s + (Array.isArray(t) ? t.length : 0), 0);
    return conns > max.conns ? { name: e.name, conns } : max;
}, { name: 'None', conns: 0 }).name}

${selectedEntity ? `\n**Currently Exploring: ${selectedEntity.name}**\n\nThis entity has ${Object.keys(selectedEntity.relationships || {}).length} relationship types - dive deeper to discover connections!` : ''}`);
    };

    return (
        <div className="p-3 md:p-8 flex flex-col h-full gap-4 md:gap-6 bg-gradient-to-br from-[#0a0b0c] via-[#111315] to-[#0a0b0c]">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                            Knowledge Graph
                        </h1>
                        <span className="text-2xl animate-bounce">🧠</span>
                    </div>
                    <p className="text-sm text-gray-400 max-w-2xl">
                        Your memories come alive as an interactive web of connections. Tags become nodes, relationships form edges, and patterns emerge from the chaos. 
                        <span className="text-purple-400 font-medium"> Explore, discover, connect.</span>
                    </p>
                    {entities.length > 0 && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                {entities.length} entities
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                                {connectionCount} connections
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={loadGraph}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 bg-[#1e1f20] text-gray-300 hover:bg-gray-700 hover:border-gray-500 text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                        <RefreshIcon className="h-4 w-4" /> Refresh
                    </button>
                    <button
                        onClick={handleRebuildFromMemories}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-600 bg-blue-900/40 text-blue-200 hover:bg-blue-800/50 hover:border-blue-500 text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                        <RefreshIcon className="h-4 w-4" /> Rebuild with LLM
                    </button>
                    <button
                        onClick={handleClearKnowledge}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-600 bg-red-900/40 text-red-200 hover:bg-red-800/50 hover:border-red-500 text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                        <TrashIcon className="h-4 w-4" /> Clear
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-2">
                <button
                    onClick={() => setViewMode('graph')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        viewMode === 'graph' 
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-105' 
                            : 'bg-[#1e1f20] text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 hover:scale-105'
                    }`}
                >
                    🗺️ Graph View
                </button>
                <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        viewMode === 'list' 
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-105' 
                            : 'bg-[#1e1f20] text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 hover:scale-105'
                    }`}
                >
                    📋 List View
                </button>
                <button
                    onClick={generateInsights}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/40 text-purple-200 hover:bg-purple-600/30 hover:border-purple-400 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                >
                    <InsightIcon className="h-4 w-4" />
                    Generate Insights
                </button>
            </div>

            {insights && (
                <div className="bg-gradient-to-r from-[#1e1f20] to-[#2a1f2e] border border-purple-500/40 rounded-lg p-5 shadow-lg shadow-purple-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                            <span>✨</span> Graph Insights
                        </h3>
                        <button
                            onClick={() => setInsights(null)}
                            className="text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded p-1 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {insights}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 min-h-0">
                {viewMode === 'graph' ? (
                    <div className="md:col-span-3 h-[600px] animate-in fade-in duration-300">
                        <KnowledgeGraphVisualization
                            entities={filteredEntities}
                            selectedEntity={selectedEntity}
                            onEntitySelect={handleEntitySelect}
                            onPathFind={handlePathFind}
                        />
                    </div>
                ) : (
                    <>
                        <div className="md:col-span-1 bg-[#1e1f20] rounded-lg border border-gray-700 p-4 flex flex-col overflow-y-auto shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="relative flex-1">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                        <SearchIcon className="w-4 h-4" />
                                    </div>
                                    <input
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search tags or memories…"
                                        className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg pl-9 pr-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                    />
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {filteredEntities.length} / {entities.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                        <p>Building your knowledge web…</p>
                                    </div>
                                ) : filteredEntities.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3">
                                        <div className="text-4xl">🔍</div>
                                        <p className="text-center">No entities found</p>
                                        <p className="text-xs text-gray-600 text-center">Save memories with tags to populate the graph</p>
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {filteredEntities.map((entity) => (
                                            <li key={entity.name} className="animate-in fade-in slide-in-from-left-2">
                                                <button
                                                    onClick={() => handleEntityClick(entity)}
                                                    className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200 ${
                                                        selectedEntity?.name === entity.name 
                                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md scale-105' 
                                                            : 'hover:bg-gray-700/50 hover:scale-[1.02] text-gray-300'
                                                    }`}
                                                >
                                                    {entity.name}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2 bg-[#1e1f20] border border-gray-700 rounded-lg p-6 overflow-y-auto shadow-lg">
                            {selectedEntity ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <div>
                                        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent break-words">
                                            {selectedEntity.name}
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {selectedEntity.relationships.summary?.[0] ? '💭 Memory snippet' : '🏷️ Tag connections'}
                                        </p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className="px-3 py-1.5 rounded-full text-xs bg-blue-900/30 text-blue-200 border border-blue-600/30 font-medium">
                                                {Object.keys(selectedEntity.relationships || {}).length} relationship types
                                            </span>
                                            <span className="px-3 py-1.5 rounded-full text-xs bg-purple-900/30 text-purple-200 border border-purple-600/30 font-medium">
                                                {Object.values(selectedEntity.relationships || {}).reduce((sum, targets) => 
                                                    sum + (Array.isArray(targets) ? targets.length : 0), 0)} connections
                                            </span>
                                        </div>
                                    </div>

                                    {selectedEntity.relationships.summary?.[0] && (
                                        <div className="bg-gradient-to-r from-[#141517] to-[#1a1517] border border-gray-800 rounded-lg p-4 shadow-md">
                                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <span>💭</span> Memory Summary
                                            </h3>
                                            <p className="text-gray-300 text-sm leading-relaxed">{selectedEntity.relationships.summary[0]}</p>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {Object.entries(selectedEntity.relationships || {}).map(([relType, targets]) => {
                                            if (!targets || targets.length === 0 || relType === 'summary') return null;
                                            const label = relType.replace(/_/g, ' ');
                                            return (
                                                <div key={relType} className="bg-gradient-to-r from-[#141517] to-[#1a1517] border border-gray-800 rounded-lg p-4 shadow-md">
                                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                        {label}
                                                        <span className="text-xs text-gray-500 normal-case font-normal">({targets.length})</span>
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {targets.map(target => (
                                                            <button
                                                                key={target}
                                                                onClick={() => handleTargetClick(target)}
                                                                className="px-3 py-1.5 rounded-md bg-[#1e1f20] border border-gray-700 text-sm text-gray-300 hover:border-blue-500 hover:text-blue-300 hover:bg-blue-900/20 transition-all duration-200 hover:scale-105 active:scale-95"
                                                            >
                                                                {target}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {relatedEntities.length > 0 && (
                                        <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/40 rounded-lg p-4 shadow-md">
                                            <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <span>🔗</span> Related Entities ({relatedEntities.length})
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {relatedEntities.slice(0, 10).map(entity => (
                                                    <button
                                                        key={entity.name}
                                                        onClick={() => handleEntitySelect(entity)}
                                                        className={`px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${
                                                            selectedEntity?.name === entity.name
                                                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md scale-105'
                                                                : 'bg-[#1e1f20] border border-gray-700 text-gray-300 hover:border-purple-500 hover:text-purple-300 hover:bg-purple-900/20 hover:scale-105'
                                                        }`}
                                                    >
                                                        {entity.name}
                                                    </button>
                                                ))}
                                                {relatedEntities.length > 10 && (
                                                    <span className="px-3 py-1.5 text-sm text-gray-500 flex items-center">
                                                        +{relatedEntities.length - 10} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                                    <div className="text-7xl animate-bounce">🔗</div>
                                    <p className="text-xl font-medium">Select an entity to explore</p>
                                    <p className="text-sm text-gray-600 text-center max-w-md">
                                        Click on an entity in the list to discover its relationships and connections
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default KnowledgeGraphPage;
