# Oil/Rush - Opinet Remix

Next.js / React 기반의 Opinet 리믹스 웹앱입니다. 브라우저 위치 권한을 사용해 주변 주유소 5곳을 최저가순으로 보여주고, 오피넷 전국/지역 최저가 TOP10, 국내 평균 유가, 국제 유가, 유가 관련 세계 뉴스를 함께 보여줍니다.

## Local run

```bash
npm install
npm run dev
```

## Vercel deploy

Vercel에서 저장소를 연결한 뒤 Framework Preset은 `Next.js`로 두면 됩니다.

실제 Opinet 데이터를 쓰려면 Environment Variables에 아래 키를 추가합니다.

```bash
OPINET_CERTKEY=발급받은_오피넷_API_인증키
```

로컬에서는 `.env.example`을 참고해 `.env.local`에 같은 값을 넣으면 됩니다.

키가 없거나 외부 API 호출이 실패하면 앱은 데모 데이터로 자동 전환하고 화면의 데이터 배지를 `DEMO` 또는 `FALLBACK`으로 표시합니다.

### Deploy checklist

- `.env.local`은 저장소에 올리지 않습니다.
- Vercel Project Settings > Environment Variables에 `OPINET_CERTKEY`를 등록합니다.
- Build Command는 기본값인 `npm run build`를 사용합니다.
- Install Command는 기본값인 `npm install`을 사용합니다.
- Node.js는 `package.json`의 `engines` 기준인 `>=20.9.0`을 사용합니다.
- 위치 갱신 기능은 HTTPS 배포 환경에서 정상 동작합니다.
- 지도 타일과 위치명 변환은 OpenStreetMap/Nominatim을 사용하므로 공개 트래픽이 커지면 상용 지도/지오코딩 provider로 교체를 검토합니다.

## Data routes

- `/api/oil/stations`: Opinet 반경 내 주유소 검색, 주변 5개 최저가순
- `/api/oil/areas`: Opinet 시도 지역코드 목록, `area=01`처럼 상위 지역코드를 넣으면 시군구 목록
- `/api/oil/lowest`: Opinet 전국/지역 최저가 TOP20 데이터, 기본 TOP10
- `/api/oil/averages`: Opinet 전국 평균가격
- `/api/oil/global`: WTI/Brent 시세와 Dubai/OPEC 데모 보조 데이터
- `/api/oil/news`: Google News RSS 기반 유가 뉴스
