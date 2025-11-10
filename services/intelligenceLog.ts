import { IntelligenceCategory } from '../types';
import { classifyIntelligence } from './intelligenceRouter';

export type IntelligenceSource = 'chat_generate' | 'performer_response' | 'post_processing' | 'brand_update' | 'client_update' | 'dm_response';

export interface IntelligenceRecord {
  id: string;
  source: IntelligenceSource;
  timestamp: number;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  summary?: string;
  category?: IntelligenceCategory;
  derivedMissionProgress?: Array<{ missionId: string; progress: number; completed: boolean; rewardXp?: number; title?: string }>;
  triggeredFollowUpIds?: string[];
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = 'intelligence-log';

const readLog = (): IntelligenceRecord[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    console.error('Failed to read intelligence log:', error);
  }
  return [];
};

const writeLog = (records: IntelligenceRecord[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_ENTRIES)));
    window.dispatchEvent(new CustomEvent('intelligence-log-updated'));
  } catch (error) {
    console.error('Failed to persist intelligence log:', error);
  }
};

export const logIntelligence = (record: Omit<IntelligenceRecord, 'id' | 'timestamp'>): IntelligenceRecord => {
  const entry: IntelligenceRecord = {
    ...record,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: Date.now()
  };
  classifyIntelligence(entry);
  const current = readLog();
  current.push(entry);
  writeLog(current);
  return entry;
};

export const getIntelligenceLog = (): IntelligenceRecord[] => readLog();
