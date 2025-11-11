import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConversationThread, ChatMessage } from '../types';
import { getAllThreads, saveThread, deleteThread, upsertJournalEntry, getJournalEntry } from '../services/db';
import { format } from 'date-fns';

interface EditableThreadState {
    title: string;
    summary: string;
    tags: string;
    journalNote: string;
}

const ThreadsPage: React.FC = () => {
    const [threads, setThreads] = useState<ConversationThread[]>([]);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [formState, setFormState] = useState<EditableThreadState | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const loadThreads = async () => {
        try {
            const allThreads = await getAllThreads();
            const sorted = allThreads.sort((a, b) => b.updatedAt - a.updatedAt);
            setThreads(sorted);
            if (!selectedThreadId && sorted.length > 0) {
                handleSelect(sorted[0].id, sorted[0]);
            } else if (selectedThreadId) {
                const current = sorted.find(thread => thread.id === selectedThreadId);
                if (current) {
                    handleSelect(current.id, current);
                }
            }
        } catch (error) {
            console.error('Failed to load conversation threads:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadThreads();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredThreads = useMemo(() => {
        if (!searchTerm.trim()) return threads;
        const lower = searchTerm.toLowerCase();
        return threads.filter(thread => {
            const inTitle = thread.title?.toLowerCase().includes(lower);
            const inTags = thread.tags?.some(tag => tag.toLowerCase().includes(lower));
            const inSummary = thread.summary?.toLowerCase().includes(lower);
            return inTitle || inTags || inSummary;
        });
    }, [threads, searchTerm]);

    const handleSelect = (threadId: string, thread?: ConversationThread) => {
        const target = thread || threads.find(t => t.id === threadId);
        if (!target) return;
        setSelectedThreadId(threadId);
        setFormState({
            title: target.title || '',
            summary: target.summary || '',
            tags: target.tags?.join(', ') || '',
            journalNote: target.journalNote || ''
        });
    };

    const handleInputChange = (field: keyof EditableThreadState, value: string) => {
        setFormState(prev => prev ? { ...prev, [field]: value } : prev);
    };

    const handleSave = async () => {
        if (!selectedThreadId || !formState) return;
        const thread = threads.find(t => t.id === selectedThreadId);
        if (!thread) return;

        setIsSaving(true);
        try {
            const updated: ConversationThread = {
                ...thread,
                title: formState.title.trim() || thread.title,
                summary: formState.summary.trim(),
                tags: formState.tags
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0),
                journalNote: formState.journalNote.trim(),
                updatedAt: Date.now()
            };
            await saveThread(updated);
            setStatusMessage('Thread metadata saved.');
            await loadThreads();
        } catch (error) {
            console.error('Failed to save thread metadata:', error);
            setStatusMessage('Unable to save changes. Check console for details.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setStatusMessage(null), 4000);
        }
    };

    const handleDelete = async () => {
        if (!selectedThreadId) return;
        const confirmation = window.confirm('Delete this conversation archive? This cannot be undone.');
        if (!confirmation) return;
        try {
            await deleteThread(selectedThreadId);
            setStatusMessage('Thread deleted.');
            setSelectedThreadId(null);
            setFormState(null);
            await loadThreads();
        } catch (error) {
            console.error('Failed to delete thread:', error);
            setStatusMessage('Could not delete thread.');
        } finally {
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    const handleSyncJournal = async () => {
        if (!selectedThreadId || !formState) return;
        const thread = threads.find(t => t.id === selectedThreadId);
        if (!thread) return;

        try {
            const journalDate = thread.journalDate || format(new Date(thread.createdAt), 'yyyy-MM-dd');
            const existing = await getJournalEntry(journalDate);
            const header = `Conversation: ${formState.title || thread.title}`;
            const noteBody = formState.journalNote || thread.journalNote || formState.summary || thread.summary;
            const content = existing?.content
                ? `${existing.content.trim()}\n\n${header}\n${noteBody}`
                : `${header}\n${noteBody}`;

            await upsertJournalEntry({
                date: journalDate,
                content
            });
            setStatusMessage('Journal entry synced.');
        } catch (error) {
            console.error('Failed to sync journal entry:', error);
            setStatusMessage('Could not write to the temporal journal.');
        } finally {
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    const selectedThread = selectedThreadId ? threads.find(t => t.id === selectedThreadId) : null;

    return (
        <div className="p-3 md:p-8 h-full flex flex-col gap-4 md:gap-6 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-gray-100">Conversation Threads</h1>
                    <p className="text-gray-400 text-sm">
                        Review archived conversations, add high-level metadata, and push curated summaries into the temporal journal.
                    </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    {statusMessage && <span className="text-blue-300">{statusMessage}</span>}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
                <div className="md:w-72 flex-shrink-0 bg-[#1e1f20] border border-gray-700 rounded-lg p-3 md:p-4 flex flex-col overflow-y-auto">
                    <div className="mb-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            placeholder="Search threads..."
                            className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {isLoading ? (
                            <p className="text-gray-500 text-sm">Loading threads…</p>
                        ) : filteredThreads.length === 0 ? (
                            <p className="text-gray-500 text-sm">No archived conversations yet.</p>
                        ) : (
                            filteredThreads.map(thread => (
                                <button
                                    key={thread.id}
                                    onClick={() => handleSelect(thread.id, thread)}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
                                        thread.id === selectedThreadId ? 'bg-blue-600 text-white' : 'bg-[#2a2b2c] hover:bg-gray-700 text-gray-300'
                                    }`}
                                >
                                    <div className="font-semibold truncate">{thread.title || 'Untitled Conversation'}</div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        {format(new Date(thread.updatedAt), 'MMM d, yyyy • HH:mm')}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex-1 bg-[#1e1f20] border border-gray-700 rounded-lg p-3 md:p-6 overflow-y-auto flex flex-col min-h-0">
                    {selectedThread && formState ? (
                        <div className="flex-1 flex flex-col gap-4 md:gap-6 overflow-y-auto min-h-0">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Title</label>
                                        <input
                                            type="text"
                                            value={formState.title}
                                            onChange={e => handleInputChange('title', e.target.value)}
                                            className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Summary</label>
                                        <textarea
                                            value={formState.summary}
                                            onChange={e => handleInputChange('summary', e.target.value)}
                                            className="w-full h-32 bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Tags (comma separated)</label>
                                        <input
                                            type="text"
                                            value={formState.tags}
                                            onChange={e => handleInputChange('tags', e.target.value)}
                                            className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Journal Note</label>
                                        <textarea
                                            value={formState.journalNote}
                                            onChange={e => handleInputChange('journalNote', e.target.value)}
                                            className="w-full h-32 bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            When you sync, this note is appended to the temporal journal for {selectedThread.journalDate || format(new Date(selectedThread.createdAt), 'MMM d, yyyy')}.
                                        </p>
                                    </div>
                                    <div className="bg-[#111214] border border-gray-700 rounded-lg p-4 h-40 overflow-y-auto">
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Quick Preview</h4>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-sm max-w-none text-gray-300">
                                            {formState.summary || '_No summary provided._'}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors ${isSaving ? 'bg-blue-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
                                >
                                    {isSaving ? 'Saving…' : 'Save Metadata'}
                                </button>
                                <button
                                    onClick={handleSyncJournal}
                                    className="px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors bg-purple-600 hover:bg-purple-500 text-white"
                                >
                                    Sync to Journal
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors bg-red-600 hover:bg-red-500 text-white ml-auto"
                                >
                                    Delete Thread
                                </button>
                            </div>

                            <div className="flex-1 bg-[#141517] border border-gray-800 rounded-lg p-4 overflow-y-auto">
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">Conversation Transcript</h3>
                                <div className="space-y-3 text-sm">
                                    {selectedThread.messages?.map((msg: ChatMessage) => (
                                        <div key={msg.id} className="p-3 rounded-lg border border-gray-800 bg-[#1d1f22]">
                                            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                                                {msg.role === 'user' ? 'User' : 'Agent'}
                                            </div>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-sm max-w-none text-gray-200">
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            {isLoading ? 'Loading conversations…' : 'Select a conversation thread to review its details.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ThreadsPage;
