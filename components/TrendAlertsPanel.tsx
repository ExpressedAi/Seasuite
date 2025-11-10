import React from 'react';
import { Link } from 'react-router-dom';
import { TrendAlert } from '../services/trendAnalyst';
import { formatDistanceToNow } from 'date-fns';

interface TrendAlertsPanelProps {
  alerts: TrendAlert[];
  onClose: () => void;
}

const severityStyles: Record<TrendAlert['severity'], { border: string; bg: string; tag: string }> = {
  critical: {
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    tag: 'text-red-300'
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    tag: 'text-amber-300'
  },
  info: {
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/10',
    tag: 'text-blue-300'
  }
};

const TrendAlertsPanel: React.FC<TrendAlertsPanelProps> = ({ alerts, onClose }) => {
  return (
    <div className="fixed right-4 top-24 z-50 w-96 max-w-full rounded-2xl border border-gray-800 bg-[#111315] shadow-2xl shadow-blue-500/10">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Trend Alerts</div>
          <div className="text-sm text-gray-300">Watcher safeguards & analyst telemetry.</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
        >
          Close
        </button>
      </div>
      <div className="max-h-[24rem] overflow-y-auto px-4 py-3 space-y-3">
                {alerts.length === 0 ? (
                  <p className="text-xs text-gray-500">All clear. Keeper is standing by.</p>
                ) : (
                  alerts.map(alert => {
            const styles = severityStyles[alert.severity];
            return (
              <article
                key={alert.id}
                className={`rounded-xl border ${styles.border} ${styles.bg} px-3 py-2.5`}
              >
                <header className="flex items-center justify-between text-xs">
                  <span className={`font-semibold uppercase tracking-wider ${styles.tag}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                  </span>
                </header>
                <div className="mt-1 text-sm font-semibold text-gray-100">{alert.title}</div>
                <p className="mt-1 text-sm text-gray-300">{alert.description}</p>
                {alert.suggestedPath && (
                  <Link
                    to={alert.suggestedPath}
                    className="mt-3 inline-flex rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-500/20"
                  >
                    Review
                  </Link>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrendAlertsPanel;
