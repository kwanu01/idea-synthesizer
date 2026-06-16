"""embed.py — OpenAI 임베딩 + 디스크 캐시.
같은 문장은 두 번 임베딩하지 않는다 — SHA256 해시를 키로 .npz 파일에 저장.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CACHE_PATH = Path("cache/embeddings.npz")


def _hash(text: str) -> str:
    """문장 → SHA256 hex 문자열. 캐시 키로 사용."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _load_cache() -> dict[str, np.ndarray]:
    """캐시 파일이 있으면 dict 로 로드, 없으면 빈 dict."""
    if not CACHE_PATH.exists():
        return {}
    data = np.load(CACHE_PATH, allow_pickle=False)
    return {key: data[key] for key in data.files}


def _save_cache(cache: dict[str, np.ndarray]) -> None:
    """캐시 dict 를 .npz 파일로 저장."""
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    np.savez(CACHE_PATH, **cache)


def embed_texts(texts: list[str]) -> np.ndarray:
    """문장 리스트 → 의미 벡터 행렬 [N, 1536]. 캐시 활용."""
    cache = _load_cache()
    hashes = [_hash(t) for t in texts]

    # 캐시에 없는 자리만 추출 — (원래 인덱스, 문장) 쌍
    missing = [(i, t) for i, (h, t) in enumerate(zip(hashes, texts)) if h not in cache]

    if missing:
        missing_texts = [t for _, t in missing]
        print(f"[embed] 캐시 hit: {len(texts) - len(missing)}, 신규 호출: {len(missing)}")
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=missing_texts,
        )
        # 새 임베딩을 캐시에 추가 (원래 인덱스 기준으로 해시 찾아 매핑)
        for (orig_idx, _), item in zip(missing, response.data):
            vec = np.array(item.embedding, dtype=np.float32)
            cache[hashes[orig_idx]] = vec
        _save_cache(cache)
        print(f"[embed] 캐시 저장 → {CACHE_PATH}")
    else:
        print(f"[embed] 모든 문장이 캐시에서 로드됨 ({len(texts)} 자리)")

    # 입력 순서를 보존한 임베딩 행렬 반환
    vectors = [cache[h] for h in hashes]
    return np.array(vectors, dtype=np.float32)


if __name__ == "__main__":
    test_texts = [
        "매체가 자기 작동을 드러내야 한다",
        "관객의 개입이 곧 작품이다",
        "기술은 비빔밥처럼 동서양을 섞는다",
    ]

    print("--- 첫 호출 (모두 신규) ---")
    embeddings = embed_texts(test_texts)
    print(f"shape: {embeddings.shape}")

    print()
    print("--- 두 번째 호출 (모두 캐시) ---")
    embeddings2 = embed_texts(test_texts)
    print(f"shape: {embeddings2.shape}")

    print()
    print(f"두 호출 결과 동일: {np.allclose(embeddings, embeddings2)}")