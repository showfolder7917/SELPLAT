/**
 * 可信命令协议只向页面返回授权数量，不返回命令正文或机器路径。
 * 生产者：主进程命令治理平台；消费者：设置页与 DesktopApi。
 */
export interface TrustedCommandInfo {
  /** 当前已保存的授权条数；清空后固定返回 0。 */
  count: number;
}
