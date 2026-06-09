from fastapi import FastAPI
import sys
from pathlib import Path

SERVICES_ROOT = Path.cwd()
SRC = SERVICES_ROOT / 'src'
sys.path.insert(0, str(SRC))

from run_pipeline import run_pipeline

app = FastAPI()

@app.get('/')
async def root():
    json_file = run_pipeline()
    return json_file