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
        ssl_keyfile=resolve_cert_path('SERVER_KEY'),
        ssl_certfile=resolve_cert_path('SERVER_CERT'),
        ssl_ca_certs=resolve_cert_path('CA_CERT'),
        reload=True,
    )