import { useEffect, useState } from "react";

const EVENT = "rohi:whatsapp-chat-open";
let openState = false;

export function setChatPanelOpen(open: boolean) {
  openState = open;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: open }));
  }
}

export function useChatPanelOpen() {
  const [open, setOpen] = useState(openState);
  useEffect(() => {
    setOpen(openState);
    const handler = (e: Event) => setOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return open;
}
