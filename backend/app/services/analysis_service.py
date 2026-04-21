"""Deterministic analysis helpers for scoring and config generation."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl, urlparse


FIELD_RULES: dict[str, tuple[str, ...]] = {
    "name": ("name", "title"),
    "price": ("price", "amount"),
    "image": ("image", "image_url", "url"),
    "id": ("id", "sku"),
}


@dataclass
class ArrayCandidate:
    path: str
    items: list[dict[str, Any]]
    key_consistency: float


def _is_object_array(value: Any) -> bool:
    return isinstance(value, list) and value and all(isinstance(item, dict) for item in value)


def _key_consistency(items: list[dict[str, Any]]) -> float:
    if not items:
        return 0.0
    key_sets = [set(item.keys()) for item in items if isinstance(item, dict)]
    if not key_sets:
        return 0.0
    first = key_sets[0]
    matched = sum(1 for keys in key_sets if keys == first)
    return matched / len(key_sets)


def _collect_candidates(data: Any, path: str = "data") -> list[ArrayCandidate]:
    found: list[ArrayCandidate] = []
    if isinstance(data, dict):
        for key, value in data.items():
            found.extend(_collect_candidates(value, f"{path}.{key}"))
    elif isinstance(data, list):
        if _is_object_array(data):
            found.append(ArrayCandidate(path=path, items=data, key_consistency=_key_consistency(data)))
        for idx, item in enumerate(data[:20]):
            found.extend(_collect_candidates(item, f"{path}[{idx}]"))
    return found


def detect_data_path(data: Any) -> str:
    """Find best array-of-objects path by size then key consistency."""
    candidates = _collect_candidates(data)
    if not candidates:
        return "data"
    best = max(candidates, key=lambda c: (len(c.items), c.key_consistency))
    return best.path


def extract_by_path(data: Any, path: str) -> Any:
    current = data
    for part in path.replace("data.", "").split("."):
        if not part:
            continue
        if "[" in part and "]" in part:
            key, index = part[:-1].split("[")
            if key:
                current = current.get(key, {}) if isinstance(current, dict) else {}
            current = current[int(index)] if isinstance(current, list) and len(current) > int(index) else None
        else:
            current = current.get(part) if isinstance(current, dict) else None
        if current is None:
            return None
    return current


def map_fields(sample_item: dict[str, Any]) -> dict[str, str | None]:
    """Map canonical fields to source keys."""
    key_lookup = {key.lower(): key for key in sample_item.keys()}
    mapped: dict[str, str | None] = {}
    for target, options in FIELD_RULES.items():
        match = None
        for option in options:
            for lowered, original in key_lookup.items():
                if lowered == option or option in lowered:
                    match = original
                    break
            if match:
                break
        mapped[target] = match
    return mapped


def score_response(json_data: Any) -> dict[str, Any]:
    """Score response deterministically and emit matched signals."""
    score = 0.0
    signals: list[str] = []
    path = None if isinstance(json_data, list) and _is_object_array(json_data) else detect_data_path(json_data)
    candidate = json_data if path is None else extract_by_path(json_data, path)

    if _is_object_array(candidate) and len(candidate) > 3:
        score += 0.4
        signals.append("array_of_objects")

        all_keys = Counter(k.lower() for obj in candidate for k in obj.keys())
        if any(k in all_keys for k in ("name", "title")):
            score += 0.1
            signals.append("name_or_title")
        if "price" in all_keys:
            score += 0.1
            signals.append("price")
        if any(k in all_keys for k in ("id", "sku")):
            score += 0.1
            signals.append("id_or_sku")
        if any(k in all_keys for k in ("image", "image_url", "url")):
            score += 0.1
            signals.append("image_or_url")

        if _key_consistency(candidate) >= 0.7:
            score += 0.1
            signals.append("consistent_keys")

        if 3 < len(candidate) <= 2000:
            score += 0.1
            signals.append("reasonable_size")

    return {"score": round(min(score, 1.0), 2), "signals": signals, "data_path": path}


def detect_pagination(urls: list[str]) -> dict[str, str] | None:
    """Detect pagination parameter from similar endpoint query changes."""
    if len(urls) < 2:
        return None

    endpoint_groups: dict[str, list[dict[str, str]]] = {}
    for raw in urls:
        parsed = urlparse(raw)
        key = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        endpoint_groups.setdefault(key, []).append(dict(parse_qsl(parsed.query, keep_blank_values=True)))

    pagination_keys = ("page", "offset", "cursor")
    for query_sets in endpoint_groups.values():
        if len(query_sets) < 2:
            continue
        for pkey in pagination_keys:
            seen = {qs.get(pkey) for qs in query_sets if pkey in qs}
            if len(seen) > 1:
                return {"type": pkey, "param": pkey}
    return None


def generate_config(request: dict[str, Any], json_data: Any, all_urls: list[str]) -> dict[str, Any]:
    score_info = score_response(json_data)
    data_path = score_info["data_path"]
    data_items = json_data if data_path is None else extract_by_path(json_data, data_path)
    sample = data_items[0] if _is_object_array(data_items) else {}
    parsed = urlparse(request["url"])

    return {
        "endpoint": f"{parsed.scheme}://{parsed.netloc}{parsed.path}",
        "method": request["method"],
        # Prefer the enriched `request_headers` (includes pseudo-headers),
        # fall back to the original `headers` dict when not present.
        "headers": request.get("request_headers", request.get("headers", {})),
        "params": dict(parse_qsl(parsed.query, keep_blank_values=True)),
        "pagination": detect_pagination(all_urls),
        "data_path": data_path,
        "fields": map_fields(sample if isinstance(sample, dict) else {}),
        "score": score_info,
    }
