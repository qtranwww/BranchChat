import ReactMarkdown from "react-markdown";

type ConversationNodeProps = {
  question: string;
  answer: string;
  isTip: boolean;
};

export function ConversationNode({ question, answer, isTip }: ConversationNodeProps) {
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
    </article>
  );
}
