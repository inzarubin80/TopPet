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

# Production Stage
FROM node:lts-alpine AS production

WORKDIR /app

# Устанавливаем serve для раздачи статических файлов
RUN npm install -g serve

# Копируем собранные файлы из build stage
COPY --from=build /app/build ./build

# Открываем порт 3000
EXPOSE 3000

# Запускаем serve с настройками для SPA
# -s: запускать в single-page application mode (все запросы на index.html)
# -l: порт для прослушивания
# --no-clipboard: не пытаться копировать URL в буфер обмена
CMD ["serve", "-s", "build", "-l", "3000", "--no-clipboard"]
