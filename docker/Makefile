.PHONY: up down restart logs ps shell clean

# Запустить PostgreSQL
up:
	docker-compose up -d

# Остановить PostgreSQL
down:
	docker-compose down

# Перезапустить PostgreSQL
restart:
	docker-compose restart postgres

# Показать логи
logs:
	docker-compose logs -f postgres

# Показать статус
ps:
	docker-compose ps

# Подключиться к базе данных через psql
shell:
	docker exec -it toppet-postgres psql -U postgres -d toppet

# Остановить и удалить volumes (удалит все данные!)
clean:
	docker-compose down -v

# Проверить здоровье контейнера
health:
	docker-compose ps
