import uvicorn
import os
from dotenv import load_dotenv

if __name__ == "__main__":
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