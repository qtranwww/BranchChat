import {
  MAIN_BRANCH_ID,
  type ConversationState,
} from "./conversation";

const BRANCH_LANE_GAP = 120;
const FIRST_BRANCH_HUE = 210;
const GOLDEN_ANGLE = 137.508;
const MAIN_BRANCH_STROKE = "#716f69";

export type NodePosition = {
  x: number;
  y: number;
};

export type HorizontalViewportBounds = {
  minX: number;
  maxX: number;
};

export function getBranchStroke(branchIndex: number): string {
  if (branchIndex <= 0) {
    return MAIN_BRANCH_STROKE;
  }

  const hue = Math.round(
    (FIRST_BRANCH_HUE + (branchIndex - 1) * GOLDEN_ANGLE) % 360,
  );

  return `hsl(${hue} 62% 38%)`;
}

type LayoutConversationInput = {
  conversation: ConversationState;
  mainX: number;
  nodeWidth: number;
  nodeTop: number;
  nodeGap: number;
  fallbackNodeHeight: number;
  nodeHeights: Readonly<Record<string, number>>;
};

export function layoutConversation({
  conversation,
  mainX,
  nodeWidth,
  nodeTop,
  nodeGap,
  fallbackNodeHeight,
  nodeHeights,
}: LayoutConversationInput): Readonly<Record<string, NodePosition>> {
  const positions: Record<string, NodePosition> = {};

  for (const branch of conversation.branches) {
    const branchNodes = conversation.nodes
      .filter((node) => node.branchId === branch.id)
      .sort((first, second) => first.sequence - second.sequence);
    const originPosition = branch.originNodeId ? positions[branch.originNodeId] : undefined;
    const direction = branch.side === "left" ? -1 : 1;
    const laneDistance =
      (branch.siblingOrder + 1) * (nodeWidth + BRANCH_LANE_GAP);
    const branchX =
      branch.id === MAIN_BRANCH_ID || !originPosition
        ? mainX
        : originPosition.x + direction * laneDistance;
    const branchTop = originPosition?.y ?? nodeTop;
    let nextY = branchTop;

    for (const node of branchNodes) {
      positions[node.id] = { x: branchX, y: nextY };
      nextY += (nodeHeights[node.id] ?? fallbackNodeHeight) + nodeGap;
    }
  }

  return positions;
}

export function getHorizontalViewportBounds(
  positions: Readonly<Record<string, NodePosition>>,
  viewportWidth: number,
  nodeWidth: number,
): HorizontalViewportBounds {
  const nodeCenters = Object.values(positions).map(
    (position) => position.x + nodeWidth / 2,
  );

  if (nodeCenters.length === 0 || viewportWidth === 0) {
    return { minX: 0, maxX: 0 };
  }

  const viewportCenter = viewportWidth / 2;

  return {
    minX: viewportCenter - Math.max(...nodeCenters),
    maxX: viewportCenter - Math.min(...nodeCenters),
  };
}
