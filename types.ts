
export interface Memory {
    id?: number;
    timestamp: number;
    summary: string;
    tags: string[];
    conversation: string;
    relevance: number;
    knowledgeRefs?: string[];
    metaTags?: string[];
}

export interface JournalEntry {
    date: string; // YYYY-MM-DD
    content: string;
}

export interface KnowledgeEntity {
    name: string; // Primary key
    relationships: Record<string, string[]>;
    createdAt?: number;
    updatedAt?: number;
    sourceTags?: string[];
    lastSeenConversationId?: string | null;
}

export interface Task {
    id: string;
    description: string;
}

export interface AuditResult {
    completedTasks: string[];
    pendingTasks: string[];
    commentary: string;
}

export interface AgentResponseParts {
    preflection?: string;
    internalMonologue?: string;
    stageDirections?: string;
    response?: string;
    tasks?: Task[];
    memory?: {
        summary: string;
        tags: string[];
    };
    audit?: AuditResult;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'agent';
    content: string;
    image?: string; // base64 data URL
    rewrittenContent?: string;
    rewriteStatus?: 'rewritten' | 'unchanged';
    agentResponseParts?: AgentResponseParts;
    performerId?: string | null;
    performerName?: string;
    performerIcon?: string;
    timestamp?: number;
    collaborators?: string[];
    conversationId?: string;
    speakerPersonaId?: string | null;
    speakerPersonaName?: string | null;
    metadata?: {
        mission?: MissionUpdate;
        escortResult?: unknown; // EscortResult from services/escorts
        escortName?: string;
    };
}

export interface ConversationThread {
    id: string;
    title: string;
    summary: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
    journalDate?: string;
    journalNote?: string;
    messages: ChatMessage[];
}

export interface ThreadSummaryResult {
    title: string;
    summary: string;
    tags: string[];
    journalNote: string;
}

export type HrmrGrade =
    | 'A+'
    | 'A'
    | 'A-'
    | 'B+'
    | 'B'
    | 'B-'
    | 'C+'
    | 'C'
    | 'C-'
    | 'D+'
    | 'D'
    | 'D-'
    | 'F';

export interface HrmrRating {
    id: string; // message id based
    messageId: string;
    grade: HrmrGrade;
    agentResponse: string;
    preflection?: string;
    internalMonologue?: string;
    stageDirections?: string;
    tasks?: Task[];
    memorySummary?: string;
    modulesUsed?: string[];
    createdAt: number;
    updatedAt: number;
}

export const HRMR_GRADE_SCALE: HrmrGrade[] = [
    'A+',
    'A',
    'A-',
    'B+',
    'B',
    'B-',
    'C+',
    'C',
    'C-',
    'D+',
    'D',
    'D-',
    'F'
];

export interface PerformerProfile {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    provider: 'google' | 'openai' | 'openrouter';
    model: string;
    apiKey: string;
    prompt: string;
    createdAt: number;
    updatedAt: number;
    memoryEnabled?: boolean;
    featureOverrides?: PerformerFeatureOverrides;
    roleDescription?: string;
    intrigueLevel?: number;
    traits?: PerformerTraits;
}

export interface PerformerMemory {
    id?: number;
    performerId: string;
    timestamp: number;
    summary: string;
    tags: string[];
    transcriptSnippet: string;
    relevance: number;
    conversationId?: string;
}

export interface PerformerFeatureOverrides {
    usePreflection?: boolean;
    useMemory?: boolean;
    useTaskList?: boolean;
    useAudit?: boolean;
    useStageDirections?: boolean;
    useMonologue?: boolean;
    usePromptRewrite?: boolean;
}

export interface PerformerTraits {
    charisma: number;
    empathy: number;
    loyalty: number;
    ambition: number;
    volatility: number;
    cunning: number;
    discipline: number;
    curiosity: number;
    boldness: number;
    transparency: number;
}

export type SkillBranchId =
    | 'social_engineering'
    | 'brand_authority'
    | 'operations'
    | 'creative_lab'
    | 'intelligence'
    | 'diplomacy';

export interface SkillDefinition {
    id: string;
    branch: SkillBranchId;
    tier: number;
    cost: number;
    title: string;
    description: string;
    icon?: string;
    prerequisites?: string[];
    rewards: SkillReward[];
}

export type SkillReward =
    | { type: 'toggle'; feature: 'preflection' | 'monologue' | 'stageDirections' | 'memoryCapture' | 'taskList' | 'audit' | 'promptRewrite'; }
    | { type: 'panel'; panelId: 'brand_insights' | 'social_feed' | 'progression'; }
    | { type: 'stat'; stat: 'xp_multiplier'; value: number }
    | { type: 'perk'; id: string }
    | { type: 'escort'; escortId: string };

export interface RankDefinition {
    id: string;
    title: string;
    minTotalXp: number;
    badgeColor: string;
}

export interface PlayerProgress {
    id: string;
    totalXp: number;
    branchXp: Record<SkillBranchId, number>;
    unlockedSkillIds: string[];
    earnedRewards: SkillReward[];
    rankId: string;
    activeMissions: MissionProgress[];
    completedMissions: MissionProgress[];
    missionRefreshAt?: number;
    createdAt: number;
    updatedAt: number;
}

export interface MissionSummary {
    active: Array<{ mission: MissionProgress; definition: MissionDefinition }>;
    branchXp: Record<SkillBranchId, number>;
}

export interface ExperienceEvent {
    id: string;
    branch: SkillBranchId;
    type: ExperienceEventType;
    xp: number;
    actorIds: string[];
    context: 'public' | 'private' | 'system';
    metadata?: Record<string, unknown>;
    timestamp: number;
}

export type ExperienceEventType =
    | 'pressure_diffused'
    | 'pressure_created'
    | 'secret_shared'
    | 'secret_uncovered'
    | 'brand_update'
    | 'client_success'
    | 'plan_execution'
    | 'innovation_push'
    | 'memory_capture'
    | 'dramatic_event'
    | 'mission_reward';

export type IntelligenceCategory = 'brand' | 'client' | 'social' | 'operations' | 'mission';

export interface MissionDefinition {
    id: string;
    branch: SkillBranchId;
    title: string;
    description: string;
    target: number;
    metric: MissionMetric;
    rewardXp: number;
    expiresInHours?: number;
}

export type MissionMetric =
    | 'pressure_diffused'
    | 'pressure_created'
    | 'secret_shared'
    | 'brand_update'
    | 'memory_capture'
    | 'client_success'
    | 'drama_event'
    | 'tasks_completed';

export interface MissionProgress {
    id: string;
    missionId: string;
    progress: number;
    target: number;
    status: 'active' | 'completed' | 'expired';
    startedAt: number;
    completedAt?: number;
    branch: SkillBranchId;
    rewardXp: number;
}

export interface MissionUpdate {
    missionId: string;
    branch: SkillBranchId;
    progress: number;
    target: number;
    completed: boolean;
    rewardXp: number;
    title: string;
}

export type FollowUpStatus = 'pending' | 'in_progress' | 'completed';

export interface FollowUpActionHint {
    label: string;
    path?: string;
    description?: string;
}

export interface IntelligenceFollowUp {
    id: string;
    title: string;
    description?: string;
    category: IntelligenceCategory;
    status: FollowUpStatus;
    sourceRecordId: string;
    sourceSummary?: string;
    priority?: 'low' | 'medium' | 'high';
    dueAt?: number;
    autoGenerated: boolean;
    createdAt: number;
    updatedAt: number;
    actionHint?: FollowUpActionHint;
    metadata?: Record<string, unknown>;
}

export type InteractionParticipantType = 'user' | 'sylvia' | 'performer';

export interface PerformerInteractionEvent {
    id: string;
    conversationId: string;
    speakerId: string;
    speakerName: string;
    speakerType: InteractionParticipantType;
    targetIds: string[];
    targetNames: string[];
    timestamp: number;
    messageId: string;
    intrigueTags?: string[];
    sentiment?: number;
    narrativeTags?: string[];
    context?: 'public' | 'private' | 'system';
    origin?: 'chat' | 'dm' | 'other';
}

export interface PerformerInteractionSummary {
    pairKey: string;
    participants: string[];
    lastInteraction: number;
    totalInteractions: number;
    sentimentSum: number;
    intrigueCount: number;
    tags: string[];
    publicCount?: number;
    privateCount?: number;
    pressureScore?: number;
}

export interface TagScore {
    tag: string;
    memoryCount: number;
    knowledgeCount: number;
    lastUpdated: number;
    score: number;
}

export interface MemoryGenerationResult {
    summary: string;
    tags: string[];
    relevance: number;
}

export interface MemoryEvaluationBreakdown {
    finalScore: number;
    justification: string;
    dimensions: {
        novelty: number;
        coachingValue: number;
        operationalImpact: number;
        emotionalSignal: number;
    };
}

export type RelationshipType = 'ally' | 'rival' | 'mentor' | 'romantic' | 'suspicious' | 'neutral';
export type SecretType = 'personal' | 'strategic' | 'romantic' | 'betrayal' | 'ambition';

export interface PerformerRelationship {
    id: string;
    performerId: string;
    targetId: string;
    type: RelationshipType;
    intensity: number; // 0-100
    trust: number; // 0-100
    tension: number; // 0-100
    attraction?: number; // 0-100, optional for romantic
    lastInteraction: number;
    history: string[];
    createdAt: number;
    updatedAt: number;
}

export interface PerformerSecret {
    id: string;
    performerId: string;
    type: SecretType;
    content: string;
    knownBy: string[]; // performer IDs who know
    revealedAt?: number;
    impact: number; // 0-100
    createdAt: number;
}

export interface DramaEvent {
    id: string;
    type: 'conflict' | 'alliance' | 'betrayal' | 'confession' | 'revelation' | 'romance';
    participants: string[];
    description: string;
    intensity: number;
    timestamp: number;
    conversationId: string;
    messageId: string;
}

export interface CoordinationPlan {
    id: string;
    initiatorId: string;
    participants: string[];
    goal: string;
    secret: boolean;
    status: 'active' | 'completed' | 'failed';
    createdAt: number;
    updatedAt: number;
}

export interface PrivateConversation {
    id: string;
    participant1Id: string;
    participant2Id: string;
    messages: PrivateMessage[];
    createdAt: number;
    updatedAt: number;
}

export interface PrivateMessage {
    id: string;
    senderId: string;
    content: string;
    timestamp: number;
}

export interface BrandIntelligence {
    mission?: string;
    vision?: string;
    values?: string;
    targetAudience?: string;
    uniqueValue?: string;
    goals?: string;
    tone?: string;
    keyMessages?: string;
    competitiveEdge?: string;
    constraints?: string;
    updatedAt: number;
}

export interface ClientProfile {
    id: string;
    name: string;
    company?: string;
    industry?: string;
    role?: string;
    painPoints?: string;
    goals?: string;
    budget?: string;
    decisionProcess?: string;
    personality?: string;
    communicationStyle?: string;
    objections?: string;
    opportunities?: string;
    history?: string;
    notes?: string;
    createdAt: number;
    updatedAt: number;
}
