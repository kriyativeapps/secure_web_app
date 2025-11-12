from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from sqlmodel import Session, select
from models import Item
from database import get_session
from typing import List
import pandas as pd
import io
import os
from dotenv import load_dotenv, find_dotenv
import psutil
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Backend API", description="Backend API for Secure CRUD Web App")

# Load environment variables
load_dotenv(find_dotenv())

# Performance thresholds (configurable via environment variables)
CPU_THRESHOLD = int(os.environ.get('CPU_THRESHOLD', '95'))  # 95%
MEMORY_THRESHOLD = int(os.environ.get('MEMORY_THRESHOLD', '90'))  # 90%

@app.middleware("http")
async def cpu_based_rate_limiter(request: Request, call_next):
    # Get CPU usage. The 'interval' parameter is important.
    cpu_percent = psutil.cpu_percent(interval=None)
    
    # Get memory usage
    memory_percent = psutil.virtual_memory().percent

    if cpu_percent > CPU_THRESHOLD:
        raise HTTPException(
            status_code=503,
            detail=f"Service Unavailable - CPU usage is at {cpu_percent}%",
        )
    
    if memory_percent > MEMORY_THRESHOLD:
        raise HTTPException(
            status_code=503,
            detail=f"Service Unavailable - Memory usage is at {memory_percent}%",
        )

    response = await call_next(request)
    return response

# Test endpoint to return 503 error for testing app-api retry logic
@app.get("/system/api/v1/503")
async def test_503_endpoint():
    """Test endpoint that always returns 503 Service Unavailable"""
    logger.info("Test endpoint /503 called - returning 503 error")
    raise HTTPException(
        status_code=503,
        detail="Service Unavailable - Test endpoint for retry logic"
    )

from fastapi.responses import FileResponse

@app.get("/system/api/v1/items", response_model=List[Item])
def read_items(session: Session = Depends(get_session)):
    items = session.exec(select(Item)).all()
    return items

@app.post("/system/api/v1/items", response_model=Item)
def create_item(item: Item, session: Session = Depends(get_session)):
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@app.get("/system/api/v1/items/{item_id}", response_model=Item)
def read_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.put("/system/api/v1/items/{item_id}", response_model=Item)
def update_item(item_id: int, updated_item: Item, session: Session = Depends(get_session)):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.name = updated_item.name
    item.description = updated_item.description
    session.commit()
    session.refresh(item)
    return item

@app.delete("/system/api/v1/items/{item_id}")
def delete_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted"}

@app.post("/system/api/v1/upload-items")
async def upload_items(file: UploadFile = File(...), session: Session = Depends(get_session)):
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV and Excel files are allowed.")

    content = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

    errors = []
    success_count = 0

    for index, row in df.iterrows():
        name = row.get('name')
        description = row.get('description')

        if pd.isna(name) or not str(name).strip():
            errors.append({
                'row': index + 2,  # +2 because pandas index starts at 0, and header is row 1
                'name': str(name) if not pd.isna(name) else '',
                'description': str(description) if not pd.isna(description) else '',
                'error': 'Name is required'
            })
            continue

        try:
            item = Item(name=str(name).strip(), description=str(description).strip() if not pd.isna(description) else None)
            session.add(item)
            session.commit()
            session.refresh(item)
            success_count += 1
        except Exception as e:
            errors.append({
                'row': index + 2,
                'name': str(name),
                'description': str(description) if not pd.isna(description) else '',
                'error': f'Database error: {str(e)}'
            })

    response = {
        "success_count": success_count,
        "error_count": len(errors),
        "message": f"Processed {success_count} items successfully."
    }

    if errors:
        # Create error report
        error_df = pd.DataFrame(errors)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        error_filename = f"upload_errors_{timestamp}.csv"
        error_filepath = os.path.join("error_reports", error_filename)
        os.makedirs("error_reports", exist_ok=True)
        error_df.to_csv(error_filepath, index=False)
        response["error_report_url"] = f"/system/api/v1/reports/{error_filename}"
        response["message"] += f" {len(errors)} errors occurred. Download error report."

    return response

@app.get("/system/api/v1/reports/{filename}")
async def download_error_report(filename: str):
    filepath = os.path.join("error_reports", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(filepath, media_type='text/csv', filename=filename)