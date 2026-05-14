/**
 * Shared page header bar with automatic breadcrumbs, title, and action buttons.
 *
 * @module page-header
 */

"use client";

import { Breadcrumbs } from "./breadcrumb";

/** Props for {@link PageHeader}. */
export interface PageHeaderProps {
  /** Page title — can be a string or JSX. */
  title: React.ReactNode;
  /** Optional icon rendered before the title. */
  icon?: React.ReactNode;
  /** Action buttons rendered on the right side. */
  actions?: React.ReactNode;
}

/**
 * Renders a horizontal header bar with automatic breadcrumbs, a title, and actions slot.
 *
 * @param props - See {@link PageHeaderProps}.
 */
export function PageHeader({ title, icon, actions }: PageHeaderProps) {
  return (
    <header className="border-b px-4 py-3">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
