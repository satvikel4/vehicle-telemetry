import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { MongoClient, Collection } from 'mongodb';
import { z } from 'zod';
import Redis from 'ioredis';

/** ---------- Config ---------- */
const PORT = Number(process.env.PORT || 8080);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

/** ---------- App / HTTP ---------- */
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

/** ---------- WebSockets ---------- */
/**
 * /ws/telemetry — simulators push JSON packets (ingest)
 * /ws/stream    — frontends subscribe to live packets (fan-out)
 */
const wssIngest = new WebSocketServer({ noServer: true, path: '/ws/telemetry' });
const wssStream = new WebSocketServer({ noServer: true, path: '/ws/stream' });

/** In-process fan-out so dev keeps working without Redis */
const streamClients = new Set<WebSocket>();

/** ---------- Redis (pub only for now, with resilience) ---------- */
const redisPub = new Redis(REDIS_URI, {
  retryStrategy: (times) => Math.min(times * 200, 2000), // backoff to 2s
  maxRetriesPerRequest: null, // keep retrying
});
redisPub.on('error', (err) => console.warn('[redisPub:error]', err?.message));
redisPub.on('end', () => console.warn('[redisPub:end] connection closed; retrying…'));

/** ---------- MongoDB ---------- */
let mongo!: MongoClient;
let rawColl!: Collection;
let latestColl!: Collection;
let cmdColl!: Collection;
let alertColl!: Collection;

async function initMongo() {
  mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db('telemetry');
  rawColl = db.collection('telemetry_raw');
  latestColl = db.collection('vehicle_state_latest');
  cmdColl = db.collection('commands_log');
  alertColl = db.collection('alerts');

  await rawColl.createIndex({ vehicleId: 1, ts: -1 });
  await latestColl.createIndex({ vehicleId: 1 }, { unique: true });
}

/** ---------- Validation ---------- */
const Telemetry = z.object({
  vehicleId: z.string(),
  ts: z.number(),
  speedKph: z.number(),
  soc: z.number(),
  batteryTempC: z.number(),
  motorTempC: z.number(),
  lat: z.number(),
  lng: z.number(),
  faults: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

/** ---------- HTTP Routes ---------- */
app.get('/healthz', (_req, res) => res.send('ok'));

app.get('/api/state/:vehicleId', async (req, res) => {
  try {
    const doc = await latestColl.findOne({ vehicleId: req.params.vehicleId });
    res.json(doc || {});
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'db error' });
  }
});

app.post('/api/command', async (req, res) => {
  const { vehicleId, command, params } = req.body || {};
  if (!vehicleId || !command) return res.status(400).json({ error: 'bad request' });

  const ts = Date.now();
  try {
    await cmdColl.insertOne({ vehicleId, command, params, ts, status: 'sent' });
  } catch (e) {
    console.warn('[command:db]', (e as any)?.message);
  }

  // Publish to per-vehicle channel; swallow failures for resilience
  redisPub.publish(`cmd:${vehicleId}`, JSON.stringify({ vehicleId, command, params, ts }))
    .catch((e) => console.warn('[redis publish cmd failed]', e?.message));

  res.json({ ok: true });
});

/** ---------- WS Upgrade Routing ---------- */
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (url.startsWith('/ws/telemetry')) {
    wssIngest.handleUpgrade(req, socket, head, (ws) => wssIngest.emit('connection', ws, req));
  } else if (url.startsWith('/ws/stream')) {
    wssStream.handleUpgrade(req, socket, head, (ws) => wssStream.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

/** ---------- Ingest Pipeline ---------- */
wssIngest.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const data = Telemetry.parse(JSON.parse(msg.toString()));

      // Store raw (fire-and-forget is fine in dev)
      rawColl.insertOne(data).catch((e) => console.warn('[rawColl.insertOne]', e?.message));

      // Upsert latest snapshot
      try {
        await latestColl.updateOne(
          { vehicleId: data.vehicleId },
          { $set: { last: data, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (e) {
        console.warn('[latestColl.updateOne]', (e as any)?.message);
      }

      // Publish to Redis (non-fatal if it fails)
      const payload = JSON.stringify(data);
      redisPub.publish('telemetry', payload).catch((e) => {
        console.warn('[redis publish telemetry failed]', e?.message);
      });

      // In-process fan-out so UIs get updates even without Redis
      for (const client of streamClients) {
        if (client.readyState === client.OPEN) client.send(payload);
      }
    } catch (e) {
      // Invalid telemetry or JSON parse — drop silently in dev
      // console.warn('[ingest:bad-packet]', (e as any)?.message);
    }
  });
});

/** ---------- Stream Fan-out (local) ---------- */
/**
 * For now, stream directly from the in-process broadcast above.
 * (We can add a Redis subscriber here later for multi-instance scaling.)
 */
wssStream.on('connection', (ws) => {
  streamClients.add(ws);
  ws.on('close', () => streamClients.delete(ws));
});

/** ---------- Boot ---------- */
initMongo()
  .then(() => {
    server.listen(PORT, () => console.log(`gateway up on ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to init Mongo:', err?.message || err);
    process.exit(1);
  });
