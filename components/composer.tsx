"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type ComposerProps = {
  id: string;
  label: string;
  placeholder: string;
  variant: "standalone" | "embedded";
  autoFocus?: boolean;
  disabled?: boolean;
  onSubmit: (prompt: string) => void;
};

export function Composer({
  id,
  label,
  placeholder,
  variant,
  autoFocus = false,
  disabled = false,
  onSubmit,
}: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const submissionLocked = useRef(false);
  const canSubmit = prompt.trim().length > 0 && !disabled;

  function submitPrompt() {
    const submittedPrompt = prompt.trim();

    if (!submittedPrompt || disabled || submissionLocked.current) {
      return;
    }

    submissionLocked.current = true;
    setPrompt("");
    onSubmit(submittedPrompt);
    queueMicrotask(() => {
      submissionLocked.current = false;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    submitPrompt();
  }

  return (
    <form className={`composer composer--${variant}`} onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        name="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={variant === "standalone" ? 3 : 2}
        autoFocus={autoFocus}
        disabled={disabled}
      />
      <div className="composer-footer">
        <span>Enter to send · Shift+Enter for a new line</span>
        <button type="submit" disabled={!canSubmit} aria-label="Send message">
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d="M10 15V5m0 0L6.5 8.5M10 5l3.5 3.5" />
          </svg>
        </button>
      </div>
    </form>
  );
}
