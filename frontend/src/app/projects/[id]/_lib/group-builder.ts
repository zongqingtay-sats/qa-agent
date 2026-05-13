/**
 * Test case grouping logic for the project detail page.
 *
 * Provides single-level and two-level grouping strategies that organize
 * test cases by Feature, Phase, or nested combinations (Feature → Phase,
 * Phase → Feature).  Test cases with M2M relationships can appear in
 * multiple groups.
 */

import type { ProjectTestCase, Feature, Phase } from "@/types/api";

/** Available grouping strategies for the project view. */
export type GroupingMode = "feature" | "phase" | "feature-phase" | "phase-feature";

/** A single section of grouped test cases, optionally containing sub-groups. */
export interface GroupedSection {
  key: string;
  label: string;
  groupType: "feature" | "phase";
  groupId: string;
  items: ProjectTestCase[];
  subGroups?: {
    key: string;
    label: string;
    groupType: "feature" | "phase";
    groupId: string;
    items: ProjectTestCase[];
  }[];
}

/**
 * Build grouped sections based on the selected grouping mode.
 *
 * @param grouping   - The active grouping strategy.
 * @param testCases  - All project test cases to categorize.
 * @param features   - Available feature groups.
 * @param phases     - Available phase groups.
 * @returns An array of grouped sections ready for rendering.
 */
export function buildGroups(
  grouping: GroupingMode,
  testCases: ProjectTestCase[],
  features: Feature[],
  phases: Phase[],
): GroupedSection[] {
  if (grouping === "feature") {
    return buildSingleLevel("feature", features, testCases, (tc) => tc.featureIds || []);
  }
  if (grouping === "phase") {
    return buildSingleLevel("phase", phases, testCases, (tc) => tc.phaseIds || []);
  }
  if (grouping === "feature-phase") {
    return buildTwoLevel(
      "feature", features, (tc) => tc.featureIds || [],
      "phase", phases, (tc) => tc.phaseIds || [],
      testCases,
    );
  }
  // phase-feature
  return buildTwoLevel(
    "phase", phases, (tc) => tc.phaseIds || [],
    "feature", features, (tc) => tc.featureIds || [],
    testCases,
  );
}

/**
 * Group test cases by a single dimension (feature or phase).
 *
 * Items not belonging to any group are collected under "Unassigned".
 *
 * @param type        - The group type label ("feature" or "phase").
 * @param groups      - The list of groups to sort into.
 * @param testCases   - Test cases to distribute.
 * @param getGroupIds - Accessor returning group IDs a test case belongs to.
 * @returns Flat array of grouped sections.
 */
function buildSingleLevel(
  type: "feature" | "phase",
  groups: (Feature | Phase)[],
  testCases: ProjectTestCase[],
  getGroupIds: (tc: ProjectTestCase) => string[],
): GroupedSection[] {
  const sections: GroupedSection[] = groups.map((g) => ({
    key: `${type}:${g.id}`,
    label: g.name,
    groupType: type,
    groupId: g.id,
    items: testCases.filter((tc) => getGroupIds(tc).includes(g.id)),
  }));

  // Collect test cases that don't belong to any group
  const unassigned = testCases.filter((tc) => getGroupIds(tc).length === 0);
  if (unassigned.length > 0) {
    sections.push({
      key: `${type}:unassigned`,
      label: "Unassigned",
      groupType: type,
      groupId: "unassigned",
      items: unassigned,
    });
  }
  return sections;
}

/**
 * Group test cases in a two-level hierarchy (e.g. Feature → Phase).
 *
 * Each outer group contains sub-groups from the inner dimension. Items
 * without an inner group assignment appear under an inner "Unassigned".
 *
 * @param outerType    - The outer dimension type.
 * @param outerGroups  - Outer dimension group list.
 * @param getOuterIds  - Accessor for outer group membership.
 * @param innerType    - The inner dimension type.
 * @param innerGroups  - Inner dimension group list.
 * @param getInnerIds  - Accessor for inner group membership.
 * @param testCases    - Test cases to distribute.
 * @returns Nested array of grouped sections with sub-groups.
 */
function buildTwoLevel(
  outerType: "feature" | "phase",
  outerGroups: (Feature | Phase)[],
  getOuterIds: (tc: ProjectTestCase) => string[],
  innerType: "feature" | "phase",
  innerGroups: (Feature | Phase)[],
  getInnerIds: (tc: ProjectTestCase) => string[],
  testCases: ProjectTestCase[],
): GroupedSection[] {
  const sections = outerGroups.map((outer) => {
    const outerItems = testCases.filter((tc) => getOuterIds(tc).includes(outer.id));
    const subGroups = innerGroups
      .map((inner) => ({
        key: `${innerType}:${inner.id}`,
        label: inner.name,
        groupType: innerType as "feature" | "phase",
        groupId: inner.id,
        items: outerItems.filter((tc) => getInnerIds(tc).includes(inner.id)),
      }))
      .filter((sg) => sg.items.length > 0);

    // Inner items with no inner group → "Unassigned" sub-group
    const noInner = outerItems.filter((tc) => getInnerIds(tc).length === 0);
    if (noInner.length > 0) {
      subGroups.push({
        key: `${innerType}:unassigned`,
        label: "Unassigned",
        groupType: innerType as "feature" | "phase",
        groupId: "unassigned",
        items: noInner,
      });
    }

    return {
      key: `${outerType}:${outer.id}`,
      label: outer.name,
      groupType: outerType,
      groupId: outer.id,
      items: outerItems,
      subGroups,
    };
  });

  // Outer-unassigned bucket
  const unassigned = testCases.filter((tc) => getOuterIds(tc).length === 0);
  if (unassigned.length > 0) {
    sections.push({
      key: `${outerType}:unassigned`,
      label: "Unassigned",
      groupType: outerType,
      groupId: "unassigned",
      items: unassigned,
      subGroups: [],
    });
  }

  return sections;
}
