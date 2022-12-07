import * as config from "./hostConfig.json";
import { Channel, ProjectPermission } from "./type";
import axios from 'axios';

export async function getChannel(channelId: number) {
    try {
        let response = await HttpRequest("POST", `/channel/${channelId}`);
        let channel = response as Channel;
        if (!channel) {
            throw new Error("Failed to fetch channel.");
        }
        return channel;
    } catch (err) {
        console.log(err);
    }
}

export async function UserAuthentication(userId: number, token: string) {
    try {
        let response = await HttpRequest("POST", `/auth/`, {userId: userId}, token);
        let result = response as Result;
        if (result.result) {
            return true;
        } else {
            if ((response as boolean)) {
                return true;
            }
            return false;
        }
    } catch (err) {
        return false;
    }
}

export async function getPermission(userId: number, projectId: number) {
    try {
        let response = await HttpRequest("POST", `/project/${projectId}/permission`, {userId: userId});
        let result = response as ProjectPermission;
        if (!result) {
            return false;
        }
        return result.permission != 0;
    } catch (err) {
        return false;
    }
}

async function HttpRequest(method: "GET" | "POST", path: string, body?: any, token?: string) {
    let host = config.api.host;
    try {
        let header = {
            'Content-Type': 'application/json',
            'x-access-token': token ?? ""
        };
        let bodyData = JSON.stringify({...body});
        bodyData ??= "";

        let res = await axios.get(host + path, {data: bodyData, headers: header})
        console.log("HTTPRequest[%s]", path, res);
        if (res) {
            return res.data
        }
        return;
    } catch (err) {
        throw err;
    }
}

interface Result {
    result: boolean
}