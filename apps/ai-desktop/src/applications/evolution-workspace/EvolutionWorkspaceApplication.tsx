import { useEffect, useState } from "react";
import { Code24Regular } from "@fluentui/react-icons";

import type { CollaborationMemberOutDto, EvolutionStateOutDto, EvolutionWorkspaceLocationOutDto, LocaleValue, WorkspaceStateOutDto } from "../../../contracts/system/desktop/index";
import { EvolutionControlWorkspace } from "../../features/evolution/components/EvolutionControlWorkspace";
import { defaultEvolutionWorkspaceLocation, evolutionWorkspaceLocationFromSearch, evolutionWorkspaceLocationSearch } from "../../features/evolution/model/evolution-workbench";
import { WindowControls } from "../../features/shell/components/DesktopChrome";
import "@selplat/sel-ui/core/kernel";
import "@selplat/sel-ui/components/tooltip";
import "@selplat/sel-ui/components/tooltip/styles";
import "@selplat/sel-ui/components/context-menu";
import "@selplat/sel-ui/components/context-menu/styles";
import "@selplat/sel-ui/components/tree";
import "@selplat/sel-ui/components/tree/styles";
import "@selplat/sel-ui/components/grid";
import "@selplat/sel-ui/components/grid/styles";
import "@selplat/sel-ui/components/search";
import "@selplat/sel-ui/components/search/styles";
import "@selplat/sel-ui/components/disclosure";
import "@selplat/sel-ui/components/disclosure/styles";
import "../styles/desktop-applications.css";

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 南宫婉与韩立共用一个专题演化 Application；人物入口只改变初始视角。 */
export function EvolutionWorkspaceApplication() {
  const [requestedLocation, setRequestedLocation] = useState<EvolutionWorkspaceLocationOutDto>(() => evolutionWorkspaceLocationFromSearch(window.location.search));
  const perspective = requestedLocation.perspective;
  const [state, setState] = useState<EvolutionStateOutDto | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceStateOutDto | null>(null);
  const [nangongMember, setNangongMember] = useState<CollaborationMemberOutDto | null>(null);
  const [locale, setLocale] = useState<LocaleValue>("zh-CN");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([window.desktop?.getEvolutionState(), window.desktop?.getWorkspaces(), window.desktop?.getCollaborationState(), window.desktop?.getSettings()])
      .then(([nextState, nextWorkspaces, collaboration, settings]) => {
        if (!active) return;
        if (nextState) setState(nextState);
        if (nextWorkspaces) setWorkspaces(nextWorkspaces);
        if (collaboration) setNangongMember(collaboration.members.find((member) => member.memberId === "nangong-wan") || null);
        if (settings) setLocale(settings.locale);
      })
      .catch((reason) => { if (active) setError(readableDesktopError(reason, "无法打开专题演化工作台。")); });
    const unsubscribeState = window.desktop?.onEvolutionState((event) => setState(event.state));
    const unsubscribeCollaboration = window.desktop?.onCollaborationState((event) => setNangongMember(event.state.members.find((member) => member.memberId === "nangong-wan") || null));
    const unsubscribeLocation = window.desktop?.onEvolutionWorkspaceLocation((location) => {
      setRequestedLocation(location);
      window.history.replaceState(null, "", evolutionWorkspaceLocationSearch(location));
    });
    return () => {
      active = false;
      unsubscribeState?.();
      unsubscribeCollaboration?.();
      unsubscribeLocation?.();
    };
  }, []);

  const selectPerspective = (nextPerspective: "nangong" | "hanli") => {
    const location = defaultEvolutionWorkspaceLocation(nextPerspective);
    setRequestedLocation(location);
    window.history.replaceState(null, "", evolutionWorkspaceLocationSearch(location));
  };

  return <div className="evolution-window-shell" lang={locale}>
    <header className="dev-titlebar evolution-window-titlebar">
      <div className="dev-brand"><Code24Regular /><strong>AI Desktop</strong><span>专题演化工作台</span></div>
      <div className="operating-mode-switch evolution-perspective-switch" role="group" aria-label="工作台人物视角">
        <button type="button" className={perspective === "nangong" ? "active" : ""} aria-pressed={perspective === "nangong"} onClick={() => selectPerspective("nangong")}>南宫婉</button>
        <button type="button" className={perspective === "hanli" ? "active" : ""} aria-pressed={perspective === "hanli"} onClick={() => selectPerspective("hanli")}>韩立</button>
      </div>
      <WindowControls />
    </header>
    <main className="evolution-window-main">
      {error && <div className="evolution-window-error" role="alert">{error}</div>}
      {state && (perspective === "hanli" || nangongMember)
        ? <EvolutionControlWorkspace perspective={perspective} requestedLocation={requestedLocation} onLocationChange={(location) => window.history.replaceState(null, "", evolutionWorkspaceLocationSearch(location))} member={nangongMember || undefined} state={state} workspaces={workspaces} locale={locale} onState={setState} onError={setError} />
        : !error && <div className="evolution-window-loading" role="status">正在读取专题、审批和运行状态…</div>}
    </main>
  </div>;
}
