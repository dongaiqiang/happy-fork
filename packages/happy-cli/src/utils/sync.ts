import { backoff } from "@/utils/time";

export class InvalidateSync {
    private _invalidated = false;
    private _invalidatedDouble = false;
    private _stopped = false;
    private _command: () => Promise<void>;
    private _pendings: (() => void)[] = [];

    constructor(command: () => Promise<void>) {
        this._command = command;
    }

    invalidate() {
        if (this._stopped) {
            return;
        }
        if (!this._invalidated) {
            this._invalidated = true;
            this._invalidatedDouble = false;
            // Fire and forget
            this._doSync().catch(err => {
                console.error("InvalidateSync unhandled error:", err);
            });
        } else {
            if (!this._invalidatedDouble) {
                this._invalidatedDouble = true;
            }
        }
    }

    async invalidateAndAwait() {
        if (this._stopped) {
            return;
        }
        await new Promise<void>(resolve => {
            this._pendings.push(resolve);
            this.invalidate();
        });
    }

    stop() {
        if (this._stopped) {
            return;
        }
        this._notifyPendings();
        this._stopped = true;
    }

    private _notifyPendings = () => {
        for (let pending of this._pendings) {
            pending();
        }
        this._pendings = [];
    }


    private _doSync = async () => {
        try {
            console.error("InvalidateSync _doSync started. stopped:", this._stopped);
            if (this._stopped) {
                return;
            }
            await this._command();
            console.error("InvalidateSync _doSync command finished.");
        } catch (e) {
            console.error("InvalidateSync _doSync error:", e);
        }
        
        if (this._stopped) {
            this._notifyPendings();
            return;
        }
        if (this._invalidatedDouble) {
            this._invalidatedDouble = false;
            this._doSync().catch(err => {
                console.error("InvalidateSync unhandled double sync error:", err);
            });
        } else {
            this._invalidated = false;
            this._notifyPendings();
        }
    }
}