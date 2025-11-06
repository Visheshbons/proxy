import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import chalk from "chalk";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import { authenticate, requireAuth } from "./middleware/auth.js";
import { setTimeout } from "timers/promises";

// Load environment variables
dotenv.config();

// --- Centralized Credit & Economy Configuration ---
const LESSON_UNLOCK_COST = 50; // Cost to unlock a single lesson
const PROXY_ACCESS_REQUIREMENT = 1000; // Min credits to access proxy
const DAILY_LOGIN_REWARD = 10; // Credits for logging in each day
const LESSON_COMPLETION_REWARD = 25; // Base credits for completing a lesson
const PERFECT_LESSON_BONUS = 50; // *Additional* credits for a perfect score
// ---

const app = express();
const PORT = process.env.PORT || 3000;

// Proper __dirname handling for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
log("Connecting to MongoDB...", "info");
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => log("Connected to MongoDB", "success"))
  .catch((err) => log(`MongoDB connection error: ${err.message}`, "error"));

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      touchAfter: 24 * 3600, // Lazy session update
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  }),
);

// Authentication middleware
app.use(authenticate);

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
        structure[subject][year] = [];
      }
    }
  }

  return structure;
}

app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.user;
  res.locals.user = req.user;
  next();
});

// Auth Routes
app.get("/auth/register", (req, res) => {
  if (req.user) return res.redirect("/profile");
  res.render("auth/register", { error: null });
});

app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("auth/register", { error: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.render("auth/register", {
        error: "Username or email already exists",
      });
    }

    const user = new User({ username, email, password });

    // Migrate localStorage data if provided
    if (req.body.migrateData) {
      try {
        const completedLessons = JSON.parse(req.body.migrateData);
        user.completedLessons = completedLessons;
      } catch (e) {
        log("Failed to migrate localStorage data", "warning");
      }
    }

    await user.save();

    log(`New user registered: ${chalk.grey.italic(user.username)}`, "info");

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    req.session.token = token;
    res.redirect("/profile");
  } catch (error) {
    log(`Registration error: ${error.message}`, "error");
    res.render("auth/register", {
      error: "Registration failed. Please try again.",
    });
  }
});

app.get("/auth/login", (req, res) => {
  if (req.user) return res.redirect("/profile");
  res.render("auth/login", { error: null, redirect: req.query.redirect });
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.render("auth/login", {
        error: "Invalid email or password",
        redirect: req.body.redirect,
      });
    }

    // Check and award daily login credits
    user.checkDailyLogin(DAILY_LOGIN_REWARD); // <-- UPDATED
    user.lastLogin = new Date();

    // Migrate localStorage data if provided
    if (req.body.migrateData) {
      try {
        const completedLessons = JSON.parse(req.body.migrateData);
        // Merge with existing completed lessons
        const merged = [
          ...new Set([...user.completedLessons, ...completedLessons]),
        ];
        user.completedLessons = merged;
      } catch (e) {
        log("Failed to migrate localStorage data", "warning");
      }
    }

    await user.save();

    log(`User ${chalk.grey.italic(user.username)} logged in`, "info");

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    req.session.token = token;

    const redirectUrl = req.body.redirect || "/profile";
    res.redirect(redirectUrl);
  } catch (error) {
    log(`Login error: ${error.message}`, "error");
    res.render("auth/login", {
      error: "Login failed. Please try again.",
      redirect: req.body.redirect,
    });
  }
});

app.get("/auth/logout", (req, res) => {
  const username = req.user ? req.user.username : "User";

  req.session.destroy((err) => {
    if (err) {
      log(`Session destruction error for ${username}: ${err.message}`, "error");
    }

    log(`User ${chalk.grey.italic(username)} logged out`, "info");

    res.redirect("/");
  });
});

// Profile Route
app.get("/profile", requireAuth, async (req, res) => {
  const structure = await getCourseStructure();
  res.render("profile", {
    user: req.user,
    structure,
  });
});

// API endpoint to get user progress
app.get("/api/progress", authenticate, (req, res) => {
  if (!req.user) {
    return res.json({
      completedLessons: [],
      unlockedLessons: [],
      theme: "light",
    });
  }
  res.json({
    completedLessons: req.user.completedLessons,
    unlockedLessons: req.user.unlockedLessons || [], // Use || [] for safety
    theme: req.user.preferences.theme,
  });
});

// API endpoint to save lesson completion
app.post("/api/lesson/complete", authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ success: false, message: "Not authenticated" });
    }

    const { lessonId, isPerfect } = req.body;
    let creditsEarned = 0;

    if (!req.user.completedLessons.includes(lessonId)) {
      req.user.completedLessons.push(lessonId);
      // If it was purchased, remove from unlocked array
      if (req.user.unlockedLessons) {
        req.user.unlockedLessons = req.user.unlockedLessons.filter(
          (id) => id !== lessonId,
        );
      }

      // Award credits using the centralized constants
      req.user.awardLessonCredits(
        lessonId,
        isPerfect,
        LESSON_COMPLETION_REWARD,
        PERFECT_LESSON_BONUS,
      ); // <-- UPDATED

      // Calculate earned credits for the response
      creditsEarned = isPerfect
        ? LESSON_COMPLETION_REWARD + PERFECT_LESSON_BONUS
        : LESSON_COMPLETION_REWARD; // <-- UPDATED

      await req.user.save();
    }

    res.json({
      success: true,
      credits: req.user.credits.total,
      creditsEarned: creditsEarned, // <-- UPDATED
    });
  } catch (error) {
    log(`Lesson completion error: ${error.message}`, "error");
    res.json({ success: false, message: "Failed to save progress" });
  }
});

// API endpoint to unlock a lesson with credits
app.post("/api/lesson/unlock", requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.body;

    if (!lessonId) {
      return res
        .status(400)
        .json({ success: false, message: "Lesson ID required" });
    }

    // Check if already owned
    if (
      req.user.completedLessons.includes(lessonId) ||
      (req.user.unlockedLessons && req.user.unlockedLessons.includes(lessonId))
    ) {
      return res.json({ success: true, message: "Lesson already unlocked" });
    }

    // Check credits (using constant)
    if (req.user.credits.total < LESSON_UNLOCK_COST) {
      // <-- USES CONSTANT
      return res
        .status(402)
        .json({ success: false, message: "Insufficient credits" });
    }

    // Deduct credits and unlock
    req.user.credits.total -= LESSON_UNLOCK_COST;
    req.user.credits.spent = (req.user.credits.spent || 0) + LESSON_UNLOCK_COST;

    if (!req.user.unlockedLessons) {
      // Initialize array if it doesn't exist
      req.user.unlockedLessons = [];
    }
    req.user.unlockedLessons.push(lessonId);

    await req.user.save();

    res.json({
      success: true,
      lessonId,
      newCreditTotal: req.user.credits.total,
    });
  } catch (error) {
    log(`Lesson unlock error: ${error.message}`, "error");
    res
      .status(500)
      .json({ success: false, message: "Failed to unlock lesson" });
  }
});

// API endpoint to update theme preference
app.post("/api/preferences/theme", authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ success: false });
    }

    const { theme } = req.body;
    req.user.preferences.theme = theme;
    await req.user.save();

    res.json({ success: true });
  } catch (error) {
    log(`Theme update error: ${error.message}`, "error");
    res.json({ success: false });
  }
});

// Main Routes
app.get("/", async (req, res) => {
  const structure = await getCourseStructure();
  res.render("index", { structure, user: req.user });
});

app.get("/subject/:subject", async (req, res) => {
  const { subject } = req.params;
  const structure = await getCourseStructure();

  if (!structure[subject]) {
    return res.status(404).send("Subject not found");
  }

  res.render("subject", { subject, years: structure[subject], user: req.user });
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
    user: req.user,
  });
});

app.get("/subject/:subject/year/:year/topic/:topic", async (req, res) => {
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

    const pageTitle = `${subject} - Year ${year} - ${topic.replace(/_/g, " ")}`;
    const safeTopicLabel = topic.replace(/_/g, " ");

    res.render("topic", {
      subject,
      year,
      topic,
      topicSlug: topic,
      topicName: safeTopicLabel,
      lessons,
      lessonCount: lessons.length,
      user: req.user,
    });
  } catch (err) {
    res.status(404).send("Topic not found");
  }
});

app.get("/lesson/:subject/:year/:topic/:lesson", async (req, res) => {
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

    res.render("lesson", {
      lesson: lessonContent,
      subject,
      year,
      topic,
      lessonNumber: lesson,
      user: req.user,
    });
  } catch (err) {
    res.status(4404).send("Lesson not found");
  }
});

// Middleware to check if user has at least 1,000 credits
function require1KCredits(req, res, next) {
  if (!req.user) {
    return res.redirect("/auth/login?redirect=/proxy");
  }

  // Use the constant
  if (req.user.credits.total < PROXY_ACCESS_REQUIREMENT) {
    // <-- UPDATED
    log(
      `User ${chalk.grey.italic(req.user.username)} tried to access proxy without credits`,
      "warning",
    );
    return res.status(403).render("error", {
      // Use the constant
      message: `You need at least ${PROXY_ACCESS_REQUIREMENT.toLocaleString()} credits to access this feature.`, // <-- UPDATED
      user: req.user,
    });
  }

  next();
}

app.get("/proxy", requireAuth, require1KCredits, (req, res) => {
  res.status(303).send(`
      <center><pre>
        Work In Progress<br>
        Indev Beta accessable at <a href="/proxy/beta">/proxy/beta</a>
      </pre></center>
    `);
  log(
    `User ${chalk.grey.italic(req.user.username)} tried to access ${chalk.grey.italic("/proxy")}`,
    "warning",
  );
});

// 404 Handler
app.use((req, res) => {
  res.status(404).send(`
    <center><pre>
      ERR_404_PAGE_NOT_FOUND<br>
      Page not found<br>
      Please check the URL or try again later.
    </pre></center>
  `);
});

// 500 Handler
app.use((err, req, res, next) => {
  log(`Internal Server Error: ${err.message}`, "error");
  res.status(500).send(`
    <center><pre>
      ERR_500_INTERNAL_SERVER_ERROR<br>
      Something has gone seriously wrong.<br>
      Please contact the developer at <a href="mailto:vishesh.kudva@outlook.com">vishesh.kudva@outlook.com</a>.
    </pre></center>
  `);
});

app.listen(PORT, "0.0.0.0", async () => {
  log(`Server running on port ${chalk.green(PORT)}`, "success");
  await setTimeout(10000);

  //newline
  console.log();

  log("--- Credit & Economy Settings ---", "info");
  log(
    `Daily Login Reward:         ${chalk.green(DAILY_LOGIN_REWARD)} credits`,
    "info",
  );
  log(
    `Lesson Completion Reward:   ${chalk.green(LESSON_COMPLETION_REWARD)} credits`,
    "info",
  );
  log(
    `Perfect Lesson Bonus:       ${chalk.green(PERFECT_LESSON_BONUS)} credits (Total: ${
      LESSON_COMPLETION_REWARD + PERFECT_LESSON_BONUS
    })`,
    "info",
  );
  log(
    `Lesson Unlock Cost:         ${chalk.yellow(LESSON_UNLOCK_COST)} credits`,
    "info",
  );
  log(
    `Proxy Access Requirement:   ${chalk.yellow(
      PROXY_ACCESS_REQUIREMENT,
    )} credits`,
    "info",
  );
  // newline
  console.log();
});
