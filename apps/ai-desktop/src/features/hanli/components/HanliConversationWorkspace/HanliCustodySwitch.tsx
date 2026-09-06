/**
 * 韩立会话页面中的“自动托管”子模块。
 *
 * 用户点击 Developer 左侧人物树中的“韩立”后，会进入韩立会话页面。
 * 本文件对应页面输入区左下角的“自动托管”开关，只负责展示和修改托管状态。
 * 它不是可以独立进入的子页面，而是 HanliConversationWorkspace 页面专用的子组件。
 */

import {
  // 状态记录方法（useState）由 React 提供，用于记录开关设置是否正在保存。
  useState,
} from "react";

// 共享演化状态方法（useEvolutionRuntime）用于读取并刷新自动托管设置。
import { useEvolutionRuntime } from "../../../evolution";

/** 韩立自动托管开关需要由父页面提供的数据结构。 */
interface HanliCustodySwitchProps {
  /** 当托管设置保存失败时，把可读错误交给韩立会话页面显示。 */
  onError(message: string): void;
}

/**
 * 展示并控制韩立的自动托管状态。
 *
 * 关闭时，韩立完成调查后需要客户确认；开启时，韩立可在已授权范围内依据事实代确认。
 * 本开关不会停止已经执行的任务，也不会修改令狐的巡检设置。
 */
export function HanliCustodySwitch(props: HanliCustodySwitchProps) {
  // 错误更新操作（onError）来自韩立会话父页面，用于统一显示本组件的保存问题。
  const onError = props.onError;

  // 当前演化状态（state）由后端返回，其中包含已经生效的自动化设置。
  // 演化状态更新操作（setState）使用后端最新结果刷新页面，使其他区域保持一致。
  const { state, setState } = useEvolutionRuntime();

  // 保存等待状态（busy）表示本次开关修改是否正在保存，初始状态为未保存。
  // 保存状态更新操作（setBusy）在保存开始和结束时更新状态，防止客户连续点击。
  const [busy, setBusy] = useState(false);

  // 自动托管开关状态（enabled）只在后端明确返回 true 时开启，状态未就绪时按关闭展示。
  const enabled = state?.automationSettings.automaticCustodyEnabled === true;

  /** 客户点击自动托管开关后，保存相反状态并刷新共享运行态。 */
  async function toggleCustody(): Promise<void> {
    // 运行态尚未加载或已有保存操作时，不再发起新的后端请求。
    if (!state || busy) {
      // 保持当前显示与服务端状态一致，不做乐观修改。
      return;
    }

    // 锁定开关，避免一次保存完成前重复提交相同设置。
    setBusy(true);

    // 保存处理过程从这里开始，统一覆盖桌面调用、结果校验和共享状态刷新。
    try {
      // 最新演化状态（next）是后端保存成功后返回的权威结果。
      const next = await window.desktop?.configureEvolutionAutomation({
        // 保留自动化设置中的其他字段，避免本开关误改无关配置。
        ...state.automationSettings,
        // 自动托管字段（automaticCustodyEnabled）取当前状态的相反值，实现开关切换。
        automaticCustodyEnabled: !enabled,
      });

      // 没有桌面 API 或后端未返回新状态都属于真实保存失败。
      if (!next) {
        // 抛出业务可读错误，交给下面的统一失败分支处理。
        throw new Error("自动托管设置未保存");
      }

      // 使用后端权威结果刷新页面，避免界面状态与真实设置不一致。
      setState(next);
    // 保存失败处理接住桌面通信失败、后端拒绝或状态刷新异常。
    } catch (error) {
      // 标准错误对象（Error）保留真实原因，未知异常使用稳定的默认说明。
      const message = error instanceof Error ? error.message : "自动托管设置失败";
      // 把错误交给父页面的统一错误区域展示。
      onError(message);
    // 保存结束处理保证无论成功还是失败，都可以重新操作开关。
    } finally {
      // 解除本组件的保存锁。
      setBusy(false);
    }
  }

  // 返回韩立输入区左下角可见的自动托管开关结构。
  return <button
    // 按钮类型（button）明确该节点只执行操作，不触发外层会话表单提交。
    type="button"
    // 统一开关样式（selswitch）提供项目约定的开关外观。
    className="selswitch"
    // 开关语义（switch）让辅助技术把该按钮理解成可以切换状态的控件。
    role="switch"
    // 无障碍名称（aria-label）为无法看到界面的客户说明开关名称。
    aria-label="自动托管"
    // 无障碍开关状态（aria-checked）向辅助技术同步后端当前生效的状态。
    aria-checked={enabled}
    // 状态未加载或正在保存时禁用控件，防止无效和重复请求。
    disabled={!state || busy}
    // 悬停说明（title）解释关闭和开启分别会产生什么业务效果。
    title="关闭：调查后请你确认；开启：在授权范围内依据事实代确认"
    // 点击事件只调用具名方法，让页面结构中不混入后端保存流程。
    onClick={() => void toggleCustody()}
  >
    {/* 开关文字：说明该控件控制的是自动托管功能。 */}
    <span>自动托管</span>
    {/* 开关轨道：只负责视觉表现，辅助技术无需重复读取。 */}
    <i className="selswitch-track" aria-hidden="true">
      {/* 开关滑块：通过样式位置表达当前开启或关闭状态。 */}
      <i className="selswitch-thumb" />
    </i>
  </button>;
}
