# Mutual TLS (mTLS) Implementation

## Overview

This application implements Mutual TLS (mTLS) for secure communication between the frontend and backend. mTLS ensures that both the client (frontend) and server (backend) authenticate each other using X.509 certificates, providing strong mutual authentication and encrypted communication.

## Certificate Management

Certificates are generated and stored in the `certs/` directory at the project root:

- **CA Certificate**: `ca.crt` and `ca.key` - The Certificate Authority used to sign both server and client certificates.
- **Server Certificate**: `server.crt` and `server.key` - Used by the backend server to prove its identity.
- **Client Certificate**: `client.crt` and `client.key` - Used by the frontend to authenticate with the backend.

Certificate paths and backend URL are configured via environment variables in the `frontend/.env` file:
- `CA_CERT=../certs/ca.crt`
- `SERVER_CERT=../certs/server.crt`
- `SERVER_KEY=../certs/server.key`
- `CLIENT_CERT=../certs/client.crt`
- `CLIENT_KEY=../certs/client.key`
- `BACKEND_URL=https://localhost:8000`

### Certificate Generation

The certificates were generated using OpenSSL. To regenerate them:

```bash
# Generate CA
openssl req -x509 -newkey rsa:4096 -keyout ca.key -out ca.crt -days 365 -nodes -subj "/CN=MyCA"

# Generate server certificate
openssl req -newkey rsa:2048 -keyout server.key -out server.csr -nodes -subj "/CN=localhost"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -out server.crt -days 365 -CAcreateserial

# Generate client certificate
openssl req -newkey rsa:2048 -keyout client.key -out client.csr -nodes -subj "/CN=client"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -out client.crt -days 365
```

## Backend Configuration

The backend is a FastAPI application served by uvicorn with SSL/TLS enabled.

### Key Files:
- [`backend/main.py`](backend/main.py) - FastAPI application with API routes
- [`backend/run.py`](backend/run.py) - Server startup configuration

### SSL Configuration in `run.py`:
```python
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=8000,
    ssl_keyfile=os.path.join(os.path.dirname(__file__), '..', os.environ['SERVER_KEY']),
    ssl_certfile=os.path.join(os.path.dirname(__file__), '..', os.environ['SERVER_CERT']),
    ssl_ca_certs=os.path.join(os.path.dirname(__file__), '..', os.environ['CA_CERT']),
    ssl_verify_mode="CERT_REQUIRED",
)
```

- `ssl_keyfile` and `ssl_certfile`: Server's private key and certificate
- `ssl_ca_certs`: CA certificate to verify client certificates
- `ssl_verify_mode="CERT_REQUIRED"`: Requires and verifies client certificates

## Frontend Configuration

The frontend is a Next.js application that makes API calls to the backend using client certificates.

### Key Files:
- [`frontend/src/app/api/items/route.ts`](frontend/src/app/api/items/route.ts) - API route for items collection
- [`frontend/src/app/api/items/[id]/route.ts`](frontend/src/app/api/items/[id]/route.ts) - API route for individual items

### HTTPS Agent Configuration:
```typescript
const agent = new https.Agent({
  cert: fs.readFileSync(path.join(process.cwd(), process.env.CLIENT_CERT!)),
  key: fs.readFileSync(path.join(process.cwd(), process.env.CLIENT_KEY!)),
  ca: fs.readFileSync(path.join(process.cwd(), process.env.CA_CERT!)),
  rejectUnauthorized: true,
});

const BACKEND_URL = `${process.env.BACKEND_URL}/items`;
```

- `cert` and `key`: Client certificate and private key
- `ca`: CA certificate to verify the server's certificate
- `rejectUnauthorized: true`: Ensures server certificate verification

## How mTLS Works

1. **Client Hello**: Frontend initiates HTTPS connection with server
2. **Server Authentication**: Server sends its certificate; frontend verifies it against the CA
3. **Client Authentication**: Server requests client certificate; frontend sends its certificate
4. **Mutual Verification**: Server verifies client certificate against the CA
5. **Secure Communication**: If both verifications succeed, encrypted TLS session is established

## Security Benefits

- **Mutual Authentication**: Both parties prove their identity
- **Encryption**: All communication is encrypted using TLS 1.3
- **Certificate-based**: No passwords or tokens that can be stolen
- **CA Validation**: Certificates must be signed by trusted CA
- **Man-in-the-Middle Protection**: Certificate verification prevents MITM attacks

## Running the Application

### Backend
```bash
cd backend
python run.py
```

### Frontend
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000` and will proxy API requests to `https://localhost:8000` using mTLS.

## Troubleshooting

- Ensure all certificate files exist in `certs/`
- Verify certificate validity dates
- Check that the server is running on HTTPS (port 8000)
- Confirm client certificate paths are correct in frontend API routes
- Use browser developer tools to inspect network requests for SSL errors