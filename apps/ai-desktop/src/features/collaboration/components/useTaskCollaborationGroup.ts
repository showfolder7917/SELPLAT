/**
 * 任务协作群页面自己的交互状态。
 * 主页面负责结构，本 Hook 负责展开状态、定位当前步骤、继续任务和动态计时。
 */

// React 生命周期：启动并清理页面耗时刷新定时器。
import { useEffect } from "react";
// React 状态容器：保存人工展开选择、继续任务反馈和当前时间。
import { useState } from "react";

import type {
  // 时间线专题：定位当前专题和节点时使用。
  CollaborationTimelineGroupOutDto,
} from "../../../../contracts/system/desktop/index";
import type {
  // 页面模型：读取时间线快照和继续任务回调。
  TaskCollaborationGroupModel,
} from "./TaskCollaborationGroup.types";

/** 在一个 Map 中记录用户对指定任务卡或节点的展开选择。 */
function updateOpenOverride(
  setter: (update: (current: Map<string, boolean>) => Map<string, boolean>) => void,
  id: string,
  open: boolean,
): void {
  setter((current) => {
    const next = new Map(current);
    // 用户操作后一直尊重该节点自己的展开或收起状态。
    next.set(id, open);
    return next;
  });
}

/** 找到第一张尚未结束的专题卡；全部结束时回退到第一张历史卡。 */
function findCurrentGroupId(groups: CollaborationTimelineGroupOutDto[]): string | undefined {
  const activeGroup = groups.find((group) => {
    return group.status !== "completed" && group.status !== "cancelled";
  });
  return activeGroup?.groupId || groups[0]?.groupId;
}

/** 任务协作群页面的状态和操作控制器。 */
export function useTaskCollaborationGroup(model: TaskCollaborationGroupModel) {
  // 权威时间线来自模型数据组，继续操作来自模型业务操作组。
  const { snapshot } = model.data;
  const { onContinueTask } = model.actions;
  // 专题卡人工展开选择；没有记录时由当前专题规则决定默认值。
  const [groupOpenOverrides, setGroupOpenOverrides] = useState<Map<string, boolean>>(new Map());
  // 时间线节点人工展开选择；没有记录时使用主进程给出的 automaticOpen。
  const [nodeOpenOverrides, setNodeOpenOverrides] = useState<Map<string, boolean>>(new Map());
  // 正在继续的任务标识：按钮显示忙碌并阻止同一操作重复提交。
  const [continuingTaskId, setContinuingTaskId] = useState<string | null>(null);
  // 继续任务失败原因：统一显示在对应专题卡列表下方。
  const [continueError, setContinueError] = useState("");
  // 当前时间：每秒刷新正在进行或等待节点的动态耗时。
  const [nowMs, setNowMs] = useState(() => Date.now());

  const groups = snapshot?.groups || [];
  const currentGroupId = findCurrentGroupId(groups);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  /** 读取专题卡当前是否展开。 */
  const isGroupOpen = (group: CollaborationTimelineGroupOutDto): boolean => {
    return groupOpenOverrides.get(group.groupId) ?? group.groupId === currentGroupId;
  };

  /** 记录用户对专题卡的展开或收起选择。 */
  const setGroupOpen = (groupId: string, open: boolean) => {
    updateOpenOverride(setGroupOpenOverrides, groupId, open);
  };

  /** 读取时间线节点当前是否展开。 */
  const isNodeOpen = (nodeId: string, automaticOpen: boolean): boolean => {
    return nodeOpenOverrides.get(nodeId) ?? automaticOpen;
  };

  /** 记录用户对时间线节点的展开或收起选择。 */
  const setNodeOpen = (nodeId: string, open: boolean) => {
    updateOpenOverride(setNodeOpenOverrides, nodeId, open);
  };

  /** 展开当前专题和当前节点，并将它平滑滚动到页面中央。 */
  const locateCurrentStep = () => {
    const currentGroup = groups.find((group) => group.groupId === currentGroupId);
    const currentNode = currentGroup
      ? [...currentGroup.nodes].reverse().find((node) => node.status === "current" || node.status === "waiting")
      : undefined;
    if (!currentGroup || !currentNode) return;

    setGroupOpen(currentGroup.groupId, true);
    setNodeOpen(currentNode.nodeId, true);

    window.requestAnimationFrame(() => {
      const selector = `[data-task-timeline-node-id="${CSS.escape(currentNode.nodeId)}"]`;
      document.querySelector<HTMLElement>(selector)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  /** 调用主进程继续任务，并把忙碌和失败状态完整反馈给页面。 */
  const continueTask = async (taskId: string) => {
    setContinuingTaskId(taskId);
    setContinueError("");

    try {
      await onContinueTask(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setContinueError(message);
    } finally {
      setContinuingTaskId(null);
    }
  };

  return {
    groups,
    currentGroupId,
    nowMs,
    continuingTaskId,
    continueError,
    isGroupOpen,
    setGroupOpen,
    isNodeOpen,
    setNodeOpen,
    locateCurrentStep,
    continueTask,
  };
}
