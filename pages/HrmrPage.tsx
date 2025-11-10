import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { getAllHrmrRatings, upsertHrmrRating, deleteHrmrRating } from '../services/db';
import { searchKnowledge, LibrarianResult } from '../services/librarian';
import { HrmrRating, HRMR_GRADE_SCALE, HrmrGrade, ChatMessage } from '../types';
import { StageIcon, RefreshIcon, SearchIcon, GradeIcon, InsightIcon } from '../components/icons/Icons';

const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';

const gradeToScore: Record<string, number> = {
  'A+': 10,
  'A': 9,
  'A-': 8,
  'B+': 7,
  'B': 6,
  'B-': 5,
  'C+': 4.5,
  'C': 4,
  'C-': 3.5,
  'D+': 3,
  'D': 2,
  'D-': 1.5,
  'F': 0
};

const gradeColor = (grade: HrmrGrade) => {
    if (grade.startsWith('A')) return 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40';
    if (grade.startsWith('B')) return 'bg-blue-600/20 text-blue-300 border-blue-500/40';
    if (grade.startsWith('C')) return 'bg-yellow-600/20 text-yellow-300 border-yellow-500/40';
    if (grade.startsWith('D')) return 'bg-orange-600/20 text-orange-300 border-orange-500/40';
    return 'bg-red-600/20 text-red-300 border-red-500/40';
};

const formatTimestamp = (idOrTimestamp?: string | number) => {
  if (!idOrTimestamp) return '—';
  const numeric = typeof idOrTimestamp === 'number' ? idOrTimestamp : Number(idOrTimestamp);
  if (Number.isNaN(numeric)) return '—';
  return new Date(numeric).toLocaleString();
};

const formatTypeLabel = (type: LibrarianResult['type']): string => {
  switch (type) {
    case 'memory':
      return 'Memory';
    case 'followup':
      return 'Follow-Up';
    case 'intelligence':
    default:
      return 'Intelligence';
  }
};

type TabType = 'corpus' | 'timeline' | 'knowledge';

const HrmrPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('corpus');
    const [ratings, setRatings] = useState<HrmrRating[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState<HrmrGrade | 'all'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    
    // Timeline filters
    const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'agent'>('all');
    const [performerFilter, setPerformerFilter] = useState<'all' | 'core' | string>('all');
    
    // Knowledge search
    const [knowledgeQuery, setKnowledgeQuery] = useState('');
    const [knowledgeResults, setKnowledgeResults] = useState<LibrarianResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

    const loadRatings = async () => {
        try {
            const all = await getAllHrmrRatings();
            const sorted = all.sort((a, b) => b.updatedAt - a.updatedAt);
            setRatings(sorted);
            if (!selectedId && sorted.length > 0 && activeTab === 'corpus') {
                setSelectedId(sorted[0].id);
            }
        } catch (error) {
            console.error('Failed to load HRMR ratings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadTimeline = () => {
        try {
            const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as ChatMessage[];
                if (Array.isArray(parsed)) {
                    setMessages(parsed);
                }
            }
        } catch (error) {
            console.error('Failed to parse chat history:', error);
            setStatusMessage('Unable to load recent conversation.');
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    useEffect(() => {
        loadRatings();
        if (activeTab === 'timeline') {
            loadTimeline();
        }
    }, [activeTab]);

    const ratingMap = useMemo(() => {
        const map = new Map<string, HrmrRating>();
        ratings.forEach(rating => {
            map.set(rating.messageId, rating);
        });
        return map;
    }, [ratings]);

    const performers = useMemo(() => {
        const ids = new Map<string, { name: string; icon?: string | undefined }>();
        messages.forEach(msg => {
            if (msg.performerId) {
                ids.set(msg.performerId, { name: msg.performerName || 'Performer', icon: msg.performerIcon });
            }
        });
        return Array.from(ids.entries()).map(([id, details]) => ({ id, ...details }));
    }, [messages]);

    const filteredRatings = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return ratings.filter(rating => {
            const matchesGrade = gradeFilter === 'all' || rating.grade === gradeFilter;
            const matchesSearch = !lower
                || rating.agentResponse.toLowerCase().includes(lower)
                || rating.grade.toLowerCase().includes(lower)
                || rating.modulesUsed?.some(module => module.toLowerCase().includes(lower));
            return matchesGrade && matchesSearch;
        });
    }, [ratings, searchTerm, gradeFilter]);

    const filteredMessages = useMemo(() => {
        return messages.filter(msg => {
            if (roleFilter !== 'all' && msg.role !== roleFilter) return false;
            if (performerFilter === 'core' && msg.performerId) return false;
            if (performerFilter !== 'all' && performerFilter !== 'core' && msg.performerId !== performerFilter) return false;
            if (!searchTerm.trim()) return true;
            const query = searchTerm.toLowerCase();
            const text = msg.content?.toLowerCase() || '';
            const performerName = msg.performerName?.toLowerCase() || '';
            const rating = ratingMap.get(msg.id);
            const modules = rating?.modulesUsed?.join(' ').toLowerCase() || '';
            return text.includes(query) || performerName.includes(query) || modules.includes(query);
        });
    }, [messages, roleFilter, performerFilter, searchTerm, ratingMap]);

    const agentRatings = ratings.filter(r => !!r.grade);
    const averageScore = agentRatings.length
        ? agentRatings.reduce((acc, rating) => acc + (gradeToScore[rating.grade] ?? 0), 0) / agentRatings.length
        : 0;

    const topModules = useMemo(() => {
        const counts: Record<string, number> = {};
        ratings.forEach(rating => {
            rating.modulesUsed?.forEach(module => {
                counts[module] = (counts[module] || 0) + 1;
            });
        });
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return entries.slice(0, 6);
    }, [ratings]);

    const groupedKnowledgeResults = useMemo(() => {
        return knowledgeResults.reduce<Record<string, LibrarianResult[]>>((acc, result) => {
            if (!acc[result.type]) acc[result.type] = [];
            acc[result.type].push(result);
            return acc;
        }, {});
    }, [knowledgeResults]);

    const selectedRating = selectedId ? ratings.find(r => r.id === selectedId) : null;

    const handleGradeUpdate = async (rating: HrmrRating, grade: HrmrGrade) => {
        try {
            await upsertHrmrRating({ ...rating, grade, updatedAt: Date.now() });
            setStatusMessage('Rating updated.');
            await loadRatings();
        } catch (error) {
            console.error('Failed to update grade:', error);
            setStatusMessage('Could not update grade.');
        } finally {
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    const handleDelete = async (rating: HrmrRating) => {
        const confirmation = window.confirm('Delete this rating?');
        if (!confirmation) return;
        try {
            await deleteHrmrRating(rating.id);
            setStatusMessage('Rating removed.');
            if (selectedId === rating.id) {
                setSelectedId(null);
            }
            await loadRatings();
        } catch (error) {
            console.error('Failed to delete rating:', error);
            setStatusMessage('Could not delete rating.');
        } finally {
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    const handleKnowledgeSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = knowledgeQuery.trim();
        if (!trimmed) {
            setKnowledgeResults([]);
            setKnowledgeError(null);
            return;
        }
        try {
            setIsSearching(true);
            setKnowledgeError(null);
            const found = await searchKnowledge(trimmed);
            setKnowledgeResults(found);
        } catch (searchError) {
            console.error('Failed to search knowledge library:', searchError);
            setKnowledgeError('Could not complete search. Check console for details.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleRefresh = () => {
        loadTimeline();
        loadRatings();
        setStatusMessage('Timeline refreshed.');
        setTimeout(() => setStatusMessage(null), 2000);
    };

    return (
        <div className="p-8 h-full flex flex-col gap-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-gray-100">HRMR Observatory</h1>
                    <p className="text-gray-400 text-sm">
                        Transform AI alignment into a continuous, living process. Grade responses, trace performance, and search knowledge to build your bespoke AI persona.
                    </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    {statusMessage && <span className="text-blue-300">{statusMessage}</span>}
                    {activeTab === 'timeline' && (
                        <button
                            onClick={handleRefresh}
                            className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-600 bg-[#1e1f20] text-gray-300 hover:bg-gray-700"
                        >
                            <RefreshIcon className="h-4 w-4" /> Refresh
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-700">
                <button
                    onClick={() => setActiveTab('corpus')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                        activeTab === 'corpus'
                            ? 'border-blue-500 text-blue-300'
                            : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                    Graded Corpus
                </button>
                <button
                    onClick={() => {
                        setActiveTab('timeline');
                        loadTimeline();
                    }}
                    className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                        activeTab === 'timeline'
                            ? 'border-blue-500 text-blue-300'
                            : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                    Performance Timeline
                </button>
                <button
                    onClick={() => setActiveTab('knowledge')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                        activeTab === 'knowledge'
                            ? 'border-blue-500 text-blue-300'
                            : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                    Knowledge Search
                </button>
            </div>

            {/* Graded Corpus Tab */}
            {activeTab === 'corpus' && (
                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                    <div className="md:w-72 flex-shrink-0 bg-[#1e1f20] border border-gray-700 rounded-lg p-4 flex flex-col overflow-y-auto">
                        <div className="space-y-3 mb-4">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={event => setSearchTerm(event.target.value)}
                                placeholder="Search responses..."
                                className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <select
                                value={gradeFilter}
                                onChange={event => setGradeFilter(event.target.value as HrmrGrade | 'all')}
                                aria-label="Filter by grade"
                                className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                                <option value="all">All grades</option>
                                {HRMR_GRADE_SCALE.map(grade => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {isLoading ? (
                                <p className="text-gray-500 text-sm">Loading ratings…</p>
                            ) : filteredRatings.length === 0 ? (
                                <p className="text-gray-500 text-sm">No ratings yet. Grade a response from the chat page to get started.</p>
                            ) : (
                                filteredRatings.map(rating => (
                                    <button
                                        key={rating.id}
                                        onClick={() => setSelectedId(rating.id)}
                                        className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm border ${
                                            rating.id === selectedId ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#2a2b2c] hover:bg-gray-700 text-gray-300 border-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gradeColor(rating.grade)}`}>{rating.grade}</span>
                                            <span className="text-xs text-gray-400 ml-2">{format(rating.updatedAt, 'MMM d, yyyy')}</span>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-400 line-clamp-2">
                                            {rating.agentResponse}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex-1 bg-[#1e1f20] border border-gray-700 rounded-lg p-6 overflow-y-auto min-h-0">
                        {selectedRating ? (
                            <div className="h-full flex flex-col gap-4 overflow-y-auto min-h-0">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${gradeColor(selectedRating.grade)}`}>
                                        {selectedRating.grade}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        Updated {format(selectedRating.updatedAt, 'MMM d, yyyy • HH:mm')}
                                    </span>
                                    <div className="flex items-center gap-2 ml-auto">
                                        {HRMR_GRADE_SCALE.map(grade => (
                                            <button
                                                key={grade}
                                                onClick={() => handleGradeUpdate(selectedRating, grade)}
                                                className={`px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${
                                                    selectedRating.grade === grade
                                                        ? 'bg-blue-600 border-blue-400 text-white'
                                                        : 'bg-[#26282B] border-gray-700 text-gray-200 hover:bg-gray-700/60'
                                                }`}
                                            >
                                                {grade}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg bg-[#141517] p-4">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-sm max-w-none text-gray-100">
                                        {selectedRating.agentResponse}
                                    </ReactMarkdown>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedRating.preflection && (
                                        <div className="border border-gray-700 rounded-lg p-4 bg-[#141517]">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Preflection</h3>
                                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedRating.preflection}</p>
                                        </div>
                                    )}
                                    {selectedRating.internalMonologue && (
                                        <div className="border border-purple-600/40 rounded-lg p-4 bg-purple-900/10">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-300 mb-2">Internal Monologue</h3>
                                            <p className="text-sm text-purple-100 whitespace-pre-wrap">{selectedRating.internalMonologue}</p>
                                        </div>
                                    )}
                                    {selectedRating.stageDirections && (
                                        <div className="border border-yellow-600/40 rounded-lg p-4 bg-yellow-900/10">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-300 mb-2">Stage Directions</h3>
                                            <p className="text-sm text-yellow-100 whitespace-pre-wrap">{selectedRating.stageDirections}</p>
                                        </div>
                                    )}
                                    {selectedRating.memorySummary && (
                                        <div className="border border-blue-600/40 rounded-lg p-4 bg-blue-900/10">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-2">Memory Summary</h3>
                                            <p className="text-sm text-blue-100 whitespace-pre-wrap">{selectedRating.memorySummary}</p>
                                        </div>
                                    )}
                                    {selectedRating.tasks && selectedRating.tasks.length > 0 && (
                                        <div className="border border-green-600/40 rounded-lg p-4 bg-green-900/10">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-green-300 mb-2">Tasks</h3>
                                            <ul className="text-sm text-green-100 space-y-1 list-disc list-inside">
                                                {selectedRating.tasks.map(task => (
                                                    <li key={task.id}>{task.description}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-wrap gap-2">
                                        {selectedRating.modulesUsed?.map(module => (
                                            <span key={module} className="text-[10px] uppercase tracking-wider bg-blue-900/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-600/30">
                                                {module}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(selectedRating)}
                                        className="px-4 py-2 rounded-md text-sm font-semibold transition-colors bg-red-600 hover:bg-red-500 text-white"
                                    >
                                        Delete Rating
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                {isLoading ? 'Loading ratings…' : 'Select a rating to inspect details.'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Performance Timeline Tab */}
            {activeTab === 'timeline' && (
                <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#1e1f20] border border-gray-700 rounded-lg p-4">
                            <p className="text-xs uppercase tracking-wider text-gray-500">Overview</p>
                            <div className="mt-3 space-y-2 text-sm text-gray-300">
                                <div className="flex justify-between"><span>Total turns</span><span>{messages.length}</span></div>
                                <div className="flex justify-between"><span>Agent replies</span><span>{messages.filter(m => m.role === 'agent').length}</span></div>
                                <div className="flex justify-between"><span>Performers engaged</span><span>{performers.length}</span></div>
                                <div className="flex justify-between"><span>Avg. HRMR score</span><span>{averageScore.toFixed(2)}</span></div>
                            </div>
                        </div>
                        <div className="bg-[#1e1f20] border border-gray-700 rounded-lg p-4">
                            <p className="text-xs uppercase tracking-wider text-gray-500">Top Modules</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {topModules.length === 0 ? (
                                    <span className="text-sm text-gray-500">No module telemetry yet.</span>
                                ) : (
                                    topModules.map(([module, count]) => (
                                        <span key={module} className="px-3 py-1 rounded-full text-xs bg-blue-900/20 border border-blue-600/40 text-blue-200">
                                            {module} · {count}
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="bg-[#1e1f20] border border-gray-700 rounded-lg p-4">
                            <p className="text-xs uppercase tracking-wider text-gray-500">Filters</p>
                            <div className="mt-3 space-y-3 text-sm">
                                <div className="flex gap-2">
                                    <select
                                        value={roleFilter}
                                        onChange={e => setRoleFilter(e.target.value as 'all' | 'user' | 'agent')}
                                        aria-label="Filter by role"
                                        className="flex-1 bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">All Roles</option>
                                        <option value="user">User Only</option>
                                        <option value="agent">Agent Only</option>
                                    </select>
                                    <select
                                        value={performerFilter}
                                        onChange={e => setPerformerFilter(e.target.value as 'all' | 'core' | string)}
                                        aria-label="Filter by performer"
                                        className="flex-1 bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">All Performers</option>
                                        <option value="core">Seasuite Core</option>
                                        {performers.map(performer => (
                                            <option key={performer.id} value={performer.id}>{performer.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                        <SearchIcon className="w-4 h-4" />
                                    </div>
                                    <input
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search transcript, modules, grades…"
                                        className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg pl-9 pr-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredMessages.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                No timeline events found for the current filters.
                            </div>
                        ) : (
                            <ol className="space-y-4">
                                {filteredMessages.map((msg, index) => {
                                    const rating = ratingMap.get(msg.id);
                                    const timestampLabel = formatTimestamp(msg.timestamp || msg.id);
                                    const isAgent = msg.role === 'agent';
                                    const performerBadge = msg.performerId ? (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-purple-500 text-purple-200 bg-purple-900/30">
                                            <StageIcon className="h-3 w-3" />
                                            {msg.performerName || 'Performer'}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-gray-600 text-gray-300 bg-gray-800/40">
                                            Core Agent
                                        </span>
                                    );

                                    return (
                                        <li key={`${msg.id}-${index}`} className="bg-[#1e1f20] border border-gray-700 rounded-lg p-5 shadow-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <span className={`uppercase tracking-wider font-semibold ${isAgent ? 'text-blue-300' : 'text-purple-300'}`}>
                                                        {isAgent ? 'Agent' : 'User'}
                                                    </span>
                                                    {performerBadge}
                                                    <span className="text-gray-500">{timestampLabel}</span>
                                                </div>
                                                {rating && (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${gradeColor(rating.grade)}`}>
                                                            <GradeIcon className="h-3 w-3" /> {rating.grade}
                                                        </span>
                                                        {rating.modulesUsed && rating.modulesUsed.length > 0 && (
                                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                                <InsightIcon className="h-3 w-3" />
                                                                {rating.modulesUsed.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-3 prose prose-invert prose-sm max-w-none text-gray-200">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>
                </div>
            )}

            {/* Knowledge Search Tab */}
            {activeTab === 'knowledge' && (
                <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
                    <form onSubmit={handleKnowledgeSearch} className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-gray-700 bg-[#1C1D21] px-4 py-3 text-sm text-gray-200">
                        <input
                            value={knowledgeQuery}
                            onChange={event => setKnowledgeQuery(event.target.value)}
                            placeholder="Search by topic, mission, client, or memory..."
                            className="flex-1 bg-transparent outline-none placeholder:text-gray-500"
                        />
                        <button
                            type="submit"
                            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20"
                            disabled={isSearching}
                        >
                            {isSearching ? 'Searching…' : 'Search'}
                        </button>
                    </form>

                    {knowledgeError && (
                        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {knowledgeError}
                        </div>
                    )}

                    <section className="flex-1 overflow-y-auto rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
                        {knowledgeQuery.trim().length === 0 && knowledgeResults.length === 0 ? (
                            <div className="text-sm text-gray-500">
                                Start typing to query the archive. Try searching for mission names, client details, or keywords like "brand tone" or "pressure spike".
                            </div>
                        ) : knowledgeResults.length === 0 ? (
                            <div className="text-sm text-gray-500">
                                No matches found for <span className="font-semibold text-gray-300">"{knowledgeQuery.trim()}"</span>. Refine your keywords or try related terms.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(groupedKnowledgeResults).map(([type, entries]) => (
                                    <div key={type}>
                                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                                            {formatTypeLabel(type as LibrarianResult['type'])} · {entries.length}
                                        </h2>
                                        <div className="mt-3 space-y-3">
                                            {entries.map(entry => (
                                                <article key={entry.id} className="rounded-lg border border-gray-800 bg-[#141519] px-4 py-3 text-sm text-gray-200 hover:border-blue-500/50 hover:bg-[#1a1b1f] transition-all duration-200 transform hover:-translate-y-0.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                                                        <span className="uppercase tracking-widest text-gray-400">{formatTypeLabel(entry.type)}</span>
                                                        <span>{formatDistanceToNow(entry.timestamp, { addSuffix: true })}</span>
                                                    </div>
                                                    <div className="mt-1 text-base font-semibold text-gray-100">{entry.title}</div>
                                                    <p className="mt-1 text-sm text-gray-400 whitespace-pre-line">{entry.snippet}</p>
                                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                                        <span>Relevance score {entry.score.toFixed(1)}</span>
                                                        <Link
                                                            to={entry.link}
                                                            className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 transition-all duration-200 transform hover:scale-105 active:scale-95"
                                                        >
                                                            Open
                                                        </Link>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};

export default HrmrPage;
