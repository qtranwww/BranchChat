"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import type { BranchSide } from "@/lib/conversation";

type BranchDraftProps = {
  nodeId: string;
  side: BranchSide;
  disabled: boolean;
  onSubmit: (prompt: string) => void;
  onDismiss: () => void;
};

export function BranchDraft({
  nodeId,
  side,
  disabled,
  onSubmit,
  onDismiss,
}: BranchDraftProps) {
  const [prompt, setPrompt] = useState("");
  const submissionLocked = useRef(false);
  const canSubmit = prompt.trim().length > 0 && !disabled;

  function submitPrompt() {
    const submittedPrompt = prompt.trim();

    if (!submittedPrompt || disabled || submissionLocked.current) {
      return;
    }

    submissionLocked.current = true;
    onSubmit(submittedPrompt);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitPrompt();
    }
  }

  return (
    <form
      className={`branch-draft branch-draft--${side}`}
      onSubmit={handleSubmit}
    >
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
        <div className="branch-draft__actions">
          <button type="button" onClick={onDismiss} aria-label="Close branch draft">
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit} aria-label="Create branch">
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
