import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { MongoClient, Collection } from 'mongodb';
import { z } from 'zod';
import Redis from 'ioredis';

const PORT = Number(process.env.PORT || 8080);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

// Two WS endpoints:
// 1) /ws/telemetry — simulators push JSON packets here (ingest)
// 2) /ws/stream    — frontend subscribes to live packets here (fan-out)
const wssIngest = new WebSocketServer({ noServer: true, path: '/ws/telemetry' });
const wssStream = new WebSocketServer({ noServer: true, path: '/ws/stream' });

const redisPub = new Redis(REDIS_URI);

// zod schema to validate incoming telemetry
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

let mongo!: MongoClient;
let rawColl!: Collection;
let latestColl!: Collection;
let cmdColl!: Collection;
let alertColl!: Collection;

// connect to Mongo and prep collections/indexes
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

// simple health endpoint
app.get('/healthz', (_req, res) => res.send('ok'));

// latest snapshot for a vehicle
app.get('/api/state/:vehicleId', async (req, res) => {
  const doc = await latestColl.findOne({ vehicleId: req.params.vehicleId });
  res.json(doc || {});
});

// send a command (we’ll wire round-trip in a later step)
app.post('/api/command', async (req, res) => {
  const { vehicleId, command, params } = req.body || {};
  if (!vehicleId || !command) return res.status(400).json({ error: 'bad request' });
  const ts = Date.now();

  await cmdColl.insertOne({ vehicleId, command, params, ts, status: 'sent' });
  // publish to a per-vehicle channel for a command WS to consume later
  await redisPub.publish(`cmd:${vehicleId}`, JSON.stringify({ vehicleId, command, params, ts }));

  res.json({ ok: true });
});

// Handle protocol upgrade for both WS endpoints
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

// Ingest pipeline: validate -> store raw -> upsert latest -> publish to Redis "telemetry"
wssIngest.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const data = Telemetry.parse(JSON.parse(msg.toString()));

      // store raw (fire-and-forget is ok here)
      rawColl.insertOne(data).catch(() => {});

      // upsert latest snapshot
      await latestColl.updateOne(
        { vehicleId: data.vehicleId },
        { $set: { last: data, updatedAt: new Date() } },
        { upsert: true }
      );

      // publish to a single channel for all subscribers
      await redisPub.publish('telemetry', JSON.stringify(data));
    } catch {
      // invalid packets are ignored
    }
  });
});

// Fan-out pipeline: each connected UI gets Redis telemetry messages
wssStream.on('connection', (ws) => {
  const sub = new Redis(REDIS_URI);
  sub.subscribe('telemetry').then(() => {});
  sub.on('message', (_ch, payload) => {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  });
  ws.on('close', () => sub.disconnect());
});

initMongo().then(() => {
  server.listen(PORT, () => console.log(`gateway up on ${PORT}`));
}).catch((err) => {
  console.error('Failed to init Mongo:', err);
  process.exit(1);
});
