import { Memory, ClientProfile, BrandIntelligence, PerformerProfile, JournalEntry, KnowledgeEntity, PerformerInteractionEvent } from '../types';
import { 
  getAllClientProfiles, 
  getClientProfile, 
  saveClientProfile,
  getBrandIntelligence, 
  saveBrandIntelligence,
  getAllPerformers,
  getPerformerById,
  savePerformer,
  getJournalEntry,
  upsertJournalEntry,
  getEntity,
  getAllEntities,
  saveKnowledgeEntity,
  addPerformerInteractionEvents,
  updateMemory
} from './db';
import { loadAiSettings } from './aiService';
import { logIntelligence } from './intelligenceLog';

interface ProcessingResult {
  clientUpdates: Array<{ id: string; updates: Partial<ClientProfile> }>;
  brandUpdates: Partial<BrandIntelligence> | null;
  performerUpdates: Array<{ id: string; updates: Partial<PerformerProfile> }>;
  calendarEntries: Array<{ date: string; content: string }>;
  knowledgeConnections: Array<{ entity: string; relationships: Record<string, string[]> }>;
  interactionEvents: PerformerInteractionEvent[];
  rerankedRelevance: number;
  reasoning: string;
}

export async function processMemory(memory: Memory): Promise<ProcessingResult> {
  const settings = loadAiSettings();
  const apiKey = settings.openaiApiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.');
  }

  // Gather context
  const [clients, brand, performers, knowledge] = await Promise.all([
    getAllClientProfiles(),
    getBrandIntelligence(),
    getAllPerformers(),
    getAllEntities()
  ]);

  const prompt = `You are a memory post-processing agent. Analyze this memory and extract actionable intelligence to route to different parts of the system.

MEMORY:
Summary: ${memory.summary}
Tags: ${memory.tags.join(', ')}
Conversation: ${memory.conversation}

EXISTING CONTEXT:
Clients: ${clients.map(c => `${c.name} (${c.company})`).join(', ')}
Brand: ${brand ? 'Configured' : 'Not configured'}
Performers: ${performers.map(p => p.name).join(', ')}
Knowledge Entities: ${knowledge.map(k => k.name).join(', ')}

TASK: Extract and route information to:
1. CLIENT UPDATES - Any insights about existing or new clients (pain points, goals, personality, opportunities, history, notes, company, industry, role, budget, decisionProcess, communicationStyle, objections)
2. BRAND UPDATES - Insights about our mission, vision, values, positioning, strategy, tone, or constraints. Available fields: mission, vision, values, targetAudience, uniqueValue, goals, tone, keyMessages, competitiveEdge, constraints
3. PERFORMER UPDATES - Biographical details, personality traits, or role descriptions for performers
4. CALENDAR ENTRIES - Time-sensitive commitments, deadlines, or scheduled events
5. KNOWLEDGE CONNECTIONS - Conceptual relationships between entities
6. INTERACTION EVENTS - Notable interactions between performers or with user
7. RELEVANCE RERANK - Reassess memory importance (1-10 scale)

IMPORTANT: When extracting brand information:
- If the user mentions a brand name, company name, or mission statement, extract it as a "mission" update
- If they mention target audience, customer base, or who we serve, extract as "targetAudience"
- If they mention values, principles, or what we stand for, extract as "values"
- If they mention vision, future goals, or long-term aspirations, extract as "vision"
- If they mention tone, voice, or communication style, extract as "tone"
- If they mention goals, priorities, or current objectives, extract as "goals"
- If they mention unique value, differentiation, or competitive advantage, extract as "uniqueValue" or "competitiveEdge"
- If they mention key messages or talking points, extract as "keyMessages"
- If they mention constraints, boundaries, or limitations, extract as "constraints"

Respond in JSON:
{
  "clientUpdates": [{"clientName": "name", "field": "painPoints|goals|personality|opportunities|history|notes|company|industry|role|budget|decisionProcess|communicationStyle|objections", "content": "text"}],
  "brandUpdates": {"field": "mission|vision|values|targetAudience|uniqueValue|goals|tone|keyMessages|competitiveEdge|constraints", "content": "text"} or null,
  "performerUpdates": [{"performerName": "name", "field": "description|roleDescription", "content": "text"}],
  "calendarEntries": [{"date": "YYYY-MM-DD", "content": "text"}],
  "knowledgeConnections": [{"entity": "name", "relatedTo": ["entity1", "entity2"], "relationshipType": "type"}],
  "interactionEvents": [{"participants": ["name1", "name2"], "intrigueTags": ["tag"], "sentiment": -1 to 1}],
  "rerankedRelevance": 1-10,
  "reasoning": "brief explanation"
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
  
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`API Error: ${data.error?.message || 'Invalid response'}`);
  }
  
  const json = JSON.parse(data.choices[0].message.content);

  // Map to actual IDs and structure
  const clientUpdates = json.clientUpdates?.map((u: any) => {
    const client = clients.find(c => c.name.toLowerCase().includes(u.clientName.toLowerCase()));
    if (!client) return null;
    return {
      id: client.id,
      updates: { [u.field]: (client[u.field as keyof ClientProfile] || '') + '\n\n' + u.content }
    };
  }).filter(Boolean) || [];

  const performerUpdates = json.performerUpdates?.map((u: any) => {
    const performer = performers.find(p => p.name.toLowerCase().includes(u.performerName.toLowerCase()));
    if (!performer) return null;
    return {
      id: performer.id,
      updates: { [u.field]: u.content }
    };
  }).filter(Boolean) || [];

  // Process knowledge connections - the AI returns them with 'relatedTo' but we need to structure them properly
  const knowledgeConnections = (json.knowledgeConnections || []).map((conn: any) => ({
    entity: conn.entity,
    relatedTo: Array.isArray(conn.relatedTo) ? conn.relatedTo : [],
    relationshipType: conn.relationshipType || 'related_to'
  }));

  return {
    clientUpdates,
    brandUpdates: json.brandUpdates ? { [json.brandUpdates.field]: json.brandUpdates.content } : null,
    performerUpdates,
    calendarEntries: json.calendarEntries || [],
    knowledgeConnections,
    interactionEvents: json.interactionEvents?.map((e: any) => ({
      id: `interaction_${Date.now()}_${Math.random()}`,
      conversationId: memory.id?.toString() || '',
      speakerId: 'system',
      speakerName: 'Memory Processor',
      speakerType: 'sylvia' as const,
      targetIds: [],
      targetNames: e.participants,
      timestamp: Date.now(),
      messageId: memory.id?.toString() || '',
      intrigueTags: e.intrigueTags,
      sentiment: e.sentiment,
      narrativeTags: []
    })) || [],
    rerankedRelevance: json.rerankedRelevance || memory.relevance,
    reasoning: json.reasoning || ''
  };
}

export async function applyProcessingResult(memoryId: number, result: ProcessingResult): Promise<void> {
  // Update clients
  for (const update of result.clientUpdates) {
    const client = await getClientProfile(update.id);
    if (client) {
      await saveClientProfile({ ...client, ...update.updates, updatedAt: Date.now() });
      logIntelligence({
        source: 'client_update',
        category: 'client',
        summary: `Memory processing updated client ${client.name}`,
        requestPayload: {
          clientId: update.id,
          updates: update.updates
        }
      });
      // Dispatch event to notify pages that client data has changed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('client-data-updated', { detail: { clientId: update.id } }));
      }
    }
  }

  // Update brand
  if (result.brandUpdates) {
    const brand = await getBrandIntelligence() || { updatedAt: Date.now() };
    const updatedBrand = { ...brand, ...result.brandUpdates, updatedAt: Date.now() };
    await saveBrandIntelligence(updatedBrand);
    logIntelligence({
      source: 'brand_update',
      category: 'brand',
      summary: `Memory processing applied brand insight: ${Object.keys(result.brandUpdates).join(', ')}`,
      requestPayload: result.brandUpdates
    });
    // Dispatch event to notify pages that brand data has changed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brand-data-updated'));
    }
  }

  // Update performers
  for (const update of result.performerUpdates) {
    const performer = await getPerformerById(update.id);
    if (performer) {
      await savePerformer({ ...performer, ...update.updates, updatedAt: Date.now() });
    }
  }

  // Add calendar entries
  for (const entry of result.calendarEntries) {
    try {
      const existing = await getJournalEntry(entry.date);
      const content = existing ? `${existing.content}\n\n${entry.content}` : entry.content;
      await upsertJournalEntry({ date: entry.date, content });
      logIntelligence({
        source: 'calendar_entry',
        category: 'operations',
        summary: `Calendar entry added for ${entry.date}`,
        requestPayload: {
          date: entry.date,
          content: entry.content
        }
      });
    } catch (error) {
      console.error(`Failed to save calendar entry for ${entry.date}:`, error);
    }
  }

  // Add knowledge connections
  for (const conn of result.knowledgeConnections) {
    try {
      const entity = await getEntity(conn.entity);
      const relationships = entity?.relationships || {};
      for (const related of conn.relatedTo) {
        if (!relationships[conn.relationshipType]) {
          relationships[conn.relationshipType] = [];
        }
        if (!relationships[conn.relationshipType].includes(related)) {
          relationships[conn.relationshipType].push(related);
        }
      }
      await saveKnowledgeEntity({
        name: conn.entity,
        relationships,
        updatedAt: Date.now(),
        createdAt: entity?.createdAt || Date.now()
      });
      logIntelligence({
        source: 'knowledge_connection',
        category: 'operations',
        summary: `Knowledge connection created: ${conn.entity} → ${conn.relatedTo.join(', ')}`,
        requestPayload: {
          entity: conn.entity,
          relationshipType: conn.relationshipType,
          relatedTo: conn.relatedTo
        }
      });
    } catch (error) {
      console.error(`Failed to save knowledge connection for ${conn.entity}:`, error);
    }
  }

  // Add interaction events
  if (result.interactionEvents.length > 0) {
    await addPerformerInteractionEvents(result.interactionEvents);
  }

  // Update memory relevance
  const memory = { id: memoryId, relevance: result.rerankedRelevance } as Memory;
  await updateMemory(memory);
}
