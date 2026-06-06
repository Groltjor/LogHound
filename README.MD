# Beta from PIDA

El problema de los userAgents cuando tienes un dominio con funciones serverless es consumir CPU time (incluso con L1 cache xc) de forma descontrolada. Si bien el cache y usar reglas de firewall mitigan fuertemente este problema, decidí crear una tool que permitiese a usuarios de Vercel tener un pipeline que les ayude a tunear sus reglas de firewall, clasificando a cada userAgent de acuerdo a su comportamiento (hacerlo a mano no es divertido en 100k registros).

Este repo (En revisión sorry) busca presentar una arquitectura sencilla, pero efectiva haciendo delivery hacia un endpoint en fastApi, donde el único requerimento será tener tus log drains de Vercel configurados y siendo almacenados en una base de datos en Supabase (sorry ahi tengo mi infra), es vital mencionarlo ya que este repo hace uso de su libreria de python para la extracción de datos.

## Arquitectura del sistema

En beta, ha sido actualizada desde la subida anterior, pero dados los tiempos de revisión del ITESM es necesario mantener el proyecto final en hold.

```mermaid
flowchart TB
    subgraph cloud["Cloud / fuente de datos"]
        vercel["Vercel App<br/>Drain Logs"]
        supabase[("Supabase DB<br/>vercel_logs_buffer")]
    end

    subgraph training["Entrenamiento offline"]
        train(["Build KMeans<br/>src/utils/build"])
        artifact[["Artefacto KMeans<br/>kmeans_vercel_drains.joblib"]]
    end

    subgraph service["Servicio distribuible"]
        fastapi["FastAPI<br/>services/main.py<br/>GET /"]
        pipeline["Pipeline empaquetado<br/>services/src/run_pipeline.py"]
        etl["Extraccion + preparacion<br/>ultimos 10 min + features"]
        predict["Prediccion<br/>labels por ventana"]
        response[/"Respuesta JSON<br/>records con label + features"/]
    end

    consumer["Consumidor open source<br/>dashboard / cliente / reglas firewall"]
    csv[/"Salida batch opcional<br/>production_pipeline/results/*.csv"/]

    vercel -->|"envia logs"| supabase
    train --> artifact
    consumer -->|"GET /"| fastapi
    fastapi --> pipeline
    pipeline -->|"consulta registros recientes"| supabase
    pipeline --> etl
    etl --> predict
    artifact --> predict
    predict --> response
    response --> consumer
    predict -.-> csv

    classDef source fill:#eef6ff,stroke:#2563eb,stroke-width:1.5px,color:#0f172a;
    classDef database fill:#ecfdf5,stroke:#059669,stroke-width:1.5px,color:#064e3b;
    classDef serviceStep fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#431407;
    classDef ml fill:#f5f3ff,stroke:#7c3aed,stroke-width:1.5px,color:#2e1065;
    classDef output fill:#f8fafc,stroke:#475569,stroke-width:1.5px,color:#0f172a;
    classDef consumerNode fill:#fef2f2,stroke:#dc2626,stroke-width:1.5px,color:#450a0a;

    class vercel source;
    class supabase database;
    class fastapi,pipeline,etl,predict serviceStep;
    class train,artifact ml;
    class response,csv output;
    class consumer consumerNode;
```

## Competencias cubiertas

- Fundamentos de Ciencia de Datos
- Procesamiento de Datos
- Visualización de Datos
- Geovisualizació
- Diseño de interfaces
- Data Story
- Análisis de Datos
- Aprendizaje no supervisado

### Nota

El código fuente del proyecto se encuentra aún bajo revisión.
