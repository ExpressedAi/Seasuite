import React, { useEffect, useState } from 'react';
import { DramaEvent } from '../types';

interface DramaNotificationProps {
  event: DramaEvent;
  onDismiss: () => void;
}

const DRAMA_ICONS: Record<DramaEvent['type'], string> = {
  conflict: '⚔️',
  alliance: '🤝',
  betrayal: '🗡️',
  confession: '💭',
  revelation: '✨',
  romance: '💕'
};

const DRAMA_COLORS: Record<DramaEvent['type'], string> = {
  conflict: 'border-red-500 bg-red-500/10',
  alliance: 'border-blue-500 bg-blue-500/10',
  betrayal: 'border-purple-500 bg-purple-500/10',
  confession: 'border-yellow-500 bg-yellow-500/10',
  revelation: 'border-cyan-500 bg-cyan-500/10',
  romance: 'border-pink-500 bg-pink-500/10'
};

const DramaNotification: React.FC<DramaNotificationProps> = ({ event, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`border-l-4 rounded-lg p-4 shadow-lg max-w-sm ${DRAMA_COLORS[event.type]}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{DRAMA_ICONS[event.type]}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white uppercase tracking-wide">
                {event.type}
              </span>
              <span className="text-xs text-gray-400">
                Intensity: {event.intensity}%
              </span>
            </div>
            <p className="text-sm text-gray-300">{event.description}</p>
            <div className="mt-2 text-xs text-gray-500">
              {event.participants.join(', ')}
            </div>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default DramaNotification;
