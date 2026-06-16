"""build.py — 에이전트 한 장을 처음부터 끝까지 생성하는 CLI.

사용법:
    python3 synth/build.py <id> --corpus <path> [--label LABEL] [--k K]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from embed import embed_texts
from cluster import find_best_k, cluster_embeddings
from name import representative_samples, name_axes
from save import build_agent, save_agent


def load_corpus(path: Path) -> list[str]:
    """JSONL 파일에서 텍스트 추출. 각 줄이 {"text": "..."} 형식."""
    texts = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if "text" in obj:
                texts.append(obj["text"])
    return texts


def main() -> int:
    parser = argparse.ArgumentParser(description="에이전트 한 장 생성")
    parser.add_argument("id", help="에이전트 ID (예: paik, test)")
    parser.add_argument("--corpus", required=True, help="JSONL 코퍼스 파일 경로")
    parser.add_argument("--label", default="UNNAMED", help="에이전트 표시 라벨")
    parser.add_argument("--subtitle", default="", help="에이전트 부제")
    parser.add_argument("--color", default="#ec4899", help="에이전트 시그니처 색")
    parser.add_argument("--name-hint", help="gpt-4o 명명 시 주제 이름 (기본: id)")
    parser.add_argument("--k", type=int, help="명시적 K (자동 탐색 우회)")
    args = parser.parse_args()

    corpus_path = Path(args.corpus)
    if not corpus_path.exists():
        print(f"[error] 코퍼스 파일 없음: {corpus_path}", file=sys.stderr)
        return 1

    print(f"\n=== 에이전트 생성: {args.id} ===\n")

    # 1. 코퍼스 로드
    texts = load_corpus(corpus_path)
    print(f"[1/4] 코퍼스 로드 — {len(texts)} 샘플")

    # 2. 임베딩
    print(f"\n[2/4] 임베딩 ...")
    emb = embed_texts(texts)
    print(f"    shape: {emb.shape}")

    # 3. 클러스터링
    print(f"\n[3/4] 클러스터링 ...")
    if args.k:
        labels, centroids = cluster_embeddings(emb, k=args.k)
        best_k = args.k
        k_metrics = {"selected_explicitly": True}
    else:
        best_k, reports = find_best_k(emb, k_range=(2, 10))
        best = reports[best_k - 2]
        labels = best["labels"]
        centroids = best["centroids"]
        k_metrics = {
            "silhouette": best["silhouette"],
            "davies_bouldin": best["davies_bouldin"],
            "calinski_harabasz": best["calinski_harabasz"],
        }
    print(f"    K = {best_k}")

    # 4. 자동 명명
    print(f"\n[4/4] gpt-4o 자동 명명 ...")
    rep_samples = representative_samples(emb, labels, centroids, texts, top_n=3)
    axes = name_axes(args.name_hint or args.id, rep_samples)
    for ax in axes:
        print(f"    · {ax['key']:24s} {ax['label_ko']:10s} {ax['color']}")

    # 5. 에이전트 dict 빌드 + 저장
    agent = build_agent(
        agent_id=args.id,
        label=args.label,
        subtitle=args.subtitle,
        color=args.color,
        texts=texts,
        embeddings=emb,
        labels=labels,
        centroids=centroids,
        axes_meta=axes,
        k_metrics=k_metrics,
    )

    out_path = Path("public/agents") / f"{args.id}.agent.json"
    saved = save_agent(agent, out_path)
    print(f"\n=== 완료 — {saved} ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())