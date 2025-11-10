import { ExperienceEventType, PlayerProgress, SkillBranchId } from '../types';

type WatcherStatus = 'ok' | 'warn' | 'block';

export interface WatcherVerdict {
  status: WatcherStatus;
  reasons: string[];
  suggestions?: string[];
  metadata?: Record<string, unknown>;
}

export interface ExperienceAuditInput {
  branch: SkillBranchId;
  type: ExperienceEventType;
  baseXp: number;
  actorIds: string[];
  context?: 'public' | 'private' | 'system';
  metadata?: Record<string, unknown>;
  progress: PlayerProgress;
  timestamp: number;
}

const XP_WARN_THRESHOLD = 200;
const XP_BLOCK_THRESHOLD = 500;
const XP_WINDOW_MS = 60 * 1000;
const XP_WINDOW_LIMIT = 800; // base XP per minute per branch trigger warning

interface XpHistoryEntry {
  timestamp: number;
  branch: SkillBranchId;
  baseXp: number;
}

const xpHistory: XpHistoryEntry[] = [];

const pruneXpHistory = (now: number) => {
  while (xpHistory.length && now - xpHistory[0].timestamp > XP_WINDOW_MS) {
    xpHistory.shift();
  }
};

export const auditExperienceAward = (input: ExperienceAuditInput): WatcherVerdict => {
  const reasons: string[] = [];
  const suggestions: string[] = [];

  if (input.baseXp <= 0) {
    reasons.push('Experience award must be positive.');
    suggestions.push('Adjust base XP to a positive value.');
    return { status: 'block', reasons, suggestions };
  }

  if (input.baseXp > XP_BLOCK_THRESHOLD) {
    reasons.push(`Base XP ${input.baseXp} exceeds the hard limit of ${XP_BLOCK_THRESHOLD}.`);
    suggestions.push('Reduce the XP reward or break it into smaller chunks.');
    return { status: 'block', reasons, suggestions };
  }

  if (!input.actorIds || input.actorIds.length === 0) {
    reasons.push('No actor IDs supplied for XP award.');
    suggestions.push('Include at least one actor to attribute the reward.');
    return { status: 'block', reasons, suggestions };
  }

  const uniqueActors = new Set(input.actorIds);
  if (uniqueActors.size !== input.actorIds.length) {
    reasons.push('Duplicate actor IDs detected in XP award payload.');
    suggestions.push('Ensure each actor ID only appears once per award.');
  }

  const multiplier = Math.max(1, input.progress.earnedRewards.length);
  if (multiplier > 10) {
    reasons.push('Large number of earned rewards detected; multiplier stack may be excessive.');
    suggestions.push('Review unlocked rewards for runaway multipliers.');
  }

  pruneXpHistory(input.timestamp);
  const recentBranchTotal = xpHistory
    .filter(entry => entry.branch === input.branch)
    .reduce((acc, entry) => acc + entry.baseXp, 0);

  if (recentBranchTotal + input.baseXp > XP_WINDOW_LIMIT) {
    reasons.push(`Branch ${input.branch} received ${recentBranchTotal} XP in the last minute.`);
    suggestions.push('Throttle XP awards or confirm this burst is intentional.');
  }

  if (input.baseXp > XP_WARN_THRESHOLD) {
    reasons.push(`Base XP ${input.baseXp} exceeds soft threshold ${XP_WARN_THRESHOLD}.`);
    suggestions.push('Consider lowering the reward or splitting it across events.');
  }

  if (reasons.length === 0) {
    return { status: 'ok', reasons: [] };
  }

  const status: WatcherStatus = reasons.some(reason => reason.includes('exceeds the hard limit') || reason.includes('must be positive') || reason.includes('No actor IDs'))
    ? 'block'
    : 'warn';

  return { status, reasons, suggestions };
};

export const noteExperienceAward = (input: ExperienceAuditInput): void => {
  pruneXpHistory(input.timestamp);
  xpHistory.push({
    timestamp: input.timestamp,
    branch: input.branch,
    baseXp: input.baseXp
  });
};

export interface DirectMessageAuditInput {
  senderId: string;
  recipientId: string;
  conversationId: string;
  message: string;
  timestamp: number;
}

interface DmHistoryEntry {
  senderId: string;
  timestamp: number;
  messageHash: string;
}

const DM_WINDOW_MS = 30 * 1000;
const DM_RATE_LIMIT = 6;
const DM_MAX_LENGTH = 1500;
const dmHistory: DmHistoryEntry[] = [];

const hashMessage = (text: string): string => {
  return text.slice(0, 128).toLowerCase();
};

const pruneDmHistory = (now: number) => {
  while (dmHistory.length && now - dmHistory[0].timestamp > DM_WINDOW_MS) {
    dmHistory.shift();
  }
};

export const auditDirectMessage = (input: DirectMessageAuditInput): WatcherVerdict => {
  const reasons: string[] = [];
  const suggestions: string[] = [];

  const trimmed = input.message.trim();
  if (!trimmed) {
    reasons.push('Empty message cannot be sent.');
    suggestions.push('Provide content before sending.');
    return { status: 'block', reasons, suggestions };
  }

  if (trimmed.length > DM_MAX_LENGTH) {
    reasons.push(`Message length ${trimmed.length} exceeds limit of ${DM_MAX_LENGTH}.`);
    suggestions.push('Shorten the message or split it across multiple sends.');
    return { status: 'block', reasons, suggestions };
  }

  if (input.senderId === input.recipientId) {
    reasons.push('Sender and recipient are identical.');
    suggestions.push('Pick a different recipient.');
    return { status: 'block', reasons, suggestions };
  }

  pruneDmHistory(input.timestamp);
  const recentMessages = dmHistory.filter(entry => entry.senderId === input.senderId);
  if (recentMessages.length >= DM_RATE_LIMIT) {
    reasons.push(`Sender has sent ${recentMessages.length} messages in the last ${DM_WINDOW_MS / 1000} seconds.`);
    suggestions.push('Wait a moment before sending more messages.');
  }

  const messageHash = hashMessage(trimmed);
  const isDuplicate = recentMessages.some(entry => entry.messageHash === messageHash);
  if (isDuplicate) {
    reasons.push('Message appears to be a near duplicate of a recent send.');
    suggestions.push('Consider rephrasing or consolidating repeated DMs.');
  }

  const status: WatcherStatus = reasons.length === 0 ? 'ok' : 'warn';
  return { status, reasons, suggestions };
};

export const noteDirectMessage = (input: DirectMessageAuditInput): void => {
  pruneDmHistory(input.timestamp);
  dmHistory.push({
    senderId: input.senderId,
    timestamp: input.timestamp,
    messageHash: hashMessage(input.message)
  });
};
