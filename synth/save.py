"""save.py — 에이전트 JSON 직렬화 + 디스크 저장.
모든 단계의 산출물을 하나의 dict 로 합쳐 JSON 파일로 저장.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


def build_agent(
    agent_id: str,
    label: str,
    subtitle: str,
    color: str,
    texts: list[str],
    embeddings: np.ndarray,
    labels: np.ndarray,
    centroids: np.ndarray,
    axes_meta: list[dict],
    k_metrics: dict,
) -> dict:
    """모든 자리의 산출물을 합쳐 에이전트 dict 를 만든다."""
    n = len(texts)
    k = centroids.shape[0]
    embedding_dim = int(embeddings.shape[1])

    # 각 축의 메타 + centroid + 소속 샘플 수 + 대표 샘플
    axes_out = []
    for cid in range(k):
        meta = axes_meta[cid] if cid < len(axes_meta) else {}
        cluster_indices = [i for i, lab in enumerate(labels) if lab == cid]

        # 대표 샘플 — 중심에 가까운 top 3
        center = centroids[cid]
        sims = []
        for idx in cluster_indices:
            vec = embeddings[idx]
            sim = float(
                np.dot(vec, center)
                / (np.linalg.norm(vec) * np.linalg.norm(center) + 1e-9)
            )
            sims.append((sim, idx))
        sims.sort(reverse=True)
        rep_samples = [texts[idx] for _, idx in sims[:3]]

        axes_out.append({
            "key": meta.get("key", f"axis_{cid}"),
            "label_ko": meta.get("label_ko", f"축 {cid + 1}"),
            "label_en": meta.get("label_en", f"Axis {cid + 1}"),
            "description": meta.get("description", ""),
            "color": meta.get("color", "#888888"),
            "centroid": centroids[cid].astype(float).tolist(),
            "n_samples": len(cluster_indices),
            "representative_samples": rep_samples,
        })

    # 모든 샘플의 자리 — 어느 축에 속하는지 라벨 박음
    samples_out = []
    for i, text in enumerate(texts):
        axis_key = axes_out[int(labels[i])]["key"]
        samples_out.append({
            "text": text,
            "axis": axis_key,
        })

    agent = {
        "id": agent_id,
        "label": label,
        "subtitle": subtitle,
        "color": color,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "embedding_model": "text-embedding-3-small",
        "embedding_dim": embedding_dim,
        "n_samples": n,
        "k_selected": k,
        "k_metrics": k_metrics,
        "axes": axes_out,
        "samples": samples_out,
    }
    return agent


def save_agent(agent: dict, out_path: Path | str) -> Path:
    """에이전트 dict 를 JSON 파일로 저장."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(agent, f, ensure_ascii=False, indent=2)
    return out_path