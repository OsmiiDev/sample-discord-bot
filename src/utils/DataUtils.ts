import {join} from 'path';
import {Database, open} from 'sqlite';
import sqlite3 from 'sqlite3';
import {appendFileSync, readFileSync} from 'fs';

sqlite3.verbose();

/**
 * @description - Utility methods for data manipulation
 */
export class DataUtils {
  static db: Database;
  static config: {[key: string]: string};
  /**
   * @description - Initializes the database and configuration
   */
  static async init() {
    // Read configuration
    DataUtils.config = JSON.parse(readFileSync(join(process.cwd(), 'data', `${process.env.guild}.config.json`), 'utf8'));

    // Create file if it doesn't exist
    appendFileSync(join(process.cwd(), 'data', `${process.env.guild}.db`), '');

    this.db = await open({
      driver: sqlite3.Database,
      filename: join(process.cwd(), 'data', `${process.env.guild}.db`),
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    });

    // Create tables for moderation
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        case_id TEXT PRIMARY KEY NOT NULL,
        case_number INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        issuer_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        duration INTEGER,
        link TEXT
      )
    `);
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS warns (
        warn_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        issuer_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS mutes (
        mute_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        issuer_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        end INTEGER NOT NULL,
        permanent INTEGER NOT NULL,
        active INTEGER NOT NULL
      )
    `);
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS bans (
        ban_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        issuer_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        end INTEGER NOT NULL,
        permanent INTEGER NOT NULL,
        active INTEGER NOT NULL
      )
    `);

    // Create tables for tickets
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        ticket_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        closed_reason TEXT,
        closed INTEGER NOT NULL
      )
    `);

    // Create tables for applications
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        application_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        type STRING NOT NULL,
        answers TEXT NOT NULL,
        result INTEGER NOT NULL
      )
    `);

    // Create tables for reaction roles
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS reaction_roles (
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        role_id TEXT NOT NULL
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS reaction_max (
        message_id TEXT PRIMARY KEY NOT NULL,
        roles TEXT NOT NULL,
        max INTEGER NOT NULL
      )
    `);

    // Create custom messages

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        name TEXT PRIMARY KEY NOT NULL,
        json TEXT NOT NULL
      )
    `);
  }

  /**
   * @description - Queries the database
   * @param {string} sql - The SQL query to execute
   * @param {unknown[]} params - The parameters to pass to the query
   * @return {Promise<unknown[]>} - The results of the query
   */
  static async query(sql: string, ...params: unknown[]): Promise<unknown[]> {
    return DataUtils.db.all(sql, ...params);
  }
}
