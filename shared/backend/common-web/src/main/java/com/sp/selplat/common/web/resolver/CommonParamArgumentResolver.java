package com.sp.selplat.common.web.resolver;

import com.sp.selplat.common.util.CommonParam;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * 通用非分页参数解析器负责把请求解析成 `CommonParam`。
 * 这里不承接页码等固定分页字段，只负责生成可供业务接口直接使用的共通入参对象。
 */
@Component
public class CommonParamArgumentResolver extends AbstractCommonParamArgumentResolver<CommonParam> {

    /**
     * 返回当前解析器支持的参数类型。
     *
     * @return 固定返回 {@code CommonParam.class}
     */
    @Override
    protected Class<CommonParam> getSupportedType() {
        // 当前解析器只处理精确声明为 CommonParam 的控制器方法参数。
        return CommonParam.class;
    }

    /**
     * 创建空的 CommonParam 对象。
     *
     * @return 可继续承接请求值的空参数对象，例如 {@code {"paramMap":{}}}
     */
    @Override
    protected CommonParam createEmptyParam() {
        // 非分页接口在没有 JSON body 时统一回落到一个空的共通参数对象。
        return new CommonParam();
    }

    /**
     * 非分页参数对象没有固定页码字段，这里无需写回额外请求参数。
     *
     * @param targetParam 最终参数对象
     * @param request HTTP 请求
     */
    @Override
    protected void mergeFixedRequestParams(CommonParam targetParam, HttpServletRequest request) {
        // 当前解析器只承接动态业务字段，固定参数写回逻辑留给分页解析器处理。
    }
}
