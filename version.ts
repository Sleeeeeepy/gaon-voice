export function parseNodeVersion(version: string) {
    version.replace("v", "");
    const SplitVersion = version.split(".");
    let major = Number.parseInt(SplitVersion[0]);
    let minor = Number.parseInt(SplitVersion[1]);
    let patch = Number.parseInt(SplitVersion[2]);
    
    major ??= 0;
    minor ??= 0;
    patch ??= 0;

    return {major, minor, patch} as NodeVersion;
}

//export function compareNodeVersion(version1: string, version2: string) {
//    const NodeVersion1 = parseNodeVersion(version1);
//    const NodeVersion2 = parseNodeVersion(version2);
//
//    if (NodeVersion1.major > NodeVersion2.major) {
//        return 1;
//    } else if (NodeVersion1.major < NodeVersion2.major) {
//        return -1;
//    }
//
//    if (NodeVersion1.minor > NodeVersion2.minor) {
//        return 1;
//    } else if (NodeVersion1.minor < NodeVersion2.minor) {
//        return -1;
//    }
//
//    if (NodeVersion1.patch > NodeVersion2.patch) {
//        return 1;
//    } else if (NodeVersion1.patch < NodeVersion2.patch) {
//        return -1;
//    }
//
//    return 0;
//}

export function compareMajor(version: string, major: number) {
    const NodeVersion = parseNodeVersion(version);

    if (NodeVersion.major === major) {
        return 0;
    } else if (NodeVersion.major > major) {
        return 1;
    }
    return -1;
}

interface NodeVersion {
    major: number,
    minor: number,
    patch: number
}