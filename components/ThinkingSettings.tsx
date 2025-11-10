// FIX: Implemented file content to resolve build errors.
import React from 'react';
import ToggleSwitch from './ToggleSwitch';
import ThinkingPopover from './ThinkingPopover';

interface ThinkingSettingsProps {
    showThinking: boolean;
    setShowThinking: (show: boolean) => void;
}

const ThinkingSettings: React.FC<ThinkingSettingsProps> = ({ showThinking, setShowThinking }) => {
    return (
        <div className="bg-[#1e1f20] p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                        Show "Thinking"
                        <ThinkingPopover />
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Display the agent's internal monologue ("preflection") before it responds.
                    </p>
                </div>
                <ToggleSwitch
                    label="Show Thinking"
                    enabled={showThinking}
                    onChange={setShowThinking}
                />
            </div>
        </div>
    );
};

export default ThinkingSettings;
