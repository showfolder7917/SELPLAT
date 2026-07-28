package com.sp.selplat.common.web.resolver;

import com.sp.selplat.common.util.CommonPageParam;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 通用分页参数解析器负责把请求解析成 `CommonPageParam`。
 * 这里在承接动态业务字段之外，还统一把 query string 或表单中的页码参数回填到分页对象。
 */
@Component
public class CommonPageParamArgumentResolver extends AbstractCommonParamArgumentResolver<CommonPageParam> {

    /**
     * 返回当前解析器支持的参数类型。
     *
     * @return 固定返回 {@code CommonPageParam.class}
     */
    @Override
    protected Class<CommonPageParam> getSupportedType() {
        // 当前解析器只处理精确声明为 CommonPageParam 的控制器方法参数。
        return CommonPageParam.class;
    }

    /**
     * 创建空的 CommonPageParam 对象。
     *
     * @return 可继续承接请求值的空分页参数对象，例如 {@code {"pageNo":null,"pageSize":null,"paramMap":{}}}
     */
    @Override
    protected CommonPageParam createEmptyParam() {
        // 分页接口在没有 JSON body 时统一回落到一个默认分页对象，保证 pageNo/pageSize 仍有稳定默认值。
        return new CommonPageParam();
    }

    /**
     * 把普通请求里的分页固定字段写回分页参数对象。
     *
     * @param targetParam 最终分页参数对象
     * @param request HTTP 请求
     */
    @Override
    protected void mergeFixedRequestParams(CommonPageParam targetParam, HttpServletRequest request) {
        // 调用方显式传了 pageNo 时才覆盖当前对象页码，避免 JSON body 里的分页值被默认值误刷掉。
        if (StringUtils.hasText(request.getParameter("pageNo"))) {
            targetParam.setPageNo(Integer.valueOf(request.getParameter("pageNo")));
        }
        // 调用方显式传了 pageSize 时才覆盖当前对象每页条数，保持 JSON body 与 query string 的合并语义清晰。
        if (StringUtils.hasText(request.getParameter("pageSize"))) {
            targetParam.setPageSize(Integer.valueOf(request.getParameter("pageSize")));
        }
    }
}
