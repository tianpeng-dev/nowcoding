'use client';

import { useState } from 'react';

type CopyLinkButtonProps = {
  value: string;
};

export default function CopyLinkButton({ value }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button className="copy-button" onClick={copyLink} type="button">
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
