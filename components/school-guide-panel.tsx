"use client";

import {
  BookOpenText,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  Route,
  Search,
  School2,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { SchoolGuideEntry, SchoolGuideResponse } from "@/lib/school-guide-types";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi");
}

export function SchoolGuidePanel() {
  const [guide, setGuide] = useState<SchoolGuideResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadGuide() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/school-guide", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Không tải được thông tin trường.");
      }
      setGuide(payload as SchoolGuideResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được thông tin trường.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGuide();
  }, []);

  const filteredSchools = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    if (!normalizedQuery) {
      return guide?.schools ?? [];
    }
    return (guide?.schools ?? []).filter((school) =>
      normalizeSearch(
        [school.name, school.schoolType, school.address, school.teachingGrades].join(" "),
      ).includes(normalizedQuery),
    );
  }, [guide, query]);

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-cyan-200 bg-white shadow-[0_20px_50px_rgba(15,73,92,0.09)]">
        <div className="bg-gradient-to-br from-cyan-50 via-white to-emerald-50 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-black text-white">
                <School2 size={15} aria-hidden="true" />
                Cẩm nang giảng dạy
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[var(--brand-dark)] sm:text-3xl">
                Thông tin trường đối tác
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Xem nhanh đặc điểm học sinh, lưu ý phối hợp và người phụ trách trước khi đến trường.
                Nút chỉ đường sử dụng đúng liên kết bản đồ do METTASOUL cung cấp.
              </p>
              {guide ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-white px-3 py-1.5 text-[var(--brand-dark)] shadow-sm">
                    Năm học {guide.schoolYear}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
                    {guide.schools.length} trường
                  </span>
                </div>
              ) : null}
            </div>

            <label className="relative block w-full xl:max-w-md">
              <span className="sr-only">Tìm trường</span>
              <Search
                size={19}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên, địa chỉ hoặc khối..."
                className="h-12 w-full rounded-2xl border border-cyan-200 bg-white pl-12 pr-4 text-sm font-bold text-[var(--brand-dark)] shadow-sm outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-[28px] border border-cyan-200 bg-white">
          <div className="flex items-center gap-3 text-sm font-black text-[var(--brand-dark)]">
            <LoaderCircle className="animate-spin" size={22} aria-hidden="true" />
            Đang tải cẩm nang trường...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-[28px] border border-rose-200 bg-white p-7 text-center shadow-sm">
          <p className="font-black text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadGuide()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-black text-white"
          >
            <RefreshCcw size={17} aria-hidden="true" />
            Tải lại
          </button>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="rounded-[28px] border border-cyan-200 bg-white p-10 text-center">
          <Search className="mx-auto text-cyan-600" size={30} aria-hidden="true" />
          <p className="mt-3 font-black text-[var(--brand-dark)]">Không tìm thấy trường phù hợp</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Thử tìm bằng tên trường, địa chỉ hoặc khối lớp.</p>
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {filteredSchools.map((school, index) => (
            <SchoolGuideCard key={school.id} school={school} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

function SchoolGuideCard({ school, index }: { school: SchoolGuideEntry; index: number }) {
  const accents = [
    "from-cyan-500 to-teal-500",
    "from-emerald-500 to-teal-500",
    "from-indigo-500 to-cyan-500",
    "from-amber-500 to-orange-500",
  ];

  return (
    <article className="overflow-hidden rounded-[26px] border border-cyan-200 bg-white shadow-[0_14px_36px_rgba(15,73,92,0.08)]">
      <div className={`h-1.5 bg-gradient-to-r ${accents[index % accents.length]}`} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">{school.schoolType}</p>
            <h3 className="mt-1 text-xl font-black text-[var(--brand-dark)]">{school.name}</h3>
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold leading-5 text-slate-600">
              <MapPin className="mt-0.5 shrink-0 text-rose-500" size={17} aria-hidden="true" />
              <span>{school.address}</span>
            </p>
          </div>
          <a
            href={school.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/15 transition hover:-translate-y-0.5 hover:bg-[var(--brand-dark)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
            aria-label={`Chỉ đường đến ${school.schoolType} ${school.name}`}
          >
            <Route size={18} aria-hidden="true" />
            Chỉ đường
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <InfoChip icon={GraduationCap} label="Giảng dạy" value={school.teachingGrades} />
          <InfoChip icon={MapPin} label="Từ METTASOUL" value={school.distanceFromMettasoul} />
          <InfoChip icon={Users} label="Hợp tác" value={`${school.partnershipYears.toString().padStart(2, "0")} năm`} />
        </div>

        <div className="relative mt-5 aspect-[16/7] overflow-hidden rounded-2xl border border-cyan-100 bg-cyan-50">
          <Image
            src={school.imageUrl}
            alt={`Hình ảnh học sinh tại ${school.schoolType} ${school.name}`}
            fill
            unoptimized
            sizes="(min-width: 1280px) 44vw, 92vw"
            className="object-cover"
          />
        </div>

        <details className="group mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 open:bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-black text-[var(--brand-dark)] marker:content-none">
            <span className="inline-flex items-center gap-2">
              <BookOpenText size={18} className="text-cyan-700" aria-hidden="true" />
              Xem thông tin trước khi giảng dạy
            </span>
            <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-cyan-100 px-4 py-4 text-sm leading-6">
            <GuideSection title="Lưu ý phối hợp" body={school.coordinationNote} tone="amber" />
            <GuideSection title="Đặc điểm học sinh" body={school.studentProfile} tone="cyan" />
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ban Giám hiệu</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {school.leaders.map((leader) => (
                  <div key={`${leader.role}-${leader.name}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <Image
                      src={leader.imageUrl}
                      alt={leader.name}
                      width={52}
                      height={52}
                      unoptimized
                      className="h-[52px] w-[52px] shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{leader.role}</p>
                      <p className="mt-0.5 font-bold text-[var(--brand-dark)]">{leader.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">
        <Icon size={14} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[var(--brand-dark)]">{value}</p>
    </div>
  );
}

function GuideSection({ title, body, tone }: { title: string; body: string; tone: "amber" | "cyan" }) {
  const toneClass = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : "border-cyan-200 bg-cyan-50 text-cyan-950";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-wide">{title}</p>
      <p className="mt-1 font-semibold">{body}</p>
    </div>
  );
}
