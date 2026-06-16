# Idea Synthesizer

생각을 신디사이저처럼 조작하는 아이디어 워크스테이션. 텍스트를 사고 단위 노드로 분해하고, 이펙터로 변형하고, 한 편의 글로 종합한다. 평가·변형의 기준이 되는 "에이전트"(실제 인물의 글로 학습한 페르소나)를 갈아 끼울 수 있다.

- **프론트엔드**: React 19 + Vite (정적 빌드)
- **백엔드**: Python 표준 라이브러리 `http.server` + OpenAI API (gpt-4o · 임베딩 · gpt-image-1)

---

## 로컬 실행

```bash
# 1) 백엔드 (터미널 1)
cd MAIN
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "OPENAI_API_KEY=sk-..." > .env      # 본인 키
python3 synth/server.py                  # http://localhost:8000

# 2) 프론트엔드 (터미널 2)
cd MAIN
npm install
npm run dev                              # http://localhost:5173 (/api → :8000 프록시)
```

---

## 링크로 배포 (프론트 = Vercel, 백엔드 = Render)

> 이 앱은 정적 파일만으로는 동작하지 않는다. OpenAI를 호출하는 **백엔드가 실행 중**이어야 한다.
> 구조: 브라우저 → (Vercel 정적 프론트, `/api/*`를 백엔드로 rewrite) → (Render의 Python 백엔드) → OpenAI.

### 1단계 · 백엔드 (Render)

1. 이 저장소를 GitHub에 올린다(아래 "GitHub에 올리기").
2. [Render](https://render.com) → **New → Blueprint** → 이 저장소 선택. `render.yaml`을 자동 인식한다.
3. 환경변수 **`OPENAI_API_KEY`**에 본인 키를 입력(저장소엔 절대 넣지 않는다).
4. 배포되면 주소가 나온다 — 예: `https://idea-synthesizer-api.onrender.com`.

### 2단계 · 프론트엔드 (Vercel)

1. `vercel.json`의 `destination`을 1단계에서 받은 **백엔드 주소**로 바꾼다:
   ```json
   { "source": "/api/:path*", "destination": "https://idea-synthesizer-api.onrender.com/api/:path*" }
   ```
2. [Vercel](https://vercel.com) → **New Project** → 이 저장소 선택 → 배포.
   (Root Directory가 저장소 루트이면 그대로, `npm run build` / 출력 `dist`)
3. 나오는 주소가 **공유용 링크**다 — 누구나 이 링크로 브라우저에서 바로 사용.

> Netlify로 한다면 rewrite는 `netlify.toml`에:
> ```toml
> [[redirects]]
>   from = "/api/*"
>   to = "https://idea-synthesizer-api.onrender.com/api/:splat"
>   status = 200
> ```

---

## ⚠️ 비용·보안 (본인 키로 운영하므로 꼭 읽기)

- **링크를 받은 사람의 모든 호출이 당신의 OpenAI 크레딧에서 빠진다.** 공개 시 비용이 빠르게 늘 수 있다.
- **반드시** OpenAI 대시보드 → Billing → **월 한도(Usage limit)** 를 낮게 걸어 둘 것. 이게 가장 확실한 안전장치다.
- **API 키를 저장소·프론트엔드에 넣지 말 것.** 항상 호스팅(Render)의 환경변수로만 둔다. `.gitignore`가 `.env`를 제외한다.
- 무료 Render는 일정 시간 미사용 시 잠들어 첫 요청이 30~60초 느릴 수 있다(콜드 스타트).
- 무료 호스팅의 디스크는 휘발성이라, 사용자가 만든 에이전트(`/api/build-agent` 결과)는 재시작 시 사라질 수 있다. 기본 제공 에이전트는 저장소에 포함되어 유지된다.

---

## GitHub에 올리기

```bash
cd MAIN
git init
git add .
git commit -m "Idea Synthesizer"
git branch -M main
git remote add origin https://github.com/<your-id>/idea-synthesizer.git
git push -u origin main
```

`.env`, `node_modules/`, `venv/`, `cache/`, `dist/`는 `.gitignore`로 제외된다. 푸시 전에 `git status`로 `.env`가 목록에 없는지 반드시 확인할 것.
