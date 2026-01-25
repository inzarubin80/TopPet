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

RUN npm install

COPY . .

RUN chmod -R +x node_modules/.bin

# Используем .env.production если он есть, иначе переменные из ARG/ENV
RUN npm run build

# Production Stage
FROM nginx:alpine AS production

# Копируем кастомную конфигурацию Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранные файлы (react-scripts собирает в build, а не dist)
COPY --from=build /app/build /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
