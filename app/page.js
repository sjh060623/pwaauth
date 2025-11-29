"use client";

import { useEffect, useState } from "react";

// ArrayBuffer <-> base64url 변환 유틸
function bufToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBuf(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function LockPage() {
  const [status, setStatus] = useState("locked"); // "locked" | "unlocked"
  const [hasCredential, setHasCredential] = useState(false);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlocked = window.localStorage.getItem("app-unlocked");
    if (unlocked === "true") setStatus("unlocked");

    const credId = window.localStorage.getItem("app-credential-id");
    setHasCredential(!!credId);
  }, []);

  const addLog = (msg) => setLog((prev) => prev + msg + "\n");

  // 🔐 생체인식(패스키) 등록
  const registerBiometric = async () => {
    try {
      setLoading(true);
      addLog("등록 시작");

      if (!("credentials" in navigator)) {
        alert("WebAuthn을 지원하지 않는 브라우저입니다.");
        return;
      }

      // random challenge 생성
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userIdBytes = new TextEncoder().encode("local-user");
      const rpId = window.location.hostname; // ex) localhost, myapp.com

      const publicKeyOptions = {
        challenge,
        rp: {
          name: "My PWA Lock",
          id: rpId,
        },
        user: {
          id: userIdBytes,
          name: "local-user",
          displayName: "Local User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Face ID / 지문
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error("credential 생성 실패");
      }

      const credId = bufToBase64Url(credential.rawId);
      window.localStorage.setItem("app-credential-id", credId);
      setHasCredential(true);
      addLog("등록 완료: " + credId);
      alert("생체인식 등록 완료");
    } catch (err) {
      console.error(err);
      alert("등록 실패: " + (err?.message || "unknown error"));
    } finally {
      setLoading(false);
    }
  };

  // 🔓 생체인식으로 잠금 해제
  const unlockWithBiometric = async () => {
    try {
      setLoading(true);
      addLog("잠금 해제 시도");

      const credId = window.localStorage.getItem("app-credential-id");
      if (!credId) {
        alert("먼저 생체인식을 등록해 주세요.");
        return;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyRequest = {
        challenge,
        allowCredentials: [
          {
            id: base64UrlToBuf(credId),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyRequest,
      });

      if (!assertion) {
        throw new Error("인증 실패");
      }

      // 여기서는 서버 검증 없이 "성공이라고 믿고" 잠금 해제
      setStatus("unlocked");
      window.localStorage.setItem("app-unlocked", "true");
      addLog("잠금 해제 성공");
    } catch (err) {
      console.error(err);
      alert("인증 실패: " + (err?.message || "unknown error"));
      addLog("잠금 해제 실패");
    } finally {
      setLoading(false);
    }
  };

  // 🔒 잠금 상태 UI & 🔓 해제 상태 UI
  if (status === "unlocked") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: "bold" }}>잠금 해제됨 ✅</h1>
        <button
          onClick={() => {
            setStatus("locked");
            window.localStorage.setItem("app-unlocked", "false");
          }}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid #ccc",
          }}
        >
          다시 잠그기
        </button>
        <pre
          style={{
            marginTop: 16,
            maxHeight: 200,
            overflow: "auto",
            fontSize: 12,
            background: "#f5f5f5",
            padding: 8,
            width: "100%",
            maxWidth: 400,
          }}
        >
          {log}
        </pre>
      </div>
    );
  }

  // 🔐 잠금 화면
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>앱 잠금 🔒</h1>
      <p style={{ fontSize: 14, opacity: 0.7 }}>
        이 기기에서만 쓰는 Face ID / 지문 잠금
      </p>

      <button
        disabled={loading || !hasCredential}
        onClick={unlockWithBiometric}
        style={{
          padding: "12px 24px",
          borderRadius: 999,
          border: "1px solid #000",
          fontSize: 16,
          marginTop: 8,
          opacity: loading || !hasCredential ? 0.5 : 1,
        }}
      >
        {loading ? "인증 중..." : "Face ID / 지문으로 잠금 해제"}
      </button>

      <button
        disabled={loading}
        onClick={registerBiometric}
        style={{
          marginTop: 4,
          fontSize: 12,
          textDecoration: "underline",
          background: "none",
          border: "none",
          cursor: "pointer",
          opacity: 0.8,
        }}
      >
        {hasCredential
          ? "생체인식 다시 등록하기"
          : "처음 사용 → 생체인식 등록하기"}
      </button>

      <pre
        style={{
          marginTop: 16,
          maxHeight: 200,
          overflow: "auto",
          fontSize: 12,
          background: "#f5f5f5",
          padding: 8,
          width: "100%",
          maxWidth: 400,
        }}
      >
        {log}
      </pre>
    </div>
  );
}
