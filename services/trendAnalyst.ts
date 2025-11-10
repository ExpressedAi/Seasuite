import { getIntelligenceLog } from './intelligenceLog';
import { getFollowUps } from './db';
import { IntelligenceFollowUp } from '../types';

export type TrendSeverity = 'info' | 'warning' | 'critical';

export interface TrendAlert {
  id: string;
  title: string;
  description: string;
  severity: TrendSeverity;
  suggestedPath?: string;
  timestamp: number;
}

const HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * HOUR_MS;

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const summarizeFollowUps = (followUps: IntelligenceFollowUp[]) => {
  const pending = followUps.filter(task => task.status === 'pending');
  const highPriorityPending = pending.filter(task => task.priority === 'high');
  const inProgress = followUps.filter(task => task.status === 'in_progress');
  return {
    pendingCount: pending.length,
    highPriorityPending: highPriorityPending.length,
    inProgressCount: inProgress.length
  };
};

const extractMissionCompletions = (now: number) => {
  const logs = getIntelligenceLog();
  const recent = logs.filter(entry => entry.category === 'mission' && now - entry.timestamp <= SIX_HOURS_MS);
  let completions = 0;
  recent.forEach(entry => {
    entry.responsePayload?.missionUpdates?.forEach((update: any) => {
      if (update?.completed) completions += 1;
    });
  });
  return completions;
};

const extractWatcherSignals = (now: number) => {
  const logs = getIntelligenceLog();
  const recent = logs.filter(entry => entry.category === 'operations' && now - entry.timestamp <= HOUR_MS);
  let blocks = 0;
  let warnings = 0;
  recent.forEach(entry => {
    const summary = (entry.summary ?? '').toLowerCase();
    if (summary.includes('watcher blocked')) blocks += 1;
    else if (summary.includes('watcher warning')) warnings += 1;
  });
  return { blocks, warnings, recent };
};

export const analyzeTrends = async (): Promise<TrendAlert[]> => {
  const alerts: TrendAlert[] = [];
  const now = Date.now();
  const followUps = await getFollowUps();
  const backlog = summarizeFollowUps(followUps);
  const watcherSignals = extractWatcherSignals(now);
  const missionCompletions = extractMissionCompletions(now);

  if (watcherSignals.blocks > 0) {
    alerts.push({
      id: createId('watcher-block'),
      severity: 'critical',
      title: 'Watcher blocked XP payouts',
      description: `${watcherSignals.blocks} reward attempt(s) were blocked in the last hour. Review progression settings before retrying.`,
      suggestedPath: '/progress',
      timestamp: now
    });
  } else if (watcherSignals.warnings >= 3) {
    alerts.push({
      id: createId('watcher-warn'),
      severity: 'warning',
      title: 'XP pipeline under review',
      description: `Watcher logged ${watcherSignals.warnings} warnings in the last hour. Ensure rewards are sized correctly and actors are valid.`,
      suggestedPath: '/progress',
      timestamp: now
    });
  }

  if (backlog.highPriorityPending >= 3) {
    alerts.push({
      id: createId('followup-critical'),
      severity: 'critical',
      title: 'High-priority follow-ups piling up',
      description: `There are ${backlog.highPriorityPending} high-priority follow-ups waiting. Clear the queue to keep momentum.`,
      suggestedPath: '/team',
      timestamp: now
    });
  } else if (backlog.pendingCount >= 8) {
    alerts.push({
      id: createId('followup-warn'),
      severity: 'warning',
      title: 'Follow-up backlog rising',
      description: `${backlog.pendingCount} follow-ups are still pending. Consider triaging the queue.`,
      suggestedPath: '/team',
      timestamp: now
    });
  }

  if (missionCompletions === 0) {
    alerts.push({
      id: createId('mission-drought'),
      severity: 'info',
      title: 'Mission completions cooling off',
      description: 'No missions closed in the last six hours. Revisit active objectives to maintain XP velocity.',
      suggestedPath: '/progress',
      timestamp: now
    });
  }

  return alerts;
};
