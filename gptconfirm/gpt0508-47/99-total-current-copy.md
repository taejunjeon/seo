# Total Current Snapshot Pointer

작성 시각: 2026-05-12 22:35 KST

정본 파일: `total/!total-current.md`

본 패키지는 긴 정본 문서 전체를 중복 복사하지 않고, gpt0508-47에서 추가한 최신 state만 요약합니다. 전체 현재 정본은 `total/!total-current.md`를 직접 확인합니다.

## gpt0508-47 추가 요약

Option C live 배포는 PASS입니다. 화면이 보던 NPay 매출을 `complete_time` legacy 진단값과 실제 결제완료 기준값으로 분리했고, biocom은 운영DB `PAYMENT_COMPLETE` actual confirmed가 live summary API에 included로 붙었습니다. thecleancoffee는 운영DB `tb_iamweb_users` site 격리와 주문번호 매칭이 아직 증명되지 않아 actual included가 아니라 `bridge_pending`을 유지합니다.

현재 live refresh 기준(2026-05-12 22:11 KST): biocom actual confirmed는 163건 / ₩29,500,200 / max payment complete 2026-05-12T07:10:27.000Z이고, legacy `complete_time`은 127건 / ₩25,168,000입니다. biocom bridge pending은 61건 / ₩8,108,600입니다. thecleancoffee actual confirmed는 `bridge_pending`, bridge pending은 76건 / ₩5,110,600입니다.

금지선은 유지됐습니다. 운영DB write 0, Google Ads/GA4/Meta/TikTok/Naver 전송 0, GTM publish 0, Imweb footer 변경 0, cron 등록 0입니다. VM rollback backup은 `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-47-20260512T2153KST`에 있으며 핵심 3파일 복구가 가능합니다.
