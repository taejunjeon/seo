# TechSol GAds NPay click conversion read-only audit (2026-05-10)

작성 시각: 2026-05-10 17:56:17 KST

## 결론

TechSol - NPAY구매 50739는 Secondary action으로 보이지만, 이름과 NPay click trigger 성격상 실제 결제완료 구매가 아니다. pause/delete는 HOLD이고, confirmed purchase builder에서는 click-only를 계속 차단한다.

## 확인값

```json
{
  "action_id": "7564830949",
  "name": "TechSol - NPAY구매 50739",
  "status": "ENABLED",
  "category": "PURCHASE",
  "type": "WEBPAGE",
  "primary_for_goal": false,
  "counting_type": "MANY_PER_CLICK",
  "labels": [
    "3yjICOXRmJccEJixj5EB"
  ],
  "classification": "secondary_npay_click_label",
  "risk": "MEDIUM",
  "interpretation": "TechSol NPay click/conversion action은 Secondary로 보이나 NPay 버튼 클릭/intent 성격이다. 실제 결제완료가 아니므로 confirmed purchase로 쓰지 않는다."
}
```

## 금지선

- TechSol tag pause/delete 0
- Google Ads conversion action 변경 0
- Google Ads upload 0
