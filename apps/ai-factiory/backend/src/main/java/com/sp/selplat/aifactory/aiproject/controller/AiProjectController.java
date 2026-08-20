package com.sp.selplat.aifactory.aiproject.controller;

import com.sp.selplat.aifactory.aiproject.service.AiProjectService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布项目登记的标准查询、新增、修改和逻辑删除接口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/projects", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiProjectController {
    private final AiProjectService service;

    /**
     * 创建项目管理控制器。
     * 真实传参示例：Spring 注入 {@code AiProjectServiceImpl}。
     * 真实返回示例：构造后发布项目新增、修改和逻辑删除接口。
     * 异常或副作用示例：服务缺失时应用启动失败；构造过程不访问数据库。
     * @param service 项目登记业务服务
     */
    public AiProjectController(AiProjectService service) {
        this.service = service;
    }

    /**
     * 新增一个项目登记。
     * 真实传参示例：{@code projectCode=DEMO&projectName=演示项目&status=1}。
     * 真实返回示例：返回新项目主键和登记字段。
     * 异常或副作用示例：项目编码重复时事务回滚；成功时公共号段生成主键。
     * @param values 表单中的项目编码、名称、说明、状态和排序
     * @return 新增结果 JSON
     */
    @PostMapping("/create.htm")
    public String create(@RequestParam Map<String, String> values) {
        return JsonUtils.toJsonIgnoreNull(service.insert(command(values)));
    }

    /**
     * 修改一个项目登记。
     * 真实传参示例：{@code id=130001&projectName=SELPLAT平台}。
     * 真实返回示例：返回已更新项目主键和字段。
     * 异常或副作用示例：主键不存在或编码冲突时不产生部分更新。
     * @param values 表单中的项目主键和待修改字段
     * @return 修改结果 JSON
     */
    @PostMapping("/update.htm")
    public String update(@RequestParam Map<String, String> values) {
        return JsonUtils.toJsonIgnoreNull(service.update(command(values)));
    }

    /**
     * 逻辑删除一个项目登记。
     * 真实传参示例：{@code id=130010}。
     * 真实返回示例：返回 {@code status=0} 的项目记录。
     * 异常或副作用示例：流程仍引用项目时业务层或数据库拒绝危险操作；不物理删除。
     * @param values 表单中的项目主键
     * @return 删除结果 JSON
     */
    @PostMapping("/delete.htm")
    public String delete(@RequestParam Map<String, String> values) {
        return JsonUtils.toJsonIgnoreNull(service.delete(command(values)));
    }

    /**
     * 把标准表单字段转换为公共动态参数。
     * 真实传参示例：{@code {projectCode=DEMO,projectName=演示项目}}。
     * 真实返回示例：返回可由 BaseService 读取同名字段的 CommonParam。
     * 异常或副作用示例：空映射返回空参数并由业务校验处理；不修改原映射。
     * @param values HTTP 表单字段
     * @return 公共业务参数
     */
    private CommonParam command(Map<String, String> values) {
        CommonParam command = new CommonParam();
        values.forEach(command::putParam);
        return command;
    }
}
