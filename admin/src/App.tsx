import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Report = {
  id: number;
  title: string;
  status: string;
  severity: number;
  photo_url?: string;
};

type Cluster = {
  id: number;
  utility_type: "electricity" | "water";
  status: string;
  center_latitude: number;
  center_longitude: number;
  report_count: number;
  estimated_people: number;
  priority_score: number;
  reports: Report[];
};

const API_BASE_URL = "http://127.0.0.1:8000";
const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];
const BRAND_LOGO_URI = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22wrenchGrad%22%20x1%3D%220%22%20y1%3D%221%22%20x2%3D%221%22%20y2%3D%220%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%230b1f68%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%231c89e8%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22dropGrad%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2320c9f3%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%230b57c6%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22boltGrad%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23ff8a00%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23ffd400%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20d%3D%22M39%2084c-6-6-6-16%200-22l28-28c-7-11-6-26%204-36%2011-11%2028-12%2040-4l-20%2024%204%2012h13l15-18c6%2012%205%2028-5%2038-10%2010-25%2011-36%205L54%2093c-6%206-16%206-22%200z%22%20fill%3D%22url(%23wrenchGrad)%22%2F%3E%3Ccircle%20cx%3D%2238%22%20cy%3D%2282%22%20r%3D%227%22%20fill%3D%22%230a276d%22%2F%3E%3Cpath%20d%3D%22M95%2027c12%2015%2025%2034%2025%2050%200%2018-14%2032-32%2032-11%200-21-5-27-13l18-23-20%201%2028-47c3-4%206-4%208%200z%22%20fill%3D%22url(%23dropGrad)%22%2F%3E%3Cpath%20d%3D%22M73%2044%2054%2073h18l-7%2029%2030-39H79l17-29z%22%20fill%3D%22url(%23boltGrad)%22%20stroke%3D%22%23ff6a00%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E`;

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#ffeaea", color: "#8a0e0e", label: "Pending" },
  acknowledged: { bg: "#fff8e6", color: "#8a5c00", label: "Acknowledged" },
  in_progress: { bg: "#e8f0ff", color: "#003f96", label: "In Progress" },
  resolved: { bg: "#e6f5ee", color: "#065c38", label: "Resolved" },
};

const STAT_CARDS = [
  { icon: "bolt", label: "Active Clusters", accent: "#ff4d1c", iconBg: "#fff0ec", note: "Incidents needing response" },
  { icon: "people", label: "People Impacted", accent: "#0058cc", iconBg: "#e8f0ff", note: "Estimated residents affected" },
  { icon: "alert", label: "Critical Queue", accent: "#cc1a1a", iconBg: "#ffeaea", note: "Scoring 70%+ priority" },
  { icon: "chart", label: "Top Priority", accent: "#0a7a50", iconBg: "#e6f5ee", note: "Highest urgency on board" },
] as const;

const priorityColor = (priority: number, type: Cluster["utility_type"]) => {
  if (priority >= 75) return "#cc1a1a";
  if (priority >= 50) return "#e8960a";
  return type === "water" ? "#0058cc" : "#ff4d1c";
};

const ringOffset = (priority: number) => {
  const circumference = 2 * Math.PI * 22;
  return circumference - (priority / 100) * circumference;
};

const utilityLabel = (type: Cluster["utility_type"]) => (type === "water" ? "Water" : "Electricity");
const utilityIcon = (type: Cluster["utility_type"]) => (type === "water" ? "??" : "?");

const clusterContext = (cluster: Cluster) => {
  if (cluster.reports[0]?.title) {
    return cluster.reports[0].title;
  }
  return `${utilityLabel(cluster.utility_type)} issue cluster`;
};

function IconBadge({ kind }: { kind: (typeof STAT_CARDS)[number]["icon"] }) {
  const styles: Record<(typeof STAT_CARDS)[number]["icon"], { icon: string; color: string; size?: number }> = {
    bolt: { icon: "?", color: "#ff4d1c", size: 18 },
    people: { icon: "??", color: "#0058cc", size: 16 },
    alert: { icon: "??", color: "#cc1a1a", size: 16 },
    chart: { icon: "??", color: "#0a7a50", size: 16 },
  };
  const entry = styles[kind];
  return <span style={{ color: entry.color, fontSize: entry.size ?? 16, lineHeight: 1 }}>{entry.icon}</span>;
}

function UtilityPill({ type }: { type: Cluster["utility_type"] }) {
  const isWater = type === "water";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: isWater ? "#e8f0ff" : "#fff0ec",
        color: isWater ? "#003f96" : "#b83600",
        letterSpacing: "0.02em",
      }}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>{utilityIcon(type)}</span>
      {utilityLabel(type)}
    </span>
  );
}

function PriorityRing({ value, type }: { value: number; type: Cluster["utility_type"] }) {
  const color = priorityColor(value, type);
  const circumference = 2 * Math.PI * 22;

  return (
    <div style={{ width: 54, height: 54, position: "relative", flexShrink: 0 }}>
      <svg width="54" height="54" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="27" cy="27" r="22" fill="none" stroke="#ede5d4" strokeWidth="4" />
        <circle
          cx="27"
          cy="27"
          r="22"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={ringOffset(value)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Sora, sans-serif",
          fontSize: 12,
          fontWeight: 800,
          color,
          letterSpacing: "-0.04em",
        }}
      >
        {value}%
      </div>
    </div>
  );
}

function ClusterCard({ cluster, onStatusChange }: { cluster: Cluster; onStatusChange: (id: number, status: string) => void }) {
  const [expanded, setExpanded] = useState(cluster.id === 3);
  const st = STATUS_STYLES[cluster.status] ?? STATUS_STYLES.pending;
  const summary = clusterContext(cluster);

  return (
    <div
      style={{
        border: "1px solid",
        borderColor: expanded ? "rgba(26,20,16,0.14)" : "rgba(26,20,16,0.08)",
        borderRadius: 18,
        background: expanded ? "#fff" : "#faf7f2",
        overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = "0 8px 24px rgba(26,20,16,0.07)";
        event.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{ padding: "14px 14px 10px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start", cursor: "pointer" }}
        onClick={() => setExpanded((value) => !value)}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <UtilityPill type={cluster.utility_type} />
            <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", background: st.bg, color: st.color }}>
              {st.label}
            </span>
          </div>
          <div style={{ fontFamily: "Sora, sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
            Cluster #{cluster.id} with {cluster.report_count} {cluster.report_count === 1 ? "report" : "reports"}
          </div>
          <div style={{ fontSize: 12, color: "#7a6e66", fontWeight: 400 }}>
            Estimated impact: {cluster.estimated_people.toLocaleString()} people / {summary}
          </div>
        </div>
        <PriorityRing value={Math.round(cluster.priority_score)} type={cluster.utility_type} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: "1px solid rgba(26,20,16,0.08)" }}>
        {[
          { label: "Reports", value: cluster.report_count },
          { label: "Affected", value: cluster.estimated_people.toLocaleString() },
          { label: "Utility", value: cluster.utility_type === "water" ? "Water" : "Electricity" },
        ].map((metric, index) => (
          <div key={metric.label} style={{ padding: "10px 14px", borderRight: index < 2 ? "1px solid rgba(26,20,16,0.08)" : "none" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#b8afa5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{metric.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "Sora, sans-serif", letterSpacing: "-0.02em" }}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, padding: "10px 14px 12px" }}>
        {[
          { label: "Acknowledge", bg: "#fff8e6", color: "#7a4e00", status: "acknowledged" },
          { label: "In Progress", bg: "#e8f0ff", color: "#003f96", status: "in_progress" },
          { label: "Resolve", bg: "#e6f5ee", color: "#065c38", status: "resolved" },
        ].map((button) => (
          <button
            key={button.status}
            onClick={(event) => {
              event.stopPropagation();
              onStatusChange(cluster.id, button.status);
            }}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "9px 8px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Manrope, sans-serif",
              letterSpacing: "0.01em",
              background: button.bg,
              color: button.color,
            }}
          >
            {button.label}
          </button>
        ))}
      </div>

      {expanded && cluster.reports.length > 0 ? (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#b8afa5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Incoming reports</div>
          {cluster.reports.map((report) => (
            <div key={report.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "#f5f0e8", border: "1px solid rgba(26,20,16,0.08)" }}>
              <div
                style={{
                  width: 4,
                  alignSelf: "stretch",
                  minHeight: 36,
                  borderRadius: 2,
                  background: report.severity >= 5 ? "#cc1a1a" : report.severity >= 3 ? "#e8960a" : cluster.utility_type === "water" ? "#0058cc" : "#ff4d1c",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{report.title}</div>
                <div style={{ fontSize: 11, color: "#7a6e66", fontWeight: 400 }}>
                  Severity {report.severity} / {(STATUS_STYLES[report.status]?.label ?? report.status).replace("_", " ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LiveMap({ clusters }: { clusters: Cluster[] }) {
  return (
    <MapContainer center={BENGALURU_CENTER} zoom={11} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {clusters.map((cluster) => {
        const color = cluster.utility_type === "water" ? "#0058cc" : "#ff4d1c";
        const radius = Math.max(180, cluster.report_count * 70);
        return (
          <Circle
            key={cluster.id}
            center={[cluster.center_latitude, cluster.center_longitude]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: cluster.status === "resolved" ? 0.08 : 0.2,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "Manrope, sans-serif", minWidth: 180 }}>
                <strong>Cluster #{cluster.id}</strong>
                <div>{utilityIcon(cluster.utility_type)} {utilityLabel(cluster.utility_type)}</div>
                <div>Status: {(STATUS_STYLES[cluster.status]?.label ?? cluster.status).replace("_", " ")}</div>
                <div>Priority: {Math.round(cluster.priority_score)}%</div>
                <div>Affected: {cluster.estimated_people.toLocaleString()}</div>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}

export default function UFixrDashboard() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [activeFilter, setActiveFilter] = useState("All clusters");
  const [sortMode, setSortMode] = useState("Urgency");
  const [tick, setTick] = useState(15);
  const [error, setError] = useState("");

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

  const handleStatusChange = async (id: number, newStatus: string) => {
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

  const filters = ["All clusters", "Electricity", "Water", "Critical only"];
  const sorts = ["Urgency", "Newest", "Impact", "Type"];

  const filtered = useMemo(() => {
    const next = clusters.filter((cluster) => {
      if (activeFilter === "Electricity") return cluster.utility_type === "electricity";
      if (activeFilter === "Water") return cluster.utility_type === "water";
      if (activeFilter === "Critical only") return cluster.priority_score >= 70;
      return true;
    });

    return next.sort((a, b) => {
      if (sortMode === "Urgency") return b.priority_score - a.priority_score;
      if (sortMode === "Impact") return b.estimated_people - a.estimated_people;
      if (sortMode === "Newest") return b.id - a.id;
      if (sortMode === "Type") return a.utility_type.localeCompare(b.utility_type);
      return 0;
    });
  }, [clusters, activeFilter, sortMode]);

  const totalAffected = clusters.reduce((sum, cluster) => sum + cluster.estimated_people, 0);
  const criticalCount = clusters.filter((cluster) => cluster.priority_score >= 70).length;
  const topPriority = Math.max(...clusters.map((cluster) => Math.round(cluster.priority_score)), 0);

  const statValues = [clusters.length, totalAffected.toLocaleString(), criticalCount, `${topPriority}%`];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f0e8; }
        .ufixr-shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; padding: 20px; gap: 20px; background: #f5f0e8; font-family: 'Manrope', sans-serif; }
        .leaflet-container { width: 100%; height: 100%; font-family: 'Manrope', sans-serif; }
        .leaflet-control-zoom a { color: #1a1410; }
        .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4d1c; animation: pulse-live 1.8s ease-in-out infinite; }
        @keyframes pulse-live { 0%,100% { box-shadow: 0 0 0 0 rgba(255,77,28,0.6); } 50% { box-shadow: 0 0 0 5px rgba(255,77,28,0); } }
        .queue-list::-webkit-scrollbar { width: 4px; }
        .queue-list::-webkit-scrollbar-thumb { background: #ede5d4; border-radius: 2px; }
        @media (max-width: 1100px) { .body-grid { grid-template-columns: 1fr !important; } .stats-row { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 700px) { .ufixr-shell { padding: 12px; gap: 12px; } .stats-row { grid-template-columns: 1fr 1fr !important; } .topbar-filters-wrap { display: none !important; } }
      `}</style>

      <div className="ufixr-shell">
        <header style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 32, background: "#fff", border: "1px solid rgba(26,20,16,0.08)", borderRadius: 24, padding: "14px 28px", boxShadow: "0 2px 24px rgba(26,20,16,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/ufixr-logo.png" alt="UFixr logo" style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: "-0.04em" }}>UFixr</div>
              <div style={{ fontSize: 12, color: "#7a6e66", fontWeight: 400, letterSpacing: "0.04em" }}>Dispatch Intelligence</div>
            </div>
          </div>

          <div className="topbar-filters-wrap" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                style={{
                  border: "1px solid",
                  borderColor: activeFilter === filter ? "#1a1410" : "rgba(26,20,16,0.14)",
                  borderRadius: 999,
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: activeFilter === filter ? "#1a1410" : "transparent",
                  color: activeFilter === filter ? "#fff" : "#3d3530",
                  cursor: "pointer",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                {filter}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "#fff0ec", border: "1px solid rgba(255,77,28,0.18)", fontSize: 12, fontWeight: 700, color: "#ff4d1c", letterSpacing: "0.04em" }}>
              <span className="live-dot" />
              LIVE {tick}s
            </div>
            <button onClick={loadClusters} style={{ border: "1px solid rgba(26,20,16,0.14)", borderRadius: 999, padding: "8px 18px", background: "#1a1410", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
              Refresh
            </button>
          </div>
        </header>

        <div className="body-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 20, minHeight: 0 }}>
            <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {STAT_CARDS.map((stat, index) => (
                <div key={stat.label} style={{ background: "#fff", border: "1px solid rgba(26,20,16,0.08)", borderRadius: 24, padding: "22px 22px 18px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: "0 0 24px 24px", background: stat.accent }} />
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>
                    <IconBadge kind={stat.icon} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#7a6e66", letterSpacing: "0.04em", marginBottom: 6 }}>{stat.label}</div>
                  <div style={{ fontFamily: "Sora, sans-serif", fontSize: 36, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1, marginBottom: 6 }}>{statValues[index]}</div>
                  <div style={{ fontSize: 12, color: "#7a6e66", fontWeight: 400 }}>{stat.note}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid rgba(26,20,16,0.08)", borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid rgba(26,20,16,0.08)", flexShrink: 0 }}>
                <span style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Bengaluru outage map</span>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {[["#ff4d1c", "Electricity"], ["#0058cc", "Water"], ["#cc1a1a", "Critical"]].map(([color, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#3d3530" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color as string, display: "inline-block" }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 420, position: "relative" }}>
                <LiveMap clusters={filtered.length > 0 ? filtered : clusters} />
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid rgba(26,20,16,0.08)", borderRadius: 24, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div style={{ padding: "22px 22px 14px", borderBottom: "1px solid rgba(26,20,16,0.08)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.04em" }}>Priority queue</h2>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff0ec", color: "#ff4d1c", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{filtered.length}</span>
              </div>
              <p style={{ fontSize: 12, color: "#7a6e66", fontWeight: 400, marginBottom: 12 }}>Sorted by urgency score / auto-refreshes every 15 s</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {sorts.map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setSortMode(sort)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: "1px solid",
                      borderColor: sortMode === sort ? "#1a1410" : "rgba(26,20,16,0.08)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "Manrope, sans-serif",
                      background: sortMode === sort ? "#1a1410" : "transparent",
                      color: sortMode === sort ? "#fff" : "#7a6e66",
                    }}
                  >
                    {sort}
                  </button>
                ))}
              </div>
            </div>

            {error ? <div style={{ margin: "12px 14px 0", color: "#8a0e0e", background: "#ffeaea", padding: "10px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{error}</div> : null}

            <div className="queue-list" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((cluster) => (
                <ClusterCard key={cluster.id} cluster={cluster} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}



