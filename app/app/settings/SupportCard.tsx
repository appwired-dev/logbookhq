"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n";
import { Alert, Button, Card, CardHeader, Field } from "@/components/ui";
import { submitSupportRequest } from "./support-actions";

const SUPPORT_EMAIL = "support@pilotlogbookhq.com";

const T = {
  en: {
    title: "Support", desc: "A question, a bug, or an idea — we read every message.",
    subject: "Subject", subjectPh: "What's this about?",
    message: "Message", messagePh: "How can we help?",
    send: "Send message", sending: "Sending…",
    sentTitle: "Message sent", sentBody: "Thanks — we'll reply to {email}.",
    or: "Prefer email? Write to",
  },
  ko: {
    title: "지원", desc: "질문, 버그, 아이디어 — 모든 메시지를 읽습니다.",
    subject: "제목", subjectPh: "어떤 내용인가요?",
    message: "메시지", messagePh: "무엇을 도와드릴까요?",
    send: "메시지 보내기", sending: "보내는 중…",
    sentTitle: "메시지를 보냈습니다", sentBody: "감사합니다 — {email}로 답장드리겠습니다.",
    or: "이메일을 선호하시나요? 다음으로 보내세요",
  },
  zh: {
    title: "支持", desc: "问题、错误或想法 — 我们会阅读每一条消息。",
    subject: "主题", subjectPh: "这是关于什么的？",
    message: "消息", messagePh: "我们能帮您什么？",
    send: "发送消息", sending: "发送中…",
    sentTitle: "消息已发送", sentBody: "谢谢 — 我们会回复到 {email}。",
    or: "更喜欢邮件？请写信至",
  },
  es: {
    title: "Soporte", desc: "Una pregunta, un error o una idea — leemos cada mensaje.",
    subject: "Asunto", subjectPh: "¿De qué se trata?",
    message: "Mensaje", messagePh: "¿Cómo podemos ayudar?",
    send: "Enviar mensaje", sending: "Enviando…",
    sentTitle: "Mensaje enviado", sentBody: "Gracias — te responderemos a {email}.",
    or: "¿Prefieres correo? Escríbenos a",
  },
} as const;

export default function SupportCard({ locale, email }: { locale: Locale; email: string }) {
  const t = T[locale] ?? T.en;
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card padding="md">
      <CardHeader title={t.title} meta={t.desc} />
      {sent ? (
        <Alert variant="good" title={t.sentTitle}>
          {t.sentBody.replace("{email}", email || SUPPORT_EMAIL)}
        </Alert>
      ) : (
        <form
          action={(fd) => {
            setError(null);
            start(async () => {
              const r = await submitSupportRequest(fd);
              if ("error" in r) setError(r.error);
              else setSent(true);
            });
          }}
          className="space-y-3"
        >
          <Field label={t.subject}>
            <input className="input" name="subject" maxLength={200} placeholder={t.subjectPh} autoComplete="off" />
          </Field>
          <Field label={t.message}>
            <textarea className="input" name="message" rows={4} maxLength={5000} required placeholder={t.messagePh} />
          </Field>
          {error && <p className="text-sm text-bad-ink" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="submit" variant="primary" loading={pending}>
              {pending ? t.sending : t.send}
            </Button>
            <span className="text-sm text-ink-3">
              {t.or}{" "}
              <a className="text-brand hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </span>
          </div>
        </form>
      )}
    </Card>
  );
}
