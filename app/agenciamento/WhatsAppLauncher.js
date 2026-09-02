"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./agenciamento.module.css";

const PHONE = "554791024456";
const MESSAGE = "Oi! Vi o perfil da Amplify e quero fazer parte!";
const ENCODED_MESSAGE = encodeURIComponent(MESSAGE);
const APP_LINK = `whatsapp://send?phone=${PHONE}&text=${ENCODED_MESSAGE}`;
const WEB_LINK = `https://wa.me/${PHONE}?text=${ENCODED_MESSAGE}`;
const ATTEMPT_KEY = "amplify.whatsapp.attemptedAt";
const ATTEMPT_WINDOW_MS = 15_000;

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16.04 3C9.42 3 4.05 8.25 4.05 14.72c0 2.25.65 4.44 1.88 6.32L4 28l7.2-1.86a12.2 12.2 0 0 0 4.83.99H16c6.61 0 12-5.25 12-11.72A11.8 11.8 0 0 0 24.48 7 12 12 0 0 0 16.04 3Zm0 22.15h-.01a10.1 10.1 0 0 1-4.38-.99l-.41-.2-4.27 1.1 1.14-4.06-.27-.42a9.58 9.58 0 0 1-1.56-5.25c0-5.44 4.38-9.86 9.77-9.86a9.7 9.7 0 0 1 6.91 2.88 9.75 9.75 0 0 1 2.86 6.98c0 5.42-4.38 9.82-9.78 9.82Zm5.36-7.35c-.3-.14-1.74-.84-2.01-.94-.27-.1-.47-.14-.67.15-.2.29-.76.94-.93 1.14-.17.2-.34.22-.63.08-1.7-.84-2.82-1.5-3.95-3.4-.3-.51.3-.47.86-1.56.1-.2.05-.37-.03-.51-.07-.15-.66-1.6-.91-2.18-.24-.57-.48-.49-.67-.5h-.57c-.2 0-.52.07-.79.36-.27.29-1.03 1-1.03 2.45 0 1.44 1.06 2.84 1.2 3.03.15.2 2.08 3.12 5.04 4.38 1.87.79 2.6.86 3.54.72 1.13-.17 1.74-1.14 1.98-2.24.24-1.1.24-2.04.17-2.24-.07-.2-.27-.29-.56-.43Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export default function WhatsAppLauncher() {
  const [phase, setPhase] = useState("ready");
  const [copied, setCopied] = useState(false);
  const fallbackTimer = useRef(null);

  useEffect(() => {
    const attemptedAt = Number(window.sessionStorage.getItem(ATTEMPT_KEY));
    let recoveryTimer;
    if (attemptedAt && Date.now() - attemptedAt < ATTEMPT_WINDOW_MS) {
      window.sessionStorage.removeItem(ATTEMPT_KEY);
      recoveryTimer = window.setTimeout(() => setPhase("blocked"), 0);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        clearTimeout(fallbackTimer.current);
        return;
      }

      const pendingAttempt = Number(window.sessionStorage.getItem(ATTEMPT_KEY));
      if (pendingAttempt) {
        window.sessionStorage.removeItem(ATTEMPT_KEY);
        setPhase("ready");
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearTimeout(recoveryTimer);
      clearTimeout(fallbackTimer.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  function openWhatsApp() {
    window.sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()));
    setPhase("opening");
    clearTimeout(fallbackTimer.current);
    fallbackTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible") {
        setPhase("blocked");
        window.sessionStorage.removeItem(ATTEMPT_KEY);
      }
    }, 1800);
  }

  async function copyWebLink() {
    try {
      await navigator.clipboard.writeText(WEB_LINK);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
      window.prompt("Copie este link e abra no Safari ou Chrome:", WEB_LINK);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glowBlue} aria-hidden="true" />
      <div className={styles.glowPink} aria-hidden="true" />

      <section className={styles.panel} aria-labelledby="agenciamento-title">
        <header className={styles.header}>
          <Image
            src="/amplify-logo.png"
            alt="Amplify"
            className={styles.logo}
            width={1690}
            height={476}
            priority
          />
          <span className={styles.eyebrow}>Agenciamento de creators</span>
        </header>

        <div className={styles.content}>
          <h1 id="agenciamento-title">
            Seu próximo passo na TikTok Shop começa aqui.
          </h1>
          <p>
            Fale agora com o time de Aquisição da Amplify.
          </p>

          <a
            className={styles.primaryButton}
            href={APP_LINK}
            onClick={openWhatsApp}
            data-whatsapp-link={APP_LINK}
          >
            <span className={styles.whatsappMark}><WhatsAppIcon /></span>
            <span>{phase === "opening" ? "Abrindo WhatsApp..." : "Abrir WhatsApp"}</span>
            <span className={styles.arrow}><ArrowIcon /></span>
          </a>

          <div className={styles.destination}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>Conversa com Aquisição Amplify</span>
          </div>

          <div className={styles.help} data-visible={phase === "blocked"} aria-live="polite">
            <strong>O TikTok bloqueou a abertura?</strong>
            <ol>
              <li>Toque nos três pontos no alto da tela.</li>
              <li>Escolha <b>Abrir no navegador</b>.</li>
              <li>Toque novamente em <b>Abrir WhatsApp</b>.</li>
            </ol>
            <button type="button" className={styles.copyButton} onClick={copyWebLink}>
              {copied ? "Link copiado" : "Copiar link para o navegador"}
            </button>
          </div>
        </div>

        <footer className={styles.footer}>
          <span>Amplify UGC</span>
          <span aria-hidden="true">•</span>
          <span>TikTok Shop MCN</span>
        </footer>
      </section>
    </main>
  );
}
