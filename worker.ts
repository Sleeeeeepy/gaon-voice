import { Worker as MediasoupWorker} from "mediasoup/node/lib/Worker";
import * as config from "./config";

export class WorkerManager {
    private static _workerList: Array<Worker>;

    private constructor() {}

    public static getIdleWorker() {
        if (!this._workerList) {
            let workerList = this.init();
            if (workerList.length === 0) {
                throw new Error("Failed to get idle worker.");
            }
            return workerList.at(0);
        }
        else if (this._workerList.length === 0) {
            throw new Error("Failed to get idle worker.");
        }

        for (let i = 0; i < this._workerList.length; i++) {
            let worker = this._workerList.at(i);
            if (worker?.status === WorkerStatus.IDLE) {
                return worker;
            }
        }

        return undefined;
    }

    public static markRunning(worker: Worker) {
        worker.status = WorkerStatus.RUNNING;
    }

    public static markIdle(worker: Worker) {
        worker.status = WorkerStatus.IDLE;
    }

    public static init() {
        WorkerManager._workerList = new Array<Worker>();
        for (let i = 0; i < config.numberOfWorkers; i++) {
            let worker = new MediasoupWorker(config.worker_config);
            let _worker = new Worker(worker);
            worker.on("died", () => {
                console.error("Worker died. exit process.");
                _worker.status = WorkerStatus.TERMINATED;
                process.exit(-1);
            });
            
            WorkerManager._workerList.push(_worker);
        }
        return this._workerList;
    }
}

export class Worker {
    private _worker: MediasoupWorker;
    private _status: WorkerStatus;

    public constructor(worker: MediasoupWorker) {
        this._worker = worker;
        this._status = WorkerStatus.IDLE;
    }

    public set status(status: WorkerStatus) {
        this._status = status;
    }
 
    public get status() {
        return this._status;
    }

    public get worker() {
        return this._worker;
    }

    public close() {
        return this._worker.close();
    }
}

enum WorkerStatus {
    IDLE,
    RUNNING,
    TERMINATED
}