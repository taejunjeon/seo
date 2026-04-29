"use client";

import Link from "next/link";
import styles from "./seo.module.css";
import CopyButton from "./CopyButton";
import WhyCallout from "./WhyCallout";
import ImpactBadge from "./ImpactBadge";

type Approval = {
  key: "A" | "B" | "C" | "D";
  title: string;
  status: string;
  confidence: number;
  scope: "draft" | "needs-approval" | "done";
  whatItIs: string;
  currentState: string;
  reason: string;
  yesProduces: string[];
  yesNextSteps: string;
  noImpact: string[];
  answer: string;
};

const APPROVALS: Approval[] = [
  {
    key: "A",
    title: "Phase1~Phase2 진단·설계 묶음 (이미 완료)",
    status: "이미 완료 · 운영 반영 없음",
    confidence: 86,
    scope: "done",
    whatItIs: "공개 URL을 읽기 전용으로 진단하고(Phase1), 대표 URL 정책 추천서와 검색엔진 설명서 코드 샘플을 만든 묶음(Phase2). 사이트는 손대지 않고 데이터·문서만 생성.",
    currentState: "Codex가 reports/seo/* 산출물 17종(MD 8 + CSV 7 + JSON 5)을 모두 생성 완료. 운영 변경 0건.",
    reason: "운영 영향 0이라 별도 승인 없이 진행. 지금은 D부터 외부 시스템(아임웹·검색 도구·콘텐츠팀)이 관여해서 TJ 결정 필요.",
    yesProduces: [],
    yesNextSteps: "이미 YES 처리됨. 운영 반영 체크리스트와 검색엔진 설명서 코드 최종본 정리로 자동 이행.",
    noImpact: [],
    answer: "YES (이미 처리됨)",
  },
  {
    key: "B",
    title: "운영팀이 그대로 작업할 수 있는 URL 정리 요청서 만들기",
    status: "✅ 2026-04-28 완료",
    confidence: 78,
    scope: "done",
    whatItIs: "이 화면 「URL 정책」 섹션의 표를 아임웹 운영팀이 한 줄씩 보고 작업할 수 있는 「작업 요청서 문서」로 변환하는 일. 운영 사이트는 아직 안 바꿈 — 작업 요청서 「초안」을 만드는 단계.",
    currentState: "TJ 승인 후 2026-04-28에 6개 산출물 생성 완료. 다음은 「실제 아임웹 반영」 여부를 TJ가 별도 승인하는 단계 (운영 반영 게이트는 §운영 체크리스트 참고).",
    reason: "(완료) 다음은 운영팀에 요청서 전달 → 작업 진행 → 1주일/2주일 후 GSC로 효과 검증.",
    yesProduces: [
      "✅ 아임웹 URL 정리 작업 요청서: reports/seo/imweb_url_cleanup_workorder.md (체크리스트 + 절차 + 검증)",
      "✅ 대표 URL 목록 CSV: reports/seo/imweb_canonical_targets.csv (9건 P0/P1)",
      "✅ 검색결과 숨김 목록 CSV: reports/seo/imweb_noindex_targets.csv (11건 P0/P1)",
      "✅ sitemap 정리 목록 CSV: reports/seo/imweb_sitemap_excludes.csv (6건)",
      "✅ robots.txt 수정안 MD: reports/seo/imweb_robots_txt_revision.md (적용본 + 검증)",
      "✅ 롤백 기준 정본 MD: reports/seo/imweb_rollback_criteria.md (즉시/1주일/2주 신호 + 부분 롤백 매핑)",
    ],
    yesNextSteps: "이 6개 산출물을 아임웹 운영팀에 전달 → 작업 진행 → 1주일 후 §운영 체크리스트의 1주일 점검 항목 확인. 실제 운영 반영 자체는 「운영 영향 있음」이라 TJ 별도 승인 필요.",
    noImpact: [],
    answer: "YES (완료) — 산출물 6개 reports/seo/imweb_*.* 생성됨",
  },
  {
    key: "C",
    title: "상품 4개 텍스트 초안을 콘텐츠팀에 검토 의뢰",
    status: "D 패키지에 흡수",
    confidence: 72,
    scope: "draft",
    whatItIs: "이 화면 「상품 텍스트」 섹션의 4개 상품(검사권 2 + 영양제 2) H1/H2/H3/FAQ 초안을 콘텐츠팀에 「이 톤·길이로 표시 가능 문구로 다듬어주세요」라고 「검토 의뢰」하는 일. 운영 사이트는 아직 안 바꿉니다 — 콘텐츠팀에 「초안」을 넘기는 단계.",
    currentState: "구조 초안은 완성. 실제 운영 페이지에 들어갈 최종 문구는 아직 아님. 건강기능식품 표시 기준·검사 진행 안내 등 법무·브랜드 검토가 필요한 표현이 섞여 있음.",
    reason: "숨김 텍스트 없이 사용자에게 보이는 구조라 SEO 리스크는 낮지만, 효능·검사 표현은 운영 반영 전에 (1) 최신 상품 상세 안내문과 일치, (2) 표시 가능 문구 내에서만 사용, 두 가지를 콘텐츠팀이 다듬어야 안전.",
    yesProduces: [
      "콘텐츠팀 요청서 1개 (상품 4개 H1/H2/H3/FAQ 구조 + 톤 가이드)",
      "각 상품별 검색 의도와 핵심 키워드",
      "건강·검사 표현 검수 체크리스트 (식약처 기준)",
      "다듬어진 문구가 들어올 자리 (운영 반영은 별도 승인)",
    ],
    yesNextSteps: "Claude Code가 reports/seo/content_team_request.md 형태로 요청서 정리 → 콘텐츠팀이 다듬은 결과를 받으면 다시 TJ 검토 → 그 다음 라운드에서 「실제 아임웹 게시」 여부를 별도로 결정.",
    noImpact: [
      "통이미지 위주 상품 상세의 검색엔진 본문 인식 점수(현재 7/15) 정체",
      "「지연성 알러지 검사」 같은 검색 키워드의 클릭률 개선 지연",
      "AI 검색(ChatGPT, Perplexity)이 상품을 추천할 때 인용할 본문 부족",
    ],
    answer: "YES: 상품 4개 텍스트 초안 검토 의뢰 (운영 반영은 별도 승인)",
  },
  {
    key: "D",
    title: "상품 4개 SEO/AEO 최종 실행 패키지 + GSC canonical 매트릭스",
    status: "패키지 작성 완료",
    confidence: 82,
    scope: "draft",
    whatItIs: "상품/검사권 4개에 보이는 본문 텍스트, Product/Breadcrumb/FAQ JSON-LD, 아임웹 삽입 순서, 롤백 기준, Search Console에서 확인할 10개 URL 매트릭스를 묶은 최종 실행 패키지입니다.",
    currentState: "최종 실행 패키지와 GSC canonical 매트릭스 문서를 생성함. 실제 아임웹 게시, 사용자 코드 게시, Search Console 제출은 운영 영향이 있으므로 별도 최종 확인 뒤 진행.",
    reason: "핵심 6개 페이지 JSON-LD가 0개이고 상품 상세가 이미지 의존이라, 아임웹 탈출보다 먼저 검색엔진과 AI가 읽을 수 있는 재료를 늘리는 것이 파급력이 큼.",
    yesProduces: [
      "reports/seo/seo_aeo_execution_package.md",
      "reports/seo/gsc_canonical_check_matrix.md",
      "아임웹 삽입 방법 화면 반영",
      "운영 반영 전 롤백 기준 정리",
    ],
    yesNextSteps: "TJ님이 완성 패키지를 확인 → 아임웹 삽입 준비 진행 → 실제 게시 직전 최종 확인 → Rich Results Test와 Search Console URL 검사.",
    noImpact: [
      "핵심 6개 페이지 JSON-LD 0개 상태가 유지됨",
      "상품 상세 통이미지 의존과 AI 인용 부족이 남음",
      "아임웹 canonical 제약이 실제 검색 선택에 미치는 영향을 확인하지 못함",
    ],
    answer: "YES: 완성 패키지 확인 완료, 아임웹 삽입 준비 진행",
  },
];

const SEPARATE_APPROVALS = [
  {
    item: "아임웹 noindex/사용자 코드/상품 상세 수정",
    why: "검색 노출과 기존 공유 URL에 직접 영향. 잘못 설정하면 색인이 빠지거나 화면 전환율이 흔들릴 수 있음.",
    how: "아임웹에서 지원되는 범위 안에서 검색결과 숨김, 사용자 코드, 상품 상세 텍스트를 단계별로 반영. canonical과 301은 직접 제어가 어렵기 때문에 운영 작업으로 남기지 않음.",
    codex: "공개 URL 진단, robots 적용 확인, canonical 제약 반영 완료.",
  },
  {
    item: "GSC URL 검사 canonical 확인",
    why: "아임웹에서 canonical을 직접 바꾸기 어려우므로 Google이 실제로 어떤 URL을 대표로 선택했는지 확인해야 함.",
    how: "내부 대시보드의 URL Inspection 자동 확인표에서 홈, /index, 상품, /shop_view 변형, 칼럼 URL 10개의 Google 선택 canonical을 확인.",
    codex: "URL Inspection API 자동 확인 반영 완료. 검사권 2개는 /shop_view 표준화, 음식물 과민증 공식 URL은 NOINDEX 제외로 확인됨.",
  },
  {
    item: "GTM 또는 사용자 코드 게시",
    why: "운영 사이트 스크립트가 바뀌어 페이지 동작·로딩 속도에 영향 가능.",
    how: "GTM(Google Tag Manager)에서 「사용자 정의 HTML」 태그로 JSON-LD 코드 추가, 트리거를 페이지 URL로 한정. 또는 아임웹 「사용자 코드 삽입」에 직접 넣음.",
    codex: "JSON-LD 5개 샘플과 운영 반영 체크리스트 작성 완료.",
  },
  {
    item: "Google Search Console / Naver Search Advisor에 sitemap·URL 제출",
    why: "운영 계정 로그인 + 2FA가 필요한 작업. 잘못 제출하면 잡음 URL이 색인되거나 우리 의도와 다른 URL이 대표로 잡힐 수 있음.",
    how: "(1) Search Console 좌측 메뉴 'Sitemaps'에서 https://biocom.kr/sitemap.xml 제출 또는 재제출. (2) 'URL 검사' 도구로 핵심 6개 페이지를 한 건씩 색인 요청. (3) Naver Search Advisor에서도 동일 절차. 1~7일 안에 검색 결과에 반영 시작.",
    codex: "제출할 URL 체크리스트 reports/seo/operation_change_checklist.md 에 작성 완료.",
  },
  {
    item: "상품 상세 텍스트 운영 반영",
    why: "상세 페이지 전환율과 브랜드 표현에 직접 영향. 사용자 첫 인상이 바뀜.",
    how: "콘텐츠팀이 다듬은 최종 문구를 디자인팀이 PC/모바일 시안으로 → TJ 검토 → 아임웹 페이지 본문 편집기로 텍스트 블록 추가. 통이미지 위 또는 아래.",
    codex: "텍스트 구조 초안 4개 작성 완료.",
  },
  {
    item: "건강·검사 표현 확정 (법무/브랜드 리스크)",
    why: "건강기능식품 표시 기준, 의료 표현 규제로 「치료」, 「개선」 같은 단정 표현은 페널티·법적 리스크.",
    how: "콘텐츠팀이 식약처 표시 기준·내부 가이드를 기준으로 허용 표현만 골라서 정리 → TJ가 최종 톤·금지어 확정.",
    codex: "GSC query 중 질문형 키워드와 문구 후보를 정리 (Phase3-Sprint9에서 진행 예정).",
  },
];

export default function ApprovalsSection() {
  return (
    <section id="approvals" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>승인 현황</h2>
        </div>
        <span className={styles.sectionTag}>!seoplan.md 승인 섹션</span>
      </div>

      <WhyCallout tone="info" title="이 섹션은 어떤 결정을 받기 위한 것인가요">
        <p style={{ marginBottom: 8 }}>
          승인안은 「여기까지 진행했고, 다음 단계로 가려면 TJ 답변이 필요한」 결정 게이트입니다.
          A와 B는 완료됐고, C는 D 패키지 안으로 흡수했습니다.
        </p>
        <p>
          현재 가장 중요한 확인은 <strong>승인안 D 완성 패키지</strong>입니다. 각 카드에는 <strong>(1) 이게 무엇인지</strong>, <strong>(2) 지금 어디까지 됐는지</strong>,
          <strong> (3) 왜 이걸 결정해야 하는지</strong>, <strong>(4) YES/NO 했을 때 다음에 무슨 일이 벌어지는지</strong>까지 적어뒀습니다.
          답은 카드 하단의 답변 코드를 복사해서 채팅으로 보내주시면 됩니다.
        </p>
      </WhyCallout>

      <div className={styles.approvalGrid}>
        {APPROVALS.map((a) => {
          const waiting = a.status.includes("대기");
          return (
            <article key={a.key} className={styles.approvalCard} data-waiting={waiting}>
              <div className={styles.approvalHead}>
                <div>
                  <div className={styles.approvalKey}>승인안 {a.key}</div>
                  <div className={styles.approvalTitle}>{a.title}</div>
                </div>
                <div className={styles.approvalBadgeStack}>
                  <span className={styles.approvalBadge} data-waiting={waiting}>{a.status}</span>
                  {a.scope === "draft" && <ImpactBadge variant="draft" />}
                  {a.scope === "needs-approval" && <ImpactBadge variant="needs-approval" />}
                </div>
              </div>
              <div className={styles.approvalConfRow}>
                <span className={styles.approvalConfLabel}>추천 자신감</span>
                <div className={styles.approvalConfBar}>
                  <div className={styles.approvalConfFill} style={{ width: `${a.confidence}%` }} />
                </div>
                <span className={styles.approvalConfValue}>{a.confidence}%</span>
              </div>

              <div className={styles.approvalSection}>
                <div className={styles.approvalSectionLabel}>이게 뭐예요</div>
                <p className={styles.approvalSectionText}>{a.whatItIs}</p>
              </div>
              <div className={styles.approvalSection}>
                <div className={styles.approvalSectionLabel}>지금 상태</div>
                <p className={styles.approvalSectionText}>{a.currentState}</p>
              </div>
              <div className={styles.approvalSection}>
                <div className={styles.approvalSectionLabel}>왜 결정이 필요해요</div>
                <p className={styles.approvalSectionText}>{a.reason}</p>
              </div>

              {a.yesProduces.length > 0 && (
                <div className={styles.approvalDeliv} data-tone="yes">
                  <div className={styles.approvalDelivLabel}>✅ YES 하면 생성되는 것</div>
                  <ul>{a.yesProduces.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
              {a.yesNextSteps && (
                <div className={styles.approvalAction} data-tone="yes">
                  <span className={styles.approvalActionLabel}>다음 단계</span>
                  <span>{a.yesNextSteps}</span>
                </div>
              )}
              {a.noImpact.length > 0 && (
                <div className={styles.approvalDeliv} data-tone="no">
                  <div className={styles.approvalDelivLabel}>⚠️ NO 하면 발생하는 일</div>
                  <ul>{a.noImpact.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}

              {a.key === "B" && a.scope === "done" && (
                <Link href="/seo/url-cleanup" className={styles.approvalCtaLink}>
                  📋 작업 요청서 화면 열기 (체크리스트 + robots.txt 적용본 + 롤백 표) →
                </Link>
              )}

              <div className={styles.approvalAnswerRow}>
                <code className={styles.approvalAnswer}>{a.answer}</code>
                <CopyButton size="sm" label="답변 복사" value={a.answer} />
              </div>
            </article>
          );
        })}
      </div>

      <div className={styles.subSection}>
        <h3 className={styles.colH}>운영 반영 전 별도 승인 (위 A/B/C/D와 별개로 단계마다 한 번씩 더)</h3>
        <WhyCallout tone="warning">
          A/B/C/D가 「방향 결정」 게이트라면, 아래 항목은 「실제 운영에 손대기 직전」의 마지막 게이트입니다.
          예: 승인안 D에서 YES를 받아도, 실제로 아임웹 사용자 코드나 상품 상세를 바꾸기 직전에 <strong>이 표의 관련 줄</strong>을 다시 한 번 확인합니다.
        </WhyCallout>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>승인 항목</th>
                <th>왜 TJ 승인이 필요한가</th>
                <th>실제로 무엇을 하는가 (어떻게)</th>
                <th>Codex 사전 시도</th>
              </tr>
            </thead>
            <tbody>
              {SEPARATE_APPROVALS.map((row) => (
                <tr key={row.item}>
                  <td><strong>{row.item}</strong></td>
                  <td>{row.why}</td>
                  <td>{row.how}</td>
                  <td className={styles.pageCellMetaSmall}>{row.codex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
