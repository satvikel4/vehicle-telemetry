# 🚗 Real-Time Vehicle Telemetry & Control System  

This project is a **full-stack platform** that simulates, ingests, and visualizes live vehicle telemetry in real time. It demonstrates scalable system design for data pipelines, real-time streaming, and predictive monitoring — the same kinds of challenges faced in autonomous vehicles, robotics, and IoT fleets.  

## 🔹 Features  
- **Vehicle Simulator**: Generates realistic telemetry (speed, SoC, temperatures, GPS, fault codes) at 10 Hz over WebSockets.  
- **Gateway/API**: Node.js + Express service with WebSocket ingestion, MongoDB storage, Redis pub/sub fan-out, and REST endpoints.  
- **Real-Time Streaming**: Frontend clients subscribe to `/ws/stream` and receive live updates instantly.  
- **Database Layer**: MongoDB for raw telemetry & latest state snapshots; Redis for fast publish/subscribe fan-out.  
- **Extensible Architecture**: Designed to add anomaly detection (PyTorch FastAPI microservice) and control round-trip (send commands to simulators).  
- **Deployment Ready**: Docker Compose stack including gateway, simulator, frontend, MongoDB, and Redis.  

## 🔹 Tech Stack  
- **Backend**: Node.js, Express, WebSockets, MongoDB, Redis, Zod (validation)  
- **Frontend**: React + TypeScript (Vite) with live telemetry dashboard  
- **Infrastructure**: Docker & Docker Compose  
- **Future Work**: ML service (FastAPI + PyTorch) for anomaly detection, Prometheus/Grafana monitoring, 3D visualization (Three.js)  

## 🔹 Motivation  
This project grew out of my passion for building **real-time, full-stack systems** that combine software engineering, distributed data pipelines, and simulation. I wanted to explore how telemetry from vehicles or robots could be captured, processed, and visualized in a way that feels both scalable and practical. It’s a playground for experimenting with real-world engineering problems: streaming data, anomaly detection, and control loops — all without needing physical hardware.  
