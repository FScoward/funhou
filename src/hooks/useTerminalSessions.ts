import { useState, useCallback } from 'react';
import Database from '@tauri-apps/plugin-sql';

export interface TerminalSession {
    id: number;
    entry_id: number;
    output: string;
    created_at: string;
    updated_at: string;
}

export const useTerminalSessions = (database: Database | null) => {
    const [sessions, setSessions] = useState<Record<number, TerminalSession>>({});

    const loadSession = useCallback(async (entryId: number) => {
        if (!database) return null;
        try {
            const result = await database.select<TerminalSession[]>(
                'SELECT * FROM terminal_sessions WHERE entry_id = ? ORDER BY created_at DESC LIMIT 1',
                [entryId]
            );
            if (result.length > 0) {
                const session = result[0];
                setSessions(prev => ({ ...prev, [entryId]: session }));
                return session;
            }
        } catch (error) {
            console.error('Failed to load terminal session:', error);
        }
        return null;
    }, [database]);

    const createSession = useCallback(async (entryId: number, initialOutput: string = '') => {
        if (!database) return null;
        try {
            const result = await database.execute(
                'INSERT INTO terminal_sessions (entry_id, output) VALUES (?, ?)',
                [entryId, initialOutput]
            );
            const id = result.lastInsertId || 0;
            const newSession: TerminalSession = {
                id,
                entry_id: entryId,
                output: initialOutput,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            setSessions(prev => ({ ...prev, [entryId]: newSession }));
            return newSession;
        } catch (error) {
            console.error('Failed to create terminal session:', error);
            return null;
        }
    }, [database]);

    const updateSessionOutput = useCallback(async (sessionId: number, entryId: number, newOutput: string) => {
        if (!database) return;
        try {
            await database.execute(
                'UPDATE terminal_sessions SET output = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newOutput, sessionId]
            );
            setSessions(prev => {
                const current = prev[entryId];
                if (current && current.id === sessionId) {
                    return { ...prev, [entryId]: { ...current, output: newOutput } };
                }
                return prev;
            });
        } catch (error) {
            console.error('Failed to update terminal session:', error);
        }
    }, [database]);

    return {
        sessions,
        loadSession,
        createSession,
        updateSessionOutput,
    };
};
