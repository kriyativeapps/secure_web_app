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

async def proxy_to_backend(method: str, path: str, request: Request, body=None):
    """Helper function to proxy requests to the backend with mTLS"""
    # Build backend URL with system/api/v1 prefix
    backend_url = f"{SYSTEM_API_URL}/system/api/v1/{path}"

    # Add query parameters
    if request.url.query:
        backend_url += f"?{request.url.query}"

    logger.info(f"Proxying request: {method} {request.url.path} -> {backend_url}")

    # Prepare headers (exclude host and connection headers)
    headers = dict(request.headers)
    headers.pop('host', None)
    headers.pop('connection', None)

    try:
        client = get_backend_client()
        logger.info(f"Created backend client, attempting connection to {backend_url}")
    except Exception as e:
        logger.error(f"Error creating backend client: {e}")
        raise HTTPException(status_code=500, detail=f"Client configuration error: {str(e)}")

    async with client:
        try:
            # Make request to backend
            logger.info(f"Making request to backend: {method} {backend_url}")
            response = await client.request(
                method=method,
                url=backend_url,
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

# Individual routes for items
@app.get("/app/ui/items")
async def get_items(request: Request):
    return await proxy_to_backend("GET", "items", request)

@app.post("/app/ui/items")
async def create_item(request: Request):
    body = await request.body()
    return await proxy_to_backend("POST", "items", request, body)

@app.get("/app/ui/items/{item_id}")
async def get_item(item_id: int, request: Request):
    return await proxy_to_backend("GET", f"items/{item_id}", request)

@app.put("/app/ui/items/{item_id}")
async def update_item(item_id: int, request: Request):
    body = await request.body()
    return await proxy_to_backend("PUT", f"items/{item_id}", request, body)

@app.delete("/app/ui/items/{item_id}")
async def delete_item(item_id: int, request: Request):
    return await proxy_to_backend("DELETE", f"items/{item_id}", request)

# Route for uploading items
@app.post("/app/ui/upload-items")
async def upload_items(request: Request):
    body = await request.body()
    return await proxy_to_backend("POST", "upload-items", request, body)

# Route for downloading reports
@app.get("/app/ui/reports/{filename}")
async def download_report(filename: str, request: Request):
    return await proxy_to_backend("GET", f"reports/{filename}", request)

@app.get("/app/ui/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "app-api"}