import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDownIcon } from './icons/Icons';
import { EscortResult } from '../services/escorts';

interface EscortPanelProps {
    result: EscortResult;
    escortName: string;
}

const EscortPanel: React.FC<EscortPanelProps> = ({ result, escortName }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="border-l-4 border-purple-400 bg-purple-400/10 rounded-r-lg mt-3">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-purple-400 pt-0.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-purple-300">{escortName}</h3>
                        <p className="text-xs text-purple-200/70 mt-0.5">
                            {new Date(result.timestamp).toLocaleTimeString()}
                        </p>
                    </div>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-purple-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="px-4 pb-4">
                    <div className="pl-9 prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {result.result}
                        </ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EscortPanel;

