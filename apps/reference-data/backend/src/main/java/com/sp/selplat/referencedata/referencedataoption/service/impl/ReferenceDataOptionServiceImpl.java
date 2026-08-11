package com.sp.selplat.referencedata.referencedataoption.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedataoption.dao.ReferenceDataOptionDao;
import com.sp.selplat.referencedata.referencedataoption.service.ReferenceDataOptionService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 从 ReferenceDataOption 表读取记录并转换为公共 Map 下拉选项。 */
@Service
public class ReferenceDataOptionServiceImpl
        extends BaseServiceImpl<ReferenceDataOptionDao>
        implements ReferenceDataOptionService {

    /** {@inheritDoc} */
    @Override
    public CommonResult getOptions(String projectCode, String resourceCode, Map<String, String> parameters) {
        List<Map<String, Object>> rows = getDao().findEnabledOptions(projectCode, resourceCode);
        if (rows.isEmpty()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_OPTIONS_NOT_FOUND",
                    "未找到引用数据选项：" + projectCode + "/" + resourceCode);
        }
        String locale = ReferenceDataQueryUtil.locale(parameters);
        List<Map<String, Object>> options = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Number sortnum = (Number) row.get("sortnum");
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("value", String.valueOf(row.get("optionValue")));
            option.put("label", ReferenceDataQueryUtil.label(row, locale));
            option.put("groupCode", row.get("groupCode") == null ? null : String.valueOf(row.get("groupCode")));
            option.put("sortOrder", sortnum == null ? 0 : new BigDecimal(String.valueOf(sortnum)).intValue());
            option.put("disabled", Boolean.TRUE.equals(row.get("disabled")));
            option.put("attributes", ReferenceDataQueryUtil.attributes(row.get("attributesJson")));
            options.add(Collections.unmodifiableMap(option));
        }
        String path = "/api/reference-data/" + projectCode.trim() + "/" + resourceCode.trim() + "/options";
        return ReferenceDataQueryUtil.success(List.copyOf(options), path, "引用数据选项查询完成。");
    }
}
