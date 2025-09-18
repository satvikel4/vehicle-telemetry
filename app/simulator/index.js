// app/simulator/index.js
const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080/ws/telemetry';
const VEHICLE_ID = process.env.VEHICLE_ID || 'veh_007';

const ws = new WebSocket(WS_URL);

let t = 0;
let soc = 0.82;                   // state of charge (0..1)
let lat = 37.3947, lng = -122.1503;
let speed = 0;                    // kph

const rnd = (a, b) => a + Math.random() * (b - a);

ws.on('open', () => {
  console.log(`Simulator connected → ${WS_URL} as ${VEHICLE_ID}`);
  setInterval(() => {
    // Simple driving/thermal model
    const accel = Math.sin(t / 2000) * 0.6 + rnd(-0.2, 0.2);
    speed = Math.max(0, Math.min(120, speed + accel));
    const batteryTempC = 36 + 0.06 * speed + rnd(-0.8, 1.2);
    const motorTempC   = 55 + 0.10 * speed + rnd(-1.0, 1.5);
    soc = Math.max(0, soc - (speed / 1200)); // faster drain at higher speed

    // Drift the position
    const bearing = 0.00003;
    lat += bearing;
    lng += bearing * 0.6;

    // Occasional faults
    const faults = [];
    if (batteryTempC > 50 && Math.random() < 0.1) faults.push('OVERHEAT_WARN');
    if (soc < 0.12 && Math.random() < 0.05) faults.push('LOW_SOC');

    const payload = {
      vehicleId: VEHICLE_ID,
      ts: Date.now(),
      speedKph: Number(speed.toFixed(2)),
      soc: Number(soc.toFixed(4)),
      batteryTempC: Number(batteryTempC.toFixed(2)),
      motorTempC: Number(motorTempC.toFixed(2)),
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      faults,
      meta: { firmware: 'sim-v1.0', tripId: 'trip_' + new Date().toISOString().slice(0, 10) }
    };

    ws.send(JSON.stringify(payload));
    t += 100;
  }, 100); // 10Hz
});

ws.on('close', () => console.log('Simulator connection closed'));
ws.on('error', (e) => console.error('Simulator error:', e.message));