import { Pool } from 'pg';
export declare class PostgresDatabase {
    private pool;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getConnectionStatus(): boolean;
    getPool(): Pool;
    private checkTables;
    query(text: string, params?: any[]): Promise<any>;
}
export declare const postgresDatabase: PostgresDatabase;
export default postgresDatabase;
//# sourceMappingURL=postgres.d.ts.map