"use client";

import { useRef, useState } from "react";

import { Composer } from "@/components/composer";
import { ConversationNode } from "@/components/conversation-node";

type LocalNode = {
  id: number;
  question: string;
  answer: string;
};

const placeholderAnswer = "\\<answer zone\\>";

export function ChatExperience() {
  const [nodes, setNodes] = useState<LocalNode[]>([]);
  const nextNodeId = useRef(0);

  function addNode(question: string) {
    const node: LocalNode = {
      id: nextNodeId.current,
      question,
      answer: placeholderAnswer,
    };

    nextNodeId.current += 1;
    setNodes((currentNodes) => [...currentNodes, node]);
  }

  const tipIndex = nodes.length - 1;

  return (
    <section className="chat-experience" aria-labelledby="page-title">
      <h1 id="page-title">BranchChat</h1>

      {nodes.length === 0 ? (
        <Composer
          id="initial-prompt"
          label="Ask BranchChat a question"
          placeholder="Ask anything..."
          variant="standalone"
          autoFocus
          onSubmit={addNode}
        />
      ) : (
        <div className="conversation-stack">
          {nodes.map((node, index) => {
            const isTip = index === tipIndex;

            return (
              <ConversationNode
                key={node.id}
                question={node.question}
                answer={node.answer}
                isTip={isTip}
                composer={
                  isTip ? (
                    <Composer
                      id={`tip-prompt-${node.id}`}
                      label="Ask a follow-up question"
                      placeholder="Next question..."
                      variant="embedded"
                      autoFocus
                      onSubmit={addNode}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
