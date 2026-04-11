According to a document from 2026-04-10, 제 평가는 **“바이오컴 건은 거의 다 왔고, 더클린커피는 지금 바로 깊게 파기보다 바이오컴을 먼저 닫고 가는 게 맞다”**입니다. 이유는 두 가지입니다. 첫째, 바이오컴은 지금 문제의 직접 원인을 이미 찾았고 수정도 넣었습니다. `auto_sync`에서 같은 주문이 다른 `event_id`로 간 원인이 `loggedAt` 우선 event_id 생성식 + 결제완료 원장 중복 row`였고, 이를 `approvedAt`우선으로 바꾸고`paymentKey + eventName`또는`orderIdBase + eventName`기준 skip guard까지 넣었습니다. 다만 아직 다음 auto_sync 이후 실제로 중복 위험 그룹이 사라지는지 확인은 남아 있습니다. 둘째, 더클린커피는 2026-04-10 기준 raw에서는 아직 Meta spend가`0`, confirmed order도 `0`이라, 지금 당장 본격 비교해도 얻는 정보가 제한적입니다.

### 지금 상태 평가

현재 상태는 꽤 좋습니다.

* **좋아진 점**

  * biocom 최근 7일 기준 `site-summary / daily / meta_insights`가 같은 기간과 같은 spend로 맞았습니다. 내부 기준선은 이제 많이 안정됐습니다.
  * CAPI dedup도 “느낌”이 아니라 “원인”까지 갔습니다. 최근 7일 운영 성공 로그 691건 중 진짜 위험 후보는 `3그룹 12건`이고, 전부 `operational / auto_sync`였습니다. 그 원인도 코드 수준에서 확인했습니다.
  * 결제완료 식별자 품질도 조금 올라와서 all-three coverage가 `18.46%`입니다. 아직 낮지만, 개선 방향은 맞습니다. `_fbc`, `_fbp`도 같이 보내도록 보강했습니다.

* **아직 안 닫힌 점**

  * Meta Events Manager에서 **브라우저 Pixel과 서버 CAPI가 실제로 dedup 되었는지**는 아직 못 봤습니다. 이건 서버 로그만으로는 확정이 안 됩니다.
  * biocom 결제완료 페이지 GTM 오류는 아직 남아 있습니다. 이건 계측 품질을 계속 흔드는 요소입니다.
  * 캠페인별 Attribution ROAS는 여전히 금지 상태입니다. alias 상위 5개를 검토했지만 `manual_verified = 0` 유지라서 자동 매핑을 열면 위험합니다.

제 점수로 주면:

* **사이트 전체 ROAS 판단**: 80점대 중후반
* **CAPI 진단 수준**: 80점대 후반
* **캠페인별 Attribution 판단**: 아직 30점대

즉, **회사/사이트 단위 판단은 가능**, **캠페인 단위 예산 재배분은 아직 위험**입니다.

---

### 더클린커피도 지금 바로 비교해볼까?

제 답은 **“풀스코프 비교는 아직 아니다. 다만 바이오컴을 닫은 직후, 가볍게 sanity check는 해볼 가치가 있다”**입니다.

왜 지금은 아닌가:

1. **바이오컴은 이미 원인을 찾았고 수정도 넣었기 때문**입니다. 이 상태에서는 다른 상점을 파기보다, 다음 auto_sync에서 실제로 dedup 후보가 사라지는지 보는 게 우선입니다. 지금 가지를 치면 오히려 마무리가 늦어집니다.
2. **더클린커피는 아직 데이터가 거의 없습니다.** 2026-04-10 raw 기준으로 coffee는 spend `0`, confirmed order `0`, Meta purchase value `0`입니다. 즉 “비교용 표본”이 아직 약합니다. 새 계정을 연결했다 해도 지금 당장은 검증력이 낮습니다.
3. 다만 **더클린커피는 좋은 보조 기준점이 될 가능성은 큽니다.** fetch-fix v2 live 검증이 끝났고, 실제 가상계좌 주문에서 `ga_session_id / client_id / user_pseudo_id` 3종이 모두 들어온 첫 row를 이미 확인했습니다. GA4 property direct access도 OK고, coffee BigQuery export도 연결돼 있습니다. 즉 “구현이 더 깨끗한 비교군”으로는 쓸 만합니다.

그래서 제 권장 순서는 이겁니다.

**1단계: 바이오컴 닫기**
**2단계: 더클린커피는 “간단 비교”만 하기**
**3단계: coffee에 spend와 구매가 좀 쌓이면 그때 본격 비교**

---

### 지금 다음으로 뭐 하면 되나

우선순위를 딱 4개로 줄이면:

**1. 바이오컴 dedup 수정 효과 확인**
다음 auto_sync 1 - 2번 돌고 나서 다시
`/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1`
를 봐야 합니다. 기대값은 `multi-event-id duplicate-risk groups`가 **3 → 0 또는 아주 낮은 수준**으로 내려가는 것입니다. 이게 지금 1순위입니다.

**2. Meta Events Manager에서 Pixel/CAPI dedup 확인**
서버 로그상 원인은 거의 밝혀졌지만, Meta 안에서 실제로 브라우저와 서버가 dedup되는지는 별도 확인이 필요합니다. 이걸 봐야 “이제 진짜 닫았다”고 말할 수 있습니다.

**3. biocom payment page GTM 오류 정리**
이건 아직 남은 계측 품질 blocker입니다. dedup이 잡혀도 GTM 오류가 계속 있으면 다시 숫자가 흔들립니다. 문서도 이걸 계속 후속 작업 1순위 축으로 두고 있습니다.

**4. 더클린커피는 “연결 확인”만 하기**
지금 당장 깊게 비교하지 말고, 아래 3개만 체크하세요.

* 새 Meta 계정이 실제 `SITE_ACCOUNTS`에 반영됐는가
* 최근 7일 coffee spend가 0이 아닌가
* coffee raw 3종 파일이 뽑히는가
  문서상 새 계정을 추가할 때는 `SITE_ACCOUNTS`만 같이 업데이트하면 된다고 되어 있습니다.
  이 3개가 통과되면, 그다음에야 coffee 비교를 시작하면 됩니다.

---

### 더클린커피는 언제 보면 좋나

저라면 **아래 둘 중 하나가 되면** 봅니다.

* 최근 7일에 **spend가 의미 있게 발생**하고
* confirmed 주문이 **최소 몇 건이라도 생겼을 때**

숫자 기준을 아주 거칠게 잡으면:

* spend가 0이 아니고
* confirmed order가 5 - 10건 이상 생기면
  그때는 coffee를 보면 도움이 됩니다.

왜냐면 그 시점부터는 coffee가

* biocom처럼 dedup이 생기는지
* caller coverage가 더 좋은지
* Meta purchase와 내부 confirmed 차이가 어떻게 다른지
  를 보는 **비교군**이 될 수 있기 때문입니다.

지금은 아직 raw상 `0`이라, 보더라도 “연결됐는지” 정도만 확인하는 수준이 맞습니다.

---

### 제 최종 의견

한 줄로 정리하면:

**지금은 바이오컴을 먼저 닫는 게 맞습니다.**
더클린커피는 **보조 검증군으로는 좋지만, 아직 표본이 약해서 본격 분석은 이르다**고 봅니다.

실행 순서로 쓰면:

1. biocom dedup 수정 효과 확인
2. Meta Events Manager dedup 확인
3. biocom GTM/payment page 오류 정리
4. coffee는 새 계정 매핑과 raw 추출만 확인
5. coffee에 spend와 구매가 쌓이면 그때 가볍게 비교 시작

필요 자료는 지금 당장은 많지 않습니다.
**바이오컴 Meta Events Manager에서 Purchase 이벤트 상세 1장**만 있으면, Pixel/CAPI dedup 종결 판단이 훨씬 빨라집니다.
