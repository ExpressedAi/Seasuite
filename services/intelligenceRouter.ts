import { IntelligenceRecord } from './intelligenceLog';
import { IntelligenceCategory } from '../types';
import { processIntelligenceFollowUps } from './followUps';

type IntelligenceHandler = (record: IntelligenceRecord) => void;

const dispatchProcessedEvent = (record: IntelligenceRecord): void => {
  if (typeof window === 'undefined') return;
  void processIntelligenceFollowUps(record);
  window.dispatchEvent(new CustomEvent('intelligence-record-processed', { detail: record }));
};

const missionHandler: IntelligenceHandler = record => {
  const missionUpdates = Array.isArray(record.responsePayload?.missionUpdates)
    ? (record.responsePayload?.missionUpdates as Array<Record<string, unknown>>)
    : [];

  if (missionUpdates.length > 0) {
    record.derivedMissionProgress = missionUpdates
      .map(update => {
        const missionId = typeof update.missionId === 'string' ? update.missionId : null;
        const progress = typeof update.progress === 'number' ? update.progress : null;
        const completed = typeof update.completed === 'boolean' ? update.completed : false;

        if (!missionId || progress === null) return null;
        const title = typeof update.title === 'string' ? update.title : undefined;
        return {
          missionId,
          progress,
          completed,
          rewardXp: typeof update.rewardXp === 'number' ? update.rewardXp : undefined,
          title
        };
      })
      .filter(Boolean) as Array<{ missionId: string; progress: number; completed: boolean; rewardXp?: number }>;
    if (!record.summary) {
      const completedCount = record.derivedMissionProgress.filter(update => update.completed).length;
      const descriptor =
        completedCount > 0
          ? `${completedCount} mission${completedCount === 1 ? '' : 's'} completed`
          : `${record.derivedMissionProgress.length} mission${record.derivedMissionProgress.length === 1 ? '' : 's'} progressed`;
      record.summary = `Mission engine: ${descriptor}`;
    }
  }

  dispatchProcessedEvent(record);
};

const socialHandler: IntelligenceHandler = record => {
  if (!record.summary) {
    record.summary = 'New conversational intelligence captured';
  }
  dispatchProcessedEvent(record);
};

const brandHandler: IntelligenceHandler = record => {
  if (!record.summary) {
    record.summary = 'Brand intelligence updated';
  }
  dispatchProcessedEvent(record);
};

const clientHandler: IntelligenceHandler = record => {
  if (!record.summary) {
    record.summary = 'Client dossier updated';
  }
  dispatchProcessedEvent(record);
};

const operationsHandler: IntelligenceHandler = record => {
  if (!record.summary) {
    record.summary = 'Operational signal logged';
  }
  dispatchProcessedEvent(record);
};

const handlers: Partial<Record<IntelligenceCategory, IntelligenceHandler>> = {
  mission: missionHandler,
  social: socialHandler,
  brand: brandHandler,
  client: clientHandler,
  operations: operationsHandler
};

const inferCategory = (record: IntelligenceRecord): IntelligenceCategory => {
  if (record.category) return record.category;

  switch (record.source) {
    case 'brand_update':
      return 'brand';
    case 'client_update':
      return 'client';
    case 'dm_response':
      return 'mission';
    case 'post_processing':
      return 'operations';
    case 'chat_generate':
    case 'performer_response':
    default:
      return 'social';
  }
};

export const classifyIntelligence = (record: IntelligenceRecord): void => {
  const category = inferCategory(record);
  record.category = category;

  const handler = handlers[category];
  if (handler) {
    handler(record);
  } else {
    dispatchProcessedEvent(record);
  }
};

export const registerIntelligenceHandler = (category: IntelligenceCategory, handler: IntelligenceHandler): void => {
  handlers[category] = handler;
};
