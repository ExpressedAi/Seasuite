import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { IntelligenceFollowUp, FollowUpStatus } from '../types';

interface FollowUpPanelProps {
  followUps: IntelligenceFollowUp[];
  onClose: () => void;
  onUpdateStatus: (id: string, status: FollowUpStatus) => void;
}

const STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed'
};

const STATUS_COLORS: Record<FollowUpStatus, string> = {
  pending: 'text-amber-300',
  in_progress: 'text-blue-300',
  completed: 'text-emerald-300'
};

const CATEGORY_BADGES: Record<string, string> = {
  brand: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  client: 'bg-orange-500/15 text-orange-200 border border-orange-500/30',
  mission: 'bg-blue-500/15 text-blue-200 border border-blue-500/30',
  operations: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  social: 'bg-purple-500/15 text-purple-200 border border-purple-500/30'
};

const FollowUpPanel: React.FC<FollowUpPanelProps> = ({ followUps, onClose, onUpdateStatus }) => {
  const sorted = useMemo(() => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const statusOrder: Record<FollowUpStatus, number> = { pending: 0, in_progress: 1, completed: 2 };
    return [...followUps].sort((a, b) => {
      const statusComparison = statusOrder[a.status] - statusOrder[b.status];
      if (statusComparison !== 0) return statusComparison;
      const priorityComparison =
        (priorityOrder[a.priority ?? 'medium'] ?? 1) - (priorityOrder[b.priority ?? 'medium'] ?? 1);
      if (priorityComparison !== 0) return priorityComparison;
      return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
    });
  }, [followUps]);

  return (
    <div className="fixed right-4 top-20 z-40 w-96 max-w-full rounded-2xl border border-gray-800 bg-[#111315] shadow-2xl shadow-blue-500/20">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Follow-Up Tasks</div>
          <div className="text-sm text-gray-300">Automated actions spun from intelligence signals.</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
        >
          Close
        </button>
      </div>
      <div className="max-h-[26rem] overflow-y-auto px-4 py-3 space-y-3">
        {sorted.length === 0 && (
          <p className="text-xs text-gray-500">
            No follow-ups queued. As new intelligence lands, actionable tasks will appear here automatically.
          </p>
        )}
        {sorted.map(task => {
          const statusClass = STATUS_COLORS[task.status];
          const categoryClass = CATEGORY_BADGES[task.category] ?? CATEGORY_BADGES.social;
          const dueDisplay =
            typeof task.dueAt === 'number'
              ? formatDistanceToNow(task.dueAt, { addSuffix: true })
              : 'No due date';

          return (
            <div key={task.id} className="rounded-xl border border-gray-800 bg-[#15171A] px-3 py-3 text-sm text-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-gray-100">{task.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${statusClass}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider ${categoryClass}`}>
                      {task.category}
                    </span>
                    {task.priority && (
                      <span className="text-[11px] uppercase tracking-wider text-gray-400">
                        {task.priority} priority
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-gray-500">{dueDisplay}</span>
              </div>
              {task.description && (
                <p className="mt-2 text-xs text-gray-300 whitespace-pre-line">{task.description}</p>
              )}
              {task.actionHint && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-[#191B1F] px-3 py-2 text-xs text-gray-300">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-100">{task.actionHint.label}</div>
                    {task.actionHint.description && (
                      <p className="mt-1 text-[11px] text-gray-400">{task.actionHint.description}</p>
                    )}
                  </div>
                  {task.actionHint.path && (
                    <Link
                      to={task.actionHint.path}
                      className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-200 hover:bg-blue-500/20"
                    >
                      Open
                    </Link>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                {task.status !== 'pending' && (
                  <button
                    onClick={() => onUpdateStatus(task.id, 'pending')}
                    className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    Mark Pending
                  </button>
                )}
                {task.status !== 'in_progress' && (
                  <button
                    onClick={() => onUpdateStatus(task.id, 'in_progress')}
                    className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs text-blue-200 hover:bg-blue-500/20"
                  >
                    Set In Progress
                  </button>
                )}
                {task.status !== 'completed' && (
                  <button
                    onClick={() => onUpdateStatus(task.id, 'completed')}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FollowUpPanel;
