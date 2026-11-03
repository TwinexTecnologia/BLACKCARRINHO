"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import styles from "@/components/panel.module.css";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type RecoveryStatus = "checking" | "ready" | "invalid" | "success";

export function RedefinirSenhaClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function checkRecoverySession() {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");

      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);

        if (!active) {
          return;
        }

        if (error) {
          setStatus("invalid");
          setFeedback(error.message || "O link de redefinicao e invalido ou expirou.");
          return;
        }

        router.replace("/redefinir-senha");
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (session) {
        setStatus("ready");
        return;
      }

      timeoutId = setTimeout(async () => {
        const {
          data: { session: delayedSession },
        } = await client.auth.getSession();

        if (!active) {
          return;
        }

        if (delayedSession) {
          setStatus("ready");
          return;
        }

        setStatus("invalid");
        setFeedback("O link de redefinicao e invalido ou expirou. Solicite um novo.");
      }, 1200);
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (
        session &&
        (event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION")
      ) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        setStatus("ready");
        setFeedback("");
      }
    });

    checkRecoverySession();

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.trim().length < 6) {
      setFeedback("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("A confirmacao da senha precisa ser igual a nova senha.");
      return;
    }

    setIsSubmitting(true);
    setFeedback("");

    try {
      const client = createSupabaseBrowserClient();
      const { error } = await client.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        throw error;
      }

      setStatus("success");
      setPassword("");
      setConfirmPassword("");
      setFeedback("Senha redefinida com sucesso. Agora voce pode entrar com a nova senha.");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Nao foi possivel redefinir a senha.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBackToLogin() {
    try {
      const client = createSupabaseBrowserClient();
      await client.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
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
            <div className={styles.authBrandTitle}>Redefinir senha</div>
          </div>
        </div>

        <div className={styles.titleBlock}>
          <h1>Nova senha</h1>
          <p>
            Use o link enviado no e-mail para definir uma nova senha de acesso.
          </p>
        </div>

        {status === "checking" ? (
          <div className={styles.callout}>
            <h3>Validando link</h3>
            <p>Estamos conferindo o seu link de recuperacao.</p>
          </div>
        ) : null}

        {status === "invalid" ? (
          <div className={styles.warningPanel}>
            <div className={styles.warningTitle}>Link invalido</div>
            <p className={styles.warningText}>{feedback}</p>
          </div>
        ) : null}

        {status === "ready" ? (
          <>
            <div className={styles.formStack}>
              <label className={styles.filterField}>
                <span>Nova senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className={styles.filterField}>
                <span>Confirmar senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>
            </div>

            {feedback ? (
              <div className={styles.warningPanel}>
                <div className={styles.warningTitle}>Nao foi possivel redefinir</div>
                <p className={styles.warningText}>{feedback}</p>
              </div>
            ) : null}

            <div className={styles.filterActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Salvar nova senha"}
              </button>
            </div>
          </>
        ) : null}

        {status === "success" ? (
          <div className={styles.callout}>
            <h3>Senha atualizada</h3>
            <p>{feedback}</p>
          </div>
        ) : null}

        {status === "invalid" || status === "success" ? (
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleBackToLogin}
            >
              Voltar para o login
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
