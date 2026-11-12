import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

import type { NodeStatus } from "@/lib/conversation";

type ConversationNodeProps = {
  question: string;
  answer: string;
  status: NodeStatus;
  isTip: boolean;
  composer?: ReactNode;
  onRetry?: () => void;
};

export function ConversationNode({
  question,
  answer,
  status,
  isTip,
  composer,
  onRetry,
}: ConversationNodeProps) {
  const variantClass = isTip ? "conversation-node--tip" : "conversation-node--standard";
  const isGenerating = status === "pending" || status === "streaming";

  return (
    <article
      className={`conversation-node ${variantClass}`}
      data-tip={isTip || undefined}
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
            <p>The answer could not be generated.</p>
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
