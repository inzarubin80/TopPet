# Build Stage
FROM node:lts-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN chmod -R +x node_modules/.bin

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
