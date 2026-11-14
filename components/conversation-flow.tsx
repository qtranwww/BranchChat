"use client";

import {
  Handle,
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
  type WheelEvent as ReactWheelEvent,
} from "react";

import { ConversationNode } from "@/components/conversation-node";
import { BranchDraft } from "@/components/branch-draft";
import {
  getBranchStroke,
  getHorizontalViewportBounds,
  layoutConversation,
} from "@/lib/conversation-layout";
import {
  canBranchFromNode,
  isTipNode,
  MAIN_BRANCH_ID,
  type BranchSide,
  type ChatNode,
  type ConversationState,
} from "@/lib/conversation";

const NODE_GAP = 28;
const NODE_WIDTH = 460;
const NODE_TOP = 112;
const FALLBACK_NODE_HEIGHT = 240;
const CANVAS_PADDING = 20;
const CONTENT_BOTTOM_PADDING = 40;
const CONTENT_SAFE_TOP = 92;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.3;

type ConversationFlowNodeData = {
  chatNode: ChatNode;
  isTip: boolean;
  canBranch: boolean;
  composer?: ReactNode;
  onRetry?: () => void;
  branchDraftSide: BranchSide | null;
  branchSubmissionDisabled: boolean;
  onOpenBranchDraft: (side: BranchSide) => void;
  onSubmitBranchDraft: (side: BranchSide, prompt: string) => void;
  onCloseBranchDraft: () => void;
  onHeightChange: (nodeId: string, height: number) => void;
};

type ConversationFlowNode = Node<ConversationFlowNodeData, "conversation">;

type ConversationFlowProps = {
  conversation: ConversationState;
  originRequest: number;
  zoomRequest: { id: number; delta: number };
  renderComposer: (node: ChatNode) => ReactNode;
  onRetry: (nodeId: string) => void;
  branchDraft: { nodeId: string; side: BranchSide } | null;
  onOpenBranchDraft: (nodeId: string, side: BranchSide) => void;
  onSubmitBranchDraft: (nodeId: string, side: BranchSide, prompt: string) => void;
  onCloseBranchDraft: () => void;
  branchSubmissionDisabled: boolean;
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

    const reportHeight = () => data.onHeightChange(id, element.offsetHeight);
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

  return (
    <div
      ref={elementRef}
      className="conversation-flow-node nopan nodrag"
    >
      <Handle
        id="linear-target"
        type="target"
        position={Position.Top}
        isConnectable={false}
      />
      <ConversationNode
        question={data.chatNode.question}
        answer={data.chatNode.answer}
        status={data.chatNode.status}
        isTip={data.isTip}
        onRetry={data.onRetry}
        composer={data.composer}
      />

      {data.canBranch ? (
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
        <BranchDraft
          nodeId={id}
          side={data.branchDraftSide}
          disabled={data.branchSubmissionDisabled}
          onSubmit={(prompt) => data.onSubmitBranchDraft(data.branchDraftSide!, prompt)}
          onDismiss={closeBranchDraft}
        />
      ) : null}

      <Handle
        id="linear-source"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
      />
      <Handle
        id="branch-source-left"
        type="source"
        position={Position.Left}
        isConnectable={false}
      />
      <Handle
        id="branch-source-right"
        type="source"
        position={Position.Right}
        isConnectable={false}
      />
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
  originRequest,
  zoomRequest,
  renderComposer,
  onRetry,
  branchDraft,
  onOpenBranchDraft,
  onSubmitBranchDraft,
  onCloseBranchDraft,
  branchSubmissionDisabled,
}: ConversationFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flowInstance = useRef<ReactFlowInstance<ConversationFlowNode, Edge> | null>(null);
  const viewport = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const lastOriginRequest = useRef(originRequest);
  const lastZoomRequest = useRef(zoomRequest.id);
  const lastAutoPannedNodeCount = useRef(0);
  const lastCompletedScroll = useRef<string | null>(null);
  const horizontalDrag = useRef<{
    pointerId: number;
    startClientX: number;
    startViewportX: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [canvasZoom, setCanvasZoom] = useState(1);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
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
  const nodePositions = useMemo(
    () =>
      layoutConversation({
        conversation,
        mainX: nodeX,
        nodeWidth,
        nodeTop: NODE_TOP,
        nodeGap: NODE_GAP,
        fallbackNodeHeight: FALLBACK_NODE_HEIGHT,
        nodeHeights,
      }),
    [conversation, nodeHeights, nodeWidth, nodeX],
  );

  const nodes = useMemo(() => {
    return conversation.nodes.map<ConversationFlowNode>((chatNode) => {
      const isTip = isTipNode(conversation, chatNode.id);
      const position = nodePositions[chatNode.id] ?? { x: nodeX, y: NODE_TOP };
      const node: ConversationFlowNode = {
        id: chatNode.id,
        type: "conversation",
        position,
        measured: {
          width: nodeWidth,
          height: nodeHeights[chatNode.id] ?? FALLBACK_NODE_HEIGHT,
        },
        style: { width: nodeWidth, pointerEvents: "all" },
        className: "nopan nodrag",
        data: {
          chatNode,
          isTip,
          canBranch: canBranchFromNode(chatNode),
          composer: isTip ? renderComposer(chatNode) : undefined,
          onRetry:
            chatNode.status === "failed" ? () => onRetry(chatNode.id) : undefined,
          branchDraftSide:
            branchDraft?.nodeId === chatNode.id ? branchDraft.side : null,
          branchSubmissionDisabled,
          onOpenBranchDraft: (side) => onOpenBranchDraft(chatNode.id, side),
          onSubmitBranchDraft: (side, prompt) =>
            onSubmitBranchDraft(chatNode.id, side, prompt),
          onCloseBranchDraft,
          onHeightChange: handleHeightChange,
        },
      };

      return node;
    });
  }, [
    branchDraft,
    branchSubmissionDisabled,
    conversation,
    handleHeightChange,
    nodeHeights,
    nodeWidth,
    nodeX,
    nodePositions,
    onCloseBranchDraft,
    onOpenBranchDraft,
    onRetry,
    onSubmitBranchDraft,
    renderComposer,
  ]);

  const branchStrokes = useMemo(
    () =>
      new Map(
        conversation.branches.map((branch, index) => [
          branch.id,
          getBranchStroke(index),
        ]),
      ),
    [conversation.branches],
  );

  const edges = useMemo(
    () =>
      conversation.nodes.flatMap<Edge>((chatNode) => {
        const style = {
          stroke: branchStrokes.get(chatNode.branchId) ?? getBranchStroke(0),
          strokeWidth: 4,
        };

        if (chatNode.previousNodeId) {
          return [
            {
              id: `edge-${chatNode.previousNodeId}-${chatNode.id}`,
              source: chatNode.previousNodeId,
              sourceHandle: "linear-source",
              target: chatNode.id,
              targetHandle: "linear-target",
              type: "straight",
              style,
            },
          ];
        }

        const branch = conversation.branches.find(
          (candidate) => candidate.id === chatNode.branchId,
        );

        if (!branch?.originNodeId || !branch.side) {
          return [];
        }

        const isLeft = branch.side === "left";

        return [
          {
            id: `edge-${branch.originNodeId}-${chatNode.id}`,
            source: branch.originNodeId,
            sourceHandle: isLeft ? "branch-source-left" : "branch-source-right",
            target: chatNode.id,
            targetHandle: "linear-target",
            type: "straight",
            style,
          },
        ];
      }),
    [branchStrokes, conversation.branches, conversation.nodes],
  );

  const originWorldX = useMemo(() => {
    const mainNode = conversation.nodes.find(
      (node) => node.branchId === MAIN_BRANCH_ID,
    );
    const mainPosition = mainNode ? nodePositions[mainNode.id] : undefined;

    return mainPosition ? mainPosition.x + nodeWidth / 2 : containerSize.width / 2;
  }, [containerSize.width, conversation.nodes, nodePositions, nodeWidth]);

  const contentHeight = useMemo(() => {
    const contentBottom = nodes.reduce(
      (bottom, node) =>
        Math.max(
          bottom,
          node.position.y + (nodeHeights[node.id] ?? FALLBACK_NODE_HEIGHT),
        ),
      0,
    );

    return Math.max(
      containerSize.height,
      (contentBottom + CONTENT_BOTTOM_PADDING) * canvasZoom,
      1,
    );
  }, [canvasZoom, containerSize.height, nodeHeights, nodes]);

  const constrainViewport = useCallback(
    (nextViewport: Viewport): Viewport => {
      const zoom = clamp(nextViewport.zoom, MIN_ZOOM, MAX_ZOOM);
      const bounds = getHorizontalViewportBounds(
        nodePositions,
        containerSize.width,
        nodeWidth,
        zoom,
      );

      return {
        x: clamp(nextViewport.x, bounds.minX, bounds.maxX),
        y: 0,
        zoom,
      };
    },
    [containerSize.width, nodePositions, nodeWidth],
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
    const container = containerRef.current;
    const instance = flowInstance.current;

    if (
      !container ||
      !instance ||
      originRequest === lastOriginRequest.current
    ) {
      return;
    }

    lastOriginRequest.current = originRequest;
    const nextViewport = constrainViewport({
      x: containerSize.width / 2 - originWorldX * canvasZoom,
      y: 0,
      zoom: canvasZoom,
    });

    horizontalDrag.current = null;
    viewport.current = nextViewport;
    void instance.setViewport(nextViewport);
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, [canvasZoom, constrainViewport, containerSize.width, originRequest, originWorldX]);

  useEffect(() => {
    const instance = flowInstance.current;

    if (!instance || zoomRequest.id === lastZoomRequest.current) {
      return;
    }

    lastZoomRequest.current = zoomRequest.id;
    const currentViewport = viewport.current;
    const nextZoom = clamp(
      Math.round((currentViewport.zoom + zoomRequest.delta) * 10) / 10,
      MIN_ZOOM,
      MAX_ZOOM,
    );
    const worldCenter =
      (containerSize.width / 2 - currentViewport.x) / currentViewport.zoom;
    const nextViewport = constrainViewport({
      x: containerSize.width / 2 - worldCenter * nextZoom,
      y: 0,
      zoom: nextZoom,
    });

    viewport.current = nextViewport;
    setCanvasZoom(nextViewport.zoom);
    void instance.setViewport(nextViewport);
  }, [constrainViewport, containerSize.width, zoomRequest]);

  useEffect(() => {
    const container = containerRef.current;
    const tipNode = nodes.at(-1);
    const nodeCount = conversation.nodes.length;

    if (
      !container ||
      !tipNode ||
      nodeCount <= lastAutoPannedNodeCount.current
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const tipHeight = (nodeHeights[tipNode.id] ?? FALLBACK_NODE_HEIGHT) * canvasZoom;
      const tipTop = tipNode.position.y * canvasZoom;
      const tipBottom = tipTop + tipHeight;
      const visibleTop = container.scrollTop + CONTENT_SAFE_TOP;
      const visibleBottom = container.scrollTop + container.clientHeight - 24;
      let nextScrollTop = container.scrollTop;

      if (tipBottom > visibleBottom) {
        nextScrollTop = tipBottom - container.clientHeight + 24;
      } else if (tipTop < visibleTop) {
        nextScrollTop = Math.max(0, tipTop - CONTENT_SAFE_TOP);
      }

      if (nextScrollTop !== container.scrollTop) {
        container.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      }

      const currentViewport = viewport.current;
      const visibleLeft = tipNode.position.x * canvasZoom + currentViewport.x;
      const visibleRight = visibleLeft + nodeWidth * canvasZoom;
      let nextX = currentViewport.x;

      if (visibleLeft < CANVAS_PADDING) {
        nextX += CANVAS_PADDING - visibleLeft;
      } else if (visibleRight > container.clientWidth - CANVAS_PADDING) {
        nextX -= visibleRight - (container.clientWidth - CANVAS_PADDING);
      }

      if (nextX !== currentViewport.x) {
        const nextViewport = constrainViewport({ ...currentViewport, x: nextX });
        viewport.current = nextViewport;
        void flowInstance.current?.setViewport(nextViewport, { duration: 220 });
      }

      lastAutoPannedNodeCount.current = nodeCount;
    });

    return () => cancelAnimationFrame(frame);
  }, [
    canvasZoom,
    containerSize.height,
    constrainViewport,
    conversation.nodes.length,
    nodeHeights,
    nodeWidth,
    nodes,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    const tipNode = nodes.at(-1);

    if (!container || !tipNode || tipNode.data.chatNode.status !== "completed") {
      return;
    }

    if (lastCompletedScroll.current === tipNode.id) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const nodeElement = container.querySelector(`[data-id="${tipNode.id}"]`);
      const answerElement = nodeElement?.querySelector<HTMLElement>(
        ".conversation-node__answer",
      );

      if (!answerElement) {
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      const answerTop =
        container.scrollTop + answerElement.getBoundingClientRect().top - containerTop;
      const nextScrollTop = Math.max(0, answerTop - CONTENT_SAFE_TOP);

      if (container.scrollHeight - container.clientHeight < nextScrollTop) {
        return;
      }

      container.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      lastCompletedScroll.current = tipNode.id;
    });

    return () => cancelAnimationFrame(frame);
  }, [nodeHeights, nodes]);

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
    const nextViewport = constrainViewport({ ...viewport.current, x: nextX });

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

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (conversation.nodes.length === 0) {
      return;
    }

    const horizontalDelta =
      event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)
        ? event.deltaY
        : event.deltaX;
    const isHorizontalGesture =
      event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);

    if (!isHorizontalGesture || horizontalDelta === 0) {
      return;
    }

    event.preventDefault();
    const nextViewport = constrainViewport({
      ...viewport.current,
      x: viewport.current.x - horizontalDelta,
    });

    viewport.current = nextViewport;
    void flowInstance.current?.setViewport(nextViewport);
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
      onWheel={handleWheel}
    >
      <div className="conversation-flow__surface" style={{ height: contentHeight }}>
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
            setCanvasZoom(constrainedViewport.zoom);

            if (
              constrainedViewport.x !== nextViewport.x ||
              constrainedViewport.y !== nextViewport.y ||
              nextViewport.zoom !== constrainedViewport.zoom
            ) {
              void flowInstance.current?.setViewport(constrainedViewport);
            }
          }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          nodesFocusable={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          panOnDrag={false}
          preventScrolling={false}
          selectionOnDrag={false}
          autoPanOnNodeFocus={false}
        />
      </div>
    </div>
  );
}
