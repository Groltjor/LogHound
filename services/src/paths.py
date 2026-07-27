from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parent

SERVICES_ROOT = SRC_ROOT.parent

DATA_FROM_DRAINS_ROOT = SERVICES_ROOT / "data_from_drains"

MODELS_ROOT = SERVICES_ROOT / "models"

KMEANS_ROOT = MODELS_ROOT / "kmeans"

KMEANS_CHECKPOINTS_ROOT = KMEANS_ROOT / "checkpoints"
KMEANS_DATA_ROOT = KMEANS_ROOT / "data"
KMEANS_MODELS_ROOT = KMEANS_ROOT / "models"
KMEANS_RESULTS_ROOT = KMEANS_ROOT / "results"

#-----

KMEANS_MODEL_PATH = (
    KMEANS_MODELS_ROOT
    / "kmeans_vercel_drains_2026-06-18_21-55-24.joblib"
)