import os
from pathlib import Path
import sys
import joblib
import pandas as pd
from datetime import datetime

ROOT_PROJECT = Path.cwd()
PRODUCTION_UTILS = ROOT_PROJECT / 'production_pipeline'
MODEL_PATH = ROOT_PROJECT / 'models' / 'kmeans' / 'models'

if str(ROOT_PROJECT) not in sys.path:
    sys.path.insert(0, str(ROOT_PROJECT))

from production_pipeline.utils.etl import (
    extract_n_load
)


X, indices = extract_n_load()

print(X)


name_model = 'kmeans_vercel_drains_2026-06-05_12-59-03.joblib'
model_path_joblib = MODEL_PATH / name_model

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

run_timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

RESULTS_PATH = (
    ROOT_PROJECT
    / "production_pipeline"
    / "results"

)

RESULTS_PATH.mkdir(parents=True, exist_ok=True)

output_path = RESULTS_PATH / f"predicted_window_{run_timestamp}.csv"

result.to_csv(output_path, index=False)

print(f"Predicción lista. Archivo guardado en: {output_path}")
print(result.head())