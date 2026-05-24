import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";

type Lane = {
  name: string;
  plain: string;
  decision: string;
  autonomy: number;
  examples: string[];
  guardrail: string;
  tone: "green" | "yellow" | "red";
};

type ActionCard = {
  title: string;
  why: string;
  how: string;
  owner: string;
  success: string;
  failure: string;
  approval: string;
  confidence: number;
  dependency: string;
};

type ResultCard = {
  title: string;
  status: string;
  done: string;
  effect: string;
  next: string;
};

type YellowPacketPart = {
  title: string;
  plain: string;
  reusable: string;
  projectSpecific: string;
};

const checkedAtKst = "2026-05-23 23:08 KST";

const lanes: Lane[] = [
  {
    name: "Green Lane",
    plain: "읽기, 설계, 문서, 예행연습처럼 운영에 직접 영향을 주지 않는 일",
    decision: "Codex가 묻지 않고 끝까지 진행합니다.",
    autonomy: 95,
    examples: [
      "read-only audit",
      "dry-run과 no-send preview",
      "문서/보고서 작성",
      "로컬 코드 패치와 테스트",
      "승인안 작성",
    ],
    guardrail: "외부 전송, 운영DB 쓰기, GTM publish, VM 배포가 없을 때만 자동 진행합니다.",
    tone: "green",
  },
  {
    name: "Yellow Lane",
    plain: "rollback이 준비된 VM Cloud/프론트 배포처럼 운영 영향은 있지만 되돌릴 수 있는 일",
    decision: "작업 묶음 단위 1회 승인 후 post-check까지 진행합니다.",
    autonomy: 80,
    examples: [
      "VM Cloud backend route 배포",
      "프론트엔드 배포",
      "controlled smoke",
      "cron/precompute ON",
    ],
    guardrail: "pre-snapshot, backup, build, restart, post-check, rollback 명령이 한 패킷에 있어야 합니다.",
    tone: "yellow",
  },
  {
    name: "Red Lane",
    plain: "광고 플랫폼, 결제 신호, 고객 식별자, 운영DB에 실제 영향을 주는 일",
    decision: "반드시 TJ님 명시 승인 전 멈춥니다.",
    autonomy: 30,
    examples: [
      "GTM Production publish",
      "Meta/Google/TikTok 실제 send",
      "대량 backfill",
      "운영DB write/import",
      "고객 식별자 전송 범위 확대",
    ],
    guardrail: "속도를 줄이더라도 승인 기록과 rollback 기준을 남기는 것이 더 싸고 안전합니다.",
    tone: "red",
  },
];

const assets = [
  {
    title: "하네스와 승인 기준",
    plain: "작업을 어디까지 자동으로 맡길지 정하는 안전 울타리입니다.",
    examples: "harness/common, AGENTS.md, docurule.md",
  },
  {
    title: "데이터 계약",
    plain: "프론트가 보는 숫자의 출처, 기간, 단위, 주의점을 약속한 문서입니다.",
    examples: "funnel-health, leading-indicators, CAPI report contract",
  },
  {
    title: "검증 스크립트",
    plain: "사람이 매번 눈으로 보던 확인을 자동으로 반복하는 절차입니다.",
    examples: "post-check, no-send preview, raw scan, preflight check",
  },
  {
    title: "runbook",
    plain: "문제가 났을 때 누구나 같은 순서로 되돌릴 수 있는 운영 설명서입니다.",
    examples: "VM deploy packet, rollback command, Slack daily alert",
  },
];

const weeklyCleanup = [
  "이번 주에 TJ님이 반복해서 물어본 지점을 모읍니다.",
  "Codex가 중간에 멈춘 지점을 하네스 규칙이나 스크립트로 바꿉니다.",
  "반복 SQL/API 조회를 한 번 실행 가능한 명령으로 만듭니다.",
  "어려운 화면 문구를 비전공자도 이해하는 말로 바꿉니다.",
  "Red Lane과 Green Lane이 섞인 지점을 다시 분리합니다.",
];

const standingResults: ResultCard[] = [
  {
    title: "권한 지도를 문서로 고정",
    status: "작성 완료",
    done: "Green, Yellow, Red Lane 정의와 Standing Authorization Table을 만들었습니다.",
    effect: "문서, read-only 조회, dry-run, no-send preview, 로컬 패치는 Codex가 중간 질문 없이 진행할 근거가 생겼습니다.",
    next: "반복되는 작업마다 이 지도를 먼저 적용해 ‘물어볼 일’과 ‘바로 할 일’을 분리합니다.",
  },
  {
    title: "멈춰야 하는 기준을 분리",
    status: "기준 완료",
    done: "Meta/Google 실제 전송, GTM 운영 게시, Imweb 저장, 운영DB write, 실제 결제 테스트는 Red Lane으로 고정했습니다.",
    effect: "속도를 올리면서도 광고 학습, 고객 정보, 결제 데이터가 무승인으로 바뀌는 위험은 막습니다.",
    next: "Red Lane 요청은 화면/설정/효과/안 바꾸면 남는 문제/rollback을 포함한 좁은 승인안으로만 올립니다.",
  },
  {
    title: "Yellow는 1회 승인 후 끝까지",
    status: "운영 방식 확정",
    done: "VM Cloud 배포, 프론트 배포, cron/precompute ON, Slack monitoring 같은 되돌릴 수 있는 운영 반영은 Yellow로 묶고, 재사용 템플릿까지 만들었습니다.",
    effect: "승인 후에는 backup, apply, restart, smoke, rollback 준비, 결과보고까지 Codex가 이어서 닫을 수 있습니다.",
    next: "각 프로젝트의 배포 승인안은 `yellow-lane-deploy-packet-template-20260523.md`를 쓰되, 바꾸는 파일과 성공 기준은 프로젝트별로 다르게 채웁니다.",
  },
  {
    title: "컨펌 감소 예상",
    status: "부분 적용",
    done: "현재 화면과 문서 기준으로 Green은 약 90~95%, Yellow는 약 70~85%까지 자동 진행 가능하게 정리했습니다.",
    effect: "반복 질문은 줄고, TJ님은 실제 돈/계정/고객 데이터에 영향이 있는 판단에 집중할 수 있습니다.",
    next: "다음 1~2개 스프린트에서 Yellow 승인 후 중간 컨펌 없이 끝까지 닫히는지 실제로 측정합니다.",
  },
];

const appliedResults: ResultCard[] = [
  {
    title: "다음 Yellow 작업에 템플릿 적용",
    status: "적용 완료",
    done: "CAPI 안정화 감시와 선행지표/보고서 운영 반영을 다음 실제 Yellow 후보로 잡고, 승인 패킷에 작업 범위·금지선·성공 기준·rollback 기준을 채웠습니다.",
    effect: "다음 VM Cloud 또는 프론트 배포 때 승인안을 처음부터 다시 만들지 않고, 바꾸는 파일과 성공 숫자만 채우면 됩니다.",
    next: "실제 배포 대상이 정해지면 `harness/autonomy-evaluation-20260523/01-next-yellow-capi-monitoring-packet.md`를 기준으로 Yellow 승인 1회 후 post-check까지 닫습니다.",
  },
  {
    title: "1~2일 뒤 평가 폴더 생성",
    status: "기록 준비",
    done: "이 창과 SEO 프로젝트를 진행하는 다른 창의 작업 결과를 한 곳에 남길 수 있도록 `harness/autonomy-evaluation-20260523/` 폴더를 만들었습니다.",
    effect: "Standing Authorization Map이 실제로 컨펌을 줄였는지, Red Lane을 잘 막았는지 24시간·48시간 뒤 같은 기준으로 평가할 수 있습니다.",
    next: "다른 창에서 작업한 내용은 `window-note-template.md` 양식으로 같은 폴더에 남기면, 다음 평가 때 함께 집계합니다.",
  },
  {
    title: "다른 창 기록 방식 통일",
    status: "양식 완료",
    done: "다른 Codex/Claude Code 창이 남길 메모 양식을 만들고, Lane·실제 한 일·멈춘 일·검증·남은 리스크를 필수 항목으로 정했습니다.",
    effect: "대화창이 달라도 작업 결과가 흩어지지 않고, 하루이틀 뒤 ‘어디서 잘 됐고 어디서 또 멈췄는지’를 비교할 수 있습니다.",
    next: "SEO 프로젝트의 다른 창에서 작업이 끝나면 `window-note-YYYYMMDD-HHMM-<topic>.md` 파일로 짧게 남깁니다.",
  },
  {
    title: "운영 영향 없는 준비로 제한",
    status: "Green 유지",
    done: "이번 반영은 문서와 로컬 프론트 보고서 업데이트만 포함했고, VM Cloud 배포·restart·외부 전송·GTM/Imweb 변경은 하지 않았습니다.",
    effect: "자동화 기준을 강화하면서도 광고 플랫폼, 결제 원장, 고객 데이터에는 영향을 주지 않습니다.",
    next: "실제 배포나 cron ON이 필요해지는 순간에는 Yellow 또는 Red 기준으로 다시 분리합니다.",
  },
];

const yellowPacketParts: YellowPacketPart[] = [
  {
    title: "공통으로 묶을 것",
    plain: "배포 전후에 항상 필요한 안전 절차입니다.",
    reusable: "pre-snapshot, backup, build/typecheck, restart, health check, rollback command, 결과보고",
    projectSpecific: "어느 프로젝트든 순서는 거의 같습니다. 그래서 매번 새로 설명하지 않게 고정합니다.",
  },
  {
    title: "프로젝트마다 바꿀 것",
    plain: "실제로 무엇을 바꾸고 무엇을 성공으로 볼지는 프로젝트마다 다릅니다.",
    reusable: "승인 문구 형식과 필수 항목",
    projectSpecific: "CAPI는 send 0/duplicate 0, 선행지표는 cache hit/집계값, Slack은 알림 빈도/채널이 성공 기준입니다.",
  },
  {
    title: "효과가 있는 이유",
    plain: "표준 패킷은 일을 똑같이 만들자는 뜻이 아니라, 빠뜨리면 위험한 항목을 자동으로 챙기는 장치입니다.",
    reusable: "체크리스트, rollback 위치, post-check 방식",
    projectSpecific: "프로젝트별 세부 작업은 계속 다르게 설계합니다. 공통화 대상은 안전 절차와 보고 구조입니다.",
  },
  {
    title: "템플릿까지 준비",
    plain: "다음 Yellow 작업에서 바로 복사해 채울 수 있는 승인안 양식을 문서로 분리했습니다.",
    reusable: "사람 말 요약, 작업 범위, 백업, 적용 순서, 성공 기준, rollback, 보고 양식",
    projectSpecific: "CAPI, Slack, 프론트, 선행지표마다 성공 숫자와 확인 화면은 다르게 넣습니다.",
  },
];

const actions: ActionCard[] = [
  {
    title: "Standing Authorization Map을 실제 작업에 적용",
    why: "문서만 만들면 효과가 없습니다. 다음 스프린트부터 ‘이 작업은 Green이라 바로 한다’고 실행 기준으로 써야 합니다.",
    how: "CAPI, GTM, VM Cloud, 선행지표 요청마다 시작 시 Green/Yellow/Red를 먼저 표시하고, Green은 질문 없이 완료까지 진행합니다.",
    owner: "Codex",
    success: "read-only audit, dry-run, 문서, 로컬 패치, 승인안 작성이 중간 컨펌 없이 끝납니다.",
    failure: "실제 외부 전송이나 운영DB 변경이 Green에 섞이면 즉시 Red로 올리고 멈춥니다.",
    approval: "운영 규칙 적용은 승인 불필요, Red 누락이 보이면 TJ님 피드백 필요",
    confidence: 94,
    dependency: "이미 작성된 Standing Authorization Map을 기준으로 바로 적용합니다.",
  },
  {
    title: "Yellow Lane 배포 패킷을 프로젝트별로 채우기",
    why: "VM Cloud 배포 때 파일 복사, 빌드, 재시작, post-check를 단계마다 다시 묻지 않기 위해서입니다.",
    how: "새 템플릿에 사람 말 요약, 작업 범위, backup, build, restart, API smoke, rollback을 채우고, 성공 기준은 프로젝트별로 다르게 씁니다.",
    owner: "Codex",
    success: "TJ님이 ‘이 배포 패킷 승인’ 한 번만 말하면 Codex가 post-check까지 끝냅니다.",
    failure: "rollback 명령이 없거나 성공 기준이 숫자로 없으면 Yellow가 아니라 HOLD로 둡니다.",
    approval: "템플릿 작성은 승인 불필요, 실제 배포는 Yellow 승인 필요",
    confidence: 91,
    dependency: "템플릿은 준비됐습니다. 실제 배포 대상 파일/API/성공 숫자가 정해지면 바로 채울 수 있습니다.",
  },
  {
    title: "CAPI는 안정화 감시, 선행지표는 성장 분석으로 전환",
    why: "Purchase CAPI는 많이 회복됐고, 이제 파급력은 ‘구매 전에 어떤 행동이 매출을 예고하는가’를 찾는 데 있습니다.",
    how: "CAPI는 누락 큐와 이벤트 매칭 품질을 매일 감시하고, 선행지표 에이전트는 Meta/Google/YouTube/Organic 코호트를 비교합니다.",
    owner: "Codex가 데이터/화면 계약 정리, Claude Code가 프론트 구현",
    success: "구매 완료, 결제 멈춤, GA4 충돌, 보류 cohort가 분리되고 다음 액션이 화면에 보입니다.",
    failure: "GA4와 VM Cloud join이 낮으면 raw-id Plan B가 아니라 key capture 보강부터 검토합니다.",
    approval: "read-only/설계는 승인 불필요, 외부 전송 확장은 Red 승인 필요",
    confidence: 88,
    dependency: "CAPI daily alert와 leading-indicators P1 endpoint가 있으면 정확도가 올라갑니다.",
  },
];

const summaryStats = [
  { label: "Green 자동화 가능성", value: "90~95%", note: "문서, 조사, dry-run, 로컬 검증" },
  { label: "Yellow 자동화 가능성", value: "70~85%", note: "1회 승인 후 배포·검증·rollback 준비" },
  { label: "Red 자동화 가능성", value: "20~40%", note: "승인 없는 자동화는 위험" },
  { label: "현재 성숙도", value: "65~75%", note: "30일 안에 85%까지 개선 가능" },
];

export default function AutonomyReportPage() {
  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Agent Operating Report</p>
            <h1>컨펌을 줄이되, 위험한 자동화는 막는 운영 방식으로 바꿉니다</h1>
            <p>
              “에이전트가 알아서 끝까지 일하게 만들 수 있는가?”에 대한 답입니다.
              우리 프로젝트는 광고비, 결제, 고객 식별자, 외부 플랫폼 전송이 걸려 있어서
              무조건 자동화가 아니라 위험 단계별 자동화가 필요합니다.
            </p>
          </div>
          <aside className={styles.sourceBox}>
            <span>데이터 기준</span>
            <strong>{checkedAtKst}</strong>
            <p>source: TJ님 제공 전사 내용 · 현재 harness/doc rule · 로컬 정리 문서</p>
            <p>운영 영향 0 · 외부 전송 0 · VM Cloud 변경 0</p>
          </aside>
        </header>

        <section className={styles.questionPanel} aria-label="이 화면의 질문">
          <span>이 화면의 질문</span>
          <strong>우리가 더 빠르게 할 수 있는데, 컨펌이 많아서 느린 것인가?</strong>
          <p>
            일부는 맞습니다. Green Lane은 지금보다 훨씬 자율적으로 진행할 수 있습니다.
            다만 이 프로젝트는 Meta·Google·GTM·결제 원장에 연결되어 있어서 Red Lane까지
            무승인으로 밀면 ROAS와 개인정보, 광고 학습을 망칠 수 있습니다.
          </p>
        </section>

        <section className={styles.summaryGrid} aria-label="자동화 가능성 요약">
          {summaryStats.map((stat) => (
            <article key={stat.label} className={styles.summaryCard}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.note}</p>
            </article>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Standing Authorization Map은 여기까지 정리됐습니다</h2>
            <p>
              Standing Authorization Map은 “Codex가 어디까지 알아서 하고, 어디서 반드시 멈출지”를 정한 권한 지도입니다.
              아직 자동화 시스템이 아니라, 다음 작업부터 적용할 운영 기준입니다.
            </p>
          </div>
          <div className={styles.resultGrid}>
            {standingResults.map((item) => (
              <article key={item.title} className={styles.resultCard}>
                <div className={styles.resultHead}>
                  <strong>{item.title}</strong>
                  <span>{item.status}</span>
                </div>
                <dl>
                  <div>
                    <dt>무엇을 했나</dt>
                    <dd>{item.done}</dd>
                  </div>
                  <div>
                    <dt>기대효과</dt>
                    <dd>{item.effect}</dd>
                  </div>
                  <div>
                    <dt>다음 적용</dt>
                    <dd>{item.next}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>이번에는 실제 적용 위치까지 만들었습니다</h2>
            <p>
              권한 지도를 문서로만 끝내지 않고, 다음 Yellow 작업에 바로 쓸 승인 패킷과
              하루이틀 뒤 평가할 폴더를 만들었습니다.
            </p>
          </div>
          <div className={styles.resultGrid}>
            {appliedResults.map((item) => (
              <article key={item.title} className={styles.resultCard}>
                <div className={styles.resultHead}>
                  <strong>{item.title}</strong>
                  <span>{item.status}</span>
                </div>
                <dl>
                  <div>
                    <dt>무엇을 했나</dt>
                    <dd>{item.done}</dd>
                  </div>
                  <div>
                    <dt>기대효과</dt>
                    <dd>{item.effect}</dd>
                  </div>
                  <div>
                    <dt>다음 적용</dt>
                    <dd>{item.next}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>자동으로 맡길 일과 반드시 멈출 일을 나눕니다</h2>
            <p>
              Lane은 작업 위험도입니다. 고속도로 차선처럼, 어떤 차선에 있느냐에 따라 속도와 브레이크 기준이 달라집니다.
            </p>
          </div>
          <div className={styles.laneGrid}>
            {lanes.map((lane) => (
              <article key={lane.name} className={`${styles.laneCard} ${styles[lane.tone]}`}>
                <div className={styles.laneTop}>
                  <div>
                    <span>{lane.name}</span>
                    <h3>{lane.plain}</h3>
                  </div>
                  <strong>{lane.autonomy}%</strong>
                </div>
                <p className={styles.decision}>{lane.decision}</p>
                <ul>
                  {lane.examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
                <p className={styles.guardrail}>{lane.guardrail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Yellow Lane 배포 패킷은 모든 프로젝트를 똑같이 만들자는 뜻이 아닙니다</h2>
            <p>
              Yellow 패킷은 “안전벨트”입니다. CAPI, 선행지표, Slack, 프론트 배포처럼 할 일은 달라도
              배포 전 백업과 배포 후 확인, 되돌리는 방법은 매번 빠지면 안 됩니다.
            </p>
          </div>
          <div className={styles.packetGrid}>
            {yellowPacketParts.map((item) => (
              <article key={item.title} className={styles.packetCard}>
                <strong>{item.title}</strong>
                <p>{item.plain}</p>
                <dl>
                  <div>
                    <dt>재사용할 부분</dt>
                    <dd>{item.reusable}</dd>
                  </div>
                  <div>
                    <dt>프로젝트마다 달라지는 부분</dt>
                    <dd>{item.projectSpecific}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>코드보다 오래 남겨야 할 자산</h2>
            <p>
              코드는 바뀌어도 괜찮습니다. 다음 모델과 다음 작업에도 남아야 하는 것은 기준, 계약, 검증, 운영 설명서입니다.
            </p>
          </div>
          <div className={styles.assetGrid}>
            {assets.map((asset) => (
              <article key={asset.title} className={styles.assetCard}>
                <strong>{asset.title}</strong>
                <p>{asset.plain}</p>
                <small>{asset.examples}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>매주 해야 하는 청소</h2>
            <p>
              “또 물어본 일”과 “또 막힌 일”은 다음 주에도 반복됩니다. 금요일마다 수동 확인을 하네스와 스크립트로 바꿉니다.
            </p>
          </div>
          <ol className={styles.cleanupList}>
            {weeklyCleanup.map((item, index) => (
              <li key={item}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.actionSection}>
          <div className={styles.sectionHeader}>
            <h2>바로 다음 할 일</h2>
            <p>
              아래는 “좋은 생각”이 아니라 실행 순서입니다. Green은 바로 진행하고, Yellow는 한 번만 승인받는 구조로 만듭니다.
            </p>
          </div>
          <div className={styles.actionGrid}>
            {actions.map((action, index) => (
              <article key={action.title} className={styles.actionCard}>
                <div className={styles.actionHead}>
                  <span>{index + 1}</span>
                  <strong>{action.title}</strong>
                </div>
                <dl>
                  <div>
                    <dt>왜</dt>
                    <dd>{action.why}</dd>
                  </div>
                  <div>
                    <dt>어떻게</dt>
                    <dd>{action.how}</dd>
                  </div>
                  <div>
                    <dt>누가</dt>
                    <dd>{action.owner}</dd>
                  </div>
                  <div>
                    <dt>성공 기준</dt>
                    <dd>{action.success}</dd>
                  </div>
                  <div>
                    <dt>실패 시 확인점</dt>
                    <dd>{action.failure}</dd>
                  </div>
                  <div>
                    <dt>승인</dt>
                    <dd>{action.approval}</dd>
                  </div>
                  <div>
                    <dt>의존성</dt>
                    <dd>{action.dependency}</dd>
                  </div>
                </dl>
                <div className={styles.confidence}>추천 점수 / 자신감 {action.confidence}%</div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.related}>
          <Link href="/ai-crm/harness-guide">하네스 협업 가이드</Link>
          <Link href="/ai-crm/capi-report">Meta CAPI 개발 보고서</Link>
          <Link href="/ai-crm/leading-indicators">선행지표 에이전트</Link>
          <Link href="/#ai-crm">AI CRM 허브로 돌아가기</Link>
        </section>
      </main>
    </>
  );
}
