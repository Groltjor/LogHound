# services/src/utils/anonymize_data.py

from __future__ import annotations

import copy
import hashlib
import hmac
import json
import os
from pathlib import Path
from typing import Any


# Este archivo vive en:
# PIDA/services/src/utils/anonymize_data.py
#
# Y apunta a:
# PIDA/next_interface/log-hound/public/data/predictions.json

CURRENT_FILE = Path(__file__).resolve()

PROJECT_ROOT = CURRENT_FILE.parents[3]
INPUT_PATH = PROJECT_ROOT / "next_interface" / "log-hound" / "public" / "data" / "predictions.json"
OUTPUT_PATH = PROJECT_ROOT / "next_interface" / "log-hound" / "public" / "data" / "predictions.anonymized.json"


# Idealmente define esto en tu entorno:
# export PIDA_ANON_SALT="una_salt_larga_privada"
#
# Si no existe, usamos una salt local de fallback.
# Para algo público, mejor NO uses la fallback.
SALT = os.getenv("PIDA_ANON_SALT", "dev-local-salt-change-me").encode("utf-8")


def stable_hash(value: Any, prefix: str, length: int = 16) -> str:
    """
    Convierte un valor sensible en un identificador estable y no reversible.

    Estable significa:
    - La misma IP siempre produce el mismo client_anon_xxx.
    - El mismo user agent siempre produce el mismo ua_anon_xxx.
    - Esto permite analizar patrones sin exponer el dato real.
    """
    if value is None:
        return f"{prefix}_null"

    raw = str(value).encode("utf-8")

    digest = hmac.new(
        SALT,
        raw,
        hashlib.sha256,
    ).hexdigest()

    return f"{prefix}_{digest[:length]}"


def anonymize_record(record: dict[str, Any]) -> dict[str, Any]:
    """
    Anonimiza solamente campos de identidad/fingerprint.
    Mantiene intactas las variables de comportamiento.

    Soporta dos formatos:
    1. Campos planos:
       - proxy.userAgent
       - proxy.clientIp

    2. Campos anidados:
       - proxy.userAgent
       - proxy.clientIp dentro de proxy {}
    """
    item = copy.deepcopy(record)

    # JA4 también puede funcionar como fingerprint técnico.
    if "ja4Digest" in item:
        item["ja4Digest"] = stable_hash(item.get("ja4Digest"), "ja4")

    # Formato plano: "proxy.clientIp"
    if "proxy.clientIp" in item:
        item["proxy.clientIp"] = stable_hash(item.get("proxy.clientIp"), "ip")

    if "proxy.userAgent" in item:
        item["proxy.userAgent"] = stable_hash(item.get("proxy.userAgent"), "ua")

    # Formato anidado: {"proxy": {"clientIp": "...", "userAgent": "..."}}
    proxy = item.get("proxy")

    if isinstance(proxy, dict):
        if "clientIp" in proxy:
            proxy["clientIp"] = stable_hash(proxy.get("clientIp"), "ip")

        if "userAgent" in proxy:
            proxy["userAgent"] = stable_hash(proxy.get("userAgent"), "ua")

    return item


def load_predictions(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"No existe el archivo de entrada: {path}")

    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError("El JSON esperado debe ser una lista de registros.")

    return data


def save_predictions(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )


def main() -> None:
    predictions = load_predictions(INPUT_PATH)

    anonymized = [
        anonymize_record(record)
        for record in predictions
    ]

    save_predictions(OUTPUT_PATH, anonymized)

    print("Anonimización completa.")
    print(f"Registros procesados: {len(anonymized):,}")
    print(f"Input:  {INPUT_PATH}")
    print(f"Output: {OUTPUT_PATH}")

    if os.getenv("PIDA_ANON_SALT") is None:
        print()
        print("WARNING: Estás usando la salt local de desarrollo.")
        print("Para publicar datos, usa una salt privada:")
        print('export PIDA_ANON_SALT="pon-aqui-una-salt-larga-privada"')


if __name__ == "__main__":
    main()