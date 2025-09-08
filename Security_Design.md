# Mutual TLS (mTLS) Implementation

## Overview

This application implements a layered architecture with Mutual TLS (mTLS) for secure communication:

- **Frontend (Next.js)**: Makes API calls to the App-API
- **App-API (FastAPI Proxy)**: Receives requests on `/app/ui/*` paths and proxies them to the System-API
- **System-API (FastAPI Backend)**: Provides the core API on `/system/api/v1/*` paths with mTLS enforcement

mTLS ensures that both the App-API and System-API authenticate each other using X.509 certificates, providing strong mutual authentication and encrypted communication.

## Certificate Management

Certificates are generated and stored in the `certs/` directory at the project root:

- **CA Certificate**: `ca.crt` and `ca.key` - The Certificate Authority used to sign all certificates.
- **System-API Server Certificate**: `server.crt` and `server.key` - Used by the System-API server to prove its identity.
- **App-API Server Certificate**: `app-api.crt` and `app-api.key` - Used by the App-API server for SSL communication with the frontend.
- **Client Certificate**: `client.crt` and `client.key` - Used by the App-API to authenticate with the System-API via mTLS.

Certificate paths and API URLs are configured via environment variables in the `.env` file at the project root:
- `CA_CERT=/absolute/path/to/certs/ca.crt`
- `SYSTEM_API_CERT=/absolute/path/to/certs/server.crt`
- `SYSTEM_API_KEY=/absolute/path/to/certs/server.key`
- `APP_API_CERT=/absolute/path/to/certs/app-api.crt`
- `APP_API_KEY=/absolute/path/to/certs/app-api.key`
- `CLIENT_CERT=/absolute/path/to/certs/client.crt`
- `CLIENT_KEY=/absolute/path/to/certs/client.key`
- `SYSTEM_API_URL=https://localhost:8000`
- `APP_API_URL=https://localhost:8001`

### Certificate Generation

The certificates were generated using OpenSSL. To regenerate them:

```bash
# Generate CA
openssl req -x509 -newkey rsa:4096 -keyout ca.key -out ca.crt -days 365 -nodes -subj "/CN=MyCA"

# Generate server certificate
openssl req -newkey rsa:2048 -keyout server.key -out server.csr -nodes -subj "/CN=localhost"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -out server.crt -days 365 -CAcreateserial

# Generate app-api certificate
openssl req -newkey rsa:2048 -keyout app-api.key -out app-api.csr -nodes -subj "/CN=localhost"
openssl x509 -req -in app-api.csr -CA ca.crt -CAkey ca.key -out app-api.crt -days 365 -CAcreateserial

# Generate client certificate
openssl req -newkey rsa:2048 -keyout client.key -out client.csr -nodes -subj "/CN=client"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -out client.crt -days 365
```
### Windows Certificate Generation

On Windows, you can generate the certificates using OpenSSL. First, ensure OpenSSL is installed. You can install it via:

- **Git for Windows** (which includes Git Bash with OpenSSL): Download from https://gitforwindows.org/
- **Direct download**: From the OpenSSL website at https://slproweb.com/products/Win32OpenSSL.html

**Note**: OpenSSL is required for generating X.509 certificates used in mTLS. Windows' built-in OpenSSH agent service is for SSH key management and cannot be used for X.509 certificate generation.

Once installed, open Command Prompt, PowerShell, or Git Bash and navigate to the `certs/` directory. The commands are identical to the Linux instructions above:

**Note**: Ensure the OpenSSL executable is in your system's PATH. If using Git Bash, the commands work the same as in a Linux terminal.

## Backend Configuration

The backend is a FastAPI application served by uvicorn with SSL/TLS enabled.

### Key Files:
- [`backend/main.py`](backend/main.py) - FastAPI application with API routes prefixed at `/system/api/v1/*`
- [`backend/run.py`](backend/run.py) - Server startup configuration

### SSL Configuration in `run.py`:
```python
import uvicorn
import os
import pathlib
from dotenv import load_dotenv, find_dotenv

if __name__ == "__main__":
    load_dotenv(find_dotenv())

    def resolve_cert_path(env_var):
        cert_path = os.environ[env_var]
        p = pathlib.Path(cert_path)
        if not p.is_absolute():
            # Assume relative to project root
            project_root = pathlib.Path(__file__).parent.parent
            p = project_root / p
        if not p.exists():
            raise FileNotFoundError(f"Certificate file not found: {p}")
        return str(p)

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        ssl_keyfile=resolve_cert_path('SYSTEM_API_KEY'),
        ssl_certfile=resolve_cert_path('SYSTEM_API_CERT'),
        ssl_ca_certs=resolve_cert_path('CA_CERT'),
        ssl_verify_mode="CERT_REQUIRED",
        reload=True,
    )
```

- `ssl_keyfile` and `ssl_certfile`: Server's private key and certificate
- `ssl_ca_certs`: CA certificate to verify client certificates
- `ssl_verify_mode="CERT_REQUIRED"`: Requires and verifies client certificates

## Frontend Configuration

The frontend is a Next.js application that makes API calls to the App-API proxy using SSL. The App-API then proxies requests to the System-API using mTLS.

### Key Files:
- [`frontend/src/lib/api-urls.ts`](frontend/src/lib/api-urls.ts) - Centralized API URL constants and utilities
- [`frontend/src/app/api/items/route.ts`](frontend/src/app/api/items/route.ts) - API route for items collection (calls `/app/ui/items`)
- [`frontend/src/app/api/items/[id]/route.ts`](frontend/src/app/api/items/[id]/route.ts) - API route for individual items (calls `/app/ui/items/{id}`)
- [`frontend/src/app/api/upload-items/route.ts`](frontend/src/app/api/upload-items/route.ts) - API route for uploading items (calls `/app/ui/upload-items`)
- [`frontend/src/app/api/reports/[filename]/route.ts`](frontend/src/app/api/reports/[filename]/route.ts) - API route for downloading reports (calls `/app/ui/reports/{filename}`)

### HTTPS Agent Configuration in `frontend/src/lib/https-agent.ts`:
```typescript
import https from 'https';
import fs from 'fs';
import path from 'path';

// Resolve and check certificate paths
const clientCertPath = path.resolve(process.cwd(), process.env.CLIENT_CERT!);
const clientKeyPath = path.resolve(process.cwd(), process.env.CLIENT_KEY!);
const caCertPath = path.resolve(process.cwd(), process.env.CA_CERT!);

if (!fs.existsSync(clientCertPath)) {
  throw new Error(`Client cert file not found: ${clientCertPath}`);
}
if (!fs.existsSync(clientKeyPath)) {
  throw new Error(`Client key file not found: ${clientKeyPath}`);
}
if (!fs.existsSync(caCertPath)) {
  throw new Error(`CA cert file not found: ${caCertPath}`);
}

const agent = new https.Agent({
  cert: fs.readFileSync(clientCertPath),
  key: fs.readFileSync(clientKeyPath),
  ca: fs.readFileSync(caCertPath),
  rejectUnauthorized: false, // Allow self-signed certs for testing
});

export { agent };
```

- `cert` and `key`: Client certificate and private key
- `ca`: CA certificate to verify the server's certificate
- `rejectUnauthorized: false`: Allows self-signed certificates for testing
- File existence checks: Ensures certificate files exist before creating the agent

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

### System-API (Backend)
```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
python run.py
```
The system-api will run on `https://localhost:8000/system/api/v1/*` with mTLS enforcement.

### App-API (Proxy)
```bash
cd app-api
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
python run.py
```
The app-api will run on `https://localhost:8001/app/ui/*` with SSL.

### Frontend
```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000` and will make API requests to `https://localhost:8001/app/ui/*` over SSL. The App-API proxies these requests to `https://localhost:8000/system/api/v1/*` using mTLS.

## Troubleshooting

- Ensure all certificate files exist in `certs/`
- Verify certificate validity dates
- Check that the server is running on HTTPS (port 8000)
- Confirm client certificate paths are correct in frontend API routes
- Use browser developer tools to inspect network requests for SSL errors