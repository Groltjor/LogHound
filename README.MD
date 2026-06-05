# Arquitectura del pipeline de prediccion

```mermaid
flowchart LR
    A[Vercel Logs / Log Drains] --> B[Supabase<br/>tabla: vercel_logs_buffer]
    B --> C[production_pipeline.utils.etl<br/>extract_n_load()]
    C --> D[Consulta ultimos 10 minutos<br/>load_data_from_table_last_10()]
    D --> E[Normalizacion JSON<br/>pd.json_normalize(log)]
    E --> F[Limpieza de logs<br/>preprocess_drain_logs()]
    F --> G[Feature engineering<br/>process_features_log_drains()]
    G --> H[Dataset de prediccion X<br/>+ indices de identidad]

    I[Modelo entrenado KMeans<br/>models/kmeans/models/*.joblib] --> J[production_pipeline/main.py]
    H --> J
    J --> K[Seleccion de feature_cols<br/>artifact['feature_cols']]
    K --> L[Prediccion<br/>model.predict(X)]
    L --> M[Resultado final<br/>indices + label + features]
    M --> N[CSV guardado<br/>production_pipeline/results/predicted_window_*.csv]

    subgraph Identidad
        ID1[ja4Digest]
        ID2[proxy.userAgent]
        ID3[proxy.clientIp]
    end

    G --> ID1
    G --> ID2
    G --> ID3
    ID1 --> H
    ID2 --> H
    ID3 --> H
```

## Flujo

1. Vercel envia logs hacia Supabase en la tabla `vercel_logs_buffer`.
2. `extract_n_load()` consume los registros recibidos en los ultimos 10 minutos.
3. El campo `log` se normaliza, se limpia y se transforma en features por identidad.
4. `main.py` carga el artefacto KMeans entrenado desde `models/kmeans/models`.
5. El modelo predice el `label` de cada ventana de actividad.
6. La salida se guarda como CSV en `production_pipeline/results`.
