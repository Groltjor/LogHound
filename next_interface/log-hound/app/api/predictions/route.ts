import { promises as fs } from "fs";
import path from "path";

export async function POST() {
  const fastApiUrl = process.env.FASTAPI_URL + "/run_pipeline";

  if (!fastApiUrl) {
    return Response.json(
      {
        status: "error",
        message: "FASTAPI_URL no está configurada.",
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(fastApiUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        {
          status: "error",
          message: `FastAPI respondió con status ${response.status}.`,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (!Array.isArray(result)) {
      return Response.json(
        {
          status: "error",
          message: "FastAPI no devolvió una lista como se esperaba.",
          received: result,
        },
        { status: 500 }
      );
    }

    const outputPath = path.join(
      process.cwd(),
      "public",
      "data",
      "predictions.json"
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");

    return Response.json({
      status: "ok",
      message: "Data generada y almacenada correctamente.",
      records: result.length,
      output: "/data/predictions.json",
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: "No se pudo generar la data.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}