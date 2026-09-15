"use client";

import { useRef, useState, type MutableRefObject } from "react";
import { ExternalLink } from "lucide-react";

/** Drafts survive pagination/menu changes; typing only renders this small form. */
export function LessonPlanLinkForm({ draftKey, drafts, busy, onSave }: {
  draftKey: string;
  drafts: MutableRefObject<Record<string, string>>;
  busy: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(() => drafts.current[draftKey] || "");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  async function save() {
    if (pending.current || busy) return;
    pending.current = true;
    setSaving(true);
    try {
      if (await onSave(value)) {
        delete drafts.current[draftKey];
        setValue("");
      }
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
      <input
        aria-label="Link giáo án"
        value={value}
        disabled={busy || saving}
        onChange={(event) => {
          const next = event.target.value;
          drafts.current[draftKey] = next;
          setValue(next);
        }}
        placeholder="Dán link PPT/PPTX từ Google Drive nếu file nặng hơn 10MB (mở quyền xem cho admin)"
        className="min-w-0 w-full rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-base font-semibold text-[var(--brand-dark)] shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 sm:text-sm"
      />
      <button type="button" onClick={() => void save()} disabled={busy || saving}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-50">
        <ExternalLink size={15} />
        Lưu link
      </button>
    </div>
  );
}
