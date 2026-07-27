import pandas as pd
import numpy as np
from pathlib import Path
import os

def process_features_log_drains(fuente_datos : pd.DataFrame) -> pd.DataFrame:


    new_view = (
        fuente_datos
        .groupby([
            'ja4Digest','proxy.userAgent', 'proxy.clientIp'
    ])
        .agg(
            conteo_requests = ( 'path', 'count'),
            times_timestamp = ( 'proxy.timestamp', 'count'),
            request_amount = ( 'requestId', 'count'),
            routes_visited = ( 'proxy.path', 'count'),

            activity_window_ms = (
                'proxy.timestamp',
                lambda x: x.max() - x.min()
            ),

            mean_time_between_requests_ms = (
                'proxy.timestamp',
                lambda x: x.sort_values().diff().mean()
            ),

            median_time_between_requests_ms = (
                'proxy.timestamp',
                lambda x : x.sort_values().diff().median()
            )


            
        )
        .reset_index()
    )


    new_view = new_view.fillna({
        'mean_time_between_requests_ms' : 0,
        'median_time_between_requests_ms' : 0,
        'activity_window_ms' : 0,
    })

    new_view['is_one_shot'] = (new_view['conteo_requests'] == 1)

    return new_view

def preprocess_drain_logs(dataframe):

    cols_to_drop = [
    'id','host', 'level', 'branch', 'source',
    'projectId', 'environment', 'projectName',
    'deploymentId', 'executionRegion', 'proxy.host',
    'proxy.region', 'proxy.scheme', 'proxy.cacheId',
    'proxy.pathType', 'proxy.vercelId', 'proxy.vercelCache',
    'proxy.lambdaRegion', 'type', 'instanceId', 'statusCode', 'invocationId','proxy.pathTypeVariant'
    ]

    agents_clean_data = dataframe.drop(columns = cols_to_drop).copy()
    agents_clean_data['proxy.userAgent'] = agents_clean_data['proxy.userAgent'].apply(
        lambda x: x[0] if isinstance(x, list) and len(x) > 0 else x
    )

    return agents_clean_data


def process_features_log_drains_ver2(fuente_datos : pd.DataFrame) -> pd.DataFrame:
    """
    Para mejorar este process es vital remover agrupacion por proxy.clientIP
    Revisar documentacion de Ja4, tambien se removie el user agent dado la preferencia
    por el footprint.
    """

    print('Estamos utilizando la Ver 2 de preprocesamiento de FE')

    ## En esta versión aun no hemos hecho FE de ja4

    df = fuente_datos.copy()

    df['timestamp_dt'] = pd.to_datetime(
        df['proxy.timestamp'],
        unit = 'ms',
        utc = 'True',
        errors = 'Coerce'
    )

    df = df.dropna(subset = ['timestamp_dt', 'ja4Digest'])
    df['time_window'] = df['timestamp_dt'].dt.floor('10min')

    new_view = (
        df
        .groupby([
            'ja4Digest',
            'time_window',
            'proxy.userAgent',
            'proxy.clientIp'
    ],
    observed = True,)
        .agg(
            routes_visited = ( 'proxy.path', 'count'),
            unique_routes = ( 'proxy.path', 'nunique'),

            activity_window_ms = (
                'proxy.timestamp',
                lambda x: x.max() - x.min()
            ),

            mean_time_between_requests_ms = (
                'proxy.timestamp',
                lambda x: x.sort_values().diff().mean()
            ),

            median_time_between_requests_ms = (
                'proxy.timestamp',
                lambda x : x.sort_values().diff().median()
            )
            
        )
        .reset_index()
    )

    time_columns = [
        "activity_window_ms",
        "mean_time_between_requests_ms",
        "median_time_between_requests_ms",
    ]

    new_view[time_columns] = new_view[time_columns].fillna(0)
    new_view['is_one_shot'] = (new_view['routes_visited'] == 1)

    return new_view