import os
from pathlib import Path
import sys
import joblib
import pandas as pd
from datetime import datetime
import numpy as np

from paths import KMEANS_MODEL_PATH

from utils.etl import (
    extract_n_load
)

def run_pipeline():

    X, indices = extract_n_load()

    model_path_joblib = KMEANS_MODEL_PATH

    artifact = joblib.load(model_path_joblib)

    model = artifact['model']
    feature_cols = artifact['feature_cols']

    print(feature_cols)

    X = X[feature_cols]

    labels = model.predict(X)
    ## woops
    X_transformed = model.named_steps['preprocessor'].transform(X)
    kmeans = model.named_steps['model']
    centroids = kmeans.cluster_centers_
    # Distancia euclidiana de cada punto a su centroide asignado
    distances = np.linalg.norm(
        X_transformed - centroids[labels],
        axis=1
    )

    result = indices.copy()
    result['label'] = labels
    result['distancias'] = distances


    result = pd.concat(
        [
            result.reset_index(drop=True),
            X.reset_index(drop=True)
        ],
        axis=1
    )

    resultados_json = result.to_dict(orient = 'records')

    return resultados_json