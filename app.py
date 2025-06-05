import requests
from flask import Flask, request, jsonify

# Flask 앱을 생성합니다.
# static_folder='.'는 현재 폴더(.)에 있는 파일들을 static 파일로 제공하겠다는 의미입니다.
app = Flask(__name__, static_url_path='', static_folder='.')

# 외부 API의 기본 주소
API_BASE_URL = 'https://pestapi.epinet.kr/api/v1'


@app.route('/')
def index():
    """
    루트 URL('/')로 접속하면 index.html 파일을 제공합니다.
    """
    return app.send_static_file('index.html')


@app.route('/api/<path:subpath>')
def proxy(subpath):
    """
    '/api/...'로 시작하는 모든 요청을 대신 처리(프록시)하는 라우트입니다.
    CORS 문제를 해결하기 위한 핵심 로직입니다.
    """
    # 1. 클라이언트가 보낸 쿼리 파라미터(apiKey, latitude 등)를 그대로 가져옵니다.
    params = request.args.to_dict()

    # 2. 실제 외부 API 서버로 보낼 전체 URL을 생성합니다.
    # 예: /api/weather/daly -> https://pestapi.epinet.kr/api/v1/weather/daly
    api_url = f"{API_BASE_URL}/{subpath}"

    try:
        # 3. 'requests' 라이브러리를 사용해 실제 API 서버에 요청을 보냅니다.
        response = requests.get(api_url, params=params)

        # 4. 외부 API의 응답이 에러인 경우, 해당 에러를 클라이언트에게도 전달합니다.
        response.raise_for_status()

        # 5. 성공적인 응답(JSON)을 클라이언트에게 그대로 전달합니다.
        return jsonify(response.json())

    except requests.exceptions.HTTPError as err:
        # HTTP 에러 상태 코드를 그대로 반환
        return jsonify(error=str(err)), err.response.status_code
    except requests.exceptions.RequestException as err:
        # 그 외 요청 관련 에러 (네트워크 문제 등)
        return jsonify(error=str(err)), 500


if __name__ == '__main__':
    # 서버를 8000 포트로 실행합니다. debug=True는 개발 중 코드 변경 시 자동 재시작을 위함입니다.
    app.run(debug=True, port=8000)