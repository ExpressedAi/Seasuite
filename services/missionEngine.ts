import { ExperienceEvent, ExperienceEventType, MissionDefinition, MissionProgress, MissionMetric, MissionUpdate, PlayerProgress, SkillBranchId } from '../types';
import { DAILY_MISSION_COUNT, MISSION_DEFINITIONS } from './missionDefinitions';

const milliseconds = {
  hour: 60 * 60 * 1000
};

const mapExperienceTypeToMetric = (type: ExperienceEventType): MissionMetric | null => {
  switch (type) {
    case 'pressure_diffused':
      return 'pressure_diffused';
    case 'pressure_created':
      return 'pressure_created';
    case 'secret_shared':
      return 'secret_shared';
    case 'brand_update':
      return 'brand_update';
    case 'memory_capture':
      return 'memory_capture';
    case 'client_success':
      return 'client_success';
    case 'dramatic_event':
      return 'drama_event';
    default:
      return null;
  }
};

const getMissionDefinition = (missionId: string): MissionDefinition | undefined =>
  MISSION_DEFINITIONS.find(def => def.id === missionId);

const getAvailableDefinitions = (excludeIds: Set<string>): MissionDefinition[] =>
  MISSION_DEFINITIONS.filter(def => !excludeIds.has(def.id));

const ensureActiveMissions = (progress: PlayerProgress, now: number): PlayerProgress => {
  const active: MissionProgress[] = [];
  const completed = [...progress.completedMissions];

  for (const mission of progress.activeMissions) {
    const def = getMissionDefinition(mission.missionId);
    if (!def) continue;
    if (mission.status !== 'active') {
      completed.push({ ...mission, status: mission.status !== 'completed' ? 'expired' : mission.status });
      continue;
    }
    if (def.expiresInHours) {
      const expiresAt = mission.startedAt + def.expiresInHours * milliseconds.hour;
      if (now >= expiresAt) {
        completed.push({ ...mission, status: 'expired', completedAt: now });
        continue;
      }
    }
    active.push(mission);
  }

  const activeIds = new Set<string>(active.map(m => m.missionId));
  const available = getAvailableDefinitions(activeIds);
  let index = 0;
  while (active.length < DAILY_MISSION_COUNT && index < available.length) {
    const definition = available[index];
    active.push({
      id: `${definition.id}-${now}`,
      missionId: definition.id,
      progress: 0,
      target: definition.target,
      status: 'active',
      startedAt: now,
      branch: definition.branch,
      rewardXp: definition.rewardXp
    });
    index += 1;
  }

  return {
    ...progress,
    activeMissions: active,
    completedMissions: completed.slice(-30),
    missionRefreshAt: now
  };
};

export interface MissionProcessingResult {
  progress: PlayerProgress;
  rewardEvents: ExperienceEvent[];
  missionUpdates: MissionUpdate[];
}

export const processMissions = (progress: PlayerProgress, experienceEvent: ExperienceEvent): MissionProcessingResult => {
  const now = Date.now();
  let updated = ensureActiveMissions(progress, now);
  const metric = mapExperienceTypeToMetric(experienceEvent.type);
  if (!metric) {
    return { progress: updated, rewardEvents: [], missionUpdates: [] };
  }

  const rewardEvents: ExperienceEvent[] = [];
  const missionUpdates: MissionUpdate[] = [];
  const active: MissionProgress[] = [];
  const completed = [...updated.completedMissions];
  let totalRewardXp = 0;

  for (const mission of updated.activeMissions) {
    const def = getMissionDefinition(mission.missionId);
    if (!def) continue;

    if (mission.status !== 'active') {
      completed.push(mission);
      continue;
    }

    if (def.metric !== metric) {
      active.push(mission);
      continue;
    }

    const newProgressValue = Math.min(mission.target, mission.progress + 1);
    if (newProgressValue >= mission.target) {
      const rewardXp = def.rewardXp;
      totalRewardXp += rewardXp;
      rewardEvents.push({
        id: `mission-${mission.missionId}-${now}`,
        branch: def.branch,
        type: 'mission_reward',
        xp: rewardXp,
        actorIds: experienceEvent.actorIds,
        context: 'system',
        metadata: { missionId: mission.missionId, title: def.title },
        timestamp: now
      });
      missionUpdates.push({
        missionId: mission.missionId,
        branch: def.branch,
        progress: newProgressValue,
        target: mission.target,
        completed: true,
        rewardXp,
        title: def.title
      });
      completed.push({
        ...mission,
        progress: newProgressValue,
        status: 'completed',
        completedAt: now
      });
    } else {
      missionUpdates.push({
        missionId: mission.missionId,
        branch: def.branch,
        progress: newProgressValue,
        target: mission.target,
        completed: false,
        rewardXp: def.rewardXp,
        title: def.title
      });
      active.push({
        ...mission,
        progress: newProgressValue
      });
    }
  }

  updated = {
    ...updated,
    activeMissions: active,
    completedMissions: completed.slice(-30)
  };

  if (totalRewardXp > 0) {
    rewardEvents.forEach(event => {
      const branch = event.branch as SkillBranchId;
      updated = {
        ...updated,
        totalXp: updated.totalXp + event.xp,
        branchXp: {
          ...updated.branchXp,
          [branch]: (updated.branchXp[branch] ?? 0) + event.xp
        }
      };
    });
  }

  updated = ensureActiveMissions(updated, now);

  return { progress: updated, rewardEvents, missionUpdates };
};
