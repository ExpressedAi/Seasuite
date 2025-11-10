import React, { useState, useEffect } from 'react';
import { JournalEntry } from '../types';
import { upsertJournalEntry } from '../services/db';
import { format } from 'date-fns';

interface JournalModalProps {
    date: Date;
    entry?: JournalEntry;
    onClose: () => void;
    onSave: (entry: JournalEntry) => void;
}

const JournalModal: React.FC<JournalModalProps> = ({ date, entry, onClose, onSave }) => {
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const dateKey = format(date, 'yyyy-MM-dd');

    useEffect(() => {
        setContent(entry?.content || '');
    }, [entry]);

    const handleSave = async () => {
        setIsSaving(true);
        const newEntry: JournalEntry = {
            date: dateKey,
            content: content
        };
        try {
            await upsertJournalEntry(newEntry);
            onSave(newEntry);
        } catch (error) {
            console.error("Failed to save journal entry:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="bg-gradient-to-br from-[#1e1f20] via-[#1a1b1c] to-[#141517] rounded-xl shadow-2xl w-full max-w-3xl border border-gray-700/50 p-8 m-4 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Journal Entry
                        </h2>
                        <p className="text-gray-400 mt-1 flex items-center gap-2">
                            <span>📅</span>
                            <span>{format(date, 'EEEE, MMMM d, yyyy')}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-lg p-2 transition-all duration-200 hover:scale-110"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-gray-300 flex items-center gap-2">
                        <span className="text-blue-400">💡</span>
                        <span>This entry will be added to the agent's long-term temporal context and can be referenced in future conversations.</span>
                    </p>
                </div>

                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write about key events, insights, continuity notes, or instructions for the future...

Example:
- Character developments
- Important plot points
- Relationship changes
- World state updates
- Future reminders"
                    className="w-full h-80 bg-[#0a0b0c] text-gray-300 rounded-lg p-5 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y font-mono text-sm leading-relaxed transition-all duration-200"
                />

                <div className="flex justify-between items-center mt-6">
                    <div className="text-xs text-gray-500">
                        {content.length} characters
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-gray-700/50 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <span>💾</span>
                                    Save Entry
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JournalModal;
