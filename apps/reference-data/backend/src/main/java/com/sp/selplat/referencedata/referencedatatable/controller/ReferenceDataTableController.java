package com.sp.selplat.referencedata.referencedatatable.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 ReferenceDataTable 的分页、详情、新增、更新和假删除接口。 */
@RestController
@ModuleDescription(
        code = "reference-data-table",
        name = "页面表格登记",
        description = "登记项目页面表格并进入对应表格头明细")
@RequestMapping(value = "/api/reference-data/admin/tables/", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataTableController extends BaseController<ReferenceDataTableService> {
}
