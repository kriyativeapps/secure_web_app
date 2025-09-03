# Secure CRUD Web App

A simple CRUD web application with FastAPI backend, Next.js frontend, mTLS authentication, and SQLite database.

## Architecture

- **Backend**: FastAPI with SQLModel, SQLite, mTLS
- **Frontend**: Next.js with Shadcn UI, TailwindCSS
- **Security**: Mutual TLS (mTLS) for secure communication
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

2. **Backend Setup**:
   ```bash
   cd backend
   uv venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv pip install -r requirements.txt
   python create_db.py  # Create database
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   ```

## Running the Application

1. **Start Backend** (in one terminal):
   ```bash
   cd backend
   source .venv/bin/activate
   python run.py
   ```
   The backend will run on https://localhost:8000 with mTLS.

2. **Start Frontend** (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will run on http://localhost:3000.

3. Open http://localhost:3000 in your browser to access the app.

## mTLS Configuration

- Certificates are generated in `./certs/`
- CA: ca.crt, ca.key
- Server: server.crt, server.key
- Client: client.crt, client.key
- The frontend uses the client certificate to authenticate with the backend via API routes.

## API Endpoints

- GET /api/items - List all items
- POST /api/items - Create new item
- GET /api/items/{id} - Get item by ID
- PUT /api/items/{id} - Update item
- DELETE /api/items/{id} - Delete item

## Notes

- Self-signed certificates are used for demo purposes.
- For production, use proper CA-signed certificates.
- The app manages basic items with name and description fields.