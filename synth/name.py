"""name.py — gpt-4o 가 각 클러스터의 축 이름·설명·색을 자동 명명.
"""

from __future__ import annotations

import json
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()


def representative_samples(
    embeddings: np.ndarray,
    labels: np.ndarray,
    centroids: np.ndarray,
    texts: list[str],
    top_n: int = 3,
) -> list[list[str]]:
    """각 클러스터에서 중심에 가장 가까운 top_n 샘플을 추출.

    Returns:
        클러스터별 대표 샘플 리스트. 길이는 클러스터 수.
    """
    result: list[list[str]] = []
    for cluster_id in range(centroids.shape[0]):
        cluster_indices = np.where(labels == cluster_id)[0]
        if len(cluster_indices) == 0:
            result.append([])
            continue

        center = centroids[cluster_id]
        sims = []
        for idx in cluster_indices:
            vec = embeddings[idx]
            sim = float(
                np.dot(vec, center)
                / (np.linalg.norm(vec) * np.linalg.norm(center) + 1e-9)
            )
            sims.append((sim, int(idx)))

        sims.sort(reverse=True)
        top_indices = [idx for _, idx in sims[:top_n]]
        result.append([texts[i] for i in top_indices])

    return result


def name_axes(subject: str, rep_samples: list[list[str]]) -> list[dict]:
    """각 클러스터의 대표 샘플 → gpt-4o 가 축 이름·설명·색 자동 생성."""
    blocks = []
    for i, samples in enumerate(rep_samples):
        block = f"클러스터 {i + 1}:\n" + "\n".join(f"  - {s}" for s in samples)
        blocks.append(block)
    clusters_text = "\n\n".join(blocks)

    system_prompt = f"""당신은 데이터 분석으로 추출된 의미 그룹에 이름을 붙이는 도구입니다.
사용자가 "{subject}" 의 자료를 임베딩·클러스터링한 결과 {len(rep_samples)} 개의 의미 묶음이 나왔습니다.
각 묶음에 대해 다음을 결정합니다:

- key: snake_case 영문 키 (예: media_nature)
- label_ko: 한국어 라벨 (3~6자, 예: "매체의 본성")
- label_en: 영문 라벨 (제목 결, 예: "Media Nature")
- description: 한 줄 설명 (한국어, 30~60자)
- color: 시그니처 색상 hex (예: "#22d3ee")

JSON object 로 응답합니다:
{{
  "axes": [
    {{ "key": "...", "label_ko": "...", "label_en": "...", "description": "...", "color": "#..." }}
  ]
}}
"axes" 배열의 길이는 클러스터 수와 같아야 합니다."""

    user_prompt = f"""대상: {subject}
클러스터 수: {len(rep_samples)}

각 클러스터의 대표 샘플:

{clusters_text}

위 의미 묶음들을 분석해 JSON 으로 응답하세요."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    raw = response.choices[0].message.content or "{}"
    parsed = json.loads(raw)
    return parsed.get("axes", [])


if __name__ == "__main__":
    from embed import embed_texts
    from cluster import find_best_k

    texts = [
        "매체가 자기 작동을 드러내야 한다",
        "기술이 사람과 친숙해진다",
        "관객이 작품을 완성한다",
        "예술과 기술의 융합이 새 형식을 낳는다",
        "주식 시장이 하락세를 보인다",
        "금리가 인상되면 채권 가격이 떨어진다",
        "환율 변동이 수출 기업에 영향을 준다",
        "인플레이션이 소비 심리를 위축시킨다",
        "마늘과 양파를 먼저 볶아 풍미를 낸다",
        "오븐을 예열하고 베이킹 시트에 종이를 깐다",
        "밀가루와 버터를 1:1 비율로 섞어 루를 만든다",
        "고기는 굽기 30분 전 실온에 꺼내 둔다",
    ]

    print("--- 임베딩 + 클러스터링 ---")
    emb = embed_texts(texts)
    best_k, reports = find_best_k(emb, k_range=(2, 6))
    best = reports[best_k - 2]
    print(f"K = {best_k}")

    print()
    print("--- 대표 샘플 추출 ---")
    rep_samples = representative_samples(
        emb, best["labels"], best["centroids"], texts, top_n=2
    )
    for cid, samples in enumerate(rep_samples):
        print(f"\n[cluster {cid}]")
        for s in samples:
            print(f"  · {s}")

    print()
    print("--- gpt-4o 자동 명명 ---")
    axes = name_axes("다양한 주제 모음", rep_samples)
    for ax in axes:
        print(f"  · {ax['key']:24s} {ax['label_ko']:10s} {ax['label_en']:25s} {ax['color']}")
        print(f"      {ax['description']}")