import React, { useState } from 'react';
import { MemorySavedIcon, ChevronDownIcon } from './icons/Icons';

interface MemorySavedPanelProps {
    memory: {
        summary: string;
        tags: string[];
    };
}

const MemorySavedPanel: React.FC<MemorySavedPanelProps> = ({ memory }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border-l-4 border-green-400 bg-green-400/10 rounded-r-lg">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex-shrink-0 text-green-400 pt-0.5">
                        <MemorySavedIcon />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-green-300">Memory Saved</h3>
                         {!isExpanded && <p className="text-xs text-gray-500 truncate">{memory.summary}</p>}
                    </div>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-green-300 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="px-4 pb-4">
                    <div className="pl-9">
                        <p className="text-sm text-gray-400">
                            {memory.summary}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {memory.tags.map((tag, index) => (
                                <span key={index} className="bg-gray-700 text-green-300 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemorySavedPanel;