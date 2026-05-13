/**
 * Shared page header bar with title, optional description, and action buttons.
 *
 * @module page-header
 */

"use client";

/** Props for {@link PageHeader}. */
interface PageHeaderProps {
  /** Page title — can be a string or JSX (e.g. with an icon). */
  title: React.ReactNode;
  /** Short subtitle displayed below the title. */
  description?: string;
  /** Action buttons rendered on the right side. */
  actions?: React.ReactNode;
}

/**
 * Renders a horizontal header bar with a title, description, and actions slot.
 *
 * @param props - See {@link PageHeaderProps}.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center gap-4 border-b px-4 py-3">
      <div className="flex-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
