const fs = require("node:fs");
const path = require("node:path");

const requiredEnv = {
    apiKey: "FIREBASE_API_KEY",
    authDomain: "FIREBASE_AUTH_DOMAIN",
    databaseURL: "FIREBASE_DATABASE_URL",
    projectId: "FIREBASE_PROJECT_ID",
    storageBucket: "FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
    appId: "FIREBASE_APP_ID"
};

const missing = Object.values(requiredEnv).filter((envName) => !process.env[envName] || !process.env[envName].trim());

if (missing.length) {
    console.error("Firebase config was not generated. Missing environment variables:");
    missing.forEach((envName) => console.error(`- ${envName}`));
    process.exit(1);
}

const firebaseConfig = Object.fromEntries(
    Object.entries(requiredEnv).map(([configKey, envName]) => [configKey, process.env[envName].trim()])
);

const outputPath = path.resolve(__dirname, "..", "firebase-config.js");
const output = `export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 4)};\n`;

fs.writeFileSync(outputPath, output, "utf8");
console.log("firebase-config.js generated from deployment environment variables.");
