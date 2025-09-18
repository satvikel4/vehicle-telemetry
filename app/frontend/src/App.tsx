import { useEffect, useMemo, useRef, useState } from "react";

type Telemetry = {
  vehicleId: string;
  ts: number;
  speedKph: number;
  soc: number;
  batteryTempC: number;
  motorTempC: number;
  lat: number;
  lng: number;
  faults?: string[];
};

export default function App() {
  const [last, setLast] = useState<Telemetry | null>(null);
  const [packets, setPackets] = useState(0);
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "error">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  const streamUrl = useMemo(
    () => import.meta.env.VITE_WS_STREAM || "ws://localhost:8080/ws/stream",
    []
  );

  useEffect(() => {
    const ws = new WebSocket(streamUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      try {
        const data: Telemetry = JSON.parse(ev.data);
        setLast(data);
        setPackets((p) => p + 1);
      } catch {
        // ignore bad frames
      }
    };

    return () => ws.close();
  }, [streamUrl]);

  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8, color: "#fff" }}>Vehicle Telemetry</h1>
      <p style={{ marginTop: 0, color: "#fff" }}>
        WS status: <strong>{status}</strong> • Packets: <strong>{packets}</strong>
      </p>

      {last ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(240px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          <Card label="Vehicle" value={last.vehicleId} />
          <Card label="Timestamp" value={new Date(last.ts).toLocaleTimeString()} />
          <Card label="Speed (kph)" value={last.speedKph.toFixed(1)} />
          <Card label="State of Charge" value={`${(last.soc * 100).toFixed(1)} %`} />
          <Card label="Battery Temp (°C)" value={last.batteryTempC.toFixed(1)} />
          <Card label="Motor Temp (°C)" value={last.motorTempC.toFixed(1)} />
          <Card label="Latitude" value={last.lat.toFixed(6)} />
          <Card label="Longitude" value={last.lng.toFixed(6)} />
          <Card label="Faults" value={(last.faults || []).join(", ") || "none"} wide />
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>Waiting for data…</div>
      )}
    </div>
  );
}

function Card({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        gridColumn: wide ? "1 / -1" : "auto",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#111827" }}>{value}</div>
    </div>
  );
}

