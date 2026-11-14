"use client";

import { useEffect, useRef, useState } from "react";

import { Composer } from "@/components/composer";
import { ConversationFlow } from "@/components/conversation-flow";
import {
  appendAnswerDelta,
  appendNode,
  buildChatMessages,
  completeNode,
  createChildBranch,
  createConversation,
  failNode,
  MAIN_BRANCH_ID,
  prepareNodeRetry,
  type BranchSide,
  type ChatNode,
  type ConversationState,
} from "@/lib/conversation";

const genericErrorCode = "generation_failed";

type BranchDraftState = {
  nodeId: string;
  side: BranchSide;
};

type ZoomRequest = {
  id: number;
  delta: number;
};

export function ChatExperience() {
  const [conversation, setConversation] = useState<ConversationState>(createConversation);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [branchDraft, setBranchDraft] = useState<BranchDraftState | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [originRequest, setOriginRequest] = useState(0);
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest>({ id: 0, delta: 0 });
  const nextNodeId = useRef(0);
  const nextBranchId = useRef(0);
  const sessionVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => () => requestController.current?.abort(), []);

  async function streamAnswer(targetConversation: ConversationState, nodeId: string) {
    const version = sessionVersion.current;
    const controller = new AbortController();

    requestController.current = controller;
    setActiveNodeId(nodeId);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildChatMessages(targetConversation, nodeId) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "The AI request failed.");
      }

      if (!response.body) {
        throw new Error("The AI response did not include a stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let receivedText = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const delta = decoder.decode(value, { stream: true });

        if (delta) {
          receivedText = true;
          if (sessionVersion.current === version) {
            setConversation((currentConversation) =>
              appendAnswerDelta(currentConversation, nodeId, delta),
            );
          }
        }
      }

      const finalDelta = decoder.decode();

      if (finalDelta) {
        receivedText = true;
        if (sessionVersion.current === version) {
          setConversation((currentConversation) =>
            appendAnswerDelta(currentConversation, nodeId, finalDelta),
          );
        }
      }

      if (!receivedText) {
        throw new Error("The AI returned an empty response.");
      }

      if (sessionVersion.current === version) {
        setConversation((currentConversation) => completeNode(currentConversation, nodeId));
      }
    } catch {
      if (!controller.signal.aborted && sessionVersion.current === version) {
        setConversation((currentConversation) =>
          failNode(currentConversation, nodeId, genericErrorCode),
        );
      }
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
      }

      if (sessionVersion.current === version) {
        setActiveNodeId(null);
      }
    }
  }

  function startNewChat() {
    if (
      conversation.nodes.length > 0 &&
      !window.confirm("Start a new chat? The current conversation will be lost.")
    ) {
      return;
    }

    sessionVersion.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    nextNodeId.current = 0;
    nextBranchId.current = 0;
    setConversation(createConversation());
    setActiveNodeId(null);
    setBranchDraft(null);
    setSessionKey((currentKey) => currentKey + 1);
  }

  function changeZoom(delta: number) {
    setZoomRequest((request) => ({ id: request.id + 1, delta }));
  }

  function addNode(question: string, branchId = MAIN_BRANCH_ID) {
    if (activeNodeId) {
      return;
    }

    const id = `node-${nextNodeId.current}`;
    const nextConversation = appendNode(conversation, {
      id,
      branchId,
      question,
      status: "pending",
    });

    setConversation(nextConversation);
    nextNodeId.current += 1;
    void streamAnswer(nextConversation, id);
  }

  function retryNode(nodeId: string) {
    if (activeNodeId) {
      return;
    }

    const retryConversation = prepareNodeRetry(conversation, nodeId);
    setConversation(retryConversation);
    void streamAnswer(retryConversation, nodeId);
  }

  function addChildBranch(originNodeId: string, side: BranchSide, question: string) {
    if (activeNodeId) {
      return;
    }

    const nodeId = `node-${nextNodeId.current}`;
    const branchId = `branch-${nextBranchId.current}`;
    const nextConversation = createChildBranch(conversation, {
      branchId,
      nodeId,
      originNodeId,
      side,
      question,
    });

    if (nextConversation === conversation) {
      return;
    }

    setConversation(nextConversation);
    setBranchDraft(null);
    nextNodeId.current += 1;
    nextBranchId.current += 1;
    void streamAnswer(nextConversation, nodeId);
  }

  function renderTipComposer(node: ChatNode) {
    return (
      <Composer
        id={`tip-prompt-${node.id}`}
        label="Ask a follow-up question"
        placeholder="Next question..."
        variant="embedded"
        autoFocus={conversation.branches.length === 1}
        disabled={activeNodeId !== null}
        onSubmit={(prompt) => addNode(prompt, node.branchId)}
      />
    );
  }

  return (
    <section className="chat-experience" aria-labelledby="page-title">
      <header className="app-toolbar">
        <button type="button" className="app-toolbar__action" onClick={startNewChat}>
          New chat
        </button>
        <h1 id="page-title">BranchChat</h1>
        <div className="app-toolbar__right">
          <div className="zoom-control" aria-label="Canvas zoom">
            <button type="button" aria-label="Zoom in" onClick={() => changeZoom(0.1)}>
              +
            </button>
            <span aria-hidden="true" />
            <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-0.1)}>
              −
            </button>
          </div>
          <button
            type="button"
            className="app-toolbar__action"
            onClick={() => setOriginRequest((request) => request + 1)}
          >
            Back to Origin
          </button>
        </div>
      </header>

      <ConversationFlow
        key={sessionKey}
        conversation={conversation}
        originRequest={originRequest}
        zoomRequest={zoomRequest}
        renderComposer={renderTipComposer}
        onRetry={retryNode}
        branchDraft={branchDraft}
        onOpenBranchDraft={(nodeId, side) => setBranchDraft({ nodeId, side })}
        onCloseBranchDraft={() => setBranchDraft(null)}
        onSubmitBranchDraft={addChildBranch}
        branchSubmissionDisabled={activeNodeId !== null}
      />

      {conversation.nodes.length === 0 ? (
        <div className="empty-chat">
          <Composer
            key={sessionKey}
            id="initial-prompt"
            label="Ask BranchChat a question"
            placeholder="Ask anything..."
            variant="standalone"
            autoFocus
            onSubmit={addNode}
          />
        </div>
      ) : null}
    </section>
  );
}
