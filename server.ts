import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("projects.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    is_invoiced BOOLEAN DEFAULT 0,
    is_accepted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add is_pr_created column if it doesn't exist
try {
  db.exec("ALTER TABLE projects ADD COLUMN is_pr_created BOOLEAN DEFAULT 0");
} catch (e) {
  // Column might already exist, ignore
}

// Add new columns for dates and notes
try { db.exec("ALTER TABLE projects ADD COLUMN start_date TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN acceptance_date TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN notes TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN acceptance_terms TEXT DEFAULT '100%'"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN is_urgent_pr BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN assignee TEXT"); } catch (e) {}

// Create project_files table
db.exec(`
  CREATE TABLE IF NOT EXISTS project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  )
`);

// Create project_milestones table
db.exec(`
  CREATE TABLE IF NOT EXISTS project_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_accepted BOOLEAN DEFAULT 0,
    is_invoiced BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.get("/api/projects", (req, res) => {
    try {
      const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
      const files = db.prepare("SELECT id, project_id, name, type, size, created_at FROM project_files").all();
      const milestones = db.prepare("SELECT * FROM project_milestones").all();
      
      // Map 0/1 back to boolean for the frontend
      const mappedProjects = projects.map((p: any) => ({
        ...p,
        is_invoiced: !!p.is_invoiced,
        is_accepted: !!p.is_accepted,
        is_pr_created: !!p.is_pr_created,
        is_urgent_pr: !!p.is_urgent_pr,
        files: files.filter((f: any) => f.project_id === p.id),
        milestones: milestones
          .filter((m: any) => m.project_id === p.id)
          .map((m: any) => ({
            ...m,
            is_accepted: !!m.is_accepted,
            is_invoiced: !!m.is_invoiced
          }))
      }));
      res.json(mappedProjects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", (req, res) => {
    try {
      const { title, description, start_date, acceptance_date, notes, is_urgent_pr, assignee } = req.body;
      const info = db.prepare(
        "INSERT INTO projects (title, description, start_date, acceptance_date, notes, is_urgent_pr, assignee) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(title, description, start_date || null, acceptance_date || null, notes || null, is_urgent_pr ? 1 : 0, assignee || null);
      const newProject = db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid);
      res.json({
        ...newProject,
        is_invoiced: !!newProject.is_invoiced,
        is_accepted: !!newProject.is_accepted,
        is_pr_created: !!newProject.is_pr_created,
        is_urgent_pr: !!newProject.is_urgent_pr,
        files: [],
        milestones: []
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/bulk", (req, res) => {
    try {
      const projects = req.body.projects;
      if (!Array.isArray(projects)) {
        return res.status(400).json({ error: "projects must be an array" });
      }

      const insertProject = db.prepare(
        "INSERT INTO projects (title, description, start_date, acceptance_date, notes, is_urgent_pr, assignee) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      
      const insertMilestone = db.prepare(
        "INSERT INTO project_milestones (project_id, name) VALUES (?, ?)"
      );

      const newProjects = [];

      db.transaction(() => {
        for (const p of projects) {
          const info = insertProject.run(p.title, p.description || null, p.start_date || null, p.acceptance_date || null, p.notes || null, p.is_urgent_pr ? 1 : 0, p.assignee || null);
          const projectId = info.lastInsertRowid;
          
          const milestones = [];
          if (p.milestones && Array.isArray(p.milestones)) {
            for (const m of p.milestones) {
              const mInfo = insertMilestone.run(projectId, m.name);
              milestones.push({
                id: mInfo.lastInsertRowid,
                project_id: projectId,
                name: m.name,
                is_accepted: false,
                is_invoiced: false
              });
            }
          }

          const newProject = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
          newProjects.push({
            ...newProject,
            is_invoiced: !!newProject.is_invoiced,
            is_accepted: !!newProject.is_accepted,
            is_pr_created: !!newProject.is_pr_created,
            is_urgent_pr: !!newProject.is_urgent_pr,
            files: [],
            milestones
          });
        }
      })();

      res.json(newProjects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }

      const fields = Object.keys(updates).map(key => `${key} = ?`).join(", ");
      // Convert booleans to 0/1 for SQLite
      const values = Object.values(updates).map(val => 
        typeof val === 'boolean' ? (val ? 1 : 0) : val
      );
      
      db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...values, id);
      const updatedProject = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      const files = db.prepare("SELECT id, project_id, name, type, size, created_at FROM project_files WHERE project_id = ?").all(id);
      const milestones = db.prepare("SELECT * FROM project_milestones WHERE project_id = ?").all(id).map((m: any) => ({
        ...m,
        is_accepted: !!m.is_accepted,
        is_invoiced: !!m.is_invoiced
      }));

      res.json({
        ...updatedProject,
        is_invoiced: !!updatedProject.is_invoiced,
        is_accepted: !!updatedProject.is_accepted,
        is_pr_created: !!updatedProject.is_pr_created,
        files,
        milestones
      });
    } catch (error: any) {
      console.error("Update error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("DELETE FROM project_milestones WHERE project_id = ?").run(id);
      db.prepare("DELETE FROM project_files WHERE project_id = ?").run(id);
      db.prepare("DELETE FROM projects WHERE id = ?").run(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // File Routes
  app.get("/api/files/:id", (req, res) => {
    try {
      const file = db.prepare("SELECT * FROM project_files WHERE id = ?").get(req.params.id);
      if (!file) return res.status(404).json({ error: "File not found" });
      res.json(file);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:id/files", (req, res) => {
    try {
      const { name, type, size, data } = req.body;
      const info = db.prepare("INSERT INTO project_files (project_id, name, type, size, data) VALUES (?, ?, ?, ?, ?)").run(req.params.id, name, type, size, data);
      const newFile = db.prepare("SELECT id, project_id, name, type, size, created_at FROM project_files WHERE id = ?").get(info.lastInsertRowid);
      res.json(newFile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/files/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM project_files WHERE id = ?").run(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Milestone Routes
  app.post("/api/projects/:id/milestones", (req, res) => {
    try {
      const { name } = req.body;
      const info = db.prepare("INSERT INTO project_milestones (project_id, name) VALUES (?, ?)").run(req.params.id, name);
      const newMilestone = db.prepare("SELECT * FROM project_milestones WHERE id = ?").get(info.lastInsertRowid);
      res.json({
        ...newMilestone,
        is_accepted: !!newMilestone.is_accepted,
        is_invoiced: !!newMilestone.is_invoiced
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/milestones/:id", (req, res) => {
    try {
      const updates = req.body;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No updates provided" });

      const fields = Object.keys(updates).map(key => `${key} = ?`).join(", ");
      const values = Object.values(updates).map(val => typeof val === 'boolean' ? (val ? 1 : 0) : val);
      
      db.prepare(`UPDATE project_milestones SET ${fields} WHERE id = ?`).run(...values, req.params.id);
      const updated = db.prepare("SELECT * FROM project_milestones WHERE id = ?").get(req.params.id);
      
      res.json({
        ...updated,
        is_accepted: !!updated.is_accepted,
        is_invoiced: !!updated.is_invoiced
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/milestones/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM project_milestones WHERE id = ?").run(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
