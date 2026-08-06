FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

# Install backend deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built frontend into frontend/dist (backend serves it from there)
COPY --from=frontend-build /app/dist ./frontend/dist

# Create uploads dir
RUN mkdir -p uploads

EXPOSE 8000
CMD ["sh", "-c", "python -c 'from app.create_tables import init_db; init_db()' && python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
