"""hello.py — gpt-4o 와 첫 통신.
환경 셋업이 잘 됐는지 확인하는 자리.
"""

from dotenv import load_dotenv
from openai import OpenAI

# .env 파일에 박힌 OPENAI_API_KEY 를 프로세스 환경변수로 로드한다.
# OpenAI client 생성보다 먼저 호출해야 키가 자동 인식된다.
load_dotenv()

# client 인스턴스 — 인자 없이 만들면 OPENAI_API_KEY 환경변수를 자동으로 읽는다.
client = OpenAI()


def main():
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "안녕"},
        ],
    )
    # 응답에서 실제 텍스트만 추출 — response.choices[0].message.content 자리.
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()