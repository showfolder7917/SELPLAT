import { type ReactNode, useEffect, useRef } from "react";

import "@selplat/sel-ui/core/kernel";
import "@selplat/sel-ui/components/conversation";
import "@selplat/sel-ui/components/conversation/styles";
import "@selplat/sel-ui/components/form/styles";

type ConversationController = { destroy(): boolean };
type ConversationApi = { mount(host: HTMLElement, options: { id: string; readOnly: boolean }): ConversationController };

/**
 * React 只把人物消息与业务动作放进 SELUI 插槽；回车、输入法合成和控件生命周期统一由 selConversation 接管。
 */
export function SelUiConversation({ id, timeline, composer, onSubmit }: {
  id: string;
  timeline: ReactNode;
  composer: ReactNode;
  onSubmit(): void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const readOnly = composer == null;

  useEffect(() => {
    const root = rootRef.current;
    const api = (window as typeof window & { sel?: { components?: { conversation?: ConversationApi } } }).sel?.components?.conversation;
    if (!root || !api) throw new Error("SELUI conversation component is unavailable.");
    const handleSubmit = (event: Event) => {
      if ((event as CustomEvent<{ id?: string }>).detail?.id === id) submitRef.current();
    };
    root.addEventListener("selConversation:submit", handleSubmit);
    const controller = api.mount(root, { id, readOnly });
    return () => {
      root.removeEventListener("selConversation:submit", handleSubmit);
      controller.destroy();
    };
  }, [id, readOnly]);

  return <div ref={rootRef} className="selconversation-root">{timeline}{composer}</div>;
}
