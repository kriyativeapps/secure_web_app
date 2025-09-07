from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
import httpx
import os
import pathlib
from dotenv import load_dotenv, find_dotenv
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Application API", description="API Gateway for Secure CRUD Web App")

# Load environment variables
load_dotenv(find_dotenv())

# Backend URL
SYSTEM_API_URL = os.environ.get('SYSTEM_API_URL', 'https://localhost:8000')

def resolve_cert_path(env_var):
    """Resolve certificate path from environment variable"""
    cert_path = os.environ[env_var]
    p = pathlib.Path(cert_path)
    if not p.is_absolute():
        # Assume relative to project root
        project_root = pathlib.Path(__file__).parent.parent
        p = project_root / p
    if not p.exists():
        raise FileNotFoundError(f"Certificate file not found: {p}")
    return str(p)

# Configure mTLS client for backend communication
def get_backend_client():
    """Create httpx client with mTLS configuration for backend"""
    import ssl

    client_cert = (resolve_cert_path('CLIENT_CERT'), resolve_cert_path('CLIENT_KEY'))
    ca_cert = resolve_cert_path('CA_CERT')

    # Create SSL context that trusts our CA but allows localhost
    ssl_context = ssl.create_default_context()
    ssl_context.load_cert_chain(client_cert[0], client_cert[1])
    ssl_context.load_verify_locations(cafile=ca_cert)
    ssl_context.check_hostname = False  # Allow localhost with self-signed cert
    ssl_context.verify_mode = ssl.CERT_REQUIRED

    return httpx.AsyncClient(
        cert=client_cert,
        verify=ssl_context,
        timeout=30.0
    )

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_request(request: Request, path: str):
    """Proxy all requests to the backend with mTLS"""

    # Build backend URL
    SYSTEM_API_URL = f"{SYSTEM_API_URL}/{path}"

    # Add query parameters
    if request.url.query:
        SYSTEM_API_URL += f"?{request.url.query}"

    logger.info(f"Proxying request: {request.method} {request.url.path} -> {SYSTEM_API_URL}")

    # Get request body
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.body()
        except Exception as e:
            logger.error(f"Error reading request body: {e}")
            body = None

    # Prepare headers (exclude host and connection headers)
    headers = dict(request.headers)
    headers.pop('host', None)
    headers.pop('connection', None)

    try:
        client = get_backend_client()
        logger.info(f"Created backend client, attempting connection to {SYSTEM_API_URL}")
    except Exception as e:
        logger.error(f"Error creating backend client: {e}")
        raise HTTPException(status_code=500, detail=f"Client configuration error: {str(e)}")

    async with client:
        try:
            # Make request to backend
            logger.info(f"Making request to backend: {request.method} {SYSTEM_API_URL}")
            response = await client.request(
                method=request.method,
                url=SYSTEM_API_URL,
                headers=headers,
                content=body,
            )
            logger.info(f"Backend response: {response.status_code}")

            # Handle file responses (like CSV downloads)
            if response.headers.get('content-type') == 'text/csv':
                # For file downloads, return the content directly
                return Response(
                    content=response.content,
                    media_type=response.headers.get('content-type'),
                    headers={
                        'content-disposition': response.headers.get('content-disposition', ''),
                        'filename': response.headers.get('filename', '')
                    }
                )

            # For regular JSON responses
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get('content-type')
            )

        except httpx.TimeoutException as e:
            logger.error(f"Backend timeout: {str(e)}")
            raise HTTPException(status_code=504, detail="Backend timeout")
        except httpx.ConnectError as e:
            logger.error(f"Backend connection failed: {str(e)}")
            raise HTTPException(status_code=502, detail="Backend connection failed")
        except httpx.RequestError as e:
            logger.error(f"Backend request failed: {str(e)}")
            raise HTTPException(status_code=502, detail=f"Backend request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Internal server error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "app-api"}