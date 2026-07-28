package com.sp.selplat.common.db.sequence;

import com.sp.selplat.common.db.sequence.model.CommonSequenceSegmentRange;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Repository;

/**
 * 公共号段 DAO 实现直接使用 JDBC 读取并更新号段表，确保抢号逻辑不依赖额外业务 Mapper。
 */
@Repository
public class CommonSequenceSegmentDaoImpl implements CommonSequenceSegmentDao {

    // 号段表固定使用统一驼峰表名，避免不同模块再各自维护表名常量。
    private static final String TABLE_NAME = "CommonSequenceSegment";

    // dataSource 由 Spring 注入当前模块实际使用的数据源，供 DAO 在统一事务上下文里执行抢号 SQL。
    @Autowired
    private DataSource dataSource;

    /**
     * 按号段编码申请下一段可用主键区间。
     *
     * @param seqCode 来自 DAO 主键定义的号段编码，例如 {@code "UniauthUserId"}
     * @return 本次成功申请到的区间，例如
     *     {@code {"startId":100001,"endId":101000,"stepSize":1000}}；乐观锁冲突时返回 null
     * @throws IllegalArgumentException 当号段编码为空时抛出，例如
     *     {@code IllegalArgumentException("seqCode must not be blank")}
     * @throws IllegalStateException 当号段未配置、步长非法或数据库访问失败时抛出，例如
     *     {@code IllegalStateException("no active sequence segment found for seqCode: UniauthUserId")}
     */
    @Override
    public CommonSequenceSegmentRange allocateNextRange(String seqCode) {
        // 号段编码为空时立即失败，避免查询落到整表扫描或错误更新路径。
        if (seqCode == null || seqCode.trim().isEmpty()) {
            throw new IllegalArgumentException("seqCode must not be blank");
        }
        // 统一通过 Spring 的 DataSourceUtils 取连接，保证后续若接入事务边界时仍能复用同一连接上下文。
        Connection connection = DataSourceUtils.getConnection(dataSource);
        try {
            // 先读取当前启用中的号段快照，供后续基于版本号执行乐观锁更新。
            SequenceSegmentSnapshot snapshot = queryActiveSnapshot(connection, seqCode.trim());
            // 未配置或已停用的号段直接失败，避免服务层在无配置场景下继续盲目重试。
            if (snapshot == null) {
                throw new IllegalStateException("no active sequence segment found for seqCode: " + seqCode);
            }
            // 当前步长必须为正数，否则说明号段配置本身有问题，继续发号只会产生错误区间。
            if (snapshot.stepSize <= 0) {
                throw new IllegalStateException("invalid stepSize for seqCode: " + seqCode);
            }
            // 先根据当前快照计算更新后新的起始值，供后续单条 update 原子推进号段游标。
            long nextStartIdAfterUpdate = snapshot.nextStartId + snapshot.stepSize;
            // 再按版本号执行乐观锁更新；若返回 0 说明有并发实例抢先更新了当前号段。
            int updateCount = updateNextStartId(connection, seqCode.trim(), snapshot.versionNo, nextStartIdAfterUpdate);
            if (updateCount == 0) {
                return null;
            }
            // 更新成功后，把当前实例本次拿到的区间边界回填到返回对象，交给服务层缓存发号。
            CommonSequenceSegmentRange range = new CommonSequenceSegmentRange();
            range.setStartId(snapshot.nextStartId);
            range.setEndId(nextStartIdAfterUpdate - 1);
            range.setStepSize(snapshot.stepSize);
            return range;
        } catch (SQLException exception) {
            // 数据库访问失败时统一转成非法状态异常，避免上层继续把异常误当作并发冲突重试。
            throw new IllegalStateException("allocate sequence range failed for seqCode: " + seqCode, exception);
        } finally {
            // 统一释放当前连接，让非事务场景下的 JDBC 连接及时归还给数据源。
            DataSourceUtils.releaseConnection(connection, dataSource);
        }
    }

    /**
     * 查询当前启用号段的游标、步长和乐观锁版本。
     *
     * @param connection 通过 Spring 事务上下文获取的真实 JDBC 连接
     * @param seqCode DAO 主键定义提供的号段编码，例如 {@code "UniauthUserId"}
     * @return 内部快照，例如 {@code {"nextStartId":100001,"stepSize":1000,"versionNo":3}}；
     *     没有启用配置时返回 null
     * @throws SQLException 当预编译或读取号段表失败时抛出
     */
    private SequenceSegmentSnapshot queryActiveSnapshot(Connection connection, String seqCode) throws SQLException {
        // 当前查询只读取抢号真正需要的三项核心字段，避免把无关配置字段一起带入并发路径。
        String sql = "SELECT nextStartId, stepSize, versionNo FROM " + TABLE_NAME + " WHERE seqCode = ? AND status = 1";
        try (PreparedStatement preparedStatement = connection.prepareStatement(sql)) {
            // 按号段编码绑定查询参数，保证只命中当前模块对应的那一行配置。
            preparedStatement.setString(1, seqCode);
            try (ResultSet resultSet = preparedStatement.executeQuery()) {
                // 未查到启用中的号段配置时直接返回空，让调用方统一按“未配置”处理。
                if (!resultSet.next()) {
                    return null;
                }
                // 把当前号段快照组装成只读对象，便于后续更新阶段直接复用已读取的边界值。
                SequenceSegmentSnapshot snapshot = new SequenceSegmentSnapshot();
                snapshot.nextStartId = resultSet.getLong("nextStartId");
                snapshot.stepSize = resultSet.getInt("stepSize");
                snapshot.versionNo = resultSet.getInt("versionNo");
                return snapshot;
            }
        }
    }

    /**
     * 按旧版本号原子推进号段游标和版本号。
     *
     * @param connection 与快照查询相同事务上下文中的 JDBC 连接
     * @param seqCode 当前号段编码，例如 {@code "UniauthUserId"}
     * @param versionNo 快照读取到的旧版本号，例如 {@code 3}
     * @param nextStartIdAfterUpdate 当前区间发放后的新游标，例如 {@code 101001L}
     * @return 更新成功返回 {@code 1}；并发冲突或号段失效返回 {@code 0}
     * @throws SQLException 当预编译或更新号段表失败时抛出
     */
    private int updateNextStartId(
            Connection connection,
            String seqCode,
            int versionNo,
            long nextStartIdAfterUpdate) throws SQLException {
        // 当前更新只推进 nextStartId、versionNo 和 updatedAt，避免把最近操作用户字段误写成系统线程上下文。
        String sql =
            "UPDATE " + TABLE_NAME +
            " SET nextStartId = ?, versionNo = versionNo + 1, updatedAt = CURRENT_TIMESTAMP" +
            " WHERE seqCode = ? AND versionNo = ? AND status = 1";
        try (PreparedStatement preparedStatement = connection.prepareStatement(sql)) {
            // 写入更新后的号段游标，保证下一次成功抢号时从新区间起点继续分配。
            preparedStatement.setLong(1, nextStartIdAfterUpdate);
            // 按号段编码锁定目标行，避免不同模块之间互相影响。
            preparedStatement.setString(2, seqCode);
            // 按旧版本号做乐观锁控制，确保只有读取到该快照的当前线程能成功推进游标。
            preparedStatement.setInt(3, versionNo);
            return preparedStatement.executeUpdate();
        }
    }

    /**
     * 号段快照仅在当前 DAO 内部使用，因此用私有静态类承接读取结果即可。
     */
    private static class SequenceSegmentSnapshot {

        // nextStartId 表示当前仍未被任何实例领取的下一个号段起点。
        private long nextStartId;
        // stepSize 表示这次抢号成功后可分配给当前实例的主键数量。
        private int stepSize;
        // versionNo 表示当前快照读取到的乐观锁版本号。
        private int versionNo;
    }
}
