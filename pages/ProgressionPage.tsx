import React, { useEffect, useMemo, useState } from 'react';
import { PlayerProgress, SkillDefinition, ExperienceEvent } from '../types';
import { getPlayerProgress, getRecentExperienceEvents } from '../services/db';
import { computeSkillAvailability, unlockSkill, unlockAllSkillsForTesting } from '../services/progressionEngine';
import { SKILL_BRANCHES, RANKS } from '../services/skills';
import { MISSION_DEFINITIONS } from '../services/missionDefinitions';
import { formatDistanceToNow } from 'date-fns';

interface SkillAvailability {
  skill: SkillDefinition;
  unlocked: boolean;
  canUnlock: boolean;
}

const ProgressionPage: React.FC = () => {
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [skillAvailability, setSkillAvailability] = useState<SkillAvailability[]>([]);
  const [events, setEvents] = useState<ExperienceEvent[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<string | null>(null);

  const loadProgress = async () => {
    try {
      const latestProgress = await getPlayerProgress();
      setProgress(latestProgress);
      const availability = await computeSkillAvailability();
      setSkillAvailability(availability);
    } catch (error) {
      console.error('Failed to load progression:', error);
      setStatusMessage('Unable to load progression data.');
    }
  };

  const loadEvents = async () => {
    try {
      const recent = await getRecentExperienceEvents(40);
      setEvents(recent);
    } catch (error) {
      console.error('Failed to load experience events:', error);
    }
  };

  useEffect(() => {
    loadProgress();
    loadEvents();
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const rank = useMemo(() => {
    if (!progress) return RANKS[0];
    const ordered = [...RANKS].sort((a, b) => b.minTotalXp - a.minTotalXp);
    return ordered.find(def => progress.totalXp >= def.minTotalXp) || RANKS[0];
  }, [progress]);

  const branchSkills = useMemo(() => {
    const grouped: Record<string, SkillAvailability[]> = {};
    skillAvailability.forEach(entry => {
      if (!grouped[entry.skill.branch]) {
        grouped[entry.skill.branch] = [];
      }
      grouped[entry.skill.branch].push(entry);
    });
    Object.values(grouped).forEach(list => list.sort((a, b) => a.skill.tier - b.skill.tier));
    return grouped;
  }, [skillAvailability]);

  const missionDefinitionMap = useMemo(() => new Map(MISSION_DEFINITIONS.map(def => [def.id, def])), []);
  const activeMissions = progress?.activeMissions ?? [];
  const recentCompletedMissions = (progress?.completedMissions ?? []).filter(mission => mission.status === 'completed').slice(-5).reverse();

  const handleUnlockSkill = async (skillId: string) => {
    setIsUnlocking(skillId);
    try {
      const result = await unlockSkill(skillId);
      if (!result.unlocked) {
        setStatusMessage(result.reason || 'Unable to unlock skill.');
      } else {
        setStatusMessage('Skill unlocked!');
        setProgress(result.progress);
      }
      const availability = await computeSkillAvailability();
      setSkillAvailability(availability);
    } catch (error) {
      console.error('Failed to unlock skill:', error);
      setStatusMessage('Unlock failed');
    } finally {
      setIsUnlocking(null);
    }
  };

  const handleUnlockAll = async () => {
    setIsUnlocking('all');
    try {
      const updated = await unlockAllSkillsForTesting();
      setProgress(updated);
      const availability = await computeSkillAvailability();
      setSkillAvailability(availability);
      setStatusMessage('All skills unlocked for testing.');
      await loadEvents();
    } catch (error) {
      console.error('Failed to unlock all skills:', error);
      setStatusMessage('Could not unlock all skills.');
    } finally {
      setIsUnlocking(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#26282B] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Skill Tree</h1>
            <p className="text-sm text-gray-400">Earn XP through social mastery, brand wins, and covert moves to unlock deeper systems.</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-[#1B1C1F] px-4 py-3 text-sm">
            <div className="text-xs uppercase tracking-widest text-gray-500">Current Rank</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold" style={{ color: rank.badgeColor }}>{rank.title}</span>
              <span className="text-xs text-gray-500">{progress?.totalXp ?? 0} XP</span>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleUnlockAll}
            disabled={isUnlocking === 'all'}
            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUnlocking === 'all' ? 'Unlocking…' : 'Unlock Everything (Test Mode)'}
          </button>
          <button
            onClick={() => {
              loadProgress();
              loadEvents();
            }}
            className="rounded-lg border border-gray-700 bg-[#1B1C1F] px-3 py-2 text-sm text-gray-300 hover:border-blue-500 hover:text-white"
          >
            Refresh Stats
          </button>
        </div>

        {statusMessage && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
            {statusMessage}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {progress && (
            Object.entries(progress.branchXp).map(([branchId, xp]) => {
              const branch = SKILL_BRANCHES[branchId as keyof typeof SKILL_BRANCHES];
              const completion = Math.min(100, Math.round((xp / 1200) * 100));
              return (
                <div key={branchId} className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-4">
                  <div className="text-xs uppercase tracking-widest text-gray-500">{branch.title}</div>
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-200">
                    <span>{xp} XP</span>
                    <span>{completion}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
                    <div className={`h-2 rounded-full bg-gradient-to-r ${branch.color}`} style={{ width: `${completion}%` }} />
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">{branch.summary}</p>
                </div>
              );
            })
          )}
        </section>

        <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
          <h2 className="text-lg font-semibold text-blue-300">Branches</h2>
          <p className="text-xs text-gray-500">Select a branch below to unlock perks. Costs are in branch-specific XP.</p>
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Object.entries(SKILL_BRANCHES).map(([branchId, meta]) => (
                <div key={branchId} className="rounded-lg border border-gray-800 bg-[#111315] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-100">{meta.title}</h3>
                  <span className="text-xs text-gray-500">{progress ? progress.branchXp[branchId as keyof PlayerProgress['branchXp']] : 0} XP</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{meta.summary}</p>
                <div className="mt-4 space-y-3">
                  {(branchSkills[branchId] || []).map(entry => {
                    const { skill, unlocked, canUnlock } = entry;
                    return (
                      <div key={skill.id} className={`rounded-md border px-3 py-3 ${unlocked ? 'border-emerald-500/40 bg-emerald-500/10' : canUnlock ? 'border-blue-500/30 bg-blue-500/5' : 'border-gray-700 bg-[#16181d]'}`}>
                        <div className="flex items-center justify-between text-sm text-gray-100">
                          <span className="font-semibold">{skill.title}</span>
                          <span className="text-xs text-gray-400">Tier {skill.tier} • Cost {skill.cost}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400 leading-relaxed">{skill.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500">
                          {skill.rewards.map(reward => (
                            <span key={JSON.stringify(reward)} className="rounded-full border border-gray-700 px-2 py-0.5">
                              {reward.type === 'toggle' && `Unlocks ${reward.feature}`}
                              {reward.type === 'panel' && `Unlocks ${reward.panelId}`}
                              {reward.type === 'stat' && `XP Boost ${Math.round((reward.value - 1) * 100)}%`}
                              {reward.type === 'perk' && `Perk: ${reward.id}`}
                            </span>
                          ))}
                        </div>
                        {!unlocked && (
                          <button
                            onClick={() => handleUnlockSkill(skill.id)}
                            disabled={!canUnlock || isUnlocking === skill.id}
                            className={`mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                              canUnlock
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isUnlocking === skill.id ? 'Unlocking…' : canUnlock ? 'Unlock Skill' : 'Locked'}
                          </button>
                        )}
                        {unlocked && (
                          <div className="mt-3 text-xs text-emerald-300">Unlocked</div>
                        )}
                      </div>
                    );
                  })}
                  {!(branchSkills[branchId] || []).length && (
                    <div className="rounded-md border border-gray-700 bg-[#16181d] px-3 py-3 text-xs text-gray-500">No skills defined yet for this branch.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-blue-300">Active Missions</h2>
              <p className="text-xs text-gray-500">Complete missions to earn bonus XP and unlock fresh objectives.</p>
            </div>
            <span className="rounded-full border border-gray-700 bg-[#16181d] px-3 py-1 text-xs text-gray-400">
              {activeMissions.length} active
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeMissions.length === 0 && (
              <div className="rounded-lg border border-gray-800 bg-[#111315] p-4 text-sm text-gray-500">
                Missions will appear here as you progress.
              </div>
            )}
            {activeMissions.map(mission => {
              const definition = missionDefinitionMap.get(mission.missionId);
              if (!definition) return null;
              const completion = Math.min(100, Math.round((mission.progress / mission.target) * 100));
              return (
                <div key={mission.id} className="rounded-lg border border-gray-800 bg-[#111315] p-4">
                  <div className="flex items-center justify-between text-sm text-gray-100">
                    <span className="font-semibold">{definition.title}</span>
                    <span className="text-xs text-gray-500">{mission.progress}/{mission.target}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{definition.description}</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-800">
                    <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${completion}%` }} />
                  </div>
                  <div className="mt-2 text-[11px] text-blue-200">Reward: {definition.rewardXp} XP · {SKILL_BRANCHES[definition.branch].title}</div>
                  {definition.expiresInHours && (
                    <div className="text-[11px] text-gray-500">Expires in {definition.expiresInHours}h</div>
                  )}
                </div>
              );
            })}
          </div>

          {recentCompletedMissions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-200">Recent Completions</h3>
              <ul className="mt-2 space-y-2 text-xs text-gray-400">
                {recentCompletedMissions.map(mission => {
                  const definition = missionDefinitionMap.get(mission.missionId);
                  if (!definition) return null;
                  return (
                    <li key={mission.id} className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">
                      <span>{definition.title}</span>
                      <span>+{definition.rewardXp} XP</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
          <h2 className="text-lg font-semibold text-blue-300">Recent Experience</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No XP logged yet. Jump into the sim to earn some.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm text-gray-200">
              {events.map(event => (
                <li key={event.id} className="rounded-md border border-gray-800 bg-[#111315] p-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="uppercase tracking-wider">{event.type.replace(/_/g, ' ')}</span>
                    <span>{formatDistanceToNow(event.timestamp, { addSuffix: true })}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-200">+{event.xp} XP</div>
                  <div className="mt-1 text-[11px] text-gray-500">Branch: {SKILL_BRANCHES[event.branch].title}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProgressionPage;
