FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    fontconfig \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -f -v

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node . .

ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV PORT=10000

USER node
EXPOSE 10000

CMD ["npm", "start"]
