"use client";

import { useState } from "react";

export function InitialComposer() {
  const [prompt, setPrompt] = useState("");

  return (
    <form className="composer" onSubmit={(event) => event.preventDefault()}>
      <label className="sr-only" htmlFor="initial-prompt">
        Ask BranchChat a question
      </label>
      <textarea
        id="initial-prompt"
        name="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ask anything..."
        rows={3}
        autoFocus
      />
      <div className="composer-footer">
        <span>Enter to send · Shift+Enter for a new line</span>
        <button type="submit" disabled aria-label="Send message">
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d="M10 15V5m0 0L6.5 8.5M10 5l3.5 3.5" />
          </svg>
        </button>
      </div>
    </form>
  );
}
