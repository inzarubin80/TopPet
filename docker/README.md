# Docker Compose для PostgreSQL

Этот Docker Compose файл позволяет быстро поднять PostgreSQL базу данных для локальной разработки и отладки.

## Использование

### Запуск PostgreSQL

```bash
# Из корня проекта
cd docker
docker-compose up -d

# Или из любой директории
docker-compose -f docker/docker-compose.yml up -d
```

### Остановка PostgreSQL

```bash
cd docker
docker-compose down

# Или с удалением volumes (удалит все данные!)
docker-compose down -v
```

### Просмотр логов

```bash
cd docker
docker-compose logs -f postgres
```

### Подключение к базе данных

```bash
# Через psql в контейнере
docker exec -it toppet-postgres psql -U postgres -d toppet

# Или через внешний клиент с параметрами:
# Host: localhost
# Port: 5432
# User: postgres
# Password: postgres
# Database: toppet
```

## Параметры подключения

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `toppet`

Эти параметры соответствуют значениям по умолчанию в `Server/.env.example`.

## Изменение параметров

Если нужно изменить параметры подключения, отредактируйте:

1. Переменные окружения в `docker-compose.yml`:
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`

2. Порт в секции `ports` (формат: `"HOST_PORT:CONTAINER_PORT"`)

3. Соответствующие значения в `Server/.env`:
   - `DATABASE_URL=postgres://postgres:postgres@localhost:5432/toppet?sslmode=disable`

## Персистентность данных

Данные хранятся в Docker volume `postgres_data`. Это означает, что данные сохраняются между перезапусками контейнера, но удаляются при `docker-compose down -v`.

## Полезные команды

```bash
# Проверка статуса
docker-compose ps

# Перезапуск контейнера
docker-compose restart postgres

# Остановка без удаления контейнера
docker-compose stop

# Запуск остановленного контейнера
docker-compose start

# Просмотр использования ресурсов
docker stats toppet-postgres
```
