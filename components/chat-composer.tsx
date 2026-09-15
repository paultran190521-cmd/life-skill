"use client";

import { useRef, useState } from "react";
import { Send, UploadCloud } from "lucide-react";

/** Keep frequent typing and paste events outside the application-wide state. */
export function ChatComposer({ busy, onSend, onUpload }: {
  busy: boolean;
  onSend: (content: string) => Promise<boolean>;
  onUpload: (file: File, content: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  async function submit(file?: File) {
    if (inFlight.current || busy || (!file && !draft.trim())) return;
    inFlight.current = true;
    setSending(true);
    try {
      if (await (file ? onUpload(file, draft) : onSend(draft))) setDraft("");
    } finally { inFlight.current = false; setSending(false); }
  }
  return <div className="mt-4 grid gap-2">
    <textarea aria-label="Nội dung phản hồi" disabled={busy || sending} value={draft} onChange={(event) => setDraft(event.target.value)}
      onPaste={(event) => {
        const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
        if (image) { event.preventDefault(); void submit(image); }
      }}
      onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void submit(); } }}
      rows={3} placeholder="Nhập phản hồi, dán ảnh màn hình, hoặc dán link Drive cho tệp trên 10 MB..."
      className="min-w-0 w-full resize-none rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base text-[var(--brand-dark)] outline-none focus:ring-2 focus:ring-cyan-100" />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-black text-cyan-800">
        <UploadCloud size={16} />Tải ảnh/tệp (≤ 10 MB)
        <input disabled={busy || sending} type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" className="hidden"
          onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void submit(file); }} />
      </label>
      <button type="button" disabled={!draft.trim() || busy || sending} onClick={() => void submit()} className="ui-primary-gradient inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white"><Send size={16} />Gửi phản hồi</button>
    </div>
    <p className="text-[11px] font-semibold text-[var(--muted)]">Ảnh dán vào khung sẽ được nén khi cần và tự xóa sau 5 tháng từ ngày gửi. Nội dung tin nhắn và tệp giáo án được giữ lại. Tệp trên 10 MB: upload Drive rồi dán link vào tin nhắn.</p>
  </div>;
}
