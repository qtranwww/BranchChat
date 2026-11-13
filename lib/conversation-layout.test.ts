import { describe, expect, it } from "vitest";

import {
  getBranchStroke,
  getHorizontalViewportBounds,
  layoutConversation,
} from "./conversation-layout";
import {
  appendNode,
  createChildBranch,
  createConversation,
} from "./conversation";

describe("conversation layout", () => {
  it("assigns stable, distinct connector colors to branches", () => {
    const colors = Array.from({ length: 12 }, (_, index) => getBranchStroke(index));

    expect(colors[0]).toBe("#716f69");
    expect(new Set(colors)).toHaveLength(colors.length);
    expect(colors.slice(1).every((color) => color.endsWith("62% 38%)"))).toBe(true);
  });

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
      nodeHeights: { "node-0": 800 },
    });

    expect(positions["node-left"].x).toBeLessThan(positions["node-0"].x);
    expect(positions["node-right"].x).toBeGreaterThan(positions["node-0"].x);
    expect(positions["node-left"].y).toBe(540);
    expect(positions["node-right"].y).toBe(540);
  });

  it("inserts a lane beside each flat branch origin", () => {
    const firstMain = appendNode(createConversation(), {
      id: "node-0",
      question: "First main node",
    });
    const main = appendNode(firstMain, {
      id: "node-1",
      question: "Second main node",
    });
    const firstLeft = createChildBranch(main, {
      branchId: "branch-left-0",
      nodeId: "node-left-0",
      originNodeId: "node-0",
      side: "left",
      question: "First left branch",
    });
    const secondLeft = createChildBranch(firstLeft, {
      branchId: "branch-left-1",
      nodeId: "node-left-1",
      originNodeId: "node-1",
      side: "left",
      question: "Second left branch",
    });
    const firstRight = createChildBranch(secondLeft, {
      branchId: "branch-right-0",
      nodeId: "node-right-0",
      originNodeId: "node-0",
      side: "right",
      question: "First right branch",
    });
    const allBranches = createChildBranch(firstRight, {
      branchId: "branch-right-1",
      nodeId: "node-right-1",
      originNodeId: "node-1",
      side: "right",
      question: "Second right branch",
    });
    const positions = layoutConversation({
      conversation: allBranches,
      mainX: 500,
      nodeWidth: 460,
      nodeTop: 112,
      nodeGap: 28,
      fallbackNodeHeight: 240,
      nodeHeights: {},
    });

    expect(positions["node-left-0"].x).toBe(-660);
    expect(positions["node-left-1"].x).toBe(-80);
    expect(positions["node-right-0"].x).toBe(1660);
    expect(positions["node-right-1"].x).toBe(1080);
  });

  it("keeps three same-origin siblings in stable outward lanes", () => {
    const main = appendNode(createConversation(), {
      id: "node-0",
      question: "Origin",
    });
    const first = createChildBranch(main, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "left",
      question: "First sibling",
    });
    const second = createChildBranch(first, {
      branchId: "branch-1",
      nodeId: "node-2",
      originNodeId: "node-0",
      side: "left",
      question: "Second sibling",
    });
    const third = createChildBranch(second, {
      branchId: "branch-2",
      nodeId: "node-3",
      originNodeId: "node-0",
      side: "left",
      question: "Third sibling",
    });
    const input = {
      conversation: third,
      mainX: 500,
      nodeWidth: 460,
      nodeTop: 112,
      nodeGap: 28,
      fallbackNodeHeight: 240,
    };
    const positions = layoutConversation({ ...input, nodeHeights: {} });
    const measuredPositions = layoutConversation({
      ...input,
      nodeHeights: { "node-0": 800, "node-1": 400 },
    });

    expect([
      positions["node-1"].x,
      positions["node-2"].x,
      positions["node-3"].x,
    ]).toEqual([-80, -660, -1240]);
    expect([
      measuredPositions["node-1"].x,
      measuredPositions["node-2"].x,
      measuredPositions["node-3"].x,
    ]).toEqual([-80, -660, -1240]);
  });

  it("inserts an inward nested branch between its origin and main", () => {
    const main = appendNode(createConversation(), {
      id: "node-0",
      question: "Main",
    });
    const child = createChildBranch(main, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "left",
      question: "Child",
      status: "completed",
    });
    const nested = createChildBranch(child, {
      branchId: "branch-1",
      nodeId: "node-2",
      originNodeId: "node-1",
      side: "right",
      question: "Nested",
    });
    const positions = layoutConversation({
      conversation: nested,
      mainX: 500,
      nodeWidth: 460,
      nodeTop: 112,
      nodeGap: 28,
      fallbackNodeHeight: 240,
      nodeHeights: {},
    });

    expect(positions["node-1"].x).toBe(-660);
    expect(positions["node-2"].x).toBe(-80);
    expect(positions["node-2"].y).toBe(408);
  });

  it("places a later sibling outside an existing nested subtree", () => {
    const main = appendNode(createConversation(), {
      id: "node-0",
      question: "Main",
    });
    const firstChild = createChildBranch(main, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "left",
      question: "First child",
      status: "completed",
    });
    const nested = createChildBranch(firstChild, {
      branchId: "branch-1",
      nodeId: "node-2",
      originNodeId: "node-1",
      side: "left",
      question: "Nested child",
    });
    const laterSibling = createChildBranch(nested, {
      branchId: "branch-2",
      nodeId: "node-3",
      originNodeId: "node-0",
      side: "left",
      question: "Later sibling",
    });
    const positions = layoutConversation({
      conversation: laterSibling,
      mainX: 500,
      nodeWidth: 460,
      nodeTop: 112,
      nodeGap: 28,
      fallbackNodeHeight: 240,
      nodeHeights: {},
    });

    expect(positions["node-1"].x).toBe(-80);
    expect(positions["node-2"].x).toBe(-660);
    expect(positions["node-3"].x).toBe(-1240);
  });

  it("mirrors nested subtree reservation on the right", () => {
    const main = appendNode(createConversation(), {
      id: "node-0",
      question: "Main",
    });
    const firstChild = createChildBranch(main, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "right",
      question: "First child",
      status: "completed",
    });
    const nested = createChildBranch(firstChild, {
      branchId: "branch-1",
      nodeId: "node-2",
      originNodeId: "node-1",
      side: "right",
      question: "Nested child",
    });
    const laterSibling = createChildBranch(nested, {
      branchId: "branch-2",
      nodeId: "node-3",
      originNodeId: "node-0",
      side: "right",
      question: "Later sibling",
    });
    const positions = layoutConversation({
      conversation: laterSibling,
      mainX: 500,
      nodeWidth: 460,
      nodeTop: 112,
      nodeGap: 28,
      fallbackNodeHeight: 240,
      nodeHeights: {},
    });

    expect(positions["node-1"].x).toBe(1080);
    expect(positions["node-2"].x).toBe(1660);
    expect(positions["node-3"].x).toBe(2240);
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
