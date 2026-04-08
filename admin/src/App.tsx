import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const FILTERS = ["All clusters", "Electricity", "Water", "Critical only"];
const STATUS_FILTERS = ["All statuses", "Pending", "In Progress", "Resolved"];
const SORT_OPTIONS = ["Urgency", "Impact", "Newest", "Type"];
const STAT_CARDS = [
  { label: "Active outages", note: "Clusters awaiting action", code: "AO", iconBg: "bg-white/20 text-white", accent: "bg-gradient-to-r from-[#fb923c] to-[#f97316]" },
  { label: "People impacted", note: "Estimated residents", code: "PI", iconBg: "bg-white/20 text-white", accent: "bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9]" },
  { label: "Critical watch", note: "Priority ≥ 70", code: "CW", iconBg: "bg-white/20 text-white", accent: "bg-gradient-to-r from-[#f472b6] to-[#ec4899]" },
  { label: "Top severity", note: "Highest priority", code: "TS", iconBg: "bg-white/20 text-white", accent: "bg-gradient-to-r from-[#34d399] to-[#059669]" },
];
const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "bg-[#fff4e6]", color: "text-[#9c4a03]" },
  in_progress: { label: "In progress", bg: "bg-[#e8f0ff]", color: "text-[#143172]" },
  resolved: { label: "Resolved", bg: "bg-[#e6f5ee]", color: "text-[#0d5b3e]" },
};
const QUEUE_PAGE_SIZE = 6;
const MAP_CENTER: [number, number] = [12.9716, 77.5946];

type ClusterStatus = "pending" | "in_progress" | "resolved" | string;
type UtilityType = "electricity" | "water" | string;

type Technician = {
  id: number;
  name: string;
  rating: number;
  specialization: string;
  zone: string;
  eta_minutes?: number;
  estimated_resolution_minutes?: number;
  assignment_note?: string;
};

type TechnicianOption = Technician & { preferred_count?: number };

type ClusterReport = {
  id: number;
  title: string;
  severity: number;
  status: ClusterStatus;
  photo_url?: string | null;
  photo_urls?: string[];
  video_url?: string | null;
  video_urls?: string[];
  availability_status?: string;
  availability_note?: string;
};

type InsightEntry = {
  name: string;
  value: number;
  color: string;
};

type Cluster = {
  id: number;
  utility_type: UtilityType;
  status: ClusterStatus;
  priority_score: number;
  estimated_people: number;
  report_count: number;
  center_latitude: number;
  center_longitude: number;
  eta_minutes?: number;
  estimated_resolution_minutes?: number;
  technician?: Technician;
  technician_options?: TechnicianOption[];
  reports?: ClusterReport[];
  priority_reasons?: string[];
  inline_insights?: InsightEntry[];
  last_update_hours?: number;
  opened_hours?: number;
  heat_radius?: number;
};

type SeverityMeta = {
  label: string;
  pill: string;
  bar: string;
  stroke: string;
  fill: string;
};

const severityMeta = (score: number): SeverityMeta => {
  if (score >= 85) {
    return {
      label: "Critical",
      pill: "bg-[#ffe4e4] text-[#b42318]",
      bar: "bg-[#dc2626]",
      stroke: "#b42318",
      fill: "#fca5a5",
    };
  }
  if (score >= 60) {
    return {
      label: "High",
      pill: "bg-[#fff2d8] text-[#b45309]",
      bar: "bg-[#f97316]",
      stroke: "#d97706",
      fill: "#fed7aa",
    };
  }
  if (score >= 40) {
    return {
      label: "Escalating",
      pill: "bg-[#f4f1ff] text-[#4c1d95]",
      bar: "bg-[#7c3aed]",
      stroke: "#6d28d9",
      fill: "#ddd6fe",
    };
  }
  return {
    label: "Stable",
    pill: "bg-[#e7f8f1] text-[#0f5132]",
    bar: "bg-[#10b981]",
    stroke: "#0f766e",
    fill: "#a7f3d0",
  };
};

const utilityLabel = (utility: UtilityType) => {
  if (utility === "electricity") return "Electricity";
  if (utility === "water") return "Water";
  return utility.charAt(0).toUpperCase() + utility.slice(1);
};

const utilityColor = (utility: UtilityType) => {
  if (utility === "electricity") return "#f97316";
  if (utility === "water") return "#0ea5e9";
  return "#6b7280";
};

function PriorityGauge({ value }: { value: number }) {
  const radius = 34;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <svg width={radius * 2 + stroke} height={radius * 2 + stroke} className="-rotate-90">
        <circle
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          r={radius}
          stroke="#f1e8da"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          r={radius}
          stroke="#dc2626"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs font-semibold text-smoke">Score</p>
        <p className="text-lg font-black text-dusk">{Math.round(value)}%</p>
      </div>
    </div>
  );
}

type FilterGroupProps = {
  label: string;
  options: string[];
  activeValue: string;
  onChange: (value: string) => void;
};

function FilterGroup({ label, options, activeValue, onChange }: FilterGroupProps) {
  return (
    <div className="rounded-3xl border border-[#eadfd1] bg-white/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-smoke">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeValue === option ? "border-dusk bg-dusk text-white" : "border-[#eadfd1] text-smoke hover:bg-sand"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

type QueueCardProps = {
  cluster: Cluster;
  isSelected: boolean;
  onSelect: (cluster: Cluster) => void;
};

function resolveReportPhotos(report: ClusterReport) {
  const rawPhotos = report.photo_urls?.length
    ? report.photo_urls
    : report.photo_url
    ? [report.photo_url]
    : [];

  return rawPhotos.map(normalizeAssetUrl).filter(Boolean);
}

function resolveReportVideos(report: ClusterReport) {
  const rawVideos = report.video_urls?.length
    ? report.video_urls
    : report.video_url
    ? [report.video_url]
    : [];

  return rawVideos.map(normalizeAssetUrl).filter(Boolean);
}

function normalizeAssetUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) {
    return "";
  }

  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    const parsed = new URL(photoUrl, apiOrigin);

    // Force uploaded evidence to load from the dashboard's backend origin.
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}`;
    }

    return parsed.toString();
  } catch {
    return photoUrl;
  }
}

function QueueCard({ cluster, isSelected, onSelect }: QueueCardProps) {
  const severity = severityMeta(cluster.priority_score);
  const statusMeta = STATUS_STYLES[cluster.status] ?? { label: cluster.status, bg: "bg-sand", color: "text-dusk" };
  const priority = Math.round(cluster.priority_score);
  const etaMinutes = cluster.eta_minutes ?? cluster.technician?.eta_minutes ?? 45;
  const resolutionMinutes = cluster.technician?.estimated_resolution_minutes ?? cluster.eta_minutes ?? 90;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(cluster)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(cluster);
        }
      }}
      className={`w-full rounded-[26px] border-2 px-5 py-4 text-left transition ${
        isSelected ? "border-dusk bg-white shadow-xl" : "border-[#f2e7da] bg-white hover:border-dusk/60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-smoke">Cluster #{cluster.id}</p>
          <p className="font-sora text-xl font-black text-dusk">{utilityLabel(cluster.utility_type)} · {cluster.report_count} report{cluster.report_count === 1 ? "" : "s"}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-smoke">Priority</p>
          <p className="font-sora text-3xl font-black text-dusk">{priority}%</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className={`rounded-full px-3 py-1 ${statusMeta.bg} ${statusMeta.color}`}>{statusMeta.label}</span>
        <span className={`rounded-full px-3 py-1 ${severity.pill}`}>{severity.label}</span>
        <span className="rounded-full bg-shell px-3 py-1 text-[#5a4a3f]">{cluster.estimated_people.toLocaleString()} impacted</span>
        {cluster.technician ? (
          <span className="rounded-full bg-sand px-3 py-1 text-smoke">{cluster.technician.name}</span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-smoke">
        <div>
          <p className="uppercase tracking-[0.3em] text-[10px]">ETA</p>
          <p className="mt-1 font-sora text-lg text-dusk">{etaMinutes}m</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.3em] text-[10px]">Status</p>
          <p className="mt-1 font-sora text-lg text-dusk">{statusMeta.label}</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.3em] text-[10px]">Reports</p>
          <p className="mt-1 font-sora text-lg text-dusk">{cluster.report_count}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-smoke">
        <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-[#24539b]">Resolve in ~{resolutionMinutes}m</span>
        {cluster.reports?.some((report) => (report.video_urls?.length ?? 0) > 0 || report.video_url) ? (
          <span className="rounded-full bg-[#fff2d8] px-3 py-1 text-[#9a5b00]">Video evidence available</span>
        ) : null}
      </div>
    </div>
  );
}

type ClusterFocusPanelProps = {
  cluster: Cluster | null;
  onAssign: (cluster: Cluster, technicianId: number) => Promise<void> | void;
  onStatusChange: (clusterId: number, status: ClusterStatus) => Promise<void> | void;
  onZoomToLocation: (latitude: number, longitude: number, options?: { scroll?: boolean }) => void;
};

function ClusterFocusPanel({ cluster, onAssign, onStatusChange, onZoomToLocation }: ClusterFocusPanelProps) {
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<ClusterStatus | "">("");

  if (!cluster) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-[#eadfd1] bg-white/30 p-8 text-center text-sm text-smoke">
        <p className="font-sora text-lg font-bold text-dusk">Select a cluster to open the focus panel</p>
        <p className="mt-2 max-w-sm text-sm">Use the queue or map to pick a cluster. Insights, assignment options, and live signals show here.</p>
      </div>
    );
  }

  const severity = severityMeta(cluster.priority_score);
  const statusMeta = STATUS_STYLES[cluster.status] ?? { label: cluster.status, bg: "bg-sand", color: "text-dusk" };
  const priorityTags = cluster.priority_reasons ?? [];
  const inlineInsights = cluster.inline_insights ?? [];
  const hoursOpen = cluster.opened_hours ?? 0;
  const hoursSinceUpdate = cluster.last_update_hours ?? 0;
  const etaMinutes = cluster.eta_minutes ?? cluster.technician?.eta_minutes ?? 45;
  const resolutionMinutes = cluster.estimated_resolution_minutes ?? cluster.technician?.estimated_resolution_minutes ?? Math.max(45, etaMinutes + 25);
  const isInProgress = cluster.status === "in_progress";
  const isResolved = cluster.status === "resolved";
  const priorityScore = Math.round(cluster.priority_score);
  const resolutionFill = Math.min(100, Math.max(8, (1 - etaMinutes / 240) * 100));

  const assignTech = async (technicianId: number) => {
    if (!cluster) return;
    setAssigningId(technicianId);
    try {
      await Promise.resolve(onAssign(cluster, technicianId));
    } finally {
      setAssigningId(null);
      setShowAssignMenu(false);
    }
  };

  const handleQuickStatus = async (targetStatus: ClusterStatus) => {
    if (!cluster) return;
    setStatusUpdating(targetStatus);
    try {
      await Promise.resolve(onStatusChange(cluster.id, targetStatus));
    } finally {
      setStatusUpdating("");
    }
  };

  const insightRows: InsightEntry[] = inlineInsights.length
    ? inlineInsights
    : [
        { name: "Severity", value: Math.round(cluster.priority_score), color: "#dc2626" },
        { name: "Density", value: Math.min(100, cluster.report_count * 8), color: "#f97316" },
        { name: "Recency", value: Math.max(20, 100 - hoursSinceUpdate * 10), color: "#14b8a6" },
      ];

  return (
    <div className="flex h-full flex-col gap-4">
      <section className="rounded-[28px] border border-[#f0e6d8] bg-white/95 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-smoke">
          <span className={`rounded-full px-3 py-1 ${statusMeta.bg} ${statusMeta.color}`}>{statusMeta.label}</span>
          <span className={`rounded-full px-3 py-1 ${severity.pill}`}>{utilityLabel(cluster.utility_type)}</span>
          <span className="rounded-full bg-sand px-3 py-1 text-[#5a4a3f]">{cluster.estimated_people.toLocaleString()} residents impacted</span>
          <span className="rounded-full bg-[#f3f0ff] px-3 py-1 text-[#4b2fc3]">{cluster.report_count} reports</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[200px]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke">Why highlighted</p>
            <p className="mt-2 font-sora text-3xl font-black text-dusk">Priority {priorityScore}%</p>
            <p className="text-sm text-smoke">Open for {hoursOpen.toFixed(1)}h · last update {hoursSinceUpdate.toFixed(1)}h ago</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <PriorityGauge value={priorityScore} />
            <button
              type="button"
              onClick={() => onZoomToLocation(cluster.center_latitude, cluster.center_longitude, { scroll: true })}
              className="rounded-full border border-[#eadfd1] px-4 py-2 text-sm font-semibold text-dusk transition hover:bg-sand"
            >
              📍 Focus on map
            </button>
          </div>
        </div>
      </section>

      {priorityTags.length ? (
        <section className="rounded-[26px] border border-[#f7efe4] bg-[#fffbf6] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#b8afa5]">Priority signals</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {priorityTags.map((reason) => (
              <span key={reason} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-dusk">
                {reason}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[#f0e6d8] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#b8afa5]">Predicted resolution</p>
            <p className="font-sora text-3xl font-black text-dusk">{resolutionMinutes} min</p>
          </div>
          <span className="text-xs font-semibold text-smoke">ETA {etaMinutes} min · refreshed every 15s</span>
        </div>
        <div className="mt-4 h-3 rounded-full bg-[#f4ede3]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#16a34a] via-[#fbbf24] to-[#ef4444]"
            style={{ width: `${resolutionFill}%` }}
          />
        </div>
        <div className="mt-6 space-y-2">
          {insightRows.map((entry) => (
            <div key={entry.name} className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: entry.color }} />
                <span className="text-sm font-semibold text-dusk">{entry.name}</span>
              </div>
              <div className="flex-1 rounded-full bg-[#f7f1ea]">
                <div className="h-2 rounded-full" style={{ width: `${entry.value}%`, background: entry.color }} />
              </div>
              <span className="w-12 text-right text-sm font-semibold text-smoke">{entry.value}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#e4f0ff] bg-[#f7fbff] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#7b8ba6]">Technician assignment</p>
            <p className="font-sora text-xl font-bold text-dusk">{cluster.technician ? cluster.technician.name : "Awaiting assignment"}</p>
            <p className="text-xs text-smoke">
              {cluster.technician
                ? `${cluster.technician.specialization} · ${cluster.technician.zone} · ${cluster.technician.rating.toFixed(1)}★`
                : "Pick a specialist to dispatch"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
              cluster.technician ? "bg-white text-dusk" : "bg-[#dfe8ff] text-[#1a3d8f]"
            }`}
          >
            {cluster.technician ? cluster.status.replace("_", " ") : "Unassigned"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="relative">
            <button
              type="button"
              disabled={!cluster.technician_options?.length}
              onClick={() => setShowAssignMenu((value) => !value)}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition ${
                !cluster.technician_options?.length ? "bg-[#1f2533]/30" : "bg-[#1f2533] hover:bg-[#12182a]"
              }`}
            >
              {cluster.technician ? "Reassign technician" : "Assign technician"}
            </button>
            {showAssignMenu && (cluster.technician_options?.length ?? 0) ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-[#eadfd1] bg-white p-2 shadow-2xl">
                {(cluster.technician_options ?? []).map((tech) => (
                  <button
                    key={tech.id}
                    type="button"
                    disabled={assigningId === tech.id}
                    onClick={() => assignTech(tech.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${
                      assigningId === tech.id ? "bg-dusk text-white" : "hover:bg-sand"
                    }`}
                  >
                    <div>
                      <p>{tech.name}</p>
                      <p className="text-[11px] font-normal text-smoke">{tech.specialization} · Pref {tech.preferred_count ?? 0}</p>
                    </div>
                    <span>{tech.rating.toFixed(1)}★</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={isInProgress || statusUpdating === "in_progress"}
              onClick={() => handleQuickStatus("in_progress")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                isInProgress ? "bg-[#e8f0ff] text-[#94a8d6]" : "bg-[#e8f0ff] text-[#003f96] hover:bg-[#d6e4ff]"
              }`}
            >
              {statusUpdating === "in_progress" ? "Updating..." : "Mark in progress"}
            </button>
            <button
              type="button"
              disabled={isResolved || statusUpdating === "resolved"}
              onClick={() => handleQuickStatus("resolved")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                isResolved ? "bg-[#e6f5ee] text-[#8bb7a3]" : "bg-[#e6f5ee] text-[#065c38] hover:bg-[#d3efdf]"
              }`}
            >
              {statusUpdating === "resolved" ? "Updating..." : "Mark resolved"}
            </button>
          </div>
        </div>
        {cluster.technician ? (
          <p className="mt-3 text-xs text-smoke">
            ETA {cluster.technician.eta_minutes ?? 45} min
            {cluster.technician.assignment_note ? ` · ${cluster.technician.assignment_note}` : ""}
          </p>
        ) : null}
      </section>

      <section className="flex-1 rounded-[28px] border border-[#f0e6d8] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#b8afa5]">Incoming reports</p>
        <div className="mt-3 space-y-2 overflow-y-auto">
          {(cluster.reports ?? []).slice(0, 4).map((report) => {
            const reportPhotos = resolveReportPhotos(report);
            const reportVideos = resolveReportVideos(report);

            return (
              <div key={report.id} className="rounded-2xl border border-[#f0e6d8] bg-white px-3 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-10 w-1 rounded-full"
                    style={{
                      background:
                        report.severity >= 5
                          ? "#cc1a1a"
                          : report.severity >= 3
                          ? "#f0a400"
                          : utilityColor(cluster.utility_type),
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{report.title}</p>
                    <p className="text-[11px] text-smoke">
                      Severity {report.severity} · {STATUS_STYLES[report.status]?.label ?? report.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onZoomToLocation(cluster.center_latitude, cluster.center_longitude, { scroll: true })}
                    className="rounded-full border border-[#eadfd1] px-3 py-1 text-[11px] font-semibold text-dusk transition hover:bg-sand"
                  >
                    Zoom
                  </button>
                </div>
                {reportPhotos.length || reportVideos.length ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#b8afa5]">Evidence</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {reportPhotos.map((photoUrl, index) => (
                        <a
                          key={`${report.id}-${index}`}
                          href={photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-2xl border border-[#f0e6d8] bg-[#fffaf4]"
                        >
                          <img
                            src={photoUrl}
                            alt={`Report ${report.id} evidence ${index + 1}`}
                            className="h-28 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        </a>
                      ))}
                      {reportVideos.map((videoUrl, index) => (
                        <div
                          key={`${report.id}-video-${index}`}
                          className="overflow-hidden rounded-2xl border border-[#f0e6d8] bg-[#fffaf4]"
                        >
                          <video
                            src={videoUrl}
                            controls
                            preload="metadata"
                            className="h-28 w-full bg-[#1f1410] object-cover"
                          />
                          <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-smoke">
                            <span>Video evidence</span>
                            <a href={videoUrl} target="_blank" rel="noreferrer" className="text-dusk underline underline-offset-2">
                              Open
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type LiveMapProps = {
  clusters: Cluster[];
  selectedClusterId: number | null;
  onSelectCluster: (cluster: Cluster) => void;
  onMapReady: (map: L.Map) => void;
};

type MapReadyBridgeProps = {
  onReady: (map: L.Map) => void;
};

function MapReadyBridge({ onReady }: MapReadyBridgeProps) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
}

function LiveMap({ clusters, selectedClusterId, onSelectCluster, onMapReady }: LiveMapProps) {
  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={11.5}
      scrollWheelZoom={true}
      style={{ height: "420px" }}
      className="w-full"
    >
      <MapReadyBridge onReady={onMapReady} />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {clusters.map((cluster) => {
        const severity = severityMeta(cluster.priority_score);
        const radius = cluster.heat_radius ?? Math.max(400, cluster.estimated_people / 3);
        const selected = cluster.id === selectedClusterId;

        return (
          <Fragment key={cluster.id}>
            <Circle
              center={[cluster.center_latitude, cluster.center_longitude]}
              radius={radius}
              pathOptions={{
                color: severity.stroke,
                fillColor: severity.fill,
                fillOpacity: selected ? 0.25 : 0.12,
                weight: selected ? 3 : 1,
              }}
            />
            <CircleMarker
              center={[cluster.center_latitude, cluster.center_longitude]}
              radius={selected ? 8 : 6}
              pathOptions={{ color: severity.stroke, fillColor: utilityColor(cluster.utility_type), fillOpacity: 1 }}
              eventHandlers={{ click: () => onSelectCluster(cluster) }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{utilityLabel(cluster.utility_type)}</p>
                  <p>Priority {Math.round(cluster.priority_score)}%</p>
                  <p>{cluster.estimated_people.toLocaleString()} residents</p>
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}

export default function UFixrDashboard() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>(FILTERS[0]);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>(STATUS_FILTERS[0]);
  const [sortMode, setSortMode] = useState<string>(SORT_OPTIONS[0]);
  const [tick, setTick] = useState(15);
  const [error, setError] = useState("");
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [queueSearch, setQueueSearch] = useState("");
  const [queuePage, setQueuePage] = useState(0);
  const mapRef = useRef<L.Map | null>(null);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => (value <= 1 ? 15 : value - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadClusters = async () => {
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/admin/clusters`);
      const data = await response.json();
      setClusters(Array.isArray(data.items) ? data.items : []);
      setTick(15);
    } catch (err) {
      console.error(err);
      setError("Could not load clusters. Make sure the backend is running on port 8000.");
    }
  };

  useEffect(() => {
    loadClusters();
    const id = window.setInterval(loadClusters, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedClusterId === null) {
      return;
    }
    if (!clusters.some((cluster) => cluster.id === selectedClusterId)) {
      setSelectedClusterId(null);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    setQueuePage(0);
  }, [activeFilter, activeStatusFilter, sortMode, queueSearch]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const scrollToMap = useCallback(() => {
    mapPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleZoomToLocation = useCallback((latitude: number, longitude: number, options?: { scroll?: boolean }) => {
    if (mapRef.current) {
      mapRef.current.flyTo([latitude, longitude], 16, { duration: 1.5 });
    }
    if (options?.scroll) {
      scrollToMap();
    }
  }, [scrollToMap]);

  const handleSelectCluster = useCallback(
    (cluster: Cluster) => {
      setSelectedClusterId(cluster.id);
      handleZoomToLocation(cluster.center_latitude, cluster.center_longitude);
    },
    [handleZoomToLocation]
  );

  useEffect(() => {
    const handleKeyNav = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedClusterId(null);
        return;
      }

      if (!clusters.length) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const actionable = clusters
          .filter((cluster) => {
            if (activeFilter === "Electricity" && cluster.utility_type !== "electricity") return false;
            if (activeFilter === "Water" && cluster.utility_type !== "water") return false;
            if (activeFilter === "Critical only" && cluster.priority_score < 70) return false;
            if (activeStatusFilter === "Pending" && cluster.status !== "pending") return false;
            if (activeStatusFilter === "In Progress" && cluster.status !== "in_progress") return false;
            if (activeStatusFilter === "Resolved" && cluster.status !== "resolved") return false;
            return true;
          })
          .sort((a, b) => {
            if (sortMode === "Urgency") return b.priority_score - a.priority_score;
            if (sortMode === "Impact") return b.estimated_people - a.estimated_people;
            if (sortMode === "Newest") return b.id - a.id;
            if (sortMode === "Type") return a.utility_type.localeCompare(b.utility_type);
            return 0;
          });

        if (!actionable.length) {
          return;
        }

        event.preventDefault();
        const index = actionable.findIndex((cluster) => cluster.id === selectedClusterId);
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = index === -1 ? (event.key === "ArrowDown" ? 0 : actionable.length - 1) : Math.min(actionable.length - 1, Math.max(0, index + delta));
        handleSelectCluster(actionable[nextIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [clusters, activeFilter, activeStatusFilter, sortMode, selectedClusterId, handleSelectCluster]);

  const handleStatusChange = async (id: number, newStatus: ClusterStatus) => {
    try {
      await fetch(`${API_BASE_URL}/admin/clusters/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await loadClusters();
    } catch (err) {
      console.error(err);
      setError("Status update failed.");
    }
  };

  const handleAssign = async (cluster: Cluster, technicianId: number) => {
    try {
      const preferred = cluster.technician_options?.find((item) => item.id === technicianId)?.preferred_count ?? 0;
      const eta = Math.max(25, 55 - preferred * 5 - Math.round(cluster.priority_score / 10));
      const resolution = Math.max(45, eta + 25 + Math.round(cluster.report_count * 6));
      await fetch(`${API_BASE_URL}/admin/clusters/${cluster.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technician_id: technicianId, eta_minutes: eta, resolution_minutes: resolution, note: preferred > 0 ? `Preferred by ${preferred} reporting user(s)` : "Assigned by dispatcher" }),
      });
      await loadClusters();
    } catch (err) {
      console.error(err);
      setError("Technician assignment failed.");
    }
  };

  const filtered = useMemo(() => {
    const matches = clusters.filter((cluster) => {
      const matchesUtility =
        activeFilter === "All clusters" ||
        (activeFilter === "Electricity" && cluster.utility_type === "electricity") ||
        (activeFilter === "Water" && cluster.utility_type === "water") ||
        (activeFilter === "Critical only" && cluster.priority_score >= 70);

      const matchesStatus =
        activeStatusFilter === "All statuses" ||
        (activeStatusFilter === "Pending" && cluster.status === "pending") ||
        (activeStatusFilter === "In Progress" && cluster.status === "in_progress") ||
        (activeStatusFilter === "Resolved" && cluster.status === "resolved");

      return matchesUtility && matchesStatus;
    });

    return matches.sort((a, b) => {
      if (sortMode === "Urgency") return b.priority_score - a.priority_score;
      if (sortMode === "Impact") return b.estimated_people - a.estimated_people;
      if (sortMode === "Newest") return b.id - a.id;
      if (sortMode === "Type") return a.utility_type.localeCompare(b.utility_type);
      return 0;
    });
  }, [clusters, activeFilter, activeStatusFilter, sortMode]);

  const selectedCluster = useMemo(() => clusters.find((cluster) => cluster.id === selectedClusterId) ?? null, [clusters, selectedClusterId]);
  const searchableQueue = useMemo(() => {
    const term = queueSearch.trim().toLowerCase();
    if (!term) {
      return filtered;
    }
    return filtered.filter((cluster) => {
      if (`${cluster.id}`.includes(term)) return true;
      if (utilityLabel(cluster.utility_type).toLowerCase().includes(term)) return true;
      if (cluster.status.toLowerCase().includes(term)) return true;
      if (cluster.technician && cluster.technician.name.toLowerCase().includes(term)) return true;
      if (cluster.technician && cluster.technician.zone.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [filtered, queueSearch]);
  const totalQueuePages = Math.max(1, Math.ceil(searchableQueue.length / QUEUE_PAGE_SIZE));
  const safePage = Math.min(queuePage, totalQueuePages - 1);
  const pageStart = safePage * QUEUE_PAGE_SIZE;
  const visibleQueue = searchableQueue.slice(pageStart, pageStart + QUEUE_PAGE_SIZE);
  const showingStart = searchableQueue.length ? pageStart + 1 : 0;
  const showingEnd = Math.min(searchableQueue.length, pageStart + visibleQueue.length);
  const handlePageNav = (direction: "prev" | "next") => {
    setQueuePage((prev) => {
      if (direction === "prev") {
        return Math.max(0, prev - 1);
      }
      return Math.min(Math.max(0, totalQueuePages - 1), prev + 1);
    });
  };

  const activeCount = clusters.filter((cluster) => cluster.status !== "resolved").length;
  const totalAffected = clusters.reduce((sum, cluster) => sum + cluster.estimated_people, 0);
  const criticalCount = clusters.filter((cluster) => cluster.priority_score >= 70 && cluster.status !== "resolved").length;
  const topPriority = Math.max(0, ...clusters.map((cluster) => Math.round(cluster.priority_score)));
  const visibleMapClusters = filtered.length > 0 ? filtered : clusters;
  const mapVideoCount = visibleMapClusters.reduce(
    (sum, cluster) => sum + (cluster.reports ?? []).reduce((reportSum, report) => reportSum + resolveReportVideos(report).length, 0),
    0
  );
  const assignedCount = visibleMapClusters.filter((cluster) => Boolean(cluster.technician)).length;
  const statValues = [activeCount, totalAffected.toLocaleString(), criticalCount, `${topPriority}%`];

  return (
    <div className="relative min-h-screen bg-sand px-4 py-6 text-dusk sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <section className="rounded-[36px] bg-gradient-to-br from-[#1d120b] via-[#26160f] to-[#4f2d1a] p-6 text-white shadow-glow lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img src="/ufixr-logo.png" alt="UFixr" className="h-14 w-14 rounded-2xl bg-white/10 p-2" />
              <div>
                <p className="font-sora text-2xl font-black tracking-tight">UFixr Command</p>
                <p className="text-sm text-white/80">Real-time city utility intelligence for Bengaluru</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold">
                <span className="live-dot" />
                LIVE · refresh in {tick}s
              </div>
              <button type="button" onClick={loadClusters} className="rounded-full bg-white px-5 py-2 text-sm font-bold text-[#1f1410] shadow-lg">
                Refresh data
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STAT_CARDS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
                className="rounded-3xl border border-white/15 bg-white/10 p-5"
              >
                <div className={`h-11 w-11 rounded-2xl ${stat.iconBg} flex items-center justify-center text-xs font-black`}>{stat.code}</div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{stat.label}</p>
                <p className="mt-2 font-sora text-4xl font-black">{statValues[index]}</p>
                <p className="mt-1 text-sm text-white/70">{stat.note}</p>
                <div className={`mt-4 h-1 rounded-full ${stat.accent}`} />
              </motion.div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <FilterGroup label="Utility focus" options={FILTERS} activeValue={activeFilter} onChange={setActiveFilter} />
            <FilterGroup label="Status lens" options={STATUS_FILTERS} activeValue={activeStatusFilter} onChange={setActiveStatusFilter} />
          </div>
        </section>

        <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div ref={mapPanelRef} className="glass-panel flex h-full flex-col rounded-[32px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-smoke">Metro live stack</p>
                <h2 className="font-sora text-2xl font-black text-dusk">Bengaluru outage map</h2>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-smoke">
                {[
                  { color: "bg-ember", label: "Electricity" },
                  { color: "bg-tide", label: "Water" },
                  { color: "bg-[#cc1a1a]", label: "Critical" },
                ].map((legend) => (
                  <span key={legend.label} className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${legend.color}`} />
                    {legend.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-[28px] border border-[#eadfd1] bg-white">
              <LiveMap
                clusters={visibleMapClusters}
                onMapReady={handleMapReady}
                selectedClusterId={selectedClusterId}
                onSelectCluster={handleSelectCluster}
              />
            </div>
            <div className="mt-4 grid flex-1 gap-4 md:grid-cols-3">
              <div className="rounded-[26px] border border-[#eadfd1] bg-white/90 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-smoke">Map coverage</p>
                <p className="mt-3 font-sora text-3xl font-black text-dusk">{visibleMapClusters.length}</p>
                <p className="mt-2 text-sm text-smoke">Clusters currently visible in this map view and filter set.</p>
              </div>
              <div className="rounded-[26px] border border-[#eadfd1] bg-white/90 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-smoke">Assigned crews</p>
                <p className="mt-3 font-sora text-3xl font-black text-dusk">{assignedCount}</p>
                <p className="mt-2 text-sm text-smoke">Active clusters that already have a technician dispatched.</p>
              </div>
              <div className="rounded-[26px] border border-[#eadfd1] bg-white/90 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-smoke">Rich evidence</p>
                <p className="mt-3 font-sora text-3xl font-black text-dusk">{mapVideoCount}</p>
                <p className="mt-2 text-sm text-smoke">Video clips available for faster visual diagnosis by dispatch.</p>
              </div>
            </div>
          </div>

          <div className="glass-panel flex min-h-0 flex-col rounded-[32px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-sora text-2xl font-black text-dusk">Issue workspace</h2>
                <p className="text-sm text-smoke">Monitoring {filtered.length} active clusters</p>
              </div>
              <span className="rounded-full bg-shell px-4 py-1 text-sm font-semibold text-dusk">Total {clusters.length}</span>
            </div>
            <div className="mt-4 flex w-full flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="flex items-center gap-2 rounded-2xl border border-[#eadfd1] bg-white px-3 py-2 text-sm text-smoke" htmlFor="queue-search">
                  <span>🔎</span>
                  <input
                    id="queue-search"
                    type="text"
                    value={queueSearch}
                    onChange={(event) => setQueueSearch(event.target.value)}
                    placeholder="Search by cluster, status, technician"
                    className="h-8 flex-1 bg-transparent text-sm text-dusk placeholder:text-smoke focus:outline-none"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSortMode(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      sortMode === option
                        ? "border-transparent bg-dusk text-white shadow"
                        : "border-[#eadfd1] text-smoke hover:bg-sand"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            {error ? <div className="mt-4 rounded-2xl bg-[#ffeaea] px-4 py-3 text-sm font-semibold text-[#8a0e0e]">{error}</div> : null}
            <div className="mt-4 flex flex-1 flex-col gap-4 lg:min-h-[520px]">
              <div className="flex min-h-[260px] flex-col rounded-[32px] border border-[#f2e7da] bg-white/90 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-smoke">
                  <div>
                    <span>
                      Showing {showingStart}-{showingEnd} of {searchableQueue.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePageNav("prev")}
                      disabled={safePage === 0}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        safePage === 0 ? "border-[#eadfd1] text-[#c5bfb6]" : "border-[#eadfd1] text-dusk hover:bg-sand"
                      }`}
                    >
                      Prev
                    </button>
                    <span className="text-[11px] font-semibold text-dusk">
                      Page {safePage + 1} / {totalQueuePages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageNav("next")}
                      disabled={safePage >= totalQueuePages - 1}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        safePage >= totalQueuePages - 1 ? "border-[#eadfd1] text-[#c5bfb6]" : "border-[#eadfd1] text-dusk hover:bg-sand"
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="queue-scroll mt-3 flex-1 space-y-2 overflow-y-auto">
                  {visibleQueue.length ? (
                    visibleQueue.map((cluster) => (
                      <QueueCard key={cluster.id} cluster={cluster} isSelected={cluster.id === selectedClusterId} onSelect={handleSelectCluster} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#eadfd1] bg-white/70 px-4 py-8 text-center text-sm text-smoke">
                      No clusters match the current search or filters.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-sora text-2xl font-black text-dusk">Cluster focus</h2>
              <p className="text-sm text-smoke">
                {selectedCluster ? `Tracking cluster #${selectedCluster.id}` : "Select a cluster from the queue or map"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedClusterId(null)}
              disabled={!selectedCluster}
              className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
                selectedCluster ? "border border-dusk text-dusk hover:bg-sand" : "border border-[#eadfd1] text-[#c5bfb6]"
              }`}
            >
              Clear
            </button>
          </div>
          <div className="mt-4">
            <ClusterFocusPanel
              cluster={selectedCluster}
              onStatusChange={handleStatusChange}
              onAssign={handleAssign}
              onZoomToLocation={handleZoomToLocation}
            />
          </div>
        </section>
      </div>
    </div>
  );
}




