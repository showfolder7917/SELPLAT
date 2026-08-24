import "@selplat/sel-ui/theme/tokens";
import "@selplat/sel-ui/theme/contract";
import "@selplat/sel-ui/theme/states";
import "@selplat/sel-ui/theme/typography";
import "@selplat/sel-ui/theme/developer-workbench";
import "@selplat/sel-ui/theme/developer-workbench/dark";
import "@selplat/sel-ui/theme/developer-workbench/light";

export type SelUiThemeState = {
  theme: "developer-workbench";
  mode: "dark";
  accent: string;
  density: "compact" | "comfortable";
};

/** 在 React 首次渲染前应用 AI Desktop 唯一的开发工作台主题。 */
export function applySelUiTheme(): SelUiThemeState {
  const state: SelUiThemeState = { theme: "developer-workbench", mode: "dark", accent: "crystal-cyan", density: "compact" };
  const root = document.documentElement;
  root.dataset.selTheme = state.theme;
  root.dataset.selMode = state.mode;
  root.dataset.selAccent = state.accent;
  root.dataset.selDensity = state.density;
  root.style.setProperty("--sel-theme-color-rgb", "94 232 255");
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", state.mode);
  return state;
}
