import React, { useState } from 'react';
import { PreflectionIcon, ChevronDownIcon } from './icons/Icons';

interface PreflectionPanelProps {
    instruction: string;
}

const PreflectionPanel: React.FC<PreflectionPanelProps> = ({ instruction }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border-l-4 border-blue-400 bg-blue-400/10 rounded-r-lg">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-blue-400 pt-0.5">
                        <PreflectionIcon />
                    </div>
                    <h3 className="font-semibold text-blue-300">Preflection</h3>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-blue-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="px-4 pb-4">
                     <div className="pl-9">
                        <p className="text-sm text-gray-400 italic">
                            "{instruction}"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PreflectionPanel;