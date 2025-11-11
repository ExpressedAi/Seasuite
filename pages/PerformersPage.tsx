import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChatMessage, PerformerProfile, PerformerMemory, PerformerTraits, HRMR_GRADE_SCALE } from '../types';
import { getAllPerformers, savePerformer, deletePerformer, getPerformerMemories, clearPerformerMemories, getPerformerInteractions, getAllHrmrRatings } from '../services/db';
import { PROVIDERS, GOOGLE_MODELS, OPENAI_MODELS, OPENROUTER_MODELS } from '../services/aiService';
import { StageIcon, MonologueIcon, SpatialIcon, TemporalIcon, BiasIcon, HistoryIcon, GradeIcon, InsightIcon, TraceIcon } from '../components/icons/Icons';
import { TRAIT_DEFINITIONS, withDefaultTraits } from '../services/socialModel';

const providerModels: Record<string, readonly string[]> = {
    google: GOOGLE_MODELS,
    openai: OPENAI_MODELS,
    openrouter: OPENROUTER_MODELS
};

type PerformerFeatureKey =
    | 'usePreflection'
    | 'useMemory'
    | 'useTaskList'
    | 'useAudit'
    | 'useStageDirections'
    | 'useMonologue'
    | 'usePromptRewrite';

type PerformerFormState = {
    id?: string;
    name: string;
    description: string;
    icon: string;
    provider: string;
    model: string;
    apiKey: string;
    prompt: string;
    memoryEnabled: boolean;
    usePreflection: boolean;
    useMemory: boolean;
    useTaskList: boolean;
    useAudit: boolean;
    useStageDirections: boolean;
    useMonologue: boolean;
    usePromptRewrite: boolean;
    roleDescription: string;
    intrigueLevel: number;
    traits: PerformerTraits;
};

const ICON_OPTIONS = [
    { id: 'stage', label: 'Stagecraft', Icon: StageIcon },
    { id: 'monologue', label: 'Monologue', Icon: MonologueIcon },
    { id: 'spatial', label: 'Spatial', Icon: SpatialIcon },
    { id: 'temporal', label: 'Temporal', Icon: TemporalIcon },
    { id: 'bias', label: 'Bias', Icon: BiasIcon },
    { id: 'history', label: 'History', Icon: HistoryIcon },
    { id: 'insight', label: 'Insight', Icon: InsightIcon },
    { id: 'reasoning', label: 'Reason', Icon: TraceIcon },
    { id: 'evaluator', label: 'Evaluator', Icon: GradeIcon }
];

const performerFeatureToggleOptions: Array<{ key: PerformerFeatureKey; label: string }> = [
    { key: 'usePreflection', label: 'Preflection' },
    { key: 'useMemory', label: 'Memory Capture' },
    { key: 'useStageDirections', label: 'Stage Directions' },
    { key: 'useMonologue', label: 'Internal Monologue' },
    { key: 'usePromptRewrite', label: 'Prompt Rewrite' },
    { key: 'useTaskList', label: 'Task List' },
    { key: 'useAudit', label: 'Task Audit' }
];

const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';

const gradeToScore: Record<string, number> = {
    'A+': 10,
    'A': 9,
    'A-': 8,
    'B+': 7,
    'B': 6,
    'B-': 5,
    'C+': 4.5,
    'C': 4,
    'C-': 3.5,
    'D+': 3,
    'D': 2,
    'D-': 1.5,
    'F': 0
};

const defaultPerformerFeatures = {
    usePreflection: true,
    useMemory: true,
    useTaskList: false,
    useAudit: false,
    useStageDirections: false,
    useMonologue: false,
    usePromptRewrite: false
};

const emptyForm: PerformerFormState = {
    name: '',
    description: '',
    icon: 'stage',
    provider: 'google',
    model: GOOGLE_MODELS[0],
    apiKey: '',
    prompt: '',
    memoryEnabled: true,
    ...defaultPerformerFeatures,
    roleDescription: '',
    intrigueLevel: 50,
    traits: withDefaultTraits()
};

const iconLookup = ICON_OPTIONS.reduce<Record<string, React.FC<React.SVGProps<SVGSVGElement>>>>((acc, option) => {
    acc[option.id] = option.Icon;
    return acc;
}, {});

interface PerformerInsight {
    performerId: string;
    totalInteractions: number;
    targetInteractions: number;
    publicCount: number;
    privateCount: number;
    intrigueCount: number;
    supportCount: number;
    pressureCount: number;
    sentimentSum: number;
    sentimentSamples: number;
    averageSentiment: number;
    lastInteraction: number | null;
    hrmrTotal: number;
    hrmrCount: number;
    hrmrAverage: number | null;
    hrmrGrades: Record<string, number>;
}

const PerformersPage: React.FC = () => {
    const [performers, setPerformers] = useState<PerformerProfile[]>([]);
    const [formState, setFormState] = useState<PerformerFormState>(emptyForm);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [memoryPreview, setMemoryPreview] = useState<PerformerMemory[]>([]);
    const [isLoadingMemories, setIsLoadingMemories] = useState(false);
    const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
    const [insights, setInsights] = useState<Record<string, PerformerInsight>>({});

    const selectedPerformer = useMemo(() => selectedId ? performers.find(performer => performer.id === selectedId) || null : null, [performers, selectedId]);
    const selectedInsight = selectedId ? insights[selectedId] : undefined;
    const selectedTraits = useMemo(() => selectedPerformer ? withDefaultTraits(selectedPerformer.traits) : null, [selectedPerformer]);
    const averageSentiment = selectedInsight ? selectedInsight.averageSentiment : null;
    const sentimentDescriptor = averageSentiment === null || Number.isNaN(averageSentiment)
        ? 'No sentiment telemetry yet'
        : averageSentiment > 0.25
            ? 'Supportive tone'
            : averageSentiment < -0.25
                ? 'Pressure tactics'
                : 'Balanced mix';
    const sentimentBadgeClass = averageSentiment === null || Number.isNaN(averageSentiment)
        ? 'border-gray-600 bg-gray-800 text-gray-300'
        : averageSentiment > 0.25
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
            : averageSentiment < -0.25
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-200';

    const hrmrAverageScore = selectedInsight?.hrmrAverage ?? null;
    const hrmrApproxGrade = useMemo(() => {
        if (hrmrAverageScore === null || Number.isNaN(hrmrAverageScore)) return null;
        let bestGrade = HRMR_GRADE_SCALE[0];
        let bestDiff = Infinity;
        HRMR_GRADE_SCALE.forEach(grade => {
            const diff = Math.abs((gradeToScore[grade] ?? 0) - hrmrAverageScore);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestGrade = grade;
            }
        });
        return bestGrade;
    }, [hrmrAverageScore]);

    const traitNotes = useMemo(() => {
        if (!selectedTraits) return [] as string[];
        if (!selectedInsight) return ['No telemetry yet — run more interactions to reinforce this persona.'];
        const notes: string[] = [];
        const { supportCount = 0, pressureCount = 0, intrigueCount = 0, privateCount = 0, publicCount = 0 } = selectedInsight;

        if (selectedTraits.empathy >= 65 && supportCount > pressureCount) {
            notes.push('Empathy is coming through in supportive exchanges.');
        } else if (selectedTraits.empathy <= 40 && supportCount === 0) {
            notes.push('Low empathy profile — consider coaching toward more supportive moves.');
        }

        if (selectedTraits.volatility >= 65 && pressureCount > 0) {
            notes.push('Volatility expressed via pressure spikes — keep an eye on escalation.');
        } else if (selectedTraits.volatility <= 35 && pressureCount === 0) {
            notes.push('Calm demeanor: volatility stays contained under pressure.');
        }

        if (selectedTraits.cunning >= 60 && intrigueCount > 0) {
            notes.push('Cunning validated through intrigue maneuvers.');
        }

        if (selectedTraits.discipline >= 60 && privateCount >= publicCount) {
            notes.push('Discipline leans into private ops — keeps playbooks tight.');
        }

        if (selectedTraits.curiosity >= 60 && selectedInsight.targetInteractions > 0) {
            notes.push('Curiosity sparks responses — they are probing others frequently.');
        }

        if (notes.length === 0) {
            notes.push('Traits steady — no strong reinforcement signals yet.');
        }
        return notes;
    }, [selectedTraits, selectedInsight]);

    const totalInteractions = selectedInsight?.totalInteractions ?? 0;
    const privateShare = selectedInsight ? Math.round((selectedInsight.privateCount / Math.max(1, selectedInsight.privateCount + selectedInsight.publicCount)) * 100) : 0;
    const intrigueCount = selectedInsight?.intrigueCount ?? 0;
    const lastActiveLabel = selectedInsight?.lastInteraction
        ? formatDistanceToNow(new Date(selectedInsight.lastInteraction), { addSuffix: true })
        : 'No activity yet';

    const loadInsights = useCallback(async () => {
        try {
            const [interactionEvents, hrmrRatings] = await Promise.all([
                getPerformerInteractions(),
                getAllHrmrRatings()
            ]);

            const chatMessages: ChatMessage[] = (() => {
                if (typeof window === 'undefined') return [];
                try {
                    const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
                    if (!raw) return [];
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        return parsed as ChatMessage[];
                    }
                } catch (error) {
                    console.warn('Failed to parse chat history for performer insights:', error);
                }
                return [];
            })();

            const messageToPerformer = new Map<string, string>();
            chatMessages.forEach(message => {
                if (message.id && message.performerId) {
                    messageToPerformer.set(message.id, message.performerId);
                }
            });

            const map = new Map<string, PerformerInsight>();
            const ensure = (performerId: string) => {
                if (!map.has(performerId)) {
                    map.set(performerId, {
                        performerId,
                        totalInteractions: 0,
                        targetInteractions: 0,
                        publicCount: 0,
                        privateCount: 0,
                        intrigueCount: 0,
                        supportCount: 0,
                        pressureCount: 0,
                        sentimentSum: 0,
                        sentimentSamples: 0,
                        averageSentiment: 0,
                        lastInteraction: null,
                        hrmrTotal: 0,
                        hrmrCount: 0,
                        hrmrAverage: null,
                        hrmrGrades: {}
                    });
                }
                return map.get(performerId)!;
            };

            interactionEvents.forEach(event => {
                const speakerEntry = ensure(event.speakerId);
                speakerEntry.totalInteractions += 1;
                speakerEntry.lastInteraction = speakerEntry.lastInteraction ? Math.max(speakerEntry.lastInteraction, event.timestamp) : event.timestamp;
                if (event.context === 'private') {
                    speakerEntry.privateCount += 1;
                } else {
                    speakerEntry.publicCount += 1;
                }
                if (typeof event.sentiment === 'number') {
                    speakerEntry.sentimentSum += event.sentiment;
                    speakerEntry.sentimentSamples += 1;
                    if (event.sentiment > 0.35) {
                        speakerEntry.supportCount += 1;
                    } else if (event.sentiment < -0.35) {
                        speakerEntry.pressureCount += 1;
                    }
                }
                if (event.intrigueTags?.length) {
                    speakerEntry.intrigueCount += 1;
                }

                event.targetIds.forEach(targetId => {
                    const targetEntry = ensure(targetId);
                    targetEntry.targetInteractions += 1;
                    targetEntry.lastInteraction = targetEntry.lastInteraction ? Math.max(targetEntry.lastInteraction, event.timestamp) : event.timestamp;
                    if (event.context === 'private') {
                        targetEntry.privateCount += 1;
                    } else {
                        targetEntry.publicCount += 1;
                    }
                    if (typeof event.sentiment === 'number') {
                        targetEntry.sentimentSum += event.sentiment * 0.5;
                        targetEntry.sentimentSamples += 1;
                    }
                    if (event.intrigueTags?.length) {
                        targetEntry.intrigueCount += 1;
                    }
                });
            });

            hrmrRatings.forEach(rating => {
                const performerId = messageToPerformer.get(rating.messageId);
                if (!performerId) return;
                const entry = ensure(performerId);
                const score = gradeToScore[rating.grade];
                if (typeof score === 'number') {
                    entry.hrmrTotal += score;
                    entry.hrmrCount += 1;
                    entry.hrmrAverage = entry.hrmrTotal / entry.hrmrCount;
                    entry.hrmrGrades[rating.grade] = (entry.hrmrGrades[rating.grade] ?? 0) + 1;
                }
            });

            const results: Record<string, PerformerInsight> = {};
            map.forEach((value, performerId) => {
                const averageSentiment = value.sentimentSamples ? value.sentimentSum / value.sentimentSamples : 0;
                results[performerId] = {
                    ...value,
                    averageSentiment
                };
            });

            setInsights(results);
        } catch (error) {
            console.error('Failed to load performer insights:', error);
        }
    }, []);

    const loadPerformers = async () => {
        try {
            const all = await getAllPerformers();
            const sorted = all.sort((a, b) => a.name.localeCompare(b.name));
            setPerformers(sorted);
            if (selectedId) {
                const existing = sorted.find(p => p.id === selectedId);
                if (!existing) {
                    setSelectedId(null);
                    setFormState(emptyForm);
                    setMemoryPreview([]);
                }
                if (existing) {
                    setFormState({
                        id: existing.id,
                        name: existing.name,
                        description: existing.description || '',
                        icon: existing.icon || 'stage',
                        provider: existing.provider,
                        model: existing.model,
                        apiKey: existing.apiKey,
                        prompt: existing.prompt,
                        memoryEnabled: existing.memoryEnabled !== false,
                        usePreflection: existing.featureOverrides?.usePreflection ?? defaultPerformerFeatures.usePreflection,
                        useMemory: existing.featureOverrides?.useMemory ?? defaultPerformerFeatures.useMemory,
                        useTaskList: existing.featureOverrides?.useTaskList ?? defaultPerformerFeatures.useTaskList,
                        useAudit: existing.featureOverrides?.useAudit ?? defaultPerformerFeatures.useAudit,
                        useStageDirections: existing.featureOverrides?.useStageDirections ?? defaultPerformerFeatures.useStageDirections,
                        useMonologue: existing.featureOverrides?.useMonologue ?? defaultPerformerFeatures.useMonologue,
                        usePromptRewrite: existing.featureOverrides?.usePromptRewrite ?? defaultPerformerFeatures.usePromptRewrite,
                        roleDescription: existing.roleDescription || '',
                        intrigueLevel: existing.intrigueLevel ?? 50,
                        traits: withDefaultTraits(existing.traits)
                    });
                    loadPerformerMemoryPreview(existing.id);
                }
            }
        } catch (error) {
            console.error('Failed to load performers:', error);
        }
    };

    const loadPerformerMemoryPreview = async (performerId: string) => {
        setIsLoadingMemories(true);
        try {
            const memories = await getPerformerMemories(performerId, 8);
            setMemoryPreview(memories);
        } catch (error) {
            console.error('Failed to load performer memories:', error);
            setMemoryStatus('Unable to load memory timeline.');
            setTimeout(() => setMemoryStatus(null), 3000);
        } finally {
            setIsLoadingMemories(false);
        }
    };

    useEffect(() => {
        loadPerformers();
        loadInsights();
    }, [loadInsights]);

    useEffect(() => {
        if (selectedId) {
            loadPerformerMemoryPreview(selectedId);
        } else {
            setMemoryPreview([]);
        }
    }, [selectedId]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent)?.detail as { performerId?: string | null } | undefined;
            if (!detail) {
                if (selectedId) {
                    loadPerformerMemoryPreview(selectedId);
                }
                return;
            }
            if (!detail.performerId || detail.performerId === selectedId) {
                if (selectedId) {
                    loadPerformerMemoryPreview(selectedId);
                }
            }
        };
        window.addEventListener('performer-memories-updated', handler as EventListener);
        return () => {
            window.removeEventListener('performer-memories-updated', handler as EventListener);
        };
    }, [selectedId]);

    useEffect(() => {
        const handleUpdate = () => {
            loadInsights();
        };
        window.addEventListener('performer-interactions-updated', handleUpdate);
        window.addEventListener('intelligence-log-updated', handleUpdate);
        window.addEventListener('intelligence-record-processed', handleUpdate);
        return () => {
            window.removeEventListener('performer-interactions-updated', handleUpdate);
            window.removeEventListener('intelligence-log-updated', handleUpdate);
            window.removeEventListener('intelligence-record-processed', handleUpdate);
        };
    }, [loadInsights]);

    const handleSelect = (performer: PerformerProfile) => {
        setSelectedId(performer.id);
        setFormState({
            id: performer.id,
            name: performer.name,
            description: performer.description || '',
            icon: performer.icon || 'stage',
            provider: performer.provider,
            model: performer.model,
            apiKey: performer.apiKey,
            prompt: performer.prompt,
            memoryEnabled: performer.memoryEnabled !== false,
            usePreflection: performer.featureOverrides?.usePreflection ?? defaultPerformerFeatures.usePreflection,
            useMemory: performer.featureOverrides?.useMemory ?? defaultPerformerFeatures.useMemory,
            useTaskList: performer.featureOverrides?.useTaskList ?? defaultPerformerFeatures.useTaskList,
            useAudit: performer.featureOverrides?.useAudit ?? defaultPerformerFeatures.useAudit,
            useStageDirections: performer.featureOverrides?.useStageDirections ?? defaultPerformerFeatures.useStageDirections,
            useMonologue: performer.featureOverrides?.useMonologue ?? defaultPerformerFeatures.useMonologue,
            usePromptRewrite: performer.featureOverrides?.usePromptRewrite ?? defaultPerformerFeatures.usePromptRewrite,
            roleDescription: performer.roleDescription || '',
            intrigueLevel: performer.intrigueLevel ?? 50,
            traits: withDefaultTraits(performer.traits)
        });
    };

    const handleChange = <K extends keyof PerformerFormState>(key: K, value: PerformerFormState[K]) => {
        setFormState(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'provider') {
                const models = providerModels[value as string];
                if (models && models.length > 0) {
                    next.model = models[0];
                }
            }
            if (key === 'useTaskList' && value === false) {
                next.useAudit = false;
            }
            return next;
        });
    };

    const handleTraitChange = (traitKey: keyof PerformerTraits, value: number) => {
        setFormState(prev => ({
            ...prev,
            traits: {
                ...prev.traits,
                [traitKey]: Math.max(0, Math.min(100, Math.round(value)))
            }
        }));
    };

    const handleSave = async () => {
        if (!formState.name.trim()) {
            setStatus('Name is required.');
            return;
        }
        setIsSaving(true);
        try {
            const now = Date.now();
            const performer: PerformerProfile = {
                id: formState.id || `performer-${now}`,
                name: formState.name.trim(),
                description: formState.description.trim(),
                icon: formState.icon,
                provider: formState.provider as PerformerProfile['provider'],
                model: formState.model,
                apiKey: formState.apiKey.trim(),
                prompt: formState.prompt,
                memoryEnabled: formState.memoryEnabled,
                featureOverrides: {
                    usePreflection: formState.usePreflection,
                    useMemory: formState.useMemory,
                    useTaskList: formState.useTaskList,
                    useAudit: formState.useAudit,
                    useStageDirections: formState.useStageDirections,
                    useMonologue: formState.useMonologue,
                    usePromptRewrite: formState.usePromptRewrite
                },
                roleDescription: formState.roleDescription.trim(),
                intrigueLevel: formState.intrigueLevel,
                traits: withDefaultTraits(formState.traits),
                createdAt: formState.id ? performers.find(p => p.id === formState.id)?.createdAt || now : now,
                updatedAt: now
            };
            await savePerformer(performer);
            setStatus('Performer saved.');
            setSelectedId(performer.id);
            await loadPerformers();
            await loadInsights();
        } catch (error) {
            console.error('Failed to save performer:', error);
            setStatus('Could not save performer.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setStatus(null), 3000);
        }
    };

    const handleCreateNew = () => {
        setSelectedId(null);
        setFormState(emptyForm);
        setMemoryPreview([]);
        setMemoryStatus(null);
    };

    const handleDelete = async (performer: PerformerProfile) => {
        const confirmation = window.confirm(`Delete performer "${performer.name}"?`);
        if (!confirmation) return;
        try {
            await deletePerformer(performer.id);
            setStatus('Performer deleted.');
            await loadPerformers();
            await loadInsights();
            handleCreateNew();
        } catch (error) {
            console.error('Failed to delete performer:', error);
            setStatus('Could not delete performer.');
        } finally {
            setTimeout(() => setStatus(null), 3000);
        }
    };

    const handleClearMemories = async () => {
        if (!selectedId) return;
        const confirmation = window.confirm('Clear this performer\'s memory timeline? This cannot be undone.');
        if (!confirmation) return;
        try {
            await clearPerformerMemories(selectedId);
            setMemoryStatus('Performer memory cleared.');
            await loadPerformerMemoryPreview(selectedId);
        } catch (error) {
            console.error('Failed to clear performer memories:', error);
            setMemoryStatus('Could not clear performer memory.');
        } finally {
            setTimeout(() => setMemoryStatus(null), 3000);
        }
    };

    return (
        <div className="p-3 md:p-8 h-full flex flex-col gap-4 md:gap-6 overflow-y-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-4xl font-bold text-gray-100">Performers</h1>
                    <p className="text-gray-400 text-sm max-w-2xl">
                        Spin up auxiliary personas with their own models, prompts, and memories. Toggle them in chat to add their perspective alongside Seasuite like a boardroom task force.
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs md:text-sm text-gray-400">
                    {status && <span className="text-blue-300">{status}</span>}
                    <button
                        onClick={handleCreateNew}
                        className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-600"
                    >
                        New Performer
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
                <div className="md:w-80 flex-shrink-0 bg-[#1e1f20] border border-gray-700 rounded-lg p-3 md:p-4 flex flex-col overflow-y-auto">
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Roster</div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {performers.length === 0 ? (
                            <p className="text-gray-500 text-sm">No performers yet. Create one to begin.</p>
                        ) : (
                            performers.map(performer => (
                                <button
                                    key={performer.id}
                                    onClick={() => handleSelect(performer)}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm border ${
                                        performer.id === selectedId
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'bg-[#2a2b2c] hover:bg-gray-700 text-gray-300 border-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">
                                            {(() => {
                                                const IconComponent = iconLookup[performer.icon || 'stage'];
                                                return IconComponent ? <IconComponent className="h-5 w-5" /> : performer.icon || '•';
                                            })()}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold truncate">{performer.name}</div>
                                            <div className="text-xs text-gray-400 truncate">
                                                {performer.provider.toUpperCase()} • {performer.model}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex-1 bg-[#1e1f20] border border-gray-700 rounded-lg p-3 md:p-6 overflow-y-auto">
                    {selectedPerformer && (
                        <div className="mb-4 md:mb-6 rounded-lg border border-gray-700 bg-[#16171b] p-3 md:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-100">Persona Pulse</h2>
                                    <p className="text-xs text-gray-500">Telemetry drawn from interactions, DM ops, and HRMR scoring.</p>
                                </div>
                                <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${sentimentBadgeClass}`}>
                                    {sentimentDescriptor}
                                    {averageSentiment !== null && !Number.isNaN(averageSentiment) && (
                                        <span className="ml-1 text-[10px] opacity-75">({averageSentiment.toFixed(2)})</span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 text-sm text-gray-200">
                                <div className="rounded-md border border-gray-700 bg-[#1f2024] p-3">
                                    <div className="text-xs uppercase tracking-wider text-gray-500">Activity</div>
                                    <div className="mt-2 text-xl font-semibold text-gray-100">{totalInteractions}</div>
                                    <div className="text-[11px] text-gray-500">signals sent · {selectedInsight?.targetInteractions ?? 0} reactive</div>
                                    <div className="mt-1 text-[11px] text-gray-500">Last active {lastActiveLabel}</div>
                                </div>
                                <div className="rounded-md border border-gray-700 bg-[#1f2024] p-3">
                                    <div className="text-xs uppercase tracking-wider text-gray-500">Ops Mix</div>
                                    <div className="mt-2 text-xl font-semibold text-gray-100">{privateShare}%</div>
                                    <div className="text-[11px] text-gray-500">private operations share</div>
                                    <div className="mt-1 text-[11px] text-gray-500">{selectedInsight?.publicCount ?? 0} public · {selectedInsight?.privateCount ?? 0} private</div>
                                </div>
                                <div className="rounded-md border border-gray-700 bg-[#1f2024] p-3">
                                    <div className="text-xs uppercase tracking-wider text-gray-500">Intrigue</div>
                                    <div className="mt-2 text-xl font-semibold text-gray-100">{intrigueCount}</div>
                                    <div className="text-[11px] text-gray-500">moments triggering intrigue cues</div>
                                    <div className="mt-1 text-[11px] text-gray-500">{selectedInsight?.supportCount ?? 0} boosts · {selectedInsight?.pressureCount ?? 0} pressure</div>
                                </div>
                                <div className="rounded-md border border-gray-700 bg-[#1f2024] p-3">
                                    <div className="text-xs uppercase tracking-wider text-gray-500">HRMR Pulse</div>
                                    <div className="mt-2 text-xl font-semibold text-gray-100">{hrmrApproxGrade ?? '—'}</div>
                                    <div className="text-[11px] text-gray-500">avg score {hrmrAverageScore !== null && !Number.isNaN(hrmrAverageScore) ? hrmrAverageScore.toFixed(2) : '—'}</div>
                                    <div className="mt-1 text-[11px] text-gray-500">{selectedInsight?.hrmrCount ?? 0} graded turns</div>
                                </div>
                            </div>
                            <div className="mt-4">
                                <div className="text-xs uppercase tracking-wider text-gray-500">Trait Alignment</div>
                                <ul className="mt-2 space-y-1 text-sm text-gray-300">
                                    {traitNotes.map((note, index) => (
                                        <li key={index} className="flex items-start gap-2"><span className="mt-1 h-[6px] w-[6px] rounded-full bg-blue-400" /> {note}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Display Icon</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {ICON_OPTIONS.map(({ id, label, Icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => handleChange('icon', id)}
                                        className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-colors ${
                                            formState.icon === id
                                                ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                                                : 'border-gray-700 bg-[#2a2b2c] text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span className="truncate max-w-[80px]">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Name</label>
                            <input
                                type="text"
                                value={formState.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder="e.g., Seasuite // Strategist"
                                className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Description</label>
                            <textarea
                                value={formState.description}
                                onChange={e => handleChange('description', e.target.value)}
                                className="w-full h-20 bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Role Description</label>
                            <textarea
                                value={formState.roleDescription}
                                onChange={e => handleChange('roleDescription', e.target.value)}
                                className="w-full h-24 bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Define this performer’s seat at the table."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Intrigue Level</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={formState.intrigueLevel}
                                    onChange={e => handleChange('intrigueLevel', Number(e.target.value) as any)}
                                    className="flex-1"
                                />
                                <span className="text-sm text-gray-300 w-10 text-right">{formState.intrigueLevel}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">Higher intrigue influences drama tagging and storyline arcs.</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Personality Blueprint</label>
                            <p className="text-[11px] text-gray-500 mb-3">Dial in how this performer handles pressure, secrets, and stage moments.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {TRAIT_DEFINITIONS.map(definition => (
                                    <div key={definition.key} className="bg-[#2a2b2c] border border-gray-700 rounded-lg px-3 py-3">
                                        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-gray-400">
                                            <span>{definition.label}</span>
                                            <span className="text-gray-300">{formState.traits[definition.key]}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1 leading-snug">{definition.description}</p>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={formState.traits[definition.key]}
                                            onChange={e => handleTraitChange(definition.key, Number(e.target.value))}
                                            className="mt-3 w-full"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Provider</label>
                            <select
                                value={formState.provider}
                                onChange={e => handleChange('provider', e.target.value)}
                                className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {PROVIDERS.map(provider => (
                                    <option key={provider} value={provider}>{provider.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Model</label>
                            <select
                                value={formState.model}
                                onChange={e => handleChange('model', e.target.value)}
                                className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {providerModels[formState.provider]?.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">API Key</label>
                            <input
                                type="password"
                                value={formState.apiKey}
                                onChange={e => handleChange('apiKey', e.target.value)}
                                placeholder={`Override ${formState.provider.toUpperCase()} key`}
                                className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">
                                Stored locally only. Leave blank to reuse the global {formState.provider.toUpperCase()} key from Settings.
                            </p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Primed Prompt</label>
                            <textarea
                                value={formState.prompt}
                                onChange={e => handleChange('prompt', e.target.value)}
                                placeholder="Define the performer's behavior"
                                className="w-full h-40 bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#141517] border border-gray-700 rounded-lg p-4">
                            <div className="mb-3">
                                <span className="text-xs font-semibold text-gray-400 uppercase">Feature Toggles</span>
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Choose which modules this performer always enables during their turn.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-200">
                                {performerFeatureToggleOptions.map(option => {
                                    const disabled = option.key === 'useAudit' && !formState.useTaskList;
                                    return (
                                        <label key={option.key as string} className={`flex items-center gap-2 ${disabled ? 'opacity-60' : ''}`}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4"
                                                checked={Boolean(formState[option.key])}
                                                disabled={disabled}
                                                onChange={e => handleChange(option.key, (disabled ? false : e.target.checked) as any)}
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bg-[#141517] border border-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-400 uppercase">Boardroom Memory</label>
                                <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                                    <span>{formState.memoryEnabled ? 'Enabled' : 'Disabled'}</span>
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={formState.memoryEnabled}
                                        onChange={e => handleChange('memoryEnabled', e.target.checked)}
                                    />
                                </label>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-3">
                                When enabled, this performer maintains a lightweight memory log that informs future turns. Disable if you want purely in-the-moment responses.
                            </p>
                        </div>
                        <div className="bg-[#141517] border border-gray-700 rounded-lg p-4 flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase text-gray-400">Recent Memory Timeline</span>
                                <button
                                    onClick={handleClearMemories}
                                    disabled={!selectedId || memoryPreview.length === 0}
                                    className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                                        !selectedId || memoryPreview.length === 0
                                            ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                                            : 'border-red-500 text-red-300 hover:bg-red-500/20'
                                    }`}
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto border border-gray-800 rounded-md bg-[#111214] p-3 space-y-3 text-sm">
                                {isLoadingMemories ? (
                                    <div className="text-gray-500 text-xs text-center">Loading memory snippets…</div>
                                ) : memoryPreview.length === 0 ? (
                                    <div className="text-gray-600 text-xs text-center">
                                        {selectedId ? 'No memories captured yet.' : 'Select a performer to view their memory timeline.'}
                                    </div>
                                ) : (
                                    memoryPreview.map(memory => (
                                        <div key={memory.id || memory.timestamp} className="border border-gray-800 rounded-md p-3 bg-[#18191b]">
                                            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                                                <span>{new Date(memory.timestamp).toLocaleString()}</span>
                                                <span className="uppercase tracking-wide text-gray-500">Relevance {memory.relevance}</span>
                                            </div>
                                            <div className="text-gray-200 text-sm font-semibold mb-1">{memory.summary}</div>
                                            {memory.tags?.length ? (
                                                <div className="flex flex-wrap gap-1 text-[10px] text-blue-300">
                                                    {memory.tags.slice(0, 6).map(tag => (
                                                        <span key={`${memory.timestamp}-${tag}`} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30">
                                                            #{tag.replace(/\s+/g, '-')}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                            <p className="text-[11px] text-gray-400 mt-2 whitespace-pre-wrap">
                                                {memory.transcriptSnippet}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                            {memoryStatus && (
                                <div className="text-[11px] text-blue-300 mt-2 text-right">{memoryStatus}</div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 md:mt-6 flex items-center gap-2 md:gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors ${isSaving ? 'bg-blue-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
                        >
                            {isSaving ? 'Saving…' : 'Save Performer'}
                        </button>
                        {formState.id && (
                            <button
                                onClick={() => {
                                    const performer = performers.find(p => p.id === formState.id);
                                    if (performer) {
                                        handleDelete(performer);
                                    }
                                }}
                                className="px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors bg-red-600 hover:bg-red-500 text-white"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformersPage;
