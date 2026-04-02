"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function LeadMagnetPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/coffee" className={styles.backLink}>← 더클린커피 전략으로 돌아가기</Link>
            <h1 className={styles.headerTitle}>리드 마그넷: 1분 커피 타입 진단</h1>
            <p className={styles.headerSub}>구현 명세 · 진단 로직 · 결과 페이지 · CRM 연동 · 필요 자료</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* 개요 */}
        <div className={styles.hero}>
          <h2>왜 &quot;1분 진단&quot;인가</h2>
          <p>
            더클린커피의 병목은 상품 부족이 아니라 <strong>선택 피로</strong>다.
            드립백, 콜롬비아, 에티오피아, 디카페인, 정기구독 — 옵션은 충분하지만,
            처음 온 사람은 &quot;나는 뭘 사야 하지?&quot;에서 멈춘다.
            진단형 리드 마그넷은 이 10초의 망설임을 대신 해결해준다.
          </p>
        </div>

        {/* ═══ 1. 진단 문항 설계 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. 진단 문항 설계 (7문항)</h2>
          <p className={styles.sectionDesc}>각 문항은 결과 유형 분기에 영향. 1분 내 완료 가능하도록 선택지 2~3개로 제한.</p>

          <div className={styles.questionGrid}>
            {[
              { q: "카페인에 민감한 편인가요?", opts: ["네, 오후엔 못 마셔요", "보통이에요", "전혀 안 민감해요"], tag: "카페인 민감형 분기" },
              { q: "어떤 맛을 좋아하세요?", opts: ["고소하고 부드러운 맛", "과일향·산미가 있는 맛", "잘 모르겠어요"], tag: "콜롬비아 vs 에티오피아/케냐 분기" },
              { q: "주로 어디서 커피를 마시나요?", opts: ["집에서 직접 내려요", "회사/외출 시 간편하게", "둘 다"], tag: "원두 vs 드립백 분기" },
              { q: "커피를 언제 주로 마시나요?", opts: ["아침 루틴으로", "오후에도 마셔요", "시간 불규칙"], tag: "디카페인 보조 분기" },
              { q: "방탄커피(버터/MCT)에 관심이 있나요?", opts: ["네, 시도해보고 싶어요", "아니요, 일반 커피만"], tag: "방탄커피 추천 여부" },
              { q: "누구를 위한 커피인가요?", opts: ["내가 마실 거예요", "선물할 거예요"], tag: "선물 퍼널 분기" },
              { q: "정기 배송에 관심이 있나요?", opts: ["네, 편리할 것 같아요", "일단 한 번 사볼게요"], tag: "구독 전환 시드" },
            ].map((item, i) => (
              <div key={i} className={styles.questionCard}>
                <div className={styles.questionNum}>Q{i + 1}</div>
                <div>
                  <strong>{item.q}</strong>
                  <div className={styles.optionList}>
                    {item.opts.map((opt, j) => (
                      <span key={j} className={styles.optionChip}>{opt}</span>
                    ))}
                  </div>
                  <span className={styles.questionTag}>{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ 2. 결과 유형 상세 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>2. 결과 유형 4개 · 상품 연결 · 메시지</h2>

          <div className={styles.resultGrid}>
            {[
              {
                icon: "☕", type: "클린 입문형", color: "#ec4899",
                product: "초신선 드립백 커피", price: "10,900원~",
                headline: "간편하게 시작하는 깨끗한 커피",
                body: "그라인더 없이도 더클린커피의 맛을 경험할 수 있어요. 뜨거운 물만 부으면 1분 만에 완성.",
                cta: "드립백 스타터 보기",
                followup: "D+1: '드립백 잘 받으셨나요? 추출 팁 알려드릴게요' / D+7: '이번엔 원두로도 도전해보세요'",
              },
              {
                icon: "🫘", type: "고소한 데일리형", color: "#0D9488",
                product: "콜롬비아 수프레모 나리뇨", price: "18,300원~",
                headline: "매일 마셔도 질리지 않는 고소함",
                body: "뉴크롭 생두, 이중 핸드픽, 곰팡이독소 FREE. 한국인이 가장 좋아하는 고소하고 부드러운 밸런스.",
                cta: "콜롬비아 수프레모 보기",
                followup: "D+1: '원두 도착 후 3일 내 드시면 가장 신선해요' / D+21: '원두가 떨어질 때쯤이죠? 재주문 15% 쿠폰'",
              },
              {
                icon: "🍊", type: "풍미 탐색형", color: "#F59E0B",
                product: "에티오피아 예가체프 / 케냐 아이히더", price: "19,300원~",
                headline: "과일향과 산미를 즐기는 탐험가",
                body: "커피도 와인처럼 산지마다 완전히 다른 맛. 에티오피아의 꽃향과 케냐의 베리향을 비교해보세요.",
                cta: "에티오피아 vs 케냐 비교하기",
                followup: "D+3: '어떤 향이 더 좋으셨나요? 다음 추천을 골라드릴게요' / D+14: '이번엔 과테말라도 도전?'",
              },
              {
                icon: "🌙", type: "카페인 민감형", color: "#3b82f6",
                product: "디카페인 과테말라 안티구아 SHB", price: "19,300원~",
                headline: "오후에도 부담 없는 깨끗한 디카페인",
                body: "카페인 99.9% 제거, 곰팡이독소 테스트 통과. 맛은 그대로인데 카페인 걱정은 없어요.",
                cta: "디카페인 보기",
                followup: "D+1: '디카페인은 오후 3시 이후에 마시기 딱이에요' / D+21: '재주문 할인 쿠폰 드려요'",
              },
            ].map((r) => (
              <div key={r.type} className={styles.resultCard} style={{ borderTopColor: r.color }}>
                <div className={styles.resultHeader}>
                  <span style={{ fontSize: "2rem" }}>{r.icon}</span>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>{r.type}</strong>
                    <span className={styles.resultProduct}>{r.product} · {r.price}</span>
                  </div>
                </div>
                <div className={styles.resultBody}>
                  <div className={styles.resultHeadline}>&quot;{r.headline}&quot;</div>
                  <p>{r.body}</p>
                  <div className={styles.resultCta} style={{ background: r.color }}>{r.cta}</div>
                </div>
                <div className={styles.resultFollowup}>
                  <strong>후속 CRM:</strong>
                  <p>{r.followup}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ 3. 기술 구현 명세 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3. 기술 구현 명세</h2>

          <div className={styles.specGrid}>
            <div className={styles.specCard}>
              <h3>프론트엔드</h3>
              <ul>
                <li><code>/quiz</code> 라우트 — 진단 페이지 (7문항 스텝 UI)</li>
                <li><code>/quiz/result/[type]</code> — 결과 페이지 4종</li>
                <li>문항별 선택 → 점수 누적 → 최종 유형 분기 로직</li>
                <li>결과 직전에 전화번호/이메일 입력 모달</li>
                <li>결과 페이지에서 상품 바로 연결 (아임웹 상품 URL)</li>
                <li>모바일 퍼스트 반응형 (광고 유입 80%+ 모바일)</li>
              </ul>
            </div>

            <div className={styles.specCard}>
              <h3>백엔드 · 데이터</h3>
              <ul>
                <li><code>crm_lead_profile</code>에 진단 결과 유형 저장</li>
                <li><code>crm_lead_event_log</code>에 진단 완료 이벤트 기록</li>
                <li><code>crm_consent_log</code>에 마케팅 수신 동의 기록</li>
                <li>진단 완료 → 자동으로 CRM 후속 시퀀스 트리거</li>
                <li>알리고 알림톡 예약 발송 (D+0, D+1, D+3, D+7, D+21)</li>
                <li>실험 원장에 진단형 vs 일반 할인 vs 대조군 배정</li>
              </ul>
            </div>

            <div className={styles.specCard}>
              <h3>광고 · 트래킹</h3>
              <ul>
                <li>Meta 광고: 진단 랜딩 직접 연결 (UTM 태깅)</li>
                <li>GA4 이벤트: <code>quiz_start</code>, <code>quiz_complete</code>, <code>quiz_result_view</code></li>
                <li>전환 추적: 진단 완료 → 첫 구매 → 재구매 → 구독 전환</li>
                <li>비용 연결: Meta CPC → 진단 완료 → 구매 → ROAS</li>
              </ul>
            </div>

            <div className={styles.specCard}>
              <h3>아임웹 연동</h3>
              <ul>
                <li>진단 결과에서 상품 URL로 직접 링크</li>
                <li>쿠폰 코드 연동: 결과 유형별 전용 쿠폰</li>
                <li>아임웹 API (<code>IMWEB_API_KEY</code> 확보 완료)로 주문 추적</li>
                <li><code>isFirst=Y</code> 필드로 진단 → 첫 구매 전환 측정</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ═══ 4. 완성에 필요한 자료 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>4. 완성에 필요한 자료 · 의사결정</h2>

          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>항목</th>
                  <th>현재 상태</th>
                  <th>TJ님 액션</th>
                  <th>우선순위</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["진단 문항 최종 확정", "초안 7개 준비됨", "문항/선택지 검토 후 확정", "P0"],
                  ["결과 유형별 대표 상품 확정", "4유형 매핑 제안됨", "상품/가격 최종 확인", "P0"],
                  ["첫 구매 혜택 결정", "15% 쿠폰 vs 스타터 묶음", "어떤 혜택으로 갈지 결정", "P0"],
                  ["결과 페이지 카피 검토", "각 유형별 헤드라인/본문 초안", "톤앤매너 확인", "P1"],
                  ["알림톡 템플릿 등록", "메시지 초안 준비됨", "알리고에서 등록 + 카카오 심사", "P1"],
                  ["더클린커피 GA4 권한", "property 326949178 접근 불가", "서비스 계정에 뷰어 권한 추가", "P1"],
                  ["Meta 광고 크리에이티브", "미준비", "진단 유도 광고 소재 제작", "P2"],
                  ["진단 페이지 호스팅 위치", "seo 프로젝트 or 아임웹 임베드", "어디에 올릴지 결정", "P2"],
                  ["SEO 콘텐츠 키워드", "미확정", "'디카페인 추천', '산미 적은 원두' 등 선정", "P2"],
                ].map((row, i) => (
                  <tr key={i} className={styles.tableRow}>
                    <td><strong>{row[0]}</strong></td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td><span className={styles.priorityBadge} style={{
                      background: row[3] === "P0" ? "rgba(13,148,136,0.1)" : row[3] === "P1" ? "rgba(59,130,246,0.1)" : "rgba(148,163,184,0.1)",
                      color: row[3] === "P0" ? "var(--color-primary)" : row[3] === "P1" ? "var(--color-info)" : "var(--color-text-muted)",
                    }}>{row[3]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ 5. 실험 설계 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>5. A/B/C 실험 설계</h2>
          <p className={styles.sectionDesc}>&quot;진단형 리드 마그넷이 일반 할인보다 실제로 더 파는가?&quot;를 검증</p>

          <div className={styles.experimentDesign}>
            <div className={styles.experimentGroup} style={{ borderColor: "var(--color-text-muted)" }}>
              <div className={styles.experimentLabel}>A. 대조군</div>
              <strong>아무 메시지 없음</strong>
              <p>자연 유입 → 자연 구매. 기준선 측정용.</p>
            </div>
            <div className={styles.experimentGroup} style={{ borderColor: "var(--color-primary)" }}>
              <div className={styles.experimentLabel} style={{ background: "var(--color-primary)" }}>B. 진단형</div>
              <strong>1분 진단 → 맞춤 추천 → 유형별 쿠폰</strong>
              <p>진단 결과 기반 상품 추천 + 첫 구매 혜택. &quot;당신은 고소한 데일리형! 콜롬비아 수프레모를 추천합니다&quot;</p>
            </div>
            <div className={styles.experimentGroup} style={{ borderColor: "var(--color-accent)" }}>
              <div className={styles.experimentLabel} style={{ background: "var(--color-accent)" }}>C. 일반 할인</div>
              <strong>15% 할인 쿠폰만 제공</strong>
              <p>진단 없이 전 상품 15% 할인. &quot;첫 구매 15% 할인 쿠폰을 드려요&quot;</p>
            </div>
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 16 }}>
            <strong>측정 지표</strong>: 진단 완료율 / 첫 구매 전환율 / 객단가 / 7일 내 재구매율 / 30일 내 구독 전환율 / ROAS.
            B(진단형)이 C(일반 할인)보다 전환율 3%p+ 높으면 진단형 채택. 아니면 할인 최적화로 방향 전환.
          </div>
        </div>

        {/* ═══ 6. 퍼널별 CRM 시퀀스 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>6. 퍼널별 CRM 시퀀스</h2>

          <div className={styles.funnelGrid}>
            <div className={styles.funnelCard}>
              <h3>퍼널 A: 메인 (신규 고객)</h3>
              <div className={styles.timeline}>
                {[
                  { d: "D+0", msg: "진단 완료 후 미구매 → '결과에 맞는 원두가 기다리고 있어요'" },
                  { d: "D+1", msg: "추출 팁/보관법 콘텐츠 → 자연스러운 재방문 유도" },
                  { d: "D+3", msg: "미구매 시 → '첫 구매 혜택이 3일 뒤 만료돼요'" },
                  { d: "D+7", msg: "구매 완료 시 → '잘 받으셨나요? 드립 팁 알려드릴게요'" },
                  { d: "D+21", msg: "재구매 유도 → '원두가 떨어질 때쯤! 15% 쿠폰'" },
                  { d: "D+30", msg: "구독 제안 → '매번 주문 번거로우시죠? 정기구독 안내'" },
                ].map((t) => (
                  <div key={t.d} className={styles.timelineItem}>
                    <span className={styles.timelineDay}>{t.d}</span>
                    <span>{t.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.funnelCard}>
              <h3>퍼널 B: 디카페인 특화</h3>
              <div className={styles.timeline}>
                {[
                  { d: "D+0", msg: "'카페인 민감형이시군요! 디카페인 추천합니다'" },
                  { d: "D+1", msg: "'오후 3시 이후에 마시기 딱 좋아요'" },
                  { d: "D+7", msg: "'디카페인인데 맛이 이렇게 좋을 줄 몰랐어요' 후기 소개" },
                  { d: "D+21", msg: "재주문 쿠폰 + '이번엔 디카페인 드립백도 써보세요'" },
                ].map((t) => (
                  <div key={t.d} className={styles.timelineItem}>
                    <span className={styles.timelineDay}>{t.d}</span>
                    <span>{t.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.funnelCard}>
              <h3>퍼널 C: 선물 시즌</h3>
              <div className={styles.timeline}>
                {[
                  { d: "D+0", msg: "'선물용이시군요! 실패 없는 커피 선물세트 추천'" },
                  { d: "D+1", msg: "'선물 포장 무료 + 메시지 카드 서비스'" },
                  { d: "D+3", msg: "미구매 시 → '인기 선물세트 TOP 3'" },
                  { d: "시즌", msg: "명절/크리스마스/발렌타인 시즌별 리마인드" },
                ].map((t) => (
                  <div key={t.d} className={styles.timelineItem}>
                    <span className={styles.timelineDay}>{t.d}</span>
                    <span>{t.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
