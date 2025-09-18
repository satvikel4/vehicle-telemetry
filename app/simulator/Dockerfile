FROM node:20-alpine
WORKDIR /sim
COPY package*.json ./
RUN npm install
COPY . .
ENV WS_URL=ws://gateway:8080/ws/telemetry
ENV VEHICLE_ID=veh_007
CMD ["npm","start"]
