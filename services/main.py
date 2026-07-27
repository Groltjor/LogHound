from fastapi import FastAPI
import sys
from pathlib import Path
from enum import Enum

SERVICES_ROOT = Path(__file__).resolve().parent
SRC = SERVICES_ROOT / 'src'

sys.path.insert(0, str(SRC))

from run_pipeline import run_pipeline

class ModelName(str, Enum):
    alexnet = 'alexnet'
    resnet = 'resnet'
    lenet = 'lenet'

app = FastAPI()

@app.get('/')
def root():
    return {'message' : 'Servicio Log Hound Conectado'}

@app.get('/models/{model_name}')
async def get_model(model_name : ModelName):
    if model_name is ModelName.alexnet:
        return {'model_name' : model_name, 'message' : 'Viva AlexNet'}
    if model_name.value == 'resnet':
        return {'model_name' : model_name, 'message' : 'Abajo el resnet'}
    
    return {'model_name' : model_name, 'message' : 'Queda Lenet'}

@app.get('/run_pipeline')
def execute_pipeline():
    json_file = run_pipeline()
    return json_file