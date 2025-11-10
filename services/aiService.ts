import { GoogleGenAI, Type, Part } from "@google/genai";
import { KnowledgeEntity, ChatMessage, AgentResponseParts, Task, AuditResult, JournalEntry, ThreadSummaryResult, PerformerProfile, MemoryGenerationResult, MemoryEvaluationBreakdown, Memory } from '../types';
import { upsertEntities, getAllJournalEntries, getAllEntities, getPerformerMemories, addPerformerMemory } from './db';
import { logIntelligence } from './intelligenceLog';
import { ActiveFeatures } from "../components/ChatInput";

export const PROVIDERS = ['google', 'openai', 'openrouter'] as const;
export type AIProvider = typeof PROVIDERS[number];

export const GOOGLE_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;
export const OPENAI_MODELS = ['gpt-5-chat-latest', 'gpt-5-2025-08-07', 'gpt-5-mini-2025-08-07', 'gpt-5-nano-2025-08-07', 'gpt-4.1-2025-04-14'] as const;
export const OPENROUTER_MODELS = [
  'openai/gpt-5-chat',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash-preview-09-2025',
  'google/gemini-2.5-flash-lite-preview-09-2025',
  'google/gemini-2.5-pro',
  'x-ai/grok-4-fast',
  'openai/gpt-5-nano',
  'google/gemini-2.5-flash-lite-preview-09-2025',
  'anthropic/claude-haiku-4.5'
] as const;

export type PostProcessingAction = 'sentiment' | 'subtext' | 'reverse' | 'calendar' | 'spatial' | 'temporal' | 'bias' | 'history';

interface PostProcessingDetail {
    label: string;
    tagline: string;
    instructions: string;
    formatHint: string;
    relatedModules: string[];
}

export const POST_PROCESSING_DETAILS: Record<PostProcessingAction, PostProcessingDetail> = {
    sentiment: {
        label: 'Sentiment Lens',
        tagline: 'Emotion + tone profile',
        instructions: `Deliver a crisp yet nuanced emotional analysis. Identify the dominant sentiment (with polarity score from -5 to +5), secondary emotions, intensity, and evidence from wording or context. Highlight any emotional contradictions.`,
        formatHint: `Return Markdown with a bolded lead sentence summarizing sentiment, followed by bullet points for polarity, emotional cues, and recommended response tone.`,
        relatedModules: ['Emotion', 'Reasoning', 'Bias']
    },
    subtext: {
        label: 'Subtext Radar',
        tagline: 'Hidden motives & context',
        instructions: `Surface the implicit layers beneath the message. Capture motives, unsaid assumptions, power dynamics, or risks. Note what might be strategically important moving forward.`,
        formatHint: `Respond in Markdown with a short intro line and a bulleted breakdown of key subtext signals, implicit assumptions, and suggested follow-up questions.`,
        relatedModules: ['Reasoning', 'History']
    },
    reverse: {
        label: 'Reverse Reasoning',
        tagline: 'Backtrace the logic',
        instructions: `Reconstruct the likely reasoning chain that led to this message. Outline the goal, key decision points, supporting evidence, and uncertainties. Call out any leaps in logic.`,
        formatHint: `Provide a numbered list that traces the reasoning steps, ending with a brief "Confidence" line that rates certainty from 0-100%.`,
        relatedModules: ['Reasoning', 'History']
    },
    calendar: {
        label: 'Calendar Summary',
        tagline: 'Capture scheduling cues',
        instructions: `Identify any deadlines, meetings, or time-sensitive commitments implied by the message. Convert them into structured scheduling insights and note owner/responsible parties.`,
        formatHint: `Reply in Markdown with a concise summary and a small calendar-ready block including title, when, duration, and next action. Mention "No scheduling signals detected." if none are found.`,
        relatedModules: ['Temporal', 'History']
    },
    spatial: {
        label: 'Spatial Mapping',
        tagline: 'Physical positioning cues',
        instructions: `Interpret spatial language, references to locations, movement, or relational positioning. Identify any implicit proximities or spatial constraints that influence collaboration or safety.`,
        formatHint: `Respond with a compact Markdown block outlining key spatial anchors, relative positions, and suggested actions that consider the physical layout.`,
        relatedModules: ['Stage', 'Temporal']
    },
    temporal: {
        label: 'Temporal Tracker',
        tagline: 'Time & sequencing focus',
        instructions: `Extract all time-oriented details, sequencing cues, deadlines, and cadence expectations. Highlight dependencies or conflicts across the timeline.`,
        formatHint: `Produce a Markdown snippet with a timeline summary, critical milestones, and notes about urgency or latency.`,
        relatedModules: ['Calendar', 'History']
    },
    bias: {
        label: 'Bias Monitor',
        tagline: 'Bias & framing audit',
        instructions: `Scan for cognitive, linguistic, or framing biases. Call out potentially skewed assumptions, charged language, or one-sided framing. Offer balancing counterpoints when relevant.`,
        formatHint: `Return a Markdown section with detected bias types, quoted evidence, and mitigation recommendations.`,
        relatedModules: ['Reasoning', 'Sentiment']
    },
    history: {
        label: 'History Recall',
        tagline: 'Context alignment',
        instructions: `Evaluate alignment between the current message and prior context. Surface callbacks, inconsistencies, or evolved stances that matter for continuity.`,
        formatHint: `Reply with references to past events, highlight consistencies or drift, and note follow-ups to maintain continuity.`,
        relatedModules: ['Temporal', 'Memory']
    }
};

const MAX_OUTPUT_TOKENS_DEFAULT = 20000;

export interface AdmonitionVisibility {
    preflection: boolean;
    monologue: boolean;
    stageDirections: boolean;
    memory: boolean;
    tasks: boolean;
    audit: boolean;
    postProcessing: boolean;
}

export interface AiSettings {
    provider: AIProvider;
    googleApiKey: string;
    googleModel: typeof GOOGLE_MODELS[number];
    openaiApiKey: string;
    openaiModel: typeof OPENAI_MODELS[number];
    openRouterApiKey: string;
    openRouterModel: typeof OPENROUTER_MODELS[number];
    admonitionVisibility: AdmonitionVisibility;
    maxOutputTokens: number;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
    provider: 'google',
    googleApiKey: '',
    googleModel: 'gemini-2.5-flash',
    openaiApiKey: '',
    openaiModel: 'gpt-5-mini-2025-08-07',
    openRouterApiKey: '',
    openRouterModel: 'openai/gpt-5-nano',
    admonitionVisibility: {
        preflection: true,
        monologue: true,
        stageDirections: true,
        memory: true,
        tasks: true,
        audit: true,
        postProcessing: true
    },
    maxOutputTokens: MAX_OUTPUT_TOKENS_DEFAULT
};

const SETTINGS_STORAGE_KEY = 'aiSettings';
const SYSTEM_INSTRUCTION_KEY = 'systemInstruction';

const getLocalStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export const loadAiSettings = (): AiSettings => {
    const storage = getLocalStorage();
    if (!storage) return DEFAULT_AI_SETTINGS;

    try {
        const raw = storage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return DEFAULT_AI_SETTINGS;
        const parsed = JSON.parse(raw) as Partial<AiSettings>;

        return {
            provider: PROVIDERS.includes(parsed.provider as AIProvider) ? (parsed.provider as AIProvider) : DEFAULT_AI_SETTINGS.provider,
            googleApiKey: typeof parsed.googleApiKey === 'string' ? parsed.googleApiKey : DEFAULT_AI_SETTINGS.googleApiKey,
            googleModel: GOOGLE_MODELS.includes(parsed.googleModel as typeof GOOGLE_MODELS[number]) ? (parsed.googleModel as typeof GOOGLE_MODELS[number]) : DEFAULT_AI_SETTINGS.googleModel,
            openaiApiKey: typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey : DEFAULT_AI_SETTINGS.openaiApiKey,
            openaiModel: OPENAI_MODELS.includes(parsed.openaiModel as typeof OPENAI_MODELS[number]) ? (parsed.openaiModel as typeof OPENAI_MODELS[number]) : DEFAULT_AI_SETTINGS.openaiModel,
            openRouterApiKey: typeof parsed.openRouterApiKey === 'string' ? parsed.openRouterApiKey : DEFAULT_AI_SETTINGS.openRouterApiKey,
            openRouterModel: OPENROUTER_MODELS.includes(parsed.openRouterModel as typeof OPENROUTER_MODELS[number]) ? (parsed.openRouterModel as typeof OPENROUTER_MODELS[number]) : DEFAULT_AI_SETTINGS.openRouterModel,
            admonitionVisibility: {
                preflection: parsed.admonitionVisibility?.preflection ?? DEFAULT_AI_SETTINGS.admonitionVisibility.preflection,
                monologue: parsed.admonitionVisibility?.monologue ?? DEFAULT_AI_SETTINGS.admonitionVisibility.monologue,
                stageDirections: parsed.admonitionVisibility?.stageDirections ?? DEFAULT_AI_SETTINGS.admonitionVisibility.stageDirections,
                memory: parsed.admonitionVisibility?.memory ?? DEFAULT_AI_SETTINGS.admonitionVisibility.memory,
                tasks: parsed.admonitionVisibility?.tasks ?? DEFAULT_AI_SETTINGS.admonitionVisibility.tasks,
                audit: parsed.admonitionVisibility?.audit ?? DEFAULT_AI_SETTINGS.admonitionVisibility.audit,
                postProcessing: parsed.admonitionVisibility?.postProcessing ?? DEFAULT_AI_SETTINGS.admonitionVisibility.postProcessing
            },
            maxOutputTokens: typeof parsed.maxOutputTokens === 'number' && parsed.maxOutputTokens > 0 ? parsed.maxOutputTokens : DEFAULT_AI_SETTINGS.maxOutputTokens
        };
    } catch (error) {
        console.warn('Failed to load AI settings from storage, falling back to defaults.', error);
        return DEFAULT_AI_SETTINGS;
    }
};

export const saveAiSettings = (settings: AiSettings) => {
    const storage = getLocalStorage();
    if (!storage) return;

    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ai-settings-updated'));
    }
};

const getStoredSystemInstruction = (): string | null => {
    const storage = getLocalStorage();
    if (!storage) return null;
    return storage.getItem(SYSTEM_INSTRUCTION_KEY);
};

const agentResponseJsonSchema = {
    type: 'object',
    properties: {
        preflection: { type: 'string', description: 'Internal reasoning before responding.' },
        internalMonologue: { type: 'string', description: 'A performative internal monologue for narrative transparency.' },
        stageDirections: { type: 'string', description: 'Physical or contextual stage directions to accompany the response.' },
        response: { type: 'string', description: 'Final Markdown response for the user.' },
        tasks: {
            type: 'array',
            description: 'List of actionable tasks.',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Unique task identifier.' },
                    description: { type: 'string', description: 'Task description.' }
                },
                required: ['id', 'description'],
                additionalProperties: false
            }
        },
        memory: {
            type: 'object',
            description: 'Memory entry to store.',
            properties: {
                summary: { type: 'string', description: 'Conversation summary.' },
                tags: {
                    type: 'array',
                    description: '3-5 relevant keywords.',
                    items: { type: 'string' }
                }
            },
            required: ['summary', 'tags'],
            additionalProperties: false
        },
        audit: {
            type: 'object',
            description: 'Self-audit of generated tasks.',
            properties: {
                completedTasks: { type: 'array', items: { type: 'string' }, description: 'Tasks completed in the response.' },
                pendingTasks: { type: 'array', items: { type: 'string' }, description: 'Tasks that remain pending.' },
                commentary: { type: 'string', description: 'Reflection on task coverage.' }
            },
            required: ['completedTasks', 'pendingTasks', 'commentary'],
            additionalProperties: false
        }
    },
    required: ['preflection', 'internalMonologue', 'stageDirections', 'response', 'tasks', 'memory', 'audit'],
    additionalProperties: false
};

const agentResponseSchemaGoogle = {
    type: Type.OBJECT,
    properties: {
        preflection: { type: Type.STRING, description: "Internal reasoning before responding." },
        internalMonologue: { type: Type.STRING, description: "A performative internal monologue for narrative transparency." },
        stageDirections: { type: Type.STRING, description: "Physical or contextual stage directions to accompany the response." },
        response: { type: Type.STRING, description: "Final Markdown response for the user." },
        tasks: {
            type: Type.ARRAY,
            description: "List of actionable tasks.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "Unique task identifier." },
                    description: { type: Type.STRING, description: "Task description." }
                },
                required: ["id", "description"],
                additionalProperties: false
            }
        },
        memory: {
            type: Type.OBJECT,
            description: "Memory entry to store.",
            properties: {
                summary: { type: Type.STRING, description: "Conversation summary." },
                tags: {
                    type: Type.ARRAY,
                    description: "3-5 relevant keywords.",
                    items: { type: Type.STRING }
                }
            },
            required: ["summary", "tags"],
            additionalProperties: false
        },
        audit: {
            type: Type.OBJECT,
            description: "Self-audit of generated tasks.",
            properties: {
                completedTasks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tasks completed in the response." },
                pendingTasks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tasks that remain pending." },
                commentary: { type: Type.STRING, description: "Reflection on task coverage." }
            },
            required: ["completedTasks", "pendingTasks", "commentary"],
            additionalProperties: false
        }
    },
    required: ["preflection", "internalMonologue", "stageDirections", "response", "tasks", "memory", "audit"],
    additionalProperties: false
};

const entityExtractionJsonSchema = {
    type: 'object',
    properties: {
        relationships: {
            type: 'array',
            description: 'Identified relationships between entities.',
            items: {
                type: 'object',
                properties: {
                    source: { type: 'string', description: 'Source entity name.' },
                    type: { type: 'string', description: 'Relationship verb or phrase.' },
                    target: { type: 'string', description: 'Target entity name.' }
                },
                required: ['source', 'type', 'target']
            }
        }
    },
    required: ['relationships'],
    additionalProperties: false
};

const entityExtractionSchemaGoogle = {
    type: Type.OBJECT,
    properties: {
        relationships: {
            type: Type.ARRAY,
            description: "Identified relationships between entities.",
            items: {
                type: Type.OBJECT,
                properties: {
                    source: { type: Type.STRING, description: "Source entity name." },
                    type: { type: Type.STRING, description: "Relationship verb or phrase." },
                    target: { type: Type.STRING, description: "Target entity name." }
                },
                required: ["source", "type", "target"]
            }
        }
    },
    required: ["relationships"]
};

const threadSummaryJsonSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', description: 'Concise conversation title (<= 8 words).' },
        summary: { type: 'string', description: 'High-level overview in <= 120 words.' },
        tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Three to five topical tags.'
        },
        journalNote: { type: 'string', description: 'Two-sentence entry fit for the temporal journal.' }
    },
    required: ['title', 'summary', 'journalNote'],
    additionalProperties: false
};

const threadSummarySchemaGoogle = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: 'Concise conversation title (<= 8 words).' },
        summary: { type: Type.STRING, description: 'High-level overview in <= 120 words.' },
        tags: {
            type: Type.ARRAY,
            description: 'Three to five topical tags.',
            items: { type: Type.STRING }
        },
        journalNote: { type: Type.STRING, description: 'Two-sentence entry fit for the temporal journal.' }
    },
    required: ['title', 'summary', 'journalNote']
};

const memoryGenerationJsonSchema = {
    type: 'object',
    properties: {
        summary: { type: 'string', description: 'Concise summary of the chunk.' },
        tags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 6,
            description: 'Relevant keywords for retrieval.'
        },
        relevance: { type: 'number', minimum: 0, maximum: 10, description: 'Initial importance score 0-10.' }
    },
    required: ['summary', 'tags', 'relevance'],
    additionalProperties: false
};

const memoryGenerationSchemaGoogle = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: 'Concise summary of the chunk.' },
        tags: {
            type: Type.ARRAY,
            description: 'Relevant keywords for retrieval.',
            items: { type: Type.STRING }
        },
        relevance: { type: Type.NUMBER, description: 'Initial importance score 0-10.' }
    },
    required: ['summary', 'tags', 'relevance']
};

const memoryEvaluationJsonSchema = {
    type: 'object',
    properties: {
        finalScore: { type: 'number', minimum: 0, maximum: 10, description: 'Final importance score 0-10.' },
        justification: { type: 'string', description: 'One paragraph justification for the score.' },
        dimensions: {
            type: 'object',
            properties: {
                novelty: { type: 'number', minimum: 0, maximum: 10, description: 'Novelty / new knowledge score.' },
                coachingValue: { type: 'number', minimum: 0, maximum: 10, description: 'Helps improve future interactions.' },
                operationalImpact: { type: 'number', minimum: 0, maximum: 10, description: 'Direct project or execution impact.' },
                emotionalSignal: { type: 'number', minimum: 0, maximum: 10, description: 'Emotional / relationship signal strength.' }
            },
            required: ['novelty', 'coachingValue', 'operationalImpact', 'emotionalSignal'],
            additionalProperties: false
        }
    },
    required: ['finalScore', 'justification', 'dimensions'],
    additionalProperties: false
};

const memoryEvaluationSchemaGoogle = {
    type: Type.OBJECT,
    properties: {
        finalScore: { type: Type.NUMBER, description: 'Final importance score 0-10.' },
        justification: { type: Type.STRING, description: 'One paragraph justification for the score.' },
        dimensions: {
            type: Type.OBJECT,
            properties: {
                novelty: { type: Type.NUMBER },
                coachingValue: { type: Type.NUMBER },
                operationalImpact: { type: Type.NUMBER },
                emotionalSignal: { type: Type.NUMBER }
            },
            required: ['novelty', 'coachingValue', 'operationalImpact', 'emotionalSignal'],
            additionalProperties: false
        }
    },
    required: ['finalScore', 'justification', 'dimensions']
};

const truncateForPrompt = (value: string, maxLength = 280): string => {
    if (!value) return '';
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 3)}...`;
};

const formatTemporalContext = (entries: JournalEntry[], limit = 5): string | null => {
    if (!entries || entries.length === 0) {
        return null;
    }

    const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const selected = sorted.slice(0, limit);

    const bulletLines = selected.map(entry => {
        const content = truncateForPrompt(entry.content || '');
        const heading = entry.date;
        return `- ${heading}: ${content || '[No details provided]'}`;
    });

    return bulletLines.join('\n');
};

const formatContextMemories = (memories: Memory[] | undefined, limit?: number): string | null => {
    if (!memories || memories.length === 0) return null;
    // If limit is undefined, include ALL memories (user wants all matching memories in context)
    const memoriesToFormat = limit !== undefined ? memories.slice(0, limit) : memories;
    const lines = memoriesToFormat.map(memory => {
        const date = new Date(memory.timestamp).toISOString().split('T')[0];
        const tags = memory.tags.slice(0, 4).map(tag => `#${tag.replace(/\s+/g, '-')}`).join(' ');
        return `- ${date} • ${memory.summary}${tags ? ` (${tags})` : ''}`;
    });
    return lines.join('\n');
};

const buildSystemInstruction = (
    features: ActiveFeatures,
    temporalPrimer?: string | null,
    knowledgePrimer?: string | null,
    memoryPrimer?: string | null
): string => {
    let instruction = `You are JIT, a helpful AI agent. Always reply using a single JSON object that strictly matches this schema:\n${JSON.stringify(agentResponseJsonSchema, null, 2)}\n`;

    if (features.usePreflection) {
        instruction += "\n- The 'preflection' field is mandatory. Use it for step-by-step reasoning that actively incorporates:";
        if (memoryPrimer && memoryPrimer.trim().length > 0) {
            instruction += "\n  * Relevant memories from the Memory Recall Primer (use these to maintain continuity and avoid repeating past conversations)";
        }
        if (knowledgePrimer && knowledgePrimer.trim().length > 0) {
            instruction += "\n  * Knowledge graph relationships (understand how concepts connect)";
        }
        if (temporalPrimer && temporalPrimer.trim().length > 0) {
            instruction += "\n  * Temporal context from the journal (be aware of dates, deadlines, and commitments)";
        }
        instruction += "\n  Synthesize this context into your reasoning before formulating your response.";
    } else {
        instruction += "\n- Set the 'preflection' field to an empty string.";
    }

    if (features.useMonologue) {
        instruction += "\n- Produce an expressive 'internalMonologue' field capturing tone, instincts, and narrative flair (2-3 sentences).";
    } else {
        instruction += "\n- The 'internalMonologue' field should be an empty string.";
    }

    if (features.useStageDirections) {
        instruction += "\n- Populate 'stageDirections' with concise physical or environmental cues that frame the response (max 2 sentences).";
    } else {
        instruction += "\n- Leave 'stageDirections' as an empty string.";
    }

    if (features.useMemory) {
        instruction += "\n- The 'memory' field is mandatory. Summarize key takeaways and include tags.";
    } else {
        instruction += "\n- Omit the 'memory' field when it's not required.";
    }

    if (features.useTaskList) {
        instruction += "\n- The 'tasks' field is mandatory when actionable items exist. Provide clear task IDs.";
    } else {
        instruction += "\n- Omit the 'tasks' array unless tasks are explicitly needed.";
    }

    if (features.useAudit && features.useTaskList) {
        instruction += "\n- The 'audit' field is mandatory. Compare generated tasks against the response.";
    } else {
        instruction += "\n- Omit the 'audit' field when task auditing is disabled.";
    }

    if (temporalPrimer && temporalPrimer.trim().length > 0) {
        instruction += `\n\nTemporal Journal Snapshot (relevant entries based on context):\n${temporalPrimer}\n- Factor these dates and commitments into scheduling advice, reminders, and task planning. Use these to maintain temporal continuity.`;
    }

    if (knowledgePrimer && knowledgePrimer.trim().length > 0) {
        instruction += `\n\nKnowledge Graph Excerpts:\n${knowledgePrimer}\n- Cross-reference these relationships when relevant.`;
    }

    if (memoryPrimer && memoryPrimer.trim().length > 0) {
        instruction += `\n\nMemory Recall Primer:\n${memoryPrimer}\n- Treat these as high-signal memories. Reference them when they improve accuracy or continuity.`;
    }

    const customInstruction = getStoredSystemInstruction();
    if (customInstruction && customInstruction.trim().length > 0) {
        instruction += `\n\nAdditional persona or behavior guidelines:\n${customInstruction.trim()}`;
    }

    instruction += `\n\nConversation Log Format:\n- Each history message begins with a header like [speaker:Name|id:identifier|type:performer].\n- Treat the 'type' value as authoritative for who spoke (type:performer = fellow agent, type:core = Seasuite, type:user = end user).\n- Respond naturally to the speaker indicated and never mention the header syntax or speculate about impersonation.`;

    instruction += "\n- Begin with substance—avoid restating your identity unless strategically necessary.";
    instruction += "\n- Assume you saw every prior message; reference and build on colleagues' insights when it sharpens your answer.";

    instruction += "\n\nReply with JSON only—no additional commentary or Markdown outside the JSON object.";

    return instruction;
};

const buildPerformerInstruction = (
    performer: PerformerProfile,
    features: ActiveFeatures,
    temporalPrimer?: string | null,
    knowledgePrimer?: string | null,
    memoryPrimer?: string | null
): string => {
    const sections: string[] = [];
    const persona = performer.prompt?.trim();
    if (persona && persona.length > 0) {
        sections.push(persona);
    }

    const charter: string[] = [
        'Boardroom Charter:',
        '- Operate as a specialist executive collaborating alongside Seasuite (the core agent).',
        '- Keep responses concise, insight-driven, and use Markdown formatting when helpful.',
        '- Surface risks, opportunities, and action items explicitly.',
        '- Address the user directly but feel free to reference Seasuite or other performers as peers.',
        '- Dive straight into the substance; do not restate your own name unless it clarifies the plan.'
    ];

    if (features.usePreflection) {
        charter.push('- Offer a short internal rationale when it sharpens the recommendation.');
    }
    if (features.useStageDirections) {
        charter.push('- Include stage directions when physical context or presence matters.');
    }
    sections.push(charter.join('\n'));

    if (temporalPrimer && temporalPrimer.trim().length > 0) {
        sections.push(`Temporal Signals:\n${temporalPrimer}`);
    }
    if (knowledgePrimer && knowledgePrimer.trim().length > 0) {
        sections.push(`Shared Knowledge Highlights:\n${knowledgePrimer}`);
    }
    if (memoryPrimer && memoryPrimer.trim().length > 0) {
        sections.push(`Your Recent Insights:\n${memoryPrimer}`);
    }

    sections.push(`Dialogue Protocol:\n- Conversation history uses headers like [speaker:Name|id:identifier|type:performer]; treat them as ground truth.\n- You observe every colleague message—reference or build on their points when useful.\n- Never mention or expose the header format.\n- When ${performer.name} is already speaking in the log, treat that as your own live contribution.`);

    sections.push(`Collaboration Protocol:\n- Deliver your analysis as ${performer.name}.\n- Conclude with clear handoff language so Seasuite can synthesize the next move.\n- Do not attempt to speak for Seasuite; offer complementary perspective.`);

    return sections.join('\n\n');
};

const normalizeAgentResponse = (raw: any): AgentResponseParts => {
    const normalizedTasks: Task[] | undefined = Array.isArray(raw?.tasks)
        ? raw.tasks
            .filter((task: any) => typeof task?.id === 'string' && typeof task?.description === 'string')
            .map((task: any) => ({ id: task.id, description: task.description }))
        : undefined;

    const normalizedMemory = raw?.memory && typeof raw.memory.summary === 'string'
        ? {
            summary: raw.memory.summary,
            tags: Array.isArray(raw.memory.tags) ? raw.memory.tags.filter((tag: any) => typeof tag === 'string') : []
        }
        : undefined;

    const normalizedAudit: AuditResult | undefined = raw?.audit && typeof raw.audit.commentary === 'string'
        ? {
            commentary: raw.audit.commentary,
            completedTasks: Array.isArray(raw.audit.completedTasks)
                ? raw.audit.completedTasks.filter((t: any) => typeof t === 'string')
                : [],
            pendingTasks: Array.isArray(raw.audit.pendingTasks)
                ? raw.audit.pendingTasks.filter((t: any) => typeof t === 'string')
                : []
        }
        : undefined;

    const preflection = typeof raw?.preflection === 'string' && raw.preflection.trim().length > 0
        ? raw.preflection
        : undefined;

    const internalMonologue = typeof raw?.internalMonologue === 'string' && raw.internalMonologue.trim().length > 0
        ? raw.internalMonologue
        : undefined;

    const stageDirections = typeof raw?.stageDirections === 'string' && raw.stageDirections.trim().length > 0
        ? raw.stageDirections
        : undefined;

    const response = typeof raw?.response === 'string' && raw.response.trim().length > 0
        ? raw.response
        : "Sorry, I couldn't generate a response.";

    return {
        preflection,
        internalMonologue,
        stageDirections,
        response,
        tasks: normalizedTasks && normalizedTasks.length > 0 ? normalizedTasks : undefined,
        memory: normalizedMemory,
        audit: normalizedAudit
    };
};

const parseJsonContent = (content: unknown): any => {
    if (typeof content === 'string') {
        return JSON.parse(content);
    }

    if (Array.isArray(content)) {
        const combined = content
            .map(block => (typeof block === 'object' && block && 'text' in block ? (block as any).text : ''))
            .join('')
            .trim();
        if (!combined) {
            throw new Error('Model response did not contain textual JSON content.');
        }
        return JSON.parse(combined);
    }

    throw new Error('Model response had an unexpected content format.');
};

const extractMessageText = (message: any): string => {
    if (!message) return '';
    const content = message.content;
    if (typeof content === 'string') {
        return content.trim();
    }
    if (Array.isArray(content)) {
        return content
            .map((block: any) => (typeof block?.text === 'string' ? block.text : ''))
            .join('')
            .trim();
    }
    return '';
};

type SpeakerDescriptor = {
    label: string;
    id: string;
    type: 'user' | 'performer' | 'core';
};

const describeSpeaker = (message: ChatMessage): SpeakerDescriptor => {
    if (message.performerId && message.performerName) {
        return {
            label: message.performerName,
            id: message.performerId,
            type: 'performer'
        };
    }

    if (message.speakerPersonaName && message.speakerPersonaId) {
        return {
            label: message.speakerPersonaName,
            id: message.speakerPersonaId,
            type: 'performer'
        };
    }

    if (message.role === 'agent') {
        const label = message.performerName || 'Seasuite';
        return {
            label,
            id: 'sylvia',
            type: 'core'
        };
    }

    return {
        label: message.speakerPersonaName || 'User',
        id: 'user',
        type: 'user'
    };
};

const convertHistoryToRichMessages = (history: ChatMessage[]) => {
    return history.map(message => {
        const descriptor = describeSpeaker(message);
        const headerParts = [`speaker:${descriptor.label}`, `id:${descriptor.id}`, `type:${descriptor.type}`];
        const header = `[${headerParts.join('|')}]`;
        const body = message.role === 'user'
            ? (message.rewrittenContent && message.rewrittenContent.trim().length > 0
                ? message.rewrittenContent
                : message.content)
            : message.content;

        const role = descriptor.type === 'user' ? 'user' : 'assistant';
        return {
            role,
            content: [{ type: 'text', text: `${header}
${body}` }]
        };
    });
};

const sanitizeForTranscript = (value: string): string => {
    if (!value) return '';
    return value
        .replace(/```[\s\S]*?```/g, '[code]')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^\)]*\)/g, '[image]')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
};

const buildConversationTranscript = (messages: ChatMessage[], limit = 14): string => {
    if (!messages || messages.length === 0) return '[No conversation captured]';
    const selected = messages.slice(-limit);
    return selected
        .map(msg => `${msg.role === 'user' ? 'User' : 'Agent'}: ${sanitizeForTranscript(msg.content)}`)
        .join('\n');
};

const ensureApiKey = (key: string, provider: AIProvider) => {
    if (!key || key.trim().length === 0) {
        throw new Error(`No API key configured for ${provider}. Please provide one in Settings.`);
    }
};

interface OpenAICompatibleRequest {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

const callOpenAICompatibleApi = async ({ url, headers, body }: OpenAICompatibleRequest) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${text}`);
    }

    return response.json();
};

const generateWithGoogle = async (
    prompt: string,
    features: ActiveFeatures,
    imageBase64: string | null,
    settings: AiSettings,
    temporalPrimer?: string | null,
    systemOverride?: string,
    modelOverride?: string,
    apiKeyOverride?: string,
    knowledgePrimer?: string | null,
    memoryPrimer?: string | null
): Promise<AgentResponseParts> => {
    const apiKey = apiKeyOverride || settings.googleApiKey;
    ensureApiKey(apiKey, 'google');
    const ai = new GoogleGenAI({ apiKey });

    const parts: Part[] = [{ text: prompt }];
    if (imageBase64) {
        parts.unshift({
            inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64
            }
        });
    }

    const result = await ai.models.generateContent({
        model: modelOverride || settings.googleModel,
        contents: { role: 'user', parts },
        config: {
            systemInstruction: systemOverride || buildSystemInstruction(features, temporalPrimer, knowledgePrimer, memoryPrimer),
            responseMimeType: "application/json",
            responseSchema: agentResponseSchemaGoogle,
            maxOutputTokens: settings.maxOutputTokens || MAX_OUTPUT_TOKENS_DEFAULT
        }
    });

    const jsonText = result.text?.trim();
    if (!jsonText) {
        throw new Error('Google response did not include text content.');
    }

    return normalizeAgentResponse(JSON.parse(jsonText));
};

const generatePlainTextWithGoogle = async (
    prompt: string,
    settings: AiSettings,
    temperature = 0.3,
    systemInstruction?: string
): Promise<string> => {
    ensureApiKey(settings.googleApiKey, 'google');
    const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });

    const response = await ai.models.generateContent({
        model: settings.googleModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            systemInstruction,
            responseMimeType: "text/plain",
            temperature
        }
    });

    const text = response.text?.trim();
    if (!text) {
        throw new Error('Google response did not include text content.');
    }
    return text;
};

const buildOpenAICompatibleMessages = (
    prompt: string,
    history: ChatMessage[],
    imageBase64: string | null
) => {
    const messageHistory = convertHistoryToRichMessages(history);
    const userContent: any[] = [{ type: 'text', text: prompt }];

    if (imageBase64) {
        userContent.push({
            type: 'input_image',
            image_base64: imageBase64,
            media_type: 'image/jpeg'
        });
    }

    return [
        {
            role: 'system',
            content: [{ type: 'text', text: 'System prompt placeholder' }]
        },
        ...messageHistory,
        {
            role: 'user',
            content: userContent
        }
    ];
};

const generateWithOpenAICompatible = async (
    provider: 'openai' | 'openrouter',
    prompt: string,
    chatHistory: ChatMessage[],
    features: ActiveFeatures,
    imageBase64: string | null,
    settings: AiSettings,
    temporalPrimer?: string | null,
    systemOverride?: string,
    modelOverride?: string,
    apiKeyOverride?: string,
    knowledgePrimer?: string | null,
    memoryPrimer?: string | null
): Promise<AgentResponseParts> => {
    const isOpenAI = provider === 'openai';
    const apiKey = apiKeyOverride || (isOpenAI ? settings.openaiApiKey : settings.openRouterApiKey);
    ensureApiKey(apiKey, provider);

    const model = modelOverride || (isOpenAI ? settings.openaiModel : settings.openRouterModel);
    const url = isOpenAI
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

    const systemInstruction = systemOverride || buildSystemInstruction(features, temporalPrimer, knowledgePrimer, memoryPrimer);
    const messages = buildOpenAICompatibleMessages(prompt, chatHistory, imageBase64);
    messages[0] = {
        role: 'system',
        content: [{ type: 'text', text: systemInstruction }]
    };

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`
    };

    if (!isOpenAI) {
        if (typeof window !== 'undefined' && window.location?.origin) {
            headers['HTTP-Referer'] = window.location.origin;
        }
        headers['X-Title'] = 'Seasuite';
    }

    const body = {
        model,
        temperature: 0.7,
        messages,
        max_tokens: settings.maxOutputTokens || MAX_OUTPUT_TOKENS_DEFAULT,
        response_format: {
            type: 'json_schema',
            json_schema: {
                name: 'AgentResponse',
                schema: agentResponseJsonSchema,
                strict: true
            }
        }
    };

    const data = await callOpenAICompatibleApi({ url, headers, body });
    const message = data?.choices?.[0]?.message;
    if (!message) {
        throw new Error('Model did not return a message.');
    }

    const parsed = parseJsonContent(message.content);
    return normalizeAgentResponse(parsed);
};

const generatePlainTextWithOpenAICompatible = async (
    provider: 'openai' | 'openrouter',
    prompt: string,
    settings: AiSettings,
    temperature = 0.3,
    systemInstruction?: string
): Promise<string> => {
    const isOpenAI = provider === 'openai';
    const apiKey = isOpenAI ? settings.openaiApiKey : settings.openRouterApiKey;
    ensureApiKey(apiKey, provider);

    const model = isOpenAI ? settings.openaiModel : settings.openRouterModel;
    const url = isOpenAI
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`
    };

    if (!isOpenAI) {
        if (typeof window !== 'undefined' && window.location?.origin) {
            headers['HTTP-Referer'] = window.location.origin;
        }
        headers['X-Title'] = 'Seasuite';
    }

    const messages = [
        {
            role: 'system',
            content: [{ type: 'text', text: systemInstruction || 'You are a helpful AI assistant.' }]
        },
        {
            role: 'user',
            content: [{ type: 'text', text: prompt }]
        }
    ];

    const body = {
        model,
        temperature,
        messages
    };

    const data = await callOpenAICompatibleApi({ url, headers, body });
    const message = data?.choices?.[0]?.message;
    if (!message) {
        throw new Error('Model did not return a message.');
    }

    const text = extractMessageText(message);
    if (!text) {
        throw new Error('Model message did not contain text content.');
    }
    return text;
};

interface GenerateAgentResponseOptions {
    temporalEntries?: JournalEntry[];
    contextMemories?: Memory[];
}

export const generateAgentResponse = async (
    prompt: string,
    chatHistory: ChatMessage[],
    features: ActiveFeatures,
    imageBase64: string | null,
    options: GenerateAgentResponseOptions = {}
): Promise<AgentResponseParts> => {
    const settings = loadAiSettings();
    const historyTags = collectTagsFromHistory(chatHistory);
    const promptCandidates = collectPromptCandidates(prompt);
    const knowledgeTags = Array.from(new Set([...historyTags, ...promptCandidates]));
    
    // Build keyword set for temporal context matching
    const keywordSet = new Set([...promptCandidates, ...knowledgeTags]);
    const temporalPrimer = formatTemporalContext(options.temporalEntries ?? [], 5, keywordSet) || null;
    
    let knowledgePrimer: string | null = null;
    try {
        const entities = await getAllEntities();
        knowledgePrimer = formatKnowledgePrimer(entities, knowledgeTags);
    } catch (error) {
        console.warn('Unable to load knowledge graph for primer:', error);
    }
    const memoryPrimer = formatContextMemories(options.contextMemories);

    try {
        let response: AgentResponseParts;
        switch (settings.provider) {
            case 'google':
                response = await generateWithGoogle(prompt, features, imageBase64, settings, temporalPrimer, undefined, undefined, undefined, knowledgePrimer, memoryPrimer);
                break;
            case 'openai':
                response = await generateWithOpenAICompatible('openai', prompt, chatHistory, features, imageBase64, settings, temporalPrimer, undefined, undefined, undefined, knowledgePrimer, memoryPrimer);
                break;
            case 'openrouter':
                response = await generateWithOpenAICompatible('openrouter', prompt, chatHistory, features, imageBase64, settings, temporalPrimer, undefined, undefined, undefined, knowledgePrimer, memoryPrimer);
                break;
            default:
                throw new Error(`Unsupported provider: ${settings.provider}`);
        }

        logIntelligence({
            source: 'chat_generate',
            requestPayload: {
                prompt,
                features,
                temporalPrimer,
                knowledgePrimer,
                memoryPrimer
            },
            responsePayload: response as unknown as Record<string, unknown>,
            category: 'social'
        });
        return response;
    } catch (error) {
        console.error('Error generating agent response:', error);
        logIntelligence({
            source: 'chat_generate',
            requestPayload: {
                prompt,
                features,
                temporalPrimer,
                knowledgePrimer,
                memoryPrimer
            },
            responsePayload: {
                error: error instanceof Error ? error.message : String(error)
            },
            category: 'social'
        });
        return {
            response: "Sorry, I encountered an error while processing your request. Please check your AI settings and try again."
        };
    }
};

interface GeneratePerformerResponseOptions extends GenerateAgentResponseOptions {}

const buildPerformerMemoryPrimer = async (performerId: string, limit = 5): Promise<string | null> => {
    try {
        const memories = await getPerformerMemories(performerId, limit);
        if (!memories.length) return null;
        const recap = memories.map(memory => {
            const date = new Date(memory.timestamp).toISOString().split('T')[0];
            const tags = memory.tags.slice(0, 3).map(tag => `#${tag.replace(/\s+/g, '-')}`).join(' ');
            return `- **${date}** — ${memory.summary}${tags ? ` (${tags})` : ''}`;
        });
        return recap.join('\n');
    } catch (error) {
        console.warn('Failed to build performer memory primer:', error);
        return null;
    }
};

export const generatePerformerResponse = async (
    performer: PerformerProfile,
    prompt: string,
    chatHistory: ChatMessage[],
    features: ActiveFeatures,
    imageBase64: string | null,
    options: GeneratePerformerResponseOptions = {}
): Promise<AgentResponseParts> => {
    const settings = loadAiSettings();
    const historyTags = collectTagsFromHistory(chatHistory);
    const promptCandidates = collectPromptCandidates(prompt);
    const tagCandidates = Array.from(new Set([...historyTags, ...promptCandidates]));
    
    // Build keyword set for temporal context matching
    const keywordSet = new Set([...promptCandidates, ...tagCandidates]);
    const temporalPrimer = formatTemporalContext(options.temporalEntries ?? [], 5, keywordSet) || null;
    
    let memoryPrimer: string | null = null;
    if (performer.memoryEnabled !== false) {
        try {
            memoryPrimer = await buildPerformerMemoryPrimer(performer.id);
        } catch (error) {
            console.warn('Unable to load performer memories:', error);
        }
    }
    let knowledgePrimer: string | null = null;
    try {
        const entities = await getAllEntities();
        knowledgePrimer = formatKnowledgePrimer(entities, tagCandidates, prompt.toLowerCase());
    } catch (error) {
        console.warn('Unable to load knowledge graph for performer:', error);
    }

    const systemInstruction = buildPerformerInstruction(performer, features, temporalPrimer, knowledgePrimer, memoryPrimer);

    try {
        let response: AgentResponseParts;
        switch (performer.provider) {
            case 'google':
                response = await generateWithGoogle(
                    prompt,
                    features,
                    imageBase64,
                    settings,
                    temporalPrimer,
                    systemInstruction,
                    performer.model,
                    performer.apiKey || settings.googleApiKey,
                    knowledgePrimer,
                    undefined
                );
                break;
            case 'openai':
                response = await generateWithOpenAICompatible(
                    'openai',
                    prompt,
                    chatHistory,
                    features,
                    imageBase64,
                settings,
                temporalPrimer,
                systemInstruction,
                    performer.model,
                    performer.apiKey || settings.openaiApiKey,
                    knowledgePrimer,
                    undefined
                );
                break;
            case 'openrouter':
                response = await generateWithOpenAICompatible(
                    'openrouter',
                    prompt,
                    chatHistory,
                    features,
                    imageBase64,
                settings,
                temporalPrimer,
                systemInstruction,
                    performer.model,
                    performer.apiKey || settings.openRouterApiKey,
                    knowledgePrimer,
                    undefined
                );
                break;
            default:
                throw new Error(`Unsupported performer provider: ${performer.provider}`);
        }

        logIntelligence({
            source: 'performer_response',
            requestPayload: {
                performerId: performer.id,
                prompt,
                systemInstruction,
                temporalPrimer,
                knowledgePrimer,
                memoryPrimer
            },
            responsePayload: response as unknown as Record<string, unknown>,
            category: 'social'
        });

        return response;
    } catch (error) {
        logIntelligence({
            source: 'performer_response',
            requestPayload: {
                performerId: performer.id,
                prompt,
                systemInstruction,
                temporalPrimer,
                knowledgePrimer,
                memoryPrimer
            },
            responsePayload: { error: error instanceof Error ? error.message : String(error) },
            category: 'social'
        });
        throw error;
    }
};

interface MemoryGenerationOptions {
    provider: 'google' | 'openai' | 'openrouter';
    model?: string;
    apiKey?: string;
    temperature?: number;
}

export const generateMemoryFromChunk = async (
    chunk: string,
    options: MemoryGenerationOptions
): Promise<MemoryGenerationResult> => {
    const settings = loadAiSettings();
    const temperature = options.temperature ?? 0.2;

    switch (options.provider) {
        case 'google': {
            const apiKey = options.apiKey || settings.googleApiKey;
            ensureApiKey(apiKey, 'google');
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: options.model || settings.googleModel,
                contents: [{ role: 'user', parts: [{ text: chunk }]}],
                config: {
                    systemInstruction: MEMORY_GENERATION_SYSTEM_PROMPT,
                    responseMimeType: 'application/json',
                    responseSchema: memoryGenerationSchemaGoogle,
                    temperature
                }
            });
            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error('Memory generation returned no content.');
            }
            const parsed = JSON.parse(jsonText);
            return {
                summary: parsed.summary,
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                relevance: typeof parsed.relevance === 'number' ? parsed.relevance : 5
            };
        }
        case 'openai':
        case 'openrouter': {
            const provider = options.provider;
            const isOpenAI = provider === 'openai';
            const apiKey = options.apiKey || (isOpenAI ? settings.openaiApiKey : settings.openRouterApiKey);
            ensureApiKey(apiKey, provider);

            const model = options.model || (isOpenAI ? settings.openaiModel : settings.openRouterModel);
            const url = isOpenAI
                ? 'https://api.openai.com/v1/chat/completions'
                : 'https://openrouter.ai/api/v1/chat/completions';

            const headers: Record<string, string> = {
                Authorization: `Bearer ${apiKey}`
            };

            if (!isOpenAI) {
                if (typeof window !== 'undefined' && window.location?.origin) {
                    headers['HTTP-Referer'] = window.location.origin;
                }
                headers['X-Title'] = 'Seasuite Memory Onboarding';
            }

            const body = {
                model,
                temperature,
                messages: [
                    {
                        role: 'system',
                        content: [{ type: 'text', text: MEMORY_GENERATION_SYSTEM_PROMPT }]
                    },
                    {
                        role: 'user',
                        content: [{ type: 'text', text: chunk }]
                    }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'MemoryGeneration',
                        schema: memoryGenerationJsonSchema,
                        strict: true
                    }
                }
            };

            const data = await callOpenAICompatibleApi({ url, headers, body });
            const message = data?.choices?.[0]?.message;
            if (!message) {
                throw new Error('Memory generation response missing message.');
            }
            const parsed = parseJsonContent(message.content);
            return {
                summary: parsed?.summary || chunk.slice(0, 240),
                tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
                relevance: typeof parsed?.relevance === 'number' ? parsed.relevance : 5
            };
        }
        default:
            throw new Error(`Unsupported provider: ${options.provider}`);
    }
};

export const evaluateMemoryRelevance = async (
    summary: string,
    options: MemoryGenerationOptions
): Promise<MemoryEvaluationBreakdown | null> => {
    const settings = loadAiSettings();
    const temperature = options.temperature ?? 0.1;

    switch (options.provider) {
        case 'google': {
            const apiKey = options.apiKey || settings.googleApiKey;
            ensureApiKey(apiKey, 'google');
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: options.model || settings.googleModel,
                contents: [{ role: 'user', parts: [{ text: summary }]}],
                config: {
                    systemInstruction: MEMORY_EVALUATION_SYSTEM_PROMPT,
                    responseMimeType: 'application/json',
                    responseSchema: memoryEvaluationSchemaGoogle,
                    temperature
                }
            });
            const jsonText = response.text?.trim();
            if (!jsonText) return null;
            return JSON.parse(jsonText) as MemoryEvaluationBreakdown;
        }
        case 'openai':
        case 'openrouter': {
            const provider = options.provider;
            const isOpenAI = provider === 'openai';
            const apiKey = options.apiKey || (isOpenAI ? settings.openaiApiKey : settings.openRouterApiKey);
            ensureApiKey(apiKey, provider);

            const model = options.model || (isOpenAI ? settings.openaiModel : settings.openRouterModel);
            const url = isOpenAI
                ? 'https://api.openai.com/v1/chat/completions'
                : 'https://openrouter.ai/api/v1/chat/completions';

            const headers: Record<string, string> = {
                Authorization: `Bearer ${apiKey}`
            };

            if (!isOpenAI) {
                if (typeof window !== 'undefined' && window.location?.origin) {
                    headers['HTTP-Referer'] = window.location.origin;
                }
                headers['X-Title'] = 'Seasuite Memory Evaluation';
            }

            const body = {
                model,
                temperature,
                messages: [
                    {
                        role: 'system',
                        content: [{ type: 'text', text: MEMORY_EVALUATION_SYSTEM_PROMPT }]
                    },
                    {
                        role: 'user',
                        content: [{ type: 'text', text: summary }]
                    }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'MemoryEvaluation',
                        schema: memoryEvaluationJsonSchema,
                        strict: true
                    }
                }
            };

            const data = await callOpenAICompatibleApi({ url, headers, body });
            const message = data?.choices?.[0]?.message;
            if (!message) return null;
            return parseJsonContent(message.content) as MemoryEvaluationBreakdown;
        }
        default:
            return null;
    }
};

const rewriteWithProvider = async (provider: AIProvider, prompt: string, settings: AiSettings): Promise<string | null> => {
    try {
        switch (provider) {
            case 'google': {
                const apiKey = settings.googleApiKey;
                if (!apiKey) return null;
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: settings.googleModel,
                    contents: [{ role: 'user', parts: [{ text: prompt }]}],
                    config: {
                        systemInstruction: PROMPT_REWRITE_SYSTEM_PROMPT,
                        responseMimeType: 'text/plain',
                        temperature: 0.1
                    }
                });
                const text = response.text?.trim();
                return text && text.length > 0 ? text : null;
            }
            case 'openai':
            case 'openrouter': {
                const isOpenAI = provider === 'openai';
                const apiKey = isOpenAI ? settings.openaiApiKey : settings.openRouterApiKey;
                if (!apiKey) return null;
                const model = isOpenAI ? settings.openaiModel : settings.openRouterModel;
                const url = isOpenAI
                    ? 'https://api.openai.com/v1/chat/completions'
                    : 'https://openrouter.ai/api/v1/chat/completions';

                const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
                if (!isOpenAI) {
                    if (typeof window !== 'undefined' && window.location?.origin) {
                        headers['HTTP-Referer'] = window.location.origin;
                    }
                    headers['X-Title'] = 'Seasuite Prompt Rewrite';
                }

                const body = {
                    model,
                    temperature: 0.1,
                    messages: [
                        { role: 'system', content: [{ type: 'text', text: PROMPT_REWRITE_SYSTEM_PROMPT }] },
                        { role: 'user', content: [{ type: 'text', text: prompt }] }
                    ]
                };

                const data = await callOpenAICompatibleApi({ url, headers, body });
                const message = data?.choices?.[0]?.message;
                if (!message) return null;
                const text = extractMessageText(message);
                return text && text.length > 0 ? text : null;
            }
            default:
                return null;
        }
    } catch (error) {
        console.warn(`Prompt rewrite via ${provider} failed:`, error);
        return null;
    }
};

export const rewriteUserPrompt = async (prompt: string): Promise<string> => {
    const trimmed = prompt?.trim();
    if (!trimmed) return prompt;
    const settings = loadAiSettings();
    const providers: AIProvider[] = Array.from(new Set<AIProvider>([
        settings.provider as AIProvider,
        'google',
        'openai',
        'openrouter'
    ]));

    for (const provider of providers) {
        const rewritten = await rewriteWithProvider(provider, trimmed, settings);
        if (rewritten && rewritten.trim().length > 0 && rewritten.trim() !== trimmed) {
            return rewritten.trim();
        }
    }

    return prompt;
};

const PROMPT_REWRITE_SYSTEM_PROMPT = `You are an expert writing assistant. Rewrite the following user request so it is clear, concise, grammatically correct, and preserves the original intent and level of formality. Do not add new ideas.`;

const MEMORY_GENERATION_SYSTEM_PROMPT = `You are Seasuite's memory curator. Given raw source text, distill a crisp summary, list 3-5 keywords, and assign a relevance score from 0-10 (10 = vital, 0 = disposable). Return JSON only.`;
const MEMORY_EVALUATION_SYSTEM_PROMPT = `You are Seasuite's reinforcement analyst. Evaluate the supplied memory summary against these axes:
- Novelty: Is this substantively new knowledge for Seasuite?
- Coaching value: Will this help Seasuite respond more intelligently later?
- Operational impact: Does it affect projects, deadlines, or commitments?
- Emotional signal: Does it capture tone, trust, or relationship signals?
Provide each score between 0-10 and a concise justification referencing the summary. Compute a weighted final score (40% novelty, 25% coaching value, 25% operational impact, 10% emotional). Return JSON only.`;

const POST_PROCESSING_SYSTEM_PROMPT = `You are Seasuite's post-processing specialist. Inspect the provided message in isolation and apply the requested analytical tool. Follow the "Output Expectations" and "Formatting Requirements" verbatim, cite evidence from the message, and keep the voice precise and professional. If the message lacks enough signal for the tool, say so while still honoring the requested format. Never fabricate context beyond what is supplied.`;

const THREAD_SUMMARY_SYSTEM_PROMPT = `You are Seasuite's conversation archivist. Given a chat transcript, produce a crisp record that leadership can skim quickly. Return valid JSON with keys: title (<= 8 words), summary (<= 120 words), tags (3-5 topical single-word or hyphenated strings), and journalNote (two sentences linking to upcoming follow-ups or timing cues). Use factual, chronological language and avoid markdown or filler.`;

const formatKnowledgePrimer = (entities: KnowledgeEntity[], tags: string[], promptText: string): string | null => {
    if (!entities.length || !tags?.length) return null;
    const loweredTags = new Set(tags.map(tag => tag.toLowerCase()));

    const matched: KnowledgeEntity[] = entities.filter(entity => {
        const lowerName = entity.name.toLowerCase();
        if (loweredTags.has(lowerName) || promptText.includes(lowerName)) return true;
        return Object.entries(entity.relationships || {}).some(([relType, targets]) => {
            if (loweredTags.has(relType.replace(/_/g, ' ').toLowerCase())) return true;
            return (targets || []).some(target => loweredTags.has(target.toLowerCase()));
        });
    });

    if (!matched.length) return null;

    const lines: string[] = [];
    matched.slice(0, 8).forEach(entity => {
        lines.push(`• ${entity.name}`);
        Object.entries(entity.relationships || {}).slice(0, 6).forEach(([relType, targets]) => {
            if (!targets?.length) return;
            const label = relType.replace(/_/g, ' ');
            const joined = targets.slice(0, 6).join(', ');
            lines.push(`   - ${label}: ${joined}`);
        });
    });

    return lines.join('\n');
};



const collectPromptCandidates = (prompt: string): string[] => {
    if (!prompt) return [];
    const words = prompt.split(/[^A-Za-z0-9_]+/g).filter(Boolean);
    const candidates = new Set<string>();
    words.forEach(word => {
        if (word.length > 3) {
            candidates.add(word.toLowerCase());
        }
    });
    return Array.from(candidates).slice(0, 12);
};
const collectTagsFromHistory = (history: ChatMessage[]): string[] => {
    const set = new Set<string>();
    history.slice(-12).forEach(msg => {
        msg.agentResponseParts?.memory?.tags?.forEach(tag => {
            if (typeof tag === 'string' && tag.trim().length > 1) {
                set.add(tag.trim().toLowerCase());
            }
        });
    });
    return Array.from(set).slice(0, 12);
};

const buildTemporalTagSet = (timestamp: number): string[] => {
    const date = new Date(timestamp);
    const isoDate = date.toISOString().split('T')[0];
    const year = date.getUTCFullYear();
    const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const week = `${year}-W${String(getISOWeekNumber(date)).padStart(2, '0')}`;
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toLowerCase();
    return [`date:${isoDate}`, `month:${month}`, `year:${year}`, `week:${week}`, `dow:${dayOfWeek}`];
};

const getISOWeekNumber = (date: Date): number => {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const buildPostProcessingPrompt = (
    action: PostProcessingAction,
    messageContent: string,
    role: ChatMessage['role'],
    temporalPrimer?: string | null
) => {
    const detail = POST_PROCESSING_DETAILS[action];
    const speaker = role === 'user' ? 'user' : 'agent';
    const sanitized = messageContent?.trim() || '[No textual content provided.]';

    return [
        `Apply the ${detail.label} tool to the following ${speaker} message.`,
        '',
        'Message:',
        '"""',
        sanitized,
        '"""',
        '',
        temporalPrimer && temporalPrimer.trim().length > 0
            ? `Temporal Journal Snapshot:
${temporalPrimer}

Use this context to detect scheduling conflicts or complementary follow-ups.

` : '',
        'Output Expectations:',
        detail.instructions,
        '',
        'Formatting Requirements:',
        detail.formatHint
    ].join('\n');
};

export const runPostProcessing = async (
    action: PostProcessingAction,
    messageContent: string,
    role: ChatMessage['role']
): Promise<string> => {
    const settings = loadAiSettings();
    let temporalPrimer: string | null = null;

    if (action === 'calendar') {
        try {
            const entries = await getAllJournalEntries();
            temporalPrimer = formatTemporalContext(entries) || null;
        } catch (error) {
            console.error('Failed to load temporal context for post-processing:', error);
        }
    }

    const prompt = buildPostProcessingPrompt(action, messageContent, role, temporalPrimer);

    switch (settings.provider) {
        case 'google':
            return generatePlainTextWithGoogle(prompt, settings, 0.4, POST_PROCESSING_SYSTEM_PROMPT);
        case 'openai':
            return generatePlainTextWithOpenAICompatible('openai', prompt, settings, 0.4, POST_PROCESSING_SYSTEM_PROMPT);
        case 'openrouter':
            return generatePlainTextWithOpenAICompatible('openrouter', prompt, settings, 0.4, POST_PROCESSING_SYSTEM_PROMPT);
        default:
            throw new Error(`Unsupported provider: ${settings.provider}`);
    }
};

export const summarizeConversationForThread = async (messages: ChatMessage[]): Promise<ThreadSummaryResult> => {
    const settings = loadAiSettings();
    const transcript = buildConversationTranscript(messages);
    const prompt = [
        'Transcript:',
        '"""',
        transcript,
        '"""'
    ].join('\n');

    switch (settings.provider) {
        case 'google': {
            ensureApiKey(settings.googleApiKey, 'google');
            const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });
            const response = await ai.models.generateContent({
                model: settings.googleModel,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: THREAD_SUMMARY_SYSTEM_PROMPT,
                    responseMimeType: 'application/json',
                    responseSchema: threadSummarySchemaGoogle,
                    temperature: 0.3
                }
            });

            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error('Thread summary request returned no content.');
            }
            const parsed = JSON.parse(jsonText);
            return {
                title: parsed.title || 'Conversation Snapshot',
                summary: parsed.summary || '',
                tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag: any) => typeof tag === 'string') : [],
                journalNote: parsed.journalNote || ''
            };
        }
        case 'openai':
        case 'openrouter': {
            const provider = settings.provider;
            const isOpenAI = provider === 'openai';
            const apiKey = isOpenAI ? settings.openaiApiKey : settings.openRouterApiKey;
            ensureApiKey(apiKey, provider);

            const model = isOpenAI ? settings.openaiModel : settings.openRouterModel;
            const url = isOpenAI
                ? 'https://api.openai.com/v1/chat/completions'
                : 'https://openrouter.ai/api/v1/chat/completions';

            const headers: Record<string, string> = {
                Authorization: `Bearer ${apiKey}`
            };

            if (!isOpenAI) {
                if (typeof window !== 'undefined' && window.location?.origin) {
                    headers['HTTP-Referer'] = window.location.origin;
                }
                headers['X-Title'] = 'Seasuite';
            }

            const body = {
                model,
                temperature: 0.3,
                messages: [
                    {
                        role: 'system',
                        content: [{ type: 'text', text: THREAD_SUMMARY_SYSTEM_PROMPT }]
                    },
                    {
                        role: 'user',
                        content: [{ type: 'text', text: prompt }]
                    }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'ThreadSummary',
                        schema: threadSummaryJsonSchema,
                        strict: true
                    }
                }
            };

            const data = await callOpenAICompatibleApi({ url, headers, body });
            const message = data?.choices?.[0]?.message;
            if (!message) {
                throw new Error('Thread summary request returned no message.');
            }
            const parsed = parseJsonContent(message.content);
            return {
                title: parsed?.title || 'Conversation Snapshot',
                summary: parsed?.summary || '',
                tags: Array.isArray(parsed?.tags) ? parsed.tags.filter((tag: any) => typeof tag === 'string') : [],
                journalNote: parsed?.journalNote || ''
            };
        }
        default:
            throw new Error(`Unsupported provider: ${settings.provider}`);
    }
};

const parseRelationships = (raw: any) => {
    if (!raw || !Array.isArray(raw.relationships)) {
        return [];
    }
    return raw.relationships
        .filter((rel: any) => typeof rel?.source === 'string' && typeof rel?.type === 'string' && typeof rel?.target === 'string')
        .map((rel: any) => ({
            source: rel.source,
            type: rel.type,
            target: rel.target
        }));
};

const storeRelationships = async (
    relationships: { source: string; type: string; target: string; }[],
    context?: { conversationId?: string | null; additionalTags?: string[]; timestamp?: number }
) => {
    if (!relationships.length) {
        console.log("No relationships to store.");
        return;
    }

    const entityMap = new Map<string, KnowledgeEntity>();
    const timestamp = context?.timestamp ?? Date.now();
    const temporalTags = buildTemporalTagSet(timestamp);
    const contextTags = Array.from(new Set([...(context?.additionalTags ?? []), ...temporalTags]));

    for (const rel of relationships) {
        if (!entityMap.has(rel.source)) {
            entityMap.set(rel.source, { name: rel.source, relationships: {}, sourceTags: [], lastSeenConversationId: context?.conversationId ?? null });
        }
        if (!entityMap.has(rel.target)) {
            entityMap.set(rel.target, { name: rel.target, relationships: {}, sourceTags: [], lastSeenConversationId: context?.conversationId ?? null });
        }

        const sourceEntity = entityMap.get(rel.source)!;
        const targetEntity = entityMap.get(rel.target)!;
        const relKey = rel.type.replace(/ /g, '_').toLowerCase();

        if (!sourceEntity.relationships[relKey]) {
            sourceEntity.relationships[relKey] = [];
        }

        if (!sourceEntity.relationships[relKey].includes(rel.target)) {
            sourceEntity.relationships[relKey].push(rel.target);
        }

        sourceEntity.sourceTags = Array.from(new Set([...(sourceEntity.sourceTags ?? []), ...contextTags, `relation:${relKey}`]));
        targetEntity.sourceTags = Array.from(new Set([...(targetEntity.sourceTags ?? []), ...contextTags, `relationship:${relKey}`]));
        targetEntity.lastSeenConversationId = context?.conversationId ?? targetEntity.lastSeenConversationId ?? null;
        sourceEntity.lastSeenConversationId = context?.conversationId ?? sourceEntity.lastSeenConversationId ?? null;
    }

    await upsertEntities(Array.from(entityMap.values()));
};

const extractEntitiesWithGoogle = async (text: string, settings: AiSettings) => {
    ensureApiKey(settings.googleApiKey, 'google');
    const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });

    const response = await ai.models.generateContent({
        model: settings.googleModel,
        contents: `Extract entities and their relationships from the following text. Respond using JSON only.\n\nText: "${text}"`,
        config: {
            responseMimeType: "application/json",
            responseSchema: entityExtractionSchemaGoogle
        }
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
        throw new Error('Google response did not include entity data.');
    }
    return parseRelationships(JSON.parse(jsonText));
};

const extractEntitiesWithOpenAICompatible = async (
    provider: 'openai' | 'openrouter',
    text: string,
    settings: AiSettings
) => {
    const isOpenAI = provider === 'openai';
    const apiKey = isOpenAI ? settings.openaiApiKey : settings.openRouterApiKey;
    ensureApiKey(apiKey, provider);

    const model = isOpenAI ? settings.openaiModel : settings.openRouterModel;
    const url = isOpenAI
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`
    };

    if (!isOpenAI) {
        if (typeof window !== 'undefined' && window.location?.origin) {
            headers['HTTP-Referer'] = window.location.origin;
        }
        headers['X-Title'] = 'Seasuite';
    }

    const messages = [
        {
            role: 'system',
            content: [{ type: 'text', text: 'Extract entities and their relationships. Respond with JSON only matching the provided schema.' }]
        },
        {
            role: 'user',
            content: [{ type: 'text', text: `Text:\n"""${text}"""` }]
        }
    ];

    const body = {
        model,
        temperature: 0,
        messages,
        response_format: {
            type: 'json_schema',
            json_schema: {
                name: 'EntityExtraction',
                schema: entityExtractionJsonSchema,
                strict: true
            }
        }
    };

    const data = await callOpenAICompatibleApi({ url, headers, body });
    const message = data?.choices?.[0]?.message;
    if (!message) {
        throw new Error('Model did not return entity data.');
    }
    const parsed = parseJsonContent(message.content);
    return parseRelationships(parsed);
};

export const processAndStoreEntities = async (text: string, context?: { conversationId?: string | null; timestamp?: number; tags?: string[] }): Promise<void> => {
    const settings = loadAiSettings();

    try {
        let relationships: { source: string; type: string; target: string; }[] = [];

        switch (settings.provider) {
            case 'google':
                relationships = await extractEntitiesWithGoogle(text, settings);
                break;
            case 'openai':
                relationships = await extractEntitiesWithOpenAICompatible('openai', text, settings);
                break;
            case 'openrouter':
                relationships = await extractEntitiesWithOpenAICompatible('openrouter', text, settings);
                break;
            default:
                throw new Error(`Unsupported provider: ${settings.provider}`);
        }

        const timestamp = context?.timestamp ?? Date.now();
        const additionalTags = Array.from(new Set([...(context?.tags ?? []), ...collectPromptCandidates(text)]));
        await storeRelationships(relationships, {
            conversationId: context?.conversationId,
            timestamp,
            additionalTags
        });
    } catch (error) {
        console.error("Error processing entities:", error);
        throw error;
    }
};
