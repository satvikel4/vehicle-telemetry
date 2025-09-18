FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Dev server is fine for local; we can switch to a static build later
EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0"]
