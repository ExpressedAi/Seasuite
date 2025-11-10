import React, { useState, useEffect } from 'react';
import { getAllEscortDefinitions, EscortId, executeEscort, EscortResult } from '../services/escorts';
import { getPlayerProgress } from '../services/db';
import { EscortDefinition } from '../services/escorts';
import { ChatMessage } from '../types';

interface EscortToolbarProps {
    messages: ChatMessage[];
    onEscortResult: (result: EscortResult, escortName: string) => void;
}

const EscortToolbar: React.FC<EscortToolbarProps> = ({ messages, onEscortResult }) => {
    const [unlockedEscorts, setUnlockedEscorts] = useState<Set<EscortId>>(new Set());
    const [loadingEscort, setLoadingEscort] = useState<EscortId | null>(null);
    const [escorts, setEscorts] = useState<EscortDefinition[]>([]);

    useEffect(() => {
        const loadEscorts = async () => {
            const allEscorts = getAllEscortDefinitions();
            setEscorts(allEscorts);
            
            const progress = await getPlayerProgress();
            const unlocked = new Set<EscortId>();
            
            progress.earnedRewards.forEach(reward => {
                if (reward.type === 'escort') {
                    unlocked.add(reward.escortId as EscortId);
                }
            });
            
            setUnlockedEscorts(unlocked);
        };
        
        loadEscorts();
    }, []);

    const handleEscortClick = async (escort: EscortDefinition) => {
        if (!unlockedEscorts.has(escort.id)) return;
        
        setLoadingEscort(escort.id);
        try {
            // Get user's last message as input context
            const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
            const input = lastUserMessage?.content || undefined;
            
            const result = await executeEscort(escort.id, input, { messages });
            onEscortResult(result, escort.name);
        } catch (error) {
            console.error(`Failed to execute ${escort.name}:`, error);
            alert(`Failed to execute ${escort.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoadingEscort(null);
        }
    };

    if (unlockedEscorts.size === 0) {
        return null; // Don't show toolbar if no escorts unlocked
    }

    return (
        <div className="mb-3 p-3 bg-[#1a1b1f] border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Escorts</span>
                <span className="text-xs text-gray-500">({unlockedEscorts.size} unlocked)</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {escorts.map(escort => {
                    const isUnlocked = unlockedEscorts.has(escort.id);
                    const isLoading = loadingEscort === escort.id;
                    
                    if (!isUnlocked) return null;
                    
                    return (
                        <button
                            key={escort.id}
                            onClick={() => handleEscortClick(escort)}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-md border border-purple-500/40 bg-purple-500/10 text-xs font-medium text-purple-200 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={escort.description}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                    Analyzing...
                                </span>
                            ) : (
                                escort.name
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default EscortToolbar;

