import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  verificationCode: {
    type: String,
    default: null,
  },
  verificationCodeExpires: {
    type: Date,
    default: null,
  },
  completedLessons: [
    {
      type: String, // Format: "subject|year|topic|lesson"
    },
  ],
  unlockedLessons: [
    // <-- ADDED THIS
    {
      type: String, // Format: "subject|year|topic|lesson"
    },
  ],
  credits: {
    total: {
      type: Number,
      default: 0,
    },
    spent: {
      // <-- ADDED THIS
      type: Number,
      default: 0,
    },
    dailyLoginStreak: [
      {
        type: Date,
      },
    ],
    perfectLessonStreak: [
      {
        type: String, // Format: "subject|year|topic|lesson"
      },
    ],
  },
  preferences: {
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check and award daily login credits
userSchema.methods.checkDailyLogin = function (rewardAmount) {
  // <-- UPDATED
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastLogin =
    this.credits.dailyLoginStreak.length > 0
      ? new Date(
          this.credits.dailyLoginStreak[
            this.credits.dailyLoginStreak.length - 1
          ],
        )
      : null;

  if (lastLogin) {
    lastLogin.setHours(0, 0, 0, 0);
  }

  // Award credits if last login was not today
  if (!lastLogin || lastLogin.getTime() !== today.getTime()) {
    this.credits.dailyLoginStreak.push(today);
    this.credits.total += rewardAmount; // Daily login reward <-- UPDATED
    return true;
  }

  return false;
};

// Method to award lesson completion credits
userSchema.methods.awardLessonCredits = function (
  lessonId,
  isPerfect = false,
  baseReward, // <-- UPDATED
  perfectBonus, // <-- UPDATED
) {
  // Base credits for completing a lesson
  this.credits.total += baseReward; // <-- UPDATED

  // Bonus credits for perfect completion
  if (isPerfect && !this.credits.perfectLessonStreak.includes(lessonId)) {
    this.credits.perfectLessonStreak.push(lessonId);
    this.credits.total += perfectBonus; // Perfect lesson bonus <-- UPDATED
  }
};

export default mongoose.model("User", userSchema);
