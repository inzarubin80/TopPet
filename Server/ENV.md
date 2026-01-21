# Переменные окружения

## Расположение файла

Создайте файл `.env` в корне папки `Server/` (рядом с `Makefile` и `go.mod`).

## Все переменные окружения

### Server Configuration

```bash
# Адрес и порт для запуска сервера
ADDR=:8080
```

### Database Configuration

```bash
# URL подключения к PostgreSQL
DATABASE_URL=postgres://postgres:postgres@localhost:5432/toppet?sslmode=disable
```

### JWT Token Configuration

```bash
# Секретный ключ для подписи access токенов (ОБЯЗАТЕЛЬНО измените в продакшене!)
ACCESS_TOKEN_SECRET=dev-access-secret-change-in-production

# Секретный ключ для подписи refresh токенов (ОБЯЗАТЕЛЬНО измените в продакшене!)
REFRESH_TOKEN_SECRET=dev-refresh-secret-change-in-production

# Время жизни access токена в секундах (по умолчанию 300 = 5 минут)
ACCESS_TOKEN_TTL_SEC=300

# Время жизни refresh токена в секундах (по умолчанию 2592000 = 30 дней)
REFRESH_TOKEN_TTL_SEC=2592000
```

### Session Store Secret

```bash
# Секретный ключ для cookie сессий (ОБЯЗАТЕЛЬНО измените в продакшене!)
STORE_SECRET=dev-store-secret-change-in-production
```

### Yandex Object Storage (S3 compatible) Configuration

```bash
# Endpoint S3 хранилища (например, для Yandex Object Storage: storage.yandexcloud.net)
S3_ENDPOINT=

# Access Key для S3
S3_ACCESS_KEY=

# Secret Key для S3
S3_SECRET_KEY=

# Имя bucket'а
S3_BUCKET=

# Базовый URL CDN (если используется CDN перед S3)
S3_CDN_BASE_URL=

# Использовать HTTPS для S3 (true/false)
S3_SECURE=true
```

### CORS Configuration

```bash
# Разрешенные origins через запятую (для разработки)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### API Root URL

```bash
# Базовый URL API для OAuth redirect URI
# Для разработки: http://localhost:8080
# Для продакшена: https://api.yourdomain.com
API_ROOT=http://localhost:8080
```

### Frontend URL

```bash
# URL фронтенд приложения для OAuth callback redirect
# Для разработки: http://localhost:3000
# Для продакшена: https://yourdomain.com
FRONTEND_URL=http://localhost:3000
```

### OAuth Providers Configuration

#### Yandex OAuth

```bash
# Client ID из Яндекс.OAuth приложения
# Получить можно здесь: https://oauth.yandex.ru/
CLIENT_ID_YANDEX=

# Client Secret из Яндекс.OAuth приложения
CLIENT_SECRET_YANDEX=
```

#### Google OAuth

```bash
# Client ID из Google Cloud Console
# Получить можно здесь: https://console.cloud.google.com/apis/credentials
CLIENT_ID_GOOGLE=

# Client Secret из Google Cloud Console
CLIENT_SECRET_GOOGLE=
```

#### VK OAuth

```bash
# Client ID (Application ID) из VK приложения
# Получить можно здесь: https://vk.com/apps?act=manage
CLIENT_ID_VK=

# Client Secret (Secure Key) из VK приложения
CLIENT_SECRET_VK=
```

## Пример полного файла .env

```bash
# Server Configuration
ADDR=:8080

# Database Configuration
DATABASE_URL=postgres://postgres:postgres@localhost:5432/toppet?sslmode=disable

# JWT Token Configuration
ACCESS_TOKEN_SECRET=dev-access-secret-change-in-production
REFRESH_TOKEN_SECRET=dev-refresh-secret-change-in-production
ACCESS_TOKEN_TTL_SEC=300
REFRESH_TOKEN_TTL_SEC=2592000

# Session Store Secret
STORE_SECRET=dev-store-secret-change-in-production

# Yandex Object Storage (S3 compatible) Configuration
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_CDN_BASE_URL=
S3_SECURE=true

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# API Root URL
API_ROOT=http://localhost:8080

# OAuth Providers Configuration

# Yandex OAuth
CLIENT_ID_YANDEX=
CLIENT_SECRET_YANDEX=

# Google OAuth
CLIENT_ID_GOOGLE=
CLIENT_SECRET_GOOGLE=
```

## Важные замечания

1. **Файл `.env` должен быть в `.gitignore`** - никогда не коммитьте его в репозиторий!
2. **Для продакшена** обязательно измените все секретные ключи:
   - `ACCESS_TOKEN_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `STORE_SECRET`
3. **OAuth провайдеры** - если не указаны `CLIENT_ID_*` и `CLIENT_SECRET_*`, соответствующий провайдер не будет доступен
4. **S3 хранилище** - если не указаны параметры S3, загрузка файлов будет недоступна
5. **CORS** - для продакшена укажите реальные домены вашего фронтенда

## Использование в Makefile

Makefile автоматически подключает файл `.env` (строка `-include .env`), поэтому переменные из `.env` доступны в командах make.
