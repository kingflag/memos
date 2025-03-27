# Build frontend dist.
FROM node:20-alpine AS frontend
WORKDIR /frontend-build

COPY . .

WORKDIR /frontend-build/web

RUN npm install -g pnpm
RUN pnpm i --frozen-lockfile
RUN pnpm build

# Build backend exec file.
FROM golang:1.24-alpine AS backend
WORKDIR /backend-build

# Set GOPROXY to better fetch dependencies in restricted network environments
ENV GOPROXY=https://goproxy.cn,direct

COPY . .
COPY --from=frontend /frontend-build/web/dist /backend-build/server/router/frontend/dist

RUN go build -o memos ./bin/memos/main.go

# Make workspace with above generated files.
FROM alpine:latest AS monolithic
WORKDIR /usr/local/memos

RUN apk add --no-cache tzdata
ENV TZ="UTC"

COPY --from=backend /backend-build/memos /usr/local/memos/
COPY entrypoint.sh /usr/local/memos/

EXPOSE 5230

# Directory to store the data, which can be referenced as the mounting point.
RUN mkdir -p /var/opt/memos
VOLUME /var/opt/memos

ENV MEMOS_MODE="prod"
ENV MEMOS_PORT="5230"

ENTRYPOINT ["./entrypoint.sh", "./memos"]
