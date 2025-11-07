import chalk from "chalk";
import mongoose from "mongoose";

// Define Proxy Session Schema
const proxySessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
    default: null,
  },
  totalCreditsCharged: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "completed", "terminated"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Define Proxy Usage Log Schema
const proxyUsageLogSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProxySession",
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  destinationUrl: {
    type: String,
    required: true,
  },
  requestMethod: {
    type: String,
    required: true,
  },
  responseStatus: {
    type: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Define Credit Transaction Schema
const creditTransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProxySession",
    required: true,
    index: true,
  },
  creditsDeducted: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    enum: ["minute_charge", "session_termination"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create models
const ProxySession = mongoose.model("ProxySession", proxySessionSchema);
const ProxyUsageLog = mongoose.model("ProxyUsageLog", proxyUsageLogSchema);
const CreditTransaction = mongoose.model(
  "CreditTransaction",
  creditTransactionSchema,
);

const PROXY_COST_PER_MINUTE = 20;
const activeSessions = new Map();

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
  }
}

export async function createProxySession(userId, user) {
  try {
    // Create session record in MongoDB
    const session = new ProxySession({
      userId,
      status: "active",
    });

    await session.save();

    const sessionData = {
      sessionId: session._id.toString(),
      userId,
      user,
      startTime: new Date(),
      minutesElapsed: 0,
      chargedMinutes: 0,
      totalCharged: 0,
      chargeInterval: null,
    };

    activeSessions.set(session._id.toString(), sessionData);
    startAutomaticCharging(session._id.toString(), user);

    log(
      `Proxy session created for ${chalk.grey.italic(user.username)}: ${session._id.toString()}`,
      "success",
    );

    return session._id.toString();
  } catch (error) {
    log(`Failed to create proxy session: ${error.message}`, "error");
    throw error;
  }
}

function startAutomaticCharging(sessionId, user) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.chargeInterval = setInterval(async () => {
    try {
      session.minutesElapsed++;

      if (user.credits.total < PROXY_COST_PER_MINUTE) {
        log(
          `User ${chalk.grey.italic(user.username)} terminated proxy session: insufficient credits`,
          "warning",
        );
        await terminateProxySession(sessionId, user);
        clearInterval(session.chargeInterval);
        return;
      }

      user.credits.total -= PROXY_COST_PER_MINUTE;
      user.credits.spent = (user.credits.spent || 0) + PROXY_COST_PER_MINUTE;
      await user.save();

      session.chargedMinutes++;
      session.totalCharged += PROXY_COST_PER_MINUTE;

      // Log credit transaction to MongoDB
      const transaction = new CreditTransaction({
        userId: user._id.toString(),
        sessionId: new mongoose.Types.ObjectId(sessionId),
        creditsDeducted: PROXY_COST_PER_MINUTE,
        reason: "minute_charge",
      });

      await transaction.save();

      // Update session with new total
      await ProxySession.findByIdAndUpdate(sessionId, {
        totalCreditsCharged: session.totalCharged,
      });

      log(
        `Charged ${chalk.yellow(PROXY_COST_PER_MINUTE)} credits to ${chalk.grey.italic(user.username)} (Min ${session.chargedMinutes})`,
        "info",
      );
    } catch (error) {
      log(`Error charging credits: ${error.message}`, "error");
    }
  }, 60000);
}

export async function terminateProxySession(sessionId, user) {
  try {
    const session = activeSessions.get(sessionId);

    if (session) {
      clearInterval(session.chargeInterval);
      activeSessions.delete(sessionId);
    }

    // Update session in MongoDB
    await ProxySession.findByIdAndUpdate(sessionId, {
      status: "terminated",
      endTime: new Date(),
      totalCreditsCharged: session?.totalCharged || 0,
    });

    log(
      `Proxy session terminated for ${chalk.grey.italic(user.username)}: ${sessionId}`,
      "warning",
    );
  } catch (error) {
    log(`Failed to terminate proxy session: ${error.message}`, "error");
  }
}

export async function logProxyRequest(
  sessionId,
  userId,
  url,
  method,
  responseStatus,
) {
  try {
    const log_entry = new ProxyUsageLog({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      userId,
      destinationUrl: url,
      requestMethod: method,
      responseStatus,
    });

    await log_entry.save();
  } catch (error) {
    log(`Failed to log proxy request: ${error.message}`, "error");
  }
}

export function getSessionData(sessionId) {
  return activeSessions.get(sessionId);
}

export function getAllActiveSessions() {
  return Array.from(activeSessions.values());
}

export const PROXY_COST_PER_MINUTE_EXPORT = PROXY_COST_PER_MINUTE;

// Export models for server.js to use
export { ProxySession, ProxyUsageLog, CreditTransaction };
