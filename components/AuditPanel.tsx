import React, { useState } from 'react';
import { AuditResult } from '../types';
import { AuditIcon, CheckIcon, CircleIcon, ChevronDownIcon } from './icons/Icons';

interface AuditPanelProps {
    auditResult: AuditResult;
}

const AuditPanel: React.FC<AuditPanelProps> = ({ auditResult }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const completedCount = auditResult.completedTasks.length;
    const pendingCount = auditResult.pendingTasks.length;

    return (
        <div className="border-l-4 border-purple-400 bg-purple-400/10 rounded-r-lg">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-purple-400 pt-0.5">
                        <AuditIcon />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-purple-300">Self-Audit</h3>
                        {!isExpanded && (
                             <p className="text-xs text-gray-500">
                                <span className="text-green-400">{completedCount} Completed</span>
                                <span className="mx-1">·</span>
                                <span className="text-yellow-400">{pendingCount} Pending</span>
                            </p>
                        )}
                    </div>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-purple-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="px-4 pb-4">
                    <div className="pl-9">
                        {auditResult.commentary && (
                            <p className="text-sm text-gray-400 italic mb-3">
                                "{auditResult.commentary}"
                            </p>
                        )}
                        <div className="space-y-3">
                            {auditResult.completedTasks.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider">Completed</h4>
                                    <ul className="mt-1 space-y-1">
                                        {auditResult.completedTasks.map((task, index) => (
                                            <li key={index} className="flex items-center gap-2 text-sm text-gray-400">
                                                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                <span>{task}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                             {auditResult.pendingTasks.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Pending</h4>
                                    <ul className="mt-1 space-y-1">
                                        {auditResult.pendingTasks.map((task, index) => (
                                            <li key={index} className="flex items-center gap-2 text-sm text-gray-400">
                                                <CircleIcon className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                                                <span>{task}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditPanel;