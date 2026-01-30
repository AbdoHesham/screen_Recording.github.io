// Example: Using Claude Agent SDK
// You'll need to set your ANTHROPIC_API_KEY environment variable

const Anthropic = require('@anthropic-ai/sdk');

// Initialize the client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Get from environment variable
});

async function runAgent() {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Hello! Can you help me understand how to use the Claude API?'
        }
      ],
    });

    console.log('Claude Response:');
    console.log(message.content[0].text);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the agent
runAgent();
