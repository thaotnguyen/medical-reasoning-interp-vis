"use client";

export function KeyboardHints() {
  const hints = [
    { keys: "1-7", action: "Label" },
    { keys: "\u2191\u2193", action: "Navigate" },
    { keys: "0 / \u232b", action: "Clear" },
    { keys: "Tab", action: "Next unlabeled" },
    { keys: "\u21e7Tab", action: "Prev unlabeled" },
    { keys: "?", action: "Help" },
    { keys: "[ ]", action: "Prev/next case" },
  ];

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground shrink-0">
      {hints.map((h) => (
        <span key={h.keys} className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[9px]">
            {h.keys}
          </kbd>
          {h.action}
        </span>
      ))}
    </div>
  );
}
