# Build Stage
FROM node:lts-alpine AS build

WORKDIR /app

# ARG для возможности переопределения при сборке образа
ARG REACT_APP_API_URL=https://api.top-pet.ru/api
ARG REACT_APP_WS_URL=wss://api.top-pet.ru/api

# ENV для использования в build процессе
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL
ENV NODE_ENV=production

COPY package*.json ./

# Используем --legacy-peer-deps для решения конфликта версий react-helmet-async с React 19
RUN npm install --legacy-peer-deps

COPY . .

RUN chmod -R +x node_modules/.bin

RUN npm run build

# Production Stage: nginx
FROM nginx:alpine AS production

# Удаляем дефолтный конфиг и подключаем наш
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранные файлы из build stage в корень nginx
COPY --from=build /app/build /usr/share/nginx/html

# Открываем порт 3000 (Coolify использует этот порт)
EXPOSE 3000

# Healthcheck для Coolify
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1
