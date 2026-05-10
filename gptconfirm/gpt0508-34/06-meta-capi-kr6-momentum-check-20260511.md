# Meta CAPI KR6 momentum check (gpt0508-34)

작성 시각: 2026-05-10 22:40:00 KST
Lane: Green documentation only / no-send / no-publish
자신감: 82% (운영 backend `.env` test_event_code 실제 값과 운영 사이트 traffic 시점 미지)

## 5줄 결론

1. KR6(Meta funnel CAPI Test Events readiness)는 코드/문서/payload 설계가 이미 충분히 준비돼 있고, 진짜 정체 사유는 “실제 Test Events 전송 자체를 한 번도 안 했기 때문”이다.
2. backend `metaCapi.ts`는 `test_event_code?.trim()`이 있을 때 dedup을 스킵하고 test-only 라우트로 분기하는 코드를 이미 갖고 있다.
3. 본 sprint는 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo 4 이벤트 대상 Yellow smoke 승인안을 작성한다. Purchase는 절대 금지 유지.
4. Test Events 전송은 platform actual send와 다르다(Events Manager Test 탭에서만 보임)지만 Yellow lane으로 분류해 1회 승인 후 짧은 windowed smoke 진행 안.
5. 추천 옵션은 “Yellow 1회 승인 → 30분 windowed smoke 4 이벤트 × 1회씩 → Events Manager Test 탭 캡처 → 결과 보고”, 자신감 82%.

## 1. 현재 readiness audit (read-only)

| 영역 | 상태 |
|---|---|
| `capivm/!capiplan.md` | Phase1~3 진행 표 정리, Test Events smoke 우선순위 1번 |
| `capivm/meta-funnel-capi-test-events-smoke-plan-20260505.md` | payload 설계 + 체크리스트 고정 완료 |
| backend `metaCapi.ts` line 1473 / 1770 | `test_event_code?.trim()` 시 test-only 분기, operational dedup skip |
| backend route `/api/meta/capi/send` | `testEventCode` 파라미터 처리 |
| backend route `/api/meta/capi/sync` | `queryTestEventCode` 분기 |
| `enableServerCapi` | false (운영 송출 OFF 유지) |
| Browser event_id 주입 (ViewContent/AddToCart/InitiateCheckout) | 부분 완료 |
| AddPaymentInfo 주입 | 미확인 — Phase2-Sprint4 |

## 2. 누락된 것

- 실제 Test Events 전송 1회. 모든 사전 준비는 끝났는데 마지막 “직접 발사” 단계가 비어 있다.
- AddPaymentInfo wrap race 검증 캡처가 아직 없다.
- Browser/Server dedup이 Events Manager UI에서 보이는지 확인 미진행.

## 3. Yellow smoke 승인안 (제안)

| 항목 | 값 |
|---|---|
| 목적 | ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo 4 이벤트가 Test Events 탭에서 같은 event_id로 보이고 dedup/EMQ 문제가 없는지 확인 |
| 대상 Pixel/Dataset | `1283400029487161` (biocom) |
| Lane | Yellow_proposed |
| Window | 30분 |
| 조건 | `test_event_code` 파라미터가 있을 때만 발사, Purchase 미포함 |
| 발사 횟수 | 4 이벤트 × 1회씩 (총 4발사) |
| Purchase | ❌ 금지 |
| 운영 send 영향 | 0 (test_event_code 분기는 platform actual send 차단) |
| Rollback | test_event_code 파라미터 제거 또는 endpoint 호출 중단 |

승인 문구:
```
[승인] gpt0508-34 작업6 Meta CAPI Test Events smoke:
test_event_code 파라미터로 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo
각 1회씩 발사, Purchase 미포함, 30분 window, Events Manager Test 탭 캡처 후 보고.
운영 송출(enableServerCapi=true)은 본 승인에 포함되지 않음.
```

## 4. payload preview (변경 없음)

`capivm/meta-funnel-capi-test-events-smoke-plan-20260505.md`의 4 이벤트 payload 설계 그대로 재사용. 본 sprint에서 payload 변경 없음.

## 5. 검증 계획

- Events Manager Test 탭 capture (4 이벤트 노출, 같은 event_id)
- Browser/Server dedup OK 표시
- Event Match Quality (EMQ) 점수 노출
- 운영 Pixel send count 변화 0 확인 (`enableServerCapi=false` 유지)

## 6. dedup contract 갱신 (no-send)

| 이벤트 | event_id 형식 | dedup window | 비고 |
|---|---|---|---|
| ViewContent | `vc_<sessionId>_<contentId>_<ts>` | 1h | browser/server 동일 |
| AddToCart | `atc_<sessionId>_<sku>_<ts>` | 1h | 동상 |
| InitiateCheckout | `ic_<sessionId>_<ts>` | 30m | 동상 |
| AddPaymentInfo | `api_<sessionId>_<ts>` | 30m | wrap race 확인 필요 |
| Purchase | (이번 smoke 미포함) | (operational dedup) | 본 sprint 금지 |

## 7. 추천 옵션과 자신감

- 추천: **Yellow 1회 승인 → 30분 windowed smoke 4 이벤트 × 1회씩 → Events Manager Test 탭 캡처 → 결과 보고**
- 자신감: **82%**
- 미지: backend `.env`의 `META_TEST_EVENT_CODE` 실제 값, 사이트 발사 시점에 dedup이 정확히 1회만 잡히는지.

## 8. 금지 (변함 없음)

- Meta Purchase 발사 ❌
- Imweb footer/header 편집 ❌
- GTM Production publish ❌
- backend deploy ❌
- `enableServerCapi=true` 운영 송출 ❌

## 9. Verdict

`KR6_TEST_EVENTS_SMOKE_APPROVAL_READY_PENDING_HUMAN_GATE`
