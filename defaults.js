// ============================================================
// DEFAULT STUDY SITES — Pre-loaded educational website whitelist
// ============================================================

const DEFAULT_STUDY_SITES = [
  // Video Course Platforms
  "udemy.com",
  "coursera.org",
  "edx.org",
  "khanacademy.org",
  "skillshare.com",
  "pluralsight.com",
  "linkedin.com",

  // Coding Platforms
  "freecodecamp.org",
  "leetcode.com",
  "hackerrank.com",
  "codewars.com",
  "codecademy.com",
  "exercism.org",
  "w3schools.com",

  // Documentation
  "developer.mozilla.org",
  "devdocs.io",
  "learn.microsoft.com",
  "docs.python.org",
  "reactjs.org",
  "nodejs.org",

  // Q&A / Reference
  "stackoverflow.com",
  "stackexchange.com",
  "geeksforgeeks.org",
  "medium.com",
  "dev.to",
  "github.com",

  // Video (Educational)
  "youtube.com",

  // AI Learning Tools
  "chatgpt.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai"
];

// ============================================================
// WEBSITE CATEGORIES — Auto-grouping for analytics
// ============================================================

const CATEGORY_LIST = [
  "Video Courses",
  "Coding Practice",
  "Documentation",
  "Q&A / Reference",
  "Video",
  "AI Tools",
  "Custom"
];

const CATEGORY_INFO = {
  "Video Courses":   { emoji: "📹", color: "#f472b6" },
  "Coding Practice": { emoji: "💻", color: "#60a5fa" },
  "Documentation":   { emoji: "📖", color: "#facc15" },
  "Q&A / Reference": { emoji: "💬", color: "#4ade80" },
  "Video":           { emoji: "🎥", color: "#a78bfa" },
  "AI Tools":        { emoji: "🤖", color: "#22d3ee" },
  "Custom":          { emoji: "📌", color: "#fb923c" }
};

const DEFAULT_SITE_CATEGORIES = {
  // Video Course Platforms
  "udemy.com":        "Video Courses",
  "coursera.org":     "Video Courses",
  "edx.org":          "Video Courses",
  "khanacademy.org":  "Video Courses",
  "skillshare.com":   "Video Courses",
  "pluralsight.com":  "Video Courses",
  "linkedin.com":     "Video Courses",

  // Coding Platforms
  "freecodecamp.org": "Coding Practice",
  "leetcode.com":     "Coding Practice",
  "hackerrank.com":   "Coding Practice",
  "codewars.com":     "Coding Practice",
  "codecademy.com":   "Coding Practice",
  "exercism.org":     "Coding Practice",
  "w3schools.com":    "Coding Practice",

  // Documentation
  "developer.mozilla.org": "Documentation",
  "devdocs.io":            "Documentation",
  "learn.microsoft.com":   "Documentation",
  "docs.python.org":       "Documentation",
  "reactjs.org":           "Documentation",
  "nodejs.org":            "Documentation",

  // Q&A / Reference
  "stackoverflow.com":  "Q&A / Reference",
  "stackexchange.com":  "Q&A / Reference",
  "geeksforgeeks.org":  "Q&A / Reference",
  "medium.com":         "Q&A / Reference",
  "dev.to":             "Q&A / Reference",
  "github.com":         "Q&A / Reference",

  // Video (Educational)
  "youtube.com": "Video",

  // AI Learning Tools
  "chatgpt.com":        "AI Tools",
  "claude.ai":          "AI Tools",
  "gemini.google.com":  "AI Tools",
  "perplexity.ai":      "AI Tools"
};
