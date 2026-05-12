# Next Actions And Approval

## Claude Code가 할 일

1. VM 배포 승인 후 summary API patch 배포.
   - 왜: 로컬에서는 complete_time legacy와 actual confirmed 분리가 끝났지만 live API는 아직 legacy 필드만 보여줍니다.
   - 어떻게: `gdn/option-c-summary-api-deploy-approval-20260512.md`의 pre-snapshot → file copy → build → restart → post-snapshot 순서.
   - 승인 필요: YES. VM deploy/restart가 포함됩니다.
   - 성공 기준: biocom 응답에 `derived.npay_revenue_30d_actual_confirmed.status=included`, upload/send invariant 0.
   - 실패 시: pre-deploy backup으로 rollback.
   - 추천 점수/자신감: 91%.

2. thecleancoffee actual source 격리 조사.
   - 왜: 운영DB `tb_iamweb_users`를 coffee actual primary로 쓰려면 site 분리가 먼저 증명되어야 합니다.
   - 어떻게: order bridge 또는 coffee 전용 operational source를 read-only로 확인.
   - 승인 필요: NO, read-only Green.
   - 성공 기준: coffee actual confirmed source가 `included`로 승격 가능한 증거 확보.
   - 실패 시: bridge_pending 유지.
   - 추천 점수/자신감: 82%.

## TJ님이 할 일

1. VM 배포 승인 여부 결정.
   - 무엇을 승인: summary API에 NPay actual confirmed 분리 필드를 배포하고 backend를 restart하는 작업.
   - 왜 필요한지: live dashboard가 여전히 legacy complete_time 값만 보면 최신 실제 NPay 매출과 차이가 납니다.
   - 어디에서: `gdn/option-c-summary-api-deploy-approval-20260512.md` 승인안 확인.
   - 성공 기준: 승인 후 live API에서 actual confirmed 필드가 보이고 기존 legacy 필드도 유지.
   - 실패 시 해석: 승인 보류면 live 화면은 기존 complete_time 기준으로 남습니다.
   - Claude Code가 대신 못 하는 이유: deploy/restart는 Yellow gate라 별도 승인 전 실행 금지입니다.
   - 추천 점수/자신감: 91%.
