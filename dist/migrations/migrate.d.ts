interface Migration {
    version: string;
    name: string;
    filename: string;
    executed_at?: Date;
}
declare class MigrationRunner {
    private client;
    initialize(): Promise<void>;
    private createMigrationsTable;
    getExecutedMigrations(): Promise<Migration[]>;
    getAvailableMigrations(): Promise<Migration[]>;
    runMigration(migration: Migration): Promise<void>;
    runMigrations(): Promise<void>;
    close(): Promise<void>;
}
export { MigrationRunner };
//# sourceMappingURL=migrate.d.ts.map