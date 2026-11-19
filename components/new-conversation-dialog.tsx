"use client";

import { useEffect, useState } from "react";

import type { ContextMode } from "@/lib/conversation";

type NewConversationDialogProps = {
  onCancel: () => void;
  onCreate: (contextMode: ContextMode) => void;
};

export function NewConversationDialog({ onCancel, onCreate }: NewConversationDialogProps) {
  const [contextMode, setContextMode] = useState<ContextMode>("full");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="settings-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
      >
        <header>
          <h2 id="new-conversation-title">New conversation</h2>
          <p>Choose settings before creating this conversation.</p>
        </header>

        <fieldset>
          <legend>Context mode</legend>
          <label className="context-mode-option">
            <input
              type="radio"
              name="context-mode"
              value="full"
              checked={contextMode === "full"}
              onChange={() => setContextMode("full")}
              autoFocus
            />
            <span>
              <strong>Full context</strong>
              <small>Keep the complete relevant branch history.</small>
            </span>
          </label>
          <label className="context-mode-option">
            <input
              type="radio"
              name="context-mode"
              value="summary_beta"
              checked={contextMode === "summary_beta"}
              onChange={() => setContextMode("summary_beta")}
            />
            <span>
              <strong>Summary mode (Beta)</strong>
              <small>Summarize parent context once when a branch begins.</small>
            </span>
          </label>
        </fieldset>

        <footer>
          <button type="button" className="settings-dialog__cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="settings-dialog__create"
            onClick={() => onCreate(contextMode)}
          >
            Create
          </button>
        </footer>
      </section>
    </div>
  );
}
