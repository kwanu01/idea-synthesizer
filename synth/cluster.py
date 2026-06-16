"""cluster.py — KMeans + 자동 K 탐색.
4 지표 평가로 데이터에 자연스러운 K 를 찾는다.
"""

from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import (
    silhouette_score,
    davies_bouldin_score,
    calinski_harabasz_score,
)
from sklearn.metrics.pairwise import cosine_distances


def cluster_embeddings(
    embeddings: np.ndarray,
    k: int,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """명시적 k 로 클러스터링."""
    km = KMeans(n_clusters=k, random_state=random_state, n_init=10)
    labels = km.fit_predict(embeddings)
    return labels, km.cluster_centers_


def evaluate_k(
    embeddings: np.ndarray,
    k: int,
    random_state: int = 42,
) -> dict:
    """주어진 k 의 클러스터링 품질을 4 지표로 평가."""
    km = KMeans(n_clusters=k, random_state=random_state, n_init=10)
    labels = km.fit_predict(embeddings)

    # 코사인 거리 기반 silhouette — 임베딩 벡터에 더 적합
    cos_dist = cosine_distances(embeddings)
    sil = float(silhouette_score(cos_dist, labels, metric="precomputed"))

    db = float(davies_bouldin_score(embeddings, labels))
    ch = float(calinski_harabasz_score(embeddings, labels))
    inertia = float(km.inertia_)

    return {
        "k": k,
        "silhouette": sil,
        "davies_bouldin": db,
        "calinski_harabasz": ch,
        "inertia": inertia,
        "labels": labels,
        "centroids": km.cluster_centers_,
    }


def find_best_k(
    embeddings: np.ndarray,
    k_range: tuple[int, int] = (2, 10),
    random_state: int = 42,
) -> tuple[int, list[dict]]:
    """K 범위 안에서 모두 시도하고 종합 점수 최고의 k 반환."""
    k_min, k_max = k_range
    k_max = min(k_max, embeddings.shape[0] - 1)

    reports = []
    for k in range(k_min, k_max + 1):
        report = evaluate_k(embeddings, k, random_state)
        reports.append(report)
        print(
            f"K={k:2d}  sil={report['silhouette']:+.3f}  "
            f"db={report['davies_bouldin']:.3f}  "
            f"ch={report['calinski_harabasz']:7.2f}  "
            f"inertia={report['inertia']:.2f}"
        )

    # 종합 점수 — 세 지표를 0~1 로 정규화 후 가중 평균
    def normalize(values, higher_better=True):
        arr = np.array(values)
        lo, hi = arr.min(), arr.max()
        if hi - lo < 1e-9:
            return [0.5] * len(values)
        n = (arr - lo) / (hi - lo)
        return n.tolist() if higher_better else (1 - n).tolist()

    sil_n = normalize([r["silhouette"] for r in reports], higher_better=True)
    db_n = normalize([r["davies_bouldin"] for r in reports], higher_better=False)
    ch_n = normalize([r["calinski_harabasz"] for r in reports], higher_better=True)

    composite = [0.4 * sil_n[i] + 0.3 * db_n[i] + 0.3 * ch_n[i] for i in range(len(reports))]
    best_idx = int(np.argmax(composite))
    best_k = reports[best_idx]["k"]

    return best_k, reports


if __name__ == "__main__":
    from embed import embed_texts

    # 12 문장 — 세 주제, 각 4 문장
    texts = [
        # 백남준 사상
        "매체가 자기 작동을 드러내야 한다",
        "기술이 사람과 친숙해진다",
        "관객이 작품을 완성한다",
        "예술과 기술의 융합이 새 형식을 낳는다",
        # 경제
        "주식 시장이 하락세를 보인다",
        "금리가 인상되면 채권 가격이 떨어진다",
        "환율 변동이 수출 기업에 영향을 준다",
        "인플레이션이 소비 심리를 위축시킨다",
        # 요리
        "마늘과 양파를 먼저 볶아 풍미를 낸다",
        "오븐을 예열하고 베이킹 시트에 종이를 깐다",
        "밀가루와 버터를 1:1 비율로 섞어 루를 만든다",
        "고기는 굽기 30분 전 실온에 꺼내 둔다",
    ]

    print("--- 임베딩 ---")
    emb = embed_texts(texts)
    print(f"shape: {emb.shape}")

    print()
    print("--- K 탐색 (2..6) ---")
    best_k, reports = find_best_k(emb, k_range=(2, 6))

    print()
    print(f">>> 자동 선택 K = {best_k}")

    print()
    print("--- 선택된 K 의 클러스터별 문장 ---")
    best_report = reports[best_k - 2]  # k_min=2 이므로 인덱스 보정
    for cid in range(best_k):
        print(f"\n[cluster {cid}]")
        for i, label in enumerate(best_report["labels"]):
            if label == cid:
                print(f"  · {texts[i]}")