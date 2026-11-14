import {
  MAIN_BRANCH_ID,
  type Branch,
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

function getBranchLanes(conversation: ConversationState): ReadonlyMap<string, number> {
  const lanes = new Map<string, number>([[MAIN_BRANCH_ID, 0]]);
  const nodeBranches = new Map(
    conversation.nodes.map((node) => [node.id, node.branchId]),
  );
  const parentBranches = new Map<string, string>();

  for (const branch of conversation.branches) {
    if (!branch.originNodeId) {
      continue;
    }

    const parentBranchId = nodeBranches.get(branch.originNodeId);

    if (parentBranchId) {
      parentBranches.set(branch.id, parentBranchId);
    }
  }

  function belongsToSubtree(branchId: string, rootBranchId: string) {
    let currentBranchId: string | undefined = branchId;
    const visited = new Set<string>();

    while (currentBranchId && !visited.has(currentBranchId)) {
      if (currentBranchId === rootBranchId) {
        return true;
      }

      visited.add(currentBranchId);
      currentBranchId = parentBranches.get(currentBranchId);
    }

    return false;
  }

  function getSiblingSubtreeBoundary(
    siblings: readonly Branch[],
    side: "left" | "right",
  ) {
    const subtreeLanes = [...lanes].flatMap(([branchId, lane]) =>
      siblings.some((sibling) => belongsToSubtree(branchId, sibling.id))
        ? [lane]
        : [],
    );

    if (subtreeLanes.length === 0) {
      return undefined;
    }

    return side === "left"
      ? Math.min(...subtreeLanes)
      : Math.max(...subtreeLanes);
  }

  for (const [branchIndex, branch] of conversation.branches.entries()) {
    if (
      branch.id === MAIN_BRANCH_ID ||
      !branch.originNodeId ||
      !branch.side
    ) {
      continue;
    }

    const originBranchId = nodeBranches.get(branch.originNodeId);
    const originLane = originBranchId ? lanes.get(originBranchId) : undefined;

    if (originLane === undefined) {
      continue;
    }

    const earlierSiblings = conversation.branches
      .slice(0, branchIndex)
      .filter(
        (candidate) =>
          candidate.originNodeId === branch.originNodeId &&
          candidate.side === branch.side,
      );
    const siblingBoundary = getSiblingSubtreeBoundary(
      earlierSiblings,
      branch.side,
    );
    const candidateLane =
      siblingBoundary === undefined
        ? originLane + (branch.side === "left" ? -1 : 1)
        : siblingBoundary + (branch.side === "left" ? -1 : 1);

    for (const [branchId, lane] of lanes) {
      if (branch.side === "left" && lane <= candidateLane) {
        lanes.set(branchId, lane - 1);
      } else if (branch.side === "right" && lane >= candidateLane) {
        lanes.set(branchId, lane + 1);
      }
    }

    lanes.set(branch.id, candidateLane);
  }

  const mainLane = lanes.get(MAIN_BRANCH_ID) ?? 0;

  return new Map(
    [...lanes].map(([branchId, lane]) => [branchId, lane - mainLane]),
  );
}

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
  const branchLanes = getBranchLanes(conversation);

  for (const branch of conversation.branches) {
    const branchNodes = conversation.nodes
      .filter((node) => node.branchId === branch.id)
      .sort((first, second) => first.sequence - second.sequence);
    const originPosition = branch.originNodeId ? positions[branch.originNodeId] : undefined;
    const lane = branchLanes.get(branch.id) ?? 0;

    const branchX = mainX + lane * (nodeWidth + BRANCH_LANE_GAP);
    const originHeight = branch.originNodeId
      ? nodeHeights[branch.originNodeId] ?? fallbackNodeHeight
      : 0;
    const branchTop = originPosition
      ? originPosition.y + originHeight / 2 + nodeGap
      : nodeTop;
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
  zoom = 1,
): HorizontalViewportBounds {
  const nodeCenters = Object.values(positions).map(
    (position) => position.x + nodeWidth / 2,
  );

  if (nodeCenters.length === 0 || viewportWidth === 0) {
    return { minX: 0, maxX: 0 };
  }

  const viewportCenter = viewportWidth / 2;

  return {
    minX: viewportCenter - Math.max(...nodeCenters) * zoom,
    maxX: viewportCenter - Math.min(...nodeCenters) * zoom,
  };
}
