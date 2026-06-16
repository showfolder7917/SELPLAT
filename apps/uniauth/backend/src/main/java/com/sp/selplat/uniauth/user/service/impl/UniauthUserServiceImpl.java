package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserSaveIn;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserItemOut;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 用户服务实现只负责编排 ua_user 主表的基础增删改查。
@Service
public class UniauthUserServiceImpl implements UniauthUserService {

    // 用户 DAO 负责直接访问 ua_user 主表。
    private final UniauthUserDao uniauthUserDao;

    // 构造用户服务实现时注入用户 DAO。
    public UniauthUserServiceImpl(UniauthUserDao uniauthUserDao) {
        // 保存用户 DAO，供后续所有持久化动作复用。
        this.uniauthUserDao = uniauthUserDao;
    }

    // 列表查询直接下发筛选条件并返回账号集合。
    @Override
    public List<UniauthUserItemOut> listUsers(UniauthUserIn queryIn) {
        // 列表查询不修改数据，只负责把筛选条件透传到 DAO。
        return uniauthUserDao.selectUserList(queryIn);
    }

    // 详情查询负责校验主键并返回单个账号。
    @Override
    public UniauthUserItemOut getUserById(Long id) {
        // 主键为空时无法稳定定位账号，直接阻断错误请求。
        requireId(id);
        // 先按主键回查账号。
        UniauthUserItemOut userRow = uniauthUserDao.selectUserById(id);
        // 找不到账号时返回明确业务异常，避免控制层拿到空对象。
        requireExistingUser(userRow, id);
        return userRow;
    }

    // 新增账号统一负责默认值补齐、唯一性校验、密码哈希生成和主表写入。
    @Override
    @Transactional
    public UniauthUserItemOut createUser(UniauthUserSaveIn saveIn) {
        // 保存输入对象不能为空，否则后续字段校验没有业务对象可依附。
        requireSaveIn(saveIn);
        // 新增账号必须有稳定登录名。
        requireText(saveIn.getLoginName(), "loginName 不能为空");
        // 新增账号必须有显示名称，供后台界面展示。
        requireText(saveIn.getDisplayName(), "displayName 不能为空");
        // 新增账号必须显式传入密码，否则无法生成可登录账号。
        requireText(saveIn.getPassword(), "新增用户时 password 不能为空");
        // locale 缺失时统一兜底中文区域，保证最小可用。
        if (isBlank(saveIn.getLocale())) {
            saveIn.setLocale("zh-CN");
        }
        // userStatus 缺失时默认激活，减少新增账号时的额外输入。
        if (isBlank(saveIn.getUserStatus())) {
            saveIn.setUserStatus("ACTIVE");
        }
        // lockedFlag 缺失时默认未锁定，保证新账号初始可登录。
        if (saveIn.getLockedFlag() == null) {
            saveIn.setLockedFlag(Boolean.FALSE);
        }
        // 新增前先检查登录名是否已被使用，避免破坏唯一约束。
        ensureLoginNameAvailable(saveIn.getLoginName(), null);
        // 只有服务层负责把明文密码转成哈希，避免 DAO 承接安全策略。
        String passwordHash = hashPassword(saveIn.getPassword().trim());
        // 写入主表并依赖 MyBatis 回填主键。
        uniauthUserDao.insertUser(saveIn, passwordHash);
        // 按新主键回查正式结果，保证返回值与数据库一致。
        return getUserById(saveIn.getId());
    }

    // 更新账号统一负责存在性校验、登录名冲突校验、可选密码更新和主表覆盖。
    @Override
    @Transactional
    public UniauthUserItemOut updateUser(Long id, UniauthUserSaveIn saveIn) {
        // 更新前必须先校验主键。
        requireId(id);
        // 更新输入对象不能为空。
        requireSaveIn(saveIn);
        // 先确认目标账号真实存在，避免无声更新 0 行。
        UniauthUserItemOut existingUser = uniauthUserDao.selectUserById(id);
        requireExistingUser(existingUser, id);
        // 把路径主键写回输入对象，避免请求体和路径参数不一致。
        saveIn.setId(id);
        // 更新时仍要求稳定登录名和显示名称。
        requireText(saveIn.getLoginName(), "loginName 不能为空");
        requireText(saveIn.getDisplayName(), "displayName 不能为空");
        // locale 缺失时继续兜底中文区域。
        if (isBlank(saveIn.getLocale())) {
            saveIn.setLocale("zh-CN");
        }
        // userStatus 缺失时延续激活默认值，避免更新时把状态写成空。
        if (isBlank(saveIn.getUserStatus())) {
            saveIn.setUserStatus("ACTIVE");
        }
        // lockedFlag 缺失时默认按未锁定处理，避免数据库写入空值。
        if (saveIn.getLockedFlag() == null) {
            saveIn.setLockedFlag(Boolean.FALSE);
        }
        // 更新前检查新的登录名是否与别的账号冲突。
        ensureLoginNameAvailable(saveIn.getLoginName(), id);
        // 只有显式传入新密码时才重算密码哈希，否则保持旧密码不变。
        String passwordHash = isBlank(saveIn.getPassword()) ? "" : hashPassword(saveIn.getPassword().trim());
        // 执行主表更新。
        uniauthUserDao.updateUser(saveIn, passwordHash);
        // 回查正式结果返回给控制层。
        return getUserById(id);
    }

    // 删除账号统一负责存在性校验和主表删除。
    @Override
    @Transactional
    public void deleteUserById(Long id) {
        // 删除前必须先校验主键。
        requireId(id);
        // 删除前先确认账号存在，避免误报删除成功。
        UniauthUserItemOut existingUser = uniauthUserDao.selectUserById(id);
        requireExistingUser(existingUser, id);
        // 直接删除 ua_user 主表记录；关系表将在后续迁移完成后再联动补齐。
        uniauthUserDao.deleteUserById(id);
    }

    // 登录名唯一性检查统一放在服务层，避免控制层和 DAO 重复拼规则。
    private void ensureLoginNameAvailable(String loginName, Long currentId) {
        // 先按登录名查出现有账号，用于判断是否存在重名冲突。
        UniauthUserItemOut existingUser = uniauthUserDao.selectUserByLoginName(loginName.trim());
        // 查不到同名账号时说明当前登录名可用。
        if (existingUser == null) {
            return;
        }
        // 更新本人账号且登录名未变化时允许通过，不视为冲突。
        if (currentId != null && currentId.equals(existingUser.getId())) {
            return;
        }
        // 其余场景都视为登录名冲突，直接阻断提交。
        throw new IllegalArgumentException("loginName 已存在，不能重复");
    }

    // 主键校验统一收口，避免每个公开方法手写不同错误文案。
    private void requireId(Long id) {
        // 主键为空时说明调用方没有提供可定位的账号。
        if (id == null) {
            throw new IllegalArgumentException("id 不能为空");
        }
    }

    // 保存输入对象校验统一收口，避免公开方法各自重复写空判断。
    private void requireSaveIn(UniauthUserSaveIn saveIn) {
        // 没有请求体时无法执行新增或更新动作。
        if (saveIn == null) {
            throw new IllegalArgumentException("请求体不能为空");
        }
    }

    // 文本必填校验统一收口，保证错误文案稳定。
    private void requireText(String value, String message) {
        // 文本为空或只有空白字符时都视为未提供有效值。
        if (isBlank(value)) {
            throw new IllegalArgumentException(message);
        }
    }

    // 账号存在性校验统一收口，避免空对象继续向后流转。
    private void requireExistingUser(UniauthUserItemOut userRow, Long id) {
        // 查不到账号时说明目标记录不存在或已被删除。
        if (userRow == null) {
            throw new IllegalArgumentException("未找到用户，id=" + id);
        }
    }

    // 空白判断统一收口，避免在多个位置重复 trim 判空。
    private boolean isBlank(String value) {
        // 空值或去空格后为空都视为无有效文本。
        return value == null || value.trim().isEmpty();
    }

    // 密码哈希在本阶段先使用 JDK 内置 SHA-256，保证没有额外依赖也能稳定生成摘要。
    private String hashPassword(String rawPassword) {
        try {
            // 使用 SHA-256 统一把明文密码转换成固定长度摘要。
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            // 把原始密码按 UTF-8 编码成字节数组后交给摘要器计算。
            byte[] digest = messageDigest.digest(rawPassword.getBytes(StandardCharsets.UTF_8));
            // 逐字节转成十六进制字符串，形成可持久化哈希值。
            StringBuilder builder = new StringBuilder();
            // 每个字节都要补足两位十六进制，避免结果长度不稳定。
            for (byte currentByte : digest) {
                builder.append(String.format("%02x", currentByte));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            // SHA-256 属于 JDK 标准算法，理论上不应缺失，缺失时直接转成非法状态异常。
            throw new IllegalStateException("当前环境不支持 SHA-256", exception);
        }
    }
}
