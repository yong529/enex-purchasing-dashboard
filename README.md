# 🏢 ENEX 구매본부 실시간 관제 대시보드

에넥스(ENEX) 구매부 임직원(차장, 과장, 대리, 주임)을 위한 반응형 업무 관리 & 마감일 캘린더 대시보드입니다.

---

## 🚀 주요 기능

1. **상단 개인화 관제 영역 (내 계정 로그인 뷰)**
   - 로그인된 계정(차장, 과장, 대리 등)에 따라 본인에게 하달된 긴급 지시사항 및 마감 임박 업무 자동 요약.
2. **지시사항 하달 (Directives)**
   - 발신자 & 수신 대상(특정 담당자 또는 구매부 전원)을 지정하여 실시간 긴급 지시 하달 및 확인 완료 추적.
3. **구매부 5인 조직도 아코디언 드롭다운**
   - 각 인원(차장, 과장, 대리, 주임)을 클릭하면 아래로 할 일 목록과 즉시 추가 입력창이 드롭다운으로 펼쳐짐.
   - ✏️ 버튼을 눌러 직급, 성명, 담당 업무 역할을 브라우저에서 직접 수정 가능.
4. **하단 풀 와이드 마감일 캘린더**
   - 모든 업무의 마감일이 달력에 담당자 컬러 배지로 표시되며, 날짜 클릭 시 해당 일정 자동 필터링.
5. **Netlify + Supabase Jamstack 지원**
   - Netlify 무료 정적 호스팅(무중단 24시간 가동) 및 Supabase 클라우드 DB 실시간 웹소켓(WebSocket) 연동 지원.

---

## 🛠️ 배포 및 실행 방법

### 방법 1: Netlify 배포 (추천 ⭐)
1. [Netlify](https://www.netlify.com)에 로그인합니다.
2. **[Add new site]** &rarr; **[Import an existing project]** 클릭.
3. GitHub를 선택하고 `enex-purchasing-dashboard` 저장소를 선택합니다.
4. Publish directory가 `public`으로 자동 감지되면 **[Deploy]** 클릭!
5. 10초 만에 상용 웹 주소(`https://xxxx.netlify.app`)가 생성되어 언제 어디서나 스마트폰/PC로 접속할 수 있습니다.

### 방법 2: Supabase 클라우드 실시간 DB 연동
1. [Supabase](https://supabase.com)에서 무료 프로젝트를 생성합니다.
2. 좌측 메뉴 **[SQL Editor]**에 들어가서 본 저장소의 `supabase_schema.sql` 내용을 붙여넣고 **[Run]**을 누릅니다.
3. 배포된 Netlify 사이트 우측 상단 **[⚡ Supabase 배포 안내]** 버튼을 누르고, 본인 프로젝트의 **Project URL**과 **Anon Key**를 입력하면 즉시 클라우드 실시간 동기화로 전환됩니다!

### 방법 3: 로컬 컴퓨터에서 실행
```bash
# 윈도우 환경: start.bat 더블 클릭!

# 또는 터미널 실행:
npm install
node server.js
# 브라우저에서 http://localhost:3000 접속
```
