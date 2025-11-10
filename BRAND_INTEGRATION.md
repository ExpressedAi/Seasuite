# Brand Intelligence & Client Profiles Integration Guide

## Overview
Two new knowledge layers have been added to enhance AI agent context:
- **Brand Intelligence**: Strategic business context
- **Client Profiles**: Deep customer intelligence

## Database Methods

### Brand Intelligence
```typescript
import { getBrandIntelligence, saveBrandIntelligence } from './services/db';

// Get brand data
const brand = await getBrandIntelligence();

// Save brand data
await saveBrandIntelligence({
  mission: "...",
  vision: "...",
  // ... other fields
  updatedAt: Date.now()
});
```

### Client Profiles
```typescript
import { getAllClientProfiles, getClientProfile, saveClientProfile, deleteClientProfile } from './services/db';

// Get all clients
const clients = await getAllClientProfiles();

// Get specific client
const client = await getClientProfile(clientId);

// Save client
await saveClientProfile({
  id: "client_123",
  name: "John Doe",
  company: "Acme Corp",
  // ... other fields
  createdAt: Date.now(),
  updatedAt: Date.now()
});

// Delete client
await deleteClientProfile(clientId);
```

## Integration Ideas

### 1. Context Injection in AI Prompts
Modify `aiService.ts` to automatically inject brand and client context:

```typescript
// Before sending to AI
const brand = await getBrandIntelligence();
const contextPrefix = `
BRAND CONTEXT:
Mission: ${brand?.mission}
Values: ${brand?.values}
Target Audience: ${brand?.targetAudience}
Tone: ${brand?.tone}

Respond in alignment with these brand guidelines.
`;
```

### 2. Client-Specific Responses
When a client is mentioned, pull their profile:

```typescript
// Detect client mention in conversation
const clientName = extractClientName(userMessage);
if (clientName) {
  const client = await findClientByName(clientName);
  if (client) {
    // Add client context to prompt
    const clientContext = `
    CLIENT PROFILE:
    Name: ${client.name}
    Pain Points: ${client.painPoints}
    Goals: ${client.goals}
    Communication Style: ${client.communicationStyle}
    `;
  }
}
```

### 3. Smart Suggestions
Use brand data to generate contextual suggestions:

```typescript
// In ChatPage.tsx
const suggestions = [
  `Draft email for ${client.name} addressing ${client.painPoints}`,
  `Create proposal aligned with our ${brand.uniqueValue}`,
  `Analyze how ${client.company} fits our target audience`
];
```

### 4. Memory Enhancement
Tag memories with brand/client relevance:

```typescript
// When saving memory
const memory = {
  summary: "...",
  tags: ["client:acme", "brand:values", "opportunity"],
  // ...
};
```

### 5. Performer Prompts
Inject brand context into performer system prompts:

```typescript
// In PerformersPage.tsx
const systemPrompt = `
You are ${performer.name}.
${performer.prompt}

BRAND GUIDELINES:
${brand.mission}
${brand.tone}
${brand.keyMessages}
`;
```

## Advanced Features to Consider

### Auto-Context Detection
- Scan conversations for client names and auto-load profiles
- Detect when brand values are relevant and inject context
- Track which clients are discussed most frequently

### Context Scoring
- Score responses for brand alignment
- Flag when responses contradict brand values
- Suggest edits to match communication style

### Client Intelligence Dashboard
- Show client interaction history from threads
- Track sentiment per client over time
- Identify upsell opportunities based on goals

### Brand Consistency Checker
- Analyze all responses for tone consistency
- Flag off-brand language
- Suggest brand-aligned alternatives

### Smart Templates
- Generate email templates per client profile
- Create proposals using brand + client data
- Auto-fill pitch decks with relevant context

### Relationship Mapping
- Link clients to knowledge graph entities
- Track which brand values resonate with which clients
- Identify patterns in successful client interactions

## Next Steps

1. **Test the pages**: Navigate to `/brand` and `/clients` to add data
2. **Integrate into aiService.ts**: Add context injection logic
3. **Update ChatPage.tsx**: Add client detection and suggestions
4. **Enhance memory system**: Tag memories with brand/client refs
5. **Create analytics**: Build dashboards showing brand/client insights
