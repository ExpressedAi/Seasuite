import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  getAllPerformers,
  getPerformerInteractions,
  getInteractionSummaries,
  getAllSecrets,
  getDramaEvents,
  getActiveCoordinationPlans,
  revealSecret,
  getPlayerProgress,
  getFollowUps,
  updateFollowUp,
  getAllRelationships
} from '../services/db';
import {
  PerformerProfile,
  PerformerInteractionEvent,
  PerformerInteractionSummary,
  PerformerSecret,
  DramaEvent,
  CoordinationPlan,
  PlayerProgress,
  SkillDefinition,
  MissionDefinition,
  MissionProgress,
  SkillBranchId,
  IntelligenceFollowUp,
  FollowUpStatus,
  PerformerRelationship
} from '../types';
import { generateSocialSignals, SocialSignal } from '../services/socialSignals';
import { TRAIT_DEFINITIONS, withDefaultTraits } from '../services/socialModel';
import { computeSkillAvailability } from '../services/progressionEngine';
import { SKILL_BRANCHES } from '../services/skills';
import { MISSION_DEFINITIONS } from '../services/missionDefinitions';
import { getIntelligenceLog, IntelligenceRecord } from '../services/intelligenceLog';
import RelationshipGraph from '../components/RelationshipGraph';
import RomanceTimeline from '../components/RomanceTimeline';
import DramaIntensityTimeline from '../components/DramaIntensityTimeline';

const MAX_SIGNAL_FEED = 12;
const TEAM_FOCUS_BRANCHES: SkillBranchId[] = ['social_engineering', 'diplomacy', 'intelligence'];

interface SkillAvailability {
  skill: SkillDefinition;
  unlocked: boolean;
  canUnlock: boolean;
}

const TeamInteractionsPage: React.FC = () => {
  const [performers, setPerformers] = useState<PerformerProfile[]>([]);
  const [interactions, setInteractions] = useState<PerformerInteractionEvent[]>([]);
  const [summaries, setSummaries] = useState<PerformerInteractionSummary[]>([]);
  const [secrets, setSecrets] = useState<PerformerSecret[]>([]);
  const [dramaEvents, setDramaEvents] = useState<DramaEvent[]>([]);
  const [plans, setPlans] = useState<CoordinationPlan[]>([]);
  const [relationships, setRelationships] = useState<PerformerRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPerformer, setSelectedPerformer] = useState<'all' | string>('all');
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress | null>(null);
  const [skillAvailability, setSkillAvailability] = useState<SkillAvailability[]>([]);
  const [intelligenceRecords, setIntelligenceRecords] = useState<IntelligenceRecord[]>([]);
  const [followUps, setFollowUps] = useState<IntelligenceFollowUp[]>([]);

  useEffect(() => {
    loadData();
  }, []);

useEffect(() => {
  const handleIntelUpdate = () => setIntelligenceRecords(getIntelligenceLog());
  const handleFollowUpsUpdate = () => {
    getFollowUps()
      .then(tasks =>
        setFollowUps(() => tasks)
      )
      .catch(error => console.error('Failed to refresh follow-ups:', error));
  };
  window.addEventListener('intelligence-log-updated', handleIntelUpdate);
  window.addEventListener('intelligence-record-processed', handleIntelUpdate);
  window.addEventListener('follow-ups-updated', handleFollowUpsUpdate);
  return () => {
    window.removeEventListener('intelligence-log-updated', handleIntelUpdate);
    window.removeEventListener('intelligence-record-processed', handleIntelUpdate);
    window.removeEventListener('follow-ups-updated', handleFollowUpsUpdate);
  };
}, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [team, events, summaryList, secretList, dramaList, planList, relationshipList, progressData, availability, followUpTasks] = await Promise.all([
        getAllPerformers(),
        getPerformerInteractions(),
        getInteractionSummaries(),
        getAllSecrets(),
        getDramaEvents(75),
        getActiveCoordinationPlans(),
        getAllRelationships(),
        getPlayerProgress(),
        computeSkillAvailability(),
        getFollowUps()
      ]);
      setPerformers(team);
      setInteractions(events);
      setSummaries(summaryList);
      setSecrets(secretList);
      setDramaEvents(dramaList);
      setPlans(planList);
      setRelationships(relationshipList);
      setPlayerProgress(progressData);
      setSkillAvailability(availability);
      setIntelligenceRecords(getIntelligenceLog());
      setFollowUps(followUpTasks);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFollowUpStatus = async (id: string, status: FollowUpStatus) => {
    try {
      await updateFollowUp(id, { status });
      setFollowUps(prev =>
        prev.map(task => (task.id === id ? { ...task, status, updatedAt: Date.now() } : task))
      );
    } catch (error) {
      console.error('Failed to update follow-up status:', error);
    }
  };

  const performerMap = useMemo(() => new Map(performers.map(p => [p.id, p])), [performers]);
  const missionDefinitionMap = useMemo(() => new Map(MISSION_DEFINITIONS.map(mission => [mission.id, mission])), []);
  const branchXp = useMemo<Record<SkillBranchId, number>>(() => {
    const defaults: Record<SkillBranchId, number> = {
      social_engineering: 0,
      diplomacy: 0,
      intelligence: 0,
      brand_authority: 0,
      operations: 0,
      creative_lab: 0
    };
    if (!playerProgress) return defaults;
    return { ...defaults, ...playerProgress.branchXp };
  }, [playerProgress]);
  const nextSkillsByBranch = useMemo(() => {
    const result = new Map<SkillBranchId, { skill: SkillDefinition; xpNeeded: number; ready: boolean }>();
    const ordered = [...skillAvailability]
      .filter(entry => TEAM_FOCUS_BRANCHES.includes(entry.skill.branch))
      .filter(entry => !entry.unlocked)
      .sort((a, b) => a.skill.tier - b.skill.tier || a.skill.cost - b.skill.cost);

    ordered.forEach(entry => {
      if (result.has(entry.skill.branch)) return;
      const xp = branchXp[entry.skill.branch] ?? 0;
      result.set(entry.skill.branch, {
        skill: entry.skill,
        xpNeeded: Math.max(0, entry.skill.cost - xp),
        ready: entry.canUnlock
      });
    });
    return result;
  }, [branchXp, skillAvailability]);
  const focusMissions = useMemo(() => {
    if (!playerProgress) return [] as Array<{ mission: MissionProgress; definition: MissionDefinition }>;
    return (playerProgress.activeMissions || [])
      .map(mission => {
        const definition = missionDefinitionMap.get(mission.missionId);
        return definition ? { mission, definition } : null;
      })
      .filter((item): item is { mission: MissionProgress; definition: MissionDefinition } => Boolean(item && TEAM_FOCUS_BRANCHES.includes(item.definition.branch)))
      .slice(0, 3);
  }, [playerProgress, missionDefinitionMap]);
  const intelligenceHighlights = useMemo(() => intelligenceRecords.slice(-8).reverse(), [intelligenceRecords]);
  const followUpPipeline = useMemo(() => {
    const pending = followUps.filter(task => task.status === 'pending');
    const inProgress = followUps.filter(task => task.status === 'in_progress');
    const completed = followUps.filter(task => task.status === 'completed');

    const sortByDue = (tasks: IntelligenceFollowUp[]) =>
      [...tasks].sort((a, b) => {
        const dueA = a.dueAt ?? Infinity;
        const dueB = b.dueAt ?? Infinity;
        return dueA - dueB;
      });

    return {
      pending: sortByDue(pending),
      inProgress: sortByDue(inProgress),
      completed: [...completed].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
      next: sortByDue([...pending, ...inProgress]).slice(0, 4)
    };
  }, [followUps]);

  const socialSignals = useMemo<SocialSignal[]>(() => {
    if (!performerMap.size) return [];
    const generated = interactions.flatMap(event => generateSocialSignals(event, performerMap));
    const dedup = new Map<string, SocialSignal>();
    generated.forEach(signal => {
      dedup.set(signal.id, signal);
    });
    return Array.from(dedup.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [interactions, performerMap]);

  const filteredSignals = useMemo(() => {
    if (selectedPerformer === 'all') return socialSignals;
    return socialSignals.filter(signal => signal.actorIds.includes(selectedPerformer));
  }, [selectedPerformer, socialSignals]);

  const filteredSummaries = useMemo(() => {
    if (selectedPerformer === 'all') return summaries;
    return summaries.filter(summary => summary.participants.includes(selectedPerformer));
  }, [summaries, selectedPerformer]);

  const filteredSecrets = useMemo(() => {
    if (selectedPerformer === 'all') return secrets;
    return secrets.filter(secret => secret.performerId === selectedPerformer);
  }, [secrets, selectedPerformer]);

  const filteredPlans = useMemo(() => {
    if (selectedPerformer === 'all') return plans;
    return plans.filter(plan => plan.participants.includes(selectedPerformer) || plan.initiatorId === selectedPerformer);
  }, [plans, selectedPerformer]);

  const filteredDrama = useMemo(() => {
    if (selectedPerformer === 'all') return dramaEvents;
    return dramaEvents.filter(event => event.participants.includes(selectedPerformer));
  }, [dramaEvents, selectedPerformer]);

  const pressureSignals = filteredSignals.filter(signal => signal.kind === 'pressure');
  const celebrationSignals = filteredSignals.filter(signal => signal.kind === 'celebration');
  const secretSignals = filteredSignals.filter(signal => signal.kind === 'secret');

  const totalInteractions = filteredSummaries.reduce((acc, summary) => acc + summary.totalInteractions, 0);
  const aggregateSentiment = filteredSummaries.reduce((acc, summary) => acc + summary.sentimentSum, 0);
  const averageSentiment = totalInteractions ? aggregateSentiment / totalInteractions : 0;
  const pressureMagnitude = pressureSignals.reduce((acc, signal) => acc + signal.severity, 0);
  const celebrationMagnitude = celebrationSignals.reduce((acc, signal) => acc + signal.severity, 0);

  const getPerformerName = (id: string) => {
    if (id === 'user') return 'You';
    if (id === 'sylvia') return 'Seasuite';
    return performerMap.get(id)?.name || 'Unknown';
  };

  const handleRevealSecret = async (secretId: string, revealTo: string) => {
    await revealSecret(secretId, revealTo);
    await loadData();
  };

  const displaySignals = filteredSignals.slice(0, MAX_SIGNAL_FEED);
  const highlightSummaries = [...filteredSummaries].sort((a, b) => (b.pressureScore ?? 0) - (a.pressureScore ?? 0)).slice(0, 6);

  const traitPerformers = selectedPerformer === 'all'
    ? performers
    : performers.filter(p => p.id === selectedPerformer);
  const highVolatilityPerformers = useMemo(() => {
    return performers
      .map(performer => ({ performer, traits: withDefaultTraits(performer.traits) }))
      .filter(entry => entry.traits.volatility >= 60)
      .sort((a, b) => b.traits.volatility - a.traits.volatility)
      .slice(0, 4);
  }, [performers]);
  const highCunningPerformers = useMemo(() => {
    return performers
      .map(performer => ({ performer, traits: withDefaultTraits(performer.traits) }))
      .filter(entry => entry.traits.cunning >= 60)
      .sort((a, b) => b.traits.cunning - a.traits.cunning)
      .slice(0, 4);
  }, [performers]);

  return (
    <div className="h-full overflow-y-auto bg-[#26282B] text-white" style={{ scrollbarWidth: 'thin' }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:gap-6 px-3 md:px-6 py-4 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Social Operations</h1>
            <p className="text-sm text-gray-400">Live pulse of relationships, pressure, and covert plays across the boardroom.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPerformer}
              onChange={e => setSelectedPerformer(e.target.value as 'all' | string)}
              className="rounded-lg border border-gray-700 bg-[#1e1f20] px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All performers</option>
              {performers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={loadData}
              className="rounded-lg border border-gray-700 bg-[#1e1f20] px-3 py-2 text-sm text-gray-300 hover:border-blue-500 hover:text-white"
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-red-200">Social Pressure</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-red-100">{pressureSignals.length}</span>
              <span className="text-xs text-red-300">alerts</span>
            </div>
            <div className="mt-2 text-[11px] text-red-200/80">Aggregate intensity {(pressureMagnitude).toFixed(1)} · keep an eye on tone before it combusts.</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-emerald-200">Momentum</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-emerald-100">{celebrationSignals.length}</span>
              <span className="text-xs text-emerald-300">surges</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-200/80">Positive energy {(celebrationMagnitude).toFixed(1)} · celebrate alliance-building moments.</div>
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-purple-200">Covert Ops</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-purple-100">{secretSignals.length}</span>
              <span className="text-xs text-purple-300">whispers</span>
            </div>
            <div className="mt-2 text-[11px] text-purple-200/80">Private maneuvers and deception cues driving intrigue.</div>
          </div>
        </section>

        {/* Relationship Graph */}
        {performers.length > 0 && relationships.length > 0 && (
          <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-blue-300">Relationship Network</h2>
                <p className="text-xs text-gray-500">Visual map of connections, tensions, and romances.</p>
              </div>
              <button
                onClick={() => setSelectedPerformer(selectedPerformer === 'all' ? performers[0]?.id || 'all' : 'all')}
                className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 transition-all duration-200"
              >
                {selectedPerformer === 'all' ? 'Focus View' : 'Show All'}
              </button>
            </div>
            <RelationshipGraph
              performers={performers}
              relationships={relationships}
              selectedPerformerId={selectedPerformer === 'all' ? null : selectedPerformer}
              onSelectPerformer={(id) => setSelectedPerformer(id)}
            />
          </section>
        )}

        {/* Romance Timeline */}
        {relationships.some(r => r.type === 'romantic') && (
          <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
            <RomanceTimeline
              relationships={relationships}
              dramaEvents={dramaEvents}
              performers={performers}
            />
          </section>
        )}

        {playerProgress && (
          <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-blue-300">Skill Signals</h2>
                <p className="text-xs text-gray-500">Branch XP and upcoming unlocks tied to team dynamics.</p>
              </div>
              <Link
                to="/progress"
                className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20"
              >
                Open Skill Tree
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-3">
              {TEAM_FOCUS_BRANCHES.map(branch => {
                const branchMeta = SKILL_BRANCHES[branch];
                const xp = branchXp[branch] ?? 0;
                const next = nextSkillsByBranch.get(branch);
                return (
                  <div key={branch} className="rounded-lg border border-gray-800 bg-[#111315] p-4">
                    <div className="flex items-center justify-between text-sm text-gray-200">
                      <span className="font-semibold">{branchMeta.title}</span>
                      <span className="text-xs text-gray-500">{xp} XP</span>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">{branchMeta.summary}</p>
                    {next ? (
                      <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-200">
                        <div className="font-semibold text-blue-100">Next: {next.skill.title}</div>
                        <div className="mt-1 text-[11px] text-blue-200/80">{next.skill.description}</div>
                        <div className="mt-2 text-[11px]">
                          {next.ready
                            ? 'Ready to unlock in Skill Tree.'
                            : `Need ${next.xpNeeded} more XP in this branch.`}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-[11px] text-gray-500">All skills unlocked for this branch.</div>
                    )}
                  </div>
                );
              })}
            </div>

            {focusMissions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-200">Current Missions</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {focusMissions.map(({ mission, definition }) => {
                    if (!definition) return null;
                    const completion = Math.min(100, Math.round((mission.progress / mission.target) * 100));
                    return (
                      <div key={mission.id} className="rounded-lg border border-gray-800 bg-[#111315] p-4 text-sm text-gray-200">
                        <div className="font-semibold text-blue-200">{definition.title}</div>
                        <p className="mt-1 text-[11px] text-gray-500">{definition.description}</p>
                        <div className="mt-2 h-2 w-full rounded-full bg-gray-800">
                          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${completion}%` }} />
                        </div>
                        <div className="mt-2 text-[11px] text-blue-200/80">{mission.progress}/{mission.target} · +{definition.rewardXp} XP</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-amber-300">Follow-Up Queue</h2>
              <p className="text-xs text-gray-500">Auto-generated tasks from the intelligence stream.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-500">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                Pending {followUpPipeline.pending.length}
              </span>
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-200">
                In Progress {followUpPipeline.inProgress.length}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                Completed {followUpPipeline.completed.length}
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-800 bg-[#111315] p-4">
              <h3 className="text-sm font-semibold text-amber-200">Next Actions</h3>
              <p className="text-[11px] text-gray-500">Top priority follow-ups ordered by due time.</p>
              <div className="mt-3 space-y-3">
                {followUpPipeline.next.length === 0 && (
                  <p className="text-xs text-gray-500">No pending actions. Keep pushing intel to spawn new tasks.</p>
                )}
                {followUpPipeline.next.map(task => (
                  <div key={task.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wider">{task.category}</span>
                      <span className="text-[11px] text-amber-200/80">
                        {task.dueAt ? formatDistanceToNow(task.dueAt, { addSuffix: true }) : 'No due date'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-amber-50">{task.title}</div>
                    {task.description && (
                      <p className="mt-1 text-xs text-amber-100/80 whitespace-pre-line">{task.description}</p>
                    )}
                    {task.actionHint && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-[11px] text-amber-100">
                        <span>{task.actionHint.description || task.actionHint.label}</span>
                        {task.actionHint.path && (
                          <Link
                            to={task.actionHint.path}
                            className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-blue-200 hover:bg-blue-500/20"
                          >
                            Open
                          </Link>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      {task.status !== 'in_progress' && (
                        <button
                          onClick={() => handleUpdateFollowUpStatus(task.id, 'in_progress')}
                          className="rounded-md border border-blue-400/40 bg-blue-400/10 px-2 py-1 text-blue-100 hover:bg-blue-400/20"
                        >
                          Set In Progress
                        </button>
                      )}
                      {task.status !== 'completed' && (
                        <button
                          onClick={() => handleUpdateFollowUpStatus(task.id, 'completed')}
                          className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-100 hover:bg-emerald-400/20"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-[#111315] p-4">
              <h3 className="text-sm font-semibold text-blue-200">Pipeline Status</h3>
              <p className="text-[11px] text-gray-500">Track what intelligence has already been actioned.</p>
              <div className="mt-3 space-y-3 text-sm text-gray-200">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-300">In Progress</div>
                  {followUpPipeline.inProgress.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-500">No tasks are actively being worked.</p>
                  ) : (
                    <ul className="mt-1 space-y-2 text-xs text-blue-200">
                      {followUpPipeline.inProgress.map(task => (
                        <li key={task.id} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span>{task.title}</span>
                            <button
                              onClick={() => handleUpdateFollowUpStatus(task.id, 'completed')}
                              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
                            >
                              Complete
                            </button>
                          </div>
                          {task.actionHint && (
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-blue-100/80">
                              <span>{task.actionHint.description || task.actionHint.label}</span>
                              {task.actionHint.path && (
                                <Link
                                  to={task.actionHint.path}
                                  className="rounded-md border border-blue-300/40 bg-blue-300/10 px-2 py-0.5 text-blue-100 hover:bg-blue-300/20"
                                >
                                  Open
                                </Link>
                              )}
                            </div>
                          )}
                          <div className="mt-1 text-[11px] text-blue-200/70">
                            {task.dueAt ? formatDistanceToNow(task.dueAt, { addSuffix: true }) : 'No due date'}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Recently Completed</div>
                  {followUpPipeline.completed.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-500">Nothing completed yet.</p>
                  ) : (
                    <ul className="mt-1 space-y-2 text-xs text-emerald-200">
                      {followUpPipeline.completed.slice(0, 4).map(task => (
                        <li key={task.id} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span>{task.title}</span>
                            <button
                              onClick={() => handleUpdateFollowUpStatus(task.id, 'pending')}
                              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20"
                            >
                              Reopen
                            </button>
                          </div>
                          {task.actionHint && (
                            <div className="mt-1 text-[11px] text-emerald-200/80">{task.actionHint.description || task.actionHint.label}</div>
                          )}
                          <div className="mt-1 text-[11px] text-emerald-200/70">
                            Closed {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-purple-300">Intelligence Feed</h2>
              <p className="text-xs text-gray-500">Live capture of brand, client, mission, and social signals.</p>
            </div>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
              {intelligenceRecords.length} total
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {intelligenceHighlights.length === 0 && (
              <div className="rounded-lg border border-gray-800 bg-[#111315] p-4 text-xs text-gray-500">
                No intelligence has been processed yet. Run conversations or updates to populate this feed.
              </div>
            )}
            {intelligenceHighlights.map(record => (
              <div key={record.id} className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4 text-sm text-gray-200">
                <div className="flex items-center justify-between text-xs text-purple-200/80">
                  <span className="uppercase tracking-wider">{(record.category || 'social').replace('_', ' ')}</span>
                  <span>{formatDistanceToNow(record.timestamp, { addSuffix: true })}</span>
                </div>
                <div className="mt-2 text-sm text-gray-100">{record.summary || 'Signal captured'}</div>
                {record.derivedMissionProgress && record.derivedMissionProgress.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-blue-200">
                    {record.derivedMissionProgress.map(update => (
                      <li key={`${record.id}-${update.missionId}`}>
                        Mission {update.title || update.missionId}: {update.progress}{update.completed ? ' (completed)' : ''}{update.rewardXp ? ` · +${update.rewardXp} XP` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-blue-300">Live Social Feed</h2>
              <span className="text-xs text-gray-500">{displaySignals.length} of {filteredSignals.length}</span>
            </div>
            {displaySignals.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No notable signals yet. Keep the conversation flowing.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {displaySignals.map(signal => (
                  <li key={signal.id} className="rounded-lg border border-gray-800 bg-[#111315] p-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-gray-500">
                      <span>{signal.kind === 'pressure' ? 'Pressure Spike' : signal.kind === 'celebration' ? 'Momentum Boost' : 'Secret Exchange'}</span>
                      <span>{formatDistanceToNow(signal.timestamp, { addSuffix: true })}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-200 leading-relaxed">{signal.message}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <div>Severity {(signal.severity * 100).toFixed(0)}%</div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        {signal.participants.join(' • ')}
                        <span className="text-gray-600">({signal.context === 'private' ? 'Private' : 'Public'})</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
              <h2 className="text-lg font-semibold text-blue-300">Relationship Pulse</h2>
              <p className="text-xs text-gray-500">Average sentiment {(averageSentiment * 100).toFixed(0)}%</p>
              <div className="mt-4 space-y-3">
                {highlightSummaries.length === 0 ? (
                  <p className="text-sm text-gray-500">No recorded interactions yet.</p>
                ) : (
                  highlightSummaries.map(summary => {
                    const sentiment = summary.totalInteractions ? summary.sentimentSum / summary.totalInteractions : 0;
                    const pressure = summary.pressureScore ?? 0;
                    const label = summary.participants.map(getPerformerName).join(' • ');
                    return (
                      <div key={summary.pairKey} className="rounded-lg border border-gray-800 bg-[#111315] p-3">
                        <div className="flex items-center justify-between text-sm text-gray-200">
                          <span className="font-medium">{label}</span>
                          <span className="text-xs text-gray-500">{summary.totalInteractions} interactions</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                          <div>
                            <span className="text-gray-500">Sentiment</span>
                            <div className={sentiment >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                              {(sentiment * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Pressure</span>
                            <div className="text-red-200">{pressure.toFixed(1)}</div>
                          </div>
                        </div>
                        {summary.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                            {summary.tags.slice(0, 6).map(tag => (
                              <span key={tag} className="rounded-full border border-gray-700 px-2 py-0.5">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
              <h2 className="text-lg font-semibold text-blue-300">Active Coordination</h2>
              {filteredPlans.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No active playbooks right now.</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm text-gray-200">
                  {filteredPlans.map(plan => (
                    <li key={plan.id} className="rounded-lg border border-gray-800 bg-[#111315] p-3">
                      <div className="text-xs uppercase tracking-wider text-gray-500">Initiator: {getPerformerName(plan.initiatorId)}</div>
                      <div className="mt-1 font-medium">{plan.goal}</div>
                      <div className="mt-2 text-[11px] text-gray-500">Team: {plan.participants.map(getPerformerName).join(', ')}</div>
                      <div className="mt-1 text-[11px] text-gray-500">Status: {plan.status.toUpperCase()} {plan.secret ? '• Confidential' : ''}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
              <h2 className="text-lg font-semibold text-blue-300">Persona Watchlist</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-200">
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-red-200">
                    <span>High Volatility</span>
                    <span>{highVolatilityPerformers.length}</span>
                  </div>
                  {highVolatilityPerformers.length === 0 ? (
                    <p className="mt-2 text-[11px] text-red-200/80">No volatile performers flagged.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-[11px] text-red-100">
                      {highVolatilityPerformers.map(entry => (
                        <li key={entry.performer.id} className="flex items-center justify-between">
                          <span>{entry.performer.name}</span>
                          <span>{entry.traits.volatility}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-purple-200">
                    <span>Shadow Operators</span>
                    <span>{highCunningPerformers.length}</span>
                  </div>
                  {highCunningPerformers.length === 0 ? (
                    <p className="mt-2 text-[11px] text-purple-200/80">No covert specialists detected.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-[11px] text-purple-100">
                      {highCunningPerformers.map(entry => (
                        <li key={entry.performer.id} className="flex items-center justify-between">
                          <span>{entry.performer.name}</span>
                          <span>{entry.traits.cunning}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
            <h2 className="text-lg font-semibold text-blue-300">Secret Ledger</h2>
            {filteredSecrets.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No secrets logged for this view.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm text-gray-200">
                {filteredSecrets.map(secret => {
                  const holder = getPerformerName(secret.performerId);
                  const unrevealed = performers.filter(p => p.id !== secret.performerId && !secret.knownBy.includes(p.id));
                  return (
                    <li key={secret.id} className="rounded-lg border border-gray-800 bg-[#111315] p-3">
                      <div className="text-xs uppercase tracking-wider text-gray-500">{secret.type.toUpperCase()} • Held by {holder}</div>
                      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{secret.content}</p>
                      <div className="mt-3 text-[11px] text-gray-500">Known by: {secret.knownBy.length ? secret.knownBy.map(getPerformerName).join(', ') : 'Nobody yet'}</div>
                      {unrevealed.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                          {unrevealed.map(option => (
                            <button
                              key={option.id}
                              onClick={() => handleRevealSecret(secret.id, option.id)}
                              className="rounded-full border border-purple-500/40 px-2 py-1 text-purple-200 hover:bg-purple-500/10"
                            >
                              Reveal to {option.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
            <h2 className="text-lg font-semibold text-blue-300">Drama Timeline</h2>
            {filteredDrama.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No drama cues logged yet.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm text-gray-200">
                {filteredDrama.slice(0, 8).map(event => (
                  <li key={event.id} className="rounded-lg border border-gray-800 bg-[#111315] p-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-gray-500">
                      <span>{event.type.toUpperCase()}</span>
                      <span>{formatDistanceToNow(event.timestamp, { addSuffix: true })}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-200 leading-relaxed">{event.description}</div>
                    <div className="mt-2 text-[11px] text-gray-500">Players: {event.participants.map(getPerformerName).join(', ')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Drama Intensity Timeline */}
        {dramaEvents.length > 0 && (
          <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-6">
            <DramaIntensityTimeline
              dramaEvents={dramaEvents}
              performers={performers}
            />
          </section>
        )}

        <section className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
          <h2 className="text-lg font-semibold text-blue-300">Performer Attributes</h2>
          <p className="text-xs text-gray-500">Trait profile for {selectedPerformer === 'all' ? 'each collaborator' : performerMap.get(selectedPerformer)?.name || 'selected performer'}.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {traitPerformers.map(performer => {
              const traits = withDefaultTraits(performer.traits);
              return (
                <div key={performer.id} className="rounded-lg border border-gray-800 bg-[#111315] p-4">
                  <div className="flex items-center justify-between text-sm text-gray-200">
                    <span className="font-semibold">{performer.name}</span>
                    <span className="text-xs text-gray-500">Intrigue {performer.intrigueLevel ?? 50}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {TRAIT_DEFINITIONS.map(def => (
                      <div key={def.key}>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>{def.label}</span>
                          <span className="text-gray-300">{traits[def.key]}</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-gray-800">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${traits[def.key]}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {traitPerformers.length === 0 && (
              <div className="rounded-lg border border-gray-800 bg-[#111315] p-4 text-sm text-gray-500">
                Select a performer to view their personality blueprint.
              </div>
            )}
          </div>
        </section>

        {isLoading && (
          <div className="rounded-xl border border-gray-800 bg-[#111315] p-4 text-center text-sm text-gray-500">
            Loading latest dynamics…
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamInteractionsPage;
