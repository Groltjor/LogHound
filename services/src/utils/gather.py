from supabase import create_client, Client
import pandas as pd
from pathlib import Path
import json
from datetime import datetime, timezone, timedelta

def load_data_from_table_last_10(
    nombre_tabla : str,
    supabase : Client,
    page_size : int = 999
    ):

    offset = 0
    all_data = []

    now_utc = datetime.now(timezone.utc)
    ten_minutes_ago = now_utc - timedelta(minutes = 10)

    since = ten_minutes_ago.isoformat()

    while True:

        response = (
            supabase
            .table(nombre_tabla)
            .select('*')
            .gte('received_at', since)
            .order('received_at', desc = False)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        rows = response.data
        all_data.extend(rows)

        if not rows:
            break
            
        if len(rows) < page_size:
            break

        offset += page_size
    
    return all_data

def load_data_from_table(
    nombre_tabla : str,
    supabase : Client,
    page_size : int = 999
    ):

    offset = 0
    all_data = []

    while True:

        response = (
            supabase
            .table(nombre_tabla)
            .select('*')
            .range(offset, offset + page_size - 1)
            .execute()
        )

        rows = response.data
        all_data.extend(rows)

        if not rows:
            break
            
        if len(rows) < page_size:
            break

        offset += page_size
    
    return all_data