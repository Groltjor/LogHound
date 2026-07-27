# Log Hound Demo

Showcase autónomo del frontend de Log Hound. Incluye un dataset sintético determinista y simula localmente las acciones de firewall.

## Ejecutar localmente

```bash
npm install
npm run dev
```

No requiere `.env`, FastAPI, Supabase, Docker, tokens ni una cuenta de Vercel.

## Verificar el artefacto estático

```bash
npm run lint
npm run build
```

El build genera `out/`. La ruta principal del explorador también queda disponible directamente en `/home/space/`.

## Importar en Vercel

1. Importa el repositorio desde el dashboard de Vercel.
2. Selecciona `demo` como **Root Directory**.
3. Conserva **Next.js** como Framework Preset.
4. No agregues variables de entorno.
5. Presiona **Deploy**.

## Datos y seguridad

- `public/data/demo-predictions.json` se genera con `npm run generate:data` y queda incluido en el deploy.
- Las IP pertenecen a rangos reservados para documentación.
- Los dominios de los user agents usan `.invalid`.
- Las reglas, challenges y contramedidas son simulaciones almacenadas en `localStorage`.
- Ninguna interacción llama APIs o modifica infraestructura externa.
