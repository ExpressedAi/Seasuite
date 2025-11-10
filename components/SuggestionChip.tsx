
import React from 'react';
import { SparklesIcon } from './icons/Icons';

interface SuggestionChipProps {
  text: string;
  hasIcon?: boolean;
}

const SuggestionChip: React.FC<SuggestionChipProps> = ({ text, hasIcon }) => {
  return (
    <button 
      className="bg-[#1e1f20] hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20 text-gray-300 py-2 px-4 rounded-full flex items-center gap-2 transition-all duration-200 border border-gray-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20 transform hover:scale-105 active:scale-95"
      onClick={() => {
        // This will be handled by parent component
        const event = new CustomEvent('suggestion-click', { detail: { text } });
        window.dispatchEvent(event);
      }}
    >
      {hasIcon && <SparklesIcon className="w-4 h-4 animate-pulse" />}
      <span>{text}</span>
    </button>
  );
};

export default SuggestionChip;
