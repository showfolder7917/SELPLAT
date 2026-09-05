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
      if (!followsTailRef.current) return;
      window.cancelAnimationFrame(geometryFrame);
      geometryFrame = window.requestAnimationFrame(() => {
        if (followsTailRef.current) timeline.scrollTo({ top: timeline.scrollHeight });
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
    if (!timeline || !followsTailRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (followsTailRef.current) timeline.scrollTo({ top: timeline.scrollHeight });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [updateKey]);

  return timelineRef;
}
