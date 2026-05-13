/**
 * Permission bitmask constants and role data types for the admin roles page.
 *
 * The bitmask values must match the backend permission constants.
 * Each resource has its own bitmask field, and individual permissions
 * are toggled by XOR-ing the relevant bit.
 */

import type { Role } from "@/types/api";

/** Permission bitmask constants — must stay in sync with the backend. */
export const P = {
  CREATE: 1,
  READ: 2,
  UPDATE: 4,
  DELETE: 8,
  EXPORT: 16,
  RUN: 32,
  GRANT_ACCESS: 64,
  MANAGE: 128,
} as const;

/**
 * Resource groups define which permission bits apply to each resource.
 * Each entry maps to a bitmask field on the `RoleData` interface.
 */
export const RESOURCE_GROUPS = [
  { key: "projectPerms", label: "Projects", bits: ["CREATE", "READ", "UPDATE", "DELETE", "GRANT_ACCESS"] },
  { key: "testcasePerms", label: "Test Cases", bits: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"] },
  { key: "testrunPerms", label: "Test Runs", bits: ["CREATE", "READ"] },
  { key: "userPerms", label: "Users", bits: ["MANAGE"] },
  { key: "importPerms", label: "Import", bits: ["CREATE"] },
  { key: "generatePerms", label: "Generate", bits: ["CREATE"] },
] as const;

/** Shape of a role being edited in the create/edit dialog. */
export interface RoleData {
  id?: string;
  name: string;
  description: string;
  isAdmin: boolean;
  isSystem: boolean;
  projectPerms: number;
  testcasePerms: number;
  testrunPerms: number;
  userPerms: number;
  importPerms: number;
  generatePerms: number;
}

/** Default values for a new role. */
export const emptyRole: RoleData = {
  name: "",
  description: "",
  isAdmin: false,
  isSystem: false,
  projectPerms: 0,
  testcasePerms: 0,
  testrunPerms: 0,
  userPerms: 0,
  importPerms: 0,
  generatePerms: 0,
};

/**
 * Toggle a single permission bit on a resource field via XOR.
 *
 * @param role     - The current role data state.
 * @param resource - The resource bitmask field name (e.g. "projectPerms").
 * @param bit      - The bit value to toggle.
 * @returns A new RoleData with the bit toggled.
 */
export function toggleBit(role: RoleData, resource: string, bit: number): RoleData {
  return { ...role, [resource]: (role[resource as keyof RoleData] as number) ^ bit };
}

/**
 * Check whether a permission bit is set on a resource field.
 *
 * @param role     - The role data to inspect.
 * @param resource - The resource bitmask field name.
 * @param bit      - The bit value to check.
 * @returns `true` if the bit is set.
 */
export function hasBit(role: RoleData, resource: string, bit: number): boolean {
  return ((role[resource as keyof RoleData] as number) & bit) !== 0;
}
