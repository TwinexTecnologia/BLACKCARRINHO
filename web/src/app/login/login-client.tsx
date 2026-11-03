"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import styles from "@/components/panel.module.css";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginClientProps = {
  nextPath: string;
};

export function LoginClient({ nextPath }: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState("");
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback("");

    try {
      const client = createSupabaseBrowserClient();
      const { error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        throw error;
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Nao foi possivel entrar no sistema.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setRecoveryFeedback("Informe o e-mail do login para receber o link de redefinicao.");
      return;
    }

    setIsSendingRecovery(true);
    setRecoveryFeedback("");

    try {
      const client = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/redefinir-senha`;
      const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      setRecoveryFeedback(
        "Se esse e-mail existir, enviamos um link para redefinir a senha.",
      );
    } catch (error) {
      setRecoveryFeedback(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar o link de redefinicao.",
      );
    } finally {
      setIsSendingRecovery(false);
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authBackdrop} aria-hidden="true" />
      <form className={styles.authCard} onSubmit={handleSubmit}>
        <div className={styles.authBrand}>
          <Image
            src="/login-logo-repeticao-maxima.png"
            alt="Logo Repeticao Maxima"
            width={88}
            height={88}
            className={styles.authLogo}
            priority
          />
          <div className={styles.authBrandCopy}>
            <div className={styles.authBrandEyebrow}>Repeticao Maxima</div>
            <div className={styles.authBrandTitle}>Painel Interno</div>
          </div>
        </div>

        <div className={styles.titleBlock}>
          <h1>Entrar</h1>
          <p>
            Use o login criado na area de usuarios para acessar o painel interno.
          </p>
        </div>

        <div className={styles.formStack}>
          <label className={styles.filterField}>
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label className={styles.filterField}>
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>

        {feedback ? (
          <div className={styles.warningPanel}>
            <div className={styles.warningTitle}>Nao foi possivel entrar</div>
            <p className={styles.warningText}>{feedback}</p>
          </div>
        ) : null}

        <div className={styles.filterActions}>
          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar no sistema"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleForgotPassword}
            disabled={isSendingRecovery}
          >
            {isSendingRecovery ? "Enviando link..." : "Esqueci minha senha"}
          </button>
        </div>

        {recoveryFeedback ? (
          <div className={styles.callout}>
            <h3>Recuperacao de senha</h3>
            <p>{recoveryFeedback}</p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
