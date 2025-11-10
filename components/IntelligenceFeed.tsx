import React, { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { IntelligenceRecord } from '../services/intelligenceLog';

interface IntelligenceFeedProps {
  records: IntelligenceRecord[];
  onClose: () => void;
}

const CATEGORY_STYLES: Record<string, { border: string; bg: string; tag: string }> = {
  mission: { border: 'border-blue-500/40', bg: 'bg-blue-500/10', tag: 'text-blue-300' },
  social: { border: 'border-purple-500/40', bg: 'bg-purple-500/10', tag: 'text-purple-300' },
  brand: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', tag: 'text-emerald-300' },
  client: { border: 'border-orange-500/40', bg: 'bg-orange-500/10', tag: 'text-orange-300' },
  operations: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', tag: 'text-amber-300' }
};

const formatCategoryLabel = (category?: string): string => {
  if (!category) return 'uncategorized';
  return category.replace('_', ' ');
};

const IntelligenceFeed: React.FC<IntelligenceFeedProps> = ({ records, onClose }) => {
  const latest = useMemo(() => records.slice(-15).reverse(), [records]);

  return (
    <div className="fixed right-4 bottom-4 z-40 w-96 max-w-full rounded-2xl border border-gray-800 bg-[#111315] shadow-xl shadow-blue-500/10">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Intelligence Feed</div>
          <div className="text-sm text-gray-300">Live breakdown of processed signals.</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
        >
          Close
        </button>
      </div>
      <div className="max-h-[24rem] overflow-y-auto px-4 py-3 space-y-3 text-sm text-gray-200">
        {latest.length === 0 && <p className="text-xs text-gray-500">No intelligence captured yet. Generate conversation or updates to populate this feed.</p>}
        {latest.map(record => {
          const category = record.category ?? 'social';
          const styles = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.social;
          const timestamp = formatDistanceToNow(record.timestamp, { addSuffix: true });
          return (
            <article
              key={record.id}
              className={`rounded-xl border ${styles.border} ${styles.bg} px-3 py-2.5`}
            >
              <header className="flex items-center justify-between text-xs">
                <span className={`font-semibold uppercase tracking-wider ${styles.tag}`}>
                  {formatCategoryLabel(category)}
                </span>
                <span className="text-[11px] text-gray-400">{timestamp}</span>
              </header>
              <p className="mt-1 text-sm text-gray-100">{record.summary || 'Signal captured'}</p>
              {record.derivedMissionProgress && record.derivedMissionProgress.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-blue-200">
                  {record.derivedMissionProgress.map(update => (
                    <li key={`${record.id}-${update.missionId}`}>
                      Mission {update.title || update.missionId}: {update.progress} progress{update.completed ? ' · completed' : ''}{update.rewardXp ? ` · +${update.rewardXp} XP` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {record.requestPayload && (
                <details className="mt-2 rounded-lg bg-black/20 px-2 py-1 text-[11px] text-gray-400">
                  <summary className="cursor-pointer text-gray-300">Payload</summary>
                  <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-[10px] text-gray-400">
                    {JSON.stringify(record.requestPayload, null, 2)}
                  </pre>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default IntelligenceFeed;
