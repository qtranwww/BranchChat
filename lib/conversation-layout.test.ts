import { describe, expect, it } from "vitest";

import {
  getHorizontalViewportBounds,
  layoutConversation,
} from "./conversation-layout";
import {
  appendNode,
  createChildBranch,
  createConversation,
} from "./conversation";

describe("conversation layout", () => {
  it("places child branches on the selected side of their origin", () => {
    const main = appendNode(createConversation(), {
      id: "node-0",
      question: "Main",
    });
    const left = createChildBranch(main, {
      branchId: "branch-left",
      nodeId: "node-left",
      originNodeId: "node-0",
      side: "left",
      question: "Left",
    });
    const bothSides = createChildBranch(left, {
      branchId: "branch-right",
      nodeId: "node-right",
      originNodeId: "node-0",
      side: "right",
      question: "Right",
    });
    const positions = layoutConversation({
      conversation: bothSides,
      mainX: 500,
      nodeWidth: 460,
      nodeTop: 112,
      nodeGap: 28,
      fallbackNodeHeight: 240,
      nodeHeights: {},
    });

    expect(positions["node-left"].x).toBeLessThan(positions["node-0"].x);
    expect(positions["node-right"].x).toBeGreaterThan(positions["node-0"].x);
    expect(positions["node-left"].y).toBe(positions["node-0"].y);
    expect(positions["node-right"].y).toBe(positions["node-0"].y);
  });

  it("lets either outermost node move to the center of the viewport", () => {
    const positions = {
      left: { x: -90, y: 112 },
      main: { x: 490, y: 112 },
      right: { x: 1070, y: 112 },
    };

    expect(getHorizontalViewportBounds(positions, 1440, 460)).toEqual({
      minX: -580,
      maxX: 580,
    });
  });
});
