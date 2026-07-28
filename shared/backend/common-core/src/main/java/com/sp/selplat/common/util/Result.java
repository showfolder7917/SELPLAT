package com.sp.selplat.common.util;

import java.io.Serializable;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 通用结果对象，用于兼容旧式控制器返回结构并统一承接是否成功、结果码和模型数据。
 */
public class Result implements Serializable {

    // 序列化版本号用于保证结果对象在分布式传输或缓存场景下结构稳定。
    private static final long serialVersionUID = 1L;

    // success 表示当前业务处理是否成功，供前端或调用方快速判断接口结果。
    private boolean success;

    // result 承接控制层或服务层返回的多组模型数据，便于旧式页面接口按 key 取值。
    private Map<String, Object> result = new LinkedHashMap<>();

    // modelKey 记录最后一次写入的默认模型 key，便于老代码直接 get() 读取最近一次结果。
    private String modelKey;

    // resultCode 承接业务结果码，便于前端按统一编码做提示或国际化转换。
    private String resultCode;

    // resultCodeParams 承接结果码对应的动态占位参数，便于后续拼接多语言文案。
    private String[] resultCodeParams;

    /**
     * 按是否成功创建结果对象。
     *
     * @param success 来自业务执行结果的成功标记，例如 {@code true}
     * 执行结果示例：新对象的 {@code success} 保存为 {@code true}，模型映射初始为 {@code {}}。
     */
    public Result(boolean success) {
        // 构造时直接写入成功标记，便于控制层快速返回成功或失败结果。
        this.success = success;
    }

    /**
     * 创建默认结果对象。
     *
     * <p>执行结果示例：创建后 {@code success=false}、模型映射为 {@code {}}。</p>
     */
    public Result() {
    }

    /**
     * 按指定 key 写入默认模型数据，并把当前 key 记录为最近一次默认模型。
     *
     * @param key 调用方约定的模型 key，例如 {@code "user"}
     * @param object Service 返回的模型对象，例如 {@code {"id":1,"loginName":"admin"}}
     * @return 同一 key 被覆盖前的旧值；首次写入 {@code user} 时返回 null
     */
    public Object addDefaultModel(String key, Object object) {
        // 记录当前默认模型 key，便于旧式调用方后续直接 get() 读取。
        modelKey = key;
        // 把模型写入结果映射，供页面或接口按 key 访问。
        return result.put(key, object);
    }

    /**
     * 写入通用消息文本。
     *
     * @param message 来自业务动作的消息文本，例如 {@code "查询完成。"}
     * @return 原 {@code msg} 值；首次写入时返回 null，结果映射变为 {@code {"msg":"查询完成。"}}
     */
    public Object addMsg(String message) {
        // 通用消息统一使用 msg 作为固定 key，便于前端按约定读取。
        modelKey = "msg";
        // 把消息写入结果映射，供页面提示或接口响应展示。
        return result.put(modelKey, message);
    }

    /**
     * 返回当前结果里所有模型 key。
     *
     * @return 模型 key 集合，例如 {@code ["user","msg"]}
     */
    public Set<String> keySet() {
        return result.keySet();
    }

    /**
     * 返回最近一次写入的默认模型对象。
     *
     * @return 最近一次写入的默认模型对象，例如 {@code "查询完成。"}；没有默认 key 时返回 null
     */
    public Object get() {
        return result.get(modelKey);
    }

    /**
     * 按 key 读取模型对象。
     *
     * @param key 调用方要读取的模型 key，例如 {@code "user"}
     * @return 对应模型对象，例如 {@code {"id":1,"loginName":"admin"}}；key 不存在时返回 null
     */
    public Object get(String key) {
        return result.get(key);
    }

    /**
     * 返回所有模型值集合。
     *
     * @return 模型值集合，例如 {@code [{"id":1,"loginName":"admin"},"查询完成。"]}
     */
    public Collection<Object> values() {
        return result.values();
    }

    /**
     * 返回当前结果是否成功。
     *
     * @return 是否成功，例如 {@code true}
     */
    public boolean isSuccess() {
        return success;
    }

    /**
     * 设置当前结果是否成功。
     *
     * @param success 来自业务执行结果的成功标记，例如 {@code true}
     * 执行结果示例：旧式结果对象保存为 {@code success=true}。
     */
    public void setSuccess(boolean success) {
        this.success = success;
    }

    /**
     * 返回业务结果码。
     *
     * @return 业务结果码，例如 {@code "USER_NOT_FOUND"}
     */
    public String getResultCode() {
        return resultCode;
    }

    /**
     * 设置业务结果码。
     *
     * @param resultCode 来自业务异常或成功分支的结果码，例如 {@code "USER_NOT_FOUND"}
     * 执行结果示例：结果对象保存为 {@code resultCode="USER_NOT_FOUND"}。
     */
    public void setResultCode(String resultCode) {
        this.resultCode = resultCode;
    }

    /**
     * 设置业务结果码及其占位参数。
     *
     * @param resultCode 来自业务异常或成功分支的结果码，例如 {@code "USER_NOT_FOUND"}
     * @param args 用于结果文案占位的业务值，例如 {@code ["1001"]}
     * 执行结果示例：保存 {@code resultCode="USER_NOT_FOUND"} 和 {@code resultCodeParams=["1001"]}。
     */
    public void setResultCode(String resultCode, String... args) {
        this.resultCode = resultCode;
        this.resultCodeParams = args;
    }

    /**
     * 返回结果码占位参数。
     *
     * @return 结果码占位参数，例如 {@code ["1001","admin"]}
     */
    public String[] getResultCodeParams() {
        return resultCodeParams;
    }

    /**
     * 设置结果码占位参数。
     *
     * @param resultCodeParams 来自结果文案的占位参数，例如 {@code ["1001","admin"]}
     * 执行结果示例：结果对象保存同顺序数组 {@code ["1001","admin"]}。
     */
    public void setResultCodeParams(String[] resultCodeParams) {
        this.resultCodeParams = resultCodeParams;
    }

    /**
     * 返回结果模型映射。
     *
     * @return 结果模型映射，例如 {@code {"user":{"id":1},"msg":"查询完成。"}}
     */
    public Map<String, Object> getResult() {
        return result;
    }

    /**
     * 设置结果模型映射。
     *
     * @param result 来自旧式 Controller 的完整模型映射，例如 {@code {"user":{"id":1},"msg":"查询完成。"}}
     * 执行结果示例：后续 {@code get("user")} 返回 {@code {"id":1}}。
     */
    public void setResult(Map<String, Object> result) {
        this.result = result;
    }
}
