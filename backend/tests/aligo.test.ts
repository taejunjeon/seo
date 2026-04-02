import assert from "node:assert/strict";
import test from "node:test";

test("aligo: env alias and forms are normalized", async () => {
  process.env.ALIGO_API_KEY = "api-key";
  process.env.ALIGO_USER_ID = "user-id";
  process.env.ALIGO_Senderkey = "sender-key-from-alias";
  process.env.ALIGO_SENDER_PHONE = "0212345678";
  process.env.ALIGO_KAKAOCHANNEL_ID = "@biocom";

  const {
    buildAligoHistoryDetailForm,
    buildAligoHistoryListForm,
    buildAligoTemplateListForm,
    buildAligoTestSendForm,
    getAligoConfigStatus,
  } = await import(
    `../src/aligo.ts?case=${Date.now()}`
  );

  const config = getAligoConfigStatus();
  const templateForm = buildAligoTemplateListForm();
  const sendForm = buildAligoTestSendForm({
    tplCode: "TPL0001",
    receiver: "01012345678",
    subject: "테스트 제목",
    message: "테스트 본문",
  });
  const historyListForm = buildAligoHistoryListForm({
    page: 2,
    limit: 20,
    startDate: "20260401",
    endDate: "20260402",
  });
  const historyDetailForm = buildAligoHistoryDetailForm({
    mid: "1306113822",
    page: 3,
    limit: 10,
  });

  assert.equal(config.senderKeyConfigured, true);
  assert.equal(config.kakaoChannelIdConfigured, true);
  assert.equal(templateForm.get("senderkey"), "sender-key-from-alias");
  assert.equal(sendForm.get("senderkey"), "sender-key-from-alias");
  assert.equal(sendForm.get("sender"), "0212345678");
  assert.equal(sendForm.get("testMode"), "Y");
  assert.equal(historyListForm.get("page"), "2");
  assert.equal(historyListForm.get("page_size"), "20");
  assert.equal(historyListForm.get("start_date"), "20260401");
  assert.equal(historyListForm.get("end_date"), "20260402");
  assert.equal(historyDetailForm.get("mid"), "1306113822");
  assert.equal(historyDetailForm.get("page"), "3");
  assert.equal(historyDetailForm.get("page_size"), "10");
});
