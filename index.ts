import { main } from "./main";
import { compareMajor } from "./version";
import * as hostConfig from "./hostConfig.json";

const NodeVer = process.versions.node;
if (hostConfig.express["cors-origin"] === "*") {
    console.warn("Cross origin is set to *(Express).");
}
if (hostConfig.socket["cors-origin"] === "*") {
    console.warn("Cross origin is set to *(Socket.io).");
}
main();
/*if (compareMajor(NodeVer, 19) >= 0) {
    main();
} else if (compareMajor(NodeVer, 18) == 0) {
    console.log("if the fetch function does not work, then please enable experimental fetch.");
    main();
} else {
    console.error("Node version must be at least 18.");
    console.error(`(current version: v${NodeVer})`);
}*/
