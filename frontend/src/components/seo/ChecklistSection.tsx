"use client";

import styles from "./seo.module.css";
import WhyCallout from "./WhyCallout";
import type { ChecklistResponse } from "./seo.types";

type Props = {
  data: ChecklistResponse | null;
};

const PRIORITY_LABEL: Record<string, { label: string; tone: "urgent" | "opportunity" | "recommend" }> = {
  P0: { label: "P0 즉시", tone: "urgent" },
  P1: { label: "P1 이번 주", tone: "opportunity" },
  P2: { label: "P2 다음 배치", tone: "recommend" },
};

const GATE_DESCRIPTIONS: Record<string, string> = {
  "승인안 B 답변": "URL 정책 매트릭스를 운영 요청서로 발행할지 TJ가 YES/NO로 답해야 다음 단계로 진행. 답이 없으면 아임웹 canonical 정리·robots.txt sitemap 정리·sitemap 제외 작업을 시작할 수 없습니다.",
  "승인안 C 답변": "상품 4개 텍스트 블록 초안을 콘텐츠팀에 검토 의뢰할지 TJ가 YES/NO로 답. 답이 없으면 콘텐츠팀 작업이 시작 안 되고, 검색엔진 본문 인식 점수(현재 7/15)를 올릴 수 없습니다.",
  "대표 URL 최종표 작성": "승인안 B가 YES면 Codex가 모든 유형(상품·검사권·칼럼 등)별 canonical/sitemap/noindex/redirect를 한 표로 묶은 운영 요청서를 만듭니다. 아임웹 담당자가 그 표만 보고 작업할 수 있도록.",
  "JSON-LD 최종본 작성": "승인된 대표 URL 정책에 맞춰 JSON-LD 5개 스니펫의 url 필드를 최종 정리. 페이지 url과 JSON-LD url이 다르면 구글이 무시합니다.",
  "상품 상세 텍스트 UI 시안": "콘텐츠팀이 다듬은 텍스트를 PC/모바일에 어떻게 배치할지 디자인 시안. 통이미지 위·아래 어디에 둘지, 글자 크기·색을 어떻게 할지 정함.",
  "아임웹 또는 GTM 게시 승인": "최종 검토 후 실제 운영에 반영할지 TJ가 결정. 게시 범위(시범 4개 페이지만 vs 전체)와 문제 시 즉시 되돌릴 방법(rollback)을 함께 확인.",
};

const RUN_ORDER_REASONS: Record<number, string> = {
  0: "robots.txt의 sitemap 지시문 형식만 정리. 검색엔진이 sitemap을 더 잘 발견.",
  1: "리뷰·검색·로그인 URL을 sitemap에서 빼고 noindex 처리. 색인 예산이 좋은 페이지로 모임.",
  2: "상품·검사권 대표 URL을 1개로 통일. canonical·내부 링크·sitemap이 같은 URL을 가리키게 정리.",
  3: "JSON-LD를 시범 페이지 6개에 삽입. 검색결과에 가격·이미지·리치 결과가 뜨기 시작.",
  4: "통이미지 사이에 텍스트 블록 삽입. 검색엔진이 상품 설명을 본문으로 읽을 수 있게 됨.",
  5: "Search Console / Naver Search Advisor에 sitemap을 다시 제출하고 핵심 URL은 색인 요청. 1~7일 안에 반영 시작.",
  6: "주간 단위로 GSC 클릭/노출/CTR/순위 변화를 비교. 효과가 없거나 부정적이면 롤백 기준 가동.",
};

export default function ChecklistSection({ data }: Props) {
  if (!data) {
    return (
      <section id="checklist" className={styles.section}>
        <h2 className={styles.sectionH}>운영 체크리스트</h2>
        <p className={styles.sectionEmpty}>체크리스트 데이터를 불러오지 못했습니다.</p>
      </section>
    );
  }

  return (
    <section id="checklist" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionH}>운영 체크리스트</h2>
        <span className={styles.sectionTag}>operation_change_checklist.md · action_plan.csv</span>
      </div>

      <WhyCallout tone="info" title="이 섹션은 어떤 흐름인가요">
        <p style={{ marginBottom: 8 }}>
          운영 사이트(아임웹·GTM·Search Console)는 한 번 바꾸면 검색 노출과 매출에 직접 영향을 주기 때문에,
          「누가 무엇을 어떤 순서로 승인하고 반영할지」를 단계별로 정합니다.
        </p>
        <p>
          단계: <strong>(1) 운영 전 6단계 게이트</strong> — TJ 응답 대기/Codex 작업/Claude Code 작업이 순서대로
          → <strong>(2) 운영 반영 7단계</strong> — robots부터 모니터링까지
          → <strong>(3) 롤백 기준</strong> — 효과 없거나 문제 생기면 어떻게 되돌릴지.
        </p>
      </WhyCallout>

      <h3 className={styles.colH}>운영 전 확인 (승인 게이트)</h3>
      <div className={styles.gateList}>
        {data.preChecks.map((c) => {
          const isWaiting = c.owner.includes("TJ");
          const desc = GATE_DESCRIPTIONS[c.task];
          return (
            <div key={c.order + c.task} className={styles.gateRow}>
              <div className={styles.gateOrder}>{c.order}</div>
              <div className={styles.gateOwner} data-waiting={isWaiting}>{c.owner}</div>
              <div className={styles.gateBody}>
                <div className={styles.gateTask}>{c.task}</div>
                <div className={styles.gateMeta}>{c.artifact} · {c.doneCriteria}</div>
                {desc && <div className={styles.gateDesc}>{desc}</div>}
              </div>
              {isWaiting && <span className={styles.gateBadge}>응답 대기</span>}
            </div>
          );
        })}
      </div>

      <div className={styles.runRollback}>
        <div className={styles.runCol}>
          <h3 className={styles.colH}>운영 반영 순서 (각 단계가 무엇을 바꾸는지)</h3>
          <ol className={styles.checkList}>
            {data.runOrder.map((r, i) => (
              <li key={i} className={styles.runItem}>
                <span className={styles.checkDot}>{i + 1}</span>
                <div>
                  <div>{r}</div>
                  {RUN_ORDER_REASONS[i] && <div className={styles.runReason}>{RUN_ORDER_REASONS[i]}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.runCol}>
          <h3 className={styles.colH}>롤백 기준 (이렇게 되면 되돌리기)</h3>
          <ul className={styles.principleList}>
            {data.rollback.map((r, i) => (
              <li key={i}><span className={styles.principleDot}>·</span>{r}</li>
            ))}
          </ul>
          <WhyCallout tone="warning">
            모든 변경은 단계별로 작은 범위(시범 4개 페이지)에서 시작합니다. 7일 단위 GSC 비교에서 클릭·CTR·순위가
            의미 있게 떨어지면 즉시 해당 단계만 되돌립니다.
          </WhyCallout>
        </div>
      </div>

      <h3 className={styles.colH} style={{ marginTop: 28 }}>실행 액션 ({data.actions.length})</h3>
      <WhyCallout tone="info">
        우선순위(P0/P1/P2), 담당, 기대 효과, 난이도, 리스크, 근거 파일, 권장 마감일을 표로 정리.
        P0가 먼저, P1이 그 다음. 「근거 파일」 컬럼은 이 화면 위쪽에서 본 진단 문서들을 가리킵니다.
      </WhyCallout>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>우선순위</th>
              <th>작업</th>
              <th>담당</th>
              <th>기대 효과</th>
              <th>난이도</th>
              <th>리스크</th>
              <th>근거 파일</th>
              <th>마감</th>
            </tr>
          </thead>
          <tbody>
            {data.actions.map((a, i) => {
              const meta = PRIORITY_LABEL[a.priority] ?? { label: a.priority, tone: "recommend" as const };
              return (
                <tr key={i}>
                  <td><span className={styles.actionTag} data-tone={meta.tone}>{meta.label}</span></td>
                  <td>{a.task}</td>
                  <td>{a.owner}</td>
                  <td>{a.expectedImpact}</td>
                  <td>{a.difficulty}</td>
                  <td>{a.risk}</td>
                  <td className={styles.pageCellMetaSmall}><code>{a.evidenceFile}</code></td>
                  <td>{a.recommendedDeadline}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
