import mysql, { RowDataPacket } from "mysql2/promise";
import { Channel } from "./type";

const pool = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "password",
    port: 3306,
    database: "gaon"
});

export async function getUserToken(userId: number) {
    const conn = await pool.getConnection();
    const userTokenTable = "`user_token`";
    const userTable ="`user`";
    const query = `SELECT u.userId, token, expired, ip FROM ${userTokenTable} t JOIN ${userTable} u ON t.userId = u.id WHERE u.id=?`;
    try {
        let [userRow, _] = await conn.query(query, userId);
        let result = userRow as RowDataPacket[];
        if (result.length < 0) {
            throw new Error("no such user.");
        }
        return result[0].token as string;
    } catch (err) {
        throw err;
    } finally {
        conn.release();
    }
}

export async function getChannel(channelId: number) {
    const conn = await pool.getConnection();
    const channelTable = "`channel`";

    try {
        const [channelRow, _] = await conn.query(`SELECT * FROM ${channelTable} WHERE id=?`, channelId);
        let channelResult = channelRow as RowDataPacket[];
        if (channelResult.length < 0) {
            throw new Error("no such channel.");
        }
        let id = channelResult[0].id;
        let projectId = channelResult[0].projectId;
        let groupId = channelResult[0].groupId;
        let name = channelResult[0].name;
        let type = channelResult[0].type;
        let createdBy = channelResult[0].createdBy;
        let bitRate = channelResult[0].bitRate;
        let maxConnect = channelResult[0].maxConnect;
        return new Channel(id, projectId, groupId, name, type, createdBy, bitRate, maxConnect);
    } catch (err) {
        throw err;
    } finally {
        conn.release();
    }
}

export async function getPermission(userId: number, channelId: number) {
    const conn = await pool.getConnection();
    const channelTable = "`channel`";
    const projectPermissionTable = "`project_permission`";

    try {
        const [channelRow, _] = await conn.query(`SELECT projectId, groupId FROM ${channelTable} WHERE id=?`, channelId);
        let channelResult = channelRow as RowDataPacket[];
        if (channelResult.length < 0) {
            return false;
        }
        let projectId = channelResult[0].projectId;

        const [projectPermissionRow, __] = await conn.query(`SELECT * FROM ${projectPermissionTable} WHERE projectId=? AND userId=?`, [projectId, userId]);
        let projectPermissionResult = projectPermissionRow as RowDataPacket[];
        if (projectPermissionResult.length < 0) {
            return false;
        }

        let permission = projectPermissionResult[0].permission;
        return permission != undefined;
    } catch (err) {
        throw err;
    } finally {
        conn.release();
    }
}