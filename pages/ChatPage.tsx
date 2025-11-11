
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatInput, { ActiveFeatures } from '../components/ChatInput';
import ChatMessage from '../components/ChatMessage';
import EscortToolbar from '../components/EscortToolbar';
import { EscortResult } from '../services/escorts';
import SuggestionChip from '../components/SuggestionChip';
import { ChatMessage as ChatMessageType, ConversationThread, PerformerProfile, PerformerInteractionEvent, Memory, DramaEvent, SkillBranchId, ExperienceEventType, PlayerProgress, SkillReward, MissionSummary, IntelligenceFollowUp, FollowUpStatus } from '../types';
import { generateAgentResponse, summarizeConversationForThread, generatePerformerResponse, rewriteUserPrompt } from '../services/aiService';
import { addMemory, addPerformerMemory, addPerformerInteractionEvents, getAllJournalEntries, saveThread, getJournalEntry, upsertJournalEntry, getAllPerformers, getAllThreads, getAllMemories, getTagScores, getPlayerProgress, getFollowUps, updateFollowUp } from '../services/db';
import { processMemory, applyProcessingResult } from '../services/memoryProcessor';
import { showToast } from '../components/Toast';
import { analyzeRelationshipDynamics, applyRelationshipAnalysis } from '../services/relationshipEngine';
import DramaNotification from '../components/DramaNotification';
import SocialAlert from '../components/SocialAlert';
import { BirdIcon } from '../components/icons/Icons';
import { format } from 'date-fns';
import { calculateSentimentScore, detectNarrativeTags, collectIntrigueTags, buildKeywordSet, generateSocialSignals, SocialSignal, HIGH_INTRIGUE_THRESHOLD, addKeywordsFromText } from '../services/socialSignals';
import MissionSidebar from '../components/MissionSidebar';
import IntelligenceFeed from '../components/IntelligenceFeed';
import FollowUpPanel from '../components/FollowUpPanel';
import { awardExperience, getMissionSummary } from '../services/progressionEngine';
import { getRankForXp, SKILL_BRANCHES } from '../services/skills';
import { getIntelligenceLog, IntelligenceRecord } from '../services/intelligenceLog';

declare global {
    interface Window {
        __sylviaChatCache?: ChatMessageType[];
    }
}

const CHAT_CACHE_KEY = '__sylviaChatCache';
const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';
const sortThreadsByRecency = (threads: ConversationThread[]) =>
    [...threads].sort(
        (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
    );
const createSessionId = () => `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const USER_PARTICIPANT_ID = 'user';
const SYLVIA_PARTICIPANT_ID = 'sylvia';

const createLocalId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const scoreMemoryForContext = (
    memory: Memory,
    keywords: Set<string>,
    tagWeights: Map<string, number>,
    prioritizedTags: Set<string>
): number => {
    let score = (memory.relevance ?? 0) * 2; // relevance is 0-10; weight higher to respect human curation

    const normalizedTags = memory.tags.map(tag => tag.toLowerCase());
    let priorityMatchWeight = 0;

    normalizedTags.forEach(tag => {
        if (prioritizedTags.has(tag)) {
            const weight = tagWeights.get(tag) ?? 1;
            priorityMatchWeight += weight;
            score += 8 + weight * 0.6; // strong boost for vetted tags
        } else if (keywords.has(tag)) {
            score += 2;
        }
    });

    if (priorityMatchWeight > 0) {
        score += Math.min(priorityMatchWeight, 12); // avoid runaway inflation
    }

    const summaryWords = new Set<string>();
    addKeywordsFromText(memory.summary, summaryWords);
    summaryWords.forEach(word => {
        if (keywords.has(word)) {
            score += 1.5;
        }
    });

    const conversationWords = new Set<string>();
    addKeywordsFromText(memory.conversation, conversationWords);
    let conversationMatches = 0;
    conversationWords.forEach(word => {
        if (keywords.has(word)) {
            conversationMatches += 1;
        }
    });
    score += conversationMatches * 0.5;

    const ageDays = (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - Math.min(ageDays, 60) / 60);
    score += recencyBoost * 5;

    return score;
};

const buildMemoryMetaTags = (conversationId: string, performerId: string | null, features: ActiveFeatures): string[] => {
    const tags = new Set<string>();
    tags.add(`conversation:${conversationId}`);
    tags.add(performerId ? `performer:${performerId}` : 'performer:core');
    tags.add(`memory:${features.useMemory ? 'on' : 'off'}`);
    if (features.usePreflection) tags.add('preflection:on');
    if (features.useStageDirections) tags.add('stage:on');
    if (features.useTaskList) tags.add('tasking:on');
    if (features.useAudit) tags.add('audit:on');
    if (features.useMonologue) tags.add('monologue:on');
    if (features.usePromptRewrite) tags.add('rewrite:on');
    return Array.from(tags);
};

const applyPerformerOverrides = (base: ActiveFeatures, performer?: PerformerProfile | null): ActiveFeatures => {
    if (!performer?.featureOverrides) return base;
    const overrides = performer.featureOverrides;
    const merged: ActiveFeatures = {
        usePreflection: overrides.usePreflection ?? base.usePreflection,
        useMemory: overrides.useMemory ?? base.useMemory,
        useTaskList: overrides.useTaskList ?? base.useTaskList,
        useAudit: overrides.useAudit ?? base.useAudit,
        useStageDirections: overrides.useStageDirections ?? base.useStageDirections,
        useMonologue: overrides.useMonologue ?? base.useMonologue,
        usePromptRewrite: overrides.usePromptRewrite ?? base.usePromptRewrite
    };
    if (!merged.useTaskList) {
        merged.useAudit = false;
    }
    return merged;
};

const speakerPersonaNameOrYou = (performer: PerformerProfile | null, message: string): string => {
    if (!performer) {
        return `User: ${message}`;
    }
    return `${performer.name}: ${message}`;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // result is "data:image/jpeg;base64,...."
            // we only want the part after the comma
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};

// Background memory processing function - automatically extracts intelligence from memories
const processMemoryInBackground = async (memoryId: number) => {
    try {
        // Get the memory we just created
        const allMemories = await getAllMemories();
        const memory = allMemories.find(m => m.id === memoryId);
        if (!memory) return;

        // Process the memory to extract intelligence
        const result = await processMemory(memory);
        
        // Only process if there's meaningful intelligence to extract
        const hasIntelligence = 
            result.clientUpdates.length > 0 ||
            result.brandUpdates !== null ||
            result.performerUpdates.length > 0 ||
            result.calendarEntries.length > 0 ||
            result.knowledgeConnections.length > 0 ||
            result.interactionEvents.length > 0;

        if (hasIntelligence) {
            // Apply the processing results (updates clients, brand, etc.)
            await applyProcessingResult(memoryId, result);

            // Show toast notifications for what was extracted
            const updates: string[] = [];
            if (result.clientUpdates.length > 0) {
                updates.push(`${result.clientUpdates.length} client update${result.clientUpdates.length > 1 ? 's' : ''}`);
            }
            if (result.brandUpdates) {
                updates.push('brand intelligence');
            }
            if (result.performerUpdates.length > 0) {
                updates.push(`${result.performerUpdates.length} performer update${result.performerUpdates.length > 1 ? 's' : ''}`);
            }
            if (result.calendarEntries.length > 0) {
                updates.push(`${result.calendarEntries.length} calendar entr${result.calendarEntries.length > 1 ? 'ies' : 'y'}`);
            }
            if (result.knowledgeConnections.length > 0) {
                updates.push(`${result.knowledgeConnections.length} knowledge connection${result.knowledgeConnections.length > 1 ? 's' : ''}`);
            }

            if (updates.length > 0) {
                showToast(
                    `Intelligence extracted: ${updates.join(', ')}`,
                    'info',
                    5000
                );
            }
        }
    } catch (error) {
        console.error('Background memory processing error:', error);
        // Show error toast but don't interrupt user experience
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        showToast(
            `Memory processing error: ${errorMessage}. Check console for details.`,
            'error',
            5000
        );
    }
};

const ChatPage: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessageType[]>(() => {
        if (typeof window === 'undefined') return [];
        const cached = window[CHAT_CACHE_KEY];
        if (cached && Array.isArray(cached)) {
            return cached;
        }
        try {
            const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as ChatMessageType[];
                if (Array.isArray(parsed)) {
                    window[CHAT_CACHE_KEY] = parsed;
                    return parsed;
                }
            }
        } catch (error) {
            console.error('Failed to hydrate chat history:', error);
        }
        return [];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [performers, setPerformers] = useState<PerformerProfile[]>([]);
    const [activePerformerIds, setActivePerformerIds] = useState<string[]>([]);
    const [isSavingThread, setIsSavingThread] = useState(false);
    const [threadStatus, setThreadStatus] = useState<string | null>(null);
    const [activeThreadMeta, setActiveThreadMeta] = useState<{ id: string; title: string } | null>(null);
    const [availableThreads, setAvailableThreads] = useState<ConversationThread[]>([]);
    const [isThreadPickerOpen, setIsThreadPickerOpen] = useState(false);
    const [isLoadingThreads, setIsLoadingThreads] = useState(false);
    const [sessionId, setSessionId] = useState(() => createSessionId());
    const [isCoreAgentMuted, setIsCoreAgentMuted] = useState(false);
    const [contextMemories, setContextMemories] = useState<Memory[]>([]);
    const [contextTags, setContextTags] = useState<Array<{ tag: string; weight: number }>>([]);
    const [socialSignals, setSocialSignals] = useState<SocialSignal[]>([]);
    const [playerProgress, setPlayerProgress] = useState<PlayerProgress | null>(null);
    const [missionSummary, setMissionSummary] = useState<MissionSummary | null>(null);
    const [intelligenceRecords, setIntelligenceRecords] = useState<IntelligenceRecord[]>([]);
    const [followUps, setFollowUps] = useState<IntelligenceFollowUp[]>([]);
    const [xpToasts, setXpToasts] = useState<Array<{ id: string; branch: SkillBranchId; xp: number; type: ExperienceEventType }>>([]);
    const [followUpToasts, setFollowUpToasts] = useState<Array<{ id: string; title: string; category: string }>>([]);
    const [rankCelebration, setRankCelebration] = useState<{ title: string; xp: number } | null>(null);
    const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
    const [escortResults, setEscortResults] = useState<Map<string, { result: EscortResult; escortName: string }>>(new Map());
    const [isMissionSidebarOpen, setIsMissionSidebarOpen] = useState(false);
    const [isIntelligenceFeedOpen, setIsIntelligenceFeedOpen] = useState(false);
    const [isFollowUpPanelOpen, setIsFollowUpPanelOpen] = useState(false);
    const [dramaNotifications, setDramaNotifications] = useState<DramaEvent[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const followUpsLoadedRef = useRef(false);

    const unlockedToggleFeatures = useMemo(() => {
        if (!playerProgress) return new Set<string>();
        const toggles = playerProgress.earnedRewards.filter(
            (reward): reward is Extract<SkillReward, { type: 'toggle' }> => reward.type === 'toggle'
        );
        return new Set(toggles.map(reward => reward.feature));
    }, [playerProgress]);

    const currentRank = useMemo(() => {
        if (!playerProgress) return null;
        return getRankForXp(playerProgress.totalXp);
    }, [playerProgress]);

    const pushXpToast = (branch: SkillBranchId, xp: number, type: ExperienceEventType) => {
        setXpToasts(prev => {
            const next = [...prev, { id: createLocalId(), branch, xp, type }];
            return next.slice(Math.max(next.length - 5, 0));
        });
    };

    const pushFollowUpToast = (title: string, category: string) => {
        setFollowUpToasts(prev => {
            const next = [...prev, { id: createLocalId(), title, category }];
            return next.slice(Math.max(next.length - 4, 0));
        });
    };

    useEffect(() => {
        if (!socialSignals.length) return;
        const timer = setTimeout(() => {
            setSocialSignals(prev => prev.slice(1));
        }, 9000);
        return () => clearTimeout(timer);
    }, [socialSignals]);

    useEffect(() => {
        if (!xpToasts.length) return;
        const timer = setTimeout(() => {
            setXpToasts(prev => prev.slice(1));
        }, 4000);
        return () => clearTimeout(timer);
    }, [xpToasts]);

    useEffect(() => {
        if (!followUpToasts.length) return;
        const timer = setTimeout(() => {
            setFollowUpToasts(prev => prev.slice(1));
        }, 6000);
        return () => clearTimeout(timer);
    }, [followUpToasts]);

    useEffect(() => {
        if (!rankCelebration) return;
        const timer = setTimeout(() => setRankCelebration(null), 6000);
        return () => clearTimeout(timer);
    }, [rankCelebration]);

    const getParticipantName = (id: string): string => {
        if (id === USER_PARTICIPANT_ID) return 'User';
        if (id === SYLVIA_PARTICIPANT_ID) return 'Seasuite';
        const performer = performers.find(p => p.id === id);
        return performer?.name || 'Collaborator';
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as ChatMessageType[];
                if (Array.isArray(parsed)) {
                    setMessages(parsed);
                }
            }
        } catch (error) {
            console.error('Failed to restore chat history:', error);
        }

        const loadRoster = async () => {
            try {
                const roster = await getAllPerformers();
                const sorted = roster.sort((a, b) => a.name.localeCompare(b.name));
                setPerformers(sorted);
                setActivePerformerIds(prev => prev.filter(id => sorted.some(p => p.id === id)));
            } catch (error) {
                console.error('Failed to load performers:', error);
            }
        };

        loadRoster();

        const handleRosterUpdate = (_event: Event) => {
            loadRoster();
        };

        window.addEventListener('performers-updated', handleRosterUpdate);
        return () => {
            window.removeEventListener('performers-updated', handleRosterUpdate);
        };
    }, []);

    useEffect(() => {
        getPlayerProgress()
            .then(progress => setPlayerProgress(progress))
            .catch(error => console.error('Failed to load player progress:', error));
        getMissionSummary()
            .then(summary => setMissionSummary(summary))
            .catch(error => console.error('Failed to load mission summary:', error));
        setIntelligenceRecords(getIntelligenceLog());
        getFollowUps()
            .then(tasks => {
                setFollowUps(tasks);
                followUpsLoadedRef.current = true;
            })
            .catch(error => console.error('Failed to load follow-ups:', error));

        const handleProgressUpdated = () => {
            getPlayerProgress().then(setPlayerProgress).catch(console.error);
            getMissionSummary().then(setMissionSummary).catch(console.error);
        };

        const handleIntelUpdate = () => {
            setIntelligenceRecords(getIntelligenceLog());
        };

        const handleFollowUpsUpdated = () => {
            getFollowUps()
                .then(latest => {
                    setFollowUps(prev => {
                        const previousIds = new Set(prev.map(task => task.id));
                        const newTasks = latest.filter(task => !previousIds.has(task.id));
                        if (followUpsLoadedRef.current && newTasks.length > 0) {
                            const highPriority = newTasks.filter(task => task.priority === 'high');
                            // Removed automatic panel opening - user can open manually via button
                            highPriority.forEach(task => pushFollowUpToast(task.title, task.category));
                        }
                        return latest;
                    });
                })
                .catch(error => console.error('Failed to refresh follow-ups:', error));
        };

        window.addEventListener('player-progress-updated', handleProgressUpdated);
        window.addEventListener('intelligence-log-updated', handleIntelUpdate);
        window.addEventListener('intelligence-record-processed', handleIntelUpdate);
        window.addEventListener('follow-ups-updated', handleFollowUpsUpdated);
        return () => {
            window.removeEventListener('player-progress-updated', handleProgressUpdated);
            window.removeEventListener('intelligence-log-updated', handleIntelUpdate);
            window.removeEventListener('intelligence-record-processed', handleIntelUpdate);
            window.removeEventListener('follow-ups-updated', handleFollowUpsUpdated);
        };
        }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window[CHAT_CACHE_KEY] = messages;
        try {
            window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages));
        } catch (error) {
            console.error('Failed to persist chat history:', error);
        }
    }, [messages]);

    const loadSavedThreads = async () => {
        setIsLoadingThreads(true);
        try {
            const threads = await getAllThreads();
            setAvailableThreads(sortThreadsByRecency(threads));
        } catch (error) {
            console.error('Failed to load saved threads:', error);
            setThreadStatus('Could not load saved threads. Check console for details.');
            setTimeout(() => setThreadStatus(null), 4000);
        } finally {
            setIsLoadingThreads(false);
        }
    };

    const togglePerformerEngagement = (performerId: string) => {
        setActivePerformerIds(prev => {
            if (prev.includes(performerId)) {
                return prev.filter(id => id !== performerId);
            }
            return [...prev, performerId];
        });
    };

    const handleDismissSocialSignal = (id: string) => {
        setSocialSignals(prev => prev.filter(alert => alert.id !== id));
    };

    const handleToggleThreadPicker = async () => {
        const next = !isThreadPickerOpen;
        setIsThreadPickerOpen(next);
        if (next) {
            await loadSavedThreads();
        }
    };

    const handleRefreshThread = () => {
        if (messages.length === 0) {
            setActiveThreadMeta(null);
            setSessionId(createSessionId());
            setActivePerformerIds([]);
            setIsCoreAgentMuted(false);
            if (typeof window !== 'undefined') {
                window[CHAT_CACHE_KEY] = [];
                try {
                    window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
                } catch (error) {
                    console.error('Failed to clear chat history cache:', error);
                }
            }
            return;
        }

        const confirmReset = window.confirm('Start a fresh thread? This will clear the current conversation.');
        if (!confirmReset) return;

        setMessages([]);
        setActivePerformerIds([]);
        setActiveThreadMeta(null);
        setSessionId(createSessionId());
        setThreadStatus('New conversation started.');
        setIsCoreAgentMuted(false);
        if (typeof window !== 'undefined') {
            window[CHAT_CACHE_KEY] = [];
            try {
                window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
            } catch (error) {
                console.error('Failed to clear chat history cache:', error);
            }
        }
        setTimeout(() => setThreadStatus(null), 3000);
    };

    const handleLoadThread = async (threadId: string) => {
        try {
            if (!availableThreads.length) {
                await loadSavedThreads();
            }

            const thread = availableThreads.find(t => t.id === threadId);
            if (!thread) {
                setThreadStatus('Selected thread could not be found.');
                setTimeout(() => setThreadStatus(null), 3000);
                return;
            }

            const hydratedMessages = Array.isArray(thread.messages)
                ? (JSON.parse(JSON.stringify(thread.messages)) as ChatMessageType[])
                : [];

            setMessages(hydratedMessages);
            setAvailableThreads(prev => sortThreadsByRecency([thread, ...prev.filter(t => t.id !== thread.id)]));
            setActiveThreadMeta({
                id: thread.id,
                title: thread.title || 'Conversation Thread'
            });
            setSessionId(thread.id);
            setThreadStatus(`Loaded "${thread.title || 'Conversation Thread'}".`);
            setIsThreadPickerOpen(false);
            setActivePerformerIds([]);
            setIsCoreAgentMuted(false);
            setTimeout(() => setThreadStatus(null), 3000);
        } catch (error) {
            console.error('Failed to load selected thread:', error);
            setThreadStatus('Could not load selected thread. Check console for details.');
            setTimeout(() => setThreadStatus(null), 4000);
        }
    };

    const handleUpdateFollowUpStatus = async (id: string, status: FollowUpStatus) => {
        try {
            await updateFollowUp(id, { status });
            setFollowUps(prev =>
                prev.map(task =>
                    task.id === id ? { ...task, status, updatedAt: Date.now() } : task
                )
            );
        } catch (error) {
            console.error('Failed to update follow-up status:', error);
        }
    };

    const handleSendMessage = async (message: string, features: ActiveFeatures, image: File | null, speakerPersonaId: string | null) => {
        if (!message && !image) return;

        setIsLoading(true);

        const now = Date.now();
        const userMessageId = now.toString();
        let userImagePreview: string | undefined;
        let imageBase64: string | null = null;
        let processedMessage = message;
        let rewriteStatus: 'rewritten' | undefined;

        if (image) {
            imageBase64 = await fileToBase64(image);
            const mime = image.type || 'image/jpeg';
            userImagePreview = `data:${mime};base64,${imageBase64}`;
        }

        if (features.usePromptRewrite && message.trim()) {
            try {
                processedMessage = await rewriteUserPrompt(message);
                if (processedMessage.trim() !== message.trim()) {
                    rewriteStatus = 'rewritten';
                }
            } catch (error) {
                console.error('Prompt rewrite failed:', error);
                processedMessage = message;
            }
        }

        const conversationId = activeThreadMeta?.id ?? sessionId;
        const speakerPersona = speakerPersonaId ? performers.find(p => p.id === speakerPersonaId) : null;
        const userMessage: ChatMessageType = {
            id: userMessageId,
            role: 'user',
            content: message,
            image: userImagePreview,
            rewrittenContent: rewriteStatus === 'rewritten' ? processedMessage : undefined,
            rewriteStatus,
            timestamp: now,
            conversationId,
            speakerPersonaId: speakerPersona?.id ?? null,
            speakerPersonaName: speakerPersona?.name ?? null
        };
        setMessages(prev => [...prev, userMessage]);

        try {
            const latestEntries = await getAllJournalEntries();
            const performerMap = new Map(performers.map(p => [p.id, p]));
            const engagedPerformers = activePerformerIds
                .filter(id => !speakerPersona || id !== speakerPersona.id)
                .map(id => performers.find(p => p.id === id))
                .filter((p): p is PerformerProfile => Boolean(p));

            const deliveredUserContent = rewriteStatus === 'rewritten' ? processedMessage : message;

            const modelFacingUserMessage: ChatMessageType = speakerPersona
                ? {
                    ...userMessage,
                    role: 'agent',
                    performerId: speakerPersona.id,
                    performerName: speakerPersona.name,
                    performerIcon: speakerPersona.icon,
                    speakerPersonaId: null,
                    speakerPersonaName: null
                }
                : userMessage;

            const historyForModel: ChatMessageType[] = [...messages, modelFacingUserMessage];
            const [allMemories, tagScores] = await Promise.all([
                getAllMemories(),
                getTagScores()
            ]);

            const keywordSet = buildKeywordSet(processedMessage, historyForModel);
            const tagWeightMap = new Map<string, number>(
                tagScores.map(tag => [tag.tag.toLowerCase(), Math.max(tag.memoryCount, 1)])
            );

            const keywordTags = Array.from(keywordSet).filter(tag => tagWeightMap.has(tag));
            keywordTags.sort((a, b) => (tagWeightMap.get(b) ?? 0) - (tagWeightMap.get(a) ?? 0));
            const prioritizedFromKeywords = keywordTags.slice(0, 10);

            const fallbackTarget = Math.max(0, 5 - prioritizedFromKeywords.length);
            const fallbackTags = fallbackTarget > 0
                ? [...tagScores]
                    .sort((a, b) => b.memoryCount - a.memoryCount)
                    .map(entry => entry.tag.toLowerCase())
                    .filter(tag => !prioritizedFromKeywords.includes(tag))
                    .slice(0, fallbackTarget)
                : [];

            const prioritizedTags = Array.from(new Set([...prioritizedFromKeywords, ...fallbackTags]))
                .slice(0, 10);
            const prioritizedTagSet = new Set(prioritizedTags);
            setContextTags(prioritizedTags.map(tag => ({ tag, weight: tagWeightMap.get(tag) ?? 0 })));

            // Score all memories
            const scoredMemories = allMemories
                .map(memory => ({
                    memory,
                    score: scoreMemoryForContext(memory, keywordSet, tagWeightMap, prioritizedTagSet)
                }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score);

            // Separate memories: those with matching tags vs others
            const taggedPriorityMemories = scoredMemories.filter(item =>
                item.memory.tags.some(tag => prioritizedTagSet.has(tag.toLowerCase()))
            );

            const remainingMemories = scoredMemories.filter(item =>
                !item.memory.tags.some(tag => prioritizedTagSet.has(tag.toLowerCase()))
            );

            // CRITICAL: Include ALL memories that match user's words/tags
            // Only limit the "remaining" memories that don't match tags (for diversity)
            const orderedContext = [
                ...taggedPriorityMemories.map(item => item.memory), // ALL matching tag memories
                ...remainingMemories.slice(0, 10).map(item => item.memory) // Top 10 non-matching for diversity
            ];

            const uniqueContext = Array.from(
                new Map(orderedContext.map(memory => [(memory.id ?? memory.timestamp).toString(), memory])).values()
            );
            // No hard limit - include all unique matching memories
            const contextForPrompt = uniqueContext;
            setContextMemories(contextForPrompt);

            const performerMessages: ChatMessageType[] = [];
            const interactionEvents: PerformerInteractionEvent[] = [];

            const createEventId = () => `interaction-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

            const addEvent = (event: PerformerInteractionEvent | null) => {
                if (!event) return;
                if (!event.targetIds.length) return;
                interactionEvents.push(event);
                const signals = generateSocialSignals(event, performerMap);
                if (signals.length) {
                    setSocialSignals(prev => {
                        const merged = [...prev, ...signals];
                        return merged.slice(Math.max(merged.length - 8, 0));
                    });
                }

                const involvesUser =
                    event.speakerId === USER_PARTICIPANT_ID ||
                    event.targetIds.includes(USER_PARTICIPANT_ID) ||
                    (speakerPersona && event.speakerId === speakerPersona.id) ||
                    (speakerPersona && event.targetIds.includes(speakerPersona.id));

                if (involvesUser) {
                    const baseMagnitude = Math.abs(event.sentiment ?? 0);
                    const intrigueBoost = event.intrigueTags?.length ? 0.4 : 0;
                    const narrativeBoost = event.narrativeTags?.includes('mission') ? 0.2 : 0;
                    const baseXp = Math.max(15, Math.round(60 * (baseMagnitude + intrigueBoost + narrativeBoost)));
                    const branch: SkillBranchId = event.context === 'private' ? 'diplomacy' : 'social_engineering';
                    let type: ExperienceEventType = 'pressure_created';
                    if (event.context === 'private') {
                        type = event.intrigueTags?.length ? 'secret_shared' : 'secret_uncovered';
                    } else if ((event.sentiment ?? 0) >= 0) {
                        type = 'pressure_diffused';
                    }

                    const previousRankId = playerProgress?.rankId;
                    awardExperience({
                        branch,
                        type,
                        baseXp,
                        actorIds: [event.speakerId, ...event.targetIds],
                        context: event.context,
                        metadata: {
                            messageId: event.messageId,
                            intrigueTags: event.intrigueTags,
                            narrativeTags: event.narrativeTags
                        }
                    })
                        .then(({ progress, gainedXp, event, missionRewards, missionUpdates }) => {
                            setPlayerProgress(progress);
                            pushXpToast(event.branch, gainedXp, event.type);
                            missionRewards.forEach(reward => {
                                pushXpToast(reward.branch, reward.xp, reward.type as ExperienceEventType);
                            });
                            if (missionUpdates.length > 0) {
                                const missionUpdate = missionUpdates[0];
                                setMessages(prev => prev.map(msg => msg.id === userMessageId ? {
                                    ...msg,
                                    metadata: {
                                        ...msg.metadata,
                                        mission: missionUpdate
                                    }
                                } : msg));
                                // Removed automatic sidebar opening - user can open manually via button
                            }
                            if (previousRankId && previousRankId !== progress.rankId) {
                                const rank = getRankForXp(progress.totalXp);
                                setRankCelebration({ title: rank.title, xp: progress.totalXp });
                            }
                            getMissionSummary().then(setMissionSummary).catch(error => console.error('Failed to refresh mission summary:', error));
                        })
                        .catch(error => console.error('Failed to award experience:', error));
                }
            };

            const baseTargets = new Set<string>();
            engagedPerformers.forEach(p => baseTargets.add(p.id));
            if (!isCoreAgentMuted) {
                baseTargets.add(SYLVIA_PARTICIPANT_ID);
            }
            if (speakerPersona) {
                baseTargets.add(speakerPersona.id);
            }

            const userSpeakerId = speakerPersona?.id ?? USER_PARTICIPANT_ID;
            const userSpeakerType: 'user' | 'performer' = speakerPersona ? 'performer' : 'user';
            const userTargets = new Set<string>(baseTargets);
            if (speakerPersonaId) {
                userTargets.add(USER_PARTICIPANT_ID);
            }
            userTargets.delete(userSpeakerId);

            const userSentiment = calculateSentimentScore(processedMessage);
            const userNarrativeTags = detectNarrativeTags(processedMessage);
            if (speakerPersonaId) {
                userNarrativeTags.push('roleplay');
            }
            const userIntrigueTags = collectIntrigueTags(speakerPersona ?? null, Array.from(userTargets), performerMap);
            if (userIntrigueTags.length) {
                userNarrativeTags.push('intrigue');
            }

            addEvent({
                id: createEventId(),
                conversationId,
                speakerId: userSpeakerId,
                speakerName: speakerPersona?.name || 'User',
                speakerType: userSpeakerType,
                targetIds: Array.from(userTargets),
                targetNames: Array.from(userTargets).map(getParticipantName),
                timestamp: now,
                messageId: userMessageId,
                sentiment: userSentiment,
                narrativeTags: Array.from(new Set(userNarrativeTags)),
                intrigueTags: userIntrigueTags,
                context: 'public',
                origin: 'chat'
            });

            for (const performer of engagedPerformers) {
                const performerFeatures = applyPerformerOverrides(features, performer);
                let performerParts: ChatMessageType['agentResponseParts'] | null = null;
                try {
                    performerParts = await generatePerformerResponse(
                        performer,
                        processedMessage,
                        historyForModel,
                        performerFeatures,
                        imageBase64,
                        {
                            temporalEntries: latestEntries,
                            contextMemories: contextForPrompt
                        }
                    );
                } catch (performerError) {
                    console.error('Performer response failed:', performerError);
                }

                if (!performerParts) continue;

                const performerTimestamp = Date.now();
                const performerMessage: ChatMessageType = {
                    id: `${performerTimestamp}-performer-${performer.id}`,
                    role: 'agent',
                    content: performerParts.response || `${performer.name} is still formulating ideas.`,
                    agentResponseParts: performerParts,
                    performerId: performer.id,
                    performerName: performer.name,
                    performerIcon: performer.icon,
                    timestamp: performerTimestamp,
                    collaborators: isCoreAgentMuted ? undefined : ['Seasuite'],
                    conversationId
                };

                performerMessages.push(performerMessage);
                setMessages(prev => [...prev, performerMessage]);
                historyForModel.push(performerMessage);

                if (performerParts.memory && performer.memoryEnabled !== false && performerFeatures.useMemory) {
                    try {
                        await addPerformerMemory({
                            performerId: performer.id,
                            timestamp: performerTimestamp,
                            summary: performerParts.memory.summary,
                            tags: performerParts.memory.tags,
                            transcriptSnippet: [
                                speakerPersonaNameOrYou(speakerPersona, deliveredUserContent),
                                `${performer.name}: ${performerParts.response || ''}`
                            ].join('\n\n'),
                            relevance: 5,
                            conversationId
                        });
                    } catch (memoryError) {
                        console.error('Failed to capture performer memory:', memoryError);
                    }
                }

                const performerTargets = new Set<string>([USER_PARTICIPANT_ID, ...engagedPerformers.map(p => p.id)]);
                if (speakerPersona) {
                    performerTargets.add(speakerPersona.id);
                }
                performerTargets.delete(performer.id);
                if (!isCoreAgentMuted) {
                    performerTargets.add(SYLVIA_PARTICIPANT_ID);
                }
                const performerContent = performerParts.response || '';
                const performerNarrativeTags = detectNarrativeTags(performerContent);
                const performerIntrigueTags = collectIntrigueTags(performer, Array.from(performerTargets), performerMap);
                if (performerIntrigueTags.length) {
                    performerNarrativeTags.push('intrigue');
                }
                addEvent({
                    id: createEventId(),
                    conversationId,
                    speakerId: performer.id,
                    speakerName: performer.name,
                    speakerType: 'performer',
                    targetIds: Array.from(performerTargets),
                    targetNames: Array.from(performerTargets).map(getParticipantName),
                    timestamp: performerTimestamp,
                    messageId: performerMessage.id,
                    sentiment: calculateSentimentScore(performerContent),
                    narrativeTags: Array.from(new Set(performerNarrativeTags)),
                    intrigueTags: performerIntrigueTags,
                    context: 'public',
                    origin: 'chat'
                });
            }

            let agentResponseParts: ChatMessageType['agentResponseParts'] | null = null;
            if (!isCoreAgentMuted) {
                agentResponseParts = await generateAgentResponse(processedMessage, historyForModel, features, imageBase64, {
                    temporalEntries: latestEntries,
                    contextMemories: contextForPrompt
                });
            }

            const agentTimestamp = Date.now();
            if (agentResponseParts?.memory && features.useMemory) {
                try {
                    const conversationSlices: string[] = [speakerPersonaNameOrYou(speakerPersona, deliveredUserContent)];
                    performerMessages.forEach(resp => {
                        conversationSlices.push(`${resp.performerName || 'Performer'}: ${resp.content}`);
                    });
                    conversationSlices.push(`Seasuite: ${agentResponseParts.response || ''}`);
                    const memoryId = await addMemory({
                        timestamp: agentTimestamp,
                        relevance: 5,
                        conversation: conversationSlices.join('\n\n'),
                        summary: agentResponseParts.memory.summary,
                        tags: agentResponseParts.memory.tags,
                        knowledgeRefs: performerMessages.map(resp => resp.performerId).filter((id): id is string => Boolean(id)),
                        metaTags: buildMemoryMetaTags(conversationId, performerMessages[0]?.performerId ?? null, features)
                    });

                    // Automatically process memory in the background to extract intelligence
                    if (memoryId) {
                        processMemoryInBackground(memoryId).catch(error => {
                            console.error('Background memory processing failed:', error);
                            showToast(
                                `Memory processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                'error',
                                5000
                            );
                        });
                    }
                } catch (memoryError) {
                    console.error('Failed to capture agent memory:', memoryError);
                }
            }

            let agentMessage: ChatMessageType | null = null;
            if (agentResponseParts) {
                agentMessage = {
                    id: agentTimestamp.toString(),
                    role: 'agent',
                    content: agentResponseParts.response || "I don't have a response for that.",
                    agentResponseParts,
                    performerId: null,
                    performerName: 'Seasuite',
                    timestamp: agentTimestamp,
                    collaborators: performerMessages.length ? performerMessages.map(msg => msg.performerName || 'Performer') : undefined,
                    conversationId
                };
                setMessages(prev => [...prev, agentMessage]);

                const sylviaTargets = new Set<string>([USER_PARTICIPANT_ID, ...engagedPerformers.map(p => p.id)]);
                if (speakerPersona) {
                    sylviaTargets.add(speakerPersona.id);
                }
                const sylviaContent = agentResponseParts.response || '';
                const sylviaNarrativeTags = detectNarrativeTags(sylviaContent);
                const sylviaIntrigueTags = collectIntrigueTags(null, Array.from(sylviaTargets), performerMap);
                if (sylviaIntrigueTags.length) {
                    sylviaNarrativeTags.push('intrigue');
                }
                addEvent({
                    id: createEventId(),
                    conversationId,
                    speakerId: SYLVIA_PARTICIPANT_ID,
                    speakerName: 'Seasuite',
                    speakerType: 'sylvia',
                    targetIds: Array.from(sylviaTargets),
                    targetNames: Array.from(sylviaTargets).map(getParticipantName),
                    timestamp: agentTimestamp,
                    messageId: agentMessage.id,
                    sentiment: calculateSentimentScore(sylviaContent),
                    narrativeTags: Array.from(new Set(sylviaNarrativeTags)),
                    intrigueTags: sylviaIntrigueTags,
                    context: 'public',
                    origin: 'chat'
                });

                // Analyze relationship dynamics for agent response
                if (agentResponseParts.response && agentMessage) {
                    try {
                        const sylviaTargetsForAnalysis = new Set<string>([USER_PARTICIPANT_ID, ...engagedPerformers.map(p => p.id)]);
                        if (speakerPersona) {
                            sylviaTargetsForAnalysis.add(speakerPersona.id);
                        }
                        const analysis = await analyzeRelationshipDynamics(
                            agentResponseParts.response,
                            SYLVIA_PARTICIPANT_ID,
                            Array.from(sylviaTargetsForAnalysis),
                            conversationId,
                            agentMessage.id
                        );
                        if (analysis) {
                            await applyRelationshipAnalysis(analysis, conversationId, agentMessage.id);
                            if (analysis.drama.length > 0) {
                                analysis.drama.forEach(d => {
                                    setDramaNotifications(prev => [...prev, {
                                        id: `drama_${Date.now()}_${Math.random()}`,
                                        type: d.type,
                                        participants: d.participants,
                                        description: d.description,
                                        intensity: d.intensity,
                                        timestamp: Date.now(),
                                        conversationId,
                                        messageId: agentMessage!.id
                                    }]);
                                });
                            }
                        }
                    } catch (relationshipError) {
                        console.error('Failed to analyze relationships:', relationshipError);
                    }
                }
            }

            if (interactionEvents.length) {
                try {
                    await addPerformerInteractionEvents(interactionEvents);
                } catch (interactionError) {
                    console.error('Failed to log performer interactions:', interactionError);
                }
            }

            // Analyze relationship dynamics for performer responses
            for (const perfMsg of performerMessages) {
                if (perfMsg.content && perfMsg.performerId) {
                    try {
                        const targets = perfMsg.collaborators?.map(name => {
                            if (name === 'User') return USER_PARTICIPANT_ID;
                            if (name === 'Seasuite') return SYLVIA_PARTICIPANT_ID;
                            return performers.find(p => p.name === name)?.id || '';
                        }).filter(Boolean) || [];
                        
                        const analysis = await analyzeRelationshipDynamics(
                            perfMsg.content,
                            perfMsg.performerId,
                            targets,
                            conversationId,
                            perfMsg.id
                        );
                        if (analysis) {
                            await applyRelationshipAnalysis(analysis, conversationId, perfMsg.id);
                            if (analysis.drama.length > 0) {
                                analysis.drama.forEach(d => {
                                    setDramaNotifications(prev => [...prev, {
                                        id: `drama_${Date.now()}_${Math.random()}`,
                                        type: d.type,
                                        participants: d.participants,
                                        description: d.description,
                                        intensity: d.intensity,
                                        timestamp: Date.now(),
                                        conversationId,
                                        messageId: perfMsg.id
                                    }]);
                                });
                            }
                        }
                    } catch (relationshipError) {
                        console.error('Failed to analyze performer relationships:', relationshipError);
                    }
                }
            }

        } catch (error) {
            console.error("Failed to get agent response:", error);
            const errorMessage: ChatMessageType = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: "Sorry, I ran into an issue. Please try again.",
                timestamp: Date.now(),
                conversationId
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveConversation = async () => {
        if (isSavingThread) return;
        if (messages.length === 0) {
            setThreadStatus('Start a conversation before archiving.');
            setTimeout(() => setThreadStatus(null), 2500);
            return;
        }

        setIsSavingThread(true);
        try {
            const summary = await summarizeConversationForThread(messages);
            const now = Date.now();
            const journalDate = format(new Date(), 'yyyy-MM-dd');
            const storedMessages = JSON.parse(JSON.stringify(messages)) as ChatMessageType[];

            const thread: ConversationThread = {
                id: `thread-${now}`,
                title: summary.title || `Conversation ${format(new Date(), 'MMM d, yyyy')}`,
                summary: summary.summary,
                tags: summary.tags,
                createdAt: now,
                updatedAt: now,
                journalDate,
                journalNote: summary.journalNote,
                messages: storedMessages
            };

            await saveThread(thread);
            setAvailableThreads(prev => {
                const filtered = prev.filter(t => t.id !== thread.id);
                return [thread, ...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
            });
            setActiveThreadMeta({ id: thread.id, title: thread.title });
            setSessionId(thread.id);

            try {
                const existing = await getJournalEntry(journalDate);
                const entryBody = summary.journalNote || summary.summary || 'Conversation saved.';
                const header = `Conversation: ${thread.title}`;
                const content = existing?.content
                    ? `${existing.content.trim()}\n\n${header}\n${entryBody}`
                    : `${header}\n${entryBody}`;

                await upsertJournalEntry({
                    date: journalDate,
                    content
                });
            } catch (journalError) {
                console.error('Failed to sync conversation to journal:', journalError);
            }

            setThreadStatus('Conversation archived. Review it on the Threads page.');
        } catch (error) {
            console.error('Failed to save conversation thread:', error);
            setThreadStatus('Could not archive this conversation. Check console for details.');
        } finally {
            setIsSavingThread(false);
            setTimeout(() => setThreadStatus(null), 4000);
        }
    };

    const missionCount = missionSummary?.active.length ?? 0;
    const intelligenceCount = intelligenceRecords.length;
    const activeFollowUps = followUps.filter(task => task.status !== 'completed').length;

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {missionSummary && isMissionSidebarOpen && (
                <MissionSidebar
                    missions={missionSummary.active}
                    branchXp={missionSummary.branchXp}
                    onClose={() => setIsMissionSidebarOpen(false)}
                />
            )}
            {isIntelligenceFeedOpen && (
                <IntelligenceFeed
                    records={intelligenceRecords}
                    onClose={() => setIsIntelligenceFeedOpen(false)}
                />
            )}
            {isFollowUpPanelOpen && (
                <FollowUpPanel
                    followUps={followUps}
                    onClose={() => setIsFollowUpPanelOpen(false)}
                    onUpdateStatus={handleUpdateFollowUpStatus}
                />
            )}
            {/* Drama Notifications */}
            {socialSignals.map(signal => (
                <SocialAlert
                    key={signal.id}
                    signal={signal}
                    onDismiss={() => handleDismissSocialSignal(signal.id)}
                />
            ))}
            {dramaNotifications.map(event => (
                <DramaNotification
                    key={event.id}
                    event={event}
                    onDismiss={() => setDramaNotifications(prev => prev.filter(e => e.id !== event.id))}
                />
            ))}
            {rankCelebration && (
                <div className="pointer-events-none fixed inset-x-0 top-20 z-30 mx-auto flex max-w-md items-center justify-center">
                    <div className="w-full rounded-2xl border border-yellow-500/50 bg-yellow-500/10 px-6 py-4 text-center shadow-lg shadow-yellow-500/20">
                        <div className="text-xs uppercase tracking-[0.3em] text-yellow-200">Rank Up</div>
                        <div className="mt-2 text-xl font-semibold text-yellow-100">{rankCelebration.title}</div>
                        <div className="mt-1 text-xs text-yellow-300">Total XP {rankCelebration.xp}</div>
                    </div>
                </div>
            )}
            {xpToasts.length > 0 && (
                <div className="pointer-events-none fixed right-6 top-32 z-30 flex flex-col gap-2">
                    {xpToasts.map(toast => (
                        <div
                            key={toast.id}
                            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-100 shadow-md shadow-blue-500/20"
                        >
                            +{toast.xp} XP • {toast.type === 'mission_reward' ? 'Mission Reward' : toast.type.replace(/_/g, ' ')}
                            <div className="text-[11px] text-blue-200/80">{SKILL_BRANCHES[toast.branch].title}</div>
                        </div>
                    ))}
                </div>
            )}
            {followUpToasts.length > 0 && (
                <div className="pointer-events-none fixed right-6 top-60 z-30 flex flex-col gap-2">
                    {followUpToasts.map(toast => (
                        <div
                            key={toast.id}
                            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 shadow-md shadow-amber-500/20"
                        >
                            <div className="text-xs uppercase tracking-[0.3em] text-amber-200">High Priority Follow-Up</div>
                            <div className="mt-1 text-sm font-semibold text-amber-100">{toast.title}</div>
                            <div className="text-[11px] text-amber-200/80">Category: {toast.category}</div>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="sticky top-0 z-10 bg-[#26282B] border-b border-gray-700/50 px-3 md:px-6 py-3 md:py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-gray-500">
                            <span>Thread Controls</span>
                            {activeThreadMeta && (
                                <span className="text-gray-300 normal-case tracking-normal">
                                    Viewing: {activeThreadMeta.title}
                                </span>
                            )}
                            {threadStatus && (
                                <span className="text-blue-300 normal-case tracking-normal">{threadStatus}</span>
                            )}
                            {currentRank && (
                                <span className="ml-2 flex items-center gap-2 text-[11px] font-medium text-gray-400 normal-case">
                                    Rank
                                    <span
                                        className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-blue-200"
                                    >
                                        {currentRank.title}
                                    </span>
                                    <span className="text-gray-500">{playerProgress?.totalXp ?? 0} XP</span>
                                </span>
                            )}
                        </div>
                        <div className="relative flex flex-wrap items-center gap-1.5 md:gap-2">
                            <button
                                onClick={() => setIsMissionSidebarOpen(prev => !prev)}
                                className={`rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-semibold transition-colors ${
                                    missionSummary && missionCount > 0
                                        ? 'bg-blue-600/80 text-white hover:bg-blue-600'
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                }`}
                            >
                                <span className="hidden sm:inline">Missions</span>
                                <span className="sm:hidden">M</span>
                                {missionSummary && missionCount > 0 ? ` (${missionCount})` : ''}
                            </button>
                            <button
                                onClick={() => setIsIntelligenceFeedOpen(prev => !prev)}
                                className={`rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-semibold transition-colors ${
                                    intelligenceCount > 0
                                        ? 'bg-purple-600/80 text-white hover:bg-purple-600'
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                }`}
                            >
                                <span className="hidden sm:inline">Intel</span>
                                <span className="sm:hidden">I</span>
                                {intelligenceCount > 0 ? ` (${intelligenceCount})` : ''}
                            </button>
                            <button
                                onClick={() => setIsFollowUpPanelOpen(prev => !prev)}
                                className={`rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-semibold transition-colors ${
                                    activeFollowUps > 0
                                        ? 'bg-amber-600/80 text-white hover:bg-amber-600'
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                }`}
                            >
                                <span className="hidden sm:inline">Follow-Ups</span>
                                <span className="sm:hidden">F</span>
                                {activeFollowUps > 0 ? ` (${activeFollowUps})` : ''}
                            </button>
                            <button
                                onClick={handleRefreshThread}
                                className="px-2 md:px-3 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200"
                            >
                                <span className="hidden sm:inline">New Conversation</span>
                                <span className="sm:hidden">New</span>
                            </button>
                            <button
                                onClick={() => setIsContextPanelOpen(prev => !prev)}
                                disabled={contextMemories.length === 0 && !isContextPanelOpen}
                                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors ${
                                    contextMemories.length === 0 && !isContextPanelOpen
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : isContextPanelOpen
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                }`}
                            >
                                {contextMemories.length > 0 ? `Context (${contextMemories.length})` : 'Context'}
                            </button>
                            <button
                                onClick={handleToggleThreadPicker}
                                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors ${
                                    isThreadPickerOpen ? 'bg-purple-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                }`}
                            >
                                <span className="hidden sm:inline">{isThreadPickerOpen ? 'Close Saved Threads' : 'Open Saved Threads'}</span>
                                <span className="sm:hidden">Threads</span>
                            </button>
                            <button
                                onClick={handleSaveConversation}
                                disabled={isSavingThread || messages.length === 0}
                                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-colors ${
                                    messages.length === 0
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                                } ${isSavingThread ? 'opacity-80 cursor-wait' : ''}`}
                            >
                                {isSavingThread ? 'Archiving…' : 'Archive Conversation'}
                            </button>
                            {isThreadPickerOpen && (
                                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-h-80 overflow-y-auto bg-[#1b1d1f] border border-gray-700 rounded-lg shadow-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-gray-200">Saved Threads</h3>
                                        <button
                                            onClick={() => setIsThreadPickerOpen(false)}
                                            className="text-xs text-gray-400 hover:text-gray-200"
                                        >
                                            Close
                                        </button>
                                    </div>
                                    {isLoadingThreads ? (
                                        <div className="text-sm text-gray-400 py-6 text-center">Loading saved conversations…</div>
                                    ) : availableThreads.length === 0 ? (
                                        <div className="text-sm text-gray-500 py-6 text-center">
                                            No archived threads yet. Archive a conversation to revisit it here.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {availableThreads.map(thread => (
                                                <button
                                                    key={thread.id}
                                                    onClick={() => handleLoadThread(thread.id)}
                                                    className="w-full text-left bg-[#232527] hover:bg-[#2b2d30] border border-gray-700/70 rounded-md p-3 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-semibold text-gray-100">
                                                            {thread.title || 'Conversation Thread'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {format(new Date(thread.updatedAt || thread.createdAt), 'MMM d, yyyy h:mm a')}
                                                        </span>
                                                    </div>
                                                    {thread.summary && (
                                                        <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                                                            {thread.summary.slice(0, 180)}
                                                            {thread.summary.length > 180 ? '…' : ''}
                                                        </p>
                                                    )}
                                                    {thread.tags && thread.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {thread.tags.slice(0, 4).map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="text-[10px] uppercase tracking-wide bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {isContextPanelOpen && (
                        <div className="mt-3 bg-[#1b1d1f] border border-emerald-700/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-emerald-200 uppercase tracking-wider">Injected Context Memories</h3>
                                <span className="text-xs text-gray-500">glass box mode</span>
                            </div>
                            {contextTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-emerald-200">
                                    {contextTags.map(({ tag, weight }) => (
                                        <span key={tag} className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1">
                                            #{tag} · {weight}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {contextMemories.length === 0 ? (
                                <p className="text-xs text-gray-400">No contextual memories were pulled for this turn.</p>
                            ) : (
                                <ul className="space-y-3 text-sm text-gray-200">
                                    {contextMemories.map(memory => (
                                        <li key={memory.id ?? memory.timestamp} className="border border-emerald-500/30 rounded-md p-3 bg-[#111315]">
                                            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                                <span>{new Date(memory.timestamp).toLocaleString()}</span>
                                                <span className="text-emerald-300 font-semibold">Relevance {memory.relevance}</span>
                                            </div>
                                            <div className="text-gray-100 text-sm font-semibold mb-1">{memory.summary}</div>
                                            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-emerald-200">
                                                {memory.tags.map(tag => (
                                                    <a
                                                        key={`${memory.id}-${tag}`}
                                                        href={`#/graph?tag=${encodeURIComponent(tag)}`}
                                                        className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full hover:bg-emerald-500/20"
                                                    >
                                                        #{tag}
                                                    </a>
                                                ))}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
                {messages.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 animate-in fade-in duration-500">
                        <div className="flex items-center justify-center gap-3 text-3xl font-bold text-gray-300 mb-2">
                            <BirdIcon className="w-9 h-9 animate-pulse" />
                            <h1 className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                              Seasuite
                            </h1>
                        </div>
                        <p className="mt-2 text-gray-400">Start a conversation below.</p>
                        <div className="flex flex-wrap gap-2 mt-8 justify-center">
                           <SuggestionChip text="Explain quantum computing in simple terms" hasIcon />
                           <SuggestionChip text="What are some tips for better sleep?" />
                           <SuggestionChip text="Draft an email to my team about the project update" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 md:space-y-4 px-2 md:px-0">
                        {messages.map((msg, index) => (
                            <div
                                key={msg.id}
                                className="animate-in fade-in slide-in-from-bottom-2"
                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                            >
                                <ChatMessage message={msg} />
                            </div>
                        ))}
                    </div>
                )}

                {isLoading && messages.length > 0 && (
                    <div className="flex items-center gap-4 p-4 animate-in fade-in">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse shadow-lg shadow-blue-500/30">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="h-3 bg-gray-700/50 rounded-md animate-pulse w-3/4"></div>
                            <div className="h-3 bg-gray-700/50 rounded-md animate-pulse w-1/2"></div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            <div className="flex-shrink-0">
                <EscortToolbar
                    messages={messages}
                    onEscortResult={(result, escortName) => {
                        const resultId = `escort_${result.timestamp}`;
                        setEscortResults(prev => new Map(prev).set(resultId, { result, escortName }));
                        // Add as a system message for display
                        const escortMessage: ChatMessageType = {
                            id: resultId,
                            role: 'agent',
                            content: `**${escortName} Analysis**\n\n${result.result}`,
                            timestamp: result.timestamp,
                            metadata: { escortResult: result, escortName }
                        };
                        setMessages(prev => [...prev, escortMessage]);
                    }}
                />
                <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    performers={performers}
                    activePerformerIds={activePerformerIds}
                    onTogglePerformer={togglePerformerEngagement}
                    isCoreAgentMuted={isCoreAgentMuted}
                    onToggleCoreAgent={() => setIsCoreAgentMuted(prev => !prev)}
                    unlockedToggleFeatures={unlockedToggleFeatures}
                />
            </div>
        </div>
    );
};

export default ChatPage;
