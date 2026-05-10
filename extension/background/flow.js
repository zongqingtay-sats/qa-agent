/**
 * @file background/flow.js
 * @description Utilities for working with the test flow graph:
 * computing execution order via BFS and stopping a running test.
 */

import { get, set } from './state.js';
import { broadcastStatus } from './badge.js';

/**
 * Derive a linear execution order from a test flow graph by performing
 * a BFS traversal starting from the `start` node.
 *
 * If no start node is found the function falls back to returning all
 * nodes in their original order so execution can still be attempted.
 *
 * @param {{ nodes: Array<object>, edges: Array<object> }} testFlow
 *   The test flow containing `nodes` and `edges` arrays.
 * @returns {Array<object>} Ordered list of nodes to execute.
 */
export function getExecutionOrder(testFlow) {
  const { nodes, edges } = testFlow;
  if (!nodes || !edges) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build adjacency list from edges
  const adjacency = new Map();
  edges.forEach((e) => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source).push(e.target);
  });

  // Locate the start node (blockType === 'start')
  const startNode = nodes.find((n) => n.data?.blockType === 'start');
  if (!startNode) return nodes; // Fallback: return all nodes

  // BFS traversal
  const order = [];
  const visited = new Set();
  const queue = [startNode.id];

  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodeMap.get(id);
    if (node) order.push(node);

    const targets = adjacency.get(id) || [];
    targets.forEach((t) => {
      if (!visited.has(t)) queue.push(t);
    });
  }

  return order;
}

/**
 * Immediately stop the currently-running test and notify the web app.
 *
 * Sends a `TEST_COMPLETE` message with status `stopped` and resets
 * execution-related state so the extension is ready for the next run.
 *
 * @param {chrome.runtime.Port} port - The port connected to the web app.
 */
export function stopTestExecution(port) {
  port.postMessage({
    type: 'TEST_COMPLETE',
    testCaseId: get('currentTestCaseId'),
    status: 'stopped',
    stepResults: get('stepResults'),
    durationMs: Date.now() - get('testStartTime'),
  });

  broadcastStatus('completed', {
    testName: get('currentTestName'),
    result: 'stopped',
  });

  // Reset execution state
  set('currentTestFlow', null);
  set('executingTabId', null);
}
