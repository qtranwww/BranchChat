import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const schemaVersion = 3;

const migrationV1 = `
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE branches (
    conversation_id TEXT NOT NULL,
    id TEXT NOT NULL,
    origin_node_id TEXT,
    side TEXT CHECK (side IN ('left', 'right') OR side IS NULL),
    sibling_order INTEGER NOT NULL CHECK (sibling_order >= 0),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    PRIMARY KEY (conversation_id, id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id, origin_node_id)
      REFERENCES nodes(conversation_id, id) DEFERRABLE INITIALLY DEFERRED,
    CHECK (
      (origin_node_id IS NULL AND side IS NULL AND sibling_order = 0) OR
      (origin_node_id IS NOT NULL AND side IS NOT NULL)
    )
  );

  CREATE TABLE nodes (
    conversation_id TEXT NOT NULL,
    id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    previous_node_id TEXT,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    question TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('pending', 'streaming', 'completed', 'failed')),
    error_code TEXT,
    PRIMARY KEY (conversation_id, id),
    UNIQUE (conversation_id, branch_id, sequence),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id, branch_id)
      REFERENCES branches(conversation_id, id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id, previous_node_id)
      REFERENCES nodes(conversation_id, id) DEFERRABLE INITIALLY DEFERRED
  );

  CREATE UNIQUE INDEX one_main_branch_per_conversation
    ON branches(conversation_id)
    WHERE origin_node_id IS NULL;

  CREATE UNIQUE INDEX sibling_order_per_origin_side
    ON branches(conversation_id, origin_node_id, side, sibling_order)
    WHERE origin_node_id IS NOT NULL;

  CREATE INDEX conversations_updated_at ON conversations(updated_at DESC);
  CREATE INDEX nodes_by_branch ON nodes(conversation_id, branch_id, sequence);
`;

const migrationV2 = `
  ALTER TABLE conversations
    ADD COLUMN context_mode TEXT NOT NULL DEFAULT 'full'
    CHECK (context_mode IN ('full', 'summary_beta'));
`;

const migrationV3 = `
  ALTER TABLE branches
    ADD COLUMN fork_summary TEXT
    CHECK (fork_summary IS NULL OR length(fork_summary) <= 12000);
`;

export type LocalDatabase = Database.Database;

function hasColumn(database: LocalDatabase, table: string, column: string): boolean {
  const columns = database.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return columns.some((candidate) => candidate.name === column);
}

export function migrateLocalDatabase(database: LocalDatabase): void {
  database.pragma("foreign_keys = ON");
  const currentVersion = database.pragma("user_version", { simple: true }) as number;

  if (currentVersion > schemaVersion) {
    throw new Error("The local database was created by a newer BranchChat version.");
  }

  if (currentVersion < 1) {
    database.transaction(() => {
      database.exec(migrationV1);
      database.pragma("user_version = 1");
    })();
  }

  if (currentVersion < 2) {
    database.transaction(() => {
      database.exec(migrationV2);
      database.pragma("user_version = 2");
    })();
  }

  if (currentVersion < 3) {
    database.transaction(() => {
      if (!hasColumn(database, "branches", "fork_summary")) {
        database.exec(migrationV3);
      }

      database.pragma("user_version = 3");
    })();
  }
}

export function openLocalDatabase(filename: string): LocalDatabase {
  const database = new Database(filename);

  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  migrateLocalDatabase(database);

  return database;
}

function resolveDatabasePath(): string {
  const dataDirectory = path.join(process.cwd(), "data");

  mkdirSync(dataDirectory, { recursive: true });
  return path.join(dataDirectory, "branchchat.db");
}

const globalDatabase = globalThis as typeof globalThis & {
  branchChatDatabase?: LocalDatabase;
};

export function getLocalDatabase(): LocalDatabase {
  if (!globalDatabase.branchChatDatabase) {
    globalDatabase.branchChatDatabase = openLocalDatabase(resolveDatabasePath());
  } else {
    migrateLocalDatabase(globalDatabase.branchChatDatabase);
  }

  return globalDatabase.branchChatDatabase;
}
