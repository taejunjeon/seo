"use client";

import styles from "./seo.module.css";
import CopyButton from "./CopyButton";
import WhyCallout from "./WhyCallout";

const APPROVALS = [
  {
    key: "A",
    title: "Phase1~Phase2 진단·설계 묶음",
    status: "이미 완료 · 운영 반영 없음",
    confidence: 86,
    whatItIs: "공개 URL 진단(Phase1) + 대표 URL 정책 추천서·JSON-LD 샘플(Phase2)까지 운영 사이트를 건드리지 않고 데이터만 만드는 묶음.",
    currentState: "Codex가 reports/seo/* 산출물 17종(MD 8 + CSV 7 + JSON 5)을 모두 생성. 운영 변경 0건.",
    reason: "여기까지는 운영 영향이 없으므로 별도 승인 없이 진행 완료. 다음 단계(B/C)부터는 외부 시스템(아임웹·검색 도구·콘텐츠팀)이 관여하므로 TJ 결정이 필요.",
    yesAction: "이 단계는 이미 YES 처리됨. Codex가 운영 반영 체크리스트와 JSON-LD 삽입 코드 블록을 최종본으로 정리할 다음 작업으로 자동 이행.",
    noAction: "(해당 없음)",
    answer: "YES (이미 처리됨)",
  },
  {
    key: "B",
    title: "대표 URL 정책 발행 → 아임웹·robots·sitemap 반영",
    status: "TJ 응답 대기",
    confidence: 78,
    whatItIs: "URL 정책 매트릭스(이 화면 'URL 정책' 섹션)를 운영 요청서로 만들고, 그 표대로 (1) 아임웹 관리자에서 canonical/noindex 수정, (2) robots.txt의 sitemap 지시문 정리, (3) sitemap.xml에서 잡음 URL 제외하는 작업 묶음.",
    currentState: "추천서·매트릭스·CSV는 다 만들어져 있음. 다만 운영 반영은 시작 안 함. 현재 sitemap에는 parameter URL이 없지만 내부 링크와 최종 URL에는 ?idx=, ?q=, 리뷰 board URL이 섞여 있는 상태.",
    reason: "URL 정책을 먼저 고정해야 (1) JSON-LD url 필드를 무엇으로 쓸지 결정 가능, (2) Search Console 색인 요청을 다시 보낼 때 어느 URL을 밀어 넣을지 결정 가능. 정책 없이 다음 단계 가면 두 번 작업이 됨.",
    yesAction: "Codex가 url_policy_recommendations.md의 정책안 A를 운영 요청서로 변환 → 아임웹 담당자에게 「이 표 그대로 canonical/noindex 수정해주세요」 형태로 전달 → 작업 완료 후 robots.txt와 sitemap.xml 정리 → Search Console에서 URL 검사로 1차 확인.",
    noAction: "특정 URL 유형(예: 리뷰/검색)은 보류한다고 답하면 그 행만 정책 매트릭스에서 제외하고 나머지 진행. 「전체 NO」면 Phase3 상품 텍스트만 먼저 진행하고 정책은 다음 라운드로.",
    answer: "YES 또는 NO: 리뷰/검색 URL noindex는 보류",
  },
  {
    key: "C",
    title: "상품 4개 텍스트 블록 → 콘텐츠팀 검토 의뢰",
    status: "TJ 응답 대기",
    confidence: 72,
    whatItIs: "이 화면 '상품 텍스트' 섹션에 있는 4개 상품(검사권 2 + 영양제 2)의 H1/H2/H3/FAQ 초안을 콘텐츠팀에 「이 톤·길이로 표시 가능 문구로 다듬어주세요」라고 의뢰하는 작업.",
    currentState: "구조 초안은 완성. 실제 운영 페이지에 들어갈 최종 문구는 아직 아님. 건강기능식품 표시 기준·검사 진행 안내 등 법무·브랜드 검토가 필요한 표현이 섞여 있음.",
    reason: "숨김 텍스트 없이 사용자에게 보이는 구조라 SEO 리스크는 낮지만, 효능·검사 표현은 운영 반영 전에 (1) 최신 상품 상세 안내문과 일치, (2) 표시 가능 문구 내에서만 사용, 두 가지를 콘텐츠팀이 다듬어야 안전.",
    yesAction: "Claude Code가 콘텐츠팀에 보낼 요청서를 reports/seo/content_team_request.md 형태로 정리 → 콘텐츠팀이 4개 상품 문구를 다듬음 → 디자인팀이 PC/모바일 시안 → TJ 최종 승인 → 아임웹 게시.",
    noAction: "특정 상품(예: 뉴로마스터)을 제외하고 싶다면 그 상품만 빼고 나머지 3개로 진행. 전체 NO면 진단·설계만 사용하고 텍스트 추가는 다음 라운드로.",
    answer: "YES 또는 NO: 뉴로마스터는 제외",
  },
] as const;

const SEPARATE_APPROVALS = [
  {
    item: "아임웹 canonical/noindex/redirect 수정",
    why: "검색 노출과 기존 공유 URL에 직접 영향. 잘못 설정하면 색인이 빠지거나 외부 공유 링크가 깨질 수 있음.",
    how: "아임웹 관리자 페이지 > SEO 설정에서 URL 유형별 canonical 목적지를 수동 입력. noindex는 페이지별 메타 robots 설정.",
    codex: "공개 URL 진단과 정책 초안 작성까지 완료.",
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
        <h2 className={styles.sectionH}>승인 현황</h2>
        <span className={styles.sectionTag}>!seoplan.md 승인 섹션</span>
      </div>

      <WhyCallout tone="info" title="이 섹션은 어떤 결정을 받기 위한 것인가요">
        <p style={{ marginBottom: 8 }}>
          승인안은 「여기까지 진행했고, 다음 단계로 가려면 TJ 답변이 필요한」 결정 게이트입니다.
          A는 이미 완료, <strong>B와 C는 답변 대기 중</strong>입니다.
        </p>
        <p>
          각 카드에는 <strong>(1) 이게 무엇인지</strong>, <strong>(2) 지금 어디까지 됐는지</strong>,
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
                <span className={styles.approvalBadge} data-waiting={waiting}>{a.status}</span>
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
              <div className={styles.approvalAction} data-tone="yes">
                <span className={styles.approvalActionLabel}>YES 하면</span>
                <span>{a.yesAction}</span>
              </div>
              {a.noAction && a.noAction !== "(해당 없음)" && (
                <div className={styles.approvalAction} data-tone="no">
                  <span className={styles.approvalActionLabel}>NO 하면</span>
                  <span>{a.noAction}</span>
                </div>
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
        <h3 className={styles.colH}>운영 반영 전 별도 승인 (위 A/B/C와 별개로 단계마다 한 번씩 더)</h3>
        <WhyCallout tone="warning">
          A/B/C가 「방향 결정」 게이트라면, 아래 5개는 「실제 운영에 손대기 직전」의 마지막 게이트입니다.
          예: 승인안 B에서 YES를 받아도, 실제로 아임웹 canonical을 바꾸기 직전에 <strong>이 표의 첫 줄</strong>을 다시 한 번 확인합니다.
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
