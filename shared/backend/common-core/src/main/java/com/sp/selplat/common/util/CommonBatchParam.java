package com.sp.selplat.common.util;

import java.util.ArrayList;
import java.util.List;

/**
 * 通用批量入参统一承接前端一次提交的多条 CommonParam。
 *
 * <p>请求示例：{@code {"items":[{"id":1},{"id":2}]}}</p>
 */
public class CommonBatchParam {

    // items 按前端提交顺序保存每条动态业务参数，供 Service 和 BaseDao 按固定批次继续处理。
    private List<CommonParam> items = new ArrayList<>();

    /**
     * 返回当前批量请求的全部业务项。
     *
     * @return 按提交顺序保存的业务项，例如 {@code [{"id":1},{"id":2}]}
     */
    public List<CommonParam> getItems() {
        // 返回稳定非空列表，让批量链路无需在每一层重复创建空集合。
        return items;
    }

    /**
     * 设置当前批量请求的全部业务项。
     *
     * @param items 前端提交的业务项，例如 {@code [{"id":1},{"id":2}]}
     * 执行结果示例：输入 {@code null} 时内部保存为 {@code []}，后续批处理不会收到空引用。
     */
    public void setItems(List<CommonParam> items) {
        // 前端未传 items 时回落为空列表，避免空请求误进入数据库批处理。
        this.items = items == null ? new ArrayList<>() : new ArrayList<>(items);
    }
}
