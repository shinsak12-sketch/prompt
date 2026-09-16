# 창립 42주년 기념식 사회자 프롬프터

TV 화면에 사회자 대사를 연속 스크롤로 띄우는 방송 촬영용 프롬프터. 정적 사이트(HTML/CSS/JS)라 빌드 없이 Vercel에 바로 배포됨.

## 구조

```
public/
  index.html        촬영 모드 + 편집 모드 화면
  css/app.css       스타일
  js/app.js         스크롤 엔진 · 조작 · 편집 모드
  js/script-data.js 대본 데이터 (docx → JSON 변환본)
vercel.json         정적 호스팅 설정
docs/design.html    설계서 (v1 진단 · 벤치마킹 · v2 설계)
```

## Vercel 배포

- Framework Preset: **Other**, Root Directory: 저장소 루트, Output Directory: `public`
- 빌드 명령 없음. 저장소 연결 후 push마다 자동 배포.

## 촬영 모드 조작

| 키 | 동작 |
|---|---|
| `Space` · 클릭 | 정지 / 재개 |
| `↑` `↓` | 속도 +1 / −1 (1~20단계) |
| `←` `→` | 이전 / 다음 대사 시작으로 |
| `Shift+↑↓` · 휠 | 한 줄 넛지 |
| `Backspace` | 마지막 재생 시작점으로 |
| `1`~`8` | 식순 #1~#8 이동 |
| `Home` `End` | 대본 처음 / 끝 |
| `+` `−` | 글자 크기 |
| `C` | 3초 카운트다운 후 시작 |
| `B` | 블랭크 |
| `F` `M` `H` | 전체화면 / 미러 / HUD 고정 |
| `E` | 편집 모드 |
| `Esc` | 즉시 정지 |
| 클리커 `PgDn` `PgUp` | 설정에서 흐름 모드(정지·재개 / 한 줄 되감기) 또는 대사 모드 선택 |

- 「영상 송출」이 들어간 큐는 HOLD로 표시되고, 읽기선에 닿으면 자동 정지함. `Space`로 재개.
- 운영자 컨트롤 바와 HUD는 마우스가 3초 멈추면 사라짐.
- 설정·대사 수정·HOLD 여부는 브라우저 `localStorage`에 저장됨. 다른 PC로 옮길 때는 편집 모드의 JSON 내보내기/가져오기 사용.

## 대본 교체

`public/js/script-data.js`의 `items` 배열을 수정. 각 항목은 `speaker`, `text`, `section`, `before[]`(식순 제목·큐, 큐는 `hold` 플래그) 필드를 가짐.
