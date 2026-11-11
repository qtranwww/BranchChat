"use client";

import { useState, type KeyboardEvent } from "react";

import type { BranchSide } from "@/lib/conversation";

type BranchDraftProps = {
  nodeId: string;
  side: BranchSide;
  onDismiss: () => void;
};

export function BranchDraft({ nodeId, side, onDismiss }: BranchDraftProps) {
  const [prompt, setPrompt] = useState("");

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
    }
  }

  return (
    <div className={`branch-draft branch-draft--${side}`} data-side={side}>
      <label className="sr-only" htmlFor={`branch-draft-${nodeId}-${side}`}>
        Draft a {side} branch question
      </label>
      <textarea
        id={`branch-draft-${nodeId}-${side}`}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Branch question..."
        rows={3}
        autoFocus
      />
      <div className="branch-draft__footer">
        <span>{side}</span>
        <button type="button" onClick={onDismiss} aria-label="Close branch draft">
          Cancel
        </button>
      </div>
    </div>
  );
}
