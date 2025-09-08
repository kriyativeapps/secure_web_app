# Secure CRUD Web App

A simple CRUD web application with FastAPI backend, Next.js frontend, layered API architecture with mTLS authentication, and SQLite database.

## Architecture

```
┌─────────────────┐    SSL     ┌─────────────────┐    mTLS    ┌─────────────────┐
│   UI App        │────────────│   app-api       │────────────│   system-api    │
│  (Next.js)      │            │  (FastAPI       │            │  (FastAPI       │
│                 │            │   Proxy)        │            │   Backend)      │
└─────────────────┘            └─────────────────┘            └─────────────────┘
```

- **System-API (Backend)**: FastAPI with SQLModel, SQLite, mTLS enforcement, API paths prefixed with `/system/api/v1`
- **App-API**: FastAPI proxy layer providing SSL-secured API gateway, API paths prefixed with `/app/ui`
- **UI App (Frontend)**: Next.js with Shadcn UI, TailwindCSS
- **Security**: SSL between UI and App-API, mTLS between App-API and System-API
- **Database**: SQLite for data storage

## Features

- Create, Read, Update, Delete items
- Secure communication via mTLS
- Modern UI with Shadcn components

## Prerequisites

- Python 3.8+
- Node.js 18+
- UV (Python package manager)

## Setup

1. Clone or navigate to the project directory.

2. **System-API (Backend) Setup**:
    ```bash
    cd backend
    uv venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    uv pip install -r requirements.txt
    python create_db.py  # Create database
    ```

3. **App-API Setup**:
    ```bash
    cd app-api
    uv venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    uv pip install -r requirements.txt
    ```

4. **Frontend Setup**:
    ```bash
    cd frontend
    npm install
    ```

## Running the Application

1. **Start System-API (Backend)** (in one terminal):
    ```bash
    cd backend
    source .venv/bin/activate
    python run.py
    ```
    The system-api will run on https://localhost:8000/system/api/v1/* with mTLS enforcement.

2. **Start App-API** (in another terminal):
    ```bash
    cd app-api
    source .venv/bin/activate
    python run.py
    ```
    The app-api will run on https://localhost:8001/app/ui/* with SSL.

3. **Start Frontend** (in another terminal):
    ```bash
    cd frontend
    npm run dev
    ```
    The frontend will run on http://localhost:3000.

4. Open http://localhost:3000 in your browser to access the app.

## mTLS Configuration

- Certificates are generated in `./certs/`
- CA: ca.crt, ca.key
- System-API Server: server.crt, server.key
- App-API Server: app-api.crt, app-api.key
- Client: client.crt, client.key (used by app-api to authenticate with system-api)
- Certificate paths are configured via environment variables in the root `.env` file with absolute paths
- The app-api uses client certificates to authenticate with the system-api via mTLS
- The frontend connects to app-api over SSL (no client certificate requirement)

## API Endpoints

### App-API Endpoints (accessed by frontend)
- GET /app/ui/items - List all items
- POST /app/ui/items - Create new item
- GET /app/ui/items/{id} - Get item by ID
- PUT /app/ui/items/{id} - Update item
- DELETE /app/ui/items/{id} - Delete item
- POST /app/ui/upload-items - Upload items from CSV/Excel
- GET /app/ui/reports/{filename} - Download error reports
- GET /app/ui/health - Health check

### System-API Endpoints (internal, proxied by App-API)
- GET /system/api/v1/items - List all items
- POST /system/api/v1/items - Create new item
- GET /system/api/v1/items/{id} - Get item by ID
- PUT /system/api/v1/items/{id} - Update item
- DELETE /system/api/v1/items/{id} - Delete item
- POST /system/api/v1/upload-items - Upload items from CSV/Excel
- GET /system/api/v1/reports/{filename} - Download error reports

## Notes

- Self-signed certificates are used for demo purposes.
- For production, use proper CA-signed certificates.
- The app manages basic items with name and description fields.