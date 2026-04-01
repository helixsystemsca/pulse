"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { HELIX_INFO_EMAIL, mailtoInfo } from "@/lib/helix-emails";

type FormState = {
  name: string;
  email: string;
  company: string;
  message: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

export function ContactSection({ id }: { id?: string }) {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    company: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function validate(): boolean {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address.";
    }
    if (!form.message.trim()) next.message = "Tell us briefly how we can help.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(false);
    setSendError(null);
    if (!validate()) return;

    const base = getApiBaseUrl();
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim(),
      message: form.message.trim(),
    };

    if (base) {
      setSending(true);
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/api/public/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
          const d = data.detail;
          setSendError(
            typeof d === "string" ? d : "Could not send. Try email below or try again later.",
          );
          return;
        }
        setSubmitted(true);
        setForm({ name: "", email: "", company: "", message: "" });
      } catch {
        setSendError("Network error. Email us directly at " + HELIX_INFO_EMAIL);
      } finally {
        setSending(false);
      }
      return;
    }

    const body = `${payload.message}\n\n—\n${payload.name}\n${payload.email}\n${payload.company || "Company not provided"}`;
    window.location.href = mailtoInfo("Helix — contact from website", body);
    setSubmitted(true);
  }

  return (
    <section id={id} className="scroll-mt-24 bg-helix-surface py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-helix-primary">Contact</p>
        <h2 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-helix-onSurface md:text-4xl">
          Talk with our team
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-helix-onSurfaceVariant">
          Share your site context and we’ll follow up for a discovery conversation—no spam, no cold
          lists. You can also reach us at{" "}
          <a className="font-semibold text-helix-primary underline-offset-2 hover:underline" href={`mailto:${HELIX_INFO_EMAIL}`}>
            {HELIX_INFO_EMAIL}
          </a>
          .
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-12 max-w-2xl space-y-5 rounded-2xl border border-helix-outline/20 bg-white p-6 shadow-md md:p-8"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-semibold text-helix-onSurface">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-2 h-12 w-full rounded-xl border border-helix-outline/40 bg-helix-bg px-4 text-helix-onSurface outline-none transition-shadow focus:border-helix-primary focus:ring-2 focus:ring-helix-primary/20"
              />
              {errors.name ? <p className="mt-1 text-sm text-red-600">{errors.name}</p> : null}
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-semibold text-helix-onSurface">
                Work email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-2 h-12 w-full rounded-xl border border-helix-outline/40 bg-helix-bg px-4 text-helix-onSurface outline-none transition-shadow focus:border-helix-primary focus:ring-2 focus:ring-helix-primary/20"
              />
              {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
            </div>
          </div>
          <div>
            <label htmlFor="contact-company" className="block text-sm font-semibold text-helix-onSurface">
              Company / site
            </label>
            <input
              id="contact-company"
              name="company"
              autoComplete="organization"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-helix-outline/40 bg-helix-bg px-4 text-helix-onSurface outline-none transition-shadow focus:border-helix-primary focus:ring-2 focus:ring-helix-primary/20"
            />
          </div>
          <div>
            <label htmlFor="contact-message" className="block text-sm font-semibold text-helix-onSurface">
              How can we help?
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="mt-2 w-full resize-y rounded-xl border border-helix-outline/40 bg-helix-bg px-4 py-3 text-helix-onSurface outline-none transition-shadow focus:border-helix-primary focus:ring-2 focus:ring-helix-primary/20"
            />
            {errors.message ? <p className="mt-1 text-sm text-red-600">{errors.message}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={sending}
              className="h-12 rounded-full bg-helix-primary px-8 font-semibold text-white shadow-md transition-colors hover:bg-helix-primary-dim disabled:opacity-60"
            >
              {sending ? "Sending…" : "Submit"}
            </button>
            {sendError ? <p className="text-sm text-red-600">{sendError}</p> : null}
            {submitted ? (
              <p className="text-sm font-medium text-emerald-700">
                Thanks — we received your message and will follow up shortly.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
