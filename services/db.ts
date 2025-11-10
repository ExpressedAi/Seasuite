
import Dexie, { Table } from 'dexie';
import { Memory, JournalEntry, KnowledgeEntity, ConversationThread, HrmrRating, PerformerProfile, PerformerMemory, PerformerInteractionEvent, PerformerInteractionSummary, TagScore, BrandIntelligence, ClientProfile, PerformerRelationship, PerformerSecret, DramaEvent, CoordinationPlan, PrivateConversation, PlayerProgress, ExperienceEvent, IntelligenceFollowUp } from '../types';
import { withDefaultTraits } from './socialModel';

export class JITAgentDB extends Dexie {
    memories!: Table<Memory, number>;
    journal!: Table<JournalEntry, string>;
    knowledge!: Table<KnowledgeEntity, string>;
    threads!: Table<ConversationThread, string>;
    hrmr!: Table<HrmrRating, string>;
    performers!: Table<PerformerProfile, string>;
    performerMemories!: Table<PerformerMemory, number>;
    performerInteractions!: Table<PerformerInteractionEvent, string>;
    tagScores!: Table<TagScore, string>;
    brandIntelligence!: Table<BrandIntelligence, number>;
    clientProfiles!: Table<ClientProfile, string>;
    relationships!: Table<PerformerRelationship, string>;
    secrets!: Table<PerformerSecret, string>;
    dramaEvents!: Table<DramaEvent, string>;
    coordinationPlans!: Table<CoordinationPlan, string>;
    privateConversations!: Table<PrivateConversation, string>;
    playerProgress!: Table<PlayerProgress, string>;
    experienceEvents!: Table<ExperienceEvent, string>;
    followUps!: Table<IntelligenceFollowUp, string>;

    constructor() {
        super('JITAgentDB');
        // FIX: Cast `this` to Dexie to resolve an issue where TypeScript may not correctly infer inherited methods on a subclass during construction.
        (this as Dexie).version(1).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name'
        });

        (this as Dexie).version(2).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name',
            threads: 'id, updatedAt, createdAt'
        });

        (this as Dexie).version(3).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt'
        });

        (this as Dexie).version(4).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name'
        });

        (this as Dexie).version(5).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp'
        }).upgrade(async (transaction) => {
            await transaction.table('knowledge').toCollection().modify((entity: any) => {
                const enriched = enrichKnowledgeEntity(entity as KnowledgeEntity, entity as KnowledgeEntity);
                Object.assign(entity, enriched);
            });

            await transaction.table('memories').toCollection().modify((memory: any) => {
                const normalized = normalizeMemory(memory as Memory);
                Object.assign(memory, normalized);
            });

            await transaction.table('performers').toCollection().modify((performer: any) => {
                if (typeof performer.memoryEnabled === 'undefined') {
                    performer.memoryEnabled = true;
                }
                if (typeof performer.featureOverrides === 'undefined') {
                    performer.featureOverrides = {
                        usePreflection: true,
                        useMemory: true,
                        useTaskList: false,
                        useAudit: false,
                        useStageDirections: false,
                        useMonologue: false,
                        usePromptRewrite: false
                    };
                }
            });
        });

        (this as Dexie).version(6).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp',
            performerInteractions: 'id, conversationId, speakerId, timestamp'
        }).upgrade(async (transaction) => {
            await transaction.table('performers').toCollection().modify((performer: any) => {
                if (typeof performer.featureOverrides === 'undefined') {
                    performer.featureOverrides = {
                        usePreflection: true,
                        useMemory: true,
                        useTaskList: false,
                        useAudit: false,
                        useStageDirections: false,
                        useMonologue: false,
                        usePromptRewrite: false
                    };
                }
            });
        });

        (this as Dexie).version(7).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp',
            performerInteractions: 'id, conversationId, speakerId, timestamp',
            tagScores: 'tag'
        });

        (this as Dexie).version(8).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp',
            performerInteractions: 'id, conversationId, speakerId, timestamp',
            tagScores: 'tag',
            brandIntelligence: '++id',
            clientProfiles: 'id, name, updatedAt'
        });

        (this as Dexie).version(9).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp',
            performerInteractions: 'id, conversationId, speakerId, timestamp',
            tagScores: 'tag',
            brandIntelligence: '++id',
            clientProfiles: 'id, name, updatedAt',
            relationships: 'id, performerId, targetId, type, updatedAt',
            secrets: 'id, performerId, type, createdAt',
            dramaEvents: 'id, timestamp, conversationId',
            coordinationPlans: 'id, initiatorId, status, updatedAt'
        });

        (this as Dexie).version(10).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp',
            performerInteractions: 'id, conversationId, speakerId, timestamp',
            tagScores: 'tag',
            brandIntelligence: '++id',
            clientProfiles: 'id, name, updatedAt',
            relationships: 'id, performerId, targetId, type, updatedAt',
            secrets: 'id, performerId, type, createdAt',
            dramaEvents: 'id, timestamp, conversationId',
            coordinationPlans: 'id, initiatorId, status, updatedAt',
            privateConversations: 'id, [participant1Id+participant2Id], participant1Id, participant2Id, updatedAt'
        }).upgrade(async (transaction) => {
            const tagMap = new Map<string, TagScore>();

            const applyTags = (tags: string[] | undefined, source: 'memory' | 'knowledge', relevance = 0) => {
                if (!tags?.length) return;
                tags.forEach(tag => {
                    const normalized = tag.trim().toLowerCase();
                    if (!normalized) return;
                    if (!tagMap.has(normalized)) {
                        tagMap.set(normalized, {
                            tag: normalized,
                            memoryCount: 0,
                            knowledgeCount: 0,
                            lastUpdated: Date.now(),
                            score: 0
                        });
                    }
                    const entry = tagMap.get(normalized)!;
                    if (source === 'memory') {
                        entry.memoryCount += Math.max(1, Math.round(relevance || 1));
                    } else {
                        entry.knowledgeCount += 1;
                    }
                    entry.lastUpdated = Date.now();
                });
            };

            await transaction.table('memories').toCollection().each((memory: any) => {
                applyTags(memory.tags, 'memory', memory.relevance);
            });

            await transaction.table('knowledge').toCollection().each((entity: any) => {
                applyTags(entity.sourceTags, 'knowledge');
            });

            if (tagMap.size > 0) {
                const scores = Array.from(tagMap.values()).map(entry => recomputeTagScore(entry));
                await transaction.table('tagScores').bulkPut(scores);
            }
        });

        (this as Dexie).version(12).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp',
            performerInteractions: 'id, conversationId, speakerId, timestamp, context, type',
            tagScores: 'tag',
            brandIntelligence: '++id',
            clientProfiles: 'id, name, updatedAt',
            relationships: 'id, performerId, targetId, type, updatedAt',
            secrets: 'id, performerId, type, createdAt',
            dramaEvents: 'id, timestamp, conversationId',
            coordinationPlans: 'id, initiatorId, status, updatedAt',
            privateConversations: 'id, [participant1Id+participant2Id], participant1Id, participant2Id, updatedAt',
            playerProgress: 'id, rankId, updatedAt',
            experienceEvents: 'id, branch, type, timestamp'
        }).upgrade(async transaction => {
            const performerTable = transaction.table('performers');
            await performerTable.toCollection().modify((performer: any) => {
                performer.traits = withDefaultTraits(performer.traits || null);
                if (typeof performer.intrigueLevel !== 'number') {
                    performer.intrigueLevel = 50;
                }
            });

            const progressTable = transaction.table('playerProgress');
            const existing = await progressTable.toCollection().first();
            if (!existing) {
                const defaultProgress: PlayerProgress = {
                    id: 'player::main',
                    totalXp: 0,
                    branchXp: {
                        social_engineering: 0,
                        brand_authority: 0,
                        operations: 0,
                        creative_lab: 0,
                        intelligence: 0,
                        diplomacy: 0
                    },
                    unlockedSkillIds: [],
                    earnedRewards: [],
                    rankId: 'novice',
                    activeMissions: [],
                    completedMissions: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                await progressTable.add(defaultProgress);
            }
            await progressTable.toCollection().modify((record: any) => {
                record.activeMissions = Array.isArray(record.activeMissions) ? record.activeMissions : [];
                record.completedMissions = Array.isArray(record.completedMissions) ? record.completedMissions : [];
                if (typeof record.missionRefreshAt === 'undefined') {
                    record.missionRefreshAt = Date.now();
                }
            });
        });

        (this as Dexie).version(11).stores({
            memories: '++id, timestamp, relevance',
            journal: 'date',
            knowledge: 'name, updatedAt, createdAt',
            threads: 'id, updatedAt, createdAt',
            hrmr: 'id, messageId, grade, updatedAt',
            performers: 'id, name',
            performerMemories: '++id, performerId, timestamp',
            performerInteractions: 'id, conversationId, speakerId, timestamp',
            tagScores: 'tag',
            brandIntelligence: '++id',
            clientProfiles: 'id, name, updatedAt',
            relationships: 'id, performerId, targetId, type, updatedAt',
            secrets: 'id, performerId, type, createdAt',
            dramaEvents: 'id, timestamp, conversationId',
            coordinationPlans: 'id, initiatorId, status, updatedAt',
            privateConversations: 'id, [participant1Id+participant2Id], participant1Id, participant2Id, updatedAt',
            playerProgress: 'id',
            experienceEvents: 'id, timestamp',
            followUps: 'id, sourceRecordId, status, category, dueAt, createdAt'
        });
    }
}

export const db = new JITAgentDB();

// Memory Functions
export const getAllMemories = (): Promise<Memory[]> => db.memories.toArray();
export const addMemory = async (memory: Memory): Promise<number> => {
    const normalized = normalizeMemory(memory);
    const id = await db.memories.add(normalized);
    dispatchMemoriesUpdated(id);
    await updateTagUsage(normalized.tags, { source: 'memory', relevance: normalized.relevance });
    return id;
};

export const updateMemory = async (memory: Memory): Promise<number> => {
    const normalized = normalizeMemory(memory);
    const id = await db.memories.put(normalized);
    dispatchMemoriesUpdated(id);
    return id;
};

export const deleteMemoryById = async (id: number): Promise<void> => {
    await db.memories.delete(id);
    dispatchMemoriesUpdated(id);
};

export const clearMemories = async (): Promise<void> => {
    await db.memories.clear();
    dispatchMemoriesUpdated(null);
};

// Journal Functions
export const getAllJournalEntries = (): Promise<JournalEntry[]> => db.journal.toArray();
export const getJournalEntry = (date: string): Promise<JournalEntry | undefined> => db.journal.get(date);
export const upsertJournalEntry = (entry: JournalEntry): Promise<string> => db.journal.put(entry);

// Knowledge Graph Functions
export const getAllEntities = (): Promise<KnowledgeEntity[]> => db.knowledge.toArray();
export const getEntity = (name: string): Promise<KnowledgeEntity | undefined> => db.knowledge.get(name);
export const saveKnowledgeEntity = async (entity: KnowledgeEntity): Promise<string | number> => {
    const existing = await db.knowledge.get(entity.name);
    const enriched = enrichKnowledgeEntity(entity, existing);
    const result = await db.knowledge.put(enriched);
    await updateTagUsage(enriched.sourceTags, { source: 'knowledge' });
    return result;
};
export const deleteKnowledgeEntity = (name: string): Promise<void> => db.knowledge.delete(name).then(() => {});
export const clearKnowledge = (): Promise<void> => db.knowledge.clear();

export const upsertEntity = async (entity: KnowledgeEntity): Promise<string | number | void> => {
    const existing = await db.knowledge.get(entity.name);
    if (existing) {
        const updatedRels = { ...existing.relationships };
        for (const relType in entity.relationships) {
            const newTargets = entity.relationships[relType] || [];
            const existingTargets = updatedRels[relType] || [];
            updatedRels[relType] = [...new Set([...existingTargets, ...newTargets])];
        }
        const enriched = enrichKnowledgeEntity(
            { ...existing, relationships: updatedRels, sourceTags: entity.sourceTags ?? existing.sourceTags },
            existing
        );
        const result = await db.knowledge.put(enriched);
        await updateTagUsage(enriched.sourceTags, { source: 'knowledge' });
        return result;
    } else {
        const enriched = enrichKnowledgeEntity(entity);
        const result = await db.knowledge.add(enriched);
        await updateTagUsage(enriched.sourceTags, { source: 'knowledge' });
        return result;
    }
};

export const upsertEntities = (entities: KnowledgeEntity[]): Promise<void> => {
    // FIX: Cast `db` to Dexie to resolve an issue where TypeScript may not correctly infer inherited methods on an instance of a Dexie subclass.
    return (db as Dexie).transaction('rw', db.knowledge, async () => {
        for (const entity of entities) {
            await upsertEntity(entity);
        }
    });
};

// Thread Functions
export const getAllThreads = (): Promise<ConversationThread[]> => db.threads.toArray();
export const getThreadById = (id: string): Promise<ConversationThread | undefined> => db.threads.get(id);
export const saveThread = (thread: ConversationThread): Promise<string> => db.threads.put(thread);
export const deleteThread = (id: string): Promise<void> => db.threads.delete(id).then(() => {});

// HRMR Functions
export const getAllHrmrRatings = (): Promise<HrmrRating[]> => db.hrmr.toArray();
export const getHrmrRatingByMessageId = (messageId: string): Promise<HrmrRating | undefined> =>
    db.hrmr.get(messageId);
export const upsertHrmrRating = (rating: HrmrRating): Promise<string> => db.hrmr.put(rating);
export const deleteHrmrRating = (id: string): Promise<void> => db.hrmr.delete(id).then(() => {});

// Performer Functions
export const getAllPerformers = async (): Promise<PerformerProfile[]> => {
    const performers = await db.performers.toArray();
    return performers.map(normalizePerformerProfile);
};
export const getPerformerById = async (id: string): Promise<PerformerProfile | undefined> => {
    const performer = await db.performers.get(id);
    return performer ? normalizePerformerProfile(performer) : undefined;
};
export const savePerformer = async (performer: PerformerProfile): Promise<string> => {
    const normalized = normalizePerformerProfile(performer);
    const id = await db.performers.put(normalized);
    dispatchPerformersUpdated();
    return id;
};
export const deletePerformer = async (id: string): Promise<void> => {
    await db.performers.delete(id);
    dispatchPerformersUpdated();
};

// Performer memory functions
export const getPerformerMemories = async (performerId: string, limit?: number): Promise<PerformerMemory[]> => {
    const memories = await db.performerMemories.where('performerId').equals(performerId).toArray();
    const ordered = memories.sort((a, b) => b.timestamp - a.timestamp);
    return typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
};

export const addPerformerMemory = async (memory: PerformerMemory): Promise<number> => {
    const normalized = normalizePerformerMemory(memory);
    const id = await db.performerMemories.add(normalized);
    dispatchPerformerMemoriesUpdated(normalized.performerId);
    return id;
};

export const clearPerformerMemories = async (performerId?: string): Promise<void> => {
    if (performerId) {
        const keys = await db.performerMemories.where('performerId').equals(performerId).primaryKeys();
        await db.performerMemories.bulkDelete(keys);
        dispatchPerformerMemoriesUpdated(performerId);
    } else {
        await db.performerMemories.clear();
        dispatchPerformerMemoriesUpdated(null);
    }
};

export const addPerformerInteractionEvents = async (events: PerformerInteractionEvent[]): Promise<void> => {
    if (!events.length) return;
    const normalized = events.map(event => ({
        ...event,
        context: event.context || 'public'
    }));
    await db.performerInteractions.bulkAdd(normalized);
    const uniqueIds = Array.from(new Set(normalized.map(event => event.speakerId)));
    dispatchInteractionsUpdated(uniqueIds);
};

export const getPerformerInteractions = async (): Promise<PerformerInteractionEvent[]> => {
    return db.performerInteractions.toArray();
};

export const getInteractionsForParticipant = async (participantId: string): Promise<PerformerInteractionEvent[]> => {
    const direct = await db.performerInteractions.where('speakerId').equals(participantId).toArray();
    const asTarget = await db.performerInteractions.filter(event => event.targetIds.includes(participantId)).toArray();
    return [...direct, ...asTarget].sort((a, b) => a.timestamp - b.timestamp);
};

export const getInteractionSummaries = async (): Promise<PerformerInteractionSummary[]> => {
    const events = await db.performerInteractions.toArray();
    const map = new Map<string, PerformerInteractionSummary>();

    events.forEach(event => {
        const participants = [event.speakerId, ...event.targetIds].sort();
        const key = participants.join('|');
        if (!map.has(key)) {
            map.set(key, {
                pairKey: key,
                participants,
                lastInteraction: event.timestamp,
                totalInteractions: 0,
                sentimentSum: 0,
                intrigueCount: 0,
                tags: [],
                publicCount: 0,
                privateCount: 0,
                pressureScore: 0
            });
        }
        const summary = map.get(key)!;
        summary.totalInteractions += 1;
        summary.lastInteraction = Math.max(summary.lastInteraction, event.timestamp);
        if (event.context === 'public') {
            summary.publicCount = (summary.publicCount ?? 0) + 1;
        } else if (event.context === 'private') {
            summary.privateCount = (summary.privateCount ?? 0) + 1;
        }
        if (typeof event.sentiment === 'number') {
            summary.sentimentSum += event.sentiment;
            if (event.context === 'public' && event.sentiment < 0) {
                summary.pressureScore = (summary.pressureScore ?? 0) + Math.abs(event.sentiment);
            }
        }
        if (event.intrigueTags?.length) {
            summary.intrigueCount += 1;
            summary.tags = Array.from(new Set([...summary.tags, ...event.intrigueTags]));
        }
        if (event.narrativeTags?.length) {
            summary.tags = Array.from(new Set([...summary.tags, ...event.narrativeTags]));
        }
    });

    return Array.from(map.values()).sort((a, b) => b.lastInteraction - a.lastInteraction);
};

const dispatchPerformerMemoriesUpdated = (performerId: string | null) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('performer-memories-updated', { detail: { performerId } }));
    }
};

const dispatchInteractionsUpdated = (participantIds: string[]) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('performer-interactions-updated', { detail: { participantIds } }));
    }
};

const dispatchProgressUpdated = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('player-progress-updated'));
    }
};

const dispatchFollowUpsUpdated = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('follow-ups-updated'));
    }
};

export const getTagScores = async (): Promise<TagScore[]> => {
    const scores = await db.tagScores.toArray();
    return scores.sort((a, b) => b.score - a.score);
};

export const getPlayerProgress = async (): Promise<PlayerProgress> => {
    const progress = await db.playerProgress.get('player::main');
    if (progress) {
        return normalizePlayerProgress(progress);
    }
    const fallback: PlayerProgress = {
        id: 'player::main',
        totalXp: 0,
        branchXp: {
            social_engineering: 0,
            brand_authority: 0,
            operations: 0,
            creative_lab: 0,
            intelligence: 0,
            diplomacy: 0
        },
        unlockedSkillIds: [],
        earnedRewards: [],
        rankId: 'novice',
        activeMissions: [],
        completedMissions: [],
        missionRefreshAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    await db.playerProgress.put(fallback);
    return fallback;
};

export const savePlayerProgress = async (progress: PlayerProgress): Promise<string> => {
    const normalized = normalizePlayerProgress(progress);
    normalized.updatedAt = Date.now();
    const id = await db.playerProgress.put(normalized);
    dispatchProgressUpdated();
    return id;
};

export const addExperienceEvents = async (events: ExperienceEvent[]): Promise<void> => {
    if (!events.length) return;
    await db.experienceEvents.bulkAdd(events);
};

export const getRecentExperienceEvents = async (limit = 50): Promise<ExperienceEvent[]> => {
    const events = await db.experienceEvents.orderBy('timestamp').reverse().limit(limit).toArray();
    return events;
};

export const getFollowUps = async (): Promise<IntelligenceFollowUp[]> => {
    const tasks = await db.followUps.orderBy('createdAt').reverse().toArray();
    return tasks;
};

export const getFollowUpBySourceRecord = async (sourceRecordId: string, title?: string): Promise<IntelligenceFollowUp | undefined> => {
    const query = db.followUps.where('sourceRecordId').equals(sourceRecordId);
    if (title) {
        return query.and(task => task.title === title).first();
    }
    return query.first();
};

export const addFollowUp = async (
    input: Omit<IntelligenceFollowUp, 'id' | 'createdAt' | 'updatedAt'>
): Promise<IntelligenceFollowUp> => {
    const now = Date.now();
    const id = `followup-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const record: IntelligenceFollowUp = {
        ...input,
        id,
        createdAt: now,
        updatedAt: now
    };
    await db.followUps.put(record);
    dispatchFollowUpsUpdated();
    return record;
};

export const updateFollowUp = async (
    id: string,
    updates: Partial<Omit<IntelligenceFollowUp, 'id' | 'createdAt' | 'sourceRecordId'>>
): Promise<void> => {
    const payload = {
        ...updates,
        updatedAt: Date.now()
    };
    await db.followUps.update(id, payload);
    dispatchFollowUpsUpdated();
};

export const deleteFollowUp = async (id: string): Promise<void> => {
    await db.followUps.delete(id);
    dispatchFollowUpsUpdated();
};

async function updateTagUsage(
    tags: string[] | undefined,
    options: { source: 'memory' | 'knowledge'; relevance?: number } = { source: 'memory' }
): Promise<void> {
    if (!tags?.length) return;
    const unique = Array.from(new Set(
        tags.map(tag => tag?.toString().trim().toLowerCase()).filter((tag): tag is string => Boolean(tag))
    ));
    if (!unique.length) return;

    const existing = await db.tagScores.bulkGet(unique);
    const updates: TagScore[] = [];

    unique.forEach((tag, index) => {
        const current: TagScore = existing[index]
            ? { ...existing[index]! }
            : {
                tag,
                memoryCount: 0,
                knowledgeCount: 0,
                lastUpdated: Date.now(),
                score: 0
            };

        if (options.source === 'memory') {
            const delta = Math.max(1, Math.round(options.relevance ?? 1));
            current.memoryCount += delta;
        } else {
            current.knowledgeCount += 1;
        }

        current.lastUpdated = Date.now();
        updates.push(recomputeTagScore(current));
    });

    await db.tagScores.bulkPut(updates);
}

function recomputeTagScore(entry: TagScore): TagScore {
    const base = entry.memoryCount * 0.6 + entry.knowledgeCount * 1.2;
    return {
        ...entry,
        score: Math.round(base * 100) / 100,
        lastUpdated: Date.now()
    };
}

const dispatchMemoriesUpdated = (id: number | string | null) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('memories-updated', { detail: { id } }));
    }
};

const dispatchPerformersUpdated = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('performers-updated'));
    }
};

const normalizePerformerProfile = (performer: PerformerProfile): PerformerProfile => {
    const traits = withDefaultTraits(performer.traits || null);
    return {
        ...performer,
        intrigueLevel: typeof performer.intrigueLevel === 'number' ? performer.intrigueLevel : 50,
        traits
    };
};

const normalizePlayerProgress = (progress: PlayerProgress): PlayerProgress => {
    return {
        ...progress,
        branchXp: {
            social_engineering: progress.branchXp?.social_engineering ?? 0,
            brand_authority: progress.branchXp?.brand_authority ?? 0,
            operations: progress.branchXp?.operations ?? 0,
            creative_lab: progress.branchXp?.creative_lab ?? 0,
            intelligence: progress.branchXp?.intelligence ?? 0,
            diplomacy: progress.branchXp?.diplomacy ?? 0
        },
        unlockedSkillIds: Array.isArray(progress.unlockedSkillIds) ? progress.unlockedSkillIds : [],
        earnedRewards: Array.isArray(progress.earnedRewards) ? progress.earnedRewards : [],
        totalXp: progress.totalXp ?? 0,
        rankId: progress.rankId || 'novice',
        activeMissions: Array.isArray(progress.activeMissions) ? progress.activeMissions : [],
        completedMissions: Array.isArray(progress.completedMissions) ? progress.completedMissions : [],
        missionRefreshAt: progress.missionRefreshAt
    };
};

const sanitizeTags = (tags: string[] | undefined): string[] => {
    if (!Array.isArray(tags)) return [];
    const set = new Set<string>();
    tags.forEach(tag => {
        if (typeof tag !== 'string') return;
        const cleaned = tag.replace(/^#+/, '').trim();
        if (cleaned) set.add(cleaned.toLowerCase());
    });
    return Array.from(set);
};

const normalizeMemory = (memory: Memory): Memory => {
    const timestamp = memory.timestamp ?? Date.now();
    const temporalTags = getTemporalMetaTags(timestamp);
    const coreTags = sanitizeTags(memory.tags);
    const metaTags = Array.from(new Set([...(memory.metaTags ?? []), ...temporalTags]));
    return {
        ...memory,
        timestamp,
        tags: coreTags,
        metaTags
    };
};

const normalizePerformerMemory = (memory: PerformerMemory): PerformerMemory => {
    const timestamp = memory.timestamp ?? Date.now();
    const temporalTags = getTemporalMetaTags(timestamp);
    const tags = Array.from(new Set([...sanitizeTags(memory.tags), ...temporalTags]));
    return {
        ...memory,
        timestamp,
        tags
    };
};

const getTemporalMetaTags = (timestamp: number): string[] => {
    const date = new Date(timestamp);
    const isoDate = date.toISOString().split('T')[0];
    const year = date.getUTCFullYear();
    const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const week = `${year}-W${String(getISOWeekNumber(date)).padStart(2, '0')}`;
    return [`date:${isoDate}`, `month:${month}`, `year:${year}`, `week:${week}`];
};

const getISOWeekNumber = (date: Date): number => {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const enrichKnowledgeEntity = (entity: KnowledgeEntity, existing?: KnowledgeEntity | undefined): KnowledgeEntity => {
    const timestamp = Date.now();
    const relationships = entity.relationships || {};
    const mergedTags = Array.from(
        new Set([...(existing?.sourceTags ?? []), ...(entity.sourceTags ?? [])].filter(Boolean))
    );

    return {
        ...existing,
        ...entity,
        relationships,
        sourceTags: mergedTags,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
    };
};

// Brand Intelligence
export const getBrandIntelligence = async (): Promise<BrandIntelligence | undefined> => {
    const all = await db.brandIntelligence.toArray();
    return all[0];
};

export const saveBrandIntelligence = async (data: BrandIntelligence): Promise<void> => {
    await db.brandIntelligence.clear();
    await db.brandIntelligence.add(data);
};

// Client Profiles
export const getAllClientProfiles = async (): Promise<ClientProfile[]> => {
    return await db.clientProfiles.orderBy('updatedAt').reverse().toArray();
};

export const getClientProfile = async (id: string): Promise<ClientProfile | undefined> => {
    return await db.clientProfiles.get(id);
};

export const saveClientProfile = async (profile: ClientProfile): Promise<void> => {
    await db.clientProfiles.put(profile);
};

export const deleteClientProfile = async (id: string): Promise<void> => {
    await db.clientProfiles.delete(id);
};

// Relationships
export const getRelationship = async (performerId: string, targetId: string): Promise<PerformerRelationship | undefined> => {
    return await db.relationships.where('[performerId+targetId]').equals([performerId, targetId]).first();
};

export const getAllRelationships = async (): Promise<PerformerRelationship[]> => {
    return await db.relationships.toArray();
};

export const getRelationshipsForPerformer = async (performerId: string): Promise<PerformerRelationship[]> => {
    return await db.relationships.where('performerId').equals(performerId).toArray();
};

export const saveRelationship = async (relationship: PerformerRelationship): Promise<void> => {
    await db.relationships.put(relationship);
};

// Secrets
export const getSecretsForPerformer = async (performerId: string): Promise<PerformerSecret[]> => {
    return await db.secrets.where('performerId').equals(performerId).toArray();
};

export const getAllSecrets = async (): Promise<PerformerSecret[]> => {
    return await db.secrets.toArray();
};

export const saveSecret = async (secret: PerformerSecret): Promise<void> => {
    await db.secrets.add(secret);
};

export const revealSecret = async (secretId: string, revealedTo: string): Promise<void> => {
    const secret = await db.secrets.get(secretId);
    if (secret && !secret.knownBy.includes(revealedTo)) {
        secret.knownBy.push(revealedTo);
        secret.revealedAt = Date.now();
        await db.secrets.put(secret);
    }
};

// Drama Events
export const getDramaEvents = async (limit?: number): Promise<DramaEvent[]> => {
    const events = await db.dramaEvents.orderBy('timestamp').reverse().toArray();
    return limit ? events.slice(0, limit) : events;
};

export const saveDramaEvent = async (event: DramaEvent): Promise<void> => {
    await db.dramaEvents.add(event);
};

// Coordination Plans
export const getActiveCoordinationPlans = async (): Promise<CoordinationPlan[]> => {
    return await db.coordinationPlans.where('status').equals('active').toArray();
};

export const saveCoordinationPlan = async (plan: CoordinationPlan): Promise<void> => {
    await db.coordinationPlans.put(plan);
};

// Private Conversations
export const getPrivateConversation = async (participant1Id: string, participant2Id: string): Promise<PrivateConversation | undefined> => {
    const conv1 = await db.privateConversations.where('[participant1Id+participant2Id]').equals([participant1Id, participant2Id]).first();
    if (conv1) return conv1;
    return await db.privateConversations.where('[participant1Id+participant2Id]').equals([participant2Id, participant1Id]).first();
};

export const getAllPrivateConversations = async (): Promise<PrivateConversation[]> => {
    return await db.privateConversations.toArray();
};

export const getPrivateConversationsForPerformer = async (performerId: string): Promise<PrivateConversation[]> => {
    const as1 = await db.privateConversations.where('participant1Id').equals(performerId).toArray();
    const as2 = await db.privateConversations.where('participant2Id').equals(performerId).toArray();
    return [...as1, ...as2];
};

export const savePrivateConversation = async (conversation: PrivateConversation): Promise<void> => {
    await db.privateConversations.put(conversation);
};
