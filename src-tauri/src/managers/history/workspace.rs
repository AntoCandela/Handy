use super::*;

#[derive(Clone, Debug, Serialize, Type)]
pub struct TranscriptWorkspace {
    pub title: String,
    pub text: String,
    pub revision: i64,
    pub originals: Vec<String>,
}

pub(super) fn initialize(conn: &Connection) -> Result<()> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS handy_transcript_edits (
        entry_id INTEGER NOT NULL, revision INTEGER NOT NULL, text TEXT NOT NULL,
        PRIMARY KEY(entry_id, revision));
        CREATE TABLE IF NOT EXISTS handy_transcript_originals (
        entry_id INTEGER NOT NULL, text TEXT NOT NULL);
        CREATE TRIGGER IF NOT EXISTS handy_preserve_original BEFORE UPDATE OF transcription_text ON transcription_history
        WHEN OLD.transcription_text != NEW.transcription_text AND OLD.transcription_text != ''
        BEGIN INSERT INTO handy_transcript_originals(entry_id,text) VALUES(OLD.id,OLD.transcription_text); END;
        CREATE TRIGGER IF NOT EXISTS handy_remove_workspace AFTER DELETE ON transcription_history
        BEGIN DELETE FROM handy_transcript_edits WHERE entry_id=OLD.id;
        DELETE FROM handy_transcript_originals WHERE entry_id=OLD.id; END;")?;
    Ok(())
}

impl HistoryManager {
    pub fn transcript_workspace(&self, id: i64) -> Result<TranscriptWorkspace> {
        Self::workspace_with_conn(&self.get_connection()?, id)
    }
    pub(super) fn workspace_with_conn(conn: &Connection, id: i64) -> Result<TranscriptWorkspace> {
        let (title, raw, processed): (String, String, Option<String>) = conn.query_row(
            "SELECT title, transcription_text, post_processed_text FROM transcription_history WHERE id=?1", [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
        let edit: Option<(i64, String)> = conn.query_row("SELECT revision,text FROM handy_transcript_edits WHERE entry_id=?1 ORDER BY revision DESC LIMIT 1", [id], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
        let mut stmt =
            conn.prepare("SELECT text FROM handy_transcript_originals WHERE entry_id=?1 GROUP BY text ORDER BY MIN(rowid)")?;
        let mut originals = stmt
            .query_map([id], |r| r.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()?;
        if !originals.contains(&raw) {
            originals.push(raw.clone());
        }
        let (revision, text) = edit.unwrap_or((0, processed.unwrap_or(raw)));
        Ok(TranscriptWorkspace {
            title,
            text,
            revision,
            originals,
        })
    }
    pub fn save_transcript_edit(
        &self,
        id: i64,
        title: &str,
        text: &str,
        expected: i64,
    ) -> Result<()> {
        Self::save_edit_with_conn(&mut self.get_connection()?, id, title, text, expected)
    }
    fn save_edit_with_conn(
        conn: &mut Connection,
        id: i64,
        title: &str,
        text: &str,
        expected: i64,
    ) -> Result<()> {
        if title.trim().is_empty() || title.chars().count() > 200 || text.len() > 1_000_000 {
            return Err(anyhow!("Invalid transcript length or title"));
        }
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let current = Self::workspace_with_conn(&tx, id)?;
        if current.revision != expected {
            return Err(anyhow!("Transcript changed. Reopen it before saving."));
        }
        tx.execute(
            "INSERT INTO handy_transcript_edits(entry_id, revision, text) VALUES(?1,?2,?3)",
            params![id, expected + 1, text],
        )?;
        tx.execute(
            "UPDATE transcription_history SET title=?1, saved=1 WHERE id=?2",
            params![title.trim(), id],
        )?;
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn database() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        HistoryManager::apply_migrations(&mut conn).unwrap();
        conn.execute("INSERT INTO transcription_history(id,file_name,timestamp,saved,title,transcription_text) VALUES(1,'test.wav',100,0,'Original','First recognition')", []).unwrap();
        conn
    }
    #[test]
    fn retry_preserves_originals_and_user_edits_including_empty_text() {
        let mut conn = database();
        HistoryManager::save_edit_with_conn(&mut conn, 1, "My note", "", 0).unwrap();
        conn.execute("UPDATE transcription_history SET transcription_text='Second recognition',post_processed_text='Processed' WHERE id=1", []).unwrap();
        let result = HistoryManager::workspace_with_conn(&conn, 1).unwrap();
        assert_eq!(result.text, "");
        assert_eq!(result.title, "My note");
        assert_eq!(
            result.originals,
            vec!["First recognition", "Second recognition"]
        );
        assert!(conn
            .query_row(
                "SELECT saved FROM transcription_history WHERE id=1",
                [],
                |r| r.get::<_, bool>(0)
            )
            .unwrap());
    }
    #[test]
    fn stale_saves_are_rejected_and_delete_cleans_versions() {
        let mut conn = database();
        HistoryManager::save_edit_with_conn(&mut conn, 1, "First title", "First edit", 0).unwrap();
        assert!(
            HistoryManager::save_edit_with_conn(&mut conn, 1, "Stale title", "Stale edit", 0)
                .is_err()
        );
        assert_eq!(
            HistoryManager::workspace_with_conn(&conn, 1).unwrap().text,
            "First edit"
        );
        conn.execute("DELETE FROM transcription_history WHERE id=1", [])
            .unwrap();
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM handy_transcript_edits", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}
