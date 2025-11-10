import { PerformerRelationship, PerformerSecret, DramaEvent, CoordinationPlan, RelationshipType, SecretType } from '../types';
import { 
  getRelationship, 
  saveRelationship, 
  saveSecret, 
  saveDramaEvent,
  saveCoordinationPlan,
  upsertJournalEntry,
  getJournalEntry,
  getPerformerById,
  savePerformer
} from './db';
import { loadAiSettings } from './aiService';

interface RelationshipAnalysis {
  relationships: Array<{
    performerId: string;
    targetId: string;
    type: RelationshipType;
    intensity: number;
    trust: number;
    tension: number;
    attraction?: number;
    notes: string;
  }>;
  secrets: Array<{
    performerId: string;
    type: SecretType;
    content: string;
    knownBy: string[];
    impact: number;
  }>;
  drama: Array<{
    type: 'conflict' | 'alliance' | 'betrayal' | 'confession' | 'revelation' | 'romance';
    participants: string[];
    description: string;
    intensity: number;
  }>;
  coordination: Array<{
    initiatorId: string;
    participants: string[];
    goal: string;
    secret: boolean;
  }>;
  journalEntry?: string;
  performerUpdates: Array<{
    performerId: string;
    personalityUpdate?: string;
    relationshipNote?: string;
  }>;
}

export async function analyzeRelationshipDynamics(
  messageContent: string,
  speakerId: string,
  targetIds: string[],
  conversationId: string,
  messageId: string
): Promise<RelationshipAnalysis | null> {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  
  if (!apiKey) return null;

  const performers = await Promise.all([speakerId, ...targetIds].map(id => getPerformerById(id)));
  const performerNames = performers.filter(Boolean).map(p => p!.name).join(', ');

  const prompt = `Analyze this conversation for relationship dynamics, drama, and intrigue.

MESSAGE: ${messageContent}
PARTICIPANTS: ${performerNames}

Detect:
1. RELATIONSHIPS - Type (ally/rival/mentor/romantic/suspicious), intensity (0-100), trust (0-100), tension (0-100), attraction if romantic (0-100)
2. SECRETS - Personal/strategic/romantic/betrayal/ambition secrets, who knows, impact (0-100)
3. DRAMA - Conflicts, alliances, betrayals, confessions, revelations, romance moments with intensity (0-100)
4. COORDINATION - Secret plans, team goals, who's involved
5. JOURNAL - One sentence for today's journal about this interaction
6. PERFORMER UPDATES - Personality insights or relationship notes to add to performer bios

Return JSON:
{
  "relationships": [{"performerId": "id", "targetId": "id", "type": "ally|rival|mentor|romantic|suspicious", "intensity": 0-100, "trust": 0-100, "tension": 0-100, "attraction": 0-100, "notes": "text"}],
  "secrets": [{"performerId": "id", "type": "personal|strategic|romantic|betrayal|ambition", "content": "text", "knownBy": ["id"], "impact": 0-100}],
  "drama": [{"type": "conflict|alliance|betrayal|confession|revelation|romance", "participants": ["id"], "description": "text", "intensity": 0-100}],
  "coordination": [{"initiatorId": "id", "participants": ["id"], "goal": "text", "secret": true|false}],
  "journalEntry": "text",
  "performerUpdates": [{"performerId": "id", "personalityUpdate": "text", "relationshipNote": "text"}]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) return null;

  return JSON.parse(data.choices[0].message.content);
}

export async function applyRelationshipAnalysis(
  analysis: RelationshipAnalysis,
  conversationId: string,
  messageId: string
): Promise<void> {
  const timestamp = Date.now();

  // Update relationships
  for (const rel of analysis.relationships) {
    const existing = await getRelationship(rel.performerId, rel.targetId);
    const relationship: PerformerRelationship = {
      id: existing?.id || `rel_${rel.performerId}_${rel.targetId}`,
      performerId: rel.performerId,
      targetId: rel.targetId,
      type: rel.type,
      intensity: rel.intensity,
      trust: rel.trust,
      tension: rel.tension,
      attraction: rel.attraction,
      lastInteraction: timestamp,
      history: [...(existing?.history || []), rel.notes],
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp
    };
    await saveRelationship(relationship);
  }

  // Save secrets
  for (const secret of analysis.secrets) {
    await saveSecret({
      id: `secret_${timestamp}_${Math.random()}`,
      performerId: secret.performerId,
      type: secret.type,
      content: secret.content,
      knownBy: secret.knownBy,
      impact: secret.impact,
      createdAt: timestamp
    });
  }

  // Save drama events
  for (const drama of analysis.drama) {
    await saveDramaEvent({
      id: `drama_${timestamp}_${Math.random()}`,
      type: drama.type,
      participants: drama.participants,
      description: drama.description,
      intensity: drama.intensity,
      timestamp,
      conversationId,
      messageId
    });
  }

  // Save coordination plans
  for (const plan of analysis.coordination) {
    await saveCoordinationPlan({
      id: `coord_${timestamp}_${Math.random()}`,
      initiatorId: plan.initiatorId,
      participants: plan.participants,
      goal: plan.goal,
      secret: plan.secret,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  // Add to journal
  if (analysis.journalEntry) {
    const today = new Date().toISOString().split('T')[0];
    const existing = await getJournalEntry(today);
    const content = existing 
      ? `${existing.content}\n\n${analysis.journalEntry}`
      : analysis.journalEntry;
    await upsertJournalEntry({ date: today, content });
  }

  // Update performer bios
  for (const update of analysis.performerUpdates) {
    const performer = await getPerformerById(update.performerId);
    if (performer) {
      const updates: any = {};
      if (update.personalityUpdate) {
        updates.description = performer.description 
          ? `${performer.description}\n\n${update.personalityUpdate}`
          : update.personalityUpdate;
      }
      if (update.relationshipNote) {
        updates.roleDescription = performer.roleDescription
          ? `${performer.roleDescription}\n\n${update.relationshipNote}`
          : update.relationshipNote;
      }
      await savePerformer({ ...performer, ...updates, updatedAt: Date.now() });
    }
  }
}
