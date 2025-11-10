import { loadAiSettings } from './aiService';
import { getAllMemories, getAllClientProfiles, getBrandIntelligence, getAllThreads } from './db';
import { Memory, ChatMessage } from '../types';

export type EscortId = 
  | 'strategist'
  | 'analyst'
  | 'historian'
  | 'diagnostician'
  | 'forecaster'
  | 'fixer'
  | 'benchmarker'
  | 'appraiser'
  | 'sanity_checker'
  | 'causal_inquisitor'
  | 'intelligence_director'
  | 'preventer'
  | 'clarifier'
  | 'codifier'
  | 'profiler';

export interface EscortDefinition {
  id: EscortId;
  name: string;
  description: string;
  branch: 'intelligence' | 'operations' | 'social_engineering' | 'brand_authority' | 'creative_lab' | 'diplomacy';
  tier: number;
  cost: number;
  prerequisites?: string[];
}

export interface EscortResult {
  escortId: EscortId;
  result: string; // Markdown formatted result
  metadata?: Record<string, unknown>;
  timestamp: number;
}

const ESCORT_DEFINITIONS: EscortDefinition[] = [
  {
    id: 'strategist',
    name: 'The Strategist',
    description: 'Generates multiple strategic options with explicit trade-offs (speed vs. accuracy) to inform better decisions.',
    branch: 'intelligence',
    tier: 2,
    cost: 450,
    prerequisites: ['memory_weaver']
  },
  {
    id: 'analyst',
    name: 'The Analyst',
    description: 'Proactively monitors data to find trends, anomalies, and patterns. Escalates issues without needing queries.',
    branch: 'intelligence',
    tier: 2,
    cost: 450,
    prerequisites: ['memory_weaver']
  },
  {
    id: 'historian',
    name: 'The Historian',
    description: 'Critically examines the archive to evaluate trustworthiness, resolve contradictions, and build coherent narratives.',
    branch: 'intelligence',
    tier: 3,
    cost: 600,
    prerequisites: ['knowledge_sync']
  },
  {
    id: 'diagnostician',
    name: 'The Diagnostician',
    description: 'Performs deep root cause analysis for live failures, turning vague symptoms into actionable diagnoses.',
    branch: 'operations',
    tier: 2,
    cost: 450,
    prerequisites: ['workflow_overdrive']
  },
  {
    id: 'forecaster',
    name: 'The Forecaster',
    description: 'Analyzes historical and real-time data to find subtle systemic resonances that predict future problems.',
    branch: 'intelligence',
    tier: 3,
    cost: 600,
    prerequisites: ['knowledge_sync']
  },
  {
    id: 'fixer',
    name: 'The Fixer',
    description: 'Takes vetoed plans and proposes concrete, actionable solutions. Bridges criticism and creation.',
    branch: 'operations',
    tier: 2,
    cost: 450,
    prerequisites: ['workflow_overdrive']
  },
  {
    id: 'benchmarker',
    name: 'The Benchmarker',
    description: 'Provides empirical, objective performance data through gold-standard task simulations.',
    branch: 'operations',
    tier: 3,
    cost: 600,
    prerequisites: ['audit_eye']
  },
  {
    id: 'appraiser',
    name: 'The Appraiser',
    description: 'Performs rigorous, data-driven analysis comparing feasibility and strategic value of new ideas.',
    branch: 'creative_lab',
    tier: 2,
    cost: 400,
    prerequisites: ['preflection_mastery']
  },
  {
    id: 'sanity_checker',
    name: 'The Sanity Checker',
    description: 'Pre-emptively filters invalid or impossible prompts, refuting bad premises before planning begins.',
    branch: 'operations',
    tier: 1,
    cost: 300,
    prerequisites: []
  },
  {
    id: 'causal_inquisitor',
    name: 'The Causal Inquisitor',
    description: 'Answers "why" by designing queries to find the most likely cause of detected patterns.',
    branch: 'intelligence',
    tier: 3,
    cost: 600,
    prerequisites: ['knowledge_sync']
  },
  {
    id: 'intelligence_director',
    name: 'The Intelligence Director',
    description: 'Provides strategic guidance, directing focus and amplifying scrutiny for mission-critical subsystems.',
    branch: 'intelligence',
    tier: 3,
    cost: 600,
    prerequisites: ['knowledge_sync']
  },
  {
    id: 'preventer',
    name: 'The Preventer',
    description: 'Proposes systemic fixes at the architectural level to eliminate entire classes of problems.',
    branch: 'operations',
    tier: 3,
    cost: 600,
    prerequisites: ['audit_eye']
  },
  {
    id: 'clarifier',
    name: 'The Clarifier',
    description: 'Interactive partner that asks for clarification on ambiguous prompts and proposes specific fixes.',
    branch: 'social_engineering',
    tier: 2,
    cost: 400,
    prerequisites: ['social_basics']
  },
  {
    id: 'codifier',
    name: 'The Codifier',
    description: 'Analyzes successful execution records and generalizes them into abstract, reusable strategic templates.',
    branch: 'intelligence',
    tier: 3,
    cost: 600,
    prerequisites: ['knowledge_sync']
  },
  {
    id: 'profiler',
    name: 'The Profiler',
    description: 'Provides contextual intelligence integrating user history and detecting subtle patterns of intent.',
    branch: 'social_engineering',
    tier: 2,
    cost: 400,
    prerequisites: ['social_basics']
  }
];

export const getEscortDefinition = (id: EscortId): EscortDefinition | undefined => {
  return ESCORT_DEFINITIONS.find(e => e.id === id);
};

export const getAllEscortDefinitions = (): EscortDefinition[] => {
  return ESCORT_DEFINITIONS;
};

// Core Escort execution functions
export const executeStrategist = async (prompt: string, context?: { messages?: ChatMessage[] }): Promise<EscortResult> => {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  const memories = await getAllMemories();
  const recentMemories = memories.slice(-10).map(m => `- ${m.summary} (tags: ${m.tags.join(', ')})`).join('\n');

  const systemPrompt = `You are The Strategist, a multi-option planner. Generate 3-5 distinct strategic approaches to the user's request, explicitly contrasting trade-offs (speed vs. accuracy, cost vs. quality, risk vs. reward).

For each option, provide:
1. **Approach Name**: A clear, memorable title
2. **Strategy**: Brief description of the approach
3. **Trade-offs**: Explicit pros and cons
4. **Best For**: When this approach is optimal
5. **Risks**: Potential downsides or failure modes

Format your response as clear markdown with headers and bullet points.`;

  const userPrompt = `**User Request**: ${prompt}

**Recent Context**:
${recentMemories || 'No recent memories'}

Generate strategic options with explicit trade-offs.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`API Error: ${data.error?.message || 'Invalid response'}`);
  }

  return {
    escortId: 'strategist',
    result: data.choices[0].message.content,
    timestamp: Date.now()
  };
};

export const executeAnalyst = async (context?: { messages?: ChatMessage[] }): Promise<EscortResult> => {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  const [memories, clients, brand, threads] = await Promise.all([
    getAllMemories(),
    getAllClientProfiles(),
    getBrandIntelligence(),
    getAllThreads()
  ]);

  const recentMemories = memories.slice(-20);
  const memorySummaries = recentMemories.map(m => m.summary).join('\n');
  const clientCount = clients.length;
  const threadCount = threads.length;
  const brandConfigured = brand ? 'Yes' : 'No';

  const systemPrompt = `You are The Analyst, a proactive data scientist. Analyze the system's data to find trends, anomalies, and patterns. Identify potential issues before they become problems.

Provide insights in markdown format with:
1. **Key Trends**: What patterns are emerging?
2. **Anomalies**: Any unusual data points?
3. **Concerns**: Potential issues to watch
4. **Recommendations**: Actionable suggestions`;

  const userPrompt = `**System State**:
- Recent Memories: ${recentMemories.length} analyzed
- Client Profiles: ${clientCount}
- Brand Configured: ${brandConfigured}
- Active Threads: ${threadCount}

**Recent Memory Summaries**:
${memorySummaries || 'No memories yet'}

Analyze this data and provide insights.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5
    })
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`API Error: ${data.error?.message || 'Invalid response'}`);
  }

  return {
    escortId: 'analyst',
    result: data.choices[0].message.content,
    timestamp: Date.now()
  };
};

export const executeHistorian = async (query?: string): Promise<EscortResult> => {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  const memories = await getAllMemories();
  const sortedMemories = memories.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
  
  const memoryData = sortedMemories.map(m => ({
    summary: m.summary,
    tags: m.tags,
    timestamp: new Date(m.timestamp).toISOString(),
    relevance: m.relevance
  }));

  const systemPrompt = `You are The Historian, a truth-seeking critical examiner. Analyze historical records to evaluate trustworthiness, resolve contradictions, and build coherent narratives.

Provide analysis in markdown with:
1. **Timeline Overview**: Major events and patterns
2. **Contradictions**: Inconsistencies found and resolution
3. **Narrative Arc**: What story does the data tell?
4. **Lessons Learned**: What can we learn from history?`;

  const userPrompt = query 
    ? `**Query**: ${query}\n\n**Historical Data**:\n${JSON.stringify(memoryData, null, 2)}`
    : `**Historical Data**:\n${JSON.stringify(memoryData, null, 2)}\n\nAnalyze this history and provide insights.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6
    })
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`API Error: ${data.error?.message || 'Invalid response'}`);
  }

  return {
    escortId: 'historian',
    result: data.choices[0].message.content,
    timestamp: Date.now()
  };
};

export const executeDiagnostician = async (problem: string, context?: { messages?: ChatMessage[] }): Promise<EscortResult> => {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  const systemPrompt = `You are The Diagnostician, a root cause analysis specialist. When a problem is reported, perform deep analysis to pinpoint the exact root cause.

Provide diagnosis in markdown with:
1. **Symptom Analysis**: What is the observable problem?
2. **Root Cause**: The underlying issue
3. **Contributing Factors**: What led to this?
4. **Impact Assessment**: How severe is this?
5. **Recommended Fix**: Specific, actionable solution`;

  const userPrompt = `**Problem Reported**: ${problem}

${context?.messages ? `**Recent Context**:\n${context.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n\n')}` : ''}

Perform root cause analysis.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5
    })
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`API Error: ${data.error?.message || 'Invalid response'}`);
  }

  return {
    escortId: 'diagnostician',
    result: data.choices[0].message.content,
    timestamp: Date.now()
  };
};

// Placeholder implementations for remaining escorts
const executeForecaster = async (context?: { messages?: ChatMessage[] }): Promise<EscortResult> => {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  if (!apiKey) throw new Error('OpenAI API key not configured.');

  const memories = await getAllMemories();
  const recentTrends = memories.slice(-30).map(m => m.summary).join('\n');

  const systemPrompt = `You are The Forecaster, a predictive analyst. Analyze historical and real-time data to find subtle systemic resonances that predict future problems.

Provide forecast in markdown with:
1. **Emerging Patterns**: What trends are developing?
2. **Risk Factors**: Potential problems on the horizon
3. **Timeline**: When might issues emerge?
4. **Recommendations**: Preventative actions`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze recent trends:\n${recentTrends || 'No data yet'}` }
      ],
      temperature: 0.6
    })
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`API Error: ${data.error?.message || 'Invalid response'}`);
  }

  return {
    escortId: 'forecaster',
    result: data.choices[0].message.content,
    timestamp: Date.now()
  };
};

const executeFixer = async (problem: string, context?: { messages?: ChatMessage[] }): Promise<EscortResult> => {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  if (!apiKey) throw new Error('OpenAI API key not configured.');

  const systemPrompt = `You are The Fixer, a constructive problem-solver. Take a broken plan or strategy and propose concrete, actionable solutions.

Provide solution in markdown with:
1. **Problem Summary**: What's broken?
2. **Root Cause**: Why did it fail?
3. **Proposed Fix**: Specific, actionable solution
4. **Implementation Steps**: How to execute the fix
5. **Prevention**: How to avoid this in future`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `**Problem**: ${problem}\n\nPropose a concrete fix.` }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`API Error: ${data.error?.message || 'Invalid response'}`);
  }

  return {
    escortId: 'fixer',
    result: data.choices[0].message.content,
    timestamp: Date.now()
  };
};

export const executeEscort = async (
  escortId: EscortId,
  input: string | undefined,
  context?: { messages?: ChatMessage[] }
): Promise<EscortResult> => {
  switch (escortId) {
    case 'strategist':
      return executeStrategist(input || '', context);
    case 'analyst':
      return executeAnalyst(context);
    case 'historian':
      return executeHistorian(input);
    case 'diagnostician':
      return executeDiagnostician(input || 'No problem specified', context);
    case 'forecaster':
      return executeForecaster(context);
    case 'fixer':
      return executeFixer(input || 'No problem specified', context);
    default:
      throw new Error(`Escort ${escortId} not yet implemented. Coming soon!`);
  }
};

