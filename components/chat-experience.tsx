"use client";

import { useEffect, useRef, useState } from "react";

import { Composer } from "@/components/composer";
import { ConversationFlow } from "@/components/conversation-flow";
import { NewConversationDialog } from "@/components/new-conversation-dialog";
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
  type ContextMode,
  type ConversationState,
} from "@/lib/conversation";

type ConversationSummary = {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
};

type ConversationSnapshot = {
  id: string;
  title: string;
  conversation: ConversationState;
};

type AIStatus = {
  provider: string;
  model: string | null;
  configured: boolean;
  issue?: string;
};

const genericErrorCode = "generation_failed";

type BranchDraftState = {
  nodeId: string;
  side: BranchSide;
};

type ZoomRequest = {
  id: number;
  delta: number;
};

function createConversationId() {
  return crypto.randomUUID();
}

function getNextId(items: readonly { id: string }[], prefix: string): number {
  return items.reduce((nextId, item) => {
    const match = item.id.match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? Math.max(nextId, Number(match[1]) + 1) : nextId;
  }, 0);
}

function getConversationTitle(conversation: ConversationState): string {
  const firstQuestion = conversation.nodes.find(
    (node) => node.branchId === MAIN_BRANCH_ID,
  )?.question;

  if (!firstQuestion) {
    return "New conversation";
  }

  return firstQuestion.length > 64 ? `${firstQuestion.slice(0, 61)}...` : firstQuestion;
}

export function ChatExperience() {
  const [conversation, setConversation] = useState<ConversationState>(createConversation);
  const [conversationId, setConversationId] = useState(createConversationId);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [branchDraft, setBranchDraft] = useState<BranchDraftState | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [originRequest, setOriginRequest] = useState(0);
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest>({ id: 0, delta: 0 });
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyMutationId, setHistoryMutationId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const nextNodeId = useRef(0);
  const nextBranchId = useRef(0);
  const sessionVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const conversationRef = useRef(conversation);
  const conversationIdRef = useRef(conversationId);
  const conversationTitleRef = useRef<string | null>(null);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => () => requestController.current?.abort(), []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/settings/ai", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("AI status could not be read.");
        }

        return (await response.json()) as AIStatus;
      })
      .then((status) => {
        if (!cancelled) {
          setAIStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAIStatus({
            provider: "OpenRouter",
            model: null,
            configured: false,
            issue: "The local AI configuration could not be read.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreLatestConversation() {
      try {
        const historyResponse = await fetch("/api/conversations", { cache: "no-store" });

        if (!historyResponse.ok) {
          throw new Error("History could not be read.");
        }

        const historyPayload = (await historyResponse.json()) as {
          conversations: ConversationSummary[];
        };

        if (cancelled) {
          return;
        }

        setHistory(historyPayload.conversations);
        const latest = historyPayload.conversations[0];

        if (!latest) {
          return;
        }

        const conversationResponse = await fetch(`/api/conversations/${latest.id}`, {
          cache: "no-store",
        });

        if (!conversationResponse.ok) {
          throw new Error("Conversation could not be restored.");
        }

        const snapshot = (await conversationResponse.json()) as ConversationSnapshot;

        if (!cancelled) {
          conversationRef.current = snapshot.conversation;
          conversationIdRef.current = snapshot.id;
          conversationTitleRef.current = snapshot.title;
          setConversation(snapshot.conversation);
          setConversationId(snapshot.id);
          nextNodeId.current = getNextId(snapshot.conversation.nodes, "node-");
          nextBranchId.current = getNextId(snapshot.conversation.branches, "branch-");
          setSessionKey((currentKey) => currentKey + 1);
        }
      } catch {
        if (!cancelled) {
          setStorageError("Local history could not be restored.");
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void restoreLatestConversation();
    return () => {
      cancelled = true;
    };
  }, []);

  function replaceConversation(nextConversation: ConversationState) {
    conversationRef.current = nextConversation;
    setConversation(nextConversation);
  }

  function queueSave(
    nextConversation: ConversationState,
    targetId = conversationIdRef.current,
  ) {
    if (nextConversation.nodes.length === 0) {
      return;
    }

    const title = conversationTitleRef.current ?? getConversationTitle(nextConversation);
    const snapshot: ConversationSnapshot = {
      id: targetId,
      title,
      conversation: nextConversation,
    };

    saveQueue.current = saveQueue.current
      .then(async () => {
        const response = await fetch(`/api/conversations/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });

        if (!response.ok) {
          throw new Error("Conversation could not be saved.");
        }

        setStorageError(null);
        setHistory((currentHistory) => {
          const summary: ConversationSummary = {
            id: targetId,
            title,
            nodeCount: nextConversation.nodes.length,
            updatedAt: new Date().toISOString(),
          };

          return [summary, ...currentHistory.filter((item) => item.id !== targetId)];
        });
      })
      .catch(() => {
        setStorageError("Local save failed.");
      });
  }

  async function streamAnswer(targetConversation: ConversationState, nodeId: string) {
    const version = sessionVersion.current;
    const controller = new AbortController();

    requestController.current = controller;
    setActiveNodeId(nodeId);
    let failureCode = genericErrorCode;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildChatMessages(targetConversation, nodeId) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        failureCode = payload?.code || genericErrorCode;
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
            replaceConversation(appendAnswerDelta(conversationRef.current, nodeId, delta));
          }
        }
      }

      const finalDelta = decoder.decode();

      if (finalDelta) {
        receivedText = true;
        if (sessionVersion.current === version) {
          replaceConversation(appendAnswerDelta(conversationRef.current, nodeId, finalDelta));
        }
      }

      if (!receivedText) {
        throw new Error("The AI returned an empty response.");
      }

      if (sessionVersion.current === version) {
        const completedConversation = completeNode(conversationRef.current, nodeId);
        replaceConversation(completedConversation);
        queueSave(completedConversation);
      }
    } catch {
      if (!controller.signal.aborted && sessionVersion.current === version) {
        const failedConversation = failNode(
          conversationRef.current,
          nodeId,
          failureCode,
        );
        replaceConversation(failedConversation);
        queueSave(failedConversation);
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

  function startNewChat(contextMode: ContextMode) {
    if (activeNodeId && !window.confirm("Start a new chat while an answer is generating?")) {
      return;
    }

    sessionVersion.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    nextNodeId.current = 0;
    nextBranchId.current = 0;
    const nextConversation = createConversation(contextMode);
    const nextConversationId = createConversationId();

    conversationRef.current = nextConversation;
    conversationIdRef.current = nextConversationId;
    conversationTitleRef.current = null;
    setConversation(nextConversation);
    setConversationId(nextConversationId);
    setActiveNodeId(null);
    setBranchDraft(null);
    setHistoryOpen(false);
    setNewConversationDialogOpen(false);
    setSessionKey((currentKey) => currentKey + 1);
  }

  async function openHistory() {
    setHistoryOpen((isOpen) => !isOpen);

    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("History could not be read.");
      }

      const payload = (await response.json()) as { conversations: ConversationSummary[] };
      setHistory(payload.conversations);
      setStorageError(null);
    } catch {
      setStorageError("Local history could not be read.");
    }
  }

  async function loadConversation(id: string) {
    if (activeNodeId || id === conversationIdRef.current) {
      setHistoryOpen(false);
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Conversation could not be loaded.");
      }

      const snapshot = (await response.json()) as ConversationSnapshot;

      sessionVersion.current += 1;
      requestController.current?.abort();
      requestController.current = null;
      conversationRef.current = snapshot.conversation;
      conversationIdRef.current = snapshot.id;
      conversationTitleRef.current = snapshot.title;
      setConversation(snapshot.conversation);
      setConversationId(snapshot.id);
      nextNodeId.current = getNextId(snapshot.conversation.nodes, "node-");
      nextBranchId.current = getNextId(snapshot.conversation.branches, "branch-");
      setActiveNodeId(null);
      setBranchDraft(null);
      setHistoryOpen(false);
      setStorageError(null);
      setSessionKey((currentKey) => currentKey + 1);
    } catch {
      setStorageError("Local conversation could not be loaded.");
    }
  }

  async function removeConversation(item: ConversationSummary) {
    if (
      activeNodeId ||
      historyMutationId ||
      !window.confirm(`Delete "${item.title}" from local history? This cannot be undone.`)
    ) {
      return;
    }

    setHistoryMutationId(item.id);

    try {
      await saveQueue.current;
      const response = await fetch(`/api/conversations/${item.id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Conversation could not be deleted.");
      }

      setHistory((currentHistory) => currentHistory.filter(({ id }) => id !== item.id));

      if (item.id === conversationIdRef.current) {
        sessionVersion.current += 1;
        requestController.current?.abort();
        requestController.current = null;
        nextNodeId.current = 0;
        nextBranchId.current = 0;
        const nextConversation = createConversation();
        const nextConversationId = createConversationId();

        conversationRef.current = nextConversation;
        conversationIdRef.current = nextConversationId;
        conversationTitleRef.current = null;
        setConversation(nextConversation);
        setConversationId(nextConversationId);
        setActiveNodeId(null);
        setBranchDraft(null);
        setSessionKey((currentKey) => currentKey + 1);
      }

      setStorageError(null);
    } catch {
      setStorageError("Local conversation could not be deleted.");
    } finally {
      setHistoryMutationId(null);
    }
  }

  async function renameHistoryConversation(item: ConversationSummary) {
    if (activeNodeId || historyMutationId) {
      return;
    }

    const nextTitle = window.prompt("Rename conversation", item.title)?.trim();

    if (!nextTitle || nextTitle === item.title) {
      return;
    }

    if (nextTitle.length > 120) {
      setStorageError("Conversation titles must be 120 characters or fewer.");
      return;
    }

    const isCurrentConversation = item.id === conversationIdRef.current;
    const previousTitle = conversationTitleRef.current;

    if (isCurrentConversation) {
      conversationTitleRef.current = nextTitle;
    }

    setHistoryMutationId(item.id);

    try {
      await saveQueue.current;
      const response = await fetch(`/api/conversations/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        throw new Error("Conversation could not be renamed.");
      }

      setHistory((currentHistory) =>
        currentHistory.map((historyItem) =>
          historyItem.id === item.id ? { ...historyItem, title: nextTitle } : historyItem,
        ),
      );
      setStorageError(null);
    } catch {
      if (isCurrentConversation) {
        conversationTitleRef.current = previousTitle;
      }
      setStorageError("Local conversation could not be renamed.");
    } finally {
      setHistoryMutationId(null);
    }
  }

  function changeZoom(delta: number) {
    setZoomRequest((request) => ({ id: request.id + 1, delta }));
  }

  function addNode(question: string, branchId = MAIN_BRANCH_ID) {
    if (activeNodeId) {
      return;
    }

    const id = `node-${nextNodeId.current}`;
    const nextConversation = appendNode(conversationRef.current, {
      id,
      branchId,
      question,
      status: "pending",
    });

    replaceConversation(nextConversation);
    nextNodeId.current += 1;
    queueSave(nextConversation);
    void streamAnswer(nextConversation, id);
  }

  function retryNode(nodeId: string) {
    if (activeNodeId) {
      return;
    }

    const retryConversation = prepareNodeRetry(conversationRef.current, nodeId);
    replaceConversation(retryConversation);
    queueSave(retryConversation);
    void streamAnswer(retryConversation, nodeId);
  }

  function addChildBranch(originNodeId: string, side: BranchSide, question: string) {
    if (activeNodeId) {
      return;
    }

    const nodeId = `node-${nextNodeId.current}`;
    const branchId = `branch-${nextBranchId.current}`;
    const nextConversation = createChildBranch(conversationRef.current, {
      branchId,
      nodeId,
      originNodeId,
      side,
      question,
    });

    if (nextConversation === conversationRef.current) {
      return;
    }

    replaceConversation(nextConversation);
    setBranchDraft(null);
    nextNodeId.current += 1;
    nextBranchId.current += 1;
    queueSave(nextConversation);
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

  const contextModeLabel =
    conversation.contextMode === "summary_beta" ? "Summary mode (Beta)" : "Full context";
  const providerLabel = aiStatus?.configured
    ? `${aiStatus.provider} · ${aiStatus.model}`
    : aiStatus
      ? "AI not configured"
      : "Checking AI...";
  const toolbarStatus = `${providerLabel} · ${contextModeLabel}`;

  return (
    <section className="chat-experience" aria-labelledby="page-title">
      <header className="app-toolbar">
        <div className="app-toolbar__left">
          <button
            type="button"
            className="app-toolbar__action"
            onClick={() => {
              setHistoryOpen(false);
              setNewConversationDialogOpen(true);
            }}
          >
            New chat
          </button>
          <div className="history-control">
            <button
              type="button"
              className="app-toolbar__action"
              aria-expanded={historyOpen}
              onClick={() => void openHistory()}
            >
              History
            </button>
            {historyOpen ? (
              <div className="history-menu" aria-label="Local conversation history">
                {history.length === 0 ? (
                  <p>No saved conversations yet.</p>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className={`history-item${item.id === conversationId ? " is-current" : ""}`}
                    >
                      <button
                        type="button"
                        className="history-item__open"
                        disabled={activeNodeId !== null || historyMutationId !== null}
                        onClick={() => void loadConversation(item.id)}
                      >
                        <span>{item.title}</span>
                        <small>{item.nodeCount} {item.nodeCount === 1 ? "node" : "nodes"}</small>
                      </button>
                      <div className="history-item__actions">
                        <button
                          type="button"
                          className="history-item__rename"
                          aria-label={`Rename ${item.title}`}
                          title="Rename conversation"
                          disabled={activeNodeId !== null || historyMutationId !== null}
                          onClick={() => void renameHistoryConversation(item)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m4 16-.8 4.8L8 20l10.6-10.6-4-4L4 16Zm8.8-8.8 4 4M14.6 5.4l1.8-1.8a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-1.8 1.8" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="history-item__delete"
                          aria-label={`Delete ${item.title}`}
                          title="Delete conversation"
                          disabled={activeNodeId !== null || historyMutationId !== null}
                          onClick={() => void removeConversation(item)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
          {storageError ? (
            <span className="local-storage-error" role="alert">
              {storageError}
            </span>
          ) : null}
        </div>
        <div className="app-toolbar__identity">
          <h1 id="page-title">BranchChat</h1>
          <span
            className={aiStatus?.configured ? "ai-model-status" : "ai-model-status is-unconfigured"}
            title={aiStatus?.issue ?? toolbarStatus}
          >
            {toolbarStatus}
          </span>
        </div>
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

      {newConversationDialogOpen ? (
        <NewConversationDialog
          onCancel={() => setNewConversationDialogOpen(false)}
          onCreate={startNewChat}
        />
      ) : null}

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

      {!historyLoading && conversation.nodes.length === 0 ? (
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

      {historyLoading ? <p className="local-history-loading">Loading local history...</p> : null}
    </section>
  );
}
