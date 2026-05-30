import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";

type GuideCard = {
  title: string;
  label: string;
  body: string;
  bullets: string[];
};

type Step = {
  title: string;
  who: string;
  why: string;
  how: string;
  success: string;
  lane: "Green" | "Yellow" | "Red";
};

type ReviewItem = {
  title: string;
  when: string;
  question: string;
  evidence: string;
};

const checkedAtKst = "2026-05-23 23:49 KST";

const sharePrompt = `이 페이지 기준으로 작업해줘.

1. 먼저 Green / Yellow / Red 중 어느 Lane인지 판단해.
2. Green이면 묻지 말고 조사·설계·로컬검증·문서화까지 진행해.
3. Yellow이면 승인된 범위 안에서 backup → apply → smoke → rollback-ready → report까지 진행해.
4. Red이면 실제 외부 전송, GTM 운영 게시, 운영DB write, 고객 식별자 전송 확대 전에는 멈춰.
5. 작업이 끝나면 /Users/vibetj/coding/seo/harness/autonomy-evaluation-20260523/ 폴더에 평가 메모를 남겨. 파일명은 네가 날짜와 작업명으로 정해.`;

const guideCards: GuideCard[] = [
  {
    title: "Green은 물어보지 말고 끝까지",
    label: "자동 진행",
    body: "문서, read-only 조회, dry-run, no-send preview, 로컬 테스트처럼 운영에 직접 영향을 주지 않는 일입니다.",
    bullets: [
      "조사하다 멈추지 말고, 가능한 결론과 다음 승인안까지 작성합니다.",
      "실패하면 승인 부족이라고 쓰지 말고 권한·데이터·기술 문제 중 무엇인지 분리합니다.",
      "외부 전송, 운영DB write, GTM publish, VM Cloud 배포가 필요해지는 순간 Lane을 올립니다.",
    ],
  },
  {
    title: "Yellow는 한 번 승인 후 닫기",
    label: "제한 운영",
    body: "되돌릴 수 있는 VM Cloud/프론트 배포, 제한된 smoke, cron/precompute ON 같은 작업입니다.",
    bullets: [
      "승인 패킷에 작업 범위, 금지선, 백업, 검증, rollback이 있어야 합니다.",
      "승인 후에는 중간 확인을 반복하지 않고 post-check와 결과보고까지 진행합니다.",
      "성공 기준이 숫자/API/화면으로 없으면 Yellow 실행 전 HOLD로 둡니다.",
    ],
  },
  {
    title: "Red는 반드시 멈추기",
    label: "명시 승인",
    body: "광고 플랫폼 전송, GTM Production publish, 운영DB write, 실제 결제 테스트, 고객 식별자 전송 확대처럼 돈·고객·계정에 직접 영향이 있는 일입니다.",
    bullets: [
      "승인 문구가 있어도 범위 밖 send/write/publish가 필요하면 다시 멈춥니다.",
      "승인 요청은 화면 이름, 바꾸는 설정, 생기는 효과, 안 바꾸면 남는 문제를 사람 말로 씁니다.",
      "Red를 Green처럼 처리하지 않는 것이 이 하네스의 핵심 안전장치입니다.",
    ],
  },
];

const workflowSteps: Step[] = [
  {
    title: "Lane을 먼저 정합니다",
    who: "작업을 시작한 에이전트",
    why: "작업 속도보다 먼저 위험도를 분리해야 불필요한 승인과 위험한 자동화를 동시에 줄일 수 있습니다.",
    how: "운영 영향이 없는지, 배포가 필요한지, 외부 플랫폼에 실제 신호를 보내는지 확인합니다.",
    success: "Green / Yellow / Red 중 하나가 작업 시작 문서나 보고에 명확히 적힙니다.",
    lane: "Green",
  },
  {
    title: "작업 후 메모를 남깁니다",
    who: "이 창 또는 다른 SEO 작업 창",
    why: "하루이틀 뒤에 어느 창에서 잘 됐고 어디서 또 막혔는지 한 폴더에서 평가하기 위해서입니다.",
    how: "정확한 파일명을 외우지 말고, 평가 폴더 안에 날짜와 작업명이 들어간 메모 파일을 만듭니다.",
    success: "평가 폴더에 작업 요약, Lane, 검증 결과, 남은 리스크가 남습니다.",
    lane: "Green",
  },
  {
    title: "24시간·48시간 뒤 평가합니다",
    who: "Codex",
    why: "Standing Authorization Map이 실제로 컨펌을 줄였는지, 위험한 작업을 잘 막았는지 확인하기 위해서입니다.",
    how: "이 창 기록과 다른 창의 메모를 모아 Green 자율 진행률, Yellow 완료율, Red 차단 여부를 점검합니다.",
    success: "다음에 더 자동화할 항목과 여전히 승인이 필요한 항목이 분리됩니다.",
    lane: "Green",
  },
  {
    title: "다음 Yellow 작업에 표준 패킷을 씁니다",
    who: "Codex",
    why: "프로젝트마다 할 일은 달라도, 백업·검증·rollback은 매번 빠지면 안 되기 때문입니다.",
    how: "Yellow 패킷에 실제 파일/API/성공 기준을 채우고, 승인 후 적용부터 보고까지 이어갑니다.",
    success: "승인 1회 후 setup, apply, smoke, rollback-ready, report가 한 번에 닫힙니다.",
    lane: "Yellow",
  },
];

const reviewItems: ReviewItem[] = [
  {
    title: "Green 작업이 중간 질문 없이 끝났는가",
    when: "24시간 뒤",
    question: "조사·문서·dry-run·로컬 테스트에서 불필요한 승인 대기가 줄었는가?",
    evidence: "작업 메모의 Lane, 완료 범위, 검증 결과",
  },
  {
    title: "Yellow 작업이 한 번 승인 후 끝났는가",
    when: "24~48시간 뒤",
    question: "승인 후 backup, apply, smoke, rollback-ready, report까지 추가 확인 없이 진행됐는가?",
    evidence: "Yellow 패킷과 post-check 결과",
  },
  {
    title: "Red 작업을 정확히 멈췄는가",
    when: "48시간 뒤",
    question: "외부 전송, GTM 운영 게시, 운영DB write, 고객 식별자 확대가 승인 없이 실행되지 않았는가?",
    evidence: "금지선 준수 기록, send/write/publish 0 확인",
  },
  {
    title: "다른 창 기록이 합쳐졌는가",
    when: "48시간 뒤",
    question: "SEO 프로젝트의 다른 Codex/Claude 창도 같은 폴더에 작업 메모를 남겼는가?",
    evidence: "평가 폴더 안의 window-note 파일",
  },
];

export default function HarnessGuidePage() {
  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Harness Collaboration Guide</p>
            <h1>다른 작업 창에는 이 링크만 던지면 됩니다</h1>
            <p>
              하네스는 “계속 물어보게 만드는 문서”가 아니라, 안전한 일은 에이전트가 끝까지 하고
              위험한 일만 정확히 멈추게 만드는 운영 규칙입니다. 이 페이지는 다른 Codex/Claude Code 창이
              같은 기준으로 움직이도록 만든 공유용 안내서입니다.
            </p>
          </div>
          <aside className={styles.metaBox}>
            <span>기준 시각</span>
            <strong>{checkedAtKst}</strong>
            <p>source: Standing Authorization Map · Yellow packet · autonomy evaluation folder</p>
            <p>운영 영향 0 · 외부 전송 0 · DB write 0 · GTM publish 0</p>
          </aside>
        </header>

        <section className={styles.questionPanel}>
          <span>이 화면을 공유하는 이유</span>
          <strong>복잡한 파일 경로 대신, 작업자가 해야 할 행동을 한 화면에서 이해하게 합니다.</strong>
          <p>
            TJ님이 다른 창에 긴 경로를 설명하지 않아도 됩니다. 이 페이지 링크를 주고
            “여기 기준으로 작업하고 평가 메모 남겨”라고만 말하면 됩니다.
          </p>
        </section>

        <section className={styles.sharePanel} aria-label="공유 문구">
          <div>
            <span>복붙용 짧은 지시문</span>
            <h2>다른 작업 창에 이렇게 보내세요</h2>
            <p>
              아래 문구를 그대로 붙여도 되고, 첫 줄만 보내도 됩니다. 정확한 파일명은 작업자가 직접 정하게 해서 부담을 줄였습니다.
            </p>
          </div>
          <pre>{sharePrompt}</pre>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>작업 위험도는 3단계로 나눕니다</h2>
            <p>
              Lane은 작업의 위험도입니다. 운영에 영향이 없으면 빠르게, 되돌릴 수 있으면 한 번 승인 후 끝까지,
              돈·고객·광고 계정에 직접 영향이 있으면 반드시 멈춥니다.
            </p>
          </div>
          <div className={styles.cardGrid}>
            {guideCards.map((card) => (
              <article key={card.title} className={styles.guideCard}>
                <div className={styles.cardTop}>
                  <span>{card.label}</span>
                  <h3>{card.title}</h3>
                </div>
                <p>{card.body}</p>
                <ul>
                  {card.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>작업자는 이 순서만 따르면 됩니다</h2>
            <p>
              “무엇을 어디에 남겨야 하지?”를 줄이기 위해 행동 순서로 썼습니다.
              문서명보다 중요한 것은 Lane, 실제 한 일, 검증, 남은 리스크입니다.
            </p>
          </div>
          <div className={styles.stepList}>
            {workflowSteps.map((step, index) => (
              <article key={step.title} className={styles.stepCard}>
                <div className={styles.stepNumber}>{index + 1}</div>
                <div>
                  <div className={styles.stepTitle}>
                    <h3>{step.title}</h3>
                    <span className={styles[`lane${step.lane}`]}>{step.lane}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>누가</dt>
                      <dd>{step.who}</dd>
                    </div>
                    <div>
                      <dt>왜</dt>
                      <dd>{step.why}</dd>
                    </div>
                    <div>
                      <dt>어떻게</dt>
                      <dd>{step.how}</dd>
                    </div>
                    <div>
                      <dt>성공 기준</dt>
                      <dd>{step.success}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.pathPanel}>
          <div>
            <span>평가 기록을 남기는 곳</span>
            <h2>정확한 파일명은 외우지 않아도 됩니다</h2>
            <p>
              다른 창의 작업자는 아래 폴더에 “날짜 + 시간 + 작업명”으로 메모를 남기면 됩니다.
              예: <code>window-note-20260524-1030-capi-monitoring.md</code>
            </p>
          </div>
          <code>/Users/vibetj/coding/seo/harness/autonomy-evaluation-20260523/</code>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>하루이틀 뒤에는 이렇게 평가합니다</h2>
            <p>
              이 페이지의 목적은 보고서를 예쁘게 만드는 것이 아니라, 실제로 컨펌이 줄고 속도가 빨라졌는지 확인하는 것입니다.
            </p>
          </div>
          <div className={styles.reviewGrid}>
            {reviewItems.map((item) => (
              <article key={item.title} className={styles.reviewCard}>
                <span>{item.when}</span>
                <h3>{item.title}</h3>
                <dl>
                  <div>
                    <dt>볼 질문</dt>
                    <dd>{item.question}</dd>
                  </div>
                  <div>
                    <dt>증거</dt>
                    <dd>{item.evidence}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.related}>
          <Link href="/ai-crm/autonomy-report">에이전트 자율 운영 보고서</Link>
          <Link href="/ai-crm/capi-report">Meta CAPI 개발 보고서</Link>
          <Link href="/ai-crm/leading-indicators">선행지표 에이전트</Link>
          <Link href="/#ai-crm">AI CRM 허브</Link>
        </section>
      </main>
    </>
  );
}
