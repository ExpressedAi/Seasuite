import React from 'react';

interface StageDirectionsPanelProps {
    directions: string;
}

const StageDirectionsPanel: React.FC<StageDirectionsPanelProps> = ({ directions }) => {
    return (
        <div className="border border-yellow-600/30 bg-yellow-900/10 rounded-lg p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-yellow-300 mb-1">Stage Directions</div>
            <p className="text-sm text-yellow-100 whitespace-pre-wrap">{directions}</p>
        </div>
    );
};

export default StageDirectionsPanel;
