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
    const updateFollowState = () => {
      const remaining = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
      followsTailRef.current = remaining <= BOTTOM_TOLERANCE_PX;
    };
    updateFollowState();
    timeline.addEventListener("scroll", updateFollowState, { passive: true });
    return () => timeline.removeEventListener("scroll", updateFollowState);
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
