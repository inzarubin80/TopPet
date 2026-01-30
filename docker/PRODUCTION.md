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

# Превью ссылок в соцсетях (og/twitter) — обязательно для работы /contests/... и / на api.top-pet.ru
BASE_URL=https://top-pet.ru
# Путь к index.html внутри контейнера сервера. В docker-compose монтируется client/build в /app/static.
SPA_INDEX_PATH=/app/static/index.html

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

Для работы превью в соцсетях бэкенду нужен собранный `client/build/index.html`. Сначала соберите клиент, затем запустите compose:

```bash
cd /opt/toppet/client
npm ci --legacy-peer-deps
npm run build
cd ../docker
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

### 8. Превью ссылок в соцсетях (og/twitter)

Чтобы при публикации ссылки на конкурс или участника в Telegram/WhatsApp/VK показывалось превью (заголовок, описание, картинка):

1. **Nginx** уже настроен: запросы к `/contests/:id` и `/contests/:id/participants/:pid` проксируются на бэкенд (внешний nginx — см. `nginx.prod.conf.example`; внутри контейнера клиента — в `client/nginx.conf` на сервис `server`).

2. **Бэкенд:** в окружении сервера заданы `BASE_URL` (например `https://top-pet.ru`) и `SPA_INDEX_PATH` (в docker-compose монтируется `../client/build` в `/app/static`, путь `/app/static/index.html`). При первом запуске убедитесь, что каталог `client/build` существует (соберите клиент до `up` или используйте шаг 6 выше).

3. **Проверка:** отправьте ссылку на конкурс в Telegram или откройте [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — в ответе должны быть теги `og:title`, `og:image` и т.д.

### 9. Настройка автообновления SSL

```bash
# Certbot автоматически настроит автообновление
# Проверить можно командой:
sudo certbot renew --dry-run
```

## Обновление приложения

После обновления кода клиента пересоберите `client/build` (для превью в соцсетях бэкенд читает оттуда `index.html`):

```bash
cd /opt/toppet
git pull
cd client && npm run build
cd ../docker
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

### Проблема: превью участника/конкурса на api.top-pet.ru не открывается (не отвечает)

URL вида `https://api.top-pet.ru/contests/{id}/participants/{pid}` должен отдавать HTML с og/twitter meta. Если запрос не отвечает, таймаут или 404:

1. **Прокси перед API**  
   Nginx (или другой прокси) для **api.top-pet.ru** должен проксировать **все** пути на Go, а не только `/api/`. В `nginx.prod.conf.example` для api.top-pet.ru указано `location / { proxy_pass http://localhost:8080; }` — запросы к `/contests/...` и к `/` должны уходить на бэкенд. Если у вас отдельная конфигурация (Coolify, Ingress и т.п.), добавьте правило: **GET /** и **GET /contests/** проксировать на тот же бэкенд, что и `/api/`.

2. **Переменные окружения бэкенда**  
   В окружении сервера (контейнера) должны быть заданы:
   - `BASE_URL` (например `https://top-pet.ru`)
   - `SPA_INDEX_PATH` (в docker-compose по умолчанию `/app/static/index.html`)  
   Если `SPA_INDEX_PATH` пустой, бэкенд отдаёт 404 на `/contests/...` и `/`.

3. **Файл index.html**  
   Бэкенд читает `index.html` по пути `SPA_INDEX_PATH`. В docker-compose монтируется `../client/build:/app/static:ro`. Убедитесь, что перед запуском выполнен `npm run build` в клиенте и на хосте есть `client/build/index.html`. Иначе бэкенд вернёт 500 при обращении к превью.

4. **Проверка с сервера**  
   ```bash
   # Ответ 200 и HTML с og:title в теле
   curl -s -o /dev/null -w "%{http_code}" "https://api.top-pet.ru/contests/f4ba61d5-9ce4-411a-a533-2e90c4e1e3eb/participants/0eaa49bc-0ee4-42c5-888e-635be4d31fc4"

   # Локально до прокси (если есть доступ к хосту)
   curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/contests/f4ba61d5-9ce4-411a-a533-2e90c4e1e3eb/participants/0eaa49bc-0ee4-42c5-888e-635be4d31fc4"
   ```  
   - **404:** участник/конкурс не найден в БД или не задан `SPA_INDEX_PATH`.  
   - **500:** смотреть логи сервера (`docker-compose logs server`), чаще всего ошибка чтения файла по `SPA_INDEX_PATH`.  
   - **Нет ответа / таймаут:** запрос не доходит до Go — проверить прокси/балансировщик перед api.top-pet.ru.
