# BranchChat

BranchChat is an experimental interface for structuring AI conversations as a visual tree. Its purpose is to explore how a conversation can branch into separate paths without losing the main thread.

This project does not create, train, or improve an AI model, and it is not intended to compete with AI providers. The AI response is supplied by an external model; BranchChat focuses on the structure and presentation of the conversation around it.

## Current functionality

- Stream AI answers through OpenRouter.
- Continue a normal conversation as a vertical sequence of question-and-answer nodes.
- Create left or right branches from any completed node.
- Continue each branch independently in the interface.
- Create multiple sibling branches and nested branches.
- Place branches automatically with deterministic lane insertion and subtree spacing.
- Navigate a fixed-scale canvas with vertical scrolling and horizontal panning.
- Render Markdown answers and retry failed requests.

Conversation data currently lives in browser memory for the active page session. Reloading or closing the page may discard it.

## Run locally

Install the dependencies:

```bash
npm install
```

Create `.env.local` in the project directory:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=your_openrouter_model_id
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
