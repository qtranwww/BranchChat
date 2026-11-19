import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

import type { NodeStatus } from "@/lib/conversation";

type ConversationNodeProps = {
  question: string;
  answer: string;
  status: NodeStatus;
  errorCode: string | null;
  isTip: boolean;
  composer?: ReactNode;
  onRetry?: () => void;
};

const errorMessages: Record<string, string> = {
  configuration_missing:
    "OpenRouter is not configured. Add the key and model to .env.local, then restart BranchChat.",
  configuration_invalid: "The configured OpenRouter model is invalid. Check .env.local.",
  invalid_api_key: "OpenRouter rejected this API key. Check OPENROUTER_API_KEY.",
  insufficient_credits: "This OpenRouter account does not have enough credits for the request.",
  model_unavailable: "The configured OpenRouter model was not found or is unavailable.",
  provider_rate_limit: "OpenRouter rate-limited this key. Wait a moment or check its quota.",
  provider_timeout: "OpenRouter did not respond in time.",
  provider_unavailable: "OpenRouter or the selected model provider is temporarily unavailable.",
  provider_rejected: "OpenRouter rejected the request. Check the configured model and provider status.",
  invalid_request: "The conversation context is invalid or too large.",
  summary_failed: "The parent context could not be summarized. Retry to try again.",
  summary_context_invalid: "The parent context cannot be summarized in its current form.",
  summary_context_too_large: "The parent context is too large to summarize safely.",
};

export function ConversationNode({
  question,
  answer,
  status,
  errorCode,
  isTip,
  composer,
  onRetry,
}: ConversationNodeProps) {
  const isGenerating = status === "pending" || status === "streaming";

  return (
    <article
      className="conversation-node"
      aria-busy={isGenerating}
    >
      <div className="conversation-node__question">
        <p>{question}</p>
      </div>

      <div className="conversation-node__divider" aria-hidden="true" />

      <div className="conversation-node__answer" aria-live="polite">
        {status === "pending" ? <p className="node-status">Thinking…</p> : null}
        {answer ? <ReactMarkdown skipHtml>{answer}</ReactMarkdown> : null}
        {status === "failed" ? (
          <div className="node-error" role="alert">
            <p>{(errorCode && errorMessages[errorCode]) || "The answer could not be generated."}</p>
            {onRetry ? (
              <button type="button" onClick={onRetry}>
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isTip && status === "completed" && composer ? (
        <div className="conversation-node__composer">{composer}</div>
      ) : null}
    </article>
  );
}
