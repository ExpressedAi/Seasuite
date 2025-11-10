import React from 'react';

interface MonologuePanelProps {
    monologue: string;
}

const MonologuePanel: React.FC<MonologuePanelProps> = ({ monologue }) => {
    return (
        <div className="border border-purple-600/40 bg-purple-900/20 rounded-lg p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">Internal Monologue</div>
            <p className="text-sm text-purple-100 whitespace-pre-wrap">{monologue}</p>
        </div>
    );
};

export default MonologuePanel;
