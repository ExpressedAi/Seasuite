// FIX: Implemented file content to resolve build errors.
import React, { useState } from 'react';

const ThinkingPopover: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative inline-block">
            <button
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-300"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            {isOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-lg text-sm text-gray-300 z-10">
                    <p>"Thinking" or "preflection" is the agent's simulated internal monologue. It provides insight into how the agent is interpreting your query and planning its response.</p>
                </div>
            )}
        </div>
    );
};

export default ThinkingPopover;
