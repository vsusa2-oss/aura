"use client";

import { useEffect, useState } from "react";

const KEY = "apex_session_id";

export function useSessionId() {
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `ses_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      localStorage.setItem(KEY, id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}
