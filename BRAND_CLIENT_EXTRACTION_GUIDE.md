# Brand & Client Extraction Guide

## How It Works

The system automatically extracts brand and client information from your chat conversations through a background processing system. Here's how it works:

### Prerequisites

1. **Memory Feature Must Be Enabled**: Make sure the memory toggle (💾 icon) is ON in the chat input toolbar
2. **AI Must Generate a Memory**: The AI will automatically create a memory object when memory is enabled, which includes a summary and tags
3. **Background Processing**: After a memory is saved, it's automatically processed in the background to extract intelligence

### Process Flow

1. **User sends a message** in chat
2. **AI responds** with a memory object (if memory feature is enabled)
3. **Memory is saved** to the database
4. **Background processor** analyzes the memory and extracts:
   - Brand updates (mission, vision, values, etc.)
   - Client updates (pain points, goals, company info, etc.)
   - Other intelligence (calendar entries, knowledge connections, etc.)
5. **Updates are applied** to Brand and Client pages automatically
6. **Pages refresh** automatically when updates occur (via event system)

### What Gets Extracted

#### Brand Information
The system looks for and extracts:
- **Mission Statement**: Brand name, company name, mission statements
- **Vision**: Future goals, long-term aspirations
- **Values**: Principles, what the brand stands for
- **Target Audience**: Customer base, who you serve
- **Unique Value**: Differentiation, competitive advantage
- **Goals**: Current objectives, priorities
- **Tone**: Communication style, voice
- **Key Messages**: Talking points, core messages
- **Competitive Edge**: Advantages, differentiators
- **Constraints**: Boundaries, limitations

#### Client Information
The system extracts:
- Company name, industry, role
- Pain points and challenges
- Goals and objectives
- Budget and resources
- Decision-making process
- Personality and communication style
- Objections and opportunities
- Interaction history and notes

### Troubleshooting

#### Information Not Appearing on Brand/Client Pages

1. **Check Memory Feature**: Ensure the memory toggle (💾) is enabled in chat
2. **Check Console**: Open browser console (F12) and look for:
   - "Background memory processing error" messages
   - Any API errors
3. **Check Toast Notifications**: After sending a message, you should see:
   - "Intelligence extracted: brand intelligence" (if brand info was found)
   - Error messages if something failed
4. **Verify API Key**: Make sure your OpenAI API key is configured in Settings
5. **Check Memory Processing**: The AI needs to actually generate a memory object. If memory isn't being created:
   - Make sure memory toggle is ON
   - Check that the AI response includes a memory field
   - Check console for errors

#### Tips for Better Extraction

- **Be explicit**: "Our brand name is X" or "Our mission is Y"
- **Be specific**: Mention "target audience" or "mission statement" explicitly
- **Use natural language**: The AI will extract information from conversational context
- **Check the Brand page**: After chatting, navigate to the Brand page to see if updates appeared
- **Wait a moment**: Background processing happens asynchronously, give it a few seconds

### Manual Testing

To test if it's working:

1. Enable memory toggle (💾) in chat
2. Send a message like: "Our brand name is Seasuite and our mission is to transform AI alignment"
3. Wait for the AI response
4. Check the console for "Intelligence extracted: brand intelligence" toast
5. Navigate to the Brand page - you should see the mission statement populated

### Error Handling

- Errors are now shown via toast notifications
- Check browser console for detailed error messages
- Common issues:
  - Missing OpenAI API key → Configure in Settings
  - API rate limits → Wait and try again
  - Invalid JSON response → Check console for parsing errors

### Event System

The pages listen for update events:
- `brand-data-updated`: Fired when brand data changes
- `client-data-updated`: Fired when client data changes

Pages automatically refresh when these events fire, so you don't need to manually reload.

