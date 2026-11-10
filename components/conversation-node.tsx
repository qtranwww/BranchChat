import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

type ConversationNodeProps = {
  question: string;
  answer: string;
  isTip: boolean;
  composer?: ReactNode;
};

export function ConversationNode({ question, answer, isTip, composer }: ConversationNodeProps) {
  const variantClass = isTip ? "conversation-node--tip" : "conversation-node--standard";

  return (
    <article className={`conversation-node ${variantClass}`} data-tip={isTip || undefined}>
      <div className="conversation-node__question">
        <p>{question}</p>
      </div>

      <div className="conversation-node__divider" aria-hidden="true" />

      <div className="conversation-node__answer">
        <ReactMarkdown skipHtml>{answer}</ReactMarkdown>
      </div>

      {isTip && composer ? <div className="conversation-node__composer">{composer}</div> : null}
    </article>
  );
}
