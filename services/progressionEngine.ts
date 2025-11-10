import {
  addExperienceEvents,
  getPlayerProgress,
  savePlayerProgress
} from './db';
import { ExperienceEvent, ExperienceEventType, MissionDefinition, MissionProgress, MissionSummary, PlayerProgress, SkillReward, SkillBranchId } from '../types';
import { SKILLS, getRankForXp, getSkillDefinition } from './skills';
import { processMissions } from './missionEngine';
import { logIntelligence } from './intelligenceLog';
import { MISSION_DEFINITIONS } from './missionDefinitions';
import { auditExperienceAward, noteExperienceAward } from './watcher';

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

interface AwardExperienceOptions {
  branch: SkillBranchId;
  type: ExperienceEventType;
  baseXp: number;
  actorIds: string[];
  context?: 'public' | 'private' | 'system';
  metadata?: Record<string, unknown>;
}

const XP_MULTIPLIER_REWARD = 'xp_multiplier';

const getXpMultiplier = (rewards: SkillReward[]): number => {
  return rewards
    .filter(reward => reward.type === 'stat' && reward.stat === XP_MULTIPLIER_REWARD)
    .reduce((acc, reward) => acc * (reward.value as number), 1);
};

const mergeRewards = (current: SkillReward[], fresh: SkillReward[]): SkillReward[] => {
  const serialized = new Set(current.map(JSON.stringify));
  fresh.forEach(reward => {
    const key = JSON.stringify(reward);
    if (!serialized.has(key)) {
      serialized.add(key);
      current.push(reward);
    }
  });
  return current;
};

export const awardExperience = async (options: AwardExperienceOptions): Promise<{ progress: PlayerProgress; event: ExperienceEvent; gainedXp: number; missionRewards: ExperienceEvent[]; missionUpdates: MissionUpdate[] }> => {
  const progress = await getPlayerProgress();
  const multiplier = getXpMultiplier(progress.earnedRewards);
  const xp = Math.round(options.baseXp * multiplier);
  const timestamp = Date.now();

  const auditVerdict = auditExperienceAward({
    ...options,
    progress,
    timestamp
  });

  if (auditVerdict.status === 'block') {
    logIntelligence({
      source: 'post_processing',
      category: 'operations',
      summary: `Watcher blocked XP award: ${auditVerdict.reasons.join('; ')}`,
      requestPayload: options,
      responsePayload: auditVerdict
    });
    throw new Error(`Watcher blocked XP award: ${auditVerdict.reasons.join('; ')}`);
  }

  if (auditVerdict.status === 'warn') {
    logIntelligence({
      source: 'post_processing',
      category: 'operations',
      summary: `Watcher warning on XP award`,
      requestPayload: options,
      responsePayload: auditVerdict
    });
  }

  const event: ExperienceEvent = {
    id: `xp_${timestamp}_${createId()}`,
    branch: options.branch,
    type: options.type,
    xp,
    actorIds: options.actorIds,
    context: options.context || 'public',
    metadata: options.metadata,
    timestamp
  };

  let newProgress: PlayerProgress = {
    ...progress,
    totalXp: progress.totalXp + xp,
    branchXp: {
      ...progress.branchXp,
      [options.branch]: (progress.branchXp[options.branch] ?? 0) + xp
    }
  };
  newProgress.rankId = getRankForXp(newProgress.totalXp).id;

  const missionResult = processMissions(newProgress, event);
  newProgress = missionResult.progress;
  newProgress.rankId = getRankForXp(newProgress.totalXp).id;

  await addExperienceEvents([event, ...missionResult.rewardEvents]);
  await savePlayerProgress(newProgress);
  noteExperienceAward({
    ...options,
    progress: newProgress,
    timestamp
  });

  logIntelligence({
    source: options.context === 'private' ? 'dm_response' : 'chat_generate',
    requestPayload: {
      branch: options.branch,
      type: options.type,
      baseXp: options.baseXp,
      actorIds: options.actorIds,
      metadata: options.metadata
    },
    responsePayload: {
      gainedXp: xp,
      missionRewards: missionResult.rewardEvents,
      missionUpdates: missionResult.missionUpdates
    },
    category: 'mission'
  });

  return { progress: newProgress, event, gainedXp: xp, missionRewards: missionResult.rewardEvents, missionUpdates: missionResult.missionUpdates };
};

export const unlockSkill = async (skillId: string): Promise<{ progress: PlayerProgress; unlocked: boolean; reason?: string }> => {
  const definition = getSkillDefinition(skillId);
  if (!definition) {
    return { progress: await getPlayerProgress(), unlocked: false, reason: 'Skill not found.' };
  }

  const progress = await getPlayerProgress();

  if (progress.unlockedSkillIds.includes(skillId)) {
    return { progress, unlocked: false, reason: 'Skill already unlocked.' };
  }

  if (definition.prerequisites && !definition.prerequisites.every(req => progress.unlockedSkillIds.includes(req))) {
    return { progress, unlocked: false, reason: 'Prerequisites not satisfied.' };
  }

  const branchXp = progress.branchXp[definition.branch] ?? 0;
  if (branchXp < definition.cost) {
    return { progress, unlocked: false, reason: 'Insufficient branch XP.' };
  }

  const updated: PlayerProgress = {
    ...progress,
    unlockedSkillIds: [...progress.unlockedSkillIds, definition.id],
    earnedRewards: mergeRewards([...progress.earnedRewards], definition.rewards)
  };

  await savePlayerProgress(updated);
  return { progress: updated, unlocked: true };
};

export const getUnlockedSkillSet = async (): Promise<Set<string>> => {
  const progress = await getPlayerProgress();
  return new Set(progress.unlockedSkillIds);
};

export const hasUnlockedToggle = async (feature: SkillReward & { type: 'toggle' }['feature']): Promise<boolean> => {
  const progress = await getPlayerProgress();
  return progress.earnedRewards.some(reward => reward.type === 'toggle' && reward.feature === feature);
};

export const computeSkillAvailability = async () => {
  const progress = await getPlayerProgress();
  return SKILLS.map(skill => ({
    skill,
    unlocked: progress.unlockedSkillIds.includes(skill.id),
    canUnlock:
      !progress.unlockedSkillIds.includes(skill.id) &&
      (!skill.prerequisites || skill.prerequisites.every(req => progress.unlockedSkillIds.includes(req))) &&
      (progress.branchXp[skill.branch] ?? 0) >= skill.cost
  }));
};

export const unlockAllSkillsForTesting = async (): Promise<PlayerProgress> => {
  const progress = await getPlayerProgress();
  const allSkillIds = SKILLS.map(skill => skill.id);
  const mergedRewards = mergeRewards([...progress.earnedRewards], SKILLS.flatMap(skill => skill.rewards));
  const branchXp = { ...progress.branchXp } as PlayerProgress['branchXp'];
  Object.keys(branchXp).forEach(key => {
    branchXp[key as keyof PlayerProgress['branchXp']] = Math.max(
      branchXp[key as keyof PlayerProgress['branchXp']] ?? 0,
      2500
    );
  });

  const newTotalXp = Math.max(progress.totalXp, 7500);
  const updated: PlayerProgress = {
    ...progress,
    totalXp: newTotalXp,
    branchXp,
    unlockedSkillIds: Array.from(new Set([...progress.unlockedSkillIds, ...allSkillIds])),
    earnedRewards: mergedRewards,
    rankId: getRankForXp(newTotalXp).id,
    updatedAt: Date.now()
  };

  await savePlayerProgress(updated);
  return updated;
};

export const getMissionSummary = async (): Promise<MissionSummary> => {
  const progress = await getPlayerProgress();
  const definitionMap = new Map(MISSION_DEFINITIONS.map(def => [def.id, def]));
  const active = (progress.activeMissions || [])
    .map(mission => {
      const definition = definitionMap.get(mission.missionId);
      return definition ? { mission, definition } : null;
    })
    .filter((entry): entry is { mission: MissionProgress; definition: MissionDefinition } => Boolean(entry));

  const branchXp: Record<SkillBranchId, number> = {
    social_engineering: progress.branchXp.social_engineering ?? 0,
    diplomacy: progress.branchXp.diplomacy ?? 0,
    intelligence: progress.branchXp.intelligence ?? 0,
    brand_authority: progress.branchXp.brand_authority ?? 0,
    operations: progress.branchXp.operations ?? 0,
    creative_lab: progress.branchXp.creative_lab ?? 0
  };

  return { active, branchXp };
};
