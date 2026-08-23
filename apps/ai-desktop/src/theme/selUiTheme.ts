import "@selplat/sel-ui/theme/tokens";
import "@selplat/sel-ui/theme/contract";
import "@selplat/sel-ui/theme/states";
import "@selplat/sel-ui/theme/typography";
import "@selplat/sel-ui/theme/developer-workbench";
import "@selplat/sel-ui/theme/developer-workbench/dark";
import "@selplat/sel-ui/theme/developer-workbench/light";
import "@selplat/sel-ui/theme/plain-minimal";
import "@selplat/sel-ui/theme/plain-minimal/dark";
import "@selplat/sel-ui/theme/plain-minimal/light";

export type SelUiThemeState = {
  theme: "developer-workbench" | "plain-minimal";
  mode: "dark" | "light";
  accent: string;
  density: "compact" | "comfortable";
};

/** 将真实应用变体映射到 SEL UI 统一主题状态；例如 developer 返回深色开发工作台，office 返回浅色普通极简。 */
export function applySelUiTheme(variant: "developer" | "office"): SelUiThemeState {
  const state: SelUiThemeState = variant === "developer"
    ? { theme: "developer-workbench", mode: "dark", accent: "crystal-cyan", density: "compact" }
    : { theme: "plain-minimal", mode: "light", accent: "base", density: "compact" };
  const root = document.documentElement;
  root.dataset.selTheme = state.theme;
  root.dataset.selMode = state.mode;
  root.dataset.selAccent = state.accent;
  root.dataset.selDensity = state.density;
  root.style.setProperty("--sel-theme-color-rgb", variant === "developer" ? "94 232 255" : "68 68 68");
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", state.mode);
  return state;
}
