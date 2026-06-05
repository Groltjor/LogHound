# Arquitectura del sistema

```mermaid
flowchart TB
    subgraph cloud["Cloud"]
        vercel["Vercel App<br/>Drain Logs"]
        supabase[("Supabase DB<br/>vercel_logs_buffer")]
    end

    subgraph local["Entorno local"]
        batch(["Python batch<br/>production_pipeline/main.py"])
        etl["Preparacion de datos<br/>limpieza + features"]
        model[["Modelo KMeans<br/>models/kmeans/models"]]
        predict["Prediccion<br/>labels por ventana"]
        results[/"CSV local<br/>production_pipeline/results"/]
    end

    vercel -->|"envia logs"| supabase
    supabase -->|"consulta registros recientes"| batch
    batch --> etl
    etl --> model
    model --> predict
    predict --> results

    classDef source fill:#eef6ff,stroke:#2563eb,stroke-width:1.5px,color:#0f172a;
    classDef database fill:#ecfdf5,stroke:#059669,stroke-width:1.5px,color:#064e3b;
    classDef local fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#431407;
    classDef model fill:#f5f3ff,stroke:#7c3aed,stroke-width:1.5px,color:#2e1065;
    classDef output fill:#f8fafc,stroke:#475569,stroke-width:1.5px,color:#0f172a;

    class vercel source;
    class supabase database;
    class batch,etl,predict local;
    class model model;
    class results output;
```

## Descripcion

El sistema recibe logs desde Vercel Drain Logs y los mantiene disponibles en Supabase.
Desde el entorno local se ejecuta un batch que consume esos registros recientes, prepara
los datos, aplica el modelo de prediccion y guarda la salida procesada como archivos
locales para analisis posterior.
