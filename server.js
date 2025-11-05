import express from "express";
import path from "path";
import fs from "fs/promises"; // promise-based fs API
import { fileURLToPath } from "url";
import chalk from "chalk";

const app = express();
const PORT = process.env.PORT || 3000;

// Proper __dirname handling for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Logging utility
function log(msg, type = "info") {
  let prefix;
  switch (type) {
    case "error":
      prefix = `[${chalk.red("ERROR")}]`;
      console.error(prefix, msg);
      break;
    case "info":
      prefix = `[${chalk.blue("INFO")}]`;
      console.log(prefix, msg);
      break;
    case "success":
      prefix = `[${chalk.green("SUCCESS")}]`;
      console.log(prefix, msg);
      break;
    case "warning":
      prefix = `[${chalk.yellow("WARNING")}]`;
      console.warn(prefix, msg);
      break;
    case "debug":
      prefix = `[${chalk.gray("DEBUG")}]`;
      console.debug(prefix, msg);
      break;
  }
}

// Async course loader
async function getCourseStructure() {
  const subjects = ["Math", "Science", "English", "SocialScience"];
  const structure = {};

  for (const subject of subjects) {
    structure[subject] = {};

    for (let year = 1; year <= 13; year++) {
      const yearPath = path.join(__dirname, "courses", subject, `Year${year}`);

      try {
        const topics = await fs.readdir(yearPath);
        structure[subject][year] = [];

        for (const topic of topics) {
          const topicPath = path.join(yearPath, topic);
          const stat = await fs.stat(topicPath);

          if (stat.isDirectory()) {
            const files = await fs.readdir(topicPath);
            const lessons = files.filter((f) => f.endsWith(".json"));

            structure[subject][year].push({
              topicName: topic.replace(/^\d+_/, "").replace(/_/g, " "),
              topicSlug: topic,
              lessonCount: lessons.length,
            });
          }
        }
      } catch (err) {
        // Folder missing or no topics
        structure[subject][year] = [];
      }
    }
  }

  return structure;
}

// Routes
app.get("/", async (req, res) => {
  const structure = await getCourseStructure();
  res.render("index", { structure });
});

app.get("/subject/:subject", async (req, res) => {
  const { subject } = req.params;
  const structure = await getCourseStructure();

  if (!structure[subject]) {
    return res.status(404).send("Subject not found");
  }

  res.render("subject", { subject, years: structure[subject] });
});

app.get("/subject/:subject/year/:year", async (req, res) => {
  const { subject, year } = req.params;
  const structure = await getCourseStructure();

  if (!structure[subject] || !structure[subject][year]) {
    return res.status(404).send("Not found");
  }

  res.render("year", {
    subject,
    year: parseInt(year),
    topics: structure[subject][year],
  });
});

app.get("/subject/:subject/year/:year/topic/:topic", async (req, res) => {
  // New "topic" page: choose a lesson within a topic.
  // This route renders a lightweight HTML page (roadmap style) and uses localStorage
  // on the client to decide which lessons are selectable (completed lessons + the next one).
  const { subject, year, topic } = req.params;
  const topicPath = path.join(
    __dirname,
    "courses",
    subject,
    `Year${year}`,
    topic,
  );

  try {
    const files = await fs.readdir(topicPath);
    const lessonFiles = files.filter((f) => f.endsWith(".json"));

    // Sort lessons numerically by the lesson number in the filename (lesson1.json, lesson2.json, ...)
    lessonFiles.sort((a, b) => {
      const aNum = parseInt(
        (a.match(/lesson(\d+)\.json/i) || [null, "0"])[1],
        10,
      );
      const bNum = parseInt(
        (b.match(/lesson(\d+)\.json/i) || [null, "0"])[1],
        10,
      );
      return aNum - bNum;
    });

    const lessons = lessonFiles
      .map((f) => {
        const match = f.match(/lesson(\d+)\.json/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(Boolean);

    // Build a simple HTML page (inline CSS + JS) so we don't need to add a new EJS file.
    const pageTitle = `${subject} - Year ${year} - ${topic.replace(/_/g, " ")}`;
    const safeTopicLabel = topic.replace(/_/g, " ");

    const html = `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${pageTitle}</title>
        <link rel="stylesheet" href="/css/style.css">
        <style>
          /* Roadmap inline styles (kept minimal so they blend with existing styles) */
          .roadmap-wrap { max-width: 900px; margin: 30px auto; padding: 20px; background: var(--bg-primary, #fff); border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
          .roadmap-header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 18px; }
          .roadmap-title { font-size:1.4rem; font-weight:700; color:var(--text-primary,#111); }
          .roadmap-list { display:flex; flex-direction:column; gap:16px; padding:0; margin:0; list-style:none; }
          .roadmap-step { display:flex; align-items:center; gap:16px; cursor:default; user-select:none; }
          .roadmap-circle { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1rem; border:3px solid var(--color-neutral-200,#ddd); color:var(--text-primary,#111); background:var(--bg-secondary,#fafafa); transition:all .18s ease; flex:0 0 44px; }
          .roadmap-step .label { flex:1; display:flex; align-items:center; justify-content:space-between; gap:12px; padding-right:8px; }
          .roadmap-title-text { font-weight:600; }
          .roadmap-meta { color:var(--color-muted,#666); font-size:0.95rem; }
          .roadmap-connector { height:18px; width:2px; background:var(--color-neutral-200,#ddd); margin-left:21px; margin-top:-6px; margin-bottom:-6px; align-self:stretch; }
          .roadmap-step.locked { opacity:0.45; }
          .roadmap-step.locked .roadmap-circle { border-color:var(--color-neutral-200,#ddd); background:transparent; color:var(--color-muted,#999); }
          .roadmap-step.unlocked { cursor:pointer; }
          .roadmap-step.unlocked:hover .roadmap-circle { transform:scale(1.03); box-shadow:0 6px 18px rgba(0,0,0,0.06); }
          .roadmap-step.completed .roadmap-circle { background: linear-gradient(135deg,#8ef7a1,#4cd964); color:#053; border-color: #4cd964; }
          .roadmap-footer { margin-top:18px; display:flex; justify-content:flex-end; gap:8px; }
          .btn-small { padding:8px 12px; border-radius:8px; border:0; background:var(--color-primary,#2b6cb0); color:#fff; cursor:pointer; font-weight:600; }
          @media (max-width:640px){ .roadmap-wrap{margin:14px 12px;} }
        </style>
      </head>
      <body>
        <nav class="navbar">
          <div class="nav-container">
            <a href="/" class="nav-logo">Learning Hub</a>
            <div class="nav-links">
              <a href="/subject/${encodeURIComponent(subject)}" class="nav-link">${subject}</a>
            </div>
          </div>
        </nav>

        <main class="main-container">
          <div class="breadcrumb">
            <a href="/">Home</a> / <a href="/subject/${encodeURIComponent(subject)}">${subject}</a> / <a href="/subject/${encodeURIComponent(subject)}/year/${year}">Year ${year}</a> / <span>${safeTopicLabel}</span>
          </div>

          <div class="roadmap-wrap">
            <div class="roadmap-header">
              <div>
                <div class="roadmap-title">${safeTopicLabel}</div>
                <div class="roadmap-meta">${lessons.length} lesson${lessons.length !== 1 ? "s" : ""} available</div>
              </div>
              <div>
                <a href="/subject/${encodeURIComponent(subject)}/year/${year}" class="btn btn-secondary">Back to Topics</a>
              </div>
            </div>

            <ul class="roadmap-list" id="roadmapList">
              ${lessons
                .map(
                  (num, idx) => `
                <li class="roadmap-step" data-lesson="${num}" data-index="${idx}">
                  <div class="roadmap-circle">${num}</div>
                  <div class="label">
                    <div class="roadmap-title-text">Lesson ${num}</div>
                    <div class="roadmap-meta" id="meta-${num}">Loading…</div>
                  </div>
                </li>
                ${idx < lessons.length - 1 ? '<div class="roadmap-connector"></div>' : ""}
              `,
                )
                .join("")}
            </ul>

            <div class="roadmap-footer">
              <button class="btn-small" id="resetProgress">Reset Progress</button>
            </div>
          </div>
        </main>

        <footer class="footer">
          <div class="footer-container">
            <p>&copy; 2025 Learning Hub. Empowering students from Year 1 to Year 13.</p>
          </div>
        </footer>

        <script>
          (function(){
            const subject = ${JSON.stringify(subject)};
            const year = ${JSON.stringify(year)};
            const topic = ${JSON.stringify(topic)};
            const lessonIds = ${JSON.stringify(lessons)};
            const listEl = document.getElementById('roadmapList');
            const key = 'completedLessons'; // stores array of "subject|year|topic|lesson"
            function readCompleted() {
              try {
                return JSON.parse(localStorage.getItem(key) || '[]');
              } catch (e) {
                return [];
              }
            }
            function isCompleted(id) {
              return readCompleted().includes(id);
            }
            function lessonIdFor(n) {
              return [subject, year, topic, n].join('|');
            }

            // Determine the highest completed lesson index for this topic
            const completedSet = new Set(readCompleted().filter(s => s.startsWith(subject + '|' + year + '|' + topic + '|')));
            const completedNumbers = Array.from(completedSet).map(s => parseInt(s.split('|').pop(), 10)).filter(Boolean).sort((a,b)=>a-b);
            const maxCompleted = completedNumbers.length ? Math.max(...completedNumbers) : 0;

            // Allowed lessons: all completed AND the next one after the highest completed
            const allowed = new Set(completedNumbers);
            if (lessonIds.length > 0) {
              const next = maxCompleted + 1;
              if (lessonIds.includes(next)) allowed.add(next);
              // Also allow lesson 1 if nothing completed
              if (maxCompleted === 0 && lessonIds.includes(1)) allowed.add(1);
            }

            // Render state
            lessonIds.forEach(n => {
              const li = listEl.querySelector('[data-lesson=\"' + n + '\"]');
              if (!li) return;
              const circle = li.querySelector('.roadmap-circle');
              const meta = li.querySelector('.roadmap-meta');
              const id = lessonIdFor(n);

              if (completedSet.has(id)) {
                li.classList.add('completed');
                meta.textContent = 'Completed';
              } else if (allowed.has(n)) {
                li.classList.add('unlocked');
                meta.textContent = 'Unlocked';
                li.addEventListener('click', () => {
                  location.href = '/lesson/' + encodeURIComponent(subject) + '/' + encodeURIComponent(year) + '/' + encodeURIComponent(topic) + '/' + encodeURIComponent(n);
                });
              } else {
                li.classList.add('locked');
                meta.textContent = 'Locked';
              }
            });

            document.getElementById('resetProgress').addEventListener('click', () => {
              if (!confirm('Clear completed lessons for ALL topics?')) return;
              localStorage.removeItem(key);
              // Reload to reflect new state
              location.reload();
            });

          })();
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    res.status(404).send("Topic not found");
  }
});

app.get("/lesson/:subject/:year/:topic/:lesson", async (req, res) => {
  // Render the regular lesson EJS template, but inject a small client-side script
  // that marks the lesson complete in localStorage when the lesson completion UI is shown.
  const { subject, year, topic, lesson } = req.params;
  const lessonPath = path.join(
    __dirname,
    "courses",
    subject,
    `Year${year}`,
    topic,
    `lesson${lesson}.json`,
  );

  try {
    const lessonData = await fs.readFile(lessonPath, "utf-8");
    const lessonContent = JSON.parse(lessonData);

    // Render via Express but capture the HTML so we can append a script to mark completion
    res.render(
      "lesson",
      {
        lesson: lessonContent,
        subject,
        year,
        topic,
        lessonNumber: lesson,
      },
      (err, html) => {
        if (err) {
          // If something goes wrong falling back to a simple error
          return res.status(500).send("Rendering error");
        }

        // Client-side script to mark this lesson as completed in localStorage when completion UI appears.
        const completionScript = `
<script>
  (function() {
    const subject = ${JSON.stringify(subject)};
    const year = ${JSON.stringify(year)};
    const topic = ${JSON.stringify(topic)};
    const lessonNum = ${JSON.stringify(lesson)};
    const key = 'completedLessons';

    function lessonId() {
      return [subject, year, topic, lessonNum].join('|');
    }

    function markCompleted() {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        const id = lessonId();
        if (!arr.includes(id)) {
          arr.push(id);
          localStorage.setItem(key, JSON.stringify(arr));
          // Optionally dispatch an event so other pages (if open) can react
          window.dispatchEvent(new CustomEvent('lessonCompleted', { detail: { id } }));
        }
      } catch (e) {
        // ignore localStorage errors
      }
    }

    // Detect when the completion container becomes visible.
    document.addEventListener('DOMContentLoaded', function() {
      const completionEl = document.getElementById('completionContainer');

      if (!completionEl) return;

      // If it's already visible at load time, mark as complete
      if (window.getComputedStyle(completionEl).display !== 'none') {
        markCompleted();
        return;
      }

      // Observe for style changes (the lesson code toggles display)
      const observer = new MutationObserver(function(mutations) {
        const display = window.getComputedStyle(completionEl).display;
        if (display !== 'none') {
          markCompleted();
          observer.disconnect();
        }
      });

      observer.observe(completionEl, { attributes: true, attributeFilter: ['style'] });

      // As a fallback, poll occasionally
      const poll = setInterval(function() {
        if (window.getComputedStyle(completionEl).display !== 'none') {
          markCompleted();
          clearInterval(poll);
        }
      }, 400);
    });
  })();
</script>
      `;

        // Append the script to the rendered HTML and send it. Since some templates may not
        // include closing </body>, we simply append the script at the end of the HTML.
        html = html + completionScript;
        res.send(html);
      },
    );
  } catch (err) {
    res.status(404).send("Lesson not found");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  log(`Server running on port ${chalk.green(PORT)}`, "success");
});
