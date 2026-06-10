.PHONY: install run verify

verify:
	@echo "Verifying local setup..."
	@command -v node >/dev/null 2>&1 || { echo >&2 "Node is required but not installed. Aborting."; exit 1; }
	@command -v python3 >/dev/null 2>&1 || { echo >&2 "Python3 is required but not installed. Aborting."; exit 1; }
	@echo "Environment verified."

install: verify
	@echo "Setting up backend virtual environment..."
	cd backend && uv sync
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

run: 
	@echo "Starting Piper Blockchain..."
	@make -j 2 run-backend run-frontend

run-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev