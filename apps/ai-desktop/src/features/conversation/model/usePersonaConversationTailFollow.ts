import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

const BOTTOM_TOLERANCE_PX = 24;

/**
 * 仅供可输入人物会话使用：用户仍停在时间线末尾时跟随新增消息，主动上翻后保留历史阅读位置。
 */
export function usePersonaConversationTailFollow(updateKey: string): RefObject<HTMLElement | null> {
  const timelineRef = useRef<HTMLElement | null>(null);
  const followsTailRef = useRef(true);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    let geometryFrame = 0;
    const updateFollowState = () => {
      const remaining = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
      followsTailRef.current = remaining <= BOTTOM_TOLERANCE_PX;
    };
    const followGeometryChange = () => {
      // 几何变化发生前仍在末尾时，本次跟随资格必须冻结；布局产生的滚动事件不能撤销它。
      const shouldFollowTail = followsTailRef.current;
      if (!shouldFollowTail) return;
      window.cancelAnimationFrame(geometryFrame);
      geometryFrame = window.requestAnimationFrame(() => {
        // 输入区或消息高度稳定后滚到新的真实末尾，保证末条消息完整位于输入区上方。
        timeline.scrollTo({ top: timeline.scrollHeight });
      });
    };
    updateFollowState();
    timeline.addEventListener("scroll", updateFollowState, { passive: true });
    timeline.addEventListener("selConversation:geometry", followGeometryChange);
    return () => {
      window.cancelAnimationFrame(geometryFrame);
      timeline.removeEventListener("scroll", updateFollowState);
      timeline.removeEventListener("selConversation:geometry", followGeometryChange);
    };
  }, []);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    // 提交前是否停在末尾是本次更新的固定判断，不能被新消息扩高时间线后的滚动事件改写。
    const shouldFollowTail = followsTailRef.current;
    if (!timeline || !shouldFollowTail) return;
    // React 提交节点后立即对齐一次，避免新消息先在输入区后方绘制一帧。
    timeline.scrollTo({ top: timeline.scrollHeight });
    const frame = window.requestAnimationFrame(() => {
      // Markdown 与输入区几何计算完成后再次对齐最终高度。
      timeline.scrollTo({ top: timeline.scrollHeight });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [updateKey]);

  return timelineRef;
}
