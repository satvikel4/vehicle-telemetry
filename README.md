🚗 Real-Time Vehicle Telemetry & Control System

A full-stack platform that simulates, ingests, and visualizes live vehicle telemetry in real time. It’s built to explore scalable system design for data pipelines, real-time streaming, and predictive monitoring — the same kinds of challenges faced in robotics, IoT fleets, and autonomous vehicles.

Features

Vehicle Simulator – generates realistic telemetry (speed, SoC, temperatures, GPS, fault codes) at 10 Hz over WebSockets
Gateway/API – Node.js + Express service with WebSocket ingestion, MongoDB storage, Redis pub/sub fan-out, and REST endpoints
Real-Time Streaming – frontend clients subscribe to /ws/stream and receive live updates instantly
Database Layer – MongoDB for raw telemetry & latest state snapshots; Redis for fast publish/subscribe fan-out
Extensible Architecture – designed to add anomaly detection (PyTorch FastAPI service) and command round-trip control
Deployment Ready – Docker Compose stack including gateway, simulator, frontend, MongoDB, and Redis

Tech Stack

Backend: Node.js, Express, WebSockets, MongoDB, Redis, Zod
Frontend: React + TypeScript (Vite)
Infrastructure: Docker & Docker Compose
Future Work: ML anomaly detection, Prometheus/Grafana monitoring, 3D visualization (Three.js)

Motivation

This project grew out of my passion for building real-time, full-stack systems that connect simulation, distributed data pipelines, and user interfaces. I wanted to see how telemetry from vehicles or robots could be captured, processed, and visualized in a way that’s both scalable and practical. It became a playground for experimenting with real-world engineering challenges like streaming data, anomaly detection, and control loops — all without needing physical hardware.
