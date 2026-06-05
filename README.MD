# Arquitectura del sistema

```mermaid
flowchart LR
    A["Vercel<br/>Drain Logs"] --> B["Supabase DB<br/>vercel_logs_buffer"]
    B --> C["Batch local<br/>consume logs recientes"]
    C --> D["Preparacion de datos<br/>limpieza y features"]
    D --> E["Modelo KMeans<br/>prediccion de actividad"]
    E --> F["Datos predichos<br/>labels por ventana"]
    F --> G["Archivo local<br/>production_pipeline/results"]
```

## Descripcion

El sistema recibe logs desde Vercel Drain Logs y los mantiene disponibles en Supabase.
Desde el entorno local se ejecuta un batch que consume esos registros recientes, prepara
los datos, aplica el modelo de prediccion y guarda la salida procesada como archivos
locales para analisis posterior.
