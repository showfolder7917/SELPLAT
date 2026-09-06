/*
 * selImagePreview：聊天及其他宿主共用的图片大图预览。
 * 复用 selDialog 的模态、焦点和关闭语义，只管理图片缩放、拖动与边界限制。
 */
(function registerSelImagePreview(globalScope) {
  "use strict";

  const sel = globalScope.sel;
  if (!sel?.register || !sel?.components?.dialog) {
    throw new Error("selImagePreview requires selKernel and selDialog before registration.");
  }

  const dialogId = "selDialogImagePreviewId";
  const state = {
    dialog: null,
    viewport: null,
    image: null,
    zoom: 1,
    baseScale: 1,
    offsetX: 0,
    offsetY: 0,
    pointerId: null,
    pointerStartX: 0,
    pointerStartY: 0,
    offsetStartX: 0,
    offsetStartY: 0,
    resizeObserver: null,
  };

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function resolveImageSize() {
    if (!state.viewport || !state.image || !state.image.naturalWidth || !state.image.naturalHeight) {
      return { width: 0, height: 0, viewportWidth: 0, viewportHeight: 0 };
    }
    const viewportWidth = state.viewport.clientWidth;
    const viewportHeight = state.viewport.clientHeight;
    const baseScale = Math.min(1, viewportWidth / state.image.naturalWidth, viewportHeight / state.image.naturalHeight);
    state.baseScale = Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1;
    return {
      width: state.image.naturalWidth * state.baseScale * state.zoom,
      height: state.image.naturalHeight * state.baseScale * state.zoom,
      viewportWidth,
      viewportHeight,
    };
  }

  function applyTransform() {
    if (!state.viewport || !state.image) return;
    const size = resolveImageSize();
    const maximumOffsetX = Math.max(0, (size.width - size.viewportWidth) / 2);
    const maximumOffsetY = Math.max(0, (size.height - size.viewportHeight) / 2);
    state.offsetX = clamp(state.offsetX, -maximumOffsetX, maximumOffsetX);
    state.offsetY = clamp(state.offsetY, -maximumOffsetY, maximumOffsetY);
    const pannable = maximumOffsetX > 0 || maximumOffsetY > 0;
    state.viewport.dataset.pannable = String(pannable);
    state.viewport.dataset.dragging = String(state.pointerId !== null);
    state.image.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.baseScale * state.zoom})`;
  }

  function resetView() {
    state.zoom = 1;
    state.offsetX = 0;
    state.offsetY = 0;
    state.pointerId = null;
    applyTransform();
  }

  function changeZoom(multiplier) {
    state.zoom = clamp(state.zoom * multiplier, 1, 6);
    applyTransform();
  }

  function startDrag(event) {
    if (state.viewport?.dataset.pannable !== "true") return;
    state.pointerId = event.pointerId;
    state.pointerStartX = event.clientX;
    state.pointerStartY = event.clientY;
    state.offsetStartX = state.offsetX;
    state.offsetStartY = state.offsetY;
    state.viewport.setPointerCapture?.(event.pointerId);
    applyTransform();
    event.preventDefault();
  }

  function moveDrag(event) {
    if (event.pointerId !== state.pointerId) return;
    state.offsetX = state.offsetStartX + event.clientX - state.pointerStartX;
    state.offsetY = state.offsetStartY + event.clientY - state.pointerStartY;
    applyTransform();
    event.preventDefault();
  }

  function finishDrag(event) {
    if (event.pointerId !== state.pointerId) return;
    state.viewport?.releasePointerCapture?.(event.pointerId);
    state.pointerId = null;
    applyTransform();
  }

  function ensurePreview() {
    if (state.dialog) return state.dialog;
    const dialog = sel.components.dialog.mount(document.body, {
      id: dialogId,
      title: "图片预览",
      closeLabel: "关闭图片预览",
    });
    if (!dialog) throw new Error("selImagePreview could not create its dialog.");

    dialog.body.classList.add("selimagepreview-dialog-body");
    const toolbar = createElement("div", "selimagepreview-toolbar");
    const zoomOut = createElement("button", "selimagepreview-action", "缩小");
    const reset = createElement("button", "selimagepreview-action", "复位");
    const zoomIn = createElement("button", "selimagepreview-action", "放大");
    for (const button of [zoomOut, reset, zoomIn]) button.type = "button";
    zoomOut.addEventListener("click", () => changeZoom(1 / 1.25));
    reset.addEventListener("click", resetView);
    zoomIn.addEventListener("click", () => changeZoom(1.25));

    const viewport = createElement("div", "selimagepreview-viewport");
    viewport.setAttribute("aria-label", "图片预览区域");
    const image = createElement("img", "selimagepreview-image");
    image.addEventListener("load", resetView);
    viewport.addEventListener("pointerdown", startDrag);
    viewport.addEventListener("pointermove", moveDrag);
    viewport.addEventListener("pointerup", finishDrag);
    viewport.addEventListener("pointercancel", finishDrag);
    toolbar.append(zoomOut, reset, zoomIn);
    viewport.appendChild(image);
    dialog.body.append(toolbar, viewport);
    dialog.root.addEventListener("close", resetView);

    state.dialog = dialog;
    state.viewport = viewport;
    state.image = image;
    state.resizeObserver = new ResizeObserver(applyTransform);
    state.resizeObserver.observe(viewport);
    return dialog;
  }

  function open(options = {}) {
    const src = String(options.src || "").trim();
    if (!src) return false;
    const dialog = ensurePreview();
    const alt = String(options.alt || "图片预览");
    state.image.src = src;
    state.image.alt = alt;
    resetView();
    return dialog.open({ title: String(options.title || alt), closeLabel: "关闭图片预览" });
  }

  function close() {
    return state.dialog?.close("programmatic") ?? false;
  }

  sel.register("components.imagePreview", sel.core.freeze({
    open,
    close,
    getState: () => sel.core.freeze({ open: state.dialog?.getState().open === true, zoom: state.zoom }),
  }));
})(window);
