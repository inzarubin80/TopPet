# Инструкция по развертыванию в продакшене

## Требования

- Сервер с IP `147.45.141.46` (указан в DNS для `top-pet.ru`)
- Docker и Docker Compose установлены
- Nginx установлен на сервере
- Доступ к серверу по SSH

## Шаги развертывания

### 1. Подготовка сервера

```bash
# Установка Docker (если не установлен)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Клонирование репозитория

```bash
cd /opt
git clone <your-repo-url> toppet
cd toppet
```

### 3. Настройка переменных окружения

Создайте файл `docker/.env.prod`:

```bash
cd docker
cp .env.example .env.prod
nano .env.prod
```

Заполните все необходимые переменные (см. `Server/ENV.md`):

```bash
# Database
POSTGRES_USER=toppet
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=toppet

# Server
ACCESS_TOKEN_SECRET=<strong-random-secret>
REFRESH_TOKEN_SECRET=<strong-random-secret>
STORE_SECRET=<strong-random-secret>

# CORS
CORS_ALLOWED_ORIGINS=https://www.top-pet.ru,https://top-pet.ru

# API URLs
API_ROOT=https://api.top-pet.ru
FRONTEND_URL=https://www.top-pet.ru

# OAuth (если используются)
CLIENT_ID_YANDEX=<your-yandex-client-id>
CLIENT_SECRET_YANDEX=<your-yandex-secret>
# ... и т.д.

# S3 (если используется)
S3_ENDPOINT=<your-s3-endpoint>
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>
S3_BUCKET=<your-bucket>
```

### 4. Установка SSL сертификатов

```bash
# Установка Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Получение сертификатов для доменов
sudo certbot certonly --nginx -d top-pet.ru -d www.top-pet.ru
sudo certbot certonly --nginx -d api.top-pet.ru
```

### 5. Настройка Nginx

```bash
# Копирование конфигурации
sudo cp docker/nginx.prod.conf.example /etc/nginx/sites-available/top-pet.ru
sudo ln -s /etc/nginx/sites-available/top-pet.ru /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

**Важно:** Обновите пути к SSL сертификатам в конфигурации Nginx!

### 6. Запуск контейнеров

```bash
cd docker
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 7. Проверка работы

```bash
# Проверка статуса контейнеров
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Проверка доступности
curl http://localhost:3000  # Frontend
curl http://localhost:8080/api/ping  # Backend API
```

### 8. Настройка автообновления SSL

```bash
# Certbot автоматически настроит автообновление
# Проверить можно командой:
sudo certbot renew --dry-run
```

## Обновление приложения

```bash
cd /opt/toppet/docker
git pull
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Мониторинг

```bash
# Логи всех сервисов
docker-compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f server
docker-compose -f docker-compose.prod.yml logs -f client
docker-compose -f docker-compose.prod.yml logs -f postgres

# Использование ресурсов
docker stats
```

## Резервное копирование базы данных

```bash
# Создание бэкапа
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres toppet > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres toppet < backup_YYYYMMDD_HHMMSS.sql
```

## Устранение неполадок

### Проблема: 503 Service Unavailable

1. Проверьте, что контейнеры запущены:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

2. Проверьте логи:
   ```bash
   docker-compose -f docker-compose.prod.yml logs
   ```

3. Проверьте, что Nginx может достучаться до контейнеров:
   ```bash
   curl http://localhost:3000
   curl http://localhost:8080/api/ping
   ```

### Проблема: SSL сертификат не работает

1. Проверьте, что сертификаты установлены:
   ```bash
   sudo certbot certificates
   ```

2. Проверьте пути в конфигурации Nginx

3. Перезагрузите Nginx:
   ```bash
   sudo systemctl reload nginx
   ```

### Проблема: CORS ошибки

Убедитесь, что в `Server/.env` правильно указаны `CORS_ALLOWED_ORIGINS`:
```bash
CORS_ALLOWED_ORIGINS=https://www.top-pet.ru,https://top-pet.ru
```
