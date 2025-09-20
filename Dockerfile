# Dockerfile
FROM node:18-alpine
WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy app
COPY server.js ./

ENV NODE_ENV=production
ENV OPENPHONE_BASE_URL=https://api.openphone.com
# OPENPHONE_API_KEY will be provided at runtime

CMD ["node", "server.js"]
