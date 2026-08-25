import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "@selplat/sel-ui/core/kernel";
import "@selplat/sel-ui/components/confirm-dialog";
import "@selplat/sel-ui/components/confirm-dialog/styles";
import "@selplat/sel-ui/components/dialog";
import "@selplat/sel-ui/components/dialog/styles";
import "@selplat/sel-ui/components/window";
import "@selplat/sel-ui/components/window/styles";

type ConfirmOptions = { title?: string; message: string; target?: string; tone?: "info" | "danger"; confirmLabel?: string; cancelLabel?: string };
type PromptOptions = { title: string; label: string; defaultValue?: string; placeholder?: string; submitLabel?: string; cancelLabel?: string; multiline?: boolean };

type ConfirmController = { open(options: Record<string, unknown>): Promise<boolean>; destroy(): boolean };
type WindowController = {
  open(): void;
  close(): void;
  setValues(values: Record<string, unknown>): boolean;
  setLocale(options: Record<string, unknown>): boolean;
  destroy(): boolean;
};
type DialogController = {
  body: HTMLElement;
  open(options?: Record<string, unknown>): boolean;
  close(): boolean;
  setLocale(options: Record<string, unknown>): boolean;
  destroy(): boolean;
};

type SelUiContextValue = {
  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
};

const SelUiContext = createContext<SelUiContextValue | null>(null);

/** React 只负责 SELUI 公共控件的挂载和业务 Promise 桥接，DOM、焦点和视觉仍归公共组件。 */
export function SelUiProvider({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<ConfirmController | null>(null);
  const promptRef = useRef<WindowController | null>(null);
  const multilinePromptRef = useRef<WindowController | null>(null);
  const pendingPromptRef = useRef<{ id: string; resolve(value: string | null): void } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const components = (window as typeof window & { sel?: { components?: Record<string, any> } }).sel?.components;
    if (!host || !components?.confirmDialog || !components?.window) return;
    const confirmController = components.confirmDialog.mount(host, { id: "ai-desktop-confirm" }) as ConfirmController | null;
    const promptController = components.window.mount(host, {
      id: "ai-desktop-prompt",
      title: "请输入",
      subtitle: "AI Desktop",
      rows: [[{ name: "value", inputId: "ai-desktop-prompt-value", label: "内容", type: "text", required: true, maxLength: 20_000 }]],
      submitLabel: "确认",
      cancelLabel: "取消",
      autoSuccess: false,
    }) as WindowController | null;
    const multilinePromptController = components.window.mount(host, {
      id: "ai-desktop-multiline-prompt",
      title: "请输入",
      subtitle: "AI Desktop",
      rows: [[{ name: "value", inputId: "ai-desktop-multiline-prompt-value", label: "内容", type: "textarea", required: true, maxLength: 20_000 }]],
      submitLabel: "确认",
      cancelLabel: "取消",
      autoSuccess: false,
    }) as WindowController | null;
    confirmRef.current = confirmController;
    promptRef.current = promptController;
    multilinePromptRef.current = multilinePromptController;
    const settlePrompt = (id: string, value: string | null) => {
      const pending = pendingPromptRef.current;
      if (!pending || pending.id !== id) return;
      pendingPromptRef.current = null;
      pending.resolve(value);
    };
    const onSubmit = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; values?: { value?: unknown } }>).detail;
      if (!detail?.id || !["ai-desktop-prompt", "ai-desktop-multiline-prompt"].includes(detail.id)) return;
      settlePrompt(detail.id, typeof detail.values?.value === "string" ? detail.values.value : "");
      (detail.id === "ai-desktop-multiline-prompt" ? multilinePromptController : promptController)?.close();
    };
    const onClose = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) settlePrompt(id, null);
    };
    host.addEventListener("selWindow:submit", onSubmit);
    host.addEventListener("selWindow:close", onClose);
    return () => {
      host.removeEventListener("selWindow:submit", onSubmit);
      host.removeEventListener("selWindow:close", onClose);
      if (pendingPromptRef.current) settlePrompt(pendingPromptRef.current.id, null);
      confirmController?.destroy();
      promptController?.destroy();
      multilinePromptController?.destroy();
      confirmRef.current = null;
      promptRef.current = null;
      multilinePromptRef.current = null;
    };
  }, []);

  const value = useMemo<SelUiContextValue>(() => ({
    confirm: (options) => confirmRef.current?.open(options) || Promise.resolve(false),
    prompt: (options) => {
      const id = options.multiline ? "ai-desktop-multiline-prompt" : "ai-desktop-prompt";
      const controller = options.multiline ? multilinePromptRef.current : promptRef.current;
      if (!controller) return Promise.resolve(null);
      if (pendingPromptRef.current) {
        pendingPromptRef.current.resolve(null);
        pendingPromptRef.current = null;
        promptRef.current?.close();
        multilinePromptRef.current?.close();
      }
      controller.setLocale({
        title: options.title,
        subtitle: "AI Desktop",
        submitLabel: options.submitLabel || "确认",
        cancelLabel: options.cancelLabel || "取消",
        rows: [[{ name: "value", inputId: options.multiline ? "ai-desktop-multiline-prompt-value" : "ai-desktop-prompt-value", label: options.label, type: options.multiline ? "textarea" : "text", required: true, maxLength: 20_000, placeholder: options.placeholder || "" }]],
      });
      controller.setValues({ value: options.defaultValue || "" });
      controller.open();
      return new Promise<string | null>((resolve) => { pendingPromptRef.current = { id, resolve }; });
    },
  }), []);

  return <SelUiContext.Provider value={value}>{children}<div ref={hostRef} className="selui-react-bridge-host" /></SelUiContext.Provider>;
}

export function useSelUi(): SelUiContextValue {
  const value = useContext(SelUiContext);
  if (!value) throw new Error("SELUI React provider is unavailable.");
  return value;
}

/** 把 React 业务内容放入 SELUI Dialog 插槽；模态层、焦点、关闭和视觉全部由 SELUI 拥有。 */
export function SelUiDialog({ id, open, title, kicker, dismissible = true, size = "standard", onRequestClose, children }: {
  id: string;
  open: boolean;
  title: string;
  kicker?: string;
  dismissible?: boolean;
  size?: "standard" | "compact";
  onRequestClose(): void;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DialogController | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    const host = hostRef.current;
    const dialogApi = (window as typeof window & { sel?: { components?: Record<string, any> } }).sel?.components?.dialog;
    if (!host || !dialogApi) return;
    const controller = dialogApi.mount(host, { id, title, kicker, dismissible, size }) as DialogController | null;
    if (!controller) return;
    controllerRef.current = controller;
    setBody(controller.body);
    const onClose = (event: Event) => {
      if ((event as CustomEvent<{ id?: string }>).detail?.id === id) closeRef.current();
    };
    host.addEventListener("selDialog:close", onClose);
    if (open) controller.open();
    return () => {
      host.removeEventListener("selDialog:close", onClose);
      controller.destroy();
      controllerRef.current = null;
      setBody(null);
    };
  }, [id]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setLocale({ title, kicker, dismissible, size });
    if (open) controller.open(); else controller.close();
  }, [dismissible, kicker, open, size, title]);

  return <div ref={hostRef} className="selui-dialog-bridge-host">{body ? createPortal(children, body) : null}</div>;
}
