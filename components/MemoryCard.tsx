import React, { useMemo, useState } from 'react';
import { Memory } from '../types';
import { EditIcon, SaveIcon, XIcon, TrashIcon, PlusIcon } from './icons/Icons';
import { processMemory, applyProcessingResult } from '../services/memoryProcessor';

const IMPORTANCE_GRADES: { label: string; value: number }[] = [
    { label: 'A+', value: 10 },
    { label: 'A', value: 9 },
    { label: 'A-', value: 8 },
    { label: 'B+', value: 7 },
    { label: 'B', value: 6 },
    { label: 'B-', value: 5 },
    { label: 'C', value: 4 },
    { label: 'D', value: 3 },
    { label: 'F', value: 1 }
];

interface MemoryCardProps {
    memory: Memory;
    onUpdate: (memory: Memory) => void;
    onDelete: (id: number) => void;
    isSelected?: boolean;
    onSelect?: (id: number, selected: boolean) => void;
    batchProcessing?: boolean;
}

const MemoryCard: React.FC<MemoryCardProps> = ({ memory, onUpdate, onDelete, isSelected = false, onSelect, batchProcessing = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [summaryDraft, setSummaryDraft] = useState(memory.summary);
    const [tagsDraft, setTagsDraft] = useState(memory.tags.join(', '));
    const [relevanceDraft, setRelevanceDraft] = useState(memory.relevance);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);

    const formattedTags = useMemo(() =>
        tagsDraft
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
    , [tagsDraft]);

    const formattedConversation = (memory.conversation || '')
        .split('\n\n')
        .map((turn, index) => {
            const parts = turn.split(':');
            const speaker = parts[0];
            const text = parts.slice(1).join(':').trim();
            return (
                <p key={index} className="mb-2">
                    <span className={`font-semibold ${speaker === 'User' ? 'text-purple-300' : 'text-blue-300'}`}>{speaker}:</span>
                    <span className="ml-2">{text}</span>
                </p>
            );
        });

    const handleProcess = async () => {
        if (!memory.id) return;
        setProcessing(true);
        try {
            const processingResult = await processMemory(memory);
            setResult(processingResult);
        } catch (error) {
            console.error('Processing failed:', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleApply = async () => {
        if (!memory.id || !result) return;
        setProcessing(true);
        try {
            await applyProcessingResult(memory.id, result);
            setResult(null);
            onUpdate({ ...memory, relevance: result.rerankedRelevance });
        } catch (error) {
            console.error('Apply failed:', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleSave = () => {
        if (!memory.id) return;
        onUpdate({
            ...memory,
            summary: summaryDraft.trim() || memory.summary,
            tags: formattedTags,
            relevance: relevanceDraft
        });
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (!memory.id) return;
        const confirmation = window.confirm('Delete this memory?');
        if (!confirmation) return;
        onDelete(memory.id);
    };

    return (
        <div className={`bg-[#1e1f20] rounded-lg p-6 border transition-all duration-300 flex flex-col gap-4 hover:shadow-xl hover:shadow-blue-500/10 transform hover:-translate-y-1 ${
            isSelected 
                ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
                : 'border-gray-700 hover:border-blue-500'
        } ${batchProcessing ? 'opacity-75' : ''}`}>
            {onSelect && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => memory.id && onSelect(memory.id, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-[#26282B] text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                    <span className="text-xs text-gray-400">Select for batch processing</span>
                </div>
            )}
            <div className="flex items-start justify-between gap-3">
                {isEditing ? (
                    <textarea
                        value={summaryDraft}
                        onChange={e => setSummaryDraft(e.target.value)}
                        className="flex-1 bg-[#26282B] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                    />
                ) : (
                    <p className="text-gray-300 flex-1">{memory.summary}</p>
                )}
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white">
                                <SaveIcon />
                            </button>
                            <button onClick={() => {
                                setSummaryDraft(memory.summary);
                                setTagsDraft(memory.tags.join(', '));
                                setRelevanceDraft(memory.relevance);
                                setIsEditing(false);
                            }} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200">
                                <XIcon />
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-all duration-200 transform hover:scale-110 active:scale-95">
                                <EditIcon />
                            </button>
                            <button onClick={handleDelete} className="p-2 rounded-md bg-red-600 hover:bg-red-500 text-white transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg shadow-red-500/30">
                                <TrashIcon />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {isEditing ? (
                    <input
                        value={tagsDraft}
                        onChange={e => setTagsDraft(e.target.value)}
                        placeholder="Tags (comma separated)"
                        className="w-full bg-[#26282B] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                ) : (
                    memory.tags.map((tag, index) => (
                        <a
                            key={index}
                            href={`#/graph?tag=${encodeURIComponent(tag)}`}
                            className="bg-gray-700 text-blue-300 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-blue-600 hover:text-white transition-colors"
                        >
                            #{tag}
                        </a>
                    ))
                )}
            </div>

            {isExpanded && (
                <div className="mb-4 mt-2 p-4 bg-black/20 rounded-lg max-h-60 overflow-y-auto">
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Conversation Snippet</h4>
                    <div className="text-sm text-gray-400">{formattedConversation}</div>
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700/50">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                            {isExpanded ? 'Hide' : 'View'} Conversation
                        </button>
                        {!isEditing && (
                            <button
                                onClick={handleProcess}
                                disabled={processing}
                                className="text-purple-400 hover:text-purple-300 font-semibold disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : 'Post-Process'}
                            </button>
                        )}
                    </div>
                    <span className={`font-bold ${relevanceDraft > 7 ? 'text-green-400' : relevanceDraft > 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                        Relevance: {isEditing ? relevanceDraft : memory.relevance}/10
                    </span>
                </div>

                {result && (
                    <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-semibold text-purple-400">Processing Results</p>
                            <button
                                onClick={handleApply}
                                disabled={processing}
                                className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                            >
                                Apply All
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{result.reasoning}</p>
                        <div className="space-y-1 text-xs">
                            {result.clientUpdates.length > 0 && (
                                <div className="text-blue-400">→ {result.clientUpdates.length} client update(s)</div>
                            )}
                            {result.brandUpdates && (
                                <div className="text-blue-400">→ Brand intelligence update</div>
                            )}
                            {result.performerUpdates.length > 0 && (
                                <div className="text-blue-400">→ {result.performerUpdates.length} performer update(s)</div>
                            )}
                            {result.calendarEntries.length > 0 && (
                                <div className="text-blue-400">→ {result.calendarEntries.length} calendar entry(ies)</div>
                            )}
                            {result.knowledgeConnections.length > 0 && (
                                <div className="text-blue-400">→ {result.knowledgeConnections.length} knowledge connection(s)</div>
                            )}
                            {result.rerankedRelevance !== memory.relevance && (
                                <div className="text-yellow-400">→ Relevance: {memory.relevance} → {result.rerankedRelevance}</div>
                            )}
                        </div>
                    </div>
                )}


                {isEditing && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {IMPORTANCE_GRADES.map(grade => (
                                <button
                                    key={grade.label}
                                    onClick={() => setRelevanceDraft(grade.value)}
                                    className={`px-2 py-1 rounded-md text-xs font-semibold border ${
                                        relevanceDraft === grade.value ? 'bg-blue-600 border-blue-400 text-white' : 'bg-[#26282B] border-gray-700 text-gray-200 hover:bg-gray-700'
                                    }`}
                                >
                                    {grade.label}
                                </button>
                            ))}
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Fine Tune</label>
                            <input
                                type="range"
                                min={0}
                                max={10}
                                value={relevanceDraft}
                                onChange={e => setRelevanceDraft(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MemoryCard;
