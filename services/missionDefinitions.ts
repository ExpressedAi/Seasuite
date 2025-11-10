import { MissionDefinition } from '../types';

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    id: 'mission_pressure_diffuse_1',
    branch: 'social_engineering',
    title: 'Cool the Room',
    description: 'Diffuse 5 pressure spikes in public conversation.',
    target: 5,
    metric: 'pressure_diffused',
    rewardXp: 120,
    expiresInHours: 24
  },
  {
    id: 'mission_secret_ops_1',
    branch: 'diplomacy',
    title: 'Whisper Network',
    description: 'Share 3 private secrets via DMs.',
    target: 3,
    metric: 'secret_shared',
    rewardXp: 140,
    expiresInHours: 24
  },
  {
    id: 'mission_brand_push_1',
    branch: 'brand_authority',
    title: 'Brand Pulse',
    description: 'Update brand canon twice in a day.',
    target: 2,
    metric: 'brand_update',
    rewardXp: 110,
    expiresInHours: 24
  },
  {
    id: 'mission_memory_weave_1',
    branch: 'intelligence',
    title: 'Memory Weaver',
    description: 'Capture 4 high-relevance memories.',
    target: 4,
    metric: 'memory_capture',
    rewardXp: 100,
    expiresInHours: 24
  },
  {
    id: 'mission_client_success_1',
    branch: 'brand_authority',
    title: 'Customer Whisperer',
    description: 'Save or update 3 client profiles.',
    target: 3,
    metric: 'client_success',
    rewardXp: 130,
    expiresInHours: 24
  },
  {
    id: 'mission_drama_watch_1',
    branch: 'intelligence',
    title: 'Drama Watch',
    description: 'Trigger or observe 2 dramatic events.',
    target: 2,
    metric: 'drama_event',
    rewardXp: 115,
    expiresInHours: 24
  }
];

export const DAILY_MISSION_COUNT = 4;

