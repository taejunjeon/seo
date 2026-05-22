# 구현 및 검증

## 변경 파일

| file | change |
|---|---|
| `backend/src/env.ts` | `META_CAPI_ENABLE_IMWEB_EMAIL_HASH` flag 추가 |
| `backend/src/metaCapi.ts` | Imweb 주문과 회원 테이블을 조인해 이메일 후보를 CAPI email 입력으로 전달 |

## 작동 방식

1. CAPI auto-sync가 confirmed Purchase 후보를 고른다.
2. biocom allowlist에 해당하는 경우에만 Imweb 주문 키로 `imweb_orders`를 찾는다.
3. `member_code`로 `imweb_members`를 조인한다.
4. 이메일이 있으면 원문을 저장하지 않고 `prepareMetaCapiSend`의 기존 SHA-256 email hash 경로로 넘긴다.
5. send log에는 원문이나 해시값이 아니라 `user_data_presence.em=true/false`만 남긴다.

## 로컬 검증

| command | result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run build` | PASS |
| `git diff --check -- backend/src/env.ts backend/src/metaCapi.ts` | PASS |
| raw identifier scan on changed files | PASS |

## VM Cloud 검증

| command / source | result |
|---|---|
| VM Cloud backend build | PASS |
| PM2 `seo-backend` restart | PASS |
| `https://att.ainativeos.net/health` | 200 OK |
| CAPI send log recent 24h | 68 Purchase / 68 success |
| CAPI send log since deploy | 1 Purchase / 1 success |

## 관측상 주의점

`/api/meta/health`는 Meta token health 경고를 반환했다. 다만 최근 24시간 CAPI Purchase send log는 68/68 success라서 이번 email hash canary 배포 자체의 blocker로 보지는 않았다. 별도 Meta token health 정리는 후속 작업으로 분리한다.
