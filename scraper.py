import sys
import json
from typing import Any, List, Optional
import requests
import argparse
import csv
from itertools import zip_longest


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def send_request(config: dict) -> dict:
    endpoint = config.get("endpoint")
    headers = config.get("headers", {})
    params = config.get("params", {})

    resp = requests.get(endpoint, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _traverse(obj: Any, segments: List[str]) -> List[Any]:
    if obj is None:
        return []
    if not segments:
        # reached leaf - return the object itself
        return [obj]

    seg = segments[0]
    rest = segments[1:]

    # handle array indicator 'key[]'
    if seg.endswith("[]"):
        key = seg[:-2]
        results = []
        # if current obj is dict, get the list by key
        if isinstance(obj, dict):
            arr = obj.get(key, [])
            if not isinstance(arr, list):
                return []
            for item in arr:
                results.extend(_traverse(item, rest))
            return results
        # if current obj is list, iterate items and apply key on each
        if isinstance(obj, list):
            for item in obj:
                if isinstance(item, dict):
                    arr = item.get(key, [])
                    if isinstance(arr, list):
                        for it in arr:
                            results.extend(_traverse(it, rest))
            return results
        return []

    # normal key name (may contain hyphens)
    key = seg
    results = []
    if isinstance(obj, dict):
        next_obj = obj.get(key)
        return _traverse(next_obj, rest)
    if isinstance(obj, list):
        for item in obj:
            results.extend(_traverse(item, segments))
        return results
    return []


def extract_field(data: dict, path: str) -> List[Any]:
    # path examples: data.filteredProducts.products[].Name
    segments = path.split(".")
    return _traverse(data, segments)


def main(config_path: str, csv_path: Optional[str] = None):
    config = load_config(config_path)
    print(f"Loaded config from {config_path}")

    print("Sending request...")
    resp_json = send_request(config)

    selected = config.get("selected_fields", [])
    output = {}
    columns_values = []
    for field in selected:
        values = extract_field(resp_json, field)
        # stringify complex types for CSV
        norm = [v if isinstance(v, (str, int, float, bool)) or v is None else json.dumps(v, ensure_ascii=False) for v in values]
        columns_values.append(norm)
        output[field] = values

    # print JSON to stdout
    print(json.dumps(output, indent=2, ensure_ascii=False))

    # optionally write CSV where each column is one selected field
    if csv_path:
        header = selected
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(header)
            for row in zip_longest(*columns_values, fillvalue=""):
                writer.writerow(row)
        print(f"Wrote CSV to {csv_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run scraper with config and optional CSV output")
    parser.add_argument("config", help="Path to config JSON (e.g. test.json)")
    parser.add_argument("--csv", dest="csv", help="Path to output CSV file", default=None)
    args = parser.parse_args()
    try:
        main(args.config, args.csv)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(2)
