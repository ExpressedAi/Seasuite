import { RankDefinition, SkillBranchId, SkillDefinition } from '../types';

export const SKILL_BRANCHES: Record<SkillBranchId, { title: string; color: string; summary: string }> = {
    social_engineering: {
        title: 'Social Engineering',
        color: 'from-rose-500 to-orange-500',
        summary: 'Influence conversations, defuse pressure, and orchestrate team chemistry.'
    },
    brand_authority: {
        title: 'Brand Authority',
        color: 'from-sky-500 to-blue-500',
        summary: 'Strengthen positioning, craft messages, and convert prospects.'
    },
    operations: {
        title: 'Operational Mastery',
        color: 'from-emerald-500 to-lime-500',
        summary: 'Run tighter pipelines, tasking, and post-processing at scale.'
    },
    creative_lab: {
        title: 'Creative Lab',
        color: 'from-purple-500 to-pink-500',
        summary: 'Unlock experimental modes, prompt rewrites, and ideation boosters.'
    },
    intelligence: {
        title: 'Collective Intelligence',
        color: 'from-amber-500 to-yellow-500',
        summary: 'Harness memories, knowledge graphs, and strategic forecasting.'
    },
    diplomacy: {
        title: 'Diplomacy',
        color: 'from-cyan-500 to-teal-500',
        summary: 'Manage secrets, negotiations, and covert alliances.'
    }
};

export const RANKS: RankDefinition[] = [
    { id: 'novice', title: 'Novice Operative', minTotalXp: 0, badgeColor: '#94a3b8' },
    { id: 'envoy', title: 'Boardroom Envoy', minTotalXp: 400, badgeColor: '#38bdf8' },
    { id: 'strategist', title: 'Arc Strategist', minTotalXp: 1200, badgeColor: '#22c55e' },
    { id: 'architect', title: 'Systems Architect', minTotalXp: 2500, badgeColor: '#a855f7' },
    { id: 'maestro', title: 'Simulation Maestro', minTotalXp: 4200, badgeColor: '#f97316' },
    { id: 'council', title: 'Delta Councilor', minTotalXp: 6500, badgeColor: '#eab308' }
];

export const SKILLS: SkillDefinition[] = [
    {
        id: 'social_basics',
        branch: 'social_engineering',
        tier: 1,
        cost: 200,
        title: 'Baseline Rapport',
        description: 'Earn more XP from public praise and keep your tone analyzer enabled.',
        rewards: [{ type: 'stat', stat: 'xp_multiplier', value: 1.05 }]
    },
    {
        id: 'pressure_dial',
        branch: 'social_engineering',
        tier: 1,
        cost: 300,
        title: 'Pressure Dial',
        description: 'Unlock pressure tracking chips in chat and gain 10% XP for pressure defusion.',
        prerequisites: ['social_basics'],
        rewards: [{ type: 'panel', panelId: 'social_feed' }]
    },
    {
        id: 'diplomatic_channel',
        branch: 'social_engineering',
        tier: 2,
        cost: 450,
        title: 'Diplomatic Channel',
        description: 'Gain the ability to redirect pressure to a DM follow-up with one click.',
        prerequisites: ['pressure_dial'],
        rewards: [{ type: 'perk', id: 'pressure_redirect' }]
    },
    {
        id: 'brand_tonekit',
        branch: 'brand_authority',
        tier: 1,
        cost: 200,
        title: 'Tone Calibration Kit',
        description: 'Unlock the Brand Canon panel enhancements and earn XP from brand updates.',
        rewards: [{ type: 'panel', panelId: 'brand_insights' }]
    },
    {
        id: 'brand_consistency',
        branch: 'brand_authority',
        tier: 2,
        cost: 400,
        title: 'Brand Consistency Matrix',
        description: 'Increase memory XP from brand-related tags by 15%.',
        prerequisites: ['brand_tonekit'],
        rewards: [{ type: 'stat', stat: 'xp_multiplier', value: 1.15 }]
    },
    {
        id: 'workflow_overdrive',
        branch: 'operations',
        tier: 1,
        cost: 250,
        title: 'Workflow Overdrive',
        description: 'Unlock Task List module toggle and earn XP for completed tasks.',
        rewards: [{ type: 'toggle', feature: 'taskList' }]
    },
    {
        id: 'audit_eye',
        branch: 'operations',
        tier: 2,
        cost: 450,
        title: 'Audit Eye',
        description: 'Enable Audit Mode and gain XP whenever audits surface actionable insights.',
        prerequisites: ['workflow_overdrive'],
        rewards: [{ type: 'toggle', feature: 'audit' }]
    },
    {
        id: 'preflection_mastery',
        branch: 'creative_lab',
        tier: 1,
        cost: 250,
        title: 'Preflection Mastery',
        description: 'Unlock Preflection toggle and earn XP from deep reasoning responses.',
        rewards: [{ type: 'toggle', feature: 'preflection' }]
    },
    {
        id: 'internal_voice',
        branch: 'creative_lab',
        tier: 2,
        cost: 400,
        title: 'Internal Voice',
        description: 'Unlock Internal Monologue and gain XP from narrative-rich responses.',
        prerequisites: ['preflection_mastery'],
        rewards: [{ type: 'toggle', feature: 'monologue' }]
    },
    {
        id: 'stagecraft',
        branch: 'creative_lab',
        tier: 3,
        cost: 600,
        title: 'Stagecraft',
        description: 'Unlock stage directions and increase celebration XP by 20%.',
        prerequisites: ['internal_voice'],
        rewards: [{ type: 'toggle', feature: 'stageDirections' }]
    },
    {
        id: 'memory_weaver',
        branch: 'intelligence',
        tier: 1,
        cost: 250,
        title: 'Memory Weaver',
        description: 'Unlock advanced memory capture and earn XP for high-relevance saves.',
        rewards: [{ type: 'toggle', feature: 'memoryCapture' }]
    },
    {
        id: 'knowledge_sync',
        branch: 'intelligence',
        tier: 2,
        cost: 450,
        title: 'Knowledge Sync',
        description: 'Gain XP from knowledge graph connections and unlock progression overlay.',
        prerequisites: ['memory_weaver'],
        rewards: [{ type: 'panel', panelId: 'progression' }]
    },
    {
        id: 'covert_ops',
        branch: 'diplomacy',
        tier: 1,
        cost: 250,
        title: 'Covert Ops',
        description: 'Gain XP from secrets and unlock the ability to label DM missions.',
        rewards: [{ type: 'perk', id: 'dm_mission_labels' }]
    },
    {
        id: 'shadow_network',
        branch: 'diplomacy',
        tier: 2,
        cost: 450,
        title: 'Shadow Network',
        description: 'Secrets revealed to allies grant 20% more XP.',
        prerequisites: ['covert_ops'],
        rewards: [{ type: 'stat', stat: 'xp_multiplier', value: 1.2 }]
    },
    {
        id: 'prompt_rewrite_plus',
        branch: 'creative_lab',
        tier: 2,
        cost: 350,
        title: 'Prompt Rewrite+ ',
        description: 'Unlock enhanced prompt rewrite controls and earn XP for polished prompts.',
        prerequisites: ['preflection_mastery'],
        rewards: [{ type: 'toggle', feature: 'promptRewrite' }]
    },
    // Escorts - Cognitive Architecture Agents
    {
        id: 'escort_strategist',
        branch: 'intelligence',
        tier: 2,
        cost: 450,
        title: 'The Strategist',
        description: 'Unlock multi-option strategic planning with explicit trade-offs.',
        prerequisites: ['memory_weaver'],
        rewards: [{ type: 'escort', escortId: 'strategist' }]
    },
    {
        id: 'escort_analyst',
        branch: 'intelligence',
        tier: 2,
        cost: 450,
        title: 'The Analyst',
        description: 'Proactive pattern detection and trend analysis across system data.',
        prerequisites: ['memory_weaver'],
        rewards: [{ type: 'escort', escortId: 'analyst' }]
    },
    {
        id: 'escort_historian',
        branch: 'intelligence',
        tier: 3,
        cost: 600,
        title: 'The Historian',
        description: 'Critical examination of archives to build coherent historical narratives.',
        prerequisites: ['knowledge_sync'],
        rewards: [{ type: 'escort', escortId: 'historian' }]
    },
    {
        id: 'escort_diagnostician',
        branch: 'operations',
        tier: 2,
        cost: 450,
        title: 'The Diagnostician',
        description: 'Deep root cause analysis for operational failures and issues.',
        prerequisites: ['workflow_overdrive'],
        rewards: [{ type: 'escort', escortId: 'diagnostician' }]
    },
    {
        id: 'escort_forecaster',
        branch: 'intelligence',
        tier: 3,
        cost: 600,
        title: 'The Forecaster',
        description: 'Predictive analysis of systemic trends and future problems.',
        prerequisites: ['knowledge_sync'],
        rewards: [{ type: 'escort', escortId: 'forecaster' }]
    },
    {
        id: 'escort_fixer',
        branch: 'operations',
        tier: 2,
        cost: 450,
        title: 'The Fixer',
        description: 'Proposes concrete solutions for vetoed plans and broken strategies.',
        prerequisites: ['workflow_overdrive'],
        rewards: [{ type: 'escort', escortId: 'fixer' }]
    },
    {
        id: 'escort_benchmarker',
        branch: 'operations',
        tier: 3,
        cost: 600,
        title: 'The Benchmarker',
        description: 'Empirical performance data through gold-standard task simulations.',
        prerequisites: ['audit_eye'],
        rewards: [{ type: 'escort', escortId: 'benchmarker' }]
    },
    {
        id: 'escort_appraiser',
        branch: 'creative_lab',
        tier: 2,
        cost: 400,
        title: 'The Appraiser',
        description: 'Rigorous evaluation of idea feasibility and strategic value.',
        prerequisites: ['preflection_mastery'],
        rewards: [{ type: 'escort', escortId: 'appraiser' }]
    },
    {
        id: 'escort_sanity_checker',
        branch: 'operations',
        tier: 1,
        cost: 300,
        title: 'The Sanity Checker',
        description: 'Pre-emptive validation and refutation of invalid prompts.',
        prerequisites: [],
        rewards: [{ type: 'escort', escortId: 'sanity_checker' }]
    },
    {
        id: 'escort_causal_inquisitor',
        branch: 'intelligence',
        tier: 3,
        cost: 600,
        title: 'The Causal Inquisitor',
        description: 'Finds root causes by designing targeted analytical queries.',
        prerequisites: ['knowledge_sync'],
        rewards: [{ type: 'escort', escortId: 'causal_inquisitor' }]
    },
    {
        id: 'escort_intelligence_director',
        branch: 'intelligence',
        tier: 3,
        cost: 600,
        title: 'The Intelligence Director',
        description: 'Strategic guidance for intelligence gathering and analysis focus.',
        prerequisites: ['knowledge_sync'],
        rewards: [{ type: 'escort', escortId: 'intelligence_director' }]
    },
    {
        id: 'escort_preventer',
        branch: 'operations',
        tier: 3,
        cost: 600,
        title: 'The Preventer',
        description: 'Proposes systemic architectural fixes to eliminate problem classes.',
        prerequisites: ['audit_eye'],
        rewards: [{ type: 'escort', escortId: 'preventer' }]
    },
    {
        id: 'escort_clarifier',
        branch: 'social_engineering',
        tier: 2,
        cost: 400,
        title: 'The Clarifier',
        description: 'Interactive prompt refinement and ambiguity resolution.',
        prerequisites: ['social_basics'],
        rewards: [{ type: 'escort', escortId: 'clarifier' }]
    },
    {
        id: 'escort_codifier',
        branch: 'intelligence',
        tier: 3,
        cost: 600,
        title: 'The Codifier',
        description: 'Transforms successful executions into reusable strategic templates.',
        prerequisites: ['knowledge_sync'],
        rewards: [{ type: 'escort', escortId: 'codifier' }]
    },
    {
        id: 'escort_profiler',
        branch: 'social_engineering',
        tier: 2,
        cost: 400,
        title: 'The Profiler',
        description: 'Contextual intelligence integrating user history and intent patterns.',
        prerequisites: ['social_basics'],
        rewards: [{ type: 'escort', escortId: 'profiler' }]
    }
];

export const getRankForXp = (xp: number): RankDefinition => {
    const ordered = [...RANKS].sort((a, b) => b.minTotalXp - a.minTotalXp);
    return ordered.find(rank => xp >= rank.minTotalXp) || RANKS[0];
};

export const getSkillDefinition = (id: string): SkillDefinition | undefined => SKILLS.find(skill => skill.id === id);

export const getBranchSkills = (branch: SkillBranchId): SkillDefinition[] => SKILLS.filter(skill => skill.branch === branch).sort((a, b) => a.tier - b.tier || a.cost - b.cost);

