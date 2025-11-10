# Memory System Architecture Breakdown

## Overview
The memory system is a multi-layered knowledge management system that captures, stores, processes, and utilizes conversational memories across different parts of the application. It consists of **two main memory types**: **Agent Memories** (system-wide) and **Performer Memories** (performer-specific).

---

## 1. Memory Types & Data Structures

### Agent Memory (`Memory`)
**Location**: `types.ts` lines 2-11

```typescript
{
  id?: number;              // Auto-incremented database ID
  timestamp: number;         // When the memory was created
  summary: string;          // AI-generated summary of the conversation
  tags: string[];           // 3-5 relevant keywords for retrieval
  conversation: string;    // Full conversation snippet
  relevance: number;        // 1-10 importance score
  knowledgeRefs?: string[]; // Related knowledge entity IDs
  metaTags?: string[];      // System metadata tags
}
```

### Performer Memory (`PerformerMemory`)
**Location**: `types.ts` lines 155-164

```typescript
{
  id?: number;
  performerId: string;      // Which performer this memory belongs to
  timestamp: number;
  summary: string;
  tags: string[];
  transcriptSnippet: string; // Conversation snippet
  relevance: number;
  conversationId?: string;
}
```

**Key Difference**: Performer memories are scoped to individual performers and are used to give each performer their own memory context.

---

## 2. Memory Creation Flow

### A. During Chat Conversations (`ChatPage.tsx`)

**Location**: `pages/ChatPage.tsx` lines 823-842

**Agent Memory Creation**:
1. User sends a message
2. AI generates response with `AgentResponseParts` containing a `memory` field
3. The memory object includes:
   - `summary`: AI-generated summary
   - `tags`: 3-5 relevant keywords
4. Memory is saved via `addMemory()` with:
   - Conversation snippet (user + performer messages + agent response)
   - Knowledge refs (performer IDs involved)
   - Meta tags (conversation context, features used)

**Performer Memory Creation**:
**Location**: `pages/ChatPage.tsx` lines 765-775

1. When a performer responds, their response includes a `memory` field
2. Saved via `addPerformerMemory()` with:
   - `performerId`: The performer who created it
   - `transcriptSnippet`: User message + performer response
   - Tags and summary from the response

### B. Memory Onboarding (`MemoryOnboardingPage.tsx`)

**Location**: `pages/MemoryOnboardingPage.tsx`

**Bulk Import Process**:
1. User pastes/uploads text document
2. Text is chunked (configurable size/overlap)
3. Each chunk is processed:
   - `generateMemoryFromChunk()` creates summary and tags
   - `evaluateMemoryRelevance()` scores importance (1-10)
   - Saved via `addMemory()`
4. Supports parallel processing across multiple API keys

---

## 3. Memory Storage (`db.ts`)

### Database Schema
**Location**: `services/db.ts` lines 6-183

- **`memories`**: Stores Agent Memories (indexed by `id`, `timestamp`, `relevance`)
- **`performerMemories`**: Stores Performer Memories (indexed by `id`, `performerId`, `timestamp`)

### Key Functions

**Agent Memories**:
- `getAllMemories()`: Fetch all memories
- `addMemory()`: Save new memory + update tag scores + dispatch event
- `updateMemory()`: Update existing memory
- `deleteMemoryById()`: Remove memory
- `clearMemories()`: Delete all memories

**Performer Memories**:
- `getPerformerMemories(performerId, limit?)`: Get memories for a performer
- `addPerformerMemory()`: Save performer memory + dispatch event
- `clearPerformerMemories(performerId?)`: Clear memories (specific or all)

**Tag Scoring**:
- `updateTagUsage()`: Updates `tagScores` table with memory/knowledge counts
- Tag scores influence memory retrieval priority

---

## 4. Memory Retrieval & Context Building

### A. Context Selection (`ChatPage.tsx`)

**Location**: `pages/ChatPage.tsx` lines 550-602

**Process**:
1. **Load all memories** + tag scores
2. **Extract keywords** from user message and chat history
3. **Build tag weight map** from tag scores (more memories = higher weight)
4. **Prioritize tags**:
   - Keywords that match tag scores (top 10)
   - Fallback to most-used tags if needed
5. **Score memories**:
   ```typescript
   score = (relevance * 2) + tag matches + keyword matches
   ```
   - Prioritized tags: +8 + weight bonus
   - Keyword matches: +2
6. **Order & filter**:
   - Memories with prioritized tags first
   - Then remaining scored memories
   - Top 10 selected for context
7. **Set context** for AI prompt

### B. Formatting for AI (`aiService.ts`)

**Location**: `services/aiService.ts` lines 462-470

**Agent Memory Primer**:
```typescript
formatContextMemories(memories, limit=4)
// Output format:
// - 2025-01-15 • Summary text (#tag1 #tag2)
// - 2025-01-14 • Another summary (#tag3)
```

**Performer Memory Primer**:
**Location**: `services/aiService.ts` lines 1087-1096

```typescript
buildPerformerMemoryPrimer(performerId, limit=5)
// Output format:
// - **2025-01-15** — Summary text (#tag1 #tag2)
// - **2025-01-14** — Another summary (#tag3)
```

### C. Usage in AI Prompts

**Agent Response Generation**:
**Location**: `services/aiService.ts` lines 1013-1032

- Memory primer is included in system instruction
- Combined with knowledge graph primer, temporal context
- Passed to AI model as context

**Performer Response Generation**:
**Location**: `services/aiService.ts` lines 1103-1123

- If `performer.memoryEnabled !== false`:
  - Loads performer's own memories
  - Formats as memory primer
  - Included in performer's system instruction

---

## 5. Memory Post-Processing (`memoryProcessor.ts`)

### Purpose
Extract actionable intelligence from memories and route it to other system components.

**Location**: `services/memoryProcessor.ts`

### Process (`processMemory()`)

1. **Gather Context**:
   - Load all client profiles
   - Load brand intelligence
   - Load all performers
   - Load knowledge entities

2. **AI Analysis**:
   - Sends memory (summary, tags, conversation) to OpenAI
   - AI extracts:
     - Client updates (pain points, goals, personality, opportunities)
     - Brand updates (mission, values, goals, tone)
     - Performer updates (biographical details, role descriptions)
     - Calendar entries (deadlines, events)
     - Knowledge connections (entity relationships)
     - Interaction events (performer interactions)
     - Relevance reranking (1-10)

3. **Returns** `ProcessingResult` with all extracted data

### Application (`applyProcessingResult()`)

**Location**: `services/memoryProcessor.ts` lines 148-221

Routes extracted data to:
- **Client Profiles**: Updates pain points, goals, personality, etc.
- **Brand Intelligence**: Updates mission, values, positioning
- **Performers**: Updates descriptions and role descriptions
- **Journal/Calendar**: Adds time-sensitive entries
- **Knowledge Graph**: Creates entity relationships
- **Interaction Events**: Records performer interactions
- **Memory**: Updates relevance score

**Also logs** intelligence events for the intelligence feed.

### UI Integration (`MemoryCard.tsx`)

**Location**: `components/MemoryCard.tsx` lines 54-79

- **"Post-Process" button**: Triggers `processMemory()`
- Shows processing results preview
- **"Apply All" button**: Executes `applyProcessingResult()`
- Displays what will be updated (clients, brand, performers, etc.)

---

## 6. Memory Display & Management

### Memory Page (`MemoryPage.tsx`)

**Location**: `pages/MemoryPage.tsx`

**Features**:
- Lists all agent memories in a grid
- Search by summary/tags
- Sort by timestamp or relevance
- Refresh/clear all
- Each memory displayed as `MemoryCard`

### Memory Card (`MemoryCard.tsx`)

**Location**: `components/MemoryCard.tsx`

**Features**:
- Display summary, tags, relevance score
- Edit summary, tags, relevance
- View conversation snippet
- Post-process memory (extract intelligence)
- Delete memory
- Tag links to knowledge graph page

### Memory Saved Panel (`MemorySavedPanel.tsx`)

**Location**: `components/MemorySavedPanel.tsx`

- Notification panel shown when memory is saved
- Expandable to show summary and tags
- Appears in chat interface after memory creation

---

## 7. Integration Points

### With Knowledge Graph
- Memories can reference knowledge entities (`knowledgeRefs`)
- Post-processing creates knowledge connections
- Tags link memories to knowledge entities

### With Client Profiles
- Post-processing extracts client insights
- Updates client profiles with new information
- Intelligence log tracks client updates

### With Brand Intelligence
- Post-processing extracts brand insights
- Updates brand mission, values, positioning
- Intelligence log tracks brand updates

### With Performers
- Performer memories are separate from agent memories
- Post-processing can update performer descriptions
- Performers use their own memories for context

### With Calendar/Journal
- Post-processing extracts time-sensitive information
- Creates journal entries for deadlines/events
- Temporal context included in AI prompts

### With Social System
- Post-processing creates interaction events
- Tracks performer-to-performer interactions
- Sentiment and intrigue tags included

### With Intelligence Feed
- Memory processing logs intelligence events
- Client/brand updates appear in feed
- Source tracking via `intelligenceLog`

---

## 8. Data Flow Diagram

```
┌─────────────────┐
│  ChatPage.tsx   │
│  User Message   │
└────────┬────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────┐              ┌──────────────────┐
│  AI Generation  │              │ Performer Gen   │
│  (aiService.ts)  │              │ (aiService.ts)   │
└────────┬────────┘              └────────┬─────────┘
         │                                 │
         │ Returns AgentResponseParts     │ Returns PerformerResponseParts
         │ with memory field              │ with memory field
         │                                 │
         ▼                                 ▼
┌─────────────────┐              ┌──────────────────┐
│  addMemory()    │              │addPerformerMemory│
│  (db.ts)        │              │  (db.ts)         │
└────────┬────────┘              └────────┬─────────┘
         │                                 │
         ├─────────────────────────────────┤
         │                                 │
         ▼                                 ▼
┌─────────────────┐              ┌──────────────────┐
│  Memories Table │              │PerformerMemories │
│  (IndexedDB)    │              │   (IndexedDB)    │
└────────┬────────┘              └────────┬─────────┘
         │                                 │
         │                                 │
         ├─────────────────────────────────┤
         │                                 │
         ▼                                 ▼
┌──────────────────────────────────────────┐
│     Memory Retrieval (ChatPage.tsx)      │
│  - Keyword extraction                    │
│  - Tag scoring                          │
│  - Memory scoring                       │
│  - Top 10 selection                     │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│   formatContextMemories() (aiService.ts)  │
│   - Formats for AI prompt               │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│      AI Prompt (with memory context)     │
└──────────────────────────────────────────┘
```

### Post-Processing Flow

```
┌─────────────────┐
│  MemoryCard.tsx │
│  "Post-Process" │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  processMemory()         │
│  (memoryProcessor.ts)    │
│  - Gathers context       │
│  - Calls OpenAI          │
│  - Extracts intelligence │
└────────┬─────────────────┘
         │
         │ Returns ProcessingResult
         │
         ▼
┌─────────────────────────┐
│  Preview in MemoryCard   │
│  (Shows what will update)│
└────────┬─────────────────┘
         │
         │ User clicks "Apply All"
         │
         ▼
┌─────────────────────────┐
│  applyProcessingResult()│
│  (memoryProcessor.ts)    │
│  - Updates clients       │
│  - Updates brand         │
│  - Updates performers    │
│  - Adds calendar entries │
│  - Creates knowledge conn│
│  - Records interactions  │
│  - Updates memory relev. │
└─────────────────────────┘
```

---

## 9. Key Algorithms

### Memory Scoring (`ChatPage.tsx` lines 40-59)

```typescript
scoreMemoryForContext(memory, keywords, tagWeights, prioritizedTags):
  score = (memory.relevance * 2)  // Base relevance weight
  
  for each tag in memory.tags:
    if tag in prioritizedTags:
      score += 8 + (tagWeights[tag] * 0.6)  // Strong boost
    else if tag in keywords:
      score += 2  // Moderate boost
  
  return score
```

### Tag Prioritization (`ChatPage.tsx` lines 556-576)

1. Extract keywords from message/history
2. Match keywords to existing tags
3. Sort by tag score (memory count)
4. Take top 10 prioritized tags
5. Fill remaining slots with most-used tags if needed

---

## 10. Event System

### Memory Events
- **`memories-updated`**: Dispatched when memories are added/updated
- **`performer-memories-updated`**: Dispatched when performer memories change

**Location**: `services/db.ts` helper functions dispatch these events.

**Listeners**:
- `MemoryPage.tsx`: Refreshes memory list
- `ChatPage.tsx`: Updates context tags display
- `PerformersPage.tsx`: Refreshes performer memory preview

---

## 11. Summary of Connections

1. **Chat → Memory**: Conversations automatically create memories
2. **Memory → AI Context**: Memories retrieved and formatted for AI prompts
3. **Memory → Post-Processing**: Memories analyzed to extract intelligence
4. **Post-Processing → System**: Extracted data routes to clients, brand, performers, calendar, knowledge graph
5. **Memory → Knowledge Graph**: Tags link memories to knowledge entities
6. **Memory → Tag Scores**: Memory tags update tag usage statistics
7. **Memory → UI**: Memories displayed, edited, managed in dedicated pages
8. **Performer Memory → Performer Context**: Performer memories used only for that performer's responses

---

## 12. Configuration & Settings

### Memory Onboarding Settings
**Location**: `pages/MemoryOnboardingPage.tsx` lines 8-24

- Provider (Google/OpenAI/OpenRouter)
- Model selection
- Chunk size (characters)
- Overlap (characters)
- API keys (for parallel processing)

### AI Settings
**Location**: `services/aiService.ts` lines 107-137

- Provider selection
- Model selection
- API keys
- Admonition visibility (controls memory display in UI)

---

## Notes

- **Relevance scores** (1-10) are manually editable in MemoryCard or auto-generated during onboarding
- **Tag system** is central to memory retrieval - tags must be relevant for memories to be found
- **Post-processing is optional** - memories can exist without being processed
- **Performer memories are isolated** - each performer only sees their own memories
- **Database is IndexedDB** (browser-based, persists locally)
- **Tag scores** track how many memories/knowledge entities use each tag

