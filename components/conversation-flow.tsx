"use client";

import {
  Handle,
  PanOnScrollMode,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { ConversationNode } from "@/components/conversation-node";
import { BranchDraft } from "@/components/branch-draft";
import {
  canBranchFromNode,
  isTipNode,
  type BranchSide,
  type ChatNode,
  type ConversationState,
} from "@/lib/conversation";

const NODE_GAP = 28;
const NODE_WIDTH = 460;
const NODE_TOP = 112;
const FALLBACK_NODE_HEIGHT = 240;
const CANVAS_PADDING = 20;

type ConversationFlowNodeData = {
  chatNode: ChatNode;
  isTip: boolean;
  composer?: ReactNode;
  onRetry?: () => void;
  branchDraftSide: BranchSide | null;
  onOpenBranchDraft: (side: BranchSide) => void;
  onCloseBranchDraft: () => void;
  onHeightChange: (nodeId: string, height: number) => void;
};

type ConversationFlowNode = Node<ConversationFlowNodeData, "conversation">;

type ConversationFlowProps = {
  conversation: ConversationState;
  renderComposer: (node: ChatNode) => ReactNode;
  onRetry: (nodeId: string) => void;
  branchDraft: { nodeId: string; side: BranchSide } | null;
  onOpenBranchDraft: (nodeId: string, side: BranchSide) => void;
  onCloseBranchDraft: () => void;
};

function FlowConversationNode({ id, data }: NodeProps<ConversationFlowNode>) {
  const elementRef = useRef<HTMLDivElement>(null);
  const leftButtonRef = useRef<HTMLButtonElement>(null);
  const rightButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const reportHeight = () => data.onHeightChange(id, element.getBoundingClientRect().height);
    const observer = new ResizeObserver(reportHeight);

    reportHeight();
    observer.observe(element);

    return () => observer.disconnect();
  }, [data, id]);

  function closeBranchDraft() {
    const trigger =
      data.branchDraftSide === "left" ? leftButtonRef.current : rightButtonRef.current;

    data.onCloseBranchDraft();
    requestAnimationFrame(() => trigger?.focus());
  }

  const canBranch = canBranchFromNode(data.chatNode);

  return (
    <div
      ref={elementRef}
      className="conversation-flow-node nopan nodrag"
      data-branch-open={data.branchDraftSide ?? undefined}
    >
      {data.chatNode.sequence > 0 ? (
        <Handle type="target" position={Position.Top} isConnectable={false} />
      ) : null}

      <ConversationNode
        question={data.chatNode.question}
        answer={data.chatNode.answer}
        status={data.chatNode.status}
        isTip={data.isTip}
        onRetry={data.onRetry}
        composer={data.composer}
      />

      {canBranch ? (
        <div className="branch-actions" aria-label="Branch actions">
          <button
            ref={leftButtonRef}
            type="button"
            className="branch-action branch-action--left"
            aria-label="Draft a left branch"
            aria-expanded={data.branchDraftSide === "left"}
            onClick={() => data.onOpenBranchDraft("left")}
          >
            +
          </button>
          <button
            ref={rightButtonRef}
            type="button"
            className="branch-action branch-action--right"
            aria-label="Draft a right branch"
            aria-expanded={data.branchDraftSide === "right"}
            onClick={() => data.onOpenBranchDraft("right")}
          >
            +
          </button>
        </div>
      ) : null}

      {data.branchDraftSide ? (
        <BranchDraft nodeId={id} side={data.branchDraftSide} onDismiss={closeBranchDraft} />
      ) : null}

      {!data.isTip ? (
        <Handle type="source" position={Position.Bottom} isConnectable={false} />
      ) : null}
    </div>
  );
}

const nodeTypes = {
  conversation: FlowConversationNode,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function ConversationFlow({
  conversation,
  renderComposer,
  onRetry,
  branchDraft,
  onOpenBranchDraft,
  onCloseBranchDraft,
}: ConversationFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flowInstance = useRef<ReactFlowInstance<ConversationFlowNode, Edge> | null>(null);
  const viewport = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const lastAutoPannedNodeCount = useRef(0);
  const horizontalDrag = useRef<{
    pointerId: number;
    startClientX: number;
    startViewportX: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setContainerSize({ width, height });
    };
    const observer = new ResizeObserver(updateSize);

    updateSize();
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const handleHeightChange = useCallback((nodeId: string, height: number) => {
    setNodeHeights((currentHeights) => {
      if (Math.abs((currentHeights[nodeId] ?? 0) - height) < 1) {
        return currentHeights;
      }

      return { ...currentHeights, [nodeId]: height };
    });
  }, []);

  const nodeWidth = containerSize.width
    ? Math.min(NODE_WIDTH, Math.max(240, containerSize.width - 40))
    : NODE_WIDTH;
  const nodeX = containerSize.width ? Math.max(20, (containerSize.width - nodeWidth) / 2) : 0;

  const nodes = useMemo(() => {
    return conversation.nodes.map<ConversationFlowNode>((chatNode, index) => {
      const isTip = isTipNode(conversation, chatNode.id);
      const nodeY = conversation.nodes.slice(0, index).reduce(
        (position, previousNode) =>
          position + (nodeHeights[previousNode.id] ?? FALLBACK_NODE_HEIGHT) + NODE_GAP,
        NODE_TOP,
      );
      const node: ConversationFlowNode = {
        id: chatNode.id,
        type: "conversation",
        position: { x: nodeX, y: nodeY },
        style: { width: nodeWidth, pointerEvents: "all" },
        className: "nopan nodrag",
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        data: {
          chatNode,
          isTip,
          composer: isTip ? renderComposer(chatNode) : undefined,
          onRetry: isTip ? () => onRetry(chatNode.id) : undefined,
          branchDraftSide:
            branchDraft?.nodeId === chatNode.id ? branchDraft.side : null,
          onOpenBranchDraft: (side) => onOpenBranchDraft(chatNode.id, side),
          onCloseBranchDraft,
          onHeightChange: handleHeightChange,
        },
      };

      return node;
    });
  }, [
    branchDraft,
    conversation,
    handleHeightChange,
    nodeHeights,
    nodeWidth,
    nodeX,
    onCloseBranchDraft,
    onOpenBranchDraft,
    onRetry,
    renderComposer,
  ]);

  const edges = useMemo(
    () =>
      conversation.nodes.slice(1).map<Edge>((chatNode, index) => ({
        id: `edge-${conversation.nodes[index].id}-${chatNode.id}`,
        source: conversation.nodes[index].id,
        target: chatNode.id,
        type: "straight",
        focusable: false,
        selectable: false,
        style: { stroke: "#aaa9a3", strokeWidth: 2 },
      })),
    [conversation.nodes],
  );

  const viewportBounds = useMemo(() => {
    if (nodes.length === 0 || !containerSize.width || !containerSize.height) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    const contentLeft = Math.min(...nodes.map((node) => node.position.x));
    const contentRight = Math.max(
      ...nodes.map((node) => node.position.x + (node.width ?? nodeWidth)),
    );
    const contentWidth = contentRight - contentLeft;
    const availableWidth = containerSize.width - CANVAS_PADDING * 2;
    const contentBottom = Math.max(
      ...nodes.map(
        (node) =>
          node.position.y + (nodeHeights[node.id] ?? FALLBACK_NODE_HEIGHT),
      ),
    );
    const bottomAlignedY = containerSize.height - CANVAS_PADDING - contentBottom;

    if (contentWidth <= availableWidth) {
      return {
        minX: CANVAS_PADDING - contentLeft,
        maxX: containerSize.width - CANVAS_PADDING - contentRight,
        minY: Math.min(0, bottomAlignedY),
        maxY: 0,
      };
    }

    return {
      minX: containerSize.width - CANVAS_PADDING - contentRight,
      maxX: CANVAS_PADDING - contentLeft,
      minY: Math.min(0, bottomAlignedY),
      maxY: 0,
    };
  }, [containerSize, nodeHeights, nodes, nodeWidth]);

  const constrainViewport = useCallback(
    (nextViewport: Viewport): Viewport => ({
      x: clamp(nextViewport.x, viewportBounds.minX, viewportBounds.maxX),
      y: clamp(nextViewport.y, viewportBounds.minY, viewportBounds.maxY),
      zoom: 1,
    }),
    [viewportBounds],
  );

  useEffect(() => {
    const instance = flowInstance.current;
    const currentViewport = viewport.current;
    const nextViewport = constrainViewport(currentViewport);

    if (
      !instance ||
      (nextViewport.x === currentViewport.x && nextViewport.y === currentViewport.y)
    ) {
      return;
    }

    viewport.current = nextViewport;
    void instance.setViewport(nextViewport);
  }, [constrainViewport]);

  useEffect(() => {
    const tipNode = nodes.at(-1);
    const nodeCount = conversation.nodes.length;

    if (
      !tipNode ||
      !containerSize.height ||
      nodeCount <= lastAutoPannedNodeCount.current
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const currentViewport = viewport.current;
      const tipHeight = nodeHeights[tipNode.id] ?? FALLBACK_NODE_HEIGHT;
      const visibleTop = tipNode.position.y + currentViewport.y;
      const visibleBottom = visibleTop + tipHeight;
      const safeTop = 92;
      const safeBottom = containerSize.height - 24;
      let nextY = currentViewport.y;

      if (visibleBottom > safeBottom) {
        nextY -= visibleBottom - safeBottom;
      } else if (visibleTop < safeTop) {
        nextY += safeTop - visibleTop;
      }

      if (nextY !== currentViewport.y) {
        const nextViewport = constrainViewport({ ...currentViewport, y: nextY, zoom: 1 });
        viewport.current = nextViewport;
        void flowInstance.current?.setViewport(nextViewport, { duration: 220 });
      }

      lastAutoPannedNodeCount.current = nodeCount;
    });

    return () => cancelAnimationFrame(frame);
  }, [
    containerSize.height,
    constrainViewport,
    conversation.nodes.length,
    nodeHeights,
    nodes,
  ]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      conversation.nodes.length === 0 ||
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      !event.target.classList.contains("react-flow__pane")
    ) {
      return;
    }

    horizontalDrag.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startViewportX: viewport.current.x,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = horizontalDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextX = drag.startViewportX + event.clientX - drag.startClientX;
    const nextViewport = constrainViewport({ ...viewport.current, x: nextX, zoom: 1 });

    viewport.current = nextViewport;
    void flowInstance.current?.setViewport(nextViewport);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (horizontalDrag.current?.pointerId !== event.pointerId) {
      return;
    }

    horizontalDrag.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={containerRef}
      className="conversation-flow"
      aria-label="Conversation canvas"
      onPointerDownCapture={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <ReactFlow<ConversationFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        onInit={(instance) => {
          flowInstance.current = instance;
        }}
        onMove={(_, nextViewport) => {
          const constrainedViewport = constrainViewport(nextViewport);
          viewport.current = constrainedViewport;

          if (
            constrainedViewport.x !== nextViewport.x ||
            constrainedViewport.y !== nextViewport.y ||
            nextViewport.zoom !== 1
          ) {
            void flowInstance.current?.setViewport(constrainedViewport);
          }
        }}
        minZoom={1}
        maxZoom={1}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        nodesFocusable={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={conversation.nodes.length > 0}
        panOnScrollMode={PanOnScrollMode.Free}
        panOnDrag={false}
        preventScrolling
        selectionOnDrag={false}
        autoPanOnNodeFocus={false}
      />
    </div>
  );
}
