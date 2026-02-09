# TETMEER - Supabase Google OAuth 설정 가이드

## 1. Google Cloud Console 설정

### 1-1. OAuth 2.0 클라이언트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **APIs & Services** → **Credentials** 이동
3. **+ CREATE CREDENTIALS** → **OAuth client ID** 클릭
4. Application type: **Web application**
5. Name: `TETMEER`

### 1-2. Redirect URI 설정
**Authorized redirect URIs**에 추가:
```
https://ofxlhqwlwflgskjzjykv.supabase.co/auth/v1/callback
```

> Supabase가 OAuth 콜백을 받는 URL입니다. 프로젝트 ref가 다르면 URL도 변경하세요.

6. **CREATE** 클릭 → **Client ID**와 **Client Secret** 복사해둡니다.

---

## 2. Supabase Dashboard 설정

### 2-1. Google Provider 활성화
1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **Providers** 이동
3. **Google** 클릭 → 토글 활성화
4. 입력:
   - **Client ID**: Google Console에서 복사한 Client ID
   - **Client Secret**: Google Console에서 복사한 Client Secret
5. **Save** 클릭

### 2-2. Redirect URL 설정
1. **Authentication** → **URL Configuration** 이동
2. **Site URL** 설정:
   - 개발환경: `http://localhost:5000`
   - 프로덕션: 실제 도메인 URL
3. **Redirect URLs**에 추가:
   ```
   http://localhost:5000/api/auth/callback
   ```
   프로덕션 배포 시 추가:
   ```
   https://your-production-domain.com/api/auth/callback
   ```

---

## 3. 환경변수 확인

`.env` 파일에 다음 값이 설정되어 있는지 확인:

```env
SUPABASE_URL=https://ofxlhqwlwflgskjzjykv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (Dashboard → Settings → API → service_role key)
VITE_SUPABASE_URL=https://ofxlhqwlwflgskjzjykv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...    (Dashboard → Settings → API → anon key)
```

---

## 4. 로그인 플로우 테스트

1. `npm run dev` 실행
2. 브라우저에서 `http://localhost:5000` 접속
3. 로그인 버튼 클릭 → Google OAuth 화면으로 리다이렉트
4. Google 계정 선택 → `/api/auth/callback`으로 리다이렉트
5. 자동으로 메인 페이지로 이동, 로그인 상태 확인

---

## 5. 트러블슈팅

### "redirect_uri_mismatch" 에러
- Google Console의 Authorized redirect URIs에 Supabase callback URL이 정확히 등록되어있는지 확인
- `https://ofxlhqwlwflgskjzjykv.supabase.co/auth/v1/callback`

### 로그인 후 세션이 유지되지 않음
- `.env`의 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 올바른지 확인
- 브라우저 DevTools → Application → Local Storage에서 Supabase 세션 토큰 확인

### "Invalid API key" 에러
- `SUPABASE_SERVICE_ROLE_KEY`가 서버용 service_role key인지 확인 (anon key 아님)
- `VITE_SUPABASE_ANON_KEY`가 클라이언트용 anon key인지 확인
