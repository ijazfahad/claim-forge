# ClaimForge Validation API Makefile

.PHONY: help build start dev test docker-build docker-run docker-dev docker-prod docker-down docker-logs docker-clean

# Default target
help:
	@echo "ClaimForge Validation API - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server with hot reload"
	@echo "  make build        - Build TypeScript to JavaScript"
	@echo "  make start        - Start production server"
	@echo "  make test         - Run test suite"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-run   - Run Docker container"
	@echo "  make docker-dev   - Start development environment with Docker Compose"
	@echo "  make docker-prod  - Start production environment with Docker Compose"
	@echo "  make docker-down  - Stop all Docker containers"
	@echo "  make docker-logs  - View Docker container logs"
	@echo "  make docker-clean - Clean up Docker containers and images"
	@echo ""
	@echo "Utilities:"
	@echo "  make install      - Install dependencies"
	@echo "  make lint         - Run linter"
	@echo "  make format       - Format code"

# Development commands
install:
	npm install

build:
	npm run build

start:
	npm start

dev:
	npm run dev

test:
	npm test

lint:
	npx eslint src/ --ext .ts

format:
	npx prettier --write src/

# Docker commands
docker-build:
	docker build -t claim-validator .

docker-run:
	docker run -p 3000:3000 --env-file .env claim-validator

docker-dev:
	docker-compose -f docker-compose.dev.yml up --build

docker-prod:
	docker-compose up --build -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-clean:
	docker-compose down -v --rmi all

# Redis commands
redis-start:
	docker run -d --name claim-validator-redis -p 6380:6379 redis:7-alpine redis-server --requirepass claimvalidator123

redis-stop:
	docker stop claim-validator-redis && docker rm claim-validator-redis

redis-cli:
	docker exec -it claim-validator-redis redis-cli -a claimvalidator123

# Setup commands
setup:
	@echo "Setting up ClaimForge Validation API..."
	@if [ ! -f .env ]; then \
		echo "Creating .env file from template..."; \
		cp env.example .env; \
		echo "Please update .env with your API keys"; \
	fi
	npm install
	@echo "Setup complete! Run 'make dev' to start development server."

# Clean commands
clean:
	rm -rf dist/
	rm -rf node_modules/
	rm -rf logs/

clean-all: clean docker-clean
	@echo "All cleaned up!"
