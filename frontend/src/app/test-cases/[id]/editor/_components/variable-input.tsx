/**
 * Input field with variable reference support.
 *
 * Variables are stored in the raw value as `@{variableName}`. The input
 * renders as a contenteditable div where variables appear as inline
 * badges, making it clear where a variable starts and ends.
 *
 * Typing `@` opens a dropdown of available variables. Pressing
 * Backspace into a variable badge deletes the entire `@{varName}` token.
 */

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  placeholder?: string;
  className?: string;
}

/** Parse a string into segments of plain text and variable references. */
function parseSegments(value: string): Array<{ type: "text"; value: string } | { type: "var"; name: string }> {
  const segments: Array<{ type: "text"; value: string } | { type: "var"; name: string }> = [];
  const regex = /@\{([a-zA-Z0-9_]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: value.slice(lastIndex, match.index) });
    }
    segments.push({ type: "var", name: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < value.length) {
    segments.push({ type: "text", value: value.slice(lastIndex) });
  }
  return segments;
}

/** Build DOM nodes for the contenteditable from a raw value string. */
function buildDOM(rawValue: string): DocumentFragment {
  const segs = parseSegments(rawValue);
  const frag = document.createDocumentFragment();
  segs.forEach((seg) => {
    if (seg.type === "text") {
      frag.appendChild(document.createTextNode(seg.value));
    } else {
      const badge = document.createElement("span");
      badge.contentEditable = "false";
      badge.dataset.var = `@{${seg.name}}`;
      badge.className = "inline-flex items-center rounded bg-violet-100 text-violet-800 border border-violet-300 px-0.5 mx-0.5 text-sm font-mono font-medium select-none align-baseline";
      badge.textContent = `@${seg.name}`;
      frag.appendChild(badge);
    }
  });
  return frag;
}

/** Extract raw string value from contenteditable DOM. */
function extractRawValue(el: HTMLElement): string {
  let raw = "";
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      raw += child.textContent || "";
    } else if (child instanceof HTMLElement && child.dataset.var) {
      raw += child.dataset.var;
    }
  }
  return raw;
}

/** Place the cursor at a character offset within the contenteditable. */
function setCursorAtOffset(el: HTMLElement, targetOffset: number) {
  let remaining = targetOffset;
  const sel = window.getSelection();
  if (!sel) return;

  const children = Array.from(el.childNodes);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType === Node.TEXT_NODE) {
      const len = (child.textContent || "").length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(child, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else if (child instanceof HTMLElement && child.dataset.var) {
      const len = child.dataset.var.length;
      if (remaining <= len) {
        const range = document.createRange();
        // Place cursor after badge
        if (i + 1 < children.length && children[i + 1].nodeType === Node.TEXT_NODE) {
          range.setStart(children[i + 1], 0);
        } else {
          range.setStartAfter(child);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
  }

  // Fallback: end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Get cursor offset in terms of raw string from the contenteditable. */
function getCursorRawOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);

  let offset = 0;
  for (const child of Array.from(el.childNodes)) {
    if (child === range.startContainer) {
      return offset + range.startOffset;
    }
    if (child.contains(range.startContainer)) {
      // Cursor is inside a text node that is a child
      if (child.nodeType === Node.TEXT_NODE) {
        return offset + range.startOffset;
      }
      // Should not happen for badges (contentEditable=false)
      return offset + (child instanceof HTMLElement && child.dataset.var ? child.dataset.var.length : 0);
    }
    if (child.nodeType === Node.TEXT_NODE) {
      offset += (child.textContent || "").length;
    } else if (child instanceof HTMLElement && child.dataset.var) {
      offset += child.dataset.var.length;
    }
  }
  return offset;
}

export function VariableInput({ value, onChange, variables, placeholder, className }: VariableInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [atTriggerIndex, setAtTriggerIndex] = useState<number | null>(null);
  const internalUpdate = useRef(false);
  const lastValueRef = useRef(value);

  // Sync DOM from value prop — only when value changes externally
  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      lastValueRef.current = value;
      return;
    }
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;

    const el = editRef.current;
    if (!el) return;
    el.innerHTML = "";
    el.appendChild(buildDOM(value));
  }, [value]);

  // Initial render
  useEffect(() => {
    const el = editRef.current;
    if (!el) return;
    el.innerHTML = "";
    el.appendChild(buildDOM(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    const el = editRef.current;
    if (!el) return;

    const raw = extractRawValue(el);
    const cursorOff = getCursorRawOffset(el);

    // Detect @ trigger
    if (cursorOff > 0 && raw[cursorOff - 1] === "@") {
      setAtTriggerIndex(cursorOff - 1);
      setDropdownFilter("");
      setShowDropdown(variables.length > 0);
    } else if (atTriggerIndex !== null) {
      const afterAt = raw.slice(atTriggerIndex + 1, cursorOff);
      if (/^[a-zA-Z0-9_]*$/.test(afterAt)) {
        setDropdownFilter(afterAt);
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
        setAtTriggerIndex(null);
      }
    }

    internalUpdate.current = true;
    lastValueRef.current = raw;
    onChange(raw);
  }, [onChange, variables.length, atTriggerIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      setAtTriggerIndex(null);
      return;
    }

    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return;

      const el = editRef.current!;
      const container = range.startContainer;
      const offset = range.startOffset;
      let prevNode: Node | null = null;

      if (container === el) {
        prevNode = el.childNodes[offset - 1] || null;
      } else if (container.nodeType === Node.TEXT_NODE && offset === 0) {
        prevNode = container.previousSibling;
      }

      if (prevNode instanceof HTMLElement && prevNode.dataset.var) {
        e.preventDefault();
        prevNode.remove();
        internalUpdate.current = true;
        const raw = extractRawValue(el);
        lastValueRef.current = raw;
        onChange(raw);
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
    }
  }, [onChange]);

  const selectVariable = useCallback((varName: string) => {
    if (atTriggerIndex === null || !editRef.current) return;
    const el = editRef.current;
    const raw = extractRawValue(el);
    const cursorOff = getCursorRawOffset(el);

    // Replace the "@" + any filter text with "@{varName}"
    const before = raw.slice(0, atTriggerIndex);
    const after = raw.slice(cursorOff);
    const newVal = before + "@{" + varName + "}" + after;
    const newCursorPos = before.length + 2 + varName.length + 1; // after @{varName}

    // Rebuild DOM
    el.innerHTML = "";
    el.appendChild(buildDOM(newVal));
    setCursorAtOffset(el, newCursorPos);

    internalUpdate.current = true;
    lastValueRef.current = newVal;
    onChange(newVal);
    setShowDropdown(false);
    setAtTriggerIndex(null);
  }, [atTriggerIndex, onChange]);

  const filteredVars = variables.filter((v) =>
    v.toLowerCase().startsWith(dropdownFilter.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setAtTriggerIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Contenteditable div with inline badges */}
      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => { setShowDropdown(false); setAtTriggerIndex(null); }, 150)}
        data-placeholder={placeholder}
        className={cn(
          "rounded-md border border-input bg-transparent px-2 py-1.5 text-sm font-mono min-h-9 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring whitespace-pre-wrap break-all",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
          className
        )}
      />

      {/* Variable autocomplete dropdown */}
      {showDropdown && filteredVars.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {filteredVars.map((varName) => (
            <button
              key={varName}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-accent cursor-pointer"
              onMouseDown={(e) => { e.preventDefault(); selectVariable(varName); }}
            >
              @{varName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
