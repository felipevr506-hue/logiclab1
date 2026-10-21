"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, X } from "lucide-react";
import { GLOSSARY } from "@/lib/glossary";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function GlossaryPopover({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const normalized = normalize(term);
  const entry = GLOSSARY.find((candidate) => {
    const values = [candidate.term, ...(candidate.aliases ?? [])].map(
      normalize,
    );
    return values.some(
      (value) =>
        value === normalized ||
        value.startsWith(normalized.slice(0, 5)) ||
        normalized.startsWith(value.slice(0, 5)),
    );
  });
  if (!entry) return <span className="concept-label">{term}</span>;

  return (
    <span className="concept-label glossary-popover">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {term}
      </button>
      {open && (
        <span className="glossary-popover-card" role="dialog">
          <button
            type="button"
            aria-label="Fechar explicação"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
          <BookOpen />
          <b>{entry.term}</b>
          <p>{entry.definition}</p>
          <code>{entry.example}</code>
          <Link href={`/glossario#${entry.id}`}>
            Ver mais <ArrowRight />
          </Link>
        </span>
      )}
    </span>
  );
}
