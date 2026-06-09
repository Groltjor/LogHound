import os
from pathlib import Path
import sys
import joblib
import pandas as pd
from datetime import datetime

SRC_ROOT = Path.cwd().parent
SERVICES_ROOT = SRC_ROOT / 'services'
PRODUCTION_UTILS = SRC_ROOT
MODEL_PATH = SERVICES_ROOT / 'src' / 'models' /'kmeans_vercel_drains_2026-06-05_12-59-03.joblib'

if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from utils.etl import (
    extract_n_load
)

def run_pipeline():

    X, indices = extract_n_load()

    model_path_joblib = MODEL_PATH

    artifact = joblib.load(model_path_joblib)

    model = artifact['model']
    feature_cols = artifact['feature_cols']

    X = X[feature_cols]

    labels = model.predict(X)

    result = indices.copy()
    result['label'] = labels


    result = pd.concat(
        [
            result.reset_index(drop=True),
            X.reset_index(drop=True)
        ],
        axis=1
    )

    resultados_json = result.to_dict(orient = 'records')

    return resultados_json