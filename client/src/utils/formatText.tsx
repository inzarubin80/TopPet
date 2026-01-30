import React from 'react';

/**
 * Renders text with line breaks preserved: splits by \n or \r\n and inserts <br /> between lines.
 */
export function descriptionWithBreaks(text: string): React.ReactNode {
  const lines = (text || '').split(/\r?\n/);
  return lines.flatMap((line, i, arr) =>
    i === arr.length - 1 ? [line] : [line, <br key={`br-${i}`} />]
  );
}
