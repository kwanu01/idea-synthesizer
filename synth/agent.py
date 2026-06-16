"""agent.py — 에이전트 JSON 로드 + 메모리 캐시.
서버가 시작될 때 한 번 로드된 에이전트는 메모리에 남아 재사용된다.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


# 에이전트 ID → 로드된 dict 의 캐시. 서버가 살아있는 동안 유지됨.
_cache: dict[str, dict] = {}


def load_agent(agent_id: str) -> dict:
    """에이전트 JSON 을 로드해 dict 로 반환. 캐시 활용.

    centroid 자리를 numpy 배열로 사전 변환해 _centroid_np 키에 박는다 —
    매 요청마다 list → numpy 변환을 피하기 위한 자리.
    """
    if agent_id in _cache:
        return _cache[agent_id]

    path = Path("public/agents") / f"{agent_id}.agent.json"
    if not path.exists():
        raise FileNotFoundError(f"에이전트 없음: {agent_id} (경로: {path})")

    with open(path, "r", encoding="utf-8") as f:
        cart = json.load(f)

    # centroid 를 numpy 로 한 번에 변환 (로드 시 한 번만)
    for ax in cart.get("axes", []):
        ax["_centroid_np"] = np.array(ax["centroid"], dtype=np.float32)

    _cache[agent_id] = cart
    return cart


def invalidate(agent_id: str) -> None:
    """굽기 직후 호출 — 다음 load_agent 가 디스크의 새 JSON 을 읽게 한다."""
    _cache.pop(agent_id, None)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """두 벡터의 코사인 유사도. -1 ~ +1 사이."""
    return float(
        np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)
    )