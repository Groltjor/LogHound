import os
from pathlib import Path
import sys
from supabase import create_client, Client
import pandas as pd

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

from utils.gather import (
    load_data_from_table_last_10
)

from utils.feature_eng import (
    preprocess_drain_logs,
    process_features_log_drains_ver2
)

def extract_n_load(nombre_tabla : str = 'vercel_logs_buffer'):

    data = load_data_from_table_last_10(nombre_tabla, supabase)

    data_frame = pd.DataFrame(data)
    log_drains = pd.json_normalize(data_frame['log'])

    log_drains_clean = preprocess_drain_logs(log_drains)

    log_drains_preprocessed = process_features_log_drains_ver2(log_drains_clean)

    id_cols = ['ja4Digest', 'time_window', 'proxy.userAgent', 'proxy.clientIp']

    ids = log_drains_preprocessed[id_cols].copy()

    X = log_drains_preprocessed.drop(columns = id_cols).copy()

    return X, ids