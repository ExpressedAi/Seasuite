
import React from 'react';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, content }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#1e1f20] p-6 rounded-lg max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Analysis</h2>
        <pre className="bg-black/20 p-4 rounded text-gray-300 text-sm whitespace-pre-wrap">
          {content}
        </pre>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AnalysisModal;
