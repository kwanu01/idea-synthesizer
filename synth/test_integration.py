"""test_integration.py — 백엔드 통합 테스트.

서버가 띄워진 상태에서 실행하면 모든 라우트를 순서대로 호출해 결과를 보여준다.

사용법:
  터미널 1:  python3 synth/server.py
  터미널 2:  python3 synth/test_integration.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request


BASE = "http://localhost:8000"


def _print_section(title: str) -> None:
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def _get(path: str) -> dict:
    req = urllib.request.Request(f"{BASE}{path}")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def _post(path: str, body: dict) -> dict:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def test_health():
    _print_section("1. /api/health — 서버 살아있음 확인")
    result = _get("/api/health")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    assert result.get("ok") is True


def test_quality():
    _print_section("2. /api/quality — 에이전트 평가")
    inputs = [
        "매체가 자기 작동을 드러낸다",
        "환율이 급등했다",
        "재료를 미리 손질해 둔다",
    ]
    for text in inputs:
        print(f"\n[입력] {text}")
        result = _post("/api/quality", {"text": text, "agentId": "test"})
        scores = result.get("scores", {})
        sorted_scores = sorted(scores.items(), key=lambda x: -x[1])
        for axis, score in sorted_scores:
            mark = "  ←" if axis == sorted_scores[0][0] else ""
            print(f"  {axis:30s} {score:.3f}{mark}")


def test_analyze():
    _print_section("3. /api/analyze — AI 분석 + 합성 모드 추천")
    text = (
        "AI 가 디자인을 자동화하면 디자이너 일자리가 줄어들까? "
        "일부는 AI 도구를 받아들였다. 새 직업 프롬프트 엔지니어도 생겼다. "
        "결국 역할이 바뀌는 자리다."
    )
    print(f"\n[입력] {text}\n")
    result = _post("/api/analyze", {"text": text, "agentId": "test"})

    print(f"[노드 {len(result['nodes'])}]")
    for n in result["nodes"]:
        print(f"  · [{n['type']:12s}] [{n['synthesisMode']:14s}] {n['title']}")
        print(f"      {n['content'][:80]}")
        print(f"      이유: {n['synthesisReason']}")

    print(f"\n[엣지 {len(result['edges'])}]")
    for e in result["edges"]:
        print(f"  · {e['from']} -[{e['relationType']}]-> {e['to']}")


def test_apply_effects_single():
    _print_section("4. /api/apply-effects — 단일 이펙터")
    body = {
        "text": "AI 가 디자인을 자동화한다",
        "effects": [
            {
                "id": "fx-1",
                "kind": "perspective",
                "controls": {"leap": 0.6, "vary": 0, "mix": 0.5},
            }
        ],
    }
    print(f"\n[원본] {body['text']}\n")
    result = _post("/api/apply-effects", body)
    for stage in result["stages"]:
        print(f"[{stage['kind'].upper()}]")
        for knob, meta in stage["selected"].items():
            print(f"  [{knob}] {meta['label']}")
        print(f"  → {stage['text']}")


def test_apply_effects_chain():
    _print_section("5. /api/apply-effects — 이펙터 체인 (3 단계)")
    body = {
        "text": "AI 가 디자인을 자동화한다",
        "effects": [
            {"id": "fx-1", "kind": "perspective", "controls": {"leap": 0.6, "vary": 0, "mix": 0.5}},
            {"id": "fx-2", "kind": "contradict", "controls": {"leap": 0.4, "vary": 0, "mix": 0.5}},
            {"id": "fx-3", "kind": "abstraction", "controls": {"direction": 0.7, "vary": 0, "mix": 0.5}},
        ],
    }
    print(f"\n[원본] {body['text']}\n")
    result = _post("/api/apply-effects", body)
    for i, stage in enumerate(result["stages"]):
        print(f"[{i+1}단계: {stage['kind'].upper()}]")
        for knob, meta in stage["selected"].items():
            print(f"  [{knob}] {meta['label']}")
        print(f"  → {stage['text']}")
        print()
    print(f"\n[최종]\n{result['finalText']}")


def test_consequence_split():
    _print_section("6. /api/consequence-split — INFER 갈래 (방향·도약·믹스)")
    text = "AI 가 디자인을 자동화한다"
    for direction, leap, mix in [("forward", 0.2, 0.3), ("forward", 0.8, 0.8), ("backward", 0.5, 0.5)]:
        print(f"\n[입력] {text}  (dir={direction}, leap={leap}, mix={mix})")
        result = _post("/api/consequence-split", {
            "text": text, "agentId": "test", "direction": direction, "leap": leap, "mix": mix,
        })
        for n in result.get("nodes", []):
            print(f"  · [{n['type']}] {n['title']}  — {n['content'][:80]}")


def main():
    try:
        test_health()
        test_quality()
        test_analyze()
        test_apply_effects_single()
        test_apply_effects_chain()
        test_consequence_split()
        _print_section("✓ 모든 자리 통과")
    except urllib.error.URLError as e:
        print(f"\n[error] 서버 연결 실패: {e}")
        print(f"        먼저 다른 터미널에서 python3 synth/server.py 실행하세요.")
        sys.exit(1)
    except AssertionError as e:
        print(f"\n[error] 검증 실패: {e}")
        sys.exit(2)
    except Exception as e:
        print(f"\n[error] {type(e).__name__}: {e}")
        sys.exit(3)


if __name__ == "__main__":
    main()